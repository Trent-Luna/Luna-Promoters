-- =====================================================================
-- Luna Promoters :: 0022 Categories (promoter / dj / staff)
-- Admin can assign each person a category; summary splits by category.
-- =====================================================================

alter table public.promoters add column if not exists category text not null default 'promoter';
do $$ begin
  alter table public.promoters add constraint promoters_category_chk
    check (category in ('promoter','dj','staff'));
exception when duplicate_object then null; end $$;

-- venue-manager / staff auto-records default to the 'staff' category
update public.promoters set category = 'staff' where is_staff = true and category = 'promoter';

-- new staff records are created in the 'staff' category
create or replace function public.ensure_staff_promoter()
returns uuid language plpgsql security definer set search_path = public as $$
declare pid uuid; u record; nm text; existing record;
begin
  select * into existing from public.promoters where user_id = auth.uid() limit 1;
  if existing.id is not null then
    if existing.promoter_code is null or existing.status <> 'approved' then
      update public.promoters
        set promoter_code = coalesce(promoter_code,
              public.generate_promoter_code(coalesce(nullif(full_name, ''), 'promo'))),
            status = 'approved', approved_at = coalesce(approved_at, now())
        where id = existing.id;
    end if;
    return existing.id;
  end if;

  select * into u from public.users where id = auth.uid();
  nm := coalesce(nullif(u.full_name, ''), split_part(u.email, '@', 1));
  insert into public.promoters(user_id, full_name, email, mobile, date_of_birth, status,
    promoter_code, is_staff, agreement_accepted, approved_at, category)
  values (auth.uid(), nm, u.email, 'staff:' || substr(auth.uid()::text, 1, 12), '2000-01-01',
    'approved', public.generate_promoter_code(nm), true, true, now(), 'staff')
  returning id into pid;
  return pid;
end $$;
grant execute on function public.ensure_staff_promoter() to authenticated;

-- weekly summary: separate top lists per category (all exclude the house record)
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
    'top_promoters', (select coalesce(json_agg(t),'[]') from (select full_name,promoter_code,current_tier,checked_in from ranked where category='promoter' order by checked_in desc limit 10) t),
    'top_djs',       (select coalesce(json_agg(t),'[]') from (select full_name,promoter_code,current_tier,checked_in from ranked where category='dj' order by checked_in desc limit 5) t),
    'top_staff',     (select coalesce(json_agg(t),'[]') from (select full_name,promoter_code,current_tier,checked_in from ranked where category='staff' order by checked_in desc limit 5) t),
    'top_venues', (select coalesce(json_agg(t),'[]') from (select v.name, count(*) filter (where ci.no_entry=false) as checked_in from ci join public.venues v on v.id = ci.venue_id group by v.id,v.name order by checked_in desc) t)
  );
$$;
grant execute on function public.get_weekly_summary(timestamptz, timestamptz) to authenticated;
