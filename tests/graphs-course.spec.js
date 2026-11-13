const { test, expect } = require("@playwright/test");

const graphs = "/tools/graphs/";
const lab = "/tools/data_structures/";

function collectErrors(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

async function openGraphs(page, query) {
  await page.route(/google|googlesyndication/, (route) => route.abort());
  await page.goto(`${graphs}${query}`, { waitUntil: "domcontentloaded" });
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

// Independent grid helpers: plain BFS over the "#"/"." rows the page reports.
function neighbours(walls, [r, c]) {
  const n = walls.length;
  return [[r - 1, c], [r, c + 1], [r + 1, c], [r, c - 1]].filter(
    ([y, x]) => y >= 0 && x >= 0 && y < n && x < n && walls[y][x] !== "#",
  );
}

function distancesFrom(walls, sources) {
  const n = walls.length;
  const dist = Array.from({ length: n }, () => Array(n).fill(null));
  const queue = [];
  for (const [r, c] of sources) {
    if (dist[r][c] === null) {
      dist[r][c] = 0;
      queue.push([r, c]);
    }
  }
  for (let head = 0; head < queue.length; head++) {
    const cell = queue[head];
    for (const [y, x] of neighbours(walls, cell)) {
      if (dist[y][x] === null) {
        dist[y][x] = dist[cell[0]][cell[1]] + 1;
        queue.push([y, x]);
      }
    }
  }
  return dist;
}

function countIslands(walls) {
  const n = walls.length;
  const seen = Array.from({ length: n }, () => Array(n).fill(false));
  let islands = 0;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (walls[r][c] === "#" || seen[r][c]) continue;
      islands += 1;
      const stack = [[r, c]];
      seen[r][c] = true;
      while (stack.length) {
        for (const [y, x] of neighbours(walls, stack.pop())) {
          if (!seen[y][x]) {
            seen[y][x] = true;
            stack.push([y, x]);
          }
        }
      }
    }
  }
  return islands;
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

test.describe("graphs tool", () => {
  test("the same seed gives the same maze across algorithm switches and reloads", async ({ page }) => {
    const errors = collectErrors(page);
    await openGraphs(page, "?algo=bfs&size=15&density=25&seed=7");
    const first = await snapshot(page);
    expect(first.walls).toHaveLength(15);

    for (const algo of ["dfs", "multi", "islands", "dijkstra", "astar", "bfs"]) {
      await selectAlgorithm(page, algo);
      expect((await snapshot(page)).walls, `maze after switching to ${algo}`).toEqual(first.walls);
    }

    // A finished run, then an algorithm switch, keeps the maze and clears only the search.
    await page.locator("#speed").evaluate((input) => {
      input.value = "10";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await runToEnd(page);
    await selectAlgorithm(page, "dfs");
    const cleared = await snapshot(page);
    expect(cleared.walls).toEqual(first.walls);
    expect(cleared.visited).toBe(0);
    expect(cleared.state).toBe("idle");

    await openGraphs(page, "?algo=dfs&size=15&density=25&seed=7");
    expect((await snapshot(page)).walls).toEqual(first.walls);

    await page.click("#new-maze");
    const next = await snapshot(page);
    expect(next.seed).toBe(8);
    expect(next.walls).not.toEqual(first.walls);
    await expect(page.locator("#seed")).toHaveValue("8");
    await page.fill("#seed", "7");
    await page.locator("#seed").dispatchEvent("change");
    expect((await snapshot(page)).walls).toEqual(first.walls);
    expect(errors).toEqual([]);
  });

  test("URL parameters set up the exact state", async ({ page }) => {
    await openGraphs(page, "?algo=multi&size=15&density=25&seed=7&start=2,3&end=12,11&sources=0,0;7,3;14,14&distances=1&speed=9");
    await expect(page.locator("#algorithm")).toHaveValue("multi");
    await expect(page.locator("#grid-size")).toHaveValue("15");
    await expect(page.locator("#wall-density")).toHaveValue("25");
    await expect(page.locator("#seed")).toHaveValue("7");
    await expect(page.locator("#speed")).toHaveValue("9");
    await expect(page.locator("#show-distances")).toBeChecked();
    await expect(page.locator("#level-stat")).toBeVisible();
    await expect(page.locator("#islands-stat")).toBeHidden();
    await expect(page.locator("#click-mode-card")).toBeVisible();
    const state = await snapshot(page);
    expect(state.start).toEqual([2, 3]);
    expect(state.end).toEqual([12, 11]);
    expect(state.sources).toEqual([[0, 0], [7, 3], [14, 14]]);
    for (const [r, c] of [...state.sources, state.start, state.end]) expect(state.walls[r][c]).toBe(".");

    await openGraphs(page, "?algo=islands&seed=3");
    await expect(page.locator("#grid-size")).toHaveValue("12");
    await expect(page.locator("#wall-density")).toHaveValue("55");
    await expect(page.locator("#islands-stat")).toBeVisible();
    await expect(page.locator("#level-stat")).toBeHidden();
    await expect(page.locator("#step-level")).toHaveText("Step island");
  });

  test("BFS finds the true shortest path and DFS never beats it on the same seed", async ({ page }) => {
    for (const seed of [7, 11, 23]) {
      await openGraphs(page, `?algo=bfs&size=15&density=25&seed=${seed}&speed=10`);
      const bfs = await runToEnd(page);
      const truth = distancesFrom(bfs.walls, [bfs.start])[bfs.end[0]][bfs.end[1]];
      if (truth === null) {
        expect(bfs.pathLength).toBe(0);
        continue;
      }
      expect(bfs.pathLength).toBe(truth);
      expect(bfs.path).toHaveLength(truth + 1);
      expectValidPath(bfs.walls, bfs.path, bfs.start, bfs.end);
      await expect(page.locator("#path-length")).toHaveText(String(truth));

      await selectAlgorithm(page, "dfs");
      const dfs = await runToEnd(page);
      expect(dfs.walls).toEqual(bfs.walls);
      expect(dfs.pathLength).toBe(dfs.path.length - 1);
      expectValidPath(dfs.walls, dfs.path, dfs.start, dfs.end);
      expect(bfs.pathLength).toBeLessThanOrEqual(dfs.pathLength);
      await expect(page.locator("#path-length")).toHaveText(String(dfs.pathLength));
    }
  });

  test("BFS steps one dequeue at a time, marks on push and labels levels", async ({ page }) => {
    await openGraphs(page, "?algo=bfs&size=15&density=25&seed=7&distances=1");
    for (let i = 1; i <= 6; i++) {
      await page.click("#step");
      await expect(page.locator("#maze-canvas")).toHaveAttribute("data-state", "paused");
      await expect(page.locator("#cells-visited")).toHaveText(String(i));
    }
    const mid = await snapshot(page);
    const truth = distancesFrom(mid.walls, [mid.start]);
    // Every labelled cell (dequeued or still waiting in the queue) carries its true distance.
    mid.distances.forEach((row, r) => row.forEach((d, c) => {
      if (d !== null) expect(d).toBe(truth[r][c]);
    }));
    const labelled = mid.distances.flat().filter((d) => d !== null).length;
    expect(labelled).toBeGreaterThan(mid.visited);

    // Step level finishes the current level and stops at the boundary.
    await page.click("#step-level");
    await expect(page.locator("#maze-canvas")).toHaveAttribute("data-state", "paused");
    const after = await snapshot(page);
    expect(after.visited).toBeGreaterThan(mid.visited);
    expect(after.status).toMatch(/^Level \d+/);
  });

  test("DFS keeps a stack path from the start and visibly backtracks", async ({ page }) => {
    await openGraphs(page, "?algo=dfs&size=10&density=30&seed=9");
    let sawBacktrack = false;
    let previous = 0;
    for (let i = 0; i < 400; i++) {
      await page.click("#step");
      await page.waitForFunction(() => ["paused", "done"].includes(document.getElementById("maze-canvas").dataset.state));
      const state = await snapshot(page);
      if (state.state === "done") break;
      if (!state.stack.length) continue;
      expectValidPath(state.walls, state.stack, state.start, state.stack[state.stack.length - 1]);
      if (state.stack.length < previous) sawBacktrack = true;
      previous = state.stack.length;
    }
    const done = await snapshot(page);
    expect(done.state).toBe("done");
    expect(sawBacktrack).toBe(true);
    if (done.pathLength) expect(done.path).toEqual(done.stack);
  });

  test("multi-source BFS needs as many levels as the farthest cell's nearest-source distance", async ({ page }) => {
    await openGraphs(page, "?algo=multi&size=15&density=25&seed=7&sources=0,0;7,3;14,14&speed=10");
    const result = await runToEnd(page);
    const truth = distancesFrom(result.walls, result.sources);
    const reachable = truth.flat().filter((d) => d !== null);
    expect(result.level).toBe(Math.max(...reachable));
    expect(result.visited).toBe(reachable.length);
    expect(result.distances).toEqual(truth);
    await expect(page.locator("#level-count")).toHaveText(String(result.level));

    // Level by level: each press of Step level completes exactly one level.
    await page.click("#reset");
    for (let level = 0; level < 3; level++) {
      await page.click("#step-level");
      await expect(page.locator("#maze-canvas")).toHaveAttribute("data-state", "paused");
      await expect(page.locator("#level-count")).toHaveText(String(level));
      const state = await snapshot(page);
      const done = truth.flat().filter((d) => d !== null && d <= level).length;
      expect(state.visited).toBe(done);
    }
  });

  test("sources can be placed by clicking the grid", async ({ page }) => {
    await openGraphs(page, "?algo=multi&size=10&density=0&seed=1");
    await page.locator("#click-mode-card label", { hasText: "Sources" }).click();
    await expect(page.locator('input[name="click-mode"][value="sources"]')).toBeChecked();
    const canvas = page.locator("#maze-canvas");
    const box = await canvas.boundingBox();
    const cell = box.width / 10;
    await canvas.click({ position: { x: cell * 9.5, y: cell * 9.5 } });
    expect((await snapshot(page)).sources).toEqual([[0, 0], [9, 9]]);
    await canvas.click({ position: { x: cell * 0.5, y: cell * 0.5 } });
    expect((await snapshot(page)).sources).toEqual([[9, 9]]);
  });

  test("count islands matches an independent component count", async ({ page }) => {
    for (const seed of [3, 4]) {
      await openGraphs(page, `?algo=islands&size=12&density=55&seed=${seed}&speed=10`);
      const result = await runToEnd(page);
      expect(result.islands).toBe(countIslands(result.walls));
      await expect(page.locator("#islands-count")).toHaveText(String(result.islands));
      // Every land cell is coloured with an island id, water never is.
      result.walls.forEach((row, r) => [...row].forEach((ch, c) => {
        if (ch === "#") expect(result.components[r][c]).toBe(-1);
        else expect(result.components[r][c]).toBeGreaterThanOrEqual(0);
      }));
    }
  });
});

test.describe("data structure lab graph", () => {
  async function open(page) {
    await page.goto(lab, { waitUntil: "domcontentloaded" });
    await page.selectOption("#animation-speed", "260");
    await page.selectOption("#structure-select", "graph");
  }

  async function run(page, operation, primary = "", secondary = "", traversal) {
    await page.click(`[data-operation="${operation}"]`);
    if (traversal) await page.selectOption("#graph-traversal", traversal);
    await page.fill("#value-input", primary);
    await page.fill("#secondary-input", secondary);
    await page.click("#execute-operation");
    await page.waitForFunction(
      () =>
        document.getElementById("animation-status").textContent.includes("complete") ||
        document.getElementById("result-banner").classList.contains("is-failure"),
      null,
      { timeout: 10_000 },
    );
    return page.evaluate(() => ({
      trace: Array.from(document.querySelectorAll("#trace-list li")).map((li) => li.textContent.trim()),
      detail: document.getElementById("result-detail").textContent,
      model: document.getElementById("model-view").textContent.replace(/\s+/g, " "),
    }));
  }

  test("the model panel shows a live adjacency list", async ({ page }) => {
    await open(page);
    const model = page.locator("#model-view");
    for (const row of ["A: B, C", "B: A, D", "C: A, E", "D: B, F", "E: C", "F: D"]) await expect(model).toContainText(row);
    await run(page, "special", "E", "F");
    await expect(model).toContainText("E: C, F");
    await expect(model).toContainText("F: D, E");
    await run(page, "add", "G");
    await expect(model).toContainText("G: none");
  });

  test("the traversal choice only appears for graph search", async ({ page }) => {
    await open(page);
    await page.click('[data-operation="search"]');
    await expect(page.locator("#graph-traversal")).toBeVisible();
    await page.click('[data-operation="add"]');
    await expect(page.locator("#graph-traversal")).toBeHidden();
    await page.selectOption("#structure-select", "array");
    await page.click('[data-operation="search"]');
    await expect(page.locator("#graph-traversal")).toBeHidden();
  });

  test("DFS visits depth first, and reports the first edge that closes a cycle", async ({ page }) => {
    await open(page);
    const bfs = await run(page, "search", "F", "", "bfs");
    expect(bfs.trace[0]).toBe("BFS from A dequeued A -> B -> C -> D -> E -> F and found F.");

    const dfs = await run(page, "search", "E", "", "dfs");
    expect(dfs.trace[0]).toBe("DFS from A visited A -> B -> D -> F -> C -> E and found E.");
    await expect(page.locator("#algorithm-name")).toHaveText("Depth-first search (DFS)");
    const order = await page.evaluate(() => Array.from(document.querySelectorAll("#structure-visual .animation-done, #structure-visual .animation-result")).map((n) => n.dataset.value));
    expect(order.sort()).toEqual(["A", "B", "C", "D", "E", "F"]);

    const tree = await run(page, "search", "Z", "", "dfs");
    expect(tree.trace[1]).toContain("no cycle");
    await expect(page.locator(".graph-edge.is-cycle-edge")).toHaveCount(0);

    await run(page, "special", "E", "F");
    const cyclic = await run(page, "search", "Z", "", "dfs");
    expect(cyclic.trace[0]).toBe("DFS from A visited A -> B -> D -> F -> E -> C; Z is not in the graph.");
    // F -> E -> C, then C sees A: visited and not C's parent (E), so A-C-E-F-D-B-A is a cycle.
    expect(cyclic.trace[1]).toBe("Edge C - A leads back to visited A: the graph has a cycle.");
    expect(cyclic.detail).toContain("the graph has a cycle");
    await expect(page.locator('.graph-edge.is-cycle-edge[data-edge="A-C"]')).toHaveCount(1);
  });

  test("an empty search runs a full traversal, and a cycle is reported as a finding", async ({ page }) => {
    await open(page);
    const banner = page.locator("#result-banner");

    const bfs = await run(page, "search", "", "", "bfs");
    expect(bfs.trace[0]).toBe("BFS from A dequeued A -> B -> C -> D -> E -> F.");
    await expect(banner).toHaveClass(/is-success/);
    await expect(page.locator("#result-state")).toHaveText("Traversal complete");
    await expect(page.locator("#result-title")).toHaveText("BFS visited all 6 vertices: A -> B -> C -> D -> E -> F");
    await expect(page.locator("#value-input")).toHaveValue("");

    const tree = await run(page, "search", "", "", "dfs");
    expect(tree.trace[0]).toBe("DFS from A visited A -> B -> D -> F -> C -> E.");
    await expect(banner).toHaveClass(/is-success/);
    await expect(page.locator("#result-title")).toHaveText("DFS visited all 6 vertices: A -> B -> D -> F -> C -> E");

    // Video part 3: add edge E-F, then DFS with the field empty.
    await run(page, "special", "E", "F");
    const cyclic = await run(page, "search", "", "", "dfs");
    expect(cyclic.trace[1]).toBe("Edge C - A leads back to visited A: the graph has a cycle.");
    await expect(banner).toHaveClass(/is-info/);
    await expect(banner).not.toHaveClass(/is-failure/);
    await expect(page.locator("#result-state")).toHaveText("Cycle found");
    await expect(page.locator("#result-title")).toHaveText("Cycle found: edge C - A leads back to visited A");
    await expect(page.locator("#result-detail")).toHaveText("DFS visited all 6 vertices: A -> B -> D -> F -> E -> C");
    await expect(page.locator('.graph-edge.is-cycle-edge[data-edge="A-C"]')).toHaveCount(1);
    // Only the visit-order badges show; degree badges stay hidden until a vertex is hovered or selected.
    await expect(page.locator(".graph-node .visit-badge").first()).toBeVisible();
    await expect(page.locator(".graph-node .degree-badge:visible")).toHaveCount(0);

    // A missing vertex is still a miss.
    await run(page, "search", "Z", "", "dfs");
    await expect(banner).toHaveClass(/is-failure/);
  });

  test("removing a vertex reports the remaining components", async ({ page }) => {
    await open(page);
    const removed = await run(page, "remove", "D");
    expect(removed.trace[0]).toBe("Removed vertex D and 2 incident edges. The graph now has 2 components.");
    await expect(page.locator("#result-title")).toContainText("2 components");
    expect(removed.model).toContain("F: none");

    const again = await run(page, "remove", "B");
    expect(again.trace[0]).toBe("Removed vertex B and 1 incident edge. The graph now has 2 components.");
    const last = await run(page, "remove", "F");
    expect(last.trace[0]).toBe("Removed vertex F and 0 incident edges. The graph is still connected.");
  });
});
