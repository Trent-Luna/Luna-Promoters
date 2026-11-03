/* eslint-disable @next/next/no-img-element */
import { UniversitySignupForm } from './signup-form'

export const dynamic = 'force-dynamic'

// University page v2. Liquor licensing: no prices, $ amounts, percentages or
// discounts anywhere in this page's copy. Perks are only revealed after approval.

const ASSETS = '/memberships/university'

type Venue = { name: string; colour: string; src?: string }

// Official logo files, original brand colours. A venue without `src` falls
// back to its name as styled text.
const VENUES: Venue[] = [
  { name: 'Eclipse', colour: '#E7C873', src: `${ASSETS}/eclipse.png` },
  { name: 'Eclipse After Dark', colour: '#D0343A', src: `${ASSETS}/after-dark.png` },
  { name: 'Su Casa', colour: '#A78BFA', src: `${ASSETS}/su-casa.png` },
  { name: 'Pump', colour: '#F4281C', src: `${ASSETS}/pump.png` },
  { name: 'Juju', colour: '#F26822', src: `${ASSETS}/juju.png` },
  { name: 'Ember & Ash', colour: '#A65E3E', src: `${ASSETS}/ember-and-ash.png` },
  { name: 'Night Market', colour: '#C81E3E', src: `${ASSETS}/night-market.png` },
  { name: 'Mamacita', colour: '#F83460', src: `${ASSETS}/mamacita.png` },
]

const STEPS = [
  { t: 'Sign up with your uni ID', d: 'Fill in your details and upload a clear photo of your current student card.' },
  { t: "We verify you're 18+ and a current student", d: "Our team checks your ID, your age and your card's expiry date." },
  { t: 'Get your digital member pass', d: "Once you're approved, your pass lands on your phone with your perks inside." },
]

const HAIRLINE = 'linear-gradient(90deg,#A78BFA,#F4281C,#A65E3E,#F26822,#C81E3E,#F83460)'
const display = 'font-[family-name:var(--uni-display)]'

function LockIcon({ size = 22, stroke = '#fff' }: { size?: number; stroke?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  )
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#E7C873]">{children}</p>
}

function SectionTitle({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <h2 className={`${display} mt-2.5 text-[clamp(28px,6.4vw,46px)] font-extrabold leading-[1.02] tracking-[-0.02em] ${className}`}>
      {children}
    </h2>
  )
}

