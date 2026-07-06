'use client'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fmtDate } from '@/lib/format'

type G = {
  id: string; first_name: string; last_name: string; mobile: string
  email: string | null; instagram: string | null
  registrations: number; attended: number; last_seen: string | null; venues: string[]
}

export function GuestDirectory() {
  const supabase = useMemo(() => createClient(), [])
  const [rows, setRows] = useState<G[] | null>(null)
  const [q, setQ] = useState('')

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
        <input className="input flex-1 min-w-[220px]" placeholder="Search name, phone, email or Instagram…"
          value={q} onChange={e => setQ(e.target.value)} />
        <span className="text-sm text-luna-muted whitespace-nowrap">
          {rows === null ? 'Loading…' : `${filtered.length} of ${rows.length} guests`}
        </span>
        <button onClick={exportCsv} disabled={!rows || filtered.length === 0}
          className="btn-gold !py-2 !px-4 text-sm disabled:opacity-60">Download CSV</button>
      </div>

      {rows && rows.length === 0 && (
        <div className="card p-8 text-center text-luna-muted">No guests have registered yet.</div>
      )}

      {filtered.length > 0 && (
        <div className="card p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-luna-muted border-b border-luna-border/60">
                <th className="p-3 font-semibold">Name</th>
                <th className="p-3 font-semibold">Mobile</th>
                <th className="p-3 font-semibold">Email</th>
                <th className="p-3 font-semibold">Instagram</th>
                <th className="p-3 font-semibold text-right">Signups</th>
                <th className="p-3 font-semibold text-right">Attended</th>
                <th className="p-3 font-semibold">Venues</th>
                <th className="p-3 font-semibold">Last seen</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(g => (
                <tr key={g.id} className="border-b border-luna-border/30 last:border-0">
                  <td className="p-3 font-medium whitespace-nowrap">{g.first_name} {g.last_name}</td>
                  <td className="p-3 text-luna-muted whitespace-nowrap">{g.mobile}</td>
                  <td className="p-3 text-luna-muted">{g.email || '—'}</td>
                  <td className="p-3 text-luna-muted">{g.instagram || '—'}</td>
                  <td className="p-3 text-right">{g.registrations}</td>
                  <td className="p-3 text-right text-emerald-400">{g.attended}</td>
                  <td className="p-3 text-luna-muted">{(g.venues || []).join(', ') || '—'}</td>
                  <td className="p-3 text-luna-muted whitespace-nowrap">{g.last_seen ? fmtDate(g.last_seen) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
