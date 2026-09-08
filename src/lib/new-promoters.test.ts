import { describe, expect, it } from 'vitest'
import {
  activityLabel, categoryLabel, daysAgo, intakeMix, intakeTrend,
  joinedLabel, moreLabel, startedSummary, windowLabel,
} from './new-promoters'

/* RECENT SIGN-UPS on the admin overview.
 *
 * Trent, 8 Sep 2026: "can you add in a 'new promoters' or Recent adds for
 * recently signed up promoters. perhaps the last 14 days".
 *
 * The numbers in these tests are the real ones from the fortnight to 8 Sep:
 * 51 sign-ups, 1 of whom had registered a guest.
 */

const NOW = new Date('2026-09-08T08:00:00+10:00') // 8am Brisbane

describe('joinedLabel — how long ago somebody signed up', () => {
  it('counts calendar days in Brisbane, not elapsed hours', () => {
    // 11pm last night is "yesterday" to somebody reading this at 8am, even
    // though it is only nine hours.
    expect(joinedLabel('2026-09-07T23:00:00+10:00', NOW)).toBe('yesterday')
  })

  it('says today for this morning', () => {
    expect(joinedLabel('2026-09-08T00:30:00+10:00', NOW)).toBe('today')
    expect(joinedLabel('2026-09-08T07:59:00+10:00', NOW)).toBe('today')
  })

  it('counts days beyond that', () => {
    expect(joinedLabel('2026-09-02T14:00:00+10:00', NOW)).toBe('6 days ago')
    expect(joinedLabel('2026-08-25T14:00:00+10:00', NOW)).toBe('14 days ago')
  })

  it('reads a UTC timestamp as the Brisbane day it fell on', () => {
    // 2026-09-07T15:00Z is 1am on the 8th in Brisbane — today, not yesterday.
    expect(joinedLabel('2026-09-07T15:00:00Z', NOW)).toBe('today')
  })

  it('says nothing rather than NaN for a bad timestamp', () => {
    expect(joinedLabel('not-a-date', NOW)).toBe('')
    expect(daysAgo('not-a-date', NOW)).toBeNull()
  })

  it('does not go negative on a clock skew', () => {
    expect(joinedLabel('2026-09-09T10:00:00+10:00', NOW)).toBe('today')
  })
})

describe('windowLabel', () => {
  it('uses the words people use', () => {
    expect(windowLabel(14)).toBe('fortnight')
    expect(windowLabel(7)).toBe('week')
    expect(windowLabel(30)).toBe('month')
    expect(windowLabel(21)).toBe('21 days')
  })
})

describe('intakeMix', () => {
  it('names the split', () => {
    expect(intakeMix({ promoters: 44, djs: 3, staff: 4 })).toBe('44 promoters · 3 DJs · 4 staff')
  })

  it('leaves out what is not there, and singularises', () => {
    expect(intakeMix({ promoters: 1, djs: 0, staff: 0 })).toBe('1 promoter')
    expect(intakeMix({ promoters: 0, djs: 1, staff: 2 })).toBe('1 DJ · 2 staff')
    expect(intakeMix({ promoters: 0, djs: 0, staff: 0 })).toBe('')
  })
})

describe('intakeTrend — read against the fortnight before', () => {
  it('says which way it moved', () => {
    expect(intakeTrend({ total: 51, prior_total: 38, days: 14 })).toBe('up from 38 the fortnight before')
    expect(intakeTrend({ total: 20, prior_total: 38, days: 14 })).toBe('down from 38 the fortnight before')
    expect(intakeTrend({ total: 38, prior_total: 38, days: 14 })).toBe('same as the fortnight before')
  })

  it('says nothing when there is nothing to compare against', () => {
    // "up from 0" is a sentence that sounds like information and is not.
    expect(intakeTrend({ total: 51, prior_total: 0, days: 14 })).toBeNull()
  })

  it('follows the window it was given', () => {
    expect(intakeTrend({ total: 9, prior_total: 4, days: 7 })).toBe('up from 4 the week before')
  })
})

describe('startedSummary — the line that carries the point', () => {
  it('warns loudly when none of them has started', () => {
    const s = startedSummary({ total: 51, started: 0 })
    expect(s?.tone).toBe('warn')
    expect(s?.text).toBe('Not one of them has registered a guest yet.')
  })

  it('still warns at one in fifty-one — the real number on 8 Sep', () => {
    const s = startedSummary({ total: 51, started: 1 })
    expect(s?.tone).toBe('warn')
    expect(s?.text).toBe('1 of 51 has registered a guest.')
  })

  it('is flat in the middle and good when most have', () => {
    expect(startedSummary({ total: 20, started: 6 })?.tone).toBe('flat')
    expect(startedSummary({ total: 20, started: 12 })?.tone).toBe('good')
  })

  it('speaks about one person as a person', () => {
    expect(startedSummary({ total: 1, started: 0 })?.text).toBe('They have not registered a guest yet.')
    expect(startedSummary({ total: 1, started: 1 })?.text).toBe('1 of 1 has registered a guest.')
  })

  it('says nothing at all when nobody joined', () => {
    expect(startedSummary({ total: 0, started: 0 })).toBeNull()
  })
})

describe('activityLabel', () => {
  it('separates "registered nobody" from "registered people who never came"', () => {
    // These two look the same on a leaderboard and are completely different
    // problems: one is a promoter who has not started, the other is a door
    // that is not scanning.
    expect(activityLabel({ registered: 0, checked_in: 0 })).toBe('No guests yet')
    expect(activityLabel({ registered: 12, checked_in: 0 })).toBe('12 registered · none in')
    expect(activityLabel({ registered: 12, checked_in: 8 })).toBe('12 registered · 8 in')
  })
})

describe('categoryLabel', () => {
  it('marks only the exceptions', () => {
    expect(categoryLabel('promoter')).toBeNull()
    expect(categoryLabel('dj')).toBe('DJ')
    expect(categoryLabel('staff')).toBe('Staff')
  })
})

describe('moreLabel', () => {
  it('counts what the list did not show', () => {
    expect(moreLabel(51, 6)).toBe('and 45 more')
    expect(moreLabel(6, 6)).toBeNull()
    expect(moreLabel(2, 6)).toBeNull()
  })
})
