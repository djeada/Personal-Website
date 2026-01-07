"use strict";

const btnVisible = document.getElementById("btnVisible");
const btnNarrow = document.getElementById("btnNarrow");
const btnWide = document.getElementById("btnWide");
const btnFar = document.getElementById("btnFar");

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const cw = canvas.width,
    ch = canvas.height;

const slitSeparationSlider = document.getElementById("slitSeparation");
const slitSepValue = document.getElementById("slitSepValue");
const wavelengthSlider = document.getElementById("wavelength");
const wavelengthValueEl = document.getElementById("wavelengthValue");
const screenDistanceSlider = document.getElementById("screenDistance");
const screenDistValue = document.getElementById("screenDistValue");
const showWavefrontsCheck = document.getElementById("showWavefronts");
const showIntensityCheck = document.getElementById("showIntensity");
const startStopBtn = document.getElementById("startStopBtn");
const resetBtn = document.getElementById("resetBtn");

const statSeparation = document.getElementById("stat-separation");
const statWavelength = document.getElementById("stat-wavelength");
const statDistance = document.getElementById("stat-distance");
const statFringes = document.getElementById("stat-fringes");

let timerRunning = false,
    frameCounter = 0;
let slitSeparation = +slitSeparationSlider.value;
let wavelength = +wavelengthSlider.value;
let screenDistance = +screenDistanceSlider.value;

const samplesPerCycle = 60;

function getCSSColor(variableName) {
    return getComputedStyle(document.documentElement)
        .getPropertyValue(variableName).trim() || getDefaultColor(variableName);
}

function getDefaultColor(variableName) {
    const defaults = {
        '--border-color': '#e2e8f0',
        '--text-primary': '#1e293b',
        '--text-secondary': '#64748b',
        '--text-muted': '#94a3b8',
        '--primary-color': '#ea8400'
    };
    return defaults[variableName] || '#94a3b8';
}

function wavelengthToColor(wl) {
    let r, g, b;
    if (wl >= 380 && wl < 440) {
        r = -(wl - 440) / (440 - 380);
        g = 0;
        b = 1;
    } else if (wl >= 440 && wl < 490) {
        r = 0;
        g = (wl - 440) / (490 - 440);
        b = 1;
    } else if (wl >= 490 && wl < 510) {
        r = 0;
        g = 1;
        b = -(wl - 510) / (510 - 490);
    } else if (wl >= 510 && wl < 580) {
        r = (wl - 510) / (580 - 510);
        g = 1;
        b = 0;
    } else if (wl >= 580 && wl < 645) {
        r = 1;
        g = -(wl - 645) / (645 - 580);
        b = 0;
    } else if (wl >= 645 && wl <= 700) {
        r = 1;
        g = 0;
        b = 0;
    } else {
        r = 0;
        g = 0;
        b = 0;
    }

    let factor;
    if (wl >= 380 && wl < 420) {
        factor = 0.3 + 0.7 * (wl - 380) / (420 - 380);
    } else if (wl >= 420 && wl <= 700) {
        factor = 1.0;
    } else if (wl > 700 && wl <= 780) {
        factor = 0.3 + 0.7 * (780 - wl) / (780 - 700);
    } else {
        factor = 0;
    }

    r = Math.round(255 * Math.pow(r * factor, 0.8));
    g = Math.round(255 * Math.pow(g * factor, 0.8));
    b = Math.round(255 * Math.pow(b * factor, 0.8));

    return `rgb(${r}, ${g}, ${b})`;
}

function updateStats() {
    statSeparation.textContent = slitSeparation + " nm";
    statWavelength.textContent = wavelength + " nm";
    statDistance.textContent = screenDistance + " mm";

    const fringeSpacing = (wavelength * screenDistance * 1000) / slitSeparation;
    const visibleFringes = Math.floor((ch / 2) / (fringeSpacing * 0.02)) * 2 + 1;
    statFringes.textContent = Math.min(visibleFringes, 25);
}

