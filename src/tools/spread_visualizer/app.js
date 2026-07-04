const DATASETS = {
    "same-center-different-spread": {
        a: [42, 44, 45, 46, 48, 49, 50, 51, 52, 54, 55, 56, 58],
        b: [30, 34, 38, 42, 46, 49, 50, 51, 54, 58, 62, 66, 70],
        note: "Both groups have similar centers, but B has a much larger standard deviation and wider box plot."
    },
    "same-mean-different-median": {
        a: [35, 42, 45, 47, 49, 50, 51, 53, 55, 58, 65],
        b: [30, 32, 34, 36, 38, 40, 42, 44, 46, 104, 104],
        note: "These sets can have similar means while the medians sit in very different places."
    },
    "outlier-effect": {
        a: [45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55],
        b: [45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 95],
        note: "One high outlier pulls the mean and standard deviation upward, while the median and IQR move less."
    },
    "skewed-vs-symmetric": {
        a: [34, 38, 42, 46, 48, 50, 52, 54, 58, 62, 66],
        b: [30, 33, 35, 36, 38, 40, 42, 47, 55, 68, 86],
        note: "A symmetric set keeps mean and median close. A right-skewed set pulls the mean to the right."
    },
    "same-iqr-different-range": {
        a: [38, 42, 44, 46, 48, 50, 52, 54, 56, 58, 62],
        b: [12, 42, 44, 46, 48, 50, 52, 54, 56, 58, 88],
        note: "The middle 50% can be almost identical even when the full range is very different."
    }
};

const SERIES = [
    { key: "a", label: "Dataset A", color: "#2563eb", fill: "rgba(37, 99, 235, 0.14)" },
    { key: "b", label: "Dataset B", color: "#e11d48", fill: "rgba(225, 29, 72, 0.12)" }
];

const CHART = {
    left: 92,
    right: 30,
    top: 44,
    plotHeight: 220,
    spreadTop: 0,
    boxTop: 330,
    dotTop: 560,
    dotHeight: 84,
    bottom: 40,
    narrow: false
};

let activeMessage = "";

