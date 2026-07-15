-- ============================================================================
-- 0039_university_rpcs.sql  — SECURITY DEFINER RPCs + private storage bucket.
-- Companion to 0038. Full bodies (applied verbatim to fiquraregaucwnrjhwqx).
-- ============================================================================

-- submit_university_application ------------------------------------------------
create or replace function public.submit_university_application(
  p_full_name text, p_mobile text, p_email text, p_dob date, p_expiry_date date,
  p_storage_path text, p_mime text default null, p_bytes int default null,
  p_agreement boolean default false, p_id_confirm boolean default false, p_marketing boolean default false)
returns json language plpgsql security definer set search_path to 'public' as $$
declare
  v_email_norm text := lower(nullif(btrim(p_email),''));
  v_mobile_norm text := nullif(regexp_replace(coalesce(p_mobile,''),'[^0-9]','','g'),'');
  v_contact contacts%rowtype; v_type_id uuid; v_membership memberships%rowtype;
  v_dup boolean := false; v_ver_id uuid;
begin
  if p_dob is null or p_dob > (current_date - interval '18 years') then
    return json_build_object('ok',false,'error','under_18'); end if;
  if not coalesce(p_agreement,false) or not coalesce(p_id_confirm,false) then
    return json_build_object('ok',false,'error','consent_required'); end if;
  if p_storage_path is null or btrim(p_storage_path)='' then
    return json_build_object('ok',false,'error','document_required'); end if;

  select id into v_type_id from membership_types where key='university';

  select * into v_contact from contacts
   where (v_email_norm is not null and email_norm=v_email_norm)
      or (v_mobile_norm is not null and mobile_norm=v_mobile_norm)
   order by (email_norm=v_email_norm) desc nulls last, created_at limit 1;

  if v_contact.id is null then
    insert into contacts(full_name,email,mobile,date_of_birth)
      values (p_full_name, nullif(p_email,'')::citext, p_mobile, p_dob) returning * into v_contact;
  else v_dup := true; end if;

  select * into v_membership from memberships
   where contact_id=v_contact.id and membership_type_id=v_type_id order by created_at desc limit 1;

  if v_membership.id is not null then
    if v_membership.status='approved' then
      return json_build_object('ok',true,'already','approved','membership_id',v_membership.id,
        'pass_token',v_membership.pass_token,'status',v_membership.status);
    elsif v_membership.status='pending_verification' then null;
    else
      update memberships set status='pending_verification', marketing_consent=coalesce(p_marketing,false)
        where id=v_membership.id returning * into v_membership;
    end if;
  else
    insert into memberships(contact_id,membership_type_id,status,marketing_consent,membership_number)
      values (v_contact.id,v_type_id,'pending_verification',coalesce(p_marketing,false),
              generate_membership_number('university')) returning * into v_membership;
  end if;

  insert into membership_documents(membership_id,kind,storage_path,mime_type,byte_size)
    values (v_membership.id,'university_id',p_storage_path,p_mime,p_bytes);
  insert into university_verifications(membership_id,submitted_full_name,submitted_dob,
      submitted_expiry_date,document_storage_path)
    values (v_membership.id,p_full_name,p_dob,p_expiry_date,p_storage_path) returning id into v_ver_id;
  insert into membership_audit_log(membership_id,action,new_status,note,meta)
    values (v_membership.id,'application_submitted','pending_verification',
            case when v_dup then 'Possible existing contact matched' else null end,
            json_build_object('duplicate_contact',v_dup));

  return json_build_object('ok',true,'membership_id',v_membership.id,'verification_id',v_ver_id,
    'pass_token',v_membership.pass_token,'status',v_membership.status,'duplicate_contact',v_dup);
end $$;

-- apply_university_verification (AUTHORITATIVE decision engine) -----------------
create or replace function public.apply_university_verification(
  p_membership uuid, p_extraction jsonb, p_raw jsonb default null,
  p_provider text default 'openai', p_model text default 'gpt-4o')
returns json language plpgsql security definer set search_path to 'public' as $$
declare
  v_ver university_verifications%rowtype; v_m memberships%rowtype;
  v_score int; v_is_uni boolean; v_current boolean; v_clear boolean;
  v_namem boolean; v_expm boolean; v_tamper boolean; v_exp date; v_inst text; v_exname text;
  v_new public.membership_status; v_reasons jsonb := coalesce(p_extraction->'review_reasons','[]'::jsonb);
  v_summary text := nullif(p_extraction->>'verification_summary',''); v_prev public.membership_status;
