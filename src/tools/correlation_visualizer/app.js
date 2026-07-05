const DATASETS = {
    "positive-linear": {
        points: [
            [12, 18], [16, 21], [20, 26], [24, 31], [28, 33], [32, 37],
            [36, 42], [40, 44], [44, 49], [48, 53], [52, 55], [56, 62],
            [60, 65], [64, 68], [68, 73], [72, 75]
        ],
        note: "Positive covariance: x and y tend to move above or below their means together."
    },
    "negative-linear": {
        points: [
            [12, 78], [16, 75], [20, 70], [24, 68], [28, 63], [32, 59],
            [36, 55], [40, 52], [44, 48], [48, 45], [52, 39], [56, 36],
            [60, 32], [64, 28], [68, 24], [72, 20]
        ],
        note: "Negative covariance: large x values tend to pair with small y values."
    },
    "near-zero": {
        points: [
            [12, 41], [16, 58], [20, 48], [24, 61], [28, 37], [32, 55],
            [36, 45], [40, 64], [44, 40], [48, 53], [52, 47], [56, 60],
            [60, 38], [64, 56], [68, 44], [72, 51]
        ],
        note: "Near-zero correlation: the cloud has no strong linear direction."
    },
    "curved": {
        points: [
            [-8, 72], [-7, 63], [-6, 55], [-5, 47], [-4, 40], [-3, 35],
            [-2, 31], [-1, 29], [0, 28], [1, 29], [2, 32], [3, 36],
            [4, 42], [5, 49], [6, 56], [7, 65], [8, 75]
        ],
        note: "Pearson correlation can be small even when a clear nonlinear relationship exists."
    },
    "outlier-leverage": {
        points: [
            [24, 32], [27, 35], [30, 34], [33, 37], [36, 36], [39, 38],
            [42, 40], [45, 41], [48, 39], [51, 42], [54, 43], [57, 41],
            [60, 44], [63, 43], [66, 45], [118, 92]
        ],
        note: "A high-leverage point can pull the regression line and Pearson r."
    },
    "clusters": {
        points: [
            [18, 28], [20, 32], [22, 31], [24, 34], [26, 29], [28, 33],
            [52, 58], [54, 61], [56, 57], [58, 63], [60, 60], [62, 64],
            [78, 38], [80, 42], [82, 39], [84, 44], [86, 41], [88, 45]
        ],
        note: "Clusters can create a misleading overall correlation when groups differ."
    }
};

const DEFAULT_POINTS = DATASETS["positive-linear"].points;

const COLORS = {
    point: "#2563eb",
    pointFill: "rgba(37, 99, 235, 0.78)",
    regression: "#e11d48",
    mean: "#f59e0b",
    positive: "rgba(37, 99, 235, 0.10)",
    negative: "rgba(225, 29, 72, 0.09)",
    residual: "rgba(225, 29, 72, 0.72)",
    ellipse: "#10b981"
};

const CHART = {
    left: 76,
    right: 34,
    top: 42,
    plotHeight: 390,
    residualTop: 500,
    residualHeight: 120,
    bottom: 42,
    narrow: false
};

let activeMessage = "";

