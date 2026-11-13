// Exercise library checks on the local (no cloud) build.
// Usage: node e2e/library.cjs <dist dir> [screenshot dir]
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = process.argv[2];
const shots = process.argv[3];
const PORT = 4194;
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
  console.log(`${c ? '  ok ' : 'FAIL '} ${m}`);
  if (!c) failures++;
};

(async () => {
  const b = await chromium.launch();
  const run = async (name, viewport, fn) => {
    const ctx = await b.newContext({ viewport });
    const p = await ctx.newPage();
    p.errors = [];
    p.on('pageerror', (e) => p.errors.push(e.message));
    await p.goto(`http://localhost:${PORT}/`);
    console.log(`\n${name}`);
    await fn(p);
    ok(p.errors.length === 0, 'no page errors ' + p.errors.join(' | '));
    ok((await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)) === 0, 'no horizontal overflow');
    await ctx.close();
  };
  const openLibrary = async (p, mobile) => {
    await p.getByRole('button', { name: 'Library' }).first().click().catch(async () => p.getByText('Library', { exact: true }).first().click());
    await p.getByRole('heading', { name: 'Exercise Library' }).waitFor({ timeout: 8000 });
    await p.getByRole('searchbox', { name: 'Search exercises' }).waitFor();
    await p.waitForTimeout(800); // catalog loads in the background
  };
  const names = (p) => p.locator('main h3').allTextContents();

  await run('desktop', { width: 1280, height: 900 }, async (p) => {
    await openLibrary(p);
    const search = p.getByRole('searchbox', { name: 'Search exercises' });
    await search.fill('db bench');
    await p.waitForTimeout(200);
    const r1 = await names(p);
    ok(r1.length > 0 && /dumbbell/i.test(r1.join(' ')) && /bench/i.test(r1.join(' ')), `“db bench” finds dumbbell bench (${r1.slice(0, 2).join(', ')})`);
    await search.fill('sqaut');
    await p.waitForTimeout(200);
    ok((await names(p)).some((n) => /squat/i.test(n)), 'typo “sqaut” still finds squats');
    await search.fill('zzzqx banana');
    await p.waitForTimeout(200);
    ok(await p.getByText('No exercises match.').isVisible(), 'empty state shown');
    await search.fill('dedlfit');
    await p.waitForTimeout(200);
    ok(await p.getByText('Did you mean').isVisible(), '“Did you mean” offered');
    await p.getByRole('button', { name: 'deadlift', exact: true }).click();
    await p.waitForTimeout(200);
    ok((await names(p)).some((n) => /deadlift/i.test(n)), 'tapping the suggestion searches it');
    await p.getByRole('button', { name: 'Clear search' }).click();

    // filters
    await p.getByRole('button', { name: 'Glutes', exact: true }).click();
    await p.getByLabel('Equipment').selectOption('Dumbbell');
    await p.waitForTimeout(200);
    const r2 = await names(p);
    ok(r2.length > 0, `muscle + equipment filters combine (${r2.length} results)`);
    await p.getByRole('button', { name: 'Reset' }).click();

    // favorites
    await search.fill('goblet squat');
    await p.waitForTimeout(200);
    const first = (await names(p))[0];
    await p.getByRole('button', { name: `Favorite ${first}` }).click();
    await p.getByRole('button', { name: 'Clear search' }).click();
    await p.getByRole('tab', { name: 'Favorites' }).click();
    await p.waitForTimeout(200);
    ok((await names(p)).join('|') === first, 'starred exercise appears under Favorites');
    await p.reload();
    await openLibrary(p);
    await p.getByRole('tab', { name: 'Favorites' }).click();
    await p.waitForTimeout(200);
    ok((await names(p)).join('|') === first, 'favorites survive a reload');
    await p.getByRole('tab', { name: 'Favorites' }).click();

    // quick add + details
    await p.getByRole('tab', { name: 'All', exact: true }).click();
    await search.fill('plank');
    await p.waitForTimeout(200);
    const target = (await names(p))[0];
    await p.getByRole('button', { name: `Add ${target} to workout` }).click();
    ok(await p.getByRole('status').filter({ hasText: 'Added:' }).isVisible(), 'tap + shows a confirmation');
    await p.locator('main h3').first().click();
    ok(await p.getByRole('complementary', { name: 'Exercise details' }).isVisible(), 'details panel opens');
    if (shots) await p.screenshot({ path: `${shots}/library-desktop.png` });
  });

  await run('phone', { width: 390, height: 844 }, async (p) => {
    await openLibrary(p);
    if (shots) await p.screenshot({ path: `${shots}/library-phone.png` });
    ok(!(await p.getByRole('complementary', { name: 'Exercise details' }).count()), 'no details panel until an exercise is tapped');
    await p.locator('main h3').first().click();
    const sheet = p.getByRole('complementary', { name: 'Exercise details' });
    await sheet.waitFor();
    const box = await sheet.boundingBox();
    ok(box && box.y > 100 && box.y + box.height <= 845, 'details open as a bottom sheet on a phone');
    if (shots) await p.screenshot({ path: `${shots}/library-phone-sheet.png` });
    await p.getByRole('button', { name: 'Close details' }).click();
    ok(!(await sheet.count()), 'sheet closes');
  });

  console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
  await b.close();
  srv.close();
  process.exit(failures ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
