'use client'
import { useState, useTransition } from 'react'
import { sendMovedNightNotice } from '../actions'
import { prettyNight } from '@/lib/trading'
import { Th, Td, EmptyRow } from '@/components/ui'

export interface MovedGroup {
  guestId: string
  venueId: string
  name: string
  email: string | null
  venue: string
  occasion: string | null
  /** The night they were originally listed for. */
  was: string
  /** Every upcoming night they are on at this venue, earliest first. */
  nights: string[]
  /** False once every one of those rows has been stamped as told. */
  pending: boolean
}

/**
 * Send, one guest at a time or all at once.
 *
 * "SEND ALL" IS SEQUENTIAL AND ON PURPOSE. Twenty-nine emails fired in
 * parallel is a burst that a transactional provider is entitled to rate-limit,
 * and a rate-limited send fails silently from the guest's point of view. One
 * after another takes a few seconds and every result is visible.
 *
 * A FAILURE LEAVES THE ROW ALONE. The stamp is written by the server only
 * after the provider accepts the message, so a guest whose send failed is
 * still listed as waiting and the next press picks them up. Nothing here has
 * to be reconciled by hand.
 */
export function MovedNightsPanel({ groups }: { groups: MovedGroup[] }) {
  const [state, setState] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [, start] = useTransition()

  const key = (g: MovedGroup) => `${g.guestId}:${g.venueId}`
  const pending = groups.filter((g) => g.pending && !state[key(g)]?.startsWith('Sent'))

  async function sendOne(g: MovedGroup): Promise<boolean> {
    setState((s) => ({ ...s, [key(g)]: 'Sending…' }))
    const res = await sendMovedNightNotice(g.guestId, g.venueId)
    const label = res.ok
      ? 'Sent'
      : res.reason === 'no_email' ? 'No email on file'
      : res.reason === 'nothing_to_send' ? 'Already sent'
      : res.reason === 'not_authorised' ? 'Not your venue'
      : 'Failed — try again'
    setState((s) => ({ ...s, [key(g)]: label }))
    return res.ok
  }

  async function sendAll() {
    setBusy(true)
    for (const g of pending) await sendOne(g)
    setBusy(false)
    start(() => {})
  }

  return (
    <div className="card">
      <div className="flex flex-wrap items-center gap-3 px-4 pt-4 pb-3">
        <div className="min-w-0">
          <h2 className="font-bold">The email they get</h2>
          <p className="text-[12px] text-luna-muted mt-0.5 leading-snug">
            “We&apos;re not open on {groups[0] ? prettyNight(groups[0].was) : 'that night'} — so we&apos;ve moved you to
            {' '}{groups[0] ? groups[0].nights.map(prettyNight).join(' and ') : 'the next night we&apos;re open'}.
            You&apos;re on the list, there&apos;s nothing you need to do. Sorry for the mix-up — that one was on us.”
          </p>
        </div>
        <button onClick={sendAll} disabled={busy || pending.length === 0}
          className="btn-gold !py-2 !px-4 text-sm ml-auto disabled:opacity-50">
          {busy ? 'Sending…' : pending.length === 0 ? 'All sent' : `Send all ${pending.length}`}
        </button>
      </div>
      <div className="md:overflow-x-auto">
        <table className="table-stack w-full text-sm md:min-w-[680px]">
          <thead>
            <tr className="border-b border-white/[0.07]">
              <Th>Guest</Th><Th>Venue</Th><Th>Was</Th><Th>Now on</Th><Th /></tr>
          </thead>
          <tbody>
            {groups.length === 0 && <EmptyRow colSpan={5}>No moved nights. Nothing to tell anyone.</EmptyRow>}
            {groups.map((g) => {
              const k = key(g)
              const said = state[k]
              const done = !g.pending || said === 'Sent'
              return (
                <tr key={k} className="border-b border-white/[0.045] last:border-0 hover:bg-white/[0.02] align-top">
                  <Td lead>
                    <div className="font-semibold">{g.name}</div>
                    <div className="text-xs text-luna-muted">{g.email ?? 'no email on file'}</div>
                  </Td>
                  <Td className="text-luna-muted">{g.venue}</Td>
                  <Td label="Was" className="text-luna-muted whitespace-nowrap">{prettyNight(g.was)}</Td>
                  <Td label="Now" className="whitespace-nowrap">
                    {g.nights.map((n) => <div key={n} className="text-luna-gold">{prettyNight(n)}</div>)}
                  </Td>
                  <Td end className="text-right whitespace-nowrap">
                    {done
                      ? <span className="text-xs text-emerald-400">Told</span>
                      : <button className="btn-ghost !py-1.5 !px-3 text-xs disabled:opacity-50"
                          disabled={busy || !g.email || said === 'Sending…'}
                          onClick={() => sendOne(g)}>{said ?? 'Send'}</button>}
                    {said && said !== 'Sent' && said !== 'Sending…' && (
                      <div className="text-[11px] text-amber-400 mt-1">{said}</div>
                    )}
                  </Td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
