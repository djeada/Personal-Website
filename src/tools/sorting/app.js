document.addEventListener("DOMContentLoaded", function() {
    const algorithmSelect = document.getElementById("algorithm");
    algorithmSelect.addEventListener("change", handleAlgorithmChange);
    const arrayState = document.getElementById("array-state");
    const sortingCanvas = document.getElementById("sorting-canvas");
    const startButton = document.getElementById("start");
    const pauseButton = document.getElementById("pause");
    const resetButton = document.getElementById("reset");

    const canvasWidth = Math.floor(window.innerWidth * 0.8);
    const canvasHeight = Math.floor(window.innerHeight * 0.6);

    sortingCanvas.width = canvasWidth;
    sortingCanvas.height = canvasHeight;

    const ctx = sortingCanvas.getContext("2d");
    ctx.imageSmoothingEnabled = false; // Disable image smoothing
    const arrayLength = 50;
    let dataArray = generateRandomArray(arrayLength);
    let sortingInProgress = false;
    let paused = false;
    let currentSortingPromise = null;

    function generateRandomArray(length) {
        return Array.from({
                length
            }, () =>
            Math.floor(Math.random() * sortingCanvas.height)
        );
    }

    function drawArray(array, highlightedIndex1 = -1, highlightedIndex2 = -1) {
        ctx.clearRect(0, 0, sortingCanvas.width, sortingCanvas.height);
        const barWidth = Math.floor(sortingCanvas.width / array.length);
        for (let i = 0; i < array.length; i++) {
            const height = array[i];
            if (i === highlightedIndex1 || i === highlightedIndex2) {
                ctx.fillStyle = "red";
            } else {
                ctx.fillStyle = "#eec747";
            }
            ctx.fillRect(
                i * barWidth,
                sortingCanvas.height - height,
                barWidth,
                height
            );
        }
    }

    function updateArrayState(array) {
        arrayState.value = array.join(", ");
    }

    async function bubbleSort(array) {
        sortingInProgress = true;
        for (let i = 0; i < array.length; i++) {
            for (let j = 0; j < array.length - i - 1; j++) {
                if (!sortingInProgress) return;
                if (array[j] > array[j + 1]) {
                    const temp = array[j];
                    array[j] = array[j + 1];
                    array[j + 1] = temp;
                    updateArrayState(array); // Update array-state input
                }
                drawArray(array, j, j + 1);
                await new Promise((resolve) => setTimeout(resolve, 50));
                while (paused) {
                    await new Promise((resolve) => setTimeout(resolve, 50));
                }
            }
        }
        sortingInProgress = false;
    }


    async function selectionSort(array) {
        sortingInProgress = true;
        for (let i = 0; i < array.length; i++) {
            let minIndex = i;
            for (let j = i + 1; j < array.length; j++) {
                if (!sortingInProgress) return;
                if (array[j] < array[minIndex]) {
                    minIndex = j;
                }
                drawArray(array, i, minIndex);
                await new Promise((resolve) => setTimeout(resolve, 50));
                while (paused) {
                    await new Promise((resolve) => setTimeout(resolve, 50));
                }
            }
            const temp = array[i];
            array[i] = array[minIndex];
            array[minIndex] = temp;
            updateArrayState(array); // Update array-state input
        }
        sortingInProgress = false;
    }

    async function insertionSort(array) {
        sortingInProgress = true;
        for (let i = 1; i < array.length; i++) {
            let j = i - 1;
            const key = array[i];
            while (j >= 0 && array[j] > key) {
                if (!sortingInProgress) return;
                array[j + 1] = array[j];
                j--;
                updateArrayState(array); // Update array-state input
                drawArray(array, j, j + 1);
                await new Promise((resolve) => setTimeout(resolve, 50));
                while (paused) {
                    await new Promise((resolve) => setTimeout(resolve, 50));
                }
            }
            array[j + 1] = key;
        }
        sortingInProgress = false;
    }

    async function mergeSort(array) {
        sortingInProgress = true;
        const sortedArray = await mergeSortHelper(array, 0, array.length - 1);
        sortingInProgress = false;
        return sortedArray;
    }

    async function mergeSortHelper(array, start, end) {
        if (start >= end) {
            return;
        }

        const middleIndex = Math.floor((start + end) / 2);

        await mergeSortHelper(array, start, middleIndex);
        await mergeSortHelper(array, middleIndex + 1, end);
        await merge(array, start, middleIndex, end);
    }

    async function merge(array, start, middle, end) {
        const leftArray = array.slice(start, middle + 1);
        const rightArray = array.slice(middle + 1, end + 1);

        let leftIndex = 0;
        let rightIndex = 0;
        let mergeIndex = start;

        while (leftIndex < leftArray.length && rightIndex < rightArray.length) {
            if (!sortingInProgress) return;
            if (leftArray[leftIndex] <= rightArray[rightIndex]) {
                array[mergeIndex] = leftArray[leftIndex];
                leftIndex++;
            } else {
                array[mergeIndex] = rightArray[rightIndex];
                rightIndex++;
            }

            drawArray(array, mergeIndex, mergeIndex);
            mergeIndex++;

            updateArrayState(array); // Update array-state input
            await new Promise((resolve) => setTimeout(resolve, 50));
            while (paused) {
                await new Promise((resolve) => setTimeout(resolve, 50));
            }
        }

        while (leftIndex < leftArray.length) {
            array[mergeIndex] = leftArray[leftIndex];
            drawArray(array, mergeIndex, mergeIndex);
            mergeIndex++;
            leftIndex++;
        }

        while (rightIndex < rightArray.length) {
            array[mergeIndex] = rightArray[rightIndex];
            drawArray(array, mergeIndex, mergeIndex);
            mergeIndex++;
            rightIndex++;
        }
    }

    async function quickSort(array) {
        sortingInProgress = true;
        await quickSortHelper(array, 0, array.length - 1);
        sortingInProgress = false;
    }

    async function quickSortHelper(array, start, end) {
        if (start >= end) {
            return;
        }

        const pivotIndex = start;
        let leftIndex = start + 1;
        let rightIndex = end;
        while (rightIndex >= leftIndex) {
            if (!sortingInProgress) return; // change this line
            if (
                array[leftIndex] > array[pivotIndex] &&
                array[rightIndex] < array[pivotIndex]
            ) {
                const temp = array[leftIndex];
                array[leftIndex] = array[rightIndex];
                array[rightIndex] = temp;
                updateArrayState(array); // Update array-state input
            }
            if (array[leftIndex] <= array[pivotIndex]) {
                leftIndex++;
            }
            if (array[rightIndex] >= array[pivotIndex]) {
                rightIndex--;
            }
            drawArray(array, leftIndex, rightIndex);
            await new Promise((resolve) => setTimeout(resolve, 50));
            while (paused) {
                await new Promise((resolve) => setTimeout(resolve, 50));
            }
        }
        if (sortingInProgress) {
            const temp = array[pivotIndex];
            array[pivotIndex] = array[rightIndex];
            array[rightIndex] = temp;
            updateArrayState(array); // Update array-state input
        }

        const leftSubarrayIsSmaller =
            rightIndex - 1 - start < end - (rightIndex + 1);
        if (leftSubarrayIsSmaller) {
            await quickSortHelper(array, start, rightIndex - 1);
            await quickSortHelper(array, rightIndex + 1, end);
        } else {
            await quickSortHelper(array, rightIndex + 1, end);
            await quickSortHelper(array, start, rightIndex - 1);
        }
    }

    function getSelectedAlgorithm() {
        return algorithmSelect.options[algorithmSelect.selectedIndex].value;
    }


    function handleAlgorithmChange() {
        sortingInProgress = false;
        dataArray = generateRandomArray(dataArray.length);
        drawArray(dataArray);
    }

    startButton.addEventListener("click", async () => {
        if (currentSortingPromise) {
            sortingInProgress = false;
            paused = false;
            pauseButton.textContent = "Pause";
            await currentSortingPromise;
        }

        // Unpause the sorting before starting a new one
        paused = false;

        const selectedAlgorithm = getSelectedAlgorithm();
        currentSortingPromise = (async () => {
            if (selectedAlgorithm === "bubble") {
                await bubbleSort(dataArray);
            }
            if (selectedAlgorithm === "selection") {
                await selectionSort(dataArray);
            }
            if (selectedAlgorithm === "insertion") {
                await insertionSort(dataArray);
            }
            if (selectedAlgorithm === "merge") {
                await mergeSort(dataArray);
            }
            if (selectedAlgorithm === "quick") {
                await quickSort(dataArray);
            }
        })();
    });


    pauseButton.addEventListener("click", () => {
        if (sortingInProgress) {
            paused = !paused;
            pauseButton.textContent = paused ? "Resume" : "Pause";
        }
    });

    resetButton.addEventListener("click", () => {
        if (sortingInProgress) {
            sortingInProgress = false;
            paused = false;
            pauseButton.textContent = "Pause";
        }
        dataArray = generateRandomArray(arrayLength);
        drawArray(dataArray);
    });

    drawArray(dataArray);
    updateArrayState(dataArray);
});