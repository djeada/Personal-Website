const { test, expect } = require("@playwright/test");

const tool = "/tools/learn_to_read/";
const key = "phonicsAdventure.v4";
const save = (page) => page.evaluate((storageKey) => JSON.parse(localStorage.getItem(storageKey)), key);
const exact = (text) => new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);

// Keep these tests independent of third-party ads, fonts, and analytics.
test.beforeEach(async ({ page }) => {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1(?::|\/))/, (route) => route.abort());
});

async function start(page, { muted = true } = {}) {
  await page.goto(tool, { waitUntil: "domcontentloaded" });
  await expect(page.locator(".pa-path-tab")).toHaveCount(3);
  if (muted) await page.locator("#sound-toggle").click();
}
async function unlockAll(page) {
  await page.locator("#grownups summary").click();
  await page.locator("#unlock-all").check();
}
const taskType = (page) => page.locator("#stage").evaluate((stage) => (stage.className.match(/pa-task-(\w+)/) || [])[1]);

// Answers whatever task is on screen correctly, checks it offered real choices, and waits for the next one.
async function solve(page) {
  const type = await taskType(page);
  const before = await page.locator("#play-progress").getAttribute("aria-valuenow");
  if (type === "build" || type === "order") {
    const target = (await page.locator("#slots").getAttribute("data-target")).split("|");
    for (const piece of target) await page.locator(".pa-tile:not(:disabled)").filter({ hasText: exact(piece) }).first().click();
  } else if (type === "hunt") {
    await expect(page.locator(".pa-hunt-cell")).toHaveCount(8);
    for (const cell of await page.locator(".pa-hunt-cell[data-answer='true']").all()) await cell.click();
  } else {
    if (type !== "story") {
      await expect(page.locator("#stage [data-option]"), `${type} offers three choices`).toHaveCount(3);
      const options = await page.locator("#stage [data-option]").evaluateAll((nodes) => nodes.map((node) => node.dataset.option));
      expect(new Set(options).size, type).toBe(3);
    }
    await page.locator("#stage [data-answer='true']").first().click();
  }
  await expect(page.locator("#play-progress")).not.toHaveAttribute("aria-valuenow", before, { timeout: 8000 });
  return type;
}
async function playLevel(page) {
  const types = [];
  while ((await taskType(page)) !== "reward") types.push(await solve(page));
  return types;
}
async function openLevel(page, path, level) {
  await page.locator(`[data-path="${path}"]`).click();
  await page.locator(`[data-level="${level}"]`).click();
  await expect(page.locator("#play")).toBeVisible();
}

test("the letters path starts with capitals, rewards three stars and unlocks the next level", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await start(page);
  await expect(page.locator(".pa-path-tab[aria-selected='true']")).toHaveAttribute("data-path", "letters");
  await expect(page.locator(".pa-node.is-current")).toHaveCount(1);
  await page.locator("#play-next").click();
  await expect(page.locator(".pa-big-letter")).toHaveText("S");
  await expect(page.locator(".pa-letter-option")).toHaveCount(3);
  const types = await playLevel(page);
  expect(types.slice(0, 3)).toEqual(["meet", "meet", "meet"]);
  expect(types).toContain("hunt");
  await expect(page.locator(".pa-stars-big i.is-on")).toHaveCount(3);
  await expect(page.locator(".pa-reward-sticker")).toBeVisible();
  expect((await save(page)).journeys.en.paths.letters).toEqual({ 0: 3 });
  await page.locator("#reward-map").click();
  await expect(page.locator(".pa-node").nth(1)).toHaveClass(/is-current/);
  await expect(page.locator("#sticker-book .pa-sticker.is-won")).toHaveCount(1);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("#play-next-label")).toContainText("Play level 2");
  expect(errors).toEqual([]);
});

