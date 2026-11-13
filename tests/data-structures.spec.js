const { test, expect } = require("@playwright/test");

const tool = "/tools/data_structures/";

async function open(page) {
  await page.goto(tool, { waitUntil: "domcontentloaded" });
  await page.selectOption("#animation-speed", "260");
}

async function run(page, structure, operation, primary = "", secondary = "") {
  await page.selectOption("#structure-select", structure);
  await page.click(`[data-operation="${operation}"]`);
  await page.fill("#value-input", primary);
  await page.fill("#secondary-input", secondary);
  await page.click("#execute-operation");
  await page.waitForFunction(
    () =>
      document.getElementById("animation-status").textContent.includes("complete") ||
      document.getElementById("result-banner").classList.contains("is-failure"),
    null,
    { timeout: 10_000 }
  );
  return page.evaluate(() => ({
    state: document.getElementById("result-state").textContent,
    title: document.getElementById("result-title").textContent,
    steps: document.getElementById("result-steps").textContent,
    value: document.getElementById("result-value").textContent,
    trace: document.querySelector("#trace-list li").textContent.trim(),
  }));
}

test("linear search reports the number of slots it actually compared", async ({ page }) => {
  await open(page);
  // Default array is 12, 7, 19, 3, 15, 8 - 15 sits at index 4.
  const found = await run(page, "array", "search", "15");
  expect(found.steps).toBe("5");
  expect(found.value).toBe("15");

  const missing = await run(page, "array", "search", "404");
  expect(missing.state).toContain("no match");
  expect(missing.steps).toBe("6");
});

test("indexed access needs only an index, and rejects an out-of-range one", async ({ page }) => {
  await open(page);
  const inside = await run(page, "array", "special", "", "2");
  expect(inside.value).toBe("19");
  expect(inside.steps).toBe("1");

  const outside = await run(page, "array", "special", "", "99");
  expect(outside.state).toBe("Input required");
  expect(outside.title).toContain("outside the array");
});

test("a stack is scanned from the top down", async ({ page }) => {
  await open(page);
  // main, parse, eval, return - "parse" is two slots below the top.
  const result = await run(page, "stack", "search", "parse");
  expect(result.steps).toBe("3");
  expect(result.trace).toContain("2 slots below the top");
});

test("a deque can push onto either end", async ({ page }) => {
  await open(page);
  await run(page, "deque", "add", "99", "front");
  const front = await page.evaluate(() => document.querySelector(".deque-row .ds-node span:not(.type-badge)").textContent);
  expect(front).toBe("99");

  await page.fill("#value-input", "77");
  await page.fill("#secondary-input", "back");
  await page.click("#execute-operation");
  await page.waitForFunction(() => document.getElementById("animation-status").textContent.includes("complete"));
  const back = await page.evaluate(() => {
    const nodes = document.querySelectorAll(".deque-row .ds-node span:not(.type-badge)");
    return nodes[nodes.length - 1].textContent;
  });
  expect(back).toBe("77");
});

test("BST search walks the ordered path and stops where the key would live", async ({ page }) => {
  await open(page);
  const miss = await run(page, "bst", "search", "65");
  expect(miss.state).toContain("no match");
  expect(miss.trace).toContain("50 -> 70 -> 60");
  expect(miss.steps).toBe("3");

  const hit = await run(page, "bst", "search", "40");
  expect(hit.steps).toBe("3");
  expect(hit.value).toBe("40");
});

test("BST traversal emits sorted keys and deletion keeps the order", async ({ page }) => {
  await open(page);
  await run(page, "bst", "remove", "30");
  const values = await page.evaluate(() => Array.from(document.querySelectorAll(".tree-node span")).map((n) => n.textContent));
  expect(values).not.toContain("30");

  await page.click('[data-operation="special"]');
  await page.click("#execute-operation");
  await page.waitForFunction(() => document.getElementById("animation-status").textContent.includes("complete"));
  const returned = await page.evaluate(() => document.getElementById("result-value").textContent);
  const keys = returned.split(", ").map(Number);
  expect(keys).toEqual([...keys].sort((a, b) => a - b));
});

