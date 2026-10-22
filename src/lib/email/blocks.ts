/**
 * Email-safe building blocks for the guest list app's emails.
 *
 * Trent approved the redesign mock-ups on 22 Oct 2026 ("These all look great
 * and happy to roll out"). One skeleton, a skin per venue: the five clubs come
 * from venue-theme.ts, and everything that is not one venue's (university
 * members, promoters) wears the Luna Group skin.
 *
 * Tables and inline styles only. The frame is fluid up to 600px, so it is the
 * phone's full width on a phone, and Outlook is held at 600px by conditional
 * comments. Buttons are inline-block wrappers: two sit side by side on a
 * desktop and stack on a phone instead of pushing the email wider than the
 * screen. The preheader is hidden.
 *
 * Text arguments are HTML: callers pass guest data through esc() first.
 * Links and image URLs are escaped here, where they become attributes.
 *
 * Pure on purpose (no server-only imports), so the tests render every email.
 */
import { mix, rgba, SISTERS, THEME_FONTS_URL, type VenueTheme } from '@/lib/venue-theme'

/** The group line. Trent, 22 Oct 2026: club emails use the group number. */
export const GROUP_PHONE = '(07) 3213 0000'

export const DEFAULT_SITE = 'https://promoter.lunagroup.com.au'

/** This app's public origin, for absolute image and page links in email. */
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE).replace(/\/$/, '')
}

export interface EmailSkin {
  /** Alt text for the logo. */
  name: string
  /** The name guests know it by; bold in the footer's venue list. */
  short: string
  kind: 'club' | 'group'
  bg: string
  ink: string
  acc: string
  accInk: string
  head: string
  headW: number
  headCase: 'uppercase' | 'none'
  headTrack: string
  body: string
  num: string
  numW: number
  label: string
  h1: number
  /** Button radius in px; 999 is a pill. */
  rad: number
  btnCase: 'uppercase' | 'none'
  /** Absolute URLs. A club with no photo uses heroColor and heroGrad. */
  hero: string | null
  heroPos?: string
  heroColor?: string
  heroGrad?: string
  heroDim?: number
  outlookHero?: string | null
  logo: string
  logoW: number
  footerLogo: string
  fonts: string | null
  /** Set for the group skin; derived from bg, ink and acc for the clubs. */
  panel?: string
  line?: string
  muted?: string
  tint?: string
}

export type Link = readonly [label: string, href: string]

export const LUNA_FROM = 'Luna Group <noreply@lunagroup.com.au>'

/** "Pump Nightclub <noreply@lunagroup.com.au>": the guest sees the venue. */
export function venueFrom(venueName: string | null | undefined): string {
  const name = String(venueName ?? '').replace(/[<>"\r\n]/g, '').trim() || 'Luna Group'
  return `${name} <noreply@lunagroup.com.au>`
}

// ── text ─────────────────────────────────────────────────────────────────────
export function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** "2026-10-30" → "Friday 30 October". */
export function nightLabel(iso: string): string {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC',
  })
}

// ── skins ────────────────────────────────────────────────────────────────────
/**
 * A club's email skin from its venue theme. The approved mock-up set each
 * club's email headline 2px larger than the pass page uses, so the email adds
 * it here rather than changing the shared theme.
 */
export function clubSkin(t: VenueTheme, site: string, name?: string | null): EmailSkin {
  const abs = (p: string) => `${site.replace(/\/$/, '')}${p}`
  return {
    name: (name || '').trim() || t.short,
    short: t.short,
    kind: 'club',
    bg: t.bg, ink: t.ink, acc: t.acc, accInk: t.accInk,
    head: t.head, headW: t.headW, headCase: t.headCase, headTrack: t.headTrack,
    body: t.body, num: t.num, numW: t.numW, label: t.body,
    h1: t.h1 + 2, rad: t.rad, btnCase: t.btnCase,
    hero: t.hero ? abs(t.hero) : null,
    heroPos: t.heroPos, heroColor: t.heroColor, heroGrad: t.heroGrad, heroDim: t.heroDim,
    outlookHero: abs(t.outlookHero),
    logo: abs(t.logo), logoW: t.logoW,
    footerLogo: abs('/luna-group-white.png'),
    fonts: THEME_FONTS_URL,
  }
}