function getFringeScale() {
    const spacing = (wavelength * screenDistance) / slitSeparation;
    return Math.max(6, spacing * 0.02);
}

function updatePresetButtons(activeBtn) {
    [btnVisible, btnNarrow, btnWide, btnFar].forEach(btn => {
        btn.classList.remove("active");
    });
    if (activeBtn) {
        activeBtn.classList.add("active");
    }
}

btnVisible.addEventListener("click", () => {
    slitSeparationSlider.value = "50";
    wavelengthSlider.value = "550";
    screenDistanceSlider.value = "100";
    slitSeparation = 50;
    wavelength = 550;
    screenDistance = 100;
    slitSepValue.textContent = "50 nm";
    wavelengthValueEl.textContent = "550 nm";
    screenDistValue.textContent = "100 mm";
    updateStats();
    updatePresetButtons(btnVisible);
    drawAll();
});

btnNarrow.addEventListener("click", () => {
    slitSeparationSlider.value = "20";
    wavelengthSlider.value = "500";
    screenDistanceSlider.value = "100";
    slitSeparation = 20;
    wavelength = 500;
    screenDistance = 100;
    slitSepValue.textContent = "20 nm";
    wavelengthValueEl.textContent = "500 nm";
    screenDistValue.textContent = "100 mm";
    updateStats();
    updatePresetButtons(btnNarrow);
    drawAll();
});

btnWide.addEventListener("click", () => {
    slitSeparationSlider.value = "150";
    wavelengthSlider.value = "500";
    screenDistanceSlider.value = "100";
    slitSeparation = 150;
    wavelength = 500;
    screenDistance = 100;
    slitSepValue.textContent = "150 nm";
    wavelengthValueEl.textContent = "500 nm";
    screenDistValue.textContent = "100 mm";
    updateStats();
    updatePresetButtons(btnWide);
    drawAll();
});

btnFar.addEventListener("click", () => {
    slitSeparationSlider.value = "50";
    wavelengthSlider.value = "500";
    screenDistanceSlider.value = "250";
    slitSeparation = 50;
    wavelength = 500;
    screenDistance = 250;
    slitSepValue.textContent = "50 nm";
    wavelengthValueEl.textContent = "500 nm";
    screenDistValue.textContent = "250 mm";
    updateStats();
    updatePresetButtons(btnFar);
    drawAll();
});

