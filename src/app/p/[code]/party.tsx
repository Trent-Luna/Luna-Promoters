import type { CSSProperties, ReactNode } from 'react'
import { THEME_FONTS_URL, nightParts, rgba, tones, type VenueTheme } from '@/lib/venue-theme'
import { shortTime, type PartyNight } from '@/lib/party'

/**
 * The sign-up page for a party night, in the venue's look (14 Oct 2026, the
 * Su Casa 10K Party). Same form as every guest list link; this is the frame
 * around it: the big kicker, the date and time, and what is on.
 */
export function PartyPage({ night, theme: v, children }: { night: PartyNight; theme: VenueTheme | null; children: ReactNode }) {
  const look = night.party ?? {}
  const n = nightParts(night.event_date)
  const t = v ?? {
    bg: '#0b0b0f', ink: '#f5f2ea', acc: '#c8a04b', accInk: '#0b0b0f', body: 'inherit', head: 'inherit',
    headW: 800, headCase: 'none', headTrack: '0', rad: 12, logo: '', logoW: 0, short: night.venue_name ?? '',
  } as unknown as VenueTheme
  const { panel, line, muted } = tones(t)
  const from = shortTime(night.start_time)
  const vars = {
    '--bg': t.bg, '--ink': t.ink, '--acc': t.acc, '--accInk': t.accInk, '--panel': panel, '--line': line, '--muted': muted,
    '--rad': t.rad >= 999 ? '999px' : `${t.rad}px`,
    background: t.bg, color: t.ink, fontFamily: t.body,
  } as CSSProperties

  return (
    <main className="pp min-h-screen" style={vars}>
      <link rel="stylesheet" href={THEME_FONTS_URL} />
      <style>{`
        .pp .card{background:var(--panel);border-color:var(--line)}
        .pp .input{background:var(--bg);border-color:var(--line);color:var(--ink)}
        .pp .input:focus{border-color:var(--acc)}
        .pp .label,.pp .text-luna-muted{color:var(--muted)}
        .pp .text-luna-goldsoft,.pp .text-luna-gold{color:var(--acc)}
        .pp .accent-luna-gold{accent-color:var(--acc)}
        .pp .btn-gold{background:var(--acc);color:var(--accInk);border-radius:var(--rad);text-transform:uppercase;letter-spacing:.06em}
        .pp .btn-gold:hover{filter:brightness(1.08);background:var(--acc)}
        .pp .pp-k{font-family:${t.head};font-weight:700;line-height:.9;letter-spacing:-.02em;
          background:linear-gradient(180deg,#fff,${t.acc});-webkit-background-clip:text;background-clip:text;color:transparent}
      `}</style>
      <header className="text-center px-5 pt-10 pb-8"
        style={{ background: `radial-gradient(520px 300px at 85% -10%, ${rgba(t.acc, 0.35)}, transparent 60%), radial-gradient(360px 240px at 0% 110%, ${rgba(t.acc, 0.2)}, transparent 60%), ${t.bg}` }}>
        {t.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={t.logo} alt={night.venue_name ?? ''} className="mx-auto" style={{ width: Math.round((t.logoW || 200) * 0.7), maxWidth: '60%', height: 'auto' }} />
        ) : null}
        {look.kicker && <div className="pp-k mt-5" style={{ fontSize: 'clamp(64px, 22vw, 96px)' }}>{look.kicker}</div>}
        <div className="mt-2 text-[13px] font-semibold uppercase" style={{ letterSpacing: '.32em', color: t.acc }}>
          {look.tagline || night.name}
        </div>
        {look.lede && <p className="mt-4 text-lg leading-snug max-w-sm mx-auto">{look.lede}</p>}
        <div className="mt-4 flex flex-wrap justify-center gap-2 text-[13px]" style={{ color: muted }}>
          <span className="rounded-full px-3 py-1" style={{ border: `1px solid ${line}` }}>{n.night}</span>
          {from && <span className="rounded-full px-3 py-1" style={{ border: `1px solid ${line}` }}>From {from}</span>}
          <span className="rounded-full px-3 py-1" style={{ border: `1px solid ${line}` }}>{t.short || night.venue_name}</span>
        </div>
        {look.included && <p className="mt-4 text-sm max-w-sm mx-auto" style={{ color: t.ink }}>{look.included}</p>}
      </header>
      <section className="max-w-lg mx-auto px-5 pb-16">
        <div className="card p-6">{children}</div>
      </section>
    </main>
  )
}
