import { describe, it, expect } from 'vitest'
import { validateExtraction, getVerificationService } from './index'

// The verification service only extracts/validates. These tests lock down the
// "never trust a malformed AI response" contract at the service layer. The
// approve/reject/manual-review decision itself is tested in SQL
// (supabase/tests/university_decision.sql).

const GOOD = {
  document_type: 'university_id',
  institution_name: 'Example University',
  extracted_name: 'Test Student',
  extracted_expiry_date: '2027-03-31',
  is_university_id: true,
  is_current: true,
  image_is_clear: true,
  name_matches: true,
  expiry_matches: true,
  possible_tampering: false,
  confidence_score: 88,
  review_reasons: [],
  verification_summary: 'Looks good.',
}

describe('validateExtraction — rejects untrustworthy AI output', () => {
  it('returns null for null / undefined / non-object', () => {
    expect(validateExtraction(null)).toBeNull()
    expect(validateExtraction(undefined)).toBeNull()
    expect(validateExtraction('nope')).toBeNull()
    expect(validateExtraction(42)).toBeNull()
  })

  it('returns null when the confidence_score key is missing', () => {
    const { confidence_score, ...rest } = GOOD
    expect(validateExtraction(rest)).toBeNull()
  })

  it('returns null when is_university_id key is missing', () => {
    const { is_university_id, ...rest } = GOOD
    expect(validateExtraction(rest)).toBeNull()
  })

  it('returns null when confidence_score is not numeric', () => {
    expect(validateExtraction({ ...GOOD, confidence_score: 'high' })).toBeNull()
  })
})

describe('validateExtraction — coercion & clamping', () => {
  it('accepts a valid object and preserves core fields', () => {
    const r = validateExtraction(GOOD)!
    expect(r).not.toBeNull()
    expect(r.is_university_id).toBe(true)
    expect(r.confidence_score).toBe(88)
    expect(r.extracted_expiry_date).toBe('2027-03-31')
    expect(r.institution_name).toBe('Example University')
  })

  it('clamps confidence_score into 0..100 and rounds', () => {
    expect(validateExtraction({ ...GOOD, confidence_score: 150 })!.confidence_score).toBe(100)
    expect(validateExtraction({ ...GOOD, confidence_score: -20 })!.confidence_score).toBe(0)
    expect(validateExtraction({ ...GOOD, confidence_score: 70.6 })!.confidence_score).toBe(71)
    expect(validateExtraction({ ...GOOD, confidence_score: '85' })!.confidence_score).toBe(85)
  })

  it('coerces non-strict-true booleans to false (never accidentally true)', () => {
    const r = validateExtraction({ ...GOOD, is_current: 'yes', name_matches: 1, possible_tampering: 'false' })!
    expect(r.is_current).toBe(false)
    expect(r.name_matches).toBe(false)
    expect(r.possible_tampering).toBe(false)
  })

  it('rejects malformed dates but keeps ISO dates', () => {
    expect(validateExtraction({ ...GOOD, extracted_expiry_date: 'March 2027' })!.extracted_expiry_date).toBeNull()
    expect(validateExtraction({ ...GOOD, extracted_expiry_date: '' })!.extracted_expiry_date).toBeNull()
    expect(validateExtraction({ ...GOOD, extracted_expiry_date: '2026-12-01' })!.extracted_expiry_date).toBe('2026-12-01')
  })

  it('sanitises review_reasons to a string array', () => {
    const r = validateExtraction({ ...GOOD, review_reasons: ['blurry', 42, null, 'glare'] })!
    expect(r.review_reasons).toEqual(['blurry', 'glare'])
  })

  it('defaults missing optional fields safely', () => {
    const r = validateExtraction({ is_university_id: true, confidence_score: 50 })!
    expect(r).not.toBeNull()
    expect(r.institution_name).toBeNull()
    expect(r.extracted_name).toBeNull()
    expect(r.review_reasons).toEqual([])
    expect(r.verification_summary).toBe('')
  })
})

describe('getVerificationService factory', () => {
  it('returns the OpenAI provider with a default model', () => {
    const svc = getVerificationService()
    expect(svc.provider).toBe('openai')
    expect(svc.model).toBe('gpt-4o')
  })
})
