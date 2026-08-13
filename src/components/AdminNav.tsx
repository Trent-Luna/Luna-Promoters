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

/**
 * THERE IS NO SEPARATE MOBILE NAV, AND THAT IS DELIBERATE.
 *
 * There used to be: a hand-written `ADMIN_NAV_MOBILE` of four items — Overview,
 * Promoters, Guests, Door. The sidebar is hidden below `lg`, so on a phone those
 * four were the ONLY way to reach anything, and the other twelve admin pages —
 * My Link, Weekly Summary, University, Guestlists, What's On, Blackout, Venues,
 * Staff, Leaderboards, Exports, Tiers — were unreachable. Not hidden behind a
 * menu: absent. An admin on their phone could not open them at all.
 *
 * The deeper problem was that it was a SECOND list. Every page added to
 * ADMIN_GROUPS since it was written silently failed to appear on mobile, and
 * nothing anywhere would have caught that. So the fix is not to lengthen the
 * second list, it is to delete it: mobile now renders ADMIN_GROUPS, the same
 * source the sidebar uses, and a new page appears in both by construction.
 *
 * If a condensed set is ever wanted again, derive it from ADMIN_GROUPS
 * (e.g. `ADMIN_GROUPS[0].items`) rather than retyping hrefs.
 */
