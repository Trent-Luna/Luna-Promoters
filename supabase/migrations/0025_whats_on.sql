-- =====================================================================
-- Luna Promoters :: 0025 "What's On" newsfeed (per venue)
-- Admin/venue managers post updates; promoters read them (filter by venue).
-- =====================================================================

create table if not exists public.venue_posts (
  id         uuid primary key default gen_random_uuid(),
  venue_id   uuid references public.venues(id) on delete cascade,  -- null = all venues
  title      text not null,
  body       text,
  image_url  text,
  active     boolean not null default true,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_posts_venue on public.venue_posts(venue_id);
create index if not exists idx_posts_created on public.venue_posts(created_at desc);

alter table public.venue_posts enable row level security;
drop policy if exists posts_read on public.venue_posts;
drop policy if exists posts_admin on public.venue_posts;
drop policy if exists posts_vm on public.venue_posts;
-- any signed-in user (incl. promoters) can read active posts
create policy posts_read on public.venue_posts for select using (auth.uid() is not null);
-- admins manage everything
create policy posts_admin on public.venue_posts for all
  using (public.is_admin()) with check (public.is_admin());
-- venue managers manage posts for their venues (or all-venue posts they create)
create policy posts_vm on public.venue_posts for all
  using (public.has_role('venue_manager') and (venue_id is null or public.manages_venue(venue_id)))
  with check (public.has_role('venue_manager') and (venue_id is null or public.manages_venue(venue_id)));
