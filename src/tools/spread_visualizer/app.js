function gaussian(x, mean, std) {
    return (1 / (std * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * Math.pow((x - mean) / std, 2));
}

function resizeCanvas() {
    var canvas = document.getElementById('canvas');
    var container = canvas.parentElement;
    
    // Get the container width and set responsive dimensions
    var containerWidth = container.clientWidth;
    var canvasWidth = Math.min(containerWidth - 20, 800); // Max 800px, with padding
    var canvasHeight = Math.min(Math.floor(canvasWidth * 0.75), 600); // 3:4 aspect ratio, max 600px
    
    // Set canvas size accounting for device pixel ratio for crisp rendering
    var dpr = window.devicePixelRatio || 1;
    canvas.width = canvasWidth * dpr;
    canvas.height = canvasHeight * dpr;
    canvas.style.width = canvasWidth + 'px';
    canvas.style.height = canvasHeight + 'px';
    
    // Scale the context to match device pixel ratio
    var ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    
    return { width: canvasWidth, height: canvasHeight };
}

function draw() {
    var canvas = document.getElementById('canvas');
    var dimensions = resizeCanvas();
    var ctx = canvas.getContext('2d');
    
    var mean1 = parseFloat(document.getElementById('mean1').value);
    var std1 = parseFloat(document.getElementById('std1').value);
    var mean2 = parseFloat(document.getElementById('mean2').value);
    var std2 = parseFloat(document.getElementById('std2').value);

    // Validate inputs
    if (isNaN(mean1) || isNaN(std1) || isNaN(mean2) || isNaN(std2)) {
        ctx.fillStyle = getColorForMode('#333', '#eee');
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Please enter valid numbers for all fields', dimensions.width / 2, dimensions.height / 2);
        return;
    }
    
    // Ensure standard deviations are positive
    if (std1 <= 0 || std2 <= 0) {
        ctx.fillStyle = getColorForMode('#d32f2f', '#ff5252');
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Standard deviation must be greater than 0', dimensions.width / 2, dimensions.height / 2);
        return;
    }

    const xRange = calculateXRange([mean1, mean2], [std1, std2]);
    const curve1Area = calculateArea(mean1, std1);
    const curve2Area = calculateArea(mean2, std2);

    // Calculate max Y value for scaling
    const maxY = Math.max(gaussian(mean1, mean1, std1), gaussian(mean2, mean2, std2));

    ctx.textAlign = 'left'; // Reset text alignment
    drawGrid(ctx, dimensions.width, dimensions.height, xRange, maxY);
    drawAxis(ctx, dimensions.width, dimensions.height, xRange, maxY);
    drawBellCurve(ctx, mean1, std1, 'blue', 'cyan', dimensions.width, dimensions.height, xRange);
    drawBellCurve(ctx, mean2, std2, 'red', 'magenta', dimensions.width, dimensions.height, xRange);
    drawMeanMarkers(ctx, mean1, mean2, dimensions.width, dimensions.height, xRange);
    drawLegendOnCanvas(ctx, dimensions.width, dimensions.height, mean1, std1, curve1Area, mean2, std2, curve2Area);
}

function drawGrid(ctx, canvasWidth, canvasHeight, xRange, maxY) {
    const axisCenterY = canvasHeight * 0.95;
    const scale = canvasWidth / (xRange.max - xRange.min);
    const gridColor = getColorForMode('rgba(200, 200, 200, 0.3)', 'rgba(100, 100, 100, 0.3)');
    const tickInterval = Math.max(1, Math.floor((xRange.max - xRange.min) / 10));

    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 0.5;

    // Vertical grid lines
    for (let i = Math.floor(xRange.min); i <= Math.ceil(xRange.max); i += tickInterval) {
        const x = (i - xRange.min) * scale;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, axisCenterY);
        ctx.stroke();
    }

    // Horizontal grid lines
    const yScale = (canvasHeight * 0.90) / maxY;
    const yTickInterval = maxY / 5;
    for (let i = 0; i <= 5; i++) {
        const y = axisCenterY - (i * yTickInterval * yScale * 5000);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvasWidth, y);
        ctx.stroke();
    }
    
    ctx.lineWidth = 1;
}

