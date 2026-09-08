import { sendEmail, emailShell, emailCard, goldButton, type SendResult } from './send'

/**
 * Re-engagement note for a promoter who has gone quiet. Deliberately short:
 * one reason to come back, their link, one button. Sent by an admin from the
 * Promoters page — never automatically.
 */
export function sendPromoterNudge(to: string, fullName: string, code: string): Promise<SendResult> {
  const site = (process.env.NEXT_PUBLIC_SITE_URL || 'https://promoter.lunagroup.com.au').replace(/\/$/, '')
  const link = `${site}/p/${code}`
  const first = (fullName || '').split(' ')[0] || 'there'
  const inner = emailCard(
    `<h1 style="font-size:20px;margin:0 0 12px;color:#ffffff">We miss you on the list, ${first} 👋</h1>
     <p style="color:#9ca3af;line-height:1.6;margin:0 0 12px">Your guestlist link is still live and still counts toward your tier — every guest who checks in through it moves you up the leaderboard this month.</p>
     <p style="color:#9ca3af;line-height:1.6;margin:0 0 14px">Your link: <a href="${link}" style="color:#d4a24c">${link.replace(/^https?:\/\//, '')}</a></p>
     ${goldButton(`${site}/promoter`, 'Open my dashboard →')}
     <p style="color:#6b7280;font-size:12px;margin:18px 0 0">Not promoting any more? No problem — just ignore this and we will leave you be.</p>`
  )
  return sendEmail(to, 'Your Luna Group guestlist link is still live', emailShell('PROMOTERS', inner))
}

/**
 * The Luna Group WhatsApp Channel invite.
 *
 * Sent when someone is approved as a promoter, and as a one-off catch-up to
 * promoters who signed up before the channel existed. Email rather than a
 * WhatsApp message because Resend is the only channel wired here — and because
 * WhatsApp's own API cannot add anyone to a channel or a group either way.
 * They have to tap and follow.
 *
 * The copy deliberately does not promise a reply: a Channel is one-way, and a
 * promoter who messages it expecting an answer gets silence.
 */
export function sendWhatsappInvite(
  to: string,
  fullName: string,
  inviteUrl: string,
  variant: 'welcome' | 'catch_up' = 'welcome',
): Promise<SendResult> {
  const site = (process.env.NEXT_PUBLIC_SITE_URL || 'https://promoter.lunagroup.com.au').replace(/\/$/, '')
  const first = (fullName || '').split(' ')[0] || 'there'

  const opening =
    variant === 'welcome'
      ? `<h1 style="font-size:20px;margin:0 0 12px;color:#ffffff">You're in, ${first} 👋</h1>
         <p style="color:#9ca3af;line-height:1.6;margin:0 0 12px">One last thing: follow the Luna Group channel on WhatsApp. Guestlist cut-offs, table drops, what's on across every venue — it goes out there first.</p>`
      : `<h1 style="font-size:20px;margin:0 0 12px;color:#ffffff">Follow the Luna channel, ${first}</h1>
         <p style="color:#9ca3af;line-height:1.6;margin:0 0 12px">We run a Luna Group channel on WhatsApp now — guestlist cut-offs, table drops and what's on across every venue go out there first. You signed up before it existed, so here's the link.</p>`

  const inner = emailCard(
    `${opening}
     <p style="color:#9ca3af;line-height:1.6;margin:0 0 14px">Tap below and WhatsApp will ask you to follow. Your number stays private — nobody else in the channel can see it.</p>
     <a href="${inviteUrl}" style="display:inline-block;background:#25D366;color:#0a0a0f;font-weight:700;text-decoration:none;padding:13px 26px;border-radius:10px;margin-top:4px">Follow on WhatsApp →</a>
     <p style="color:#9ca3af;line-height:1.6;margin:18px 0 0">Need something from us? The channel doesn't take replies — your dashboard and guestlist link are at <a href="${site}/promoter" style="color:#d4a24c">${site.replace(/^https?:\/\//, '')}/promoter</a>.</p>
     <p style="color:#6b7280;font-size:12px;margin:16px 0 0">Not promoting any more? Ignore this and we will leave you be.</p>`,
  )

  return sendEmail(
    to,
    variant === 'welcome' ? 'Follow the Luna Group WhatsApp channel' : "You're missing the Luna WhatsApp channel",
    emailShell('PROMOTERS', inner),
  )
}
