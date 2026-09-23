const { test, expect } = require("@playwright/test");

// Cross-tool checks for the optics suite (todo.md §5 "Definition of done").
// Physics is covered by the node tests in tests/optics/ (`npm run test:optics`).
const OPTICS_TOOLS = [
  "geometric_optics",
  "em_waves",
  "fresnel",
  "polarization",
  "interference",
  "standing_waves",
  "interferometers",
  "thin_films",
  "double_slit",
  "diffraction",
  "aperture_propagation",
  "diffraction_grating",
  "fourier_optics",
  "radiometry",
  "gaussian_beams",
  "fabry_perot",
  "laser_cavity",
  "dispersion_pulses",
  "waveguides",
  "holography",
  "nonlinear_optics",
  "quantum_optics",
  "electro_optics",
];

const VIEWPORTS = [
  { name: "phone", width: 390, height: 844, deviceScaleFactor: 2 },
  { name: "tablet", width: 768, height: 1024, deviceScaleFactor: 1 },
  { name: "desktop", width: 1440, height: 900, deviceScaleFactor: 1 },
];

const EXTERNAL = /googlesyndication|google\.com|googleapis|gstatic|googletagmanager|doubleclick/;

async function openTool(browser, tool, viewport, colorScheme = "dark") {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: viewport.deviceScaleFactor,
    colorScheme,
  });
  const page = await context.newPage();
  await page.route(EXTERNAL, (route) => route.abort());
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`/tools/${tool}/`, { waitUntil: "load" });
  await page.waitForTimeout(400);
  return { context, page, errors };
}

for (const tool of OPTICS_TOOLS) {
  test.describe(`optics: ${tool}`, () => {
    for (const viewport of VIEWPORTS) {
      test(`renders readable, error-free and without overflow on ${viewport.name}`, async ({ browser }) => {
        const { context, page, errors } = await openTool(browser, tool, viewport);

        const report = await page.evaluate(() => {
          const canvases = [...document.querySelectorAll("main canvas")].filter((c) => c.offsetParent !== null);
          return {
            viewport: document.documentElement.clientWidth,
            pageWidth: document.documentElement.scrollWidth,
            dpr: window.devicePixelRatio,
            canvases: canvases.map((c) => ({
              id: c.id,
              cssWidth: c.clientWidth,
              backingWidth: c.width,
              labelled: c.getAttribute("role") === "img" && !!c.getAttribute("aria-label"),
            })),
          };
        });

        expect(errors, "page errors").toEqual([]);
        expect(report.pageWidth).toBeLessThanOrEqual(report.viewport + 1);
        expect(report.canvases.length).toBeGreaterThan(0);
        for (const canvas of report.canvases) {
          expect(canvas.labelled, `canvas #${canvas.id} has an accessible label`).toBe(true);
          expect(canvas.cssWidth, `canvas #${canvas.id} fits the viewport`).toBeLessThanOrEqual(report.viewport);
          // Backing store follows the CSS size and device pixel ratio (no stretched 700 px artwork).
          expect(Math.abs(canvas.backingWidth - canvas.cssWidth * report.dpr), `canvas #${canvas.id} backing size`).toBeLessThanOrEqual(2);
        }
        await context.close();
      });
    }

    test("has keyboard numeric inputs, export bar, teaching content and related links", async ({ browser }) => {
      const { context, page, errors } = await openTool(browser, tool, VIEWPORTS[2], "light");

      const report = await page.evaluate(() => ({
        ranges: document.querySelectorAll('main input[type="range"]').length,
        numbers: document.querySelectorAll("main .optics-num-input").length,
        exportBar: !!document.querySelector(".optics-export-bar"),
        teaching: !!document.querySelector(".optics-teaching"),
        exercises: document.querySelectorAll(".optics-exercise").length,
        related: [...document.querySelectorAll("main a[href^='../']")].map((a) => a.getAttribute("href")),
      }));

      expect(errors).toEqual([]);
      if (report.ranges > 0) expect(report.numbers).toBeGreaterThan(0);
      expect(report.exportBar).toBe(true);
      expect(report.teaching).toBe(true);
      expect(report.exercises).toBeGreaterThanOrEqual(2);
      expect(report.related.length).toBeGreaterThan(0);
      await context.close();
    });

    test("survives a theme toggle", async ({ browser }) => {
      const { context, page, errors } = await openTool(browser, tool, VIEWPORTS[2], "light");
      const toggle = page.locator("#dark-mode-button");
      if (await toggle.count()) {
        await toggle.first().click();
        await page.waitForTimeout(200);
        await toggle.first().click();
        await page.waitForTimeout(200);
      }
      expect(errors).toEqual([]);
      await context.close();
    });
  });
}

test("tools catalogue lists every optics tool", async ({ page }) => {
  await page.route(EXTERNAL, (route) => route.abort());
  await page.goto("/core/tools.html", { waitUntil: "domcontentloaded" });
  const hrefs = await page.locator("a.tool-card").evaluateAll((links) => links.map((a) => a.getAttribute("href")));
  for (const tool of OPTICS_TOOLS) {
    expect(hrefs).toContain(`../tools/${tool}/index.html`);
  }
});
