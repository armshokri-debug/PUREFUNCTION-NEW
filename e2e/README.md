# Cloud end-to-end test

Drives the real app in a browser (coach, client and a stranger on separate devices) against an
in-memory fake of Supabase (`mock-supabase.cjs`: auth, the `sign-up` Edge Function, the tables with
the same access rules as `supabase/migrations`, video storage and the Realtime websocket).

```bash
VITE_SUPABASE_URL=https://mock.supabase.co VITE_SUPABASE_ANON_KEY=anon \
  npx vite build --outDir /tmp/dist-cloud
node e2e/cloud-flow.cjs /tmp/dist-cloud [screenshot dir]
```

Every line should print `PASS`. Needs Playwright with Chromium; not run in CI.
