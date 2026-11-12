'use client'
import { suggestGuestEmail } from '@/lib/guest-email'

/**
 * "Did you mean name@gmail.com?" — a tap fills the field. Shown only when
 * we have a guess; submitting still sends whatever is in the field.
 */
export function EmailSuggestion({ email, onAccept }: {
  email: string
  onAccept: (next: string) => void
}) {
  const next = suggestGuestEmail(email)
  if (!next) return null
  return (
    <button
      type="button"
      onClick={() => onAccept(next)}
      className="mt-1.5 block text-left text-sm font-semibold text-luna-gold underline"
    >
      Did you mean {next}?
    </button>
  )
}
