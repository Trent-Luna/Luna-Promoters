'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { StatusPill } from '@/components/ui'
import { fmtDate, fmtDateTime } from '@/lib/format'

interface QueueRow {
  membership_id: string; membership_number: string; status: string; created_at: string; pass_token: string
  submitted_full_name: string; email: string; mobile: string; date_of_birth: string | null
  submitted_expiry_date: string | null; extracted_name: string | null; extracted_institution: string | null
  extracted_expiry_date: string | null; confidence_score: number | null; verification_summary: string | null
  review_reasons: string[] | null; is_university_id: boolean | null; is_current: boolean | null
  image_is_clear: boolean | null; name_matches: boolean | null; expiry_matches: boolean | null
  possible_tampering: boolean | null; has_document: boolean
}
interface MemberRow {
  id: string; membership_number: string; status: string; created_at: string; approved_at: string | null
  pass_token: string; full_name: string; email: string; mobile: string; date_of_birth: string | null
  extracted_institution: string | null; expiry_date: string | null; confidence_score: number | null
}

export function UniversityDashboard() {
  const supabase = useMemo(() => createClient(), [])
  const [tab, setTab] = useState<'queue' | 'all'>('queue')
  const [queue, setQueue] = useState<QueueRow[]>([])
  const [members, setMembers] = useState<MemberRow[]>([])
  const [filters, setFilters] = useState({ status: '', institution: '', search: '', from: '', to: '', expiry_from: '', expiry_to: '' })
  const [loading, setLoading] = useState(false)
  const [imgUrl, setImgUrl] = useState<string | null>(null)
  const [imgErr, setImgErr] = useState('')
  const [note, setNote] = useState('')

  const loadQueue = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.rpc('get_university_review_queue', {})
    setQueue((data ?? []) as QueueRow[]); setLoading(false)
  }, [supabase])

  const loadMembers = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.rpc('get_university_members', {
      p_status: filters.status || null, p_institution: filters.institution || null,
      p_search: filters.search || null, p_from: filters.from || null, p_to: filters.to || null,
      p_expiry_from: filters.expiry_from || null, p_expiry_to: filters.expiry_to || null, p_limit: 300,
    })
    setMembers((data ?? []) as MemberRow[]); setLoading(false)
  }, [supabase, filters])

  useEffect(() => { if (tab === 'queue') loadQueue(); else loadMembers() }, [tab, loadQueue, loadMembers])

  async function viewId(membershipId: string) {
    setImgErr(''); setImgUrl(null)
    const res = await fetch(`/api/membership/id-image/${membershipId}`)
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data?.ok) { setImgErr('Could not load ID image (permission or not found).'); return }
    setImgUrl(data.url)
  }

  async function review(membershipId: string, action: string) {
    let reason: string | null = null
    if (action === 'reject' || action === 'suspend') {
      reason = window.prompt(`Enter a reason to ${action} this member (required):`) || ''
      if (!reason.trim()) return
    }
    const res = await fetch('/api/university/review', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ membership_id: membershipId, action, reason }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data?.ok) { alert('Action failed: ' + (data?.error || 'error')); return }
    loadQueue()
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button className={tab === 'queue' ? 'btn-gold !py-2' : 'btn-ghost !py-2'} onClick={() => setTab('queue')}>Manual review ({queue.length})</button>
        <button className={tab === 'all' ? 'btn-gold !py-2' : 'btn-ghost !py-2'} onClick={() => setTab('all')}>All members</button>
      </div>

      {tab === 'queue' && (
        <div className="space-y-3">
          {loading && <p className="text-luna-muted text-sm">Loading…</p>}
          {!loading && queue.length === 0 && <p className="text-luna-muted text-sm py-6 text-center">Nothing awaiting manual review 🎉</p>}
          {queue.map(r => (
            <div key={r.membership_id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-lg">{r.submitted_full_name}</div>
                  <div className="text-sm text-luna-muted">{r.email} · {r.mobile} · DOB {r.date_of_birth ? fmtDate(r.date_of_birth) : '—'}</div>
                </div>
                <div className="text-right">
                  <StatusPill status={r.status} />
                  <div className="text-xs text-luna-muted mt-1">{r.membership_number}</div>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3 mt-3 text-sm">
                <div className="card bg-luna-surface p-3">
                  <p className="text-xs uppercase tracking-wide text-luna-muted mb-1">Submitted</p>
                  <p>Name: {r.submitted_full_name}</p>
                  <p>Expiry: {r.submitted_expiry_date ? fmtDate(r.submitted_expiry_date) : '—'}</p>
                </div>
                <div className="card bg-luna-surface p-3">
                  <p className="text-xs uppercase tracking-wide text-luna-muted mb-1">AI extracted</p>
                  <p>Name: {r.extracted_name || '—'}</p>
                  <p>Institution: {r.extracted_institution || '—'}</p>
                  <p>Expiry: {r.extracted_expiry_date ? fmtDate(r.extracted_expiry_date) : '—'}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mt-3 text-xs">
                <Check ok={r.is_university_id} label="Uni ID" />
                <Check ok={r.is_current} label="Current" />
                <Check ok={r.image_is_clear} label="Clear" />
                <Check ok={r.name_matches} label="Name" />
                <Check ok={r.expiry_matches} label="Expiry" />
                <Check ok={r.possible_tampering === false} label="No tamper" />
                <span className="pill bg-luna-border text-luna-muted">Confidence: {r.confidence_score ?? '—'}</span>
              </div>

              {r.verification_summary && <p className="text-sm text-luna-muted mt-2 italic">“{r.verification_summary}”</p>}
              {(r.review_reasons?.length ?? 0) > 0 &&
                <p className="text-xs text-amber-300 mt-1">Reasons: {r.review_reasons!.join(', ')}</p>}

              <div className="flex flex-wrap gap-2 mt-4">
                <button className="btn-ghost !py-2 !px-3 text-sm" onClick={() => viewId(r.membership_id)}>View ID (secure)</button>
                <button className="btn-gold !py-2 !px-3 text-sm" onClick={() => review(r.membership_id, 'approve')}>Approve</button>
                <button className="btn-ghost !py-2 !px-3 text-sm" onClick={() => review(r.membership_id, 'request_new_id')}>Request new ID</button>
                <button className="btn-danger !py-2 !px-3 text-sm" onClick={() => review(r.membership_id, 'reject')}>Reject</button>
                <button className="btn-danger !py-2 !px-3 text-sm" onClick={() => review(r.membership_id, 'suspend')}>Suspend</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'all' && (
        <div className="space-y-3">
          <div className="card p-4 grid sm:grid-cols-3 gap-3">
            <input className="input" placeholder="Search name / email / mobile" value={filters.search}
              onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} />
            <select className="input" value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
              <option value="">All statuses</option>
              <option value="approved">Approved</option>
              <option value="manual_review">Manual review</option>
              <option value="pending_verification">Pending</option>
              <option value="rejected">Rejected</option>
              <option value="suspended">Suspended</option>
            </select>
            <input className="input" placeholder="Institution" value={filters.institution}
              onChange={e => setFilters(f => ({ ...f, institution: e.target.value }))} />
            <div><label className="label">Applied from</label><input className="input" type="date" value={filters.from} onChange={e => setFilters(f => ({ ...f, from: e.target.value }))} /></div>
            <div><label className="label">Applied to</label><input className="input" type="date" value={filters.to} onChange={e => setFilters(f => ({ ...f, to: e.target.value }))} /></div>
            <div className="flex items-end"><button className="btn-gold w-full !py-3" onClick={loadMembers}>Apply filters</button></div>
          </div>

          {loading && <p className="text-luna-muted text-sm">Loading…</p>}
          {!loading && members.length === 0 && <p className="text-luna-muted text-sm py-6 text-center">No members match those filters.</p>}
          {members.map(m => (
            <div key={m.id} className="card p-4 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{m.full_name} <span className="text-luna-muted text-xs">{m.membership_number}</span></div>
                <div className="text-sm text-luna-muted truncate">
                  {m.email} · {m.mobile}
                  {m.extracted_institution ? ` · ${m.extracted_institution}` : ''}
                  {m.expiry_date ? ` · exp ${fmtDate(m.expiry_date)}` : ''}
                </div>
                <div className="text-xs text-luna-muted">Applied {fmtDateTime(m.created_at)}</div>
              </div>
              <div className="text-right space-y-1">
                <StatusPill status={m.status} />
                <div><button className="text-xs text-luna-muted hover:text-white underline" onClick={() => viewId(m.id)}>View ID</button></div>
                <a className="text-xs text-luna-muted hover:text-white underline" href={`/m/${m.pass_token}`} target="_blank">Pass ↗</a>
              </div>
            </div>
          ))}
        </div>
      )}

      {(imgUrl || imgErr) && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => { setImgUrl(null); setImgErr('') }}>
          <div className="max-w-lg w-full card p-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3">
              <p className="font-semibold">University ID (expires in 60s)</p>
              <button className="btn-ghost !py-1 !px-3 text-sm" onClick={() => { setImgUrl(null); setImgErr('') }}>Close</button>
            </div>
            {imgErr && <p className="text-red-400 text-sm">{imgErr}</p>}
            {imgUrl && (
              /\.pdf(\?|$)/i.test(imgUrl)
                ? <a className="btn-gold w-full" href={imgUrl} target="_blank" rel="noreferrer">Open PDF</a>
                /* eslint-disable-next-line @next/next/no-img-element */
                : <img src={imgUrl} alt="University ID" className="w-full rounded-lg" />
            )}
          </div>
        </div>
      )}
      {note && <p className="text-xs text-luna-muted">{note}</p>}
    </div>
  )
}

function Check({ ok, label }: { ok: boolean | null; label: string }) {
  const cls = ok === true ? 'bg-emerald-500/15 text-emerald-400'
    : ok === false ? 'bg-red-500/15 text-red-400' : 'bg-luna-border text-luna-muted'
  return <span className={`pill ${cls}`}>{ok === true ? '✓' : ok === false ? '✕' : '—'} {label}</span>
}
