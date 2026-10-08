import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { occasionBlocksHtml } from '@/lib/occasion-packages'
import { confirmationSubject, emailHtml, isTrentPromoter } from './email'
import { cutoffLabel } from '@/lib/guestlist-cutoff'
import { themeFor } from '@/lib/venue-theme'
import { brandedFrom, brandedHtml, brandedSubject } from './branded'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

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
      .select('qr_token, special_occasion, confirmation_sent_at, promoter_id, guests(first_name,email), venues(name,slug,guestlist_until,whatsapp_channel_url), events(event_date), promoters(id, promoter_code, full_name)')
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
    const untilLabel = cutoffLabel((reg as any).venues?.guestlist_until)
    const occasion = (reg as any).special_occasion as string | undefined
    const occasionBlocks = occasionBlocksHtml(venueSlug, occasion)
    const eventDate = (reg as any).events?.event_date as string | undefined
    const dateLabel = eventDate
      ? new Date(eventDate + 'T00:00:00Z').toLocaleDateString('en-AU',
          { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
      : ''
    const first = g?.first_name || 'there'
    const promoterId = (reg as any).promoter_id as string | undefined
    const promoterCode = (reg as any).promoters?.promoter_code as string | undefined
    const ownerGuestList = isTrentPromoter(promoterId, promoterCode)

    // Venues with their own look (Eclipse, After Dark, Su Casa, Pump, Mamacita)
    // get the branded email from the venue's name. Anything else keeps the
    // original Luna Group email.
    const theme = themeFor(venueSlug)
    const message = theme && eventDate
      ? {
          from: brandedFrom(venue),
          subject: brandedSubject({ theme, eventDate, ownerGuestList }),
          html: brandedHtml({
            theme, site, token, venueName: venue, first, eventDate,
            promoterName: (reg as any).promoters?.full_name ?? null,
            untilLabel, occasion, ownerGuestList,
            whatsappUrl: (reg as any).venues?.whatsapp_channel_url ?? null,
          }),
        }
      : {
          from: 'Luna Group <noreply@lunagroup.com.au>',
          subject: confirmationSubject(venue, ownerGuestList),
          html: emailHtml({ first, venue, dateLabel, qrImg: `${site}/api/qr/${token}`, pass: `${site}/g/${token}`, occasionBlocks, ownerGuestList, untilLabel }),
        }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: [email], ...message }),
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
