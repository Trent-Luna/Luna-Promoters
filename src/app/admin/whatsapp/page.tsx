import { getSession, hasRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/AppShell'
import { ADMIN_NAV } from '@/components/AdminNav'
import { WhatsappSettings } from '../tiers/whatsapp'

export const dynamic = 'force-dynamic'

/**
 * Luna Ops · WhatsApp channel.
 *
 * Its own page rather than a panel on Tier settings: the channel is not a tier
 * concern, and this keeps the one destructive control in the admin — a bulk
 * email to every promoter — on a page you have to mean to open.
 */
export default async function AdminWhatsapp() {
  const s = await getSession()
  if (!s) redirect('/login')
  if (!hasRole(s, 'admin')) redirect('/dashboard')

  const supabase = await createClient()
  const [{ data: settings }, { count: notInvited }] = await Promise.all([
    supabase.from('app_settings').select('whatsapp_invite_url').eq('id', 1).maybeSingle(),
    supabase.from('promoters').select('id', { count: 'exact', head: true })
      .eq('status', 'approved').is('whatsapp_invited_at', null)
      .eq('is_staff', false).eq('is_house', false),
  ])

  return (
    <AppShell nav={ADMIN_NAV} current="/admin/whatsapp" title="WhatsApp channel"
      subtitle="The promoter channel link, and the one-off invite to promoters who have never been sent it.">
      <WhatsappSettings inviteUrl={settings?.whatsapp_invite_url ?? null} pendingCount={notInvited ?? 0} />
    </AppShell>
  )
}
