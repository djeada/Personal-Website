const { test, expect } = require("@playwright/test");

const quiz = "/tools/quiz_app/";
const cards = "/tools/flash_cards/";

function collectErrors(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return errors;
}

async function startQuiz(page, url) {
  await page.goto(url);
  await expect(page.locator("#startButton")).toBeEnabled();
  await page.locator("#startButton").click();
  await expect(page.locator("#playScreen")).toBeVisible();
}

test("quiz setup lists every subject and narrows topics", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto(`${quiz}?category=linux`);
  await expect(page.locator(".la-tile")).toHaveCount(8);
  await expect(page.locator(".la-tile:has(input:checked) .la-tile-name")).toHaveText("Linux");
  await expect(page.locator("#topicSummary")).toHaveText(/^All \d+ topics$/);

  await page.locator("#topicPicker summary").click();
  await page.locator("#topicPicker").getByRole("button", { name: "Clear" }).click();
  await expect(page.locator("#startButton")).toBeDisabled();
  await page.locator(".la-topic").first().click();
  await expect(page.locator("#topicSummary")).toHaveText(/^1 of \d+: /);
  await expect(page).toHaveURL(/topics=/);
  await expect(page.locator("#startButton")).toBeEnabled();
  expect(errors).toEqual([]);
});

test("practice mode checks each answer, explains it and ends with a review", async ({ page }) => {
  const errors = collectErrors(page);
  await startQuiz(page, `${quiz}?category=linux&n=5`);
  await expect(page.locator(".la-seg")).toHaveCount(5);
  await expect(page.locator("#primaryButton")).toHaveText("Check answer");
  await expect(page.locator("#primaryButton")).toBeDisabled();

  await page.keyboard.press("a");
  await expect(page.locator("#primaryButton")).toBeEnabled();
  await page.keyboard.press("Enter");
  await expect(page.locator("#feedback")).toBeVisible();
  await expect(page.locator(".qz-option.is-correct")).toHaveCount(1);
  await expect(page.locator("#verdict")).toHaveText(/Correct|Not quite/);
  await expect(page.locator("#sources a")).not.toHaveCount(0);
  await expect(page.locator(".la-seg").first()).toHaveClass(/is-(correct|wrong)/);

  for (let i = 0; i < 4; i++) {
    await page.keyboard.press("Enter");
    await page.keyboard.press("b");
    await page.keyboard.press("Enter");
  }
  await page.keyboard.press("Enter");
  await expect(page.locator("#resultsScreen")).toBeVisible();
  await expect(page.locator("#resultScore")).toHaveText(/^\d+ \/ 5$/);
  await page.locator(".la-tab[data-filter='all']").click();
  await expect(page.locator("#reviewList > li")).toHaveCount(5);
  expect(errors).toEqual([]);
});

test("exam mode hides answers, flags questions and confirms before submitting", async ({ page }) => {
  await startQuiz(page, `${quiz}?category=frontend&mode=exam&n=5`);
  await expect(page.locator("#skipButton")).toBeHidden();
  await page.keyboard.press("a");
  await expect(page.locator("#feedback")).toBeHidden();
  await page.keyboard.press("f");
  await expect(page.locator(".la-seg").first()).toHaveClass(/is-flagged/);

  for (let i = 0; i < 4; i++) await page.locator("#primaryButton").click();
  await expect(page.locator("#primaryButton")).toHaveText("Finish quiz");
  await page.locator("#primaryButton").click();
  await expect(page.locator("#submitConfirm")).toBeVisible();
  await expect(page.locator("#confirmText")).toContainText("4 questions are unanswered and 1 is flagged");
  await page.locator("#confirmSubmit").click();
  await expect(page.locator("#resultsScreen")).toBeVisible();
  await expect(page.locator("#resultStats")).toContainText("4 skipped");
});

