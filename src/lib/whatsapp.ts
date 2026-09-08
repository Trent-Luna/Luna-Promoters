/**
 * The Luna Group WhatsApp link.
 *
 * Trent chose a Channel (8 Sep 2026) over a group: a channel has no follower
 * cap, hides every follower's number from everyone including us, and carries
 * polls — which is how you get a Saturday headcount without opening the floor
 * to 243 replies. The cost is that nobody can reply and we can never see who
 * followed.
 *
 * Both link shapes are accepted anyway, so switching to a group later is a
 * settings change rather than a deploy:
 *   channel  https://whatsapp.com/channel/<id>
 *   group    https://chat.whatsapp.com/<id>
 *
 * Stored in app_settings so an admin can rotate it without a deploy — both
 * kinds of link get reset periodically, and a stale link is worse than none.
 * Every "Join the WhatsApp" affordance renders nothing when it is unset.
 */

import { createClient } from '@/lib/supabase/server'

/**
 * Only real WhatsApp links — a channel follow link or a group invite link.
 * Guards against a half-pasted URL going live, which is worse than no link at
 * all: every promoter who taps it hits a dead end and none of them tell us.
 */
export function isWhatsappInvite(url: string | null | undefined): boolean {
  if (!url) return false
  try {
    const u = new URL(url.trim())
    if (u.protocol !== 'https:') return false
    const host = u.hostname.replace(/^www\./, '')
    // Channel: whatsapp.com/channel/<id>
    if (host === 'whatsapp.com') return /^\/channel\/[^/]+/.test(u.pathname)
    // Group: chat.whatsapp.com/<id>
    if (host === 'chat.whatsapp.com') return u.pathname.length > 1
    return false
  } catch {
    return false
  }
}

/** Whether the configured link points at a Channel rather than a group. */
export function isChannelLink(url: string | null | undefined): boolean {
  if (!isWhatsappInvite(url)) return false
  try {
    return new URL((url as string).trim()).hostname.replace(/^www\./, '') === 'whatsapp.com'
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
