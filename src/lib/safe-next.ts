/**
 * Validate a post-login return path.
 *
 * Only internal, absolute paths are allowed — this prevents open redirects where
 * `?next=` is attacker-controlled. Rejects protocol-relative URLs (`//host`),
 * absolute external URLs (`https://…`), backslash tricks, and userinfo tricks.
 * Falls back to the app's role-router (`/dashboard`) when the value is unsafe.
 */
export function safeNextPath(raw: string | null | undefined, fallback = '/dashboard'): string {
  if (!raw || typeof raw !== 'string') return fallback
  if (!raw.startsWith('/')) return fallback
  if (raw.startsWith('//')) return fallback
  if (raw.includes('\\') || raw.includes('://') || raw.includes('@')) return fallback
  return raw
}
