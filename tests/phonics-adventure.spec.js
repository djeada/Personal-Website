const { test, expect } = require("@playwright/test");

const tool = "/tools/learn_to_read/";
const key = "phonicsAdventure.v2";
const save = (page) => page.evaluate((storageKey) => JSON.parse(localStorage.getItem(storageKey)), key);

// Keep these tests independent of third-party ads, fonts, and analytics.
test.beforeEach(async ({ page }) => {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1(?::|\/))/, (route) => route.abort());
});

async function start(page) {
  await page.goto(tool, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#activity-title")).toBeVisible();
}
async function build(page, tiles) {
  for (const tile of tiles) {
    await page.locator(".pa-tile:not(:disabled)").filter({ hasText: new RegExp(`^${tile}$`) }).first().click();
  }
  await page.locator("#check-word").click();
}

test("letters give gentle feedback, reward once, and wait for the learner", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await start(page);
  await expect(page.locator(".pa-example-word")).toHaveText("sun");
  await page.locator('[data-letter]:not([data-letter="s"])').first().click();
  await expect(page.locator("#feedback")).toContainText("A good try");
  expect((await save(page)).journeys.en.stars).toBe(0);
  await page.locator('[data-letter="s"]').click();
  await expect(page.locator("#feedback")).toContainText("Yes!");
  await expect(page.locator(".pa-example-word")).toHaveText("sun");
  await expect(page.locator("[data-letter]")).toHaveCount(3);
  expect((await save(page)).journeys.en.stats.sounds).toEqual({ attempts: 2, correct: 1 });
  await expect(page.locator("#total-stars")).toHaveText("1");
  await expect(page.locator(".pa-letter-library summary > span")).toHaveText("1 of 26 letters discovered");
  await page.locator("#next-activity").click();
  await expect(page.locator(".pa-example-word")).toHaveText("apple");
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator(".pa-example-word")).toHaveText("apple");
  await expect(page.locator("#total-stars")).toHaveText("1");
  expect(errors).toEqual([]);
});

test("word building supports correction, clues, and a single reward", async ({ page }) => {
  await start(page);
  await page.locator("#tab-words").click();
  await expect(page.locator("#check-word")).toBeDisabled();
  await page.locator("#show-word").click();
  await expect(page.locator("#word-model")).toHaveText("sat");
  await build(page, ["t", "a", "s"]);
  await expect(page.locator("#feedback")).toContainText("Almost");
  expect((await save(page)).journeys.en.words).toEqual([]);
  await page.locator("#clear-word").click();
  await build(page, ["s", "a", "t"]);
  await expect(page.locator("#feedback")).toContainText("You built sat");
  await expect(page.locator("#check-word")).toBeDisabled();
  await expect(page.locator("#total-stars")).toHaveText("1");
  expect((await save(page)).journeys.en.stats.words).toEqual({ attempts: 2, correct: 1 });
  await expect(page.locator(".pa-trail-picker > span")).toHaveText("1 of 12 words discovered");
  await page.locator("#next-activity").click();
  await page.locator("#show-word").click();
  await expect(page.locator("#word-model")).toHaveText("mat");
});

test("keyboard navigation builds whole words and sound-team tiles", async ({ page }) => {
  await start(page);
  await page.locator("#tab-sounds").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#tab-words")).toBeFocused();
  await expect(page.locator("#tab-words")).toHaveAttribute("aria-selected", "true");
  await page.locator("#activity-panel").focus();
  await page.keyboard.type("sat");
  await page.keyboard.press("Backspace");
  await expect(page.locator("#check-word")).toBeDisabled();
  await page.keyboard.type("t");
  await page.keyboard.press("Enter");
  await expect(page.locator("#feedback")).toContainText("You built sat");
  await page.locator("#word-trail").selectOption("teams");
  await page.locator("#activity-panel").focus();
  await page.keyboard.type("ship");
  await page.keyboard.press("Enter");
  await expect(page.locator("#feedback")).toContainText("You built ship");
  await page.locator("#focus-toggle").click();
  await expect(page.locator("body")).toHaveClass(/pa-focus-mode/);
  await page.keyboard.press("Escape");
  await expect(page.locator("body")).not.toHaveClass(/pa-focus-mode/);
  await expect(page.locator("#focus-toggle")).toBeFocused();
});

