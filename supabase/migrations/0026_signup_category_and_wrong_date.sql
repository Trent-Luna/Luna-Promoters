-- =====================================================================
-- Luna Promoters :: 0026
--  1) Applicants pick a category (promoter | dj | staff) at sign-up.
--  2) Door scanner rejects a QR that's for a different date (WRONG DATE).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) submit_promoter_application now accepts p_category
-- ---------------------------------------------------------------------
drop function if exists public.submit_promoter_application(text,text,text,date,text,text,text,text,uuid,uuid[],boolean,boolean,text,text);
create or replace function public.submit_promoter_application(
  p_full_name text, p_mobile text, p_email text, p_dob date,
  p_instagram text, p_tiktok text, p_facebook text, p_suburb text,
  p_preferred_venue uuid, p_other_venues uuid[],
  p_agreement boolean, p_marketing boolean, p_ip text,
  p_ref_code text default null, p_category text default 'promoter'
) returns json language plpgsql security definer set search_path = public as $$
declare new_id uuid; auto boolean; code text; ref_id uuid; cat text;
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

  cat := lower(coalesce(nullif(p_category,''),'promoter'));
  if cat not in ('promoter','dj','staff') then cat := 'promoter'; end if;

  if p_ref_code is not null and p_ref_code <> '' then
    select id into ref_id from public.promoters where promoter_code = p_ref_code and status = 'approved';
  end if;

  select auto_approve_promoters into auto from public.app_settings where id = 1;
  auto := coalesce(auto, false);
  if auto then code := public.generate_promoter_code(p_full_name); end if;

  insert into public.promoters(full_name,email,mobile,date_of_birth,instagram,tiktok,facebook,
      suburb,preferred_venue_id,other_venue_ids,agreement_accepted,agreement_accepted_at,
      signup_ip,marketing_consent,status,promoter_code,approved_at,referred_by,category)
  values (p_full_name,p_email::citext,p_mobile,p_dob,nullif(p_instagram,''),nullif(p_tiktok,''),
      nullif(p_facebook,''),nullif(p_suburb,''),p_preferred_venue,coalesce(p_other_venues,'{}'),
      true, now(), p_ip, coalesce(p_marketing,false),
      case when auto then 'approved'::promoter_status else 'pending'::promoter_status end,
      code, case when auto then now() else null end, ref_id, cat)
  returning id into new_id;

  if auto then perform public.award_referral(new_id); end if;

  perform public.log_action(case when auto then 'promoter_auto_approved' else 'promoter_applied' end,
    null, null, null, new_id, null, null);
  return json_build_object('ok',true,'promoter_id',new_id,'auto_approved',auto,'promoter_code',code);
end $$;
grant execute on function public.submit_promoter_application(text,text,text,date,text,text,text,text,uuid,uuid[],boolean,boolean,text,text,text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 2) check_in_by_token compares the QR's event date to the door's date
-- ---------------------------------------------------------------------
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
  return public.check_in_guest(rid, p_no_entry, p_notes);
end $$;
grant execute on function public.check_in_by_token(text,boolean,text,date) to authenticated;
