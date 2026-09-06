'use server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getSession, hasRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

async function ensureAdmin() {
  const s = await getSession()
  if (!hasRole(s, 'admin')) throw new Error('Not authorised')
  return s!
}
async function ensureManager() {
  const s = await getSession()
  if (!hasRole(s, 'admin', 'venue_manager')) throw new Error('Not authorised')
  return s!
}

export async function approvePromoter(id: string) {
  await ensureAdmin()
  const supabase = await createClient()
  const { error } = await supabase.rpc('approve_promoter', { p_id: id })
  if (error) throw error
  revalidatePath('/admin/promoters')
}

// ---------- University auto-approve setting ----------
// Separate from the promoter switch on purpose. The two queues are reviewed by
// different people for different reasons — a promoter application is a business
// decision, a university one is an identity check — and a venue that wants to
// eyeball every student ID should not have to stop approving promoters to do it.
export async function setUniversityAutoApprove(on: boolean) {
  await ensureAdmin()
  const supabase = await createClient()
  const { error } = await supabase.from('app_settings')
    .update({ auto_approve_university: on, updated_at: new Date().toISOString() }).eq('id', 1)
  if (error) throw error
  revalidatePath('/admin/university')
}

// Approve-all override. Separate from the auto-approve switch because they
// answer different questions: that one asks whether a PASSING check needs a
// human, this one ignores the check's verdict entirely.
export async function setUniversityApproveAll(on: boolean) {
  await ensureAdmin()
  const supabase = await createClient()
  const { error } = await supabase.from('app_settings')
    .update({ university_approve_all: on, updated_at: new Date().toISOString() }).eq('id', 1)
  if (error) throw error
  revalidatePath('/admin/university')
}

export async function setPromoterStatus(id: string, status: 'rejected' | 'suspended' | 'approved') {
  const s = await ensureAdmin()
  const supabase = await createClient()
  const { error } = await supabase.from('promoters').update({ status }).eq('id', id)
  if (error) throw error
  await supabase.rpc('log_action', {
    p_action: `promoter_${status}`, p_user: s.userId, p_promoter: id,
  })
  revalidatePath('/admin/promoters')
}

export async function addPromoterNote(promoterId: string, note: string) {
  const s = await ensureAdmin()
  const supabase = await createClient()
  const { error } = await supabase.from('admin_notes').insert({ promoter_id: promoterId, author_id: s.userId, note })
  if (error) throw error
  revalidatePath('/admin/promoters')
}

export async function setEliteOverride(id: string, elite: boolean) {
  await ensureAdmin()
  const supabase = await createClient()
  const { error } = await supabase.from('promoters')
    .update({ elite_override: elite, current_tier: elite ? 'elite' : 'bronze' }).eq('id', id)
  if (error) throw error
  revalidatePath('/admin/promoters')
}

export async function createVenue(fd: FormData) {
  await ensureAdmin()
  const supabase = await createClient()
  const name = String(fd.get('name') || '').trim()
  const slug = String(fd.get('slug') || '').trim() || name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const { error } = await supabase.from('venues').insert({ name, slug, address: String(fd.get('address') || '') || null })
  if (error) throw error
  revalidatePath('/admin/venues')
}

export async function toggleVenue(id: string, active: boolean) {
  await ensureAdmin()
  const supabase = await createClient()
  await supabase.from('venues').update({ active }).eq('id', id)
  revalidatePath('/admin/venues')
}

/**
 * Permanently remove a venue — but only when nothing points at it.
 *
 * `venues` is the parent of six cascading foreign keys (events,
 * guest_registrations, roles, blackout_dates, whats_on, and venue rooms), so an
 * unguarded delete would take every historical guest and check-in for that venue
 * with it, silently. This exists for the realistic case — a venue added by
 * mistake or a typo — and refuses everything else, pointing at Disable instead,
 * which already removes a venue from the public guestlist and every picker.
 */
export async function deleteVenue(id: string): Promise<{ ok: boolean; error?: string }> {
  await ensureAdmin()
  const supabase = await createClient()

  // Count anything that would be destroyed by the cascade. head+exact gives a
  // count without pulling rows back.
  const [events, regs, roles, blackouts] = await Promise.all([
    supabase.from('events').select('id', { count: 'exact', head: true }).eq('venue_id', id),
    supabase.from('guest_registrations').select('id', { count: 'exact', head: true }).eq('venue_id', id),
    supabase.from('roles').select('id', { count: 'exact', head: true }).eq('venue_id', id),
    supabase.from('blackout_dates').select('id', { count: 'exact', head: true }).eq('venue_id', id),
  ])

  const blockers: string[] = []
  if (events.count) blockers.push(`${events.count} event${events.count === 1 ? '' : 's'}`)
  if (regs.count) blockers.push(`${regs.count} guest registration${regs.count === 1 ? '' : 's'}`)
  if (roles.count) blockers.push(`${roles.count} staff role${roles.count === 1 ? '' : 's'}`)
  if (blackouts.count) blockers.push(`${blackouts.count} blackout date${blackouts.count === 1 ? '' : 's'}`)

  if (blockers.length > 0) {
    return {
      ok: false,
      error: `This venue has ${blockers.join(', ')}. Deleting it would remove that history too. Disable it instead — it disappears from the guestlist and every picker, and the records stay.`,
    }
  }

  const { error } = await supabase.from('venues').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }

  revalidatePath('/admin/venues')
  return { ok: true }
}

