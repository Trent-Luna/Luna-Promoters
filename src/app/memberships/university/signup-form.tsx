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
    <form onSubmit={submit} className="space-y-[18px]">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="label text-[13px] font-bold text-white/90">Full name *</label>
          <input className="input h-[54px] rounded-xl border-white/15 bg-[#0B0C10] px-4 text-base font-semibold text-white placeholder:text-white/30 focus:border-[#E7C873] focus:ring-4 focus:ring-[#E7C873]/15 [color-scheme:dark]" required value={f.full_name} onChange={e => set('full_name', e.target.value)} />
        </div>
        <div>
          <label className="label text-[13px] font-bold text-white/90">Mobile number *</label>
          <input className="input h-[54px] rounded-xl border-white/15 bg-[#0B0C10] px-4 text-base font-semibold text-white placeholder:text-white/30 focus:border-[#E7C873] focus:ring-4 focus:ring-[#E7C873]/15 [color-scheme:dark]" required type="tel" placeholder="04xx xxx xxx"
            value={f.mobile} onChange={e => set('mobile', e.target.value)} />
        </div>
        <div>
          <label className="label text-[13px] font-bold text-white/90">Email address *</label>
          <input className="input h-[54px] rounded-xl border-white/15 bg-[#0B0C10] px-4 text-base font-semibold text-white placeholder:text-white/30 focus:border-[#E7C873] focus:ring-4 focus:ring-[#E7C873]/15 [color-scheme:dark]" required type="email" value={f.email} onChange={e => set('email', e.target.value)} />
        </div>
        <div>
          <label className="label text-[13px] font-bold text-white/90">Date of birth * <span className="text-white/45 font-normal">(must be 18+)</span></label>
          <input className="input h-[54px] rounded-xl border-white/15 bg-[#0B0C10] px-4 text-base font-semibold text-white placeholder:text-white/30 focus:border-[#E7C873] focus:ring-4 focus:ring-[#E7C873]/15 [color-scheme:dark]" required type="date" max={today} value={f.dob} onChange={e => set('dob', e.target.value)} />
        </div>
        <div>
          <label className="label text-[13px] font-bold text-white/90">University ID expiry date *</label>
          <input className="input h-[54px] rounded-xl border-white/15 bg-[#0B0C10] px-4 text-base font-semibold text-white placeholder:text-white/30 focus:border-[#E7C873] focus:ring-4 focus:ring-[#E7C873]/15 [color-scheme:dark]" required type="date" value={f.expiry_date} onChange={e => set('expiry_date', e.target.value)} />
        </div>
      </div>

      <div className="rounded-[14px] border-[1.5px] border-dashed border-[#E7C873]/45 bg-[#E7C873]/[0.04] p-5">
        <p className="text-[13px] font-bold text-white/90 mb-3">Upload your current university ID *</p>
        <ul className="mb-4 grid grid-cols-1 gap-2 text-[12.5px] text-white/65 sm:grid-cols-2 [&>li]:rounded-[10px] [&>li]:border [&>li]:border-white/[0.09] [&>li]:bg-[#0B0C10] [&>li]:px-3 [&>li]:py-2.5">
          <li>Make sure the whole card is visible and the text is readable.</li>
          <li>Avoid glare and shadows.</li>
          <li>Upload the side showing your name and the expiry date.</li>
          <li>Don’t upload a different ID (e.g. licence or passport).</li>
        </ul>
        <input type="file" accept={ACCEPT} onChange={pickFile}
          className="block w-full text-sm text-luna-text file:mr-3 file:py-2.5 file:px-5 file:rounded-full file:border-0 file:bg-[#E7C873] file:text-[#07080B] file:font-extrabold file:cursor-pointer" />
        {file && <p className="text-[13px] font-bold text-[#E7C873] mt-2">Selected: {file.name}</p>}
        <p className="text-[12px] text-white/45 mt-2">JPG, PNG, WEBP, HEIC or PDF · up to {MAX_MB} MB. Stored securely and never shared publicly.</p>
      </div>

      <div className="space-y-3 pt-1">
        <label className="flex items-start gap-3 text-[14.5px] text-white/90 cursor-pointer">
          <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-[#E7C873]" checked={privacy} onChange={e => setPrivacy(e.target.checked)} />
          <span>I agree to the <a href="/terms" target="_blank" className="text-[#E7C873] underline hover:text-white">Privacy Policy &amp; Terms</a>. *</span>
        </label>
        <label className="flex items-start gap-3 text-[14.5px] text-white/90 cursor-pointer">
          <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-[#E7C873]" checked={ownId} onChange={e => setOwnId(e.target.checked)} />
          <span>I confirm the uploaded university ID belongs to me. *</span>
        </label>
        <label className="flex items-start gap-3 text-[14.5px] text-white/90 cursor-pointer">
          <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-[#E7C873]" checked={marketing} onChange={e => setMarketing(e.target.checked)} />
          <span className="text-white/65">Optional: I’d like to receive Luna Group event updates and offers.</span>
        </label>
      </div>

      {err && <p className="text-sm text-red-400">{err}</p>}
      <button className="btn-gold w-full btn-lg mt-2 rounded-full !bg-[#E7C873] py-5 text-[17px] font-extrabold text-[#07080B] shadow-[0_10px_40px_-10px_rgba(231,200,115,.55)] hover:!bg-[#efd690]" disabled={loading}>
        {loading ? 'Submitting & verifying…' : 'Submit application'}
      </button>
      <p className="text-[13px] text-white/45 text-center">
        University membership benefits are only available to people aged 18 or older.
      </p>
    </form>
  )
}
