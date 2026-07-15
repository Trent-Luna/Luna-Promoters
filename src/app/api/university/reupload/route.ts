import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getVerificationService } from '@/lib/verification'
import { sendApproved, sendManualReview, sendRejected } from '@/lib/email/university'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_BYTES = 10 * 1024 * 1024
const AI_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])
const ALLOWED_MIME = new Set([...AI_MIME, 'image/heic', 'image/heif', 'application/pdf'])
const EXT: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
  'image/heic': 'heic', 'image/heif': 'heif', 'application/pdf': 'pdf',
}

export async function POST(req: Request) {
  try {
    const form = await req.formData()
    const token = String(form.get('token') || '').trim()
    const expiry = String(form.get('expiry_date') || '').trim() || null
    const file = form.get('id_card') as File | null
    if (!token) return NextResponse.json({ ok: false, error: 'missing_token' }, { status: 400 })
    if (!file || typeof file === 'string') return NextResponse.json({ ok: false, error: 'document_required' }, { status: 400 })

    const mime = file.type || 'application/octet-stream'
    if (!ALLOWED_MIME.has(mime)) return NextResponse.json({ ok: false, error: 'invalid_file_type' }, { status: 400 })
    const buf = Buffer.from(await file.arrayBuffer())
    if (buf.byteLength === 0 || buf.byteLength > MAX_BYTES) return NextResponse.json({ ok: false, error: 'file_too_large' }, { status: 400 })

    const svc = createServiceClient()
    const ext = EXT[mime] || 'bin'
    const rand = (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`)
    const path = `${new Date().getUTCFullYear()}/${rand}.${ext}`
    const up = await svc.storage.from('university-ids').upload(path, buf, { contentType: mime, upsert: false })
    if (up.error) return NextResponse.json({ ok: false, error: 'upload_failed' }, { status: 502 })

    const { data: re, error: reErr } = await svc.rpc('add_university_reupload', {
      p_token: token, p_expiry: expiry, p_storage_path: path, p_mime: mime, p_bytes: buf.byteLength,
    })
    if (reErr || !re?.ok) return NextResponse.json({ ok: false, error: re?.error || 'reupload_failed' }, { status: 400 })
    if (re.already === 'approved') return NextResponse.json({ ok: true, status: 'approved', pass_token: token })

    const membershipId = re.membership_id as string
    let finalStatus = 'manual_review'
    if (AI_MIME.has(mime)) {
      const result = await getVerificationService().verify({
        imageBase64: buf.toString('base64'), mimeType: mime === 'image/jpg' ? 'image/jpeg' : mime,
        submittedName: '', submittedExpiry: expiry,
      })
      const { data: dec } = await svc.rpc('apply_university_verification', {
        p_membership: membershipId,
        p_extraction: result.extraction ?? { review_reasons: [result.error || 'ai_unavailable'] },
        p_raw: result.raw ?? null, p_provider: result.provider, p_model: result.model,
      })
      finalStatus = dec?.status || 'manual_review'
    } else {
      const { data: dec } = await svc.rpc('apply_university_verification', {
        p_membership: membershipId,
        p_extraction: { review_reasons: ['unsupported_format_manual_review'] },
        p_raw: null, p_provider: 'none', p_model: 'none',
      })
      finalStatus = dec?.status || 'manual_review'
    }

    // notify (best-effort) — need the applicant email
    try {
      const { data: em } = await svc.rpc('get_membership_pass', { p_token: token })
      const { data: contact } = await svc
        .from('memberships').select('contacts(full_name,email)').eq('pass_token', token).maybeSingle()
      const email = (contact as any)?.contacts?.email as string | undefined
      const first = ((contact as any)?.contacts?.full_name || '').split(' ')[0]
      if (email) {
        if (finalStatus === 'approved') await sendApproved(email, first, token)
        else if (finalStatus === 'rejected') await sendRejected(email, first)
        else if (finalStatus === 'manual_review') await sendManualReview(email, first)
      }
      void em
    } catch { /* ignore */ }

    return NextResponse.json({ ok: true, status: finalStatus, pass_token: token })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'error' }, { status: 500 })
  }
}