test("heap operations report the sift work they performed", async ({ page }) => {
  await open(page);
  const inserted = await run(page, "heap", "add", "1");
  expect(inserted.trace).toContain("bubbled up");
  const root = await page.evaluate(() => document.querySelector(".tree-node span").textContent);
  expect(root).toBe("1");

  const extracted = await run(page, "heap", "special");
  expect(extracted.value).toBe("3");
  expect(extracted.trace).toContain("Extracted min 3");
});

test("BFS reports its dequeue order and distinguishes unreachable from absent", async ({ page }) => {
  await open(page);
  const found = await run(page, "graph", "search", "F");
  expect(found.trace).toContain("BFS from A dequeued A -> B -> C -> D -> E -> F");

  const absent = await run(page, "graph", "search", "Z");
  expect(absent.state).toContain("no match");
  expect(absent.trace).toContain("not in the graph");
});

test("graph edge insertion skips self-loops", async ({ page }) => {
  await open(page);
  await page.selectOption("#structure-select", "graph");
  const before = await page.evaluate(() => document.querySelectorAll(".graph-edge").length);
  expect(before).toBeGreaterThan(0);
  const result = await run(page, "graph", "special", "A", "A");
  expect(result.trace).toContain("self-loop");
  const after = await page.evaluate(() => document.querySelectorAll(".graph-edge").length);
  expect(after).toBe(before);
});

test("hash lookups show the hash and probe only one chain", async ({ page }) => {
  await open(page);
  const result = await run(page, "hashTable", "search", "gold");
  expect(result.trace).toMatch(/h\("gold"\) = \d+, \d+ mod 7 = \d+/);
  expect(Number(result.steps)).toBeLessThanOrEqual(2);
  const activeBuckets = await page.evaluate(() => document.querySelectorAll(".bucket-row.is-active-bucket").length);
  expect(activeBuckets).toBe(1);
});

test("prefix search returns the completions it found", async ({ page }) => {
  await open(page);
  const result = await run(page, "trie", "special", "", "ca");
  expect(result.value).toBe("car, cat, cart");
});

test("every structure draws inside the stage without clipping the page", async ({ page }) => {
  await open(page);
  const keys = await page.evaluate(() => Array.from(document.querySelectorAll("#structure-select option")).map((o) => o.value));
  expect(keys.length).toBe(13);

  for (const key of keys) {
    await page.selectOption("#structure-select", key);
    const layout = await page.evaluate(() => {
      const stage = document.getElementById("visual-stage");
      const nodes = Array.from(document.querySelectorAll("#structure-visual .selectable, #structure-visual .dsu-node"));
      const box = stage.getBoundingClientRect();
      return {
        nodes: nodes.length,
        pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        outside: nodes.filter((n) => {
          const r = n.getBoundingClientRect();
          return r.width === 0 || r.top < box.top - 1 || r.bottom > box.bottom + 1;
        }).length,
      };
    });
    expect(layout.nodes, `${key} renders nodes`).toBeGreaterThan(0);
    expect(layout.outside, `${key} keeps nodes inside the stage`).toBe(0);
    expect(layout.pageOverflow, `${key} does not widen the page`).toBeLessThanOrEqual(1);
  }
});

test("absolute-positioned drawings do not overlap each other", async ({ page }) => {
  await open(page);
  for (const key of ["bst", "heap", "trie", "graph", "disjointSet"]) {
    await page.selectOption("#structure-select", key);
    const overlaps = await page.evaluate(() => {
      const boxes = Array.from(document.querySelectorAll("#structure-visual .selectable, #structure-visual .dsu-node")).map((n) => n.getBoundingClientRect());
      let hits = 0;
      for (let i = 0; i < boxes.length; i += 1) {
        for (let j = i + 1; j < boxes.length; j += 1) {
          const a = boxes[i];
          const b = boxes[j];
          if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) hits += 1;
        }
      }
      return hits;
    });
    expect(overlaps, `${key} nodes overlap`).toBe(0);
  }
});

