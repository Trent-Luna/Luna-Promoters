import { describe, expect, it } from 'vitest'
import {
  confirmationSubject,
  emailHtml,
  isTrentPromoter,
  TRENT_PROMOTER_CODE,
  TRENT_PROMOTER_ID,
} from './email'

const base = {
  first: 'Alex',
  venue: 'Eclipse',
  dateLabel: 'Friday, 19 September 2026',
  qrImg: 'https://example.test/api/qr/tok',
  pass: 'https://example.test/g/tok',
  occasionBlocks: '',
}

describe('isTrentPromoter', () => {
  it('matches Trent by UUID', () => {
    expect(isTrentPromoter(TRENT_PROMOTER_ID)).toBe(true)
    expect(isTrentPromoter(TRENT_PROMOTER_ID, 'someone-else')).toBe(true)
  })

  it('falls back to promoter_code trent49, case-insensitively', () => {
    expect(isTrentPromoter(null, TRENT_PROMOTER_CODE)).toBe(true)
    expect(isTrentPromoter(undefined, 'TRENT49')).toBe(true)
  })

  it('does not match other promoters', () => {
    expect(isTrentPromoter('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'blake01')).toBe(false)
    expect(isTrentPromoter(null, 'house')).toBe(false)
    expect(isTrentPromoter(null, null)).toBe(false)
    expect(isTrentPromoter()).toBe(false)
  })
})

describe('confirmationSubject', () => {
  it('keeps today\'s wording for everyone else', () => {
    expect(confirmationSubject('Eclipse', false)).toBe("You're on the guestlist — Eclipse")
  })

  it('uses owner guest list wording for Trent', () => {
    expect(confirmationSubject('Eclipse', true)).toBe("You're on the owner's guest list — Eclipse")
  })
})

describe('emailHtml', () => {
  it('keeps the green on-the-list pill and no owner line for other promoters', () => {
    const html = emailHtml(base)
    expect(html).toContain("YOU'RE ON THE LIST")
    expect(html).toContain('background:rgba(16,185,129,.15);color:#34d399')
    expect(html).not.toContain("OWNER'S GUEST LIST")
    expect(html).not.toContain("owner's guest list")
    expect(html).toContain('Hey Alex 👋')
    expect(html).toContain('Eclipse')
    expect(html).toContain('Friday, 19 September 2026')
  })

  it('uses the gold owner pill and body line for Trent only', () => {
    const html = emailHtml({ ...base, ownerGuestList: true })
    expect(html).toContain("OWNER'S GUEST LIST")
    expect(html).toContain('background:rgba(212,175,55,.15);color:#d4af37')
    expect(html).not.toContain("YOU'RE ON THE LIST")
    expect(html).toContain("You're on the <span style=\"color:#d4af37;font-weight:700\">owner's guest list</span>.")
    expect(html.indexOf('Hey Alex 👋')).toBeLessThan(html.indexOf("owner's guest list"))
    expect(html.indexOf("owner's guest list")).toBeLessThan(html.indexOf('Eclipse'))
  })
})
