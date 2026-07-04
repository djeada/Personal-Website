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
    { key: "a", label: "Dataset A", color: "#2563eb", fill: "rgba(37, 99, 235, 0.16)" },
    { key: "b", label: "Dataset B", color: "#dc2626", fill: "rgba(220, 38, 38, 0.14)" }
];

const CHART = {
    left: 58,
    right: 24,
    top: 28,
    plotHeight: 300,
    boxTop: 378,
    boxHeight: 128,
    dotTop: 542,
    dotHeight: 86,
    bottom: 54
};

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

function resizeCanvas() {
    const canvas = document.getElementById("canvas");
    const container = canvas.parentElement;
    const width = Math.max(320, Math.min(container.clientWidth, 820));
    const height = width < 560 ? 660 : 680;
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
    const dimensions = resizeCanvas();
    const ctx = canvas.getContext("2d");
    const valuesA = parseValues(document.getElementById("dataset-a").value);
    const valuesB = parseValues(document.getElementById("dataset-b").value);
    const message = document.getElementById("input-message");

    ctx.clearRect(0, 0, dimensions.width, dimensions.height);

    if (valuesA.length < 2 || valuesB.length < 2) {
        message.textContent = "Each dataset needs at least two numeric values.";
        message.classList.add("error");
        drawMessage(ctx, dimensions, "Each dataset needs at least two numeric values.");
        return;
    }

    const summaries = {
        a: summarize(valuesA),
        b: summarize(valuesB)
    };

    message.textContent = currentPresetNote();
    message.classList.remove("error");
    drawVisualization(ctx, dimensions, summaries);
    renderStats(summaries);
}

function drawVisualization(ctx, dimensions, summaries) {
    const allValues = SERIES.flatMap(series => summaries[series.key].values);
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    const spread = Math.max(max - min, 1);
    const xRange = {
        min: min - spread * 0.09,
        max: max + spread * 0.09
    };
    const x = value => CHART.left + ((value - xRange.min) / (xRange.max - xRange.min)) * (dimensions.width - CHART.left - CHART.right);
    const showNormal = document.getElementById("show-normal").checked;
    const showPoints = document.getElementById("show-points").checked;
    const showIqr = document.getElementById("show-iqr").checked;
    const densityMax = Math.max(
        ...SERIES.map(series => histogram(summaries[series.key].values, xRange).maxDensity),
        ...SERIES.map(series => summaries[series.key].std > 0 ? gaussian(summaries[series.key].mean, summaries[series.key].mean, summaries[series.key].std) : 0)
    ) * 1.2 || 1;
    const y = density => CHART.top + CHART.plotHeight - (density / densityMax) * CHART.plotHeight;

    drawBackground(ctx, dimensions);
    drawAxes(ctx, dimensions, xRange, densityMax, x);
    drawSectionLabel(ctx, "Distribution, mean, median, quartiles, and IQR", CHART.left, 18);

    SERIES.forEach(series => {
        const summary = summaries[series.key];
        const hist = histogram(summary.values, xRange);
        drawHistogram(ctx, hist, series, x, y, CHART.top + CHART.plotHeight);
        if (showIqr) drawIqrBand(ctx, summary, series, x);
        if (showNormal && summary.std > 0) drawNormalCurve(ctx, summary, series, xRange, x, y);
        drawVerticalMarker(ctx, x(summary.mean), CHART.top, CHART.top + CHART.plotHeight, series.color, `mean ${formatNumber(summary.mean)}`, 0);
        drawVerticalMarker(ctx, x(summary.median), CHART.top, CHART.top + CHART.plotHeight, getColor("#111827", "#f8fafc"), `median ${formatNumber(summary.median)}`, 16);
    });

    drawLegend(ctx, dimensions);
    drawBoxPlotArea(ctx, dimensions, summaries, x);
    if (showPoints) drawDotPlotArea(ctx, dimensions, summaries, x);
}

function drawBackground(ctx, dimensions) {
    ctx.fillStyle = getColor("#fbfcfe", "#171717");
    ctx.fillRect(0, 0, dimensions.width, dimensions.height);
    ctx.strokeStyle = getColor("#d7dde5", "#3b3b3b");
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, dimensions.width - 1, dimensions.height - 1);
}

