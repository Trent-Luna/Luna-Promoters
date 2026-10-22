import { sendEmail, type SendResult } from './send'
import { buttons, esc, footer, header, intro, lunaSkin, para, shell, siteUrl } from './blocks'

/**
 * Promoter emails, in the Luna Group look Trent approved on 22 Oct 2026.
 * The welcome itself goes from the promoter-emails edge function, which
 * carries its own copy of these blocks.
 */

const REASON = "You're getting this because you're a Luna Group promoter."

const firstName = (fullName: string) => esc((fullName || '').split(' ')[0] || 'there')

/** A channel link (whatsapp.com/channel/…) rather than a group invite. */
function isChannel(url: string): boolean {
  try {
    return new URL(url.trim()).hostname.replace(/^www\./, '') === 'whatsapp.com'
  } catch {
    return false
  }
}

/**
 * Re-engagement note for a promoter who has gone quiet. Deliberately short:
 * their link, one button. Sent by an admin from the Promoters page — never
 * automatically.
 */
export function promoterNudgeEmail(fullName: string, code: string): { subject: string; html: string } {
  const site = siteUrl()
  const s = lunaSkin(site)
  const link = `${site}/p/${code}`
  const rows = [
    header(s),
    intro(s, {
      kicker: 'Promoters',
      headline: `We miss you on the list, ${firstName(fullName)}`,
      lead: `Your guest list link is still live: <a href="${esc(link)}" style="color:${s.acc}">${esc(link.replace(/^https?:\/\//, ''))}</a>`,
      top: 22,
    }),
    buttons(s, ['Open my dashboard', `${site}/promoter`]),
    para(s, 'Not promoting any more? No problem, just ignore this and we&rsquo;ll leave you be.', { top: 16, size: 13 }),
    footer(s, REASON, { sisters: false }),
  ]
  const subject = 'Your Luna Group guest list link is still live'
  return { subject, html: shell(s, subject, 'Share it before the weekend. Your dashboard is one tap away.', rows) }
}

export function sendPromoterNudge(to: string, fullName: string, code: string): Promise<SendResult> {
  const m = promoterNudgeEmail(fullName, code)
  return sendEmail(to, m.subject, m.html)
}

/**
 * The promoter WhatsApp channel invite.
 *
 * Sent when someone is approved as a promoter, and as a one-off catch-up to
 * promoters who signed up before the channel existed. Email rather than a
 * WhatsApp message because Resend is the only channel wired here — and because
 * WhatsApp's own API cannot add anyone to a channel or a group either way.
 * They have to tap and follow.
 *
 * The copy deliberately does not promise a reply: a Channel is one-way, and a
 * promoter who messages it expecting an answer gets silence. "Your number
 * stays private" is only said of a channel; a group shows members' numbers.
 */
export function whatsappInviteEmail(
  fullName: string,
  inviteUrl: string,
  variant: 'welcome' | 'catch_up' = 'welcome',
): { subject: string; html: string } {
  const site = siteUrl()
  const s = lunaSkin(site)
  const first = firstName(fullName)
  const dashboard = `<a href="${esc(`${site}/promoter`)}" style="color:${s.acc}">your dashboard</a>`
  const rows = [
    header(s),
    intro(s, variant === 'welcome'
      ? {
          kicker: 'Promoters &middot; channel',
          headline: `You&rsquo;re in, ${first}`,
          lead: 'One last thing: follow the promoter channel on WhatsApp. Guest list cut-offs, table drops and which rooms need numbers all go out there first.',
          top: 22,
        }
      : {
          kicker: 'Promoters &middot; channel',
          headline: `Follow the promoter channel, ${first}`,
          lead: 'Guest list cut-offs, table drops and which rooms need numbers all go out there first. You signed up before it existed, so here&rsquo;s the link.',
          top: 22,
        }),
    buttons(s, ['Follow on WhatsApp', inviteUrl]),
    para(s, isChannel(inviteUrl)
      ? `Your number stays private: a channel doesn&rsquo;t show followers to each other. The channel doesn&rsquo;t take replies, so for anything else use ${dashboard}.`
      : `For anything else, use ${dashboard}.`, { top: 16, size: 13 }),
    para(s, 'Not promoting any more? Ignore this and we&rsquo;ll leave you be.', { top: 10, size: 13 }),
    footer(s, REASON, { sisters: false }),
  ]
  const subject = 'Follow the Luna promoter WhatsApp channel'
  return { subject, html: shell(s, subject, 'Cut-offs, table drops and which rooms need numbers, first.', rows) }
}

export function sendWhatsappInvite(
  to: string,
  fullName: string,
  inviteUrl: string,
  variant: 'welcome' | 'catch_up' = 'welcome',
): Promise<SendResult> {
  const m = whatsappInviteEmail(fullName, inviteUrl, variant)
  return sendEmail(to, m.subject, m.html)
}
