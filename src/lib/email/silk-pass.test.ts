import { describe, expect, it } from 'vitest'
import { SATIN_FROM, satinPassHtml, satinSubject } from './silk-pass'

// The Satin pass Trent picked on 22 Oct 2026 for venues without their own look.

const base = {
  site: 'https://promoter.lunagroup.com.au/',
  token: 'tok123',
  venueName: 'Silk Saturdays',
  first: 'Sam',
  eventDate: '2026-10-31',
}

describe('Satin pass', () => {
  it('names the venue and the night in the subject, from Luna Group', () => {
    expect(satinSubject(base)).toBe("You're on the list: Silk Saturdays, Saturday 31 October")
    expect(satinSubject({ ...base, ownerGuestList: true })).toBe("You're on the owner's guest list: Silk Saturdays, Saturday 31 October")
    expect(SATIN_FROM).toBe('Luna Group <noreply@lunagroup.com.au>')
  })

  it('carries the QR, the pass link, the calendar link and the satin header', () => {
    const html = satinPassHtml(base)
    expect(html).toContain('https://promoter.lunagroup.com.au/api/qr/tok123')
    expect(html).toContain('https://promoter.lunagroup.com.au/g/tok123')
    expect(html).toContain('calendar.google.com/calendar/render')
    expect(html).toContain('/brand/email/hero-silk.jpg')
    expect(html).toContain('/brand/email/hero-silk-outlook.jpg')
    expect(html).toContain('Saturday is yours')
    expect(html).toContain("lining-nums")
  })

  it('says the guest list cut-off when the venue has one', () => {
    const html = satinPassHtml({ ...base, untilLabel: '11pm' })
    expect(html).toContain('Guest list closes')
    expect(html).toContain('11pm sharp')
    expect(html).toContain('Get there before 11pm')
  })

  it('shows the birthday guest list deal, and no booth card', () => {
    const html = satinPassHtml({ ...base, occasion: 'Birthday' })
    expect(html).toContain('Your birthday deal')
    expect(html).toContain('all-night VIP wristband')
    expect(html).not.toContain('VIP booth')
    expect(satinPassHtml(base)).not.toContain('birthday deal')
  })

  it('never asks the guest to reply to a noreply address', () => {
    expect(satinPassHtml({ ...base, occasion: 'Birthday' }).toLowerCase()).not.toContain('reply to this email')
  })

  it('escapes the guest name and the venue name', () => {
    const html = satinPassHtml({ ...base, first: '<b>Sam</b>', venueName: 'Silk & <i>Co</i>' })
    expect(html).not.toContain('<b>Sam</b>')
    expect(html).not.toContain('<i>Co</i>')
    expect(html).toContain('Silk &amp; &lt;i&gt;Co&lt;/i&gt;')
  })
})
