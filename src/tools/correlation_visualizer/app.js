const DATASETS = {
    "positive-linear": {
        points: [
            [12, 18],
            [16, 21],
            [20, 26],
            [24, 31],
            [28, 33],
            [32, 37],
            [36, 42],
            [40, 44],
            [44, 49],
            [48, 53],
            [52, 55],
            [56, 62],
            [60, 65],
            [64, 68],
            [68, 73],
            [72, 75]
        ],
        note: "Positive covariance: x and y tend to move above or below their means together."
    },
    "negative-linear": {
        points: [
            [12, 78],
            [16, 75],
            [20, 70],
            [24, 68],
            [28, 63],
            [32, 59],
            [36, 55],
            [40, 52],
            [44, 48],
            [48, 45],
            [52, 39],
            [56, 36],
            [60, 32],
            [64, 28],
            [68, 24],
            [72, 20]
        ],
        note: "Negative covariance: large x values tend to pair with small y values."
    },
    "near-zero": {
        points: [
            [12, 41],
            [16, 58],
            [20, 48],
            [24, 61],
            [28, 37],
            [32, 55],
            [36, 45],
            [40, 64],
            [44, 40],
            [48, 53],
            [52, 47],
            [56, 60],
            [60, 38],
            [64, 56],
            [68, 44],
            [72, 51]
        ],
        note: "Near-zero correlation: the cloud has no strong linear direction."
    },
    "curved": {
        points: [
            [-8, 72],
            [-7, 63],
            [-6, 55],
            [-5, 47],
            [-4, 40],
            [-3, 35],
            [-2, 31],
            [-1, 29],
            [0, 28],
            [1, 29],
            [2, 32],
            [3, 36],
            [4, 42],
            [5, 49],
            [6, 56],
            [7, 65],
            [8, 75]
        ],
        note: "Pearson correlation can be small even when a clear nonlinear relationship exists."
    },
    "outlier-leverage": {
        points: [
            [24, 32],
            [27, 35],
            [30, 34],
            [33, 37],
            [36, 36],
            [39, 38],
            [42, 40],
            [45, 41],
            [48, 39],
            [51, 42],
            [54, 43],
            [57, 41],
            [60, 44],
            [63, 43],
            [66, 45],
            [118, 92]
        ],
        note: "A high-leverage point can pull the regression line and Pearson r."
    },
    "clusters": {
        points: [
            [18, 28],
            [20, 32],
            [22, 31],
            [24, 34],
            [26, 29],
            [28, 33],
            [52, 58],
            [54, 61],
            [56, 57],
            [58, 63],
            [60, 60],
            [62, 64],
            [78, 38],
            [80, 42],
            [82, 39],
            [84, 44],
            [86, 41],
            [88, 45]
        ],
        note: "Clusters can create a misleading overall correlation when groups differ."
    }
};

const DEFAULT_POINTS = DATASETS["positive-linear"].points;

const COLORS = {
    point: "#60a5fa",
    pointFill: "rgba(96, 165, 250, 0.82)",
    regression: "#fb7185",
    mean: "#fbbf24",
    positive: "rgba(96, 165, 250, 0.11)",
    negative: "rgba(251, 113, 133, 0.10)",
    residual: "rgba(251, 113, 133, 0.78)",
    ellipse: "#4ade80",
    spearman: "#8b5cf6",
    spearmanFill: "rgba(139, 92, 246, 0.76)"
};

const CHART = {
    left: 76,
    right: 34,
    top: 42,
    plotHeight: 390,
    residualTop: 500,
    residualHeight: 120,
    rankTop: 700,
    rankHeight: 280,
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
    if (stdX === 0 || stdY === 0) return Number.NaN;
    return cov / (stdX * stdY);
}

function ranks(values) {
    const ordered = values
        .map((value, index) => ({
            value,
            index
        }))
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

function tiedRankGroups(values, assignedRanks) {
    const groups = new Map();
    values.forEach((value, index) => {
        if (!groups.has(value)) groups.set(value, []);
        groups.get(value).push(index);
    });
    return [...groups.entries()]
        .filter(([, indices]) => indices.length > 1)
        .map(([value, indices]) => ({
            value,
            count: indices.length,
            averageRank: assignedRanks[indices[0]]
        }));
}

function kendallTauB(xs, ys) {
    let concordant = 0;
    let discordant = 0;
    let tiesX = 0;
    let tiesY = 0;
    let tiesBoth = 0;

    for (let i = 0; i < xs.length - 1; i++) {
        for (let j = i + 1; j < xs.length; j++) {
            const dx = xs[j] - xs[i];
            const dy = ys[j] - ys[i];
            if (dx === 0 && dy === 0) tiesBoth++;
            else if (dx === 0) tiesX++;
            else if (dy === 0) tiesY++;
            else if (dx * dy > 0) concordant++;
            else discordant++;
        }
    }

    const denominator = Math.sqrt(
        (concordant + discordant + tiesX) * (concordant + discordant + tiesY)
    );
    return {
        value: denominator === 0 ? Number.NaN : (concordant - discordant) / denominator,
        concordant,
        discordant,
        tiesX,
        tiesY,
        tiesBoth,
        denominator,
        totalPairs: xs.length * (xs.length - 1) / 2
    };
}

function doubleCenteredDistances(values) {
    const n = values.length;
    const distances = Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (_, j) => Math.abs(values[i] - values[j]))
    );
    const rowMeans = distances.map(row => row.reduce((sum, value) => sum + value, 0) / n);
    const grandMean = rowMeans.reduce((sum, value) => sum + value, 0) / n;
    const centered = distances.map((row, i) =>
        row.map((value, j) => value - rowMeans[i] - rowMeans[j] + grandMean)
    );
    return { distances, rowMeans, grandMean, centered };
}

