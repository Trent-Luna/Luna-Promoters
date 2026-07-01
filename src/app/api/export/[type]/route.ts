import { NextResponse } from 'next/server'
import { getSession, hasRole } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { toCSV } from '@/lib/format'
import { pct } from '@/lib/format'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: Promise<{ type: string }> }) {
  const s = await getSession()
  if (!hasRole(s, 'admin', 'venue_manager')) return new NextResponse('Unauthorised', { status: 401 })
  const { type } = await params
  const url = new URL(request.url)
  const venue = url.searchParams.get('venue') || null
  const event = url.searchParams.get('event') || null
  const from = url.searchParams.get('from') || null
  const to = url.searchParams.get('to') || null
  const promoter = url.searchParams.get('promoter') || null

  // Venue managers are limited to their assigned venues.
  const scopedVenues = s!.roles.includes('admin') ? null : (s!.venueIds.length ? s!.venueIds : ['00000000-0000-0000-0000-000000000000'])
  const sb = createServiceClient()

  let filename = 'export.csv'
  let csv = ''

  if (type === 'promoters') {
    let q = sb.from('promoters').select('id,full_name,email,mobile,date_of_birth,instagram,tiktok,facebook,suburb,status,current_tier,created_at,preferred_venue_id,venues:preferred_venue_id(name)')
    if (promoter) q = q.eq('id', promoter)
    const { data } = await q
    // performance rollup (current month) per promoter
    const rows = await Promise.all((data ?? []).map(async (p: any) => {
      const { data: ev } = await sb.rpc('get_promoter_events', { p_promoter: p.id })
      const reg = (ev ?? []).reduce((a: number, e: any) => a + Number(e.registered), 0)
      const ci = (ev ?? []).reduce((a: number, e: any) => a + Number(e.checked_in), 0)
      return [p.id, p.full_name, p.email, p.mobile, p.date_of_birth, p.instagram, p.tiktok, p.facebook,
        p.suburb, p.venues?.name ?? '', '', p.status, p.current_tier, reg, ci, pct(ci, reg), p.created_at]
    }))
    csv = toCSV(['Promoter ID', 'Full Name', 'Email', 'Phone', 'Date of Birth', 'Instagram', 'TikTok',
      'Facebook', 'Suburb', 'Preferred Venue', 'Other Venues Interested', 'Approval Status', 'Tier',
      'Total Registered Guests', 'Total Checked-in Guests', 'Attendance %', 'Created Date'], rows)
    filename = 'promoters.csv'
  }

  else if (type === 'guests' || type === 'attendance') {
    let q = sb.from('guest_registrations').select(`id,status,created_at,marketing_consent,
      guests(first_name,last_name,email,mobile,date_of_birth,instagram),
      events(name,event_date), venues(name), promoters(full_name,promoter_code),
      check_ins(checked_in_at,no_entry,notes)`)
    if (event) q = q.eq('event_id', event)
    if (venue) q = q.eq('venue_id', venue)
    else if (scopedVenues) q = q.in('venue_id', scopedVenues)
    if (promoter) q = q.eq('promoter_id', promoter)
    const { data } = await q
    const filtered = (data ?? []).filter((r: any) => {
      const d = r.events?.event_date
      if (from && d < from) return false
      if (to && d > to) return false
      return true
    })
    if (type === 'guests') {
      const rows = filtered.map((r: any) => [
        r.id, r.guests?.first_name, r.guests?.last_name, r.guests?.email, r.guests?.mobile,
        r.guests?.date_of_birth, r.guests?.instagram, r.venues?.name, r.events?.name, r.events?.event_date,
        r.promoters?.full_name, r.promoters?.promoter_code, r.status,
        r.status === 'checked_in' ? 'Yes' : 'No',
        r.check_ins?.[0]?.checked_in_at ?? '', r.marketing_consent ? 'Yes' : 'No', r.created_at])
      csv = toCSV(['Guest ID', 'First Name', 'Last Name', 'Email', 'Phone', 'Date of Birth', 'Instagram',
        'Venue', 'Event', 'Event Date', 'Promoter Name', 'Promoter Code', 'Registered Status',
        'Checked In', 'Check-in Time', 'Marketing Consent', 'Created Date'], rows)
      filename = 'guests.csv'
    } else {
      const rows = filtered.map((r: any) => [
        r.events?.name, r.venues?.name, r.events?.event_date,
        r.guests?.first_name, r.guests?.last_name, r.guests?.email, r.guests?.mobile,
        r.promoters?.full_name, r.promoters?.promoter_code, r.status,
        r.status === 'checked_in' ? 'Yes' : 'No', r.check_ins?.[0]?.checked_in_at ?? '',
        r.check_ins?.[0]?.notes ?? ''])
      csv = toCSV(['Event Name', 'Venue', 'Event Date', 'Guest First Name', 'Guest Last Name', 'Email',
        'Phone', 'Promoter Name', 'Promoter Code', 'Registered Status', 'Checked In', 'Check-in Time',
        'Door Notes'], rows)
      filename = 'event-attendance.csv'
    }
  }

  else if (type === 'performance') {
    const { data } = await sb.rpc('get_leaderboard', {
      p_event: event, p_venue: venue ?? (scopedVenues ? scopedVenues[0] : null),
      p_from: from, p_to: to, p_limit: 1000,
    })
    const rows = (data ?? []).map((r: any) => [
      r.promoter_name, r.promoter_code, r.venue_name ?? '', event ? 'Single event' : 'Filtered range',
      from ?? '', r.registered, r.checked_in, r.no_shows, r.attendance_pct, r.tier, r.rank])
    csv = toCSV(['Promoter Name', 'Promoter Code', 'Venue', 'Event', 'Event Date', 'Registered Guests',
      'Checked-in Guests', 'No-shows', 'Attendance %', 'Tier', 'Leaderboard Rank'], rows)
    filename = 'promoter-performance.csv'
  }

  else return new NextResponse('Unknown export type', { status: 400 })

  await sb.rpc('log_action', { p_action: 'csv_exported', p_user: s!.userId, p_notes: type })

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
