import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const CONFIG = { buildings: 144, vehicles: 54, particles: 420, extent: 92 };
const palette = {
    void: new THREE.Color(0x05070d), dusk: new THREE.Color(0x17152a), dawn: new THREE.Color(0x806a78),
    day: new THREE.Color(0x526b79), cyan: new THREE.Color(0x65f2df), violet: new THREE.Color(0x9b7cff),
    gold: new THREE.Color(0xffc875), stone: new THREE.Color(0x141a25)
};

let scene, camera, renderer, controls, clock, sun, ambient, city, windowMaterial;
let currentTime = 20.5, animationSpeed = 1, fogAmount = 28, running = true;
const animated = { traffic: [], wisps: [], rings: [], beacon: [] };
const $ = (id) => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);

function material(color, emissive = 0x000000, intensity = 0) {
    return new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: intensity, roughness: .48, metalness: .62 });
}

function init() {
    const host = $('canvas-container');
    if (!host) return;
    const width = host.clientWidth || 900, height = host.clientHeight || 650;
    scene = new THREE.Scene();
    scene.background = palette.void;
    scene.fog = new THREE.FogExp2(palette.void, .0045);
    camera = new THREE.PerspectiveCamera(48, width / height, .5, 420);
    camera.position.set(118, 78, 118);

    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.replaceChildren(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = .045;
    controls.minDistance = 45; controls.maxDistance = 230; controls.maxPolarAngle = 1.47;
    controls.target.set(0, 25, 0);
    clock = new THREE.Clock();
    city = new THREE.Group(); scene.add(city);
    createWorld(); bindUI(); updateEnvironment(currentTime); updateFog(fogAmount);
    new ResizeObserver(resize).observe(host);
    document.addEventListener('visibilitychange', () => running = !document.hidden);
    animate();
}

function createWorld() {
    ambient = new THREE.HemisphereLight(0x8092c7, 0x080811, .72); scene.add(ambient);
    sun = new THREE.DirectionalLight(0xffd8ad, 1.6); sun.position.set(-80, 110, 45); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -105, right: 105, top: 105, bottom: -105, near: 10, far: 270 }); scene.add(sun);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(138, 64), material(0x090d15));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; city.add(ground);
    createRoads(); createBuildings(); createSanctum(); createTraffic(); createAtmosphere();
}

function createRoads() {
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x090d14, roughness: .82, metalness: .25 });
    const glowMat = new THREE.MeshBasicMaterial({ color: palette.cyan, transparent: true, opacity: .38 });
    [-60, -36, -12, 12, 36, 60].forEach(offset => {
        [[0, .12, offset, 188, .16, 6], [offset, .12, 0, 6, .16, 188]].forEach(v => {
            const road = new THREE.Mesh(new THREE.BoxGeometry(v[3], v[4], v[5]), roadMat); road.position.set(v[0], v[1], v[2]); city.add(road);
        });
        const h = new THREE.Mesh(new THREE.BoxGeometry(188, .03, .09), glowMat); h.position.set(0, .23, offset); city.add(h);
        const v = new THREE.Mesh(new THREE.BoxGeometry(.09, .03, 188), glowMat); v.position.set(offset, .23, 0); city.add(v);
    });
    [28, 52, 76].forEach(radius => {
        const ring = new THREE.Mesh(new THREE.RingGeometry(radius - .12, radius + .12, 128), glowMat.clone());
        ring.rotation.x = -Math.PI / 2; ring.position.y = .24; city.add(ring);
    });
}

