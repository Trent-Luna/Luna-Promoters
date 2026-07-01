'use client'
import { useTransition } from 'react'
import { toggleGuestlist } from '../actions'
export function GuestlistToggle({ id, open }: { id: string; open: boolean }) {
  const [p, start] = useTransition()
  return (
    <button disabled={p} onClick={() => start(() => toggleGuestlist(id, !open))}
      className={`pill border ${open ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40' : 'bg-luna-surface text-luna-muted border-luna-border'}`}>
      {open ? 'Guestlist open' : 'Guestlist closed'}
    </button>
  )
}
