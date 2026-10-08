/**
 * The venue-branded guest list confirmation email (8 Oct 2026).
 *
 * Email-safe on purpose: tables, inline styles, hosted images, no CSS the big
 * clients strip. Gmail and Outlook ignore web fonts, so headings fall back to
 * the stacks in the theme; Outlook desktop also ignores CSS background images,
 * so the header shows the venue colour behind the logo there.
 *
 * Same content as the original email — QR, pass link, cut-off, occasion deal,
 * owner's-list wording — in the venue's own look.
 */
import { SISTERS, THEME_FONTS_URL, RESERVATIONS, nightParts, rgba, tones, type VenueTheme } from '@/lib/venue-theme'
import { occasionDealHtml, occasionBoothCopy } from '@/lib/occasion-packages'

export interface BrandedInput {
  theme: VenueTheme
  site: string
  token: string
  venueName: string
  first: string
  eventDate: string            // YYYY-MM-DD
  promoterName?: string | null
  untilLabel?: string | null   // "11pm" when the venue has a cut-off
  occasion?: string | null
  ownerGuestList?: boolean
  whatsappUrl?: string | null
}

const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function brandedSubject(i: Pick<BrandedInput, 'theme' | 'eventDate' | 'ownerGuestList'>): string {
  const n = nightParts(i.eventDate)
  return i.ownerGuestList
    ? `You're on the owner's guest list: ${i.theme.short}, ${n.night}`
    : `You're on the list: ${i.theme.short}, ${n.night}`
}

