"use strict";

// ===================================
// Interactive 3D Ring Visualization
// ===================================

// Canvas and context with high-DPI support
const canvas = document.getElementById("ringCanvas");
const ctx = canvas.getContext("2d");

// Set up canvas for high-DPI displays
const dpr = window.devicePixelRatio || 1;
const baseWidth = 800;
const baseHeight = 600;
canvas.width = baseWidth * dpr;
canvas.height = baseHeight * dpr;
canvas.style.width = baseWidth + "px";
canvas.style.height = baseHeight + "px";
ctx.scale(dpr, dpr);

// Use logical dimensions for rendering calculations
const cw = baseWidth;
const ch = baseHeight;

// UI Elements - Parameters
const majorRadiusSlider = document.getElementById("majorRadius");
const majorRadiusValue = document.getElementById("majorRadiusValue");
const minorRadiusSlider = document.getElementById("minorRadius");
const minorRadiusValue = document.getElementById("minorRadiusValue");
const segmentsUSlider = document.getElementById("segmentsU");
const segmentsUValue = document.getElementById("segmentsUValue");
const segmentsVSlider = document.getElementById("segmentsV");
const segmentsVValue = document.getElementById("segmentsVValue");

// UI Elements - Appearance
const ringColorInput = document.getElementById("ringColor");
const ringColorLabel = document.getElementById("ringColorLabel");
const bgColorInput = document.getElementById("bgColor");
const bgColorLabel = document.getElementById("bgColorLabel");
const shininessSlider = document.getElementById("shininess");
const shininessValue = document.getElementById("shininessValue");

// UI Elements - Animation
const autoRotateCheck = document.getElementById("autoRotate");
const rotationSpeedSlider = document.getElementById("rotationSpeed");
const rotationSpeedValue = document.getElementById("rotationSpeedValue");
const wobbleEffectCheck = document.getElementById("wobbleEffect");

// UI Elements - Lighting
const lightIntensitySlider = document.getElementById("lightIntensity");
const lightIntensityValue = document.getElementById("lightIntensityValue");
const ambientLightSlider = document.getElementById("ambientLight");
const ambientLightValue = document.getElementById("ambientLightValue");

// UI Elements - Buttons
const resetViewBtn = document.getElementById("resetViewBtn");
const screenshotBtn = document.getElementById("screenshotBtn");
const fullscreenBtn = document.getElementById("fullscreenBtn");

// Preset buttons
const presetClassic = document.getElementById("presetClassic");
const presetThin = document.getElementById("presetThin");
const presetThick = document.getElementById("presetThick");
const presetDonut = document.getElementById("presetDonut");

// Render mode buttons
const modeShaded = document.getElementById("modeShaded");
const modeWireframe = document.getElementById("modeWireframe");
const modePoints = document.getElementById("modePoints");

// Stats elements
const statMajorRadius = document.getElementById("stat-major-radius");
const statMinorRadius = document.getElementById("stat-minor-radius");
const statRenderMode = document.getElementById("stat-render-mode");
const statVertices = document.getElementById("stat-vertices");

// ===================================
// State Variables
// ===================================

let state = {
    // Ring parameters
    majorRadius: 1.0,
    minorRadius: 0.4,
    segmentsU: 48,
    segmentsV: 24,
    
    // Appearance
    ringColor: "#ffd700",
    bgColor: "#1a1a2e",
    shininess: 32,
    
    // Camera/View
    rotationX: 0.5,
    rotationY: 0.3,
    zoom: 250,
    
    // Animation
    autoRotate: true,
    rotationSpeed: 1.0,
    wobble: false,
    wobblePhase: 0,
    
    // Lighting
    lightIntensity: 1.0,
    ambientLight: 0.3,
    lightPosition: { x: 2, y: 2, z: 3 },
    
    // Render mode
    renderMode: "shaded", // "shaded", "wireframe", "points"
    
    // Interaction
    isDragging: false,
    lastMouseX: 0,
    lastMouseY: 0,
    
    // Animation
    animationId: null,
    lastTime: 0
};

