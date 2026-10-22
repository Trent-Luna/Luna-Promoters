// Shared Resend sender for transactional email. Never logs the key.
const FROM = 'Luna Group <noreply@lunagroup.com.au>'

export type SendResult = { ok: true } | { ok: false; reason: string }

/**
 * Sends one email. `from` defaults to Luna Group; a venue's own email passes
 * its name (brandedFrom), so the guest sees the venue in their inbox.
 */
export async function sendEmail(to: string, subject: string, html: string, from: string = FROM): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY
  if (!key) return { ok: false, reason: 'email_not_configured' }
  if (!to) return { ok: false, reason: 'no_email' }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, html }),
    })
    if (!res.ok) return { ok: false, reason: 'send_failed' }
    return { ok: true }
  } catch {
    return { ok: false, reason: 'send_failed' }
  }
}
