-- 0058 — Off Campus: every active university on the list.
--
-- 0057 limited the sign-up picker to universities tagged "brisbane", which
-- left out Bond and Southern Cross (Gold Coast). Trent wants every university
-- option available (9 Nov 2026), so the picker, sign-up and club change now
-- accept any active university. Which universities are active is still
-- decided in public.universities. Only these three functions change.

create or replace function public.offcampus_public_info()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare s public.offcampus_settings := public.offcampus__settings(); v_next public.offcampus_nights;
begin
  if s.id is null or not s.enabled then return jsonb_build_object('ok', false, 'error', 'closed'); end if;
  select * into v_next from public.offcampus_nights
   where not skipped and closes_at > now() order by opens_at limit 1;
  return jsonb_build_object(
    'ok', true,
    'public_board', s.public_board,
    'show_prizes', s.show_prizes,
    'privacy_version', s.privacy_version,
    'tie_rule', case when s.rules_approved_at is not null then s.tie_rule end,
    'winner_level', case when s.rules_approved_at is not null then s.winner_level end,
    'links', jsonb_build_object('booth', s.booth_url, 'whatsapp', s.whatsapp_url, 'instagram', s.instagram_url),
    'next_night', case when v_next.id is null then null else public.offcampus__night_json(v_next) end,
    'universities', coalesce((
      select jsonb_agg(jsonb_build_object('id', u.id, 'name', u.name, 'short', u.short_name,
        'teams', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name) order by t.name)
                            from public.offcampus_teams t
                            where t.university_id = u.id and t.status = 'active' and not t.is_test), '[]'))
        order by u.sort_order, u.name)
      from public.universities u
      where u.is_active), '[]'));
end $$;

