const { test, expect } = require("@playwright/test");

// Dark mode must not depend on app.js: the inline scripts in <head>/<body>
// apply it before first paint, so dark-mode visitors never see a light flash.
const pages = [
  "/",
  "/articles/blog_1.html",
  "/articles/frontend_notes/04_javascript.html",
  "/core/projects.html",
  "/tools/fresnel/",
  "/courses/kurs_podstaw_pythona/tasks/01_interakcja_z_konsola_zad_02.html",
];

for (const url of pages) {
  test(`dark mode applies before app.js runs: ${url}`, async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: "darkMode", value: "true", url: baseURL }]);
    await page.route(/app\.js|googlesyndication|cse\.google/, route => route.abort());
    await page.goto(url, { waitUntil: "domcontentloaded" });
    const state = await page.evaluate(() => ({
      html: document.documentElement.classList.contains("dark-mode"),
      body: document.body.classList.contains("dark-mode"),
      background: document.documentElement.style.backgroundColor,
    }));
    expect(state).toEqual({ html: true, body: true, background: "rgb(13, 17, 23)" });
  });
}

// Redirect stubs navigate away immediately, so check their markup instead.
for (const stub of ["/core/blog.html", "/articles.html", "/tools.html"]) {
  test(`redirect stub is dark-mode aware: ${stub}`, async ({ request }) => {
    const html = await (await request.get(stub)).text();
    expect(html).toContain('id="theme-init"');
  });
}

test("light mode leaves the page light", async ({ page }) => {
  await page.goto("/articles/blog_1.html", { waitUntil: "domcontentloaded" });
  expect(await page.evaluate(() => document.documentElement.classList.contains("dark-mode"))).toBe(false);
});
