# Luna Group Memberships — University Member workflow (handover)

This adds a **University Member** membership type to the existing Promoter OS **without changing any promoter functionality**. Promoter signup/login, unique links/codes, guest lists, check-in, CSV/HubSpot exports, admin accounts, venues and permissions are all untouched (purely additive migrations + new routes).

## What was built

**Public**
- `memberships.lunagroup.com.au` (and `/memberships`) — landing page with four options: Promoter, University Member, DJ (Coming Soon), Luna Group Staff (Coming Soon).
- Promoter tile → existing promoter application (unchanged, reused component at `/memberships/promoter`).
- University tile → `/memberships/university` — signup form collecting **only**: Full Name, Mobile, Email, Date of Birth, University ID Expiry Date, and an upload of the current university ID. Consents: Privacy & Terms (required), “ID belongs to me” (required), Marketing (optional, **not** pre-ticked).
- `/m/[token]` — member pass / status page (mobile-first). Approved members see the digital pass with a secure QR; other statuses see the correct message. `/m/[token]/reupload` lets a member submit a clearer/updated ID without creating a new account.

**Reception**
- `/verify/[token]` (staff-only, protected) — opens when reception scans the pass QR. Shows full name, membership type, institution, expiry, status, and whether a wristband was already issued this trading session. **Never shows the ID image.** “Issue Wristband” records the issuance; duplicates in the same venue/trading session are blocked with a prominent warning; managers/admins can override with a required reason (audit-logged).

**Admin** (`/admin/university`, admin or venue_manager)
- Stats: total, approved, pending, manual review, rejected, suspended, wristbands tonight.
- Manual-review queue with submitted vs AI-extracted fields, per-check flags, confidence, summary and reasons; actions: Approve / Reject / Request new ID / Suspend (reason required for reject/suspend), plus a **secure ID preview** (60-second signed URL, admin/manager only, access logged).
- Members list with filters: status, institution, search (name/email/mobile), applied-date range, expiry range.

**AI verification** — `src/lib/verification/` (`UniversityIdVerificationService`, OpenAI GPT-4o). Extracts name/institution/expiry and assesses is-university-ID / current / clear / name-match / expiry-match / tampering / confidence. The **authoritative approve/reject/manual-review decision is made in the `apply_university_verification` Postgres RPC** so a malformed AI response can never auto-approve. Only the image + submitted name/expiry are sent to the model; `store:false` (no retention/training).

## Approval rules
- **Auto-approve** only when confidence ≥ **71** AND is_university_id AND is_current AND name_matches AND expiry_matches AND NOT possible_tampering AND image_is_clear.
- **Reject** only on clear cases: expired card, under-18, clearly not a tertiary ID.
- **Manual review** for everything else (≤ 70, unclear, mismatches, uncertain type, possible tampering, AI failure/invalid JSON).

## Database (additive; project `fiquraregaucwnrjhwqx`)
New tables: `contacts`, `membership_types`, `memberships`, `university_verifications`, `membership_documents`, `document_retention_policy`, `wristband_issuances`, `membership_audit_log`. New enum `membership_status`. New private storage bucket `university-ids`. New RPCs listed in `supabase/migrations/0039_university_rpcs.sql`. RLS enabled on all new tables (admin-only direct access; app uses SECURITY DEFINER RPCs). Migrations: `supabase/migrations/0038_university_memberships.sql`, `0039_university_rpcs.sql` (already applied to the live DB via Supabase migration history versions `20260715*`).

Application statuses stored: `pending_verification`, `approved`, `manual_review`, `rejected`, `suspended`. Submitted and extracted expiry dates are stored cleanly so expiry monitoring can be added later — **no expiry-monitoring workflow was built this phase (intentional).**

## New environment variables (server-only)
```
OPENAI_API_KEY=...                 # GPT-4o vision (server only, never in browser)
OPENAI_VERIFICATION_MODEL=gpt-4o   # optional override
RESEND_API_KEY=...                 # already used by guest emails; required for university emails
NEXT_PUBLIC_MEMBERSHIPS_URL=https://memberships.lunagroup.com.au   # optional; falls back to NEXT_PUBLIC_SITE_URL
SUPABASE_SERVICE_ROLE_KEY=...      # already present; used for uploads + signed URLs
```

## Setup
1. Add `OPENAI_API_KEY` (and confirm `RESEND_API_KEY`) to the app’s environment (Vercel project env / `.env.local`).
2. Point DNS/host for `memberships.lunagroup.com.au` at the same app (the home route serves the membership picker for that host). `promoter.*` and `guestlist.*` are unchanged.
3. Deploy through the existing pipeline. Database + bucket are already applied on the live Supabase project.

## Testing
- Backend decision engine + signup validated by a rolled-back SQL harness — **14/14 pass**: signup age/consent/duplicate gates; confidence 85→approved, 71→approved, 70→manual review; name/expiry mismatch, unclear image, tampering→manual review; not-a-uni-ID→rejected; expired→rejected; malformed AI→manual review.
- `next build` passes with no type/lint errors (all 44 routes compile).
- Reception/admin auth paths are enforced in the RPCs (`manages_venue`, `is_admin`/`has_role`) and middleware (`/verify` now protected).

## Deployment steps
1. Set env vars → 2. Add memberships host → 3. Deploy app → 4. Smoke test: `/memberships`, submit a University application with a test ID image, confirm status page + email, approve via `/admin/university`, open `/m/<token>`, scan → `/verify/<token>`, issue a wristband, re-scan to see the duplicate warning.

## Rollback
- App: revert the feature branch / commit.
- Database: additive only — run the rollback block at the bottom of `0038_university_memberships.sql` (drops new objects + bucket). **No promoter data is affected.**

## Limitations / follow-ups
- **HEIC/PDF** uploads are stored securely but routed to **manual review** (not sent to GPT-4o). JPG/PNG/WEBP are auto-verified. Add `heic-convert` / PDF rasterisation later to auto-verify those too.
- Rate limiting on signup is best-effort in-memory (per warm serverless instance). Use a shared store (e.g. Upstash) for strict global limits.
- Document retention config exists (`document_retention_policy`, auto-delete **OFF**); no scheduled deletion job is built yet (by design).
- Pre-existing note (not part of this work): `public.birthday_reminders` has RLS disabled. Remediation is available but was **not** applied here.
