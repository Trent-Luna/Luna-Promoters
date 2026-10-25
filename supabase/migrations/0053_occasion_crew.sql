-- The crew link for birthday, hens and bucks sign-ups (25 Oct 2026).
--
-- Trent, 23 Oct: "mock up a new landing page for meta for our birthday hens
-- and bucks sign ups"; 25 Oct, of the pieces left out of the first build (the
-- bride / groom's name, the crew size and the personal crew link): "go ahead
-- and build these".
--
-- Additive only. Three nullable columns and four new functions; nothing that
-- exists is changed, so every screen already deployed reads and writes exactly
-- as before.
--
--   honoree_name  the bride or groom, on a hens or bucks sign-up
--   crew_size     how many the host says are coming (the deal is for 5+)
--   crew_code     the host's personal link, /c/<code>. Friends who sign up
--                 through it get their own QR and join the host's group
--                 (group_id / invited_by, the same columns the pass page's
--                 "Bringing friends?" uses since 0042).
--
-- The friends are ordinary guests: no special_occasion, so they get the normal
-- confirmation email, not the birthday deal. The host keeps the deal.

alter table public.guest_registrations add column if not exists honoree_name text;
alter table public.guest_registrations add column if not exists crew_size smallint;
alter table public.guest_registrations add column if not exists crew_code text;
create unique index if not exists guest_registrations_crew_code_key
  on public.guest_registrations(crew_code) where crew_code is not null;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'guest_registrations_crew_size_chk') then
    alter table public.guest_registrations
      add constraint guest_registrations_crew_size_chk check (crew_size is null or crew_size between 1 and 40);
  end if;
end $$;

comment on column public.guest_registrations.honoree_name is 'Hens / bucks: the bride or groom, as the host typed it.';
comment on column public.guest_registrations.crew_size is 'Birthday / hens / bucks: how many the host says are coming.';
comment on column public.guest_registrations.crew_code is 'The host''s crew link, /c/<code>. Friends who sign up through it join the host''s group.';

-- Six characters with no 0/O, 1/I/L: read out over the phone without mistakes.
create or replace function public.new_crew_code()
returns text language plpgsql volatile set search_path to 'public' as $$
declare a text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; c text; i int;
begin
  loop
    c := '';
    for i in 1..6 loop
      c := c || substr(a, 1 + floor(random() * length(a))::int, 1);
    end loop;
    exit when not exists (select 1 from public.guest_registrations where crew_code = c);
  end loop;
  return c;
end $$;
revoke all on function public.new_crew_code() from public, anon, authenticated;

-- ── the host ────────────────────────────────────────────────────────────────
-- Called by the landing page straight after register_guest_vd, and by the pass
-- page's "Get my crew link" for an occasion sign-up made through any other
-- link. The QR token is the proof: only the guest holding it can call this.
-- A null argument leaves that field as it was.
create or replace function public.set_crew_details(p_token text, p_honoree text default null, p_crew_size int default null)
returns json language plpgsql security definer set search_path to 'public' as $$
declare r record; code text;
begin
  select gr.*, e.event_date into r
    from public.guest_registrations gr join public.events e on e.id = gr.event_id
    where gr.qr_token = p_token;
  if r is null then return json_build_object('ok',false,'error','not_found'); end if;
  if coalesce(r.special_occasion,'') not in ('Birthday','Hens party','Bucks party') then
    return json_build_object('ok',false,'error','not_occasion'); end if;
  -- A friend in someone else's crew is not a host.
  if r.group_id is not null and r.group_id <> r.id then
    return json_build_object('ok',false,'error','not_host'); end if;
  if r.status = 'cancelled' then return json_build_object('ok',false,'error','cancelled'); end if;

  code := coalesce(r.crew_code, public.new_crew_code());
  update public.guest_registrations set
      crew_code = code,
      group_id = id,
      honoree_name = coalesce(nullif(left(btrim(coalesce(p_honoree,'')), 40), ''), honoree_name),
      crew_size = coalesce(case when p_crew_size between 1 and 40 then p_crew_size end, crew_size)
    where id = r.id;
  return json_build_object('ok',true,'crew_code',code);
end $$;

-- The pass page: the host's own crew, or null for anyone who is not one.
create or replace function public.get_crew_by_token(p_token text)
returns json language sql stable security definer set search_path to 'public' as $$
  select json_build_object(
    'occasion', gr.special_occasion, 'honoree_name', gr.honoree_name,
    'crew_size', gr.crew_size, 'crew_code', gr.crew_code,
    'joined', (select count(*) from public.guest_registrations m
                where m.group_id = gr.id and m.id <> gr.id and m.status <> 'cancelled')
  )
  from public.guest_registrations gr
  where gr.qr_token = p_token
    and gr.special_occasion in ('Birthday','Hens party','Bucks party')
    and (gr.group_id is null or gr.group_id = gr.id);
$$;

-- ── the friends ─────────────────────────────────────────────────────────────
-- What /c/<code> shows. First names only: the link gets passed around.
create or replace function public.get_crew(p_code text)
returns json language sql stable security definer set search_path to 'public' as $$
  select json_build_object(
    'host_first', g.first_name, 'honoree_name', gr.honoree_name, 'occasion', gr.special_occasion,
    'crew_size', gr.crew_size,
    'venue_id', v.id, 'venue_name', v.name, 'venue_slug', v.slug, 'guestlist_until', v.guestlist_until,
    'event_date', e.event_date, 'start_time', e.start_time,
    'joined', (select count(*) from public.guest_registrations m
                where m.group_id = gr.id and m.id <> gr.id and m.status <> 'cancelled'),
    'state', case
      when gr.status = 'cancelled' then 'cancelled'
      when e.event_date < (now() at time zone 'Australia/Brisbane')::date then 'past'
      when public.guestlist_cutoff(v.id, e.event_date) is not null
           and now() >= public.guestlist_cutoff(v.id, e.event_date) then 'closed'
      else 'open' end
  )
  from public.guest_registrations gr
  join public.guests g on g.id = gr.guest_id
  join public.events e on e.id = gr.event_id
  join public.venues v on v.id = gr.venue_id
  where gr.crew_code = upper(btrim(p_code));
$$;

-- A friend signs up through the host's link: their own QR, on the host's
-- night and venue, in the host's group. The same checks as add_group_guest
-- (email required) plus the nightly cut-off, which a self sign-up must obey.
create or replace function public.join_crew(
  p_code text, p_first text, p_last text, p_mobile text, p_email text,
  p_dob date default null, p_instagram text default null, p_marketing boolean default false)
returns json language plpgsql security definer set search_path to 'public' as $$
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
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[A-Za-z]{2,}$' then
    return json_build_object('ok',false,'error','bad_email'); end if;

  select count(*) into members from public.guest_registrations where group_id = host.id;
  if members >= 40 then return json_build_object('ok',false,'error','crew_full'); end if;

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

grant execute on function public.set_crew_details(text, text, int) to anon, authenticated;
grant execute on function public.get_crew_by_token(text) to anon, authenticated;
grant execute on function public.get_crew(text) to anon, authenticated;
grant execute on function public.join_crew(text, text, text, text, text, date, text, boolean) to anon, authenticated;
