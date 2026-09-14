-- 0047_moved_nights.sql
--
-- A trail for a guest whose night we changed.
--
-- Trent, 14 Sep 2026: "yes email them like you have mocked up."
--
-- WHY A COLUMN AND NOT A NOTE. The 14 Sep sweep recorded the move in the
-- registration's free-text note, which is fine for a host reading a sheet and
-- useless for a query. Twenty-nine guests had to be found, told, and marked as
-- told, and none of that is safe against `notes ilike '%moved%'`.
--
-- moved_from is the night they were ORIGINALLY listed for — the fact the email
-- needs and the only one the new row does not carry. moved_notice_sent_at is
-- stamped after the provider accepts the message, never before, so a failed
-- send stays on the list and gets retried rather than being silently lost.
--
-- Both are permanently useful: any future move from the Guestlists screen
-- leaves the same trail, and the guest is one press away from knowing.

alter table public.guest_registrations
  add column if not exists moved_from date,
  add column if not exists moved_notice_sent_at timestamptz;

create index if not exists guest_registrations_moved_from_idx
  on public.guest_registrations (moved_from) where moved_from is not null;

-- Backfill the 14 Sep sweep out of the notes it wrote, so the 54 rows moved
-- before this column existed are visible to the screen that has to chase them.
update public.guest_registrations gr
   set moved_from = to_date(
         substring(gr.notes from '(?:Moved from|originally listed for) ([A-Za-z]{3} [0-9]{2} [A-Za-z]{3})')
         || ' ' || to_char(e.event_date, 'YYYY'), 'Dy DD Mon YYYY')
  from public.events e
 where e.id = gr.event_id
   and gr.moved_from is null
   and (gr.notes ilike '%Moved from %' or gr.notes ilike '%originally listed for %');

notify pgrst, 'reload schema';
