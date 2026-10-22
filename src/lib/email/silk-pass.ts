/**
 * The guest list pass for venues without a look of their own: today that is
 * Silk Saturdays and Silk. Trent asked for this one to be "better and more
 * exciting" than the plain Luna Group pass, and picked the Satin mock-up on
 * 22 Oct 2026 ("satin"): a champagne silk header with the night's name in an
 * italic serif, an ivory ticket and champagne buttons.
 *
 * Same job as every pass: the QR, the night, the pass link, the calendar link
 * and the door rules. The birthday / hens / bucks guest list deal still shows
 * for those occasions. There is no booth card: these venues take no booth
 * bookings through Reservations.
 *
 * Pure (no server-only imports), so the tests can render it. Guest data is
 * escaped here.
 */
import { esc, LUNA_FROM } from './blocks'
import { nightParts } from '@/lib/venue-theme'
import { occasionDeal } from '@/lib/occasion-packages'

export interface SatinPassInput {
  site: string
  token: string
  venueName: string
  first: string
  /** YYYY-MM-DD. */
  eventDate: string
  ownerGuestList?: boolean
  /** e.g. "11pm", when the venue's guest list has a cut-off. */
  untilLabel?: string | null
  occasion?: string | null
}

const C = {
  bg: '#0E0C0B', ink: '#F6EFE6', champ: '#D9C3A0', muted: '#A99D8F', line: '#2E2820',
  ivory: '#F6EFE6', cardInk: '#1A1612', cardMuted: '#7A6A55', cardLabel: '#8A7458', perf: '#CDBFA8',
}
const PLAY = "'Playfair Display',Didot,'Bodoni 72',Georgia,'Times New Roman',serif"
const SANS = "'Helvetica Neue',Helvetica,Arial,sans-serif"
const FONTS = 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&display=swap'
/** Old-style figures drop below the line in Playfair; the date stub wants lining ones. */
const LINING = "font-variant-numeric:lining-nums;font-feature-settings:'lnum' 1;"

export const SATIN_FROM = LUNA_FROM

export function satinSubject(i: Pick<SatinPassInput, 'venueName' | 'eventDate' | 'ownerGuestList'>): string {
  const n = nightParts(i.eventDate)
  const venue = String(i.venueName ?? '').trim() || 'Luna Group'
  return i.ownerGuestList
    ? `You're on the owner's guest list: ${venue}, ${n.night}`
    : `You're on the list: ${venue}, ${n.night}`
}

function label(color: string, size = 11, track = '0.22em', extra = ''): string {
  return `font-family:${SANS};font-size:${size}px;font-weight:700;letter-spacing:${track};text-transform:uppercase;color:${color};${extra}`
}

function body(color: string, size = 15, extra = ''): string {
  return `font-family:${SANS};font-size:${size}px;line-height:1.55;color:${color};${extra}`
}

function button(text: string, href: string, solid: boolean): string {
  const cell = solid
    ? `<td align="center" bgcolor="${C.champ}" style="border-radius:999px;background:${C.champ};border:1.5px solid ${C.champ}">`
    : `<td align="center" style="border-radius:999px;border:1.5px solid #5C5142">`
  return `<div class="btnw" style="display:inline-block;margin:0 6px 10px;vertical-align:top"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>${cell}`
    + `<a href="${esc(href)}" style="display:inline-block;padding:15px 30px;font-family:${SANS};font-size:14px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${solid ? C.cardInk : C.champ};text-decoration:none;border-radius:999px">${text}</a></td></tr></table></div>`
}

