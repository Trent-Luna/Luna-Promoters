/**
 * Guest-list email check.
 *
 * The CRM rejects addresses the guest list used to store: no real domain
 * (`name@gmail`, `name@t`) and near-misses of the providers people in
 * Australia actually use (`gnail`, `gmailcom`, `hotnail`). A typed address is
 * only replaced when the guest taps the suggestion — nothing here rewrites
 * it on its own.
 *
 * Kept in step with public.guest_email_ok in
 * supabase/migrations/0060_guest_email_domain.sql. Change both together.
 */

const BRANDS = ['gmail', 'hotmail', 'outlook', 'icloud', 'live', 'yahoo', 'bigpond'] as const

const CANONICAL = new Set(BRANDS.flatMap(brand => [`${brand}.com`, `${brand}.com.au`]))

/** Shown under the field and when a submit is refused. */
export const INVALID_GUEST_EMAIL =
  'That email doesn’t look right — it needs a full address, like name@gmail.com.'

export function isValidGuestEmail(raw: string): boolean {
  const email = raw.trim()
  if (!email || email.length > 254) return false
  const at = email.indexOf('@')
  if (at <= 0 || at !== email.lastIndexOf('@')) return false
  const local = email.slice(0, at)
  const domain = email.slice(at + 1)
  if (!local || local.length > 64 || /\s/.test(local)) return false
  if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false
  if (!domain || domain.length > 253 || /\s/.test(domain)) return false
  const labels = domain.split('.')
  if (labels.length < 2) return false
  const tld = labels[labels.length - 1]
  if (!/^[A-Za-z]{2,24}$/.test(tld)) return false
  for (const label of labels) {
    if (!label || label.length > 63) return false
    if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/.test(label)) return false
  }
  return true
}

/**
 * A tap-to-accept correction, or null when we should leave what they typed
 * alone. Null covers three cases: already fine, not close to a provider we
 * know, and junk too short to guess (`@t`, `@g`, `@ail`).
 */
export function suggestGuestEmail(raw: string): string | null {
  const trimmed = raw.trim()
  const at = trimmed.indexOf('@')
  if (at <= 0 || at !== trimmed.lastIndexOf('@')) return null
  const local = trimmed.slice(0, at).trim()
  const domainRaw = trimmed.slice(at + 1).trim()
  if (!local || /\s/.test(local) || !domainRaw || /\s/.test(domainRaw)) return null
  const domain = suggestDomain(domainRaw)
  if (!domain) return null
  const next = `${local}@${domain}`
  if (next.toLowerCase() === trimmed.toLowerCase()) return null
  return next
}

function suggestDomain(raw: string): string | null {
  const domain = raw.trim().toLowerCase().replace(/\.+/g, '.').replace(/^\./, '').replace(/\.$/, '')
  if (!domain || domain.includes('@')) return null
  if (CANONICAL.has(domain)) return null
  // .co.uk, .edu.au, .net.au and anything else with its own TLD is left alone.
  // The typos we see are a bare provider name, or that name with a broken .com.
  if (domain.includes('.') && !/\.(com|co|con|cmo|cm|comm|om|co\.au|com\.au|com\.a|com\.u|comau)$/.test(domain)) {
    return null
  }

  let best = Infinity
  const winners = new Set<string>()
  for (const brand of BRANDS) {
    for (const candidate of candidates(brand)) {
      const dist = editDistance(domain, candidate.key)
      if (!closeEnough(domain, candidate.key, dist)) continue
      if (dist < best) {
        best = dist
        winners.clear()
        winners.add(candidate.domain)
      } else if (dist === best) {
        winners.add(candidate.domain)
      }
    }
  }
  if (winners.size === 0) return null
  if (winners.size === 1) return [...winners][0]
  const au = [...winners].find(item => item.endsWith('.com.au'))
  const com = [...winners].find(item => item.endsWith('.com') && !item.endsWith('.com.au'))
  if (au && com && winners.size === 2 && au.slice(0, -7) === com.slice(0, -4)) {
    return /au|\.a$/.test(domain) ? au : com
  }
  return null
}

function candidates(brand: string): { key: string; domain: string }[] {
  return [
    { key: brand, domain: `${brand}.com` },
    { key: `${brand}com`, domain: `${brand}.com` },
    { key: `${brand}.com`, domain: `${brand}.com` },
    { key: `${brand}comau`, domain: `${brand}.com.au` },
    { key: `${brand}.comau`, domain: `${brand}.com.au` },
    { key: `${brand}.com.au`, domain: `${brand}.com.au` },
    { key: `${brand}.co.au`, domain: `${brand}.com.au` },
  ]
}

/**
 * Distance 0 always counts (so `live`, which is only four letters, still
 * suggests live.com). A one-letter slip needs five letters to guess from.
 * Two slips need six — `iclpid` → icloud, while `@ail` stays a refusal.
 */
function closeEnough(input: string, candidate: string, dist: number): boolean {
  if (dist === 0) return true
  if (!input || input[0] !== candidate[0]) return false
  const shortest = Math.min(input.length, candidate.length)
  if (shortest < 5 || Math.abs(input.length - candidate.length) > dist) return false
  if (dist === 1) return true
  return dist === 2 && shortest >= 6
}

/** Damerau–Levenshtein, so a swap (`gmial`) counts as one slip, not two. */
function editDistance(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const d: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0))
  for (let i = 0; i <= m; i++) d[i][0] = i
  for (let j = 0; j <= n; j++) d[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
      }
    }
  }
  return d[m][n]
}
