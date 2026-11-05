const { test, expect, devices } = require("@playwright/test");

async function offline(page) {
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return url.hostname === "127.0.0.1" ? route.continue() : route.abort();
  });
}

function trackErrors(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices["iPhone 13"];
const iphone = { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch, colorScheme: "dark" };

async function swipe(page, from, to, ms = 120) {
  const cdp = await page.context().newCDPSession(page);
  const steps = 6;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [from] });
  for (let i = 1; i <= steps; i++) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps }],
    });
    await page.waitForTimeout(ms / steps);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

async function center(page, selector) {
  const box = await page.locator(selector).boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, box };
}

test.describe("Snake on desktop", () => {
  test.beforeEach(async ({ page }) => {
    await offline(page);
  });

  test("keys before the game starts do not throw, and typing in search does not start it", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto("/tools/snake/");
    await page.locator("#site-search input[name='q']").fill("wasd space");
    await page.locator("#site-search input[name='q']").press("Space");
    expect(await page.evaluate(() => SnakeGame.mode)).toBe("ready");
    await page.locator("body").click({ position: { x: 5, y: 300 } });
    await page.keyboard.press("p");
    await page.keyboard.press("ArrowLeft");
    expect(errors).toEqual([]);
    expect(await page.evaluate(() => SnakeGame.mode)).toBe("playing");
    expect(await page.evaluate(() => SnakeGame.engine.state.dir)).toEqual({ x: -1, y: 0 });
  });

  test("pace defaults to relaxed, is selectable, persists, and changes the speed", async ({ page }) => {
    await page.goto("/tools/snake/");
    const speed = () => page.evaluate(() => SnakeGame.engine.speed());
    expect(await page.evaluate(() => SnakeGame.engine.pace)).toBe("relaxed");
    const relaxed = await speed();
    expect(relaxed).toBeGreaterThan(200);
    await page.locator("#pace label", { hasText: "Fast" }).click();
    expect(await speed()).toBeLessThan(relaxed);
    await page.reload();
    expect(await page.evaluate(() => SnakeGame.engine.pace)).toBe("fast");
    await expect(page.locator("#pace input[value=fast]")).toBeChecked();
  });

  test("the snake moves, turns, pauses and resumes", async ({ page }) => {
    await page.goto("/tools/snake/");
    await page.locator("#pace label", { hasText: "Fast" }).click();
    await page.locator("#play-btn").click();
    const head = () => page.evaluate(() => ({ ...SnakeGame.engine.state.snake[0] }));
    const a = await head();
    await page.waitForTimeout(450);
    expect((await head()).x).toBeGreaterThan(a.x);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowLeft");
    await page.waitForTimeout(500);
    const turned = await head();
    expect(turned.y).toBeGreaterThan(a.y);
    await page.keyboard.press("Space");
    await expect(page.locator("#overlay-title")).toHaveText("Paused");
    const frozen = await head();
    await page.waitForTimeout(500);
    expect(await head()).toEqual(frozen);
    await page.locator("#play-btn").click();
    await page.waitForTimeout(400);
    expect(await head()).not.toEqual(frozen);
  });

  test("losing the window pauses the game", async ({ page }) => {
    await page.goto("/tools/snake/");
    await page.locator("#play-btn").click();
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    expect(await page.evaluate(() => SnakeGame.mode)).toBe("paused");
  });

  test("a game over cannot be skipped by a stray key, then restarts", async ({ page }) => {
    await page.goto("/tools/snake/");
    await page.locator("#pace label", { hasText: "Fast" }).click();
    await page.locator("#play-btn").click();
    await page.evaluate(() => { SnakeGame.engine.state.obstacles = []; });
    const stillOver = await page.evaluate(() => new Promise((resolve) => {
      const timer = setInterval(() => {
        if (SnakeGame.mode !== "over") return;
        clearInterval(timer);
        document.getElementById("play-btn").click();
        resolve(SnakeGame.mode);
      }, 2);
    }));
    expect(stillOver).toBe("over");
    await page.waitForTimeout(500);
    await page.locator("#play-btn").focus();
    await page.keyboard.press("Enter");
    expect(await page.evaluate(() => SnakeGame.mode)).toBe("playing");
    expect(await page.evaluate(() => SnakeGame.engine.state.score)).toBe(0);
  });
});

