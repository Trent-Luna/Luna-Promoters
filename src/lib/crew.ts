/**
 * The crew link (25 Oct 2026, migration 0053).
 *
 * A birthday / hens / bucks host gets a personal link, /c/<code>. Friends who
 * sign up through it get their own QR for the host's night and venue and join
 * the host's group, so the host can watch the list fill up on their pass.
 *
 * Trent, 25 Oct, of the bride / groom's name, the crew size and the crew link
 * left out of the first landing page build: "go ahead and build these".
 *
 * Pure: no React, no database. Tested in crew.test.ts.
 */
import type { OccasionKey } from '@/lib/occasion'

/** The deal on the landing pages is for a group of five or more. */
export const CREW_MIN = 5
/** Ten in a crew, the host included (Trent, 25 Oct: "make the limit 10"; 0054). */
export const CREW_MAX = 10

/** The stored special_occasion → the landing page it belongs to. */
export function occasionKeyFor(occasion: string | null | undefined): OccasionKey | null {
  switch (occasion) {
    case 'Birthday': return 'birthday'
    case 'Hens party': return 'hens'
    case 'Bucks party': return 'bucks'
    default: return null
  }
}

export function clampCrew(n: number): number {
  if (!Number.isFinite(n)) return CREW_MIN
  return Math.min(CREW_MAX, Math.max(1, Math.round(n)))
}

/** Crew codes are six of A–Z / 2–9 without the look-alikes (0053). */
export function isCrewCode(code: string | null | undefined): boolean {
  return /^[A-HJ-NP-Z2-9]{6}$/.test((code ?? '').trim().toUpperCase())
}

export function crewUrl(site: string, code: string): string {
  return `${site.replace(/\/+$/, '')}/c/${code}`
}

/**
 * Whose night it is, in the words the friend will read: "Jess's hens",
 * "Tom's bucks", "Sarah's birthday". The bride or groom's name when the host
 * gave one, otherwise the host's first name.
 */
export function crewTitle(c: { occasion: string | null; host_first: string; honoree_name?: string | null }): string {
  const who = (c.honoree_name || c.host_first || '').trim()
  const key = occasionKeyFor(c.occasion)
  const what = key === 'hens' ? 'hens' : key === 'bucks' ? 'bucks' : 'birthday'
  if (!who) return `The ${what}`
  return `${who}’s ${what}`
}

/** The message the host sends the group. */
export function inviteText(o: { title: string; venue: string; night: string; url: string }): string {
  return `${o.title} at ${o.venue}, ${o.night}. Get on the guest list here (takes 30 seconds, you get your own QR): ${o.url}`
}

export function whatsappHref(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`
}

/** "3 of 8 signed up" plus where the group stands against the 5+ deal. */
export function crewProgress(joined: number, crewSize: number | null | undefined): {
  line: string; total: number; target: number; dealMet: boolean; toGo: number
} {
  // The host counts toward the group of five.
  const total = Math.max(0, joined) + 1
  const target = Math.max(CREW_MIN, crewSize ?? CREW_MIN)
  const toGo = Math.max(0, CREW_MIN - total)
  return {
    total, target, toGo, dealMet: toGo === 0,
    line: `${total} of ${target} on the list`,
  }
}

/**
 * The occasion as staff see it on the door and guest list screens:
 * "Hens party · Jess · crew of 8". Just the occasion when there is nothing
 * more, which is every sign-up made before 0053.
 */
export function occasionTag(occasion: string | null | undefined, honoree?: string | null, crewSize?: number | null): string {
  if (!occasion) return ''
  return [occasion, (honoree ?? '').trim() || null, crewSize ? `crew of ${crewSize}` : null].filter(Boolean).join(' · ')
}
