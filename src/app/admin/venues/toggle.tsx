'use client'
import { useTransition } from 'react'
import { toggleVenue } from '../actions'
export function VenueToggle({ id, active }: { id: string; active: boolean }) {
  const [p, start] = useTransition()
  return (
    <button disabled={p} onClick={() => start(() => toggleVenue(id, !active))}
      className={`pill border ${active ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40' : 'bg-luna-surface text-luna-muted border-luna-border'}`}>
      {active ? 'Active' : 'Disabled'}
    </button>
  )
}
