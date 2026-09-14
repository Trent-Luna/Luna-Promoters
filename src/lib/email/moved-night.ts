import { sendEmail, emailShell, emailCard, goldButton, type SendResult } from './send'

/**
 * "We've moved your birthday — here's the new night."
 *
 * Trent, 14 Sep 2026: "yes email them like you have mocked up."
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
  /** The night they were originally listed for. "Monday 14 September". */
  was: string
  /** The night or nights they are on now, already formatted, in order. */
  nights: string[]
  /** Their QR page, so the email is also the ticket. Optional. */
  qrUrl?: string | null
  /** "Birthday", "Hens party" — whatever is on the registration. */
  occasion?: string | null
}

export function sendMovedNightEmail(o: MovedNightEmail): Promise<SendResult> {
  const occ = (o.occasion || 'birthday').trim().toLowerCase()
  const one = o.nights.length === 1
  const nightsLine = one
    ? o.nights[0]
    : `${o.nights.slice(0, -1).join(', ')} and ${o.nights[o.nights.length - 1]}`

  const intro = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px"><tr><td align="center">
      <h1 style="font-size:22px;margin:0 0 6px;color:#ffffff">Hey ${o.first} 👋</h1>
      <p style="color:#9ca3af;margin:0">A small change to your ${occ} at ${o.venue}</p>
    </td></tr></table>`

  const body = emailCard(`
    <p style="color:#ffffff;font-size:15px;margin:0 0 14px;line-height:1.55">
      We're not open on ${o.was} — so we've moved you to:
    </p>
    <p style="color:#d4a24c;font-size:20px;font-weight:800;margin:0 0 14px;line-height:1.4">
      ${o.nights.join('<br>')}
    </p>
    <p style="color:#9ca3af;font-size:14px;margin:0 0 6px;line-height:1.55">
      ${one
        ? `You're on the list for ${nightsLine} — nothing else changes, and there's nothing you need to do.`
        : `You're on the list for <strong style="color:#ffffff">both</strong> nights, so come whichever suits you. Nothing else changes, and there's nothing you need to do.`}
    </p>
    <p style="color:#9ca3af;font-size:14px;margin:14px 0 0;line-height:1.55">
      Sorry for the mix-up — that one was on us. Have a great ${occ}.
    </p>
    ${o.qrUrl ? `<p style="margin:18px 0 0">${goldButton(o.qrUrl, 'Show my QR code')}</p>` : ''}
  `)

  const subject = one
    ? `Your ${occ} at ${o.venue} — we've moved you to ${o.nights[0]}`
    : `Your ${occ} at ${o.venue} — we've moved you to the weekend`

  return sendEmail(o.to, subject, emailShell('GUESTLIST', intro + body))
}
