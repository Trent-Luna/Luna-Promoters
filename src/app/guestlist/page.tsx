import { createClient } from '@/lib/supabase/server'
import { Logo } from '@/components/Logo'
import { GuestRegistrationForm } from '@/app/p/[code]/guest-form'

export const dynamic = 'force-dynamic'

export default async function PublicGuestlist() {
  const supabase = await createClient()
  const { data } = await supabase.rpc('get_promoter_link', { p_code: 'luna' })

  const venues = (data?.venues ?? []) as { id: string; name: string }[]
  const blackouts = (data?.blackouts ?? []) as { venue_id: string | null; date: string }[]

  return (
    <main className="min-h-screen">
      <header className="max-w-lg mx-auto px-5 pt-8"><Logo size={32} /></header>
      <section className="max-w-lg mx-auto px-5 pt-8 pb-4 text-center">
        <span className="pill bg-luna-purple/15 text-luna-goldsoft mb-3">Guestlist</span>
        <h1 className="text-3xl font-extrabold">Luna Group Guestlist</h1>
        <p className="text-luna-muted mt-2">
          Pick your venue and date, add your details, and you&apos;ll get a QR code to show at the door.
        </p>
      </section>
      <section className="max-w-lg mx-auto px-5 pb-16">
        <div className="card p-6">
          {venues.length === 0 ? (
            <p className="text-center text-luna-muted py-8">
              The guestlist isn&apos;t available right now. Please check back soon!
            </p>
          ) : (
            <GuestRegistrationForm promoterCode="luna" venues={venues} blackouts={blackouts} />
          )}
        </div>
      </section>
    </main>
  )
}
