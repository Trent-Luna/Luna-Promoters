import { Logo } from './Logo'
import { NavLink } from './ui'
import { SignOut } from './SignOut'

export interface NavItem { href: string; label: string }

export function AppShell({
  nav, current, title, children, right,
}: { nav: NavItem[]; current: string; title?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 bg-luna-bg/85 backdrop-blur border-b border-luna-border">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
          <Logo size={24} />
          <div className="ml-auto flex items-center gap-2">{right}<SignOut /></div>
        </div>
        {/* one scrollable tab bar — consistent on phone, iPad and desktop */}
        <nav className="max-w-6xl mx-auto px-2 sm:px-3 pb-2 flex items-center gap-1 overflow-x-auto no-scrollbar">
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
