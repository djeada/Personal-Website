import * as THREE from 'three';
import {
    OrbitControls
} from 'three/addons/controls/OrbitControls.js';


const PERSON_PAUSE_PROBABILITY = 0.001;
const CAR_COUNT = 30;
const CAR_SPAWN_RADIUS = 100;
const PEOPLE_COUNT = 40;
const HIGHWAY_OFFSETS = [-75, -50, -25, 25, 50, 75];


let scene, camera, renderer, controls;
let buildings = [];
let highways = [];
let cars = [];
let people = [];
let lights = {
    sun: null,
    ambient: null,
    buildingLights: []
};
let animationSpeed = 1.0;
let currentTime = 12.0;
let isInitialized = false;


let container, timeSlider, timeDisplay, fogSlider, fogDisplay, speedSlider, speedDisplay, resetBtn;
let btnSunrise, btnMidday, btnSunset, btnNight, autoRotateCheck, screenshotBtn;
let statTime, statFog, statSpeed, statBuildings;


function initDOMElements() {
    container = document.getElementById('canvas-container');
    timeSlider = document.getElementById('time-slider');
    timeDisplay = document.getElementById('time-display');
    fogSlider = document.getElementById('fog-slider');
    fogDisplay = document.getElementById('fog-display');
    speedSlider = document.getElementById('speed-slider');
    speedDisplay = document.getElementById('speed-display');
    resetBtn = document.getElementById('reset-btn');
    
    btnSunrise = document.getElementById('btnSunrise');
    btnMidday = document.getElementById('btnMidday');
    btnSunset = document.getElementById('btnSunset');
    btnNight = document.getElementById('btnNight');
    autoRotateCheck = document.getElementById('autoRotate');
    screenshotBtn = document.getElementById('screenshot-btn');
    
    statTime = document.getElementById('stat-time');
    statFog = document.getElementById('stat-fog');
    statSpeed = document.getElementById('stat-speed');
    statBuildings = document.getElementById('stat-buildings');

    if (!container) {
        console.error('Futuristic City: canvas-container element not found');
        return false;
    }
    return true;
}


function init() {
    try {

        if (!initDOMElements()) {
            return;
        }


        let containerWidth = container.clientWidth;
        let containerHeight = container.clientHeight;


        if (containerWidth === 0) {
            containerWidth = container.offsetWidth || window.innerWidth * 0.9;
        }
        if (containerHeight === 0) {
            containerHeight = container.offsetHeight || 500;
        }


        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x87ceeb);
        scene.fog = new THREE.Fog(0x87ceeb, 50, 500);


        camera = new THREE.PerspectiveCamera(
            60,
            containerWidth / containerHeight,
            0.1,
            1000
        );
        camera.position.set(80, 60, 80);
        camera.lookAt(0, 0, 0);


        try {
            renderer = new THREE.WebGLRenderer({
                antialias: true,
                alpha: false,
                powerPreference: 'default'
            });
        } catch (webglError) {
            console.warn('WebGL with antialiasing not available, trying without');
            try {
                renderer = new THREE.WebGLRenderer({
                    antialias: false
                });
            } catch (fallbackError) {
                console.error('Futuristic City: WebGL is not available on this device');
                container.innerHTML = '<p style="color: white; text-align: center; padding: 20px;">WebGL is not available. Please use a browser that supports WebGL.</p>';
                return;
            }
        }

        renderer.setSize(containerWidth, containerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.setClearColor(0x87ceeb, 1);
        container.appendChild(renderer.domElement);


        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.minDistance = 30;
        controls.maxDistance = 200;
        controls.maxPolarAngle = Math.PI / 2.1;
        controls.target.set(0, 20, 0);


        createLights();


        createGround();
        createBuildings();
        createHighways();
        createCars();
        createPeople();
        createParticles();


        setupEventListeners();


        updateDayNightCycle(12);
        updateFog(20);
        updateSpeed(100);
        updateStats();

        isInitialized = true;


        animate();

        console.log('Futuristic City: Initialized successfully with', buildings.length, 'buildings');
    } catch (error) {
        console.error('Futuristic City: Initialization failed', error);
    }
}


