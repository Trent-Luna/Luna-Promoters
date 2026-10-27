'use client'

import { useEffect, useState } from 'react'
import { JoinWhatsApp } from '@/components/JoinWhatsApp'
import { WHATSAPP_CHANNEL_BODY, WHATSAPP_CHANNEL_TITLE } from '@/lib/whatsapp-copy'

const DISMISS_KEY = 'luna-promoter-whatsapp-channel-dismissed'

/**
 * Promoter-dashboard prompt for the Luna Group promoters channel.
 *
 * Same gold callout as the other banners (the pending-queue banner), with the
 * existing WhatsApp button. Renders nothing when no link is configured.
 * Dismissing it only shortens the copy — Follow stays on the page, because
 * the channel is where guest list links and perks go out first.
 */
export function PromoterWhatsAppCard({ href }: { href: string | null }) {
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(DISMISS_KEY) === '1')
    } catch {
      /* Private mode: leave the full card up. */
    }
  }, [])

  if (!href) return null

  function dismiss() {
    setDismissed(true)
    try { window.localStorage.setItem(DISMISS_KEY, '1') } catch { /* ignore */ }
  }

  return (
    <div className="card mb-5 px-5 py-5 sm:px-6 border-luna-gold/35 bg-[linear-gradient(90deg,rgba(212,162,76,0.10),#17171a_55%)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="min-w-0 grow">
          <p className="eyebrow text-luna-gold">WhatsApp Channel</p>
          <h2 className="text-lg font-bold mt-1">{WHATSAPP_CHANNEL_TITLE}</h2>
          <p className="text-sm text-luna-muted mt-1">
            {dismissed
              ? 'Guest list links, headliner drops and promoter perks still go out here first.'
              : WHATSAPP_CHANNEL_BODY}
          </p>
        </div>
        <div className="flex w-full sm:w-auto items-center gap-2 shrink-0">
          <JoinWhatsApp href={href} label="Follow" className="flex-1 sm:flex-none" full />
          {!dismissed && (
            <button
              type="button"
              onClick={dismiss}
              className="text-xs text-luna-muted hover:text-luna-text px-2 py-2"
              aria-label="Dismiss WhatsApp channel card"
            >
              Dismiss
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
