-- 0057 — Off Campus Thursdays at Su Casa Brisbane.
--
-- A weekly uni night: students register their university and their club or
-- society, get a season pass, and every pass scanned by Su Casa door staff
-- during a club night counts once for their club. Weekly, monthly and
-- 12-week season boards are calculated from those arrivals, never stored.
--
-- What protects the count:
--   * only a signed-in Su Casa reception, Su Casa manager or admin can record
--     an arrival, and only inside an open club night's door window;
--   * one live arrival per member per night (a unique index, so two iPads
--     scanning at once still make one row);
--   * the university and club are copied onto the arrival at scan time, so a
--     later club change never rewrites a week that has been scored;
--   * corrections are admin only, need a reason, and are never deletes;
--   * prizes freeze the standings they were based on and move through
--     recorded steps. Nothing here sends a message.
--
-- Everything is switched off until an admin turns it on
-- (offcampus_settings.enabled). Additive only: no existing table, row or
-- function is changed. Rollback block at the bottom.

-- ── Settings ───────────────────────────────────────────────────────────────

create table if not exists public.offcampus_settings (
  id                 int primary key default 1 check (id = 1),
  enabled            boolean not null default false,  -- sign-up, passes and door scans
  public_board       boolean not null default false,  -- results on the What's On page
  show_prizes        boolean not null default false,  -- prize block on the What's On page
  prizes_on          boolean not null default false,  -- prize workflow in admin
  venue_id           uuid not null references public.venues(id),
  winner_level       text check (winner_level in ('university','team')),
  tie_rule           text check (tie_rule in ('shared','first_to_total','most_weekly_wins','admin')),
  rules_version      text,
  rules_approved_by  uuid,
  rules_approved_at  timestamptz,
  two_admin_approval boolean not null default true,
  min_public_count   int not null default 3 check (min_public_count between 1 and 20),
  privacy_version    text not null default 'oc-privacy-2026-11-09',
  booth_url          text,
  whatsapp_url       text,
  instagram_url      text,
  updated_by         uuid,
  updated_at         timestamptz not null default now()
);

insert into public.offcampus_settings (id, venue_id, whatsapp_url)
select 1, v.id, v.whatsapp_channel_url
from public.venues v where v.slug = 'su-casa-brisbane'
on conflict (id) do nothing;

-- ── Clubs and societies ────────────────────────────────────────────────────

-- The cleaned key two names are compared on: "UQ Netball Club" and
-- "uq  netball club!" are the same club.
create or replace function public.offcampus_name_key(p text)
returns text language sql immutable as $$
  select nullif(btrim(regexp_replace(lower(replace(coalesce(p, ''), '&', ' and ')), '[^a-z0-9]+', ' ', 'g')), '')
$$;

-- The name as shown: trimmed, single spaces, at most 60 characters.
create or replace function public.offcampus_clean_name(p text)
returns text language sql immutable as $$
  select nullif(left(btrim(regexp_replace(coalesce(p, ''), '\s+', ' ', 'g')), 60), '')
$$;

