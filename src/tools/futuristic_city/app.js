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
let isInitialized = false;

// DOM Elements - will be initialized in init()
let container, timeSlider, timeDisplay, fogSlider, fogDisplay, speedSlider, speedDisplay, resetBtn;

/**
 * Initialize DOM element references
 */
function initDOMElements() {
    container = document.getElementById('canvas-container');
    timeSlider = document.getElementById('time-slider');
    timeDisplay = document.getElementById('time-display');
    fogSlider = document.getElementById('fog-slider');
    fogDisplay = document.getElementById('fog-display');
    speedSlider = document.getElementById('speed-slider');
    speedDisplay = document.getElementById('speed-display');
    resetBtn = document.getElementById('reset-btn');
    
    if (!container) {
        console.error('Futuristic City: canvas-container element not found');
        return false;
    }
    return true;
}

/**
 * Initialize the Three.js scene
 */
function init() {
    try {
        // Initialize DOM elements first
        if (!initDOMElements()) {
            return;
        }

        // Ensure container has dimensions
        let containerWidth = container.clientWidth;
        let containerHeight = container.clientHeight;
        
        // Fallback dimensions if container has no size
        if (containerWidth === 0) {
            containerWidth = container.offsetWidth || window.innerWidth * 0.9;
        }
        if (containerHeight === 0) {
            containerHeight = container.offsetHeight || 500;
        }

        // Create scene with initial background
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x87ceeb); // Sky blue initial background
        scene.fog = new THREE.Fog(0x87ceeb, 50, 500);

        // Create camera
        camera = new THREE.PerspectiveCamera(
            60,
            containerWidth / containerHeight,
            0.1,
            1000
        );
        camera.position.set(80, 60, 80);
        camera.lookAt(0, 0, 0);

        // Create renderer with fallback for WebGL issues
        try {
            renderer = new THREE.WebGLRenderer({ 
                antialias: true,
                alpha: false,
                powerPreference: 'default'
            });
        } catch (webglError) {
            console.error('WebGL not available, trying basic renderer');
            renderer = new THREE.WebGLRenderer({ 
                antialias: false
            });
        }
        
        renderer.setSize(containerWidth, containerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.setClearColor(0x87ceeb, 1);
        container.appendChild(renderer.domElement);

        // Add orbit controls
        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.minDistance = 30;
        controls.maxDistance = 200;
        controls.maxPolarAngle = Math.PI / 2.1;
        controls.target.set(0, 20, 0); // Look at building center height

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

        isInitialized = true;

        // Start animation loop
        animate();
        
        console.log('Futuristic City: Initialized successfully with', buildings.length, 'buildings');
    } catch (error) {
        console.error('Futuristic City: Initialization failed', error);
    }
}

/**
 * Create lighting system
 */
