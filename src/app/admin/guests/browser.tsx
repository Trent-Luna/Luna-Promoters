'use client'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fmtDate } from '@/lib/format'
import { Th, Td, CellStack, TagList, SearchInput } from '@/components/ui'
import { Icon } from '@/components/icons'

type G = {
  id: string; first_name: string; last_name: string; mobile: string
  email: string | null; instagram: string | null
  registrations: number; attended: number; last_seen: string | null; venues: string[]
}

export function GuestDirectory({ initialQuery = '' }: { initialQuery?: string }) {
  const supabase = useMemo(() => createClient(), [])
  const [rows, setRows] = useState<G[] | null>(null)
  const [q, setQ] = useState(initialQuery)

  useEffect(() => {
    supabase.rpc('get_guest_directory').then(({ data }) => setRows((data ?? []) as G[]))
  }, [supabase])

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    const list = rows ?? []
    if (!t) return list
    return list.filter(g =>
      `${g.first_name} ${g.last_name}`.toLowerCase().includes(t) ||
      (g.mobile ?? '').toLowerCase().includes(t) ||
      (g.email ?? '').toLowerCase().includes(t) ||
      (g.instagram ?? '').toLowerCase().includes(t))
  }, [rows, q])

  function exportCsv() {
    const head = ['First name', 'Last name', 'Mobile', 'Email', 'Instagram', 'Registrations', 'Attended', 'Last seen', 'Venues']
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const lines = [head.join(',')]
    for (const g of filtered) {
      lines.push([g.first_name, g.last_name, g.mobile, g.email, g.instagram,
        g.registrations, g.attended, g.last_seen ? fmtDate(g.last_seen) : '',
        (g.venues || []).join(' / ')].map(esc).join(','))
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'luna-guest-database.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput className="flex-1 min-w-[220px] max-w-md" placeholder="Search name, phone, email or Instagram…" value={q} onChange={setQ} />
        <span className="text-sm text-luna-muted whitespace-nowrap">
          {rows === null ? 'Loading…' : `${filtered.length} of ${rows.length} guests`}
        </span>
        <button onClick={exportCsv} disabled={!rows || filtered.length === 0}
          className="btn-gold !py-2 !px-4 text-sm disabled:opacity-60"><Icon name="download" size={14} /> Download CSV</button>
      </div>

      {rows && rows.length === 0 && (
        <div className="card p-8 text-center text-luna-muted">No guests have registered yet.</div>
      )}

      {filtered.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="border-b border-white/[0.07]">
                <Th className="pt-3">Guest · mobile · Instagram</Th>
                <Th className="pt-3 text-right">Signups</Th>
                <Th className="pt-3 text-right">Attended</Th>
                <Th className="pt-3">Venues</Th>
                <Th className="pt-3">Last seen</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(g => (
                <tr key={g.id} className="border-b border-white/[0.045] last:border-0 hover:bg-white/[0.02]">
                  <Td>
                    <CellStack
                      primary={`${g.first_name} ${g.last_name}`}
                      secondary={[g.mobile, g.email, g.instagram].filter(Boolean).join(' · ') || undefined}
                    />
                  </Td>
                  <Td className="text-right tabular-nums">{g.registrations}</Td>
                  <Td className="text-right text-luna-gold font-semibold tabular-nums">{g.attended}</Td>
                  <Td><TagList items={g.venues || []} max={2} /></Td>
                  <Td className="text-luna-muted whitespace-nowrap">{g.last_seen ? fmtDate(g.last_seen) : '—'}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
