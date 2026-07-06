-- =====================================================================
-- Luna Promoters :: 0032 Track how a guest was checked in
-- method = 'scan' (QR scanned) or 'manual' (checked in from the list).
-- Existing rows stay null (shown as "—").
-- =====================================================================

alter table public.check_ins add column if not exists method text;

-- check_in_guest records the method (defaults to manual).
-- Drop the old 3-arg overload so the manual list button uses this version.
drop function if exists public.check_in_guest(uuid,boolean,text);
create or replace function public.check_in_guest(
  p_registration uuid, p_no_entry boolean default false, p_notes text default null,
  p_method text default 'manual'
) returns json language plpgsql security definer set search_path = public as $$
declare reg record; already boolean;
begin
  select gr.*, e.venue_id as ev_venue, (g.first_name || ' ' || g.last_name) as guest_name
    into reg
    from public.guest_registrations gr
    join public.events e on e.id = gr.event_id
    join public.guests g on g.id = gr.guest_id
    where gr.id = p_registration;
  if reg is null then return json_build_object('ok',false,'error','registration_not_found'); end if;
  if not public.manages_venue(reg.venue_id) then
    return json_build_object('ok',false,'error','not_authorised'); end if;

  select exists(select 1 from public.check_ins c where c.registration_id = p_registration) into already;
  if already then
    return json_build_object('ok',false,'error','already_checked_in','guest_name',reg.guest_name,
      'checked_in_at',(select checked_in_at from public.check_ins where registration_id = p_registration));
  end if;

  insert into public.check_ins(registration_id,checked_in_by,no_entry,notes,method)
    values (p_registration, auth.uid(), p_no_entry, p_notes, coalesce(nullif(p_method,''),'manual'));
  update public.guest_registrations
    set status = case when p_no_entry then 'no_entry'::guest_status else 'checked_in'::guest_status end
    where id = p_registration;
  perform public.log_action(case when p_no_entry then 'guest_no_entry' else 'guest_checked_in' end,
    auth.uid(), reg.venue_id, reg.event_id, reg.promoter_id, reg.guest_id, p_notes);
  return json_build_object('ok',true,'no_entry',p_no_entry,'guest_name',reg.guest_name);
end $$;
grant execute on function public.check_in_guest(uuid,boolean,text,text) to authenticated;

-- Scans go through check_in_by_token -> mark them as 'scan'.
drop function if exists public.check_in_by_token(text,boolean,text);
create or replace function public.check_in_by_token(
  p_token text, p_no_entry boolean default false, p_notes text default null,
  p_expected_date date default null
) returns json language plpgsql security definer set search_path = public as $$
declare rid uuid; ev_date date; gname text;
begin
  select gr.id, e.event_date, (g.first_name || ' ' || g.last_name)
    into rid, ev_date, gname
    from public.guest_registrations gr
    join public.events e on e.id = gr.event_id
    join public.guests g on g.id = gr.guest_id
    where gr.qr_token = p_token;
  if rid is null then return json_build_object('ok',false,'error','not_found'); end if;
  if p_expected_date is not null and ev_date <> p_expected_date then
    return json_build_object('ok',false,'error','wrong_date','guest_name',gname,'event_date',ev_date);
  end if;
  return public.check_in_guest(rid, p_no_entry, p_notes, 'scan');
end $$;
grant execute on function public.check_in_by_token(text,boolean,text,date) to authenticated;
