// Off Campus Thursdays — pure logic shared by the pages, the door and tests.
//
// The database decides what counts (supabase/migrations/0057_off_campus.sql).
// This file only turns its answers into words and keeps the few rules the
// browser also needs (name cleaning, captions, the door result) in one place
// so the pages and the door can't drift apart.

export const OC = {
  night: '#0B0812',
  panel: '#161022',
  line: '#3A2F52',
  chalk: '#F0EDF8',
  haze: '#B8B0CC',
  lilac: '#A78BFA',
  ice: '#7DD3FC',
} as const

export type Period = 'week' | 'month' | 'season'
export type Level = 'team' | 'university'

export interface NightInfo {
  id: string
  date: string            // YYYY-MM-DD, the Thursday
  week_no: number | null
  opens_at: string
  closes_at: string
  season: { id: string; number: number; name: string; weeks: number } | null
  rooftop_note: string | null
  club_note: string | null
  lineup: string | null
  perk_note: string | null
}

export interface BoardRow {
  rank: number
  key?: string | null
  name: string
  uni: string | null
  n: number | null
  masked: boolean
}

export interface Board {
  ok: boolean
  error?: string
  period?: Period
  level?: Level
  night: NightInfo | null
  nights_counted?: number
  month?: string
  rows: BoardRow[]
  previous?: Record<string, number> | null
  booth?: { team: string; uni: string | null; n: number } | null
  min_public_count?: number
}

// ── Names ─────────────────────────────────────────────────────────────────

/** Mirrors public.offcampus_name_key: two names are the same club when these match. */
export function nameKey(s: string | null | undefined): string | null {
  const k = (s ?? '').replace(/&/g, ' and ').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  return k === '' ? null : k
}

/** Mirrors public.offcampus_clean_name: trimmed, single spaces, at most 60 characters. */
export function cleanName(s: string | null | undefined): string | null {
  const c = (s ?? '').replace(/\s+/g, ' ').trim().slice(0, 60).trim()
  return c === '' ? null : c
}

export function firstName(full: string | null | undefined): string {
  return (full ?? '').trim().split(/\s+/)[0] ?? ''
}

// ── Brisbane dates ────────────────────────────────────────────────────────

const TZ = 'Australia/Brisbane'

/** "Thu 12 Nov" for a YYYY-MM-DD date (read as a calendar day, not an instant). */
export function dayLabel(date: string): string {
  const d = new Date(`${date}T12:00:00+10:00`)
  return new Intl.DateTimeFormat('en-AU', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' })
    .format(d).replace(',', '')
}

/** "7pm", "10:42pm" in Brisbane time. */
export function timeLabel(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-AU', { timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true })
    .formatToParts(new Date(iso))
  const h = parts.find(p => p.type === 'hour')?.value ?? ''
  const m = parts.find(p => p.type === 'minute')?.value ?? '00'
  const ap = (parts.find(p => p.type === 'dayPeriod')?.value ?? '').toLowerCase().replace(/\./g, '')
  return `${h}${m === '00' ? '' : `:${m}`}${ap}`
}

/** "7pm to 3am" for a door window. */
export function windowLabel(opens: string, closes: string): string {
  return `${timeLabel(opens)} to ${timeLabel(closes)}`
}

/** The month a night falls in, e.g. "November", in Brisbane. */
export function monthLabel(date: string): string {
  return new Intl.DateTimeFormat('en-AU', { timeZone: TZ, month: 'long' }).format(new Date(`${date}T12:00:00+10:00`))
}

// ── Results captions ──────────────────────────────────────────────────────

/**
 * The line under the results tabs. The season line names the $5,000 race only
 * when the prize is being shown publicly.
 */
export function boardCaption(b: Pick<Board, 'night' | 'nights_counted'>, period: Period, level: Level, showPrizes: boolean): string {
  const n = b.night
  if (!n) return ''
  const by = level === 'university' ? 'by university' : 'by club'
  if (period === 'week') {
    return `${n.week_no ? `Week ${n.week_no} · ` : ''}${dayLabel(n.date)} · ${by}`
  }
  const count = b.nights_counted ?? 0
  if (period === 'month') {
    return `${monthLabel(n.date)} so far · ${count} Thursday${count === 1 ? '' : 's'} · ${by}`
  }
  if (!n.season) return `All Thursdays so far · ${by}`
  const upTo = n.week_no ?? count
  const weeks = upTo <= 1 ? 'week 1' : `weeks 1 to ${upTo}`
  return `${n.season.name} · ${weeks} of ${n.season.weeks}${showPrizes ? ' · the $5,000 race' : ''} · ${by}`
}

/** Width of a result bar as a share of the leader, 6% minimum so a 1 still shows. */
export function barShare(n: number | null, top: number | null): number {
  if (n == null || top == null || top <= 0) return 0.06
  return Math.max(0.06, Math.min(1, n / top))
}

/** What a public row shows in place of a count. */
export function countText(r: Pick<BoardRow, 'n' | 'masked'>, min = 3): string {
  if (r.masked || r.n == null) return `<${min}`
  return String(r.n)
}

// ── Sign-up ───────────────────────────────────────────────────────────────

export const REGISTER_ERRORS: Record<string, string> = {
  closed: 'Off Campus sign-ups aren’t open yet.',
  missing_fields: 'Please fill in your name, email and mobile.',
  bad_email: 'That email doesn’t look right.',
  bad_mobile: 'That mobile number doesn’t look right.',
  age_required: 'Please confirm you’re 18 or over.',
  privacy_required: 'Please agree to the privacy notice to join.',
  bad_university: 'Please choose your university.',
  bad_team: 'Please choose your club or society again.',
  already_registered: 'This email or mobile is already registered. Use the same email and mobile you signed up with to get your pass back.',
  rate_limited: 'Too many tries. Wait a minute and try again.',
  locked: 'You’ve already been counted this season, so your club can only be changed by the Su Casa team.',
  not_found: 'We couldn’t find that pass.',
  error: 'Something went wrong. Please try again.',
}

export function registerError(code: string | null | undefined): string {
  return REGISTER_ERRORS[code ?? 'error'] ?? REGISTER_ERRORS.error
}

/** Basic checks before the form is sent. The database checks again. */
export function validateRegistration(f: {
  full_name: string; email: string; mobile: string; university: string
  club: string; new_club: string; age: boolean; privacy: boolean
}): string | null {
  if (!cleanName(f.full_name) || cleanName(f.full_name)!.length < 2 || !f.email.trim() || !f.mobile.trim()) return 'missing_fields'
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim())) return 'bad_email'
  const digits = f.mobile.replace(/\D/g, '')
  if (digits.length < 8 || digits.length > 15) return 'bad_mobile'
  if (!f.university) return 'bad_university'
  if (f.club === '__new' && (cleanName(f.new_club)?.length ?? 0) < 2) return 'bad_team'
  if (!f.club) return 'bad_team'
  if (!f.age) return 'age_required'
  if (!f.privacy) return 'privacy_required'
  return null
}

