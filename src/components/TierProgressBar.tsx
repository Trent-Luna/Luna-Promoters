import { tierProgress, type TierDef } from '@/lib/tiers'

const COLORS: Record<string, string> = {
  bronze: '#cd7f32', silver: '#c0c0c0', gold: '#d4af37', elite: '#b28dff',
}

/**
 * Segmented milestone bar across the ranked (non-invite) tiers.
 * Shows achieved tiers, current position, and how many check-ins to the next tier.
 */
export function TierProgressBar({
  checkedThisMonth, tiers, currentTier,
}: { checkedThisMonth: number; tiers: TierDef[]; currentTier: string }) {
  const ranked = tiers.filter(t => !t.invite_only)
    .sort((a, b) => (a.min_guests ?? 0) - (b.min_guests ?? 0))
  const top = ranked[ranked.length - 1]
  const scaleMax = (top?.min_guests ?? 50) || 50
  const prog = tierProgress(checkedThisMonth, tiers)
  const isElite = currentTier === 'elite'

  // fill % across the whole track (capped at the top tier threshold)
  const fill = Math.min(100, Math.round((checkedThisMonth / scaleMax) * 100))

  return (
    <div>
      <div className="flex items-end justify-between mb-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-luna-muted">This month</div>
          <div className="text-3xl font-extrabold">
            {checkedThisMonth} <span className="text-base font-medium text-luna-muted">checked in</span>
          </div>
        </div>
        {!isElite && prog.next && (
          <div className="text-right">
            <div className="text-2xl font-extrabold text-luna-gold">{prog.toNext}</div>
            <div className="text-xs text-luna-muted">to <span className="capitalize">{prog.next.name}</span></div>
          </div>
        )}
        {(isElite || !prog.next) && (
          <span className="pill" style={{ background: `${COLORS[currentTier]}22`, color: COLORS[currentTier] }}>
            {isElite ? 'Elite' : 'Top tier reached'}
          </span>
        )}
      </div>

      {/* track */}
      <div className="relative h-4 rounded-full bg-luna-surface overflow-hidden">
        <div className="h-full rounded-full transition-all"
          style={{ width: `${fill}%`, background: 'linear-gradient(90deg,#cd7f32,#c0c0c0,#d4af37)' }} />
      </div>

      {/* milestones */}
      <div className="relative mt-2 h-12">
        {ranked.map(t => {
          const pos = Math.min(100, Math.round(((t.min_guests ?? 0) / scaleMax) * 100))
          const achieved = checkedThisMonth >= (t.min_guests ?? 0)
          return (
            <div key={t.name} className="absolute -translate-x-1/2 text-center"
              style={{ left: `${pos}%` }}>
              <div className="w-3 h-3 rounded-full mx-auto border-2"
                style={{ background: achieved ? COLORS[t.name] : '#12121a', borderColor: COLORS[t.name] }} />
              <div className="text-xs font-semibold mt-1 capitalize"
                style={{ color: achieved ? COLORS[t.name] : '#9a9aa8' }}>{t.name}</div>
              <div className="text-[10px] text-luna-muted">
                {t.max_guests == null ? `${t.min_guests}+` : `${t.min_guests}–${t.max_guests}`}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
