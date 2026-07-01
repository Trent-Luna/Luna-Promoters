-- =====================================================================
-- Luna Promoters :: 0021 Keep the public "Luna Group" house guestlist
-- out of the promoter leaderboards, reported separately.
-- =====================================================================

alter table public.promoters add column if not exists is_house boolean not null default false;
update public.promoters set is_house = true where promoter_code = 'luna';

-- leaderboard: exclude the house record from ranking
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
      and gr.promoter_id not in (select id from public.promoters where is_house)
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

-- weekly summary: top promoters exclude house; report house total separately
create or replace function public.get_weekly_summary(p_from timestamptz, p_to timestamptz)
returns json language sql stable security definer set search_path = public as $$
  with ci as (
    select c.no_entry, gr.promoter_id, gr.venue_id
    from public.check_ins c
    join public.guest_registrations gr on gr.id = c.registration_id
    where c.checked_in_at >= p_from and c.checked_in_at < p_to
  )
  select json_build_object(
    'registered',       (select count(*) from public.guest_registrations gr where gr.created_at >= p_from and gr.created_at < p_to),
    'checked_in',       (select count(*) from ci where no_entry = false),
    'no_entry',         (select count(*) from ci where no_entry = true),
    'new_applications', (select count(*) from public.promoters p where p.created_at >= p_from and p.created_at < p_to and not p.is_house and not p.is_staff),
    'approved',         (select count(*) from public.promoters p where p.approved_at >= p_from and p.approved_at < p_to and not p.is_house and not p.is_staff),
    'events',           (select count(*) from public.events e where e.event_date >= p_from::date and e.event_date < p_to::date),
    'active_promoters', (select count(distinct ci.promoter_id) from ci join public.promoters p on p.id = ci.promoter_id where ci.no_entry = false and not p.is_house),
    'house_checked_in', (select count(*) from ci join public.promoters p on p.id = ci.promoter_id where ci.no_entry = false and p.is_house),
    'top_promoters', (
      select coalesce(json_agg(t), '[]') from (
        select p.full_name, p.promoter_code, p.current_tier,
               count(*) filter (where ci.no_entry = false) as checked_in
        from ci join public.promoters p on p.id = ci.promoter_id
        where not p.is_house
        group by p.id, p.full_name, p.promoter_code, p.current_tier
        order by checked_in desc limit 10
      ) t
    ),
    'top_venues', (
      select coalesce(json_agg(t), '[]') from (
        select v.name, count(*) filter (where ci.no_entry = false) as checked_in
        from ci join public.venues v on v.id = ci.venue_id
        group by v.id, v.name order by checked_in desc
      ) t
    )
  );
$$;
grant execute on function public.get_weekly_summary(timestamptz, timestamptz) to authenticated;

-- house total for a date range (for the admin overview separate line)
create or replace function public.get_house_stats(p_from date default null, p_to date default null)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'registered', count(*),
    'checked_in', count(*) filter (where gr.status = 'checked_in')
  )
  from public.guest_registrations gr
  join public.events e on e.id = gr.event_id
  join public.promoters p on p.id = gr.promoter_id
  where p.is_house
    and (p_from is null or e.event_date >= p_from)
    and (p_to   is null or e.event_date <= p_to);
$$;
grant execute on function public.get_house_stats(date,date) to authenticated;