// ── The door ──────────────────────────────────────────────────────────────

export interface DoorResult { kind: 'ok' | 'warn' | 'err'; title: string; sub?: string }

/** The pass QR points here; the door console recognises it. */
export const DOOR_PATH = '/offcampus/door/'

export function doorTokenFrom(text: string): string | null {
  const m = text.match(/\/offcampus\/door\/([A-Za-z0-9_-]+)/)
  return m ? m[1] : null
}

/** Turn offcampus_check_in's answer into what the door screen says. */
export function doorResult(r: any): DoorResult {
  if (!r) return { kind: 'err', title: 'CHECK-IN FAILED' }
  const who = r.first_name ? String(r.first_name) : ''
  const club = r.team ? String(r.team) : r.university ? `${r.university}${r.pending_team ? ' (club pending)' : ''}` : ''
  if (r.ok) return { kind: 'ok', title: 'COUNTED', sub: [who, club].filter(Boolean).join(' · ') }
  switch (r.error) {
    case 'already':
      return { kind: 'warn', title: 'ALREADY COUNTED', sub: `${who}${r.at ? ` · at ${timeLabel(r.at)}` : ''}${r.by ? ` by ${r.by}` : ''}` }
    case 'no_night': return { kind: 'err', title: 'NO CLUB NIGHT OPEN', sub: 'Off Campus only counts during Thursday’s door window' }
    case 'self_scan': return { kind: 'err', title: 'OWN PASS', sub: 'Staff can’t count their own pass' }
    case 'suspended': return { kind: 'err', title: 'SUSPENDED', sub: [who, r.reason].filter(Boolean).join(' · ') }
    case 'not_found': return { kind: 'err', title: 'NOT RECOGNISED', sub: 'Not an Off Campus pass' }
    case 'not_authorised': return { kind: 'err', title: 'NOT SU CASA STAFF', sub: 'Only Su Casa door staff can count arrivals' }
    case 'closed': return { kind: 'err', title: 'OFF CAMPUS IS OFF', sub: 'Switched off in admin' }
    default: return { kind: 'err', title: 'CHECK-IN FAILED', sub: r.error ? String(r.error) : undefined }
  }
}

// ── Admin ─────────────────────────────────────────────────────────────────

/** CSV with every cell quoted, for the admin exports. */
export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return ''
  const cols = Object.keys(rows[0])
  const q = (v: unknown) => {
    const s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v)
    // Spreadsheet formula injection: a cell starting with = + - @ is read as a formula.
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s
    return `"${safe.replace(/"/g, '""')}"`
  }
  return [cols.map(q).join(','), ...rows.map(r => cols.map(c => q(r[c])).join(','))].join('\n')
}

/** Brisbane wall-clock "YYYY-MM-DDTHH:mm" for an instant, for datetime-local inputs. */
export function toLocalInput(iso: string): string {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
    .formatToParts(new Date(iso))
  const g = (t: string) => p.find(x => x.type === t)?.value ?? '00'
  const hh = g('hour') === '24' ? '00' : g('hour')
  return `${g('year')}-${g('month')}-${g('day')}T${hh}:${g('minute')}`
}

/** A Brisbane wall-clock "YYYY-MM-DDTHH:mm" as an instant. Queensland has no daylight saving. */
export function fromLocalInput(v: string): string {
  return new Date(`${v}:00+10:00`).toISOString()
}
