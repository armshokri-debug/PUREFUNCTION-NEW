# Pure Function

Assessment-driven coaching PWA with independent coach rosters, client workouts, exercise programs, assessments and messaging.

Production: https://armshokri-debug.github.io/PUREFUNCTION-NEW/

Repository: https://github.com/armshokri-debug/PUREFUNCTION-NEW

## Development and validation

Use Node 22 or later.

```bash
npm ci --legacy-peer-deps
npm run dev
npm run lint
npm test
npm run build
```

Without `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, the app uses local sample data. A cloud build requires both variables; only a publishable key belongs in the browser. Never put a service-role key in a Vite variable.

Browser validation is documented in [e2e/README.md](e2e/README.md). GitHub Actions runs checks at 375, 768, 1024 and 1440 pixels, library/PWA checks and isolated cloud-flow tests. Production deployment builds the React application and requires responsive/cloud validation; it never publishes the repository as static source.

## Access and data

Supabase project: `rugwzvztweiffprkxfdc`.

- Coach access requires a database profile, a verified email and membership in the private coach allowlist. The existing head-coach API manages invitations.
- New clients are owned by their creating coach. Ownership is immutable; the app does not transfer clients between coaches.
- Clients use their invited email and verify it before login. The database determines their role and linked client ID.
- RLS controls access to clients, workouts, notes, messages, food records and private media.
- Coach notes use `coach_notes_secure`; do not embed private notes in `clients.data`.
- Clients log results through `save_workout_results_secure`; prescriptions remain coach-owned. A stale version requires a reload rather than overwriting another device's work.
- Assessments, Body Map, ROM/PRI/strength testing and historical data keep their existing model and illustrations.
- Food diary entries use the existing normalized food RPC; legacy targets and daily logs remain available.
- Internal posture reviews stay private. Published summaries come from `posture_public_reports`.
- Exercise edits/media use the existing shared catalog model. Do not put private client information in the exercise library.

## Recovery and production changes

Read [the recovery audit](docs/RECOVERY_STABILITY_AUDIT_2026-11-13.md) before changing production.

The source Git bundle was restored and verified. A source backup does **not** include database rows, Auth accounts, Storage objects or secrets. Full production restore remains unverified.

`supabase/schema-reference-2026-11-13.json` is a metadata-only reference. Applied ownership SQL is archived under `supabase/recovered_migrations/`. Imported migration filenames have drifted from production history and do not form a complete fresh-install baseline. Do not replay migrations against the live project. All production migrations require explicit owner approval and a separate private backup/restore drill.

Recovered Edge Function sources preserve the deployed implementations with a tested normalization of retired production links to this site. PR #1 records function deployment and public smoke results. No real-user test emails are sent; verify Resend/domain configuration and inbox delivery before promising email delivery.

## Known limitations

The earlier private posture-review editor is absent from this repository history; existing drafts are preserved. Automated food/photo parsing, favorite-meal authoring and real email delivery have not been verified by this release. Refer to the audit for current release gates and security-advisor findings.
