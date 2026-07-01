import { createClient } from '@/lib/supabase/server'
import { Logo } from '@/components/Logo'
import { QRCode } from '@/components/QRCode'
import { StatusPill } from '@/components/ui'
import { fmtDate, fmtTime } from '@/lib/format'
import { notFound } from 'next/navigation'
import { CalendarShare } from './actions'

export const dynamic = 'force-dynamic'

export default async function GuestQR({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = await createClient()
  const { data: reg } = await supabase.rpc('get_registration_by_token', { p_token: token })
  if (!reg) notFound()

  const site = process.env.NEXT_PUBLIC_SITE_URL || ''
  const checkInUrl = `${site}/g/${token}`
  const promoterLink = `${site}/p/${reg.promoter_code}`

  return (
    <main className="min-h-screen">
      <header className="max-w-md mx-auto px-5 pt-8"><Logo size={30} /></header>
      <section className="max-w-md mx-auto px-5 pt-6 pb-16">
        <div className="card p-7 text-center">
          <span className="pill bg-emerald-500/15 text-emerald-400 mb-3">You&apos;re on the list</span>
          <h1 className="text-2xl font-bold">{reg.first_name} {reg.last_name}</h1>
          <p className="text-luna-muted mt-1">{reg.venue_name}</p>
          <p className="text-sm text-luna-muted">
            {fmtDate(reg.event_date)}{reg.start_time ? ` · ${fmtTime(reg.start_time)}` : ''}
          </p>

          <div className="flex justify-center my-6">
            <QRCode value={checkInUrl} size={240} />
          </div>

          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="text-sm text-luna-muted">Status</span>
            <StatusPill status={reg.status} />
          </div>
          <p className="text-xs text-luna-muted mb-6">
            This QR is personal to you — screenshot it and show it at the door. Guest of {reg.promoter_name}.
          </p>

          <CalendarShare
            title={`${reg.venue_name}`}
            date={reg.event_date} start={reg.start_time} end={reg.end_time}
            promoterLink={promoterLink}
          />
        </div>
        <p className="text-center text-xs text-luna-muted mt-5">
          Everyone needs their own QR — send friends the promoter link so they can register too.
          Only checked-in guests count toward rewards.
        </p>
      </section>
    </main>
  )
}
