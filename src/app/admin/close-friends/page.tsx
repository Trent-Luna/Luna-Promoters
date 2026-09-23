import { getSession, hasRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/AppShell'
import { navForRoles } from '@/components/nav'

export const dynamic = 'force-dynamic'

/**
 * Close Friends — who brought the most people in, week by week.
 *
 * Trent, 23 Sep 2026: "I then want to be able to keep tabs on the most scan
 * in's every week."
 *
 * Deliberately NOT the tier machinery. Close Friends run Wednesdays at Su Casa
 * Rooftop and are measured on the week in front of them, so there is no Bronze
 * / Silver / Gold here and nothing accumulates into a month.
 *
 * The maths lives in close_friends_weekly() rather than here: the week is keyed
 * off events.event_date so a Wednesday that runs past midnight stays Wednesday,
 * and everybody appears in every week even at zero — a leaderboard that drops
 * the people who had a quiet week hides the only thing it exists to show.
 */
type Row = {
  week_start: string
  promoter_id: string
  full_name: string
  promoter_code: string | null
  registered: number
  checked_in: number
  rank: number
}

const WEEKS = 8

function weekLabel(iso: string): string {
  const d = new Date(`${iso}T12:00:00+10:00`)
  const end = new Date(d)
  end.setDate(end.getDate() + 6)
  const f = (x: Date) =>
    x.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', timeZone: 'Australia/Brisbane' })
  return `${f(d)} – ${f(end)}`
}

export default async function AdminCloseFriends() {
  const s = await getSession()
  if (!s) redirect('/login')
  if (!hasRole(s, 'admin', 'venue_manager')) redirect('/dashboard')

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('close_friends_weekly', { p_weeks: WEEKS })
  const rows = (data ?? []) as Row[]

  const weeks = [...new Set(rows.map(r => r.week_start))]
  const thisWeek = weeks[0] ?? null

  return (
    <AppShell
      nav={navForRoles(s.roles)}
      current="/admin/close-friends"
      title="Close Friends"
      subtitle="Su Casa Rooftop, Wednesdays. Ranked on guests checked in that week — registrations that never turned up do not count."
    >
      {error ? (
        <div className="card p-5 text-sm text-luna-muted">Could not load the leaderboard.</div>
      ) : rows.length === 0 ? (
        <div className="card p-5">
          <p className="text-sm font-medium">No Close Friends yet</p>
          <p className="mt-1 text-sm text-luna-muted">
            Once someone signs up at <span className="text-white">/memberships/close-friends</span> and is
            approved, their week appears here. Existing promoters can be moved across on the Promoters page.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {weeks.map(w => {
            const week = rows.filter(r => r.week_start === w)
            const inCount = week.reduce((n, r) => n + r.checked_in, 0)
            return (
              <section key={w} className="card p-5">
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-sm font-bold">
                    {weekLabel(w)}
                    {w === thisWeek && (
                      <span className="pill ml-2" style={{ backgroundColor: '#8ecf6c22', color: '#8ecf6c' }}>
                        This week
                      </span>
                    )}
                  </h2>
                  <span className="text-xs text-luna-muted">{inCount} checked in</span>
                </div>
                <div className="overflow-x-auto md:overflow-visible">
                  <table className="table-stack w-full text-sm md:min-w-[480px]">
                    <thead className="text-left text-[11px] uppercase tracking-wider text-luna-muted">
                      <tr>
                        <th className="py-1.5 pr-3 font-medium">#</th>
                        <th className="py-1.5 pr-3 font-medium">Close Friend</th>
                        <th className="py-1.5 pr-3 text-right font-medium">Registered</th>
                        <th className="py-1.5 text-right font-medium">Checked in</th>
                      </tr>
                    </thead>
                    <tbody>
                      {week.map(r => (
                        <tr key={r.promoter_id} className="border-t border-white/[0.06]">
                          <td className="py-2 pr-3 tabular-nums text-luna-muted">{r.checked_in > 0 ? r.rank : '—'}</td>
                          <td className="py-2 pr-3">
                            <span className="font-medium">{r.full_name}</span>
                            {r.promoter_code && (
                              <span className="ml-2 text-xs text-luna-muted">{r.promoter_code}</span>
                            )}
                          </td>
                          <td className="py-2 pr-3 text-right tabular-nums text-luna-muted">{r.registered}</td>
                          <td
                            className="py-2 text-right font-semibold tabular-nums"
                            style={r.checked_in > 0 ? { color: '#8ecf6c' } : undefined}
                          >
                            {r.checked_in}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )
          })}
        </div>
      )}
    </AppShell>
  )
}
