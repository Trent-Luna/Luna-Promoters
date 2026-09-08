/**
 * The promoter WhatsApp group invite link.
 *
 * Stored in app_settings so an admin can rotate it without a deploy: WhatsApp
 * group links are reset often, and a stale link is worse than none.
 *
 * Everything that shows a "Join the WhatsApp" affordance reads this and renders
 * nothing when it is unset, so the feature stays invisible until Trent pastes a
 * link in on the Tier settings page.
 */

import { createClient } from '@/lib/supabase/server'

/** Only real WhatsApp invite links. Guards against a half-pasted URL going live. */
export function isWhatsappInvite(url: string | null | undefined): boolean {
  if (!url) return false
  try {
    const u = new URL(url.trim())
    return u.protocol === 'https:' && u.hostname === 'chat.whatsapp.com' && u.pathname.length > 1
  } catch {
    return false
  }
}

/** Returns the configured invite link, or null when unset or malformed. */
export async function getWhatsappInvite(): Promise<string | null> {
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('app_settings')
      .select('whatsapp_invite_url')
      .eq('id', 1)
      .maybeSingle()
    const url = data?.whatsapp_invite_url?.trim() ?? null
    return isWhatsappInvite(url) ? url : null
  } catch {
    // A settings read must never take down a promoter's dashboard.
    return null
  }
}
