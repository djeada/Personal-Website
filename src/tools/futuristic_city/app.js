import * as THREE from 'three';
import {
    OrbitControls
} from 'three/addons/controls/OrbitControls.js';

const CONFIG = {
    buildings: 144,
    vehicles: 54,
    particles: 420,
    extent: 92
};
const palette = {
    void: new THREE.Color(0x05070d),
    dusk: new THREE.Color(0x17152a),
    dawn: new THREE.Color(0x806a78),
    day: new THREE.Color(0x526b79),
    cyan: new THREE.Color(0x65f2df),
    violet: new THREE.Color(0x9b7cff),
    gold: new THREE.Color(0xffc875),
    stone: new THREE.Color(0x141a25)
};

let scene, camera, renderer, controls, clock, sun, ambient, city, windowMaterial, facadeMaterial, groundMaterial;
let currentTime = 20.5,
    animationSpeed = 1,
    fogAmount = 28,
    running = true,
    nextPatrolTime = 2;
const animated = {
    traffic: [],
    drones: [],
    patrols: [],
    lasers: [],
    wisps: [],
    rings: [],
    beacon: []
};
const $ = (id) => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);

function material(color, emissive = 0x000000, intensity = 0) {
    return new THREE.MeshStandardMaterial({
        color,
        emissive,
        emissiveIntensity: intensity,
        roughness: .48,
        metalness: .62
    });
}

function init() {
    const host = $('canvas-container');
    if (!host) return;
    const width = host.clientWidth || 900,
        height = host.clientHeight || 650;
    scene = new THREE.Scene();
    scene.background = palette.void;
    scene.fog = new THREE.FogExp2(palette.void, .0045);
    camera = new THREE.PerspectiveCamera(48, width / height, .5, 420);
    camera.position.set(118, 78, 118);

    renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: true
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.28;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.querySelectorAll('canvas').forEach(canvas => canvas.remove());
    host.append(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = .045;
    controls.minDistance = 45;
    controls.maxDistance = 230;
    controls.maxPolarAngle = 1.47;
    controls.target.set(0, 25, 0);
    clock = new THREE.Clock();
    city = new THREE.Group();
    scene.add(city);
    createWorld();
    bindUI();
    updateEnvironment(currentTime);
    updateFog(fogAmount);
    new ResizeObserver(resize).observe(host);
    document.addEventListener('visibilitychange', () => running = !document.hidden);
    animate();
}

function createWorld() {
    ambient = new THREE.HemisphereLight(0x8092c7, 0x080811, .72);
    scene.add(ambient);
    sun = new THREE.DirectionalLight(0xffd8ad, 1.6);
    sun.position.set(-80, 110, 45);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, {
        left: -105,
        right: 105,
        top: 105,
        bottom: -105,
        near: 10,
        far: 270
    });
    scene.add(sun);
    const cityGlow = new THREE.PointLight(0x55d9d0, 48, 155, 1.55);
    cityGlow.position.set(0, 38, 0);
    scene.add(cityGlow);
    const violetFill = new THREE.DirectionalLight(0x7867c8, 1.15);
    violetFill.position.set(85, 55, -90);
    scene.add(violetFill);
    groundMaterial = material(0x101923, 0x071820, .34);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(138, 64), groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    city.add(ground);
    createRoads();
    createBuildings();
    createSanctum();
    createTraffic();
    createSkyways();
    createAtmosphere();
}

function createRoads() {
    const roadMat = new THREE.MeshStandardMaterial({
        color: 0x090d14,
        roughness: .82,
        metalness: .25
    });
    const glowMat = new THREE.MeshBasicMaterial({
        color: palette.cyan,
        transparent: true,
        opacity: .38
    });
    [-60, -36, -12, 12, 36, 60].forEach(offset => {
        [
            [0, .12, offset, 188, .16, 6],
            [offset, .12, 0, 6, .16, 188]
        ].forEach(v => {
            const road = new THREE.Mesh(new THREE.BoxGeometry(v[3], v[4], v[5]), roadMat);
            road.position.set(v[0], v[1], v[2]);
            city.add(road);
        });
        const h = new THREE.Mesh(new THREE.BoxGeometry(188, .03, .09), glowMat);
        h.position.set(0, .23, offset);
        city.add(h);
        const v = new THREE.Mesh(new THREE.BoxGeometry(.09, .03, 188), glowMat);
        v.position.set(offset, .23, 0);
        city.add(v);
    });
    [28, 52, 76].forEach(radius => {
        const ring = new THREE.Mesh(new THREE.RingGeometry(radius - .12, radius + .12, 128), glowMat.clone());
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = .24;
        city.add(ring);
    });
}