begin
  select * into v_m from memberships where id=p_membership;
  if v_m.id is null then return json_build_object('ok',false,'error','not_found'); end if;
  v_prev := v_m.status;
  select * into v_ver from university_verifications where membership_id=p_membership order by created_at desc limit 1;
  if v_ver.id is null then return json_build_object('ok',false,'error','no_verification'); end if;

  v_score := safe_int(p_extraction->>'confidence_score');
  v_is_uni := (p_extraction->>'is_university_id')::boolean;
  v_current := (p_extraction->>'is_current')::boolean;
  v_clear := (p_extraction->>'image_is_clear')::boolean;
  v_namem := (p_extraction->>'name_matches')::boolean;
  v_expm := (p_extraction->>'expiry_matches')::boolean;
  v_tamper := (p_extraction->>'possible_tampering')::boolean;
  v_exp := safe_date(p_extraction->>'extracted_expiry_date');
  v_inst := nullif(p_extraction->>'institution_name','');
  v_exname := nullif(p_extraction->>'extracted_name','');

  if p_extraction is null or v_score is null or (p_extraction ? 'is_university_id') is false then
    v_new := 'manual_review'; v_reasons := '["ai_response_invalid"]'::jsonb;
    v_summary := coalesce(v_summary,'AI verification response was invalid or incomplete.');
  elsif v_is_uni is false then
    v_new := 'rejected'; v_summary := coalesce(v_summary,'Uploaded document does not appear to be a university/tertiary ID.');
  elsif v_exp is not null and v_exp < current_date then
    v_new := 'rejected'; v_summary := coalesce(v_summary,'University ID appears to be expired.');
  elsif v_ver.submitted_dob is not null and v_ver.submitted_dob > (current_date - interval '18 years') then
    v_new := 'rejected'; v_summary := 'Applicant is under 18.';
  elsif v_score >= 71 and coalesce(v_is_uni,false) and coalesce(v_current,false)
        and coalesce(v_namem,false) and coalesce(v_expm,false)
        and not coalesce(v_tamper,false) and coalesce(v_clear,false) then
    v_new := 'approved';
  else v_new := 'manual_review'; end if;

  update university_verifications set
    extracted_name=v_exname, extracted_institution=v_inst, extracted_expiry_date=v_exp,
    is_university_id=v_is_uni, is_current=v_current, image_is_clear=v_clear,
    name_matches=v_namem, expiry_matches=v_expm, possible_tampering=v_tamper,
    confidence_score=v_score, verification_summary=v_summary, review_reasons=v_reasons,
    raw_provider_response=p_raw, verification_provider=p_provider, verification_model=p_model, verified_at=now()
    where id=v_ver.id;
  update memberships set status=v_new,
    approved_at=case when v_new='approved' then now() else approved_at end,
    rejection_reason=case when v_new='rejected' then v_summary else rejection_reason end,
    membership_number=coalesce(membership_number, generate_membership_number('university'))
    where id=v_m.id;
  insert into membership_audit_log(membership_id,action,previous_status,new_status,note,meta)
    values (v_m.id,'ai_verified',v_prev,v_new,v_summary,json_build_object('confidence_score',v_score));
  perform log_action('university_ai_verified',null,null,null,null,null,v_summary);
  return json_build_object('ok',true,'status',v_new,'confidence_score',v_score,'summary',v_summary,
    'pass_token',v_m.pass_token,'membership_id',v_m.id);
end $$;

-- get_membership_pass ----------------------------------------------------------
create or replace function public.get_membership_pass(p_token text)
returns json language sql stable security definer set search_path to 'public' as $$
  select json_build_object('ok',true,'full_name',c.full_name,'membership_type',mt.label,
    'membership_type_key',mt.key,'membership_number',m.membership_number,'status',m.status,
    'approved',(m.status='approved'),'approved_at',m.approved_at,'pass_token',m.pass_token,
    'institution',v.extracted_institution,
    'expiry_date',coalesce(v.submitted_expiry_date,v.extracted_expiry_date))
  from memberships m join contacts c on c.id=m.contact_id
  join membership_types mt on mt.id=m.membership_type_id
  left join lateral (select extracted_institution,submitted_expiry_date,extracted_expiry_date
    from university_verifications uv where uv.membership_id=m.id order by created_at desc limit 1) v on true
  where m.pass_token=p_token;