test("duplicate letter tiles remain independent in German words", async ({ page }) => {
  await start(page);
  await page.locator('[data-language="de"]').click();
  await page.locator("#tab-words").click();
  await page.locator("#show-word").click();
  await expect(page.locator("#word-model")).toHaveText("Mama");
  await build(page, ["m", "a", "m", "a"]);
  await expect(page.locator("#feedback")).toContainText("Mama gebaut");
  expect((await save(page)).journeys.de.words).toContain("Mama");
});

test("a story requires finding a word on every page and resumes unfinished pages", async ({ page }) => {
  await start(page);
  await page.locator("#tab-stories").click();
  await expect(page.locator("#next-activity")).toBeDisabled();
  await page.locator('[data-word="cat"]').click();
  await expect(page.locator("#feedback")).toContainText("Try another word");
  await page.locator('[data-word="mat"]').click();
  await expect(page.locator("#feedback")).toContainText("You found mat");
  expect((await save(page)).journeys.en.stories).toEqual([]);
  await expect(page.locator(".pa-book-dots .is-read")).toHaveCount(1);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator(".pa-story-picker > span")).toHaveText("Page 2 of 3");
  await page.locator('[data-word="nap"]').click();
  await page.locator("#next-activity").click();
  await page.locator('[data-word="dog"]').click();
  await expect(page.locator("#feedback")).toContainText("You finished");
  const progress = (await save(page)).journeys.en;
  expect(progress.stories).toEqual(["cat"]);
  expect(progress.pages).toHaveLength(3);
  expect(progress.stats.stories).toEqual({ attempts: 4, correct: 3 });
  await expect(page.locator("#total-stars")).toHaveText("3");
});

test("languages keep separate progress and resetting one preserves the other", async ({ page }) => {
  await start(page);
  await page.locator('[data-letter="s"]').click();
  await page.locator('[data-language="de"]').click();
  await expect(page.locator("#phonics-app")).toHaveAttribute("lang", "de");
  await expect(page.locator("#total-stars")).toHaveText("0");
  await page.locator('[data-letter="m"]').click();
  await page.locator("#grownups summary").click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#reset-progress").click();
  await expect(page.locator("#total-stars")).toHaveText("0");
  await page.locator('[data-language="en"]').click();
  await expect(page.locator("#total-stars")).toHaveText("1");
  expect((await save(page)).journeys.en.sounds).toEqual(["s"]);
  expect((await save(page)).journeys.de.sounds).toEqual([]);
});

test("legacy progress migrates without modifying the original save", async ({ page }) => {
  const legacy = { language: "en", masteredSounds: ["A", "S"], masteredWords: ["cat"], completedStories: ["The Cat 🐱"], stars: 21, currentPhase: "words", activityStats: { words: { attempts: 3, correct: 2 } } };
  await page.addInitScript((value) => localStorage.setItem("learnToReadProgress", JSON.stringify(value)), legacy);
  await start(page);
  const progress = (await save(page)).journeys.en;
  expect(progress.sounds).toEqual(["a", "s"]);
  expect(progress.words).toEqual(["cat"]);
  expect(progress.stories).toEqual(["cat"]);
  expect(progress.stars).toBe(21);
  expect(progress.stats.words).toEqual({ attempts: 3, correct: 2 });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("learnToReadProgress")))).toEqual(legacy);
});

