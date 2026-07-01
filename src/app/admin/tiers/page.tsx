import { getSession, hasRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/AppShell'
import { ADMIN_NAV } from '@/components/AdminNav'
import { TierBadge } from '@/components/ui'
import { updateTier } from '../actions'

export const dynamic = 'force-dynamic'

export default async function AdminTiers() {
  const s = await getSession()
  if (!s) redirect('/login')
  if (!hasRole(s, 'admin')) redirect('/dashboard')
  const supabase = await createClient()
  const { data: tiers } = await supabase.from('tiers').select('*').order('sort_order')

  return (
    <AppShell nav={ADMIN_NAV} current="/admin/tiers" title="Tier settings">
      <p className="text-luna-muted text-sm mb-4">Monthly checked-in guests determine Bronze/Silver/Gold. Elite is invite-only (assign per promoter on the Promoters page).</p>
      <div className="grid md:grid-cols-2 gap-4">
        {(tiers ?? []).map((t: any) => (
          <form key={t.name} action={updateTier} className="card p-5 space-y-3">
            <input type="hidden" name="name" value={t.name} />
            <div className="flex items-center justify-between">
              <TierBadge tier={t.name} />
              {t.invite_only && <span className="text-xs text-luna-muted">Invite only</span>}
            </div>
            {!t.invite_only && (
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Min guests / month</label>
                  <input name="min_guests" type="number" defaultValue={t.min_guests ?? ''} className="input" /></div>
                <div><label className="label">Max guests / month</label>
                  <input name="max_guests" type="number" defaultValue={t.max_guests ?? ''} className="input" placeholder="∞" /></div>
              </div>
            )}
            <div><label className="label">Perks</label>
              <textarea name="perks" defaultValue={t.perks} rows={2} className="input" /></div>
            <button className="btn-gold w-full">Save</button>
          </form>
        ))}
      </div>
    </AppShell>
  )
}
