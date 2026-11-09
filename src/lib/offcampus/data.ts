import { createClient } from '@/lib/supabase/server'
import type { Board, NightInfo } from './logic'

export interface PublicInfo {
  ok: boolean
  error?: string
  public_board: boolean
  show_prizes: boolean
  privacy_version: string
  tie_rule: 'shared' | 'first_to_total' | 'most_weekly_wins' | 'admin' | null
  winner_level: 'team' | 'university' | null
  links: { booth: string | null; whatsapp: string | null; instagram: string | null }
  next_night: NightInfo | null
  universities: { id: string; name: string; short: string | null; teams: { id: string; name: string }[] }[]
}

/** Everything the public pages need. null while Off Campus is switched off. */
export async function loadPublicInfo(): Promise<PublicInfo | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('offcampus_public_info')
  if (error || !data?.ok) return null
  return data as PublicInfo
}

export async function loadBoard(period: 'week' | 'month' | 'season', level: 'team' | 'university'): Promise<Board | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('offcampus_board', { p_period: period, p_level: level })
  if (error || !data?.ok) return null
  return data as Board
}
