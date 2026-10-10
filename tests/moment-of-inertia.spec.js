const { test, expect } = require('@playwright/test');
const M = require('../src/tools/moment_of_inertia/model.js');

test('standard centered moments and parallel-axis results match closed-form solutions', () => {
    const cases = [
        ['rod', 0, 0, 2 / 3], ['rod', 0, 1, 8 / 3], ['rod', 90, 0, 0],
        ['disk', 0, 0, 1], ['disk', 90, 0, 0.5], ['hoop', 0, 0, 2],
        ['hoop', 90, 0, 1], ['plate', 0, 0, 5 / 6], ['plate', 90, 0, 1 / 6],
        ['cylinder', 0, 0, 1], ['cylinder', 90, 0, 7 / 6],
        ['sphere', 0, 0, 0.8], ['sphere', 65, 0, 0.8], ['sphere', 65, -0.5, 1.3],
    ];
    for (const [shape, tilt, offset, expected] of cases) {
        expect(M.evaluate({ ...M.DEFAULTS, shape, tilt, offset }).exact.total).toBeCloseTo(expected, 12);
    }
});

test('changing mass and size has the correct linear and squared effects', () => {
    for (const shape of Object.keys(M.SHAPES)) {
        const c = { ...M.DEFAULTS, shape, tilt: 35, offset: 0.3 };
        const original = M.evaluate(c).exact.total;
        expect(M.evaluate({ ...c, mass: c.mass * 2 }).exact.total).toBeCloseTo(2 * original, 12);
        const doubled = { ...c, radius: c.radius * 2, length: c.length * 2, width: c.width * 2, height: c.height * 2, offset: c.offset * 2 };
        expect(M.evaluate(doubled).exact.total).toBeCloseTo(4 * original, 12);
    }
});

test('mass elements preserve mass and center, and finite sums converge for tilted shifted axes', () => {
    for (const shape of Object.keys(M.SHAPES)) {
        let previousError = Infinity;
        for (const resolution of [4, 8, 16]) {
            const d = M.evaluate({ ...M.DEFAULTS, shape, tilt: 35, offset: 0.3, resolution });
            expect(d.points.reduce((sum, p) => sum + p.dm, 0)).toBeCloseTo(d.config.mass, 10);
            for (const coord of ['x', 'y', 'z']) expect(d.points.reduce((sum, p) => sum + p[coord] * p.dm, 0)).toBeCloseTo(0, 10);
            const error = Math.abs(d.numerical - d.exact.total);
            expect(error).toBeLessThanOrEqual(previousError + 1e-10);
            previousError = error;
            expect(d.cumulative[0]).toBe(0);
            expect(d.cumulative.at(-1)).toBeCloseTo(d.numerical, 12);
            expect(d.bins.reduce((sum, b) => sum + b.inertia, 0)).toBeCloseTo(d.numerical, 10);
            expect(d.bins.reduce((sum, b) => sum + b.mass, 0)).toBeCloseTo(d.config.mass, 10);
            for (const p of d.points) expect(p.contribution).toBeCloseTo(p.dm * p.r2, 12);
        }
    }
});

test('perpendicular distance uses the full axis line and stays invariant during rigid rotation', () => {
    const c = M.normalize({ shape: 'cylinder', tilt: 40, offset: -0.6 });
    const { n, point: a } = M.axis(c);
    for (const p of M.sample(c).filter((_, i) => i % 17 === 0)) {
        const v = [p.x - a[0], p.y, p.z - a[2]];
        const dot = v.reduce((sum, value, i) => sum + value * n[i], 0);
        const r2 = v.reduce((sum, value) => sum + value * value, 0) - dot * dot;
        expect(M.distanceSquared(p, c)).toBeCloseTo(r2, 12);
        const shiftedAlongAxis = { x: p.x + 3 * n[0], y: p.y, z: p.z + 3 * n[2] };
        expect(M.distanceSquared(shiftedAlongAxis, c)).toBeCloseTo(r2, 12);
        expect(M.distanceSquared(M.rotate(p, c, 1.7), c)).toBeCloseTo(r2, 12);
    }
});

