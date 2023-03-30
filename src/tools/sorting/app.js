document.addEventListener("DOMContentLoaded", function() {
    const algorithmSelect = document.getElementById("algorithm");
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

    function generateRandomArray(length) {
        return Array.from({
                length
            }, () =>
            Math.floor(Math.random() * sortingCanvas.height)
        );
    }

    function drawArray(array) {
        ctx.clearRect(0, 0, sortingCanvas.width, sortingCanvas.height);
        const barWidth = Math.floor(sortingCanvas.width / array.length);
        for (let i = 0; i < array.length; i++) {
            const height = array[i];
            ctx.fillStyle = "#eec747";
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
                if (!sortingInProgress) break;
                if (array[j] > array[j + 1]) {
                    const temp = array[j];
                    array[j] = array[j + 1];
                    array[j + 1] = temp;
                    updateArrayState(array); // Update array-state input
                }
                drawArray(array);
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
                if (!sortingInProgress) break;
                if (array[j] < array[minIndex]) {
                    minIndex = j;
                }
                drawArray(array);
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
                if (!sortingInProgress) break;
                array[j + 1] = array[j];
                j--;
                updateArrayState(array); // Update array-state input
                drawArray(array);
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
        const sortedArray = await mergeSortHelper(array);
        sortingInProgress = false;
        return sortedArray;
    }

    async function mergeSortHelper(array) {
        if (array.length <= 1) {
            return array;
        }

        const middleIndex = Math.floor(array.length / 2);
        const leftArray = array.slice(0, middleIndex);
        const rightArray = array.slice(middleIndex);

        const leftSortedArray = await mergeSortHelper(leftArray);
        const rightSortedArray = await mergeSortHelper(rightArray);
        const sortedArray = await merge(leftSortedArray, rightSortedArray);
        return sortedArray;
    }

    async function merge(leftArray, rightArray) {
        const sortedArray = [];
        let leftIndex = 0;
        let rightIndex = 0;
        while (leftIndex < leftArray.length && rightIndex < rightArray.length) {
            if (!sortingInProgress) break;
            if (leftArray[leftIndex] < rightArray[rightIndex]) {
                sortedArray.push(leftArray[leftIndex]);
                leftIndex++;
            } else {
                sortedArray.push(rightArray[rightIndex]);
                rightIndex++;
            }
            updateArrayState(sortedArray); // Update array-state input
            drawArray(sortedArray);
            await new Promise((resolve) => setTimeout(resolve, 50));
            while (paused) {
                await new Promise((resolve) => setTimeout(resolve, 50));
            }
        }
        return sortedArray
            .concat(leftArray.slice(leftIndex))
            .concat(rightArray.slice(rightIndex));
    }

    async function quickSort(array) {
        sortingInProgress = true;
        const sortedArray = await quickSortHelper(array, 0, array.length - 1);
        sortingInProgress = false;
        return sortedArray;
    }

    async function quickSortHelper(array, start, end) {
        if (start >= end) {
            return;
        }

        const pivotIndex = start;
        let leftIndex = start + 1;
        let rightIndex = end;
        while (rightIndex >= leftIndex) {
            if (!sortingInProgress) break;
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
            drawArray(array);
            await new Promise((resolve) => setTimeout(resolve, 50));
            while (paused) {
                await new Promise((resolve) => setTimeout(resolve, 50));
            }
        }
        const temp = array[pivotIndex];
        array[pivotIndex] = array[rightIndex];
        array[rightIndex] = temp;
        updateArrayState(array); // Update array-state input
        const leftSubarrayIsSmaller =
            rightIndex - 1 - start < end - (rightIndex + 1);
        if (leftSubarrayIsSmaller) {
            await quickSortHelper(array, start, rightIndex - 1);
            await quickSortHelper(array, rightIndex + 1, end);
        } else {
            await quickSortHelper(array, rightIndex + 1, end);
            await quickSortHelper(array, start, rightIndex - 1);
        }

        return array;
    }

    function getSelectedAlgorithm() {
        return algorithmSelect.options[algorithmSelect.selectedIndex].value;
    }

    startButton.addEventListener("click", async () => {
        if (!sortingInProgress) {
            const selectedAlgorithm = getSelectedAlgorithm();
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
        }
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
});