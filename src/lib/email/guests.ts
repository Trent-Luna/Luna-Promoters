import { sendEmail, emailShell, type SendResult } from './send'
import { occasionBlocksHtml } from '@/lib/occasion-packages'

/**
 * The VIP booth offer as a follow-up, sent from the Guestlists page for a
 * birthday / hens / bucks registration. Same occasion content as the
 * confirmation email (free-entry deal + booth CTA into reservations).
 */
export function sendBoothOfferEmail(o: {
  to: string; first: string; venue: string; venueSlug?: string | null; occasion?: string | null; eventDate?: string | null
}): Promise<SendResult> {
  const dateLabel = o.eventDate
    ? new Date(o.eventDate + 'T00:00:00Z').toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
    : ''
  const occ = (o.occasion || '').trim()
  const intro = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px"><tr><td align="center">
      <h1 style="font-size:22px;margin:0 0 6px;color:#ffffff">Hey ${o.first} 👋</h1>
      <p style="color:#9ca3af;margin:0">${occ ? `${occ} at ${o.venue}` : o.venue}${dateLabel ? ` · ${dateLabel}` : ''}</p>
      <p style="color:#9ca3af;font-size:14px;margin:10px 0 0">Our team would love to look after your group — here is what is on the table.</p>
    </td></tr></table>`
  const html = emailShell('GUESTLIST', intro + occasionBlocksHtml(o.venueSlug, occ))
  return sendEmail(o.to, `${occ ? `${occ} at ${o.venue}` : o.venue} — want a VIP booth?`, html)
}
