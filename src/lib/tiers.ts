// Tier progress helper (client-safe). Thresholds mirror the DB `tiers` table
// but the DB is source of truth; pass live thresholds when available.
export interface TierDef { name: string; min_guests: number | null; max_guests: number | null; invite_only: boolean; perks: string }

export function tierProgress(checkedThisMonth: number, tiers: TierDef[]) {
  const ranked = tiers.filter(t => !t.invite_only).sort((a, b) => (a.min_guests ?? 0) - (b.min_guests ?? 0))
  let current = ranked[0]
  for (const t of ranked) {
    if (checkedThisMonth >= (t.min_guests ?? 0)) current = t
  }
  const next = ranked.find(t => (t.min_guests ?? 0) > (current.min_guests ?? 0))
  const target = next?.min_guests ?? null
  const floor = current.min_guests ?? 0
  const toNext = target != null ? Math.max(target - checkedThisMonth, 0) : 0
  const progressPct = target != null
    ? Math.min(100, Math.round(((checkedThisMonth - floor) / (target - floor)) * 100))
    : 100
  return { current, next, toNext, progressPct }
}