function createLights() {
    // Ambient light - brighter for better visibility
    lights.ambient = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(lights.ambient);

    // Sun/Moon directional light
    lights.sun = new THREE.DirectionalLight(0xffffff, 1.2);
    lights.sun.position.set(50, 100, 50);
    lights.sun.castShadow = true;
    lights.sun.shadow.camera.left = -100;
    lights.sun.shadow.camera.right = 100;
    lights.sun.shadow.camera.top = 100;
    lights.sun.shadow.camera.bottom = -100;
    lights.sun.shadow.mapSize.width = 2048;
    lights.sun.shadow.mapSize.height = 2048;
    lights.sun.shadow.camera.near = 1;
    lights.sun.shadow.camera.far = 300;
    scene.add(lights.sun);
    
    // Add a hemisphere light for more natural outdoor lighting
    const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x444444, 0.6);
    hemiLight.position.set(0, 100, 0);
    scene.add(hemiLight);
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
    const buildingCount = 50; // Increased building count
    const cityRadius = 60;
    
    // Building color palette for variety
    const colorPalettes = [
        { h: 0.55, s: 0.6, l: 0.4 },  // Cyan
        { h: 0.6, s: 0.5, l: 0.45 },  // Blue
        { h: 0.58, s: 0.7, l: 0.35 }, // Teal
        { h: 0.52, s: 0.6, l: 0.4 },  // Light cyan
        { h: 0.65, s: 0.4, l: 0.5 },  // Purple-blue
        { h: 0.0, s: 0.0, l: 0.3 },   // Dark gray
        { h: 0.0, s: 0.0, l: 0.4 },   // Medium gray
    ];

    for (let i = 0; i < buildingCount; i++) {
        // Random position in a circular pattern with some clustering
        const angle = (i / buildingCount) * Math.PI * 2 + Math.random() * 0.5;
        const radius = 10 + Math.random() * cityRadius;
        const x = Math.cos(angle) * radius + (Math.random() - 0.5) * 15;
        const z = Math.sin(angle) * radius + (Math.random() - 0.5) * 15;

        // Random building dimensions with more variation
        const width = 4 + Math.random() * 6;
        const depth = 4 + Math.random() * 6;
        const height = 15 + Math.random() * 60;

        // Create building geometry
        const geometry = new THREE.BoxGeometry(width, height, depth);
        
        // Select random color from palette
        const palette = colorPalettes[Math.floor(Math.random() * colorPalettes.length)];
        const colorVariation = (Math.random() - 0.5) * 0.1;
        
        // Building material with emissive glow - brighter colors
        const material = new THREE.MeshStandardMaterial({
            color: new THREE.Color().setHSL(
                palette.h + colorVariation, 
                palette.s, 
                palette.l + 0.1
            ),
            emissive: new THREE.Color().setHSL(palette.h, 0.5, 0.15),
            emissiveIntensity: 0.3,
            roughness: 0.4,
            metalness: 0.6,
            side: THREE.FrontSide
        });

        const building = new THREE.Mesh(geometry, material);
        building.position.set(x, height / 2, z);
        building.castShadow = true;
        building.receiveShadow = true;
        building.userData = { baseHeight: height }; // Store for reference
        scene.add(building);
        buildings.push(building);

        // Add glowing windows
        addBuildingWindows(building, width, height, depth);

        // Add antenna to tall buildings
        if (height > 40) {
            addAntenna(building, height);
        }
    }
    
    // Add some central buildings for visual interest
    addCentralBuildings();
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
 * Add prominent central buildings
 */
function addCentralBuildings() {
    // Main central tower
    const centralHeight = 80;
    const centralGeometry = new THREE.BoxGeometry(8, centralHeight, 8);
    const centralMaterial = new THREE.MeshStandardMaterial({
        color: 0x4a90d9,
        emissive: 0x1a5a99,
        emissiveIntensity: 0.4,
        roughness: 0.3,
        metalness: 0.7
    });
    const centralTower = new THREE.Mesh(centralGeometry, centralMaterial);
    centralTower.position.set(0, centralHeight / 2, 0);
    centralTower.castShadow = true;
    centralTower.receiveShadow = true;
    centralTower.userData = { baseHeight: centralHeight };
    scene.add(centralTower);
    buildings.push(centralTower);
    addBuildingWindows(centralTower, 8, centralHeight, 8);
    addAntenna(centralTower, centralHeight);
    
    // Surrounding smaller towers
    const surroundingPositions = [
        { x: 12, z: 0 }, { x: -12, z: 0 }, 
        { x: 0, z: 12 }, { x: 0, z: -12 },
        { x: 8, z: 8 }, { x: -8, z: 8 },
        { x: 8, z: -8 }, { x: -8, z: -8 }
    ];
    
    surroundingPositions.forEach((pos, index) => {
        const height = 40 + Math.random() * 25;
        const width = 5 + Math.random() * 3;
        const geometry = new THREE.BoxGeometry(width, height, width);
        const hue = 0.55 + (index * 0.02);
        const material = new THREE.MeshStandardMaterial({
            color: new THREE.Color().setHSL(hue, 0.5, 0.45),
            emissive: new THREE.Color().setHSL(hue, 0.4, 0.15),
            emissiveIntensity: 0.3,
            roughness: 0.4,
            metalness: 0.6
        });
        const building = new THREE.Mesh(geometry, material);
        building.position.set(pos.x, height / 2, pos.z);
        building.castShadow = true;
        building.receiveShadow = true;
        building.userData = { baseHeight: height };
        scene.add(building);
        buildings.push(building);
        addBuildingWindows(building, width, height, width);
        if (height > 50) {
            addAntenna(building, height);
        }
    });
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
    if (!lights.sun || !lights.ambient || !scene) return;
    
    currentTime = time;

    // Calculate sun position based on time (0-24 hours)
    const sunAngle = (time / 24) * Math.PI * 2 - Math.PI / 2;
    const sunX = Math.cos(sunAngle) * 100;
    const sunY = Math.sin(sunAngle) * 100;
    lights.sun.position.set(sunX, Math.abs(sunY) + 20, 50);

    // Determine if it's day or night
    const isDay = time >= 6 && time <= 18;
    const transitionFactor = isDay 
        ? Math.min(1, (time - 6) / 2) * Math.min(1, (18 - time) / 2)
        : 0;

    // Update sun/moon light
    if (isDay) {
        // Daytime - warm sunlight
        lights.sun.color.setHSL(0.1, 0.9, 0.95);
        lights.sun.intensity = 1.0 + transitionFactor * 0.5;
        lights.ambient.intensity = 0.4 + transitionFactor * 0.2;
    } else {
        // Nighttime - cool moonlight
        lights.sun.color.setHSL(0.6, 0.5, 0.8);
        lights.sun.intensity = 0.3;
        lights.ambient.intensity = 0.2;
    }

    // Update ambient light
    lights.ambient.color.setHSL(
        isDay ? 0.6 : 0.65,
        isDay ? 0.3 : 0.8,
        isDay ? 1.0 : 0.4
    );

    // Update sky color
    const skyHue = isDay ? 0.55 : 0.65;
    const skyLightness = isDay ? 0.5 + transitionFactor * 0.3 : 0.08;
    scene.background = new THREE.Color().setHSL(skyHue, 0.8, skyLightness);
    
    // Update fog color to match sky
    if (scene.fog) {
        scene.fog.color.setHSL(skyHue, 0.6, skyLightness);
    }

    // Update building lights intensity
    const buildingLightIntensity = isDay ? 0.1 : 1.0;
    lights.buildingLights.forEach(light => {
        light.intensity = buildingLightIntensity * 0.3;
    });

    // Update building emissive intensity
    buildings.forEach(building => {
        if (building.material) {
            building.material.emissiveIntensity = isDay ? 0.2 : 0.8;
        }
    });

    // Update time display
    if (timeDisplay) {
        const hours = Math.floor(time);
        const minutes = Math.floor((time - hours) * 60);
        timeDisplay.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }
}