export function satinPassHtml(i: SatinPassInput): string {
  const site = i.site.replace(/\/$/, '')
  const n = nightParts(i.eventDate)
  const weekday = n.night.split(' ')[0]
  const venue = esc(String(i.venueName ?? '').trim() || 'Luna Group')
  const first = esc(String(i.first ?? '').trim() || 'there')
  const until = i.untilLabel ? esc(i.untilLabel) : null
  const pass = `${site}/g/${encodeURIComponent(i.token)}`
  const qr = `${site}/api/qr/${encodeURIComponent(i.token)}`
  const hero = `${site}/brand/email/hero-silk.jpg`
  const heroOutlook = `${site}/brand/email/hero-silk-outlook.jpg`
  const logo = `${site}/luna-group-white.png`
  const cal = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(String(i.venueName ?? '').trim() + ' guest list')}&dates=${n.ymd}/${n.ymd}&details=${encodeURIComponent('Your pass: ' + pass)}&location=${encodeURIComponent(String(i.venueName ?? '').trim())}`

  const kicker = i.ownerGuestList ? 'Owner&rsquo;s guest list' : 'Guest list'
  const headline = i.ownerGuestList ? `You&rsquo;re on the owner&rsquo;s guest list, ${first}.` : `You&rsquo;re on the list, ${first}.`
  const lead = until
    ? `Get there before ${until}, bring this pass, and ${weekday} is yours.`
    : `Arrive early, bring this pass, and ${weekday} is yours.`
  const subject = satinSubject(i)
  const preheader = `${weekday} is yours, ${String(i.first ?? '').trim() || 'there'}. Your QR is inside. `
    + (i.untilLabel ? `Guest list closes ${i.untilLabel} sharp.` : 'Arrive early: entry is subject to capacity.')

  const deal = occasionDeal(i.occasion)
  const dealCard = deal
    ? `<tr><td class="px" style="padding:18px 36px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${C.line};border-radius:14px;border-collapse:separate"><tr><td style="padding:20px 22px">
<div style="${label(C.champ, 11, '0.24em')}">${deal.label}</div>
<div style="font-family:${PLAY};font-style:italic;font-size:24px;line-height:1.2;color:${C.ink};padding-top:6px">${deal.title}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:10px">${deal.perks.map((p) =>
      `<tr><td width="24" valign="top" style="width:24px;padding:6px 0;${body(C.champ, 15, 'font-weight:700')}">&#10003;</td><td style="padding:6px 0;${body(C.ink, 14)}">${p}</td></tr>`).join('')}</table>
<div style="${body(C.muted, 11.5, 'padding-top:10px')}">${deal.fine}</div>
</td></tr></table></td></tr>`
    : ''

  const know: [string, string][] = [
    until ? ['Guest list closes', `${until} sharp. After that the guest list no longer applies.`] : ['Arrive early', 'Entry is subject to capacity on the night.'],
    ['Bring ID', 'Valid photo ID, 18+.'],
    ['Door rules', 'Dress code and management discretion apply.'],
  ]

  return `<!doctype html><html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"><title>${esc(subject)}</title><link href="${FONTS}" rel="stylesheet">
