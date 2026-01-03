"use strict";

// DOM Elements - Preset buttons
const btnBelowThreshold = document.getElementById("btnBelowThreshold");
const btnAtThreshold = document.getElementById("btnAtThreshold");
const btnAboveThreshold = document.getElementById("btnAboveThreshold");
const btnHighPower = document.getElementById("btnHighPower");

// Canvas
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const cw = canvas.width,
    ch = canvas.height;

// Sliders and value displays
const pumpSlider = document.getElementById("pumpSlider");
const pumpValue = document.getElementById("pumpValue");
const reflectivitySlider = document.getElementById("reflectivitySlider");
const reflectivityValue = document.getElementById("reflectivityValue");
const lengthSlider = document.getElementById("lengthSlider");
const lengthValue = document.getElementById("lengthValue");
const lossSlider = document.getElementById("lossSlider");
const lossValue = document.getElementById("lossValue");

// View toggles
const showEnergyLevels = document.getElementById("showEnergyLevels");
const showIntensityGraph = document.getElementById("showIntensityGraph");

// Action buttons
const startStopBtn = document.getElementById("startStopBtn");
const resetBtn = document.getElementById("resetBtn");

// Stats displays
const statPump = document.getElementById("stat-pump");
const statReflectivity = document.getElementById("stat-reflectivity");
const statLength = document.getElementById("stat-length");
const statStatus = document.getElementById("stat-status");

// Simulation state
let running = false;
let frameCount = 0;
let intensity = 0.01;
let intensityHistory = [];
const maxHistoryLength = 100;

// Photon particles for animation
let photons = [];
const maxPhotons = 50;

// Atom energy level display
let atoms = [];
const numAtoms = 12;

// Initialize atoms
function initAtoms() {
    atoms = [];
    for (let i = 0; i < numAtoms; i++) {
        atoms.push({
            x: 0.25 + 0.5 * Math.random(),
            excited: Math.random() < 0.3,
            transitionTimer: 0
        });
    }
}

// Get CSS colors
function getCSSColor(variableName) {
    return getComputedStyle(document.documentElement)
        .getPropertyValue(variableName).trim() || getDefaultColor(variableName);
}

function getDefaultColor(variableName) {
    const defaults = {
        '--text-muted': '#94a3b8',
        '--primary-color': '#ea8400',
        '--text-primary': '#1e293b'
    };
    return defaults[variableName] || '#94a3b8';
}

// Calculate laser parameters
function getParams() {
    const pump = +pumpSlider.value / 100;
    const reflectivity = +reflectivitySlider.value / 100;
    const length = +lengthSlider.value;
    const loss = +lossSlider.value / 100;

    // Gain is proportional to pump rate
    const gain = pump * 1.5;

    // Total losses = mirror transmission + internal losses
    const mirrorLoss = 1 - reflectivity;
    const totalLoss = mirrorLoss + loss;

    // Threshold condition: gain > losses
    const isAboveThreshold = gain > totalLoss;
    const thresholdRatio = gain / Math.max(totalLoss, 0.01);

    return { pump, reflectivity, length, loss, gain, totalLoss, isAboveThreshold, thresholdRatio };
}

// Update stats display
function updateStats() {
    const params = getParams();

    statPump.textContent = pumpSlider.value + "%";
    statReflectivity.textContent = reflectivitySlider.value + "%";
    statLength.textContent = lengthSlider.value + " cm";

    if (params.thresholdRatio < 0.95) {
        statStatus.textContent = "Below Threshold";
        statStatus.style.color = "#64748b";
    } else if (params.thresholdRatio < 1.05) {
        statStatus.textContent = "At Threshold";
        statStatus.style.color = "#f59e0b";
    } else {
        statStatus.textContent = "Lasing!";
        statStatus.style.color = "#10b981";
    }
}

// Update preset buttons
function updatePresetButtons(activeBtn) {
    [btnBelowThreshold, btnAtThreshold, btnAboveThreshold, btnHighPower].forEach(btn => {
        btn.classList.remove("active");
    });
    if (activeBtn) {
        activeBtn.classList.add("active");
    }
}

// Preset handlers
btnBelowThreshold.addEventListener("click", () => {
    pumpSlider.value = "20";
    reflectivitySlider.value = "80";
    lengthSlider.value = "10";
    lossSlider.value = "15";
    updateDisplays();
    updatePresetButtons(btnBelowThreshold);
    resetSimulation();
});

