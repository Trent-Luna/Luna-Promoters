import type { Role } from '@/lib/auth'
import { ADMIN_NAV } from './AdminNav'

export const VENUE_NAV = [
  { href: '/venue', label: 'Overview' },
  { href: '/admin/mylink', label: 'My Link' },
  { href: '/admin/guestlists', label: 'Guestlists' },
  { href: '/admin/blackout', label: 'Blackout' },
  { href: '/reception', label: 'Door Check-in' },
  { href: '/admin/leaderboards', label: 'Leaderboards' },
  { href: '/admin/exports', label: 'Exports' },
]

export function navForRoles(roles: Role[]) {
  if (roles.includes('admin')) return ADMIN_NAV
  if (roles.includes('venue_manager')) return VENUE_NAV
  if (roles.includes('reception')) return [{ href: '/reception', label: 'Door Check-in' }]
  return [{ href: '/promoter', label: 'Dashboard' }]
}
