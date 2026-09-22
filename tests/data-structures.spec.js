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
  expect(keys.length).toBe(12);

  for (const key of keys) {
    await page.selectOption("#structure-select", key);
    const layout = await page.evaluate(() => {
      const stage = document.getElementById("visual-stage");
      const nodes = Array.from(document.querySelectorAll("#structure-visual .selectable"));
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
  for (const key of ["bst", "heap", "trie", "graph"]) {
    await page.selectOption("#structure-select", key);
    const overlaps = await page.evaluate(() => {
      const boxes = Array.from(document.querySelectorAll("#structure-visual .selectable")).map((n) => n.getBoundingClientRect());
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