/**
 * Update fog density
 */
function updateFog(density) {
    if (!scene || !scene.fog) return;
    const near = 50;
    const far = 200 + (100 - density) * 5;
    scene.fog.near = near;
    scene.fog.far = far;
    if (fogDisplay) {
        fogDisplay.textContent = `${density}%`;
    }
}

/**
 * Update animation speed
 */
function updateSpeed(speed) {
    animationSpeed = speed / 100;
    if (speedDisplay) {
        speedDisplay.textContent = `${speed}%`;
    }
}

/**
 * Reset camera to default position
 */
function resetCamera() {
    if (!camera || !controls) return;
    camera.position.set(80, 60, 80);
    camera.lookAt(0, 20, 0);
    controls.target.set(0, 20, 0);
    controls.update();
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Time slider
    if (timeSlider) {
        timeSlider.addEventListener('input', (e) => {
            updateDayNightCycle(parseFloat(e.target.value));
        });
    }

    // Fog slider
    if (fogSlider) {
        fogSlider.addEventListener('input', (e) => {
            updateFog(parseInt(e.target.value));
        });
    }

    // Speed slider
    if (speedSlider) {
        speedSlider.addEventListener('input', (e) => {
            updateSpeed(parseInt(e.target.value));
        });
    }

    // Reset button
    if (resetBtn) {
        resetBtn.addEventListener('click', resetCamera);
    }

    // Handle window resize
    window.addEventListener('resize', onWindowResize);
}

/**
 * Handle window resize
 */
function onWindowResize() {
    if (!isInitialized || !container || !camera || !renderer) return;
    
    const width = container.clientWidth || window.innerWidth * 0.9;
    const height = container.clientHeight || 500;
    
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
}

/**
 * Animation loop
 */
function animate() {
    if (!isInitialized) return;
    
    requestAnimationFrame(animate);

    // Update controls
    if (controls) {
        controls.update();
    }

    // Animate building materials
    const time = Date.now() * 0.0001 * animationSpeed;
    buildings.forEach((building, index) => {
        // Subtle pulsing effect on emissive
        if (building.material && building.material.emissive) {
            const pulse = Math.sin(time + index * 0.5) * 0.1 + 0.9;
            const baseIntensity = currentTime >= 6 && currentTime <= 18 ? 0.2 : 0.8;
            building.material.emissiveIntensity = baseIntensity * pulse;
        }
    });

    // Render scene
    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}

// Initialize the simulation when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    // Use a small delay to ensure DOM is fully ready
    setTimeout(init, 100);
}
