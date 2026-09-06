import { getSession, hasRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/AppShell'
import { ADMIN_NAV } from '@/components/AdminNav'
import { createVenue } from '../actions'
import { VenueToggle } from './toggle'
import { VenueDelete } from './delete'
import { Th, Td, CellStack, EmptyRow } from '@/components/ui'

export const dynamic = 'force-dynamic'

export default async function AdminVenues() {
  const s = await getSession()
  if (!s) redirect('/login')
  if (!hasRole(s, 'admin')) redirect('/dashboard')
  const supabase = await createClient()
  const { data: venues } = await supabase.from('venues').select('*').order('name')

  return (
    <AppShell nav={ADMIN_NAV} current="/admin/venues" title="Venues"
      subtitle={`${(venues ?? []).length} venue${(venues ?? []).length === 1 ? '' : 's'} · guest sign-up offers the active ones.`}>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-4 items-start">
        <div className="card overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="border-b border-white/[0.07]">
                <Th className="pt-3">Venue</Th>
                <Th className="pt-3">Slug</Th>
                <Th className="pt-3">Atlas</Th>
                <Th className="pt-3">Guestlist</Th>
                <Th className="pt-3" />
              </tr>
            </thead>
            <tbody>
              {(venues ?? []).length === 0 && <EmptyRow colSpan={5}>No venues yet.</EmptyRow>}
              {(venues ?? []).map((v: any) => (
                <tr key={v.id} className="border-b border-white/[0.045] last:border-0 hover:bg-white/[0.02]">
                  <Td><CellStack primary={v.name} secondary={v.address || undefined} /></Td>
                  <Td className="text-luna-muted">/{v.slug}</Td>
                  <Td>{v.atlas_venue_id ? <span className="pill bg-white/[0.07] text-luna-text/90 font-medium">Linked</span> : <span className="pill bg-amber-500/15 text-amber-400">Not linked</span>}</Td>
                  <Td><VenueToggle id={v.id} active={v.active} /></Td>
                  <Td className="text-right"><VenueDelete id={v.id} name={v.name} /></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <form action={createVenue} className="card p-5 space-y-3">
          <h2 className="font-bold">Add venue</h2>
          <div><label className="label">Name</label><input name="name" required className="input !py-2.5" placeholder="Venue name" /></div>
          <div><label className="label">Slug</label><input name="slug" className="input !py-2.5" placeholder="auto from name" /></div>
          <div><label className="label">Address</label><input name="address" className="input !py-2.5" placeholder="Street, suburb" /></div>
          <button className="btn-gold w-full">Create venue</button>
          <p className="text-[11px] text-luna-muted">Link the venue to Atlas from the Atlas venue settings so nightly reports pick up its guestlist.</p>
        </form>
      </div>
    </AppShell>
  )
}
