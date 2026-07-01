-- =====================================================================
-- Luna Promoters :: 0018 Blackout dates (guestlist closed on set dates)
-- venue_id null = applies to ALL venues (admin only). Otherwise a single
-- venue (venue managers may black out their own venues).
-- =====================================================================

create table if not exists public.blackout_dates (
  id            uuid primary key default gen_random_uuid(),
  venue_id      uuid references public.venues(id) on delete cascade,
  blackout_date date not null,
  reason        text,
  created_by    uuid references public.users(id),
  created_at    timestamptz not null default now(),
  unique (venue_id, blackout_date)
);

alter table public.blackout_dates enable row level security;
drop policy if exists blackout_read on public.blackout_dates;
drop policy if exists blackout_admin on public.blackout_dates;
drop policy if exists blackout_vm_ins on public.blackout_dates;
drop policy if exists blackout_vm_del on public.blackout_dates;
create policy blackout_read  on public.blackout_dates for select using (auth.uid() is not null);
create policy blackout_admin on public.blackout_dates for all
  using (public.is_admin()) with check (public.is_admin());
create policy blackout_vm_ins on public.blackout_dates for insert
  with check (public.has_role('venue_manager') and venue_id is not null and public.manages_venue(venue_id));
create policy blackout_vm_del on public.blackout_dates for delete
  using (public.has_role('venue_manager') and venue_id is not null and public.manages_venue(venue_id));

create or replace function public.is_blacked_out(p_venue uuid, p_date date)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.blackout_dates
    where blackout_date = p_date and (venue_id is null or venue_id = p_venue)
  );
$$;
grant execute on function public.is_blacked_out(uuid,date) to anon, authenticated;

-- register_guest_vd now refuses blacked-out venue+dates
create or replace function public.register_guest_vd(
  p_promoter_code text, p_venue uuid, p_date date,
  p_first text, p_last text, p_mobile text, p_email text,
  p_dob date, p_instagram text, p_marketing boolean, p_occasion text default null
) returns json language plpgsql security definer set search_path = public as $$
declare prom record; ven record; eid uuid; g_id uuid; existing uuid; reg record;
begin
  select * into prom from public.promoters where promoter_code = p_promoter_code and status = 'approved';
  if prom is null then return json_build_object('ok',false,'error','promoter_not_found'); end if;
  select * into ven from public.venues where id = p_venue and active = true;
  if ven is null then return json_build_object('ok',false,'error','venue_not_found'); end if;
  if p_date is null or p_date < current_date or p_date > (current_date + interval '1 year') then
    return json_build_object('ok',false,'error','bad_date'); end if;
  if public.is_blacked_out(p_venue, p_date) then
    return json_build_object('ok',false,'error','blacked_out'); end if;

  eid := public.ensure_event(p_venue, p_date);

  select id into g_id from public.guests
    where mobile = p_mobile or (p_email is not null and p_email <> '' and email = p_email::citext) limit 1;
  if g_id is null then
    insert into public.guests(first_name,last_name,mobile,email,date_of_birth,instagram)
      values (p_first,p_last,p_mobile,nullif(p_email,''),p_dob,nullif(p_instagram,''))
      returning id into g_id;
  end if;

  select id into existing from public.guest_registrations where event_id = eid and guest_id = g_id;
  if existing is not null then return json_build_object('ok',false,'error','duplicate'); end if;

  insert into public.guest_registrations(guest_id,promoter_id,event_id,venue_id,marketing_consent,special_occasion)
    values (g_id, prom.id, eid, p_venue, coalesce(p_marketing,false), nullif(p_occasion,''))
    returning * into reg;
  perform public.log_action('guest_registered', null, p_venue, eid, prom.id, g_id, nullif(p_occasion,''));
  return json_build_object('ok',true,'registration_id',reg.id,'qr_token',reg.qr_token);
end $$;
grant execute on function public.register_guest_vd(text,uuid,date,text,text,text,text,date,text,boolean,text) to anon, authenticated;

-- promoter-link data also returns upcoming blackout dates so the form can warn
create or replace function public.get_promoter_link(p_code text)
returns json language plpgsql stable security definer set search_path = public as $$
declare prom record; vens json; blk json;
begin
  select full_name, promoter_code into prom
    from public.promoters where promoter_code = p_code and status = 'approved';
  if prom.promoter_code is null then return null; end if;

  select coalesce(json_agg(to_jsonb(x) order by x.name), '[]'::json) into vens
    from (select id, name from public.venues where active = true order by name) x;

  select coalesce(json_agg(json_build_object('venue_id', venue_id, 'date', blackout_date)), '[]'::json) into blk
    from public.blackout_dates where blackout_date >= current_date;

  return json_build_object('full_name', prom.full_name, 'promoter_code', prom.promoter_code,
    'venues', vens, 'blackouts', blk);
end $$;
grant execute on function public.get_promoter_link(text) to anon, authenticated;
