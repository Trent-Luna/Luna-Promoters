-- =====================================================================
-- Luna Promoters :: 0005 Auth -> profile sync + promoter link
-- When a new auth user is created, insert a profile row. If their email
-- matches an approved promoter without a user_id, link them and grant
-- the promoter role automatically.
-- =====================================================================

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare prom record;
begin
  insert into public.users (id, email, full_name, phone)
    values (new.id, new.email,
            coalesce(new.raw_user_meta_data->>'full_name',''),
            coalesce(new.raw_user_meta_data->>'phone',''))
    on conflict (id) do nothing;

  select * into prom from public.promoters
    where email = new.email::citext and status='approved' and user_id is null limit 1;
  if prom.id is not null then
    update public.promoters set user_id = new.id where id = prom.id;
    insert into public.roles(user_id, role) values (new.id, 'promoter')
      on conflict do nothing;
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
