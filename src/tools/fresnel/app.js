"use strict";

// DOM Elements
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const cw = canvas.width, ch = canvas.height;

// Sliders and value displays
const thetaSlider = document.getElementById("thetaSlider");
const thetaValue = document.getElementById("thetaValue");
const n2Slider = document.getElementById("n2Slider");
const n2Value = document.getElementById("n2Value");

// Checkboxes
const showEFields = document.getElementById("showEFields");
const animateWaves = document.getElementById("animateWaves");

// Buttons
const btnBrewster = document.getElementById("btnBrewster");
const btnCritical = document.getElementById("btnCritical");
const btnNormal = document.getElementById("btnNormal");
const btnGrazing = document.getElementById("btnGrazing");
const btnBoth = document.getElementById("btnBoth");
const btnS = document.getElementById("btnS");
const btnP = document.getElementById("btnP");
const startStopBtn = document.getElementById("startStopBtn");
const resetBtn = document.getElementById("resetBtn");

// Stats displays
const statTheta = document.getElementById("stat-theta");
const statN2 = document.getElementById("stat-n2");
const statBrewster = document.getElementById("stat-brewster");
const statPolarization = document.getElementById("stat-polarization");

// Intensity bars
const rsBar = document.getElementById("rsBar");
const rpBar = document.getElementById("rpBar");
const tsBar = document.getElementById("tsBar");
const tpBar = document.getElementById("tpBar");
const rsValue = document.getElementById("rsValue");
const rpValue = document.getElementById("rpValue");
const tsValue = document.getElementById("tsValue");
const tpValue = document.getElementById("tpValue");

// Indicators
const brewsterIndicator = document.getElementById("brewsterIndicator");
const tirIndicator = document.getElementById("tirIndicator");

// State variables
let n1 = 1.0; // Air
let n2 = 1.5;
let theta1 = 45 * Math.PI / 180;
let polarizationType = "both"; // "both", "s", "p"
let animationRunning = false;
let frameCounter = 0;

// Colors
const INCIDENT_COLOR = "#3b82f6";
const REFLECTED_COLOR = "#ef4444";
const REFRACTED_COLOR = "#10b981";
const S_POL_COLOR = "#3b82f6";
const P_POL_COLOR = "#ef4444";
const BREWSTER_COLOR = "#f59e0b";
const INTERFACE_COLOR = "#64748b";

// Helper functions
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

// Physics calculations
function calculateBrewsterAngle() {
    return Math.atan(n2 / n1);
}

function calculateCriticalAngle() {
    if (n1 > n2) {
        return Math.asin(n2 / n1);
    }
    return null; // No critical angle when going to denser medium
}

function calculateTheta2(theta1) {
    const sinTheta2 = (n1 / n2) * Math.sin(theta1);
    if (Math.abs(sinTheta2) > 1) {
        return null; // Total internal reflection
    }
    return Math.asin(sinTheta2);
}

function calculateFresnelCoefficients(theta1) {
    const theta2 = calculateTheta2(theta1);
    
    if (theta2 === null) {
        // Total internal reflection
        return { rs: 1, rp: 1, ts: 0, tp: 0, tir: true };
    }
    
    const cosTheta1 = Math.cos(theta1);
    const cosTheta2 = Math.cos(theta2);
    
    // Amplitude reflection coefficients
    const rs_num = n1 * cosTheta1 - n2 * cosTheta2;
    const rs_den = n1 * cosTheta1 + n2 * cosTheta2;
    const rs = rs_num / rs_den;
    
    const rp_num = n2 * cosTheta1 - n1 * cosTheta2;
    const rp_den = n2 * cosTheta1 + n1 * cosTheta2;
    const rp = rp_num / rp_den;
    
    // Intensity reflectances
    const Rs = rs * rs;
    const Rp = rp * rp;
    
    // Intensity transmittances (energy conservation)
    const Ts = 1 - Rs;
    const Tp = 1 - Rp;
    
    return { rs: Rs, rp: Rp, ts: Ts, tp: Tp, tir: false, theta2: theta2 };
}

// Update stats display
function updateStats() {
    const theta1Deg = +thetaSlider.value;
    theta1 = theta1Deg * Math.PI / 180;
    n2 = +n2Slider.value;
    
    statTheta.textContent = theta1Deg + "°";
    statN2.textContent = n2.toFixed(2);
    
    const brewsterAngle = calculateBrewsterAngle() * 180 / Math.PI;
    statBrewster.textContent = brewsterAngle.toFixed(1) + "°";
    
    statPolarization.textContent = polarizationType === "both" ? "Both" : 
                                   polarizationType === "s" ? "s-pol" : "p-pol";
    
    thetaValue.textContent = theta1Deg + "°";
    n2Value.textContent = n2.toFixed(2);
    
    updateIntensityBars();
}

