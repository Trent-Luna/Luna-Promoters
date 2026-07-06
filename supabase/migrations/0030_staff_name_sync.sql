-- =====================================================================
-- Luna Promoters :: 0030 Sync staff display names from their profile
-- Staff promoter records were auto-created with an email-prefix name and
-- never refreshed. Re-sync them from public.users.full_name (which the
-- admin "Add staff" form populates), and keep them in sync afterwards.
-- (Trigger 0029 title-cases the result.)
-- =====================================================================

-- One-time backfill: pull the real name from the linked user profile.
update public.promoters p
set full_name = btrim(u.full_name)
from public.users u
where p.user_id = u.id
  and u.full_name is not null
  and btrim(u.full_name) <> ''
  and p.is_staff = true;

-- ensure_staff_promoter: refresh the name from the profile on every call.
create or replace function public.ensure_staff_promoter()
returns uuid language plpgsql security definer set search_path = public as $$
declare pid uuid; u record; nm text; existing record;
begin
  select * into existing from public.promoters where user_id = auth.uid() limit 1;
  select * into u from public.users where id = auth.uid();

  if existing.id is not null then
    update public.promoters
      set promoter_code = coalesce(promoter_code,
            public.generate_promoter_code(coalesce(nullif(full_name, ''), 'promo'))),
          status = 'approved',
          approved_at = coalesce(approved_at, now()),
          full_name = case when u.full_name is not null and btrim(u.full_name) <> ''
                           then btrim(u.full_name) else full_name end
      where id = existing.id;
    return existing.id;
  end if;

  nm := coalesce(nullif(u.full_name, ''), split_part(u.email, '@', 1));
  insert into public.promoters(user_id, full_name, email, mobile, date_of_birth, status,
    promoter_code, is_staff, agreement_accepted, approved_at, category)
  values (auth.uid(), nm, u.email, 'staff:' || substr(auth.uid()::text, 1, 12), '2000-01-01',
    'approved', public.generate_promoter_code(nm), true, true, now(), 'staff')
  returning id into pid;
  return pid;
end $$;
grant execute on function public.ensure_staff_promoter() to authenticated;
