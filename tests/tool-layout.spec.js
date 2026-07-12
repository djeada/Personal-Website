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