function mean(values) {
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(sortedValues) {
    const midpoint = Math.floor(sortedValues.length / 2);
    if (sortedValues.length % 2 === 0) {
        return (sortedValues[midpoint - 1] + sortedValues[midpoint]) / 2;
    }
    return sortedValues[midpoint];
}

function sampleStd(values, avg) {
    if (values.length < 2) return 0;
    const variance = values.reduce((sum, value) => sum + Math.pow(value - avg, 2), 0) / (values.length - 1);
    return Math.sqrt(variance);
}

function gaussian(x, avg, std) {
    if (std <= 0) return 0;
    return (1 / (std * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * Math.pow((x - avg) / std, 2));
}

function quantile(sortedValues, p) {
    if (sortedValues.length === 1) return sortedValues[0];
    const index = (sortedValues.length - 1) * p;
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;
    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

function summarize(values) {
    const sorted = values.slice().sort((a, b) => a - b);
    const avg = mean(sorted);
    const std = sampleStd(sorted, avg);
    const q1 = quantile(sorted, 0.25);
    const med = quantile(sorted, 0.5);
    const q3 = quantile(sorted, 0.75);
    const iqr = q3 - q1;
    const lowFence = q1 - 1.5 * iqr;
    const highFence = q3 + 1.5 * iqr;
    const nonOutliers = sorted.filter(value => value >= lowFence && value <= highFence);

    return {
        values,
        sorted,
        n: sorted.length,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        mean: avg,
        std,
        q1,
        median: med,
        q3,
        iqr,
        lowFence,
        highFence,
        lowerWhisker: nonOutliers.length ? nonOutliers[0] : sorted[0],
        upperWhisker: nonOutliers.length ? nonOutliers[nonOutliers.length - 1] : sorted[sorted.length - 1],
        outliers: sorted.filter(value => value < lowFence || value > highFence)
    };
}

function visibleSeries() {
    return SERIES.filter(series => {
        const checkbox = document.getElementById(`show-dataset-${series.key}`);
        return !checkbox || checkbox.checked;
    });
}

function parseValues(raw) {
    return raw
        .split(/[\s,;]+/)
        .map(value => value.trim())
        .filter(Boolean)
        .map(Number)
        .filter(Number.isFinite);
}

function formatValues(values) {
    return values.join(", ");
}

function formatNumber(value) {
    if (!Number.isFinite(value)) return "-";
    return Math.abs(value) >= 100 ? value.toFixed(1) : value.toFixed(2);
}

function formatOutliers(values) {
    if (!values.length) return "None";
    return values.map(formatNumber).join(", ");
}

function randomNormal() {
    const u1 = Math.max(Math.random(), Number.EPSILON);
    const u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function clampNumber(value, min, max, fallback) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
}

function generateDataset(shape, count, center, spread, outlierCount) {
    const values = [];
    const baseCount = shape === "outlier" ? Math.max(2, count - outlierCount) : count;

    for (let i = 0; i < baseCount; i++) {
        let value;
        if (shape === "uniform") {
            value = center + (Math.random() * 2 - 1) * spread;
        } else if (shape === "right-skewed") {
            value = center - spread * 0.6 + Math.pow(Math.random(), 2) * spread * 2.2;
        } else if (shape === "left-skewed") {
            value = center + spread * 0.6 - Math.pow(Math.random(), 2) * spread * 2.2;
        } else if (shape === "bimodal") {
            const side = i % 2 === 0 ? -1 : 1;
            value = center + side * spread * 0.75 + randomNormal() * spread * 0.22;
        } else {
            value = center + randomNormal() * spread * 0.35;
        }
        values.push(value);
    }

    if (shape === "outlier") {
        for (let i = 0; i < outlierCount; i++) {
            const side = i % 2 === 0 ? 1 : -1;
            values.push(center + side * spread * (2.2 + Math.random() * 1.3));
        }
    }

    return values
        .slice(0, count)
        .sort((a, b) => a - b)
        .map(value => Math.round(value * 10) / 10);
}

function generateFromControls() {
    const target = document.getElementById("generate-target").value;
    const shape = document.getElementById("generate-shape").value;
    const count = Math.round(clampNumber(document.getElementById("generate-count").value, 3, 80, 15));
    const center = clampNumber(document.getElementById("generate-center").value, -200, 200, 50);
    const spread = clampNumber(document.getElementById("generate-spread").value, 1, 80, 10);
    const outliers = Math.round(clampNumber(document.getElementById("generate-outliers").value, 0, 6, 1));
    const values = generateDataset(shape, count, center, spread, outliers);
    const textarea = document.getElementById(`dataset-${target}`);

    textarea.value = formatValues(values);
    document.getElementById(`show-dataset-${target}`).checked = true;
    activeMessage = `Generated ${shape.replace("-", " ")} values for Dataset ${target.toUpperCase()}.`;
    draw();
}

function configureChart(width, activeCount, showIqr, showStd, showPoints) {
    const narrow = width < 560;
    const showSpread = showIqr || showStd;
    const top = narrow ? 38 : 44;
    const plotHeight = narrow ? 168 : 220;
    const left = narrow ? 58 : 92;
    const right = narrow ? 14 : 30;
    const distributionBottom = top + plotHeight;
    const spreadTop = distributionBottom + (narrow ? 56 : 64);
    const spreadRows = showStd ? (showIqr ? 2 : 1) : (showIqr ? 1 : 0);
    const spreadRowGap = narrow ? 17 : 19;
    const spreadHeight = showSpread ? 34 + activeCount * (spreadRows * spreadRowGap + (narrow ? 22 : 28)) : 0;
    const boxTop = showSpread ? spreadTop + spreadHeight + (narrow ? 26 : 34) : distributionBottom + (narrow ? 78 : 92);
    const boxRowGap = narrow ? 66 : 76;
    const boxSectionHeight = 48 + activeCount * boxRowGap;
    const dotTop = boxTop + boxSectionHeight + (narrow ? 40 : 48);
    const dotHeight = showPoints ? 18 + activeCount * (narrow ? 30 : 34) : 0;
    const bottom = narrow ? 30 : 40;
    const height = showPoints ? dotTop + dotHeight + bottom : boxTop + boxSectionHeight + bottom;

    Object.assign(CHART, {
        left,
        right,
        top,
        plotHeight,
        spreadTop,
        boxTop,
        dotTop,
        dotHeight,
        bottom,
        narrow
    });

    return Math.ceil(height);
}

function resizeCanvas(activeCount, showIqr, showStd, showPoints) {
    const canvas = document.getElementById("canvas");
    const container = canvas.parentElement;
    const width = Math.max(320, Math.min(container.clientWidth, 860));
    const height = configureChart(width, activeCount, showIqr, showStd, showPoints);
    const dpr = window.devicePixelRatio || 1;

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { width, height };
}

function getColor(light, dark) {
    const darkModeValue = getCookie("darkMode");
    return darkModeValue && darkModeValue.toLowerCase() === "true" ? dark : light;
}

function draw() {
    const canvas = document.getElementById("canvas");
    const valuesA = parseValues(document.getElementById("dataset-a").value);
    const valuesB = parseValues(document.getElementById("dataset-b").value);
    const message = document.getElementById("input-message");
    const activeSeries = visibleSeries();
    const showIqr = document.getElementById("show-iqr").checked;
    const showStd = document.getElementById("show-std").checked;
    const showPoints = document.getElementById("show-points").checked;
    const dimensions = resizeCanvas(Math.max(1, activeSeries.length), showIqr, showStd, showPoints);
    const ctx = canvas.getContext("2d");
    const activeValues = {
        a: valuesA,
        b: valuesB
    };

    ctx.clearRect(0, 0, dimensions.width, dimensions.height);

    if (activeSeries.length === 0) {
        message.textContent = "Choose at least one dataset to display.";
        message.classList.add("error");
        drawMessage(ctx, dimensions, "Choose at least one dataset to display.");
        renderStats({});
        renderLegend([], false, false, false);
        return;
    }

    const invalidSeries = activeSeries.find(series => activeValues[series.key].length < 2);
    if (invalidSeries) {
        message.textContent = `${invalidSeries.label} needs at least two numeric values.`;
        message.classList.add("error");
        drawMessage(ctx, dimensions, `${invalidSeries.label} needs at least two numeric values.`);
        renderStats({});
        renderLegend([], false, false, false);
        return;
    }

    const summaries = {
        a: valuesA.length >= 2 ? summarize(valuesA) : null,
        b: valuesB.length >= 2 ? summarize(valuesB) : null
    };

    message.textContent = currentPresetNote();
    message.classList.remove("error");
    drawVisualization(ctx, dimensions, summaries, activeSeries);
    renderStats(summaries, activeSeries);
}

function drawVisualization(ctx, dimensions, summaries, activeSeries) {
    const showNormal = document.getElementById("show-normal").checked;
    const showPoints = document.getElementById("show-points").checked;
    const showIqr = document.getElementById("show-iqr").checked;
    const showStd = document.getElementById("show-std").checked;
    const allValues = activeSeries.flatMap(series => {
        const summary = summaries[series.key];
        const sigmaValues = showStd ? [summary.mean - 3 * summary.std, summary.mean + 3 * summary.std] : [];
        return summary.values.concat(sigmaValues);
    });
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    const spread = Math.max(max - min, 1);
    const xRange = {
        min: min - spread * 0.09,
        max: max + spread * 0.09
    };
    const x = value => CHART.left + ((value - xRange.min) / (xRange.max - xRange.min)) * (dimensions.width - CHART.left - CHART.right);
    const densityMax = Math.max(
        ...activeSeries.map(series => histogram(summaries[series.key].values, xRange).maxDensity),
        ...activeSeries.map(series => summaries[series.key].std > 0 ? gaussian(summaries[series.key].mean, summaries[series.key].mean, summaries[series.key].std) : 0)
    ) * 1.2 || 1;
    const y = density => CHART.top + CHART.plotHeight - (density / densityMax) * CHART.plotHeight;

    drawBackground(ctx, dimensions);
    drawAxes(ctx, dimensions, xRange, densityMax, x);
    drawSectionLabel(ctx, CHART.narrow ? "Distribution" : "Distribution with mean and median markers", CHART.left, CHART.top - 16);

    activeSeries.forEach(series => {
        const summary = summaries[series.key];
        const hist = histogram(summary.values, xRange);
        drawHistogram(ctx, hist, series, x, y, CHART.top + CHART.plotHeight);
        if (showNormal && summary.std > 0) drawNormalCurve(ctx, summary, series, xRange, x, y);
        drawVerticalMarker(ctx, x(summary.mean), CHART.top, CHART.top + CHART.plotHeight, series.color, false);
        drawVerticalMarker(ctx, x(summary.median), CHART.top, CHART.top + CHART.plotHeight, getColor("#111827", "#f8fafc"), true);
    });

    if (showIqr || showStd) drawSpreadArrows(ctx, dimensions, summaries, x, activeSeries, showIqr, showStd);
    drawBoxPlotArea(ctx, dimensions, summaries, x, activeSeries);
    if (showPoints) drawDotPlotArea(ctx, dimensions, summaries, x, activeSeries);
    renderLegend(activeSeries, showStd, showIqr, showNormal);
}

function drawBackground(ctx, dimensions) {
    ctx.fillStyle = getColor("#fbfcfe", "#171717");
    ctx.fillRect(0, 0, dimensions.width, dimensions.height);
    ctx.strokeStyle = getColor("#e3e8ef", "#333333");
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, dimensions.width - 1, dimensions.height - 1);
}

function drawAxes(ctx, dimensions, xRange, densityMax, x) {
    const axisColor = getColor("#667085", "#cbd5e1");
    const gridColor = getColor("rgba(148, 163, 184, 0.24)", "rgba(148, 163, 184, 0.18)");
    const textColor = getColor("#536174", "#cbd5e1");
    const bottom = CHART.top + CHART.plotHeight;
    const plotRight = dimensions.width - CHART.right;
    const tickStep = niceStep((xRange.max - xRange.min) / (CHART.narrow ? 4 : 8));
    const yTickCount = CHART.narrow ? 3 : 4;
    const gridBottom = dimensions.height - CHART.bottom;

    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    for (let value = Math.ceil(xRange.min / tickStep) * tickStep; value <= xRange.max; value += tickStep) {
        const px = x(value);
        ctx.beginPath();
        ctx.moveTo(px, CHART.top);
        ctx.lineTo(px, gridBottom);
        ctx.stroke();
    }

    for (let i = 0; i <= yTickCount; i++) {
        const py = CHART.top + CHART.plotHeight - (i / yTickCount) * CHART.plotHeight;
        ctx.beginPath();
        ctx.moveTo(CHART.left, py);
        ctx.lineTo(plotRight, py);
        ctx.stroke();
    }

    ctx.strokeStyle = axisColor;
    ctx.beginPath();
    ctx.moveTo(CHART.left, bottom);
    ctx.lineTo(plotRight, bottom);
    ctx.moveTo(CHART.left, CHART.top);
    ctx.lineTo(CHART.left, bottom);
    ctx.stroke();

    ctx.fillStyle = textColor;
    ctx.font = "12px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (let value = Math.ceil(xRange.min / tickStep) * tickStep; value <= xRange.max; value += tickStep) {
        ctx.fillText(formatTick(value), x(value), bottom + 9);
    }

    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let i = 0; i <= yTickCount; i++) {
        const density = (densityMax / 1.2) * (i / yTickCount);
        const py = CHART.top + CHART.plotHeight - (i / yTickCount) * CHART.plotHeight;
        ctx.fillText(CHART.narrow ? density.toFixed(1) : density.toFixed(2), CHART.left - 8, py);
    }

    if (!CHART.narrow) {
        ctx.save();
        ctx.translate(18, CHART.top + CHART.plotHeight / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = "center";
        ctx.fillText("Relative frequency / density", 0, 0);
        ctx.restore();
    }
}

function histogram(values, xRange) {
    const binCount = Math.max(6, Math.min(12, Math.ceil(Math.sqrt(values.length) + 3)));
    const binWidth = (xRange.max - xRange.min) / binCount;
    const bins = Array.from({ length: binCount }, (_, index) => ({
        start: xRange.min + index * binWidth,
        end: xRange.min + (index + 1) * binWidth,
        count: 0,
        density: 0
    }));

    values.forEach(value => {
        const index = Math.min(binCount - 1, Math.max(0, Math.floor((value - xRange.min) / binWidth)));
        bins[index].count += 1;
    });

    let maxDensity = 0;
    bins.forEach(bin => {
        bin.density = bin.count / values.length / binWidth;
        maxDensity = Math.max(maxDensity, bin.density);
    });

    return { bins, maxDensity };
}

function drawHistogram(ctx, hist, series, x, y, baseline) {
    ctx.fillStyle = series.fill;
    ctx.strokeStyle = series.color;
    ctx.lineWidth = 1.25;
    hist.bins.forEach(bin => {
        const left = x(bin.start);
        const right = x(bin.end);
        const top = y(bin.density);
        if (bin.count === 0) return;
        ctx.fillRect(left + 1, top, Math.max(1, right - left - 2), baseline - top);
        ctx.strokeRect(left + 1, top, Math.max(1, right - left - 2), baseline - top);
    });
}

function drawNormalCurve(ctx, summary, series, xRange, x, y) {
    ctx.beginPath();
    ctx.strokeStyle = series.color;
    ctx.lineWidth = 2.25;
    const steps = 220;
    for (let i = 0; i <= steps; i++) {
        const value = xRange.min + (i / steps) * (xRange.max - xRange.min);
        const px = x(value);
        const py = y(gaussian(value, summary.mean, summary.std));
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.lineWidth = 1;
}

function drawVerticalMarker(ctx, px, top, bottom, color, dashed) {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = dashed ? 1.4 : 1.2;
    ctx.setLineDash(dashed ? [4, 5] : []);
    ctx.beginPath();
    ctx.moveTo(px, top);
    ctx.lineTo(px, bottom);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = 1;
}

function drawSpreadArrows(ctx, dimensions, summaries, x, activeSeries, showIqr, showStd) {
    drawDivider(ctx, dimensions, CHART.spreadTop - 24);
    drawSectionLabel(ctx, "Spread intervals", CHART.left, CHART.spreadTop - 38);

    if (!showIqr && !showStd) {
        const muted = getColor("#64748b", "#94a3b8");
        ctx.fillStyle = muted;
        ctx.font = "12px Arial";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText("Turn on IQR arrow or Sigma arrows to compare spread lengths.", CHART.left, CHART.spreadTop + 18);
        return;
    }

    activeSeries.forEach((series, seriesIndex) => {
        const summary = summaries[series.key];
        const rowGap = CHART.narrow ? 17 : 19;
        const rows = showStd ? (showIqr ? 2 : 1) : 1;
        const seriesGap = rows * rowGap + (CHART.narrow ? 22 : 28);
        const baseY = CHART.spreadTop + 10 + seriesIndex * seriesGap;

        ctx.fillStyle = getColor("#475467", "#dbe4ef");
        ctx.font = CHART.narrow ? "11px Arial" : "12px Arial";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillText(series.key.toUpperCase(), CHART.left - 10, baseY + (showStd ? rowGap * 1.5 : 0));

        if (showIqr) {
            drawDoubleArrow(ctx, x(summary.q1), x(summary.q3), baseY, series.color, `IQR ${formatNumber(summary.iqr)}`);
        }

        if (showStd) {
            const firstSigmaY = showIqr ? baseY + rowGap + 6 : baseY;
            drawDoubleArrow(
                ctx,
                x(summary.mean - summary.std),
                x(summary.mean + summary.std),
                firstSigmaY,
                series.color,
                CHART.narrow ? "+/-1σ" : "mean +/- 1σ",
                true,
                0.82
            );
        }
    });
}

function drawDoubleArrow(ctx, left, right, y, color, label, dashed, alpha) {
    const start = Math.min(left, right);
    const end = Math.max(left, right);
    const head = CHART.narrow ? 5 : 7;
    const span = end - start;

    ctx.save();
    ctx.globalAlpha = alpha || 1;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = dashed ? 1.4 : 2;
    if (dashed) ctx.setLineDash([5, 6]);

    ctx.beginPath();
    ctx.moveTo(start, y);
    ctx.lineTo(end, y);
    ctx.stroke();
    ctx.setLineDash([]);

    drawArrowHead(ctx, start, y, 1, head);
    drawArrowHead(ctx, end, y, -1, head);

    ctx.font = CHART.narrow ? "10px Arial" : "12px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    if (span > (CHART.narrow ? 36 : 52)) ctx.fillText(label, (start + end) / 2, y - 5);
    ctx.restore();
}

function drawArrowHead(ctx, xPos, yPos, direction, size) {
    ctx.beginPath();
    ctx.moveTo(xPos, yPos);
    ctx.lineTo(xPos + direction * size, yPos - size * 0.55);
    ctx.lineTo(xPos + direction * size, yPos + size * 0.55);
    ctx.closePath();
    ctx.fill();
}

function drawBoxPlotArea(ctx, dimensions, summaries, x, activeSeries) {
    const textColor = getColor("#475467", "#dbe4ef");
    drawDivider(ctx, dimensions, CHART.boxTop - 24);
    drawSectionLabel(ctx, CHART.narrow ? "Tukey box plots" : "Tukey box plots: whiskers exclude outliers", CHART.left, CHART.boxTop - 38);

    activeSeries.forEach((series, index) => {
        const summary = summaries[series.key];
        const yCenter = CHART.boxTop + 38 + index * (CHART.narrow ? 66 : 76);
        const boxHeight = CHART.narrow ? 22 : 26;

        ctx.strokeStyle = series.color;
        ctx.fillStyle = series.fill;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x(summary.lowerWhisker), yCenter);
        ctx.lineTo(x(summary.q1), yCenter);
        ctx.moveTo(x(summary.q3), yCenter);
        ctx.lineTo(x(summary.upperWhisker), yCenter);
        ctx.stroke();

        ctx.fillRect(x(summary.q1), yCenter - boxHeight / 2, Math.max(1, x(summary.q3) - x(summary.q1)), boxHeight);
        ctx.strokeRect(x(summary.q1), yCenter - boxHeight / 2, Math.max(1, x(summary.q3) - x(summary.q1)), boxHeight);

        drawCap(ctx, x(summary.lowerWhisker), yCenter, boxHeight);
        drawCap(ctx, x(summary.upperWhisker), yCenter, boxHeight);

        ctx.strokeStyle = getColor("#111827", "#f8fafc");
        ctx.beginPath();
        ctx.moveTo(x(summary.median), yCenter - boxHeight / 2 - 4);
        ctx.lineTo(x(summary.median), yCenter + boxHeight / 2 + 4);
        ctx.stroke();

        drawBoxLabels(ctx, summary, series, x, yCenter, boxHeight, dimensions, index);

        ctx.fillStyle = series.color;
        summary.outliers.forEach(value => drawCircle(ctx, x(value), yCenter, 4, false));

        ctx.fillStyle = textColor;
        ctx.font = CHART.narrow ? "11px Arial" : "12px Arial";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillText(CHART.narrow ? series.key.toUpperCase() : series.label, CHART.left - 10, yCenter);

    });
}

function drawBoxLabels(ctx, summary, series, x, yCenter, boxHeight, dimensions, seriesIndex) {
    const labelColor = getColor("#344054", "#e5e7eb");
    const guideColor = getColor("rgba(71, 84, 103, 0.28)", "rgba(226, 232, 240, 0.35)");
    const labelOffset = CHART.narrow ? 17 : 20;
    const labelDirection = seriesIndex % 2 === 0 ? -1 : 1;
    const labelY = yCenter + labelDirection * (boxHeight / 2 + labelOffset);
    const guideEndY = yCenter + labelDirection * (boxHeight / 2 + 5);
    const labels = [
        { text: "Q1", value: summary.q1, y: labelY },
        { text: "Med", value: summary.median, y: labelY, color: series.color },
        { text: "Q3", value: summary.q3, y: labelY }
    ];

    ctx.font = CHART.narrow ? "10px Arial" : "12px Arial";
    const placedByRow = {};
    labels.forEach(item => {
        const minLabelSpacing = CHART.narrow ? 18 : 24;
        let px = Math.max(CHART.left + 12, Math.min(dimensions.width - CHART.right - 12, x(item.value)));
        const rowKey = String(Math.round(item.y));
        const previousX = placedByRow[rowKey];
        if (Number.isFinite(previousX) && Math.abs(px - previousX) < minLabelSpacing) {
            px += px >= previousX ? minLabelSpacing / 2 : -minLabelSpacing / 2;
            px = Math.max(CHART.left + 12, Math.min(dimensions.width - CHART.right - 12, px));
        }
        placedByRow[rowKey] = px;

        ctx.strokeStyle = guideColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px, yCenter + labelDirection * boxHeight / 2);
        ctx.lineTo(px, guideEndY);
        ctx.stroke();

        ctx.fillStyle = item.color || labelColor;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(item.text, px, item.y);
    });
}

