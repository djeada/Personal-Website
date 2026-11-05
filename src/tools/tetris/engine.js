(function(root, factory) {
    const m = factory();
    if (typeof module === "object" && module.exports) module.exports = m;
    else root.TetrisEngine = m;
})(typeof self !== "undefined" ? self : this, function() {
    "use strict";

    const WIDTH = 10;
    const HEIGHT = 20;
    const LOCK_DELAY = 500;
    const MAX_LOCK_RESETS = 15;
    const SOFT_DROP_FACTOR = 20;
    const LINES_PER_LEVEL = 10;
    const LINE_POINTS = [0, 100, 300, 500, 800];
    const TYPES = ["I", "J", "L", "O", "S", "T", "Z"];

    const SHAPES = {
        I: { size: 4, cells: [[0, 1], [1, 1], [2, 1], [3, 1]] },
        J: { size: 3, cells: [[0, 0], [0, 1], [1, 1], [2, 1]] },
        L: { size: 3, cells: [[2, 0], [0, 1], [1, 1], [2, 1]] },
        O: { size: 4, cells: [[1, 0], [2, 0], [1, 1], [2, 1]] },
        S: { size: 3, cells: [[1, 0], [2, 0], [0, 1], [1, 1]] },
        T: { size: 3, cells: [[1, 0], [0, 1], [1, 1], [2, 1]] },
        Z: { size: 3, cells: [[0, 0], [1, 0], [1, 1], [2, 1]] }
    };

    const ROTATIONS = {};
    TYPES.forEach(type => {
        const { size, cells } = SHAPES[type];
        const states = [cells.map(c => [c[0], c[1]])];
        for (let r = 1; r < 4; r++) {
            states.push(states[r - 1].map(([x, y]) => [size - 1 - y, x]));
        }
        ROTATIONS[type] = states;
    });

    const KICKS_JLSTZ = {
        "0>1": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
        "1>0": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
        "1>2": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
        "2>1": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
        "2>3": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
        "3>2": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
        "3>0": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
        "0>3": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]]
    };
    const KICKS_I = {
        "0>1": [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
        "1>0": [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
        "1>2": [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
        "2>1": [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
        "2>3": [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
        "3>2": [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
        "3>0": [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
        "0>3": [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]]
    };

    function cellsOf(piece) {
        const [ox, oy] = [piece.x, piece.y];
        return ROTATIONS[piece.type][piece.rot].map(([x, y]) => ({ x: x + ox, y: y + oy }));
    }

    function gravityInterval(level) {
        const l = Math.max(1, level);
        return Math.max(40, 1000 * Math.pow(0.8 - (l - 1) * 0.007, l - 1));
    }

    const PACES = Object.freeze({
        relaxed: 1.8,
        classic: 1,
        fast: 0.6
    });
    const DEFAULT_PACE = "relaxed";

    function create(options) {
        const opts = options || {};
        const rng = opts.rng || Math.random;
        let pace = PACES[opts.pace] ? opts.pace : DEFAULT_PACE;

        const state = {
            width: WIDTH,
            height: HEIGHT,
            board: [],
            piece: null,
            hold: null,
            canHold: true,
            queue: [],
            score: 0,
            lines: 0,
            level: 1,
            over: false
        };

        let bag = [];
        let events = [];
        let gravityAcc = 0;
        let lockTimer = 0;
        let lockResets = 0;
        let softDrop = false;

        function nextFromBag() {
            if (!bag.length) {
                bag = TYPES.slice();
                for (let i = bag.length - 1; i > 0; i--) {
                    const j = Math.min(i, Math.floor(rng() * (i + 1)));
                    [bag[i], bag[j]] = [bag[j], bag[i]];
                }
            }
            return bag.pop();
        }

        function fillQueue() {
            while (state.queue.length < 6) state.queue.push(nextFromBag());
        }

        function emptyBoard() {
            return Array.from({ length: HEIGHT }, () => Array(WIDTH).fill(null));
        }

        function fits(piece) {
            return cellsOf(piece).every(({ x, y }) => {
                if (x < 0 || x >= WIDTH || y >= HEIGHT) return false;
                return y < 0 || state.board[y][x] === null;
            });
        }

        function spawn(type) {
            const size = SHAPES[type].size;
            const piece = {
                type,
                rot: 0,
                x: Math.floor((WIDTH - size) / 2),
                y: type === "I" ? -1 : 0
            };
            state.piece = piece;
            gravityAcc = 0;
            lockTimer = 0;
            lockResets = 0;
            if (!fits(piece)) {
                state.over = true;
                events.push({ type: "over" });
                return false;
            }
            return true;
        }

        function spawnNext() {
            const type = state.queue.shift();
            fillQueue();
            return spawn(type);
        }

        function reset() {
            state.board = emptyBoard();
            state.hold = null;
            state.canHold = true;
            state.queue = [];
            state.score = 0;
            state.lines = 0;
            state.level = 1;
            state.over = false;
            bag = [];
            events = [];
            softDrop = false;
            fillQueue();
            spawnNext();
        }

        function interval() {
            const base = gravityInterval(state.level) * PACES[pace];
            return softDrop ? Math.max(15, base / SOFT_DROP_FACTOR) : base;
        }

        function grounded() {
            return !fits({ ...state.piece, y: state.piece.y + 1 });
        }

        function touched(wasGrounded) {
            if (wasGrounded && lockResets < MAX_LOCK_RESETS) {
                lockTimer = 0;
                lockResets++;
            }
        }

        function shift(dx) {
            if (state.over || !state.piece) return false;
            const moved = { ...state.piece, x: state.piece.x + dx };
            if (!fits(moved)) return false;
            const was = grounded();
            state.piece = moved;
            touched(was);
            return true;
        }

        function rotate(direction) {
            if (state.over || !state.piece) return false;
            const p = state.piece;
            if (p.type === "O") return false;
            const to = (p.rot + (direction < 0 ? 3 : 1)) % 4;
            const table = p.type === "I" ? KICKS_I : KICKS_JLSTZ;
            const kicks = table[`${p.rot}>${to}`];
            const was = grounded();
            for (const [kx, ky] of kicks) {
                const candidate = { type: p.type, rot: to, x: p.x + kx, y: p.y - ky };
                if (fits(candidate)) {
                    state.piece = candidate;
                    touched(was);
                    return true;
                }
            }
            return false;
        }

        function step() {
            if (state.over) return false;
            const moved = { ...state.piece, y: state.piece.y + 1 };
            if (!fits(moved)) return false;
            state.piece = moved;
            lockTimer = 0;
            return true;
        }

        function lock() {
            const cells = cellsOf(state.piece);
            const type = state.piece.type;
            let abovePlayfield = true;
            cells.forEach(({ x, y }) => {
                if (y >= 0) {
                    state.board[y][x] = type;
                    abovePlayfield = false;
                }
            });
            events.push({ type: "lock", cells });
            const full = [];
            for (let y = 0; y < HEIGHT; y++) {
                if (state.board[y].every(c => c !== null)) full.push(y);
            }
            if (full.length) {
                state.board = state.board.filter((_, y) => !full.includes(y));
                while (state.board.length < HEIGHT) state.board.unshift(Array(WIDTH).fill(null));
                state.lines += full.length;
                state.score += LINE_POINTS[full.length] * state.level;
                const newLevel = 1 + Math.floor(state.lines / LINES_PER_LEVEL);
                const leveled = newLevel > state.level;
                state.level = newLevel;
                events.push({ type: "clear", rows: full, leveled });
            }
            state.canHold = true;
            if (abovePlayfield && !full.length) {
                state.over = true;
                state.piece = null;
                events.push({ type: "over" });
                return;
            }
            spawnNext();
        }

        function hardDrop() {
            if (state.over || !state.piece) return 0;
            let rows = 0;
            while (step()) rows++;
            state.score += rows * 2;
            lock();
            return rows;
        }

        function setSoftDrop(on) {
            softDrop = !!on;
        }

        function softStep() {
            if (!step()) return false;
            state.score += 1;
            return true;
        }

        function holdPiece() {
            if (state.over || !state.canHold || !state.piece) return false;
            const current = state.piece.type;
            const held = state.hold;
            state.hold = current;
            state.canHold = false;
            if (held) spawn(held);
            else spawnNext();
            state.canHold = false;
            return true;
        }

        function ghost() {
            if (!state.piece) return null;
            let g = state.piece;
            while (fits({ ...g, y: g.y + 1 })) g = { ...g, y: g.y + 1 };
            return g;
        }

        function tick(dt) {
            if (state.over || !state.piece) return;
            gravityAcc += dt;
            let guard = 0;
            while (gravityAcc >= interval() && guard++ < 60) {
                gravityAcc -= interval();
                if (softDrop) {
                    if (!softStep()) {
                        gravityAcc = 0;
                        break;
                    }
                } else if (!step()) {
                    gravityAcc = 0;
                    break;
                }
            }
            if (grounded()) {
                lockTimer += dt;
                if (lockTimer >= LOCK_DELAY) lock();
            } else {
                lockTimer = 0;
            }
        }

        function drainEvents() {
            const out = events;
            events = [];
            return out;
        }

        function setPace(name) {
            if (PACES[name]) pace = name;
            return pace;
        }

        reset();

        return {
            state,
            reset,
            tick,
            left: () => shift(-1),
            right: () => shift(1),
            rotate,
            softStep,
            setSoftDrop,
            hardDrop,
            holdPiece,
            ghost,
            drainEvents,
            setPace,
            interval,
            grounded: () => !!state.piece && grounded(),
            get pace() {
                return pace;
            }
        };
    }

    return {
        create,
        cellsOf,
        gravityInterval,
        WIDTH,
        HEIGHT,
        TYPES,
        SHAPES,
        ROTATIONS,
        PACES,
        DEFAULT_PACE,
        LOCK_DELAY,
        MAX_LOCK_RESETS
    };
});