function createLights() {

    lights.ambient = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(lights.ambient);


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


    const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x444444, 0.6);
    hemiLight.position.set(0, 100, 0);
    scene.add(hemiLight);
}


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


    const gridHelper = new THREE.GridHelper(300, 60, 0x444444, 0x222222);
    gridHelper.position.y = 0.1;
    scene.add(gridHelper);
}


function createBuildings() {
    const buildingCount = 50;
    const cityRadius = 60;


    const colorPalettes = [{
            h: 0.55,
            s: 0.6,
            l: 0.4
        },
        {
            h: 0.6,
            s: 0.5,
            l: 0.45
        },
        {
            h: 0.58,
            s: 0.7,
            l: 0.35
        },
        {
            h: 0.52,
            s: 0.6,
            l: 0.4
        },
        {
            h: 0.65,
            s: 0.4,
            l: 0.5
        },
        {
            h: 0.0,
            s: 0.0,
            l: 0.3
        },
        {
            h: 0.0,
            s: 0.0,
            l: 0.4
        },
    ];

    for (let i = 0; i < buildingCount; i++) {

        const angle = (i / buildingCount) * Math.PI * 2 + Math.random() * 0.5;
        const radius = 10 + Math.random() * cityRadius;
        const x = Math.cos(angle) * radius + (Math.random() - 0.5) * 15;
        const z = Math.sin(angle) * radius + (Math.random() - 0.5) * 15;


        const width = 4 + Math.random() * 6;
        const depth = 4 + Math.random() * 6;
        const height = 15 + Math.random() * 60;


        const geometry = new THREE.BoxGeometry(width, height, depth);


        const palette = colorPalettes[Math.floor(Math.random() * colorPalettes.length)];
        const colorVariation = (Math.random() - 0.5) * 0.1;


        const material = new THREE.MeshStandardMaterial({
            color: new THREE.Color().setHSL(
                palette.h + colorVariation,
                palette.s,
                palette.l + 0.1
            ),
            emissive: new THREE.Color().setHSL(palette.h, 0.5, 0.15),
            emissiveIntensity: 0.3,
            roughness: 0.4,
            metalness: 0.6
        });

        const building = new THREE.Mesh(geometry, material);
        building.position.set(x, height / 2, z);
        building.castShadow = true;
        building.receiveShadow = true;
        building.userData = {
            baseHeight: height
        };
        scene.add(building);
        buildings.push(building);


        addBuildingWindows(building, width, height, depth);


        if (height > 40) {
            addAntenna(building, height);
        }
    }


    addCentralBuildings();
}


function addBuildingWindows(building, width, height, depth) {
    const floorHeight = 2.6;
    const windowHeight = 1.2;
    const windowWidth = 0.7;
    const windowDepth = 0.08;
    const verticalPadding = 1.0;
    const horizontalPadding = 0.8;
    const inset = 0.05;
    const floors = Math.max(2, Math.floor((height - verticalPadding * 2) / floorHeight));
    const frontCols = Math.max(2, Math.floor((width - horizontalPadding * 2) / (windowWidth + 0.4)));
    const sideCols = Math.max(2, Math.floor((depth - horizontalPadding * 2) / (windowWidth + 0.4)));
    const frontSpacing = windowWidth + 0.4;
    const sideSpacing = windowWidth + 0.4;
    const frontStart = -((frontCols - 1) * frontSpacing) / 2;
    const sideStart = -((sideCols - 1) * sideSpacing) / 2;
    const baseY = -height / 2 + verticalPadding + windowHeight * 0.5;

    const windowMaterial = new THREE.MeshStandardMaterial({
        color: 0xffff99,
        emissive: 0xffff66,
        emissiveIntensity: 1.8
    });

    for (let floor = 0; floor < floors; floor++) {
        const y = baseY + floor * floorHeight;

        for (let col = 0; col < frontCols; col++) {
            if (Math.random() > 0.35) {
                const x = frontStart + col * frontSpacing;
                const frontWindow = new THREE.Mesh(
                    new THREE.BoxGeometry(windowWidth, windowHeight, windowDepth),
                    windowMaterial
                );
                frontWindow.position.set(x, y, depth / 2 + inset);
                building.add(frontWindow);

                const backWindow = frontWindow.clone();
                backWindow.position.set(x, y, -depth / 2 - inset);
                building.add(backWindow);
            }
        }

        for (let col = 0; col < sideCols; col++) {
            if (Math.random() > 0.35) {
                const z = sideStart + col * sideSpacing;
                const sideWindow = new THREE.Mesh(
                    new THREE.BoxGeometry(windowDepth, windowHeight, windowWidth),
                    windowMaterial
                );
                sideWindow.position.set(width / 2 + inset, y, z);
                building.add(sideWindow);

                const otherSideWindow = sideWindow.clone();
                otherSideWindow.position.set(-width / 2 - inset, y, z);
                building.add(otherSideWindow);
            }
        }
    }
}


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


