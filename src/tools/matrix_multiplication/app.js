(function() {
    "use strict";

    const MAX_SIZE = 4;
    const rowsASelect = document.getElementById("rows-a");
    const colsASelect = document.getElementById("cols-a");
    const rowsBSelect = document.getElementById("rows-b");
    const colsBSelect = document.getElementById("cols-b");
    const compatibilityMessage = document.getElementById("compatibility-message");
    const matrixATable = document.getElementById("matrix-a").querySelector("tbody");
    const matrixBTable = document.getElementById("matrix-b").querySelector("tbody");
    const resultTable = document.getElementById("matrix-result").querySelector("tbody");
    const matrixASize = document.getElementById("matrix-a-size");
    const matrixBSize = document.getElementById("matrix-b-size");
    const resultSize = document.getElementById("result-size");
    const dimensionEquation = document.getElementById("dimension-equation");
    const operationCount = document.getElementById("operation-count");
    const statusMessage = document.getElementById("status-message");
    const breakdownCard = document.getElementById("breakdown-card");
    const multiplicationInsight = document.getElementById("multiplication-insight");
    const multiplicationMetrics = document.getElementById("multiplication-metrics");
    const productCanvas = document.getElementById("matrix-product-canvas");
    const productContext = productCanvas.getContext("2d");
    let lastProductPlot = null;

    const presets = {
        standard: {
            dims: [2, 3, 3, 2],
            A: [
                [1, 2, 3],
                [4, 5, 6]
            ],
            B: [
                [7, 8],
                [9, 10],
                [11, 12]
            ]
        },
        transform: {
            dims: [2, 2, 2, 3],
            A: [
                [0, -1],
                [1, 0]
            ],
            B: [
                [1, 2, 3],
                [2, 1, -1]
            ]
        },
        identity: {
            dims: [3, 3, 3, 3],
            A: [
                [1, 0, 0],
                [0, 1, 0],
                [0, 0, 1]
            ],
            B: [
                [3, 1, 4],
                [1, 5, 9],
                [2, 6, 5]
            ]
        },
        wide: {
            dims: [1, 4, 4, 1],
            A: [
                [2, -1, 3, 4]
            ],
            B: [
                [5],
                [0],
                [-2],
                [1]
            ]
        }
    };

    function dims() {
        return {
            rowsA: Number(rowsASelect.value),
            colsA: Number(colsASelect.value),
            rowsB: Number(rowsBSelect.value),
            colsB: Number(colsBSelect.value)
        };
    }

    function fmt(value) {
        if (!Number.isFinite(value)) return "NaN";
        if (Math.abs(value) < 1e-10) return "0";
        return Number(value.toFixed(6)).toString();
    }

    function setStatus(message, type = "info") {
        statusMessage.textContent = message;
        statusMessage.classList.toggle("is-error", type === "error");
        statusMessage.classList.toggle("is-success", type === "success");
    }

    function setTeaching(message, metrics) {
        multiplicationInsight.textContent = message;
        Array.from(multiplicationMetrics.children).forEach((node, index) => node.textContent = metrics[index] || "—");
    }

    function createInput(tableName, row, col) {
        const input = document.createElement("input");
        input.type = "text";
        input.inputMode = "decimal";
        input.autocomplete = "off";
        input.placeholder = `${tableName}${row + 1}${col + 1}`;
        input.setAttribute("aria-label", `Matrix ${tableName} row ${row + 1} column ${col + 1}`);
        input.dataset.row = String(row);
        input.dataset.col = String(col);
        input.addEventListener("input", () => {
            input.classList.remove("has-error");
            clearResult("Matrix edited. Multiply again to refresh the result.");
        });
        input.addEventListener("keydown", event => {
            if (event.key === "Enter") processMatrices();
        });
        return input;
    }

    function buildInputGrid(table, tableName) {
        table.innerHTML = "";
        for (let row = 0; row < MAX_SIZE; row++) {
            const tr = document.createElement("tr");
            for (let col = 0; col < MAX_SIZE; col++) {
                const td = document.createElement("td");
                td.appendChild(createInput(tableName, row, col));
                tr.appendChild(td);
            }
            table.appendChild(tr);
        }
    }

    function forEachInput(table, callback) {
        Array.from(table.querySelectorAll("input")).forEach(input => {
            callback(input, Number(input.dataset.row), Number(input.dataset.col));
        });
    }

    function updateActiveCells() {
        const {
            rowsA,
            colsA,
            rowsB,
            colsB
        } = dims();
        const compatible = colsA === rowsB;
        matrixASize.textContent = `${rowsA} row${rowsA === 1 ? "" : "s"} × ${colsA} column${colsA === 1 ? "" : "s"}`;
        matrixBSize.textContent = `${rowsB} row${rowsB === 1 ? "" : "s"} × ${colsB} column${colsB === 1 ? "" : "s"}`;
        resultSize.textContent = `${rowsA} row${rowsA === 1 ? "" : "s"} × ${colsB} column${colsB === 1 ? "" : "s"}`;
        dimensionEquation.textContent = compatible ? `A ${rowsA}×${colsA} · B ${rowsB}×${colsB} = C ${rowsA}×${colsB}` : `A ${rowsA}×${colsA} cannot multiply B ${rowsB}×${colsB}`;
        operationCount.textContent = compatible ? `${rowsA * colsA * colsB} scalar multiplications` : "Inner dimensions do not match";
        compatibilityMessage.textContent = compatible ? `A has ${colsA} column${colsA === 1 ? "" : "s"} and B has ${rowsB} row${rowsB === 1 ? "" : "s"}. The matrices are compatible.` : `A has ${colsA} column${colsA === 1 ? "" : "s"}, but B has ${rowsB} row${rowsB === 1 ? "" : "s"}. These must match.`;
        compatibilityMessage.classList.toggle("is-error", !compatible);
        document.getElementById("submit").disabled = !compatible;

        forEachInput(matrixATable, (input, row, col) => {
            const active = row < rowsA && col < colsA;
            input.disabled = !active;
            input.classList.toggle("is-inactive", !active);
            input.classList.remove("has-error");
            if (!active) input.value = "";
        });
        forEachInput(matrixBTable, (input, row, col) => {
            const active = row < rowsB && col < colsB;
            input.disabled = !active;
            input.classList.toggle("is-inactive", !active);
            input.classList.remove("has-error");
            if (!active) input.value = "";
        });

        clearResult(compatible ? "Dimensions changed. Multiply to calculate the product." : "Incompatible dimensions: A columns must equal B rows.");
    }

    function readMatrix(table, rows, cols, name) {
        const matrix = [];
        const errors = [];
        for (let row = 0; row < rows; row++) {
            const values = [];
            for (let col = 0; col < cols; col++) {
                const input = table.querySelector(`input[data-row="${row}"][data-col="${col}"]`);
                const raw = input.value.trim();
                const value = raw === "" ? 0 : Number(raw);
                if (!Number.isFinite(value)) {
                    input.classList.add("has-error");
                    errors.push(`${name}${row + 1}${col + 1}`);
                }
                values.push(value);
            }
            matrix.push(values);
        }
        if (errors.length > 0) {
            throw new Error(`Enter numeric values for ${errors.slice(0, 4).join(", ")}${errors.length > 4 ? "..." : ""}.`);
        }
        return matrix;
    }

    function multiply(A, B) {
        return A.map(row => B[0].map((_, colIndex) =>
            row.reduce((sum, value, innerIndex) => sum + value * B[innerIndex][colIndex], 0)
        ));
    }

    function productPlotColor(value, maximum) {
        const strength = maximum > 0 ? Math.min(1, Math.abs(value) / maximum) : 0;
        if (Math.abs(value) < 1e-12) return "rgba(148, 163, 184, 0.10)";
        return value > 0 ? `rgba(8, 126, 139, ${0.18 + strength * 0.72})` :
            `rgba(220, 76, 100, ${0.18 + strength * 0.72})`;
    }

    function renderProductPlot(A, B, C, selectedRow = 0, selectedCol = 0) {
        lastProductPlot = { A, B, C, selectedRow, selectedCol };
        const wrap = productCanvas.parentElement;
        const cssWidth = Math.max(680, wrap.clientWidth - 20);
        const cssHeight = parseFloat(getComputedStyle(productCanvas).height) || 340;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        productCanvas.width = Math.round(cssWidth * dpr);
        productCanvas.height = Math.round(cssHeight * dpr);
        productCanvas.style.width = `${cssWidth}px`;
        productContext.setTransform(dpr, 0, 0, dpr, 0, 0);

        const ctx = productContext;
        const text = getComputedStyle(document.body).getPropertyValue("--tool-text").trim() || "#1e293b";
        const muted = getComputedStyle(document.body).getPropertyValue("--tool-text-muted").trim() || "#64748b";
        const border = getComputedStyle(document.body).getPropertyValue("--tool-border").trim() || "#dbe3ec";
        const surface = getComputedStyle(document.body).getPropertyValue("--tool-surface-raised").trim() || "#f8fafc";
        const accent = getComputedStyle(document.body).getPropertyValue("--tool-primary").trim() || "#087e8b";
        const maximum = Math.max(1, ...A.flat().concat(B.flat(), C.flat()).map(Math.abs));
        ctx.clearRect(0, 0, cssWidth, cssHeight);
        ctx.fillStyle = surface;
        ctx.fillRect(0, 0, cssWidth, cssHeight);

        const gap = 42;
        const panelWidth = (cssWidth - gap * 2 - 36) / 3;
        const matrices = [
            { name: "A", values: A, kind: "a" },
            { name: "B", values: B, kind: "b" },
            { name: "C = AB", values: C, kind: "c" }
        ];
        matrices.forEach((entry, panelIndex) => {
            const rows = entry.values.length;
            const cols = entry.values[0].length;
            const cell = Math.min(62, panelWidth / cols, (cssHeight - 90) / rows);
            const gridWidth = cell * cols;
            const gridHeight = cell * rows;
            const panelX = 18 + panelIndex * (panelWidth + gap);
            const startX = panelX + (panelWidth - gridWidth) / 2;
            const startY = 52 + (cssHeight - 72 - gridHeight) / 2;
            ctx.fillStyle = text;
            ctx.font = "800 16px system-ui, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(entry.name, panelX + panelWidth / 2, 28);
            ctx.fillStyle = muted;
            ctx.font = "11px system-ui, sans-serif";
            ctx.fillText(`${rows} × ${cols}`, panelX + panelWidth / 2, 44);

            entry.values.forEach((row, rowIndex) => row.forEach((value, colIndex) => {
                const x = startX + colIndex * cell;
                const y = startY + rowIndex * cell;
                ctx.fillStyle = productPlotColor(value, maximum);
                ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2);
                const contributor = entry.kind === "a" ? rowIndex === selectedRow :
                    entry.kind === "b" ? colIndex === selectedCol :
                        rowIndex === selectedRow && colIndex === selectedCol;
                ctx.strokeStyle = contributor ? accent : border;
                ctx.lineWidth = contributor ? 3 : 1;
                ctx.strokeRect(x + 1.5, y + 1.5, cell - 3, cell - 3);
                ctx.fillStyle = text;
                ctx.font = `${contributor ? "800" : "650"} ${Math.max(10, Math.min(14, cell * .25))}px system-ui, sans-serif`;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(fmt(value), x + cell / 2, y + cell / 2);
            }));

            if (panelIndex < 2) {
                ctx.fillStyle = muted;
                ctx.font = "700 22px system-ui, sans-serif";
                ctx.fillText(panelIndex === 0 ? "×" : "=", panelX + panelWidth + gap / 2, cssHeight / 2);
            }
        });
        productCanvas.dataset.matrices = JSON.stringify({ A, B, C });
        productCanvas.dataset.selection = `${selectedRow},${selectedCol}`;
    }

    function clearProductPlot() {
        lastProductPlot = null;
        productContext.clearRect(0, 0, productCanvas.width, productCanvas.height);
        productCanvas.removeAttribute("data-matrices");
        productCanvas.removeAttribute("data-selection");
    }

    function renderResult(result, A, B) {
        resultTable.innerHTML = "";
        result.forEach((row, rowIndex) => {
            const tr = document.createElement("tr");
            row.forEach((value, colIndex) => {
                const td = document.createElement("td");
                const cell = document.createElement("button");
                cell.className = "result-cell";
                cell.type = "button";
                cell.textContent = fmt(value);
                cell.setAttribute("aria-label", `Show calculation for result row ${rowIndex + 1} column ${colIndex + 1}`);
                cell.addEventListener("click", () => showBreakdown(rowIndex, colIndex, A, B, result));
                td.appendChild(cell);
                tr.appendChild(td);
            });
            resultTable.appendChild(tr);
        });
        showBreakdown(0, 0, A, B, result);
    }

    function showBreakdown(row, col, A, B, result) {
        resultTable.querySelectorAll(".result-cell").forEach(cell => cell.classList.remove("is-highlighted"));
        forEachInput(matrixATable, input => input.classList.remove("is-contributor"));
        forEachInput(matrixBTable, input => input.classList.remove("is-contributor"));
        const selected = resultTable.rows[row]?.cells[col]?.querySelector(".result-cell");
        if (selected) selected.classList.add("is-highlighted");
        renderProductPlot(A, B, result, row, col);

        A[row].forEach((_, innerIndex) => {
            matrixATable
                .querySelector(`input[data-row="${row}"][data-col="${innerIndex}"]`)
                ?.classList.add("is-contributor");
            matrixBTable
                .querySelector(`input[data-row="${innerIndex}"][data-col="${col}"]`)
                ?.classList.add("is-contributor");
        });

        const terms = A[row].map((value, index) => `${fmt(value)} × ${fmt(B[index][col])}`);
        const expression = terms.join(" + ");
        breakdownCard.innerHTML = `
            <strong>C${row + 1}${col + 1} = row ${row + 1} of A dot column ${col + 1} of B</strong>
            <span>${expression} = ${fmt(result[row][col])}</span>
        `;
    }

    function clearResult(message = "Ready.") {
        resultTable.innerHTML = "";
        forEachInput(matrixATable, input => input.classList.remove("is-contributor"));
        forEachInput(matrixBTable, input => input.classList.remove("is-contributor"));
        breakdownCard.innerHTML = "<strong>Dot product preview</strong><span>Run multiplication to see how a result cell is formed.</span>";
        setStatus(message);
        clearProductPlot();
    }

    function processMatrices() {
        try {
            forEachInput(matrixATable, input => input.classList.remove("has-error"));
            forEachInput(matrixBTable, input => input.classList.remove("has-error"));
            const {
                rowsA,
                colsA,
                rowsB,
                colsB
            } = dims();
            if (colsA !== rowsB) throw new Error(`Cannot multiply: A has ${colsA} columns while B has ${rowsB} rows.`);
            const A = readMatrix(matrixATable, rowsA, colsA, "A");
            const B = readMatrix(matrixBTable, rowsB, colsB, "B");
            const result = multiply(A, B);
            renderResult(result, A, B);
            const scalarMultiplications = rowsA * colsA * colsB;
            setTeaching(`The ${rowsA} by ${colsB} product contains ${rowsA * colsB} dot products. Select any result cell to see its ${colsA}-term calculation.`, [`Output shape: ${rowsA} × ${colsB}`, `Dot products: ${rowsA * colsB}`, `Terms per cell: ${colsA}`, `Scalar operations: ${scalarMultiplications} multiply, ${rowsA * colsB * Math.max(0, colsA - 1)} add`]);
            setStatus("Multiplication complete.", "success");
        } catch (error) {
            clearResult(error.message);
            setStatus(error.message, "error");
        }
    }

    function writeMatrix(table, values) {
        forEachInput(table, input => {
            const row = Number(input.dataset.row);
            const col = Number(input.dataset.col);
            input.value = values[row]?.[col] ?? "";
            input.classList.remove("has-error");
        });
    }

    function applyPreset(name) {
        const preset = presets[name];
        rowsASelect.value = String(preset.dims[0]);
        colsASelect.value = String(preset.dims[1]);
        rowsBSelect.value = String(preset.dims[2]);
        colsBSelect.value = String(preset.dims[3]);
        updateActiveCells();
        writeMatrix(matrixATable, preset.A);
        writeMatrix(matrixBTable, preset.B);
        processMatrices();
    }

    function clearAll() {
        forEachInput(matrixATable, input => {
            input.value = "";
            input.classList.remove("has-error");
        });
        forEachInput(matrixBTable, input => {
            input.value = "";
            input.classList.remove("has-error");
        });
        clearResult("Cleared. Empty active cells count as zero.");
        setTeaching("Each output cell is a dot product: one row from A paired with one column from B. Choose a preset to see the full calculation immediately.", ["Output shape: —", "Dot products: —", "Terms per cell: —", "Scalar operations: —"]);
    }

    function transposeProduct() {
        const {
            rowsA,
            colsA,
            rowsB,
            colsB
        } = dims();
        if (colsA !== rowsB) throw new Error("Transpose operation requires a valid A × B product first.");
        const A = readMatrix(matrixATable, rowsA, colsA, "A");
        const B = readMatrix(matrixBTable, rowsB, colsB, "B");
        rowsASelect.value = String(colsB);
        colsASelect.value = String(rowsB);
        rowsBSelect.value = String(colsA);
        colsBSelect.value = String(rowsA);
        updateActiveCells();
        writeMatrix(matrixATable, B[0].map((_, col) => B.map(row => row[col])));
        writeMatrix(matrixBTable, A[0].map((_, col) => A.map(row => row[col])));
        processMatrices();
        setStatus("Inputs changed to B^T and A^T, producing (A x B)^T.", "success");
    }

    buildInputGrid(matrixATable, "A");
    buildInputGrid(matrixBTable, "B");

    [rowsASelect, colsASelect, rowsBSelect, colsBSelect].forEach(select => {
        select.addEventListener("change", updateActiveCells);
    });

    document.getElementById("submit").addEventListener("click", processMatrices);
    document.getElementById("reset").addEventListener("click", clearAll);
    document.getElementById("swap").addEventListener("click", () => {
        try {
            transposeProduct();
        } catch (error) {
            setStatus(error.message, "error");
        }
    });
    document.querySelectorAll("[data-preset]").forEach(button => {
        button.addEventListener("click", () => applyPreset(button.dataset.preset));
    });

    window.addEventListener("resize", () => {
        if (lastProductPlot) renderProductPlot(
            lastProductPlot.A,
            lastProductPlot.B,
            lastProductPlot.C,
            lastProductPlot.selectedRow,
            lastProductPlot.selectedCol
        );
    });
    document.getElementById("dark-mode-button")?.addEventListener("click", () => setTimeout(() => {
        if (lastProductPlot) renderProductPlot(
            lastProductPlot.A,
            lastProductPlot.B,
            lastProductPlot.C,
            lastProductPlot.selectedRow,
            lastProductPlot.selectedCol
        );
    }, 0));

    updateActiveCells();
    applyPreset("standard");
})();
