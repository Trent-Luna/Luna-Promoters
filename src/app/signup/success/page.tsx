import { Logo } from '@/components/Logo'
import Link from 'next/link'
import { JoinWhatsApp } from '@/components/JoinWhatsApp'
import { getWhatsappInvite } from '@/lib/whatsapp'
import { promoterNightFor } from '@/lib/promoter-nights'
import { nightFont } from '@/app/night-font'

export const dynamic = 'force-dynamic'

export default async function SignupSuccess({ searchParams }: { searchParams: Promise<{ approved?: string; v?: string }> }) {
  const { approved, v } = await searchParams
  // An applicant who came through a night's page (?v=sonda) stays in its look.
  const night = promoterNightFor(v)
  const team = night ? `${night.name} promoter team` : 'Luna Group promoter team'
  const isApproved = approved === '1'
  // The invite goes here as well as in the welcome email: this is the moment
  // they are actually holding their phone, and it costs one tap.
  const whatsappInvite = isApproved ? await getWhatsappInvite() : null

  return (
    <main className={`min-h-screen flex items-center justify-center p-5 ${night ? `${nightFont.variable} ${night.skin}` : ''}`}>
      <div className="max-w-md w-full text-center">
        <div className="flex justify-center mb-8">
          {night
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={night.wordmark} alt={night.name} className="h-8 w-auto" />
            : <Logo size={38} />}
        </div>
        <div className="card p-8">
          <div className="w-16 h-16 mx-auto rounded-full bg-white/10 flex items-center justify-center mb-5">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={night ? '#EFEEDB' : '#ffffff'} strokeWidth="2.5">
              <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          {isApproved ? (
            <>
              <h1 className="text-2xl font-bold mb-2">You&apos;re approved! 🎉</h1>
              <p className="text-luna-muted">
                Welcome to the {team}. Create your login with the same email
                you just applied with, and you&apos;ll get your unique promoter link and dashboard.
              </p>
              <Link href="/login" className="btn-gold w-full mt-6">Create my login</Link>
              {whatsappInvite && (
                <div className="mt-6 pt-5 border-t border-white/[0.07] text-left">
                  <p className="text-xs uppercase tracking-wide text-luna-muted mb-1">Then do this</p>
                  <p className="text-sm text-luna-muted mb-3">
                    Follow the promoter channel. Guestlist cut-offs, table drops and which rooms
                    need numbers all go out there first — and your number stays private.
                  </p>
                  <JoinWhatsApp href={whatsappInvite} label="Follow the channel" full />
                </div>
              )}
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold mb-2">Application received</h1>
              <p className="text-luna-muted">
                Thanks for applying to become a {night ? `${night.name} promoter` : 'Luna Group promoter'}. Your application is
                <span className="text-white font-medium"> under review</span>. Our team will be in touch,
                and once approved you&apos;ll be able to log in and get your unique promoter link.
              </p>
              <Link href={night ? `/?v=${night.slug}` : '/'} className="btn-ghost w-full mt-6">Back to home</Link>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
