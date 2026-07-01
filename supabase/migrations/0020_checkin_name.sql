-- =====================================================================
-- Luna Promoters :: 0020 Return guest name from check-in (for door flash)
-- =====================================================================

create or replace function public.check_in_guest(p_registration uuid, p_no_entry boolean default false, p_notes text default null)
returns json language plpgsql security definer set search_path = public as $$
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

  insert into public.check_ins(registration_id,checked_in_by,no_entry,notes)
    values (p_registration, auth.uid(), p_no_entry, p_notes);
  update public.guest_registrations
    set status = case when p_no_entry then 'no_entry'::guest_status else 'checked_in'::guest_status end
    where id = p_registration;
  perform public.log_action(case when p_no_entry then 'guest_no_entry' else 'guest_checked_in' end,
    auth.uid(), reg.venue_id, reg.event_id, reg.promoter_id, reg.guest_id, p_notes);
  return json_build_object('ok',true,'no_entry',p_no_entry,'guest_name',reg.guest_name);
end $$;
