function updateInputs() {
    var gateType = document.getElementById("gateSelect").value;
    var inputArea = document.getElementById("inputArea");
    inputArea.innerHTML = ''; // Clear current inputs

    var numberOfInputs = getNumberOfInputsForGate(gateType);

    for (var i = 0; i < numberOfInputs; i++) {
        var inputDiv = document.createElement("div");
        inputDiv.className = "lightBulb inactive";
        inputDiv.id = 'input' + (i + 1);
        inputDiv.onclick = function() {
            toggleInput(this);
            updateOutput();
        };
        inputArea.appendChild(inputDiv);
    }
    updateOutput(); // Update output initially
}

function getNumberOfInputsForGate(gateType) {
    switch (gateType) {
        case "NOT":
            return 1;
        default: // For AND, OR, NAND, NOR, XOR, XNOR
            return 2;
    }
}

function toggleInput(inputElement) {
    inputElement.classList.toggle('inactive');
    inputElement.classList.toggle('active');
}

function updateOutput() {
    var gateType = document.getElementById("gateSelect").value;
    var input1 = document.getElementById("input1").classList.contains('active');
    var input2 = document.getElementById("input2") ? document.getElementById("input2").classList.contains('active') : false;

    var output = false;
    switch (gateType) {
        case "AND":
            output = input1 && input2;
            break;
        case "OR":
            output = input1 || input2;
            break;
        case "NOT":
            output = !input1;
            break;
        case "NAND":
            output = !(input1 && input2);
            break;
        case "NOR":
            output = !(input1 || input2);
            break;
        case "XOR":
            output = input1 !== input2;
            break;
        case "XNOR":
            output = input1 === input2;
            break;
    }

    var outputElement = document.getElementById("outputArea").querySelector('.lightBulb');
    if (output) {
        outputElement.classList.add('active');
        outputElement.classList.remove('inactive');
    } else {
        outputElement.classList.add('inactive');
        outputElement.classList.remove('active');
    }
}

function drawGate(gateType) {
    var canvas = document.getElementById('gateCanvas');
    if (!canvas.getContext) {
        return; // Canvas not supported
    }

    var ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear the canvas

    switch (gateType) {
        case "AND":
            drawANDGate(ctx);
            break;
        case "OR":
            drawORGate(ctx);
            break;
        case "NOT":
            drawNOTGate(ctx);
            break;
        case "NAND":
            drawNANDGate(ctx);
            break;
        case "NOR": // Add NOR gate
            drawNORGate(ctx);
            break;
        case "XOR": // Add XOR gate
            drawXORGate(ctx);
            break;
        case "XNOR": // Add XOR gate
            drawXNORGate(ctx);
            break;
        default:
            console.error("Unknown gate type: " + gateType);
    }

}

function drawANDGate(ctx) {
    // Responsive scales
    const scale = ctx.canvas.height / 200; // Use the height to determine the scale factor
    const gateWidth = 180 * scale;
    const gateHeight = 180 * scale;
    const lineLength = 100 * scale;
    const lineWidth = 2 * scale; // Make the line width scale as well

    // Centering the gate
    const centerX = ctx.canvas.width / 2;
    const startY = (ctx.canvas.height - gateHeight) / 2;
    const endY = startY + gateHeight;

    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = getColorForMode('black', 'white'); // Gate color
    ctx.fillStyle = '#FFF'; // Fill color

    // Clear the canvas
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // Input Lines
    ctx.beginPath();
    ctx.moveTo(centerX - gateWidth / 2 - lineLength, startY + 0.9 * gateHeight);
    ctx.lineTo(centerX - gateWidth / 2, startY + 0.9 * gateHeight);
    ctx.moveTo(centerX - gateWidth / 2 - lineLength, endY - 0.9 * gateHeight);
    ctx.lineTo(centerX - gateWidth / 2, endY - 0.9 * gateHeight);
    ctx.stroke();

    // AND Gate shape
    ctx.beginPath();
    ctx.moveTo(centerX - gateWidth / 2, startY);
    ctx.lineTo(centerX, startY); // Straight line to start the curve
    ctx.quadraticCurveTo(centerX + gateWidth / 2, ctx.canvas.height / 2, centerX, endY);
    ctx.lineTo(centerX - gateWidth / 2, endY);
    ctx.closePath();
    ctx.stroke();
    ctx.fill(); // Fill the gate shape

    // Output Line
    ctx.beginPath();
    ctx.moveTo(centerX + gateWidth / 4, (startY + endY) / 2);
    ctx.lineTo(centerX + gateWidth / 4 + lineLength + 10, (startY + endY) / 2);
    ctx.stroke();
}


