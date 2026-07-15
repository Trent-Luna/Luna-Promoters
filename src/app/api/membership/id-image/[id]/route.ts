import { NextResponse } from 'next/server'
import { getSession, hasRole } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Returns a short-lived signed URL to a member's university ID image.
// ONLY admins and venue managers. Reception is explicitly denied.
// Every access is written to membership_audit_log.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const s = await getSession()
  if (!s) return NextResponse.json({ ok: false, error: 'not_authenticated' }, { status: 401 })
  if (!hasRole(s, 'admin', 'venue_manager')) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }

  const svc = createServiceClient()
  const { data: doc } = await svc
    .from('membership_documents')
    .select('storage_bucket, storage_path, deleted_at')
    .eq('membership_id', id)
    .is('deleted_at', null)
    .order('uploaded_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!doc) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })

  const { data: signed, error } = await svc.storage
    .from(doc.storage_bucket)
    .createSignedUrl(doc.storage_path, 60) // 60-second expiry
  if (error || !signed) {
    return NextResponse.json({ ok: false, error: 'sign_failed' }, { status: 502 })
  }

  await svc.from('membership_audit_log').insert({
    membership_id: id, actor_id: s.userId, action: 'id_image_accessed',
    note: `Accessed by ${s.email}`,
  })

  return NextResponse.json({ ok: true, url: signed.signedUrl })
}
