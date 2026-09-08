-- Per-venue public WhatsApp channels.
--
-- Trent (8 Sep 2026) split the channels in two:
--   • one PROMOTER channel, group-wide      → app_settings.whatsapp_invite_url
--   • one PUBLIC channel per venue          → venues.whatsapp_channel_url
--
-- Why the split: promoter traffic is operational ("Eclipse is quiet, we need
-- bodies by 11") and reads badly to a guest. Why per venue and not one Luna
-- channel: a Su Casa regular does not want Pump's Saturday lineup, and an
-- unfollowed channel is worse than one they never joined.
--
-- Guests are only ever shown their venue's channel; promoters see the promoter
-- channel on their dashboard.

alter table public.venues
  add column if not exists whatsapp_channel_url text;

comment on column public.venues.whatsapp_channel_url is
  'Public WhatsApp channel follow link for this venue (https://whatsapp.com/channel/…). Null hides every "follow us" affordance for the venue. Separate from app_settings.whatsapp_invite_url, which is the promoter-only channel.';
