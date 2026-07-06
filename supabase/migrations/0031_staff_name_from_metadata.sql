-- =====================================================================
-- Luna Promoters :: 0031 Recover staff names from auth signup metadata
-- Some staff profiles (public.users.full_name) are blank even though the
-- name was entered at "Add staff" time — it lives in auth.users metadata.
-- Backfill profile names from there, then re-sync staff promoter names.
-- =====================================================================

-- 1) Fill blank profile names from the auth signup metadata.
update public.users u
set full_name = btrim(au.raw_user_meta_data->>'full_name')
from auth.users au
where u.id = au.id
  and coalesce(btrim(u.full_name), '') = ''
  and coalesce(btrim(au.raw_user_meta_data->>'full_name'), '') <> '';

-- 2) Re-sync staff promoter display names from the (now-filled) profile.
update public.promoters p
set full_name = btrim(u.full_name)
from public.users u
where p.user_id = u.id
  and coalesce(btrim(u.full_name), '') <> ''
  and (p.is_staff = true or p.category = 'staff');
