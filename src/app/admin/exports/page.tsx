import { getSession, hasRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/AppShell'
import { navForRoles } from '@/components/nav'
import { ExportPanel } from './panel'

export const dynamic = 'force-dynamic'

export default async function AdminExports() {
  const s = await getSession()
  if (!s) redirect('/login')
  if (!hasRole(s, 'admin', 'venue_manager')) redirect('/dashboard')
  const supabase = await createClient()
  let vq = supabase.from('venues').select('id,name').order('name')
  if (!s.roles.includes('admin')) vq = vq.in('id', s.venueIds.length ? s.venueIds : ['0'])
  const [{ data: venues }, { data: events }, { data: promoters }] = await Promise.all([
    vq,
    supabase.from('events').select('id,name,event_date,venue_id').order('event_date', { ascending: false }).limit(80),
    supabase.from('promoters').select('id,full_name,promoter_code').eq('status', 'approved').order('full_name'),
  ])
  return (
    <AppShell nav={navForRoles(s.roles)} current="/admin/exports" title="CSV exports for HubSpot">
      <ExportPanel venues={venues ?? []} events={events ?? []} promoters={promoters ?? []} />
    </AppShell>
  )
}
