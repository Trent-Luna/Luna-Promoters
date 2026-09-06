'use client'
import { useTransition } from 'react'
import { toggleVenue } from '../actions'
import { Switch } from '@/components/Switch'

export function VenueToggle({ id, active }: { id: string; active: boolean }) {
  const [p, start] = useTransition()
  return (
    <span className="inline-flex items-center gap-2">
      <Switch on={active} disabled={p} onChange={next => start(() => toggleVenue(id, next))} label="Venue active" />
      <span className="text-xs text-luna-muted w-14 text-left">{active ? 'Active' : 'Off'}</span>
    </span>
  )
}
