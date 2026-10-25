/**
 * The Meta ad landing pages for birthdays, hens and bucks (24 Oct 2026).
 *
 * Trent, 23 Oct: "Can you mock up a new landing page for meta for our birthday
 * hens and bucks sign ups rather than just generic guest list" — a separate
 * page per occasion so each ad lands on its own; the nightclubs only ("Remove
 * the restaurant offering please"); hens and bucks get the same deal as
 * birthdays. Then: "Go ahead and build these".
 *
 *   guestlist.lunagroup.com.au/birthday
 *   guestlist.lunagroup.com.au/hens
 *   guestlist.lunagroup.com.au/bucks
 *
 * Each is the ordinary Luna guest list (promoter code `luna`, every venue it
 * offers) with the occasion already chosen, so the registration, the trading
 * nights, the cut-offs, the QR pass and the occasion deal in the confirmation
 * email are exactly the ones the guest list has always used. The deal wording
 * here is the one that email already sends (lib/occasion-packages.ts), so the
 * page and the email never promise different things.
 *
 * Pure: no React, no database. Tested in occasion.test.ts.
 */

export type OccasionKey = 'birthday' | 'hens' | 'bucks'

export interface OccasionCopy {
  key: OccasionKey
  /** The exact `special_occasion` value the form stores (and the email keys on). */
  formValue: 'Birthday' | 'Hens party' | 'Bucks party'
  /** For `occasionFromHint` in the form. */
  hint: string
  accent: string
  accentInk: string
  /** The gold/rose/sky gradient on the deal ticket. */
  ticket: string
  hero: string
  kicker: string
  h1: string
  h1b: string
  intro: string
  honour: string
  /** The bride / groom field on the form (migration 0053); null on birthdays. */
  honoreeLabel: string | null
  formTitle: string
  cta: string
  step3: string
  boothTitle: string
  /** <title> and the link preview on Meta / WhatsApp. */
  metaTitle: string
  metaDescription: string
}

const DEAL = 'free entry for the group before 10:30pm and a complimentary all-night VIP wristband'

export const OCCASIONS: Record<OccasionKey, OccasionCopy> = {
  birthday: {
    key: 'birthday', formValue: 'Birthday', hint: 'birthday',
    accent: '#E7C873', accentInk: '#15131F',
    ticket: 'linear-gradient(135deg, #F1D88C 0%, #D9B45E 45%, #B88A33 100%)',
    hero: '/brand/email/hero-afterdark.jpg',
    kicker: 'Birthday sign-up', h1: 'Your birthday', h1b: 'is on us.',
    intro: `Bring five or more of your crew to any Luna club: ${DEAL} for you.`,
    honour: 'you', honoreeLabel: null,
    formTitle: 'Lock in your birthday', cta: 'Claim my birthday deal',
    step3: 'The birthday person gets the VIP wristband on the night.',
    boothTitle: 'Going big for your birthday?',
    metaTitle: 'Your birthday is on us · Luna Group',
    metaDescription: 'Free entry for your crew before 10:30pm and a VIP wristband for the birthday person, at Luna Group clubs in Brisbane and the Gold Coast.',
  },
  hens: {
    key: 'hens', formValue: 'Hens party', hint: 'hens',
    accent: '#F4A9C8', accentInk: '#2A0F1C',
    ticket: 'linear-gradient(135deg, #FBD3E3 0%, #F2A3C3 48%, #D97AA3 100%)',
    hero: '/brand/email/hero-sucasa.jpg',
    kicker: 'Hens party sign-up', h1: 'Hens night', h1b: 'sorted.',
    intro: `Bring five or more of the girls to any Luna club: ${DEAL} for the bride.`,
    honour: 'the bride', honoreeLabel: 'The bride’s name',
    formTitle: 'Lock in the hens', cta: 'Lock in the hens',
    step3: 'The bride gets the VIP wristband on the night.',
    boothTitle: 'Want your own space for the hens?',
    metaTitle: 'Hens night, sorted · Luna Group',
    metaDescription: 'Free entry for the girls before 10:30pm and a VIP wristband for the bride, at Luna Group clubs in Brisbane and the Gold Coast.',
  },
  bucks: {
    key: 'bucks', formValue: 'Bucks party', hint: 'bucks',
    accent: '#8FCBFF', accentInk: '#0A1B2B',
    ticket: 'linear-gradient(135deg, #CFE8FF 0%, #94CBFA 48%, #5E9FDA 100%)',
    hero: '/brand/email/hero-pump.jpg',
    kicker: 'Bucks party sign-up', h1: 'Bucks night', h1b: 'sorted.',
    intro: `Bring five or more of the boys to any Luna club: ${DEAL} for the groom.`,
    honour: 'the groom', honoreeLabel: 'The groom’s name',
    formTitle: 'Lock in the bucks', cta: 'Lock in the bucks',
    step3: 'The groom gets the VIP wristband on the night.',
    boothTitle: 'Want your own space for the bucks?',
    metaTitle: 'Bucks night, sorted · Luna Group',
    metaDescription: 'Free entry for the boys before 10:30pm and a VIP wristband for the groom, at Luna Group clubs in Brisbane and the Gold Coast.',
  },
}