function drawORGate(ctx) {
    // Responsive scales
    const scale = ctx.canvas.height / 200;
    const gateWidth = 180 * scale;
    const gateHeight = 180 * scale;
    const lineLength = 100 * scale;
    const lineWidth = 2 * scale;

    // Centering the gate
    const centerX = ctx.canvas.width / 2;
    const startY = (ctx.canvas.height - gateHeight) / 2;
    const endY = startY + gateHeight;

    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = getColorForMode('black', 'white'); // Gate color
    ctx.fillStyle = '#FFF'; // Fill color

    // Clear the canvas
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // Input Lines
    ctx.beginPath();
    ctx.moveTo(centerX - gateWidth / 2 - lineLength, startY + 0.9 * gateHeight);
    ctx.lineTo(centerX - gateWidth / 2, startY + 0.9 * gateHeight);
    ctx.moveTo(centerX - gateWidth / 2 - lineLength, endY - 0.9 * gateHeight);
    ctx.lineTo(centerX - gateWidth / 2, endY - 0.9 * gateHeight);
    ctx.stroke();

    // OR Gate shape
    ctx.beginPath();
    ctx.moveTo(centerX - gateWidth / 2, startY);
    ctx.quadraticCurveTo(centerX - gateWidth / 4, ctx.canvas.height / 2, centerX - gateWidth / 2, endY); // First curve for input side
    ctx.quadraticCurveTo(centerX, endY, centerX + gateWidth / 2, (startY + endY) / 2); // Second curve for output side
    ctx.quadraticCurveTo(centerX, startY, centerX - gateWidth / 2, startY); // Third curve to complete the shape
    ctx.closePath();
    ctx.stroke();
    ctx.fill(); // Fill the gate shape

    // Output Line
    ctx.beginPath();
    // Adjusted starting point for output line to align with the gate's right edge
    ctx.moveTo(centerX + gateWidth / 2, (startY + endY) / 2);
    ctx.lineTo(centerX + gateWidth / 2 + lineLength - 20, (startY + endY) / 2);
    ctx.stroke();
}


