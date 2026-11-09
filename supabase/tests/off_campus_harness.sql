-- Off Campus — database harness.
--
-- Runs every check inside one transaction and then throws, so nothing it
-- does is ever kept: the report comes back as the error message. Safe to run
-- against the live database after 0057 has been applied (it creates its own
-- TEST users, members and clubs and they all roll back).
--
--   psql "$DB" -f supabase/tests/off_campus_harness.sql
--
-- Expect the final line to read "OFF CAMPUS HARNESS: n passed, 0 failed".

create or replace function pg_temp.call(p_role text, p_uid uuid, p_sql text)
returns jsonb language plpgsql as $$
declare v jsonb;
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_uid::text, ''), true);
  perform set_config('request.jwt.claims', case when p_uid is null then '' else json_build_object('sub', p_uid)::text end, true);
  execute format('set local role %I', p_role);
  begin
    execute p_sql into v;
  exception when others then
    v := jsonb_build_object('exception', sqlerrm);
  end;
  reset role;
  return v;
end $$;

do $harness$
declare
  ok int := 0; bad int := 0; report text := '';
  v jsonb; n int; t text;
  su uuid := (select id from public.venues where slug = 'su-casa-brisbane');
  other uuid := (select id from public.venues where slug <> 'su-casa-brisbane' order by name limit 1);
  uq uuid := (select id from public.universities where slug = 'uq');
  qut uuid := (select id from public.universities where slug = 'qut');
  bond uuid := (select id from public.universities where slug = 'bond');
  admin_a uuid := gen_random_uuid(); admin_b uuid := gen_random_uuid();
  door uuid := gen_random_uuid(); door_other uuid := gen_random_uuid();
  mgr uuid := gen_random_uuid(); nobody uuid := gen_random_uuid();
  netball uuid; eng uuid; rowing uuid; tok1 text; tok2 text; tok3 text; tok4 text; tok_staff text;
  m1 uuid; m2 uuid; m3 uuid; n1 uuid; n2 uuid; arr uuid; req uuid; prize uuid;
