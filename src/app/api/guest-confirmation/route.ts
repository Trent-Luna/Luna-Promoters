import { NextResponse } from 'next/server'
import { sendGuestConfirmation } from '@/lib/guest-confirmation'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * The guest's own browser calls this once a promoter-link sign-up lands, with
 * the new pass's token. Staff adds and CRM adds call sendGuestConfirmation
 * directly from the server instead; see src/lib/guest-confirmation.ts.
 */
export async function POST(req: Request) {
  try {
    const { token, force } = await req.json().catch(() => ({}))
    if (!token || typeof token !== 'string') {
      return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 })
    }
    const r = await sendGuestConfirmation(token, { force: force === true })
    if (!r.ok) {
      if (r.error === 'not_found') return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
      if (r.error === 'send_failed') return NextResponse.json({ ok: false, error: 'send_failed', detail: r.detail }, { status: 502 })
      return NextResponse.json({ ok: false, error: r.error })
    }
    return NextResponse.json(r)
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'error' }, { status: 500 })
  }
}
