-- Guest list entry stops at a set time each night.
--
-- Trent, 8 Oct 2026: "i need to make sure that the guest list for pump only runs
-- till 11pm strictly and mamacita 10:30".
--
-- venues.guestlist_until is the venue's nightly cut-off (Brisbane time). Null
-- means no cut-off, which is every other venue, unchanged. A time before 6am
-- means after midnight on the same trading night. events.cutoff_at, where it is
-- set, still wins for that one night.
--
-- Enforced in the database, so it holds whatever screen is used:
--   * register_guest_vd / register_guest refuse a sign-up for a night whose
--     cut-off has passed ('guestlist_closed').
--   * door_check_in / door_check_in_by_token (and the old check_in_guest /
--     check_in_by_token, which now forward to them) refuse a guest list
--     check-in after the cut-off ('guestlist_closed'). Recording a "no entry"
--     still works. p_at lets an offline door tap be judged by when it was made, not when the
--     phone got signal back (trusted only within the last 12 hours).

alter table public.venues add column if not exists guestlist_until time;
comment on column public.venues.guestlist_until is
  'Nightly guest list cut-off, Brisbane time. Null = none. Before 06:00 = after midnight.';

update public.venues set guestlist_until = time '23:00' where slug = 'pump-nightclub';
update public.venues set guestlist_until = time '22:30' where slug = 'mamacita-nightclub';

create or replace function public.guestlist_cutoff(p_venue uuid, p_date date)
returns timestamptz
language sql stable security definer set search_path to 'public'
as $$
  select coalesce(
    (select e.cutoff_at from public.events e
      where e.venue_id = p_venue and e.event_date = p_date and e.cutoff_at is not null
      order by e.created_at limit 1),
    (select ((p_date + case when v.guestlist_until < time '06:00' then 1 else 0 end)
              + v.guestlist_until) at time zone 'Australia/Brisbane'
       from public.venues v where v.id = p_venue and v.guestlist_until is not null)
  );
$$;
grant execute on function public.guestlist_cutoff(uuid, date) to anon, authenticated, service_role;

-- ── sign-ups ────────────────────────────────────────────────────────────────
create or replace function public.register_guest_vd(p_promoter_code text, p_venue uuid, p_date date, p_first text, p_last text, p_mobile text, p_email text, p_dob date, p_instagram text, p_marketing boolean, p_occasion text DEFAULT NULL::text, p_source text DEFAULT NULL::text, p_override boolean DEFAULT false)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare prom record; ven record; eid uuid; g_id uuid; existing uuid; reg record; src text; cut timestamptz;
begin
  select * into prom from public.promoters where promoter_code = p_promoter_code and status = 'approved';
  if prom is null then return json_build_object('ok',false,'error','promoter_not_found'); end if;
  select * into ven from public.venues where id = p_venue and active = true;
  if ven is null then return json_build_object('ok',false,'error','venue_not_found'); end if;
  if p_date is null or p_date < current_date or p_date > (current_date + interval '1 year') then
    return json_build_object('ok',false,'error','bad_date'); end if;
  if p_email is null or btrim(p_email) = '' or position('@' in p_email) = 0 then
    return json_build_object('ok',false,'error','email_required'); end if;

  -- The doors have to be open. A guest who sails through this form and is
  -- turned away on the night is worse than one who is told here.
  if not coalesce(p_override,false) and not public.venue_trades(p_venue, p_date) then
    return json_build_object('ok',false,'error','not_trading',
      'suggested', public.next_trading_night(p_venue, p_date));
  end if;

  -- And the guest list has to still be running. Strict: no override.
  cut := public.guestlist_cutoff(p_venue, p_date);
  if cut is not null and now() >= cut then
    return json_build_object('ok',false,'error','guestlist_closed','closes_at',cut,
      'suggested', public.next_trading_night(p_venue, p_date + 1));
  end if;

  src := case when p_source ~ '^[a-z0-9][a-z0-9-]{0,39}$' then p_source else null end;
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

  insert into public.guest_registrations(guest_id,promoter_id,event_id,venue_id,marketing_consent,special_occasion,source)
    values (g_id, prom.id, eid, p_venue, coalesce(p_marketing,false), nullif(p_occasion,''), src)
    returning * into reg;
  perform public.log_action('guest_registered', null, p_venue, eid, prom.id, g_id, nullif(p_occasion,''));
  return json_build_object('ok',true,'registration_id',reg.id,'qr_token',reg.qr_token);
end $function$;

create or replace function public.register_guest(p_promoter_code text, p_event_id uuid, p_first text, p_last text, p_mobile text, p_email text, p_dob date, p_instagram text, p_marketing boolean)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  prom record; ev record; g_id uuid; existing uuid; reg record; cut timestamptz;
begin
  select * into prom from public.promoters where promoter_code = p_promoter_code and status = 'approved';
  if prom is null then return json_build_object('ok',false,'error','promoter_not_found'); end if;

  select * into ev from public.events where id = p_event_id and active = true;
  if ev is null then return json_build_object('ok',false,'error','event_not_found'); end if;
  cut := public.guestlist_cutoff(ev.venue_id, ev.event_date);
  if not ev.guestlist_open or (cut is not null and now() >= cut) then
    return json_build_object('ok',false,'error','guestlist_closed');
  end if;

  select id into g_id from public.guests
    where mobile = p_mobile or (p_email is not null and email = p_email::citext) limit 1;
  if g_id is null then
    insert into public.guests(first_name,last_name,mobile,email,date_of_birth,instagram)
      values (p_first,p_last,p_mobile,nullif(p_email,''),p_dob,nullif(p_instagram,''))
      returning id into g_id;
  end if;

  select id into existing from public.guest_registrations where event_id = p_event_id and guest_id = g_id;
  if existing is not null then
    return json_build_object('ok',false,'error','duplicate','registration_id',existing);
  end if;

  insert into public.guest_registrations(guest_id,promoter_id,event_id,venue_id,marketing_consent)
    values (g_id, prom.id, p_event_id, ev.venue_id, coalesce(p_marketing,false))
    returning * into reg;

  perform public.log_action('guest_registered', null, ev.venue_id, p_event_id, prom.id, g_id, null);

  return json_build_object('ok',true,'registration_id',reg.id,'qr_token',reg.qr_token,
    'promoter_name',prom.full_name,'event_name',ev.name);