function drawDotPlotArea(ctx, dimensions, summaries, x, activeSeries) {
    const textColor = getColor("#475467", "#dbe4ef");
    drawDivider(ctx, dimensions, CHART.dotTop - 24);
    drawSectionLabel(ctx, "Dot plots", CHART.left, CHART.dotTop - 38);

    activeSeries.forEach((series, index) => {
        const yCenter = CHART.dotTop + 20 + index * (CHART.narrow ? 30 : 34);
        const counts = {};
        summaries[series.key].sorted.forEach(value => {
            const bucket = value.toFixed(2);
            counts[bucket] = (counts[bucket] || 0) + 1;
            drawCircle(ctx, x(value), yCenter - (counts[bucket] - 1) * (CHART.narrow ? 6 : 7), CHART.narrow ? 3.5 : 4, true, series.color);
        });

        ctx.fillStyle = textColor;
        ctx.font = CHART.narrow ? "11px Arial" : "12px Arial";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillText(CHART.narrow ? series.key.toUpperCase() : series.label, CHART.left - 10, yCenter);
    });
}

function drawCap(ctx, xPos, yCenter, height) {
    ctx.beginPath();
    ctx.moveTo(xPos, yCenter - height / 2);
    ctx.lineTo(xPos, yCenter + height / 2);
    ctx.stroke();
}

