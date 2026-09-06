'use client'
import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { fmtDate, fmtDateTime } from '@/lib/format'
import { Icon } from '@/components/icons'
import { SearchInput } from '@/components/ui'
import { cacheKey, loadCache, saveCache, loadQueue, saveQueue, type QueuedCheckIn } from './offline'

interface Venue { id: string; name: string }
interface Row {
  id: string; status: string; qr_token: string
  first_name: string; last_name: string; mobile: string; email: string | null
  promoter_name: string; promoter_code: string
  checked_in_at: string | null; notes: string | null; special_occasion: string | null
  method: string | null; plus_ones: number; group_id: string | null; source: string | null
}
type ScanResult = { kind: 'ok' | 'err' | 'warn'; title: string; sub?: string } | null

function localToday() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * The door. Search or scan, one tap to check in, and it keeps working when the
 * basement has no signal: tonight's list is cached on the device, check-ins made
 * offline are queued and sent the moment a connection comes back.
 */
export function ReceptionConsole({ venues, hasTabBar = false }: { venues: Venue[]; hasTabBar?: boolean }) {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const [venueId, setVenueId] = useState(venues[0]?.id ?? '')
  const [date, setDate] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [q, setQ] = useState('')
  const [toast, setToast] = useState<{ kind: 'ok' | 'warn' | 'err'; msg: string } | null>(null)
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<ScanResult>(null)
  const [loading, setLoading] = useState(false)
  const [online, setOnline] = useState(true)
  const [cachedAt, setCachedAt] = useState<string | null>(null)
  const [queued, setQueued] = useState(0)
  const [pickerOpen, setPickerOpen] = useState(false)
  const flushing = useRef(false)

  const flash = (kind: 'ok' | 'warn' | 'err', msg: string) => {
    setToast({ kind, msg }); setTimeout(() => setToast(null), 3500)
  }

  useEffect(() => {
    if (!scanResult) return
    const t = setTimeout(() => setScanResult(null), 2400)
    return () => clearTimeout(t)
  }, [scanResult])

  // set "today" on the client to avoid SSR/client timezone hydration mismatch
  useEffect(() => { setDate(localToday()); setOnline(navigator.onLine); setQueued(loadQueue().length) }, [])

  // ---- online / offline awareness ----
  useEffect(() => {
    const up = () => { setOnline(true); flush() }
    const down = () => setOnline(false)
    window.addEventListener('online', up); window.addEventListener('offline', down)
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venueId, date])

  const load = useCallback(async () => {
    if (!venueId || !date) { setRows([]); return }
    setLoading(true)
    const key = cacheKey(venueId, date)
    try {
      const { data, error } = await supabase
        .from('guest_registrations')
        .select('id,status,qr_token,special_occasion,plus_ones,group_id,source,guests(first_name,last_name,mobile,email),promoters(full_name,promoter_code),check_ins(checked_in_at,notes,method),events!inner(event_date)')
        .eq('venue_id', venueId).eq('events.event_date', date)
        .order('created_at', { ascending: false })
      if (error) throw error
      const mapped: Row[] = (data ?? []).map((r: any) => ({
        id: r.id, status: r.status, qr_token: r.qr_token,
        first_name: r.guests?.first_name ?? '', last_name: r.guests?.last_name ?? '',
        mobile: r.guests?.mobile ?? '', email: r.guests?.email ?? null,
        promoter_name: r.promoters?.full_name ?? '', promoter_code: r.promoters?.promoter_code ?? '',
        checked_in_at: r.check_ins?.[0]?.checked_in_at ?? r.check_ins?.checked_in_at ?? null,
        special_occasion: r.special_occasion ?? null,
        notes: r.check_ins?.[0]?.notes ?? null,
        method: r.check_ins?.[0]?.method ?? r.check_ins?.method ?? null,
        plus_ones: r.plus_ones ?? 0, group_id: r.group_id ?? null, source: r.source ?? null,
      }))
      setRows(mapped)
      const at = new Date().toISOString()
      saveCache(key, { rows: mapped, at }); setCachedAt(at); setOnline(true)
    } catch {
      // No signal (or the request failed): fall back to what this device already knows.
      const c = loadCache<Row>(key)
      if (c) { setRows(c.rows); setCachedAt(c.at) }
      setOnline(false)
    } finally { setLoading(false) }
  }, [venueId, date, supabase])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!venueId || !date) return
    const ch = supabase.channel(`door-${venueId}-${date}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'check_ins' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'guest_registrations', filter: `venue_id=eq.${venueId}` }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [venueId, date, supabase, load])

  // ---- offline queue: apply locally now, send later ----
  function applyLocal(id: string, noEntry: boolean) {
    const now = new Date().toISOString()
    setRows(rs => {
      const next = rs.map(r => r.id === id ? { ...r, status: noEntry ? 'no_entry' : 'checked_in', checked_in_at: now, method: 'manual' } : r)
      saveCache(cacheKey(venueId, date), { rows: next, at: cachedAt ?? now })
      return next
    })
  }
  function enqueue(item: QueuedCheckIn) {
    const qd = [...loadQueue(), item]; saveQueue(qd); setQueued(qd.length)
  }
  const flush = useCallback(async () => {
    if (flushing.current) return
    const items = loadQueue()
    if (items.length === 0) return
    flushing.current = true
    let remaining = items
    try {
      for (const it of items) {
        const { error } = it.kind === 'token'
          ? await supabase.rpc('check_in_by_token', { p_token: it.token, p_no_entry: it.noEntry, p_notes: 'offline sync', p_expected_date: it.date })
          : await supabase.rpc('check_in_guest', { p_registration: it.registrationId, p_no_entry: it.noEntry, p_notes: 'offline sync' })
        if (error) break // still no signal — keep the rest for next time
        remaining = remaining.filter(x => x !== it)
      }
    } finally {
      saveQueue(remaining); setQueued(remaining.length); flushing.current = false
      if (remaining.length < items.length) { flash('ok', `Synced ${items.length - remaining.length} offline check-in${items.length - remaining.length === 1 ? '' : 's'}`); load() }
    }
  }, [supabase, load])

  useEffect(() => { if (online) flush() }, [online, flush])

  const stats = useMemo(() => {
    const heads = (r: Row) => 1 + (r.plus_ones || 0)
    const registered = rows.reduce((s, r) => s + heads(r), 0)
    const checked = rows.filter(r => r.status === 'checked_in').reduce((s, r) => s + heads(r), 0)
    const noEntry = rows.filter(r => r.status === 'no_entry').reduce((s, r) => s + heads(r), 0)
    return { registered, checked, remaining: registered - checked - noEntry, noEntry }
  }, [rows])

  const groupSize = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of rows) if (r.group_id) m.set(r.group_id, (m.get(r.group_id) ?? 0) + 1)
    return m
  }, [rows])

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return rows
    return rows.filter(r =>
      `${r.first_name} ${r.last_name}`.toLowerCase().includes(t) ||
      r.mobile.toLowerCase().includes(t) ||
      (r.email ?? '').toLowerCase().includes(t) ||
      r.promoter_name.toLowerCase().includes(t) ||
      r.promoter_code.toLowerCase().includes(t))
  }, [rows, q])

  const latest = useMemo(() =>
    rows.filter(r => r.checked_in_at).sort((a, b) =>
      (b.checked_in_at || '').localeCompare(a.checked_in_at || '')).slice(0, 6), [rows])

  async function checkIn(r: Row, noEntry = false) {
    if (r.status === 'checked_in' && !noEntry) {
      flash('warn', `${r.first_name} ${r.last_name} is already checked in`); return
    }
    if (!navigator.onLine) {
      applyLocal(r.id, noEntry)
      enqueue({ kind: 'registration', registrationId: r.id, noEntry, at: new Date().toISOString() })
      flash('warn', `${noEntry ? 'No entry' : 'Checked in'} offline — will sync when signal returns`)
      return
    }
    const { data, error } = await supabase.rpc('check_in_guest', {
      p_registration: r.id, p_no_entry: noEntry, p_notes: null,
    })
    if (error) {
      // Network failure mid-request: treat like offline rather than losing the tap.
      applyLocal(r.id, noEntry)
      enqueue({ kind: 'registration', registrationId: r.id, noEntry, at: new Date().toISOString() })
      setOnline(false)
      flash('warn', 'No signal — check-in queued'); return
    }
    if (!data?.ok) {
      if (data?.error === 'already_checked_in') flash('warn', `${r.first_name} already checked in`)
      else flash('err', 'Could not check in — ' + (data?.error ?? 'error'))
      return
    }
    flash(noEntry ? 'warn' : 'ok', noEntry ? `No entry: ${r.first_name} ${r.last_name}` : `Checked in: ${r.first_name} ${r.last_name} ✓`)
    load()
  }

  const checkInByToken = useCallback(async (token: string) => {
    if (!navigator.onLine) {
      const r = rows.find(x => x.qr_token === token)
      if (!r) { setScanResult({ kind: 'err', title: 'NO SIGNAL', sub: 'Not in the cached list — search by name' }); return }
      if (r.status === 'checked_in') { setScanResult({ kind: 'err', title: 'ALREADY CHECKED IN', sub: `${r.first_name} ${r.last_name}` }); return }
      applyLocal(r.id, false)
      enqueue({ kind: 'token', token, noEntry: false, date, at: new Date().toISOString() })
      setScanResult({ kind: 'ok', title: 'CHECKED IN', sub: `${r.first_name} ${r.last_name} · offline, will sync` })
      return
    }
    const { data, error } = await supabase.rpc('check_in_by_token', {
      p_token: token, p_no_entry: false, p_notes: null, p_expected_date: date,
    })
    if (error) { setScanResult({ kind: 'err', title: 'ERROR', sub: error.message }); return }
    if (!data?.ok) {
      if (data?.error === 'already_checked_in')
        setScanResult({ kind: 'err', title: 'ALREADY CHECKED IN', sub: data.guest_name || '' })
      else if (data?.error === 'wrong_date')
        setScanResult({ kind: 'warn', title: 'WRONG DATE', sub: data.event_date ? `This QR is for ${fmtDate(data.event_date)}` : 'Not for tonight' })
      else if (data?.error === 'not_found')
        setScanResult({ kind: 'err', title: 'NOT RECOGNISED', sub: 'QR not in this system' })
      else if (data?.error === 'not_authorised')
        setScanResult({ kind: 'err', title: 'WRONG VENUE', sub: 'Guest is for another venue' })
      else setScanResult({ kind: 'err', title: 'CHECK-IN FAILED' })
      load(); return
    }
    setScanResult({ kind: 'ok', title: 'CHECKED IN', sub: data.guest_name || '' })
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, date, supabase, load])

  // A university membership QR (/verify/<token>) goes to the wristband screen —
  // one scanner at the door for both kinds of pass.
  const onScan = useCallback((text: string) => {
    const m = text.match(/\/verify\/([A-Za-z0-9_-]+)/)
    if (m) { setScanning(false); router.push(`/verify/${m[1]}`); return }
    const token = (text.split('/g/')[1] || text).split(/[?#]/)[0]
    checkInByToken(token)
  }, [checkInByToken, router])

  const venueName = venues.find(v => v.id === venueId)?.name ?? ''

  return (
    <div className="space-y-4 pb-24 sm:pb-0">
      {/* ---- header: venue / date / offline ---- */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0">
          <div className="eyebrow">Door check-in</div>
          <button onClick={() => setPickerOpen(o => !o)} className="flex items-center gap-2 text-xl sm:text-2xl font-extrabold leading-tight text-left">
            <span className="truncate">{venueName || 'Choose a venue'}</span>
            <span className="text-luna-muted font-medium text-base">· {date ? fmtDate(date) : ''}</span>
            <Icon name="chevd" size={16} className="text-luna-muted" />
          </button>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {online ? (
            <span className="pill bg-emerald-500/15 text-emerald-400" title={cachedAt ? `List cached ${fmtDateTime(cachedAt)}` : 'Live'}>
              <Icon name="check" size={12} /> {cachedAt ? 'Offline ready' : 'Live'}
            </span>
          ) : (
            <span className="pill bg-amber-500/15 text-amber-400" title="Working from the cached list">
              <Icon name="offline" size={12} /> Offline{queued > 0 ? ` · ${queued} queued` : ''}
            </span>
          )}
          {online && queued > 0 && (
            <button onClick={flush} className="pill bg-luna-gold/15 text-luna-gold">Sync {queued}</button>
          )}
        </div>
      </div>

      {pickerOpen && (
        <div className="card p-4 grid sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Venue</label>
            <select className="input" value={venueId} onChange={e => setVenueId(e.target.value)}>
              {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Date</label>
            <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <div className="stat !p-4"><div className="stat-num !text-2xl">{stats.registered}</div><div className="stat-lbl">Registered</div></div>
        <div className="stat !p-4"><div className="stat-num !text-2xl text-luna-gold">{stats.checked}</div><div className="stat-lbl">Checked in</div></div>
        <div className="stat !p-4"><div className="stat-num !text-2xl">{stats.remaining}</div><div className="stat-lbl">Waiting</div></div>
      </div>

      <div className="flex gap-3 sticky top-16 z-20 bg-luna-bg/95 backdrop-blur py-2 -my-2">
        <SearchInput big className="flex-1" value={q} onChange={setQ} placeholder="Search name, phone, email or promoter…" autoFocus />
        <button className="btn-gold !px-6 text-lg hidden sm:inline-flex" onClick={() => setScanning(true)}><Icon name="qr" size={20} /> Scan QR</button>
      </div>

      {toast && (
        <div className={`fixed left-1/2 -translate-x-1/2 top-4 z-50 px-5 py-3 rounded-xl font-semibold shadow-glow ${
          toast.kind === 'ok' ? 'bg-emerald-500 text-black' :
          toast.kind === 'warn' ? 'bg-amber-400 text-black' : 'bg-red-500 text-white'}`}>
          {toast.msg}
        </div>
      )}

      {latest.length > 0 && !q && (
        <div className="card p-4">
          <p className="eyebrow mb-2">Latest check-ins</p>
          <div className="flex flex-wrap gap-2">
            {latest.map(r => (
              <span key={r.id} className={`pill ${r.status === 'no_entry' ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                {r.first_name} {r.last_name} · {fmtDateTime(r.checked_in_at)}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        {loading && rows.length === 0 && <p className="text-luna-muted text-sm">Loading…</p>}
        {!loading && filtered.length === 0 && <p className="text-luna-muted text-sm py-6 text-center">No guests on the list for this venue &amp; date.</p>}
        {q && <p className="text-xs text-luna-muted">{filtered.length} match{filtered.length === 1 ? '' : 'es'}</p>}
        {filtered.map(r => {
          const party = (r.group_id ? (groupSize.get(r.group_id) ?? 1) - 1 : 0) + (r.plus_ones || 0)
          return (
            <div key={r.id} className={`card p-4 flex flex-col sm:flex-row sm:items-center gap-3 ${r.status === 'checked_in' ? 'border-emerald-500/40' : r.status === 'no_entry' ? 'border-red-500/40' : ''}`}>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-lg truncate flex items-center gap-2">
                  {r.first_name} {r.last_name}
                  {party > 0 && <span className="pill bg-luna-gold/20 text-luna-gold text-[11px]">party of {party + 1}</span>}
                  {r.special_occasion && <span className="pill bg-luna-gold/15 text-luna-gold text-[11px]">{r.special_occasion}</span>}
                </div>
                <div className="text-sm text-luna-muted truncate">
                  {r.mobile} · {r.promoter_name}{r.promoter_code ? ` (${r.promoter_code})` : ''}
                  {r.checked_in_at && <span className="text-emerald-400"> · in {fmtDateTime(r.checked_in_at)}{r.method ? ` (${r.method === 'scan' ? 'scanned' : 'manual'})` : ''}</span>}
                </div>
              </div>
              {r.status === 'checked_in' ? (
                <span className="pill bg-emerald-500/15 text-emerald-400 self-start sm:self-auto">Checked in ✓</span>
              ) : r.status === 'no_entry' ? (
                <span className="pill bg-red-500/15 text-red-400 self-start sm:self-auto">No entry</span>
              ) : (
                <div className="flex gap-2">
                  <button className="btn-ghost !px-4 !py-2.5 min-h-[44px] !text-red-400" onClick={() => checkIn(r, true)}>No entry</button>
                  <button className="btn-gold !px-5 !py-2.5 min-h-[44px] flex-1 sm:flex-none sm:min-w-[130px]" onClick={() => checkIn(r)}>Check in</button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* phone: scan button pinned above the tab bar */}
      <div className={`sm:hidden fixed inset-x-0 px-4 z-20 ${hasTabBar ? 'bottom-[84px]' : 'bottom-4'}`}>
        <button className="btn-gold btn-lg w-full min-h-[56px] shadow-glow" onClick={() => setScanning(true)}><Icon name="qr" size={22} /> Scan QR</button>
      </div>

      {scanning && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
            <div className="min-w-0">
              <div className="text-white font-semibold text-lg">Scan guest QR</div>
              <div className="text-luna-muted text-sm truncate">{venueName} · {fmtDate(date)}{!online ? ' · offline' : ''}</div>
            </div>
            <button onClick={() => { setScanning(false); setScanResult(null) }}
              className="btn-ghost !py-3 !px-6 text-lg">Close</button>
          </div>

          <div className="flex-1 flex items-center justify-center p-4">
            <QRScanner onScan={onScan} onError={(m) => setScanResult({ kind: 'err', title: 'CAMERA ERROR', sub: m })} />
          </div>
          <p className="text-center text-luna-muted pb-6 text-lg">Guest pass or university membership — point the camera at the code</p>

          {scanResult && (
            <div className={`fixed inset-0 z-[60] flex flex-col items-center justify-center text-center px-8 ${
              scanResult.kind === 'ok' ? 'bg-emerald-500' : scanResult.kind === 'warn' ? 'bg-amber-500' : 'bg-red-600'}`}>
              <div className="text-white" style={{ fontSize: '7rem', lineHeight: 1 }}>
                {scanResult.kind === 'ok' ? '✓' : scanResult.kind === 'warn' ? '!' : '✕'}
              </div>
              <div className="text-white font-extrabold mt-4" style={{ fontSize: '3rem', lineHeight: 1.05 }}>
                {scanResult.title}
              </div>
              {scanResult.sub && <div className="text-white/90 mt-4 text-2xl font-semibold">{scanResult.sub}</div>}
              <div className="text-white/70 mt-8 text-base">Ready for the next guest…</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function QRScanner({ onScan, onError }: { onScan: (text: string) => void; onError: (m: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const lastRef = useRef<string>('')
  // Callbacks live in refs so the camera starts once and is not torn down and
  // restarted every time the parent re-renders (each scan result, each reload).
  const onScanRef = useRef(onScan); onScanRef.current = onScan
  const onErrorRef = useRef(onError); onErrorRef.current = onError
  useEffect(() => {
    let scanner: any
    let cancelled = false
    ;(async () => {
      try {
        if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          onErrorRef.current('Camera not available in this browser. Open the site in Safari or Chrome, or use search + manual check-in.')
          return
        }
        const { Html5Qrcode } = await import('html5-qrcode')
        if (cancelled || !ref.current) return
        scanner = new Html5Qrcode(ref.current.id)
        await scanner.start({ facingMode: 'environment' }, { fps: 10, qrbox: 300 },
          (text: string) => {
            if (text && text !== lastRef.current) {
              lastRef.current = text
              onScanRef.current(text)
              setTimeout(() => { lastRef.current = '' }, 3000)
            }
          }, () => {})
      } catch (e: any) { onErrorRef.current('Camera unavailable — use search + manual check-in.') }
    })()
    return () => { cancelled = true; if (scanner) scanner.stop().catch(() => {}) }
  }, [])
  return (
    <div className="w-full max-w-md">
      <div id="qr-reader" ref={ref} className="w-full rounded-2xl overflow-hidden bg-black" />
    </div>
  )
}
