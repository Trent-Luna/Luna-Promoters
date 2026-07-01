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
