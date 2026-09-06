import { getSession, hasRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/AppShell'
import { VENUE_NAV } from '@/components/nav'
import { Stat } from '@/components/ui'
import { pct } from '@/lib/format'
import { TonightBoard, type NightVenue } from '@/app/admin/tonight-board'

export const dynamic = 'force-dynamic'

export default async function VenueDashboard() {
  const s = await getSession()
  if (!s) redirect('/login')
  if (!hasRole(s, 'venue_manager')) redirect('/dashboard')
  const supabase = await createClient()
  const ids = s.venueIds.length ? s.venueIds : ['00000000-0000-0000-0000-000000000000']
  const { data: venues } = await supabase.from('venues').select('id,name').in('id', ids)

  const [cards, { data: tonight }] = await Promise.all([
    Promise.all((venues ?? []).map(async v => {
      const { data } = await supabase.rpc('get_admin_stats', { p_venue: v.id })
      return { name: v.name, stats: data }
    })),
    supabase.rpc('get_tonight_board', {}),
  ])
  const night = (tonight ?? { date: '', venues: [] }) as { date: string; venues: NightVenue[] }
  const mine = new Set(ids)
  const myNight = night.venues.filter(v => mine.has(v.venue_id))

  return (
    <AppShell nav={VENUE_NAV} current="/venue" eyebrow="Venue manager" title="Overview"
      subtitle={`You manage ${(venues ?? []).map(v => v.name).join(', ') || 'no venues yet'}. This month, per venue.`}>
      <div className="space-y-4">
        {night.date && <TonightBoard date={night.date} venues={myNight} canToggle />}
        {cards.map(c => (
          <div key={c.name}>
            <h2 className="font-bold mb-2">{c.name}</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Stat label="Guests registered" value={c.stats?.month_registered ?? 0} sub="This month" />
              <Stat label="Guests checked in" value={c.stats?.month_checked_in ?? 0} accent />
              <Stat label="Attendance" value={`${pct(c.stats?.month_checked_in ?? 0, c.stats?.month_registered ?? 0)}%`} />
              <Stat label="All-time checked in" value={c.stats?.total_checked_in ?? 0} />
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  )
}
