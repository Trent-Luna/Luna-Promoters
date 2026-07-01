-- =====================================================================
-- Luna Promoters :: 0015 "My Link" for staff (admins / venue managers)
-- Returns (creating if needed) the caller's own promoter code + stats so
-- they get a shareable link/QR and we can track guests on their list.
-- =====================================================================

create or replace function public.get_my_link()
returns json language plpgsql security definer set search_path = public as $$
declare pid uuid; prom record; reg bigint; ci bigint; reg_m bigint; ci_m bigint; m date;
begin
  pid := public.ensure_staff_promoter();  -- existing promoter for the user, or a new is_staff one
  select full_name, promoter_code, current_tier into prom from public.promoters where id = pid;

  select count(*), count(*) filter (where status = 'checked_in') into reg, ci
    from public.guest_registrations where promoter_id = pid;

  m := date_trunc('month', now())::date;
  select count(*), count(*) filter (where gr.status = 'checked_in') into reg_m, ci_m
    from public.guest_registrations gr
    join public.events e on e.id = gr.event_id
    where gr.promoter_id = pid and date_trunc('month', e.event_date)::date = m;

  return json_build_object(
    'promoter_code', prom.promoter_code,
    'full_name', prom.full_name,
    'registered_total', coalesce(reg,0),
    'checked_in_total', coalesce(ci,0),
    'registered_month', coalesce(reg_m,0),
    'checked_in_month', coalesce(ci_m,0)
  );
end $$;

grant execute on function public.get_my_link() to authenticated;
