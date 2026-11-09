import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Crest, Arrow } from '@/components/offcampus/Crest'
import { loadPublicInfo, loadBoard } from '@/lib/offcampus/data'
import { dayLabel, windowLabel } from '@/lib/offcampus/logic'
import { Results } from './results'

export const dynamic = 'force-dynamic'

const ADDRESS = '648 Ann Street, Fortitude Valley'

const FAQS: [string, string][] = [
  ['What counts towards the board?',
    'Only arrivals scanned by our door staff, once per person per Thursday, even if you arrive after midnight. Registering on its own doesn’t count.'],
  ['Do I have to be in a club?',
    'Pick your uni and your club or society when you register. If yours isn’t listed, add it and we’ll check it. Not in one? You still count for your uni.'],
  ['Can I change clubs?',
    'Yes, from your pass, until you’ve been counted for the first time this season. After that, ask us. Nights already counted stay with the club you had then.'],
  ['Is it 18+?', 'Yes. Bring photo ID every Thursday. Your pass doesn’t replace it.'],
]

/**
 * The Off Campus What's On page ("Lunatree"): links, this Thursday, the
 * results and the prizes. Returns 404 while Off Campus is switched off.
 */
export default async function OffCampusHub({ searchParams }: { searchParams: Promise<{ src?: string }> }) {
  const { src } = await searchParams
  const info = await loadPublicInfo()
  if (!info) notFound()
  const board = info.public_board ? await loadBoard('week', 'team') : null
  const next = info.next_night
  const reg = `/offcampus/register${src ? `?src=${encodeURIComponent(src)}` : ''}`

  return (
    <main style={{ maxWidth: 480, margin: '0 auto' }}>
      {/* ── header ── */}
      <header style={{ position: 'relative', overflow: 'hidden' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/email/hero-sucasa.jpg" alt="" aria-hidden="true"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.35 }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(11,8,18,.55) 0%, #0B0812 100%)' }} />
        <div style={{ position: 'relative', padding: '28px 20px 30px' }}>
          <div className="oc-eyebrow" style={{ color: '#F0EDF8', opacity: 0.85 }}>A night at Su Casa</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 18 }}>
            <Crest size={92} />
            <div>
              <h1 className="oc-display" style={{ margin: 0, fontSize: 44, lineHeight: 0.95 }}>OFF<br />CAMPUS</h1>
              <div className="oc-eyebrow" style={{ color: '#A78BFA', marginTop: 8 }}>Thursdays at Su Casa</div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 22 }}>
            <p style={{ margin: 0, fontSize: 17, lineHeight: 1.35, fontWeight: 300 }}>Bring your club. Win the season.</p>
            {next && (
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', background: '#7DD3FC',
                color: '#0B0812', borderRadius: 999, padding: '6px 10px', whiteSpace: 'nowrap' }}>
                {next.week_no === 1 ? 'Launch ' : 'Next '}{dayLabel(next.date)}
              </span>
            )}
          </div>
        </div>
      </header>

      <div style={{ padding: '6px 20px 40px', display: 'flex', flexDirection: 'column', gap: 30 }}>
        {/* ── links ── */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 10 }} aria-label="Off Campus links">
          <Link href={reg} className="oc-btn oc-btn-primary">
            <span>Register your club<small>Free · takes a minute · get your season pass</small></span><Arrow />
          </Link>
          <Link href="/offcampus/pass" className="oc-btn">
            <span>My season pass<small>Show it at the door every Thursday</small></span><Arrow />
          </Link>
          {info.links.booth && (
            <a href={info.links.booth} className="oc-btn"><span>Book a VIP booth<small>Su Casa booth bookings</small></span><Arrow /></a>
          )}
          {info.links.whatsapp && (
            <a href={info.links.whatsapp} className="oc-btn" target="_blank" rel="noopener noreferrer">
              <span>Join the Su Casa WhatsApp<small>Line-ups and results first</small></span><Arrow />
            </a>
          )}
          {info.links.instagram && (
            <a href={info.links.instagram} className="oc-btn" target="_blank" rel="noopener noreferrer"><span>Su Casa on Instagram</span><Arrow /></a>
          )}
        </nav>

        {/* ── this Thursday ── */}
        {next && (
          <section className="oc-card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
              <span className="oc-eyebrow">This Thursday</span>
              <span style={{ fontSize: 13, color: '#B8B0CC' }}>
                {dayLabel(next.date)}{next.week_no === 1 ? ' · Launch night' : next.week_no ? ` · Week ${next.week_no}` : ''}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Space name="SOCIAL STUDY" where="Rooftop" note={next.rooftop_note} colour="#A78BFA" />
              <Space name="NIGHT CLASS" where="Club" note={next.club_note} colour="#7DD3FC" />
            </div>
            {next.lineup && <div style={{ fontSize: 14 }}><span style={{ color: '#B8B0CC' }}>DJs</span> {next.lineup}</div>}
            {next.perk_note && <div style={{ fontSize: 14, color: '#7DD3FC', fontWeight: 700 }}>{next.perk_note}</div>}
            <div style={{ fontSize: 13, color: '#B8B0CC' }}>
              {ADDRESS} · 18+ · ID required<br />
              Arrivals count {windowLabel(next.opens_at, next.closes_at)}
            </div>
          </section>
        )}

        {/* ── results ── */}
        <Results initial={board} enabled={info.public_board} showPrizes={info.show_prizes}
          firstNight={next?.week_no === 1 ? next.date : null} />

        {/* ── prizes ── */}
        {info.show_prizes && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h2 className="oc-display" style={{ margin: 0, fontSize: 26, lineHeight: 1 }}>WHAT YOU CAN WIN</h2>
            <Prize eyebrow="Every 12 weeks" title="$5,000" body="Season celebration for the club with the most Thursday arrivals." primary />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Prize eyebrow="Every week" title="VIP BOOTH" body="For the week’s top club." />
              <Prize eyebrow="Members" title="UNI PERKS" body="Unlocked when you sign up." />
            </div>
            <div style={{ border: '1.5px dashed #7DD3FC', borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <span className="oc-display" style={{ fontSize: 26, color: '#7DD3FC', whiteSpace: 'nowrap' }}>FREE PIZZA</span>
              <span style={{ fontSize: 13, lineHeight: 1.4 }}>Every Thursday for registered students.</span>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: '#B8B0CC' }}>
              <Link href="/offcampus/terms">T&amp;Cs apply</Link>. Prizes are won on arrivals, never on spending.
            </p>
          </section>
        )}

        {/* ── questions ── */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h2 className="oc-display" style={{ margin: 0, fontSize: 26, lineHeight: 1 }}>QUESTIONS</h2>
          {FAQS.map(([q, a], i) => (
            <details key={q} className="oc-card oc-faq" open={i === 0}>
              <summary style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '16px 16px', fontWeight: 700, fontSize: 15 }}>
                {q}<span className="oc-faq-sign" aria-hidden="true" style={{ color: '#A78BFA', fontSize: 20, lineHeight: 1 }}>+</span>
              </summary>
              <p style={{ margin: 0, padding: '0 16px 16px', fontSize: 14, lineHeight: 1.55, color: '#B8B0CC' }}>{a}</p>
            </details>
          ))}
        </section>

        <footer style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, paddingTop: 6 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/email/logo-sucasa.png" alt="Su Casa Nightclub and Rooftop" style={{ width: 120, height: 'auto' }} />
          <div style={{ fontSize: 12, color: '#B8B0CC' }}>{ADDRESS}</div>
          <div style={{ fontSize: 12, color: '#B8B0CC' }}>
            <Link href="/offcampus/terms">Terms</Link> · <Link href="/offcampus/privacy">Privacy</Link> · Off Campus is run by Su Casa
            Brisbane and is independent of every university.
          </div>
        </footer>
      </div>
    </main>
  )
}

