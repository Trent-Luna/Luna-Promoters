// Best-effort per-instance rate limit, the same approach as the university
// sign-up. Enough to slow a script down; the database is what keeps the
// count honest.
const HITS = new Map<string, number[]>()

export function rateLimited(key: string, limit = 6, windowMs = 60_000, now = Date.now()): boolean {
  const arr = (HITS.get(key) || []).filter(t => now - t < windowMs)
  arr.push(now)
  HITS.set(key, arr)
  if (HITS.size > 5000) HITS.clear()
  return arr.length > limit
}

export function clientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
}