const SANS = "'Helvetica Neue',Helvetica,Arial,sans-serif"

/** The Luna Group skin, for anything that is not one venue's. */
export function lunaSkin(site: string): EmailSkin {
  const logo = `${site.replace(/\/$/, '')}/luna-group-white.png`
  return {
    name: 'Luna Group', short: 'Luna Group', kind: 'group',
    bg: '#0B0A12', ink: '#F2F0F8', acc: '#E7C873', accInk: '#141019',
    panel: '#15131F', line: '#2A2638', muted: '#A49FB8', tint: '#1F1B2C',
    head: SANS, headW: 700, headCase: 'none', headTrack: '-0.01em',
    body: SANS, num: SANS, numW: 700, label: SANS,
    h1: 30, rad: 999, btnCase: 'none',
    hero: null, logo, logoW: 150, footerLogo: logo, fonts: null,
  }
}

export function tones(s: EmailSkin) {
  return {
    panel: s.panel || mix(s.bg, s.ink, 0.10),
    line: s.line || mix(s.bg, s.ink, 0.22),
    muted: s.muted || mix(s.bg, s.ink, 0.66),
    tint: s.tint || mix(s.bg, s.acc, 0.16),
    btn: s.acc,
    btnInk: s.accInk,
  }
}

// ── type ─────────────────────────────────────────────────────────────────────
/** Display type: the venue's heading face at `size`. */
export function H(s: EmailSkin, size: number, extra = ''): string {
  return `font-family:${s.head};font-weight:${s.headW};text-transform:${s.headCase};letter-spacing:${s.headTrack};font-size:${size}px;line-height:1.08;color:${s.ink};${extra}`
}

/** Body type, muted unless a colour is given. */
export function B(s: EmailSkin, size: number, color?: string | null, extra = ''): string {
  return `font-family:${s.body};font-size:${size}px;line-height:1.55;color:${color || tones(s).muted};${extra}`
}

/** The small spaced capitals: kickers and labels. */
export function L(s: EmailSkin, color?: string | null, extra = ''): string {
  return `font-family:${s.label};font-size:11px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:${color || tones(s).muted};${extra}`
}

function radius(s: EmailSkin): string {
  return s.rad >= 999 ? '999px' : `${s.rad}px`
}

function cardRadius(s: EmailSkin, px: number): string {
  return s.rad ? `${px}px` : '0'
}

// ── frame ────────────────────────────────────────────────────────────────────
export function shell(s: EmailSkin, title: string, preheader: string, rows: readonly string[]): string {
  const fonts = s.fonts ? `<link href="${esc(s.fonts)}" rel="stylesheet">` : ''
  const pad = '&#847;&zwnj;&nbsp;'.repeat(60)
  return `<!doctype html><html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"><title>${esc(title)}</title>${fonts}
<style>body{margin:0;padding:0;background:${s.bg}}a{color:${s.acc}}@media (max-width:520px){.px{padding-left:20px!important;padding-right:20px!important}.stk{display:block!important;width:100%!important;padding:0 0 12px 0!important}.hide-s{display:none!important}.qrc{width:118px!important}.btnw{display:block!important;margin:0 0 10px 0!important}.btnw table{width:100%!important}.qrc img{width:94px!important;height:94px!important}}</style>
</head><body style="margin:0;padding:0;background:${s.bg}">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${esc(preheader)}${pad}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${s.bg}" style="background:${s.bg}"><tr><td align="center" style="padding:0">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;margin:0 auto;background:${s.bg}">
${rows.join('')}
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`
}

// ── header ───────────────────────────────────────────────────────────────────
/**
 * Clubs: the venue photo washed dark with the logo on it. Outlook desktop
 * ignores CSS backgrounds, so it gets the photo through VML, with the wash
 * baked into the image. The group skin: the logo on its own.
 */
