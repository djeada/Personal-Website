"use strict";

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const cw = canvas.width,
    ch = canvas.height;

const boundarySelect = document.getElementById("boundaryType");
const freqSlider = document.getElementById("frequencySlider");
const freqValue = document.getElementById("frequencyValue");
const phaseSlider = document.getElementById("phaseSlider");
const phaseValue = document.getElementById("phaseValue");
const startStopBtn = document.getElementById("startStopBtn");
const resetBtn = document.getElementById("resetBtn");
const showIncidentCheck = document.getElementById("showIncident");
const showReflectedCheck = document.getElementById("showReflected");

const statFreq = document.getElementById("stat-freq");
const statPhase = document.getElementById("stat-phase");
const statBoundary = document.getElementById("stat-boundary");
const statNodes = document.getElementById("stat-nodes");

const btnFundamental = document.getElementById("btnFundamental");
const btnSecondHarmonic = document.getElementById("btnSecondHarmonic");
const btnThirdHarmonic = document.getElementById("btnThirdHarmonic");
const btnHighFreq = document.getElementById("btnHighFreq");

let timerRunning = false,
    frameCounter = 0;
let frequency = +freqSlider.value;
let phase = +phaseSlider.value * Math.PI / 180;
const samplesPerCycle = 90;

const margin = 40;
const plotLeft = margin;
const plotRight = cw - margin;
const plotWidth = plotRight - plotLeft;
const centerY = ch / 2;
const amplitude = (ch - 2 * margin) / 2 * 0.8;

function getCSSColor(variableName) {
    return getComputedStyle(document.documentElement)
        .getPropertyValue(variableName).trim() || getDefaultColor(variableName);
}

function getDefaultColor(variableName) {
    const defaults = {
        '--text-muted': '#94a3b8',
        '--text-primary': '#1e293b',
        '--primary-color': '#ea8400',
        '--danger-color': '#ef4444',
        '--success-color': '#10b981'
    };
    return defaults[variableName] || '#94a3b8';
}

function isFixedBoundary() {
    return boundarySelect.value === "fixed";
}

function incidentWave(x, t) {
    var k = 2 * Math.PI * frequency;
    var omega = 2 * Math.PI * frequency;
    return Math.sin(k * x - omega * t + phase);
}

function reflectedWave(x, t) {
    var k = 2 * Math.PI * frequency;
    var omega = 2 * Math.PI * frequency;
    var r = Math.sin(k * (2 - x) - omega * t + phase);
    return isFixedBoundary() ? -r : r;
}

function standingWave(x, t) {
    return incidentWave(x, t) + reflectedWave(x, t);
}

function findNodes() {
    var nodes = [];
    var steps = 1000;

    for (var i = 0; i <= steps; i++) {
        var xNorm = i / steps;
        var maxAbs = 0;
        for (var s = 0; s < 20; s++) {
            var tt = s / 20;
            var val = Math.abs(standingWave(xNorm, tt));
            if (val > maxAbs) maxAbs = val;
        }
        if (maxAbs < 0.08) {
            if (nodes.length === 0 || (xNorm - nodes[nodes.length - 1]) > 0.02) {
                nodes.push(xNorm);
            }
        }
    }

    return nodes;
}

function findAntinodes() {
    var antinodes = [];
    var steps = 1000;
    var envValues = [];

    for (var i = 0; i <= steps; i++) {
        var xNorm = i / steps;
        var maxAbs = 0;
        for (var s = 0; s < 20; s++) {
            var tt = s / 20;
            var val = Math.abs(standingWave(xNorm, tt));
            if (val > maxAbs) maxAbs = val;
        }
        envValues.push(maxAbs);
    }

    for (var j = 1; j < steps; j++) {
        if (envValues[j] >= envValues[j - 1] && envValues[j] >= envValues[j + 1] && envValues[j] > 1.5) {
            var xNorm2 = j / steps;
            if (antinodes.length === 0 || (xNorm2 - antinodes[antinodes.length - 1]) > 0.02) {
                antinodes.push(xNorm2);
            }
        }
    }

    return antinodes;
}

