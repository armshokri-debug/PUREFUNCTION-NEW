# AGENTS.md — Pure Function (read this first, every AI)

Owner: Armin (non-coder; answer him in **Persian script**, short and simple).
App: coaching PWA (like TrueCoach) for a coach in the US, up to ~100 clients. Coach uses iPad/laptop, clients use phones. Weight unit: **lb**.

## Links
- Repo: https://github.com/audiovido/Purefunction-2 (branch `main`)
- Live site: https://audiovido.github.io/Purefunction-2/ (auto-deploys from `main` only if `npm run lint` and `npm test` pass)
- Backend: Supabase project `pure-function-2` (ref `rugwzvztweiffprkxfdc`)
- Safe restore point: branch `backup/before-gemini-2026-10-27`

## Team roles
- **ChatGPT** = planner + reviewer. Talks with Armin, writes prompts for Gemini, reads the repo after each push and checks the diff.
- **Gemini (AI Studio)** = builder. Connected to the repo, pulls/pushes `main`. **Paused since 2026-11-01** (Armin's choice).
- **Claude** = lead + auditor. Clones the repo, applies ChatGPT's patch scripts on a branch, runs lint/test/build and the responsive check (`e2e/responsive-check.cjs`, must exit 0), opens the PR, and updates this file.
- While Gemini is paused, ChatGPT delivers changes as a **patch script** (exact find/replace, fail-closed, like `purefunction_responsive_pass.py`) based on the latest `main` SHA. Claude runs and verifies it. ChatGPT cannot push.

## Rules (all AIs)
1. One feature per Gemini prompt. Every prompt ends with: "npm run lint && npm test must pass, then push to main."
2. Don't change data logic when doing design work. Don't redraw the human body from scratch (BodyFigure is Gemini's; see `docs/BODY_FIGURE.md`).
3. **No horizontal scrolling anywhere**: no `overflow-x-auto` rows, no page side-scroll. Must work at 375px (phone), 768 and 1024px (iPad), and 1440px. Use wrapping, grids, selects, or bottom sheets instead. Grid children need `min-w-0`; use `grid-cols-1` explicitly.
4. Tap targets ≥ 44px. Input font ≥ 16px on phone. The phone bottom nav must not cover content.
5. **Database migrations need Armin's explicit OK.** Do not touch the old empty `messages` table (the live one is `coach_messages`).
6. After a big change, update the "Status" section below in the same push.
7. Show designs to Armin as a picture or mockup first, then build them.

## Code map
- Build: `npm install --legacy-peer-deps` · `npm run lint` (tsc) · `npm test` (vitest) · `npm run build`
- Demo mode: build without `VITE_SUPABASE_URL` → local sample clients (used for visual checks)
- Coach sidebar: Clients · Library · Programs · Messages (`src/App.tsx`)
- Client page `src/components/coach/ClientDetail.tsx`. Tabs: Exercises (Program / Exercise library / History) · Assessment (Overview / New assessment / Reports) · Notes · Goals · Progression · Nutrition
- Assessment Overview: `AssessmentSummary` → `SpectrumOfPatterns` → `BodyLab` (Body map + Movements) → `AssessmentHistory`
- Logic: `src/lib/spectrum.ts` (`clientFindings(client)` is the single source of findings: limited = below 90% of Full), `src/lib/bodyModel.ts`, figure in `src/components/BodyFigure.tsx`
- Client app: Today · Progress (Body map) · Chat · Refer
- Referrals: tables `referral_codes`, `referrals`, `credit_redemptions` (credit per invite is currently 0)
- Notes, Nutrition, Posture and spectrumTests live in `clients.data` JSON, so they need no migration.
- e2e: `e2e/cloud-flow.cjs` (mock Supabase); `e2e/responsive-check.cjs` (overflow crawler)

## Status (2026-11-01, night 2)
- Merged: responsive pass (#28), T0+T1 (#29).
- Merged #30 (ChatGPT pf_t2_t5.py, applied cleanly):
  - T2: e2e/cloud-flow.cjs updated. 52 checks pass (ALL PASSED).
  - T3: Program templates in Programs (save a week or 12 weeks, apply to several clients, logged days protected). Demo mode uses localStorage. Migration `supabase/migrations/20261101170000_pf2_program_templates.sql` was **applied on the live DB on 2026-11-01** (by Armin, with RLS and 3 policies; verified by Claude). Templates are live.
  - T4: unread badges on coach Messages and client Chat (uses the existing `coach_messages.read_at`; no migration).
  - T5: "+ Test Client" on Clients (labeled DEMO — NOT REAL; delete button; deleting it also deletes its workouts).
  - 79 tests pass; responsive-check 0/0; browser-checked templates and Test Client in demo mode.
- Done (Gemini, 2026-11-01): foreshortened poses in the non-natural views (hip flexion, SLR, shoulder flexion and others look right). Body map tags sit in gutters outside the body, with colored leader lines, sorted and non-overlapping (src/lib/labelLayout.ts). Gemini works in STRICT MODE: an allow-list of files, no push until Armin says "push", and Claude audits each push against a backup branch (latest: backup/before-gemini-2026-11-01).
- Open:
  1. Small pose polish: Hip flexion in Side view sits with no stool; Ankle in Side view holds the arm forward. At 375px the left-column tag touches the frame edge.
  2. Unread badges were not tested with two real signed-in devices.
  3. T6: plan for replacing the exercise videos (no code yet).

## Next ideas
- Auto joint detection on real photos (MediaPipe on phone) + photo analysis with green/red lines.
- Program templates for many clients; push notifications for new messages; a sample Test Client.

## Risks
- Exercise library videos belong to TrueCoach; replace them before commercial use.
- Coach and client editing the same workout day at the same time: the last save wins.
- The Spectrum of Patterns table is from Applied Integration Academy (credited under the table).
