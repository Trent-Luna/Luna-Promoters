import { sendEmail, type SendResult } from './send'
import { nightParts, themeFor } from '@/lib/venue-theme'
import {
  B, LUNA_FROM, buttons, clubSkin, esc, footer, header, intro, lunaSkin, para, shell, siteUrl, ticket, venueFrom,
} from './blocks'

/**
 * "We've moved your birthday — here's the new night."
 *
 * Trent, 14 Sep 2026: "yes email them like you have mocked up." Redesigned on
 * 22 Oct 2026 into the venue's own look, with the new night as a ticket.
 *
 * WHY THIS EMAIL HAD TO EXIST. Moving a database row does not move a guest.
 * Twenty-seven people were holding a confirmation and a QR code naming a night
 * the venue is shut; the records were corrected in minutes and every one of
 * those guests would still have turned up on the wrong day. Jasmine's was
 * tonight.
 *
 * ── WHAT IT SAYS AND WHY ────────────────────────────────────────────────────
 *
 * It leads with the NEW night, because that is the one fact that changes what
 * the guest does. The old date appears once, as the reason, and is never the
 * headline — nobody needs to re-read the mistake.
 *
 * It apologises plainly and briefly. This was our error: an automation put them
 * on a closed night. A long apology reads as a bigger problem than it is.
 *
 * It does NOT ask them to do anything. No confirm link, no reply-to-accept.
 * They are already on the list; making them act to keep a place they already
 * had is how a venue loses the booking it was trying to save.
 *
 * TWO NIGHTS WHERE THERE ARE TWO. The Eclipse guests are on the Friday and the
 * Saturday, because the venue only trades the weekend and we would rather they
 * had the choice than guess which they wanted. Su Casa trades midweek, so those
 * guests get the single night after their birthday instead of a weekend two
 * days further away. The email simply says which nights they are on — the rule
 * behind it is ours to worry about, not theirs.
 */

export interface MovedNightEmail {
  to: string
  first: string
  venue: string
  /** venues.slug: picks the venue's look. A venue with no theme gets Luna's. */
  venueSlug?: string | null
  /** The night they were originally listed for. "Monday 14 September". */
  was: string
  /** The night or nights they are on now, already formatted, in order. */
  nights: string[]
  /** The same nights as YYYY-MM-DD, in the same order, for the ticket stubs. */
  nightDates: string[]
  /** Their QR page, so the email is also the ticket. Optional. */
  qrUrl?: string | null
  /** "Birthday", "Hens party" — whatever is on the registration. */
  occasion?: string | null
  /** Friends on the same registration; the ticket admits them too. */
  plusOnes?: number | null
}

export function movedNightEmail(o: Omit<MovedNightEmail, 'to'> & { site?: string }): { subject: string; from: string; html: string } {
  const site = (o.site || siteUrl()).replace(/\/$/, '')
  const theme = themeFor(o.venueSlug)
  const s = theme ? clubSkin(theme, site, o.venue) : lunaSkin(site)
  const short = theme ? theme.short : (o.venue || '').trim() || 'Luna Group'
  const occ = (o.occasion || 'birthday').trim().toLowerCase()
  const one = o.nights.length === 1
  const weekday = (o.nights[0] || '').split(' ')[0]
  const admit = 1 + Math.max(0, o.plusOnes ?? 0)
  const was = esc(o.was)

  const tickets = o.nightDates.map((iso, i) => {
    const n = nightParts(iso)
    return ticket(s, {
      dow: n.dow, day: n.day, mon: n.mon,
      title: esc(short),
      sub: esc(o.nights[i] ?? n.night),
      label: `Guest list &middot; Admit ${admit}`,
      body: one
        ? `<div style="${B(s, 14, s.ink)}">You&rsquo;re on the list for ${esc(weekday)}. Nothing else changes, and there&rsquo;s nothing you need to do.</div>`
        : null,
    })
  })

  const rows = [
    header(s, 170),
    intro(s, {
      kicker: 'A small change',
      headline: one ? `We&rsquo;ve moved you to ${esc(weekday)}` : 'We&rsquo;ve moved you to the weekend',
      lead: one
        ? `We&rsquo;re not open on ${was}, so your ${esc(occ)} is now on:`
        : `We&rsquo;re not open on ${was}, so you&rsquo;re on the list for both nights:`,
    }),
    ...tickets,
    one ? '' : para(s, 'Come whichever suits you. Nothing else changes, and there&rsquo;s nothing you need to do.', { top: 16, size: 14 }),
    o.qrUrl ? buttons(s, ['Show my QR code', o.qrUrl]) : '',
    para(s, `Sorry for the mix-up: that one was on us. Have a great ${esc(occ)}.`, { top: 16, size: 14 }),
    footer(s, `You're getting this because you're on the ${esc(short)} guest list.`),
  ]

  const subject = one
    ? `Your ${occ} at ${short}: we've moved you to ${o.nights[0]}`
    : `Your ${occ} at ${short}: we've moved you to the weekend`
  const preheader = one
    ? `We're not open ${o.was}. You're on the list for ${weekday}; nothing else to do.`
    : `We're not open ${o.was}. You're on the list for both nights; nothing else to do.`
  return { subject, from: theme ? venueFrom(o.venue) : LUNA_FROM, html: shell(s, subject, preheader, rows) }
}

export function sendMovedNightEmail(o: MovedNightEmail): Promise<SendResult> {
  const m = movedNightEmail(o)
  return sendEmail(o.to, m.subject, m.html, m.from)
}
