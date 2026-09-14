import { describe, it, expect } from 'vitest'
import {
  dowOf, addDays, tradesOn, nextTradingNight, tradingNightsBetween,
  birthdayWindow, tradingDaysLabel, shortNight,
} from './trading'

// Eclipse: Sun, Fri, Sat.   Su Casa: Sun, Wed, Thu, Fri, Sat.
const ECLIPSE = [0, 5, 6]
const SUCASA = [0, 3, 4, 5, 6]

describe('dowOf', () => {
  it('reads a calendar day, not an instant', () => {
    // The bug this guards: new Date('2026-09-14') is UTC midnight, which is the
    // 13th in every timezone west of Greenwich — and 13 Sep 2026 is a Sunday.
    expect(dowOf('2026-09-14')).toBe(1) // Monday
    expect(dowOf('2026-09-18')).toBe(5) // Friday
    expect(dowOf('2026-09-19')).toBe(6) // Saturday
  })
  it('refuses anything that is not a date', () => {
    expect(dowOf('tomorrow')).toBe(-1)
    expect(dowOf('')).toBe(-1)
  })
})

describe('addDays', () => {
  it('crosses a month end', () => expect(addDays('2026-09-30', 1)).toBe('2026-10-01'))
  it('crosses a year end', () => expect(addDays('2026-12-31', 1)).toBe('2027-01-01'))
  it('handles a leap day', () => expect(addDays('2028-02-28', 1)).toBe('2028-02-29'))
  it('goes backwards', () => expect(addDays('2026-09-01', -1)).toBe('2026-08-31'))
})

describe('tradesOn', () => {
  it('is the whole bug: Eclipse is shut on a Monday', () => {
    expect(tradesOn('2026-09-14', ECLIPSE)).toBe(false) // Jasmine's night
  })
  it('Su Casa is shut Monday and Tuesday', () => {
    expect(tradesOn('2026-09-14', SUCASA)).toBe(false) // Mon
    expect(tradesOn('2026-09-15', SUCASA)).toBe(false) // Tue
    expect(tradesOn('2026-09-16', SUCASA)).toBe(true)  // Wed
  })
  it('opens on the nights it says', () => {
    expect(tradesOn('2026-09-18', ECLIPSE)).toBe(true)
    expect(tradesOn('2026-09-19', ECLIPSE)).toBe(true)
    expect(tradesOn('2026-09-20', ECLIPSE)).toBe(true)
  })
  it('a blackout closes a night the venue normally trades', () => {
    const blk = [{ venue_id: 'v1', date: '2026-09-18' }]
    expect(tradesOn('2026-09-18', ECLIPSE, blk, 'v1')).toBe(false)
    expect(tradesOn('2026-09-18', ECLIPSE, blk, 'v2')).toBe(true)
  })
  it('a venue-wide blackout closes every venue', () => {
    const blk = [{ venue_id: null, date: '2026-09-18' }]
    expect(tradesOn('2026-09-18', ECLIPSE, blk, 'v1')).toBe(false)
  })
  it('an unconfigured venue trades every night, exactly as before', () => {
    expect(tradesOn('2026-09-15', undefined)).toBe(true)
    expect(tradesOn('2026-09-15', [])).toBe(true)
  })
})

describe('nextTradingNight', () => {
  it('counts the day itself when it is open', () => {
    expect(nextTradingNight('2026-09-18', ECLIPSE)).toBe('2026-09-18')
  })
  it('pushes a Monday birthday to the Friday at Eclipse', () => {
    expect(nextTradingNight('2026-09-14', ECLIPSE)).toBe('2026-09-18')
  })
  it('pushes a Tuesday birthday only to the Wednesday at Su Casa', () => {
    // The reason Su Casa must not be treated like Eclipse: Wednesday is two
    // days from the birthday, Friday is four.
    expect(nextTradingNight('2026-09-15', SUCASA)).toBe('2026-09-16')
  })
  it('steps over a blackout to the night after', () => {
    const blk = [{ venue_id: 'v1', date: '2026-09-18' }]
    expect(nextTradingNight('2026-09-14', ECLIPSE, blk, 'v1')).toBe('2026-09-19')
  })
  it('gives up rather than pushing a birthday into next season', () => {
    const blk = Array.from({ length: 30 }, (_, i) => ({ venue_id: 'v1', date: addDays('2026-09-14', i) }))
    expect(nextTradingNight('2026-09-14', ECLIPSE, blk, 'v1', 14)).toBeNull()
  })
})

describe('tradingNightsBetween', () => {
  it('lists a fortnight of Eclipse nights', () => {
    expect(tradingNightsBetween('2026-09-14', '2026-09-28', ECLIPSE)).toEqual([
      '2026-09-18', '2026-09-19', '2026-09-20',
      '2026-09-25', '2026-09-26', '2026-09-27',
    ])
  })
  it('is inclusive of both ends', () => {
    expect(tradingNightsBetween('2026-09-18', '2026-09-18', ECLIPSE)).toEqual(['2026-09-18'])
  })
  it('returns nothing when the window holds no open night', () => {
    expect(tradingNightsBetween('2026-09-14', '2026-09-17', ECLIPSE)).toEqual([])
  })
})

describe('birthdayWindow', () => {
  it('anchors on the birthday when it is still ahead', () => {
    // Born 20 Sep 1999, asked on 14 Sep 2026 -> the fortnight from 20 Sep.
    expect(birthdayWindow('1999-09-20', '2026-09-14')).toEqual({ from: '2026-09-20', to: '2026-10-04' })
  })
  it('rolls to next year once this year has passed', () => {
    expect(birthdayWindow('1999-03-02', '2026-09-14').from).toBe('2027-03-02')
  })
  it('uses the birthday itself when it is today', () => {
    expect(birthdayWindow('1999-09-14', '2026-09-14').from).toBe('2026-09-14')
  })
  it('falls back to today when there is no date of birth', () => {
    expect(birthdayWindow(null, '2026-09-14')).toEqual({ from: '2026-09-14', to: '2026-09-28' })
    expect(birthdayWindow('', '2026-09-14').from).toBe('2026-09-14')
  })
  it('never starts in the past', () => {
    expect(birthdayWindow('1999-09-13', '2026-09-14').from >= '2026-09-14').toBe(true)
  })
})

describe('tradingDaysLabel', () => {
  it('reads a week Monday-first even though the numbers are Sunday-first', () => {
    expect(tradingDaysLabel(ECLIPSE)).toBe('Fri, Sat & Sun')
    expect(tradingDaysLabel(SUCASA)).toBe('Wed, Thu, Fri, Sat & Sun')
  })
  it('says every night rather than listing seven', () => {
    expect(tradingDaysLabel([0, 1, 2, 3, 4, 5, 6])).toBe('every night')
    expect(tradingDaysLabel(null)).toBe('every night')
  })
  it('handles one night', () => expect(tradingDaysLabel([6])).toBe('Sat'))
})

describe('shortNight', () => {
  it('is what a guest recognises', () => {
    expect(shortNight('2026-09-18')).toMatch(/Fri/)
    expect(shortNight('2026-09-18')).toMatch(/18/)
  })
})