test('a sampled solid sphere fills its volume and approaches 2MR²/5 rather than the shell formula', () => {
    const d = M.evaluate({ ...M.DEFAULTS, shape: 'sphere', resolution: 16 });
    expect(d.points.some(p => Math.hypot(p.x, p.y, p.z) < 0.3)).toBe(true);
    expect(d.points.every(p => Math.hypot(p.x, p.y, p.z) < d.config.radius)).toBe(true);
    expect(Math.abs(d.numerical - 0.8) / 0.8).toBeLessThan(0.01);
    expect(d.numerical).toBeLessThan(2 * d.config.mass * d.config.radius ** 2 / 3);
});

test('torque motion obeys acceleration, angular kinematics, and the work-energy relationship', () => {
    const motion = M.motion(2, 3, 2);
    expect(motion).toEqual({ alpha: 1.5, omega: 3, angle: 3, energy: 9 });
    expect(motion.energy).toBe(3 * motion.angle);
    expect(M.motion(0, 1, 2)).toBeNull();
    expect(M.motion(1, 0, 2)).toEqual({ alpha: 0, omega: 0, angle: 0, energy: 0 });
    expect(M.motion(4, 3, 2).alpha).toBe(motion.alpha / 2);
});

test('invalid configurations cannot inject shapes or create non-finite geometry', () => {
    const d = M.evaluate({ shape: '__proto__', mass: Infinity, radius: -5, tilt: NaN, offset: -100, resolution: 123 });
    expect(d.config.shape).toBe('disk');
    expect(d.config.radius).toBe(0.2);
    expect(d.config.offset).toBe(-2);
    expect(d.points.every(p => Number.isFinite(p.contribution) && p.dm > 0)).toBe(true);
});

test('redistributing a disk into a hoop preserves mass and reaches both exact limits', () => {
    for (const tilt of [0, 35, 90]) {
        for (const offset of [0, -0.4]) {
            const config = { ...M.DEFAULTS, tilt, offset };
            for (const [hollow, shape] of [[0, 'disk'], [1, 'hoop']]) {
                const ring = M.evaluate({ ...config, shape: 'annulus', hollow });
                const limit = M.evaluate({ ...config, shape });
                expect(ring.exact.total).toBeCloseTo(limit.exact.total, 12);
                expect(ring.numerical).toBeCloseTo(limit.numerical, 12);
                expect(Number.isFinite(ring.density.value)).toBe(true);
            }
        }
    }
    for (const hollow of [0.25, 0.5, 0.9, 0.9999]) {
        const ring = M.evaluate({ shape: 'annulus', hollow, resolution: 16 });
        expect(ring.exact.total).toBeCloseTo(1 + hollow ** 2, 12);
        expect(ring.points.reduce((sum, p) => sum + p.dm, 0)).toBeCloseTo(2, 10);
        expect(ring.points.every(p => Math.hypot(p.x, p.y) > hollow && Math.hypot(p.x, p.y) < 1)).toBe(true);
        expect(Math.abs(ring.numerical - ring.exact.total)).toBeLessThan(0.002);
    }
});