btnAtThreshold.addEventListener("click", () => {
    pumpSlider.value = "40";
    reflectivitySlider.value = "90";
    lengthSlider.value = "10";
    lossSlider.value = "10";
    updateDisplays();
    updatePresetButtons(btnAtThreshold);
    resetSimulation();
});

btnAboveThreshold.addEventListener("click", () => {
    pumpSlider.value = "60";
    reflectivitySlider.value = "95";
    lengthSlider.value = "10";
    lossSlider.value = "5";
    updateDisplays();
    updatePresetButtons(btnAboveThreshold);
    resetSimulation();
});

btnHighPower.addEventListener("click", () => {
    pumpSlider.value = "90";
    reflectivitySlider.value = "99";
    lengthSlider.value = "15";
    lossSlider.value = "2";
    updateDisplays();
    updatePresetButtons(btnHighPower);
    resetSimulation();
});

function updateDisplays() {
    pumpValue.textContent = pumpSlider.value + "%";
    reflectivityValue.textContent = reflectivitySlider.value + "%";
    lengthValue.textContent = lengthSlider.value + " cm";
    lossValue.textContent = lossSlider.value + "%";
    updateStats();
}

// Slider event listeners
pumpSlider.addEventListener("input", () => {
    updateDisplays();
    updatePresetButtons(null);
});

reflectivitySlider.addEventListener("input", () => {
    updateDisplays();
    updatePresetButtons(null);
});

lengthSlider.addEventListener("input", () => {
    updateDisplays();
    updatePresetButtons(null);
});

lossSlider.addEventListener("input", () => {
    updateDisplays();
    updatePresetButtons(null);
});

// View toggle listeners
showEnergyLevels.addEventListener("change", () => {
    if (!running) drawAll();
});

showIntensityGraph.addEventListener("change", () => {
    if (!running) drawAll();
});

// Start/Stop button
startStopBtn.addEventListener("click", () => {
    running = !running;
    startStopBtn.innerHTML = running ?
        '<span>⏸️</span> Stop Simulation' :
        '<span>▶️</span> Start Simulation';
    if (running) animate();
});

// Reset button
resetBtn.addEventListener("click", () => {
    resetSimulation();
});

function resetSimulation() {
    running = false;
    startStopBtn.innerHTML = '<span>▶️</span> Start Simulation';
    frameCount = 0;
    intensity = 0.01;
    intensityHistory = [];
    photons = [];
    initAtoms();
    updateStats();
    drawAll();
}

// Create a new photon
function createPhoton(x, direction) {
    if (photons.length < maxPhotons) {
        photons.push({
            x: x,
            y: 0.5 + (Math.random() - 0.5) * 0.3,
            direction: direction,
            age: 0
        });
    }
}

// Update simulation state
function updateSimulation() {
    const params = getParams();

    // Update intensity based on gain vs loss
    if (params.isAboveThreshold) {
        // Exponential growth towards saturation
        const saturationIntensity = (params.gain - params.totalLoss) * 10;
        intensity += (saturationIntensity - intensity) * 0.02;
        intensity = Math.min(intensity, 10);
    } else {
        // Decay below threshold
        intensity *= 0.98;
        intensity = Math.max(intensity, 0.01);
    }

    // Record intensity history
    intensityHistory.push(intensity);
    if (intensityHistory.length > maxHistoryLength) {
        intensityHistory.shift();
    }

    // Update atoms - excitation and de-excitation
    const excitationProb = params.pump * 0.05;
    const stimulatedProb = intensity * 0.02 * params.pump;

    atoms.forEach(atom => {
        atom.transitionTimer = Math.max(0, atom.transitionTimer - 1);

        if (atom.transitionTimer === 0) {
            if (!atom.excited && Math.random() < excitationProb) {
                // Pumping: ground -> excited
                atom.excited = true;
                atom.transitionTimer = 10;
            } else if (atom.excited && Math.random() < stimulatedProb) {
                // Stimulated emission: excited -> ground + photon
                atom.excited = false;
                atom.transitionTimer = 10;
                if (params.isAboveThreshold) {
                    createPhoton(atom.x, Math.random() < 0.5 ? 1 : -1);
                }
            } else if (atom.excited && Math.random() < 0.01) {
                // Spontaneous emission (random direction, usually lost)
                atom.excited = false;
                atom.transitionTimer = 10;
            }
        }
    });

    // Update photons
    const photonSpeed = 0.015;
    photons = photons.filter(photon => {
        photon.x += photon.direction * photonSpeed;
        photon.age++;

        // Reflect at mirrors
        if (photon.x <= 0.1) {
            if (Math.random() < params.reflectivity) {
                photon.x = 0.1;
                photon.direction = 1;
                // Stimulated emission - create another photon
                if (params.isAboveThreshold && Math.random() < params.gain * 0.3) {
                    createPhoton(photon.x + 0.05, 1);
                }
            } else {
                return false; // Photon escapes or is absorbed
            }
        } else if (photon.x >= 0.9) {
            if (Math.random() < params.reflectivity * 0.95) { // Output coupler has slightly less reflectivity
                photon.x = 0.9;
                photon.direction = -1;
                if (params.isAboveThreshold && Math.random() < params.gain * 0.3) {
                    createPhoton(photon.x - 0.05, -1);
                }
            } else {
                return false; // Photon exits as laser beam
            }
        }

        // Remove old photons due to losses
        if (Math.random() < params.loss * 0.02) {
            return false;
        }

        return photon.age < 500;
    });

    // Spontaneously add photons based on pump rate
    if (Math.random() < params.pump * 0.1 && photons.length < maxPhotons * 0.5) {
        createPhoton(0.3 + Math.random() * 0.4, Math.random() < 0.5 ? 1 : -1);
    }
}

