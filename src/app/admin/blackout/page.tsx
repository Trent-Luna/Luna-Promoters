import { getSession, hasRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/AppShell'
import { navForRoles } from '@/components/nav'
import { fmtDate } from '@/lib/format'
import { addBlackout } from '../actions'
import { RemoveBlackout } from './ui'

export const dynamic = 'force-dynamic'

export default async function BlackoutPage() {
  const s = await getSession()
  if (!s) redirect('/login')
  if (!hasRole(s, 'admin', 'venue_manager')) redirect('/dashboard')
  const isAdmin = s.roles.includes('admin')

  const supabase = await createClient()
  let vq = supabase.from('venues').select('id,name').eq('active', true).order('name')
  if (!isAdmin) vq = vq.in('id', s.venueIds.length ? s.venueIds : ['00000000-0000-0000-0000-000000000000'])
  const today = new Date().toISOString().slice(0, 10)
  const [{ data: venues }, { data: blackouts }] = await Promise.all([
    vq,
    supabase.from('blackout_dates').select('id,blackout_date,reason,venue_id,venues(name)')
      .gte('blackout_date', today).order('blackout_date'),
  ])

  return (
    <AppShell nav={navForRoles(s.roles)} current="/admin/blackout" title="Blackout dates">
      <p className="text-luna-muted text-sm mb-5 max-w-2xl">
        Block guestlist registration on specific dates (e.g. ticketed or private events). Guests trying to
        register for a blacked-out venue and date are told the guestlist isn&apos;t available.
      </p>
      <div className="grid lg:grid-cols-3 gap-5">
        <form action={addBlackout} className="card p-5 space-y-3 h-fit">
          <h2 className="font-bold">Add a blackout</h2>
          <div><label className="label">Venue</label>
            <select name="venue_id" className="input" required>
              {isAdmin && <option value="ALL">All venues</option>}
              {(venues ?? []).map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div><label className="label">Date</label><input name="blackout_date" type="date" required min={today} className="input" /></div>
          <div><label className="label">Reason (optional)</label><input name="reason" className="input" placeholder="e.g. Private event" /></div>
          <button className="btn-gold w-full">Black out date</button>
        </form>

        <div className="lg:col-span-2 space-y-2">
          {(blackouts ?? []).length === 0 && <div className="card p-6 text-center text-luna-muted">No upcoming blackout dates.</div>}
          {(blackouts ?? []).map((b: any) => (
            <div key={b.id} className="card p-4 flex items-center gap-3">
              <div className="flex-1">
                <div className="font-semibold">{fmtDate(b.blackout_date)}</div>
                <div className="text-sm text-luna-muted">
                  {b.venue_id ? (b.venues?.name ?? 'Venue') : 'All venues'}{b.reason ? ` · ${b.reason}` : ''}
                </div>
              </div>
              <RemoveBlackout id={b.id} />
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  )
}
