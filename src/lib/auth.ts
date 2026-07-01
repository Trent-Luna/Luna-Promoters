import { createClient } from '@/lib/supabase/server'

export type Role = 'admin' | 'venue_manager' | 'reception' | 'promoter'

export interface SessionInfo {
  userId: string
  email: string
  roles: Role[]
  venueIds: string[]     // scoped venues for manager/reception
  promoterId: string | null
}

/** Load the current user's profile, roles and scope. Returns null if signed out. */
export async function getSession(): Promise<SessionInfo | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: roleRows } = await supabase
    .from('roles').select('role, venue_id').eq('user_id', user.id)
  const { data: prom } = await supabase
    .from('promoters').select('id').eq('user_id', user.id).maybeSingle()

  const roles = [...new Set((roleRows ?? []).map(r => r.role))] as Role[]
  const venueIds = [...new Set((roleRows ?? [])
    .filter(r => r.venue_id).map(r => r.venue_id as string))]

  return {
    userId: user.id,
    email: user.email ?? '',
    roles,
    venueIds,
    promoterId: prom?.id ?? null,
  }
}

export function hasRole(s: SessionInfo | null, ...roles: Role[]) {
  return !!s && roles.some(r => s.roles.includes(r))
}

/** Default landing route for a signed-in user based on their highest role. */
export function homeForRoles(roles: Role[]): string {
  if (roles.includes('admin')) return '/admin'
  if (roles.includes('venue_manager')) return '/venue'
  if (roles.includes('reception')) return '/reception'
  if (roles.includes('promoter')) return '/promoter'
  return '/login'
}
