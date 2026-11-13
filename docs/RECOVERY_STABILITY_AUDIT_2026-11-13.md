# Recovery & Stability — baseline audit (2026-11-13)

## Status
- Working repository: `armshokri-debug/PUREFUNCTION-NEW`, `main` baseline `236417f437a158a95240b208d8c0a43de7dc0fa8`.
- Recovery branch: `recovery/stability-audit-20261113`.
- The existing GitHub Pages CI has previously reported successful type-check/test/build/deploy; this **does not** validate real coach/client workflows.
- Supabase project `rugwzvztweiffprkxfdc` is ACTIVE_HEALTHY, inspected read-only. No schema/data/credential changes in this audit.
- Actual source is older than the live database contract: migrations in Git do not fully describe current database schema.

## Confirmed schema mismatch
Current `public.clients` has `coach_id uuid` in addition to `id, email, data, updated_at`. Current database also has:
- `coach_client_assignments(coach_id, client_id)`
- `coach_notes_secure`
- `food_entries`, `food_items`, `favorite_meals`
- `posture_reviews_secure`, `posture_public_reports`
- `signup_verification_resends`

These are not represented by the source's basic `useCloudClientsStore` data model. Current app still relies on `profiles.role` coach/client and a single basic coach workspace. Do not assume multi-coach authorization is correct merely because the login works.

## Read-only production observations
- All 18 public tables enumerated had RLS enabled.
- Recent approximate table counts: 2 profiles, 4 clients, 11 workouts, 4 coach-client assignments and 1 secure posture review.
- The other named feature tables exist; their data/workflows must not be assumed active based on the schema alone.
- Six Edge Functions are deployed: sign-up, send-invite, reset-password, daily-reminders, invite-trainer, food-parse.
- Newer `invite-trainer` and `food-parse` are absent from the checked-in `supabase/functions` folder.

## Security / product blockers (verify before modifying)
1. **P0 — Recovery:** protect live data and take a verified PostgreSQL data/auth/storage backup separately from the offline source bundle; source archives alone do not include live records or uploaded media.
2. **P0 — Authorization:** confirm each coach only sees assigned clients and each client only their own records, including messages, workouts, secure notes and posture reviews. Verify RLS and RPC security under distinct test identities.
3. **P0 — Data integrity:** investigate whether the front-end full-client JSON upsert can overwrite or conflict with newer secure records and multi-coach assignment design. Test concurrent writes and deletes with isolated test accounts.
4. **P1 — Version parity:** recover trainer onboarding, protected notes, nutrition workflows, posture publish/review and templates in controlled increments, with exact UI acceptance tests.
5. **P1 — Deployment:** update stale links in AGENTS.md/README.md; avoid competing static and Vite deployment workflows; validate published base path.
6. **P1 — Secrets:** ensure no service-role keys or private user exports are checked into this public repo. Do not expose raw client records in issues or CI logs.

## Safe delivery sequence
- Snapshot DB/Auth/Storage privately; verify restore in an isolated project.
- Produce a schema-only diff against checked-in migrations, without modifying production.
- Add coach/client access-control tests with separate identities.
- Recover one missing workflow per branch (first independent-coach access); run TypeScript, unit, e2e and responsive checks.
- Review PR before merging or deploying. Never apply production SQL without explicit owner approval.

## Definition of done
A stable phase-1 release needs: a verified restorable full backup, matching and documented DB/code contract, passing multi-identity authorization tests, consistent role boundaries, clean CI, and a successful real-device coach/client smoke test.