$$;

-- verify_membership_for_reception ----------------------------------------------
create or replace function public.verify_membership_for_reception(p_token text, p_venue uuid)
returns json language plpgsql stable security definer set search_path to 'public' as $$
declare v_m memberships%rowtype; v_td date := luna_trading_date(now());
        v_inst text; v_exp date; v_name text; v_type text; v_wb wristband_issuances%rowtype; v_by text;
begin
  if not manages_venue(p_venue) then return json_build_object('ok',false,'error','not_authorised'); end if;
  select * into v_m from memberships where pass_token=p_token;
  if v_m.id is null then return json_build_object('ok',false,'error','not_found'); end if;
  select c.full_name, mt.label into v_name, v_type from contacts c, membership_types mt
    where c.id=v_m.contact_id and mt.id=v_m.membership_type_id;
  select extracted_institution, coalesce(submitted_expiry_date,extracted_expiry_date) into v_inst,v_exp
    from university_verifications where membership_id=v_m.id order by created_at desc limit 1;
  select * into v_wb from wristband_issuances
    where membership_id=v_m.id and venue_id=p_venue and trading_date=v_td order by issued_at desc limit 1;
  if v_wb.id is not null then select full_name into v_by from users where id=v_wb.issued_by; end if;
  return json_build_object('ok',true,'full_name',v_name,'membership_type',v_type,'institution',v_inst,
    'expiry_date',v_exp,'status',v_m.status,'approved',(v_m.status='approved'),
    'membership_number',v_m.membership_number,'wristband_issued',(v_wb.id is not null),
    'wristband_issued_at',v_wb.issued_at,'wristband_issued_by',v_by,'trading_date',v_td);
end $$;

-- issue_wristband --------------------------------------------------------------
create or replace function public.issue_wristband(
  p_token text, p_venue uuid, p_note text default null, p_override boolean default false)
returns json language plpgsql security definer set search_path to 'public' as $$
declare v_m memberships%rowtype; v_td date := luna_trading_date(now());
        v_existing wristband_issuances%rowtype; v_by text; v_id uuid;
begin
  if not manages_venue(p_venue) then return json_build_object('ok',false,'error','not_authorised'); end if;
  select * into v_m from memberships where pass_token=p_token;
  if v_m.id is null then return json_build_object('ok',false,'error','not_found'); end if;
  if v_m.status <> 'approved' then return json_build_object('ok',false,'error','not_approved','status',v_m.status); end if;
  select * into v_existing from wristband_issuances
    where membership_id=v_m.id and venue_id=p_venue and trading_date=v_td and is_override=false
    order by issued_at desc limit 1;
  if v_existing.id is not null and not coalesce(p_override,false) then
    select full_name into v_by from users where id=v_existing.issued_by;
    return json_build_object('ok',false,'error','already_issued','issued_at',v_existing.issued_at,'issued_by',v_by);
  end if;
  if coalesce(p_override,false) and v_existing.id is not null then
    if not (is_admin() or has_role('venue_manager')) then
      return json_build_object('ok',false,'error','override_not_authorised'); end if;
    if p_note is null or btrim(p_note)='' then return json_build_object('ok',false,'error','reason_required'); end if;
    insert into wristband_issuances(membership_id,venue_id,membership_type,trading_date,issued_by,note,
        is_override,override_reason,override_by)
      values (v_m.id,p_venue,'university',v_td,auth.uid(),p_note,true,p_note,auth.uid()) returning id into v_id;
    insert into membership_audit_log(membership_id,action,note,meta)
      values (v_m.id,'wristband_override',p_note,json_build_object('venue',p_venue,'trading_date',v_td));
    return json_build_object('ok',true,'override',true,'issuance_id',v_id,'issued_at',now());
  end if;
  insert into wristband_issuances(membership_id,venue_id,membership_type,trading_date,issued_by,note)
    values (v_m.id,p_venue,'university',v_td,auth.uid(),p_note) returning id into v_id;
  insert into membership_audit_log(membership_id,action,note,meta)
    values (v_m.id,'wristband_issued',p_note,json_build_object('venue',p_venue,'trading_date',v_td));
  return json_build_object('ok',true,'issuance_id',v_id,'issued_at',now());
end $$;

