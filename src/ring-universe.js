(function() {
    'use strict';

    window.createRingUniverseSimulation = function(container) {
        if (!container || !window.THREE) return null;
        const T = window.THREE;
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        const scene = new T.Scene();
        const camera = new T.PerspectiveCamera(38, 1, 0.1, 100);
        const renderer = new T.WebGLRenderer({
            antialias: true,
            alpha: true
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.outputEncoding = T.sRGBEncoding;
        renderer.toneMapping = T.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 0.95;
        container.classList.add('ring-lab');
        container.innerHTML = `
          <div class="ring-lab__heading"><span class="ring-lab__eyebrow">FIELD STUDY / 01</span><h3>Toroidal field</h3><p>Charged particles in a magnetic field.</p></div>
          <div class="ring-lab__equation" aria-label="Lorentz force: acceleration equals charge over mass times velocity cross magnetic field">dv/dt = (q/m) v × B<span>IDEAL TOROID · NORMALIZED UNITS</span></div>
          <div class="ring-lab__readout"><span><i></i> PARTICLE TRAJECTORIES</span><span>Magnetic force bends velocity; speed stays constant.</span></div>
          <div class="ring-lab__controls"><label>Field strength <span><output>1.0</output> ×</span><input aria-label="Field strength" type="range" min="0.4" max="2" step="0.1" value="1"></label><div><button type="button" data-pause>Pause</button><button type="button" data-reset>Reset view</button></div></div>
          <p class="ring-lab__note">Drag to orbit · Arrow keys to rotate · + / − to zoom<br>Ideal field · particles reinjected at boundary · no collisions or electric field.</p>`;
        renderer.domElement.tabIndex = 0;
        renderer.domElement.setAttribute('role', 'img');
        renderer.domElement.setAttribute('aria-label', 'Interactive toroidal magnetic field with charged particle trajectories. Drag or use arrow keys to orbit, plus and minus to zoom.');
        container.prepend(renderer.domElement);
        scene.add(new T.HemisphereLight(0xd7efff, 0x182434, 0.7));
        const light = (color, intensity, x, y, z) => {
            const item = new T.DirectionalLight(color, intensity);
            item.position.set(x, y, z);
            scene.add(item);
        };
        light(0xe4f3ff, 1.7, -3, 8, 5);
        light(0x51bacc, 1.2, 4, -2, -4);
        light(0xffd5a0, 0.8, -6, 1, -2);
        const apparatus = new T.Group();
        scene.add(apparatus);
        const metal = new T.MeshStandardMaterial({
            color: 0x304858,
            metalness: 0.55,
            roughness: 0.34
        });
        const copper = new T.MeshStandardMaterial({
            color: 0xb87536,
            metalness: 0.35,
            roughness: 0.38
        });
        const fineLine = new T.LineBasicMaterial({
            color: 0x548395,
            transparent: true,
            opacity: 0.22
        });

        const housing = new T.Mesh(new T.TorusGeometry(3.25, 0.72, 32, 160, Math.PI * 1.22), metal);
        housing.rotation.x = Math.PI / 2;
        housing.rotation.z = 0.32;
        apparatus.add(housing);
        const ribGeometry = new T.TorusGeometry(0.79, 0.027, 8, 64);
        for (let i = 0; i < 40; i++) {
            const angle = i / 40 * Math.PI * 2;
            const rib = new T.Mesh(ribGeometry, copper);
            rib.position.set(3.25 * Math.cos(angle), 0, 3.25 * Math.sin(angle));
            rib.rotation.y = -angle;
            apparatus.add(rib);
        }
        for (const radius of [2.45, 4.06]) {
            const rail = new T.Mesh(new T.TorusGeometry(radius, 0.035, 8, 192), copper);
            rail.rotation.x = Math.PI / 2;
            apparatus.add(rail);
        }
        for (let j = 0; j < 7; j++) {
            const points = [];
            const offset = (j - 3) * 0.18;
            for (let i = 0; i <= 192; i++) {
                const a = i / 192 * Math.PI * 2;
                points.push(new T.Vector3((3.25 + offset) * Math.cos(a), 0.1, (3.25 + offset) * Math.sin(a)));
            }
            apparatus.add(new T.Line(new T.BufferGeometry().setFromPoints(points), fineLine));
        }
        const grid = new T.GridHelper(16, 32, 0x345061, 0x243746);
        grid.position.y = -1.35;
        grid.material.transparent = true;
        grid.material.opacity = 0.13;
        scene.add(grid);




        const count = 36,
            history = 220,
            step = 1 / 120;
        const particles = [];
        const trailPositions = new Float32Array(count * (history - 1) * 6);
        const trailColors = new Float32Array(trailPositions.length);
        const heads = new Float32Array(count * 3);
        const cyan = new T.Color(0x87e8ef);
        for (let i = 0; i < count; i++) {
            const a = i / count * Math.PI * 2;
            const r = 3.25 + 0.25 * Math.sin(i * 2.4);
            const position = new T.Vector3(r * Math.cos(a), 0.25 * Math.cos(i * 1.7), r * Math.sin(a));
            const velocity = new T.Vector3(-Math.sin(a) * 0.9, 0.38, Math.cos(a) * 0.9);
            particles.push({
                position,
                velocity,
                history: Array.from({
                    length: history
                }, () => position.clone())
            });
            for (let j = 0; j < history - 1; j++) {
                for (let k = 0; k < 2; k++) {
                    const index = (i * (history - 1) + j) * 6 + k * 3;
                    cyan.clone().multiplyScalar(0.08 + 0.92 * (1 - j / history) ** 2).toArray(trailColors, index);
                }
            }
        }
        const trailsGeometry = new T.BufferGeometry();
        trailsGeometry.setAttribute('position', new T.BufferAttribute(trailPositions, 3).setUsage(T.DynamicDrawUsage));
        trailsGeometry.setAttribute('color', new T.BufferAttribute(trailColors, 3));
        const trails = new T.LineSegments(trailsGeometry, new T.LineBasicMaterial({
            vertexColors: true,
            transparent: true,
            opacity: 0.95,
            blending: T.AdditiveBlending
        }));
        trails.frustumCulled = false;
        scene.add(trails);
        const headGeometry = new T.BufferGeometry();
        headGeometry.setAttribute('position', new T.BufferAttribute(heads, 3).setUsage(T.DynamicDrawUsage));
        const headPoints = new T.Points(headGeometry, new T.PointsMaterial({
            color: 0xcdffff,
            size: 0.055,
            sizeAttenuation: true
        }));
        headPoints.frustumCulled = false;
        scene.add(headPoints);
        let field = 1,
            paused = reducedMotion.matches,
            visible = false,
            disposed = false;
        let yaw = 0.45,
            pitch = 0.68,
            distance = 17,
            targetYaw = yaw,
            targetPitch = pitch;
        let dragging = null,
            previous = 0,
            accumulator = 0,
            raf;
        const t = new T.Vector3(),
            s = new T.Vector3(),
            prime = new T.Vector3(),
            cross = new T.Vector3();

        function integrate() {
            particles.forEach(p => {
                const r2 = Math.max(0.01, p.position.x ** 2 + p.position.z ** 2);
                t.set(-p.position.z, 0, p.position.x).multiplyScalar(5 * field * 3.25 / r2 * step / 2);
                s.copy(t).multiplyScalar(2 / (1 + t.lengthSq()));
                prime.copy(p.velocity).add(cross.copy(p.velocity).cross(t));
                p.velocity.add(cross.copy(prime).cross(s));
                p.position.addScaledVector(p.velocity, step);

                if (Math.abs(p.position.y) > 1.05 || Math.hypot(p.position.x, p.position.z) > 4.2 || Math.hypot(p.position.x, p.position.z) < 2.3) {
                    const a = Math.atan2(p.position.z, p.position.x);
                    p.position.set(3.25 * Math.cos(a), 0, 3.25 * Math.sin(a));
                    p.velocity.set(-Math.sin(a) * 0.9, 0.38, Math.cos(a) * 0.9);
                    p.history.forEach(v => v.copy(p.position));
                }
                const oldest = p.history.pop();
                oldest.copy(p.position);
                p.history.unshift(oldest);
            });
        }

        for (let i = 0; i < history; i++) integrate();

        function draw() {
            particles.forEach((p, i) => {
                p.position.toArray(heads, i * 3);
                for (let j = 0; j < history - 1; j++) {
                    const offset = (i * (history - 1) + j) * 6;
                    p.history[j].toArray(trailPositions, offset);
                    p.history[j + 1].toArray(trailPositions, offset + 3);
                }
            });
            trailsGeometry.attributes.position.needsUpdate = true;
            headGeometry.attributes.position.needsUpdate = true;
            yaw += (targetYaw - yaw) * 0.12;
            pitch += (targetPitch - pitch) * 0.12;
            camera.position.set(distance * Math.cos(pitch) * Math.sin(yaw), distance * Math.sin(pitch), distance * Math.cos(pitch) * Math.cos(yaw));
            camera.lookAt(0, 0, 0);
            renderer.render(scene, camera);
        }

        function frame(now) {
            if (disposed) return;
            raf = requestAnimationFrame(frame);
            const elapsed = previous ? Math.min((now - previous) / 1000, 0.05) : 0;
            previous = now;
            if (!visible || document.hidden) return;
            if (!paused) {
                accumulator += elapsed;
                while (accumulator >= step) {
                    integrate();
                    accumulator -= step;
                }
            }
            draw();
        }
        const listeners = [];

        function on(target, event, handler) {
            target.addEventListener(event, handler);
            listeners.push(() => target.removeEventListener(event, handler));
        }
        const canvas = renderer.domElement;
        on(canvas, 'pointerdown', e => {
            if (e.button !== 0) return;
            dragging = {
                id: e.pointerId,
                x: e.clientX,
                y: e.clientY
            };
            canvas.setPointerCapture(e.pointerId);
            canvas.focus({
                preventScroll: true
            });
        });
        on(canvas, 'pointermove', e => {
            if (!dragging || dragging.id !== e.pointerId) return;
            targetYaw -= (e.clientX - dragging.x) * 0.008;
            targetPitch = Math.max(0.12, Math.min(1.4, targetPitch + (e.clientY - dragging.y) * 0.006));
            dragging.x = e.clientX;
            dragging.y = e.clientY;
        });
        ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(event => on(canvas, event, () => {
            dragging = null;
        }));
        on(canvas, 'keydown', e => {
            if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-'].includes(e.key)) return;
            e.preventDefault();
            if (e.key === 'ArrowLeft') targetYaw -= 0.15;
            if (e.key === 'ArrowRight') targetYaw += 0.15;
            if (e.key === 'ArrowUp') targetPitch = Math.min(1.4, targetPitch + 0.1);
            if (e.key === 'ArrowDown') targetPitch = Math.max(0.12, targetPitch - 0.1);
            if (e.key === '+' || e.key === '=') distance = Math.max(10, distance - 1);
            if (e.key === '-') distance = Math.min(25, distance + 1);
        });
        const pause = container.querySelector('[data-pause]');

        function updatePause() {
            pause.textContent = paused ? 'Resume' : 'Pause';
            pause.setAttribute('aria-pressed', String(paused));
        }
        updatePause();
        on(pause, 'click', () => {
            paused = !paused;
            updatePause();
        });
        on(reducedMotion, 'change', e => {
            paused = e.matches;
            updatePause();
        });
        on(container.querySelector('input'), 'input', e => {
            field = Number(e.target.value);
            container.querySelector('output').value = field.toFixed(1);
        });
        on(container.querySelector('[data-reset]'), 'click', () => {
            targetYaw = 0.45;
            targetPitch = 0.68;
            distance = camera.aspect < 1 ? 29 : 17;
        });

        function resize() {
            const width = container.clientWidth,
                height = container.clientHeight;
            camera.aspect = width / Math.max(height, 1);
            distance = camera.aspect < 1 ? 29 : 17;
            camera.updateProjectionMatrix();
            renderer.setSize(width, height);
            draw();
        }
        const resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(container);
        const observer = new IntersectionObserver(entries => {
            visible = entries[0].isIntersecting;
            previous = 0;
        });
        observer.observe(container);
        resize();
        raf = requestAnimationFrame(frame);
        return {
            dispose() {
                disposed = true;
                cancelAnimationFrame(raf);
                observer.disconnect();
                resizeObserver.disconnect();
                listeners.forEach(remove => remove());
                const geometries = new Set(),
                    materials = new Set();
                scene.traverse(object => {
                    if (object.geometry) geometries.add(object.geometry);
                    if (object.material) materials.add(object.material);
                });
                geometries.forEach(g => g.dispose());
                materials.forEach(m => m.dispose());
                renderer.dispose();
                container.replaceChildren();
                container.classList.remove('ring-lab');
            }
        };
    };
})();