test("highlight colours stay legible in both themes", async ({ page, context }) => {
  await open(page);
  await run(page, "array", "search", "15");
  const light = await page.evaluate(() => {
    const node = document.querySelector("#structure-visual .is-hit");
    const style = getComputedStyle(node);
    return { color: style.color, background: style.backgroundColor };
  });

  await page.evaluate(() => document.body.classList.add("dark-mode"));
  // Node colours transition, so the computed value only settles after the animation.
  await page.waitForTimeout(400);
  const dark = await page.evaluate(() => {
    const node = document.querySelector("#structure-visual .is-hit");
    const style = getComputedStyle(node);
    return { color: style.color, background: style.backgroundColor };
  });

  const luminance = (rgb) => {
    const [r, g, b] = rgb.match(/\d+/g).map(Number);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  };
  // Light theme: dark ink on a light fill. Dark theme: the other way round.
  expect(luminance(light.color)).toBeLessThan(luminance(light.background));
  expect(luminance(dark.color)).toBeGreaterThan(luminance(dark.background));
});

test("a failed search does not end on a success-coloured node", async ({ page }) => {
  await open(page);
  await run(page, "bst", "search", "65");
  const marks = await page.evaluate(() => ({
    miss: document.querySelectorAll("#structure-visual .animation-miss").length,
    hit: document.querySelectorAll("#structure-visual .animation-result").length,
  }));
  expect(marks.miss).toBe(1);
  expect(marks.hit).toBe(0);

  await run(page, "bst", "search", "60");
  const found = await page.evaluate(() => ({
    miss: document.querySelectorAll("#structure-visual .animation-miss").length,
    hit: document.querySelectorAll("#structure-visual .animation-result").length,
  }));
  expect(found.hit).toBe(1);
  expect(found.miss).toBe(0);
});

