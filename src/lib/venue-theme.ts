/**
 * Each venue's own look for the guest list confirmation email and the pass
 * page (/g/[token]).
 *
 * Trent, 8 Oct 2026: "i feel like we can do better branding designs on these
 * now for the group" → mock-ups → test send → "these look great! roll these out".
 *
 * Colours and type match the Reservations What's On venue themes
 * (luna-bookings-app1 src/lib/venue-on.ts), so the QR poster, the What's On
 * page, this email and the pass all read as the same venue. Images live in
 * this app's public/brand/email so they ship with it.
 *
 * Keyed on venues.slug. A venue with no theme (Silk) keeps the original Luna
 * Group email and pass, unchanged.
 */

export interface VenueTheme {
  /** The name guests know it by, on the ticket and in the subject. */
  short: string
  /** Its What's On page: reservations.lunagroup.com.au/on/<onKey>. */
  onKey: string
  bg: string
  ink: string
  acc: string
  accInk: string
  /** CSS font stacks. Web fonts where the client allows, fallbacks elsewhere. */
  head: string
  headW: number
  headCase: 'uppercase' | 'none'
  headTrack: string
  body: string
  num: string
  numW: number
  /** Headline size in px on the email. */
  h1: number
  /** Button radius in px (999 = pill). */
  rad: number
  btnCase: 'uppercase' | 'none'
  /** Header photo path under the site, or null for a colour header. */
  hero: string | null
  heroPos?: string
  /** Fallback colour and CSS gradient for a header with no photo. */
  heroColor?: string
  heroGrad?: string
  /** How dark to wash the photo behind the logo (0..1). */
  heroDim?: number
  logo: string
  logoW: number
  boothT: string
  boothP: string
}

const R = 'https://reservations.lunagroup.com.au'
export const RESERVATIONS = R

export const THEMES: Record<string, VenueTheme> = {
  'pump-nightclub': {
    short: 'Pump', onKey: 'pump',
    bg: '#0A0A0B', ink: '#F1F1F1', acc: '#F4281C', accInk: '#FFFFFF',
    head: "'Archivo Black','Arial Black',Arial,sans-serif", headW: 400, headCase: 'uppercase', headTrack: '0.01em',
    body: "'Archivo Narrow','Arial Narrow',Arial,sans-serif", num: "'Archivo Black','Arial Black',Arial,sans-serif", numW: 400,
    h1: 30, rad: 4, btnCase: 'uppercase',
    hero: '/brand/email/hero-pump.jpg', logo: '/brand/email/logo-pump.png', logoW: 260,
    boothT: 'VIP booths from $350', boothP: 'Skip the line with the group. Bottles to the booth.',
  },
  'mamacita-nightclub': {
    short: 'Mamacita', onKey: 'mamacita',
    bg: '#120A0E', ink: '#FCEFF3', acc: '#F83460', accInk: '#FFFFFF',
    head: "'Dancing Script','Brush Script MT',cursive", headW: 700, headCase: 'none', headTrack: '0',
    body: "Quicksand,'Trebuchet MS',Arial,sans-serif", num: "Quicksand,'Trebuchet MS',Arial,sans-serif", numW: 700,
    h1: 40, rad: 999, btnCase: 'none',
    hero: null, heroColor: '#4a1028',
    heroGrad: 'radial-gradient(120% 90% at 20% 0%, #F83460 0%, rgba(248,52,96,0) 55%), radial-gradient(90% 80% at 95% 20%, #8F1D52 0%, rgba(143,29,82,0) 60%)',
    heroDim: 0, logo: '/brand/email/logo-mamacita.png', logoW: 280,
    boothT: 'Make it a booth', boothP: 'Birthday, hens or just the girls. We will look after the table.',
  },
  'eclipse': {
    short: 'Eclipse', onKey: 'eclipse',
    bg: '#07080B', ink: '#EDEAE2', acc: '#E7C873', accInk: '#07080B',
    head: "Jost,'Century Gothic',Futura,Arial,sans-serif", headW: 300, headCase: 'uppercase', headTrack: '0.18em',
    body: "Jost,'Century Gothic',Arial,sans-serif", num: "Jost,'Century Gothic',Arial,sans-serif", numW: 300,
    h1: 26, rad: 2, btnCase: 'uppercase',
    hero: '/brand/email/hero-eclipse.jpg', logo: '/brand/email/logo-eclipse.png', logoW: 260,
    boothT: 'Book a VIP booth', boothP: 'A booth on the floor for the group, bottle service to the table.',
  },
  'eclipse-afterdark': {
    short: 'After Dark', onKey: 'after-dark',
    bg: '#0A0707', ink: '#F2ECEC', acc: '#D0343A', accInk: '#FFFFFF',
    head: "'Archivo Narrow','Arial Narrow',Arial,sans-serif", headW: 700, headCase: 'uppercase', headTrack: '0.04em',
    body: "'Archivo Narrow','Arial Narrow',Arial,sans-serif", num: "'Archivo Narrow','Arial Narrow',Arial,sans-serif", numW: 700,
    h1: 34, rad: 3, btnCase: 'uppercase',
    hero: '/brand/email/hero-afterdark.jpg', heroPos: 'center 35%', logo: '/brand/email/logo-afterdark.png', logoW: 280,
    boothT: 'Book a VIP booth', boothP: 'Your own corner of After Dark for the night.',
  },
  'su-casa-brisbane': {
    short: 'Su Casa', onKey: 'su-casa',
    bg: '#0B0812', ink: '#F0EDF8', acc: '#A78BFA', accInk: '#0B0812',
    head: "'Josefin Sans','Century Gothic',Arial,sans-serif", headW: 700, headCase: 'uppercase', headTrack: '0.12em',
    body: "'Josefin Sans','Century Gothic',Arial,sans-serif", num: "'Josefin Sans','Century Gothic',Arial,sans-serif", numW: 600,
    h1: 26, rad: 999, btnCase: 'uppercase',
    hero: '/brand/email/hero-sucasa.jpg', logo: '/brand/email/logo-sucasa.png', logoW: 240,
    boothT: 'Book a VIP booth', boothP: 'Nightclub or rooftop. Bottles to the booth.',
  },
}

