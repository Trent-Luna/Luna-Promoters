'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { crewUrl, crewTitle, crewProgress, inviteText, whatsappHref, CREW_MIN } from '@/lib/crew'

export interface CrewInfo {
  occasion: string | null; honoree_name: string | null; crew_size: number | null
  crew_code: string | null; joined: number
}

/**
 * "Now get the crew on your list" (25 Oct 2026, migration 0053). Shown on the
 * pass of a birthday / hens / bucks host: their personal link, ways to send
 * it, and how many have signed up through it. Friends who use the link get
 * their own QR and appear under "Bringing friends?" below.
 *
 * A host who signed up through an ordinary promoter link has no link yet; one
 * tap makes it.
 */
export function CrewCard({ token, crew, site, hostFirst, venue, night, canShare }: {
  token: string; crew: CrewInfo; site: string; hostFirst: string; venue: string; night: string; canShare: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [err, setErr] = useState('')

  const p = crewProgress(crew.joined, crew.crew_size)
  const title = crewTitle({ occasion: crew.occasion, host_first: hostFirst, honoree_name: crew.honoree_name })
  const url = crew.crew_code ? crewUrl(site, crew.crew_code) : ''
  const text = url ? inviteText({ title, venue, night, url }) : ''

  async function makeLink() {
    setBusy(true); setErr('')
    try {
      const { data, error } = await createClient().rpc('set_crew_details', { p_token: token })
      if (error || !data?.ok) throw new Error('Could not make your link — please try again.')
      router.refresh()
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch {}
  }
  async function share() {
    if (navigator.share) { try { await navigator.share({ title, text, url }) } catch {} }
    else copy()
  }

  if (!canShare && !crew.crew_code) return null

  return (
    <div className="card p-5 mt-4 text-left">
      <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-luna-gold">Your crew</div>
      <h2 className="text-lg font-bold leading-tight mt-1">Now get the crew on your list</h2>

      {!crew.crew_code ? (
        <>
          <p className="text-sm text-luna-muted mt-1.5">
            Get a link to send the group. Everyone who signs up through it gets their own QR and joins your list.
          </p>
          {err && <p className="text-sm text-red-400 mt-2">{err}</p>}
          <button onClick={makeLink} disabled={busy} className="btn-gold w-full mt-4">{busy ? 'Making your link…' : 'Get my crew link'}</button>
        </>
      ) : (
        <>
          <div className="mt-3">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-semibold">{p.line}</span>
              <span className={p.dealMet ? 'text-luna-gold font-semibold' : 'text-luna-muted'}>
                {p.dealMet ? 'Deal unlocked ✓' : `${p.toGo} more for the ${CREW_MIN}+ deal`}
              </span>
            </div>
            <div className="h-2 rounded-full bg-white/10 mt-2 overflow-hidden">
              <div className="h-full rounded-full btn-gold !p-0" style={{ width: `${Math.min(100, Math.round((p.total / p.target) * 100))}%` }} />
            </div>
          </div>

          {canShare && (
            <>
              <div className="mt-4 flex items-center gap-2">
                <input className="input !py-2 text-sm flex-1 min-w-0" readOnly value={url} onFocus={e => e.currentTarget.select()} aria-label="Your crew link" />
                <button onClick={copy} className="btn-ghost !py-2 !px-3 text-sm shrink-0">{copied ? 'Copied' : 'Copy'}</button>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <a href={whatsappHref(text)} target="_blank" rel="noopener noreferrer" className="btn-gold text-center">Send on WhatsApp</a>
                <button onClick={share} className="btn-ghost">Share another way</button>
              </div>
              <p className="text-[11px] text-luna-muted mt-3">
                Each friend gets their own QR for {venue}, {night}. They show up in your list below as they sign up. Up to 10 in a crew, you included.
              </p>
            </>
          )}
        </>
      )}
    </div>
  )
}
