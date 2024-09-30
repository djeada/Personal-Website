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
            // Scale the heights to ensure they cover the full canvas height range
            const minHeight = Math.floor(searchingCanvas.height * 0.05); // Minimum height as 5% of canvas height
            const maxHeight = Math.floor(searchingCanvas.height * 0.95); // Maximum height as 95% of canvas height

            // Generate sorted heights with proportional distribution
            this.array = Array.from({
                length: this.arrayLength
            }, (_, i) => {
                // Generate heights based on normalized index for even distribution
                const normalizedValue = i / this.arrayLength; // Scale index between 0 and 1
                return Math.floor(minHeight + normalizedValue * (maxHeight - minHeight)); // Map to canvas height range
            });

            this.array.sort((a, b) => a - b); // Sort array for algorithms like binary search
        }


        drawArray(highlightedIndices = [], searchComplete = false, found = false) {
            ctx.clearRect(0, 0, searchingCanvas.width, searchingCanvas.height);

            // Bar width based on canvas width and array length
            const barWidth = searchingCanvas.width / this.array.length;

            // Loop through the array and draw each bar
            for (let i = 0; i < this.array.length; i++) {
                const height = this.array[i];

                if (highlightedIndices.includes(i)) {
                    ctx.fillStyle = found ? "green" : "red"; // Color the highlighted bar
                } else if (searchComplete && !found) {
                    ctx.fillStyle = "gray"; // Color bars gray if the search is complete but the target isn't found
                } else {
                    ctx.fillStyle = "#eec747"; // Normal bar color
                }

                // Ensure the bars are visible and do not exceed canvas bounds
                ctx.fillRect(
                    i * barWidth, // X position based on index and barWidth
                    searchingCanvas.height - height, // Y position (height from the bottom)
                    Math.max(barWidth - 1, 1), // Bar width with 1px spacing between bars
                    height // Bar height
                );
            }
        }

        updateArrayState() {
            arrayState.value = this.array.join(", ");
        }

        async startSearching() {
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
            this.generateSortedRandomArray();
            this.drawArray();
            this.updateArrayState();
        }

        stepSearching() {
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
                    this.drawArray([i], true, true); // Highlight found element in green
                    break;
                }
                await this.delay();
            }

            if (!this.found) {
                this.drawArray([], true, false); // Change color to gray if not found, after search is done
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
                    this.drawArray([middle], true, true); // Highlight found element in green
                    break;
                } else if (this.array[middle] < target) {
                    left = middle + 1;
                } else {
                    right = middle - 1;
                }

                await this.delay();
            }

            if (!this.found) {
                this.drawArray([], true, false); // Change color to gray if not found, after search is done
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
                this.drawArray([prev], true, true); // Highlight found element in green
            }

            if (!this.found) {
                this.drawArray([], true, false); // Change color to gray if not found, after search is done
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
                    this.drawArray([pos], true, true); // Highlight found element in green
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
                this.drawArray([], true, false); // Change color to gray if not found, after search is done
            }
        }

    }

    function setCanvasDimensions() {
        let canvasWidth, canvasHeight;
        if (window.innerWidth <= 480) {
            // For phones or small screens
            canvasWidth = Math.floor(window.innerWidth * 0.8); // 80% of screen width for mobile
            canvasHeight = Math.floor(window.innerHeight * 0.6); // 60% height for mobile
        } else {
            // For larger screens (tablets, desktops)
            canvasWidth = Math.floor(window.innerWidth * 0.6); // 60% of width for larger screens
            canvasHeight = Math.floor(window.innerHeight * 0.8); // 80% height for larger screens
        }
        searchingCanvas.width = canvasWidth;
        searchingCanvas.height = canvasHeight;
    }

    // Set initial dimensions and listen for window resize
    setCanvasDimensions();
    window.addEventListener("resize", setCanvasDimensions);
    const visualizer = new SearchingVisualizer();

});