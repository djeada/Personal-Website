(function(root, factory) {
    const m = factory();
    if (typeof module === "object" && module.exports) module.exports = m;
    else root.SnakeEngine = m;
})(typeof self !== "undefined" ? self : this, function() {
    "use strict";

    const DIRS = Object.freeze({
        up: Object.freeze({ x: 0, y: -1 }),
        down: Object.freeze({ x: 0, y: 1 }),
        left: Object.freeze({ x: -1, y: 0 }),
        right: Object.freeze({ x: 1, y: 0 })
    });

    const APPLES_PER_LEVEL = 5;
    const MAX_OBSTACLES = 12;
    const MAX_QUEUED_TURNS = 3;
    const SAFE_RADIUS = 4;
    const SAFE_LOOKAHEAD = 8;

    const PACES = Object.freeze({
        relaxed: Object.freeze({ start: 320, step: 8, min: 190 }),
        classic: Object.freeze({ start: 200, step: 12, min: 90 }),
        fast: Object.freeze({ start: 140, step: 12, min: 60 })
    });
    const DEFAULT_PACE = "relaxed";

    const same = (a, b) => a.x === b.x && a.y === b.y;
    const opposite = (a, b) => a.x === -b.x && a.y === -b.y;

    function create(options) {
        const opts = options || {};
        const size = opts.size || 20;
        const startLength = Math.min(opts.startLength || 3, Math.max(1, size - 2));
        const rng = opts.rng || Math.random;
        let pace = PACES[opts.pace] ? opts.pace : DEFAULT_PACE;

        const state = {
            size,
            snake: [],
            dir: DIRS.right,
            queue: [],
            food: null,
            obstacles: [],
            score: 0,
            level: 1,
            over: false,
            won: false,
            crash: null
        };

        const key = (x, y) => y * size + x;
        const inside = (x, y) => x >= 0 && x < size && y >= 0 && y < size;

        function occupied() {
            const taken = new Set();
            state.snake.forEach(s => taken.add(key(s.x, s.y)));
            state.obstacles.forEach(o => taken.add(key(o.x, o.y)));
            if (state.food) taken.add(key(state.food.x, state.food.y));
            return taken;
        }

        function pick(cells) {
            return cells[Math.min(cells.length - 1, Math.floor(rng() * cells.length))];
        }

        function placeFood() {
            const taken = new Set();
            state.snake.forEach(s => taken.add(key(s.x, s.y)));
            state.obstacles.forEach(o => taken.add(key(o.x, o.y)));
            const free = [];
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    if (!taken.has(key(x, y))) free.push({ x, y });
                }
            }
            if (!free.length) {
                state.food = null;
                return false;
            }
            state.food = pick(free);
            return true;
        }

        function inSafeZone(x, y) {
            const head = state.snake[0];
            if (Math.abs(x - head.x) + Math.abs(y - head.y) <= SAFE_RADIUS) return true;
            const dx = x - head.x;
            const dy = y - head.y;
            const ahead = dx * state.dir.x + dy * state.dir.y;
            const across = dx * state.dir.y - dy * state.dir.x;
            return across === 0 && ahead > 0 && ahead <= SAFE_LOOKAHEAD;
        }

        function openAreaIsConnected(extra) {
            const blocked = new Set(state.obstacles.map(o => key(o.x, o.y)));
            blocked.add(key(extra.x, extra.y));
            const head = state.snake[0];
            const seen = new Set([key(head.x, head.y)]);
            const stack = [head];
            while (stack.length) {
                const cur = stack.pop();
                for (const d of Object.values(DIRS)) {
                    const nx = cur.x + d.x;
                    const ny = cur.y + d.y;
                    if (!inside(nx, ny)) continue;
                    const k = key(nx, ny);
                    if (blocked.has(k) || seen.has(k)) continue;
                    seen.add(k);
                    stack.push({ x: nx, y: ny });
                }
            }
            return seen.size === size * size - blocked.size;
        }

        function addObstacle() {
            const taken = occupied();
            const candidates = [];
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    if (taken.has(key(x, y)) || inSafeZone(x, y)) continue;
                    candidates.push({ x, y });
                }
            }
            while (candidates.length) {
                const index = Math.min(candidates.length - 1, Math.floor(rng() * candidates.length));
                const [spot] = candidates.splice(index, 1);
                if (openAreaIsConnected(spot)) {
                    state.obstacles.push(spot);
                    return true;
                }
            }
            return false;
        }

        function syncObstacles() {
            const target = Math.min(MAX_OBSTACLES, state.level);
            while (state.obstacles.length < target) {
                if (!addObstacle()) break;
            }
        }

        function speed() {
            const p = PACES[pace];
            return Math.max(p.min, p.start - (state.level - 1) * p.step);
        }

        function setPace(name) {
            if (PACES[name]) pace = name;
            return pace;
        }

        function reset(direction) {
            const dir = direction && DIRS[direction] ? DIRS[direction] : DIRS.right;
            const mid = Math.floor(size / 2);
            state.dir = dir;
            state.queue = [];
            state.snake = [];
            for (let i = 0; i < startLength; i++) {
                state.snake.push({ x: mid - dir.x * i, y: mid - dir.y * i });
            }
            state.obstacles = [];
            state.food = null;
            state.score = 0;
            state.level = 1;
            state.over = false;
            state.won = false;
            state.crash = null;
            syncObstacles();
            placeFood();
        }

        function turn(direction) {
            const next = typeof direction === "string" ? DIRS[direction] : direction;
            if (!next || state.over || state.queue.length >= MAX_QUEUED_TURNS) return false;
            const reference = state.queue.length ? state.queue[state.queue.length - 1] : state.dir;
            if (same(reference, next) || opposite(reference, next)) return false;
            state.queue.push(next);
            return true;
        }

        function step() {
            if (state.over) return { type: "none" };
            if (state.queue.length) state.dir = state.queue.shift();

            const head = state.snake[0];
            const next = { x: head.x + state.dir.x, y: head.y + state.dir.y };
            const eating = state.food !== null && same(next, state.food);

            const crash = () => {
                state.over = true;
                state.crash = next;
                return { type: "crash", at: next };
            };

            if (!inside(next.x, next.y)) return crash();
            const body = eating ? state.snake : state.snake.slice(0, -1);
            if (body.some(s => same(s, next))) return crash();
            if (state.obstacles.some(o => same(o, next))) return crash();

            state.snake.unshift(next);
            if (!eating) {
                state.snake.pop();
                return { type: "move" };
            }

            state.score++;
            const leveled = state.score % APPLES_PER_LEVEL === 0;
            if (leveled) {
                state.level++;
                syncObstacles();
            }
            if (!placeFood()) {
                state.over = true;
                state.won = true;
                return { type: "win" };
            }
            return { type: "eat", leveled };
        }

        reset();

        return { state, DIRS, reset, turn, step, speed, setPace, get pace() { return pace; } };
    }

    return { create, DIRS, PACES, DEFAULT_PACE, APPLES_PER_LEVEL, MAX_OBSTACLES };
});
