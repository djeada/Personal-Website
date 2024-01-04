function gaussian(x, mean, std) {
    return (1 / (std * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * Math.pow((x - mean) / std, 2));
}

function drawAxis(ctx, canvasWidth, canvasHeight) {
    const axisCenterY = canvasHeight * 0.95;
    const range = 20; // Maximum value on the axis
    const scale = canvasWidth / (2 * range); // New scale calculation

    // Draw X axis
    ctx.beginPath();
    ctx.moveTo(0, axisCenterY);
    ctx.lineTo(canvasWidth, axisCenterY);
    ctx.stroke();

    // Draw labels and ticks
    for (let i = -range; i <= range; i++) {
        const x = i * scale + canvasWidth / 2;
        ctx.fillText(i.toString(), x, axisCenterY + 20);

        // Draw tick
        ctx.beginPath();
        ctx.moveTo(x, axisCenterY - 5);
        ctx.lineTo(x, axisCenterY + 5);
        ctx.stroke();
    }
}


function drawBellCurve(ctx, mean, std, color, canvasWidth, canvasHeight) {
    const axisCenterY = canvasHeight / 2;
    const range = 20;
    const xScale = canvasWidth / (2 * range); // New xScale calculation
    const yScale = 5000; // Adjust as needed
    const yOffset = canvasHeight * 0.95;

    ctx.beginPath();
    ctx.strokeStyle = color;
    for (let x = -3 * std + mean; x <= 3 * std + mean; x += 0.01) {
        let plotX = x * xScale + (canvasWidth / 2);
        let plotY = yOffset - gaussian(x, mean, std) * yScale;
        ctx.lineTo(plotX, plotY);
    }
    ctx.stroke();
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
    drawBellCurve(ctx, mean1, std1, 'blue', canvas.width, canvas.height);
    drawBellCurve(ctx, mean2, std2, 'red', canvas.width, canvas.height);
}

window.onresize = draw; // Redraw when the window is resized
draw(); // Initial draw