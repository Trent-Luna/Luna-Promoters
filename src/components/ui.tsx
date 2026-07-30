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

/**
 * Sidebar navigation row. Matches Atlas: 12px radius, 10px/12px padding,
 * 14px text, and a gold active state on a 12% gold fill.
 */
export function SidebarLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link href={href}
      aria-current={active ? 'page' : undefined}
      className={`block rounded-xl px-3 py-2.5 text-sm transition ${
        active
          ? 'bg-luna-gold/[0.12] text-luna-gold'
          : 'text-luna-subtle hover:text-luna-text hover:bg-white/[0.04]'}`}>
      {label}
    </Link>
  )
}

/**
 * Heading for a section *inside* a page. The page-level title, subtitle and
 * primary action live in AppShell.
 */
export function SectionHeader({ title, subtitle, right }:
  { title: string; subtitle?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-end gap-4 mb-3">
      <div className="min-w-0">
        <h2 className="font-bold leading-tight">{title}</h2>
        {subtitle && <p className="text-xs text-luna-muted mt-0.5">{subtitle}</p>}
      </div>
      {right && <div className="ml-auto shrink-0">{right}</div>}
    </div>
  )
}

/** Filter bar above a table — search field plus select pills. */
export function FilterRow({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2 mb-3">{children}</div>
}

/** "33 of 33 promoters" style count, sits between the filters and the table. */
export function ResultCount({ shown, total, noun }:
  { shown: number; total: number; noun: string }) {
  return (
    <p className="text-xs text-luna-muted mb-2">
      {shown === total ? `${total} ${noun}` : `${shown} of ${total} ${noun}`}
    </p>
  )
}

/** Table column header cell. */
export function Th({ children, className = '' }:
  { children?: React.ReactNode; className?: string }) {
  return (
    <th className={`text-left font-medium text-xs text-luna-muted pb-2 px-3 ${className}`}>
      {children}
    </th>
  )
}

/** Table body cell. */
export function Td({ children, className = '' }:
  { children?: React.ReactNode; className?: string }) {
  return <td className={`py-2.5 px-3 align-middle ${className}`}>{children}</td>
}

/** Bold primary value with a muted secondary line underneath. */
export function CellStack({ primary, secondary }:
  { primary: React.ReactNode; secondary?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="font-semibold truncate">{primary}</div>
      {secondary && <div className="text-xs text-luna-muted truncate">{secondary}</div>}
    </div>
  )
}

/** Neutral tag pill for multi-value columns. */
export function Tag({ children }: { children: React.ReactNode }) {
  return <span className="pill bg-white/[0.07] text-luna-text/90 font-medium">{children}</span>
}

/** Row of tags, capped with a "+N" overflow marker. */
export function TagList({ items, max = 3 }: { items: string[]; max?: number }) {
  if (!items || items.length === 0) return <span className="text-luna-muted">—</span>
  const shown = items.slice(0, max)
  const rest = items.length - shown.length
  return (
    <div className="flex flex-wrap items-center gap-1">
      {shown.map(t => <Tag key={t}>{t}</Tag>)}
      {rest > 0 && <span className="text-xs text-luna-muted">+{rest}</span>}
    </div>
  )
}

/** Empty-state row spanning a table. */
export function EmptyRow({ colSpan, children }:
  { colSpan: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-8 text-center text-sm text-luna-muted">{children}</td>
    </tr>
  )
}
