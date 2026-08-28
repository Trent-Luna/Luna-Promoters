'use client'
import { useState, useTransition } from 'react'
import { setUniversityAutoApprove } from '../actions'

/**
 * Whether a university ID that passes every check is approved on the spot.
 *
 * Deliberately says what happens to a FAILING check too. The promoter version
 * of this switch only governs a queue; this one sits next to an identity
 * document and an under-18 rule, and somebody turning it off needs to know
 * they have not just made the venue's ID checking stricter.
 */
export function UniversityAutoApproveToggle({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial)
  const [pending, start] = useTransition()

  function toggle() {
    const next = !on
    setOn(next)
    start(() => setUniversityAutoApprove(next).catch(() => setOn(!next)))
  }

  return (
    <div className="card p-4 flex items-center justify-between gap-4 mb-4">
      <div>
        <p className="font-semibold">Auto-approve university sign-ups</p>
        <p className="text-xs text-luna-muted">
          {on
            ? 'A student ID that passes every check is approved instantly and the pass works straight away.'
            : 'Every sign-up waits in the manual review queue, including the ones that pass every check.'}
        </p>
        <p className="text-xs text-luna-muted mt-1 opacity-70">
          Failed checks — an expired card, a document that is not a student ID, an applicant under 18 —
          are rejected either way.
        </p>
      </div>
      <button
        onClick={toggle}
        disabled={pending}
        role="switch"
        aria-checked={on}
        aria-label="Auto-approve university sign-ups"
        className={`relative w-14 h-8 rounded-full transition shrink-0 ${on ? 'bg-white' : 'bg-luna-border'}`}
      >
        <span className={`absolute top-1 w-6 h-6 rounded-full transition-all ${on ? 'left-7 bg-black' : 'left-1 bg-luna-muted'}`} />
      </button>
    </div>
  )
}
