-- =====================================================================
-- Luna Promoters :: 0006 RPC execution grants
-- Public (anon) may only call the sign-up / registration / token RPCs.
-- Privileged RPCs are restricted to authenticated users; internal
-- checks enforce admin/venue scope.
-- =====================================================================

-- Public-facing (anonymous) RPCs
grant execute on function public.submit_promoter_application(text,text,text,date,text,text,text,text,uuid,uuid[],boolean,boolean,text) to anon, authenticated;
grant execute on function public.register_guest(text,uuid,text,text,text,text,date,text,boolean) to anon, authenticated;
grant execute on function public.get_registration_by_token(text) to anon, authenticated;

-- Authenticated-only RPCs (internal role checks apply)
grant execute on function public.approve_promoter(uuid) to authenticated;
grant execute on function public.check_in_guest(uuid,boolean,text) to authenticated;
grant execute on function public.refresh_promoter_month(uuid,date) to authenticated;

-- Helper predicates used by RLS
grant execute on function public.is_admin(uuid) to anon, authenticated;
grant execute on function public.has_role(app_role,uuid) to anon, authenticated;
grant execute on function public.manages_venue(uuid,uuid) to anon, authenticated;
grant execute on function public.my_promoter_id(uuid) to anon, authenticated;
grant execute on function public.user_venue_ids(uuid) to anon, authenticated;
grant execute on function public.check_in_by_token(text,boolean,text) to authenticated;
