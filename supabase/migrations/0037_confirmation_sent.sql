-- =====================================================================
-- Luna Promoters :: 0037 Track confirmation-email sends
-- Adds confirmation_sent_at so bulk sends are logged and safely resumable.
-- The guest-confirmation API route sets this on a successful send and skips
-- registrations that already have it (unless called with {force:true}).
-- =====================================================================

alter table public.guest_registrations
  add column if not exists confirmation_sent_at timestamptz;

comment on column public.guest_registrations.confirmation_sent_at is
  'When the guest confirmation email was last successfully sent (null = never sent).';
