-- =====================================================================
-- Luna Promoters :: 0034
--  * Reports count "+1s" as real heads (1 + plus_ones).
--  * Guest drill-downs show method (scan/manual) and who checked them in.
--  * New guest directory for the "Guests" tab.
-- =====================================================================

-- --------------------------- weekly summary (heads) ---------------------------
create or replace function public.get_weekly_summary(p_from timestamptz, p_to timestamptz)
returns json language sql stable security definer set search_path = public as $$
  with ci as (
    select c.no_entry, gr.promoter_id, gr.venue_id, coalesce(gr.plus_ones,0) as extra
    from public.check_ins c
    join public.guest_registrations gr on gr.id = c.registration_id
    where c.checked_in_at >= p_from and c.checked_in_at < p_to
  ),
  ranked as (
    select p.id, p.full_name, p.promoter_code, p.current_tier, p.category,
           sum(case when ci.no_entry = false then 1 + ci.extra else 0 end) as checked_in
    from ci join public.promoters p on p.id = ci.promoter_id
    where not p.is_house
    group by p.id, p.full_name, p.promoter_code, p.current_tier, p.category
  )
  select json_build_object(
    'registered',       (select count(*) + coalesce(sum(plus_ones),0) from public.guest_registrations gr where gr.created_at >= p_from and gr.created_at < p_to),
    'checked_in',       (select coalesce(sum(case when no_entry = false then 1 + extra else 0 end),0) from ci),
    'no_entry',         (select coalesce(sum(case when no_entry = true  then 1 + extra else 0 end),0) from ci),
    'new_applications', (select count(*) from public.promoters p where p.created_at >= p_from and p.created_at < p_to and not p.is_house and not p.is_staff),
    'approved',         (select count(*) from public.promoters p where p.approved_at >= p_from and p.approved_at < p_to and not p.is_house and not p.is_staff),
    'events',           (select count(*) from public.events e where e.event_date >= p_from::date and e.event_date < p_to::date),
    'active_promoters', (select count(*) from ranked where checked_in > 0),
    'house_checked_in', (select coalesce(sum(case when ci.no_entry = false then 1 + ci.extra else 0 end),0) from ci join public.promoters p on p.id = ci.promoter_id where p.is_house),
    'house_id',         (select id from public.promoters where is_house order by created_at limit 1),
    'top_promoters', (select coalesce(json_agg(t),'[]') from (select id,full_name,promoter_code,current_tier,checked_in from ranked where category='promoter' order by checked_in desc limit 10) t),
    'top_djs',       (select coalesce(json_agg(t),'[]') from (select id,full_name,promoter_code,current_tier,checked_in from ranked where category='dj' order by checked_in desc limit 5) t),
    'top_staff',     (select coalesce(json_agg(t),'[]') from (select id,full_name,promoter_code,current_tier,checked_in from ranked where category='staff' order by checked_in desc limit 5) t),
    'top_venues', (select coalesce(json_agg(t),'[]') from (select v.name, sum(case when ci.no_entry=false then 1 + ci.extra else 0 end) as checked_in from ci join public.venues v on v.id = ci.venue_id group by v.id,v.name order by checked_in desc) t)
  );
$$;
grant execute on function public.get_weekly_summary(timestamptz, timestamptz) to authenticated;

-- --------------------------- per-person guest list ---------------------------
create or replace function public.get_week_guests(p_promoter uuid, p_from timestamptz, p_to timestamptz)
returns json language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(row_to_json(t) order by t.checked_in_at), '[]'::json)
  from (
    select g.first_name, g.last_name, v.name as venue_name,
           e.event_date, c.checked_in_at, c.no_entry, gr.special_occasion,
           coalesce(gr.plus_ones,0) as plus_ones, c.method,
           cu.full_name as checked_in_by
    from public.check_ins c
    join public.guest_registrations gr on gr.id = c.registration_id
    join public.guests g on g.id = gr.guest_id
    join public.venues v on v.id = gr.venue_id
    join public.events e on e.id = gr.event_id
    left join public.users cu on cu.id = c.checked_in_by
    where gr.promoter_id = p_promoter
      and c.checked_in_at >= p_from and c.checked_in_at < p_to
  ) t;
$$;
grant execute on function public.get_week_guests(uuid, timestamptz, timestamptz) to authenticated;

-- --------------------------- full breakdown (PDF) ---------------------------
create or replace function public.get_week_breakdown(p_from timestamptz, p_to timestamptz)
returns json language sql stable security definer set search_path = public as $$
  with ci as (
    select c.no_entry, gr.promoter_id, coalesce(gr.plus_ones,0) as extra
    from public.check_ins c
    join public.guest_registrations gr on gr.id = c.registration_id
    where c.checked_in_at >= p_from and c.checked_in_at < p_to
  ),
  people as (
    select p.id, p.full_name, p.promoter_code,
           case when p.is_house then 'house' else coalesce(p.category,'promoter') end as category,
           sum(case when ci.no_entry = false then 1 + ci.extra else 0 end) as checked_in,
           sum(case when ci.no_entry = true  then 1 + ci.extra else 0 end) as no_entry
    from ci join public.promoters p on p.id = ci.promoter_id
    group by p.id, p.full_name, p.promoter_code, category
  )
  select coalesce(
    json_agg(row_to_json(x) order by
      (case x.category when 'house' then 0 when 'promoter' then 1 when 'dj' then 2 else 3 end),
      x.checked_in desc),
    '[]'::json)
  from (
    select pe.id, pe.full_name, pe.promoter_code, pe.category, pe.checked_in, pe.no_entry,
      (select coalesce(json_agg(row_to_json(gd) order by gd.checked_in_at), '[]'::json)
       from (
         select g.first_name, g.last_name, v.name as venue_name,
                e.event_date, c.checked_in_at, c.no_entry, gr.special_occasion,
                coalesce(gr.plus_ones,0) as plus_ones, c.method,
                cu.full_name as checked_in_by
         from public.check_ins c
         join public.guest_registrations gr on gr.id = c.registration_id
         join public.guests g on g.id = gr.guest_id
         join public.venues v on v.id = gr.venue_id
         join public.events e on e.id = gr.event_id
         left join public.users cu on cu.id = c.checked_in_by
         where gr.promoter_id = pe.id
           and c.checked_in_at >= p_from and c.checked_in_at < p_to
       ) gd) as guests
    from people pe
  ) x;
$$;
grant execute on function public.get_week_breakdown(timestamptz, timestamptz) to authenticated;

-- --------------------------- guest directory (Guests tab) ---------------------------
create or replace function public.get_guest_directory()
returns json language sql stable security definer set search_path = public as $$
  select case when public.is_admin() then coalesce(
    (select json_agg(row_to_json(x) order by x.last_seen desc nulls last)
     from (
       select g.id, g.first_name, g.last_name, g.mobile, g.email, g.instagram,
              count(gr.id) as registrations,
              count(gr.id) filter (where gr.status = 'checked_in') as attended,
              max(e.event_date) as last_seen,
              coalesce(array_agg(distinct v.name) filter (where v.name is not null), '{}') as venues
       from public.guests g
       left join public.guest_registrations gr on gr.guest_id = g.id
       left join public.events e on e.id = gr.event_id
       left join public.venues v on v.id = gr.venue_id
       group by g.id
     ) x), '[]'::json)
  else '[]'::json end;
$$;
grant execute on function public.get_guest_directory() to authenticated;