/**
 * The logo on each club's tile, by venue NAME — the guest list RPC returns
 * ids and names, and the names are what every other lookup in this app keys
 * on (see meta-pixel.ts). After Dark is tested before Eclipse because its name
 * contains "Eclipse". A venue with no logo here gets a name tile.
 *
 * Logos, not photos: Trent, 25 Oct 2026, "lets use the logos for the venues
 * not photos". The same white-on-transparent logos the branded emails and
 * passes use.
 */
const TILES: { match: RegExp; img: string }[] = [
  { match: /after\s*dark/i, img: '/brand/email/logo-afterdark.png' },
  { match: /eclipse/i, img: '/brand/email/logo-eclipse.png' },
  { match: /su\s*casa/i, img: '/brand/email/logo-sucasa.png' },
  { match: /pump/i, img: '/brand/email/logo-pump.png' },
  { match: /mamacita/i, img: '/brand/email/logo-mamacita.png' },
]

/**
 * Clubs left off these pages. Trent, 25 Oct 2026: "can you remove silk from
 * this?" Silk (and Silk Saturdays) stay on the ordinary Luna guest list and
 * every promoter link; only the birthday / hens / bucks pages leave them out.
 */
const NOT_ON_OCCASION_PAGES = /silk/i

export function onOccasionPages(name: string | null | undefined): boolean {
  return !!name && !NOT_ON_OCCASION_PAGES.test(name)
}

export function tileFor(name: string | null | undefined): string | null {
  if (!name) return null
  return TILES.find(t => t.match.test(name))?.img ?? null
}

/**
 * The source recorded on each registration, so My Link and the weekly report
 * can tell these sign-ups apart: `?src=` when the ad sets one (a short slug,
 * the same rule as promoter links), otherwise `meta-<occasion>` when the visit
 * came from Facebook or Instagram (an `fbclid`, or a utm_source naming them),
 * otherwise `lp-<occasion>`.
 */
export function sourceFor(
  key: OccasionKey,
  q: { src?: string | null; fbclid?: string | null; utm_source?: string | null },
): string {
  const src = (q.src ?? '').trim()
  if (src && /^[a-z0-9][a-z0-9-]{0,39}$/i.test(src)) return src.toLowerCase()
  const utm = (q.utm_source ?? '').toLowerCase()
  if (q.fbclid || /facebook|instagram|^fb$|^ig$|meta/.test(utm)) return `meta-${key}`
  return `lp-${key}`
}

/**
 * The Luna Group dataset (lunagroup.com.au's pixel). These pages are for ads
 * that sell every club at once, so they fire PageView and Lead to the group
 * dataset as well as to the chosen venue's own pixel where it has one (Pump,
 * Mamacita, Su Casa — meta-pixel.ts).
 *
 * The guest picks a club, and that club's name is what pixelForVenue matches
 * ("Su Casa Brisbane" and "SuCasa" both hit Su Casa). The page opens with no
 * club selected, so Su Casa's dataset also loads with the page
 * (SU_CASA_PIXEL): PageView immediately, and Lead with the pass token on
 * every sign-up. When the chosen club is Su Casa the form sends that Lead
 * once. Crew links pass venues.name into pixelForVenue and keep GROUP_PIXEL
 * as their extra.
 */
export const GROUP_PIXEL = '339963945485464'

/** Su Casa Brisbane dataset. Same id as the `/su ?casa/i` entry in meta-pixel.ts. */
export const SU_CASA_PIXEL = '785459746721078'
