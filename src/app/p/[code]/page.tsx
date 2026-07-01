import { createClient } from '@/lib/supabase/server'
import { Logo } from '@/components/Logo'
import { GuestRegistrationForm } from './guest-form'
import { fmtDate, fmtTime } from '@/lib/format'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function PromoterLink({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const supabase = await createClient()

  const { data: promoter } = await supabase
    .from('promoters').select('id, full_name, promoter_code, status')
    .eq('promoter_code', code).eq('status', 'approved').maybeSingle()

  if (!promoter) notFound()

  const today = new Date().toISOString().slice(0, 10)
  const { data: events } = await supabase
    .from('events')
    .select('id, name, event_date, start_time, end_time, guestlist_open, venue_id, venues(name)')
    .eq('active', true).eq('guestlist_open', true)
    .gte('event_date', today).order('event_date')

  const list = (events ?? []).map((e: any) => ({
    id: e.id, name: e.name, event_date: e.event_date,
    start_time: e.start_time, end_time: e.end_time,
    venue_id: e.venue_id, venue_name: e.venues?.name ?? '',
  }))

  return (
    <main className="min-h-screen">
      <header className="max-w-lg mx-auto px-5 pt-8"><Logo size={32} /></header>
      <section className="max-w-lg mx-auto px-5 pt-8 pb-4 text-center">
        <span className="pill bg-luna-purple/15 text-luna-goldsoft mb-3">Guestlist</span>
        <h1 className="text-3xl font-extrabold">You're on {promoter.full_name.split(' ')[0]}'s list</h1>
        <p className="text-luna-muted mt-2">
          Register below to secure your spot. You'll get a QR code to show at the door.
        </p>
      </section>
      <section className="max-w-lg mx-auto px-5 pb-16">
        <div className="card p-6">
          {list.length === 0 ? (
            <p className="text-center text-luna-muted py-8">
              No events are open for registration right now. Check back soon!
            </p>
          ) : (
            <GuestRegistrationForm promoterCode={promoter.promoter_code} events={list} />
          )}
        </div>
      </section>
    </main>
  )
}