function distanceCorrelation(xs, ys) {
    const centeredX = doubleCenteredDistances(xs);
    const centeredY = doubleCenteredDistances(ys);
    const nSquared = xs.length * xs.length;
    let crossSum = 0;
    let squareSumX = 0;
    let squareSumY = 0;

    for (let i = 0; i < xs.length; i++) {
        for (let j = 0; j < xs.length; j++) {
            const a = centeredX.centered[i][j];
            const b = centeredY.centered[i][j];
            crossSum += a * b;
            squareSumX += a * a;
            squareSumY += b * b;
        }
    }

    const covarianceSquared = Math.max(0, crossSum / nSquared);
    const varianceXSquared = Math.max(0, squareSumX / nSquared);
    const varianceYSquared = Math.max(0, squareSumY / nSquared);
    const denominator = Math.sqrt(varianceXSquared * varianceYSquared);
    const correlationSquared = denominator === 0
        ? Number.NaN
        : Math.max(0, Math.min(1, covarianceSquared / denominator));

    return {
        value: Number.isFinite(correlationSquared) ? Math.sqrt(correlationSquared) : Number.NaN,
        correlationSquared,
        covarianceSquared,
        varianceXSquared,
        varianceYSquared,
        crossSum,
        squareSumX,
        squareSumY,
        nSquared,
        grandMeanX: centeredX.grandMean,
        grandMeanY: centeredY.grandMean
    };
}