test("a new letter is shown, named and found on one page, with a glowing hint after two misses", async ({ page }) => {
  await start(page);
  await page.locator("#play-next").click();
  await expect(page.locator("#meet-picture")).toBeVisible();
  const wrong = page.locator(".pa-letter-option[data-answer='false']");
  await wrong.nth(0).click();
  await wrong.nth(1).click();
  await expect(page.locator(".pa-letter-option[data-answer='true']")).toHaveClass(/is-hint/);
  await playLevel(page);
  await expect(page.locator(".pa-stars-big i.is-on")).toHaveCount(2);
  expect((await save(page)).journeys.en.stats.s.w).toBe(1);
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

test("small letters arrive after the capitals and later levels use lowercase", async ({ page }) => {
  await start(page);
  await unlockAll(page);
  await openLevel(page, "letters", 10);
  await expect(page.locator(".pa-big-letter")).toHaveText(/^[A-Z]+$/);
  const options = await page.locator(".pa-letter-option").allTextContents();
  options.forEach((option) => expect(option).toBe(option.toLowerCase()));
  await page.locator("#close-play").click();
  await openLevel(page, "letters", 13);
  await expect(page.locator(".pa-big-letter")).toHaveText("Sh sh");
  await page.locator("#close-play").click();
  await openLevel(page, "words", 0);
  await expect(page.locator("#stage")).toContainText(/[A-Z]/);
  expect(await page.locator("#stage").innerText()).not.toMatch(/[a-z]/);
  await page.locator("#close-play").click();
  await openLevel(page, "stories", 4);
  const tiles = await page.locator(".pa-tile").allTextContents();
  expect(tiles.some((tile) => /[a-z]/.test(tile))).toBe(true);
});

test("word building returns wrong tiles, accepts the keyboard and fills missing letters", async ({ page }) => {
  await start(page);
  await unlockAll(page);
  await openLevel(page, "words", 4);
  const seen = new Set();
  for (let guard = 0; guard < 30 && !(seen.has("build") && seen.has("missing")); guard += 1) {
    const type = await taskType(page);
    if (type === "reward") { await page.locator("#reward-again").click(); continue; }
    const before = await page.locator("#play-progress").getAttribute("aria-valuenow");
    if (type === "build" && !seen.has("build")) {
      seen.add("build");
      const target = (await page.locator("#slots").getAttribute("data-target")).split("|");
      for (const tile of [...target].reverse()) await page.locator(".pa-tile:not(:disabled)").filter({ hasText: exact(tile) }).first().click();
      if (target.join("") !== [...target].reverse().join("")) {
        await expect(page.locator(".pa-slot.is-wrong").first()).toBeVisible();
        await expect(page.locator(".pa-slot:not(.is-filled)").first()).toBeVisible({ timeout: 3000 });
        await page.locator(".pa-slot.is-filled").evaluateAll((slots) => slots.forEach((slot) => slot.click()));
        await page.keyboard.type(target.join("").toLowerCase());
        await expect(page.locator(".pa-slot.is-right")).toHaveCount(target.length);
      }
    } else if (type === "missing" && !seen.has("missing")) {
      seen.add("missing");
      await expect(page.locator("#missing-slot")).toHaveText("");
      await page.locator(".pa-letter-option[data-answer='true']").click();
      await expect(page.locator("#missing-slot")).not.toHaveText("");
    } else {
      await solve(page);
      continue;
    }
    await expect(page.locator("#play-progress")).not.toHaveAttribute("aria-valuenow", before, { timeout: 8000 });
  }
  expect([...seen].sort()).toEqual(["build", "missing"]);
});

test("in capitals, tiles that look the same are interchangeable (MAMA, THE ... THE)", async ({ page }) => {
  await start(page);
  await page.locator('[data-language="de"]').click();
  await unlockAll(page);
  for (let run = 0; run < 3; run += 1) {
    await openLevel(page, "words", 0);
    await playLevel(page);
    await page.locator("#reward-map").click();
  }
});

test("stories read along, ask questions about what happened and finish with stars", async ({ page }) => {
  await start(page);
  await unlockAll(page);
  await openLevel(page, "stories", 1);
  await expect(page.locator(".pa-sentence")).toHaveText("A DOG SAT.");
  await page.locator(".pa-word[data-answer='false']").first().click();
  await expect(page.locator(".pa-word[data-answer='true']")).toBeEnabled();
  const types = await playLevel(page);
  expect(types).toEqual(["story", "story", "story", "question", "question"]);
  await expect(page.locator(".pa-stars-big i.is-on")).toHaveCount(3);
});

test("sentence levels match pictures, fill gaps and put words in order", async ({ page }) => {
  await start(page);
  await unlockAll(page);
  for (const [level, type] of [[0, "sentencePic"], [2, "cloze"], [4, "order"]]) {
    await openLevel(page, "stories", level);
    const types = await playLevel(page);
    expect(new Set(types)).toEqual(new Set([type]));
    await page.locator("#reward-map").click();
  }
});

test("every level of every path in both languages can be played to the end", async ({ page }) => {
  test.setTimeout(1500000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await start(page);
  for (const language of ["en", "de"]) {
    await page.locator(`[data-language="${language}"]`).click();
    for (const path of ["letters", "words", "stories"]) {
      await page.locator(`[data-path="${path}"]`).click();
      const count = await page.locator(".pa-node").count();
      for (let level = 0; level < count; level += 1) {
        await page.locator("#play-next").click();
        await playLevel(page);
        await page.locator("#reward-map").click();
      }
      await expect(page.locator(".pa-node.is-done")).toHaveCount(count);
    }
  }
  expect(errors).toEqual([]);
});

test("languages keep separate progress and resetting one keeps the other", async ({ page }) => {
  await start(page);
  await page.locator("#play-next").click();
  await playLevel(page);
  await page.locator("#reward-map").click();
  await page.locator('[data-language="de"]').click();
  await expect(page.locator("#phonics-app")).toHaveAttribute("lang", "de");
  await expect(page.locator("#stat-stars")).toHaveText("0");
  await page.locator("#play-next").click();
  await expect(page.locator(".pa-big-letter")).toHaveText("M");
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
  expect(saved.journeys.de.paths.letters).toEqual({});
  expect(saved.journeys.en.paths.letters).toEqual({ 0: 3 });
});

test("progress from earlier versions carries over into the new paths", async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("phonicsAdventure.v3", JSON.stringify({
      version: 3, language: "en", journeys: { en: { done: { 0: 3, 1: 3, 2: 2, 3: 3, 4: 3, 5: 3 }, stats: { s: { c: 4, w: 1 } } }, de: { done: {} } }
    }));
  });
  await page.goto(tool, { waitUntil: "domcontentloaded" });
  const saved = await save(page);
  expect(saved.journeys.en.paths.letters).toEqual({ 0: 2, 1: 2, 2: 2 });
  expect(saved.journeys.en.paths.words).toEqual({ 0: 2, 1: 2 });
  expect(saved.journeys.en.paths.stories).toEqual({ 1: 2 });
  expect(saved.journeys.en.stats.s).toEqual({ c: 4, w: 1 });
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("phonicsAdventure.v2", JSON.stringify({ version: 2, language: "en", journeys: { en: { sounds: ["s", "a", "t", "p", "i", "n"], words: ["pin", "tin"] } } }));
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  expect((await save(page)).journeys.en.paths.letters).toEqual({ 0: 2, 1: 2 });
});

