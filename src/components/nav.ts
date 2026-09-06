import type { Role } from '@/lib/auth'
import { ADMIN_NAV, type NavItem } from './AdminNav'

/** Venue managers: their own overview plus the admin pages they may use. */
export const VENUE_NAV: NavItem[] = [
  { href: '/venue', label: 'Overview', icon: 'home' },
  { href: '/admin/mylink', label: 'My Link', icon: 'link' },
  { href: '/admin/guestlists', label: 'Guestlists', icon: 'cal' },
  { href: '/admin/events', label: 'Events', icon: 'clock' },
  { href: '/admin/blackout', label: 'Blackout', icon: 'ban' },
  { href: '/admin/whats-on', label: "What's On", icon: 'star' },
  { href: '/reception', label: 'Door Check-in', icon: 'door' },
  { href: '/admin/leaderboards', label: 'Leaderboards', icon: 'trophy' },
  { href: '/admin/exports', label: 'Exports', icon: 'download' },
]

export const PROMOTER_NAV: NavItem[] = [
  { href: '/promoter', label: 'Dashboard', icon: 'home' },
  { href: '/promoter/whats-on', label: "What's On", icon: 'star' },
]

export const RECEPTION_NAV: NavItem[] = [
  { href: '/reception', label: 'Door Check-in', icon: 'door' },
]

export function navForRoles(roles: Role[]): NavItem[] {
  if (roles.includes('admin')) return ADMIN_NAV
  if (roles.includes('venue_manager')) return VENUE_NAV
  if (roles.includes('reception')) return RECEPTION_NAV
  return PROMOTER_NAV
}

/** Human label for the signed-in footer. */
export function roleLabel(roles: Role[]): string {
  if (roles.includes('admin')) return 'Admin'
  if (roles.includes('venue_manager')) return 'Venue manager'
  if (roles.includes('reception')) return 'Door'
  if (roles.includes('promoter')) return 'Promoter'
  return 'Signed in'
}
