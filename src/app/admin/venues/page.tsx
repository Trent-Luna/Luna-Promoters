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
      subtitle={`${(venues ?? []).length} venue${(venues ?? []).length === 1 ? '' : 's'}`}>
      <div className="grid lg:grid-cols-3 gap-5">
        <form action={createVenue} className="card p-5 space-y-3 h-fit">
          <h2 className="font-bold">Add venue</h2>
          <div><label className="label">Name</label><input name="name" required className="input" /></div>
          <div><label className="label">Slug</label><input name="slug" className="input" placeholder="auto from name" /></div>
          <div><label className="label">Address</label><input name="address" className="input" /></div>
          <button className="btn-gold w-full">Create venue</button>
        </form>
        <div className="lg:col-span-2">
          <div className="card overflow-x-auto">
            <table className="w-full text-sm min-w-[420px]">
              <thead>
                <tr className="border-b border-white/[0.07]">
                  <Th className="pt-3">Venue</Th>
                  <Th className="pt-3 text-right">Active</Th>
                </tr>
              </thead>
              <tbody>
                {(venues ?? []).length === 0 && <EmptyRow colSpan={2}>No venues yet.</EmptyRow>}
                {(venues ?? []).map((v: any) => (
                  <tr key={v.id} className="border-b border-white/[0.045] last:border-0 hover:bg-white/[0.02]">
                    <Td>
                      <CellStack
                        primary={v.name}
                        secondary={`/${v.slug}${v.address ? ` · ${v.address}` : ''}`}
                      />
                    </Td>
                    <Td className="text-right">
                      <span className="inline-flex items-center gap-3">
                        <VenueDelete id={v.id} name={v.name} />
                        <VenueToggle id={v.id} active={v.active} />
                      </span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
