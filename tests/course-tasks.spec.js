const { test, expect } = require("@playwright/test");

// End-to-end checks of the Python task runner: the judge loads Pyodide from the
// CDN, so these tests need network access and a generous timeout.
const TASKS = "/courses/kurs_podstaw_pythona/tasks/";
const PYODIDE_TIMEOUT = 120_000;

test.describe.configure({ timeout: 180_000 });

async function openTask(page, slug) {
  await page.route(/googlesyndication|cse\.google/, route => route.abort());
  await page.goto(TASKS + slug + ".html");
  await page.evaluate(() => window.localStorage.removeItem("pyk:code:" + JSON.parse(document.getElementById("pyk-data").textContent).slug));
}

async function submit(page, code) {
  await page.fill("#pyk-code", code);
  await page.click("#pyk-run");
  const summary = page.locator("#pyk-summary");
  await expect(summary).toHaveAttribute("data-state", /^(pass|fail|error)$/, { timeout: PYODIDE_TIMEOUT });
  return summary;
}

test("correct solution passes all tests and marks the task as solved", async ({ page }) => {
  await openTask(page, "02_instrukcja_warunkowa_zad_02");
  const summary = await submit(
    page,
    [
      "a = int(input())",
      "b = int(input())",
      'print("Liczby są identyczne." if a == b else "Liczby są różne.")',
    ].join("\n"),
  );
  await expect(summary).toHaveAttribute("data-state", "pass");
  await expect(page.locator(".pyk-test[data-state='fail'], .pyk-test[data-state='error']")).toHaveCount(0);
  await expect(page.locator("#pyk-solved")).toBeVisible();
  const solved = await page.evaluate(() => JSON.parse(window.localStorage.getItem("pyk:solved")));
  expect(solved).toContain("02_instrukcja_warunkowa_zad_02");
});

test("wrong answer is reported with a highlighted diff", async ({ page }) => {
  await openTask(page, "02_instrukcja_warunkowa_zad_02");
  const summary = await submit(page, 'input()\ninput()\nprint("Liczby są różne.")');
  await expect(summary).toHaveAttribute("data-state", "fail");
  await expect(page.locator(".pyk-test[data-state='fail'] .pyk-line.is-diff").first()).toBeVisible();
});

test("file tasks are judged against fixture files", async ({ page }) => {
  await openTask(page, "20_operacje_na_plikach_zad_09");
  await expect(page.locator(".pyk-example-files").first()).toBeVisible();
  const deleteBig = [
    "from pathlib import Path",
    "baza = Path(input())",
    "if not baza.is_dir():",
    '    print("Folder nie istnieje.")',
    "else:",
    "    usuniete = []",
    '    for p in sorted(baza.rglob("*")):',
    "        if p.is_file() and p.stat().st_size > 10240:",
    "            p.unlink()",
    "            usuniete.append(p.relative_to(baza).as_posix())",
    '    print("\\n".join(usuniete) if usuniete else "Brak plików.")',
  ].join("\n");
  await expect(await submit(page, deleteBig)).toHaveAttribute("data-state", "pass");

  // Printing the right names without deleting anything must fail on the file check.
  const onlyPrints = deleteBig.replace("            p.unlink()\n", "");
  await expect(await submit(page, onlyPrints)).toHaveAttribute("data-state", "fail");
  await expect(page.locator(".pyk-test[data-state='fail'] .pyk-test-result .pyk-files").first()).toContainText("powinien zostać usunięty");
});

test("formulas are rendered with KaTeX", async ({ page }) => {
  await openTask(page, "01_interakcja_z_konsola_zad_07a");
  await expect(page.locator(".pyk-statement .katex").first()).toBeVisible();
  const unrendered = await page.locator(".pyk-statement .pyk-math").evaluateAll(spans => spans.filter(span => !span.querySelector(".katex")).length);
  expect(unrendered).toBe(0);
});

test("progress of replaced tasks is reset once", async ({ page, baseURL }) => {
  await page.goto(baseURL + TASKS + "02_instrukcja_warunkowa_zad_02.html");
  await page.evaluate(() => {
    window.localStorage.clear();
    window.localStorage.setItem("pyk:solved", JSON.stringify(["15_funkcje_rekurencja_zad_01", "02_instrukcja_warunkowa_zad_01"]));
    window.localStorage.setItem("pyk:code:15_funkcje_rekurencja_zad_01", "print(1)");
  });
  await page.reload();
  const state = await page.evaluate(() => ({
    solved: JSON.parse(window.localStorage.getItem("pyk:solved")),
    code: window.localStorage.getItem("pyk:code:15_funkcje_rekurencja_zad_01"),
    version: window.localStorage.getItem("pyk:version"),
  }));
  expect(state).toEqual({ solved: ["02_instrukcja_warunkowa_zad_01"], code: null, version: "2" });
});
