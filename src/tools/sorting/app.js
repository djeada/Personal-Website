document.addEventListener("DOMContentLoaded", function() {
    // Default configuration constants
    const DEFAULT_ARRAY_SIZE = 50;
    const DEFAULT_SPEED = 5;
    const DEFAULT_ALGORITHM = "bubble";

    const algorithmSelect = document.getElementById("algorithm");
    const arraySizeInput = document.getElementById("array-size");
    const speedInput = document.getElementById("speed");
    const sortingCanvas = document.getElementById("sorting-canvas");
    const startButton = document.getElementById("start");
    const pauseButton = document.getElementById("pause");
    const resetButton = document.getElementById("reset");
    const stepButton = document.getElementById("step");
    const resetDefaultsButton = document.getElementById("reset-defaults");
    const toastContainer = document.getElementById("toast-container");

    // Stats elements
    const swapsCountEl = document.getElementById("swaps-count");
    const comparisonsCountEl = document.getElementById("comparisons-count");
    const elapsedTimeEl = document.getElementById("elapsed-time");
    const algorithmNameEl = document.getElementById("algorithm-name");

    // Algorithm names map
    const algorithmNames = {
        "bubble": "Bubble",
        "selection": "Selection",
        "insertion": "Insertion",
        "merge": "Merge",
        "quick": "Quick",
        "heap": "Heap",
        "radix": "Radix"
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

        sortingCanvas.width = width;
        sortingCanvas.height = height;

        if (visualizer) {
            visualizer.drawArray();
        }
    }

    const ctx = sortingCanvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;

    class SortingVisualizer {
        constructor() {
            this.array = [];
            this.arrayLength = parseInt(arraySizeInput.value) || DEFAULT_ARRAY_SIZE;
            this.speed = parseInt(speedInput.value) || DEFAULT_SPEED;
            this.sortingInProgress = false;
            this.paused = false;
            this.stepMode = false;
            this.sortingCompleted = false;
            this.currentAlgorithm = this.getSelectedAlgorithm();
            this.swaps = 0;
            this.comparisons = 0;
            this.startTime = null;
            this.generateRandomArray();
            this.drawArray();
            this.bindEvents();
            this.updateAlgorithmName();
        }

        bindEvents() {
            startButton.addEventListener("click", () => this.startSorting());
            pauseButton.addEventListener("click", () => this.togglePause());
            resetButton.addEventListener("click", () => this.resetArray());
            stepButton.addEventListener("click", () => this.stepSorting());
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
                    if (this.sortingInProgress) {
                        this.togglePause();
                    } else {
                        this.startSorting();
                    }
                }
            });
        }

        resetDefaults() {
            arraySizeInput.value = DEFAULT_ARRAY_SIZE;
            speedInput.value = DEFAULT_SPEED;
            algorithmSelect.value = DEFAULT_ALGORITHM;
            
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
            swapsCountEl.textContent = this.swaps;
            comparisonsCountEl.textContent = this.comparisons;
            
            if (this.startTime) {
                const elapsed = Date.now() - this.startTime;
                elapsedTimeEl.textContent = elapsed + "ms";
            }
        }

        generateRandomArray() {
            const minHeight = Math.floor(sortingCanvas.height * 0.05);
            const maxHeight = Math.floor(sortingCanvas.height * 0.95);

            this.array = Array.from({
                length: this.arrayLength
            }, () => {
                return Math.floor(minHeight + Math.random() * (maxHeight - minHeight));
            });
        }

        drawArray(highlightedIndices = []) {
            ctx.clearRect(0, 0, sortingCanvas.width, sortingCanvas.height);

            const barWidth = sortingCanvas.width / this.array.length;

            for (let i = 0; i < this.array.length; i++) {
                const height = this.array[i];

                if (highlightedIndices.includes(i)) {
                    ctx.fillStyle = "#ef4444";
                } else {
                    ctx.fillStyle = "#eec747";
                }

                ctx.fillRect(
                    i * barWidth,
                    sortingCanvas.height - height,
                    Math.max(barWidth - 1, 1),
                    height
                );
            }
        }

        async startSorting() {
            if (this.sortingInProgress) return;
            this.sortingInProgress = true;
            this.paused = false;
            this.stepMode = false;
            this.swaps = 0;
            this.comparisons = 0;
            this.startTime = Date.now();
            pauseButton.innerHTML = '<span class="btn-icon">⏸️</span> Pause';
            this.currentAlgorithm = this.getSelectedAlgorithm();
            
            showToast(`Starting ${algorithmNames[this.currentAlgorithm]} sort...`, "info");

            switch (this.currentAlgorithm) {
                case "bubble":
                    await this.bubbleSort();
                    break;
                case "selection":
                    await this.selectionSort();
                    break;
                case "insertion":
                    await this.insertionSort();
                    break;
                case "merge":
                    await this.mergeSort(0, this.array.length - 1);
                    break;
                case "quick":
                    await this.quickSort(0, this.array.length - 1);
                    break;
                case "heap":
                    await this.heapSort();
                    break;
                case "radix":
                    await this.radixSort();
                    break;
                default:
                    break;
            }
            
            this.updateStats();
            
            if (this.sortingInProgress) {
                showToast(`Sorted! ${this.swaps} swaps, ${this.comparisons} comparisons`, "success");
            }
            
            this.sortingInProgress = false;
            this.sortingCompleted = true;
        }

        togglePause() {
            if (this.sortingInProgress) {
                this.paused = !this.paused;
                pauseButton.innerHTML = this.paused 
                    ? '<span class="btn-icon">▶️</span> Resume' 
                    : '<span class="btn-icon">⏸️</span> Pause';
                
                if (this.paused) {
                    showToast("Sorting paused", "info");
                } else {
                    showToast("Sorting resumed", "info");
                }
            }
        }

        resetArray() {
            if (this.sortingInProgress) {
                this.sortingInProgress = false;
                this.paused = false;
                pauseButton.innerHTML = '<span class="btn-icon">⏸️</span> Pause';
            }
            this.sortingCompleted = false;
            this.swaps = 0;
            this.comparisons = 0;
            this.startTime = null;
            this.generateRandomArray();
            this.drawArray();
            
            // Reset stats
            swapsCountEl.textContent = "0";
            comparisonsCountEl.textContent = "0";
            elapsedTimeEl.textContent = "0ms";
            
            showToast("Array reset", "info");
        }

        stepSorting() {
            if (this.sortingCompleted) return;
            if (this.sortingInProgress) {
                this.stepMode = true;
                this.paused = false;
            } else {
                this.startSorting();
                this.stepMode = true;
            }
        }

        handleAlgorithmChange() {
            if (this.sortingInProgress) {
                this.sortingInProgress = false;
                this.paused = false;
                pauseButton.innerHTML = '<span class="btn-icon">⏸️</span> Pause';
            }
            this.sortingCompleted = false;
            this.updateAlgorithmName();
            this.generateRandomArray();
            this.drawArray();
            
            // Reset stats
            swapsCountEl.textContent = "0";
            comparisonsCountEl.textContent = "0";
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
                while (this.paused && this.sortingInProgress) {
                    await new Promise((resolve) => setTimeout(resolve, 50));
                }
            } else {
                // Speed ranges from 1-10, where 10 is fastest
                const maxDelay = 200;
                const minDelay = 5;
                const delayTime = Math.round(maxDelay - ((this.speed - 1) / 9) * (maxDelay - minDelay));
                await new Promise((resolve) => setTimeout(resolve, delayTime));
                while (this.paused && this.sortingInProgress) {
                    await new Promise((resolve) => setTimeout(resolve, 50));
                }
            }
        }

        async bubbleSort() {
            for (let i = 0; i < this.array.length; i++) {
                let swapped = false;
                for (let j = 0; j < this.array.length - i - 1; j++) {
                    if (!this.sortingInProgress) return;
                    this.comparisons++;
                    if (this.array[j] > this.array[j + 1]) {
                        [this.array[j], this.array[j + 1]] = [this.array[j + 1], this.array[j]];
                        swapped = true;
                        this.swaps++;
                    }
                    this.updateStats();
                    this.drawArray([j, j + 1]);
                    await this.delay();
                }
                if (!swapped) break;
            }
        }

        async selectionSort() {
            for (let i = 0; i < this.array.length; i++) {
                let minIndex = i;
                for (let j = i + 1; j < this.array.length; j++) {
                    if (!this.sortingInProgress) return;
                    this.comparisons++;
                    if (this.array[j] < this.array[minIndex]) {
                        minIndex = j;
                    }
                    this.updateStats();
                    this.drawArray([i, minIndex]);
                    await this.delay();
                }
                if (minIndex !== i) {
                    [this.array[i], this.array[minIndex]] = [this.array[minIndex], this.array[i]];
                    this.swaps++;
                    this.updateStats();
                }
            }
        }

        async insertionSort() {
            for (let i = 1; i < this.array.length; i++) {
                let key = this.array[i];
                let j = i - 1;
                while (j >= 0 && this.array[j] > key) {
                    if (!this.sortingInProgress) return;
                    this.comparisons++;
                    this.array[j + 1] = this.array[j];
                    j--;
                    this.swaps++;
                    this.updateStats();
                    this.drawArray([j, j + 1]);
                    await this.delay();
                }
                this.array[j + 1] = key;
                this.updateStats();
                this.drawArray([j + 1]);
            }
        }

        async mergeSort(start, end) {
            if (start >= end || !this.sortingInProgress) return;
            const mid = Math.floor((start + end) / 2);
            await this.mergeSort(start, mid);
            await this.mergeSort(mid + 1, end);
            await this.merge(start, mid, end);
        }

        async merge(start, mid, end) {
            let left = this.array.slice(start, mid + 1);
            let right = this.array.slice(mid + 1, end + 1);
            let i = 0,
                j = 0,
                k = start;
            while (i < left.length && j < right.length) {
                if (!this.sortingInProgress) return;
                this.comparisons++;
                if (left[i] <= right[j]) {
                    this.array[k] = left[i];
                    i++;
                } else {
                    this.array[k] = right[j];
                    j++;
                }
                this.swaps++;
                this.updateStats();
                this.drawArray([k]);
                await this.delay();
                k++;
            }
            while (i < left.length) {
                if (!this.sortingInProgress) return;
                this.array[k] = left[i];
                i++;
                k++;
                this.swaps++;
                this.updateStats();
                this.drawArray([k]);
                await this.delay();
            }
            while (j < right.length) {
                if (!this.sortingInProgress) return;
                this.array[k] = right[j];
                j++;
                k++;
                this.swaps++;
                this.updateStats();
                this.drawArray([k]);
                await this.delay();
            }
        }

        async quickSort(start, end) {
            if (start >= end || !this.sortingInProgress) return;
            let index = await this.partition(start, end);
            await this.quickSort(start, index - 1);
            await this.quickSort(index + 1, end);
        }

        async partition(start, end) {
            let pivotIndex = end;
            let pivotValue = this.array[pivotIndex];
            let i = start;
            for (let j = start; j < end; j++) {
                if (!this.sortingInProgress) return;
                this.comparisons++;
                if (this.array[j] < pivotValue) {
                    [this.array[i], this.array[j]] = [this.array[j], this.array[i]];
                    this.swaps++;
                    this.updateStats();
                    i++;
                }
                this.drawArray([i, j, pivotIndex]);
                await this.delay();
            }
            [this.array[i], this.array[pivotIndex]] = [this.array[pivotIndex], this.array[i]];
            this.swaps++;
            this.updateStats();
            this.drawArray([i, pivotIndex]);
            await this.delay();
            return i;
        }

        async heapSort() {
            let n = this.array.length;
            for (let i = Math.floor(n / 2) - 1; i >= 0; i--) {
                if (!this.sortingInProgress) return;
                await this.heapify(n, i);
            }
            for (let i = n - 1; i > 0; i--) {
                if (!this.sortingInProgress) return;
                [this.array[0], this.array[i]] = [this.array[i], this.array[0]];
                this.swaps++;
                this.updateStats();
                this.drawArray([0, i]);
                await this.delay();
                await this.heapify(i, 0);
            }
        }

        async heapify(n, i) {
            let largest = i;
            let left = 2 * i + 1;
            let right = 2 * i + 2;
            this.comparisons++;
            if (left < n && this.array[left] > this.array[largest]) {
                largest = left;
            }
            this.comparisons++;
            if (right < n && this.array[right] > this.array[largest]) {
                largest = right;
            }
            if (largest !== i) {
                [this.array[i], this.array[largest]] = [this.array[largest], this.array[i]];
                this.swaps++;
                this.updateStats();
                this.drawArray([i, largest]);
                await this.delay();
                await this.heapify(n, largest);
            }
        }

        async radixSort() {
            let max = Math.max(...this.array);
            let exp = 1;
            while (Math.floor(max / exp) > 0) {
                if (!this.sortingInProgress) return;
                await this.countingSort(exp);
                exp *= 10;
            }
        }

        async countingSort(exp) {
            let output = new Array(this.array.length).fill(0);
            let count = new Array(10).fill(0);
            for (let i = 0; i < this.array.length; i++) {
                let index = Math.floor(this.array[i] / exp) % 10;
                count[index]++;
            }
            for (let i = 1; i < 10; i++) {
                count[i] += count[i - 1];
            }
            for (let i = this.array.length - 1; i >= 0; i--) {
                let index = Math.floor(this.array[i] / exp) % 10;
                output[count[index] - 1] = this.array[i];
                count[index]--;
            }
            for (let i = 0; i < this.array.length; i++) {
                if (!this.sortingInProgress) return;
                this.array[i] = output[i];
                this.swaps++;
                this.updateStats();
                this.drawArray([i]);
                await this.delay();
            }
        }
    }

    let visualizer;

    function init() {
        setCanvasSize();
        visualizer = new SortingVisualizer();
    }

    window.addEventListener("resize", setCanvasSize);
    init();

});