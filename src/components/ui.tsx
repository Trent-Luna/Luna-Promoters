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
  // Active is a gold pill — how Atlas marks where you are, and the only place
  // gold appears in its navigation. Both colours read through the tokens, so on
  // guest-facing screens (where gold is still monochrome white) this stays the
  // white pill it has always been.
  return (
    <Link href={href}
      className={`shrink-0 whitespace-nowrap px-3 py-2 rounded-xl text-sm font-medium transition ${
        active
          ? 'bg-luna-gold/[0.12] text-luna-goldsoft'
          : 'text-luna-muted hover:bg-white/[0.05] hover:text-luna-text'}`}>
      {label}
    </Link>
  )
}
