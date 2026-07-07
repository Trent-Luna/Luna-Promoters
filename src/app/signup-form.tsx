'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const AGREEMENTS = [
  'I agree to follow Luna Group promoter guidelines.',
  'I consent to Luna Group contacting me about promoter opportunities.',
]

export function PromoterSignupForm({ refCode = '' }: { refCode?: string }) {
  const router = useRouter()
  const [f, setF] = useState({
    full_name: '', mobile: '', email: '', dob: '',
    instagram: '', tiktok: '', facebook: '', suburb: '', category: 'promoter', ref: refCode,
  })
  const [agreed, setAgreed] = useState<boolean[]>(AGREEMENTS.map(() => false))
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }))
  const allAgreed = agreed.every(Boolean)

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr('')
    if (!allAgreed) { setErr('Please accept all agreement points to continue.'); return }
    const age = (Date.now() - new Date(f.dob).getTime()) / (365.25 * 864e5)
    if (!f.dob || age < 18) { setErr('You must be 18 years or older to apply.'); return }
    setLoading(true)
    try {
      let ip: string | null = null
      try { ip = (await (await fetch('/api/signup-ip')).json()).ip } catch {}
      const supabase = createClient()
      const { data, error } = await supabase.rpc('submit_promoter_application', {
        p_full_name: f.full_name.trim(), p_mobile: f.mobile.trim(), p_email: f.email.trim(),
        p_dob: f.dob, p_instagram: f.instagram, p_tiktok: f.tiktok, p_facebook: f.facebook,
        p_suburb: f.suburb, p_preferred_venue: null,
        p_other_venues: [], p_agreement: true, p_marketing: true, p_ip: ip, p_ref_code: f.ref.trim() || null,
        p_category: f.category,
      })
      if (error) throw error
      if (!data?.ok) {
        const m: Record<string, string> = {
          under_18: 'You must be 18 years or older to apply.',
          email_exists: 'An application with this email already exists.',
          mobile_exists: 'An application with this mobile number already exists.',
          agreement_required: 'Please accept all agreement points.',
        }
        setErr(m[data?.error] || 'Could not submit application. Please check your details.')
        return
      }
      router.push(data.auto_approved ? '/signup/success?approved=1' : '/signup/success')
    } catch (e: any) {
      setErr(e.message || 'Something went wrong. Please try again.')
    } finally { setLoading(false) }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="label">I'm signing up as *</label>
          <select className="input" value={f.category} onChange={e => set('category', e.target.value)}>
            <option value="promoter">Promoter</option>
            <option value="dj">DJ</option>
            <option value="staff">Staff</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label">Full name *</label>
          <input className="input" required value={f.full_name} onChange={e => set('full_name', e.target.value)} />
        </div>
        <div>
          <label className="label">Mobile number *</label>
          <input className="input" required type="tel" placeholder="04xx xxx xxx"
            value={f.mobile} onChange={e => set('mobile', e.target.value)} />
        </div>
        <div>
          <label className="label">Email address *</label>
          <input className="input" required type="email" value={f.email} onChange={e => set('email', e.target.value)} />
        </div>
        <div>
          <label className="label">Date of birth * <span className="text-luna-muted font-normal">(must be 18+)</span></label>
          <input className="input" required type="date" value={f.dob} onChange={e => set('dob', e.target.value)} />
        </div>
        <div>
          <label className="label">Suburb</label>
          <input className="input" value={f.suburb} onChange={e => set('suburb', e.target.value)} />
        </div>
        <div>
          <label className="label">Instagram</label>
          <input className="input" placeholder="@handle" value={f.instagram} onChange={e => set('instagram', e.target.value)} />
        </div>
        <div>
          <label className="label">TikTok</label>
          <input className="input" placeholder="@handle" value={f.tiktok} onChange={e => set('tiktok', e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Facebook profile</label>
          <input className="input" placeholder="facebook.com/…" value={f.facebook} onChange={e => set('facebook', e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Referral code <span className="text-luna-muted font-normal">(optional — enter the code of the promoter who referred you)</span></label>
          <input className="input" placeholder="e.g. GRACE" value={f.ref} onChange={e => set('ref', e.target.value.trim())} />
        </div>
      </div>

      <div className="card bg-luna-surface p-4 space-y-3">
        <p className="text-sm font-semibold">Promoter agreement</p>
        {AGREEMENTS.map((a, i) => (
          <label key={i} className="flex items-start gap-3 text-sm text-luna-text cursor-pointer">
            <input type="checkbox" className="mt-1 accent-luna-gold w-4 h-4" checked={agreed[i]}
              onChange={e => setAgreed(p => p.map((x, j) => j === i ? e.target.checked : x))} />
            <span>{a}</span>
          </label>
        ))}
      </div>

      <p className="text-xs text-luna-muted">
        By submitting you agree to our <a href="/terms" target="_blank" className="underline hover:text-white">Terms &amp; Conditions</a>.
      </p>
      {err && <p className="text-sm text-red-400">{err}</p>}
      <button className="btn-gold w-full btn-lg" disabled={loading || !allAgreed}>
        {loading ? 'Submitting…' : 'Submit application'}
      </button>
      <p className="text-xs text-luna-muted text-center">
        Your application will be reviewed by the Luna Group team. You'll receive access once approved.
      </p>
    </form>
  )
}
