-- ============================================================================
-- University decision-engine + signup gate tests.
-- Runs entirely inside a transaction that is ROLLED BACK, so it never persists
-- test data. Run with:  psql "$DATABASE_URL" -f supabase/tests/university_decision.sql
-- A PASS/FAIL report is raised at the end (the "error" is the intentional rollback).
-- ============================================================================
do $$
declare
  rep text := E'\n==== LUNA UNIVERSITY TEST RESULTS ====\n';
  mid uuid; r json; st text;
  base_ok jsonb := '{"is_university_id":true,"is_current":true,"image_is_clear":true,"name_matches":true,"expiry_matches":true,"possible_tampering":false,"institution_name":"Example University","extracted_name":"Test Student","extracted_expiry_date":"2027-03-31"}';
begin
  -- signup: under 18
  r := submit_university_application('Kid','0400000001','kid@test.dev',(current_date - interval '10 years')::date,'2027-03-31','p/kid.jpg','image/jpeg',1000,true,true,false);
  rep := rep || format('signup under_18            => %-14s %s%s', coalesce(r->>'error','ok'), case when r->>'error'='under_18' then 'PASS' else 'FAIL' end, E'\n');
  -- signup: consent required
  r := submit_university_application('NC','0400000002','nc@test.dev','2000-01-01','2027-03-31','p/nc.jpg','image/jpeg',1000,false,true,false);
  rep := rep || format('signup consent_required    => %-14s %s%s', coalesce(r->>'error','ok'), case when r->>'error'='consent_required' then 'PASS' else 'FAIL' end, E'\n');
  -- signup: happy path
  r := submit_university_application('Test Student','0400000003','student@test.dev','2000-05-05','2027-03-31','p/ok.jpg','image/jpeg',2000,true,true,true);
  mid := (r->>'membership_id')::uuid;
  rep := rep || format('signup happy path          => %-14s %s%s', coalesce(r->>'status','?'), case when r->>'ok'='true' and mid is not null then 'PASS' else 'FAIL' end, E'\n');
  -- signup: duplicate contact (same email)
  r := submit_university_application('Test Student','0400000099','student@test.dev','2000-05-05','2027-03-31','p/ok2.jpg','image/jpeg',2000,true,true,true);
  rep := rep || format('signup duplicate contact   => dup=%-9s %s%s', r->>'duplicate_contact', case when r->>'duplicate_contact'='true' then 'PASS' else 'FAIL' end, E'\n');

  rep := rep || E'\n-- decision engine --\n';
  st := (apply_university_verification(mid, base_ok || '{"confidence_score":85}') ->> 'status'); rep := rep || format('conf 85 all-good           => %-14s %s%s', st, case when st='approved' then 'PASS' else 'FAIL' end, E'\n');
  st := (apply_university_verification(mid, base_ok || '{"confidence_score":71}') ->> 'status'); rep := rep || format('conf 71 boundary           => %-14s %s%s', st, case when st='approved' then 'PASS' else 'FAIL' end, E'\n');
  st := (apply_university_verification(mid, base_ok || '{"confidence_score":70}') ->> 'status'); rep := rep || format('conf 70 boundary           => %-14s %s%s', st, case when st='manual_review' then 'PASS' else 'FAIL' end, E'\n');
  st := (apply_university_verification(mid, base_ok || '{"confidence_score":90,"name_matches":false}') ->> 'status'); rep := rep || format('name mismatch              => %-14s %s%s', st, case when st='manual_review' then 'PASS' else 'FAIL' end, E'\n');
  st := (apply_university_verification(mid, base_ok || '{"confidence_score":90,"expiry_matches":false}') ->> 'status'); rep := rep || format('expiry mismatch            => %-14s %s%s', st, case when st='manual_review' then 'PASS' else 'FAIL' end, E'\n');
  st := (apply_university_verification(mid, base_ok || '{"confidence_score":90,"image_is_clear":false}') ->> 'status'); rep := rep || format('unclear image              => %-14s %s%s', st, case when st='manual_review' then 'PASS' else 'FAIL' end, E'\n');
  st := (apply_university_verification(mid, base_ok || '{"confidence_score":90,"is_university_id":false}') ->> 'status'); rep := rep || format('not a university id         => %-14s %s%s', st, case when st='rejected' then 'PASS' else 'FAIL' end, E'\n');
  st := (apply_university_verification(mid, base_ok || '{"confidence_score":90,"extracted_expiry_date":"2020-01-01"}') ->> 'status'); rep := rep || format('expired card               => %-14s %s%s', st, case when st='rejected' then 'PASS' else 'FAIL' end, E'\n');
  st := (apply_university_verification(mid, '{"garbage":true}') ->> 'status'); rep := rep || format('malformed AI response      => %-14s %s%s', st, case when st='manual_review' then 'PASS' else 'FAIL' end, E'\n');
  st := (apply_university_verification(mid, base_ok || '{"confidence_score":95,"possible_tampering":true}') ->> 'status'); rep := rep || format('tampering flagged          => %-14s %s%s', st, case when st='manual_review' then 'PASS' else 'FAIL' end, E'\n');

  rep := rep || E'\n(rolled back - no test data persisted)\n';
  raise exception '%', rep;
end $$;