function updateIntensityBars() {
    const coeffs = calculateFresnelCoefficients(theta1);
    
    rsBar.style.width = (coeffs.rs * 100) + "%";
    rpBar.style.width = (coeffs.rp * 100) + "%";
    tsBar.style.width = (coeffs.ts * 100) + "%";
    tpBar.style.width = (coeffs.tp * 100) + "%";
    
    rsValue.textContent = (coeffs.rs * 100).toFixed(1) + "%";
    rpValue.textContent = (coeffs.rp * 100).toFixed(1) + "%";
    tsValue.textContent = (coeffs.ts * 100).toFixed(1) + "%";
    tpValue.textContent = (coeffs.tp * 100).toFixed(1) + "%";
    
    // Brewster angle indicator
    const brewsterAngle = calculateBrewsterAngle();
    const isAtBrewster = Math.abs(theta1 - brewsterAngle) < 0.02;
    brewsterIndicator.classList.toggle("active", isAtBrewster);
    
    // TIR indicator
    tirIndicator.classList.toggle("active", coeffs.tir);
}

// Update preset button active states
function updatePresetButtons(activeBtn) {
    [btnBrewster, btnCritical, btnNormal, btnGrazing].forEach(btn => {
        btn.classList.remove("active");
    });
    if (activeBtn) {
        activeBtn.classList.add("active");
    }
}

function updatePolarizationButtons(activeBtn) {
    [btnBoth, btnS, btnP].forEach(btn => {
        btn.classList.remove("active");
    });
    if (activeBtn) {
        activeBtn.classList.add("active");
    }
}

// Drawing functions
function drawArrow(ax, ay, bx, by, color, lineWidth = 3) {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
    
    const headLength = 12;
    const dx = bx - ax;
    const dy = by - ay;
    const angle = Math.atan2(dy, dx);
    
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx - headLength * Math.cos(angle - Math.PI / 6), 
               by - headLength * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(bx - headLength * Math.cos(angle + Math.PI / 6), 
               by - headLength * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
}

function drawWaveFronts(startX, startY, angle, length, color, phase = 0) {
    const waveLength = 30;
    const numFronts = Math.floor(length / waveLength);
    
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    
    for (let i = 0; i < numFronts; i++) {
        const offset = ((i * waveLength) + phase) % length;
        const frontX = startX + offset * Math.cos(angle);
        const frontY = startY + offset * Math.sin(angle);
        
        const perpAngle = angle + Math.PI / 2;
        const frontLength = 15;
        
        ctx.beginPath();
        ctx.moveTo(frontX - frontLength * Math.cos(perpAngle),
                   frontY - frontLength * Math.sin(perpAngle));
        ctx.lineTo(frontX + frontLength * Math.cos(perpAngle),
                   frontY + frontLength * Math.sin(perpAngle));
        ctx.stroke();
    }
    
    ctx.setLineDash([]);
}

function drawEFieldVector(x, y, amplitude, angle, color, isP = false, phase = 0) {
    const scale = 25;
    const oscillation = Math.sin(phase);
    
    if (isP) {
        // p-polarization: in the plane of incidence
        const ex = amplitude * oscillation * Math.cos(angle);
        const ey = amplitude * oscillation * Math.sin(angle);
        drawArrow(x, y, x + ex * scale, y + ey * scale, color, 2);
    } else {
        // s-polarization: perpendicular to plane (into/out of screen)
        // Represent as a circle with dot or cross
        const radius = Math.abs(amplitude * oscillation) * scale * 0.3;
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, Math.max(radius, 3), 0, 2 * Math.PI);
        ctx.stroke();
        
        if (amplitude * oscillation > 0) {
            // Dot (coming out)
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, 2 * Math.PI);
            ctx.fill();
        } else {
            // Cross (going in)
            const crossSize = Math.max(radius * 0.7, 4);
            ctx.beginPath();
            ctx.moveTo(x - crossSize, y - crossSize);
            ctx.lineTo(x + crossSize, y + crossSize);
            ctx.moveTo(x + crossSize, y - crossSize);
            ctx.lineTo(x - crossSize, y + crossSize);
            ctx.stroke();
        }
    }
}

