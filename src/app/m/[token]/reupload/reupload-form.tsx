'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const MAX_MB = 10
const ACCEPT = '.jpg,.jpeg,.png,.webp,.heic,.heif,.pdf,image/*,application/pdf'

export function ReuploadForm({ token }: { token: string }) {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [expiry, setExpiry] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr('')
    if (!file) { setErr('Please choose a photo of your university ID.'); return }
    if (file.size > MAX_MB * 1024 * 1024) { setErr(`Please keep the file under ${MAX_MB} MB.`); return }
    setLoading(true)
    try {
      const body = new FormData()
      body.set('token', token)
      if (expiry) body.set('expiry_date', expiry)
      body.set('id_card', file)
      const res = await fetch('/api/university/reupload', { method: 'POST', body })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.ok) { setErr('Something went wrong. Please try again.'); setLoading(false); return }
      router.push(`/m/${token}`)
    } catch { setErr('Something went wrong. Please try again.'); setLoading(false) }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <label className="label">University ID expiry date <span className="text-luna-muted font-normal">(optional)</span></label>
        <input className="input" type="date" value={expiry} onChange={e => setExpiry(e.target.value)} />
      </div>
      <div className="card bg-luna-surface p-4">
        <p className="text-sm font-semibold mb-2">New photo of your university ID</p>
        <ul className="text-xs text-luna-muted list-disc pl-5 space-y-1 mb-3">
          <li>Whole card visible, text readable, no glare.</li>
          <li>Show the side with your name and expiry date.</li>
        </ul>
        <input type="file" accept={ACCEPT} onChange={e => setFile(e.target.files?.[0] || null)}
          className="block w-full text-sm text-luna-text file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-white file:text-black file:font-semibold" />
        {file && <p className="text-xs text-emerald-400 mt-2">Selected: {file.name}</p>}
      </div>
      {err && <p className="text-sm text-red-400">{err}</p>}
      <button className="btn-gold w-full btn-lg" disabled={loading}>{loading ? 'Uploading & re-checking…' : 'Submit new ID'}</button>
    </form>
  )
}
