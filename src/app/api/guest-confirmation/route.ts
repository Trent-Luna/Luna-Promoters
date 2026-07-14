import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { packageBlockHtml } from '@/lib/occasion-packages'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function emailHtml(o: { first: string; venue: string; dateLabel: string; qrImg: string; pass: string; packageBlock: string }) {
  return `<!doctype html><html><body style="margin:0;background:#0a0a0f;font-family:Helvetica,Arial,sans-serif;color:#ffffff">
  <div style="max-width:480px;margin:0 auto;padding:32px 20px">
    <div style="text-align:center;font-size:22px;font-weight:800;letter-spacing:3px;color:#ffffff">LUNA GROUP</div>
    <div style="text-align:center;font-size:12px;letter-spacing:2px;color:#9ca3af;margin-top:2px">HOSPITALITY</div>
    <div style="background:#14141c;border:1px solid #23232e;border-radius:16px;padding:28px;margin-top:24px;text-align:center">
      <div style="display:inline-block;background:rgba(16,185,129,.15);color:#34d399;font-size:12px;font-weight:700;padding:6px 12px;border-radius:999px">YOU'RE ON THE LIST</div>
      <h1 style="font-size:22px;margin:14px 0 4px">Hey ${o.first} 👋</h1>
      <p style="color:#9ca3af;margin:0 0 2px">${o.venue}</p>
      <p style="color:#9ca3af;font-size:14px;margin:0">${o.dateLabel}</p>
      <div style="background:#ffffff;border-radius:14px;padding:16px;display:inline-block;margin:22px 0 8px">
        <img src="${o.qrImg}" width="220" height="220" alt="Your QR code" style="display:block;width:220px;height:220px" />
      </div>
      <p style="color:#9ca3af;font-size:13px;margin:6px 0 18px">Show this QR at the door — it's personal to you.</p>
      <a href="${o.pass}" style="display:inline-block;background:#d4af37;color:#0a0a0f;font-weight:700;text-decoration:none;padding:13px 26px;border-radius:10px">View &amp; save your QR</a>
      <p style="color:#6b7280;font-size:12px;margin:20px 0 0">No screenshot? No problem — just give your name at the door and we'll find you.</p>
    </div>
    ${o.packageBlock}
    <p style="text-align:center;color:#6b7280;font-size:11px;margin-top:18px">Everyone needs their own QR — only checked-in guests count toward rewards.</p>
  </div></body></html>`
}

export async function POST(req: Request) {
  try {
    const { token } = await req.json().catch(() => ({}))
    if (!token || typeof token !== 'string') {
      return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 })
    }
    const key = process.env.RESEND_API_KEY
    const site = process.env.NEXT_PUBLIC_SITE_URL || ''
    if (!key) return NextResponse.json({ ok: false, error: 'email_not_configured' })

    const svc = createServiceClient()
    const { data: reg } = await svc
      .from('guest_registrations')
      .select('qr_token, special_occasion, guests(first_name,email), venues(name,slug), events(event_date)')
      .eq('qr_token', token)
      .maybeSingle()
    if (!reg) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })

    const g: any = (reg as any).guests
    const email: string | null = g?.email || null
    if (!email) return NextResponse.json({ ok: true, skipped: 'no_email' })

    const venue = (reg as any).venues?.name || 'Luna Group'
    const venueSlug = (reg as any).venues?.slug as string | undefined
    const occasion = (reg as any).special_occasion as string | undefined
    const packageBlock = packageBlockHtml(venueSlug, occasion)
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
        html: emailHtml({ first, venue, dateLabel, qrImg: `${site}/api/qr/${token}`, pass: `${site}/g/${token}`, packageBlock }),
      }),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      return NextResponse.json({ ok: false, error: 'send_failed', detail }, { status: 502 })
    }
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'error' }, { status: 500 })
  }
}
