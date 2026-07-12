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

function wavelengthToRGB(wl) {
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

    return {
        r,
        g,
        b
    };
}

function rgbString(color, alpha) {
    if (alpha === undefined) {
        return `rgb(${color.r}, ${color.g}, ${color.b})`;
    }
    return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
}

function mixRGB(color, target, amount) {
    return {
        r: Math.round(color.r * (1 - amount) + target.r * amount),
        g: Math.round(color.g * (1 - amount) + target.g * amount),
        b: Math.round(color.b * (1 - amount) + target.b * amount)
    };
}

function isDarkMode() {
    return document.documentElement.classList.contains('dark-mode') ||
        document.body.classList.contains('dark-mode');
}

function getVisibleWaveColor(alpha) {
    const base = wavelengthToRGB(wavelength);
    const adjusted = isDarkMode() ?
        mixRGB(base, {
            r: 255,
            g: 255,
            b: 255
        }, 0.28) :
        mixRGB(base, {
            r: 0,
            g: 0,
            b: 0
        }, 0.34);
    return rgbString(adjusted, alpha);
}

function getWaveHaloColor(alpha) {
    return isDarkMode() ? `rgba(15, 23, 42, ${alpha})` : `rgba(255, 255, 255, ${alpha})`;
}

function getCanvasPalette() {
    if (isDarkMode()) {
        return {
            background: "#111827",
            sourceZone: "rgba(30, 41, 59, 0.62)",
            diffractionZone: "rgba(15, 23, 42, 0.34)",
            grid: "rgba(148, 163, 184, 0.16)",
            axis: "rgba(203, 213, 225, 0.22)",
            labelBg: "rgba(15, 23, 42, 0.86)",
            screen: "rgba(226, 232, 240, 0.74)",
            screenGlow: "rgba(255, 157, 26, 0.16)"
        };
    }
    return {
        background: "#f8fafc",
        sourceZone: "rgba(226, 232, 240, 0.55)",
        diffractionZone: "rgba(255, 255, 255, 0.72)",
        grid: "rgba(100, 116, 139, 0.16)",
        axis: "rgba(100, 116, 139, 0.28)",
        labelBg: "rgba(255, 255, 255, 0.9)",
        screen: "rgba(71, 85, 105, 0.82)",
        screenGlow: "rgba(234, 132, 0, 0.12)"
    };
}

function strokeWavePath(pathBuilder, lineWidth, alpha) {
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.strokeStyle = getWaveHaloColor(Math.min(0.75, alpha + 0.22));
    ctx.lineWidth = lineWidth + 2.5;
    ctx.globalAlpha = 1;
    ctx.beginPath();
    pathBuilder();
    ctx.stroke();

    ctx.strokeStyle = getVisibleWaveColor(alpha);
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    pathBuilder();
    ctx.stroke();
    ctx.restore();
}

function drawRoundRectPath(x, y, width, height, radius) {
    var r = Math.min(radius, width / 2, height / 2);
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
}

function drawLabel(text, x, y, align) {
    ctx.save();
    ctx.font = "11px Arial";
    ctx.textAlign = align || "center";
    ctx.textBaseline = "middle";

    var paddingX = 6;
    var width = ctx.measureText(text).width + paddingX * 2;
    var height = 20;
    var left = x - width / 2;
    if (ctx.textAlign === "left") {
        left = x - paddingX;
    } else if (ctx.textAlign === "right") {
        left = x - width + paddingX;
    }

    ctx.fillStyle = getCanvasPalette().labelBg;
    ctx.strokeStyle = getCSSColor('--border-color');
    ctx.lineWidth = 1;
    ctx.beginPath();
    drawRoundRectPath(left, y - height / 2, width, height, 5);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = getCSSColor('--text-secondary');
    ctx.fillText(text, x, y + 0.5);
    ctx.restore();
}

function drawCanvasStage(barrierX, screenX) {
    var palette = getCanvasPalette();

    ctx.fillStyle = palette.background;
    ctx.fillRect(0, 0, cw, ch);

    ctx.fillStyle = palette.sourceZone;
    ctx.fillRect(0, 0, barrierX, ch);
    ctx.fillStyle = palette.diffractionZone;
    ctx.fillRect(barrierX, 0, screenX - barrierX, ch);

    ctx.strokeStyle = palette.grid;
    ctx.lineWidth = 1;
    for (var x = 0; x <= cw; x += 50) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, ch);
        ctx.stroke();
    }
    for (var y = 0; y <= ch; y += 50) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(cw, y);
        ctx.stroke();
    }

    ctx.strokeStyle = palette.axis;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, ch / 2);
    ctx.lineTo(cw, ch / 2);
    ctx.stroke();
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

    ctx.fillStyle = isDarkMode() ? "#e2e8f0" : "#1e293b";
    ctx.fillRect(barrierX, 0, barrierWidth, cy - slitHeight / 2);
    ctx.fillRect(barrierX, cy + slitHeight / 2, barrierWidth, ch - cy - slitHeight / 2);

    ctx.strokeStyle = getCSSColor('--primary-color');
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(barrierX + barrierWidth / 2, cy - slitHeight / 2);
    ctx.lineTo(barrierX + barrierWidth / 2, cy + slitHeight / 2);
    ctx.stroke();

    if (circularApertureCheck.checked) {

        ctx.strokeStyle = getCSSColor('--primary-color');
        ctx.lineWidth = 2;
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
    var w = 2 * Math.PI * (frameCounter / samplesPerCycle);
    var waveSpacing = getWaveSpacing();

    for (var x = (w % (2 * Math.PI)) * waveSpacing / (2 * Math.PI); x < barrierInfo.x - 10; x += waveSpacing) {
        strokeWavePath(function() {
            ctx.moveTo(x, 50);
            ctx.lineTo(x, ch - 50);
        }, 2.2, 0.9);
    }
}

