import { getSession, hasRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/AppShell'
import { ADMIN_NAV } from '@/components/AdminNav'
import { PromotersBrowser } from './browser'

export const dynamic = 'force-dynamic'

export default async function AdminPromoters({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const s = await getSession()
  if (!s) redirect('/login')
  if (!hasRole(s, 'admin')) redirect('/dashboard')
  const { status } = await searchParams

  const supabase = await createClient()
  const { data: promoters } = await supabase.from('promoters')
    .select('id,full_name,email,mobile,date_of_birth,instagram,suburb,status,promoter_code,current_tier,elite_override,created_at,admin_notes(note,created_at)')
    .order('created_at', { ascending: false })

  return (
    <AppShell nav={ADMIN_NAV} current="/admin/promoters" title="Promoters">
      <PromotersBrowser promoters={(promoters ?? []) as any} initialStatus={status ?? ''} />
    </AppShell>
  )
}
