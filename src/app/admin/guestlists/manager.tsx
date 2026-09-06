'use client'
import { useEffect, useMemo, useState, useCallback, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { StatusPill, SearchInput, Th, Td, EmptyRow } from '@/components/ui'
import { Icon } from '@/components/icons'
import { setNightList, sendBoothOffer } from '../actions'

interface Venue { id: string; name: string }
interface Row {
  id: string; status: string
  first_name: string; last_name: string; mobile: string
  email: string | null; dob: string | null; instagram: string | null
  promoter_name: string; promoter_code: string; plus_ones: number
  notes: string | null; special_occasion: string | null
  source: string | null; group_id: string | null; booth_offer_sent_at: string | null
  checked_in_at: string | null
}

const EMPTY_EDIT = { first: '', last: '', mobile: '', email: '', dob: '', instagram: '', plus: '0', notes: '', occasion: '' }
const OCCASION_RE = /birthday|hens|bucks|engagement|anniversary|graduation/i

function localToday() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function GuestlistManager({ venues, initialVenue, initialDate, canToggle }:
  { venues: Venue[]; initialVenue?: string; initialDate?: string; canToggle: boolean }) {
  const supabase = useMemo(() => createClient(), [])
  const today = localToday()
  const maxDate = new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 10)

  const [venueId, setVenueId] = useState(venues.some(v => v.id === initialVenue) ? initialVenue! : (venues[0]?.id ?? ''))
  const [date, setDate] = useState(initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate) ? initialDate : today)
  const [rows, setRows] = useState<Row[]>([])
  const [listOpen, setListOpen] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState('')
  const [show, setShow] = useState<'all' | 'in' | 'waiting'>('all')
  const [f, setF] = useState({ first: '', last: '', mobile: '', email: '', dob: '', instagram: '', plus: '0', notes: '', occasion: '' })
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [pending, start] = useTransition()
  const [offerMsg, setOfferMsg] = useState<Record<string, string>>({})
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }))

  // inline edit state
  const [editing, setEditing] = useState<string | null>(null)
  const [ef, setEf] = useState(EMPTY_EDIT)
  const [editErr, setEditErr] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const setE = (k: string, v: string) => setEf(p => ({ ...p, [k]: v }))

  const load = useCallback(async () => {
    if (!venueId || !date) { setRows([]); return }
    setLoading(true)
    const [{ data }, { data: ev }] = await Promise.all([
      supabase.from('guest_registrations')
        .select('id,status,plus_ones,notes,special_occasion,source,group_id,booth_offer_sent_at,guests(first_name,last_name,mobile,email,date_of_birth,instagram),promoters(full_name,promoter_code),check_ins(checked_in_at),events!inner(event_date)')
        .eq('venue_id', venueId).eq('events.event_date', date)
        .order('created_at', { ascending: false }),
      supabase.from('events').select('guestlist_open').eq('venue_id', venueId).eq('event_date', date).order('created_at').limit(1).maybeSingle(),
    ])
    setRows((data ?? []).map((r: any) => ({
      id: r.id, status: r.status,
      first_name: r.guests?.first_name ?? '', last_name: r.guests?.last_name ?? '',
      mobile: r.guests?.mobile ?? '', email: r.guests?.email ?? null,
      dob: r.guests?.date_of_birth ?? null, instagram: r.guests?.instagram ?? null,
      promoter_name: r.promoters?.full_name ?? '', promoter_code: r.promoters?.promoter_code ?? '',
      plus_ones: r.plus_ones ?? 0, notes: r.notes ?? null, special_occasion: r.special_occasion ?? null,
      source: r.source ?? null, group_id: r.group_id ?? null, booth_offer_sent_at: r.booth_offer_sent_at ?? null,
      checked_in_at: r.check_ins?.[0]?.checked_in_at ?? r.check_ins?.checked_in_at ?? null,
    })))
    setListOpen(ev ? !!ev.guestlist_open : null)
    setLoading(false)
  }, [venueId, date, supabase])

  useEffect(() => { load() }, [load])

  // keep the URL shareable: /admin/guestlists?venue=…&date=…
  useEffect(() => {
    if (!venueId || !date) return
    const u = new URL(window.location.href)
    u.searchParams.set('venue', venueId); u.searchParams.set('date', date)
    window.history.replaceState(null, '', u.toString())
  }, [venueId, date])

  async function addGuest(e: React.FormEvent) {
    e.preventDefault(); setMsg(null)
    if (!venueId || !date) { setMsg({ ok: false, text: 'Pick a venue and date first.' }); return }
    setSaving(true)
    const { data, error } = await supabase.rpc('add_guest_manual_vd', {
      p_venue: venueId, p_date: date, p_first: f.first.trim(), p_last: f.last.trim(),
      p_mobile: f.mobile.trim(), p_email: f.email.trim(), p_dob: f.dob || null,
      p_instagram: f.instagram.trim(), p_plus_ones: Math.max(0, parseInt(f.plus || '0', 10) || 0),
      p_notes: f.notes.trim() || null, p_occasion: f.occasion.trim() || null,
    })
    setSaving(false)
    if (error) { setMsg({ ok: false, text: error.message }); return }
    if (!data?.ok) {
      setMsg({ ok: false, text: data?.error === 'duplicate' ? 'That guest is already on this list.' : 'Could not add guest.' })
      return
    }
    setMsg({ ok: true, text: `${f.first} ${f.last} added.` })
    setF({ first: '', last: '', mobile: '', email: '', dob: '', instagram: '', plus: '0', notes: '', occasion: '' })
    load()
  }

  function startEdit(r: Row) {
    setEditErr(''); setEditing(r.id)
    setEf({
      first: r.first_name, last: r.last_name, mobile: r.mobile, email: r.email ?? '',
      dob: r.dob ?? '', instagram: r.instagram ?? '', plus: String(r.plus_ones ?? 0),
      notes: r.notes ?? '', occasion: r.special_occasion ?? '',
    })
  }

  async function saveEdit(id: string) {
    setEditErr('')
    if (!ef.first.trim() || !ef.mobile.trim()) { setEditErr('First name and mobile are required.'); return }
    setEditSaving(true)
    const { data, error } = await supabase.rpc('update_guest_registration', {
      p_registration: id, p_first: ef.first.trim(), p_last: ef.last.trim(), p_mobile: ef.mobile.trim(),
      p_email: ef.email.trim(), p_dob: ef.dob || null, p_instagram: ef.instagram.trim(),
      p_plus_ones: Math.max(0, parseInt(ef.plus || '0', 10) || 0),
      p_notes: ef.notes.trim() || null, p_occasion: ef.occasion.trim() || null,
    })
    setEditSaving(false)
    if (error || !data?.ok) {
      setEditErr(data?.error === 'not_authorised' ? 'You don’t manage this venue.' : (data?.error || error?.message || 'Could not save.'))
      return
    }
    setEditing(null); load()
  }

  function toggleList() {
    if (!venueId || !date) return
    const next = !(listOpen ?? true)
    start(async () => { await setNightList(venueId, date, next); setListOpen(next) })
  }

  function offer(r: Row) {
    start(async () => {
      const res = await sendBoothOffer(r.id)
      setOfferMsg(m => ({ ...m, [r.id]: res.ok ? 'Sent' : res.reason === 'no_email' ? 'No email' : 'Failed' }))
      if (res.ok) load()
    })
  }

  const groupSize = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of rows) if (r.group_id) m.set(r.group_id, (m.get(r.group_id) ?? 0) + 1)
    return m
  }, [rows])

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    return rows.filter(r => {
      if (show === 'in' && r.status !== 'checked_in') return false
      if (show === 'waiting' && r.status !== 'registered') return false
      if (!t) return true
      return `${r.first_name} ${r.last_name}`.toLowerCase().includes(t)
        || r.mobile.includes(t) || r.promoter_name.toLowerCase().includes(t)
        || (r.source ?? '').toLowerCase().includes(t) || (r.special_occasion ?? '').toLowerCase().includes(t)
    })
  }, [rows, q, show])

  const heads = rows.reduce((s, r) => s + 1 + (r.plus_ones || 0), 0)
  const checked = rows.filter(r => r.status === 'checked_in').reduce((s, r) => s + 1 + (r.plus_ones || 0), 0)
  const waiting = rows.filter(r => r.status === 'registered').length
  const rate = heads ? Math.round((checked / heads) * 100) : 0

  return (
    <div className="space-y-4">
      {/* ---- night picker + status ---- */}
      <div className="card p-4 grid gap-4 md:grid-cols-[220px_200px_minmax(0,1fr)_auto] items-end">
        <div><label className="label">Venue</label>
          <select className="input !py-2.5" value={venueId} onChange={e => setVenueId(e.target.value)}>
            {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select></div>
        <div><label className="label">Date</label>
          <input type="date" className="input !py-2.5" min="2020-01-01" max={maxDate} value={date} onChange={e => setDate(e.target.value)} /></div>
        <div className="min-w-0">
          <div className="flex items-center text-xs text-luna-muted mb-1.5">
            <span>{heads} on list · <span className="text-luna-gold">{checked}</span> checked in · {waiting} waiting</span>
            <span className="ml-auto">{rate}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/[0.07] overflow-hidden"><div className="h-full rounded-full bg-luna-gold" style={{ width: `${rate}%` }} /></div>
        </div>
        <div className="flex items-center gap-3 pb-0.5">
          <span className="flex items-center gap-2 text-sm whitespace-nowrap">
            <span className={`w-2 h-2 rounded-full ${listOpen === false ? 'bg-luna-muted' : 'bg-emerald-400 shadow-[0_0_0_3px_rgba(52,211,153,0.18)]'}`} />
            {listOpen === false ? 'List closed' : listOpen === null ? 'No list yet' : 'List open'}
          </span>
          {canToggle && (
            <button onClick={toggleList} disabled={pending} className={`btn-ghost !py-1.5 !px-3 text-xs whitespace-nowrap ${listOpen === false || listOpen === null ? '!text-luna-gold !border-luna-gold/40' : ''}`}>
              {listOpen === false || listOpen === null ? 'Open list' : 'Close list'}
            </button>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-[340px_minmax(0,1fr)] gap-4 items-start">
        {/* ---- add a guest ---- */}
        <form onSubmit={addGuest} className="card p-5 space-y-3">
          <h2 className="font-bold">Add a guest</h2>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">First name *</label><input required className="input !py-2.5" value={f.first} onChange={e => set('first', e.target.value)} /></div>
            <div><label className="label">Last name *</label><input required className="input !py-2.5" value={f.last} onChange={e => set('last', e.target.value)} /></div>
          </div>
          <div><label className="label">Mobile *</label><input required type="tel" className="input !py-2.5" placeholder="04xx xxx xxx" value={f.mobile} onChange={e => set('mobile', e.target.value)} /></div>
          <div><label className="label">Email</label><input type="email" className="input !py-2.5" value={f.email} onChange={e => set('email', e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Instagram</label><input className="input !py-2.5" placeholder="@handle" value={f.instagram} onChange={e => set('instagram', e.target.value)} /></div>
            <div><label className="label">DOB</label><input type="date" max={today} className="input !py-2.5" value={f.dob} onChange={e => set('dob', e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Occasion</label><input className="input !py-2.5" placeholder="e.g. Birthday" value={f.occasion} onChange={e => set('occasion', e.target.value)} /></div>
            <div><label className="label">Plus ones</label><input type="number" min={0} max={50} className="input !py-2.5" value={f.plus} onChange={e => set('plus', e.target.value)} /></div>
          </div>
          <div><label className="label">Notes <span className="font-normal">(VIP, allergy, request)</span></label><textarea className="input !py-2.5" rows={2} value={f.notes} onChange={e => set('notes', e.target.value)} /></div>
          {msg && <p className={`text-sm ${msg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{msg.text}</p>}
          <button className="btn-gold w-full" disabled={saving || !venueId || !date}>{saving ? 'Adding…' : 'Add to guestlist'}</button>
          <p className="text-[11px] text-luna-muted text-center">Credited to you. Guests with an email get their QR automatically.</p>
        </form>

        {/* ---- the list ---- */}
        <div className="card">
          <div className="flex flex-wrap items-center gap-2 px-4 pt-4 pb-3">
            <SearchInput className="flex-1 min-w-[200px]" value={q} onChange={setQ} placeholder="Search this guestlist…" />
            {([['all', `All ${rows.length}`], ['in', `Checked in ${rows.filter(r => r.status === 'checked_in').length}`], ['waiting', `Waiting ${waiting}`]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setShow(k)}
                className={`pill !py-2 !px-3 ${show === k ? 'bg-luna-gold/15 text-luna-gold' : 'bg-white/[0.07] text-luna-text/90'}`}>{l}</button>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="border-b border-white/[0.07]">
                  <Th>Guest · mobile · group</Th><Th>Occasion</Th><Th>Promoter / source</Th><Th>Status</Th><Th />
                </tr>
              </thead>
              <tbody>
                {loading && <EmptyRow colSpan={5}>Loading…</EmptyRow>}
                {!loading && filtered.length === 0 && <EmptyRow colSpan={5}>No guests for this venue &amp; date yet.</EmptyRow>}
                {filtered.map(r => {
                  const size = r.group_id ? groupSize.get(r.group_id) ?? 1 : 1
                  const party = size - 1 + (r.plus_ones || 0)
                  const occasion = !!r.special_occasion && OCCASION_RE.test(r.special_occasion)
                  return (
                    <tr key={r.id} className="border-b border-white/[0.045] last:border-0 hover:bg-white/[0.02] align-top">
                      {editing === r.id ? (
                        <td colSpan={5} className="p-3">
                          <div className="space-y-3 max-w-xl">
                            <div className="grid grid-cols-2 gap-2">
                              <div><label className="label">First name *</label><input className="input !py-2" value={ef.first} onChange={e => setE('first', e.target.value)} /></div>
                              <div><label className="label">Last name</label><input className="input !py-2" value={ef.last} onChange={e => setE('last', e.target.value)} /></div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div><label className="label">Mobile *</label><input className="input !py-2" type="tel" value={ef.mobile} onChange={e => setE('mobile', e.target.value)} /></div>
                              <div><label className="label">Email</label><input className="input !py-2" type="email" value={ef.email} onChange={e => setE('email', e.target.value)} /></div>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <div><label className="label">DOB</label><input className="input !py-2" type="date" max={today} value={ef.dob} onChange={e => setE('dob', e.target.value)} /></div>
                              <div><label className="label">Instagram</label><input className="input !py-2" value={ef.instagram} onChange={e => setE('instagram', e.target.value)} /></div>
                              <div><label className="label">Plus ones</label><input className="input !py-2" type="number" min={0} max={50} value={ef.plus} onChange={e => setE('plus', e.target.value)} /></div>
                            </div>
                            <div><label className="label">Occasion</label><input className="input !py-2" placeholder="e.g. Birthday" value={ef.occasion} onChange={e => setE('occasion', e.target.value)} /></div>
                            <div><label className="label">Notes</label><textarea className="input !py-2" rows={2} value={ef.notes} onChange={e => setE('notes', e.target.value)} /></div>
                            {editErr && <p className="text-sm text-red-400">{editErr}</p>}
                            <div className="flex gap-2">
                              <button className="btn-ghost flex-1 !py-2" onClick={() => setEditing(null)} disabled={editSaving}>Cancel</button>
                              <button className="btn-gold flex-1 !py-2" onClick={() => saveEdit(r.id)} disabled={editSaving}>{editSaving ? 'Saving…' : 'Save changes'}</button>
                            </div>
                          </div>
                        </td>
                      ) : (
                        <>
                          <Td>
                            <div className="font-semibold">{r.first_name} {r.last_name}</div>
                            <div className="text-xs text-luna-muted">
                              {r.mobile}{r.email ? ` · ${r.email}` : ''}
                              {party > 0 && <span className="text-luna-gold"> · +{party} {party === 1 ? 'friend' : 'friends'}</span>}
                            </div>
                            {r.notes && <div className="text-xs text-luna-gold mt-0.5">{r.notes}</div>}
                          </Td>
                          <Td>{r.special_occasion ? <span className="pill bg-luna-gold/15 text-luna-gold">{r.special_occasion}</span> : <span className="text-luna-muted">—</span>}</Td>
                          <Td className="text-luna-muted">
                            {r.promoter_name}{r.source ? <span className="block text-xs">src {r.source}</span> : null}
                          </Td>
                          <Td><StatusPill status={r.status} /></Td>
                          <Td className="text-right whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5">
                              {occasion && (
                                r.booth_offer_sent_at
                                  ? <span className="text-xs text-luna-muted" title="Booth offer sent">Offer sent</span>
                                  : <button className="btn-gold !py-1.5 !px-3 text-xs" disabled={pending || !r.email} title={r.email ? 'Email the VIP booth offer' : 'No email on file'} onClick={() => offer(r)}>{offerMsg[r.id] ?? 'Booth offer'}</button>
                              )}
                              <button className="btn-ghost !py-1.5 !px-3 text-xs" onClick={() => startEdit(r)}><Icon name="pen" size={14} /> Edit</button>
                            </span>
                          </Td>
                        </>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
