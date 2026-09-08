'use client'
import { useState, useTransition } from 'react'
import Link from 'next/link'
import { setNightList } from './actions'
import { Icon } from '@/components/icons'

export interface NightVenue {
  venue_id: string; venue_name: string; event_id: string | null; event_name: string | null
  guestlist_open: boolean; registered: number; checked_in: number; no_entry: number
}

/**
 * One row per venue for a night: who is registered, who is in, whether the
 * list is open — and the two things you do about it: open/close the list and
 * open that venue's guestlist. This is the "guest list per venue" view Trent
 * asked for on the dashboard.
 *
 * It also calls out doors that are not scanning. Over July-September, Pump and
 * both Silk nights scanned nobody at all, and Eclipse had zero scans on 33 of
 * 54 trading nights — the failure is invisible because an unscanned list looks
 * exactly like a quiet night. Promoter tiers are calculated on checked-in
 * guests, so an unscanned door also silently zeroes out everyone who worked it.
 */
export function TonightBoard({ date, venues, canToggle }: { date: string; venues: NightVenue[]; canToggle: boolean }) {
  const [pending, start] = useTransition()
  const [busy, setBusy] = useState<string | null>(null)

  function toggle(v: NightVenue) {
    setBusy(v.venue_id)
    start(async () => {
      try { await setNightList(v.venue_id, date, !v.guestlist_open) } finally { setBusy(null) }
    })
  }

  // registered > 0 and not one scan: the door has not opened the app tonight.
  const notScanning = venues.filter(v => v.registered > 0 && v.checked_in === 0)

  return (
    <div className="card p-5">
      <div className="flex items-end gap-3 mb-3">
        <div>
          <h2 className="font-bold leading-tight">Tonight at the door</h2>
          <p className="text-xs text-luna-muted mt-0.5">Guestlist per venue · live from door check-in</p>
        </div>
        <span className="ml-auto pill bg-emerald-500/15 text-emerald-400"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Live</span>
      </div>

      {notScanning.length > 0 && (
        <div className="mb-3 rounded-xl border border-amber-400/30 bg-amber-400/[0.07] px-3 py-2.5">
          <p className="text-sm font-semibold text-amber-300">
            No one is scanning at {notScanning.map(v => v.venue_name).join(', ')}
          </p>
          <p className="text-xs text-amber-200/70 mt-0.5">
            {notScanning.reduce((n, v) => n + v.registered, 0)} guest{notScanning.reduce((n, v) => n + v.registered, 0) === 1 ? '' : 's'} on
            {' '}{notScanning.length === 1 ? 'that list' : 'those lists'} and not one checked in.
            Unscanned guests count for nothing toward promoter tiers.
          </p>
        </div>
      )}

      <div className="hidden sm:grid grid-cols-[minmax(0,1.4fr)_80px_80px_70px_auto] gap-3 text-xs text-luna-muted pb-1">
        <div>Venue</div><div className="text-right">Registered</div><div className="text-right">Checked in</div><div className="text-right">Rate</div><div />
      </div>

      {venues.length === 0 && <p className="text-sm text-luna-muted py-4">No active venues.</p>}
      {venues.map(v => {
        const rate = v.registered ? Math.round((v.checked_in / v.registered) * 100) : 0
        // Amber under half, red at nothing — the number alone is too quiet to
        // notice on a busy screen.
        const rateTone =
          v.registered === 0 ? 'text-luna-muted'
            : v.checked_in === 0 ? 'text-red-400 font-semibold'
              : rate < 50 ? 'text-amber-400'
                : 'text-luna-muted'
        const listHref = `/admin/guestlists?venue=${v.venue_id}&date=${date}`
        return (
          <div key={v.venue_id}
            className="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1.4fr)_80px_80px_70px_auto] items-center gap-x-3 gap-y-1 py-2.5 border-t border-white/[0.07]">
            <div className="flex items-center gap-2 min-w-0">
              <span className={`w-2 h-2 rounded-full shrink-0 ${v.guestlist_open ? 'bg-emerald-400 shadow-[0_0_0_3px_rgba(52,211,153,0.18)]' : 'bg-luna-muted'}`} />
              <Link href={listHref} className="font-semibold truncate hover:text-luna-gold transition">{v.venue_name}</Link>
              <span className="sm:hidden text-xs text-luna-muted ml-auto whitespace-nowrap">{v.registered} reg · <span className={v.registered > 0 && v.checked_in === 0 ? 'text-red-400 font-semibold' : 'text-luna-gold'}>{v.checked_in}</span> in</span>
            </div>
            <div className="hidden sm:block text-right tabular-nums">{v.registered}</div>
            <div className="hidden sm:block text-right tabular-nums text-luna-gold font-semibold">{v.checked_in}</div>
            <div className={`hidden sm:block text-right tabular-nums ${rateTone}`}>{rate}%</div>
            <div className="flex items-center gap-1.5 justify-end col-span-2 sm:col-span-1">
              <Link href={listHref} className="btn-ghost !py-1.5 !px-3 text-xs" title="Open this venue's guestlist">
                <Icon name="list" size={14} /> List
              </Link>
              {canToggle && (
                <button disabled={pending && busy === v.venue_id} onClick={() => toggle(v)}
                  className={`btn-ghost !py-1.5 !px-3 text-xs ${v.guestlist_open ? '' : '!text-luna-gold !border-luna-gold/40'}`}>
                  {busy === v.venue_id ? '…' : v.guestlist_open ? 'Close list' : 'Open list'}
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
