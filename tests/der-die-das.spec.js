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

async function answerSentence(page, { right = true } = {}) {
  const s = await snapshot(page);
  const chosen = right ? s.sentence.answer : (s.sentence.family === "definite" ? ["der", "die", "das", "den", "dem", "des"] : ["ein", "eine", "einen", "einem", "einer", "eines"]).find((article) => article !== s.sentence.answer);
  await page.locator("#sentenceInput").fill(chosen);
  await page.locator("#sentenceCheck").click();
  await expect.poll(async () => (await snapshot(page)).answers).toBe(s.answers + 1);
  return s;
}

test("sentence mode switches settings and accepts typed articles with readable feedback", async ({ page }) => {
  await open(page, {});
  await page.locator('input[name="mode"][value="sentences"]').check();
  await expect(page.locator("#nounSettings")).toBeHidden();
  await expect(page.locator("#sentenceSettings")).toBeVisible();
  await expect(page.locator("#startSummary")).toContainText("48 sentences available");
  await page.locator("#startButton").click();
  await expect(page.locator("#gameCanvas")).toBeHidden();
  await expect(page.locator("#sentenceChoices button")).toHaveCount(6);
  const first = await snapshot(page);
  await page.locator("#sentenceInput").fill("hello");
  await page.keyboard.press("Enter");
  await expect(page.locator("#sentenceValidation")).toContainText("article forms");
  expect((await snapshot(page)).answers).toBe(0);
  await page.locator("#sentenceInput").fill(` ${first.sentence.answer.toUpperCase()} `);
  await page.keyboard.press("Enter");
  await expect(page.locator("#sentenceVerdict")).toHaveText("Right");
  await expect(page.locator("#sentenceExplanation")).toContainText(first.sentence.case[0].toUpperCase() + first.sentence.case.slice(1));
  await expect(page.locator("#sentenceCheck")).toBeDisabled();
  await expect(page.locator("#bonusForm")).toBeHidden();
  expect((await snapshot(page)).score).toBe(10);
  await page.keyboard.press("Enter");
  await expect(page.locator("#sentenceInput")).toBeFocused();
  expect((await snapshot(page)).sentence.id).not.toBe(first.sentence.id);
});

test("sentence mistakes return after three intervening sentences and can be replayed", async ({ page }) => {
  await open(page, { mode: "sentences" });
  await page.locator("#startButton").click();
  const missed = await answerSentence(page, { right: false });
  await expect(page.locator("#sentenceVerdict")).toContainText(`The answer is ${missed.sentence.answer}`);
  await page.locator("#sentenceNext").click();
  for (let i = 0; i < 3; i++) {
    expect((await snapshot(page)).sentence.id).not.toBe(missed.sentence.id);
    await answerSentence(page);
    await page.locator("#sentenceNext").click();
  }
  expect((await snapshot(page)).sentence.id).toBe(missed.sentence.id);
  expect((await snapshot(page)).source).toBe("retry");
  await answerSentence(page);
  await page.keyboard.press("Escape");
  await page.locator("#quitButton").click();
  await expect(page.locator("#overMissed")).toContainText("One sentence to remember");
  await page.locator("#mistakesButton").click();
  expect((await snapshot(page)).mode).toBe("sentences");
  expect((await snapshot(page)).sentence.id).toBe(missed.sentence.id);
  expect((await snapshot(page)).budget).toBe(1);
  await answerSentence(page);
  await page.locator("#sentenceNext").click();
  await expect(page.locator("#overReason")).toContainText("Round complete");
});

test("case and article filters persist, a round completes and noun progress stays separate", async ({ page }) => {
  await open(page, { mode: "sentences", articleType: "indefinite", grammaticalCase: "genitive" });
  await expect(page.locator("#startSummary")).toContainText("9 sentences available");
  await page.locator("#startButton").click();
  for (let i = 0; i < 9; i++) {
    const s = await snapshot(page);
    expect(s.sentence.case).toBe("genitive");
    expect(s.sentence.family).toBe("indefinite");
    expect(s.sentence.gender).not.toBe("p");
    await page.locator(`#sentenceChoices button[data-article="${s.sentence.answer}"]`).click();
    await page.locator("#sentenceNext").click();
  }
  await expect(page.locator("#overScreen")).toBeVisible();
  await expect(page.locator("#overReason")).toContainText("Round complete");
  await expect(page.locator("#recap .ddd-recap-list > li")).toHaveCount(9);
  await expect(page.locator("#progressView .ddd-figures dd").first()).toHaveText("0");
  await expect(page.locator("#sentenceProgressSummary")).toContainText("9 answers · 100% accuracy");
  const score = (await snapshot(page)).score;
  await page.reload();
  await expect(page.locator('input[name="mode"][value="sentences"]')).toBeChecked();
  await expect(page.locator("#caseControl")).toHaveValue("genitive");
  await expect(page.locator('[data-best="sentences"]')).toHaveText(`Best ${score}`);
  await expect(page.locator("#sentenceProgressSummary")).toContainText("9 answers");
  await page.locator('input[name="articleType"][value="definite"]').check();
  await expect(page.locator('[data-best="sentences"]')).toHaveText("No score yet");
  await expect(page.locator("#startSummary")).toContainText("12 sentences available");
  await page.locator('input[name="mode"][value="classic"]').check();
  await expect(page.locator("#nounSettings")).toBeVisible();
  await expect(page.locator("#sentenceSettings")).toBeHidden();
});

test("a mixed sentence round covers every case and ends after twenty distinct sentences", async ({ page }) => {
  await open(page, { mode: "sentences", articleType: "mixed" });
  await page.locator("#startButton").click();
  await expect(page.locator("#sentenceChoices button")).toHaveCount(12);
  const cases = new Set();
  const families = new Set();
  const ids = new Set();
  for (let i = 0; i < 20; i++) {
    const s = await answerSentence(page);
    cases.add(s.sentence.case);
    families.add(s.sentence.family);
    ids.add(s.sentence.id);
    await page.locator("#sentenceNext").click();
  }
  expect(cases.size).toBe(4);
  expect(families.size).toBe(2);
  expect(ids.size).toBe(20);
  await expect(page.locator("#overScreen")).toBeVisible();
  await expect(page.locator("#recap .ddd-recap-list > li")).toHaveCount(20);
  await expect(page.locator("#mistakesButton")).toBeHidden();
});

test("sentence input pauses with Escape, resumes intact, and fits a phone in both themes", async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, { mode: "sentences", articleType: "mixed" });
  for (const dark of [false, true]) {
    await context.addCookies([{ name: "darkMode", value: String(dark), url: "http://127.0.0.1:8000" }]);
    await page.reload();
    await page.locator("#startButton").click();
    const s = await snapshot(page);
    await page.locator("#sentenceInput").fill("dem");
    await page.keyboard.press("Escape");
    await expect(page.locator("#pauseScreen")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("#sentenceInput")).toBeFocused();
    await expect(page.locator("#sentenceInput")).toHaveValue("dem");
    expect((await snapshot(page)).sentence.id).toBe(s.sentence.id);
    await page.locator(".ddd-article-reference summary").click();
    await expect(page.locator("#articleReference table")).toHaveCount(2);
    const width = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    expect(width[0]).toBeLessThanOrEqual(width[1] + 1);
  }
});

