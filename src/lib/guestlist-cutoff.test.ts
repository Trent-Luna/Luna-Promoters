import { describe, it, expect } from 'vitest'
import { cutoffInstant, guestlistClosed, cutoffLabel, cutoffLabelFromInstant, nightCutoffLabel, nightListClosed } from './guestlist-cutoff'

describe('guest list cut-off', () => {
  it('Pump 11pm on a Friday is 13:00 UTC that day', () => {
    expect(cutoffInstant('2026-10-09', '23:00:00')?.toISOString()).toBe('2026-10-09T13:00:00.000Z')
  })
  it('Mamacita 10:30pm', () => {
    expect(cutoffInstant('2026-10-09', '22:30:00')?.toISOString()).toBe('2026-10-09T12:30:00.000Z')
  })
  it('a time after midnight belongs to the same trading night', () => {
    expect(cutoffInstant('2026-10-09', '01:00')?.toISOString()).toBe('2026-10-09T15:00:00.000Z')
  })
  it('no cut-off means never closed', () => {
    expect(cutoffInstant('2026-10-09', null)).toBeNull()
    expect(guestlistClosed('2026-10-09', null, new Date('2030-01-01'))).toBe(false)
  })
  it('closed from the minute of the cut-off, open the minute before', () => {
    expect(guestlistClosed('2026-10-09', '23:00:00', new Date('2026-10-09T12:59:00Z'))).toBe(false)
    expect(guestlistClosed('2026-10-09', '23:00:00', new Date('2026-10-09T13:00:00Z'))).toBe(true)
    expect(guestlistClosed('2026-10-09', '22:30:00', new Date('2026-10-09T12:45:00Z'))).toBe(true)
  })
  it('labels', () => {
    expect(cutoffLabel('23:00:00')).toBe('11pm')
    expect(cutoffLabel('22:30:00')).toBe('10:30pm')
    expect(cutoffLabel('00:30')).toBe('12:30am')
    expect(cutoffLabel(null)).toBeNull()
    expect(cutoffLabel('nonsense')).toBeNull()
  })
  it('reads an event cut-off instant in Australia/Brisbane, minutes included', () => {
    expect(cutoffLabelFromInstant('2026-11-05T12:30:00.000Z')).toBe('10:30pm')
    expect(cutoffLabelFromInstant('2026-11-05 12:30:00+00')).toBe('10:30pm')
    expect(cutoffLabelFromInstant('2026-10-09T13:00:00.000Z')).toBe('11pm')
    expect(cutoffLabelFromInstant(null)).toBeNull()
    expect(cutoffLabelFromInstant('not-a-time')).toBeNull()
  })
  it('an event cut-off wins, and a night without one keeps the venue time', () => {
    const at = new Date('2026-11-05T12:30:00.000Z')
    expect(nightCutoffLabel('23:00:00', '2026-11-05T12:30:00.000Z')).toBe('10:30pm')
    expect(nightCutoffLabel('23:00:00', null)).toBe('11pm')
    expect(nightCutoffLabel(null, null)).toBeNull()
    expect(nightListClosed('2026-11-05', '23:00:00', '2026-11-05T12:30:00.000Z', at)).toBe(true)
    expect(nightListClosed('2026-11-05', '23:00:00', '2026-11-05T12:30:00.000Z', new Date('2026-11-05T12:29:00.000Z'))).toBe(false)
    expect(nightListClosed('2026-11-05', null, null, at)).toBe(false)
    expect(nightListClosed('2026-10-09', '23:00:00', null, new Date('2026-10-09T13:00:00.000Z'))).toBe(true)
  })
})
