import { sendEmail, type SendResult } from './send'
import { occasionDeal, RESERVATIONS_URL } from '@/lib/occasion-packages'
import { RESERVATIONS, themeFor } from '@/lib/venue-theme'
import {
  GROUP_PHONE, LUNA_FROM, clubSkin, dealCard, esc, footer, header, helpLine, intro, lunaSkin, nightLabel, shell,
  sideCard, siteUrl, venueFrom,
} from './blocks'

export interface BoothOfferInput {
  first: string
  venue: string
  venueSlug?: string | null
  occasion?: string | null
  eventDate?: string | null
  /** This app's origin, for images. Defaults to NEXT_PUBLIC_SITE_URL. */
  site?: string
}

const OCCASION_REASON: Record<string, string> = {
  'Birthday': ' for your birthday',
  'Hens party': ' for your hens party',
  'Bucks party': ' for your bucks party',
}

/**
 * The VIP booth offer, as the venue's own email (the 22 Oct 2026 redesign).
 * A club gets its photo, colours and booth; a venue without a theme gets the
 * Luna Group look. The free guest list deal shows for a birthday, hens or
 * bucks, the same deal the confirmation carries.
 */
export function boothOfferEmail(o: BoothOfferInput): { subject: string; from: string; html: string } {
  const site = (o.site || siteUrl()).replace(/\/$/, '')
  const theme = themeFor(o.venueSlug)
  const s = theme ? clubSkin(theme, site, o.venue) : lunaSkin(site)
  const short = theme ? theme.short : (o.venue || '').trim() || 'Luna Group'
  const occ = (o.occasion || '').trim()
  const night = o.eventDate ? nightLabel(o.eventDate) : null
  const deal = occasionDeal(occ)
  const booth = theme ? `${site}${theme.booth}` : null

  const rows = [
    header(s, 200),
    intro(s, {
      kicker: occ ? `${esc(occ)} at ${esc(short)}` : `VIP booths at ${esc(short)}`,
      headline: `Make it a booth, ${esc(o.first || 'there')}`,
      lead: night
        ? `You&rsquo;re on the list for ${night}. Want the VIP treatment for the group?`
        : 'Want the VIP treatment for the group?',
    }),
    sideCard(s, {
      image: booth,
      outlookImage: booth,
      title: esc(theme?.boothT || 'Book a VIP booth'),
      body: esc(theme?.boothP || 'Bottle service and the best seats in the house.'),
      link: ['See the booths', theme ? `${RESERVATIONS}/on/${theme.onKey}` : RESERVATIONS_URL],
    }),
    deal ? dealCard(s, deal) : '',
    helpLine(s, theme
      ? `Questions about a booth? Call ${esc(short)} on <b style="color:${s.ink}">${GROUP_PHONE}</b>.`
      : `Questions about a booth? Call us on <b style="color:${s.ink}">${GROUP_PHONE}</b>.`),
    footer(s, `You're getting this because you're on the ${esc(short)} guest list${OCCASION_REASON[occ] ?? ''}.`),
  ]

  const subject = `${occ ? `${occ} at ${short}` : short}: want a VIP booth?`
  const preheader = night
    ? `You're on the list for ${night.split(' ')[0]}. Here's how to make it a booth.`
    : "Here's how to make it a booth."
  return { subject, from: theme ? venueFrom(o.venue) : LUNA_FROM, html: shell(s, subject, preheader, rows) }
}

/**
 * The VIP booth offer as a follow-up, sent from the Guestlists page for a
 * birthday / hens / bucks registration.
 */
export function sendBoothOfferEmail(o: {
  to: string; first: string; venue: string; venueSlug?: string | null; occasion?: string | null; eventDate?: string | null
}): Promise<SendResult> {
  const m = boothOfferEmail(o)
  return sendEmail(o.to, m.subject, m.html, m.from)
}
