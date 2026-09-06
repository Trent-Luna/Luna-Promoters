import { Logo } from './Logo'
import { SidebarLink, TabLink } from './ui'
import { SignOut } from './SignOut'
import { Icon } from './icons'
import { SearchBox } from './SearchBox'
import { ADMIN_NAV, ADMIN_GROUPS, groupsFor, groupLabelFor, type NavGroup, type NavItem } from './AdminNav'
import { VENUE_NAV, roleLabel } from './nav'
import { getSession } from '@/lib/auth'

export type { NavItem }

/**
 * The label for the page you are on, for the collapsed mobile menu. Falls back
 * to "Menu" rather than an empty string: an href that is not in the nav (a
 * detail page, say) is a normal thing to be looking at.
 */
function currentLabel(nav: NavItem[], current: string): string {
  return nav.find(n => n.href === current)?.label ?? 'Menu'
}

// Configurable Atlas home; falls back to the production URL so it is never
// missing in production. Same-tab navigation by default.
const ATLAS_URL = process.env.NEXT_PUBLIC_ATLAS_URL || 'https://atlas.lunagroup.com.au'

function AtlasLink({ className = '' }: { className?: string }) {
  return (
    <a
      href={ATLAS_URL}
      className={`inline-flex items-center gap-1.5 rounded-lg border border-luna-border px-2.5 py-1.5 text-sm text-luna-muted hover:text-white hover:border-white/30 transition ${className}`}
      title="Back to Luna Atlas"
    >
      <Icon name="back" size={14} /> Back to Atlas
    </a>
  )
}

/** The grouped nav rows. Rendered twice — sidebar and mobile menu — from ONE list. */
function NavGroups({ groups, current }: { groups: NavGroup[]; current: string }) {
  return (
    <>
      {groups.map((group, i) => (
        <div key={group.label ?? `group-${i}`} className="space-y-0.5">
          {group.label && (
            <div className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-luna-muted/70">
              {group.label}
            </div>
          )}
          {group.items.map(item => (
            <SidebarLink key={item.href} {...item} active={current === item.href} />
          ))}
        </div>
      ))}
    </>
  )
}

