-- A crew is ten people, the host included (25 Oct 2026).
--
-- Trent: "make the limit 10". 0053 let a crew link take up to 40 while the
-- pass page's "Add a friend" (add_group_guest, 0042) stops a group at 10. Both
-- now stop at 10, counted the same way: everyone in the group, host included.
-- No crew existed yet when this was applied, so nothing is over the limit.

alter table public.guest_registrations drop constraint if exists guest_registrations_crew_size_chk;
alter table public.guest_registrations
  add constraint guest_registrations_crew_size_chk check (crew_size is null or crew_size between 1 and 10);

create or replace function public.set_crew_details(p_token text, p_honoree text default null, p_crew_size int default null)
returns json language plpgsql security definer set search_path to 'public' as $$
declare r record; code text;
begin
  select gr.*, e.event_date into r
    from public.guest_registrations gr join public.events e on e.id = gr.event_id
    where gr.qr_token = p_token;
  if r is null then return json_build_object('ok',false,'error','not_found'); end if;
  if coalesce(r.special_occasion,'') not in ('Birthday','Hens party','Bucks party') then
    return json_build_object('ok',false,'error','not_occasion'); end if;
  if r.group_id is not null and r.group_id <> r.id then
    return json_build_object('ok',false,'error','not_host'); end if;
  if r.status = 'cancelled' then return json_build_object('ok',false,'error','cancelled'); end if;

  code := coalesce(r.crew_code, public.new_crew_code());
  update public.guest_registrations set
      crew_code = code,
      group_id = id,
      honoree_name = coalesce(nullif(left(btrim(coalesce(p_honoree,'')), 40), ''), honoree_name),
      crew_size = coalesce(case when p_crew_size between 1 and 10 then p_crew_size end, crew_size)
    where id = r.id;
  return json_build_object('ok',true,'crew_code',code);
end $$;

create or replace function public.join_crew(
  p_code text, p_first text, p_last text, p_mobile text, p_email text,
  p_dob date default null, p_instagram text default null, p_marketing boolean default false)
returns json language plpgsql security definer set search_path to 'public' as $$
declare host record; g_id uuid; existing uuid; reg record; members int; v_email text; cut timestamptz;
begin
  select gr.*, e.event_date into host
    from public.guest_registrations gr join public.events e on e.id = gr.event_id
    where gr.crew_code = upper(btrim(p_code));
  if host is null then return json_build_object('ok',false,'error','not_found'); end if;
  if host.status = 'cancelled' then return json_build_object('ok',false,'error','cancelled'); end if;
  if host.event_date < (now() at time zone 'Australia/Brisbane')::date then
    return json_build_object('ok',false,'error','past_event'); end if;
  cut := public.guestlist_cutoff(host.venue_id, host.event_date);
  if cut is not null and now() >= cut then
    return json_build_object('ok',false,'error','guestlist_closed','closes_at',cut); end if;

  if p_first is null or btrim(p_first) = '' or p_mobile is null
     or length(regexp_replace(p_mobile, '\D', '', 'g')) < 8 then
    return json_build_object('ok',false,'error','bad_input'); end if;
  v_email := lower(btrim(coalesce(p_email, '')));
  if v_email = '' then return json_build_object('ok',false,'error','email_required'); end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[A-Za-z]{2,}$' then
    return json_build_object('ok',false,'error','bad_email'); end if;

  -- Ten in a group, host included: the same count add_group_guest uses.
  select count(*) into members from public.guest_registrations where group_id = host.id;
  if members >= 10 then return json_build_object('ok',false,'error','crew_full'); end if;

  select id into g_id from public.guests
    where mobile = btrim(p_mobile) or email = v_email::citext limit 1;
  if g_id is null then
    insert into public.guests(first_name,last_name,mobile,email,date_of_birth,instagram)
      values (btrim(p_first), coalesce(btrim(p_last), ''), btrim(p_mobile), v_email, p_dob, nullif(btrim(coalesce(p_instagram,'')),''))
      returning id into g_id;
  else
    update public.guests set
        email = case when email is null or email::text = '' then v_email::citext else email end,
        date_of_birth = coalesce(date_of_birth, p_dob),
        instagram = coalesce(nullif(instagram,''), nullif(btrim(coalesce(p_instagram,'')),''))
      where id = g_id;
  end if;

  select id into existing from public.guest_registrations where event_id = host.event_id and guest_id = g_id;
  if existing is not null then return json_build_object('ok',false,'error','duplicate'); end if;

  insert into public.guest_registrations(guest_id,promoter_id,event_id,venue_id,marketing_consent,special_occasion,source,group_id,invited_by)
    values (g_id, host.promoter_id, host.event_id, host.venue_id, coalesce(p_marketing,false), null, host.source, host.id, host.id)
    returning * into reg;
  perform public.log_action('guest_registered', null, host.venue_id, host.event_id, host.promoter_id, g_id, 'crew link');
  return json_build_object('ok',true,'registration_id',reg.id,'qr_token',reg.qr_token);
end $$;

-- get_crew gains 'full' so the friend's page says so before they type anything.
create or replace function public.get_crew(p_code text)
returns json language sql stable security definer set search_path to 'public' as $$
  select json_build_object(
    'host_first', g.first_name, 'honoree_name', gr.honoree_name, 'occasion', gr.special_occasion,
    'crew_size', gr.crew_size,
    'venue_id', v.id, 'venue_name', v.name, 'venue_slug', v.slug, 'guestlist_until', v.guestlist_until,
    'event_date', e.event_date, 'start_time', e.start_time,
    'joined', (select count(*) from public.guest_registrations m
                where m.group_id = gr.id and m.id <> gr.id and m.status <> 'cancelled'),
    'state', case
      when gr.status = 'cancelled' then 'cancelled'
      when e.event_date < (now() at time zone 'Australia/Brisbane')::date then 'past'
      when public.guestlist_cutoff(v.id, e.event_date) is not null
           and now() >= public.guestlist_cutoff(v.id, e.event_date) then 'closed'
      when (select count(*) from public.guest_registrations m where m.group_id = gr.id) >= 10 then 'full'
      else 'open' end
  )
  from public.guest_registrations gr
  join public.guests g on g.id = gr.guest_id
  join public.events e on e.id = gr.event_id
  join public.venues v on v.id = gr.venue_id
  where gr.crew_code = upper(btrim(p_code));
$$;
