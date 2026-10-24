const { test, expect } = require("@playwright/test");

const tool = "/tools/learn_to_read/";
const key = "phonicsAdventure.v3";
const save = (page) => page.evaluate((storageKey) => JSON.parse(localStorage.getItem(storageKey)), key);

// Keep these tests independent of third-party ads, fonts, and analytics.
test.beforeEach(async ({ page }) => {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1(?::|\/))/, (route) => route.abort());
});

async function start(page, { muted = true } = {}) {
  await page.goto(tool, { waitUntil: "domcontentloaded" });
  await expect(page.locator(".pa-node")).toHaveCount(22);
  if (muted) await page.locator("#sound-toggle").click();
}
async function unlockAll(page) {
  await page.locator("#grownups summary").click();
  await page.locator("#unlock-all").check();
}
const taskType = (page) => page.locator("#stage").evaluate((stage) => (stage.className.match(/pa-task-(\w+)/) || [])[1]);

// Answers whatever task is on screen correctly and waits for the next one.
async function solve(page) {
  const type = await taskType(page);
  const before = await page.locator("#play-progress").getAttribute("aria-valuenow");
  if (type === "meet") await page.locator("#meet-next").click();
  else if (type === "build") {
    const target = (await page.locator("#slots").getAttribute("data-target")).split("|");
    for (const tile of target) await page.locator(".pa-tile:not(:disabled)").filter({ hasText: new RegExp(`^${tile}$`) }).first().click();
  } else await page.locator("#stage [data-answer='true']").first().click();
  if (type !== "reward") await expect(page.locator("#play-progress")).not.toHaveAttribute("aria-valuenow", before, { timeout: 8000 });
  return type;
}
async function playLevel(page) {
  const types = [];
  while ((await taskType(page)) !== "reward") types.push(await solve(page));
  return types;
}

test("the first level teaches sounds, rewards three stars and unlocks the next level", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await start(page);
  await expect(page.locator(".pa-node.is-current")).toHaveCount(1);
  await expect(page.locator(".pa-node.is-locked")).toHaveCount(21);
  await page.locator("#play-next").click();
  await expect(page.locator("#play")).toBeVisible();
  await expect(page.locator(".pa-big-letter")).toHaveText("s");
  const types = await playLevel(page);
  expect(types.filter((type) => type === "meet")).toHaveLength(3);
  expect(new Set(types)).toEqual(new Set(["meet", "pickLetter", "pickPicture"]));
  await expect(page.locator(".pa-stars-big i.is-on")).toHaveCount(3);
  await expect(page.locator(".pa-reward-sticker")).toBeVisible();
  expect((await save(page)).journeys.en.done).toEqual({ 0: 3 });
  await page.locator("#reward-map").click();
  await expect(page.locator("#play")).toBeHidden();
  await expect(page.locator(".pa-node").nth(0)).toHaveClass(/is-done/);
  await expect(page.locator(".pa-node").nth(1)).toHaveClass(/is-current/);
  await expect(page.locator("#sticker-book .pa-sticker.is-won")).toHaveCount(1);
  await expect(page.locator("#stat-stars")).toHaveText("3");
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("#play-next-label")).toHaveText("Play level 2");
  expect(errors).toEqual([]);
});

test("mistakes are gentle: the answer glows after two misses and stars reflect the effort", async ({ page }) => {
  await start(page);
  await page.locator("#play-next").click();
  await page.locator("#meet-next").click();
  await expect(page.locator(".pa-letter-option")).toHaveCount(3);
  const wrong = page.locator(".pa-letter-option[data-answer='false']");
  await wrong.nth(0).click();
  await expect(wrong.nth(0)).toBeDisabled();
  await wrong.nth(1).click();
  await expect(page.locator(".pa-letter-option[data-answer='true']")).toHaveClass(/is-hint/);
  await playLevel(page);
  await expect(page.locator(".pa-stars-big i.is-on")).toHaveCount(2);
  const progress = (await save(page)).journeys.en;
  expect(progress.done).toEqual({ 0: 2 });
  expect(progress.stats.s.w).toBe(1);
});

