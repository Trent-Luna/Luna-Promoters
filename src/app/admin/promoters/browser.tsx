'use client'
import { useMemo, useState } from 'react'
import { StatusPill, TierBadge } from '@/components/ui'
import { fmtDate } from '@/lib/format'
import { PromoterActions } from './actions-ui'
import { CategorySelect } from './category-ui'

interface P {
  id: string; full_name: string; email: string; mobile: string; date_of_birth: string
  instagram: string | null; suburb: string | null; status: string; promoter_code: string | null
  current_tier: string; elite_override: boolean; category: 'promoter' | 'dj' | 'staff'
  admin_notes: { note: string }[]
}

const TABS = ['', 'pending', 'approved', 'suspended', 'rejected']
const CATS: { v: string; label: string }[] = [{ v: '', label: 'All types' }, { v: 'promoter', label: 'Promoters' }, { v: 'dj', label: 'DJs' }, { v: 'staff', label: 'Staff' }]

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

  const countFor = (st: string) => promoters.filter(p => !st || p.status === st).length

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input className="input flex-1" placeholder="Search name, email, phone, code, suburb or Instagram…"
          value={q} onChange={e => setQ(e.target.value)} />
      </div>
      <div className="flex gap-2 mb-3 flex-wrap">
        {TABS.map(t => (
          <button key={t || 'all'} onClick={() => setStatus(t)}
            className={`pill border ${status === t ? 'bg-white/10 text-white border-white' : 'border-luna-border text-luna-muted'}`}>
            {t ? t[0].toUpperCase() + t.slice(1) : 'All'} <span className="ml-1 opacity-60">{countFor(t)}</span>
          </button>
        ))}
      </div>
      <div className="flex gap-2 mb-4 flex-wrap">
        {CATS.map(c => (
          <button key={c.v || 'allcat'} onClick={() => setCat(c.v)}
            className={`pill border ${cat === c.v ? 'bg-luna-purple/25 text-white border-luna-purple' : 'border-luna-border text-luna-muted'}`}>
            {c.label} <span className="ml-1 opacity-60">{promoters.filter(p => !c.v || p.category === c.v).length}</span>
          </button>
        ))}
      </div>
      <p className="text-xs text-luna-muted mb-3">{filtered.length} promoter{filtered.length === 1 ? '' : 's'}</p>
      <div className="space-y-3">
        {filtered.length === 0 && <div className="card p-6 text-center text-luna-muted">No promoters match.</div>}
        {filtered.map(p => (
          <div key={p.id} className="card p-5">
            <div className="flex flex-wrap items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-lg">{p.full_name}</span>
                  <StatusPill status={p.status} />
                  {p.status === 'approved' && <TierBadge tier={p.current_tier} />}
                  {p.promoter_code && <code className="text-xs text-white/80">/p/{p.promoter_code}</code>}
                  <CategorySelect id={p.id} value={p.category} />
                </div>
                <div className="text-sm text-luna-muted mt-1">
                  {p.email} · {p.mobile} · DOB {fmtDate(p.date_of_birth)}
                  {p.suburb ? ` · ${p.suburb}` : ''}{p.instagram ? ` · ${p.instagram}` : ''}
                </div>
                {(p.admin_notes ?? []).length > 0 && (
                  <div className="mt-2 text-xs text-luna-muted space-y-0.5">
                    {p.admin_notes.map((n, i) => <div key={i}>📝 {n.note}</div>)}
                  </div>
                )}
              </div>
              <PromoterActions id={p.id} status={p.status} elite={p.elite_override} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
