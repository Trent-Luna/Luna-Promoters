import { describe, expect, it } from 'vitest'
import { pixelForVenue } from './meta-pixel'
import { GROUP_PIXEL, SU_CASA_PIXEL } from './occasion'

describe('pixelForVenue', () => {
  it('matches Su Casa with or without a space in the name', () => {
    expect(pixelForVenue('Su Casa Brisbane')).toBe('785459746721078')
    expect(pixelForVenue('SuCasa')).toBe('785459746721078')
    expect(pixelForVenue('su casa')).toBe('785459746721078')
    expect(pixelForVenue('SUCASA Rooftop')).toBe('785459746721078')
  })

  it('keeps Pump and Mamacita, and leaves every other club alone', () => {
    expect(pixelForVenue('Pump Nightclub')).toBe('1337692745079424')
    expect(pixelForVenue('Mamacita Nightclub')).toBe('1358760112583754')
    expect(pixelForVenue('Eclipse')).toBeNull()
    expect(pixelForVenue('Eclipse AfterDark')).toBeNull()
    expect(pixelForVenue('Silk')).toBeNull()
    expect(pixelForVenue(null)).toBeNull()
    expect(pixelForVenue(undefined)).toBeNull()
    expect(pixelForVenue('')).toBeNull()
  })

  it('occasion pages load the Su Casa dataset beside the group pixel', () => {
    expect(SU_CASA_PIXEL).toBe('785459746721078')
    expect(SU_CASA_PIXEL).toBe(pixelForVenue('Su Casa Brisbane'))
    expect(SU_CASA_PIXEL).toBe(pixelForVenue('SuCasa'))
    expect(GROUP_PIXEL).toBe('339963945485464')
  })
})
