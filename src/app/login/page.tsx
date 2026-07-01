'use client'
import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Logo } from '@/components/Logo'
import Link from 'next/link'

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setMsg(''); setLoading(true)
    const supabase = createClient()
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setMsg('Account created. If you are an approved promoter you now have access — signing you in…')
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      router.push(params.get('next') || '/dashboard')
      router.refresh()
    } catch (e: any) {
      setErr(e.message || 'Something went wrong'); setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-5">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8"><Logo size={40} /></div>
        <div className="card p-6">
          <h1 className="text-xl font-bold mb-1">
            {mode === 'signin' ? 'Staff & Promoter Login' : 'Create your account'}
          </h1>
          <p className="text-sm text-luna-muted mb-5">
            {mode === 'signin'
              ? 'Admins, venue managers, reception and approved promoters.'
              : 'Use the email address from your approved application.'}
          </p>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" required value={email}
                onChange={e => setEmail(e.target.value)} placeholder="you@lunagroup.com.au" />
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" required minLength={6} value={password}
                onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
            {err && <p className="text-sm text-red-400">{err}</p>}
            {msg && <p className="text-sm text-emerald-400">{msg}</p>}
            <button className="btn-gold w-full" disabled={loading}>
              {loading && <span className="w-4 h-4 rounded-full border-2 border-black/30 border-t-black animate-spin" />}
              {loading ? 'Signing you in…' : mode === 'signin' ? 'Sign in' : 'Create account & sign in'}
            </button>
          </form>
          <button onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
            className="text-sm text-luna-muted hover:text-white mt-4 w-full text-center">
            {mode === 'signin' ? 'Approved promoter? Create your login' : 'Already have an account? Sign in'}
          </button>
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
