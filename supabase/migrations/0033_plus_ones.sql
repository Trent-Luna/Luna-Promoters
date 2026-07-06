-- =====================================================================
-- Luna Promoters :: 0033 "+1s" on manually-added guests
-- plus_ones = number of EXTRA people in the party (party size = 1 + plus_ones).
-- Only set via the manual guestlist add; public sign-ups stay at 0.
-- =====================================================================

alter table public.guest_registrations
  add column if not exists plus_ones int not null default 0;

-- manual staff add now accepts p_plus_ones
drop function if exists public.add_guest_manual_vd(uuid,date,text,text,text,text,date,text,text);
create or replace function public.add_guest_manual_vd(
  p_venue uuid, p_date date, p_first text, p_last text, p_mobile text,
  p_email text, p_dob date, p_instagram text, p_occasion text default null,
  p_plus_ones int default 0
) returns json language plpgsql security definer set search_path = public as $$
declare ven record; eid uuid; pid uuid; g_id uuid; existing uuid; reg record; extras int;
begin
  select * into ven from public.venues where id = p_venue;
  if ven is null then return json_build_object('ok',false,'error','venue_not_found'); end if;
  if not public.manages_venue(p_venue) then return json_build_object('ok',false,'error','not_authorised'); end if;
  if p_date is null or p_date < (current_date - interval '1 day') or p_date > (current_date + interval '1 year') then
    return json_build_object('ok',false,'error','bad_date'); end if;

  extras := greatest(0, least(coalesce(p_plus_ones,0), 50));
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

  insert into public.guest_registrations(guest_id,promoter_id,event_id,venue_id,marketing_consent,special_occasion,plus_ones)
    values (g_id, pid, eid, p_venue, false, nullif(p_occasion,''), extras) returning * into reg;
  perform public.log_action('guest_registered', auth.uid(), p_venue, eid, pid, g_id,
    'manual add' || case when extras > 0 then ' +' || extras else '' end);
  return json_build_object('ok',true,'registration_id',reg.id,'plus_ones',extras);
end $$;
grant execute on function public.add_guest_manual_vd(uuid,date,text,text,text,text,date,text,text,int) to authenticated;
