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

    drawAxis(ctx, canvas.width, canvas.height);
    drawBellCurve(ctx, mean1, std1, 'blue', 'cyan', canvas.width, canvas.height);
    drawBellCurve(ctx, mean2, std2, 'red', 'magenta', canvas.width, canvas.height);
}

function drawAxis(ctx, canvasWidth, canvasHeight) {
    const axisCenterY = canvasHeight * 0.95;
    const range = 20;
    const scale = canvasWidth / (2 * range);

    // Choose colors for dark mode
    const axisColor = getColorForMode('black', 'white');
    const textColor = getColorForMode('black', 'white');

    // Draw X axis
    ctx.beginPath();
    ctx.strokeStyle = axisColor;
    ctx.moveTo(0, axisCenterY);
    ctx.lineTo(canvasWidth, axisCenterY);
    ctx.stroke();

    // Draw labels and ticks
    ctx.fillStyle = textColor;
    for (let i = -range; i <= range; i++) {
        const x = i * scale + canvasWidth / 2;
        ctx.fillText(i.toString(), x, axisCenterY + 20);

        ctx.beginPath();
        ctx.moveTo(x, axisCenterY - 5);
        ctx.lineTo(x, axisCenterY + 5);
        ctx.stroke();
    }
}

function drawBellCurve(ctx, mean, std, colorLight, colorDark, canvasWidth, canvasHeight) {
    const axisCenterY = canvasHeight / 2;
    const range = 20;
    const xScale = canvasWidth / (2 * range);
    const yScale = 5000;
    const yOffset = canvasHeight * 0.95;

    // Choose colors for dark mode
    const curveColor = getColorForMode(colorLight, colorDark);

    ctx.beginPath();
    ctx.strokeStyle = curveColor;
    for (let x = -3 * std + mean; x <= 3 * std + mean; x += 0.01) {
        let plotX = x * xScale + (canvasWidth / 2);
        let plotY = yOffset - gaussian(x, mean, std) * yScale;
        ctx.lineTo(plotX, plotY);
    }
    ctx.stroke();
}

document.addEventListener('DOMContentLoaded', function() {
    var drawButton = document.querySelector('.draw-button');
    if (drawButton) {
        drawButton.addEventListener('click', draw);
    }
});


window.onresize = draw;