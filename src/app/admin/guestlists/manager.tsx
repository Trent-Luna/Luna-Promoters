'use client'
import { useEffect, useMemo, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { StatusPill } from '@/components/ui'

interface Venue { id: string; name: string }
interface Row {
  id: string; status: string
  first_name: string; last_name: string; mobile: string
  promoter_name: string; promoter_code: string; plus_ones: number; notes: string | null
}

export function GuestlistManager({ venues }: { venues: Venue[] }) {
  const supabase = useMemo(() => createClient(), [])
  const today = new Date().toISOString().slice(0, 10)
  const maxDate = new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 10)

  const [venueId, setVenueId] = useState(venues[0]?.id ?? '')
  const [date, setDate] = useState(today)
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState('')
  const [f, setF] = useState({ first: '', last: '', mobile: '', email: '', dob: '', instagram: '', plus: '0', notes: '' })
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }))

  const load = useCallback(async () => {
    if (!venueId || !date) { setRows([]); return }
    setLoading(true)
    const { data } = await supabase.from('guest_registrations')
      .select('id,status,plus_ones,notes,guests(first_name,last_name,mobile),promoters(full_name,promoter_code),events!inner(event_date)')
      .eq('venue_id', venueId).eq('events.event_date', date)
      .order('created_at', { ascending: false })
    setRows((data ?? []).map((r: any) => ({
      id: r.id, status: r.status,
      first_name: r.guests?.first_name ?? '', last_name: r.guests?.last_name ?? '',
      mobile: r.guests?.mobile ?? '', promoter_name: r.promoters?.full_name ?? '',
      promoter_code: r.promoters?.promoter_code ?? '', plus_ones: r.plus_ones ?? 0,
      notes: r.notes ?? null,
    })))
    setLoading(false)
  }, [venueId, date, supabase])

  useEffect(() => { load() }, [load])

  async function addGuest(e: React.FormEvent) {
    e.preventDefault(); setMsg(null)
    if (!venueId || !date) { setMsg({ ok: false, text: 'Pick a venue and date first.' }); return }
    setSaving(true)
    const { data, error } = await supabase.rpc('add_guest_manual_vd', {
      p_venue: venueId, p_date: date, p_first: f.first.trim(), p_last: f.last.trim(),
      p_mobile: f.mobile.trim(), p_email: f.email.trim(), p_dob: f.dob || null,
      p_instagram: f.instagram.trim(), p_plus_ones: Math.max(0, parseInt(f.plus || '0', 10) || 0),
      p_notes: f.notes.trim() || null,
    })
    setSaving(false)
    if (error) { setMsg({ ok: false, text: error.message }); return }
    if (!data?.ok) {
      setMsg({ ok: false, text: data?.error === 'duplicate' ? 'That guest is already on this list.' : 'Could not add guest.' })
      return
    }
    setMsg({ ok: true, text: `${f.first} ${f.last} added.` })
    setF({ first: '', last: '', mobile: '', email: '', dob: '', instagram: '', plus: '0', notes: '' })
    load()
  }

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return rows
    return rows.filter(r => `${r.first_name} ${r.last_name}`.toLowerCase().includes(t)
      || r.mobile.includes(t) || r.promoter_name.toLowerCase().includes(t))
  }, [rows, q])

  const checked = rows.filter(r => r.status === 'checked_in').reduce((s, r) => s + 1 + (r.plus_ones || 0), 0)
  const heads = rows.reduce((s, r) => s + 1 + (r.plus_ones || 0), 0)

  return (
    <div className="grid lg:grid-cols-3 gap-5">
      <form onSubmit={addGuest} className="card p-5 space-y-3 h-fit">
        <h2 className="font-bold">Add a guest</h2>
        <p className="text-xs text-luna-muted">Added guests are credited to you, on the venue &amp; date selected.</p>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">First name *</label><input required className="input" value={f.first} onChange={e => set('first', e.target.value)} /></div>
          <div><label className="label">Last name *</label><input required className="input" value={f.last} onChange={e => set('last', e.target.value)} /></div>
        </div>
        <div><label className="label">Mobile *</label><input required type="tel" className="input" value={f.mobile} onChange={e => set('mobile', e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Email</label><input type="email" className="input" value={f.email} onChange={e => set('email', e.target.value)} /></div>
          <div><label className="label">DOB</label><input type="date" max={today} className="input" value={f.dob} onChange={e => set('dob', e.target.value)} /></div>
        </div>
        <div><label className="label">Instagram</label><input className="input" placeholder="@handle" value={f.instagram} onChange={e => set('instagram', e.target.value)} /></div>
        <div>
          <label className="label">Plus ones <span className="text-luna-muted font-normal">(extra guests in their party)</span></label>
          <input type="number" min={0} max={50} className="input" value={f.plus} onChange={e => set('plus', e.target.value)} />
        </div>
        <div>
          <label className="label">Notes <span className="text-luna-muted font-normal">(optional — e.g. VIP, allergy, special request)</span></label>
          <textarea className="input" rows={2} value={f.notes} onChange={e => set('notes', e.target.value)} />
        </div>
        {msg && <p className={`text-sm ${msg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{msg.text}</p>}
        <button className="btn-gold w-full" disabled={saving || !venueId || !date}>{saving ? 'Adding…' : 'Add to guestlist'}</button>
      </form>

      <div className="lg:col-span-2 space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <div><label className="label">Venue</label>
            <select className="input" value={venueId} onChange={e => setVenueId(e.target.value)}>
              {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select></div>
          <div><label className="label">Date</label>
            <input type="date" className="input" min="2020-01-01" max={maxDate} value={date} onChange={e => setDate(e.target.value)} /></div>
        </div>
        <div className="flex items-center gap-3">
          <input className="input flex-1" placeholder="Search this guestlist…" value={q} onChange={e => setQ(e.target.value)} />
          <span className="text-sm text-luna-muted whitespace-nowrap">{heads} on list · {checked} in</span>
        </div>
        <div className="space-y-2">
          {loading && <p className="text-sm text-luna-muted">Loading…</p>}
          {!loading && filtered.length === 0 && <div className="card p-6 text-center text-luna-muted">No guests for this venue &amp; date yet.</div>}
          {filtered.map(r => (
            <div key={r.id} className="card p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate flex items-center gap-2">
                  {r.first_name} {r.last_name}
                  {r.plus_ones > 0 && <span className="pill bg-luna-gold/20 text-luna-gold text-[11px]">+{r.plus_ones}</span>}
                </div>
                <div className="text-xs text-luna-muted truncate">
                  {r.mobile} · {r.promoter_name} ({r.promoter_code})
                  {r.plus_ones > 0 && <span> · party of {1 + r.plus_ones}</span>}
                </div>
                {r.notes && <div className="text-xs text-luna-gold mt-0.5 truncate">📝 {r.notes}</div>}
              </div>
              <StatusPill status={r.status} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
