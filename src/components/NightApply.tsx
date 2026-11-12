import Link from 'next/link'
import { PromoterSignupForm } from '@/app/signup-form'
import { nightFont } from '@/app/night-font'
import type { PromoterNight } from '@/lib/promoter-nights'

/**
 * The promoter application, worn by a promoter-run night (Sonda Sounds at
 * Eclipse). Same form, same RPC, same review queue as the group application;
 * only the look and the words change, and the night is recorded as the
 * applicant's preferred venue.
 */
export function NightApply({
  night, refCode, venueId,
}: { night: PromoterNight; refCode: string; venueId: string | null }) {
  return (
    <main className={`${nightFont.variable} ${night.skin} min-h-screen relative overflow-hidden`}>
      {/* The S mark, large and faint behind the heading. Decorative only. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={night.mark}
        alt=""
        aria-hidden="true"
        className="pointer-events-none select-none absolute left-1/2 -translate-x-1/2 top-[-60px] w-[760px] max-w-none opacity-[0.07]"
      />

      <header className="relative max-w-2xl mx-auto px-5 pt-8 flex items-center justify-between">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={night.wordmark} alt={night.name} className="h-7 w-auto" />
        <Link href="/login" className="sonda-eyebrow hover:text-white">Login</Link>
      </header>

      <section className="relative max-w-2xl mx-auto px-5 pt-16 pb-10 text-center">
        <p className="sonda-eyebrow mb-5">{night.where.replace(/\.$/, '')}</p>
        <h1 className="sonda-display text-[44px] sm:text-[64px]">
          Become a<br />{night.name}<br />promoter
        </h1>
        <p className="mt-6 max-w-md mx-auto text-[17px] leading-relaxed" style={{ color: 'var(--sonda-muted)' }}>
          Get your own guest list link, bring your crew to Eclipse every Friday,
          climb the leaderboard and earn rewards.
        </p>
      </section>

      <section className="relative max-w-2xl mx-auto px-5 pb-6">
        <ul className="grid grid-cols-3 border-y" style={{ borderColor: 'var(--sonda-line)' }}>
          {[
            ['Your link', 'Your own guest list'],
            ['Every Friday', 'Eclipse, the Valley'],
            ['Rewards', 'Climb the tiers'],
          ].map(([a, b], i) => (
            <li
              key={a}
              className={`py-5 px-2 text-center ${i ? 'border-l' : ''}`}
              style={{ borderColor: 'var(--sonda-line)' }}
            >
              <p className="text-[13px] font-extrabold uppercase tracking-[0.08em]" style={{ fontStretch: '125%' }}>{a}</p>
              <p className="text-[13px] mt-1" style={{ color: 'var(--sonda-muted)' }}>{b}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="relative max-w-2xl mx-auto px-5 pt-6 pb-16">
        <div className="card p-6 sm:p-8">
          <h2 className="sonda-display text-[24px] mb-2">Apply</h2>
          <p className="text-sm text-luna-muted mb-6">
            Applications are reviewed by {night.team}. You must be 18 or older.
          </p>
          <PromoterSignupForm
            refCode={refCode}
            lockCategory
            preferredVenue={venueId}
            nightSlug={night.slug}
          />
        </div>
        <p className="sonda-eyebrow text-center mt-10">Sonda Sounds · Eclipse · Luna Group</p>
      </section>
    </main>
  )
}