function addCentralBuildings() {

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
    centralTower.userData = {
        baseHeight: centralHeight
    };
    scene.add(centralTower);
    buildings.push(centralTower);
    addBuildingWindows(centralTower, 8, centralHeight, 8);
    addAntenna(centralTower, centralHeight);


    const surroundingPositions = [{
            x: 12,
            z: 0
        }, {
            x: -12,
            z: 0
        },
        {
            x: 0,
            z: 12
        }, {
            x: 0,
            z: -12
        },
        {
            x: 8,
            z: 8
        }, {
            x: -8,
            z: 8
        },
        {
            x: 8,
            z: -8
        }, {
            x: -8,
            z: -8
        }
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
        building.userData = {
            baseHeight: height
        };
        scene.add(building);
        buildings.push(building);
        addBuildingWindows(building, width, height, width);
        if (height > 50) {
            addAntenna(building, height);
        }
    });
}


function createHighways() {
    const highwayMaterial = new THREE.MeshStandardMaterial({
        color: 0x333333,
        roughness: 0.9,
        metalness: 0.1
    });


    for (const offset of HIGHWAY_OFFSETS) {


        const hHighway = new THREE.Mesh(
            new THREE.BoxGeometry(200, 0.2, 4),
            highwayMaterial
        );
        hHighway.position.set(0, 0.1, offset);
        hHighway.receiveShadow = true;
        scene.add(hHighway);
        highways.push(hHighway);


        const vHighway = new THREE.Mesh(
            new THREE.BoxGeometry(4, 0.2, 200),
            highwayMaterial
        );
        vHighway.position.set(offset, 0.1, 0);
        vHighway.receiveShadow = true;
        scene.add(vHighway);
        highways.push(vHighway);


        addLaneMarkers(hHighway, true);
        addLaneMarkers(vHighway, false);
    }
}


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


