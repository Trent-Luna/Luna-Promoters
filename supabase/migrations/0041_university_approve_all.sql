-- =====================================================================
-- Luna Promoters :: 0041 Approve-all override for university sign-ups
--
-- Trent, 29 Aug 2026: "another slider to turn on and off an overide where
-- no matter what, if they sign up to the university qr code it auto
-- approvs them no matter what."
--
-- 0040 added a switch for whether a PASSING check approves on the spot.
-- This one skips the check's verdict entirely: blurry photo, expired card,
-- name mismatch, wrong document type, suspected tampering -- all approved.
-- Those are judgements about a document, and the cost of getting them wrong
-- is a student discount given to someone who did not earn it. That is
-- Trent's call to make.
--
-- ONE TEST IS NOT SKIPPED: under 18. That is not a judgement about a
-- document, it is whether a child is handed a membership to a licensed
-- nightclub, and a switch that skipped it would be a switch for putting
-- minors on the door list. It is moved to the FRONT of the chain so the
-- override cannot reach past it. (university_verifications also carries
-- trg_univ_min_age from 0038, which refuses the row outright -- this is the
-- second lock on the same door, not the only one.)
--
-- The AI's findings are still written in full even when the override
-- approves, and "approved_by_override" is appended to review_reasons, so
-- every membership approved this way can be found again later.
--
-- Defaults to FALSE. Applied to project fiquraregaucwnrjhwqx on 2026-08-29.
-- =====================================================================

alter table public.app_settings
  add column if not exists university_approve_all boolean not null default false;

comment on column public.app_settings.university_approve_all is
  'Override: approve every university application regardless of what the ID check found. Applicants under 18 are still rejected. Intended for short bursts (a campus sign-up night), not as a standing setting.';

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
  v_auto boolean; v_override boolean;
begin
  select * into v_m from memberships where id=p_membership;
  if v_m.id is null then return json_build_object('ok',false,'error','not_found'); end if;
  v_prev := v_m.status;
  select * into v_ver from university_verifications where membership_id=p_membership order by created_at desc limit 1;
  if v_ver.id is null then return json_build_object('ok',false,'error','no_verification'); end if;

  -- Missing row or null column must not silently stop approvals working.
  select coalesce(auto_approve_university, true), coalesce(university_approve_all, false)
    into v_auto, v_override from public.app_settings where id = 1;
  v_auto := coalesce(v_auto, true); v_override := coalesce(v_override, false);

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

  -- UNDER 18 IS CHECKED FIRST AND THE OVERRIDE DOES NOT REACH IT. Every other
  -- test here is a judgement about a document; this one is about whether a
  -- child is being given a membership to a licensed nightclub. A switch that
  -- skipped it would be a switch for putting minors on the door list.
  if v_ver.submitted_dob is not null and v_ver.submitted_dob > (current_date - interval '18 years') then
    v_new := 'rejected'; v_summary := 'Applicant is under 18.';
  elsif v_override then
    -- "Approve them no matter what." The findings below are still WRITTEN to
    -- university_verifications, so the record of what the ID actually looked
    -- like survives and every override-approved member can be found later.
    v_new := 'approved';
    v_reasons := v_reasons || '["approved_by_override"]'::jsonb;
    v_summary := coalesce(v_summary,'Approved automatically: approve-all override is on.');
  elsif p_extraction is null or v_score is null or (p_extraction ? 'is_university_id') is false then
    v_new := 'manual_review'; v_reasons := '["ai_response_invalid"]'::jsonb;
    v_summary := coalesce(v_summary,'AI verification response was invalid or incomplete.');
  elsif v_is_uni is false then
    v_new := 'rejected'; v_summary := coalesce(v_summary,'Uploaded document does not appear to be a university/tertiary ID.');
  elsif v_exp is not null and v_exp < current_date then
    v_new := 'rejected'; v_summary := coalesce(v_summary,'University ID appears to be expired.');
  elsif v_score >= 71 and coalesce(v_is_uni,false) and coalesce(v_current,false)
        and coalesce(v_namem,false) and coalesce(v_expm,false)
        and not coalesce(v_tamper,false) and coalesce(v_clear,false) then
    -- Everything passed. Whether that is enough on its own is the setting.
    if v_auto then
      v_new := 'approved';
    else
      v_new := 'manual_review';
      -- Say WHY it is in the queue, so nobody reviewing it goes looking for a
      -- fault in an ID that actually passed every check.
      v_reasons := v_reasons || '["auto_approval_off"]'::jsonb;
      v_summary := coalesce(v_summary,'ID check passed. Held for manual approval because auto-approval is off.');
    end if;
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
    'auto_approve',v_auto,'override',v_override,'pass_token',v_m.pass_token,'membership_id',v_m.id);
end $$;
