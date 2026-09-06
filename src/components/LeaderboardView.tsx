'use client'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TierBadge, Th, Td, EmptyRow } from './ui'
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
  const maxIn = rows.reduce((m: number, r: any) => Math.max(m, Number(r.checked_in) || 0), 0)

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
              className={`pill !py-2 !px-3.5 capitalize ${period === p && !eventId ? 'bg-luna-gold/15 text-luna-gold' : 'bg-white/[0.07] text-luna-text/90'}`}>{p === 'all' ? 'All time' : p === 'week' ? 'Last 7 days' : 'This month'}</button>
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
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="border-b border-white/[0.07]">
              <Th className="pt-3">#</Th><Th className="pt-3">Promoter</Th>
              <Th className="pt-3">Tier</Th><Th className="pt-3">Venue</Th>
              <Th className="pt-3 text-right">Registered</Th><Th className="pt-3 text-right">Checked in</Th>
              <Th className="pt-3 text-right">No-shows</Th><Th className="pt-3 text-right">Attendance</Th>
              <Th className="pt-3" />
            </tr>
          </thead>
          <tbody>
            {loading && <EmptyRow colSpan={9}>Loading…</EmptyRow>}
            {!loading && rows.length === 0 && <EmptyRow colSpan={9}>No data for this filter.</EmptyRow>}
            {rows.map((r: any) => (
              <tr key={r.promoter_id} className="border-b border-white/[0.045] last:border-0 hover:bg-white/[0.02]">
                <Td className="text-luna-muted tabular-nums w-10">{r.rank}</Td>
                <Td><div className="font-semibold">{r.promoter_name}</div><div className="text-xs text-luna-muted">/p/{r.promoter_code}</div></Td>
                <Td><TierBadge tier={r.tier} /></Td>
                <Td className="text-luna-muted">{r.venue_name ?? '—'}</Td>
                <Td className="text-right tabular-nums">{r.registered}</Td>
                <Td className="text-right tabular-nums text-luna-gold font-bold">{r.checked_in}</Td>
                <Td className="text-right tabular-nums text-luna-muted">{r.no_shows}</Td>
                <Td className="text-right tabular-nums text-luna-muted">{r.attendance_pct}%</Td>
                <Td><div className="h-1.5 w-28 rounded-full bg-white/[0.07] overflow-hidden"><div className="h-full rounded-full bg-luna-gold" style={{ width: `${maxIn ? Math.round((r.checked_in / maxIn) * 100) : 0}%` }} /></div></Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