function createCars() {
    const carCount = CAR_COUNT;
    const cityRadius = CAR_SPAWN_RADIUS;
    const laneOffsets = HIGHWAY_OFFSETS;


    const carColors = [
        0xff0000,
        0x0000ff,
        0x00ff00,
        0xffff00,
        0xff00ff,
        0x00ffff,
        0xffffff,
        0x888888,
        0x000000
    ];

    for (let i = 0; i < carCount; i++) {

        const carWidth = 1.5;
        const carHeight = 1.2;
        const carLength = 3;

        const bodyGeometry = new THREE.BoxGeometry(carWidth, carHeight, carLength);
        const bodyColor = carColors[Math.floor(Math.random() * carColors.length)];
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: bodyColor,
            roughness: 0.3,
            metalness: 0.7
        });
        const carBody = new THREE.Mesh(bodyGeometry, bodyMaterial);


        const cabinGeometry = new THREE.BoxGeometry(carWidth * 0.8, carHeight * 0.6, carLength * 0.5);
        const cabinMaterial = new THREE.MeshStandardMaterial({
            color: 0x333333,
            roughness: 0.1,
            metalness: 0.3,
            transparent: true,
            opacity: 0.7
        });
        const cabin = new THREE.Mesh(cabinGeometry, cabinMaterial);
        cabin.position.y = carHeight * 0.8;
        cabin.position.z = -carLength * 0.1;
        carBody.add(cabin);


        const headlightGeometry = new THREE.SphereGeometry(0.2, 8, 8);
        const headlightMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffaa,
            emissive: 0xffffaa,
            emissiveIntensity: 2.0
        });
        const headlightLeft = new THREE.Mesh(headlightGeometry, headlightMaterial);
        headlightLeft.position.set(-carWidth * 0.3, -carHeight * 0.3, carLength * 0.5);
        carBody.add(headlightLeft);

        const headlightRight = new THREE.Mesh(headlightGeometry, headlightMaterial.clone());
        headlightRight.position.set(carWidth * 0.3, -carHeight * 0.3, carLength * 0.5);
        carBody.add(headlightRight);


        const taillightMaterial = new THREE.MeshStandardMaterial({
            color: 0xff0000,
            emissive: 0xff0000,
            emissiveIntensity: 1.0
        });
        const taillightLeft = new THREE.Mesh(headlightGeometry, taillightMaterial);
        taillightLeft.position.set(-carWidth * 0.3, -carHeight * 0.3, -carLength * 0.5);
        carBody.add(taillightLeft);

        const taillightRight = new THREE.Mesh(headlightGeometry, taillightMaterial.clone());
        taillightRight.position.set(carWidth * 0.3, -carHeight * 0.3, -carLength * 0.5);
        carBody.add(taillightRight);


        const isHorizontal = Math.random() > 0.5;
        const laneOffset = laneOffsets[Math.floor(Math.random() * laneOffsets.length)];
        const direction = Math.random() > 0.5 ? 1 : -1;

        if (isHorizontal) {
            carBody.position.set(
                (Math.random() - 0.5) * cityRadius,
                0.8,
                laneOffset + (Math.random() > 0.5 ? 1.2 : -1.2)
            );
            carBody.rotation.y = direction > 0 ? Math.PI / 2 : -Math.PI / 2;
        } else {
            carBody.position.set(
                laneOffset + (Math.random() > 0.5 ? 1.2 : -1.2),
                0.8,
                (Math.random() - 0.5) * cityRadius
            );
            carBody.rotation.y = direction > 0 ? 0 : Math.PI;
        }

        carBody.castShadow = true;
        carBody.receiveShadow = true;


        carBody.userData = {
            speed: 0.1 + Math.random() * 0.15,
            isHorizontal: isHorizontal,
            laneOffset: laneOffset,
            direction: direction,
            headlights: [headlightLeft, headlightRight],
            taillights: [taillightLeft, taillightRight]
        };

        scene.add(carBody);
        cars.push(carBody);
    }
}


