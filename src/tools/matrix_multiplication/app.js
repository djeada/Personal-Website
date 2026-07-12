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
    const geometryCanvas = document.getElementById("matrix-geometry-canvas");
    const geometryContext = geometryCanvas.getContext("2d");
    const geometryMessage = document.getElementById("geometry-message");
    let geometryStage = 0;
    let geometryTweenMatrix = null;
    let geometryAnimationFrame = 0;
    let lastProductPlot = null;

    const presets = {
        geometric: {
            dims: [2, 2, 2, 2],
            A: [[1, -0.65], [0.45, 1]],
            B: [[1.4, 0.35], [0, 0.75]]
        },
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

    function drawGeometricProduct(A, B, C) {
        const valid = A.length === 2 && A[0].length === 2 && B.length === 2 && B[0].length === 2;
        const wrap = geometryCanvas.parentElement;
        wrap.classList.toggle("is-unavailable", !valid);
        const width = Math.max(900, wrap.clientWidth - 16);
        const height = parseFloat(getComputedStyle(geometryCanvas).height) || 520;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        geometryCanvas.width = Math.round(width * dpr);
        geometryCanvas.height = Math.round(height * dpr);
        geometryCanvas.style.width = `${width}px`;
        geometryContext.setTransform(dpr, 0, 0, dpr, 0, 0);
        const ctx = geometryContext;
        const surface = getComputedStyle(document.body).getPropertyValue("--tool-surface-raised").trim() || "#f8fafc";
        const border = getComputedStyle(document.body).getPropertyValue("--tool-border").trim() || "#dbe3ec";
        const text = getComputedStyle(document.body).getPropertyValue("--tool-text").trim() || "#1e293b";
        const muted = getComputedStyle(document.body).getPropertyValue("--tool-text-muted").trim() || "#64748b";
        const accent = getComputedStyle(document.body).getPropertyValue("--tool-primary").trim() || "#087e8b";
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = surface;
        ctx.fillRect(0, 0, width, height);
        if (!valid) {
            ctx.fillStyle = muted;
            ctx.font = "14px system-ui, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("Geometric grid composition requires A and B to both be 2 × 2.", width / 2, height / 2);
            geometryMessage.textContent = "This product is still valid algebraically, but its input and output spaces cannot all be drawn on one 2D plane.";
            geometryCanvas.dataset.available = "false";
            return;
        }

        const apply = (M, point) => [M[0][0] * point[0] + M[0][1] * point[1], M[1][0] * point[0] + M[1][1] * point[1]];
        const stages = [
            { title: "1. Input", matrix: [[1, 0], [0, 1]], formula: "x", note: "unit square" },
            { title: "2. Apply B", matrix: B, formula: "Bx", note: "B acts first" },
            { title: "3. Apply A", matrix: C, formula: "A(Bx) = ABx", note: "the final product" }
        ];
        const panelGap = 18;
        const panelWidth = (width - 40 - panelGap * 2) / 3;
        const plotTop = 82;
        const plotHeight = height - 126;
        // Fit the meaningful geometry, not the far-away grid corners. The grid is
        // deliberately allowed to run beyond the panel and is clipped below.
        const shapePoints = [[0, 0], [1, 0], [0, 1], [1, 1]];
        const determinant = M => M[0][0] * M[1][1] - M[0][1] * M[1][0];
        const drawArrow = (from, to, color) => {
            const angle = Math.atan2(to[1] - from[1], to[0] - from[0]);
            ctx.save();
            ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 6;
            ctx.lineCap = "round"; ctx.lineJoin = "round";
            ctx.shadowColor = color; ctx.shadowBlur = 12;
            ctx.beginPath(); ctx.moveTo(...from); ctx.lineTo(...to); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(...to); ctx.lineTo(to[0] - 15 * Math.cos(angle - .48), to[1] - 15 * Math.sin(angle - .48)); ctx.lineTo(to[0] - 15 * Math.cos(angle + .48), to[1] - 15 * Math.sin(angle + .48)); ctx.closePath(); ctx.fill();
            ctx.restore();
        };
        stages.forEach((stage, index) => {
            const matrix = index === geometryStage && geometryTweenMatrix ? geometryTweenMatrix : stage.matrix;
            const left = 20 + index * (panelWidth + panelGap);
            const origin = [left + panelWidth / 2, plotTop + plotHeight / 2];
            // Auto-fit every stage independently. A large final product must not
            // shrink the input and intermediate vectors into unreadable dots.
            const stageExtent = Math.max(.72, ...shapePoints.flatMap(point =>
                apply(matrix, point).map(Math.abs)
            )) * 1.24;
            const scale = Math.min((panelWidth - 42) / (2 * stageExtent), (plotHeight - 24) / (2 * stageExtent));
            const mapRaw = p => [origin[0] + p[0] * scale, origin[1] - p[1] * scale];
            const map = p => mapRaw(apply(matrix, p));
            ctx.fillStyle = index === geometryStage ? "rgba(8,126,139,.12)" : "rgba(148,163,184,.025)";
            ctx.strokeStyle = index === geometryStage ? accent : border; ctx.lineWidth = index === geometryStage ? 2.5 : 1;
            ctx.beginPath(); ctx.roundRect(left, 8, panelWidth, height - 18, 10); ctx.fill(); ctx.stroke();
            ctx.fillStyle = text; ctx.font = "800 18px system-ui"; ctx.textAlign = "center"; ctx.fillText(stage.title, left + panelWidth / 2, 32);
            ctx.fillStyle = index === geometryStage ? accent : text; ctx.font = "800 14px system-ui"; ctx.fillText(stage.formula, left + panelWidth / 2, 55);
            ctx.fillStyle = muted; ctx.font = "12px system-ui"; ctx.fillText(`${stage.note} · auto-fit view`, left + panelWidth / 2, 73);
            ctx.save(); ctx.beginPath(); ctx.rect(left + 7, plotTop, panelWidth - 14, plotHeight); ctx.clip();
            for (let k = -6; k <= 6; k++) {
                let p1 = map([k, -6]), p2 = map([k, 6]); ctx.strokeStyle = k === 0 ? "rgba(255,77,103,.24)" : "rgba(148,163,184,.09)"; ctx.lineWidth = k === 0 ? 1.5 : .7; ctx.beginPath(); ctx.moveTo(...p1); ctx.lineTo(...p2); ctx.stroke();
                p1 = map([-6, k]); p2 = map([6, k]); ctx.strokeStyle = k === 0 ? "rgba(36,224,209,.24)" : "rgba(148,163,184,.09)"; ctx.lineWidth = k === 0 ? 1.5 : .7; ctx.beginPath(); ctx.moveTo(...p1); ctx.lineTo(...p2); ctx.stroke();
            }
            const vertices = [[0,0],[1,0],[1,1],[0,1]].map(map);
            ctx.save(); ctx.fillStyle = "rgba(255,213,74,.18)"; ctx.strokeStyle = "#ffd54a"; ctx.lineWidth = 5; ctx.lineJoin = "round"; ctx.shadowColor = "#ffd54a"; ctx.shadowBlur = 14; ctx.beginPath(); ctx.moveTo(...vertices[0]); vertices.slice(1).forEach(p => ctx.lineTo(...p)); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
            vertices.forEach(p => { ctx.save(); ctx.fillStyle = "#fff3a6"; ctx.shadowColor = "#ffd54a"; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc(p[0], p[1], 7, 0, Math.PI * 2); ctx.fill(); ctx.restore(); });
            drawArrow(origin, map([1,0]), "#ff4d67");
            drawArrow(origin, map([0,1]), "#24e0d1");
            ctx.restore();
            const det = determinant(matrix);
            const first = apply(matrix, [1, 0]);
            const second = apply(matrix, [0, 1]);
            const prefix = index === 0 ? "" : index === 1 ? "B" : "AB";
            ctx.font = "800 12px ui-monospace, monospace"; ctx.textAlign = "center";
            ctx.fillStyle = "#ff4d67"; ctx.fillText(`${prefix}e₁ = (${fmt(first[0])}, ${fmt(first[1])})`, left + panelWidth * .27, height - 50);
            ctx.fillStyle = "#24e0d1"; ctx.fillText(`${prefix}e₂ = (${fmt(second[0])}, ${fmt(second[1])})`, left + panelWidth * .73, height - 50);
            ctx.fillStyle = Math.abs(det) < 1e-8 ? "#ffd54a" : text; ctx.font = "800 12px system-ui";
            ctx.fillText(Math.abs(det) < 1e-8 ? "The square collapses to a line (area = 0)" : `Yellow area scales by |det| = ${fmt(Math.abs(det))}`, left + panelWidth / 2, height - 25);
            if (index < 2) { ctx.fillStyle = accent; ctx.font = "900 24px system-ui"; ctx.fillText("→", left + panelWidth + panelGap / 2, height / 2); }
        });
        geometryMessage.textContent = geometryStage === 0 ? "Start: the yellow unit square has area 1." : geometryStage === 1 ? "B acts first. The red and teal arrows are B's columns; they show where the original basis vectors land." : "A now acts on Bx. The last panel is the single transformation C = AB.";
        geometryCanvas.dataset.available = "true";
        geometryCanvas.dataset.product = JSON.stringify(C);
        geometryCanvas.dataset.stage = String(geometryStage);
    }

    function renderProductPlot(A, B, C, selectedRow = 0, selectedCol = 0) {
        lastProductPlot = { A, B, C, selectedRow, selectedCol };
        drawGeometricProduct(A, B, C);
    }

    function clearProductPlot() {
        lastProductPlot = null;
        drawGeometricProduct([], [], []);
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
        if (name === "geometric") geometryStage = 0;
        rowsASelect.value = String(preset.dims[0]);
        colsASelect.value = String(preset.dims[1]);
        rowsBSelect.value = String(preset.dims[2]);
        colsBSelect.value = String(preset.dims[3]);
        updateActiveCells();
        writeMatrix(matrixATable, preset.A);
        writeMatrix(matrixBTable, preset.B);
        processMatrices();
    }

    function setGeometryStage(stage) {
        geometryStage = stage;
        geometryTweenMatrix = null;
        document.querySelectorAll("[data-geometry-stage]").forEach(button =>
            button.classList.toggle("is-active", Number(button.dataset.geometryStage) === stage)
        );
        if (lastProductPlot) drawGeometricProduct(lastProductPlot.A, lastProductPlot.B, lastProductPlot.C);
    }

    function animateGeometry() {
        if (!lastProductPlot || lastProductPlot.A.length !== 2 || lastProductPlot.A[0].length !== 2 || lastProductPlot.B.length !== 2 || lastProductPlot.B[0].length !== 2) {
            setStatus("Choose the 2D geometry preset before animating.", "error");
            return;
        }
        cancelAnimationFrame(geometryAnimationFrame);
        const identity = [[1, 0], [0, 1]];
        const stages = [identity, lastProductPlot.B, lastProductPlot.C];
        let transition = 0;
        let started = performance.now();
        const duration = 900;
        const frame = now => {
            const raw = Math.max(0, Math.min(1, (now - started) / duration));
            const t = raw * raw * (3 - 2 * raw);
            geometryStage = transition + 1;
            geometryTweenMatrix = stages[transition].map((row, r) => row.map((value, c) => value + (stages[transition + 1][r][c] - value) * t));
            document.querySelectorAll("[data-geometry-stage]").forEach(button => button.classList.toggle("is-active", Number(button.dataset.geometryStage) === geometryStage));
            drawGeometricProduct(lastProductPlot.A, lastProductPlot.B, lastProductPlot.C);
            if (raw < 1) geometryAnimationFrame = requestAnimationFrame(frame);
            else if (transition === 0) { transition = 1; started = now + 180; geometryAnimationFrame = requestAnimationFrame(frame); }
            else { geometryTweenMatrix = null; setGeometryStage(2); }
        };
        geometryAnimationFrame = requestAnimationFrame(frame);
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
    document.querySelectorAll("[data-geometry-stage]").forEach(button =>
        button.addEventListener("click", () => setGeometryStage(Number(button.dataset.geometryStage)))
    );
    document.getElementById("play-geometry").addEventListener("click", animateGeometry);

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
