'use client'
import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  tradesOn, tradingNightsBetween, nextTradingNight, birthdayWindow,
  shortNight, prettyNight, venueToday, addDays, tradingDaysLabel,
  type Blackout,
} from '@/lib/trading'
import { guestlistClosed, cutoffLabel } from '@/lib/guestlist-cutoff'
import { pixelForVenue, loadPixel, trackLead } from '@/lib/meta-pixel'
import { clampPlusOnes, cleanNames } from '@/lib/party'

interface Venue { id: string; name: string; trading_days?: number[] | null; guestlist_until?: string | null }

const OCCASIONS = ['Birthday', 'Hens party', 'Bucks party', 'Engagement', 'Anniversary', 'Graduation', 'Corporate / work', 'Other']

/**
 * `?occ=` on the link → the occasion the picker starts on. Matched on the
 * first word, case-insensitive ("birthday", "hens", "corporate"), so a link can
 * be typed by hand. Anything unrecognised starts on "no occasion", as before.
 */
export function occasionFromHint(hint: string | null | undefined): string {
  const h = (hint ?? '').trim().toLowerCase()
  if (!/^[a-z]{3,20}$/.test(h)) return ''
  return OCCASIONS.find(o => o.toLowerCase().split(/[\s/]+/)[0] === h) ?? ''
}

/** How far ahead the ordinary picker looks. Ten weeks is three months of Saturdays. */
const HORIZON_DAYS = 70

/**
 * Three optional props, each hiding one question the link has already answered.
 *
 * They are INDEPENDENT. A venue with no date is a valid link (this venue, any
 * night); a date with no venue is too (this night, any venue). Requiring both
 * was the first version of this and it was wrong — it made a New Year's link
 * across all six venues impossible to express.
 *
 * Defaults are the existing behaviour exactly: every caller that does not pass
 * these renders the form it rendered before, field for field.
 *
 * The values are still validated on submit exactly as before. Hiding a question
 * changes what is ASKED, never what is CHECKED.
 *
 * ── THE DATE FIELD IS NOW A LIST OF NIGHTS ──────────────────────────────────
 *
 * Trent, 14 Sep 2026: "theres birthdays going to guestlists on nights were not
 * open."
 *
 * It used to be `<input type="date">` with min=today and max=+1 year, which
 * accepted any of 365 days including the four or five a week the venue is shut.
 * A guest picked their actual birthday, got a confirmation and a QR code, and
 * arrived to a locked door. Fifty-five registrations were sitting on closed
 * nights when this was found.
 *
 * So the field offers the nights the venue OPENS and nothing else. That is a
 * smaller promise honestly kept, and it removes the error message entirely for
 * the common case — you cannot pick wrong if wrong is not on the list.
 *
 * ── AND FOR A BIRTHDAY IT IS A FORTNIGHT ────────────────────────────────────
 *
 * "they should have a date picker within 14 days for them to choose for their
 * birthdays."
 *
 * Anchored on the birthday itself when we know it, because the nights that
 * matter are the ones AROUND it. Somebody turning 21 on a Tuesday wants the
 * Friday after, not a date in November.
 *
 * ── AN ESCAPE HATCH, DELIBERATELY ───────────────────────────────────────────
 *
 * "Another date" reveals the old free input. Venues do open on odd nights, and
 * a guest who knows about one should not be stopped by a dropdown. The server
 * is still the authority: register_guest_vd refuses a closed night and hands
 * back the next open one, which is shown rather than swallowed.
 */
