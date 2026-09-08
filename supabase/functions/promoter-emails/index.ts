/**
 * Luna Promoters · outbound email jobs.
 *
 * Lives as an edge function, not in the Next.js app, for the same reason
 * birthday-reminders does: the schedule is pg_cron, the secrets are already
 * here, and it ships without a front-end deploy.
 *
 * Two jobs, both idempotent and both dry-runnable:
 *
 *   welcome          new promoters, once, shortly after they sign up
 *   whatsapp_invite  the one-off catch-up to promoters who joined before the
 *                    channel existed
 *
 * Both write their timestamp only AFTER a successful send, so a bounce or a
 * crash leaves that person eligible next run rather than silently skipped.
 *
 * POST body: { job?: 'welcome' | 'whatsapp_invite', dry_run?: boolean, limit?: number }
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND = Deno.env.get('RESEND_API_KEY')!
const SITE = 'https://promoter.lunagroup.com.au'
const FROM = 'Luna Group <noreply@lunagroup.com.au>'

/** A welcome sent long after signup reads as a mistake, so new signups only. */
const WELCOME_WINDOW_DAYS = 14

const esc = (s: unknown) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const J = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } })

const rest = (path: string, init: RequestInit = {}) =>
  fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SK, Authorization: `Bearer ${SK}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })

// ------------------------------------------------------------------ shell ---
function shell(kicker: string, inner: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:Helvetica,Arial,sans-serif;color:#ffffff">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f"><tr><td align="center" style="padding:28px 14px">
  <table role="presentation" width="500" cellpadding="0" cellspacing="0" style="width:500px;max-width:500px;margin:0 auto">
    <tr><td align="center" style="font-size:22px;font-weight:800;letter-spacing:3px;color:#ffffff">LUNA GROUP</td></tr>
    <tr><td align="center" style="font-size:12px;letter-spacing:2px;color:#9ca3af;padding-top:2px">${kicker}</td></tr>
    <tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#14141c;border:1px solid #23232e;border-radius:16px;margin-top:24px"><tr><td style="padding:28px">${inner}</td></tr></table></td></tr>
    <tr><td align="center" style="color:#6b7280;font-size:11px;padding-top:18px">Luna Group Hospitality · Brisbane &amp; Gold Coast</td></tr>
  </table>
</td></tr></table></body></html>`
}

const greenButton = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;background:#25D366;color:#0a0a0f;font-weight:700;text-decoration:none;padding:13px 26px;border-radius:10px">${label}</a>`

const goldButton = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;background:#d4a24c;color:#0a0a0f;font-weight:700;text-decoration:none;padding:13px 26px;border-radius:10px">${label}</a>`

