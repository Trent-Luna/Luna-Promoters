import { getSession, hasRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/AppShell'
import { ADMIN_NAV } from '@/components/AdminNav'
import { StatusPill, TierBadge } from '@/components/ui'
import { fmtDate } from '@/lib/format'
import { PromoterActions } from './actions-ui'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function AdminPromoters({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const s = await getSession()
  if (!s) redirect('/login')
  if (!hasRole(s, 'admin')) redirect('/dashboard')
  const { status } = await searchParams

  const supabase = await createClient()
  let q = supabase.from('promoters')
    .select('id,full_name,email,mobile,date_of_birth,instagram,suburb,status,promoter_code,current_tier,elite_override,created_at,admin_notes(note,created_at)')
    .order('created_at', { ascending: false })
  if (status) q = q.eq('status', status)
  const { data: promoters } = await q

  const tabs = ['', 'pending', 'approved', 'suspended', 'rejected']
  return (
    <AppShell nav={ADMIN_NAV} current="/admin/promoters" title="Promoters">
      <div className="flex gap-2 mb-4 flex-wrap">
        {tabs.map(t => (
          <Link key={t || 'all'} href={t ? `/admin/promoters?status=${t}` : '/admin/promoters'}
            className={`pill border ${(status || '') === t ? 'bg-luna-gold/15 text-luna-gold border-luna-gold' : 'border-luna-border text-luna-muted'}`}>
            {t ? t[0].toUpperCase() + t.slice(1) : 'All'}
          </Link>
        ))}
      </div>
      <div className="space-y-3">
        {(promoters ?? []).length === 0 && <div className="card p-6 text-center text-luna-muted">No promoters.</div>}
        {(promoters ?? []).map((p: any) => (
          <div key={p.id} className="card p-5">
            <div className="flex flex-wrap items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-lg">{p.full_name}</span>
                  <StatusPill status={p.status} />
                  {p.status === 'approved' && <TierBadge tier={p.current_tier} />}
                  {p.promoter_code && <code className="text-xs text-luna-gold">/p/{p.promoter_code}</code>}
                </div>
                <div className="text-sm text-luna-muted mt-1">
                  {p.email} · {p.mobile} · DOB {fmtDate(p.date_of_birth)}
                  {p.suburb ? ` · ${p.suburb}` : ''}{p.instagram ? ` · ${p.instagram}` : ''}
                </div>
                {(p.admin_notes ?? []).length > 0 && (
                  <div className="mt-2 text-xs text-luna-muted space-y-0.5">
                    {p.admin_notes.map((n: any, i: number) => <div key={i}>📝 {n.note}</div>)}
                  </div>
                )}
              </div>
              <PromoterActions id={p.id} status={p.status} elite={p.elite_override} />
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  )
}
