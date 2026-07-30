'use client'
import { useMemo, useState } from 'react'
import {
  StatusPill, TierBadge, FilterRow, ResultCount, Th, Td, CellStack, EmptyRow,
} from '@/components/ui'
import { fmtDate } from '@/lib/format'
import { PromoterActions } from './actions-ui'
import { CategorySelect } from './category-ui'

interface P {
  id: string; full_name: string; email: string; mobile: string; date_of_birth: string
  instagram: string | null; suburb: string | null; status: string; promoter_code: string | null
  current_tier: string; elite_override: boolean; category: 'promoter' | 'dj' | 'staff'
  admin_notes: { note: string }[]
}

const STATUSES = [
  { v: '', label: 'All statuses' },
  { v: 'pending', label: 'Pending' },
  { v: 'approved', label: 'Approved' },
  { v: 'suspended', label: 'Suspended' },
  { v: 'rejected', label: 'Rejected' },
]
const CATS = [
  { v: '', label: 'All types' },
  { v: 'promoter', label: 'Promoters' },
  { v: 'dj', label: 'DJs' },
  { v: 'staff', label: 'Staff' },
]

export function PromotersBrowser({ promoters, initialStatus }: { promoters: P[]; initialStatus: string }) {
  const [status, setStatus] = useState(initialStatus)
  const [cat, setCat] = useState('')
  const [q, setQ] = useState('')

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    return promoters.filter(p => {
      if (status && p.status !== status) return false
      if (cat && p.category !== cat) return false
      if (!t) return true
      return (
        p.full_name.toLowerCase().includes(t) ||
        p.email.toLowerCase().includes(t) ||
        p.mobile.toLowerCase().includes(t) ||
        (p.promoter_code ?? '').toLowerCase().includes(t) ||
        (p.suburb ?? '').toLowerCase().includes(t) ||
        (p.instagram ?? '').toLowerCase().includes(t)
      )
    })
  }, [promoters, status, cat, q])

  return (
    <div>
      <FilterRow>
        <input
          className="input flex-1 min-w-[240px] py-2"
          placeholder="Search name, email, phone, code, suburb or Instagram…"
          value={q} onChange={e => setQ(e.target.value)}
        />
        <select className="input w-auto py-2" value={status} onChange={e => setStatus(e.target.value)}>
          {STATUSES.map(s => <option key={s.v} value={s.v}>{s.label}</option>)}
        </select>
        <select className="input w-auto py-2" value={cat} onChange={e => setCat(e.target.value)}>
          {CATS.map(c => <option key={c.v} value={c.v}>{c.label}</option>)}
        </select>
      </FilterRow>

      <ResultCount
        shown={filtered.length}
        total={promoters.length}
        noun={promoters.length === 1 ? 'promoter' : 'promoters'}
      />

      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="border-b border-white/[0.07]">
              <Th className="pt-3">Promoter</Th>
              <Th className="pt-3">Type</Th>
              <Th className="pt-3">Status</Th>
              <Th className="pt-3">Tier</Th>
              <Th className="pt-3">Code</Th>
              <Th className="pt-3">DOB</Th>
              <Th className="pt-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <EmptyRow colSpan={7}>No promoters match those filters.</EmptyRow>
            )}
            {filtered.map(p => {
              const notes = p.admin_notes ?? []
              return (
                <tr key={p.id} className="border-b border-white/[0.045] last:border-0 hover:bg-white/[0.02]">
                  <Td>
                    <CellStack
                      primary={
                        <span className="flex items-center gap-1.5">
                          {p.full_name}
                          {notes.length > 0 && (
                            <span
                              className="text-luna-muted text-xs font-normal"
                              title={notes.map(n => n.note).join('\n')}
                            >
                              📝{notes.length > 1 ? notes.length : ''}
                            </span>
                          )}
                        </span>
                      }
                      secondary={
                        <>
                          {p.email} · {p.mobile}
                          {p.suburb ? ` · ${p.suburb}` : ''}
                          {p.instagram ? ` · ${p.instagram}` : ''}
                        </>
                      }
                    />
                  </Td>
                  <Td><CategorySelect id={p.id} value={p.category} /></Td>
                  <Td><StatusPill status={p.status} /></Td>
                  <Td>
                    {p.status === 'approved'
                      ? <TierBadge tier={p.current_tier} />
                      : <span className="text-luna-muted">—</span>}
                  </Td>
                  <Td>
                    {p.promoter_code
                      ? <code className="text-xs text-luna-subtle">/p/{p.promoter_code}</code>
                      : <span className="text-luna-muted">—</span>}
                  </Td>
                  <Td className="text-luna-muted whitespace-nowrap">{fmtDate(p.date_of_birth)}</Td>
                  <Td className="text-right">
                    <PromoterActions id={p.id} status={p.status} elite={p.elite_override} />
                  </Td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
