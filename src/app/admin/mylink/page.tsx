import { getSession, hasRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/AppShell'
import { navForRoles } from '@/components/nav'
import { QRCode } from '@/components/QRCode'
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
    <AppShell nav={navForRoles(s.roles)} current="/admin/mylink" title="My guestlist link">
      <p className="text-luna-muted text-sm mb-5 max-w-2xl">
        Share your personal link or QR. Anyone who registers through it — or whom you add manually —
        counts toward your numbers below and on the leaderboard.
      </p>

      {error ? (
        <div className="card p-6 space-y-2">
          <p className="font-semibold text-red-400">Couldn&apos;t load your link.</p>
          <p className="text-sm text-luna-muted">
            The database update for this feature may not be applied yet. Ask your admin to run the
            latest Supabase migration (0015), then refresh.
          </p>
          <p className="text-xs text-luna-muted/70">Details: {error.message}</p>
        </div>
      ) : !code ? (
        <div className="card p-6 text-luna-muted">Preparing your link…</div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-5">
          <div className="card p-6 lg:col-span-2">
            <p className="text-xs uppercase tracking-wide text-luna-muted mb-2">Your link</p>
            <CopyLink link={link} />
            <a href="/promoter-guide.pdf" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-xl border border-luna-border bg-luna-surface text-sm text-luna-gold hover:border-luna-gold transition">
              Open the Promoter Guide (PDF) →
            </a>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
              <Stat label="Registered (mo)" value={data.registered_month ?? 0} />
              <Stat label="Checked in (mo)" value={data.checked_in_month ?? 0} accent />
              <Stat label="Attendance (mo)" value={`${pct(data.checked_in_month ?? 0, data.registered_month ?? 0)}%`} />
              <Stat label="Checked in (all time)" value={data.checked_in_total ?? 0} />
            </div>
          </div>
          <div className="card p-6 flex flex-col items-center justify-center">
            <QRCode value={link} size={170} />
            <p className="text-xs text-luna-muted mt-3">Scan to join your list</p>
          </div>
        </div>
      )}
    </AppShell>
  )
}
