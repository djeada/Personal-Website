const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  // Keep layout and loader assertions independent of third-party availability.
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    return url.hostname === '127.0.0.1' ? route.continue() : route.abort();
  });
});

test('simulation dependencies load once, in order, only near the viewport', async ({ page }) => {
  const requests = [];
  await page.route('**/three.min.js', route => {
    requests.push('three');
    return route.fulfill({ contentType: 'application/javascript', body: 'window.THREE = {};' });
  });
  await page.route('**/ring-universe.js', route => {
    requests.push('simulation');
    return route.fulfill({ contentType: 'application/javascript', body: `
      if (!window.THREE) throw new Error('Three.js must load first');
      window.createRingUniverseSimulation = container => {
        container.dataset.initialized = Number(container.dataset.initialized || 0) + 1;
        return { dispose() {} };
      };
    ` });
  });
  await page.goto('/');
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  expect(requests).toEqual([]);
  const simulation = page.locator('#threejs-container');
  await simulation.scrollIntoViewIfNeeded();
  await expect(simulation).toHaveAttribute('data-initialized', '1');
  expect(requests).toEqual(['three', 'simulation']);
  await page.locator('h1').scrollIntoViewIfNeeded();
  await simulation.scrollIntoViewIfNeeded();
  await expect(simulation).toHaveAttribute('data-initialized', '1');
  expect(requests).toHaveLength(2);
});

test('failed simulation downloads offer a working retry', async ({ page }) => {
  let attempts = 0;
  await page.route('**/three.min.js', route => {
    attempts++;
    return attempts === 1 ? route.abort() : route.fulfill({
      contentType: 'application/javascript', body: 'window.THREE = {};',
    });
  });
  await page.route('**/ring-universe.js', route => route.fulfill({
    contentType: 'application/javascript',
    body: 'window.createRingUniverseSimulation = c => { c.dataset.initialized = "yes"; return {}; };',
  }));
  await page.goto('/');
  await page.locator('#threejs-container').scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: 'Load interactive simulation' }).click();
  await expect(page.locator('#threejs-container')).toHaveAttribute('data-initialized', 'yes');
  expect(attempts).toBe(2);
});

for (const width of [320, 390, 768]) {
  test(`simulation fits its content container at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    const layout = await page.locator('#threejs-container').evaluate(el => {
      const parent = el.parentElement;
      const rect = el.getBoundingClientRect();
      const outer = parent.getBoundingClientRect();
      const css = getComputedStyle(parent);
      return {
        left: rect.left, right: rect.right,
        contentLeft: outer.left + parseFloat(css.paddingLeft),
        contentRight: outer.right - parseFloat(css.paddingRight),
        pageWidth: document.documentElement.scrollWidth,
        viewport: document.documentElement.clientWidth,
        overflowing: [...document.body.querySelectorAll('*')].filter(node => {
          const box = node.getBoundingClientRect();
          return getComputedStyle(node).visibility !== 'hidden' && box.right > innerWidth + 1;
        }).slice(0, 12).map(node => ({
          tag: node.tagName, id: node.id, className: node.className,
          right: node.getBoundingClientRect().right,
        })),
      };
    });
    expect(layout.left).toBeGreaterThanOrEqual(layout.contentLeft - 1);
    expect(layout.right).toBeLessThanOrEqual(layout.contentRight + 1);
    expect(layout.pageWidth, JSON.stringify(layout.overflowing)).toBeLessThanOrEqual(layout.viewport + 1);
  });
}

test('navigation exposes desktop links and clears the mobile scroll lock on resize', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  const menu = page.locator('#main-menu');
  await expect(menu).toHaveAttribute('aria-hidden', 'false');
  expect(await menu.evaluate(el => el.inert)).toBe(false);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(menu).toHaveAttribute('aria-hidden', 'true');
  expect(await menu.evaluate(el => el.inert)).toBe(true);
  const toggle = page.locator('#navbar-toggle');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(menu).toHaveAttribute('aria-hidden', 'false');
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(menu).toHaveAttribute('aria-hidden', 'false');
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(menu).toHaveAttribute('aria-hidden', 'true');
  await toggle.click();
  await page.keyboard.press('Escape');
  await expect(toggle).toBeFocused();
  await expect(menu).toHaveAttribute('aria-hidden', 'true');
});

test('tall revealed content becomes readable when less than ten percent is visible', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const section = document.createElement('div');
    section.id = 'tall-content';
    section.className = 'reveal';
    section.style.height = '20000px';
    section.textContent = 'Long content';
    document.body.appendChild(section);
    initScrollReveal();
    window.scrollTo({ top: section.offsetTop + 1000, behavior: 'instant' });
  });
  await expect(page.locator('#tall-content')).toHaveClass(/revealed/);
});

test('reading progress uses a finite transform and updates after content resizes', async ({ page }) => {
  await page.goto('/articles/parallel_and_concurrent_programming/08_designing_parallel_programs.html');
  const progress = page.locator('#reading-progress');
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
  await expect.poll(() => progress.evaluate(el => el.style.transform)).toBe('scaleX(1)');
  await page.evaluate(() => {
    const spacer = document.createElement('div');
    spacer.style.height = '10000px';
    document.body.appendChild(spacer);
  });
  await expect.poll(() => progress.evaluate(el => Number(el.style.transform.match(/scaleX\((.*)\)/)[1]))).toBeLessThan(1);
  expect(await progress.evaluate(el => el.style.width)).toBe('');
});
