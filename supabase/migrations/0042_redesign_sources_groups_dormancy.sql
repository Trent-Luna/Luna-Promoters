-- 0042 · Promoters redesign: source tracking, group sign-up, dormant promoters,
--        booth-offer follow-through, tonight board, daily tier refresh.
-- Applied 2026-09-06.

-- ---------------------------------------------------------------------------
-- 1. Source tracking — a house or promoter link can carry ?src=<key>
-- ---------------------------------------------------------------------------
alter table public.guest_registrations add column if not exists source text;
create index if not exists guest_registrations_source_idx on public.guest_registrations(promoter_id, source);

create table if not exists public.source_links (
  id uuid primary key default gen_random_uuid(),
  promoter_id uuid not null references public.promoters(id) on delete cascade,
  key text not null check (key ~ '^[a-z0-9][a-z0-9-]{0,39}$'),
  label text not null,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (promoter_id, key)
);
alter table public.source_links enable row level security;
drop policy if exists source_links_admin on public.source_links;
create policy source_links_admin on public.source_links
  for all using (public.is_admin(auth.uid()) or promoter_id = public.my_promoter_id(auth.uid()))
  with check (public.is_admin(auth.uid()) or promoter_id = public.my_promoter_id(auth.uid()));

create table if not exists public.source_visits (
  id bigint generated always as identity primary key,
  promoter_id uuid not null references public.promoters(id) on delete cascade,
  key text not null,
  visited_at timestamptz not null default now()
);
create index if not exists source_visits_idx on public.source_visits(promoter_id, key, visited_at);
alter table public.source_visits enable row level security;
-- written by the service role only; readable through get_source_stats

