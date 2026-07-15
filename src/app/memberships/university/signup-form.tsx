'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const MAX_MB = 10
const ACCEPT = '.jpg,.jpeg,.png,.webp,.heic,.heif,.pdf,image/*,application/pdf'
const ALLOWED = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']

const ERRORS: Record<string, string> = {
  missing_fields: 'Please complete all fields.',
  consent_required: 'Please tick the required consent boxes to continue.',
  under_18: 'University membership is only available to people aged 18 or older.',
  document_required: 'Please upload a photo of your university ID.',
  invalid_file_type: 'Please upload a JPG, PNG, WEBP, HEIC or PDF.',
  file_too_large: `That file is too large. Please keep it under ${MAX_MB} MB.`,
  rate_limited: 'Too many attempts — please wait a minute and try again.',
  upload_failed: 'We couldn’t upload your ID. Please try again.',
  submit_failed: 'Something went wrong. Please check your details and try again.',
}

export function UniversitySignupForm() {
  const router = useRouter()
  const [f, setF] = useState({ full_name: '', mobile: '', email: '', dob: '', expiry_date: '' })
  const [file, setFile] = useState<File | null>(null)
  const [privacy, setPrivacy] = useState(false)
  const [ownId, setOwnId] = useState(false)
  const [marketing, setMarketing] = useState(false) // NOT pre-selected
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }))
  const today = new Date().toISOString().slice(0, 10)

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null
    setErr('')
    if (file) {
      if (file.size > MAX_MB * 1024 * 1024) { setErr(ERRORS.file_too_large); setFile(null); return }
      const okType = ALLOWED.includes(file.type) || /\.(jpe?g|png|webp|heic|heif|pdf)$/i.test(file.name)
      if (!okType) { setErr(ERRORS.invalid_file_type); setFile(null); return }
    }
    setFile(file)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr('')
    if (!f.full_name || !f.mobile || !f.email || !f.dob || !f.expiry_date) { setErr(ERRORS.missing_fields); return }
    if (!file) { setErr(ERRORS.document_required); return }
    if (!privacy || !ownId) { setErr(ERRORS.consent_required); return }
    // 18+ front-end gate (also enforced on the server and in the database)
    const age = (Date.now() - new Date(f.dob).getTime()) / (365.25 * 864e5)
    if (age < 18) { setErr(ERRORS.under_18); return }

    setLoading(true)
    try {
      const body = new FormData()
      body.set('full_name', f.full_name.trim())
      body.set('mobile', f.mobile.trim())
      body.set('email', f.email.trim())
      body.set('dob', f.dob)
      body.set('expiry_date', f.expiry_date)
      body.set('agreement', String(privacy))
      body.set('id_confirm', String(ownId))
      body.set('marketing', String(marketing))
      body.set('id_card', file)
      const res = await fetch('/api/university/signup', { method: 'POST', body })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.ok) { setErr(ERRORS[data?.error] || ERRORS.submit_failed); setLoading(false); return }
      router.push(`/m/${data.pass_token}`)
    } catch {
      setErr(ERRORS.submit_failed); setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid sm:grid-cols-2 gap-4">
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
          <input className="input" required type="date" max={today} value={f.dob} onChange={e => set('dob', e.target.value)} />
        </div>
        <div>
          <label className="label">University ID expiry date *</label>
          <input className="input" required type="date" value={f.expiry_date} onChange={e => set('expiry_date', e.target.value)} />
        </div>
      </div>

      <div className="card bg-luna-surface p-4">
        <p className="text-sm font-semibold mb-2">Upload your current university ID *</p>
        <ul className="text-xs text-luna-muted list-disc pl-5 space-y-1 mb-3">
          <li>Make sure the whole card is visible and the text is readable.</li>
          <li>Avoid glare and shadows.</li>
          <li>Upload the side showing your name and the expiry date.</li>
          <li>Don’t upload a different ID (e.g. licence or passport).</li>
        </ul>
        <input type="file" accept={ACCEPT} onChange={pickFile}
          className="block w-full text-sm text-luna-text file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-white file:text-black file:font-semibold" />
        {file && <p className="text-xs text-emerald-400 mt-2">Selected: {file.name}</p>}
        <p className="text-[11px] text-luna-muted mt-2">JPG, PNG, WEBP, HEIC or PDF · up to {MAX_MB} MB. Stored securely and never shared publicly.</p>
      </div>

      <div className="card bg-luna-surface p-4 space-y-3">
        <label className="flex items-start gap-3 text-sm cursor-pointer">
          <input type="checkbox" className="mt-1 accent-white w-4 h-4" checked={privacy} onChange={e => setPrivacy(e.target.checked)} />
          <span>I agree to the <a href="/terms" target="_blank" className="underline hover:text-white">Privacy Policy &amp; Terms</a>. *</span>
        </label>
        <label className="flex items-start gap-3 text-sm cursor-pointer">
          <input type="checkbox" className="mt-1 accent-white w-4 h-4" checked={ownId} onChange={e => setOwnId(e.target.checked)} />
          <span>I confirm the uploaded university ID belongs to me. *</span>
        </label>
        <label className="flex items-start gap-3 text-sm cursor-pointer">
          <input type="checkbox" className="mt-1 accent-white w-4 h-4" checked={marketing} onChange={e => setMarketing(e.target.checked)} />
          <span className="text-luna-muted">Optional: I’d like to receive Luna Group event updates and offers.</span>
        </label>
      </div>

      {err && <p className="text-sm text-red-400">{err}</p>}
      <button className="btn-gold w-full btn-lg" disabled={loading}>
        {loading ? 'Submitting & verifying…' : 'Submit application'}
      </button>
      <p className="text-xs text-luna-muted text-center">
        University membership benefits are only available to people aged 18 or older.
      </p>
    </form>
  )
}
