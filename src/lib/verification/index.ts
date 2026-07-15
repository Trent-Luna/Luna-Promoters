// ============================================================
// UniversityIdVerificationService
// Provider-agnostic interface + OpenAI GPT-4o implementation.
// The AI key is read from a server-only env var and NEVER shipped to the browser.
// Only the ID image + the applicant's submitted name & expiry are sent to the
// provider (data minimisation). We request no-retention / no-training.
//
// IMPORTANT: this service only EXTRACTS + assesses. The approve/reject/
// manual-review decision is made authoritatively by the `apply_university_verification`
// Postgres RPC, so a malformed AI response can never auto-approve anyone.
// ============================================================

export interface VerificationInput {
  imageBase64: string          // raw base64 (no data: prefix)
  mimeType: string             // image/jpeg | image/png | image/webp
  submittedName: string
  submittedExpiry: string | null // yyyy-mm-dd
}

// Machine-readable extraction (validated before use)
export interface VerificationExtraction {
  document_type: string
  institution_name: string | null
  extracted_name: string | null
  extracted_expiry_date: string | null
  is_university_id: boolean
  is_current: boolean
  image_is_clear: boolean
  name_matches: boolean
  expiry_matches: boolean
  possible_tampering: boolean
  confidence_score: number
  review_reasons: string[]
  verification_summary: string
}

export interface VerificationResult {
  ok: boolean
  extraction: VerificationExtraction | null
  raw: unknown
  provider: string
  model: string
  error?: string
}

export interface UniversityIdVerificationService {
  readonly provider: string
  readonly model: string
  verify(input: VerificationInput): Promise<VerificationResult>
}

const SYSTEM_PROMPT =
  'You are a strict document verification assistant for a nightclub membership program. ' +
  'You are shown a photo of a university / tertiary-education student identification card. ' +
  'Extract the requested fields and assess authenticity. Respond ONLY with a single JSON object ' +
  'matching the requested schema. Do not add commentary. Be conservative: if you are not sure a ' +
  'field is readable, set the relevant boolean to false and explain in review_reasons.'

function buildUserPrompt(submittedName: string, submittedExpiry: string | null): string {
  return [
    'Verify this university/tertiary student ID card.',
    `The applicant told us their full name is: "${submittedName}".`,
    submittedExpiry
      ? `The applicant told us the card expiry date is: "${submittedExpiry}" (yyyy-mm-dd).`
      : 'The applicant did not provide an expiry date.',
    '',
    'Return a JSON object with EXACTLY these keys:',
    '{',
    '  "document_type": string,                    // e.g. "university_id", "drivers_licence", "other"',
    '  "institution_name": string|null,            // university / institution shown on the card',
    '  "extracted_name": string|null,              // full name printed on the card',
    '  "extracted_expiry_date": string|null,       // yyyy-mm-dd if a valid/expiry date is visible, else null',
    '  "is_university_id": boolean,                 // true only if this is a university/tertiary student ID',
    '  "is_current": boolean,                       // true if the card does not appear expired',
    '  "image_is_clear": boolean,                   // true if the image is legible and not too blurry/dark',
    '  "name_matches": boolean,                     // true if the printed name reasonably matches the submitted name',
    '  "expiry_matches": boolean,                   // true if the printed expiry reasonably matches the submitted expiry (true if no expiry was submitted but a valid one is visible)',
    '  "possible_tampering": boolean,               // true if there are obvious signs of editing/alteration',
    '  "confidence_score": number,                  // 0-100 overall confidence this is a genuine, current, matching university ID',
    '  "review_reasons": string[],                  // short reasons a human might need to review (empty if none)',
    '  "verification_summary": string               // one-sentence plain-English summary',
    '}',
    'The card may show only part of the name; match on a best-effort basis. ' +
    'If the document is clearly not a university/tertiary ID, set is_university_id=false and confidence_score low.',
  ].join('\n')
}

