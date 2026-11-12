-- A guest list address has to have a real domain.
--
-- register_guest_vd only asked for an "@", so name@gmail, name@gnail and
-- name@t were stored and the CRM later refused them ('Invalid email').
-- guest_email_ok is the same rule as src/lib/guest-email.ts: a local part,
-- a domain, and a letter TLD of at least two characters.
--
-- Existing rows are not touched. There is no backfill. The trigger checks an
-- address only when it is inserted or actually changed, so a guest who still
-- has a bad address can be edited (name, night, notes) until that address is
-- fixed on its own.

create or replace function public.guest_email_ok(p_email text)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  v text := btrim(coalesce(p_email, ''));
  local text;
  domain text;
  labels text[];
  label text;
  tld text;
  n int;
begin
  if v = '' or length(v) > 254 or position('@' in v) = 0 then
    return false;
  end if;
  if length(v) - length(replace(v, '@', '')) <> 1 then
    return false;
  end if;
  local := split_part(v, '@', 1);
  domain := split_part(v, '@', 2);
  if local = '' or length(local) > 64 or local ~ '[[:space:]]' then
    return false;
  end if;
  if left(local, 1) = '.' or right(local, 1) = '.' or position('..' in local) > 0 then
    return false;
  end if;
  if domain = '' or length(domain) > 253 or domain ~ '[[:space:]]' or position('.' in domain) = 0 then
    return false;
  end if;
  labels := string_to_array(domain, '.');
  n := array_length(labels, 1);
  if n is null or n < 2 then
    return false;
  end if;
  tld := labels[n];
  if tld !~ '^[A-Za-z]{2,24}$' then
    return false;
  end if;
  foreach label in array labels loop
    if label is null or label = '' or length(label) > 63 then
      return false;
    end if;
    if label !~ '^[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?$' then
      return false;
    end if;
  end loop;
  return true;
end
$$;

comment on function public.guest_email_ok(text) is
  'True when an address has a domain and a letter TLD. Mirrors src/lib/guest-email.ts.';

revoke all on function public.guest_email_ok(text) from public;
grant execute on function public.guest_email_ok(text) to anon, authenticated, service_role;

-- Fires only for a new address or a changed one. A row that already has
-- name@gmail stays valid to update for as long as that column is left as it is.
create or replace function public.guests_reject_invalid_email()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.email is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.email is not distinct from old.email then
    return new;
  end if;
  if not public.guest_email_ok(new.email::text) then
    raise exception 'invalid_email'
      using errcode = '23514',
            hint = 'Use a full address with a domain, like name@gmail.com';
  end if;
  return new;
end
$$;

drop trigger if exists guests_reject_invalid_email on public.guests;
create trigger guests_reject_invalid_email
  before insert or update of email on public.guests
  for each row execute function public.guests_reject_invalid_email();

revoke all on function public.guests_reject_invalid_email() from public;
grant execute on function public.guests_reject_invalid_email() to anon, authenticated, service_role;

-- ── the writers ─────────────────────────────────────────────────────────────
-- Each returns invalid_email instead of raising, so the form can say why.
-- The trigger above still catches any path these functions don't.

create or replace function public.register_guest_vd(
  p_promoter_code text, p_venue uuid, p_date date, p_first text, p_last text,
  p_mobile text, p_email text, p_dob date, p_instagram text, p_marketing boolean,
  p_occasion text default null, p_source text default null, p_override boolean default false)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare prom record; ven record; eid uuid; g_id uuid; existing uuid; reg record; src text; cut timestamptz;
begin
  select * into prom from public.promoters where promoter_code = p_promoter_code and status = 'approved';
  if prom is null then return json_build_object('ok',false,'error','promoter_not_found'); end if;
  select * into ven from public.venues where id = p_venue and active = true;
  if ven is null then return json_build_object('ok',false,'error','venue_not_found'); end if;
  if p_date is null or p_date < current_date or p_date > (current_date + interval '1 year') then
    return json_build_object('ok',false,'error','bad_date'); end if;
  if p_email is null or btrim(p_email) = '' then
    return json_build_object('ok',false,'error','email_required'); end if;
  if not public.guest_email_ok(p_email) then
    return json_build_object('ok',false,'error','invalid_email'); end if;

  if not coalesce(p_override,false) and not public.venue_trades(p_venue, p_date) then
    return json_build_object('ok',false,'error','not_trading',
      'suggested', public.next_trading_night(p_venue, p_date));
  end if;

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

