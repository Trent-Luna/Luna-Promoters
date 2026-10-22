import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// The guest list pass now goes out for every way onto a list: a promoter-link
// sign-up (through /api/guest-confirmation), a staff add on the Guest lists
// screen and a CRM add (both from the server). Until 22 Oct 2026 the last two
// sent nothing. These tests pin the one sender all three share.

const h = vi.hoisted(() => ({
  reg: null as Record<string, unknown> | null,
  updates: [] as Array<{ patch: Record<string, unknown>; token: unknown }>,
  sms: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => ({
    from: () => {
      const filters: Record<string, unknown> = {}
      let patch: Record<string, unknown> | null = null
      const chain: any = {
        select: () => chain,
        update: (p: Record<string, unknown>) => { patch = p; return chain },
        eq: (col: string, val: unknown) => {
          filters[col] = val
          if (patch) { h.updates.push({ patch, token: val }); return Promise.resolve({ error: null }) }
          return chain
        },
        maybeSingle: () => Promise.resolve({ data: h.reg && h.reg.qr_token === filters.qr_token ? h.reg : null, error: null }),
      }
      return chain
    },
  }),
}))
vi.mock('@/lib/sms', () => ({ sendSms: h.sms }))

import { sendGuestConfirmation } from './guest-confirmation'

const fetchMock = vi.fn()

function reg(over: Record<string, unknown> = {}) {
  return {
    qr_token: 'tok-1', special_occasion: null, confirmation_sent_at: null, promoter_id: null,
    plus_ones: 0, party_names: null,
    guests: { first_name: 'Sam', email: 'sam@example.com', mobile: '0412345678' },
    venues: { name: 'Pump Nightclub', slug: 'pump-nightclub', guestlist_until: '23:00:00', whatsapp_channel_url: null },
    events: { event_date: '2026-10-30', name: 'Fri 30 Oct', start_time: null, party: null },
    promoters: { id: 'p1', promoter_code: 'staff1', full_name: 'Door Staff' },
    ...over,
  }
}

beforeEach(() => {
  h.reg = reg()
  h.updates = []
  h.sms.mockReset()
  h.sms.mockResolvedValue('sent')
  fetchMock.mockReset()
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: 'email-1' }), { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
  vi.stubEnv('RESEND_API_KEY', 'test-key')
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://promoter.lunagroup.com.au')
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('sendGuestConfirmation', () => {
  it('emails the pass and stamps it as sent', async () => {
    const r = await sendGuestConfirmation('tok-1')
    expect(r).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.to).toEqual(['sam@example.com'])
    expect(body.html).toContain('https://promoter.lunagroup.com.au/api/qr/tok-1')
    expect(h.updates).toHaveLength(1)
    expect(h.updates[0].patch).toHaveProperty('confirmation_sent_at')
  })

  it('gives a venue without its own look (Silk) the Satin pass', async () => {
    h.reg = reg({ venues: { name: 'Silk Saturdays', slug: 'Silk', guestlist_until: null, whatsapp_channel_url: null }, events: { event_date: '2026-10-31', name: 'Sat 31 Oct', start_time: null, party: null } })
    await sendGuestConfirmation('tok-1')
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.subject).toBe("You're on the list: Silk Saturdays, Saturday 31 October")
    expect(body.from).toBe('Luna Group <noreply@lunagroup.com.au>')
    expect(body.html).toContain('/brand/email/hero-silk.jpg')
  })

  it('sends nothing a second time unless forced', async () => {
    h.reg = reg({ confirmation_sent_at: '2026-10-22T00:00:00Z' })
    expect(await sendGuestConfirmation('tok-1')).toEqual({ ok: true, skipped: 'already_sent' })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(await sendGuestConfirmation('tok-1', { force: true })).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('skips a guest with no email, without calling the provider', async () => {
    h.reg = reg({ guests: { first_name: 'Sam', email: null, mobile: '0412345678' } })
    expect(await sendGuestConfirmation('tok-1')).toEqual({ ok: true, skipped: 'no_email' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reports an unknown pass', async () => {
    expect(await sendGuestConfirmation('nope')).toEqual({ ok: false, error: 'not_found' })
  })

  it('does not stamp a send the provider refused, so a retry still sends', async () => {
    fetchMock.mockResolvedValue(new Response('quota', { status: 429 }))
    const r = await sendGuestConfirmation('tok-1')
    expect(r).toMatchObject({ ok: false, error: 'send_failed' })
    expect(h.updates).toHaveLength(0)
  })

  it('needs email configured before it touches anything', async () => {
    vi.stubEnv('RESEND_API_KEY', '')
    expect(await sendGuestConfirmation('tok-1')).toEqual({ ok: false, error: 'email_not_configured' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('texts a party-night pass once, and not again on a forced resend', async () => {
    h.reg = reg({ events: { event_date: '2026-10-30', name: 'Pimp My Pres', start_time: '20:00:00', party: { sms: true, tagline: null, lede: null, included: null } } })
    const first = await sendGuestConfirmation('tok-1')
    expect(first).toEqual({ ok: true, sms: 'sent' })
    expect(h.sms).toHaveBeenCalledTimes(1)
    await sendGuestConfirmation('tok-1', { force: true })
    expect(h.sms).toHaveBeenCalledTimes(1)
  })
})
