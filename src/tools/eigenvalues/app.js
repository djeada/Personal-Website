(function() {
    "use strict";

    const matrixTable = document.getElementById("matrix-input");
    const sizeSelect = document.getElementById("matrix-size");
    const sizeLabel = document.getElementById("matrix-size-label");
    const methodStatus = document.getElementById("method-status");
    const inputStatus = document.getElementById("input-status");
    const resultSummary = document.getElementById("result-summary");
    const resultCards = document.getElementById("result-cards");
    const clearButton = document.getElementById("clear");
    const exactButton = document.getElementById("calculate-analytical");
    const powerButton = document.getElementById("calculate-power");
    const eigenInsight = document.getElementById("eigen-insight");
    const eigenMetrics = document.getElementById("eigen-metrics");

    const exactValuesOutput = document.getElementById("output-eigenvalues-analytical");
    const exactVectorsOutput = document.getElementById("output-eigenvectors-analytical");
    const powerValueOutput = document.getElementById("output-eigenvalue-power");
    const powerVectorOutput = document.getElementById("output-eigenvector-power");

    const inputs = Array.from(matrixTable.querySelectorAll("input"));
    const grid = Array.from({ length: 4 }, (_, row) => inputs.slice(row * 4, row * 4 + 4));

    const presets = {
        diagonal: {
            size: 3,
            matrix: [
                [4, 0, 0],
                [0, 2, 0],
                [0, 0, -1]
            ]
        },
        symmetric: {
            size: 3,
            matrix: [
                [4, 1, 1],
                [1, 3, 0],
                [1, 0, 2]
            ]
        },
        rotation: {
            size: 2,
            matrix: [
                [0, -1],
                [1, 0]
            ]
        },
        markov: {
            size: 3,
            matrix: [
                [0.8, 0.2, 0.1],
                [0.1, 0.7, 0.3],
                [0.1, 0.1, 0.6]
            ]
        }
    };

    function selectedSize() {
        return Number(sizeSelect.value);
    }

    function formatNumber(value) {
        if (!Number.isFinite(value)) return "NaN";
        if (Math.abs(value) < 1e-10) return "0";
        return Number(value.toFixed(6)).toString();
    }

    function formatVector(vector) {
        return `[${vector.map(formatNumber).join(", ")}]`;
    }

    function setStatus(message, type = "info") {
        inputStatus.textContent = message;
        inputStatus.classList.toggle("is-error", type === "error");
        inputStatus.classList.toggle("is-success", type === "success");
    }

    function setTeaching(message, metrics) {
        eigenInsight.textContent = message;
        Array.from(eigenMetrics.children).forEach((node, index) => node.textContent = metrics[index] || "—");
    }

    function setEmptyState(title, detail) {
        resultCards.innerHTML = "";
        const card = document.createElement("article");
        card.className = "empty-state";
        card.innerHTML = `<strong></strong><span></span>`;
        card.querySelector("strong").textContent = title;
        card.querySelector("span").textContent = detail;
        resultCards.appendChild(card);
        resultSummary.textContent = detail;
    }

    function clearOutputs() {
        exactValuesOutput.value = "";
        exactVectorsOutput.value = "";
        powerValueOutput.value = "";
        powerVectorOutput.value = "";
    }

    function updateSizeUI() {
        const size = selectedSize();
        sizeLabel.textContent = `${size}x${size} matrix`;
        methodStatus.textContent = size <= 3 ?
            "Exact real eigenpairs and power iteration are available." :
            "Exact 4x4 solving is unavailable; use power iteration.";
        exactButton.disabled = size === 4;
        exactButton.title = size === 4 ? "Exact 4x4 eigenpairs are not supported in this browser tool." : "";

        grid.forEach((row, rowIndex) => {
            row.forEach((input, columnIndex) => {
                const active = rowIndex < size && columnIndex < size;
                input.classList.toggle("is-inactive", !active);
                input.disabled = !active;
                input.setAttribute("aria-disabled", String(!active));
                input.classList.remove("has-error");
            });
        });
    }

    function readMatrix() {
        const size = selectedSize();
        const matrix = [];
        const errors = [];

        grid.forEach(row => row.forEach(input => input.classList.remove("has-error")));

        for (let row = 0; row < size; row++) {
            const values = [];
            for (let column = 0; column < size; column++) {
                const input = grid[row][column];
                const raw = input.value.trim();
                const value = Number(raw);
                if (raw === "" || !Number.isFinite(value)) {
                    input.classList.add("has-error");
                    errors.push(`a${row + 1}${column + 1}`);
                }
                values.push(value);
            }
            matrix.push(values);
        }

        if (errors.length > 0) {
            return {
                matrix: null,
                error: `Fill numeric values for ${errors.slice(0, 4).join(", ")}${errors.length > 4 ? "..." : ""}.`
            };
        }

        return { matrix, error: "" };
    }

    function writeMatrix(matrix) {
        const size = matrix.length;
        sizeSelect.value = String(size);
        grid.forEach(row => row.forEach(input => {
            input.value = "";
            input.classList.remove("has-error");
        }));
        matrix.forEach((row, rowIndex) => {
            row.forEach((value, columnIndex) => {
                grid[rowIndex][columnIndex].value = String(value);
            });
        });
        updateSizeUI();
        clearOutputs();
        setEmptyState("Preset loaded", "Choose exact eigenpairs or power iteration.");
        setStatus(`${size}x${size} preset loaded.`, "success");
    }

    function characteristicPolynomial2x2(A) {
        const [[a, b], [c, d]] = A;
        const trace = a + d;
        const determinant = a * d - b * c;
        return [1, -trace, determinant];
    }

    function characteristicPolynomial3x3(A) {
        const [a, b, c] = A[0];
        const [d, e, f] = A[1];
        const [g, h, i] = A[2];
        const trace = a + e + i;
        const second = (a * e + e * i + a * i) - (b * d + c * g + f * h);
        const determinant = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
        return [1, -trace, second, -determinant];
    }

    function findQuadraticRealRoots([, p2, p3]) {
        const discriminant = p2 * p2 - 4 * p3;
        if (discriminant < -1e-12) return [];
        if (Math.abs(discriminant) <= 1e-12) return [-p2 / 2];
        const root = Math.sqrt(discriminant);
        return [(-p2 + root) / 2, (-p2 - root) / 2].sort((a, b) => a - b);
    }

    function findCubicRealRoots([p1, p2, p3, p4]) {
        if (p1 !== 1) {
            p2 /= p1;
            p3 /= p1;
            p4 /= p1;
        }

        const A = p2;
        const B = p3;
        const C = p4;
        const shift = A / 3;
        const a = B - (A * A) / 3;
        const b = (2 * A * A * A) / 27 - (A * B) / 3 + C;
        const Q = a / 3;
        const R = b / 2;
        const D = Q * Q * Q + R * R;
        const roots = [];

        if (Math.abs(D) < 1e-14) {
            if (Math.abs(R) < 1e-14 && Math.abs(Q) < 1e-14) {
                roots.push(-shift);
            } else {
                const t1 = Math.cbrt(-R) - shift;
                roots.push(t1);
                roots.push(-A / 3 - (t1 + A / 3));
            }
        } else if (D > 0) {
            const S = Math.cbrt(-R + Math.sqrt(D));
            const T = Math.cbrt(-R - Math.sqrt(D));
            roots.push(S + T - shift);
        } else {
            const theta = Math.acos(-R / Math.sqrt(-Q * Q * Q));
            const radius = Math.sqrt(-Q);
            roots.push(
                2 * radius * Math.cos(theta / 3) - shift,
                2 * radius * Math.cos((theta + 2 * Math.PI) / 3) - shift,
                2 * radius * Math.cos((theta + 4 * Math.PI) / 3) - shift
            );
        }

        return roots.map(root => Math.abs(root) < 1e-14 ? 0 : root).sort((a, b) => a - b);
    }

    function gaussJordanElimination(matrix) {
        const rows = matrix.length;
        const cols = matrix[0].length;
        let r = 0;
        for (let c = 0; c < cols - 1 && r < rows; c++) {
            let pivot = r;
            for (let i = r + 1; i < rows; i++) {
                if (Math.abs(matrix[i][c]) > Math.abs(matrix[pivot][c])) pivot = i;
            }
            if (Math.abs(matrix[pivot][c]) < 1e-12) continue;
            [matrix[r], matrix[pivot]] = [matrix[pivot], matrix[r]];
            const pv = matrix[r][c];
            for (let j = c; j < cols; j++) matrix[r][j] /= pv;
            for (let i = 0; i < rows; i++) {
                if (i === r) continue;
                const factor = matrix[i][c];
                for (let j = c; j < cols; j++) matrix[i][j] -= factor * matrix[r][j];
            }
            r++;
        }
    }

    function findEigenvector(A, lambda) {
        const size = A.length;
        const augmented = A.map((row, rowIndex) =>
            row.map((value, columnIndex) => rowIndex === columnIndex ? value - lambda : value).concat([0])
        );
        gaussJordanElimination(augmented);

        const pivotCols = [];
        for (let row = 0; row < size; row++) {
            for (let column = 0; column < size; column++) {
                if (Math.abs(augmented[row][column]) > 1e-10) {
                    pivotCols.push(column);
                    break;
                }
            }
        }

        const freeCols = Array.from({ length: size }, (_, index) => index).filter(column => !pivotCols.includes(column));
        const vector = Array(size).fill(0);
        if (freeCols.length === 0) return vector;
        vector[freeCols[0]] = 1;

        for (let row = size - 1; row >= 0; row--) {
            let pivotCol = -1;
            for (let column = 0; column < size; column++) {
                if (Math.abs(augmented[row][column]) > 1e-10) {
                    pivotCol = column;
                    break;
                }
            }
            if (pivotCol < 0) continue;
            let sum = 0;
            for (let column = pivotCol + 1; column < size; column++) {
                sum += augmented[row][column] * vector[column];
            }
            vector[pivotCol] = -sum;
        }

        const norm = Math.hypot(...vector);
        return norm < 1e-12 ? vector : vector.map(value => value / norm);
    }

    function multiplyMatrixVector(matrix, vector) {
        return matrix.map(row => row.reduce((sum, value, index) => sum + value * vector[index], 0));
    }

    function dot(a, b) {
        return a.reduce((sum, value, index) => sum + value * b[index], 0);
    }

    function normalize(vector) {
        const norm = Math.hypot(...vector);
        if (norm < 1e-14) return null;
        return vector.map(value => value / norm);
    }

    function powerIteration(matrix, maxIterations = 1000, tolerance = 1e-10) {
        const size = matrix.length;
        let vector = normalize(Array.from({ length: size }, (_, index) => index + 1));
        let eigenvalue = 0;
        let converged = false;
        let iterations = 0;

        for (let iteration = 1; iteration <= maxIterations; iteration++) {
            const next = multiplyMatrixVector(matrix, vector);
            const normalized = normalize(next);
            if (!normalized) {
                throw new Error("Power iteration reached the zero vector.");
            }
            vector = normalized;
            const Av = multiplyMatrixVector(matrix, vector);
            const nextEigenvalue = dot(vector, Av) / dot(vector, vector);
            iterations = iteration;
            if (Math.abs(nextEigenvalue - eigenvalue) < tolerance) {
                eigenvalue = nextEigenvalue;
                converged = true;
                break;
            }
            eigenvalue = nextEigenvalue;
        }

        return { eigenvalue, eigenvector: vector, iterations, converged };
    }

    function uniqueRoots(roots) {
        return roots.filter((value, index, all) => index === 0 || Math.abs(value - all[index - 1]) > 1e-9);
    }

    function renderExactResults(roots, vectors) {
        resultCards.innerHTML = "";
        roots.forEach((root, index) => {
            const card = document.createElement("article");
            card.className = "result-card";
            card.innerHTML = `
                <header>
                    <h3>Eigenpair ${index + 1}</h3>
                    <span class="lambda-pill"></span>
                </header>
                <div class="vector-row"></div>
            `;
            card.querySelector(".lambda-pill").textContent = `lambda = ${formatNumber(root)}`;
            const vectorRow = card.querySelector(".vector-row");
            vectors[index].forEach(value => {
                const cell = document.createElement("span");
                cell.className = "vector-cell";
                cell.textContent = formatNumber(value);
                vectorRow.appendChild(cell);
            });
            resultCards.appendChild(card);
        });
    }

    function renderPowerResult(result) {
        resultCards.innerHTML = "";
        const card = document.createElement("article");
        card.className = "result-card";
        card.innerHTML = `
            <header>
                <h3>Dominant eigenpair</h3>
                <span class="lambda-pill"></span>
            </header>
            <div class="vector-row"></div>
        `;
        card.querySelector(".lambda-pill").textContent = `lambda ≈ ${formatNumber(result.eigenvalue)}`;
        const vectorRow = card.querySelector(".vector-row");
        result.eigenvector.forEach(value => {
            const cell = document.createElement("span");
            cell.className = "vector-cell";
            cell.textContent = formatNumber(value);
            vectorRow.appendChild(cell);
        });
        resultCards.appendChild(card);
    }

    function calculateExact() {
        const { matrix, error } = readMatrix();
        clearOutputs();
        if (!matrix) {
            setStatus(error, "error");
            setEmptyState("Input needs attention", error);
            return;
        }

        const size = matrix.length;
        if (size === 4) {
            const message = "Exact 4x4 eigenpairs are not supported here. Use power iteration for the dominant eigenpair.";
            setStatus(message, "error");
            setEmptyState("Exact method unavailable", message);
            return;
        }

        const coefficients = size === 2 ? characteristicPolynomial2x2(matrix) : characteristicPolynomial3x3(matrix);
        const roots = uniqueRoots(size === 2 ? findQuadraticRealRoots(coefficients) : findCubicRealRoots(coefficients));
        if (roots.length === 0) {
            const message = "This matrix has no real exact eigenvalues in the supported solver.";
            exactValuesOutput.value = "No real eigenvalues.";
            exactVectorsOutput.value = "";
            setStatus(message, "error");
            setEmptyState("No real eigenvalues", "Power iteration may still reveal a dominant real direction for some matrices.");
            return;
        }

        const vectors = roots.map(root => findEigenvector(matrix, root));
        exactValuesOutput.value = roots.map(formatNumber).join(", ");
        exactVectorsOutput.value = roots.map((root, index) =>
            `lambda=${formatNumber(root)} => ${formatVector(vectors[index])}`
        ).join("\n");
        renderExactResults(roots, vectors);
        resultSummary.textContent = `${roots.length} real eigenpair${roots.length === 1 ? "" : "s"} found.`;
        const dominant = roots.reduce((best, value) => Math.abs(value) > Math.abs(best) ? value : best, roots[0]);
        const signs = roots.map(Math.sign);
        const behavior = signs.every(sign => sign > 0) ? "Every real eigenvalue is positive, so invariant directions keep their orientation." :
            signs.some(sign => sign < 0) ? "A negative eigenvalue reverses at least one invariant direction." : "A zero eigenvalue collapses at least one invariant direction.";
        setTeaching(behavior, ["Method: exact", `Real eigenpairs: ${roots.length}`, `Dominant value: ${formatNumber(dominant)}`, "Convergence: not iterative"]);
        setStatus("Exact calculation complete.", "success");
    }

    function calculatePower() {
        const { matrix, error } = readMatrix();
        clearOutputs();
        if (!matrix) {
            setStatus(error, "error");
            setEmptyState("Input needs attention", error);
            return;
        }

        try {
            const result = powerIteration(matrix);
            powerValueOutput.value = formatNumber(result.eigenvalue);
            powerVectorOutput.value = formatVector(result.eigenvector);
            renderPowerResult(result);
            resultSummary.textContent = `${result.converged ? "Converged" : "Stopped"} after ${result.iterations} iterations.`;
            setTeaching("Power iteration estimates only the strongest invariant direction. It can miss other eigenpairs and may struggle when dominant magnitudes are tied.", ["Method: power iteration", "Real eigenpairs: dominant only", `Dominant value: ${formatNumber(result.eigenvalue)}`, `Convergence: ${result.converged ? `${result.iterations} iterations` : "not reached"}`]);
            setStatus("Power iteration complete.", result.converged ? "success" : "info");
        } catch (error) {
            setStatus(error.message, "error");
            setEmptyState("Power iteration failed", error.message);
        }
    }

    function clearAll() {
        grid.forEach(row => row.forEach(input => {
            input.value = "";
            input.classList.remove("has-error");
        }));
        clearOutputs();
        setEmptyState("No calculation yet", "Enter a matrix or choose a preset.");
        setTeaching("Choose a preset or enter a matrix, then run a method. Eigenvectors identify directions preserved by the transformation; eigenvalues show their scale.", ["Method: not run", "Real eigenpairs: —", "Dominant value: —", "Convergence: —"]);
        setStatus("Cleared.");
    }

    sizeSelect.addEventListener("change", () => {
        updateSizeUI();
        clearOutputs();
        setEmptyState("Size changed", "Run a method to calculate with the active cells.");
        setStatus(`${selectedSize()}x${selectedSize()} mode active.`);
    });

    inputs.forEach(input => {
        input.addEventListener("input", () => {
            input.classList.remove("has-error");
            clearOutputs();
            setStatus("Matrix edited. Run a method to refresh results.");
        });
        input.addEventListener("keydown", event => {
            if (event.key === "Enter") calculateExact();
        });
    });

    document.querySelectorAll("[data-preset]").forEach(button => {
        button.addEventListener("click", () => writeMatrix(presets[button.dataset.preset].matrix));
    });

    clearButton.addEventListener("click", clearAll);
    exactButton.addEventListener("click", calculateExact);
    powerButton.addEventListener("click", calculatePower);

    updateSizeUI();
    writeMatrix(presets.symmetric.matrix);
    calculateExact();
})();
