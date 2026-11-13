// Responsive check: node e2e/responsive-check.cjs <demo dist dir> [shots dir]
// Build demo first: npx vite build --outDir /tmp/dist-local --base /  (no VITE_SUPABASE_URL)
// Crawl the local demo build at several widths and report horizontal overflow.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = process.argv[2], shots = process.argv[3];
const PORT = 4201;
if (shots) fs.mkdirSync(shots, { recursive: true });
http.createServer((q, r) => {
  let f = path.join(root, decodeURIComponent(q.url.split('?')[0]));
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(root, 'index.html');
  const type = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' }[path.extname(f)] || 'application/octet-stream';
  r.writeHead(200, { 'content-type': type }); r.end(fs.readFileSync(f));
}).listen(PORT);

const VP = { desktop: { width: 1440, height: 900 }, mobile: { width: 375, height: 812 }, tablet: { width: 768, height: 1024 }, tabletL: { width: 1024, height: 768 } };

async function measure(p) {
  return p.evaluate(() => {
    const W = window.innerWidth;
    const page = document.documentElement.scrollWidth - W;
    const scrollers = [], offRight = [];
    const label = (el) => {
      const t = (el.getAttribute('aria-label') || el.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 50);
      return `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').slice(0, 3).join('.') : ''} "${t}"`;
    };
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      if (/(auto|scroll)/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0)
        scrollers.push(`${label(el)} (${el.scrollWidth}>${el.clientWidth})`);
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.right > W + 2 && !el.closest('[class*="overflow-x"],[class*="overflow-auto"],[class*="overflow-hidden"]'))
        offRight.push(`${label(el)} right=${Math.round(r.right)}`);
    }
    return { page, scrollers: [...new Set(scrollers)].slice(0, 8), offRight: offRight.slice(0, 5) };
  });
}

(async () => {
  let failures = 0, unvisited = 0;
  const b = await chromium.launch();
  for (const [vn, vp] of Object.entries(VP)) {
    const ctx = await b.newContext({ viewport: vp, hasTouch: vn !== 'tabletL' });
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(`http://localhost:${PORT}/`); await p.waitForTimeout(1500);
    const report = async (name) => {
      await p.waitForTimeout(400);
      const m = await measure(p);
      const bad = m.page > 0 || m.scrollers.length || m.offRight.length;
      if (bad) failures++;
      console.log(`${bad ? 'XX' : 'ok'} [${vn}] ${name}${m.page > 0 ? ` PAGE+${m.page}px` : ''}`);
      m.scrollers.forEach((s) => console.log('     scroll: ' + s));
      m.offRight.forEach((s) => console.log('     off:    ' + s));
      if (shots) await p.screenshot({ path: `${shots}/${vn}-${name.replace(/[^\w]+/g, '_')}.png`, fullPage: true });
    };
    const click = async (loc) => { try { await loc.first().click({ timeout: 2500 }); return true; } catch { return false; } };
    await report('home');
    // open the nav (mobile may hide it behind a menu button)
    for (const nav of ['Library', 'Programs', 'Messages', 'Clients']) {
      if (!(await click(p.getByRole('button', { name: new RegExp('^' + nav, 'i') })))) {
        await click(p.getByRole('button', { name: /menu/i }));
        if (!(await click(p.getByRole('button', { name: new RegExp('^' + nav, 'i') })))) { console.log(`?? [${vn}] no nav ${nav}`); unvisited++; continue; }
      }
      await report('nav-' + nav);
    }
    // open first client
    const row = p.locator('main').getByText('Alex Carter', { exact: true });
    if (!(await click(row))) { console.log(`?? [${vn}] no client row`); unvisited++; }
    await report('client');
    for (const tab of ['Exercises', 'Assessment', 'Notes', 'Goals', 'Progression', 'Nutrition']) {
      if (!(await click(p.getByRole('tab', { name: tab })))) if (!(await click(p.getByRole('button', { name: new RegExp('^' + tab + '$') })))) { console.log(`?? [${vn}] no tab ${tab}`); unvisited++; continue; }
      await report('tab-' + tab);
      const subs = { Exercises: ['Program', 'Exercise library', 'History'], Assessment: ['Overview', 'New assessment', 'Reports'] }[tab] || [];
      for (const s of subs) {
        if (await click(p.getByRole('tab', { name: s })) || await click(p.getByRole('button', { name: new RegExp('^' + s + '$') }))) await report(`tab-${tab}-${s}`);
      }
      if (tab === 'Assessment') await click(p.getByRole('button', { name: /^Overview$/ }));
    }
    if (await click(p.getByRole('button', { name: /^Client$/ }))) {
      await report('clientapp-today');
      for (const t of ['Progress', 'Chat', 'Refer', 'Today']) if (await click(p.getByRole('button', { name: new RegExp(t, 'i') }))) await report('clientapp-' + t);
    } else { console.log(`?? [${vn}] no client switch`); unvisited++; }
    if (errs.length) { failures++; console.log(`!! [${vn}] page errors: ${[...new Set(errs)].slice(0, 3).join(' | ')}`); }
    await ctx.close();
  }
  await b.close();
  console.log(`Responsive check: ${failures} failures, ${unvisited} unvisited views`);
  process.exit(failures || unvisited ? 1 : 0);
})();