function createBuildings() {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    facadeMaterial = material(0x273449, 0x13233e, .8);
    const towers = new THREE.InstancedMesh(geo, facadeMaterial, CONFIG.buildings);
    towers.castShadow = towers.receiveShadow = true;
    windowMaterial = new THREE.MeshBasicMaterial({
        color: palette.gold,
        transparent: true,
        opacity: .82
    });
    const windowsPerBuilding = 16;
    const windows = new THREE.InstancedMesh(geo, windowMaterial, CONFIG.buildings * windowsPerBuilding);
    const dummy = new THREE.Object3D();
    let wi = 0;
    for (let i = 0; i < CONFIG.buildings; i++) {
        const gx = (i % 12) - 5.5,
            gz = Math.floor(i / 12) - 5.5;
        let x = gx * 13.8 + rand(-2, 2),
            z = gz * 13.8 + rand(-2, 2);
        if (Math.abs(x) < 17 && Math.abs(z) < 17) {
            x += x < 0 ? -17 : 17;
            z += z < 0 ? -10 : 10;
        }
        const radial = Math.hypot(x, z),
            h = rand(10, 33) + Math.max(0, 43 - radial * .38);
        const w = rand(5, 9),
            d = rand(5, 9);
        dummy.position.set(x, h / 2, z);
        dummy.scale.set(w, h, d);
        dummy.rotation.y = Math.round(rand(0, 4)) * Math.PI / 2;
        dummy.updateMatrix();
        towers.setMatrixAt(i, dummy.matrix);
        const c = new THREE.Color().setHSL(rand(.55, .69), rand(.16, .36), rand(.09, .18));
        towers.setColorAt(i, c);


        for (let row = 0; row < 4; row++)
            for (let col = 0; col < 2; col++) {
                const y = h * (.2 + row * .18);
                const lit = Math.random() > .18 ? 1 : .18;
                dummy.rotation.y = 0;
                dummy.position.set(x + (col - .5) * w * .38, y, z + d / 2 + .035);
                dummy.scale.set(w * .25 * lit, Math.max(.32, h * .035), .05);
                dummy.updateMatrix();
                windows.setMatrixAt(wi++, dummy.matrix);
                dummy.position.set(x + w / 2 + .035, y, z + (col - .5) * d * .38);
                dummy.scale.set(.05, Math.max(.32, h * .035), d * .25 * lit);
                dummy.updateMatrix();
                windows.setMatrixAt(wi++, dummy.matrix);
            }
    }
    city.add(towers, windows);
    $('stat-buildings').textContent = CONFIG.buildings;
}

function createSanctum() {
    const group = new THREE.Group();
    const dark = material(0x111827, 0x241b42, .65);
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(5, 9, 76, 6), dark);
    tower.position.y = 38;
    tower.castShadow = true;
    group.add(tower);
    const crown = new THREE.Mesh(new THREE.ConeGeometry(8, 21, 6, 1, true), dark);
    crown.position.y = 82;
    group.add(crown);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(.18, .65, 38, 8), new THREE.MeshBasicMaterial({
        color: palette.violet,
        transparent: true,
        opacity: .55,
        blending: THREE.AdditiveBlending
    }));
    beam.position.y = 104;
    group.add(beam);
    [16, 27, 39].forEach((y, i) => {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(7 + i * .5, .12, 5, 48), new THREE.MeshBasicMaterial({
            color: i === 1 ? palette.gold : palette.violet,
            transparent: true,
            opacity: .72
        }));
        ring.rotation.x = Math.PI / 2;
        ring.position.y = y;
        group.add(ring);
        animated.rings.push(ring);
    });
    for (let i = 0; i < 8; i++) {
        const spire = new THREE.Mesh(new THREE.ConeGeometry(1.4, rand(9, 16), 4), dark);
        const a = i / 8 * Math.PI * 2;
        spire.position.set(Math.cos(a) * 12, rand(8, 12), Math.sin(a) * 12);
        spire.rotation.z = Math.cos(a) * .12;
        group.add(spire);
    }
    city.add(group);
}

