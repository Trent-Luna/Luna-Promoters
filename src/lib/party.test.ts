import { describe, it, expect } from 'vitest'
import {
  clampPlusOnes, cleanNames, namesLine, plusLabel, groupPhrase, shortTime, shortNight,
  headsIn, confirmationText, reminderText, brisbaneNow, reminderDue,
} from './party'
import { toE164 } from './sms'

describe('party nights', () => {
  it('never lets more friends through than the night allows', () => {
    expect(clampPlusOnes(3, 4)).toBe(3)
    expect(clampPlusOnes(7, 4)).toBe(4)
    expect(clampPlusOnes(-2, 4)).toBe(0)
    expect(clampPlusOnes('2', 4)).toBe(2)
    expect(clampPlusOnes(3, 0)).toBe(0)
    expect(clampPlusOnes(20, 50)).toBe(10)
  })

  it('keeps the names that were typed, no more than the friends', () => {
    expect(cleanNames(['  Mia ', '', 'Sam', null, 'Priya', 'Josh'], 3)).toEqual(['Mia', 'Sam', 'Priya'])
    expect(cleanNames(undefined, 4)).toEqual([])
    expect(cleanNames(['x'.repeat(60)], 1)[0]).toHaveLength(40)
  })

  it('says the group the way a person would', () => {
    expect(namesLine(['Mia', 'Sam', 'Priya'])).toBe('Mia, Sam and Priya')
    expect(namesLine(['Mia'])).toBe('Mia')
    expect(namesLine(null)).toBe('')
    expect(plusLabel(3)).toBe('+3 guests')
    expect(plusLabel(1)).toBe('+1 guest')
    expect(plusLabel(0)).toBe('')
    expect(groupPhrase(0)).toBe('you')
    expect(groupPhrase(1)).toBe('you and a friend')
    expect(groupPhrase(4)).toBe('you and 4 friends')
  })

  it('formats the night', () => {
    expect(shortTime('18:00:00')).toBe('6pm')
    expect(shortTime('18:30:00')).toBe('6:30pm')
    expect(shortTime(null)).toBe('')
    expect(shortNight('2026-11-13')).toBe('Fri 13 Nov')
  })

  it('counts heads in when a group arrives in parts', () => {
    expect(headsIn(3, null)).toBe(4)
    expect(headsIn(3, 2)).toBe(2)
    expect(headsIn(3, 9)).toBe(4)
    expect(headsIn(0, null)).toBe(1)
  })

  it('writes the two texts', () => {
    const i = { first: 'Jess', eventName: 'Su Casa 10K Party', eventDate: '2026-11-13', startTime: '18:00:00', plusOnes: 3, passUrl: 'https://promoter.lunagroup.com.au/g/abc' }
    expect(confirmationText(i)).toBe("You're on the list for the Su Casa 10K Party, Jess (+3). Fri 13 Nov from 6pm. Your pass: https://promoter.lunagroup.com.au/g/abc")
    expect(reminderText(i)).toBe('Tonight! Su Casa 10K Party from 6pm. Bring ID and show your pass at the door: https://promoter.lunagroup.com.au/g/abc One scan lets your group of 4 in.')
    expect(reminderText({ ...i, plusOnes: 0 })).not.toContain('One scan')
  })

  it('sends the reminder on the night, from 2pm Brisbane', () => {
    // 13 Nov 2026 03:59 UTC = 1:59pm Brisbane; 04:00 UTC = 2pm.
    expect(brisbaneNow(new Date('2026-11-13T03:59:00Z'))).toEqual({ date: '2026-11-13', hour: 13 })
    expect(reminderDue('2026-11-13', new Date('2026-11-13T03:59:00Z'))).toBe(false)
    expect(reminderDue('2026-11-13', new Date('2026-11-13T04:00:00Z'))).toBe(true)
    expect(reminderDue('2026-11-13', new Date('2026-11-12T20:00:00Z'))).toBe(false) // 6am same day
    expect(reminderDue('2026-11-13', new Date('2026-11-14T04:00:00Z'))).toBe(false) // next day
  })

  it('dials Australian mobiles', () => {
    expect(toE164('0412 345 678')).toBe('+61412345678')
    expect(toE164('+61 412 345 678')).toBe('+61412345678')
    expect(toE164('61412345678')).toBe('+61412345678')
    expect(toE164('412345678')).toBe('+61412345678')
    expect(toE164('0412')).toBeNull()
    expect(toE164('')).toBeNull()
  })
})