function Initials({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const txt = (parts.length >= 2 ? parts[0][0] + parts[parts.length - 1][0] : name.slice(0, 2)).toUpperCase()
  return (
    <div className="w-7 h-7 rounded-full bg-luna-gold/15 text-luna-gold text-[11px] font-bold flex items-center justify-center shrink-0">
      {txt || '·'}
    </div>
  )
}

/**
 * Sidebar chrome — admins and venue managers. Persistent 240px sidebar on
 * desktop, a native <details> menu on phones (no JS needed; matters for a
 * manager on a phone in a venue basement). Mirrors Atlas: #0e0e10 sidebar,
 * 64px top bar, hairline rules, gold active state.
 */
async function SidebarShell({
  nav, groups, current, title, subtitle, eyebrow, children, right,
}: {
  nav: NavItem[]; groups: NavGroup[]; current: string
  title?: string; subtitle?: React.ReactNode; eyebrow?: string
  children: React.ReactNode; right?: React.ReactNode
}) {
  const s = await getSession()
  const isAdmin = !!s?.roles.includes('admin')
  const name = s?.fullName || s?.email?.split('@')[0] || 'Signed in'
  const eyebrowText = eyebrow ?? (nav === ADMIN_NAV ? groupLabelFor(current) : undefined)

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      {/* ---------- desktop sidebar ---------- */}
      <aside className="hidden lg:flex lg:flex-col lg:sticky lg:top-0 lg:h-screen border-r border-white/[0.07] bg-luna-surface">
        <div className="px-5 pt-5 pb-3">
          <a href={nav === ADMIN_NAV ? '/admin' : '/venue'} className="block">
            <Logo size={22} />
          </a>
          <div className="eyebrow mt-1.5">Promoters</div>
        </div>

        <div className="px-3 pb-3">
          <AtlasLink className="w-full justify-start" />
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4 space-y-5">
          <NavGroups groups={groups} current={current} />
        </nav>

        <div className="border-t border-white/[0.07] px-4 py-3 flex items-center gap-2.5">
          <Initials name={name} />
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold truncate">{name}</div>
            <div className="text-xs text-luna-muted truncate">{roleLabel(s?.roles ?? [])} · via Atlas</div>
          </div>
          <SignOut icon />
        </div>
      </aside>

      <div className="min-w-0 flex flex-col">
        {/* ---------- top bar ---------- */}
        <header className="sticky top-0 z-30 h-16 flex items-center gap-3 px-4 lg:px-10
                           bg-luna-bg/90 backdrop-blur border-b border-white/[0.07]">
          <div className="lg:hidden"><Logo size={20} /></div>
          {title && (
            <span className="hidden lg:block text-sm font-medium text-luna-text truncate">
              {title}
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            {isAdmin && <div className="hidden md:block"><SearchBox /></div>}
            <div className="lg:hidden"><AtlasLink /></div>
            <div className="lg:hidden"><SignOut /></div>
          </div>
        </header>

        {/* ---------- mobile nav: a native disclosure, no hydration needed ---------- */}
        <details className="lg:hidden border-b border-white/[0.07] group">
          <summary
            className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm
                       text-luna-text marker:hidden [&::-webkit-details-marker]:hidden"
          >
            <Icon name="menu" size={16} className="text-luna-muted" />
            <span className="font-medium truncate">{currentLabel(nav, current)}</span>
            <span aria-hidden className="ml-auto text-luna-muted transition-transform group-open:rotate-180">
              <Icon name="chevd" size={16} />
            </span>
          </summary>
          <nav className="px-2 pb-3 space-y-4">
            <NavGroups groups={groups} current={current} />
          </nav>
        </details>

        {/* ---------- content (Atlas: max 1280px, 32/40 padding) ---------- */}
        <main className="min-w-0 w-full max-w-atlas mx-auto px-4 sm:px-6 lg:px-10 py-6 lg:py-8">
          {(title || right) && (
            <div className="flex items-start gap-4 mb-6">
              <div className="min-w-0">
                {eyebrowText && <div className="eyebrow mb-1">{eyebrowText}</div>}
                {title && <h1 className="text-2xl font-bold leading-tight">{title}</h1>}
                {subtitle && <p className="text-sm text-luna-muted mt-1">{subtitle}</p>}
              </div>
              {right && <div className="ml-auto flex items-center gap-2 shrink-0 flex-wrap justify-end">{right}</div>}
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  )
}

/**
 * Public chrome: the promoter portal and the door. Top tabs on desktop, a
 * bottom tab bar on phones — thumbs live at the bottom of the screen and the
 * old wrapping tab strip pushed content down every time a tab was added.
 */
function PublicShell({
  nav, current, title, subtitle, children, right,
}: { nav: NavItem[]; current: string; title?: string; subtitle?: React.ReactNode; children: React.ReactNode; right?: React.ReactNode }) {
  const tabs = nav.length > 1
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 bg-luna-bg/85 backdrop-blur border-b border-white/[0.07]">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
          <Logo size={24} />
          {tabs && (
            <nav className="hidden sm:flex items-center gap-1 ml-4">
              {nav.map(n => <TabLink key={n.href} {...n} active={current === n.href} />)}
            </nav>
          )}
          <div className="ml-auto flex items-center gap-2">
            {right}<SignOut />
          </div>
        </div>
      </header>
      <main className={`max-w-6xl mx-auto px-4 py-6 ${tabs ? 'pb-28 sm:pb-6' : ''}`}>
        {title && (
          <div className="mb-5">
            <h1 className="text-xl sm:text-2xl font-extrabold leading-tight">{title}</h1>
            {subtitle && <p className="text-sm text-luna-muted mt-1">{subtitle}</p>}
          </div>
        )}
        {children}
      </main>
      {tabs && (
        <nav className="sm:hidden fixed bottom-0 inset-x-0 z-30 bg-luna-surface/95 backdrop-blur border-t border-white/[0.07]
                        flex px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] gap-1">
          {nav.map(n => <TabLink key={n.href} {...n} active={current === n.href} bottom />)}
        </nav>
      )}
    </div>
  )
}

export function AppShell({
  nav, current, title, subtitle, eyebrow, children, right,
}: {
  nav: NavItem[]; current: string; title?: string; subtitle?: React.ReactNode; eyebrow?: string
  children: React.ReactNode; right?: React.ReactNode
}) {
  // The admin and venue-manager experiences get the sidebar; never public sign-up
  // or the promoter portal. `nav === ADMIN_NAV` is an identity check on purpose —
  // see the note on ADMIN_NAV.
  if (nav === ADMIN_NAV || nav === VENUE_NAV) {
    const groups = nav === ADMIN_NAV ? ADMIN_GROUPS : groupsFor(nav)
    return (
      <SidebarShell nav={nav} groups={groups} current={current} title={title} subtitle={subtitle} eyebrow={eyebrow} right={right}>
        {children}
      </SidebarShell>
    )
  }
  return (
    <PublicShell nav={nav} current={current} title={title} subtitle={subtitle} right={right}>
      {children}
    </PublicShell>
  )
}