function drawInterface() {
    const interfaceY = ch / 2;
    
    // Draw media backgrounds
    // Upper medium (n1 = 1, air)
    ctx.fillStyle = "rgba(135, 206, 235, 0.1)";
    ctx.fillRect(0, 0, cw, interfaceY);
    
    // Lower medium (n2, denser)
    ctx.fillStyle = "rgba(100, 149, 237, 0.2)";
    ctx.fillRect(0, interfaceY, cw, ch - interfaceY);
    
    // Interface line
    ctx.strokeStyle = INTERFACE_COLOR;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, interfaceY);
    ctx.lineTo(cw, interfaceY);
    ctx.stroke();
    
    // Normal line (dashed)
    ctx.strokeStyle = getCSSColor('--text-muted');
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(cw / 2, 50);
    ctx.lineTo(cw / 2, ch - 50);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Labels
    ctx.fillStyle = getCSSColor('--text-primary');
    ctx.font = "14px Arial";
    ctx.textAlign = "left";
    ctx.fillText("n₁ = " + n1.toFixed(2) + " (Air)", 20, 30);
    ctx.fillText("n₂ = " + n2.toFixed(2), 20, interfaceY + 25);
    
    ctx.textAlign = "center";
    ctx.fillText("Normal", cw / 2 + 35, 60);
}

function drawRays() {
    const interfaceY = ch / 2;
    const originX = cw / 2;
    const originY = interfaceY;
    const rayLength = 180;
    
    const coeffs = calculateFresnelCoefficients(theta1);
    
    // Incident ray (coming from upper left)
    const incidentAngle = Math.PI / 2 + theta1; // Angle from positive x-axis
    const incStartX = originX - rayLength * Math.cos(incidentAngle);
    const incStartY = originY - rayLength * Math.sin(incidentAngle);
    
    drawArrow(incStartX, incStartY, originX, originY, INCIDENT_COLOR, 4);
    
    // Reflected ray (going to upper right)
    const reflectedAngle = Math.PI / 2 - theta1;
    const refEndX = originX + rayLength * Math.cos(reflectedAngle);
    const refEndY = originY - rayLength * Math.sin(reflectedAngle);
    
    // Modulate reflected ray thickness based on reflection coefficient
    const avgReflection = (coeffs.rs + coeffs.rp) / 2;
    const reflectedLineWidth = 2 + avgReflection * 4;
    drawArrow(originX, originY, refEndX, refEndY, REFLECTED_COLOR, reflectedLineWidth);
    
    // Refracted ray (if not TIR)
    if (!coeffs.tir && coeffs.theta2 !== undefined) {
        const refrAngle = -Math.PI / 2 + coeffs.theta2;
        const refrEndX = originX + rayLength * Math.cos(refrAngle);
        const refrEndY = originY - rayLength * Math.sin(refrAngle);
        
        const avgTransmission = (coeffs.ts + coeffs.tp) / 2;
        const refractedLineWidth = 2 + avgTransmission * 4;
        drawArrow(originX, originY, refrEndX, refrEndY, REFRACTED_COLOR, refractedLineWidth);
    }
    
    // Angle arcs
    drawAngleArc(originX, originY, 40, Math.PI / 2, incidentAngle, "θ₁", INCIDENT_COLOR);
    drawAngleArc(originX, originY, 50, Math.PI / 2, reflectedAngle, "θ₁", REFLECTED_COLOR);
    
    if (!coeffs.tir && coeffs.theta2 !== undefined) {
        drawAngleArc(originX, originY, 40, -Math.PI / 2, -Math.PI / 2 + coeffs.theta2, "θ₂", REFRACTED_COLOR);
    }
    
    // Draw animated wave fronts if enabled
    if (animationRunning) {
        const phase = (frameCounter * 3) % 30;
        drawWaveFronts(incStartX, incStartY, incidentAngle, rayLength, INCIDENT_COLOR, phase);
        drawWaveFronts(originX, originY, reflectedAngle, rayLength, REFLECTED_COLOR, phase);
        if (!coeffs.tir && coeffs.theta2 !== undefined) {
            const refrAngle = -Math.PI / 2 + coeffs.theta2;
            drawWaveFronts(originX, originY, refrAngle, rayLength, REFRACTED_COLOR, phase);
        }
    }
}

function drawAngleArc(cx, cy, radius, startAngle, endAngle, label, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    const start = Math.min(startAngle, endAngle);
    const end = Math.max(startAngle, endAngle);
    
    ctx.arc(cx, cy, radius, -end, -start);
    ctx.stroke();
    
    // Label
    const midAngle = (startAngle + endAngle) / 2;
    const labelRadius = radius + 15;
    const labelX = cx + labelRadius * Math.cos(-midAngle);
    const labelY = cy - labelRadius * Math.sin(-midAngle);
    
    ctx.fillStyle = color;
    ctx.font = "12px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, labelX, labelY);
}

