/**
 * The nightly guest list cut-off, as the browser sees it.
 *
 * Trent, 8 Oct 2026: "i need to make sure that the guest list for pump only
 * runs till 11pm strictly and mamacita 10:30".
 *
 * The database is the authority (public.guestlist_cutoff, used by
 * register_guest_vd and door_check_in). These helpers only let the screens say
 * so before the server has to: the sign-up form stops offering tonight, the
 * pass tells the guest when to arrive, and the door refuses a tap made offline.
 *
 * `until` is venues.guestlist_until as Postgres returns it ("23:00:00"). A
 * time before 6am belongs to the same trading night, after midnight. Brisbane
 * is UTC+10 all year (Queensland has no daylight saving), so the arithmetic is
 * fixed rather than going through a timezone database. Australia/Brisbane is
 * that fixed offset.
 *
 * events.cutoff_at, when a night has one, is an absolute instant and wins over
 * the venue time — the same order as public.guestlist_cutoff. Screens format
 * that instant in Australia/Brisbane. A night with neither stays open, and a
 * night with only the venue time is unchanged.
 */

const BRISBANE_OFFSET_MS = 10 * 3600_000

function parse(until: string | null | undefined): { h: number; m: number } | null {
  if (!until) return null
  const m = /^(\d{1,2}):(\d{2})/.exec(until)
  if (!m) return null
  const h = Number(m[1]), min = Number(m[2])
  if (h > 23 || min > 59) return null
  return { h, m: min }
}

/** The moment the list closes for the night of `night` (YYYY-MM-DD), or null. */
export function cutoffInstant(night: string, until: string | null | undefined): Date | null {
  const t = parse(until)
  if (!t || !/^\d{4}-\d{2}-\d{2}$/.test(night)) return null
  const midnight = Date.parse(`${night}T00:00:00Z`) - BRISBANE_OFFSET_MS
  const dayOffset = t.h < 6 ? 1 : 0
  return new Date(midnight + (dayOffset * 24 + t.h) * 3600_000 + t.m * 60_000)
}

/** True once that night's guest list has closed. No cut-off means never. */
export function guestlistClosed(night: string, until: string | null | undefined, now: Date = new Date()): boolean {
  const c = cutoffInstant(night, until)
  return !!c && now.getTime() >= c.getTime()
}

/** "11pm", "10:30pm", "12:30am". Null when there is no cut-off. Minutes show when they are not zero. */
export function cutoffLabel(until: string | null | undefined): string | null {
  const t = parse(until)
  if (!t) return null
  const suffix = t.h < 12 ? 'am' : 'pm'
  const h12 = t.h % 12 === 0 ? 12 : t.h % 12
  return t.m === 0 ? `${h12}${suffix}` : `${h12}:${String(t.m).padStart(2, '0')}${suffix}`
}

function instantMs(iso: string | null | undefined): number | null {
  if (!iso) return null
  const direct = Date.parse(iso)
  if (!Number.isNaN(direct)) return direct
  const normalised = Date.parse(iso.trim().replace(' ', 'T'))
  return Number.isNaN(normalised) ? null : normalised
}

/**
 * The same label as cutoffLabel, for an absolute instant (events.cutoff_at or
 * guestlist_closes_at), read in Australia/Brisbane.
 */
export function cutoffLabelFromInstant(iso: string | null | undefined): string | null {
  const ms = instantMs(iso)
  if (ms == null) return null
  const brisbane = new Date(ms + BRISBANE_OFFSET_MS)
  const h = brisbane.getUTCHours()
  const m = brisbane.getUTCMinutes()
  return cutoffLabel(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
}

/** Event instant when the night has one, otherwise the venue's nightly time. */
export function nightCutoffLabel(
  venueUntil: string | null | undefined,
  eventCutoffAt: string | null | undefined,
): string | null {
  return cutoffLabelFromInstant(eventCutoffAt) ?? cutoffLabel(venueUntil)
}

/**
 * True once that night's list has closed. An event cutoff instant wins; with
 * none, the venue time applies. Neither means the night stays open.
 */
export function nightListClosed(
  night: string,
  venueUntil: string | null | undefined,
  eventCutoffAt: string | null | undefined,
  now: Date = new Date(),
): boolean {
  const ms = instantMs(eventCutoffAt)
  if (ms != null) return now.getTime() >= ms
  return guestlistClosed(night, venueUntil, now)
}
