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
