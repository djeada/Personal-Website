const { test, expect } = require("@playwright/test");

const articles = [
  "/articles/parallel_and_concurrent_programming/08_designing_parallel_programs.html",
  "/articles/parallel_and_concurrent_programming/09_gpu_programming.html",
  "/articles/databases_notes/10_nosql_databases/04_crud_in_sql_vs_nosql.html",
  "/articles/statistics_notes/spatial_statistics/spatial_validation.html",
];

const viewports = [
  { name: "small-phone", width: 320, height: 720 },
  { name: "phone", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "wide-tablet", width: 900, height: 1024 },
];

for (const width of [390, 900, 1262, 1600]) {
  test(`framework table keeps words readable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/articles/frontend_notes/10_testing.html", { waitUntil: "domcontentloaded" });
    const table = page.locator("#article-body table").first();
    const layout = await table.evaluate(element => {
      const label = element.querySelector("strong");
      const range = document.createRange();
      range.selectNodeContents(label);
      return {
        labelLines: range.getClientRects().length,
        cells: [...element.querySelectorAll("td, th")].map(cell => cell.getBoundingClientRect().width),
        width: element.clientWidth,
        scrollWidth: element.scrollWidth,
        pageWidth: document.documentElement.scrollWidth,
        viewport: document.documentElement.clientWidth,
      };
    });
    expect(layout.labelLines, "MochaJS should stay on one line").toBe(1);
    expect(Math.min(...layout.cells)).toBeGreaterThanOrEqual(159);
    expect(layout.scrollWidth).toBeGreaterThan(layout.width);
    expect(layout.pageWidth).toBeLessThanOrEqual(layout.viewport + 1);
    await table.evaluate(element => { element.scrollLeft = element.scrollWidth; });
    expect(await table.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
  });
}

test("related statistics articles preserve category levels and the current branch", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(articles[3], { waitUntil: "domcontentloaded" });
  const related = page.locator("#related-articles");
  await expect(related.locator('a[aria-current="page"]')).toHaveText("Spatial Validation");
  await expect(related.locator("details[open] > summary")).toHaveText("Spatial Statistics");
  const distributions = related.locator("details").filter({
    has: page.locator("summary", { hasText: /^Random Variables and Distributions$/ }),
  }).first();
  await distributions.locator(":scope > summary").click();
  const continuous = distributions.locator("details").filter({
    has: page.locator("summary", { hasText: /^Continuous$/ }),
  });
  await continuous.locator(":scope > summary").click();
  await expect(continuous.getByRole("link", { name: "Normal Distribution", exact: true })).toBeVisible();
  const dimensions = await related.evaluate(el => ({ width: el.clientWidth, scroll: el.scrollWidth }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width + 1);
  await page.setViewportSize({ width: 900, height: 1024 });
  await expect(related).toBeHidden();
  await page.locator("#table-of-contents-toggle").click();
  await expect(related).toBeVisible();
});

for (const article of articles) {
  for (const viewport of viewports) {
    test(`${article} fits a ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(article, { waitUntil: "domcontentloaded" });
      await page.locator("#article-body").waitFor();

      const layout = await page.evaluate(() => {
        const body = document.querySelector("#article-body");
        const rect = body.getBoundingClientRect();
        return {
          viewportWidth: document.documentElement.clientWidth,
          pageWidth: document.documentElement.scrollWidth,
          bodyLeft: rect.left,
          bodyRight: rect.right,
          bodyWidth: rect.width,
        };
      });

      expect(layout.pageWidth, "the page must not scroll horizontally").toBeLessThanOrEqual(
        layout.viewportWidth + 1,
      );
      expect(layout.bodyLeft, "article must not be shifted off the left edge").toBeGreaterThanOrEqual(-1);
      expect(layout.bodyRight, "article must not exceed the right edge").toBeLessThanOrEqual(
        layout.viewportWidth + 1,
      );
      expect(layout.bodyWidth).toBeGreaterThan(0);
    });
  }
}

test("wide tables scroll inside the article and keep readable cells", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto(articles[1], { waitUntil: "domcontentloaded" });

  const table = page.locator("#article-body table").first();
  await expect(table).toBeVisible();
  const dimensions = await table.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
    cellWidths: [...element.querySelectorAll("th, td")].map((cell) => cell.getBoundingClientRect().width),
  }));

  expect(dimensions.clientWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
  expect(dimensions.scrollWidth).toBeGreaterThan(dimensions.clientWidth);
  expect(Math.min(...dimensions.cellWidths)).toBeGreaterThanOrEqual(150);
});

