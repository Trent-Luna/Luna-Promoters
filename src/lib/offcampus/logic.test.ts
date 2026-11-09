import { describe, it, expect } from 'vitest'
import {
  nameKey, cleanName, firstName, dayLabel, timeLabel, windowLabel, boardCaption, barShare, countText,
  validateRegistration, doorTokenFrom, doorResult, toCsv, toLocalInput, fromLocalInput, registerError,
} from './logic'

const night = (over: Partial<any> = {}) => ({
  id: 'n1', date: '2026-11-12', week_no: 1,
  opens_at: '2026-11-12T09:00:00Z', closes_at: '2026-11-12T17:00:00Z',
  season: { id: 's1', number: 1, name: 'Season 01', weeks: 12 },
  rooftop_note: null, club_note: null, lineup: null, perk_note: null, ...over,
})

describe('club names', () => {
  it('treats spacing, case and punctuation as the same club (mirrors offcampus_name_key)', () => {
    expect(nameKey('UQ Netball Club')).toBe('uq netball club')
    expect(nameKey('  uq  NETBALL club! ')).toBe('uq netball club')
    expect(nameKey('Law & Commerce Society')).toBe(nameKey('Law and Commerce Society'))
    expect(nameKey('   ')).toBeNull()
  })
  it('cleans display names to one line of at most 60 characters', () => {
    expect(cleanName('  Rowing   Club ')).toBe('Rowing Club')
    expect(cleanName('x'.repeat(80))!.length).toBe(60)
    expect(cleanName('')).toBeNull()
  })
  it('shows a first name only', () => {
    expect(firstName('Alex  Sample Person')).toBe('Alex')
  })
})

describe('Brisbane time', () => {
  it('labels the Thursday by its calendar day', () => {
    expect(dayLabel('2026-11-12')).toBe('Thu 12 Nov')
  })
  it('formats door times in Brisbane, not the server clock', () => {
    // 09:00Z is 7pm in Brisbane; 17:00Z is 3am Friday
    expect(timeLabel('2026-11-12T09:00:00Z')).toBe('7pm')
    expect(timeLabel('2026-11-12T12:42:00Z')).toBe('10:42pm')
    expect(windowLabel('2026-11-12T09:00:00Z', '2026-11-12T17:00:00Z')).toBe('7pm to 3am')
  })
  it('round-trips datetime-local values as Brisbane wall-clock time', () => {
    expect(toLocalInput('2026-11-12T17:00:00Z')).toBe('2026-11-13T03:00')
    expect(fromLocalInput('2026-11-13T03:00')).toBe('2026-11-12T17:00:00.000Z')
  })
})

describe('results', () => {
  it('captions each period', () => {
    expect(boardCaption({ night: night(), nights_counted: 1 }, 'week', 'team', true)).toBe('Week 1 · Thu 12 Nov · by club')
    expect(boardCaption({ night: night({ date: '2026-12-10', week_no: 5 }), nights_counted: 2 }, 'month', 'university', true))
      .toBe('December so far · 2 Thursdays · by university')
    expect(boardCaption({ night: night({ date: '2026-12-10', week_no: 5 }), nights_counted: 5 }, 'season', 'team', true))
      .toBe('Season 01 · weeks 1 to 5 of 12 · the $5,000 race · by club')
  })
  it('names the $5,000 race only when prizes are shown', () => {
    expect(boardCaption({ night: night(), nights_counted: 1 }, 'season', 'team', false)).toBe('Season 01 · week 1 of 12 · by club')
  })
  it('has no caption before the first night', () => {
    expect(boardCaption({ night: null }, 'week', 'team', true)).toBe('')
  })
  it('masks small counts publicly', () => {
    expect(countText({ n: null, masked: true })).toBe('<3')
    expect(countText({ n: 12, masked: false })).toBe('12')
  })
  it('keeps every bar visible and none longer than the leader', () => {
    expect(barShare(1, 50)).toBe(0.06)
    expect(barShare(25, 50)).toBe(0.5)
    expect(barShare(60, 50)).toBe(1)
    expect(barShare(null, 50)).toBe(0.06)
  })
})

describe('sign-up checks', () => {
  const ok = { full_name: 'Alex Sample', email: 'alex@example.test', mobile: '0400 000 000', university: 'u', club: 't', new_club: '', age: true, privacy: true }
  it('accepts a complete form', () => {
    expect(validateRegistration(ok)).toBeNull()
  })
  it('requires 18+ and the privacy notice, but not marketing', () => {
    expect(validateRegistration({ ...ok, age: false })).toBe('age_required')
    expect(validateRegistration({ ...ok, privacy: false })).toBe('privacy_required')
  })
  it('needs a club, a new club name, or the uni-only choice', () => {
    expect(validateRegistration({ ...ok, club: '' })).toBe('bad_team')
    expect(validateRegistration({ ...ok, club: '__new', new_club: 'x' })).toBe('bad_team')
    expect(validateRegistration({ ...ok, club: '__new', new_club: 'Rowing Club' })).toBeNull()
    expect(validateRegistration({ ...ok, club: '__none' })).toBeNull()
  })
  it('checks email and mobile shape', () => {
    expect(validateRegistration({ ...ok, email: 'nope' })).toBe('bad_email')
    expect(validateRegistration({ ...ok, mobile: '123' })).toBe('bad_mobile')
  })
  it('has words for every error the database returns', () => {
    for (const code of ['closed', 'missing_fields', 'bad_email', 'bad_mobile', 'age_required', 'privacy_required', 'bad_university', 'bad_team', 'already_registered', 'locked'])
      expect(registerError(code)).not.toBe(registerError('error'))
  })
})

describe('the door', () => {
  it('recognises an Off Campus pass QR and nothing else', () => {
    expect(doorTokenFrom('https://memberships.lunagroup.com.au/offcampus/door/abc123DEF')).toBe('abc123DEF')
    expect(doorTokenFrom('https://promoter.lunagroup.com.au/g/abc')).toBeNull()
    expect(doorTokenFrom('https://memberships.lunagroup.com.au/verify/abc')).toBeNull()
  })
  it('says counted, with the club', () => {
    expect(doorResult({ ok: true, first_name: 'Alex', team: 'Netball Club', university: 'UQ' }))
      .toEqual({ kind: 'ok', title: 'COUNTED', sub: 'Alex · Netball Club' })
  })
  it('says the university when the club is still pending', () => {
    expect(doorResult({ ok: true, first_name: 'Sam', team: null, university: 'QUT', pending_team: true }).sub)
      .toBe('Sam · QUT (club pending)')
  })
  it('never counts twice and says when and who', () => {
    const r = doorResult({ ok: false, error: 'already', first_name: 'Alex', at: '2026-11-12T12:42:00Z', by: 'Jo' })
    expect(r.kind).toBe('warn')
    expect(r.sub).toBe('Alex · at 10:42pm by Jo')
  })
  it('explains every refusal', () => {
    for (const e of ['no_night', 'self_scan', 'suspended', 'not_found', 'not_authorised', 'closed'])
      expect(doorResult({ ok: false, error: e }).kind).toBe('err')
  })
})

describe('exports', () => {
  it('quotes cells and defuses spreadsheet formulas', () => {
    const csv = toCsv([{ name: 'A "B"', club: '=HYPERLINK("x")', n: 3 }])
    expect(csv).toBe('"name","club","n"\n"A ""B""","\'=HYPERLINK(""x"")","3"')
  })
})
