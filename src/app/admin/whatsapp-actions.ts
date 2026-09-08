'use server'
/**
 * Server actions for the promoter WhatsApp group.
 *
 * Deliberately a separate module from admin/actions.ts: this is one self-
 * contained feature (set the link, invite one promoter, invite the backlog) and
 * it keeps the WhatsApp rules — validation, the already-invited guard, the
 * staff exclusion — in one readable place.
 */
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getSession, hasRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { isWhatsappInvite } from '@/lib/whatsapp'

async function ensureAdmin() {
  const s = await getSession()
  if (!hasRole(s, 'admin')) throw new Error('Not authorised')
  return s!
}

/**
 * Store (or clear) the promoter group invite link.
 *
 * Validated before it lands: a mistyped link is worse than none, because every
 * promoter who taps it hits a dead end and no one tells us. An empty string
 * clears it, which hides the button everywhere it appears.
 */
export async function setWhatsappInviteUrl(url: string) {
  await ensureAdmin()
  const trimmed = (url ?? '').trim()
  if (trimmed && !isWhatsappInvite(trimmed)) {
    throw new Error('That is not a WhatsApp invite link — it should start with https://chat.whatsapp.com/')
  }
  const supabase = await createClient()
  const { error } = await supabase
    .from('app_settings')
    .update({ whatsapp_invite_url: trimmed || null, updated_at: new Date().toISOString() })
    .eq('id', 1)
  if (error) throw error
  revalidatePath('/admin/tiers')
  revalidatePath('/promoter')
  revalidatePath('/admin/mylink')
  revalidatePath('/signup/success')
}

/**
 * Email one promoter the group invite. Returns rather than throws so a bulk run
 * reports totals instead of dying on the first address that bounces.
 *
 * `force` is for a deliberate resend; without it anyone already invited is
 * skipped, which is what makes the catch-up safe to re-run.
 */
export async function inviteToWhatsApp(
  id: string,
  variant: 'welcome' | 'catch_up' = 'catch_up',
  force = false,
): Promise<{ ok: boolean; reason?: string }> {
  await ensureAdmin()
  const svc = createServiceClient()

  const { data: settings } = await svc
    .from('app_settings').select('whatsapp_invite_url').eq('id', 1).maybeSingle()
  const invite = settings?.whatsapp_invite_url?.trim()
  if (!isWhatsappInvite(invite)) return { ok: false, reason: 'no_invite_link' }

  const { data: p } = await svc
    .from('promoters')
    .select('id,full_name,email,status,whatsapp_invited_at')
    .eq('id', id)
    .maybeSingle()
  if (!p) return { ok: false, reason: 'not_found' }
  if (!p.email) return { ok: false, reason: 'no_email' }
  if (p.status !== 'approved') return { ok: false, reason: 'not_approved' }
  if (p.whatsapp_invited_at && !force) return { ok: false, reason: 'already_invited' }

  const { sendWhatsappInvite } = await import('@/lib/email/promoters')
  const sent = await sendWhatsappInvite(p.email, p.full_name, invite as string, variant)
  if (!sent.ok) return { ok: false, reason: sent.reason }

  await svc.from('promoters').update({ whatsapp_invited_at: new Date().toISOString() }).eq('id', id)
  return { ok: true }
}

/**
 * The one-off catch-up to promoters who joined before the group existed.
 *
 * Skips staff and house accounts — they are already in the operational chats —
 * and anyone previously invited, so a second run only picks up who the first
 * one missed rather than mailing everybody twice.
 */
export async function inviteExistingPromotersToWhatsApp(): Promise<{ sent: number; skipped: number }> {
  await ensureAdmin()
  const svc = createServiceClient()
  const { data: rows } = await svc
    .from('promoters')
    .select('id')
    .eq('status', 'approved')
    .is('whatsapp_invited_at', null)
    .eq('is_staff', false)
    .eq('is_house', false)
    .limit(500)

  let sent = 0
  let skipped = 0
  for (const r of rows ?? []) {
    const res = await inviteToWhatsApp(r.id, 'catch_up')
    if (res.ok) sent++
    else skipped++
  }
  revalidatePath('/admin/promoters')
  return { sent, skipped }
}
