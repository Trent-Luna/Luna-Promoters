'use client'
import { useMemo, useState } from 'react'
import {
  StatusPill, TierBadge, FilterRow, ResultCount, Th, Td, CellStack, EmptyRow, SelectPill, SearchInput,
} from '@/components/ui'
import { fmtDate, pct } from '@/lib/format'
import { PromoterActions } from './actions-ui'
import { CategorySelect } from './category-ui'

interface P {
  id: string; full_name: string; email: string; mobile: string; date_of_birth: string
  instagram: string | null; suburb: string | null; status: string; promoter_code: string | null
  current_tier: string; elite_override: boolean; category: 'promoter' | 'dj' | 'staff'
  dormant_since: string | null; last_registration_at: string | null; nudged_at: string | null
  month_registered: number; month_checked_in: number
  admin_notes: { note: string }[]
}

const STATUSES = [
  { v: '', label: 'All' },
  { v: 'pending', label: 'Pending' },
  { v: 'approved', label: 'Approved' },
  { v: 'inactive', label: 'Inactive' },
  { v: 'suspended', label: 'Suspended' },
  { v: 'rejected', label: 'Rejected' },
]
const CATS = [
  { v: '', label: 'All' },
  { v: 'promoter', label: 'Promoters' },
  { v: 'dj', label: 'DJs' },
  { v: 'staff', label: 'Staff' },
]
const TIERS = [
  { v: '', label: 'All' },
  { v: 'bronze', label: 'Bronze' }, { v: 'silver', label: 'Silver' }, { v: 'gold', label: 'Gold' }, { v: 'elite', label: 'Elite' },
]
const SORTS = [
  { v: 'checked', label: 'Checked in ↓' },
  { v: 'newest', label: 'Newest' },
  { v: 'name', label: 'Name' },
]

function weeksSince(iso: string | null): number | null {
  if (!iso) return null
  return Math.floor((Date.now() - new Date(iso).getTime()) / (7 * 864e5))
}

export function PromotersBrowser({ promoters, initialStatus, initialQuery = '', dormantWeeks }:
  { promoters: P[]; initialStatus: string; initialQuery?: string; dormantWeeks: number }) {
  const [status, setStatus] = useState(initialStatus)
  const [cat, setCat] = useState('')
  const [tier, setTier] = useState('')
  const [sort, setSort] = useState('checked')
  const [q, setQ] = useState(initialQuery)

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    const rows = promoters.filter(p => {
      const inactive = p.status === 'approved' && !!p.dormant_since
      if (status === 'inactive' && !inactive) return false
      if (status === 'approved' && (p.status !== 'approved' || inactive)) return false
      if (status && status !== 'inactive' && status !== 'approved' && p.status !== status) return false
      if (cat && p.category !== cat) return false
      if (tier && (p.status !== 'approved' || p.current_tier !== tier)) return false
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
    if (sort === 'checked') rows.sort((a, b) => b.month_checked_in - a.month_checked_in || b.month_registered - a.month_registered || a.full_name.localeCompare(b.full_name))
    else if (sort === 'name') rows.sort((a, b) => a.full_name.localeCompare(b.full_name))
    // 'newest' keeps the server order (created_at desc)
    return rows
  }, [promoters, status, cat, tier, sort, q])

  return (
    <div className="mt-4">
      <FilterRow>
        <SearchInput className="flex-1 min-w-[240px] max-w-sm" value={q} onChange={setQ} placeholder="Search name, code, phone, email, suburb or Instagram" />
        <SelectPill label="Type" value={cat} onChange={setCat} options={CATS} />
        <SelectPill label="Status" value={status} onChange={setStatus} options={STATUSES} />
        <SelectPill label="Tier" value={tier} onChange={setTier} options={TIERS} />
        <SelectPill label="Sort" value={sort} onChange={setSort} options={SORTS} />
        <span className="ml-auto"><ResultCount shown={filtered.length} total={promoters.length} noun={promoters.length === 1 ? 'promoter' : 'promoters'} /></span>
      </FilterRow>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="border-b border-white/[0.07]">
              <Th className="pt-3">Promoter · code · phone</Th>
              <Th className="pt-3">Type</Th>
              <Th className="pt-3">Tier</Th>
              <Th className="pt-3">Status</Th>
              <Th className="pt-3 text-right">Checked in (mo)</Th>
              <Th className="pt-3 text-right">Attendance</Th>
              <Th className="pt-3">Last guest</Th>
              <Th className="pt-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <EmptyRow colSpan={8}>No promoters match those filters.</EmptyRow>
            )}
            {filtered.map(p => {
              const notes = p.admin_notes ?? []
              const inactive = p.status === 'approved' && !!p.dormant_since
              const wk = weeksSince(p.last_registration_at)
              return (
                <tr key={p.id} className="border-b border-white/[0.045] last:border-0 hover:bg-white/[0.02]">
                  <Td>
                    <CellStack
                      primary={
                        <span className="flex items-center gap-1.5">
                          {p.full_name}
                          {notes.length > 0 && (
                            <span className="text-luna-muted text-xs font-normal" title={notes.map(n => n.note).join('\n')}>
                              · {notes.length} note{notes.length > 1 ? 's' : ''}
                            </span>
                          )}
                        </span>
                      }
                      secondary={
                        <>
                          {p.promoter_code ? `/p/${p.promoter_code} · ` : ''}{p.mobile} · {p.email}
                          {p.suburb ? ` · ${p.suburb}` : ''}{p.instagram ? ` · ${p.instagram}` : ''}
                          {p.date_of_birth ? ` · DOB ${fmtDate(p.date_of_birth)}` : ''}
                        </>
                      }
                    />
                  </Td>
                  <Td><CategorySelect id={p.id} value={p.category} /></Td>
                  <Td>
                    {p.status === 'approved'
                      ? <TierBadge tier={p.current_tier} />
                      : <span className="text-luna-muted">—</span>}
                  </Td>
                  <Td>
                    {inactive
                      ? <span className="pill bg-zinc-500/20 text-luna-subtle" title={`No registrations in ${dormantWeeks}+ weeks`}>inactive{wk != null ? ` · ${wk} wks` : ''}</span>
                      : <StatusPill status={p.status} />}
                  </Td>
                  <Td className="text-right tabular-nums">{p.status === 'approved' ? p.month_checked_in : <span className="text-luna-muted">—</span>}</Td>
                  <Td className="text-right tabular-nums">{p.status === 'approved' && p.month_registered > 0 ? `${pct(p.month_checked_in, p.month_registered)}%` : <span className="text-luna-muted">—</span>}</Td>
                  <Td className="text-luna-muted whitespace-nowrap">{p.last_registration_at ? fmtDate(p.last_registration_at) : 'Never'}</Td>
                  <Td className="text-right">
                    <PromoterActions id={p.id} status={p.status} elite={p.elite_override} inactive={inactive} nudgedAt={p.nudged_at} hasEmail={!!p.email} />
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