// ===================================
// Vector Math Utilities
// ===================================

function vec3(x, y, z) {
    return { x, y, z };
}

function normalize(v) {
    const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    if (len === 0) return vec3(0, 0, 0);
    return vec3(v.x / len, v.y / len, v.z / len);
}

function dot(a, b) {
    return a.x * b.x + a.y * b.y + a.z * b.z;
}

function subtract(a, b) {
    return vec3(a.x - b.x, a.y - b.y, a.z - b.z);
}

function reflect(incident, normal) {
    const d = 2 * dot(incident, normal);
    return vec3(
        incident.x - d * normal.x,
        incident.y - d * normal.y,
        incident.z - d * normal.z
    );
}

// ===================================
// Color Utilities
// ===================================

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 255, g: 215, b: 0 };
}

function rgbToString(r, g, b, a = 1) {
    return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a})`;
}

// ===================================
// 3D Transformation
// ===================================

function rotateX(point, angle) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return vec3(
        point.x,
        point.y * cos - point.z * sin,
        point.y * sin + point.z * cos
    );
}

function rotateY(point, angle) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return vec3(
        point.x * cos + point.z * sin,
        point.y,
        -point.x * sin + point.z * cos
    );
}

function project(point) {
    const perspective = 4;
    const scale = state.zoom / (perspective + point.z);
    return {
        x: cw / 2 + point.x * scale,
        y: ch / 2 - point.y * scale,
        z: point.z,
        scale: scale
    };
}

// ===================================
// Torus Generation
// ===================================

function generateTorus() {
    const R = state.majorRadius;
    const r = state.minorRadius;
    const segU = state.segmentsU;
    const segV = state.segmentsV;
    
    const vertices = [];
    const normals = [];
    const faces = [];
    
    // Generate vertices and normals
    for (let i = 0; i <= segU; i++) {
        const u = (i / segU) * 2 * Math.PI;
        const cosU = Math.cos(u);
        const sinU = Math.sin(u);
        
        for (let j = 0; j <= segV; j++) {
            const v = (j / segV) * 2 * Math.PI;
            const cosV = Math.cos(v);
            const sinV = Math.sin(v);
            
            // Vertex position
            const x = (R + r * cosV) * cosU;
            const y = (R + r * cosV) * sinU;
            const z = r * sinV;
            
            vertices.push(vec3(x, z, y)); // Note: swapping y and z for better view
            
            // Normal vector (pointing outward from tube surface)
            const nx = cosV * cosU;
            const ny = cosV * sinU;
            const nz = sinV;
            
            normals.push(normalize(vec3(nx, nz, ny))); // Match vertex swap
        }
    }
    
    // Generate faces (quads as two triangles)
    for (let i = 0; i < segU; i++) {
        for (let j = 0; j < segV; j++) {
            const a = i * (segV + 1) + j;
            const b = a + segV + 1;
            const c = b + 1;
            const d = a + 1;
            
            faces.push([a, b, d]);
            faces.push([b, c, d]);
        }
    }
    
    return { vertices, normals, faces };
}

// ===================================
// Lighting Calculation
// ===================================

function calculateLighting(point, normal) {
    const baseColor = hexToRgb(state.ringColor);
    const lightPos = normalize(state.lightPosition);
    const viewDir = normalize(vec3(0, 0, 1));
    
    // Ambient component
    const ambient = state.ambientLight;
    
    // Diffuse component (Lambertian)
    const diffuseIntensity = Math.max(0, dot(normal, lightPos));
    const diffuse = diffuseIntensity * state.lightIntensity;
    
    // Specular component (Phong)
    const halfVector = normalize(vec3(
        lightPos.x + viewDir.x,
        lightPos.y + viewDir.y,
        lightPos.z + viewDir.z
    ));
    const specIntensity = Math.pow(Math.max(0, dot(normal, halfVector)), state.shininess);
    const specular = specIntensity * state.lightIntensity * 0.5;
    
    // Combine lighting
    const totalLight = ambient + diffuse * 0.7;
    
    const r = Math.min(255, baseColor.r * totalLight + 255 * specular);
    const g = Math.min(255, baseColor.g * totalLight + 255 * specular);
    const b = Math.min(255, baseColor.b * totalLight + 255 * specular);
    
    return rgbToString(r, g, b);
}

// ===================================
// Rendering
// ===================================

function render() {
    const torus = generateTorus();
    
    // Apply wobble effect
    let wobbleX = 0, wobbleY = 0;
    if (state.wobble) {
        state.wobblePhase += 0.02;
        wobbleX = Math.sin(state.wobblePhase * 2) * 0.1;
        wobbleY = Math.cos(state.wobblePhase * 3) * 0.08;
    }
    
    // Transform vertices
    const transformedVertices = torus.vertices.map(v => {
        let p = rotateX(v, state.rotationX + wobbleX);
        p = rotateY(p, state.rotationY + wobbleY);
        return p;
    });
    
    // Transform normals
    const transformedNormals = torus.normals.map(n => {
        let p = rotateX(n, state.rotationX + wobbleX);
        p = rotateY(p, state.rotationY + wobbleY);
        return normalize(p);
    });
    
    // Project vertices
    const projectedVertices = transformedVertices.map(v => project(v));
    
    // Clear canvas
    ctx.fillStyle = state.bgColor;
    ctx.fillRect(0, 0, cw, ch);
    
    // Update stats
    statVertices.textContent = torus.vertices.length;
    
    if (state.renderMode === "shaded") {
        renderShaded(torus, transformedVertices, transformedNormals, projectedVertices);
    } else if (state.renderMode === "wireframe") {
        renderWireframe(torus, projectedVertices);
    } else if (state.renderMode === "points") {
        renderPoints(torus, transformedNormals, projectedVertices);
    }
}

function renderShaded(torus, transformedVertices, transformedNormals, projectedVertices) {
    // Collect faces with depth information
    const facesWithDepth = torus.faces.map((face, i) => {
        const avgZ = (transformedVertices[face[0]].z + 
                     transformedVertices[face[1]].z + 
                     transformedVertices[face[2]].z) / 3;
        return { face, avgZ, index: i };
    });
    
    // Sort by depth (painter's algorithm - draw far faces first)
    facesWithDepth.sort((a, b) => b.avgZ - a.avgZ);
    
    // Draw faces
    for (const { face } of facesWithDepth) {
        const p0 = projectedVertices[face[0]];
        const p1 = projectedVertices[face[1]];
        const p2 = projectedVertices[face[2]];
        
        // Back-face culling - check if face is facing away
        const edge1x = p1.x - p0.x;
        const edge1y = p1.y - p0.y;
        const edge2x = p2.x - p0.x;
        const edge2y = p2.y - p0.y;
        const cross = edge1x * edge2y - edge1y * edge2x;
        
        if (cross > 0) continue; // Skip back-facing triangles
        
        // Calculate average normal for face
        const n0 = transformedNormals[face[0]];
        const n1 = transformedNormals[face[1]];
        const n2 = transformedNormals[face[2]];
        const avgNormal = normalize(vec3(
            (n0.x + n1.x + n2.x) / 3,
            (n0.y + n1.y + n2.y) / 3,
            (n0.z + n1.z + n2.z) / 3
        ));
        
        // Calculate lighting
        const color = calculateLighting(null, avgNormal);
        
        // Draw triangle
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.closePath();
        
        ctx.fillStyle = color;
        ctx.fill();
        
        // Add subtle edge for definition
        ctx.strokeStyle = rgbToString(0, 0, 0, 0.1);
        ctx.lineWidth = 0.5;
        ctx.stroke();
    }
}

function renderWireframe(torus, projectedVertices) {
    const baseColor = hexToRgb(state.ringColor);
    ctx.strokeStyle = rgbToString(baseColor.r, baseColor.g, baseColor.b, 0.8);
    ctx.lineWidth = 1;
    
    const segU = state.segmentsU;
    const segV = state.segmentsV;
    
    // Draw horizontal lines (around the torus)
    for (let i = 0; i <= segU; i++) {
        ctx.beginPath();
        for (let j = 0; j <= segV; j++) {
            const idx = i * (segV + 1) + j;
            const p = projectedVertices[idx];
            if (j === 0) {
                ctx.moveTo(p.x, p.y);
            } else {
                ctx.lineTo(p.x, p.y);
            }
        }
        ctx.stroke();
    }
    
    // Draw vertical lines (around the tube)
    for (let j = 0; j <= segV; j++) {
        ctx.beginPath();
        for (let i = 0; i <= segU; i++) {
            const idx = i * (segV + 1) + j;
            const p = projectedVertices[idx];
            if (i === 0) {
                ctx.moveTo(p.x, p.y);
            } else {
                ctx.lineTo(p.x, p.y);
            }
        }
        ctx.stroke();
    }
}

function renderPoints(torus, transformedNormals, projectedVertices) {
    const baseColor = hexToRgb(state.ringColor);
    
    // Draw each vertex as a point with lighting
    for (let i = 0; i < projectedVertices.length; i++) {
        const p = projectedVertices[i];
        const n = transformedNormals[i];
        
        // Calculate lighting for point
        const lightPos = normalize(state.lightPosition);
        const intensity = state.ambientLight + 
                         Math.max(0, dot(n, lightPos)) * state.lightIntensity * 0.7;
        
        const r = Math.min(255, baseColor.r * intensity);
        const g = Math.min(255, baseColor.g * intensity);
        const b = Math.min(255, baseColor.b * intensity);
        
        ctx.fillStyle = rgbToString(r, g, b);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
        ctx.fill();
    }
}

// ===================================
// Animation Loop
// ===================================

function animate(timestamp) {
    if (!state.lastTime) state.lastTime = timestamp;
    const deltaTime = (timestamp - state.lastTime) / 1000;
    state.lastTime = timestamp;
    
    // Auto rotation
    if (state.autoRotate) {
        state.rotationY += deltaTime * 0.5 * state.rotationSpeed;
    }
    
    render();
    state.animationId = requestAnimationFrame(animate);
}

function startAnimation() {
    if (!state.animationId) {
        state.animationId = requestAnimationFrame(animate);
    }
}

function stopAnimation() {
    if (state.animationId) {
        cancelAnimationFrame(state.animationId);
        state.animationId = null;
    }
}

// ===================================
// Mouse/Touch Interaction
// ===================================

function handleMouseDown(e) {
    state.isDragging = true;
    state.lastMouseX = e.clientX;
    state.lastMouseY = e.clientY;
    canvas.style.cursor = "grabbing";
}

function handleMouseMove(e) {
    if (!state.isDragging) return;
    
    const deltaX = e.clientX - state.lastMouseX;
    const deltaY = e.clientY - state.lastMouseY;
    
    state.rotationY += deltaX * 0.01;
    state.rotationX += deltaY * 0.01;
    
    // Clamp rotation X to prevent flipping
    state.rotationX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, state.rotationX));
    
    state.lastMouseX = e.clientX;
    state.lastMouseY = e.clientY;
}

function handleMouseUp() {
    state.isDragging = false;
    canvas.style.cursor = "grab";
}

function handleWheel(e) {
    e.preventDefault();
    const zoomDelta = e.deltaY * -0.5;
    state.zoom = Math.max(100, Math.min(500, state.zoom + zoomDelta));
}

// Touch support
function handleTouchStart(e) {
    if (e.touches.length === 1) {
        state.isDragging = true;
        state.lastMouseX = e.touches[0].clientX;
        state.lastMouseY = e.touches[0].clientY;
    }
}

function handleTouchMove(e) {
    if (!state.isDragging || e.touches.length !== 1) return;
    e.preventDefault();
    
    const deltaX = e.touches[0].clientX - state.lastMouseX;
    const deltaY = e.touches[0].clientY - state.lastMouseY;
    
    state.rotationY += deltaX * 0.01;
    state.rotationX += deltaY * 0.01;
    state.rotationX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, state.rotationX));
    
    state.lastMouseX = e.touches[0].clientX;
    state.lastMouseY = e.touches[0].clientY;
}

function handleTouchEnd() {
    state.isDragging = false;
}

// ===================================
// UI Updates
// ===================================

function updateStats() {
    statMajorRadius.textContent = state.majorRadius.toFixed(1);
    statMinorRadius.textContent = state.minorRadius.toFixed(1);
    statRenderMode.textContent = state.renderMode.charAt(0).toUpperCase() + state.renderMode.slice(1);
}

function updatePresetButtons(activeBtn) {
    [presetClassic, presetThin, presetThick, presetDonut].forEach(btn => {
        btn.classList.remove("active");
    });
    if (activeBtn) {
        activeBtn.classList.add("active");
    }
}

function updateRenderModeButtons(activeBtn) {
    [modeShaded, modeWireframe, modePoints].forEach(btn => {
        btn.classList.remove("active");
    });
    if (activeBtn) {
        activeBtn.classList.add("active");
    }
}

function applyPreset(preset) {
    switch (preset) {
        case "classic":
            state.majorRadius = 1.0;
            state.minorRadius = 0.4;
            state.ringColor = "#ffd700";
            break;
        case "thin":
            state.majorRadius = 1.2;
            state.minorRadius = 0.15;
            state.ringColor = "#c0c0c0";
            break;
        case "thick":
            state.majorRadius = 0.8;
            state.minorRadius = 0.5;
            state.ringColor = "#e8b04b";
            break;
        case "donut":
            state.majorRadius = 0.9;
            state.minorRadius = 0.6;
            state.ringColor = "#d2691e";
            break;
    }
    
    // Update sliders
    majorRadiusSlider.value = state.majorRadius;
    majorRadiusValue.textContent = state.majorRadius.toFixed(1);
    minorRadiusSlider.value = state.minorRadius;
    minorRadiusValue.textContent = state.minorRadius.toFixed(2);
    ringColorInput.value = state.ringColor;
    ringColorLabel.textContent = state.ringColor;
    
    updateStats();
}

// ===================================
// Event Listeners
// ===================================

// Canvas interaction
canvas.addEventListener("mousedown", handleMouseDown);
canvas.addEventListener("mousemove", handleMouseMove);
canvas.addEventListener("mouseup", handleMouseUp);
canvas.addEventListener("mouseleave", handleMouseUp);
canvas.addEventListener("wheel", handleWheel, { passive: false });

canvas.addEventListener("touchstart", handleTouchStart, { passive: true });
canvas.addEventListener("touchmove", handleTouchMove, { passive: false });
canvas.addEventListener("touchend", handleTouchEnd, { passive: true });

// Parameter sliders
majorRadiusSlider.addEventListener("input", () => {
    state.majorRadius = parseFloat(majorRadiusSlider.value);
    majorRadiusValue.textContent = state.majorRadius.toFixed(1);
    updateStats();
    updatePresetButtons(null);
});

minorRadiusSlider.addEventListener("input", () => {
    state.minorRadius = parseFloat(minorRadiusSlider.value);
    minorRadiusValue.textContent = state.minorRadius.toFixed(2);
    updateStats();
    updatePresetButtons(null);
});

segmentsUSlider.addEventListener("input", () => {
    state.segmentsU = parseInt(segmentsUSlider.value);
    segmentsUValue.textContent = state.segmentsU;
});

segmentsVSlider.addEventListener("input", () => {
    state.segmentsV = parseInt(segmentsVSlider.value);
    segmentsVValue.textContent = state.segmentsV;
});

// Appearance
ringColorInput.addEventListener("input", () => {
    state.ringColor = ringColorInput.value;
    ringColorLabel.textContent = state.ringColor;
    updatePresetButtons(null);
});

bgColorInput.addEventListener("input", () => {
    state.bgColor = bgColorInput.value;
    bgColorLabel.textContent = state.bgColor;
});

shininessSlider.addEventListener("input", () => {
    state.shininess = parseInt(shininessSlider.value);
    shininessValue.textContent = state.shininess;
});

// Animation
autoRotateCheck.addEventListener("change", () => {
    state.autoRotate = autoRotateCheck.checked;
});

rotationSpeedSlider.addEventListener("input", () => {
    state.rotationSpeed = parseFloat(rotationSpeedSlider.value);
    rotationSpeedValue.textContent = state.rotationSpeed.toFixed(1) + "x";
});

wobbleEffectCheck.addEventListener("change", () => {
    state.wobble = wobbleEffectCheck.checked;
    if (!state.wobble) {
        state.wobblePhase = 0;
    }
});

// Lighting
lightIntensitySlider.addEventListener("input", () => {
    state.lightIntensity = parseFloat(lightIntensitySlider.value);
    lightIntensityValue.textContent = state.lightIntensity.toFixed(1);
});

ambientLightSlider.addEventListener("input", () => {
    state.ambientLight = parseFloat(ambientLightSlider.value);
    ambientLightValue.textContent = state.ambientLight.toFixed(2);
});

// Presets
presetClassic.addEventListener("click", () => {
    applyPreset("classic");
    updatePresetButtons(presetClassic);
});

presetThin.addEventListener("click", () => {
    applyPreset("thin");
    updatePresetButtons(presetThin);
});

presetThick.addEventListener("click", () => {
    applyPreset("thick");
    updatePresetButtons(presetThick);
});

presetDonut.addEventListener("click", () => {
    applyPreset("donut");
    updatePresetButtons(presetDonut);
});

// Render modes
modeShaded.addEventListener("click", () => {
    state.renderMode = "shaded";
    updateRenderModeButtons(modeShaded);
    updateStats();
});

modeWireframe.addEventListener("click", () => {
    state.renderMode = "wireframe";
    updateRenderModeButtons(modeWireframe);
    updateStats();
});

modePoints.addEventListener("click", () => {
    state.renderMode = "points";
    updateRenderModeButtons(modePoints);
    updateStats();
});

// Action buttons
resetViewBtn.addEventListener("click", () => {
    state.rotationX = 0.5;
    state.rotationY = 0.3;
    state.zoom = 250;
});

screenshotBtn.addEventListener("click", () => {
    // Create a temporary link to download the canvas
    const link = document.createElement("a");
    link.download = "3d-ring-" + Date.now() + ".png";
    link.href = canvas.toDataURL("image/png");
    link.click();
});

fullscreenBtn.addEventListener("click", () => {
    if (canvas.requestFullscreen) {
        canvas.requestFullscreen();
    } else if (canvas.webkitRequestFullscreen) {
        canvas.webkitRequestFullscreen();
    } else if (canvas.mozRequestFullScreen) {
        canvas.mozRequestFullScreen();
    }
});

// Handle fullscreen change to maintain aspect ratio
function handleFullscreenChange() {
    const fullscreenElement = document.fullscreenElement || 
                              document.webkitFullscreenElement || 
                              document.mozFullScreenElement;
    
    if (fullscreenElement === canvas) {
        // In fullscreen - adjust canvas size with device pixel ratio
        const dpr = window.devicePixelRatio || 1;
        canvas.width = window.innerWidth * dpr;
        canvas.height = window.innerHeight * dpr;
        canvas.style.width = window.innerWidth + "px";
        canvas.style.height = window.innerHeight + "px";
        ctx.scale(dpr, dpr);
    } else {
        // Exit fullscreen - restore original size with device pixel ratio
        const dpr = window.devicePixelRatio || 1;
        canvas.width = 800 * dpr;
        canvas.height = 600 * dpr;
        canvas.style.width = "800px";
        canvas.style.height = "600px";
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
}

document.addEventListener("fullscreenchange", handleFullscreenChange);
document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
document.addEventListener("mozfullscreenchange", handleFullscreenChange);

// ===================================
// Initialization
// ===================================

function init() {
    updateStats();
    startAnimation();
}

// Start the application
init();
