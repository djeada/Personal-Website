const { test, expect } = require("@playwright/test");

const articles = [
  "/articles/parallel_and_concurrent_programming/08_designing_parallel_programs.html",
  "/articles/parallel_and_concurrent_programming/09_gpu_programming.html",
  "/articles/databases_notes/10_nosql_databases/04_crud_in_sql_vs_nosql.html",
];

const viewports = [
  { name: "small-phone", width: 320, height: 720 },
  { name: "phone", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
];

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

  // MathJax is loaded from a third-party CDN in production. Insert the stable
  // MathJax 2 output shape so the regression test does not depend on the CDN.
  await page.locator("#article-body").evaluate((article) => {
    const display = document.createElement("span");
    display.className = "MathJax_Display";
    display.innerHTML = '<span class="MathJax_CHTML" style="display:inline-block;min-width:700px">equation</span>';
    article.append(display);
  });

  const equation = page.locator('#article-body .MathJax_Display, #article-body mjx-container[display="true"]').first();
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
