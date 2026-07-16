'use client'
import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Logo } from '@/components/Logo'
import Link from 'next/link'

type Mode = 'signin' | 'signup' | 'reset'

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<Mode>('signin')
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setMsg(''); setLoading(true)
    const supabase = createClient()
    try {
      if (mode === 'reset') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset`,
        })
        if (error) throw error
        setMsg('If an account exists for that email, we’ve sent a password reset link. Check your inbox (and spam).')
        setLoading(false)
        return
      }
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        })
        if (error) throw error
        setMsg('Account created! Please check your email and tap the confirmation link to activate your account, then come back here and sign in.')
        setMode('signin')
        setLoading(false)
        return
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        if ((error.message || '').toLowerCase().includes('confirm')) {
          setErr('Please confirm your email first — check your inbox (and spam) for the confirmation link.')
          setLoading(false); return
        }
        throw error
      }
      router.push(params.get('next') || '/dashboard')
      router.refresh()
    } catch (e: any) {
      setErr(e.message || 'Something went wrong'); setLoading(false)
    }
  }

  const heading = mode === 'signin' ? 'Staff & Promoter Login'
    : mode === 'signup' ? 'Create your account' : 'Reset your password'
  const subtext = mode === 'signin' ? 'Admins, venue managers, reception and approved promoters.'
    : mode === 'signup' ? 'Use the email address from your approved application. You’ll get a confirmation email to activate your account.'
    : 'Enter your account email and we’ll send you a secure link to set a new password.'
  const cta = loading ? 'Please wait…' : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'

  return (
    <main className="min-h-screen flex items-center justify-center p-5">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8"><Logo size={40} /></div>
        <div className="card p-6">
          <h1 className="text-xl font-bold mb-1">{heading}</h1>
          <p className="text-sm text-luna-muted mb-5">{subtext}</p>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" required value={email}
                onChange={e => setEmail(e.target.value)} placeholder="you@lunagroup.com.au" />
            </div>
            {mode !== 'reset' && (
              <div>
                <label className="label">Password</label>
                <input className="input" type="password" required minLength={6} value={password}
                  onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
                {mode === 'signin' && (
                  <button type="button" onClick={() => { setMode('reset'); setErr(''); setMsg('') }}
                    className="text-xs text-luna-muted hover:text-white mt-2">
                    Forgot your password?
                  </button>
                )}
              </div>
            )}
            {err && <p className="text-sm text-red-400">{err}</p>}
            {msg && <p className="text-sm text-emerald-400">{msg}</p>}
            <button className="btn-gold w-full" disabled={loading}>
              {loading && <span className="w-4 h-4 rounded-full border-2 border-black/30 border-t-black animate-spin" />}
              {cta}
            </button>
          </form>

          {mode === 'reset' ? (
            <button onClick={() => { setMode('signin'); setErr(''); setMsg('') }}
              className="text-sm text-luna-muted hover:text-white mt-4 w-full text-center">
              ← Back to sign in
            </button>
          ) : (
            <button onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setErr(''); setMsg('') }}
              className="text-sm text-luna-muted hover:text-white mt-4 w-full text-center">
              {mode === 'signin' ? 'Approved promoter? Create your login' : 'Already have an account? Sign in'}
            </button>
          )}
        </div>
        <p className="text-center text-sm text-luna-muted mt-6">
          Want to become a promoter?{' '}
          <Link href="/" className="text-white font-medium">Apply here</Link>
        </p>
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="min-h-screen" />}>
      <LoginForm />
    </Suspense>
  )
}
