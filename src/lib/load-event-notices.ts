import { createServiceClient } from '@/lib/supabase/server'
import { addDays, venueToday } from '@/lib/trading'
import { noticesFromRows, type EventNotice, type EventNoticeRow } from '@/lib/event-notices'

/**
 * Upcoming nights that carry their own cut-off or a sign-up note.
 * Read-only. An empty list leaves every form on the venue time, as before.
 * The public client cannot read events (RLS), so this uses the service role
 * the confirmation email already uses, and only these columns.
 */
export async function loadEventNotices(): Promise<EventNotice[]> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return []
  try {
    const from = venueToday()
    const to = addDays(from, 365)
    const { data, error } = await createServiceClient()
      .from('events')
      .select('venue_id, event_date, cutoff_at, description, created_at')
      .gte('event_date', from)
      .lte('event_date', to)
    if (error || !data) return []
    return noticesFromRows(data as EventNoticeRow[])
  } catch {
    return []
  }
}

/** The note for one night, for the pass. Null when that night has none. */
export async function eventNoteFor(slug: string | null | undefined, date: string | null | undefined): Promise<string | null> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !slug || !date) return null
  try {
    const svc = createServiceClient()
    const { data: venue } = await svc.from('venues').select('id').eq('slug', slug).maybeSingle()
    if (!venue?.id) return null
    const { data, error } = await svc
      .from('events')
      .select('venue_id, event_date, cutoff_at, description, created_at')
      .eq('venue_id', venue.id)
      .eq('event_date', date)
    if (error || !data) return null
    return noticesFromRows(data as EventNoticeRow[])[0]?.description ?? null
  } catch {
    return null
  }
}
