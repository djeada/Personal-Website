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
            expect(Math.abs(d.bins.reduce((sum, b) => sum + b.inertia, 0) - d.exact.total)).toBeLessThanOrEqual(0.01 * d.exact.total + 1e-12);
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

test('distance bands describe the physical body without sampling gaps', () => {
    const disk = M.evaluate({ ...M.DEFAULTS, resolution: 4 });
    disk.bins.forEach((b, i) => expect(b.mass / disk.config.mass).toBeCloseTo((2 * i + 1) / 100, 3));
    const rod = M.evaluate({ ...M.DEFAULTS, shape: 'rod' });
    rod.bins.forEach(b => expect(b.mass / rod.config.mass).toBeCloseTo(0.1, 10));
    const sphere = M.evaluate({ ...M.DEFAULTS, shape: 'sphere' });
    sphere.bins.forEach(b => {
        const exact = (1 - (b.from / 1) ** 2) ** 1.5 - (1 - (b.to / 1) ** 2) ** 1.5;
        expect(Math.abs(b.mass / sphere.config.mass - exact)).toBeLessThan(0.01);
    });
    M.evaluate({ ...M.DEFAULTS, shape: 'sphere', tilt: 35 }).bins.forEach((b, i) => expect(b.mass).toBeCloseTo(sphere.bins[i].mass, 10));
});

