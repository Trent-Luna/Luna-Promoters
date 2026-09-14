/**
 * Which nights a venue actually opens its doors.
 *
 * Trent, 14 Sep 2026: "theres birthdays going to guestlists on nights were not
 * open" — then "su casa does not trade tuesday. fix that as well."
 *
 * THE DATABASE IS THE AUTHORITY, not this file. `venue_trades()` in migration
 * 0046 is what actually refuses a closed night, and it refuses it for all four
 * entry points at once. Everything here exists so a form can show the guest the
 * right nights BEFORE they type their name — a date input that silently accepts
 * a Tuesday and then errors on submit is a worse version of the same bug.
 *
 * DAY NUMBERS are Postgres `extract(dow)`: 0 Sun, 1 Mon … 6 Sat, so the array
 * that arrives from `get_promoter_link` needs no translation.
 *
 * WHY EVERY DATE IS PARSED AT NOON. `new Date('2026-09-15')` is UTC midnight,
 * which in Brisbane is 10am the same day — but in any timezone west of UTC it
 * is the PREVIOUS day, and `.getDay()` then returns the wrong weekday. Noon is
 * far enough from both edges that no offset on earth can move it across a date
 * boundary. This is the single most common way weekday logic breaks.
 */

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
export const DAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const

/** Every night, when a venue has not said otherwise. Matches the column default. */
export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]

export interface Blackout { venue_id: string | null; date: string }

const ISO = /^\d{4}-\d{2}-\d{2}$/

/** The weekday of a YYYY-MM-DD string, read as a calendar day rather than an instant. */
export function dowOf(iso: string): number {
  if (!ISO.test(iso)) return -1
  return new Date(`${iso}T12:00:00`).getDay()
}

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Today in the venue's own terms. Brisbane is UTC+10, fixed — no DST to chase. */
export function venueToday(now: Date = new Date()): string {
  return new Date(now.getTime() + 10 * 3600_000).toISOString().slice(0, 10)
}

/** "Friday 18 September" — what a guest recognises, not 2026-09-18. */
export function prettyNight(iso: string): string {
  if (!ISO.test(iso)) return iso
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

/** "Fri 18 Sep" — the compact form, for a list of options. */
export function shortNight(iso: string): string {
  if (!ISO.test(iso)) return iso
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-AU', {
    weekday: 'short', day: 'numeric', month: 'short',
  })
}

/**
 * Are the doors open?
 *
 * Two questions, and both have to be asked. A trading day says "we open
 * Wednesdays"; a blackout says "not THIS Wednesday". Asking only the first is
 * how a guest gets a QR code for a night the venue is closed for a private
 * function.
 *
 * An empty or missing `tradingDays` means every night — the same permissive
 * default the column carries, so a venue nobody has configured behaves exactly
 * as it did before this existed.
 */
export function tradesOn(
  iso: string,
  tradingDays: number[] | null | undefined,
  blackouts: Blackout[] = [],
  venueId?: string | null,
): boolean {
  const dow = dowOf(iso)
  if (dow < 0) return false
  const days = tradingDays && tradingDays.length ? tradingDays : ALL_DAYS
  if (!days.includes(dow)) return false
  return !blackouts.some((b) => b.date === iso && (b.venue_id === null || b.venue_id === venueId))
}

/**
 * The next night this venue is open, counting `from` itself.
 *
 * This is the whole point of the exercise: a guest told "we're shut" and
 * nothing else goes elsewhere. A guest told "we're shut, but we're open
 * Friday" comes on Friday.
 *
 * Returns null when nothing opens inside the window, which is a real answer —
 * a venue closed for a fortnight's refurbishment should not silently push a
 * birthday two months out.
 */
export function nextTradingNight(
  from: string,
  tradingDays: number[] | null | undefined,
  blackouts: Blackout[] = [],
  venueId?: string | null,
  within = 21,
): string | null {
  for (let i = 0; i <= within; i++) {
    const d = addDays(from, i)
    if (tradesOn(d, tradingDays, blackouts, venueId)) return d
  }
  return null
}

/** Every open night in a window, inclusive. Capped so a bad input cannot loop forever. */
export function tradingNightsBetween(
  from: string,
  to: string,
  tradingDays: number[] | null | undefined,
  blackouts: Blackout[] = [],
  venueId?: string | null,
): string[] {
  const out: string[] = []
  for (let i = 0; i <= 400; i++) {
    const d = addDays(from, i)
    if (d > to) break
    if (tradesOn(d, tradingDays, blackouts, venueId)) out.push(d)
  }
  return out
}

/**
 * The fortnight a birthday guest gets to choose from.
 *
 * Trent, 14 Sep 2026: "they should have a date picker within 14 days for them
 * to choose for their birthdays."
 *
 * ANCHORED ON THE BIRTHDAY WHEN THERE IS ONE, because that is the night they
 * care about being near. A guest whose birthday is three weeks out should be
 * choosing from the nights around it, not from this week. When the birthday has
 * already passed this year — or there is no date of birth on file — the anchor
 * is today, which is the walk-up case and the only sensible fallback.
 *
 * Never starts before today: nobody can be added to last Friday.
 */
export function birthdayWindow(
  dob: string | null | undefined,
  today: string,
  days = 14,
): { from: string; to: string } {
  let anchor = today
  if (dob && ISO.test(dob)) {
    const year = Number(today.slice(0, 4))
    const md = dob.slice(5)
    // 29 Feb in a non-leap year lands on 1 Mar, which is the convention every
    // licensing venue already uses for an ID check.
    const thisYear = `${year}-${md}`
    const next = thisYear >= today ? thisYear : `${year + 1}-${md}`
    const parsed = new Date(`${next}T12:00:00`)
    if (!Number.isNaN(parsed.getTime())) {
      anchor = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`
    }
  }
  const from = anchor < today ? today : anchor
  return { from, to: addDays(from, days) }
}

/** "Fri, Sat & Sun" — how a venue's week reads in a sentence. */
export function tradingDaysLabel(tradingDays: number[] | null | undefined): string {
  const days = tradingDays && tradingDays.length ? [...tradingDays] : ALL_DAYS
  if (days.length === 7) return 'every night'
  // Weeks read Monday-first to a human even though the numbers are Sunday-first.
  const ordered = days.slice().sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
  const names = ordered.map((d) => DAY_NAMES[d])
  if (names.length === 1) return names[0]
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`
}
