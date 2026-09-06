import Link from 'next/link'
import { tierLabel } from '@/lib/format'
import { Icon } from './icons'

export function Stat({ label, value, accent, sub, href }:
  { label: string; value: React.ReactNode; accent?: boolean; sub?: React.ReactNode; href?: string }) {
  const inner = (
    <>
      <div className={`stat-num ${accent ? 'text-luna-gold' : ''}`}>{value}</div>
      <div className="stat-lbl">{label}</div>
      {sub && <div className="text-xs text-luna-muted mt-1">{sub}</div>}
    </>
  )
  if (href) return <Link href={href} className="stat block hover:border-luna-gold/40 transition">{inner}</Link>
  return <div className="stat">{inner}</div>
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
    inactive: 'bg-zinc-500/20 text-luna-subtle',
    registered: 'bg-sky-500/15 text-sky-400', checked_in: 'bg-emerald-500/15 text-emerald-400',
    no_entry: 'bg-red-500/15 text-red-400', cancelled: 'bg-zinc-500/20 text-zinc-400',
    manual_review: 'bg-luna-gold/15 text-luna-gold', pending_verification: 'bg-amber-500/15 text-amber-400',
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
 * 14px text, a 16px stroke icon, and a gold active state on a 12% gold fill.
 */
export function SidebarLink({ href, label, icon, active }:
  { href: string; label: string; icon?: string; active: boolean }) {
  return (
    <Link href={href}
      aria-current={active ? 'page' : undefined}
      className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition ${
        active
          ? 'bg-luna-gold/[0.12] text-luna-gold'
          : 'text-luna-subtle hover:text-luna-text hover:bg-white/[0.04]'}`}>
      {icon && <Icon name={icon} size={16} className={active ? 'text-luna-gold' : 'text-luna-muted'} />}
      <span className="truncate">{label}</span>
    </Link>
  )
}

/**
 * Tab for the public shell. Inline on desktop; `bottom` renders the stacked
 * icon-over-label form used in the phone tab bar (44px+ target).
 */
export function TabLink({ href, label, icon, active, bottom = false }:
  { href: string; label: string; icon?: string; active: boolean; bottom?: boolean }) {
  if (bottom) {
    return (
      <Link href={href} aria-current={active ? 'page' : undefined}
        className={`flex-1 min-h-[52px] flex flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold transition ${
          active ? 'bg-luna-gold/[0.12] text-luna-gold' : 'text-luna-muted'}`}>
        {icon && <Icon name={icon} size={20} />}
        <span className="truncate max-w-full px-1">{label}</span>
      </Link>
    )
  }
  return (
    <Link href={href} aria-current={active ? 'page' : undefined}
      className={`inline-flex items-center gap-2 whitespace-nowrap px-3 py-2 rounded-xl text-sm font-medium transition ${
        active ? 'bg-luna-gold/[0.12] text-luna-gold' : 'text-luna-muted hover:text-luna-text hover:bg-white/[0.04]'}`}>
      {icon && <Icon name={icon} size={16} />}
      {label}
    </Link>
  )
}

/** A gold-edged callout above a table: pending queues, dormant counts, warnings. */
export function Banner({ children, tone = 'gold' }:
  { children: React.ReactNode; tone?: 'gold' | 'neutral' | 'warn' }) {
  const cls = tone === 'gold'
    ? 'border-luna-gold/35 bg-[linear-gradient(90deg,rgba(212,162,76,0.10),#17171a_55%)]'
    : tone === 'warn' ? 'border-amber-500/40 bg-amber-500/5' : 'border-white/[0.07]'
  return <div className={`card px-5 py-4 flex flex-wrap items-center gap-4 ${cls}`}>{children}</div>
}

/** Title + one-line description inside a Banner. */
export function BannerText({ title, sub }: { title: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="font-bold">{title}</div>
      {sub && <div className="text-xs text-luna-muted mt-0.5">{sub}</div>}
    </div>
  )
}

/** Filter pill wrapping a native <select> so it reads as a chip, not a form field. */
export function SelectPill({ label, value, onChange, options }:
  { label: string; value: string; onChange: (v: string) => void; options: { v: string; label: string }[] }) {
  return (
    <label className="pill bg-white/[0.07] text-luna-text/90 font-medium !py-2 !px-3 cursor-pointer relative">
      <span className="text-luna-muted">{label}:</span>
      <select
        className="bg-transparent appearance-none pr-4 outline-none cursor-pointer text-luna-text"
        value={value} onChange={e => onChange(e.target.value)}
      >
        {options.map(o => <option key={o.v} value={o.v} className="bg-luna-card">{o.label}</option>)}
      </select>
      <Icon name="chevd" size={14} className="absolute right-2.5 pointer-events-none text-luna-muted" />
    </label>
  )
}

/** Search field styled as a compact input with a leading icon. */
export function SearchInput({ value, onChange, placeholder, className = '', autoFocus = false, big = false }:
  { value: string; onChange: (v: string) => void; placeholder: string; className?: string; autoFocus?: boolean; big?: boolean }) {
  return (
    <div className={`relative ${className}`}>
      <Icon name="search" size={big ? 20 : 16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-luna-muted" />
      <input
        className={`input ${big ? '!pl-11 text-lg !min-h-[56px]' : '!pl-10 !py-2.5'}`}
        placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} autoFocus={autoFocus}
      />
    </div>
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
