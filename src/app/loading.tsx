import { Logo } from '@/components/Logo'

export default function Loading() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6">
      <Logo size={34} />
      <div className="flex items-center gap-3 text-luna-muted">
        <span className="w-5 h-5 rounded-full border-2 border-white/25 border-t-white animate-spin" />
        <span className="text-sm">Loading…</span>
      </div>
    </div>
  )
}
