import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import { ADMIN_GROUPS, ADMIN_NAV } from './AdminNav'

/**
 * One nav, not two.
 *
 * The bug this exists to prevent: the admin sidebar is hidden below `lg`, and
 * the mobile top bar rendered a separate hand-written list of four items —
 * Overview, Promoters, Guests, Door. On a phone those four were the only way to
 * reach anything, so twelve admin pages were not merely buried, they were
 * unreachable.
 *
 * The list had been correct once. It drifted because every page added to
 * ADMIN_GROUPS afterwards had to be remembered in a second place, and nothing
 * failed when it wasn't. These tests fail instead.
 */

const shell = readFileSync(path.resolve(__dirname, 'AppShell.tsx'), 'utf8')
const adminNav = readFileSync(path.resolve(__dirname, 'AdminNav.tsx'), 'utf8')

/** Strips comments, so a rule matches code rather than the prose about it. */
function codeOnly(source: string): string {
  return source
    .split('\n')
    .filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*') && !l.trim().startsWith('/*'))
    .join('\n')
}

describe('admin navigation', () => {
  it('renders the same groups on mobile as in the sidebar', () => {
    // Two occurrences: the desktop sidebar and the mobile disclosure. If either
    // stops mapping ADMIN_GROUPS, one of them is being fed from somewhere else.
    const uses = codeOnly(shell).match(/ADMIN_GROUPS\.map/g) ?? []
    expect(uses.length).toBe(2)
  })

  it('has no second navigation list to fall out of step', () => {
    const code = codeOnly(adminNav)
    // The specific thing that broke. A condensed set may exist again one day,
    // but it has to be DERIVED from ADMIN_GROUPS, not retyped as hrefs.
    expect(code).not.toMatch(/ADMIN_NAV_MOBILE/)
    const literalHrefLists = code.match(/:\s*NavItem\[\]\s*=\s*\[/g) ?? []
    expect(literalHrefLists.length).toBe(0)
  })

  it('reaches every admin page from a phone', () => {
    // Every item in the grouped nav must be in the flat nav, and the mobile
    // disclosure renders the groups — so this is the list a phone can reach.
    const grouped = ADMIN_GROUPS.flatMap(g => g.items).map(i => i.href)
    expect(ADMIN_NAV.map(i => i.href)).toEqual(grouped)

    // The twelve that were unreachable. Named explicitly, because "the counts
    // match" would still pass if somebody deleted a page from both lists.
    for (const href of [
      '/admin/mylink', '/admin/summary', '/admin/university', '/admin/guestlists',
      '/admin/whats-on', '/admin/blackout', '/admin/venues', '/admin/staff',
      '/admin/leaderboards', '/admin/exports', '/admin/tiers',
    ]) {
      expect(grouped).toContain(href)
    }
  })

  it('does not hide the mobile menu behind JavaScript', () => {
    // AppShell is a server component. A client-side drawer would need
    // hydration; a native <details> works before any JS loads, which matters
    // for a door team on a phone inside a venue.
    expect(shell).toMatch(/<details/)
    expect(shell).not.toMatch(/'use client'/)
  })

  it('keeps ADMIN_NAV a single array instance', () => {
    // AppShell decides whether to render admin chrome via `nav === ADMIN_NAV`.
    // Rebuilding the array at a call site silently loses the sidebar and the
    // "Back to Atlas" link.
    expect(ADMIN_NAV).toBe(ADMIN_NAV)
    expect(codeOnly(shell)).toMatch(/nav === ADMIN_NAV/)
  })

  it('has no duplicate hrefs', () => {
    const hrefs = ADMIN_NAV.map(i => i.href)
    expect(new Set(hrefs).size).toBe(hrefs.length)
  })
})
