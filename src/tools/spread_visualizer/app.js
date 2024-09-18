function gaussian(x, mean, std) {
    return (1 / (std * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * Math.pow((x - mean) / std, 2));
}

function draw() {
    var canvas = document.getElementById('canvas');
    var ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    var mean1 = parseFloat(document.getElementById('mean1').value);
    var std1 = parseFloat(document.getElementById('std1').value);
    var mean2 = parseFloat(document.getElementById('mean2').value);
    var std2 = parseFloat(document.getElementById('std2').value);

    var curve1Area = calculateArea(mean1, std1);
    var curve2Area = calculateArea(mean2, std2);

    drawAxis(ctx, canvas.width, canvas.height);
    drawBellCurve(ctx, mean1, std1, 'blue', 'cyan', canvas.width, canvas.height, 'Curve 1: μ=' + mean1 + ', σ=' + std1 + ' Area=' + curve1Area.toFixed(2));
    drawBellCurve(ctx, mean2, std2, 'red', 'magenta', canvas.width, canvas.height, 'Curve 2: μ=' + mean2 + ', σ=' + std2 + ' Area=' + curve2Area.toFixed(2));
    displaySummary(mean1, std1, mean2, std2, curve1Area, curve2Area);
}

function drawAxis(ctx, canvasWidth, canvasHeight) {
    const axisCenterY = canvasHeight * 0.95;
    const range = 20;
    const scale = canvasWidth / (2 * range);
    const axisColor = getColorForMode('black', 'white');
    const textColor = getColorForMode('black', 'white');
    const tickInterval = Math.floor(range / 2);

    ctx.beginPath();
    ctx.strokeStyle = axisColor;
    ctx.moveTo(0, axisCenterY);
    ctx.lineTo(canvasWidth, axisCenterY);
    ctx.stroke();

    ctx.fillStyle = textColor;
    for (let i = -range; i <= range; i++) {
        const x = i * scale + canvasWidth / 2;
        if (i % tickInterval === 0) {
            ctx.fillText(i.toString(), x, axisCenterY + 20);
        }
        ctx.beginPath();
        ctx.moveTo(x, axisCenterY - 5);
        ctx.lineTo(x, axisCenterY + 5);
        ctx.stroke();
    }
}

function drawBellCurve(ctx, mean, std, colorLight, colorDark, canvasWidth, canvasHeight, label) {
    const range = 20;
    const xScale = canvasWidth / (2 * range);
    const yScale = 5000;
    const yOffset = canvasHeight * 0.95;
    const curveColor = getColorForMode(colorLight, colorDark);

    ctx.beginPath();
    ctx.strokeStyle = curveColor;
    let maxVal = -Infinity;
    for (let x = -3 * std + mean; x <= 3 * std + mean; x += 0.01) {
        let plotX = x * xScale + (canvasWidth / 2);
        let plotY = yOffset - gaussian(x, mean, std) * yScale;
        maxVal = Math.max(maxVal, plotY);
        ctx.lineTo(plotX, plotY);
    }
    ctx.stroke();

    ctx.beginPath();
    ctx.setLineDash([5, 3]);
    ctx.strokeStyle = curveColor;
    ctx.moveTo(canvasWidth / 2, maxVal);
    ctx.lineTo(canvasWidth / 2, yOffset);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = curveColor;
    ctx.fillText(label, canvasWidth / 2 - 100, yOffset - 40);
}

function calculateArea(mean, std) {
    let totalArea = 0;
    const step = 0.01;
    for (let x = -3 * std + mean; x <= 3 * std + mean; x += step) {
        totalArea += gaussian(x, mean, std) * step;
    }
    return totalArea;
}

function displaySummary(mean1, std1, mean2, std2, area1, area2) {
    const summary = document.getElementById('summary');
    summary.innerHTML = `
        <p>Curve 1: μ=${mean1}, σ=${std1}, Area=${area1.toFixed(2)}</p>
        <p>Curve 2: μ=${mean2}, σ=${std2}, Area=${area2.toFixed(2)}</p>
        <p>Difference in Areas: ${(Math.abs(area1 - area2)).toFixed(2)}</p>
        <p>Overlap: ${(calculateOverlap(mean1, std1, mean2, std2)).toFixed(2)}%</p>
    `;
}

function calculateOverlap(mean1, std1, mean2, std2) {
    const range = 20;
    let overlapArea = 0;
    const step = 0.01;
    for (let x = -range; x <= range; x += step) {
        const y1 = gaussian(x, mean1, std1);
        const y2 = gaussian(x, mean2, std2);
        overlapArea += Math.min(y1, y2) * step;
    }
    return overlapArea * 100;
}

function getColorForMode(lightModeColor, darkModeColor) {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
        ? darkModeColor
        : lightModeColor;
}

function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    draw();
}

document.addEventListener('DOMContentLoaded', function () {
    var drawButton = document.querySelector('.draw-button');
    if (drawButton) {
        drawButton.addEventListener('click', draw);
    }

    var toggleButton = document.querySelector('.toggle-dark-mode');
    if (toggleButton) {
        toggleButton.addEventListener('click', toggleDarkMode);
    }

    draw();
});

window.onresize = draw;