// Drawing functions
function drawCavity() {
    const params = getParams();
    const cavityTop = 80;
    const cavityBottom = showEnergyLevels.checked ? 280 : 380;
    const cavityLeft = 70;
    const cavityRight = cw - 70;

    // Draw gain medium (rectangle in center)
    const gainLeft = cavityLeft + 80;
    const gainRight = cavityRight - 80;
    ctx.fillStyle = params.isAboveThreshold ? "rgba(255, 100, 100, 0.3)" : "rgba(200, 200, 200, 0.3)";
    ctx.fillRect(gainLeft, cavityTop, gainRight - gainLeft, cavityBottom - cavityTop);
    ctx.strokeStyle = getCSSColor('--text-muted');
    ctx.lineWidth = 2;
    ctx.strokeRect(gainLeft, cavityTop, gainRight - gainLeft, cavityBottom - cavityTop);

    // Label gain medium
    ctx.fillStyle = getCSSColor('--text-secondary');
    ctx.font = "12px Arial";
    ctx.textAlign = "center";
    ctx.fillText("Gain Medium", (gainLeft + gainRight) / 2, cavityTop - 10);

    // Draw mirrors
    ctx.lineWidth = 8;

    // Back mirror (high reflectivity)
    ctx.strokeStyle = "#3b82f6";
    ctx.beginPath();
    ctx.moveTo(cavityLeft, cavityTop);
    ctx.lineTo(cavityLeft, cavityBottom);
    ctx.stroke();
    ctx.fillStyle = getCSSColor('--text-secondary');
    ctx.font = "11px Arial";
    ctx.textAlign = "center";
    ctx.fillText("Back Mirror", cavityLeft, cavityBottom + 20);
    ctx.fillText("(R≈99%)", cavityLeft, cavityBottom + 35);

    // Output mirror (partially transmitting)
    ctx.strokeStyle = "#8b5cf6";
    ctx.beginPath();
    ctx.moveTo(cavityRight, cavityTop);
    ctx.lineTo(cavityRight, cavityBottom);
    ctx.stroke();
    ctx.fillText("Output Mirror", cavityRight, cavityBottom + 20);
    ctx.fillText("(R=" + reflectivitySlider.value + "%)", cavityRight, cavityBottom + 35);

    // Draw output beam if above threshold
    if (params.isAboveThreshold && intensity > 0.5) {
        const beamIntensity = Math.min(intensity / 5, 1);
        const gradient = ctx.createLinearGradient(cavityRight, 0, cavityRight + 100, 0);
        gradient.addColorStop(0, `rgba(255, 0, 0, ${beamIntensity})`);
        gradient.addColorStop(1, `rgba(255, 0, 0, 0)`);

        ctx.fillStyle = gradient;
        const beamHeight = 20 + intensity * 5;
        ctx.fillRect(cavityRight, (cavityTop + cavityBottom) / 2 - beamHeight / 2, 100, beamHeight);

        // Beam label
        ctx.fillStyle = "#ef4444";
        ctx.font = "bold 12px Arial";
        ctx.fillText("LASER OUTPUT", cavityRight + 50, cavityTop - 10);
    }

    // Draw photons
    const photonRadius = 4;
    photons.forEach(photon => {
        const px = cavityLeft + photon.x * (cavityRight - cavityLeft);
        const py = cavityTop + photon.y * (cavityBottom - cavityTop);

        // Photon glow
        const gradient = ctx.createRadialGradient(px, py, 0, px, py, photonRadius * 2);
        gradient.addColorStop(0, "rgba(255, 200, 50, 0.8)");
        gradient.addColorStop(1, "rgba(255, 200, 50, 0)");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(px, py, photonRadius * 2, 0, Math.PI * 2);
        ctx.fill();

        // Photon core
        ctx.fillStyle = "#fbbf24";
        ctx.beginPath();
        ctx.arc(px, py, photonRadius, 0, Math.PI * 2);
        ctx.fill();
    });
}

