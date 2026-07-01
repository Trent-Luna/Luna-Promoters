-- =====================================================================
-- Luna Promoters :: 0011 Manual guestlist additions
-- Admins / venue managers can add guests to an event by hand. The guest
-- is attributed to the STAFF MEMBER who added them (a lightweight,
-- is_staff promoter record is auto-created for them so they appear on
-- leaderboards but are hidden from the promoter management list).
-- =====================================================================

alter table public.promoters add column if not exists is_staff boolean not null default false;

-- find or create the staff member's own promoter record
create or replace function public.ensure_staff_promoter()
returns uuid language plpgsql security definer set search_path = public as $$
declare pid uuid; u record; nm text;
begin
  select id into pid from public.promoters where user_id = auth.uid() limit 1;
  if pid is not null then return pid; end if;

  select * into u from public.users where id = auth.uid();
  nm := coalesce(nullif(u.full_name, ''), split_part(u.email, '@', 1));

  insert into public.promoters(
    user_id, full_name, email, mobile, date_of_birth, status,
    promoter_code, is_staff, agreement_accepted)
  values (
    auth.uid(), nm, u.email,
    'staff:' || substr(auth.uid()::text, 1, 12), '2000-01-01', 'approved',
    public.generate_promoter_code(nm), true, true)
  returning id into pid;
  return pid;
end $$;

-- add a guest to an event by hand (staff attribution)
create or replace function public.add_guest_manual(
  p_event uuid, p_first text, p_last text, p_mobile text,
  p_email text, p_dob date, p_instagram text
) returns json language plpgsql security definer set search_path = public as $$
declare ev record; pid uuid; g_id uuid; existing uuid; reg record;
begin
  select * into ev from public.events where id = p_event;
  if ev is null then return json_build_object('ok',false,'error','event_not_found'); end if;
  if not public.manages_venue(ev.venue_id) then
    return json_build_object('ok',false,'error','not_authorised'); end if;

  pid := public.ensure_staff_promoter();

  select id into g_id from public.guests
    where mobile = p_mobile or (p_email is not null and p_email <> '' and email = p_email::citext) limit 1;
  if g_id is null then
    insert into public.guests(first_name,last_name,mobile,email,date_of_birth,instagram)
      values (p_first,p_last,p_mobile,nullif(p_email,''),p_dob,nullif(p_instagram,''))
      returning id into g_id;
  end if;

  select id into existing from public.guest_registrations where event_id = p_event and guest_id = g_id;
  if existing is not null then return json_build_object('ok',false,'error','duplicate'); end if;

  insert into public.guest_registrations(guest_id,promoter_id,event_id,venue_id,marketing_consent)
    values (g_id, pid, p_event, ev.venue_id, false) returning * into reg;

  perform public.log_action('guest_registered', auth.uid(), ev.venue_id, p_event, pid, g_id, 'manual add');
  return json_build_object('ok',true,'registration_id',reg.id);
end $$;

grant execute on function public.ensure_staff_promoter() to authenticated;
grant execute on function public.add_guest_manual(uuid,text,text,text,text,date,text) to authenticated;