begin
  -- ── fixtures ──
  insert into auth.users(id, email) values
    (admin_a, 'test-admin-a@example.test'), (admin_b, 'test-admin-b@example.test'),
    (door, 'test-door@example.test'), (door_other, 'test-door-other@example.test'),
    (mgr, 'test-mgr@example.test'), (nobody, 'test-nobody@example.test');
  insert into public.users(id, email, full_name) values
    (admin_a, 'test-admin-a@example.test', 'TEST Admin A'), (admin_b, 'test-admin-b@example.test', 'TEST Admin B'),
    (door, 'test-door@example.test', 'TEST Door'), (door_other, 'test-door-other@example.test', 'TEST Other Door'),
    (mgr, 'test-mgr@example.test', 'TEST Manager'), (nobody, 'test-nobody@example.test', 'TEST Nobody')
  on conflict (id) do nothing;
  -- live: a sign-up trigger may already have made these rows without a name
  update public.users set full_name = 'TEST ' || initcap(split_part(split_part(email::text, '@', 1), '-', 2))
   where id in (admin_a, admin_b, door, door_other, mgr, nobody);
  insert into public.roles(user_id, role, venue_id) values
    (admin_a, 'admin', null), (admin_b, 'admin', null), (door, 'reception', su),
    (door_other, 'reception', other), (mgr, 'venue_manager', su), (nobody, 'promoter', null);
  -- an existing guest-list contact, to prove sign-up reuses it
  insert into public.contacts(full_name, email, mobile) values ('TEST Existing Guest', 'test-existing@example.test', null);
  -- every season night far in the future, so the harness controls which one is open
  update public.offcampus_nights set opens_at = opens_at + interval '20 years', closes_at = closes_at + interval '20 years';
  select id into n1 from public.offcampus_nights where week_no = 1 and season_id is not null order by night_date limit 1;
  select id into n2 from public.offcampus_nights where week_no = 2 and season_id is not null order by night_date limit 1;
  update public.offcampus_settings set enabled = false, public_board = false, prizes_on = false,
    min_public_count = 3, tie_rule = null, rules_approved_at = null;

  -- ── switched off ──
  v := pg_temp.call('anon', null, $q$select public.offcampus_public_info()$q$);
  if v->>'error' = 'closed' then ok := ok + 1; else bad := bad + 1; report := report || E'\nFAIL off: public info ' || v; end if;
  v := pg_temp.call('anon', null, format($q$select public.offcampus_register('TEST One','t1@example.test','0400000001',%L)$q$, uq));
  if v->>'error' = 'closed' then ok := ok + 1; else bad := bad + 1; report := report || E'\nFAIL off: register ' || v; end if;
  v := pg_temp.call('authenticated', door, $q$select public.offcampus_check_in('x')$q$);
  if v->>'error' = 'closed' then ok := ok + 1; else bad := bad + 1; report := report || E'\nFAIL off: check-in ' || v; end if;
  v := pg_temp.call('anon', null, $q$select public.offcampus_board('week','team')$q$);
  if v->>'error' = 'closed' then ok := ok + 1; else bad := bad + 1; report := report || E'\nFAIL off: board ' || v; end if;

  update public.offcampus_settings set enabled = true, public_board = true;

  -- ── clubs ──
  v := pg_temp.call('authenticated', door, format($q$select public.offcampus_admin_team('create', null, %L, 'TEST Netball Club')$q$, uq));
  if v->>'error' = 'not_authorised' then ok := ok + 1; else bad := bad + 1; report := report || E'\nFAIL door cannot add club ' || v; end if;
  v := pg_temp.call('anon', null, format($q$select public.offcampus_admin_team('create', null, %L, 'TEST Netball Club')$q$, uq));
  if v ? 'exception' then ok := ok + 1; else bad := bad + 1; report := report || E'\nFAIL anon cannot call admin ' || v; end if;
  v := pg_temp.call('authenticated', admin_a, format($q$select public.offcampus_admin_team('create', null, %L, 'TEST Netball Club')$q$, uq));
  netball := (v->>'id')::uuid;
  v := pg_temp.call('authenticated', admin_a, format($q$select public.offcampus_admin_team('create', null, %L, 'test netball  club!')$q$, uq));
  if v->>'error' = 'duplicate' then ok := ok + 1; else bad := bad + 1; report := report || E'\nFAIL duplicate club name ' || v; end if;
  v := pg_temp.call('authenticated', admin_a, format($q$select public.offcampus_admin_team('create', null, %L, 'TEST Engineering Society')$q$, qut));
  eng := (v->>'id')::uuid;
  if netball is not null and eng is not null then ok := ok + 1; else bad := bad + 1; report := report || E'\nFAIL create clubs'; end if;

  -- ── sign-up ──
  v := pg_temp.call('anon', null, format($q$select public.offcampus_register('TEST One Person','t1@example.test','0400 000 001',%L,%L,null,false,true,true,true)$q$, uq, netball));
  tok1 := v->>'pass_token';
  if (v->>'ok')::boolean and tok1 is not null then ok := ok + 1; else bad := bad + 1; report := report || E'\nFAIL register 1 ' || v; end if;
  v := pg_temp.call('anon', null, format($q$select public.offcampus_register('TEST Two','t2@example.test','0400000002',%L,%L,null,true,true,true,false)$q$, qut, eng));
  tok2 := v->>'pass_token';
  v := pg_temp.call('anon', null, format($q$select public.offcampus_register('TEST Three','t3@example.test','0400000003',%L,null,'TEST Rowing Club',true,true,true,false)$q$, uq));
  tok3 := v->>'pass_token';
  if (v->>'pending_team')::boolean then ok := ok + 1; else bad := bad + 1; report := report || E'\nFAIL new club goes to requests ' || v; end if;
  v := pg_temp.call('anon', null, format($q$select public.offcampus_register('TEST Four','test-existing@example.test','0400000004',%L,null,'test NETBALL club',false,true,true,false)$q$, uq));
  tok4 := v->>'pass_token';
  select count(*) into n from public.contacts where email_norm = 'test-existing@example.test';
  if n = 1 then ok := ok + 1; else bad := bad + 1; report := report || E'\nFAIL existing contact reused, contacts=' || n; end if;
  select count(*) into n from public.offcampus_affiliations af join public.offcampus_members m on m.id = af.member_id
   where m.pass_token = tok4 and af.team_id = netball and af.valid_to is null;
  if n = 1 then ok := ok + 1; else bad := bad + 1; report := report || E'\nFAIL typed existing club maps onto it'; end if;
  v := pg_temp.call('anon', null, format($q$select public.offcampus_register('TEST One Person','T1@Example.test','0400000001',%L,%L,null,false,true,true,false)$q$, uq, netball));
  if (v->>'already')::boolean and v->>'pass_token' = tok1 then ok := ok + 1; else bad := bad + 1; report := report || E'\nFAIL re-register returns same pass ' || v; end if;
  v := pg_temp.call('anon', null, format($q$select public.offcampus_register('TEST Imposter','t1@example.test','0499999999',%L,%L,null,false,true,true,false)$q$, uq, netball));
  if v->>'error' = 'already_registered' and not v ? 'pass_token' then ok := ok + 1; else bad := bad + 1; report := report || E'\nFAIL email alone never returns a pass ' || v; end if;
  v := pg_temp.call('anon', null, format($q$select public.offcampus_register('TEST Five','t5@example.test','0400000005',%L,%L,null,false,false,true,false)$q$, uq, netball));
  if v->>'error' = 'age_required' then ok := ok + 1; else bad := bad + 1; report := report || E'\nFAIL 18+ required ' || v; end if;
  v := pg_temp.call('anon', null, format($q$select public.offcampus_register('TEST Five','t5@example.test','0400000005',%L,%L,null,false,true,false,false)$q$, uq, netball));
  if v->>'error' = 'privacy_required' then ok := ok + 1; else bad := bad + 1; report := report || E'\nFAIL privacy required ' || v; end if;
  v := pg_temp.call('anon', null, format($q$select public.offcampus_register('TEST Five','t5@example.test','0400000005',%L,null,null,false,true,true,false)$q$, bond));
  if v->>'error' = 'bad_university' then ok := ok + 1; else bad := bad + 1; report := report || E'\nFAIL only Brisbane unis ' || v; end if;
  v := pg_temp.call('anon', null, format($q$select public.offcampus_register('TEST Five','t5@example.test','0400000005',%L,%L,null,false,true,true,false)$q$, qut, netball));
  if v->>'error' = 'bad_team' then ok := ok + 1; else bad := bad + 1; report := report || E'\nFAIL club must belong to the uni ' || v; end if;
  select id into m1 from public.offcampus_members where pass_token = tok1;
  select id into m2 from public.offcampus_members where pass_token = tok2;
  select id into m3 from public.offcampus_members where pass_token = tok3;

  -- ── marketing consent and the CRM ──
  select count(*) into n from crm_sync.outbox where entity_type = 'offcampus_member' and entity_id = m1 and payload ? 'consents';
  if n = 1 then ok := ok + 1; else bad := bad + 1; report := report || E'\nFAIL consent reaches CRM for opt-in'; end if;
  select count(*) into n from crm_sync.outbox where entity_type = 'offcampus_member' and entity_id = m2 and payload ? 'consents';
  if n = 0 then ok := ok + 1; else bad := bad + 1; report := report || E'\nFAIL no consent sent without opt-in'; end if;

  -- ── getting a pass back needs both the email and the mobile ──
  v := pg_temp.call('anon', null, $q$select public.offcampus_find_pass('T1@example.test', '0400 000 001')$q$);
  if v->>'pass_token' = tok1 then ok := ok + 1; else bad := bad + 1; report := report || E'\nFAIL find pass ' || v; end if;
  v := pg_temp.call('anon', null, $q$select public.offcampus_find_pass('t1@example.test', '0499999999')$q$);
  if v->>'error' = 'not_found' then ok := ok + 1; else bad := bad + 1; report := report || E'\nFAIL find pass needs both ' || v; end if;

  -- ── the pass shows no contact details ──
  v := pg_temp.call('anon', null, format($q$select public.offcampus_pass(%L)$q$, tok1));
  if v->>'first_name' = 'TEST' and not (v::text ilike '%example.test%') and not (v::text like '%0400%') then ok := ok + 1;
  else bad := bad + 1; report := report || E'\nFAIL pass privacy ' || v; end if;

  -- ── no direct table access ──
  v := pg_temp.call('anon', null, $q$select to_jsonb(count(*)) from public.offcampus_members$q$);
  if v ? 'exception' then ok := ok + 1; else bad := bad + 1; report := report || E'\nFAIL anon reads members ' || v; end if;
  v := pg_temp.call('authenticated', door, $q$select to_jsonb(count(*)) from public.offcampus_members$q$);
  if v = '0'::jsonb then ok := ok + 1; else bad := bad + 1; report := report || E'\nFAIL door reads members ' || v; end if;
  v := pg_temp.call('authenticated', admin_a, format($q$select to_jsonb(count(*)) from public.offcampus_members where id = %L$q$, m1));
  if v = '1'::jsonb then ok := ok + 1; else bad := bad + 1; report := report || E'\nFAIL admin reads members ' || v; end if;
  v := pg_temp.call('authenticated', admin_a, format($q$insert into public.offcampus_arrivals(member_id, night_id, university_id) values (%L,%L,%L) returning '1'::jsonb$q$, m1, n1, uq));
  if v ? 'exception' then ok := ok + 1; else bad := bad + 1; report := report || E'\nFAIL nobody writes arrivals directly ' || v; end if;
  v := pg_temp.call('anon', null, $q$select to_jsonb(count(*)) from public.offcampus__standings('{}'::uuid[], 'team')$q$);
  if v ? 'exception' then ok := ok + 1; else bad := bad + 1; report := report || E'\nFAIL internal helpers are private ' || v; end if;

  -- ── the door ──
  v := pg_temp.call('authenticated', door, format($q$select public.offcampus_check_in(%L)$q$, tok1));
  if v->>'error' = 'no_night' then ok := ok + 1; else bad := bad + 1; report := report || E'\nFAIL no night open ' || v; end if;
  -- open night 1 the way it looks at 12:40am: opened 5h40m ago, closes in 2h20m
  update public.offcampus_nights set opens_at = now() - interval '5 hours 40 minutes', closes_at = now() + interval '2 hours 20 minutes' where id = n1;
  v := pg_temp.call('authenticated', nobody, format($q$select public.offcampus_check_in(%L)$q$, tok1));
  if v->>'error' = 'not_authorised' then ok := ok + 1; else bad := bad + 1; report := report || E'\nFAIL promoter cannot check in ' || v; end if;
  v := pg_temp.call('authenticated', door_other, format($q$select public.offcampus_check_in(%L)$q$, tok1));
  if v->>'error' = 'not_authorised' then ok := ok + 1; else bad := bad + 1; report := report || E'\nFAIL other venue cannot check in ' || v; end if;
  v := pg_temp.call('anon', null, format($q$select public.offcampus_check_in(%L)$q$, tok1));
  if v ? 'exception' or v->>'error' = 'not_authorised' then ok := ok + 1; else bad := bad + 1; report := report || E'\nFAIL guest cannot check in ' || v; end if;
  v := pg_temp.call('authenticated', door, format($q$select public.offcampus_check_in(%L)$q$, tok1));
  if (v->>'ok')::boolean and v->>'team' = 'TEST Netball Club' then ok := ok + 1; else bad := bad + 1; report := report || E'\nFAIL first scan counts after midnight ' || v; end if;
  v := pg_temp.call('authenticated', mgr, format($q$select public.offcampus_check_in(%L)$q$, tok1));
  if v->>'error' = 'already' and v->>'by' = 'TEST' then ok := ok + 1; else bad := bad + 1; report := report || E'\nFAIL second scan same night ' || v; end if;
  v := pg_temp.call('authenticated', door, format($q$select public.offcampus_check_in(%L)$q$, tok3));
  if (v->>'ok')::boolean and (v->>'pending_team')::boolean then ok := ok + 1; else bad := bad + 1; report := report || E'\nFAIL pending club counts for uni ' || v; end if;
  v := pg_temp.call('authenticated', door, format($q$select public.offcampus_check_in(%L)$q$, tok2));
  v := pg_temp.call('authenticated', door, format($q$select public.offcampus_check_in(%L)$q$, tok4));
  begin
    insert into public.offcampus_arrivals(member_id, night_id, university_id) values (m1, n1, uq);
    bad := bad + 1; report := report || E'\nFAIL unique index allows a second live arrival';
  exception when unique_violation then ok := ok + 1;
  end;
  select count(*) into n from public.offcampus_arrivals where night_id = n1 and voided_at is null;
  if n = 4 then ok := ok + 1; else bad := bad + 1; report := report || E'\nFAIL arrivals tonight = ' || n; end if;
  -- staff member's own pass
  v := pg_temp.call('anon', null, format($q$select public.offcampus_register('TEST Door','test-door@example.test','0400000009',%L,%L,null,false,true,true,false)$q$, uq, netball));
  tok_staff := v->>'pass_token';
  v := pg_temp.call('authenticated', door, format($q$select public.offcampus_check_in(%L)$q$, tok_staff));
  if v->>'error' = 'self_scan' then ok := ok + 1; else bad := bad + 1; report := report || E'\nFAIL self-scan refused ' || v; end if;
  -- the door's own view: first names only
  v := pg_temp.call('authenticated', door, $q$select public.offcampus_tonight()$q$);
  if (v->>'count')::int = 4 and not (v::text ilike '%example.test%') then ok := ok + 1; else bad := bad + 1; report := report || E'\nFAIL tonight view ' || v; end if;

  -- ── window edges: open is inclusive, close is not ──
  update public.offcampus_nights set opens_at = now(), closes_at = now() + interval '8 hours' where id = n1;
  v := pg_temp.call('authenticated', door, $q$select public.offcampus_tonight()$q$);
  if (v->>'open')::boolean then ok := ok + 1; else bad := bad + 1; report := report || E'\nFAIL opens on the minute'; end if;
  update public.offcampus_nights set opens_at = now() - interval '8 hours', closes_at = now() where id = n1;
  v := pg_temp.call('authenticated', door, format($q$select public.offcampus_check_in(%L)$q$, tok2));
  if v->>'error' = 'no_night' then ok := ok + 1; else bad := bad + 1; report := report || E'\nFAIL refused at close ' || v; end if;

  -- ── results ──
  update public.offcampus_nights set opens_at = now() - interval '8 hours', closes_at = now() - interval '1 minute' where id = n1;
  v := pg_temp.call('anon', null, $q$select public.offcampus_board('week','team')$q$);
  if (v->'rows'->0->>'name') = 'TEST Netball Club' and (v->'rows'->0->>'masked')::boolean and v->'rows'->0->'n' = 'null'::jsonb
     and not (v::text ilike '%example.test%') and v->'rows'->0->'key' = 'null'::jsonb then ok := ok + 1;
  else bad := bad + 1; report := report || E'\nFAIL public board masks small counts ' || v; end if;
  v := pg_temp.call('authenticated', admin_a, $q$select public.offcampus_board('week','team')$q$);
  if (v->'rows'->0->>'n')::int = 2 then ok := ok + 1; else bad := bad + 1; report := report || E'\nFAIL admin board shows counts ' || v; end if;
  v := pg_temp.call('authenticated', admin_a, $q$select public.offcampus_board('week','university')$q$);
  if (v->'rows'->0->>'name') = 'UQ' and (v->'rows'->0->>'n')::int = 3 then ok := ok + 1; else bad := bad + 1; report := report || E'\nFAIL uni board counts pending club ' || v; end if;
  v := pg_temp.call('authenticated', admin_a, $q$select public.offcampus_board('season','team')$q$);
  if (v->>'nights_counted')::int = 1 then ok := ok + 1; else bad := bad + 1; report := report || E'\nFAIL season covers nights so far ' || v; end if;

  -- ── a club change keeps scored weeks ──
  v := pg_temp.call('anon', null, format($q$select public.offcampus_member_change_team(%L,%L,%L)$q$, tok1, qut, eng));
  if v->>'error' = 'locked' then ok := ok + 1; else bad := bad + 1; report := report || E'\nFAIL change locked after first arrival ' || v; end if;
  v := pg_temp.call('authenticated', admin_a, format($q$select public.offcampus_admin_change_team(%L,%L,%L,'Moved clubs')$q$, m1, qut, eng));
  v := pg_temp.call('authenticated', admin_a, $q$select public.offcampus_board('week','team')$q$);
  if (v->'rows'->0->>'name') = 'TEST Netball Club' and (v->'rows'->0->>'n')::int = 2 then ok := ok + 1;
  else bad := bad + 1; report := report || E'\nFAIL last week unchanged after club change ' || v; end if;
  select count(*) into n from public.offcampus_adjustments where member_id = m1 and kind = 'team_change';
  if n = 1 then ok := ok + 1; else bad := bad + 1; report := report || E'\nFAIL club change logged'; end if;

  -- ── approving a club re-attributes its arrivals ──
  select id into req from public.offcampus_team_requests where name = 'TEST Rowing Club';
  v := pg_temp.call('authenticated', admin_a, format($q$select public.offcampus_admin_team_request(%L,'approve')$q$, req));
  rowing := (v->>'team_id')::uuid;
  if (v->>'arrivals_reattributed')::int = 1 and (v->>'members_moved')::int = 1 then ok := ok + 1; else bad := bad + 1; report := report || E'\nFAIL approve club ' || v; end if;
  select count(*) into n from public.offcampus_organisers where member_id = m3 and team_id = rowing and status = 'requested';
  if n = 1 then ok := ok + 1; else bad := bad + 1; report := report || E'\nFAIL organiser request carried to new club'; end if;

  -- ── corrections ──
  select id into arr from public.offcampus_arrivals where member_id = m2 and night_id = n1 and voided_at is null;
  v := pg_temp.call('authenticated', door, format($q$select public.offcampus_admin_void_arrival(%L,'x')$q$, arr));
  if v->>'error' = 'not_authorised' then ok := ok + 1; else bad := bad + 1; report := report || E'\nFAIL door cannot void ' || v; end if;
  v := pg_temp.call('authenticated', admin_a, format($q$select public.offcampus_admin_void_arrival(%L,' ')$q$, arr));
  if v->>'error' = 'reason_required' then ok := ok + 1; else bad := bad + 1; report := report || E'\nFAIL void needs reason ' || v; end if;
  v := pg_temp.call('authenticated', admin_a, format($q$select public.offcampus_admin_void_arrival(%L,'Scanned by mistake')$q$, arr));
  select count(*) into n from public.offcampus_arrivals where id = arr;
  if (v->>'ok')::boolean and n = 1 then ok := ok + 1; else bad := bad + 1; report := report || E'\nFAIL void keeps the row ' || v; end if;
  v := pg_temp.call('authenticated', admin_a, format($q$select public.offcampus_admin_add_arrival(%L,%L,'Scanner down at 11pm')$q$, m2, n1));
  select count(*) into n from public.offcampus_flags where night_id = n1 and kind = 'manual_add' and status = 'open';
  if (v->>'ok')::boolean and n = 1 then ok := ok + 1; else bad := bad + 1; report := report || E'\nFAIL manual add flags ' || v; end if;
  v := pg_temp.call('authenticated', admin_a, format($q$select public.offcampus_admin_night_report(%L)$q$, n1));
  if (v->>'arrivals')::int = 4 and (v->>'voided')::int = 1 and (v->>'manual')::int = 1 then ok := ok + 1;
  else bad := bad + 1; report := report || E'\nFAIL night report ' || (v - 'list' - 'adjustments'); end if;

  -- ── windows and seasons can't overlap ──
  v := pg_temp.call('authenticated', admin_a, format($q$select public.offcampus_admin_update_night(%L, jsonb_build_object('opens_at', now() - interval '2 hours', 'closes_at', now() + interval '1 hour'))$q$, n2));
  if v->>'error' = 'bad_window' then ok := ok + 1; else bad := bad + 1; report := report || E'\nFAIL night windows overlap ' || v; end if;
  v := pg_temp.call('authenticated', admin_a, $q$select public.offcampus_admin_create_season('Clash', date '2026-12-03')$q$);
  if v->>'error' = 'overlap' then ok := ok + 1; else bad := bad + 1; report := report || E'\nFAIL seasons overlap ' || v; end if;
  v := pg_temp.call('authenticated', admin_a, $q$select public.offcampus_admin_create_season('Wrong day', date '2027-03-03')$q$);
  if v->>'error' = 'not_thursday' then ok := ok + 1; else bad := bad + 1; report := report || E'\nFAIL season starts on a Thursday ' || v; end if;

  -- ── prizes ──
  v := pg_temp.call('authenticated', admin_a, format($q$select public.offcampus_admin_propose_prize('weekly_booth', %L)$q$, n1));
  if v->>'error' = 'prizes_off' then ok := ok + 1; else bad := bad + 1; report := report || E'\nFAIL prizes off ' || v; end if;
  v := pg_temp.call('authenticated', admin_a, $q$select public.offcampus_admin_set_settings('{"prizes_on": true}')$q$);
  if v->>'error' = 'rules_not_approved' then ok := ok + 1; else bad := bad + 1; report := report || E'\nFAIL prizes need approved rules ' || v; end if;
  v := pg_temp.call('authenticated', admin_a, $q$select public.offcampus_admin_set_settings('{"tie_rule": "shared", "winner_level": "team"}')$q$);
  v := pg_temp.call('authenticated', admin_a, $q$select public.offcampus_admin_approve_rules('TEST rules v1')$q$);
  v := pg_temp.call('authenticated', admin_a, $q$select public.offcampus_admin_set_settings('{"prizes_on": true}')$q$);
  if (v->>'ok')::boolean then ok := ok + 1; else bad := bad + 1; report := report || E'\nFAIL prizes on after approval ' || v; end if;
  -- night 1 standings now: Netball 2 (m1 + m4), Rowing 1, Engineering 1 (manual)
  v := pg_temp.call('authenticated', admin_a, format($q$select public.offcampus_admin_propose_prize('weekly_booth', %L)$q$, n1));
  prize := (v->>'id')::uuid;
  if v->>'status' = 'proposed' and v->'winners'->0->>'name' = 'TEST Netball Club' then ok := ok + 1; else bad := bad + 1; report := report || E'\nFAIL propose weekly ' || v; end if;
  v := pg_temp.call('authenticated', admin_a, format($q$select public.offcampus_admin_prize(%L,'verify')$q$, prize));
  if v->>'error' = 'open_flags' then ok := ok + 1; else bad := bad + 1; report := report || E'\nFAIL open flags block verify ' || v; end if;
  update public.offcampus_flags set status = 'cleared', clear_note = 'harness' where night_id = n1;
  v := pg_temp.call('authenticated', admin_a, format($q$select public.offcampus_admin_prize(%L,'verify')$q$, prize));
  if (v->>'ok')::boolean then ok := ok + 1; else bad := bad + 1; report := report || E'\nFAIL verify ' || v; end if;
  v := pg_temp.call('authenticated', admin_a, format($q$select public.offcampus_admin_prize(%L,'approve')$q$, prize));
  if v->>'error' = 'second_admin_required' then ok := ok + 1; else bad := bad + 1; report := report || E'\nFAIL two admins ' || v; end if;
  v := pg_temp.call('authenticated', admin_b, format($q$select public.offcampus_admin_prize(%L,'approve')$q$, prize));
  if v->>'error' = 'no_recipient' then ok := ok + 1; else bad := bad + 1; report := report || E'\nFAIL needs an approved organiser ' || v; end if;
  v := pg_temp.call('authenticated', admin_a, format($q$select public.offcampus_admin_prize(%L,'recipient',null,null,%L)$q$, prize, m1));
  if v->>'error' = 'not_organiser' then ok := ok + 1; else bad := bad + 1; report := report || E'\nFAIL recipient must be organiser ' || v; end if;
  -- a later correction flags the prize instead of changing the winner
  select id into arr from public.offcampus_arrivals where member_id = m1 and night_id = n1 and voided_at is null;
  v := pg_temp.call('authenticated', admin_a, format($q$select public.offcampus_admin_void_arrival(%L,'Duplicate person')$q$, arr));
  select count(*) into n from public.offcampus_prizes where id = prize and flagged and winners->0->>'name' = 'TEST Netball Club';
  if n = 1 then ok := ok + 1; else bad := bad + 1; report := report || E'\nFAIL correction flags the prize'; end if;
  v := pg_temp.call('authenticated', admin_b, format($q$select public.offcampus_admin_prize(%L,'approve')$q$, prize));
  if v->>'error' in ('flagged','no_recipient') then ok := ok + 1; else bad := bad + 1; report := report || E'\nFAIL flagged prize blocked ' || v; end if;
  v := pg_temp.call('authenticated', admin_a, format($q$select public.offcampus_admin_prize(%L,'cancel','Standings changed')$q$, prize));
  -- night 1 is now a three-way tie on 1: shared rule gives co-winners
  v := pg_temp.call('authenticated', admin_a, format($q$select public.offcampus_admin_propose_prize('weekly_booth', %L)$q$, n1));
  if v->>'status' = 'proposed' and jsonb_array_length(v->'winners') = 3 then ok := ok + 1; else bad := bad + 1; report := report || E'\nFAIL shared tie ' || v; end if;
  update public.offcampus_prizes set status = 'cancelled' where night_id = n1;
  v := pg_temp.call('authenticated', admin_a, $q$select public.offcampus_admin_set_settings('{"tie_rule": "admin"}')$q$);
  select prizes_on into t from public.offcampus_settings;
  if t = 'false' then ok := ok + 1; else bad := bad + 1; report := report || E'\nFAIL changing the tie rule switches prizes off'; end if;
  v := pg_temp.call('authenticated', admin_a, $q$select public.offcampus_admin_approve_rules('TEST rules v2')$q$);
  v := pg_temp.call('authenticated', admin_a, $q$select public.offcampus_admin_set_settings('{"prizes_on": true}')$q$);
  v := pg_temp.call('authenticated', admin_a, format($q$select public.offcampus_admin_propose_prize('weekly_booth', %L)$q$, n1));
  prize := (v->>'id')::uuid;
  if v->>'status' = 'needs_decision' then ok := ok + 1; else bad := bad + 1; report := report || E'\nFAIL admin tie waits for a decision ' || v; end if;
  v := pg_temp.call('authenticated', admin_a, format($q$select public.offcampus_admin_prize(%L,'decide',null,%L)$q$, prize, rowing));
  if v->>'error' = 'reason_required' then ok := ok + 1; else bad := bad + 1; report := report || E'\nFAIL tie decision needs reason ' || v; end if;
  v := pg_temp.call('authenticated', admin_a, format($q$select public.offcampus_admin_prize(%L,'decide','Published rule 7: earliest registered club',%L)$q$, prize, rowing));
  if (v->>'ok')::boolean then ok := ok + 1; else bad := bad + 1; report := report || E'\nFAIL tie decision ' || v; end if;
  v := pg_temp.call('authenticated', admin_a, format($q$select public.offcampus_admin_organiser(id,'approve') from public.offcampus_organisers where member_id = %L$q$, m3));
  v := pg_temp.call('authenticated', admin_a, format($q$select public.offcampus_admin_prize(%L,'recipient',null,null,%L)$q$, prize, m3));
  v := pg_temp.call('authenticated', admin_a, format($q$select public.offcampus_admin_prize(%L,'verify')$q$, prize));
  v := pg_temp.call('authenticated', admin_b, format($q$select public.offcampus_admin_prize(%L,'approve')$q$, prize));
  if (v->>'ok')::boolean then ok := ok + 1; else bad := bad + 1; report := report || E'\nFAIL second admin approves ' || v; end if;
  v := pg_temp.call('anon', null, $q$select public.offcampus_board('week','team')$q$);
  if v->'booth'->>'team' = 'TEST Rowing Club' then ok := ok + 1; else bad := bad + 1; report := report || E'\nFAIL approved booth winner shows publicly ' || v; end if;

  -- ── exports ──
  v := pg_temp.call('authenticated', mgr, $q$select public.offcampus_admin_export('members')$q$);
  if v->>'error' = 'not_authorised' then ok := ok + 1; else bad := bad + 1; report := report || E'\nFAIL manager cannot export people ' || v; end if;
  v := pg_temp.call('authenticated', admin_a, $q$select public.offcampus_admin_export('members')$q$);
  select count(*) into n from public.offcampus_audit where action = 'export_members';
  if (v->>'ok')::boolean and n = 1 then ok := ok + 1; else bad := bad + 1; report := report || E'\nFAIL export logged'; end if;

  raise exception E'%\nOFF CAMPUS HARNESS: % passed, % failed', report, ok, bad;
end $harness$;