function drawNOTGate(ctx) {
    // Responsive scales
    const scale = ctx.canvas.height / 200;
    const gateWidth = 120 * scale; // Width of the triangle
    const gateHeight = 80 * scale; // Height of the triangle
    const lineLength = 100 * scale;
    const lineWidth = 2 * scale;
    const negationCircleRadius = 10 * scale; // Radius for the negation circle

    // Centering the gate
    const centerX = ctx.canvas.width / 2;
    const startY = (ctx.canvas.height - gateHeight) / 2;
    const endY = startY + gateHeight;

    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = getColorForMode('black', 'white'); // Gate color
    ctx.fillStyle = '#FFF'; // Fill color

    // Clear the canvas
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // Input Line
    ctx.beginPath();
    ctx.moveTo(centerX - gateWidth / 2 - lineLength, (startY + endY) / 2);
    ctx.lineTo(centerX - gateWidth / 2, (startY + endY) / 2);
    ctx.stroke();

    // NOT Gate shape (triangle)
    ctx.beginPath();
    ctx.moveTo(centerX - gateWidth / 2, startY);
    ctx.lineTo(centerX - gateWidth / 2, endY);
    ctx.lineTo(centerX + gateWidth / 2 - negationCircleRadius, (startY + endY) / 2);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();

    // Negation Circle (for NOT)
    ctx.beginPath();
    ctx.arc(centerX + gateWidth / 2 - negationCircleRadius, (startY + endY) / 2, negationCircleRadius, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.fill();

    // Output Line (adjusted for the negation circle)
    ctx.beginPath();
    ctx.moveTo(centerX + gateWidth / 2, (startY + endY) / 2);
    ctx.lineTo(centerX + gateWidth / 2 + lineLength, (startY + endY) / 2);
    ctx.stroke();
}


function drawNANDGate(ctx) {
    // Responsive scales
    const scale = ctx.canvas.height / 200;
    const gateWidth = 180 * scale;
    const gateHeight = 180 * scale;
    const lineLength = 100 * scale;
    const lineWidth = 2 * scale;
    const negationCircleRadius = 10 * scale; // Radius for the negation circle

    // Centering the gate
    const centerX = ctx.canvas.width / 2;
    const startY = (ctx.canvas.height - gateHeight) / 2;
    const endY = startY + gateHeight;

    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = getColorForMode('black', 'white'); // Gate color
    ctx.fillStyle = '#FFF'; // Fill color

    // Clear the canvas
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // Input Lines
    ctx.beginPath();
    ctx.moveTo(centerX - gateWidth / 2 - lineLength, startY + 0.9 * gateHeight);
    ctx.lineTo(centerX - gateWidth / 2, startY + 0.9 * gateHeight);
    ctx.moveTo(centerX - gateWidth / 2 - lineLength, endY - 0.9 * gateHeight);
    ctx.lineTo(centerX - gateWidth / 2, endY - 0.9 * gateHeight);
    ctx.stroke();

    // NAND Gate shape (similar to AND Gate)
    ctx.beginPath();
    ctx.moveTo(centerX - gateWidth / 2, startY);
    ctx.lineTo(centerX, startY); // Straight line to start the curve
    ctx.quadraticCurveTo(centerX + gateWidth / 2, ctx.canvas.height / 2, centerX, endY);
    ctx.lineTo(centerX - gateWidth / 2, endY);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();

    // Negation Circle (for NAND)
    ctx.beginPath();
    const circleCenterX = centerX + gateWidth / 4 + negationCircleRadius;
    ctx.arc(circleCenterX, (startY + endY) / 2, negationCircleRadius, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.fill();

    // Output Line (adjusted for the negation circle)
    ctx.beginPath();
    ctx.moveTo(circleCenterX + negationCircleRadius, (startY + endY) / 2);
    ctx.lineTo(circleCenterX + negationCircleRadius + lineLength, (startY + endY) / 2);
    ctx.stroke();
}


function drawNORGate(ctx) {
    // Responsive scales
    const scale = ctx.canvas.height / 200;
    const gateWidth = 180 * scale;
    const gateHeight = 180 * scale;
    const lineLength = 100 * scale;
    const lineWidth = 2 * scale;
    const negationCircleRadius = 10 * scale; // Radius for the negation circle

    // Centering the gate
    const centerX = ctx.canvas.width / 2;
    const startY = (ctx.canvas.height - gateHeight) / 2;
    const endY = startY + gateHeight;

    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = getColorForMode('black', 'white');
    ctx.fillStyle = '#FFF'; // Fill color

    // Clear the canvas
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // Input Lines
    ctx.beginPath();
    ctx.moveTo(centerX - gateWidth / 2 - lineLength, startY + 0.9 * gateHeight);
    ctx.lineTo(centerX - gateWidth / 2, startY + 0.9 * gateHeight);
    ctx.moveTo(centerX - gateWidth / 2 - lineLength, endY - 0.9 * gateHeight);
    ctx.lineTo(centerX - gateWidth / 2, endY - 0.9 * gateHeight);
    ctx.stroke();

    // NOR Gate shape (based on OR gate)
    ctx.beginPath();
    ctx.moveTo(centerX - gateWidth / 2, startY);
    ctx.quadraticCurveTo(centerX - gateWidth / 4, ctx.canvas.height / 2, centerX - gateWidth / 2, endY); // First curve for input side
    ctx.quadraticCurveTo(centerX, endY, centerX + gateWidth / 2, (startY + endY) / 2); // Second curve for output side
    ctx.quadraticCurveTo(centerX, startY, centerX - gateWidth / 2, startY); // Third curve to complete the shape
    ctx.closePath();
    ctx.stroke();
    ctx.fill();

    // Negation Circle (for NOR)
    ctx.beginPath();
    ctx.arc(centerX + gateWidth / 4 + lineLength / 2, (startY + endY) / 2, negationCircleRadius, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.fill();

    // Output Line (adjusted for the negation circle)
    ctx.beginPath();
    ctx.moveTo(centerX + gateWidth / 4 + lineLength / 2 + negationCircleRadius, (startY + endY) / 2);
    ctx.lineTo(centerX + gateWidth / 4 + lineLength + negationCircleRadius, (startY + endY) / 2);
    ctx.stroke();
}

function drawXORGate(ctx) {
    // Responsive scales
    const scale = ctx.canvas.height / 200;
    const gateWidth = 180 * scale;
    const gateHeight = 180 * scale;
    const lineLength = 100 * scale;
    const lineWidth = 2 * scale;

    // Centering the gate
    const centerX = ctx.canvas.width / 2;
    const startY = (ctx.canvas.height - gateHeight) / 2;
    const endY = startY + gateHeight;

    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = getColorForMode('black', 'white'); // Gate color
    ctx.fillStyle = '#FFF'; // Fill color

    // Clear the canvas
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // Input Lines
    ctx.beginPath();
    ctx.moveTo(centerX - gateWidth / 2 - lineLength, startY + 0.9 * gateHeight);
    ctx.lineTo(centerX - gateWidth / 2, startY + 0.9 * gateHeight);
    ctx.moveTo(centerX - gateWidth / 2 - lineLength, endY - 0.9 * gateHeight);
    ctx.lineTo(centerX - gateWidth / 2, endY - 0.9 * gateHeight);
    ctx.stroke();

    // Extra curve for XOR Gate
    ctx.beginPath();
    ctx.moveTo(centerX - gateWidth / 2 - (20 * scale), startY); // 20 * scale for a small offset
    ctx.quadraticCurveTo(centerX - gateWidth / 4 - (20 * scale), ctx.canvas.height / 2, centerX - gateWidth / 2 - (20 * scale), endY);
    ctx.stroke();

    // XOR Gate shape (based on OR gate)
    ctx.beginPath();
    ctx.moveTo(centerX - gateWidth / 2, startY);
    ctx.quadraticCurveTo(centerX - gateWidth / 4, ctx.canvas.height / 2, centerX - gateWidth / 2, endY); // First curve for input side
    ctx.quadraticCurveTo(centerX, endY, centerX + gateWidth / 2, (startY + endY) / 2); // Second curve for output side
    ctx.quadraticCurveTo(centerX, startY, centerX - gateWidth / 2, startY); // Third curve to complete the shape
    ctx.closePath();
    ctx.stroke();
    ctx.fill();

    // Output Line
    ctx.beginPath();
    // Adjusted starting point for output line to align with the gate's right edge
    ctx.moveTo(centerX + gateWidth / 2, (startY + endY) / 2);
    ctx.lineTo(centerX + gateWidth / 2 + lineLength - 20, (startY + endY) / 2);
    ctx.stroke();
}


function drawXNORGate(ctx) {
    // Responsive scales
    const scale = ctx.canvas.height / 200;
    const gateWidth = 180 * scale;
    const gateHeight = 180 * scale;
    const lineLength = 100 * scale;
    const lineWidth = 2 * scale;
    const negationCircleRadius = 10 * scale; // Radius for the negation circle

    // Centering the gate
    const centerX = ctx.canvas.width / 2;
    const startY = (ctx.canvas.height - gateHeight) / 2;
    const endY = startY + gateHeight;

    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = getColorForMode('black', 'white'); // Gate color
    ctx.fillStyle = '#FFF'; // Fill color

    // Clear the canvas
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // Input Lines
    ctx.beginPath();
    ctx.moveTo(centerX - gateWidth / 2 - lineLength, startY + 0.9 * gateHeight);
    ctx.lineTo(centerX - gateWidth / 2, startY + 0.9 * gateHeight);
    ctx.moveTo(centerX - gateWidth / 2 - lineLength, endY - 0.9 * gateHeight);
    ctx.lineTo(centerX - gateWidth / 2, endY - 0.9 * gateHeight);
    ctx.stroke();

    // Extra curve for XNOR Gate
    ctx.beginPath();
    ctx.moveTo(centerX - gateWidth / 2 - (20 * scale), startY); // 20 * scale for a small offset
    ctx.quadraticCurveTo(centerX - gateWidth / 4 - (20 * scale), ctx.canvas.height / 2, centerX - gateWidth / 2 - (20 * scale), endY);
    ctx.stroke();

    // XNOR Gate shape (based on XOR gate)
    ctx.beginPath();
    ctx.moveTo(centerX - gateWidth / 2, startY);
    ctx.quadraticCurveTo(centerX - gateWidth / 4, ctx.canvas.height / 2, centerX - gateWidth / 2, endY); // First curve for input side
    ctx.quadraticCurveTo(centerX, endY, centerX + gateWidth / 2, (startY + endY) / 2); // Second curve for output side
    ctx.quadraticCurveTo(centerX, startY, centerX - gateWidth / 2, startY); // Third curve to complete the shape
    ctx.closePath();
    ctx.stroke();
    ctx.fill();

    // Negation Circle (for XNOR)
    ctx.beginPath();
    ctx.arc(centerX + gateWidth / 4 + lineLength / 2, (startY + endY) / 2, negationCircleRadius, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.fill();

    // Output Line (adjusted for the negation circle)
    ctx.beginPath();
    ctx.moveTo(centerX + gateWidth / 4 + lineLength / 2 + negationCircleRadius, (startY + endY) / 2);
    ctx.lineTo(centerX + gateWidth / 4 + lineLength + negationCircleRadius, (startY + endY) / 2);
    ctx.stroke();
}


function updateGateDrawing() {
    var gateType = document.getElementById("gateSelect").value;
    drawGate(gateType);
}

function handleGateChange() {
    updateInputs(); // Update the number of inputs
    updateGateDrawing(); // Redraw the gate
}

document.addEventListener('DOMContentLoaded', function() {
    var gateSelect = document.getElementById("gateSelect");
    gateSelect.addEventListener('change', function() {
        updateInputs(); // Update the number of inputs
        updateGateDrawing(); // Redraw the gate
    });

    handleGateChange();
});
// Call handleGateChange when the page is fully loaded
window.addEventListener('load', handleGateChange);

// Call handleGateChange when the window is resized
window.addEventListener('resize', handleGateChange);


handleGateChange();