/** "Pump Nightclub <noreply@lunagroup.com.au>" — the guest sees the venue. */
export function brandedFrom(venueName: string): string {
  const name = venueName.replace(/[<>"\r\n]/g, '').trim() || 'Luna Group'
  return `${name} <noreply@lunagroup.com.au>`
}

export function brandedHtml(i: BrandedInput): string {
  const v = i.theme
  const { panel, line, muted } = tones(v)
  const n = nightParts(i.eventDate)
  const site = i.site.replace(/\/$/, '')
  const pass = `${site}/g/${i.token}`
  const qr = `${site}/api/qr/${i.token}`
  const img = (p: string) => `${site}${p}`
  const first = esc(i.first || 'there')
  const venue = esc(i.venueName)
  const radBtn = v.rad >= 999 ? '999px' : `${v.rad}px`
  const H = (size: number, extra = '') => `font-family:${v.head};font-weight:${v.headW};text-transform:${v.headCase};letter-spacing:${v.headTrack};font-size:${size}px;line-height:1.1;color:${v.ink};${extra}`
  const B = (size: number, color = muted, extra = '') => `font-family:${v.body};font-size:${size}px;line-height:1.5;color:${color};${extra}`
  const kicker = i.ownerGuestList ? "Owner's guest list" : 'Guest list confirmed'
  const kColor = i.ownerGuestList ? '#d4af37' : v.acc
  const cal = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(i.venueName + ' guest list')}&dates=${n.ymd}/${n.ymd}&details=${encodeURIComponent('Your pass: ' + pass)}&location=${encodeURIComponent(i.venueName)}`
  const sib = SISTERS.map(s => s === v.short ? `<b style="color:${v.ink}">${s}</b>` : s).join(' &middot; ')
  const booth = occasionBoothCopy(i.occasion) ?? { heading: v.boothT, intro: v.boothP }
  const deal = occasionDealHtml(i.occasion)

  const cut = i.untilLabel
    ? `<tr><td bgcolor="${v.acc}" style="background:${v.acc};border-radius:0 0 15px 15px;padding:14px 18px">
         <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
           <td style="${B(11, v.accInk, 'font-weight:700;letter-spacing:0.2em;text-transform:uppercase')}">Guest list closes</td>
           <td align="right" style="font-family:${v.num};font-weight:${v.numW};font-size:22px;line-height:1;color:${v.accInk};text-transform:uppercase">${esc(i.untilLabel)} sharp</td>
         </tr><tr><td colspan="2" style="${B(12.5, v.accInk, 'padding-top:6px')}">Arrive before ${esc(i.untilLabel)}. After that the guest list no longer applies.</td></tr></table>
       </td></tr>`
    : `<tr><td style="border-top:1px solid ${line};padding:14px 18px">
         <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
           <td style="${B(11, muted, 'font-weight:700;letter-spacing:0.2em;text-transform:uppercase')}">Guest list</td>
           <td align="right" style="font-family:${v.num};font-weight:${v.numW};font-size:16px;line-height:1;color:${v.ink};text-transform:uppercase">Arrive early</td>
         </tr><tr><td colspan="2" style="${B(12.5, muted, 'padding-top:6px')}">Entry is subject to capacity on the night.</td></tr></table>
       </td></tr>`

  const heroOpen = v.hero
    ? `<td background="${img(v.hero)}" bgcolor="${v.bg}" style="background:${v.bg} url('${img(v.hero)}') ${v.heroPos || 'center'} / cover no-repeat;background-image:url('${img(v.hero)}');background-size:cover;background-position:${v.heroPos || 'center'}">`
    : `<td bgcolor="${v.heroColor || v.bg}" style="background-color:${v.heroColor || v.bg};background-image:${v.heroGrad || 'none'}">`
  // Outlook desktop ignores CSS background images, so it gets a real <img>; everyone else keeps the cover background.
  const boothMso = `<!--[if mso]><img src="${img(v.booth)}" width="150" height="130" alt="" style="display:block;width:150px;height:130px;border:0"><![endif]--><!--[if !mso]><!-->&nbsp;<!--<![endif]-->`
  const boothImg = v.hero
    ? `<td class="bimg" width="150" valign="middle" background="${img(v.hero)}" bgcolor="${panel}" style="width:150px;background:${panel} url('${img(v.hero)}') center / cover no-repeat;background-image:url('${img(v.hero)}');background-size:cover;background-position:center;border-radius:13px 0 0 13px">${boothMso}</td>`
    : `<td class="bimg" width="150" valign="middle" bgcolor="${v.heroColor || panel}" style="width:150px;background-color:${v.heroColor || panel};background-image:${v.heroGrad || 'none'};border-radius:13px 0 0 13px">${boothMso}</td>`
  const wa = i.whatsappUrl
    ? `<tr><td align="center" style="padding-top:12px"><a href="${esc(i.whatsappUrl)}" style="${B(12.5, v.ink, `text-decoration:none;border:1px solid ${line};border-radius:999px;padding:8px 16px;display:inline-block`)}"><span style="color:#25D366">&#9679;</span>&nbsp; Follow ${esc(v.short)} on WhatsApp</a></td></tr>`
    : ''

  return `<!doctype html><html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark">
<title>You're on the list</title>
<link href="${THEME_FONTS_URL}" rel="stylesheet">
<style>body{margin:0;padding:0;background:${v.bg}} a{color:${v.acc}} @media (max-width:520px){.px{padding-left:18px!important;padding-right:18px!important}.qrc{width:118px!important}.qrc img{width:94px!important;height:94px!important}.bimg{display:none!important}.kn{display:block!important;width:100%!important;padding:0 0 12px 0!important}}</style>
</head><body style="margin:0;padding:0;background:${v.bg}">
<div style="display:none;max-height:0;overflow:hidden">${esc(v.short)}, ${n.night}. Your QR is inside${i.untilLabel ? `. Guest list closes ${esc(i.untilLabel)} sharp` : ''}.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${v.bg}" style="background:${v.bg}"><tr><td align="center" style="padding:0">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:${v.bg}">

<tr>${heroOpen}
  <!--[if gte mso 9]><v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:600px;height:230px"><v:fill type="frame" src="${img(v.outlookHero)}" color="${v.bg}" /><v:textbox inset="0,0,0,0"><![endif]-->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" valign="bottom" height="230" style="height:230px;padding:0 0 30px;background:${rgba(v.bg, v.heroDim ?? 0.45)}">
    <img src="${img(v.logo)}" width="${v.logoW}" alt="${venue}" style="display:block;width:${v.logoW}px;max-width:70%;height:auto;border:0">
  </td></tr></table>
  <!--[if gte mso 9]></v:textbox></v:rect><![endif]-->
</td></tr>

<tr><td class="px" align="center" style="padding:26px 36px 0">
  <div style="font-family:${v.body};font-size:11px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:${kColor}">${kicker}</div>
  <div style="${H(v.h1, 'padding-top:10px')}">You're on the list, ${first}</div>
  <div style="${B(14, muted, 'padding-top:8px')}">${venue} &middot; ${n.night}</div>
</td></tr>

<tr><td class="px" style="padding:24px 36px 0">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${panel};border:1px solid ${line};border-radius:16px;border-collapse:separate">
    <tr><td style="padding:0">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td width="96" align="center" valign="middle" style="width:96px;padding:18px 6px;border-right:1px dashed ${line}">
          <div style="${B(12, v.acc, 'font-weight:700;letter-spacing:0.2em')}">${n.dow}</div>
          <div style="font-family:${v.num};font-weight:${v.numW};font-size:44px;line-height:1.05;color:${v.ink}">${n.day}</div>
          <div style="${B(12, muted, 'letter-spacing:0.2em')}">${n.mon}</div>
        </td>
        <td valign="middle" style="padding:18px">
          <div style="${H(20)}">${esc(v.short)}</div>
          <div style="${B(13, muted, 'padding-top:4px')}">${n.night}${i.promoterName ? `<br>Guest of ${esc(i.promoterName)}` : ''}</div>
          <div style="${B(11, v.ink, 'font-weight:700;letter-spacing:0.18em;text-transform:uppercase;padding-top:6px')}">Guest list &middot; Admit 1</div>
        </td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:0 14px"><div style="border-top:2px dashed ${line};height:0;line-height:0;font-size:0">&nbsp;</div></td></tr>
    <tr><td style="padding:18px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td class="qrc" width="150" valign="middle" style="width:150px">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="#ffffff" style="background:#ffffff;border-radius:12px;padding:10px">
            <a href="${pass}"><img src="${qr}" width="126" height="126" alt="Your QR code" style="display:block;width:126px;height:126px;border:0"></a>
          </td></tr></table>
        </td>
        <td valign="middle" style="padding-left:16px">
          <div style="${B(15, v.ink, 'font-weight:700')}">Show this at the door</div>
          <div style="${B(13, muted, 'padding-top:4px')}">It's yours alone. One scan, one entry. Phone flat? Give your name.</div>
        </td>
      </tr></table>
    </td></tr>
    ${cut}
  </table>
</td></tr>

<tr><td align="center" class="px" style="padding:24px 36px 0">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
    <td bgcolor="${v.acc}" style="background:${v.acc};border-radius:${radBtn}"><a href="${pass}" style="display:inline-block;padding:14px 22px;${B(14, v.accInk, `font-weight:700;letter-spacing:0.04em;text-decoration:none;text-transform:${v.btnCase}`)}">Open my pass</a></td>
    <td width="10" style="width:10px">&nbsp;</td>
    <td style="border:1px solid ${line};border-radius:${radBtn}"><a href="${cal}" style="display:inline-block;padding:13px 20px;${B(14, v.ink, `font-weight:700;letter-spacing:0.04em;text-decoration:none;text-transform:${v.btnCase}`)}">Add to calendar</a></td>
  </tr></table>
</td></tr>

<tr><td align="center" class="px" style="padding:20px 48px 0;${B(13.5, muted)}"><b style="color:${v.ink}">Bringing friends?</b> Everyone needs their own QR. Add them from your pass and we'll send each one theirs.</td></tr>

${deal ? `<tr><td class="px" style="padding:8px 36px 0;font-family:${v.body};color:${v.ink}">${deal}</td></tr>` : ''}

<tr><td class="px" style="padding:24px 36px 0">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${line};border-radius:14px;border-collapse:separate;overflow:hidden"><tr>
    ${boothImg}
    <td valign="middle" style="padding:18px">
      <div style="${H(18)}">${esc(booth.heading)}</div>
      <div style="${B(13, muted, 'padding-top:6px')}">${esc(booth.intro)}</div>
      <div style="padding-top:10px"><a href="${RESERVATIONS}/on/${v.onKey}" style="${B(12, v.acc, 'font-weight:700;letter-spacing:0.14em;text-transform:uppercase;text-decoration:none')}">Book a booth &rarr;</a></div>
    </td>
  </tr></table>
</td></tr>

<tr><td class="px" style="padding:24px 36px 0">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
    <td class="kn" width="33%" valign="top" style="border-top:2px solid ${v.acc};padding:8px 8px 0 0;${B(12, muted)}"><b style="color:${v.ink};font-size:12.5px">Bring ID</b><br>Valid photo ID, 18+.</td>
    <td class="kn" width="33%" valign="top" style="border-top:2px solid ${v.acc};padding:8px 8px 0 0;${B(12, muted)}"><b style="color:${v.ink};font-size:12.5px">Door rules</b><br>Capacity, dress code and management discretion apply.</td>
    <td class="kn" width="33%" valign="top" style="border-top:2px solid ${v.acc};padding:8px 0 0 0;${B(12, muted)}"><b style="color:${v.ink};font-size:12.5px">One each</b><br>Only checked-in guests count toward rewards.</td>
  </tr></table>
</td></tr>

<tr><td style="padding:30px 0 0"><div style="border-top:1px solid ${line};height:0;line-height:0;font-size:0">&nbsp;</div></td></tr>
<tr><td align="center" style="padding:24px 28px 30px">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
    <tr><td align="center"><img src="${img('/luna-group-white.png')}" width="120" alt="Luna Group Hospitality" style="display:block;width:120px;height:auto;border:0"></td></tr>
    <tr><td align="center" style="padding-top:12px;${B(11, muted, 'letter-spacing:0.16em;text-transform:uppercase')}">${sib}</td></tr>
    ${wa}
    <tr><td align="center" style="padding-top:12px;${B(11, muted)}">You're getting this because you joined the ${esc(v.short)} guest list.<br>Luna Group Hospitality, Brisbane.</td></tr>
  </table>
</td></tr>

</table></td></tr></table></body></html>`
}
