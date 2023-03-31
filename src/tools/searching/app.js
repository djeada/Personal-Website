document.addEventListener("DOMContentLoaded", function() {
    const algorithmSelect = document.getElementById("algorithm");
    const arrayState = document.getElementById("array-state");
    const searchTargetInput = document.getElementById("search-target");
    const searchingCanvas = document.getElementById("searching-canvas");
    const startButton = document.getElementById("start");
    const pauseButton = document.getElementById("pause");
    const resetButton = document.getElementById("reset");

    const canvasWidth = Math.floor(window.innerWidth * 0.8);
    const canvasHeight = Math.floor(window.innerHeight * 0.6);

    searchingCanvas.width = canvasWidth;
    searchingCanvas.height = canvasHeight;

    const ctx = searchingCanvas.getContext("2d");
    ctx.imageSmoothingEnabled = false; // Disable image smoothing
    const arrayLength = 50;
    let dataArray = generateSortedRandomArray(arrayLength);
    let searchingInProgress = false;
    let paused = false;

    function generateSortedRandomArray(length) {
        const array = Array.from({
            length
        }, () => Math.floor(Math.random() * searchingCanvas.height));
        return array.sort((a, b) => a - b);
    }

    function drawArray(array, highlightedIndex = -1) {
        ctx.clearRect(0, 0, searchingCanvas.width, searchingCanvas.height);
        const barWidth = Math.floor(searchingCanvas.width / array.length);
        for (let i = 0; i < array.length; i++) {
            const height = array[i];
            if (i === highlightedIndex) {
                ctx.fillStyle = "red";
            } else {
                ctx.fillStyle = "#eec747";
            }
            ctx.fillRect(
                i * barWidth,
                searchingCanvas.height - height,
                barWidth,
                height
            );
        }
    }

    function updateArrayState(array) {
        arrayState.value = array.join(", ");
    }

    async function linearSearch(array, target) {
        searchingInProgress = true;
        for (let i = 0; i < array.length; i++) {
            if (!searchingInProgress) break;
            if (array[i] === target) {
                drawArray(array, i);
                break;
            }
            drawArray(array, i);
            await new Promise((resolve) => setTimeout(resolve, 50));
            while (paused) {
                await new Promise((resolve) => setTimeout(resolve, 50));
            }
        }
        searchingInProgress = false;
    }

    async function binarySearch(array, target) {
        searchingInProgress = true;
        let left = 0;
        let right = array.length - 1;
        while (left <= right) {
            if (!searchingInProgress) break;
            const middle = Math.floor((left + right) / 2);
            if (array[middle] === target) {
                drawArray(array, middle);
                break;
            } else if (array[middle] < target) {
                left = middle + 1;
            } else {
                right = middle - 1;
            }
            drawArray(array, middle);
            await new Promise((resolve) => setTimeout(resolve, 50));
            while (paused) {
                await new Promise((resolve) => setTimeout(resolve, 50));
            }
        }
        searchingInProgress = false;
    }

    function getSelectedAlgorithm() {
        return algorithmSelect.options[algorithmSelect.selectedIndex].value;
    }

    function handleAlgorithmChange() {
        searchingInProgress = false;
        paused = true;
        dataArray = generateSortedRandomArray(dataArray.length);
        drawArray(dataArray);
    }

    startButton.addEventListener("click", async () => {
        paused = false;

        const selectedAlgorithm = getSelectedAlgorithm();
        const searchTarget = parseInt(searchTargetInput.value);
        if (selectedAlgorithm === "linear") {
            await linearSearch(dataArray, searchTarget);
        }
        if (selectedAlgorithm === "binary") {
            await binarySearch(dataArray, searchTarget);
        }
    });

    pauseButton.addEventListener("click", () => {
        paused = !paused;
        pauseButton.innerText = paused ? "Resume" : "Pause";
    });

    resetButton.addEventListener("click", () => {
        handleAlgorithmChange();
    });

    algorithmSelect.addEventListener("change", handleAlgorithmChange);

    drawArray(dataArray);
    updateArrayState(dataArray);
});