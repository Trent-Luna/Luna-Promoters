import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { GROUP_PHONE, clubSkin, esc, lunaSkin, shell, tones, venueFrom } from './blocks'
import { boothOfferEmail } from './guests'
import { movedNightEmail } from './moved-night'
import { universityEmails } from './university'
import { promoterNudgeEmail, whatsappInviteEmail } from './promoters'
import { THEMES } from '@/lib/venue-theme'

const SITE = 'https://promoter.lunagroup.com.au'

beforeEach(() => {
  process.env.NEXT_PUBLIC_SITE_URL = SITE
  process.env.NEXT_PUBLIC_MEMBERSHIPS_URL = 'https://memberships.lunagroup.com.au'
})
afterEach(() => {
  delete process.env.NEXT_PUBLIC_SITE_URL
  delete process.env.NEXT_PUBLIC_MEMBERSHIPS_URL
})

/** Every email: the frame, the preheader, and nothing pointing at a reply. */
function frame(html: string) {
  expect(html.startsWith('<!doctype html>')).toBe(true)
  expect(html).toContain('max-width:600px')
  expect(html).toContain('<!--[if mso]><table role="presentation" width="600"')
  expect(html).toContain('mso-hide:all')
  expect(html).not.toMatch(/just reply/i)
  expect(html).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u)
}

describe('blocks', () => {
  it('escapes guest text and quotes', () => {
    expect(esc(`<b>"Tom's"</b>`)).toBe('&lt;b&gt;&quot;Tom&#39;s&quot;&lt;/b&gt;')
    expect(esc(null)).toBe('')
  })
  it('a club skin is the venue theme, with the email headline 2px up', () => {
    const t = THEMES['pump-nightclub']
    const s = clubSkin(t, SITE, 'Pump Nightclub')
    expect(s.h1).toBe(t.h1 + 2)
    expect(s.hero).toBe(`${SITE}${t.hero}`)
    expect(s.outlookHero).toBe(`${SITE}${t.outlookHero}`)
    expect(s.name).toBe('Pump Nightclub')
  })
  it('the group skin carries its own tones', () => {
    const s = lunaSkin(SITE)
    expect(tones(s)).toMatchObject({ panel: '#15131F', line: '#2A2638', muted: '#A49FB8', btn: '#E7C873' })
  })
  it('escapes the title and preheader', () => {
    const html = shell(lunaSkin(SITE), 'A <b> title', 'pre <i>', [])
    expect(html).toContain('<title>A &lt;b&gt; title</title>')
    expect(html).toContain('pre &lt;i&gt;')
  })
  it('names the venue as the sender', () => {
    expect(venueFrom('Pump Nightclub')).toBe('Pump Nightclub <noreply@lunagroup.com.au>')
    expect(venueFrom('<x>"\n')).toBe('x <noreply@lunagroup.com.au>')
    expect(venueFrom('')).toBe('Luna Group <noreply@lunagroup.com.au>')
  })
})

describe('booth offer', () => {
  const base = { first: 'Sam', venue: 'Eclipse', venueSlug: 'eclipse', occasion: 'Birthday', eventDate: '2026-10-31' }
  it('is the venue’s own email for a club', () => {
    const m = boothOfferEmail(base)
    frame(m.html)
    expect(m.subject).toBe('Birthday at Eclipse: want a VIP booth?')
    expect(m.from).toBe('Eclipse <noreply@lunagroup.com.au>')
    expect(m.html).toContain('Make it a booth, Sam')
    expect(m.html).toContain('You&rsquo;re on the list for Saturday 31 October.')
    expect(m.html).toContain('https://reservations.lunagroup.com.au/on/eclipse')
    expect(m.html).toContain(`${SITE}/brand/email/booth-eclipse.jpg`)
    expect(m.html).toContain('Your birthday deal')
    expect(m.html).toContain(GROUP_PHONE)
    expect(m.html).toContain('You&#39;re on the list for Saturday. Here&#39;s how to make it a booth.')
    expect(m.html).toContain('guest list for your birthday.')
  })
  it('no deal card without an occasion, and the Luna look without a theme', () => {
    const m = boothOfferEmail({ ...base, venue: 'Silk', venueSlug: 'silk', occasion: null, eventDate: null })
    frame(m.html)
    expect(m.subject).toBe('Silk: want a VIP booth?')
    expect(m.from).toBe('Luna Group <noreply@lunagroup.com.au>')
    expect(m.html).not.toContain('deal</div>')
    expect(m.html).toContain('Call us on')
    expect(m.html).toContain(`${SITE}/luna-group-white.png`)
  })
  it('escapes the guest name', () => {
    const m = boothOfferEmail({ ...base, first: '<script>' })
    expect(m.html).not.toContain('<script>')
    expect(m.html).toContain('&lt;script&gt;')
  })
})