export async function createEvent(fd: FormData) {
  const s = await ensureManager()
  const supabase = await createClient()
  const payload: any = {
    venue_id: fd.get('venue_id'), name: String(fd.get('name')),
    event_date: fd.get('event_date'),
    start_time: fd.get('start_time') || null, end_time: fd.get('end_time') || null,
    description: String(fd.get('description') || '') || null,
    guestlist_open: fd.get('guestlist_open') === 'on',
    created_by: s.userId,
  }
  const { data, error } = await supabase.from('events').insert(payload).select('id,venue_id').single()
  if (error) throw error
  await supabase.rpc('log_action', { p_action: 'event_created', p_user: s.userId, p_venue: data.venue_id, p_event: data.id })
  revalidatePath('/admin/events')
}

export async function toggleGuestlist(id: string, open: boolean) {
  await ensureManager()
  const supabase = await createClient()
  await supabase.from('events').update({ guestlist_open: open }).eq('id', id)
  revalidatePath('/admin/events')
}

export async function updateTier(fd: FormData) {
  await ensureAdmin()
  const supabase = await createClient()
  const name = String(fd.get('name'))
  const min = fd.get('min_guests') ? Number(fd.get('min_guests')) : null
  const max = fd.get('max_guests') ? Number(fd.get('max_guests')) : null
  const { error } = await supabase.from('tiers')
    .update({ min_guests: min, max_guests: max, perks: String(fd.get('perks') || '') }).eq('name', name)
  if (error) throw error
  revalidatePath('/admin/tiers')
}

// ---------- Staff management (admin creates managers / door staff) ----------
export async function createStaff(fd: FormData) {
  await ensureAdmin()
  const email = String(fd.get('email') || '').trim().toLowerCase()
  const fullName = String(fd.get('full_name') || '').trim()
  const password = String(fd.get('password') || '')
  const role = String(fd.get('role') || '') as 'admin' | 'venue_manager' | 'reception'
  const venueId = String(fd.get('venue_id') || '') || null

  if (!email || password.length < 6) throw new Error('Email and a 6+ character password are required')
  if ((role === 'venue_manager' || role === 'reception') && !venueId)
    throw new Error('Please choose a venue for this role')

  const svc = createServiceClient()

  // create the auth user (or reuse if they already exist)
  let userId: string | null = null
  const { data: created, error: createErr } = await svc.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { full_name: fullName },
  })
  if (created?.user) {
    userId = created.user.id
  } else {
    // user may already exist — find their id from the profile table
    const { data: existing } = await svc.from('users').select('id').eq('email', email).maybeSingle()
    if (existing?.id) userId = existing.id
    else throw new Error(createErr?.message || 'Could not create the account')
  }

  // make sure the profile carries their name (for leaderboards etc.)
  if (fullName && userId) await svc.from('users').update({ full_name: fullName }).eq('id', userId)

  // grant the role (venue-scoped for manager/reception)
  const { error: roleErr } = await svc.from('roles')
    .insert({ user_id: userId, role, venue_id: venueId })
  if (roleErr && !roleErr.message.includes('duplicate')) throw roleErr

  await svc.rpc('log_action', { p_action: `staff_added_${role}`, p_user: (await ensureAdmin()).userId })
  revalidatePath('/admin/staff')
}

export async function removeStaffRole(roleId: string) {
  await ensureAdmin()
  const supabase = await createClient()
  const { error } = await supabase.from('roles').delete().eq('id', roleId)
  if (error) throw error
  revalidatePath('/admin/staff')
}

// ---------- Auto-approve setting ----------
export async function setAutoApprove(on: boolean) {
  await ensureAdmin()
  const supabase = await createClient()
  const { error } = await supabase.from('app_settings')
    .update({ auto_approve_promoters: on, updated_at: new Date().toISOString() }).eq('id', 1)
  if (error) throw error
  revalidatePath('/admin/promoters')
}

