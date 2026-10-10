const path = require('path');
const { test, expect } = require('@playwright/test');
const { Network, Game } = require('../src/tools/neural_oracle/model.js');

test('network learns repetition and a switch produces real surprise', () => {
    const game = new Game('learning');
    for (let i = 0; i < 20; i++) game.play(0);
    const before = game.network.forward(game.input()).probabilities;
    expect(before[0]).toBeGreaterThan(.9);
    const result = game.play(1);
    expect(result.escaped).toBe(true);
    expect(result.loss).toBeGreaterThan(2);
    expect(result.points).toBeGreaterThan(90);
    expect(result.snapshot.probabilities).toEqual(before);
    expect(game.network.forward(result.snapshot.input).probabilities[1]).toBeGreaterThan(before[1]);
});

test('backpropagation matches numerical gradients for both layers and biases', () => {
    const model = new Network('gradient');
    const input = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    const checks = [
        [model.w1[0], 0], [model.w1[7], 4], [model.w2[1], 0], [model.w2[2], 7],
        [model.b1, 0], [model.b2, 1],
    ];
    const loss = () => -Math.log(model.forward(input).probabilities[1]);
    const expected = checks.map(([array, index]) => {
        const original = array[index], epsilon = 1e-5;
        array[index] = original + epsilon; const plus = loss();
        array[index] = original - epsilon; const minus = loss();
        array[index] = original;
        return original - .22 * (plus - minus) / (2 * epsilon);
    });
    model.train(input, 1);
    checks.forEach(([array, index], i) => expect(array[index]).toBeCloseTo(expected[i], 8));
});

test('challenge is deterministic, bounded, and immutable after 30 moves', () => {
    const first = new Game('oracle-v1:2026-10-09');
    const second = new Game('oracle-v1:2026-10-09');
    for (let i = 0; i < 30; i++) {
        const a = first.play(i % 3), b = second.play(i % 3);
        expect(a).toEqual(b);
        expect(a.snapshot.probabilities.reduce((x, y) => x + y, 0)).toBeCloseTo(1, 12);
        expect(a.points).toBeGreaterThanOrEqual(0);
        expect(a.points).toBeLessThanOrEqual(100);
    }
    const previous = JSON.stringify(first);
    for (const choice of [0, -1, 3, NaN, .5]) expect(first.play(choice)).toBeNull();
    expect(JSON.stringify(first)).toBe(previous);
});

test.describe('browser interaction', () => {
// Keep CDN URLs and SRI aligned with the locked npm version; browser integrity
// checks still apply when these local files are served to render math offline.
const katexDist = path.dirname(require.resolve('katex/dist/katex.min.js'));
const katexVersion = require('katex/package.json').version;
const katexPrefix = `/ajax/libs/KaTeX/${katexVersion}/`;

test.beforeEach(async ({ page }) => {
    await page.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.hostname === '127.0.0.1') return route.continue();
        if (url.hostname === 'cdnjs.cloudflare.com' && url.pathname.startsWith(katexPrefix)) {
            return route.fulfill({ path: path.join(katexDist, url.pathname.slice(katexPrefix.length)), headers: { 'Access-Control-Allow-Origin': '*' } });
        }
        return route.abort();
    });
});