function drawCircle(ctx, xPos, yPos, radius, filled, color) {
    ctx.beginPath();
    ctx.arc(xPos, yPos, radius, 0, Math.PI * 2);
    ctx.strokeStyle = color || ctx.fillStyle;
    ctx.fillStyle = color || ctx.fillStyle;
    if (filled) ctx.fill();
    else ctx.stroke();
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

function renderLegend(activeSeries, showStd, showIqr, showNormal) {
    const legend = document.getElementById("plot-legend");
    if (!legend) return;

    const datasetItems = activeSeries.map(series => `
        <span class="legend-item">
            <span class="legend-swatch" style="background:${series.color}"></span>
            ${series.label}
        </span>
    `).join("");
    const stdItem = showStd ? '<span class="legend-item"><span class="legend-line std-line"></span>Std interval: mean +/- 1σ</span>' : "";
    const iqrItem = showIqr ? '<span class="legend-item"><span class="legend-line iqr-line"></span>IQR arrow: Q1 to Q3</span>' : "";
    const normalItem = showNormal ? '<span class="legend-item"><span class="legend-line normal-line"></span>Normal curve fit</span>' : "";

    legend.innerHTML = `
        ${datasetItems}
        <span class="legend-item"><span class="legend-line mean-line"></span>Mean</span>
        <span class="legend-item"><span class="legend-line median-line"></span>Q2 median</span>
        ${stdItem}
        ${iqrItem}
        ${normalItem}
    `;
}

function renderStats(summaries, activeSeries) {
    const grid = document.getElementById("stats-grid");
    if (!activeSeries || activeSeries.length === 0) {
        grid.innerHTML = "";
        return;
    }

    grid.innerHTML = activeSeries.map(series => {
        const s = summaries[series.key];
        return `
            <article class="stat-card">
                <h3><span class="stat-swatch" style="background:${series.color}"></span>${series.label}</h3>
                <table class="stat-table">
                    <tbody>
                        <tr><th>n</th><td>${s.n}</td><th>Range</th><td>${formatNumber(s.max - s.min)}</td></tr>
                        <tr><th>Min</th><td>${formatNumber(s.min)}</td><th>Max</th><td>${formatNumber(s.max)}</td></tr>
                        <tr><th>Mean</th><td>${formatNumber(s.mean)}</td><th>σ</th><td>${formatNumber(s.std)}</td></tr>
                        <tr><th>Q1</th><td>${formatNumber(s.q1)}</td><th>Q2 median</th><td>${formatNumber(s.median)}</td></tr>
                        <tr><th>Q3</th><td>${formatNumber(s.q3)}</td><th>IQR</th><td>${formatNumber(s.iqr)}</td></tr>
                        <tr><th>Whisker low</th><td>${formatNumber(s.lowerWhisker)}</td><th>Whisker high</th><td>${formatNumber(s.upperWhisker)}</td></tr>
                        <tr><th>Outliers</th><td class="outlier-cell" colspan="3">${formatOutliers(s.outliers)}</td></tr>
                    </tbody>
                </table>
            </article>
        `;
    }).join("");
}

function niceStep(rawStep) {
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const normalized = rawStep / magnitude;
    if (normalized <= 1) return magnitude;
    if (normalized <= 2) return 2 * magnitude;
    if (normalized <= 5) return 5 * magnitude;
    return 10 * magnitude;
}

function formatTick(value) {
    if (Math.abs(value) >= 10) return value.toFixed(0);
    return value.toFixed(1);
}

function currentPresetNote() {
    if (activeMessage) return activeMessage;
    const preset = document.getElementById("preset-select").value;
    return DATASETS[preset] ? DATASETS[preset].note : "Enter numbers separated by commas, spaces, or new lines.";
}

function applyPreset(key) {
    const preset = DATASETS[key];
    if (!preset) return;
    document.getElementById("dataset-a").value = formatValues(preset.a);
    document.getElementById("dataset-b").value = formatValues(preset.b);
    activeMessage = "";
    draw();
}

function getCookie(name) {
    const cookies = document.cookie.split(";");
    for (let cookie of cookies) {
        let [key, value] = cookie.trim().split("=");
        if (key === name) return value;
    }
    return null;
}

document.addEventListener("DOMContentLoaded", function() {
    const drawButton = document.querySelector(".draw-button");
    const generateButton = document.getElementById("generate-button");
    const presetSelect = document.getElementById("preset-select");
    const inputs = document.querySelectorAll("textarea, input[type='checkbox']");
    const toggleButton = document.querySelector(".toggle-dark-mode, #dark-mode-button");

    if (drawButton) {
        drawButton.addEventListener("click", draw);
    }

    if (generateButton) {
        generateButton.addEventListener("click", generateFromControls);
    }

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
