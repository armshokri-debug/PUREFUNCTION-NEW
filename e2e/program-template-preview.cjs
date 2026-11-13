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
  let templateGetCount = 0;
  let failNextTemplateSave = false;
  await ctx.route('https://mock.supabase.co/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (req.method() === 'POST' && url.pathname === '/rest/v1/program_templates' && failNextTemplateSave) {
      failNextTemplateSave = false;
      return route.fulfill({
        status: 500,
        headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' },
        body: JSON.stringify({ message: 'Simulated template save failure' })
      });
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

  ok(pageErrors.length === 0, `no page errors (${pageErrors.join(' | ')})`);

  await browser.close();
  srv.close();
  process.exit(failures ? 1 : 0);
})().catch((e) => {
  console.error(e);
  srv.close();
  process.exit(1);
});