for (const broken of ["invalid-json", "invalid-shape", "unavailable-storage", "no-audio"]) {
  test(`play works with ${broken}`, async ({ page }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(({ kind, storageKey }) => {
      if (kind === "invalid-json") localStorage.setItem(storageKey, "{");
      if (kind === "invalid-shape") localStorage.setItem(storageKey, JSON.stringify({ version: 4, path: "nowhere", language: "xx", journeys: { en: { paths: { letters: { 0: 99, 50: 2, "<x>": 1 }, words: null }, stats: { s: null, a: { c: -4 } } } } }));
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

test("narration plays recorded clips in order and letters are spoken by name", async ({ page }) => {
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
  await expect.poll(() => page.evaluate(() => window.played.join(" "))).toBe("en/line-sounds.mp3 en/in-s.mp3 en/line-findit.mp3");
  await page.locator("#meet-letter").click();
  await expect.poll(() => page.evaluate(() => window.played.at(-1))).toBe("en/ph-s.mp3");
  await page.locator("#replay").click();
  await expect.poll(() => page.evaluate(() => window.played.slice(-2).join(" "))).toBe("en/in-s.mp3 en/line-findit.mp3");
  await page.locator(".pa-letter-option[data-answer='true']").click();
  await expect.poll(() => page.evaluate(() => window.played.slice(-2).join(" "))).toMatch(/^en\/ph-s\.mp3 en\/line-praise\d\.mp3$/);
});

test("every clip, picture and answer the game needs exists", async ({ page, request }) => {
  await page.goto(tool, { waitUntil: "domcontentloaded" });
  const needed = await page.evaluate(() => {
    const issues = [];
    const files = new Set();
    const pictures = new Set(window.PhonicsContent.stickers.concat(["trophy", "lock", "openbook"]));
    for (const code of ["en", "de"]) {
      const lang = window.PhonicsContent[code];
      const clips = window.PhonicsAudio[code];
      const key = (word) => word.toLocaleLowerCase().replace(/[^\p{L}]/gu, "");
      const need = (id) => { if (!clips[id]) issues.push(`${code} missing ${id}`); else files.add(`${code}/${clips[id][0]}`); };
      const picture = (word) => {
        const pic = Object.entries(lang.pictures).find(([w]) => key(w) === key(word))?.[1];
        if (!pic) issues.push(`${code} no picture for ${word}`);
        else pictures.add(pic);
      };
      Object.keys(lang.pictures).forEach((word) => { need(`w:${key(word)}`); picture(word); });
      Object.entries(lang.sounds).forEach(([grapheme, [example]]) => { need(`in:${grapheme}`); need(`ph:${grapheme}`); picture(example); });
      Object.keys(lang.lines).forEach((name) => need(`line:${name}`));
      lang.sentences.forEach((item, i) => {
        need(`sn:${i}`); need(`cz:${i}`); picture(item.answer);
        const words = item.text.split(/\s+/).map(key);
        words.forEach((word) => need(`w:${word}`));
        if (words.filter((word) => word === key(item.answer)).length !== 1) issues.push(`${code} ${item.text}`);
        if (clips[`sn:${i}`]?.[2]?.length !== words.length) issues.push(`${code} timings sn:${i}`);
      });
      for (const [id, story] of Object.entries(lang.stories)) {
        pictures.add(story.cover);
        story.questions.forEach((item, i) => { need(`q:${id}:${i}`); [item.answer, ...item.others].forEach(picture); });
        story.pages.forEach((page, i) => {
          need(`st:${id}:${i}`);
          page.pics.forEach((pic) => pictures.add(pic));
          const words = page.text.split(/\s+/).map(key);
          words.forEach((word) => need(`w:${word}`));
          if (words.filter((word) => word === key(page.target)).length !== 1) issues.push(`${code} ${page.text}`);
          if (clips[`st:${id}:${i}`]?.[2]?.length !== words.length) issues.push(`${code} timings ${id}:${i}`);
        });
      }
      for (const [path, def] of Object.entries(lang.paths)) {
        for (const level of def.levels) {
          if (level.kind === "words") level.items.split(" ").forEach(picture);
          if (level.kind === "letters" || level.kind === "small") level.items.split(" ").forEach((item) => { if (!lang.sounds[item]) issues.push(`${code} ${path} no letter ${item}`); });
          if (level.kind === "story" && !lang.stories[level.story]) issues.push(`${code} no story ${level.story}`);
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
  test(`paths and every task type fit small and large screens in ${dark ? "dark" : "light"} mode`, async ({ page, context }) => {
    test.setTimeout(300000);
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
      for (const [path, level] of [["letters", 0], ["letters", 13], ["words", 9], ["stories", 0], ["stories", 2], ["stories", 4], ["stories", 1]]) {
        await openLevel(page, path, level);
        const seen = new Set();
        for (let step = 0; step < 5 && (await taskType(page)) !== "reward"; step += 1) {
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
