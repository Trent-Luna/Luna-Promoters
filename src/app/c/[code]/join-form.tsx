'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { venueToday } from '@/lib/trading'
import { loadPixel, trackLead, pixelForVenue } from '@/lib/meta-pixel'

/**
 * A friend joining a host's crew (/c/<code>, migration 0053). The venue and
 * night are the host's, so this asks only who you are. Same fields and the
 * same email rule as the guest list form; join_crew does the checking.
 */
export function CrewJoinForm({ code, venueName, extraPixels, cta }: {
  code: string; venueName: string; extraPixels: string[]; cta: string
}) {
  // The venue's own pixel (meta-pixel.ts is a client module, so it is looked up
  // here, not on the server page) plus the group dataset. get_crew's venue_name
  // is venues.name, so "Su Casa Brisbane" (and "SuCasa") selects Su Casa's pixel.
  const pixels = Array.from(new Set([pixelForVenue(venueName), ...extraPixels].filter((x): x is string => !!x)))
  const router = useRouter()
  const today = venueToday()
  const [f, setF] = useState({ first: '', last: '', mobile: '', email: '', dob: '', instagram: '' })
  const [consent, setConsent] = useState(false)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }))

  const pixelKey = pixels.join(',')
  useEffect(() => { for (const id of pixelKey ? pixelKey.split(',') : []) loadPixel(id) }, [pixelKey])

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr('')
    setLoading(true)
    try {
      const { data, error } = await createClient().rpc('join_crew', {
        p_code: code, p_first: f.first.trim(), p_last: f.last.trim(), p_mobile: f.mobile.trim(),
        p_email: f.email.trim(), p_dob: f.dob || null, p_instagram: f.instagram.trim() || null, p_marketing: consent,
      })
      if (error) throw error
      if (!data?.ok) {
        const m: Record<string, string> = {
          duplicate: 'You’re already on the list for this night.',
          bad_input: 'A first name and a mobile number, please.',
          email_required: 'Please enter your email — that’s how your QR gets to you.',
          bad_email: 'That email doesn’t look right — check it and try again.',
          guestlist_closed: 'The guest list for this night has closed.',
          past_event: 'This night has already happened.',
          cancelled: 'This crew link is no longer active.',
          crew_full: 'This crew is full — ten is the limit.',
          not_found: 'This crew link isn’t active.',
        }
        setErr(m[data?.error] || 'Could not get you on the list. Please check your details.')
        return
      }
      try {
        fetch('/api/guest-confirmation', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: data.qr_token }), keepalive: true,
        })
      } catch {}
      for (const id of pixels) trackLead(id, data.qr_token, { content_name: venueName, content_category: 'crew link' })
      router.push(`/g/${data.qr_token}`)
    } catch (e: any) {
      setErr(e.message || 'Something went wrong. Please try again.')
    } finally { setLoading(false) }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">First name *</label><input className="input" required value={f.first} onChange={e => set('first', e.target.value)} /></div>
        <div><label className="label">Last name *</label><input className="input" required value={f.last} onChange={e => set('last', e.target.value)} /></div>
      </div>
      <div><label className="label">Mobile number *</label><input className="input" required type="tel" placeholder="04xx xxx xxx" value={f.mobile} onChange={e => set('mobile', e.target.value)} /></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><label className="label">Email *</label><input className="input" type="email" required value={f.email} onChange={e => set('email', e.target.value)} /></div>
        <div><label className="label">Date of birth</label><input className="input" type="date" max={today} value={f.dob} onChange={e => set('dob', e.target.value)} /></div>
      </div>
      <div><label className="label">Instagram</label><input className="input" placeholder="@handle" value={f.instagram} onChange={e => set('instagram', e.target.value)} /></div>
      <label className="flex items-start gap-3 text-sm cursor-pointer">
        <input type="checkbox" className="mt-1 accent-luna-gold w-4 h-4" checked={consent} onChange={e => setConsent(e.target.checked)} />
        <span className="text-luna-muted">I&apos;m happy for Luna Group to send me event updates and offers.</span>
      </label>
      {err && <p className="text-sm text-red-400">{err}</p>}
      <button className="btn-gold w-full btn-lg" disabled={loading}>{loading ? 'Getting you on…' : cta}</button>
      <p className="text-[11px] text-luna-muted text-center">
        By registering you agree to our <a href="/terms" target="_blank" className="underline hover:text-white">Terms &amp; Conditions</a>.
      </p>
    </form>
  )
}
