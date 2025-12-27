// Helper function for dark mode color selection
function getColorForMode(colorLight, colorDark) {
    const darkMode = document.cookie.split('; ').find(row => row.startsWith('darkMode='));
    const isDark = darkMode && darkMode.split('=')[1].toLowerCase() === 'true';
    return isDark ? colorDark : colorLight;
}

document.addEventListener("DOMContentLoaded", function() {

    const DEFAULT_GRID_SIZE = 20;
    const DEFAULT_SPEED = 5;
    const DEFAULT_WALL_DENSITY = 30;
    const DEFAULT_SHOW_GRID_LINES = true;
    const DEFAULT_ALGORITHM = "dfs";

    const algorithmSelect = document.getElementById("algorithm");
    const mazeCanvas = document.getElementById("maze-canvas");
    const startButton = document.getElementById("start");
    const pauseButton = document.getElementById("pause");
    const resetButton = document.getElementById("reset");
    const stepButton = document.getElementById("step");
    const speedInput = document.getElementById("speed");
    const gridSizeInput = document.getElementById("grid-size");
    const wallDensityInput = document.getElementById("wall-density");
    const showGridLinesCheckbox = document.getElementById("show-grid-lines");
    const resetDefaultsButton = document.getElementById("reset-defaults");
    const toastContainer = document.getElementById("toast-container");


    const cellsVisitedEl = document.getElementById("cells-visited");
    const pathLengthEl = document.getElementById("path-length");
    const elapsedTimeEl = document.getElementById("elapsed-time");
    const algorithmNameEl = document.getElementById("algorithm-name");


    const algorithmNames = {
        "dfs": "DFS",
        "bfs": "BFS",
        "dijkstra": "Dijkstra",
        "astar": "A*"
    };


    function showToast(message, type = "info") {
        const toast = document.createElement("div");
        toast.className = `toast ${type}`;

        const icons = {
            success: "✅",
            error: "❌",
            info: "ℹ️",
            warning: "⚠️"
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


    document.querySelectorAll(".card-toggle").forEach(toggle => {
        toggle.addEventListener("click", () => {
            const expanded = toggle.getAttribute("aria-expanded") === "true";
            toggle.setAttribute("aria-expanded", !expanded);
        });
    });

    function setCanvasSize() {
        const availableWidth = window.innerWidth * 0.95;
        const availableHeight = window.innerHeight * 0.6;
        const maxSize = 600;

        const size = Math.min(availableWidth, availableHeight, maxSize);

        mazeCanvas.width = size;
        mazeCanvas.height = size;

        visualizer.cellSize = Math.floor(size / visualizer.gridSize);
        visualizer.drawMaze();
    }

    const ctx = mazeCanvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;

    class MazeVisualizer {
        constructor() {
            this.gridSize = parseInt(gridSizeInput.value) || DEFAULT_GRID_SIZE;
            this.cellSize = Math.floor(mazeCanvas.width / this.gridSize);
            this.wallDensity = parseInt(wallDensityInput?.value) || DEFAULT_WALL_DENSITY;
            this.maze = [];
            this.speed = parseInt(speedInput.value) || DEFAULT_SPEED;
            this.paused = false;
            this.stepMode = false;
            this.searchingInProgress = false;
            this.startNode = null;
            this.endNode = null;
            this.openSet = [];
            this.closedSet = [];
            this.path = [];
            this.currentAlgorithm = this.getSelectedAlgorithm();
            this.showGridLines = showGridLinesCheckbox?.checked !== false;
            this.startTime = null;
            this.initializeMaze();
            this.bindEvents();
            this.drawMaze();
            this.updateAlgorithmName();
        }

        bindEvents() {
            startButton.addEventListener("click", () => this.startSearch());
            pauseButton.addEventListener("click", () => this.togglePause());
            resetButton.addEventListener("click", () => this.resetMaze());
            stepButton.addEventListener("click", () => this.stepSearch());
            algorithmSelect.addEventListener("change", () => this.handleAlgorithmChange());
            speedInput.addEventListener("input", () => this.handleSpeedChange());
            gridSizeInput.addEventListener("input", () => this.handleGridSizeChange());
            mazeCanvas.addEventListener("click", (e) => this.handleCanvasClick(e));

            if (wallDensityInput) {
                wallDensityInput.addEventListener("input", () => this.handleWallDensityChange());
            }

            if (showGridLinesCheckbox) {
                showGridLinesCheckbox.addEventListener("change", () => {
                    this.showGridLines = showGridLinesCheckbox.checked;
                    this.drawMaze();
                });
            }

            if (resetDefaultsButton) {
                resetDefaultsButton.addEventListener("click", () => this.resetDefaults());
            }


            document.addEventListener("keydown", (e) => {
                if (e.code === "Space") {
                    e.preventDefault();
                    if (this.searchingInProgress) {
                        this.togglePause();
                    } else {
                        this.startSearch();
                    }
                }
            });
        }

        resetDefaults() {
            gridSizeInput.value = DEFAULT_GRID_SIZE;
            speedInput.value = DEFAULT_SPEED;
            if (wallDensityInput) wallDensityInput.value = DEFAULT_WALL_DENSITY;
            if (showGridLinesCheckbox) showGridLinesCheckbox.checked = DEFAULT_SHOW_GRID_LINES;
            algorithmSelect.value = DEFAULT_ALGORITHM;

            this.gridSize = DEFAULT_GRID_SIZE;
            this.speed = DEFAULT_SPEED;
            this.wallDensity = DEFAULT_WALL_DENSITY;
            this.showGridLines = DEFAULT_SHOW_GRID_LINES;
            this.cellSize = Math.floor(mazeCanvas.width / this.gridSize);
            this.resetMaze();
            this.updateAlgorithmName();
            showToast("Settings reset to defaults", "success");
        }

        updateAlgorithmName() {
            const algo = this.getSelectedAlgorithm();
            algorithmNameEl.textContent = algorithmNames[algo] || algo.toUpperCase();
        }

        updateStats() {
            cellsVisitedEl.textContent = this.closedSet.length;
            pathLengthEl.textContent = this.path.length;

            if (this.startTime) {
                const elapsed = Date.now() - this.startTime;
                elapsedTimeEl.textContent = elapsed + "ms";
            }
        }

        initializeMaze() {
            this.maze = [];
            const density = this.wallDensity / 100;
            for (let i = 0; i < this.gridSize; i++) {
                const row = [];
                for (let j = 0; j < this.gridSize; j++) {
                    row.push({
                        x: j,
                        y: i,
                        wall: Math.random() < density,
                        visited: false,
                        distance: Infinity,
                        heuristic: 0,
                        previous: null
                    });
                }
                this.maze.push(row);
            }
            this.startNode = this.maze[0][0];
            this.endNode = this.maze[this.gridSize - 1][this.gridSize - 1];
            this.startNode.wall = false;
            this.endNode.wall = false;
            this.startNode.distance = 0;
        }

        getSelectedAlgorithm() {
            return algorithmSelect.options[algorithmSelect.selectedIndex].value;
        }

        async startSearch() {
            if (this.searchingInProgress) return;
            this.searchingInProgress = true;
            this.paused = false;
            this.stepMode = false;
            this.startTime = Date.now();
            pauseButton.innerHTML = '<span class="btn-icon">⏸️</span> Pause';
            this.currentAlgorithm = this.getSelectedAlgorithm();
            this.openSet = [];
            this.closedSet = [];
            this.path = [];

            for (let row of this.maze) {
                for (let cell of row) {
                    cell.visited = false;
                    cell.distance = Infinity;
                    cell.previous = null;
                }
            }
            this.startNode.distance = 0;

            showToast(`Starting ${algorithmNames[this.currentAlgorithm]} search...`, "info");

            switch (this.currentAlgorithm) {
                case "dfs":
                    await this.depthFirstSearch();
                    break;
                case "bfs":
                    await this.breadthFirstSearch();
                    break;
                case "dijkstra":
                    await this.dijkstraSearch();
                    break;
                case "astar":
                    await this.aStarSearch();
                    break;
                default:
                    break;
            }

            this.updateStats();

            if (this.path.length > 0) {
                showToast(`Path found! Length: ${this.path.length}`, "success");
            } else if (this.searchingInProgress) {
                showToast("No path found!", "warning");
            }

            this.searchingInProgress = false;
        }

        togglePause() {
            if (this.searchingInProgress) {
                this.paused = !this.paused;
                pauseButton.innerHTML = this.paused ?
                    '<span class="btn-icon">▶️</span> Resume' :
                    '<span class="btn-icon">⏸️</span> Pause';

                if (this.paused) {
                    showToast("Search paused", "info");
                } else {
                    showToast("Search resumed", "info");
                }
            }
        }

        resetMaze() {
            if (this.searchingInProgress) {
                this.searchingInProgress = false;
                this.paused = false;
                pauseButton.innerHTML = '<span class="btn-icon">⏸️</span> Pause';
            }
            this.openSet = [];
            this.closedSet = [];
            this.path = [];
            this.startTime = null;
            this.initializeMaze();
            this.drawMaze();


            cellsVisitedEl.textContent = "0";
            pathLengthEl.textContent = "0";
            elapsedTimeEl.textContent = "0ms";

            showToast("Grid reset", "info");
        }

        stepSearch() {
            if (this.searchingInProgress) {
                this.stepMode = true;
                this.paused = false;
            } else {
                this.startSearch();
                this.stepMode = true;
            }
        }

        handleAlgorithmChange() {
            if (this.searchingInProgress) {
                this.searchingInProgress = false;
                this.paused = false;
                pauseButton.innerHTML = '<span class="btn-icon">⏸️</span> Pause';
            }
            this.updateAlgorithmName();
            this.initializeMaze();
            this.drawMaze();


            cellsVisitedEl.textContent = "0";
            pathLengthEl.textContent = "0";
            elapsedTimeEl.textContent = "0ms";

            showToast(`Algorithm changed to ${algorithmNames[this.getSelectedAlgorithm()]}`, "info");
        }

        handleSpeedChange() {
            this.speed = parseInt(speedInput.value) || 50;
        }

        handleGridSizeChange() {
            this.gridSize = parseInt(gridSizeInput.value) || 20;
            this.cellSize = Math.floor(mazeCanvas.width / this.gridSize);
            this.resetMaze();
        }

        handleWallDensityChange() {
            this.wallDensity = parseInt(wallDensityInput.value) || 30;
            this.resetMaze();
        }

        handleCanvasClick(e) {
            const rect = mazeCanvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const i = Math.floor(y / this.cellSize);
            const j = Math.floor(x / this.cellSize);
            if (i >= 0 && i < this.gridSize && j >= 0 && j < this.gridSize) {
                const cell = this.maze[i][j];
                if (cell !== this.startNode && cell !== this.endNode) {
                    cell.wall = !cell.wall;
                    this.drawMaze();
                }
            }
        }

        async delay() {
            if (this.stepMode) {
                this.paused = true;
                while (this.paused) {
                    await new Promise((resolve) => setTimeout(resolve, 50));
                }
            } else {


                const maxDelay = 200;
                const minDelay = 5;
                const delayTime = Math.round(maxDelay - ((this.speed - 1) / 9) * (maxDelay - minDelay));
                await new Promise((resolve) => setTimeout(resolve, delayTime));
                while (this.paused) {
                    await new Promise((resolve) => setTimeout(resolve, 50));
                }
            }
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

        async depthFirstSearch() {
            const stack = [this.startNode];
            this.startNode.visited = true;
            while (stack.length > 0) {
                if (!this.searchingInProgress) return;
                const current = stack.pop();
                this.closedSet.push(current);
                if (current === this.endNode) {
                    this.buildPath(current);
                    break;
                }
                const neighbors = this.getNeighbors(current);
                for (let neighbor of neighbors) {
                    if (!neighbor.visited) {
                        neighbor.visited = true;
                        neighbor.previous = current;
                        stack.push(neighbor);
                    }
                }
                this.updateStats();
                this.drawMaze();
                await this.delay();
            }
        }

        async breadthFirstSearch() {
            const queue = [this.startNode];
            this.startNode.visited = true;
            while (queue.length > 0) {
                if (!this.searchingInProgress) return;
                const current = queue.shift();
                this.closedSet.push(current);
                if (current === this.endNode) {
                    this.buildPath(current);
                    break;
                }
                const neighbors = this.getNeighbors(current);
                for (let neighbor of neighbors) {
                    if (!neighbor.visited) {
                        neighbor.visited = true;
                        neighbor.previous = current;
                        queue.push(neighbor);
                    }
                }
                this.updateStats();
                this.drawMaze();
                await this.delay();
            }
        }

        async dijkstraSearch() {
            this.startNode.distance = 0;
            const unvisited = [];
            for (let row of this.maze) {
                for (let cell of row) {
                    if (!cell.wall) {
                        unvisited.push(cell);
                    }
                }
            }
            while (unvisited.length > 0) {
                if (!this.searchingInProgress) return;
                unvisited.sort((a, b) => a.distance - b.distance);
                const current = unvisited.shift();
                if (current.distance === Infinity) break;
                current.visited = true;
                this.closedSet.push(current);
                if (current === this.endNode) {
                    this.buildPath(current);
                    break;
                }
                const neighbors = this.getNeighbors(current);
                for (let neighbor of neighbors) {
                    if (!neighbor.visited) {
                        const alt = current.distance + 1;
                        if (alt < neighbor.distance) {
                            neighbor.distance = alt;
                            neighbor.previous = current;
                        }
                    }
                }
                this.updateStats();
                this.drawMaze();
                await this.delay();
            }
        }

        async aStarSearch() {
            this.startNode.distance = 0;
            this.startNode.heuristic = this.heuristic(this.startNode, this.endNode);
            this.openSet.push(this.startNode);
            const openSetMap = new Set([this.startNode]);
            const closedSetMap = new Set();
            
            while (this.openSet.length > 0) {
                if (!this.searchingInProgress) return;
                this.openSet.sort((a, b) => (a.distance + a.heuristic) - (b.distance + b.heuristic));
                const current = this.openSet.shift();
                openSetMap.delete(current);
                
                if (current === this.endNode) {
                    this.buildPath(current);
                    break;
                }
                
                this.closedSet.push(current);
                closedSetMap.add(current);
                
                const neighbors = this.getNeighbors(current);
                for (let neighbor of neighbors) {
                    if (closedSetMap.has(neighbor)) continue;
                    
                    const tentativeG = current.distance + 1;
                    
                    if (!openSetMap.has(neighbor)) {
                        neighbor.distance = tentativeG;
                        neighbor.heuristic = this.heuristic(neighbor, this.endNode);
                        neighbor.previous = current;
                        this.openSet.push(neighbor);
                        openSetMap.add(neighbor);
                    } else if (tentativeG < neighbor.distance) {
                        neighbor.distance = tentativeG;
                        neighbor.previous = current;
                    }
                }
                this.updateStats();
                this.drawMaze();
                await this.delay();
            }
        }

        heuristic(a, b) {
            return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
        }

        buildPath(endNode) {
            let current = endNode;
            this.path = [];
            while (current.previous) {
                this.path.push(current.previous);
                current = current.previous;
            }
            this.drawMaze();
        }

        drawMaze() {
            ctx.clearRect(0, 0, mazeCanvas.width, mazeCanvas.height);
            for (let i = 0; i < this.gridSize; i++) {
                for (let j = 0; j < this.gridSize; j++) {
                    const cell = this.maze[i][j];

                    if (cell.wall) {
                        ctx.fillStyle = getColorForMode("#000000", "#555555");
                    } else if (cell === this.startNode) {
                        ctx.fillStyle = getColorForMode("#00FF00", "#00AA00");
                    } else if (cell === this.endNode) {
                        ctx.fillStyle = getColorForMode("#FF0000", "#AA0000");
                    } else if (this.path.includes(cell)) {
                        ctx.fillStyle = getColorForMode("#FFFF00", "#AAAA00");
                    } else if (this.closedSet.includes(cell)) {
                        ctx.fillStyle = getColorForMode("#FFA500", "#AA5500");
                    } else if (this.openSet.includes(cell)) {
                        ctx.fillStyle = getColorForMode("#87CEEB", "#5577AA");
                    } else {
                        ctx.fillStyle = getColorForMode("#FFFFFF", "#333333");
                    }

                    ctx.fillRect(
                        cell.x * this.cellSize,
                        cell.y * this.cellSize,
                        this.cellSize,
                        this.cellSize
                    );

                    if (this.showGridLines) {
                        ctx.strokeStyle = getColorForMode("#CCCCCC", "#444444");
                        ctx.strokeRect(
                            cell.x * this.cellSize,
                            cell.y * this.cellSize,
                            this.cellSize,
                            this.cellSize
                        );
                    }
                }
            }
        }
    }

    const visualizer = new MazeVisualizer();

    window.addEventListener("resize", setCanvasSize);

    setCanvasSize();
});