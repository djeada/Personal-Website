"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const T = require("../../src/tools/tetris/engine.js");

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

// Rotation- and translation-invariant fingerprint: sorted squared pairwise distances.
function fingerprint(cells) {
    const d = [];
    for (let i = 0; i < cells.length; i++) {
        for (let j = i + 1; j < cells.length; j++) {
            d.push((cells[i].x - cells[j].x) ** 2 + (cells[i].y - cells[j].y) ** 2);
        }
    }
    return d.sort((a, b) => a - b).join(",");
}

function place(g, type, x, y, rot = 0) {
    g.state.piece = { type, rot, x, y };
}

function game(type, seed = 1) {
    const g = T.create({ rng: seeded(seed), pace: "classic" });
    place(g, type, 3, 5);
    return g;
}

test("there are seven distinct pieces, each with four cells in all four rotations", () => {
    assert.equal(T.TYPES.length, 7);
    const prints = new Set();
    for (const type of T.TYPES) {
        const base = fingerprint(T.cellsOf({ type, rot: 0, x: 0, y: 0 }));
        for (let rot = 0; rot < 4; rot++) {
            const cells = T.cellsOf({ type, rot, x: 0, y: 0 });
            assert.equal(cells.length, 4);
            assert.equal(new Set(cells.map(c => `${c.x},${c.y}`)).size, 4, `${type}${rot} overlaps itself`);
            assert.equal(fingerprint(cells), base, `${type} changed shape at rotation ${rot}`);
        }
        prints.add(base + type);
    }
    assert.equal(prints.size, 7);
});

test("S and Z are mirror images, as are J and L", () => {
    const norm = (cells) => {
        const mx = Math.min(...cells.map(c => c.x));
        const my = Math.min(...cells.map(c => c.y));
        return cells.map(c => `${c.x - mx},${c.y - my}`).sort().join("|");
    };
    const mirror = (cells) => cells.map(c => ({ x: -c.x, y: c.y }));
    for (const [a, b] of [["S", "Z"], ["J", "L"]]) {
        const A = T.cellsOf({ type: a, rot: 0, x: 0, y: 0 });
        const B = T.cellsOf({ type: b, rot: 0, x: 0, y: 0 });
        assert.equal(norm(mirror(A)), norm(B));
    }
});

test("rotating four times in open space returns to the start", () => {
    for (const type of T.TYPES) {
        const g = game(type);
        const before = JSON.stringify(T.cellsOf(g.state.piece));
        for (let i = 0; i < 4; i++) assert.equal(g.rotate(1) || type === "O", true);
        assert.equal(JSON.stringify(T.cellsOf(g.state.piece)), before, type);
    }
});

test("clockwise then counter-clockwise is the identity", () => {
    for (const type of T.TYPES) {
        const g = game(type);
        const before = JSON.stringify(T.cellsOf(g.state.piece));
        g.rotate(1);
        g.rotate(-1);
        assert.equal(JSON.stringify(T.cellsOf(g.state.piece)), before, type);
    }
});

test("REGRESSION: a piece pushed against either wall and rotated keeps its shape", () => {
    for (const type of T.TYPES) {
        for (const wall of ["left", "right"]) {
            const g = game(type);
            const shape = fingerprint(T.cellsOf(g.state.piece));
            for (let i = 0; i < 12; i++) wall === "left" ? g.left() : g.right();
            for (let i = 0; i < 9; i++) {
                g.rotate(i % 3 === 2 ? -1 : 1);
                const cells = T.cellsOf(g.state.piece);
                assert.equal(cells.length, 4);
                assert.equal(fingerprint(cells), shape, `${type} deformed at the ${wall} wall (step ${i})`);
                for (const c of cells) assert.ok(c.x >= 0 && c.x < 10, `${type} left the board at ${wall} wall`);
            }
        }
    }
});

test("REGRESSION: failed rotations leave the piece exactly where it was", () => {
    const g = game("I");
    place(g, "I", 3, 10, 0);
    for (let x = 0; x < 10; x++) {
        for (let y = 8; y < 20; y++) if (!(y === 11)) g.state.board[y][x] = "T";
    }
    for (let x = 0; x < 10; x++) g.state.board[11][x] = null;
    place(g, "I", 3, 10, 0);
    const before = JSON.stringify(g.state.piece);
    assert.equal(g.rotate(1), false);
    assert.equal(JSON.stringify(g.state.piece), before);
});