export function header(s: EmailSkin, height = 230): string {
  if (s.kind === 'club') {
    const pos = s.heroPos || 'center'
    const open = s.hero
      ? `<td background="${esc(s.hero)}" bgcolor="${s.bg}" style="background:${s.bg} url('${esc(s.hero)}') ${pos} / cover no-repeat;background-image:url('${esc(s.hero)}');background-size:cover;background-position:${pos}">`
      : `<td bgcolor="${s.heroColor || s.bg}" style="background-color:${s.heroColor || s.bg};background-image:${s.heroGrad || 'none'}">`
    const vml = s.outlookHero || s.hero || ''
    return `<tr>${open}
<!--[if gte mso 9]><v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:600px;height:${height}px"><v:fill type="frame" src="${esc(vml)}" color="${s.bg}" /><v:textbox inset="0,0,0,0"><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" valign="bottom" height="${height}" style="height:${height}px;padding:0 0 28px;background:${rgba(s.bg, s.heroDim ?? 0.45)}">
<img src="${esc(s.logo)}" width="${s.logoW}" alt="${esc(s.name)}" style="display:block;width:${s.logoW}px;max-width:70%;height:auto;border:0">
</td></tr></table>
<!--[if gte mso 9]></v:textbox></v:rect><![endif]-->
</td></tr>`
  }
  return `<tr><td align="center" style="padding:34px 24px 6px"><img src="${esc(s.logo)}" width="${s.logoW}" alt="${esc(s.name)}" style="display:block;width:${s.logoW}px;height:auto;border:0"></td></tr>`
}

// ── intro ────────────────────────────────────────────────────────────────────
export function intro(s: EmailSkin, o: {
  kicker: string; headline: string; lead?: string | null; kickerColor?: string | null; top?: number; after?: string | null
}): string {
  const top = o.top ?? 28
  const lead = o.lead ? `<div style="${B(s, 15, null, 'padding-top:10px')}">${o.lead}</div>` : ''
  return `<tr><td class="px" align="center" style="padding:${top}px 36px 0;text-align:center">
<div style="${L(s, o.kickerColor || s.acc)}">${o.kicker}</div>
<div style="${H(s, s.h1, 'padding-top:10px')}">${o.headline}</div>
${lead}${o.after ?? ''}
</td></tr>`
}

// ── the ticket ───────────────────────────────────────────────────────────────
/**
 * The date stub on the left and the booking on the right, an optional body
 * under a perforation, and an optional band across the foot.
 */
export function ticket(s: EmailSkin, o: {
  dow: string; day: string; mon: string; title: string; sub: string; label: string; body?: string | null; band?: string | null
}): string {
  const t = tones(s)
  const body = o.body
    ? `<tr><td style="padding:0 14px"><div style="border-top:2px dashed ${t.line};height:0;line-height:0;font-size:0">&nbsp;</div></td></tr>
<tr><td style="padding:16px 18px">${o.body}</td></tr>`
    : ''
  return `<tr><td class="px" style="padding:24px 36px 0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${t.panel};border:1px solid ${t.line};border-radius:16px;border-collapse:separate">
<tr><td style="padding:0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td width="96" align="center" valign="middle" style="width:96px;padding:18px 6px;border-right:1px dashed ${t.line}">
<div style="${B(s, 12, s.acc, 'font-weight:700;letter-spacing:0.2em')}">${o.dow}</div>
<div style="font-family:${s.num};font-weight:${s.numW};font-size:44px;line-height:1.05;color:${s.ink}">${o.day}</div>
<div style="${B(s, 12, t.muted, 'letter-spacing:0.2em')}">${o.mon}</div>
</td>
<td valign="middle" style="padding:18px">
<div style="${H(s, 20)}">${o.title}</div>
<div style="${B(s, 13, t.muted, 'padding-top:4px')}">${o.sub}</div>
<div style="${B(s, 11, s.ink, 'font-weight:700;letter-spacing:0.18em;text-transform:uppercase;padding-top:6px')}">${o.label}</div>
</td>
</tr></table>
</td></tr>
${body}
${o.band ?? ''}
</table>
</td></tr>`
}

