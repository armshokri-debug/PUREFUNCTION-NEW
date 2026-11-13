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
  await ctx.route('https://mock.supabase.co/**', mock.handler);
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

  await page.reload();
  await page.getByRole('button', { name: 'Programs' }).first().click();
  await page.getByLabel('Saved template').waitFor();

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

  ok(pageErrors.length === 0, `no page errors (${pageErrors.join(' | ')})`);

  await browser.close();
  srv.close();
  process.exit(failures ? 1 : 0);
})().catch((e) => {
  console.error(e);
  srv.close();
  process.exit(1);
});
