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
