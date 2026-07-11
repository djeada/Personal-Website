function getColorForMode(colorLight, colorDark) {

    const darkModeValue = document.cookie.split('; ').find(row => row.startsWith('darkMode='));
    if (darkModeValue) {
        return darkModeValue.split('=')[1].toLowerCase() === 'true' ? colorDark : colorLight;
    }
    return colorLight;
}

function updateInputs() {
    var gateType = document.getElementById("gateSelect").value;
    var inputArea = document.getElementById("inputArea");
    inputArea.innerHTML = '';

    var numberOfInputs = getNumberOfInputsForGate(gateType);

    for (var i = 0; i < numberOfInputs; i++) {
        var inputDiv = document.createElement("div");
        inputDiv.className = "lightBulb inactive";
        inputDiv.id = 'input' + (i + 1);
        inputDiv.setAttribute('role', 'button');
        inputDiv.setAttribute('tabindex', '0');
        inputDiv.setAttribute('aria-label', 'Input ' + (i + 1) + ': off');
        inputDiv.setAttribute('aria-pressed', 'false');
        inputDiv.onclick = function() {
            toggleInput(this);
            updateOutput();
        };
        inputDiv.onkeydown = function(event) {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                this.click();
            }
        };


        var label = document.createElement("div");
        label.className = "input-label";
        label.textContent = "Input " + (i + 1);

        var container = document.createElement("div");
        container.className = "input-container";
        container.appendChild(inputDiv);
        container.appendChild(label);

        inputArea.appendChild(container);
    }
    updateOutput();
    updateTruthTable();
}

function getNumberOfInputsForGate(gateType) {
    switch (gateType) {
        case "NOT":
            return 1;
        default:
            return 2;
    }
}

function toggleInput(inputElement) {
    inputElement.classList.toggle('inactive');
    inputElement.classList.toggle('active');
    var active = inputElement.classList.contains('active');
    inputElement.setAttribute('aria-pressed', String(active));
    inputElement.setAttribute('aria-label', inputElement.id.replace('input', 'Input ') + ': ' + (active ? 'on' : 'off'));
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
    outputElement.setAttribute('role', 'status');
    outputElement.setAttribute('aria-label', 'Output: ' + (output ? 'on' : 'off'));
    if (output) {
        outputElement.classList.add('active');
        outputElement.classList.remove('inactive');
    } else {
        outputElement.classList.add('inactive');
        outputElement.classList.remove('active');
    }

    updateTruthTable();
    updateTeaching(gateType, output);
}

function updateTeaching(gateType, output) {
    var descriptions = {
        AND: "AND is true only when every input is true. It models requirements that must all be satisfied.",
        OR: "OR is true when at least one input is true. It models alternative sufficient conditions.",
        NOT: "NOT inverts its single input, turning true into false and false into true.",
        NAND: "NAND is the inverse of AND. It is false only when every input is true and is functionally complete.",
        NOR: "NOR is the inverse of OR. It is true only when every input is false and is functionally complete.",
        XOR: "XOR is true when the inputs differ. It models exclusive choice and one-bit addition without carry.",
        XNOR: "XNOR is true when the inputs match. It acts as a one-bit equality test."
    };
    var table = getTruthTable(gateType);
    var formulas = {
        AND: '\\(Y=A\\land B\\)',
        OR: '\\(Y=A\\lor B\\)',
        NOT: '\\(Y=\\lnot A\\)',
        NAND: '\\(Y=\\lnot(A\\land B)\\)',
        NOR: '\\(Y=\\lnot(A\\lor B)\\)',
        XOR: '\\(Y=A\\oplus B\\)',
        XNOR: '\\(Y=\\lnot(A\\oplus B)\\)'
    };
    var trueCases = table.filter(function(row) {
        return row[row.length - 1];
    }).length;
    var insight = document.getElementById('logic-insight');
    var metrics = document.getElementById('logic-metrics');
    if (insight) insight.textContent = descriptions[gateType];
    if (metrics) {
        var values = ['Gate: ' + gateType, 'Inputs: ' + getNumberOfInputsForGate(gateType), 'True cases: ' + trueCases + ' of ' + table.length, 'Current output: ' + (output ? '1' : '0')];
        Array.from(metrics.children).forEach(function(node, index) {
            node.textContent = values[index];
        });
    }
    var formula = document.getElementById('logic-formula');
    if (formula) {
        formula.textContent = formulas[gateType];
        if (window.MathJax && window.MathJax.typesetPromise) window.MathJax.typesetPromise([formula]);
    }
}

