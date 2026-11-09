import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession, hasRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { AppShell } from '@/components/AppShell'
import { ADMIN_NAV } from '@/components/AdminNav'
import { Stat } from '@/components/ui'
import { dayLabel, windowLabel } from '@/lib/offcampus/logic'
import { Preview } from './preview'
import { NightsTab, NightReport } from './nights'
import { ClubsTab } from './clubs'
import { MembersTab } from './members'
import { PrizesTab } from './prizes'
import { SettingsTab } from './settings'

export const dynamic = 'force-dynamic'

const TABS = [
  ['overview', 'Overview'], ['nights', 'Nights'], ['clubs', 'Clubs'], ['members', 'Members'], ['prizes', 'Prizes'], ['settings', 'Settings'],
] as const

export default async function AdminOffCampus({ searchParams }: { searchParams: Promise<{ tab?: string; night?: string }> }) {
  const s = await getSession()
  if (!s) redirect('/login')
  if (!hasRole(s, 'admin')) redirect('/dashboard')
  const { tab: rawTab, night } = await searchParams
  const tab = TABS.some(([k]) => k === rawTab) ? rawTab! : 'overview'

  const supabase = await createClient()
  const [{ data: settings }, { data: seasons }, { data: nights }, { data: arrivals }, { data: flags }, { data: requests },
    { data: organisers }, { data: teams }, { data: unis }, { count: members }, { data: prizes }] = await Promise.all([
    supabase.from('offcampus_settings').select('*').eq('id', 1).maybeSingle(),
    supabase.from('offcampus_seasons').select('*').order('number'),
    supabase.from('offcampus_nights').select('*').order('night_date'),
    supabase.from('offcampus_arrivals').select('night_id').is('voided_at', null).limit(20000),
    supabase.from('offcampus_flags').select('id, night_id').eq('status', 'open'),
    supabase.from('offcampus_team_requests').select('id, university_id, name, organiser_requested, created_at').eq('status', 'pending').order('created_at'),
    supabase.from('offcampus_organisers').select('id, status, created_at, member_id, team_id, offcampus_members(full_name), offcampus_teams(name)').order('created_at'),
    supabase.from('offcampus_teams').select('id, university_id, name, status, is_test, merged_into').order('name'),
    supabase.from('universities').select('id, name, short_name, regions, sort_order').eq('is_active', true).order('sort_order'),
    supabase.from('offcampus_members').select('id', { count: 'exact', head: true }).eq('is_test', false),
    supabase.from('offcampus_prizes').select('*').order('proposed_at', { ascending: false }),
  ])

  const byNight = new Map<string, number>()
  for (const a of arrivals ?? []) byNight.set(a.night_id, (byNight.get(a.night_id) ?? 0) + 1)
  const flagsByNight = new Map<string, number>()
  for (const f of flags ?? []) if (f.night_id) flagsByNight.set(f.night_id, (flagsByNight.get(f.night_id) ?? 0) + 1)
  const nightRows = (nights ?? []).map(n => ({ ...n, arrivals: byNight.get(n.id) ?? 0, open_flags: flagsByNight.get(n.id) ?? 0 }))
  // Every active university (0058); the picker isn't limited to Brisbane.
  const allUnis = unis ?? []
  const now = Date.now()
  const current = nightRows.find(n => !n.skipped && Date.parse(n.opens_at) <= now && Date.parse(n.closes_at) > now)
  const next = nightRows.find(n => !n.skipped && Date.parse(n.opens_at) > now)
  const pendingOrganisers = (organisers ?? []).filter(o => o.status === 'requested')

  return (
    <AppShell nav={ADMIN_NAV} current="/admin/offcampus" title="Off Campus"
      subtitle="Off Campus Thursdays at Su Casa: clubs, verified arrivals, results and prizes.">
      {!settings?.enabled && (
        <div className="card p-4 mb-4 border-amber-500/40 text-sm">
          <b>Off Campus is switched off.</b> The public pages return “not found” and the door won’t count passes until it’s
          switched on in <Link href="/admin/offcampus?tab=settings" className="text-luna-gold underline">Settings</Link>.
        </div>
      )}
      <nav className="flex flex-wrap gap-2 mb-5" aria-label="Off Campus sections">
        {TABS.map(([k, label]) => (
          <Link key={k} href={`/admin/offcampus?tab=${k}`}
            className={`pill text-sm px-3.5 py-2 ${tab === k ? 'bg-luna-gold text-black' : 'bg-luna-surface border border-white/[0.07] text-luna-text'}`}>
            {label}
            {k === 'clubs' && (requests?.length ?? 0) + pendingOrganisers.length > 0 && <span className="ml-1.5">· {(requests?.length ?? 0) + pendingOrganisers.length}</span>}
            {k === 'nights' && (flags?.length ?? 0) > 0 && <span className="ml-1.5">· {flags!.length} flag{flags!.length === 1 ? '' : 's'}</span>}
          </Link>
        ))}
      </nav>

      {tab === 'overview' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat label="Members" value={members ?? 0} sub="registered (test members excluded)" />
            <Stat label={current ? 'Counted tonight' : 'Last night'} accent={!!current}
              value={current ? current.arrivals : ([...nightRows].reverse().find(n => Date.parse(n.closes_at) <= now)?.arrivals ?? 0)}
              sub={current ? `Door open ${windowLabel(current.opens_at, current.closes_at)}` : next ? `Next ${dayLabel(next.night_date)}` : 'No nights planned'} />
            <Stat label="Open flags" value={flags?.length ?? 0} accent={(flags?.length ?? 0) > 0} sub="hold prize checks" href="/admin/offcampus?tab=nights" />
            <Stat label="Waiting on you" value={(requests?.length ?? 0) + pendingOrganisers.length}
              sub={`${requests?.length ?? 0} new club${requests?.length === 1 ? '' : 's'} · ${pendingOrganisers.length} organiser${pendingOrganisers.length === 1 ? '' : 's'}`} href="/admin/offcampus?tab=clubs" />
          </div>
          <div className="card p-4 text-sm grid sm:grid-cols-4 gap-3">
            <Switch label="Sign-up and door" on={!!settings?.enabled} />
            <Switch label="Public results" on={!!settings?.public_board} />
            <Switch label="Prizes on What’s On" on={!!settings?.show_prizes} />
            <Switch label="Prize workflow" on={!!settings?.prizes_on} />
          </div>
          <Preview />
          <p className="text-xs text-luna-muted">
            Public page: <a className="underline" href="https://memberships.lunagroup.com.au/offcampus" target="_blank" rel="noreferrer">memberships.lunagroup.com.au/offcampus</a>
            {' '}· sign-up: /offcampus/register · door: scan the pass in Door Check-in.
          </p>
        </div>
      )}

      {tab === 'nights' && (night
        ? <NightReport nightId={night} teams={teams ?? []} unis={allUnis} />
        : <NightsTab nights={nightRows} seasons={seasons ?? []} />)}
      {tab === 'clubs' && <ClubsTab unis={allUnis} teams={teams ?? []} requests={requests ?? []} organisers={(organisers ?? []) as any[]} />}
      {tab === 'members' && <MembersTab unis={allUnis} teams={teams ?? []} />}
      {tab === 'prizes' && <PrizesTab prizes={prizes ?? []} nights={nightRows} seasons={seasons ?? []} settings={settings} organisers={(organisers ?? []) as any[]} />}
      {tab === 'settings' && <SettingsTab settings={settings} />}
    </AppShell>
  )
}

function Switch({ label, on }: { label: string; on: boolean }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-luna-muted">{label}</div>
      <div className={`font-semibold ${on ? 'text-emerald-400' : 'text-luna-subtle'}`}>{on ? 'On' : 'Off'}</div>
    </div>
  )
}
