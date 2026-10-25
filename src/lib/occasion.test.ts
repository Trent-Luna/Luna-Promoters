import { describe, expect, it } from 'vitest'
import { OCCASIONS, sourceFor, tileFor } from './occasion'
import { occasionFromHint } from '@/app/p/[code]/guest-form'

describe('occasion landing pages', () => {
  it('each page fixes the exact occasion the form stores and the email keys on', () => {
    expect(occasionFromHint(OCCASIONS.birthday.hint)).toBe('Birthday')
    expect(occasionFromHint(OCCASIONS.hens.hint)).toBe('Hens party')
    expect(occasionFromHint(OCCASIONS.bucks.hint)).toBe('Bucks party')
    for (const o of Object.values(OCCASIONS)) expect(occasionFromHint(o.hint)).toBe(o.formValue)
  })

  it('records where the sign-up came from', () => {
    expect(sourceFor('hens', { src: 'IG-Story-1' })).toBe('ig-story-1')
    expect(sourceFor('hens', { src: 'not a slug!' })).toBe('lp-hens')
    expect(sourceFor('birthday', { fbclid: 'abc' })).toBe('meta-birthday')
    expect(sourceFor('bucks', { utm_source: 'instagram' })).toBe('meta-bucks')
    expect(sourceFor('bucks', {})).toBe('lp-bucks')
  })

  it('finds each club photo by name, After Dark before Eclipse', () => {
    expect(tileFor('Eclipse AfterDark')).toContain('afterdark')
    expect(tileFor('Eclipse')).toContain('booth-eclipse')
    expect(tileFor('Su Casa Brisbane')).toContain('sucasa')
    expect(tileFor('Pump Nightclub')).toContain('pump')
    expect(tileFor('Mamacita Nightclub')).toContain('mamacita')
    expect(tileFor('Silk')).toBeNull()
  })
})
