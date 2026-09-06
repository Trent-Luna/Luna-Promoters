'use client'
import { useState, useTransition } from 'react'
import { nudgeDormantPromoters } from '../actions'
import { Banner, BannerText } from '@/components/ui'

export function QueueBanner({ pending, oldestPendingDays, pendingNames, dormant, dormantWeeks }:
  { pending: number; oldestPendingDays: number; pendingNames: string[]; dormant: number; dormantWeeks: number }) {
  const [busy, start] = useTransition()
  const [result, setResult] = useState('')
  return (
    <Banner>
      {pending > 0 && (
        <>
          <BannerText
            title={`${pending} application${pending === 1 ? '' : 's'} waiting`}
            sub={`${oldestPendingDays > 0 ? `Oldest is ${oldestPendingDays} day${oldestPendingDays === 1 ? '' : 's'} · ` : ''}${pendingNames.join(', ')}${pending > pendingNames.length ? `, +${pending - pendingNames.length}` : ''}`}
          />
          <a href="/admin/promoters?status=pending" className="btn-gold !py-2 !px-4 text-sm">Review queue</a>
        </>
      )}
      {pending > 0 && dormant > 0 && <div className="hidden md:block w-px h-9 bg-white/10" />}
      {dormant > 0 && (
        <>
          <BannerText
            title={`${dormant} promoter${dormant === 1 ? '' : 's'} dormant`}
            sub={result || `No registrations in ${dormantWeeks}+ weeks · marked inactive nightly, tiers recalculated daily`}
          />
          <a href="/admin/promoters?status=inactive" className="btn-ghost !py-2 !px-4 text-sm">See who</a>
          <button className="btn-ghost !py-2 !px-4 text-sm" disabled={busy}
            onClick={() => start(async () => {
              const r = await nudgeDormantPromoters()
              setResult(`Nudged ${r.sent} · skipped ${r.skipped} (no email or nudged in the last fortnight)`)
            })}>
            {busy ? 'Sending…' : 'Nudge all'}
          </button>
        </>
      )}
    </Banner>
  )
}