function createPeople() {
    const peopleCount = PEOPLE_COUNT;
    const laneOffsets = HIGHWAY_OFFSETS;
    const sidewalkOffset = 3.5;


    const clothingColors = [
        0xff0000,
        0x0000ff,
        0x00ff00,
        0xffff00,
        0xff00ff,
        0x00ffff,
        0xffffff,
        0x888888,
        0x000000,
        0x8b4513
    ];

    for (let i = 0; i < peopleCount; i++) {

        const personGroup = new THREE.Group();


        const bodyGeometry = new THREE.BoxGeometry(0.8, 1.5, 0.5);
        const clothingColor = clothingColors[Math.floor(Math.random() * clothingColors.length)];
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: clothingColor,
            roughness: 0.8,
            metalness: 0.1
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 1.5;
        body.castShadow = true;
        personGroup.add(body);


        const headGeometry = new THREE.SphereGeometry(0.35, 16, 16);
        const headMaterial = new THREE.MeshStandardMaterial({
            color: 0xffdbac,
            roughness: 0.7,
            metalness: 0.0
        });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.y = 2.6;
        head.castShadow = true;
        personGroup.add(head);


        const legGeometry = new THREE.BoxGeometry(0.3, 1.2, 0.4);
        const legMaterial = new THREE.MeshStandardMaterial({
            color: 0x333333,
            roughness: 0.8,
            metalness: 0.1
        });

        const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
        leftLeg.position.set(-0.25, 0.6, 0);
        leftLeg.castShadow = true;
        personGroup.add(leftLeg);

        const rightLeg = new THREE.Mesh(legGeometry, legMaterial.clone());
        rightLeg.position.set(0.25, 0.6, 0);
        rightLeg.castShadow = true;
        personGroup.add(rightLeg);


        const armGeometry = new THREE.BoxGeometry(0.25, 1.0, 0.25);
        const armMaterial = new THREE.MeshStandardMaterial({
            color: clothingColor,
            roughness: 0.8,
            metalness: 0.1
        });

        const leftArm = new THREE.Mesh(armGeometry, armMaterial);
        leftArm.position.set(-0.6, 1.5, 0);
        leftArm.castShadow = true;
        personGroup.add(leftArm);

        const rightArm = new THREE.Mesh(armGeometry, armMaterial.clone());
        rightArm.position.set(0.6, 1.5, 0);
        rightArm.castShadow = true;
        personGroup.add(rightArm);

        const isHorizontal = Math.random() > 0.5;
        const baseOffset = laneOffsets[Math.floor(Math.random() * laneOffsets.length)];
        const sideOffset = Math.random() > 0.5 ? sidewalkOffset : -sidewalkOffset;
        const direction = Math.random() > 0.5 ? 1 : -1;
        let x = 0;
        let z = 0;

        if (isHorizontal) {
            x = (Math.random() - 0.5) * 140;
            z = baseOffset + sideOffset;
            personGroup.rotation.y = direction > 0 ? Math.PI / 2 : -Math.PI / 2;
        } else {
            x = baseOffset + sideOffset;
            z = (Math.random() - 0.5) * 140;
            personGroup.rotation.y = direction > 0 ? 0 : Math.PI;
        }

        personGroup.position.set(x, 0, z);


        personGroup.userData = {
            walkSpeed: 0.03 + Math.random() * 0.02,
            isHorizontal: isHorizontal,
            direction: direction,
            baseOffset: baseOffset,
            sideOffset: sideOffset,
            animationOffset: Math.random() * Math.PI * 2,
            pauseTime: 80 + Math.random() * 120,
            pauseCounter: 0,
            isPaused: Math.random() > 0.75,
            bodyParts: {
                leftLeg: leftLeg,
                rightLeg: rightLeg,
                leftArm: leftArm,
                rightArm: rightArm
            }
        };

        scene.add(personGroup);
        people.push(personGroup);
    }
}


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


function updateDayNightCycle(time) {
    if (!lights.sun || !lights.ambient || !scene) return;

    currentTime = time;


    const sunAngle = (time / 24) * Math.PI * 2 - Math.PI / 2;
    const sunX = Math.cos(sunAngle) * 100;
    const sunY = Math.sin(sunAngle) * 100;
    lights.sun.position.set(sunX, Math.abs(sunY) + 20, 50);


    const isDay = time >= 6 && time <= 18;
    const transitionFactor = isDay ?
        Math.min(1, (time - 6) / 2) * Math.min(1, (18 - time) / 2) :
        0;


    if (isDay) {

        lights.sun.color.setHSL(0.1, 0.9, 0.95);
        lights.sun.intensity = 1.0 + transitionFactor * 0.5;
        lights.ambient.intensity = 0.4 + transitionFactor * 0.2;
    } else {

        lights.sun.color.setHSL(0.6, 0.5, 0.8);
        lights.sun.intensity = 0.3;
        lights.ambient.intensity = 0.2;
    }


    lights.ambient.color.setHSL(
        isDay ? 0.6 : 0.65,
        isDay ? 0.3 : 0.8,
        isDay ? 1.0 : 0.4
    );


    const skyHue = isDay ? 0.55 : 0.65;
    const skyLightness = isDay ? 0.5 + transitionFactor * 0.3 : 0.08;
    scene.background = new THREE.Color().setHSL(skyHue, 0.8, skyLightness);


    if (scene.fog) {
        scene.fog.color.setHSL(skyHue, 0.6, skyLightness);
    }


    const buildingLightIntensity = isDay ? 0.1 : 1.0;
    lights.buildingLights.forEach(light => {
        light.intensity = buildingLightIntensity * 0.3;
    });


    buildings.forEach(building => {
        if (building.material) {
            building.material.emissiveIntensity = isDay ? 0.2 : 0.8;
        }
    });


    if (timeDisplay) {
        const hours = Math.floor(time);
        const minutes = Math.floor((time - hours) * 60);
        timeDisplay.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }
    updateStats();
}


