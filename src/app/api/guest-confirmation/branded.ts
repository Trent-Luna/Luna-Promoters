/**
 * The venue-branded guest list confirmation email.
 *
 * 8 Oct 2026: each club got its own look. 22 Oct 2026: the redesign Trent
 * approved ("These all look great and happy to roll out") moves it onto the
 * shared blocks in src/lib/email/blocks.ts, draws the birthday / hens / bucks
 * deal in the venue's own look instead of a generic Luna card, and lets the two
 * buttons stack on a phone.
 *
 * Same content as before: QR, pass link, cut-off, occasion deal, owner's-list
 * wording, party nights, the venue's WhatsApp channel.
 *
 * Email-safe on purpose: tables, inline styles, hosted images. Gmail and
 * Outlook ignore web fonts, so headings fall back to the stacks in the theme;
 * Outlook desktop also ignores CSS background images, so it gets the header and
 * the booth photo as real images.
 */
import { RESERVATIONS, nightParts, type VenueTheme } from '@/lib/venue-theme'
import { occasionBoothCopy, occasionDeal } from '@/lib/occasion-packages'
import { groupPhrase, namesLine, shortTime } from '@/lib/party'
import {
  B, band, buttons, clubSkin, dealCard, esc, footer, header, intro, know, para, qrBody, shell, sideCard, ticket, tones, venueFrom,
} from '@/lib/email/blocks'

/** A party night (migration 0051): its name, look and the guest's group. */
export interface PartyEmail {
  eventName: string
  startTime?: string | null
  tagline?: string | null
  lede?: string | null
  included?: string | null
  plusOnes: number
  names?: string[] | null
}

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
  party?: PartyEmail | null
}

/** The owner's guest list keeps its gold kicker whatever the venue's colour. */
const OWNER_GOLD = '#d4af37'

export function brandedSubject(i: Pick<BrandedInput, 'theme' | 'eventDate' | 'ownerGuestList' | 'party'>): string {
  const n = nightParts(i.eventDate)
  if (i.party) return `You're in: ${i.party.eventName}, ${n.night}`
  return i.ownerGuestList
    ? `You're on the owner's guest list: ${i.theme.short}, ${n.night}`
    : `You're on the list: ${i.theme.short}, ${n.night}`
}

/** "Pump Nightclub <noreply@lunagroup.com.au>" — the guest sees the venue. */
export function brandedFrom(venueName: string): string {
  return venueFrom(venueName)
}

export function brandedHtml(i: BrandedInput): string {
  const v = i.theme
  const site = i.site.replace(/\/$/, '')
  const s = clubSkin(v, site, i.venueName)
  const { line } = tones(s)
  const n = nightParts(i.eventDate)
  const pass = `${site}/g/${i.token}`
  const qr = `${site}/api/qr/${i.token}`
  const first = esc(i.first || 'there')
  const p = i.party ?? null
  const plus = p ? Math.max(0, p.plusOnes || 0) : 0
  const friends = p ? namesLine(p.names) : ''
  const from = p ? shortTime(p.startTime) : ''
  const until = i.untilLabel ? esc(i.untilLabel) : null
  const kicker = p ? esc(p.tagline || "You're on the list") : i.ownerGuestList ? "Owner's guest list" : 'Guest list confirmed'
  const cal = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(p ? p.eventName : i.venueName + ' guest list')}&dates=${n.ymd}/${n.ymd}&details=${encodeURIComponent('Your pass: ' + pass)}&location=${encodeURIComponent(i.venueName)}`
  const booth = occasionBoothCopy(i.occasion) ?? { heading: v.boothT, intro: v.boothP }
  const deal = occasionDeal(i.occasion)

  const lead = p
    ? `${esc(p.eventName)} &middot; ${n.night}${from ? ` from ${from}` : ''}`
    : `${esc(v.short)} &middot; ${n.night}`
  const partyLine = p
    ? `<div style="${B(s, 15, s.ink, 'padding-top:14px')}">${p.lede ? `${esc(p.lede)} ` : ''}${esc(groupPhrase(plus).replace(/^you/, 'You'))} are on the list.</div>`
    : ''
  const door = plus > 0
    ? `One scan lets your group of ${1 + plus} in${friends ? `: you, ${esc(friends)}` : ''}. Phone flat? Give your name.`
    : 'It&rsquo;s yours alone. One scan, one entry. Phone flat? Give your name.'
  const cutoff = until
    ? band(s, 'Guest list closes', `${until} sharp`, `Arrive before ${until}. After that the guest list no longer applies.`)
    : band(s, 'Guest list', 'Arrive early', 'Entry is subject to capacity on the night.', false)
  const friendsLine = p
    ? (p.included ? para(s, `<b style="color:${s.ink}">On the night:</b> ${esc(p.included)}`, { top: 16, size: 13.5 }) : '')
    : para(s, `<b style="color:${s.ink}">Bringing friends?</b> Everyone needs their own QR. Add them from your pass and we&rsquo;ll send each one theirs.`, { top: 16, size: 13.5 })
  const whatsapp = i.whatsappUrl
    ? `<tr><td align="center" style="padding-top:12px"><a href="${esc(i.whatsappUrl)}" style="${B(s, 12.5, s.ink, `text-decoration:none;border:1px solid ${line};border-radius:999px;padding:8px 16px;display:inline-block`)}"><span style="color:#25D366">&#9679;</span>&nbsp; Follow ${esc(v.short)} on WhatsApp</a></td></tr>`
    : ''

  const rows = [
    header(s),
    intro(s, {
      kicker,
      kickerColor: i.ownerGuestList ? OWNER_GOLD : v.acc,
      headline: `You&rsquo;re on the list, ${first}`,
      lead,
      after: partyLine,
    }),
    ticket(s, {
      dow: n.dow, day: n.day, mon: n.mon,
      title: esc(p ? p.eventName : v.short),
      sub: `${n.night}${i.promoterName ? `<br>Guest of ${esc(i.promoterName)}` : ''}`,
      label: `Guest list &middot; Admit ${1 + plus}`,
      body: qrBody(s, { qr, pass, title: 'Show this at the door', line: door }),
      band: cutoff,
    }),
    buttons(s, ['Open my pass', pass], ['Add to calendar', cal]),
    friendsLine,
    deal ? dealCard(s, deal) : '',
    sideCard(s, {
      image: s.hero,
      outlookImage: `${site}${v.booth}`,
      title: esc(booth.heading),
      body: esc(booth.intro),
      link: ['Book a booth', `${RESERVATIONS}/on/${v.onKey}`],
    }),
    know(s, [
      ['Bring ID', 'Valid photo ID, 18+.'],
      ['Door rules', 'Capacity, dress code and management discretion apply.'],
      p
        ? ['Your group', 'Come together, or show the same QR again when the rest arrive.']
        : ['One each', 'Only checked-in guests count toward rewards.'],
    ]),
    footer(s, `You're getting this because you ${p ? `registered for the ${esc(p.eventName)}` : `joined the ${esc(v.short)} guest list`}.`, { extra: whatsapp }),
  ]

  const subject = brandedSubject(i)
  const preheader = `${v.short}, ${n.night}. Your QR is inside${i.untilLabel ? `. Guest list closes ${i.untilLabel} sharp` : ''}.`
  return shell(s, subject, preheader, rows)
}
