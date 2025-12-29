/**
 * Futuristic City Simulation using Three.js
 * 
 * This module creates an interactive 3D city with skyscrapers, highways,
 * and dynamic day/night cycle effects.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Global variables
let scene, camera, renderer, controls;
let buildings = [];
let highways = [];
let lights = {
    sun: null,
    ambient: null,
    buildingLights: []
};
let animationSpeed = 1.0;
let currentTime = 12.0; // 12:00 (noon)

// DOM Elements
const container = document.getElementById('canvas-container');
const timeSlider = document.getElementById('time-slider');
const timeDisplay = document.getElementById('time-display');
const fogSlider = document.getElementById('fog-slider');
const fogDisplay = document.getElementById('fog-display');
const speedSlider = document.getElementById('speed-slider');
const speedDisplay = document.getElementById('speed-display');
const resetBtn = document.getElementById('reset-btn');

/**
 * Initialize the Three.js scene
 */
function init() {
    // Create scene
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x87ceeb, 50, 500);

    // Create camera
    camera = new THREE.PerspectiveCamera(
        60,
        container.clientWidth / container.clientHeight,
        0.1,
        1000
    );
    camera.position.set(80, 60, 80);
    camera.lookAt(0, 0, 0);

    // Create renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // Add orbit controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 30;
    controls.maxDistance = 200;
    controls.maxPolarAngle = Math.PI / 2.1;

    // Create lights
    createLights();

    // Create city elements
    createGround();
    createBuildings();
    createHighways();
    createParticles();

    // Setup event listeners
    setupEventListeners();

    // Initialize with default values
    updateDayNightCycle(12);
    updateFog(20);
    updateSpeed(100);

    // Start animation loop
    animate();
}

/**
 * Create lighting system
 */
function createLights() {
    // Ambient light
    lights.ambient = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(lights.ambient);

    // Sun/Moon directional light
    lights.sun = new THREE.DirectionalLight(0xffffff, 1.0);
    lights.sun.position.set(50, 50, 50);
    lights.sun.castShadow = true;
    lights.sun.shadow.camera.left = -100;
    lights.sun.shadow.camera.right = 100;
    lights.sun.shadow.camera.top = 100;
    lights.sun.shadow.camera.bottom = -100;
    lights.sun.shadow.mapSize.width = 2048;
    lights.sun.shadow.mapSize.height = 2048;
    scene.add(lights.sun);
}

/**
 * Create the ground plane
 */
