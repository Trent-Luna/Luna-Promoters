-- =====================================================================
-- Luna Promoters :: 0014 Auto-approve setting for promoter sign-ups
-- =====================================================================

create table if not exists public.app_settings (
  id int primary key default 1,
  auto_approve_promoters boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint app_settings_single check (id = 1)
);
insert into public.app_settings (id) values (1) on conflict (id) do nothing;

alter table public.app_settings enable row level security;
drop policy if exists settings_read on public.app_settings;
drop policy if exists settings_admin on public.app_settings;
create policy settings_read  on public.app_settings for select using (auth.uid() is not null);
create policy settings_admin on public.app_settings for all
  using (public.is_admin()) with check (public.is_admin());

-- rebuild the application RPC to honour the auto-approve setting
create or replace function public.submit_promoter_application(
  p_full_name text, p_mobile text, p_email text, p_dob date,
  p_instagram text, p_tiktok text, p_facebook text, p_suburb text,
  p_preferred_venue uuid, p_other_venues uuid[],
  p_agreement boolean, p_marketing boolean, p_ip text
) returns json language plpgsql security definer set search_path = public as $$
declare new_id uuid; auto boolean; code text;
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

  select auto_approve_promoters into auto from public.app_settings where id = 1;
  auto := coalesce(auto, false);

  if auto then code := public.generate_promoter_code(p_full_name); end if;

  insert into public.promoters(full_name,email,mobile,date_of_birth,instagram,tiktok,facebook,
      suburb,preferred_venue_id,other_venue_ids,agreement_accepted,agreement_accepted_at,
      signup_ip,marketing_consent,status,promoter_code,approved_at)
  values (p_full_name,p_email::citext,p_mobile,p_dob,nullif(p_instagram,''),nullif(p_tiktok,''),
      nullif(p_facebook,''),nullif(p_suburb,''),p_preferred_venue,coalesce(p_other_venues,'{}'),
      true, now(), p_ip, coalesce(p_marketing,false),
      case when auto then 'approved'::promoter_status else 'pending'::promoter_status end,
      code, case when auto then now() else null end)
  returning id into new_id;

  perform public.log_action(case when auto then 'promoter_auto_approved' else 'promoter_applied' end,
    null, null, null, new_id, null, null);

  return json_build_object('ok',true,'promoter_id',new_id,'auto_approved',auto,'promoter_code',code);
end $$;

grant execute on function public.submit_promoter_application(text,text,text,date,text,text,text,text,uuid,uuid[],boolean,boolean,text) to anon, authenticated;
