// ============================================================================
// GET /api/auth/sso/callback — the Promoters end of the Atlas SSO handoff.
//
// Atlas sends the browser here with a single-use code. This route redeems that
// code server-side, provisions or refreshes the local access record,
// establishes a local Supabase session and lands the user on their intended
// page. Nobody ever types this URL.
//
// Three rules shape the error handling, carried over from Reservations:
//
//   1. An authenticated-but-unauthorised user goes to /access-denied, NOT to
//      the login form. Asking someone to type a password they do not have, for
//      an app they are not allowed into, teaches them the system is broken
//      when it is working correctly.
//   2. "Atlas said no" and "Atlas could not be reached" are different outcomes
//      with different destinations. Only the second is worth retrying.
//   3. Nothing sensitive is logged — not the code, not the secret, not the
//      session. Only an outcome slug and the email.
//
// Password sign-in at /login is untouched and keeps working, which matters
// here more than in the other apps: the 46 promoters are external contractors
// with no Atlas account, and this route must never become the only way in.
// ============================================================================

import { NextResponse, type NextRequest } from 'next/server'
import { createClient as createServerSupabase, createServiceClient } from '@/lib/supabase/server'
import { exchangeCode, ssoEnv } from '@/lib/sso/atlas'
import {
  isValidCode,
  parseIdentity,
  mapAtlasRole,
  effectiveRole,
  mapVenueNames,
  resolveReturnPath,
  type PromoterRole,
} from '@/lib/sso/validate'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DENIED = '/access-denied'
const LOGIN = '/login'

/** Coarse outcome logging. Never includes the code. */
function logSafe(outcome: string, email?: string | null) {
  console.log(JSON.stringify({ evt: 'sso.callback', outcome, email: email ?? null }))
}

function bail(origin: string, path: string, ref: string) {
  return NextResponse.redirect(`${origin}${path}?ref=${encodeURIComponent(ref)}`, 303)
}

type MintResult = { ok: true } | { ok: false; detail: string }

/**
 * Turn a verified Atlas identity into a local Supabase session.
 *
 * `generateLink` returns a one-time token WITHOUT sending an email; it is then
 * redeemed server-side, so the session cookie is written by this response.
 * Nothing is emailed and no token reaches the browser.
 *
 * The retry-with-a-fresh-token is deliberate and was hard-won in Reservations:
 * a one-time token can be dead by the time it is redeemed — spent by a
 * duplicate request, swept, or handed back from a cached response minted
 * earlier. Every one of those looks identical from outside ("One-time token
 * not found"). The second attempt also uses the OTHER redemption path, because
 * `hashed_token` and the plain `email_otp` are looked up differently inside the
 * auth service; if both fail, the failure is real rather than incidental.
 */
async function mintSession(
  admin: ReturnType<typeof createServiceClient>,
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  email: string
): Promise<MintResult> {
  let lastDetail = 'session_failed:unknown'

  for (let attempt = 1; attempt <= 2; attempt++) {
    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
    })

    const tokenHash = link?.properties?.hashed_token
    const emailOtp = link?.properties?.email_otp
    if (linkErr || (!tokenHash && !emailOtp)) {
      // No token to redeem: retrying would only repeat the same call.
      return { ok: false, detail: `link_failed:${linkErr?.message ?? 'no_token'}` }
    }

    const useOtp = attempt === 2 && !!emailOtp
    const { error: otpErr } = useOtp
      ? await supabase.auth.verifyOtp({ type: 'email', email, token: emailOtp as string })
      : await supabase.auth.verifyOtp({ type: 'magiclink', token_hash: tokenHash as string })

    if (!otpErr) return { ok: true }

    lastDetail = `verify_failed${useOtp ? '_otp' : ''}:${otpErr.message}`
  }

  return { ok: false, detail: lastDetail }
}

