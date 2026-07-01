-- =====================================================================
-- Luna Promoters :: 0019 Public "house" guestlist (guestlist.lunagroup.com.au)
-- A general signup not tied to a promoter. Guests are attributed to a
-- hidden house promoter ("Luna Group") so they still appear on venue lists.
-- =====================================================================

insert into public.promoters
  (full_name, email, mobile, date_of_birth, status, promoter_code, is_staff, agreement_accepted, approved_at)
select 'Luna Group', 'guestlist@lunagroup.com.au', 'house-guestlist', '2000-01-01',
       'approved', 'luna', true, true, now()
where not exists (select 1 from public.promoters where promoter_code = 'luna');
