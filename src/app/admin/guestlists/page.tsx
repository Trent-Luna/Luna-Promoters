import { getSession, hasRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/AppShell'
import { navForRoles } from '@/components/nav'
import { GuestlistManager } from './manager'

export const dynamic = 'force-dynamic'

export default async function AdminGuestlists() {
  const s = await getSession()
  if (!s) redirect('/login')
  if (!hasRole(s, 'admin', 'venue_manager')) redirect('/dashboard')

  const supabase = await createClient()
  let vq = supabase.from('venues').select('id,name').eq('active', true).order('name')
  if (!s.roles.includes('admin'))
    vq = vq.in('id', s.venueIds.length ? s.venueIds : ['00000000-0000-0000-0000-000000000000'])
  const { data: venues } = await vq

  return (
    <AppShell nav={navForRoles(s.roles)} current="/admin/guestlists" title="Guestlists">
      <GuestlistManager venues={venues ?? []} />
    </AppShell>
  )
}
