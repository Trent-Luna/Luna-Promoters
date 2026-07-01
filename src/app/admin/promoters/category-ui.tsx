'use client'
import { useState, useTransition } from 'react'
import { setPromoterCategory } from '../actions'

const LABEL: Record<string, string> = { promoter: 'Promoter', dj: 'DJ', staff: 'Staff' }

export function CategorySelect({ id, value }: { id: string; value: 'promoter' | 'dj' | 'staff' }) {
  const [cat, setCat] = useState(value)
  const [pending, start] = useTransition()
  return (
    <select value={cat} disabled={pending}
      onChange={e => { const v = e.target.value as any; setCat(v); start(() => setPromoterCategory(id, v).catch(() => setCat(value))) }}
      className="bg-luna-surface border border-luna-border rounded-lg text-xs px-2 py-1 text-luna-text">
      {(['promoter', 'dj', 'staff'] as const).map(c => <option key={c} value={c}>{LABEL[c]}</option>)}
    </select>
  )
}
