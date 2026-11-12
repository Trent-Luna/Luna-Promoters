/**
 * Promoter-run nights that recruit their own promoters.
 *
 * Trent, 12 Nov 2026: Sonda Sounds runs Fridays at Eclipse, and its What's On
 * page (reservations.lunagroup.com.au/on/sonda) needs "sign up as a sonda
 * promoter". That button opens this app's application at `/?v=sonda`: the
 * page reads as Sonda's and the application records Sonda as the applicant's
 * preferred venue, so the team can see who came for which night.
 *
 * Only slugs listed here are honoured. Anything else in `?v=` is ignored and
 * the page is the group application, exactly as before.
 */

export interface PromoterNight {
  /** venues.slug, and the `?v=` value. */
  slug: string
  name: string
  /** One line under the heading. */
  where: string
  /** Who reviews the application, as the form says it. */
  team: string
  /** The night's own look: a `.skin-<slug>` block in globals.css, its logos. */
  skin: string
  wordmark: string
  mark: string
}

export const PROMOTER_NIGHTS: Record<string, PromoterNight> = {
  sonda: {
    slug: 'sonda',
    name: 'Sonda Sounds',
    where: 'Every Friday at Eclipse, Fortitude Valley.',
    team: 'the Sonda Sounds and Eclipse team',
    skin: 'skin-sonda',
    wordmark: '/brand/sonda/wordmark.png',
    mark: '/brand/sonda/s-mark.png',
  },
}

export function promoterNightFor(v: string | null | undefined): PromoterNight | null {
  const key = (v ?? '').trim().toLowerCase()
  return Object.prototype.hasOwnProperty.call(PROMOTER_NIGHTS, key) ? PROMOTER_NIGHTS[key] : null
}
