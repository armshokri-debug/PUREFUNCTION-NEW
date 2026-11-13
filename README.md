# Pure Function 2

Assessment-driven coaching app (PRI, InBody 270, ROM, gait, strength) for a coach and up to ~100 clients.
Live: https://audiovido.github.io/Purefunction-2/

## Two modes

| | Demo | Cloud |
|---|---|---|
| When | `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` not set (local dev, AI Studio) | set (the deployed site) |
| Data | sample clients, saved in this browser | real accounts in Supabase, synced live across devices |
| Sign-in | none (Coach / Client switch) | email + password |

## Cloud (Supabase project `pure-function-2`)

- **Coach**: only the email in `private.settings.coach_email` (currently `arm.shokri@gmail.com`). To hand
  the app to the coach, change it in SQL:
  `update private.settings set value = 'coach@their-domain.com' where key = 'coach_email';`
  then the coach creates an account with that email.
- **Clients**: the coach adds a client with their email; the client taps *Create an account* with that
  same email. Nobody else can create an account (the `sign-up` Edge Function checks the list and creates
  the account already confirmed, so no confirmation email is needed).
- **Data**: `clients` (one row per client profile), `workouts` (one row per workout day), `exercises`
  (coach's own and edited exercises), `exercise-videos` storage bucket (private, signed links).
  Row Level Security: the coach sees everything; a client only their own profile and workouts.
- Setup lives in `supabase/migrations` and `supabase/functions/sign-up`.

## Development

```bash
npm install --legacy-peer-deps
npm run dev      # demo mode at http://localhost:3000
npm run lint     # type check
npm test         # unit tests (dates, progression, copying, migration, video links)
npm run build
```

Cloud browser test (coach + client + stranger against an in-memory Supabase): see `e2e/README.md`.

Pushes to `main` run type check + tests, build with the cloud settings and deploy to GitHub Pages.

## Known limits

- Password reset by email is not set up yet (needs an email service such as Resend).
- Progress charts and monthly reports still use the assessment sample model; for new clients they show
  an empty state until real assessments are recorded.
- The imported 1,221-exercise library links to third-party demo videos (YouTube / Vimeo); the coach can
  replace any of them with their own video.
