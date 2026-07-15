-- ============================================================================
-- 0038_university_memberships.sql
-- Luna Group Memberships — University Member workflow (ADDITIVE ONLY).
-- No existing promoter/guest/venue/roles object is renamed or altered.
-- Applied to project fiquraregaucwnrjhwqx on 2026-07-15 via Supabase migrations.
-- Rollback: see bottom of file.
-- ============================================================================

-- ---- enums + reference types --------------------------------------------------
do $$ begin
  create type public.membership_status as enum
    ('pending_verification','approved','manual_review','rejected','suspended');
exception when duplicate_object then null; end $$;

create table if not exists public.membership_types (
  id uuid primary key default gen_random_uuid(),
  key text unique not null check (key in ('promoter','university','dj','staff')),
  label text not null, active boolean not null default true,
  coming_soon boolean not null default false, sort_order int not null default 0,
  created_at timestamptz not null default now()
);
insert into public.membership_types (key,label,active,coming_soon,sort_order) values
  ('promoter','Promoter',true,false,1), ('university','University Member',true,false,2),
  ('dj','DJ',true,true,3), ('staff','Luna Group Staff',true,true,4)
on conflict (key) do nothing;

-- ---- contacts (shared CRM person) --------------------------------------------
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  full_name text not null, email citext, mobile text,
  email_norm  text generated always as (lower(nullif(trim(email::text),''))) stored,
  mobile_norm text generated always as (nullif(regexp_replace(coalesce(mobile,''),'[^0-9]','','g'),'')) stored,
  date_of_birth date,
  user_id uuid references public.users(id), promoter_id uuid references public.promoters(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists contacts_email_norm_idx  on public.contacts(email_norm);
create index if not exists contacts_mobile_norm_idx on public.contacts(mobile_norm);

create sequence if not exists public.membership_number_seq start 1000;

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  membership_type_id uuid not null references public.membership_types(id),
  membership_number text unique,
  status public.membership_status not null default 'pending_verification',
  pass_token text unique not null default replace(gen_random_uuid()::text,'-',''),
  marketing_consent boolean not null default false,
  approved_at timestamptz, approved_by uuid references public.users(id),
  suspended_at timestamptz, rejection_reason text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists memberships_contact_idx on public.memberships(contact_id);
create index if not exists memberships_status_idx  on public.memberships(status);
create index if not exists memberships_type_idx    on public.memberships(membership_type_id);

drop trigger if exists trg_contacts_updated on public.contacts;
create trigger trg_contacts_updated before update on public.contacts
  for each row execute function public.set_updated_at();
drop trigger if exists trg_memberships_updated on public.memberships;
create trigger trg_memberships_updated before update on public.memberships
  for each row execute function public.set_updated_at();

-- ---- university verifications + 18+ trigger ----------------------------------
create table if not exists public.university_verifications (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.memberships(id) on delete cascade,
  submitted_full_name text, submitted_dob date, submitted_expiry_date date,
  document_storage_path text,
  extracted_name text, extracted_institution text, extracted_expiry_date date,
  is_university_id boolean, is_current boolean, image_is_clear boolean,
  name_matches boolean, expiry_matches boolean, possible_tampering boolean,
  confidence_score int check (confidence_score is null or confidence_score between 0 and 100),
  verification_summary text, review_reasons jsonb not null default '[]'::jsonb,
  raw_provider_response jsonb, verification_provider text, verification_model text,
  verified_at timestamptz, reviewed_by uuid references public.users(id), reviewed_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists univ_ver_membership_idx on public.university_verifications(membership_id);
drop trigger if exists trg_univ_ver_updated on public.university_verifications;
create trigger trg_univ_ver_updated before update on public.university_verifications
  for each row execute function public.set_updated_at();

create or replace function public.tg_university_min_age()
returns trigger language plpgsql as $$
begin
  if new.submitted_dob is not null and new.submitted_dob > (current_date - interval '18 years') then
    raise exception 'under_18' using errcode = 'check_violation';
  end if; return new;
end $$;
drop trigger if exists trg_univ_min_age on public.university_verifications;
create trigger trg_univ_min_age before insert or update on public.university_verifications
  for each row execute function public.tg_university_min_age();

-- ---- documents + retention config --------------------------------------------
create table if not exists public.membership_documents (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.memberships(id) on delete cascade,
  kind text not null default 'university_id', storage_bucket text not null default 'university-ids',
  storage_path text not null, mime_type text, byte_size int,
  uploaded_at timestamptz not null default now(), retention_delete_after date, deleted_at timestamptz
);
create index if not exists membership_docs_membership_idx on public.membership_documents(membership_id);

create table if not exists public.document_retention_policy (
  id int primary key default 1 check (id = 1),
  retain_days int, auto_delete_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.document_retention_policy (id,retain_days,auto_delete_enabled)
  values (1,null,false) on conflict (id) do nothing;

-- ---- wristband issuance + membership audit -----------------------------------
create table if not exists public.wristband_issuances (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.memberships(id) on delete cascade,
  venue_id uuid not null references public.venues(id),
  membership_type text not null, trading_date date not null,
  issued_by uuid references public.users(id), issued_at timestamptz not null default now(),
  note text, is_override boolean not null default false, override_reason text,
  override_by uuid references public.users(id)
);
create unique index if not exists wristband_once_per_session
  on public.wristband_issuances(membership_id, venue_id, trading_date) where is_override = false;
create index if not exists wristband_venue_session_idx on public.wristband_issuances(venue_id, trading_date);

create table if not exists public.membership_audit_log (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid references public.memberships(id) on delete cascade,
  actor_id uuid references public.users(id), action text not null,
  previous_status public.membership_status, new_status public.membership_status,
  note text, meta jsonb, created_at timestamptz not null default now()
);
create index if not exists membership_audit_membership_idx on public.membership_audit_log(membership_id);

-- ---- helper functions --------------------------------------------------------
create or replace function public.luna_trading_date(p_ts timestamptz default now())
returns date language sql stable as $$
  select case when (p_ts at time zone 'Australia/Brisbane')::time < time '06:00'
    then ((p_ts at time zone 'Australia/Brisbane')::date - 1)
    else (p_ts at time zone 'Australia/Brisbane')::date end;
$$;

create or replace function public.generate_membership_number(p_key text)
returns text language plpgsql as $$
declare prefix text; n bigint;
begin
  prefix := case lower(p_key) when 'university' then 'UNI' when 'promoter' then 'PRO'
    when 'dj' then 'DJ' when 'staff' then 'STF' else 'MEM' end;
  n := nextval('public.membership_number_seq');
  return 'LUNA-'||prefix||'-'||lpad(n::text,6,'0');
end $$;

create or replace function public.safe_date(p text) returns date language plpgsql immutable as $$
begin if p is null or btrim(p)='' then return null; end if; return p::date;
exception when others then return null; end $$;

create or replace function public.safe_int(p text) returns int language plpgsql immutable as $$
begin if p is null or btrim(p)='' then return null; end if; return floor(p::numeric)::int;
exception when others then return null; end $$;

-- ============================================================================
-- NOTE: the SECURITY DEFINER RPCs (submit_university_application,
-- apply_university_verification, get_membership_pass,
-- verify_membership_for_reception, issue_wristband, get_university_stats,
-- get_university_members, get_university_review_queue, review_university_member,
-- add_university_reupload) and the RLS policies + the private `university-ids`
-- storage bucket are created by the same deployment. Their full bodies are
-- applied verbatim from the Supabase migration set of the same date. See the
-- project's Supabase migration history (versions 20260715*) for the exact
-- function source, or the docs/PLAN.md and HANDOVER for details.
-- ============================================================================

-- ---- RLS (admin-only direct access; all app access via SECURITY DEFINER RPCs)
alter table public.membership_types          enable row level security;
alter table public.contacts                  enable row level security;
alter table public.memberships               enable row level security;
alter table public.university_verifications  enable row level security;
alter table public.membership_documents      enable row level security;
alter table public.document_retention_policy enable row level security;
alter table public.wristband_issuances       enable row level security;
alter table public.membership_audit_log      enable row level security;

drop policy if exists mt_read  on public.membership_types;
drop policy if exists mt_admin on public.membership_types;
create policy mt_read  on public.membership_types for select using (true);
create policy mt_admin on public.membership_types for all using (public.is_admin()) with check (public.is_admin());
create policy contacts_admin  on public.contacts                  for all using (public.is_admin()) with check (public.is_admin());
create policy memberships_admin on public.memberships             for all using (public.is_admin()) with check (public.is_admin());
create policy univ_ver_admin  on public.university_verifications  for all using (public.is_admin()) with check (public.is_admin());
create policy docs_admin      on public.membership_documents      for all using (public.is_admin()) with check (public.is_admin());
create policy retention_admin on public.document_retention_policy for all using (public.is_admin()) with check (public.is_admin());
create policy wristband_admin on public.wristband_issuances       for all using (public.is_admin()) with check (public.is_admin());
create policy maudit_admin    on public.membership_audit_log      for all using (public.is_admin()) with check (public.is_admin());

-- ============================================================================
-- ROLLBACK (additive-only; does not affect any promoter data):
--   drop function if exists public.review_university_member, public.get_university_review_queue,
--     public.get_university_members, public.get_university_stats, public.add_university_reupload,
--     public.issue_wristband, public.verify_membership_for_reception, public.get_membership_pass,
--     public.apply_university_verification, public.submit_university_application,
--     public.generate_membership_number, public.luna_trading_date, public.safe_date, public.safe_int cascade;
--   drop table if exists public.membership_audit_log, public.wristband_issuances,
--     public.membership_documents, public.university_verifications, public.memberships,
--     public.membership_types, public.contacts, public.document_retention_policy cascade;
--   drop type if exists public.membership_status;
--   delete from storage.buckets where id='university-ids';
-- ============================================================================
