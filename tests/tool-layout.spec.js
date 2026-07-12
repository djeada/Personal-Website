const { test, expect } = require("@playwright/test");

const tool = "/tools/strip_chatgpt_fluff/";

for (const viewport of [
  { name: "phone", width: 390, height: 844 },
  { name: "desktop", width: 1280, height: 800 },
]) {
  test(`AI text cleaner follows the shared layout on ${viewport.name}`, async ({ page, context }) => {
    await context.addCookies([{ name: "darkMode", value: "true", domain: "127.0.0.1", path: "/" }]);
    await page.setViewportSize(viewport);
    await page.goto(tool, { waitUntil: "domcontentloaded" });

    const layout = await page.evaluate(() => {
      const main = document.querySelector(".tool-main").getBoundingClientRect();
      const section = document.querySelector(".tool-content");
      const panel = document.querySelector(".options-sidebar");
      const panelStyle = getComputedStyle(panel);
      return {
        viewport: document.documentElement.clientWidth,
        pageWidth: document.documentElement.scrollWidth,
        mainLeft: main.left,
        mainRight: main.right,
        sectionPaddingTop: parseFloat(getComputedStyle(section).paddingTop),
        panelBackground: panelStyle.backgroundColor,
        bodyBackground: getComputedStyle(document.body).backgroundColor,
      };
    });

    expect(layout.pageWidth).toBeLessThanOrEqual(layout.viewport + 1);
    expect(layout.mainLeft).toBeGreaterThanOrEqual(-1);
    expect(layout.mainRight).toBeLessThanOrEqual(layout.viewport + 1);
    expect(layout.sectionPaddingTop).toBe(0);
    expect(layout.panelBackground).not.toBe("rgb(30, 41, 59)");
  });
}

test("AI text cleaner uses side-by-side editors on wide screens", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(tool, { waitUntil: "domcontentloaded" });
  const editors = await page.locator(".editor-container").evaluateAll((elements) =>
    elements.slice(0, 2).map((element) => element.getBoundingClientRect()),
  );
  expect(Math.abs(editors[0].top - editors[1].top)).toBeLessThanOrEqual(1);
  expect(editors[1].left).toBeGreaterThan(editors[0].right);
});

test("matrix result selection highlights its source row and column", async ({ page }) => {
  await page.goto("/tools/matrix_multiplication/", { waitUntil: "domcontentloaded" });
  await page.locator('[data-preset="standard"]').click();
  await page.locator("#matrix-result tr").nth(1).locator(".result-cell").nth(1).click();

  const highlighted = await page.evaluate(() => ({
    result: [...document.querySelectorAll("#matrix-result .is-highlighted")].map((cell) => cell.textContent),
    a: [...document.querySelectorAll("#matrix-a input.is-contributor")].map((input) => [input.dataset.row, input.dataset.col]),
    b: [...document.querySelectorAll("#matrix-b input.is-contributor")].map((input) => [input.dataset.row, input.dataset.col]),
  }));

  expect(highlighted.result).toEqual(["154"]);
  expect(highlighted.a).toEqual([["1", "0"], ["1", "1"], ["1", "2"]]);
  expect(highlighted.b).toEqual([["0", "1"], ["1", "1"], ["2", "1"]]);
});

test("matrix multiplication plots A, B, and C with the selected dot product", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/tools/matrix_multiplication/", { waitUntil: "domcontentloaded" });
  await page.locator('[data-preset="standard"]').click();
  await page.locator("#matrix-result tr").nth(1).locator(".result-cell").nth(1).click();
  const plot = await page.locator("#matrix-product-canvas").evaluate((canvas) => ({
    matrices: JSON.parse(canvas.dataset.matrices),
    selection: canvas.dataset.selection,
    width: canvas.getBoundingClientRect().width,
  }));
  expect(plot.matrices.A).toEqual([[1, 2, 3], [4, 5, 6]]);
  expect(plot.matrices.B).toEqual([[7, 8], [9, 10], [11, 12]]);
  expect(plot.matrices.C).toEqual([[58, 64], [139, 154]]);
  expect(plot.selection).toBe("1,1");
  expect(plot.width).toBeGreaterThan(680);
});

const referenceTools = [
  "graphs",
  "sorting",
  "searching",
  "logic_gates",
  "filters",
  "cache_simulator",
];