test("rounds come in a different order each time they are played", async ({ page }) => {
  await start(page);
  const orders = new Set();
  for (let run = 0; run < 4; run += 1) {
    await page.locator("#play-next").click();
    const order = [];
    while ((await taskType(page)) !== "reward") {
      order.push(`${await taskType(page)}:${await page.locator("#stage").innerText()}`);
      await solve(page);
    }
    orders.add(order.join("|"));
    await page.locator("#reward-map").click();
    await page.evaluate((storageKey) => localStorage.removeItem(storageKey), key);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator("#sound-toggle").click();
  }
  expect(orders.size).toBeGreaterThan(1);
});

test("word building returns wrong tiles, accepts the keyboard and blends the word", async ({ page }) => {
  await start(page);
  await unlockAll(page);
  await page.locator('[data-level="2"]').click();
  let guard = 0;
  while ((await taskType(page)) !== "build" && guard++ < 10) await solve(page);
  const target = (await page.locator("#slots").getAttribute("data-target")).split("|");
  const reversed = [...target].reverse();
  for (const tile of reversed) await page.locator(".pa-tile:not(:disabled)").filter({ hasText: new RegExp(`^${tile}$`) }).first().click();
  await expect(page.locator(".pa-slot.is-wrong").first()).toBeVisible();
  await expect(page.locator(".pa-slot:not(.is-filled)").first()).toBeVisible({ timeout: 3000 });
  await page.locator(".pa-slot.is-filled").evaluateAll((slots) => slots.forEach((slot) => slot.click()));
  await expect(page.locator(".pa-slot.is-filled")).toHaveCount(0);
  await page.keyboard.type(target.join(""));
  await expect(page.locator(".pa-slot.is-right")).toHaveCount(target.length);
});

test("a story reads along, lets children explore words and finishes on the last page", async ({ page }) => {
  await start(page);
  await unlockAll(page);
  await page.locator('[data-level="5"]').click();
  await expect(page.locator(".pa-sentence")).toHaveText("A dog sat.");
  await page.locator(".pa-word[data-answer='false']").first().click();
  await expect(page.locator(".pa-word[data-answer='true']")).toBeEnabled();
  const types = await playLevel(page);
  expect(types).toEqual(["story", "story", "story"]);
  await expect(page.locator(".pa-stars-big i.is-on")).toHaveCount(3);
});

test("every level in both languages can be played to the end", async ({ page }) => {
  test.setTimeout(900000);
  await start(page);
  for (const language of ["en", "de"]) {
    await page.locator(`[data-language="${language}"]`).click();
    const count = await page.locator(".pa-node").count();
    for (let level = 0; level < count; level += 1) {
      await page.locator("#play-next").click();
      await playLevel(page);
      await page.locator("#reward-map").click();
    }
    await expect(page.locator(".pa-node.is-done")).toHaveCount(count);
    await expect(page.locator("#play-next-label")).toContainText(language === "en" ? "review" : "Wiederholung");
  }
});

test("languages keep separate paths and resetting one keeps the other", async ({ page }) => {
  await start(page);
  await page.locator("#play-next").click();
  await playLevel(page);
  await page.locator("#reward-map").click();
  await page.locator('[data-language="de"]').click();
  await expect(page.locator("#phonics-app")).toHaveAttribute("lang", "de");
  await expect(page.locator("#stat-stars")).toHaveText("0");
  await page.locator("#play-next").click();
  await expect(page.locator(".pa-big-letter")).toHaveText("M m");
  await playLevel(page);
  await page.locator("#reward-map").click();
  await page.locator("#grownups summary").click();
  await expect(page.locator(".pa-mastery-item")).toHaveCount(3);
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#reset-progress").click();
  await expect(page.locator("#stat-stars")).toHaveText("0");
  await page.locator('[data-language="en"]').click();
  await expect(page.locator("#stat-stars")).toHaveText("3");
  const saved = await save(page);
  expect(saved.journeys.de.done).toEqual({});
  expect(saved.journeys.en.done).toEqual({ 0: 3 });
});

