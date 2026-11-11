-- 0059 — atlas_signup_points(): every way a guest signs up in this app, with
-- counts, for Atlas → Guests & members.
--
-- Trent, 9 Nov 2026: the promoter/uni site "is not just promoters anymore" and
-- the sign-ups are spread across this app, the CRM and Reservations. Atlas now
-- shows them in one list. Atlas never reads another app's tables, so this app
-- answers through one read-only function, the same way atlas_guestlist_weekly()
-- already feeds the Command Centre.
--
-- What it returns, one row per sign-up point:
--   * Guest list, per venue: names added through the venue's own link (the
--     house promoter), not counting occasions.
--   * Promoter and staff links, per venue: names added through anyone else's
--     link, not counting occasions.
--   * Birthdays and occasions, per venue: any registration with an occasion.
--     The three are disjoint, so no name is counted twice.
--   * University Membership: memberships rows.
--   * Promoter, staff, DJ and Close Friends sign-ups: promoters rows by category.
--   * Off Campus Thursdays: offcampus_members (test members left out).
--
-- Counts are SIGN-UPS (rows created), not heads: plus-ones are not added, and
-- that is deliberate — a sign-up point is measured by how many people used it.
--
-- Read-only, no personal data, service role only. Nothing in the app calls it.

create or replace function public.atlas_signup_points(p_from timestamptz, p_to timestamptz)
returns table (
  point_key      text,
  kind           text,
  label          text,
  atlas_venue_id uuid,
  venue_name     text,
  public_path    text,
  admin_path     text,
  in_window      bigint,
  total          bigint,
  last_at        timestamptz,
  active         boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with reg as (
    select gr.venue_id,
           gr.created_at,
           case
             when nullif(btrim(gr.special_occasion), '') is not null then 'occasion'
             when p.is_house then 'guest_list'
             else 'promoter_links'
           end as bucket
    from guest_registrations gr
    left join promoters p on p.id = gr.promoter_id
  ),
  reg_points as (
    select r.bucket, v.id as venue_id, v.slug, v.name, v.atlas_venue_id, v.active,
           count(*) filter (where r.created_at >= p_from and r.created_at < p_to) as in_window,
           count(*) as total,
           max(r.created_at) as last_at
    from reg r
    join venues v on v.id = r.venue_id
    group by r.bucket, v.id, v.slug, v.name, v.atlas_venue_id, v.active
  ),
  -- The promoter application (/memberships/<category>) writes a promoters row.
  cat as (
    select c.category, c.label, c.path
    from (values
      ('promoter',     'Promoter sign-up',      '/memberships/promoter'),
      ('staff',        'Staff sign-up',         '/memberships/staff'),
      ('dj',           'DJ sign-up',            '/memberships/dj'),
      ('close_friend', 'Close Friends sign-up', '/memberships/close-friends')
    ) as c(category, label, path)
  ),
  -- Close Friends is Wednesdays at Su Casa; Off Campus names its own venue.
  su_casa as (
    select id, name, atlas_venue_id from venues where slug = 'su-casa-brisbane' limit 1
  ),
  oc_venue as (
    select v.name, v.atlas_venue_id, s.enabled
    from offcampus_settings s join venues v on v.id = s.venue_id
    limit 1
  )

  select 'guestlist:' || rp.bucket || ':' || rp.slug,
         rp.bucket,
         case rp.bucket
           when 'guest_list' then 'Guest list'
           when 'promoter_links' then 'Promoter and staff links'
           else 'Birthdays and occasions'
         end,
         rp.atlas_venue_id,
         rp.name,
         case rp.bucket when 'occasion' then '/birthday' when 'guest_list' then '/' else '/p/<code>' end,
         case rp.bucket when 'promoter_links' then '/admin/promoters' else '/admin/guestlists' end,
         rp.in_window, rp.total, rp.last_at, rp.active
  from reg_points rp

  union all
  select 'membership:university', 'membership', 'University Membership', null, null,
         '/memberships/university', '/admin/university',
         count(*) filter (where m.created_at >= p_from and m.created_at < p_to),
         count(*) filter (where m.status::text = 'approved' and m.archived_at is null),
         max(m.created_at),
         true
  from memberships m
  join membership_types t on t.id = m.membership_type_id and t.key = 'university'

  union all
  select 'signup:' || c.category,
         case c.category when 'close_friend' then 'close_friends' else 'promoter_signup' end,
         c.label,
         case c.category when 'close_friend' then (select atlas_venue_id from su_casa) end,
         case c.category when 'close_friend' then (select name from su_casa) end,
         c.path,
         case c.category when 'close_friend' then '/admin/close-friends' else '/admin/promoters' end,
         count(p.id) filter (where p.created_at >= p_from and p.created_at < p_to),
         count(p.id) filter (where p.status::text = 'approved'),
         max(p.created_at),
         true
  from cat c
  left join promoters p on p.category = c.category
  group by c.category, c.label, c.path

  union all
  select 'offcampus', 'off_campus', 'Off Campus Thursdays',
         (select atlas_venue_id from oc_venue), (select name from oc_venue),
         '/offcampus', '/admin/offcampus',
         count(*) filter (where o.created_at >= p_from and o.created_at < p_to),
         count(*) filter (where o.status = 'active'),
         max(o.created_at),
         coalesce((select enabled from oc_venue), false)
  from offcampus_members o
  where not o.is_test;
$$;

revoke all on function public.atlas_signup_points(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.atlas_signup_points(timestamptz, timestamptz) to service_role;
