'use client'
import { useState, useTransition } from 'react'
import { deleteVenue } from '../actions'

/**
 * Delete is deliberately awkward: two clicks, and it refuses outright if the
 * venue has any history. Disabling is the right answer almost every time.
 */
export function VenueDelete({ id, name }: { id: string; name: string }) {
  const [pending, start] = useTransition()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')

  function run() {
    setError('')
    start(async () => {
      const res = await deleteVenue(id)
      if (!res.ok) {
        setError(res.error ?? 'Could not delete this venue.')
        setConfirming(false)
      }
    })
  }

  if (error) {
    return (
      <div className="text-right">
        <p className="text-xs text-amber-400 max-w-[22rem] ml-auto">{error}</p>
        <button onClick={() => setError('')} className="text-xs text-luna-muted hover:text-luna-text mt-1">
          Dismiss
        </button>
      </div>
    )
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="text-xs text-luna-muted hover:text-red-400 transition"
        title={`Delete ${name}`}
      >
        Delete
      </button>
    )
  }

  return (
    <span className="inline-flex items-center gap-2">
      <span className="text-xs text-luna-muted">Delete {name}?</span>
      <button disabled={pending} onClick={run}
        className="pill bg-red-600/90 text-white hover:bg-red-600 disabled:opacity-50">
        {pending ? 'Deleting…' : 'Yes, delete'}
      </button>
      <button disabled={pending} onClick={() => setConfirming(false)}
        className="text-xs text-luna-muted hover:text-luna-text">
        Cancel
      </button>
    </span>
  )
}