function drawAxes(ctx, dimensions, xRange, densityMax, x) {
    const axisColor = getColor("#1f2937", "#e5e7eb");
    const gridColor = getColor("rgba(148, 163, 184, 0.32)", "rgba(148, 163, 184, 0.22)");
    const textColor = getColor("#475569", "#cbd5e1");
    const bottom = CHART.top + CHART.plotHeight;
    const plotRight = dimensions.width - CHART.right;
    const tickStep = niceStep((xRange.max - xRange.min) / 8);

    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    for (let value = Math.ceil(xRange.min / tickStep) * tickStep; value <= xRange.max; value += tickStep) {
        const px = x(value);
        ctx.beginPath();
        ctx.moveTo(px, CHART.top);
        ctx.lineTo(px, CHART.dotTop + CHART.dotHeight);
        ctx.stroke();
    }

    for (let i = 0; i <= 4; i++) {
        const py = CHART.top + CHART.plotHeight - (i / 4) * CHART.plotHeight;
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
        ctx.fillText(formatTick(value), x(value), bottom + 8);
    }

    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let i = 0; i <= 4; i++) {
        const density = (densityMax / 1.2) * (i / 4);
        const py = CHART.top + CHART.plotHeight - (i / 4) * CHART.plotHeight;
        ctx.fillText(density.toFixed(2), CHART.left - 8, py);
    }

    ctx.save();
    ctx.translate(15, CHART.top + CHART.plotHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.fillText("Relative frequency / density", 0, 0);
    ctx.restore();
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
    ctx.lineWidth = 1;
    hist.bins.forEach(bin => {
        const left = x(bin.start);
        const right = x(bin.end);
        const top = y(bin.density);
        if (bin.count === 0) return;
        ctx.fillRect(left + 1, top, Math.max(1, right - left - 2), baseline - top);
        ctx.strokeRect(left + 1, top, Math.max(1, right - left - 2), baseline - top);
    });
}

function drawIqrBand(ctx, summary, series, x) {
    const left = x(summary.q1);
    const right = x(summary.q3);
    ctx.fillStyle = series.fill;
    ctx.fillRect(left, CHART.top, Math.max(1, right - left), CHART.plotHeight);
    ctx.strokeStyle = series.color;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(left, CHART.top, Math.max(1, right - left), CHART.plotHeight);
    ctx.setLineDash([]);
}