for (const width of [390, 1280]) {
    test(`play, inspect, share, restart at ${width}px`, async ({ page }) => {
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.goto('/tools/neural_oracle/?challenge=2026-10-09');
        await expect(page.locator('#weights-one tbody td')).toHaveCount(80);
        await expect(page.locator('#weights-two tbody td')).toHaveCount(27);
        const initialWeights = await page.locator('#weights-two').textContent();
        await page.getByRole('button', { name: 'Choose Orbit' }).click();
        await expect(page.locator('#round')).toHaveText('1 / 30');
        await expect(page.locator('#lesson')).toContainText('Only the biases');
        await expect(page.locator('#loss-values')).toContainText('1.099');
        await expect(page.locator('#verdict')).toHaveText(/ESCAPED|PREDICTED/);
        await expect(page.locator('#memory li').first()).toHaveText('◯');
        await expect(page.locator('#accuracy')).toHaveText(/^\d+%$/);
        await expect(page.locator('#gradient-equation')).toContainText('New weight');
        await expect(page.locator('#gradient-tex .katex')).toHaveCount(1);
        await expect(page.locator('#gradient-tex .katex')).toHaveCSS('font-family', /KaTeX_Main/);
        await expect(page.locator('#input-values .katex')).toHaveCount(1);
        await expect(page.locator('#tanh-plot circle')).toHaveCount(8);
        await expect(page.locator('.oracle-lab .katex-error')).toHaveCount(0);
        for (let i = 1; i < 30; i++) await page.keyboard.press(String(i % 3 + 1));
        await expect(page.locator('#round')).toHaveText('30 / 30');
        await expect(page.locator('#result')).toBeVisible();
        await expect(page.locator('[data-choice="0"]')).toBeDisabled();
        await expect(page.locator('#result-title')).toBeFocused();
        const score = await page.locator('#score').textContent();
        await page.keyboard.press('1');
        await expect(page.locator('#score')).toHaveText(score);
        await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('blocked'); } } }));
        await page.getByRole('button', { name: 'Copy challenge & score' }).click();
        await expect(page.locator('#share-fallback')).toBeVisible();
        await expect(page.locator('#share-fallback')).toHaveValue(/challenge=2026-10-09&beat=\d+/);
        expect(await page.locator('#habits li').count()).toBeGreaterThanOrEqual(3);
        await expect(page.locator('#result-rank')).toContainText('EXPERIMENT COMPLETE ·');
        await expect(page.locator('#history .escaped, #history .caught')).toHaveCount(30);
        await page.keyboard.press('2');
        await expect(page.locator('#round')).toHaveText('30 / 30');
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.locator('#restart').click();
        await expect(page.locator('#round')).toHaveText('0 / 30');
        await expect(page.locator('#result')).toBeHidden();
        await expect(page.locator('#weights-two')).toHaveText(initialWeights);
        await expect(page.locator('#best')).toContainText(score);
        await page.getByRole('button', { name: 'Choose Prism' }).focus();
        await page.keyboard.press('Enter');
        await expect(page.locator('#round')).toHaveText('1 / 30');
        await page.locator('#inspect-output').selectOption('2');
        await expect(page.locator('#neuron-equation .katex')).toContainText('Spark');
        await expect(page.locator('#votes-title')).toHaveText('Who voted for Spark?');
        await expect(page.locator('#contributions .oracle-vote')).toHaveCount(9);
        await expect(page.locator('.oracle-lab .katex-error')).toHaveCount(0);
        expect(errors).toEqual([]);
        await page.screenshot({ path: `screenshots/neural-oracle-${width}.png`, fullPage: true });
    });
}

test('game works with blocked storage and clipboard success reports accurately', async ({ page }) => {
    await page.addInitScript(() => {
        Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } });
        Object.defineProperty(navigator, 'clipboard', { value: { writeText: async text => { window.copiedText = text; } } });
    });
    await page.goto('/tools/neural_oracle/?challenge=invalid');
    await expect(page.locator('#challenge-label')).not.toContainText('invalid');
    for (let i = 0; i < 30; i++) await page.keyboard.press('1');
    await page.locator('#share').click();
    await expect(page.locator('#share-status')).toContainText('Copied!');
    expect(await page.evaluate(() => window.copiedText)).toContain('107-parameter');
});

test('lab math falls back to readable text when KaTeX cannot load', async ({ page }) => {
    await page.route('**/cdnjs.cloudflare.com/**', route => route.abort());
    await page.goto('/tools/neural_oracle/?challenge=2026-10-09');
    await page.keyboard.press('1');
    await expect(page.locator('#loss-tex')).toContainText('L = −ln(0.333) = 1.099');
    await expect(page.locator('#neuron-equation')).toContainText('a(Orbit) =');
    await expect(page.locator('.oracle-lab .katex')).toHaveCount(0);
});

test('friend challenge links show the score to beat and report the outcome', async ({ page }) => {
    await page.goto('/tools/neural_oracle/?challenge=2026-10-09&beat=1500');
    await expect(page.locator('#rival')).toContainText('1,500');
    for (let i = 0; i < 30; i++) await page.keyboard.press(String(i % 3 + 1));
    await expect(page.locator('#result-summary')).toContainText(/friend’s 1,500/);
    const download = page.waitForEvent('download');
    await page.locator('#card').click();
    expect((await download).suggestedFilename()).toMatch(/^outclick-the-oracle-2026-10-09-\d+\.png$/);
});

test('invalid beat values are ignored and sound preference persists', async ({ page }) => {
    await page.goto('/tools/neural_oracle/?challenge=2026-10-09&beat=99999');
    await expect(page.locator('#rival')).toBeHidden();
    await expect(page.locator('#sound')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('#sound').click();
    await expect(page.locator('#sound')).toHaveText('Sound off');
    await page.reload();
    await expect(page.locator('#sound')).toHaveAttribute('aria-pressed', 'false');
});

test('game is discoverable through the existing tools filter', async ({ page }) => {
    await page.goto('/core/tools.html');
    await page.getByLabel('Find a tool').fill('oracle');
    await expect(page.locator('.tool-card:visible')).toHaveCount(1);
    await page.locator('.tool-card:visible').click();
    await expect(page).toHaveTitle('Outclick the Oracle | Adam Djellouli');
});

});
