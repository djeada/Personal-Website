"use strict";


const btnLinear = document.getElementById("btnLinear");
const btnCircularRight = document.getElementById("btnCircularRight");
const btnCircularLeft = document.getElementById("btnCircularLeft");
const btnElliptical = document.getElementById("btnElliptical");

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const cw = canvas.width,
    ch = canvas.height,
    cx = cw / 2,
    cy = ch / 2;

const psiSlider = document.getElementById("idpsi");
const psiValue = document.getElementById("idpsiValue");
const deltaSlider = document.getElementById("iddelta");
const deltaValue = document.getElementById("iddeltaValue");
const viewMode3DCheck = document.getElementById("viewMode3D");
const startStopBtn = document.getElementById("startStopBtn");
const resetBtn = document.getElementById("resetBtn");


const statPsi = document.getElementById("stat-psi");
const statDelta = document.getElementById("stat-delta");
const statType = document.getElementById("stat-type");
const statMode = document.getElementById("stat-mode");


let timerRunning = false,
    frameCounter = 0,
    psi = +psiSlider.value * Math.PI / 180,
    delta = +deltaSlider.value * Math.PI / 180;
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
    statPsi.textContent = psiSlider.value + "°";
    statDelta.textContent = deltaSlider.value + "°";
    statMode.textContent = viewMode3DCheck.checked ? "3D" : "2D";


    const psiDeg = +psiSlider.value;
    const deltaDeg = +deltaSlider.value;
    let type = "Elliptical";

    if (Math.abs(deltaDeg) < 5 || Math.abs(Math.abs(deltaDeg) - 180) < 5) {
        type = "Linear";
    } else if (Math.abs(psiDeg - 45) < 5 && (Math.abs(Math.abs(deltaDeg) - 90) < 5)) {
        type = "Circular";
    }

    statType.textContent = type;
}


function updatePresetButtons(activeBtn) {
    [btnLinear, btnCircularRight, btnCircularLeft, btnElliptical].forEach(btn => {
        btn.classList.remove("active");
    });
    if (activeBtn) {
        activeBtn.classList.add("active");
    }
}


btnLinear.addEventListener("click", () => {
    psiSlider.value = "45";
    deltaSlider.value = "0";
    psi = 45 * Math.PI / 180;
    delta = 0;
    psiValue.textContent = "45°";
    deltaValue.textContent = "0°";
    updateStats();
    updatePresetButtons(btnLinear);
    drawAll();
});

btnCircularRight.addEventListener("click", () => {
    psiSlider.value = "45";
    deltaSlider.value = "90";
    psi = 45 * Math.PI / 180;
    delta = 90 * Math.PI / 180;
    psiValue.textContent = "45°";
    deltaValue.textContent = "90°";
    updateStats();
    updatePresetButtons(btnCircularRight);
    drawAll();
});

btnCircularLeft.addEventListener("click", () => {
    psiSlider.value = "45";
    deltaSlider.value = "-90";
    psi = 45 * Math.PI / 180;
    delta = -90 * Math.PI / 180;
    psiValue.textContent = "45°";
    deltaValue.textContent = "-90°";
    updateStats();
    updatePresetButtons(btnCircularLeft);
    drawAll();
});

