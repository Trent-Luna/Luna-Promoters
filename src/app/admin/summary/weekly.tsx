'use client'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Stat, TierBadge } from '@/components/ui'
import { pct } from '@/lib/format'

const BRIS_OFFSET_MS = 10 * 3600 * 1000 // Brisbane = UTC+10 (no DST)
const WEEK_MS = 7 * 24 * 3600 * 1000

// Start (UTC Date) of the reporting week `weeksAgo` before the current one.
// A week begins Monday 05:00 Brisbane time.
function weekStartUTC(weeksAgo: number): Date {
  const nowBris = new Date(Date.now() + BRIS_OFFSET_MS)
  const day = nowBris.getUTCDay()
  const sinceMon = (day + 6) % 7
  const mon5 = new Date(Date.UTC(nowBris.getUTCFullYear(), nowBris.getUTCMonth(),
    nowBris.getUTCDate() - sinceMon, 5, 0, 0))
  if (nowBris.getTime() < mon5.getTime()) mon5.setUTCDate(mon5.getUTCDate() - 7)
  return new Date(mon5.getTime() - BRIS_OFFSET_MS - weeksAgo * WEEK_MS)
}

function label(startUTC: Date) {
  const brisStart = new Date(startUTC.getTime() + BRIS_OFFSET_MS)
  const brisEnd = new Date(startUTC.getTime() + WEEK_MS + BRIS_OFFSET_MS - 1)
  const f = (d: Date) => d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', timeZone: 'UTC' })
  return `${f(brisStart)} – ${f(brisEnd)}`
}

function List({ title, empty, rows, withTier = false }:
  { title: string; empty: string; rows: any[]; withTier?: boolean }) {
  return (
    <div className="card p-5">
      <h2 className="font-bold mb-3">{title}</h2>
      {rows.length === 0 && <p className="text-sm text-luna-muted">{empty}</p>}
      {rows.map((r: any, i: number) => (
        <div key={i} className="flex items-center gap-3 py-2 border-b border-luna-border/40 last:border-0">
          <span className="w-6 font-bold text-white/80">#{i + 1}</span>
          <span className="flex-1 font-medium">{r.full_name} <span className="text-luna-muted text-xs">({r.promoter_code})</span></span>
          {withTier && <TierBadge tier={r.current_tier} />}
          <span className="w-10 text-right font-semibold text-emerald-400">{r.checked_in}</span>
        </div>
      ))}
    </div>
  )
}

export function WeeklySummary() {
  const supabase = useMemo(() => createClient(), [])
  const [weeksAgo, setWeeksAgo] = useState(0)
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const weeks = useMemo(() => Array.from({ length: 13 }, (_, i) => {
    const start = weekStartUTC(i)
    return { i, start, label: label(start), current: i === 0 }
  }), [])

  useEffect(() => {
    setLoading(true)
    const from = weekStartUTC(weeksAgo)
    const to = new Date(from.getTime() + WEEK_MS)
    supabase.rpc('get_weekly_summary', { p_from: from.toISOString(), p_to: to.toISOString() })
      .then(({ data }) => { setData(data); setLoading(false) })
  }, [weeksAgo, supabase])

  const sel = weeks[weeksAgo]

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <select className="input !w-auto" value={weeksAgo} onChange={e => setWeeksAgo(Number(e.target.value))}>
          {weeks.map(w => (
            <option key={w.i} value={w.i}>{w.current ? 'This week' : w.i === 1 ? 'Last week' : `${w.i} weeks ago`} · {w.label}</option>
          ))}
        </select>
        <span className="text-sm text-luna-muted">
          Week runs Monday 5:00am → Monday 5:00am (Brisbane). {sel && `Showing ${sel.label}.`}
        </span>
      </div>

      {loading && <div className="card p-8 text-center text-luna-muted">Loading…</div>}

      {!loading && data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Guests registered" value={data.registered ?? 0} />
            <Stat label="Guests checked in" value={data.checked_in ?? 0} accent />
            <Stat label="Attendance" value={`${pct(data.checked_in ?? 0, data.registered ?? 0)}%`} />
            <Stat label="No entries" value={data.no_entry ?? 0} />
            <Stat label="Events held" value={data.events ?? 0} />
            <Stat label="Active promoters" value={data.active_promoters ?? 0} />
            <Stat label="New applications" value={data.new_applications ?? 0} />
            <Stat label="Luna Group guestlist" value={data.house_checked_in ?? 0} />
          </div>

          <div className="grid lg:grid-cols-2 gap-5">
            <div className="card p-5">
              <h2 className="font-bold mb-3">Top promoters</h2>
              <div className="flex items-center gap-3 py-2 mb-1 rounded-lg bg-luna-purple/10 px-2">
                <span className="w-6 text-center">🏠</span>
                <span className="flex-1 font-medium">Luna Group <span className="text-luna-muted text-xs">(public guestlist)</span></span>
                <span className="w-10 text-right font-semibold text-emerald-400">{data.house_checked_in ?? 0}</span>
              </div>
              {(data.top_promoters ?? []).length === 0 && <p className="text-sm text-luna-muted">No check-ins this week.</p>}
              {(data.top_promoters ?? []).map((r: any, i: number) => (
                <div key={i} className="flex items-center gap-3 py-2 border-b border-luna-border/40 last:border-0">
                  <span className="w-6 font-bold text-white/80">#{i + 1}</span>
                  <span className="flex-1 font-medium">{r.full_name} <span className="text-luna-muted text-xs">({r.promoter_code})</span></span>
                  <TierBadge tier={r.current_tier} />
                  <span className="w-10 text-right font-semibold text-emerald-400">{r.checked_in}</span>
                </div>
              ))}
            </div>
            <List title="Top venues" empty="No check-ins this week."
              rows={(data.top_venues ?? []).map((v: any) => ({ full_name: v.name, promoter_code: '', checked_in: v.checked_in }))} />
          </div>

          <div className="grid lg:grid-cols-2 gap-5">
            <List title="Top DJs" empty="No DJ check-ins this week." rows={data.top_djs ?? []} />
            <List title="Top staff" empty="No staff check-ins this week." rows={data.top_staff ?? []} />
          </div>
        </>
      )}
    </div>
  )
}
