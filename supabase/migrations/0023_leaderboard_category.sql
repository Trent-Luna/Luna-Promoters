-- =====================================================================
-- Luna Promoters :: 0023 Add category to the leaderboard output
-- =====================================================================

drop function if exists public.get_leaderboard(uuid,uuid,date,date,int);
create or replace function public.get_leaderboard(
  p_event uuid default null, p_venue uuid default null,
  p_from date default null, p_to date default null, p_limit int default 100
) returns table (
  rank bigint, promoter_id uuid, promoter_name text, promoter_code text,
  venue_name text, registered bigint, checked_in bigint, no_shows bigint,
  attendance_pct int, tier tier_name, category text
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
      and gr.promoter_id not in (select id from public.promoters where is_house)
    group by gr.promoter_id
  )
  select row_number() over (order by b.checked_in desc, b.registered desc) as rank,
         p.id, p.full_name, p.promoter_code,
         (select v.name from public.venues v where v.id = p.preferred_venue_id) as venue_name,
         b.registered, b.checked_in, b.no_shows,
         case when b.registered>0 then round(100.0*b.checked_in/b.registered)::int else 0 end,
         p.current_tier, p.category
  from base b join public.promoters p on p.id = b.promoter_id
  order by b.checked_in desc, b.registered desc
  limit p_limit;
$$;
grant execute on function public.get_leaderboard(uuid,uuid,date,date,int) to authenticated;