-- admin: stats / list / queue / review -----------------------------------------
create or replace function public.get_university_stats()
returns json language sql stable security definer set search_path to 'public' as $$
  select case when (is_admin() or has_role('venue_manager')) then json_build_object(
    'total',(select count(*) from memberships m join membership_types t on t.id=m.membership_type_id where t.key='university'),
    'approved',(select count(*) from memberships m join membership_types t on t.id=m.membership_type_id where t.key='university' and m.status='approved'),
    'pending_verification',(select count(*) from memberships m join membership_types t on t.id=m.membership_type_id where t.key='university' and m.status='pending_verification'),
    'manual_review',(select count(*) from memberships m join membership_types t on t.id=m.membership_type_id where t.key='university' and m.status='manual_review'),
    'rejected',(select count(*) from memberships m join membership_types t on t.id=m.membership_type_id where t.key='university' and m.status='rejected'),
    'suspended',(select count(*) from memberships m join membership_types t on t.id=m.membership_type_id where t.key='university' and m.status='suspended'),
    'wristbands_tonight',(select count(*) from wristband_issuances where trading_date=luna_trading_date(now())),
    'recent',(select coalesce(json_agg(r),'[]'::json) from (
        select m.id,c.full_name,m.status,m.created_at from memberships m
        join membership_types t on t.id=m.membership_type_id join contacts c on c.id=m.contact_id
        where t.key='university' order by m.created_at desc limit 8) r)
  ) else json_build_object('error','not_authorised') end;
$$;

create or replace function public.get_university_members(
  p_status text default null, p_institution text default null, p_search text default null,
  p_from date default null, p_to date default null, p_expiry_from date default null,
  p_expiry_to date default null, p_limit int default 200)
returns json language sql stable security definer set search_path to 'public' as $$
  select case when (is_admin() or has_role('venue_manager')) then coalesce((
    select json_agg(row) from (
      select m.id,m.membership_number,m.status,m.created_at,m.approved_at,m.pass_token,
             c.full_name,c.email::text as email,c.mobile,c.date_of_birth,
             v.extracted_institution, coalesce(v.submitted_expiry_date,v.extracted_expiry_date) as expiry_date,
             v.confidence_score
      from memberships m join membership_types t on t.id=m.membership_type_id and t.key='university'
      join contacts c on c.id=m.contact_id
      left join lateral (select * from university_verifications uv where uv.membership_id=m.id order by created_at desc limit 1) v on true
      where (p_status is null or m.status::text=p_status)
        and (p_institution is null or v.extracted_institution ilike '%'||p_institution||'%')
        and (p_search is null or c.full_name ilike '%'||p_search||'%' or c.email::text ilike '%'||p_search||'%' or c.mobile ilike '%'||p_search||'%')
        and (p_from is null or m.created_at >= p_from)
        and (p_to is null or m.created_at < (p_to+1))
        and (p_expiry_from is null or coalesce(v.submitted_expiry_date,v.extracted_expiry_date) >= p_expiry_from)
        and (p_expiry_to is null or coalesce(v.submitted_expiry_date,v.extracted_expiry_date) <= p_expiry_to)
      order by m.created_at desc limit greatest(1,coalesce(p_limit,200))
    ) row),'[]'::json) else '[]'::json end;
$$;

create or replace function public.get_university_review_queue()
returns json language sql stable security definer set search_path to 'public' as $$
  select case when (is_admin() or has_role('venue_manager')) then coalesce((
    select json_agg(row) from (
      select m.id as membership_id,m.membership_number,m.status,m.created_at,m.pass_token,
             c.full_name as submitted_full_name,c.email::text as email,c.mobile,c.date_of_birth,
             v.id as verification_id,v.submitted_expiry_date,v.extracted_name,v.extracted_institution,
             v.extracted_expiry_date,v.confidence_score,v.verification_summary,v.review_reasons,
             v.is_university_id,v.is_current,v.image_is_clear,v.name_matches,v.expiry_matches,
             v.possible_tampering,(v.document_storage_path is not null) as has_document
      from memberships m join membership_types t on t.id=m.membership_type_id and t.key='university'
      join contacts c on c.id=m.contact_id
      left join lateral (select * from university_verifications uv where uv.membership_id=m.id order by created_at desc limit 1) v on true
      where m.status='manual_review' order by m.created_at asc
    ) row),'[]'::json) else '[]'::json end;
$$;

