// Atlas SSO — the server-only exchange client.
//
// Redeems a one-time code with the Atlas (LunaOS) identity project in exchange
// for a minimal identity. SERVER-ONLY: this holds the exchange secret, so it
// must never be imported into a client component.

import { createClient } from '@supabase/supabase-js'

export type ExchangeFailure = 'not_configured' | 'denied' | 'unavailable'

export interface ExchangeResult {
  ok: boolean
  payload?: unknown
  failure?: ExchangeFailure
  /** Safe to log — never contains the code or the secret. */
  detail?: string
}

/**
 * SSO configuration, read at call time rather than module load so a missing
 * variable in a preview build is a clean "not configured" rather than a crash
 * at import.
 */
export function ssoEnv() {
  const identityUrl = process.env.ATLAS_IDENTITY_URL?.trim() ?? ''
  const identityAnonKey = process.env.ATLAS_IDENTITY_ANON_KEY?.trim() ?? ''
  const exchangeSecret = process.env.ATLAS_SSO_EXCHANGE_SECRET?.trim() ?? ''
  const appKey = process.env.ATLAS_SSO_APP_KEY?.trim() || 'promoters'
  return {
    identityUrl,
    identityAnonKey,
    exchangeSecret,
    appKey,
    configured: !!(identityUrl && identityAnonKey && exchangeSecret),
  }
}

/**
 * Redeem a one-time code with Atlas.
 *
 * Distinguishes "Atlas said no" (denied — a real authorisation answer) from
 * "Atlas could not be reached" (unavailable — transient, worth retrying).
 * Collapsing the two is how an outage gets misread as a permissions problem
 * and somebody starts editing roles at 1am.
 */
export async function exchangeCode(code: string): Promise<ExchangeResult> {
  const env = ssoEnv()
  if (!env.configured) {
    return { ok: false, failure: 'not_configured', detail: 'sso_not_configured' }
  }

  const client = createClient(env.identityUrl, env.identityAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  try {
    const { data, error } = await client.rpc('atlas_sso_exchange_code', {
      p_app_key: env.appKey,
      p_code: code,
      p_secret: env.exchangeSecret,
    })

    if (error) {
      const msg = (error.message ?? '').toLowerCase()
      // Atlas answering the question, rather than failing to answer it.
      const isDenial =
        msg.includes('invalid_secret') ||
        msg.includes('bad_secret') ||
        msg.includes('unknown_application') ||
        msg.includes('invalid_code') ||
        msg.includes('unknown_or_wrong_audience') ||
        msg.includes('already_used') ||
        msg.includes('replay') ||
        msg.includes('expired') ||
        msg.includes('not_authorised') ||
        msg.includes('not_authorized') ||
        msg.includes('user_inactive') ||
        msg.includes('rate_limited')
      return {
        ok: false,
        failure: isDenial ? 'denied' : 'unavailable',
        detail: error.message ?? 'unknown_error',
      }
    }

    if (!data) return { ok: false, failure: 'denied', detail: 'empty_payload' }
    return { ok: true, payload: data }
  } catch (e) {
    return {
      ok: false,
      failure: 'unavailable',
      detail: e instanceof Error ? e.message : 'exchange_threw',
    }
  }
}