function drawEFields() {
    if (!showEFields.checked) return;
    
    const interfaceY = ch / 2;
    const originX = cw / 2;
    const originY = interfaceY;
    const rayLength = 180;
    
    const coeffs = calculateFresnelCoefficients(theta1);
    const phase = animationRunning ? (frameCounter * 0.15) : 0;
    
    // Positions along rays
    const positions = [0.3, 0.6, 0.9];
    
    // Incident ray E-fields
    const incidentAngle = Math.PI / 2 + theta1;
    positions.forEach((pos, i) => {
        const x = originX - rayLength * pos * Math.cos(incidentAngle);
        const y = originY - rayLength * pos * Math.sin(incidentAngle);
        const fieldPhase = phase - pos * 3;
        
        if (polarizationType === "both" || polarizationType === "s") {
            drawEFieldVector(x - 10, y, 1, incidentAngle, S_POL_COLOR, false, fieldPhase);
        }
        if (polarizationType === "both" || polarizationType === "p") {
            drawEFieldVector(x + 10, y, 1, incidentAngle, P_POL_COLOR, true, fieldPhase);
        }
    });
    
    // Reflected ray E-fields
    const reflectedAngle = Math.PI / 2 - theta1;
    positions.forEach((pos, i) => {
        const x = originX + rayLength * pos * Math.cos(reflectedAngle);
        const y = originY - rayLength * pos * Math.sin(reflectedAngle);
        const fieldPhase = phase - pos * 3;
        
        if (polarizationType === "both" || polarizationType === "s") {
            const amplitude = Math.sqrt(coeffs.rs);
            drawEFieldVector(x - 10, y, amplitude, reflectedAngle, S_POL_COLOR, false, fieldPhase);
        }
        if (polarizationType === "both" || polarizationType === "p") {
            const amplitude = Math.sqrt(coeffs.rp);
            drawEFieldVector(x + 10, y, amplitude, reflectedAngle, P_POL_COLOR, true, fieldPhase);
        }
    });
    
    // Refracted ray E-fields
    if (!coeffs.tir && coeffs.theta2 !== undefined) {
        const refrAngle = -Math.PI / 2 + coeffs.theta2;
        positions.forEach((pos, i) => {
            const x = originX + rayLength * pos * Math.cos(refrAngle);
            const y = originY - rayLength * pos * Math.sin(refrAngle);
            const fieldPhase = phase - pos * 3;
            
            if (polarizationType === "both" || polarizationType === "s") {
                const amplitude = Math.sqrt(coeffs.ts);
                drawEFieldVector(x - 10, y, amplitude, refrAngle, S_POL_COLOR, false, fieldPhase);
            }
            if (polarizationType === "both" || polarizationType === "p") {
                const amplitude = Math.sqrt(coeffs.tp);
                drawEFieldVector(x + 10, y, amplitude, refrAngle, P_POL_COLOR, true, fieldPhase);
            }
        });
    }
}

function drawBrewsterHighlight() {
    const brewsterAngle = calculateBrewsterAngle();
    const isAtBrewster = Math.abs(theta1 - brewsterAngle) < 0.02;
    
    if (isAtBrewster) {
        const interfaceY = ch / 2;
        const originX = cw / 2;
        
        // Highlight the origin point
        ctx.fillStyle = BREWSTER_COLOR;
        ctx.beginPath();
        ctx.arc(originX, interfaceY, 8, 0, 2 * Math.PI);
        ctx.fill();
        
        // Add star burst effect
        ctx.strokeStyle = BREWSTER_COLOR;
        ctx.lineWidth = 2;
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * 2 * Math.PI;
            const innerRadius = 12;
            const outerRadius = 20;
            ctx.beginPath();
            ctx.moveTo(originX + innerRadius * Math.cos(angle), 
                      interfaceY + innerRadius * Math.sin(angle));
            ctx.lineTo(originX + outerRadius * Math.cos(angle), 
                      interfaceY + outerRadius * Math.sin(angle));
            ctx.stroke();
        }
        
        // Label
        ctx.fillStyle = BREWSTER_COLOR;
        ctx.font = "bold 14px Arial";
        ctx.textAlign = "center";
        ctx.fillText("Brewster Angle!", originX, interfaceY - 35);
    }
}

