# Browser validation

Install dependencies with `npm ci --legacy-peer-deps`, then `npx playwright install --with-deps chromium` on Ubuntu 24.04. Playwright is pinned in the lockfile. A system Chromium may be selected using `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.

```bash
npm run build
node e2e/responsive-check.cjs dist
node e2e/library.cjs dist
node e2e/pwa.cjs dist
VITE_SUPABASE_URL=https://mock.supabase.co VITE_SUPABASE_ANON_KEY=anon npx vite build --outDir dist-cloud --base=/
node e2e/cloud-flow.cjs dist-cloud
```

Responsive checks crawl the demo UI at 375, 768, 1024 and 1440 pixels. The cloud-flow suite drives verified signup, coach/client persistence, realtime updates, workout logging, media, reset links and isolation against an in-memory API. Its fixtures contain synthetic identities only. It does not send mail or write to production.

Mocks are application-contract tests, not a replacement for live RLS or authentication tests. Live read-only assertions and their limits are recorded in the recovery audit. Browser restrictions in the local workspace do not justify marking skipped browser tests as passed; run the CI workflow and inspect its logs.
