import Link from 'next/link'
import { Icon } from '@/components/icons'
import {
  activityLabel, categoryLabel, intakeMix, intakeTrend, joinedLabel,
  moreLabel, startedSummary, windowLabel,
  type NewPromoterIntake,
} from '@/lib/new-promoters'

/**
 * Recent sign-ups, on the admin overview.
 *
 * Trent, 8 Sep 2026: "can you add in a 'new promoters' or Recent adds for
 * recently signed up promoters. perhaps the last 14 days".
 *
 * The card leads with the count, but the line under it is the one that earns
 * the space: how many of the new people have actually put a guest on a list.
 * On the day this was built that was 1 of 51, and the plain list of names Trent
 * asked for would have shown fifty-one rows that all looked fine.
 */
export function NewPromoters({ intake }: { intake: NewPromoterIntake }) {
  const label = windowLabel(intake.days)
  const mix = intakeMix(intake)
  const trend = intakeTrend(intake)
  const started = startedSummary(intake)
  const more = moreLabel(intake.total, intake.rows.length)
  const now = new Date()

  return (
    <div className="card p-5">
      <div className="flex items-end gap-3 mb-2">
        <h2 className="font-bold leading-tight">New this {label}</h2>
        <Link href="/admin/promoters?sort=newest" className="ml-auto text-xs text-luna-gold hover:text-luna-goldsoft">
          All promoters
        </Link>
      </div>

      {intake.total === 0 ? (
        <p className="text-sm text-luna-muted py-3">
          Nobody has signed up in the last {label}.
          {trend && <> That is {trend}.</>}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <span className="text-2xl font-bold tabular-nums leading-none">{intake.total}</span>
            <span className="text-sm text-luna-muted">{mix}</span>
            {trend && <span className="text-xs text-luna-subtle">· {trend}</span>}
          </div>

          {started && (
            <p className={`mt-2 text-xs ${
              started.tone === 'warn' ? 'text-amber-400'
                : started.tone === 'good' ? 'text-emerald-400'
                  : 'text-luna-muted'}`}>
              {started.tone === 'warn' && <Icon name="warn" size={12} className="inline-block -mt-0.5 mr-1" />}
              {started.text}
              {started.tone === 'warn' && (
                <span className="text-luna-muted"> Someone should walk them through their link.</span>
              )}
            </p>
          )}

          {intake.pending > 0 && (
            <p className="mt-1.5 text-xs text-amber-400">
              {intake.pending} still waiting on approval —{' '}
              <Link href="/admin/promoters?status=pending" className="underline underline-offset-2">review them</Link>.
            </p>
          )}

          <div className="mt-1">
            {intake.rows.map(r => {
              const cat = categoryLabel(r.category)
              return (
                <Link
                  key={r.id}
                  href={`/admin/promoters?q=${encodeURIComponent(r.promoter_code || r.full_name)}`}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2 border-t border-white/[0.07] hover:bg-white/[0.03] -mx-2 px-2 rounded-lg transition"
                >
                  <div className="min-w-0">
                    <div className="font-semibold truncate">
                      {r.full_name}
                      {cat && <span className="ml-2 text-[11px] font-normal text-luna-subtle">{cat}</span>}
                    </div>
                    <div className="text-xs text-luna-muted truncate">
                      {r.promoter_code ? `/p/${r.promoter_code}` : 'No code yet'} · joined {joinedLabel(r.created_at, now)}
                    </div>
                  </div>
                  <span className={`text-xs whitespace-nowrap ${r.registered > 0 ? 'text-luna-text/80' : 'text-luna-subtle'}`}>
                    {activityLabel(r)}
                  </span>
                </Link>
              )
            })}
          </div>

          {more && (
            <Link href="/admin/promoters?sort=newest"
              className="block pt-2.5 mt-1 border-t border-dashed border-white/[0.12] text-xs text-luna-muted hover:text-luna-text">
              {more}
            </Link>
          )}
        </>
      )}
    </div>
  )
}
