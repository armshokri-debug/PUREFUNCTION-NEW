# AGENTS.md — Pure Function

Owner: Armin. Answer him in short, simple Persian. He is not a programmer.

## Current project

- Repository: https://github.com/armshokri-debug/PUREFUNCTION-NEW
- Production: https://armshokri-debug.github.io/PUREFUNCTION-NEW/
- Supabase: `rugwzvztweiffprkxfdc`
- Recovery branch: `recovery/stability-2026-11-13`
- Read `README.md`, `docs/BODY_FIGURE.md` and `docs/RECOVERY_STABILITY_AUDIT_2026-11-13.md` first.

The owner's current mission authorizes direct development, testing, PR creation and release when critical checks pass. Old planner-only/Gemini/Claude role restrictions are superseded. Do not ask the owner to run routine commands.

## Non-negotiable rules

1. Never delete or overwrite real user data during maintenance. Never publish private records or credentials.
2. Every production database migration requires explicit owner approval. Source SQL and archived applied migrations are not approval. Never touch the old empty `messages` table; the active table is `coach_messages`.
3. Do not redraw or replace approved BodyFigure assets or change assessment/exercise logic as a design fix. Preserve the current Pure Function identity.
4. No horizontal scrolling at 375, 768, 1024 or 1440 pixels. Grid children need `min-w-0`. Use wrapping layouts and explicit single-column grids where needed. Touch targets must be at least 44px and phone inputs at least 16px.
5. Roles come from verified server profiles and RLS, never editable user metadata or a browser toggle. Cloud coaches and clients have separate workspaces. Demo role switches are local only.
6. Never put private coach notes in `clients.data`. Use the secure table. Clients may log workout results only through the existing restricted RPC and version token.
7. Do not merge or deploy with critical test failures. Never claim a mock test proves live email delivery or a real multi-account flow.
8. Update the audit and this status after major changes. The audit distinguishes implemented code, verified behavior and unfinished recovery work.

## Commands

`npm ci --legacy-peer-deps`, `npm run lint`, `npm test`, `npm run build`.

Browser checks: `e2e/responsive-check.cjs`, `e2e/cloud-flow.cjs`, `e2e/library.cjs`, `e2e/pwa.cjs`. See `e2e/README.md`.

## Code map

- `src/App.tsx`: coach/client workspaces and navigation.
- `src/cloud/useClientsStore.ts`: versioned profile/workout synchronization.
- `src/cloud/secureNotes.ts`: secure notes adapter.
- `src/cloud/Session.tsx`: login, verification and recovery.
- `src/components/coach/ClientDetail.tsx`: existing client features and assessment tabs.
- `src/components/BodyFigure.tsx`, `src/lib/bodyModel.ts`: approved figure and joint solver.
- `src/lib/spectrum.ts`: existing findings logic.
- `src/components/FoodDiary.tsx`: normalized diary adapter, separate from legacy targets.
- `src/components/PostureReports.tsx`: published client-safe summary projection.
- `src/components/coach/CoachAccounts.tsx`: existing head-coach invitation APIs.

## Status — 2026-11-13

Strict sign-in portal checks are being added on `fix/strict-signin-portals`. Coach credentials must be refused on Client sign-in and vice versa, using the database-owned role after credential verification. Recovery changes are tracked in PR #1; read its current checks and deployment record for the final release status. Source backup checksums and Git bundle restoration passed. Live read-only ownership/RLS assertions passed for the existing coach/client and an unknown authenticated identity. Local TypeScript, unit tests and build pass; 87 unit tests. Browser CI gates must pass on the release head. No production database changes or real-user test mail were performed.

Full database/Auth/Storage restoration, complete fresh-database migrations, real email delivery and the earlier private posture-review editor remain unverified or unavailable. Read the audit before claiming full recovery.
