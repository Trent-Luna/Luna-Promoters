// Where the Atlas handoff sends someone it authenticated but cannot admit.
//
// Deliberately not the login form. These people ARE signed in to Atlas — the
// handoff worked. Showing them a password box for an app they were never
// granted teaches them the system is broken when it is behaving correctly, and
// sends them looking for a password that does not exist.

import Link from 'next/link'

const ATLAS_URL = process.env.NEXT_PUBLIC_ATLAS_URL || 'https://atlas.lunagroup.com.au'

/** Plain-English reasons. The slug is the fallback, never the headline. */
const REASONS: Record<string, string> = {
  not_permitted:
    'Your Atlas role does not include the promoter and guestlist tools. Head Office and venue managers have access here.',
  no_venues_here:
    'You manage venues in Atlas, but none of them are set up in this app yet — so there would be nothing for you to see.',
  sso_denied: 'Atlas declined the sign-in. The link may have already been used, or it may have expired.',
  bad_code: 'That sign-in link was not valid. Open the app from the Atlas sidebar rather than a saved link.',
  bad_payload: 'The sign-in did not complete cleanly. Try opening it from Atlas again.',
}

export default function AccessDenied({
  searchParams,
}: {
  searchParams: { ref?: string }
}) {
  // Re-sanitised here as well as where it is set: this value arrives in the
  // query string, and a page that renders whatever it is handed is a page that
  // can be made to say anything by sending someone a link.
  const ref = (searchParams.ref ?? '').replace(/[^a-z0-9_:.-]/gi, '').slice(0, 48)
  const message =
    REASONS[ref] ??
    'You are signed in to Atlas, but this app is not part of your access.'

  return (
    <main className="min-h-screen flex items-center justify-center px-5">
      <div className="card w-full max-w-md p-8 text-center">
        <h1 className="text-xl font-bold">You don&rsquo;t have access to this app</h1>
        <p className="mt-3 text-sm text-luna-muted leading-relaxed">{message}</p>
        <p className="mt-3 text-sm text-luna-muted leading-relaxed">
          If you think that&rsquo;s wrong, ask Trent to check your access in Atlas.
        </p>

        <div className="mt-6 flex flex-col gap-2">
          <a href={ATLAS_URL} className="btn-gold w-full">
            Back to Atlas
          </a>
          <Link href="/login" className="btn-ghost w-full">
            Sign in with a password instead
          </Link>
        </div>

        {ref && <p className="mt-6 text-[11px] text-luna-muted">Reference: {ref}</p>}
      </div>
    </main>
  )
}
