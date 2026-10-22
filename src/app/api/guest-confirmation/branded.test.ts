import { describe, expect, it } from 'vitest'
import { brandedFrom, brandedHtml, brandedSubject } from './branded'
import { THEMES, themeFor, nightParts } from '@/lib/venue-theme'

const base = {
  site: 'https://promoter.lunagroup.com.au', token: 'tok123', venueName: 'Pump Nightclub',
  first: 'Sam', eventDate: '2026-10-09', promoterName: 'Jess M.',
}

describe('venue-branded confirmation', () => {
  it('has a theme for the five clubs and none for Silk', () => {
    for (const s of ['eclipse', 'eclipse-afterdark', 'pump-nightclub', 'mamacita-nightclub', 'su-casa-brisbane']) expect(themeFor(s)).not.toBeNull()
    expect(themeFor('silk')).toBeNull()
    expect(themeFor(null)).toBeNull()
  })
  it('reads the night off the event date', () => {
    expect(nightParts('2026-10-09')).toMatchObject({ dow: 'FRI', day: '09', mon: 'OCT', night: 'Friday 9 October', ymd: '20261009' })
  })
  it('subject and sender name the venue', () => {
    expect(brandedSubject({ theme: THEMES['pump-nightclub'], eventDate: '2026-10-09' })).toBe("You're on the list: Pump, Friday 9 October")
    expect(brandedSubject({ theme: THEMES['pump-nightclub'], eventDate: '2026-10-09', ownerGuestList: true })).toBe("You're on the owner's guest list: Pump, Friday 9 October")
    expect(brandedFrom('Pump Nightclub')).toBe('Pump Nightclub <noreply@lunagroup.com.au>')
  })
  it('carries the QR, the pass link and the cut-off', () => {
    const html = brandedHtml({ ...base, theme: THEMES['pump-nightclub'], untilLabel: '11pm' })
    expect(html).toContain('https://promoter.lunagroup.com.au/api/qr/tok123')
    expect(html).toContain('https://promoter.lunagroup.com.au/g/tok123')
    expect(html).toContain('11pm sharp')
    expect(html).toContain('Guest of Jess M.')
    expect(html).toContain('/brand/email/logo-pump.png')
  })
  it('gives Outlook desktop real images for the header and booth', () => {
    for (const [slug, t] of Object.entries(THEMES)) {
      const html = brandedHtml({ ...base, theme: t })
      expect(html, slug).toContain(`<!--[if mso]><img src="https://promoter.lunagroup.com.au${t.booth}"`)
      expect(html, slug).toContain(`<v:fill type="frame" src="https://promoter.lunagroup.com.au${t.outlookHero}"`)
      expect(html.match(/<v:rect/g)?.length, slug).toBe(1)
      expect(html.match(/<\/v:rect>/g)?.length, slug).toBe(1)
    }
  })
  it('says arrive early where there is no cut-off', () => {
    const html = brandedHtml({ ...base, venueName: 'Eclipse', theme: THEMES['eclipse'] })
    expect(html).toContain('Arrive early')
    expect(html).not.toContain('Guest list closes')
  })
  it('keeps the birthday deal and the owner wording', () => {
    const html = brandedHtml({ ...base, theme: THEMES['eclipse'], occasion: 'Birthday', ownerGuestList: true })
    expect(html).toContain('Your birthday, on us')
    expect(html).toContain('Your birthday deal')
    expect(html).toContain('for the birthday star')
    expect(html).toContain("Owner's guest list")
    expect(html).toContain('Birthday packages can be added')
  })
  it('draws the deal in the venue colours, without the old generic card', () => {
    const html = brandedHtml({ ...base, theme: THEMES['pump-nightclub'], occasion: 'Hens party' })
    expect(html).toContain('Hens night, sorted')
    expect(html).toContain('for the hen')
    expect(html).toContain(`color:${THEMES['pump-nightclub'].acc};">Hens night, sorted`)
    expect(html).not.toContain('#34d399')        // the old green tick
    expect(html).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u)
    expect(html).not.toContain('Just reply')
  })
  it('lets the two buttons stack on a phone', () => {
    const html = brandedHtml({ ...base, theme: THEMES['pump-nightclub'] })
    expect(html.match(/class="btnw"/g)?.length).toBe(2)
    expect(html).toContain('.btnw{display:block!important')
  })
  it('a club with no photo (Mamacita) colours the booth card instead', () => {
    const t = THEMES['mamacita-nightclub']
    const html = brandedHtml({ ...base, venueName: 'Mamacita Nightclub', theme: t })
    expect(html).toContain(`background-color:${t.heroColor}`)
    expect(html).not.toContain('url(\'null')
  })
  it('escapes the guest name', () => {
    const html = brandedHtml({ ...base, theme: THEMES['eclipse'], first: '<b>x</b>' })
    expect(html).not.toContain('<b>x</b>')
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;')
  })

  it('a party night: its name, the group and what is on', () => {
    const party = { eventName: 'Su Casa 10K Party', startTime: '18:00:00', tagline: 'Thank you party',
      lede: 'Ten thousand of you on Instagram.', included: null, plusOnes: 3, names: ['Mia', 'Sam', 'Priya'] }
    const theme = THEMES['su-casa-brisbane']
    expect(brandedSubject({ theme, eventDate: '2026-11-13', party })).toBe("You're in: Su Casa 10K Party, Friday 13 November")
    const html = brandedHtml({ ...base, venueName: 'Su Casa Brisbane', eventDate: '2026-11-13', theme, party })
    expect(html).toContain('Admit 4')
    expect(html).toContain('You and 3 friends are on the list.')
    expect(html).toContain('group of 4 in: you, Mia, Sam and Priya')
    expect(html).toContain('from 6pm')
    expect(html).toContain('registered for the Su Casa 10K Party')
    expect(html).not.toContain('Everyone needs their own QR')
    expect(html).not.toContain('On the night:')
    expect(brandedHtml({ ...base, eventDate: '2026-11-13', theme, party: { ...party, included: 'DJ from 6pm' } })).toContain('On the night:</b> DJ from 6pm')
  })
  it('an ordinary night is unchanged', () => {
    const html = brandedHtml({ ...base, theme: THEMES['pump-nightclub'] })
    expect(html).toContain('Admit 1')
    expect(html).toContain('Everyone needs their own QR')
  })
})
