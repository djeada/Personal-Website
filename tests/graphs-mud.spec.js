const { test, expect } = require("@playwright/test");

// Weighted "mud" cells in the graphs tool's grid mode (course section 6, beat 1).
// The filmed grid: the course maze settings with 20% mud on seed 82, where BFS walks
// straight down a strip of mud and Dijkstra takes a longer, cheaper way round.
const MUD_GRID = "size=15&density=25&mud=20&seed=82";
const MUD_COST = 5;

async function openGraphs(page, query) {
  await page.route(/google|googlesyndication/, (route) => route.abort());
  await page.goto(`/tools/graphs/${query}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.GraphsDebug && document.getElementById("maze-canvas").dataset.state === "idle");
}

const snapshot = (page) => page.evaluate(() => window.GraphsDebug.snapshot());

async function runToEnd(page) {
  await page.click("#start");
  await expect(page.locator("#maze-canvas")).toHaveAttribute("data-state", "done", { timeout: 20_000 });
  return snapshot(page);
}

async function selectAlgorithm(page, algo) {
  await page.selectOption("#algorithm", algo);
  await expect(page.locator("#maze-canvas")).toHaveAttribute("data-algorithm", algo);
}

function neighbours(walls, [r, c]) {
  const n = walls.length;
  return [[r - 1, c], [r, c + 1], [r + 1, c], [r, c - 1]].filter(
    ([y, x]) => y >= 0 && x >= 0 && y < n && x < n && walls[y][x] !== "#",
  );
}

const stepCost = (mud, [r, c]) => (mud[r][c] === "~" ? MUD_COST : 1);
const pathCost = (mud, path) => path.slice(1).reduce((total, cell) => total + stepCost(mud, cell), 0);
const mudOnPath = (mud, path) => path.slice(1).filter(([r, c]) => mud[r][c] === "~").length;

// Independent references: fewest steps (BFS) and cheapest cost (Dijkstra, O(V^2) scan).
function fewestSteps(walls, start, end) {
  const n = walls.length;
  const dist = Array.from({ length: n }, () => Array(n).fill(null));
  dist[start[0]][start[1]] = 0;
  const queue = [start];
  for (let head = 0; head < queue.length; head++) {
    const cell = queue[head];
    for (const [y, x] of neighbours(walls, cell)) {
      if (dist[y][x] === null) {
        dist[y][x] = dist[cell[0]][cell[1]] + 1;
        queue.push([y, x]);
      }
    }
  }
  return dist[end[0]][end[1]];
}

function cheapestCost(walls, mud, start, end) {
  const n = walls.length;
  const dist = Array.from({ length: n }, () => Array(n).fill(Infinity));
  const done = Array.from({ length: n }, () => Array(n).fill(false));
  dist[start[0]][start[1]] = 0;
  for (;;) {
    let best = null;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (!done[r][c] && dist[r][c] < Infinity && (!best || dist[r][c] < dist[best[0]][best[1]])) best = [r, c];
      }
    }
    if (!best) return null;
    if (best[0] === end[0] && best[1] === end[1]) return dist[end[0]][end[1]];
    done[best[0]][best[1]] = true;
    for (const next of neighbours(walls, best)) {
      const alt = dist[best[0]][best[1]] + stepCost(mud, next);
      if (alt < dist[next[0]][next[1]]) dist[next[0]][next[1]] = alt;
    }
  }
}

function expectValidPath(walls, path, start, end) {
  expect(path[0]).toEqual(start);
  expect(path[path.length - 1]).toEqual(end);
  for (let i = 1; i < path.length; i++) {
    const [r1, c1] = path[i - 1];
    const [r2, c2] = path[i];
    expect(Math.abs(r1 - r2) + Math.abs(c1 - c2)).toBe(1);
    expect(walls[r2][c2]).toBe(".");
  }
}

test.describe("graphs tool: mud cells", () => {
  test("mud is placed from the seed, only on open cells, and never moves the walls", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await openGraphs(page, `?algo=bfs&${MUD_GRID}`);
    const first = await snapshot(page);
    await expect(page.locator("#mud-density")).toHaveValue("20");
    await expect(page.locator("#mud-density-value")).toHaveText("20%");

    const mudCells = first.mud.join("").split("").filter((ch) => ch === "~").length;
    const openCells = first.walls.join("").split("").filter((ch) => ch === ".").length;
    // 20% of the open cells other than start and end, rounded.
    expect(mudCells).toBe(Math.round((openCells - 2) * 0.2));
    first.mud.forEach((row, r) => [...row].forEach((ch, c) => {
      if (ch === "~") expect(first.walls[r][c]).toBe(".");
    }));
    expect(first.mud[first.start[0]][first.start[1]]).toBe(".");
    expect(first.mud[first.end[0]][first.end[1]]).toBe(".");

    // The same URL gives the same mud; switching algorithm keeps it.
    await openGraphs(page, `?algo=dijkstra&${MUD_GRID}`);
    expect((await snapshot(page)).mud).toEqual(first.mud);
    for (const algo of ["astar", "dfs", "multi", "bfs"]) {
      await selectAlgorithm(page, algo);
      expect((await snapshot(page)).mud, `mud after switching to ${algo}`).toEqual(first.mud);
    }

    // Mud has its own random stream: the walls are the plain seed-82 maze.
    await openGraphs(page, "?algo=bfs&size=15&density=25&seed=82");
    const plain = await snapshot(page);
    expect(plain.walls).toEqual(first.walls);
    expect(plain.mud.join("")).not.toContain("~");
    await expect(page.locator('[data-legend-mud]')).toBeHidden();

    // The slider reproduces the URL setup exactly.
    await page.locator("#mud-density").evaluate((input) => {
      input.value = "20";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect((await snapshot(page)).mud).toEqual(first.mud);
    await expect(page.locator('[data-legend-mud]')).toBeVisible();

    // A different seed gives different mud.
    await page.click("#new-maze");
    expect((await snapshot(page)).mud).not.toEqual(first.mud);
    expect(errors).toEqual([]);
  });

  test("on the filmed grid BFS walks through mud and Dijkstra goes round it, longer but cheaper", async ({ page }) => {
    await openGraphs(page, `?algo=bfs&${MUD_GRID}&speed=10`);
    const bfs = await runToEnd(page);
    const steps = fewestSteps(bfs.walls, bfs.start, bfs.end);
    const cheapest = cheapestCost(bfs.walls, bfs.mud, bfs.start, bfs.end);

    expectValidPath(bfs.walls, bfs.path, bfs.start, bfs.end);
    expect(bfs.pathLength).toBe(steps);
    expect(bfs.pathCost).toBe(pathCost(bfs.mud, bfs.path));
    expect(mudOnPath(bfs.mud, bfs.path)).toBeGreaterThanOrEqual(5);
    // The numbers the narration and the stat chips use.
    expect([bfs.pathLength, bfs.pathCost]).toEqual([28, 56]);
    await expect(page.locator("#path-length")).toHaveText("28");
    await expect(page.locator("#path-cost")).toHaveText("56");
    await expect(page.locator("#maze-canvas")).toHaveAttribute("data-path-cost", "56");
    await expect(page.locator("#search-status")).toContainText("fewest steps");

    await selectAlgorithm(page, "dijkstra");
    const dijkstra = await runToEnd(page);
    expect(dijkstra.mud).toEqual(bfs.mud);
    expectValidPath(dijkstra.walls, dijkstra.path, dijkstra.start, dijkstra.end);
    expect(dijkstra.pathCost).toBe(cheapest);
    expect(dijkstra.pathCost).toBe(pathCost(dijkstra.mud, dijkstra.path));
    expect(mudOnPath(dijkstra.mud, dijkstra.path)).toBe(0);
    expect(dijkstra.pathLength).toBeGreaterThan(bfs.pathLength);
    expect(dijkstra.pathCost).toBeLessThan(bfs.pathCost);
    expect([dijkstra.pathLength, dijkstra.pathCost]).toEqual([36, 36]);
    await expect(page.locator("#path-length")).toHaveText("36");
    await expect(page.locator("#path-cost")).toHaveText("36");
    await expect(page.locator("#search-status")).toContainText("cheapest path");

    // A* uses the same costs and finds a path just as cheap.
    await selectAlgorithm(page, "astar");
    const astar = await runToEnd(page);
    expectValidPath(astar.walls, astar.path, astar.start, astar.end);
    expect(astar.pathCost).toBe(cheapest);

    // DFS ignores cost too; its cost stat is still the sum along its path.
    await selectAlgorithm(page, "dfs");
    const dfs = await runToEnd(page);
    expect(dfs.pathCost).toBe(pathCost(dfs.mud, dfs.path));
    expect(dfs.pathCost).toBeGreaterThanOrEqual(cheapest);
  });

  test("without mud Dijkstra matches BFS and the cost equals the length", async ({ page }) => {
    await openGraphs(page, "?algo=dijkstra&size=15&density=25&seed=7&speed=10");
    const dijkstra = await runToEnd(page);
    await selectAlgorithm(page, "bfs");
    const bfs = await runToEnd(page);
    expect(dijkstra.pathLength).toBe(bfs.pathLength);
    expect(dijkstra.pathCost).toBe(dijkstra.pathLength);
    expect(bfs.pathCost).toBe(bfs.pathLength);
    await expect(page.locator("#path-cost-stat")).toBeVisible();
    await selectAlgorithm(page, "islands");
    await expect(page.locator("#path-cost-stat")).toBeHidden();
  });

  test("mud can be painted by clicking, and only multi-source BFS offers sources", async ({ page }) => {
    await openGraphs(page, "?algo=dijkstra&size=10&density=0&seed=1");
    await expect(page.locator("#click-mode-card")).toBeVisible();
    await expect(page.locator('input[name="click-mode"][value="sources"]').locator("xpath=..")).toBeHidden();
    await expect(page.locator('[data-legend-mud]')).toBeHidden();

    await page.locator("#click-mode-card label", { hasText: "Mud" }).click();
    const canvas = page.locator("#maze-canvas");
    const box = await canvas.boundingBox();
    const cell = box.width / 10;
    const at = (r, c) => ({ position: { x: cell * (c + 0.5), y: cell * (r + 0.5) } });

    // A wall of mud across row 5 except the last column: Dijkstra detours, BFS does not care.
    for (let c = 0; c < 9; c++) await canvas.click(at(5, c));
    let state = await snapshot(page);
    expect(state.mud[5]).toBe("~~~~~~~~~.");
    await expect(page.locator('[data-legend-mud]')).toBeVisible();

    // Clicking mud again clears it; start and end are never painted.
    await canvas.click(at(5, 0));
    await canvas.click(at(0, 0));
    state = await snapshot(page);
    expect(state.mud[5]).toBe(".~~~~~~~~.");
    expect(state.mud[0][0]).toBe(".");

    // Painting over a wall turns it into mud.
    await page.locator("#click-mode-card label", { hasText: "Walls" }).click();
    await canvas.click(at(2, 2));
    expect((await snapshot(page)).walls[2][2]).toBe("#");
    await page.locator("#click-mode-card label", { hasText: "Mud" }).click();
    await canvas.click(at(2, 2));
    state = await snapshot(page);
    expect(state.walls[2][2]).toBe(".");
    expect(state.mud[2][2]).toBe("~");

    await page.locator("#speed").evaluate((input) => {
      input.value = "10";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const dijkstra = await runToEnd(page);
    expect(dijkstra.pathCost).toBe(cheapestCost(dijkstra.walls, dijkstra.mud, dijkstra.start, dijkstra.end));

    await selectAlgorithm(page, "multi");
    await expect(page.locator('input[name="click-mode"][value="sources"]').locator("xpath=..")).toBeVisible();
    // Switching away from multi while Sources is picked falls back to Walls.
    await page.locator("#click-mode-card label", { hasText: "Sources" }).click();
    await selectAlgorithm(page, "bfs");
    await expect(page.locator('input[name="click-mode"][value="walls"]')).toBeChecked();
  });
});

test.describe("graphs tool: 0-1 BFS", () => {
  // Minimum Obstacle Removal: entering an open cell costs 0, breaking into a wall costs 1.
  function fewestWalls(walls, start, end) {
    const n = walls.length;
    const dist = Array.from({ length: n }, () => Array(n).fill(Infinity));
    dist[start[0]][start[1]] = 0;
    const deque = [start];
    while (deque.length) {
      const [r, c] = deque.shift();
      for (const [y, x] of [[r - 1, c], [r, c + 1], [r + 1, c], [r, c - 1]]) {
        if (y < 0 || x < 0 || y >= n || x >= n) continue;
        const w = walls[y][x] === "#" ? 1 : 0;
        if (dist[r][c] + w < dist[y][x]) {
          dist[y][x] = dist[r][c] + w;
          if (w) deque.push([y, x]);
          else deque.unshift([y, x]);
        }
      }
    }
    return dist[end[0]][end[1]];
  }

  test("the deque stays sorted with at most two costs, and the answer is the fewest walls", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await openGraphs(page, "?algo=0-1&size=15&density=45&seed=7");
    await expect(page.locator("#algorithm")).toHaveValue("zeroone");
    await expect(page.locator("#deque-panel")).toBeVisible();
    await expect(page.locator("#path-cost-stat")).toBeVisible();
    await expect(page.locator('input[name="click-mode"][value="mud"]').locator("xpath=..")).toBeHidden();

    let sawFront = false;
    let sawBack = false;
    for (let i = 0; i < 40; i++) {
      await page.click("#step");
      await page.waitForFunction(() => ["paused", "done"].includes(document.getElementById("maze-canvas").dataset.state));
      const state = await snapshot(page);
      if (state.state === "done") break;
      const costs = state.deque.map(([, , d]) => d);
      for (let k = 1; k < costs.length; k++) expect(costs[k]).toBeGreaterThanOrEqual(costs[k - 1]);
      if (costs.length) expect(costs[costs.length - 1] - costs[0]).toBeLessThanOrEqual(1);
      if (/to the front/.test(state.status)) sawFront = true;
      if (/to the back/.test(state.status)) sawBack = true;
      await expect(page.locator("#deque-list .deque-item")).toHaveCount(state.deque.length <= 14 ? state.deque.length : 13);
    }
    expect(sawFront && sawBack).toBe(true);

    await page.click("#reset");
    await page.locator("#speed").evaluate((input) => {
      input.value = "10";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const done = await runToEnd(page);
    const walls = done.path.slice(1).filter(([r, c]) => done.walls[r][c] === "#").length;
    expect(done.pathCost).toBe(fewestWalls(done.walls, done.start, done.end));
    expect(done.pathCost).toBe(walls);
    expect(done.pathCost).toBe(2);
    expect(done.path[0]).toEqual(done.start);
    expect(done.path[done.path.length - 1]).toEqual(done.end);
    await expect(page.locator("#path-cost")).toHaveText(String(done.pathCost));
    await expect(page.locator("#search-status")).toContainText("breaks through 2 walls");
    expect(errors).toEqual([]);
  });
});