/** The sister venues, in the order the footer lists them. */
export const SISTERS = ['Eclipse', 'After Dark', 'Su Casa', 'Pump', 'Mamacita']

export const THEME_FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Archivo+Black&family=Archivo+Narrow:wght@500;700&family=Dancing+Script:wght@700&family=Josefin+Sans:wght@400;600;700&family=Jost:wght@300;400;600&family=Quicksand:wght@500;700&display=swap'

export function themeFor(slug: string | null | undefined): VenueTheme | null {
  return (slug && THEMES[slug]) || null
}

// ── colour helpers ───────────────────────────────────────────────────────────
function hex(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16)
  return [n >> 16, (n >> 8) & 255, n & 255]
}
/** a mixed toward b by t (0..1), as #rrggbb. */
export function mix(a: string, b: string, t: number): string {
  const x = hex(a), y = hex(b)
  return '#' + x.map((v, i) => Math.round(v * (1 - t) + y[i] * t).toString(16).padStart(2, '0')).join('')
}
export function rgba(h: string, a: number): string {
  const [r, g, b] = hex(h)
  return `rgba(${r},${g},${b},${a})`
}
/** Panel, line and muted text derived from the venue's ground and ink. */
export function tones(t: VenueTheme) {
  return { panel: mix(t.bg, t.ink, 0.10), line: mix(t.bg, t.ink, 0.22), muted: mix(t.bg, t.ink, 0.66) }
}

// ── the night, in the ticket's terms ─────────────────────────────────────────
const DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

/** "2026-10-09" → { dow: 'FRI', day: '09', mon: 'OCT', night: 'Friday 9 October', ymd: '20261009' } */
export function nightParts(iso: string) {
  const d = new Date(iso + 'T00:00:00Z')
  return {
    dow: DOW[d.getUTCDay()],
    day: String(d.getUTCDate()).padStart(2, '0'),
    mon: MON[d.getUTCMonth()],
    night: d.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }),
    ymd: iso.replace(/-/g, ''),
  }
}
