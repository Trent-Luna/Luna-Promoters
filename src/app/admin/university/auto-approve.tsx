'use client'
import { useState, useTransition } from 'react'
import { setUniversityAutoApprove, setUniversityApproveAll } from '../actions'

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

/**
 * Approve every application regardless of what the ID check found.
 *
 * Styled as a warning rather than a plain switch because it is one: while it
 * is on, a blurry photo, an expired card, a name that does not match and a
 * document that is not a student ID all become approved memberships. It is
 * meant for a campus sign-up night where a queue of real students is standing
 * in front of you, not as a standing setting.
 *
 * It does NOT approve under-18s. That is enforced in the database, not here.
 */
export function UniversityApproveAllToggle({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial)
  const [pending, start] = useTransition()

  function toggle() {
    const next = !on
    setOn(next)
    start(() => setUniversityApproveAll(next).catch(() => setOn(!next)))
  }

  return (
    <div
      className="card p-4 flex items-center justify-between gap-4 mb-4"
      style={on ? { borderColor: '#e0603a' } : undefined}
    >
      <div>
        <p className="font-semibold">
          Approve everyone{on && <span className="ml-2 text-xs font-normal" style={{ color: '#e0603a' }}>ON</span>}
        </p>
        <p className="text-xs text-luna-muted">
          {on
            ? 'Every sign-up is approved on the spot — the ID check still runs and is recorded, but its verdict is ignored.'
            : 'Off. Applications are decided by the ID check.'}
        </p>
        <p className="text-xs text-luna-muted mt-1 opacity-70">
          Applicants under 18 are still rejected. Overridden approvals are tagged
          &ldquo;approved_by_override&rdquo; so you can find them later.
        </p>
      </div>
      <button
        onClick={toggle}
        disabled={pending}
        role="switch"
        aria-checked={on}
        aria-label="Approve every university sign-up"
        className={`relative w-14 h-8 rounded-full transition shrink-0 ${on ? '' : 'bg-luna-border'}`}
        style={on ? { backgroundColor: '#e0603a' } : undefined}
      >
        <span className={`absolute top-1 w-6 h-6 rounded-full transition-all ${on ? 'left-7 bg-white' : 'left-1 bg-luna-muted'}`} />
      </button>
    </div>
  )
}
