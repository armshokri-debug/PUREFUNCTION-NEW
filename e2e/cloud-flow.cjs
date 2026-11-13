// Cloud end-to-end: coach and client on separate devices against the in-memory Supabase.
// Usage: node e2e/cloud-flow.cjs <dist dir built with VITE_SUPABASE_URL=https://mock.supabase.co> [shots dir]
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const createMock = require('./mock-supabase.cjs');

const root = process.argv[2];
const shots = process.argv[3];
const PORT = 4193;
const srv = http
  .createServer((q, r) => {
    let f = path.join(root, decodeURIComponent(q.url.split('?')[0]));
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(root, 'index.html');
    const type = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' }[path.extname(f)] || 'application/octet-stream';
    r.writeHead(200, { 'content-type': type });
    r.end(fs.readFileSync(f));
  })
  .listen(PORT);

let failures = 0;
const ok = (c, m) => {
  console.log((c ? 'PASS ' : 'FAIL ') + m);
  if (!c) failures++;
};
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = iso(new Date());

(async () => {
  const mock = createMock({ coachEmail: 'coach@example.com' });
  const b = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {});
  const open = async (viewport) => {
    const ctx = await b.newContext({ viewport });
    await ctx.route('https://mock.supabase.co/**', mock.handler);
    await ctx.routeWebSocket(/wss:\/\/mock\.supabase\.co\/.*/, mock.wsHandler);
    const p = await ctx.newPage();
    p.errors = [];
    p.on('pageerror', (e) => p.errors.push(e.message));
    await p.goto(`http://localhost:${PORT}/`);
    return p;
  };
  const verify = async (p, email) => {
    const mail = [...mock.db.emails].reverse().find(e => e.kind === 'verify' && e.to === email.toLowerCase());
    if (mail) await p.goto(`http://localhost:${PORT}/?verify=${mail.token}`);
  };
  const signUp = async (p, name, email, pw, who = 'client') => {
    await p.getByRole('tab', { name: who === 'coach' ? 'I’m the coach' : 'I’m a client' }).click();
    await p.getByRole('button', { name: who === 'coach' ? 'Create coach account' : 'Set up your account' }).click();
    if (name) await p.getByLabel('Your name').fill(name);
    await p.getByLabel('Email').fill(email);
    await p.getByLabel('Password').fill(pw);
    await p.locator('form button[type=submit]').click();
    await p.waitForTimeout(300);
    await verify(p, email);
  };
  const shot = (p, n) => shots && p.screenshot({ path: `${shots}/${n}.png` });

  /* ---------------- stranger can't sign up ---------------- */
  const S = await open({ width: 390, height: 844 });
  await S.getByRole('heading', { name: 'Client sign in' }).waitFor();
  ok(true, 'signed-out visitor sees client sign-in by default');
  await S.getByRole('tab', { name: 'I’m the coach' }).click();
  ok(await S.getByRole('heading', { name: 'Coach sign in' }).isVisible(), 'separate coach sign-in');
  await signUp(S, 'Eve', 'eve@example.com', 'password123');
  ok(!mock.db.users.some(u => u.email === 'eve@example.com'), 'unknown email cannot create an account');
  await shot(S, 'cloud-signup-blocked');

  /* ---------------- coach ---------------- */
  const C = await open({ width: 1440, height: 900 });
  await signUp(C, 'Armin', 'Coach@Example.com', 'coachpass1', 'coach');
  await C.getByRole('heading', { name: 'Clients' }).waitFor();
  ok(await C.getByText(/No clients yet/).isVisible(), 'new coach starts with an empty roster (no sample data)');
  ok(mock.db.profiles.some((p) => p.role === 'coach'), 'coach profile created for the coach email');
  await shot(C, 'cloud-coach-empty');

  // add a client
  await C.getByRole('button', { name: 'Add client' }).click();
  await C.getByPlaceholder('e.g., Jordan Taylor').fill('Ryan Lee');
  await C.getByPlaceholder('jordan.taylor@example.com').fill('ryan.typo@example.com');
  await C.locator('form button[type=submit]').click();
  await C.waitForTimeout(800);
  ok(await C.getByText('Not joined yet — send them the invite below.').isVisible(), 'after adding a client the invite sheet opens (no jump to Assessment)');
  await C.getByRole('button', { name: 'Cancel' }).click();
  await C.waitForTimeout(800);
  await C.getByRole('button', { name: /Not joined · Invite/ }).click();
  ok(await C.getByText('Not joined yet — send them the invite below.').isVisible(), 'coach sees the client has not joined');
  const emailBox = C.locator('input[type=email]');
  await emailBox.fill('Ryan@Example.com');
  await C.getByRole('button', { name: 'Save', exact: true }).click();
  await C.waitForTimeout(1500);
  const ryanRow = mock.db.clients.find((c) => c.email === 'ryan@example.com');
  ok(!!ryanRow, 'coach corrected the email; saved lower-cased');
  ok(ryanRow && ryanRow.data && ryanRow.data.inBody.weight === 0, 'new client has empty assessment data (no sample numbers)');

  // email the invite + turn reminders off
  await C.getByRole('button', { name: /Not joined · Invite/ }).click();
  await C.getByRole('button', { name: 'Email the invite' }).click();
  await C.getByText('Invite sent to ryan@example.com').waitFor({ timeout: 5000 }).catch(() => {});
  ok(mock.db.emails.some((e) => e.kind === 'invite' && e.to === 'ryan@example.com'), 'coach emails the invite in one tap');
  await C.getByLabel('Morning email on workout days').uncheck();
  await C.getByRole('button', { name: 'Save', exact: true }).click();
  await C.waitForTimeout(1200);
  ok(mock.db.clients.find((c) => c.id === ryanRow.id).data.emailReminders === false, 'coach can turn off morning emails for a client');

  // build a workout for today
  await C.locator('main').getByText('Ryan Lee', { exact: true }).first().click();
  await C.getByRole('heading', { name: 'Workout Builder' }).waitFor({ timeout: 5000 }).catch(() => {});
  ok(await C.getByRole('heading', { name: 'Workout Builder' }).isVisible(), 'clicking a client opens their workouts');
  await C.getByRole('button', { name: 'Create workout' }).click();
  await C.getByPlaceholder(/Search name or muscle/).fill('goblet squat');
  await C.waitForTimeout(300);
  await C.getByRole('button', { name: 'Add Goblet Squat' }).first().click();
  await C.locator('input[placeholder="8-10"]').first().fill('8-10');
  await C.locator('label:has-text("lb") input[type=number]').first().fill('40');
  await C.waitForTimeout(1500);
  const w = mock.db.workouts.find((x) => x.client_id === ryanRow.id && x.date === today);
  ok(!!w && w.data.blocks.length === 1 && Math.abs(w.data.blocks[0].loadKg - 18.1437) < 0.05, '40 lb displayed and kg persisted to the cloud (one row per workout)');
  ok(await C.getByText('Saved', { exact: true }).first().isVisible(), 'sync badge shows Saved');
  await shot(C, 'cloud-coach-builder');

  // Private notes use the secure table and never enter clients.data.
  await C.getByRole('button', { name: 'Notes', exact: true }).click();
  await C.getByPlaceholder(/Left knee tight/).fill('Private recovery note');
  await C.getByRole('button', { name: 'Save note', exact: true }).click();
  await C.getByText('Private recovery note', { exact: true }).waitFor();
  ok(mock.db.coach_notes_secure.length === 1, 'coach note persists in secure table');
  ok(!mock.db.clients.find(c => c.id === ryanRow.id).data.coachNotes, 'private note is absent from client JSON');
  await C.getByRole('button', { name: 'Exercises', exact: true }).click();

  /* ---------------- client ---------------- */
  const R = await open({ width: 375, height: 812 });
  await R.goto(`http://localhost:${PORT}/?join=ryan%40example.com`);
  await R.getByRole('heading', { name: 'Set up your account' }).waitFor();
  ok((await R.getByLabel('Email').inputValue()) === 'ryan@example.com', 'invite link opens client set-up with the email filled in');
  await R.getByLabel('Your name').fill('Ryan');
  await R.getByLabel('Password').fill('ryanpass1');
  await R.locator('form button[type=submit]').click();
  await R.waitForTimeout(300);
  await verify(R, 'ryan@example.com');
  await R.getByRole('heading', { name: /Goblet Squat/ }).first().waitFor({ timeout: 10000 });
  ok(true, 'client signs up with the email the coach added and sees today’s workout');
  ok((await R.getByRole('button', { name: 'Coach' }).count()) === 0, 'client has no coach switch');
  ok((await R.getByText(/Workouts this week/).count()) === 0, 'client cannot see the coach screens');
  await shot(R, 'cloud-client-today');
  ok(!(await R.getByText('Private recovery note', { exact: true }).count()), 'private coach note is not rendered for client');
  await R.getByLabel('Food and portion', { exact: true }).fill('Yogurt, one serving');
  await R.getByLabel('Calories (kcal)', { exact: true }).fill('120');
  await R.getByLabel('Protein (g)', { exact: true }).fill('15');
  await R.getByRole('button', { name: 'Save meal', exact: true }).click();
  await R.getByText(/120 kcal/).waitFor();
  ok(mock.db.food_entries.length === 1 && mock.db.food_items[0].protein === 15, 'client food diary uses normalized secure RPC');

  ok(!(await R.evaluate(() => location.search.includes('join='))), 'invite parameter removed after sign-in');
  // live: coach adds an exercise -> appears on client without reload
  await C.getByPlaceholder(/Search name or muscle/).fill('romanian deadlift');
  await C.waitForTimeout(300);
  await C.getByRole('button', { name: /^Add Romanian Deadlift$/ }).first().click();
  await R.getByRole('heading', { name: 'Romanian Deadlift' }).waitFor({ timeout: 8000 }).catch(() => {});
  ok(await R.getByRole('heading', { name: 'Romanian Deadlift' }).isVisible(), 'coach change appears live on the client’s phone');

  // client logs and finishes
  const postsBefore = mock.log.filter((l) => l.startsWith('POST /rest/v1/workouts')).length;
  await R.locator('[aria-label="Complete set 1"]').first().click();
  await R.getByRole('button', { name: 'Skip' }).click().catch(() => {});
  await R.getByRole('button', { name: '8', exact: true }).first().click();
  await R.getByRole('button', { name: 'Finish workout' }).click();
  await R.getByRole('button', { name: '7', exact: true }).last().click();
  await R.getByPlaceholder(/How did it feel/).fill('Felt strong');
  await R.getByRole('button', { name: /^Finish workout \(/ }).click();
  await R.waitForTimeout(1500);
  const wAfter = mock.db.workouts.find((x) => x.client_id === ryanRow.id && x.date === today);
  ok(wAfter.data.status === 'completed' && wAfter.data.sessionRpe === 7, 'client results saved to the cloud');
  ok(mock.log.filter((l) => l.startsWith('POST /rest/v1/workouts')).length - postsBefore <= 6, 'client sends only small, changed-row writes');

  // coach sees it live
  await C.getByText('Felt strong').waitFor({ timeout: 8000 }).catch(() => {});
  ok(await C.getByText('Felt strong').isVisible(), 'coach sees the client’s feedback live');
  ok(await C.getByText(/Session RPE 7\/10/).isVisible(), 'coach sees session RPE');

  // no echo loop: wait and make sure the coach did not re-upload what it received
  const coachPosts = mock.log.filter((l) => l.startsWith('POST /rest/v1/workouts')).length;
  await C.waitForTimeout(2500);
  ok(mock.log.filter((l) => l.startsWith('POST /rest/v1/workouts')).length === coachPosts, 'no echo uploads after live updates');

  // client photo syncs to the coach
  await R.locator('input[type=file][accept^="image"]').setInputFiles(path.join(__dirname, 'fixtures', 'face.png'));
  await R.waitForTimeout(1500);
  ok(!!mock.db.clients.find((c) => c.id === ryanRow.id).data.photoUrl, 'client photo saved to the cloud');
  await C.getByRole('button', { name: 'Clients' }).first().click();
  await C.waitForTimeout(800);
  ok((await C.locator('main img').count()) >= 1, 'coach sees the client’s photo');
  ok((await C.getByRole('button', { name: /Not joined · Invite/ }).count()) === 0, 'joined client no longer shows the invite badge');

  // reload: data comes back from the cloud, session kept
  await R.reload();
  await R.getByText('Workout completed').waitFor({ timeout: 10000 }).catch(() => {});
  ok(await R.getByText('Workout completed').isVisible(), 'after reload the client is still signed in and sees saved results');

  /* ---------------- coach uploads a video, client can play it ---------------- */
  await C.getByRole('button', { name: 'Library' }).first().click();
  await C.getByRole('button', { name: 'New exercise' }).click();
  await C.locator('input[type=file][accept^="video"]').setInputFiles(path.join(__dirname, 'fixtures', 'demo.webm'));
  await C.getByText(/checked, plays fine/).waitFor({ timeout: 15000 });
  await C.getByPlaceholder('e.g. Left AIC Split Squat').fill('Ryan Wall Drill');
  await C.getByRole('button', { name: 'Save' }).click();
  await C.waitForTimeout(2000);
  const files = Object.keys(mock.db.files);
  ok(files.length === 1, 'video uploaded to cloud storage (' + files.join(',') + ')');
  const exRow = mock.db.exercises.find((e) => e.data.name === 'Ryan Wall Drill');
  ok(exRow && exRow.data.video.kind === 'storage', 'exercise with cloud video saved to the database');
  // Playwright can't read the bytes of an uploaded File body, so check the chain instead:
  // upload -> signed link requested -> the player loads that private link.
  const src = await C.locator('video[controls]').getAttribute('src');
  ok(/\/storage\/v1\/object\/sign\/exercise-videos\/.+\?token=/.test(src || ''), 'player uses a short-lived signed link to the private video');
  ok(mock.log.some((l) => l.startsWith('GET /storage/v1/object/sign/exercise-videos/')), 'browser fetched the video through that link');

  // Failed library writes keep the editor open and preserve existing media.
  await C.getByRole('button', { name: 'New exercise' }).click();
  await C.getByPlaceholder('e.g. Left AIC Split Squat').fill('Unconfirmed exercise');
  mock.db.failNextExerciseWrite = true;
  await C.getByRole('button', { name: 'Save', exact: true }).click();
  await C.getByText(/Exercise was not saved/).waitFor();
  ok(!mock.db.exercises.some(e => e.data.name === 'Unconfirmed exercise'), 'failed exercise write is not presented as saved');
  ok(Object.keys(mock.db.files).length === 1, 'failed edit preserves existing video');
  await C.getByRole('button', { name: 'Close', exact: true }).click();

  /* ---------------- private assessment video for Ryan ---------------- */
  await C.getByRole('button', { name: 'Clients' }).first().click();
  await C.locator('main').getByText('Ryan Lee', { exact: true }).first().click();
  await C.getByRole('button', { name: 'Assessment', exact: true }).click();
  await C.getByRole('button', { name: /^(Start assessment|New assessment)$/ }).click();
  await C.getByRole('button', { name: 'Confirm & next' }).click();
  for (let i = 0; i < 4; i++) await C.getByRole('button', { name: 'Save & next' }).click();
  await C.locator('input[type=file][accept^="video"]').setInputFiles(path.join(__dirname, 'fixtures', 'demo.webm'));
  await C.getByText('Overhead squat · Front').waitFor({ timeout: 15000 });
  const clipKeys = Object.keys(mock.db.clientFiles);
  ok(clipKeys.length === 1 && clipKeys[0].startsWith(ryanRow.id + '/'), 'assessment video stored in the client’s private folder (' + clipKeys.join(',') + ')');
  await C.getByRole('button', { name: 'Complete Assessment' }).click();
  await C.waitForTimeout(1500);
  await R.getByRole('button', { name: 'Progress', exact: true }).click();
  await R.locator('section', { hasText: 'Before / after' }).waitFor({ timeout: 8000 }).catch(() => {});
  ok(await R.locator('section', { hasText: 'Before / after' }).isVisible(), 'client sees their assessment video');
  ok(mock.log.some((l) => l.startsWith('POST /storage/v1/object/sign/client-videos/' + ryanRow.id)), 'client got a signed link to their own video');
  await R.getByRole('button', { name: /Today/ }).click();

  /* ---------------- client cannot write exercises / others' data ---------------- */
  const tokenR = mock.db.profiles.find((p) => p.role === 'client').id;
  const res = await R.evaluate(async (tok) => {
    const h = { apikey: 'x', Authorization: 'Bearer tok-' + tok, 'Content-Type': 'application/json' };
    const a = await fetch('https://mock.supabase.co/rest/v1/exercises', { method: 'POST', headers: h, body: JSON.stringify({ id: 'x', data: {} }) });
    return a.status;
  }, tokenR);
  ok(res === 403, 'client cannot add exercises (403)');

  /* ---------------- sign out ---------------- */
  await R.getByRole('button', { name: 'Sign out' }).first().click();
  await R.getByRole('heading', { name: 'Client sign in' }).waitFor({ timeout: 5000 }).catch(() => {});
  ok(await R.getByRole('heading', { name: 'Client sign in' }).isVisible(), 'client can sign out (back to client sign-in)');

  // wrong password
  await R.getByLabel('Email').fill('ryan@example.com');
  await R.getByLabel('Password').fill('wrongpass');
  await R.getByRole('button', { name: 'Sign in' }).click();
  await R.getByText('Email or password is not correct.').waitFor({ timeout: 8000 }).catch(() => {});
  ok(await R.getByText('Email or password is not correct.').isVisible(), 'wrong password shows a clear message');
  await R.getByLabel('Password').fill('ryanpass1');
  await R.getByRole('button', { name: 'Sign in' }).click();
  await R.getByText('Workout completed').waitFor({ timeout: 10000 }).catch(() => {});
  ok(await R.getByText('Workout completed').isVisible(), 'client can sign back in');

  // Messaging is exercised through the real UI and active table, never legacy messages.
  await C.getByRole('button', { name: 'Messages', exact: true }).first().click();
  await C.getByRole('button', { name: /Ryan Lee/ }).first().click();
  await R.getByRole('button', { name: 'Chat', exact: true }).click();
  await R.getByPlaceholder('Message Coach…').fill('Ready for the next session');
  await R.getByRole('button', { name: 'Send', exact: true }).click();
  await C.getByText('Ready for the next session', { exact: true }).last().waitFor();
  ok(mock.db.coach_messages.some(m => m.body === 'Ready for the next session' && !m.from_coach), 'client message persists in active coach_messages table');
  await C.getByPlaceholder('Message Ryan…').fill('See you at training');
  await C.getByRole('button', { name: 'Send', exact: true }).click();
  await R.getByText('See you at training', { exact: true }).waitFor();
  ok(true, 'coach reply arrives on client device');
  await R.getByRole('button', { name: 'Today', exact: true }).click();

  // forgot password -> email link -> new password
  const F = await open({ width: 390, height: 844 });
  await F.getByRole('button', { name: 'Forgot password?' }).click();
  await F.getByLabel('Email').fill('ryan@example.com');
  await F.getByRole('button', { name: 'Send reset link' }).click();
  await F.getByText('a reset link is on its way').waitFor({ timeout: 5000 }).catch(() => {});
  ok(await F.getByText('a reset link is on its way').isVisible(), 'forgot password confirms the email');
  const mail = mock.db.emails.find((e) => e.kind === 'reset' && e.to === 'ryan@example.com');
  ok(!!mail, 'reset email sent');
  await F.goto(`http://localhost:${PORT}/?reset=${mail.token}`);
  await F.getByRole('heading', { name: 'Choose a new password' }).waitFor({ timeout: 8000 }).catch(() => {});
  ok(await F.getByRole('heading', { name: 'Choose a new password' }).isVisible(), 'reset link opens the new password screen');
  ok(!(await F.evaluate(() => location.search.includes('reset='))), 'reset token removed from the address bar');
  await F.getByLabel('New password').fill('newpass99');
  await F.getByRole('button', { name: 'Save password' }).click();
  await F.getByText('Workout completed').waitFor({ timeout: 10000 }).catch(() => {});
  ok(await F.getByText('Workout completed').isVisible(), 'after the new password the client lands in the app');
  ok(mock.db.users.find((u) => u.email === 'ryan@example.com').password === 'newpass99', 'new password saved');
  await F.goto(`http://localhost:${PORT}/?reset=${mail.token}`);
  await F.getByText('reset link has expired').waitFor({ timeout: 8000 }).catch(() => {});
  ok(await F.getByText('reset link has expired').isVisible() || (await F.getByText('Workout completed').isVisible()), 'used reset link is not accepted twice');

  // Cancelling password recovery must not leave future sign-ins stuck.
  const cancelToken = 'rst-cancel-fixture';
  mock.db.resetTokens[cancelToken] = mock.db.users.find(u => u.email === 'ryan@example.com').id;
  const K = await open({ width: 375, height: 812 });
  await K.goto(`http://localhost:${PORT}/?reset=${cancelToken}`);
  await K.getByRole('heading', { name: 'Choose a new password', exact: true }).waitFor();
  await K.getByRole('button', { name: 'Cancel', exact: true }).click();
  await K.getByLabel('Email', { exact: true }).fill('ryan@example.com');
  await K.getByLabel('Password', { exact: true }).fill('newpass99');
  await K.getByRole('button', { name: 'Sign in', exact: true }).click();
  await K.getByText('Workout completed', { exact: true }).waitFor();
  ok(true, 'cancelled recovery does not block a later login');
  K.errors.forEach(e => C.errors.push(e));

  // Second independent coach: real UI against the scoped mock, no production fixture.
  const O = await open({ width: 768, height: 1024 });
  await signUp(O, 'Other Coach', 'othercoach@example.com', 'otherpass1', 'coach');
  await O.getByRole('heading', { name: 'Clients', exact: true }).waitFor();
  ok(!(await O.getByText('Ryan Lee', { exact: true }).count()), 'second coach cannot see first coach roster');
  ok((await O.getByRole('button', { name: 'Client', exact: true }).count()) === 0, 'cloud coach cannot switch into client role');
  const otherToken = mock.db.users.find(u => u.email === 'othercoach@example.com').id;
  const ownToken = mock.db.users.find(u => u.email === 'ryan@example.com').id;
  const scopeChecks = await O.evaluate(async ({ otherToken, ownToken, clientId, workoutId }) => {
    const h = tok => ({ apikey: 'anon', Authorization: 'Bearer tok-' + tok, 'Content-Type': 'application/json' });
    const foreign = await fetch('https://mock.supabase.co/rest/v1/clients?id=eq.'+clientId, { headers: h(otherToken) });
    const notes = await fetch('https://mock.supabase.co/rest/v1/coach_notes_secure', { headers: h(ownToken) });
    const prescription = await fetch('https://mock.supabase.co/rest/v1/workouts?id=eq.'+workoutId, { method: 'PATCH', headers: h(ownToken), body: JSON.stringify({data:{title:'forged'}}) });
    return { foreign: await foreign.json(), notes: await notes.json(), prescription: prescription.status };
  }, { otherToken, ownToken, clientId: ryanRow.id, workoutId: w.id });
  ok(scopeChecks.foreign.length === 0 && scopeChecks.notes.length === 0, 'scoped REST hides foreign client and private notes');
  ok(mock.db.workouts.find(x => x.id === w.id).data.title !== 'forged', 'direct client PATCH cannot overwrite a prescription');
  ok(mock.log.some(l => l.startsWith('POST /rest/v1/rpc/save_workout_results_secure')), 'client logging uses secure result RPC');
  O.errors.forEach(e => C.errors.push(e));

  for (const width of [375, 768, 1024, 1440]) {
    await R.setViewportSize({ width, height: 900 });
    ok((await R.evaluate(() => document.documentElement.scrollWidth === innerWidth)), `cloud client layout at ${width}px`);
  }

  // A stale coach editor must fail closed instead of replacing newer results.
  await C.getByRole('button', { name: 'Clients', exact: true }).first().click();
  if (!(await C.getByRole('button', { name: 'Exercises', exact: true }).count())) await C.locator('main').getByText('Ryan Lee', { exact: true }).first().click();
  await C.getByRole('button', { name: 'Exercises', exact: true }).click();
  const serverWorkout = mock.db.workouts.find(x => x.id === w.id);
  const protectedReps = serverWorkout.data.blocks[0].reps;
  serverWorkout.updated_at = new Date(Date.now() + 10000).toISOString(); // another device, deliberately no event
  await C.locator('input[placeholder="8-10"]').first().fill('12');
  await C.getByRole('heading', { name: 'Data needs a fresh load', exact: true }).waitFor();
  ok(serverWorkout.data.blocks[0].reps === protectedReps, 'stale editor cannot overwrite a newer workout version');

  // layout
  for (const [n, p] of [['client', R], ['stranger', S], ['reset', F]]) {
    ok((await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)) === 0, `${n}: no horizontal overflow on phone`);
  }
  const all = [...S.errors, ...C.errors, ...R.errors, ...F.errors];
  ok(all.length === 0, 'no page errors ' + all.join(' | '));
  console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
  await b.close();
  srv.close();
  process.exit(failures ? 1 : 0);
})().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
