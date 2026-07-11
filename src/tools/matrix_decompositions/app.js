(function() {
    "use strict";

    const modeButtons = Array.from(document.querySelectorAll(".mode-tab"));
    const matrixEditor = document.getElementById("matrix-editor");
    const datasetEditor = document.getElementById("dataset-editor");
    const datasetInput = document.getElementById("dataset-input");
    const inputDescription = document.getElementById("input-description");
    const visualDescription = document.getElementById("visual-description");
    const resultSummary = document.getElementById("result-summary");
    const resultGrid = document.getElementById("result-grid");
    const legendRow = document.getElementById("legend-row");
    const statusMessage = document.getElementById("status-message");
    const decompositionInsight = document.getElementById("decomposition-insight");
    const decompositionMetrics = document.getElementById("decomposition-metrics");
    const canvas = document.getElementById("decomposition-canvas");
    const ctx = canvas.getContext("2d");

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
        return { values, vectors };
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
            return { real: false, values: [], vectors: [] };
        }
        const root = Math.sqrt(Math.max(discriminant, 0));
        const values = discriminant < 1e-12 ? [trace / 2] : [(trace + root) / 2, (trace - root) / 2];
        const vectors = values.map(lambda => {
            const row1 = [a - lambda, b];
            const row2 = [c, d - lambda];
            const row = norm(row1) > norm(row2) ? row1 : row2;
            return normalize(Math.abs(row[0]) + Math.abs(row[1]) < 1e-12 ? [1, 0] : [-row[1], row[0]]);
        });
        return { real: true, values, vectors };
    }

    function svd2x2(A) {
        const ata = matMul(transpose(A), A);
        const eig = symmetricEigen2x2(ata);
        const order = eig.values.map((value, index) => ({ value, index })).sort((a, b) => b.value - a.value);
        const singularValues = order.map(item => Math.sqrt(Math.max(item.value, 0)));
        const V = order.map(item => eig.vectors[item.index]);
        const U = V.map((v, index) => {
            if (singularValues[index] < 1e-10) return index === 0 ? [1, 0] : perpendicular(V[0]);
            return normalize(matVec(A, v).map(value => value / singularValues[index]));
        });
        if (Math.abs(dot(U[0], U[1])) > 1e-6) U[1] = perpendicular(U[0]);
        return { singularValues, U, V, ata };
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
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.max(320, Math.floor(rect.width * dpr));
        canvas.height = Math.floor((rect.width * 0.625) * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, rect.width, rect.width * 0.625);
        return { width: rect.width, height: rect.width * 0.625 };
    }

    function drawGrid(width, height, scale) {
        const cx = width / 2;
        const cy = height / 2;
        ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--tool-border") || "#d1d5db";
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
        const { width, height } = clearCanvas();
        const scale = Math.min(width, height) / 8;
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
        drawVector(result.V[0], "#16a34a", width, height, scale, "v1");
        drawVector(result.U[0].map(value => value * result.singularValues[0]), "#ea8400", width, height, scale, "σ₁u₁");
        setLegend([["#2563eb", "unit circle"], ["#e11d48", "A applied"], ["#16a34a", "input direction"], ["#ea8400", "output axis"]]);
    }

    function drawPca(result) {
        const { width, height } = clearCanvas();
        const xs = result.points.map(point => point[0]);
        const ys = result.points.map(point => point[1]);
        const maxRange = Math.max(
            Math.max(...xs) - Math.min(...xs),
            Math.max(...ys) - Math.min(...ys),
            1
        );
        const scale = Math.min(width, height) / (maxRange * 1.8);
        drawGrid(width, height, scale);
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
        setLegend([["#2563eb", "centered data"], ["#e11d48", "PC1"], ["#16a34a", "PC2"]]);
    }

    function drawEvd(A, result) {
        const { width, height } = clearCanvas();
        const scale = Math.min(width, height) / 8;
        drawGrid(width, height, scale);
        const square = [[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]];
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
        if (result.real) {
            result.vectors.forEach((vector, index) => {
                drawVector(vector.map(value => value * result.values[index]), index === 0 ? "#ea8400" : "#16a34a", width, height, scale, `λ${index === 0 ? "₁" : "₂"}v${index === 0 ? "₁" : "₂"}`);
            });
        }
        setLegend([["#2563eb", "unit square"], ["#e11d48", "A applied"], ["#ea8400", "eigen direction 1"], ["#16a34a", "eigen direction 2"]]);
    }

    function runSvd() {
        const A = readMatrix();
        const result = svd2x2(A);
        drawSvd(A, result);
        renderResults([
            metricsCard("Singular Values", [["\\(\\sigma_1\\)", fmt(result.singularValues[0])], ["\\(\\sigma_2\\)", fmt(result.singularValues[1])]]),
            card("U", matrixFmt(transpose(result.U)), true),
            card("V", matrixFmt(transpose(result.V)), true)
        ], "SVD decomposes A into input directions, stretches, and output directions.");
        const ratio = result.singularValues[1] < 1e-9 ? Infinity : result.singularValues[0] / result.singularValues[1];
        setTeaching(Number.isFinite(ratio) ? `The first singular direction is stretched ${fmt(ratio)} times as strongly as the second.` : "The second singular value is zero, so the transformation collapses the plane onto a line.", ["Mode: SVD", `Primary strength: ${fmt(result.singularValues[0])}`, `Secondary strength: ${fmt(result.singularValues[1])}`, `Condition ratio: ${Number.isFinite(ratio) ? fmt(ratio) : "infinite"}`]);
        setStatus("SVD complete.", "success");
    }

    function runPca() {
        const result = pca2d(parseDataset());
        drawPca(result);
        renderResults([
            metricsCard("Explained Variance", [["\\(\\mathrm{PC}_1\\)", `${fmt(result.explained[0] * 100)}%`], ["\\(\\mathrm{PC}_2\\)", `${fmt(result.explained[1] * 100)}%`]]),
            card("Mean", vectorFmt(result.mean)),
            card("Covariance", matrixFmt(result.covariance), true)
        ], "PCA found the principal axes of the centered dataset.");
        setTeaching(`PC1 explains ${fmt(result.explained[0] * 100)}% of the observed variance. The closer this is to 100%, the more nearly the data follows one line.`, ["Mode: PCA", `PC1 variance: ${fmt(result.explained[0] * 100)}%`, `PC2 variance: ${fmt(result.explained[1] * 100)}%`, `Samples: ${result.points.length}`]);
        setStatus("PCA complete.", "success");
    }

    function runEvd() {
        const A = readMatrix();
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
            metricsCard("Eigenvalues", result.values.map((value, index) => [`\\(\\lambda_${index + 1}\\)`, fmt(value)])),
            card("Eigenvectors", result.vectors.map((vector, index) => `v${index + 1} = ${vectorFmt(vector)}`).join("\n"), true),
            card("Matrix", matrixFmt(A), true)
        ], "EVD found real invariant directions for the transform.");
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
        inputDescription.textContent = mode === "pca" ?
            "Enter x,y points. PCA analyzes the covariance of centered data." :
            "Enter a 2x2 matrix for the selected decomposition.";
        visualDescription.textContent = {
            svd: "SVD maps the unit circle to an ellipse. Principal directions become ellipse axes.",
            pca: "PCA centers the data, then draws principal axes from the covariance matrix.",
            evd: "EVD shows eigenvectors as directions that remain on the same line after transformation."
        }[mode];
        const formula = document.getElementById("decomposition-formula");
        formula.textContent = { svd: "\\(A=U\\Sigma V^{\\mathsf T}\\)", pca: "\\(C=\\frac{1}{n-1}X^{\\mathsf T}X\\)", evd: "\\(A=V\\Lambda V^{-1}\\)" }[mode];
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

    matrixInputs.flat().forEach(input => input.addEventListener("input", () => setStatus("Matrix edited. Run analysis to refresh.")));
    datasetInput.addEventListener("input", () => setStatus("Dataset edited. Run analysis to refresh."));
    window.addEventListener("resize", () => runAnalysis());

    setMode("svd");
})();
