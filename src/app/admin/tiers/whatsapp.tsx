'use client'
import { useState, useTransition } from 'react'
import { setWhatsappInviteUrl, inviteExistingPromotersToWhatsApp } from '../whatsapp-actions'

/**
 * Admin control for the Luna Group WhatsApp channel.
 *
 * The catch-up send is deliberately a two-step confirm: it emails hundreds of
 * people at once, and there is no unsend.
 */
export function WhatsappSettings({ inviteUrl, pendingCount }: { inviteUrl: string | null; pendingCount: number }) {
  const [url, setUrl] = useState(inviteUrl ?? '')
  const [saving, startSave] = useTransition()
  const [sending, startSend] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [confirm, setConfirm] = useState(false)

  return (
    <div className="card p-5 grid md:grid-cols-2 gap-6">
      <div className="space-y-2">
        <div className="eyebrow">WhatsApp channel</div>
        <input
          className="input !py-2.5"
          placeholder="https://whatsapp.com/channel/…"
          value={url}
          onChange={e => { setUrl(e.target.value); setErr(null) }}
        />
        <p className="text-xs text-luna-muted">
          Paste the channel link (WhatsApp → the channel → Share → Copy link). A group invite
          link works too. Promoters see a &ldquo;Join the WhatsApp&rdquo; button on their dashboard
          and after signing up. Leave it empty to hide it everywhere.
        </p>
        {err && <p className="text-xs text-red-400">{err}</p>}
        <button
          className="btn-ghost !py-1.5 !px-3 text-xs"
          disabled={saving}
          onClick={() => startSave(async () => {
            try { await setWhatsappInviteUrl(url); setMsg('Saved'); setTimeout(() => setMsg(null), 2000) }
            catch (e: any) { setErr(e?.message ?? 'Could not save that link') }
          })}
        >
          {saving ? 'Saving…' : msg ?? 'Save invite link'}
        </button>
      </div>

      <div className="space-y-2">
        <div className="eyebrow">Invite existing promoters</div>
        <p className="text-sm text-luna-text">
          {pendingCount} approved {pendingCount === 1 ? 'promoter has' : 'promoters have'} never been sent the channel link.
        </p>
        <p className="text-xs text-luna-muted">
          Emails each of them the link once. Staff and house accounts are skipped, and anyone already
          invited is never mailed twice — so running it again only catches new people. WhatsApp tells
          us nothing back, so this records that we sent it, never that they followed.
        </p>
        {!confirm ? (
          <button className="btn-ghost !py-1.5 !px-3 text-xs" disabled={!inviteUrl || pendingCount === 0}
            onClick={() => setConfirm(true)}>
            {!inviteUrl ? 'Save a link first' : `Send invite to ${pendingCount}…`}
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button className="btn-gold !py-1.5 !px-3 text-xs" disabled={sending}
              onClick={() => startSend(async () => {
                const r = await inviteExistingPromotersToWhatsApp()
                setMsg(`${r.sent} sent, ${r.skipped} skipped`)
                setConfirm(false)
              })}>
              {sending ? 'Sending…' : `Yes, email ${pendingCount} promoters`}
            </button>
            <button className="btn-ghost !py-1.5 !px-3 text-xs" onClick={() => setConfirm(false)}>Cancel</button>
          </div>
        )}
        {msg && <p className="text-xs text-luna-gold">{msg}</p>}
      </div>
    </div>
  )
}