// ---------- Blackout dates ----------
export async function addBlackout(fd: FormData) {
  const s = await ensureManager()
  const supabase = await createClient()
  const venueRaw = String(fd.get('venue_id') || '')
  const venue_id = venueRaw === 'ALL' ? null : venueRaw || null
  const date = String(fd.get('blackout_date') || '')
  const reason = String(fd.get('reason') || '') || null
  if (!date) throw new Error('Please choose a date')
  // venue managers cannot create all-venue blackouts
  if (!s.roles.includes('admin') && !venue_id) throw new Error('Only admins can black out all venues')
  const { error } = await supabase.from('blackout_dates')
    .insert({ venue_id, blackout_date: date, reason, created_by: s.userId })
  if (error) throw error.message.includes('duplicate') ? new Error('That date is already blacked out for this venue') : error
  revalidatePath('/admin/blackout')
}

export async function removeBlackout(id: string) {
  await ensureManager()
  const supabase = await createClient()
  const { error } = await supabase.from('blackout_dates').delete().eq('id', id)
  if (error) throw error
  revalidatePath('/admin/blackout')
}

// ---------- Promoter category (promoter / dj / staff) ----------
export async function setPromoterCategory(id: string, category: 'promoter' | 'dj' | 'staff') {
  await ensureAdmin()
  const supabase = await createClient()
  const { error } = await supabase.from('promoters').update({ category }).eq('id', id)
  if (error) throw error
  revalidatePath('/admin/promoters')
}

// ---------- What's On (venue newsfeed) ----------
export async function createPost(fd: FormData) {
  const s = await ensureManager()
  const supabase = await createClient()
  const venueRaw = String(fd.get('venue_id') || '')
  const venue_id = venueRaw === 'ALL' ? null : (venueRaw || null)
  const title = String(fd.get('title') || '').trim()
  const body = String(fd.get('body') || '').trim() || null
  const image_url = String(fd.get('image_url') || '').trim() || null
  if (!title) throw new Error('A title is required')
  if (!s.roles.includes('admin') && !venue_id) throw new Error('Only admins can post to all venues')
  const { error } = await supabase.from('venue_posts')
    .insert({ venue_id, title, body, image_url, created_by: s.userId })
  if (error) throw error
  revalidatePath('/admin/whats-on')
}

export async function deletePost(id: string) {
  await ensureManager()
  const supabase = await createClient()
  const { error } = await supabase.from('venue_posts').delete().eq('id', id)
  if (error) throw error
  revalidatePath('/admin/whats-on')
}

// ---------- Tonight board (overview) ----------
/**
 * Open or close a venue's guestlist for a night from the overview. If the night
 * has no event row yet, `ensure_event` creates the same auto-named row a guest
 * sign-up would, so "Open list" works before anyone has registered.
 */
export async function setNightList(venueId: string, date: string, open: boolean) {
  const s = await ensureManager()
  if (!s.roles.includes('admin') && !s.venueIds.includes(venueId)) throw new Error('Not authorised')
  const supabase = await createClient()
  const { data: eventId, error } = await supabase.rpc('ensure_event', { p_venue: venueId, p_date: date })
  if (error || !eventId) throw error ?? new Error('Could not find the night')
  const { error: upErr } = await supabase.from('events').update({ guestlist_open: open }).eq('id', eventId)
  if (upErr) throw upErr
  await supabase.rpc('log_action', { p_action: open ? 'guestlist_opened' : 'guestlist_closed', p_user: s.userId, p_venue: venueId, p_event: eventId })
  revalidatePath('/admin'); revalidatePath('/admin/events'); revalidatePath('/venue')
}

// ---------- Dormant promoters ----------
/**
 * A re-engagement email to one promoter. Sent through Resend like the guest
 * confirmation; records `nudged_at` so the same person is not nudged twice in a
 * fortnight. Returns what happened rather than throwing, so a bulk run can
 * report "12 sent, 3 skipped" instead of stopping at the first missing email.
 */
export async function nudgePromoter(id: string): Promise<{ ok: boolean; reason?: string }> {
  await ensureAdmin()
  const svc = createServiceClient()
  const { data: p } = await svc.from('promoters')
    .select('id,full_name,email,promoter_code,nudged_at,current_tier').eq('id', id).maybeSingle()
  if (!p) return { ok: false, reason: 'not_found' }
  if (!p.email) return { ok: false, reason: 'no_email' }
  if (p.nudged_at && Date.now() - new Date(p.nudged_at).getTime() < 14 * 864e5) return { ok: false, reason: 'recently_nudged' }
  const { sendPromoterNudge } = await import('@/lib/email/promoters')
  const sent = await sendPromoterNudge(p.email, p.full_name, p.promoter_code ?? '')
  if (!sent.ok) return { ok: false, reason: sent.reason }
  await svc.from('promoters').update({ nudged_at: new Date().toISOString() }).eq('id', id)
  revalidatePath('/admin/promoters')
  return { ok: true }
}

