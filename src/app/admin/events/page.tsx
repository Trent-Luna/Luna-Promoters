import { getSession, hasRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { AppShell } from '@/components/AppShell'
import { navForRoles } from '@/components/nav'
import { Th, Td, EmptyRow } from '@/components/ui'
import { fmtDate, fmtTime } from '@/lib/format'
import { createEvent } from '../actions'
import { GuestlistToggle } from './toggle'

export const dynamic = 'force-dynamic'

export default async function AdminEvents({ searchParams }: { searchParams: Promise<{ show?: string; venue?: string }> }) {
  const s = await getSession()
  if (!s) redirect('/login')
  if (!hasRole(s, 'admin', 'venue_manager')) redirect('/dashboard')
  const isVM = !s.roles.includes('admin')
  const { show = 'upcoming', venue = '' } = await searchParams

  const supabase = await createClient()
  let vq = supabase.from('venues').select('id,name').eq('active', true).order('name')
  if (isVM) vq = vq.in('id', s.venueIds.length ? s.venueIds : ['00000000-0000-0000-0000-000000000000'])
  const { data: venues } = await vq

  const today = new Date(Date.now() + 10 * 3600_000).toISOString().slice(0, 10)
  let eq = supabase.from('events')
    .select('id,name,event_date,start_time,end_time,guestlist_open,active,venue_id,venues(name),guest_registrations(status)')
    .order('event_date', { ascending: show === 'upcoming' })
    .limit(120)
  eq = show === 'upcoming' ? eq.gte('event_date', today) : eq.lt('event_date', today)
  if (venue) eq = eq.eq('venue_id', venue)
  if (isVM) eq = eq.in('venue_id', s.venueIds.length ? s.venueIds : ['00000000-0000-0000-0000-000000000000'])
  const { data: events } = await eq

  const tab = (key: string, label: string) => (
    <Link href={`/admin/events?show=${key}${venue ? `&venue=${venue}` : ''}`}
      className={`pill !py-2 !px-3.5 ${show === key ? 'bg-luna-gold/15 text-luna-gold' : 'bg-white/[0.07] text-luna-text/90'}`}>{label}</Link>
  )

  return (
    <AppShell nav={navForRoles(s.roles)} current="/admin/events" title="Events"
      subtitle="One row per night per venue. Open or close its guestlist here — the same control sits on Overview and Guestlists.">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-4 items-start">
        <div className="card">
          <div className="flex flex-wrap items-center gap-2 px-4 pt-4 pb-3">
            {tab('upcoming', 'Upcoming')}{tab('past', 'Past')}
            <form className="ml-auto">
              <input type="hidden" name="show" value={show} />
              <select name="venue" defaultValue={venue} className="input !w-auto !py-2 text-sm">
                <option value="">All venues</option>
                {(venues ?? []).map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
              <button className="btn-ghost !py-2 !px-3 text-xs ml-2">Filter</button>
            </form>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="border-b border-white/[0.07]">
                  <Th>Date</Th><Th>Venue</Th><Th>Event</Th><Th className="text-right">Registered</Th><Th className="text-right">Checked in</Th><Th>Guestlist</Th><Th />
                </tr>
              </thead>
              <tbody>
                {(events ?? []).length === 0 && <EmptyRow colSpan={7}>{show === 'upcoming' ? 'No upcoming events — a night is created automatically when the first guest registers, or add one here.' : 'No past events.'}</EmptyRow>}
                {(events ?? []).map((e: any) => {
                  const regs = (e.guest_registrations ?? []) as { status: string }[]
                  const registered = regs.filter(r => r.status !== 'cancelled').length
                  const checked = regs.filter(r => r.status === 'checked_in').length
                  return (
                    <tr key={e.id} className="border-b border-white/[0.045] last:border-0 hover:bg-white/[0.02]">
                      <Td className="font-semibold whitespace-nowrap">{fmtDate(e.event_date)}</Td>
                      <Td><span className="pill bg-white/[0.07] text-luna-text/90 font-medium">{e.venues?.name}</span></Td>
                      <Td>
                        <div className="font-semibold">{e.name}</div>
                        <div className="text-xs text-luna-muted">{e.start_time ? `${fmtTime(e.start_time)}${e.end_time ? `–${fmtTime(e.end_time)}` : ''}` : '—'}</div>
                      </Td>
                      <Td className="text-right tabular-nums">{registered}</Td>
                      <Td className="text-right tabular-nums text-luna-gold font-semibold">{checked}</Td>
                      <Td><GuestlistToggle id={e.id} open={e.guestlist_open} /></Td>
                      <Td className="text-right"><Link href={`/admin/guestlists?venue=${e.venue_id}&date=${e.event_date}`} className="btn-ghost !py-1.5 !px-3 text-xs">Guestlist</Link></Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <form action={createEvent} className="card p-5 space-y-3">
          <h2 className="font-bold">Create event</h2>
          <div><label className="label">Venue</label>
            <select name="venue_id" required className="input !py-2.5">
              {(venues ?? []).map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select></div>
          <div><label className="label">Event name</label><input name="name" required className="input !py-2.5" placeholder="e.g. Saturday · Bowdy" /></div>
          <div><label className="label">Date</label><input name="event_date" type="date" required className="input !py-2.5" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Start</label><input name="start_time" type="time" className="input !py-2.5" /></div>
            <div><label className="label">End</label><input name="end_time" type="time" className="input !py-2.5" /></div>
          </div>
          <div><label className="label">Description</label><textarea name="description" className="input !py-2.5" rows={2} placeholder="Shown on the sign-up form" /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="guestlist_open" defaultChecked className="accent-luna-gold" /> Open guestlist</label>
          <button className="btn-gold w-full">Create event</button>
        </form>
      </div>
    </AppShell>
  )
}