test("progress from the previous version carries over", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("phonicsAdventure.v2", JSON.stringify({
    version: 2, language: "en", audio: true,
    journeys: { en: { sounds: ["s", "a", "t", "p", "i", "n"], words: ["pin", "tin"] }, de: {} }
  })));
  await page.goto(tool, { waitUntil: "domcontentloaded" });
  await expect(page.locator(".pa-node.is-done")).toHaveCount(3);
  await expect(page.locator("#play-next-label")).toHaveText("Play level 4");
});

for (const broken of ["invalid-json", "invalid-shape", "unavailable-storage", "no-audio"]) {
  test(`play works with ${broken}`, async ({ page }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(({ kind, storageKey }) => {
      if (kind === "invalid-json") localStorage.setItem(storageKey, "{");
      if (kind === "invalid-shape") localStorage.setItem(storageKey, JSON.stringify({ version: 3, language: "xx", journeys: { en: { done: { 0: 99, 50: 2, "<x>": 1 }, stats: { s: null, a: { c: -4 } } } } }));
      if (kind === "unavailable-storage") Object.defineProperty(window, "localStorage", { get() { throw new Error("Storage blocked"); } });
      if (kind === "no-audio") {
        Object.defineProperty(window, "speechSynthesis", { value: undefined });
        Object.defineProperty(window, "AudioContext", { value: undefined });
        HTMLMediaElement.prototype.play = function () { return Promise.reject(new Error("blocked")); };
      }
    }, { kind: broken, storageKey: key });
    await page.goto(tool, { waitUntil: "domcontentloaded" });
    if (broken === "invalid-shape") await expect(page.locator(".pa-node.is-done")).toHaveCount(1);
    await page.locator("#play-next").click();
    await solve(page);
    await solve(page);
    if (broken === "unavailable-storage") await expect(page.locator("#save-note")).toContainText("could not be saved");
    expect(errors).toEqual([]);
  });
}

test("narration plays recorded clips in order and the guide can repeat them", async ({ page }) => {
  await page.addInitScript(() => {
    window.played = [];
    HTMLMediaElement.prototype.play = function () {
      window.played.push(this.src.split("/").slice(-2).join("/"));
      setTimeout(() => this.onended && this.onended(), 20);
      return Promise.resolve();
    };
  });
  await start(page, { muted: false });
  expect(await page.evaluate(() => window.played.length)).toBe(0);
  await page.locator("#play-next").click();
  await expect.poll(() => page.evaluate(() => window.played.join(" "))).toBe("en/line-sounds.mp3 en/in-s.mp3");
  await page.locator("#meet-letter").click();
  await expect.poll(() => page.evaluate(() => window.played.at(-1))).toBe("en/ph-s.mp3");
  await page.locator("#meet-next").click();
  await expect.poll(() => page.evaluate(() => window.played.at(-1))).toBe("en/line-startq.mp3");
  await page.locator("#replay").click();
  await expect.poll(() => page.evaluate(() => window.played.slice(-2).join(" "))).toBe("en/w-sun.mp3 en/line-startq.mp3");
  await page.locator(".pa-letter-option[data-answer='true']").click();
  await expect.poll(() => page.evaluate(() => window.played.slice(-3).join(" "))).toMatch(/^en\/ph-s\.mp3 en\/w-sun\.mp3 en\/line-praise\d\.mp3$/);
});