const step = (n: number, title: string, body: string) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 14px"><tr>
     <td width="30" valign="top" style="color:#d4a24c;font-weight:800;font-size:14px">${n}</td>
     <td style="color:#d1d5db;font-size:14px;line-height:1.55"><strong style="color:#ffffff">${title}</strong><br>${body}</td>
   </tr></table>`

// ----------------------------------------------------------------- emails ---
function welcomeHtml(first: string, code: string, invite: string | null) {
  const link = `${SITE}/p/${esc(code)}`
  return shell('PROMOTERS', `
    <h1 style="font-size:21px;margin:0 0 10px;color:#ffffff">You're in, ${esc(first)} 👋</h1>
    <p style="color:#9ca3af;line-height:1.6;margin:0 0 20px">Welcome to the Luna Group promoter team. Three things and you're running.</p>
    ${step(1, 'Your guestlist link', `Anyone who signs up through it counts toward your numbers and your tier.<br><a href="${link}" style="color:#d4a24c">${link.replace(/^https?:\/\//, '')}</a>`)}
    ${step(2, 'Your dashboard', 'Your QR code, live numbers and where you sit on the leaderboard.')}
    ${invite ? step(3, 'The promoter channel', 'Guestlist cut-offs, table drops and which rooms need numbers go out there first. Your number stays private.') : ''}
    <div style="margin-top:18px">${goldButton(`${SITE}/promoter`, 'Open my dashboard →')}</div>
    ${invite ? `<div style="margin-top:12px">${greenButton(invite, 'Follow the channel →')}</div>` : ''}
    <p style="color:#6b7280;font-size:12px;margin:20px 0 0">New to this? The Promoter Guide is on your dashboard.</p>`)
}

function inviteHtml(first: string, invite: string) {
  return shell('PROMOTERS', `
    <h1 style="font-size:20px;margin:0 0 12px;color:#ffffff">Follow the promoter channel, ${esc(first)}</h1>
    <p style="color:#9ca3af;line-height:1.6;margin:0 0 12px">We run a promoter channel on WhatsApp now — guestlist cut-offs, table drops and which rooms need numbers all go out there first. You signed up before it existed, so here's the link.</p>
    <p style="color:#9ca3af;line-height:1.6;margin:0 0 16px">Tap below and WhatsApp will ask you to follow. Your number stays private — nobody else in the channel can see it.</p>
    ${greenButton(invite, 'Follow on WhatsApp →')}
    <p style="color:#9ca3af;line-height:1.6;margin:18px 0 0">Need something from us? The channel doesn't take replies — your dashboard and guestlist link are at <a href="${SITE}/promoter" style="color:#d4a24c">${SITE.replace(/^https?:\/\//, '')}/promoter</a>.</p>
    <p style="color:#6b7280;font-size:12px;margin:16px 0 0">Not promoting any more? Ignore this and we will leave you be.</p>`)
}

// -------------------------------------------------------------------- run ---
Deno.serve(async (req) => {
  let job = 'welcome', dry = false, limit = 500
  try {
    const b = await req.json()
    if (b?.job) job = String(b.job)
    if (b?.dry_run === true) dry = true
    if (Number(b?.limit) > 0) limit = Number(b.limit)
  } catch { /* cron posts an empty body — welcome is the default */ }
  if (job !== 'welcome' && job !== 'whatsapp_invite') return J({ error: 'unknown_job', job }, 400)

  const sRes = await rest('app_settings?id=eq.1&select=whatsapp_invite_url')
  const invite: string | null = (await sRes.json())?.[0]?.whatsapp_invite_url?.trim() || null
  if (job === 'whatsapp_invite' && !invite) return J({ error: 'no_invite_link' }, 400)

  const stamp = job === 'welcome' ? 'welcomed_at' : 'whatsapp_invited_at'
  let q = `promoters?select=id,full_name,email,promoter_code&status=eq.approved&${stamp}=is.null` +
          `&email=not.is.null&is_staff=eq.false&is_house=eq.false&order=created_at&limit=${limit}`
  if (job === 'welcome') {
    const since = new Date(Date.now() - WELCOME_WINDOW_DAYS * 86400000).toISOString()
    q += `&created_at=gte.${since}`
  }

  const rows = await (await rest(q)).json()
  if (!Array.isArray(rows)) return J({ error: 'query_failed', detail: rows }, 500)

  if (dry) {
    return J({
      dry_run: true, job, would_send: rows.length,
      sample: rows.slice(0, 60).map((r: any) => ({ name: r.full_name, email: r.email })),
    })
  }

  let sent = 0, failed = 0
  const errors: string[] = []
  for (const r of rows) {
    const first = String(r.full_name ?? '').split(' ')[0] || 'there'
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: FROM,
          to: [r.email],
          subject: job === 'welcome'
            ? "You're in — your Luna guestlist link"
            : 'Follow the Luna promoter WhatsApp channel',
          html: job === 'welcome'
            ? welcomeHtml(first, r.promoter_code ?? '', invite)
            : inviteHtml(first, invite as string),
        }),
      })
      if (!res.ok) { failed++; if (errors.length < 10) errors.push(await res.text()); continue }
      // Stamped only on success — a failure stays eligible for the next run.
      await rest(`promoters?id=eq.${r.id}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ [stamp]: new Date().toISOString() }),
      })
      sent++
      await new Promise((res) => setTimeout(res, 300)) // Resend rate limit
    } catch (e) {
      failed++
      if (errors.length < 10) errors.push(String(e))
    }
  }
  return J({ job, sent, failed, errors })
})
