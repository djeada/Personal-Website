document.addEventListener("DOMContentLoaded", function() {
    const algorithmSelect = document.getElementById("algorithm");
    const arraySizeInput = document.getElementById("array-size");
    const speedInput = document.getElementById("speed");
    const arrayState = document.getElementById("array-state");
    const sortingCanvas = document.getElementById("sorting-canvas");
    const startButton = document.getElementById("start");
    const pauseButton = document.getElementById("pause");
    const resetButton = document.getElementById("reset");
    const stepButton = document.getElementById("step");

    const canvasWidth = Math.floor(window.innerWidth * 0.8);
    const canvasHeight = Math.floor(window.innerHeight * 0.6);

    sortingCanvas.width = canvasWidth;
    sortingCanvas.height = canvasHeight;

    const ctx = sortingCanvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;

    class SortingVisualizer {
        constructor() {
            this.array = [];
            this.arrayLength = parseInt(arraySizeInput.value) || 50;
            this.speed = parseInt(speedInput.value) || 50;
            this.sortingInProgress = false;
            this.paused = false;
            this.stepMode = false;
            this.sortingCompleted = false;
            this.currentAlgorithm = this.getSelectedAlgorithm();
            this.generateRandomArray();
            this.drawArray();
            this.updateArrayState();
            this.bindEvents();
        }

        bindEvents() {
            startButton.addEventListener("click", () => this.startSorting());
            pauseButton.addEventListener("click", () => this.togglePause());
            resetButton.addEventListener("click", () => this.resetArray());
            stepButton.addEventListener("click", () => this.stepSorting());
            algorithmSelect.addEventListener("change", () => this.handleAlgorithmChange());
            arraySizeInput.addEventListener("input", () => this.handleArraySizeChange());
            speedInput.addEventListener("input", () => this.handleSpeedChange());
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
                    ctx.fillStyle = "red";
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

        updateArrayState() {
            arrayState.value = this.array.join(", ");
        }

        async startSorting() {
            if (this.sortingInProgress) return;
            this.sortingInProgress = true;
            this.paused = false;
            this.stepMode = false;
            pauseButton.textContent = "Pause";
            this.currentAlgorithm = this.getSelectedAlgorithm();
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
            this.sortingInProgress = false;
            this.sortingCompleted = true;
        }

        togglePause() {
            if (this.sortingInProgress) {
                this.paused = !this.paused;
                pauseButton.textContent = this.paused ? "Resume" : "Pause";
            }
        }

        resetArray() {
            if (this.sortingInProgress) {
                this.sortingInProgress = false;
                this.paused = false;
                pauseButton.textContent = "Pause";
            }
            this.sortingCompleted = false;
            this.generateRandomArray();
            this.drawArray();
            this.updateArrayState();
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
                pauseButton.textContent = "Pause";
            }
            this.sortingCompleted = false;
            this.generateRandomArray();
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
                while (this.paused && this.sortingInProgress) {
                    await new Promise((resolve) => setTimeout(resolve, 50));
                }
            } else {
                await new Promise((resolve) => setTimeout(resolve, this.speed));
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
                    if (this.array[j] > this.array[j + 1]) {
                        [this.array[j], this.array[j + 1]] = [this.array[j + 1], this.array[j]];
                        swapped = true;
                        this.updateArrayState();
                    }
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
                    if (this.array[j] < this.array[minIndex]) {
                        minIndex = j;
                    }
                    this.drawArray([i, minIndex]);
                    await this.delay();
                }
                if (minIndex !== i) {
                    [this.array[i], this.array[minIndex]] = [this.array[minIndex], this.array[i]];
                    this.updateArrayState();
                }
            }
        }

        async insertionSort() {
            for (let i = 1; i < this.array.length; i++) {
                let key = this.array[i];
                let j = i - 1;
                while (j >= 0 && this.array[j] > key) {
                    if (!this.sortingInProgress) return;
                    this.array[j + 1] = this.array[j];
                    j--;
                    this.drawArray([j, j + 1]);
                    this.updateArrayState();
                    await this.delay();
                }
                this.array[j + 1] = key;
                this.updateArrayState();
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
                if (left[i] <= right[j]) {
                    this.array[k] = left[i];
                    i++;
                } else {
                    this.array[k] = right[j];
                    j++;
                }
                this.drawArray([k]);
                this.updateArrayState();
                await this.delay();
                k++;
            }
            while (i < left.length) {
                if (!this.sortingInProgress) return;
                this.array[k] = left[i];
                i++;
                k++;
                this.drawArray([k]);
                this.updateArrayState();
                await this.delay();
            }
            while (j < right.length) {
                if (!this.sortingInProgress) return;
                this.array[k] = right[j];
                j++;
                k++;
                this.drawArray([k]);
                this.updateArrayState();
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
                if (this.array[j] < pivotValue) {
                    [this.array[i], this.array[j]] = [this.array[j], this.array[i]];
                    this.updateArrayState();
                    i++;
                }
                this.drawArray([i, j, pivotIndex]);
                await this.delay();
            }
            [this.array[i], this.array[pivotIndex]] = [this.array[pivotIndex], this.array[i]];
            this.updateArrayState();
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
                this.updateArrayState();
                this.drawArray([0, i]);
                await this.delay();
                await this.heapify(i, 0);
            }
        }

        async heapify(n, i) {
            let largest = i;
            let left = 2 * i + 1;
            let right = 2 * i + 2;
            if (left < n && this.array[left] > this.array[largest]) {
                largest = left;
            }
            if (right < n && this.array[right] > this.array[largest]) {
                largest = right;
            }
            if (largest !== i) {
                [this.array[i], this.array[largest]] = [this.array[largest], this.array[i]];
                this.updateArrayState();
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
                this.updateArrayState();
                this.drawArray([i]);
                await this.delay();
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
        sortingCanvas.width = canvasWidth;
        sortingCanvas.height = canvasHeight;
    }

    setCanvasDimensions();
    window.addEventListener("resize", setCanvasDimensions);
    const visualizer = new SortingVisualizer();

});