export async function nudgeDormantPromoters(): Promise<{ sent: number; skipped: number }> {
  await ensureAdmin()
  const svc = createServiceClient()
  const { data: rows } = await svc.from('promoters').select('id')
    .eq('status', 'approved').not('dormant_since', 'is', null)
    .or(`nudged_at.is.null,nudged_at.lt.${new Date(Date.now() - 14 * 864e5).toISOString()}`)
    .limit(200)
  let sent = 0, skipped = 0
  for (const r of rows ?? []) {
    const res = await nudgePromoter(r.id)
    if (res.ok) sent++; else skipped++
  }
  revalidatePath('/admin/promoters')
  return { sent, skipped }
}

export async function reactivatePromoter(id: string) {
  const s = await ensureAdmin()
  const supabase = await createClient()
  const { error } = await supabase.from('promoters').update({ dormant_since: null }).eq('id', id)
  if (error) throw error
  await supabase.rpc('log_action', { p_action: 'promoter_reactivated', p_user: s.userId, p_promoter: id })
  revalidatePath('/admin/promoters')
}

export async function setDormantWeeks(weeks: number) {
  await ensureAdmin()
  const w = Math.min(52, Math.max(1, Math.round(weeks)))
  const supabase = await createClient()
  const { error } = await supabase.from('app_settings').update({ dormant_weeks: w, updated_at: new Date().toISOString() }).eq('id', 1)
  if (error) throw error
  await supabase.rpc('mark_dormant_promoters')
  revalidatePath('/admin/tiers'); revalidatePath('/admin/promoters')
}

// ---------- Source links (My Link) ----------
export async function createSourceLink(fd: FormData) {
  const s = await ensureManager()
  const supabase = await createClient()
  const label = String(fd.get('label') || '').trim()
  const key = String(fd.get('key') || '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
  const promoterId = String(fd.get('promoter_id') || '')
  if (!label || !key) throw new Error('A label and a key are required')
  // Admins may create links for the house promoter; everyone may for their own.
  if (!s.roles.includes('admin')) {
    const { data: mine } = await supabase.rpc('get_my_link')
    if (!mine) throw new Error('Not authorised')
  }
  const { error } = await supabase.from('source_links').insert({ promoter_id: promoterId, key, label, created_by: s.userId })
  if (error) throw error.message.includes('duplicate') ? new Error('That key is already in use on this link') : error
  revalidatePath('/admin/mylink')
}

export async function deleteSourceLink(id: string) {
  await ensureManager()
  const supabase = await createClient()
  const { error } = await supabase.from('source_links').delete().eq('id', id)
  if (error) throw error
  revalidatePath('/admin/mylink')
}

// ---------- Occasion follow-through ----------
/**
 * Sends a birthday / hens / bucks guest the VIP booth offer for their venue —
 * the same content the confirmation email carries, as a follow-up the venue
 * can trigger when it wants the table. Stamped so it is not sent twice.
 */
export async function sendBoothOffer(registrationId: string): Promise<{ ok: boolean; reason?: string }> {
  const s = await ensureManager()
  const svc = createServiceClient()
  const { data: reg } = await svc.from('guest_registrations')
    .select('id,venue_id,special_occasion,booth_offer_sent_at,guests(first_name,email),venues(name,slug),events(event_date)')
    .eq('id', registrationId).maybeSingle()
  if (!reg) return { ok: false, reason: 'not_found' }
  if (!s.roles.includes('admin') && !s.venueIds.includes((reg as any).venue_id)) return { ok: false, reason: 'not_authorised' }
  const g: any = (reg as any).guests
  if (!g?.email) return { ok: false, reason: 'no_email' }
  const { sendBoothOfferEmail } = await import('@/lib/email/guests')
  const sent = await sendBoothOfferEmail({
    to: g.email, first: g.first_name || 'there',
    venue: (reg as any).venues?.name || 'Luna Group', venueSlug: (reg as any).venues?.slug,
    occasion: (reg as any).special_occasion, eventDate: (reg as any).events?.event_date,
  })
  if (!sent.ok) return { ok: false, reason: sent.reason }
  await svc.from('guest_registrations').update({ booth_offer_sent_at: new Date().toISOString() }).eq('id', registrationId)
  await svc.rpc('log_action', { p_action: 'booth_offer_sent', p_user: s.userId, p_venue: (reg as any).venue_id, p_notes: (reg as any).special_occasion ?? null })
  revalidatePath('/admin/guestlists')
  return { ok: true }
}

export async function deleteSourceLinkForm(fd: FormData) {
  await deleteSourceLink(String(fd.get('id') || ''))
}
