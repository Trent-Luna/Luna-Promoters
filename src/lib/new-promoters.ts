/**
 * Who has just signed up — and whether any of them has started.
 *
 * Trent, 8 Sep 2026: "can you add in a 'new promoters' or Recent adds for
 * recently signed up promoters. perhaps the last 14 days".
 *
 * The overview already counts active, dormant and pending promoters. None of
 * those numbers moves visibly when somebody joins: auto-approval walks a new
 * sign-up straight past 'pending' into the 175-strong active count, and nothing
 * on the screen said fifty-one people had arrived in a fortnight.
 *
 * The half of this that matters is not the names. It is that a promoter is
 * worth nothing to the venue until they register a guest, and of the fifty-one
 * who joined in the fortnight to 8 September, one had. A bare list of recent
 * names would have shown that as fifty-one healthy-looking rows.
 *
 * Everything here is pure so the wording can be tested; the counting is done by
 * get_new_promoters() in migration 0045.
 */

export interface NewPromoterRow {
  id: string
  full_name: string
  promoter_code: string | null
  category: 'promoter' | 'dj' | 'staff' | string
  status: string
  current_tier: string
  created_at: string
  welcomed_at: string | null
  registered: number
  checked_in: number
}

export interface NewPromoterIntake {
  days: number
  since: string
  total: number
  promoters: number
  djs: number
  staff: number
  pending: number
  /** How many of the intake have registered at least one guest. */
  started: number
  /** How many have had a guest actually walk through the door. */
  checked_in_any: number
  /** The same length of window immediately before this one. */
  prior_total: number
  rows: NewPromoterRow[]
}

export const EMPTY_INTAKE: NewPromoterIntake = {
  days: 14, since: '', total: 0, promoters: 0, djs: 0, staff: 0,
  pending: 0, started: 0, checked_in_any: 0, prior_total: 0, rows: [],
}

/** Brisbane is UTC+10 all year — no daylight saving, so a fixed offset is right. */
const BNE_OFFSET_MS = 10 * 3_600_000

function brisbaneDayNumber(t: number): number {
  return Math.floor((t + BNE_OFFSET_MS) / 86_400_000)
}

/** Whole days between two instants, counted as Brisbane calendar days. */
export function daysAgo(iso: string, now: Date): number | null {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  return brisbaneDayNumber(now.getTime()) - brisbaneDayNumber(t)
}

/**
 * "today" / "yesterday" / "6 days ago".
 *
 * Deliberately calendar days, not elapsed hours: somebody who signed up at
 * 11pm last night joined "yesterday", not "9 hours ago", because that is how
 * the person reading the screen at 8am thinks about it.
 */
export function joinedLabel(iso: string, now: Date): string {
  const d = daysAgo(iso, now)
  if (d === null) return ''
  if (d <= 0) return 'today'
  if (d === 1) return 'yesterday'
  return `${d} days ago`
}

/** "fortnight" reads better than "14 days" and is what Trent asked for. */
export function windowLabel(days: number): string {
  if (days === 7) return 'week'
  if (days === 14) return 'fortnight'
  if (days === 30 || days === 31) return 'month'
  return `${days} days`
}

/** "44 promoters · 3 DJs · 4 staff" — only the parts that are not zero. */
export function intakeMix(i: Pick<NewPromoterIntake, 'promoters' | 'djs' | 'staff'>): string {
  const parts: string[] = []
  if (i.promoters > 0) parts.push(`${i.promoters} promoter${i.promoters === 1 ? '' : 's'}`)
  if (i.djs > 0) parts.push(`${i.djs} DJ${i.djs === 1 ? '' : 's'}`)
  if (i.staff > 0) parts.push(`${i.staff} staff`)
  return parts.join(' · ')
}

/**
 * How this window compares with the one before it.
 *
 * Null when there is nothing to compare against — an invented "up from 0" is
 * worse than saying nothing.
 */
export function intakeTrend(i: Pick<NewPromoterIntake, 'total' | 'prior_total' | 'days'>): string | null {
  if (i.prior_total <= 0) return null
  const before = `the ${windowLabel(i.days)} before`
  if (i.total > i.prior_total) return `up from ${i.prior_total} ${before}`
  if (i.total < i.prior_total) return `down from ${i.prior_total} ${before}`
  return `same as ${before}`
}

export interface StartedSummary {
  tone: 'warn' | 'flat' | 'good'
  text: string
}

/**
 * The line that carries the point: how many of the new people have put a guest
 * on a list.
 *
 * 'warn' when fewer than a quarter have, because that is the case where the
 * headline count is actively misleading — a fortnight of sign-ups that has
 * produced nothing looks identical to a fortnight that has produced plenty.
 */
export function startedSummary(i: Pick<NewPromoterIntake, 'total' | 'started'>): StartedSummary | null {
  if (i.total <= 0) return null
  if (i.started === 0) {
    return {
      tone: 'warn',
      text: i.total === 1
        ? 'They have not registered a guest yet.'
        : `Not one of them has registered a guest yet.`,
    }
  }
  const text = `${i.started} of ${i.total} ${i.started === 1 ? 'has' : 'have'} registered a guest.`
  if (i.started * 4 < i.total) return { tone: 'warn', text }
  if (i.started * 2 < i.total) return { tone: 'flat', text }
  return { tone: 'good', text }
}

/** What one new person has done so far, in the fewest words that stay true. */
export function activityLabel(r: Pick<NewPromoterRow, 'registered' | 'checked_in'>): string {
  if (r.registered <= 0) return 'No guests yet'
  if (r.checked_in <= 0) return `${r.registered} registered · none in`
  return `${r.registered} registered · ${r.checked_in} in`
}

/** Category shown against a name, only where it is not the ordinary case. */
export function categoryLabel(category: string): string | null {
  if (category === 'dj') return 'DJ'
  if (category === 'staff') return 'Staff'
  return null
}

/** "and 45 more" under a truncated list. Null when nothing was cut. */
export function moreLabel(total: number, shown: number): string | null {
  const rest = total - shown
  if (rest <= 0) return null
  return `and ${rest} more`
}
