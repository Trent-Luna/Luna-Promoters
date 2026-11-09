'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getSession, hasRole } from '@/lib/auth'

export interface OcResult { ok: boolean; message: string; data?: any }

// Every Off Campus admin change goes through one of these database
// functions. Each one checks is_admin() itself, so this list is a guard
// against typos, not the permission check.
const ALLOWED = new Set([
  'offcampus_admin_set_settings', 'offcampus_admin_approve_rules', 'offcampus_admin_team', 'offcampus_admin_team_request',
  'offcampus_admin_organiser', 'offcampus_admin_create_season', 'offcampus_admin_season_status', 'offcampus_admin_update_night',
  'offcampus_admin_void_arrival', 'offcampus_admin_add_arrival', 'offcampus_admin_reattribute', 'offcampus_admin_change_team',
  'offcampus_admin_suspend', 'offcampus_admin_clear_flag', 'offcampus_admin_propose_prize', 'offcampus_admin_prize',
  'offcampus_admin_export', 'offcampus_admin_members', 'offcampus_admin_night_report',
])

const READS = new Set(['offcampus_admin_export', 'offcampus_admin_members', 'offcampus_admin_night_report'])

const WORDS: Record<string, string> = {
  not_authorised: 'Only admins can do that.',
  reason_required: 'A reason is required.',
  rules_not_approved: 'Approve a rules version (with a tie rule) before switching prizes on.',
  tie_rule_required: 'Choose a tie rule first.',
  version_required: 'Enter the rules version you are approving.',
  duplicate: 'That club already exists at this university.',
  bad_target: 'Pick an active club at the same university to merge into.',
  not_pending: 'That request has already been decided.',
  bad_team: 'That club isn’t active at that university.',
  team_not_active: 'A club with that name exists but is retired or merged. Restore it first or pick another.',
  bad_window: 'That door window overlaps another night or is longer than 16 hours.',
  overlap: 'That season overlaps another season.',
  not_thursday: 'A season has to start on a Thursday.',
  has_arrivals: 'This night already has counted arrivals, so it can’t be skipped.',
  already: 'That member is already counted for that night.',
  bad_night: 'That night hasn’t started yet.',
  prizes_off: 'Prizes are switched off in settings.',
  winner_level_required: 'Choose whether the season prize goes to a club or a university first.',
  not_finished: 'That night or season hasn’t finished yet.',
  no_arrivals: 'No arrivals were counted for it.',
  exists: 'A prize for that already exists. Cancel it first to propose again.',
  open_flags: 'There are open flags for that night. Clear them before verifying.',
  standings_changed: 'The standings changed since this was proposed. Cancel it and propose again.',
  second_admin_required: 'A different admin has to approve what you verified.',
  no_recipient: 'Set the winning club’s approved organiser as recipient first.',
  not_organiser: 'That member isn’t an approved organiser of the winning club.',
  flagged: 'This prize is flagged. Cancel and propose again.',
  not_tied: 'Pick one of the tied groups.',
  bad_status: 'That step isn’t available for this prize now.',
  not_found: 'Not found.',
}

export async function ocRpc(fn: string, args: Record<string, unknown>): Promise<OcResult> {
  try {
    if (!ALLOWED.has(fn)) return { ok: false, message: 'Unknown action.' }
    const s = await getSession()
    if (!hasRole(s, 'admin')) return { ok: false, message: WORDS.not_authorised }
    const supabase = await createClient()
    const { data, error } = await supabase.rpc(fn, args)
    if (error) return { ok: false, message: error.message }
    if (!data?.ok) return { ok: false, message: WORDS[data?.error] ?? data?.detail ?? data?.error ?? 'Something went wrong.' }
    if (!READS.has(fn)) revalidatePath('/admin/offcampus')
    return { ok: true, message: 'Saved.', data }
  } catch (e: any) {
    return { ok: false, message: e?.message ?? 'Something went wrong.' }
  }
}
