document.addEventListener("DOMContentLoaded", function() {
    // Default configuration constants
    const DEFAULT_ARRAY_SIZE = 50;
    const DEFAULT_SPEED = 5;
    const DEFAULT_ALGORITHM = "linear";

    const algorithmSelect = document.getElementById("algorithm");
    const searchTargetInput = document.getElementById("search-target");
    const arraySizeInput = document.getElementById("array-size");
    const speedInput = document.getElementById("speed");
    const searchingCanvas = document.getElementById("searching-canvas");
    const startButton = document.getElementById("start");
    const pauseButton = document.getElementById("pause");
    const resetButton = document.getElementById("reset");
    const stepButton = document.getElementById("step");
    const resetDefaultsButton = document.getElementById("reset-defaults");
    const toastContainer = document.getElementById("toast-container");

    // Stats elements
    const comparisonsCountEl = document.getElementById("comparisons-count");
    const targetValueEl = document.getElementById("target-value");
    const elapsedTimeEl = document.getElementById("elapsed-time");
    const algorithmNameEl = document.getElementById("algorithm-name");

    // Algorithm names map
    const algorithmNames = {
        "linear": "Linear",
        "binary": "Binary",
        "jump": "Jump",
        "interpolation": "Interpolation"
    };

    // Toast notification function
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

    // Toggle card functionality
    document.querySelectorAll(".card-toggle").forEach(toggle => {
        toggle.addEventListener("click", () => {
            const expanded = toggle.getAttribute("aria-expanded") === "true";
            toggle.setAttribute("aria-expanded", !expanded);
        });
    });

    function setCanvasSize() {
        const availableWidth = window.innerWidth * 0.95;
        const availableHeight = window.innerHeight * 0.5;
        const maxWidth = 800;
        const maxHeight = 400;

        const width = Math.min(availableWidth, maxWidth);
        const height = Math.min(availableHeight, maxHeight);

        searchingCanvas.width = width;
        searchingCanvas.height = height;

        if (visualizer) {
            visualizer.drawArray();
        }
    }

    const ctx = searchingCanvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;

    class SearchingVisualizer {
        constructor() {
            this.array = [];
            this.arrayLength = parseInt(arraySizeInput.value) || DEFAULT_ARRAY_SIZE;
            this.speed = parseInt(speedInput.value) || DEFAULT_SPEED;
            this.searchingInProgress = false;
            this.paused = false;
            this.stepMode = false;
            this.found = false;
            this.searchCompleted = false;
            this.currentAlgorithm = this.getSelectedAlgorithm();
            this.comparisons = 0;
            this.startTime = null;
            this.generateSortedRandomArray();
            this.drawArray();
            this.bindEvents();
            this.updateAlgorithmName();
        }

        bindEvents() {
            startButton.addEventListener("click", () => this.startSearching());
            pauseButton.addEventListener("click", () => this.togglePause());
            resetButton.addEventListener("click", () => this.resetArray());
            stepButton.addEventListener("click", () => this.stepSearching());
            algorithmSelect.addEventListener("change", () => this.handleAlgorithmChange());
            arraySizeInput.addEventListener("input", () => this.handleArraySizeChange());
            speedInput.addEventListener("input", () => this.handleSpeedChange());

            if (resetDefaultsButton) {
                resetDefaultsButton.addEventListener("click", () => this.resetDefaults());
            }

            // Keyboard shortcuts
            document.addEventListener("keydown", (e) => {
                if (e.code === "Space") {
                    e.preventDefault();
                    if (this.searchingInProgress) {
                        this.togglePause();
                    } else {
                        this.startSearching();
                    }
                }
            });
        }

        resetDefaults() {
            arraySizeInput.value = DEFAULT_ARRAY_SIZE;
            speedInput.value = DEFAULT_SPEED;
            algorithmSelect.value = DEFAULT_ALGORITHM;
            searchTargetInput.value = "";
            
            this.arrayLength = DEFAULT_ARRAY_SIZE;
            this.speed = DEFAULT_SPEED;
            this.resetArray();
            this.updateAlgorithmName();
            showToast("Settings reset to defaults", "success");
        }

        updateAlgorithmName() {
            const algo = this.getSelectedAlgorithm();
            algorithmNameEl.textContent = algorithmNames[algo] || algo;
        }

        updateStats() {
            comparisonsCountEl.textContent = this.comparisons;
            
            if (this.startTime) {
                const elapsed = Date.now() - this.startTime;
                elapsedTimeEl.textContent = elapsed + "ms";
            }
        }

        generateSortedRandomArray() {
            const minHeight = Math.floor(searchingCanvas.height * 0.05);
            const maxHeight = Math.floor(searchingCanvas.height * 0.95);

            this.array = Array.from({
                length: this.arrayLength
            }, (_, i) => {
                const normalizedValue = i / this.arrayLength;
                return Math.floor(minHeight + normalizedValue * (maxHeight - minHeight));
            });

            this.array.sort((a, b) => a - b);
        }

        drawArray(highlightedIndices = [], searchComplete = false, found = false) {
            ctx.clearRect(0, 0, searchingCanvas.width, searchingCanvas.height);
            const barWidth = searchingCanvas.width / this.array.length;
            for (let i = 0; i < this.array.length; i++) {
                const height = this.array[i];

                if (highlightedIndices.includes(i)) {
                    ctx.fillStyle = found ? "#10b981" : "#ef4444";
                } else if (searchComplete && !found) {
                    ctx.fillStyle = "#9ca3af";
                } else {
                    ctx.fillStyle = "#eec747";
                }

                ctx.fillRect(
                    i * barWidth,
                    searchingCanvas.height - height,
                    Math.max(barWidth - 1, 1),
                    height
                );
            }
        }

        async startSearching() {
            if (this.searchCompleted) return;
            if (this.searchingInProgress) return;
            this.searchingInProgress = true;
            this.paused = false;
            this.stepMode = false;
            this.comparisons = 0;
            this.startTime = Date.now();
            pauseButton.innerHTML = '<span class="btn-icon">⏸️</span> Pause';
            this.currentAlgorithm = this.getSelectedAlgorithm();
            
            const target = parseInt(searchTargetInput.value) || this.array[Math.floor(Math.random() * this.array.length)];
            searchTargetInput.value = target;
            targetValueEl.textContent = target;
            
            showToast(`Starting ${algorithmNames[this.currentAlgorithm]} search for ${target}...`, "info");

            switch (this.currentAlgorithm) {
                case "linear":
                    await this.linearSearch(target);
                    break;
                case "binary":
                    await this.binarySearch(target);
                    break;
                case "jump":
                    await this.jumpSearch(target);
                    break;
                case "interpolation":
                    await this.interpolationSearch(target);
                    break;
                default:
                    break;
            }
            
            this.updateStats();
            
            if (this.found) {
                showToast(`Found! ${this.comparisons} comparisons`, "success");
            } else if (this.searchingInProgress) {
                showToast(`Not found after ${this.comparisons} comparisons`, "warning");
            }
            
            this.searchingInProgress = false;
            this.searchCompleted = true;
        }

        togglePause() {
            if (this.searchingInProgress) {
                this.paused = !this.paused;
                pauseButton.innerHTML = this.paused 
                    ? '<span class="btn-icon">▶️</span> Resume' 
                    : '<span class="btn-icon">⏸️</span> Pause';
                
                if (this.paused) {
                    showToast("Search paused", "info");
                } else {
                    showToast("Search resumed", "info");
                }
            }
        }

        resetArray() {
            if (this.searchingInProgress) {
                this.searchingInProgress = false;
                this.paused = false;
                pauseButton.innerHTML = '<span class="btn-icon">⏸️</span> Pause';
            }
            this.searchCompleted = false;
            this.comparisons = 0;
            this.startTime = null;
            this.generateSortedRandomArray();
            this.drawArray();
            
            // Reset stats
            comparisonsCountEl.textContent = "0";
            targetValueEl.textContent = "-";
            elapsedTimeEl.textContent = "0ms";
            
            showToast("Array reset", "info");
        }

        stepSearching() {
            if (this.searchCompleted) {
                return;
            }
            if (this.searchingInProgress) {
                this.stepMode = true;
                this.paused = false;
            } else {
                this.startSearching();
                this.stepMode = true;
            }
        }

        handleAlgorithmChange() {
            if (this.searchingInProgress) {
                this.searchingInProgress = false;
                this.paused = false;
                pauseButton.innerHTML = '<span class="btn-icon">⏸️</span> Pause';
            }
            this.searchCompleted = false;
            this.updateAlgorithmName();
            this.generateSortedRandomArray();
            this.drawArray();
            
            // Reset stats
            comparisonsCountEl.textContent = "0";
            targetValueEl.textContent = "-";
            elapsedTimeEl.textContent = "0ms";
            
            showToast(`Algorithm changed to ${algorithmNames[this.getSelectedAlgorithm()]}`, "info");
        }

        handleArraySizeChange() {
            this.arrayLength = parseInt(arraySizeInput.value) || DEFAULT_ARRAY_SIZE;
            this.resetArray();
        }

        handleSpeedChange() {
            this.speed = parseInt(speedInput.value) || DEFAULT_SPEED;
        }

        getSelectedAlgorithm() {
            return algorithmSelect.options[algorithmSelect.selectedIndex].value;
        }

        async delay() {
            if (this.stepMode) {
                this.paused = true;
                while (this.paused) {
                    await new Promise((resolve) => setTimeout(resolve, 50));
                }
            } else {
                // Speed ranges from 1-10, where 10 is fastest
                const maxDelay = 200;
                const minDelay = 5;
                const delayTime = Math.round(maxDelay - ((this.speed - 1) / 9) * (maxDelay - minDelay));
                await new Promise((resolve) => setTimeout(resolve, delayTime));
                while (this.paused) {
                    await new Promise((resolve) => setTimeout(resolve, 50));
                }
            }
        }

        async linearSearch(target) {
            this.found = false;
            for (let i = 0; i < this.array.length; i++) {
                if (!this.searchingInProgress) return;

                this.comparisons++;
                this.updateStats();
                this.drawArray([i]);

                if (this.array[i] === target) {
                    this.found = true;
                    this.drawArray([i], true, true);
                    break;
                }
                await this.delay();
            }

            if (!this.found) {
                this.drawArray([], true, false);
            }
        }

        async binarySearch(target) {
            this.found = false;
            let left = 0;
            let right = this.array.length - 1;

            while (left <= right) {
                if (!this.searchingInProgress) return;
                const middle = Math.floor((left + right) / 2);
                this.comparisons++;
                this.updateStats();
                this.drawArray([middle]);

                if (this.array[middle] === target) {
                    this.found = true;
                    this.drawArray([middle], true, true);
                    break;
                } else if (this.array[middle] < target) {
                    left = middle + 1;
                } else {
                    right = middle - 1;
                }

                await this.delay();
            }

            if (!this.found) {
                this.drawArray([], true, false);
            }
        }

        async jumpSearch(target) {
            this.found = false;
            let n = this.array.length;
            let step = Math.floor(Math.sqrt(n));
            let prev = 0;

            while (this.array[Math.min(step, n) - 1] < target) {
                if (!this.searchingInProgress) return;

                this.comparisons++;
                this.updateStats();
                this.drawArray([Math.min(step, n) - 1]);
                prev = step;
                step += Math.floor(Math.sqrt(n));

                if (prev >= n) return;
                await this.delay();
            }

            while (this.array[prev] < target) {
                if (!this.searchingInProgress) return;

                this.comparisons++;
                this.updateStats();
                this.drawArray([prev]);
                prev++;

                if (prev === Math.min(step, n)) return;
                await this.delay();
            }

            if (this.array[prev] === target) {
                this.found = true;
                this.drawArray([prev], true, true);
            }

            if (!this.found) {
                this.drawArray([], true, false);
            }
        }

        async interpolationSearch(target) {
            this.found = false;
            let low = 0;
            let high = this.array.length - 1;

            while (low <= high && target >= this.array[low] && target <= this.array[high]) {
                if (!this.searchingInProgress) return;

                let pos = low + Math.floor(((high - low) / (this.array[high] - this.array[low])) * (target - this.array[low]));
                this.comparisons++;
                this.updateStats();
                this.drawArray([pos]);

                if (this.array[pos] === target) {
                    this.found = true;
                    this.drawArray([pos], true, true);
                    break;
                }

                if (this.array[pos] < target) {
                    low = pos + 1;
                } else {
                    high = pos - 1;
                }

                await this.delay();
            }

            if (!this.found) {
                this.drawArray([], true, false);
            }
        }

    }

    let visualizer;

    function init() {
        setCanvasSize();
        visualizer = new SearchingVisualizer();
    }

    window.addEventListener("resize", setCanvasSize);
    init();

});