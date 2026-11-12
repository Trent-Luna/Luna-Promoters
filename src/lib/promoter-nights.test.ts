import { describe, expect, it } from 'vitest'
import { promoterNightFor } from './promoter-nights'

describe('promoter nights', () => {
  it('knows Sonda, in any case', () => {
    expect(promoterNightFor('sonda')?.name).toBe('Sonda Sounds')
    expect(promoterNightFor(' SONDA ')?.slug).toBe('sonda')
  })
  it('ignores anything else, so the group application is unchanged', () => {
    expect(promoterNightFor('eclipse')).toBeNull()
    expect(promoterNightFor('__proto__')).toBeNull()
    expect(promoterNightFor(undefined)).toBeNull()
  })
})
