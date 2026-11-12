-- 0060 — Sonda Sounds: its own guest list, Fridays at Eclipse.
--
-- Trent, 12 Nov 2026: "they will be running fridays at eclipse every week with
-- start date TBC … rebrand it with its own crm/guest list." Sonda is a
-- promoter-run night inside Eclipse, carried here the same way Silk is carried
-- at Ember & Ash: a venue row of its own that trades one night a week.
--
--   * Guests sign up at promoter.lunagroup.com.au/p/luna?v=sonda (the What's On
--     page at reservations.lunagroup.com.au/on/sonda links there), so Sonda's
--     names, sources and CRM rows are Sonda's and never mixed into Eclipse's.
--   * Eclipse's door team can check the list in: every Eclipse venue manager
--     and reception user gets the same role on Sonda. Nobody else is granted.
--   * Active from the start (Trent, 12 Nov 2026: "can you get this live?"), so
--     the guest list and promoter sign-up work while the start date is TBC.
--
-- Additive only. Rollback: delete the two blocks' rows by slug 'sonda'.

insert into public.venues (name, slug, address, active, trading_days)
values ('Sonda', 'sonda', '247 Brunswick Street, Fortitude Valley QLD 4006', true, '{5}')
on conflict (slug) do nothing;

insert into public.roles (user_id, role, venue_id)
select r.user_id, r.role, s.id
  from public.roles r
  join public.venues e on e.id = r.venue_id and e.slug = 'eclipse'
  cross join public.venues s
 where s.slug = 'sonda'
   and r.role in ('venue_manager', 'reception')
on conflict (user_id, role, venue_id) do nothing;
