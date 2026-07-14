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

test("matrix multiplication draws 2D grid composition B then A", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/tools/matrix_multiplication/", { waitUntil: "domcontentloaded" });
  await page.locator('[data-preset="geometric"]').click();
  const geometry = await page.locator("#matrix-geometry-canvas").evaluate((canvas) => ({
    available: canvas.dataset.available,
    product: JSON.parse(canvas.dataset.product),
    width: canvas.getBoundingClientRect().width,
    message: document.querySelector("#geometry-message").textContent,
  }));
  expect(geometry.available).toBe("true");
  expect(geometry.product[0][0]).toBeCloseTo(1.4);
  expect(geometry.product[0][1]).toBeCloseTo(-0.1375);
  expect(geometry.product[1][0]).toBeCloseTo(0.63);
  expect(geometry.product[1][1]).toBeCloseTo(0.9075);
  expect(geometry.width).toBeGreaterThan(760);
  expect(geometry.message).toContain("ordinary coordinate grid");
  await page.locator('[data-geometry-stage="2"]').click();
  await expect(page.locator("#matrix-geometry-canvas")).toHaveAttribute("data-stage", "2");
  await expect(page.locator("#geometry-message")).toContainText("composition AB");
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

test("Covariance Lab shows the complete sample calculation", async ({ page }) => {
  await page.goto("/tools/correlation_visualizer/", { waitUntil: "domcontentloaded" });
  await page.locator("#dataset-points").fill("1, 2\n2, 4\n3, 5");
  await page.locator(".draw-button").click();

  const calculation = await page.evaluate(() => {
    const points = [
      { x: 1, y: 2 },
      { x: 2, y: 4 },
      { x: 3, y: 5 },
    ];
    const allMeasures = { spearman: true, kendall: true, distance: true };
    const summary = window.CovarianceLabDebug.summarize(points, allMeasures);
    const perfect = window.CovarianceLabDebug.summarize([
      { x: 1, y: 2 },
      { x: 2, y: 4 },
      { x: 3, y: 6 },
      { x: 4, y: 8 },
    ], allMeasures);
    const tied = window.CovarianceLabDebug.summarize([
      { x: 1, y: 1 },
      { x: 1, y: 2 },
      { x: 2, y: 3 },
    ], allMeasures);
    return {
      summary,
      perfect,
      tied,
      steps: document.querySelectorAll(".calculation-step").length,
      contributionRows: document.querySelectorAll(".calculation-table tbody tr").length,
      headings: [...document.querySelectorAll(".calculation-step h3")].map((heading) => heading.textContent),
      optionalChecked: [...document.querySelectorAll(".optional-measures-panel input")].map((input) => input.checked),
      optionalCardVisible: Boolean(document.querySelector(".optional-results-card")),
      hasMathJaxLoader: Boolean(document.querySelector('script[src*="mathjax@3"]')),
      workedText: document.querySelector("#calculation-content").textContent,
    };
  });

  expect(calculation.summary.meanX).toBeCloseTo(2, 12);
  expect(calculation.summary.meanY).toBeCloseTo(11 / 3, 12);
  expect(calculation.summary.sumCrossProducts).toBeCloseTo(3, 12);
  expect(calculation.summary.sumSquaresX).toBeCloseTo(2, 12);
  expect(calculation.summary.sumSquaresY).toBeCloseTo(14 / 3, 12);
  expect(calculation.summary.cov).toBeCloseTo(1.5, 12);
  expect(calculation.summary.r).toBeCloseTo(3 / Math.sqrt(28 / 3), 12);
  expect(calculation.summary.slope).toBeCloseTo(1.5, 12);
  expect(calculation.summary.intercept).toBeCloseTo(2 / 3, 12);
  expect(calculation.summary.spearman).toBeCloseTo(1, 12);
  expect(calculation.summary.rankMeanX).toBeCloseTo(2, 12);
  expect(calculation.summary.rankMeanY).toBeCloseTo(2, 12);
  expect(calculation.summary.sumRankCrossProducts).toBeCloseTo(2, 12);
  expect(calculation.summary.sumRankSquaresX).toBeCloseTo(2, 12);
  expect(calculation.summary.sumRankSquaresY).toBeCloseTo(2, 12);
  expect(calculation.summary.sumRankDifferencesSquared).toBe(0);
  expect(calculation.summary.spearmanShortcut).toBeCloseTo(1, 12);
  expect(calculation.tied.rankX).toEqual([1.5, 1.5, 3]);
  expect(calculation.tied.rankTiesX).toEqual([{ value: 1, count: 2, averageRank: 1.5 }]);
  expect(calculation.tied.sumRankCrossProducts).toBeCloseTo(1.5, 12);
  expect(calculation.tied.sumRankSquaresX).toBeCloseTo(1.5, 12);
  expect(calculation.tied.sumRankSquaresY).toBeCloseTo(2, 12);
  expect(calculation.tied.spearmanShortcut).toBeNaN();
  expect(calculation.summary.kendall.value).toBeCloseTo(1, 12);
  expect(calculation.summary.kendall.concordant).toBe(3);
  expect(calculation.perfect.distance.value).toBeCloseTo(1, 12);
  expect(calculation.tied.kendall.concordant).toBe(2);
  expect(calculation.tied.kendall.tiesX).toBe(1);
  expect(calculation.tied.kendall.value).toBeCloseTo(2 / Math.sqrt(6), 12);
  expect(calculation.steps).toBe(7);
  expect(calculation.contributionRows).toBe(3);
  expect(calculation.optionalChecked).toEqual([false, false, false]);
  expect(calculation.optionalCardVisible).toBe(false);
  expect(calculation.headings).toContain("Build and average the cross-products");
  expect(calculation.headings).toContain("Measure residual error and explained variation");
  expect(calculation.headings).toContain("Turn the covariance matrix into the plotted ellipse");
  expect(calculation.hasMathJaxLoader).toBe(true);
  expect(calculation.workedText).toContain("Inspect all 3 point contributions");

  const canvasHeightBeforeSpearman = await page.locator("#canvas").evaluate((canvas) => canvas.height);
  await page.locator("#measure-spearman").check();
  await expect(page.locator("#canvas")).toHaveAttribute("data-spearman-enabled", "true");
  const rankVisualization = await page.locator("#canvas").evaluate((canvas) => ({
    enabled: canvas.dataset.spearmanEnabled,
    value: Number(canvas.dataset.spearman),
    points: JSON.parse(canvas.dataset.rankPoints),
    height: canvas.height,
    label: canvas.getAttribute("aria-label"),
  }));
  expect(rankVisualization.enabled).toBe("true");
  expect(rankVisualization.value).toBeCloseTo(1, 12);
  expect(rankVisualization.points).toEqual([[1, 1], [2, 2], [3, 3]]);
  expect(rankVisualization.height).toBeGreaterThan(canvasHeightBeforeSpearman);
  expect(rankVisualization.label).toContain("Spearman rank-versus-rank plot");
  await expect(page.locator("#plot-legend")).toContainText("Rank fit (Spearman panel)");
  await page.locator("#measure-kendall").check();
  await page.locator("#measure-distance").check();
  await expect(page.locator(".optional-measure-step")).toHaveCount(3);
  await expect(page.locator(".optional-results-card")).toContainText("Spearman ρₛ");
  await expect(page.locator(".optional-results-card")).toContainText("Kendall τᵦ");
  await expect(page.locator(".optional-results-card")).toContainText("Distance ℛ");
  await expect(page.locator(".calculation-step")).toHaveCount(10);
  await expect(page.locator('[data-measure="spearman"]')).toContainText("average rank");
  await expect(page.locator('[data-measure="spearman"]')).toContainText("Shortcut check");
  await expect(page.locator(".calculation-table thead")).toContainText("Rank product");
  await expect(page.locator(".calculation-table thead")).toContainText("dᵢ²");
});

test("Covariance Lab contains wide formulas and tables on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/tools/correlation_visualizer/", { waitUntil: "domcontentloaded" });
  await page.locator("#measure-spearman").check();
  await page.locator("#measure-kendall").check();
  await page.locator("#measure-distance").check();
  await expect(page.locator(".optional-measure-step")).toHaveCount(3);

  const layout = await page.evaluate(() => {
    const calculation = document.querySelector(".calculation-section").getBoundingClientRect();
    const tableWrap = document.querySelector(".calculation-table-wrap");
    const formulaBoxes = [...document.querySelectorAll(".live-formula")];
    return {
      pageWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      calculationLeft: calculation.left,
      calculationRight: calculation.right,
      tableClientWidth: tableWrap.clientWidth,
      tableScrollWidth: tableWrap.scrollWidth,
      formulasContainOverflow: formulaBoxes.every((box) => getComputedStyle(box).overflowX === "auto"),
    };
  });

  expect(layout.pageWidth).toBeLessThanOrEqual(layout.viewportWidth + 1);
  expect(layout.calculationLeft).toBeGreaterThanOrEqual(0);
  expect(layout.calculationRight).toBeLessThanOrEqual(layout.viewportWidth + 1);
  expect(layout.tableScrollWidth).toBeGreaterThan(layout.tableClientWidth);
  expect(layout.formulasContainOverflow).toBe(true);
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
