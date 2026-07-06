'use client'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Stat, TierBadge } from '@/components/ui'
import { pct, fmtDate } from '@/lib/format'
import { downloadWeeklyReport } from '@/lib/report-pdf'

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

type Range = { from: string; to: string }
type Guest = {
  first_name: string; last_name: string; venue_name: string
  event_date: string; checked_in_at: string; no_entry: boolean; special_occasion: string | null
}

// A single clickable person row that expands to reveal the guests they checked in.
function PersonRow({ rank, person, range, withTier = false, icon }:
  { rank: number | null; person: any; range: Range; withTier?: boolean; icon?: string }) {
  const supabase = useMemo(() => createClient(), [])
  const [open, setOpen] = useState(false)
  const [guests, setGuests] = useState<Guest[] | null>(null)
  const [loading, setLoading] = useState(false)

  async function toggle() {
    const next = !open
    setOpen(next)
    if (next && guests === null && person.id) {
      setLoading(true)
      const { data } = await supabase.rpc('get_week_guests', {
        p_promoter: person.id, p_from: range.from, p_to: range.to,
      })
      setGuests((data ?? []) as Guest[])
      setLoading(false)
    }
  }

  const clickable = !!person.id
  return (
    <div className="border-b border-luna-border/40 last:border-0">
      <button type="button" onClick={toggle} disabled={!clickable}
        className={`w-full flex items-center gap-3 py-2 px-1 rounded-lg text-left ${clickable ? 'hover:bg-white/5 cursor-pointer' : 'cursor-default'}`}>
        <span className="w-6 text-center font-bold text-white/80">{icon ?? (rank != null ? `#${rank}` : '')}</span>
        <span className="flex-1 font-medium">
          {person.full_name}
          {person.promoter_code
            ? <span className="text-luna-muted text-xs"> ({person.promoter_code})</span>
            : person.sublabel ? <span className="text-luna-muted text-xs"> ({person.sublabel})</span> : null}
        </span>
        {withTier && person.current_tier && <TierBadge tier={person.current_tier} />}
        <span className="w-10 text-right font-semibold text-emerald-400">{person.checked_in}</span>
        {clickable && <span className="w-4 text-luna-muted text-xs">{open ? '▾' : '▸'}</span>}
      </button>

      {open && (
        <div className="pl-9 pr-2 pb-3">
          {loading && <p className="text-xs text-luna-muted py-1">Loading…</p>}
          {!loading && guests && guests.length === 0 &&
            <p className="text-xs text-luna-muted py-1">No individual check-ins found for this week.</p>}
          {!loading && guests && guests.map((g, i) => (
            <div key={i} className="flex items-center gap-2 py-1 text-sm border-b border-luna-border/20 last:border-0">
              <span className="flex-1">
                {g.first_name} {g.last_name}
                {g.special_occasion && <span className="ml-2 pill bg-luna-purple/25 text-white text-[10px]">🎉 {g.special_occasion}</span>}
                {g.no_entry && <span className="ml-2 pill bg-red-500/15 text-red-400 text-[10px]">No entry</span>}
              </span>
              <span className="text-luna-muted text-xs text-right whitespace-nowrap">
                {g.venue_name} · {fmtDate(g.event_date)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PersonList({ title, empty, rows, range, withTier = false }:
  { title: string; empty: string; rows: any[]; range: Range; withTier?: boolean }) {
  return (
    <div className="card p-5">
      <h2 className="font-bold mb-3">{title}</h2>
      {rows.length === 0 && <p className="text-sm text-luna-muted">{empty}</p>}
      {rows.map((r: any, i: number) => (
        <PersonRow key={r.id ?? i} rank={i + 1} person={r} range={range} withTier={withTier} />
      ))}
      {rows.length > 0 && <p className="text-[11px] text-luna-muted mt-3">Tap a name to see who they checked in.</p>}
    </div>
  )
}

export function WeeklySummary() {
  const supabase = useMemo(() => createClient(), [])
  const [weeksAgo, setWeeksAgo] = useState(0)
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [pdfErr, setPdfErr] = useState('')

  const weeks = useMemo(() => Array.from({ length: 13 }, (_, i) => {
    const start = weekStartUTC(i)
    return { i, start, label: label(start), current: i === 0 }
  }), [])

  const range = useMemo<Range>(() => {
    const from = weekStartUTC(weeksAgo)
    const to = new Date(from.getTime() + WEEK_MS)
    return { from: from.toISOString(), to: to.toISOString() }
  }, [weeksAgo])

  useEffect(() => {
    setLoading(true)
    supabase.rpc('get_weekly_summary', { p_from: range.from, p_to: range.to })
      .then(({ data }) => { setData(data); setLoading(false) })
  }, [range, supabase])

  const sel = weeks[weeksAgo]

  async function exportPdf() {
    setPdfErr(''); setPdfBusy(true)
    try {
      await downloadWeeklyReport(range.from, range.to, sel?.label ?? '')
    } catch (e: any) {
      setPdfErr(e?.message || 'Could not generate the report.')
    } finally { setPdfBusy(false) }
  }

  const house = data ? {
    id: data.house_id, full_name: 'Luna Group', sublabel: 'public guestlist',
    checked_in: data.house_checked_in ?? 0,
  } : null

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
        <button onClick={exportPdf} disabled={pdfBusy || loading}
          className="btn-gold !py-2 !px-4 text-sm ml-auto disabled:opacity-60">
          {pdfBusy ? 'Preparing…' : 'Download PDF report'}
        </button>
      </div>

      {pdfErr && <p className="text-sm text-red-400">Report error: {pdfErr}</p>}

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
              {house && <PersonRow rank={null} person={house} range={range} icon="🏠" />}
              {(data.top_promoters ?? []).length === 0 && <p className="text-sm text-luna-muted">No check-ins this week.</p>}
              {(data.top_promoters ?? []).map((r: any, i: number) => (
                <PersonRow key={r.id ?? i} rank={i + 1} person={r} range={range} withTier />
              ))}
              <p className="text-[11px] text-luna-muted mt-3">Tap a name to see who they checked in.</p>
            </div>

            <div className="card p-5">
              <h2 className="font-bold mb-3">Top venues</h2>
              {(data.top_venues ?? []).length === 0 && <p className="text-sm text-luna-muted">No check-ins this week.</p>}
              {(data.top_venues ?? []).map((v: any, i: number) => (
                <div key={i} className="flex items-center gap-3 py-2 border-b border-luna-border/40 last:border-0">
                  <span className="w-6 font-bold text-white/80">#{i + 1}</span>
                  <span className="flex-1 font-medium">{v.name}</span>
                  <span className="w-10 text-right font-semibold text-emerald-400">{v.checked_in}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-5">
            <PersonList title="Top DJs" empty="No DJ check-ins this week." rows={data.top_djs ?? []} range={range} withTier />
            <PersonList title="Top staff" empty="No staff check-ins this week." rows={data.top_staff ?? []} range={range} withTier />
          </div>
        </>
      )}
    </div>
  )
}