function summarize(points, measures = {}) {
    const xs = points.map(point => point.x);
    const ys = points.map(point => point.y);
    const sumX = xs.reduce((sum, value) => sum + value, 0);
    const sumY = ys.reduce((sum, value) => sum + value, 0);
    const meanX = mean(xs);
    const meanY = mean(ys);
    const deviations = points.map((point, index) => {
        const dx = point.x - meanX;
        const dy = point.y - meanY;
        return {
            index,
            x: point.x,
            y: point.y,
            dx,
            dy,
            crossProduct: dx * dy,
            squareX: dx * dx,
            squareY: dy * dy
        };
    });
    const sumCrossProducts = deviations.reduce((sum, row) => sum + row.crossProduct, 0);
    const sumSquaresX = deviations.reduce((sum, row) => sum + row.squareX, 0);
    const sumSquaresY = deviations.reduce((sum, row) => sum + row.squareY, 0);
    const varianceX = sampleVariance(xs, meanX);
    const varianceY = sampleVariance(ys, meanY);
    const stdX = Math.sqrt(varianceX);
    const stdY = Math.sqrt(varianceY);
    const cov = sampleCovariance(xs, ys, meanX, meanY);
    const r = pearson(cov, stdX, stdY);
    const slope = varianceX === 0 ? 0 : cov / varianceX;
    const intercept = meanY - slope * meanX;
    const fittedValues = points.map(point => slope * point.x + intercept);
    const residuals = points.map((point, index) => point.y - fittedValues[index]);
    const residualMean = mean(residuals);
    const sse = residuals.reduce((sum, value) => sum + value * value, 0);
    const sst = ys.reduce((sum, value) => sum + Math.pow(value - meanY, 2), 0);
    const r2 = sst === 0 ? Number.NaN : 1 - sse / sst;
    let rankX = [];
    let rankY = [];
    let rankMeanX = Number.NaN;
    let rankMeanY = Number.NaN;
    let rankCov = Number.NaN;
    let rankStdX = Number.NaN;
    let rankStdY = Number.NaN;
    let rankSlope = Number.NaN;
    let rankIntercept = Number.NaN;
    let spearman = Number.NaN;
    let spearmanShortcut = Number.NaN;
    let rankDeviations = [];
    let rankTiesX = [];
    let rankTiesY = [];
    let sumRankCrossProducts = Number.NaN;
    let sumRankSquaresX = Number.NaN;
    let sumRankSquaresY = Number.NaN;
    let sumRankDifferencesSquared = Number.NaN;
    if (measures.spearman) {
        rankX = ranks(xs);
        rankY = ranks(ys);
        rankMeanX = mean(rankX);
        rankMeanY = mean(rankY);
        rankTiesX = tiedRankGroups(xs, rankX);
        rankTiesY = tiedRankGroups(ys, rankY);
        rankDeviations = rankX.map((value, index) => {
            const dx = value - rankMeanX;
            const dy = rankY[index] - rankMeanY;
            const difference = value - rankY[index];
            return {
                dx,
                dy,
                crossProduct: dx * dy,
                squareX: dx * dx,
                squareY: dy * dy,
                difference,
                differenceSquared: difference * difference
            };
        });
        sumRankCrossProducts = rankDeviations.reduce((sum, row) => sum + row.crossProduct, 0);
        sumRankSquaresX = rankDeviations.reduce((sum, row) => sum + row.squareX, 0);
        sumRankSquaresY = rankDeviations.reduce((sum, row) => sum + row.squareY, 0);
        sumRankDifferencesSquared = rankDeviations.reduce((sum, row) => sum + row.differenceSquared, 0);
        rankCov = sampleCovariance(rankX, rankY, rankMeanX, rankMeanY);
        rankStdX = sampleStd(rankX, rankMeanX);
        rankStdY = sampleStd(rankY, rankMeanY);
        const rankVarianceX = rankStdX * rankStdX;
        rankSlope = rankVarianceX === 0 ? 0 : rankCov / rankVarianceX;
        rankIntercept = rankMeanY - rankSlope * rankMeanX;
        spearman = pearson(rankCov, rankStdX, rankStdY);
        if (rankTiesX.length === 0 && rankTiesY.length === 0) {
            spearmanShortcut = 1 - (6 * sumRankDifferencesSquared) / (points.length * (points.length * points.length - 1));
        }
    }
    const ellipseTrace = varianceX + varianceY;
    const ellipseDelta = Math.sqrt(Math.pow(varianceX - varianceY, 2) + 4 * cov * cov);
    const ellipseLambda1 = Math.max(0, (ellipseTrace + ellipseDelta) / 2);
    const ellipseLambda2 = Math.max(0, (ellipseTrace - ellipseDelta) / 2);
    const ellipseAngle = 0.5 * Math.atan2(2 * cov, varianceX - varianceY);
    const ellipse = {
        trace: ellipseTrace,
        delta: ellipseDelta,
        lambda1: ellipseLambda1,
        lambda2: ellipseLambda2,
        angle: ellipseAngle,
        angleDegrees: ellipseAngle * 180 / Math.PI,
        radius1: 2 * Math.sqrt(ellipseLambda1),
        radius2: 2 * Math.sqrt(ellipseLambda2)
    };
    const kendall = measures.kendall ? kendallTauB(xs, ys) : null;
    const distance = measures.distance ? distanceCorrelation(xs, ys) : null;

    return {
        points,
        xs,
        ys,
        n: points.length,
        sumX,
        sumY,
        meanX,
        meanY,
        deviations,
        sumCrossProducts,
        sumSquaresX,
        sumSquaresY,
        varianceX,
        varianceY,
        stdX,
        stdY,
        cov,
        r,
        r2,
        slope,
        intercept,
        fittedValues,
        residuals,
        residualMean,
        residualStd: sampleStd(residuals, residualMean),
        sse,
        sst,
        rankX,
        rankY,
        rankMeanX,
        rankMeanY,
        rankCov,
        rankStdX,
        rankStdY,
        rankSlope,
        rankIntercept,
        rankDeviations,
        rankTiesX,
        rankTiesY,
        sumRankCrossProducts,
        sumRankSquaresX,
        sumRankSquaresY,
        sumRankDifferencesSquared,
        spearman,
        spearmanShortcut,
        kendall,
        distance,
        ellipse,
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
        points.push({
            x: numbers[i],
            y: numbers[i + 1]
        });
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

function formatDetailedNumber(value) {
    if (!Number.isFinite(value)) return "undefined";
    if (Math.abs(value) < 1e-10) return "0";
    if (Math.abs(value) >= 100000) return value.toExponential(4);
    return value.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
}

function latexNumber(value) {
    return Number.isFinite(value) ? formatDetailedNumber(value) : "\\text{undefined}";
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

function configureChart(width, showResiduals, showSpearman) {
    const narrow = width < 620;
    const left = narrow ? 54 : 76;
    const right = narrow ? 18 : 34;
    const top = narrow ? 38 : 42;
    const plotHeight = narrow ? 300 : 390;
    const residualTop = top + plotHeight + (narrow ? 72 : 82);
    const residualHeight = showResiduals ? (narrow ? 92 : 120) : 0;
    const contentBottom = showResiduals ? residualTop + residualHeight : top + plotHeight;
    const rankTop = contentBottom + (narrow ? 68 : 82);
    const rankHeight = showSpearman ? (narrow ? 230 : 290) : 0;
    const bottom = narrow ? 28 : 42;
    const height = showSpearman
        ? rankTop + rankHeight + bottom
        : contentBottom + bottom;

    Object.assign(CHART, {
        left,
        right,
        top,
        plotHeight,
        residualTop,
        residualHeight,
        rankTop,
        rankHeight,
        bottom,
        narrow
    });

    return Math.ceil(height);
}

function resizeCanvas(showResiduals, showSpearman) {
    const canvas = document.getElementById("canvas");
    const container = canvas.parentElement;
    const width = Math.max(320, Math.min(container.clientWidth, 920));
    const height = configureChart(width, showResiduals, showSpearman);
    const dpr = window.devicePixelRatio || 1;

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return {
        width,
        height
    };
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
    const measures = selectedCorrelationMeasures();
    const canvas = document.getElementById("canvas");
    const dimensions = resizeCanvas(showResiduals, measures.spearman);
    const ctx = canvas.getContext("2d");

    canvas.dataset.spearmanEnabled = String(measures.spearman);
    canvas.dataset.spearman = "";
    canvas.dataset.rankPoints = "[]";
    canvas.setAttribute(
        "aria-label",
        measures.spearman
            ? "Scatter plot, residual plot, and Spearman rank-versus-rank plot"
            : "Scatter plot and residual plot"
    );
    renderLegend(measures);

    ctx.clearRect(0, 0, dimensions.width, dimensions.height);

    if (points.length < 3) {
        message.textContent = "Enter at least three x,y pairs.";
        message.classList.add("error");
        drawBackground(ctx, dimensions);
        drawMessage(ctx, dimensions, "Enter at least three x,y pairs.");
        renderStats(null, measures);
        return;
    }

    const summary = summarize(points, measures);
    if (measures.spearman) {
        canvas.dataset.spearman = String(summary.spearman);
        canvas.dataset.rankPoints = JSON.stringify(
            summary.rankX.map((rankX, index) => [rankX, summary.rankY[index]])
        );
    }
    message.textContent = activeMessage || currentPresetNote();
    message.classList.remove("error");
    drawVisualization(ctx, dimensions, summary, measures);
    renderStats(summary, measures);
}

function drawVisualization(ctx, dimensions, summary, measures) {
    const showRegression = document.getElementById("show-regression").checked;
    const showMeanLines = document.getElementById("show-mean-lines").checked;
    const showQuadrants = document.getElementById("show-quadrants").checked;
    const showEllipse = document.getElementById("show-ellipse").checked;
    const showResiduals = document.getElementById("show-residuals").checked;
    const domain = scatterDomain(summary);
    const xScale = createLinearScale(domain.minX, domain.maxX, CHART.left, dimensions.width - CHART.right);
    const yScale = createLinearScale(domain.minY, domain.maxY, CHART.top + CHART.plotHeight, CHART.top);
    const x = value => xScale(value);
    const y = value => yScale(value);
    x.scaleMin = xScale.min;
    x.scaleMax = xScale.max;

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
    if (measures.spearman) drawSpearmanRankPlot(ctx, dimensions, summary);
}

function scatterDomain(summary) {
    // A two-sigma covariance ellipse projects to mean ± 2σ on each axis,
    // regardless of its rotation. Include those projections before padding so
    // the entire ellipse, points, and mean structure share one plot domain.
    const ellipseMinX = summary.meanX - 2 * summary.stdX;
    const ellipseMaxX = summary.meanX + 2 * summary.stdX;
    const ellipseMinY = summary.meanY - 2 * summary.stdY;
    const ellipseMaxY = summary.meanY + 2 * summary.stdY;
    return {
        minX: Math.min(summary.minX, ellipseMinX),
        maxX: Math.max(summary.maxX, ellipseMaxX),
        minY: Math.min(summary.minY, ellipseMinY),
        maxY: Math.max(summary.maxY, ellipseMaxY)
    };
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
    // Extend through the complete plotted x-domain. The scatter clip trims the
    // line at the chart boundary when its y-value exits the visible domain.
    const x1 = x.scaleMin;
    const x2 = x.scaleMax;
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
    const { angle, radius1, radius2 } = summary.ellipse;

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

function drawSpearmanRankPlot(ctx, dimensions, summary) {
    const textColor = getColor("#475467", "#dbe4ef");
    const gridColor = getColor("rgba(148, 163, 184, 0.24)", "rgba(148, 163, 184, 0.18)");
    const axisColor = getColor("#667085", "#cbd5e1");
    const top = CHART.rankTop;
    const bottom = top + CHART.rankHeight;
    const right = dimensions.width - CHART.right;
    const rankMinX = Math.min(...summary.rankX);
    const rankMaxX = Math.max(...summary.rankX);
    const rankMinY = Math.min(...summary.rankY);
    const rankMaxY = Math.max(...summary.rankY);
    const xScale = createLinearScale(rankMinX, rankMaxX, CHART.left, right);
    const yScale = createLinearScale(rankMinY, rankMaxY, bottom, top);
    const xTicks = ticks(xScale.min, xScale.max, CHART.narrow ? 4 : 7);
    const yTicks = ticks(yScale.min, yScale.max, CHART.narrow ? 4 : 6);
    const tiedX = new Set(summary.rankX).size < summary.n;
    const tiedY = new Set(summary.rankY).size < summary.n;
    const tieNote = tiedX || tiedY ? " • ties use average ranks" : "";

    drawDivider(ctx, dimensions, top - 28);
    drawSectionLabel(
        ctx,
        `Spearman rank view  ρₛ = ${formatNumber(summary.spearman)}`,
        CHART.left,
        top - 42
    );

    ctx.save();
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    xTicks.forEach(value => {
        const px = xScale(value);
        ctx.beginPath();
        ctx.moveTo(px, top);
        ctx.lineTo(px, bottom);
        ctx.stroke();
    });
    yTicks.forEach(value => {
        const py = yScale(value);
        ctx.beginPath();
        ctx.moveTo(CHART.left, py);
        ctx.lineTo(right, py);
        ctx.stroke();
    });

    ctx.strokeStyle = axisColor;
    ctx.beginPath();
    ctx.moveTo(CHART.left, bottom);
    ctx.lineTo(right, bottom);
    ctx.moveTo(CHART.left, top);
    ctx.lineTo(CHART.left, bottom);
    ctx.stroke();

    ctx.beginPath();
    ctx.rect(CHART.left, top, right - CHART.left, CHART.rankHeight);
    ctx.clip();

    if (Number.isFinite(summary.rankSlope) && Number.isFinite(summary.rankIntercept)) {
        const rankX1 = xScale.min;
        const rankX2 = xScale.max;
        ctx.strokeStyle = COLORS.spearman;
        ctx.lineWidth = 2.25;
        ctx.beginPath();
        ctx.moveTo(xScale(rankX1), yScale(summary.rankSlope * rankX1 + summary.rankIntercept));
        ctx.lineTo(xScale(rankX2), yScale(summary.rankSlope * rankX2 + summary.rankIntercept));
        ctx.stroke();
    }

    const coordinateCounts = new Map();
    summary.rankX.forEach((rankX, index) => {
        const key = `${rankX}|${summary.rankY[index]}`;
        coordinateCounts.set(key, (coordinateCounts.get(key) || 0) + 1);
    });
    const drawnCoordinates = new Set();
    summary.rankX.forEach((rankX, index) => {
        const rankY = summary.rankY[index];
        const key = `${rankX}|${rankY}`;
        const px = xScale(rankX);
        const py = yScale(rankY);
        const count = coordinateCounts.get(key);

        if (!drawnCoordinates.has(key)) {
            ctx.beginPath();
            ctx.fillStyle = COLORS.spearmanFill;
            ctx.strokeStyle = COLORS.spearman;
            ctx.lineWidth = 1.3;
            ctx.arc(px, py, count > 1 ? 5.5 : 4.3, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            if (count > 1) {
                ctx.fillStyle = textColor;
                ctx.font = "10px Arial";
                ctx.textAlign = "left";
                ctx.textBaseline = "bottom";
                ctx.fillText(`×${count}`, px + 6, py - 4);
            }
            drawnCoordinates.add(key);
        }

        if (document.getElementById("show-labels").checked) {
            ctx.fillStyle = textColor;
            ctx.font = "10px Arial";
            ctx.textAlign = "left";
            ctx.textBaseline = "top";
            ctx.fillText(String(index + 1), px + 5, py + 5 + (index % 2) * 9);
        }
    });
    ctx.restore();

    ctx.fillStyle = textColor;
    ctx.font = CHART.narrow ? "10px Arial" : "12px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    xTicks.forEach(value => ctx.fillText(formatTick(value), xScale(value), bottom + 8));
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    yTicks.forEach(value => ctx.fillText(formatTick(value), CHART.left - 8, yScale(value)));

    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(`Rank of x${tieNote}`, CHART.left + (right - CHART.left) / 2, bottom + (CHART.narrow ? 25 : 39));
    if (!CHART.narrow) {
        ctx.save();
        ctx.translate(18, top + CHART.rankHeight / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText("Rank of y", 0, 0);
        ctx.restore();
    }
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

let mathTypesetQueue = Promise.resolve();

function typesetMath(element) {
    if (!element || !window.MathJax || typeof window.MathJax.typesetPromise !== "function") return;
    mathTypesetQueue = mathTypesetQueue
        .catch(() => undefined)
        .then(() => {
            if (!element.isConnected) return undefined;
            if (typeof window.MathJax.typesetClear === "function") {
                window.MathJax.typesetClear([element]);
            }
            return window.MathJax.typesetPromise([element]);
        });
}

function relationshipDescription(summary) {
    if (!Number.isFinite(summary.r)) {
        return "Pearson correlation is undefined because at least one variable has zero standard deviation.";
    }
    const magnitude = Math.abs(summary.r);
    if (magnitude < 1e-10) {
        return "Pearson r is zero, so these points have no measured linear association. A nonlinear relationship may still exist.";
    }
    const direction = summary.r > 0 ? "positive" : summary.r < 0 ? "negative" : "no";
    let strength = "weak";
    if (magnitude >= 0.9) strength = "very strong";
    else if (magnitude >= 0.7) strength = "strong";
    else if (magnitude >= 0.4) strength = "moderate";
    return `For this dataset, r indicates a ${strength} ${direction} linear association. This describes association, not causation.`;
}

function selectedCorrelationMeasures() {
    return {
        spearman: Boolean(document.getElementById("measure-spearman")?.checked),
        kendall: Boolean(document.getElementById("measure-kendall")?.checked),
        distance: Boolean(document.getElementById("measure-distance")?.checked)
    };
}

function renderCalculations(summary, measures = selectedCorrelationMeasures()) {
    const container = document.getElementById("calculation-content");
    if (!container) return;
    if (!summary) {
        container.innerHTML = '<p class="calculation-empty">Enter at least three valid pairs to see the complete worked calculation.</p>';
        return;
    }

    const nMinusOne = summary.n - 1;
    const covarianceDirection = summary.cov > 1e-10
        ? "positive: same-side deviation products outweigh opposite-side products"
        : summary.cov < -1e-10
            ? "negative: opposite-side deviation products outweigh same-side products"
            : "zero: positive and negative deviation products cancel";
    const regressionFormula = summary.sumSquaresX === 0
        ? String.raw`\[\sum(x_i-\bar{x})^2=0\quad\Longrightarrow\quad b_1\text{ is undefined}\]
            \[\text{Displayed fallback: }\widehat{y}=\bar{y}=${latexNumber(summary.meanY)}\]`
        : String.raw`\[b_1=\frac{${latexNumber(summary.sumCrossProducts)}}{${latexNumber(summary.sumSquaresX)}}=${latexNumber(summary.slope)}\]
            \[b_0=${latexNumber(summary.meanY)}-${latexNumber(summary.slope)}(${latexNumber(summary.meanX)})=${latexNumber(summary.intercept)}\]
            \[\widehat{y}=${latexNumber(summary.intercept)}+${latexNumber(summary.slope)}x\]`;
    const regressionExplanation = summary.sumSquaresX === 0
        ? "All x values are identical, so there is no x variation from which to estimate a unique slope. The plot uses the mean of y as a clearly identified fallback."
        : "The slope uses the same cross-product sum divided by x's squared-deviation sum. The intercept makes the line pass through \\(\\bar{x},\\bar{y}\\).";
    const rankSumX = measures.spearman ? summary.rankX.reduce((sum, value) => sum + value, 0) : Number.NaN;
    const rankSumY = measures.spearman ? summary.rankY.reduce((sum, value) => sum + value, 0) : Number.NaN;
    const rankTieBadges = measures.spearman
        ? [
            ...summary.rankTiesX.map(group => `<span>x = ${formatDetailedNumber(group.value)} occurs ${group.count} times → average rank ${formatDetailedNumber(group.averageRank)}</span>`),
            ...summary.rankTiesY.map(group => `<span>y = ${formatDetailedNumber(group.value)} occurs ${group.count} times → average rank ${formatDetailedNumber(group.averageRank)}</span>`)
        ]
        : [];
    const rankTieSummary = rankTieBadges.length > 0
        ? `<div class="measure-counts rank-tie-counts">${rankTieBadges.join("")}</div>`
        : '<div class="measure-counts rank-tie-counts"><span>No ties: ranks are 1 through n in each variable</span></div>';
    const spearmanShortcutFormula = rankTieBadges.length > 0
        ? String.raw`\[\text{Ties are present, so do not use }1-\frac{6\sum d_i^2}{n(n^2-1)}.\]`
        : String.raw`\[d_i=R_{x,i}-R_{y,i},\qquad \sum_{i=1}^{n}d_i^2=${latexNumber(summary.sumRankDifferencesSquared)}\]
            \[\rho_s=1-\frac{6\sum_{i=1}^{n}d_i^2}{n(n^2-1)}
            =1-\frac{6(${latexNumber(summary.sumRankDifferencesSquared)})}{${summary.n}(${summary.n}^2-1)}=${latexNumber(summary.spearmanShortcut)}\]`;
    let nextStepNumber = 7;
    const optionalSteps = [];
    if (measures.spearman) {
        optionalSteps.push(String.raw`
            <article class="calculation-step optional-measure-step" data-measure="spearman">
                <span class="step-number">${nextStepNumber++}</span>
                <div>
                    <h3>Compute Spearman rank correlation</h3>
                    <p>Sort each variable independently. Assign rank 1 to its smallest value and rank n to its largest. If positions a through b are tied, every tied value receives the average rank \((a+b)/2\).</p>
                    ${rankTieSummary}
                    <div class="live-formula">
                        \[\bar R_x=\frac{\sum_{i=1}^{n}R_{x,i}}{n}=\frac{${latexNumber(rankSumX)}}{${summary.n}}=${latexNumber(summary.rankMeanX)},\qquad
                        \bar R_y=\frac{\sum_{i=1}^{n}R_{y,i}}{n}=\frac{${latexNumber(rankSumY)}}{${summary.n}}=${latexNumber(summary.rankMeanY)}\]
                        \[\widehat{\sigma}_{R_xR_y}=\frac{\sum_{i=1}^{n}(R_{x,i}-\bar R_x)(R_{y,i}-\bar R_y)}{n-1}
                        =\frac{${latexNumber(summary.sumRankCrossProducts)}}{${nMinusOne}}=${latexNumber(summary.rankCov)}\]
                        \[\widehat{\sigma}_{R_x}=\sqrt{\frac{\sum_{i=1}^{n}(R_{x,i}-\bar R_x)^2}{n-1}}
                        =\sqrt{\frac{${latexNumber(summary.sumRankSquaresX)}}{${nMinusOne}}}=${latexNumber(summary.rankStdX)}\]
                        \[\widehat{\sigma}_{R_y}=\sqrt{\frac{\sum_{i=1}^{n}(R_{y,i}-\bar R_y)^2}{n-1}}
                        =\sqrt{\frac{${latexNumber(summary.sumRankSquaresY)}}{${nMinusOne}}}=${latexNumber(summary.rankStdY)}\]
                        \[\rho_s=\frac{\widehat{\sigma}_{R_xR_y}}{\widehat{\sigma}_{R_x}\widehat{\sigma}_{R_y}}
                        =\frac{${latexNumber(summary.rankCov)}}{${latexNumber(summary.rankStdX)}\cdot ${latexNumber(summary.rankStdY)}}=${latexNumber(summary.spearman)}\]
                        \[\rho_s=\frac{\sum_{i=1}^{n}(R_{x,i}-\bar R_x)(R_{y,i}-\bar R_y)}
                        {\sqrt{\sum_{i=1}^{n}(R_{x,i}-\bar R_x)^2}\sqrt{\sum_{i=1}^{n}(R_{y,i}-\bar R_y)^2}}
                        =\frac{${latexNumber(summary.sumRankCrossProducts)}}{\sqrt{${latexNumber(summary.sumRankSquaresX)}}\sqrt{${latexNumber(summary.sumRankSquaresY)}}}=${latexNumber(summary.spearman)}\]
                    </div>
                    <p>Each \(n-1\) factor appears once in the rank covariance and under both rank-standard-deviation square roots, so those factors cancel in the final centered-sum formula. The expanded contribution table below shows every centered rank, rank product, and \(d_i^2\) term used in these sums.</p>
                    <p><strong>Shortcut check:</strong> the formula below is valid only when neither variable contains ties. The general average-rank calculation above is always the one used by this tool.</p>
                    <div class="live-formula spearman-shortcut-formula">
                        ${spearmanShortcutFormula}
                    </div>
                    <p class="result-meaning"><strong>Use it for:</strong> monotonic relationships where values generally move in one direction, even when the pattern is not a straight line.</p>
                </div>
            </article>`);
    }
    if (measures.kendall) {
        optionalSteps.push(String.raw`
            <article class="calculation-step optional-measure-step" data-measure="kendall">
                <span class="step-number">${nextStepNumber++}</span>
                <div>
                    <h3>Count pairs for Kendall τ<sub>b</sub></h3>
                    <p>Among ${summary.kendall.totalPairs} unordered pairs, count concordant, discordant, and tied comparisons.</p>
                    <div class="measure-counts">
                        <span>C = ${summary.kendall.concordant}</span><span>D = ${summary.kendall.discordant}</span>
                        <span>T<sub>x</sub> = ${summary.kendall.tiesX}</span><span>T<sub>y</sub> = ${summary.kendall.tiesY}</span>
                        <span>T<sub>both</sub> = ${summary.kendall.tiesBoth}</span>
                    </div>
                    <div class="live-formula">
                        \[\tau_b=\frac{C-D}{\sqrt{(C+D+T_x)(C+D+T_y)}}\]
                        \[\tau_b=\frac{${summary.kendall.concordant}-${summary.kendall.discordant}}{${latexNumber(summary.kendall.denominator)}}=${latexNumber(summary.kendall.value)}\]
                    </div>
                    <p class="result-meaning"><strong>Use it for:</strong> ordinal or small datasets, especially when pair ordering and ties should be explicit.</p>
                </div>
            </article>`);
    }
    if (measures.distance) {
        optionalSteps.push(String.raw`
            <article class="calculation-step optional-measure-step" data-measure="distance">
                <span class="step-number">${nextStepNumber++}</span>
                <div>
                    <h3>Double-center distances for distance correlation</h3>
                    <p>Form all ${summary.distance.nSquared} ordered pairwise distances, subtract row and column means, add the grand mean, and combine the centered matrices.</p>
                    <div class="live-formula">
                        \[\sum_{i,j}A_{ij}B_{ij}=${latexNumber(summary.distance.crossSum)},\quad \sum_{i,j}A_{ij}^2=${latexNumber(summary.distance.squareSumX)},\quad \sum_{i,j}B_{ij}^2=${latexNumber(summary.distance.squareSumY)}\]
                        \[\mathcal{V}_n^2(X,Y)=\frac{${latexNumber(summary.distance.crossSum)}}{${summary.distance.nSquared}}=${latexNumber(summary.distance.covarianceSquared)}\]
                        \[\mathcal{R}_n=\sqrt{\frac{${latexNumber(summary.distance.covarianceSquared)}}{\sqrt{${latexNumber(summary.distance.varianceXSquared)}\cdot ${latexNumber(summary.distance.varianceYSquared)}}}}=${latexNumber(summary.distance.value)}\]
                    </div>
                    <p class="result-meaning"><strong>Use it for:</strong> linear or nonlinear dependence. Distance correlation has magnitude only, so it does not report a positive or negative direction.</p>
                </div>
            </article>`);
    }
    const ellipseStepNumber = nextStepNumber;
    const rankHeaderCells = measures.spearman
        ? '<th scope="col">Rₓ</th><th scope="col">Rᵧ</th><th scope="col">Rₓ − R̄ₓ</th><th scope="col">Rᵧ − R̄ᵧ</th><th scope="col">Rank product</th><th scope="col">dᵢ²</th>'
        : "";
    const rankFooterCells = measures.spearman
        ? `<td>${formatDetailedNumber(rankSumX)}</td><td>${formatDetailedNumber(rankSumY)}</td><td>0</td><td>0</td><td>${formatDetailedNumber(summary.sumRankCrossProducts)}</td><td>${formatDetailedNumber(summary.sumRankDifferencesSquared)}</td>`
        : "";
    const contributionRows = summary.deviations.map((row, index) => `
        <tr>
            <th scope="row">${index + 1}</th>
            <td>${formatDetailedNumber(row.x)}</td>
            <td>${formatDetailedNumber(row.y)}</td>
            <td>${formatDetailedNumber(row.dx)}</td>
            <td>${formatDetailedNumber(row.dy)}</td>
            <td>${formatDetailedNumber(row.crossProduct)}</td>
            <td>${formatDetailedNumber(row.squareX)}</td>
            <td>${formatDetailedNumber(row.squareY)}</td>
            ${measures.spearman ? `<td>${formatDetailedNumber(summary.rankX[index])}</td><td>${formatDetailedNumber(summary.rankY[index])}</td><td>${formatDetailedNumber(summary.rankDeviations[index].dx)}</td><td>${formatDetailedNumber(summary.rankDeviations[index].dy)}</td><td>${formatDetailedNumber(summary.rankDeviations[index].crossProduct)}</td><td>${formatDetailedNumber(summary.rankDeviations[index].differenceSquared)}</td>` : ""}
            <td>${formatDetailedNumber(summary.fittedValues[index])}</td>
            <td>${formatDetailedNumber(summary.residuals[index])}</td>
        </tr>
    `).join("");

    container.innerHTML = String.raw`
        <div class="calculation-steps">
            <article class="calculation-step">
                <span class="step-number">1</span>
                <div>
                    <h3>Compute the means</h3>
                    <p>Add each column and divide by the number of pairs.</p>
                    <div class="live-formula">
                        \[\bar{x}=\frac{\sum x_i}{n}=\frac{${latexNumber(summary.sumX)}}{${summary.n}}=${latexNumber(summary.meanX)}\]
                        \[\bar{y}=\frac{\sum y_i}{n}=\frac{${latexNumber(summary.sumY)}}{${summary.n}}=${latexNumber(summary.meanY)}\]
                    </div>
                </div>
            </article>
            <article class="calculation-step">
                <span class="step-number">2</span>
                <div>
                    <h3>Build and average the cross-products</h3>
                    <p>Each row contributes \((x_i-\bar{x})(y_i-\bar{y})\). The contribution table shows every value used in this sum.</p>
                    <div class="live-formula">
                        \[\sum_{i=1}^{${summary.n}}(x_i-\bar{x})(y_i-\bar{y})=${latexNumber(summary.sumCrossProducts)}\]
                        \[\widehat{\sigma}_{xy}=\frac{${latexNumber(summary.sumCrossProducts)}}{${nMinusOne}}=${latexNumber(summary.cov)}\]
                    </div>
                    <p class="result-meaning"><strong>Meaning:</strong> The covariance is ${covarianceDirection}. Its units depend on the units of x and y.</p>
                </div>
            </article>
            <article class="calculation-step">
                <span class="step-number">3</span>
                <div>
                    <h3>Find each sample standard deviation</h3>
                    <p>Square each deviation, add the squares, divide by \(n-1\), then take the square root.</p>
                    <div class="live-formula">
                        \[\widehat{\sigma}_x^2=\frac{${latexNumber(summary.sumSquaresX)}}{${nMinusOne}}=${latexNumber(summary.varianceX)},\qquad \widehat{\sigma}_x=\sqrt{${latexNumber(summary.varianceX)}}=${latexNumber(summary.stdX)}\]
                        \[\widehat{\sigma}_y^2=\frac{${latexNumber(summary.sumSquaresY)}}{${nMinusOne}}=${latexNumber(summary.varianceY)},\qquad \widehat{\sigma}_y=\sqrt{${latexNumber(summary.varianceY)}}=${latexNumber(summary.stdY)}\]
                    </div>
                </div>
            </article>
            <article class="calculation-step">
                <span class="step-number">4</span>
                <div>
                    <h3>Standardize covariance to get Pearson r</h3>
                    <p>The direct-sum form below avoids rounding the covariance and standard deviations before division.</p>
                    <div class="live-formula">
                        \[r=\frac{${latexNumber(summary.sumCrossProducts)}}{\sqrt{${latexNumber(summary.sumSquaresX)}\cdot ${latexNumber(summary.sumSquaresY)}}}=${latexNumber(summary.r)}\]
                    </div>
                    <p class="result-meaning"><strong>Interpretation:</strong> ${relationshipDescription(summary)}</p>
                </div>
            </article>
            <article class="calculation-step">
                <span class="step-number">5</span>
                <div>
                    <h3>Fit the least-squares line</h3>
                    <p>${regressionExplanation}</p>
                    <div class="live-formula">
                        ${regressionFormula}
                    </div>
                </div>
            </article>
            <article class="calculation-step">
                <span class="step-number">6</span>
                <div>
                    <h3>Measure residual error and explained variation</h3>
                    <p>For every point, subtract its fitted value from its observed y. Squaring prevents positive and negative residuals from cancelling.</p>
                    <div class="live-formula">
                        \[\mathrm{SSE}=\sum e_i^2=${latexNumber(summary.sse)},\qquad \mathrm{SST}=\sum(y_i-\bar{y})^2=${latexNumber(summary.sst)}\]
                        \[R^2=1-\frac{${latexNumber(summary.sse)}}{${latexNumber(summary.sst)}}=${latexNumber(summary.r2)}\]
                    </div>
                </div>
            </article>
            ${optionalSteps.join("")}
            <article class="calculation-step">
                <span class="step-number">${ellipseStepNumber}</span>
                <div>
                    <h3>Turn the covariance matrix into the plotted ellipse</h3>
                    <p>The covariance matrix stores x variance, y variance, and their covariance. Its eigenvalues give the principal variances; the plot uses twice their square roots as the two semi-axis lengths.</p>
                    <div class="live-formula">
                        \[\widehat{\boldsymbol{\Sigma}}=\begin{bmatrix}\widehat{\sigma}_x^2&\widehat{\sigma}_{xy}\\\widehat{\sigma}_{xy}&\widehat{\sigma}_y^2\end{bmatrix}=\begin{bmatrix}${latexNumber(summary.varianceX)}&${latexNumber(summary.cov)}\\${latexNumber(summary.cov)}&${latexNumber(summary.varianceY)}\end{bmatrix}\]
                        \[\lambda_1=${latexNumber(summary.ellipse.lambda1)},\qquad \lambda_2=${latexNumber(summary.ellipse.lambda2)},\qquad \theta=${latexNumber(summary.ellipse.angleDegrees)}^{\circ}\]
                        \[a=2\sqrt{\lambda_1}=${latexNumber(summary.ellipse.radius1)},\qquad b=2\sqrt{\lambda_2}=${latexNumber(summary.ellipse.radius2)}\]
                    </div>
                    <p class="result-meaning"><strong>Important:</strong> This is a two-standard-deviation shape ellipse. It visualizes spread and orientation; it is not automatically a 95% confidence region.</p>
                </div>
            </article>
        </div>
        <details class="contribution-details" ${summary.n <= 24 ? "open" : ""}>
            <summary>Inspect all ${summary.n} point contributions</summary>
            <p>These are the actual intermediate values used above. Scroll horizontally on a small screen.</p>
            <div class="calculation-table-wrap">
                <table class="calculation-table${measures.spearman ? " with-ranks" : ""}">
                    <thead>
                        <tr>
                            <th scope="col">i</th><th scope="col">xᵢ</th><th scope="col">yᵢ</th>
                            <th scope="col">xᵢ − x̄</th><th scope="col">yᵢ − ȳ</th><th scope="col">deviation product</th>
                            <th scope="col">x deviation²</th><th scope="col">y deviation²</th>
                            ${rankHeaderCells}<th scope="col">ŷᵢ</th><th scope="col">eᵢ</th>
                        </tr>
                    </thead>
                    <tbody>${contributionRows}</tbody>
                    <tfoot>
                        <tr>
                            <th scope="row">Sum</th><td>${formatDetailedNumber(summary.sumX)}</td><td>${formatDetailedNumber(summary.sumY)}</td>
                            <td>0</td><td>0</td><td>${formatDetailedNumber(summary.sumCrossProducts)}</td>
                            <td>${formatDetailedNumber(summary.sumSquaresX)}</td><td>${formatDetailedNumber(summary.sumSquaresY)}</td>
                            ${rankFooterCells}
                            <td>—</td><td>${formatDetailedNumber(summary.residuals.reduce((sum, value) => sum + value, 0))}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </details>
    `;
    typesetMath(container);
}

function renderStats(summary, measures = selectedCorrelationMeasures()) {
    const grid = document.getElementById("stats-grid");
    renderCalculations(summary, measures);
    if (!summary) {
        grid.innerHTML = "";
        return;
    }

    const optionalResults = [
        measures.spearman ? { name: "Spearman ρₛ", value: summary.spearman, note: "monotonic rank association" } : null,
        measures.kendall ? { name: "Kendall τᵦ", value: summary.kendall.value, note: "concordant versus discordant pairs" } : null,
        measures.distance ? { name: "Distance ℛ", value: summary.distance.value, note: "general dependence magnitude" } : null
    ].filter(Boolean);
    const optionalCard = optionalResults.length === 0 ? "" : `
        <article class="stat-card wide-stat optional-results-card">
            <h3>Selected additional measures</h3>
            <div class="optional-results-grid">
                ${optionalResults.map(result => `
                    <div><span>${result.name}</span><strong>${formatNumber(result.value)}</strong><small>${result.note}</small></div>
                `).join("")}
            </div>
        </article>`;

    grid.innerHTML = `
        <article class="stat-card">
            <h3>Linear relationship</h3>
            <table class="stat-table">
                <tbody>
                    <tr><th>n</th><td>${summary.n}</td><th>Pearson r</th><td>${formatNumber(summary.r)}</td></tr>
                    <tr><th>R²</th><td>${formatNumber(summary.r2)}</td><th>SSE</th><td>${formatNumber(summary.sse)}</td></tr>
                    <tr><th>Slope</th><td>${formatNumber(summary.slope)}</td><th>Intercept</th><td>${formatNumber(summary.intercept)}</td></tr>
                </tbody>
            </table>
        </article>
        <article class="stat-card">
            <h3>Centers and spread</h3>
            <table class="stat-table">
                <tbody>
                    <tr><th>Mean x</th><td>${formatNumber(summary.meanX)}</td><th>Mean y</th><td>${formatNumber(summary.meanY)}</td></tr>
                    <tr><th>Sample σ̂ₓ</th><td>${formatNumber(summary.stdX)}</td><th>Sample σ̂ᵧ</th><td>${formatNumber(summary.stdY)}</td></tr>
                    <tr><th>Sample σ̂ₓᵧ</th><td>${formatNumber(summary.cov)}</td><th>Residual std</th><td>${formatNumber(summary.residualStd)}</td></tr>
                </tbody>
            </table>
        </article>
        ${optionalCard}
        <article class="stat-card wide-stat">
            <h3>Sample covariance matrix Σ̂</h3>
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

function renderLegend(measures = selectedCorrelationMeasures()) {
    const legend = document.getElementById("plot-legend");
    const spearmanItem = measures.spearman
        ? '<span class="legend-item"><span class="legend-line spearman-line"></span>Rank fit (Spearman panel)</span>'
        : "";
    legend.innerHTML = `
        <span class="legend-item"><span class="legend-swatch point-swatch"></span>Data point</span>
        <span class="legend-item"><span class="legend-line regression-line"></span>Least-squares line</span>
        <span class="legend-item"><span class="legend-line mean-line"></span>Mean x and mean y</span>
        <span class="legend-item"><span class="legend-line ellipse-line"></span>Covariance ellipse</span>
        <span class="legend-item"><span class="legend-swatch positive-swatch"></span>Positive covariance quadrant</span>
        <span class="legend-item"><span class="legend-swatch negative-swatch"></span>Negative covariance quadrant</span>
        ${spearmanItem}
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

window.CovarianceLabDebug = {
    summarize,
    scatterDomain,
    createLinearScale
};

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
