import { headers } from 'next/headers'
import { Logo } from '@/components/Logo'
import { PromoterSignupForm } from './signup-form'
import { GuestlistContent } from './guestlist-content'
import { MembershipLanding } from './memberships/landing'
import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/server'
import { promoterNightFor } from '@/lib/promoter-nights'
import { NightApply } from '@/components/NightApply'

export const dynamic = 'force-dynamic'

export default async function HomePage({ searchParams }: { searchParams: Promise<{ ref?: string; v?: string }> }) {
  const host = (await headers()).get('host') || ''
  const { ref, v } = await searchParams
  if (host.split(':')[0].startsWith('guestlist.')) {
    return <GuestlistContent />
  }
  // memberships.lunagroup.com.au → membership picker. promoter.* stays unchanged.
  if (host.split(':')[0].startsWith('memberships.')) {
    return <MembershipLanding />
  }

  // A promoter-run night recruiting its own promoters (?v=sonda). The venue id
  // is looked up with the service client because venues are not readable
  // signed out; the slug comes only from the PROMOTER_NIGHTS allow-list, and
  // nothing but the id leaves this function.
  const night = promoterNightFor(v)
  let nightVenueId: string | null = null
  if (night && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const { data } = await createServiceClient().from('venues').select('id').eq('slug', night.slug).maybeSingle()
      nightVenueId = (data as { id?: string } | null)?.id ?? null
    } catch {
      nightVenueId = null
    }
  }

  if (night) {
    return <NightApply night={night} refCode={ref ?? ''} venueId={nightVenueId} />
  }

  return (
    <main className="min-h-screen">
      <header className="max-w-2xl mx-auto px-5 pt-8 flex items-center justify-between">
        <Logo size={34} />
        <Link href="/login" className="text-sm text-luna-muted hover:text-white">Login</Link>
      </header>

      <section className="max-w-2xl mx-auto px-5 pt-10 pb-6 text-center">
        <span className="pill bg-luna-gold/10 text-luna-gold mb-4">Now accepting applications</span>
        <h1 className="text-4xl font-extrabold tracking-tight">Become a Luna Group promoter</h1>
        <p className="text-luna-muted mt-3 max-w-md mx-auto">
          Bring the crowd to Eclipse, Eclipse AfterDark, Su Casa Brisbane and Pump Nightclub.
          Climb the leaderboard, unlock tiers and earn real rewards.
        </p>
      </section>

      <section className="max-w-2xl mx-auto px-5 pb-16">
        <div className="card p-6 sm:p-8">
          <h2 className="text-lg font-bold mb-1">Promoter application</h2>
          <p className="text-sm text-luna-muted mb-6">
            Applications are reviewed by the Luna Group team. You must be 18 or older.
          </p>
          <PromoterSignupForm refCode={ref ?? ''} />
        </div>
      </section>
    </main>
  )
}
