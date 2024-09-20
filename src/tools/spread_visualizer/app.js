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

    if (isNaN(mean1) || isNaN(std1) || isNaN(mean2) || isNaN(std2)) {
        return; // Avoid drawing if any of the inputs are invalid.
    }

    const xRange = calculateXRange([mean1, mean2], [std1, std2]);
    const curve1Area = calculateArea(mean1, std1);
    const curve2Area = calculateArea(mean2, std2);

    drawAxis(ctx, canvas.width, canvas.height, xRange);
    drawBellCurve(ctx, mean1, std1, 'blue', 'cyan', canvas.width, canvas.height, xRange);
    drawBellCurve(ctx, mean2, std2, 'red', 'magenta', canvas.width, canvas.height, xRange);
    drawLegendOnCanvas(ctx, canvas.width, canvas.height, mean1, std1, curve1Area, mean2, std2, curve2Area);
}

function drawAxis(ctx, canvasWidth, canvasHeight, xRange) {
    const axisCenterY = canvasHeight * 0.95;
    const scale = canvasWidth / (xRange.max - xRange.min);
    const axisColor = getColorForMode('black', 'white');
    const textColor = getColorForMode('black', 'white');
    const tickInterval = Math.floor((xRange.max - xRange.min) / 10);

    ctx.beginPath();
    ctx.strokeStyle = axisColor;
    ctx.moveTo(0, axisCenterY);
    ctx.lineTo(canvasWidth, axisCenterY);
    ctx.stroke();

    ctx.fillStyle = textColor;
    for (let i = Math.floor(xRange.min); i <= Math.ceil(xRange.max); i += tickInterval) {
        const x = (i - xRange.min) * scale;
        ctx.fillText(i.toString(), x, axisCenterY + 20);
        ctx.beginPath();
        ctx.moveTo(x, axisCenterY - 5);
        ctx.lineTo(x, axisCenterY + 5);
        ctx.stroke();
    }
}

function drawBellCurve(ctx, mean, std, colorLight, colorDark, canvasWidth, canvasHeight, xRange) {
    const axisCenterY = canvasHeight / 2;
    const xScale = canvasWidth / (xRange.max - xRange.min);
    const yScale = 5000;
    const yOffset = canvasHeight * 0.95;
    const curveColor = getColorForMode(colorLight, colorDark);

    ctx.beginPath();
    ctx.strokeStyle = curveColor;
    for (let x = -3 * std + mean; x <= 3 * std + mean; x += 0.01) {
        let plotX = (x - xRange.min) * xScale;
        let plotY = yOffset - gaussian(x, mean, std) * yScale;
        ctx.lineTo(plotX, plotY);
    }
    ctx.stroke();
}

function drawLegendOnCanvas(ctx, canvasWidth, canvasHeight, mean1, std1, area1, mean2, std2, area2) {
    const legendX = canvasWidth - 200;
    const legendY = 30;
    const boxWidth = 180;
    const boxHeight = 60;
    const textColor = getColorForMode('black', 'white');

    ctx.fillStyle = getColorForMode('#f0f0f0', '#333');
    ctx.fillRect(legendX, legendY, boxWidth, boxHeight);

    ctx.strokeStyle = textColor;
    ctx.strokeRect(legendX, legendY, boxWidth, boxHeight);

    ctx.fillStyle = textColor;
    ctx.font = '12px Arial';
    ctx.fillText(`Curve 1: μ=${mean1}, σ=${std1}, Area=${area1.toFixed(2)}`, legendX + 10, legendY + 20);
    ctx.fillStyle = getColorForMode('blue', 'cyan');
    ctx.fillText(`Curve 2: μ=${mean2}, σ=${std2}, Area=${area2.toFixed(2)}`, legendX + 10, legendY + 40);
}

function calculateArea(mean, std) {
    let totalArea = 0;
    const step = 0.01;
    for (let x = -3 * std + mean; x <= 3 * std + mean; x += step) {
        totalArea += gaussian(x, mean, std) * step;
    }
    return totalArea;
}

function calculateXRange(means, stds) {
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < means.length; i++) {
        min = Math.min(min, means[i] - 3 * stds[i]);
        max = Math.max(max, means[i] + 3 * stds[i]);
    }
    return {
        min,
        max
    };
}

function getColorForMode(colorLight, colorDark) {
    const darkModeValue = getCookie("darkMode");
    return darkModeValue && darkModeValue.toLowerCase() === "true" ? colorDark : colorLight;
}

function getCookie(name) {
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
        let [key, value] = cookie.trim().split('=');
        if (key === name) return value;
    }
    return null;
}

function toggleDarkMode() {
    const darkModeValue = getCookie("darkMode");
    const newMode = darkModeValue === "true" ? "false" : "true";
    document.cookie = `darkMode=${newMode}; path=/;`;
    draw();
}

document.addEventListener('DOMContentLoaded', function() {
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