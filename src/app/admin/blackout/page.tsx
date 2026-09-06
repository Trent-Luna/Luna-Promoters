import { getSession, hasRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/AppShell'
import { navForRoles } from '@/components/nav'
import { fmtDate } from '@/lib/format'
import { addBlackout } from '../actions'
import { RemoveBlackout } from './ui'
import { Th, Td, EmptyRow } from '@/components/ui'

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
    <AppShell nav={navForRoles(s.roles)} current="/admin/blackout" title="Blackout dates"
      subtitle="Nights the guestlist is closed — ticketed or private events. Guests see it on the sign-up form; promoters on What's On.">
      <div className="grid lg:grid-cols-[340px_minmax(0,1fr)] gap-4 items-start">
        <form action={addBlackout} className="card p-5 space-y-3">
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

        <div className="card overflow-x-auto">
          <table className="w-full text-sm min-w-[480px]">
            <thead><tr className="border-b border-white/[0.07]"><Th className="pt-3">Date</Th><Th className="pt-3">Venue</Th><Th className="pt-3">Reason</Th><Th className="pt-3" /></tr></thead>
            <tbody>
              {(blackouts ?? []).length === 0 && <EmptyRow colSpan={4}>No upcoming blackout dates.</EmptyRow>}
              {(blackouts ?? []).map((b: any) => (
                <tr key={b.id} className="border-b border-white/[0.045] last:border-0 hover:bg-white/[0.02]">
                  <Td className="font-semibold whitespace-nowrap">{fmtDate(b.blackout_date)}</Td>
                  <Td><span className="pill bg-white/[0.07] text-luna-text/90 font-medium">{b.venue_id ? (b.venues?.name ?? 'Venue') : 'All venues'}</span></Td>
                  <Td className="text-luna-muted">{b.reason || '—'}</Td>
                  <Td className="text-right"><RemoveBlackout id={b.id} /></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  )
}