<style>body{margin:0;padding:0;background:${C.bg}}a{color:${C.champ}}@media (max-width:520px){.px{padding-left:20px!important;padding-right:20px!important}.stk{display:block!important;width:100%!important}.btnw{display:block!important;margin:0 0 10px 0!important}.btnw table{width:100%!important}.qrc{width:132px!important}.qrc img{width:112px!important;height:112px!important}.hxl{font-size:44px!important}.h2{font-size:30px!important}.tnum{font-size:50px!important}.hero{height:250px!important}}</style>
</head><body style="margin:0;padding:0;background:${C.bg}">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${esc(preheader)}${'&#847;&zwnj;&nbsp;'.repeat(60)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.bg}" style="background:${C.bg}"><tr><td align="center" style="padding:0">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;margin:0 auto;background:${C.bg}">
<tr><td background="${esc(hero)}" bgcolor="${C.bg}" style="background:${C.bg} url('${esc(hero)}') center / cover no-repeat;background-image:url('${esc(hero)}');background-size:cover;background-position:center">
<!--[if gte mso 9]><v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:600px;height:300px"><v:fill type="frame" src="${esc(heroOutlook)}" color="${C.bg}" /><v:textbox inset="0,0,0,0"><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="hero" align="center" valign="middle" height="300" style="height:300px;padding:0 24px;background:rgba(14,12,11,.42)">
<img src="${esc(logo)}" width="104" alt="Luna Group" style="display:block;width:104px;height:auto;border:0;margin:0 auto 22px">
<div style="${label(C.champ, 11, '0.34em')}">${kicker}</div>
<div class="hxl" style="font-family:${PLAY};font-style:italic;font-weight:400;font-size:58px;line-height:1.05;color:${C.ink};padding-top:10px">${venue}</div>
<div style="${label('#EDE3D3', 11, '0.3em', 'padding-top:12px')}">${esc(n.night)}</div>
</td></tr></table>
<!--[if gte mso 9]></v:textbox></v:rect><![endif]-->
</td></tr>
<tr><td class="px" align="center" style="padding:34px 36px 0"><div class="h2" style="font-family:${PLAY};font-weight:400;font-size:38px;line-height:1.12;color:${C.ink}">${headline}</div>
<div style="${body(C.muted, 15, 'padding-top:12px')}">${lead}</div></td></tr>
<tr><td class="px" style="padding:28px 36px 0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.ivory}" style="background:${C.ivory};border-radius:18px;border-collapse:separate"><tr><td style="padding:0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td width="122" align="center" valign="middle" style="width:122px;padding:22px 0;border-right:1px dashed ${C.perf}">
<div style="${label(C.cardMuted, 11.5, '0.3em')}">${n.dow}</div><div class="tnum" style="font-family:${PLAY};font-weight:400;font-size:60px;line-height:1;color:${C.cardInk};padding:4px 0;${LINING}">${n.day}</div><div style="${label(C.cardMuted, 11.5, '0.3em')}">${n.mon}</div></td>
<td valign="middle" style="padding:22px 22px">
<div style="${label(C.cardLabel, 10.5, '0.26em')}">Admit one &middot; ${kicker}</div>
<div style="font-family:${PLAY};font-style:italic;font-size:28px;line-height:1.1;color:${C.cardInk};padding-top:6px">${venue}</div>
<div style="${body(C.cardMuted, 13.5, 'padding-top:4px')}">${esc(n.night)}</div></td></tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:0 22px"><div style="border-top:1px dashed ${C.perf};font-size:0;line-height:0;height:1px">&nbsp;</div></td></tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:20px 22px 22px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td class="qrc" width="160" valign="middle" style="width:160px"><img src="${esc(qr)}" width="144" height="144" alt="Your QR code" style="display:block;width:144px;height:144px;border:0"></td>
<td valign="middle" style="padding-left:16px"><div style="font-family:${PLAY};font-size:21px;line-height:1.2;color:${C.cardInk}">Show this at the door</div>
<div style="${body(C.cardMuted, 13.5, 'padding-top:6px')}">It&rsquo;s yours alone. One scan, one entry. Phone flat? Give your name.</div></td></tr></table></td></tr></table>
</td></tr></table></td></tr>
<tr><td class="px" align="center" style="padding:26px 36px 0">${button('Open my pass', pass, true)}${button('Add to calendar', cal, false)}</td></tr>
<tr><td class="px" style="padding:18px 36px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${C.line};border-radius:14px;border-collapse:separate"><tr><td align="center" style="padding:20px 22px">
<div style="font-family:${PLAY};font-style:italic;font-size:22px;line-height:1.2;color:${C.champ}">Bringing the crew?</div>
<div style="${body(C.muted, 14, 'padding-top:6px')}">Everyone needs their own QR. Add your friends from your pass and we&rsquo;ll send each one theirs.</div>
<div style="padding-top:8px"><a href="${esc(pass)}" style="${body(C.ink, 14, 'font-weight:700;text-decoration:underline')}">Add my friends</a></div></td></tr></table></td></tr>
${dealCard}
<tr><td class="px" style="padding:26px 36px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${C.line}"><tr><td style="padding-top:18px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${know.map(([h, t]) =>
    `<td class="stk" valign="top" width="33%" style="width:33%;padding:0 10px 14px 0"><div style="${label(C.champ, 11, '0.16em')}">${h}</div><div style="${body(C.muted, 13, 'padding-top:5px')}">${t}</div></td>`).join('')}</tr></table></td></tr></table></td></tr>
<tr><td class="px" align="center" style="padding:30px 36px 40px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${C.line}"><tr><td align="center" style="padding-top:26px">
<img src="${esc(logo)}" width="118" alt="Luna Group" style="display:block;width:118px;height:auto;border:0">
<div style="${body(C.muted, 12, 'padding-top:14px;text-align:center')}">You&rsquo;re getting this because you joined the ${venue} guest list.<br>Luna Group Hospitality &middot; Brisbane &amp; Gold Coast</div>
</td></tr></table></td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`
}
