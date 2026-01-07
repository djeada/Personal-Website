"use strict";

const btnConstructive = document.getElementById("btnConstructive");
const btnDestructive = document.getElementById("btnDestructive");
const btnPartial = document.getElementById("btnPartial");
const btnBeating = document.getElementById("btnBeating");

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const cw = canvas.width,
    ch = canvas.height,
    cx = cw / 2,
    cy = ch / 2;

const phaseSlider = document.getElementById("idphase");
const phaseValue = document.getElementById("idphaseValue");
const ampSlider = document.getElementById("idamp");
const ampValue = document.getElementById("idampValue");
const waveSlider = document.getElementById("idwave");
const waveValue = document.getElementById("idwaveValue");
const viewPhasorsCheck = document.getElementById("viewPhasors");
const showWave1Check = document.getElementById("showWave1");
const showWave2Check = document.getElementById("showWave2");
const startStopBtn = document.getElementById("startStopBtn");
const resetBtn = document.getElementById("resetBtn");

const statPhase = document.getElementById("stat-phase");
const statAmplitude = document.getElementById("stat-amplitude");
const statType = document.getElementById("stat-type");
const statMode = document.getElementById("stat-mode");

let timerRunning = false,
    frameCounter = 0,
    phase = +phaseSlider.value * Math.PI / 180,
    ampRatio = +ampSlider.value,
    waveRatio = +waveSlider.value;
const samplesPerCycle = 90;

function getCSSColor(variableName) {
    return getComputedStyle(document.documentElement)
        .getPropertyValue(variableName).trim() || getDefaultColor(variableName);
}

function getDefaultColor(variableName) {
    const defaults = {
        '--text-muted': '#94a3b8',
        '--primary-color': '#ea8400'
    };
    return defaults[variableName] || '#94a3b8';
}

function updateStats() {
    statPhase.textContent = phaseSlider.value + "°";
    statAmplitude.textContent = (+ampSlider.value).toFixed(1);
    statMode.textContent = viewPhasorsCheck.checked ? "Phasors" : "Waves";

    const phaseDeg = +phaseSlider.value;
    let type = "Partial";

    if (phaseDeg < 30 || phaseDeg > 330) {
        type = "Constructive";
    } else if (phaseDeg > 150 && phaseDeg < 210) {
        type = "Destructive";
    }

    if (+waveSlider.value !== 1.0) {
        type = "Beating";
    }

    statType.textContent = type;
}

function updatePresetButtons(activeBtn) {
    [btnConstructive, btnDestructive, btnPartial, btnBeating].forEach(btn => {
        btn.classList.remove("active");
    });
    if (activeBtn) {
        activeBtn.classList.add("active");
    }
}

btnConstructive.addEventListener("click", () => {
    phaseSlider.value = "0";
    ampSlider.value = "1";
    waveSlider.value = "1";
    phase = 0;
    ampRatio = 1;
    waveRatio = 1;
    phaseValue.textContent = "0°";
    ampValue.textContent = "1.0";
    waveValue.textContent = "1.0";
    updateStats();
    updatePresetButtons(btnConstructive);
    drawAll();
});

btnDestructive.addEventListener("click", () => {
    phaseSlider.value = "180";
    ampSlider.value = "1";
    waveSlider.value = "1";
    phase = Math.PI;
    ampRatio = 1;
    waveRatio = 1;
    phaseValue.textContent = "180°";
    ampValue.textContent = "1.0";
    waveValue.textContent = "1.0";
    updateStats();
    updatePresetButtons(btnDestructive);
    drawAll();
});

btnPartial.addEventListener("click", () => {
    phaseSlider.value = "90";
    ampSlider.value = "1";
    waveSlider.value = "1";
    phase = Math.PI / 2;
    ampRatio = 1;
    waveRatio = 1;
    phaseValue.textContent = "90°";
    ampValue.textContent = "1.0";
    waveValue.textContent = "1.0";
    updateStats();
    updatePresetButtons(btnPartial);
    drawAll();
});

btnBeating.addEventListener("click", () => {
    phaseSlider.value = "0";
    ampSlider.value = "1";
    waveSlider.value = "1.1";
    phase = 0;
    ampRatio = 1;
    waveRatio = 1.1;
    phaseValue.textContent = "0°";
    ampValue.textContent = "1.0";
    waveValue.textContent = "1.1";
    updateStats();
    updatePresetButtons(btnBeating);
    drawAll();
});

