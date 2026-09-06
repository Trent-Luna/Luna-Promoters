import { getSession, hasRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { AppShell } from '@/components/AppShell'
import { ADMIN_NAV } from '@/components/AdminNav'
import { Icon } from '@/components/icons'
import { PromotersBrowser } from './browser'
import { AutoApproveToggle } from './auto-approve'
import { QueueBanner } from './queue-banner'

export const dynamic = 'force-dynamic'

export default async function AdminPromoters({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const s = await getSession()
  if (!s) redirect('/login')
  if (!hasRole(s, 'admin')) redirect('/dashboard')
  const { status, q } = await searchParams

  const supabase = await createClient()
  const monthStart = new Date(); monthStart.setDate(1)
  const mStr = monthStart.toISOString().slice(0, 10)
  const [{ data: promoters }, { data: settings }, { data: perf }] = await Promise.all([
    supabase.from('promoters')
      .select('id,full_name,email,mobile,date_of_birth,instagram,suburb,status,promoter_code,current_tier,elite_override,category,created_at,dormant_since,last_registration_at,nudged_at,admin_notes(note,created_at)')
      .eq('is_staff', false)
      .order('created_at', { ascending: false }),
    supabase.from('app_settings').select('auto_approve_promoters,dormant_weeks').eq('id', 1).maybeSingle(),
    supabase.from('promoter_performance').select('promoter_id,registered_count,checked_in_count,bonus_checked_in').eq('period_month', mStr),
  ])

  const perfBy = new Map<string, { registered: number; checked: number }>()
  for (const r of perf ?? []) perfBy.set(r.promoter_id, { registered: r.registered_count ?? 0, checked: (r.checked_in_count ?? 0) + (r.bonus_checked_in ?? 0) })
  const rows = (promoters ?? []).map((p: any) => ({
    ...p,
    month_registered: perfBy.get(p.id)?.registered ?? 0,
    month_checked_in: perfBy.get(p.id)?.checked ?? 0,
  }))

  const pending = rows.filter(p => p.status === 'pending')
  const dormant = rows.filter(p => p.status === 'approved' && p.dormant_since)
  const oldestPending = pending.length ? Math.floor((Date.now() - new Date(pending[pending.length - 1].created_at).getTime()) / 864e5) : 0

  return (
    <AppShell nav={ADMIN_NAV} current="/admin/promoters" title="Promoters"
      subtitle="Approve applications, set tiers and manage who can run a list."
      right={
        <>
          <AutoApproveToggle initial={settings?.auto_approve_promoters ?? false} compact />
          <a href="/api/export/promoters" className="btn-ghost !py-2 !px-3 text-sm"><Icon name="download" size={14} /> CSV</a>
          <Link href="/memberships/promoter" className="btn-gold !py-2 !px-3 text-sm"><Icon name="users" size={14} /> Sign-up link</Link>
        </>
      }>
      {(pending.length > 0 || dormant.length > 0) && (
        <QueueBanner
          pending={pending.length} oldestPendingDays={oldestPending}
          pendingNames={pending.slice(0, 3).map(p => p.full_name)}
          dormant={dormant.length} dormantWeeks={settings?.dormant_weeks ?? 8}
        />
      )}
      <PromotersBrowser promoters={rows as any} initialStatus={status ?? ''} initialQuery={q ?? ''} dormantWeeks={settings?.dormant_weeks ?? 8} />
    </AppShell>
  )
}
