'use client'
import { Logo } from '@/components/Logo'

export default function ReceptionError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-5 p-6 text-center">
      <Logo size={30} />
      <p className="text-lg font-semibold">Something went wrong on the door screen.</p>
      <p className="text-sm text-luna-muted max-w-xs">
        Tap reload to try again. You can always check guests in by searching their name — the camera isn&apos;t required.
      </p>
      <button onClick={reset} className="btn-gold">Reload</button>
    </div>
  )
}
