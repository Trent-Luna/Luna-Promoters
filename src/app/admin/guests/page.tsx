import { getSession, hasRole } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/AppShell'
import { ADMIN_NAV } from '@/components/AdminNav'
import { GuestDirectory } from './browser'

export const dynamic = 'force-dynamic'

export default async function AdminGuests({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const s = await getSession()
  if (!s) redirect('/login')
  if (!hasRole(s, 'admin')) redirect('/dashboard')
  const { q } = await searchParams
  return (
    <AppShell nav={ADMIN_NAV} current="/admin/guests" title="Guests"
      subtitle="Everyone who has ever registered on a promoter or house link.">
      <GuestDirectory initialQuery={q ?? ''} />
    </AppShell>
  )
}
