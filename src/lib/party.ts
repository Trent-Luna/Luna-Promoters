/**
 * Party nights (14 Oct 2026). A one-off night with its own look where a guest
 * registers and brings up to N friends on the same QR.
 *
 * Trent: "setup a qr code in our sign ups and qr codes to register their name
 * and up to plus 4 for our upcoming su casa 10k instagram followers party".
 * The first one is the Su Casa 10K Party, Friday 13 November 2026 from 6pm.
 *
 * The look and words live on events.party (migration 0051), so the next party
 * is a row, not a deploy. Everything here is pure: the server and the screens
 * share it, and tests cover it.
 */

export interface PartyLook {
  /** The big word on the hero: "10K". */
  kicker?: string | null
  /** Under it: "Thank you party". */
  tagline?: string | null
  /** One sentence for the sign-up page and the email. */
  lede?: string | null
  /** What guests get. Hidden when empty. */
  included?: string | null
  /** Confirmation and day-of texts. Off until Trent approves the wording. */
  sms?: boolean | null
}

export interface PartyNight {
  event_id: string
  name: string
  event_date: string
  start_time: string | null
  end_time: string | null
  max_plus_ones: number
  party: PartyLook | null
  venue_slug: string | null
  venue_name: string | null
}

/** The most friends one registration may bring, whatever the row says. */
export const PARTY_MAX = 10

export function clampPlusOnes(n: unknown, allowed: number): number {
  const cap = Math.max(0, Math.min(PARTY_MAX, Math.floor(Number(allowed) || 0)))
  const v = Math.floor(Number(n) || 0)
  return Math.max(0, Math.min(v, cap))
}

/** Friends' names as typed: trimmed, blanks dropped, no more than the plus-ones. */
export function cleanNames(names: readonly (string | null | undefined)[] | null | undefined, plusOnes: number): string[] {
  return (names ?? [])
    .map((n) => String(n ?? '').replace(/\s+/g, ' ').trim().slice(0, 40))
    .filter(Boolean)
    .slice(0, Math.max(0, plusOnes))
}

/** "Mia, Sam and Priya" — or '' when nobody was named. */
export function namesLine(names: readonly string[] | null | undefined): string {
  const n = (names ?? []).filter(Boolean)
  if (n.length === 0) return ''
  if (n.length === 1) return n[0]
  return `${n.slice(0, -1).join(', ')} and ${n[n.length - 1]}`
}

/** "+3 guests", "+1 guest", '' for nobody. */
export function plusLabel(plusOnes: number | null | undefined): string {
  const n = Math.max(0, Number(plusOnes) || 0)
  return n === 0 ? '' : `+${n} guest${n === 1 ? '' : 's'}`
}

/** "you and 3 friends", "you and a friend", "you". */
export function groupPhrase(plusOnes: number | null | undefined): string {
  const n = Math.max(0, Number(plusOnes) || 0)
  if (n === 0) return 'you'
  if (n === 1) return 'you and a friend'
  return `you and ${n} friends`
}

/** "6pm", "6:30pm" from "18:00:00". */
export function shortTime(t: string | null | undefined): string {
  if (!t) return ''
  const [h, m] = t.split(':').map((x) => parseInt(x, 10))
  if (Number.isNaN(h)) return ''
  const ap = h >= 12 ? 'pm' : 'am'
  const h12 = h % 12 || 12
  return m ? `${h12}:${String(m).padStart(2, '0')}${ap}` : `${h12}${ap}`
}

/** "Fri 13 Nov" for texts. */
export function shortNight(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z')
  return d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).replace(/,/g, '')
}

// ── Door ────────────────────────────────────────────────────────────────────

/** Heads in for a row: the admitted count when a group came in parts, else the whole party. */
export function headsIn(plusOnes: number | null | undefined, admitted: number | null | undefined): number {
  const party = 1 + Math.max(0, Number(plusOnes) || 0)
  if (admitted == null) return party
  return Math.max(1, Math.min(party, Number(admitted) || 1))
}

// ── Texts ───────────────────────────────────────────────────────────────────
// Transactional: they confirm what the guest asked for. No marketing in them.

export interface TextInput {
  first: string
  eventName: string
  eventDate: string
  startTime: string | null
  plusOnes: number
  passUrl: string
}

export function confirmationText(i: TextInput): string {
  const who = i.plusOnes > 0 ? ` (+${i.plusOnes})` : ''
  return `You're on the list for the ${i.eventName}, ${i.first}${who}. ${shortNight(i.eventDate)}${i.startTime ? ` from ${shortTime(i.startTime)}` : ''}. Your pass: ${i.passUrl}`
}

export function reminderText(i: TextInput): string {
  const group = i.plusOnes > 0 ? ` One scan lets your group of ${1 + i.plusOnes} in.` : ''
  return `Tonight! ${i.eventName}${i.startTime ? ` from ${shortTime(i.startTime)}` : ''}. Bring ID and show your pass at the door: ${i.passUrl}${group}`
}

/** Brisbane's calendar date and hour now (no daylight saving in Queensland). */
export function brisbaneNow(now: Date = new Date()): { date: string; hour: number } {
  const b = new Date(now.getTime() + 10 * 3600_000)
  return { date: b.toISOString().slice(0, 10), hour: b.getUTCHours() }
}

/** The day-of reminder goes on the night itself, from 2pm. */
export const REMINDER_FROM_HOUR = 14
export function reminderDue(eventDate: string, now: Date = new Date()): boolean {
  const b = brisbaneNow(now)
  return b.date === eventDate && b.hour >= REMINDER_FROM_HOUR
}