function updateTruthTable() {
    var gateType = document.getElementById("gateSelect").value;
    var truthTableDiv = document.getElementById("truthTable");

    if (!truthTableDiv) return;

    var truthTable = getTruthTable(gateType);
    var html = '<h3>Truth Table: ' + gateType + ' Gate</h3>';
    html += '<table>';


    html += '<thead><tr>';
    if (gateType === "NOT") {
        html += '<th>Input</th><th>Output</th>';
    } else {
        html += '<th>Input A</th><th>Input B</th><th>Output</th>';
    }
    html += '</tr></thead>';


    html += '<tbody>';
    for (var i = 0; i < truthTable.length; i++) {
        html += '<tr>';
        for (var j = 0; j < truthTable[i].length; j++) {
            var value = truthTable[i][j];
            var className = value ? 'truth-value-true' : 'truth-value-false';
            html += '<td class="' + className + '">' + (value ? '1' : '0') + '</td>';
        }
        html += '</tr>';
    }
    html += '</tbody></table>';

    truthTableDiv.innerHTML = html;
    var activeValues = [];
    var count = getNumberOfInputsForGate(gateType);
    for (var inputIndex = 1; inputIndex <= count; inputIndex++) activeValues.push(document.getElementById('input' + inputIndex).classList.contains('active'));
    Array.from(truthTableDiv.querySelectorAll('tbody tr')).forEach(function(row, rowIndex) {
        var matches = activeValues.every(function(value, valueIndex) {
            return truthTable[rowIndex][valueIndex] === value;
        });
        row.classList.toggle('is-current', matches);
        if (matches) row.setAttribute('aria-current', 'true');
    });
}

function getTruthTable(gateType) {
    switch (gateType) {
        case "NOT":
            return [
                [false, true],
                [true, false]
            ];
        case "AND":
            return [
                [false, false, false],
                [false, true, false],
                [true, false, false],
                [true, true, true]
            ];
        case "OR":
            return [
                [false, false, false],
                [false, true, true],
                [true, false, true],
                [true, true, true]
            ];
        case "NAND":
            return [
                [false, false, true],
                [false, true, true],
                [true, false, true],
                [true, true, false]
            ];
        case "NOR":
            return [
                [false, false, true],
                [false, true, false],
                [true, false, false],
                [true, true, false]
            ];
        case "XOR":
            return [
                [false, false, false],
                [false, true, true],
                [true, false, true],
                [true, true, false]
            ];
        case "XNOR":
            return [
                [false, false, true],
                [false, true, false],
                [true, false, false],
                [true, true, true]
            ];
        default:
            return [];
    }
}

function resetInputs() {
    var inputArea = document.getElementById("inputArea");
    var inputs = inputArea.querySelectorAll('.lightBulb');

    inputs.forEach(function(input) {
        input.classList.remove('active');
        input.classList.add('inactive');
        input.setAttribute('aria-pressed', 'false');
        input.setAttribute('aria-label', input.id.replace('input', 'Input ') + ': off');
    });

    updateOutput();
}

function drawGate(gateType) {
    var canvas = document.getElementById('gateCanvas');
    if (!canvas.getContext) {
        return;
    }

    var ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

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
        case "NOR":
            drawNORGate(ctx);
            break;
        case "XOR":
            drawXORGate(ctx);
            break;
        case "XNOR":
            drawXNORGate(ctx);
            break;
        default:
            console.error("Unknown gate type: " + gateType);
    }

}

