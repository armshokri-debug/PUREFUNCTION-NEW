// Public signed-out production checks only. No credentials, mail or data writes.
const { chromium } = require('playwright');
const url = process.argv[2];
if (!url || !url.startsWith('https://armshokri-debug.github.io/PUREFUNCTION-NEW/')) throw Error('Expected production URL');
(async () => {
  const browser = await chromium.launch();
  try {
    for (const width of [375, 768, 1024, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
      const page = await context.newPage(); const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
      if (!response.ok()) throw Error('Production HTTP ' + response.status());
      await page.getByRole('heading', { name: 'Client sign in', exact: true }).waitFor();
      await page.getByLabel('Email', { exact: true }).waitFor();
      if (!(await page.evaluate(() => document.documentElement.scrollWidth === innerWidth))) throw Error('Horizontal overflow at '+width);
      await page.getByRole('tab', { name: 'I’m the coach' }).click();
      await page.getByRole('heading', { name: 'Coach sign in', exact: true }).waitFor();
      if (errors.length) throw Error(errors.join(' | '));
      console.log('PASS production sign-in and layout at '+width+'px');
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