test('the farthest point bounds every mass element and tracks the swinging end', () => {
    const end = M.farthestPoint(M.normalize({ shape: 'rod', offset: 1 }));
    expect([end.x, end.y, end.z, end.r]).toEqual([-1, 0, 0, 2]);
    expect(M.farthestPoint(M.normalize({ shape: 'sphere', tilt: 35, offset: -0.4 })).r).toBeCloseTo(1.4, 12);
    for (const shape of Object.keys(M.SHAPES)) {
        const c = M.normalize({ shape, tilt: 35, offset: 0.3, resolution: 16 });
        const far = M.farthestPoint(c);
        expect(M.distanceSquared(far, c)).toBeCloseTo(far.r ** 2, 12);
        for (const p of M.sample(c)) expect(Math.sqrt(p.r2)).toBeLessThanOrEqual(far.r + 1e-9);
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

test('pieces are visited in nested-sum order: rings inside slices, pieces inside rings', () => {
    const levels = { rod: 1, hoop: 1, disk: 2, annulus: 2, plate: 2, cylinder: 3, sphere: 3 };
    for (const [shape, depth] of Object.entries(levels)) {
        const d = M.evaluate({ ...M.DEFAULTS, shape });
        expect(d.build).toHaveLength(d.points.length);
        expect(new Set(d.build)).toEqual(new Set(d.points));
        d.build.forEach((p, i) => {
            expect(p.idx).toHaveLength(depth);
            if (i) {
                const prev = d.build[i - 1].idx, cur = p.idx;
                const first = cur.findIndex((v, k) => v !== prev[k]);
                expect(first).toBeGreaterThanOrEqual(0);
                expect(cur[first]).toBeGreaterThan(prev[first]);
            }
        });
        expect(d.build.reduce((sum, p) => sum + p.contribution, 0)).toBeCloseTo(d.numerical, 12);
    }
    // A cylinder ring has 2n pieces and all of them sit at the same distance from its own axis.
    const cylinder = M.evaluate({ ...M.DEFAULTS, shape: 'cylinder' });
    const ring = cylinder.build.filter(p => p.idx[0] === 1 && p.idx[1] === 3);
    expect(ring).toHaveLength(16);
    ring.forEach(p => expect(p.r2).toBeCloseTo(ring[0].r2, 12));
    expect(M.evaluate({ ...M.DEFAULTS, shape: 'annulus', hollow: 1 }).build[0].idx).toHaveLength(1);
});

test.describe('inertia lab in the browser', () => {
    test.beforeEach(async ({ page }) => {
        await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
    });

    const slider = async (page, id, value) => page.locator('#' + id).evaluate((el, value) => {
        el.value = String(value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
    const pixels = (page, id) => page.locator('#' + id).evaluate(c => c.toDataURL());

    test('uses the shared physics-lab template and theme', async ({ page }) => {
        await page.goto('/tools/moment_of_inertia/');
        await expect(page).toHaveTitle('Moment of Inertia Lab | Adam Djellouli');
        await expect(page.locator('body')).toHaveClass(/tool-page tool-simulation tool-array-visualizer tool-optics-lab/);
        const sheets = await page.evaluate(() => [...document.styleSheets].map(s => (s.href || '').split('/').slice(-2).join('/')));
        expect(sheets).toEqual(expect.arrayContaining(['shared/simulation.css', 'shared/array-visualizer-theme.css', 'shared/optics-lab-theme.css']));
        await expect(page.locator('.tool-header h1')).toHaveText('Moment of Inertia Lab');
        await expect(page.locator('.stats-bar .stat-item')).toHaveCount(4);
        await expect(page.locator('.options-sidebar .option-card')).toHaveCount(4);
        await expect(page.locator('#mass + .optics-num-wrap input')).toHaveValue('2');
        for (const id of ['primer-canvas', 'specimen', 'builder', 'current-motion', 'motion-chart', 'orbit-canvas', 'shift-chart', 'distribution-chart']) {
            await expect(page.locator('#' + id)).toHaveClass(/optics-canvas/);
        }
        await expect(page.locator('.optics-exercise')).toHaveCount(4);
    });

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
        await expect(page.locator('[data-experiment="redistribute"]')).toHaveClass(/active/);
        await slider(page, 'hollow', 1);
        await expect(page.locator('#inertia-value')).toHaveText('2.000');
        await expect(page.locator('#density-title')).toHaveText('Linear density');
        await expect(page.locator('#integral-kind')).toHaveText('∫ single');
        await expect(page.locator('#comparison-headline')).toHaveText('The reference accelerates 2.00× as fast.');
    });

    test('dragging the ball moves it; its size and I follow mass and distance', async ({ page }) => {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.goto('/tools/moment_of_inertia/');
        const canvas = page.locator('#primer-canvas');
        await canvas.scrollIntoViewIfNeeded();
        const box = await canvas.boundingBox();
        const before = await pixels(page, 'primer-canvas');
        const ax = box.x + box.width * 0.42, ay = box.y + box.height * 0.5;
        const px = Math.min(box.width * 0.4, box.height * 0.46) / (1.2 * Math.SQRT2);
        await page.mouse.move(ax + 0.5 * px * Math.cos(-0.4), ay + 0.5 * px * Math.sin(-0.4));
        await page.mouse.down();
        await page.mouse.move(ax + px, ay, { steps: 6 });
        await page.mouse.up();
        await expect(page.locator('#primer-r')).toHaveValue('1');
        await expect(page.locator('#primer-I')).toHaveText('1.0 × 1.00² = 1.000 kg·m²');
        await expect(page.locator('#primer-insight')).toContainText('r² ×4.00');
        expect(await pixels(page, 'primer-canvas')).not.toBe(before);
        const light = await pixels(page, 'primer-canvas');
        await slider(page, 'primer-m', 4);
        await expect(page.locator('#primer-insight')).toContainText('I is ×16.00');
        expect(await pixels(page, 'primer-canvas')).not.toBe(light);
        await canvas.focus();
        await page.keyboard.press('ArrowLeft');
        await expect(page.locator('#primer-r')).toHaveValue('0.95');
        await page.locator('#primer-twist').click();
        await expect(page.locator('#primer-race')).toContainText('After 2 s at 1 N·m');
        await expect(page.locator('#primer-race')).toContainText('1.27 turns');
    });

    test('dragging a 3D view turns the camera; a click still picks a piece', async ({ page }) => {
        await page.goto('/tools/moment_of_inertia/');
        const canvas = page.locator('#specimen');
        await canvas.scrollIntoViewIfNeeded();
        const box = await canvas.boundingBox();
        const scale = await canvas.getAttribute('data-scale');
        const before = await pixels(page, 'specimen');
        await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.5);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.6, { steps: 8 });
        await page.mouse.up();
        await page.waitForTimeout(100);
        expect(await pixels(page, 'specimen')).not.toBe(before);
        await expect(canvas).toHaveAttribute('data-scale', scale);
        await page.locator('#camera').selectOption('axis');
        await page.locator('#reset-view').click();
        await expect(page.locator('#camera')).toHaveValue('perspective');
        await page.locator('#piece').evaluate(el => { el.value = '1'; el.dispatchEvent(new Event('input', { bubbles: true })); });
        await expect(page.locator('#piece-value')).toHaveText('1 / 128');
        await canvas.scrollIntoViewIfNeeded();
        const again = await canvas.boundingBox();
        await page.mouse.click(again.x + again.width / 2 + 2, again.y + again.height / 2);
        await expect(page.locator('#piece-value')).not.toHaveText('1 / 128');
    });

    test('the builder adds a triple integral as sums inside sums', async ({ page }) => {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.goto('/tools/moment_of_inertia/');
        await page.locator('#shape').selectOption('cylinder');
        await expect(page.locator('#integral-badge')).toHaveText('3D solid · triple ∫∫∫');
        await expect(page.locator('#nest .nest-level')).toHaveCount(3);
        await expect(page.locator('#nest-formula math mo', { hasText: '∑' })).toHaveCount(3);
        await expect(page.locator('#build-inner')).toHaveText('Finish ring');
        await expect(page.locator('#build-middle')).toHaveText('Finish slice');
        await page.locator('#build-inner').click();
        await expect(page.locator('.lv-inner > .nest-head .nest-count')).toHaveText('piece 16 of 16');
        await expect(page.locator('.lv-middle > .nest-head .nest-count')).toHaveText('ring 1 of 8');
        await page.locator('#build-step').click();
        await expect(page.locator('.lv-middle > .nest-head .nest-count')).toHaveText('ring 2 of 8');
        await expect(page.locator('.lv-middle > .nest-parts')).toContainText('finished rings');
        await page.locator('#build-middle').click();
        await expect(page.locator('.lv-outer > .nest-head .nest-count')).toHaveText('slice 1 of 4');
        await expect(page.locator('.lv-middle > .nest-head .nest-count')).toHaveText('ring 8 of 8');
        await page.locator('#build-end').click();
        await expect(page.locator('.nest-done')).toContainText('All 512 pieces added');
        await expect(page.locator('#build-step')).toBeDisabled();
        await page.locator('#build-play').click();
        await expect(page.locator('.nest-done')).toContainText('Σ = 0.9922');
        await page.locator('#build-reset').click();
        await expect(page.locator('.lv-outer > .nest-value strong')).toHaveText('0.00000');
        await expect(page.locator('#convergence tbody tr')).toHaveCount(4);
        await expect(page.locator('#convergence tr.exact-row')).toContainText('1.0000');
    });

    test('a plate is a double integral: strip totals add up to the running total', async ({ page }) => {
        await page.goto('/tools/moment_of_inertia/');
        await page.getByRole('button', { name: 'Build a plate', exact: true }).click();
        await expect(page.locator('#nest .nest-level')).toHaveCount(2);
        await expect(page.locator('#build-middle')).toBeHidden();
        for (let i = 0; i < 4; i++) await page.locator('#build-inner').click();
        await expect(page.locator('.lv-outer > .nest-head .nest-count')).toHaveText('strip 4 of 4');
        await expect(page.locator('.nest-done')).toContainText('All 16 pieces added');
        await page.locator('#build-reset').click();
        for (let i = 0; i < 3; i++) await page.locator('#build-inner').click();
        await page.locator('#build-step').click();
        const parts = (await page.locator('.lv-outer > .nest-parts').textContent()).match(/[\d.]+/g).map(Number);
        expect(parts).toHaveLength(3);
        const inner = Number(await page.locator('.lv-inner > .nest-value strong').textContent());
        const total = Number(await page.locator('.lv-outer > .nest-value strong').textContent());
        expect(parts.reduce((a, b) => a + b, 0) + inner).toBeCloseTo(total, 3);
    });

    test('the builder starts by itself once it scrolls into view', async ({ page }) => {
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        await page.goto('/tools/moment_of_inertia/');
        await expect(page.locator('.lv-outer > .nest-value strong')).toHaveText('0.00000');
        await page.locator('#builder').scrollIntoViewIfNeeded();
        await expect(page.locator('#build-play')).toHaveText('❚❚ Pause');
        await expect.poll(async () => Number(await page.locator('.lv-outer > .nest-value strong').textContent())).toBeGreaterThan(0);
        await page.locator('#build-play').click();
        await expect(page.locator('#build-play')).toHaveText('▶ Play');
    });

    test('the off-center section splits I into two motions and its curve can be dragged', async ({ page }) => {
        await page.goto('/tools/moment_of_inertia/');
        await expect(page.locator('#offcenter-insight')).toContainText('goes through the center of mass');
        await slider(page, 'offcenter-d', 0.5);
        await expect(page.locator('#offset')).toHaveValue('0.5');
        await expect(page.locator('#inertia-value')).toHaveText('1.500');
        await expect(page.locator('#offcenter-shift')).toHaveText('2.00 × 0.50² = 0.500 kg·m²');
        await expect(page.locator('#offcenter-insight')).toContainText('1.50× harder');
        const chart = page.locator('#shift-chart');
        await chart.scrollIntoViewIfNeeded();
        const box = await chart.boundingBox();
        await page.mouse.move(box.x + box.width * 0.5, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width * 0.15, box.y + box.height / 2, { steps: 5 });
        await page.mouse.up();
        expect(Number(await page.locator('#offset').inputValue())).toBeLessThan(-1);
        await chart.focus();
        const d = Number(await page.locator('#offset').inputValue());
        await page.keyboard.press('ArrowRight');
        expect(Number(await page.locator('#offset').inputValue())).toBeCloseTo(d + 0.05, 6);
        await page.locator('[data-experiment-link="shift"]').click();
        await expect(page.locator('#inertia-value')).toHaveText('2.667');
        await expect(page.locator('#offcenter-insight')).toContainText('4.00× harder');
    });

    test('scrubbing synchronizes motion, graph and calculation', async ({ page }) => {
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
        await page.locator('#pause-motion').click();
        await expect(page.locator('#motion-status')).toContainText('After 2.00 s');
        await expect(page.locator('#current-angle')).toHaveText('2.000');
        await slider(page, 'torque', 0);
        await expect(page.locator('#motion-time')).toHaveValue('0');
        await expect(page.locator('#comparison-headline')).toHaveText('No torque. No change in spin.');
    });

    test('experiments stay active while followed, and explanations report what changed', async ({ page }) => {
        await page.goto('/tools/moment_of_inertia/');
        const redistribute = page.getByRole('button', { name: 'Move mass outward', exact: true });
        await redistribute.click();
        await slider(page, 'hollow', 0.8);
        await expect(redistribute).toHaveAttribute('aria-pressed', 'true');
        await expect(page.locator('#live-insight')).toContainText('I: 1.000 → 1.640 kg·m² (×1.64)');
        await page.locator('#reset-body').click();
        await expect(page.locator('#hollow')).toHaveValue('0');
        await page.locator('#shape').selectOption('cylinder');
        await expect(redistribute).toHaveAttribute('aria-pressed', 'false');
        await slider(page, 'height', 3);
        await expect(page.locator('#live-insight')).toContainText('only along the axis');
        await slider(page, 'radius', 2);
        await expect(page.locator('#live-insight')).toContainText('doubling radius');
        await slider(page, 'mass', 4);
        await expect(page.locator('#live-insight')).toContainText('doubling mass');
        await page.getByRole('button', { name: 'A sphere’s symmetry', exact: true }).click();
        await slider(page, 'tilt', 45);
        await expect(page.locator('#live-insight')).toContainText('Nothing changed!');
    });

    test('every shape shows how many integrals it needs and loads from the table', async ({ page }) => {
        await page.goto('/tools/moment_of_inertia/');
        await expect(page.locator('#count-table tr')).toHaveCount(7);
        await expect(page.locator('#count-table tr.current-shape .sign-cell')).toHaveText('∫∫ double');
        await page.locator('[data-load-shape="sphere"]').click();
        await expect(page.locator('#specimen-title')).toHaveText('Solid sphere');
        await expect(page.locator('.dimension-cards .current-shape')).toHaveAttribute('data-dims', '3');
        await page.locator('[data-load-shape="rod"]').click();
        await expect(page.locator('#integral-badge')).toHaveText('1D line · single ∫');
        await expect(page.locator('#integral-shortcut')).toBeHidden();
        await expect(page.locator('#nest .nest-level')).toHaveCount(1);
    });

    for (const width of [320, 390, 768, 1280]) {
        test(`every shape and axis works without overflow at ${width}px`, async ({ page }) => {
            const errors = [];
            page.on('pageerror', e => errors.push(e.message));
            await page.setViewportSize({ width, height: 900 });
            await page.emulateMedia({ reducedMotion: 'reduce' });
            await page.goto('/tools/moment_of_inertia/');
            await page.locator('#run-motion').click();
            await expect(page.locator('#current-angle')).toHaveText('2.000');
            await expect(page.locator('#reference-angle')).toHaveText('1.000');
            await page.getByRole('button', { name: 'Center vs. end', exact: true }).click();
            await expect(page.locator('#inertia-value')).toHaveText('2.667');
            await expect(page.locator('#length')).toBeVisible();
            for (const shape of Object.keys(M.SHAPES)) {
                await page.locator('#shape').selectOption(shape);
                await slider(page, 'tilt', 35);
                await slider(page, 'offset', 0.3);
                await expect(page.locator('#specimen-title')).toHaveText(M.SHAPES[shape].name);
                await expect(page.locator('#integral-equation math')).toHaveCount(1);
                await expect(page.locator('#distribution-table tr')).toHaveCount(10);
                await page.locator('#build-end').click();
                await page.locator('#camera').selectOption('axis');
                await page.locator('#camera').selectOption('perspective');
                expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
            }
            for (const id of ['specimen', 'builder', 'current-motion', 'motion-chart']) {
                const [w, cw, dpr] = await page.locator('#' + id).evaluate(c => [c.width, c.clientWidth, devicePixelRatio]);
                expect(Math.abs(w - cw * dpr)).toBeLessThanOrEqual(2);
            }
            expect(await page.locator('#current-motion').getAttribute('data-scale')).toBe(await page.locator('#reference-motion').getAttribute('data-scale'));
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
    });

    test('the race can pause, resume, reset, and finish with physical values', async ({ page }) => {
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
        await expect(page.locator('#current-angle')).toHaveText('2.000');
        await page.locator('#reset-motion').click();
        await expect(page.locator('#current-angle')).toHaveText('0.000');
        await expect(page.locator('#pause-motion')).toBeDisabled();
        await page.locator('#pin-reference').click();
        await expect(page.locator('#reference-I')).toHaveText('1.000');
    });

    test('both themes render with no errors and all external requests blocked', async ({ page, context }) => {
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));
        await context.addCookies([{ name: 'darkMode', value: 'true', domain: '127.0.0.1', path: '/' }]);
        await page.goto('/tools/moment_of_inertia/');
        await expect(page.locator('body')).toHaveClass(/dark-mode/);
        await expect(page.locator('#integral-equation math')).toBeVisible();
        const dark = await page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--lv-outer').trim());
        await page.getByRole('button', { name: 'Toggle dark mode' }).click();
        await expect(page.locator('body')).not.toHaveClass(/dark-mode/);
        expect(await page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--lv-outer').trim())).not.toBe(dark);
        expect(errors).toEqual([]);
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
