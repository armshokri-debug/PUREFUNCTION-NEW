// Focused browser verification for read-only Program Template preview.
// Usage: node e2e/program-template-preview.cjs <dist-cloud dir built with VITE_SUPABASE_URL=https://mock.supabase.co>
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const createMock = require('./mock-supabase.cjs');

const root = process.argv[2];
if (!root) {
  console.error('Usage: node e2e/program-template-preview.cjs <dist-cloud dir>');
  process.exit(1);
}

const PORT = 4198;
const srv = http
  .createServer((q, r) => {
    let f = path.join(root, decodeURIComponent(q.url.split('?')[0]));
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(root, 'index.html');
    const type =
      {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json'
      }[path.extname(f)] || 'application/octet-stream';
    r.writeHead(200, { 'content-type': type });
    r.end(fs.readFileSync(f));
  })
  .listen(PORT);

let failures = 0;
const ok = (cond, msg) => {
  console.log((cond ? 'PASS ' : 'FAIL ') + msg);
  if (!cond) failures++;
};

async function measureOverflow(page) {
  return page.evaluate(() => {
    const W = window.innerWidth;
    const pageOverflow = document.documentElement.scrollWidth - W;
    const offRight = [];
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const r = el.getBoundingClientRect();
      if (
        r.width > 0 &&
        r.right > W + 2 &&
        !el.closest('[class*="overflow-x"],[class*="overflow-auto"],[class*="overflow-hidden"]')
      ) {
        const text = (el.getAttribute('aria-label') || el.innerText || '')
          .trim()
          .replace(/\s+/g, ' ')
          .slice(0, 40);
        offRight.push(`${el.tagName.toLowerCase()} "${text}" right=${Math.round(r.right)}>${W}`);
      }
    }
    return { pageOverflow, offRight: offRight.slice(0, 5) };
  });
}

