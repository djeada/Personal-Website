const { test, expect } = require('@playwright/test');

// Isolate third parties so these checks exercise our own interface.
test.beforeEach(async ({ page }) => {
    await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1'
        ? route.continue() : route.abort());
});

for (const width of [390, 1280]) {
    test(`tools can be searched and filtered at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 844 });
        await page.goto('/core/tools.html');
        expect((await page.getByLabel('Find a tool').boundingBox()).y).toBeLessThan(844);
        const total = await page.locator('.tool-card:visible').count();
        expect(total).toBeGreaterThan(10);
        await page.getByLabel('Find a tool').fill('matrix multiplication');
        await expect(page.locator('.tool-card:visible')).toHaveCount(1);
        await expect(page.locator('#tool-results')).toHaveText('1 tool found.');
        await page.getByLabel('Category', { exact: true }).selectOption({ label: 'Text Utilities' });
        await expect(page.locator('.tool-card:visible')).toHaveCount(0);
        await expect(page.locator('#tool-results')).toContainText('No tools found');
        await page.getByRole('button', { name: 'Clear filters' }).click();
        await expect(page.locator('.tool-card:visible')).toHaveCount(total);
        await page.getByLabel('Category', { exact: true }).selectOption({ label: 'Text Utilities' });
        await expect(page.locator('.tool-category:visible')).toHaveCount(1);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });
}

test('keyboard users can skip navigation to the main content', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('main')).toBeFocused();
    await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toHaveText('Adam Djellouli');
});

test('existing tool main ID and layout are preserved', async ({ page }) => {
    await page.goto('/tools/eigenvalues/index.html');
    await expect(page.locator('main#container')).toHaveCount(1);
    await expect(page.locator('main#container h1')).toBeVisible();
    await expect(page.locator('.skip-link')).toHaveAttribute('href', '#container');
});

test('UI tutorial illustrations and resume logos load with external requests blocked', async ({ page }) => {
    for (const [url, selector] of [
        ['/articles/frontend_notes/07_ui.html', '#article-body img'],
        ['/core/resume.html', 'img[alt="Apache Kafka"], img[alt="Kafka"], img[alt="C++"], img[alt="Flask"], img[alt="SQLite"], img[alt="OpenStack Swift"], img[alt="C"], img[alt="Prometheus"], img[alt="Grafana"]'],
    ]) {
        await page.goto(url);
        const images = page.locator(selector);
        expect(await images.count()).toBeGreaterThan(0);
        for (const image of await images.all()) {
            await image.evaluate(element => { element.loading = 'eager'; });
            await expect.poll(() => image.evaluate(element => element.complete && element.naturalWidth > 0)).toBe(true);
        }
    }
});

test('the retired duplicate database article redirects to the current article', async ({ page }) => {
    await page.goto('/articles/databases_notes/06_distributed_databases/08_distributed_database_systems.html');
    await expect(page).toHaveURL(/\/01_distributed_database_systems\.html$/);
    await expect(page.locator('#article-body')).toBeVisible();
});

test('the VTK geospatial example is available as a source-code link', async ({ page }) => {
    await page.goto('/articles/vtk_examples/08_integration_with_other_tools.html');
    await expect(page.locator('#article-body a[href$="/geospatial_data.py"]')).toBeVisible();
});

test('article has breadcrumbs, nearby recommendations, and an active writing section', async ({ page }) => {
    await page.goto('/articles/backend_engineers_guide/01_api_design/02_rest.html');
    await expect(page).toHaveTitle('REST APIs: Principles, HTTP Methods, and Examples');
    await expect(page.getByRole('navigation', { name: 'Breadcrumb', exact: true })).toContainText('API Design');
    await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Blog', exact: true })).toHaveAttribute('aria-current', 'true');
    const links = page.locator('.read-next a');
    await expect(links).toHaveCount(3);
    for (const link of await links.all()) {
        expect(await link.getAttribute('href')).toContain('/01_api_design/');
        expect(await link.getAttribute('href')).not.toContain('/02_rest.html');
    }
    await expect(page.locator('#related-articles > ol')).toBeAttached();
});

for (const tool of ['diff', 'strip_html', 'strip_formatting']) {
    test(`${tool} example produces editable input and a result`, async ({ page }) => {
        await page.goto(`/tools/${tool}/index.html`);
        await page.getByRole('button', { name: 'Load example' }).click();
        await expect(page.locator('#example-status')).toContainText('loaded and processed');
        if (tool === 'diff') {
            await expect(page.locator('#text1')).toHaveValue(/Hello world/);
            await expect(page.locator('#diff-result')).toContainText('Berlin');
        } else {
            await expect(page.locator('#input-text')).not.toHaveValue('');
            await expect(page.locator('#output-text')).toHaveValue(/Hello Berlin/);
            if (tool === 'strip_html') await expect(page.locator('#output-text')).not.toHaveValue(/<strong>/);
        }
    });
}

test('directory and article navigation remain useful without JavaScript', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
    await page.goto('http://127.0.0.1:8000/core/tools.html');
    await expect(page.locator('#tool-filters')).toBeHidden();
    expect(await page.locator('.tool-card:visible').count()).toBeGreaterThan(10);
    await page.goto('http://127.0.0.1:8000/articles/backend_engineers_guide/01_api_design/02_rest.html');
    await expect(page.locator('.breadcrumbs')).toBeVisible();
    await expect(page.locator('.read-next')).toBeVisible();
    await context.close();
});
