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
 * 22 Oct 2026: both emails redesigned in the Luna Group look Trent approved.
 * The blocks below are a copy of src/lib/email/blocks.ts (the Luna skin only),
 * because an edge function cannot import from the app. Keep them in step.
 *
 * Deploying this file is a live change: `supabase functions deploy promoter-emails`.
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
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

const J = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } })

const rest = (path: string, init: RequestInit = {}) =>
  fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SK, Authorization: `Bearer ${SK}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })

// ─────────────────────────────────────────── blocks (the Luna Group skin) ───
const S = {
  bg: '#0B0A12', ink: '#F2F0F8', acc: '#E7C873', accInk: '#141019',
  panel: '#15131F', line: '#2A2638', muted: '#A49FB8',
  font: "'Helvetica Neue',Helvetica,Arial,sans-serif",
  logo: `${SITE}/luna-group-white.png`,
}

const B = (size: number, color: string = S.muted, extra = '') =>
  `font-family:${S.font};font-size:${size}px;line-height:1.55;color:${color};${extra}`

function shell(title: string, preheader: string, rows: string[]) {
  const pad = '&#847;&zwnj;&nbsp;'.repeat(60)
  return `<!doctype html><html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"><title>${esc(title)}</title>
<style>body{margin:0;padding:0;background:${S.bg}}a{color:${S.acc}}@media (max-width:520px){.px{padding-left:20px!important;padding-right:20px!important}.btnw{display:block!important;margin:0 0 10px 0!important}.btnw table{width:100%!important}}</style>
</head><body style="margin:0;padding:0;background:${S.bg}">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${esc(preheader)}${pad}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${S.bg}" style="background:${S.bg}"><tr><td align="center" style="padding:0">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;margin:0 auto;background:${S.bg}">
${rows.join('')}
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`
}

const header = () =>
  `<tr><td align="center" style="padding:34px 24px 6px"><img src="${S.logo}" width="150" alt="Luna Group" style="display:block;width:150px;height:auto;border:0"></td></tr>`

const intro = (kicker: string, headline: string, lead: string) =>
  `<tr><td class="px" align="center" style="padding:22px 36px 0;text-align:center">
<div style="font-family:${S.font};font-size:11px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:${S.acc}">${kicker}</div>
<div style="font-family:${S.font};font-weight:700;letter-spacing:-0.01em;font-size:30px;line-height:1.08;color:${S.ink};padding-top:10px">${headline}</div>
<div style="${B(15, S.muted, 'padding-top:10px')}">${lead}</div>
</td></tr>`

function buttons(primary: [string, string], secondary?: [string, string] | null) {
  const one = ([label, href]: [string, string], solid: boolean) => {
    const cell = solid
      ? `<td align="center" bgcolor="${S.acc}" style="background:${S.acc};border-radius:999px">`
      : `<td align="center" style="border:1px solid ${S.line};border-radius:999px">`
    return `<div class="btnw" style="display:inline-block;margin:0 10px 10px 0;vertical-align:top"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>${cell}`
      + `<a href="${esc(href)}" style="display:block;padding:${solid ? '15px 24px' : '14px 22px'};${B(14, solid ? S.accInk : S.ink, 'font-weight:700;letter-spacing:0.06em;text-decoration:none;text-align:center')}">${label}</a>`
      + `</td></tr></table></div>`
  }
  return `<tr><td class="px" align="center" style="padding:24px 26px 0 36px;text-align:center">${one(primary, true)}${secondary ? one(secondary, false) : ''}</td></tr>`
}

const para = (html: string, top = 16) =>
  `<tr><td class="px" align="center" style="padding:${top}px 36px 0;text-align:center;${B(13)}">${html}</td></tr>`

function steps(items: [string, string][]) {
  const rows = items.map(([title, body], i) => {
    const bb = i === items.length - 1 ? '' : `border-bottom:1px solid ${S.line};`
    return `<tr><td width="40" valign="top" style="width:40px;padding:14px 0;${bb}">`
      + `<div style="width:28px;height:28px;border-radius:999px;background:${S.acc};text-align:center;${B(13, S.accInk, 'font-weight:700;line-height:28px')}">${i + 1}</div></td>`
      + `<td valign="top" style="padding:14px 0;${bb}"><div style="${B(15, S.ink, 'font-weight:700')}">${title}</div>`
      + `<div style="${B(13.5, S.muted, 'padding-top:2px')}">${body}</div></td></tr>`
  })
  return `<tr><td class="px" style="padding:22px 36px 0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${S.panel};border:1px solid ${S.line};border-radius:12px;border-collapse:separate">
