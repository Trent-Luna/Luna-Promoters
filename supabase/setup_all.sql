-- =====================================================================
-- Luna Promoters :: COMBINED MIGRATIONS (run once on a fresh project,
-- top to bottom). On an existing project, run only the new files.
-- Generated 2026-07-01 11:32 UTC from migrations/0001..0015.
-- =====================================================================


-- ####################################################################
-- ##  migrations/0001_schema.sql
-- ####################################################################

-- =====================================================================
-- Luna Promoters :: 0001 Schema
-- Standalone promoter management, guestlist, leaderboard & door check-in
-- =====================================================================

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ---------- Enums ----------
do $$ begin
  create type app_role      as enum ('admin','venue_manager','reception','promoter');
exception when duplicate_object then null; end $$;

do $$ begin
  create type promoter_status as enum ('pending','approved','rejected','suspended');
exception when duplicate_object then null; end $$;

do $$ begin
  create type guest_status  as enum ('registered','checked_in','no_entry','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tier_name     as enum ('bronze','silver','gold','elite');
exception when duplicate_object then null; end $$;

-- ---------- updated_at helper ----------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- =====================================================================
-- users  (profile row 1:1 with auth.users)
-- =====================================================================
create table if not exists public.users (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        citext unique not null,
  full_name    text,
  phone        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger trg_users_updated before update on public.users
  for each row execute function set_updated_at();

-- =====================================================================
-- roles  (a user may hold multiple roles; venue-scoped for managers/reception)
-- =====================================================================
create table if not exists public.roles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  role        app_role not null,
  venue_id    uuid,                       -- null = global (admin). set for venue_manager/reception scope
  created_at  timestamptz not null default now(),
  unique (user_id, role, venue_id)
);
create index if not exists idx_roles_user on public.roles(user_id);
create index if not exists idx_roles_venue on public.roles(venue_id);

-- =====================================================================
-- venues
-- =====================================================================
create table if not exists public.venues (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text unique not null,
  address     text,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger trg_venues_updated before update on public.venues
  for each row execute function set_updated_at();

-- link roles.venue_id -> venues now that venues exists
alter table public.roles
  drop constraint if exists roles_venue_fk,
  add constraint roles_venue_fk foreign key (venue_id) references public.venues(id) on delete cascade;

-- venue managers assignment (explicit, in addition to roles for reporting)
create table if not exists public.venue_managers (
  venue_id   uuid not null references public.venues(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (venue_id, user_id)
);

-- =====================================================================
-- events
-- =====================================================================
create table if not exists public.events (
  id              uuid primary key default gen_random_uuid(),
  venue_id        uuid not null references public.venues(id) on delete cascade,
  name            text not null,
  event_date      date not null,
  start_time      time,
  end_time        time,
  description     text,
  image_url       text,
  active          boolean not null default true,
  guestlist_open  boolean not null default true,
  cutoff_at       timestamptz,
  created_by      uuid references public.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_events_venue on public.events(venue_id);
create index if not exists idx_events_date  on public.events(event_date);
create trigger trg_events_updated before update on public.events
  for each row execute function set_updated_at();

-- =====================================================================
-- promoters
-- =====================================================================
create table if not exists public.promoters (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid unique references public.users(id) on delete set null, -- set on approval/login
  full_name             text not null,
  email                 citext not null,
  mobile                text not null,
  date_of_birth         date not null,
  instagram             text,
  tiktok                text,
  facebook              text,
  suburb                text,
  preferred_venue_id    uuid references public.venues(id),
  other_venue_ids       uuid[] default '{}',
  status                promoter_status not null default 'pending',
  promoter_code         text unique,      -- generated on approval
  -- agreement / consent
  agreement_accepted    boolean not null default false,
  agreement_accepted_at timestamptz,
  signup_ip             text,
  marketing_consent     boolean not null default false,
  -- tier
  current_tier          tier_name not null default 'bronze',
  elite_override        boolean not null default false,
  approved_at           timestamptz,
  approved_by           uuid references public.users(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint promoters_email_unique unique (email),
  constraint promoters_mobile_unique unique (mobile)
);
create index if not exists idx_promoters_status on public.promoters(status);
create trigger trg_promoters_updated before update on public.promoters
  for each row execute function set_updated_at();

-- =====================================================================
-- guests  (a person; can register to many events)
-- =====================================================================
create table if not exists public.guests (
  id            uuid primary key default gen_random_uuid(),
  first_name    text not null,
  last_name     text not null,
  mobile        text not null,
  email         citext,
  date_of_birth date,
  instagram     text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_guests_mobile on public.guests(mobile);
create index if not exists idx_guests_email  on public.guests(email);
create trigger trg_guests_updated before update on public.guests
  for each row execute function set_updated_at();

-- =====================================================================
-- guest_registrations  (guest x event x promoter x venue)
-- =====================================================================
create table if not exists public.guest_registrations (
  id                uuid primary key default gen_random_uuid(),
  guest_id          uuid not null references public.guests(id) on delete cascade,
  promoter_id       uuid not null references public.promoters(id) on delete cascade,
  event_id          uuid not null references public.events(id) on delete cascade,
  venue_id          uuid not null references public.venues(id) on delete cascade,
  status            guest_status not null default 'registered',
  qr_token          text unique not null default replace(gen_random_uuid()::text,'-',''),
  marketing_consent boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  -- one guest (by mobile via guest_id) cannot register twice for same event
  unique (event_id, guest_id)
);
create index if not exists idx_reg_promoter on public.guest_registrations(promoter_id);
create index if not exists idx_reg_event on public.guest_registrations(event_id);
create index if not exists idx_reg_venue on public.guest_registrations(venue_id);
create index if not exists idx_reg_status on public.guest_registrations(status);
create trigger trg_reg_updated before update on public.guest_registrations
  for each row execute function set_updated_at();

-- =====================================================================
-- check_ins  (1:1 with a registration)
-- =====================================================================
create table if not exists public.check_ins (
  id              uuid primary key default gen_random_uuid(),
  registration_id uuid unique not null references public.guest_registrations(id) on delete cascade,
  checked_in_by   uuid references public.users(id),
  checked_in_at   timestamptz not null default now(),
  no_entry        boolean not null default false,
  notes           text,
  created_at      timestamptz not null default now()
);
create index if not exists idx_checkins_reg on public.check_ins(registration_id);

-- =====================================================================
-- tiers  (editable settings)
-- =====================================================================
create table if not exists public.tiers (
  id          uuid primary key default gen_random_uuid(),
  name        tier_name unique not null,
  min_guests  int,                -- monthly checked-in threshold (null for elite/invite only)
  max_guests  int,
  invite_only boolean not null default false,
  perks       text not null,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger trg_tiers_updated before update on public.tiers
  for each row execute function set_updated_at();

-- =====================================================================
-- promoter_performance  (materialised monthly rollup, refreshed on check-in)
-- =====================================================================
create table if not exists public.promoter_performance (
  id                 uuid primary key default gen_random_uuid(),
  promoter_id        uuid not null references public.promoters(id) on delete cascade,
  period_month       date not null,        -- first day of month
  registered_count   int not null default 0,
  checked_in_count   int not null default 0,
  no_show_count      int not null default 0,
  updated_at         timestamptz not null default now(),
  unique (promoter_id, period_month)
);
create index if not exists idx_perf_month on public.promoter_performance(period_month);

-- =====================================================================
-- admin_notes  (internal, never visible to promoters)
-- =====================================================================
create table if not exists public.admin_notes (
  id          uuid primary key default gen_random_uuid(),
  promoter_id uuid references public.promoters(id) on delete cascade,
  author_id   uuid references public.users(id),
  note        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_notes_promoter on public.admin_notes(promoter_id);

-- =====================================================================
-- audit_logs
-- =====================================================================
create table if not exists public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  action_type text not null,
  user_id     uuid references public.users(id),
  venue_id    uuid references public.venues(id),
  event_id    uuid references public.events(id),
  promoter_id uuid references public.promoters(id),
  guest_id    uuid references public.guests(id),
  notes       text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_audit_action on public.audit_logs(action_type);
create index if not exists idx_audit_created on public.audit_logs(created_at);

-- ####################################################################
-- ##  migrations/0002_functions.sql
-- ####################################################################

-- =====================================================================
-- Luna Promoters :: 0002 Functions & Triggers
-- =====================================================================

-- ---------- Role helpers (SECURITY DEFINER to avoid RLS recursion) ----------
create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.roles r where r.user_id = uid and r.role = 'admin');
$$;

create or replace function public.has_role(target app_role, uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.roles r where r.user_id = uid and r.role = target);
$$;

-- venues the user can manage / staff (admin => all)
create or replace function public.user_venue_ids(uid uuid default auth.uid())
returns setof uuid language sql stable security definer set search_path = public as $$
  select v.id from public.venues v where public.is_admin(uid)
  union
  select r.venue_id from public.roles r
    where r.user_id = uid and r.venue_id is not null
      and r.role in ('venue_manager','reception');
$$;

create or replace function public.manages_venue(v uuid, uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin(uid) or exists (
    select 1 from public.roles r
    where r.user_id = uid and r.venue_id = v
      and r.role in ('venue_manager','reception')
  );
$$;

-- the promoter row belonging to the current auth user
create or replace function public.my_promoter_id(uid uuid default auth.uid())
returns uuid language sql stable security definer set search_path = public as $$
  select p.id from public.promoters p where p.user_id = uid limit 1;
$$;

-- ---------- Audit helper ----------
create or replace function public.log_action(
  p_action text, p_user uuid default auth.uid(),
  p_venue uuid default null, p_event uuid default null,
  p_promoter uuid default null, p_guest uuid default null, p_notes text default null
) returns void language sql security definer set search_path = public as $$
  insert into public.audit_logs(action_type,user_id,venue_id,event_id,promoter_id,guest_id,notes)
  values (p_action,p_user,p_venue,p_event,p_promoter,p_guest,p_notes);
$$;

-- ---------- Unique promoter code generation ----------
create or replace function public.generate_promoter_code(p_full_name text)
returns text language plpgsql security definer set search_path = public as $$
declare
  base text;
  candidate text;
  n int := 0;
begin
  base := lower(regexp_replace(split_part(p_full_name,' ',1),'[^a-zA-Z0-9]','','g'));
  if base = '' then base := 'promo'; end if;
  loop
    candidate := base || (10 + floor(random()*89))::int::text;  -- e.g. jackson23
    exit when not exists (select 1 from public.promoters where promoter_code = candidate);
    n := n + 1;
    if n > 50 then candidate := base || substr(replace(gen_random_uuid()::text,'-',''),1,5); exit; end if;
  end loop;
  return candidate;
end $$;

-- ---------- Approve a promoter (admin action) ----------
create or replace function public.approve_promoter(p_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare code text;
begin
  if not public.is_admin() then raise exception 'not authorised'; end if;
  select promoter_code into code from public.promoters where id = p_id;
  if code is null then
    code := public.generate_promoter_code((select full_name from public.promoters where id = p_id));
  end if;
  update public.promoters
    set status='approved', promoter_code=code, approved_at=now(), approved_by=auth.uid()
    where id = p_id;
  perform public.log_action('promoter_approved', auth.uid(), null, null, p_id, null, null);
  return code;
end $$;

-- ---------- Monthly performance + tier recompute ----------
create or replace function public.refresh_promoter_month(p_promoter uuid, p_month date)
returns void language plpgsql security definer set search_path = public as $$
declare
  m date := date_trunc('month', p_month)::date;
  reg int; ci int; noent int; new_tier tier_name; is_elite boolean;
begin
  select
    count(*) filter (where gr.status in ('registered','checked_in','no_entry')),
    count(*) filter (where gr.status = 'checked_in'),
    count(*) filter (where gr.status in ('registered','no_entry'))
  into reg, ci, noent
  from public.guest_registrations gr
  join public.events e on e.id = gr.event_id
  where gr.promoter_id = p_promoter
    and date_trunc('month', e.event_date)::date = m;

  insert into public.promoter_performance(promoter_id,period_month,registered_count,checked_in_count,no_show_count,updated_at)
  values (p_promoter,m,coalesce(reg,0),coalesce(ci,0),coalesce(noent,0),now())
  on conflict (promoter_id,period_month) do update
    set registered_count=excluded.registered_count,
        checked_in_count=excluded.checked_in_count,
        no_show_count=excluded.no_show_count,
        updated_at=now();

  -- tier from CURRENT month checked-in count (unless elite override)
  select elite_override into is_elite from public.promoters where id = p_promoter;
  if is_elite then
    new_tier := 'elite';
  else
    select t.name into new_tier from public.tiers t
      where t.invite_only = false
        and coalesce(ci,0) >= coalesce(t.min_guests,0)
        and (t.max_guests is null or coalesce(ci,0) <= t.max_guests)
      order by t.min_guests desc nulls last limit 1;
    if new_tier is null then new_tier := 'bronze'; end if;
  end if;

  if m = date_trunc('month', now())::date then
    update public.promoters set current_tier = new_tier where id = p_promoter;
  end if;
end $$;

-- ---------- Trigger: recompute on registration change ----------
create or replace function public.trg_reg_perf()
returns trigger language plpgsql security definer set search_path = public as $$
declare pm date;
begin
  select date_trunc('month', e.event_date)::date into pm
    from public.events e where e.id = coalesce(new.event_id, old.event_id);
  perform public.refresh_promoter_month(coalesce(new.promoter_id, old.promoter_id), pm);
  return coalesce(new, old);
end $$;

drop trigger if exists trg_reg_perf_ins on public.guest_registrations;
create trigger trg_reg_perf_ins after insert or update or delete on public.guest_registrations
  for each row execute function public.trg_reg_perf();

-- ---------- Check-in RPC (transactional, one per event) ----------
create or replace function public.check_in_guest(p_registration uuid, p_no_entry boolean default false, p_notes text default null)
returns json language plpgsql security definer set search_path = public as $$
declare
  reg record; already boolean;
begin
  select gr.*, e.venue_id as ev_venue into reg
    from public.guest_registrations gr join public.events e on e.id = gr.event_id
    where gr.id = p_registration;
  if reg is null then return json_build_object('ok',false,'error','registration_not_found'); end if;
  if not public.manages_venue(reg.venue_id) then
    return json_build_object('ok',false,'error','not_authorised');
  end if;

  select exists(select 1 from public.check_ins c where c.registration_id = p_registration) into already;
  if already then
    return json_build_object('ok',false,'error','already_checked_in',
      'checked_in_at',(select checked_in_at from public.check_ins where registration_id = p_registration));
  end if;

  insert into public.check_ins(registration_id,checked_in_by,no_entry,notes)
    values (p_registration, auth.uid(), p_no_entry, p_notes);

  update public.guest_registrations
    set status = case when p_no_entry then 'no_entry'::guest_status else 'checked_in'::guest_status end
    where id = p_registration;

  perform public.log_action(
    case when p_no_entry then 'guest_no_entry' else 'guest_checked_in' end,
    auth.uid(), reg.venue_id, reg.event_id, reg.promoter_id, reg.guest_id, p_notes);

  return json_build_object('ok',true,'no_entry',p_no_entry);
end $$;

-- ---------- Public guest registration RPC (no auth; used by /p/{code}) ----------
create or replace function public.register_guest(
  p_promoter_code text, p_event_id uuid,
  p_first text, p_last text, p_mobile text, p_email text,
  p_dob date, p_instagram text, p_marketing boolean
) returns json language plpgsql security definer set search_path = public as $$
declare
  prom record; ev record; g_id uuid; existing uuid; reg record;
begin
  select * into prom from public.promoters where promoter_code = p_promoter_code and status = 'approved';
  if prom is null then return json_build_object('ok',false,'error','promoter_not_found'); end if;

  select * into ev from public.events where id = p_event_id and active = true;
  if ev is null then return json_build_object('ok',false,'error','event_not_found'); end if;
  if not ev.guestlist_open or (ev.cutoff_at is not null and now() > ev.cutoff_at) then
    return json_build_object('ok',false,'error','guestlist_closed');
  end if;

  -- find or create guest by mobile (or email)
  select id into g_id from public.guests
    where mobile = p_mobile or (p_email is not null and email = p_email::citext) limit 1;
  if g_id is null then
    insert into public.guests(first_name,last_name,mobile,email,date_of_birth,instagram)
      values (p_first,p_last,p_mobile,nullif(p_email,''),p_dob,nullif(p_instagram,''))
      returning id into g_id;
  end if;

  -- prevent duplicate registration for same event
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
end $$;

-- ---------- Public promoter signup RPC ----------
create or replace function public.submit_promoter_application(
  p_full_name text, p_mobile text, p_email text, p_dob date,
  p_instagram text, p_tiktok text, p_facebook text, p_suburb text,
  p_preferred_venue uuid, p_other_venues uuid[],
  p_agreement boolean, p_marketing boolean, p_ip text
) returns json language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if p_dob is null or p_dob > (current_date - interval '18 years') then
    return json_build_object('ok',false,'error','under_18');
  end if;
  if not p_agreement then
    return json_build_object('ok',false,'error','agreement_required');
  end if;
  if exists(select 1 from public.promoters where email = p_email::citext) then
    return json_build_object('ok',false,'error','email_exists');
  end if;
  if exists(select 1 from public.promoters where mobile = p_mobile) then
    return json_build_object('ok',false,'error','mobile_exists');
  end if;

  insert into public.promoters(full_name,email,mobile,date_of_birth,instagram,tiktok,facebook,
      suburb,preferred_venue_id,other_venue_ids,agreement_accepted,agreement_accepted_at,
      signup_ip,marketing_consent,status)
  values (p_full_name,p_email::citext,p_mobile,p_dob,nullif(p_instagram,''),nullif(p_tiktok,''),
      nullif(p_facebook,''),nullif(p_suburb,''),p_preferred_venue,coalesce(p_other_venues,'{}'),
      true, now(), p_ip, coalesce(p_marketing,false),'pending')
  returning id into new_id;

  perform public.log_action('promoter_applied', null, null, null, new_id, null, null);
  return json_build_object('ok',true,'promoter_id',new_id);
end $$;

-- ---------- Public read of a registration by QR token (for /g/{token}) ----------
create or replace function public.get_registration_by_token(p_token text)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'id', gr.id, 'status', gr.status, 'qr_token', gr.qr_token,
    'first_name', g.first_name, 'last_name', g.last_name,
    'event_name', e.name, 'event_date', e.event_date,
    'start_time', e.start_time, 'end_time', e.end_time,
    'venue_name', v.name, 'promoter_name', p.full_name
  )
  from public.guest_registrations gr
  join public.guests g on g.id = gr.guest_id
  join public.events e on e.id = gr.event_id
  join public.venues v on v.id = gr.venue_id
  join public.promoters p on p.id = gr.promoter_id
  where gr.qr_token = p_token;
$$;

-- ---------- Check-in via QR token (reception scanner) ----------
create or replace function public.check_in_by_token(p_token text, p_no_entry boolean default false, p_notes text default null)
returns json language plpgsql security definer set search_path = public as $$
declare rid uuid;
begin
  select id into rid from public.guest_registrations where qr_token = p_token;
  if rid is null then return json_build_object('ok',false,'error','not_found'); end if;
  return public.check_in_guest(rid, p_no_entry, p_notes);
end $$;

-- ####################################################################
-- ##  migrations/0003_rls.sql
-- ####################################################################

-- =====================================================================
-- Luna Promoters :: 0003 Row Level Security
-- Public: signup + guest registration go through SECURITY DEFINER RPCs,
-- so base tables stay locked down. Reads below are for authed dashboards.
-- =====================================================================

alter table public.users                enable row level security;
alter table public.roles                enable row level security;
alter table public.venues               enable row level security;
alter table public.venue_managers       enable row level security;
alter table public.events               enable row level security;
alter table public.promoters            enable row level security;
alter table public.guests               enable row level security;
alter table public.guest_registrations  enable row level security;
alter table public.check_ins            enable row level security;
alter table public.tiers                enable row level security;
alter table public.promoter_performance enable row level security;
alter table public.admin_notes          enable row level security;
alter table public.audit_logs           enable row level security;

-- ---------- users ----------
create policy users_self_read   on public.users for select using (id = auth.uid() or public.is_admin());
create policy users_self_update on public.users for update using (id = auth.uid());
create policy users_admin_all   on public.users for all using (public.is_admin()) with check (public.is_admin());

-- ---------- roles ----------
create policy roles_self_read on public.roles for select using (user_id = auth.uid() or public.is_admin());
create policy roles_admin_all on public.roles for all using (public.is_admin()) with check (public.is_admin());

-- ---------- venues (readable by any authed staff; managed by admin) ----------
create policy venues_read      on public.venues for select using (auth.uid() is not null);
create policy venues_admin_all on public.venues for all using (public.is_admin()) with check (public.is_admin());

-- ---------- venue_managers ----------
create policy vm_read      on public.venue_managers for select using (user_id = auth.uid() or public.is_admin());
create policy vm_admin_all on public.venue_managers for all using (public.is_admin()) with check (public.is_admin());

-- ---------- events ----------
create policy events_read on public.events for select
  using (public.is_admin() or public.manages_venue(venue_id));
create policy events_admin_all on public.events for all
  using (public.is_admin()) with check (public.is_admin());
-- venue managers can create/edit events for their venues
create policy events_vm_insert on public.events for insert
  with check (public.manages_venue(venue_id) and public.has_role('venue_manager'));
create policy events_vm_update on public.events for update
  using (public.manages_venue(venue_id) and public.has_role('venue_manager'))
  with check (public.manages_venue(venue_id));

-- ---------- promoters ----------
-- promoter sees own row; admin sees all; venue managers can read promoters (needed for guestlists)
create policy promoters_self on public.promoters for select
  using (user_id = auth.uid() or public.is_admin() or public.has_role('venue_manager') or public.has_role('reception'));
create policy promoters_admin_all on public.promoters for all
  using (public.is_admin()) with check (public.is_admin());
create policy promoters_self_update on public.promoters for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());  -- promoter can edit own socials only (enforce columns in app)

-- ---------- guests (PII: admin + venue staff for their venues + owning promoter) ----------
create policy guests_admin on public.guests for all
  using (public.is_admin()) with check (public.is_admin());
create policy guests_staff_read on public.guests for select using (
  exists (
    select 1 from public.guest_registrations gr
    where gr.guest_id = guests.id
      and (public.manages_venue(gr.venue_id) or gr.promoter_id = public.my_promoter_id())
  )
);

-- ---------- guest_registrations ----------
create policy reg_admin on public.guest_registrations for all
  using (public.is_admin()) with check (public.is_admin());
create policy reg_staff_read on public.guest_registrations for select using (
  public.manages_venue(venue_id) or promoter_id = public.my_promoter_id()
);
-- reception/venue staff may update status (check-in flows also go via RPC)
create policy reg_staff_update on public.guest_registrations for update
  using (public.manages_venue(venue_id)) with check (public.manages_venue(venue_id));

-- ---------- check_ins ----------
create policy checkins_admin on public.check_ins for all
  using (public.is_admin()) with check (public.is_admin());
create policy checkins_staff_read on public.check_ins for select using (
  exists (select 1 from public.guest_registrations gr
    where gr.id = check_ins.registration_id
      and (public.manages_venue(gr.venue_id) or gr.promoter_id = public.my_promoter_id()))
);
create policy checkins_staff_insert on public.check_ins for insert with check (
  exists (select 1 from public.guest_registrations gr
    where gr.id = check_ins.registration_id and public.manages_venue(gr.venue_id))
);

-- ---------- tiers (readable by all authed; editable by admin) ----------
create policy tiers_read on public.tiers for select using (auth.uid() is not null);
create policy tiers_admin_all on public.tiers for all using (public.is_admin()) with check (public.is_admin());

-- ---------- promoter_performance ----------
create policy perf_read on public.promoter_performance for select using (
  public.is_admin() or promoter_id = public.my_promoter_id()
  or exists (select 1 from public.guest_registrations gr
             where gr.promoter_id = promoter_performance.promoter_id and public.manages_venue(gr.venue_id))
);
create policy perf_admin_all on public.promoter_performance for all
  using (public.is_admin()) with check (public.is_admin());

-- ---------- admin_notes (admin only; NEVER promoters) ----------
create policy notes_admin on public.admin_notes for all
  using (public.is_admin()) with check (public.is_admin());

-- ---------- audit_logs (admin read; venue managers read their venue) ----------
create policy audit_admin on public.audit_logs for select
  using (public.is_admin() or (venue_id is not null and public.manages_venue(venue_id)));

-- ####################################################################
-- ##  migrations/0004_seed.sql
-- ####################################################################

-- =====================================================================
-- Luna Promoters :: 0004 Seed (venues + default tiers)
-- =====================================================================

insert into public.venues (name, slug, active) values
  ('Eclipse',          'eclipse',          true),
  ('Eclipse AfterDark','eclipse-afterdark',true),
  ('Su Casa Brisbane', 'su-casa-brisbane', true),
  ('Pump Nightclub',   'pump-nightclub',   true)
on conflict (slug) do nothing;

insert into public.tiers (name, min_guests, max_guests, invite_only, perks, sort_order) values
  ('bronze', 0,  19,   false, 'Free entry, priority line, occasional drink cards', 1),
  ('silver', 20, 49,   false, 'Booth access, event tickets, improved rewards',     2),
  ('gold',   50, null, false, 'Cash bonus, VIP access, team leader eligibility',   3),
  ('elite',  null,null,true,  'Invite only. Perks manually set by admin',          4)
on conflict (name) do update
  set min_guests=excluded.min_guests, max_guests=excluded.max_guests,
      invite_only=excluded.invite_only, perks=excluded.perks, sort_order=excluded.sort_order;

-- ####################################################################
-- ##  migrations/0005_new_user_trigger.sql
-- ####################################################################

-- =====================================================================
-- Luna Promoters :: 0005 Auth -> profile sync + promoter link
-- When a new auth user is created, insert a profile row. If their email
-- matches an approved promoter without a user_id, link them and grant
-- the promoter role automatically.
-- =====================================================================

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare prom record;
begin
  insert into public.users (id, email, full_name, phone)
    values (new.id, new.email,
            coalesce(new.raw_user_meta_data->>'full_name',''),
            coalesce(new.raw_user_meta_data->>'phone',''))
    on conflict (id) do nothing;

  select * into prom from public.promoters
    where email = new.email::citext and status='approved' and user_id is null limit 1;
  if prom.id is not null then
    update public.promoters set user_id = new.id where id = prom.id;
    insert into public.roles(user_id, role) values (new.id, 'promoter')
      on conflict do nothing;
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ####################################################################
-- ##  migrations/0006_grants.sql
-- ####################################################################

-- =====================================================================
-- Luna Promoters :: 0006 RPC execution grants
-- Public (anon) may only call the sign-up / registration / token RPCs.
-- Privileged RPCs are restricted to authenticated users; internal
-- checks enforce admin/venue scope.
-- =====================================================================

-- Public-facing (anonymous) RPCs
grant execute on function public.submit_promoter_application(text,text,text,date,text,text,text,text,uuid,uuid[],boolean,boolean,text) to anon, authenticated;
grant execute on function public.register_guest(text,uuid,text,text,text,text,date,text,boolean) to anon, authenticated;
grant execute on function public.get_registration_by_token(text) to anon, authenticated;

-- Authenticated-only RPCs (internal role checks apply)
grant execute on function public.approve_promoter(uuid) to authenticated;
grant execute on function public.check_in_guest(uuid,boolean,text) to authenticated;
grant execute on function public.refresh_promoter_month(uuid,date) to authenticated;

-- Helper predicates used by RLS
grant execute on function public.is_admin(uuid) to anon, authenticated;
grant execute on function public.has_role(app_role,uuid) to anon, authenticated;
grant execute on function public.manages_venue(uuid,uuid) to anon, authenticated;
grant execute on function public.my_promoter_id(uuid) to anon, authenticated;
grant execute on function public.user_venue_ids(uuid) to anon, authenticated;
grant execute on function public.check_in_by_token(text,boolean,text) to authenticated;

-- ####################################################################
-- ##  migrations/0007_reporting.sql
-- ####################################################################

-- =====================================================================
-- Luna Promoters :: 0007 Reporting RPCs (leaderboards + dashboard stats)
-- =====================================================================

-- Leaderboard: checked-in guests drive ranking. Filter by event, venue, date range.
create or replace function public.get_leaderboard(
  p_event uuid default null, p_venue uuid default null,
  p_from date default null, p_to date default null, p_limit int default 100
) returns table (
  rank bigint, promoter_id uuid, promoter_name text, promoter_code text,
  venue_name text, registered bigint, checked_in bigint, no_shows bigint,
  attendance_pct int, tier tier_name
) language sql stable security definer set search_path = public as $$
  with base as (
    select gr.promoter_id,
           count(*)                                          as registered,
           count(*) filter (where gr.status='checked_in')    as checked_in,
           count(*) filter (where gr.status in ('registered','no_entry')) as no_shows
    from public.guest_registrations gr
    join public.events e on e.id = gr.event_id
    where (p_event is null or gr.event_id = p_event)
      and (p_venue is null or gr.venue_id = p_venue)
      and (p_from  is null or e.event_date >= p_from)
      and (p_to    is null or e.event_date <= p_to)
    group by gr.promoter_id
  )
  select row_number() over (order by b.checked_in desc, b.registered desc) as rank,
         p.id, p.full_name, p.promoter_code,
         (select v.name from public.venues v where v.id = p.preferred_venue_id) as venue_name,
         b.registered, b.checked_in, b.no_shows,
         case when b.registered>0 then round(100.0*b.checked_in/b.registered)::int else 0 end,
         p.current_tier
  from base b join public.promoters p on p.id = b.promoter_id
  order by b.checked_in desc, b.registered desc
  limit p_limit;
$$;
grant execute on function public.get_leaderboard(uuid,uuid,date,date,int) to authenticated;

-- Admin/venue KPI summary
create or replace function public.get_admin_stats(p_venue uuid default null)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'total_promoters',     (select count(*) from public.promoters),
    'pending_promoters',   (select count(*) from public.promoters where status='pending'),
    'active_promoters',    (select count(*) from public.promoters where status='approved'),
    'suspended_promoters', (select count(*) from public.promoters where status='suspended'),
    'total_registered',    (select count(*) from public.guest_registrations gr where p_venue is null or gr.venue_id=p_venue),
    'total_checked_in',    (select count(*) from public.guest_registrations gr where gr.status='checked_in' and (p_venue is null or gr.venue_id=p_venue))
  );
$$;
grant execute on function public.get_admin_stats(uuid) to authenticated;

-- A promoter's own event breakdown (RLS-safe: only own via my_promoter_id)
create or replace function public.get_promoter_events(p_promoter uuid)
returns table (
  event_id uuid, event_name text, venue_name text, event_date date,
  registered bigint, checked_in bigint, attendance_pct int
) language sql stable security definer set search_path = public as $$
  select e.id, e.name, v.name, e.event_date,
         count(gr.*),
         count(gr.*) filter (where gr.status='checked_in'),
         case when count(gr.*)>0 then round(100.0*count(gr.*) filter (where gr.status='checked_in')/count(gr.*))::int else 0 end
  from public.guest_registrations gr
  join public.events e on e.id = gr.event_id
  join public.venues v on v.id = gr.venue_id
  where gr.promoter_id = p_promoter
  group by e.id, e.name, v.name, e.event_date
  order by e.event_date desc;
$$;
grant execute on function public.get_promoter_events(uuid) to authenticated;

-- ####################################################################
-- ##  migrations/0008_tier_thresholds.sql
-- ####################################################################

-- =====================================================================
-- Luna Promoters :: 0008 Updated monthly tier thresholds
-- Bronze 0-19 · Silver 20-49 · Gold 50+ (checked-in guests / month)
-- =====================================================================
update public.tiers set min_guests = 0,  max_guests = 19   where name = 'bronze';
update public.tiers set min_guests = 20, max_guests = 49   where name = 'silver';
update public.tiers set min_guests = 50, max_guests = null where name = 'gold';

-- Recompute current tier for every promoter against the new thresholds
do $$
declare r record;
begin
  for r in select id from public.promoters loop
    perform public.refresh_promoter_month(r.id, current_date);
  end loop;
end $$;

-- ####################################################################
-- ##  migrations/0009_autolink_on_approval.sql
-- ####################################################################

-- =====================================================================
-- Luna Promoters :: 0009 Auto-link promoter to login on approval
-- Ensures an approved promoter is linked to their auth account and
-- granted the 'promoter' role no matter when they created their login.
-- =====================================================================

create or replace function public.approve_promoter(p_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare code text; existing_user uuid; p_email citext; p_name text;
begin
  if not public.is_admin() then raise exception 'not authorised'; end if;

  select promoter_code, email, full_name into code, p_email, p_name
    from public.promoters where id = p_id;
  if code is null then
    code := public.generate_promoter_code(p_name);
  end if;

  -- If this person already created a login, link it now.
  select id into existing_user from auth.users where lower(email) = lower(p_email::text) limit 1;

  update public.promoters
    set status='approved', promoter_code=code, approved_at=now(), approved_by=auth.uid(),
        user_id = coalesce(user_id, existing_user)
    where id = p_id;

  if existing_user is not null then
    insert into public.roles(user_id, role) values (existing_user, 'promoter')
      on conflict do nothing;
  end if;

  perform public.log_action('promoter_approved', auth.uid(), null, null, p_id, null, null);
  return code;
end $$;

grant execute on function public.approve_promoter(uuid) to authenticated;

-- ####################################################################
-- ##  migrations/0010_weekly_summary.sql
-- ####################################################################

-- =====================================================================
-- Luna Promoters :: 0010 Weekly summary
-- Aggregates a time window (a "week" runs Mon 05:00 -> Mon 05:00, the
-- page computes the Brisbane boundaries and passes UTC timestamps here).
-- =====================================================================

create or replace function public.get_weekly_summary(p_from timestamptz, p_to timestamptz)
returns json language sql stable security definer set search_path = public as $$
  with ci as (
    select c.no_entry, gr.promoter_id, gr.venue_id
    from public.check_ins c
    join public.guest_registrations gr on gr.id = c.registration_id
    where c.checked_in_at >= p_from and c.checked_in_at < p_to
  )
  select json_build_object(
    'registered',       (select count(*) from public.guest_registrations gr
                          where gr.created_at >= p_from and gr.created_at < p_to),
    'checked_in',       (select count(*) from ci where no_entry = false),
    'no_entry',         (select count(*) from ci where no_entry = true),
    'new_applications', (select count(*) from public.promoters p
                          where p.created_at >= p_from and p.created_at < p_to),
    'approved',         (select count(*) from public.promoters p
                          where p.approved_at >= p_from and p.approved_at < p_to),
    'events',           (select count(*) from public.events e
                          where e.event_date >= p_from::date and e.event_date < p_to::date),
    'active_promoters', (select count(distinct promoter_id) from ci where no_entry = false),
    'top_promoters', (
      select coalesce(json_agg(t), '[]') from (
        select p.full_name, p.promoter_code, p.current_tier,
               count(*) filter (where ci.no_entry = false) as checked_in
        from ci join public.promoters p on p.id = ci.promoter_id
        group by p.id, p.full_name, p.promoter_code, p.current_tier
        order by checked_in desc limit 10
      ) t
    ),
    'top_venues', (
      select coalesce(json_agg(t), '[]') from (
        select v.name,
               count(*) filter (where ci.no_entry = false) as checked_in
        from ci join public.venues v on v.id = ci.venue_id
        group by v.id, v.name order by checked_in desc
      ) t
    )
  );
$$;
grant execute on function public.get_weekly_summary(timestamptz, timestamptz) to authenticated;

-- ####################################################################
-- ##  migrations/0011_manual_guests.sql
-- ####################################################################

-- =====================================================================
-- Luna Promoters :: 0011 Manual guestlist additions
-- Admins / venue managers can add guests to an event by hand. The guest
-- is attributed to the STAFF MEMBER who added them (a lightweight,
-- is_staff promoter record is auto-created for them so they appear on
-- leaderboards but are hidden from the promoter management list).
-- =====================================================================

alter table public.promoters add column if not exists is_staff boolean not null default false;

-- find or create the staff member's own promoter record
create or replace function public.ensure_staff_promoter()
returns uuid language plpgsql security definer set search_path = public as $$
declare pid uuid; u record; nm text;
begin
  select id into pid from public.promoters where user_id = auth.uid() limit 1;
  if pid is not null then return pid; end if;

  select * into u from public.users where id = auth.uid();
  nm := coalesce(nullif(u.full_name, ''), split_part(u.email, '@', 1));

  insert into public.promoters(
    user_id, full_name, email, mobile, date_of_birth, status,
    promoter_code, is_staff, agreement_accepted)
  values (
    auth.uid(), nm, u.email,
    'staff:' || substr(auth.uid()::text, 1, 12), '2000-01-01', 'approved',
    public.generate_promoter_code(nm), true, true)
  returning id into pid;
  return pid;
end $$;

-- add a guest to an event by hand (staff attribution)
create or replace function public.add_guest_manual(
  p_event uuid, p_first text, p_last text, p_mobile text,
  p_email text, p_dob date, p_instagram text
) returns json language plpgsql security definer set search_path = public as $$
declare ev record; pid uuid; g_id uuid; existing uuid; reg record;
begin
  select * into ev from public.events where id = p_event;
  if ev is null then return json_build_object('ok',false,'error','event_not_found'); end if;
  if not public.manages_venue(ev.venue_id) then
    return json_build_object('ok',false,'error','not_authorised'); end if;

  pid := public.ensure_staff_promoter();

  select id into g_id from public.guests
    where mobile = p_mobile or (p_email is not null and p_email <> '' and email = p_email::citext) limit 1;
  if g_id is null then
    insert into public.guests(first_name,last_name,mobile,email,date_of_birth,instagram)
      values (p_first,p_last,p_mobile,nullif(p_email,''),p_dob,nullif(p_instagram,''))
      returning id into g_id;
  end if;

  select id into existing from public.guest_registrations where event_id = p_event and guest_id = g_id;
  if existing is not null then return json_build_object('ok',false,'error','duplicate'); end if;

  insert into public.guest_registrations(guest_id,promoter_id,event_id,venue_id,marketing_consent)
    values (g_id, pid, p_event, ev.venue_id, false) returning * into reg;

  perform public.log_action('guest_registered', auth.uid(), ev.venue_id, p_event, pid, g_id, 'manual add');
  return json_build_object('ok',true,'registration_id',reg.id);
end $$;

grant execute on function public.ensure_staff_promoter() to authenticated;
grant execute on function public.add_guest_manual(uuid,text,text,text,text,date,text) to authenticated;

-- ####################################################################
-- ##  migrations/0012_public_promoter_link.sql
-- ####################################################################

-- =====================================================================
-- Luna Promoters :: 0012 Public promoter-link data
-- The /p/{code} page is public (guests are not logged in). RLS blocks
-- anonymous reads of promoters/events, so we expose a SECURITY DEFINER
-- function that returns only the promoter's display name + open events.
-- =====================================================================

create or replace function public.get_promoter_link(p_code text)
returns json language plpgsql stable security definer set search_path = public as $$
declare prom record; evs json;
begin
  select full_name, promoter_code into prom
    from public.promoters
    where promoter_code = p_code and status = 'approved';
  if prom.promoter_code is null then
    return null;   -- unknown or not-approved promoter -> page shows Not Found
  end if;

  select coalesce(json_agg(to_jsonb(x)), '[]'::json) into evs from (
    select e.id, e.name, e.event_date, e.start_time, e.end_time,
           e.venue_id, v.name as venue_name
    from public.events e
    join public.venues v on v.id = e.venue_id
    where e.active = true
      and e.guestlist_open = true
      and e.event_date >= current_date
      and (e.cutoff_at is null or now() <= e.cutoff_at)
    order by e.event_date
  ) x;

  return json_build_object(
    'full_name', prom.full_name,
    'promoter_code', prom.promoter_code,
    'events', evs
  );
end $$;

grant execute on function public.get_promoter_link(text) to anon, authenticated;

-- ####################################################################
-- ##  migrations/0013_venue_date_flow.sql
-- ####################################################################

-- =====================================================================
-- Luna Promoters :: 0013 Venue + Date guest flow (no manual events)
-- Guests pick a venue and a date. A "night" (event row) is created
-- automatically behind the scenes so check-ins/leaderboards still work.
-- =====================================================================

-- find or create the night for a venue + date
create or replace function public.ensure_event(p_venue uuid, p_date date)
returns uuid language plpgsql security definer set search_path = public as $$
declare eid uuid;
begin
  select id into eid from public.events
    where venue_id = p_venue and event_date = p_date
    order by created_at limit 1;
  if eid is null then
    insert into public.events(venue_id, name, event_date, active, guestlist_open)
      values (p_venue, to_char(p_date, 'Dy DD Mon'), p_date, true, true)
      returning id into eid;
  end if;
  return eid;
end $$;

-- public guest registration by venue + date
create or replace function public.register_guest_vd(
  p_promoter_code text, p_venue uuid, p_date date,
  p_first text, p_last text, p_mobile text, p_email text,
  p_dob date, p_instagram text, p_marketing boolean
) returns json language plpgsql security definer set search_path = public as $$
declare prom record; ven record; eid uuid; g_id uuid; existing uuid; reg record;
begin
  select * into prom from public.promoters where promoter_code = p_promoter_code and status = 'approved';
  if prom is null then return json_build_object('ok',false,'error','promoter_not_found'); end if;
  select * into ven from public.venues where id = p_venue and active = true;
  if ven is null then return json_build_object('ok',false,'error','venue_not_found'); end if;
  if p_date is null or p_date < current_date or p_date > (current_date + interval '1 year') then
    return json_build_object('ok',false,'error','bad_date'); end if;

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

  insert into public.guest_registrations(guest_id,promoter_id,event_id,venue_id,marketing_consent)
    values (g_id, prom.id, eid, p_venue, coalesce(p_marketing,false)) returning * into reg;
  perform public.log_action('guest_registered', null, p_venue, eid, prom.id, g_id, null);
  return json_build_object('ok',true,'registration_id',reg.id,'qr_token',reg.qr_token);
end $$;

-- manual staff add by venue + date
create or replace function public.add_guest_manual_vd(
  p_venue uuid, p_date date, p_first text, p_last text, p_mobile text,
  p_email text, p_dob date, p_instagram text
) returns json language plpgsql security definer set search_path = public as $$
declare ven record; eid uuid; pid uuid; g_id uuid; existing uuid; reg record;
begin
  select * into ven from public.venues where id = p_venue;
  if ven is null then return json_build_object('ok',false,'error','venue_not_found'); end if;
  if not public.manages_venue(p_venue) then return json_build_object('ok',false,'error','not_authorised'); end if;
  if p_date is null or p_date < (current_date - interval '1 day') or p_date > (current_date + interval '1 year') then
    return json_build_object('ok',false,'error','bad_date'); end if;

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

  insert into public.guest_registrations(guest_id,promoter_id,event_id,venue_id,marketing_consent)
    values (g_id, pid, eid, p_venue, false) returning * into reg;
  perform public.log_action('guest_registered', auth.uid(), p_venue, eid, pid, g_id, 'manual add');
  return json_build_object('ok',true,'registration_id',reg.id);
end $$;

-- promoter-link data now returns the list of venues (no events)
create or replace function public.get_promoter_link(p_code text)
returns json language plpgsql stable security definer set search_path = public as $$
declare prom record; vens json;
begin
  select full_name, promoter_code into prom
    from public.promoters where promoter_code = p_code and status = 'approved';
  if prom.promoter_code is null then return null; end if;

  select coalesce(json_agg(to_jsonb(x) order by x.name), '[]'::json) into vens
    from (select id, name from public.venues where active = true order by name) x;

  return json_build_object('full_name', prom.full_name, 'promoter_code', prom.promoter_code, 'venues', vens);
end $$;

grant execute on function public.ensure_event(uuid,date) to authenticated;
grant execute on function public.register_guest_vd(text,uuid,date,text,text,text,text,date,text,boolean) to anon, authenticated;
grant execute on function public.add_guest_manual_vd(uuid,date,text,text,text,text,date,text) to authenticated;
grant execute on function public.get_promoter_link(text) to anon, authenticated;

-- include the promoter code on the token lookup so the guest's
-- "share with friends" can point friends at the promoter's own link
create or replace function public.get_registration_by_token(p_token text)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'id', gr.id, 'status', gr.status, 'qr_token', gr.qr_token,
    'first_name', g.first_name, 'last_name', g.last_name,
    'event_name', e.name, 'event_date', e.event_date,
    'start_time', e.start_time, 'end_time', e.end_time,
    'venue_name', v.name, 'promoter_name', p.full_name, 'promoter_code', p.promoter_code
  )
  from public.guest_registrations gr
  join public.guests g on g.id = gr.guest_id
  join public.events e on e.id = gr.event_id
  join public.venues v on v.id = gr.venue_id
  join public.promoters p on p.id = gr.promoter_id
  where gr.qr_token = p_token;
$$;

-- ####################################################################
-- ##  migrations/0014_auto_approve.sql
-- ####################################################################

-- =====================================================================
-- Luna Promoters :: 0014 Auto-approve setting for promoter sign-ups
-- =====================================================================

create table if not exists public.app_settings (
  id int primary key default 1,
  auto_approve_promoters boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint app_settings_single check (id = 1)
);
insert into public.app_settings (id) values (1) on conflict (id) do nothing;

alter table public.app_settings enable row level security;
drop policy if exists settings_read on public.app_settings;
drop policy if exists settings_admin on public.app_settings;
create policy settings_read  on public.app_settings for select using (auth.uid() is not null);
create policy settings_admin on public.app_settings for all
  using (public.is_admin()) with check (public.is_admin());

-- rebuild the application RPC to honour the auto-approve setting
create or replace function public.submit_promoter_application(
  p_full_name text, p_mobile text, p_email text, p_dob date,
  p_instagram text, p_tiktok text, p_facebook text, p_suburb text,
  p_preferred_venue uuid, p_other_venues uuid[],
  p_agreement boolean, p_marketing boolean, p_ip text
) returns json language plpgsql security definer set search_path = public as $$
declare new_id uuid; auto boolean; code text;
begin
  if p_dob is null or p_dob > (current_date - interval '18 years') then
    return json_build_object('ok',false,'error','under_18');
  end if;
  if not p_agreement then
    return json_build_object('ok',false,'error','agreement_required');
  end if;
  if exists(select 1 from public.promoters where email = p_email::citext) then
    return json_build_object('ok',false,'error','email_exists');
  end if;
  if exists(select 1 from public.promoters where mobile = p_mobile) then
    return json_build_object('ok',false,'error','mobile_exists');
  end if;

  select auto_approve_promoters into auto from public.app_settings where id = 1;
  auto := coalesce(auto, false);

  if auto then code := public.generate_promoter_code(p_full_name); end if;

  insert into public.promoters(full_name,email,mobile,date_of_birth,instagram,tiktok,facebook,
      suburb,preferred_venue_id,other_venue_ids,agreement_accepted,agreement_accepted_at,
      signup_ip,marketing_consent,status,promoter_code,approved_at)
  values (p_full_name,p_email::citext,p_mobile,p_dob,nullif(p_instagram,''),nullif(p_tiktok,''),
      nullif(p_facebook,''),nullif(p_suburb,''),p_preferred_venue,coalesce(p_other_venues,'{}'),
      true, now(), p_ip, coalesce(p_marketing,false),
      case when auto then 'approved'::promoter_status else 'pending'::promoter_status end,
      code, case when auto then now() else null end)
  returning id into new_id;

  perform public.log_action(case when auto then 'promoter_auto_approved' else 'promoter_applied' end,
    null, null, null, new_id, null, null);

  return json_build_object('ok',true,'promoter_id',new_id,'auto_approved',auto,'promoter_code',code);
end $$;

grant execute on function public.submit_promoter_application(text,text,text,date,text,text,text,text,uuid,uuid[],boolean,boolean,text) to anon, authenticated;

-- ####################################################################
-- ##  migrations/0015_my_link.sql
-- ####################################################################

-- =====================================================================
-- Luna Promoters :: 0015 "My Link" for staff (admins / venue managers)
-- Returns (creating if needed) the caller's own promoter code + stats so
-- they get a shareable link/QR and we can track guests on their list.
-- =====================================================================

create or replace function public.get_my_link()
returns json language plpgsql security definer set search_path = public as $$
declare pid uuid; prom record; reg bigint; ci bigint; reg_m bigint; ci_m bigint; m date;
begin
  pid := public.ensure_staff_promoter();  -- existing promoter for the user, or a new is_staff one
  select full_name, promoter_code, current_tier into prom from public.promoters where id = pid;

  select count(*), count(*) filter (where status = 'checked_in') into reg, ci
    from public.guest_registrations where promoter_id = pid;

  m := date_trunc('month', now())::date;
  select count(*), count(*) filter (where gr.status = 'checked_in') into reg_m, ci_m
    from public.guest_registrations gr
    join public.events e on e.id = gr.event_id
    where gr.promoter_id = pid and date_trunc('month', e.event_date)::date = m;

  return json_build_object(
    'promoter_code', prom.promoter_code,
    'full_name', prom.full_name,
    'registered_total', coalesce(reg,0),
    'checked_in_total', coalesce(ci,0),
    'registered_month', coalesce(reg_m,0),
    'checked_in_month', coalesce(ci_m,0)
  );
end $$;

grant execute on function public.get_my_link() to authenticated;
