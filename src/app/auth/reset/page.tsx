'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Logo } from '@/components/Logo'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [hasSession, setHasSession] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)

  // The recovery link establishes a session (via /auth/callback). Confirm we have one.
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setHasSession(!!data.user)
      setReady(true)
    })
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setMsg('')
    if (password.length < 8) { setErr('Please use at least 8 characters.'); return }
    if (password !== confirm) { setErr('Passwords don’t match.'); return }
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) { setErr(error.message || 'Could not update password.'); return }
    setMsg('Password updated. Redirecting you in…')
    setTimeout(() => { router.push('/dashboard'); router.refresh() }, 1200)
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-5">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8"><Logo size={40} /></div>
        <div className="card p-6">
          <h1 className="text-xl font-bold mb-1">Set a new password</h1>

          {!ready ? (
            <p className="text-sm text-luna-muted">Checking your reset link…</p>
          ) : !hasSession ? (
            <>
              <p className="text-sm text-luna-muted mb-4">
                This reset link isn’t active. Please open the most recent “Reset your password” email
                from Luna Group and tap the link again — it can only be used once and expires after a while.
              </p>
              <Link href="/login" className="btn-ghost w-full">Back to login</Link>
            </>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <p className="text-sm text-luna-muted">Choose a new password for your Luna Group account.</p>
              <div>
                <label className="label">New password</label>
                <input className="input" type="password" required minLength={8} value={password}
                  onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" />
              </div>
              <div>
                <label className="label">Confirm new password</label>
                <input className="input" type="password" required minLength={8} value={confirm}
                  onChange={e => setConfirm(e.target.value)} placeholder="Re-enter password" />
              </div>
              {err && <p className="text-sm text-red-400">{err}</p>}
              {msg && <p className="text-sm text-emerald-400">{msg}</p>}
              <button className="btn-gold w-full" disabled={loading}>
                {loading ? 'Updating…' : 'Update password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  )
}