test.describe('inertia lab in the browser', () => {
    test.beforeEach(async ({ page }) => {
        await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
    });

    const slider = async (page, id, value) => page.locator('#' + id).evaluate((el, value) => {
        el.value = String(value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);

    test('the outward-mass experiment connects geometry, explanation, and acceleration', async ({ page }) => {
        await page.goto('/tools/moment_of_inertia/');
        await page.getByRole('button', { name: 'Move mass outward', exact: true }).click();
        await expect(page.locator('#hollow')).toBeVisible();
        await expect(page.locator('#inertia-value')).toHaveText('1.000');
        await expect(page.locator('#comparison-headline')).toHaveText('Equal inertia. Equal acceleration.');
        await slider(page, 'hollow', 0.5);
        await expect(page.locator('#inertia-value')).toHaveText('1.250');
        await expect(page.locator('#current-alpha')).toHaveText('0.800');
        await expect(page.locator('#live-insight')).toContainText('same 2.00 kg');
        await expect(page.locator('#live-insight')).toContainText('1.25 times');
        await slider(page, 'hollow', 1);
        await expect(page.locator('#inertia-value')).toHaveText('2.000');
        await expect(page.locator('#reference-I')).toHaveText('1.000');
        await expect(page.locator('#current-alpha')).toHaveText('0.500');
        await expect(page.locator('#density-title')).toHaveText('Linear density');
        await expect(page.locator('#comparison-headline')).toHaveText('The reference accelerates 2.00× as fast.');
        await expect(page.locator('#mass-value')).toHaveText('2.00 kg');
    });

    test('scrubbing synchronizes motion, graph and calculation and resumes from that instant', async ({ page }) => {
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        await page.goto('/tools/moment_of_inertia/');
        await slider(page, 'motion-time', 1);
        await expect(page.locator('#current-omega')).toHaveText('1.000');
        await expect(page.locator('#current-angle')).toHaveText('0.500');
        await expect(page.locator('#reference-angle')).toHaveText('0.250');
        await expect(page.locator('#motion-chart')).toHaveAttribute('aria-label', /your body 1.000 rad\/s, reference 0.500 rad\/s/);
        await expect(page.locator('#motion-equation')).toContainText('θ = ½αt² = 0.500 rad');
        await page.locator('#resolution').selectOption('16');
        await expect(page.locator('#current-angle')).toHaveText('0.500');
        await expect(page.locator('#motion-time')).toHaveValue('1');
        await page.locator('#pause-motion').click();
        await expect(page.locator('#motion-status')).toContainText('After 2.00 s');
        await expect(page.locator('#current-angle')).toHaveText('2.000');
        await slider(page, 'motion-time', 0.5);
        await expect(page.locator('#current-angle')).toHaveText('0.125');
        await slider(page, 'torque', 0);
        await expect(page.locator('#motion-time')).toHaveValue('0');
        await expect(page.locator('#comparison-headline')).toHaveText('No torque. No change in spin.');
        await slider(page, 'motion-time', 2);
        await expect(page.locator('#current-omega')).toHaveText('0.000');
    });

    test('building the sum animates contributions and manual edits cancel playback', async ({ page }) => {
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        await page.goto('/tools/moment_of_inertia/');
        await page.locator('#animate-sum').click();
        await expect(page.locator('#animate-sum')).toHaveText('Pause sum');
        await expect.poll(() => page.locator('#accumulate').inputValue()).not.toBe('0');
        await slider(page, 'accumulate', 50);
        await expect(page.locator('#piece-count')).toHaveText('64 / 128 pieces included');
        await expect(page.locator('#animate-sum')).toHaveAttribute('aria-pressed', 'false');
        await page.waitForTimeout(120);
        await expect(page.locator('#accumulate')).toHaveValue('50');
        await page.locator('#animate-sum').click();
        await expect(page.locator('#piece-count')).toHaveText('128 / 128 pieces included', { timeout: 5000 });
        await expect(page.locator('#piece-value')).toHaveText('128 / 128');
        await expect(page.locator('#animate-sum')).toHaveAttribute('aria-pressed', 'false');
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await slider(page, 'accumulate', 0);
        await page.locator('#animate-sum').click();
        await expect(page.locator('#accumulate')).toHaveValue('100');
        await expect(page.locator('#animate-sum')).toContainText('reduced motion');
    });

    test('size changes stay visible, comparison scales match, and explanations follow the variable', async ({ page }) => {
        await page.goto('/tools/moment_of_inertia/');
        const scale = await page.locator('#specimen').getAttribute('data-scale');
        await slider(page, 'radius', 2);
        await expect(page.locator('#inertia-value')).toHaveText('4.000');
        await expect(page.locator('#specimen')).toHaveAttribute('data-scale', scale);
        await expect(page.locator('#live-insight')).toContainText('doubling radius');
        expect(await page.locator('#current-motion').getAttribute('data-scale')).toBe(await page.locator('#reference-motion').getAttribute('data-scale'));
        await slider(page, 'mass', 4);
        await expect(page.locator('#live-insight')).toContainText('doubling mass');
        await page.getByRole('button', { name: 'A sphere’s symmetry', exact: true }).click();
        await slider(page, 'tilt', 45);
        await expect(page.locator('#live-insight')).toContainText('Nothing changed!');
        await expect(page.locator('#inertia-value')).toHaveText('0.800');
    });

    for (const width of [320, 390, 768, 1280]) {
        test(`shapes, axes, mass elements and torque comparison work at ${width}px`, async ({ page }) => {
            const errors = [];
            page.on('pageerror', e => errors.push(e.message));
            await page.setViewportSize({ width, height: 900 });
            await page.emulateMedia({ reducedMotion: 'reduce' });
            await page.goto('/tools/moment_of_inertia/');
            await expect(page).toHaveTitle('Moment of Inertia Lab | Adam Djellouli');
            await expect(page.locator('#inertia-value')).toHaveText('1.000');
            await expect(page.locator('#reference-I')).toHaveText('2.000');
            await page.locator('#run-motion').click();
            await expect(page.locator('#current-angle')).toHaveText('2.000');
            await expect(page.locator('#reference-angle')).toHaveText('1.000');
            await expect(page.locator('#motion-status')).toContainText('Reduced motion');

            await page.getByRole('button', { name: 'Center vs. end', exact: true }).click();
            await expect(page.locator('#inertia-value')).toHaveText('2.667');
            await expect(page.locator('#reference-I')).toHaveText('0.667');
            await expect(page.locator('#radius')).toBeHidden();
            await expect(page.locator('#length')).toBeVisible();
            await page.locator('#run-motion').click();
            await expect(page.locator('#current-angle')).toHaveText('0.750');
            await expect(page.locator('#reference-angle')).toHaveText('3.000');

            for (const shape of Object.keys(M.SHAPES)) {
                await page.locator('#shape').selectOption(shape);
                await slider(page, 'tilt', 35);
                await slider(page, 'offset', 0.3);
                await expect(page.locator('#specimen-title')).toHaveText(M.SHAPES[shape].name);
                await expect(page.locator('#integral-equation math')).toHaveCount(1);
                await expect(page.locator('#distribution-table tr')).toHaveCount(10);
                await page.locator('#camera').selectOption('axis');
                await page.locator('#camera').selectOption('perspective');
                expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
            }
            await page.getByRole('button', { name: 'Disk vs. hoop', exact: true }).click();
            await page.locator('#pin-reference').click();
            await slider(page, 'mass', 4);
            await expect(page.locator('#inertia-value')).toHaveText('2.000');
            await expect(page.locator('#reference-I')).toHaveText('1.000');
            await expect(page.locator('#current-angle')).toHaveText('0.000');
            await page.locator('#run-motion').click();
            await expect(page.locator('#current-angle')).toHaveText('1.000');
            await expect(page.locator('#reference-angle')).toHaveText('2.000');

            await slider(page, 'accumulate', 0);
            await expect(page.locator('#sum-equation')).toContainText('0.000');
            await expect(page.locator('#piece-count')).toHaveText('0 / 128 pieces included');
            await slider(page, 'accumulate', 50);
            await expect(page.locator('#piece-count')).toHaveText('64 / 128 pieces included');
            await slider(page, 'accumulate', 100);
            await page.locator('#piece').focus();
            await page.keyboard.press('End');
            await expect(page.locator('#piece-value')).toHaveText('128 / 128');
            await expect(page.locator('#piece-position')).toContainText('included in the sum');
            const before = await page.locator('#integration-error').textContent();
            await page.locator('#resolution').selectOption('16');
            await expect(page.locator('#piece-count')).toHaveText('512 / 512 pieces included');
            expect(await page.locator('#integration-error').textContent()).not.toBe(before);
            await page.locator('#reset-body').click();
            await expect(page.locator('#inertia-value')).toHaveText('1.000');
            expect(errors).toEqual([]);
            await page.screenshot({ path: `screenshots/moment-of-inertia-${width}.png`, fullPage: true });
        });
    }

    test('ideal axial rod is explained, disabling invalid motion until the axis changes', async ({ page }) => {
        await page.goto('/tools/moment_of_inertia/');
        await page.locator('#shape').selectOption('rod');
        await page.getByRole('button', { name: 'x axis · 90°', exact: true }).click();
        await expect(page.locator('#inertia-value')).toHaveText('0.000');
        await expect(page.locator('#current-alpha')).toHaveText('undefined');
        await expect(page.locator('#run-motion')).toBeDisabled();
        await expect(page.locator('#motion-status')).toContainText('no finite value');
        await expect(page.locator('#live-insight')).toContainText('finite thickness');
        await slider(page, 'offset', 0.5);
        await expect(page.locator('#inertia-value')).toHaveText('0.500');
        await expect(page.locator('#run-motion')).toBeEnabled();
        await expect(page.locator('#current-alpha')).toHaveText('2.000');
    });

    test('animation can pause, resume, reset, and finish with physical values', async ({ page }) => {
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        await page.goto('/tools/moment_of_inertia/');
        await page.locator('#run-motion').click();
        await expect(page.locator('#current-omega')).not.toHaveText('0.000');
        await page.locator('#pause-motion').click();
        const angle = await page.locator('#current-angle').textContent();
        await expect(page.locator('#pause-motion')).toHaveText('Resume');
        await page.waitForTimeout(150);
        await expect(page.locator('#current-angle')).toHaveText(angle);
        await page.locator('#pause-motion').click();
        await expect(page.locator('#motion-status')).toContainText('After 2.00 s');
        await expect(page.locator('#current-omega')).toHaveText('2.000');
        await expect(page.locator('#current-angle')).toHaveText('2.000');
        await expect(page.locator('#reference-angle')).toHaveText('1.000');
        await page.locator('#reset-motion').click();
        await expect(page.locator('#current-angle')).toHaveText('0.000');
        await expect(page.locator('#pause-motion')).toBeDisabled();
    });

    test('theme changes redraw the chart, and native math works with all external requests blocked', async ({ page, context }) => {
        await context.addCookies([{ name: 'darkMode', value: 'true', domain: '127.0.0.1', path: '/' }]);
        await page.goto('/tools/moment_of_inertia/');
        await expect(page.locator('body')).toHaveClass(/dark-mode/);
        await expect(page.locator('#integral-equation math')).toBeVisible();
        const before = await page.locator('#distribution-chart rect').last().getAttribute('fill');
        await page.getByRole('button', { name: 'Toggle dark mode' }).click();
        await expect(page.locator('body')).not.toHaveClass(/dark-mode/);
        expect(await page.locator('#distribution-chart rect').last().getAttribute('fill')).not.toBe(before);
        await page.screenshot({ path: 'screenshots/moment-of-inertia-light.png', fullPage: true });
    });

    test('lab is discoverable through the existing tools filter and keyboard navigation', async ({ page }) => {
        await page.goto('/core/tools.html');
        await page.getByLabel('Find a tool').fill('inertia');
        await expect(page.locator('.tool-card:visible')).toHaveCount(1);
        await page.locator('.tool-card:visible').focus();
        await page.keyboard.press('Enter');
        await expect(page).toHaveTitle('Moment of Inertia Lab | Adam Djellouli');
        await page.getByRole('button', { name: 'Turn the axis', exact: true }).focus();
        await page.keyboard.press('Enter');
        await expect(page.locator('#inertia-value')).toHaveText('0.500');
        await expect(page.locator('#reference-I')).toHaveText('1.000');
    });
});
