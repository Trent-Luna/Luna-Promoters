import { Logo } from './Logo'
import { NavLink } from './ui'
import { SignOut } from './SignOut'
import { PROMOTER_NAV } from './nav'

export interface NavItem { href: string; label: string }

// Configurable Atlas home; falls back to the production URL so it is never
// missing in production. Same-tab navigation by default.
const ATLAS_URL = process.env.NEXT_PUBLIC_ATLAS_URL || 'https://atlas.lunagroup.com.au'

export function AppShell({
  nav, current, title, children, right,
}: { nav: NavItem[]; current: string; title?: string; children: React.ReactNode; right?: React.ReactNode }) {
  // Which nav a screen passes is what tells us who is looking at it. Admin,
  // reception and venue are Luna staff with Atlas accounts; the promoter portal
  // is external contractors who have none — sending them to Atlas would land
  // them on a sign-in they cannot pass, which is worse than no link at all.
  //
  // Tested as "not the promoter nav" rather than by listing the staff navs,
  // because reception builds its list inline via navForRoles() and so would
  // never match by identity. Anything new added to the signed-in shell gets the
  // link by default, which is the safer way round for this to be wrong.
  const isStaff = nav !== PROMOTER_NAV
  return (
    // `atlas-surface` swaps the whole palette to Atlas's for every signed-in
    // screen — see globals.css. It sits here rather than on the root layout so
    // the guest sign-up and guestlist pages, which are branded to match
    // lunagroup.com.au, cannot inherit it.
    <div className="atlas-surface min-h-screen">
      <header className="sticky top-0 z-30 bg-luna-bg/85 backdrop-blur border-b border-luna-border">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
          <Logo size={24} />
          {/* Top left, beside the logo — the same place the CRM, Bottle Service
              and Luna Entertainment put it, so the way out is in one position
              across every Luna app. It used to sit on the right, past the tab
              bar, which is the last place anyone looks for "back". */}
          {isStaff && (
            <a
              href={ATLAS_URL}
              className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-sm text-luna-muted transition-colors hover:bg-white/[0.05] hover:text-luna-text"
              title="Return to Luna Atlas"
            >
              <span aria-hidden>←</span>
              <span className="hidden sm:inline">Return to Atlas</span>
              <span className="sm:hidden">Atlas</span>
            </a>
          )}
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
