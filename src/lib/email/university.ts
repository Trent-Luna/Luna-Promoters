// University membership transactional emails (reuses the existing Resend setup).
// No internal AI scores or fraud logic is ever exposed to the applicant.
//
// 22 Oct 2026: redesigned in the Luna Group look Trent approved, from the
// shared blocks in ./blocks.
import { actionCard, buttons, esc, footer, header, intro, lunaSkin, para, shell, siteUrl } from './blocks'

const FROM = 'Luna Group <noreply@lunagroup.com.au>'

function membershipsBase(): string {
  return (
    process.env.NEXT_PUBLIC_MEMBERSHIPS_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'https://memberships.lunagroup.com.au'
  ).replace(/\/$/, '')
}

const REASON = "You're getting this because you applied for a Luna University Membership."

type Built = { subject: string; html: string }

function build(subject: string, preheader: string, o: {
  kicker: string; headline: string; lead: string; rows?: string[]
}): Built {
  const s = lunaSkin(siteUrl())
  const rows = [
    header(s),
    intro(s, { kicker: o.kicker, headline: o.headline, lead: o.lead, top: 22 }),
    ...(o.rows ?? []),
    footer(s, REASON, { sisters: false }),
  ]
  return { subject, html: shell(s, subject, preheader, rows) }
}

const firstOf = (firstName: string) => esc(firstName || 'there')

/** Pure builders, one per email; the send functions below post them. */
export const universityEmails = {
  received(firstName: string): Built {
    return build('Your Luna University Membership application', "Your ID is being checked now. We'll email you when it's confirmed.", {
      kicker: 'University membership &middot; received',
      headline: `We&rsquo;ve got your application, ${firstOf(firstName)}`,
      lead: 'Your university ID is being checked now. This usually only takes a moment, and we&rsquo;ll email you as soon as it&rsquo;s confirmed.',
    })
  },
  approved(firstName: string, passToken: string): Built {
    const s = lunaSkin(siteUrl())
    return build('Your Luna University Membership is approved', 'Open your digital pass and show the QR at reception.', {
      kicker: 'University membership &middot; approved',
      headline: `You&rsquo;re a member, ${firstOf(firstName)}`,
      lead: 'Your Luna University Membership is approved. Open your digital pass on your phone and show the QR at reception.',
      rows: [
        buttons(s, ['View my membership pass', `${membershipsBase()}/m/${passToken}`]),
        para(s, 'Save it to your home screen so it&rsquo;s there when you get to the door.', { top: 16, size: 13 }),
      ],
    })
  },
  review(firstName: string): Built {
    void firstName
    return build('Your Luna University Membership application is under review', "Nothing you need to do. We'll email you when it's done.", {
      kicker: 'University membership &middot; in review',
      headline: 'We&rsquo;re checking your application',
      lead: 'A member of our team is reviewing it now. There&rsquo;s nothing you need to do; we&rsquo;ll email you as soon as it&rsquo;s done.',
    })
  },
  newUpload(firstName: string, passToken: string): Built {
    const s = lunaSkin(siteUrl())
    return build('Action needed: upload a clearer university ID', "We couldn't read your ID. A new photo takes a minute.", {
      kicker: 'University membership &middot; action needed',
      headline: `Upload a clearer ID, ${firstOf(firstName)}`,
      lead: 'We couldn&rsquo;t read your university ID, so we can&rsquo;t approve you yet.',
      rows: [
        actionCard(s, {
          eyebrow: 'New photo',
          note: 'Use good light, with the whole card in frame and nothing covering your name or the expiry date.',
          button: ['Upload a new photo', `${membershipsBase()}/m/${passToken}/reupload`],
        }),
      ],
    })
  },
  rejected(firstName: string): Built {
    void firstName
    const s = lunaSkin(siteUrl())
    return build('Your Luna University Membership application: an update', "We couldn't approve it this time. You can apply again with a current ID.", {
      kicker: 'University membership',
      headline: 'About your application',
      lead: 'We weren&rsquo;t able to approve your application this time. You&rsquo;re welcome to apply again with a current university ID.',
      rows: [buttons(s, ['Apply again', `${membershipsBase()}/memberships/university`])],
    })
  },
}

async function send(to: string, subject: string, html: string): Promise<{ ok: boolean; skipped?: string; error?: string }> {
  const key = process.env.RESEND_API_KEY
  if (!key) return { ok: false, skipped: 'email_not_configured' }
  if (!to) return { ok: false, skipped: 'no_email' }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [to], subject, html }),
    })
    if (!res.ok) return { ok: false, error: await res.text().catch(() => 'send_failed') }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'send_failed' }
  }
}

const post = (to: string, m: Built) => send(to, m.subject, m.html)

export function sendApplicationReceived(to: string, firstName: string) {
  return post(to, universityEmails.received(firstName))
}

export function sendApproved(to: string, firstName: string, passToken: string) {
  return post(to, universityEmails.approved(firstName, passToken))
}

export function sendManualReview(to: string, firstName: string) {
  return post(to, universityEmails.review(firstName))
}

export function sendNewUploadRequested(to: string, firstName: string, passToken: string) {
  return post(to, universityEmails.newUpload(firstName, passToken))
}

export function sendRejected(to: string, firstName: string) {
  return post(to, universityEmails.rejected(firstName))
}
