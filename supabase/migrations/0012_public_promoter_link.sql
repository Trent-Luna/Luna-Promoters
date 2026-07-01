-- =====================================================================
-- Luna Promoters :: 0012 Public promoter-link data
-- The /p/{code} page is public (guests are not logged in). RLS blocks
-- anonymous reads of promoters/events, so we expose a SECURITY DEFINER
-- function that returns only the promoter's display name + open events.
-- =====================================================================

create or replace function public.get_promoter_link(p_code text)
returns json language plpgsql stable security definer set search_path = public as $$
declare prom record; evs json;
begin
  select full_name, promoter_code into prom
    from public.promoters
    where promoter_code = p_code and status = 'approved';
  if prom.promoter_code is null then
    return null;   -- unknown or not-approved promoter -> page shows Not Found
  end if;

  select coalesce(json_agg(to_jsonb(x)), '[]'::json) into evs from (
    select e.id, e.name, e.event_date, e.start_time, e.end_time,
           e.venue_id, v.name as venue_name
    from public.events e
    join public.venues v on v.id = e.venue_id
    where e.active = true
      and e.guestlist_open = true
      and e.event_date >= current_date
      and (e.cutoff_at is null or now() <= e.cutoff_at)
    order by e.event_date
  ) x;

  return json_build_object(
    'full_name', prom.full_name,
    'promoter_code', prom.promoter_code,
    'events', evs
  );
end $$;

grant execute on function public.get_promoter_link(text) to anon, authenticated;
