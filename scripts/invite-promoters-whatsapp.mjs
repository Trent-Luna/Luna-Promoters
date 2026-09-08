/**
 * One-off: email every approved promoter the Luna Promoters WhatsApp channel link.
 *
 * Why a script and not the admin button: the button needs the new code deployed,
 * and this send was wanted before that. It applies exactly the same rules the
 * server action does, so whichever runs first, the other one skips the people
 * already done.
 *
 *   • approved promoters only
 *   • staff and house accounts excluded (already in the operational chats)
 *   • anyone with whatsapp_invited_at set is skipped — so this is safe to
 *     re-run, and a crash halfway through costs nothing
 *   • the timestamp is written AFTER a successful send, never before, so a
 *     failure leaves that person eligible next run
 *
 * Run:
 *   vercel env pull .env.local          # gets RESEND_API_KEY + service role key
 *   node scripts/invite-promoters-whatsapp.mjs --dry-run
 *   node scripts/invite-promoters-whatsapp.mjs
 *
 * --dry-run prints who would be mailed and sends nothing.
 * --limit=N  caps the run, for a small test batch first.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

// Load .env.local without adding a dependency.
try {
  for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
} catch { /* env may come from the shell instead */ }

const DRY = process.argv.includes('--dry-run')
const LIMIT = Number((process.argv.find(a => a.startsWith('--limit=')) || '').split('=')[1]) || 1000

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
const RESEND = process.env.RESEND_API_KEY
const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://promoter.lunagroup.com.au').replace(/\/$/, '')

for (const [k, v] of Object.entries({ NEXT_PUBLIC_SUPABASE_URL: URL_, SUPABASE_SERVICE_ROLE_KEY: SERVICE, RESEND_API_KEY: RESEND })) {
  if (!v) { console.error(`Missing ${k} — run: vercel env pull .env.local`); process.exit(1) }
}

const db = createClient(URL_, SERVICE, { auth: { persistSession: false } })

const { data: settings } = await db.from('app_settings').select('whatsapp_invite_url').eq('id', 1).maybeSingle()
const INVITE = settings?.whatsapp_invite_url?.trim()
if (!INVITE) { console.error('No whatsapp_invite_url set in app_settings.'); process.exit(1) }

const { data: rows, error } = await db.from('promoters')
  .select('id, full_name, email')
  .eq('status', 'approved')
  .is('whatsapp_invited_at', null)
  .eq('is_staff', false)
  .eq('is_house', false)
  .not('email', 'is', null)
  .order('created_at')
  .limit(LIMIT)
if (error) { console.error(error.message); process.exit(1) }

console.log(`${rows.length} promoter(s) to invite. Channel: ${INVITE}`)
if (DRY) {
  for (const r of rows) console.log(`  would email ${r.email}  (${r.full_name})`)
  console.log('\nDry run — nothing sent.')
  process.exit(0)
}

const shell = (kicker, inner) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:Helvetica,Arial,sans-serif;color:#ffffff">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f"><tr><td align="center" style="padding:28px 14px">
  <table role="presentation" width="500" cellpadding="0" cellspacing="0" style="width:500px;max-width:500px;margin:0 auto">
    <tr><td align="center" style="font-size:22px;font-weight:800;letter-spacing:3px;color:#ffffff">LUNA GROUP</td></tr>
    <tr><td align="center" style="font-size:12px;letter-spacing:2px;color:#9ca3af;padding-top:2px">${kicker}</td></tr>
    <tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#14141c;border:1px solid #23232e;border-radius:16px;margin-top:24px"><tr><td style="padding:28px">${inner}</td></tr></table></td></tr>
    <tr><td align="center" style="color:#6b7280;font-size:11px;padding-top:18px">Luna Group Hospitality · Brisbane &amp; Gold Coast</td></tr>
  </table>
</td></tr></table></body></html>`

const body = (first) => shell('PROMOTERS', `
  <h1 style="font-size:20px;margin:0 0 12px;color:#ffffff">Follow the Luna promoter channel, ${first}</h1>
  <p style="color:#9ca3af;line-height:1.6;margin:0 0 12px">We run a promoter channel on WhatsApp now — guestlist cut-offs, table drops and which rooms need numbers all go out there first. You signed up before it existed, so here's the link.</p>
  <p style="color:#9ca3af;line-height:1.6;margin:0 0 14px">Tap below and WhatsApp will ask you to follow. Your number stays private — nobody else in the channel can see it.</p>
  <a href="${INVITE}" style="display:inline-block;background:#25D366;color:#0a0a0f;font-weight:700;text-decoration:none;padding:13px 26px;border-radius:10px;margin-top:4px">Follow on WhatsApp →</a>
  <p style="color:#9ca3af;line-height:1.6;margin:18px 0 0">Need something from us? The channel doesn't take replies — your dashboard and guestlist link are at <a href="${SITE}/promoter" style="color:#d4a24c">${SITE.replace(/^https?:\/\//, '')}/promoter</a>.</p>
  <p style="color:#6b7280;font-size:12px;margin:16px 0 0">Not promoting any more? Ignore this and we will leave you be.</p>`)

let sent = 0, failed = 0
for (const r of rows) {
  const first = (r.full_name || '').split(' ')[0] || 'there'
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Luna Group <noreply@lunagroup.com.au>',
        to: [r.email],
        subject: 'Follow the Luna promoter WhatsApp channel',
        html: body(first),
      }),
    })
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
    // Only mark AFTER the send succeeds, so a failure stays retryable.
    await db.from('promoters').update({ whatsapp_invited_at: new Date().toISOString() }).eq('id', r.id)
    sent++
    process.stdout.write(`\rsent ${sent}/${rows.length}  failed ${failed}`)
  } catch (e) {
    failed++
    console.error(`\n  ${r.email}: ${e.message}`)
  }
  await new Promise(r => setTimeout(r, 600)) // stay under Resend's rate limit
}
console.log(`\n\nDone. ${sent} sent, ${failed} failed.`)
if (failed) console.log('Failures keep a null whatsapp_invited_at — re-run to retry just those.')
