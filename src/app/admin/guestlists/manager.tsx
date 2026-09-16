'use client'
import { useEffect, useMemo, useState, useCallback, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { StatusPill, SearchInput, Th, Td, EmptyRow } from '@/components/ui'
import { Icon } from '@/components/icons'
import { setNightList, sendBoothOffer } from '../actions'
import { tradesOn, nextTradingNight, prettyNight, tradingDaysLabel } from '@/lib/trading'

interface Venue { id: string; name: string; trading_days?: number[] | null }
interface Row {
  id: string; status: string
  first_name: string; last_name: string; mobile: string
  email: string | null; dob: string | null; instagram: string | null
  promoter_name: string; promoter_code: string; plus_ones: number
  notes: string | null; special_occasion: string | null
  source: string | null; group_id: string | null; booth_offer_sent_at: string | null
  checked_in_at: string | null
}

const EMPTY_EDIT = { first: '', last: '', mobile: '', email: '', dob: '', instagram: '', plus: '0', notes: '', occasion: '', date: '' }
const OCCASION_RE = /birthday|hens|bucks|engagement|anniversary|graduation/i

/** "20 seconds ago", "4 minutes ago", "yesterday" — enough to answer "when did I do that?". */
function sinceLabel(iso: string): string {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 60) return `${s} second${s === 1 ? '' : 's'} ago`
  const m = Math.round(s / 60); if (m < 60) return `${m} minute${m === 1 ? '' : 's'} ago`
  const h = Math.round(m / 60); if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`
  const d = Math.round(h / 24); return d === 1 ? 'yesterday' : `${d} days ago`
}

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
  /*
   * WHAT THE PHONE SHOWED TRENT ON 16 SEP. He added a guest for a closed night
   * with the override ticked; it worked. The form emptied itself and a small
   * green line appeared above a button he had just pressed, under a keyboard.
   * He did not see it, pressed again, and was told the guest was "already on
   * this list" -- true, and to him a lie. Two things fix that: a success you
   * cannot miss (the new row lit up and scrolled into view, the button itself
   * saying so), and a refusal that names the entry it found.
   */
  const [justAdded, setJustAdded] = useState<string | null>(null)
  const [dupe, setDupe] = useState<{ registration_id: string; name: string; added_at: string; promoter: string | null; same_mobile: boolean } | null>(null)
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

  // ── the nights this venue actually opens ─────────────────────────────────
  //
  // Blackouts are deliberately NOT passed here. They live behind RLS and the
  // server refuses a blacked-out night anyway, returning the next open one —
  // so the worst case is a manager is told at save rather than at type, which
  // is correct but slower. Trading days are the common case and they are free.
  const [addOverride, setAddOverride] = useState(false)
  const [editOverride, setEditOverride] = useState(false)
  const venue = useMemo(() => venues.find(v => v.id === venueId) ?? null, [venues, venueId])
  const tradingDays = venue?.trading_days ?? null
  const nightClosed = !!date && !tradesOn(date, tradingDays, [], venueId)
  const nextOpen = nightClosed ? nextTradingNight(date, tradingDays, [], venueId) : null
  const editNightClosed = !!ef.date && !tradesOn(ef.date, tradingDays, [], venueId)

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
    e.preventDefault(); setMsg(null); setDupe(null)
    if (!venueId || !date) { setMsg({ ok: false, text: 'Pick a venue and date first.' }); return }
    setSaving(true)
    const { data, error } = await supabase.rpc('add_guest_manual_vd', {
      p_venue: venueId, p_date: date, p_first: f.first.trim(), p_last: f.last.trim(),
      p_mobile: f.mobile.trim(), p_email: f.email.trim(), p_dob: f.dob || null,
      p_instagram: f.instagram.trim(), p_plus_ones: Math.max(0, parseInt(f.plus || '0', 10) || 0),
      p_notes: f.notes.trim() || null, p_occasion: f.occasion.trim() || null,
      p_override: addOverride,
    })
    setSaving(false)
    if (error) { setMsg({ ok: false, text: error.message }); return }
    if (!data?.ok) {
      if (data?.error === 'duplicate' && data.existing) {
        // Name it. "Already on this list" with no name reads as the app being
        // wrong; "Jv Jv, added 20 seconds ago by you" reads as the app being right.
        setDupe(data.existing)
        setMsg({ ok: false, text: '' })
        return
      }
      const m: Record<string, string> = {
        duplicate: 'That guest is already on this list.',
        not_trading: `${venue?.name ?? 'This venue'} isn’t open on ${prettyNight(date)}. Tick “open anyway” if you are trading.`,
        not_authorised: 'You don’t manage this venue.',
      }
      setMsg({ ok: false, text: m[data?.error] || 'Could not add guest.' })
      return
    }
    setMsg({ ok: true, text: `${f.first} ${f.last} is on the list${nightClosed ? ` for ${prettyNight(date)} (closed night, opened by you)` : ''}.` })
    setJustAdded(data.registration_id ?? null)
    setF({ first: '', last: '', mobile: '', email: '', dob: '', instagram: '', plus: '0', notes: '', occasion: '' })
    await load()
    // Show them the row. On a phone the list is below the form, so without
    // this the proof of success is off the bottom of the screen.
    requestAnimationFrame(() => document.getElementById(`reg-${data.registration_id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
    setTimeout(() => setJustAdded(null), 6000)
  }

  function startEdit(r: Row) {
    setEditErr(''); setEditing(r.id)
    setEf({
      first: r.first_name, last: r.last_name, mobile: r.mobile, email: r.email ?? '',
      dob: r.dob ?? '', instagram: r.instagram ?? '', plus: String(r.plus_ones ?? 0),
      notes: r.notes ?? '', occasion: r.special_occasion ?? '',
      // Every row on screen belongs to the night being viewed, so the current
      // date IS this registration's date — no per-row lookup needed.
      date,
    })
    setEditOverride(false)
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
      p_event_date: ef.date || null, p_override: editOverride,
    })
    setEditSaving(false)
    if (error || !data?.ok) {
      if (data?.error === 'not_trading') {
        setEditErr(`${venue?.name ?? 'This venue'} isn’t open on ${prettyNight(ef.date)}`
          + (data.suggested ? ` — the next open night is ${prettyNight(data.suggested)}.` : '.')
          + ' Tick “open anyway” if you are trading that night.')
        return
      }
      const m: Record<string, string> = {
        not_authorised: 'You don’t manage this venue.',
        already_on_that_night: 'That guest is already on the list for that night.',
        bad_date: 'Pick a date within the next year.',
      }
      setEditErr(m[data?.error] || data?.error || error?.message || 'Could not save.')
      return
    }
    // A moved guest is no longer on the night being viewed, so the reload is
    // what makes the move visible: they vanish from this list, which is right.
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
          <input type="date" className="input !py-2.5" min="2020-01-01" max={maxDate} value={date} onChange={e => setDate(e.target.value)} />
          {nightClosed && (
            <p className="text-[11px] text-amber-400 mt-1 leading-snug">
              Closed — open {tradingDaysLabel(tradingDays)}.
              {nextOpen && <> <button type="button" className="underline font-semibold" onClick={() => setDate(nextOpen)}>Go to {prettyNight(nextOpen)}</button></>}
            </p>
          )}</div>
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

      <div className="grid grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)] gap-4 items-start">
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
          {/* The override exists because venues DO open on odd nights — Melbourne
              Cup, New Year's Eve, a private hire. It is a deliberate tick, not a
              default, and the database logs the add as overridden. */}
          {nightClosed && (
            <label className="flex items-start gap-2 text-[12px] cursor-pointer text-amber-400">
              <input type="checkbox" className="mt-0.5 accent-luna-gold w-4 h-4" checked={addOverride}
                onChange={e => setAddOverride(e.target.checked)} />
              <span>{venue?.name ?? 'This venue'} is closed on {prettyNight(date)} — open anyway</span>
            </label>
          )}
          {msg && msg.text && (
            <p className={`rounded-xl px-3 py-2 text-sm font-medium ${msg.ok ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'}`} role="status">
              {msg.ok ? '✓ ' : ''}{msg.text}
            </p>
          )}
          {dupe && (
            <div className="rounded-xl bg-amber-500/15 px-3 py-2.5 text-sm text-amber-200 space-y-1.5" role="alert">
              <p>
                <span className="font-semibold">{dupe.name || 'That guest'}</span> is already on {venue?.name ?? 'this venue'}&rsquo;s list for {prettyNight(date)}
                {dupe.added_at ? ` — added ${sinceLabel(dupe.added_at)}` : ''}{dupe.promoter ? ` by ${dupe.promoter}` : ''}.
                {!dupe.same_mobile && ' Matched on email rather than mobile.'}
              </p>
              <button type="button" className="underline font-semibold"
                onClick={() => {
                  const r = rows.find(x => x.id === dupe.registration_id)
                  if (r) { startEdit(r); setJustAdded(r.id); requestAnimationFrame(() => document.getElementById(`reg-${r.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })) }
                  setDupe(null)
                }}>
                Show that entry
              </button>
            </div>
          )}
          <button className="btn-gold w-full" disabled={saving || !venueId || !date || (nightClosed && !addOverride)}>
            {saving ? 'Adding…' : msg?.ok && justAdded ? '✓ Added' : 'Add to guestlist'}
          </button>
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
          {/* ON A PHONE THE LIST IS A STACK, NOT A TABLE. Trent, 16 Sep 2026:
              "things like putting people on the guest list doesnt line up well
              on the phone." The table was 720px wide inside a 390px screen: the
              Edit button was off the right edge and every row scrolled
              sideways. Below md each cell becomes a block and the header row is
              hidden; the table is unchanged on a laptop. */}
          <div className="md:overflow-x-auto">
            <table className="w-full text-sm md:min-w-[720px] block md:table">
              <thead className="hidden md:table-header-group">
                <tr className="border-b border-white/[0.07]">
                  <Th>Guest · mobile · group</Th><Th>Occasion</Th><Th>Promoter / source</Th><Th>Status</Th><Th />
                </tr>
              </thead>
              <tbody className="block md:table-row-group">
                {loading && <EmptyRow colSpan={5}>Loading…</EmptyRow>}
                {!loading && filtered.length === 0 && <EmptyRow colSpan={5}>No guests for this venue &amp; date yet.</EmptyRow>}
                {filtered.map(r => {
                  const size = r.group_id ? groupSize.get(r.group_id) ?? 1 : 1
                  const party = size - 1 + (r.plus_ones || 0)
                  const occasion = !!r.special_occasion && OCCASION_RE.test(r.special_occasion)
                  return (
                    <tr key={r.id} id={`reg-${r.id}`}
                      className={`block md:table-row border-b border-white/[0.045] last:border-0 hover:bg-white/[0.02] align-top transition-colors ${justAdded === r.id ? 'bg-luna-gold/[0.12] md:bg-luna-gold/[0.12]' : ''}`}>
                      {editing === r.id ? (
                        <td colSpan={5} className="block md:table-cell p-3">
                          <div className="space-y-3 max-w-xl">
                            <div className="grid grid-cols-2 gap-2">
                              <div><label className="label">First name *</label><input className="input !py-2" value={ef.first} onChange={e => setE('first', e.target.value)} /></div>
                              <div><label className="label">Last name</label><input className="input !py-2" value={ef.last} onChange={e => setE('last', e.target.value)} /></div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div><label className="label">Mobile *</label><input className="input !py-2" type="tel" value={ef.mobile} onChange={e => setE('mobile', e.target.value)} /></div>
                              <div><label className="label">Email</label><input className="input !py-2" type="email" value={ef.email} onChange={e => setE('email', e.target.value)} /></div>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              <div><label className="label">DOB</label><input className="input !py-2" type="date" max={today} value={ef.dob} onChange={e => setE('dob', e.target.value)} /></div>
                              <div><label className="label">Instagram</label><input className="input !py-2" value={ef.instagram} onChange={e => setE('instagram', e.target.value)} /></div>
                              <div><label className="label">Plus ones</label><input className="input !py-2" type="number" min={0} max={50} value={ef.plus} onChange={e => setE('plus', e.target.value)} /></div>
                            </div>
                            {/* Moving the night. This is the field that did not exist,
                                which is why 55 birthdays sat on closed nights with no
                                way to shift them from the screen that showed them. */}
                            <div>
                              <label className="label">Date <span className="font-normal text-luna-muted">— change it to move this guest to another night</span></label>
                              <input className="input !py-2" type="date" min={today} max={maxDate}
                                value={ef.date} onChange={e => setE('date', e.target.value)} />
                              {editNightClosed && (
                                <label className="flex items-start gap-2 text-[12px] cursor-pointer text-amber-400 mt-1.5">
                                  <input type="checkbox" className="mt-0.5 accent-luna-gold w-4 h-4" checked={editOverride}
                                    onChange={e => setEditOverride(e.target.checked)} />
                                  <span>Closed on {prettyNight(ef.date)} — open anyway</span>
                                </label>
                              )}
                              {editNightClosed && !editOverride && nextTradingNight(ef.date, tradingDays, [], venueId) && (
                                <button type="button" className="text-[11px] underline text-luna-muted hover:text-white mt-1"
                                  onClick={() => setE('date', nextTradingNight(ef.date, tradingDays, [], venueId)!)}>
                                  Use {prettyNight(nextTradingNight(ef.date, tradingDays, [], venueId)!)} instead
                                </button>
                              )}
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
                          <Td className="block md:table-cell !pb-1 md:!pb-2.5 pt-3 md:pt-2.5">
                            <div className="font-semibold">{r.first_name} {r.last_name}</div>
                            <div className="text-xs text-luna-muted">
                              {r.mobile}{r.email ? ` · ${r.email}` : ''}
                              {party > 0 && <span className="text-luna-gold"> · +{party} {party === 1 ? 'friend' : 'friends'}</span>}
                            </div>
                            {r.notes && <div className="text-xs text-luna-gold mt-0.5">{r.notes}</div>}
                          </Td>
                          <Td className={`md:table-cell ${r.special_occasion ? 'inline-block !py-1' : 'hidden'}`}>{r.special_occasion ? <span className="pill bg-luna-gold/15 text-luna-gold">{r.special_occasion}</span> : <span className="text-luna-muted">—</span>}</Td>
                          <Td className="inline-block md:table-cell !py-1 md:!py-2.5 text-xs md:text-sm text-luna-muted">
                            {r.promoter_name}{r.source ? <span className="md:block"> · src {r.source}</span> : null}
                          </Td>
                          <Td className="inline-block md:table-cell !py-1 md:!py-2.5"><StatusPill status={r.status} /></Td>
                          <Td className="block md:table-cell text-left md:text-right whitespace-nowrap !pt-1 !pb-3 md:!py-2.5">
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