const REQUIRED_KEYS: (keyof VerificationExtraction)[] = [
  'document_type', 'institution_name', 'extracted_name', 'extracted_expiry_date',
  'is_university_id', 'is_current', 'image_is_clear', 'name_matches', 'expiry_matches',
  'possible_tampering', 'confidence_score', 'review_reasons', 'verification_summary',
]

/** Validate + coerce the AI JSON. Returns null if it cannot be trusted. */
export function validateExtraction(obj: any): VerificationExtraction | null {
  if (!obj || typeof obj !== 'object') return null
  for (const k of ['is_university_id', 'confidence_score']) {
    if (!(k in obj)) return null // core keys missing => untrusted
  }
  const bool = (v: any) => v === true
  const score = Math.max(0, Math.min(100, Math.round(Number(obj.confidence_score))))
  if (!Number.isFinite(score)) return null
  const dateOrNull = (v: any) => {
    if (typeof v !== 'string') return null
    return /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? v.trim() : null
  }
  return {
    document_type: typeof obj.document_type === 'string' ? obj.document_type : 'unknown',
    institution_name: typeof obj.institution_name === 'string' ? obj.institution_name : null,
    extracted_name: typeof obj.extracted_name === 'string' ? obj.extracted_name : null,
    extracted_expiry_date: dateOrNull(obj.extracted_expiry_date),
    is_university_id: bool(obj.is_university_id),
    is_current: bool(obj.is_current),
    image_is_clear: bool(obj.image_is_clear),
    name_matches: bool(obj.name_matches),
    expiry_matches: bool(obj.expiry_matches),
    possible_tampering: bool(obj.possible_tampering),
    confidence_score: score,
    review_reasons: Array.isArray(obj.review_reasons)
      ? obj.review_reasons.filter((x: any) => typeof x === 'string').slice(0, 20) : [],
    verification_summary: typeof obj.verification_summary === 'string'
      ? obj.verification_summary.slice(0, 500) : '',
  }
}

class OpenAIUniversityIdVerifier implements UniversityIdVerificationService {
  readonly provider = 'openai'
  readonly model = process.env.OPENAI_VERIFICATION_MODEL || 'gpt-4o'
  private apiKey = process.env.OPENAI_API_KEY || ''

  async verify(input: VerificationInput): Promise<VerificationResult> {
    if (!this.apiKey) {
      return { ok: false, extraction: null, raw: null, provider: this.provider, model: this.model, error: 'ai_not_configured' }
    }
    try {
      const dataUrl = `data:${input.mimeType};base64,${input.imageBase64}`
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          temperature: 0,
          store: false, // do not retain / train on the image
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            {
              role: 'user',
              content: [
                { type: 'text', text: buildUserPrompt(input.submittedName, input.submittedExpiry) },
                { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
              ],
            },
          ],
        }),
      })
      if (!res.ok) {
        const detail = await res.text().catch(() => '')
        return { ok: false, extraction: null, raw: { status: res.status, detail }, provider: this.provider, model: this.model, error: 'ai_request_failed' }
      }
      const json = await res.json()
      const content = json?.choices?.[0]?.message?.content
      let parsed: any = null
      try { parsed = JSON.parse(content) } catch { parsed = null }
      const extraction = validateExtraction(parsed)
      return {
        ok: !!extraction,
        extraction,
        raw: { usage: json?.usage, content },
        provider: this.provider,
        model: this.model,
        error: extraction ? undefined : 'ai_response_invalid',
      }
    } catch (e: any) {
      return { ok: false, extraction: null, raw: null, provider: this.provider, model: this.model, error: e?.message || 'ai_error' }
    }
  }
}

/** Factory — swap providers here without touching callers. */
export function getVerificationService(): UniversityIdVerificationService {
  // Future: switch on process.env.VERIFICATION_PROVIDER
  return new OpenAIUniversityIdVerifier()
}