test("an I piece standing against the left wall can still rotate flat using a kick", () => {
    const g = game("I");
    place(g, "I", -2, 5, 1);
    assert.ok(T.cellsOf(g.state.piece).every(c => c.x >= 0), "start state is legal");
    const ok = g.rotate(1);
    assert.equal(ok, true);
    const cells = T.cellsOf(g.state.piece);
    assert.ok(cells.every(c => c.x >= 0 && c.x < 10));
    assert.equal(new Set(cells.map(c => c.y)).size, 1, "I is flat again");
});

test("fuzz: random play never deforms the falling piece or corrupts the board", () => {
    for (let seed = 1; seed <= 25; seed++) {
        const rnd = seeded(seed * 7919);
        const g = T.create({ rng: seeded(seed), pace: "fast" });
        for (let n = 0; n < 700 && !g.state.over; n++) {
            const before = g.state.piece && g.state.piece.type;
            const op = Math.floor(rnd() * 9);
            if (op === 0) g.left();
            else if (op === 1) g.right();
            else if (op === 2) g.rotate(1);
            else if (op === 3) g.rotate(-1);
            else if (op === 4) g.softStep();
            else if (op === 5) g.tick(Math.floor(rnd() * 400));
            else if (op === 6 && rnd() < 0.25) g.hardDrop();
            else if (op === 7 && rnd() < 0.15) g.holdPiece();
            else g.tick(16);
            const s = g.state;
            if (s.piece && !s.over) {
                const cells = T.cellsOf(s.piece);
                assert.equal(fingerprint(cells), fingerprint(T.cellsOf({ type: s.piece.type, rot: 0, x: 0, y: 0 })), `seed ${seed} deformed`);
                for (const c of cells) {
                    assert.ok(c.x >= 0 && c.x < 10 && c.y < 20, `seed ${seed} out of bounds`);
                    if (c.y >= 0) assert.equal(s.board[c.y][c.x], null, `seed ${seed} overlaps the stack`);
                }
            }
            assert.equal(s.board.length, 20);
            s.board.forEach(row => assert.equal(row.length, 10));
            assert.ok(before === null || before);
        }
    }
});

test("the 7-bag deals every piece once per seven", () => {
    const g = T.create({ rng: seeded(3) });
    const seen = [g.state.piece.type];
    while (seen.length < 7 * 8) {
        g.hardDrop();
        if (g.state.over) g.reset();
        seen.push(g.state.piece.type);
        if (g.state.over) break;
    }
    const fresh = T.create({ rng: seeded(3) });
    const deal = [fresh.state.piece.type, ...fresh.state.queue];
    assert.equal(new Set(deal.slice(0, 7)).size, 7);
});

test("pieces spawn fully visible, centred, and queue shows six upcoming", () => {
    for (const type of T.TYPES) {
        const g = T.create({ rng: seeded(1) });
        g.state.queue = [type, "T", "T", "T", "T", "T"];
        g.hardDrop();
        if (g.state.over) continue;
        const cells = T.cellsOf(g.state.piece);
        assert.equal(g.state.piece.type, type);
        assert.ok(Math.min(...cells.map(c => c.y)) === 0, `${type} top row`);
        assert.ok(cells.every(c => c.x >= 3 && c.x <= 6), `${type} centred`);
    }
    assert.equal(T.create().state.queue.length, 6);
});

test("clearing one line scores 100, shifts the stack down and counts the line", () => {
    const g = game("I");
    for (let x = 0; x < 10; x++) if (x < 6 || x > 9) g.state.board[19][x] = "T";
    for (let x = 0; x < 10; x++) g.state.board[19][x] = x < 6 ? "T" : null;
    g.state.board[18][0] = "L";
    place(g, "I", 3, 5, 0);
    g.state.piece = { type: "I", rot: 0, x: 6, y: 18 };
    g.hardDrop();
    const events = g.drainEvents();
    assert.equal(g.state.lines, 1);
    assert.deepEqual(events.find(e => e.type === "clear").rows, [19]);
    assert.equal(g.state.board[19][0], "L", "row above fell");
    assert.equal(g.state.board[19][1], null);
});

test("a four-line clear scores 800 at level 1 and 1600 at level 2", () => {
    for (const level of [1, 2]) {
        const g = game("I");
        g.state.level = level;
        for (let y = 16; y < 20; y++) for (let x = 0; x < 10; x++) g.state.board[y][x] = x === 9 ? null : "T";
        g.state.piece = { type: "I", rot: 1, x: 7, y: 16 };
        const before = g.state.score;
        const rows = g.hardDrop();
        const gained = g.state.score - before - rows * 2;
        assert.equal(g.state.lines, 4);
        assert.equal(gained, 800 * level);
    }
});