test.describe("disjoint set (Union-Find)", () => {
  async function openDsu(page, query) {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route(/google|googlesyndication/, (route) => route.abort());
    await page.goto(`${tool}?structure=dsu&speed=60&${query}`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.DisjointSetLab && document.querySelector(".dsu-view"));
    return errors;
  }

  const snapshot = (page) => page.evaluate(() => window.DisjointSetLab.snapshot());
  const step = (page) => page.evaluate(() => window.DisjointSetLab.step());
  const row = (page, name) => page.$$eval(`.dsu-array [data-row="${name}"]`, (cells) => cells.map((cell) => cell.textContent.trim()));
  const view = (page) => page.locator(".dsu-view");

  async function nextItem(page, cursor) {
    await page.click('[data-dsu="next"]');
    await expect(view(page)).toHaveAttribute("data-cursor", String(cursor));
    await expect(view(page)).not.toHaveAttribute("data-state", "running");
  }

  test("Redundant Connection: components 5, 4, 3, 2, the parent array, and 1-4 as the answer", async ({ page }) => {
    const errors = await openDsu(page, "preset=redundant");
    await expect(view(page)).toHaveAttribute("data-state", "idle");
    await expect(view(page)).toHaveAttribute("data-components", "5");
    expect(await row(page, "parent")).toEqual(["1", "2", "3", "4", "5"]);
    await expect(page.locator(".dsu-queue li")).toHaveText([/^1-2/, /^2-3/, /^3-4/, /^1-4/, /^1-5/]);

    for (const [cursor, components] of [[1, "4"], [2, "3"], [3, "2"]]) {
      await nextItem(page, cursor);
      await expect(view(page)).toHaveAttribute("data-components", components);
      await expect(page.locator("#dsu-components")).toHaveText(components);
    }
    // Union by size with equal sizes keeps a's root, and 1's group is the larger one after that.
    expect(await row(page, "parent")).toEqual(["1", "1", "1", "1", "5"]);
    expect(await row(page, "size")).toEqual(["4", "1", "1", "1", "1"]);
    await expect(page.locator(".dsu-queue li.is-merged")).toHaveCount(3);

    await nextItem(page, 4);
    await expect(view(page)).toHaveAttribute("data-components", "2");
    await expect(view(page)).toHaveAttribute("data-answer", "1-4");
    await expect(view(page)).toHaveAttribute("data-frame", "redundant");
    await expect(page.locator(".dsu-queue li.is-answer")).toHaveText(/1-4\s*answer/i);
    await expect(page.locator('.dsu-wire.is-redundant.is-answer[data-edge="1-4"]')).toHaveCount(1);
    await expect(page.locator(".dsu-edge-label.is-answer")).toHaveText(/answer/i);
    await expect(page.locator("#result-value")).toHaveText("False");
    expect(await row(page, "parent")).toEqual(["1", "1", "1", "1", "5"]);

    await nextItem(page, 5);
    await expect(view(page)).toHaveAttribute("data-state", "done");
    await expect(view(page)).toHaveAttribute("data-components", "1");
    await expect(view(page)).toHaveAttribute("data-answer", "1-4");
    expect(await row(page, "parent")).toEqual(["1", "1", "1", "1", "1"]);
    await expect(page.locator('[data-dsu="next"]')).toBeDisabled();
    expect(errors).toEqual([]);
  });

  test("on 1-4 both finds reach root 1 before union returns False", async ({ page }) => {
    await openDsu(page, "preset=redundant&run=3");
    const frames = [];
    for (let k = 0; k < 4; k++) frames.push((await step(page)).frame);
    expect(frames.map((frame) => frame.type)).toEqual(["find-root", "find-walk", "find-root", "redundant"]);
    expect(frames.map((frame) => frame.op)).toEqual(Array(4).fill("union(1, 4)"));
    expect(frames[0].root).toBe("1");
    expect(frames[1].path).toEqual(["4"]);
    expect(frames[2].path).toEqual(["4", "1"]);
    expect(frames[2].root).toBe("1");
    expect(frames[3].redundant).toEqual(["1", "4"]);
    const done = await snapshot(page);
    expect(done.answer).toBe("1-4");
    expect(done.queue.map((item) => item.status)).toEqual(["merged", "merged", "merged", "answer", "pending"]);
    expect(done.components).toBe(2);
  });

  test("find(5) on the tall tree walks to the root, then path compression re-points the whole path", async ({ page }) => {
    await openDsu(page, "preset=tall");
    expect((await snapshot(page)).parent).toEqual(["1", "1", "2", "3", "4", "6", "6"]);
    const frames = [];
    for (let k = 0; k < 9; k++) frames.push(await step(page));
    expect(frames.map((s) => s.frame.type)).toEqual([
      "find-walk", "find-walk", "find-walk", "find-walk", "find-root",
      "compress", "compress", "compress", "compressed",
    ]);
    expect(frames[4].frame.path).toEqual(["5", "4", "3", "2", "1"]);
    // The recursive find unwinds from the node nearest the root: 3, then 4, then 5 (2 already points at 1).
    expect(frames.slice(5, 8).map((s) => s.frame.repointed)).toEqual([["3"], ["3", "4"], ["3", "4", "5"]]);
    expect(frames[5].parent).toEqual(["1", "1", "1", "3", "4", "6", "6"]);
    expect(frames[6].parent).toEqual(["1", "1", "1", "1", "4", "6", "6"]);
    expect(frames[7].parent).toEqual(["1", "1", "1", "1", "1", "6", "6"]);
    expect(frames[8].frame.caption).toBe("Path compressed: 3, 4 and 5 now point straight at 1");
    expect(await row(page, "parent")).toEqual(["1", "1", "1", "1", "1", "6", "6"]);
    await expect(page.locator(".dsu-queue li").first()).toHaveText(/find\(5\)\s*root 1/i);

    // The same find through the page's own controls.
    await openDsu(page, "preset=tall");
    await page.click('[data-operation="search"]');
    await page.fill("#value-input", "5");
    await page.click("#execute-operation");
    await expect(page.locator("#animation-status")).toHaveText("Find complete");
    await expect(page.locator("#result-title")).toHaveText("find(5) = 1");
    await expect(page.locator("#result-detail")).toHaveText("Path compression re-pointed 3, 4 and 5 straight at 1.");
    expect(await row(page, "parent")).toEqual(["1", "1", "1", "1", "1", "6", "6"]);
  });

  test("a compression frame draws the new pointer and the old one it replaces", async ({ page }) => {
    await openDsu(page, "preset=tall&step=7");
    await expect(view(page)).toHaveAttribute("data-frame", "compress");
    await expect(page.locator('.dsu-wire.is-repointed.is-fresh[data-edge="4-1"]')).toHaveCount(1);
    await expect(page.locator('.dsu-wire.is-repointed[data-edge="3-1"]')).toHaveCount(1);
    await expect(page.locator(".dsu-wire.is-ghost")).toHaveCount(1);
    await expect(page.locator('.dsu-array [data-row="parent"].is-written')).toHaveText(["1"]);
  });

  test("union by size keeps the larger root, whichever argument it came from", async ({ page }) => {
    await openDsu(page, "preset=tall&run=1");
    for (let k = 0; k < 4; k++) await step(page);
    const compare = await step(page);
    expect(compare.frame.type).toBe("compare");
    expect(compare.frame.op).toBe("union(7, 5)");
    // ra, rb = find(7), find(5) = 6, 1; size[6] = 2 < size[1] = 5, so they swap.
    expect(compare.frame.compare).toEqual(["1", "6"]);
    expect(compare.frame.caption).toContain("swap");
    await expect(page.locator(".dsu-size.is-hot")).toHaveText([/size 5/, /size 2/]);
    const link = await step(page);
    expect(link.frame.type).toBe("link");
    expect(link.frame.link).toEqual(["6", "1"]);
    expect(link.parent).toEqual(["1", "1", "1", "1", "1", "1", "6"]);
    expect(link.size[0]).toBe(7);
    expect(link.roots).toEqual(["1"]);
    expect(link.components).toBe(1);
    expect(link.state).toBe("done");

    // Typed into the controls on five singletons: union(1, 2) ties, so 1 stays the root;
    // union(3, 1) puts the single 3 under 1, although 3 is the first argument.
    await openDsu(page, "preset=singletons");
    for (const [a, b] of [["1", "2"], ["3", "1"]]) {
      await page.click('[data-operation="add"]');
      await page.fill("#value-input", a);
      await page.fill("#secondary-input", b);
      await page.click("#execute-operation");
      await expect(view(page)).toHaveAttribute("data-state", "done");
    }
    const after = await snapshot(page);
    expect(after.parent).toEqual(["1", "1", "1", "4", "5"]);
    expect(after.size[0]).toBe(3);
    expect(after.components).toBe(3);
    await expect(page.locator("#result-title")).toHaveText("union(3, 1): 3 now hangs under 1");

    // A union inside one group returns False and leaves the counter alone.
    await page.fill("#value-input", "2");
    await page.fill("#secondary-input", "3");
    await page.click("#execute-operation");
    await expect(page.locator("#result-value")).toHaveText("False");
    expect((await snapshot(page)).components).toBe(3);
  });

  test("connected, make set and input checks", async ({ page }) => {
    await openDsu(page, "preset=redundant&run=3");
    await page.click('[data-operation="special"]');
    await page.fill("#value-input", "2");
    await page.fill("#secondary-input", "4");
    await page.click("#execute-operation");
    await expect(page.locator("#result-value")).toHaveText("True");
    await page.fill("#secondary-input", "5");
    await page.click("#execute-operation");
    await expect(page.locator("#result-value")).toHaveText("False");

    await page.click('[data-operation="remove"]');
    await page.fill("#value-input", "");
    await page.click("#execute-operation");
    await expect(view(page)).toHaveAttribute("data-components", "3");
    expect((await snapshot(page)).elements).toEqual(["1", "2", "3", "4", "5", "6"]);

    await page.click('[data-operation="add"]');
    await page.fill("#value-input", "9");
    await page.fill("#secondary-input", "1");
    await page.click("#execute-operation");
    await expect(page.locator("#result-banner")).toHaveClass(/is-failure/);
    await expect(page.locator("#result-title")).toHaveText("9 is not an element.");
  });

  test("the URL reproduces the filmed frames", async ({ page }) => {
    const errors = await openDsu(page, "preset=redundant&run=3&step=4");
    await expect(view(page)).toHaveAttribute("data-frame", "redundant");
    await expect(view(page)).toHaveAttribute("data-state", "paused");
    await expect(page.locator(".dsu-caption")).toHaveText(/find\(1\) = find\(4\) = 1: already connected, union returns False/);

    await openDsu(page, "preset=redundant&play=3");
    await expect(view(page)).toHaveAttribute("data-cursor", "3");
    await expect(view(page)).toHaveAttribute("data-state", "paused");
    await expect(view(page)).toHaveAttribute("data-components", "2");

    await openDsu(page, "preset=redundant&run=all");
    await expect(view(page)).toHaveAttribute("data-state", "done");
    await expect(page.locator("#structure-select")).toHaveValue("disjointSet");
    await expect(page.locator("#animation-speed")).toHaveValue("60");
    expect(errors).toEqual([]);
  });
});
