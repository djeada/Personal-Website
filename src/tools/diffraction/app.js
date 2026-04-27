"use strict";

const btnDefault = document.getElementById("btnDefault");
const btnNarrow = document.getElementById("btnNarrow");
const btnWide = document.getElementById("btnWide");
const btnCircular = document.getElementById("btnCircular");

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const cw = canvas.width,
    ch = canvas.height;

const apertureWidthSlider = document.getElementById("apertureWidth");
const apertureValueEl = document.getElementById("apertureValue");
const wavelengthSlider = document.getElementById("wavelength");
const wavelengthValueEl = document.getElementById("wavelengthValue");
const screenDistanceSlider = document.getElementById("screenDistance");
const screenDistValueEl = document.getElementById("screenDistValue");
const showWaveletsCheck = document.getElementById("showWavelets");
const showIntensityCheck = document.getElementById("showIntensity");
const circularApertureCheck = document.getElementById("circularAperture");
const startStopBtn = document.getElementById("startStopBtn");
const resetBtn = document.getElementById("resetBtn");

const statAperture = document.getElementById("stat-aperture");
const statWavelength = document.getElementById("stat-wavelength");
const statDistance = document.getElementById("stat-distance");
const statPattern = document.getElementById("stat-pattern");

let timerRunning = false,
    frameCounter = 0;
let apertureWidth = +apertureWidthSlider.value;
let wavelength = +wavelengthSlider.value;
let screenDistance = +screenDistanceSlider.value;

const samplesPerCycle = 60;


const WAVE_SPACING_FACTOR = 0.08;

function getCSSColor(variableName) {
    return getComputedStyle(document.body)
        .getPropertyValue(variableName).trim() || getDefaultColor(variableName);
}

