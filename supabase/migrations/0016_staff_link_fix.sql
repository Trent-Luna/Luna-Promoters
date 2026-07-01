-- =====================================================================
-- Luna Promoters :: 0016 Ensure a staff member's promoter record always
-- has a code + approved status, so My Link and their /p/{code} link work
-- even if they previously applied as a promoter (pending / no code).
-- =====================================================================

create or replace function public.ensure_staff_promoter()
returns uuid language plpgsql security definer set search_path = public as $$
declare pid uuid; u record; nm text; existing record;
begin
  select * into existing from public.promoters where user_id = auth.uid() limit 1;

  if existing.id is not null then
    -- guarantee a usable, public-facing link
    if existing.promoter_code is null or existing.status <> 'approved' then
      update public.promoters
        set promoter_code = coalesce(promoter_code,
              public.generate_promoter_code(coalesce(nullif(full_name, ''), 'promo'))),
            status = 'approved',
            approved_at = coalesce(approved_at, now())
        where id = existing.id;
    end if;
    return existing.id;
  end if;

  select * into u from public.users where id = auth.uid();
  nm := coalesce(nullif(u.full_name, ''), split_part(u.email, '@', 1));

  insert into public.promoters(user_id, full_name, email, mobile, date_of_birth, status,
    promoter_code, is_staff, agreement_accepted, approved_at)
  values (auth.uid(), nm, u.email, 'staff:' || substr(auth.uid()::text, 1, 12), '2000-01-01',
    'approved', public.generate_promoter_code(nm), true, true, now())
  returning id into pid;
  return pid;
end $$;

grant execute on function public.ensure_staff_promoter() to authenticated;
