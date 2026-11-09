import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimited, clientIp } from '@/lib/offcampus/rate-limit'

export const dynamic = 'force-dynamic'

/**
 * Off Campus sign-up. The database function does every check and decides;
 * this route only rate-limits and passes the form through under the public
 * (anon) role. No service key is used, and nothing is emailed or texted.
 */
export async function POST(req: Request) {
  if (rateLimited(`reg:${clientIp(req)}`)) return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 })
  let b: any
  try { b = await req.json() } catch { return NextResponse.json({ ok: false, error: 'missing_fields' }, { status: 400 }) }
  const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.slice(0, max) : null)
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('offcampus_register', {
    p_full_name: str(b.full_name, 120), p_email: str(b.email, 200), p_mobile: str(b.mobile, 40),
    p_university: str(b.university, 40), p_team: str(b.team, 40), p_new_team: str(b.new_team, 80),
    p_organiser: b.organiser === true, p_age_ack: b.age === true, p_privacy: b.privacy === true,
    p_marketing: b.marketing === true, p_source: str(b.source, 60),
  })
  if (error) return NextResponse.json({ ok: false, error: 'error' }, { status: 500 })
  if (!data?.ok) return NextResponse.json({ ok: false, error: data?.error ?? 'error' }, { status: 400 })
  return NextResponse.json({ ok: true, pass_token: data.pass_token, already: !!data.already })
}