end $function$;

-- ── the door ────────────────────────────────────────────────────────────────
-- door_check_in / door_check_in_by_token are the old two with one extra
-- argument, p_at. New names rather than a changed signature, so nothing is
-- dropped and the screens already deployed keep working (and are already
-- held to the cut-off through the old names, which now forward here).

create or replace function public.door_check_in(p_registration uuid, p_no_entry boolean DEFAULT false, p_notes text DEFAULT NULL::text, p_method text DEFAULT 'manual'::text, p_at timestamptz DEFAULT NULL)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare reg record; already boolean; cut timestamptz; tapped timestamptz;
begin
  select gr.*, e.venue_id as ev_venue, e.event_date as ev_date, (g.first_name || ' ' || g.last_name) as guest_name
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
    return json_build_object('ok',false,'error','already_checked_in','guest_name',reg.guest_name,
      'checked_in_at',(select checked_in_at from public.check_ins where registration_id = p_registration));
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
  return json_build_object('ok',true,'no_entry',p_no_entry,'guest_name',reg.guest_name);
end $function$;

create or replace function public.door_check_in_by_token(p_token text, p_no_entry boolean DEFAULT false, p_notes text DEFAULT NULL::text, p_expected_date date DEFAULT NULL::date, p_at timestamptz DEFAULT NULL)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare rid uuid; ev_date date; gname text;
begin
  select gr.id, e.event_date, (g.first_name || ' ' || g.last_name)
    into rid, ev_date, gname
    from public.guest_registrations gr
    join public.events e on e.id = gr.event_id
    join public.guests g on g.id = gr.guest_id
    where gr.qr_token = p_token;
  if rid is null then return json_build_object('ok',false,'error','not_found'); end if;
  if p_expected_date is not null and ev_date <> p_expected_date then
    return json_build_object('ok',false,'error','wrong_date','guest_name',gname,'event_date',ev_date);
  end if;
  return public.door_check_in(rid, p_no_entry, p_notes, 'scan', p_at);
end $function$;

grant execute on function public.door_check_in(uuid, boolean, text, text, timestamptz) to anon, authenticated, service_role;
grant execute on function public.door_check_in_by_token(text, boolean, text, date, timestamptz) to anon, authenticated, service_role;

-- The old names, same signatures, now forwarding (so the cut-off holds on them too).
create or replace function public.check_in_guest(p_registration uuid, p_no_entry boolean DEFAULT false, p_notes text DEFAULT NULL::text, p_method text DEFAULT 'manual'::text)
 RETURNS json
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.door_check_in(p_registration, p_no_entry, p_notes, p_method, null);
$function$;

create or replace function public.check_in_by_token(p_token text, p_no_entry boolean DEFAULT false, p_notes text DEFAULT NULL::text, p_expected_date date DEFAULT NULL::date)
 RETURNS json
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.door_check_in_by_token(p_token, p_no_entry, p_notes, p_expected_date, null);
$function$;

-- ── what the guest and the form are told ────────────────────────────────────
create or replace function public.get_registration_by_token(p_token text)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select json_build_object(
    'id', gr.id, 'status', gr.status, 'qr_token', gr.qr_token,
    'first_name', g.first_name, 'last_name', g.last_name,
    'event_name', e.name, 'event_date', e.event_date,
    'start_time', e.start_time, 'end_time', e.end_time,
    'venue_name', v.name, 'venue_slug', v.slug, 'promoter_name', p.full_name, 'promoter_code', p.promoter_code,
    'special_occasion', gr.special_occasion, 'group_id', gr.group_id, 'source', gr.source,
    'guestlist_until', v.guestlist_until, 'guestlist_closes_at', public.guestlist_cutoff(gr.venue_id, e.event_date)
  )
  from public.guest_registrations gr
  join public.guests g on g.id = gr.guest_id
  join public.events e on e.id = gr.event_id
  join public.venues v on v.id = gr.venue_id
  join public.promoters p on p.id = gr.promoter_id
  where gr.qr_token = p_token;
$function$;

create or replace function public.get_promoter_link(p_code text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare prom record; vens json; blk json;
begin
  select full_name, promoter_code into prom
    from public.promoters where promoter_code = p_code and status = 'approved';
  if prom.promoter_code is null then return null; end if;

  -- trading_days and guestlist_until ride along so the guest form can offer
  -- only nights the list is actually running, without a second round trip.
  select coalesce(json_agg(to_jsonb(x) order by x.name), '[]'::json) into vens
    from (select id, name, trading_days, guestlist_until from public.venues where active = true order by name) x;

  select coalesce(json_agg(json_build_object('venue_id', venue_id, 'date', blackout_date)), '[]'::json) into blk
    from public.blackout_dates where blackout_date >= current_date;

  return json_build_object('full_name', prom.full_name, 'promoter_code', prom.promoter_code,
    'venues', vens, 'blackouts', blk);
end $function$;