function drawNormalCurve(ctx, summary, series, xRange, x, y) {
    ctx.beginPath();
    ctx.strokeStyle = series.color;
    ctx.lineWidth = 2.5;
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

function drawVerticalMarker(ctx, px, top, bottom, color, label, labelOffset) {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.setLineDash(labelOffset ? [3, 4] : [6, 4]);
    ctx.beginPath();
    ctx.moveTo(px, top);
    ctx.lineTo(px, bottom);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.save();
    ctx.translate(px + 4 + labelOffset, top + 6);
    ctx.rotate(-Math.PI / 2);
    ctx.font = "11px Arial";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(label, 0, 0);
    ctx.restore();
}

function drawBoxPlotArea(ctx, dimensions, summaries, x) {
    const textColor = getColor("#334155", "#dbe4ef");
    drawDivider(ctx, dimensions, CHART.boxTop - 24);
    drawSectionLabel(ctx, "Box plots: Q1, median, Q3, IQR, whiskers, and outliers", CHART.left, CHART.boxTop - 34);

    SERIES.forEach((series, index) => {
        const summary = summaries[series.key];
        const yCenter = CHART.boxTop + 36 + index * 50;
        const boxHeight = 24;

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

        ctx.fillStyle = series.color;
        summary.outliers.forEach(value => drawCircle(ctx, x(value), yCenter, 4, false));

        ctx.fillStyle = textColor;
        ctx.font = "12px Arial";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillText(series.label, CHART.left - 10, yCenter);

        ctx.textAlign = "left";
        ctx.fillText(`IQR = ${formatNumber(summary.iqr)}`, x(summary.q3) + 8, yCenter);
    });
}

function drawDotPlotArea(ctx, dimensions, summaries, x) {
    const textColor = getColor("#334155", "#dbe4ef");
    drawDivider(ctx, dimensions, CHART.dotTop - 24);
    drawSectionLabel(ctx, "Dot plots: every value in the datasets", CHART.left, CHART.dotTop - 34);

    SERIES.forEach((series, index) => {
        const yCenter = CHART.dotTop + 24 + index * 34;
        const counts = {};
        summaries[series.key].sorted.forEach(value => {
            const bucket = value.toFixed(2);
            counts[bucket] = (counts[bucket] || 0) + 1;
            drawCircle(ctx, x(value), yCenter - (counts[bucket] - 1) * 7, 4, true, series.color);
        });

        ctx.fillStyle = textColor;
        ctx.font = "12px Arial";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillText(series.label, CHART.left - 10, yCenter);
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
    ctx.strokeStyle = getColor("#d7dde5", "#3b3b3b");
    ctx.beginPath();
    ctx.moveTo(CHART.left, y);
    ctx.lineTo(dimensions.width - CHART.right, y);
    ctx.stroke();
}

function drawSectionLabel(ctx, label, x, y) {
    ctx.fillStyle = getColor("#1f2937", "#e5e7eb");
    ctx.font = "13px Arial";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(label, x, y);
}

function drawLegend(ctx, dimensions) {
    const xStart = dimensions.width - 210;
    const yStart = 24;
    const textColor = getColor("#1f2937", "#e5e7eb");
    ctx.fillStyle = getColor("rgba(255,255,255,0.88)", "rgba(31,31,31,0.88)");
    ctx.strokeStyle = getColor("#d7dde5", "#555");
    ctx.fillRect(xStart, yStart, 178, 72);
    ctx.strokeRect(xStart, yStart, 178, 72);

    SERIES.forEach((series, index) => {
        const y = yStart + 20 + index * 24;
        ctx.fillStyle = series.color;
        ctx.fillRect(xStart + 12, y - 9, 12, 12);
        ctx.fillStyle = textColor;
        ctx.font = "12px Arial";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(series.label, xStart + 32, y - 3);
    });

    ctx.strokeStyle = textColor;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(xStart + 12, yStart + 58);
    ctx.lineTo(xStart + 24, yStart + 58);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = textColor;
    ctx.fillText("Median marker", xStart + 32, yStart + 58);
}

function drawMessage(ctx, dimensions, message) {
    ctx.fillStyle = getColor("#333", "#eee");
    ctx.font = "16px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(message, dimensions.width / 2, dimensions.height / 2);
}

function renderStats(summaries) {
    const grid = document.getElementById("stats-grid");
    grid.innerHTML = SERIES.map(series => {
        const s = summaries[series.key];
        return `
            <article class="stat-card">
                <h3><span class="stat-swatch" style="background:${series.color}"></span>${series.label}</h3>
                <table class="stat-table">
                    <tbody>
                        <tr><th>n</th><td>${s.n}</td><th>Range</th><td>${formatNumber(s.max - s.min)}</td></tr>
                        <tr><th>Mean</th><td>${formatNumber(s.mean)}</td><th>Std dev</th><td>${formatNumber(s.std)}</td></tr>
                        <tr><th>Q1</th><td>${formatNumber(s.q1)}</td><th>Median</th><td>${formatNumber(s.median)}</td></tr>
                        <tr><th>Q3</th><td>${formatNumber(s.q3)}</td><th>IQR</th><td>${formatNumber(s.iqr)}</td></tr>
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
    const preset = document.getElementById("preset-select").value;
    return DATASETS[preset] ? DATASETS[preset].note : "Enter numbers separated by commas, spaces, or new lines.";
}

function applyPreset(key) {
    const preset = DATASETS[key];
    if (!preset) return;
    document.getElementById("dataset-a").value = formatValues(preset.a);
    document.getElementById("dataset-b").value = formatValues(preset.b);
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
    const presetSelect = document.getElementById("preset-select");
    const inputs = document.querySelectorAll("textarea, input[type='checkbox']");
    const toggleButton = document.querySelector(".toggle-dark-mode, #dark-mode-button");

    if (drawButton) {
        drawButton.addEventListener("click", draw);
    }

    if (presetSelect) {
        presetSelect.addEventListener("change", function() {
            applyPreset(presetSelect.value);
        });
    }

    inputs.forEach(function(input) {
        input.addEventListener("input", function() {
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
