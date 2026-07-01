'use client'
import { useState, useTransition } from 'react'
import { approvePromoter, setPromoterStatus, addPromoterNote, setEliteOverride } from '../actions'

export function PromoterActions({ id, status, elite }: { id: string; status: string; elite: boolean }) {
  const [pending, start] = useTransition()
  const [noteOpen, setNoteOpen] = useState(false)
  const [note, setNote] = useState('')

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2 flex-wrap justify-end">
        {status === 'pending' && (
          <>
            <button className="btn-gold !py-2 !px-4" disabled={pending}
              onClick={() => start(() => approvePromoter(id))}>Approve</button>
            <button className="btn-danger !py-2 !px-4" disabled={pending}
              onClick={() => start(() => setPromoterStatus(id, 'rejected'))}>Reject</button>
          </>
        )}
        {status === 'approved' && (
          <button className="btn-ghost !py-2 !px-4" disabled={pending}
            onClick={() => start(() => setPromoterStatus(id, 'suspended'))}>Suspend</button>
        )}
        {(status === 'suspended' || status === 'rejected') && (
          <button className="btn-gold !py-2 !px-4" disabled={pending}
            onClick={() => start(() => setPromoterStatus(id, 'approved'))}>Reactivate</button>
        )}
        <button className="btn-ghost !py-2 !px-4" onClick={() => setNoteOpen(o => !o)}>Note</button>
      </div>
      {status === 'approved' && (
        <label className="flex items-center gap-2 text-xs text-luna-muted">
          <input type="checkbox" className="accent-luna-gold" checked={elite}
            onChange={e => start(() => setEliteOverride(id, e.target.checked))} /> Elite tier
        </label>
      )}
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
