import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimited, clientIp } from '@/lib/offcampus/rate-limit'

export const dynamic = 'force-dynamic'

/** Get a pass back with the email and mobile it was registered with (both must match). */
export async function POST(req: Request) {
  if (rateLimited(`find:${clientIp(req)}`, 8)) return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 })
  let b: any
  try { b = await req.json() } catch { return NextResponse.json({ ok: false, error: 'missing_fields' }, { status: 400 }) }
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('offcampus_find_pass', {
    p_email: typeof b.email === 'string' ? b.email.slice(0, 200) : null,
    p_mobile: typeof b.mobile === 'string' ? b.mobile.slice(0, 40) : null,
  })
  if (error) return NextResponse.json({ ok: false, error: 'error' }, { status: 500 })
  if (!data?.ok) return NextResponse.json({ ok: false, error: data?.error ?? 'not_found' }, { status: 404 })
  return NextResponse.json({ ok: true, pass_token: data.pass_token })
}
