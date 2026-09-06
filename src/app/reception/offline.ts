/**
 * Offline support for the door: tonight's list cached per venue+date, and a
 * queue of check-ins made without signal. localStorage on purpose — it is
 * synchronous, survives reloads, and a night's list is a few hundred rows.
 * Every access is wrapped: private browsing and quota errors must never take
 * the door down.
 */
export type QueuedCheckIn =
  | { kind: 'registration'; registrationId: string; noEntry: boolean; at: string }
  | { kind: 'token'; token: string; noEntry: boolean; date: string; at: string }

const QUEUE_KEY = 'door:queue:v1'

export function cacheKey(venueId: string, date: string) { return `door:cache:v1:${venueId}:${date}` }

export function loadCache<T>(key: string): { rows: T[]; at: string } | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || !Array.isArray(parsed.rows)) return null
    return parsed
  } catch { return null }
}

export function saveCache<T>(key: string, value: { rows: T[]; at: string }) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    // keep only the eight most recent nights on this device
    const keys = Object.keys(localStorage).filter(k => k.startsWith('door:cache:v1:')).sort()
    for (const k of keys.slice(0, Math.max(0, keys.length - 8))) localStorage.removeItem(k)
  } catch { /* quota or private mode: live-only */ }
}

export function loadQueue(): QueuedCheckIn[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr : []
  } catch { return [] }
}

export function saveQueue(items: QueuedCheckIn[]) {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(items)) } catch { /* ignore */ }
}
