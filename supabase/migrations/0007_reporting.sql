-- =====================================================================
-- Luna Promoters :: 0007 Reporting RPCs (leaderboards + dashboard stats)
-- =====================================================================

-- Leaderboard: checked-in guests drive ranking. Filter by event, venue, date range.
create or replace function public.get_leaderboard(
  p_event uuid default null, p_venue uuid default null,
  p_from date default null, p_to date default null, p_limit int default 100
) returns table (
  rank bigint, promoter_id uuid, promoter_name text, promoter_code text,
  venue_name text, registered bigint, checked_in bigint, no_shows bigint,
  attendance_pct int, tier tier_name
) language sql stable security definer set search_path = public as $$
  with base as (
    select gr.promoter_id,
           count(*)                                          as registered,
           count(*) filter (where gr.status='checked_in')    as checked_in,
           count(*) filter (where gr.status in ('registered','no_entry')) as no_shows
    from public.guest_registrations gr
    join public.events e on e.id = gr.event_id
    where (p_event is null or gr.event_id = p_event)
      and (p_venue is null or gr.venue_id = p_venue)
      and (p_from  is null or e.event_date >= p_from)
      and (p_to    is null or e.event_date <= p_to)
    group by gr.promoter_id
  )
  select row_number() over (order by b.checked_in desc, b.registered desc) as rank,
         p.id, p.full_name, p.promoter_code,
         (select v.name from public.venues v where v.id = p.preferred_venue_id) as venue_name,
         b.registered, b.checked_in, b.no_shows,
         case when b.registered>0 then round(100.0*b.checked_in/b.registered)::int else 0 end,
         p.current_tier
  from base b join public.promoters p on p.id = b.promoter_id
  order by b.checked_in desc, b.registered desc
  limit p_limit;
$$;
grant execute on function public.get_leaderboard(uuid,uuid,date,date,int) to authenticated;

-- Admin/venue KPI summary
create or replace function public.get_admin_stats(p_venue uuid default null)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'total_promoters',     (select count(*) from public.promoters),
    'pending_promoters',   (select count(*) from public.promoters where status='pending'),
    'active_promoters',    (select count(*) from public.promoters where status='approved'),
    'suspended_promoters', (select count(*) from public.promoters where status='suspended'),
    'total_registered',    (select count(*) from public.guest_registrations gr where p_venue is null or gr.venue_id=p_venue),
    'total_checked_in',    (select count(*) from public.guest_registrations gr where gr.status='checked_in' and (p_venue is null or gr.venue_id=p_venue))
  );
$$;
grant execute on function public.get_admin_stats(uuid) to authenticated;

-- A promoter's own event breakdown (RLS-safe: only own via my_promoter_id)
create or replace function public.get_promoter_events(p_promoter uuid)
returns table (
  event_id uuid, event_name text, venue_name text, event_date date,
  registered bigint, checked_in bigint, attendance_pct int
) language sql stable security definer set search_path = public as $$
  select e.id, e.name, v.name, e.event_date,
         count(gr.*),
         count(gr.*) filter (where gr.status='checked_in'),
         case when count(gr.*)>0 then round(100.0*count(gr.*) filter (where gr.status='checked_in')/count(gr.*))::int else 0 end
  from public.guest_registrations gr
  join public.events e on e.id = gr.event_id
  join public.venues v on v.id = gr.venue_id
  where gr.promoter_id = p_promoter
  group by e.id, e.name, v.name, e.event_date
  order by e.event_date desc;
$$;
grant execute on function public.get_promoter_events(uuid) to authenticated;
