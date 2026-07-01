'use client'
import { useState } from 'react'

interface V { id: string; name: string }
interface E { id: string; name: string; event_date: string; venue_id: string }
interface P { id: string; full_name: string; promoter_code: string }

const TYPES = [
  { key: 'promoters', label: 'Promoter export', desc: 'All promoters with contact, tier, totals & attendance.' },
  { key: 'guests', label: 'Guest export', desc: 'Every guest registration with check-in status & consent.' },
  { key: 'attendance', label: 'Event attendance export', desc: 'Per-event attendance with door notes.' },
  { key: 'performance', label: 'Promoter performance export', desc: 'Leaderboard-style rollup with ranks.' },
]

export function ExportPanel({ venues, events, promoters }: { venues: V[]; events: E[]; promoters: P[] }) {
  const [venue, setVenue] = useState('')
  const [event, setEvent] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [promoter, setPromoter] = useState('')

  function href(type: string) {
    const p = new URLSearchParams()
    if (venue) p.set('venue', venue)
    if (event) p.set('event', event)
    if (from) p.set('from', from)
    if (to) p.set('to', to)
    if (promoter) p.set('promoter', promoter)
    return `/api/export/${type}?${p.toString()}`
  }

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <h2 className="font-bold mb-3">Filters</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div><label className="label">Venue</label>
            <select className="input" value={venue} onChange={e => { setVenue(e.target.value); setEvent('') }}>
              <option value="">All</option>{venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select></div>
          <div><label className="label">Event</label>
            <select className="input" value={event} onChange={e => setEvent(e.target.value)}>
              <option value="">All</option>
              {events.filter(e => !venue || e.venue_id === venue).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select></div>
          <div><label className="label">From date</label><input type="date" className="input" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div><label className="label">To date</label><input type="date" className="input" value={to} onChange={e => setTo(e.target.value)} /></div>
          <div><label className="label">Promoter</label>
            <select className="input" value={promoter} onChange={e => setPromoter(e.target.value)}>
              <option value="">All</option>{promoters.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </select></div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {TYPES.map(t => (
          <div key={t.key} className="card p-5 flex flex-col">
            <h3 className="font-bold">{t.label}</h3>
            <p className="text-sm text-luna-muted mt-1 flex-1">{t.desc}</p>
            <a href={href(t.key)} className="btn-gold mt-4">Download CSV</a>
          </div>
        ))}
      </div>
      <p className="text-xs text-luna-muted">Columns use HubSpot-friendly names (First Name / Last Name split, Phone, Marketing Consent). Filters above apply to every export.</p>
    </div>
  )
}
