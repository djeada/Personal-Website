"use strict";
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const psiSlider = document.getElementById("idpsi");
const psiValue = document.getElementById("idpsiValue");
const deltaSlider = document.getElementById("iddelta");
const deltaValue = document.getElementById("iddeltaValue");
const viewMode3DCheck = document.getElementById("viewMode3D");
const startStopBtn = document.getElementById("startStopBtn");
const resetBtn = document.getElementById("resetBtn");
let timerRunning = false;
let frameCounter = 0;
const samplesPerCycle = 90;
let psi = parseFloat(psiSlider.value) * Math.PI / 180;
let delta = parseFloat(deltaSlider.value) * Math.PI / 180;
psiSlider.addEventListener("input", () => {
    psi = parseFloat(psiSlider.value) * Math.PI / 180;
    psiValue.innerHTML = psiSlider.value + "°";
    if (!timerRunning) drawAll();
});
deltaSlider.addEventListener("input", () => {
    delta = parseFloat(deltaSlider.value) * Math.PI / 180;
    deltaValue.innerHTML = deltaSlider.value + "°";
    if (!timerRunning) drawAll();
});
viewMode3DCheck.addEventListener("change", () => {
    if (!timerRunning) drawAll();
});
startStopBtn.addEventListener("click", () => {
    timerRunning = !timerRunning;
    startStopBtn.textContent = timerRunning ? "Stop" : "Start";
    if (timerRunning) animate();
});
resetBtn.addEventListener("click", () => {
    timerRunning = false;
    startStopBtn.textContent = "Start";
    frameCounter = 0;
    psiSlider.value = "45";
    deltaSlider.value = "0";
    psi = 45 * Math.PI / 180;
    delta = 0;
    psiValue.innerHTML = "45°";
    deltaValue.innerHTML = "0°";
    drawAll();
});

function animate() {
    if (!timerRunning) return;
    frameCounter++;
    drawAll();
    requestAnimationFrame(animate);
}

function drawAll() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!viewMode3DCheck.checked) {
        drawAxes2D();
        drawEllipse2D();
        if (timerRunning) drawInstantaneous2D();
    } else {
        drawAxes3D();
        drawWave3D();
    }
}

function drawAxes2D() {
    ctx.strokeStyle = "#555";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, canvas.height / 2);
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.stroke();
}

function drawAxes3D() {
    let origin = {
        x: canvas.width / 2 - 40,
        y: canvas.height / 2 + 30,
        z: 0
    };
    let xEnd = project(rotate3D({
        x: 1.5,
        y: 0,
        z: 0
    }), origin);
    let yEnd = project(rotate3D({
        x: 0,
        y: 1.5,
        z: 0
    }), origin);
    let zEnd = project(rotate3D({
        x: 0,
        y: 0,
        z: 1.5
    }), origin);
    ctx.strokeStyle = "#555";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(xEnd.x, xEnd.y);
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(yEnd.x, yEnd.y);
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(zEnd.x, zEnd.y);
    ctx.stroke();
}

function drawEllipse2D() {
    let n = 180,
        cp = Math.cos(psi),
        sp = Math.sin(psi);
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
        let t = 2 * Math.PI * (i / n),
            xx = cp * Math.cos(t),
            yy = sp * Math.cos(t + delta);
        let px = canvas.width / 2 + xx * 100,
            py = canvas.height / 2 - yy * 100;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.strokeStyle = "blue";
    ctx.lineWidth = 2;
    ctx.stroke();
}

function drawInstantaneous2D() {
    let cp = Math.cos(psi),
        sp = Math.sin(psi),
        omega = 2 * Math.PI * (frameCounter / samplesPerCycle);
    let xx = cp * Math.cos(omega),
        yy = sp * Math.cos(omega + delta);
    let x1 = canvas.width / 2,
        y1 = canvas.height / 2,
        x2 = x1 + xx * 100,
        y2 = y1 - yy * 100;
    drawArrow(x1, y1, x2, y2, "red");
}

function drawWave3D() {
    let n = 80,
        k = 2 * Math.PI,
        w = 2 * Math.PI,
        t = frameCounter / samplesPerCycle,
        cp = Math.cos(psi),
        sp = Math.sin(psi),
        zmin = -1,
        zmax = 1;
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
        let z = zmin + (zmax - zmin) * (i / n),
            ex = cp * Math.cos(w * t - k * z),
            ey = sp * Math.cos(w * t - k * z + delta);
        let p = project(rotate3D({
            x: ex,
            y: ey,
            z: z
        }), {
            x: canvas.width / 2 - 40,
            y: canvas.height / 2 + 30,
            z: 0
        });
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
    }
    ctx.strokeStyle = "blue";
    ctx.lineWidth = 2;
    ctx.stroke();
    let ex = cp * Math.cos(w * t),
        ey = sp * Math.cos(w * t + delta);
    let head = project(rotate3D({
        x: ex,
        y: ey,
        z: 0
    }), {
        x: canvas.width / 2 - 40,
        y: canvas.height / 2 + 30,
        z: 0
    });
    drawArrow(canvas.width / 2 - 40, canvas.height / 2 + 30, head.x, head.y, "red");
}

function rotate3D(p) {
    let angleX = 30 * Math.PI / 180,
        angleY = -25 * Math.PI / 180;
    let rx = p.x;
    let ry = p.y * Math.cos(angleX) - p.z * Math.sin(angleX);
    let rz = p.y * Math.sin(angleX) + p.z * Math.cos(angleX);
    let rx2 = rx * Math.cos(angleY) + rz * Math.sin(angleY);
    let ry2 = ry;
    let rz2 = -rx * Math.sin(angleY) + rz * Math.cos(angleY);
    return {
        x: rx2,
        y: ry2,
        z: rz2
    };
}

function project(p, o) {
    let f = 200,
        sz = p.z + 3,
        sc = f / (f + sz),
        xx = o.x + p.x * 100 * sc,
        yy = o.y - p.y * 100 * sc;
    return {
        x: xx,
        y: yy
    };
}

function drawArrow(x1, y1, x2, y2, color) {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    let h = 10,
        dx = x2 - x1,
        dy = y2 - y1,
        a = Math.atan2(dy, dx);
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - h * Math.cos(a - Math.PI / 6), y2 - h * Math.sin(a - Math.PI / 6));
    ctx.lineTo(x2 - h * Math.cos(a + Math.PI / 6), y2 - h * Math.sin(a + Math.PI / 6));
    ctx.lineTo(x2, y2);
    ctx.fill();
}
drawAll();