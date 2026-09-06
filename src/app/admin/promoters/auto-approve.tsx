'use client'
import { useState, useTransition } from 'react'
import { setAutoApprove } from '../actions'
import { Switch } from '@/components/Switch'

export function AutoApproveToggle({ initial, compact = false }: { initial: boolean; compact?: boolean }) {
  const [on, setOn] = useState(initial)
  const [pending, start] = useTransition()
  function toggle(next: boolean) {
    setOn(next)
    start(() => setAutoApprove(next).catch(() => setOn(!next)))
  }
  if (compact) {
    return (
      <label className="flex items-center gap-2.5 text-sm text-luna-muted">
        <Switch on={on} onChange={toggle} disabled={pending} label="Auto-approve new promoters" />
        Auto-approve new promoters
      </label>
    )
  }
  return (
    <div className="card p-4 flex items-center justify-between gap-4">
      <div>
        <p className="font-semibold">Auto-approve new promoters</p>
        <p className="text-xs text-luna-muted">
          {on ? 'New sign-ups are approved instantly and get their link right away.'
              : 'New sign-ups go to the pending queue for you to review.'}
        </p>
      </div>
      <Switch on={on} onChange={toggle} disabled={pending} label="Auto-approve new promoters" />
    </div>
  )
}
