import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Internal: put a guest on a venue's list for a date.
 *
 * Called service-to-service by the Luna CRM when a staff member actions a Meta
 * lead ("Add to guest list"). Not for browsers — auth is a shared secret, so
 * there is no user session and no CORS.
 *
 * Attribution goes to the house promoter (`luna`, created in migration 0019),
 * the same record the public guestlist uses, so CRM-sourced guests show on
 * venue lists without appearing as a real promoter's work.
 *
 * Deduplication is the database's job, not ours:
 *   - `register_guest_vd` matches an existing guest on mobile OR email
 *   - `guest_registrations` is unique on (event_id, guest_id)
 * A second attempt for the same person on the same night returns
 * `{ok:false, error:'duplicate'}`, which we surface as HTTP 409 so the CRM can
 * say "already on the list" rather than silently creating nothing.
 */

const HOUSE_PROMOTER_CODE = 'luna'

interface Body {
  venue_id?: string
  event_date?: string        // YYYY-MM-DD
  first_name?: string
  last_name?: string
  mobile?: string
  email?: string
  date_of_birth?: string     // YYYY-MM-DD
  instagram?: string
  occasion?: string          // 'Birthday' | 'Hens' | 'Bucks' | free text
  marketing_consent?: boolean
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function bad(error: string, detail?: string, status = 400) {
  return NextResponse.json({ ok: false, error, ...(detail ? { detail } : {}) }, { status })
}

export async function POST(req: Request) {
  // ---- auth -------------------------------------------------------------
  const expected = process.env.INTERNAL_API_KEY
  if (!expected) {
    // Fail closed: an unset secret must never mean "open to everyone".
    console.error(JSON.stringify({ level: 'error', msg: 'internal_api_key_unset' }))
    return bad('not_configured', undefined, 503)
  }
  const provided = req.headers.get('x-api-key') ?? ''
  if (provided.length !== expected.length || provided !== expected) {
    return bad('unauthorised', undefined, 401)
  }

  // ---- input ------------------------------------------------------------
  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return bad('bad_json')
  }

  const venueId = (body.venue_id ?? '').trim()
  const eventDate = (body.event_date ?? '').trim()
  const first = (body.first_name ?? '').trim()
  const last = (body.last_name ?? '').trim()
  const mobile = (body.mobile ?? '').trim()

  if (!UUID.test(venueId)) return bad('bad_venue_id')
  if (!ISO_DATE.test(eventDate)) return bad('bad_event_date', 'expected YYYY-MM-DD')
  if (!first) return bad('missing_first_name')
  // The guests table keys people by mobile — without one we cannot match or
  // create a guest, so refuse rather than write a half-formed record.
  if (!mobile) return bad('missing_mobile', 'guests are matched on mobile number')

  const dob = (body.date_of_birth ?? '').trim()
  if (dob && !ISO_DATE.test(dob)) return bad('bad_date_of_birth', 'expected YYYY-MM-DD')

  // ---- call the same function the public guestlist uses -----------------
  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('register_guest_vd', {
    p_promoter_code: HOUSE_PROMOTER_CODE,
    p_venue: venueId,
    p_date: eventDate,
    p_first: first,
    p_last: last,
    p_mobile: mobile,
    p_email: (body.email ?? '').trim(),
    p_dob: dob || null,
    p_instagram: (body.instagram ?? '').trim(),
    p_marketing: body.marketing_consent ?? false,
    p_occasion: (body.occasion ?? '').trim() || null,
  })

  if (error) {
    console.error(JSON.stringify({ level: 'error', msg: 'guestlist_add_rpc_failed', detail: error.message }))
    return bad('rpc_failed', error.message, 502)
  }

  const result = data as { ok?: boolean; error?: string; registration_id?: string; qr_token?: string } | null
  if (!result?.ok) {
    const reason = result?.error ?? 'unknown'
    // 409 for "already there", 422 for anything the caller could fix.
    const status = reason === 'duplicate' ? 409 : 422
    return NextResponse.json({ ok: false, error: reason }, { status })
  }

  return NextResponse.json({
    ok: true,
    registration_id: result.registration_id,
    qr_token: result.qr_token,
  })
}