function drawAxis() {
    var axisColor = getCSSColor('--text-muted');
    ctx.strokeStyle = axisColor;
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(plotLeft, centerY);
    ctx.lineTo(plotRight, centerY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = axisColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(plotLeft, margin);
    ctx.lineTo(plotLeft, ch - margin);
    ctx.stroke();

    ctx.fillStyle = axisColor;
    ctx.font = "12px Arial";
    ctx.textAlign = "center";
    ctx.fillText("0", plotLeft, ch - margin + 16);
    ctx.fillText("L", plotRight, ch - margin + 16);
    ctx.textAlign = "right";
    ctx.fillText("+A", plotLeft - 8, margin + 5);
    ctx.fillText("0", plotLeft - 8, centerY + 4);
    ctx.fillText("−A", plotLeft - 8, ch - margin + 5);

    if (isFixedBoundary()) {
        ctx.strokeStyle = getCSSColor('--text-primary');
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(plotRight, margin);
        ctx.lineTo(plotRight, ch - margin);
        ctx.stroke();
    } else {
        ctx.strokeStyle = getCSSColor('--text-muted');
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.moveTo(plotRight, margin);
        ctx.lineTo(plotRight, ch - margin);
        ctx.stroke();
        ctx.setLineDash([]);
    }
}

function drawWave(waveFunc, t, color, lineWidth) {
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    var steps = plotWidth;
    for (var i = 0; i <= steps; i++) {
        var xNorm = i / steps;
        var val = waveFunc(xNorm, t);
        var px = plotLeft + i;
        var py = centerY - val * amplitude;
        if (i === 0) {
            ctx.moveTo(px, py);
        } else {
            ctx.lineTo(px, py);
        }
    }
    ctx.stroke();
}

function drawEnvelope() {
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = getCSSColor('--primary-color') + "66";

    var steps = plotWidth;
    var envValues = [];
    for (var i = 0; i <= steps; i++) {
        var xNorm = i / steps;
        var maxAbs = 0;
        for (var s = 0; s < 20; s++) {
            var tt = s / 20;
            var val = Math.abs(standingWave(xNorm, tt));
            if (val > maxAbs) maxAbs = val;
        }
        envValues.push(maxAbs);
    }

    ctx.beginPath();
    for (var i = 0; i <= steps; i++) {
        var px = plotLeft + i;
        var py = centerY - envValues[i] * amplitude;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.stroke();

    ctx.beginPath();
    for (var j = 0; j <= steps; j++) {
        var px2 = plotLeft + j;
        var py2 = centerY + envValues[j] * amplitude;
        if (j === 0) ctx.moveTo(px2, py2);
        else ctx.lineTo(px2, py2);
    }
    ctx.stroke();

    ctx.setLineDash([]);
}

function drawNodeMarkers() {
    var nodes = findNodes();
    var nodeColor = getCSSColor('--danger-color');
    var antinodeColor = getCSSColor('--success-color');

    nodes.forEach(function (xNorm) {
        var px = plotLeft + xNorm * plotWidth;
        ctx.fillStyle = nodeColor;
        ctx.beginPath();
        ctx.arc(px, centerY, 6, 0, 2 * Math.PI);
        ctx.fill();

        ctx.fillStyle = nodeColor;
        ctx.font = "bold 11px Arial";
        ctx.textAlign = "center";
        ctx.fillText("N", px, centerY - 12);
    });

    var antinodes = findAntinodes();
    antinodes.forEach(function (xNorm) {
        var px = plotLeft + xNorm * plotWidth;
        ctx.fillStyle = antinodeColor;
        ctx.beginPath();
        ctx.arc(px, centerY, 5, 0, 2 * Math.PI);
        ctx.fill();

        ctx.strokeStyle = antinodeColor;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(px, margin);
        ctx.lineTo(px, ch - margin);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = antinodeColor;
        ctx.font = "bold 11px Arial";
        ctx.textAlign = "center";
        ctx.fillText("A", px, margin - 6);
    });
}

function updateStats() {
    statFreq.textContent = frequency.toFixed(1) + " Hz";
    statPhase.textContent = phaseSlider.value + "°";
    statBoundary.textContent = isFixedBoundary() ? "Fixed" : "Free";

    var nodes = findNodes();
    statNodes.textContent = nodes.length;
}

function updatePresetButtons(activeBtn) {
    [btnFundamental, btnSecondHarmonic, btnThirdHarmonic, btnHighFreq].forEach(function (btn) {
        btn.classList.remove("active");
    });
    if (activeBtn) {
        activeBtn.classList.add("active");
    }
}

function drawAll() {
    ctx.clearRect(0, 0, cw, ch);
    var t = frameCounter / samplesPerCycle;

    drawAxis();
    drawEnvelope();

    if (showIncidentCheck.checked) {
        drawWave(incidentWave, t, "rgba(59, 130, 246, 0.5)", 1.5);
    }
    if (showReflectedCheck.checked) {
        drawWave(reflectedWave, t, "rgba(168, 85, 247, 0.5)", 1.5);
    }

    drawWave(standingWave, t, getCSSColor('--primary-color'), 3);
    drawNodeMarkers();
}

function animate() {
    if (!timerRunning) return;
    frameCounter++;
    drawAll();
    requestAnimationFrame(animate);
}

btnFundamental.addEventListener("click", function () {
    freqSlider.value = "0.5";
    frequency = 0.5;
    phaseSlider.value = "0";
    phase = 0;
    freqValue.textContent = "0.5 Hz";
    phaseValue.textContent = "0°";
    updateStats();
    updatePresetButtons(btnFundamental);
    if (!timerRunning) drawAll();
});

btnSecondHarmonic.addEventListener("click", function () {
    freqSlider.value = "1";
    frequency = 1;
    phaseSlider.value = "0";
    phase = 0;
    freqValue.textContent = "1.0 Hz";
    phaseValue.textContent = "0°";
    updateStats();
    updatePresetButtons(btnSecondHarmonic);
    if (!timerRunning) drawAll();
});

btnThirdHarmonic.addEventListener("click", function () {
    freqSlider.value = "1.5";
    frequency = 1.5;
    phaseSlider.value = "0";
    phase = 0;
    freqValue.textContent = "1.5 Hz";
    phaseValue.textContent = "0°";
    updateStats();
    updatePresetButtons(btnThirdHarmonic);
    if (!timerRunning) drawAll();
});

btnHighFreq.addEventListener("click", function () {
    freqSlider.value = "3";
    frequency = 3;
    phaseSlider.value = "0";
    phase = 0;
    freqValue.textContent = "3.0 Hz";
    phaseValue.textContent = "0°";
    updateStats();
    updatePresetButtons(btnHighFreq);
    if (!timerRunning) drawAll();
});

freqSlider.addEventListener("input", function () {
    frequency = +freqSlider.value;
    freqValue.textContent = frequency.toFixed(1) + " Hz";
    updateStats();
    updatePresetButtons(null);
    if (!timerRunning) drawAll();
});

phaseSlider.addEventListener("input", function () {
    phase = +phaseSlider.value * Math.PI / 180;
    phaseValue.textContent = phaseSlider.value + "°";
    updateStats();
    updatePresetButtons(null);
    if (!timerRunning) drawAll();
});

boundarySelect.addEventListener("change", function () {
    updateStats();
    if (!timerRunning) drawAll();
});

showIncidentCheck.addEventListener("change", function () {
    if (!timerRunning) drawAll();
});

showReflectedCheck.addEventListener("change", function () {
    if (!timerRunning) drawAll();
});

startStopBtn.addEventListener("click", function () {
    timerRunning = !timerRunning;
    startStopBtn.innerHTML = timerRunning ?
        '<span>⏸️</span> Stop Animation' :
        '<span>▶️</span> Start Animation';
    if (timerRunning) animate();
});

resetBtn.addEventListener("click", function () {
    timerRunning = false;
    startStopBtn.innerHTML = '<span>▶️</span> Start Animation';
    frameCounter = 0;
    freqSlider.value = "1";
    phaseSlider.value = "0";
    frequency = 1;
    phase = 0;
    freqValue.textContent = "1.0 Hz";
    phaseValue.textContent = "0°";
    boundarySelect.value = "fixed";
    showIncidentCheck.checked = false;
    showReflectedCheck.checked = false;
    updateStats();
    updatePresetButtons(btnSecondHarmonic);
    drawAll();
});

updateStats();
drawAll();