export default function UniversitySignupPage() {
  return (
    <main
      className="min-h-screen overflow-x-hidden bg-[#07080B] text-white antialiased font-[family-name:var(--uni-body)]"
      style={{
        // Scoped to this page only.
        ['--uni-display' as string]: 'Syne, Manrope, ui-sans-serif, system-ui, sans-serif',
        ['--uni-body' as string]: 'Manrope, ui-sans-serif, system-ui, sans-serif',
      }}
    >
      {/* React hoists this into <head>; fonts fall back to system if unavailable. */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Manrope:wght@400;600;700;800&display=swap"
        precedence="default"
      />

      {/* NAV */}
      <nav className="sticky top-0 z-20 border-b border-white/[0.09] bg-[#07080B]/80 backdrop-blur-md">
        <div className="mx-auto flex h-[60px] max-w-[1180px] items-center justify-between px-5 sm:px-8 lg:h-[68px]">
          <img src={`${ASSETS}/luna-group.png`} alt="Luna Group" className="h-[26px] w-auto object-contain lg:h-[30px]" />
          <a href="#signup"
            className="rounded-full border border-white/15 px-3.5 py-2 text-xs font-bold uppercase tracking-[0.14em] text-white/70 hover:border-[#E7C873] hover:text-[#E7C873]">
            Sign up
          </a>
        </div>
      </nav>

      {/* HERO */}
      <header className="relative isolate overflow-hidden pb-[72px] pt-14 lg:pb-[110px] lg:pt-24">
        <div aria-hidden className="absolute -inset-x-[30%] -top-[20%] -z-10 h-[120%]"
          style={{ background: 'radial-gradient(60% 50% at 70% 20%,rgba(231,200,115,.20),transparent 60%),radial-gradient(45% 40% at 10% 70%,rgba(208,52,58,.22),transparent 65%)' }} />
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
          <p className="text-[13px] font-extrabold uppercase tracking-[0.24em] text-[#E7C873]">Brisbane&apos;s best uni perks</p>
          <h1 className={`${display} mt-[18px] text-[clamp(54px,15.5vw,148px)] font-extrabold leading-[0.9] tracking-[-0.035em]`}>
            Study hard, <span className="text-[#E7C873]">party harder</span>
          </h1>
          <p className="mt-[22px] max-w-[760px] text-[clamp(21px,5.4vw,32px)] font-extrabold leading-[1.2] text-white">
            Find out your perks by signing up.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3.5">
            <a href="#signup"
              className="inline-flex w-full items-center justify-center gap-2.5 rounded-full bg-[#E7C873] px-[34px] py-[18px] text-base font-extrabold tracking-[0.04em] text-[#07080B] shadow-[0_10px_40px_-10px_rgba(231,200,115,.55)] transition hover:-translate-y-0.5 sm:w-auto">
              Sign up
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6}
                strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14M5 12l7 7 7-7" /></svg>
            </a>
            <span className="text-[13px] text-white/45">18+ current university students only</span>
          </div>
        </div>
      </header>
      <div aria-hidden className="h-0.5 opacity-55" style={{ background: HAIRLINE }} />

      {/* PERKS TEASER + VIP */}
      <section className="py-16 lg:py-24">
        <div className="mx-auto grid max-w-[1180px] gap-[18px] px-5 sm:px-8 lg:grid-cols-2 lg:gap-[22px]">
          <article className="relative overflow-hidden rounded-[18px] border border-[#E7C873]/30 bg-gradient-to-b from-[#171A21] to-[#12141A] p-[26px] lg:p-9">
            <div className="grid h-[52px] w-[52px] place-items-center rounded-[14px] border border-[#E7C873]/35 bg-[#E7C873]/[0.12]">
              <LockIcon size={24} stroke="#E7C873" />
            </div>
            <h3 className={`${display} mt-[18px] text-[26px] font-extrabold leading-[1.08] tracking-[-0.01em]`}>
              Member perks unlocked after sign-up
            </h3>
            <p className="mt-2.5 text-white/65">
              Exclusive member perks revealed once you&apos;re approved. Sign up, get verified, and your pass shows you everything.
            </p>
            <div className="mt-[22px] grid grid-cols-3 gap-2.5" aria-hidden>
              {['#E7C873', '#D0343A', '#A78BFA'].map(c => (
                <div key={c} className="relative grid aspect-square place-items-center overflow-hidden rounded-xl border border-white/[0.09] bg-white/[0.03]">
                  <span className="absolute inset-[18%] rounded-[10px] opacity-55 blur-[10px]" style={{ background: c }} />
                  <span className="relative opacity-85"><LockIcon /></span>
                </div>
              ))}
            </div>
          </article>

          <article className="relative overflow-hidden rounded-[18px] border border-[#D0343A]/35 p-[26px] lg:p-9"
            style={{ background: 'radial-gradient(120% 90% at 100% 0%,rgba(208,52,58,.20),transparent 55%),linear-gradient(180deg,#171A21,#12141A)' }}>
            <span className="inline-block rounded-full bg-[#D0343A] px-[11px] py-1.5 text-[11px] font-extrabold uppercase tracking-[0.2em] text-white">
              Organisers only
            </span>
            <h3 className={`${display} mt-[18px] text-[26px] font-extrabold leading-[1.08] tracking-[-0.01em]`}>
              Organising a night for 20+? Organisers can request a VIP booth
            </h3>
            <p className="mt-2.5 text-white/65">
              Bringing the whole cohort, club or society out? Members who organise a group night can put in a booth request.
            </p>
            <ul className="mt-[18px] grid gap-2.5">
              {['For group organisers only', 'Groups of 20 or more', 'Subject to availability'].map(t => (
                <li key={t} className="flex items-start gap-2.5 text-[15px] text-white/85">
                  <span className="mt-2 h-2 w-2 shrink-0 rotate-45 rounded-[2px] bg-[#E7C873]" />{t}
                </li>
              ))}
            </ul>
            <span aria-hidden
              className={`${display} pointer-events-none absolute bottom-3.5 right-[18px] text-[72px] font-extrabold leading-[0.8] text-transparent [-webkit-text-stroke:1.5px_rgba(231,200,115,.55)]`}>
              VIP
            </span>
          </article>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="pb-16 lg:pb-24">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
          <Eyebrow>How it works</Eyebrow>
          <SectionTitle>Three steps to your pass</SectionTitle>
          <ol className="mt-[30px] grid gap-3.5 lg:grid-cols-3 lg:gap-[18px]">
            {STEPS.map((s, i) => (
              <li key={s.t} className="flex items-start gap-[18px] rounded-[18px] border border-white/[0.09] bg-[#0E1015] p-[22px] lg:flex-col lg:p-7">
                {/* Fixed square so the circle never squashes into an oval. */}
                <span className={`${display} grid aspect-square h-12 w-12 shrink-0 place-items-center rounded-full bg-[#E7C873] text-xl font-extrabold text-[#07080B]`}>
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-lg font-extrabold leading-tight">{s.t}</h3>
                  <p className="mt-1 text-[14.5px] text-white/65">{s.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* PASS PREVIEW */}
      <section className="pb-16 lg:pb-24">
        <div className="mx-auto grid max-w-[1180px] items-center gap-[34px] px-5 sm:px-8 lg:grid-cols-[1.1fr_.9fr] lg:gap-[60px]">
          <div>
            <Eyebrow>Digital member pass</Eyebrow>
            <SectionTitle>One pass. On your phone.</SectionTitle>
            <p className="mt-3 max-w-[560px] text-base text-white/65">
              No plastic card to lose. Your pass lives on your phone, and approved members see their perks right there.
              Scan the code to start your application.
            </p>
          </div>
          <div className="relative mx-auto w-full max-w-[360px] overflow-hidden rounded-3xl border border-[#E7C873]/35 p-6 shadow-[0_40px_80px_-30px_rgba(0,0,0,.9)] lg:ml-auto lg:mr-0"
            style={{ background: 'linear-gradient(155deg,#1A1C23 0%,#0D0E12 60%)' }}>
            <div aria-hidden className="absolute -right-[40%] -top-[40%] h-[90%] w-[90%]"
              style={{ background: 'radial-gradient(circle,rgba(231,200,115,.22),transparent 65%)' }} />
            <div className="relative flex items-center justify-between">
              <img src={`${ASSETS}/luna-group.png`} alt="Luna Group" className="h-[22px] w-auto" />
              <span className="rounded-full border border-[#E7C873]/45 px-[9px] py-[5px] text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#E7C873]">
                University
              </span>
            </div>
            <div className={`${display} relative mt-[22px] text-2xl font-extrabold leading-[1.05]`}>University<br />Member Pass</div>
            <div className="relative mt-1 text-xs tracking-[0.04em] text-white/45">Luna Group venues · 18+</div>
            <div className="relative mx-auto mt-[22px] w-[200px] rounded-2xl bg-white p-3.5">
              <img src={`${ASSETS}/qr-university.png`} alt="Scan to sign up" className="aspect-square w-full object-contain" />
            </div>
            <p className="relative mt-3.5 text-center text-[13px] font-extrabold uppercase tracking-[0.18em] text-[#E7C873]">Scan to sign up</p>
            <div aria-hidden className="-mx-6 -mb-6 mt-5 h-[3px] bg-gradient-to-r from-[#E7C873] to-[#D0343A]" />
          </div>
        </div>
      </section>

      {/* VENUES */}
      <section className="pb-16 lg:pb-24">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
          <Eyebrow>The venues</Eyebrow>
          <SectionTitle>Valid across Luna Group venues</SectionTitle>
          <div className="mt-[30px] grid grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-4">
            {VENUES.map(v => (
              <div key={v.name}
                className="relative grid h-24 place-items-center overflow-hidden rounded-[14px] border border-white/[0.09] bg-[#0B0C10] p-[18px] transition-colors hover:border-white/15 lg:h-[124px]">
                {v.src ? (
                  <img src={v.src} alt={v.name} className="h-10 w-full object-contain lg:h-14" />
                ) : (
                  <span role="img" aria-label={v.name}
                    className="text-center text-[18px] font-extrabold uppercase leading-tight tracking-[0.12em] lg:text-[26px]"
                    style={{ color: v.colour }}>
                    {v.name}
                  </span>
                )}
                <span aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 opacity-75" style={{ background: v.colour }} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <div aria-hidden className="h-0.5 opacity-55" style={{ background: HAIRLINE }} />

      {/* FORM */}
      <section id="signup" className="scroll-mt-[70px] py-16 lg:py-24"
        style={{ background: 'radial-gradient(70% 40% at 50% 0%,rgba(231,200,115,.10),transparent 70%)' }}>
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
          <div className="text-center">
            <Eyebrow>Apply now</Eyebrow>
            <SectionTitle>Sign up for University Membership</SectionTitle>
            <p className="mx-auto mt-3 max-w-[560px] text-white/65">Takes about two minutes. Have your student card handy.</p>
          </div>
          <div className="mx-auto mt-[30px] max-w-[720px] rounded-[18px] border border-white/[0.09] bg-gradient-to-b from-[#171A21] to-[#12141A] p-6 sm:p-9">
            <UniversitySignupForm />
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/[0.09] pb-14 pt-11 text-center">
        <img src={`${ASSETS}/luna-group.png`} alt="Luna Group" className="mx-auto h-[34px] w-auto" />
        <div className="mt-3 flex justify-center gap-[18px] text-[12.5px]">
          <a href="/terms" className="text-white/65 hover:text-[#E7C873]">Privacy Policy &amp; Terms</a>
          <a href="#signup" className="text-white/65 hover:text-[#E7C873]">Sign up</a>
        </div>
        <p className="mt-3.5 text-[12.5px] text-white/45">Luna Group · Brisbane · 18+ only.</p>
      </footer>
    </main>
  )
}
