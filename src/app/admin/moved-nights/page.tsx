import { getSession, hasRole } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/AppShell'
import { navForRoles } from '@/components/nav'
import { MovedNightsPanel, type MovedGroup } from './panel'
import { prettyNight, venueToday } from '@/lib/trading'

export const dynamic = 'force-dynamic'

/**
 * The guests whose night we changed, and whether they have been told.
 *
 * WHY A SCREEN AND NOT A SCRIPT. Fifty-four registrations were moved off
 * nights the venue does not trade. Correcting the records took minutes;
 * telling twenty-nine people is the part that actually puts it right, and it
 * is the part a script cannot be trusted with unsupervised — every row here is
 * a real person who will read what goes out.
 *
 * So the sending is a button a manager presses, next to the exact wording, and
 * every send is stamped so nobody is emailed twice. The list empties itself as
 * it is worked through, which is the only status anyone needs.
 *
 * It is also NOT a one-off. The same page catches any future move — a manager
 * shifting a guest from the Guestlists screen leaves the same trail, and the
 * guest is one press away from knowing.
 */
export default async function MovedNights() {
  const s = await getSession()
  if (!s) redirect('/login')
  if (!hasRole(s, 'admin', 'venue_manager')) redirect('/dashboard')

  const svc = createServiceClient()
  const today = venueToday()
  const { data } = await svc
    .from('guest_registrations')
    .select('id,guest_id,venue_id,moved_from,moved_notice_sent_at,special_occasion,guests(first_name,last_name,email),venues(name),events!inner(event_date)')
    .not('moved_from', 'is', null)
    .gte('events.event_date', today)
    .order('moved_from')

  const mine = (data ?? []).filter((r: any) =>
    s.roles.includes('admin') || s.venueIds.includes(r.venue_id))

  // One email per guest per venue: Ryan Tankei was listed at both Su Casa and
  // Eclipse for the same birthday, and those are two different nights to tell
  // him about, not one message with a muddle in it.
  const byKey = new Map<string, MovedGroup>()
  for (const r of mine as any[]) {
    const key = `${r.guest_id}:${r.venue_id}`
    const night = r.events?.event_date as string
    const g = byKey.get(key)
    if (g) {
      g.nights.push(night)
      if (r.moved_from < g.was) g.was = r.moved_from
      if (!r.moved_notice_sent_at) g.pending = true
      continue
    }
    byKey.set(key, {
      guestId: r.guest_id,
      venueId: r.venue_id,
      name: `${r.guests?.first_name ?? ''} ${r.guests?.last_name ?? ''}`.trim() || 'Guest',
      email: r.guests?.email ?? null,
      venue: r.venues?.name ?? 'Luna Group',
      occasion: r.special_occasion ?? null,
      was: r.moved_from,
      nights: [night],
      pending: !r.moved_notice_sent_at,
    })
  }

  const groups = [...byKey.values()]
    .map((g) => ({ ...g, nights: g.nights.sort() }))
    .sort((a, b) => a.nights[0].localeCompare(b.nights[0]))

  const waiting = groups.filter((g) => g.pending).length
  const soon = groups.filter((g) => g.pending && g.nights[0] <= addDaysIso(today, 3))

  return (
    <AppShell nav={navForRoles(s.roles)} current="/admin/moved-nights" title="Moved nights"
      subtitle={waiting === 0
        ? 'Everyone whose night changed has been told.'
        : `${waiting} guest${waiting === 1 ? '' : 's'} still hold a confirmation with the old date.`}>
      {soon.length > 0 && (
        <div className="card p-4 mb-4 border-amber-500/40">
          <p className="text-sm text-amber-400 font-semibold">
            {soon.length === 1 ? 'One of these is' : `${soon.length} of these are`} within three days —
            {' '}{soon.map((g) => `${g.name} (${prettyNight(g.nights[0])})`).join(', ')}.
          </p>
        </div>
      )}
      <MovedNightsPanel groups={groups} />
    </AppShell>
  )
}

function addDaysIso(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
