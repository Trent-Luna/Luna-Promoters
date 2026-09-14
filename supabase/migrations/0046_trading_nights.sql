-- 0046_trading_nights.sql
--
-- The nights a venue actually opens its doors.
--
-- Trent, 14 Sep 2026: "theres birthdays going to guestlists on nights were not
-- open" — and then "su casa does not trade tuesday. fix that as well."
--
-- WHY THIS EXISTS. Nothing in this database knew which nights a venue trades.
-- Every path that puts a guest on a list — the promoter link, the CRM lead
-- action, a manual add, the birthday sequence — called ensure_event(venue,
-- date), which cheerfully created an event for any date it was handed. So a
-- guest whose birthday fell on a Tuesday got a confirmation, a QR code, and a
-- closed door. Jasmine's was created automatically on 14 July for Mon 14 Sep.
--
-- The fix belongs HERE and not in a form, because there are four callers and
-- the next one written would have had the same hole. venue_trades() is the one
-- answer, and every entry point now asks it.
--
-- OVERRIDE IS DELIBERATE, not a loophole. Venues do open on odd nights —
-- Melbourne Cup, New Year's Eve, a one-off private hire. Staff pass
-- p_override and the action is logged as overridden. A guest cannot.
--
-- DAY NUMBERS are Postgres `extract(dow)`: 0 Sun, 1 Mon … 6 Sat.
--
-- EVERY VENUE IS TRENT'S OWN WORDS, 14 Sep 2026 — nothing here is inferred from
-- booking history. The first cut of this migration left the four smaller venues
-- permissive rather than guess, and the guess would have been wrong on all four:
-- Pump reads as a Fri/Sat room in the data and trades Wednesdays; Silk reads as
-- Fri/Sat and is one Saturday event. A wrong night here turns away real guests,
-- which is worse than the bug being fixed. Changes from now belong in
-- Admin › Venues, where a manager can make them, not in a migration.

alter table public.venues
  add column if not exists trading_days smallint[] not null default '{0,1,2,3,4,5,6}';

alter table public.venues drop constraint if exists venues_trading_days_valid;
alter table public.venues add constraint venues_trading_days_valid check (
  array_length(trading_days,1) between 1 and 7
  and trading_days <@ array[0,1,2,3,4,5,6]::smallint[]
);

update public.venues set trading_days = '{0,5,6}'     where slug = 'eclipse';            -- Fri, Sat, Sun
update public.venues set trading_days = '{0,3,4,5,6}' where slug = 'su-casa-brisbane';   -- Wed–Sun
update public.venues set trading_days = '{5,6}'       where slug = 'eclipse-afterdark';  -- Fri, Sat
update public.venues set trading_days = '{3,5,6}'     where slug = 'pump-nightclub';     -- Wed, Fri, Sat
-- Silk is a Saturday event on the Ember & Ash rooftop, carried on two venue rows.
update public.venues set trading_days = '{6}'         where name in ('Silk','Silk Saturdays');

-- Does this venue open on this date? Trading day AND not blacked out — a
-- blackout is a one-off closure on a night the venue normally trades, so both
-- questions have to be asked together or each caller asks half of it.
create or replace function public.venue_trades(p_venue uuid, p_date date)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from public.venues v
     where v.id = p_venue
       and extract(dow from p_date)::smallint = any (v.trading_days)
  ) and not exists (
    select 1 from public.blackout_dates b
     where b.blackout_date = p_date
       and (b.venue_id is null or b.venue_id = p_venue)
  );
$$;

-- The next night this venue is open, counting p_from itself. This is what a
-- guest is offered instead of being told "no" — an error with nowhere to go is
-- a lost registration.
create or replace function public.next_trading_night(p_venue uuid, p_from date, p_within int default 21)
returns date language sql stable security definer set search_path to 'public' as $$
  select d::date
    from generate_series(p_from, p_from + least(greatest(p_within,1), 400), interval '1 day') d
   where public.venue_trades(p_venue, d::date)
   order by d limit 1;
$$;

-- Every open night in a window. Feeds the guest-facing birthday picker.
create or replace function public.trading_nights(p_venue uuid, p_from date, p_to date)
returns setof date language sql stable security definer set search_path to 'public' as $$
  select d::date
    from generate_series(p_from, least(p_to, p_from + 400), interval '1 day') d
   where public.venue_trades(p_venue, d::date)
   order by d;
$$;

-- ── the four entry points ───────────────────────────────────────────────────
-- Each gains p_override with a default of false, so every existing caller is
-- unchanged except that it can no longer book a closed night.

drop function if exists public.register_guest_vd(text,uuid,date,text,text,text,text,date,text,boolean,text,text);

create function public.register_guest_vd(
  p_promoter_code text, p_venue uuid, p_date date, p_first text, p_last text,
  p_mobile text, p_email text, p_dob date, p_instagram text, p_marketing boolean,
  p_occasion text default null, p_source text default null, p_override boolean default false)
returns json language plpgsql security definer set search_path to 'public' as $function$
declare prom record; ven record; eid uuid; g_id uuid; existing uuid; reg record; src text;
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

drop function if exists public.add_guest_manual_vd(uuid,date,text,text,text,text,date,text,text,integer,text);

