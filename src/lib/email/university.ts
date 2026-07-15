// University membership transactional emails (reuses the existing Resend setup).
// No internal AI scores or fraud logic is ever exposed to the applicant.

const FROM = 'Luna Group <noreply@lunagroup.com.au>'

function membershipsBase(): string {
  return (
    process.env.NEXT_PUBLIC_MEMBERSHIPS_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'https://memberships.lunagroup.com.au'
  ).replace(/\/$/, '')
}

function shell(title: string, bodyInner: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;padding:0;background:#0a0a0f;font-family:Helvetica,Arial,sans-serif;color:#ffffff">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f"><tr><td align="center" style="padding:28px 14px">
      <table role="presentation" width="500" cellpadding="0" cellspacing="0" style="width:500px;max-width:500px;margin:0 auto">
        <tr><td align="center" style="font-size:22px;font-weight:800;letter-spacing:3px;color:#ffffff">LUNA GROUP</td></tr>
        <tr><td align="center" style="font-size:12px;letter-spacing:2px;color:#9ca3af;padding-top:2px">UNIVERSITY MEMBERSHIP</td></tr>
        <tr><td>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#14141c;border:1px solid #23232e;border-radius:16px;margin-top:24px"><tr><td style="padding:28px">
            <h1 style="font-size:20px;margin:0 0 12px;color:#ffffff">${title}</h1>
            ${bodyInner}
          </td></tr></table>
        </td></tr>
        <tr><td align="center" style="color:#6b7280;font-size:11px;padding-top:18px">Luna Group Hospitality · Brisbane</td></tr>
      </table>
    </td></tr></table>
  </body></html>`
}

function btn(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:#ffffff;color:#0a0a0f;font-weight:700;text-decoration:none;padding:13px 26px;border-radius:10px;margin-top:8px">${label}</a>`
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

export function sendApplicationReceived(to: string, firstName: string) {
  const html = shell('We’ve received your application 👋',
    `<p style="color:#cbd5e1;line-height:1.6;margin:0 0 12px">Hi ${firstName || 'there'},</p>
     <p style="color:#9ca3af;line-height:1.6;margin:0 0 12px">Thanks for applying for a Luna University Membership. Your university ID is being checked now — this usually only takes a moment. We’ll email you as soon as it’s confirmed.</p>`)
  return send(to, 'Your Luna University Membership application', html)
}

export function sendApproved(to: string, firstName: string, passToken: string) {
  const url = `${membershipsBase()}/m/${passToken}`
  const html = shell('Your membership is approved 🎉',
    `<p style="color:#cbd5e1;line-height:1.6;margin:0 0 12px">Hi ${firstName || 'there'},</p>
     <p style="color:#9ca3af;line-height:1.6;margin:0 0 18px">Your Luna University Membership has been approved. Open your digital pass on your phone and show the QR code at reception.</p>
     ${btn(url, 'View my membership pass')}`)
  return send(to, 'Your Luna University Membership is approved', html)
}

export function sendManualReview(to: string, firstName: string) {
  const html = shell('Your application is being reviewed',
    `<p style="color:#cbd5e1;line-height:1.6;margin:0 0 12px">Hi ${firstName || 'there'},</p>
     <p style="color:#9ca3af;line-height:1.6;margin:0 0 12px">We couldn’t automatically confirm all the details on your university ID, so a member of our team is reviewing your application. We’ll be in touch shortly — no action is needed right now.</p>`)
  return send(to, 'Your Luna University Membership application is under review', html)
}

export function sendNewUploadRequested(to: string, firstName: string, passToken: string) {
  const url = `${membershipsBase()}/m/${passToken}/reupload`
  const html = shell('Please upload a clearer university ID',
    `<p style="color:#cbd5e1;line-height:1.6;margin:0 0 12px">Hi ${firstName || 'there'},</p>
     <p style="color:#9ca3af;line-height:1.6;margin:0 0 18px">To finish verifying your Luna University Membership, we need a clearer or more current photo of your university ID. You don’t need to re-apply — just upload a new photo using the secure link below.</p>
     ${btn(url, 'Upload a new photo')}`)
  return send(to, 'Action needed: upload a clearer university ID', html)
}

export function sendRejected(to: string, firstName: string) {
  const html = shell('About your membership application',
    `<p style="color:#cbd5e1;line-height:1.6;margin:0 0 12px">Hi ${firstName || 'there'},</p>
     <p style="color:#9ca3af;line-height:1.6;margin:0 0 12px">Thanks for your interest in a Luna University Membership. Unfortunately we weren’t able to approve your application at this time. If you believe this was a mistake or your circumstances change, you’re welcome to apply again with a current university ID.</p>`)
  return send(to, 'Your Luna University Membership application', html)
}
