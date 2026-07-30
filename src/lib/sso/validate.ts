// ============================================================================
// Atlas SSO — pure validation and mapping for the Promoters callback.
//
// No fetch, no DB, no next/* imports, so every rule below is unit-testable in
// isolation. Mirrors the equivalent modules in Reservations and the CRM.
// ============================================================================

/** The one-time code Atlas issues: 32 random bytes, hex encoded. */
export function isValidCode(code: string | null | undefined): boolean {
  return typeof code === 'string' && /^[0-9a-f]{64}$/.test(code)
}

/** Where a successful sign-in lands when Atlas supplied no return path. */
export const DEFAULT_LANDING = '/admin'

/**
 * A safe return path is a same-origin relative path and nothing else.
 *
 * Atlas validates this when the code is issued and the exchange returns the
 * stored path rather than echoing the URL, so this is the last of three
 * checks. It stays strict anyway — an open redirect on a page that has just
 * established a privileged session is the worst possible place for one.
 */
export function isSafeReturnPath(next: string | null | undefined): boolean {
  if (typeof next !== 'string' || next.length === 0) return false
  if (next.length > 512) return false
  if (next[0] !== '/') return false
  if (next[1] === '/' || next[1] === '\\') return false
  if (next.includes('\\')) return false
  for (let i = 0; i < next.length; i++) {
    const c = next.charCodeAt(i)
    if (c <= 0x20 || c === 0x7f) return false
  }
  return true
}

export function resolveReturnPath(next: string | null | undefined): string {
  return isSafeReturnPath(next) ? (next as string) : DEFAULT_LANDING
}

/** The identity Atlas returns from atlas_sso_exchange_code(). */
export interface AtlasIdentity {
  atlasUserId: string
  email: string
  name: string | null
  role: string
  /** Atlas venue ids. NOT this app's venue ids — see mapVenueNames below. */
  venueIds: string[]
  venueNames: string[]
  returnPath: string | null
}

/**
 * Parse the exchange payload defensively. Returns null rather than throwing on
 * anything unexpected: a partially-understood identity is never used to
 * establish a session.
 */
export function parseIdentity(payload: unknown): AtlasIdentity | null {
  if (!payload || typeof payload !== 'object') return null
  const p = payload as Record<string, unknown>

  const atlasUserId = typeof p.user_id === 'string' ? p.user_id : null
  const email = typeof p.email === 'string' ? p.email.trim().toLowerCase() : null
  if (!atlasUserId || !email || !email.includes('@')) return null

  const str = (...keys: string[]): string | null => {
    for (const k of keys) {
      const v = p[k]
      if (typeof v === 'string' && v.trim() !== '') return v.trim()
    }
    return null
  }
  const arr = (...keys: string[]): string[] => {
    for (const k of keys) {
      const v = p[k]
      if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string')
    }
    return []
  }

  const role = str('role_key', 'role')
  if (!role) return null

  return {
    atlasUserId,
    email,
    name: str('full_name', 'name'),
    role,
    venueIds: arr('venue_ids', 'venueIds'),
    venueNames: arr('venue_names', 'venueNames'),
    returnPath: str('return_path', 'next'),
  }
}

// ── Role mapping ────────────────────────────────────────────────────────────

export type PromoterRole = 'admin' | 'venue_manager' | 'reception' | 'promoter'

/** Rank so a mapped role can be compared with one already stored locally. */
const RANK: Record<PromoterRole, number> = {
  admin: 40,
  venue_manager: 30,
  reception: 20,
  promoter: 10,
}

/**
 * Atlas role → the role this app should grant.
 *
 * Derived from who already holds admin here rather than invented: Blake,
 * Laura, Rymak and Reception are all Atlas `operations` and all admins in this
 * app, and Paris is `venue_manager` in both. So:
 *
 *   owner, group_admin, operations → admin
 *   venue_manager                  → venue_manager, scoped to their venues
 *   marketing, staff               → no access (they have no business in the
 *                                    promoter and guestlist queues)
 *   promoter                       → no access via SSO. Promoters are external
 *                                    contractors who sign in to this app
 *                                    directly; they have no Atlas account, and
 *                                    an Atlas-issued promoter session is not a
 *                                    thing that should be possible.
 *
 * Returns null for "authenticated by Atlas, but not authorised here", which
 * the callback turns into an access-denied page rather than a login form.
 */
export function mapAtlasRole(atlasRole: string): PromoterRole | null {
  switch (atlasRole) {
    case 'owner':
    case 'group_admin':
    case 'operations':
      return 'admin'
    case 'venue_manager':
      return 'venue_manager'
    default:
      return null
  }
}

/**
 * Never demote someone on sign-in.
 *
 * Two of this app's admins (asolito@, zac@tenasu) are external and have no
 * Atlas account, so they never come through here — but Dan is an Atlas
 * `venue_manager` who was deliberately made a full admin in this app. Mapping
 * strictly would quietly strip that on his next sign-in. SSO should be able to
 * grant access, never to take it away; role changes belong in the admin screen
 * where someone can see what they're doing.
 */
export function effectiveRole(
  mapped: PromoterRole,
  existing: PromoterRole | null | undefined
): PromoterRole {
  if (!existing) return mapped
  return RANK[existing] >= RANK[mapped] ? existing : mapped
}

/**
 * Match Atlas venues to this app's venues BY NAME.
 *
 * The two databases have independent venue ids and, more importantly,
 * different venue sets — this app has Silk, which Atlas doesn't, and Atlas has
 * Ju Ju, Ember & Ash and Night Market, which this app doesn't. So ids cannot
 * be carried across and a manager of a venue this app has never heard of maps
 * to no scope at all, which is the correct outcome.
 *
 * Comparison is case- and whitespace-insensitive so "Eclipse AfterDark" and
 * "Eclipse Afterdark" are the same venue.
 */
export function mapVenueNames(
  atlasVenueNames: string[],
  localVenues: { id: string; name: string }[]
): string[] {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')
  const wanted = new Set(atlasVenueNames.map(norm))
  return localVenues.filter((v) => wanted.has(norm(v.name))).map((v) => v.id)
}