create table if not exists public.offcampus_teams (
  id            uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities(id),
  name          text not null,
  name_key      text generated always as (public.offcampus_name_key(name)) stored,
  status        text not null default 'active' check (status in ('active','retired','merged')),
  merged_into   uuid references public.offcampus_teams(id),
  is_test       boolean not null default false,
  created_by    uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index if not exists offcampus_teams_uni_key on public.offcampus_teams (university_id, name_key);

-- ── Members ────────────────────────────────────────────────────────────────

create table if not exists public.offcampus_members (
  id                   uuid primary key default gen_random_uuid(),
  contact_id           uuid not null unique references public.contacts(id),
  full_name            text not null,
  pass_token           text not null unique default replace(gen_random_uuid()::text, '-', ''),
  age_ack_at           timestamptz not null,
  privacy_version      text not null,
  marketing_consent    boolean not null default false,
  marketing_consent_at timestamptz,
  status               text not null default 'active' check (status in ('active','suspended')),
  suspended_reason     text,
  is_test              boolean not null default false,
  source               text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table if not exists public.offcampus_team_requests (
  id                  uuid primary key default gen_random_uuid(),
  university_id       uuid not null references public.universities(id),
  name                text not null,
  name_key            text generated always as (public.offcampus_name_key(name)) stored,
  requested_by        uuid references public.offcampus_members(id),
  organiser_requested boolean not null default false,
  status              text not null default 'pending' check (status in ('pending','approved','rejected')),
  team_id             uuid references public.offcampus_teams(id),
  decided_by          uuid,
  decided_at          timestamptz,
  note                text,
  created_at          timestamptz not null default now()
);
create unique index if not exists offcampus_team_requests_pending
  on public.offcampus_team_requests (university_id, name_key) where status = 'pending';

-- Which university and club a member belongs to, from when to when. Exactly
-- one current row (valid_to is null) per member. A change closes the current
-- row and adds a new one; nothing is overwritten.
create table if not exists public.offcampus_affiliations (
  id            uuid primary key default gen_random_uuid(),
  member_id     uuid not null references public.offcampus_members(id),
  university_id uuid not null references public.universities(id),
  team_id       uuid references public.offcampus_teams(id),
  request_id    uuid references public.offcampus_team_requests(id),
  valid_from    timestamptz not null default now(),
  valid_to      timestamptz,
  changed_by    uuid,
  reason        text
);
create unique index if not exists offcampus_affiliations_current
  on public.offcampus_affiliations (member_id) where valid_to is null;

create table if not exists public.offcampus_organisers (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references public.offcampus_members(id),
  team_id     uuid not null references public.offcampus_teams(id),
  status      text not null default 'requested' check (status in ('requested','approved','revoked')),
  decided_by  uuid,
  decided_at  timestamptz,
  note        text,
  created_at  timestamptz not null default now(),
  unique (member_id, team_id)
);

-- ── Seasons and nights ─────────────────────────────────────────────────────

create table if not exists public.offcampus_seasons (
  id          uuid primary key default gen_random_uuid(),
  number      int not null unique,
  name        text not null,
  first_night date not null check (extract(isodow from first_night) = 4),
  weeks       int not null default 12 check (weeks between 1 and 26),
  status      text not null default 'active' check (status in ('planned','active','closed')),
  created_by  uuid,
  created_at  timestamptz not null default now()
);

create table if not exists public.offcampus_nights (
  id          uuid primary key default gen_random_uuid(),
  season_id   uuid references public.offcampus_seasons(id),
  week_no     int,
  night_date  date not null unique,
  event_id    uuid references public.events(id),
  opens_at    timestamptz not null,
  closes_at   timestamptz not null,
  skipped     boolean not null default false,
  rooftop_note text,
  club_note    text,
  lineup       text,
  perk_note    text,
  created_at  timestamptz not null default now(),
  check (closes_at > opens_at),
  check (closes_at - opens_at <= interval '16 hours')
);

-- Door windows must never overlap, or one scan could belong to two nights.
create or replace function public.offcampus_tg_night_overlap()
returns trigger language plpgsql as $$
begin
  if exists (
    select 1 from public.offcampus_nights n
    where n.id <> new.id
      and tstzrange(n.opens_at, n.closes_at) && tstzrange(new.opens_at, new.closes_at)
  ) then
    raise exception 'offcampus: door window overlaps another night';
  end if;
  return new;
end $$;
drop trigger if exists offcampus_night_overlap on public.offcampus_nights;
create trigger offcampus_night_overlap before insert or update of opens_at, closes_at
  on public.offcampus_nights for each row execute function public.offcampus_tg_night_overlap();

create or replace function public.offcampus_tg_season_overlap()
returns trigger language plpgsql as $$
begin
  if exists (
    select 1 from public.offcampus_seasons s
    where s.id <> new.id
      and daterange(s.first_night, s.first_night + 7 * s.weeks)
       && daterange(new.first_night, new.first_night + 7 * new.weeks)
  ) then
    raise exception 'offcampus: season overlaps another season';
  end if;
  return new;
end $$;
drop trigger if exists offcampus_season_overlap on public.offcampus_seasons;
create trigger offcampus_season_overlap before insert or update of first_night, weeks
  on public.offcampus_seasons for each row execute function public.offcampus_tg_season_overlap();

-- ── Arrivals, corrections, flags ───────────────────────────────────────────

create table if not exists public.offcampus_arrivals (
  id            uuid primary key default gen_random_uuid(),
  member_id     uuid not null references public.offcampus_members(id),
  night_id      uuid not null references public.offcampus_nights(id),
  university_id uuid not null references public.universities(id),
  team_id       uuid references public.offcampus_teams(id),
  request_id    uuid references public.offcampus_team_requests(id),
  scanned_by    uuid,
  scanned_at    timestamptz not null default now(),
  method        text not null default 'scan' check (method in ('scan','manual')),
  device        text,
  voided_at     timestamptz,
  voided_by     uuid,
  void_reason   text
);
create unique index if not exists offcampus_arrivals_once
  on public.offcampus_arrivals (member_id, night_id) where voided_at is null;
create index if not exists offcampus_arrivals_night on public.offcampus_arrivals (night_id) where voided_at is null;

create table if not exists public.offcampus_adjustments (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null check (kind in ('void','manual_add','reattribute','team_change','suspend','unsuspend','team_approved')),
  arrival_id uuid references public.offcampus_arrivals(id),
  member_id  uuid references public.offcampus_members(id),
  before     jsonb,
  after      jsonb,
  reason     text not null check (btrim(reason) <> ''),
  done_by    uuid,
  done_at    timestamptz not null default now()
);

create table if not exists public.offcampus_flags (
  id          uuid primary key default gen_random_uuid(),
  night_id    uuid references public.offcampus_nights(id),
  kind        text not null,
  arrival_id  uuid references public.offcampus_arrivals(id),
  member_id   uuid references public.offcampus_members(id),
  team_id     uuid references public.offcampus_teams(id),
  detail      jsonb,
  status      text not null default 'open' check (status in ('open','cleared')),
  cleared_by  uuid,
  cleared_at  timestamptz,
  clear_note  text,
  created_at  timestamptz not null default now()
);

-- ── Prizes and the audit trail ─────────────────────────────────────────────

create table if not exists public.offcampus_prizes (
  id                  uuid primary key default gen_random_uuid(),
  kind                text not null check (kind in ('weekly_booth','season')),
  night_id            uuid references public.offcampus_nights(id),
  season_id           uuid references public.offcampus_seasons(id),
  level               text not null check (level in ('university','team')),
  winners             jsonb not null,           -- [{key, name, uni, n}]
  standings           jsonb not null,           -- frozen copy at proposal
  tie                 jsonb,                    -- how a tie was settled, if there was one
  recipient_member_id uuid references public.offcampus_members(id),
  status              text not null default 'proposed'
                      check (status in ('needs_decision','proposed','verified','approved','redeemed','cancelled')),
  flagged             boolean not null default false,
  flag_note           text,
  proposed_by uuid, proposed_at timestamptz not null default now(),
  verified_by uuid, verified_at timestamptz,
  approved_by uuid, approved_at timestamptz,
  redeemed_by uuid, redeemed_at timestamptz,
  cancelled_by uuid, cancelled_at timestamptz,
  note        text,
  check ((kind = 'weekly_booth' and night_id is not null) or (kind = 'season' and season_id is not null))
);
create unique index if not exists offcampus_prizes_one_weekly
  on public.offcampus_prizes (night_id) where kind = 'weekly_booth' and status <> 'cancelled';
create unique index if not exists offcampus_prizes_one_season
  on public.offcampus_prizes (season_id) where kind = 'season' and status <> 'cancelled';

create table if not exists public.offcampus_audit (
  id        uuid primary key default gen_random_uuid(),
  action    text not null,
  actor     uuid,
  target_id uuid,
  detail    jsonb,
  at        timestamptz not null default now()
);

-- ── Access: no direct writes, admin reads ──────────────────────────────────

do $$
declare t text;
begin
  foreach t in array array['offcampus_settings','offcampus_teams','offcampus_members','offcampus_team_requests',
    'offcampus_affiliations','offcampus_organisers','offcampus_seasons','offcampus_nights','offcampus_arrivals',
    'offcampus_adjustments','offcampus_flags','offcampus_prizes','offcampus_audit']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_read', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_admin())', t || '_admin_read', t);
  end loop;
end $$;

-- Su Casa managers and reception can see the season plan.
create policy offcampus_nights_door_read on public.offcampus_nights for select to authenticated
  using (public.manages_venue((select venue_id from public.offcampus_settings where id = 1)));
create policy offcampus_seasons_door_read on public.offcampus_seasons for select to authenticated
  using (public.manages_venue((select venue_id from public.offcampus_settings where id = 1)));

-- ── Internal helpers (not callable from the browser) ───────────────────────

create or replace function public.offcampus__settings()
returns public.offcampus_settings language sql stable security definer set search_path = public as $$
  select * from public.offcampus_settings where id = 1
$$;

create or replace function public.offcampus__is_door(uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select uid is not null and (public.is_admin(uid)
    or public.manages_venue((select venue_id from public.offcampus_settings where id = 1), uid))
$$;

create or replace function public.offcampus__audit(p_action text, p_target uuid, p_detail jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.offcampus_audit(action, actor, target_id, detail) values (p_action, auth.uid(), p_target, p_detail)
$$;

-- A prize whose nights change after it was proposed is flagged, never quietly
-- re-decided.
create or replace function public.offcampus__flag_prizes(p_night uuid, p_why text)
returns void language sql security definer set search_path = public as $$
  update public.offcampus_prizes p
     set flagged = true, flag_note = p_why
   where p.status not in ('cancelled','redeemed')
     and (p.night_id = p_night
          or p.season_id = (select season_id from public.offcampus_nights where id = p_night))
$$;

-- Standings for a set of nights. Team level leaves out arrivals whose club is
-- still awaiting approval (they count for their university only).
create or replace function public.offcampus__standings(p_nights uuid[], p_level text, p_include_test boolean default false)
returns table(key uuid, name text, uni text, n bigint, reached_at timestamptz)
language sql stable security definer set search_path = public as $$
  select x.key, x.name, x.uni, x.n, x.reached_at from (
    select t.id as key, t.name, u.short_name as uni, count(*) as n, max(a.scanned_at) as reached_at
    from public.offcampus_arrivals a
    join public.offcampus_teams t on t.id = a.team_id
    join public.universities u on u.id = a.university_id
    join public.offcampus_members m on m.id = a.member_id
    where p_level = 'team' and a.night_id = any(p_nights) and a.voided_at is null
      and (p_include_test or (not t.is_test and not m.is_test))
    group by t.id, t.name, u.short_name
    union all
    select u.id, coalesce(u.short_name, u.name), null, count(*), max(a.scanned_at)
    from public.offcampus_arrivals a
    join public.universities u on u.id = a.university_id
    join public.offcampus_members m on m.id = a.member_id
    where p_level = 'university' and a.night_id = any(p_nights) and a.voided_at is null
      and (p_include_test or not m.is_test)
    group by u.id, u.short_name, u.name
  ) x
  order by x.n desc, x.name
$$;

-- The nights a period covers, ending at a reference night.
create or replace function public.offcampus__period_nights(p_ref uuid, p_period text)
returns uuid[] language sql stable security definer set search_path = public as $$
  with r as (select * from public.offcampus_nights where id = p_ref)
  select coalesce(array_agg(n.id order by n.night_date), '{}')
  from public.offcampus_nights n, r
  where not n.skipped and n.night_date <= r.night_date and (
       (p_period = 'week'   and n.id = r.id)
    or (p_period = 'month'  and date_trunc('month', n.night_date) = date_trunc('month', r.night_date))
    or (p_period = 'season' and r.season_id is not null and n.season_id = r.season_id))
$$;

create or replace function public.offcampus__night_json(n public.offcampus_nights)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', n.id, 'date', n.night_date, 'week_no', n.week_no,
    'opens_at', n.opens_at, 'closes_at', n.closes_at,
    'season', (select jsonb_build_object('id', s.id, 'number', s.number, 'name', s.name, 'weeks', s.weeks)
               from public.offcampus_seasons s where s.id = n.season_id),
    'rooftop_note', n.rooftop_note, 'club_note', n.club_note, 'lineup', n.lineup, 'perk_note', n.perk_note)
$$;

-- ── Public: What's On page, sign-up, pass ──────────────────────────────────

-- Everything the public pages need in one call. Says only "closed" while the
-- feature is off.
create or replace function public.offcampus_public_info()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare s public.offcampus_settings := public.offcampus__settings(); v_next public.offcampus_nights;
begin
  if s.id is null or not s.enabled then return jsonb_build_object('ok', false, 'error', 'closed'); end if;
  select * into v_next from public.offcampus_nights
   where not skipped and closes_at > now() order by opens_at limit 1;
  return jsonb_build_object(
    'ok', true,
    'public_board', s.public_board,
    'show_prizes', s.show_prizes,
    'privacy_version', s.privacy_version,
    'tie_rule', case when s.rules_approved_at is not null then s.tie_rule end,
    'winner_level', case when s.rules_approved_at is not null then s.winner_level end,
    'links', jsonb_build_object('booth', s.booth_url, 'whatsapp', s.whatsapp_url, 'instagram', s.instagram_url),
    'next_night', case when v_next.id is null then null else public.offcampus__night_json(v_next) end,
    'universities', coalesce((
      select jsonb_agg(jsonb_build_object('id', u.id, 'name', u.name, 'short', u.short_name,
        'teams', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name) order by t.name)
                            from public.offcampus_teams t
                            where t.university_id = u.id and t.status = 'active' and not t.is_test), '[]'))
        order by u.sort_order, u.name)
      from public.universities u
      where u.is_active and 'brisbane' = any(u.regions)), '[]'));
end $$;

