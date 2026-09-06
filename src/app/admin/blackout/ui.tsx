'use client'
import { useTransition } from 'react'
import { removeBlackout } from '../actions'
export function RemoveBlackout({ id }: { id: string }) {
  const [pending, start] = useTransition()
  return (
    <button disabled={pending} onClick={() => { if (confirm('Remove this blackout?')) start(() => removeBlackout(id)) }}
      className="btn-ghost !py-1.5 !px-3 text-xs !text-luna-muted hover:!text-red-400">
      Remove
    </button>
  )
}