function Space({ name, where, note, colour }: { name: string; where: string; note: string | null; colour: string }) {
  return (
    <div style={{ border: `1px solid ${colour}`, borderRadius: 14, padding: '12px 12px' }}>
      <div className="oc-display" style={{ fontSize: 17, lineHeight: 1.1 }}>{name}</div>
      <div style={{ fontSize: 12, color: '#B8B0CC', marginTop: 4 }}>{where}{note ? ` · ${note}` : ''}</div>
    </div>
  )
}

function Prize({ eyebrow, title, body, primary = false }: { eyebrow: string; title: string; body: string; primary?: boolean }) {
  return (
    <div style={{ background: primary ? '#A78BFA' : '#161022', border: `1px solid ${primary ? '#A78BFA' : '#3A2F52'}`, borderRadius: 14,
      padding: 14, display: 'flex', flexDirection: 'column', gap: 4, color: primary ? '#0B0812' : '#F0EDF8' }}>
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: primary ? '#0B0812' : '#7DD3FC' }}>{eyebrow}</span>
      <span className="oc-display" style={{ fontSize: primary ? 30 : 22, lineHeight: 1, whiteSpace: 'nowrap' }}>{title}</span>
      <span style={{ fontSize: 12.5, lineHeight: 1.4, color: primary ? '#0B0812' : '#B8B0CC' }}>{body}</span>
    </div>
  )
}
