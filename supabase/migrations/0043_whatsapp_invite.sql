-- WhatsApp promoter group invite link.
--
-- Trent (8 Sep 2026): promoters should be able to join the WhatsApp group from
-- the app, new signups should be invited automatically, and past promoters
-- should get a one-off reinvite.
--
-- Why a link and not an API: Meta's Groups API is invite-only (a business can
-- never add a participant itself) and caps a group at 8 people. A normal
-- WhatsApp group invite link holds 1024 and is what the venues already use, so
-- the link is the vehicle. It lives here rather than in an env var so an admin
-- can rotate it without a deploy — group links get reset regularly.

alter table public.app_settings
  add column if not exists whatsapp_invite_url text;

comment on column public.app_settings.whatsapp_invite_url is
  'chat.whatsapp.com invite link for the promoter group. Null hides every "Join the WhatsApp" affordance in the app.';

-- When a promoter was last sent the group invite. Stops the bulk reinvite from
-- hitting the same person twice, the same way nudged_at guards the nudge.
alter table public.promoters
  add column if not exists whatsapp_invited_at timestamptz;

comment on column public.promoters.whatsapp_invited_at is
  'Last time this promoter was emailed the WhatsApp group invite. Not proof they joined — WhatsApp tells us nothing back.';
