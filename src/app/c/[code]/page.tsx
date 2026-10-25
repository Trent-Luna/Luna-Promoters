import type { CSSProperties } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OCCASIONS, GROUP_PIXEL } from '@/lib/occasion'
import { crewTitle, isCrewCode, occasionKeyFor, crewProgress } from '@/lib/crew'
import { prettyNight } from '@/lib/trading'
import { cutoffLabel } from '@/lib/guestlist-cutoff'
import { CrewJoinForm } from './join-form'

/**
 * A host's crew link, /c/<code> (25 Oct 2026, migration 0053).
 *
 * The birthday / hens / bucks host sends this to the group. A friend signs up
 * for the host's night and venue (both fixed: that is the point of the link),
 * gets their own QR, and joins the host's list. In the host's colours.
 */
export const dynamic = 'force-dynamic'

type Crew = {
  host_first: string; honoree_name: string | null; occasion: string | null; crew_size: number | null
  venue_id: string; venue_name: string; venue_slug: string; guestlist_until: string | null
  event_date: string; start_time: string | null; joined: number
  state: 'open' | 'past' | 'closed' | 'cancelled' | 'full'
}

async function load(code: string): Promise<Crew | null> {
  if (!isCrewCode(code)) return null
  const supabase = await createClient()
  const { data } = await supabase.rpc('get_crew', { p_code: code.toUpperCase() })
  return (data as Crew | null) ?? null
}

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params
  const c = await load(code)
  if (!c) return { title: 'Luna Group' }
  const o = OCCASIONS[occasionKeyFor(c.occasion) ?? 'birthday']
  const title = `${crewTitle(c)} · ${c.venue_name}`
  const description = `${prettyNight(c.event_date)}. Get on the guest list in 30 seconds and get your own QR.`
  return { title, description, openGraph: { title, description, images: [{ url: o.hero }] } }
}

const FONTS = 'https://fonts.googleapis.com/css2?family=Anton&family=Playfair+Display:ital,wght@1,700&display=swap'

export default async function CrewPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const c = await load(code)
  if (!c) notFound()

  const o = OCCASIONS[occasionKeyFor(c.occasion) ?? 'birthday']
  const title = crewTitle(c)
  const night = prettyNight(c.event_date)
  const until = cutoffLabel(c.guestlist_until)
  const p = crewProgress(c.joined, c.crew_size)
  const vars = { '--acc': o.accent, '--accInk': o.accentInk } as CSSProperties
  const head = "'Anton', Impact, 'Arial Narrow', sans-serif"
  const serif = "'Playfair Display', Georgia, serif"

  const shut: Record<Exclude<Crew['state'], 'open'>, string> = {
    past: `${title} has been and gone. Hope it was a big one.`,
    closed: `The guest list for ${night} has closed${until ? ` (it ran until ${until})` : ''}.`,
    cancelled: 'This crew link is no longer active.',
    full: `${title} is full: ten is the limit for a crew. Ask ${c.host_first} about another way in.`,
  }

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
      `}</style>

      <div className="mx-auto max-w-[560px] px-[18px] pt-[18px] pb-10">
        <header className="flex items-center justify-between gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/luna-group-white.png" alt="Luna Group" className="h-7 w-auto" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[#A5A0BD]">You&apos;re invited</span>
        </header>

        <div className="relative mt-[18px] overflow-hidden rounded-[22px] bg-[#0B0A12]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={o.hero} alt="" className="block h-[240px] w-full object-cover brightness-[0.6]" />
          <div className="absolute inset-x-0 bottom-0 px-5 pb-5 pt-6"
            style={{ background: 'linear-gradient(180deg, rgba(7,6,12,0) 0%, rgba(7,6,12,.92) 70%)' }}>
            <span className="inline-block rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.25em]"
              style={{ borderColor: o.accent, color: o.accent }}>{c.host_first} added you to the crew</span>
            <h1 className="mt-3 text-[46px] uppercase leading-[0.95] text-white" style={{ fontFamily: head, fontWeight: 400 }}>{title}</h1>
            <div className="mt-1 text-[24px] italic leading-tight" style={{ fontFamily: serif, fontWeight: 700, color: o.accent }}>
              {c.venue_name}
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5 text-sm">
          <div className="rounded-2xl border border-[#262236] bg-[#0F0D17] p-3.5">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8C88A3]">The night</div>
            <div className="mt-1 font-bold text-white">{night}</div>
            {until && <div className="mt-0.5 text-[12px]" style={{ color: o.accent }}>Guest list until {until} sharp</div>}
          </div>
          <div className="rounded-2xl border border-[#262236] bg-[#0F0D17] p-3.5">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8C88A3]">The crew</div>
            <div className="mt-1 font-bold text-white">{p.total} on the list</div>
            <div className="mt-0.5 text-[12px] text-[#A5A0BD]">{p.dealMet ? 'The group deal is unlocked' : `${p.toGo} more unlocks the group deal`}</div>
          </div>
        </div>

        <section className="card mt-4 !rounded-[22px] px-[18px] pb-[22px] pt-5">
          {c.state === 'open' ? (
            <>
              <h2 className="text-[26px] uppercase leading-tight text-white" style={{ fontFamily: head, fontWeight: 400 }}>Get on the list</h2>
              <p className="mb-4 mt-1.5 text-[13px] text-[#A5A0BD]">Takes 30 seconds · you get your own QR for the door</p>
              <CrewJoinForm code={code.toUpperCase()} venueName={c.venue_name}
                extraPixels={[GROUP_PIXEL]}
                cta={`Join ${title}`} />
            </>
          ) : (
            <p className="py-6 text-center text-[#E1DEEE]">{shut[c.state]}</p>
          )}
        </section>

        <p className="mt-[22px] text-[11px] leading-[1.75] text-[#8C88A3]">
          Guest list entry is subject to availability, venue capacity, dress code, valid 18+ photo ID and management
          discretion. Everyone shows their own QR at the door{until ? `, before ${until}` : ''}.
        </p>
      </div>
    </main>
  )
}