test("Polish subjects switch the whole interface to Polish", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto(`${quiz}?category=linux`);
  await expect(page.locator(".la-tiles-heading")).toHaveText("Po polsku");
  await expect(page.locator("#startButton")).toHaveText("Start quiz");

  await page.locator(".la-tile", { hasText: "Od C do C++" }).click();
  await expect(page.locator("#quizApp")).toHaveAttribute("lang", "pl");
  await expect(page.locator("#startButton")).toHaveText("Rozpocznij quiz");
  await expect(page.locator("#startSummary")).toContainText("10 pytań");
  await expect(page.locator(".la-tile[lang='pl'] .la-tile-facts").first()).toContainText(/pyta(nie|nia|ń)/);

  await page.locator("#startButton").click();
  await expect(page.locator("#primaryButton")).toHaveText("Sprawdź");
  await page.keyboard.press("a");
  await page.keyboard.press("Enter");
  await expect(page.locator("#verdict")).toHaveText(/Dobrze|Niestety nie/);
  await expect(page.locator("#primaryButton")).toHaveText("Następne pytanie");

  await page.locator("#endButton").click({ noWaitAfter: true }).catch(() => {});
  expect(errors).toEqual([]);
});

test("an unfinished quiz can be resumed after a reload", async ({ page }) => {
  await startQuiz(page, `${quiz}?category=databases&n=5`);
  await page.keyboard.press("a");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await expect(page.locator("#playCount")).toHaveText("2 / 5");

  await page.reload();
  await expect(page.locator("#resumeBanner")).toBeVisible();
  await expect(page.locator("#resumeText")).toContainText("1 of 5 answered");
  await page.locator("#resumeButton").click();
  await expect(page.locator("#playCount")).toHaveText("2 / 5");
  await expect(page.locator(".la-seg").first()).toHaveClass(/is-(correct|wrong)/);
});

test("flashcards schedule rated cards and requeue the ones you miss", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto(`${cards}?category=frontend`);
  await expect(page.locator(".la-tile")).toHaveCount(4);
  await expect(page.locator("#startSummary")).toContainText("20 cards");
  await page.locator("#startButton").click();
  await expect(page.locator("#cardBack")).toBeHidden();

  const front = page.locator("#cardFront");
  const first = await front.innerHTML();
  await page.keyboard.press("Space");
  await expect(page.locator("#cardBack")).toBeVisible();
  await expect(page.locator("#hintGood")).toHaveText("1 day");
  await page.keyboard.press("1");
  await expect(page.locator("#undoButton")).toBeVisible();

  for (let i = 0; i < 3; i++) {
    await page.keyboard.press("Space");
    await page.keyboard.press("2");
  }
  await expect(page.locator("#cardTag")).toHaveText("Again");
  expect(await front.innerHTML()).toBe(first);

  await page.keyboard.press("u");
  await expect(page.locator("#cardBack")).toBeVisible();
  await page.locator("#endButton").click();
  await expect(page.locator("#summaryScreen")).toBeVisible();
  await expect(page.locator("#summaryStats")).toContainText("2 good");

  await page.reload();
  // Three cards now have a schedule: the missed one is due again today.
  const facts = page.locator(".la-tile[data-slug='frontend'] .la-tile-facts");
  await expect(facts).toContainText("1 due");
  await expect(facts).toContainText("80 new");
  expect(errors).toEqual([]);
});

test("the card browser searches questions and answers", async ({ page }) => {
  await page.goto(`${cards}?category=databases`);
  await page.locator("#browseButton").click();
  await expect(page.locator("#browseScreen")).toBeVisible();
  const total = await page.locator("#browseList details").count();
  expect(total).toBeGreaterThan(50);
  await page.locator("#searchInput").fill("foreign key");
  const filtered = await page.locator("#browseList details").count();
  expect(filtered).toBeGreaterThan(0);
  expect(filtered).toBeLessThan(total);
  await page.locator("#browseList details summary").first().click();
  await expect(page.locator("#browseList details[open] .la-prose")).toBeVisible();
});

for (const width of [390, 1280]) {
  test(`learning tools fit a ${width}px viewport`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    for (const url of [`${quiz}?category=statistics`, `${quiz}?category=devops`]) {
      await startQuiz(page, url);
      await page.keyboard.press("a");
      await page.keyboard.press("Enter");
      await expect(page.locator("#feedback")).toBeVisible();
      expect(await overflow()).toBeLessThanOrEqual(1);
    }
    for (const url of [`${cards}?category=databases`, `${cards}?category=devops`]) {
      await page.goto(url);
      expect(await overflow()).toBeLessThanOrEqual(1);
      await page.locator("#startButton").click();
      await page.keyboard.press("Space");
      await expect(page.locator("#cardBack")).toBeVisible();
      expect(await overflow()).toBeLessThanOrEqual(1);
    }
  });
}
