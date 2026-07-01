'use client'
import { useTransition } from 'react'
import { removeBlackout } from '../actions'
export function RemoveBlackout({ id }: { id: string }) {
  const [pending, start] = useTransition()
  return (
    <button disabled={pending} onClick={() => { if (confirm('Remove this blackout?')) start(() => removeBlackout(id)) }}
      className="pill bg-luna-surface border border-luna-border text-luna-muted hover:text-red-400 px-3 py-1.5">
      Remove
    </button>
  )
}