function updateFog(density) {
    if (!scene || !scene.fog) return;
    const near = 50;
    const far = 200 + (100 - density) * 5;
    scene.fog.near = near;
    scene.fog.far = far;
    if (fogDisplay) {
        fogDisplay.textContent = `${density}%`;
    }
    updateStats();
}


function updateSpeed(speed) {
    animationSpeed = speed / 100;
    if (speedDisplay) {
        speedDisplay.textContent = `${speed}%`;
    }
    updateStats();
}


function updateStats() {
    if (statTime && timeSlider) {
        const time = parseFloat(timeSlider.value);
        const hours = Math.floor(time);
        const minutes = Math.floor((time - hours) * 60);
        statTime.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }
    if (statFog && fogSlider) {
        statFog.textContent = `${fogSlider.value}%`;
    }
    if (statSpeed && speedSlider) {
        statSpeed.textContent = `${speedSlider.value}%`;
    }
    if (statBuildings) {
        statBuildings.textContent = buildings.length.toString();
    }
}


function updatePresetButtons(activeBtn) {
    [btnSunrise, btnMidday, btnSunset, btnNight].forEach(btn => {
        if (btn) btn.classList.remove('active');
    });
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
}


function applyPreset(time, fog, speed, activeBtn) {
    if (timeSlider) timeSlider.value = time;
    if (fogSlider) fogSlider.value = fog;
    if (speedSlider) speedSlider.value = speed;
    updateDayNightCycle(time);
    updateFog(fog);
    updateSpeed(speed);
    updatePresetButtons(activeBtn);
}


function takeScreenshot() {
    if (!renderer) return;
    try {
        const link = document.createElement('a');
        link.download = `futuristic-city-${Date.now()}.png`;
        link.href = renderer.domElement.toDataURL('image/png');
        link.click();
    } catch (error) {
        console.error('Screenshot failed:', error);
    }
}


function resetCamera() {
    if (!camera || !controls) return;
    camera.position.set(80, 60, 80);
    camera.lookAt(0, 20, 0);
    controls.target.set(0, 20, 0);
    controls.update();
}


function setupEventListeners() {

    if (timeSlider) {
        timeSlider.addEventListener('input', (e) => {
            updateDayNightCycle(parseFloat(e.target.value));
            updatePresetButtons(null);
        });
    }


    if (fogSlider) {
        fogSlider.addEventListener('input', (e) => {
            updateFog(parseInt(e.target.value));
            updatePresetButtons(null);
        });
    }


    if (speedSlider) {
        speedSlider.addEventListener('input', (e) => {
            updateSpeed(parseInt(e.target.value));
            updatePresetButtons(null);
        });
    }


    if (resetBtn) {
        resetBtn.addEventListener('click', resetCamera);
    }


    if (btnSunrise) {
        btnSunrise.addEventListener('click', () => {
            applyPreset(6, 40, 80, btnSunrise);
        });
    }

    if (btnMidday) {
        btnMidday.addEventListener('click', () => {
            applyPreset(12, 20, 100, btnMidday);
        });
    }

    if (btnSunset) {
        btnSunset.addEventListener('click', () => {
            applyPreset(18, 35, 90, btnSunset);
        });
    }

    if (btnNight) {
        btnNight.addEventListener('click', () => {
            applyPreset(22, 50, 70, btnNight);
        });
    }


    if (autoRotateCheck) {
        autoRotateCheck.addEventListener('change', (e) => {
            if (controls) {
                controls.autoRotate = e.target.checked;
                controls.autoRotateSpeed = 0.5;
            }
        });
    }


    if (screenshotBtn) {
        screenshotBtn.addEventListener('click', takeScreenshot);
    }


    window.addEventListener('resize', onWindowResize);
}


