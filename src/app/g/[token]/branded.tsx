import type { CSSProperties } from 'react'
import { QRCode } from '@/components/QRCode'
import { SaveQR } from '@/components/SaveQR'
import { StatusPill } from '@/components/ui'
import { fmtDate, fmtTime } from '@/lib/format'
import { cutoffLabel } from '@/lib/guestlist-cutoff'
import { SISTERS, THEME_FONTS_URL, nightParts, rgba, tones, type VenueTheme } from '@/lib/venue-theme'
import { CalendarShare } from './actions'
import { GroupInvite, type Member } from './group'

/**
 * The guest list pass in the venue's own look (8 Oct 2026), matching the
 * branded confirmation email. Same pieces as the plain pass — QR, save to
 * photos, calendar, invite, bringing friends — restyled through CSS variables.
 */
export function BrandedPass({ reg, theme: v, token, members, site, upcoming }: {
  reg: any; theme: VenueTheme; token: string; members: Member[]; site: string; upcoming: boolean
}) {
  const { panel, line, muted } = tones(v)
  const n = nightParts(reg.event_date)
  const until = cutoffLabel(reg.guestlist_until)
  const checkInUrl = `${site}/g/${token}`
  const promoterLink = `${site}/p/${reg.promoter_code}`
  const dateLabel = `${fmtDate(reg.event_date)}${reg.start_time ? ` · ${fmtTime(reg.start_time)}` : ''}`
  const rad = v.rad >= 999 ? '999px' : `${v.rad}px`

  const vars = {
    '--bg': v.bg, '--ink': v.ink, '--acc': v.acc, '--accInk': v.accInk,
    '--panel': panel, '--line': line, '--muted': muted, '--rad': rad,
    '--head': v.head, '--headW': String(v.headW), '--headCase': v.headCase, '--headTrack': v.headTrack,
    '--body': v.body, '--num': v.num, '--numW': String(v.numW),
    background: v.bg, color: v.ink, fontFamily: v.body,
  } as CSSProperties

  const hero: CSSProperties = v.hero
    ? { backgroundImage: `linear-gradient(180deg, ${rgba(v.bg, 0.35)}, ${rgba(v.bg, 0.15)} 40%, ${v.bg}), url('${v.hero}')`, backgroundSize: 'cover', backgroundPosition: v.heroPos || 'center' }
    : { backgroundColor: v.heroColor, backgroundImage: `linear-gradient(180deg, transparent 55%, ${v.bg}), ${v.heroGrad}` }

  return (
    <main className="gp min-h-screen" style={vars}>
      <link rel="stylesheet" href={THEME_FONTS_URL} />
      <style>{`
        .gp .gp-h{font-family:var(--head);font-weight:var(--headW);text-transform:var(--headCase);letter-spacing:var(--headTrack);line-height:1.1}
        .gp .gp-k{font-size:11px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;color:var(--acc)}
        .gp .gp-m,.gp .text-luna-muted,.gp .text-luna-subtle{color:var(--muted)}
        .gp .gp-num{font-family:var(--num);font-weight:var(--numW)}
        .gp .card{background:var(--panel);border-color:var(--line)}
        .gp .input{background:var(--bg);border-color:var(--line);color:var(--ink)}
        .gp .input:focus{border-color:var(--acc)}
        .gp .label{color:var(--muted)}
        .gp .btn-gold{background:var(--acc);color:var(--accInk);border-radius:var(--rad)}
        .gp .btn-gold:hover{filter:brightness(1.08);background:var(--acc)}
        .gp .btn-ghost{background:transparent;border:1px solid var(--line);color:var(--ink);border-radius:var(--rad)}
        .gp .btn-ghost:hover{border-color:var(--acc)}
        .gp .gp-perf{border-top:2px dashed var(--line);margin:0 14px;position:relative}
        .gp .gp-perf:before,.gp .gp-perf:after{content:"";position:absolute;top:-11px;width:20px;height:20px;border-radius:50%;background:var(--bg)}
        .gp .gp-perf:before{left:-25px}.gp .gp-perf:after{right:-25px}
      `}</style>

      <header className="relative h-48 sm:h-56 flex items-end justify-center pb-5" style={hero}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={v.logo} alt={reg.venue_name} style={{ width: Math.round(v.logoW * 0.82), maxWidth: '70%', height: 'auto' }} />
      </header>

      <section className="max-w-md mx-auto px-5 pt-4 pb-16">
        <div className="text-center">
          <div className="gp-k">Your guest list pass</div>
          <h1 className="gp-h mt-2" style={{ fontSize: Math.round(v.h1 * 0.95) }}>{reg.first_name} {reg.last_name}</h1>
          <p className="gp-m text-sm mt-1">{n.night} · Guest of {reg.promoter_name}</p>
          <div className="mt-3"><StatusPill status={reg.status} /></div>
        </div>

        <div className="mt-5 rounded-2xl border overflow-hidden" style={{ background: panel, borderColor: line }}>
          <div className="grid" style={{ gridTemplateColumns: '88px 1fr' }}>
            <div className="flex flex-col items-center justify-center py-4" style={{ borderRight: `1px dashed ${line}` }}>
              <span className="text-xs font-bold tracking-[.2em]" style={{ color: v.acc }}>{n.dow}</span>
              <span className="gp-num text-4xl leading-none my-1">{n.day}</span>
              <span className="gp-m text-xs tracking-[.2em]">{n.mon}</span>
            </div>
            <div className="p-4 min-w-0 flex flex-col justify-center">
              <div className="gp-h text-xl">{v.short}</div>
              <div className="gp-m text-xs mt-1">{dateLabel}</div>
              <div className="text-[11px] font-bold tracking-[.18em] uppercase mt-2">Guest list · Admit 1</div>
            </div>
          </div>
          <div className="gp-perf" />
          <div className="flex justify-center pt-5 pb-3">
            <div className="rounded-xl bg-white p-3"><QRCode value={checkInUrl} size={220} /></div>
          </div>
          <p className="gp-m text-xs text-center px-6 pb-4">One scan, one entry. No signal? Give your name at the door.</p>
          {until ? (
            <div className="px-5 py-3.5" style={{ background: v.acc, color: v.accInk }}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[11px] font-bold tracking-[.2em] uppercase opacity-90">Guest list closes</span>
                <span className="gp-num text-xl uppercase">{until} sharp</span>
              </div>
              <p className="text-xs mt-1 opacity-95">Arrive before {until}. After that the guest list no longer applies.</p>
            </div>
          ) : (
            <div className="px-5 py-3.5" style={{ borderTop: `1px solid ${line}` }}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="gp-m text-[11px] font-bold tracking-[.2em] uppercase">Guest list</span>
                <span className="gp-num uppercase">Arrive early</span>
              </div>
              <p className="gp-m text-xs mt-1">Entry is subject to capacity on the night.</p>
            </div>
          )}
        </div>

        <div className="mt-5">
          <SaveQR qrValue={checkInUrl}
            title={`${reg.first_name} ${reg.last_name}`}
            lines={[reg.venue_name, dateLabel]}
            fileName="luna-guestlist.png" label="Save QR to photos" />
        </div>
        <div className="mt-3">
          <CalendarShare title={`${reg.venue_name}`} date={reg.event_date} start={reg.start_time} end={reg.end_time}
            promoterLink={promoterLink} qrUrl={checkInUrl} />
        </div>

        <GroupInvite token={token} members={members} site={site} venue={reg.venue_name} dateLabel={dateLabel}
          canAdd={upcoming && reg.status !== 'cancelled'} />

        <footer className="mt-10 pt-6 text-center" style={{ borderTop: `1px solid ${line}` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/luna-group-white.png" alt="Luna Group Hospitality" className="mx-auto" style={{ width: 110, height: 'auto' }} />
          <p className="gp-m text-[11px] tracking-[.16em] uppercase mt-3">
            {SISTERS.map((s, i) => (
              <span key={s}>{i > 0 && ' · '}{s === v.short ? <b style={{ color: v.ink }}>{s}</b> : s}</span>
            ))}
          </p>
          <p className="gp-m text-xs mt-3">Everyone needs their own QR. Only checked-in guests count toward rewards.</p>
        </footer>
      </section>
    </main>
  )
}
