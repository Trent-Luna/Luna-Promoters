import { getSession, hasRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/AppShell'
import { navForRoles } from '@/components/nav'
import { fmtDate, fmtTime } from '@/lib/format'
import { createEvent } from '../actions'
import { GuestlistToggle } from './toggle'

export const dynamic = 'force-dynamic'

export default async function AdminEvents() {
  const s = await getSession()
  if (!s) redirect('/login')
  if (!hasRole(s, 'admin', 'venue_manager')) redirect('/dashboard')
  const isVM = !s.roles.includes('admin')

  const supabase = await createClient()
  let vq = supabase.from('venues').select('id,name').eq('active', true).order('name')
  if (isVM) vq = vq.in('id', s.venueIds.length ? s.venueIds : ['00000000-0000-0000-0000-000000000000'])
  const { data: venues } = await vq
  const { data: events } = await supabase.from('events')
    .select('id,name,event_date,start_time,end_time,guestlist_open,active,venues(name)')
    .order('event_date', { ascending: false }).limit(100)

  return (
    <AppShell nav={navForRoles(s.roles)} current="/admin/events" title="Events">
      <div className="grid lg:grid-cols-3 gap-5">
        <form action={createEvent} className="card p-5 lg:col-span-1 space-y-3 h-fit">
          <h2 className="font-bold">Create event</h2>
          <div><label className="label">Event name</label><input name="name" required className="input" /></div>
          <div><label className="label">Venue</label>
            <select name="venue_id" required className="input">
              {(venues ?? []).map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select></div>
          <div><label className="label">Date</label><input name="event_date" type="date" required className="input" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Start</label><input name="start_time" type="time" className="input" /></div>
            <div><label className="label">End</label><input name="end_time" type="time" className="input" /></div>
          </div>
          <div><label className="label">Description</label><textarea name="description" className="input" rows={2} /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="guestlist_open" defaultChecked className="accent-luna-gold" /> Open guestlist</label>
          <button className="btn-gold w-full">Create event</button>
        </form>

        <div className="lg:col-span-2 space-y-3">
          {(events ?? []).length === 0 && <div className="card p-6 text-center text-luna-muted">No events yet.</div>}
          {(events ?? []).map((e: any) => (
            <div key={e.id} className="card p-4 flex items-center gap-3">
              <div className="flex-1">
                <div className="font-semibold">{e.name}</div>
                <div className="text-sm text-luna-muted">{e.venues?.name} · {fmtDate(e.event_date)}{e.start_time ? ` · ${fmtTime(e.start_time)}` : ''}</div>
              </div>
              <GuestlistToggle id={e.id} open={e.guestlist_open} />
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  )
}
