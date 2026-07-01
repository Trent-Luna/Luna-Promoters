'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { fmtDate, fmtTime } from '@/lib/format'

interface Ev { id: string; name: string; event_date: string; start_time: string | null; end_time: string | null; venue_id: string; venue_name: string }

export function GuestRegistrationForm({ promoterCode, events }: { promoterCode: string; events: Ev[] }) {
  const router = useRouter()
  const [eventId, setEventId] = useState(events[0]?.id ?? '')
  const [f, setF] = useState({ first: '', last: '', mobile: '', email: '', dob: '', instagram: '' })
  const [consent, setConsent] = useState(false)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }))
  const ev = events.find(e => e.id === eventId)

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr('')
    if (!eventId) { setErr('Please choose an event.'); return }
    setLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('register_guest', {
        p_promoter_code: promoterCode, p_event_id: eventId,
        p_first: f.first.trim(), p_last: f.last.trim(), p_mobile: f.mobile.trim(),
        p_email: f.email.trim(), p_dob: f.dob || null, p_instagram: f.instagram,
        p_marketing: consent,
      })
      if (error) throw error
      if (!data?.ok) {
        const m: Record<string, string> = {
          duplicate: 'This mobile number is already registered for this event.',
          guestlist_closed: 'The guestlist for this event is now closed.',
          event_not_found: 'That event is no longer available.',
          promoter_not_found: 'This promoter link is not active.',
        }
        setErr(m[data?.error] || 'Could not register. Please check your details.')
        return
      }
      router.push(`/g/${data.qr_token}`)
    } catch (e: any) {
      setErr(e.message || 'Something went wrong. Please try again.')
    } finally { setLoading(false) }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <label className="label">Choose your event *</label>
        <select className="input" value={eventId} onChange={e => setEventId(e.target.value)} required>
          {events.map(e => (
            <option key={e.id} value={e.id}>
              {e.name} — {e.venue_name} — {fmtDate(e.event_date)}
            </option>
          ))}
        </select>
        {ev && (
          <p className="text-xs text-luna-muted mt-2">
            {ev.venue_name} · {fmtDate(ev.event_date)}{ev.start_time ? ` · ${fmtTime(ev.start_time)}` : ''}
            {ev.end_time ? ` – ${fmtTime(ev.end_time)}` : ''}
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">First name *</label>
          <input className="input" required value={f.first} onChange={e => set('first', e.target.value)} />
        </div>
        <div>
          <label className="label">Last name *</label>
          <input className="input" required value={f.last} onChange={e => set('last', e.target.value)} />
        </div>
      </div>
      <div>
        <label className="label">Mobile number *</label>
        <input className="input" required type="tel" placeholder="04xx xxx xxx"
          value={f.mobile} onChange={e => set('mobile', e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" value={f.email} onChange={e => set('email', e.target.value)} />
        </div>
        <div>
          <label className="label">Date of birth</label>
          <input className="input" type="date" value={f.dob} onChange={e => set('dob', e.target.value)} />
        </div>
      </div>
      <div>
        <label className="label">Instagram</label>
        <input className="input" placeholder="@handle" value={f.instagram} onChange={e => set('instagram', e.target.value)} />
      </div>
      <label className="flex items-start gap-3 text-sm cursor-pointer">
        <input type="checkbox" className="mt-1 accent-luna-gold w-4 h-4" checked={consent}
          onChange={e => setConsent(e.target.checked)} />
        <span className="text-luna-muted">I&apos;m happy for Luna Group to send me event updates and offers.</span>
      </label>
      {err && <p className="text-sm text-red-400">{err}</p>}
      <button className="btn-gold w-full btn-lg" disabled={loading}>
        {loading ? 'Registering…' : 'Get my QR code'}
      </button>
      <p className="text-[11px] text-luna-muted text-center leading-relaxed">
        Guestlist entry is subject to availability, venue capacity, dress code, valid 18+ ID and
        management discretion. Registering does not guarantee entry. Please arrive early to avoid disappointment.
      </p>
    </form>
  )
}
