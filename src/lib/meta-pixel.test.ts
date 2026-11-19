import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { pixelForVenue } from './meta-pixel'
import { GROUP_PIXEL, SU_CASA_PIXEL } from './occasion'

const ECLIPSE = '737996371533022'
const AFTER_DARK = '3211344019074876'

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
    expect(pixelForVenue('Silk')).toBeNull()
    expect(pixelForVenue('Some Other Club')).toBeNull()
    expect(pixelForVenue(null)).toBeNull()
    expect(pixelForVenue(undefined)).toBeNull()
    expect(pixelForVenue('')).toBeNull()
  })

  it('loads the Eclipse dataset for Eclipse', () => {
    expect(pixelForVenue('Eclipse')).toBe(ECLIPSE)
    expect(pixelForVenue('eclipse')).toBe(ECLIPSE)
  })

  it('loads the After Dark dataset for After Dark, never the Eclipse one', () => {
    // The live house guest list venue is "Eclipse AfterDark" (one word), which
    // also matches /eclipse/; After Dark must win because it is listed first.
    for (const name of ['Eclipse AfterDark', 'Eclipse After Dark', 'After Dark', 'afterdark']) {
      expect(pixelForVenue(name)).toBe(AFTER_DARK)
      expect(pixelForVenue(name)).not.toBe(ECLIPSE)
    }
  })

  it('occasion pages load the Su Casa dataset beside the group pixel', () => {
    expect(SU_CASA_PIXEL).toBe('785459746721078')
    expect(SU_CASA_PIXEL).toBe(pixelForVenue('Su Casa Brisbane'))
    expect(SU_CASA_PIXEL).toBe(pixelForVenue('SuCasa'))
    expect(GROUP_PIXEL).toBe('339963945485464')
  })

  it('never references the two datasets that must not be used', () => {
    const src = readFileSync(join(__dirname, 'meta-pixel.ts'), 'utf8')
    expect(src).not.toContain('1794878518398227')
    expect(src).not.toContain('971910562639508')
  })
})
