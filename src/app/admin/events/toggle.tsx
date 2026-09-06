'use client'
import { useTransition } from 'react'
import { toggleGuestlist } from '../actions'
import { Switch } from '@/components/Switch'

export function GuestlistToggle({ id, open }: { id: string; open: boolean }) {
  const [p, start] = useTransition()
  return (
    <span className="inline-flex items-center gap-2">
      <Switch on={open} disabled={p} onChange={next => start(() => toggleGuestlist(id, next))} label="Guestlist open" />
      <span className="text-xs text-luna-muted">{open ? 'Open' : 'Closed'}</span>
    </span>
  )
}