(async () => {
  const mock = createMock({ coachEmail: 'coach@example.com' });
  const browser = await chromium.launch(
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {}
  );

  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  let templateGetMode = 'ok';
  let templateGetOverride = null;
  let templateGetCount = 0;
  let failNextTemplateSave = false;
  let delayNextTemplateSaveMs = 0;
  const templatePostCalls = [];
  let templateUpdateRpcMode = 'ok';
  const templateRpcCalls = [];
  let templateDirectPatchCount = 0;
  await ctx.route('https://mock.supabase.co/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (req.method() === 'PATCH' && url.pathname === '/rest/v1/program_templates') {
      templateDirectPatchCount++;
    }
    if (req.method() === 'POST' && url.pathname === '/rest/v1/rpc/pf_update_program_template') {
      const body = JSON.parse(req.postData() || '{}');
      templateRpcCalls.push(body);
      if (templateUpdateRpcMode === 'delay-ok') {
        await new Promise((r) => setTimeout(r, 300));
      }
      if (templateUpdateRpcMode === 'conflict') {
        return route.fulfill({
          status: 409,
          headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' },
          body: JSON.stringify({ code: '40001', message: 'Program template was modified elsewhere; reload before saving' })
        });
      }
      if (templateUpdateRpcMode === 'forbidden') {
        return route.fulfill({
          status: 403,
          headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' },
          body: JSON.stringify({ code: '42501', message: 'Only the owning verified coach may update a program template' })
        });
      }
      if (templateUpdateRpcMode === 'missing') {
        return route.fulfill({
          status: 404,
          headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' },
          body: JSON.stringify({ code: 'PGRST202', message: 'Could not find the function public.pf_update_program_template in the schema cache' })
        });
      }
      if (templateUpdateRpcMode === 'network-error') {
        return route.abort('failed');
      }
      if (templateUpdateRpcMode === 'empty-response') {
        return route.fulfill({
          status: 200,
          headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' },
          body: JSON.stringify(null)
        });
      }
      if (templateUpdateRpcMode === 'malformed-response') {
        return route.fulfill({
          status: 200,
          headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' },
          body: JSON.stringify({ id: body.p_id, data: {} })
        });
      }
      const row = mock.db.program_templates.find((r) => r.id === body.p_id && r.owner_id === coachProfile.id);
      if (!row) {
        return route.fulfill({
          status: 403,
          headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' },
          body: JSON.stringify({ code: '42501', message: 'Program template not found or access denied' })
        });
      }
      if (JSON.stringify(row.data) !== JSON.stringify(body.p_expected_data)) {
        return route.fulfill({
          status: 409,
          headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' },
          body: JSON.stringify({ code: '40001', message: 'Program template was modified elsewhere; reload before saving' })
        });
      }
      row.data = JSON.parse(JSON.stringify(body.p_data));
      return route.fulfill({
        status: 200,
        headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' },
        body: JSON.stringify({ id: row.id, owner_id: row.owner_id, data: row.data, created_at: row.created_at })
      });
    }
    if (req.method() === 'POST' && url.pathname === '/rest/v1/program_templates') {
      templatePostCalls.push(JSON.parse(req.postData() || '{}'));
      if (delayNextTemplateSaveMs > 0) {
        const delayMs = delayNextTemplateSaveMs;
        delayNextTemplateSaveMs = 0;
        await new Promise((r) => setTimeout(r, delayMs));
      }
      if (failNextTemplateSave) {
        failNextTemplateSave = false;
        return route.fulfill({
          status: 500,
          headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' },
          body: JSON.stringify({ message: 'Simulated template save failure' })
        });
      }
    }
    if (req.method() === 'GET' && url.pathname === '/rest/v1/program_templates') {
      templateGetCount++;
      if (templateGetMode === 'fail') {
        return route.fulfill({
          status: 500,
          headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' },
          body: JSON.stringify({ message: 'Simulated template load failure' })
        });
      }
      if (templateGetMode === 'delay-ok') {
        await new Promise((r) => setTimeout(r, 300));
      }
      if (templateGetOverride) {
        return route.fulfill({
          status: 200,
          headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' },
          body: JSON.stringify(templateGetOverride)
        });
      }
    }
    return mock.handler(route);
  });
  await ctx.routeWebSocket(/wss:\/\/mock\.supabase\.co\/.*/, mock.wsHandler);
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));

  await page.goto(`http://localhost:${PORT}/`);
  await page.getByRole('tab', { name: 'I’m the coach' }).click();
  await page.getByRole('button', { name: 'Create coach account' }).click();
  await page.getByLabel('Your name').fill('Coach Demo');
  await page.getByLabel('Email').fill('coach@example.com');
  await page.getByLabel('Password').fill('coachpass1');
  await page.locator('form button[type=submit]').click();
  await page.waitForTimeout(300);

  const mail = [...mock.db.emails].reverse().find((e) => e.kind === 'verify' && e.to === 'coach@example.com');
  if (mail) await page.goto(`http://localhost:${PORT}/?verify=${mail.token}`);
  await page.getByRole('heading', { name: 'Clients' }).waitFor();

  const coachProfile = mock.db.profiles.find((p) => p.role === 'coach');
  mock.db.clients.push({
    id: 'client-syn-1',
    coach_id: coachProfile.id,
    email: 'synthetic.client@example.invalid',
    updated_at: new Date().toISOString(),
    data: {
      id: 'client-syn-1',
      name: 'Synthetic Athlete',
      email: 'synthetic.client@example.invalid',
      phaseNumber: 1,
      phaseName: 'Reposition',
      inBody: {
        weight: 0,
        skeletalMuscleMass: 0,
        bodyFatMass: 0,
        bodyFatPercent: 0,
        visceralFatLevel: 0,
        bmr: 0,
        inBodyScore: 0,
        segments: { leftArm: 0, rightArm: 0, trunk: 0, leftLeg: 0, rightLeg: 0 },
        printoutUploaded: false
      },
      rom: [],
      priTests: [],
      gaitPosture: [],
      strengthTests: [],
      videoAssessments: [],
      goals: [],
      assessments: []
    }
  });

  const makeBlock = (id, name, sets, reps, loadKg) => ({
    id,
    exerciseId: `ex-${id}`,
    name,
    sets,
    reps,
    loadKg,
    restSec: 90,
    notes: '',
    loggedSets: []
  });

  const weekTemplate = {
    id: 'tpl-week',
    name: 'Foundation Week',
    scope: 'week',
    createdAt: '2026-11-01T10:00:00.000Z',
    days: [
      {
        offset: 2,
        workout: {
          id: 'wo-wed',
          date: '2025-01-08',
          title: 'Upper Pull',
          focus: 'Scapular control',
          status: 'planned',
          blocks: [makeBlock('b2', 'Seated Row', 3, '10-12', 25)]
        }
      },
      {
        offset: 0,
        workout: {
          id: 'wo-mon',
          date: '2025-01-06',
          title: 'Lower Hinge',
          focus: '',
          status: 'planned',
          blocks: [makeBlock('b1', 'Romanian Deadlift', 4, '6', 60)]
        }
      }
    ]
  };

  const twelveWeekTemplate = {
    id: 'tpl-12wk',
    name: '12-Week Strength Block',
    scope: 'program',
    createdAt: '2026-11-02T10:00:00.000Z',
    days: [
      {
        offset: 77,
        workout: {
          id: 'wo-w12-mon',
          date: '2025-03-24',
          title: 'Peak Day A',
          focus: 'Heavy single',
          status: 'planned',
          blocks: [makeBlock('b12a', 'Back Squat', 5, '3', 100)]
        }
      },
      {
        offset: 7,
        workout: {
          id: 'wo-w2-mon',
          date: '2025-01-13',
          title: 'Accumulation W2',
          focus: 'Volume',
          status: 'planned',
          blocks: [makeBlock('b2a', 'Goblet Squat', 3, '10', 20)]
        }
      },
      {
        offset: 0,
        workout: {
          id: 'wo-w1-mon',
          date: '2025-01-06',
          title: 'Intro W1',
          focus: 'Technique',
          status: 'planned',
          blocks: [makeBlock('b1a', 'Split Squat', 3, '8', 0)]
        }
      },
      {
        offset: 83,
        workout: {
          id: 'wo-w12-sun',
          date: '2025-03-30',
          title: 'Recovery Flush',
          focus: '',
          status: 'planned',
          blocks: [makeBlock('b12b', '90-90 Breathing', 2, '5', 0)]
        }
      }
    ]
  };

  const edgeTemplate = {
    id: 'tpl-edge',
    name: 'Edge Values',
    scope: 'week',
    createdAt: '2026-11-03T10:00:00.000Z',
    days: [
      {
        offset: 1,
        workout: {
          id: 'wo-edge',
          date: '2025-01-07',
          title: '',
          focus: undefined,
          status: 'planned',
          blocks: [
            makeBlock('bz', 'Zero Load Drill', 0, '0', 0),
            { id: 'bm', exerciseId: 'ex-m', name: 'Missing Optional Drill', loggedSets: [] }
          ]
        }
      }
    ]
  };

  const emptyTemplate = {
    id: 'tpl-empty',
    name: 'Empty Plan',
    scope: 'week',
    createdAt: '2026-11-04T10:00:00.000Z',
    days: []
  };

  const longStrings = {
    name: 'FoundationalStabilityHypertrophyProgressionPhaseOneWithExtendedContinuousIdentifierLabel_0123456789',
    title: 'PosteriorChainIsometricAndEccentricControlSessionWithoutSpacesForWrappingVerification',
    focus: 'TriplanarPelvicRibcageIntegrationAndScapularUpwardRotationContinuousFocusDescription_ABCXYZ',
    exercise: 'SingleLegRomanianDeadliftWithContralateralKettlebellReachAndControlledPauseExerciseName',
    reps: '10-12-slow-3-second-eccentric-2-second-isometric-pause-controlled-tempo-prescription'
  };

  const longTemplate = {
    id: 'tpl-long',
    name: longStrings.name,
    scope: 'week',
    createdAt: '2026-11-05T10:00:00.000Z',
    days: [
      {
        offset: 0,
        workout: {
          id: 'wo-long',
          date: '2025-01-06',
          title: longStrings.title,
          focus: longStrings.focus,
          status: 'planned',
          blocks: [makeBlock('blong', longStrings.exercise, 4, longStrings.reps, 45)]
        }
      }
    ]
  };

  mock.db.program_templates.push(
    { id: weekTemplate.id, owner_id: coachProfile.id, data: weekTemplate, created_at: '2026-11-01T10:00:00.000Z' },
    { id: twelveWeekTemplate.id, owner_id: coachProfile.id, data: twelveWeekTemplate, created_at: '2026-11-02T10:00:00.000Z' },
    { id: edgeTemplate.id, owner_id: coachProfile.id, data: edgeTemplate, created_at: '2026-11-03T10:00:00.000Z' },
    { id: emptyTemplate.id, owner_id: coachProfile.id, data: emptyTemplate, created_at: '2026-11-04T10:00:00.000Z' },
    { id: longTemplate.id, owner_id: coachProfile.id, data: longTemplate, created_at: '2026-11-05T10:00:00.000Z' }
  );

  // ---------------- Retry failed template loading ----------------
  templateGetMode = 'fail';
  const retryLogStart = mock.log.length;
  const retryWorkoutsBefore = JSON.stringify(mock.db.workouts);
  const retryClientsBefore = JSON.stringify(mock.db.clients);
  const retryTemplatesBefore = JSON.stringify(mock.db.program_templates);

  await page.reload();
  await page.getByRole('button', { name: 'Programs' }).first().click();

  const retryBtn = page.getByRole('button', { name: /Retry|Retrying/ });
  await retryBtn.waitFor();
  ok(await page.getByText('Program templates could not load.').isVisible(), 'initial load failure shows error message');
  ok((await page.getByLabel('Saved template').count()) === 0, 'template interface stays hidden on load failure');
  const retryBox = await retryBtn.boundingBox();
  ok(!!retryBox && retryBox.height >= 44, `Retry button height >= 44px (${retryBox ? Math.round(retryBox.height) : 0}px)`);

  // Check error/retry state does not overflow mobile 375px
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(150);
  const retryMobileOverflow = await measureOverflow(page);
  ok(retryMobileOverflow.pageOverflow <= 0 && retryMobileOverflow.offRight.length === 0, 'retry state has no overflow at 375px');
  await page.setViewportSize({ width: 1440, height: 900 });

  const retryClickLogStart = mock.log.length;

  // Repeated failure via keyboard Enter still permits retry
  await retryBtn.focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  ok(await page.getByText('Program templates could not load.').isVisible(), 'repeated failure keeps error message');
  ok(await retryBtn.isEnabled(), 'repeated failure retains usable Retry button');

  // Keyboard Space retry with delayed success: verifies loading feedback and duplicate-click prevention
  templateGetMode = 'delay-ok';
  templateGetCount = 0;
  await retryBtn.focus();
  await page.keyboard.press('Space');
  await page.waitForTimeout(50);
  ok(await page.getByText('Loading program templates…').isVisible(), 'pending retry shows loading feedback');
  ok(await retryBtn.isDisabled(), 'Retry button is disabled while request is pending');
  await retryBtn.click({ force: true });
  await page.getByLabel('Saved template').waitFor();
  ok(templateGetCount === 1, `pending retry prevents duplicate requests (count=${templateGetCount})`);
  ok((await page.getByText('Program templates could not load.').count()) === 0, 'loading error clears after successful retry');

  const retryRestWriteLogs = mock.log
    .slice(retryLogStart)
    .filter(
      (entry) =>
        /^(POST|PATCH|PUT|DELETE)\s+\/rest\/v1\//.test(entry) &&
        !/^POST\s+\/rest\/v1\/rpc\/(pf_head_coach|pf_list_trainers)\b/.test(entry)
    );
  const retryClickWriteLogs = mock.log
    .slice(retryClickLogStart)
    .filter((entry) => /^(POST|PATCH|PUT|DELETE)\b/.test(entry));
  ok(
    retryRestWriteLogs.length === 0 && retryClickWriteLogs.length === 0,
    `failed load and retry trigger zero data writes (rest=${retryRestWriteLogs.length}, retry=${retryClickWriteLogs.length})`
  );
  ok(JSON.stringify(mock.db.workouts) === retryWorkoutsBefore, 'retry leaves client workouts untouched');
  ok(JSON.stringify(mock.db.clients) === retryClientsBefore, 'retry leaves client profiles untouched');
  ok(JSON.stringify(mock.db.program_templates) === retryTemplatesBefore, 'retry leaves templates untouched');
  templateGetMode = 'ok';

  const toggle = page.getByRole('button', { name: /Show preview|Hide preview/ });
  ok((await toggle.getAttribute('aria-expanded')) === 'false', 'preview starts collapsed (aria-expanded=false)');
  ok((await page.locator('#program-template-preview').count()) === 0, 'preview region not rendered initially');
  const toggleBox = await toggle.boundingBox();
  ok(!!toggleBox && toggleBox.height >= 44, `toggle height >= 44px (${toggleBox ? Math.round(toggleBox.height) : 0}px)`);

  const logIndexBefore = mock.log.length;
  const workoutsBefore = JSON.stringify(mock.db.workouts);
  const clientsBefore = JSON.stringify(mock.db.clients);
  const templatesBefore = JSON.stringify(mock.db.program_templates);

  // Keyboard toggle via Enter and Space
  await toggle.focus();
  await page.keyboard.press('Enter');
  const preview = page.locator('#program-template-preview');
  await preview.waitFor();
  ok((await toggle.getAttribute('aria-expanded')) === 'true', 'Enter opens preview and sets aria-expanded=true');
  ok((await toggle.getAttribute('aria-controls')) === 'program-template-preview', 'aria-controls points to preview region');

  await page.keyboard.press('Space');
  ok((await preview.count()) === 0 && (await toggle.getAttribute('aria-expanded')) === 'false', 'Space closes preview');

  await page.keyboard.press('Enter');
  await preview.waitFor();

  // Select 1-week template and verify chronological order + no source/today dates
  const select = page.getByLabel('Saved template');
  await select.selectOption('tpl-week');
  const weekText = await preview.innerText();
  ok(weekText.includes('Foundation Week') && weekText.includes('One week') && weekText.includes('2 workouts'), 'shows 1-week template name, scope and count');
  ok(weekText.indexOf('Lower Hinge') !== -1 && weekText.indexOf('Upper Pull') !== -1 && weekText.indexOf('Lower Hinge') < weekText.indexOf('Upper Pull'), 'days ordered chronologically by offset (Day +0 before Day +2)');
  ok(weekText.includes('Mon · Day +0') && weekText.includes('Wed · Day +2'), 'shows relative weekday and day offsets');
  ok(weekText.includes('Romanian Deadlift') && weekText.includes('4 × 6') && weekText.includes('132.3 lb'), 'displays workout and exercise prescriptions');
  ok(!weekText.includes('2025-01-06') && !weekText.includes('2025-01-08'), 'does not expose source calendar dates');

  // Switch to synthetic 12-week template
  await select.selectOption('tpl-12wk');
  const twelveText = await preview.innerText();
  ok(!twelveText.includes('Foundation Week') && !twelveText.includes('Upper Pull'), 'switching template clears stale content');
  ok(twelveText.includes('12-Week Strength Block') && twelveText.includes('12 weeks') && twelveText.includes('4 workouts'), 'shows 12-week template metadata');
  ok(twelveText.includes('Week 1') && twelveText.includes('Week 2') && twelveText.includes('Week 12'), 'groups 12-week template by week');
  ok(
    twelveText.indexOf('Week 1') < twelveText.indexOf('Week 2') && twelveText.indexOf('Week 2') < twelveText.indexOf('Week 12'),
    'weeks appear in chronological order'
  );
  ok(twelveText.includes('Mon · Day +77') && twelveText.includes('Sun · Day +83'), 'displays week 12 relative offsets');
  ok(twelveText.includes('0 lb'), 'preserves zero load on bodyweight exercise');
  ok(!twelveText.includes('2025-03-24') && !twelveText.includes('2025-01-13'), '12-week preview avoids source dates');

  // Switch to edge template (valid zeros + missing optional values)
  await select.selectOption('tpl-edge');
  const edgeText = await preview.innerText();
  ok(edgeText.includes('Untitled workout'), 'handles empty workout title safely');
  ok(edgeText.includes('Zero Load Drill') && edgeText.includes('0 × 0') && edgeText.includes('0 lb'), 'preserves valid zero sets, reps and load');
  ok(edgeText.includes('Missing Optional Drill'), 'renders exercise when optional prescription fields are missing');
  ok(!/undefined/i.test(edgeText), 'never displays "undefined"');

  // Switch to empty template
  await select.selectOption('tpl-empty');
  const emptyText = await preview.innerText();
  ok(emptyText.includes('Empty Plan') && emptyText.includes('0 workouts') && emptyText.includes('This template has no workouts.'), 'handles empty template safely');

  // Switch back to 12-week template and verify layout/no overflow at all 4 widths
  await select.selectOption('tpl-12wk');
  for (const [label, vp] of [
    ['375', { width: 375, height: 812 }],
    ['768', { width: 768, height: 1024 }],
    ['1024', { width: 1024, height: 768 }],
    ['1440', { width: 1440, height: 900 }]
  ]) {
    await page.setViewportSize(vp);
    await page.waitForTimeout(250);
    const m = await measureOverflow(page);
    const box = await toggle.boundingBox();
    ok(m.pageOverflow <= 0 && m.offRight.length === 0, `no horizontal overflow at ${label}px (page=${m.pageOverflow}, off=${m.offRight.join(', ')})`);
    ok(!!box && box.height >= 44, `toggle touch target >= 44px at ${label}px`);
  }

  // Long unbroken content checks across 375, 768, 1024 and 1440px
  await select.selectOption('tpl-long');
  for (const [label, vp] of [
    ['375', { width: 375, height: 812 }],
    ['768', { width: 768, height: 1024 }],
    ['1024', { width: 1024, height: 768 }],
    ['1440', { width: 1440, height: 900 }]
  ]) {
    await page.setViewportSize(vp);
    await page.waitForTimeout(250);
    const m = await measureOverflow(page);
    const bounds = await page.evaluate(() => {
      const region = document.getElementById('program-template-preview');
      if (!region) return { missing: true, escaped: [], clipped: [] };
      const rr = region.getBoundingClientRect();
      const escaped = [];
      const clipped = [];
      for (const el of [region, ...region.querySelectorAll('*')]) {
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        const r = el.getBoundingClientRect();
        if (r.right > rr.right + 1 || r.left < rr.left - 1) {
          escaped.push(`${el.tagName.toLowerCase()} right=${Math.round(r.right)}>${Math.round(rr.right)}`);
        }
        if (el.scrollWidth > el.clientWidth + 1) {
          escaped.push(`${el.tagName.toLowerCase()} scrollW=${el.scrollWidth}>clientW=${el.clientWidth}`);
        }
        if (cs.overflowX === 'hidden' || cs.overflow === 'hidden' || cs.textOverflow === 'ellipsis') {
          clipped.push(`${el.tagName.toLowerCase()} overflow=${cs.overflowX} textOverflow=${cs.textOverflow}`);
        }
      }
      return {
        missing: false,
        text: region.innerText,
        escaped: escaped.slice(0, 6),
        clipped: clipped.slice(0, 6)
      };
    });
    ok(
      m.pageOverflow <= 0 && m.offRight.length === 0,
      `long-content: no document overflow at ${label}px (page=${m.pageOverflow}, off=${m.offRight.join(', ')})`
    );
    ok(
      !bounds.missing && bounds.escaped.length === 0,
      `long-content: no text escapes preview region at ${label}px (${bounds.escaped.join('; ')})`
    );
    ok(
      bounds.clipped.length === 0,
      `long-content: no clipping/truncation styles at ${label}px (${bounds.clipped.join('; ')})`
    );
    ok(
      bounds.text.includes(longStrings.name) &&
        bounds.text.includes(longStrings.title) &&
        bounds.text.includes(longStrings.focus) &&
        bounds.text.includes(longStrings.exercise) &&
        bounds.text.includes(longStrings.reps) &&
        bounds.text.includes('99.2 lb'),
      `long-content: full strings readable at ${label}px`
    );
  }

  // Verify zero mutation callbacks / network writes across all preview interactions
  const newLogs = mock.log.slice(logIndexBefore);
  const writeLogs = newLogs.filter((entry) => /^(POST|PATCH|PUT|DELETE)\b/.test(entry));
  ok(writeLogs.length === 0, `opening/closing/switching preview triggers zero write requests (got ${writeLogs.length})`);
  ok(JSON.stringify(mock.db.workouts) === workoutsBefore, 'client workouts remain untouched');
  ok(JSON.stringify(mock.db.clients) === clientsBefore, 'client profiles remain untouched');
  ok(JSON.stringify(mock.db.program_templates) === templatesBefore, 'templates remain untouched');

  // ---------------- Program template full lifecycle ----------------
  const toISO = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const parseISO = (iso) => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  const addDaysISO = (iso, n) => {
    const d = parseISO(iso);
    d.setDate(d.getDate() + n);
    return toISO(d);
  };
  const mondayOf = (iso) => {
    const d = parseISO(iso);
    const dow = (d.getDay() + 6) % 7;
    return addDaysISO(iso, -dow);
  };
  const labelDate = (iso) => {
    const d = parseISO(iso);
    return `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]}, ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()]} ${d.getDate()}`;
  };

  const thisMonday = mondayOf(toISO(new Date()));
  const sourceMon = addDaysISO(thisMonday, -14);
  const sourceWed = addDaysISO(sourceMon, 2);
  const destMon = addDaysISO(thisMonday, 7);
  const destWed = addDaysISO(destMon, 2);

  const makeSyntheticClient = (id, name, email) => ({
    id,
    coach_id: coachProfile.id,
    email,
    updated_at: new Date().toISOString(),
    data: {
      id,
      name,
      email,
      phaseNumber: 1,
      phaseName: 'Reposition',
      inBody: {
        weight: 0,
        skeletalMuscleMass: 0,
        bodyFatMass: 0,
        bodyFatPercent: 0,
        visceralFatLevel: 0,
        bmr: 0,
        inBodyScore: 0,
        segments: { leftArm: 0, rightArm: 0, trunk: 0, leftLeg: 0, rightLeg: 0 },
        printoutUploaded: false
      },
      rom: [],
      priTests: [],
      gaitPosture: [],
      strengthTests: [],
      videoAssessments: [],
      goals: [],
      assessments: []
    }
  });

  mock.db.clients.push(
    makeSyntheticClient('client-syn-2', 'Target Athlete', 'target.athlete@example.invalid'),
    makeSyntheticClient('client-syn-3', 'Unselected Athlete', 'unselected.athlete@example.invalid')
  );

  mock.db.workouts.push(
    {
      id: 'wo-lc-src-mon',
      client_id: 'client-syn-1',
      date: sourceMon,
      updated_at: new Date().toISOString(),
      data: {
        id: 'wo-lc-src-mon',
        date: sourceMon,
        title: 'Lifecycle Push A',
        focus: 'Anterior chain',
        status: 'completed',
        completedAt: `${sourceMon}T12:00:00.000Z`,
        sessionRpe: 8,
        clientFeedback: 'Strong press',
        blocks: [
          {
            id: 'blk-lc-1',
            exerciseId: 'ex-press',
            name: 'Incline Dumbbell Press',
            sets: 3,
            reps: '8-10',
            loadKg: 30,
            restSec: 90,
            notes: 'Controlled tempo',
            loggedSets: [{ setNumber: 1, kg: 30, reps: 10, completed: true }]
          }
        ]
      }
    },
    {
      id: 'wo-lc-src-wed',
      client_id: 'client-syn-1',
      date: sourceWed,
      updated_at: new Date().toISOString(),
      data: {
        id: 'wo-lc-src-wed',
        date: sourceWed,
        title: 'Lifecycle Pull B',
        focus: 'Upper back',
        status: 'planned',
        blocks: [
          {
            id: 'blk-lc-2',
            exerciseId: 'ex-row',
            name: 'Chest Supported Row',
            sets: 4,
            reps: '12',
            loadKg: 40,
            restSec: 90,
            notes: '',
            loggedSets: [{ setNumber: 1, kg: 40, reps: null, completed: false }]
          }
        ]
      }
    },
    {
      id: 'wo-lc-comp-mon',
      client_id: 'client-syn-2',
      date: destMon,
      updated_at: new Date().toISOString(),
      data: {
        id: 'wo-lc-comp-mon',
        date: destMon,
        title: 'Completed Benchmark',
        focus: 'Heavy single',
        status: 'completed',
        completedAt: `${destMon}T09:30:00.000Z`,
        sessionRpe: 9,
        clientFeedback: 'PR day',
        blocks: [
          {
            id: 'blk-lc-comp',
            exerciseId: 'ex-bench',
            name: 'Recorded Bench Press',
            sets: 3,
            reps: '5',
            loadKg: 80,
            restSec: 120,
            notes: 'Tucked elbows',
            loggedSets: [{ setNumber: 1, kg: 80, reps: 5, completed: true }]
          }
        ]
      }
    },
    {
      id: 'wo-lc-unsel-wed',
      client_id: 'client-syn-3',
      date: destWed,
      updated_at: new Date().toISOString(),
      data: {
        id: 'wo-lc-unsel-wed',
        date: destWed,
        title: 'Unselected Original Session',
        focus: 'Mobility',
        status: 'planned',
        blocks: [
          {
            id: 'blk-lc-unsel',
            exerciseId: 'ex-mob',
            name: 'Unselected Mobility Drill',
            sets: 3,
            reps: '10',
            loadKg: 20,
            restSec: 60,
            notes: '',
            loggedSets: []
          }
        ]
      }
    }
  );

  // 1. Create and save a template from synthetic client workouts
  await page.reload();
  await page.getByRole('button', { name: 'Programs' }).first().click();
  await page.getByLabel('Program for client').selectOption('client-syn-1');
  await page.getByLabel('Template name').fill('Lifecycle Week Template');
  await page.getByLabel('Template length').selectOption('week');
  await page.getByLabel('Source week').fill(sourceMon);
  await page.getByRole('button', { name: 'Save as template' }).click();
  await page.getByText('Saved 2 workouts as Lifecycle Week Template.').waitFor();

  const savedTplRow = mock.db.program_templates.find((r) => r.data && r.data.name === 'Lifecycle Week Template');
  ok(!!savedTplRow && savedTplRow.data.days.length === 2, 'lifecycle: saved template persisted in mock program_templates');

  // 2. Reload and verify saved template and prescriptions remain
  await page.reload();
  await page.getByRole('button', { name: 'Programs' }).first().click();
  await page.getByLabel('Program for client').selectOption('client-syn-1');
  const savedSelect = page.getByLabel('Saved template');
  await savedSelect.waitFor();
  await savedSelect.selectOption(savedTplRow.id);
  await page.getByRole('button', { name: 'Show preview' }).click();
  const lcPreview = await page.locator('#program-template-preview').innerText();
  ok(
    lcPreview.includes('Lifecycle Week Template') &&
      lcPreview.includes('One week') &&
      lcPreview.includes('2 workouts') &&
      lcPreview.includes('Lifecycle Push A') &&
      lcPreview.includes('Incline Dumbbell Press') &&
      lcPreview.includes('3 × 8-10') &&
      lcPreview.includes('66.1 lb') &&
      lcPreview.includes('Lifecycle Pull B') &&
      lcPreview.includes('Chest Supported Row') &&
      lcPreview.includes('4 × 12') &&
      lcPreview.includes('88.2 lb'),
    'lifecycle: saved template and prescriptions survive reload'
  );

  // 3. Apply saved template to selected synthetic client only
  const unselectedWorkoutsBefore = JSON.stringify(mock.db.workouts.filter((w) => w.client_id === 'client-syn-3'));
  const completedBenchmarkBefore = JSON.stringify(mock.db.workouts.find((w) => w.id === 'wo-lc-comp-mon'));

  const syn1Box = page.getByRole('checkbox', { name: 'Synthetic Athlete' });
  if (await syn1Box.isChecked()) await syn1Box.uncheck();
  const syn2Box = page.getByRole('checkbox', { name: 'Target Athlete' });
  if (!(await syn2Box.isChecked())) await syn2Box.check();
  const syn3Box = page.getByRole('checkbox', { name: 'Unselected Athlete' });
  if (await syn3Box.isChecked()) await syn3Box.uncheck();

  await page.getByLabel('Destination week').fill(destMon);
  await page.getByRole('button', { name: 'Apply template' }).click();
  await page.getByText('Applied 1 workouts to 1 clients. 1 days with results were protected.').waitFor();

  // 4. Wait for persistence, reload, and verify resulting workouts
  let persistedDestWed = null;
  for (let i = 0; i < 50; i++) {
    persistedDestWed = mock.db.workouts.find((w) => w.client_id === 'client-syn-2' && w.date === destWed);
    const savedBadgeVisible = await page.getByText('Saved', { exact: true }).first().isVisible().catch(() => false);
    if (persistedDestWed && savedBadgeVisible) break;
    await page.waitForTimeout(100);
  }
  ok(!!persistedDestWed && persistedDestWed.data.title === 'Lifecycle Pull B', 'lifecycle: applied workout persisted to mock workouts');
  ok(
    !!persistedDestWed &&
      persistedDestWed.data.status === 'planned' &&
      !persistedDestWed.data.completedAt &&
      persistedDestWed.data.blocks[0].loggedSets.every((s) => s.completed === false && s.reps === null),
    'lifecycle: persisted workout clears source results'
  );

  // 5 & 6. Verify unselected client and completed workout/results are preserved in mock DB
  ok(
    JSON.stringify(mock.db.workouts.filter((w) => w.client_id === 'client-syn-3')) === unselectedWorkoutsBefore,
    'lifecycle: unselected client workouts remain unchanged in mock DB'
  );
  ok(
    JSON.stringify(mock.db.workouts.find((w) => w.id === 'wo-lc-comp-mon')) === completedBenchmarkBefore,
    'lifecycle: completed workout and recorded results preserved in mock DB'
  );

  // Reload and verify UI reflects persisted workouts, protected completed workout, and untouched unselected client
  await page.reload();
  await page.getByRole('button', { name: 'Programs' }).first().click();
  await page.getByLabel('Program for client').selectOption('client-syn-2');
  await page.getByRole('button', { name: 'Next week', exact: true }).click();
  await page.getByRole('button', { name: labelDate(destWed) }).click();
  ok(
    (await page.getByLabel('Workout title').inputValue()) === 'Lifecycle Pull B' &&
      (await page.getByText('Chest Supported Row').isVisible()),
    'lifecycle: applied workout remains visible in UI after reload'
  );

  await page.getByRole('button', { name: labelDate(destMon) }).click();
  ok(
    (await page.getByLabel('Workout title').inputValue()) === 'Completed Benchmark' &&
      (await page.getByText('Recorded Bench Press').isVisible()) &&
      (await page.getByText('PR day').isVisible()) &&
      (await page.getByText('Completed', { exact: true }).isVisible()),
    'lifecycle: completed workout and logged results remain visible in UI after reload'
  );

  await page.getByLabel('Program for client').selectOption('client-syn-3');
  await page.getByRole('button', { name: labelDate(destWed) }).click();
  ok(
    (await page.getByLabel('Workout title').inputValue()) === 'Unselected Original Session' &&
      (await page.getByText('Unselected Mobility Drill').isVisible()),
    'lifecycle: unselected client remains unchanged in UI after reload'
  );

  // 7. Simulate failed template save: retain form input and avoid false save success
  await page.getByLabel('Program for client').selectOption('client-syn-1');
  const lcNameInput = page.getByLabel('Template name');
  const lcLengthSelect = page.getByLabel('Template length');
  const lcSourceInput = page.getByLabel('Source week');
  await lcNameInput.fill('Failed Save Draft');
  await lcLengthSelect.selectOption('program');
  await lcSourceInput.fill(sourceMon);
  const templateCountBeforeFail = mock.db.program_templates.length;
  failNextTemplateSave = true;
  await page.getByRole('button', { name: 'Save as template' }).click();
  await page.getByText('Could not save template.').waitFor();
  ok((await page.getByText(/Saved \d+ workouts/).count()) === 0, 'lifecycle: failed save does not show false save success');
  ok((await lcNameInput.inputValue()) === 'Failed Save Draft', 'lifecycle: failed save retains template name');
  ok((await lcLengthSelect.inputValue()) === 'program', 'lifecycle: failed save retains template length');
  ok((await lcSourceInput.inputValue()) === sourceMon, 'lifecycle: failed save retains source week');
  ok(mock.db.program_templates.length === templateCountBeforeFail, 'lifecycle: failed save writes nothing to mock program_templates');

  // ---------------- Template Editing ----------------
  const editSelect = page.getByLabel('Saved template');
  await editSelect.selectOption(savedTplRow.id);

  // 8a. Open, edit and cancel without any writes
  const rpcCountBeforeCancel = templateRpcCalls.length;
  const patchCountBeforeCancel = templateDirectPatchCount;
  const dbSnapshotBeforeCancel = JSON.stringify(mock.db.program_templates);

  await page.getByRole('button', { name: 'Edit template' }).click();
  const editor = page.locator('#program-template-editor');
  await editor.waitFor();
  await editor.getByLabel('Edit template name').fill('Cancelled Draft Name');
  await editor.getByLabel('Lifecycle Push A · Incline Dumbbell Press reps').fill('15');
  await editor.getByLabel('Lifecycle Push A · Incline Dumbbell Press load (lb)').fill('99');
  await editor.getByLabel('Lifecycle Push A · Incline Dumbbell Press coach note').fill('Should be discarded');
  await editor.getByRole('button', { name: 'Cancel' }).click();
  ok((await editor.count()) === 0, 'edit: cancel closes the editor');
  ok(templateRpcCalls.length === rpcCountBeforeCancel, 'edit: cancel triggers zero RPC calls');
  ok(templateDirectPatchCount === patchCountBeforeCancel, 'edit: cancel triggers zero direct PATCH calls');
  ok(JSON.stringify(mock.db.program_templates) === dbSnapshotBeforeCancel, 'edit: cancel leaves mock DB untouched');

  // 8b. Reopen and verify conflict, permission denial, missing RPC, network, and malformed response preserve draft
  const originalTplSnapshot = JSON.parse(JSON.stringify(savedTplRow.data));
  await page.getByRole('button', { name: 'Edit template' }).click();
  await editor.waitFor();
  const edName = editor.getByLabel('Edit template name');
  const edSets = editor.getByLabel('Lifecycle Push A · Incline Dumbbell Press sets');
  const edReps = editor.getByLabel('Lifecycle Push A · Incline Dumbbell Press reps');
  const edLoad = editor.getByLabel('Lifecycle Push A · Incline Dumbbell Press load (lb)');
  const edRest = editor.getByLabel('Lifecycle Push A · Incline Dumbbell Press rest (s)');
  const edNote = editor.getByLabel('Lifecycle Push A · Incline Dumbbell Press coach note');

  await edName.fill('Edited Week Template');
  await edSets.fill('5');
  await edReps.fill('AMRAP');
  await edLoad.fill('100');
  await edRest.fill('120');
  await edNote.fill('Control 3s eccentric');

  const verifyDraftPreservedOnFailure = async (mode, expectedAlertSubstr, label) => {
    templateUpdateRpcMode = mode;
    await editor.getByRole('button', { name: 'Save changes' }).click();
    const alert = editor.getByRole('alert');
    await alert.waitFor();
    const alertText = (await alert.innerText()).toLowerCase();
    ok(alertText.includes(expectedAlertSubstr.toLowerCase()), `edit ${label}: shows expected error (${alertText})`);
    ok(await editor.isVisible(), `edit ${label}: keeps editor open`);
    ok((await page.getByText(/Updated template/).count()) === 0, `edit ${label}: does not show false success`);
    ok((await edName.inputValue()) === 'Edited Week Template', `edit ${label}: retains draft name`);
    ok((await edSets.inputValue()) === '5', `edit ${label}: retains draft sets`);
    ok((await edReps.inputValue()) === 'AMRAP', `edit ${label}: retains draft reps`);
    ok((await edLoad.inputValue()) === '100', `edit ${label}: retains draft load`);
    ok((await edRest.inputValue()) === '120', `edit ${label}: retains draft rest`);
    ok((await edNote.inputValue()) === 'Control 3s eccentric', `edit ${label}: retains draft coach note`);
    ok(JSON.stringify(mock.db.program_templates) === dbSnapshotBeforeCancel, `edit ${label}: DB unchanged`);
  };

  await verifyDraftPreservedOnFailure('conflict', 'reload', 'conflict (40001)');
  await verifyDraftPreservedOnFailure('forbidden', 'permission', 'permission denied (42501)');
  await verifyDraftPreservedOnFailure('missing', 'not enabled yet', 'missing RPC');
  const missingAlertText = (await editor.getByRole('alert').innerText()).trim();
  ok(
    missingAlertText === 'Template editing is not enabled yet.' &&
      !/database|sql|migration/i.test(missingAlertText),
    `edit missing RPC: exact user-facing message without DB instructions (${missingAlertText})`
  );
  await verifyDraftPreservedOnFailure('network-error', 'failed', 'network failure');
  await verifyDraftPreservedOnFailure('empty-response', 'invalid response', 'empty RPC response');
  await verifyDraftPreservedOnFailure('malformed-response', 'invalid response', 'malformed RPC response');

  // 8b-bis. Numeric field validation blocks saving without silent rounding/restoration and retains draft
  templateUpdateRpcMode = 'ok';
  const rpcCountBeforeInvalidNumeric = templateRpcCalls.length;
  const checkInvalidNumericBlocksSave = async (input, badValue, expectedValueAfterBlur, expectedSubstr, label) => {
    await input.fill(badValue);
    await input.blur();
    await editor.getByRole('button', { name: 'Save changes' }).click();
    ok(
      templateRpcCalls.length === rpcCountBeforeInvalidNumeric,
      `edit ${label}: blocks Save RPC call`
    );
    ok(await editor.isVisible(), `edit ${label}: keeps editor open`);
    ok((await page.getByText(/Updated template/).count()) === 0, `edit ${label}: does not show false success`);
    ok((await input.inputValue()) === expectedValueAfterBlur, `edit ${label}: does not silently restore old value`);
    ok((await input.getAttribute('aria-invalid')) === 'true', `edit ${label}: marks field aria-invalid`);
    const invalidAlert = (await editor.getByRole('alert').innerText()).toLowerCase();
    ok(invalidAlert.includes(expectedSubstr), `edit ${label}: shows clear validation error (${invalidAlert})`);
    ok((await edName.inputValue()) === 'Edited Week Template', `edit ${label}: preserves draft name`);
    ok((await edReps.inputValue()) === 'AMRAP', `edit ${label}: preserves draft reps`);
    ok((await edLoad.inputValue()) === '100', `edit ${label}: preserves draft load`);
    ok((await edNote.inputValue()) === 'Control 3s eccentric', `edit ${label}: preserves draft coach note`);
  };

  await checkInvalidNumericBlocksSave(edSets, '-2', '-2', 'negative', 'negative sets');
  await checkInvalidNumericBlocksSave(edSets, '2.5', '2.5', 'whole number', 'fractional sets');
  await edSets.fill('5');
  await checkInvalidNumericBlocksSave(edRest, 'abc', 'abc', 'valid number', 'non-numeric rest');
  await checkInvalidNumericBlocksSave(edRest, '1e999', '1e999', 'finite', 'non-finite rest');
  await checkInvalidNumericBlocksSave(edRest, '-10', '-10', 'negative', 'negative rest');
  await edRest.fill('120');
  ok(
    (await edSets.getAttribute('aria-invalid')) === null &&
      (await edRest.getAttribute('aria-invalid')) === null &&
      (await editor.getByRole('alert').count()) === 0,
    'edit numeric validation: correcting inputs clears validation error'
  );

  // 8c. Prevent duplicate submission and confirm successful RPC save
  const workoutsBeforeEdit = JSON.stringify(mock.db.workouts);
  const rpcStart = templateRpcCalls.length;
  templateUpdateRpcMode = 'delay-ok';
  const saveChangesBtn = editor.getByRole('button', { name: /Save changes|Saving/ });
  await saveChangesBtn.click();
  await page.waitForTimeout(40);
  ok(await saveChangesBtn.isDisabled(), 'edit: save button disabled while request is pending');
  await saveChangesBtn.click({ force: true });
  await page.getByText('Updated template Edited Week Template.').waitFor();

  ok(templateRpcCalls.length - rpcStart === 1, `edit: duplicate submission prevented (rpcCount=${templateRpcCalls.length - rpcStart})`);
  ok(templateDirectPatchCount === 0, `edit: never used direct PATCH on program_templates (count=${templateDirectPatchCount})`);

  const lastRpc = templateRpcCalls[templateRpcCalls.length - 1];
  ok(
    lastRpc.p_id === savedTplRow.id &&
      JSON.stringify(lastRpc.p_expected_data) === JSON.stringify(originalTplSnapshot),
    'edit: RPC sent original template snapshot as p_expected_data'
  );
  ok(
    lastRpc.p_data.id === originalTplSnapshot.id &&
      lastRpc.p_data.scope === originalTplSnapshot.scope &&
      lastRpc.p_data.createdAt === originalTplSnapshot.createdAt &&
      lastRpc.p_data.days.length === originalTplSnapshot.days.length &&
      lastRpc.p_data.days[0].offset === originalTplSnapshot.days[0].offset &&
      lastRpc.p_data.days[0].workout.id === originalTplSnapshot.days[0].workout.id &&
      lastRpc.p_data.days[0].workout.blocks[0].id === originalTplSnapshot.days[0].workout.blocks[0].id &&
      lastRpc.p_data.days[0].workout.blocks[0].exerciseId === originalTplSnapshot.days[0].workout.blocks[0].exerciseId &&
      JSON.stringify(lastRpc.p_data.days[0].workout.blocks[0].loggedSets) ===
        JSON.stringify(originalTplSnapshot.days[0].workout.blocks[0].loggedSets) &&
      JSON.stringify(lastRpc.p_data.days[1]) === JSON.stringify(originalTplSnapshot.days[1]),
    'edit: preserves id, scope, createdAt, offsets, block identity/loggedSets, and unedited days'
  );
  ok(JSON.stringify(mock.db.workouts) === workoutsBeforeEdit, 'edit: assigned workouts unchanged after template edit');

  // 8d. Reload and verify edited template + unit round-trip persist
  templateUpdateRpcMode = 'ok';
  await page.reload();
  await page.getByRole('button', { name: 'Programs' }).first().click();
  await page.getByLabel('Program for client').selectOption('client-syn-1');
  await page.getByLabel('Saved template').selectOption(savedTplRow.id);
  await page.getByRole('button', { name: 'Show preview' }).click();
  const editedPreviewText = await page.locator('#program-template-preview').innerText();
  ok(
    editedPreviewText.includes('Edited Week Template') &&
      editedPreviewText.includes('5 × AMRAP') &&
      editedPreviewText.includes('100 lb') &&
      editedPreviewText.includes('4 × 12') &&
      editedPreviewText.includes('88.2 lb'),
    'edit: persisted changes and lb round-trip survive reload'
  );

  // 8e. Zero values round-trip on edgeTemplate (tpl-edge)
  await page.getByLabel('Saved template').selectOption('tpl-edge');
  await page.getByRole('button', { name: 'Edit template' }).click();
  await editor.waitFor();
  const zeroSetsInput = editor.getByLabel('Untitled workout · Zero Load Drill sets');
  const zeroRepsInput = editor.getByLabel('Untitled workout · Zero Load Drill reps');
  const zeroLoadInput = editor.getByLabel('Untitled workout · Zero Load Drill load (lb)');
  const zeroRestInput = editor.getByLabel('Untitled workout · Zero Load Drill rest (s)');
  ok(
    (await zeroSetsInput.inputValue()) === '0' &&
      (await zeroRepsInput.inputValue()) === '0' &&
      (await zeroLoadInput.inputValue()) === '0' &&
      (await zeroRestInput.inputValue()) === '90',
    'edit: existing zero values display accurately in editor'
  );
  await zeroRestInput.fill('0');
  await editor.getByLabel('Edit template name').fill('Edge Values Zeroed');
  await editor.getByRole('button', { name: 'Save changes' }).click();
  await page.getByText('Updated template Edge Values Zeroed.').waitFor();
  const edgeAfterSave = mock.db.program_templates.find((r) => r.id === 'tpl-edge');
  ok(
    edgeAfterSave &&
      edgeAfterSave.data.name === 'Edge Values Zeroed' &&
      edgeAfterSave.data.days[0].workout.blocks[0].sets === 0 &&
      edgeAfterSave.data.days[0].workout.blocks[0].reps === '0' &&
      edgeAfterSave.data.days[0].workout.blocks[0].loadKg === 0 &&
      edgeAfterSave.data.days[0].workout.blocks[0].restSec === 0,
    'edit: zero values round-trip cleanly into persisted template'
  );

  // 8f. Editor responsive checks (375, 768, 1024, 1440px) with long text + phone input/button sizes
  await page.getByLabel('Saved template').selectOption('tpl-long');
  await page.getByRole('button', { name: 'Edit template' }).click();
  await editor.waitFor();
  for (const [w, h] of [
    [375, 812],
    [768, 1024],
    [1024, 768],
    [1440, 900]
  ]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(100);
    const ov = await measureOverflow(page);
    ok(ov.pageOverflow <= 0 && ov.offRight.length === 0, `edit: no horizontal overflow at ${w}x${h}`);
    if (w === 375) {
      const mobileMetrics = await editor.evaluate((el) => {
        const inputs = [...el.querySelectorAll('input')];
        const buttons = [...el.querySelectorAll('button')];
        const minFontPx = Math.min(...inputs.map((i) => parseFloat(getComputedStyle(i).fontSize)));
        const minInputHeight = Math.min(...inputs.map((i) => i.getBoundingClientRect().height));
        const minButtonHeight = Math.min(...buttons.map((b) => b.getBoundingClientRect().height));
        return { minFontPx, minInputHeight, minButtonHeight };
      });
      ok(mobileMetrics.minFontPx >= 16, `edit: phone input font >= 16px (${mobileMetrics.minFontPx}px)`);
      ok(mobileMetrics.minInputHeight >= 44, `edit: phone input height >= 44px (${Math.round(mobileMetrics.minInputHeight)}px)`);
      ok(mobileMetrics.minButtonHeight >= 44, `edit: phone button height >= 44px (${Math.round(mobileMetrics.minButtonHeight)}px)`);
    }
  }
  await editor.getByRole('button', { name: 'Cancel' }).click();

  // ---------------- Designer Attribution ----------------
  // 9a. Verified owned template shows stored designer name, never emails/UUIDs/client name, triggers zero extra profile queries or writes
  const attrLogStart = mock.log.length;
  await page.getByLabel('Saved template').selectOption('tpl-week');
  const designerEl = page.locator('#program-template-designer');
  await designerEl.waitFor();
  const ownedDesignerText = (await designerEl.innerText()).trim();
  ok(
    ownedDesignerText === 'Designer: Coach Demo',
    `attribution: shows verified owner display name (${ownedDesignerText})`
  );
  ok(
    !ownedDesignerText.includes('coach@example.com') &&
      !ownedDesignerText.includes(coachProfile.id) &&
      !ownedDesignerText.includes('Synthetic Athlete'),
    'attribution: never exposes email, UUID, or selected client name'
  );

  // Switch between templates & toggle preview without extra profile queries or writes
  await page.getByLabel('Saved template').selectOption('tpl-12wk');
  await page.getByRole('button', { name: /Show preview|Hide preview/ }).click();
  await page.getByLabel('Saved template').selectOption('tpl-week');
  const attrLogs = mock.log.slice(attrLogStart);
  const attrWriteLogs = attrLogs.filter((entry) => /^(POST|PATCH|PUT|DELETE)\b/.test(entry));
  const attrProfileLogs = attrLogs.filter((entry) => /\/rest\/v1\/profiles\b|pf_list_trainers/.test(entry));
  ok(attrWriteLogs.length === 0, `attribution: switching/viewing triggers zero writes (${attrWriteLogs.length})`);
  ok(attrProfileLogs.length === 0, `attribution: triggers zero new profiles queries or privileged RPCs (${attrProfileLogs.length})`);

  // 9b. Different persisted owner_id or missing owner_id never assumes signed-in coach
  const otherCoachUuid = '00000000-0000-0000-0000-000000000999';
  templateGetOverride = [
    { id: 'tpl-week', owner_id: coachProfile.id, data: weekTemplate, created_at: '2026-11-01T10:00:00.000Z' },
    { id: 'tpl-other-owner', owner_id: otherCoachUuid, data: { ...weekTemplate, id: 'tpl-other-owner', name: 'Other Coach Template' }, created_at: '2026-11-02T10:00:00.000Z' },
    { id: 'tpl-no-owner', owner_id: null, data: { ...weekTemplate, id: 'tpl-no-owner', name: 'Unowned Template' }, created_at: '2026-11-03T10:00:00.000Z' }
  ];
  await page.reload();
  await page.getByRole('button', { name: 'Programs' }).first().click();
  await page.getByLabel('Program for client').selectOption('client-syn-1');
  const attrSelect = page.getByLabel('Saved template');
  await attrSelect.selectOption('tpl-week');
  ok((await designerEl.innerText()).trim() === 'Designer: Coach Demo', 'attribution: verifies matching owner_id after reload');

  await attrSelect.selectOption('tpl-other-owner');
  const otherDesignerText = (await designerEl.innerText()).trim();
  ok(
    otherDesignerText === 'Designer: Designer name unavailable' &&
      !otherDesignerText.includes('Coach Demo') &&
      !otherDesignerText.includes(otherCoachUuid) &&
      !otherDesignerText.includes('Synthetic Athlete'),
    `attribution: other coach owner_id falls back honestly without assuming signed-in coach (${otherDesignerText})`
  );

  await attrSelect.selectOption('tpl-no-owner');
  const missingOwnerText = (await designerEl.innerText()).trim();
  ok(
    missingOwnerText === 'Designer: Designer name unavailable' &&
      !missingOwnerText.includes('Coach Demo'),
    `attribution: missing owner_id falls back honestly (${missingOwnerText})`
  );
  templateGetOverride = null;

  // 9c. Empty display_name on signed-in profile falls back honestly without leaking email/UUID
  coachProfile.display_name = '';
  await page.reload();
  await page.getByRole('button', { name: 'Programs' }).first().click();
  await page.getByLabel('Program for client').selectOption('client-syn-1');
  await page.getByLabel('Saved template').selectOption('tpl-week');
  const emptyProfileDesignerText = (await designerEl.innerText()).trim();
  ok(
    emptyProfileDesignerText === 'Designer: Designer name unavailable' &&
      !emptyProfileDesignerText.includes('coach@example.com') &&
      !emptyProfileDesignerText.includes(coachProfile.id),
    `attribution: blank display_name uses unavailable fallback without leaking email (${emptyProfileDesignerText})`
  );

  // 9d. Long unbroken designer name wraps cleanly with zero horizontal overflow/clipping at 375, 768, 1024, 1440px
  const longDesignerName = 'CoachSuperLongUnbrokenDesignerAttributionNameForResponsiveWrappingCheck_0123456789ABCDEF';
  coachProfile.display_name = longDesignerName;
  await page.reload();
  await page.getByRole('button', { name: 'Programs' }).first().click();
  await page.getByLabel('Program for client').selectOption('client-syn-1');
  await page.getByLabel('Saved template').selectOption('tpl-week');
  await page.getByRole('button', { name: /Show preview|Hide preview/ }).click();
  for (const [w, h] of [
    [375, 812],
    [768, 1024],
    [1024, 768],
    [1440, 900]
  ]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(150);
    const ov = await measureOverflow(page);
    const designerBounds = await page.evaluate(() => {
      const el = document.getElementById('program-template-designer');
      if (!el) return { missing: true };
      const section = el.closest('section');
      const er = el.getBoundingClientRect();
      const sr = section ? section.getBoundingClientRect() : er;
      const cs = getComputedStyle(el);
      const span = el.querySelector('span');
      const scs = span ? getComputedStyle(span) : cs;
      return {
        missing: false,
        text: el.innerText,
        scrollW: el.scrollWidth,
        clientW: el.clientWidth,
        rightOverflow: er.right - sr.right,
        clipped:
          cs.overflowX === 'hidden' ||
          cs.textOverflow === 'ellipsis' ||
          scs.overflowX === 'hidden' ||
          scs.textOverflow === 'ellipsis'
      };
    });
    ok(
      ov.pageOverflow <= 0 && ov.offRight.length === 0,
      `attribution: no page horizontal overflow at ${w}x${h} (page=${ov.pageOverflow}, off=${ov.offRight.join(', ')})`
    );
    ok(
      !designerBounds.missing &&
        designerBounds.text.includes(longDesignerName) &&
        designerBounds.scrollW <= designerBounds.clientW + 1 &&
        designerBounds.rightOverflow <= 1 &&
        !designerBounds.clipped,
      `attribution: long unbroken designer name wraps without clipping at ${w}x${h}`
    );
  }
  coachProfile.display_name = 'Coach Demo';

  // ---------------- Template Duplication ----------------
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.reload();
  await page.getByRole('button', { name: 'Programs' }).first().click();
  await page.getByLabel('Program for client').selectOption('client-syn-1');
  const dupSelect = page.getByLabel('Saved template');
  await dupSelect.selectOption('tpl-week');

  const dupBtn = page.getByRole('button', { name: 'Duplicate template' });
  const dupBtnBox = await dupBtn.boundingBox();
  ok(!!dupBtnBox && dupBtnBox.height >= 44, `duplicate: trigger button height >= 44px (${dupBtnBox ? Math.round(dupBtnBox.height) : 0}px)`);

  // 10a. Open with keyboard Enter -> suggested name prefilled -> Cancel performs zero writes
  const postBeforeCancelDup = templatePostCalls.length;
  const templatesBeforeCancelDup = JSON.stringify(mock.db.program_templates);
  const workoutsBeforeDupSuite = JSON.stringify(mock.db.workouts);
  const clientsBeforeDupSuite = JSON.stringify(mock.db.clients);

  await dupBtn.focus();
  await page.keyboard.press('Enter');
  const dupForm = page.locator('#program-template-duplicate');
  await dupForm.waitFor();
  const copyNameInput = dupForm.getByLabel('Copy name');
  ok(
    (await copyNameInput.inputValue()) === 'Foundation Week (Copy)',
    `duplicate: suggests edited copy name (${await copyNameInput.inputValue()})`
  );
  await copyNameInput.fill('Should Be Cancelled');
  await dupForm.getByRole('button', { name: 'Cancel' }).click();
  ok((await dupForm.count()) === 0, 'duplicate: Cancel closes inline form');
  ok(templatePostCalls.length === postBeforeCancelDup, 'duplicate: Cancel triggers zero writes');
  ok(JSON.stringify(mock.db.program_templates) === templatesBeforeCancelDup, 'duplicate: Cancel leaves DB untouched');

  // 10b. Open with Space -> blank/whitespace-only rejected without inserts
  await dupBtn.focus();
  await page.keyboard.press('Space');
  await dupForm.waitFor();
  await copyNameInput.fill('   ');
  await dupForm.getByRole('button', { name: 'Create copy' }).click();
  const blankAlert = dupForm.getByRole('alert');
  await blankAlert.waitFor();
  ok(
    (await blankAlert.innerText()).toLowerCase().includes('enter a template name'),
    'duplicate: rejects whitespace-only name with alert'
  );
  ok(templatePostCalls.length === postBeforeCancelDup, 'duplicate: whitespace-only triggers zero inserts');
  ok(JSON.stringify(mock.db.program_templates) === templatesBeforeCancelDup, 'duplicate: whitespace-only leaves DB untouched');

  // 10c. Failure preserves draft name, avoids false success, keeps original, allows retry
  await copyNameInput.fill('Retryable Copy');
  failNextTemplateSave = true;
  await dupForm.getByRole('button', { name: 'Create copy' }).click();
  await dupForm.getByRole('alert').waitFor();
  ok(
    await dupForm.isVisible(),
    'duplicate: save failure keeps inline form open'
  );
  ok(
    (await copyNameInput.inputValue()) === 'Retryable Copy',
    'duplicate: save failure preserves entered copy name'
  );
  ok(
    (await page.getByText(/Created template copy/).count()) === 0,
    'duplicate: save failure shows zero false success'
  );
  ok(
    JSON.stringify(mock.db.program_templates) === templatesBeforeCancelDup,
    'duplicate: save failure leaves DB untouched'
  );
  ok(
    (await dupSelect.inputValue()) === 'tpl-week',
    'duplicate: save failure keeps original template selected'
  );

  // 10d. Double-submission prevention, DB-default owner, selection after save, fresh IDs & cleared results
  const postStartDup = templatePostCalls.length;
  delayNextTemplateSaveMs = 300;
  const createCopyBtn = dupForm.getByRole('button', { name: /Create copy|Creating copy/ });
  await createCopyBtn.click();
  await page.waitForTimeout(40);
  ok(await createCopyBtn.isDisabled(), 'duplicate: submit button disabled while saving');
  ok(
    await dupForm.getByRole('button', { name: 'Cancel' }).isDisabled(),
    'duplicate: Cancel disabled while saving'
  );
  await createCopyBtn.click({ force: true });
  await page.getByText('Created template copy Retryable Copy.').waitFor();

  ok(
    templatePostCalls.length - postStartDup === 1,
    `duplicate: prevents duplicate submission (posts=${templatePostCalls.length - postStartDup})`
  );
  const postedDupPayload = templatePostCalls[templatePostCalls.length - 1];
  ok(
    !Object.prototype.hasOwnProperty.call(postedDupPayload, 'owner_id') &&
      !Object.prototype.hasOwnProperty.call(postedDupPayload.data, 'ownerId'),
    'duplicate: relies on database default ownership without trusting client owner_id'
  );

  const dupRow = mock.db.program_templates.find((r) => r.data && r.data.name === 'Retryable Copy');
  const srcRow = mock.db.program_templates.find((r) => r.id === 'tpl-week');
  ok(!!dupRow && dupRow.id !== srcRow.id && dupRow.data.id === dupRow.id, 'duplicate: persisted copy with fresh template ID');
  ok((await dupSelect.inputValue()) === dupRow.id, 'duplicate: selects newly persisted copy after save');
  ok(
    (await page.locator('#program-template-designer').innerText()).trim() === 'Designer: Coach Demo',
    'duplicate: resolves designer attribution from persisted owner_id'
  );
  ok(
    dupRow.data.scope === srcRow.data.scope &&
      dupRow.data.days.length === srcRow.data.days.length &&
      dupRow.data.days[0].offset === srcRow.data.days[0].offset &&
      dupRow.data.days[0].workout.id !== srcRow.data.days[0].workout.id &&
      dupRow.data.days[0].workout.blocks[0].id !== srcRow.data.days[0].workout.blocks[0].id &&
      dupRow.data.days[0].workout.blocks[0].exerciseId === srcRow.data.days[0].workout.blocks[0].exerciseId &&
      dupRow.data.days[0].workout.blocks[0].sets === srcRow.data.days[0].workout.blocks[0].sets &&
      dupRow.data.days[0].workout.blocks[0].reps === srcRow.data.days[0].workout.blocks[0].reps &&
      dupRow.data.days[0].workout.blocks[0].loadKg === srcRow.data.days[0].workout.blocks[0].loadKg &&
      dupRow.data.days[0].workout.status === 'planned' &&
      !dupRow.data.days[0].workout.completedAt &&
      dupRow.data.days[0].workout.blocks[0].loggedSets.every((s) => s.completed === false && s.reps === null),
    'duplicate: fresh workout/block IDs, preserved prescriptions, zero recorded results'
  );
  ok(
    JSON.stringify(mock.db.workouts) === workoutsBeforeDupSuite &&
      JSON.stringify(mock.db.clients) === clientsBeforeDupSuite,
    'duplicate: never touches assigned client workouts or client profiles'
  );

  // 10e. Persists across reload and edits independently from source template
  await page.reload();
  await page.getByRole('button', { name: 'Programs' }).first().click();
  await page.getByLabel('Program for client').selectOption('client-syn-1');
  await dupSelect.selectOption(dupRow.id);
  await page.getByRole('button', { name: 'Edit template' }).click();
  await editor.waitFor();
  await editor.getByLabel('Edit template name').fill('Independent Edited Copy');
  await editor.getByLabel('Lower Hinge · Romanian Deadlift sets').fill('6');
  await editor.getByRole('button', { name: 'Save changes' }).click();
  await page.getByText('Updated template Independent Edited Copy.').waitFor();

  await page.reload();
  await page.getByRole('button', { name: 'Programs' }).first().click();
  await page.getByLabel('Program for client').selectOption('client-syn-1');
  await dupSelect.selectOption(dupRow.id);
  await page.getByRole('button', { name: /Show preview|Hide preview/ }).click();
  const dupEditedPreview = await page.locator('#program-template-preview').innerText();
  ok(
    dupEditedPreview.includes('Independent Edited Copy') && dupEditedPreview.includes('6 × 6'),
    'duplicate: editing the copy updates only the copy and persists across reload'
  );
  await dupSelect.selectOption('tpl-week');
  const originalPreviewAfterDupEdit = await page.locator('#program-template-preview').innerText();
  ok(
    originalPreviewAfterDupEdit.includes('Foundation Week') &&
      originalPreviewAfterDupEdit.includes('4 × 6') &&
      !originalPreviewAfterDupEdit.includes('6 × 6'),
    'duplicate: original template stays completely untouched after editing copy'
  );

  // 10f. Responsive widths (375, 768, 1024, 1440px) with long unbroken copy name & phone touch/font checks
  const longCopyName = 'SuperLongUnbrokenDuplicatedProgramTemplateNameWithoutSpaces_0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  await page.getByRole('button', { name: 'Duplicate template' }).click();
  await dupForm.waitFor();
  await dupForm.getByLabel('Copy name').fill(longCopyName);

  for (const [w, h] of [
    [375, 812],
    [768, 1024],
    [1024, 768],
    [1440, 900]
  ]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(100);
    const ov = await measureOverflow(page);
    ok(
      ov.pageOverflow <= 0 && ov.offRight.length === 0,
      `duplicate form: no horizontal overflow at ${w}x${h} (page=${ov.pageOverflow}, off=${ov.offRight.join(', ')})`
    );
    if (w === 375) {
      const mobileMetrics = await dupForm.evaluate((el) => {
        const input = el.querySelector('input');
        const buttons = [...el.querySelectorAll('button')];
        return {
          fontPx: input ? parseFloat(getComputedStyle(input).fontSize) : 0,
          inputHeight: input ? input.getBoundingClientRect().height : 0,
          minButtonHeight: Math.min(...buttons.map((b) => b.getBoundingClientRect().height))
        };
      });
      ok(mobileMetrics.fontPx >= 16, `duplicate form: phone input font >= 16px (${mobileMetrics.fontPx}px)`);
      ok(mobileMetrics.inputHeight >= 44, `duplicate form: phone input height >= 44px (${Math.round(mobileMetrics.inputHeight)}px)`);
      ok(mobileMetrics.minButtonHeight >= 44, `duplicate form: phone button height >= 44px (${Math.round(mobileMetrics.minButtonHeight)}px)`);
    }
  }

  await dupForm.getByRole('button', { name: 'Create copy' }).click();
  await page.getByText(`Created template copy ${longCopyName}.`).waitFor();
  for (const [w, h] of [
    [375, 812],
    [768, 1024],
    [1024, 768],
    [1440, 900]
  ]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(100);
    const ov = await measureOverflow(page);
    ok(
      ov.pageOverflow <= 0 && ov.offRight.length === 0,
      `duplicate long result: no horizontal overflow at ${w}x${h} (page=${ov.pageOverflow}, off=${ov.offRight.join(', ')})`
    );
  }

  ok(pageErrors.length === 0, `no page errors (${pageErrors.join(' | ')})`);

  await browser.close();
  srv.close();
  process.exit(failures ? 1 : 0);
})().catch((e) => {
  console.error(e);
  srv.close();
  process.exit(1);
});