function drawLegend() {
    const legendX = cw - 150;
    const legendY = 20;
    const spacing = 20;
    
    ctx.font = "12px Arial";
    ctx.textAlign = "left";
    
    // Incident ray
    ctx.fillStyle = INCIDENT_COLOR;
    ctx.fillRect(legendX, legendY, 15, 3);
    ctx.fillText("Incident", legendX + 20, legendY + 5);
    
    // Reflected ray
    ctx.fillStyle = REFLECTED_COLOR;
    ctx.fillRect(legendX, legendY + spacing, 15, 3);
    ctx.fillText("Reflected", legendX + 20, legendY + spacing + 5);
    
    // Refracted ray
    ctx.fillStyle = REFRACTED_COLOR;
    ctx.fillRect(legendX, legendY + 2 * spacing, 15, 3);
    ctx.fillText("Refracted", legendX + 20, legendY + 2 * spacing + 5);
    
    if (showEFields.checked) {
        // s-polarization
        ctx.fillStyle = S_POL_COLOR;
        ctx.beginPath();
        ctx.arc(legendX + 7, legendY + 3.5 * spacing, 5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillText("s-pol (⊥)", legendX + 20, legendY + 3.5 * spacing + 4);
        
        // p-polarization
        ctx.fillStyle = P_POL_COLOR;
        ctx.fillRect(legendX, legendY + 4.5 * spacing, 15, 3);
        ctx.fillText("p-pol (∥)", legendX + 20, legendY + 4.5 * spacing + 5);
    }
}

function drawAll() {
    ctx.clearRect(0, 0, cw, ch);
    drawInterface();
    drawRays();
    drawEFields();
    drawBrewsterHighlight();
    drawLegend();
}

function animate() {
    if (!animationRunning) return;
    frameCounter++;
    drawAll();
    requestAnimationFrame(animate);
}

// Event listeners
thetaSlider.addEventListener("input", () => {
    updateStats();
    updatePresetButtons(null);
    drawAll();
});

n2Slider.addEventListener("input", () => {
    updateStats();
    drawAll();
});

showEFields.addEventListener("change", () => {
    drawAll();
});

animateWaves.addEventListener("change", () => {
    if (animateWaves.checked && !animationRunning) {
        animationRunning = true;
        startStopBtn.innerHTML = '<span>⏸️</span> Stop Animation';
        animate();
    } else if (!animateWaves.checked && animationRunning) {
        animationRunning = false;
        startStopBtn.innerHTML = '<span>▶️</span> Start Animation';
    }
});

// Preset buttons
btnBrewster.addEventListener("click", () => {
    const brewsterAngle = calculateBrewsterAngle() * 180 / Math.PI;
    thetaSlider.value = Math.round(brewsterAngle);
    updateStats();
    updatePresetButtons(btnBrewster);
    drawAll();
});

btnCritical.addEventListener("click", () => {
    const criticalAngle = calculateCriticalAngle();
    if (criticalAngle !== null) {
        thetaSlider.value = Math.round(criticalAngle * 180 / Math.PI);
        updateStats();
        updatePresetButtons(btnCritical);
        drawAll();
    } else {
        // No critical angle - set to a value close to 90 to show this
        alert("Critical angle only exists when n₁ > n₂ (light going from denser to less dense medium)");
    }
});

btnNormal.addEventListener("click", () => {
    thetaSlider.value = "0";
    updateStats();
    updatePresetButtons(btnNormal);
    drawAll();
});

btnGrazing.addEventListener("click", () => {
    thetaSlider.value = "45";
    updateStats();
    updatePresetButtons(btnGrazing);
    drawAll();
});

// Polarization buttons
btnBoth.addEventListener("click", () => {
    polarizationType = "both";
    updatePolarizationButtons(btnBoth);
    updateStats();
    drawAll();
});

btnS.addEventListener("click", () => {
    polarizationType = "s";
    updatePolarizationButtons(btnS);
    updateStats();
    drawAll();
});

btnP.addEventListener("click", () => {
    polarizationType = "p";
    updatePolarizationButtons(btnP);
    updateStats();
    drawAll();
});

// Start/Stop button
startStopBtn.addEventListener("click", () => {
    animationRunning = !animationRunning;
    animateWaves.checked = animationRunning;
    startStopBtn.innerHTML = animationRunning ?
        '<span>⏸️</span> Stop Animation' :
        '<span>▶️</span> Start Animation';
    if (animationRunning) animate();
});

// Reset button
resetBtn.addEventListener("click", () => {
    animationRunning = false;
    animateWaves.checked = false;
    startStopBtn.innerHTML = '<span>▶️</span> Start Animation';
    frameCounter = 0;
    
    thetaSlider.value = "45";
    n2Slider.value = "1.50";
    polarizationType = "both";
    showEFields.checked = true;
    
    updatePolarizationButtons(btnBoth);
    updatePresetButtons(btnGrazing);
    updateStats();
    drawAll();
});

// Initialize
updateStats();
drawAll();
