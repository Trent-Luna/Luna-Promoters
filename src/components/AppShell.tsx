import { Logo } from './Logo'
import { NavLink, SidebarLink } from './ui'
import { SignOut } from './SignOut'
import { ADMIN_NAV, ADMIN_GROUPS, ADMIN_NAV_MOBILE } from './AdminNav'

export interface NavItem { href: string; label: string }

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
      <span aria-hidden>←</span> Back to Atlas
    </a>
  )
}

/**
 * Admin chrome: persistent left sidebar on desktop, condensed top bar on
 * mobile. Mirrors the Luna Entertainment (DJ) admin shell.
 */
function AdminShell({
  current, title, subtitle, children, right,
}: {
  current: string; title?: string; subtitle?: React.ReactNode
  children: React.ReactNode; right?: React.ReactNode
}) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      {/* ---------- desktop sidebar (Atlas: 240px, #0e0e10) ---------- */}
      <aside className="hidden lg:flex lg:flex-col lg:sticky lg:top-0 lg:h-screen border-r border-white/[0.07] bg-luna-surface">
        <div className="px-5 py-5">
          <a href="/admin" className="block">
            <Logo size={22} />
          </a>
          <div className="eyebrow mt-1.5">Promoters</div>
        </div>

        {/* Back to Atlas sits directly above the first nav item */}
        <div className="px-3 pb-3">
          <AtlasLink className="w-full justify-start" />
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4 space-y-5">
          {ADMIN_GROUPS.map((group, i) => (
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
        </nav>

        <div className="border-t border-white/[0.07] px-4 py-3">
          <SignOut />
        </div>
      </aside>

      <div className="min-w-0 flex flex-col">
        {/* ---------- top bar (Atlas: 64px, hairline rule) ---------- */}
        <header className="sticky top-0 z-30 h-16 flex items-center gap-3 px-4 lg:px-10
                           bg-luna-bg/90 backdrop-blur border-b border-white/[0.07]">
          <div className="lg:hidden"><Logo size={20} /></div>
          {title && (
            <span className="hidden lg:block text-sm font-medium text-luna-text truncate">
              {title}
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            <div className="lg:hidden"><AtlasLink /></div>
            <div className="lg:hidden"><SignOut /></div>
          </div>
        </header>

        {/* condensed nav, mobile only */}
        <nav className="lg:hidden px-2 py-2 flex flex-wrap items-center gap-1.5
                        border-b border-white/[0.07]">
          {ADMIN_NAV_MOBILE.map(n => (
            <NavLink key={n.href} {...n} active={current === n.href} />
          ))}
        </nav>

        {/* ---------- content (Atlas: max 1280px, 32/40 padding) ---------- */}
        <main className="min-w-0 w-full max-w-atlas mx-auto px-4 sm:px-6 lg:px-10 py-6 lg:py-8">
          {(title || right) && (
            <div className="flex items-start gap-4 mb-6">
              <div className="min-w-0">
                {title && <h1 className="text-2xl font-bold leading-tight">{title}</h1>}
                {subtitle && <p className="text-sm text-luna-muted mt-1">{subtitle}</p>}
              </div>
              {right && <div className="ml-auto flex items-center gap-2 shrink-0">{right}</div>}
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  )
}

/** Original centred top-tab chrome: promoter portal and public pages. */
function PublicShell({
  nav, current, title, children, right,
}: { nav: NavItem[]; current: string; title?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 bg-luna-bg/85 backdrop-blur border-b border-luna-border">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
          <Logo size={24} />
          <div className="ml-auto flex items-center gap-2">
            {right}<SignOut />
          </div>
        </div>
        {/* tab bar wraps onto multiple rows instead of scrolling horizontally */}
        <nav className="max-w-6xl mx-auto px-2 sm:px-3 pb-2 flex flex-wrap items-center gap-1.5">
          {nav.map(n => <NavLink key={n.href} {...n} active={current === n.href} />)}
        </nav>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">
        {title && <h1 className="text-xl sm:text-2xl font-extrabold mb-5">{title}</h1>}
        {children}
      </main>
    </div>
  )
}

export function AppShell({
  nav, current, title, subtitle, children, right,
}: {
  nav: NavItem[]; current: string; title?: string; subtitle?: React.ReactNode
  children: React.ReactNode; right?: React.ReactNode
}) {
  // Only the admin experience (which passes the shared ADMIN_NAV) gets the
  // sidebar and the "Back to Atlas" action — never public sign-up or the
  // promoter portal. See the note on ADMIN_NAV: this is an identity check.
  if (nav === ADMIN_NAV) {
    return (
      <AdminShell current={current} title={title} subtitle={subtitle} right={right}>
        {children}
      </AdminShell>
    )
  }
  return (
    <PublicShell nav={nav} current={current} title={title} right={right}>
      {children}
    </PublicShell>
  )
}