function createTraffic() {
    const geo = new THREE.BoxGeometry(1.25, .5, 2.4),
        mat = new THREE.MeshBasicMaterial({
            color: palette.cyan
        });
    for (let i = 0; i < CONFIG.vehicles; i++) {
        const mesh = new THREE.Mesh(geo, mat);
        const horizontal = i % 2 === 0,
            lane = [-60, -36, -12, 12, 36, 60][i % 6];
        mesh.position.set(horizontal ? rand(-94, 94) : lane + (i % 3 - 1) * 1.4, .65, horizontal ? lane + (i % 3 - 1) * 1.4 : rand(-94, 94));
        if (horizontal) mesh.rotation.y = Math.PI / 2;
        mesh.userData = {
            horizontal,
            dir: i % 4 < 2 ? 1 : -1,
            speed: rand(7, 14)
        };
        city.add(mesh);
        animated.traffic.push(mesh);
    }
}

function createSkyways() {
    const railMaterial = new THREE.MeshBasicMaterial({
        color: palette.cyan,
        transparent: true,
        opacity: .46,
        blending: THREE.AdditiveBlending
    });
    const supportMaterial = material(0x17212c, 0x12342f, .32);
    [39, 68].forEach((radius, level) => {
        const height = 10 + level * 8;
        const rail = new THREE.Mesh(new THREE.TorusGeometry(radius, .24, 6, 128), railMaterial.clone());
        rail.rotation.x = Math.PI / 2;
        rail.position.y = height;
        city.add(rail);
        for (let i = 0; i < 12; i++) {
            const a = i / 12 * Math.PI * 2;
            const support = new THREE.Mesh(new THREE.CylinderGeometry(.22, .5, height, 5), supportMaterial);
            support.position.set(Math.cos(a) * radius, height / 2, Math.sin(a) * radius);
            city.add(support);
        }
        const count = 7 + level * 3;
        for (let i = 0; i < count; i++) {
            const drone = new THREE.Group();
            const body = new THREE.Mesh(new THREE.CapsuleGeometry(.45, 1.8, 3, 7), new THREE.MeshStandardMaterial({
                color: level ? 0x6d75a2 : 0x638b87,
                metalness: .9,
                roughness: .22
            }));
            body.rotation.z = Math.PI / 2;
            const lamp = new THREE.Mesh(new THREE.SphereGeometry(.22, 6, 6), new THREE.MeshBasicMaterial({
                color: i % 3 ? palette.cyan : palette.gold
            }));
            lamp.position.x = 1.05;
            drone.add(body, lamp);
            drone.userData = {
                radius,
                angle: i / count * Math.PI * 2,
                speed: (.09 + Math.random() * .045) * (i % 2 ? 1 : -1),
                height: height + 1.15
            };
            city.add(drone);
            animated.drones.push(drone);
        }
    });
    const holoMaterial = new THREE.MeshBasicMaterial({
        color: palette.violet,
        transparent: true,
        opacity: .28,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
    });
    [
        [-48, 34, -48],
        [52, 42, -20],
        [-18, 30, 59]
    ].forEach(([x, y, z], i) => {
        const marker = new THREE.Mesh(new THREE.RingGeometry(3.2, 3.5, 6), holoMaterial.clone());
        marker.position.set(x, y, z);
        marker.rotation.y = i * .7;
        marker.userData.floatBase = y;
        city.add(marker);
        animated.beacon.push(marker);
    });
}

