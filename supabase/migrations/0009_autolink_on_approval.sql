-- =====================================================================
-- Luna Promoters :: 0009 Auto-link promoter to login on approval
-- Ensures an approved promoter is linked to their auth account and
-- granted the 'promoter' role no matter when they created their login.
-- =====================================================================

create or replace function public.approve_promoter(p_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare code text; existing_user uuid; p_email citext; p_name text;
begin
  if not public.is_admin() then raise exception 'not authorised'; end if;

  select promoter_code, email, full_name into code, p_email, p_name
    from public.promoters where id = p_id;
  if code is null then
    code := public.generate_promoter_code(p_name);
  end if;

  -- If this person already created a login, link it now.
  select id into existing_user from auth.users where lower(email) = lower(p_email::text) limit 1;

  update public.promoters
    set status='approved', promoter_code=code, approved_at=now(), approved_by=auth.uid(),
        user_id = coalesce(user_id, existing_user)
    where id = p_id;

  if existing_user is not null then
    insert into public.roles(user_id, role) values (existing_user, 'promoter')
      on conflict do nothing;
  end if;

  perform public.log_action('promoter_approved', auth.uid(), null, null, p_id, null, null);
  return code;
end $$;

grant execute on function public.approve_promoter(uuid) to authenticated;
