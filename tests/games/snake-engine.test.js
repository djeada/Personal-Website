"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Snake = require("../../src/tools/snake/engine.js");

function seeded(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const head = (g) => g.state.snake[0];

test("a fresh game has a three-long snake, one food and one obstacle, none overlapping", () => {
    const g = Snake.create({ rng: seeded(1) });
    assert.equal(g.state.snake.length, 3);
    assert.equal(g.state.obstacles.length, 1);
    const cells = [...g.state.snake, ...g.state.obstacles, g.state.food].map(c => `${c.x},${c.y}`);
    assert.equal(new Set(cells).size, cells.length);
});

test("the snake can start in any direction and trails behind its head", () => {
    for (const dir of ["up", "down", "left", "right"]) {
        const g = Snake.create({ rng: seeded(2) });
        g.reset(dir);
        const d = Snake.DIRS[dir];
        assert.deepEqual(g.state.dir, d);
        assert.equal(g.state.snake[1].x, head(g).x - d.x);
        assert.equal(g.state.snake[1].y, head(g).y - d.y);
    }
});

test("moving keeps length and advances the head one cell", () => {
    const g = Snake.create({ rng: seeded(3) });
    const before = { ...head(g) };
    assert.equal(g.step().type, "move");
    assert.equal(head(g).x, before.x + 1);
    assert.equal(g.state.snake.length, 3);
});

test("a reversal is rejected, even when queued behind another turn", () => {
    const g = Snake.create({ rng: seeded(4) });
    assert.equal(g.turn("left"), false);
    assert.equal(g.turn("right"), false);
    assert.equal(g.turn("up"), true);
    assert.equal(g.turn("down"), false, "down would reverse the queued up");
    assert.equal(g.turn("left"), true, "left is a legal follow-up to a queued up");
});

test("two quick turns inside one tick are both honoured on consecutive steps", () => {
    const g = Snake.create({ rng: seeded(5) });
    const start = { ...head(g) };
    g.turn("up");
    g.turn("left");
    g.step();
    assert.deepEqual(head(g), { x: start.x, y: start.y - 1 });
    g.step();
    assert.deepEqual(head(g), { x: start.x - 1, y: start.y - 1 });
});

test("the turn queue is bounded", () => {
    const g = Snake.create({ rng: seeded(6) });
    const results = ["up", "left", "down", "right", "up"].map(d => g.turn(d));
    assert.deepEqual(results, [true, true, true, false, false]);
});

test("leaving the board ends the game and records where it crashed", () => {
    const g = Snake.create({ rng: seeded(7) });
    g.state.obstacles = [];
    g.state.food = { x: 0, y: 0 };
    let event;
    for (let i = 0; i < 30 && !g.state.over; i++) event = g.step();
    assert.equal(event.type, "crash");
    assert.equal(g.state.over, true);
    assert.equal(g.state.crash.x, 20);
    assert.equal(g.step().type, "none");
});

test("eating grows the snake, scores, and puts new food somewhere free", () => {
    const g = Snake.create({ rng: seeded(8) });
    g.state.obstacles = [];
    g.state.food = { x: head(g).x + 1, y: head(g).y };
    const event = g.step();
    assert.equal(event.type, "eat");
    assert.equal(g.state.score, 1);
    assert.equal(g.state.snake.length, 4);
    assert.ok(!g.state.snake.some(s => s.x === g.state.food.x && s.y === g.state.food.y));
});

test("running into your own body ends the game", () => {
    const g = Snake.create({ rng: seeded(9), size: 12 });
    g.state.obstacles = [];
    const h = head(g);
    g.state.snake = [];
    for (let i = 0; i < 6; i++) g.state.snake.push({ x: h.x - i, y: h.y });
    g.state.food = { x: 0, y: 0 };
    g.turn("up");
    g.step();
    g.turn("left");
    g.step();
    g.turn("down");
    const event = g.step();
    assert.equal(event.type, "crash");
});

test("chasing the tail is legal: the tail cell is vacated in the same step", () => {
    const g = Snake.create({ rng: seeded(10), size: 12 });
    g.state.obstacles = [];
    g.state.food = { x: 0, y: 0 };
    g.state.snake = [{ x: 5, y: 5 }, { x: 5, y: 6 }, { x: 6, y: 6 }, { x: 6, y: 5 }];
    g.state.dir = Snake.DIRS.up;
    g.state.queue = [];
    g.turn("right");
    const event = g.step();
    assert.equal(event.type, "move");
    assert.equal(g.state.over, false);
});

test("a stone ends the game", () => {
    const g = Snake.create({ rng: seeded(11) });
    g.state.food = { x: 0, y: 0 };
    g.state.obstacles = [{ x: head(g).x + 1, y: head(g).y }];
    assert.equal(g.step().type, "crash");
});

test("every fifth apple raises the level, speeds up the game and adds a stone", () => {
    const g = Snake.create({ rng: seeded(12), size: 30 });
    const speed0 = g.speed();
    let leveled = 0;
    for (let apple = 1; apple <= 5; apple++) {
        g.state.food = { x: head(g).x + 1, y: head(g).y };
        const e = g.step();
        if (e.leveled) leveled++;
        assert.equal(g.state.over, false);
        if (apple < 5) assert.equal(g.state.level, 1);
    }
    assert.equal(leveled, 1);
    assert.equal(g.state.level, 2);
    assert.equal(g.state.obstacles.length, 2);
    assert.ok(g.speed() < speed0);
});

test("the default pace is gentler than the old 200 ms start, and paces are ordered", () => {
    const at = (pace) => { const g = Snake.create({ pace }); return g.speed(); };
    assert.equal(Snake.DEFAULT_PACE, "relaxed");
    assert.ok(at("relaxed") > 200);
    assert.ok(at("relaxed") > at("classic") && at("classic") > at("fast"));
    const g = Snake.create({ pace: "nonsense" });
    assert.equal(g.pace, "relaxed");
    g.setPace("fast");
    assert.equal(g.speed(), Snake.PACES.fast.start);
});

test("relaxed play never gets faster than a kid-friendly floor", () => {
    const g = Snake.create({ pace: "relaxed" });
    g.state.level = 500;
    assert.ok(g.speed() >= 190);
});

test("speed never drops below the floor and stone count is capped", () => {
    const g = Snake.create({ rng: seeded(13), pace: "classic" });
    g.state.level = 200;
    assert.equal(g.speed(), 90);
    assert.ok(Snake.MAX_OBSTACLES <= 12);
});

test("new stones never land in the snake's path, on food, or wall anything in", () => {
    for (let seed = 1; seed <= 60; seed++) {
        const g = Snake.create({ rng: seeded(seed) });
        for (let level = 2; level <= 14; level++) {
            g.state.level = level;
            g.state.score = (level - 1) * 5 - 1;
            const h = head(g);
            const before = g.state.obstacles.length;
            g.state.food = { x: h.x + 1, y: h.y };
            const dirBefore = g.state.dir;
            const e = g.step();
            if (e.type !== "eat") break;
            const h2 = head(g);
            for (const o of g.state.obstacles.slice(before)) {
                assert.ok(Math.abs(o.x - h2.x) + Math.abs(o.y - h2.y) > 4, "inside the safe radius");
                const ahead = (o.x - h2.x) * dirBefore.x + (o.y - h2.y) * dirBefore.y;
                const across = (o.x - h2.x) * dirBefore.y - (o.y - h2.y) * dirBefore.x;
                assert.ok(!(across === 0 && ahead > 0 && ahead <= 8), "straight ahead of the head");
            }
            const cells = new Set(g.state.obstacles.map(o => `${o.x},${o.y}`));
            assert.ok(!cells.has(`${g.state.food.x},${g.state.food.y}`), "food on a stone");
            const seen = new Set([`${g.state.snake[0].x},${g.state.snake[0].y}`]);
            const stack = [g.state.snake[0]];
            while (stack.length) {
                const c = stack.pop();
                for (const d of Object.values(Snake.DIRS)) {
                    const n = { x: c.x + d.x, y: c.y + d.y };
                    const k = `${n.x},${n.y}`;
                    if (n.x < 0 || n.y < 0 || n.x >= 20 || n.y >= 20 || cells.has(k) || seen.has(k)) continue;
                    seen.add(k);
                    stack.push(n);
                }
            }
            assert.equal(seen.size, 400 - cells.size, "a stone enclosed part of the board");
            g.state.snake = g.state.snake.slice(0, 3);
        }
    }
});

test("filling the whole board is a win and does not hang", () => {
    const g = Snake.create({ rng: seeded(14), size: 3, startLength: 1 });
    g.state.obstacles = [];
    g.state.snake = [{ x: 0, y: 1 }, { x: 0, y: 0 }];
    g.state.dir = Snake.DIRS.down;
    g.state.queue = [];
    g.state.food = { x: 0, y: 2 };
    const path = ["move"];
    assert.equal(g.step().type, "eat");
    g.state.food = { x: 1, y: 2 };
    g.turn("right");
    assert.equal(g.step().type, "eat");
    g.state.food = { x: 2, y: 2 };
    assert.equal(g.step().type, "eat");
    g.state.food = { x: 2, y: 1 };
    g.turn("up");
    assert.equal(g.step().type, "eat");
    g.state.food = { x: 1, y: 1 };
    g.turn("left");
    assert.equal(g.step().type, "eat");
    g.state.food = { x: 1, y: 0 };
    g.turn("up");
    assert.equal(g.step().type, "eat");
    g.state.food = { x: 2, y: 0 };
    g.turn("right");
    const last = g.step();
    assert.equal(last.type, "win");
    assert.equal(g.state.won, true);
    assert.equal(g.state.over, true);
    assert.equal(path.length, 1);
});

test("peek predicts exactly what the next step will do, without changing anything", () => {
    for (let seed = 1; seed <= 40; seed++) {
        const rnd = seeded(seed * 31);
        const g = Snake.create({ rng: seeded(seed), size: 12 });
        for (let n = 0; n < 300 && !g.state.over; n++) {
            if (rnd() < 0.3) g.turn(["up", "down", "left", "right"][Math.floor(rnd() * 4)]);
            const snapshot = JSON.stringify(g.state);
            const p = g.peek();
            assert.equal(JSON.stringify(g.state), snapshot, "peek must not mutate");
            const e = g.step();
            assert.equal(p.fatal, e.type === "crash", `seed ${seed} fatal mismatch`);
            assert.equal(p.eat, e.type === "eat" || e.type === "win", `seed ${seed} eat mismatch`);
            if (!p.fatal) assert.deepEqual(g.state.snake[0], p.next);
        }
    }
    const done = Snake.create({ rng: seeded(1) });
    done.state.over = true;
    assert.equal(done.peek().fatal, true);
});

test("the move counter advances once per step and resets with the game", () => {
    const g = Snake.create({ rng: seeded(2) });
    g.state.obstacles = [];
    g.state.food = { x: 0, y: 0 };
    g.step();
    g.step();
    assert.equal(g.state.moves, 2);
    g.reset();
    assert.equal(g.state.moves, 0);
});