function drawArrow(ax, ay, bx, by, c) {
    ctx.strokeStyle = c;
    ctx.fillStyle = c;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
    let h = 10,
        dx = bx - ax,
        dy = by - ay,
        A = Math.atan2(dy, dx);
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx - h * Math.cos(A - Math.PI / 6), by - h * Math.sin(A - Math.PI / 6));
    ctx.lineTo(bx - h * Math.cos(A + Math.PI / 6), by - h * Math.sin(A + Math.PI / 6));
    ctx.lineTo(bx, by);
    ctx.fill();
}

function drawAxesWaves() {
    const axisColor = getCSSColor('--text-muted');
    ctx.strokeStyle = axisColor;
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.moveTo(30, cy);
    ctx.lineTo(cw - 30, cy);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(40, 60);
    ctx.lineTo(40, ch - 60);
    ctx.stroke();

    ctx.fillStyle = axisColor;
    ctx.font = "12px Arial";
    ctx.textAlign = "center";
    ctx.fillText("x", cw - 20, cy + 20);
    ctx.fillText("E", 25, 60);
}

function drawWave(amplitude, phaseOffset, wavelengthRatio, color, alpha) {
    const w = 2 * Math.PI * (frameCounter / samplesPerCycle);
    const baseWavelength = (cw - 80) / 3;
    const k = 2 * Math.PI / (baseWavelength * wavelengthRatio);
    const n = 300;
    const startX = 50;
    const endX = cw - 50;
    const yScale = 80;

    ctx.beginPath();
    ctx.globalAlpha = alpha;
    for (let i = 0; i <= n; i++) {
        const x = startX + (endX - startX) * i / n;
        const y = amplitude * Math.sin(k * (x - startX) - w + phaseOffset);
        const px = x;
        const py = cy - y * yScale;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = alpha === 1 ? 3 : 2;
    ctx.stroke();
    ctx.globalAlpha = 1;
}

function drawResultantWave() {
    const w = 2 * Math.PI * (frameCounter / samplesPerCycle);
    const baseWavelength = (cw - 80) / 3;
    const k1 = 2 * Math.PI / baseWavelength;
    const k2 = 2 * Math.PI / (baseWavelength * waveRatio);
    const n = 300;
    const startX = 50;
    const endX = cw - 50;
    const yScale = 80;

    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
        const x = startX + (endX - startX) * i / n;
        const y1 = Math.sin(k1 * (x - startX) - w);
        const y2 = ampRatio * Math.sin(k2 * (x - startX) - w + phase);
        const y = y1 + y2;
        const px = x;
        const py = cy - y * yScale;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.strokeStyle = getCSSColor('--primary-color');
    ctx.lineWidth = 3;
    ctx.stroke();
}

function drawPhasorDiagram() {
    const phasorCx = cx;
    const phasorCy = cy;
    const phasorScale = 80;
    const w = 2 * Math.PI * (frameCounter / samplesPerCycle);

    const axisColor = getCSSColor('--text-muted');
    ctx.strokeStyle = axisColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(phasorCx, phasorCy, phasorScale, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(phasorCx, phasorCy, phasorScale * (1 + ampRatio), 0, 2 * Math.PI);
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.moveTo(phasorCx - phasorScale * 1.5, phasorCy);
    ctx.lineTo(phasorCx + phasorScale * 1.5, phasorCy);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(phasorCx, phasorCy - phasorScale * 1.5);
    ctx.lineTo(phasorCx, phasorCy + phasorScale * 1.5);
    ctx.stroke();

    const angle1 = -w;
    const x1 = phasorCx + phasorScale * Math.cos(angle1);
    const y1 = phasorCy + phasorScale * Math.sin(angle1);
    drawArrow(phasorCx, phasorCy, x1, y1, "#3b82f6");

    const angle2 = -w + phase;
    const x2 = phasorCx + phasorScale * ampRatio * Math.cos(angle2);
    const y2 = phasorCy + phasorScale * ampRatio * Math.sin(angle2);
    drawArrow(phasorCx, phasorCy, x2, y2, "#22c55e");

    const rxRel = Math.cos(angle1) + ampRatio * Math.cos(angle2);
    const ryRel = Math.sin(angle1) + ampRatio * Math.sin(angle2);
    const rx = phasorCx + phasorScale * rxRel;
    const ry = phasorCy + phasorScale * ryRel;
    drawArrow(phasorCx, phasorCy, rx, ry, "#ef4444");

    ctx.font = "14px Arial";
    ctx.fillStyle = "#3b82f6";
    ctx.fillText("E₁", x1 + 15, y1);
    ctx.fillStyle = "#22c55e";
    ctx.fillText("E₂", x2 + 15, y2);
    ctx.fillStyle = "#ef4444";
    ctx.fillText("E_total", rx + 15, ry);

    const resultantMag = Math.sqrt(rxRel * rxRel + ryRel * ryRel);
    ctx.fillStyle = getCSSColor('--text-muted');
    ctx.font = "12px Arial";
    ctx.textAlign = "center";
    ctx.fillText(`|E_total| = ${resultantMag.toFixed(2)}`, phasorCx, phasorCy + phasorScale * 1.8);
}

function drawLegend() {
    const legendX = 60;
    const legendY = 40;
    const lineLength = 30;
    const spacing = 25;

    ctx.font = "12px Arial";

    if (showWave1Check.checked) {
        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.moveTo(legendX, legendY);
        ctx.lineTo(legendX + lineLength, legendY);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#3b82f6";
        ctx.textAlign = "left";
        ctx.fillText("Wave 1", legendX + lineLength + 8, legendY + 4);
    }

    if (showWave2Check.checked) {
        ctx.strokeStyle = "#22c55e";
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.moveTo(legendX, legendY + spacing);
        ctx.lineTo(legendX + lineLength, legendY + spacing);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#22c55e";
        ctx.fillText("Wave 2", legendX + lineLength + 8, legendY + spacing + 4);
    }

    ctx.strokeStyle = getCSSColor('--primary-color');
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(legendX, legendY + spacing * 2);
    ctx.lineTo(legendX + lineLength, legendY + spacing * 2);
    ctx.stroke();
    ctx.fillStyle = getCSSColor('--primary-color');
    ctx.fillText("Resultant", legendX + lineLength + 8, legendY + spacing * 2 + 4);
}

function drawAll() {
    ctx.clearRect(0, 0, cw, ch);

    if (viewPhasorsCheck.checked) {
        drawPhasorDiagram();
    } else {
        drawAxesWaves();

        if (showWave1Check.checked) {
            drawWave(1, 0, 1, "#3b82f6", 0.5);
        }
        if (showWave2Check.checked) {
            drawWave(ampRatio, phase, waveRatio, "#22c55e", 0.5);
        }

        drawResultantWave();
        drawLegend();
    }
}

function animate() {
    if (!timerRunning) return;
    frameCounter++;
    drawAll();
    requestAnimationFrame(animate);
}

phaseSlider.addEventListener("input", () => {
    phase = +phaseSlider.value * Math.PI / 180;
    phaseValue.innerHTML = phaseSlider.value + "°";
    updateStats();
    updatePresetButtons(null);
    if (!timerRunning) drawAll();
});

ampSlider.addEventListener("input", () => {
    ampRatio = +ampSlider.value;
    ampValue.innerHTML = (+ampSlider.value).toFixed(1);
    updateStats();
    updatePresetButtons(null);
    if (!timerRunning) drawAll();
});

waveSlider.addEventListener("input", () => {
    waveRatio = +waveSlider.value;
    waveValue.innerHTML = (+waveSlider.value).toFixed(2);
    updateStats();
    updatePresetButtons(null);
    if (!timerRunning) drawAll();
});

viewPhasorsCheck.addEventListener("change", () => {
    updateStats();
    drawAll();
});

showWave1Check.addEventListener("change", () => {
    drawAll();
});

showWave2Check.addEventListener("change", () => {
    drawAll();
});

startStopBtn.addEventListener("click", () => {
    timerRunning = !timerRunning;
    startStopBtn.innerHTML = timerRunning ?
        '<span>⏸️</span> Stop Animation' :
        '<span>▶️</span> Start Animation';
    if (timerRunning) animate();
});

resetBtn.addEventListener("click", () => {
    timerRunning = false;
    startStopBtn.innerHTML = '<span>▶️</span> Start Animation';
    frameCounter = 0;
    phaseSlider.value = "0";
    ampSlider.value = "1";
    waveSlider.value = "1";
    phase = 0;
    ampRatio = 1;
    waveRatio = 1;
    phaseValue.innerHTML = "0°";
    ampValue.innerHTML = "1.0";
    waveValue.innerHTML = "1.0";
    showWave1Check.checked = true;
    showWave2Check.checked = true;
    viewPhasorsCheck.checked = false;
    updateStats();
    updatePresetButtons(btnConstructive);
    drawAll();
});

updateStats();
drawAll();