test("every clip, picture and story target the game needs exists", async ({ page, request }) => {
  await page.goto(tool, { waitUntil: "domcontentloaded" });
  const needed = await page.evaluate(() => {
    const issues = [];
    const files = new Set();
    const pictures = new Set(window.PhonicsContent.stickers.concat(["trophy", "lock"]));
    for (const code of ["en", "de"]) {
      const lang = window.PhonicsContent[code];
      const clips = window.PhonicsAudio[code];
      const key = (word) => word.toLocaleLowerCase().replace(/[^\p{L}]/gu, "");
      const need = (id) => { if (!clips[id]) issues.push(`${code} missing ${id}`); else files.add(`${code}/${clips[id][0]}`); };
      Object.keys(lang.pictures).forEach((word) => { need(`w:${key(word)}`); pictures.add(lang.pictures[word]); });
      Object.entries(lang.sounds).forEach(([grapheme, [example]]) => {
        need(`in:${grapheme}`); need(`w:${key(example)}`);
        if (!lang.pictures[example]) issues.push(`${code} no picture for ${example}`);
      });
      Object.keys(lang.phonemes).forEach((grapheme) => need(`ph:${grapheme}`));
      Object.keys(lang.lines).forEach((name) => need(`line:${name}`));
      for (const [id, story] of Object.entries(lang.stories)) {
        pictures.add(story.cover);
        story.pages.forEach((page, i) => {
          need(`st:${id}:${i}`);
          page.pics.forEach((pic) => pictures.add(pic));
          const words = page.text.split(/\s+/).map(key);
          words.forEach((word) => need(`w:${word}`));
          if (words.filter((word) => word === key(page.target)).length !== 1) issues.push(`${code} ${page.text}`);
          if (clips[`st:${id}:${i}`]?.[2]?.length !== words.length) issues.push(`${code} timings ${id}:${i}`);
        });
      }
      for (const level of lang.levels.filter((item) => item.kind !== "story" && item.items)) {
        for (const item of level.items.split(" ")) {
          if (level.kind === "words" && !lang.pictures[item]) issues.push(`${code} no picture for ${item}`);
          if (level.kind === "sounds" && !lang.sounds[item]) issues.push(`${code} no sound ${item}`);
        }
      }
    }
    return { issues, files: [...files], pictures: [...pictures] };
  });
  expect(needed.issues).toEqual([]);
  for (const file of needed.files) expect((await request.head(`${tool}audio/${file}`)).status(), file).toBe(200);
  for (const pic of needed.pictures) expect((await request.head(`${tool}pics/${pic}.webp`)).status(), pic).toBe(200);
});

for (const dark of [false, true]) {
  test(`map and every task type fit small and large screens in ${dark ? "dark" : "light"} mode`, async ({ page, context }) => {
    test.setTimeout(120000);
    await context.addCookies([{ name: "darkMode", value: String(dark), domain: "127.0.0.1", path: "/" }]);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await start(page);
    await unlockAll(page);
    const fits = async (label) => {
      const bounds = await page.evaluate(() => ({ page: document.documentElement.scrollWidth, viewport: document.documentElement.clientWidth }));
      expect(bounds.page, label).toBeLessThanOrEqual(bounds.viewport + 1);
    };
    for (const [width, height] of [[320, 640], [390, 844], [768, 1024], [1280, 800]]) {
      await page.setViewportSize({ width, height });
      await fits(`map ${width}`);
      for (const level of [0, 2, 5]) {
        await page.locator(`[data-level="${level}"]`).click();
        const seen = new Set();
        for (let step = 0; step < 6 && (await taskType(page)) !== "reward"; step += 1) {
          const type = await taskType(page);
          if (!seen.has(type)) {
            seen.add(type);
            await fits(`${type} ${width}`);
            const inView = await page.locator("#stage button:not(:disabled)").evaluateAll((buttons) => buttons.every((button) => {
              const rect = button.getBoundingClientRect();
              return rect.left >= 0 && rect.right <= window.innerWidth + 1;
            }));
            expect(inView, `${type} ${width}`).toBe(true);
            await expect(page.locator("#close-play")).toBeInViewport();
          }
          await solve(page);
        }
        await page.locator("#close-play").click();
      }
    }
  });
}