for (const broken of ["invalid-json", "invalid-shape", "unavailable-storage", "unavailable-speech"]) {
  test(`activities work with ${broken}`, async ({ page }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(({ kind, storageKey }) => {
      if (kind === "invalid-json") localStorage.setItem(storageKey, "{");
      if (kind === "invalid-shape") localStorage.setItem(storageKey, JSON.stringify({ version: 2, language: "xx", journeys: { en: { sounds: [null, "<script>", "s", "s"], stars: -5, stats: null, daily: {} } } }));
      if (kind === "unavailable-storage") {
        Object.defineProperty(window, "localStorage", { get() { throw new Error("Storage blocked"); } });
      }
      if (kind === "unavailable-speech") {
        Object.defineProperty(window, "speechSynthesis", { value: undefined });
        Object.defineProperty(window, "SpeechSynthesisUtterance", { value: undefined });
      }
    }, { kind: broken, storageKey: key });
    await start(page);
    const answer = broken === "invalid-shape" ? "a" : "s";
    await page.locator(`[data-letter="${answer}"]`).click();
    await expect(page.locator("#feedback")).toContainText("Yes!");
    if (broken === "unavailable-storage") await expect(page.locator("#save-note")).toContainText("could not be saved");
    if (broken === "unavailable-speech") {
      await expect(page.locator("#listen-letter")).toBeDisabled();
      await expect(page.locator("#audio-toggle")).toContainText("Read together");
    }
    expect(errors).toEqual([]);
  });
}

test("daily goals stop at five and reset on the next local calendar day", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-24T12:00:00Z"));
  await start(page);
  for (const letter of ["s", "a", "t", "p", "i"]) {
    await page.locator(`[data-letter="${letter}"]`).click();
    await page.locator("#next-activity").click();
  }
  await expect(page.locator("#daily-progress")).toHaveAttribute("value", "5");
  await expect(page.locator("#goal-caption")).toContainText("complete");
  await page.clock.setFixedTime(new Date("2026-10-25T12:00:00Z"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("#daily-progress")).toHaveAttribute("value", "0");
  await expect(page.locator("#total-stars")).toHaveText("5");
});

test("speech highlights stop on navigation and stale speech events are ignored", async ({ page }) => {
  await page.addInitScript(() => {
    window.testUtterances = [];
    window.testCancelCount = 0;
    Object.defineProperty(window, "SpeechSynthesisUtterance", { value: class { constructor(text) { this.text = text; } } });
    Object.defineProperty(window, "speechSynthesis", { value: {
      getVoices: () => [], cancel: () => { window.testCancelCount += 1; },
      speak: (utterance) => { window.testUtterances.push(utterance); }
    } });
  });
  await start(page);
  await page.locator("#tab-stories").click();
  await expect(page.locator("#read-story")).toHaveAttribute("aria-pressed", "true");
  await page.evaluate(() => { window.oldStoryUtterance = window.testUtterances.at(-1); window.oldStoryUtterance.onboundary({ charIndex: 4 }); });
  await expect(page.locator('[data-word="cat"]')).toHaveClass(/pa-speaking/);
  await page.locator("#tab-words").click();
  await page.evaluate(() => window.oldStoryUtterance.onboundary({ charIndex: 4 }));
  await expect(page.locator(".pa-speaking")).toHaveCount(0);
  expect(await page.evaluate(() => window.testCancelCount)).toBeGreaterThan(0);
  await page.locator("#audio-toggle").click();
  await expect(page.locator("#listen-word")).toBeDisabled();
  await page.locator("#tab-sounds").click();
  await expect(page.locator("#listen-letter")).toBeDisabled();
});

test("every authored word can be built and every story target is present", async ({ page }) => {
  await start(page);
  const issues = await page.evaluate(() => {
    const data = window.PhonicsContent;
    const problems = [];
    for (const language of ["en", "de"]) {
      for (const group of data.words[language]) for (const word of group.items) {
        if (word.tiles.join("").toLowerCase() !== word.text.toLowerCase()) problems.push(word.text);
      }
      for (const story of data.stories[language]) for (const page of story.pages) {
        const words = page.text.toLowerCase().match(/\p{L}+/gu);
        if (words.filter((word) => word === page.target.toLowerCase()).length !== 1) problems.push(page.text);
      }
    }
    return problems;
  });
  expect(issues).toEqual([]);
});

