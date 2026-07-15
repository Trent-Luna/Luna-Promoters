import Link from 'next/link'
import { Logo } from '@/components/Logo'

interface Option {
  key: string
  label: string
  blurb: string
  href?: string
  comingSoon?: boolean
  icon: string
}

const OPTIONS: Option[] = [
  { key: 'promoter', label: 'Promoter', icon: '🎤',
    blurb: 'Bring the crowd, climb the leaderboard and unlock tiers and rewards.',
    href: '/memberships/promoter' },
  { key: 'university', label: 'University Member', icon: '🎓',
    blurb: 'Verified uni students get the Luna University Membership pass.',
    href: '/memberships/university' },
  { key: 'dj', label: 'Luna Group DJ', icon: '🎧',
    blurb: 'Sign-up for Luna Group DJs.',
    href: '/memberships/dj' },
  { key: 'staff', label: 'Luna Group Staff', icon: '🪩',
    blurb: 'Team sign-up for Luna Group staff members.',
    href: '/memberships/staff' },
]

/** Public membership picker — shared by the memberships.* home page and /memberships. */
export function MembershipLanding() {
  return (
    <main className="min-h-screen">
      <header className="max-w-2xl mx-auto px-5 pt-8 flex items-center justify-between">
        <Logo size={34} />
        <Link href="/login" className="text-sm text-luna-muted hover:text-white">Login</Link>
      </header>

      <section className="max-w-2xl mx-auto px-5 pt-10 pb-6 text-center">
        <span className="pill bg-white/10 text-white mb-4">Luna Group Memberships</span>
        <h1 className="text-4xl font-extrabold tracking-tight">Choose your membership</h1>
        <p className="text-luna-muted mt-3 max-w-md mx-auto">
          Join the Luna Group community across Eclipse, Eclipse AfterDark, Su Casa Brisbane and Pump Nightclub.
        </p>
      </section>

      <section className="max-w-2xl mx-auto px-5 pb-16">
        <div className="grid sm:grid-cols-2 gap-4">
          {OPTIONS.map(o => {
            const inner = (
              <div className={`card p-6 h-full flex flex-col ${o.comingSoon ? 'opacity-60' : 'hover:border-white transition active:scale-[.99]'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-3xl" aria-hidden>{o.icon}</span>
                  {o.comingSoon
                    ? <span className="pill bg-luna-border text-luna-muted">Coming soon</span>
                    : <span className="pill bg-white/10 text-white">Open →</span>}
                </div>
                <h2 className="text-xl font-bold mt-4">{o.label}</h2>
                <p className="text-sm text-luna-muted mt-1 flex-1">{o.blurb}</p>
              </div>
            )
            return o.comingSoon || !o.href
              ? <div key={o.key} aria-disabled className="cursor-not-allowed">{inner}</div>
              : <Link key={o.key} href={o.href} className="block">{inner}</Link>
          })}
        </div>
        <p className="text-center text-xs text-luna-muted mt-8">
          You must be 18 or older. University membership requires a valid, current student ID.
        </p>
      </section>
    </main>
  )
}
