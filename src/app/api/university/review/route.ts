import { NextResponse } from 'next/server'
import { getSession, hasRole } from '@/lib/auth'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendApproved, sendRejected, sendNewUploadRequested } from '@/lib/email/university'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Admin/manager manual-review action + the matching applicant email.
// The RPC enforces authorisation via the caller's session (auth.uid()), and we
// double-check the role here too.
export async function POST(req: Request) {
  const s = await getSession()
  if (!s) return NextResponse.json({ ok: false, error: 'not_authenticated' }, { status: 401 })
  if (!hasRole(s, 'admin', 'venue_manager')) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }

  const { membership_id, action, reason } = await req.json().catch(() => ({}))
  if (!membership_id || !action) {
    return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 })
  }

  // Call the decision RPC as the signed-in admin (so the RPC's is_admin/manager check passes).
  const supabase = await createClient()
  const { data: result, error } = await supabase.rpc('review_university_member', {
    p_membership: membership_id, p_action: action, p_reason: reason ?? null,
  })
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  if (!result?.ok) return NextResponse.json(result, { status: 400 })

  // Look up the applicant's email/name (service role) and send the matching email.
  try {
    const svc = createServiceClient()
    const { data: m } = await svc
      .from('memberships')
      .select('pass_token, contacts(full_name, email)')
      .eq('id', membership_id)
      .maybeSingle()
    const email = (m as any)?.contacts?.email as string | undefined
    const first = ((m as any)?.contacts?.full_name || '').split(' ')[0]
    const passToken = (m as any)?.pass_token as string | undefined
    if (email && passToken) {
      if (action === 'approve') await sendApproved(email, first, passToken)
      else if (action === 'reject') await sendRejected(email, first)
      else if (action === 'request_new_id') await sendNewUploadRequested(email, first, passToken)
      // 'suspend' has no applicant-facing email by design
    }
  } catch { /* email failure must not fail the review action */ }

  return NextResponse.json(result)
}