describe('moved night', () => {
  const one = {
    first: 'Jas', venue: 'Su Casa Brisbane', venueSlug: 'su-casa-brisbane', was: 'Monday 2 November',
    nights: ['Thursday 5 November'], nightDates: ['2026-11-05'], qrUrl: `${SITE}/g/tok`, occasion: 'Birthday', plusOnes: 0,
  }
  it('one night: a ticket for the new night and nothing to do', () => {
    const m = movedNightEmail(one)
    frame(m.html)
    expect(m.subject).toBe("Your birthday at Su Casa: we've moved you to Thursday 5 November")
    expect(m.from).toBe('Su Casa Brisbane <noreply@lunagroup.com.au>')
    expect(m.html).toContain('We&rsquo;ve moved you to Thursday')
    expect(m.html).toContain('We&rsquo;re not open on Monday 2 November, so your birthday is now on:')
    expect(m.html).toContain('>THU<')
    expect(m.html).toContain('>05<')
    expect(m.html).toContain('Admit 1')
    expect(m.html).toContain(`${SITE}/g/tok`)
    expect(m.html).toContain('Have a great birthday.')
  })
  it('two nights: both tickets, and the weekend', () => {
    const m = movedNightEmail({ ...one, venue: 'Eclipse', venueSlug: 'eclipse', nights: ['Friday 6 November', 'Saturday 7 November'], nightDates: ['2026-11-06', '2026-11-07'], plusOnes: 2 })
    expect(m.subject).toBe("Your birthday at Eclipse: we've moved you to the weekend")
    expect(m.html).toContain('>FRI<')
    expect(m.html).toContain('>SAT<')
    expect(m.html.match(/Admit 3/g)?.length).toBe(2)
    expect(m.html).toContain('Come whichever suits you.')
  })
  it('no QR link, no button', () => {
    const m = movedNightEmail({ ...one, qrUrl: null })
    expect(m.html).not.toContain('Show my QR code')
  })
})

describe('university membership', () => {
  it('approved: the pass link', () => {
    const m = universityEmails.approved('Sam', 'pass123')
    frame(m.html)
    expect(m.subject).toBe('Your Luna University Membership is approved')
    expect(m.html).toContain('You&rsquo;re a member, Sam')
    expect(m.html).toContain('https://memberships.lunagroup.com.au/m/pass123')
  })
  it('a clearer ID: the upload link in an action card', () => {
    const m = universityEmails.newUpload('Sam', 'pass123')
    frame(m.html)
    expect(m.subject).toBe('Action needed: upload a clearer university ID')
    expect(m.html).toContain('https://memberships.lunagroup.com.au/m/pass123/reupload')
    expect(m.html).toContain('border-top:4px solid #E7C873')
  })
  it('in review, received and rejected', () => {
    expect(universityEmails.review('Sam').subject).toBe('Your Luna University Membership application is under review')
    expect(universityEmails.received('Sam').html).toContain('We&rsquo;ve got your application, Sam')
    const r = universityEmails.rejected('Sam')
    expect(r.subject).toBe('Your Luna University Membership application: an update')
    expect(r.html).toContain('https://memberships.lunagroup.com.au/memberships/university')
  })
  it('never shows a score or a reason code', () => {
    for (const m of [universityEmails.rejected('Sam'), universityEmails.review('Sam')]) {
      expect(m.html).not.toMatch(/score|confidence|fraud/i)
    }
  })
})

describe('promoters', () => {
  it('nudge: the live link and the dashboard', () => {
    const m = promoterNudgeEmail('Jess Morgan', 'JESSM')
    frame(m.html)
    expect(m.subject).toBe('Your Luna Group guest list link is still live')
    expect(m.html).toContain('We miss you on the list, Jess')
    expect(m.html).toContain(`${SITE}/p/JESSM`)
    expect(m.html).toContain(`${SITE}/promoter`)
  })
  it('channel invite: privacy is only promised for a channel', () => {
    const channel = whatsappInviteEmail('Jess Morgan', 'https://whatsapp.com/channel/abc', 'catch_up')
    frame(channel.html)
    expect(channel.subject).toBe('Follow the Luna promoter WhatsApp channel')
    expect(channel.html).toContain('Follow the promoter channel, Jess')
    expect(channel.html).toContain('Your number stays private')
    const group = whatsappInviteEmail('Jess Morgan', 'https://chat.whatsapp.com/xyz', 'welcome')
    expect(group.html).toContain('You&rsquo;re in, Jess')
    expect(group.html).not.toContain('Your number stays private')
  })
})