function drawAxis(ctx, canvasWidth, canvasHeight, xRange, maxY) {
    const axisCenterY = canvasHeight * 0.95;
    const leftMargin = 50;
    const scale = (canvasWidth - leftMargin) / (xRange.max - xRange.min);
    const axisColor = getColorForMode('black', 'white');
    const textColor = getColorForMode('black', 'white');
    const tickInterval = Math.max(1, Math.floor((xRange.max - xRange.min) / 10));

    // X-axis
    ctx.beginPath();
    ctx.strokeStyle = axisColor;
    ctx.lineWidth = 2;
    ctx.moveTo(leftMargin, axisCenterY);
    ctx.lineTo(canvasWidth, axisCenterY);
    ctx.stroke();

    // Y-axis
    ctx.beginPath();
    ctx.moveTo(leftMargin, 0);
    ctx.lineTo(leftMargin, axisCenterY);
    ctx.stroke();

    ctx.fillStyle = textColor;
    ctx.font = '12px Arial';
    
    // X-axis labels
    for (let i = Math.floor(xRange.min); i <= Math.ceil(xRange.max); i += tickInterval) {
        const x = leftMargin + (i - xRange.min) * scale;
        ctx.fillText(i.toString(), x - 10, axisCenterY + 20);
        ctx.beginPath();
        ctx.moveTo(x, axisCenterY - 5);
        ctx.lineTo(x, axisCenterY + 5);
        ctx.stroke();
    }
    
    // Y-axis labels
    const yScale = (canvasHeight * 0.90) / maxY;
    const yTickInterval = maxY / 5;
    for (let i = 0; i <= 5; i++) {
        const yValue = (i * yTickInterval).toFixed(2);
        const y = axisCenterY - (i * yTickInterval * yScale * 5000);
        ctx.fillText(yValue, 5, y + 5);
        ctx.beginPath();
        ctx.moveTo(leftMargin - 5, y);
        ctx.lineTo(leftMargin + 5, y);
        ctx.stroke();
    }
    
    // Axis labels
    ctx.font = '14px Arial';
    ctx.fillText('x', canvasWidth - 20, axisCenterY + 20);
    ctx.save();
    ctx.translate(15, canvasHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Probability Density', 0, 0);
    ctx.restore();
    
    ctx.lineWidth = 1;
}

function drawBellCurve(ctx, mean, std, colorLight, colorDark, canvasWidth, canvasHeight, xRange) {
    const leftMargin = 50;
    const axisCenterY = canvasHeight / 2;
    const xScale = (canvasWidth - leftMargin) / (xRange.max - xRange.min);
    const yScale = 5000;
    const yOffset = canvasHeight * 0.95;
    const curveColor = getColorForMode(colorLight, colorDark);

    ctx.beginPath();
    ctx.strokeStyle = curveColor;
    ctx.lineWidth = 2;
    for (let x = -3 * std + mean; x <= 3 * std + mean; x += 0.01) {
        let plotX = leftMargin + (x - xRange.min) * xScale;
        let plotY = yOffset - gaussian(x, mean, std) * yScale;
        ctx.lineTo(plotX, plotY);
    }
    ctx.stroke();
    ctx.lineWidth = 1;
}

function drawMeanMarkers(ctx, mean1, mean2, canvasWidth, canvasHeight, xRange) {
    const leftMargin = 50;
    const axisCenterY = canvasHeight * 0.95;
    const xScale = (canvasWidth - leftMargin) / (xRange.max - xRange.min);
    
    ctx.save();
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 1.5;
    
    // Mean 1 marker
    const x1 = leftMargin + (mean1 - xRange.min) * xScale;
    ctx.strokeStyle = getColorForMode('blue', 'cyan');
    ctx.beginPath();
    ctx.moveTo(x1, 0);
    ctx.lineTo(x1, axisCenterY);
    ctx.stroke();
    
    // Mean 2 marker
    const x2 = leftMargin + (mean2 - xRange.min) * xScale;
    ctx.strokeStyle = getColorForMode('red', 'magenta');
    ctx.beginPath();
    ctx.moveTo(x2, 0);
    ctx.lineTo(x2, axisCenterY);
    ctx.stroke();
    
    ctx.restore();
}

function drawLegendOnCanvas(ctx, canvasWidth, canvasHeight, mean1, std1, area1, mean2, std2, area2) {
    const legendX = canvasWidth - 250;
    const legendY = 30;
    const boxWidth = 230;
    const boxHeight = 80;
    const textColor = getColorForMode('black', 'white');

    ctx.fillStyle = getColorForMode('#f0f0f0', '#333');
    ctx.fillRect(legendX, legendY, boxWidth, boxHeight);

    ctx.strokeStyle = textColor;
    ctx.strokeRect(legendX, legendY, boxWidth, boxHeight);

    ctx.font = '12px Arial';
    
    // Curve 1 with color indicator
    ctx.fillStyle = getColorForMode('blue', 'cyan');
    ctx.fillRect(legendX + 10, legendY + 15, 15, 15);
    ctx.fillStyle = textColor;
    ctx.fillText(`Curve 1: μ=${mean1}, σ=${std1}`, legendX + 30, legendY + 27);
    ctx.fillText(`Area=${area1.toFixed(2)}`, legendX + 30, legendY + 40);
    
    // Curve 2 with color indicator
    ctx.fillStyle = getColorForMode('red', 'magenta');
    ctx.fillRect(legendX + 10, legendY + 50, 15, 15);
    ctx.fillStyle = textColor;
    ctx.fillText(`Curve 2: μ=${mean2}, σ=${std2}`, legendX + 30, legendY + 62);
    ctx.fillText(`Area=${area2.toFixed(2)}`, legendX + 30, legendY + 75);
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

    // Add real-time update listeners to all inputs
    var inputs = document.querySelectorAll('input[type="number"]');
    inputs.forEach(function(input) {
        input.addEventListener('input', function() {
            // Debounce the draw call for smoother performance
            clearTimeout(input.drawTimeout);
            input.drawTimeout = setTimeout(draw, 100);
        });
    });

    var toggleButton = document.querySelector('.toggle-dark-mode');
    if (toggleButton) {
        toggleButton.addEventListener('click', toggleDarkMode);
    }

    draw();
});

// Debounced resize handler for better performance
var resizeTimeout;
window.onresize = function() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(draw, 150);
};