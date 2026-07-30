export interface NavItem { href: string; label: string }
export interface NavGroup { label?: string; items: NavItem[] }

/**
 * Grouped admin navigation, mirroring the Luna Entertainment (DJ) admin sidebar:
 * a short ungrouped set at the top, then labelled sections.
 */
export const ADMIN_GROUPS: NavGroup[] = [
  {
    items: [
      { href: '/admin', label: 'Overview' },
      { href: '/admin/mylink', label: 'My Link' },
      { href: '/admin/summary', label: 'Weekly Summary' },
    ],
  },
  {
    label: 'Manage',
    items: [
      { href: '/admin/promoters', label: 'Promoters' },
      { href: '/admin/university', label: 'University' },
      { href: '/admin/guests', label: 'Guests' },
      { href: '/admin/guestlists', label: 'Guestlists' },
      { href: '/admin/whats-on', label: "What's On" },
      { href: '/admin/blackout', label: 'Blackout' },
      { href: '/admin/venues', label: 'Venues' },
      { href: '/admin/staff', label: 'Staff' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: '/reception', label: 'Door Check-in' },
    ],
  },
  {
    label: 'Reports',
    items: [
      { href: '/admin/leaderboards', label: 'Leaderboards' },
      { href: '/admin/exports', label: 'Exports' },
    ],
  },
  {
    label: 'Settings',
    items: [
      { href: '/admin/tiers', label: 'Tiers' },
    ],
  },
]

/**
 * Flat list of the same items, in the same order.
 *
 * IMPORTANT: AppShell decides whether to render admin-only chrome (the sidebar
 * and the "Back to Atlas" link) via object identity — `nav === ADMIN_NAV`.
 * This must stay a single module-level array instance. Do not build a new array
 * at call sites (e.g. `nav={[...ADMIN_NAV]}`) or that check silently fails and
 * admins lose both the sidebar and the link back to Atlas.
 */
export const ADMIN_NAV: NavItem[] = ADMIN_GROUPS.flatMap(g => g.items)

/** Condensed set for the mobile top bar, where the sidebar is hidden. */
export const ADMIN_NAV_MOBILE: NavItem[] = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/promoters', label: 'Promoters' },
  { href: '/admin/guests', label: 'Guests' },
  { href: '/reception', label: 'Door' },
]