create function public.add_guest_manual_vd(
  p_venue uuid, p_date date, p_first text, p_last text, p_mobile text, p_email text,
  p_dob date, p_instagram text, p_occasion text default null,
  p_plus_ones integer default 0, p_notes text default null, p_override boolean default false)
returns json language plpgsql security definer set search_path to 'public' as $function$
declare ven record; eid uuid; pid uuid; g_id uuid; existing uuid; reg record; extras int;
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
  select id into existing from public.guest_registrations where event_id = eid and guest_id = g_id;
  if existing is not null then return json_build_object('ok',false,'error','duplicate'); end if;

  insert into public.guest_registrations(guest_id,promoter_id,event_id,venue_id,marketing_consent,special_occasion,plus_ones,notes)
    values (g_id, pid, eid, p_venue, false, nullif(p_occasion,''), extras, nullif(p_notes,'')) returning * into reg;
  perform public.log_action('guest_registered', auth.uid(), p_venue, eid, pid, g_id,
    'manual add' || case when extras > 0 then ' +' || extras else '' end
    || case when coalesce(p_override,false) and not public.venue_trades(p_venue,p_date) then ' (non-trading night, overridden)' else '' end);
  return json_build_object('ok',true,'registration_id',reg.id,'plus_ones',extras);
end $function$;

-- Moving a guest to another night, which was simply not possible before: the
-- edit form could change a name and a plus-one but not the one field that was
-- actually wrong on 55 registrations.
drop function if exists public.update_guest_registration(uuid,text,text,text,text,date,text,integer,text,text);

create function public.update_guest_registration(
  p_registration uuid, p_first text, p_last text, p_mobile text, p_email text,
  p_dob date default null, p_instagram text default null, p_plus_ones integer default 0,
  p_notes text default null, p_occasion text default null,
  p_event_date date default null, p_override boolean default false)
returns json language plpgsql security definer set search_path to 'public' as $function$
declare v_reg guest_registrations%rowtype; v_extras int; v_was date; v_event uuid; v_moved boolean := false;
begin
  select * into v_reg from guest_registrations where id = p_registration;
  if v_reg.id is null then return json_build_object('ok',false,'error','not_found'); end if;
  if not public.manages_venue(v_reg.venue_id) then return json_build_object('ok',false,'error','not_authorised'); end if;
  if p_first is null or btrim(p_first) = '' then return json_build_object('ok',false,'error','name_required'); end if;
  if p_mobile is null or btrim(p_mobile) = '' then return json_build_object('ok',false,'error','mobile_required'); end if;

  v_extras := greatest(0, least(coalesce(p_plus_ones,0), 50));
  select event_date into v_was from public.events where id = v_reg.event_id;
  v_event := v_reg.event_id;

  -- Only touched when a date is passed AND it differs, so every existing
  -- caller behaves exactly as it did.
  if p_event_date is not null and p_event_date is distinct from v_was then
    if p_event_date < (current_date - interval '1 day') or p_event_date > (current_date + interval '1 year') then
      return json_build_object('ok',false,'error','bad_date');
    end if;
    if not coalesce(p_override,false) and not public.venue_trades(v_reg.venue_id, p_event_date) then
      return json_build_object('ok',false,'error','not_trading',
        'suggested', public.next_trading_night(v_reg.venue_id, p_event_date));
    end if;
    v_event := public.ensure_event(v_reg.venue_id, p_event_date);
    -- The guest may already be on the destination night; the unique index
    -- would raise, and a raise in a save dialog says nothing useful.
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

-- Who sets the nights. Venue managers, in Settings — not a developer in a
-- migration, which is how this ends up stale again in three months.
create or replace function public.set_venue_trading_days(p_venue uuid, p_days smallint[])
returns json language plpgsql security definer set search_path to 'public' as $function$
begin
  if not public.manages_venue(p_venue) then return json_build_object('ok',false,'error','not_authorised'); end if;
  if p_days is null or array_length(p_days,1) is null then
    return json_build_object('ok',false,'error','pick_at_least_one_night'); end if;
  update public.venues set trading_days = p_days, updated_at = now() where id = p_venue;
  perform public.log_action('venue_trading_days_set', auth.uid(), p_venue, null, null, null,
    array_to_string(p_days, ','));
  return json_build_object('ok', true);
end $function$;

-- trading_days rides along on the promoter link so the guest form can offer
-- only open nights without a second round trip.
create or replace function public.get_promoter_link(p_code text)
returns json language plpgsql stable security definer set search_path to 'public' as $function$
declare prom record; vens json; blk json;
begin
  select full_name, promoter_code into prom
    from public.promoters where promoter_code = p_code and status = 'approved';
  if prom.promoter_code is null then return null; end if;

  select coalesce(json_agg(to_jsonb(x) order by x.name), '[]'::json) into vens
    from (select id, name, trading_days from public.venues where active = true order by name) x;

  select coalesce(json_agg(json_build_object('venue_id', venue_id, 'date', blackout_date)), '[]'::json) into blk
    from public.blackout_dates where blackout_date >= current_date;

  return json_build_object('full_name', prom.full_name, 'promoter_code', prom.promoter_code,
    'venues', vens, 'blackouts', blk);
end $function$;

notify pgrst, 'reload schema';