btnElliptical.addEventListener("click", () => {
    psiSlider.value = "30";
    deltaSlider.value = "60";
    psi = 30 * Math.PI / 180;
    delta = 60 * Math.PI / 180;
    psiValue.textContent = "30°";
    deltaValue.textContent = "60°";
    updateStats();
    updatePresetButtons(btnElliptical);
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
    let h = 12,
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

function drawAxes2D() {
    ctx.strokeStyle = getCSSColor('--text-muted');
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(20, cy);
    ctx.lineTo(cw - 20, cy);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, 20);
    ctx.lineTo(cx, ch - 20);
    ctx.stroke();


    ctx.fillStyle = ctx.strokeStyle;
    ctx.font = "14px Arial";
    ctx.textAlign = "center";
    ctx.fillText("x", cw - 30, cy + 20);
    ctx.fillText("y", cx + 20, 30);
}

function drawEllipse2D() {
    let n = 180,
        cp = Math.cos(psi),
        sp = Math.sin(psi);
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
        let t = 2 * Math.PI * i / n,
            x = cp * Math.cos(t),
            y = sp * Math.cos(t + delta);
        let px = cx + x * 150,
            py = cy - y * 150;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.strokeStyle = getCSSColor('--primary-color');
    ctx.lineWidth = 3;
    ctx.stroke();
}

function drawInstantaneous2D() {
    let cp = Math.cos(psi),
        sp = Math.sin(psi),
        w = 2 * Math.PI * (frameCounter / samplesPerCycle);
    let x = cp * Math.cos(w),
        y = sp * Math.cos(w + delta);
    drawArrow(cx, cy, cx + x * 150, cy - y * 150, "#ef4444");
}

function project3D(p) {
    let r = 60 * Math.PI / 180,
        s = 100,
        xx = p.x + p.z * Math.cos(r),
        yy = p.y + p.z * Math.sin(r);
    return {
        x: xx * s,
        y: yy * s
    };
}

function drawLine3D(a, b, o, c = "#94a3b8") {
    let p1 = project3D(a),
        p2 = project3D(b);
    let x1 = o.x + p1.x,
        y1 = o.y - p1.y,
        x2 = o.x + p2.x,
        y2 = o.y - p2.y;
    ctx.strokeStyle = c;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
}

function drawAxes3D() {
    let o = {
            x: cx,
            y: cy
        },
        r = 2;
    const axisColor = getCSSColor('--text-muted');
    drawLine3D({
        x: -r,
        y: 0,
        z: 0
    }, {
        x: r,
        y: 0,
        z: 0
    }, o, axisColor);
    drawLine3D({
        x: 0,
        y: -r,
        z: 0
    }, {
        x: 0,
        y: r,
        z: 0
    }, o, axisColor);
    drawLine3D({
        x: 0,
        y: 0,
        z: -r
    }, {
        x: 0,
        y: 0,
        z: r
    }, o, axisColor);


    ctx.fillStyle = axisColor;
    ctx.font = "14px Arial";
    ctx.textAlign = "center";
    const xLabel = project3D({
        x: r + 0.3,
        y: 0,
        z: 0
    });
    const yLabel = project3D({
        x: 0,
        y: r + 0.3,
        z: 0
    });
    const zLabel = project3D({
        x: 0,
        y: 0,
        z: r + 0.3
    });
    ctx.fillText("x", o.x + xLabel.x, o.y - xLabel.y);
    ctx.fillText("y", o.x + yLabel.x, o.y - yLabel.y);
    ctx.fillText("z", o.x + zLabel.x, o.y - zLabel.y);
}

function drawWave3D() {
    let o = {
            x: cx,
            y: cy
        },
        n = 80,
        k = 2 * Math.PI,
        w = 2 * Math.PI,
        t = frameCounter / samplesPerCycle;
    let cp = Math.cos(psi),
        sp = Math.sin(psi),
        z1 = -2,
        z2 = 2;
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
        let z = z1 + (z2 - z1) * i / n,
            ex = cp * Math.cos(w * t - k * z),
            ey = sp * Math.cos(w * t - k * z + delta);
        let pp = project3D({
                x: ex,
                y: ey,
                z: z
            }),
            px = o.x + pp.x,
            py = o.y - pp.y;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.strokeStyle = getCSSColor('--primary-color');
    ctx.lineWidth = 3;
    ctx.stroke();
    let ex = cp * Math.cos(w * t),
        ey = sp * Math.cos(w * t + delta),
        p = project3D({
            x: ex,
            y: ey,
            z: 0
        });
    drawArrow(o.x, o.y, o.x + p.x, o.y - p.y, "#ef4444");
}

function drawAll() {
    ctx.clearRect(0, 0, cw, ch);
    if (!viewMode3DCheck.checked) {
        drawAxes2D();
        drawEllipse2D();
        if (timerRunning) drawInstantaneous2D();
    } else {
        drawAxes3D();
        drawWave3D();
    }
}

function animate() {
    if (!timerRunning) return;
    frameCounter++;
    drawAll();
    requestAnimationFrame(animate);
}


psiSlider.addEventListener("input", () => {
    psi = +psiSlider.value * Math.PI / 180;
    psiValue.innerHTML = psiSlider.value + "°";
    updateStats();
    updatePresetButtons(null);
    if (!timerRunning) drawAll();
});

deltaSlider.addEventListener("input", () => {
    delta = +deltaSlider.value * Math.PI / 180;
    deltaValue.innerHTML = deltaSlider.value + "°";
    updateStats();
    updatePresetButtons(null);
    if (!timerRunning) drawAll();
});

viewMode3DCheck.addEventListener("change", () => {
    updateStats();
    if (!timerRunning) drawAll();
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
    psiSlider.value = "45";
    deltaSlider.value = "0";
    psi = 45 * Math.PI / 180;
    delta = 0;
    psiValue.innerHTML = "45°";
    deltaValue.innerHTML = "0°";
    updateStats();
    updatePresetButtons(btnLinear);
    drawAll();
});


updateStats();
drawAll();