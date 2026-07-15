import { Logo } from '@/components/Logo'
import { PromoterSignupForm } from '../signup-form'
import Link from 'next/link'

type Category = 'promoter' | 'dj' | 'staff'

const COPY: Record<Category, { pill: string; title: string; blurb: string; formTitle: string; formNote: string }> = {
  promoter: {
    pill: 'Promoter',
    title: 'Become a Luna Group promoter',
    blurb: 'Bring the crowd to Eclipse, Eclipse AfterDark, Su Casa Brisbane and Pump Nightclub. Climb the leaderboard, unlock tiers and earn real rewards.',
    formTitle: 'Promoter application',
    formNote: 'Applications are reviewed by the Luna Group team. You must be 18 or older.',
  },
  dj: {
    pill: 'DJ',
    title: 'Join Luna Group as a DJ',
    blurb: 'Play across Luna Group venues — Eclipse, Eclipse AfterDark, Su Casa Brisbane and Pump Nightclub. Register your details and the team will be in touch.',
    formTitle: 'DJ application',
    formNote: 'Applications are reviewed by the Luna Group team. You must be 18 or older.',
  },
  staff: {
    pill: 'Luna Group Staff',
    title: 'Luna Group staff sign-up',
    blurb: 'For Luna Group team members. Register your details to get set up in the Luna Group system.',
    formTitle: 'Staff sign-up',
    formNote: 'Your details will be reviewed by the Luna Group team. You must be 18 or older.',
  },
}

/** Shared server layout for the promoter / DJ / staff application flows.
 *  All three use the existing promoter application (category preset). */
export function ApplyLayout({ category, refCode = '' }: { category: Category; refCode?: string }) {
  const c = COPY[category]
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
        <span className="pill bg-white/10 text-white mb-4">{c.pill}</span>
        <h1 className="text-4xl font-extrabold tracking-tight">{c.title}</h1>
        <p className="text-luna-muted mt-3 max-w-md mx-auto">{c.blurb}</p>
      </section>

      <section className="max-w-2xl mx-auto px-5 pb-16">
        <div className="card p-6 sm:p-8">
          <h2 className="text-lg font-bold mb-1">{c.formTitle}</h2>
          <p className="text-sm text-luna-muted mb-6">{c.formNote}</p>
          <PromoterSignupForm refCode={refCode} initialCategory={category} lockCategory />
        </div>
      </section>
    </main>
  )
}
