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
