import { getSession, hasRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/AppShell'
import { ADMIN_NAV } from '@/components/AdminNav'
import { PromotersBrowser } from './browser'
import { AutoApproveToggle } from './auto-approve'

export const dynamic = 'force-dynamic'

export default async function AdminPromoters({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const s = await getSession()
  if (!s) redirect('/login')
  if (!hasRole(s, 'admin')) redirect('/dashboard')
  const { status } = await searchParams

  const supabase = await createClient()
  const [{ data: promoters }, { data: settings }] = await Promise.all([
    supabase.from('promoters')
      .select('id,full_name,email,mobile,date_of_birth,instagram,suburb,status,promoter_code,current_tier,elite_override,created_at,admin_notes(note,created_at)')
      .eq('is_staff', false)
      .order('created_at', { ascending: false }),
    supabase.from('app_settings').select('auto_approve_promoters').eq('id', 1).maybeSingle(),
  ])

  return (
    <AppShell nav={ADMIN_NAV} current="/admin/promoters" title="Promoters">
      <AutoApproveToggle initial={settings?.auto_approve_promoters ?? false} />
      <PromotersBrowser promoters={(promoters ?? []) as any} initialStatus={status ?? ''} />
    </AppShell>
  )
}
