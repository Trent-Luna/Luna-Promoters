/**
 * Texts, through the same Twilio account the CRM and Reservations use.
 *
 * Off until the three values are set on this deployment (TWILIO_ACCOUNT_SID,
 * TWILIO_AUTH_TOKEN, and TWILIO_FROM or TWILIO_FROM_NUMBER) — copied across
 * from luna-crm. Every outcome is said out loud in the log, including a skip,
 * because "no errors" and "never attempted" look the same otherwise
 * (Reservations learnt that on 31 Aug 2026).
 */
function env(name: string): string | undefined {
  const raw = process.env[name]
  if (!raw) return undefined
  const clean = raw.trim().replace(/^['"]|['"]$/g, '')
  return clean || undefined
}
const from = () => env('TWILIO_FROM_NUMBER') || env('TWILIO_FROM')

export function smsConfigured(): boolean {
  return Boolean(env('TWILIO_ACCOUNT_SID') && env('TWILIO_AUTH_TOKEN') && from())
}

/** E.164 for Australian mobiles; Twilio rejects local formats. */
export function toE164(raw: string | null | undefined): string | null {
  const digits = String(raw ?? '').replace(/[^\d+]/g, '')
  if (!digits) return null
  if (digits.startsWith('+')) return digits.length >= 8 ? digits : null
  if (digits.startsWith('0')) return digits.length === 10 ? `+61${digits.slice(1)}` : null
  if (digits.startsWith('61')) return digits.length === 11 ? `+${digits}` : null
  if (digits.length === 9) return `+61${digits}`
  return null
}

export type SmsOutcome = 'sent' | 'skipped' | 'failed'

export async function sendSms(to: string | null | undefined, body: string): Promise<SmsOutcome> {
  if (!smsConfigured()) {
    console.warn('[sms] skipped — Twilio is not configured on this deployment')
    return 'skipped'
  }
  const e164 = toE164(to)
  if (!e164) { console.error('[sms] failed — not a number we can dial'); return 'failed' }
  const sid = env('TWILIO_ACCOUNT_SID')!
  const token = env('TWILIO_AUTH_TOKEN')!
  const sender = from()!
  if (!/^AC[0-9a-f]{32}$/i.test(sid)) { console.error('[sms] failed — TWILIO_ACCOUNT_SID is not the right shape'); return 'failed' }
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      // A Messaging Service SID (MG…) goes in its own parameter; a number goes in From.
      body: new URLSearchParams({ To: e164, [sender.startsWith('MG') ? 'MessagingServiceSid' : 'From']: sender, Body: body }),
    })
    if (!res.ok) {
      console.error('[sms] failed —', res.status, (await res.text().catch(() => '')).slice(0, 300))
      return 'failed'
    }
    return 'sent'
  } catch (e: any) {
    console.error('[sms] failed —', e?.message ?? e)
    return 'failed'
  }
}
