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
        <div className="space-y-4 min-w-0">
          {/* Everything below is min-w-0 on purpose: the link is one unbreakable
              string, and without it the card pushes past the right edge of a phone. */}
          <div className="card p-5 sm:p-6 min-w-0 flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-8">
            <div className="shrink-0 flex flex-col items-center gap-2">
              <QRCode value={link} size={168} />
              <p className="text-[11px] text-luna-muted">Scan to join your list</p>
            </div>
            <div className="w-full min-w-0 flex flex-col gap-4">
              <div className="eyebrow">Your link</div>
              <div className="min-w-0"><CopyLink link={link} /></div>
              <div className="flex flex-wrap items-center gap-3">
                <SaveQR qrValue={link} title={data.full_name ?? 'Luna Group'} lines={[`Guestlist · /p/${code}`]} fileName="luna-guestlist-qr.png" label="Save QR" />
                <a href="/promoter-guide.pdf" target="_blank" rel="noopener noreferrer" className="text-xs text-luna-gold hover:text-luna-goldsoft">Promoter Guide (PDF) →</a>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <Stat label="Registered (mo)" value={data.registered_month ?? 0} />
            <Stat label="Checked in (mo)" value={data.checked_in_month ?? 0} accent />
            <Stat label="Attendance (mo)" value={`${pct(data.checked_in_month ?? 0, data.registered_month ?? 0)}%`} />
            <Stat label="Checked in (all time)" value={data.checked_in_total ?? 0} />
          </div>
        </div>
      )}
    </AppShell>
  )
}
