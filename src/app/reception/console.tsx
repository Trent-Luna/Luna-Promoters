'use client'
import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fmtDate, fmtDateTime, fmtTime } from '@/lib/format'

interface Venue { id: string; name: string }
interface Ev { id: string; name: string; event_date: string; start_time: string | null }
interface Row {
  id: string; status: string; qr_token: string
  first_name: string; last_name: string; mobile: string; email: string | null
  promoter_name: string; promoter_code: string
  checked_in_at: string | null; notes: string | null
}

export function ReceptionConsole({ venues }: { venues: Venue[] }) {
  const supabase = useMemo(() => createClient(), [])
  const [venueId, setVenueId] = useState(venues[0]?.id ?? '')
  const [events, setEvents] = useState<Ev[]>([])
  const [eventId, setEventId] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [q, setQ] = useState('')
  const [toast, setToast] = useState<{ kind: 'ok' | 'warn' | 'err'; msg: string } | null>(null)
  const [scanning, setScanning] = useState(false)
  const [loading, setLoading] = useState(false)

  const flash = (kind: 'ok' | 'warn' | 'err', msg: string) => {
    setToast({ kind, msg }); setTimeout(() => setToast(null), 3500)
  }

  // load events for venue
  useEffect(() => {
    if (!venueId) return
    const today = new Date().toISOString().slice(0, 10)
    supabase.from('events').select('id,name,event_date,start_time')
      .eq('venue_id', venueId).eq('active', true)
      .gte('event_date', new Date(Date.now() - 864e5).toISOString().slice(0, 10))
      .order('event_date').then(({ data }) => {
        setEvents(data ?? [])
        setEventId(prev => (data ?? []).some(e => e.id === prev) ? prev : (data?.[0]?.id ?? ''))
      })
  }, [venueId, supabase])

  const load = useCallback(async () => {
    if (!eventId) { setRows([]); return }
    setLoading(true)
    const { data } = await supabase
      .from('guest_registrations')
      .select('id,status,qr_token,guests(first_name,last_name,mobile,email),promoters(full_name,promoter_code),check_ins(checked_in_at,notes)')
      .eq('event_id', eventId).order('created_at', { ascending: false })
    const mapped: Row[] = (data ?? []).map((r: any) => ({
      id: r.id, status: r.status, qr_token: r.qr_token,
      first_name: r.guests?.first_name ?? '', last_name: r.guests?.last_name ?? '',
      mobile: r.guests?.mobile ?? '', email: r.guests?.email ?? null,
      promoter_name: r.promoters?.full_name ?? '', promoter_code: r.promoters?.promoter_code ?? '',
      checked_in_at: r.check_ins?.[0]?.checked_in_at ?? r.check_ins?.checked_in_at ?? null,
      notes: r.check_ins?.[0]?.notes ?? null,
    }))
    setRows(mapped); setLoading(false)
  }, [eventId, supabase])

  useEffect(() => { load() }, [load])

  // realtime: refresh on any check-in / registration change for this event
  useEffect(() => {
    if (!eventId) return
    const ch = supabase.channel(`door-${eventId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'check_ins' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'guest_registrations', filter: `event_id=eq.${eventId}` }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [eventId, supabase, load])

  const stats = useMemo(() => {
    const registered = rows.length
    const checked = rows.filter(r => r.status === 'checked_in').length
    const noEntry = rows.filter(r => r.status === 'no_entry').length
    return { registered, checked, remaining: registered - checked - noEntry, noEntry }
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
    const { data, error } = await supabase.rpc('check_in_guest', {
      p_registration: r.id, p_no_entry: noEntry, p_notes: null,
    })
    if (error) { flash('err', error.message); return }
    if (!data?.ok) {
      if (data?.error === 'already_checked_in') flash('warn', `${r.first_name} already checked in`)
      else flash('err', 'Could not check in — ' + (data?.error ?? 'error'))
      return
    }
    flash(noEntry ? 'warn' : 'ok', noEntry ? `No entry: ${r.first_name} ${r.last_name}` : `Checked in: ${r.first_name} ${r.last_name} ✓`)
    load()
  }

  async function checkInByToken(token: string) {
    const { data, error } = await supabase.rpc('check_in_by_token', { p_token: token, p_no_entry: false, p_notes: null })
    if (error) { flash('err', error.message); return }
    if (!data?.ok) {
      if (data?.error === 'already_checked_in') flash('warn', 'Already checked in')
      else if (data?.error === 'not_found') flash('err', 'QR not recognised for this system')
      else flash('err', 'Check-in failed')
      return
    }
    flash('ok', 'Checked in ✓'); load()
  }

  return (
    <div className="space-y-5">
      {/* selectors */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Venue</label>
          <select className="input" value={venueId} onChange={e => setVenueId(e.target.value)}>
            {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Event / date</label>
          <select className="input" value={eventId} onChange={e => setEventId(e.target.value)}>
            {events.length === 0 && <option value="">No events</option>}
            {events.map(e => <option key={e.id} value={e.id}>{e.name} — {fmtDate(e.event_date)}{e.start_time ? ` · ${fmtTime(e.start_time)}` : ''}</option>)}
          </select>
        </div>
      </div>

      {/* stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="stat"><div className="stat-num">{stats.registered}</div><div className="stat-lbl">Registered</div></div>
        <div className="stat"><div className="stat-num text-emerald-400">{stats.checked}</div><div className="stat-lbl">Checked in</div></div>
        <div className="stat"><div className="stat-num text-luna-gold">{stats.remaining}</div><div className="stat-lbl">Remaining</div></div>
      </div>

      {/* search + scan */}
      <div className="flex gap-3">
        <input className="input flex-1 text-lg" placeholder="Search name, phone, email or promoter…"
          value={q} onChange={e => setQ(e.target.value)} autoFocus />
        <button className="btn-gold px-5" onClick={() => setScanning(s => !s)}>
          {scanning ? 'Close scan' : 'Scan QR'}
        </button>
      </div>

      {scanning && <QRScanner onScan={checkInByToken} onError={m => flash('err', m)} />}

      {toast && (
        <div className={`fixed left-1/2 -translate-x-1/2 top-4 z-50 px-5 py-3 rounded-xl font-semibold shadow-glow ${
          toast.kind === 'ok' ? 'bg-emerald-500 text-black' :
          toast.kind === 'warn' ? 'bg-amber-400 text-black' : 'bg-red-500 text-white'}`}>
          {toast.msg}
        </div>
      )}

      {/* latest check-ins */}
      {latest.length > 0 && (
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-luna-muted mb-2">Latest check-ins</p>
          <div className="flex flex-wrap gap-2">
            {latest.map(r => (
              <span key={r.id} className="pill bg-emerald-500/10 text-emerald-400">
                {r.first_name} {r.last_name} · {fmtDateTime(r.checked_in_at)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* guest list */}
      <div className="space-y-2">
        {loading && <p className="text-luna-muted text-sm">Loading…</p>}
        {!loading && filtered.length === 0 && <p className="text-luna-muted text-sm py-6 text-center">No guests match.</p>}
        {filtered.map(r => (
          <div key={r.id} className={`card p-4 flex items-center gap-3 ${r.status === 'checked_in' ? 'border-emerald-500/40' : r.status === 'no_entry' ? 'border-red-500/40' : ''}`}>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-lg truncate">{r.first_name} {r.last_name}</div>
              <div className="text-sm text-luna-muted truncate">
                {r.mobile} · {r.promoter_name} ({r.promoter_code})
                {r.checked_in_at && <span className="text-emerald-400"> · in {fmtDateTime(r.checked_in_at)}</span>}
              </div>
            </div>
            {r.status === 'checked_in' ? (
              <span className="pill bg-emerald-500/15 text-emerald-400">Checked in ✓</span>
            ) : r.status === 'no_entry' ? (
              <span className="pill bg-red-500/15 text-red-400">No entry</span>
            ) : (
              <div className="flex gap-2">
                <button className="btn-danger !px-3 !py-2 text-sm" onClick={() => checkIn(r, true)}>No entry</button>
                <button className="btn-gold !px-4 !py-2" onClick={() => checkIn(r)}>Check in</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function QRScanner({ onScan, onError }: { onScan: (token: string) => void; onError: (m: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const lastRef = useRef<string>('')
  useEffect(() => {
    let scanner: any
    let cancelled = false
    ;(async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode')
        if (cancelled || !ref.current) return
        scanner = new Html5Qrcode(ref.current.id)
        await scanner.start({ facingMode: 'environment' }, { fps: 10, qrbox: 250 },
          (text: string) => {
            const token = (text.split('/g/')[1] || text).split(/[?#]/)[0]
            if (token && token !== lastRef.current) {
              lastRef.current = token
              onScan(token)
              setTimeout(() => { lastRef.current = '' }, 2500)
            }
          }, () => {})
      } catch (e: any) { onError('Camera unavailable — use search + manual check-in.') }
    })()
    return () => { cancelled = true; if (scanner) scanner.stop().catch(() => {}) }
  }, [onScan, onError])
  return (
    <div className="card p-3">
      <div id="qr-reader" ref={ref} className="mx-auto max-w-xs rounded-xl overflow-hidden" />
      <p className="text-center text-xs text-luna-muted mt-2">Point the iPad camera at the guest's QR code.</p>
    </div>
  )
}
