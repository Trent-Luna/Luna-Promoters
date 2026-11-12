import { describe, expect, it } from 'vitest'
import { INVALID_GUEST_EMAIL, isValidGuestEmail, suggestGuestEmail } from './guest-email'

describe('isValidGuestEmail', () => {
  it('accepts a normal address, including .com.au and university mail', () => {
    for (const email of [
      'sam@gmail.com',
      'sam@gmail.com.au',
      'sam@hotmail.com.au',
      'sam@outlook.com',
      'sam@icloud.com',
      'sam@live.com.au',
      'sam@yahoo.com.au',
      'sam@bigpond.com',
      'sam@bigpond.net.au',
      'sam@student.uq.edu.au',
      'first.last+night@yahoo.com',
      '  sam@gmail.com  ',
    ]) {
      expect(isValidGuestEmail(email), email).toBe(true)
    }
  })

  it('refuses a missing TLD, a one-letter TLD, and junk', () => {
    for (const email of [
      'sam@gmail',
      'sam@hotmail',
      'sam@icloud',
      'sam@outlook',
      'sam@gnail',
      'sam@gmaio',
      'sam@gmzil',
      'sam@gmaild',
      'sam@gmailcom',
      'sam@gmailncom',
      'sam@hotnail',
      'sam@icloudc',
      'sam@iclpid',
      'sam@t',
      'sam@g',
      'sam@ail',
      'sam@gmail.c',
      'sam@gmail.',
      'sam@.gmail.com',
      'sam@gmail..com',
      '@gmail.com',
      'sam@',
      'sam@@gmail.com',
      'not-an-email',
      '',
      '   ',
    ]) {
      expect(isValidGuestEmail(email), email).toBe(false)
    }
  })
})

describe('suggestGuestEmail', () => {
  it('offers the .com address for a bare provider or a close typo', () => {
    const cases: [string, string][] = [
      ['sam@gmail', 'sam@gmail.com'],
      ['sam@hotmail', 'sam@hotmail.com'],
      ['sam@icloud', 'sam@icloud.com'],
      ['sam@outlook', 'sam@outlook.com'],
      ['sam@live', 'sam@live.com'],
      ['sam@yahoo', 'sam@yahoo.com'],
      ['sam@bigpond', 'sam@bigpond.com'],
      ['sam@gnail', 'sam@gmail.com'],
      ['sam@gmaio', 'sam@gmail.com'],
      ['sam@gmzil', 'sam@gmail.com'],
      ['sam@gmaild', 'sam@gmail.com'],
      ['sam@gmailcom', 'sam@gmail.com'],
      ['sam@gmailncom', 'sam@gmail.com'],
      ['sam@hotnail', 'sam@hotmail.com'],
      ['sam@icloudc', 'sam@icloud.com'],
      ['sam@iclpid', 'sam@icloud.com'],
      ['sam@gnail.com', 'sam@gmail.com'],
      ['sam@gmial.com', 'sam@gmail.com'],
      ['sam@gmail.con', 'sam@gmail.com'],
      ['Sam@Gmail', 'Sam@gmail.com'],
    ]
    for (const [typed, suggestion] of cases) {
      expect(suggestGuestEmail(typed), typed).toBe(suggestion)
    }
  })

  it('offers .com.au when that is what they were typing', () => {
    expect(suggestGuestEmail('sam@gmailcomau')).toBe('sam@gmail.com.au')
    expect(suggestGuestEmail('sam@yahoo.co.au')).toBe('sam@yahoo.com.au')
    expect(suggestGuestEmail('sam@gmail.com.a')).toBe('sam@gmail.com.au')
    expect(suggestGuestEmail('sam@hotmail.comau')).toBe('sam@hotmail.com.au')
  })

  it('does not invent a correction for junk, or rewrite a real domain', () => {
    for (const email of [
      'sam@t',
      'sam@g',
      'sam@ail',
      'sam@gmail.com',
      'sam@gmail.com.au',
      'sam@hotmail.com.au',
      'sam@bigpond.net.au',
      'sam@student.uq.edu.au',
      'sam@hotmail.co.uk',
      'sam@google.com',
      'sam@example.com',
      'sam@mail.com',
      '',
      'no-at-sign',
    ]) {
      expect(suggestGuestEmail(email), email).toBeNull()
    }
  })

  it('keeps the refusal copy stable for the forms', () => {
    expect(INVALID_GUEST_EMAIL).toMatch(/name@gmail\.com/)
  })
})
