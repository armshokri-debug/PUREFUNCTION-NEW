# Recovery and stability audit — 2026-11-13

## Scope and release contract

Repository: https://github.com/armshokri-debug/PUREFUNCTION-NEW

Production: https://armshokri-debug.github.io/PUREFUNCTION-NEW/

Supabase: `rugwzvztweiffprkxfdc`. Work is on `recovery/stability-2026-11-13`.
No production DDL, migrations, Auth account changes, or application-record edits are authorized by this audit.
Merge only after required validation passes. Source migration files are not permission to execute SQL.

## Recovery evidence

- Inspected all four commits in the new repository through baseline `236417f`.
- The requested audit file did not exist at that baseline.
- Verified SHA256 checksums for the owner's source recovery ZIP and complete Git bundle.
- Cloned the bundle locally and verified it with `git bundle verify`; source assets and all four commits restored.
- This is a successful **source restoration drill**, not a production database restoration drill.
- The existing source backup excludes live database rows, Auth accounts, private Storage bytes, service secrets, email configuration, and hosting settings. Its own README correctly says so.
- Added a dependency lockfile so installs use reproducible package versions.
- Archived the two applied November 5 ownership migrations under `supabase/recovered_migrations/`.
- Captured live column, constraint, policy, grant, trigger and function definitions in `supabase/schema-reference-2026-11-13.json`. It contains no client rows or credentials and is **not a restorable full backup**.
- Recovered all six deployed Edge Function implementations, including previously absent `invite-trainer` and `food-parse`.

## Database comparison

Production contains `coach_notes_secure`, `food_entries`, `food_items`, `favorite_meals`, `posture_reviews_secure`, `posture_public_reports`, independent coach ownership and `save_workout_results_secure` which the imported frontend did not use.
Migration filenames in the imported repository do not match all applied versions; several changes were made outside recorded migration history. Never replay the old migration directory against production.

Read-only integrity checks found four client records, eleven workouts, no ownerless clients, no orphan workouts and no public Storage buckets. One coach and one client account were present; no second real coach was created for testing.

## Implemented repairs

- Cloud roles come from the database profile. Role preview switches are available only in local demo mode.
- Key cloud workspaces by account ID and reject invalid profile roles; ignore stale profile requests after logout/account changes.
- Handle the deployed signup email-verification contract, consume verification links and provide a resend action. Recovery tokens are removed from the URL before use.
- Read/write coach notes in the secure table. Never put them into the client-readable profile JSON. Clients only render the server-filtered shared notes.
- Send client workout results through the existing restricted RPC with a version token and an explicit field whitelist. Clients cannot upload a replacement prescription.
- Use version-conditional profile/workout updates and deletes. Conflicts stop automatic retries and require a fresh load. Pending local changes are not replaced by incoming realtime updates.
- Restore the existing normalized food diary contract with manual portion/calorie/protein entry, unknown-value handling, server-side authorization and an idempotency key. Keep legacy nutrition targets and daily logs.
- Display client-safe published posture summaries from the existing report projection. Keep the approved body illustration, movement solver, PRI/ROM/strength testing and assessment history intact.
- Restore head-coach account invitation controls through the existing RPCs; client ownership remains automatic and cannot be transferred by this UI.
- Show unavailable template/data states rather than silently hiding them.
- Remove the competing Pages workflow which published the repository directly. Deploy built output only after validation.
- Pin browser CI to supported Ubuntu 24.04, add responsive/cloud/library/PWA checks and fix test mocks to reflect independent coach ownership and verified signup.
- Upgrade vulnerable development test dependencies; npm audit returned zero findings after the upgrade.

## Security verification

Inspected live RLS policies and privileged function bodies, not just the RLS enabled flags.
A read-only transaction impersonated each existing account using JWT claim settings and the `authenticated` role, then rolled back. Assertions passed for:

- Coach client rows belong to that coach.
- Client profiles and workouts belong only to that client.
- Clients cannot select private coach notes or internal posture reviews.
- An unknown authenticated subject cannot select clients, workouts or secure notes.

This does not replace a test with two independently verified real coaches. Mock tests are separately labeled and never claimed as live authentication or email-delivery tests.

Existing Supabase advisors identify extension placement, public referral RPCs, authenticated SECURITY DEFINER APIs, and disabled leaked-password protection. The legitimate RPCs were reviewed for authorization checks; advisor warnings are not automatically proof of a bypass. Private backup/allowlist tables with RLS and no policies intentionally deny access. No advisor-driven production SQL was executed.

## Remaining limits and release gates

- Full disaster recovery remains unverified until a private database/Auth/Storage backup is restored to an isolated project. Never test restore against production.
- The recovered schema reference and archived migrations do not establish a clean, replayable schema from an empty database; dependencies and migration-history drift need an approved isolated reconciliation.
- No real invitation, signup, password-reset delivery, or two-device account test was performed. Sending mail to real users was not used as a test fixture.
- Hosted email functions may have `APP_URL` configured for the old site; source fallback URLs must be reconciled before claiming email links land on the new production URL. Secrets were not read or changed.
- The full earlier private Posture interpretation/review interface is not present in this source history. Existing secure drafts are preserved; this repair exposes published summaries, not a fabricated replacement editor.
- Automatic food parsing, photo nutrition, favorite-meal editing and historical review authoring are not verified by this release. The existing data and deployed parsing function are preserved.
- Exercise edits and exercise videos use the existing shared library authorization model, not per-coach ownership. Do not store private client information in the shared catalog.
- Live concurrent coach/client workout edits are rejected on a stale version; automatic merge of conflicting edits is intentionally not attempted.

## Validation record

Local TypeScript checks, unit suite and production build passed; the suite has 85 tests after recovery-contract coverage was added.
Local Chromium execution is restricted by the workspace; browser validation runs in GitHub Actions.
The final CI run and merge/deployment status must be recorded below after execution, with no claim of production success while required checks are failing.

Release status: validation in progress; PR #1 is a draft. Production has not been changed by this branch.
