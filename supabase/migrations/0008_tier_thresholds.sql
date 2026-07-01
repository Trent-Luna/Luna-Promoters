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
