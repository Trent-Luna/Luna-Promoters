import type { CSSProperties } from 'react'
import type { Metadata } from 'next'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { GuestRegistrationForm } from '@/app/p/[code]/guest-form'
import { OCCASIONS, GROUP_PIXEL, SU_CASA_PIXEL, sourceFor, tileFor, onOccasionPages, type OccasionKey } from '@/lib/occasion'
import { RESERVATIONS_URL } from '@/lib/occasion-packages'

/**
 * A birthday / hens / bucks landing page for Meta ads (24 Oct 2026). See
 * lib/occasion.ts for why it exists and what it promises.
 *
 * The frame (hero, the deal, how it works, the booth) is new; the form inside
 * it is the guest list form every link uses, with the occasion fixed and the
 * venues shown as photo tiles. Nothing about how a guest is registered,
 * checked, emailed or let in changes.
 */

const FONTS = 'https://fonts.googleapis.com/css2?family=Anton&family=Playfair+Display:ital,wght@1,700&display=swap'

export function occasionMetadata(key: OccasionKey): Metadata {
  const o = OCCASIONS[key]
  return {
    title: o.metaTitle,
    description: o.metaDescription,
    openGraph: { title: o.metaTitle, description: o.metaDescription, images: [{ url: o.hero }] },
  }
}

