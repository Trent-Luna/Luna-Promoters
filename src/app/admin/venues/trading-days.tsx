'use client'
import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DAY_NAMES, ALL_DAYS } from '@/lib/trading'

/**
 * The nights this venue opens its doors.
 *
 * WHY THIS IS A SCREEN AND NOT A MIGRATION. Trading nights change — a venue
 * picks up a Thursday, drops a Sunday over winter, opens Tuesdays for a
 * residency. Seeded in SQL, this would be right the day it shipped and quietly
 * wrong three months later, which is exactly how 55 guests ended up holding a
 * QR code for a closed door. A manager can fix it here in four seconds.
 *
 * MONDAY-FIRST, because that is how a week reads to a person, even though the
 * values underneath are Postgres `dow` numbers where Sunday is 0.
 *
 * Saves on every tap rather than behind a button: there is nothing to review,
 * and a half-set week left unsaved is worse than one saved a tap early.
 */

const MON_FIRST = [1, 2, 3, 4, 5, 6, 0]

export function TradingDays({ id, days }: { id: string; days: number[] | null | undefined }) {
  const [sel, setSel] = useState<number[]>(days?.length ? [...days] : ALL_DAYS)
  const [note, setNote] = useState<string | null>(null)
  const [pending, start] = useTransition()

  function toggle(d: number) {
    const next = sel.includes(d) ? sel.filter((x) => x !== d) : [...sel, d].sort((a, b) => a - b)
    // A venue open no nights would refuse every registration, which is never
    // what somebody meant by unticking the last one.
    if (!next.length) { setNote('Pick at least one night'); return }
    const before = sel
    setSel(next); setNote(null)
    start(async () => {
      const { data, error } = await createClient().rpc('set_venue_trading_days', {
        p_venue: id, p_days: next,
      })
      if (error || !data?.ok) { setSel(before); setNote(data?.error === 'not_authorised' ? 'Not yours to change' : 'Could not save') }
      else setNote('Saved')
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {MON_FIRST.map((d) => {
        const on = sel.includes(d)
        return (
          <button key={d} type="button" onClick={() => toggle(d)} disabled={pending}
            aria-pressed={on}
            title={on ? `Open ${DAY_NAMES[d]} — tap to close` : `Closed ${DAY_NAMES[d]} — tap to open`}
            className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors disabled:opacity-60 ${
              on ? 'bg-luna-gold/15 text-luna-gold' : 'bg-white/[0.05] text-luna-muted'}`}>
            {DAY_NAMES[d]}
          </button>
        )
      })}
      {note && <span className={`text-[11px] ml-1 ${note === 'Saved' ? 'text-emerald-400' : 'text-amber-400'}`}>{note}</span>}
    </div>
  )
}