/** The foot of a ticket: solid accent for a hard cut-off, a tint otherwise. */
export function band(s: EmailSkin, left: string, right: string, note?: string | null, solid = true): string {
  const t = tones(s)
  const bg = solid ? s.acc : t.tint
  const ink = solid ? s.accInk : s.ink
  const noteRow = note ? `<tr><td colspan="2" style="${B(s, 12.5, ink, 'padding-top:6px')}">${note}</td></tr>` : ''
  return `<tr><td bgcolor="${bg}" style="background:${bg};border-radius:0 0 15px 15px;padding:14px 18px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="${B(s, 11, ink, 'font-weight:700;letter-spacing:0.2em;text-transform:uppercase')}">${left}</td>
<td align="right" style="font-family:${s.num};font-weight:${s.numW};font-size:20px;line-height:1;color:${ink};text-transform:uppercase">${right}</td>
</tr>${noteRow}</table>
</td></tr>`
}

/** The QR on white with the line beside it. The QR opens the pass. */
export function qrBody(s: EmailSkin, o: { qr: string; pass: string; title: string; line: string }): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td class="qrc" width="150" valign="middle" style="width:150px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#ffffff" style="background:#ffffff;border-radius:12px;padding:10px">
<a href="${esc(o.pass)}"><img src="${esc(o.qr)}" width="126" height="126" alt="Your QR code" style="display:block;width:126px;height:126px;border:0"></a>
</td></tr></table>
</td>
<td valign="middle" style="padding-left:16px">
<div style="${B(s, 15, s.ink, 'font-weight:700')}">${o.title}</div>
<div style="${B(s, 13, null, 'padding-top:4px')}">${o.line}</div>
</td></tr></table>`
}

// ── actions ──────────────────────────────────────────────────────────────────
/**
 * One primary button and an optional secondary. Inline-block wrappers, so they
 * sit side by side on a desktop and stack full width on a phone.
 */
export function buttons(s: EmailSkin, primary: Link, secondary?: Link | null, top = 24): string {
  const t = tones(s)
  const one = ([label, href]: Link, solid: boolean) => {
    const ink = solid ? t.btnInk : s.ink
    const cell = solid
      ? `<td align="center" bgcolor="${t.btn}" style="background:${t.btn};border-radius:${radius(s)}">`
      : `<td align="center" style="border:1px solid ${t.line};border-radius:${radius(s)}">`
    return `<div class="btnw" style="display:inline-block;margin:0 10px 10px 0;vertical-align:top">`
      + `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>${cell}`
      + `<a href="${esc(href)}" style="display:block;padding:${solid ? '15px 24px' : '14px 22px'};${B(s, 14, ink, `font-weight:700;letter-spacing:0.06em;text-decoration:none;text-align:center;text-transform:${s.btnCase}`)}">${label}</a>`
      + `</td></tr></table></div>`
  }
  const html = one(primary, true) + (secondary ? one(secondary, false) : '')
  return `<tr><td class="px" align="center" style="padding:${top}px 26px 0 36px;text-align:center">${html}</td></tr>`
}

/** The one thing to do, with its button, as a card of its own. */
export function actionCard(s: EmailSkin, o: { eyebrow: string; note: string; button: Link; deadline?: string | null }): string {
  const t = tones(s)
  const [label, href] = o.button
  const deadline = o.deadline ? `<tr><td style="padding-top:12px;${B(s, 12.5)}">${o.deadline}</td></tr>` : ''
  return `<tr><td class="px" style="padding:24px 36px 0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${t.panel};border:1px solid ${t.line};border-top:4px solid ${s.acc};border-radius:${cardRadius(s, 14)};border-collapse:separate">