export async function OccasionPage({
  occasion, searchParams,
}: {
  occasion: OccasionKey
  searchParams: { src?: string; fbclid?: string; utm_source?: string }
}) {
  const o = OCCASIONS[occasion]
  const supabase = await createClient()
  const { data } = await supabase.rpc('get_promoter_link', { p_code: 'luna' })
  const venues = ((data?.venues ?? []) as { id: string; name: string; trading_days?: number[] | null; guestlist_until?: string | null }[])
    .filter(v => onOccasionPages(v.name))
  const blackouts = (data?.blackouts ?? []) as { venue_id: string | null; date: string }[]
  const tiles = Object.fromEntries(venues.map(v => [v.id, tileFor(v.name)]))

  const source = sourceFor(occasion, searchParams)
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    // Counted like a promoter link's poster visit. Fire-and-forget: a visit
    // count must never slow or break the sign-up.
    createServiceClient().rpc('record_source_visit', { p_code: 'luna', p_key: source }).then(() => {}, () => {})
  }

  const vars = { '--acc': o.accent, '--accInk': o.accentInk } as CSSProperties
  const head = "'Anton', Impact, 'Arial Narrow', sans-serif"
  const serif = "'Playfair Display', Georgia, serif"

  return (
    <main className="occ min-h-screen bg-[#07060C]" style={vars}>
      <link rel="stylesheet" href={FONTS} />
      <style>{`
        .occ .card{background:#0F0D17;border-color:#262236}
        .occ .input{background:#07060C;border-color:#2E2A40}
        .occ .input:focus{border-color:var(--acc)}
        .occ .text-luna-goldsoft,.occ .text-luna-gold{color:var(--acc)}
        .occ .accent-luna-gold{accent-color:var(--acc)}
        .occ .btn-gold{background:var(--acc);color:var(--accInk)}
        .occ .btn-gold:hover{background:var(--acc);filter:brightness(1.07)}
        .occ .occ-tile{background:#15131F;color:#F4F2FF}
        .occ .occ-tile-on{border-color:var(--acc)}
      `}</style>

      <div className="mx-auto max-w-[1180px] px-[18px] pt-[18px] pb-10">
        <header className="flex items-center justify-between gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/luna-group-white.png" alt="Luna Group" className="h-7 w-auto" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[#A5A0BD]">Brisbane · Gold Coast</span>
        </header>

        <div className="mt-[18px] flex flex-wrap items-start gap-[22px]">
          <section className="min-w-0 flex-[1_1_460px]">
            <div className="relative overflow-hidden rounded-[22px] bg-[#0B0A12]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={o.hero} alt="" className="block h-[300px] w-full object-cover brightness-[0.62]" />
              <div className="absolute inset-x-0 bottom-0 px-5 pb-5 pt-6"
                style={{ background: 'linear-gradient(180deg, rgba(7,6,12,0) 0%, rgba(7,6,12,.92) 70%)' }}>
                <span className="inline-block rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.25em]"
                  style={{ borderColor: o.accent, color: o.accent }}>{o.kicker}</span>
                <h1 className="mt-3.5 text-[58px] uppercase leading-[0.95] text-white" style={{ fontFamily: head, fontWeight: 400 }}>{o.h1}</h1>
                <div className="mt-1 text-[34px] italic leading-tight" style={{ fontFamily: serif, fontWeight: 700, color: o.accent }}>{o.h1b}</div>
              </div>
            </div>

            <p className="mx-0.5 mt-[18px] text-[15.5px] leading-relaxed text-[#E1DEEE]">{o.intro}</p>

            {/* The deal, as a ticket. Same words as the confirmation email. */}
            <div className="relative mt-[18px] flex overflow-hidden rounded-2xl text-[#15131F]" style={{ background: o.ticket }}>
              <div className="flex flex-[0_0_32%] flex-col items-center justify-center border-r-2 border-dashed border-[#15131F]/45 px-2 py-[18px] text-center">
                <div className="text-[50px] leading-none" style={{ fontFamily: head }}>5+</div>
                <div className="mt-1.5 text-[9.5px] font-bold uppercase tracking-[0.18em]">Your crew</div>
              </div>
              <div className="flex flex-1 flex-col justify-center py-4 pl-[18px] pr-4">
                <div className="text-[9.5px] font-bold uppercase tracking-[0.25em] text-[#3A2E14]">The deal</div>
                <div className="mt-1 text-[21px] italic leading-tight" style={{ fontFamily: serif, fontWeight: 700 }}>Free entry before 10:30pm</div>
                <div className="mt-1.5 text-[12.5px] leading-snug text-[#2A2110]">Plus an all-night VIP wristband for {o.honour}.</div>
              </div>
              <span aria-hidden className="absolute -top-3 left-[calc(32%-12px)] h-6 w-6 rounded-full bg-[#07060C]" />
              <span aria-hidden className="absolute -bottom-3 left-[calc(32%-12px)] h-6 w-6 rounded-full bg-[#07060C]" />
            </div>
          </section>

          <section id="signup" className="card min-w-0 flex-[1_1_380px] !rounded-[22px] px-[18px] pb-[22px] pt-5">
            <h2 className="text-[28px] uppercase leading-tight text-white" style={{ fontFamily: head, fontWeight: 400 }}>{o.formTitle}</h2>
            <p className="mb-4 mt-1.5 text-[13px] text-[#A5A0BD]">Takes 30 seconds · no payment needed</p>
            {venues.length === 0 ? (
              <p className="py-8 text-center text-luna-muted">The guest list isn&apos;t available right now. Please check back soon!</p>
            ) : (
              <GuestRegistrationForm
                promoterCode="luna"
                venues={venues}
                blackouts={blackouts}
                showOccasion={false}
                occasionHint={o.hint}
                source={source}
                venueTiles={tiles}
                // Not one venue, so Su Casa loads with the page. Group stays an extra.
                extraPixels={[GROUP_PIXEL, SU_CASA_PIXEL]}
                ctaLabel={o.cta}
                crew={{ honoreeLabel: o.honoreeLabel }}
              />
            )}
          </section>
        </div>

        <section className="mt-[30px]">
          <div className="text-[11px] font-bold uppercase tracking-[0.25em]" style={{ color: o.accent }}>How it works</div>
          <ol className="mt-3 grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
            {[
              ['01', 'Sign up here', 'Pick your club and the night. You’ll get your QR pass straight away.'],
              ['02', 'Send the crew your link', 'You’ll get a personal link. Everyone who signs up through it joins your list with their own QR. Five or more of you, arriving before 10:30pm.'],
              ['03', 'Show your QR at the door', o.step3],
            ].map(([n, t, d]) => (
              <li key={n} className="rounded-2xl border border-[#262236] bg-[#0F0D17] p-4">
                <div className="text-[26px]" style={{ fontFamily: head, color: o.accent }}>{n}</div>
                <div className="mt-1.5 text-[15px] font-bold text-white">{t}</div>
                <div className="mt-1 text-[13px] leading-normal text-[#A5A0BD]">{d}</div>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-[22px] flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#262236] bg-[#15131F] px-[18px] py-4">
          <div className="min-w-0 flex-[1_1_220px]">
            <div className="text-[15px] font-bold text-white">{o.boothTitle}</div>
            <div className="mt-0.5 text-[13px] leading-normal text-[#A5A0BD]">A VIP booth with bottle service for the whole group.</div>
          </div>
          <a href={RESERVATIONS_URL} className="inline-flex min-h-[44px] items-center rounded-xl border-2 border-[#A78BFA] px-4 text-[13px] font-bold text-[#C4B5FD] hover:text-white">
            Book a VIP booth
          </a>
        </section>

        <p className="mt-[26px] text-[11px] leading-[1.75] text-[#8C88A3]">
          The deal: free entry for a group of five or more arriving before 10:30pm, plus a complimentary all-night VIP
          wristband for {o.honour === 'you' ? 'the birthday person' : o.honour}, within two weeks of the celebration. Guest list
          entry is subject to availability, venue capacity, dress code, valid 18+ photo ID and management discretion.
        </p>
      </div>
    </main>
  )
}
