'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { recallPass, rememberPass } from './remember'

/** Opens the pass saved on this phone, or finds it by email and mobile. */
export function FindPass() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [email, setEmail] = useState('')
  const [mobile, setMobile] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const t = recallPass()
    if (t) router.replace(`/offcampus/pass/${t}`)
    else setChecking(false)
  }, [router])

  async function find(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setBusy(true)
    const res = await fetch('/api/offcampus/find-pass', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, mobile }),
    }).catch(() => null)
    const data = await res?.json().catch(() => ({}))
    if (!data?.ok) {
      setErr(data?.error === 'rate_limited' ? 'Too many tries. Wait a minute and try again.'
        : 'No pass matches that email and mobile. Use the ones you registered with, or register now.')
      setBusy(false); return
    }
    rememberPass(data.pass_token)
    router.push(`/offcampus/pass/${data.pass_token}`)
  }

  if (checking) return <p style={{ color: '#B8B0CC' }}>Opening your pass…</p>
  return (
    <form onSubmit={find} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: '#B8B0CC' }}>
        Enter the email and mobile you registered with and we’ll open your pass.
      </p>
      <div>
        <label className="oc-label" htmlFor="oc-f-email">Email</label>
        <input id="oc-f-email" className="oc-input" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required />
      </div>
      <div>
        <label className="oc-label" htmlFor="oc-f-mobile">Mobile</label>
        <input id="oc-f-mobile" className="oc-input" type="tel" autoComplete="tel" value={mobile} onChange={e => setMobile(e.target.value)} required />
      </div>
      {err && <p role="alert" style={{ margin: 0, fontSize: 14, color: '#FCA5A5' }}>{err}</p>}
      <button className="oc-btn oc-btn-primary" style={{ justifyContent: 'center' }} disabled={busy}>{busy ? 'Finding…' : 'Open my pass'}</button>
      <Link href="/offcampus/register" className="oc-btn" style={{ justifyContent: 'center' }}>Not registered? Register your club</Link>
    </form>
  )
}
