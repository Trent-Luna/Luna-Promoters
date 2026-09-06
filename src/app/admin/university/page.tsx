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
    <AppShell nav={ADMIN_NAV} current="/admin/university" title="University"
      subtitle="Student memberships — verify IDs, approve members and issue wristbands at the door.">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Members" value={stats?.total ?? 0} sub={`${stats?.approved ?? 0} approved · ${(stats?.recent ?? []).length ?? 0} new this week`} />
        <Stat label="Manual review" value={stats?.manual_review ?? 0} accent={(stats?.manual_review ?? 0) > 0} sub="IDs waiting on you" />
        <Stat label="Pending" value={stats?.pending_verification ?? 0} sub={`${stats?.rejected ?? 0} rejected · ${stats?.suspended ?? 0} suspended`} />
        <Stat label="Wristbands tonight" value={stats?.wristbands_tonight ?? 0} accent />
      </div>

      <div className="mt-4">
        <UniversityDashboard />
      </div>

      {isAdmin && (
        <div className="mt-6 space-y-0">
          <div className="eyebrow mb-3">Approval settings</div>
          <UniversityAutoApproveToggle initial={settings?.auto_approve_university ?? true} />
          <UniversityApproveAllToggle initial={settings?.university_approve_all ?? false} />
        </div>
      )}
    </AppShell>
  )
}