function drawANDGate(ctx) {

    const scale = ctx.canvas.height / 200;
    const gateWidth = 180 * scale;
    const gateHeight = 180 * scale;
    const lineLength = 100 * scale;
    const lineWidth = 2 * scale;


    const centerX = ctx.canvas.width / 2;
    const startY = (ctx.canvas.height - gateHeight) / 2;
    const endY = startY + gateHeight;

    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = getColorForMode('black', 'white');
    ctx.fillStyle = '#FFF';


    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);


    ctx.beginPath();
    ctx.moveTo(centerX - gateWidth / 2 - lineLength, startY + 0.9 * gateHeight);
    ctx.lineTo(centerX - gateWidth / 2, startY + 0.9 * gateHeight);
    ctx.moveTo(centerX - gateWidth / 2 - lineLength, endY - 0.9 * gateHeight);
    ctx.lineTo(centerX - gateWidth / 2, endY - 0.9 * gateHeight);
    ctx.stroke();


    ctx.beginPath();
    ctx.moveTo(centerX - gateWidth / 2, startY);
    ctx.lineTo(centerX, startY);
    ctx.quadraticCurveTo(centerX + gateWidth / 2, ctx.canvas.height / 2, centerX, endY);
    ctx.lineTo(centerX - gateWidth / 2, endY);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();


    ctx.beginPath();
    ctx.moveTo(centerX + gateWidth / 4, (startY + endY) / 2);
    ctx.lineTo(centerX + gateWidth / 4 + lineLength + 10, (startY + endY) / 2);
    ctx.stroke();
}


function drawORGate(ctx) {

    const scale = ctx.canvas.height / 200;
    const gateWidth = 180 * scale;
    const gateHeight = 180 * scale;
    const lineLength = 100 * scale;
    const lineWidth = 2 * scale;


    const centerX = ctx.canvas.width / 2;
    const startY = (ctx.canvas.height - gateHeight) / 2;
    const endY = startY + gateHeight;

    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = getColorForMode('black', 'white');
    ctx.fillStyle = '#FFF';


    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);


    ctx.beginPath();
    ctx.moveTo(centerX - gateWidth / 2 - lineLength, startY + 0.9 * gateHeight);
    ctx.lineTo(centerX - gateWidth / 2, startY + 0.9 * gateHeight);
    ctx.moveTo(centerX - gateWidth / 2 - lineLength, endY - 0.9 * gateHeight);
    ctx.lineTo(centerX - gateWidth / 2, endY - 0.9 * gateHeight);
    ctx.stroke();


    ctx.beginPath();
    ctx.moveTo(centerX - gateWidth / 2, startY);
    ctx.quadraticCurveTo(centerX - gateWidth / 4, ctx.canvas.height / 2, centerX - gateWidth / 2, endY);
    ctx.quadraticCurveTo(centerX, endY, centerX + gateWidth / 2, (startY + endY) / 2);
    ctx.quadraticCurveTo(centerX, startY, centerX - gateWidth / 2, startY);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();


    ctx.beginPath();

    ctx.moveTo(centerX + gateWidth / 2, (startY + endY) / 2);
    ctx.lineTo(centerX + gateWidth / 2 + lineLength - 20, (startY + endY) / 2);
    ctx.stroke();
}


function drawNOTGate(ctx) {

    const scale = ctx.canvas.height / 200;
    const gateWidth = 120 * scale;
    const gateHeight = 80 * scale;
    const lineLength = 100 * scale;
    const lineWidth = 2 * scale;
    const negationCircleRadius = 10 * scale;


    const centerX = ctx.canvas.width / 2;
    const startY = (ctx.canvas.height - gateHeight) / 2;
    const endY = startY + gateHeight;

    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = getColorForMode('black', 'white');
    ctx.fillStyle = '#FFF';


    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);


    ctx.beginPath();
    ctx.moveTo(centerX - gateWidth / 2 - lineLength, (startY + endY) / 2);
    ctx.lineTo(centerX - gateWidth / 2, (startY + endY) / 2);
    ctx.stroke();


    ctx.beginPath();
    ctx.moveTo(centerX - gateWidth / 2, startY);
    ctx.lineTo(centerX - gateWidth / 2, endY);
    ctx.lineTo(centerX + gateWidth / 2 - negationCircleRadius, (startY + endY) / 2);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();


    ctx.beginPath();
    ctx.arc(centerX + gateWidth / 2 - negationCircleRadius, (startY + endY) / 2, negationCircleRadius, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.fill();


    ctx.beginPath();
    ctx.moveTo(centerX + gateWidth / 2, (startY + endY) / 2);
    ctx.lineTo(centerX + gateWidth / 2 + lineLength, (startY + endY) / 2);
    ctx.stroke();
}


