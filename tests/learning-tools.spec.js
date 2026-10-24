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

test("practice mode checks an answer immediately and explains it", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto(`${quiz}?category=linux`);
  const first = page.locator(".question-card").first();
  await expect(page.locator(".question-card")).toHaveCount(10);
  await expect(first.locator(".question-feedback")).toBeHidden();

  await first.locator(".option-label").first().click();
  await expect(first.locator(".question-feedback")).toBeVisible();
  await expect(first.locator(".option-item.correct")).toHaveCount(1);
  await expect(first.locator(".feedback-links a")).not.toHaveCount(0);
  await expect(page.locator("#tallyValue")).toHaveText(/^[01] \/ 1$/);
  expect(errors).toEqual([]);
});

test("exam mode hides answers until the quiz is submitted", async ({ page }) => {
  await page.goto(`${quiz}?category=frontend&mode=exam&n=5`);
  await expect(page.locator(".question-card")).toHaveCount(5);
  const first = page.locator(".question-card").first();
  await first.locator(".option-label").first().click();
  await expect(first.locator(".question-feedback")).toBeHidden();

  await page.locator("#submitButton").click();
  await expect(page.locator("#resultsModal")).toBeVisible();
  await expect(page.locator("#unansweredCount")).toHaveText("4");
  await expect(page.locator(".question-feedback:visible")).toHaveCount(5);
  await page.keyboard.press("Escape");
  await expect(page.locator("#resultsModal")).toBeHidden();
});

test("topic filter narrows the questions and lives in the URL", async ({ page }) => {
  await page.goto(`${quiz}?category=linux`);
  const chip = page.locator(".topic-chip[data-topic]:not([data-topic=''])").first();
  const topic = await chip.getAttribute("data-topic");
  const name = (await chip.textContent()).replace(/\d+$/, "").trim();
  await chip.click();
  await expect(page).toHaveURL(new RegExp(`topics=${topic}`));
  const labels = await page.locator(".question-topic").allTextContents();
  expect(labels.length).toBeGreaterThan(0);
  expect(new Set(labels)).toEqual(new Set([name]));
});

test("keyboard answers follow the displayed option order", async ({ page }) => {
  await page.goto(`${quiz}?category=parallel_programming`);
  const first = page.locator(".question-card").first();
  await expect(first).toBeVisible();
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("2");
  const picked = first.locator(".option-item").nth(1).locator("input");
  await expect(picked).toBeChecked();
});

test("flashcards reveal answers and remember known cards", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto(`${cards}?category=frontend`);
  await expect(page.locator(".card-question")).toBeVisible();
  const question = await page.locator(".card-question").innerHTML();
  await expect(page.locator("#cardBack")).toBeHidden();

  await page.keyboard.press("Space");
  await expect(page.locator("#cardBack")).toBeVisible();
  await page.locator("#knownButton").click();
  await expect(page.locator("#statKnown")).toHaveText(/^1 \/ \d+$/);
  await expect(page.locator(".card-question")).not.toHaveJSProperty("innerHTML", question);

  await page.reload();
  await expect(page.locator("#statKnown")).toHaveText(/^1 \/ \d+$/);
  await expect(page.locator(".card-question")).not.toHaveJSProperty("innerHTML", question);
  expect(errors).toEqual([]);
});

test("still-learning cards come back later in the session", async ({ page }) => {
  await page.goto(`${cards}?category=statistics`);
  const question = page.locator(".card-question");
  await expect(question).toBeVisible();
  const first = await question.innerHTML();
  await page.keyboard.press("Space");
  await page.keyboard.press("1");
  await expect(page.locator("#statLearning")).toHaveText("1");
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press("Space");
    await page.keyboard.press("2");
  }
  await expect(page.locator("#cardPosition")).toHaveText("Again");
  expect(await question.innerHTML()).toBe(first);
});

for (const width of [390, 1280]) {
  test(`learning tools fit a ${width}px viewport`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const url of [`${quiz}?category=statistics`, `${quiz}?category=devops`, `${cards}?category=databases`, `${cards}?category=devops`]) {
      await page.goto(url);
      await expect(page.locator(".question-card, .card-question").first()).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
    }
  });
}