test("wide display equations scroll without widening or shifting the article", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto(articles[0], { waitUntil: "domcontentloaded" });

  // MathJax is loaded from a third-party CDN in production. Insert its actual
  // v2 CommonHTML output shape so the regression test does not depend on CDN
  // availability while still exercising the production selector.
  await page.locator("#article-body").evaluate((article) => {
    const display = document.createElement("span");
    display.className = "mjx-chtml MJXc-display";
    display.innerHTML = '<span class="mjx-chtml MathJax_CHTML" style="display:inline-block;min-width:700px">equation</span>';
    article.append(display);
  });

  const equation = page.locator('#article-body .MJXc-display, #article-body .MathJax_Display, #article-body mjx-container[display="true"]').first();
  await expect(equation).toBeVisible({ timeout: 15_000 });
  const dimensions = await equation.evaluate((element) => {
    const article = document.querySelector("#article-body").getBoundingClientRect();
    const rect = element.getBoundingClientRect();
    return {
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      left: rect.left,
      right: rect.right,
      articleLeft: article.left,
      articleRight: article.right,
      pageWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
    };
  });

  expect(dimensions.pageWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1);
  expect(dimensions.left).toBeGreaterThanOrEqual(dimensions.articleLeft - 1);
  expect(dimensions.right).toBeLessThanOrEqual(dimensions.articleRight + 1);
  expect(dimensions.scrollWidth).toBeGreaterThan(dimensions.clientWidth);
});

test("unlabelled ASCII diagrams keep their top border", async ({ page }) => {
  await page.goto(articles[0], { waitUntil: "domcontentloaded" });

  const tileDiagram = page.locator("#article-body pre code", {
    hasText: "Worker 4",
  });

  await expect(tileDiagram).toHaveClass(/language-shell/);
  await expect(tileDiagram).toHaveText(/^\+-----------------------\+-----------------------\+/);
});

test("ASCII diagrams preserve leading indentation on their first lines", async ({ page }) => {
  await page.goto(articles[0], { waitUntil: "domcontentloaded" });

  const scatterDiagram = page.locator("#article-body pre code", {
    hasText: "Scatter:",
  });

  await expect(scatterDiagram).toHaveText(
    /^Scatter:\n {7}\+-----------------------\+\n {7}\|          ABC          \|/,
  );
});

test("article actions align with the metadata header on desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(
    "/articles/statistics_notes/resampling_and_model_assessment/resampling.html",
    { waitUntil: "domcontentloaded" },
  );

  const positions = await page.evaluate(() => {
    const header = document.querySelector("#article-body .article-header").getBoundingClientRect();
    const actions = document.querySelector("#article-body .article-header .article-action-buttons").getBoundingClientRect();
    const metadata = document.querySelector(
      '#article-body .article-header-metadata > p[style*="text-align: right"]',
    ).getBoundingClientRect();
    return {
      headerLeft: header.left,
      headerRight: header.right,
      actionsTop: actions.top,
      actionsLeft: actions.left,
      metadataTop: metadata.top,
      metadataRight: metadata.right,
    };
  });

  expect(Math.abs(positions.actionsTop - positions.metadataTop)).toBeLessThanOrEqual(10);
  expect(positions.actionsLeft).toBeGreaterThanOrEqual(positions.metadataRight);
  expect(positions.headerRight - positions.headerLeft).toBeGreaterThan(500);
});


test("diagram rows preserve indentation and scroll without wrapping", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto(articles[0], { waitUntil: "domcontentloaded" });
  const layout = await page.locator("#article-body").evaluate((article) => {
    const pre = document.createElement("pre");
    const code = document.createElement("code");
    code.textContent = "      +" + "-".repeat(100) + "+\n      | diagram";
    pre.append(code);
    article.append(pre);
    return {
      whiteSpace: getComputedStyle(code).whiteSpace,
      overflow: getComputedStyle(pre).overflowX,
      scrollWidth: pre.scrollWidth,
      clientWidth: pre.clientWidth,
      text: code.textContent,
    };
  });
  expect(layout.whiteSpace).toBe("pre");
  expect(layout.overflow).toBe("auto");
  expect(layout.scrollWidth).toBeGreaterThan(layout.clientWidth);
  expect(layout.text.startsWith("      +")).toBe(true);
});
