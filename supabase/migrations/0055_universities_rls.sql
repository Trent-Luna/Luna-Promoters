-- 0055 — Lock down the universities list.
--
-- Found 9 Nov 2026 while planning Off Campus Thursdays: public.universities
-- had row-level security switched off and the anon role held INSERT, UPDATE,
-- DELETE and TRUNCATE on it. The anon key ships in every guest-list page, so
-- anyone could rename or delete a university. Off Campus uses this list as its
-- university picker, so it has to be trustworthy.
--
-- Nothing in the app writes to this table (the university sign-up only reads
-- it, through fn_match_university). After this migration:
--   * anyone can read the active universities (the pickers keep working);
--   * admins can read inactive ones and change the list;
--   * TRUNCATE, which RLS does not cover, is revoked outright.
-- The service role bypasses RLS as before.

alter table public.universities enable row level security;

drop policy if exists universities_read on public.universities;
create policy universities_read on public.universities
  for select to anon, authenticated
  using (is_active or public.is_admin());

drop policy if exists universities_admin_write on public.universities;
create policy universities_admin_write on public.universities
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke insert, update, delete, truncate, references, trigger on public.universities from anon;
revoke truncate, references, trigger on public.universities from authenticated;