for (const dark of [false, true]) {
  test(`activities fit small and large screens in ${dark ? "dark" : "light"} mode`, async ({ page, context }) => {
    await context.addCookies([{ name: "darkMode", value: String(dark), domain: "127.0.0.1", path: "/" }]);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await start(page);
    for (const width of [320, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      for (const language of ["en", "de"]) {
        await page.locator(`[data-language="${language}"]`).click();
        for (const mode of ["sounds", "words", "stories"]) {
          await page.locator(`#tab-${mode}`).click();
          const bounds = await page.locator("#activity-panel").evaluate((panel) => ({
            left: panel.getBoundingClientRect().left, right: panel.getBoundingClientRect().right,
            page: document.documentElement.scrollWidth, viewport: document.documentElement.clientWidth
          }));
          expect(bounds.left).toBeGreaterThanOrEqual(0);
          expect(bounds.right).toBeLessThanOrEqual(width);
          expect(bounds.page).toBeLessThanOrEqual(bounds.viewport + 1);
        }
      }
      await page.locator("#start-adventure").click();
      await expect(page.locator("#next-activity")).toBeInViewport();
      await expect(page.locator("#replay-guide")).toBeInViewport();
      await expect(page.locator("#start-adventure")).not.toBeVisible();
      await expect(page.locator(".pa-sidebar")).not.toBeVisible();
      const focusedWidth = await page.locator("#activity-area").evaluate((element) => ({ content: element.scrollWidth, width: element.clientWidth }));
      expect(focusedWidth.content).toBeLessThanOrEqual(focusedWidth.width + 1);
      await page.keyboard.press("Escape");
    }
  });
}

test("picture-led play narrates instructions, letter clues, rewards and the next task", async ({ page }) => {
  await page.addInitScript(() => {
    window.testUtterances = [];
    Object.defineProperty(window, "SpeechSynthesisUtterance", { value: class { constructor(text) { this.text = text; } } });
    Object.defineProperty(window, "speechSynthesis", { value: {
      getVoices: () => [{ lang: "en-US", name: "Google US English" }], cancel: () => {},
      speak: (utterance) => window.testUtterances.push(utterance)
    } });
  });
  await start(page);
  expect(await page.evaluate(() => window.testUtterances.length)).toBe(0);
  await page.getByRole("button", { name: "Let’s play!", exact: true }).click();
  await expect(page.locator("body")).toHaveClass(/pa-focus-mode/);
  expect(await page.evaluate(() => window.testUtterances.at(-1).text)).toContain("Which letter does sun start with");
  await page.locator('[data-hear-letter="s"]').click();
  expect(await page.evaluate(() => window.testUtterances.at(-1).text)).toBe("S, as in sun.");
  await expect(page.locator("#total-stars")).toHaveText("0");
  await page.locator('[data-letter="s"]').click();
  expect(await page.evaluate(() => window.testUtterances.at(-1).text)).toContain("Yes!");
  await expect(page.locator("#guide-message")).toHaveText("Hooray! You did it!");
  await page.locator("#next-activity").click();
  expect(await page.evaluate(() => window.testUtterances.at(-1).text)).toContain("apple");
  await page.locator('[data-play-mode="words"]').click();
  expect(await page.evaluate(() => window.testUtterances.at(-1).text)).toContain("Let’s build sat");
  const images = await page.locator(".pa-finn-button img").evaluate((image) => ({ loaded: image.complete, width: image.naturalWidth }));
  expect(images.loaded).toBe(true);
  expect(images.width).toBeGreaterThan(0);
});

test("children can choose storybooks using illustrated covers", async ({ page }) => {
  await start(page);
  await page.locator("#tab-stories").click();
  await page.locator(".pa-story-library summary").click();
  await expect(page.locator("[data-book]")).toHaveCount(9);
  await page.locator('[data-book="dog"]').click();
  await expect(page.locator("#activity-title")).toHaveText("The dog and the log");
  await expect(page.locator(".pa-book-illustration .pa-atlas-letter")).toBeVisible();
  await page.locator('[data-word="dog"]').click();
  await expect(page.locator("#feedback")).toContainText("You found dog");
});
