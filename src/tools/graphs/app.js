document.addEventListener("DOMContentLoaded", function() {
    const algorithmSelect = document.getElementById("algorithm");
    const mazeCanvas = document.getElementById("maze-canvas");
    const startButton = document.getElementById("start");
    const pauseButton = document.getElementById("pause");
    const resetButton = document.getElementById("reset");
    const stepButton = document.getElementById("step");
    const speedInput = document.getElementById("speed");
    const gridSizeInput = document.getElementById("grid-size");

    const canvasWidth = Math.floor(window.innerWidth * 0.8);
    const canvasHeight = Math.floor(window.innerHeight * 0.8);

    mazeCanvas.width = canvasWidth;
    mazeCanvas.height = canvasHeight;

    const ctx = mazeCanvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;

    class MazeVisualizer {
        constructor() {
            this.gridSize = parseInt(gridSizeInput.value) || 20;
            this.cellSize = Math.floor(canvasWidth / this.gridSize);
            this.maze = [];
            this.speed = parseInt(speedInput.value) || 50;
            this.paused = false;
            this.stepMode = false;
            this.searchingInProgress = false;
            this.startNode = null;
            this.endNode = null;
            this.openSet = [];
            this.closedSet = [];
            this.path = [];
            this.currentAlgorithm = this.getSelectedAlgorithm();
            this.initializeMaze();
            this.bindEvents();
            this.drawMaze();
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
        }

        initializeMaze() {
            this.maze = [];
            for (let i = 0; i < this.gridSize; i++) {
                const row = [];
                for (let j = 0; j < this.gridSize; j++) {
                    row.push({
                        x: j,
                        y: i,
                        wall: Math.random() < 0.3,
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
        }

        drawMaze() {
            ctx.clearRect(0, 0, mazeCanvas.width, mazeCanvas.height);
            for (let i = 0; i < this.gridSize; i++) {
                for (let j = 0; j < this.gridSize; j++) {
                    const cell = this.maze[i][j];
                    if (cell.wall) {
                        ctx.fillStyle = "#000000";
                    } else if (cell === this.startNode) {
                        ctx.fillStyle = "#00FF00";
                    } else if (cell === this.endNode) {
                        ctx.fillStyle = "#FF0000";
                    } else if (this.path.includes(cell)) {
                        ctx.fillStyle = "#FFFF00";
                    } else if (this.closedSet.includes(cell)) {
                        ctx.fillStyle = "#FFA500";
                    } else if (this.openSet.includes(cell)) {
                        ctx.fillStyle = "#87CEEB";
                    } else {
                        ctx.fillStyle = "#FFFFFF";
                    }
                    ctx.fillRect(
                        cell.x * this.cellSize,
                        cell.y * this.cellSize,
                        this.cellSize,
                        this.cellSize
                    );
                    ctx.strokeRect(
                        cell.x * this.cellSize,
                        cell.y * this.cellSize,
                        this.cellSize,
                        this.cellSize
                    );
                }
            }
        }

        getSelectedAlgorithm() {
            return algorithmSelect.options[algorithmSelect.selectedIndex].value;
        }

        async startSearch() {
            if (this.searchingInProgress) return;
            this.searchingInProgress = true;
            this.paused = false;
            this.stepMode = false;
            pauseButton.textContent = "Pause";
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
            this.searchingInProgress = false;
        }

        togglePause() {
            if (this.searchingInProgress) {
                this.paused = !this.paused;
                pauseButton.textContent = this.paused ? "Resume" : "Pause";
            }
        }

        resetMaze() {
            if (this.searchingInProgress) {
                this.searchingInProgress = false;
                this.paused = false;
                pauseButton.textContent = "Pause";
            }
            this.initializeMaze();
            this.drawMaze();
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
                pauseButton.textContent = "Pause";
            }
            this.initializeMaze();
            this.drawMaze();
        }

        handleSpeedChange() {
            this.speed = parseInt(speedInput.value) || 50;
        }

        handleGridSizeChange() {
            this.gridSize = parseInt(gridSizeInput.value) || 20;
            this.cellSize = Math.floor(canvasWidth / this.gridSize);
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
                await new Promise((resolve) => setTimeout(resolve, this.speed));
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
            while (stack.length > 0) {
                if (!this.searchingInProgress) return;
                const current = stack.pop();
                if (current === this.endNode) {
                    this.buildPath(current);
                    break;
                }
                if (!current.visited) {
                    current.visited = true;
                    this.closedSet.push(current);
                    const neighbors = this.getNeighbors(current);
                    for (let neighbor of neighbors) {
                        if (!neighbor.visited) {
                            neighbor.previous = current;
                            stack.push(neighbor);
                        }
                    }
                }
                this.drawMaze();
                await this.delay();
            }
        }

        async breadthFirstSearch() {
            const queue = [this.startNode];
            while (queue.length > 0) {
                if (!this.searchingInProgress) return;
                const current = queue.shift();
                if (current === this.endNode) {
                    this.buildPath(current);
                    break;
                }
                if (!current.visited) {
                    current.visited = true;
                    this.closedSet.push(current);
                    const neighbors = this.getNeighbors(current);
                    for (let neighbor of neighbors) {
                        if (!neighbor.visited) {
                            neighbor.previous = current;
                            queue.push(neighbor);
                        }
                    }
                }
                this.drawMaze();
                await this.delay();
            }
        }

        async dijkstraSearch() {
            this.startNode.distance = 0;
            const unvisited = [];
            for (let row of this.maze) {
                for (let cell of row) {
                    unvisited.push(cell);
                }
            }
            while (unvisited.length > 0) {
                if (!this.searchingInProgress) return;
                unvisited.sort((a, b) => a.distance - b.distance);
                const current = unvisited.shift();
                if (current.wall) continue;
                if (current.distance === Infinity) break;
                if (current === this.endNode) {
                    this.buildPath(current);
                    break;
                }
                current.visited = true;
                this.closedSet.push(current);
                const neighbors = this.getNeighbors(current);
                for (let neighbor of neighbors) {
                    const alt = current.distance + 1;
                    if (alt < neighbor.distance) {
                        neighbor.distance = alt;
                        neighbor.previous = current;
                    }
                }
                this.drawMaze();
                await this.delay();
            }
        }

        async aStarSearch() {
            this.openSet.push(this.startNode);
            while (this.openSet.length > 0) {
                if (!this.searchingInProgress) return;
                this.openSet.sort((a, b) => (a.distance + a.heuristic) - (b.distance + b.heuristic));
                const current = this.openSet.shift();
                if (current === this.endNode) {
                    this.buildPath(current);
                    break;
                }
                this.closedSet.push(current);
                const neighbors = this.getNeighbors(current);
                for (let neighbor of neighbors) {
                    if (this.closedSet.includes(neighbor)) continue;
                    const tentativeG = current.distance + 1;
                    if (!this.openSet.includes(neighbor) || tentativeG < neighbor.distance) {
                        neighbor.distance = tentativeG;
                        neighbor.heuristic = this.heuristic(neighbor, this.endNode);
                        neighbor.previous = current;
                        if (!this.openSet.includes(neighbor)) {
                            this.openSet.push(neighbor);
                        }
                    }
                }
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
        }
    }

    const visualizer = new MazeVisualizer();

});