test.describe("Snake on a phone", () => {
  test.use(iphone);
  test.beforeEach(async ({ page }) => {
    await offline(page);
  });

  test("everything fits, nothing scrolls sideways, and the page still scrolls by touch", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto("/tools/snake/");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    const blocked = await page.evaluate(() => {
      const e = new TouchEvent("touchmove", { cancelable: true, bubbles: true });
      document.querySelector("main").dispatchEvent(e);
      return e.defaultPrevented;
    });
    expect(blocked).toBe(false);
    await expect(page.locator(".snake-pad")).toBeVisible();
    await page.locator("#play-btn").tap();
    await page.waitForTimeout(700);
    const viewport = page.viewportSize();
    for (const sel of ["#board", ".snake-pad", "#pause-btn", "#score"]) {
      const box = await page.locator(sel).boundingBox();
      expect(box.x, sel).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, sel).toBeLessThanOrEqual(viewport.width + 0.5);
      expect(box.y + box.height, `${sel} fits vertically`).toBeLessThanOrEqual(viewport.height + 0.5);
    }
    expect(errors).toEqual([]);
  });

  test("the on-screen buttons steer the snake", async ({ page }) => {
    await page.goto("/tools/snake/");
    await page.locator("#play-btn").tap();
    await page.locator('[data-dir="down"]').tap();
    await expect.poll(() => page.evaluate(() => SnakeGame.engine.state.dir.y)).toBe(1);
    await page.locator('[data-dir="left"]').tap();
    await expect.poll(() => page.evaluate(() => SnakeGame.engine.state.dir.x)).toBe(-1);
  });

  test("swiping on the board steers the snake, repeatedly in one touch", async ({ page }) => {
    await page.goto("/tools/snake/");
    await page.locator("#play-btn").tap();
    await page.waitForTimeout(500);
    const { x, y } = await center(page, "#canvas");
    await swipe(page, { x, y }, { x, y: y + 90 });
    await expect.poll(() => page.evaluate(() => SnakeGame.engine.state.dir.y)).toBe(1);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + 60, y }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + 60, y: y - 60 }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect.poll(() => page.evaluate(() => SnakeGame.engine.state.dir)).toEqual({ x: 0, y: -1 });
  });

  test("a swipe that ends on the game-over card does not restart the game", async ({ page }) => {
    await page.goto("/tools/snake/");
    await page.locator("#pace label", { hasText: "Fast" }).tap();
    await page.locator("#play-btn").tap();
    await page.evaluate(() => { SnakeGame.engine.state.obstacles = []; });
    await expect.poll(() => page.evaluate(() => SnakeGame.mode), { timeout: 8000 }).toBe("over");
    const { x, y } = await center(page, "#canvas");
    await swipe(page, { x, y }, { x: x + 80, y });
    expect(await page.evaluate(() => SnakeGame.mode)).toBe("over");
  });
});

test.describe("Tetris on desktop", () => {
  test.beforeEach(async ({ page }) => {
    await offline(page);
  });

  test("the keyboard moves, rotates, holds, hard-drops and pauses", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto("/tools/tetris/");
    await page.locator("#play-btn").click();
    const piece = () => page.evaluate(() => ({ ...TetrisGame.engine.state.piece }));
    const first = await piece();
    await page.keyboard.press("ArrowLeft");
    expect((await piece()).x).toBe(first.x - 1);
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    expect((await piece()).x).toBe(first.x + 1);
    await page.keyboard.press("ArrowUp");
    if (first.type !== "O") expect((await piece()).rot).toBe(1);
    await page.keyboard.press("c");
    expect(await page.evaluate(() => TetrisGame.engine.state.hold)).toBe(first.type);
    await page.keyboard.press("Space");
    expect(await page.evaluate(() => TetrisGame.engine.state.board.flat().filter(Boolean).length)).toBe(4);
    await page.keyboard.press("p");
    await expect(page.locator("#overlay-title")).toHaveText("Paused");
    const y = (await piece()).y;
    await page.waitForTimeout(400);
    expect((await piece()).y).toBe(y);
    await page.keyboard.press("p");
    expect(await page.evaluate(() => TetrisGame.mode)).toBe("playing");
    expect(errors).toEqual([]);
  });

  test("holding an arrow key repeats movement to the wall; pieces never change shape", async ({ page }) => {
    await page.goto("/tools/tetris/");
    await page.locator("#play-btn").click();
    await page.keyboard.down("ArrowLeft");
    await page.waitForTimeout(900);
    await page.keyboard.up("ArrowLeft");
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press("ArrowUp");
      const ok = await page.evaluate(() => {
        const p = TetrisGame.engine.state.piece;
        const cells = TetrisEngine.cellsOf(p);
        return cells.length === 4 && cells.every((c) => c.x >= 0 && c.x < 10);
      });
      expect(ok).toBe(true);
    }
  });

  test("keys typed into the search box do not play the game", async ({ page }) => {
    await page.goto("/tools/tetris/");
    await page.locator("#play-btn").click();
    const before = await page.evaluate(() => TetrisGame.engine.state.piece.x);
    await page.locator("#site-search input[name='q']").focus();
    await page.keyboard.type("add");
    expect(await page.evaluate(() => TetrisGame.engine.state.piece.x)).toBe(before);
  });
});

