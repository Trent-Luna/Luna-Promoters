-- "Already on the list" says who, when, and by whom.
--
-- Trent, 16 Sep 2026, from his phone: "I tried to put somebody on the list for
-- tomorrow night at eclipse even after ticking that i know its normally closed
-- and it said they were already on the guest list but that was a lie."
--
-- It was not a lie, and that is the problem. The audit log shows the first
-- press succeeded at 18:55:38 (manual add, non-trading night, overridden) and
-- the second press, seconds later, was refused as a duplicate -- because it
-- was one. What Trent saw was a form that emptied itself and a small green
-- line he never noticed on a phone with the keyboard up, followed by a red
-- line that contradicted what he believed had just happened.
--
-- A refusal that names the existing entry cannot be read as a lie: "Jv Jv is
-- already on Eclipse's list for Thu 17 Sep -- added 20 seconds ago by you."
-- So the duplicate branch now returns the registration it found. The screen
-- does the wording; this just stops throwing the fact away.
create or replace function public.add_guest_manual_vd(
  p_venue uuid, p_date date, p_first text, p_last text, p_mobile text, p_email text, p_dob date, p_instagram text,
  p_occasion text default null, p_plus_ones integer default 0, p_notes text default null, p_override boolean default false)
returns json language plpgsql security definer set search_path to 'public' as $function$
declare ven record; eid uuid; pid uuid; g_id uuid; existing record; reg record; extras int;
begin
  select * into ven from public.venues where id = p_venue;
  if ven is null then return json_build_object('ok',false,'error','venue_not_found'); end if;
  if not public.manages_venue(p_venue) then return json_build_object('ok',false,'error','not_authorised'); end if;
  if p_date is null or p_date < (current_date - interval '1 day') or p_date > (current_date + interval '1 year') then
    return json_build_object('ok',false,'error','bad_date'); end if;
  if not coalesce(p_override,false) and not public.venue_trades(p_venue, p_date) then
    return json_build_object('ok',false,'error','not_trading',
      'suggested', public.next_trading_night(p_venue, p_date));
  end if;

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

  select r.id, r.created_at, g.first_name, g.last_name, g.mobile, p.full_name as promoter_name
    into existing
  from public.guest_registrations r
  join public.guests g on g.id = r.guest_id
  left join public.promoters p on p.id = r.promoter_id
  where r.event_id = eid and r.guest_id = g_id;
  if existing.id is not null then
    return json_build_object('ok',false,'error','duplicate',
      'existing', json_build_object(
        'registration_id', existing.id,
        'name', trim(coalesce(existing.first_name,'') || ' ' || coalesce(existing.last_name,'')),
        'mobile', existing.mobile,
        'added_at', existing.created_at,
        'promoter', existing.promoter_name,
        'same_mobile', existing.mobile = p_mobile));
  end if;

  insert into public.guest_registrations(guest_id,promoter_id,event_id,venue_id,marketing_consent,special_occasion,plus_ones,notes)
    values (g_id, pid, eid, p_venue, false, nullif(p_occasion,''), extras, nullif(p_notes,'')) returning * into reg;
  perform public.log_action('guest_registered', auth.uid(), p_venue, eid, pid, g_id,
    'manual add' || case when extras > 0 then ' +' || extras else '' end
    || case when coalesce(p_override,false) and not public.venue_trades(p_venue,p_date) then ' (non-trading night, overridden)' else '' end);
  return json_build_object('ok',true,'registration_id',reg.id,'plus_ones',extras);
end $function$;
