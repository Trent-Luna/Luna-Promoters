import { createClient } from '@/lib/supabase/server'
import { Logo } from '@/components/Logo'
import { QRCode } from '@/components/QRCode'
import { SaveQR } from '@/components/SaveQR'
import { StatusPill } from '@/components/ui'
import { fmtDate, fmtTime } from '@/lib/format'
import { notFound } from 'next/navigation'
import { CalendarShare } from './actions'
import { GroupInvite, type Member } from './group'

export const dynamic = 'force-dynamic'

export default async function GuestQR({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = await createClient()
  const [{ data: reg }, { data: group }] = await Promise.all([
    supabase.rpc('get_registration_by_token', { p_token: token }),
    supabase.rpc('get_group_members', { p_token: token }),
  ])
  if (!reg) notFound()
  const members = (group ?? []) as Member[]
  const dateLabel = `${fmtDate(reg.event_date)}${reg.start_time ? ` · ${fmtTime(reg.start_time)}` : ''}`
  const upcoming = reg.event_date >= new Date(Date.now() + 10 * 3600_000).toISOString().slice(0, 10)

  const site = process.env.NEXT_PUBLIC_SITE_URL || ''
  const checkInUrl = `${site}/g/${token}`
  const promoterLink = `${site}/p/${reg.promoter_code}`

  return (
    <main className="min-h-screen">
      <header className="max-w-md mx-auto px-5 pt-8"><Logo size={30} /></header>
      <section className="max-w-md mx-auto px-5 pt-6 pb-16">
        <div className="mb-4">
          <div className="eyebrow">Your guestlist pass</div>
          <h1 className="text-2xl font-extrabold leading-tight mt-1">{reg.first_name} {reg.last_name}</h1>
          <p className="text-sm text-luna-subtle mt-1">{reg.venue_name} · {dateLabel} · Guest of {reg.promoter_name}</p>
        </div>
        <div className="card p-6 text-center border-luna-gold/35 shadow-glow">
          <span className="pill bg-emerald-500/15 text-emerald-400 mb-3">You&apos;re on the list</span>

          <div className="flex justify-center my-6">
            <QRCode value={checkInUrl} size={240} />
          </div>

          <div className="mb-5">
            <SaveQR qrValue={checkInUrl}
              title={`${reg.first_name} ${reg.last_name}`}
              lines={[reg.venue_name, `${fmtDate(reg.event_date)}${reg.start_time ? ` · ${fmtTime(reg.start_time)}` : ''}`]}
              fileName="luna-guestlist.png" label="Save QR to photos" />
          </div>

          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="text-sm text-luna-muted">Status</span>
            <StatusPill status={reg.status} />
          </div>
          <p className="text-xs text-luna-muted mb-6">
            This QR is personal to you — save it and show it at the door. One scan, one entry.
          </p>

          <CalendarShare
            title={`${reg.venue_name}`}
            date={reg.event_date} start={reg.start_time} end={reg.end_time}
            promoterLink={promoterLink} qrUrl={checkInUrl}
          />
          <p className="text-[11px] text-luna-muted mt-4">
            No screenshot? No problem — just give your name at the door and we&apos;ll find you.
          </p>
        </div>
        <GroupInvite token={token} members={members} site={site} venue={reg.venue_name} dateLabel={dateLabel} canAdd={upcoming && reg.status !== 'cancelled'} />
        <p className="text-center text-xs text-luna-muted mt-5">
          Everyone needs their own QR. Only checked-in guests count toward rewards.
        </p>
      </section>
    </main>
  )
}
