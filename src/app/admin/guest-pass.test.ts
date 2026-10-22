import { describe, it, expect, beforeEach, vi } from 'vitest'

// sendGuestPass: the Guest lists screen's way to email a guest their QR,
// straight after a staff add and from the row's Send QR button.

const h = vi.hoisted(() => ({
  session: null as null | { userId: string; roles: string[]; venueIds: string[] },
  reg: null as null | Record<string, unknown>,
  logged: [] as Array<Record<string, unknown>>,
  send: vi.fn(),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth', () => ({
  getSession: async () => h.session,
  hasRole: (s: { roles: string[] } | null, ...roles: string[]) => !!s && roles.some((r) => s.roles.includes(r)),
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({}),
  createServiceClient: () => ({
    from: () => {
      const chain: any = { select: () => chain, eq: () => chain, maybeSingle: async () => ({ data: h.reg, error: null }) }
      return chain
    },
    rpc: async (_name: string, args: Record<string, unknown>) => { h.logged.push(args); return { error: null } },
  }),
}))
vi.mock('@/lib/guest-confirmation', () => ({ sendGuestConfirmation: h.send }))

import { sendGuestPass } from './actions'

const VENUE = 'venue-pump'

beforeEach(() => {
  h.session = { userId: 'u1', roles: ['venue_manager'], venueIds: [VENUE] }
  h.reg = { id: 'reg-1', venue_id: VENUE, qr_token: 'tok-1', guests: { email: 'sam@example.com' } }
  h.logged = []
  h.send.mockReset()
  h.send.mockResolvedValue({ ok: true })
})

describe('sendGuestPass', () => {
  it('emails the pass for a guest on a venue the manager runs', async () => {
    expect(await sendGuestPass('reg-1')).toEqual({ ok: true, to: 'sam@example.com' })
    expect(h.send).toHaveBeenCalledWith('tok-1', { force: false })
    expect(h.logged[0]).toMatchObject({ p_action: 'guest_pass_sent', p_venue: VENUE })
  })

  it('forces the send for a resend', async () => {
    await sendGuestPass('reg-1', { resend: true })
    expect(h.send).toHaveBeenCalledWith('tok-1', { force: true })
    expect(h.logged[0]).toMatchObject({ p_action: 'guest_pass_resent' })
  })

  it("refuses a guest on another venue's list", async () => {
    h.reg = { ...h.reg!, venue_id: 'venue-other' }
    expect(await sendGuestPass('reg-1')).toEqual({ ok: false, reason: 'not_authorised' })
    expect(h.send).not.toHaveBeenCalled()
  })

  it('lets an admin send for any venue', async () => {
    h.session = { userId: 'u2', roles: ['admin'], venueIds: [] }
    h.reg = { ...h.reg!, venue_id: 'venue-other' }
    expect((await sendGuestPass('reg-1')).ok).toBe(true)
  })

  it('says so when there is no email, without sending', async () => {
    h.reg = { ...h.reg!, guests: { email: null } }
    expect(await sendGuestPass('reg-1')).toEqual({ ok: false, reason: 'no_email' })
    expect(h.send).not.toHaveBeenCalled()
  })

  it('does not log a send that had already gone out', async () => {
    h.send.mockResolvedValue({ ok: true, skipped: 'already_sent' })
    expect(await sendGuestPass('reg-1')).toEqual({ ok: true, reason: 'already_sent', to: 'sam@example.com' })
    expect(h.logged).toHaveLength(0)
  })

  it('passes a provider failure back to the screen', async () => {
    h.send.mockResolvedValue({ ok: false, error: 'send_failed' })
    expect(await sendGuestPass('reg-1')).toEqual({ ok: false, reason: 'send_failed' })
  })

  it('is closed to anyone who is not a manager or admin', async () => {
    h.session = { userId: 'u3', roles: ['promoter'], venueIds: [] }
    await expect(sendGuestPass('reg-1')).rejects.toThrow('Not authorised')
  })
})