function drawEnergyLevels() {
    if (!showEnergyLevels.checked) return;

    const params = getParams();
    const levelTop = 320;
    const levelBottom = 420;
    const levelLeft = 100;
    const levelRight = cw - 100;
    const levelWidth = levelRight - levelLeft;

    // Draw energy level diagram box
    ctx.fillStyle = getCSSColor('--surface-elevated') || "#f8fafc";
    ctx.fillRect(levelLeft - 20, levelTop - 30, levelWidth + 40, levelBottom - levelTop + 50);
    ctx.strokeStyle = getCSSColor('--border-color') || "#e2e8f0";
    ctx.lineWidth = 1;
    ctx.strokeRect(levelLeft - 20, levelTop - 30, levelWidth + 40, levelBottom - levelTop + 50);

    // Title
    ctx.fillStyle = getCSSColor('--text-primary');
    ctx.font = "bold 13px Arial";
    ctx.textAlign = "center";
    ctx.fillText("Energy Level Diagram", (levelLeft + levelRight) / 2, levelTop - 10);

    // Draw energy levels
    ctx.strokeStyle = getCSSColor('--text-muted');
    ctx.lineWidth = 2;

    // Ground state (E1)
    ctx.beginPath();
    ctx.moveTo(levelLeft, levelBottom);
    ctx.lineTo(levelRight, levelBottom);
    ctx.stroke();
    ctx.fillStyle = getCSSColor('--text-secondary');
    ctx.font = "12px Arial";
    ctx.textAlign = "left";
    ctx.fillText("E₁ (Ground)", levelRight + 10, levelBottom + 4);

    // Excited state (E2)
    ctx.beginPath();
    ctx.moveTo(levelLeft, levelTop);
    ctx.lineTo(levelRight, levelTop);
    ctx.stroke();
    ctx.fillText("E₂ (Excited)", levelRight + 10, levelTop + 4);

    // Draw atoms on energy levels
    const atomRadius = 8;
    const groundY = levelBottom - atomRadius - 5;
    const excitedY = levelTop + atomRadius + 5;

    atoms.forEach((atom, i) => {
        const x = levelLeft + 30 + (i / (numAtoms - 1)) * (levelWidth - 60);
        const y = atom.excited ? excitedY : groundY;

        // Transition animation
        let displayY = y;
        if (atom.transitionTimer > 0) {
            const progress = atom.transitionTimer / 10;
            if (atom.excited) {
                // Rising to excited state
                displayY = groundY + (excitedY - groundY) * (1 - progress);
            } else {
                // Falling to ground state
                displayY = excitedY + (groundY - excitedY) * (1 - progress);
            }
        }

        // Atom glow for excited state
        if (atom.excited) {
            const gradient = ctx.createRadialGradient(x, displayY, 0, x, displayY, atomRadius * 2);
            gradient.addColorStop(0, "rgba(239, 68, 68, 0.6)");
            gradient.addColorStop(1, "rgba(239, 68, 68, 0)");
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(x, displayY, atomRadius * 2, 0, Math.PI * 2);
            ctx.fill();
        }

        // Atom circle
        ctx.fillStyle = atom.excited ? "#ef4444" : "#3b82f6";
        ctx.beginPath();
        ctx.arc(x, displayY, atomRadius, 0, Math.PI * 2);
        ctx.fill();
    });

    // Draw arrows for transitions
    ctx.strokeStyle = "#10b981";
    ctx.lineWidth = 2;
    const arrowX = levelLeft - 10;

    // Pumping arrow (up)
    drawArrow(arrowX, levelBottom - 10, arrowX, levelTop + 10, "#10b981");
    ctx.fillStyle = "#10b981";
    ctx.font = "11px Arial";
    ctx.textAlign = "right";
    ctx.fillText("Pump", arrowX - 5, (levelTop + levelBottom) / 2);

    // Stimulated emission arrow (down)
    const emissionX = (levelLeft + levelRight) / 2;
    drawArrow(emissionX, levelTop + 15, emissionX, levelBottom - 15, "#f59e0b");
    ctx.fillStyle = "#f59e0b";
    ctx.textAlign = "center";
    ctx.fillText("Stimulated", emissionX, (levelTop + levelBottom) / 2 - 5);
    ctx.fillText("Emission", emissionX, (levelTop + levelBottom) / 2 + 10);
}

