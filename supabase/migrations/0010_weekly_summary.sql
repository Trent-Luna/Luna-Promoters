-- =====================================================================
-- Luna Promoters :: 0010 Weekly summary
-- Aggregates a time window (a "week" runs Mon 05:00 -> Mon 05:00, the
-- page computes the Brisbane boundaries and passes UTC timestamps here).
-- =====================================================================

create or replace function public.get_weekly_summary(p_from timestamptz, p_to timestamptz)
returns json language sql stable security definer set search_path = public as $$
  with ci as (
    select c.no_entry, gr.promoter_id, gr.venue_id
    from public.check_ins c
    join public.guest_registrations gr on gr.id = c.registration_id
    where c.checked_in_at >= p_from and c.checked_in_at < p_to
  )
  select json_build_object(
    'registered',       (select count(*) from public.guest_registrations gr
                          where gr.created_at >= p_from and gr.created_at < p_to),
    'checked_in',       (select count(*) from ci where no_entry = false),
    'no_entry',         (select count(*) from ci where no_entry = true),
    'new_applications', (select count(*) from public.promoters p
                          where p.created_at >= p_from and p.created_at < p_to),
    'approved',         (select count(*) from public.promoters p
                          where p.approved_at >= p_from and p.approved_at < p_to),
    'events',           (select count(*) from public.events e
                          where e.event_date >= p_from::date and e.event_date < p_to::date),
    'active_promoters', (select count(distinct promoter_id) from ci where no_entry = false),
    'top_promoters', (
      select coalesce(json_agg(t), '[]') from (
        select p.full_name, p.promoter_code, p.current_tier,
               count(*) filter (where ci.no_entry = false) as checked_in
        from ci join public.promoters p on p.id = ci.promoter_id
        group by p.id, p.full_name, p.promoter_code, p.current_tier
        order by checked_in desc limit 10
      ) t
    ),
    'top_venues', (
      select coalesce(json_agg(t), '[]') from (
        select v.name,
               count(*) filter (where ci.no_entry = false) as checked_in
        from ci join public.venues v on v.id = ci.venue_id
        group by v.id, v.name order by checked_in desc
      ) t
    )
  );
$$;
grant execute on function public.get_weekly_summary(timestamptz, timestamptz) to authenticated;