export function GuestRegistrationForm({
  promoterCode, venues, blackouts = [],
  lockedVenue = null, lockedDate = null, showOccasion = true, source = null, occasionHint = null,
  party = null,
  venueTiles = null, extraPixels = [], ctaLabel = null,
}: {
  promoterCode: string
  venues: Venue[]
  blackouts?: Blackout[]
  lockedVenue?: Venue | null
  lockedDate?: string | null
  showOccasion?: boolean
  source?: string | null
  occasionHint?: string | null
  /**
   * A party night (events.party, migration 0051): the guest can bring up to
   * `maxPlusOnes` friends on their own QR, optionally naming them. Only passed
   * for a locked venue + date that is a party night; null everywhere else, so
   * every other form is unchanged.
   */
  party?: { maxPlusOnes: number; texts: boolean } | null
  /**
   * The occasion landing pages (/birthday, /hens, /bucks, 24 Oct 2026): show
   * the venues as photo tiles instead of a dropdown. Keyed by venue id; null
   * for a venue with no photo, which gets a name tile. Every other caller
   * leaves this out and keeps the dropdown.
   */
  venueTiles?: Record<string, string | null> | null
  /** More pixels to send PageView and Lead to, beside the venue's own. */
  extraPixels?: string[]
  /** The submit button's words, when the page wants its own. */
  ctaLabel?: string | null
}) {
  const router = useRouter()
  const today = venueToday()
  const maxDate = addDays(today, 365)

  // No default: pre-selecting the first venue alphabetically meant guests who
  // skipped the field silently registered for Eclipse. Empty forces a choice,
  // and the submit handler already rejects a blank venue. A LOCKED link is the
  // one exception, and it is not the same thing — the venue was named in the
  // URL the guest scanned, not guessed on their behalf.
  const [venueId, setVenueId] = useState(lockedVenue?.id ?? '')
  const [date, setDate] = useState(lockedDate ?? '')
  const [freeDate, setFreeDate] = useState(false)
  const [occasion, setOccasion] = useState(() => occasionFromHint(occasionHint))
  const [f, setF] = useState({ first: '', last: '', mobile: '', email: '', dob: '', instagram: '' })
  const [consent, setConsent] = useState(false)
  const maxPlus = party ? clampPlusOnes(party.maxPlusOnes, party.maxPlusOnes) : 0
  const [plus, setPlus] = useState(0)
  const [friends, setFriends] = useState<string[]>([])
  const [err, setErr] = useState('')
  const [suggested, setSuggested] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }))

  const venue = useMemo(() => venues.find(v => v.id === venueId) ?? null, [venues, venueId])
  const tradingDays = venue?.trading_days ?? null
  // Meta Pixel, only for venues that run Meta ads to this form (Pump for now).
  const pixelId = pixelForVenue(venue?.name)
  useEffect(() => { if (pixelId) loadPixel(pixelId) }, [pixelId])
  const extraKey = extraPixels.join(',')
  useEffect(() => { for (const id of extraKey ? extraKey.split(',') : []) loadPixel(id) }, [extraKey])
  const pickVenue = (id: string) => { setVenueId(id); setDate(''); setErr(''); setSuggested(null) }
  // The nightly cut-off (Pump 11pm, Mamacita 10:30pm). Once it passes, tonight
  // is no longer on offer. The server refuses it too; this just says so first.
  const until = venue?.guestlist_until ?? null
  const untilLabel = cutoffLabel(until)
  const isBirthday = occasion === 'Birthday'

  // The window the guest chooses from. A birthday gets the fortnight around it;
  // anything else gets the next ten weeks.
  const window = useMemo(() => {
    if (isBirthday) return birthdayWindow(f.dob || null, today)
    return { from: today, to: addDays(today, HORIZON_DAYS) }
  }, [isBirthday, f.dob, today])

  const nights = useMemo(() => {
    if (!venueId) return []
    return tradingNightsBetween(window.from, window.to, tradingDays, blackouts, venueId)
      .filter(n => !guestlistClosed(n, until))
  }, [venueId, window.from, window.to, tradingDays, blackouts, until])

  // A chosen date that the venue is shut on. Only reachable through the escape
  // hatch or a hand-edited link, and said plainly rather than failing on submit.
  const chosenIsClosed = !!date && !!venueId && !tradesOn(date, tradingDays, blackouts, venueId)
  const closedAlternative = chosenIsClosed
    ? nextTradingNight(date, tradingDays, blackouts, venueId)
    : null

  // A night that trades but whose guest list has already closed — tonight,
  // after the cut-off, reached through a locked link or the free date input.
  const chosenIsShut = !!date && !chosenIsClosed && guestlistClosed(date, until)
  const shutAlternative = chosenIsShut
    ? nextTradingNight(addDays(date, 1), tradingDays, blackouts, venueId)
    : null

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setSuggested(null)
    if (!venueId) { setErr('Please choose a venue.'); return }
    if (!date) { setErr('Please choose a date.'); return }
    setLoading(true)
    try {
      const supabase = createClient()
      const base = {
        p_promoter_code: promoterCode, p_venue: venueId, p_date: date,
        p_first: f.first.trim(), p_last: f.last.trim(), p_mobile: f.mobile.trim(),
        p_email: f.email.trim(), p_dob: f.dob || null, p_instagram: f.instagram,
        p_marketing: consent, p_occasion: occasion || null, p_source: source,
      }
      // A party night registers through the wrapper that adds the friends; the
      // checks are the same function either way (register_guest_vd).
      const { data, error } = maxPlus > 0
        ? await supabase.rpc('register_guest_party', {
            ...base, p_plus_ones: plus, p_party_names: cleanNames(friends, plus),
          })
        : await supabase.rpc('register_guest_vd', base)
      if (error) throw error
      if (!data?.ok) {
        if (data?.error === 'not_trading') {
          // The one error worth more than a sentence: it comes with somewhere
          // to go, and a tap that goes there.
          setSuggested(data.suggested ?? null)
          setErr(`${venue?.name ?? 'This venue'} isn’t open on ${prettyNight(date)}.`)
          return
        }
        if (data?.error === 'guestlist_closed') {
          setSuggested(data.suggested ?? null)
          setErr(`The guest list for ${venue?.name ?? 'this venue'} on ${prettyNight(date)} has closed${untilLabel ? ` (it runs until ${untilLabel})` : ''}.`)
          return
        }
        const m: Record<string, string> = {
          duplicate: 'This mobile number is already on the list for that venue and date.',
          bad_date: 'Please choose a date within the next year.',
          venue_not_found: 'That venue is not available.',
          promoter_not_found: 'This promoter link is not active.',
          email_required: 'Please enter a valid email address to get on the list.',
        }
        setErr(m[data?.error] || 'Could not register. Please check your details.')
        return
      }
      // send the guest a confirmation email with their QR (non-blocking)
      try {
        fetch('/api/guest-confirmation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: data.qr_token }),
          keepalive: true,
        })
      } catch {}
      if (pixelId) trackLead(pixelId, data.qr_token, { content_name: venue?.name, content_category: occasion || 'guest list' })
      for (const id of extraPixels) {
        if (id !== pixelId) trackLead(id, data.qr_token, { content_name: venue?.name, content_category: occasion || 'guest list' })
      }
      router.push(`/g/${data.qr_token}`)
    } catch (e: any) {
      setErr(e.message || 'Something went wrong. Please try again.')
    } finally { setLoading(false) }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {(!lockedVenue || !lockedDate) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {!lockedVenue && venueTiles && (
            <fieldset className="sm:col-span-2">
              <legend className="label">Pick your club *</legend>
              <div className="grid grid-cols-2 gap-2.5">
                {venues.map(v => {
                  const img = venueTiles[v.id] ?? null
                  const on = v.id === venueId
                  return (
                    <button key={v.id} type="button" aria-pressed={on} onClick={() => pickVenue(v.id)}
                      className={`occ-tile text-left rounded-xl overflow-hidden border-2 transition ${on ? 'occ-tile-on' : 'border-white/[0.08]'}`}>
                      {img
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={img} alt="" className="block w-full h-[74px] object-cover" />
                        : <span className="flex h-[74px] items-center justify-center bg-white/[0.04] text-lg font-extrabold uppercase tracking-widest">{v.name}</span>}
                      <span className="block px-2.5 py-2 text-[13.5px] font-bold leading-tight">{v.name}</span>
                    </button>
                  )
                })}
              </div>
            </fieldset>
          )}
          {!lockedVenue && !venueTiles && (
            <div>
              <label className="label">Venue *</label>
              <select className="input" value={venueId}
                onChange={e => pickVenue(e.target.value)} required>
                {venues.length === 0
                  ? <option value="">No venues available</option>
                  : <option value="" disabled>Choose your venue</option>}
                {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
          )}
          {!lockedDate && (
            <div>
              <label className="label">Date *</label>
              {!venueId ? (
                <select className="input" disabled value="">
                  <option value="">Choose your venue first</option>
                </select>
              ) : freeDate ? (
                <input className="input" type="date" required min={today} max={maxDate}
                  value={date} onChange={e => { setDate(e.target.value); setSuggested(null) }} />
              ) : (
                <select className="input" value={date} required
                  onChange={e => { setDate(e.target.value); setErr(''); setSuggested(null) }}>
                  <option value="" disabled>
                    {nights.length ? 'Choose your night' : 'No nights available'}
                  </option>
                  {nights.map(n => <option key={n} value={n}>{shortNight(n)}</option>)}
                </select>
              )}
              <button type="button" className="text-[11px] text-luna-muted underline mt-1 hover:text-white"
                onClick={() => { setFreeDate(v => !v); setDate(''); setErr(''); setSuggested(null) }}>
                {freeDate ? 'Back to the list of nights' : 'Another date'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* What the list is showing, so a short list does not read as a broken one. */}
      {!lockedDate && venueId && !freeDate && (
        <p className="text-[11px] text-luna-muted -mt-3">
          {isBirthday
            ? `Birthday nights: ${venue?.name ?? 'this venue'} is open ${tradingDaysLabel(tradingDays)} — pick any night in the fortnight from ${prettyNight(window.from)}.`
            : `${venue?.name ?? 'This venue'} is open ${tradingDaysLabel(tradingDays)}.`}
          {nights.length === 0 && ' Nothing is open in that window — try “Another date”.'}
        </p>
      )}

      {venueId && untilLabel && (
        <p className="text-xs text-luna-goldsoft font-medium">
          Guest list entry is until {untilLabel} sharp. Arrive before then — after {untilLabel} the guest list no longer applies.
        </p>
      )}

      {showOccasion && (
        <div>
          <label className="label">Special occasion? <span className="text-luna-muted font-normal">(optional)</span></label>
          <select className="input" value={occasion} onChange={e => setOccasion(e.target.value)}>
            <option value="">No occasion — just vibes ✨</option>
            {OCCASIONS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <p className="text-[11px] text-luna-muted mt-1">
            {isBirthday
              ? 'Add your date of birth below and we’ll show you the nights around it.'
              : 'Let us know so the venue can look after you.'}
          </p>
        </div>
      )}

      {/* A closed night is the one case where the guest must not be allowed to
          sail through a form that looks fine and then be turned away at the
          door. Reachable via a locked link or the free-date escape hatch. */}
      {chosenIsClosed && (
        <p className="text-sm text-amber-400">
          {venue?.name ?? 'This venue'} isn’t open on {prettyNight(date)}.
          {closedAlternative && (
            <>
              {' '}
              <button type="button" className="underline font-semibold"
                onClick={() => { setDate(closedAlternative); setFreeDate(false) }}>
                Use {prettyNight(closedAlternative)} instead
              </button>
            </>
          )}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">First name *</label>
          <input className="input" required value={f.first} onChange={e => set('first', e.target.value)} />
        </div>
        <div>
          <label className="label">Last name *</label>
          <input className="input" required value={f.last} onChange={e => set('last', e.target.value)} />
        </div>
      </div>
      <div>
        <label className="label">Mobile number *</label>
        <input className="input" required type="tel" placeholder="04xx xxx xxx"
          value={f.mobile} onChange={e => set('mobile', e.target.value)} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Email *</label>
          <input className="input" type="email" required value={f.email} onChange={e => set('email', e.target.value)} />
        </div>
        <div>
          <label className="label">Date of birth {isBirthday && <span className="text-luna-gold font-normal">— sets your nights</span>}</label>
          <input className="input" type="date" max={today} value={f.dob} onChange={e => set('dob', e.target.value)} />
        </div>
      </div>
      <div>
        <label className="label">Instagram</label>
        <input className="input" placeholder="@handle" value={f.instagram} onChange={e => set('instagram', e.target.value)} />
      </div>
      {maxPlus > 0 && (
        <div>
          <label className="label">Bringing friends?</label>
          <div className="input !py-2 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="font-semibold">{plus === 0 ? 'Just me' : `Me +${plus}`}</div>
              <div className="text-[11px] text-luna-muted">Up to {maxPlus} friends on your pass</div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button type="button" aria-label="One fewer friend" disabled={plus === 0}
                className="w-10 h-10 rounded-lg border border-white/15 text-lg disabled:opacity-35"
                onClick={() => setPlus(p => Math.max(0, p - 1))}>−</button>
              <span className="w-6 text-center text-lg font-bold" aria-live="polite">{plus}</span>
              <button type="button" aria-label="One more friend" disabled={plus >= maxPlus}
                className="w-10 h-10 rounded-lg btn-gold !p-0 text-lg disabled:opacity-35"
                onClick={() => setPlus(p => Math.min(maxPlus, p + 1))}>+</button>
            </div>
          </div>
          {plus > 0 && (
            <div className="grid grid-cols-2 gap-2 mt-2">
              {Array.from({ length: plus }, (_, i) => (
                <input key={i} className="input" maxLength={40}
                  placeholder={`Friend ${i + 1}'s first name`} aria-label={`Friend ${i + 1}'s first name (optional)`}
                  value={friends[i] ?? ''}
                  onChange={e => setFriends(fs => { const n = [...fs]; n[i] = e.target.value; return n })} />
              ))}
            </div>
          )}
          {plus > 0 && <p className="text-[11px] text-luna-muted mt-1">Names are optional and help the door. Your one QR lets your whole group in.</p>}
        </div>
      )}
      <label className="flex items-start gap-3 text-sm cursor-pointer">
        <input type="checkbox" className="mt-1 accent-luna-gold w-4 h-4" checked={consent}
          onChange={e => setConsent(e.target.checked)} />
        <span className="text-luna-muted">I&apos;m happy for Luna Group to send me event updates and offers.</span>
      </label>
      {err && (
        <p className="text-sm text-red-400">
          {err}
          {suggested && (
            <>
              {' '}
              <button type="button" className="underline font-semibold"
                onClick={() => { setDate(suggested); setFreeDate(false); setErr(''); setSuggested(null) }}>
                Use {prettyNight(suggested)} instead
              </button>
            </>
          )}
        </p>
      )}
      {chosenIsShut && (
        <p className="text-sm text-amber-400">
          The guest list for {prettyNight(date)} has closed{untilLabel ? ` — it runs until ${untilLabel}` : ''}.
          {shutAlternative && (
            <>
              {' '}
              <button type="button" className="underline font-semibold"
                onClick={() => { setDate(shutAlternative); setFreeDate(false) }}>
                Use {prettyNight(shutAlternative)} instead
              </button>
            </>
          )}
        </p>
      )}

      <button className="btn-gold w-full btn-lg" disabled={loading || chosenIsClosed || chosenIsShut}>
        {loading ? 'Registering…' : ctaLabel ? ctaLabel : maxPlus > 0 ? 'Get my pass' : 'Get my QR code'}
      </button>
      {party && (
        <p className="text-[11px] text-luna-muted text-center">
          {party.texts
            ? 'We’ll email your pass and text it to you, with a reminder on the day.'
            : 'We’ll email your pass straight away.'}
        </p>
      )}
      <p className="text-[11px] text-luna-muted text-center leading-relaxed">
        Guestlist entry is subject to availability, venue capacity, dress code, valid 18+ ID and
        management discretion. Registering does not guarantee entry. Please arrive early to avoid disappointment.
      </p>
      <p className="text-[11px] text-luna-muted text-center">
        By registering you agree to our <a href="/terms" target="_blank" className="underline hover:text-white">Terms &amp; Conditions</a>.
      </p>
    </form>
  )
}