/** Find an existing auth user by email, or create a passwordless one. */
async function findOrCreateAuthUser(
  admin: ReturnType<typeof createServiceClient>,
  email: string,
  name: string | null
): Promise<{ id: string } | null> {
  // listUsers is paginated; this app has fewer than 200 accounts today, but
  // walking pages costs nothing and removes a silent ceiling.
  for (let page = 1; page <= 10; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    const users = data?.users ?? []
    const hit = users.find((u) => (u.email ?? '').toLowerCase() === email)
    if (hit) return { id: hit.id }
    if (users.length < 200) break
  }

  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: name ? { full_name: name } : {},
  })
  if (error || !created?.user) return null
  return { id: created.user.id }
}

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin
  const code = req.nextUrl.searchParams.get('code')

  if (!ssoEnv().configured) {
    logSafe('not_configured')
    return bail(origin, LOGIN, 'sso_not_configured')
  }
  if (!isValidCode(code)) {
    logSafe('bad_code')
    return bail(origin, DENIED, 'bad_code')
  }

  const exchanged = await exchangeCode(code as string)
  if (!exchanged.ok) {
    logSafe(`exchange_${exchanged.failure}`)
    // "Atlas refused" is an answer and belongs on access-denied. "Atlas was
    // unreachable" is not, and sending someone to a permissions page for an
    // outage is how a five-minute blip becomes an afternoon of role edits.
    return exchanged.failure === 'unavailable'
      ? bail(origin, LOGIN, 'sso_unavailable')
      : bail(origin, DENIED, `sso_${exchanged.failure}`)
  }

  const identity = parseIdentity(exchanged.payload)
  if (!identity) {
    logSafe('bad_payload')
    return bail(origin, DENIED, 'bad_payload')
  }

  // Authorisation: Atlas authentication does NOT imply access here.
  const mapped = mapAtlasRole(identity.role)
  if (!mapped) {
    logSafe('role_not_permitted', identity.email)
    return bail(origin, DENIED, 'not_permitted')
  }

  const admin = createServiceClient()

  const authUser = await findOrCreateAuthUser(admin, identity.email, identity.name)
  if (!authUser) {
    logSafe('provision_failed', identity.email)
    return bail(origin, LOGIN, 'provision_failed')
  }

  // ---- roles -------------------------------------------------------------
  // Read what this person already has locally, so SSO can grant access but
  // never quietly take it away.
  const { data: existingRows } = await admin
    .from('roles')
    .select('role, venue_id')
    .eq('user_id', authUser.id)

  const existing = (existingRows ?? []) as { role: PromoterRole; venue_id: string | null }[]
  const strongestExisting =
    existing.length > 0
      ? existing.map((r) => r.role).sort((a, b) => (a === 'admin' ? -1 : b === 'admin' ? 1 : 0))[0]
      : null

  const role = effectiveRole(mapped, strongestExisting)

  if (role === 'admin') {
    // Admin is unscoped — one row, no venue.
    const alreadyAdmin = existing.some((r) => r.role === 'admin' && r.venue_id === null)
    if (!alreadyAdmin) {
      await admin.from('roles').insert({ user_id: authUser.id, role: 'admin', venue_id: null })
    }
  } else if (role === 'venue_manager') {
    // Scoped by venue NAME — the two databases have independent ids and
    // different venue sets, so a manager of a venue this app doesn't have maps
    // to no scope, and gets the access-denied page rather than an empty app.
    const { data: localVenues } = await admin.from('venues').select('id, name')
    const venueIds = mapVenueNames(identity.venueNames, (localVenues ?? []) as { id: string; name: string }[])

    if (venueIds.length === 0) {
      logSafe('no_matching_venues', identity.email)
      return bail(origin, DENIED, 'no_venues_here')
    }

    const have = new Set(
      existing.filter((r) => r.role === 'venue_manager').map((r) => r.venue_id ?? '')
    )
    const missing = venueIds.filter((id) => !have.has(id))
    if (missing.length > 0) {
      await admin
        .from('roles')
        .insert(missing.map((venue_id) => ({ user_id: authUser.id, role: 'venue_manager', venue_id })))
    }
  }

  // ---- session -----------------------------------------------------------
  const supabase = await createServerSupabase()
  const minted = await mintSession(admin, supabase, identity.email)
  if (!minted.ok) {
    logSafe(`session_failed:${minted.detail}`, identity.email)
    return bail(origin, LOGIN, 'session_failed')
  }

  logSafe('ok', identity.email)
  return NextResponse.redirect(`${origin}${resolveReturnPath(identity.returnPath)}`, 303)
}