for (const name of referenceTools) {
  test(`${name} uses the Data Structures reference theme`, async ({ page, context }) => {
    await context.addCookies([{ name: "darkMode", value: "true", domain: "127.0.0.1", path: "/" }]);
    await page.route(/google|googlesyndication/, (route) => route.abort());
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/tools/${name}/`, { waitUntil: "domcontentloaded" });
    const theme = await page.evaluate(() => {
      const style = getComputedStyle(document.body);
      const content = document.querySelector("section.tool-content");
      const heading = document.querySelector(".tool-header h1, .math-app-header h1");
      const headingRect = heading.getBoundingClientRect();
      return {
        reference: document.body.classList.contains("tool-reference"),
        accent: style.getPropertyValue("--tool-primary").trim(),
        surface: style.getPropertyValue("--tool-surface").trim(),
        pageWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
        contentPadding: content ? parseFloat(getComputedStyle(content).paddingTop) : 0,
        headingCenter: headingRect.left + headingRect.width / 2,
        viewportCenter: document.documentElement.clientWidth / 2,
        headingAlignment: getComputedStyle(heading.parentElement).textAlign,
      };
    });
    expect(theme.reference).toBe(true);
    expect(theme.accent).toBe("#38c6c2");
    expect(theme.surface).toBe("#17222d");
    expect(theme.pageWidth).toBeLessThanOrEqual(theme.viewportWidth + 1);
    expect(theme.contentPadding).toBe(0);
    expect(theme.headingAlignment).toBe("center");
    expect(Math.abs(theme.headingCenter - theme.viewportCenter)).toBeLessThanOrEqual(2);
  });
}

for (const name of ["ant_colony", "futuristic_city"]) {
  test(`${name} retains its bespoke theme`, async ({ page, context }) => {
    await context.addCookies([{ name: "darkMode", value: "true", domain: "127.0.0.1", path: "/" }]);
    await page.goto(`/tools/${name}/`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).not.toHaveClass(/tool-reference/);
    const accent = await page.locator("body").evaluate((body) =>
      getComputedStyle(body).getPropertyValue("--tool-primary").trim(),
    );
    expect(accent).toBe("#ff9d1a");
  });
}

for (const name of ["graphs", "sorting", "searching"]) {
  test(`${name} visualization fills its workspace and uses semantic colors`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/tools/${name}/`, { waitUntil: "domcontentloaded" });
    const layout = await page.evaluate(() => {
      const area = document.querySelector(".canvas-area").getBoundingClientRect();
      const canvas = document.querySelector(".canvas-wrapper canvas");
      const canvasRect = canvas.getBoundingClientRect();
      return {
        areaWidth: area.width,
        canvasWidth: canvasRect.width,
        intrinsicWidth: canvas.width,
        semanticLegend: document.querySelectorAll('.legend-color[class*="visual-"]').length,
        current: getComputedStyle(document.body).getPropertyValue("--visual-current").trim(),
        frontier: getComputedStyle(document.body).getPropertyValue("--visual-frontier").trim(),
      };
    });
    expect(layout.areaWidth).toBeGreaterThan(700);
    expect(layout.canvasWidth).toBeGreaterThan(layout.areaWidth * 0.7);
    expect(layout.intrinsicWidth).toBeGreaterThan(600);
    expect(layout.semanticLegend).toBeGreaterThanOrEqual(3);
    expect(layout.current).toBe("#ffb547");
    expect(layout.frontier).toBe("#4aa3b5");
  });
}

test("Covariance Lab scales for the full ellipse and plot-wide fit line", async ({ page }) => {
  await page.goto("/tools/correlation_visualizer/", { waitUntil: "domcontentloaded" });
  const geometry = await page.evaluate(() => {
    const points = [
      { x: 0, y: 0 },
      { x: 1, y: 8 },
      { x: 2, y: 1 },
      { x: 3, y: 9 },
    ];
    const summary = window.CovarianceLabDebug.summarize(points);
    const domain = window.CovarianceLabDebug.scatterDomain(summary);
    const scale = window.CovarianceLabDebug.createLinearScale(domain.minX, domain.maxX, 0, 100);
    return { summary, domain, scaleMin: scale.min, scaleMax: scale.max };
  });

  expect(geometry.domain.minX).toBeLessThanOrEqual(geometry.summary.meanX - 2 * geometry.summary.stdX);
  expect(geometry.domain.maxX).toBeGreaterThanOrEqual(geometry.summary.meanX + 2 * geometry.summary.stdX);
  expect(geometry.domain.minY).toBeLessThanOrEqual(geometry.summary.meanY - 2 * geometry.summary.stdY);
  expect(geometry.domain.maxY).toBeGreaterThanOrEqual(geometry.summary.meanY + 2 * geometry.summary.stdY);
  expect(geometry.scaleMin).toBeLessThan(geometry.domain.minX);
  expect(geometry.scaleMax).toBeGreaterThan(geometry.domain.maxX);
});

test("Eigenvalues tool plots v, Av, and the matrix basis", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/tools/eigenvalues/", { waitUntil: "domcontentloaded" });
  await page.locator("#plot-mode").selectOption("arbitrary");
  const vectorInputs = page.locator("#plot-vector-inputs input:not(.is-inactive)");
  await vectorInputs.nth(0).fill("2");
  await vectorInputs.nth(1).fill("-1");
  await vectorInputs.nth(2).fill("0");

  const plot = await page.locator("#transformation-canvas").evaluate((canvas) => ({
    vector: JSON.parse(canvas.dataset.vector),
    result: JSON.parse(canvas.dataset.result),
    intrinsicWidth: canvas.width,
    visibleWidth: canvas.getBoundingClientRect().width,
    label: document.querySelector("#transform-equation").textContent,
  }));

  expect(plot.vector).toEqual([2, -1, 0]);
  expect(plot.result).toEqual([7, -1, 2]);
  expect(plot.visibleWidth).toBeGreaterThan(700);
  expect(plot.intrinsicWidth).toBeGreaterThanOrEqual(plot.visibleWidth);
  expect(plot.label).toContain("A [2, -1, 0] = [7, -1, 2]");
});

test("Eigenvalues tool demonstrates Av = lambda v on an invariant line", async ({ page }) => {
  await page.goto("/tools/eigenvalues/", { waitUntil: "domcontentloaded" });
  const plot = await page.locator("#transformation-canvas").evaluate((canvas) => {
    const vector = JSON.parse(canvas.dataset.vector);
    const result = JSON.parse(canvas.dataset.result);
    return {
      vector,
      result,
      crossProduct: vector[0] * result[1] - vector[1] * result[0],
      equation: document.querySelector("#transform-equation").textContent,
      mode: document.querySelector("#plot-mode").value,
      coordinatesLocked: [...document.querySelectorAll("#plot-vector-inputs input:not(.is-inactive)")]
        .every((input) => input.disabled),
    };
  });
  expect(plot.mode).toBe("eigenvector");
  expect(Math.abs(plot.crossProduct)).toBeLessThan(1e-5);
  expect(plot.equation).toContain("Av =");
  expect(plot.equation).toContain("λ =");
  expect(plot.equation).toContain("projection only");
  expect(plot.coordinatesLocked).toBe(true);
});
