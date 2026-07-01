import { getSession, hasRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/AppShell'
import { ADMIN_NAV } from '@/components/AdminNav'
import { Stat, TierBadge } from '@/components/ui'
import { fmtDateTime, pct } from '@/lib/format'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

function TopList({ title, rows, houseRow }:
  { title: string; rows: any[]; houseRow?: number }) {
  return (
    <div className="card p-5">
      <h2 className="font-bold mb-3">{title}</h2>
      {houseRow !== undefined && (
        <div className="flex items-center gap-3 py-2 mb-1 rounded-lg bg-luna-purple/10 px-2">
          <span className="w-6 text-center">🏠</span>
          <span className="flex-1 font-medium">Luna Group <span className="text-luna-muted text-xs">(public guestlist)</span></span>
          <span className="text-emerald-400 font-semibold w-10 text-right">{houseRow}</span>
        </div>
      )}
      {rows.length === 0 && <p className="text-luna-muted text-sm">No check-ins yet this month.</p>}
      {rows.map((r: any, i: number) => (
        <div key={r.promoter_id} className="flex items-center gap-3 py-2 border-b border-luna-border/40 last:border-0">
          <span className="w-6 text-luna-gold font-bold">#{i + 1}</span>
          <span className="flex-1 font-medium">{r.promoter_name} <span className="text-luna-muted text-xs">({r.promoter_code})</span></span>
          <TierBadge tier={r.tier} />
          <span className="text-emerald-400 font-semibold w-10 text-right">{r.checked_in}</span>
        </div>
      ))}
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

  const [{ data: stats }, { data: board }, { data: recent }, { data: pending }, { data: house }] = await Promise.all([
    supabase.rpc('get_admin_stats', {}),
    supabase.rpc('get_leaderboard', { p_from: mStr, p_limit: 500 }),
    supabase.from('check_ins').select('checked_in_at,no_entry,guest_registrations(guests(first_name,last_name),events(name),promoters(full_name))').order('checked_in_at', { ascending: false }).limit(8),
    supabase.from('promoters').select('id').eq('status', 'pending'),
    supabase.rpc('get_house_stats', { p_from: mStr }),
  ])

  const all = (board ?? []) as any[]
  const promoters = all.filter(r => r.category === 'promoter').slice(0, 10)
  const djs = all.filter(r => r.category === 'dj').slice(0, 10)
  const staff = all.filter(r => r.category === 'staff').slice(0, 10)

  return (
    <AppShell nav={ADMIN_NAV} current="/admin" title="Admin overview">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Total promoters" value={stats?.total_promoters ?? 0} />
        <Link href="/admin/promoters?status=pending"><Stat label="Pending approval" value={stats?.pending_promoters ?? 0} accent /></Link>
        <Stat label="Active promoters" value={stats?.active_promoters ?? 0} />
        <Stat label="Suspended" value={stats?.suspended_promoters ?? 0} />
        <Stat label="Guests registered" value={stats?.total_registered ?? 0} />
        <Stat label="Guests checked in" value={stats?.total_checked_in ?? 0} accent />
        <Stat label="Attendance" value={`${pct(stats?.total_checked_in ?? 0, stats?.total_registered ?? 0)}%`} />
        <Link href="/admin/exports"><Stat label="CSV exports" value="→" /></Link>
      </div>

      {(pending?.length ?? 0) > 0 && (
        <Link href="/admin/promoters?status=pending"
          className="block card p-4 mt-5 border-luna-gold/40 bg-luna-gold/5">
          <span className="text-luna-gold font-semibold">{pending?.length} promoter application{pending?.length === 1 ? '' : 's'} awaiting review →</span>
        </Link>
      )}

      <div className="grid lg:grid-cols-2 gap-5 mt-6">
        <TopList title="Top 10 promoters this month" rows={promoters} houseRow={house?.checked_in ?? 0} />
        <TopList title="Top 10 DJs this month" rows={djs} />
        <TopList title="Top 10 staff this month" rows={staff} />
        <div className="card p-5">
          <h2 className="font-bold mb-3">Recent check-ins</h2>
          {(recent ?? []).length === 0 && <p className="text-luna-muted text-sm">Nothing yet.</p>}
          {(recent ?? []).map((r: any, i: number) => (
            <div key={i} className="flex items-center gap-2 py-2 border-b border-luna-border/40 last:border-0 text-sm">
              <span className={`w-2 h-2 rounded-full ${r.no_entry ? 'bg-red-400' : 'bg-emerald-400'}`} />
              <span className="flex-1">{r.guest_registrations?.guests?.first_name} {r.guest_registrations?.guests?.last_name}
                <span className="text-luna-muted"> · {r.guest_registrations?.events?.name}</span></span>
              <span className="text-luna-muted text-xs">{fmtDateTime(r.checked_in_at)}</span>
            </div>
          ))}
        </div>
      </div>

    </AppShell>
  )
}
