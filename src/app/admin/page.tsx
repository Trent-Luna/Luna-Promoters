import { getSession, hasRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/AppShell'
import { ADMIN_NAV } from '@/components/AdminNav'
import { Stat, TierBadge } from '@/components/ui'
import { Icon } from '@/components/icons'
import { pct } from '@/lib/format'
import Link from 'next/link'
import { TonightBoard, type NightVenue } from './tonight-board'
import { NewPromoters } from './new-promoters'
import { EMPTY_INTAKE, type NewPromoterIntake } from '@/lib/new-promoters'

export const dynamic = 'force-dynamic'

function TopList({ title, rows, houseRow, href }:
  { title: string; rows: any[]; houseRow?: number; href: string }) {
  return (
    <div className="card p-5">
      <div className="flex items-end gap-3 mb-2">
        <h2 className="font-bold leading-tight">{title}</h2>
        <Link href={href} className="ml-auto text-xs text-luna-gold hover:text-luna-goldsoft">Leaderboards</Link>
      </div>
      {rows.length === 0 && <p className="text-luna-muted text-sm py-3">No check-ins yet this month.</p>}
      {rows.map((r: any, i: number) => (
        <div key={r.promoter_id} className="grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-3 py-2 border-t border-white/[0.07]">
          <span className="text-xs text-luna-muted">{i + 1}</span>
          <div className="min-w-0">
            <div className="font-semibold truncate">{r.promoter_name}</div>
            <div className="text-xs text-luna-muted truncate">/p/{r.promoter_code}</div>
          </div>
          <span className="flex items-center gap-2.5">
            <TierBadge tier={r.tier} />
            <span className="font-bold tabular-nums min-w-[2.25rem] text-right">{r.checked_in}</span>
          </span>
        </div>
      ))}
      {houseRow !== undefined && (
        <div className="grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-3 pt-2.5 mt-1 border-t border-dashed border-white/[0.12]">
          <span className="text-luna-muted"><Icon name="home" size={14} /></span>
          <span className="text-luna-muted">Luna Group <span className="text-xs">(house link)</span></span>
          <span className="font-semibold tabular-nums text-luna-muted">{houseRow}</span>
        </div>
      )}
    </div>
  )
}

export default async function AdminOverview() {
  const s = await getSession()
  if (!s) redirect('/login')
  if (!hasRole(s, 'admin')) redirect('/dashboard')

  const supabase = await createClient()
  const monthStart = new Date(); monthStart.setDate(1)
  const mStr = monthStart.toISOString().slice(0, 10)

  const [{ data: stats }, { data: board }, { data: house }, { data: tonight }, { data: fresh }] = await Promise.all([
    supabase.rpc('get_admin_stats', {}),
    supabase.rpc('get_leaderboard', { p_from: mStr, p_limit: 500 }),
    supabase.rpc('get_house_stats', { p_from: mStr }),
    supabase.rpc('get_tonight_board', {}),
    supabase.rpc('get_new_promoters', { p_days: 14, p_limit: 6 }),
  ])

  const all = (board ?? []) as any[]
  const promoters = all.filter(r => r.category === 'promoter').slice(0, 5)
  const djs = all.filter(r => r.category === 'dj').slice(0, 5)
  const staff = all.filter(r => r.category === 'staff').slice(0, 5)
  const night = (tonight ?? { date: mStr, venues: [] }) as { date: string; venues: NightVenue[] }
  const intake = (fresh ?? EMPTY_INTAKE) as NewPromoterIntake
  const pending = stats?.pending_promoters ?? 0
  const dormant = stats?.dormant_promoters ?? 0

  const today = new Date(night.date + 'T12:00:00').toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <AppShell nav={ADMIN_NAV} current="/admin" eyebrow="Admin overview" title={today}
      subtitle="Promoter performance across Luna Group this month."
      right={
        <>
          <Link href="/admin/summary" className="btn-ghost !py-2 !px-3 text-sm"><Icon name="chart" size={14} /> Weekly summary</Link>
          <Link href="/admin/exports" className="btn-gold !py-2 !px-3 text-sm"><Icon name="download" size={14} /> Export CSV</Link>
        </>
      }>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Active promoters" value={stats?.active_promoters ?? 0}
          sub={dormant > 0 ? `${dormant} dormant` : `${stats?.total_promoters ?? 0} total`} href="/admin/promoters" />
        <Stat label="Pending approval" value={pending} accent={pending > 0} sub={pending > 0 ? 'Tap to review' : 'Queue is clear'} href="/admin/promoters?status=pending" />
        <Stat label="Guests registered" value={(stats?.month_registered ?? 0).toLocaleString('en-AU')} sub="This month" />
        <Stat label="Guests checked in" value={(stats?.month_checked_in ?? 0).toLocaleString('en-AU')} accent
          sub={`${pct(stats?.month_checked_in ?? 0, stats?.month_registered ?? 0)}% attendance`} />
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-4 mt-4 items-start">
        <TonightBoard date={night.date} venues={night.venues} canToggle />
        <TopList title="Top promoters this month" rows={promoters} houseRow={house?.checked_in ?? 0} href="/admin/leaderboards" />
      </div>

      <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-4 mt-4 items-start">
        <NewPromoters intake={intake} />
        {djs.length > 0 && <TopList title="Top DJs this month" rows={djs} href="/admin/leaderboards" />}
        {staff.length > 0 && <TopList title="Top staff this month" rows={staff} href="/admin/leaderboards" />}
      </div>
    </AppShell>
  )
}
