import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { brisbaneNow, reminderDue, reminderText, type PartyLook } from '@/lib/party'
import { sendSms, smsConfigured } from '@/lib/sms'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

/**
 * The day-of text for party nights (migration 0051). Runs daily at 2pm
 * Brisbane (vercel.json). For every active party night TODAY with texts
 * switched on (events.party.sms = true), each registration that is still on
 * the list and has not had its reminder gets one, once (reminder_sent_at).
 *
 * Nothing is sent for a night whose texts are off, and they are off until
 * Trent approves the wording.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'unauthorised' }, { status: 401 })
  }
  if (!smsConfigured()) return NextResponse.json({ ok: true, skipped: 'sms_not_configured' })

  const site = process.env.NEXT_PUBLIC_SITE_URL || ''
  const today = brisbaneNow().date
  const svc = createServiceClient()
  const { data: nights } = await svc
    .from('events')
    .select('id, name, event_date, start_time, party')
    .eq('event_date', today).eq('active', true).not('party', 'is', null)

  const out: Record<string, { sent: number; failed: number; skipped: number }> = {}
  for (const ev of (nights ?? []) as any[]) {
    const look = ev.party as PartyLook | null
    if (look?.sms !== true || !reminderDue(ev.event_date)) continue
    const tally = { sent: 0, failed: 0, skipped: 0 }
    const { data: regs } = await svc
      .from('guest_registrations')
      .select('id, qr_token, plus_ones, status, guests(first_name, mobile)')
      .eq('event_id', ev.id).is('reminder_sent_at', null).eq('status', 'registered')
      .limit(1000)
    for (const r of (regs ?? []) as any[]) {
      const outcome = await sendSms(r.guests?.mobile, reminderText({
        first: r.guests?.first_name ?? '', eventName: ev.name, eventDate: ev.event_date,
        startTime: ev.start_time ?? null, plusOnes: r.plus_ones ?? 0, passUrl: `${site}/g/${r.qr_token}`,
      }))
      tally[outcome === 'sent' ? 'sent' : outcome === 'failed' ? 'failed' : 'skipped']++
      // Marked either way so a number Twilio refuses is not retried every run.
      if (outcome !== 'skipped') {
        await svc.from('guest_registrations').update({ reminder_sent_at: new Date().toISOString() }).eq('id', r.id)
      }
    }
    out[ev.name] = tally
  }
  return NextResponse.json({ ok: true, date: today, nights: out })
}
