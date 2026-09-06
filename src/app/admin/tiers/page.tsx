import { getSession, hasRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/AppShell'
import { ADMIN_NAV } from '@/components/AdminNav'
import { TierBadge } from '@/components/ui'
import { updateTier } from '../actions'
import { DormancySettings } from './dormancy'

export const dynamic = 'force-dynamic'

export default async function AdminTiers() {
  const s = await getSession()
  if (!s) redirect('/login')
  if (!hasRole(s, 'admin')) redirect('/dashboard')
  const supabase = await createClient()
  const [{ data: tiers }, { data: settings }] = await Promise.all([
    supabase.from('tiers').select('*').order('sort_order'),
    supabase.from('app_settings').select('dormant_weeks,auto_approve_promoters').eq('id', 1).maybeSingle(),
  ])

  return (
    <AppShell nav={ADMIN_NAV} current="/admin/tiers" title="Tier settings"
      subtitle="Monthly checked-in guests set Bronze, Silver, Gold and Elite. Elite is invite-only — assign it per promoter on the Promoters page.">
      <div className="grid md:grid-cols-2 gap-4">
        {(tiers ?? []).map((t: any) => (
          <form key={t.name} action={updateTier} className="card p-5 space-y-3">
            <input type="hidden" name="name" value={t.name} />
            <div className="flex items-center justify-between">
              <TierBadge tier={t.name} />
              <span className="text-xs text-luna-muted">{t.invite_only ? 'Invite only' : 'Automatic'}</span>
            </div>
            {!t.invite_only && (
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Min guests / month</label>
                  <input name="min_guests" type="number" defaultValue={t.min_guests ?? ''} className="input !py-2.5" /></div>
                <div><label className="label">Max guests / month</label>
                  <input name="max_guests" type="number" defaultValue={t.max_guests ?? ''} className="input !py-2.5" placeholder="∞" /></div>
              </div>
            )}
            <div><label className="label">Perks</label>
              <textarea name="perks" defaultValue={t.perks} rows={2} className="input !py-2.5" /></div>
            <button className="btn-gold !py-2.5 w-full">Save {t.name}</button>
          </form>
        ))}
      </div>
      <div className="mt-4">
        <DormancySettings weeks={settings?.dormant_weeks ?? 8} autoApprove={settings?.auto_approve_promoters ?? false} />
      </div>
    </AppShell>
  )
}