function drawArrow(x1, y1, x2, y2, color) {
    const headLength = 10;
    const angle = Math.atan2(y2 - y1, x2 - x1);

    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLength * Math.cos(angle - Math.PI / 6), y2 - headLength * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(x2 - headLength * Math.cos(angle + Math.PI / 6), y2 - headLength * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
}

function drawIntensityGraph() {
    if (!showIntensityGraph.checked) return;

    const params = getParams();
    const graphLeft = 100;
    const graphRight = cw - 100;
    const graphTop = showEnergyLevels.checked ? 440 : 400;
    const graphBottom = ch - 20;
    const graphWidth = graphRight - graphLeft;
    const graphHeight = graphBottom - graphTop;

    // Graph background
    ctx.fillStyle = getCSSColor('--surface-elevated') || "#f8fafc";
    ctx.fillRect(graphLeft - 30, graphTop - 30, graphWidth + 60, graphHeight + 50);
    ctx.strokeStyle = getCSSColor('--border-color') || "#e2e8f0";
    ctx.lineWidth = 1;
    ctx.strokeRect(graphLeft - 30, graphTop - 30, graphWidth + 60, graphHeight + 50);

    // Title
    ctx.fillStyle = getCSSColor('--text-primary');
    ctx.font = "bold 13px Arial";
    ctx.textAlign = "center";
    ctx.fillText("Intensity Build-up Over Time", (graphLeft + graphRight) / 2, graphTop - 10);

    // Axes
    ctx.strokeStyle = getCSSColor('--text-muted');
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(graphLeft, graphBottom);
    ctx.lineTo(graphRight, graphBottom);
    ctx.moveTo(graphLeft, graphBottom);
    ctx.lineTo(graphLeft, graphTop);
    ctx.stroke();

    // Axis labels
    ctx.fillStyle = getCSSColor('--text-secondary');
    ctx.font = "11px Arial";
    ctx.textAlign = "center";
    ctx.fillText("Time (round trips)", (graphLeft + graphRight) / 2, graphBottom + 15);
    ctx.save();
    ctx.translate(graphLeft - 20, (graphTop + graphBottom) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Intensity", 0, 0);
    ctx.restore();

    // Draw threshold line
    const thresholdY = graphBottom - (0.5 / 10) * graphHeight;
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(graphLeft, thresholdY);
    ctx.lineTo(graphRight, thresholdY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#f59e0b";
    ctx.textAlign = "right";
    ctx.fillText("Threshold", graphRight + 5, thresholdY - 5);

    // Draw intensity history
    if (intensityHistory.length > 1) {
        ctx.strokeStyle = params.isAboveThreshold ? "#10b981" : "#3b82f6";
        ctx.lineWidth = 2;
        ctx.beginPath();

        for (let i = 0; i < intensityHistory.length; i++) {
            const x = graphLeft + (i / maxHistoryLength) * graphWidth;
            const normalizedIntensity = Math.min(intensityHistory[i] / 10, 1);
            const y = graphBottom - normalizedIntensity * graphHeight;

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.stroke();

        // Current intensity indicator
        if (intensityHistory.length > 0) {
            const currentIntensity = intensityHistory[intensityHistory.length - 1];
            const normalizedCurrent = Math.min(currentIntensity / 10, 1);
            const indicatorX = graphLeft + ((intensityHistory.length - 1) / maxHistoryLength) * graphWidth;
            const indicatorY = graphBottom - normalizedCurrent * graphHeight;

            ctx.fillStyle = params.isAboveThreshold ? "#10b981" : "#3b82f6";
            ctx.beginPath();
            ctx.arc(indicatorX, indicatorY, 5, 0, Math.PI * 2);
            ctx.fill();

            // Intensity value
            ctx.fillStyle = getCSSColor('--text-primary');
            ctx.font = "bold 12px Arial";
            ctx.textAlign = "left";
            ctx.fillText("I = " + currentIntensity.toFixed(2), indicatorX + 10, indicatorY);
        }
    }
}

function drawAll() {
    ctx.clearRect(0, 0, cw, ch);
    drawCavity();
    drawEnergyLevels();
    drawIntensityGraph();
}

function animate() {
    if (!running) return;

    frameCount++;
    updateSimulation();
    drawAll();

    requestAnimationFrame(animate);
}

// Initialize
initAtoms();
updateDisplays();
drawAll();
