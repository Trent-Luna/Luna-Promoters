'use client'
import { useState, useTransition } from 'react'
import { setAutoApprove } from '../actions'

export function AutoApproveToggle({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial)
  const [pending, start] = useTransition()
  function toggle() {
    const next = !on
    setOn(next)
    start(() => setAutoApprove(next).catch(() => setOn(!next)))
  }
  return (
    <div className="card p-4 flex items-center justify-between gap-4 mb-4">
      <div>
        <p className="font-semibold">Auto-approve new promoters</p>
        <p className="text-xs text-luna-muted">
          {on ? 'New sign-ups are approved instantly and get their link right away.'
              : 'New sign-ups go to the pending queue for you to review.'}
        </p>
      </div>
      <button onClick={toggle} disabled={pending}
        className={`relative w-14 h-8 rounded-full transition ${on ? 'bg-white' : 'bg-luna-border'}`}>
        <span className={`absolute top-1 w-6 h-6 rounded-full transition-all ${on ? 'left-7 bg-black' : 'left-1 bg-luna-muted'}`} />
      </button>
    </div>
  )
}
