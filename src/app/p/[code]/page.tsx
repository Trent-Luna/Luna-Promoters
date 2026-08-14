import { createClient } from '@/lib/supabase/server'
import { Logo } from '@/components/Logo'
import { GuestRegistrationForm } from './guest-form'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

/**
 * A promoter's guestlist link, with the questions it asks made configurable.
 *
 * NOTHING HERE CHANGES THE EXISTING PLATFORM. A link with no parameters —
 * every promoter link, every printed code, the public guestlist page — renders
 * exactly what it rendered before, field for field. Each parameter below is a
 * switch that is off unless a link turns it on.
 *
 *   ?v=eclipse    one venue: the dropdown becomes a heading
 *   ?d=2026-08-14 one night: the date picker becomes a heading
 *   ?t=…          the heading text, for when "Eclipse" is not what to call it
 *   ?o=0          hide the special-occasion picker
 *
 * They are INDEPENDENT. One venue across many dates, one date across every
 * venue, or both — a New Year's link that spans all six venues is as valid as
 * a single-night one, which is the case that made all-or-nothing wrong.
 *
 * Why query parameters rather than a new route or an events table: the QR code
 * on the poster is read-only forever, but it points at a CRM signup link whose
 * target is editable. So the configuration lives in a field somebody can edit
 * in the CRM at 9pm, and the poster on the wall never has to be reprinted.
 *
 * The lock is VALIDATED, not trusted. `v` must be one of the venues this link
 * already offers, and `d` must be a real date that is not in the past — so a
 * hand-edited URL can only ever reach a night the untouched form could also
 * have reached. It cannot smuggle in a closed venue, and it cannot backdate a
 * registration.
 */
export default async function PromoterLink({
  params, searchParams,
}: {
  params: Promise<{ code: string }>
  searchParams: Promise<{ v?: string; d?: string; t?: string; o?: string }>
}) {
  const { code } = await params
  const { v, d, t, o } = await searchParams
  const supabase = await createClient()

  const { data } = await supabase.rpc('get_promoter_link', { p_code: code })
  if (!data) notFound()

  const promoter = { full_name: data.full_name as string, promoter_code: data.promoter_code as string }
  const venues = (data.venues ?? []) as { id: string; name: string }[]
  const blackouts = (data.blackouts ?? []) as { venue_id: string | null; date: string }[]

  // Only a venue this link already offers. An unknown value falls through to
  // the ordinary form rather than erroring — a mistyped poster should still
  // take registrations, just without the lock.
  //
  // Matched on NAME as well as id, and the name is why. A UUID costs 36
  // characters, and those characters land in a QR code that somebody has to
  // scan across a dark room: `?v=eclipse` prints a materially less dense code
  // than `?v=39b4c0ae-bf0c-4774-b16e-8151192267af`, which is the difference
  // between one scan and three. It also means these links can be written by
  // hand without a database lookup.
  const wanted = (v ?? '').trim().toLowerCase().replace(/\s+/g, '')
  const lockedVenue = wanted
    ? venues.find((x) => x.id === v || x.name.toLowerCase().replace(/\s+/g, '') === wanted) ?? null
    : null

  // A date, in the venue's own terms. `new Date('2026-08-14')` parses as UTC
  // midnight, which in Brisbane is 10am the same day — so comparing it against
  // a UTC "today" is off by ten hours and would black out tonight's event for
  // anybody scanning after 2pm. Compared as strings instead, which is exact.
  const today = new Date(Date.now() + 10 * 3600_000).toISOString().slice(0, 10)
  const lockedDate = d && /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= today ? d : null

  // Either switch on its own counts as configured. A link can name the venue
  // and leave the date open, or name the night across every venue.
  const anyLock = Boolean(lockedVenue || lockedDate)

  const prettyDate = lockedDate
    ? new Date(`${lockedDate}T12:00:00`).toLocaleDateString('en-AU', {
        weekday: 'long', day: 'numeric', month: 'long',
      })
    : null

  // The line under the heading says only what has actually been fixed. A link
  // locked to a venue but not a date must not print a date nobody chose.
  const subtitle = [lockedVenue?.name, prettyDate].filter(Boolean).join(' · ')

  // `o=0` hides the occasion picker. Not implied by a lock: a venue's Saturday
  // link is still a place where somebody will type "birthday", and losing that
  // would cost the venue a table it would otherwise have looked after.
  const showOccasion = o !== '0'

  return (
    <main className="min-h-screen">
      <header className="max-w-lg mx-auto px-5 pt-8"><Logo size={32} /></header>
      <section className="max-w-lg mx-auto px-5 pt-8 pb-4 text-center">
        <span className="pill bg-luna-purple/15 text-luna-goldsoft mb-3">Guestlist</span>
        {anyLock ? (
          <>
            <h1 className="text-3xl font-extrabold">
              {t ? t.slice(0, 90) : lockedVenue?.name ?? 'Guestlist'}
            </h1>
            {subtitle && <p className="text-luna-goldsoft mt-1 font-medium">{subtitle}</p>}
            <p className="text-luna-muted mt-2">
              {lockedVenue && lockedDate
                ? 'Add your details and you’ll get a QR code to show at the door.'
                : lockedVenue
                  ? 'Pick your date, add your details, and you’ll get a QR code to show at the door.'
                  : 'Pick your venue, add your details, and you’ll get a QR code to show at the door.'}
            </p>
          </>
        ) : (
          <>
            <h1 className="text-3xl font-extrabold">You&apos;re on {promoter.full_name.split(' ')[0]}&apos;s list</h1>
            <p className="text-luna-muted mt-2">
              Pick your venue and date, add your details, and you&apos;ll get a QR code to show at the door.
            </p>
          </>
        )}
      </section>
      <section className="max-w-lg mx-auto px-5 pb-16">
        <div className="card p-6">
          {venues.length === 0 ? (
            <p className="text-center text-luna-muted py-8">No venues are available right now. Check back soon!</p>
          ) : (
            <GuestRegistrationForm
              promoterCode={promoter.promoter_code}
              venues={venues}
              blackouts={blackouts}
              lockedVenue={lockedVenue}
              lockedDate={lockedDate}
              showOccasion={showOccasion}
            />
          )}
        </div>
      </section>
    </main>
  )
}
