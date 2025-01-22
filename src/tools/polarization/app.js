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

// Convert initial slider values (degrees) to radians
let psi = parseFloat(psiSlider.value) * Math.PI / 180;
let delta = parseFloat(deltaSlider.value) * Math.PI / 180;

// Listen for slider changes
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

// 3D/2D toggle
viewMode3DCheck.addEventListener("change", () => {
    if (!timerRunning) drawAll();
});

// Start/Stop animation
startStopBtn.addEventListener("click", () => {
    timerRunning = !timerRunning;
    startStopBtn.textContent = timerRunning ? "Stop" : "Start";
    if (timerRunning) animate();
});

// Reset
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
        // 2D
        drawAxes2D();
        drawEllipse2D();
        if (timerRunning) drawInstantaneous2D();
    } else {
        // 3D
        drawAxes3D();
        drawWave3D();
    }
}

/* ------------------- 2D Drawing -------------------- */

function drawAxes2D() {
    ctx.strokeStyle = "#555";
    ctx.lineWidth = 2;

    // X-axis (horizontal)
    ctx.beginPath();
    ctx.moveTo(0, canvas.height / 2);
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();

    // Y-axis (vertical)
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.stroke();
}

function drawEllipse2D() {
    let n = 180;
    let cp = Math.cos(psi);
    let sp = Math.sin(psi);

    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
        let t = 2 * Math.PI * (i / n);
        let xx = cp * Math.cos(t);
        let yy = sp * Math.cos(t + delta);

        let px = canvas.width / 2 + xx * 100;
        let py = canvas.height / 2 - yy * 100;

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

    let xx = cp * Math.cos(omega);
    let yy = sp * Math.cos(omega + delta);

    let x1 = canvas.width / 2,
        y1 = canvas.height / 2,
        x2 = x1 + xx * 100,
        y2 = y1 - yy * 100;

    drawArrow(x1, y1, x2, y2, "red");
}

/* ------------------- 3D Drawing -------------------- */

/**
 * project3D(p)
 * Simple “tilt-only” style projection,
 * where x is horizontal, y is vertical,
 * and z is tilted by tiltAngle (positive => up-right).
 *
 * p: { x, y, z } in 3D
 * returns: { x, y } in "2D model coords" (unshifted).
 */
function project3D(p) {
    // +60° => z goes up/right
    const tiltAngle = +60 * Math.PI / 180;
    const scale = 80; // a bit smaller to fit the entire axis on the canvas

    let xx = p.x + p.z * Math.cos(tiltAngle);
    let yy = p.y + p.z * Math.sin(tiltAngle);

    return {
        x: xx * scale,
        y: yy * scale
    };
}

/**
 * Draw a 3D line between two 3D points in "model space."
 */
function drawLine3D(p1, p2, origin, color = "#555") {
    let pp1 = project3D(p1);
    let pp2 = project3D(p2);

    let x1 = origin.x + pp1.x;
    let y1 = origin.y - pp1.y;
    let x2 = origin.x + pp2.x;
    let y2 = origin.y - pp2.y;

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
}

function drawAxes3D() {
    // Origin exactly in the canvas center
    const origin = {
        x: canvas.width / 2,
        y: canvas.height / 2
    };

    // Each axis from -2 to +2 => symmetrical around the origin
    let axisRange = 2;

    // X-axis: from (-2,0,0) to (+2,0,0)
    drawLine3D({
        x: -axisRange,
        y: 0,
        z: 0
    }, {
        x: axisRange,
        y: 0,
        z: 0
    }, origin);
    // Y-axis: from (0,-2,0) to (0,+2,0)
    drawLine3D({
        x: 0,
        y: -axisRange,
        z: 0
    }, {
        x: 0,
        y: axisRange,
        z: 0
    }, origin);
    // Z-axis: from (0,0,-2) to (0,0,+2)
    drawLine3D({
        x: 0,
        y: 0,
        z: -axisRange
    }, {
        x: 0,
        y: 0,
        z: axisRange
    }, origin);
}

function drawWave3D() {
    // Same origin as our 3D axes
    const origin = {
        x: canvas.width / 2,
        y: canvas.height / 2
    };

    // For the wave, use z from -2..2
    let n = 80,
        k = 2 * Math.PI,
        w = 2 * Math.PI,
        t = frameCounter / samplesPerCycle,
        cp = Math.cos(psi),
        sp = Math.sin(psi),
        zmin = -2,
        zmax = +2;

    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
        let z = zmin + (zmax - zmin) * (i / n);
        let ex = cp * Math.cos(w * t - k * z);
        let ey = sp * Math.cos(w * t - k * z + delta);

        let p2d = project3D({
            x: ex,
            y: ey,
            z: z
        });
        let px = origin.x + p2d.x;
        let py = origin.y - p2d.y;

        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = "blue";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Also draw the instantaneous arrow at z=0
    let ex = cp * Math.cos(w * t);
    let ey = sp * Math.cos(w * t + delta);

    let head2d = project3D({
        x: ex,
        y: ey,
        z: 0
    });

    drawArrow(
        origin.x,
        origin.y,
        origin.x + head2d.x,
        origin.y - head2d.y,
        "red"
    );
}

/* ------------------- Utility -------------------- */

function drawArrow(x1, y1, x2, y2, color) {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;

    // Main line
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Arrowhead
    let h = 10,
        dx = x2 - x1,
        dy = y2 - y1,
        a = Math.atan2(dy, dx);

    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(
        x2 - h * Math.cos(a - Math.PI / 6),
        y2 - h * Math.sin(a - Math.PI / 6)
    );
    ctx.lineTo(
        x2 - h * Math.cos(a + Math.PI / 6),
        y2 - h * Math.sin(a + Math.PI / 6)
    );
    ctx.lineTo(x2, y2);
    ctx.fill();
}

// Initial draw
drawAll();