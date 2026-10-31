const { test, expect } = require("@playwright/test");
const { words } = require("../src/tools/der_die_das/words.json");

const tool = "/tools/der_die_das/";
const LANE = { m: 0, f: 1, n: 2 };
const snapshot = (page) => page.evaluate(() => window.DDDGame.snapshot());

test.beforeEach(async ({ page }) => {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1(?::|\/))/, (route) => route.abort());
});

async function open(page, settings) {
  if (settings) {
    await page.addInitScript((value) => {
      if (!sessionStorage.getItem("ddd-seeded")) {
        localStorage.setItem("ddd:v2", JSON.stringify({ v: 2, settings: value }));
        sessionStorage.setItem("ddd-seeded", "1");
      }
    }, Object.assign({ sound: false, pace: "fast", meaning: "show" }, settings));
  }
  await page.goto(tool, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#startButton")).toBeEnabled();
}

async function nextWord(page) {
  await page.waitForFunction(() => {
    const s = window.DDDGame.snapshot();
    return s && s.status === "playing" && s.word;
  });
  return snapshot(page);
}

// Answers the falling word with the keyboard; returns the word and whether the answer was right.
async function answer(page, { right }) {
  const s = await nextWord(page);
  const lane = right ? LANE[s.articles[0]] : [0, 1, 2].find((i) => !s.articles.includes("mfn"[i]));
  const before = s.answers;
  await page.keyboard.press(String(lane + 1));
  await page.waitForFunction((n) => window.DDDGame.snapshot().answers > n, before);
  return s;
}

test("a right answer scores and explains the word; a miss shows the right box and costs a life", async ({ page }) => {
  await open(page, { mode: "classic", bonus: false });
  await page.locator("#startButton").click();

  const first = await answer(page, { right: true });
  const entry = words.find((row) => row[0] === first.word);
  await expect(page.locator("#lastVerdict")).toHaveText("Right");
  await expect(page.locator("#lastAnswer")).toContainText(first.word);
  await expect(page.locator("#lastAnswer")).toContainText(entry[3]);
  await expect(page.locator("#lastRule")).not.toBeEmpty();
  expect((await snapshot(page)).score).toBeGreaterThan(0);

  const missed = await answer(page, { right: false });
  const state = await snapshot(page);
  expect(state.status).toBe("frozen");
  expect(state.lives).toBe(2);
  await expect(page.locator("#lastVerdict")).toHaveText(/^Not (der|die|das)$/);
  await expect(page.locator("#lastAnswer")).toContainText(missed.word);
  await page.keyboard.press("Space");
  await expect.poll(async () => (await snapshot(page)).status).toBe("playing");
});

test("three misses end a classic game with the words to remember and a replay of them", async ({ page }) => {
  await open(page, { mode: "classic", bonus: false });
  await page.locator("#startButton").click();
  const missed = [];
  for (let i = 0; i < 3; i++) {
    missed.push((await answer(page, { right: false })).word);
    await page.keyboard.press("Enter");
  }
  await expect(page.locator("#overScreen")).toBeVisible();
  await expect(page.locator("#overReason")).toContainText("Out of lives");
  for (const word of missed) await expect(page.locator("#overMissed")).toContainText(word);
  await expect(page.locator("#recap .ddd-mark.is-wrong")).toHaveCount(new Set(missed).size);

  await page.locator("#mistakesButton").click();
  const s = await nextWord(page);
  expect(missed).toContain(s.word);
});

test("a missed word comes back a few words later until it is answered right", async ({ page }) => {
  await open(page, { mode: "practice" });
  await page.locator("#startButton").click();
  const missed = await answer(page, { right: false });
  await page.keyboard.press("Space");
  let comeback = null;
  for (let i = 0; i < 7 && !comeback; i++) {
    const s = await nextWord(page);
    if (s.word === missed.word) comeback = s;
    await answer(page, { right: true });
  }
  expect(comeback).not.toBeNull();
  expect(comeback.source).toBe("retry");
});

test("a plural bonus round follows seven right answers and a right plural adds a life", async ({ page }) => {
  await open(page, { mode: "classic", bonus: true });
  await page.locator("#startButton").click();
  await answer(page, { right: false });
  await page.keyboard.press("Space");
  let bonus = null;
  for (let i = 0; i < 20 && !bonus; i++) {
    await answer(page, { right: true });
    const s = await snapshot(page);
    if (s.status === "bonus") bonus = s;
  }
  expect(bonus).not.toBeNull();
  await expect(page.locator("#bonusForm")).toBeVisible();
  await page.locator("#bonusInput").fill(bonus.bonus);
  await page.keyboard.press("Enter");
  await expect(page.locator("#bonusFeedback")).toHaveClass(/is-right/);
  await expect.poll(async () => (await snapshot(page)).lives).toBe(3);
  await expect.poll(async () => (await snapshot(page)).status).toBe("playing");
});

test("time attack shows the clock and a wrong box costs three seconds", async ({ page }) => {
  await open(page, { mode: "time", bonus: false });
  await page.locator("#startButton").click();
  await expect(page.locator("#hudTimeBox")).toBeVisible();
  const before = (await nextWord(page)).clock;
  await answer(page, { right: false });
  const after = (await snapshot(page)).clock;
  expect(before - after).toBeGreaterThanOrEqual(3);
  expect(before - after).toBeLessThan(6);
});

test("a practice round ends after twenty words with a summary", async ({ page }) => {
  await open(page, { mode: "practice", bonus: false });
  await page.locator("#startButton").click();
  for (let i = 0; i < 20; i++) await answer(page, { right: true });
  await expect(page.locator("#overScreen")).toBeVisible();
  await expect(page.locator("#overReason")).toContainText("Practice complete");
  await expect(page.locator("#recap .ddd-recap-list > li")).toHaveCount(20);
});

test("time attack ends when the clock runs out", async ({ page }) => {
  await page.clock.install();
  await open(page, { mode: "time", bonus: false });
  await page.locator("#startButton").click();
  await page.clock.runFor(70000);
  await expect(page.locator("#overScreen")).toBeVisible();
  await expect(page.locator("#overReason")).toContainText("Time's up");
});

test("pausing stops the word and Escape resumes it", async ({ page }) => {
  await open(page, { mode: "classic" });
  await page.locator("#startButton").click();
  await nextWord(page);
  await page.keyboard.press("Escape");
  await expect(page.locator("#pauseScreen")).toBeVisible();
  const paused = await snapshot(page);
  await page.waitForTimeout(400);
  expect((await snapshot(page)).word).toBe(paused.word);
  expect((await snapshot(page)).status).toBe("paused");
  await page.keyboard.press("Escape");
  await expect(page.locator("#pauseScreen")).toBeHidden();
  expect((await snapshot(page)).status).toBe("playing");
});

test("progress and best scores survive a reload", async ({ page }) => {
  await open(page, { mode: "classic", bonus: false });
  await page.locator("#startButton").click();
  for (let i = 0; i < 3; i++) await answer(page, { right: true });
  await page.keyboard.press("Escape");
  await page.locator("#quitButton").click();
  const score = Number(await page.locator("#overTitle").textContent());
  expect(score).toBeGreaterThan(0);
  await page.reload();
  await expect(page.locator("#startButton")).toBeEnabled();
  await expect(page.locator('[data-best="classic"]')).toHaveText(`Best ${score}`);
  await expect(page.locator("#progressView .ddd-figures dd").first()).toHaveText("3");
});

test("practising a rule plays the words of that rule", async ({ page }) => {
  await open(page, {});
  await page.locator(".ddd-rule").filter({ hasText: "-ung" }).getByRole("button", { name: "Practise -ung" }).click();
  const s = await nextWord(page);
  const exceptions = new Set(["Sprung", "Ursprung", "Schwung", "Vorsprung", "Aufschwung", "Absprung"]);
  expect(s.word.endsWith("ung") || exceptions.has(s.word)).toBe(true);
});

test("on a phone, tapping a box answers and nothing overflows", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await page.route(/^https?:\/\/(?!127\.0\.0\.1(?::|\/))/, (route) => route.abort());
  await open(page, { mode: "classic" });
  await page.locator("#startButton").tap();
  const s = await nextWord(page);
  const box = await page.locator("#gameCanvas").boundingBox();
  const lane = LANE[s.articles[0]];
  await page.touchscreen.tap(box.x + (box.width / 3) * (lane + 0.5), box.y + box.height - 30);
  await expect.poll(async () => (await snapshot(page)).answers).toBe(1);
  expect((await snapshot(page)).right).toBe(1);
  const width = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  expect(width[0]).toBeLessThanOrEqual(width[1] + 1);
  await context.close();
});

test("the page loads without errors in light and dark mode", async ({ page, context }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => message.type() === "error" && !/ERR_FAILED|net::/.test(message.text()) && errors.push(message.text()));
  await open(page, {});
  await expect(page.locator(".ddd-rule").first()).toBeVisible();
  await context.addCookies([{ name: "darkMode", value: "true", url: "http://127.0.0.1:8000" }]);
  await page.reload();
  await expect(page.locator("body")).toHaveClass(/dark-mode/);
  await page.locator("#startButton").click();
  await nextWord(page);
  expect(errors).toEqual([]);
});
