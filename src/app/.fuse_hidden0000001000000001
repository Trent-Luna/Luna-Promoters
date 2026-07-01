import { createClient } from '@/lib/supabase/server'
import { Logo } from '@/components/Logo'
import { PromoterSignupForm } from './signup-form'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: venues } = await supabase
    .from('venues').select('id,name').eq('active', true).order('name')

  return (
    <main className="min-h-screen">
      <header className="max-w-2xl mx-auto px-5 pt-8 flex items-center justify-between">
        <Logo size={34} />
        <Link href="/login" className="text-sm text-luna-muted hover:text-luna-gold">Login</Link>
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
          <PromoterSignupForm venues={venues ?? []} />
        </div>
      </section>
    </main>
  )
}
