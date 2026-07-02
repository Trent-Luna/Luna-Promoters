'use client'
import { Logo } from '@/components/Logo'

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-5 p-6 text-center">
      <Logo size={30} />
      <p className="text-lg font-semibold">Something went wrong.</p>
      <p className="text-sm text-luna-muted">Please reload the page.</p>
      <button onClick={reset} className="btn-gold">Reload</button>
    </div>
  )
}