create or replace function public.review_university_member(p_membership uuid, p_action text, p_reason text default null)
returns json language plpgsql security definer set search_path to 'public' as $$
declare v_m memberships%rowtype; v_prev public.membership_status; v_new public.membership_status;
begin
  if not (is_admin() or has_role('venue_manager')) then return json_build_object('ok',false,'error','not_authorised'); end if;
  select * into v_m from memberships where id=p_membership;
  if v_m.id is null then return json_build_object('ok',false,'error','not_found'); end if;
  v_prev := v_m.status;
  if p_action in ('reject','suspend') and (p_reason is null or btrim(p_reason)='') then
    return json_build_object('ok',false,'error','reason_required'); end if;
  if p_action='approve' then v_new:='approved';
  elsif p_action='reject' then v_new:='rejected';
  elsif p_action='suspend' then v_new:='suspended';
  elsif p_action='request_new_id' then v_new:='manual_review';
  else return json_build_object('ok',false,'error','bad_action'); end if;
  update memberships set status=v_new,
    approved_at=case when v_new='approved' then coalesce(approved_at,now()) else approved_at end,
    approved_by=case when v_new='approved' then auth.uid() else approved_by end,
    suspended_at=case when v_new='suspended' then now() else suspended_at end,
    rejection_reason=case when v_new='rejected' then p_reason else rejection_reason end,
    membership_number=coalesce(membership_number, generate_membership_number('university')) where id=v_m.id;
  update university_verifications set reviewed_by=auth.uid(), reviewed_at=now() where membership_id=v_m.id;
  insert into membership_audit_log(membership_id,actor_id,action,previous_status,new_status,note)
    values (v_m.id,auth.uid(),'manual_'||p_action,v_prev,v_new,p_reason);
  perform log_action('university_'||p_action,auth.uid(),null,null,null,null,p_reason);
  return json_build_object('ok',true,'status',v_new,'pass_token',v_m.pass_token);
end $$;

-- add_university_reupload ------------------------------------------------------
create or replace function public.add_university_reupload(
  p_token text, p_expiry date, p_storage_path text, p_mime text default null, p_bytes int default null)
returns json language plpgsql security definer set search_path to 'public' as $$
declare v_m memberships%rowtype; v_c contacts%rowtype; v_ver_id uuid;
begin
  select * into v_m from memberships where pass_token=p_token;
  if v_m.id is null then return json_build_object('ok',false,'error','not_found'); end if;
  if v_m.status='approved' then
    return json_build_object('ok',true,'already','approved','membership_id',v_m.id,'pass_token',v_m.pass_token); end if;
  select * into v_c from contacts where id=v_m.contact_id;
  update memberships set status='pending_verification' where id=v_m.id;
  insert into membership_documents(membership_id,kind,storage_path,mime_type,byte_size)
    values (v_m.id,'university_id',p_storage_path,p_mime,p_bytes);
  insert into university_verifications(membership_id,submitted_full_name,submitted_dob,submitted_expiry_date,document_storage_path)
    values (v_m.id,v_c.full_name,v_c.date_of_birth,coalesce(p_expiry,v_m.created_at::date),p_storage_path) returning id into v_ver_id;
  insert into membership_audit_log(membership_id,action,new_status,note)
    values (v_m.id,'id_reuploaded','pending_verification','Member uploaded a new ID');
  return json_build_object('ok',true,'membership_id',v_m.id,'verification_id',v_ver_id,'pass_token',v_m.pass_token);
end $$;

-- grants -----------------------------------------------------------------------
grant execute on function public.get_membership_pass(text) to anon, authenticated;
grant execute on function public.submit_university_application(text,text,text,date,date,text,text,int,boolean,boolean,boolean) to anon, authenticated, service_role;
grant execute on function public.apply_university_verification(uuid,jsonb,jsonb,text,text) to authenticated, service_role;
grant execute on function public.add_university_reupload(text,date,text,text,int) to anon, authenticated, service_role;
grant execute on function public.verify_membership_for_reception(text,uuid) to authenticated;
grant execute on function public.issue_wristband(text,uuid,text,boolean) to authenticated;
grant execute on function public.get_university_stats() to authenticated;
grant execute on function public.get_university_members(text,text,text,date,date,date,date,int) to authenticated;
grant execute on function public.get_university_review_queue() to authenticated;
grant execute on function public.review_university_member(uuid,text,text) to authenticated;

-- private storage bucket -------------------------------------------------------
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('university-ids','university-ids',false,10485760,
  array['image/jpeg','image/jpg','image/png','image/webp','image/heic','image/heif','application/pdf'])
on conflict (id) do update set public=excluded.public,
  file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;