function createPatrolCraft() {
    const craft = new THREE.Group();
    const hullMaterial = new THREE.MeshStandardMaterial({
        color: 0x687b91,
        emissive: 0x122740,
        emissiveIntensity: .7,
        metalness: .9,
        roughness: .2,
        flatShading: true
    });
    const hull = new THREE.Mesh(new THREE.ConeGeometry(.72, 5.8, 5), hullMaterial);
    hull.rotation.z = -Math.PI / 2;
    const wingShape = new THREE.Shape();
    wingShape.moveTo(-1.6, 0);
    wingShape.lineTo(.7, 0);
    wingShape.lineTo(-.9, 4);
    wingShape.lineTo(-2.1, 3.2);
    wingShape.closePath();
    const wings = new THREE.Mesh(new THREE.ShapeGeometry(wingShape), hullMaterial);
    wings.rotation.x = -Math.PI / 2;
    wings.position.set(-.4, 0, -2);
    const engineMaterial = new THREE.MeshBasicMaterial({
        color: 0x6fffea,
        transparent: true,
        opacity: .85,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const engine = new THREE.Mesh(new THREE.ConeGeometry(.34, 5.5, 8, 1, true), engineMaterial);
    engine.rotation.z = Math.PI / 2;
    engine.position.x = -4;
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(.17, 6, 6), new THREE.MeshBasicMaterial({
        color: 0xffb55f
    }));
    beacon.position.set(.2, .45, 0);
    craft.add(hull, wings, engine, beacon);
    craft.scale.setScalar(1.22);
    return craft;
}

function launchPatrol(t) {
    const closePass = Math.random() < .38;
    let direction, start;
    if (closePass) {
        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
        direction = right.multiplyScalar(Math.random() < .5 ? 1 : -1).add(forward.multiplyScalar(.18)).normalize();
        start = camera.position.clone().addScaledVector(direction, -78).addScaledVector(camera.up, rand(7, 22));
    } else {
        const heading = rand(0, Math.PI * 2);
        direction = new THREE.Vector3(Math.cos(heading), rand(-.035, .035), Math.sin(heading)).normalize();
        start = direction.clone().multiplyScalar(-165);
        start.y = rand(58, 92);
    }
    const heading = Math.atan2(direction.z, direction.x),
        count = Math.random() < .62 ? 2 : 1;
    const side = new THREE.Vector3(-direction.z, 0, direction.x);
    for (let i = 0; i < count; i++) {
        const craft = createPatrolCraft();
        const offset = count === 1 ? 0 : (i ? 1 : -1) * 5;
        craft.position.copy(start).add(side.clone().multiplyScalar(offset));
        craft.position.y += (i % 2) * 3;
        craft.rotation.y = -heading;
        craft.rotation.z = rand(-.08, .08);
        craft.userData = {
            velocity: direction.clone().multiplyScalar(closePass ? rand(38, 48) : rand(52, 66)),
            born: t,
            life: closePass ? rand(3.8, 5) : rand(5.2, 6.5),
            phase: Math.random() * Math.PI * 2,
            rollSpeed: Math.random() < .58 ? rand(2.6, 4.8) * (Math.random() < .5 ? 1 : -1) : 0,
            shotAt: t + rand(.9, 2.6),
            fired: false,
            willFire: Math.random() < .78
        };
        scene.add(craft);
        animated.patrols.push(craft);
    }
    nextPatrolTime = t + rand(5, 10);
}

function firePatrolLaser(craft, t) {
    const target = new THREE.Vector3(rand(-74, 74), .8, rand(-74, 74));
    const origin = craft.position.clone();
    const direction = target.clone().sub(origin),
        length = direction.length();
    const beamMaterial = new THREE.MeshBasicMaterial({
        color: 0xff315f,
        transparent: true,
        opacity: .95,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(.16, .32, length, 8), beamMaterial);
    beam.position.copy(origin).add(target).multiplyScalar(.5);
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    const impactMaterial = new THREE.MeshBasicMaterial({
        color: 0xffb06b,
        transparent: true,
        opacity: 1,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const impact = new THREE.Mesh(new THREE.SphereGeometry(1.8, 10, 10), impactMaterial);
    impact.position.copy(target);
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.5, 2.1, 28), impactMaterial.clone());
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(target);
    ring.position.y = 1.05;
    const flash = new THREE.PointLight(0xff365f, 85, 46, 2);
    flash.position.copy(target).setY(5);
    scene.add(beam, impact, ring, flash);
    animated.lasers.push({
        beam,
        impact,
        ring,
        flash,
        born: t,
        life: .82
    });
}

function createAtmosphere() {
    const positions = new Float32Array(CONFIG.particles * 3);
    for (let i = 0; i < CONFIG.particles; i++) {
        positions[i * 3] = rand(-125, 125);
        positions[i * 3 + 1] = rand(3, 105);
        positions[i * 3 + 2] = rand(-125, 125);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const dust = new THREE.Points(geo, new THREE.PointsMaterial({
        color: 0x94eadf,
        size: .28,
        transparent: true,
        opacity: .42,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    }));
    city.add(dust);
    animated.wisps.push(dust);
    const moon = new THREE.Mesh(new THREE.SphereGeometry(7, 24, 24), new THREE.MeshBasicMaterial({
        color: 0xd5d4ff
    }));
    moon.position.set(-88, 92, -110);
    scene.add(moon);
}

function updateEnvironment(value) {
    currentTime = Number(value);
    const daylight = Math.max(0, Math.sin((currentTime - 6) / 24 * Math.PI * 2));
    const twilight = Math.max(0, 1 - Math.abs(currentTime - 6) / 3, 1 - Math.abs(currentTime - 18) / 3);
    const sky = palette.void.clone().lerp(palette.dusk, twilight).lerp(palette.day, daylight * .72);
    scene.background.copy(sky);
    scene.fog.color.copy(sky);
    ambient.intensity = .62 + daylight * .9;
    sun.intensity = .42 + daylight * 1.8;
    sun.color.set(daylight < .25 ? 0xb99cff : 0xffdfbd);
    windowMaterial.opacity = .92 - daylight * .62;
    facadeMaterial.emissiveIntensity = .92 - daylight * .38;
    groundMaterial.emissiveIntensity = .42 - daylight * .12;
    renderer.toneMappingExposure = 1.18 + daylight * .32;
    const label = `${String(Math.floor(currentTime)).padStart(2,'0')}:${String(Math.round(currentTime%1*60)).padStart(2,'0')}`;
    $('time-display').textContent = $('stat-time').textContent = label;
}

function updateFog(value) {
    fogAmount = Number(value);
    scene.fog.density = .0015 + fogAmount / 100 * .011;
    $('fog-display').textContent = $('stat-fog').textContent = `${fogAmount}%`;
}

function updateSpeed(value) {
    animationSpeed = Number(value) / 100;
    $('speed-display').textContent = $('stat-speed').textContent = `${value}%`;
}

function bindUI() {
    $('time-slider').value = currentTime;
    $('fog-slider').value = fogAmount;
    $('time-slider').addEventListener('input', e => {
        updateEnvironment(e.target.value);
        setPreset();
    });
    $('fog-slider').addEventListener('input', e => updateFog(e.target.value));
    $('speed-slider').addEventListener('input', e => updateSpeed(e.target.value));
    $('autoRotate').addEventListener('change', e => controls.autoRotate = e.target.checked);
    const presets = {
        btnSunrise: [6.5, 38],
        btnMidday: [12, 12],
        btnSunset: [18.5, 30],
        btnNight: [22, 42]
    };
    Object.entries(presets).forEach(([id, v]) => $(id).addEventListener('click', () => {
        $('time-slider').value = v[0];
        $('fog-slider').value = v[1];
        updateEnvironment(v[0]);
        updateFog(v[1]);
        setPreset(id);
    }));
    $('reset-btn').addEventListener('click', () => {
        camera.position.set(118, 78, 118);
        controls.target.set(0, 25, 0);
        controls.update();
    });
    $('screenshot-btn').addEventListener('click', () => {
        renderer.render(scene, camera);
        const a = document.createElement('a');
        a.download = 'aether-city.png';
        a.href = renderer.domElement.toDataURL('image/png');
        a.click();
    });
}

function setPreset(active) {
    document.querySelectorAll('.preset-option').forEach(b => b.classList.toggle('active', b.id === active));
}

function resize() {
    const host = $('canvas-container'),
        w = host.clientWidth,
        h = host.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
}

function animate() {
    requestAnimationFrame(animate);
    if (!running) return;
    const dt = Math.min(clock.getDelta(), .05) * animationSpeed,
        t = clock.elapsedTime;
    animated.traffic.forEach(v => {
        const axis = v.userData.horizontal ? 'x' : 'z';
        v.position[axis] += v.userData.dir * v.userData.speed * dt;
        if (Math.abs(v.position[axis]) > 96) v.position[axis] *= -1;
    });
    if (animationSpeed > 0 && t >= nextPatrolTime) launchPatrol(t);
    for (let i = animated.patrols.length - 1; i >= 0; i--) {
        const craft = animated.patrols[i],
            age = t - craft.userData.born;
        craft.position.addScaledVector(craft.userData.velocity, dt);
        craft.position.y += Math.sin(t * 1.8 + craft.userData.phase) * dt * .7;
        craft.rotation.x += craft.userData.rollSpeed * dt;
        craft.rotation.z += Math.sin(t * .8 + craft.userData.phase) * dt * .12;
        const engine = craft.children[2];
        engine.scale.y = .82 + Math.sin(t * 18 + craft.userData.phase) * .18;
        if (craft.userData.willFire && !craft.userData.fired && t >= craft.userData.shotAt) {
            firePatrolLaser(craft, t);
            craft.userData.fired = true;
        }
        if (age > craft.userData.life) {
            scene.remove(craft);
            craft.traverse(node => {
                if (node.geometry) node.geometry.dispose();
                if (node.material) node.material.dispose();
            });
            animated.patrols.splice(i, 1);
        }
    }
    for (let i = animated.lasers.length - 1; i >= 0; i--) {
        const laser = animated.lasers[i],
            progress = (t - laser.born) / laser.life;
        const opacity = Math.max(0, 1 - progress);
        laser.beam.material.opacity = opacity;
        laser.impact.material.opacity = opacity;
        laser.ring.material.opacity = opacity * .8;
        laser.flash.intensity = 85 * opacity;
        laser.impact.scale.setScalar(1 + progress * 4.5);
        laser.ring.scale.setScalar(1 + progress * 8);
        if (progress >= 1) {
            scene.remove(laser.beam, laser.impact, laser.ring, laser.flash);
            laser.beam.geometry.dispose();
            laser.beam.material.dispose();
            laser.impact.geometry.dispose();
            laser.impact.material.dispose();
            laser.ring.geometry.dispose();
            laser.ring.material.dispose();
            animated.lasers.splice(i, 1);
        }
    }
    animated.rings.forEach((r, i) => {
        r.rotation.z += dt * (i % 2 ? .18 : -.13);
        r.position.y += Math.sin(t * .7 + i) * .003;
    });
    animated.drones.forEach(d => {
        d.userData.angle += d.userData.speed * dt;
        d.position.set(Math.cos(d.userData.angle) * d.userData.radius, d.userData.height, Math.sin(d.userData.angle) * d.userData.radius);
        d.rotation.y = -d.userData.angle;
    });
    animated.beacon.forEach((b, i) => {
        b.rotation.z = t * (.12 + i * .03);
        b.position.y = b.userData.floatBase + Math.sin(t * .7 + i) * .8;
        b.material.opacity = .2 + Math.sin(t * 1.3 + i) * .09;
    });
    animated.wisps.forEach(w => {
        w.rotation.y = t * .003;
    });
    controls.autoRotateSpeed = .35 * animationSpeed;
    controls.update();
    renderer.render(scene, camera);
}

init();