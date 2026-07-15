import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getVerificationService } from '@/lib/verification'
import { sendApplicationReceived, sendApproved, sendManualReview, sendRejected } from '@/lib/email/university'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_BYTES = 10 * 1024 * 1024 // 10 MB
const AI_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])
const ALLOWED_MIME = new Set([...AI_MIME, 'image/heic', 'image/heif', 'application/pdf'])
const EXT: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
  'image/heic': 'heic', 'image/heif': 'heif', 'application/pdf': 'pdf',
}

// Best-effort in-memory rate limit (per warm instance). Use a shared store
// (e.g. Upstash) for strict limits across the fleet.
const HITS = new Map<string, number[]>()
function rateLimited(ip: string, limit = 5, windowMs = 60_000): boolean {
  const now = Date.now()
  const arr = (HITS.get(ip) || []).filter(t => now - t < windowMs)
  arr.push(now)
  HITS.set(ip, arr)
  return arr.length > limit
}

function isAdult(dob: string): boolean {
  const d = new Date(dob + 'T00:00:00Z')
  if (isNaN(d.getTime())) return false
  const cutoff = new Date()
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 18)
  return d.getTime() <= cutoff.getTime()
}

export async function POST(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    if (rateLimited(ip)) {
      return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 })
    }

    const form = await req.formData()
    const full_name = String(form.get('full_name') || '').trim()
    const mobile = String(form.get('mobile') || '').trim()
    const email = String(form.get('email') || '').trim()
    const dob = String(form.get('dob') || '').trim()
    const expiry = String(form.get('expiry_date') || '').trim()
    const agreement = String(form.get('agreement') || '') === 'true'
    const id_confirm = String(form.get('id_confirm') || '') === 'true'
    const marketing = String(form.get('marketing') || '') === 'true'
    const file = form.get('id_card') as File | null

    // ---- validation (mirrors DB gates) ----
    if (!full_name || !mobile || !email || !dob || !expiry) {
      return NextResponse.json({ ok: false, error: 'missing_fields' }, { status: 400 })
    }
    if (!agreement || !id_confirm) {
      return NextResponse.json({ ok: false, error: 'consent_required' }, { status: 400 })
    }
    if (!isAdult(dob)) {
      return NextResponse.json({ ok: false, error: 'under_18' }, { status: 400 })
    }
    if (!file || typeof file === 'string') {
      return NextResponse.json({ ok: false, error: 'document_required' }, { status: 400 })
    }
    const mime = file.type || 'application/octet-stream'
    if (!ALLOWED_MIME.has(mime)) {
      return NextResponse.json({ ok: false, error: 'invalid_file_type' }, { status: 400 })
    }
    const buf = Buffer.from(await file.arrayBuffer())
    if (buf.byteLength === 0 || buf.byteLength > MAX_BYTES) {
      return NextResponse.json({ ok: false, error: 'file_too_large' }, { status: 400 })
    }

    const svc = createServiceClient()

    // ---- upload to the PRIVATE bucket (service role; never public) ----
    const ext = EXT[mime] || 'bin'
    const y = new Date().getUTCFullYear()
    const rand = (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`)
    const path = `${y}/${rand}.${ext}`
    const up = await svc.storage.from('university-ids').upload(path, buf, { contentType: mime, upsert: false })
    if (up.error) {
      return NextResponse.json({ ok: false, error: 'upload_failed', detail: up.error.message }, { status: 502 })
    }

    // ---- create the application (contact + membership + doc + verification stub) ----
    const { data: sub, error: subErr } = await svc.rpc('submit_university_application', {
      p_full_name: full_name, p_mobile: mobile, p_email: email, p_dob: dob,
      p_expiry_date: expiry, p_storage_path: path, p_mime: mime, p_bytes: buf.byteLength,
      p_agreement: true, p_id_confirm: true, p_marketing: marketing,
    })
    if (subErr) return NextResponse.json({ ok: false, error: 'submit_failed', detail: subErr.message }, { status: 500 })
    if (!sub?.ok) return NextResponse.json({ ok: false, error: sub?.error || 'submit_failed' }, { status: 400 })

    const membershipId = sub.membership_id as string
    const passToken = sub.pass_token as string
    const firstName = full_name.split(' ')[0]

    // Already approved from a previous submission — just return it.
    if (sub.already === 'approved') {
      return NextResponse.json({ ok: true, status: 'approved', pass_token: passToken })
    }

    // ---- AI verification (only for AI-readable image formats) ----
    let finalStatus = 'pending_verification'
    if (AI_MIME.has(mime)) {
      const verifier = getVerificationService()
      const result = await verifier.verify({
        imageBase64: buf.toString('base64'), mimeType: mime === 'image/jpg' ? 'image/jpeg' : mime,
        submittedName: full_name, submittedExpiry: expiry || null,
      })
      // Pass whatever we got to the AUTHORITATIVE decision RPC. A null/invalid
      // extraction becomes manual_review inside the RPC (never auto-approve).
      const { data: dec } = await svc.rpc('apply_university_verification', {
        p_membership: membershipId,
        p_extraction: result.extraction ?? { review_reasons: [result.error || 'ai_unavailable'] },
        p_raw: result.raw ?? null, p_provider: result.provider, p_model: result.model,
      })
      finalStatus = dec?.status || 'manual_review'
    } else {
      // HEIC / PDF: store securely but route to manual review (see limitations).
      const { data: dec } = await svc.rpc('apply_university_verification', {
        p_membership: membershipId,
        p_extraction: { review_reasons: ['unsupported_format_manual_review'] },
        p_raw: { note: `stored ${mime}; queued for manual review` },
        p_provider: 'none', p_model: 'none',
      })
      finalStatus = dec?.status || 'manual_review'
    }

    // ---- notify the applicant (single outcome email; never exposes AI scores) ----
    try {
      if (finalStatus === 'approved') await sendApproved(email, firstName, passToken)
      else if (finalStatus === 'rejected') await sendRejected(email, firstName)
      else if (finalStatus === 'manual_review') await sendManualReview(email, firstName)
      else await sendApplicationReceived(email, firstName)
    } catch { /* email failure must not break signup */ }

    return NextResponse.json({ ok: true, status: finalStatus, pass_token: passToken })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'error' }, { status: 500 })
  }
}