function createBuildings() {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const facade = material(0x151d2a, 0x10152a, .45);
    const towers = new THREE.InstancedMesh(geo, facade, CONFIG.buildings);
    towers.castShadow = towers.receiveShadow = true;
    windowMaterial = new THREE.MeshBasicMaterial({ color: palette.gold, transparent: true, opacity: .82, blending: THREE.AdditiveBlending, depthWrite: false });
    const windows = new THREE.InstancedMesh(geo, windowMaterial, CONFIG.buildings * 2);
    const dummy = new THREE.Object3D(); let wi = 0;
    for (let i = 0; i < CONFIG.buildings; i++) {
        const gx = (i % 12) - 5.5, gz = Math.floor(i / 12) - 5.5;
        let x = gx * 13.8 + rand(-2, 2), z = gz * 13.8 + rand(-2, 2);
        if (Math.abs(x) < 17 && Math.abs(z) < 17) { x += x < 0 ? -17 : 17; z += z < 0 ? -10 : 10; }
        const radial = Math.hypot(x, z), h = rand(10, 33) + Math.max(0, 43 - radial * .38);
        const w = rand(5, 9), d = rand(5, 9);
        dummy.position.set(x, h / 2, z); dummy.scale.set(w, h, d); dummy.rotation.y = Math.round(rand(0, 4)) * Math.PI / 2; dummy.updateMatrix(); towers.setMatrixAt(i, dummy.matrix);
        const c = new THREE.Color().setHSL(rand(.55, .69), rand(.16, .36), rand(.09, .18)); towers.setColorAt(i, c);
        for (let face = 0; face < 2; face++) {
            dummy.position.set(x + (face ? w / 2 + .03 : 0), h * rand(.42, .72), z + (face ? 0 : d / 2 + .03));
            dummy.scale.set(face ? .035 : w * .7, h * rand(.35, .6), face ? d * .7 : .035); dummy.rotation.y = 0; dummy.updateMatrix(); windows.setMatrixAt(wi++, dummy.matrix);
        }
    }
    city.add(towers, windows); $('stat-buildings').textContent = CONFIG.buildings;
}

function createSanctum() {
    const group = new THREE.Group();
    const dark = material(0x111827, 0x241b42, .65);
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(5, 9, 76, 6), dark); tower.position.y = 38; tower.castShadow = true; group.add(tower);
    const crown = new THREE.Mesh(new THREE.ConeGeometry(8, 21, 6, 1, true), dark); crown.position.y = 82; group.add(crown);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(.18, .65, 38, 8), new THREE.MeshBasicMaterial({ color: palette.violet, transparent: true, opacity: .55, blending: THREE.AdditiveBlending }));
    beam.position.y = 104; group.add(beam);
    [16, 27, 39].forEach((y, i) => {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(7 + i * .5, .12, 5, 48), new THREE.MeshBasicMaterial({ color: i === 1 ? palette.gold : palette.violet, transparent: true, opacity: .72 }));
        ring.rotation.x = Math.PI / 2; ring.position.y = y; group.add(ring); animated.rings.push(ring);
    });
    for (let i = 0; i < 8; i++) {
        const spire = new THREE.Mesh(new THREE.ConeGeometry(1.4, rand(9, 16), 4), dark); const a = i / 8 * Math.PI * 2;
        spire.position.set(Math.cos(a) * 12, rand(8, 12), Math.sin(a) * 12); spire.rotation.z = Math.cos(a) * .12; group.add(spire);
    }
    city.add(group);
}

function createTraffic() {
    const geo = new THREE.BoxGeometry(1.25, .5, 2.4), mat = new THREE.MeshBasicMaterial({ color: palette.cyan });
    for (let i = 0; i < CONFIG.vehicles; i++) {
        const mesh = new THREE.Mesh(geo, mat); const horizontal = i % 2 === 0, lane = [-60,-36,-12,12,36,60][i % 6];
        mesh.position.set(horizontal ? rand(-94,94) : lane + (i%3-1)*1.4, .65, horizontal ? lane + (i%3-1)*1.4 : rand(-94,94));
        if (horizontal) mesh.rotation.y = Math.PI / 2;
        mesh.userData = { horizontal, dir: i % 4 < 2 ? 1 : -1, speed: rand(7, 14) }; city.add(mesh); animated.traffic.push(mesh);
    }
}

