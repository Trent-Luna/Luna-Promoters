-- =====================================================================
-- Luna Promoters :: 0013 Venue + Date guest flow (no manual events)
-- Guests pick a venue and a date. A "night" (event row) is created
-- automatically behind the scenes so check-ins/leaderboards still work.
-- =====================================================================

-- find or create the night for a venue + date
create or replace function public.ensure_event(p_venue uuid, p_date date)
returns uuid language plpgsql security definer set search_path = public as $$
declare eid uuid;
begin
  select id into eid from public.events
    where venue_id = p_venue and event_date = p_date
    order by created_at limit 1;
  if eid is null then
    insert into public.events(venue_id, name, event_date, active, guestlist_open)
      values (p_venue, to_char(p_date, 'Dy DD Mon'), p_date, true, true)
      returning id into eid;
  end if;
  return eid;
end $$;

-- public guest registration by venue + date
create or replace function public.register_guest_vd(
  p_promoter_code text, p_venue uuid, p_date date,
  p_first text, p_last text, p_mobile text, p_email text,
  p_dob date, p_instagram text, p_marketing boolean
) returns json language plpgsql security definer set search_path = public as $$
declare prom record; ven record; eid uuid; g_id uuid; existing uuid; reg record;
begin
  select * into prom from public.promoters where promoter_code = p_promoter_code and status = 'approved';
  if prom is null then return json_build_object('ok',false,'error','promoter_not_found'); end if;
  select * into ven from public.venues where id = p_venue and active = true;
  if ven is null then return json_build_object('ok',false,'error','venue_not_found'); end if;
  if p_date is null or p_date < current_date or p_date > (current_date + interval '1 year') then
    return json_build_object('ok',false,'error','bad_date'); end if;

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

  insert into public.guest_registrations(guest_id,promoter_id,event_id,venue_id,marketing_consent)
    values (g_id, prom.id, eid, p_venue, coalesce(p_marketing,false)) returning * into reg;
  perform public.log_action('guest_registered', null, p_venue, eid, prom.id, g_id, null);
  return json_build_object('ok',true,'registration_id',reg.id,'qr_token',reg.qr_token);
end $$;

-- manual staff add by venue + date
create or replace function public.add_guest_manual_vd(
  p_venue uuid, p_date date, p_first text, p_last text, p_mobile text,
  p_email text, p_dob date, p_instagram text
) returns json language plpgsql security definer set search_path = public as $$
declare ven record; eid uuid; pid uuid; g_id uuid; existing uuid; reg record;
begin
  select * into ven from public.venues where id = p_venue;
  if ven is null then return json_build_object('ok',false,'error','venue_not_found'); end if;
  if not public.manages_venue(p_venue) then return json_build_object('ok',false,'error','not_authorised'); end if;
  if p_date is null or p_date < (current_date - interval '1 day') or p_date > (current_date + interval '1 year') then
    return json_build_object('ok',false,'error','bad_date'); end if;

  eid := public.ensure_event(p_venue, p_date);
  pid := public.ensure_staff_promoter();

  select id into g_id from public.guests
    where mobile = p_mobile or (p_email is not null and p_email <> '' and email = p_email::citext) limit 1;
  if g_id is null then
    insert into public.guests(first_name,last_name,mobile,email,date_of_birth,instagram)
      values (p_first,p_last,p_mobile,nullif(p_email,''),p_dob,nullif(p_instagram,''))
      returning id into g_id;
  end if;
  select id into existing from public.guest_registrations where event_id = eid and guest_id = g_id;
  if existing is not null then return json_build_object('ok',false,'error','duplicate'); end if;

  insert into public.guest_registrations(guest_id,promoter_id,event_id,venue_id,marketing_consent)
    values (g_id, pid, eid, p_venue, false) returning * into reg;
  perform public.log_action('guest_registered', auth.uid(), p_venue, eid, pid, g_id, 'manual add');
  return json_build_object('ok',true,'registration_id',reg.id);
end $$;

-- promoter-link data now returns the list of venues (no events)
create or replace function public.get_promoter_link(p_code text)
returns json language plpgsql stable security definer set search_path = public as $$
declare prom record; vens json;
begin
  select full_name, promoter_code into prom
    from public.promoters where promoter_code = p_code and status = 'approved';
  if prom.promoter_code is null then return null; end if;

  select coalesce(json_agg(to_jsonb(x) order by x.name), '[]'::json) into vens
    from (select id, name from public.venues where active = true order by name) x;

  return json_build_object('full_name', prom.full_name, 'promoter_code', prom.promoter_code, 'venues', vens);
end $$;

grant execute on function public.ensure_event(uuid,date) to authenticated;
grant execute on function public.register_guest_vd(text,uuid,date,text,text,text,text,date,text,boolean) to anon, authenticated;
grant execute on function public.add_guest_manual_vd(uuid,date,text,text,text,text,date,text) to authenticated;
grant execute on function public.get_promoter_link(text) to anon, authenticated;

-- include the promoter code on the token lookup so the guest's
-- "share with friends" can point friends at the promoter's own link
create or replace function public.get_registration_by_token(p_token text)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'id', gr.id, 'status', gr.status, 'qr_token', gr.qr_token,
    'first_name', g.first_name, 'last_name', g.last_name,
    'event_name', e.name, 'event_date', e.event_date,
    'start_time', e.start_time, 'end_time', e.end_time,
    'venue_name', v.name, 'promoter_name', p.full_name, 'promoter_code', p.promoter_code
  )
  from public.guest_registrations gr
  join public.guests g on g.id = gr.guest_id
  join public.events e on e.id = gr.event_id
  join public.venues v on v.id = gr.venue_id
  join public.promoters p on p.id = gr.promoter_id
  where gr.qr_token = p_token;
$$;
