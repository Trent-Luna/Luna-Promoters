-- =====================================================================
-- Luna Promoters :: 0002 Functions & Triggers
-- =====================================================================

-- ---------- Role helpers (SECURITY DEFINER to avoid RLS recursion) ----------
create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.roles r where r.user_id = uid and r.role = 'admin');
$$;

create or replace function public.has_role(target app_role, uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.roles r where r.user_id = uid and r.role = target);
$$;

-- venues the user can manage / staff (admin => all)
create or replace function public.user_venue_ids(uid uuid default auth.uid())
returns setof uuid language sql stable security definer set search_path = public as $$
  select v.id from public.venues v where public.is_admin(uid)
  union
  select r.venue_id from public.roles r
    where r.user_id = uid and r.venue_id is not null
      and r.role in ('venue_manager','reception');
$$;

create or replace function public.manages_venue(v uuid, uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin(uid) or exists (
    select 1 from public.roles r
    where r.user_id = uid and r.venue_id = v
      and r.role in ('venue_manager','reception')
  );
$$;

-- the promoter row belonging to the current auth user
create or replace function public.my_promoter_id(uid uuid default auth.uid())
returns uuid language sql stable security definer set search_path = public as $$
  select p.id from public.promoters p where p.user_id = uid limit 1;
$$;

-- ---------- Audit helper ----------
create or replace function public.log_action(
  p_action text, p_user uuid default auth.uid(),
  p_venue uuid default null, p_event uuid default null,
  p_promoter uuid default null, p_guest uuid default null, p_notes text default null
) returns void language sql security definer set search_path = public as $$
  insert into public.audit_logs(action_type,user_id,venue_id,event_id,promoter_id,guest_id,notes)
  values (p_action,p_user,p_venue,p_event,p_promoter,p_guest,p_notes);
$$;

-- ---------- Unique promoter code generation ----------
create or replace function public.generate_promoter_code(p_full_name text)
returns text language plpgsql security definer set search_path = public as $$
declare
  base text;
  candidate text;
  n int := 0;
begin
  base := lower(regexp_replace(split_part(p_full_name,' ',1),'[^a-zA-Z0-9]','','g'));
  if base = '' then base := 'promo'; end if;
  loop
    candidate := base || (10 + floor(random()*89))::int::text;  -- e.g. jackson23
    exit when not exists (select 1 from public.promoters where promoter_code = candidate);
    n := n + 1;
    if n > 50 then candidate := base || substr(replace(gen_random_uuid()::text,'-',''),1,5); exit; end if;
  end loop;
  return candidate;
end $$;

-- ---------- Approve a promoter (admin action) ----------
create or replace function public.approve_promoter(p_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare code text;
begin
  if not public.is_admin() then raise exception 'not authorised'; end if;
  select promoter_code into code from public.promoters where id = p_id;
  if code is null then
    code := public.generate_promoter_code((select full_name from public.promoters where id = p_id));
  end if;
  update public.promoters
    set status='approved', promoter_code=code, approved_at=now(), approved_by=auth.uid()
    where id = p_id;
  perform public.log_action('promoter_approved', auth.uid(), null, null, p_id, null, null);
  return code;
end $$;

-- ---------- Monthly performance + tier recompute ----------
create or replace function public.refresh_promoter_month(p_promoter uuid, p_month date)
returns void language plpgsql security definer set search_path = public as $$
declare
  m date := date_trunc('month', p_month)::date;
  reg int; ci int; noent int; new_tier tier_name; is_elite boolean;
begin
  select
    count(*) filter (where gr.status in ('registered','checked_in','no_entry')),
    count(*) filter (where gr.status = 'checked_in'),
    count(*) filter (where gr.status in ('registered','no_entry'))
  into reg, ci, noent
  from public.guest_registrations gr
  join public.events e on e.id = gr.event_id
  where gr.promoter_id = p_promoter
    and date_trunc('month', e.event_date)::date = m;

  insert into public.promoter_performance(promoter_id,period_month,registered_count,checked_in_count,no_show_count,updated_at)
  values (p_promoter,m,coalesce(reg,0),coalesce(ci,0),coalesce(noent,0),now())
  on conflict (promoter_id,period_month) do update
    set registered_count=excluded.registered_count,
        checked_in_count=excluded.checked_in_count,
        no_show_count=excluded.no_show_count,
        updated_at=now();

  -- tier from CURRENT month checked-in count (unless elite override)
  select elite_override into is_elite from public.promoters where id = p_promoter;
  if is_elite then
    new_tier := 'elite';
  else
    select t.name into new_tier from public.tiers t
      where t.invite_only = false
        and coalesce(ci,0) >= coalesce(t.min_guests,0)
        and (t.max_guests is null or coalesce(ci,0) <= t.max_guests)
      order by t.min_guests desc nulls last limit 1;
    if new_tier is null then new_tier := 'bronze'; end if;
  end if;

  if m = date_trunc('month', now())::date then
    update public.promoters set current_tier = new_tier where id = p_promoter;
  end if;
end $$;

-- ---------- Trigger: recompute on registration change ----------
create or replace function public.trg_reg_perf()
returns trigger language plpgsql security definer set search_path = public as $$
declare pm date;
begin
  select date_trunc('month', e.event_date)::date into pm
    from public.events e where e.id = coalesce(new.event_id, old.event_id);
  perform public.refresh_promoter_month(coalesce(new.promoter_id, old.promoter_id), pm);
  return coalesce(new, old);
end $$;

drop trigger if exists trg_reg_perf_ins on public.guest_registrations;
create trigger trg_reg_perf_ins after insert or update or delete on public.guest_registrations
  for each row execute function public.trg_reg_perf();

-- ---------- Check-in RPC (transactional, one per event) ----------
create or replace function public.check_in_guest(p_registration uuid, p_no_entry boolean default false, p_notes text default null)
returns json language plpgsql security definer set search_path = public as $$
declare
  reg record; already boolean;
begin
  select gr.*, e.venue_id as ev_venue into reg
    from public.guest_registrations gr join public.events e on e.id = gr.event_id
    where gr.id = p_registration;
  if reg is null then return json_build_object('ok',false,'error','registration_not_found'); end if;
  if not public.manages_venue(reg.venue_id) then
    return json_build_object('ok',false,'error','not_authorised');
  end if;

  select exists(select 1 from public.check_ins c where c.registration_id = p_registration) into already;
  if already then
    return json_build_object('ok',false,'error','already_checked_in',
      'checked_in_at',(select checked_in_at from public.check_ins where registration_id = p_registration));
  end if;

  insert into public.check_ins(registration_id,checked_in_by,no_entry,notes)
    values (p_registration, auth.uid(), p_no_entry, p_notes);

  update public.guest_registrations
    set status = case when p_no_entry then 'no_entry'::guest_status else 'checked_in'::guest_status end
    where id = p_registration;

  perform public.log_action(
    case when p_no_entry then 'guest_no_entry' else 'guest_checked_in' end,
    auth.uid(), reg.venue_id, reg.event_id, reg.promoter_id, reg.guest_id, p_notes);

  return json_build_object('ok',true,'no_entry',p_no_entry);
end $$;

-- ---------- Public guest registration RPC (no auth; used by /p/{code}) ----------
create or replace function public.register_guest(
  p_promoter_code text, p_event_id uuid,
  p_first text, p_last text, p_mobile text, p_email text,
  p_dob date, p_instagram text, p_marketing boolean
) returns json language plpgsql security definer set search_path = public as $$
declare
  prom record; ev record; g_id uuid; existing uuid; reg record;
begin
  select * into prom from public.promoters where promoter_code = p_promoter_code and status = 'approved';
  if prom is null then return json_build_object('ok',false,'error','promoter_not_found'); end if;

  select * into ev from public.events where id = p_event_id and active = true;
  if ev is null then return json_build_object('ok',false,'error','event_not_found'); end if;
  if not ev.guestlist_open or (ev.cutoff_at is not null and now() > ev.cutoff_at) then
    return json_build_object('ok',false,'error','guestlist_closed');
  end if;

  -- find or create guest by mobile (or email)
  select id into g_id from public.guests
    where mobile = p_mobile or (p_email is not null and email = p_email::citext) limit 1;
  if g_id is null then
    insert into public.guests(first_name,last_name,mobile,email,date_of_birth,instagram)
      values (p_first,p_last,p_mobile,nullif(p_email,''),p_dob,nullif(p_instagram,''))
      returning id into g_id;
  end if;

  -- prevent duplicate registration for same event
  select id into existing from public.guest_registrations where event_id = p_event_id and guest_id = g_id;
  if existing is not null then
    return json_build_object('ok',false,'error','duplicate','registration_id',existing);
  end if;

  insert into public.guest_registrations(guest_id,promoter_id,event_id,venue_id,marketing_consent)
    values (g_id, prom.id, p_event_id, ev.venue_id, coalesce(p_marketing,false))
    returning * into reg;

  perform public.log_action('guest_registered', null, ev.venue_id, p_event_id, prom.id, g_id, null);

  return json_build_object('ok',true,'registration_id',reg.id,'qr_token',reg.qr_token,
    'promoter_name',prom.full_name,'event_name',ev.name);
end $$;

-- ---------- Public promoter signup RPC ----------
create or replace function public.submit_promoter_application(
  p_full_name text, p_mobile text, p_email text, p_dob date,
  p_instagram text, p_tiktok text, p_facebook text, p_suburb text,
  p_preferred_venue uuid, p_other_venues uuid[],
  p_agreement boolean, p_marketing boolean, p_ip text
) returns json language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if p_dob is null or p_dob > (current_date - interval '18 years') then
    return json_build_object('ok',false,'error','under_18');
  end if;
  if not p_agreement then
    return json_build_object('ok',false,'error','agreement_required');
  end if;
  if exists(select 1 from public.promoters where email = p_email::citext) then
    return json_build_object('ok',false,'error','email_exists');
  end if;
  if exists(select 1 from public.promoters where mobile = p_mobile) then
    return json_build_object('ok',false,'error','mobile_exists');
  end if;

  insert into public.promoters(full_name,email,mobile,date_of_birth,instagram,tiktok,facebook,
      suburb,preferred_venue_id,other_venue_ids,agreement_accepted,agreement_accepted_at,
      signup_ip,marketing_consent,status)
  values (p_full_name,p_email::citext,p_mobile,p_dob,nullif(p_instagram,''),nullif(p_tiktok,''),
      nullif(p_facebook,''),nullif(p_suburb,''),p_preferred_venue,coalesce(p_other_venues,'{}'),
      true, now(), p_ip, coalesce(p_marketing,false),'pending')
  returning id into new_id;

  perform public.log_action('promoter_applied', null, null, null, new_id, null, null);
  return json_build_object('ok',true,'promoter_id',new_id);
end $$;

-- ---------- Public read of a registration by QR token (for /g/{token}) ----------
create or replace function public.get_registration_by_token(p_token text)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'id', gr.id, 'status', gr.status, 'qr_token', gr.qr_token,
    'first_name', g.first_name, 'last_name', g.last_name,
    'event_name', e.name, 'event_date', e.event_date,
    'start_time', e.start_time, 'end_time', e.end_time,
    'venue_name', v.name, 'promoter_name', p.full_name
  )
  from public.guest_registrations gr
  join public.guests g on g.id = gr.guest_id
  join public.events e on e.id = gr.event_id
  join public.venues v on v.id = gr.venue_id
  join public.promoters p on p.id = gr.promoter_id
  where gr.qr_token = p_token;
$$;

-- ---------- Check-in via QR token (reception scanner) ----------
create or replace function public.check_in_by_token(p_token text, p_no_entry boolean default false, p_notes text default null)
returns json language plpgsql security definer set search_path = public as $$
declare rid uuid;
begin
  select id into rid from public.guest_registrations where qr_token = p_token;
  if rid is null then return json_build_object('ok',false,'error','not_found'); end if;
  return public.check_in_guest(rid, p_no_entry, p_notes);
end $$;
