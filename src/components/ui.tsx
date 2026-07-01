import Link from 'next/link'
import { tierLabel } from '@/lib/format'

export function Stat({ label, value, accent }: { label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <div className="stat">
      <div className={`stat-num ${accent ? 'text-luna-gold' : ''}`}>{value}</div>
      <div className="stat-lbl">{label}</div>
    </div>
  )
}

export function TierBadge({ tier }: { tier: string }) {
  const map: Record<string, string> = {
    bronze: 'bg-[#cd7f32]/15 tier-bronze', silver: 'bg-[#c0c0c0]/15 tier-silver',
    gold: 'bg-luna-gold/15 tier-gold', elite: 'bg-[#b28dff]/15 tier-elite',
  }
  return <span className={`pill ${map[tier] ?? map.bronze}`}>{tierLabel(tier)}</span>
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: 'bg-amber-500/15 text-amber-400', approved: 'bg-emerald-500/15 text-emerald-400',
    rejected: 'bg-red-500/15 text-red-400', suspended: 'bg-zinc-500/20 text-zinc-300',
    registered: 'bg-sky-500/15 text-sky-400', checked_in: 'bg-emerald-500/15 text-emerald-400',
    no_entry: 'bg-red-500/15 text-red-400',
  }
  return <span className={`pill ${map[status] ?? 'bg-luna-border text-luna-muted'}`}>{status.replace('_', ' ')}</span>
}
export function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link href={href}
      className={`shrink-0 whitespace-nowrap px-3 py-2 rounded-lg text-sm font-medium transition ${
        active ? 'bg-white/12 text-white' : 'text-luna-muted hover:text-luna-text'}`}>
      {label}
    </Link>
  )
}