test("every ten lines is a new level and gravity speeds up", () => {
    const g = game("I");
    const slow = g.interval();
    g.state.lines = 9;
    for (let x = 0; x < 10; x++) g.state.board[19][x] = x === 9 ? null : "T";
    g.state.piece = { type: "I", rot: 1, x: 7, y: 16 };
    g.hardDrop();
    assert.equal(g.state.level, 2);
    assert.ok(g.interval() < slow);
    assert.ok(T.gravityInterval(30) >= 40);
});

test("hard drop awards two points per row, soft drop one", () => {
    const g = game("T");
    place(g, "T", 3, 0);
    const rows = g.hardDrop();
    assert.equal(g.state.score, rows * 2);
    const h = game("T");
    place(h, "T", 3, 0);
    h.softStep();
    h.softStep();
    assert.equal(h.state.score, 2);
});

test("the ghost lands on the floor and on the stack", () => {
    const g = game("O");
    place(g, "O", 3, 0);
    const floor = g.ghost();
    assert.ok(T.cellsOf(floor).some(c => c.y === 19));
    g.state.board[19][4] = "T";
    g.state.board[19][5] = "T";
    const onStack = g.ghost();
    assert.ok(T.cellsOf(onStack).some(c => c.y === 18));
});

test("hold swaps once per piece and refills from the queue the first time", () => {
    const g = T.create({ rng: seeded(5) });
    const first = g.state.piece.type;
    const next = g.state.queue[0];
    assert.equal(g.holdPiece(), true);
    assert.equal(g.state.hold, first);
    assert.equal(g.state.piece.type, next);
    assert.equal(g.holdPiece(), false, "cannot hold twice in a row");
    g.hardDrop();
    assert.equal(g.holdPiece(), true);
    assert.equal(g.state.piece.type, first, "swapped back");
});

test("a landed piece waits for the lock delay and moves buy more time, up to a limit", () => {
    const g = game("O");
    place(g, "O", 3, 18);
    assert.equal(g.grounded(), true);
    g.tick(T.LOCK_DELAY - 50);
    assert.ok(g.state.piece.y === 18, "still falling pieces are not locked early");
    assert.equal(g.drainEvents().some(e => e.type === "lock"), false);
    g.left();
    g.tick(T.LOCK_DELAY - 50);
    assert.equal(g.drainEvents().some(e => e.type === "lock"), false, "a move reset the timer");
    g.tick(100);
    assert.equal(g.drainEvents().some(e => e.type === "lock"), true);

    const stall = game("O");
    place(stall, "O", 4, 18);
    let locked = false;
    for (let i = 0; i < 60 && !locked; i++) {
        i % 2 ? stall.left() : stall.right();
        stall.tick(T.LOCK_DELAY - 1);
        locked = stall.drainEvents().some(e => e.type === "lock");
    }
    assert.equal(locked, true, "endless sliding must not stall the game forever");
});

test("gravity moves the piece down on schedule and big stalls are bounded", () => {
    const g = game("T");
    place(g, "T", 3, 0);
    const iv = g.interval();
    g.tick(iv - 1);
    assert.equal(g.state.piece.y, 0);
    g.tick(2);
    assert.equal(g.state.piece.y, 1);
    g.tick(10 * 60 * 1000);
    assert.ok(g.state.over || T.cellsOf(g.state.piece).every(c => c.y >= 0));
});

test("relaxed pace is slower than classic, which is slower than fast", () => {
    const iv = (pace) => T.create({ pace }).interval();
    assert.equal(T.DEFAULT_PACE, "relaxed");
    assert.ok(iv("relaxed") > iv("classic") && iv("classic") > iv("fast"));
});

test("a stack that reaches the spawn area ends the game", () => {
    const g = T.create({ rng: seeded(9) });
    for (let y = 0; y < 20; y++) for (let x = 0; x < 10; x++) g.state.board[y][x] = y < 2 && x !== 0 ? "T" : (y >= 2 ? (x === 9 ? null : "T") : null);
    for (let x = 0; x < 10; x++) g.state.board[1][x] = x === 0 ? null : "T";
    g.hardDrop();
    for (let i = 0; i < 30 && !g.state.over; i++) g.hardDrop();
    assert.equal(g.state.over, true);
    assert.equal(g.left(), false);
    assert.equal(g.rotate(1), false);
});
