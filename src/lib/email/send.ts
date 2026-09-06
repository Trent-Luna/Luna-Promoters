// Shared Resend sender for transactional email. Never logs the key.
const FROM = 'Luna Group <noreply@lunagroup.com.au>'

export type SendResult = { ok: true } | { ok: false; reason: string }

export async function sendEmail(to: string, subject: string, html: string): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY
  if (!key) return { ok: false, reason: 'email_not_configured' }
  if (!to) return { ok: false, reason: 'no_email' }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [to], subject, html }),
    })
    if (!res.ok) return { ok: false, reason: 'send_failed' }
    return { ok: true }
  } catch {
    return { ok: false, reason: 'send_failed' }
  }
}

/** The dark, table-based frame every Luna email uses. */
export function emailShell(kicker: string, inner: string, footer = 'Luna Group Hospitality · Brisbane & Gold Coast'): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;padding:0;background:#0a0a0f;font-family:Helvetica,Arial,sans-serif;color:#ffffff">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f"><tr><td align="center" style="padding:28px 14px">
      <table role="presentation" width="500" cellpadding="0" cellspacing="0" style="width:500px;max-width:500px;margin:0 auto">
        <tr><td align="center" style="font-size:22px;font-weight:800;letter-spacing:3px;color:#ffffff">LUNA GROUP</td></tr>
        <tr><td align="center" style="font-size:12px;letter-spacing:2px;color:#9ca3af;padding-top:2px">${kicker}</td></tr>
        <tr><td>${inner}</td></tr>
        <tr><td align="center" style="color:#6b7280;font-size:11px;padding-top:18px">${footer}</td></tr>
      </table>
    </td></tr></table>
  </body></html>`
}

export function emailCard(inner: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#14141c;border:1px solid #23232e;border-radius:16px;margin-top:24px"><tr><td style="padding:28px">${inner}</td></tr></table>`
}

export function goldButton(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:#d4a24c;color:#0a0a0f;font-weight:700;text-decoration:none;padding:13px 26px;border-radius:10px;margin-top:8px">${label}</a>`
}
