'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fmtDate } from '@/lib/format'

interface Venue { id: string; name: string }
interface VerifyData {
  ok: boolean; error?: string
  full_name?: string; membership_type?: string; institution?: string | null
  expiry_date?: string | null; status?: string; approved?: boolean; membership_number?: string
  wristband_issued?: boolean; wristband_issued_at?: string | null; wristband_issued_by?: string | null
}

function fmtClock(ts?: string | null) {
  if (!ts) return ''
  try {
    return new Date(ts).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', timeZone: 'Australia/Brisbane' })
  } catch { return '' }
}

export function VerifyConsole({ token, venues, canOverride }:
  { token: string; venues: Venue[]; canOverride: boolean }) {
  const supabase = useMemo(() => createClient(), [])
  const [venueId, setVenueId] = useState(venues[0]?.id ?? '')
  const [data, setData] = useState<VerifyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'warn' | 'err'; text: string } | null>(null)
  const [overrideReason, setOverrideReason] = useState('')
  const [showOverride, setShowOverride] = useState(false)

  const load = useCallback(async () => {
    if (!venueId) { setLoading(false); return }
    setLoading(true); setMsg(null); setShowOverride(false)
    const { data: d } = await supabase.rpc('verify_membership_for_reception', { p_token: token, p_venue: venueId })
    setData(d as VerifyData); setLoading(false)
  }, [supabase, token, venueId])

  useEffect(() => { load() }, [load])

  async function issue(override = false) {
    if (override && !overrideReason.trim()) { setMsg({ kind: 'warn', text: 'Please enter a reason to override.' }); return }
    setBusy(true); setMsg(null)
    const { data: r } = await supabase.rpc('issue_wristband', {
      p_token: token, p_venue: venueId, p_note: override ? overrideReason.trim() : null, p_override: override,
    })
    setBusy(false)
    if (!r?.ok) {
      if (r?.error === 'already_issued') {
        setMsg({ kind: 'warn', text: `Wristband already issued at ${fmtClock(r.issued_at)}${r.issued_by ? ` by ${r.issued_by}` : ''}.` })
        setShowOverride(canOverride)
      } else if (r?.error === 'not_approved') setMsg({ kind: 'err', text: 'This membership is not approved — do not issue a wristband.' })
      else if (r?.error === 'override_not_authorised') setMsg({ kind: 'err', text: 'Only a manager can override a duplicate.' })
      else if (r?.error === 'not_authorised') setMsg({ kind: 'err', text: 'You are not authorised for this venue.' })
      else setMsg({ kind: 'err', text: 'Could not issue wristband.' })
      return
    }
    setMsg({ kind: 'ok', text: override ? 'Override recorded — wristband issued.' : 'Wristband issued ✓' })
    setOverrideReason(''); setShowOverride(false); load()
  }

  if (loading) return <div className="card p-8 text-center text-luna-muted">Checking membership…</div>

  if (!data?.ok) {
    return (
      <div className="card p-8 text-center">
        <div className="text-red-500" style={{ fontSize: '4rem', lineHeight: 1 }}>✕</div>
        <h1 className="text-2xl font-extrabold mt-3">
          {data?.error === 'not_authorised' ? 'Not authorised' : 'Not recognised'}
        </h1>
        <p className="text-luna-muted mt-2">
          {data?.error === 'not_authorised'
            ? 'You don’t have access to verify memberships for this venue.'
            : 'This membership QR is not in the system.'}
        </p>
      </div>
    )
  }

  const approved = data.approved
  return (
    <div className="space-y-4">
      {venues.length > 1 && (
        <div>
          <label className="label">Venue</label>
          <select className="input" value={venueId} onChange={e => setVenueId(e.target.value)}>
            {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
      )}

      <div className={`card p-6 text-center ${approved ? 'border-emerald-500/50' : 'border-red-500/50'}`}>
        <div className={approved ? 'text-emerald-400' : 'text-red-400'} style={{ fontSize: '3.4rem', lineHeight: 1 }}>
          {approved ? '✓' : '✕'}
        </div>
        <span className={`pill mt-2 ${approved ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
          {approved ? 'Approved member' : `Not approved (${data.status})`}
        </span>
        <h1 className="text-2xl font-bold mt-3">{data.full_name}</h1>
        <p className="text-luna-muted">{data.membership_type}</p>
        <div className="grid grid-cols-2 gap-2 text-left mt-4">
          <Field label="Institution" value={data.institution || '—'} span />
          <Field label="ID expiry" value={data.expiry_date ? fmtDate(data.expiry_date) : '—'} />
          <Field label="Member #" value={data.membership_number || '—'} />
        </div>
      </div>

      {data.wristband_issued && (
        <div className="card p-4 border-amber-500/50 bg-amber-500/10 text-center">
          <p className="text-amber-300 font-semibold">
            ⚠ Wristband already issued at {fmtClock(data.wristband_issued_at)}
            {data.wristband_issued_by ? ` by ${data.wristband_issued_by}` : ''}.
          </p>
        </div>
      )}

      {msg && (
        <div className={`card p-3 text-center font-medium ${
          msg.kind === 'ok' ? 'bg-emerald-500/15 text-emerald-400' :
          msg.kind === 'warn' ? 'bg-amber-500/15 text-amber-300' : 'bg-red-500/15 text-red-400'}`}>
          {msg.text}
        </div>
      )}

      {approved && !showOverride && (
        <button className="btn-gold w-full btn-lg" disabled={busy} onClick={() => issue(false)}>
          {busy ? 'Working…' : 'Issue Wristband'}
        </button>
      )}

      {approved && showOverride && (
        <div className="card p-4 space-y-3">
          <p className="text-sm text-luna-muted">Manager override — this will record a duplicate wristband with your reason.</p>
          <input className="input" placeholder="Reason for override…" value={overrideReason} onChange={e => setOverrideReason(e.target.value)} />
          <div className="flex gap-2">
            <button className="btn-ghost flex-1" onClick={() => setShowOverride(false)}>Cancel</button>
            <button className="btn-danger flex-1" disabled={busy} onClick={() => issue(true)}>Override & issue</button>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, value, span }: { label: string; value: string; span?: boolean }) {
  return (
    <div className={`card bg-luna-surface p-3 ${span ? 'col-span-2' : ''}`}>
      <div className="text-[11px] uppercase tracking-wide text-luna-muted">{label}</div>
      <div className="font-semibold text-luna-text">{value}</div>
    </div>
  )
}
