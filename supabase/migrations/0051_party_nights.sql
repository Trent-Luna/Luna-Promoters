-- 0051_party_nights.sql
--
-- Party nights: a one-off event with its own look, where a guest registers
-- themselves and brings up to N friends on the same QR.
--
-- Trent, 14 Oct 2026: "can you setup a qr code in our sign ups and qr codes to
-- register their name and up to plus 4 for our upcoming su casa 10k instagram
-- followers party". First one: Su Casa 10K Party, Fri 13 Nov 2026 from 6pm,
-- no cap.
--
-- Nothing changes for an ordinary night. A night is a party night only when
-- its events row has `party` set; max_plus_ones defaults to 0, so the public
-- form keeps refusing plus-ones everywhere else exactly as it did before.
--
--   events.max_plus_ones       how many friends one registration may bring
--   events.party               the look and words: kicker, tagline, lede,
--                              included, sms (texts on/off — off until the
--                              wording is approved)
--   guest_registrations.party_names     friends' first names, optional
--   guest_registrations.reminder_sent_at the day-of text, once
--   check_ins.admitted         heads let in so far when a group arrives in
--                              parts; null = the whole party

alter table public.events
  add column if not exists max_plus_ones int not null default 0,
  add column if not exists party jsonb;
do $$ begin
  alter table public.events add constraint events_max_plus_ones_range check (max_plus_ones between 0 and 10);
exception when duplicate_object then null; end $$;

alter table public.guest_registrations
  add column if not exists party_names text[],
  add column if not exists reminder_sent_at timestamptz;

alter table public.check_ins
  add column if not exists admitted int;

-- ── The guest form asks this for a locked venue + date ──────────────────────
create or replace function public.get_party_night(p_venue uuid, p_date date)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'event_id', e.id, 'name', e.name, 'event_date', e.event_date,
    'start_time', e.start_time, 'end_time', e.end_time,
    'max_plus_ones', e.max_plus_ones, 'party', e.party,
    'venue_slug', v.slug, 'venue_name', v.name)
  from public.events e
  join public.venues v on v.id = e.venue_id
  where e.venue_id = p_venue and e.event_date = p_date
    and e.active and e.party is not null
  order by e.created_at
  limit 1;
$$;
grant execute on function public.get_party_night(uuid, date) to anon, authenticated, service_role;

-- ── Registering for a party night ───────────────────────────────────────────
-- A wrapper, not a change to register_guest_vd: every check (promoter, venue,
-- trading night, cut-off, duplicate) stays in the one function every other
-- form already calls, and that function's signature does not move. This only
-- adds the friends once the registration exists.
create or replace function public.register_guest_party(
  p_promoter_code text, p_venue uuid, p_date date, p_first text, p_last text,
  p_mobile text, p_email text, p_dob date, p_instagram text, p_marketing boolean,
  p_occasion text default null, p_source text default null,
  p_plus_ones int default 0, p_party_names text[] default null)
returns json
language plpgsql
security definer
set search_path = public
as $function$
declare r jsonb; rid uuid; allowed int; extras int; names text[];
begin
  r := public.register_guest_vd(p_promoter_code, p_venue, p_date, p_first, p_last, p_mobile, p_email,
         p_dob, p_instagram, p_marketing, p_occasion, p_source, false)::jsonb;
  if coalesce((r->>'ok')::boolean, false) is not true then return r::json; end if;
  rid := (r->>'registration_id')::uuid;

  -- Plus-ones only where the night allows them, and never more than it allows.
  -- A hand-built request for +40 on an ordinary Saturday gets +0.
  select coalesce(e.max_plus_ones, 0) into allowed
    from public.guest_registrations gr join public.events e on e.id = gr.event_id where gr.id = rid;
  extras := greatest(0, least(coalesce(p_plus_ones, 0), coalesce(allowed, 0)));
  if extras > 0 and p_party_names is not null then
    select array_agg(left(btrim(n), 40)) into names
      from (select n from unnest(p_party_names) as n where btrim(coalesce(n,'')) <> '' limit extras) s;
  end if;
  update public.guest_registrations set plus_ones = extras, party_names = names where id = rid;
  return (r || jsonb_build_object('plus_ones', extras))::json;
end $function$;
grant execute on function public.register_guest_party(text,uuid,date,text,text,text,text,date,text,boolean,text,text,int,text[]) to anon, authenticated, service_role;

-- ── The pass reads the party and the group ──────────────────────────────────
create or replace function public.get_registration_by_token(p_token text)
returns json
language sql
stable
security definer
set search_path = public
as $function$
  select json_build_object(
    'id', gr.id, 'status', gr.status, 'qr_token', gr.qr_token,
    'first_name', g.first_name, 'last_name', g.last_name,
    'event_name', e.name, 'event_date', e.event_date,
    'start_time', e.start_time, 'end_time', e.end_time,
    'venue_name', v.name, 'venue_slug', v.slug, 'promoter_name', p.full_name, 'promoter_code', p.promoter_code,
    'special_occasion', gr.special_occasion, 'group_id', gr.group_id, 'source', gr.source,
    'guestlist_until', v.guestlist_until, 'guestlist_closes_at', public.guestlist_cutoff(gr.venue_id, e.event_date),
    'plus_ones', gr.plus_ones, 'party_names', gr.party_names, 'party', e.party
  )
  from public.guest_registrations gr
  join public.guests g on g.id = gr.guest_id
  join public.events e on e.id = gr.event_id
  join public.venues v on v.id = gr.venue_id
  join public.promoters p on p.id = gr.promoter_id
  where gr.qr_token = p_token;
$function$;

-- ── The door: the group, and letting it in in parts ─────────────────────────
-- Same signature and behaviour; the answers now carry the party so the scan
-- screen can say "+3 · Mia, Sam, Priya", and a re-scan of a group that came
-- in parts can offer to admit the rest.
create or replace function public.door_check_in(p_registration uuid, p_no_entry boolean DEFAULT false, p_notes text DEFAULT NULL::text, p_method text DEFAULT 'manual'::text, p_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare reg record; already boolean; cut timestamptz; tapped timestamptz; adm int;
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
    select admitted into adm from public.check_ins where registration_id = p_registration order by checked_in_at limit 1;
    return json_build_object('ok',false,'error','already_checked_in','guest_name',reg.guest_name,
      'checked_in_at',(select checked_in_at from public.check_ins where registration_id = p_registration order by checked_in_at limit 1),
      'registration_id', reg.id, 'party', 1 + coalesce(reg.plus_ones,0), 'admitted', coalesce(adm, 1 + coalesce(reg.plus_ones,0)),
      'party_names', reg.party_names);
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
    'registration_id', reg.id, 'party', 1 + coalesce(reg.plus_ones,0), 'party_names', reg.party_names);
end $function$;

-- How many of a checked-in group are inside. Anything at or above the party
-- size (or null) means all of them.
create or replace function public.door_set_admitted(p_registration uuid, p_admitted int)
returns json
language plpgsql
security definer
set search_path = public
as $function$
declare reg record; party int; val int;
begin
  select gr.id, gr.venue_id, gr.event_id, gr.promoter_id, gr.guest_id, gr.plus_ones into reg
    from public.guest_registrations gr where gr.id = p_registration;
  if reg is null then return json_build_object('ok',false,'error','registration_not_found'); end if;
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
grant execute on function public.door_set_admitted(uuid, int) to authenticated, service_role;
revoke execute on function public.door_set_admitted(uuid, int) from anon, public;
