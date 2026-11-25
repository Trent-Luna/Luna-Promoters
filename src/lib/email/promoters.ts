import { sendEmail, type SendResult } from './send'
import { actionCard, buttons, esc, footer, header, intro, lunaSkin, panel, para, shell, siteUrl, steps, tones } from './blocks'
import { WHATSAPP_CHANNEL_BODY, WHATSAPP_CHANNEL_TITLE } from '@/lib/whatsapp-copy'

/**
 * Promoter emails, in the Luna Group look Trent approved on 22 Oct 2026.
 *
 * The welcome that actually sends is welcomeHtml in
 * supabase/functions/promoter-emails — an edge function cannot import these
 * blocks. promoterWelcomeEmail is that same email, so it can be rendered and
 * tested. Keep the two in step; the wording lives in src/lib/whatsapp-copy.ts.
 */

const REASON = "You're getting this because you're a Luna Group promoter."
const WELCOME_REASON = "You're getting this because you were approved as a Luna Group promoter."

const firstName = (fullName: string) => esc((fullName || '').split(' ')[0] || 'there')

/** The welcome a new promoter receives. Blank invite → the card is left out. */
export function promoterWelcomeEmail(
  fullName: string,
  code: string,
  inviteUrl: string | null,
): { subject: string; html: string } {
  const site = siteUrl()
  const s = lunaSkin(site)
  const first = firstName(fullName)
  const link = `${site}/p/${code}`
  const invite = inviteUrl?.trim() || null
  const items: [string, string][] = [
    ['Your guest list link', `<a href="${esc(link)}" style="color:${s.acc}">${esc(link.replace(/^https?:\/\//, ''))}</a>. Share it anywhere; everyone who signs up is on your list.`],
    ['Your dashboard', 'See who&rsquo;s signed up and who checked in.'],
  ]
  const note = `<div style="font-family:${s.body};font-weight:700;font-size:18px;line-height:1.25;color:${s.ink}">${WHATSAPP_CHANNEL_TITLE}</div>`
    + `<div style="font-family:${s.body};font-size:14px;line-height:1.55;color:${tones(s).muted};padding-top:8px">${WHATSAPP_CHANNEL_BODY.replace(/\u2019/g, '&rsquo;')}</div>`
  const rows = [
    header(s),
    intro(s, {
      kicker: 'Promoters &middot; welcome',
      headline: `You&rsquo;re in, ${first}`,
      lead: 'Welcome to the Luna Group promoter team. Two things and you&rsquo;re running.',
      top: 22,
    }),
    ...(invite ? [actionCard(s, { eyebrow: 'WhatsApp Channel', note, button: ['Follow', invite] })] : []),
    panel(s, steps(s, items)),
    buttons(s, ['Open my dashboard', `${site}/promoter`]),
    para(s, 'New to this? The Promoter Guide is on your dashboard.', { top: 14, size: 13 }),
    footer(s, WELCOME_REASON, { sisters: false }),
  ]
  const subject = "You're in: your Luna guest list link"
  const preheader = invite
    ? 'All guest list links, headliner drops and promoter perks go out first in our WhatsApp Channel.'
    : 'Your link and your dashboard.'
  return { subject, html: shell(s, subject, preheader, rows) }
}

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
