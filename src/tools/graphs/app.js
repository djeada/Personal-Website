/*
 * Graph Algorithm Visualization
 *
 * The maze is generated from a seed (mulberry32), so the same seed, size and wall
 * density always give the same grid, and switching algorithm keeps the maze.
 *
 * URL parameters (all optional; cells are written row,col and counted from 0):
 *   algo=bfs            dfs | bfs | dijkstra | astar | multi (multi-source BFS) | islands
 *                       | zeroone (0-1 BFS: open cells cost 0, breaking a wall costs 1)
 *   size=15             grid size, 5..50
 *   density=25          wall (water) density in percent, 0..70
 *   mud=20              mud density in percent of the open cells, 0..50. Mud is
 *                       placed in puddles from the same seed; stepping into mud
 *                       costs 5 for Dijkstra and A*, while BFS and DFS ignore cost
 *   seed=7              maze seed, a positive integer
 *   start=0,0           start cell (also the default single source)
 *   end=14,14           target cell
 *   sources=0,0;7,3     multi-source BFS sources (replaces the default start source)
 *   distances=1         show distance numbers on visited cells (grids up to 20)
 *   speed=5             animation speed, 1..10
 *   grid=0              hide grid lines
 *   click=sources       what a canvas click places: walls | mud | sources
 * With algo=islands and no size or density, the grid defaults to 12 x 12 at 55%.
 *
 * For recorders: #maze-canvas carries data-state (idle | running | paused | done),
 * data-algorithm, data-visited, data-path-length, data-path-cost, data-level and data-islands;
 * #search-status carries the same data-state and a one-line description of the
 * last step. window.GraphsDebug.snapshot() returns the whole grid as plain data.
 */

const fallbackPalette = {
    canvas: "#ffffff",
    panel2: "#eef1f5",
    rule: "#dce1e8",
    ruleStrong: "#9aa6b5",
    ink: "#0e1218",
    ink2: "#3a4452",
    ink3: "#5b6676",
    gold: "#1f4fd1",
    onGold: "#ffffff",
    verdigris: "#137a55",
    moon: "#6d4fd0",
    ember: "#b25a0c",
    rose: "#c23b3b",
    isDark: false
};

function palette() {
    const live = window.ToolShared?.palette?.() || {};
    const merged = Object.assign({}, fallbackPalette);
    Object.keys(live).forEach((key) => {
        if (live[key] !== "" && live[key] !== undefined) merged[key] = live[key];
    });
    return merged;
}

function mulberry32(seed) {
    let a = seed >>> 0;
    return function() {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function clampInt(value, min, max, fallback) {
    const number = parseInt(value, 10);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, number));
}

function parseCell(text) {
    const match = /^\s*(\d+)\s*,\s*(\d+)\s*$/.exec(text || "");
    return match ? [Number(match[1]), Number(match[2])] : null;
}

function readUrlSetup() {
    const params = new URLSearchParams(window.location.search);
    const aliases = {
        "multi-source": "multi",
        multisource: "multi",
        "multi-bfs": "multi",
        island: "islands",
        "0-1": "zeroone",
        "01": "zeroone",
        "01bfs": "zeroone",
        "0-1-bfs": "zeroone",
        "zero-one": "zeroone"
    };
    const rawAlgo = (params.get("algo") || params.get("algorithm") || "").toLowerCase();
    const sources = (params.get("sources") || "").split(";").map(parseCell).filter(Boolean);
    return {
        algo: aliases[rawAlgo] || rawAlgo || null,
        size: params.has("size") ? params.get("size") : null,
        density: params.has("density") ? params.get("density") : null,
        mud: params.has("mud") ? params.get("mud") : null,
        seed: params.has("seed") ? params.get("seed") : null,
        start: parseCell(params.get("start")),
        end: parseCell(params.get("end")),
        sources: sources.length ? sources : null,
        distances: params.has("distances") ? /^(1|true|on|yes)$/i.test(params.get("distances")) : null,
        speed: params.has("speed") ? params.get("speed") : null,
        grid: params.has("grid") ? !/^(0|false|off|no)$/i.test(params.get("grid")) : null,
        click: params.get("click")
    };
}

