import { getSession, hasRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/AppShell'
import { ADMIN_NAV } from '@/components/AdminNav'
import { createVenue } from '../actions'
import { VenueToggle } from './toggle'

export const dynamic = 'force-dynamic'

export default async function AdminVenues() {
  const s = await getSession()
  if (!s) redirect('/login')
  if (!hasRole(s, 'admin')) redirect('/dashboard')
  const supabase = await createClient()
  const { data: venues } = await supabase.from('venues').select('*').order('name')

  return (
    <AppShell nav={ADMIN_NAV} current="/admin/venues" title="Venues">
      <div className="grid lg:grid-cols-3 gap-5">
        <form action={createVenue} className="card p-5 space-y-3 h-fit">
          <h2 className="font-bold">Add venue</h2>
          <div><label className="label">Name</label><input name="name" required className="input" /></div>
          <div><label className="label">Slug</label><input name="slug" className="input" placeholder="auto from name" /></div>
          <div><label className="label">Address</label><input name="address" className="input" /></div>
          <button className="btn-gold w-full">Create venue</button>
        </form>
        <div className="lg:col-span-2 space-y-3">
          {(venues ?? []).map((v: any) => (
            <div key={v.id} className="card p-4 flex items-center gap-3">
              <div className="flex-1"><div className="font-semibold">{v.name}</div>
                <div className="text-sm text-luna-muted">/{v.slug}{v.address ? ` · ${v.address}` : ''}</div></div>
              <VenueToggle id={v.id} active={v.active} />
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  )
}