function mean(values) {
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sampleVariance(values, avg) {
    if (values.length < 2) return 0;
    return values.reduce((sum, value) => sum + Math.pow(value - avg, 2), 0) / (values.length - 1);
}

function sampleStd(values, avg) {
    return Math.sqrt(sampleVariance(values, avg));
}

function sampleCovariance(xs, ys, meanX, meanY) {
    if (xs.length < 2) return 0;
    let total = 0;
    for (let i = 0; i < xs.length; i++) {
        total += (xs[i] - meanX) * (ys[i] - meanY);
    }
    return total / (xs.length - 1);
}

function pearson(cov, stdX, stdY) {
    if (stdX === 0 || stdY === 0) return 0;
    return cov / (stdX * stdY);
}

function ranks(values) {
    const ordered = values
        .map((value, index) => ({ value, index }))
        .sort((a, b) => a.value - b.value);
    const result = Array(values.length);

    for (let i = 0; i < ordered.length;) {
        let j = i + 1;
        while (j < ordered.length && ordered[j].value === ordered[i].value) j++;
        const avgRank = (i + 1 + j) / 2;
        for (let k = i; k < j; k++) result[ordered[k].index] = avgRank;
        i = j;
    }

    return result;
}

function summarize(points) {
    const xs = points.map(point => point.x);
    const ys = points.map(point => point.y);
    const meanX = mean(xs);
    const meanY = mean(ys);
    const stdX = sampleStd(xs, meanX);
    const stdY = sampleStd(ys, meanY);
    const cov = sampleCovariance(xs, ys, meanX, meanY);
    const r = pearson(cov, stdX, stdY);
    const slope = stdX === 0 ? 0 : cov / Math.pow(stdX, 2);
    const intercept = meanY - slope * meanX;
    const residuals = points.map(point => point.y - (slope * point.x + intercept));
    const residualMean = mean(residuals);
    const sse = residuals.reduce((sum, value) => sum + value * value, 0);
    const sst = ys.reduce((sum, value) => sum + Math.pow(value - meanY, 2), 0);
    const rankX = ranks(xs);
    const rankY = ranks(ys);
    const rankMeanX = mean(rankX);
    const rankMeanY = mean(rankY);
    const rankCov = sampleCovariance(rankX, rankY, rankMeanX, rankMeanY);
    const spearman = pearson(rankCov, sampleStd(rankX, rankMeanX), sampleStd(rankY, rankMeanY));

    return {
        points,
        xs,
        ys,
        n: points.length,
        meanX,
        meanY,
        stdX,
        stdY,
        cov,
        r,
        r2: r * r,
        slope,
        intercept,
        residuals,
        residualMean,
        residualStd: sampleStd(residuals, residualMean),
        sse,
        sst,
        spearman,
        minX: Math.min(...xs),
        maxX: Math.max(...xs),
        minY: Math.min(...ys),
        maxY: Math.max(...ys)
    };
}

function parsePoints(raw) {
    const numbers = raw
        .split(/[\s,;]+/)
        .map(value => value.trim())
        .filter(Boolean)
        .map(Number)
        .filter(Number.isFinite);
    const points = [];

    for (let i = 0; i + 1 < numbers.length; i += 2) {
        points.push({ x: numbers[i], y: numbers[i + 1] });
    }

    return points;
}

function formatPoints(points) {
    return points.map(point => `${formatPlain(point[0] ?? point.x)}, ${formatPlain(point[1] ?? point.y)}`).join("\n");
}

function formatNumber(value) {
    if (!Number.isFinite(value)) return "-";
    if (Math.abs(value) >= 1000) return value.toFixed(0);
    if (Math.abs(value) >= 100) return value.toFixed(1);
    return value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

function formatPlain(value) {
    if (!Number.isFinite(value)) return "";
    return Math.round(value * 100) / 100;
}

function clampNumber(value, min, max, fallback) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
}

function randomNormal() {
    const u1 = Math.max(Math.random(), Number.EPSILON);
    const u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function generateDataset(shape, count, centerX, centerY, slope, noise, outliers) {
    const points = [];
    const baseCount = Math.max(3, count - outliers);

    for (let i = 0; i < baseCount; i++) {
        const t = baseCount === 1 ? 0 : (i / (baseCount - 1) - 0.5) * 70;
        const jitterX = randomNormal() * 4;
        let x = centerX + t + jitterX;
        let y;

        if (shape === "negative-linear") {
            y = centerY - Math.abs(slope) * t + randomNormal() * noise;
        } else if (shape === "curved") {
            y = centerY + Math.pow(t / 12, 2) * Math.max(2, Math.abs(slope) * 3) + randomNormal() * noise;
        } else if (shape === "clusters") {
            const group = i % 3;
            x = centerX + (group - 1) * 28 + randomNormal() * 4;
            y = centerY + (group === 0 ? -14 : group === 1 ? 14 : -2) + randomNormal() * noise * 0.65;
        } else if (shape === "near-zero") {
            y = centerY + randomNormal() * Math.max(8, noise * 1.6);
        } else {
            y = centerY + slope * t + randomNormal() * noise;
        }

        points.push([Math.round(x * 10) / 10, Math.round(y * 10) / 10]);
    }

    for (let i = 0; i < outliers; i++) {
        const side = i % 2 === 0 ? 1 : -1;
        points.push([
            Math.round((centerX + side * (42 + Math.random() * 24)) * 10) / 10,
            Math.round((centerY + side * slope * 42 + randomNormal() * noise * 2.2) * 10) / 10
        ]);
    }

    return points;
}

function generateFromControls() {
    const shape = document.getElementById("generate-shape").value;
    const count = Math.round(clampNumber(document.getElementById("generate-count").value, 5, 120, 32));
    const centerX = clampNumber(document.getElementById("generate-center-x").value, -500, 500, 50);
    const centerY = clampNumber(document.getElementById("generate-center-y").value, -500, 500, 50);
    const slope = clampNumber(document.getElementById("generate-slope").value, -10, 10, 1);
    const noise = clampNumber(document.getElementById("generate-noise").value, 0, 80, 8);
    const outliers = Math.round(clampNumber(document.getElementById("generate-outliers").value, 0, 12, 1));
    const points = generateDataset(shape, count, centerX, centerY, slope, noise, outliers);

    document.getElementById("dataset-points").value = formatPoints(points);
    activeMessage = `Generated ${shape.replace("-", " ")} data.`;
    draw();
}

function configureChart(width, showResiduals) {
    const narrow = width < 620;
    const left = narrow ? 54 : 76;
    const right = narrow ? 18 : 34;
    const top = narrow ? 38 : 42;
    const plotHeight = narrow ? 300 : 390;
    const residualTop = top + plotHeight + (narrow ? 72 : 82);
    const residualHeight = showResiduals ? (narrow ? 92 : 120) : 0;
    const bottom = narrow ? 28 : 42;
    const height = showResiduals ? residualTop + residualHeight + bottom : top + plotHeight + bottom;

    Object.assign(CHART, {
        left,
        right,
        top,
        plotHeight,
        residualTop,
        residualHeight,
        bottom,
        narrow
    });

    return Math.ceil(height);
}

function resizeCanvas(showResiduals) {
    const canvas = document.getElementById("canvas");
    const container = canvas.parentElement;
    const width = Math.max(320, Math.min(container.clientWidth, 920));
    const height = configureChart(width, showResiduals);
    const dpr = window.devicePixelRatio || 1;

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { width, height };
}

function getCookie(name) {
    const cookies = document.cookie.split(";");
    for (let cookie of cookies) {
        const [key, value] = cookie.trim().split("=");
        if (key === name) return value;
    }
    return null;
}

function getColor(light, dark) {
    const darkModeValue = getCookie("darkMode");
    return darkModeValue && darkModeValue.toLowerCase() === "true" ? dark : light;
}

function draw() {
    const points = parsePoints(document.getElementById("dataset-points").value);
    const message = document.getElementById("input-message");
    const showResiduals = document.getElementById("show-residuals").checked;
    const dimensions = resizeCanvas(showResiduals);
    const ctx = document.getElementById("canvas").getContext("2d");

    ctx.clearRect(0, 0, dimensions.width, dimensions.height);

    if (points.length < 3) {
        message.textContent = "Enter at least three x,y pairs.";
        message.classList.add("error");
        drawBackground(ctx, dimensions);
        drawMessage(ctx, dimensions, "Enter at least three x,y pairs.");
        renderStats(null);
        return;
    }

    const summary = summarize(points);
    message.textContent = activeMessage || currentPresetNote();
    message.classList.remove("error");
    drawVisualization(ctx, dimensions, summary);
    renderStats(summary);
}

function drawVisualization(ctx, dimensions, summary) {
    const showRegression = document.getElementById("show-regression").checked;
    const showMeanLines = document.getElementById("show-mean-lines").checked;
    const showQuadrants = document.getElementById("show-quadrants").checked;
    const showEllipse = document.getElementById("show-ellipse").checked;
    const showResiduals = document.getElementById("show-residuals").checked;
    const xScale = createLinearScale(summary.minX, summary.maxX, CHART.left, dimensions.width - CHART.right);
    const yScale = createLinearScale(summary.minY, summary.maxY, CHART.top + CHART.plotHeight, CHART.top);
    const x = value => xScale(value);
    const y = value => yScale(value);

    drawBackground(ctx, dimensions);
    if (showQuadrants) {
        ctx.save();
        clipScatterPlot(ctx, dimensions);
        drawCovarianceQuadrants(ctx, dimensions, summary, x, y);
        ctx.restore();
    }
    drawScatterAxes(ctx, dimensions, summary, xScale, yScale);
    drawSectionLabel(ctx, CHART.narrow ? "Scatter" : "Scatter plot with covariance structure", CHART.left, CHART.top - 16);

    ctx.save();
    clipScatterPlot(ctx, dimensions);
    if (showMeanLines) drawMeanLines(ctx, dimensions, summary, x, y);
    if (showEllipse) drawCovarianceEllipse(ctx, summary, x, y);
    if (showRegression) drawRegressionLine(ctx, dimensions, summary, x, y);
    drawPoints(ctx, summary, x, y);
    ctx.restore();

    if (showResiduals) drawResidualPlot(ctx, dimensions, summary, xScale);
}

function clipScatterPlot(ctx, dimensions) {
    ctx.beginPath();
    ctx.rect(CHART.left, CHART.top, dimensions.width - CHART.left - CHART.right, CHART.plotHeight);
    ctx.clip();
}

function createLinearScale(minValue, maxValue, minPx, maxPx) {
    const spread = Math.max(maxValue - minValue, 1);
    const padding = spread * 0.1;
    const min = minValue - padding;
    const max = maxValue + padding;

    const scale = value => minPx + ((value - min) / (max - min)) * (maxPx - minPx);
    scale.min = min;
    scale.max = max;
    scale.minPx = minPx;
    scale.maxPx = maxPx;
    return scale;
}

function drawBackground(ctx, dimensions) {
    ctx.fillStyle = getColor("#fbfcfe", "#171717");
    ctx.fillRect(0, 0, dimensions.width, dimensions.height);
    ctx.strokeStyle = getColor("#e3e8ef", "#333333");
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, dimensions.width - 1, dimensions.height - 1);
}

function drawScatterAxes(ctx, dimensions, summary, xScale, yScale) {
    const axisColor = getColor("#667085", "#cbd5e1");
    const gridColor = getColor("rgba(148, 163, 184, 0.24)", "rgba(148, 163, 184, 0.18)");
    const textColor = getColor("#536174", "#cbd5e1");
    const plotRight = dimensions.width - CHART.right;
    const plotBottom = CHART.top + CHART.plotHeight;
    const xTicks = ticks(xScale.min, xScale.max, CHART.narrow ? 4 : 7);
    const yTicks = ticks(yScale.min, yScale.max, CHART.narrow ? 4 : 6);

    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    xTicks.forEach(value => {
        const px = xScale(value);
        ctx.beginPath();
        ctx.moveTo(px, CHART.top);
        ctx.lineTo(px, plotBottom);
        ctx.stroke();
    });
    yTicks.forEach(value => {
        const py = yScale(value);
        ctx.beginPath();
        ctx.moveTo(CHART.left, py);
        ctx.lineTo(plotRight, py);
        ctx.stroke();
    });

    ctx.strokeStyle = axisColor;
    ctx.beginPath();
    ctx.moveTo(CHART.left, plotBottom);
    ctx.lineTo(plotRight, plotBottom);
    ctx.moveTo(CHART.left, CHART.top);
    ctx.lineTo(CHART.left, plotBottom);
    ctx.stroke();

    ctx.fillStyle = textColor;
    ctx.font = CHART.narrow ? "11px Arial" : "12px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    xTicks.forEach(value => ctx.fillText(formatTick(value), xScale(value), plotBottom + 9));

    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    yTicks.forEach(value => ctx.fillText(formatTick(value), CHART.left - 8, yScale(value)));

    if (!CHART.narrow) {
        ctx.save();
        ctx.fillStyle = textColor;
        ctx.translate(18, CHART.top + CHART.plotHeight / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = "center";
        ctx.fillText("Y", 0, 0);
        ctx.restore();
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText("X", CHART.left + (plotRight - CHART.left) / 2, plotBottom + 38);
    }
}

function drawCovarianceQuadrants(ctx, dimensions, summary, x, y) {
    const meanX = x(summary.meanX);
    const meanY = y(summary.meanY);
    const plotRight = dimensions.width - CHART.right;
    const plotBottom = CHART.top + CHART.plotHeight;

    ctx.save();
    ctx.fillStyle = COLORS.positive;
    ctx.fillRect(CHART.left, CHART.top, meanX - CHART.left, meanY - CHART.top);
    ctx.fillRect(meanX, meanY, plotRight - meanX, plotBottom - meanY);
    ctx.fillStyle = COLORS.negative;
    ctx.fillRect(meanX, CHART.top, plotRight - meanX, meanY - CHART.top);
    ctx.fillRect(CHART.left, meanY, meanX - CHART.left, plotBottom - meanY);
    ctx.restore();
}

function drawMeanLines(ctx, dimensions, summary, x, y) {
    const plotRight = dimensions.width - CHART.right;
    const plotBottom = CHART.top + CHART.plotHeight;
    const meanX = x(summary.meanX);
    const meanY = y(summary.meanY);

    ctx.save();
    ctx.strokeStyle = COLORS.mean;
    ctx.fillStyle = COLORS.mean;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.moveTo(meanX, CHART.top);
    ctx.lineTo(meanX, plotBottom);
    ctx.moveTo(CHART.left, meanY);
    ctx.lineTo(plotRight, meanY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = CHART.narrow ? "10px Arial" : "12px Arial";
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText("mean x", meanX + 6, CHART.top + 18);
    ctx.textBaseline = "top";
    ctx.fillText("mean y", CHART.left + 8, meanY + 5);
    ctx.restore();
}

function drawRegressionLine(ctx, dimensions, summary, x, y) {
    const x1 = Math.min(summary.minX, summary.maxX);
    const x2 = Math.max(summary.minX, summary.maxX);
    const y1 = summary.slope * x1 + summary.intercept;
    const y2 = summary.slope * x2 + summary.intercept;

    ctx.save();
    ctx.strokeStyle = COLORS.regression;
    ctx.lineWidth = 2.25;
    ctx.beginPath();
    ctx.moveTo(x(x1), y(y1));
    ctx.lineTo(x(x2), y(y2));
    ctx.stroke();

    if (document.getElementById("show-residual-lines").checked) {
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = 1;
        summary.points.forEach(point => {
            const fittedY = summary.slope * point.x + summary.intercept;
            ctx.beginPath();
            ctx.moveTo(x(point.x), y(point.y));
            ctx.lineTo(x(point.x), y(fittedY));
            ctx.stroke();
        });
    }
    ctx.restore();
}

function drawCovarianceEllipse(ctx, summary, x, y) {
    const covXX = summary.stdX * summary.stdX;
    const covYY = summary.stdY * summary.stdY;
    const covXY = summary.cov;
    const trace = covXX + covYY;
    const delta = Math.sqrt(Math.pow(covXX - covYY, 2) + 4 * covXY * covXY);
    const lambda1 = Math.max(0, (trace + delta) / 2);
    const lambda2 = Math.max(0, (trace - delta) / 2);
    const angle = 0.5 * Math.atan2(2 * covXY, covXX - covYY);
    const radius1 = 2 * Math.sqrt(lambda1);
    const radius2 = 2 * Math.sqrt(lambda2);

    ctx.save();
    ctx.strokeStyle = COLORS.ellipse;
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 5]);
    ctx.beginPath();
    for (let i = 0; i <= 160; i++) {
        const t = (i / 160) * Math.PI * 2;
        const localX = Math.cos(t) * radius1;
        const localY = Math.sin(t) * radius2;
        const pxValue = summary.meanX + localX * Math.cos(angle) - localY * Math.sin(angle);
        const pyValue = summary.meanY + localX * Math.sin(angle) + localY * Math.cos(angle);
        const px = x(pxValue);
        const py = y(pyValue);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
}

function drawPoints(ctx, summary, x, y) {
    ctx.save();
    summary.points.forEach((point, index) => {
        const influence = Math.abs((point.x - summary.meanX) * (point.y - summary.meanY));
        const radius = influence > Math.abs(summary.cov) * 3 ? 5 : 4;
        ctx.beginPath();
        ctx.fillStyle = COLORS.pointFill;
        ctx.strokeStyle = COLORS.point;
        ctx.lineWidth = 1.3;
        ctx.arc(x(point.x), y(point.y), radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        if (document.getElementById("show-labels").checked) {
            ctx.fillStyle = getColor("#344054", "#dbe4ef");
            ctx.font = "10px Arial";
            ctx.textAlign = "left";
            ctx.textBaseline = "bottom";
            ctx.fillText(String(index + 1), x(point.x) + 5, y(point.y) - 4);
        }
    });
    ctx.restore();
}

function drawResidualPlot(ctx, dimensions, summary, xScale) {
    const textColor = getColor("#475467", "#dbe4ef");
    const gridColor = getColor("rgba(148, 163, 184, 0.24)", "rgba(148, 163, 184, 0.18)");
    const axisColor = getColor("#667085", "#cbd5e1");
    const top = CHART.residualTop;
    const bottom = top + CHART.residualHeight;
    const plotRight = dimensions.width - CHART.right;
    const maxAbs = Math.max(1, ...summary.residuals.map(value => Math.abs(value))) * 1.15;
    const yResidual = value => bottom - ((value + maxAbs) / (2 * maxAbs)) * CHART.residualHeight;
    const zeroY = yResidual(0);

    drawDivider(ctx, dimensions, top - 28);
    drawSectionLabel(ctx, "Residuals from least-squares line", CHART.left, top - 42);

    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    [-maxAbs, 0, maxAbs].forEach(value => {
        const py = yResidual(value);
        ctx.beginPath();
        ctx.moveTo(CHART.left, py);
        ctx.lineTo(plotRight, py);
        ctx.stroke();
    });

    ctx.strokeStyle = axisColor;
    ctx.beginPath();
    ctx.moveTo(CHART.left, bottom);
    ctx.lineTo(plotRight, bottom);
    ctx.moveTo(CHART.left, top);
    ctx.lineTo(CHART.left, bottom);
    ctx.stroke();

    ctx.strokeStyle = COLORS.regression;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(CHART.left, zeroY);
    ctx.lineTo(plotRight, zeroY);
    ctx.stroke();
    ctx.setLineDash([]);

    summary.points.forEach((point, index) => {
        const residual = summary.residuals[index];
        ctx.beginPath();
        ctx.fillStyle = residual >= 0 ? COLORS.point : COLORS.residual;
        ctx.arc(xScale(point.x), yResidual(residual), CHART.narrow ? 3.2 : 3.8, 0, Math.PI * 2);
        ctx.fill();
    });

    ctx.fillStyle = textColor;
    ctx.font = CHART.narrow ? "10px Arial" : "12px Arial";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText("0", CHART.left - 8, zeroY);
    ctx.fillText(formatNumber(maxAbs), CHART.left - 8, yResidual(maxAbs));
    ctx.fillText(formatNumber(-maxAbs), CHART.left - 8, yResidual(-maxAbs));
}

function drawDivider(ctx, dimensions, y) {
    ctx.strokeStyle = getColor("#e3e8ef", "#333333");
    ctx.beginPath();
    ctx.moveTo(CHART.left, y);
    ctx.lineTo(dimensions.width - CHART.right, y);
    ctx.stroke();
}

function drawSectionLabel(ctx, label, x, y) {
    ctx.fillStyle = getColor("#111827", "#e5e7eb");
    ctx.font = CHART.narrow ? "700 12px Arial" : "700 13px Arial";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(label, x, y);
}

function drawMessage(ctx, dimensions, message) {
    ctx.fillStyle = getColor("#333", "#eee");
    ctx.font = "16px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(message, dimensions.width / 2, dimensions.height / 2);
}

function renderStats(summary) {
    const grid = document.getElementById("stats-grid");
    if (!summary) {
        grid.innerHTML = "";
        return;
    }

    grid.innerHTML = `
        <article class="stat-card">
            <h3>Linear relationship</h3>
            <table class="stat-table">
                <tbody>
                    <tr><th>n</th><td>${summary.n}</td><th>Pearson r</th><td>${formatNumber(summary.r)}</td></tr>
                    <tr><th>R squared</th><td>${formatNumber(summary.r2)}</td><th>Spearman rho</th><td>${formatNumber(summary.spearman)}</td></tr>
                    <tr><th>Slope</th><td>${formatNumber(summary.slope)}</td><th>Intercept</th><td>${formatNumber(summary.intercept)}</td></tr>
                </tbody>
            </table>
        </article>
        <article class="stat-card">
            <h3>Centers and spread</h3>
            <table class="stat-table">
                <tbody>
                    <tr><th>Mean x</th><td>${formatNumber(summary.meanX)}</td><th>Mean y</th><td>${formatNumber(summary.meanY)}</td></tr>
                    <tr><th>Std x</th><td>${formatNumber(summary.stdX)}</td><th>Std y</th><td>${formatNumber(summary.stdY)}</td></tr>
                    <tr><th>Cov(x,y)</th><td>${formatNumber(summary.cov)}</td><th>Residual std</th><td>${formatNumber(summary.residualStd)}</td></tr>
                </tbody>
            </table>
        </article>
        <article class="stat-card wide-stat">
            <h3>Covariance matrix</h3>
            <table class="matrix-table">
                <tbody>
                    <tr><th></th><th>x</th><th>y</th></tr>
                    <tr><th>x</th><td>${formatNumber(summary.stdX * summary.stdX)}</td><td>${formatNumber(summary.cov)}</td></tr>
                    <tr><th>y</th><td>${formatNumber(summary.cov)}</td><td>${formatNumber(summary.stdY * summary.stdY)}</td></tr>
                </tbody>
            </table>
        </article>
    `;
}

function renderLegend() {
    const legend = document.getElementById("plot-legend");
    legend.innerHTML = `
        <span class="legend-item"><span class="legend-swatch point-swatch"></span>Data point</span>
        <span class="legend-item"><span class="legend-line regression-line"></span>Least-squares line</span>
        <span class="legend-item"><span class="legend-line mean-line"></span>Mean x and mean y</span>
        <span class="legend-item"><span class="legend-line ellipse-line"></span>Covariance ellipse</span>
        <span class="legend-item"><span class="legend-swatch positive-swatch"></span>Positive covariance quadrant</span>
        <span class="legend-item"><span class="legend-swatch negative-swatch"></span>Negative covariance quadrant</span>
    `;
}

function ticks(min, max, targetCount) {
    const step = niceStep((max - min) / Math.max(1, targetCount));
    const values = [];
    for (let value = Math.ceil(min / step) * step; value <= max; value += step) {
        values.push(value);
    }
    return values;
}

function niceStep(rawStep) {
    if (!Number.isFinite(rawStep) || rawStep <= 0) return 1;
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const normalized = rawStep / magnitude;
    if (normalized <= 1) return magnitude;
    if (normalized <= 2) return 2 * magnitude;
    if (normalized <= 5) return 5 * magnitude;
    return 10 * magnitude;
}

function formatTick(value) {
    if (Math.abs(value) >= 100) return value.toFixed(0);
    if (Math.abs(value) >= 10) return value.toFixed(0);
    return value.toFixed(1);
}

function currentPresetNote() {
    if (activeMessage) return activeMessage;
    const preset = document.getElementById("preset-select").value;
    return DATASETS[preset] ? DATASETS[preset].note : "Enter x,y pairs.";
}

function applyPreset(key) {
    const preset = DATASETS[key];
    if (!preset) return;
    document.getElementById("dataset-points").value = formatPoints(preset.points);
    activeMessage = "";
    draw();
}

document.addEventListener("DOMContentLoaded", function() {
    const drawButton = document.querySelector(".draw-button");
    const generateButton = document.getElementById("generate-button");
    const presetSelect = document.getElementById("preset-select");
    const inputs = document.querySelectorAll("textarea, input[type='checkbox']");
    const generatorInputs = document.querySelectorAll(".generator-grid input, .generator-grid select");
    const toggleButton = document.querySelector(".toggle-dark-mode, #dark-mode-button");

    renderLegend();

    if (drawButton) drawButton.addEventListener("click", draw);
    if (generateButton) generateButton.addEventListener("click", generateFromControls);

    if (presetSelect) {
        presetSelect.addEventListener("change", function() {
            applyPreset(presetSelect.value);
        });
    }

    inputs.forEach(function(input) {
        input.addEventListener("input", function() {
            if (input.tagName === "TEXTAREA") activeMessage = "";
            clearTimeout(input.drawTimeout);
            input.drawTimeout = setTimeout(draw, 120);
        });
    });

    generatorInputs.forEach(function(input) {
        input.addEventListener("input", function() {
            activeMessage = "";
        });
    });

    if (toggleButton) {
        toggleButton.addEventListener("click", function() {
            window.setTimeout(draw, 0);
        });
    }

    applyPreset(presetSelect.value);
});

let resizeTimeout;
window.onresize = function() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(draw, 150);
};
