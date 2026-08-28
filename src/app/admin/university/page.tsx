import { getSession, hasRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/AppShell'
import { ADMIN_NAV } from '@/components/AdminNav'
import { Stat } from '@/components/ui'
import { UniversityDashboard } from './dashboard'
import { UniversityAutoApproveToggle, UniversityApproveAllToggle } from './auto-approve'

export const dynamic = 'force-dynamic'

export default async function AdminUniversity() {
  const s = await getSession()
  if (!s) redirect('/login')
  if (!hasRole(s, 'admin', 'venue_manager')) redirect('/dashboard')

  const supabase = await createClient()
  const [{ data: stats }, { data: settings }] = await Promise.all([
    supabase.rpc('get_university_stats', {}),
    supabase.from('app_settings').select('auto_approve_university, university_approve_all').eq('id', 1).maybeSingle(),
  ])
  const isAdmin = hasRole(s, 'admin')

  return (
    <AppShell nav={ADMIN_NAV} current="/admin/university" title="University Members">
      {isAdmin && (
        <>
          <UniversityAutoApproveToggle initial={settings?.auto_approve_university ?? true} />
          <UniversityApproveAllToggle initial={settings?.university_approve_all ?? false} />
        </>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Total members" value={stats?.total ?? 0} />
        <Stat label="Approved" value={stats?.approved ?? 0} accent />
        <Stat label="Manual review" value={stats?.manual_review ?? 0} accent />
        <Stat label="Pending" value={stats?.pending_verification ?? 0} />
        <Stat label="Rejected" value={stats?.rejected ?? 0} />
        <Stat label="Suspended" value={stats?.suspended ?? 0} />
        <Stat label="Wristbands tonight" value={stats?.wristbands_tonight ?? 0} accent />
        <Stat label="Recent (7d)" value={(stats?.recent ?? []).length ?? 0} />
      </div>

      <div className="mt-6">
        <UniversityDashboard />
      </div>
    </AppShell>
  )
}
