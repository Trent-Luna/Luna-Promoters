'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Icon } from '@/components/icons'
import { StatusPill } from '@/components/ui'

export interface Member { id: string; first_name: string; last_name: string; status: string; qr_token: string; is_host: boolean; is_me: boolean }

/**
 * Bring friends: the guest registers friends by name and mobile from their own
 * pass, and each friend gets their own QR — the door scans one person, one
 * code. Mobile AND email are both required: a guest with only a mobile never
 * reaches the CRM, so a group of ten used to yield one contact instead of ten.
 * The host can also send the pass link straight from here.
 */
export function GroupInvite({ token, members, site, venue, dateLabel, canAdd }:
  { token: string; members: Member[]; site: string; venue: string; dateLabel: string; canAdd: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(members.length === 0 ? false : true)
  const [f, setF] = useState({ first: '', last: '', mobile: '', email: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [added, setAdded] = useState<{ name: string; token: string } | null>(null)
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }))

  async function add(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setAdded(null)
    if (!f.first.trim() || f.mobile.replace(/\D/g, '').length < 8) { setErr('A first name and a mobile number, please.'); return }
    if (!/^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/.test(f.email.trim())) { setErr('An email address for them, please — that is how they get their QR.'); return }
    setBusy(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('add_group_guest', {
        p_token: token, p_first: f.first.trim(), p_last: f.last.trim(), p_mobile: f.mobile.trim(), p_email: f.email.trim() || null,
      })
      if (error) throw error
      if (!data?.ok) {
        const m: Record<string, string> = {
          duplicate: 'They are already on the list for this night.',
          group_full: 'Your group is at the limit of 10.',
          past_event: 'This night has already happened.',
          bad_input: 'A first name and a mobile number, please.',
          email_required: 'An email address for them, please — that is how they get their QR.',
          bad_email: 'That email does not look right — check it and try again.',
        }
        setErr(m[data?.error] || 'Could not add them — please try again.'); return
      }
      {
        try { fetch('/api/guest-confirmation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: data.qr_token }), keepalive: true }) } catch {}
      }
      setAdded({ name: f.first.trim(), token: data.qr_token })
      setF({ first: '', last: '', mobile: '', email: '' })
      router.refresh()
    } catch (e: any) {
      setErr(e.message || 'Something went wrong.')
    } finally { setBusy(false) }
  }

  async function sendPass(m: { first_name: string; qr_token: string }) {
    const url = `${site}/g/${m.qr_token}`
    const text = `${m.first_name}, you're on the guestlist at ${venue} · ${dateLabel}. Your QR pass: ${url}`
    if (navigator.share) { try { await navigator.share({ title: 'Your guestlist pass', text, url }) } catch {} }
    else { try { await navigator.clipboard.writeText(text) } catch {} }
  }

  const others = members.filter(m => !m.is_me)

  return (
    <div className="card p-5 mt-4 text-left">
      <div className="flex items-center gap-3">
        <div className="min-w-0">
          <h2 className="font-bold leading-tight">Bringing friends?</h2>
          <p className="text-xs text-luna-muted mt-0.5">
            {others.length > 0 ? `${others.length} in your group · everyone shows their own QR at the door.` : 'Add them here — each friend gets their own QR for the door.'}
          </p>
        </div>
        {canAdd && (
          <button onClick={() => setOpen(o => !o)} className="btn-ghost !py-2 !px-3 text-sm ml-auto shrink-0">
            <Icon name={open ? 'chevd' : 'plus'} size={14} /> {open ? 'Hide' : 'Add a friend'}
          </button>
        )}
      </div>

      {others.length > 0 && (
        <div className="mt-3 divide-y divide-white/[0.07]">
          {others.map(m => (
            <div key={m.id} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="font-semibold truncate">{m.first_name} {m.last_name}{m.is_host ? <span className="text-xs text-luna-muted font-normal"> · host</span> : ''}</div>
              </div>
              <StatusPill status={m.status} />
              <button onClick={() => sendPass(m)} className="btn-ghost !py-1.5 !px-3 text-xs" title="Send them their pass">
                <Icon name="share" size={14} /> Send pass
              </button>
            </div>
          ))}
        </div>
      )}

      {canAdd && open && (
        <form onSubmit={add} className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">First name *</label><input className="input" required value={f.first} onChange={e => set('first', e.target.value)} /></div>
            <div><label className="label">Last name</label><input className="input" value={f.last} onChange={e => set('last', e.target.value)} /></div>
          </div>
          <div><label className="label">Mobile *</label><input className="input" type="tel" required placeholder="04xx xxx xxx" value={f.mobile} onChange={e => set('mobile', e.target.value)} /></div>
          <div><label className="label">Email * <span className="font-normal">(we&apos;ll email them their QR)</span></label><input className="input" type="email" required value={f.email} onChange={e => set('email', e.target.value)} /></div>
          {err && <p className="text-sm text-red-400">{err}</p>}
          {added && (
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm flex items-center gap-3">
              <span className="flex-1">{added.name} is on the list.</span>
              <button type="button" onClick={() => sendPass({ first_name: added.name, qr_token: added.token })} className="btn-gold !py-1.5 !px-3 text-xs">
                <Icon name="share" size={14} /> Send their pass
              </button>
            </div>
          )}
          <button className="btn-gold w-full" disabled={busy}>{busy ? 'Adding…' : 'Add to the list'}</button>
          <p className="text-[11px] text-luna-muted text-center">Up to 10 in a group. Entry is still at the door&apos;s discretion — arrive together, early.</p>
        </form>
      )}
    </div>
  )
}
