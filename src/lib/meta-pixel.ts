'use client'
/**
 * Meta Pixel on the guest list form, per venue.
 *
 * Trent, 8 Oct 2026: the Pump Meta ads send people to this form, so Meta needs
 * to see who signs up to optimise for it. Only venues listed here load the
 * pixel; every other venue's form stays free of Meta tracking.
 *
 * Events: PageView when the form shows a pixel venue, and Lead when the guest
 * is registered. Lead carries the pass token as eventID so a later server-side
 * (Conversions API) event for the same sign-up is de-duplicated, not doubled.
 */
const PIXELS: { match: RegExp; id: string }[] = [
  { match: /pump/i, id: '1337692745079424' }, // "Pump Pixel" dataset, Luna Group Hospitality
]

export function pixelForVenue(name?: string | null): string | null {
  if (!name) return null
  return PIXELS.find(p => p.match.test(name))?.id ?? null
}

const started = new Set<string>()

function fbq(): ((...args: unknown[]) => void) | null {
  if (typeof window === 'undefined') return null
  const w = window as any
  if (!w.fbq) {
    const n: any = function (...args: unknown[]) {
      if (n.callMethod) n.callMethod.apply(n, args)
      else n.queue.push(args)
    }
    w.fbq = n
    if (!w._fbq) w._fbq = n
    n.push = n
    n.loaded = true
    n.version = '2.0'
    n.queue = []
    const s = document.createElement('script')
    s.async = true
    s.src = 'https://connect.facebook.net/en_US/fbevents.js'
    document.head.appendChild(s)
  }
  return w.fbq
}

/** Load the pixel and send one PageView for it (once per page load). */
export function loadPixel(id: string) {
  const f = fbq()
  if (!f || started.has(id)) return
  started.add(id)
  f('init', id)
  f('trackSingle', id, 'PageView')
}

/** A completed guest list sign-up. eventID = the pass token. */
export function trackLead(id: string, eventID: string, data: Record<string, string | undefined> = {}) {
  const f = fbq()
  if (!f) return
  loadPixel(id)
  f('trackSingle', id, 'Lead', data, { eventID })
}
