-- =====================================================================
-- Luna Promoters :: 0035 Email is mandatory to join a guestlist
-- Enforced server-side in the public registration RPC (manual staff adds
-- are unchanged — staff may not have a guest email).
-- =====================================================================

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
  if p_email is null or btrim(p_email) = '' or position('@' in p_email) = 0 then
    return json_build_object('ok',false,'error','email_required'); end if;

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