test.describe("Tetris on a phone", () => {
  test.use(iphone);
  test.beforeEach(async ({ page }) => {
    await offline(page);
  });

  test("the board, stats and controls fit on one screen and the page is not scroll-locked", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto("/tools/tetris/");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    const blocked = await page.evaluate(() => {
      const e = new TouchEvent("touchmove", { cancelable: true, bubbles: true });
      document.querySelector("main").dispatchEvent(e);
      return e.defaultPrevented;
    });
    expect(blocked).toBe(false);
    await page.locator("#play-btn").tap();
    await page.waitForTimeout(700);
    const viewport = page.viewportSize();
    for (const sel of ["#board", ".tetris-pad", "#score", "#hold-canvas", "#next-canvas"]) {
      const box = await page.locator(sel).boundingBox();
      expect(box.x, sel).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, sel).toBeLessThanOrEqual(viewport.width + 0.5);
      expect(box.y, `${sel} top`).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height, `${sel} fits vertically`).toBeLessThanOrEqual(viewport.height + 0.5);
    }
    const board = await page.locator("#board").boundingBox();
    expect(board.width).toBeGreaterThan(180);
    expect(errors).toEqual([]);
  });

  test("buttons move, rotate, hold and drop", async ({ page }) => {
    await page.goto("/tools/tetris/");
    await page.locator("#play-btn").tap();
    const piece = () => page.evaluate(() => ({ ...TetrisGame.engine.state.piece }));
    const first = await piece();
    await page.locator('[data-act="left"]').tap();
    await expect.poll(async () => (await piece()).x).toBe(first.x - 1);
    await page.locator('[data-act="right"]').tap();
    await expect.poll(async () => (await piece()).x).toBe(first.x);
    if (first.type !== "O") {
      await page.locator('[data-act="rotate"]').tap();
      await expect.poll(async () => (await piece()).rot).toBe(1);
    }
    await page.locator('[data-act="hold"]').tap();
    expect(await page.evaluate(() => TetrisGame.engine.state.hold)).toBe(first.type);
    await page.locator('[data-act="drop"]').tap();
    expect(await page.evaluate(() => TetrisGame.engine.state.board.flat().filter(Boolean).length)).toBe(4);
    await page.locator("#pause-btn").tap();
    expect(await page.evaluate(() => TetrisGame.mode)).toBe("paused");
  });

  test("touch gestures: tap rotates, drag moves, flick down hard-drops", async ({ page }) => {
    await page.goto("/tools/tetris/");
    await page.locator("#play-btn").tap();
    const piece = () => page.evaluate(() => ({ ...TetrisGame.engine.state.piece }));
    const { x, y, box } = await center(page, "#canvas");
    const cell = box.width / 10;
    const first = await piece();
    await swipe(page, { x, y }, { x: x + cell * 3 + 4, y }, 160);
    await expect.poll(async () => (await piece()).x).toBeGreaterThan(first.x);
    if (first.type !== "O") {
      const rot = (await piece()).rot;
      await page.touchscreen.tap(x, y);
      await expect.poll(async () => (await piece()).rot).toBe((rot + 1) % 4);
    }
    await swipe(page, { x, y: y - 40 }, { x, y: y + cell * 5 }, 90);
    await expect.poll(() => page.evaluate(() => TetrisGame.engine.state.board.flat().filter(Boolean).length)).toBe(4);
  });
});

