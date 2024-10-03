document.addEventListener("DOMContentLoaded", function() {
    const algorithmSelect = document.getElementById("algorithm");
    const arrayState = document.getElementById("array-state");
    const searchTargetInput = document.getElementById("search-target");
    const arraySizeInput = document.getElementById("array-size");
    const speedInput = document.getElementById("speed");
    const searchingCanvas = document.getElementById("searching-canvas");
    const startButton = document.getElementById("start");
    const pauseButton = document.getElementById("pause");
    const resetButton = document.getElementById("reset");
    const stepButton = document.getElementById("step");

    const canvasWidth = Math.floor(window.innerWidth * 0.6);
    const canvasHeight = Math.floor(window.innerHeight * 0.8);

    searchingCanvas.width = canvasWidth;
    searchingCanvas.height = canvasHeight;

    const ctx = searchingCanvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;

    class SearchingVisualizer {
        constructor() {
            this.array = [];
            this.arrayLength = parseInt(arraySizeInput.value) || 50;
            this.speed = parseInt(speedInput.value) || 50;
            this.searchingInProgress = false;
            this.paused = false;
            this.stepMode = false;
            this.found = false;
            this.searchCompleted = false;
            this.currentAlgorithm = this.getSelectedAlgorithm();
            this.generateSortedRandomArray();
            this.drawArray();
            this.updateArrayState();
            this.bindEvents();
        }

        bindEvents() {
            startButton.addEventListener("click", () => this.startSearching());
            pauseButton.addEventListener("click", () => this.togglePause());
            resetButton.addEventListener("click", () => this.resetArray());
            stepButton.addEventListener("click", () => this.stepSearching());
            algorithmSelect.addEventListener("change", () => this.handleAlgorithmChange());
            arraySizeInput.addEventListener("input", () => this.handleArraySizeChange());
            speedInput.addEventListener("input", () => this.handleSpeedChange());
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
                    ctx.fillStyle = found ? "green" : "red";
                } else if (searchComplete && !found) {
                    ctx.fillStyle = "gray";
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

        updateArrayState() {
            arrayState.value = this.array.join(", ");
        }

        async startSearching() {
            if (this.searchCompleted) return;
            if (this.searchingInProgress) return;
            this.searchingInProgress = true;
            this.paused = false;
            this.stepMode = false;
            pauseButton.textContent = "Pause";
            this.currentAlgorithm = this.getSelectedAlgorithm();
            const target = parseInt(searchTargetInput.value) || this.array[Math.floor(Math.random() * this.array.length)];
            searchTargetInput.value = target;
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
            this.searchingInProgress = false;
            this.searchCompleted = true;
        }

        togglePause() {
            if (this.searchingInProgress) {
                this.paused = !this.paused;
                pauseButton.textContent = this.paused ? "Resume" : "Pause";
            }
        }

        resetArray() {
            if (this.searchingInProgress) {
                this.searchingInProgress = false;
                this.paused = false;
                pauseButton.textContent = "Pause";
            }
            this.searchCompleted = false;
            this.generateSortedRandomArray();
            this.drawArray();
            this.updateArrayState();
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
                pauseButton.textContent = "Pause";
            }
            this.searchCompleted = false;
            this.generateSortedRandomArray();
            this.drawArray();
            this.updateArrayState();
        }

        handleArraySizeChange() {
            this.arrayLength = parseInt(arraySizeInput.value) || 50;
            this.resetArray();
        }

        handleSpeedChange() {
            this.speed = parseInt(speedInput.value) || 50;
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
                await new Promise((resolve) => setTimeout(resolve, this.speed));
                while (this.paused) {
                    await new Promise((resolve) => setTimeout(resolve, 50));
                }
            }
        }

        async linearSearch(target) {
            this.found = false;
            for (let i = 0; i < this.array.length; i++) {
                if (!this.searchingInProgress) return;

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

                this.drawArray([Math.min(step, n) - 1]);
                prev = step;
                step += Math.floor(Math.sqrt(n));

                if (prev >= n) return;
                await this.delay();
            }

            while (this.array[prev] < target) {
                if (!this.searchingInProgress) return;

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

    function setCanvasDimensions() {
        let canvasWidth, canvasHeight;
        if (window.innerWidth <= 480) {
            canvasWidth = Math.floor(window.innerWidth * 0.8);
            canvasHeight = Math.floor(window.innerHeight * 0.6);
        } else {
            canvasWidth = Math.floor(window.innerWidth * 0.6);
            canvasHeight = Math.floor(window.innerHeight * 0.8);
        }
        searchingCanvas.width = canvasWidth;
        searchingCanvas.height = canvasHeight;
    }

    setCanvasDimensions();
    window.addEventListener("resize", setCanvasDimensions);
    const visualizer = new SearchingVisualizer();

});