function drawNANDGate(ctx) {

    const scale = ctx.canvas.height / 200;
    const gateWidth = 180 * scale;
    const gateHeight = 180 * scale;
    const lineLength = 100 * scale;
    const lineWidth = 2 * scale;
    const negationCircleRadius = 10 * scale;


    const centerX = ctx.canvas.width / 2;
    const startY = (ctx.canvas.height - gateHeight) / 2;
    const endY = startY + gateHeight;

    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = getColorForMode('black', 'white');
    ctx.fillStyle = '#FFF';


    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);


    ctx.beginPath();
    ctx.moveTo(centerX - gateWidth / 2 - lineLength, startY + 0.9 * gateHeight);
    ctx.lineTo(centerX - gateWidth / 2, startY + 0.9 * gateHeight);
    ctx.moveTo(centerX - gateWidth / 2 - lineLength, endY - 0.9 * gateHeight);
    ctx.lineTo(centerX - gateWidth / 2, endY - 0.9 * gateHeight);
    ctx.stroke();


    ctx.beginPath();
    ctx.moveTo(centerX - gateWidth / 2, startY);
    ctx.lineTo(centerX, startY);
    ctx.quadraticCurveTo(centerX + gateWidth / 2, ctx.canvas.height / 2, centerX, endY);
    ctx.lineTo(centerX - gateWidth / 2, endY);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();


    ctx.beginPath();
    const circleCenterX = centerX + gateWidth / 4 + negationCircleRadius;
    ctx.arc(circleCenterX, (startY + endY) / 2, negationCircleRadius, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.fill();


    ctx.beginPath();
    ctx.moveTo(circleCenterX + negationCircleRadius, (startY + endY) / 2);
    ctx.lineTo(circleCenterX + negationCircleRadius + lineLength, (startY + endY) / 2);
    ctx.stroke();
}


function drawNORGate(ctx) {

    const scale = ctx.canvas.height / 200;
    const gateWidth = 180 * scale;
    const gateHeight = 180 * scale;
    const lineLength = 100 * scale;
    const lineWidth = 2 * scale;
    const negationCircleRadius = 10 * scale;


    const centerX = ctx.canvas.width / 2;
    const startY = (ctx.canvas.height - gateHeight) / 2;
    const endY = startY + gateHeight;

    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = getColorForMode('black', 'white');
    ctx.fillStyle = '#FFF';


    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);


    ctx.beginPath();
    ctx.moveTo(centerX - gateWidth / 2 - lineLength, startY + 0.9 * gateHeight);
    ctx.lineTo(centerX - gateWidth / 2, startY + 0.9 * gateHeight);
    ctx.moveTo(centerX - gateWidth / 2 - lineLength, endY - 0.9 * gateHeight);
    ctx.lineTo(centerX - gateWidth / 2, endY - 0.9 * gateHeight);
    ctx.stroke();


    ctx.beginPath();
    ctx.moveTo(centerX - gateWidth / 2, startY);
    ctx.quadraticCurveTo(centerX - gateWidth / 4, ctx.canvas.height / 2, centerX - gateWidth / 2, endY);
    ctx.quadraticCurveTo(centerX, endY, centerX + gateWidth / 2, (startY + endY) / 2);
    ctx.quadraticCurveTo(centerX, startY, centerX - gateWidth / 2, startY);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();


    ctx.beginPath();
    const norCircleCenterX = centerX + gateWidth / 2 + negationCircleRadius;
    ctx.arc(norCircleCenterX, (startY + endY) / 2, negationCircleRadius, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.fill();


    ctx.beginPath();
    ctx.moveTo(norCircleCenterX + negationCircleRadius, (startY + endY) / 2);
    ctx.lineTo(norCircleCenterX + negationCircleRadius + lineLength - 40, (startY + endY) / 2);
    ctx.stroke();
}

