'use client'
import { useState } from 'react'
import { Icon } from '@/components/icons'

interface V { id: string; name: string }
interface E { id: string; name: string; event_date: string; venue_id: string }
interface P { id: string; full_name: string; promoter_code: string }

const TYPES = [
  { key: 'promoters', label: 'Promoter export', desc: 'All promoters with contact, tier, totals & attendance.' },
  { key: 'guests', label: 'Guest export', desc: 'Every guest registration with check-in status, consent, source and group.' },
  { key: 'attendance', label: 'Event attendance export', desc: 'Per-event attendance with door notes.' },
  { key: 'performance', label: 'Promoter performance export', desc: 'Leaderboard-style rollup with ranks.' },
]

export function ExportPanel({ venues, events, promoters }: { venues: V[]; events: E[]; promoters: P[] }) {
  const [venue, setVenue] = useState('')
  const [event, setEvent] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [promoter, setPromoter] = useState('')
  const [type, setType] = useState('promoters')

  function href(type: string) {
    const p = new URLSearchParams()
    if (venue) p.set('venue', venue)
    if (event) p.set('event', event)
    if (from) p.set('from', from)
    if (to) p.set('to', to)
    if (promoter) p.set('promoter', promoter)
    return `/api/export/${type}?${p.toString()}`
  }

  const sel = TYPES.find(t => t.key === type) ?? TYPES[0]
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {TYPES.map(t => (
          <button key={t.key} type="button" onClick={() => setType(t.key)}
            className={`card p-4 text-left transition ${type === t.key ? 'border-luna-gold/50 bg-luna-gold/[0.06]' : 'hover:border-white/20'}`}>
            <div className="flex items-center gap-2">
              <span className="font-bold">{t.label}</span>
              {type === t.key && <span className="ml-auto pill bg-luna-gold/15 text-luna-gold">Selected</span>}
            </div>
            <p className="text-xs text-luna-muted mt-1">{t.desc}</p>
          </button>
        ))}
      </div>

      <div className="card p-5 space-y-4">
        <h2 className="font-bold">Filters</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div><label className="label">Venue</label>
            <select className="input !py-2.5" value={venue} onChange={e => { setVenue(e.target.value); setEvent('') }}>
              <option value="">All</option>{venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select></div>
          <div><label className="label">Event</label>
            <select className="input !py-2.5" value={event} onChange={e => setEvent(e.target.value)}>
              <option value="">All</option>
              {events.filter(e => !venue || e.venue_id === venue).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select></div>
          <div><label className="label">Promoter</label>
            <select className="input !py-2.5" value={promoter} onChange={e => setPromoter(e.target.value)}>
              <option value="">All</option>{promoters.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </select></div>
          <div><label className="label">From date</label><input type="date" className="input !py-2.5" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div><label className="label">To date</label><input type="date" className="input !py-2.5" value={to} onChange={e => setTo(e.target.value)} /></div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <a href={href(sel.key)} className="btn-gold"><Icon name="download" size={16} /> Download CSV</a>
          <span className="text-xs text-luna-muted">{sel.label} · {sel.key}.csv · filters above apply</span>
        </div>
      </div>
      <p className="text-xs text-luna-muted">Columns use HubSpot-friendly names (First Name / Last Name split, Phone, Marketing Consent).</p>
    </div>
  )
}
