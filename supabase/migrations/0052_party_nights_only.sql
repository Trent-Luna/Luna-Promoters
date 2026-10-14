-- 0052_party_nights_only.sql
--
-- Trent, 14 Oct 2026: "make sure this form is ONLY for the 10k party, i dont
-- want to mess with the original form".
--
-- 0051 had the door answer with the group size for ANY registration with
-- plus-ones. Staff can add plus-ones by hand on ordinary nights, so those
-- scans would have shown "ADMIT 3" and the group buttons. Now the group is
-- only reported on a party night (events.party set); every other night
-- answers party 1 and the door screen is exactly as it was. door_set_admitted
-- refuses anything but a party night.

create or replace function public.door_check_in(p_registration uuid, p_no_entry boolean DEFAULT false, p_notes text DEFAULT NULL::text, p_method text DEFAULT 'manual'::text, p_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare reg record; already boolean; cut timestamptz; tapped timestamptz; adm int;
begin
  select gr.*, e.venue_id as ev_venue, e.event_date as ev_date, (e.party is not null) as ev_is_party,
         (g.first_name || ' ' || g.last_name) as guest_name
    into reg
    from public.guest_registrations gr
    join public.events e on e.id = gr.event_id
    join public.guests g on g.id = gr.guest_id
    where gr.id = p_registration;
  if reg is null then return json_build_object('ok',false,'error','registration_not_found'); end if;
  if not public.manages_venue(reg.venue_id) then
    return json_build_object('ok',false,'error','not_authorised'); end if;

  select exists(select 1 from public.check_ins c where c.registration_id = p_registration) into already;
  if already then
    select admitted into adm from public.check_ins where registration_id = p_registration order by checked_in_at limit 1;
    return json_build_object('ok',false,'error','already_checked_in','guest_name',reg.guest_name,
      'checked_in_at',(select checked_in_at from public.check_ins where registration_id = p_registration order by checked_in_at limit 1),
      'registration_id', reg.id,
      'party', case when reg.ev_is_party then 1 + coalesce(reg.plus_ones,0) else 1 end,
      'admitted', case when reg.ev_is_party then coalesce(adm, 1 + coalesce(reg.plus_ones,0)) else 1 end,
      'party_names', case when reg.ev_is_party then reg.party_names end);
  end if;

  -- Guest list entry stops at the venue's cut-off. Strict: no override.
  if not coalesce(p_no_entry,false) then
    cut := public.guestlist_cutoff(reg.venue_id, reg.ev_date);
    tapped := case when p_at is not null and p_at <= now() and p_at > now() - interval '12 hours'
                   then p_at else now() end;
    if cut is not null and tapped >= cut then
      return json_build_object('ok',false,'error','guestlist_closed','guest_name',reg.guest_name,'closes_at',cut);
    end if;
  end if;

  insert into public.check_ins(registration_id,checked_in_by,no_entry,notes,method)
    values (p_registration, auth.uid(), p_no_entry, p_notes, coalesce(nullif(p_method,''),'manual'));
  update public.guest_registrations
    set status = case when p_no_entry then 'no_entry'::guest_status else 'checked_in'::guest_status end
    where id = p_registration;
  perform public.log_action(case when p_no_entry then 'guest_no_entry' else 'guest_checked_in' end,
    auth.uid(), reg.venue_id, reg.event_id, reg.promoter_id, reg.guest_id, p_notes);
  return json_build_object('ok',true,'no_entry',p_no_entry,'guest_name',reg.guest_name,
    'registration_id', reg.id,
    'party', case when reg.ev_is_party then 1 + coalesce(reg.plus_ones,0) else 1 end,
    'party_names', case when reg.ev_is_party then reg.party_names end);
end $function$;

create or replace function public.door_set_admitted(p_registration uuid, p_admitted int)
returns json
language plpgsql
security definer
set search_path = public
as $function$
declare reg record; party int; val int;
begin
  select gr.id, gr.venue_id, gr.event_id, gr.promoter_id, gr.guest_id, gr.plus_ones, (e.party is not null) as is_party into reg
    from public.guest_registrations gr join public.events e on e.id = gr.event_id where gr.id = p_registration;
  if reg is null then return json_build_object('ok',false,'error','registration_not_found'); end if;
  if not reg.is_party then return json_build_object('ok',false,'error','not_a_party_night'); end if;
  if not public.manages_venue(reg.venue_id) then
    return json_build_object('ok',false,'error','not_authorised'); end if;
  party := 1 + coalesce(reg.plus_ones, 0);
  val := case when p_admitted is null or p_admitted >= party then null else greatest(1, p_admitted) end;
  update public.check_ins set admitted = val where registration_id = p_registration and not no_entry;
  if not found then return json_build_object('ok',false,'error','not_checked_in'); end if;
  perform public.log_action('guest_party_admitted', auth.uid(), reg.venue_id, reg.event_id, reg.promoter_id, reg.guest_id,
    coalesce(val, party)::text || ' of ' || party::text);
  return json_build_object('ok',true,'party',party,'admitted',coalesce(val, party));
end $function$;
