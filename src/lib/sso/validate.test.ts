import { describe, it, expect } from 'vitest'
import {
  isValidCode, isSafeReturnPath, resolveReturnPath, parseIdentity,
  mapAtlasRole, effectiveRole, mapVenueNames, DEFAULT_LANDING,
} from './validate'

describe('sso code + return path', () => {
  it('accepts only a 64-char hex code', () => {
    expect(isValidCode('a'.repeat(64))).toBe(true)
    expect(isValidCode('A'.repeat(64))).toBe(false)   // uppercase is not what Atlas issues
    expect(isValidCode('a'.repeat(63))).toBe(false)
    expect(isValidCode(null)).toBe(false)
  })

  it('refuses anything that could leave the origin', () => {
    expect(isSafeReturnPath('/admin/guests')).toBe(true)
    expect(isSafeReturnPath('//evil.com')).toBe(false)
    expect(isSafeReturnPath('/\\evil.com')).toBe(false)
    expect(isSafeReturnPath('https://evil.com')).toBe(false)
    expect(isSafeReturnPath('/admin\\x')).toBe(false)
    expect(isSafeReturnPath('/admin\nx')).toBe(false)
    expect(resolveReturnPath('//evil.com')).toBe(DEFAULT_LANDING)
  })
})

describe('who Atlas may admit', () => {
  it('head office and operations become admins', () => {
    // Matches who already holds admin here: Blake, Laura, Rymak and Reception
    // are all Atlas `operations`.
    for (const r of ['owner', 'group_admin', 'operations']) {
      expect(mapAtlasRole(r)).toBe('admin')
    }
  })

  it('venue managers stay venue managers', () => {
    expect(mapAtlasRole('venue_manager')).toBe('venue_manager')
  })

  it('nobody else gets in', () => {
    // Promoters especially: they are external, sign in directly, and an
    // Atlas-issued promoter session should not be possible.
    for (const r of ['marketing', 'staff', 'promoter', 'nonsense', '']) {
      expect(mapAtlasRole(r)).toBeNull()
    }
  })
})

describe('signing in never demotes you', () => {
  // Dan is an Atlas venue_manager who was deliberately made a full admin here.
  // Mapping strictly would strip that on his next sign-in.
  it('keeps the stronger existing role', () => {
    expect(effectiveRole('venue_manager', 'admin')).toBe('admin')
    expect(effectiveRole('venue_manager', null)).toBe('venue_manager')
    expect(effectiveRole('admin', 'reception')).toBe('admin')
    expect(effectiveRole('admin', 'admin')).toBe('admin')
  })
})

describe('venue scoping across two databases', () => {
  const local = [
    { id: 'v1', name: 'Eclipse' },
    { id: 'v2', name: 'Eclipse AfterDark' },
    { id: 'v3', name: 'Silk' },
  ]

  it('matches by name, not id', () => {
    expect(mapVenueNames(['Eclipse AfterDark'], local)).toEqual(['v2'])
  })

  it('ignores case and spacing', () => {
    expect(mapVenueNames(['  eclipse   afterdark '], local)).toEqual(['v2'])
  })

  it('drops venues this app has never heard of', () => {
    // Ju Ju exists in Atlas and not here. Silk exists here and not in Atlas.
    expect(mapVenueNames(['Ju Ju', 'Ember & Ash'], local)).toEqual([])
    expect(mapVenueNames(['Eclipse', 'Ju Ju'], local)).toEqual(['v1'])
  })
})

describe('identity parsing is defensive', () => {
  const good = {
    user_id: 'u1', email: ' Trent@Lunagroup.com.au ', full_name: 'Trent',
    role_key: 'owner', venue_ids: ['a'], venue_names: ['Eclipse'], return_path: '/admin',
  }

  it('normalises the email', () => {
    expect(parseIdentity(good)?.email).toBe('trent@lunagroup.com.au')
  })

  it('returns null rather than a half-understood identity', () => {
    expect(parseIdentity(null)).toBeNull()
    expect(parseIdentity({ ...good, user_id: undefined })).toBeNull()
    expect(parseIdentity({ ...good, email: 'not-an-email' })).toBeNull()
    expect(parseIdentity({ ...good, role_key: undefined, role: undefined })).toBeNull()
  })

  it('reads venue names when present and copes when absent', () => {
    expect(parseIdentity(good)?.venueNames).toEqual(['Eclipse'])
    expect(parseIdentity({ ...good, venue_names: undefined })?.venueNames).toEqual([])
  })
})