for (const game of [
  { name: "Snake", path: "/tools/snake/", api: "SnakeGame", pad: ".snake-pad", stats: "#score" },
  { name: "Tetris", path: "/tools/tetris/", api: "TetrisGame", pad: ".tetris-pad", stats: "#score" },
]) {
  test.describe(`${game.name} full screen on desktop`, () => {
    test.beforeEach(async ({ page }) => {
      await offline(page);
    });

    test("the button and the F key toggle it, and the game fills the window", async ({ page }) => {
      const errors = trackErrors(page);
      await page.goto(game.path);
      const frame = page.locator("#game-frame");
      await expect(page.locator("#fs-btn")).toHaveAttribute("aria-pressed", "false");
      await page.locator("#fs-btn").click();
      await expect(frame).toHaveClass(/is-fullscreen/);
      await expect(page.locator("#fs-btn")).toHaveAttribute("aria-pressed", "true");
      await expect(page.locator("body")).toHaveClass(/arcade-locked/);
      const vp = page.viewportSize();
      const box = await frame.boundingBox();
      expect(box).toMatchObject({ x: 0, y: 0 });
      expect(Math.round(box.width)).toBe(vp.width);
      expect(Math.round(box.height)).toBe(vp.height);
      await page.locator("#play-btn").click();
      await page.waitForTimeout(400);
      for (const sel of ["#board", game.stats]) {
        const b = await page.locator(sel).boundingBox();
        expect(b.y, `${sel} top`).toBeGreaterThanOrEqual(0);
        expect(b.y + b.height, `${sel} bottom`).toBeLessThanOrEqual(vp.height + 0.5);
      }
      const board = await page.locator("#board").boundingBox();
      expect(board.height).toBeGreaterThan(vp.height * 0.6);
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
      await page.keyboard.press("f");
      await expect(frame).not.toHaveClass(/is-fullscreen/);
      await expect(page.locator("body")).not.toHaveClass(/arcade-locked/);
      await page.keyboard.press("f");
      await expect(frame).toHaveClass(/is-fullscreen/);
      expect(errors).toEqual([]);
    });

    test("entering full screen keeps a running game running", async ({ page }) => {
      await page.goto(game.path);
      await page.locator("#play-btn").click();
      await page.locator("#fs-btn").click();
      await page.waitForTimeout(300);
      expect(await page.evaluate((api) => window[api].mode, game.api)).toBe("playing");
    });
  });

  test.describe(`${game.name} full screen on a phone`, () => {
    test.use(iphone);
    test.beforeEach(async ({ page }) => {
      await offline(page);
    });

    test("pressing Play goes full screen, fits, cannot scroll away, and Exit sticks", async ({ page }) => {
      const errors = trackErrors(page);
      await page.goto(game.path);
      await expect(page.locator("#game-frame")).not.toHaveClass(/is-fullscreen/);
      await page.locator("#play-btn").tap();
      await expect(page.locator("#game-frame")).toHaveClass(/is-fullscreen/);
      await page.waitForTimeout(400);
      const vp = page.viewportSize();
      const frame = await page.locator("#game-frame").boundingBox();
      expect(frame).toMatchObject({ x: 0, y: 0 });
      expect(Math.round(frame.width)).toBe(vp.width);
      for (const sel of ["#board", game.pad, "#pause-btn", "#fs-btn", game.stats]) {
        const b = await page.locator(sel).boundingBox();
        expect(b.x, `${sel} left`).toBeGreaterThanOrEqual(0);
        expect(b.x + b.width, `${sel} right`).toBeLessThanOrEqual(vp.width + 0.5);
        expect(b.y, `${sel} top`).toBeGreaterThanOrEqual(0);
        expect(b.y + b.height, `${sel} bottom`).toBeLessThanOrEqual(vp.height + 0.5);
      }
      const fs = await page.locator("#fs-btn").boundingBox();
      expect(Math.min(fs.width, fs.height)).toBeGreaterThanOrEqual(40);
      await page.evaluate(() => window.scrollTo(0, 500));
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
      expect(await page.evaluate((api) => window[api].mode, game.api)).toBe("playing");

      await page.locator("#fs-btn").tap();
      await expect(page.locator("#game-frame")).not.toHaveClass(/is-fullscreen/);
      await page.locator("#pause-btn").tap();
      await page.locator("#play-btn").tap();
      await page.waitForTimeout(200);
      await expect(page.locator("#game-frame")).not.toHaveClass(/is-fullscreen/);
      expect(errors).toEqual([]);
    });
  });
}