<tr><td style="padding:6px 18px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows.join('')}</table></td></tr></table>
</td></tr>`
}

const footer = (reason: string) =>
  `<tr><td style="padding:30px 0 0"><div style="border-top:1px solid ${S.line};height:0;line-height:0;font-size:0">&nbsp;</div></td></tr>
<tr><td align="center" style="padding:24px 28px 32px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
<tr><td align="center"><img src="${S.logo}" width="120" alt="Luna Group Hospitality" style="display:block;width:120px;height:auto;border:0;opacity:0.9"></td></tr>
<tr><td align="center" style="padding-top:12px;${B(11)}">${reason}<br>Luna Group Hospitality &middot; Brisbane &amp; Gold Coast</td></tr>
</table>
</td></tr>`

/** A channel link (whatsapp.com/channel/…) rather than a group invite. */
function isChannel(url: string) {
  try { return new URL(url.trim()).hostname.replace(/^www\./, '') === 'whatsapp.com' } catch { return false }
}

// ----------------------------------------------------------------- emails ---
const WELCOME_SUBJECT = "You're in: your Luna guest list link"
const INVITE_SUBJECT = 'Follow the Luna promoter WhatsApp channel'

function welcomeHtml(first: string, code: string, invite: string | null) {
  const link = `${SITE}/p/${code}`
  const items: [string, string][] = [
    ['Your guest list link', `<a href="${esc(link)}" style="color:${S.acc}">${esc(link.replace(/^https?:\/\//, ''))}</a>. Share it anywhere; everyone who signs up is on your list.`],
    ['Your dashboard', 'See who&rsquo;s signed up and who checked in.'],
  ]
  if (invite) items.push(['The promoter channel', 'Cut-offs, table drops and which rooms need numbers go out there first.'])
  return shell(WELCOME_SUBJECT, invite ? 'Your link, your dashboard and the promoter channel.' : 'Your link and your dashboard.', [
    header(),
    intro('Promoters &middot; welcome', `You&rsquo;re in, ${esc(first)}`,
      `Welcome to the Luna Group promoter team. ${invite ? 'Three' : 'Two'} things and you&rsquo;re running.`),
    steps(items),
    buttons(['Open my dashboard', `${SITE}/promoter`], invite ? ['Follow the channel', invite] : null),
    para('New to this? The Promoter Guide is on your dashboard.', 14),
    footer("You're getting this because you were approved as a Luna Group promoter."),
  ])
}

function inviteHtml(first: string, invite: string) {
  const dashboard = `<a href="${SITE}/promoter" style="color:${S.acc}">your dashboard</a>`
  return shell(INVITE_SUBJECT, 'Cut-offs, table drops and which rooms need numbers, first.', [
    header(),
    intro('Promoters &middot; channel', `Follow the promoter channel, ${esc(first)}`,
      'Guest list cut-offs, table drops and which rooms need numbers all go out there first. You signed up before it existed, so here&rsquo;s the link.'),
    buttons(['Follow on WhatsApp', invite]),
    para(isChannel(invite)
      ? `Your number stays private: a channel doesn&rsquo;t show followers to each other. The channel doesn&rsquo;t take replies, so for anything else use ${dashboard}.`
      : `For anything else, use ${dashboard}.`),
    para('Not promoting any more? Ignore this and we&rsquo;ll leave you be.', 10),
    footer("You're getting this because you're a Luna Group promoter."),
  ])
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
          subject: job === 'welcome' ? WELCOME_SUBJECT : INVITE_SUBJECT,
          html: job === 'welcome'
            ? welcomeHtml(first, r.promoter_code ?? '', invite)
            : inviteHtml(first, invite as string),
        }),
      })
      if (!res.ok) { failed++; if (errors.length < 10) errors.push(await res.text()); continue }
      // Stamped only on success — a failure stays eligible for the next run.
      //
      // A welcome that carried the channel link IS their invite: stamping both
      // stops the catch-up job mailing the same person a second time minutes
      // later telling them to follow a channel they were just told about.
      const now = new Date().toISOString()
      const patch: Record<string, string> = { [stamp]: now }
      if (job === 'welcome' && invite) patch.whatsapp_invited_at = now
      await rest(`promoters?id=eq.${r.id}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(patch),
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
