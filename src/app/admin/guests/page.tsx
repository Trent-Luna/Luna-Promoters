import { getSession, hasRole } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/AppShell'
import { ADMIN_NAV } from '@/components/AdminNav'
import { GuestDirectory } from './browser'

export const dynamic = 'force-dynamic'

export default async function AdminGuests() {
  const s = await getSession()
  if (!s) redirect('/login')
  if (!hasRole(s, 'admin')) redirect('/dashboard')
  return (
    <AppShell nav={ADMIN_NAV} current="/admin/guests" title="Guests">
      <GuestDirectory />
    </AppShell>
  )
}
