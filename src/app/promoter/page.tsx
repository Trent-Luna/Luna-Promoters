import { getSession, hasRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/AppShell'
import { QRCode } from '@/components/QRCode'
import { SaveQR } from '@/components/SaveQR'
import { TierBadge, Stat } from '@/components/ui'
import { TierProgressBar } from '@/components/TierProgressBar'
import { fmtDate, pct } from '@/lib/format'
import { CopyLink } from './copy-link'
import { PROMOTER_NAV } from '@/components/nav'

export const dynamic = 'force-dynamic'

export default async function PromoterDashboard() {
  const s = await getSession()
  if (!s) redirect('/login')
  if (!hasRole(s, 'promoter')) redirect('/dashboard')

  const supabase = await createClient()
  const { data: p } = await supabase.from('promoters')
    .select('id, full_name, promoter_code, current_tier, status').eq('user_id', s.userId).maybeSingle()

  if (!p) {
    return (
      <AppShell nav={PROMOTER_NAV} current="/promoter" title="Promoter">
        <div className="card p-6">Your promoter profile isn&apos;t linked yet. Please contact Luna Group.</div>
      </AppShell>
    )
  }

  const monthStart = new Date(); monthStart.setDate(1)
  const mStr = monthStart.toISOString().slice(0, 10)
  const [{ data: tiers }, { data: perf }, { data: events }, { data: board }, { data: refs }] = await Promise.all([
    supabase.from('tiers').select('name,min_guests,max_guests,invite_only,perks').order('sort_order'),
    supabase.from('promoter_performance').select('checked_in_count,registered_count').eq('promoter_id', p.id).eq('period_month', mStr).maybeSingle(),
    supabase.rpc('get_promoter_events', { p_promoter: p.id }),
    supabase.rpc('get_leaderboard', { p_from: mStr, p_limit: 500 }),
    supabase.rpc('get_my_referrals', { p_promoter: p.id }),
  ])

  const checkedThisMonth = perf?.checked_in_count ?? 0
  const myRank = (board ?? []).find((r: any) => r.promoter_id === p.id)?.rank ?? '—'
  const perks = (tiers ?? []).find((t: any) => t.name === p.current_tier)?.perks ?? ''

  const site = process.env.NEXT_PUBLIC_SITE_URL || ''
  const link = `${site}/p/${p.promoter_code}`
  const referralLink = `${site}/?ref=${p.promoter_code}`
  const totalReg = (events ?? []).reduce((a: number, e: any) => a + Number(e.registered), 0)
  const totalCi = (events ?? []).reduce((a: number, e: any) => a + Number(e.checked_in), 0)

  const boardRows = (board ?? []) as any[]
  const top = boardRows.slice(0, 10)
  const mine = boardRows.find(r => r.promoter_id === p.id)
  const boardShow = mine && !top.some(r => r.promoter_id === p.id) ? [...top, mine] : top

  return (
    <AppShell nav={PROMOTER_NAV} current="/promoter"
      title={`Welcome, ${p.full_name.split(' ')[0]}`}>
      <div className="grid lg:grid-cols-3 gap-5">
        {/* link card */}
        <div className="card p-6 lg:col-span-2">
          <p className="text-xs uppercase tracking-wide text-luna-muted mb-2">Your promoter link</p>
          <CopyLink link={link} />
          <a href="/promoter-guide.pdf" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-xl border border-luna-border bg-luna-surface text-sm text-luna-gold hover:border-luna-gold transition">
            <span aria-hidden>📄</span> New here? Open the Promoter Guide (PDF)
          </a>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
            <Stat label="This month rank" value={`#${myRank}`} accent />
            <Stat label="Registered (mo)" value={perf?.registered_count ?? 0} />
            <Stat label="Checked in (mo)" value={checkedThisMonth} />
            <Stat label="Attendance" value={`${pct(checkedThisMonth, perf?.registered_count ?? 0)}%`} />
          </div>
        </div>
        {/* QR card */}
        <div className="card p-6 flex flex-col items-center justify-center">
          <QRCode value={link} size={170} />
          <p className="text-xs text-luna-muted mt-3 mb-3">Share this QR to sign up guests</p>
          <SaveQR qrValue={link} title={p.full_name} lines={[`Guestlist · /p/${p.promoter_code}`]}
            fileName="luna-promoter-qr.png" label="Save my QR" />
        </div>
      </div>

      {/* tier progress */}
      <div className="card p-6 mt-5">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-sm text-luna-muted">Current tier</span>
          <TierBadge tier={p.current_tier} />
        </div>
        <TierProgressBar checkedThisMonth={checkedThisMonth} tiers={(tiers ?? []) as any} currentTier={p.current_tier} />
        <p className="text-sm text-luna-muted mt-4"><span className="text-luna-text font-medium">Perks unlocked:</span> {perks}</p>
      </div>

      {/* referral program */}
      <div className="card p-6 mt-5">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
          <h2 className="text-lg font-bold">Refer a friend</h2>
          <span className="text-xs text-luna-muted">Each approved referral = <span className="text-luna-gold font-semibold">+3</span> toward your tier</span>
        </div>
        <p className="text-sm text-luna-muted mb-4">
          Share your referral link. When a new promoter signs up through it and gets approved,
          you get <span className="text-luna-text font-medium">3 bonus check-ins</span> added to your monthly tier progress.
        </p>
        <CopyLink link={referralLink} />
        <div className="grid grid-cols-3 gap-3 mt-6">
          <Stat label="Referrals" value={refs?.total ?? 0} />
          <Stat label="Approved" value={refs?.approved ?? 0} accent />
          <Stat label="Bonus this month" value={`+${refs?.bonus_this_month ?? 0}`} />
        </div>
      </div>

      {/* monthly leaderboard */}
      <div className="flex items-center justify-between mt-8 mb-3">
        <h2 className="text-lg font-bold">This month&apos;s leaderboard</h2>
        <span className="text-xs text-luna-muted">Ranked by checked-in guests</span>
      </div>
      <div className="card overflow-x-auto no-scrollbar">
        <table className="w-full text-sm">
          <thead className="text-luna-muted text-xs uppercase tracking-wide">
            <tr className="border-b border-luna-border">
              <th className="text-left p-3 w-14">Rank</th><th className="text-left p-3">Promoter</th>
              <th className="text-left p-3">Tier</th><th className="text-right p-3">Checked in</th>
              <th className="text-right p-3">Att %</th>
            </tr>
          </thead>
          <tbody>
            {boardShow.length === 0 && (
              <tr><td colSpan={5} className="p-6 text-center text-luna-muted">No check-ins yet this month — be the first to climb the board!</td></tr>
            )}
            {boardShow.map((r: any) => {
              const me = r.promoter_id === p.id
              return (
                <tr key={r.promoter_id} className={`border-b border-luna-border/50 ${me ? 'bg-luna-gold/10' : ''}`}>
                  <td className="p-3 font-bold text-luna-gold">#{r.rank}</td>
                  <td className="p-3 font-medium">{me ? 'You' : r.promoter_name}
                    <span className="text-luna-muted text-xs"> ({r.promoter_code})</span></td>
                  <td className="p-3"><TierBadge tier={r.tier} /></td>
                  <td className="p-3 text-right text-emerald-400 font-semibold">{r.checked_in}</td>
                  <td className="p-3 text-right">{r.attendance_pct}%</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* events */}
      <h2 className="text-lg font-bold mt-8 mb-3">Event performance</h2>
      <div className="card overflow-x-auto no-scrollbar">
        <table className="w-full text-sm">
          <thead className="text-luna-muted text-xs uppercase tracking-wide">
            <tr className="border-b border-luna-border">
              <th className="text-left p-3">Event</th><th className="text-left p-3">Venue</th>
              <th className="text-left p-3">Date</th><th className="text-right p-3">Reg</th>
              <th className="text-right p-3">In</th><th className="text-right p-3">%</th>
            </tr>
          </thead>
          <tbody>
            {(events ?? []).length === 0 && <tr><td colSpan={6} className="p-6 text-center text-luna-muted">No events yet. Share your link to start building your guestlist!</td></tr>}
            {(events ?? []).map((e: any) => (
              <tr key={e.event_id} className="border-b border-luna-border/50">
                <td className="p-3 font-medium">{e.event_name}</td>
                <td className="p-3 text-luna-muted">{e.venue_name}</td>
                <td className="p-3 text-luna-muted">{fmtDate(e.event_date)}</td>
                <td className="p-3 text-right">{e.registered}</td>
                <td className="p-3 text-right text-emerald-400">{e.checked_in}</td>
                <td className="p-3 text-right">{e.attendance_pct}%</td>
              </tr>
            ))}
          </tbody>
          {(events ?? []).length > 0 && (
            <tfoot><tr className="font-semibold">
              <td className="p-3" colSpan={3}>Total</td>
              <td className="p-3 text-right">{totalReg}</td>
              <td className="p-3 text-right text-emerald-400">{totalCi}</td>
              <td className="p-3 text-right">{pct(totalCi, totalReg)}%</td>
            </tr></tfoot>
          )}
        </table>
      </div>
    </AppShell>
  )
}
