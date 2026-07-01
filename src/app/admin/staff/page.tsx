import { getSession, hasRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/AppShell'
import { ADMIN_NAV } from '@/components/AdminNav'
import { StaffManager } from './staff-ui'

export const dynamic = 'force-dynamic'

export default async function AdminStaff() {
  const s = await getSession()
  if (!s) redirect('/login')
  if (!hasRole(s, 'admin')) redirect('/dashboard')

  const supabase = await createClient()
  const [{ data: venues }, { data: roles }] = await Promise.all([
    supabase.from('venues').select('id,name').eq('active', true).order('name'),
    supabase.from('roles')
      .select('id, role, venue_id, users(email), venues(name)')
      .in('role', ['admin', 'venue_manager', 'reception'])
      .order('role'),
  ])

  const staff = (roles ?? []).map((r: any) => ({
    id: r.id, role: r.role, email: r.users?.email ?? '—',
    venue: r.venues?.name ?? (r.role === 'admin' ? 'All venues' : '—'),
  }))

  return (
    <AppShell nav={ADMIN_NAV} current="/admin/staff" title="Staff & door access">
      <StaffManager venues={venues ?? []} staff={staff} />
    </AppShell>
  )
}