function createGround() {
    const groundGeometry = new THREE.PlaneGeometry(300, 300);
    const groundMaterial = new THREE.MeshStandardMaterial({
        color: 0x1a1a2e,
        roughness: 0.8,
        metalness: 0.2
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Add grid pattern
    const gridHelper = new THREE.GridHelper(300, 60, 0x444444, 0x222222);
    gridHelper.position.y = 0.1;
    scene.add(gridHelper);
}

/**
 * Create skyscrapers with varying heights and styles
 */
function createBuildings() {
    const buildingCount = 40;
    const cityRadius = 60;

    for (let i = 0; i < buildingCount; i++) {
        // Random position in a circular pattern
        const angle = (i / buildingCount) * Math.PI * 2 + Math.random() * 0.5;
        const radius = 15 + Math.random() * cityRadius;
        const x = Math.cos(angle) * radius + (Math.random() - 0.5) * 10;
        const z = Math.sin(angle) * radius + (Math.random() - 0.5) * 10;

        // Random building dimensions
        const width = 3 + Math.random() * 5;
        const depth = 3 + Math.random() * 5;
        const height = 10 + Math.random() * 50;

        // Create building geometry
        const geometry = new THREE.BoxGeometry(width, height, depth);
        
        // Building material with emissive glow
        const hue = 0.55 + Math.random() * 0.15; // Blue-cyan range
        const material = new THREE.MeshStandardMaterial({
            color: new THREE.Color().setHSL(hue, 0.7, 0.3),
            emissive: new THREE.Color().setHSL(hue, 0.5, 0.2),
            emissiveIntensity: 0.5,
            roughness: 0.3,
            metalness: 0.8
        });

        const building = new THREE.Mesh(geometry, material);
        building.position.set(x, height / 2, z);
        building.castShadow = true;
        building.receiveShadow = true;
        scene.add(building);
        buildings.push(building);

        // Add glowing windows
        addBuildingWindows(building, width, height, depth);

        // Add antenna to tall buildings
        if (height > 35) {
            addAntenna(building, height);
        }
    }
}

/**
 * Add glowing windows to a building
 */
function addBuildingWindows(building, width, height, depth) {
    const windowCount = Math.floor(height / 3);
    const windowsPerRow = 3;

    for (let floor = 0; floor < windowCount; floor++) {
        for (let col = 0; col < windowsPerRow; col++) {
            if (Math.random() > 0.3) { // 70% chance of window being lit
                const windowGeometry = new THREE.BoxGeometry(0.3, 0.8, 0.1);
                const windowMaterial = new THREE.MeshStandardMaterial({
                    color: 0xffff99,
                    emissive: 0xffff66,
                    emissiveIntensity: 2.0
                });
                const window = new THREE.Mesh(windowGeometry, windowMaterial);
                
                const offsetX = (col - 1) * (width / 3);
                const offsetY = (floor - windowCount / 2) * 3 + height / 2;
                
                window.position.set(offsetX, offsetY, depth / 2 + 0.05);
                building.add(window);

                // Add point light for window glow
                const pointLight = new THREE.PointLight(0xffff66, 0.3, 10);
                pointLight.position.copy(window.position);
                building.add(pointLight);
                lights.buildingLights.push(pointLight);
            }
        }
    }
}

/**
 * Add antenna to building top
 */
function addAntenna(building, height) {
    const antennaGeometry = new THREE.CylinderGeometry(0.1, 0.1, 8, 8);
    const antennaMaterial = new THREE.MeshStandardMaterial({
        color: 0xff0000,
        emissive: 0xff0000,
        emissiveIntensity: 1.0
    });
    const antenna = new THREE.Mesh(antennaGeometry, antennaMaterial);
    antenna.position.y = height / 2 + 4;
    building.add(antenna);

    // Add blinking light
    const beaconGeometry = new THREE.SphereGeometry(0.3, 8, 8);
    const beaconMaterial = new THREE.MeshStandardMaterial({
        color: 0xff0000,
        emissive: 0xff0000,
        emissiveIntensity: 2.0
    });
    const beacon = new THREE.Mesh(beaconGeometry, beaconMaterial);
    beacon.position.y = height / 2 + 8;
    building.add(beacon);
}

/**
 * Create highway system
 */
function createHighways() {
    const highwayMaterial = new THREE.MeshStandardMaterial({
        color: 0x333333,
        roughness: 0.9,
        metalness: 0.1
    });

    // Create main highways in grid pattern
    for (let i = -3; i <= 3; i++) {
        if (i === 0) continue; // Skip center

        const offset = i * 25;

        // Horizontal highway
        const hHighway = new THREE.Mesh(
            new THREE.BoxGeometry(200, 0.2, 4),
            highwayMaterial
        );
        hHighway.position.set(0, 0.1, offset);
        hHighway.receiveShadow = true;
        scene.add(hHighway);
        highways.push(hHighway);

        // Vertical highway
        const vHighway = new THREE.Mesh(
            new THREE.BoxGeometry(4, 0.2, 200),
            highwayMaterial
        );
        vHighway.position.set(offset, 0.1, 0);
        vHighway.receiveShadow = true;
        scene.add(vHighway);
        highways.push(vHighway);

        // Add highway lane markers
        addLaneMarkers(hHighway, true);
        addLaneMarkers(vHighway, false);
    }
}

/**
 * Add lane markers to highways
 */
function addLaneMarkers(highway, horizontal) {
    const markerMaterial = new THREE.MeshStandardMaterial({
        color: 0xffff00,
        emissive: 0xffff00,
        emissiveIntensity: 0.5
    });

    const count = 40;
    for (let i = 0; i < count; i++) {
        const marker = new THREE.Mesh(
            new THREE.BoxGeometry(horizontal ? 2 : 0.2, 0.05, horizontal ? 0.2 : 2),
            markerMaterial
        );
        
        const offset = (i - count / 2) * 5;
        if (horizontal) {
            marker.position.set(offset, 0.25, 0);
        } else {
            marker.position.set(0, 0.25, offset);
        }
        highway.add(marker);
    }
}

/**
 * Create atmospheric particles
 */
function createParticles() {
    const particleCount = 1000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 200;
        positions[i * 3 + 1] = Math.random() * 100;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 200;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.5,
        transparent: true,
        opacity: 0.6
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);
}

/**
 * Update day/night cycle
 */
function updateDayNightCycle(time) {
    currentTime = time;

    // Calculate sun position based on time (0-24 hours)
    const sunAngle = (time / 24) * Math.PI * 2 - Math.PI / 2;
    const sunX = Math.cos(sunAngle) * 100;
    const sunY = Math.sin(sunAngle) * 100;
    lights.sun.position.set(sunX, Math.abs(sunY), 50);

    // Determine if it's day or night
    const isDay = time >= 6 && time <= 18;
    const transitionFactor = isDay 
        ? Math.min(1, (time - 6) / 2) * Math.min(1, (18 - time) / 2)
        : 0;

    // Update sun/moon light
    if (isDay) {
        // Daytime - warm sunlight
        lights.sun.color.setHSL(0.1, 1.0, 0.95);
        lights.sun.intensity = 0.8 + transitionFactor * 0.5;
        lights.ambient.intensity = 0.3 + transitionFactor * 0.2;
    } else {
        // Nighttime - cool moonlight
        lights.sun.color.setHSL(0.6, 0.5, 0.8);
        lights.sun.intensity = 0.2;
        lights.ambient.intensity = 0.1;
    }

    // Update ambient light
    lights.ambient.color.setHSL(
        isDay ? 0.6 : 0.65,
        isDay ? 0.3 : 0.8,
        isDay ? 1.0 : 0.3
    );

    // Update sky color
    const skyHue = isDay ? 0.55 : 0.65;
    const skyLightness = isDay ? 0.5 + transitionFactor * 0.3 : 0.05;
    scene.background = new THREE.Color().setHSL(skyHue, 0.8, skyLightness);
    
    // Update fog color to match sky
    scene.fog.color.setHSL(skyHue, 0.6, skyLightness);

    // Update building lights intensity
    const buildingLightIntensity = isDay ? 0.1 : 1.0;
    lights.buildingLights.forEach(light => {
        light.intensity = buildingLightIntensity * 0.3;
    });

    // Update building emissive intensity
    buildings.forEach(building => {
        if (building.material) {
            building.material.emissiveIntensity = isDay ? 0.1 : 0.8;
        }
    });

    // Update time display
    const hours = Math.floor(time);
    const minutes = Math.floor((time - hours) * 60);
    timeDisplay.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

/**
 * Update fog density
 */
function updateFog(density) {
    const near = 50;
    const far = 200 + (100 - density) * 5;
    scene.fog.near = near;
    scene.fog.far = far;
    fogDisplay.textContent = `${density}%`;
}

/**
 * Update animation speed
 */
function updateSpeed(speed) {
    animationSpeed = speed / 100;
    speedDisplay.textContent = `${speed}%`;
}

/**
 * Reset camera to default position
 */
function resetCamera() {
    camera.position.set(80, 60, 80);
    camera.lookAt(0, 0, 0);
    controls.target.set(0, 0, 0);
    controls.update();
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Time slider
    timeSlider.addEventListener('input', (e) => {
        updateDayNightCycle(parseFloat(e.target.value));
    });

    // Fog slider
    fogSlider.addEventListener('input', (e) => {
        updateFog(parseInt(e.target.value));
    });

    // Speed slider
    speedSlider.addEventListener('input', (e) => {
        updateSpeed(parseInt(e.target.value));
    });

    // Reset button
    resetBtn.addEventListener('click', resetCamera);

    // Handle window resize
    window.addEventListener('resize', onWindowResize);
}

/**
 * Handle window resize
 */
function onWindowResize() {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
}

/**
 * Animation loop
 */
function animate() {
    requestAnimationFrame(animate);

    // Update controls
    controls.update();

    // Animate building materials
    const time = Date.now() * 0.0001 * animationSpeed;
    buildings.forEach((building, index) => {
        // Subtle pulsing effect on emissive
        if (building.material && building.material.emissive) {
            const pulse = Math.sin(time + index * 0.5) * 0.1 + 0.9;
            const baseIntensity = currentTime >= 6 && currentTime <= 18 ? 0.1 : 0.8;
            building.material.emissiveIntensity = baseIntensity * pulse;
        }
    });

    // Render scene
    renderer.render(scene, camera);
}

// Initialize the simulation when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
