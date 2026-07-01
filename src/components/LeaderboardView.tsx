'use client'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TierBadge } from './ui'
import { fmtDate } from '@/lib/format'

interface V { id: string; name: string }
interface E { id: string; name: string; event_date: string; venue_id: string }
type Period = 'week' | 'month' | 'all'

function range(p: Period): { from: string | null } {
  const now = new Date()
  if (p === 'week') { const d = new Date(now); d.setDate(d.getDate() - 7); return { from: d.toISOString().slice(0, 10) } }
  if (p === 'month') { const d = new Date(now.getFullYear(), now.getMonth(), 1); return { from: d.toISOString().slice(0, 10) } }
  return { from: null }
}

export function LeaderboardView({ venues, events }: { venues: V[]; events: E[]; adminScope?: boolean }) {
  const supabase = useMemo(() => createClient(), [])
  const [period, setPeriod] = useState<Period>('month')
  const [venueId, setVenueId] = useState('')
  const [eventId, setEventId] = useState('')
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    const { from } = range(period)
    supabase.rpc('get_leaderboard', {
      p_event: eventId || null, p_venue: venueId || null,
      p_from: eventId ? null : from, p_to: null, p_limit: 100,
    }).then(({ data }) => { setRows(data ?? []); setLoading(false) })
  }, [period, venueId, eventId, supabase])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-end">
        <div className="flex gap-1">
          {(['week', 'month', 'all'] as Period[]).map(p => (
            <button key={p} onClick={() => { setPeriod(p); setEventId('') }}
              className={`pill border capitalize ${period === p && !eventId ? 'bg-luna-gold/15 text-luna-gold border-luna-gold' : 'border-luna-border text-luna-muted'}`}>{p}</button>
          ))}
        </div>
        <select className="input !w-auto !py-2" value={venueId} onChange={e => setVenueId(e.target.value)}>
          <option value="">All venues</option>
          {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
        <select className="input !w-auto !py-2" value={eventId} onChange={e => setEventId(e.target.value)}>
          <option value="">By period (not single event)</option>
          {events.filter(e => !venueId || e.venue_id === venueId).map(e => <option key={e.id} value={e.id}>{e.name} — {fmtDate(e.event_date)}</option>)}
        </select>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="text-luna-muted text-xs uppercase tracking-wide">
            <tr className="border-b border-luna-border">
              <th className="text-left p-3">Rank</th><th className="text-left p-3">Promoter</th>
              <th className="text-left p-3">Code</th><th className="text-left p-3">Venue</th>
              <th className="text-right p-3">Registered</th><th className="text-right p-3">Checked in</th>
              <th className="text-right p-3">No-shows</th><th className="text-right p-3">Att %</th>
              <th className="text-left p-3">Tier</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={9} className="p-6 text-center text-luna-muted">Loading…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={9} className="p-6 text-center text-luna-muted">No data for this filter.</td></tr>}
            {rows.map((r: any) => (
              <tr key={r.promoter_id} className="border-b border-luna-border/40">
                <td className="p-3 font-bold text-luna-gold">#{r.rank}</td>
                <td className="p-3 font-medium">{r.promoter_name}</td>
                <td className="p-3 text-luna-muted">{r.promoter_code}</td>
                <td className="p-3 text-luna-muted">{r.venue_name ?? '—'}</td>
                <td className="p-3 text-right">{r.registered}</td>
                <td className="p-3 text-right text-emerald-400 font-semibold">{r.checked_in}</td>
                <td className="p-3 text-right">{r.no_shows}</td>
                <td className="p-3 text-right">{r.attendance_pct}%</td>
                <td className="p-3"><TierBadge tier={r.tier} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
