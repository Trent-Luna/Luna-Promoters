import { getSession, hasRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/AppShell'
import { navForRoles } from '@/components/nav'
import { QRCode } from '@/components/QRCode'
import { SaveQR } from '@/components/SaveQR'
import { Stat } from '@/components/ui'
import { CopyLink } from '@/app/promoter/copy-link'
import { pct } from '@/lib/format'
import { SourceLinks } from './sources'

export const dynamic = 'force-dynamic'

export default async function MyLink() {
  const s = await getSession()
  if (!s) redirect('/login')
  if (!hasRole(s, 'admin', 'venue_manager')) redirect('/dashboard')

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_my_link')
  const code = data?.promoter_code as string | undefined
  const site = process.env.NEXT_PUBLIC_SITE_URL || ''
  const link = code ? `${site}/p/${code}` : ''

  const [{ data: me }, { data: house }] = await Promise.all([
    supabase.from('promoters').select('id').eq('user_id', s.userId).maybeSingle(),
    s.roles.includes('admin')
      ? supabase.from('promoters').select('id,promoter_code,full_name').eq('is_house', true).eq('status', 'approved').order('created_at').limit(1).maybeSingle()
      : Promise.resolve({ data: null as any }),
  ])

  return (
    <AppShell nav={navForRoles(s.roles)} current="/admin/mylink" title="My guestlist link"
      subtitle="Share your link or QR. Anyone who registers through it — or whom you add manually — counts toward your numbers and the leaderboard.">
      {error ? (
        <div className="card p-6 space-y-2">
          <p className="font-semibold text-red-400">Couldn&apos;t load your link.</p>
          <p className="text-xs text-luna-muted/70">Details: {error.message}</p>
        </div>
      ) : !code ? (
        <div className="card p-6 text-luna-muted">Preparing your link…</div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Stat label="Registered (mo)" value={data.registered_month ?? 0} />
            <Stat label="Checked in (mo)" value={data.checked_in_month ?? 0} accent />
            <Stat label="Attendance (mo)" value={`${pct(data.checked_in_month ?? 0, data.registered_month ?? 0)}%`} />
            <Stat label="Checked in (all time)" value={data.checked_in_total ?? 0} />
          </div>
          <div className="grid lg:grid-cols-[340px_minmax(0,1fr)] gap-4 items-start">
            <div className="card p-5 flex flex-col items-center gap-4">
              <div className="eyebrow self-start">Your link</div>
              <QRCode value={link} size={168} />
              <div className="w-full min-w-0"><CopyLink link={link} /></div>
              <SaveQR qrValue={link} title={data.full_name ?? 'Luna Group'} lines={[`Guestlist · /p/${code}`]} fileName="luna-guestlist-qr.png" label="Save QR" />
              <a href="/promoter-guide.pdf" target="_blank" rel="noopener noreferrer" className="text-xs text-luna-gold hover:text-luna-goldsoft">Open the Promoter Guide (PDF) →</a>
            </div>
            {me?.id && <SourceLinks promoterId={me.id} code={code} link={link} title="Where your sign-ups come from" />}
          </div>
          {house?.id && house.promoter_code && house.promoter_code !== code && (
            <SourceLinks promoterId={house.id} code={house.promoter_code} link={`${site}/p/${house.promoter_code}`}
              title={`House link · ${house.full_name} (/p/${house.promoter_code})`} />
          )}
        </div>
      )}
    </AppShell>
  )
}
