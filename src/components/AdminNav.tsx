export interface NavItem { href: string; label: string; icon?: string }
export interface NavGroup { label?: string; items: NavItem[] }

/**
 * Grouped admin navigation. One source of truth: the desktop sidebar, the
 * mobile disclosure, the page eyebrow and the venue-manager sidebar are all
 * derived from this list.
 */
export const ADMIN_GROUPS: NavGroup[] = [
  {
    items: [
      { href: '/admin', label: 'Overview', icon: 'home' },
      { href: '/admin/mylink', label: 'My Link', icon: 'link' },
      { href: '/admin/summary', label: 'Weekly Summary', icon: 'chart' },
    ],
  },
  {
    label: 'Manage',
    items: [
      { href: '/admin/promoters', label: 'Promoters', icon: 'users' },
      { href: '/admin/university', label: 'University', icon: 'grad' },
      { href: '/admin/guests', label: 'Guests', icon: 'list' },
      { href: '/admin/guestlists', label: 'Guestlists', icon: 'cal' },
      { href: '/admin/events', label: 'Events', icon: 'clock' },
      { href: '/admin/whats-on', label: "What's On", icon: 'star' },
      { href: '/admin/blackout', label: 'Blackout', icon: 'ban' },
      { href: '/admin/venues', label: 'Venues', icon: 'building' },
      { href: '/admin/staff', label: 'Staff', icon: 'badge' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: '/reception', label: 'Door Check-in', icon: 'door' },
    ],
  },
  {
    label: 'Reports',
    items: [
      { href: '/admin/leaderboards', label: 'Leaderboards', icon: 'trophy' },
      { href: '/admin/exports', label: 'Exports', icon: 'download' },
    ],
  },
  {
    label: 'Settings',
    items: [
      { href: '/admin/tiers', label: 'Tiers', icon: 'sliders' },
    ],
  },
]

/**
 * Flat list of the same items, in the same order.
 *
 * IMPORTANT: AppShell decides whether to render the admin sidebar via object
 * identity — `nav === ADMIN_NAV`. This must stay a single module-level array
 * instance. Do not build a new array at call sites (e.g. `nav={[...ADMIN_NAV]}`).
 */
export const ADMIN_NAV: NavItem[] = ADMIN_GROUPS.flatMap(g => g.items)

/** The group label an href sits under — the eyebrow above a page title. */
export function groupLabelFor(href: string): string | undefined {
  return ADMIN_GROUPS.find(g => g.items.some(i => i.href === href))?.label
}

/**
 * The sidebar groups for a narrower nav (the venue manager's), derived from
 * ADMIN_GROUPS so icons, order and grouping stay identical. Items in `nav` that
 * ADMIN_GROUPS does not know (e.g. `/venue`) go in the first, unlabelled group.
 */
export function groupsFor(nav: NavItem[]): NavGroup[] {
  const known = new Set(ADMIN_NAV.map(i => i.href))
  const extra = nav.filter(i => !known.has(i.href))
  const wanted = new Set(nav.map(i => i.href))
  const groups = ADMIN_GROUPS
    .map(g => ({ label: g.label, items: g.items.filter(i => wanted.has(i.href)) }))
    .filter(g => g.items.length > 0)
  if (extra.length === 0) return groups
  if (groups[0] && !groups[0].label) return [{ items: [...extra, ...groups[0].items] }, ...groups.slice(1)]
  return [{ items: extra }, ...groups]
}

/**
 * THERE IS NO SEPARATE MOBILE NAV, AND THAT IS DELIBERATE.
 *
 * There used to be a hand-written four-item list for phones, and every page
 * added since silently failed to appear there. Both the sidebar and the mobile
 * menu render the same groups so a new page shows up in both by construction.
 * If a condensed set is ever wanted, derive it from ADMIN_GROUPS rather than
 * retyping hrefs.
 */
