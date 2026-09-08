-- Who has just signed up, and whether any of them has actually started.
--
-- Trent (8 Sep 2026): "can you add in a 'new promoters' or Recent adds for
-- recently signed up promoters. perhaps the last 14 days".
--
-- The overview counts active, dormant and pending promoters, but a sign-up
-- that is auto-approved passes straight through 'pending' and lands in the
-- 175-strong active count with nothing to distinguish it. Fifty-one people
-- joined in the last fortnight and there was no screen in the app that said so.
--
-- The second half of this function is the part worth having. A new promoter is
-- only worth anything once they register a guest, so the intake is returned
-- alongside how many of them have -- because at the time of writing that is one
-- of fifty-one, and a list of fifty-one names would have hidden it.
--
-- is_staff / is_house are excluded: those are Luna's own accounts and the house
-- link, not people who signed up.

create or replace function public.get_new_promoters(p_days int default 14, p_limit int default 6)
returns json
language sql
stable
security definer
set search_path to 'public'
as $$
  with w as (
    select
      greatest(coalesce(p_days, 14), 1) as days,
      now() - (greatest(coalesce(p_days, 14), 1) || ' days')::interval as since
  ),
  cohort as (
    select p.id, p.full_name, p.promoter_code, p.category, p.status,
           p.current_tier, p.created_at, p.welcomed_at,
           coalesce(r.registered, 0) as registered,
           coalesce(r.checked_in, 0) as checked_in
    from w
    cross join public.promoters p
    left join lateral (
      select count(*) as registered,
             count(*) filter (where gr.status = 'checked_in') as checked_in
      from public.guest_registrations gr
      where gr.promoter_id = p.id
    ) r on true
    where p.is_staff = false
      and p.is_house = false
      and p.created_at >= w.since
  ),
  prior as (
    -- The fortnight before this one, so the number has something to be read
    -- against. Sign-ups run in bursts after a night; one week alone says little.
    select count(*) as n
    from w, public.promoters p
    where p.is_staff = false
      and p.is_house = false
      and p.created_at >= w.since - (w.days || ' days')::interval
      and p.created_at < w.since
  )
  select json_build_object(
    'days', w.days,
    'since', (w.since at time zone 'Australia/Brisbane')::date,
    'total', (select count(*) from cohort),
    'promoters', (select count(*) from cohort where category = 'promoter'),
    'djs', (select count(*) from cohort where category = 'dj'),
    'staff', (select count(*) from cohort where category = 'staff'),
    'pending', (select count(*) from cohort where status = 'pending'),
    'started', (select count(*) from cohort where registered > 0),
    'checked_in_any', (select count(*) from cohort where checked_in > 0),
    'prior_total', (select n from prior),
    'rows', coalesce((
      select json_agg(row_to_json(c) order by c.created_at desc)
      from (
        select * from cohort order by created_at desc limit greatest(coalesce(p_limit, 6), 1)
      ) c
    ), '[]'::json)
  )
  from w;
$$;

grant execute on function public.get_new_promoters(int, int) to authenticated;

comment on function public.get_new_promoters(int, int) is
  'Recent sign-ups for the admin overview: the intake over the last p_days, the same window before it, and how many of the new people have registered a guest.';