create or replace function public.offcampus_register(
  p_full_name text, p_email text, p_mobile text,
  p_university uuid, p_team uuid default null, p_new_team text default null,
  p_organiser boolean default false, p_age_ack boolean default false,
  p_privacy boolean default false, p_marketing boolean default false,
  p_source text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s public.offcampus_settings := public.offcampus__settings();
  v_name text := public.offcampus_clean_name(p_full_name);
  v_email text := lower(nullif(btrim(coalesce(p_email, '')), ''));
  v_mobile text := nullif(regexp_replace(coalesce(p_mobile, ''), '[^0-9]', '', 'g'), '');
  v_new text := public.offcampus_clean_name(p_new_team);
  v_contact public.contacts;
  v_member public.offcampus_members;
  v_team public.offcampus_teams;
  v_req public.offcampus_team_requests;
begin
  if s.id is null or not s.enabled then return jsonb_build_object('ok', false, 'error', 'closed'); end if;
  if v_name is null or length(v_name) < 2 or v_email is null or v_mobile is null then
    return jsonb_build_object('ok', false, 'error', 'missing_fields');
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then return jsonb_build_object('ok', false, 'error', 'bad_email'); end if;
  if length(v_mobile) not between 8 and 15 then return jsonb_build_object('ok', false, 'error', 'bad_mobile'); end if;
  if not coalesce(p_age_ack, false) then return jsonb_build_object('ok', false, 'error', 'age_required'); end if;
  if not coalesce(p_privacy, false) then return jsonb_build_object('ok', false, 'error', 'privacy_required'); end if;
  if not exists (select 1 from public.universities u where u.id = p_university and u.is_active) then
    return jsonb_build_object('ok', false, 'error', 'bad_university');
  end if;
  if p_team is not null then
    select * into v_team from public.offcampus_teams t
     where t.id = p_team and t.university_id = p_university and t.status = 'active' and not t.is_test;
    if v_team.id is null then return jsonb_build_object('ok', false, 'error', 'bad_team'); end if;
  elsif v_new is not null then
    if length(v_new) < 2 then return jsonb_build_object('ok', false, 'error', 'bad_team'); end if;
    -- Typed a club that already exists? Use it.
    select * into v_team from public.offcampus_teams t
     where t.university_id = p_university and t.name_key = public.offcampus_name_key(v_new) and t.status = 'active' and not t.is_test;
  end if;

  -- One person, one contact: match on cleaned email first, then mobile.
  select * into v_contact from public.contacts c
   where c.email_norm = v_email or c.mobile_norm = v_mobile
   order by (c.email_norm = v_email) desc nulls last, c.created_at limit 1;

  if v_contact.id is not null then
    select * into v_member from public.offcampus_members m where m.contact_id = v_contact.id;
    if v_member.id is not null then
      -- Already registered. The pass comes back only to someone who knows both
      -- the email and the mobile it was registered with.
      if v_contact.email_norm = v_email and v_contact.mobile_norm = v_mobile then
        return jsonb_build_object('ok', true, 'already', true, 'pass_token', v_member.pass_token);
      end if;
      return jsonb_build_object('ok', false, 'error', 'already_registered');
    end if;
    update public.contacts set
      email = coalesce(email, v_email::citext),
      mobile = coalesce(mobile, p_mobile)
     where id = v_contact.id;
  else
    insert into public.contacts(full_name, email, mobile)
    values (v_name, v_email::citext, btrim(p_mobile)) returning * into v_contact;
  end if;

  insert into public.offcampus_members(contact_id, full_name, age_ack_at, privacy_version,
      marketing_consent, marketing_consent_at, source)
  values (v_contact.id, v_name, now(), s.privacy_version, coalesce(p_marketing, false),
      case when p_marketing then now() end, left(p_source, 60))
  returning * into v_member;

  if v_team.id is null and v_new is not null then
    -- A club we don't have yet: share a pending request for the same name, or start one.
    select * into v_req from public.offcampus_team_requests r
     where r.university_id = p_university and r.name_key = public.offcampus_name_key(v_new) and r.status = 'pending';
    if v_req.id is null then
      insert into public.offcampus_team_requests(university_id, name, requested_by, organiser_requested)
      values (p_university, v_new, v_member.id, coalesce(p_organiser, false)) returning * into v_req;
    end if;
  end if;

  insert into public.offcampus_affiliations(member_id, university_id, team_id, request_id, reason)
  values (v_member.id, p_university, v_team.id, v_req.id, 'registered');

  if v_team.id is not null and coalesce(p_organiser, false) then
    insert into public.offcampus_organisers(member_id, team_id) values (v_member.id, v_team.id)
    on conflict (member_id, team_id) do nothing;
  end if;

  return jsonb_build_object('ok', true, 'already', false, 'pass_token', v_member.pass_token,
    'pending_team', v_req.id is not null);
end $$;

create or replace function public.offcampus_member_change_team(
  p_token text, p_university uuid, p_team uuid default null, p_new_team text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s public.offcampus_settings := public.offcampus__settings();
  v_member public.offcampus_members; v_team public.offcampus_teams; v_req public.offcampus_team_requests;
  v_new text := public.offcampus_clean_name(p_new_team); v_cur public.offcampus_affiliations;
begin
  if s.id is null or not s.enabled then return jsonb_build_object('ok', false, 'error', 'closed'); end if;
  select * into v_member from public.offcampus_members where pass_token = p_token;
  if v_member.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if exists (select 1 from public.offcampus_arrivals a join public.offcampus_nights n on n.id = a.night_id
             join public.offcampus_seasons se on se.id = n.season_id
             where a.member_id = v_member.id and a.voided_at is null and se.status = 'active') then
    return jsonb_build_object('ok', false, 'error', 'locked');
  end if;
  if not exists (select 1 from public.universities u where u.id = p_university and u.is_active) then
    return jsonb_build_object('ok', false, 'error', 'bad_university');
  end if;
  if p_team is not null then
    select * into v_team from public.offcampus_teams t where t.id = p_team and t.university_id = p_university and t.status = 'active' and not t.is_test;
    if v_team.id is null then return jsonb_build_object('ok', false, 'error', 'bad_team'); end if;
  elsif v_new is not null then
    select * into v_team from public.offcampus_teams t
     where t.university_id = p_university and t.name_key = public.offcampus_name_key(v_new) and t.status = 'active' and not t.is_test;
    if v_team.id is null then
      select * into v_req from public.offcampus_team_requests r
       where r.university_id = p_university and r.name_key = public.offcampus_name_key(v_new) and r.status = 'pending';
      if v_req.id is null then
        insert into public.offcampus_team_requests(university_id, name, requested_by)
        values (p_university, v_new, v_member.id) returning * into v_req;
      end if;
    end if;
  end if;
  select * into v_cur from public.offcampus_affiliations where member_id = v_member.id and valid_to is null;
  if v_cur.university_id = p_university and v_cur.team_id is not distinct from v_team.id
     and v_cur.request_id is not distinct from v_req.id then
    return jsonb_build_object('ok', true, 'unchanged', true);
  end if;
  update public.offcampus_affiliations set valid_to = now() where id = v_cur.id;
  insert into public.offcampus_affiliations(member_id, university_id, team_id, request_id, reason)
  values (v_member.id, p_university, v_team.id, v_req.id, 'member changed before first arrival');
  insert into public.offcampus_adjustments(kind, member_id, before, after, reason)
  values ('team_change', v_member.id,
    jsonb_build_object('university_id', v_cur.university_id, 'team_id', v_cur.team_id, 'request_id', v_cur.request_id),
    jsonb_build_object('university_id', p_university, 'team_id', v_team.id, 'request_id', v_req.id),
    'Member changed club on their pass before their first arrival');
  return jsonb_build_object('ok', true);
end $$;
