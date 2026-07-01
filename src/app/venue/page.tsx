import { getSession, hasRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/AppShell'
import { VENUE_NAV } from '@/components/nav'
import { Stat } from '@/components/ui'
import { pct } from '@/lib/format'

export const dynamic = 'force-dynamic'

export default async function VenueDashboard() {
  const s = await getSession()
  if (!s) redirect('/login')
  if (!hasRole(s, 'venue_manager')) redirect('/dashboard')
  const supabase = await createClient()
  const ids = s.venueIds.length ? s.venueIds : ['00000000-0000-0000-0000-000000000000']
  const { data: venues } = await supabase.from('venues').select('id,name').in('id', ids)

  const cards = await Promise.all((venues ?? []).map(async v => {
    const { data } = await supabase.rpc('get_admin_stats', { p_venue: v.id })
    return { name: v.name, stats: data }
  }))

  return (
    <AppShell nav={VENUE_NAV} current="/venue" title="Venue dashboard">
      <p className="text-luna-muted text-sm mb-5">You manage: {(venues ?? []).map(v => v.name).join(', ') || 'no venues assigned yet'}.</p>
      <div className="space-y-6">
        {cards.map(c => (
          <div key={c.name}>
            <h2 className="font-bold mb-3">{c.name}</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat label="Guests registered" value={c.stats?.total_registered ?? 0} />
              <Stat label="Guests checked in" value={c.stats?.total_checked_in ?? 0} accent />
              <Stat label="Attendance" value={`${pct(c.stats?.total_checked_in ?? 0, c.stats?.total_registered ?? 0)}%`} />
              <Stat label="Active promoters" value={c.stats?.active_promoters ?? 0} />
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  )
}
