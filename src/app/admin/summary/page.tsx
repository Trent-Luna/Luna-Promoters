import { getSession, hasRole } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/AppShell'
import { ADMIN_NAV } from '@/components/AdminNav'
import { WeeklySummary } from './weekly'

export const dynamic = 'force-dynamic'

export default async function AdminSummary() {
  const s = await getSession()
  if (!s) redirect('/login')
  if (!hasRole(s, 'admin')) redirect('/dashboard')
  return (
    <AppShell nav={ADMIN_NAV} current="/admin/summary" title="Weekly summary">
      <WeeklySummary />
    </AppShell>
  )
}
