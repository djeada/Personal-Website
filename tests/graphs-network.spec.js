const { test, expect } = require("@playwright/test");

// Network mode of the graphs tool (src/tools/graphs/network.js). Every preset is
// checked against the numbers the course narration states for it.

const graphs = "/tools/graphs/";

function collectErrors(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

async function open(page, query) {
  await page.route(/google|googlesyndication/, (route) => route.abort());
  await page.goto(`${graphs}${query}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.GraphsDebug && window.GraphsDebug.network && document.getElementById("network-canvas"));
}

const net = (page, method, ...args) => page.evaluate(([m, a]) => window.GraphsDebug.network[m](...a), [method, args]);

// Every frame of the run, as plain data (the run is precomputed, so this is cheap).
async function allFrames(page) {
  return page.evaluate(() => {
    const api = window.GraphsDebug.network;
    api.reset();
    const frames = [api.state()];
    while (!frames[frames.length - 1].done && frames.length < 200) frames.push(api.step());
    return frames;
  });
}

test.describe("graphs network mode", () => {
  test("Course Schedule: Kahn's order is 0, 1, 2, 3, 5, 4", async ({ page }) => {
    const errors = collectErrors(page);
    await open(page, "?mode=network&preset=course-schedule");
    await expect(page.locator("#network-canvas")).toHaveAttribute("data-state", "idle");
    await expect(page.locator("#network-container")).toBeVisible();
    await expect(page.locator("#maze-canvas")).toBeHidden();

    const frames = await allFrames(page);
    const counted = frames.find((f) => f.indegree);
    expect(counted.indegree).toEqual({ 0: 0, 1: 1, 2: 1, 3: 2, 4: 1, 5: 1 });
    const seeded = frames[frames.indexOf(counted) + 1];
    expect(seeded.queue).toEqual(["0"]);
    expect(seeded.nodes.find((n) => n.label === "0").state).toBe("queued");
    // 1 leaves the queue before 3 is ready: 3 waits for both 1 and 2.
    const afterOne = frames.find((f) => f.order.join() === "0,1");
    expect(afterOne.indegree["3"]).toBe(1);
    expect(afterOne.queue).toEqual(["2"]);

    const end = frames[frames.length - 1];
    expect(end.order).toEqual(["0", "1", "2", "3", "5", "4"]);
    expect(end.cycle).toBe(false);
    expect(end.edges.every((e) => e.state === "used")).toBe(true);
    await expect(page.locator("#network-canvas")).toHaveAttribute("data-state", "done");
    await expect(page.locator("#network-canvas")).toHaveAttribute("data-result", "0,1,2,3,5,4");
    expect(errors).toEqual([]);
  });

  test("Course Schedule pairs: build=1 draws one arrow per pair, b to a", async ({ page }) => {
    await open(page, "?mode=network&preset=course-schedule&build=1");
    const first = await net(page, "state");
    expect(first.edges.every((e) => e.state === "hidden")).toBe(true);
    const one = await net(page, "step");
    expect(one.status).toContain("Pair [1, 0]");
    expect(one.edges[0]).toMatchObject({ edge: "0>1", state: "new" });
    expect(one.edges.slice(1).every((e) => e.state === "hidden")).toBe(true);
    const six = await net(page, "step", 5);
    expect(six.edges.map((e) => e.edge)).toEqual(["0>1", "0>2", "1>3", "2>3", "3>4", "2>5"]);
    expect(six.edges.some((e) => e.state === "hidden")).toBe(false);
    expect((await net(page, "end")).order).toEqual(["0", "1", "2", "3", "5", "4"]);
  });

  test("Course Schedule with 4 to 1: stops after 0, 2, 5 and reports a cycle", async ({ page }) => {
    await open(page, "?mode=network&preset=course-schedule-cycle&steps=end");
    await expect(page.locator("#network-canvas")).toHaveAttribute("data-state", "done");
    const end = await net(page, "state");
    expect(end.order).toEqual(["0", "2", "5"]);
    expect(end.leftover).toEqual(["1", "3", "4"]);
    expect(end.cycle).toBe(true);
    expect(end.status).toContain("3 of 6 courses in the order: cycle");
    await expect(page.locator("#search-status")).toContainText("3 of 6 courses in the order: cycle");
    for (const label of ["1", "3", "4"]) expect(end.nodes.find((n) => n.label === label).state).toBe("rejected");
  });

  test("three-color DFS: the diamond has no cycle, D to A is flagged", async ({ page }) => {
    await open(page, "?mode=network&preset=diamond");
    const frames = await allFrames(page);
    const revisit = frames.find((f) => f.status.startsWith("C to D"));
    expect(revisit.colors.D).toBe("black");
    expect(revisit.status).toContain("D is black");
    const end = frames[frames.length - 1];
    expect(end.cycle).toBe(false);
    expect(end.finished).toEqual(["D", "B", "C", "A"]);
    expect(end.result).toBe("no cycle");

    // Beat 6: the plain visited test sees D again from C, and no cycle is reported.
    await open(page, "?mode=network&preset=diamond&colors=2");
    const plain = await allFrames(page);
    expect(plain.find((f) => f.status.startsWith("C to D")).status).toContain("is not C's parent");
    expect(plain[plain.length - 1].result).toBe("no cycle");

    await open(page, "?mode=network&preset=diamond-cycle&steps=end");
    const cyc = await net(page, "state");
    expect(cyc.cycleEdge).toBe("D>A");
    expect(cyc.colors).toMatchObject({ A: "gray", B: "gray", D: "gray", C: "white" });
    expect(cyc.path).toEqual(["A", "B", "D"]);
    expect(cyc.edges.find((e) => e.edge === "D>A").state).toBe("conflict");
    await expect(page.locator("#network-canvas")).toHaveAttribute("data-result", "cycle D>A");
  });

  test("Dijkstra on Network Delay Time: node 3 is pushed at 7, then 4, and the 7 is skipped as stale", async ({ page }) => {
    await open(page, "?mode=network&preset=network-delay");
    const frames = await allFrames(page);
    const pushedSeven = frames.findIndex((f) => f.heap.some(([d, v]) => d === 7 && v === "3"));
    const bothIn = frames.findIndex((f) => f.heap.some(([d, v]) => d === 7 && v === "3") && f.heap.some(([d, v]) => d === 4 && v === "3"));
    expect(pushedSeven).toBeGreaterThan(0);
    expect(bothIn).toBeGreaterThan(pushedSeven);
    expect(frames[bothIn].heap.find(([d, v]) => d === 7 && v === "3")[2]).toBe(true); // marked stale
    const pops = frames.filter((f) => f.popped).map((f) => f.popped);
    expect(pops).toEqual([[0, "1", false], [1, "2", false], [4, "3", false], [5, "4", false], [6, "5", false], [7, "3", true]]);
    const end = frames[frames.length - 1];
    expect(end.dist).toEqual({ 1: 0, 2: 1, 3: 4, 4: 5, 5: 6 });
    expect(end.answer).toBe(6);
  });

  test("Cheapest Flights, k = 1: 400 with the copy, a cheaper wrong 300 without", async ({ page }) => {
    await open(page, "?mode=network&preset=cheapest-flights");
    const frames = await allFrames(page);
    const endOfPassOne = frames.filter((f) => f.pass === 1).pop();
    expect(endOfPassOne.dist).toEqual([0, 100, 300, null]);
    const passTwo = frames.find((f) => f.pass === 2);
    expect(passTwo.prev).toEqual([0, 100, 300, null]);
    const good = frames[frames.length - 1];
    expect(good).toMatchObject({ answer: 400, correct: 400, wrong: false, route: ["0", "2", "3"], flights: 2, passes: 2 });

    await open(page, "?mode=network&preset=cheapest-flights&copy=0");
    const noCopy = await allFrames(page);
    const chained = noCopy.find((f) => f.status.includes("two flights in one pass"));
    expect(chained.pass).toBe(2);
    expect(chained.dist[3]).toBe(300);
    const bad = noCopy[noCopy.length - 1];
    expect(bad).toMatchObject({ answer: 300, correct: 400, wrong: true, route: ["0", "1", "2", "3"], flights: 3 });
    expect(bad.status).toContain("Wrong");
    await expect(page.locator("#network-canvas")).toHaveAttribute("data-result", "300 wrong");
    await expect(page.locator(".net-cell.wrong")).toHaveCount(1);
  });

  test("Floyd-Warshall: five nodes, k outermost, the final matrix", async ({ page }) => {
    await open(page, "?mode=network&preset=floyd");
    const frames = await allFrames(page);
    const perK = frames.filter((f) => typeof f.k === "string");
    expect(perK.map((f) => f.k)).toEqual(["0", "1", "2", "3", "4"]);
    expect(perK.map((f) => f.changed.length / 2)).toEqual([2, 3, 2, 2, 1]); // symmetric pairs
    expect(perK[4].changed).toContainEqual(["0", "3", 6, 3]);
    expect(frames[frames.length - 1].matrix).toEqual([
      [0, 3, 4, 3, 2],
      [3, 0, 1, 3, 4],
      [4, 1, 0, 2, 3],
      [3, 3, 2, 0, 1],
      [2, 4, 3, 1, 0],
    ]);
    await net(page, "goto", 3);
    await expect(page.locator(".net-matrix td.changed")).toHaveCount(4);
    await expect(page.locator(".net-matrix th.k")).toHaveCount(2);
  });

  test("bipartite: square passes, triangle fails on 1-2, two pieces fail in the second piece", async ({ page }) => {
    await open(page, "?mode=network&preset=square&steps=end");
    const square = await net(page, "state");
    expect(square.bipartite).toBe(true);
    expect(square.colors).toEqual({ 0: 0, 1: 1, 2: 0, 3: 1 });
    expect(square.status).toContain("bipartite");

    await open(page, "?mode=network&preset=triangle&steps=end");
    const tri = await net(page, "state");
    expect(tri.bipartite).toBe(false);
    expect(tri.conflict).toBe("1-2");
    expect(tri.oddCycle).toHaveLength(3);
    expect(tri.edges.find((e) => e.edge === "1-2").state).toBe("conflict");

    await open(page, "?mode=network&preset=two-piece");
    const frames = await allFrames(page);
    const firstDone = frames.find((f) => f.status.startsWith("Queue empty"));
    expect(firstDone.colors).toEqual({ 0: 0, 1: 1, 2: 0, 3: 1, 4: -1, 5: -1, 6: -1 });
    const end = frames[frames.length - 1];
    expect(end.starts).toEqual(["0", "4"]);
    expect(end.conflict).toBe("5-6");
    expect(end.oddCycle.slice().sort()).toEqual(["4", "5", "6"]);
  });

  test("greedy coloring on Flower Planting: max degree 3, four types", async ({ page }) => {
    await open(page, "?mode=network&preset=flowers&steps=end");
    const end = await net(page, "state");
    expect(end.maxDegree).toBe(3);
    expect(end.colors).toBe(4);
    expect(end.types).toEqual({ 1: 1, 2: 2, 3: 3, 4: 2, 5: 1, 6: 4 });
    await expect(page.locator(".net-badge").first()).toHaveText("max degree 3, 4 colors");
  });

  test("Kruskal and Prim agree on the seven-node tree: 6 edges, total 29", async ({ page }) => {
    await open(page, "?mode=network&preset=mst&steps=end");
    const kruskal = await net(page, "state");
    expect(kruskal.accepted).toEqual(["C-G", "B-G", "A-B", "D-E", "C-D", "E-F"]);
    expect(kruskal.rejected).toEqual(["B-C", "A-G", "E-G"]);
    expect(kruskal).toMatchObject({ total: 29, edgeCount: 6 });
    await expect(page.locator("#search-status")).toContainText("6 edges, total 29");

    await open(page, "?mode=network&preset=mst&algo=prim&steps=end");
    const prim = await net(page, "state");
    expect(prim.taken).toEqual(["A-B", "B-G", "G-C", "C-D", "D-E", "E-F"]);
    expect(prim.skipped).toEqual(["B-C", "A-G", "G-E"]);
    expect(prim).toMatchObject({ total: 29, edgeCount: 6 });

    await open(page, "?mode=network&preset=points&steps=end");
    expect((await net(page, "state")).total).toBe(20);
  });

  test("the page's buttons drive the network, and the grid still works", async ({ page }) => {
    const errors = collectErrors(page);
    await open(page, "?mode=network&preset=triangle&speed=10");
    const canvas = page.locator("#network-canvas");
    await page.click("#step");
    await expect(canvas).toHaveAttribute("data-step", "1");
    await expect(canvas).toHaveAttribute("data-state", "paused");
    await page.click("#net-back");
    await expect(canvas).toHaveAttribute("data-state", "idle");
    await page.click("#start");
    await expect(canvas).toHaveAttribute("data-state", "done", { timeout: 10_000 });
    await page.click("#reset");
    await expect(canvas).toHaveAttribute("data-step", "0");
    // The hidden grid did not start a search while the buttons were in network use.
    await expect(page.locator("#maze-canvas")).toHaveAttribute("data-state", "idle");

    // Changing the algorithm from the sidebar keeps a fitting preset or loads one.
    await page.selectOption("#net-algo", "kruskal");
    await expect(canvas).toHaveAttribute("data-preset", "triangle");
    await page.selectOption("#net-algo", "kahn");
    await expect(canvas).toHaveAttribute("data-preset", "course-schedule");
    expect(page.url()).toContain("algo=kahn");

    // Back to the grid: the maze runs as before.
    await page.click('.mode-card label:has(input[value="grid"])');
    await expect(page.locator("#maze-canvas")).toBeVisible();
    await expect(page.locator("#network-container")).toBeHidden();
    expect(page.url()).not.toContain("mode=network");
    const box = await page.locator("#maze-canvas").boundingBox();
    expect(box.width).toBeGreaterThan(300);
    await page.selectOption("#algorithm", "bfs");
    await page.locator("#speed").evaluate((input) => {
      input.value = "10";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.click("#start");
    await expect(page.locator("#maze-canvas")).toHaveAttribute("data-state", "done", { timeout: 20_000 });
    expect((await page.evaluate(() => window.GraphsDebug.snapshot())).visited).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });

  test("grid mode is the default and is untouched by the network script", async ({ page }) => {
    await page.route(/google|googlesyndication/, (route) => route.abort());
    await page.goto(`${graphs}?algo=bfs&size=15&density=25&seed=7`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.GraphsDebug && window.GraphsDebug.snapshot && document.getElementById("maze-canvas").dataset.state === "idle");
    await expect(page.locator("#maze-canvas")).toBeVisible();
    await expect(page.locator("#network-container")).toBeHidden();
    await expect(page.locator(".net-card").first()).toBeHidden();
    await expect(page.locator("#algorithm")).toHaveValue("bfs");
    expect(await page.evaluate(() => typeof window.GraphsDebug.network)).toBe("object");
    await page.click('.mode-card label:has(input[value="network"])');
    await expect(page.locator("#network-container")).toBeVisible();
    await expect(page.locator("#network-canvas")).toHaveAttribute("data-algorithm", "kahn");
  });

  test("editing: a node and an edge turn the preset into a custom graph that the URL keeps", async ({ page }) => {
    await open(page, "?mode=network&preset=square");
    await page.locator("#network-canvas").scrollIntoViewIfNeeded();
    await page.click('label:has(input[name="net-tool"][value="node"])');
    // Empty space: halfway between nodes 0 and 2 of the square.
    const [a, c] = [await net(page, "point", "0"), await net(page, "point", "2")];
    await page.mouse.click((a.x + c.x) / 2, (a.y + c.y) / 2);
    let state = await net(page, "state");
    expect(state.preset).toBe("custom");
    expect(state.nodes).toHaveLength(5);
    await page.click('label:has(input[name="net-tool"][value="edge"])');
    const added = await net(page, "point", "4");
    const zero = await net(page, "point", "0");
    await page.mouse.click(added.x, added.y);
    await page.mouse.click(zero.x, zero.y);
    state = await net(page, "state");
    expect(state.edges.map((e) => e.edge)).toContain("4-0");
    expect(page.url()).toContain("edges=");
    const url = page.url();
    await open(page, url.slice(url.indexOf("?")));
    expect((await net(page, "state")).edges).toHaveLength(5);
  });
});
