import { Logo } from '@/components/Logo'
import { PromoterSignupForm } from '../../signup-form'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

// The Promoter option on the memberships landing opens the EXISTING promoter
// application experience (same component, unchanged behaviour).
export default async function MembershipsPromoter({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const { ref } = await searchParams
  return (
    <main className="min-h-screen">
      <header className="max-w-2xl mx-auto px-5 pt-8 flex items-center justify-between">
        <Logo size={34} />
        <div className="flex items-center gap-4">
          <Link href="/memberships" className="text-sm text-luna-muted hover:text-white">← Memberships</Link>
          <Link href="/login" className="text-sm text-luna-muted hover:text-white">Login</Link>
        </div>
      </header>

      <section className="max-w-2xl mx-auto px-5 pt-10 pb-6 text-center">
        <span className="pill bg-white/10 text-white mb-4">Promoter</span>
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
