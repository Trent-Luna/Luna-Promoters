/**
 * One night's own guest-list cut-off and the note the admin wrote for the
 * sign-up form (events.description). Several event rows can share a venue and
 * a date; public.guestlist_cutoff uses the earliest row that has cutoff_at,
 * and the note comes from that same row when it has one.
 */

export type EventNotice = {
  venueId: string
  date: string
  cutoffAt: string | null
  description: string | null
}

export type EventNoticeRow = {
  venue_id: string
  event_date: string
  cutoff_at: string | null
  description: string | null
  created_at?: string | null
}

function text(value: string | null | undefined): string {
  return String(value ?? '').trim()
}

/** Collapse raw event rows into one notice per venue and date. Rows with neither field are dropped. */
export function noticesFromRows(rows: EventNoticeRow[]): EventNotice[] {
  const groups = new Map<string, EventNoticeRow[]>()
  for (const row of rows) {
    if (!row.venue_id || !row.event_date) continue
    const key = `${row.venue_id}|${row.event_date}`
    const list = groups.get(key)
    if (list) list.push(row)
    else groups.set(key, [row])
  }
  const out: EventNotice[] = []
  for (const list of groups.values()) {
    const ordered = [...list].sort((a, b) => String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')))
    const cutoffRow = ordered.find(row => row.cutoff_at)
    const description = text(cutoffRow?.description) || text(ordered.find(row => text(row.description))?.description) || null
    if (!cutoffRow?.cutoff_at && !description) continue
    out.push({
      venueId: ordered[0].venue_id,
      date: String(ordered[0].event_date).slice(0, 10),
      cutoffAt: cutoffRow?.cutoff_at ?? null,
      description,
    })
  }
  return out
}