function getDefaultColor(variableName) {
    const dark = document.documentElement.classList.contains('dark-mode') ||
        document.body.classList.contains('dark-mode');
    const defaults = dark ? {
        '--border-color': '#475569',
        '--text-primary': '#f1f5f9',
        '--text-secondary': '#cbd5e1',
        '--text-muted': '#94a3b8',
        '--primary-color': '#ff9d1a',
        '--surface-color': '#1e293b',
        '--surface-elevated': '#334155'
    } : {
        '--border-color': '#e2e8f0',
        '--text-primary': '#1e293b',
        '--text-secondary': '#64748b',
        '--text-muted': '#94a3b8',
        '--primary-color': '#ea8400',
        '--surface-color': '#ffffff',
        '--surface-elevated': '#f8fafc'
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


function besselJ1(x) {
    const ax = Math.abs(x);
    if (ax < 8.0) {
        const y = x * x;
        const ans1 = x * (72362614232.0 + y * (-7895059235.0 + y * (242396853.1 +
            y * (-2972611.439 + y * (15704.48260 + y * (-30.16036606))))));
        const ans2 = 144725228442.0 + y * (2300535178.0 + y * (18583304.74 +
            y * (99447.43394 + y * (376.9991397 + y))));
        return ans1 / ans2;
    } else {
        const z = 8.0 / ax;
        const y = z * z;
        const xx = ax - 2.356194491;
        const p0 = 1.0 + y * (0.183105e-2 + y * (-0.3516396496e-4 +
            y * (0.2457520174e-5 + y * (-0.240337019e-6))));
        const q0 = 0.04687499995 + y * (-0.2002690873e-3 + y * (0.8449199096e-5 +
            y * (-0.88228987e-6 + y * 0.105787412e-6)));
        const ans = Math.sqrt(0.636619772 / ax) * (Math.cos(xx) * p0 - z * Math.sin(xx) * q0);
        return x < 0 ? -ans : ans;
    }
}

function updateStats() {
    statAperture.textContent = apertureWidth + " \u03BCm";
    statWavelength.textContent = wavelength + " nm";
    statDistance.textContent = screenDistance + " mm";
    statPattern.textContent = circularApertureCheck.checked ? "Circular" : "Single Slit";
}

function getPatternScale() {

    const lambdaMicron = wavelength / 1000;
    const ratio = lambdaMicron / apertureWidth;
    return ratio * screenDistance * 1.8;
}

function updatePresetButtons(activeBtn) {
    [btnDefault, btnNarrow, btnWide, btnCircular].forEach(function(btn) {
        btn.classList.remove("active");
    });
    if (activeBtn) {
        activeBtn.classList.add("active");
    }
}

function applyPreset(aw, wl, sd, circular, activeBtn) {
    apertureWidthSlider.value = String(aw);
    wavelengthSlider.value = String(wl);
    screenDistanceSlider.value = String(sd);
    apertureWidth = aw;
    wavelength = wl;
    screenDistance = sd;
    circularApertureCheck.checked = circular;
    apertureValueEl.textContent = aw + " \u03BCm";
    wavelengthValueEl.textContent = wl + " nm";
    screenDistValueEl.textContent = sd + " mm";
    updateStats();
    updatePresetButtons(activeBtn);
    drawAll();
}

btnDefault.addEventListener("click", function() {
    applyPreset(50, 550, 200, false, btnDefault);
});

btnNarrow.addEventListener("click", function() {
    applyPreset(20, 550, 200, false, btnNarrow);
});

btnWide.addEventListener("click", function() {
    applyPreset(150, 550, 200, false, btnWide);
});

btnCircular.addEventListener("click", function() {
    applyPreset(50, 550, 200, true, btnCircular);
});

function getWaveSpacing() {
    var spacing = wavelength * WAVE_SPACING_FACTOR;
    return Math.max(12, Math.min(spacing, 50));
}

function drawBarrier() {
    var barrierX = 120;
    var barrierWidth = 10;
    var slitHeight = apertureWidth * 0.4;
    slitHeight = Math.max(8, Math.min(slitHeight, 80));
    var cy = ch / 2;

    ctx.fillStyle = getCSSColor('--text-primary');
    ctx.fillRect(barrierX, 0, barrierWidth, cy - slitHeight / 2);
    ctx.fillRect(barrierX, cy + slitHeight / 2, barrierWidth, ch - cy - slitHeight / 2);


    ctx.strokeStyle = getCSSColor('--primary-color');
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(barrierX + barrierWidth / 2, cy - slitHeight / 2);
    ctx.lineTo(barrierX + barrierWidth / 2, cy + slitHeight / 2);
    ctx.stroke();

    if (circularApertureCheck.checked) {

        ctx.strokeStyle = getCSSColor('--primary-color');
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(barrierX + barrierWidth / 2, cy, slitHeight / 2, 0, 2 * Math.PI);
        ctx.stroke();
    }

    return {
        x: barrierX + barrierWidth / 2,
        y: cy,
        halfWidth: slitHeight / 2
    };
}

function drawIncomingWaves(barrierInfo) {
    var waveColor = wavelengthToColor(wavelength);
    var w = 2 * Math.PI * (frameCounter / samplesPerCycle);
    var waveSpacing = getWaveSpacing();

    ctx.lineWidth = 2;
    ctx.strokeStyle = waveColor;
    ctx.globalAlpha = 0.7;

    for (var x = (w % (2 * Math.PI)) * waveSpacing / (2 * Math.PI); x < barrierInfo.x - 10; x += waveSpacing) {
        ctx.beginPath();
        ctx.moveTo(x, 50);
        ctx.lineTo(x, ch - 50);
        ctx.stroke();
    }

    ctx.globalAlpha = 1;
}

function drawHuygensWavelets(barrierInfo) {
    if (!showWaveletsCheck.checked) return;

    var waveColor = wavelengthToColor(wavelength);
    var w = 2 * Math.PI * (frameCounter / samplesPerCycle);
    var waveSpacing = getWaveSpacing();
    var maxRadius = cw - barrierInfo.x;


    var numSources = 7;
    var sources = [];
    for (var i = 0; i < numSources; i++) {
        var frac = (i / (numSources - 1)) - 0.5;
        sources.push({
            x: barrierInfo.x,
            y: barrierInfo.y + frac * 2 * barrierInfo.halfWidth
        });
    }

    ctx.lineWidth = 1.2;

    for (var s = 0; s < sources.length; s++) {
        var src = sources[s];
        for (var radius = (w % (2 * Math.PI)) * waveSpacing / (2 * Math.PI); radius < maxRadius; radius += waveSpacing) {
            var alpha = Math.max(0.05, 1 - radius / maxRadius);
            ctx.strokeStyle = waveColor;
            ctx.globalAlpha = alpha * 0.35;
            ctx.beginPath();
            ctx.arc(src.x, src.y, radius, -Math.PI / 2, Math.PI / 2);
            ctx.stroke();
        }
    }

    ctx.globalAlpha = 1;
}

function drawScreen() {
    var screenX = cw - 120;
    var screenW = 8;

    ctx.fillStyle = getCSSColor('--text-secondary');
    ctx.fillRect(screenX - screenW / 2, 20, screenW, ch - 40);

    ctx.fillStyle = getCSSColor('--text-muted');
    ctx.font = "12px Arial";
    ctx.textAlign = "center";
    ctx.fillText("Screen", screenX, 15);

    return screenX;
}


function slitIntensity(yPos, scale) {
    if (scale === 0) return 1;
    var beta = Math.PI * yPos / scale;
    if (Math.abs(beta) < 1e-6) return 1;
    var sinc = Math.sin(beta) / beta;
    return sinc * sinc;
}


function airyIntensity(yPos, scale) {
    if (scale === 0) return 1;

    var x = Math.PI * yPos / (scale * 0.82);
    if (Math.abs(x) < 1e-6) return 1;
    var val = 2 * besselJ1(x) / x;
    return val * val;
}

function getIntensity(yPos, scale) {
    if (circularApertureCheck.checked) {
        return airyIntensity(yPos, scale);
    }
    return slitIntensity(yPos, scale);
}

function drawIntensityOnScreen(screenX) {
    var cy = ch / 2;
    var scale = getPatternScale();
    var waveColor = wavelengthToColor(wavelength);

    ctx.lineWidth = 2;

    for (var y = 20; y < ch - 20; y++) {
        var yPos = y - cy;
        var intensity = getIntensity(yPos, scale);

        ctx.fillStyle = waveColor;
        ctx.globalAlpha = intensity * 0.9;
        ctx.fillRect(screenX - 4, y, 8, 1);
    }

    ctx.globalAlpha = 1;
}

function drawIntensityPlot() {
    if (!showIntensityCheck.checked) return;

    var plotX = cw - 70;
    var plotWidth = 55;
    var plotHeight = ch - 80;
    var cy = ch / 2;

    ctx.fillStyle = getCSSColor('--surface-color');
    ctx.globalAlpha = 0.9;
    ctx.fillRect(plotX, 40, plotWidth, plotHeight);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = getCSSColor('--border-color');
    ctx.lineWidth = 1;
    ctx.strokeRect(plotX, 40, plotWidth, plotHeight);

    var scale = getPatternScale();

    ctx.beginPath();
    ctx.strokeStyle = getCSSColor('--primary-color');
    ctx.lineWidth = 2;

    for (var y = 40; y < 40 + plotHeight; y++) {
        var yPos = y - cy;
        var intensity = getIntensity(yPos, scale);
        var x = plotX + 6 + intensity * (plotWidth - 12);
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

function drawLabels(barrierInfo, screenX) {
    ctx.fillStyle = getCSSColor('--text-muted');
    ctx.font = "11px Arial";
    ctx.textAlign = "left";

    ctx.fillText("Incoming", 10, ch - 15);
    ctx.fillText("Waves", 10, ch - 3);

    ctx.textAlign = "center";
    ctx.fillText("Aperture", barrierInfo.x, ch - 8);


    ctx.font = "10px Arial";
    ctx.fillStyle = getCSSColor('--primary-color');
    ctx.fillText("a", barrierInfo.x + 20, barrierInfo.y);


    ctx.beginPath();
    ctx.strokeStyle = getCSSColor('--primary-color');
    ctx.setLineDash([3, 3]);
    ctx.moveTo(barrierInfo.x + 5, barrierInfo.y - barrierInfo.halfWidth);
    ctx.lineTo(barrierInfo.x + 15, barrierInfo.y - barrierInfo.halfWidth);
    ctx.lineTo(barrierInfo.x + 15, barrierInfo.y + barrierInfo.halfWidth);
    ctx.lineTo(barrierInfo.x + 5, barrierInfo.y + barrierInfo.halfWidth);
    ctx.stroke();
    ctx.setLineDash([]);


    ctx.fillStyle = getCSSColor('--text-muted');
    ctx.font = "10px Arial";
    ctx.textAlign = "center";
    var midX = (barrierInfo.x + screenX) / 2;
    ctx.fillText("L = " + screenDistance + " mm", midX, ch - 8);

    ctx.beginPath();
    ctx.strokeStyle = getCSSColor('--text-muted');
    ctx.setLineDash([4, 4]);
    ctx.moveTo(barrierInfo.x + 10, ch - 20);
    ctx.lineTo(screenX - 10, ch - 20);
    ctx.stroke();
    ctx.setLineDash([]);
}

function drawLegend() {
    var legendX = 10;
    var legendY = 10;

    ctx.fillStyle = getCSSColor('--surface-color');
    ctx.globalAlpha = 0.9;
    ctx.fillRect(legendX, legendY, 120, 50);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = getCSSColor('--border-color');
    ctx.lineWidth = 1;
    ctx.strokeRect(legendX, legendY, 120, 50);

    ctx.font = "11px Arial";
    ctx.fillStyle = getCSSColor('--text-primary');
    ctx.textAlign = "left";
    var modeLabel = circularApertureCheck.checked ? "Airy Disk" : "Single Slit";
    ctx.fillText(modeLabel, legendX + 5, legendY + 15);

    var waveColor = wavelengthToColor(wavelength);
    ctx.strokeStyle = waveColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(legendX + 5, legendY + 30);
    ctx.lineTo(legendX + 25, legendY + 30);
    ctx.stroke();
    ctx.fillStyle = getCSSColor('--text-secondary');
    ctx.fillText("\u03BB = " + wavelength + " nm", legendX + 30, legendY + 33);

    ctx.fillStyle = getCSSColor('--text-muted');
    ctx.font = "10px Arial";
    ctx.fillText("a = " + apertureWidth + " \u03BCm", legendX + 5, legendY + 45);
}

function drawAll() {
    ctx.clearRect(0, 0, cw, ch);

    ctx.fillStyle = getCSSColor('--surface-elevated');
    ctx.fillRect(0, 0, cw, ch);

    var barrierInfo = drawBarrier();
    var screenX = drawScreen();

    drawIncomingWaves(barrierInfo);
    drawHuygensWavelets(barrierInfo);
    drawIntensityOnScreen(screenX);
    drawIntensityPlot();
    drawLabels(barrierInfo, screenX);
    drawLegend();
}

function animate() {
    if (!timerRunning) return;
    frameCounter++;
    drawAll();
    requestAnimationFrame(animate);
}



apertureWidthSlider.addEventListener("input", function() {
    apertureWidth = +apertureWidthSlider.value;
    apertureValueEl.textContent = apertureWidth + " \u03BCm";
    updateStats();
    updatePresetButtons(null);
    if (!timerRunning) drawAll();
});

wavelengthSlider.addEventListener("input", function() {
    wavelength = +wavelengthSlider.value;
    wavelengthValueEl.textContent = wavelength + " nm";
    updateStats();
    updatePresetButtons(null);
    if (!timerRunning) drawAll();
});

screenDistanceSlider.addEventListener("input", function() {
    screenDistance = +screenDistanceSlider.value;
    screenDistValueEl.textContent = screenDistance + " mm";
    updateStats();
    updatePresetButtons(null);
    if (!timerRunning) drawAll();
});

showWaveletsCheck.addEventListener("change", function() {
    drawAll();
});

showIntensityCheck.addEventListener("change", function() {
    drawAll();
});

circularApertureCheck.addEventListener("change", function() {
    updateStats();
    updatePresetButtons(null);
    drawAll();
});

startStopBtn.addEventListener("click", function() {
    timerRunning = !timerRunning;
    startStopBtn.innerHTML = timerRunning ?
        '<span>\u23F8\uFE0F</span> Stop Animation' :
        '<span>\u25B6\uFE0F</span> Start Animation';
    if (timerRunning) animate();
});

resetBtn.addEventListener("click", function() {
    timerRunning = false;
    startStopBtn.innerHTML = '<span>\u25B6\uFE0F</span> Start Animation';
    frameCounter = 0;
    applyPreset(50, 550, 200, false, btnDefault);
    showWaveletsCheck.checked = true;
    showIntensityCheck.checked = true;
});


updateStats();
drawAll();


var darkModeRedrawTimer = null;

function onDarkModeChange() {
    if (darkModeRedrawTimer) return;
    darkModeRedrawTimer = requestAnimationFrame(function() {
        darkModeRedrawTimer = null;
        drawAll();
    });
}
new MutationObserver(onDarkModeChange).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class']
});
new MutationObserver(onDarkModeChange).observe(document.body, {
    attributes: true,
    attributeFilter: ['class']
});