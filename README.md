# Luna Promoters

Standalone promoter management, guestlist, leaderboard and door check-in system for
**Luna Group** — Eclipse, Eclipse AfterDark, Su Casa Brisbane and Pump Nightclub.
Does not use SevenRooms.

**Stack:** Next.js 14 (App Router) · React · Supabase (Auth + Postgres + Row Level Security) · Tailwind CSS. Mobile-first.

The full MVP loop works end to end:
promoter applies → admin approves → promoter gets a unique link → guest registers →
guest gets a QR code → reception scans/checks in on iPad → check-in counts toward the
promoter leaderboard → tier progress updates → admin exports CSV for HubSpot.

---

## 1. Create the Supabase project

1. Go to https://supabase.com → **New project**. Pick a region close to AU (e.g. Sydney).
2. Once created, open **Project Settings → API** and copy:
   - Project URL
   - `anon` public key
   - `service_role` key (secret — server only)

## 2. Run the database migrations

In the Supabase dashboard open **SQL Editor** and run each file in
`supabase/migrations/` **in order**:

```
0001_schema.sql          -- tables, enums, relationships
0002_functions.sql       -- RPCs: signup, register, check-in, approve, leaderboard helpers
0003_rls.sql             -- Row Level Security policies
0004_seed.sql            -- the four venues + default tiers
0005_new_user_trigger.sql-- auth.users -> profile + auto-link approved promoters
0006_grants.sql          -- who can call which RPC (anon vs authenticated)
0007_reporting.sql       -- leaderboard + dashboard stat RPCs
```

(If you use the Supabase CLI: `supabase db push` with these under `supabase/migrations`.)

## 3. Configure environment variables

Copy `.env.example` to `.env.local` and fill in:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...            # server only
NEXT_PUBLIC_SITE_URL=https://promoter.lunagroup.com.au
```

## 4. Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000 — the public promoter application form.

## 5. Create your first admin

Because RLS locks everything down, seed the first admin by hand:

1. In the app, go to `/login` and **Create your account** with your Luna email
   (this creates the `auth.users` row and, via the trigger, a `public.users` profile).
2. In Supabase **SQL Editor**, grant yourself admin:

```sql
insert into public.roles (user_id, role)
select id, 'admin' from public.users where email = 'you@lunagroup.com.au';
```

3. Refresh — you now land on `/admin`.

### Adding other staff

Create their auth account (they self sign-up at `/login`), then assign roles:

```sql
-- Venue manager for one venue
insert into public.roles (user_id, role, venue_id)
select u.id, 'venue_manager', v.id
from public.users u, public.venues v
where u.email = 'manager@lunagroup.com.au' and v.slug = 'eclipse';

-- Reception / door staff for a venue
insert into public.roles (user_id, role, venue_id)
select u.id, 'reception', v.id
from public.users u, public.venues v
where u.email = 'door@lunagroup.com.au' and v.slug = 'pump-nightclub';
```

Approved **promoters** are linked automatically: when someone whose email matches an
approved application signs up at `/login`, the trigger links their promoter profile and
grants the `promoter` role.

## 6. Deploy to Vercel

1. Push this folder to a GitHub repo.
2. In Vercel → **New Project** → import the repo.
3. Add the four environment variables from step 3 (mark `SUPABASE_SERVICE_ROLE_KEY` as
   available to server only).
4. Deploy, then point `promoter.lunagroup.com.au` at the Vercel project (Domains tab).
5. In Supabase **Authentication → URL Configuration**, set the Site URL and add
   `https://promoter.lunagroup.com.au/auth/callback` as a redirect URL.

---

## Roles & routes

| Role           | Landing      | Can do                                                        |
|----------------|--------------|---------------------------------------------------------------|
| Admin          | `/admin`     | Everything: approvals, venues, events, tiers, leaderboards, exports |
| Venue manager  | `/venue`     | Assigned venues only: events, guestlists, leaderboards, exports |
| Reception      | `/reception` | Door check-in for assigned venues (search, scan, manual)      |
| Promoter       | `/promoter`  | Own link, QR, stats, rank, tier progress, event history       |
| Public         | `/`, `/p/*`, `/g/*` | Apply, register as a guest, view own QR                 |

## Key flows

- **Promoter application** — `/` (public). 18+ check, unique email/mobile, five agreement
  checkboxes with timestamp + IP stored. Status starts `pending`; admin approves to mint a
  unique `promoter_code` and link `/p/{code}`.
- **Guest registration** — `/p/{code}`. Duplicate detection by mobile/email; one
  registration per guest per event. Produces a QR at `/g/{token}`.
- **Door check-in** — `/reception`. Venue + event select, live search, in-browser camera
  QR scan (html5-qrcode), manual check-in, no-entry, live counts and leaderboards via
  Supabase Realtime. One check-in per guest per event.
- **CSV export** — `/admin/exports`. Four HubSpot-ready exports with venue/event/date/
  promoter filters. Service-role read, gated by admin/venue-manager session.

## Security notes

- All tables have Row Level Security. Public writes only happen through
  `SECURITY DEFINER` RPCs (`submit_promoter_application`, `register_guest`) so base tables
  stay locked.
- Admin notes are admin-only and never exposed to promoters.
- Guest PII, DOB and contact details are readable only by admins, the owning promoter, and
  staff of the relevant venue.
- The `service_role` key is used only in server route handlers for exports; never shipped
  to the browser.

## Data model

`users, roles, venues, venue_managers, events, promoters, guests, guest_registrations,
check_ins, tiers, promoter_performance, admin_notes, audit_logs` — all with
`created_at`/`updated_at` where relevant. Audit log records applications, approvals,
rejections, suspensions, event creation, registrations, check-ins, no-entries and exports.

## Not in Phase 1 (by design)

Payments, commissions, SMS automation, HubSpot API integration, team-leader structures,
AI scoring. The schema and audit log leave room to add these later.
