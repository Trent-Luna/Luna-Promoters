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
    email, password, email_confirm: true,
  })
  if (created?.user) {
    userId = created.user.id
  } else {
    // user may already exist — find their id from the profile table
    const { data: existing } = await svc.from('users').select('id').eq('email', email).maybeSingle()
    if (existing?.id) userId = existing.id
    else throw new Error(createErr?.message || 'Could not create the account')
  }

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
