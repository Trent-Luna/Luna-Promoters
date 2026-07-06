-- =====================================================================
-- Luna Promoters :: 0028 Full weekly breakdown (for PDF export)
-- One call returns every person who checked anyone in that week
-- (house guestlist, promoters, DJs, staff), each with their count and
-- the full list of guests they checked in.
-- =====================================================================

create or replace function public.get_week_breakdown(p_from timestamptz, p_to timestamptz)
returns json language sql stable security definer set search_path = public as $$
  with ci as (
    select c.no_entry, gr.promoter_id
    from public.check_ins c
    join public.guest_registrations gr on gr.id = c.registration_id
    where c.checked_in_at >= p_from and c.checked_in_at < p_to
  ),
  people as (
    select p.id, p.full_name, p.promoter_code,
           case when p.is_house then 'house' else coalesce(p.category,'promoter') end as category,
           count(*) filter (where ci.no_entry = false) as checked_in,
           count(*) filter (where ci.no_entry = true)  as no_entry
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
                e.event_date, c.checked_in_at, c.no_entry, gr.special_occasion
         from public.check_ins c
         join public.guest_registrations gr on gr.id = c.registration_id
         join public.guests g on g.id = gr.guest_id
         join public.venues v on v.id = gr.venue_id
         join public.events e on e.id = gr.event_id
         where gr.promoter_id = pe.id
           and c.checked_in_at >= p_from and c.checked_in_at < p_to
       ) gd) as guests
    from people pe
  ) x;
$$;
grant execute on function public.get_week_breakdown(timestamptz, timestamptz) to authenticated;
