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
        renderer.toneMappingExposure = 1.3;
        container.classList.add('ring-lab');
        container.innerHTML = `
          <div class="ring-lab__heading"><span class="ring-lab__eyebrow">MAGNETIC FIELD / LIVE</span><h3>Inside the toroid.</h3><p>A copper winding. A circulating field. Particles in motion.</p></div>
          <div class="ring-lab__equation" aria-label="Lorentz force: acceleration equals charge over mass times velocity cross magnetic field">dv/dt = (q/m) v × B<span>IDEAL TOROID · NORMALIZED UNITS</span></div>
          <div class="ring-lab__readout"><span><i></i> CYAN · POSITIVE CHARGE &nbsp; / &nbsp; AMBER · NEGATIVE CHARGE</span><span>Opposite charges spiral in opposite directions. Stronger fields tighten the spiral.</span></div>
          <div class="ring-lab__controls"><label>Field strength <span><output>1.0</output> ×</span><input aria-label="Field strength" type="range" min="0.4" max="2" step="0.1" value="1"></label><div><button type="button" data-pause>Pause</button><button type="button" data-reset>Reset view</button></div></div>
          <p class="ring-lab__note">Drag to orbit · Arrow keys to rotate · + / − to zoom<br>Ideal B ∝ 1/r · equal charge-to-mass magnitudes · particles reinjected at coil boundary · no collisions or electric field.</p>`;
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
        const copper = new T.MeshStandardMaterial({
            color: 0xa75b2b,
            emissive: 0x411906,
            emissiveIntensity: 0.2,
            transparent: true,
            opacity: 0.48,
            depthWrite: false,
            metalness: 0.65,
            roughness: 0.26
        });
        const fineLine = new T.LineBasicMaterial({
            color: 0x36b9d6,
            transparent: true,
            opacity: 0.12,
            depthWrite: false,
            blending: T.AdditiveBlending
        });

        // One continuous poloidal winding, with an open bore so trajectories
        // remain visible. The ideal field below approximates a dense winding.
        const winding = [];
        for (let i = 0; i <= 4608; i++) {
            const a = i / 4608 * Math.PI * 2;
            const b = a * 48;
            const r = 3.25 + 0.86 * Math.cos(b);
            winding.push(new T.Vector3(r * Math.cos(a), 0.86 * Math.sin(b), r * Math.sin(a)));
        }
        apparatus.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(winding, true), 4608, 0.019, 5, true), copper));
        for (const radius of [2.36, 4.14]) {
            const rail = new T.Mesh(new T.TorusGeometry(radius, 0.035, 8, 192), copper);
            rail.rotation.x = Math.PI / 2;
            apparatus.add(rail);
        }
        for (let j = 0; j < 24; j++) {
            const points = [];
            const theta = j / 12 * Math.PI * 2;
            const shell = j < 12 ? 0.36 : 0.67;
            const radius = 3.25 + shell * Math.cos(theta);
            const y = shell * Math.sin(theta);
            for (let i = 0; i <= 192; i++) {
                const a = i / 192 * Math.PI * 2;
                points.push(new T.Vector3(radius * Math.cos(a), y, radius * Math.sin(a)));
            }
            apparatus.add(new T.Line(new T.BufferGeometry().setFromPoints(points), fineLine));
            if (j % 3 === 0) {
                const a = j * 2.399;
                const arrow = new T.ArrowHelper(new T.Vector3(-Math.sin(a), 0, Math.cos(a)),
                    new T.Vector3(radius * Math.cos(a), y, radius * Math.sin(a)), 0.24, 0x4abbd1, 0.12, 0.075);
                apparatus.add(arrow);
            }
        }
        const grid = new T.GridHelper(16, 32, 0x345061, 0x243746);
        grid.position.y = -1.35;
        grid.material.transparent = true;
        grid.material.opacity = 0.045;
        scene.add(grid);




        const count = 64,
            history = 640,
            step = 1 / 120;
        const particles = [];
        const trailPositions = new Float32Array(count * (history - 1) * 6);
        const trailColors = new Float32Array(trailPositions.length);
        const heads = new Float32Array(count * 3);
        const headColors = new Float32Array(count * 3);
        const cyan = new T.Color(0x13cce8);
        const amber = new T.Color(0xff7c24);
        for (let i = 0; i < count; i++) {
            const a = i / count * Math.PI * 2;
            const r = 3.25 + 0.25 * Math.sin(i * 2.4);
            const position = new T.Vector3(r * Math.cos(a), 0.25 * Math.cos(i * 1.7), r * Math.sin(a));
            const phase = i * 2.399;
            const velocity = new T.Vector3(-Math.sin(a) * 1.35 + Math.cos(a) * Math.cos(phase),
                Math.sin(phase), Math.cos(a) * 1.35 + Math.sin(a) * Math.cos(phase));
            const charge = i % 4 === 0 ? -1 : 1;
            const color = charge > 0 ? cyan : amber;
            color.toArray(headColors, i * 3);
            particles.push({
                position,
                velocity,
                charge,
                initialVelocity: velocity.clone(),
                initialPosition: position.clone(),
                cursor: 0,
                history: Array.from({
                    length: history
                }, () => position.clone())
            });
            for (let j = 0; j < history - 1; j++) {
                for (let k = 0; k < 2; k++) {
                    const index = (i * (history - 1) + j) * 6 + k * 3;
                    color.clone().multiplyScalar(0.015 + 0.985 * (1 - j / history) ** 1.5).toArray(trailColors, index);
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
            toneMapped: false,
            depthWrite: false,
            blending: T.AdditiveBlending
        }));
        trails.frustumCulled = false;
        scene.add(trails);
        const headGeometry = new T.BufferGeometry();
        headGeometry.setAttribute('position', new T.BufferAttribute(heads, 3).setUsage(T.DynamicDrawUsage));
        headGeometry.setAttribute('color', new T.BufferAttribute(headColors, 3));
        const headPoints = new T.Points(headGeometry, new T.ShaderMaterial({
            vertexColors: true,
            transparent: true,
            depthWrite: false,
            blending: T.AdditiveBlending,
            uniforms: { pixelScale: { value: 1 } },
            vertexShader: `varying vec3 tint;
                uniform float pixelScale;
                void main() {
                    tint = color;
                    vec4 p = modelViewMatrix * vec4(position, 1.0);
                    gl_Position = projectionMatrix * p;
                    gl_PointSize = clamp(pixelScale / -p.z, 2.0, 32.0);
                }`,
            fragmentShader: `varying vec3 tint;
                void main() {
                    float r = length(gl_PointCoord - 0.5) * 2.0;
                    if (r > 1.0) discard;
                    float glow = exp(-5.0 * r * r) * (1.0 - smoothstep(0.65, 1.0, r));
                    gl_FragColor = vec4(mix(tint, vec3(1.0), exp(-35.0 * r * r)), glow);
                }`
        }));
        headPoints.frustumCulled = false;
        scene.add(headPoints);
        // Soft light around sampled trail positions, without a full-screen
        // bloom pass or large render targets on mobile devices.
        const glowStride = 8;
        const glowCount = count * Math.ceil(history / glowStride);
        const glowPositions = new Float32Array(glowCount * 3);
        const glowColors = new Float32Array(glowCount * 3);
        const glowGeometry = new T.BufferGeometry();
        glowGeometry.setAttribute('position', new T.BufferAttribute(glowPositions, 3).setUsage(T.DynamicDrawUsage));
        glowGeometry.setAttribute('color', new T.BufferAttribute(glowColors, 3));
        for (let i = 0, n = 0; i < count; i++) {
            const color = particles[i].charge > 0 ? cyan : amber;
            for (let j = 0; j < history; j += glowStride, n++) {
                color.clone().multiplyScalar(0.12 * (1 - j / history) ** 2).toArray(glowColors, n * 3);
            }
        }
        const glowMaterial = headPoints.material.clone();
        glowMaterial.fragmentShader = `varying vec3 tint;
            void main() {
                float r = length(gl_PointCoord - 0.5) * 2.0;
                if (r > 1.0) discard;
                gl_FragColor = vec4(tint, exp(-4.0 * r * r) * (1.0 - smoothstep(0.5, 1.0, r)));
            }`;
        const glow = new T.Points(glowGeometry, glowMaterial);
        glow.frustumCulled = false;
        scene.add(glow);
        let field = 1,
            paused = reducedMotion.matches,
            visible = false,
            disposed = false;
        let yaw = 0.45,
            pitch = 0.49,
            distance = 15.5,
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
                // Boris magnetic rotation: preserves speed without rescaling.
                t.set(-p.position.z, 0, p.position.x).multiplyScalar(p.charge * 7 * field * 3.25 / r2 * step / 2);
                s.copy(t).multiplyScalar(2 / (1 + t.lengthSq()));
                prime.copy(p.velocity).add(cross.copy(p.velocity).cross(t));
                p.velocity.add(cross.copy(prime).cross(s));
                p.position.addScaledVector(p.velocity, step);

                if ((Math.hypot(p.position.x, p.position.z) - 3.25) ** 2 + p.position.y ** 2 > 0.82 ** 2) {
                    p.position.copy(p.initialPosition);
                    p.velocity.copy(p.initialVelocity);
                    p.history.forEach(v => v.copy(p.position));
                }
                p.cursor = (p.cursor + 1) % history;
                p.history[p.cursor].copy(p.position);
            });
        }

        for (let i = 0; i < history; i++) integrate();

        function draw() {
            let glowIndex = 0;
            particles.forEach((p, i) => {
                p.position.toArray(heads, i * 3);
                for (let j = 0; j < history - 1; j++) {
                    const offset = (i * (history - 1) + j) * 6;
                    p.history[(p.cursor - j + history) % history].toArray(trailPositions, offset);
                    p.history[(p.cursor - j - 1 + history) % history].toArray(trailPositions, offset + 3);
                }
                for (let j = 0; j < history; j += glowStride) {
                    p.history[(p.cursor - j + history) % history].toArray(glowPositions, glowIndex++ * 3);
                }
            });
            glowGeometry.attributes.position.needsUpdate = true;
            trailsGeometry.attributes.position.needsUpdate = true;
            headGeometry.attributes.position.needsUpdate = true;
            yaw += (targetYaw - yaw) * 0.12;
            pitch += (targetPitch - pitch) * 0.12;
            camera.position.set(distance * Math.cos(pitch) * Math.sin(yaw), distance * Math.sin(pitch), distance * Math.cos(pitch) * Math.cos(yaw));
            camera.lookAt(0, -0.65, 0);
            renderer.render(scene, camera);
        }

        function frame(now) {
            if (disposed) return;
            raf = requestAnimationFrame(frame);
            const elapsed = previous ? Math.min((now - previous) / 1000, 0.05) : 0;
            previous = now;
            if (!visible || document.hidden) return;
            if (!paused) {
                if (!dragging) targetYaw += elapsed * 0.035;
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
            targetPitch = 0.49;
            distance = fittedDistance();
        });

        function fittedDistance() {
            return Math.max(15.5, 13 / camera.aspect);
        }

        function resize() {
            const width = container.clientWidth,
                height = container.clientHeight;
            camera.aspect = width / Math.max(height, 1);
            distance = fittedDistance();
            headPoints.material.uniforms.pixelScale.value = height * renderer.getPixelRatio() * 0.24;
            glowMaterial.uniforms.pixelScale.value = height * renderer.getPixelRatio() * 0.42;
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