create or replace function public.register_guest(
  p_promoter_code text, p_event_id uuid, p_first text, p_last text, p_mobile text,
  p_email text, p_dob date, p_instagram text, p_marketing boolean)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
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
  if p_email is not null and btrim(p_email) <> '' and not public.guest_email_ok(p_email) then
    return json_build_object('ok',false,'error','invalid_email');
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
  if p_email is not null and btrim(p_email) <> '' and not public.guest_email_ok(p_email) then
    return json_build_object('ok',false,'error','invalid_email'); end if;
  if not coalesce(p_override,false) and not public.venue_trades(p_venue, p_date) then
    return json_build_object('ok',false,'error','not_trading',
      'suggested', public.next_trading_night(p_venue, p_date));
  end if;

  extras := greatest(0, least(coalesce(p_plus_ones,0), 50));
  eid := public.ensure_event(p_venue, p_date);
  pid := public.ensure_staff_promoter();

  n_first := lower(regexp_replace(coalesce(p_first,''), '\s+', '', 'g'));
  n_last  := lower(regexp_replace(coalesce(p_last,''),  '\s+', '', 'g'));

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

create or replace function public.update_guest_registration(
  p_registration uuid, p_first text, p_last text, p_mobile text, p_email text,
  p_dob date default null, p_instagram text default null, p_plus_ones integer default 0,
  p_notes text default null, p_occasion text default null,
  p_event_date date default null, p_override boolean default false)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_reg guest_registrations%rowtype; v_extras int; v_was date; v_event uuid; v_moved boolean := false;
begin
  select * into v_reg from guest_registrations where id = p_registration;
  if v_reg.id is null then return json_build_object('ok',false,'error','not_found'); end if;
  if not public.manages_venue(v_reg.venue_id) then return json_build_object('ok',false,'error','not_authorised'); end if;
  if p_first is null or btrim(p_first) = '' then return json_build_object('ok',false,'error','name_required'); end if;
  if p_mobile is null or btrim(p_mobile) = '' then return json_build_object('ok',false,'error','mobile_required'); end if;
  -- Same bad address as the one already stored: leave it, so the rest of the
  -- row can still be saved. Any other bad address is refused.
  if p_email is not null and btrim(p_email) <> '' and not public.guest_email_ok(p_email)
     and not exists (
       select 1 from public.guests g
       where g.id = v_reg.guest_id and g.email = btrim(p_email)::citext
     ) then
    return json_build_object('ok',false,'error','invalid_email');
  end if;

  v_extras := greatest(0, least(coalesce(p_plus_ones,0), 50));
  select event_date into v_was from public.events where id = v_reg.event_id;
  v_event := v_reg.event_id;

  if p_event_date is not null and p_event_date is distinct from v_was then
    if p_event_date < (current_date - interval '1 day') or p_event_date > (current_date + interval '1 year') then
      return json_build_object('ok',false,'error','bad_date');
    end if;
    if not coalesce(p_override,false) and not public.venue_trades(v_reg.venue_id, p_event_date) then
      return json_build_object('ok',false,'error','not_trading',
        'suggested', public.next_trading_night(v_reg.venue_id, p_event_date));
    end if;
    v_event := public.ensure_event(v_reg.venue_id, p_event_date);
    if exists (select 1 from public.guest_registrations
                where event_id = v_event and guest_id = v_reg.guest_id and id <> p_registration) then
      return json_build_object('ok',false,'error','already_on_that_night');
    end if;
    v_moved := true;
  end if;

  update public.guests set
    first_name = p_first, last_name = p_last, mobile = p_mobile,
    email = nullif(btrim(p_email),'')::citext, date_of_birth = p_dob,
    instagram = nullif(btrim(p_instagram),''), updated_at = now()
    where id = v_reg.guest_id;

  update public.guest_registrations set
    event_id = v_event,
    plus_ones = v_extras, notes = nullif(btrim(p_notes),''),
    special_occasion = nullif(btrim(p_occasion),''), updated_at = now()
    where id = p_registration;

  perform public.log_action('guest_updated', auth.uid(), v_reg.venue_id, v_event,
    v_reg.promoter_id, v_reg.guest_id,
    case when v_moved then 'moved ' || v_was || ' to ' || p_event_date else 'edited guest details' end);
  return json_build_object('ok', true, 'moved', v_moved, 'event_date', coalesce(p_event_date, v_was));
end $function$;

create or replace function public.add_group_guest(
  p_token text, p_first text, p_last text, p_mobile text, p_email text default null)
