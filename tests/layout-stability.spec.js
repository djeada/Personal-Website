const { test, expect } = require('@playwright/test');
const path = require('node:path');

const article = '/articles/parallel_and_concurrent_programming/08_designing_parallel_programs.html';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.layoutShifts = [];
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) window.layoutShifts.push(entry.value);
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
});

async function expectStable(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  expect(await page.evaluate(() => window.layoutShifts.reduce((sum, value) => sum + value, 0))).toBeLessThan(0.01);
}

for (const width of [390, 1280]) {
  for (const url of ['/', '/articles/blog_1.html', article, '/tools/eigenvalues/index.html']) {
    test(`delayed logo keeps layout stable: ${url} at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1'
        ? route.continue() : route.abort());
      let release;
      const ready = new Promise(resolve => { release = resolve; });
      await page.route('**/resources/brand/logo*.webp', async route => {
        await ready;
        await route.fulfill({ path: path.join(__dirname, '../src/resources/brand/logo.webp') });
      });
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      const logo = page.locator('#logo-image');
      const before = await logo.boundingBox();
      const navBefore = await page.locator('nav').boundingBox();
      release();
      await expect.poll(() => logo.evaluate(el => el.complete && el.naturalWidth > 0)).toBe(true);
      expect(await logo.boundingBox()).toEqual(before);
      expect(await page.locator('nav').boundingBox()).toEqual(navBefore);
      await expectStable(page);
    });
  }
}

test('mobile article position survives delayed app initialization', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1'
    ? route.continue() : route.abort());
  let release;
  const ready = new Promise(resolve => { release = resolve; });
  await page.route('**/app.js', async route => { await ready; await route.continue(); });
  await page.goto(article, { waitUntil: 'commit' });
  const body = page.locator('#article-body');
  await body.waitFor({ state: 'attached' });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const before = await body.boundingBox();
  release();
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('#table-of-contents-toggle')).toBeVisible();
  expect((await body.boundingBox()).y).toBe(before.y);
  await expectStable(page);
  await page.locator('#table-of-contents-toggle').click();
  await expect(page.locator('#table-of-contents-toggle')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#table-of-contents > ol')).toBeVisible();
});

test('contents links remain available without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1'
    ? route.continue() : route.abort());
  await page.goto(`http://127.0.0.1:8000${article}`);
  await expect(page.locator('#table-of-contents > ol')).toBeVisible();
  await context.close();
});

test('late search control does not resize the desktop header', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1'
    ? route.continue() : route.abort());
  await page.goto('/');
  const before = await page.locator('nav').boundingBox();
  // Model Google's replacement of the initial placeholder independently of its CDN.
  await page.locator('.gcse-search').evaluate(el => {
    const control = document.createElement('div');
    control.className = 'gsc-control-cse';
    control.style.height = '64px';
    control.innerHTML = '<input aria-label="Search" type="search">';
    el.replaceWith(control);
  });
  expect(await page.locator('nav').boundingBox()).toEqual(before);
  await expectStable(page);
});
