'use client'
import { useEffect, useMemo, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { StatusPill } from '@/components/ui'
import { fmtDate, fmtTime } from '@/lib/format'

interface Venue { id: string; name: string }
interface Ev { id: string; name: string; event_date: string; start_time: string | null }
interface Row {
  id: string; status: string
  first_name: string; last_name: string; mobile: string
  promoter_name: string; promoter_code: string
}

export function GuestlistManager({ venues }: { venues: Venue[] }) {
  const supabase = useMemo(() => createClient(), [])
  const [venueId, setVenueId] = useState(venues[0]?.id ?? '')
  const [events, setEvents] = useState<Ev[]>([])
  const [eventId, setEventId] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState('')
  const [f, setF] = useState({ first: '', last: '', mobile: '', email: '', dob: '', instagram: '' })
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }))

  useEffect(() => {
    if (!venueId) return
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
    const { data } = await supabase.from('guest_registrations')
      .select('id,status,guests(first_name,last_name,mobile),promoters(full_name,promoter_code)')
      .eq('event_id', eventId).order('created_at', { ascending: false })
    setRows((data ?? []).map((r: any) => ({
      id: r.id, status: r.status,
      first_name: r.guests?.first_name ?? '', last_name: r.guests?.last_name ?? '',
      mobile: r.guests?.mobile ?? '', promoter_name: r.promoters?.full_name ?? '',
      promoter_code: r.promoters?.promoter_code ?? '',
    })))
    setLoading(false)
  }, [eventId, supabase])

  useEffect(() => { load() }, [load])

  async function addGuest(e: React.FormEvent) {
    e.preventDefault(); setMsg(null)
    if (!eventId) { setMsg({ ok: false, text: 'Pick an event first.' }); return }
    setSaving(true)
    const { data, error } = await supabase.rpc('add_guest_manual', {
      p_event: eventId, p_first: f.first.trim(), p_last: f.last.trim(),
      p_mobile: f.mobile.trim(), p_email: f.email.trim(), p_dob: f.dob || null,
      p_instagram: f.instagram.trim(),
    })
    setSaving(false)
    if (error) { setMsg({ ok: false, text: error.message }); return }
    if (!data?.ok) {
      setMsg({ ok: false, text: data?.error === 'duplicate' ? 'That guest is already on this event.' : 'Could not add guest.' })
      return
    }
    setMsg({ ok: true, text: `${f.first} ${f.last} added to the list.` })
    setF({ first: '', last: '', mobile: '', email: '', dob: '', instagram: '' })
    load()
  }

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return rows
    return rows.filter(r => `${r.first_name} ${r.last_name}`.toLowerCase().includes(t)
      || r.mobile.includes(t) || r.promoter_name.toLowerCase().includes(t))
  }, [rows, q])

  const checked = rows.filter(r => r.status === 'checked_in').length

  return (
    <div className="grid lg:grid-cols-3 gap-5">
      {/* add form */}
      <form onSubmit={addGuest} className="card p-5 space-y-3 h-fit">
        <h2 className="font-bold">Add a guest</h2>
        <p className="text-xs text-luna-muted">Added guests are credited to you.</p>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">First name *</label><input required className="input" value={f.first} onChange={e => set('first', e.target.value)} /></div>
          <div><label className="label">Last name *</label><input required className="input" value={f.last} onChange={e => set('last', e.target.value)} /></div>
        </div>
        <div><label className="label">Mobile *</label><input required type="tel" className="input" value={f.mobile} onChange={e => set('mobile', e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Email</label><input type="email" className="input" value={f.email} onChange={e => set('email', e.target.value)} /></div>
          <div><label className="label">DOB</label><input type="date" className="input" value={f.dob} onChange={e => set('dob', e.target.value)} /></div>
        </div>
        <div><label className="label">Instagram</label><input className="input" placeholder="@handle" value={f.instagram} onChange={e => set('instagram', e.target.value)} /></div>
        {msg && <p className={`text-sm ${msg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{msg.text}</p>}
        <button className="btn-gold w-full" disabled={saving || !eventId}>{saving ? 'Adding…' : 'Add to guestlist'}</button>
      </form>

      {/* list */}
      <div className="lg:col-span-2 space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <div><label className="label">Venue</label>
            <select className="input" value={venueId} onChange={e => setVenueId(e.target.value)}>
              {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select></div>
          <div><label className="label">Event / date</label>
            <select className="input" value={eventId} onChange={e => setEventId(e.target.value)}>
              {events.length === 0 && <option value="">No events</option>}
              {events.map(e => <option key={e.id} value={e.id}>{e.name} — {fmtDate(e.event_date)}{e.start_time ? ` · ${fmtTime(e.start_time)}` : ''}</option>)}
            </select></div>
        </div>
        <div className="flex items-center gap-3">
          <input className="input flex-1" placeholder="Search this guestlist…" value={q} onChange={e => setQ(e.target.value)} />
          <span className="text-sm text-luna-muted whitespace-nowrap">{rows.length} on list · {checked} in</span>
        </div>
        <div className="space-y-2">
          {loading && <p className="text-sm text-luna-muted">Loading…</p>}
          {!loading && filtered.length === 0 && <div className="card p-6 text-center text-luna-muted">No guests yet.</div>}
          {filtered.map(r => (
            <div key={r.id} className="card p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{r.first_name} {r.last_name}</div>
                <div className="text-xs text-luna-muted truncate">{r.mobile} · {r.promoter_name} ({r.promoter_code})</div>
              </div>
              <StatusPill status={r.status} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