function drawHuygensWavelets(barrierInfo) {
    if (!showWaveletsCheck.checked) return;

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

    for (var s = 0; s < sources.length; s++) {
        var src = sources[s];
        for (var radius = (w % (2 * Math.PI)) * waveSpacing / (2 * Math.PI); radius < maxRadius; radius += waveSpacing) {
            var alpha = Math.max(0.16, 1 - radius / maxRadius) * 0.68;
            strokeWavePath(function() {
                ctx.arc(src.x, src.y, radius, -Math.PI / 2, Math.PI / 2);
            }, 1.5, alpha);
        }
    }
}

function drawScreen() {
    var screenX = cw - 120;
    var screenW = 8;
    var palette = getCanvasPalette();

    ctx.fillStyle = palette.screenGlow;
    ctx.fillRect(screenX - 16, 20, 32, ch - 40);

    ctx.fillStyle = palette.screen;
    ctx.fillRect(screenX - screenW / 2, 20, screenW, ch - 40);

    drawLabel("Screen", screenX, 16);

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

    ctx.fillStyle = isDarkMode() ? "rgba(15, 23, 42, 0.42)" : "rgba(255, 255, 255, 0.42)";
    ctx.fillRect(screenX - 7, 20, 14, ch - 40);

    for (var y = 20; y < ch - 20; y++) {
        var yPos = y - cy;
        var intensity = getIntensity(yPos, scale);
        var width = 4 + intensity * 8;

        ctx.fillStyle = getVisibleWaveColor(Math.max(0.08, intensity * 0.95));
        ctx.fillRect(screenX - width / 2, y, width, 1);
    }
}

function drawIntensityPlot() {
    if (!showIntensityCheck.checked) return;

    var plotX = cw - 70;
    var plotWidth = 55;
    var plotHeight = ch - 80;
    var cy = ch / 2;

    ctx.fillStyle = getCanvasPalette().labelBg;
    ctx.fillRect(plotX, 40, plotWidth, plotHeight);
    ctx.strokeStyle = getCSSColor('--border-color');
    ctx.lineWidth = 1;
    ctx.strokeRect(plotX, 40, plotWidth, plotHeight);

    var scale = getPatternScale();

    ctx.strokeStyle = getCanvasPalette().axis;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(plotX + 6, cy);
    ctx.lineTo(plotX + plotWidth - 6, cy);
    ctx.stroke();

    ctx.beginPath();
    ctx.strokeStyle = getVisibleWaveColor(0.98);
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

    drawLabel("Intensity", plotX + plotWidth / 2, 55);
}

function drawLabels(barrierInfo, screenX) {
    drawLabel("Incoming waves", 58, ch - 16);
    drawLabel("Aperture", barrierInfo.x, ch - 12);

    ctx.fillStyle = getCSSColor('--primary-color');
    ctx.font = "bold 11px Arial";
    ctx.textAlign = "left";
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

    var midX = (barrierInfo.x + screenX) / 2;
    drawLabel("L = " + screenDistance + " mm", midX, ch - 12);

    ctx.beginPath();
    ctx.strokeStyle = getCanvasPalette().axis;
    ctx.setLineDash([4, 4]);
    ctx.moveTo(barrierInfo.x + 10, ch - 20);
    ctx.lineTo(screenX - 10, ch - 20);
    ctx.stroke();
    ctx.setLineDash([]);
}

function drawLegend() {
    var legendX = 10;
    var legendY = 10;

    ctx.fillStyle = getCanvasPalette().labelBg;
    ctx.strokeStyle = getCSSColor('--border-color');
    ctx.lineWidth = 1;
    ctx.beginPath();
    drawRoundRectPath(legendX, legendY, 128, 54, 6);
    ctx.fill();
    ctx.stroke();

    ctx.font = "11px Arial";
    ctx.fillStyle = getCSSColor('--text-primary');
    ctx.textAlign = "left";
    var modeLabel = circularApertureCheck.checked ? "Airy Disk" : "Single Slit";
    ctx.fillText(modeLabel, legendX + 5, legendY + 15);

    strokeWavePath(function() {
        ctx.moveTo(legendX + 5, legendY + 30);
        ctx.lineTo(legendX + 25, legendY + 30);
    }, 2.2, 0.95);
    ctx.fillStyle = getCSSColor('--text-secondary');
    ctx.fillText("\u03BB = " + wavelength + " nm", legendX + 30, legendY + 33);

    ctx.fillStyle = getCSSColor('--text-muted');
    ctx.font = "10px Arial";
    ctx.fillText("a = " + apertureWidth + " \u03BCm", legendX + 5, legendY + 45);
}

function drawAll() {
    ctx.clearRect(0, 0, cw, ch);

    var barrierX = 125;
    var screenX = cw - 120;
    drawCanvasStage(barrierX, screenX);

    var barrierInfo = drawBarrier();
    screenX = drawScreen();

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