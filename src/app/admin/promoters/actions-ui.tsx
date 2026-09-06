'use client'
import { useState, useTransition } from 'react'
import { approvePromoter, setPromoterStatus, addPromoterNote, setEliteOverride, nudgePromoter, reactivatePromoter } from '../actions'

export function PromoterActions({ id, status, elite, inactive = false, nudgedAt = null, hasEmail = true }:
  { id: string; status: string; elite: boolean; inactive?: boolean; nudgedAt?: string | null; hasEmail?: boolean }) {
  const [pending, start] = useTransition()
  const [noteOpen, setNoteOpen] = useState(false)
  const [note, setNote] = useState('')
  const [msg, setMsg] = useState('')
  const recentlyNudged = !!nudgedAt && Date.now() - new Date(nudgedAt).getTime() < 14 * 864e5

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-1.5 flex-wrap justify-end">
        {status === 'pending' && (
          <>
            <button className="btn-gold !py-1.5 !px-3 text-xs" disabled={pending}
              onClick={() => start(() => approvePromoter(id))}>Approve</button>
            <button className="btn-ghost !py-1.5 !px-3 text-xs !text-red-400" disabled={pending}
              onClick={() => start(() => setPromoterStatus(id, 'rejected'))}>Reject</button>
          </>
        )}
        {status === 'approved' && inactive && (
          <>
            <button className="btn-ghost !py-1.5 !px-3 text-xs" disabled={pending || recentlyNudged || !hasEmail}
              title={!hasEmail ? 'No email on file' : recentlyNudged ? 'Nudged in the last fortnight' : 'Send a re-engagement email'}
              onClick={() => start(async () => { const r = await nudgePromoter(id); setMsg(r.ok ? 'Nudge sent' : r.reason === 'recently_nudged' ? 'Already nudged' : 'Could not send') })}>
              {recentlyNudged ? 'Nudged' : 'Nudge'}
            </button>
            <button className="btn-ghost !py-1.5 !px-3 text-xs" disabled={pending}
              onClick={() => start(() => reactivatePromoter(id))}>Reactivate</button>
          </>
        )}
        {status === 'approved' && (
          <button className="btn-ghost !py-1.5 !px-3 text-xs !text-luna-muted" disabled={pending}
            onClick={() => start(() => setPromoterStatus(id, 'suspended'))}>Suspend</button>
        )}
        {(status === 'suspended' || status === 'rejected') && (
          <button className="btn-gold !py-1.5 !px-3 text-xs" disabled={pending}
            onClick={() => start(() => setPromoterStatus(id, 'approved'))}>Reactivate</button>
        )}
        <button className="btn-ghost !py-1.5 !px-3 text-xs" onClick={() => setNoteOpen(o => !o)}>Note</button>
      </div>
      {status === 'approved' && (
        <label className="flex items-center gap-2 text-xs text-luna-muted">
          <input type="checkbox" className="accent-luna-gold" checked={elite}
            onChange={e => start(() => setEliteOverride(id, e.target.checked))} /> Elite tier
        </label>
      )}
      {msg && <span className="text-xs text-luna-muted">{msg}</span>}
      {noteOpen && (
        <div className="flex gap-2 w-full max-w-xs">
          <input className="input !py-2 text-sm" placeholder="Internal note…" value={note} onChange={e => setNote(e.target.value)} />
          <button className="btn-gold !py-2 !px-3 text-sm" disabled={!note.trim() || pending}
            onClick={() => start(async () => { await addPromoterNote(id, note); setNote(''); setNoteOpen(false) })}>Save</button>
        </div>
      )}
    </div>
  )
}
