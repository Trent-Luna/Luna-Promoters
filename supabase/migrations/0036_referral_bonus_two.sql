-- =====================================================================
-- Luna Promoters :: 0036 Referral bonus = 2 checked-in credit
-- When a referred promoter is approved, the referrer gets +2 (was +3)
-- checked-in credit toward their monthly tier.
-- =====================================================================

create or replace function public.award_referral(p_referred uuid)
returns void language plpgsql security definer set search_path = public as $$
declare rby uuid; awarded boolean; m date := date_trunc('month', now())::date;
begin
  select referred_by, referral_awarded into rby, awarded from public.promoters where id = p_referred;
  if rby is null or awarded then return; end if;

  insert into public.promoter_performance(promoter_id, period_month, bonus_checked_in)
    values (rby, m, 2)
    on conflict (promoter_id, period_month)
    do update set bonus_checked_in = public.promoter_performance.bonus_checked_in + 2;

  update public.promoters set referral_awarded = true where id = p_referred;
  perform public.refresh_promoter_month(rby, current_date);
  perform public.log_action('referral_awarded', null, null, null, rby, null, 'referred ' || p_referred::text);
end $$;
grant execute on function public.award_referral(uuid) to authenticated;
