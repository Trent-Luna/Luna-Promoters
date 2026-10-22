import { createServiceClient } from '@/lib/supabase/server'
import { occasionBlocksHtml } from '@/lib/occasion-packages'
import { confirmationSubject, emailHtml, isTrentPromoter } from '@/app/api/guest-confirmation/email'
import { cutoffLabel } from '@/lib/guestlist-cutoff'
import { themeFor } from '@/lib/venue-theme'
import { brandedFrom, brandedHtml, brandedSubject, type PartyEmail } from '@/app/api/guest-confirmation/branded'
import { confirmationText, type PartyLook } from '@/lib/party'
import { sendSms, type SmsOutcome } from '@/lib/sms'
import { SATIN_FROM, satinPassHtml, satinSubject } from '@/lib/email/silk-pass'
import { siteUrl } from '@/lib/email/blocks'

/**
 * Send one guest their guest list pass: the QR email, plus the party-night
 * text when that night has texts switched on.
 *
 * One function for every way onto a list. A promoter-link sign-up reaches it
 * through /api/guest-confirmation (the guest's own browser asks once the
 * sign-up lands). A staff add on the Guest lists screen and a CRM add reach it
 * from the server, because nothing else would ask: until 22 Oct 2026 those two
 * paths sent no pass at all.
 *
 * Idempotent: confirmation_sent_at is stamped after the provider accepts the
 * email, and a second call does nothing unless `force` is set (a resend).
 */
export type ConfirmationResult =
  | { ok: true; skipped?: 'already_sent' | 'no_email'; sms?: SmsOutcome }
  | { ok: false; error: 'email_not_configured' | 'not_found' | 'send_failed'; detail?: string }

export async function sendGuestConfirmation(token: string, opts: { force?: boolean } = {}): Promise<ConfirmationResult> {
  const force = opts.force === true
  const key = process.env.RESEND_API_KEY
  const site = process.env.NEXT_PUBLIC_SITE_URL || ''
  if (!key) return { ok: false, error: 'email_not_configured' }

  const svc = createServiceClient()
  const { data: reg } = await svc
    .from('guest_registrations')
    .select('qr_token, special_occasion, confirmation_sent_at, promoter_id, plus_ones, party_names, guests(first_name,email,mobile), venues(name,slug,guestlist_until,whatsapp_channel_url), events(event_date,name,start_time,party), promoters(id, promoter_code, full_name)')
    .eq('qr_token', token)
    .maybeSingle()
  if (!reg) return { ok: false, error: 'not_found' }

  // Don't re-send a confirmation that already went out unless explicitly forced.
  if ((reg as any).confirmation_sent_at && !force) return { ok: true, skipped: 'already_sent' }

  const g: any = (reg as any).guests
  const email: string | null = g?.email || null
  if (!email) return { ok: true, skipped: 'no_email' }

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

  // A party night (migration 0051) carries its own name and the guest's group.
  const ev: any = (reg as any).events ?? {}
  const look = (ev.party ?? null) as PartyLook | null
  const party: PartyEmail | null = look
    ? {
        eventName: ev.name, startTime: ev.start_time ?? null,
        tagline: look.tagline ?? null, lede: look.lede ?? null, included: look.included ?? null,
        plusOnes: (reg as any).plus_ones ?? 0, names: (reg as any).party_names ?? null,
      }
    : null

  // Venues with their own look (Eclipse, After Dark, Su Casa, Pump, Mamacita)
  // get the branded email from the venue's name. A venue without one (today
  // Silk Saturdays and Silk) gets the Satin pass Trent picked on 22 Oct 2026.
  // The original Luna Group email is kept only for a pass with no night on it.
  const theme = themeFor(venueSlug)
  const message = theme && eventDate
    ? {
        from: brandedFrom(venue),
        subject: brandedSubject({ theme, eventDate, ownerGuestList, party }),
        html: brandedHtml({
          theme, site, token, venueName: venue, first, eventDate,
          promoterName: (reg as any).promoters?.full_name ?? null,
          untilLabel, occasion, ownerGuestList,
          whatsappUrl: (reg as any).venues?.whatsapp_channel_url ?? null,
          party,
        }),
      }
    : eventDate
      ? {
          from: SATIN_FROM,
          subject: satinSubject({ venueName: venue, eventDate, ownerGuestList }),
          html: satinPassHtml({ site: site || siteUrl(), token, venueName: venue, first, eventDate, ownerGuestList, untilLabel, occasion }),
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
    return { ok: false, error: 'send_failed', detail }
  }
  // Record the successful send so bulk runs are tracked and safely resumable.
  await svc
    .from('guest_registrations')
    .update({ confirmation_sent_at: new Date().toISOString() })
    .eq('qr_token', token)

  // A party night with texts switched on (events.party.sms) also gets the
  // pass by text. Once only: a forced email resend does not re-text.
  let sms: SmsOutcome | undefined
  if (look?.sms === true && party && eventDate && !force) {
    sms = await sendSms(g?.mobile, confirmationText({
      first, eventName: party.eventName, eventDate, startTime: party.startTime ?? null,
      plusOnes: party.plusOnes, passUrl: `${site}/g/${token}`,
    }))
  }
  return { ok: true, ...(sms ? { sms } : {}) }
}
