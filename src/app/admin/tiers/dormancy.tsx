'use client'
import { useState, useTransition } from 'react'
import { setDormantWeeks } from '../actions'
import { AutoApproveToggle } from '../promoters/auto-approve'

export function DormancySettings({ weeks, autoApprove }: { weeks: number; autoApprove: boolean }) {
  const [w, setW] = useState(String(weeks))
  const [pending, start] = useTransition()
  const [saved, setSaved] = useState(false)
  return (
    <div className="card p-5 grid md:grid-cols-3 gap-6">
      <div className="space-y-2">
        <div className="eyebrow">Dormancy</div>
        <div className="flex items-center gap-2 text-sm text-luna-muted">
          <input type="number" min={1} max={52} className="input !w-20 !py-2" value={w} onChange={e => setW(e.target.value)} />
          <span>weeks without a registration → <span className="pill bg-zinc-500/20 text-luna-subtle">inactive</span></span>
        </div>
        <p className="text-xs text-luna-muted">Inactive promoters keep their link; they show as inactive on the Promoters page and can be nudged. A new registration clears it.</p>
        <button className="btn-ghost !py-1.5 !px-3 text-xs" disabled={pending}
          onClick={() => start(async () => { await setDormantWeeks(Number(w)); setSaved(true); setTimeout(() => setSaved(false), 2000) })}>
          {pending ? 'Saving…' : saved ? 'Saved' : 'Save dormancy rule'}
        </button>
      </div>
      <div className="space-y-2">
        <div className="eyebrow">Recalculation</div>
        <p className="text-sm text-luna-text">Tiers are recalculated every night at 12:10am and reset with each new month. Elite is invite-only — set it per promoter.</p>
        <p className="text-xs text-luna-muted">Promoters see how far they are from the next tier on their dashboard.</p>
      </div>
      <div className="space-y-3">
        <div className="eyebrow">Approvals</div>
        <AutoApproveToggle initial={autoApprove} compact />
        <p className="text-xs text-luna-muted">University sign-up approvals are on the University page.</p>
      </div>
    </div>
  )
}