function createAtmosphere() {
    const positions = new Float32Array(CONFIG.particles * 3);
    for (let i=0;i<CONFIG.particles;i++) { positions[i*3]=rand(-125,125); positions[i*3+1]=rand(3,105); positions[i*3+2]=rand(-125,125); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(positions,3));
    const dust = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x94eadf, size: .28, transparent:true, opacity:.42, depthWrite:false, blending:THREE.AdditiveBlending })); city.add(dust); animated.wisps.push(dust);
    const moon = new THREE.Mesh(new THREE.SphereGeometry(7,24,24), new THREE.MeshBasicMaterial({color:0xd5d4ff})); moon.position.set(-88,92,-110); scene.add(moon);
}

function updateEnvironment(value) {
    currentTime = Number(value); const daylight = Math.max(0, Math.sin((currentTime - 6) / 24 * Math.PI * 2));
    const twilight = Math.max(0, 1 - Math.abs(currentTime - 6)/3, 1 - Math.abs(currentTime - 18)/3);
    const sky = palette.void.clone().lerp(palette.dusk, twilight).lerp(palette.day, daylight * .72);
    scene.background.copy(sky); scene.fog.color.copy(sky); ambient.intensity = .28 + daylight * 1.05; sun.intensity = .15 + daylight * 2;
    sun.color.set(daylight < .25 ? 0xb99cff : 0xffdfbd); windowMaterial.opacity = .92 - daylight * .62;
    renderer.toneMappingExposure = .9 + daylight * .42;
    const label = `${String(Math.floor(currentTime)).padStart(2,'0')}:${String(Math.round(currentTime%1*60)).padStart(2,'0')}`;
    $('time-display').textContent = $('stat-time').textContent = label;
}

function updateFog(value) { fogAmount = Number(value); scene.fog.density = .0015 + fogAmount / 100 * .011; $('fog-display').textContent = $('stat-fog').textContent = `${fogAmount}%`; }
function updateSpeed(value) { animationSpeed = Number(value)/100; $('speed-display').textContent = $('stat-speed').textContent = `${value}%`; }

function bindUI() {
    $('time-slider').value = currentTime; $('fog-slider').value = fogAmount;
    $('time-slider').addEventListener('input', e => { updateEnvironment(e.target.value); setPreset(); });
    $('fog-slider').addEventListener('input', e => updateFog(e.target.value));
    $('speed-slider').addEventListener('input', e => updateSpeed(e.target.value));
    $('autoRotate').addEventListener('change', e => controls.autoRotate = e.target.checked);
    const presets = { btnSunrise:[6.5,38], btnMidday:[12,12], btnSunset:[18.5,30], btnNight:[22,42] };
    Object.entries(presets).forEach(([id,v]) => $(id).addEventListener('click', () => { $('time-slider').value=v[0]; $('fog-slider').value=v[1]; updateEnvironment(v[0]); updateFog(v[1]); setPreset(id); }));
    $('reset-btn').addEventListener('click', () => { camera.position.set(118,78,118); controls.target.set(0,25,0); controls.update(); });
    $('screenshot-btn').addEventListener('click', () => { renderer.render(scene,camera); const a=document.createElement('a'); a.download='aether-city.png'; a.href=renderer.domElement.toDataURL('image/png'); a.click(); });
}
function setPreset(active) { document.querySelectorAll('.preset-option').forEach(b=>b.classList.toggle('active',b.id===active)); }
function resize() { const host=$('canvas-container'), w=host.clientWidth, h=host.clientHeight; if(!w||!h)return; camera.aspect=w/h; camera.updateProjectionMatrix(); renderer.setSize(w,h,false); }

function animate() {
    requestAnimationFrame(animate); if (!running) return;
    const dt=Math.min(clock.getDelta(),.05)*animationSpeed, t=clock.elapsedTime;
    animated.traffic.forEach(v=>{ const axis=v.userData.horizontal?'x':'z'; v.position[axis]+=v.userData.dir*v.userData.speed*dt; if(Math.abs(v.position[axis])>96)v.position[axis]*=-1; });
    animated.rings.forEach((r,i)=>{ r.rotation.z += dt*(i%2?.18:-.13); r.position.y += Math.sin(t*.7+i)*.003; });
    animated.wisps.forEach(w=>{ w.rotation.y=t*.003; });
    controls.autoRotateSpeed=.35*animationSpeed; controls.update(); renderer.render(scene,camera);
}

init();
