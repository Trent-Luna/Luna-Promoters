-- 0049 — Manual add reuses an existing guest only when the NAME matches too.
--
-- Reception adds walk-in groups with the venue's landline in the mobile field
-- (07 3213 00xx). add_guest_manual_vd matched guests on mobile alone, so every
-- group typed with that number was attached to whichever guest first used it —
-- the list read "Dale Laidlaw" (12 regs), "Patrick Walker" (16), "Brodie
-- Evans" (6) while the toast said the typed name was on the list.
--
-- Now: an existing guest is reused when the mobile (or email) matches AND the
-- first+last name agree, ignoring case and spacing. A different name on the
-- same number gets its own guest row (guests.mobile is not unique). The
-- per-event duplicate check is unchanged — the same person twice is still
-- refused — but it now compares against guests of that name only.

create or replace function public.add_guest_manual_vd(
  p_venue uuid, p_date date, p_first text, p_last text, p_mobile text, p_email text,
  p_dob date, p_instagram text, p_occasion text default null, p_plus_ones integer default 0,
  p_notes text default null, p_override boolean default false)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare ven record; eid uuid; pid uuid; g_id uuid; existing record; reg record; extras int;
        n_first text; n_last text;
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

  n_first := lower(regexp_replace(coalesce(p_first,''), '\s+', '', 'g'));
  n_last  := lower(regexp_replace(coalesce(p_last,''),  '\s+', '', 'g'));

  -- Same contact detail AND same name: that is the same person. Same number
  -- with a different name is a shared/venue number — a new guest.
  select id into g_id from public.guests g
    where (g.mobile = p_mobile or (p_email is not null and p_email <> '' and g.email = p_email::citext))
      and lower(regexp_replace(coalesce(g.first_name,''), '\s+', '', 'g')) = n_first
      and lower(regexp_replace(coalesce(g.last_name,''),  '\s+', '', 'g')) = n_last
    order by g.created_at limit 1;
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
