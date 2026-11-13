// Home-screen install checks. Usage: node e2e/pwa.cjs <dist dir> <base path, e.g. /Purefunction-2/> [screenshot dir]
const { chromium, devices } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = process.argv[2];
const base = process.argv[3] || '/';
const shots = process.argv[4];
const PORT = 4196;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
const srv = http
  .createServer((q, r) => {
    const rel = decodeURIComponent(q.url.split('?')[0]).slice(base.length - 1);
    let f = path.join(root, rel);
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(root, 'index.html');
    r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' });
    r.end(fs.readFileSync(f));
  })
  .listen(PORT);
const URL0 = `http://localhost:${PORT}${base}`;

let failures = 0;
const ok = (c, m) => {
  console.log(`${c ? '  ok ' : 'FAIL '} ${m}`);
  if (!c) failures++;
};

(async () => {
  const b = await chromium.launch();

  // ---- installability files ----
  {
    const ctx = await b.newContext();
    const p = await ctx.newPage();
    await p.goto(URL0);
    const href = await p.locator('link[rel=manifest]').getAttribute('href');
    ok(href === `${base}manifest.webmanifest`, `manifest linked under the site base (${href})`);
    const m = await (await ctx.request.get(new URL(href, URL0).href)).json();
    ok(m.display === 'standalone' && m.name === 'Pure Function', 'manifest: standalone, named');
    let allIcons = true;
    for (const i of m.icons) {
      const r = await ctx.request.get(new URL(i.src, new URL(href, URL0)).href);
      if (!r.ok() || !(r.headers()['content-type'] || '').includes('image/png')) allIcons = false;
    }
    ok(allIcons && m.icons.some((i) => i.purpose === 'maskable') && m.icons.some((i) => i.sizes === '512x512'), 'manifest icons load (incl. 512 and maskable)');
    const startOk = (await ctx.request.get(new URL(m.start_url, new URL(href, URL0)).href)).ok();
    ok(startOk, 'start_url opens the app');
    const touch = await p.locator('link[rel=apple-touch-icon]').getAttribute('href');
    ok((await ctx.request.get(new URL(touch, URL0).href)).ok(), 'iPhone home-screen icon loads');
    ok((await p.locator('meta[name=viewport]').getAttribute('content')).includes('viewport-fit=cover'), 'viewport-fit=cover so the notch/home bar are handled');
    // service worker
    await p.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller !== undefined, null, { timeout: 8000 }).catch(() => {});
    const reg = await p.evaluate(async () => {
      const r = await navigator.serviceWorker.ready;
      return r.scope;
    });
    ok(reg === URL0, `service worker registered for the app scope (${reg})`);
    await p.reload();
    await p.waitForTimeout(500);
    await ctx.setOffline(true);
    await p.reload().catch(() => {});
    await p.waitForTimeout(800);
    ok((await p.locator('#root').innerHTML()).length > 50, 'app shell still opens offline');
    await ctx.setOffline(false);
    await ctx.close();
  }

  // ---- install card ----
  const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
  const open = async (ua, viewport) => {
    const ctx = await b.newContext({ userAgent: ua, viewport, hasTouch: true });
    const p = await ctx.newPage();
    p.errors = [];
    p.on('pageerror', (e) => p.errors.push(e.message));
    await p.goto(URL0);
    // local demo: switch to the client view
    await p.getByRole('button', { name: 'Client', exact: true }).first().click();
    await p.waitForTimeout(600);
    return [ctx, p];
  };
  {
    const [ctx, p] = await open(IPHONE_UA, { width: 390, height: 844 });
    const card = p.getByRole('region', { name: 'Add to home screen' });
    ok(await card.isVisible(), 'iPhone client sees the install card');
    ok(await card.getByText('Add to Home Screen').isVisible(), 'iPhone card explains Share → Add to Home Screen');
    if (shots) await p.screenshot({ path: `${shots}/install-iphone.png` });
    await card.getByRole('button', { name: 'Close' }).click();
    ok(!(await card.count()), 'card closes');
    await p.reload();
    await p.getByRole('button', { name: 'Client', exact: true }).first().click();
    await p.waitForTimeout(500);
    ok(!(await p.getByRole('region', { name: 'Add to home screen' }).count()), 'closed card stays closed after reload');
    ok(p.errors.length === 0, 'no page errors ' + p.errors.join('|'));
    await ctx.close();
  }
  {
    const [ctx, p] = await open(devices['Desktop Chrome'].userAgent, { width: 1280, height: 800 });
    ok(!(await p.getByRole('region', { name: 'Add to home screen' }).count()), 'laptops are not nagged to install');
    await ctx.close();
  }

  console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
  await b.close();
  srv.close();
  process.exit(failures ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
