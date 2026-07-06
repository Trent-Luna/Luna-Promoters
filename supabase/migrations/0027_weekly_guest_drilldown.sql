-- =====================================================================
-- Luna Promoters :: 0027 Weekly report drill-down
--  * get_weekly_summary now includes each person's id (+ house_id) so the
--    report can look up who they checked in.
--  * get_week_guests(promoter, from, to) returns the individual guests a
--    person checked in during that week.
-- =====================================================================

create or replace function public.get_weekly_summary(p_from timestamptz, p_to timestamptz)
returns json language sql stable security definer set search_path = public as $$
  with ci as (
    select c.no_entry, gr.promoter_id, gr.venue_id
    from public.check_ins c
    join public.guest_registrations gr on gr.id = c.registration_id
    where c.checked_in_at >= p_from and c.checked_in_at < p_to
  ),
  ranked as (
    select p.id, p.full_name, p.promoter_code, p.current_tier, p.category,
           count(*) filter (where ci.no_entry = false) as checked_in
    from ci join public.promoters p on p.id = ci.promoter_id
    where not p.is_house
    group by p.id, p.full_name, p.promoter_code, p.current_tier, p.category
  )
  select json_build_object(
    'registered',       (select count(*) from public.guest_registrations gr where gr.created_at >= p_from and gr.created_at < p_to),
    'checked_in',       (select count(*) from ci where no_entry = false),
    'no_entry',         (select count(*) from ci where no_entry = true),
    'new_applications', (select count(*) from public.promoters p where p.created_at >= p_from and p.created_at < p_to and not p.is_house and not p.is_staff),
    'approved',         (select count(*) from public.promoters p where p.approved_at >= p_from and p.approved_at < p_to and not p.is_house and not p.is_staff),
    'events',           (select count(*) from public.events e where e.event_date >= p_from::date and e.event_date < p_to::date),
    'active_promoters', (select count(*) from ranked where checked_in > 0),
    'house_checked_in', (select count(*) from ci join public.promoters p on p.id = ci.promoter_id where ci.no_entry = false and p.is_house),
    'house_id',         (select id from public.promoters where is_house order by created_at limit 1),
    'top_promoters', (select coalesce(json_agg(t),'[]') from (select id,full_name,promoter_code,current_tier,checked_in from ranked where category='promoter' order by checked_in desc limit 10) t),
    'top_djs',       (select coalesce(json_agg(t),'[]') from (select id,full_name,promoter_code,current_tier,checked_in from ranked where category='dj' order by checked_in desc limit 5) t),
    'top_staff',     (select coalesce(json_agg(t),'[]') from (select id,full_name,promoter_code,current_tier,checked_in from ranked where category='staff' order by checked_in desc limit 5) t),
    'top_venues', (select coalesce(json_agg(t),'[]') from (select v.name, count(*) filter (where ci.no_entry=false) as checked_in from ci join public.venues v on v.id = ci.venue_id group by v.id,v.name order by checked_in desc) t)
  );
$$;
grant execute on function public.get_weekly_summary(timestamptz, timestamptz) to authenticated;

-- Individual guests a given person checked in during the week window.
create or replace function public.get_week_guests(p_promoter uuid, p_from timestamptz, p_to timestamptz)
returns json language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(row_to_json(t) order by t.checked_in_at), '[]'::json)
  from (
    select g.first_name, g.last_name, v.name as venue_name,
           e.event_date, c.checked_in_at, c.no_entry, gr.special_occasion
    from public.check_ins c
    join public.guest_registrations gr on gr.id = c.registration_id
    join public.guests g on g.id = gr.guest_id
    join public.venues v on v.id = gr.venue_id
    join public.events e on e.id = gr.event_id
    where gr.promoter_id = p_promoter
      and c.checked_in_at >= p_from and c.checked_in_at < p_to
  ) t;
$$;
grant execute on function public.get_week_guests(uuid, timestamptz, timestamptz) to authenticated;
