import { Logo } from './Logo'
import { NavLink } from './ui'
import { SignOut } from './SignOut'
import { ADMIN_NAV } from './AdminNav'

export interface NavItem { href: string; label: string }

// Configurable Atlas home; falls back to the production URL so it is never
// missing in production. Same-tab navigation by default.
const ATLAS_URL = process.env.NEXT_PUBLIC_ATLAS_URL || 'https://atlas.lunagroup.com.au'

export function AppShell({
  nav, current, title, children, right,
}: { nav: NavItem[]; current: string; title?: string; children: React.ReactNode; right?: React.ReactNode }) {
  // Only the admin experience (which passes the shared ADMIN_NAV) gets the
  // "Return to Atlas" action — never public sign-up or promoter portal pages.
  const isAdmin = nav === ADMIN_NAV
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 bg-luna-bg/85 backdrop-blur border-b border-luna-border">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
          <Logo size={24} />
          <div className="ml-auto flex items-center gap-2">
            {isAdmin && (
              <a
                href={ATLAS_URL}
                className="inline-flex items-center gap-1 rounded-lg border border-luna-border px-2.5 py-1.5 text-sm text-luna-muted hover:text-white"
                title="Return to Luna Atlas"
              >
                <span aria-hidden>←</span> Return to Atlas
              </a>
            )}
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