function onWindowResize() {
    if (!isInitialized || !container || !camera || !renderer) return;

    const width = container.clientWidth || window.innerWidth * 0.9;
    const height = container.clientHeight || 500;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
}


function animate() {
    if (!isInitialized) return;

    requestAnimationFrame(animate);


    if (controls) {
        controls.update();
    }


    const time = Date.now() * 0.0001 * animationSpeed;
    buildings.forEach((building, index) => {

        if (building.material && building.material.emissive) {
            const pulse = Math.sin(time + index * 0.5) * 0.1 + 0.9;
            const baseIntensity = currentTime >= 6 && currentTime <= 18 ? 0.2 : 0.8;
            building.material.emissiveIntensity = baseIntensity * pulse;
        }
    });


    cars.forEach((car) => {
        const data = car.userData;
        const speed = data.speed * animationSpeed;

        if (data.isHorizontal) {

            car.position.x += speed * data.direction;
            if (car.position.x > 100) car.position.x = -100;
            if (car.position.x < -100) car.position.x = 100;
        } else {

            car.position.z += speed * data.direction;
            if (car.position.z > 100) car.position.z = -100;
            if (car.position.z < -100) car.position.z = 100;
        }


        const isNight = currentTime < 6 || currentTime > 18;
        if (car.userData.headlights) {
            car.userData.headlights.forEach(light => {
                if (light.material) {
                    light.material.emissiveIntensity = isNight ? 2.0 : 0.5;
                }
            });
        }
        if (car.userData.taillights) {
            car.userData.taillights.forEach(light => {
                if (light.material) {
                    light.material.emissiveIntensity = isNight ? 1.0 : 0.3;
                }
            });
        }
    });


    people.forEach((person, index) => {
        const data = person.userData;

        if (!data.isPaused) {

            const walkTime = time * 10 + data.animationOffset;

            if (data.isHorizontal) {
                person.position.x += data.walkSpeed * data.direction * animationSpeed;
                if (person.position.x > 80) data.direction = -1;
                if (person.position.x < -80) data.direction = 1;
            } else {
                person.position.z += data.walkSpeed * data.direction * animationSpeed;
                if (person.position.z > 80) data.direction = -1;
                if (person.position.z < -80) data.direction = 1;
            }

            if (data.isHorizontal) {
                person.rotation.y = data.direction > 0 ? Math.PI / 2 : -Math.PI / 2;
            } else {
                person.rotation.y = data.direction > 0 ? 0 : Math.PI;
            }


            if (data.bodyParts) {
                const {
                    leftLeg,
                    rightLeg,
                    leftArm,
                    rightArm
                } = data.bodyParts;
                if (leftLeg && rightLeg) {
                    leftLeg.rotation.x = Math.sin(walkTime) * 0.25;
                    rightLeg.rotation.x = Math.sin(walkTime + Math.PI) * 0.25;
                }


                if (leftArm && rightArm) {
                    leftArm.rotation.x = Math.sin(walkTime + Math.PI) * 0.15;
                    rightArm.rotation.x = Math.sin(walkTime) * 0.15;
                }
            }


            if (Math.random() < PERSON_PAUSE_PROBABILITY) {
                data.isPaused = true;
                data.pauseCounter = data.pauseTime;
            }
        } else {

            data.pauseCounter--;
            if (data.pauseCounter <= 0) {
                data.isPaused = false;

                if (Math.random() > 0.5) {
                    data.walkDirection = Math.random() * Math.PI * 2;
                    person.rotation.y = data.walkDirection;
                }
            }
        }
    });


    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}


if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {

    requestAnimationFrame(() => {
        requestAnimationFrame(init);
    });
}