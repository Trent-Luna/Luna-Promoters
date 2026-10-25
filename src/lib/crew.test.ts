import { describe, it, expect } from 'vitest'
import { occasionKeyFor, clampCrew, isCrewCode, crewUrl, crewTitle, inviteText, whatsappHref, crewProgress, occasionTag } from './crew'

describe('occasionKeyFor', () => {
  it('maps the three stored occasions', () => {
    expect(occasionKeyFor('Birthday')).toBe('birthday')
    expect(occasionKeyFor('Hens party')).toBe('hens')
    expect(occasionKeyFor('Bucks party')).toBe('bucks')
  })
  it('is null for anything else', () => {
    expect(occasionKeyFor('Engagement')).toBeNull()
    expect(occasionKeyFor(null)).toBeNull()
  })
})

describe('clampCrew', () => {
  it('keeps 1–40', () => {
    expect(clampCrew(0)).toBe(1)
    expect(clampCrew(8)).toBe(8)
    expect(clampCrew(99)).toBe(40)
    expect(clampCrew(NaN)).toBe(5)
  })
})

describe('isCrewCode', () => {
  it('accepts the 0053 alphabet, any case', () => {
    expect(isCrewCode('CGZSK9')).toBe(true)
    expect(isCrewCode('cgzsk9')).toBe(true)
  })
  it('rejects look-alikes and wrong lengths', () => {
    expect(isCrewCode('CGZSK0')).toBe(false)
    expect(isCrewCode('CGZSKO')).toBe(false)
    expect(isCrewCode('ABC')).toBe(false)
    expect(isCrewCode(null)).toBe(false)
  })
})

describe('crewUrl', () => {
  it('joins without a double slash', () => {
    expect(crewUrl('https://guestlist.lunagroup.com.au/', 'CGZSK9')).toBe('https://guestlist.lunagroup.com.au/c/CGZSK9')
  })
})

describe('crewTitle', () => {
  it('uses the bride or groom when given', () => {
    expect(crewTitle({ occasion: 'Hens party', host_first: 'Amy', honoree_name: 'Jess' })).toBe('Jess’s hens')
    expect(crewTitle({ occasion: 'Bucks party', host_first: 'Amy', honoree_name: 'James' })).toBe('James’s bucks')
  })
  it('falls back to the host', () => {
    expect(crewTitle({ occasion: 'Birthday', host_first: 'Sarah' })).toBe('Sarah’s birthday')
  })
})

describe('invite', () => {
  it('builds the message and the WhatsApp link', () => {
    const t = inviteText({ title: 'Sarah’s birthday', venue: 'Pump Nightclub', night: 'Sat 1 Nov', url: 'https://x/c/ABCDEF' })
    expect(t).toContain('Pump Nightclub, Sat 1 Nov')
    expect(t).toContain('https://x/c/ABCDEF')
    expect(whatsappHref('a b')).toBe('https://wa.me/?text=a%20b')
  })
})

describe('crewProgress', () => {
  it('counts the host and the 5+ deal', () => {
    expect(crewProgress(0, 8)).toMatchObject({ total: 1, target: 8, toGo: 4, dealMet: false, line: '1 of 8 on the list' })
    expect(crewProgress(4, 8)).toMatchObject({ total: 5, dealMet: true, toGo: 0 })
  })
  it('never targets fewer than five', () => {
    expect(crewProgress(1, 2).target).toBe(5)
    expect(crewProgress(1, null).target).toBe(5)
  })
})

describe('occasionTag', () => {
  it('adds the honoree and crew size when present', () => {
    expect(occasionTag('Hens party', 'Jess', 8)).toBe('Hens party · Jess · crew of 8')
    expect(occasionTag('Birthday', null, 6)).toBe('Birthday · crew of 6')
    expect(occasionTag('Birthday')).toBe('Birthday')
    expect(occasionTag(null, 'Jess', 8)).toBe('')
  })
})
