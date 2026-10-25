const { test, expect } = require('@playwright/test');
const { installFlightDriver, openFlight } = require('./helpers/flappy-bird');

test.beforeEach(async ({ page }) => {
  await installFlightDriver(page);
});

test('idle, paused and finished flights stop scheduling frames', async ({ page }) => {
  await openFlight(page);
  expect(await page.evaluate(() => flightDriver.pending)).toBe(0);
  await expect(page.locator('#pause-btn')).toBeDisabled();
  await page.locator('#start-btn').click();
  await page.evaluate(() => flightDriver.advance(12));
  expect(await page.evaluate(() => flightDriver.pending)).toBe(1);
  await page.keyboard.press('p');
  await expect(page.locator('#overlay-title')).toHaveText('Flight paused');
  await page.evaluate(() => flightDriver.step());
  expect(await page.evaluate(() => flightDriver.pending)).toBe(0);
  const pausedY = await page.evaluate(() => flightDriver.birdY);
  await page.evaluate(() => flightDriver.step(60_000));
  await page.locator('#start-btn').click();
  await page.evaluate(() => flightDriver.step());
  expect(await page.evaluate(() => flightDriver.birdY)).toBeCloseTo(pausedY, 6);
  await page.evaluate(() => flightDriver.advance(180));
  await expect(page.locator('#start-btn')).toHaveText('Fly againSpace');
  expect(await page.evaluate(() => flightDriver.pending)).toBe(0);
  await expect(page.locator('#pause-btn')).toBeDisabled();
});

test('physics agree at 30, 60, 120 and 144 Hz and interpolate between steps', async ({ page }) => {
  const positions = [];
  for (const hz of [30, 60, 120, 144]) {
    await openFlight(page);
    await page.locator('#start-btn').click();
    await page.evaluate(hz => { flightDriver.step(); flightDriver.advance(hz / 2, hz); }, hz);
    positions.push(await page.evaluate(() => flightDriver.birdY));
  }
  expect(Math.max(...positions) - Math.min(...positions)).toBeLessThan(.1);

  await openFlight(page);
  await page.locator('#start-btn').click();
  const samples = await page.evaluate(() => {
    flightDriver.step();
    const values = [];
    for (let frame = 0; frame < 8; frame++) {
      flightDriver.step(1000 / 144);
      values.push(flightDriver.birdY);
    }
    return values;
  });
  // Once one physics step exists, even sub-step frames should move the bird.
  expect(new Set(samples.slice(2)).size).toBe(samples.length - 2);
});

test('short stalls catch up and long stalls have bounded work', async ({ page }) => {
  await openFlight(page);
  await page.locator('#start-btn').click();
  await page.evaluate(() => { flightDriver.step(); flightDriver.step(100); });
  const stalled = await page.evaluate(() => flightDriver.birdY);
  await openFlight(page);
  await page.locator('#start-btn').click();
  await page.evaluate(() => { flightDriver.step(); flightDriver.advance(6); });
  expect(await page.evaluate(() => flightDriver.birdY)).toBeCloseTo(stalled, 6);
  await page.evaluate(() => flightDriver.step(60_000));
  await expect(page.locator('#game-overlay')).not.toHaveClass(/is-visible/);
});

test('a long flight scores, reuses gate canvases and persists the best at a transition', async ({ page }) => {
  await openFlight(page);
  await page.locator('#mute-btn').click();
  await page.locator('#start-btn').click();
  const result = await page.evaluate(() => {
    let canvases = 0;
    const create = document.createElement.bind(document);
    document.createElement = (name, ...args) => {
      if (name === 'canvas') canvases++;
      return create(name, ...args);
    };
    flightDriver.advance(2400, 60, true);
    return {
      score: Number(document.querySelector('#score-label').textContent),
      saved: localStorage.getItem('flappy_highscore'),
      canvases, pending: flightDriver.pending
    };
  });
  expect(result.score).toBeGreaterThan(12);
  expect(result.canvases).toBeLessThanOrEqual(4);
  expect(result.saved).toBeNull();
  expect(result.pending).toBe(1);
  await page.keyboard.press('p');
  expect(await page.evaluate(() => Number(localStorage.getItem('flappy_highscore')))).toBe(result.score);
  await page.reload();
  await expect(page.locator('#hs-badge')).toHaveText(String(result.score));
});

test('gate artwork stays out of the frame loop', async ({ page }) => {
  await openFlight(page);
  await page.locator('#mute-btn').click();
  await page.locator('#start-btn').click();
  const drawsPerFrame = await page.evaluate(() => {
    flightDriver.advance(540, 60, true);
    const before = flightDriver.draws;
    flightDriver.advance(60, 60, true);
    return (flightDriver.draws - before) / 60;
  });
  expect(drawsPerFrame).toBeLessThan(60);
});