<tr><td style="padding:20px 22px 22px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="${L(s, s.acc)}">${o.eyebrow}</td></tr>
<tr><td style="padding-top:8px;${B(s, 14, s.ink)}">${o.note}</td></tr>
<tr><td style="padding-top:18px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td align="center" bgcolor="${t.btn}" style="background:${t.btn};border-radius:${radius(s)}"><a href="${esc(href)}" style="display:block;padding:16px 20px;text-align:center;${B(s, 15, t.btnInk, `font-weight:700;letter-spacing:0.06em;text-decoration:none;text-transform:${s.btnCase}`)}">${label}</a></td>
</tr></table></td></tr>
${deadline}
</table>
</td></tr></table>
</td></tr>`
}

// ── text rows ────────────────────────────────────────────────────────────────
export function para(s: EmailSkin, html: string, o: { top?: number; size?: number; align?: 'left' | 'center' } = {}): string {
  const al = o.align || 'center'
  return `<tr><td class="px" align="${al}" style="padding:${o.top ?? 18}px 36px 0;text-align:${al};${B(s, o.size ?? 14)}">${html}</td></tr>`
}

/** Know before you go: short columns under an accent rule. */
export function know(s: EmailSkin, items: readonly (readonly [title: string, body: string])[], top = 24): string {
  const cells = items.map(([title, body], i) => {
    const pr = i < items.length - 1 ? '8px' : '0'
    return `<td class="stk" width="${Math.floor(100 / items.length)}%" valign="top" style="border-top:2px solid ${s.acc};padding:8px ${pr} 0 0;${B(s, 12)}"><b style="color:${s.ink};font-size:12.5px">${title}</b><br>${body}</td>`
  })
  return `<tr><td class="px" style="padding:${top}px 36px 0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${cells.join('')}</tr></table>
</td></tr>`
}

/**
 * A photo on the left and a short pitch on the right. The photo is a CSS
 * background, which Outlook desktop ignores, so Outlook gets `outlookImage`
 * as a real image. With no photo the cell takes the venue's colour.
 */
export function sideCard(s: EmailSkin, o: {
  image?: string | null; outlookImage?: string | null; title: string; body: string; link: Link; top?: number
}): string {
  const t = tones(s)
  const mso = o.outlookImage
    ? `<!--[if mso]><img src="${esc(o.outlookImage)}" width="150" height="130" alt="" style="display:block;width:150px;height:130px;border:0"><![endif]--><!--[if !mso]><!-->&nbsp;<!--<![endif]-->`
    : '&nbsp;'
  const pic = o.image
    ? `<td class="hide-s" width="150" valign="middle" background="${esc(o.image)}" bgcolor="${t.panel}" style="width:150px;background:${t.panel} url('${esc(o.image)}') center / cover no-repeat;background-image:url('${esc(o.image)}');background-size:cover;background-position:center;border-radius:13px 0 0 13px">${mso}</td>`
    : s.kind === 'club'
      ? `<td class="hide-s" width="150" valign="middle" bgcolor="${s.heroColor || t.panel}" style="width:150px;background-color:${s.heroColor || t.panel};background-image:${s.heroGrad || 'none'};border-radius:13px 0 0 13px">${mso}</td>`
      : ''
  const [label, href] = o.link
  return `<tr><td class="px" style="padding:${o.top ?? 24}px 36px 0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${t.line};border-radius:14px;border-collapse:separate;overflow:hidden"><tr>
${pic}
<td valign="middle" style="padding:18px">
<div style="${H(s, 18)}">${o.title}</div>
<div style="${B(s, 13, null, 'padding-top:6px')}">${o.body}</div>
<div style="padding-top:10px"><a href="${esc(href)}" style="${B(s, 12, s.acc, 'font-weight:700;letter-spacing:0.14em;text-transform:uppercase;text-decoration:none')}">${label} &rarr;</a></div>
</td>
</tr></table>
</td></tr>`
}

/** A guest list deal (birthday, hens, bucks) in the venue's own look. */
export function dealCard(s: EmailSkin, o: { label: string; title: string; perks: readonly string[]; fine: string; top?: number }): string {
  const t = tones(s)
  const rows = o.perks.map((p) =>
    `<tr><td width="24" valign="top" style="width:24px;padding:6px 0;${B(s, 15, s.acc, 'font-weight:700')}">&#10003;</td>`
    + `<td style="padding:6px 0;${B(s, 14, s.ink)}">${p}</td></tr>`).join('')
  return `<tr><td class="px" style="padding:${o.top ?? 22}px 36px 0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${t.panel};border:1px solid ${t.line};border-radius:${cardRadius(s, 16)};border-collapse:separate">
<tr><td style="padding:20px 22px">
<div style="${L(s, s.acc)}">${o.label}</div>
<div style="${H(s, 22, 'padding-top:8px')}">${o.title}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:10px">${rows}</table>
<div style="${B(s, 11.5, null, 'padding-top:10px')}">${o.fine}</div>
</td></tr></table>
</td></tr>`
}

