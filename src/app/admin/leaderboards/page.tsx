import { getSession, hasRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/AppShell'
import { navForRoles } from '@/components/nav'
import { LeaderboardView } from '@/components/LeaderboardView'

export const dynamic = 'force-dynamic'

export default async function AdminLeaderboards() {
  const s = await getSession()
  if (!s) redirect('/login')
  if (!hasRole(s, 'admin', 'venue_manager')) redirect('/dashboard')
  const supabase = await createClient()
  let vq = supabase.from('venues').select('id,name').order('name')
  if (!s.roles.includes('admin')) vq = vq.in('id', s.venueIds.length ? s.venueIds : ['0'])
  const { data: venues } = await vq
  const { data: events } = await supabase.from('events').select('id,name,event_date,venue_id').order('event_date', { ascending: false }).limit(60)
  return (
    <AppShell nav={navForRoles(s.roles)} current="/admin/leaderboards" title="Leaderboards">
      <LeaderboardView venues={venues ?? []} events={events ?? []} adminScope={s.roles.includes('admin')} />
    </AppShell>
  )
}
