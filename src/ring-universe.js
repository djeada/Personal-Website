(function() {
    'use strict';

    // Air-core, densely wound ideal toroid: B_phi = B0 R / r.
    // The visualization uses R = 3.25, B0 = 7 and |q/m| = 1.
    function toroidalField(position, current = 1) {
        const scale = 7 * current * 3.25 / (position.x ** 2 + position.z ** 2);
        return { x: -position.z * scale, y: 0, z: position.x * scale };
    }

    // Boris rotation with leapfrog positions; no electric field or drag.
    // https://www.particleincell.com/2011/vxb-rotation/
    function advanceParticle(particle, magneticField, dt) {
        const v = particle.velocity;
        const half = particle.charge * dt / 2;
        const tx = magneticField.x * half, ty = magneticField.y * half, tz = magneticField.z * half;
        const factor = 2 / (1 + tx * tx + ty * ty + tz * tz);
        const px = v.x + v.y * tz - v.z * ty;
        const py = v.y + v.z * tx - v.x * tz;
        const pz = v.z + v.x * ty - v.y * tx;
        v.x += (py * tz - pz * ty) * factor;
        v.y += (pz * tx - px * tz) * factor;
        v.z += (px * ty - py * tx) * factor;
        particle.position.x += v.x * dt;
        particle.position.y += v.y * dt;
        particle.position.z += v.z * dt;
    }

    function advanceTrail(p, current, dt) {
        if (p.retiring) {
            // Hold outgoing geometry while it fades. Reset only when invisible.
            p.opacity = Math.max(0, p.opacity - dt / 0.7);
            if (p.opacity === 0) {
                Object.assign(p.position, p.initialPosition);
                Object.assign(p.velocity, p.initialVelocity);
                p.history.forEach(v => Object.assign(v, p.position));
                p.age = 0;
                p.retiring = false;
            }
            return;
        }
        advanceParticle(p, toroidalField(p.position, current), dt);
        if ((Math.hypot(p.position.x, p.position.z) - 3.25) ** 2 + p.position.y ** 2 > 0.82 ** 2) {
            p.retiring = true;
        }
        p.age += dt;
        const fadeIn = Math.min(1, p.age / 0.7);
        p.opacity = fadeIn * fadeIn * (3 - 2 * fadeIn);
        p.cursor = (p.cursor + 1) % p.history.length;
        Object.assign(p.history[p.cursor], p.position);
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { toroidalField, advanceParticle, advanceTrail };
    }
    if (typeof window === 'undefined') return;

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
        renderer.toneMappingExposure = 0.9;
        container.classList.add('ring-lab');
        container.innerHTML = `
          <div class="ring-lab__heading"><span class="ring-lab__eyebrow">FIELD ATLAS / 01</span><h3>The toroidal field.</h3><p>Follow the geometry of a magnetic force.</p></div>
          <div class="ring-lab__equation" aria-label="Magnetic field equals mu zero N I over two pi r">B(r) = μ₀NI / 2πr<span>IDEAL AIR CORE · WINDING SHOWN IN CUTAWAY</span></div>
          <div class="ring-lab__metrics"><div><span>INNER FIELD</span><output data-inner-field></output></div><div><span>OUTER FIELD</span><output data-outer-field></output></div><div><span>REFERENCE GYRORADIUS</span><output data-radius></output></div></div>
          <div class="ring-lab__readout"><span><i></i> TEAL · POSITIVE CHARGE &nbsp; / &nbsp; COPPER · NEGATIVE CHARGE</span><span>Opposite charges spiral in opposite directions. Stronger fields tighten the spiral.</span></div>
          <div class="ring-lab__controls"><label>Coil current <span><output data-current>1.0</output> ×</span><input aria-label="Coil current" type="range" min="0.4" max="2" step="0.1" value="1"></label><div><button type="button" data-field aria-pressed="true">Field lines</button><button type="button" data-pause>Pause</button><button type="button" data-reset>Reset view</button></div></div>
          <details class="ring-lab__model"><summary>Controls &amp; physical model</summary><p>Drag to orbit · Arrow keys to rotate · + / − to zoom · 0.35× playback.</p><p>dv/dt = (q/m) v × B. Normalized units: major radius R = 3.25, tube radius a = 0.82, reference field B₀ = 7, equal |q/m| = 1. The reference gyroradius is v⊥ / (|q/m| B₀), with v⊥ = 1.</p><p>A complete winding is modeled; its front half is omitted to expose the field. Current selects a prescribed static field; induction, collisions and particle self-fields are omitted. Test particles drift out of a pure toroidal field, fade, and are reinjected.</p><p><a href="https://openstax.org/books/university-physics-volume-2/pages/12-6-solenoids-and-toroids">Field model</a> · <a href="https://www.particleincell.com/2011/vxb-rotation/">Particle integration</a></p></details>`;
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
        const fieldLines = new T.Group();
        scene.add(fieldLines);
        const copper = new T.MeshStandardMaterial({
            color: 0xa75b2b,
            transparent: true,
            opacity: 0.65,
            depthWrite: false,
            metalness: 0.2,
            roughness: 0.8
        });
        const fineLine = new T.LineBasicMaterial({
            color: 0x66868e,
            transparent: true,
            opacity: 0.12,
            depthWrite: false
        });

        // The front half of the winding is omitted as a visual cutaway.
        // The physical model remains a complete, densely wound ideal toroid.
        const winding = [];
        for (let i = 0; i <= 2304; i++) {
            const a = Math.PI + i / 2304 * Math.PI;
            const b = a * 40;
            const r = 3.25 + 0.86 * Math.cos(b);
            winding.push(new T.Vector3(r * Math.cos(a), 0.86 * Math.sin(b), r * Math.sin(a)));
        }
        apparatus.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(winding), 2304, 0.032, 8, false), copper));
        const fieldVolume = new T.Mesh(new T.TorusGeometry(3.25, 0.82, 48, 192), new T.MeshPhongMaterial({
            color: 0x37606a,
            transparent: true,
            opacity: 0.18,
            shininess: 12,
            depthWrite: false,
            side: T.BackSide
        }));
        fieldVolume.rotation.x = Math.PI / 2;
        fieldVolume.renderOrder = -1;
        scene.add(fieldVolume);
        for (const radius of [2.36, 4.14]) {
            const rail = new T.Mesh(new T.TorusGeometry(radius, 0.035, 8, 192), copper);
            rail.rotation.x = Math.PI / 2;
            apparatus.add(rail);
        }
        for (let j = 0; j < 12; j++) {
            const points = [];
            const theta = j / 6 * Math.PI * 2;
            const shell = j < 6 ? 0.36 : 0.67;
            const radius = 3.25 + shell * Math.cos(theta);
            const y = shell * Math.sin(theta);
            for (let i = 0; i <= 192; i++) {
                const a = i / 192 * Math.PI * 2;
                points.push(new T.Vector3(radius * Math.cos(a), y, radius * Math.sin(a)));
            }
            fieldLines.add(new T.Line(new T.BufferGeometry().setFromPoints(points), fineLine));
            if (j % 3 === 0) {
                const a = j * 2.399;
                const arrow = new T.ArrowHelper(new T.Vector3(-Math.sin(a), 0, Math.cos(a)),
                    new T.Vector3(radius * Math.cos(a), y, radius * Math.sin(a)), 0.24, 0x66868e, 0.12, 0.075);
                fieldLines.add(arrow);
            }
        }
        const count = 18,
            history = 480,
            step = 1 / 120,
            playbackRate = 0.35;
        const particles = [];
        const trailPositions = new Float32Array(count * history * 6);
        const trailNext = new Float32Array(trailPositions.length);
        const trailColors = new Float32Array(trailPositions.length);
        const trailAlpha = new Float32Array(count * history * 2);
        const trailSides = new Float32Array(trailAlpha.length);
        const trailIndices = [];
        const teal = new T.Color(0x7da5ab);
        const copperTrail = new T.Color(0xb7977b);
        for (let i = 0; i < count; i++) {
            // Matched initial conditions make the effect of charge sign clear.
            const pair = Math.floor(i / 2);
            const a = pair / (count / 2) * Math.PI * 2;
            const r = 3.25 + 0.2 * Math.sin(pair * 2.4);
            const position = new T.Vector3(r * Math.cos(a), 0.2 * Math.cos(pair * 1.7), r * Math.sin(a));
            const phase = pair * 2.399;
            const velocity = new T.Vector3(-Math.sin(a) * 1.35 + Math.cos(a) * Math.cos(phase),
                Math.sin(phase), Math.cos(a) * 1.35 + Math.sin(a) * Math.cos(phase));
            const charge = i % 2 === 0 ? -1 : 1;
            const color = charge > 0 ? teal : copperTrail;
            particles.push({
                position,
                velocity,
                charge,
                initialVelocity: velocity.clone(),
                initialPosition: position.clone(),
                cursor: 0,
                age: 0,
                opacity: 0,
                retiring: false,
                history: Array.from({
                    length: history
                }, () => position.clone())
            });
            for (let j = 0; j < history; j++) {
                for (let k = 0; k < 2; k++) {
                    const index = (i * history + j) * 6 + k * 3;
                    color.toArray(trailColors, index);
                    trailSides[(i * history + j) * 2 + k] = k === 0 ? -1 : 1;
                }
                if (j < history - 1) {
                    const v = (i * history + j) * 2;
                    trailIndices.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
                }
            }
        }
        const trailsGeometry = new T.BufferGeometry();
        trailsGeometry.setAttribute('position', new T.BufferAttribute(trailPositions, 3).setUsage(T.DynamicDrawUsage));
        trailsGeometry.setAttribute('color', new T.BufferAttribute(trailColors, 3));
        trailsGeometry.setAttribute('nextPosition', new T.BufferAttribute(trailNext, 3).setUsage(T.DynamicDrawUsage));
        trailsGeometry.setAttribute('side', new T.BufferAttribute(trailSides, 1));
        trailsGeometry.setAttribute('trailAlpha', new T.BufferAttribute(trailAlpha, 1).setUsage(T.DynamicDrawUsage));
        trailsGeometry.setIndex(trailIndices);
        // Ordinary alpha blending bounds brightness at crossings. No luminous
        // point sprites, additive layers, pulsing, or automatic camera motion.
        const trails = new T.Mesh(trailsGeometry, new T.ShaderMaterial({
            vertexColors: true,
            transparent: true,
            depthWrite: false,
            side: T.DoubleSide,
            uniforms: { viewport: { value: new T.Vector2(1, 1) } },
            vertexShader: `attribute float trailAlpha;
                attribute vec3 nextPosition;
                attribute float side;
                uniform vec2 viewport;
                varying float alpha;
                varying vec3 tint;
                varying float edge;
                void main() {
                    alpha = trailAlpha;
                    tint = color;
                    edge = side;
                    vec4 current = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                    vec4 next = projectionMatrix * modelViewMatrix * vec4(nextPosition, 1.0);
                    vec2 delta = (next.xy / next.w - current.xy / current.w) * viewport;
                    vec2 normal = vec2(-delta.y, delta.x) / max(length(delta), 0.00001);
                    current.xy += normal * side * 2.4 / viewport * current.w;
                    gl_Position = current;
                }`,
            fragmentShader: `varying float alpha;
                varying vec3 tint;
                varying float edge;
                void main() {
                    float coverage = 1.0 - smoothstep(0.35, 1.0, abs(edge));
                    gl_FragColor = vec4(tint, alpha * coverage * 0.8);
                }`
        }));
        trails.frustumCulled = false;
        scene.add(trails);
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
        function integrate() {
            particles.forEach(p => advanceTrail(p, field, step));
        }

        for (let i = 0; i < history; i++) integrate();

        function draw() {
            particles.forEach((p, i) => {
                for (let j = 0; j < history; j++) {
                    const offset = (i * history + j) * 6;
                    const point = p.history[(p.cursor - j + history) % history];
                    const next = p.history[(p.cursor - Math.min(j + 1, history - 1) + history) % history];
                    point.toArray(trailPositions, offset);
                    point.toArray(trailPositions, offset + 3);
                    next.toArray(trailNext, offset);
                    next.toArray(trailNext, offset + 3);
                    const alphaIndex = (i * history + j) * 2;
                    trailAlpha[alphaIndex] = p.opacity * (1 - j / (history - 1)) ** 1.5;
                    trailAlpha[alphaIndex + 1] = trailAlpha[alphaIndex];
                }
            });
            trailsGeometry.attributes.position.needsUpdate = true;
            trailsGeometry.attributes.nextPosition.needsUpdate = true;
            trailsGeometry.attributes.trailAlpha.needsUpdate = true;
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
                accumulator += elapsed * playbackRate;
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
            updateReadouts();
        });
        on(container.querySelector('[data-field]'), 'click', e => {
            fieldLines.visible = !fieldLines.visible;
            e.currentTarget.setAttribute('aria-pressed', String(fieldLines.visible));
        });
        function updateReadouts() {
            container.querySelector('[data-current]').value = field.toFixed(1);
            container.querySelector('[data-inner-field]').value = (7 * field * 3.25 / (3.25 - 0.82)).toFixed(2);
            container.querySelector('[data-outer-field]').value = (7 * field * 3.25 / (3.25 + 0.82)).toFixed(2);
            container.querySelector('[data-radius]').value = (1 / (7 * field)).toFixed(3);
        }
        updateReadouts();
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
            camera.updateProjectionMatrix();
            renderer.setSize(width, height);
            trails.material.uniforms.viewport.value.set(width, height);
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