function drawXORGate(ctx) {

    const scale = ctx.canvas.height / 200;
    const gateWidth = 180 * scale;
    const gateHeight = 180 * scale;
    const lineLength = 100 * scale;
    const lineWidth = 2 * scale;


    const centerX = ctx.canvas.width / 2;
    const startY = (ctx.canvas.height - gateHeight) / 2;
    const endY = startY + gateHeight;

    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = getColorForMode('black', 'white');
    ctx.fillStyle = '#FFF';


    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);


    ctx.beginPath();
    ctx.moveTo(centerX - gateWidth / 2 - lineLength, startY + 0.9 * gateHeight);
    ctx.lineTo(centerX - gateWidth / 2, startY + 0.9 * gateHeight);
    ctx.moveTo(centerX - gateWidth / 2 - lineLength, endY - 0.9 * gateHeight);
    ctx.lineTo(centerX - gateWidth / 2, endY - 0.9 * gateHeight);
    ctx.stroke();


    ctx.beginPath();
    ctx.moveTo(centerX - gateWidth / 2 - (20 * scale), startY);
    ctx.quadraticCurveTo(centerX - gateWidth / 4 - (20 * scale), ctx.canvas.height / 2, centerX - gateWidth / 2 - (20 * scale), endY);
    ctx.stroke();


    ctx.beginPath();
    ctx.moveTo(centerX - gateWidth / 2, startY);
    ctx.quadraticCurveTo(centerX - gateWidth / 4, ctx.canvas.height / 2, centerX - gateWidth / 2, endY);
    ctx.quadraticCurveTo(centerX, endY, centerX + gateWidth / 2, (startY + endY) / 2);
    ctx.quadraticCurveTo(centerX, startY, centerX - gateWidth / 2, startY);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();


    ctx.beginPath();

    ctx.moveTo(centerX + gateWidth / 2, (startY + endY) / 2);
    ctx.lineTo(centerX + gateWidth / 2 + lineLength - 20, (startY + endY) / 2);
    ctx.stroke();
}


function drawXNORGate(ctx) {

    const scale = ctx.canvas.height / 200;
    const gateWidth = 180 * scale;
    const gateHeight = 180 * scale;
    const lineLength = 100 * scale;
    const lineWidth = 2 * scale;
    const negationCircleRadius = 10 * scale;


    const centerX = ctx.canvas.width / 2;
    const startY = (ctx.canvas.height - gateHeight) / 2;
    const endY = startY + gateHeight;

    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = getColorForMode('black', 'white');
    ctx.fillStyle = '#FFF';


    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);


    ctx.beginPath();
    ctx.moveTo(centerX - gateWidth / 2 - lineLength, startY + 0.9 * gateHeight);
    ctx.lineTo(centerX - gateWidth / 2, startY + 0.9 * gateHeight);
    ctx.moveTo(centerX - gateWidth / 2 - lineLength, endY - 0.9 * gateHeight);
    ctx.lineTo(centerX - gateWidth / 2, endY - 0.9 * gateHeight);
    ctx.stroke();


    ctx.beginPath();
    ctx.moveTo(centerX - gateWidth / 2 - (20 * scale), startY);
    ctx.quadraticCurveTo(centerX - gateWidth / 4 - (20 * scale), ctx.canvas.height / 2, centerX - gateWidth / 2 - (20 * scale), endY);
    ctx.stroke();


    ctx.beginPath();
    ctx.moveTo(centerX - gateWidth / 2, startY);
    ctx.quadraticCurveTo(centerX - gateWidth / 4, ctx.canvas.height / 2, centerX - gateWidth / 2, endY);
    ctx.quadraticCurveTo(centerX, endY, centerX + gateWidth / 2, (startY + endY) / 2);
    ctx.quadraticCurveTo(centerX, startY, centerX - gateWidth / 2, startY);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();


    ctx.beginPath();
    const xnorCircleCenterX = centerX + gateWidth / 2 + negationCircleRadius;
    ctx.arc(xnorCircleCenterX, (startY + endY) / 2, negationCircleRadius, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.fill();


    ctx.beginPath();
    ctx.moveTo(xnorCircleCenterX + negationCircleRadius, (startY + endY) / 2);
    ctx.lineTo(xnorCircleCenterX + negationCircleRadius + lineLength - 40, (startY + endY) / 2);
    ctx.stroke();
    ctx.stroke();
}


function updateGateDrawing() {
    var gateType = document.getElementById("gateSelect").value;
    drawGate(gateType);
}

function handleGateChange() {
    updateInputs();
    updateGateDrawing();
}

document.addEventListener('DOMContentLoaded', function() {
    var gateSelect = document.getElementById("gateSelect");
    gateSelect.addEventListener('change', function() {
        updateInputs();
        updateGateDrawing();
    });

    handleGateChange();
});

window.addEventListener('load', handleGateChange);


window.addEventListener('resize', handleGateChange);


handleGateChange();