document.addEventListener("DOMContentLoaded", function() {

    const DEFAULT_GRID_SIZE = 20;
    const DEFAULT_SPEED = 5;
    const DEFAULT_WALL_DENSITY = 30;
    const DEFAULT_SHOW_GRID_LINES = true;
    const DEFAULT_ALGORITHM = "dfs";
    const ISLANDS_GRID_SIZE = 12;
    const ISLANDS_WALL_DENSITY = 55;
    const MAX_DENSITY = 70;
    const DISTANCE_LABEL_MAX_SIZE = 20;
    const DEFAULT_MUD_DENSITY = 0;
    const MAX_MUD_DENSITY = 50;
    const MUD_COST = 5;
    const PATH_MODES = ["dfs", "bfs", "dijkstra", "astar", "zeroone"];
    const DEQUE_SHOWN = 14;

    const algorithmSelect = document.getElementById("algorithm");
    const mazeCanvas = document.getElementById("maze-canvas");
    const startButton = document.getElementById("start");
    const pauseButton = document.getElementById("pause");
    const resetButton = document.getElementById("reset");
    const stepButton = document.getElementById("step");
    const stepLevelButton = document.getElementById("step-level");
    const speedInput = document.getElementById("speed");
    const gridSizeInput = document.getElementById("grid-size");
    const wallDensityInput = document.getElementById("wall-density");
    const wallDensityValue = document.getElementById("wall-density-value");
    const mudDensityInput = document.getElementById("mud-density");
    const mudDensityValue = document.getElementById("mud-density-value");
    const seedInput = document.getElementById("seed");
    const newMazeButton = document.getElementById("new-maze");
    const showGridLinesCheckbox = document.getElementById("show-grid-lines");
    const showDistancesCheckbox = document.getElementById("show-distances");
    const clickModeCard = document.getElementById("click-mode-card");
    const clickModeInputs = Array.from(document.querySelectorAll('input[name="click-mode"]'));
    const resetDefaultsButton = document.getElementById("reset-defaults");
    const toastContainer = document.getElementById("toast-container");
    const statusEl = document.getElementById("search-status");
    const dequePanel = document.getElementById("deque-panel");
    const dequeList = document.getElementById("deque-list");
    const canvasTitleEl = document.getElementById("canvas-title");

    const cellsVisitedEl = document.getElementById("cells-visited");
    const pathLengthEl = document.getElementById("path-length");
    const pathCostEl = document.getElementById("path-cost");
    const pathCostStat = document.getElementById("path-cost-stat");
    const elapsedTimeEl = document.getElementById("elapsed-time");
    const algorithmNameEl = document.getElementById("algorithm-name");
    const levelEl = document.getElementById("level-count");
    const islandsEl = document.getElementById("islands-count");
    const levelStat = document.getElementById("level-stat");
    const islandsStat = document.getElementById("islands-stat");

    const algorithmNames = {
        "dfs": "DFS",
        "bfs": "BFS",
        "dijkstra": "Dijkstra",
        "astar": "A*",
        "multi": "Multi-source BFS",
        "islands": "Count islands",
        "zeroone": "0-1 BFS"
    };

    const canvasTitles = {
        "multi": "Multi-source BFS grid",
        "islands": "Island map: land and water",
        "zeroone": "0-1 BFS: open cells cost 0, walls cost 1"
    };

    // Modes with a natural "level" boundary get the Step level / Step island button.
    const boundaryLabels = {
        "bfs": "Step level",
        "multi": "Step level",
        "islands": "Step island",
        "zeroone": "Step level"
    };

    const setup = readUrlSetup();
    if (setup.algo && algorithmNames[setup.algo]) algorithmSelect.value = setup.algo;
    if (wallDensityInput) wallDensityInput.max = String(MAX_DENSITY);
    const islandsFromUrl = algorithmSelect.value === "islands";
    if (setup.size !== null) gridSizeInput.value = clampInt(setup.size, 5, 50, DEFAULT_GRID_SIZE);
    else if (islandsFromUrl) gridSizeInput.value = ISLANDS_GRID_SIZE;
    if (wallDensityInput) {
        if (setup.density !== null) wallDensityInput.value = clampInt(setup.density, 0, MAX_DENSITY, DEFAULT_WALL_DENSITY);
        else if (islandsFromUrl) wallDensityInput.value = ISLANDS_WALL_DENSITY;
    }
    if (mudDensityInput) {
        mudDensityInput.max = String(MAX_MUD_DENSITY);
        if (setup.mud !== null) mudDensityInput.value = clampInt(setup.mud, 0, MAX_MUD_DENSITY, DEFAULT_MUD_DENSITY);
    }
    if (seedInput) {
        seedInput.value = setup.seed !== null ?
            clampInt(setup.seed, 1, 2147483646, 1) :
            (seedInput.value && seedInput.value !== "0" ? seedInput.value : 1 + Math.floor(Math.random() * 9999));
    }
    if (setup.speed !== null) speedInput.value = clampInt(setup.speed, 1, 10, DEFAULT_SPEED);
    if (setup.grid !== null && showGridLinesCheckbox) showGridLinesCheckbox.checked = setup.grid;
    if (setup.distances !== null && showDistancesCheckbox) showDistancesCheckbox.checked = setup.distances;
    if (setup.click) {
        clickModeInputs.forEach((input) => {
            input.checked = input.value === setup.click;
        });
    }

    function showToast(message, type = "info") {
        if (!toastContainer) return;
        const toast = document.createElement("div");
        toast.className = `toast ${type}`;

        const icons = {
            success: "OK",
            error: "!",
            info: "i",
            warning: "!"
        };

        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || icons.info}</span>
            <span class="toast-message">${message}</span>
        `;

        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const label = (cell) => `(${cell.y}, ${cell.x})`;

    function setCanvasSize() {
        const wrapper = mazeCanvas.closest(".canvas-wrapper");
        const availableWidth = Math.max(240, (wrapper?.clientWidth || window.innerWidth) - 40);
        const size = Math.min(availableWidth, 760);
        const cellSize = Math.max(1, Math.floor(size / visualizer.gridSize));
        const extent = cellSize * visualizer.gridSize;
        const dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1));

        // The bitmap matches the grid exactly, so there is no dead strip on the right
        // or bottom, and it is drawn at device resolution so the numbers stay sharp.
        mazeCanvas.width = Math.round(extent * dpr);
        mazeCanvas.height = Math.round(extent * dpr);
        mazeCanvas.style.width = `${extent}px`;
        mazeCanvas.style.height = `${extent}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        visualizer.cellSize = cellSize;
        visualizer.drawMaze();
    }

    const ctx = mazeCanvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;

    class MazeVisualizer {
        constructor() {
            this.gridSize = clampInt(gridSizeInput.value, 5, 50, DEFAULT_GRID_SIZE);
            this.cellSize = Math.floor(mazeCanvas.width / this.gridSize);
            this.wallDensity = clampInt(wallDensityInput?.value, 0, MAX_DENSITY, DEFAULT_WALL_DENSITY);
            this.mudDensity = clampInt(mudDensityInput?.value, 0, MAX_MUD_DENSITY, DEFAULT_MUD_DENSITY);
            this.seed = clampInt(seedInput?.value, 1, 2147483646, 1);
            this.maze = [];
            this.speed = parseInt(speedInput.value) || DEFAULT_SPEED;
            this.paused = false;
            this.stepMode = false;
            this.runUntilBoundary = false;
            this.searchingInProgress = false;
            this.runId = 0;
            this.runState = "idle";
            this.startNode = null;
            this.endNode = null;
            this.startPref = setup.start;
            this.endPref = setup.end;
            this.sourcePrefs = setup.sources;
            this.sources = new Set();
            this.openSet = [];
            this.closedSet = [];
            this.path = [];
            this.stackCells = [];
            this.currentCell = null;
            this.scanCell = null;
            this.level = 0;
            this.islands = 0;
            this.statusText = "";
            this.currentAlgorithm = this.getSelectedAlgorithm();
            this.showGridLines = showGridLinesCheckbox?.checked !== false;
            this.showDistances = Boolean(showDistancesCheckbox?.checked);
            this.startTime = null;
            this.initializeMaze();
            this.bindEvents();
            this.updateModeUI();
            this.setStatus(this.idleStatus());
            this.setRunState("idle");
            this.drawMaze();
            this.updateAlgorithmName();
        }

        bindEvents() {
            startButton.addEventListener("click", () => this.startSearch());
            pauseButton.addEventListener("click", () => this.togglePause());
            resetButton.addEventListener("click", () => this.resetMaze());
            stepButton.addEventListener("click", () => this.stepSearch());
            if (stepLevelButton) stepLevelButton.addEventListener("click", () => this.stepToBoundary());
            algorithmSelect.addEventListener("change", () => this.handleAlgorithmChange());
            speedInput.addEventListener("input", () => this.handleSpeedChange());
            gridSizeInput.addEventListener("input", () => this.handleGridSizeChange());
            mazeCanvas.addEventListener("click", (e) => this.handleCanvasClick(e));

            if (wallDensityInput) {
                wallDensityInput.addEventListener("input", () => this.handleWallDensityChange());
            }

            if (mudDensityInput) {
                mudDensityInput.addEventListener("input", () => this.handleMudDensityChange());
            }

            clickModeInputs.forEach((input) => {
                input.addEventListener("change", () => this.updateModeUI());
            });

            if (seedInput) {
                seedInput.addEventListener("change", () => this.handleSeedChange());
            }

            if (newMazeButton) {
                newMazeButton.addEventListener("click", () => this.newMaze());
            }

            if (showGridLinesCheckbox) {
                showGridLinesCheckbox.addEventListener("change", () => {
                    this.showGridLines = showGridLinesCheckbox.checked;
                    this.drawMaze();
                });
            }

            if (showDistancesCheckbox) {
                showDistancesCheckbox.addEventListener("change", () => {
                    this.showDistances = showDistancesCheckbox.checked;
                    this.drawMaze();
                });
            }

            if (resetDefaultsButton) {
                resetDefaultsButton.addEventListener("click", () => this.resetDefaults());
            }


            document.addEventListener("keydown", (e) => {
                if (e.code !== "Space") return;
                const tag = (e.target && e.target.tagName) || "";
                if (/^(INPUT|SELECT|TEXTAREA)$/.test(tag)) return;
                e.preventDefault();
                if (this.searchingInProgress) {
                    this.togglePause();
                } else {
                    this.startSearch();
                }
            });
        }

        resetDefaults() {
            gridSizeInput.value = DEFAULT_GRID_SIZE;
            speedInput.value = DEFAULT_SPEED;
            if (wallDensityInput) wallDensityInput.value = DEFAULT_WALL_DENSITY;
            if (mudDensityInput) mudDensityInput.value = DEFAULT_MUD_DENSITY;
            if (showGridLinesCheckbox) showGridLinesCheckbox.checked = DEFAULT_SHOW_GRID_LINES;
            if (showDistancesCheckbox) showDistancesCheckbox.checked = false;
            algorithmSelect.value = DEFAULT_ALGORITHM;

            this.gridSize = DEFAULT_GRID_SIZE;
            this.speed = DEFAULT_SPEED;
            this.wallDensity = DEFAULT_WALL_DENSITY;
            this.mudDensity = DEFAULT_MUD_DENSITY;
            this.showGridLines = DEFAULT_SHOW_GRID_LINES;
            this.showDistances = false;
            this.startPref = null;
            this.endPref = null;
            this.sourcePrefs = null;
            this.resetMaze({ quiet: true });
            this.updateDensityLabel();
            this.updateAlgorithmName();
            this.updateModeUI();
            setCanvasSize();
            showToast("Settings reset to defaults", "success");
        }

        updateAlgorithmName() {
            const algo = this.getSelectedAlgorithm();
            algorithmNameEl.textContent = algorithmNames[algo] || algo.toUpperCase();
        }

        mode() {
            return this.getSelectedAlgorithm();
        }

        updateModeUI() {
            const mode = this.mode();
            if (levelStat) levelStat.hidden = mode !== "multi";
            if (islandsStat) islandsStat.hidden = mode !== "islands";
            if (pathCostStat) pathCostStat.hidden = !PATH_MODES.includes(mode);
            // Walls and mud can be painted in every path mode; sources only exist in multi-source BFS.
            if (clickModeCard) clickModeCard.hidden = mode === "islands";
            // Sources only exist in multi-source BFS; 0-1 BFS gives mud no meaning.
            const offered = { sources: mode === "multi", mud: mode !== "zeroone" };
            clickModeInputs.forEach((input) => {
                if (!(input.value in offered)) return;
                input.closest("label").hidden = !offered[input.value];
                if (!offered[input.value] && input.checked) {
                    input.checked = false;
                    const walls = clickModeInputs.find((other) => other.value === "walls");
                    if (walls) walls.checked = true;
                }
            });
            if (dequePanel) dequePanel.hidden = mode !== "zeroone";
            const segmented = clickModeCard?.querySelector(".segmented");
            if (segmented) segmented.dataset.count = String(clickModeInputs.filter((input) => !input.closest("label").hidden).length);
            const sourceNote = document.getElementById("click-mode-note");
            if (sourceNote) sourceNote.hidden = mode !== "multi";
            if (stepLevelButton) {
                stepLevelButton.hidden = !boundaryLabels[mode];
                stepLevelButton.textContent = boundaryLabels[mode] || "Step level";
            }
            if (canvasTitleEl) canvasTitleEl.textContent = canvasTitles[mode] || "Pathfinding Grid";
            const hasMud = this.hasMud();
            document.querySelectorAll("[data-legend-modes]").forEach((item) => {
                const modes = item.dataset.legendModes.split(/\s+/);
                item.hidden = !(modes.includes("all") || modes.includes(mode)) ||
                    (item.hasAttribute("data-legend-mud") && !hasMud);
            });
            document.querySelectorAll("[data-dfs-label]").forEach((item) => {
                if (!item.dataset.defaultLabel) item.dataset.defaultLabel = item.textContent;
                item.textContent = mode === "dfs" ? item.dataset.dfsLabel : item.dataset.defaultLabel;
            });
            mazeCanvas.dataset.algorithm = mode;
        }

        updateStats() {
            cellsVisitedEl.textContent = this.closedSet.length;
            const pathLength = this.path.length > 0 ? this.path.length - 1 : 0;
            const pathCost = this.pathCost();
            pathLengthEl.textContent = pathLength;
            if (pathCostEl) pathCostEl.textContent = pathCost;
            if (levelEl) levelEl.textContent = this.level;
            if (islandsEl) islandsEl.textContent = this.islands;
            this.renderDeque();

            if (this.startTime) {
                const elapsed = Date.now() - this.startTime;
                elapsedTimeEl.textContent = elapsed + "ms";
            }

            mazeCanvas.dataset.visited = String(this.closedSet.length);
            mazeCanvas.dataset.pathLength = String(pathLength);
            mazeCanvas.dataset.pathCost = String(pathCost);
            mazeCanvas.dataset.level = String(this.level);
            mazeCanvas.dataset.islands = String(this.islands);
        }

        setRunState(state) {
            this.runState = state;
            mazeCanvas.dataset.state = state;
            if (statusEl) statusEl.dataset.state = state;
        }

        setStatus(text) {
            this.statusText = text;
            if (statusEl) statusEl.textContent = text;
        }

        idleStatus() {
            const mode = this.mode();
            if (mode === "multi") return `${this.getSources().length} source${this.getSources().length === 1 ? "" : "s"} ready. Press Start or Step.`;
            if (mode === "islands") return "Land is open, water is wall. Press Start or Step to scan.";
            if (mode === "zeroone") return `Seed ${this.seed}. Open cells cost 0, breaking a wall costs 1. Press Start or Step.`;
            if (this.hasMud()) {
                return mode === "dijkstra" || mode === "astar" ?
                    `Seed ${this.seed}. Mud costs ${MUD_COST} to enter, other cells 1. Press Start or Step.` :
                    `Seed ${this.seed}. ${algorithmNames[mode]} ignores cost: mud is just one more step. Press Start or Step.`;
            }
            return `Seed ${this.seed}. Press Start or Step.`;
        }

        cellAt(pref, fallback) {
            const [row, col] = pref || fallback;
            if (row < this.gridSize && col < this.gridSize) return this.maze[row][col];
            return this.maze[fallback[0]][fallback[1]];
        }

        initializeMaze() {
            this.maze = [];
            const density = this.wallDensity / 100;
            const random = mulberry32(this.seed);
            for (let i = 0; i < this.gridSize; i++) {
                const row = [];
                for (let j = 0; j < this.gridSize; j++) {
                    row.push({
                        x: j,
                        y: i,
                        wall: random() < density,
                        cost: 1,
                        visited: false,
                        distance: Infinity,
                        heuristic: 0,
                        previous: null,
                        closed: false,
                        frontier: false,
                        onStack: false,
                        onPath: false,
                        component: -1
                    });
                }
                this.maze.push(row);
            }
            const last = this.gridSize - 1;
            this.startNode = this.cellAt(this.startPref, [0, 0]);
            this.endNode = this.cellAt(this.endPref, [last, last]);
            if (this.endNode === this.startNode) {
                this.endNode = this.startNode === this.maze[last][last] ? this.maze[0][0] : this.maze[last][last];
            }
            this.startNode.wall = false;
            this.endNode.wall = false;
            this.startNode.distance = 0;

            this.sources = new Set();
            (this.sourcePrefs || [
                [this.startNode.y, this.startNode.x]
            ]).forEach(([row, col]) => {
                if (row < this.gridSize && col < this.gridSize) {
                    const cell = this.maze[row][col];
                    cell.wall = false;
                    this.sources.add(cell);
                }
            });
            this.placeMud();
        }

        // Mud comes in puddles: pick a random open cell, grow it into 3 to 8 cells by
        // random adjacent steps, repeat until the requested share of open cells is mud.
        // It has its own random stream, so the walls of a seed never depend on the mud.
        placeMud() {
            if (!this.mudDensity) return;
            const random = mulberry32(Math.imul(this.seed, 0x9E3779B1) ^ 0x5BD1E995);
            const eligible = (cell) => !cell.wall && cell.cost === 1 && cell !== this.startNode && cell !== this.endNode;
            const open = this.maze.flat().filter(eligible);
            const target = Math.round(open.length * this.mudDensity / 100);
            let placed = 0;
            for (let guard = 0; placed < target && guard < 20000; guard++) {
                const seedCell = open[Math.floor(random() * open.length)];
                if (!eligible(seedCell)) continue;
                const size = 3 + Math.floor(random() * 6);
                const puddle = [seedCell];
                seedCell.cost = MUD_COST;
                placed += 1;
                while (puddle.length < size && placed < target) {
                    const edge = [];
                    puddle.forEach((cell) => this.getNeighbors(cell).forEach((next) => {
                        if (eligible(next)) edge.push(next);
                    }));
                    if (!edge.length) break;
                    const next = edge[Math.floor(random() * edge.length)];
                    next.cost = MUD_COST;
                    puddle.push(next);
                    placed += 1;
                }
            }
        }

        hasMud() {
            return this.maze.some((row) => row.some((cell) => !cell.wall && cell.cost > 1));
        }

        // What it costs to step into a cell. Dijkstra and A* read it; 0-1 BFS has its
        // own rule (open cells 0, walls 1), and BFS and DFS ignore cost while searching.
        stepCost(cell) {
            if (this.mode() === "zeroone") return cell.wall ? 1 : 0;
            return cell.cost || 1;
        }

        // Every in-bounds neighbour, walls included (0-1 BFS can break through them).
        allNeighbors(cell) {
            const { x, y } = cell;
            const out = [];
            if (y > 0) out.push(this.maze[y - 1][x]);
            if (x < this.gridSize - 1) out.push(this.maze[y][x + 1]);
            if (y < this.gridSize - 1) out.push(this.maze[y + 1][x]);
            if (x > 0) out.push(this.maze[y][x - 1]);
            return out;
        }

        // The deque strip under the grid: front on the left. Long deques show their
        // first and last entries around a "+N" gap, so both ends stay visible.
        renderDeque() {
            if (!dequeList) return;
            const items = this.deque || [];
            const fresh = this.dequeNew || new Set();
            const shown = items.length <= DEQUE_SHOWN ? items :
                [...items.slice(0, DEQUE_SHOWN - 5), null, ...items.slice(items.length - 4)];
            const nodes = shown.map((entry) => {
                const li = document.createElement("li");
                if (!entry) {
                    li.className = "deque-gap";
                    li.textContent = `+${items.length - (DEQUE_SHOWN - 1)}`;
                    return li;
                }
                li.className = "deque-item";
                if (fresh.has(entry)) li.classList.add("is-new");
                if (entry.cell.closed || entry.d > entry.cell.distance) li.classList.add("is-stale");
                if (entry.cell.wall) li.classList.add("is-wall");
                const where = document.createElement("span");
                where.textContent = `${entry.cell.y},${entry.cell.x}`;
                const cost = document.createElement("b");
                cost.textContent = String(entry.d);
                li.append(where, cost);
                return li;
            });
            if (!items.length) {
                const li = document.createElement("li");
                li.className = "deque-gap";
                li.textContent = "empty";
                nodes.push(li);
            }
            dequeList.replaceChildren(...nodes);
            mazeCanvas.dataset.deque = String(items.length);
        }

        // The cost of the current path: the sum of the cells it steps into (the start is free).
        pathCost(path = this.path) {
            let total = 0;
            for (let k = 1; k < path.length; k++) total += this.stepCost(path[k]);
            return total;
        }

        getSources() {
            const list = Array.from(this.sources).filter((cell) => !cell.wall);
            if (!list.length) return [this.startNode];
            return list.sort((a, b) => a.y - b.y || a.x - b.x);
        }

        getSelectedAlgorithm() {
            return algorithmSelect.options[algorithmSelect.selectedIndex].value;
        }

        // Every run gets an id; a loop from an earlier run sees a newer id and stops,
        // so a quick Reset + Start can never leave two searches drawing at once.
        isActive(run) {
            return this.searchingInProgress && this.runId === run;
        }

        clearSearchState() {
            this.openSet = [];
            this.closedSet = [];
            this.path = [];
            this.stackCells = [];
            this.currentCell = null;
            this.scanCell = null;
            this.level = 0;
            this.islands = 0;
            this.deque = [];
            this.dequeNew = new Set();
            for (let row of this.maze) {
                for (let cell of row) {
                    cell.visited = false;
                    cell.distance = Infinity;
                    cell.heuristic = 0;
                    cell.previous = null;
                    cell.closed = false;
                    cell.frontier = false;
                    cell.onStack = false;
                    cell.onPath = false;
                    cell.component = -1;
                }
            }
            this.startNode.distance = 0;
        }

        stopSearch() {
            this.runId += 1;
            this.searchingInProgress = false;
            this.paused = false;
            this.stepMode = false;
            this.runUntilBoundary = false;
            pauseButton.innerHTML = 'Pause';
        }

        async startSearch(options = {}) {
            if (this.searchingInProgress) {
                // Start while stepping switches the paused run to continuous play.
                if (!options.step) {
                    this.stepMode = false;
                    this.runUntilBoundary = false;
                    this.paused = false;
                    pauseButton.innerHTML = 'Pause';
                }
                return;
            }
            const run = ++this.runId;
            this.searchingInProgress = true;
            this.paused = false;
            this.stepMode = Boolean(options.step);
            this.runUntilBoundary = Boolean(options.untilBoundary);
            this.startTime = Date.now();
            pauseButton.innerHTML = 'Pause';
            this.currentAlgorithm = this.getSelectedAlgorithm();
            this.clearSearchState();
            this.setRunState("running");

            showToast(`Starting ${algorithmNames[this.currentAlgorithm]}...`, "info");

            switch (this.currentAlgorithm) {
                case "dfs":
                    await this.depthFirstSearch(run);
                    break;
                case "bfs":
                    await this.breadthFirstSearch(run);
                    break;
                case "dijkstra":
                    await this.dijkstraSearch(run);
                    break;
                case "astar":
                    await this.aStarSearch(run);
                    break;
                case "multi":
                    await this.multiSourceBFS(run);
                    break;
                case "islands":
                    await this.countIslands(run);
                    break;
                case "zeroone":
                    await this.zeroOneBFS(run);
                    break;
                default:
                    break;
            }

            if (!this.isActive(run)) return;

            this.currentCell = null;
            this.scanCell = null;
            this.updateStats();
            this.finishStatus();
            this.searchingInProgress = false;
            this.stepMode = false;
            this.runUntilBoundary = false;
            this.setRunState("done");
            this.drawMaze();

            if (this.currentAlgorithm === "multi") {
                showToast(`Every reachable cell reached after ${this.level} level${this.level === 1 ? "" : "s"}`, "success");
            } else if (this.currentAlgorithm === "islands") {
                showToast(`Found ${this.islands} island${this.islands === 1 ? "" : "s"}`, "success");
            } else if (this.path.length > 0) {
                showToast(`Path found! Length: ${this.path.length - 1}` + (this.hasMud() || this.currentAlgorithm === "zeroone" ? `, cost ${this.pathCost()}` : ""), "success");
            } else {
                showToast("No path found!", "warning");
            }
        }

        finishStatus() {
            const mode = this.currentAlgorithm;
            if (mode === "multi") {
                const open = this.maze.flat().filter((cell) => !cell.wall).length;
                const missed = open - this.closedSet.length;
                this.setStatus(`Done. Queue empty after level ${this.level}, so ${this.level} level${this.level === 1 ? "" : "s"} were needed.` +
                    (missed ? ` ${missed} open cell${missed === 1 ? " was" : "s were"} never reached.` : ""));
            } else if (mode === "islands") {
                this.setStatus(`Done. Scanned every cell and found ${this.islands} island${this.islands === 1 ? "" : "s"}.`);
            } else if (mode === "zeroone" && this.path.length > 0) {
                const broken = this.pathCost();
                const length = this.path.length - 1;
                this.setStatus(`Done. 0-1 BFS breaks through ${broken} wall${broken === 1 ? "" : "s"}: cost ${broken}, ${length} step${length === 1 ? "" : "s"}.`);
            } else if (this.path.length > 0 && this.hasMud()) {
                // On a weighted grid, say which quantity each algorithm minimised.
                const length = this.path.length - 1;
                const notes = {
                    dfs: "a path, not the cheapest or the shortest",
                    bfs: "the fewest steps, ignoring mud",
                    dijkstra: "the cheapest path",
                    astar: "the cheapest path"
                };
                this.setStatus(`Done. ${algorithmNames[mode]} found ${notes[mode]}: ${length} step${length === 1 ? "" : "s"}, cost ${this.pathCost()}.`);
            } else if (this.path.length > 0) {
                const length = this.path.length - 1;
                const note = mode === "dfs" ? "a path, not necessarily the shortest" : "the shortest path";
                this.setStatus(`Done. ${algorithmNames[mode]} found ${note}: ${length} step${length === 1 ? "" : "s"}, ${this.closedSet.length} cells visited.`);
            } else {
                this.setStatus(`Done. No path: ${this.closedSet.length} cells visited and the target was never reached.`);
            }
        }

        togglePause() {
            if (this.searchingInProgress) {
                this.paused = !this.paused;
                pauseButton.innerHTML = this.paused ?
                    'Resume' :
                    'Pause';

                if (this.paused) {
                    this.setRunState("paused");
                    showToast("Search paused", "info");
                } else {
                    this.setRunState("running");
                    showToast("Search resumed", "info");
                }
            }
        }

        // Reset clears the search and rebuilds the maze from the current seed, which
        // also discards hand-drawn walls. "New maze" is the way to get a fresh one.
        resetMaze(options = {}) {
            this.stopSearch();
            this.startTime = null;
            this.initializeMaze();
            this.clearSearchState();
            this.updateModeUI();
            this.setRunState("idle");
            this.setStatus(this.idleStatus());
            this.updateStats();
            this.drawMaze();

            cellsVisitedEl.textContent = "0";
            pathLengthEl.textContent = "0";
            if (pathCostEl) pathCostEl.textContent = "0";
            elapsedTimeEl.textContent = "0ms";

            if (!options.quiet) showToast("Grid reset", "info");
        }

        newMaze() {
            this.seed = this.seed >= 2147483646 ? 1 : this.seed + 1;
            if (seedInput) seedInput.value = this.seed;
            this.resetMaze({ quiet: true });
            showToast(`New maze, seed ${this.seed}`, "info");
        }

        handleSeedChange() {
            this.seed = clampInt(seedInput.value, 1, 2147483646, this.seed);
            seedInput.value = this.seed;
            this.resetMaze({ quiet: true });
        }

        stepSearch() {
            if (this.searchingInProgress) {
                this.stepMode = true;
                this.runUntilBoundary = false;
                this.paused = false;
                this.setRunState("running");
            } else {
                this.startSearch({ step: true });
            }
        }

        stepToBoundary() {
            if (this.searchingInProgress) {
                this.stepMode = true;
                this.runUntilBoundary = true;
                this.paused = false;
                this.setRunState("running");
            } else {
                this.startSearch({ step: true, untilBoundary: true });
            }
        }

        handleAlgorithmChange() {
            this.stopSearch();
            this.updateAlgorithmName();
            this.updateModeUI();
            // The maze stays exactly as it is; only the search state is cleared.
            this.startTime = null;
            this.clearSearchState();
            this.setRunState("idle");
            this.setStatus(this.idleStatus());
            this.updateStats();
            this.drawMaze();

            cellsVisitedEl.textContent = "0";
            pathLengthEl.textContent = "0";
            if (pathCostEl) pathCostEl.textContent = "0";
            elapsedTimeEl.textContent = "0ms";

            const mode = this.getSelectedAlgorithm();
            showToast(`Algorithm changed to ${algorithmNames[mode]}`, "info");
            if (mode === "islands" && this.wallDensity < 40) {
                showToast("Tip: a water density of 50-60% gives many islands", "info");
            }
        }

        handleSpeedChange() {
            this.speed = parseInt(speedInput.value) || 50;
        }

        handleGridSizeChange() {
            const size = clampInt(gridSizeInput.value, 5, 50, null);
            if (size === null) return;
            this.gridSize = size;
            this.resetMaze({ quiet: true });
            setCanvasSize();
        }

        handleWallDensityChange() {
            this.wallDensity = clampInt(wallDensityInput.value, 0, MAX_DENSITY, DEFAULT_WALL_DENSITY);
            this.updateDensityLabel();
            this.resetMaze({ quiet: true });
        }

        handleMudDensityChange() {
            this.mudDensity = clampInt(mudDensityInput.value, 0, MAX_MUD_DENSITY, DEFAULT_MUD_DENSITY);
            this.updateDensityLabel();
            this.resetMaze({ quiet: true });
            this.updateModeUI();
        }

        updateDensityLabel() {
            if (wallDensityValue) wallDensityValue.textContent = `${this.wallDensity}%`;
            if (mudDensityValue) mudDensityValue.textContent = `${this.mudDensity}%`;
        }

        clickMode() {
            const mode = this.mode();
            const checked = clickModeInputs.find((input) => input.checked);
            if (!checked || mode === "islands") return "walls";
            if (checked.value === "sources" && mode !== "multi") return "walls";
            return checked.value;
        }

        handleCanvasClick(e) {
            const rect = mazeCanvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const i = Math.floor(y / this.cellSize);
            const j = Math.floor(x / this.cellSize);
            if (i < 0 || i >= this.gridSize || j < 0 || j >= this.gridSize) return;
            const cell = this.maze[i][j];

            if (this.clickMode() === "sources") {
                if (this.searchingInProgress) {
                    showToast("Reset or let the run finish before moving sources", "warning");
                    return;
                }
                if (this.sources.has(cell)) {
                    this.sources.delete(cell);
                } else {
                    cell.wall = false;
                    this.sources.add(cell);
                }
                this.sourcePrefs = Array.from(this.sources).map((source) => [source.y, source.x]);
                this.clearSearchState();
                this.setRunState("idle");
                this.setStatus(this.idleStatus());
                this.updateStats();
                this.drawMaze();
                return;
            }

            if (cell === this.startNode || cell === this.endNode || this.sources.has(cell)) return;

            if (this.clickMode() === "mud") {
                if (this.searchingInProgress) {
                    showToast("Reset or let the run finish before painting mud", "warning");
                    return;
                }
                // Painting over a wall turns it into mud; painting mud again clears it.
                const mud = cell.wall || cell.cost === 1;
                cell.wall = false;
                cell.cost = mud ? MUD_COST : 1;
                this.updateModeUI();
                this.drawMaze();
                return;
            }

            cell.wall = !cell.wall;
            cell.cost = 1;
            this.updateModeUI();
            this.drawMaze();
        }

        // One checkpoint per algorithm step. "boundary" marks the last step of a BFS
        // level (or of an island's flood), where Step level stops.
        async delay(run, boundary = false) {
            this.updateStats();
            this.drawMaze();
            if (!this.isActive(run)) return;

            if (this.runUntilBoundary && boundary) {
                this.runUntilBoundary = false;
                this.stepMode = true;
            }

            if (this.stepMode && !this.runUntilBoundary) {
                this.paused = true;
                this.setRunState("paused");
                while (this.paused && this.isActive(run)) {
                    await sleep(16);
                }
            } else {
                const maxDelay = 200;
                const minDelay = 5;
                const delayTime = Math.round(maxDelay - ((this.speed - 1) / 9) * (maxDelay - minDelay));
                await sleep(delayTime);
                if (this.paused) this.setRunState("paused");
                while (this.paused && this.isActive(run)) {
                    await sleep(16);
                }
            }
            if (this.isActive(run)) this.setRunState("running");
        }

        getNeighbors(cell) {
            const neighbors = [];
            const {
                x,
                y
            } = cell;
            if (y > 0) neighbors.push(this.maze[y - 1][x]);
            if (x < this.gridSize - 1) neighbors.push(this.maze[y][x + 1]);
            if (y < this.gridSize - 1) neighbors.push(this.maze[y + 1][x]);
            if (x > 0) neighbors.push(this.maze[y][x - 1]);
            return neighbors.filter(n => !n.wall);
        }

        markClosed(cell) {
            cell.closed = true;
            cell.frontier = false;
            this.closedSet.push(cell);
        }

        // Iterative DFS with an explicit stack of (cell, neighbour iterator) frames.
        // Each step either goes one cell deeper or pops a dead end (backtracks), so the
        // stack is always the current path from the start. O(V + E) overall.
        async depthFirstSearch(run) {
            const frame = (cell) => ({
                cell,
                neighbors: this.getNeighbors(cell),
                next: 0
            });
            const stack = [frame(this.startNode)];
            this.startNode.visited = true;
            this.startNode.onStack = true;
            this.markClosed(this.startNode);
            this.stackCells = [this.startNode];
            this.currentCell = this.startNode;

            if (this.startNode === this.endNode) {
                this.buildPath(this.startNode);
                return;
            }

            this.setStatus(`Push start ${label(this.startNode)}. Stack depth 1.`);
            await this.delay(run);

            while (stack.length > 0) {
                if (!this.isActive(run)) return;
                const top = stack[stack.length - 1];
                let next = null;
                while (top.next < top.neighbors.length) {
                    const candidate = top.neighbors[top.next++];
                    if (!candidate.visited && !candidate.wall) {
                        next = candidate;
                        break;
                    }
                }

                if (next) {
                    next.visited = true;
                    next.previous = top.cell;
                    next.distance = top.cell.distance + 1;
                    next.onStack = true;
                    this.markClosed(next);
                    stack.push(frame(next));
                    this.stackCells.push(next);
                    this.currentCell = next;
                    if (next === this.endNode) {
                        this.setStatus(`Reached the target ${label(next)}. The stack is the path.`);
                        this.buildPath(next);
                        return;
                    }
                    this.setStatus(`Go deeper: push ${label(next)}. Stack depth ${stack.length}.`);
                } else {
                    stack.pop();
                    this.stackCells.pop();
                    top.cell.onStack = false;
                    const back = stack[stack.length - 1];
                    this.currentCell = back ? back.cell : null;
                    this.setStatus(back ?
                        `Dead end at ${label(top.cell)}: pop and backtrack to ${label(back.cell)}. Stack depth ${stack.length}.` :
                        `Dead end at ${label(top.cell)}: the stack is empty.`);
                }
                await this.delay(run);
            }
        }

        async breadthFirstSearch(run) {
            const queue = [this.startNode];
            let head = 0;
            this.startNode.visited = true;
            this.startNode.frontier = true;
            this.startNode.distance = 0;
            while (head < queue.length) {
                if (!this.isActive(run)) return;
                const current = queue[head++];
                this.markClosed(current);
                this.currentCell = current;
                if (current === this.endNode) {
                    this.buildPath(current);
                    break;
                }
                const neighbors = this.getNeighbors(current);
                let pushed = 0;
                for (let neighbor of neighbors) {
                    if (!neighbor.visited) {
                        // Mark when you push: a cell enters the queue at most once.
                        neighbor.visited = true;
                        neighbor.frontier = true;
                        neighbor.distance = current.distance + 1;
                        neighbor.previous = current;
                        queue.push(neighbor);
                        pushed += 1;
                    }
                }
                const waiting = queue.length - head;
                this.setStatus(`Level ${current.distance}: dequeue ${label(current)}, push ${pushed} at level ${current.distance + 1}. Queue holds ${waiting}.`);
                const boundary = head >= queue.length || queue[head].distance > current.distance;
                await this.delay(run, boundary);
            }
        }

        // Rotting-oranges style BFS: every source starts in the queue at level 0 and
        // each level is processed as a block whose size is read before it starts.
        async multiSourceBFS(run) {
            const queue = this.getSources();
            let head = 0;
            queue.forEach((cell) => {
                cell.visited = true;
                cell.frontier = true;
                cell.distance = 0;
            });
            let level = 0;
            this.level = 0;
            while (head < queue.length) {
                const levelSize = queue.length - head;
                this.level = level;
                for (let k = 0; k < levelSize; k++) {
                    if (!this.isActive(run)) return;
                    const current = queue[head++];
                    this.markClosed(current);
                    this.currentCell = current;
                    let pushed = 0;
                    for (let neighbor of this.getNeighbors(current)) {
                        if (!neighbor.visited) {
                            neighbor.visited = true;
                            neighbor.frontier = true;
                            neighbor.distance = level + 1;
                            neighbor.previous = current;
                            queue.push(neighbor);
                            pushed += 1;
                        }
                    }
                    const next = queue.length - head - (levelSize - k - 1);
                    this.setStatus(`Level ${level}: cell ${k + 1} of ${levelSize}, dequeue ${label(current)}, push ${pushed}. Next level has ${next} so far.`);
                    await this.delay(run, k === levelSize - 1);
                }
                if (head < queue.length) level += 1;
            }
            this.level = level;
        }

        // Number of Islands: scan row by row; every unvisited land cell starts a new
        // island, which is flooded with BFS and coloured before the scan moves on.
        async countIslands(run) {
            for (let i = 0; i < this.gridSize; i++) {
                for (let j = 0; j < this.gridSize; j++) {
                    if (!this.isActive(run)) return;
                    const cell = this.maze[i][j];
                    this.scanCell = cell;
                    this.currentCell = null;
                    if (cell.wall || cell.visited) {
                        this.setStatus(cell.wall ?
                            `Scan ${label(cell)}: water, skip.` :
                            `Scan ${label(cell)}: already part of island ${cell.component + 1}, skip.`);
                        await this.delay(run);
                        continue;
                    }

                    this.islands += 1;
                    const component = this.islands - 1;
                    const queue = [cell];
                    let head = 0;
                    cell.visited = true;
                    cell.frontier = true;
                    cell.component = component;
                    cell.distance = 0;
                    this.setStatus(`Scan ${label(cell)}: unvisited land. Island ${this.islands} found, flood it.`);
                    await this.delay(run);

                    while (head < queue.length) {
                        if (!this.isActive(run)) return;
                        const current = queue[head++];
                        this.markClosed(current);
                        this.currentCell = current;
                        for (let neighbor of this.getNeighbors(current)) {
                            if (!neighbor.visited) {
                                neighbor.visited = true;
                                neighbor.frontier = true;
                                neighbor.component = component;
                                neighbor.distance = current.distance + 1;
                                queue.push(neighbor);
                            }
                        }
                        const done = head >= queue.length;
                        this.setStatus(done ?
                            `Island ${this.islands} flooded: ${queue.length} cell${queue.length === 1 ? "" : "s"}. Resume the scan.` :
                            `Flood island ${this.islands}: ${head} of ${queue.length} cells so far.`);
                        await this.delay(run, done);
                    }
                }
            }
            this.scanCell = null;
        }

        // 0-1 BFS (Minimum Obstacle Removal): moving into an open cell costs 0 and
        // breaking into a wall costs 1. A 0-cost move goes to the front of the deque,
        // a 1-cost move to the back, so the deque stays sorted by cost without a heap.
        // An entry whose cell was finished cheaper in the meantime is stale and skipped.
        async zeroOneBFS(run) {
            const deque = [{ cell: this.startNode, d: 0 }];
            this.deque = deque;
            this.dequeNew = new Set(deque);
            this.startNode.distance = 0;
            this.startNode.visited = true;
            this.startNode.frontier = true;
            this.setStatus(`Push the start ${label(this.startNode)} at cost 0.`);
            await this.delay(run);

            while (deque.length > 0) {
                if (!this.isActive(run)) return;
                const entry = deque.shift();
                const cell = entry.cell;
                this.dequeNew = new Set();
                if (cell.closed || entry.d > cell.distance) {
                    this.currentCell = cell;
                    this.setStatus(`Pop ${label(cell)} at cost ${entry.d}: stale, it is already done at ${cell.distance}. Skip.`);
                    await this.delay(run, !deque.length || deque[0].d > entry.d);
                    continue;
                }
                this.markClosed(cell);
                this.currentCell = cell;
                this.level = entry.d;
                if (cell === this.endNode) {
                    this.setStatus(`Pop the target ${label(cell)} at cost ${entry.d}.`);
                    this.buildPath(cell);
                    return;
                }
                let front = 0;
                let back = 0;
                for (const next of this.allNeighbors(cell)) {
                    if (next.closed) continue;
                    const weight = next.wall ? 1 : 0;
                    const d = entry.d + weight;
                    if (d >= next.distance) continue;
                    next.distance = d;
                    next.previous = cell;
                    next.visited = true;
                    next.frontier = true;
                    const item = { cell: next, d };
                    if (weight === 0) {
                        deque.unshift(item);
                        front += 1;
                    } else {
                        deque.push(item);
                        back += 1;
                    }
                    this.dequeNew.add(item);
                }
                const parts = [];
                if (front) parts.push(`${front} open cell${front === 1 ? "" : "s"} to the front at ${entry.d}`);
                if (back) parts.push(`${back} wall${back === 1 ? "" : "s"} to the back at ${entry.d + 1}`);
                this.setStatus(`Pop ${label(cell)} at cost ${entry.d}.` + (parts.length ? ` Push ${parts.join(", ")}.` : " Nothing new to push."));
                await this.delay(run, !deque.length || deque[0].d > entry.d);
            }
        }

        async dijkstraSearch(run) {
            this.startNode.distance = 0;
            const unvisited = [];
            for (let row of this.maze) {
                for (let cell of row) {
                    if (!cell.wall) {
                        unvisited.push(cell);
                    }
                }
            }
            this.startNode.frontier = true;
            while (unvisited.length > 0) {
                if (!this.isActive(run)) return;
                unvisited.sort((a, b) => a.distance - b.distance);
                const current = unvisited.shift();
                if (current.distance === Infinity) break;
                current.visited = true;
                this.markClosed(current);
                this.currentCell = current;
                if (current === this.endNode) {
                    this.buildPath(current);
                    break;
                }
                const neighbors = this.getNeighbors(current);
                let improved = 0;
                for (let neighbor of neighbors) {
                    if (!neighbor.visited) {
                        // Stepping into a cell costs that cell's weight: 1, or 5 for mud.
                        const alt = current.distance + this.stepCost(neighbor);
                        if (alt < neighbor.distance) {
                            neighbor.distance = alt;
                            neighbor.previous = current;
                            neighbor.frontier = true;
                            improved += 1;
                        }
                    }
                }
                this.setStatus(this.hasMud() ?
                    `Settle the cheapest cell ${label(current)} at cost ${current.distance}. ${improved} neighbour${improved === 1 ? "" : "s"} got cheaper.` :
                    `Settle ${label(current)} at distance ${current.distance}.`);
                await this.delay(run);
            }
        }

        async aStarSearch(run) {
            this.startNode.distance = 0;
            this.startNode.heuristic = this.heuristic(this.startNode, this.endNode);
            this.openSet.push(this.startNode);
            this.startNode.frontier = true;
            const openSetMap = new Set([this.startNode]);
            const closedSetMap = new Set();

            while (this.openSet.length > 0) {
                if (!this.isActive(run)) return;
                this.openSet.sort((a, b) => (a.distance + a.heuristic) - (b.distance + b.heuristic));
                const current = this.openSet.shift();
                openSetMap.delete(current);
                current.frontier = false;
                this.currentCell = current;

                if (current === this.endNode) {
                    this.buildPath(current);
                    break;
                }

                this.markClosed(current);
                closedSetMap.add(current);

                const neighbors = this.getNeighbors(current);
                for (let neighbor of neighbors) {
                    const tentativeG = current.distance + this.stepCost(neighbor);

                    if (closedSetMap.has(neighbor)) {
                        if (tentativeG >= neighbor.distance) {
                            continue;
                        }
                        closedSetMap.delete(neighbor);
                        neighbor.closed = false;
                        const closedIndex = this.closedSet.indexOf(neighbor);
                        if (closedIndex !== -1) {
                            this.closedSet.splice(closedIndex, 1);
                        }
                    }

                    if (!openSetMap.has(neighbor)) {
                        neighbor.distance = tentativeG;
                        neighbor.heuristic = this.heuristic(neighbor, this.endNode);
                        neighbor.previous = current;
                        neighbor.frontier = true;
                        this.openSet.push(neighbor);
                        openSetMap.add(neighbor);
                    } else if (tentativeG < neighbor.distance) {
                        neighbor.distance = tentativeG;
                        neighbor.heuristic = this.heuristic(neighbor, this.endNode);
                        neighbor.previous = current;
                    }
                }
                this.setStatus(`Expand ${label(current)}: f = g ${current.distance} + h ${current.heuristic}. Open set holds ${this.openSet.length}.`);
                await this.delay(run);
            }
        }

        heuristic(a, b) {
            return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
        }

        buildPath(endNode) {
            let current = endNode;
            this.path = [];
            while (current) {
                this.path.push(current);
                current.onPath = true;
                current = current.previous;
            }
            this.path.reverse();
            this.drawMaze();
        }

        colors(p) {
            return {
                bg: p.canvas,
                wall: p.ink3,
                water: p.gold,
                land: p.isDark ? p.ink2 : p.ink3,
                start: p.verdigris,
                end: p.rose,
                path: p.gold,
                visited: p.moon,
                frontier: p.gold,
                mud: p.ember,
                ink: p.ink,
                onSolid: p.isDark ? p.canvas : "#ffffff",
                // Land is neutral grey and water is the accent, so islands use the other hues.
                islands: [p.verdigris, p.ember, p.moon, p.rose]
            };
        }

        drawMaze() {
            if (!this.maze.length) return;
            const p = palette();
            const c = this.colors(p);
            const cs = this.cellSize;
            const n = this.gridSize;
            const extent = n * cs;
            const mode = this.searchingInProgress ? this.currentAlgorithm : this.mode();
            const islandsMode = mode === "islands";
            const multiMode = mode === "multi";
            const zeroOneMode = mode === "zeroone";
            const sourceCells = multiMode ? new Set(this.getSources()) : null;
            const inset = Math.max(1, Math.round(cs * 0.08));

            ctx.save();
            ctx.clearRect(0, 0, extent, extent);
            ctx.fillStyle = c.bg;
            ctx.fillRect(0, 0, extent, extent);

            const fill = (cell, color, alpha = 1, pad = 0) => {
                ctx.globalAlpha = alpha;
                ctx.fillStyle = color;
                ctx.fillRect(cell.x * cs + pad, cell.y * cs + pad, cs - pad * 2, cs - pad * 2);
                ctx.globalAlpha = 1;
            };
            // Mud: a brown fill (the ember hue pulled toward the ink) with three square
            // specks, so it reads as terrain and never as a wall, a visited cell or the path.
            const speck = Math.max(2, Math.round(cs * 0.11));
            const specks = [[0.24, 0.28], [0.6, 0.2], [0.42, 0.64], [0.7, 0.62]];
            const drawSpecks = (cell, color, alpha, box = { x: 0, y: 0, w: cs }) => {
                ctx.globalAlpha = alpha;
                ctx.fillStyle = color;
                specks.forEach(([fx, fy]) => {
                    ctx.fillRect(Math.round(cell.x * cs + box.x + fx * box.w), Math.round(cell.y * cs + box.y + fy * box.w), speck, speck);
                });
                ctx.globalAlpha = 1;
            };
            const mudFill = (cell, pad = 0) => {
                if (pad) fill(cell, c.bg, 1, pad);
                fill(cell, c.mud, p.isDark ? 0.58 : 0.66, pad);
                fill(cell, p.isDark ? c.bg : c.ink, p.isDark ? 0.12 : 0.2, pad);
            };
            const drawMud = (cell, pad = 0) => {
                mudFill(cell, pad);
                const w = cs - pad * 2;
                drawSpecks(cell, p.isDark ? c.bg : c.ink, p.isDark ? 0.5 : 0.3, { x: pad, y: pad, w });
            };
            const outline = (cell, color, width) => {
                ctx.strokeStyle = color;
                ctx.lineWidth = width;
                const half = width / 2 + inset;
                ctx.strokeRect(cell.x * cs + half, cell.y * cs + half, cs - half * 2, cs - half * 2);
            };

            for (let i = 0; i < n; i++) {
                for (let j = 0; j < n; j++) {
                    const cell = this.maze[i][j];

                    if (islandsMode) {
                        if (cell.wall) {
                            fill(cell, c.water, p.isDark ? 0.2 : 0.3);
                        } else if (cell.component < 0) {
                            // Unvisited land: a light neutral, clearly brighter than the water.
                            fill(cell, c.land, p.isDark ? 0.5 : 0.16);
                        } else {
                            const color = c.islands[cell.component % c.islands.length];
                            fill(cell, color, cell.frontier ? 0.35 : (p.isDark ? 0.85 : 0.8));
                            if (cell.frontier) outline(cell, color, Math.max(1.5, cs * 0.06));
                        }
                        continue;
                    }

                    if (cell.wall) {
                        const wallAlpha = p.isDark ? 0.55 : 0.85;
                        const core = Math.round(cs * 0.24);
                        // 0-1 BFS walks into walls at cost 1; the wall keeps its colour as a core.
                        if (zeroOneMode && cell.onPath) {
                            fill(cell, c.path);
                            fill(cell, c.bg, 1, core);
                            fill(cell, c.wall, wallAlpha, core);
                        } else if (zeroOneMode && cell.closed) {
                            fill(cell, c.visited, p.isDark ? 0.36 : 0.22);
                            fill(cell, c.bg, 1, Math.max(2, Math.round(cs * 0.12)));
                            fill(cell, c.wall, wallAlpha, Math.max(2, Math.round(cs * 0.12)));
                        } else {
                            fill(cell, c.wall, wallAlpha);
                            if (zeroOneMode && cell.frontier) outline(cell, c.frontier, Math.max(2, cs * 0.07));
                        }
                        continue;
                    }
                    if (multiMode && sourceCells.has(cell)) {
                        fill(cell, c.start);
                        continue;
                    }
                    if (!multiMode && cell === this.startNode) {
                        fill(cell, c.start);
                        continue;
                    }
                    if (!multiMode && cell === this.endNode) {
                        fill(cell, c.end);
                        if (cell.onPath) outline(cell, c.path, Math.max(2, cs * 0.08));
                        continue;
                    }
                    const mud = cell.cost > 1 && !zeroOneMode;
                    if (cell.onPath) {
                        fill(cell, c.path);
                        if (mud) {
                            // The path keeps its colour; a mud core shows it went through mud.
                            mudFill(cell, Math.round(cs * 0.24));
                        }
                        continue;
                    }
                    if (mud && cell.closed && !cell.onStack && !cell.frontier) {
                        // Visited mud: the visited tint shows as a ring, the mud keeps its colour.
                        fill(cell, c.visited, p.isDark ? 0.36 : 0.22);
                        drawMud(cell, Math.max(2, Math.round(cs * 0.12)));
                        continue;
                    }
                    if (mud) drawMud(cell);
                    if (cell.onStack) {
                        fill(cell, c.frontier, p.isDark ? 0.2 : 0.14);
                    } else if (cell.frontier) {
                        fill(cell, c.frontier, p.isDark ? 0.16 : 0.1);
                        outline(cell, c.frontier, Math.max(2, cs * 0.07));
                    } else if (cell.closed) {
                        fill(cell, c.visited, p.isDark ? 0.36 : 0.22);
                    }
                }
            }

            if (this.showGridLines) {
                ctx.strokeStyle = p.rule;
                ctx.lineWidth = 1;
                ctx.globalAlpha = islandsMode ? 0.6 : 1;
                ctx.beginPath();
                for (let k = 0; k <= n; k++) {
                    const offset = Math.min(k * cs, extent - 1) + .5;
                    ctx.moveTo(offset, 0);
                    ctx.lineTo(offset, extent);
                    ctx.moveTo(0, offset);
                    ctx.lineTo(extent, offset);
                }
                ctx.stroke();
                ctx.globalAlpha = 1;
            }

            // DFS: the stack is the current path from the start; draw it as a line.
            if (mode === "dfs" && this.stackCells.length > 1 && !this.path.length) {
                ctx.strokeStyle = c.frontier;
                ctx.lineWidth = Math.max(2, cs * 0.14);
                ctx.lineJoin = "miter";
                ctx.lineCap = "square";
                ctx.beginPath();
                this.stackCells.forEach((cell, index) => {
                    const cx = cell.x * cs + cs / 2;
                    const cy = cell.y * cs + cs / 2;
                    if (index === 0) ctx.moveTo(cx, cy);
                    else ctx.lineTo(cx, cy);
                });
                ctx.stroke();
            }

            if (this.currentCell && this.searchingInProgress && !this.currentCell.wall) {
                outline(this.currentCell, c.ink, Math.max(2, cs * 0.08));
            }

            if (islandsMode && this.scanCell) {
                ctx.strokeStyle = c.ink;
                ctx.lineWidth = Math.max(2, cs * 0.1);
                const w = ctx.lineWidth;
                ctx.strokeRect(this.scanCell.x * cs + w / 2, this.scanCell.y * cs + w / 2, cs - w, cs - w);
                // A thin rule along the scanned row reads as the scan line.
                ctx.globalAlpha = 0.5;
                ctx.fillStyle = c.ink;
                ctx.fillRect(0, this.scanCell.y * cs + cs - 2, this.scanCell.x * cs, 2);
                ctx.globalAlpha = 1;
            }

            if (this.showDistances && !islandsMode && n <= DISTANCE_LABEL_MAX_SIZE && cs >= 14) {
                const mono = getComputedStyle(document.body).getPropertyValue("--g-font-mono").trim() || "monospace";
                ctx.font = `600 ${Math.max(9, Math.round(cs * 0.38))}px ${mono}`;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                for (let i = 0; i < n; i++) {
                    for (let j = 0; j < n; j++) {
                        const cell = this.maze[i][j];
                        if ((cell.wall && !zeroOneMode) || !cell.visited || !Number.isFinite(cell.distance)) continue;
                        const solid = cell.onPath || (multiMode ? sourceCells.has(cell) : cell === this.startNode || cell === this.endNode);
                        ctx.fillStyle = solid ? c.onSolid : c.ink;
                        ctx.fillText(String(cell.distance), cell.x * cs + cs / 2, cell.y * cs + cs / 2 + 1);
                    }
                }
            }
            ctx.restore();
        }

        snapshot() {
            const cells = (list) => list.map((cell) => [cell.y, cell.x]);
            return {
                algorithm: this.mode(),
                state: this.runState,
                size: this.gridSize,
                density: this.wallDensity,
                seed: this.seed,
                walls: this.maze.map((row) => row.map((cell) => (cell.wall ? "#" : ".")).join("")),
                mudDensity: this.mudDensity,
                mud: this.maze.map((row) => row.map((cell) => (!cell.wall && cell.cost > 1 ? "~" : ".")).join("")),
                mudCost: MUD_COST,
                start: [this.startNode.y, this.startNode.x],
                end: [this.endNode.y, this.endNode.x],
                sources: cells(this.getSources()),
                visited: this.closedSet.length,
                pathLength: this.path.length ? this.path.length - 1 : 0,
                pathCost: this.pathCost(),
                path: cells(this.path),
                stack: cells(this.stackCells),
                deque: (this.deque || []).map((entry) => [entry.cell.y, entry.cell.x, entry.d]),
                level: this.level,
                islands: this.islands,
                distances: this.maze.map((row) => row.map((cell) => (Number.isFinite(cell.distance) && cell.visited ? cell.distance : null))),
                components: this.maze.map((row) => row.map((cell) => cell.component)),
                status: this.statusText
            };
        }
    }

    const visualizer = new MazeVisualizer();
    visualizer.updateDensityLabel();

    window.GraphsDebug = {
        snapshot: () => visualizer.snapshot(),
        mulberry32
    };

    window.addEventListener("resize", setCanvasSize);
    window.ToolShared?.onThemeChange?.(() => visualizer.drawMaze());
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => visualizer.drawMaze());

    setCanvasSize();
});