returns json
language plpgsql
security definer
set search_path to 'public'
as $$
declare host record; ev record; g_id uuid; existing uuid; reg record; gid uuid; members int;
begin
  select gr.*, e.event_date, e.guestlist_open into host
    from public.guest_registrations gr join public.events e on e.id = gr.event_id
    where gr.qr_token = p_token;
  if host is null then return json_build_object('ok',false,'error','not_found'); end if;
  if host.event_date < current_date then return json_build_object('ok',false,'error','past_event'); end if;
  if host.status = 'cancelled' then return json_build_object('ok',false,'error','cancelled'); end if;
  if p_first is null or btrim(p_first) = '' or p_mobile is null or length(regexp_replace(p_mobile, '\D', '', 'g')) < 8 then
    return json_build_object('ok',false,'error','bad_input'); end if;
  if p_email is null or btrim(p_email) = '' then
    return json_build_object('ok',false,'error','email_required'); end if;
  if not public.guest_email_ok(p_email) then
    return json_build_object('ok',false,'error','invalid_email'); end if;

  gid := coalesce(host.group_id, host.id);
  if host.group_id is null then
    update public.guest_registrations set group_id = gid where id = host.id;
  end if;
  select count(*) into members from public.guest_registrations where group_id = gid;
  if members >= 10 then return json_build_object('ok',false,'error','group_full'); end if;

  select id into g_id from public.guests
    where mobile = p_mobile or (p_email is not null and p_email <> '' and email = p_email::citext) limit 1;
  if g_id is null then
    insert into public.guests(first_name,last_name,mobile,email)
      values (btrim(p_first), coalesce(btrim(p_last), ''), btrim(p_mobile), nullif(btrim(p_email),''))
      returning id into g_id;
  end if;

  select id into existing from public.guest_registrations where event_id = host.event_id and guest_id = g_id;
  if existing is not null then return json_build_object('ok',false,'error','duplicate'); end if;

  insert into public.guest_registrations(guest_id,promoter_id,event_id,venue_id,marketing_consent,special_occasion,source,group_id,invited_by)
    values (g_id, host.promoter_id, host.event_id, host.venue_id, false, null, host.source, gid, host.id)
    returning * into reg;
  perform public.log_action('guest_registered', null, host.venue_id, host.event_id, host.promoter_id, g_id, 'group invite');
  return json_build_object('ok',true,'registration_id',reg.id,'qr_token',reg.qr_token);
end $$;

create or replace function public.join_crew(
  p_code text, p_first text, p_last text, p_mobile text, p_email text,
  p_dob date default null, p_instagram text default null, p_marketing boolean default false)
returns json
language plpgsql
security definer
set search_path to 'public'
as $$
declare host record; g_id uuid; existing uuid; reg record; members int; v_email text; cut timestamptz;
begin
  select gr.*, e.event_date into host
    from public.guest_registrations gr join public.events e on e.id = gr.event_id
    where gr.crew_code = upper(btrim(p_code));
  if host is null then return json_build_object('ok',false,'error','not_found'); end if;
  if host.status = 'cancelled' then return json_build_object('ok',false,'error','cancelled'); end if;
  if host.event_date < (now() at time zone 'Australia/Brisbane')::date then
    return json_build_object('ok',false,'error','past_event'); end if;
  cut := public.guestlist_cutoff(host.venue_id, host.event_date);
  if cut is not null and now() >= cut then
    return json_build_object('ok',false,'error','guestlist_closed','closes_at',cut); end if;

  if p_first is null or btrim(p_first) = '' or p_mobile is null
     or length(regexp_replace(p_mobile, '\D', '', 'g')) < 8 then
    return json_build_object('ok',false,'error','bad_input'); end if;
  v_email := lower(btrim(coalesce(p_email, '')));
  if v_email = '' then return json_build_object('ok',false,'error','email_required'); end if;
  if not public.guest_email_ok(v_email) then
    return json_build_object('ok',false,'error','invalid_email'); end if;

  select count(*) into members from public.guest_registrations where group_id = host.id;
  if members >= 10 then return json_build_object('ok',false,'error','crew_full'); end if;

  select id into g_id from public.guests
    where mobile = btrim(p_mobile) or email = v_email::citext limit 1;
  if g_id is null then
    insert into public.guests(first_name,last_name,mobile,email,date_of_birth,instagram)
      values (btrim(p_first), coalesce(btrim(p_last), ''), btrim(p_mobile), v_email, p_dob, nullif(btrim(coalesce(p_instagram,'')),''))
      returning id into g_id;
  else
    update public.guests set
        email = case when email is null or email::text = '' then v_email::citext else email end,
        date_of_birth = coalesce(date_of_birth, p_dob),
        instagram = coalesce(nullif(instagram,''), nullif(btrim(coalesce(p_instagram,'')),''))
      where id = g_id;
  end if;

  select id into existing from public.guest_registrations where event_id = host.event_id and guest_id = g_id;
  if existing is not null then return json_build_object('ok',false,'error','duplicate'); end if;

  insert into public.guest_registrations(guest_id,promoter_id,event_id,venue_id,marketing_consent,special_occasion,source,group_id,invited_by)
    values (g_id, host.promoter_id, host.event_id, host.venue_id, coalesce(p_marketing,false), null, host.source, host.id, host.id)
    returning * into reg;
  perform public.log_action('guest_registered', null, host.venue_id, host.event_id, host.promoter_id, g_id, 'crew link');
  return json_build_object('ok',true,'registration_id',reg.id,'qr_token',reg.qr_token);
end $$;