test('settings and search keep their keyboard controls; held keys do not flap repeatedly', async ({ page }) => {
  await openFlight(page);
  await page.locator('#difficulty').focus();
  await page.keyboard.press('ArrowUp');
  await expect(page.locator('#game-overlay')).toHaveClass(/is-visible/);
  await page.locator('input[name=q]').fill('p m ');
  await expect(page.locator('#mute-btn')).toHaveText('Sound on');
  await page.locator('#canvas').focus();
  await page.keyboard.down('Space');
  await page.evaluate(() => flightDriver.advance(12));
  const baseline = await page.evaluate(() => {
    const before = flightDriver.draws;
    flightDriver.step();
    return flightDriver.draws - before;
  });
  await page.keyboard.down('Space');
  await page.keyboard.up('Space');
  const repeated = await page.evaluate(() => {
    const before = flightDriver.draws;
    flightDriver.step();
    return flightDriver.draws - before;
  });
  // A regular flap adds seven particles; one new trail mote is allowed here.
  expect(repeated).toBeLessThanOrEqual(baseline + 1);
  await page.keyboard.press('p');
  await expect(page.locator('#overlay-title')).toHaveText('Flight paused');
});

test('hidden tabs pause and resume without advancing hidden time or duplicating loops', async ({ page }) => {
  await openFlight(page);
  await page.locator('#start-btn').click();
  await page.evaluate(() => {
    flightDriver.advance(12);
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
    flightDriver.step(60_000);
  });
  await expect(page.locator('#overlay-title')).toHaveText('Flight paused');
  expect(await page.evaluate(() => flightDriver.pending)).toBe(0);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
    flightDriver.step();
  });
  expect(await page.evaluate(() => flightDriver.pending)).toBe(0);
  await page.locator('#start-btn').click();
  await page.locator('#restart-btn').click();
  expect(await page.evaluate(() => flightDriver.pending)).toBe(1);
});

test('themes and skins redraw immediately while idle and all three realms differ', async ({ page }) => {
  await openFlight(page);
  const frames = await page.evaluate(() => flightDriver.frames);
  const images = [];
  for (const value of ['auto', 'day', 'night']) {
    await page.locator('#theme-mode').selectOption(value);
    await page.evaluate(() => flightDriver.step());
    images.push(await page.locator('#canvas').evaluate(canvas => canvas.toDataURL()));
    expect(await page.evaluate(() => flightDriver.pending)).toBe(0);
  }
  expect(new Set(images).size).toBe(3);
  await page.locator('#bird-skin').selectOption('frost');
  await page.evaluate(() => flightDriver.step());
  expect(await page.locator('#canvas').evaluate(canvas => canvas.toDataURL())).not.toBe(images[2]);
  expect(await page.evaluate(() => flightDriver.frames)).toBe(frames + 4);
});

for (const blocked of [false, true]) {
  test(`${blocked ? 'unavailable storage' : 'invalid saved settings'} does not prevent playing`, async ({ page }) => {
    await page.addInitScript(blocked => {
      if (blocked) {
        for (const name of ['getItem', 'setItem']) Storage.prototype[name] = () => { throw new Error('Storage blocked'); };
      } else {
        localStorage.setItem('moonveil_difficulty', 'missing');
        localStorage.setItem('flappy_bird_skin', 'missing');
        localStorage.setItem('flappy_theme', 'missing');
        localStorage.setItem('flappy_highscore', 'Infinity');
      }
    }, blocked);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await openFlight(page);
    await expect(page.locator('#difficulty')).toHaveValue('normal');
    await expect(page.locator('#hs-badge')).toHaveText('0');
    await page.locator('#start-btn').click();
    await page.locator('#mute-btn').click();
    await page.evaluate(() => flightDriver.advance(20));
    expect(await page.evaluate(() => flightDriver.pending)).toBe(1);
    expect(errors).toEqual([]);
  });
}

test('reduced motion omits decorative effects and still plays and scores', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openFlight(page);
  await page.locator('#mute-btn').click();
  await page.locator('#start-btn').click();
  await page.evaluate(() => flightDriver.advance(900, 60, true));
  expect(Number(await page.locator('#score-label').textContent())).toBeGreaterThan(2);
  await page.keyboard.press('p');
  await page.evaluate(() => flightDriver.step());
  expect(await page.evaluate(() => flightDriver.pending)).toBe(0);
});

for (const width of [320, 390, 768, 1440]) {
  test(`controls and start overlay fit at ${width}px, including after resize`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openFlight(page);
    const layout = await page.evaluate(() => {
      const shell = document.querySelector('.canvas-shell').getBoundingClientRect();
      const card = document.querySelector('.overlay-card').getBoundingClientRect();
      const topbar = document.querySelector('.game-topbar');
      return {
        viewport: document.documentElement.clientWidth, page: document.documentElement.scrollWidth,
        topbarWidth: topbar.clientWidth, topbarScroll: topbar.scrollWidth,
        contained: card.top >= shell.top && card.bottom <= shell.bottom && card.left >= shell.left && card.right <= shell.right
      };
    });
    expect(layout.page).toBeLessThanOrEqual(layout.viewport + 1);
    expect(layout.topbarScroll).toBeLessThanOrEqual(layout.topbarWidth + 1);
    expect(layout.contained).toBe(true);
    await page.locator('#start-btn').click();
    await page.evaluate(() => flightDriver.advance(540, 60, true));
    await page.setViewportSize({ width: width === 320 ? 1280 : 320, height: 900 });
    await expect.poll(() => page.locator('#canvas').evaluate(canvas => Math.abs(canvas.width / canvas.height - 1.6))).toBeLessThan(.02);
    await page.evaluate(() => flightDriver.advance(30, 60, true));
    expect(await page.evaluate(() => flightDriver.pending)).toBe(1);
  });
}
