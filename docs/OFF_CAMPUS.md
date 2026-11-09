# Off Campus Thursdays (handover)

A weekly uni night at Su Casa Brisbane. Students register their university and club or society, get one season pass, and every pass scanned by Su Casa door staff during a club night counts once for their club. Results are weekly, monthly and per 12-week season, by club and by university.

Built additively in this app; nothing existing changes behaviour. Everything sits behind `offcampus_settings.enabled` (off by default).

## Where things are

| | |
| --- | --- |
| What's On page ("Lunatree") | `/offcampus` (memberships.lunagroup.com.au/offcampus). Links, This Thursday, results tabs, prizes, FAQs |
| Sign-up | `/offcampus/register` (`?src=` is recorded as the member's source) |
| Season pass | `/offcampus/pass/<token>`; `/offcampus/pass` reopens the pass saved on the phone or finds it by email + mobile |
| Terms, privacy | `/offcampus/terms`, `/offcampus/privacy` |
| Door | Scan the pass in **Door Check-in** (`/reception`). A phone-camera scan opens `/offcampus/door/<token>` (staff only; counting needs a tap) |
| Admin | `/admin/offcampus`: Overview, Nights (door windows, This Thursday details, reconciliation, corrections, flags), Clubs (requests, organisers, merge/retire), Members (search, pause, change club, CSV exports), Prizes, Settings |
| Database | `supabase/migrations/0056_off_campus.sql` (tables, RLS, functions, Season 01) and `0055_universities_rls.sql` |
| Tests | `src/lib/offcampus/logic.test.ts` (vitest) and `supabase/tests/off_campus_harness.sql` (78 checks, rolls itself back) |

## What protects the count

- Only a signed-in Su Casa reception, Su Casa manager or admin can count an arrival (`offcampus_check_in` checks `manages_venue`), and only inside an open night's door window. The database works out the night from the time, so 12:40am Friday counts for Thursday.
- One live arrival per member per night: a unique index, so two iPads scanning at once still make one row.
- University and club are copied onto the arrival at scan time. Changing club later never changes a scored week.
- Staff can't count their own pass (flagged). Guests can't count anything.
- Corrections (void, add by hand, move) are admin only, need a reason, write an adjustment row and never delete. Adding by hand raises a flag.
- Flags: own-pass scans, scans in the last 15 minutes, a club change within 2 hours of arriving, 10 arrivals for one club from one staff member in 5 minutes, manual adds. Open flags block prize verification for that night.
- Results are calculated from arrivals every time, never stored.

## Public results

Completed Thursdays only. Group names and totals only; counts under `min_public_count` (3) show as "<3". "This month" is the calendar month in Brisbane; "Season" is the 12-week race.

## Prizes

Propose → verify → approve (by a different admin when `two_admin_approval` is on) → redeemed. Standings are frozen at proposal; a later correction flags the prize instead of changing the winner. Ties follow the approved tie rule, never random. A club prize goes to an approved organiser. Prizes can't be switched on until a rules version (with a tie rule) has been approved. Nothing in the workflow sends a message.

## CRM

New members reach the Luna CRM through the existing `crm_sync` outbox (entity `offcampus_member`, source `guestlist_os`, venue `su-casa-brisbane`). Marketing consent only travels when ticked. Test members (`is_test`) are never sent.

## Defaults chosen (9 Nov 2026)

One season pass per person; online-only door scans (no offline queue); a pending club counts for its university until approved, then its arrivals move across with a recorded adjustment; members can change club from their pass until their first counted arrival in an active season; public counts under 3 masked; the Brisbane-region universities from `universities`. Season 01 runs Thu 12 Nov 2026 to Thu 28 Jan 2027, door window 7pm to 3am (change per night in admin).

## Go-live checklist

1. Apply `0055` and `0056` to the live database.
2. Run `supabase/tests/off_campus_harness.sql` against it (expect `0 failed`; it rolls back).
3. Merge and deploy.
4. Admin → Off Campus → Nights: set Thursday's rooftop and club times and DJs; check the door window.
5. Settings: add the VIP booth and Instagram links; switch on **Off Campus is on**, **Show results publicly**, and (once the terms are checked) **Show prizes**.
6. Add the clubs you already know in Clubs, so students can pick them.
7. Brief the door: scan Off Campus passes in Door Check-in like any QR; ID checks are unchanged.

## Rollback

App: revert the merge. Database: see the commented block at the end of `0056` (drops only `offcampus_*` objects). `0055` can be undone with `alter table public.universities disable row level security;` plus re-granting, but there is no reason to.
