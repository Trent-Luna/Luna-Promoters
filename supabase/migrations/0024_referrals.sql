-- =====================================================================
-- Luna Promoters :: 0024 Referral program
-- A promoter refers a friend; when that friend is approved, the referrer
-- gets +3 "checked-in" credit toward their monthly tier.
-- =====================================================================

alter table public.promoters add column if not exists referred_by uuid references public.promoters(id);
alter table public.promoters add column if not exists referral_awarded boolean not null default false;
alter table public.promoter_performance add column if not exists bonus_checked_in int not null default 0;

-- tier now considers real check-ins + referral bonus for the month
create or replace function public.refresh_promoter_month(p_promoter uuid, p_month date)
returns void language plpgsql security definer set search_path = public as $$
declare
  m date := date_trunc('month', p_month)::date;
  reg int; ci int; noent int; bonus int; effective int; new_tier tier_name; is_elite boolean;
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
        updated_at=now();  -- bonus_checked_in intentionally preserved

  select bonus_checked_in into bonus from public.promoter_performance
    where promoter_id = p_promoter and period_month = m;
  effective := coalesce(ci,0) + coalesce(bonus,0);

  select elite_override into is_elite from public.promoters where id = p_promoter;
  if is_elite then
    new_tier := 'elite';
  else
    select t.name into new_tier from public.tiers t
      where t.invite_only = false
        and effective >= coalesce(t.min_guests,0)
        and (t.max_guests is null or effective <= t.max_guests)
      order by t.min_guests desc nulls last limit 1;
    if new_tier is null then new_tier := 'bronze'; end if;
  end if;

  if m = date_trunc('month', now())::date then
    update public.promoters set current_tier = new_tier where id = p_promoter;
  end if;
end $$;

-- award the referral bonus once, when the referred promoter is approved
create or replace function public.award_referral(p_referred uuid)
returns void language plpgsql security definer set search_path = public as $$
declare rby uuid; awarded boolean; m date := date_trunc('month', now())::date;
begin
  select referred_by, referral_awarded into rby, awarded from public.promoters where id = p_referred;
  if rby is null or awarded then return; end if;

  insert into public.promoter_performance(promoter_id, period_month, bonus_checked_in)
    values (rby, m, 3)
    on conflict (promoter_id, period_month)
    do update set bonus_checked_in = public.promoter_performance.bonus_checked_in + 3;

  update public.promoters set referral_awarded = true where id = p_referred;
  perform public.refresh_promoter_month(rby, current_date);
  perform public.log_action('referral_awarded', null, null, null, rby, null, 'referred ' || p_referred::text);
end $$;

-- approve_promoter now also awards any pending referral
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
  perform public.award_referral(p_id);
  perform public.log_action('promoter_approved', auth.uid(), null, null, p_id, null, null);
  return code;
end $$;
grant execute on function public.approve_promoter(uuid) to authenticated;
grant execute on function public.award_referral(uuid) to authenticated;

-- signup RPC accepts an optional referral code and links referred_by
drop function if exists public.submit_promoter_application(text,text,text,date,text,text,text,text,uuid,uuid[],boolean,boolean,text);
create or replace function public.submit_promoter_application(
  p_full_name text, p_mobile text, p_email text, p_dob date,
  p_instagram text, p_tiktok text, p_facebook text, p_suburb text,
  p_preferred_venue uuid, p_other_venues uuid[],
  p_agreement boolean, p_marketing boolean, p_ip text, p_ref_code text default null
) returns json language plpgsql security definer set search_path = public as $$
declare new_id uuid; auto boolean; code text; ref_id uuid;
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

  if p_ref_code is not null and p_ref_code <> '' then
    select id into ref_id from public.promoters where promoter_code = p_ref_code and status = 'approved';
  end if;

  select auto_approve_promoters into auto from public.app_settings where id = 1;
  auto := coalesce(auto, false);
  if auto then code := public.generate_promoter_code(p_full_name); end if;

  insert into public.promoters(full_name,email,mobile,date_of_birth,instagram,tiktok,facebook,
      suburb,preferred_venue_id,other_venue_ids,agreement_accepted,agreement_accepted_at,
      signup_ip,marketing_consent,status,promoter_code,approved_at,referred_by)
  values (p_full_name,p_email::citext,p_mobile,p_dob,nullif(p_instagram,''),nullif(p_tiktok,''),
      nullif(p_facebook,''),nullif(p_suburb,''),p_preferred_venue,coalesce(p_other_venues,'{}'),
      true, now(), p_ip, coalesce(p_marketing,false),
      case when auto then 'approved'::promoter_status else 'pending'::promoter_status end,
      code, case when auto then now() else null end, ref_id)
  returning id into new_id;

  if auto then perform public.award_referral(new_id); end if;

  perform public.log_action(case when auto then 'promoter_auto_approved' else 'promoter_applied' end,
    null, null, null, new_id, null, null);
  return json_build_object('ok',true,'promoter_id',new_id,'auto_approved',auto,'promoter_code',code);
end $$;
grant execute on function public.submit_promoter_application(text,text,text,date,text,text,text,text,uuid,uuid[],boolean,boolean,text,text) to anon, authenticated;

-- expose the referrer's own referral stats + bonus on the dashboard
create or replace function public.get_my_referrals(p_promoter uuid)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'total', (select count(*) from public.promoters where referred_by = p_promoter),
    'approved', (select count(*) from public.promoters where referred_by = p_promoter and status = 'approved'),
    'bonus_this_month', (select coalesce(bonus_checked_in,0) from public.promoter_performance
                         where promoter_id = p_promoter and period_month = date_trunc('month', now())::date)
  );
$$;
grant execute on function public.get_my_referrals(uuid) to authenticated;
