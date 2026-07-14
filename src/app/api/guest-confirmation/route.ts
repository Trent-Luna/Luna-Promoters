import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { occasionBlocksHtml } from '@/lib/occasion-packages'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function emailHtml(o: { first: string; venue: string; dateLabel: string; qrImg: string; pass: string; occasionBlocks: string }) {
  const qrCard = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#14141c;border:1px solid #23232e;border-radius:16px;margin-top:24px"><tr><td align="center" style="padding:28px">
        <span style="display:inline-block;background:rgba(16,185,129,.15);color:#34d399;font-size:12px;font-weight:700;letter-spacing:1px;padding:6px 12px;border-radius:999px">YOU'RE ON THE LIST</span>
        <h1 style="font-size:22px;margin:14px 0 4px;color:#ffffff">Hey ${o.first} 👋</h1>
        <p style="color:#9ca3af;margin:0 0 2px">${o.venue}</p>
        <p style="color:#9ca3af;font-size:14px;margin:0">${o.dateLabel}</p>
        <table role="presentation" align="center" cellpadding="0" cellspacing="0" style="margin:22px auto 8px"><tr><td style="background:#ffffff;border-radius:14px;padding:16px">
          <img src="${o.qrImg}" width="200" height="200" alt="Your QR code" style="display:block;width:200px;height:200px" />
        </td></tr></table>
        <p style="color:#9ca3af;font-size:13px;margin:6px 0 18px">Show this QR at the door — it's personal to you.</p>
        <a href="${o.pass}" style="display:inline-block;background:#d4af37;color:#0a0a0f;font-weight:700;text-decoration:none;padding:13px 26px;border-radius:10px">View &amp; save your QR</a>
        <p style="color:#6b7280;font-size:12px;margin:20px 0 0">No screenshot? No problem — just give your name at the door and we'll find you.</p>
      </td></tr></table>`
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;padding:0;background:#0a0a0f;font-family:Helvetica,Arial,sans-serif;color:#ffffff">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f"><tr><td align="center" style="padding:28px 14px">
      <table role="presentation" width="500" cellpadding="0" cellspacing="0" style="width:500px;max-width:500px;margin:0 auto">
        <tr><td align="center" style="font-size:22px;font-weight:800;letter-spacing:3px;color:#ffffff">LUNA GROUP</td></tr>
        <tr><td align="center" style="font-size:12px;letter-spacing:2px;color:#9ca3af;padding-top:2px">HOSPITALITY</td></tr>
        <tr><td>${qrCard}</td></tr>
        <tr><td>${o.occasionBlocks}</td></tr>
        <tr><td align="center" style="color:#6b7280;font-size:11px;padding-top:18px">Everyone needs their own QR — only checked-in guests count toward rewards.</td></tr>
      </table>
    </td></tr></table>
  </body></html>`
}

export async function POST(req: Request) {
  try {
    const { token, force } = await req.json().catch(() => ({}))
    if (!token || typeof token !== 'string') {
      return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 })
    }
    const key = process.env.RESEND_API_KEY
    const site = process.env.NEXT_PUBLIC_SITE_URL || ''
    if (!key) return NextResponse.json({ ok: false, error: 'email_not_configured' })

    const svc = createServiceClient()
    const { data: reg } = await svc
      .from('guest_registrations')
      .select('qr_token, special_occasion, confirmation_sent_at, guests(first_name,email), venues(name,slug), events(event_date)')
      .eq('qr_token', token)
      .maybeSingle()
    if (!reg) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })

    // Idempotency: don't re-send a confirmation that already went out unless explicitly forced.
    if ((reg as any).confirmation_sent_at && force !== true) {
      return NextResponse.json({ ok: true, skipped: 'already_sent' })
    }

    const g: any = (reg as any).guests
    const email: string | null = g?.email || null
    if (!email) return NextResponse.json({ ok: true, skipped: 'no_email' })

    const venue = (reg as any).venues?.name || 'Luna Group'
    const venueSlug = (reg as any).venues?.slug as string | undefined
    const occasion = (reg as any).special_occasion as string | undefined
    const occasionBlocks = occasionBlocksHtml(venueSlug, occasion)
    const eventDate = (reg as any).events?.event_date as string | undefined
    const dateLabel = eventDate
      ? new Date(eventDate + 'T00:00:00Z').toLocaleDateString('en-AU',
          { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
      : ''
    const first = g?.first_name || 'there'

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Luna Group <noreply@lunagroup.com.au>',
        to: [email],
        subject: `You're on the guestlist — ${venue}`,
        html: emailHtml({ first, venue, dateLabel, qrImg: `${site}/api/qr/${token}`, pass: `${site}/g/${token}`, occasionBlocks }),
      }),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      return NextResponse.json({ ok: false, error: 'send_failed', detail }, { status: 502 })
    }
    // Record the successful send so bulk runs are tracked and safely resumable.
    await svc
      .from('guest_registrations')
      .update({ confirmation_sent_at: new Date().toISOString() })
      .eq('qr_token', token)
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'error' }, { status: 500 })
  }
}
