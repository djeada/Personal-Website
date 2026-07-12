(function() {
    "use strict";

    const modeButtons = Array.from(document.querySelectorAll(".mode-tab"));
    const matrixEditor = document.getElementById("matrix-editor");
    const datasetEditor = document.getElementById("dataset-editor");
    const datasetInput = document.getElementById("dataset-input");
    const inputDescription = document.getElementById("input-description");
    const inputHeading = document.getElementById("input-heading");
    const visualHeading = document.getElementById("visual-heading");
    const matrixPresets = document.getElementById("matrix-presets");
    const dataPresets = document.getElementById("data-presets");
    const visualDescription = document.getElementById("visual-description");
    const resultSummary = document.getElementById("result-summary");
    const resultGrid = document.getElementById("result-grid");
    const legendRow = document.getElementById("legend-row");
    const statusMessage = document.getElementById("status-message");
    const decompositionInsight = document.getElementById("decomposition-insight");
    const decompositionMetrics = document.getElementById("decomposition-metrics");
    const canvas = document.getElementById("decomposition-canvas");
    const canvasContainer = document.getElementById("canvas-container");
    const ctx = canvas.getContext("2d");
    const storyInput = document.getElementById("story-input");
    const storyAction = document.getElementById("story-action");
    const storyOutput = document.getElementById("story-output");
    const plotNote = document.getElementById("plot-note");

    const matrixInputs = [
        [document.getElementById("m00"), document.getElementById("m01")],
        [document.getElementById("m10"), document.getElementById("m11")]
    ];

    const presets = {
        stretch: {
            mode: "svd",
            matrix: [
                [2, 1],
                [1, 3]
            ]
        },
        shear: {
            mode: "svd",
            matrix: [
                [1, 1.4],
                [0.2, 1]
            ]
        },
        rotation: {
            mode: "evd",
            matrix: [
                [0, -1],
                [1, 0]
            ]
        },
        cloud: {
            mode: "pca",
            dataset: `-2, -1
-1, -0.4
0, 0.2
1, 0.8
2, 1.2
3, 2.3
4, 2.8`
        }
    };

    let currentMode = "svd";
    let updateTimer = 0;

    function n(value) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }

    function fmt(value) {
        if (!Number.isFinite(value)) return "NaN";
        if (Math.abs(value) < 1e-10) return "0";
        return Number(value.toFixed(5)).toString();
    }

    function vectorFmt(v) {
        return `[${v.map(fmt).join(", ")}]`;
    }

    function matrixFmt(A) {
        return A.map(row => `[${row.map(fmt).join(", ")}]`).join("\n");
    }

    function setStatus(message, type = "info") {
        statusMessage.textContent = message;
        statusMessage.classList.toggle("is-error", type === "error");
        statusMessage.classList.toggle("is-success", type === "success");
    }

    function setTeaching(message, metrics) {
        decompositionInsight.textContent = message;
        Array.from(decompositionMetrics.children).forEach((node, index) => node.textContent = metrics[index] || "—");
    }

    function readMatrix() {
        const matrix = matrixInputs.map(row => row.map(input => n(input.value.trim())));
        if (matrix.flat().some(value => value === null)) {
            throw new Error("Enter numeric values in all four matrix cells.");
        }
        return matrix;
    }

    function writeMatrix(A) {
        A.forEach((row, i) => row.forEach((value, j) => {
            matrixInputs[i][j].value = String(value);
        }));
    }

    function parseDataset() {
        const points = datasetInput.value
            .split(/\n+/)
            .map(line => line.trim())
            .filter(Boolean)
            .map(line => line.split(/[,\s]+/).map(Number));
        if (points.length < 2 || points.some(point => point.length !== 2 || point.some(value => !Number.isFinite(value)))) {
            throw new Error("Enter at least two valid x,y points.");
        }
        return points;
    }

    function transpose(A) {
        return A[0].map((_, column) => A.map(row => row[column]));
    }

    function matMul(A, B) {
        return A.map(row => B[0].map((_, column) =>
            row.reduce((sum, value, index) => sum + value * B[index][column], 0)
        ));
    }

    function matVec(A, v) {
        return A.map(row => row.reduce((sum, value, index) => sum + value * v[index], 0));
    }

    function dot(a, b) {
        return a.reduce((sum, value, index) => sum + value * b[index], 0);
    }

    function norm(v) {
        return Math.hypot(...v);
    }

    function normalize(v) {
        const length = norm(v);
        return length < 1e-12 ? [0, 0] : v.map(value => value / length);
    }

    function perpendicular(v) {
        return [-v[1], v[0]];
    }

    function symmetricEigen2x2(A) {
        const a = A[0][0];
        const b = (A[0][1] + A[1][0]) / 2;
        const d = A[1][1];
        const trace = a + d;
        const delta = Math.sqrt((a - d) * (a - d) + 4 * b * b);
        const values = [(trace + delta) / 2, (trace - delta) / 2];
        const vectors = values.map(value => {
            if (Math.abs(b) > 1e-12) return normalize([b, value - a]);
            return value >= d ? [1, 0] : [0, 1];
        });
        return {
            values,
            vectors
        };
    }

    function eigen2x2(A) {
        const a = A[0][0];
        const b = A[0][1];
        const c = A[1][0];
        const d = A[1][1];
        const trace = a + d;
        const determinant = a * d - b * c;
        const discriminant = trace * trace - 4 * determinant;
        if (discriminant < -1e-12) {
            return {
                real: false,
                values: [],
                vectors: []
            };
        }
        const root = Math.sqrt(Math.max(discriminant, 0));
        const values = discriminant < 1e-12 ? [trace / 2] : [(trace + root) / 2, (trace - root) / 2];
        const vectors = values.map(lambda => {
            const row1 = [a - lambda, b];
            const row2 = [c, d - lambda];
            const row = norm(row1) > norm(row2) ? row1 : row2;
            return normalize(Math.abs(row[0]) + Math.abs(row[1]) < 1e-12 ? [1, 0] : [-row[1], row[0]]);
        });
        return {
            real: true,
            values,
            vectors
        };
    }

    function svd2x2(A) {
        const ata = matMul(transpose(A), A);
        const eig = symmetricEigen2x2(ata);
        const order = eig.values.map((value, index) => ({
            value,
            index
        })).sort((a, b) => b.value - a.value);
        const singularValues = order.map(item => Math.sqrt(Math.max(item.value, 0)));
        const V = order.map(item => eig.vectors[item.index]);
        const U = V.map((v, index) => {
            if (singularValues[index] < 1e-10) return index === 0 ? [1, 0] : perpendicular(V[0]);
            return normalize(matVec(A, v).map(value => value / singularValues[index]));
        });
        if (Math.abs(dot(U[0], U[1])) > 1e-6) U[1] = perpendicular(U[0]);
        return {
            singularValues,
            U,
            V,
            ata
        };
    }

    function pca2d(points) {
        const mean = [
            points.reduce((sum, point) => sum + point[0], 0) / points.length,
            points.reduce((sum, point) => sum + point[1], 0) / points.length
        ];
        const centered = points.map(point => [point[0] - mean[0], point[1] - mean[1]]);
        const denom = Math.max(points.length - 1, 1);
        const covariance = [
            [centered.reduce((sum, point) => sum + point[0] * point[0], 0) / denom, centered.reduce((sum, point) => sum + point[0] * point[1], 0) / denom],
            [centered.reduce((sum, point) => sum + point[1] * point[0], 0) / denom, centered.reduce((sum, point) => sum + point[1] * point[1], 0) / denom]
        ];
        const eig = symmetricEigen2x2(covariance);
        const total = eig.values[0] + eig.values[1] || 1;
        return {
            mean,
            covariance,
            values: eig.values,
            vectors: eig.vectors,
            explained: eig.values.map(value => value / total),
            points
        };
    }

    function card(title, content, pre = false) {
        const node = document.createElement("article");
        node.className = "result-card";
        const body = pre ? `<pre>${content}</pre>` : `<p>${content}</p>`;
        node.innerHTML = `<h3>${title}</h3>${body}`;
        return node;
    }

    function metricsCard(title, rows) {
        const node = document.createElement("article");
        node.className = "result-card";
        node.innerHTML = `<h3>${title}</h3><div class="metric-list"></div>`;
        const list = node.querySelector(".metric-list");
        rows.forEach(([label, value]) => {
            const row = document.createElement("div");
            row.innerHTML = `<span></span><strong></strong>`;
            row.querySelector("span").textContent = label;
            row.querySelector("strong").textContent = value;
            list.appendChild(row);
        });
        return node;
    }

    function renderResults(nodes, summary) {
        resultGrid.innerHTML = "";
        nodes.forEach(node => resultGrid.appendChild(node));
        resultSummary.textContent = summary;
        if (window.MathJax && window.MathJax.typesetPromise) window.MathJax.typesetPromise([resultGrid]);
    }

    function setLegend(items) {
        legendRow.innerHTML = "";
        items.forEach(([color, label]) => {
            const item = document.createElement("span");
            item.className = "legend-item";
            item.innerHTML = `<span class="legend-swatch" style="background:${color}"></span><span></span>`;
            item.querySelector("span:last-child").textContent = label;
            legendRow.appendChild(item);
        });
    }

    function clearCanvas() {
        const width = Math.max(280, canvasContainer.clientWidth);
        const height = Math.max(340, Math.min(620, Math.round(width * 0.68)));
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        canvasContainer.style.height = `${height}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, width, height);
        return {
            width,
            height
        };
    }

    function scheduleAnalysis() {
        window.clearTimeout(updateTimer);
        setStatus("Updating…");
        updateTimer = window.setTimeout(runAnalysis, 180);
    }

    function drawGrid(width, height, scale, axisNames = ["x", "y"]) {
        const cx = width / 2;
        const cy = height / 2;
        const styles = getComputedStyle(document.documentElement);
        const gridColor = styles.getPropertyValue("--tool-border").trim() || "#d1d5db";
        const textColor = styles.getPropertyValue("--tool-text-muted").trim() || "#64748b";
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1;
        for (let x = cx % scale; x < width; x += scale) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        for (let y = cy % scale; y < height; y += scale) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
        ctx.strokeStyle = "#64748b";
        ctx.beginPath();
        ctx.moveTo(0, cy);
        ctx.lineTo(width, cy);
        ctx.moveTo(cx, 0);
        ctx.lineTo(cx, height);
        ctx.stroke();

        const labelStep = scale >= 42 ? 1 : scale >= 22 ? 2 : 5;
        const maxX = Math.floor(width / (2 * scale));
        const maxY = Math.floor(height / (2 * scale));
        ctx.fillStyle = textColor;
        ctx.font = "12px ui-monospace, SFMono-Regular, Menlo, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        for (let value = -maxX; value <= maxX; value += labelStep) {
            if (value === 0) continue;
            const x = cx + value * scale;
            ctx.beginPath();
            ctx.moveTo(x, cy - 4);
            ctx.lineTo(x, cy + 4);
            ctx.stroke();
            ctx.fillText(String(value), x, cy + 7);
        }
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        for (let value = -maxY; value <= maxY; value += labelStep) {
            if (value === 0) continue;
            const y = cy - value * scale;
            ctx.beginPath();
            ctx.moveTo(cx - 4, y);
            ctx.lineTo(cx + 4, y);
            ctx.stroke();
            ctx.fillText(String(value), cx - 8, y);
        }
        ctx.font = "700 14px sans-serif";
        ctx.textAlign = "right";
        ctx.textBaseline = "bottom";
        ctx.fillText(axisNames[0], width - 10, cy - 8);
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText(axisNames[1], cx + 9, 9);
        ctx.textAlign = "left";
        ctx.fillText("0", cx + 7, cy + 7);
    }

    function toCanvas(point, width, height, scale) {
        return [width / 2 + point[0] * scale, height / 2 - point[1] * scale];
    }

    function drawVector(vector, color, width, height, scale, label = "") {
        const [x, y] = toCanvas(vector, width, height, scale);
        const [cx, cy] = toCanvas([0, 0], width, height, scale);
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(x, y);
        ctx.stroke();
        const angle = Math.atan2(y - cy, x - cx);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 10 * Math.cos(angle - Math.PI / 6), y - 10 * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(x - 10 * Math.cos(angle + Math.PI / 6), y - 10 * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fill();
        if (label) {
            ctx.font = "13px sans-serif";
            ctx.fillText(label, x + 8, y - 8);
        }
    }

    function drawSvd(A, result) {
        const {
            width,
            height
        } = clearCanvas();
        const extent = Math.max(1.25, result.singularValues[0] * 1.18);
        const scale = Math.min(width, height) / (extent * 2);
        drawGrid(width, height, scale);
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#2563eb";
        ctx.beginPath();
        for (let i = 0; i <= 180; i++) {
            const t = (i / 180) * Math.PI * 2;
            const point = [Math.cos(t), Math.sin(t)];
            const [x, y] = toCanvas(point, width, height, scale);
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();

        ctx.strokeStyle = "#e11d48";
        ctx.beginPath();
        for (let i = 0; i <= 180; i++) {
            const t = (i / 180) * Math.PI * 2;
            const point = matVec(A, [Math.cos(t), Math.sin(t)]);
            const [x, y] = toCanvas(point, width, height, scale);
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
        drawVector(matVec(A, [1, 0]), "#7c3aed", width, height, scale, "Ae₁");
        drawVector(matVec(A, [0, 1]), "#0891b2", width, height, scale, "Ae₂");
        drawVector(result.V[0], "#16a34a", width, height, scale, "v1");
        drawVector(result.U[0].map(value => value * result.singularValues[0]), "#ea8400", width, height, scale, "σ₁u₁");
        setLegend([
            ["#2563eb", "unit circle"],
            ["#e11d48", "A applied"],
            ["#7c3aed", "A e₁ (column 1)"],
            ["#0891b2", "A e₂ (column 2)"],
            ["#16a34a", "input direction"],
            ["#ea8400", "output axis"]
        ]);
    }

    function drawPca(result) {
        const {
            width,
            height
        } = clearCanvas();
        const centeredExtent = Math.max(...result.points.flatMap(point => [
            Math.abs(point[0] - result.mean[0]),
            Math.abs(point[1] - result.mean[1])
        ]), Math.sqrt(Math.max(result.values[0], 0)) * 2, 1);
        const scale = Math.min(width, height) / (centeredExtent * 2.35);
        drawGrid(width, height, scale, ["centered x", "centered y"]);
        ctx.fillStyle = "#2563eb";
        result.points.forEach(point => {
            const centered = [point[0] - result.mean[0], point[1] - result.mean[1]];
            const [x, y] = toCanvas(centered, width, height, scale);
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fill();
        });
        drawVector(result.vectors[0].map(value => value * Math.sqrt(result.values[0]) * 2), "#e11d48", width, height, scale, "PC1");
        drawVector(result.vectors[1].map(value => value * Math.sqrt(result.values[1]) * 2), "#16a34a", width, height, scale, "PC2");
        setLegend([
            ["#2563eb", "centered data"],
            ["#e11d48", "PC1"],
            ["#16a34a", "PC2"]
        ]);
    }

    function drawEvd(A, result) {
        const {
            width,
            height
        } = clearCanvas();
        const transformedCorners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(point => matVec(A, point));
        const extent = Math.max(1.4, ...transformedCorners.flat().map(Math.abs), ...result.values.map(Math.abs));
        const scale = Math.min(width, height) / (extent * 2.35);
        drawGrid(width, height, scale);
        const square = [
            [-1, -1],
            [1, -1],
            [1, 1],
            [-1, 1],
            [-1, -1]
        ];
        ctx.strokeStyle = "#2563eb";
        ctx.lineWidth = 2;
        ctx.beginPath();
        square.forEach((point, index) => {
            const [x, y] = toCanvas(point, width, height, scale);
            index === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.stroke();
        ctx.strokeStyle = "#e11d48";
        ctx.beginPath();
        square.map(point => matVec(A, point)).forEach((point, index) => {
            const [x, y] = toCanvas(point, width, height, scale);
            index === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.stroke();
        drawVector(matVec(A, [1, 0]), "#7c3aed", width, height, scale, "Ae₁");
        drawVector(matVec(A, [0, 1]), "#0891b2", width, height, scale, "Ae₂");
        if (result.real) {
            result.vectors.forEach((vector, index) => {
                drawVector(vector.map(value => value * result.values[index]), index === 0 ? "#ea8400" : "#16a34a", width, height, scale, `λ${index === 0 ? "₁" : "₂"}v${index === 0 ? "₁" : "₂"}`);
            });
        }
        setLegend([
            ["#2563eb", "unit square"],
            ["#e11d48", "A applied"],
            ["#7c3aed", "A e₁ (column 1)"],
            ["#0891b2", "A e₂ (column 2)"],
            ["#ea8400", "eigen direction 1"],
            ["#16a34a", "eigen direction 2"]
        ]);
    }

    function runSvd() {
        const A = readMatrix();
        plotNote.textContent = `A maps e₁=(1, 0) to (${fmt(A[0][0])}, ${fmt(A[1][0])}) — the purple arrow — and e₂=(0, 1) to (${fmt(A[0][1])}, ${fmt(A[1][1])}) — the cyan arrow.`;
        const result = svd2x2(A);
        drawSvd(A, result);
        renderResults([
            metricsCard("How much A stretches", [
                ["\\(\\sigma_1\\)", fmt(result.singularValues[0])],
                ["\\(\\sigma_2\\)", fmt(result.singularValues[1])]
            ]),
            card("Output directions (U)", matrixFmt(transpose(result.U)), true),
            card("Input directions (V)", matrixFmt(transpose(result.V)), true)
        ], "The two singular values are the stretch along the orange and green directions.");
        const ratio = result.singularValues[1] < 1e-9 ? Infinity : result.singularValues[0] / result.singularValues[1];
        setTeaching(Number.isFinite(ratio) ? `The first singular direction is stretched ${fmt(ratio)} times as strongly as the second.` : "The second singular value is zero, so the transformation collapses the plane onto a line.", ["Mode: SVD", `Primary strength: ${fmt(result.singularValues[0])}`, `Secondary strength: ${fmt(result.singularValues[1])}`, `Condition ratio: ${Number.isFinite(ratio) ? fmt(ratio) : "infinite"}`]);
        setStatus("SVD complete.", "success");
    }

    function runPca() {
        const result = pca2d(parseDataset());
        plotNote.textContent = `The axes show distance from the dataset mean (${fmt(result.mean[0])}, ${fmt(result.mean[1])}). A centered value of 0 is the mean.`;
        drawPca(result);
        renderResults([
            metricsCard("Variance along each axis", [
                ["\\(\\mathrm{PC}_1\\)", `${fmt(result.explained[0] * 100)}%`],
                ["\\(\\mathrm{PC}_2\\)", `${fmt(result.explained[1] * 100)}%`]
            ]),
            card("Dataset center (mean)", vectorFmt(result.mean)),
            card("Covariance matrix", matrixFmt(result.covariance), true)
        ], "PC1 is the direction in which your points spread out the most.");
        setTeaching(`PC1 explains ${fmt(result.explained[0] * 100)}% of the observed variance. The closer this is to 100%, the more nearly the data follows one line.`, ["Mode: PCA", `PC1 variance: ${fmt(result.explained[0] * 100)}%`, `PC2 variance: ${fmt(result.explained[1] * 100)}%`, `Samples: ${result.points.length}`]);
        setStatus("PCA complete.", "success");
    }

    function runEvd() {
        const A = readMatrix();
        plotNote.textContent = `A maps e₁=(1, 0) to (${fmt(A[0][0])}, ${fmt(A[1][0])}) — the purple arrow — and e₂=(0, 1) to (${fmt(A[0][1])}, ${fmt(A[1][1])}) — the cyan arrow.`;
        const result = eigen2x2(A);
        drawEvd(A, result);
        if (!result.real) {
            renderResults([
                card("Real EVD unavailable", "This 2x2 matrix has complex eigenvalues, so no real eigenvector basis exists.")
            ], "No real eigendecomposition for this matrix.");
            setStatus("Complex eigenvalues detected.", "error");
            setTeaching("This transform rotates invariant directions out of the real plane, so a real eigenvector basis does not exist.", ["Mode: EVD", "Real eigenvalues: none", "Eigenvectors: complex", "Interpretation: rotation-like"]);
            return;
        }
        renderResults([
            metricsCard("Scale on each fixed direction", result.values.map((value, index) => [`\\(\\lambda_${index + 1}\\)`, fmt(value)])),
            card("Directions that stay on their line", result.vectors.map((vector, index) => `v${index + 1} = ${vectorFmt(vector)}`).join("\n"), true),
            card("Your matrix A", matrixFmt(A), true)
        ], "These are the directions that matrix A scales without turning away from their line.");
        setTeaching("Each eigenvector stays on its original line after the transformation. Its eigenvalue gives the signed scale along that line.", ["Mode: EVD", `Eigenvalue 1: ${fmt(result.values[0])}`, `Eigenvalue 2: ${fmt(result.values[1])}`, `Real directions: ${result.vectors.length}`]);
        setStatus("EVD complete.", "success");
    }

    function runAnalysis() {
        try {
            if (currentMode === "svd") runSvd();
            if (currentMode === "pca") runPca();
            if (currentMode === "evd") runEvd();
        } catch (error) {
            setStatus(error.message, "error");
            renderResults([card("Input error", error.message)], "Fix the input and run analysis again.");
        }
    }

    function setMode(mode) {
        currentMode = mode;
        modeButtons.forEach(button => {
            const active = button.dataset.mode === mode;
            button.classList.toggle("active", active);
            button.setAttribute("aria-pressed", String(active));
        });
        matrixEditor.classList.toggle("is-hidden", mode === "pca");
        datasetEditor.classList.toggle("is-hidden", mode !== "pca");
        matrixPresets.classList.toggle("is-hidden", mode === "pca");
        dataPresets.classList.toggle("is-hidden", mode !== "pca");
        inputHeading.textContent = mode === "pca" ? "Your dataset points" : "Your transformation matrix A";
        inputDescription.textContent = mode === "pca" ?
            "Each line is one point: x, y. PCA finds the directions in which these points spread out." :
            "This matrix moves, rotates, stretches, or flips every point in the plane.";
        visualHeading.textContent = mode === "pca" ? "Your points and their main directions" : "Before and after applying matrix A";
        visualDescription.textContent = {
            svd: "Blue is the original unit circle. Red is the same circle after your matrix transforms it.",
            pca: "Blue dots are your data, moved so their mean is at the center. Red PC1 shows the strongest spread.",
            evd: "Blue is the original square. Red is that square after applying your matrix. The arrows are directions that stay on the same line."
        } [mode];
        const story = {
            svd: ["Unit circle", "Your matrix A", "Ellipse + stretch axes"],
            pca: ["Your dataset points", "Center + measure spread", "Principal directions"],
            evd: ["Unit square", "Your matrix A", "Transformed square"]
        }[mode];
        [storyInput.textContent, storyAction.textContent, storyOutput.textContent] = story;
        const formula = document.getElementById("decomposition-formula");
        formula.textContent = {
            svd: "\\(A=U\\Sigma V^{\\mathsf T}\\)",
            pca: "\\(C=\\frac{1}{n-1}X^{\\mathsf T}X\\)",
            evd: "\\(A=V\\Lambda V^{-1}\\)"
        } [mode];
        if (window.MathJax && window.MathJax.typesetPromise) window.MathJax.typesetPromise([formula]);
        setStatus(`${mode.toUpperCase()} mode active.`);
        runAnalysis();
    }

    document.getElementById("run-analysis").addEventListener("click", runAnalysis);
    document.getElementById("reset-input").addEventListener("click", () => {
        const preset = currentMode === "pca" ? presets.cloud : presets.stretch;
        if (preset.matrix) writeMatrix(preset.matrix);
        if (preset.dataset) datasetInput.value = preset.dataset;
        runAnalysis();
    });

    modeButtons.forEach(button => {
        button.addEventListener("click", () => setMode(button.dataset.mode));
    });

    document.querySelectorAll("[data-preset]").forEach(button => {
        button.addEventListener("click", () => {
            const preset = presets[button.dataset.preset];
            if (preset.matrix) writeMatrix(preset.matrix);
            if (preset.dataset) datasetInput.value = preset.dataset;
            setMode(preset.mode);
        });
    });

    matrixInputs.flat().forEach(input => input.addEventListener("input", scheduleAnalysis));
    datasetInput.addEventListener("input", scheduleAnalysis);
    matrixInputs.flat().forEach(input => input.addEventListener("keydown", event => {
        if (event.key === "Enter") runAnalysis();
    }));

    let resizeFrame = 0;
    const resizeVisualization = () => {
        cancelAnimationFrame(resizeFrame);
        resizeFrame = requestAnimationFrame(runAnalysis);
    };
    if ("ResizeObserver" in window) {
        new ResizeObserver(resizeVisualization).observe(canvasContainer);
    } else {
        window.addEventListener("resize", resizeVisualization);
    }

    setMode("svd");
})();