create or replace function public.record_source_visit(p_code text, p_key text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare pid uuid;
begin
  if p_key is null or p_key !~ '^[a-z0-9][a-z0-9-]{0,39}$' then return; end if;
  select id into pid from public.promoters where promoter_code = p_code and status = 'approved';
  if pid is null then return; end if;
  insert into public.source_visits(promoter_id, key) values (pid, p_key);
end $$;

create or replace function public.get_source_stats(p_promoter uuid, p_from date default null)
returns json language sql stable security definer set search_path to 'public' as $$
  with keys as (
    select key, label from public.source_links where promoter_id = p_promoter
    union
    select distinct source, source from public.guest_registrations
      where promoter_id = p_promoter and source is not null
        and source not in (select key from public.source_links where promoter_id = p_promoter)
  ),
  regs as (
    select gr.source, count(*) registered, count(*) filter (where gr.status = 'checked_in') checked_in
    from public.guest_registrations gr join public.events e on e.id = gr.event_id
    where gr.promoter_id = p_promoter and gr.source is not null
      and (p_from is null or e.event_date >= p_from)
    group by gr.source
  ),
  visits as (
    select key, count(*) clicks from public.source_visits
    where promoter_id = p_promoter and (p_from is null or visited_at::date >= p_from)
    group by key
  )
  select coalesce(json_agg(json_build_object(
      'key', k.key, 'label', k.label,
      'clicks', coalesce(v.clicks, 0),
      'registered', coalesce(r.registered, 0),
      'checked_in', coalesce(r.checked_in, 0)
    ) order by coalesce(r.checked_in, 0) desc, coalesce(r.registered, 0) desc, k.label), '[]'::json)
  from keys k left join regs r on r.source = k.key left join visits v on v.key = k.key;
$$;

-- register_guest_vd learns p_source. The old 11-argument overload must go first or
-- every call that omits p_source becomes ambiguous.
drop function if exists public.register_guest_vd(text, uuid, date, text, text, text, text, date, text, boolean, text);
create or replace function public.register_guest_vd(
  p_promoter_code text, p_venue uuid, p_date date, p_first text, p_last text, p_mobile text,
  p_email text, p_dob date, p_instagram text, p_marketing boolean,
  p_occasion text default null, p_source text default null)
returns json language plpgsql security definer set search_path to 'public' as $$
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
end $$;

-- ---------------------------------------------------------------------------
-- 2. Group sign-up — a guest adds friends from their pass; each gets a QR
-- ---------------------------------------------------------------------------
alter table public.guest_registrations add column if not exists group_id uuid;
alter table public.guest_registrations add column if not exists invited_by uuid references public.guest_registrations(id) on delete set null;
create index if not exists guest_registrations_group_idx on public.guest_registrations(group_id);

create or replace function public.add_group_guest(
  p_token text, p_first text, p_last text, p_mobile text, p_email text default null)
returns json language plpgsql security definer set search_path to 'public' as $$
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

create or replace function public.get_group_members(p_token text)
returns json language sql stable security definer set search_path to 'public' as $$
  with me as (select id, group_id from public.guest_registrations where qr_token = p_token)
  select coalesce(json_agg(json_build_object(
      'id', gr.id, 'first_name', g.first_name, 'last_name', g.last_name,
      'status', gr.status, 'qr_token', gr.qr_token, 'is_host', gr.id = gr.group_id,
      'is_me', gr.id = me.id
    ) order by gr.created_at), '[]'::json)
  from me
  join public.guest_registrations gr on gr.group_id = coalesce(me.group_id, me.id) and me.group_id is not null
  join public.guests g on g.id = gr.guest_id;
$$;

-- ---------------------------------------------------------------------------
-- 3. Dormant promoters + daily tier refresh
-- ---------------------------------------------------------------------------
alter table public.app_settings add column if not exists dormant_weeks int not null default 8;
alter table public.promoters add column if not exists last_registration_at timestamptz;
alter table public.promoters add column if not exists dormant_since timestamptz;
alter table public.promoters add column if not exists nudged_at timestamptz;

-- backfill last_registration_at from history
update public.promoters p set last_registration_at = x.last
from (select promoter_id, max(created_at) last from public.guest_registrations group by promoter_id) x
where x.promoter_id = p.id and p.last_registration_at is null;

create or replace function public.trg_promoter_activity()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  update public.promoters
     set last_registration_at = greatest(coalesce(last_registration_at, new.created_at), new.created_at),
         dormant_since = null
   where id = new.promoter_id;
  return new;
end $$;
drop trigger if exists trg_promoter_activity on public.guest_registrations;
create trigger trg_promoter_activity after insert on public.guest_registrations
  for each row execute function public.trg_promoter_activity();

create or replace function public.mark_dormant_promoters()
returns int language plpgsql security definer set search_path to 'public' as $$
declare wk int; n int;
begin
  select dormant_weeks into wk from public.app_settings where id = 1;
  wk := coalesce(wk, 8);
  update public.promoters
     set dormant_since = now()
   where status = 'approved' and is_staff = false and is_house = false and dormant_since is null
     and coalesce(last_registration_at, approved_at, created_at) < now() - (wk || ' weeks')::interval;
  get diagnostics n = row_count;
  -- clear anyone who has since registered a guest (belt and braces with the trigger)
  update public.promoters set dormant_since = null
   where dormant_since is not null and last_registration_at >= now() - (wk || ' weeks')::interval;
  return n;
end $$;

create or replace function public.refresh_all_promoter_tiers()
returns void language plpgsql security definer set search_path to 'public' as $$
declare r record; m date := date_trunc('month', (now() at time zone 'Australia/Brisbane'))::date;
begin
  for r in select id from public.promoters where status = 'approved' loop
    perform public.refresh_promoter_month(r.id, m);
  end loop;
end $$;

select cron.unschedule(jobid) from cron.job where jobname in ('promoter-tiers-daily','promoter-dormancy-daily');
select cron.schedule('promoter-tiers-daily', '10 14 * * *', $$select public.refresh_all_promoter_tiers();$$);   -- 00:10 Brisbane
select cron.schedule('promoter-dormancy-daily', '20 14 * * *', $$select public.mark_dormant_promoters();$$); -- 00:20 Brisbane

-- ---------------------------------------------------------------------------
-- 4. Booth-offer follow-through
-- ---------------------------------------------------------------------------
alter table public.guest_registrations add column if not exists booth_offer_sent_at timestamptz;

-- ---------------------------------------------------------------------------
-- 5. Tonight board for the admin overview (one row per active venue)
-- ---------------------------------------------------------------------------
create or replace function public.get_tonight_board(p_date date default null)
returns json language sql stable security definer set search_path to 'public' as $$
  with d as (select coalesce(p_date, (now() at time zone 'Australia/Brisbane')::date) as day),
  ev as (
    select distinct on (e.venue_id) e.id, e.venue_id, e.guestlist_open, e.name
    from public.events e, d where e.event_date = d.day and e.active order by e.venue_id, e.created_at
  ),
  regs as (
    select gr.venue_id,
      sum(1 + coalesce(gr.plus_ones,0)) filter (where gr.status <> 'cancelled') registered,
      sum(1 + coalesce(gr.plus_ones,0)) filter (where gr.status = 'checked_in') checked_in,
      count(*) filter (where gr.status = 'no_entry') no_entry
    from public.guest_registrations gr join public.events e on e.id = gr.event_id, d
    where e.event_date = d.day group by gr.venue_id
  )
  select json_build_object('date', (select day from d), 'venues', coalesce(json_agg(json_build_object(
      'venue_id', v.id, 'venue_name', v.name, 'event_id', ev.id, 'event_name', ev.name,
      'guestlist_open', coalesce(ev.guestlist_open, false),
      'registered', coalesce(r.registered, 0), 'checked_in', coalesce(r.checked_in, 0), 'no_entry', coalesce(r.no_entry, 0)
    ) order by coalesce(r.registered,0) desc, v.name), '[]'::json))
  from public.venues v left join ev on ev.venue_id = v.id left join regs r on r.venue_id = v.id
  where v.active;
$$;

-- admin overview stats: month-to-date rather than all-time, plus dormant count
create or replace function public.get_admin_stats(p_venue uuid default null)
returns json language sql stable security definer set search_path to 'public' as $$
  with m as (select date_trunc('month', (now() at time zone 'Australia/Brisbane'))::date as start)
  select json_build_object(
    'total_promoters',     (select count(*) from public.promoters where is_staff = false),
    'pending_promoters',   (select count(*) from public.promoters where status='pending'),
    'active_promoters',    (select count(*) from public.promoters where status='approved' and is_staff = false and dormant_since is null),
    'dormant_promoters',   (select count(*) from public.promoters where status='approved' and dormant_since is not null),
    'suspended_promoters', (select count(*) from public.promoters where status='suspended'),
    'total_registered',    (select count(*) from public.guest_registrations gr where p_venue is null or gr.venue_id=p_venue),
    'total_checked_in',    (select count(*) from public.guest_registrations gr where gr.status='checked_in' and (p_venue is null or gr.venue_id=p_venue)),
    'month_registered',    (select count(*) from public.guest_registrations gr join public.events e on e.id=gr.event_id, m where e.event_date >= m.start and (p_venue is null or gr.venue_id=p_venue)),
    'month_checked_in',    (select count(*) from public.guest_registrations gr join public.events e on e.id=gr.event_id, m where gr.status='checked_in' and e.event_date >= m.start and (p_venue is null or gr.venue_id=p_venue))
  );
$$;

-- pass page needs the group + venue slug for the booth link
create or replace function public.get_registration_by_token(p_token text)
returns json language sql stable security definer set search_path to 'public' as $$
  select json_build_object(
    'id', gr.id, 'status', gr.status, 'qr_token', gr.qr_token,
    'first_name', g.first_name, 'last_name', g.last_name,
    'event_name', e.name, 'event_date', e.event_date,
    'start_time', e.start_time, 'end_time', e.end_time,
    'venue_name', v.name, 'venue_slug', v.slug, 'promoter_name', p.full_name, 'promoter_code', p.promoter_code,
    'special_occasion', gr.special_occasion, 'group_id', gr.group_id, 'source', gr.source
  )
  from public.guest_registrations gr
  join public.guests g on g.id = gr.guest_id
  join public.events e on e.id = gr.event_id
  join public.venues v on v.id = gr.venue_id
  join public.promoters p on p.id = gr.promoter_id
  where gr.qr_token = p_token;
$$;

grant execute on function public.record_source_visit(text, text) to service_role;
grant execute on function public.get_source_stats(uuid, date) to authenticated;
grant execute on function public.add_group_guest(text, text, text, text, text) to anon, authenticated;
grant execute on function public.get_group_members(text) to anon, authenticated;
grant execute on function public.get_tonight_board(date) to authenticated;
grant execute on function public.mark_dormant_promoters() to authenticated;
grant execute on function public.register_guest_vd(text, uuid, date, text, text, text, text, date, text, boolean, text, text) to anon, authenticated;