function drawBarrier() {
    const barrierX = 120;
    const barrierWidth = 10;
    const slitHeight = 15;
    const slitGap = slitSeparation * 0.6;
    const cy = ch / 2;

    ctx.fillStyle = "#1e293b";
    ctx.fillRect(barrierX, 0, barrierWidth, cy - slitGap / 2 - slitHeight);
    ctx.fillRect(barrierX, cy - slitGap / 2, barrierWidth, slitGap - slitHeight);
    ctx.fillRect(barrierX, cy + slitGap / 2, barrierWidth, ch - cy - slitGap / 2);

    ctx.strokeStyle = getCSSColor('--primary-color');
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(barrierX + barrierWidth / 2, cy - slitGap / 2 - slitHeight);
    ctx.lineTo(barrierX + barrierWidth / 2, cy - slitGap / 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(barrierX + barrierWidth / 2, cy + slitGap / 2);
    ctx.lineTo(barrierX + barrierWidth / 2, cy + slitGap / 2 + slitHeight);
    ctx.stroke();

    return {
        x: barrierX + barrierWidth / 2,
        slit1Y: cy - slitGap / 2 - slitHeight / 2,
        slit2Y: cy + slitGap / 2 + slitHeight / 2
    };
}

function drawWavefronts(slitInfo) {
    if (!showWavefrontsCheck.checked) return;

    const waveColor = wavelengthToColor(wavelength);
    const w = 2 * Math.PI * (frameCounter / samplesPerCycle);
    const waveSpacing = wavelength * 0.08;
    const maxRadius = cw - slitInfo.x;

    ctx.lineWidth = 1.5;

    for (let radius = (w % (2 * Math.PI)) * waveSpacing / (2 * Math.PI); radius < maxRadius; radius += waveSpacing) {
        const alpha = Math.max(0.1, 1 - radius / maxRadius);

        ctx.strokeStyle = waveColor;
        ctx.globalAlpha = alpha * 0.6;

        ctx.beginPath();
        ctx.arc(slitInfo.x, slitInfo.slit1Y, radius, -Math.PI / 2, Math.PI / 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(slitInfo.x, slitInfo.slit2Y, radius, -Math.PI / 2, Math.PI / 2);
        ctx.stroke();
    }

    ctx.globalAlpha = 1;
}

function drawIncomingWaves(slitInfo) {
    const waveColor = wavelengthToColor(wavelength);
    const w = 2 * Math.PI * (frameCounter / samplesPerCycle);
    const waveSpacing = wavelength * 0.08;

    ctx.lineWidth = 2;
    ctx.strokeStyle = waveColor;
    ctx.globalAlpha = 0.7;

    for (let x = (w % (2 * Math.PI)) * waveSpacing / (2 * Math.PI); x < slitInfo.x - 10; x += waveSpacing) {
        ctx.beginPath();
        ctx.moveTo(x, 50);
        ctx.lineTo(x, ch - 50);
        ctx.stroke();
    }

    ctx.globalAlpha = 1;
}

function drawScreen() {
    const screenX = cw - 120;
    const screenWidth = 8;
    const cy = ch / 2;

    ctx.fillStyle = "#334155";
    ctx.fillRect(screenX - screenWidth / 2, 20, screenWidth, ch - 40);

    ctx.fillStyle = getCSSColor('--text-muted');
    ctx.font = "12px Arial";
    ctx.textAlign = "center";
    ctx.fillText("Screen", screenX, 15);

    return screenX;
}

function drawIntensityPattern(screenX, slitInfo) {
    const cy = ch / 2;
    const scale = getFringeScale();
    const waveColor = wavelengthToColor(wavelength);

    ctx.lineWidth = 2;

    for (let y = 20; y < ch - 20; y++) {
        const yPos = y - cy;
        const intensity = Math.pow(Math.cos(Math.PI * yPos / scale), 2);

        ctx.fillStyle = waveColor;
        ctx.globalAlpha = intensity * 0.9;
        ctx.fillRect(screenX - 4, y, 8, 1);
    }

    ctx.globalAlpha = 1;
}

function drawIntensityPlot(slitInfo) {
    if (!showIntensityCheck.checked) return;

    const plotX = cw - 70;
    const plotWidth = 55;
    const plotHeight = ch - 80;
    const cy = ch / 2;

    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.fillRect(plotX, 40, plotWidth, plotHeight);
    ctx.strokeStyle = getCSSColor('--border-color');
    ctx.lineWidth = 1;
    ctx.strokeRect(plotX, 40, plotWidth, plotHeight);

    const scale = getFringeScale();

    ctx.beginPath();
    ctx.strokeStyle = getCSSColor('--primary-color');
    ctx.lineWidth = 2;

    for (let y = 40; y < 40 + plotHeight; y++) {
        const yPos = y - cy;
        const intensity = Math.pow(Math.cos(Math.PI * yPos / scale), 2);

        const x = plotX + 6 + intensity * (plotWidth - 12);
        if (y === 40) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }
    ctx.stroke();

    ctx.fillStyle = getCSSColor('--text-muted');
    ctx.font = "10px Arial";
    ctx.textAlign = "center";
    ctx.fillText("Intensity", plotX + plotWidth / 2, 55);
}

function drawLabels(slitInfo, screenX) {
    ctx.fillStyle = getCSSColor('--text-muted');
    ctx.font = "11px Arial";
    ctx.textAlign = "left";

    ctx.fillText("Incoming", 10, ch - 15);
    ctx.fillText("Waves", 10, ch - 3);

    ctx.textAlign = "center";
    ctx.fillText("Slits", slitInfo.x, ch - 8);

    const cy = ch / 2;
    const slitGap = slitSeparation * 0.6;
    ctx.font = "10px Arial";
    ctx.fillStyle = getCSSColor('--primary-color');
    ctx.fillText("d", slitInfo.x + 20, cy);

    ctx.beginPath();
    ctx.strokeStyle = getCSSColor('--primary-color');
    ctx.setLineDash([3, 3]);
    ctx.moveTo(slitInfo.x + 5, slitInfo.slit1Y);
    ctx.lineTo(slitInfo.x + 15, slitInfo.slit1Y);
    ctx.lineTo(slitInfo.x + 15, slitInfo.slit2Y);
    ctx.lineTo(slitInfo.x + 5, slitInfo.slit2Y);
    ctx.stroke();
    ctx.setLineDash([]);
}

function drawLegend() {
    const legendX = 10;
    const legendY = 10;

    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.fillRect(legendX, legendY, 100, 50);
    ctx.strokeStyle = getCSSColor('--border-color');
    ctx.lineWidth = 1;
    ctx.strokeRect(legendX, legendY, 100, 50);

    ctx.font = "11px Arial";
    ctx.fillStyle = getCSSColor('--text-primary');
    ctx.textAlign = "left";
    ctx.fillText("Legend:", legendX + 5, legendY + 15);

    const waveColor = wavelengthToColor(wavelength);
    ctx.strokeStyle = waveColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(legendX + 5, legendY + 30);
    ctx.lineTo(legendX + 25, legendY + 30);
    ctx.stroke();
    ctx.fillStyle = getCSSColor('--text-secondary');
    ctx.fillText("λ = " + wavelength + " nm", legendX + 30, legendY + 33);

    ctx.fillStyle = getCSSColor('--text-muted');
    ctx.font = "10px Arial";
    ctx.fillText("Wavefronts", legendX + 5, legendY + 45);
}

function drawAll() {
    ctx.clearRect(0, 0, cw, ch);

    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, cw, ch);

    const slitInfo = drawBarrier();
    const screenX = drawScreen();

    drawIncomingWaves(slitInfo);
    drawWavefronts(slitInfo);
    drawIntensityPattern(screenX, slitInfo);
    drawIntensityPlot(slitInfo);
    drawLabels(slitInfo, screenX);
    drawLegend();
}

function animate() {
    if (!timerRunning) return;
    frameCounter++;
    drawAll();
    requestAnimationFrame(animate);
}

slitSeparationSlider.addEventListener("input", () => {
    slitSeparation = +slitSeparationSlider.value;
    slitSepValue.textContent = slitSeparation + " nm";
    updateStats();
    updatePresetButtons(null);
    if (!timerRunning) drawAll();
});

wavelengthSlider.addEventListener("input", () => {
    wavelength = +wavelengthSlider.value;
    wavelengthValueEl.textContent = wavelength + " nm";
    updateStats();
    updatePresetButtons(null);
    if (!timerRunning) drawAll();
});

screenDistanceSlider.addEventListener("input", () => {
    screenDistance = +screenDistanceSlider.value;
    screenDistValue.textContent = screenDistance + " mm";
    updateStats();
    updatePresetButtons(null);
    if (!timerRunning) drawAll();
});

showWavefrontsCheck.addEventListener("change", () => {
    drawAll();
});

showIntensityCheck.addEventListener("change", () => {
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
    slitSeparationSlider.value = "50";
    wavelengthSlider.value = "500";
    screenDistanceSlider.value = "100";
    slitSeparation = 50;
    wavelength = 500;
    screenDistance = 100;
    slitSepValue.textContent = "50 nm";
    wavelengthValueEl.textContent = "500 nm";
    screenDistValue.textContent = "100 mm";
    showWavefrontsCheck.checked = true;
    showIntensityCheck.checked = true;
    updateStats();
    updatePresetButtons(btnVisible);
    drawAll();
});

updateStats();
drawAll();