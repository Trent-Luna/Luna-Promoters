import { createClient } from '@/lib/supabase/server'
import { Logo } from '@/components/Logo'
import { GuestRegistrationForm } from './guest-form'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function PromoterLink({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const supabase = await createClient()

  const { data } = await supabase.rpc('get_promoter_link', { p_code: code })
  if (!data) notFound()

  const promoter = { full_name: data.full_name as string, promoter_code: data.promoter_code as string }
  const venues = (data.venues ?? []) as { id: string; name: string }[]

  return (
    <main className="min-h-screen">
      <header className="max-w-lg mx-auto px-5 pt-8"><Logo size={32} /></header>
      <section className="max-w-lg mx-auto px-5 pt-8 pb-4 text-center">
        <span className="pill bg-luna-purple/15 text-luna-goldsoft mb-3">Guestlist</span>
        <h1 className="text-3xl font-extrabold">You&apos;re on {promoter.full_name.split(' ')[0]}&apos;s list</h1>
        <p className="text-luna-muted mt-2">
          Pick your venue and date, add your details, and you&apos;ll get a QR code to show at the door.
        </p>
      </section>
      <section className="max-w-lg mx-auto px-5 pb-16">
        <div className="card p-6">
          {venues.length === 0 ? (
            <p className="text-center text-luna-muted py-8">No venues are available right now. Check back soon!</p>
          ) : (
            <GuestRegistrationForm promoterCode={promoter.promoter_code} venues={venues} />
          )}
        </div>
      </section>
    </main>
  )
}