/** Numbered steps, for inside a panel. */
export function steps(s: EmailSkin, items: readonly (readonly [title: string, body: string])[]): string {
  const t = tones(s)
  const rows = items.map(([title, body], i) => {
    const bb = i === items.length - 1 ? '' : `border-bottom:1px solid ${t.line};`
    return `<tr><td width="40" valign="top" style="width:40px;padding:14px 0;${bb}">`
      + `<div style="width:28px;height:28px;border-radius:999px;background:${s.acc};text-align:center;${B(s, 13, s.accInk, 'font-weight:700;line-height:28px')}">${i + 1}</div></td>`
      + `<td valign="top" style="padding:14px 0;${bb}"><div style="${B(s, 15, s.ink, 'font-weight:700')}">${title}</div>`
      + `<div style="${B(s, 13.5, null, 'padding-top:2px')}">${body}</div></td></tr>`
  })
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows.join('')}</table>`
}

/** A plain bordered panel. */
export function panel(s: EmailSkin, inner: string, top = 22): string {
  const t = tones(s)
  return `<tr><td class="px" style="padding:${top}px 36px 0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${t.panel};border:1px solid ${t.line};border-radius:${cardRadius(s, 12)};border-collapse:separate">
<tr><td style="padding:6px 18px">${inner}</td></tr></table>
</td></tr>`
}

/** A ruled-off line for a question and who to call. */
export function helpLine(s: EmailSkin, html: string, top = 22): string {
  const t = tones(s)
  return `<tr><td class="px" align="center" style="padding:${top}px 36px 0;text-align:center"><div style="border-top:1px solid ${t.line};padding-top:18px;${B(s, 13.5)}">${html}</div></td></tr>`
}

// ── footer ───────────────────────────────────────────────────────────────────
/**
 * The Luna Group sign-off. Club emails list the sister venues with this one in
 * bold; group emails pass `sisters: false`. `extra` is a row of its own under
 * the venue list (the venue's WhatsApp channel).
 */
export function footer(s: EmailSkin, reason: string, o: { sisters?: boolean; extra?: string | null } = {}): string {
  const t = tones(s)
  const withSisters = o.sisters ?? s.kind === 'club'
  const sib = SISTERS.map((x) => (x === s.short ? `<b style="color:${s.ink}">${x}</b>` : x)).join(' &middot; ')
  const sibRow = withSisters
    ? `<tr><td align="center" style="padding-top:12px;${L(s, t.muted, 'font-size:10.5px;letter-spacing:0.16em;font-weight:400')}">${sib}</td></tr>`
    : ''
  return `<tr><td style="padding:30px 0 0"><div style="border-top:1px solid ${t.line};height:0;line-height:0;font-size:0">&nbsp;</div></td></tr>
<tr><td align="center" style="padding:24px 28px 32px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
<tr><td align="center"><img src="${esc(s.footerLogo)}" width="120" alt="Luna Group Hospitality" style="display:block;width:120px;height:auto;border:0;opacity:0.9"></td></tr>
${sibRow}${o.extra ?? ''}
<tr><td align="center" style="padding-top:12px;${B(s, 11)}">${reason}<br>Luna Group Hospitality &middot; Brisbane &amp; Gold Coast</td></tr>
</table>
</td></tr>`
}