create or replace function public.offcampus_register(
  p_full_name text, p_email text, p_mobile text,
  p_university uuid, p_team uuid default null, p_new_team text default null,
  p_organiser boolean default false, p_age_ack boolean default false,
  p_privacy boolean default false, p_marketing boolean default false,
  p_source text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s public.offcampus_settings := public.offcampus__settings();
  v_name text := public.offcampus_clean_name(p_full_name);
  v_email text := lower(nullif(btrim(coalesce(p_email, '')), ''));
  v_mobile text := nullif(regexp_replace(coalesce(p_mobile, ''), '[^0-9]', '', 'g'), '');
  v_new text := public.offcampus_clean_name(p_new_team);
  v_contact public.contacts;
  v_member public.offcampus_members;
  v_team public.offcampus_teams;
  v_req public.offcampus_team_requests;
begin
  if s.id is null or not s.enabled then return jsonb_build_object('ok', false, 'error', 'closed'); end if;
  if v_name is null or length(v_name) < 2 or v_email is null or v_mobile is null then
    return jsonb_build_object('ok', false, 'error', 'missing_fields');
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then return jsonb_build_object('ok', false, 'error', 'bad_email'); end if;
  if length(v_mobile) not between 8 and 15 then return jsonb_build_object('ok', false, 'error', 'bad_mobile'); end if;
  if not coalesce(p_age_ack, false) then return jsonb_build_object('ok', false, 'error', 'age_required'); end if;
  if not coalesce(p_privacy, false) then return jsonb_build_object('ok', false, 'error', 'privacy_required'); end if;
  if not exists (select 1 from public.universities u where u.id = p_university and u.is_active and 'brisbane' = any(u.regions)) then
    return jsonb_build_object('ok', false, 'error', 'bad_university');
  end if;
  if p_team is not null then
    select * into v_team from public.offcampus_teams t
     where t.id = p_team and t.university_id = p_university and t.status = 'active' and not t.is_test;
    if v_team.id is null then return jsonb_build_object('ok', false, 'error', 'bad_team'); end if;
  elsif v_new is not null then
    if length(v_new) < 2 then return jsonb_build_object('ok', false, 'error', 'bad_team'); end if;
    -- Typed a club that already exists? Use it.
    select * into v_team from public.offcampus_teams t
     where t.university_id = p_university and t.name_key = public.offcampus_name_key(v_new) and t.status = 'active' and not t.is_test;
  end if;

  -- One person, one contact: match on cleaned email first, then mobile.
  select * into v_contact from public.contacts c
   where c.email_norm = v_email or c.mobile_norm = v_mobile
   order by (c.email_norm = v_email) desc nulls last, c.created_at limit 1;

  if v_contact.id is not null then
    select * into v_member from public.offcampus_members m where m.contact_id = v_contact.id;
    if v_member.id is not null then
      -- Already registered. The pass comes back only to someone who knows both
      -- the email and the mobile it was registered with.
      if v_contact.email_norm = v_email and v_contact.mobile_norm = v_mobile then
        return jsonb_build_object('ok', true, 'already', true, 'pass_token', v_member.pass_token);
      end if;
      return jsonb_build_object('ok', false, 'error', 'already_registered');
    end if;
    update public.contacts set
      email = coalesce(email, v_email::citext),
      mobile = coalesce(mobile, p_mobile)
     where id = v_contact.id;
  else
    insert into public.contacts(full_name, email, mobile)
    values (v_name, v_email::citext, btrim(p_mobile)) returning * into v_contact;
  end if;

  insert into public.offcampus_members(contact_id, full_name, age_ack_at, privacy_version,
      marketing_consent, marketing_consent_at, source)
  values (v_contact.id, v_name, now(), s.privacy_version, coalesce(p_marketing, false),
      case when p_marketing then now() end, left(p_source, 60))
  returning * into v_member;

  if v_team.id is null and v_new is not null then
    -- A club we don't have yet: share a pending request for the same name, or start one.
    select * into v_req from public.offcampus_team_requests r
     where r.university_id = p_university and r.name_key = public.offcampus_name_key(v_new) and r.status = 'pending';
    if v_req.id is null then
      insert into public.offcampus_team_requests(university_id, name, requested_by, organiser_requested)
      values (p_university, v_new, v_member.id, coalesce(p_organiser, false)) returning * into v_req;
    end if;
  end if;

  insert into public.offcampus_affiliations(member_id, university_id, team_id, request_id, reason)
  values (v_member.id, p_university, v_team.id, v_req.id, 'registered');

  if v_team.id is not null and coalesce(p_organiser, false) then
    insert into public.offcampus_organisers(member_id, team_id) values (v_member.id, v_team.id)
    on conflict (member_id, team_id) do nothing;
  end if;

  return jsonb_build_object('ok', true, 'already', false, 'pass_token', v_member.pass_token,
    'pending_team', v_req.id is not null);
end $$;

-- "My season pass" on a new phone: both the email and the mobile it was
-- registered with must match, or nothing comes back.
create or replace function public.offcampus_find_pass(p_email text, p_mobile text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  s public.offcampus_settings := public.offcampus__settings();
  v_email text := lower(nullif(btrim(coalesce(p_email, '')), ''));
  v_mobile text := nullif(regexp_replace(coalesce(p_mobile, ''), '[^0-9]', '', 'g'), '');
  v_token text;
begin
  if s.id is null or not s.enabled then return jsonb_build_object('ok', false, 'error', 'closed'); end if;
  if v_email is null or v_mobile is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  select m.pass_token into v_token from public.offcampus_members m join public.contacts c on c.id = m.contact_id
   where c.email_norm = v_email and c.mobile_norm = v_mobile limit 1;
  if v_token is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  return jsonb_build_object('ok', true, 'pass_token', v_token);
end $$;

-- The pass. First name, university and club only.
create or replace function public.offcampus_pass(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare s public.offcampus_settings := public.offcampus__settings(); r record;
begin
  if s.id is null or not s.enabled then return jsonb_build_object('ok', false, 'error', 'closed'); end if;
  select m.id, m.full_name, m.status, m.created_at, u.id as uni_id, u.name as uni_name, u.short_name as uni_short,
         t.id as team_id, t.name as team_name, rq.name as pending_name,
         (select count(*) from public.offcampus_arrivals a where a.member_id = m.id and a.voided_at is null) as nights,
         not exists (
           select 1 from public.offcampus_arrivals a
           join public.offcampus_nights n on n.id = a.night_id
           join public.offcampus_seasons se on se.id = n.season_id
           where a.member_id = m.id and a.voided_at is null and se.status = 'active') as can_change
    into r
    from public.offcampus_members m
    join public.offcampus_affiliations af on af.member_id = m.id and af.valid_to is null
    join public.universities u on u.id = af.university_id
    left join public.offcampus_teams t on t.id = af.team_id
    left join public.offcampus_team_requests rq on rq.id = af.request_id and af.team_id is null
   where m.pass_token = p_token;
  if r.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  return jsonb_build_object('ok', true, 'first_name', split_part(r.full_name, ' ', 1),
    'status', r.status, 'university', r.uni_name, 'university_short', r.uni_short, 'university_id', r.uni_id,
    'team', r.team_name, 'team_id', r.team_id, 'pending_team', r.pending_name, 'nights', r.nights,
    'can_change', r.can_change, 'since', r.created_at);
end $$;

-- A member may change club freely until their first counted arrival in an
-- active season. After that, only an admin can, with a reason.
create or replace function public.offcampus_member_change_team(
  p_token text, p_university uuid, p_team uuid default null, p_new_team text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s public.offcampus_settings := public.offcampus__settings();
  v_member public.offcampus_members; v_team public.offcampus_teams; v_req public.offcampus_team_requests;
  v_new text := public.offcampus_clean_name(p_new_team); v_cur public.offcampus_affiliations;
begin
  if s.id is null or not s.enabled then return jsonb_build_object('ok', false, 'error', 'closed'); end if;
  select * into v_member from public.offcampus_members where pass_token = p_token;
  if v_member.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if exists (select 1 from public.offcampus_arrivals a join public.offcampus_nights n on n.id = a.night_id
             join public.offcampus_seasons se on se.id = n.season_id
             where a.member_id = v_member.id and a.voided_at is null and se.status = 'active') then
    return jsonb_build_object('ok', false, 'error', 'locked');
  end if;
  if not exists (select 1 from public.universities u where u.id = p_university and u.is_active and 'brisbane' = any(u.regions)) then
    return jsonb_build_object('ok', false, 'error', 'bad_university');
  end if;
  if p_team is not null then
    select * into v_team from public.offcampus_teams t where t.id = p_team and t.university_id = p_university and t.status = 'active' and not t.is_test;
    if v_team.id is null then return jsonb_build_object('ok', false, 'error', 'bad_team'); end if;
  elsif v_new is not null then
    select * into v_team from public.offcampus_teams t
     where t.university_id = p_university and t.name_key = public.offcampus_name_key(v_new) and t.status = 'active' and not t.is_test;
    if v_team.id is null then
      select * into v_req from public.offcampus_team_requests r
       where r.university_id = p_university and r.name_key = public.offcampus_name_key(v_new) and r.status = 'pending';
      if v_req.id is null then
        insert into public.offcampus_team_requests(university_id, name, requested_by)
        values (p_university, v_new, v_member.id) returning * into v_req;
      end if;
    end if;
  end if;
  select * into v_cur from public.offcampus_affiliations where member_id = v_member.id and valid_to is null;
  if v_cur.university_id = p_university and v_cur.team_id is not distinct from v_team.id
     and v_cur.request_id is not distinct from v_req.id then
    return jsonb_build_object('ok', true, 'unchanged', true);
  end if;
  update public.offcampus_affiliations set valid_to = now() where id = v_cur.id;
  insert into public.offcampus_affiliations(member_id, university_id, team_id, request_id, reason)
  values (v_member.id, p_university, v_team.id, v_req.id, 'member changed before first arrival');
  insert into public.offcampus_adjustments(kind, member_id, before, after, reason)
  values ('team_change', v_member.id,
    jsonb_build_object('university_id', v_cur.university_id, 'team_id', v_cur.team_id, 'request_id', v_cur.request_id),
    jsonb_build_object('university_id', p_university, 'team_id', v_team.id, 'request_id', v_req.id),
    'Member changed club on their pass before their first arrival');
  return jsonb_build_object('ok', true);
end $$;

-- Weekly, monthly and season results. The public sees group totals only,
-- completed nights only, and counts under the minimum masked. Admins see
-- everything, including tonight while it is running (p_live).
create or replace function public.offcampus_board(p_period text default 'week', p_level text default 'team',
  p_night uuid default null, p_live boolean default false)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  s public.offcampus_settings := public.offcampus__settings();
  v_admin boolean := public.is_admin();
  v_ref public.offcampus_nights; v_nights uuid[]; v_rows jsonb; v_prev jsonb; v_booth jsonb; v_prev_night uuid;
begin
  if p_period not in ('week','month','season') or p_level not in ('team','university') then
    return jsonb_build_object('ok', false, 'error', 'bad_request');
  end if;
  if s.id is null or (not v_admin and (not s.enabled or not s.public_board)) then
    return jsonb_build_object('ok', false, 'error', 'closed');
  end if;
  if p_night is not null and v_admin then
    select * into v_ref from public.offcampus_nights where id = p_night;
  else
    select * into v_ref from public.offcampus_nights
     where not skipped and (case when v_admin and p_live then opens_at <= now() else closes_at <= now() end)
     order by night_date desc limit 1;
  end if;
  if v_ref.id is null then return jsonb_build_object('ok', true, 'night', null, 'rows', '[]'::jsonb); end if;

  v_nights := public.offcampus__period_nights(v_ref.id, p_period);
  select coalesce(jsonb_agg(jsonb_build_object(
      'rank', x.rk, 'key', case when v_admin then x.key end, 'name', x.name, 'uni', x.uni,
      'n', case when v_admin or x.n >= s.min_public_count then x.n end,
      'masked', not v_admin and x.n < s.min_public_count) order by x.rk, x.name), '[]')
    into v_rows
    from (select st.*, rank() over (order by st.n desc) as rk
          from public.offcampus__standings(v_nights, p_level, false) st) x
   where v_admin or x.rk <= 20;

  if v_admin and p_period = 'week' then
    -- Change since the previous night, for the admin preview.
    select id into v_prev_night from public.offcampus_nights
     where not skipped and night_date < v_ref.night_date order by night_date desc limit 1;
    if v_prev_night is not null then
      select coalesce(jsonb_object_agg(st.key::text, st.n), '{}') into v_prev
        from public.offcampus__standings(array[v_prev_night], p_level, false) st;
    end if;
  end if;

  select jsonb_build_object('team', w->>'name', 'uni', w->>'uni', 'n', (w->>'n')::int) into v_booth
    from public.offcampus_prizes p, jsonb_array_elements(p.winners) w
   where p.kind = 'weekly_booth' and p.night_id = v_ref.id and p.status in ('approved','redeemed')
   limit 1;

  return jsonb_build_object('ok', true, 'period', p_period, 'level', p_level,
    'night', public.offcampus__night_json(v_ref),
    'nights_counted', coalesce(array_length(v_nights, 1), 0),
    'month', to_char(v_ref.night_date, 'FMMonth YYYY'),
    'rows', v_rows, 'previous', v_prev, 'booth', v_booth,
    'min_public_count', s.min_public_count);
end $$;

-- ── Door ───────────────────────────────────────────────────────────────────

create or replace function public.offcampus_check_in(p_token text, p_device text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s public.offcampus_settings := public.offcampus__settings();
  v_uid uuid := auth.uid();
  v_member public.offcampus_members; v_contact public.contacts; v_night public.offcampus_nights;
  v_aff public.offcampus_affiliations; v_arrival public.offcampus_arrivals;
  v_team_name text; v_uni text; v_by text; v_staff_email text; v_recent int;
begin
  if not public.offcampus__is_door(v_uid) then return jsonb_build_object('ok', false, 'error', 'not_authorised'); end if;
  if s.id is null or not s.enabled then return jsonb_build_object('ok', false, 'error', 'closed'); end if;

  select * into v_member from public.offcampus_members where pass_token = p_token;
  if v_member.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  select * into v_aff from public.offcampus_affiliations where member_id = v_member.id and valid_to is null;
  select coalesce(short_name, name) into v_uni from public.universities where id = v_aff.university_id;
  select name into v_team_name from public.offcampus_teams where id = v_aff.team_id;

  if v_member.status = 'suspended' then
    return jsonb_build_object('ok', false, 'error', 'suspended', 'reason', v_member.suspended_reason,
      'first_name', split_part(v_member.full_name, ' ', 1));
  end if;

  select * into v_night from public.offcampus_nights
   where not skipped and opens_at <= now() and closes_at > now() limit 1;
  if v_night.id is null then
    return jsonb_build_object('ok', false, 'error', 'no_night', 'first_name', split_part(v_member.full_name, ' ', 1));
  end if;

  -- No self-scans: staff can't count their own pass.
  select * into v_contact from public.contacts where id = v_member.contact_id;
  select lower(email::text) into v_staff_email from public.users where id = v_uid;
  if v_contact.user_id = v_uid or (v_staff_email is not null and v_contact.email_norm = v_staff_email) then
    insert into public.offcampus_flags(night_id, kind, member_id, team_id, detail)
    values (v_night.id, 'self_scan', v_member.id, v_aff.team_id, jsonb_build_object('staff', v_uid));
    return jsonb_build_object('ok', false, 'error', 'self_scan');
  end if;

  insert into public.offcampus_arrivals(member_id, night_id, university_id, team_id, request_id, scanned_by, method, device)
  values (v_member.id, v_night.id, v_aff.university_id, v_aff.team_id, v_aff.request_id, v_uid, 'scan', left(p_device, 80))
  on conflict (member_id, night_id) where voided_at is null do nothing
  returning * into v_arrival;

  if v_arrival.id is null then
    select * into v_arrival from public.offcampus_arrivals
     where member_id = v_member.id and night_id = v_night.id and voided_at is null;
    select split_part(coalesce(full_name, email::text), ' ', 1) into v_by from public.users where id = v_arrival.scanned_by;
    return jsonb_build_object('ok', false, 'error', 'already', 'first_name', split_part(v_member.full_name, ' ', 1),
      'at', v_arrival.scanned_at, 'by', v_by, 'team', v_team_name, 'university', v_uni);
  end if;

  -- Flags for an admin to look at; they never stop the door.
  if v_night.closes_at - now() < interval '15 minutes' then
    insert into public.offcampus_flags(night_id, kind, arrival_id, member_id, team_id)
    values (v_night.id, 'late_arrival', v_arrival.id, v_member.id, v_aff.team_id);
  end if;
  if v_aff.valid_from > now() - interval '2 hours' and v_aff.reason <> 'registered' then
    insert into public.offcampus_flags(night_id, kind, arrival_id, member_id, team_id)
    values (v_night.id, 'recent_team_change', v_arrival.id, v_member.id, v_aff.team_id);
  end if;
  if v_aff.team_id is not null then
    select count(*) into v_recent from public.offcampus_arrivals a
     where a.night_id = v_night.id and a.team_id = v_aff.team_id and a.scanned_by = v_uid
       and a.voided_at is null and a.scanned_at > now() - interval '5 minutes';
    if v_recent = 10 then
      insert into public.offcampus_flags(night_id, kind, team_id, detail)
      values (v_night.id, 'burst', v_aff.team_id, jsonb_build_object('staff', v_uid, 'in_5_minutes', v_recent));
    end if;
  end if;

  return jsonb_build_object('ok', true, 'first_name', split_part(v_member.full_name, ' ', 1),
    'team', v_team_name, 'university', v_uni, 'pending_team', v_aff.team_id is null and v_aff.request_id is not null,
    'week_no', v_night.week_no, 'at', v_arrival.scanned_at);
end $$;

-- Tonight at the door: the count and the latest arrivals (first names only).
create or replace function public.offcampus_tonight()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_night public.offcampus_nights;
begin
  if not public.offcampus__is_door() then return jsonb_build_object('ok', false, 'error', 'not_authorised'); end if;
  if not coalesce((public.offcampus__settings()).enabled, false) then return jsonb_build_object('ok', false, 'error', 'closed'); end if;
  select * into v_night from public.offcampus_nights where not skipped and opens_at <= now() and closes_at > now() limit 1;
  if v_night.id is null then
    select * into v_night from public.offcampus_nights where not skipped and opens_at > now() order by opens_at limit 1;
    return jsonb_build_object('ok', true, 'open', false,
      'next', case when v_night.id is null then null else public.offcampus__night_json(v_night) end);
  end if;
  return jsonb_build_object('ok', true, 'open', true, 'night', public.offcampus__night_json(v_night),
    'count', (select count(*) from public.offcampus_arrivals where night_id = v_night.id and voided_at is null),
    'latest', coalesce((select jsonb_agg(x) from (
        select split_part(m.full_name, ' ', 1) as first_name, t.name as team, u.short_name as uni, a.scanned_at as at
        from public.offcampus_arrivals a
        join public.offcampus_members m on m.id = a.member_id
        join public.universities u on u.id = a.university_id
        left join public.offcampus_teams t on t.id = a.team_id
        where a.night_id = v_night.id and a.voided_at is null
        order by a.scanned_at desc limit 8) x), '[]'));
end $$;

-- ── Admin ──────────────────────────────────────────────────────────────────

create or replace function public.offcampus_admin_set_settings(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s public.offcampus_settings := public.offcampus__settings(); v_old jsonb := to_jsonb(s);
begin
  if not public.is_admin() then return jsonb_build_object('ok', false, 'error', 'not_authorised'); end if;
  if coalesce((p->>'prizes_on')::boolean, s.prizes_on) and not s.prizes_on then
    if s.rules_approved_at is null or coalesce(p->>'tie_rule', s.tie_rule) is null then
      return jsonb_build_object('ok', false, 'error', 'rules_not_approved');
    end if;
  end if;
  update public.offcampus_settings set
    enabled            = coalesce((p->>'enabled')::boolean, enabled),
    public_board       = coalesce((p->>'public_board')::boolean, public_board),
    show_prizes        = coalesce((p->>'show_prizes')::boolean, show_prizes),
    prizes_on          = coalesce((p->>'prizes_on')::boolean, prizes_on),
    winner_level       = case when p ? 'winner_level' then nullif(p->>'winner_level', '') else winner_level end,
    tie_rule           = case when p ? 'tie_rule' then nullif(p->>'tie_rule', '') else tie_rule end,
    two_admin_approval = coalesce((p->>'two_admin_approval')::boolean, two_admin_approval),
    min_public_count   = coalesce((p->>'min_public_count')::int, min_public_count),
    booth_url          = case when p ? 'booth_url' then nullif(btrim(p->>'booth_url'), '') else booth_url end,
    whatsapp_url       = case when p ? 'whatsapp_url' then nullif(btrim(p->>'whatsapp_url'), '') else whatsapp_url end,
    instagram_url      = case when p ? 'instagram_url' then nullif(btrim(p->>'instagram_url'), '') else instagram_url end,
    updated_by = auth.uid(), updated_at = now()
  where id = 1;
  -- Changing the tie rule or winner level after approval needs approving again.
  if (p ? 'tie_rule' and nullif(p->>'tie_rule', '') is distinct from s.tie_rule)
     or (p ? 'winner_level' and nullif(p->>'winner_level', '') is distinct from s.winner_level) then
    update public.offcampus_settings set rules_approved_at = null, rules_approved_by = null, prizes_on = false where id = 1;
  end if;
  perform public.offcampus__audit('settings', null, jsonb_build_object('before', v_old, 'change', p));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.offcampus_admin_approve_rules(p_version text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s public.offcampus_settings := public.offcampus__settings();
begin
  if not public.is_admin() then return jsonb_build_object('ok', false, 'error', 'not_authorised'); end if;
  if nullif(btrim(p_version), '') is null then return jsonb_build_object('ok', false, 'error', 'version_required'); end if;
  if s.tie_rule is null then return jsonb_build_object('ok', false, 'error', 'tie_rule_required'); end if;
  update public.offcampus_settings set rules_version = btrim(p_version), rules_approved_by = auth.uid(),
    rules_approved_at = now(), updated_at = now() where id = 1;
  perform public.offcampus__audit('rules_approved', null, jsonb_build_object('version', p_version,
    'tie_rule', s.tie_rule, 'winner_level', s.winner_level));
  return jsonb_build_object('ok', true);
end $$;

-- Add, rename, retire or merge a club. Merging moves current members across;
-- past arrivals keep the club they were counted for.
create or replace function public.offcampus_admin_team(p_action text, p_team uuid default null,
  p_university uuid default null, p_name text default null, p_into uuid default null, p_test boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_t public.offcampus_teams; v_into public.offcampus_teams; v_name text := public.offcampus_clean_name(p_name); r record;
begin
  if not public.is_admin() then return jsonb_build_object('ok', false, 'error', 'not_authorised'); end if;
  if p_action = 'create' then
    if v_name is null or p_university is null then return jsonb_build_object('ok', false, 'error', 'missing_fields'); end if;
    begin
      insert into public.offcampus_teams(university_id, name, is_test, created_by)
      values (p_university, v_name, coalesce(p_test, false), auth.uid()) returning * into v_t;
    exception when unique_violation then
      return jsonb_build_object('ok', false, 'error', 'duplicate');
    end;
  else
    select * into v_t from public.offcampus_teams where id = p_team;
    if v_t.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
    if p_action = 'rename' then
      if v_name is null then return jsonb_build_object('ok', false, 'error', 'missing_fields'); end if;
      begin
        update public.offcampus_teams set name = v_name, updated_at = now() where id = v_t.id;
      exception when unique_violation then
        return jsonb_build_object('ok', false, 'error', 'duplicate');
      end;
    elsif p_action in ('retire','restore') then
      update public.offcampus_teams set status = case p_action when 'retire' then 'retired' else 'active' end,
        updated_at = now() where id = v_t.id;
    elsif p_action = 'merge' then
      select * into v_into from public.offcampus_teams where id = p_into and status = 'active';
      if v_into.id is null or v_into.id = v_t.id or v_into.university_id <> v_t.university_id then
        return jsonb_build_object('ok', false, 'error', 'bad_target');
      end if;
      update public.offcampus_teams set status = 'merged', merged_into = v_into.id, updated_at = now() where id = v_t.id;
      for r in select * from public.offcampus_affiliations where team_id = v_t.id and valid_to is null loop
        update public.offcampus_affiliations set valid_to = now() where id = r.id;
        insert into public.offcampus_affiliations(member_id, university_id, team_id, changed_by, reason)
        values (r.member_id, r.university_id, v_into.id, auth.uid(), 'club merged into ' || v_into.name);
      end loop;
      insert into public.offcampus_organisers(member_id, team_id, status, decided_by, decided_at, note)
      select o.member_id, v_into.id, o.status, auth.uid(), now(), 'carried over from merged club'
        from public.offcampus_organisers o where o.team_id = v_t.id and o.status = 'approved'
      on conflict (member_id, team_id) do nothing;
    else
      return jsonb_build_object('ok', false, 'error', 'bad_action');
    end if;
  end if;
  perform public.offcampus__audit('team_' || p_action, v_t.id, jsonb_build_object('name', v_name, 'into', p_into));
  return jsonb_build_object('ok', true, 'id', v_t.id);
end $$;

-- Decide a "my club isn't listed" request. Approving creates the club (or
-- maps it onto an existing one), moves waiting members onto it and, if asked,
-- re-attributes their arrivals so far, each with a recorded adjustment.
create or replace function public.offcampus_admin_team_request(p_request uuid, p_action text,
  p_team uuid default null, p_name text default null, p_reattribute boolean default true, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_r public.offcampus_team_requests; v_t public.offcampus_teams; r record; v_moved int := 0; v_re int := 0;
begin
  if not public.is_admin() then return jsonb_build_object('ok', false, 'error', 'not_authorised'); end if;
  select * into v_r from public.offcampus_team_requests where id = p_request for update;
  if v_r.id is null or v_r.status <> 'pending' then return jsonb_build_object('ok', false, 'error', 'not_pending'); end if;

  if p_action = 'reject' then
    update public.offcampus_team_requests set status = 'rejected', decided_by = auth.uid(), decided_at = now(),
      note = p_note where id = v_r.id;
    perform public.offcampus__audit('team_request_rejected', v_r.id, jsonb_build_object('note', p_note));
    -- Members stay counted for their university.
    return jsonb_build_object('ok', true);
  elsif p_action <> 'approve' then
    return jsonb_build_object('ok', false, 'error', 'bad_action');
  end if;

  if p_team is not null then
    select * into v_t from public.offcampus_teams where id = p_team and university_id = v_r.university_id and status = 'active';
    if v_t.id is null then return jsonb_build_object('ok', false, 'error', 'bad_team'); end if;
  else
    select * into v_t from public.offcampus_teams
     where university_id = v_r.university_id and name_key = public.offcampus_name_key(coalesce(p_name, v_r.name));
    if v_t.id is null then
      insert into public.offcampus_teams(university_id, name, created_by)
      values (v_r.university_id, coalesce(public.offcampus_clean_name(p_name), v_r.name), auth.uid()) returning * into v_t;
    elsif v_t.status <> 'active' then
      return jsonb_build_object('ok', false, 'error', 'team_not_active');
    end if;
  end if;

  update public.offcampus_team_requests set status = 'approved', team_id = v_t.id, decided_by = auth.uid(),
    decided_at = now(), note = p_note where id = v_r.id;

  for r in select * from public.offcampus_affiliations where request_id = v_r.id and valid_to is null and team_id is null loop
    update public.offcampus_affiliations set valid_to = now() where id = r.id;
    insert into public.offcampus_affiliations(member_id, university_id, team_id, changed_by, reason)
    values (r.member_id, r.university_id, v_t.id, auth.uid(), 'club approved');
    v_moved := v_moved + 1;
  end loop;

  if v_r.organiser_requested and v_r.requested_by is not null then
    insert into public.offcampus_organisers(member_id, team_id) values (v_r.requested_by, v_t.id)
    on conflict (member_id, team_id) do nothing;
  end if;

  if coalesce(p_reattribute, true) then
    for r in select * from public.offcampus_arrivals where request_id = v_r.id and team_id is null and voided_at is null loop
      update public.offcampus_arrivals set team_id = v_t.id where id = r.id;
      insert into public.offcampus_adjustments(kind, arrival_id, member_id, before, after, reason, done_by)
      values ('team_approved', r.id, r.member_id, jsonb_build_object('team_id', null, 'request_id', v_r.id),
        jsonb_build_object('team_id', v_t.id), 'Club approved: ' || v_t.name, auth.uid());
      perform public.offcampus__flag_prizes(r.night_id, 'An arrival was re-attributed after this prize was proposed');
      v_re := v_re + 1;
    end loop;
  end if;

  perform public.offcampus__audit('team_request_approved', v_r.id,
    jsonb_build_object('team_id', v_t.id, 'members', v_moved, 'arrivals', v_re, 'note', p_note));
  return jsonb_build_object('ok', true, 'team_id', v_t.id, 'members_moved', v_moved, 'arrivals_reattributed', v_re);
end $$;

create or replace function public.offcampus_admin_organiser(p_id uuid, p_action text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then return jsonb_build_object('ok', false, 'error', 'not_authorised'); end if;
  if p_action not in ('approve','revoke') then return jsonb_build_object('ok', false, 'error', 'bad_action'); end if;
  update public.offcampus_organisers set status = case p_action when 'approve' then 'approved' else 'revoked' end,
    decided_by = auth.uid(), decided_at = now(), note = p_note where id = p_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  perform public.offcampus__audit('organiser_' || p_action, p_id, jsonb_build_object('note', p_note));
  return jsonb_build_object('ok', true);
end $$;

-- Create a season of consecutive Thursdays, each with a door window in
-- Brisbane time (the close is on the Friday when it is earlier than the open).
create or replace function public.offcampus__make_season(p_number int, p_name text, p_first date, p_weeks int,
  p_opens time, p_closes time, p_by uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_season uuid; d date; i int; v_venue uuid := (select venue_id from public.offcampus_settings where id = 1);
begin
  insert into public.offcampus_seasons(number, name, first_night, weeks, created_by)
  values (p_number, p_name, p_first, p_weeks, p_by) returning id into v_season;
  for i in 1..p_weeks loop
    d := p_first + 7 * (i - 1);
    insert into public.offcampus_nights(season_id, week_no, night_date, event_id, opens_at, closes_at, perk_note)
    values (v_season, i, d,
      (select e.id from public.events e where e.venue_id = v_venue and e.event_date = d and e.active order by e.created_at limit 1),
      (d + p_opens) at time zone 'Australia/Brisbane',
      ((case when p_closes <= p_opens then d + 1 else d end) + p_closes) at time zone 'Australia/Brisbane',
      'Free pizza for registered students')
    on conflict (night_date) do update set season_id = excluded.season_id, week_no = excluded.week_no;
  end loop;
  return v_season;
end $$;

create or replace function public.offcampus_admin_create_season(p_name text, p_first date, p_weeks int default 12,
  p_opens time default '19:00', p_closes time default '03:00')
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_no int;
begin
  if not public.is_admin() then return jsonb_build_object('ok', false, 'error', 'not_authorised'); end if;
  if extract(isodow from p_first) <> 4 then return jsonb_build_object('ok', false, 'error', 'not_thursday'); end if;
  select coalesce(max(number), 0) + 1 into v_no from public.offcampus_seasons;
  begin
    v_id := public.offcampus__make_season(v_no, coalesce(nullif(btrim(p_name), ''), 'Season ' || lpad(v_no::text, 2, '0')),
      p_first, p_weeks, p_opens, p_closes, auth.uid());
  exception when others then
    return jsonb_build_object('ok', false, 'error', 'overlap', 'detail', sqlerrm);
  end;
  perform public.offcampus__audit('season_created', v_id, jsonb_build_object('first', p_first, 'weeks', p_weeks));
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

create or replace function public.offcampus_admin_season_status(p_season uuid, p_status text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then return jsonb_build_object('ok', false, 'error', 'not_authorised'); end if;
  if p_status not in ('planned','active','closed') then return jsonb_build_object('ok', false, 'error', 'bad_status'); end if;
  update public.offcampus_seasons set status = p_status where id = p_season;
  perform public.offcampus__audit('season_' || p_status, p_season, null);
  return jsonb_build_object('ok', true);
end $$;

-- Door window, skip, and the "This Thursday" details on the What's On page.
create or replace function public.offcampus_admin_update_night(p_night uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_old public.offcampus_nights;
begin
  if not public.is_admin() then return jsonb_build_object('ok', false, 'error', 'not_authorised'); end if;
  select * into v_old from public.offcampus_nights where id = p_night;
  if v_old.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if (p ? 'skipped') and (p->>'skipped')::boolean and exists (
       select 1 from public.offcampus_arrivals where night_id = p_night and voided_at is null) then
    return jsonb_build_object('ok', false, 'error', 'has_arrivals');
  end if;
  begin
    update public.offcampus_nights set
      opens_at     = coalesce((p->>'opens_at')::timestamptz, opens_at),
      closes_at    = coalesce((p->>'closes_at')::timestamptz, closes_at),
      skipped      = coalesce((p->>'skipped')::boolean, skipped),
      rooftop_note = case when p ? 'rooftop_note' then nullif(btrim(p->>'rooftop_note'), '') else rooftop_note end,
      club_note    = case when p ? 'club_note' then nullif(btrim(p->>'club_note'), '') else club_note end,
      lineup       = case when p ? 'lineup' then nullif(btrim(p->>'lineup'), '') else lineup end,
      perk_note    = case when p ? 'perk_note' then nullif(btrim(p->>'perk_note'), '') else perk_note end
    where id = p_night;
  exception when others then
    return jsonb_build_object('ok', false, 'error', 'bad_window', 'detail', sqlerrm);
  end;
  perform public.offcampus__audit('night_updated', p_night, jsonb_build_object('before', to_jsonb(v_old), 'change', p));
  return jsonb_build_object('ok', true);
end $$;

-- ── Corrections (admin only, reason required, never a delete) ──────────────

create or replace function public.offcampus_admin_void_arrival(p_arrival uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_a public.offcampus_arrivals;
begin
  if not public.is_admin() then return jsonb_build_object('ok', false, 'error', 'not_authorised'); end if;
  if nullif(btrim(p_reason), '') is null then return jsonb_build_object('ok', false, 'error', 'reason_required'); end if;
  update public.offcampus_arrivals set voided_at = now(), voided_by = auth.uid(), void_reason = p_reason
   where id = p_arrival and voided_at is null returning * into v_a;
  if v_a.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  insert into public.offcampus_adjustments(kind, arrival_id, member_id, before, after, reason, done_by)
  values ('void', v_a.id, v_a.member_id, jsonb_build_object('voided', false), jsonb_build_object('voided', true), p_reason, auth.uid());
  perform public.offcampus__flag_prizes(v_a.night_id, 'An arrival was voided after this prize was proposed');
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.offcampus_admin_add_arrival(p_member uuid, p_night uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_aff public.offcampus_affiliations; v_a public.offcampus_arrivals; v_n public.offcampus_nights;
begin
  if not public.is_admin() then return jsonb_build_object('ok', false, 'error', 'not_authorised'); end if;
  if nullif(btrim(p_reason), '') is null then return jsonb_build_object('ok', false, 'error', 'reason_required'); end if;
  select * into v_n from public.offcampus_nights where id = p_night;
  if v_n.id is null or v_n.opens_at > now() then return jsonb_build_object('ok', false, 'error', 'bad_night'); end if;
  -- The member's club as it was during that night.
  select * into v_aff from public.offcampus_affiliations
   where member_id = p_member and valid_from <= v_n.closes_at order by valid_from desc limit 1;
  if v_aff.id is null then
    select * into v_aff from public.offcampus_affiliations where member_id = p_member and valid_to is null;
  end if;
  if v_aff.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  insert into public.offcampus_arrivals(member_id, night_id, university_id, team_id, request_id, scanned_by, scanned_at, method)
  values (p_member, p_night, v_aff.university_id, v_aff.team_id, v_aff.request_id, auth.uid(),
          least(now(), v_n.closes_at - interval '1 second'), 'manual')
  on conflict (member_id, night_id) where voided_at is null do nothing
  returning * into v_a;
  if v_a.id is null then return jsonb_build_object('ok', false, 'error', 'already'); end if;
  insert into public.offcampus_adjustments(kind, arrival_id, member_id, after, reason, done_by)
  values ('manual_add', v_a.id, p_member, jsonb_build_object('night_id', p_night), p_reason, auth.uid());
  insert into public.offcampus_flags(night_id, kind, arrival_id, member_id, team_id, detail)
  values (p_night, 'manual_add', v_a.id, p_member, v_aff.team_id, jsonb_build_object('reason', p_reason));
  perform public.offcampus__flag_prizes(p_night, 'An arrival was added by hand after this prize was proposed');
  return jsonb_build_object('ok', true, 'id', v_a.id);
end $$;

create or replace function public.offcampus_admin_reattribute(p_arrival uuid, p_university uuid, p_team uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_a public.offcampus_arrivals;
begin
  if not public.is_admin() then return jsonb_build_object('ok', false, 'error', 'not_authorised'); end if;
  if nullif(btrim(p_reason), '') is null then return jsonb_build_object('ok', false, 'error', 'reason_required'); end if;
  if p_team is not null and not exists (select 1 from public.offcampus_teams where id = p_team and university_id = p_university) then
    return jsonb_build_object('ok', false, 'error', 'bad_team');
  end if;
  select * into v_a from public.offcampus_arrivals where id = p_arrival and voided_at is null;
  if v_a.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  update public.offcampus_arrivals set university_id = p_university, team_id = p_team where id = v_a.id;
  insert into public.offcampus_adjustments(kind, arrival_id, member_id, before, after, reason, done_by)
  values ('reattribute', v_a.id, v_a.member_id,
    jsonb_build_object('university_id', v_a.university_id, 'team_id', v_a.team_id),
    jsonb_build_object('university_id', p_university, 'team_id', p_team), p_reason, auth.uid());
  perform public.offcampus__flag_prizes(v_a.night_id, 'An arrival was re-attributed after this prize was proposed');
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.offcampus_admin_change_team(p_member uuid, p_university uuid, p_team uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_cur public.offcampus_affiliations;
begin
  if not public.is_admin() then return jsonb_build_object('ok', false, 'error', 'not_authorised'); end if;
  if nullif(btrim(p_reason), '') is null then return jsonb_build_object('ok', false, 'error', 'reason_required'); end if;
  if p_team is not null and not exists (select 1 from public.offcampus_teams where id = p_team and university_id = p_university and status = 'active') then
    return jsonb_build_object('ok', false, 'error', 'bad_team');
  end if;
  select * into v_cur from public.offcampus_affiliations where member_id = p_member and valid_to is null;
  if v_cur.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  update public.offcampus_affiliations set valid_to = now() where id = v_cur.id;
  insert into public.offcampus_affiliations(member_id, university_id, team_id, changed_by, reason)
  values (p_member, p_university, p_team, auth.uid(), p_reason);
  insert into public.offcampus_adjustments(kind, member_id, before, after, reason, done_by)
  values ('team_change', p_member,
    jsonb_build_object('university_id', v_cur.university_id, 'team_id', v_cur.team_id, 'request_id', v_cur.request_id),
    jsonb_build_object('university_id', p_university, 'team_id', p_team), p_reason, auth.uid());
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.offcampus_admin_suspend(p_member uuid, p_on boolean, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then return jsonb_build_object('ok', false, 'error', 'not_authorised'); end if;
  if nullif(btrim(p_reason), '') is null then return jsonb_build_object('ok', false, 'error', 'reason_required'); end if;
  update public.offcampus_members set status = case when p_on then 'suspended' else 'active' end,
    suspended_reason = case when p_on then p_reason end, updated_at = now() where id = p_member;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  insert into public.offcampus_adjustments(kind, member_id, reason, done_by)
  values (case when p_on then 'suspend' else 'unsuspend' end, p_member, p_reason, auth.uid());
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.offcampus_admin_clear_flag(p_flag uuid, p_note text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then return jsonb_build_object('ok', false, 'error', 'not_authorised'); end if;
  if nullif(btrim(p_note), '') is null then return jsonb_build_object('ok', false, 'error', 'reason_required'); end if;
  update public.offcampus_flags set status = 'cleared', cleared_by = auth.uid(), cleared_at = now(), clear_note = p_note
   where id = p_flag and status = 'open';
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  return jsonb_build_object('ok', true);
end $$;

-- Members with their contact details and current club, for the admin list.
create or replace function public.offcampus_admin_members(p_search text default null, p_limit int default 200)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_q text := '%' || lower(btrim(coalesce(p_search, ''))) || '%';
begin
  if not public.is_admin() then return jsonb_build_object('ok', false, 'error', 'not_authorised'); end if;
  return jsonb_build_object('ok', true, 'rows', coalesce((select jsonb_agg(x) from (
    select m.id, m.full_name, c.email::text as email, c.mobile, m.status, m.suspended_reason, m.marketing_consent,
           m.created_at, m.is_test, u.short_name as uni, af.university_id, t.name as team, af.team_id, rq.name as pending_team,
           (select count(*) from public.offcampus_arrivals a where a.member_id = m.id and a.voided_at is null) as nights,
           exists (select 1 from public.offcampus_organisers o where o.member_id = m.id and o.status = 'approved') as organiser
    from public.offcampus_members m
    join public.contacts c on c.id = m.contact_id
    join public.offcampus_affiliations af on af.member_id = m.id and af.valid_to is null
    join public.universities u on u.id = af.university_id
    left join public.offcampus_teams t on t.id = af.team_id
    left join public.offcampus_team_requests rq on rq.id = af.request_id and af.team_id is null
    where v_q = '%%' or lower(m.full_name) like v_q or lower(c.email::text) like v_q or c.mobile_norm like v_q
       or lower(coalesce(t.name, '')) like v_q
    order by m.created_at desc
    limit greatest(1, least(p_limit, 2000))) x), '[]'));
end $$;

-- One night, reconciled: registrations against arrivals, who scanned, and
-- every correction and flag.
create or replace function public.offcampus_admin_night_report(p_night uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_n public.offcampus_nights;
begin
  if not public.is_admin() then return jsonb_build_object('ok', false, 'error', 'not_authorised'); end if;
  select * into v_n from public.offcampus_nights where id = p_night;
  if v_n.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  return jsonb_build_object('ok', true, 'night', public.offcampus__night_json(v_n),
    'arrivals', (select count(*) from public.offcampus_arrivals where night_id = p_night and voided_at is null),
    'voided', (select count(*) from public.offcampus_arrivals where night_id = p_night and voided_at is not null),
    'manual', (select count(*) from public.offcampus_arrivals where night_id = p_night and voided_at is null and method = 'manual'),
    'registered_by', (select count(*) from public.offcampus_members where created_at <= v_n.closes_at and not is_test),
    'by_staff', coalesce((select jsonb_agg(x) from (
        select coalesce(us.full_name, us.email::text, 'Unknown') as staff, count(*) as n
        from public.offcampus_arrivals a left join public.users us on us.id = a.scanned_by
        where a.night_id = p_night and a.voided_at is null group by 1 order by 2 desc) x), '[]'),
    'by_team', coalesce((select jsonb_agg(x) from (
        select coalesce(t.name, 'Club pending') as team, u.short_name as uni,
               count(*) filter (where a.voided_at is null) as arrived,
               (select count(*) from public.offcampus_affiliations af
                 where af.team_id is not distinct from a.team_id and af.university_id = a.university_id
                   and af.valid_from <= v_n.closes_at and (af.valid_to is null or af.valid_to > v_n.opens_at)) as registered
        from public.offcampus_arrivals a
        join public.universities u on u.id = a.university_id
        left join public.offcampus_teams t on t.id = a.team_id
        where a.night_id = p_night group by a.team_id, a.university_id, t.name, u.short_name order by 3 desc) x), '[]'),
    'list', coalesce((select jsonb_agg(x) from (
        select a.id, a.member_id, m.full_name, coalesce(t.name, rq.name || ' (pending)') as team, u.short_name as uni,
               a.scanned_at, a.method, a.voided_at, a.void_reason, coalesce(us.full_name, us.email::text) as staff
        from public.offcampus_arrivals a
        join public.offcampus_members m on m.id = a.member_id
        join public.universities u on u.id = a.university_id
        left join public.offcampus_teams t on t.id = a.team_id
        left join public.offcampus_team_requests rq on rq.id = a.request_id
        left join public.users us on us.id = a.scanned_by
        where a.night_id = p_night order by a.scanned_at desc) x), '[]'),
    'flags', coalesce((select jsonb_agg(x) from (
        select f.id, f.kind, f.status, f.detail, f.created_at, f.clear_note, m.full_name, t.name as team
        from public.offcampus_flags f
        left join public.offcampus_members m on m.id = f.member_id
        left join public.offcampus_teams t on t.id = f.team_id
        where f.night_id = p_night order by f.created_at) x), '[]'),
    'adjustments', coalesce((select jsonb_agg(x) from (
        select j.kind, j.reason, j.before, j.after, j.done_at, coalesce(us.full_name, us.email::text) as by, m.full_name
        from public.offcampus_adjustments j
        left join public.offcampus_arrivals a on a.id = j.arrival_id
        left join public.offcampus_members m on m.id = j.member_id
        left join public.users us on us.id = j.done_by
        where a.night_id = p_night order by j.done_at) x), '[]'));
end $$;

-- ── Prizes ─────────────────────────────────────────────────────────────────

create or replace function public.offcampus_admin_propose_prize(p_kind text, p_night uuid default null, p_season uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s public.offcampus_settings := public.offcampus__settings();
  v_level text; v_nights uuid[]; v_rows jsonb; v_top bigint; v_tied jsonb; v_winners jsonb; v_tie jsonb;
  v_status text := 'proposed'; v_recipient uuid; v_id uuid; v_last timestamptz; v_key uuid;
begin
  if not public.is_admin() then return jsonb_build_object('ok', false, 'error', 'not_authorised'); end if;
  if not s.prizes_on then return jsonb_build_object('ok', false, 'error', 'prizes_off'); end if;
  if p_kind = 'weekly_booth' then
    v_level := 'team';
    select array[id], closes_at into v_nights, v_last from public.offcampus_nights where id = p_night and not skipped;
  elsif p_kind = 'season' then
    if s.winner_level is null then return jsonb_build_object('ok', false, 'error', 'winner_level_required'); end if;
    v_level := s.winner_level;
    select array_agg(id order by night_date), max(closes_at) into v_nights, v_last
      from public.offcampus_nights where season_id = p_season and not skipped;
  else
    return jsonb_build_object('ok', false, 'error', 'bad_kind');
  end if;
  if v_nights is null or v_last is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if v_last > now() then return jsonb_build_object('ok', false, 'error', 'not_finished'); end if;

  select coalesce(jsonb_agg(jsonb_build_object('key', key, 'name', name, 'uni', uni, 'n', n, 'reached_at', reached_at)
         order by n desc, name), '[]') into v_rows
    from public.offcampus__standings(v_nights, v_level, false);
  if jsonb_array_length(v_rows) = 0 then return jsonb_build_object('ok', false, 'error', 'no_arrivals'); end if;
  v_top := (v_rows->0->>'n')::bigint;
  select jsonb_agg(r) into v_tied from jsonb_array_elements(v_rows) r where (r->>'n')::bigint = v_top;

  if jsonb_array_length(v_tied) = 1 then
    v_winners := v_tied;
  else
    v_tie := jsonb_build_object('rule', s.tie_rule, 'tied', v_tied);
    if s.tie_rule = 'shared' then
      v_winners := v_tied;
    elsif s.tie_rule = 'first_to_total' then
      -- Whoever reached the final total first.
      select jsonb_agg(r) into v_winners from jsonb_array_elements(v_tied) r
       where (r->>'reached_at')::timestamptz = (select min((x->>'reached_at')::timestamptz) from jsonb_array_elements(v_tied) x);
      if jsonb_array_length(v_winners) > 1 then v_status := 'needs_decision'; end if;
    elsif s.tie_rule = 'most_weekly_wins' and p_kind = 'season' then
      with wins as (
        select (t->>'key')::uuid as key, count(*) filter (where st.rk = 1) as w
        from jsonb_array_elements(v_tied) t
        cross join lateral unnest(v_nights) as nid
        left join lateral (select key, rank() over (order by n desc) rk from public.offcampus__standings(array[nid], v_level, false)) st
          on st.key = (t->>'key')::uuid
        group by 1)
      select jsonb_agg(t) into v_winners from jsonb_array_elements(v_tied) t
        join wins on wins.key = (t->>'key')::uuid
       where wins.w = (select max(w) from wins);
      v_tie := v_tie || jsonb_build_object('weekly_wins', (select jsonb_object_agg(key::text, w) from wins));
      if jsonb_array_length(v_winners) > 1 then v_status := 'needs_decision'; end if;
    else
      v_winners := v_tied; v_status := 'needs_decision';
    end if;
  end if;

  if v_status = 'proposed' and v_level = 'team' and jsonb_array_length(v_winners) = 1 then
    v_key := (v_winners->0->>'key')::uuid;
    select o.member_id into v_recipient from public.offcampus_organisers o
     where o.team_id = v_key and o.status = 'approved' order by o.decided_at limit 1;
  end if;

  begin
    insert into public.offcampus_prizes(kind, night_id, season_id, level, winners, standings, tie, recipient_member_id,
      status, proposed_by)
    values (p_kind, case when p_kind = 'weekly_booth' then p_night end, case when p_kind = 'season' then p_season end,
      v_level, v_winners, v_rows, v_tie, v_recipient, v_status, auth.uid())
    returning id into v_id;
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'exists');
  end;
  perform public.offcampus__audit('prize_proposed', v_id, jsonb_build_object('kind', p_kind, 'status', v_status));
  return jsonb_build_object('ok', true, 'id', v_id, 'status', v_status, 'winners', v_winners);
end $$;

create or replace function public.offcampus_admin_prize(p_prize uuid, p_action text, p_note text default null,
  p_winner uuid default null, p_member uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s public.offcampus_settings := public.offcampus__settings();
  v_p public.offcampus_prizes; v_nights uuid[]; v_now jsonb; v_w jsonb; v_key uuid;
begin
  if not public.is_admin() then return jsonb_build_object('ok', false, 'error', 'not_authorised'); end if;
  select * into v_p from public.offcampus_prizes where id = p_prize for update;
  if v_p.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  v_nights := case when v_p.kind = 'weekly_booth' then array[v_p.night_id]
    else (select array_agg(id) from public.offcampus_nights where season_id = v_p.season_id and not skipped) end;

  if p_action = 'decide' then
    if v_p.status <> 'needs_decision' then return jsonb_build_object('ok', false, 'error', 'bad_status'); end if;
    if nullif(btrim(p_note), '') is null then return jsonb_build_object('ok', false, 'error', 'reason_required'); end if;
    select r into v_w from jsonb_array_elements(coalesce(v_p.tie->'tied', v_p.winners)) r where (r->>'key')::uuid = p_winner;
    if v_w is null then return jsonb_build_object('ok', false, 'error', 'not_tied'); end if;
    update public.offcampus_prizes set winners = jsonb_build_array(v_w), status = 'proposed',
      tie = coalesce(tie, '{}') || jsonb_build_object('decided_by', auth.uid(), 'decision', p_note),
      recipient_member_id = case when level = 'team' then (select o.member_id from public.offcampus_organisers o
        where o.team_id = p_winner and o.status = 'approved' order by o.decided_at limit 1) end
     where id = v_p.id;
  elsif p_action = 'recipient' then
    if v_p.status not in ('proposed','verified') then return jsonb_build_object('ok', false, 'error', 'bad_status'); end if;
    v_key := (v_p.winners->0->>'key')::uuid;
    if v_p.level = 'team' and not exists (select 1 from public.offcampus_organisers o
        where o.member_id = p_member and o.team_id = v_key and o.status = 'approved') then
      return jsonb_build_object('ok', false, 'error', 'not_organiser');
    end if;
    update public.offcampus_prizes set recipient_member_id = p_member where id = v_p.id;
  elsif p_action = 'verify' then
    if v_p.status <> 'proposed' then return jsonb_build_object('ok', false, 'error', 'bad_status'); end if;
    if exists (select 1 from public.offcampus_flags f where f.night_id = any(v_nights) and f.status = 'open') then
      return jsonb_build_object('ok', false, 'error', 'open_flags');
    end if;
    select coalesce(jsonb_agg(jsonb_build_object('key', key, 'name', name, 'uni', uni, 'n', n, 'reached_at', reached_at)
           order by n desc, name), '[]') into v_now
      from public.offcampus__standings(v_nights, v_p.level, false);
    if v_now <> v_p.standings then
      update public.offcampus_prizes set flagged = true, flag_note = 'Standings changed since this was proposed. Cancel and propose again.'
       where id = v_p.id;
      return jsonb_build_object('ok', false, 'error', 'standings_changed');
    end if;
    update public.offcampus_prizes set status = 'verified', verified_by = auth.uid(), verified_at = now(),
      note = coalesce(p_note, note) where id = v_p.id;
  elsif p_action = 'approve' then
    if v_p.status <> 'verified' then return jsonb_build_object('ok', false, 'error', 'bad_status'); end if;
    if v_p.flagged then return jsonb_build_object('ok', false, 'error', 'flagged'); end if;
    if s.two_admin_approval and v_p.verified_by = auth.uid() then
      return jsonb_build_object('ok', false, 'error', 'second_admin_required');
    end if;
    if v_p.level = 'team' and v_p.recipient_member_id is null then
      return jsonb_build_object('ok', false, 'error', 'no_recipient');
    end if;
    update public.offcampus_prizes set status = 'approved', approved_by = auth.uid(), approved_at = now(),
      note = coalesce(p_note, note) where id = v_p.id;
  elsif p_action = 'redeem' then
    if v_p.status <> 'approved' then return jsonb_build_object('ok', false, 'error', 'bad_status'); end if;
    update public.offcampus_prizes set status = 'redeemed', redeemed_by = auth.uid(), redeemed_at = now(),
      note = coalesce(p_note, note) where id = v_p.id;
  elsif p_action = 'cancel' then
    if v_p.status in ('redeemed','cancelled') then return jsonb_build_object('ok', false, 'error', 'bad_status'); end if;
    if nullif(btrim(p_note), '') is null then return jsonb_build_object('ok', false, 'error', 'reason_required'); end if;
    update public.offcampus_prizes set status = 'cancelled', cancelled_by = auth.uid(), cancelled_at = now(), note = p_note
     where id = v_p.id;
  else
    return jsonb_build_object('ok', false, 'error', 'bad_action');
  end if;
  perform public.offcampus__audit('prize_' || p_action, v_p.id, jsonb_build_object('note', p_note, 'winner', p_winner, 'member', p_member));
  return jsonb_build_object('ok', true);
end $$;

-- ── Exports ────────────────────────────────────────────────────────────────

-- Aggregate totals are safe to share. The member list has personal details:
-- admin only, and every export is logged.
create or replace function public.offcampus_admin_export(p_kind text, p_season uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  if not public.is_admin() then return jsonb_build_object('ok', false, 'error', 'not_authorised'); end if;
  if p_kind = 'totals' then
    select coalesce(jsonb_agg(x), '[]') into v from (
      select n.night_date, n.week_no, u.short_name as university, coalesce(t.name, 'Club pending') as club, count(*) as arrivals
      from public.offcampus_arrivals a
      join public.offcampus_nights n on n.id = a.night_id
      join public.universities u on u.id = a.university_id
      left join public.offcampus_teams t on t.id = a.team_id
      join public.offcampus_members m on m.id = a.member_id
      where a.voided_at is null and not m.is_test and (p_season is null or n.season_id = p_season)
      group by n.night_date, n.week_no, u.short_name, t.name
      order by n.night_date, arrivals desc) x;
  elsif p_kind = 'members' then
    select coalesce(jsonb_agg(x), '[]') into v from (
      select m.full_name, c.email::text as email, c.mobile, u.short_name as university, coalesce(t.name, rq.name) as club,
             t.id is null and rq.id is not null as club_pending, m.marketing_consent, m.status, m.created_at,
             (select count(*) from public.offcampus_arrivals a where a.member_id = m.id and a.voided_at is null) as nights
      from public.offcampus_members m
      join public.contacts c on c.id = m.contact_id
      join public.offcampus_affiliations af on af.member_id = m.id and af.valid_to is null
      join public.universities u on u.id = af.university_id
      left join public.offcampus_teams t on t.id = af.team_id
      left join public.offcampus_team_requests rq on rq.id = af.request_id
      where not m.is_test order by m.created_at) x;
  else
    return jsonb_build_object('ok', false, 'error', 'bad_kind');
  end if;
  perform public.offcampus__audit('export_' || p_kind, p_season, jsonb_build_object('rows', jsonb_array_length(v)));
  return jsonb_build_object('ok', true, 'rows', v);
end $$;

-- ── CRM: members reach the Luna CRM through the existing outbox ────────────

create or replace function public.offcampus__crm_payload(m public.offcampus_members)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'source', 'guestlist_os',
    'externalRecordId', 'offcampus:' || m.id::text,
    'contact', jsonb_strip_nulls(jsonb_build_object(
      'firstName', split_part(m.full_name, ' ', 1),
      'lastName', nullif(btrim(substr(m.full_name, length(split_part(m.full_name, ' ', 1)) + 1)), ''),
      'email', c.email::text,
      'mobile', c.mobile)),
    'contactTypes', jsonb_build_array('general_customer'),
    'venues', jsonb_build_array(jsonb_build_object('slug', crm_sync.venue_slug(s.venue_id),
      'relationshipType', 'registered', 'isPreferred', true)),
    'consents', case when m.marketing_consent then jsonb_build_array(
        jsonb_build_object('type', 'email_marketing', 'status', 'granted', 'capturedAt', m.marketing_consent_at,
          'sourceDescription', 'Off Campus Thursdays sign-up opt-in'),
        jsonb_build_object('type', 'sms_marketing', 'status', 'granted', 'capturedAt', m.marketing_consent_at,
          'sourceDescription', 'Off Campus Thursdays sign-up opt-in')) end,
    'event', jsonb_build_object('type', 'guestlist_registration', 'timestamp', m.created_at,
      'externalEventId', 'offcampus:' || m.id::text, 'venueSlug', crm_sync.venue_slug(s.venue_id))))
  from public.contacts c, public.offcampus_settings s
  where c.id = m.contact_id and s.id = 1 and not m.is_test
$$;

create or replace function public.offcampus__tg_crm()
returns trigger language plpgsql security definer set search_path = public, crm_sync as $$
begin
  perform crm_sync.enqueue('offcampus_member', new.id, public.offcampus__crm_payload(new));
  return new;
exception when others then return new;  -- the CRM must never break a sign-up
end $$;
drop trigger if exists offcampus_crm on public.offcampus_members;
create trigger offcampus_crm after insert or update of full_name, marketing_consent on public.offcampus_members
  for each row execute function public.offcampus__tg_crm();

-- ── Function access ────────────────────────────────────────────────────────

do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like 'offcampus%'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    if f.proname in ('offcampus_public_info','offcampus_register','offcampus_pass','offcampus_member_change_team','offcampus_find_pass',
                     'offcampus_board','offcampus_name_key','offcampus_clean_name') then
      execute format('grant execute on function %s to anon, authenticated', f.sig);
    elsif f.proname not like 'offcampus\_\_%' and f.proname not like 'offcampus_tg%' then
      execute format('grant execute on function %s to authenticated', f.sig);
    end if;
  end loop;
end $$;

-- ── Season 01 ──────────────────────────────────────────────────────────────
-- Launch night Thu 12 Nov 2026, twelve Thursdays to Thu 28 Jan 2027. Door
-- window 7pm to 3am Brisbane time; an admin can change any night's window or
-- skip a night that hasn't been counted. Nothing counts while the feature is off.
do $$
begin
  if not exists (select 1 from public.offcampus_seasons) then
    perform public.offcampus__make_season(1, 'Season 01', date '2026-11-12', 12, time '19:00', time '03:00', null);
  end if;
end $$;

-- ── Rollback (run by hand only) ────────────────────────────────────────────
-- drop trigger if exists offcampus_crm on public.offcampus_members;
-- drop table if exists public.offcampus_audit, public.offcampus_prizes, public.offcampus_flags,
--   public.offcampus_adjustments, public.offcampus_arrivals, public.offcampus_nights, public.offcampus_seasons,
--   public.offcampus_organisers, public.offcampus_affiliations, public.offcampus_team_requests,
--   public.offcampus_members, public.offcampus_teams, public.offcampus_settings cascade;
-- then drop the public.offcampus_* functions. Contacts created by sign-ups stay
-- (they are shared person records).
