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

    // Styles are injected once so the script is self-contained.
    const STYLE_ID = 'ring-lab-style';
    const STYLES = `
.ring-lab{--bg:#101820;--panel:rgba(16,24,32,.78);--line:rgba(125,165,171,.22);--text:#e6eef0;--muted:#8ea3a8;--teal:#3fe0d0;--copper:#ffa64d;
  position:relative;min-height:640px;overflow:hidden;border-radius:14px;
  background:radial-gradient(120% 90% at 50% 100%,#172431 0%,var(--bg) 70%);
  color:var(--text);font:14px/1.45 "Inter","Segoe UI",system-ui,sans-serif}
.ring-lab *{font-family:inherit;box-sizing:border-box}
.ring-lab output{font:inherit}
.ring-lab__equation{font-family:Georgia,"Times New Roman",serif;font-style:italic}
.ring-lab canvas{position:absolute;inset:0;width:100%!important;height:100%!important;display:block;outline:none;cursor:grab}
.ring-lab canvas:active{cursor:grabbing}
.ring-lab canvas:focus-visible{box-shadow:inset 0 0 0 2px var(--teal)}
.ring-lab>:not(canvas){position:absolute;z-index:2;pointer-events:none}
.ring-lab>:not(canvas) button,.ring-lab>:not(canvas) input,.ring-lab>:not(canvas) a,.ring-lab>:not(canvas) summary,.ring-lab details[open]{pointer-events:auto}
.ring-lab__heading{top:28px;left:28px;max-width:320px}
.ring-lab__eyebrow{display:block;margin-bottom:10px;font-size:11px;letter-spacing:.06em;color:var(--muted)}
.ring-lab__heading h3{margin:0 0 6px;font-size:34px;font-weight:600;line-height:1.1;letter-spacing:-.01em}
.ring-lab__heading p{margin:0;color:var(--muted)}
.ring-lab__equation{top:28px;right:28px;text-align:right;font-size:22px;font-variant-numeric:tabular-nums}
.ring-lab__equation span{display:block;margin-top:6px;font-size:11px;letter-spacing:.04em;color:var(--muted)}
.ring-lab__metrics{left:28px;top:50%;transform:translateY(-50%);display:grid;gap:14px}
.ring-lab__metrics div{padding-left:12px;border-left:2px solid var(--line)}
.ring-lab__metrics span{display:block;font-size:11px;letter-spacing:.04em;color:var(--muted)}
.ring-lab__metrics output{display:block;font-size:22px;font-variant-numeric:tabular-nums}
.ring-lab__readout{left:28px;right:28px;bottom:112px;display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px 24px;font-size:12px;color:var(--muted)}
.ring-lab__readout i{display:inline-block;width:10px;height:10px;box-shadow:0 0 8px var(--teal);margin-right:6px;border-radius:50%;vertical-align:-1px;background:linear-gradient(90deg,var(--teal) 50%,var(--copper) 50%)}
.ring-lab__controls{left:28px;right:28px;bottom:28px;display:flex;align-items:center;justify-content:space-between;gap:20px;padding:14px 18px;border:1px solid var(--line);border-radius:10px;background:var(--panel);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
.ring-lab__controls label{flex:1 1 260px;display:grid;grid-template-columns:auto auto;justify-content:space-between;align-items:center;gap:6px 12px;font-size:12px;color:var(--muted)}
.ring-lab__controls label>span{color:var(--text);font-variant-numeric:tabular-nums}
.ring-lab__controls input[type=range]{grid-column:1/-1;width:100%;margin:0;accent-color:var(--teal)}
.ring-lab__controls>div{display:flex;gap:8px;flex-wrap:wrap}
.ring-lab__controls button{padding:8px 14px;border:1px solid var(--line);border-radius:6px;background:transparent;color:var(--text);font:inherit;font-size:13px;cursor:pointer;transition:background-color 120ms,border-color 120ms}
.ring-lab__controls button:hover{background:rgba(125,165,171,.12)}
.ring-lab__controls button[aria-pressed=true]{border-color:var(--teal);background:rgba(125,165,171,.18)}
.ring-lab__controls button:focus-visible,.ring-lab__controls input:focus-visible,.ring-lab__model summary:focus-visible{outline:2px solid var(--teal);outline-offset:2px}
.ring-lab__model{right:28px;top:96px;max-width:380px;text-align:right;z-index:3;font-size:12px;color:var(--muted)}
.ring-lab__model summary{display:inline-block;padding:6px 10px;border:1px solid var(--line);border-radius:6px;color:var(--text);cursor:pointer;list-style:none}
.ring-lab__model summary::-webkit-details-marker{display:none}
.ring-lab__model[open]{padding:14px 16px;border:1px solid var(--line);border-radius:10px;background:var(--panel);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
.ring-lab__model[open] summary{border-color:var(--teal)}
.ring-lab__model p{margin:10px 0 0;line-height:1.5;text-align:left}
.ring-lab__model a{color:var(--teal);text-decoration:underline;text-underline-offset:2px}
@media(max-width:720px){
  .ring-lab{min-height:720px;font-size:13px}
  .ring-lab__heading,.ring-lab__equation,.ring-lab__metrics,.ring-lab__readout,.ring-lab__controls,.ring-lab__model{left:16px;right:16px}
  .ring-lab__heading{top:16px;max-width:none}
  .ring-lab__heading h3{font-size:24px}
  .ring-lab__equation{top:auto;bottom:200px;text-align:left;font-size:18px}
  .ring-lab__metrics{top:118px;transform:none;grid-template-columns:repeat(3,1fr);gap:10px}
  .ring-lab__metrics output{font-size:17px}
  .ring-lab__readout{bottom:150px}
  .ring-lab__model{top:auto;bottom:150px;left:auto}
  .ring-lab__controls{bottom:16px;flex-direction:column;align-items:stretch}
}
@media(prefers-reduced-motion:reduce){.ring-lab__controls button{transition:none}}`;

    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = STYLES;
        document.head.appendChild(style);
    }

    window.createRingUniverseSimulation = function(container) {
        if (!container || !window.THREE) return null;
        injectStyles();
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
        renderer.toneMappingExposure = 1.15;
        container.classList.add('ring-lab');
        container.innerHTML = `
          <div class="ring-lab__heading"><span class="ring-lab__eyebrow">Field atlas</span><h3>The toroidal field.</h3><p>Follow the geometry of a magnetic force.</p></div>
          <div class="ring-lab__equation" aria-label="Magnetic field equals mu zero N I over two pi r">B(r) = μ₀NI / 2πr<span>Ideal air core, winding shown in cutaway</span></div>
          <div class="ring-lab__metrics"><div><span>Inner field</span><output data-inner-field></output></div><div><span>Outer field</span><output data-outer-field></output></div><div><span>Reference gyroradius</span><output data-radius></output></div></div>
          <div class="ring-lab__readout"><span><i></i> Teal is positive charge, copper is negative</span><span>Opposite charges spiral in opposite directions. Stronger fields tighten the spiral.</span></div>
          <div class="ring-lab__controls"><label>Coil current <span><output data-current>1.0</output> ×</span><input aria-label="Coil current" type="range" min="0.4" max="2" step="0.1" value="1"></label><div><button type="button" data-field aria-pressed="true">Field lines</button><button type="button" data-pause>Pause</button><button type="button" data-reset>Reset view</button></div></div>
          <details class="ring-lab__model"><summary>Controls &amp; physical model</summary><p>Drag to orbit. Arrow keys rotate, + and − zoom. Playback runs at 0.35×.</p><p>dv/dt = (q/m) v × B. Normalized units: major radius R = 3.25, tube radius a = 0.82, reference field B₀ = 7, equal |q/m| = 1. The reference gyroradius is v⊥ / (|q/m| B₀), with v⊥ = 1.</p><p>A complete winding is modeled; its front half is omitted to expose the field. Current selects a prescribed static field; induction, collisions and particle self-fields are omitted. Test particles drift out of a pure toroidal field, fade, and are reinjected.</p><p><a href="https://openstax.org/books/university-physics-volume-2/pages/12-6-solenoids-and-toroids">Field model</a> · <a href="https://www.particleincell.com/2011/vxb-rotation/">Particle integration</a></p></details>`;
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
        light(0xe4f3ff, 2.2, -3, 8, 5);
        light(0x51bacc, 1.6, 4, -2, -4);
        light(0xffc98a, 1.4, -6, 1, -2);
        light(0x9fd8ff, 0.9, 0, -6, 3);
        const apparatus = new T.Group();
        scene.add(apparatus);
        const fieldLines = new T.Group();
        scene.add(fieldLines);
        const copper = new T.MeshStandardMaterial({
            color: 0xc9702f,
            emissive: 0x3a1a08,
            transparent: true,
            opacity: 0.92,
            depthWrite: false,
            metalness: 0.75,
            roughness: 0.3
        });
        const fineLine = new T.LineBasicMaterial({
            color: 0x8fd3dc,
            transparent: true,
            opacity: 0.32,
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
            color: 0x2e8a96,
            emissive: 0x0d2a30,
            transparent: true,
            opacity: 0.28,
            shininess: 40,
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
                    new T.Vector3(radius * Math.cos(a), y, radius * Math.sin(a)), 0.3, 0x8fd3dc, 0.16, 0.09);
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
        const teal = new T.Color(0x3fe0d0);
        const copperTrail = new T.Color(0xffa64d);
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
                    current.xy += normal * side * 3.4 / viewport * current.w;
                    gl_Position = current;
                }`,
            fragmentShader: `varying float alpha;
                varying vec3 tint;
                varying float edge;
                void main() {
                    float coverage = 1.0 - smoothstep(0.35, 1.0, abs(edge));
                    gl_FragColor = vec4(tint * (0.85 + 0.45 * alpha), alpha * coverage * 0.95);
                }`
        }));
        trails.frustumCulled = false;
        scene.add(trails);
        // Bright head on each trail so the motion reads at a glance.
        const headPositions = new Float32Array(count * 3);
        const headColors = new Float32Array(count * 3);
        particles.forEach((p, i) => (p.charge > 0 ? teal : copperTrail).toArray(headColors, i * 3));
        const headGeometry = new T.BufferGeometry();
        headGeometry.setAttribute('position', new T.BufferAttribute(headPositions, 3).setUsage(T.DynamicDrawUsage));
        headGeometry.setAttribute('color', new T.BufferAttribute(headColors, 3));
        const heads = new T.Points(headGeometry, new T.PointsMaterial({
            size: 9, sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false
        }));
        heads.frustumCulled = false;
        scene.add(heads);
        // Soft glow beneath the apparatus.
        const glowCanvas = document.createElement('canvas');
        glowCanvas.width = glowCanvas.height = 256;
        const g = glowCanvas.getContext('2d');
        const grad = g.createRadialGradient(128, 128, 20, 128, 128, 128);
        grad.addColorStop(0, 'rgba(63,224,208,0.35)');
        grad.addColorStop(0.55, 'rgba(63,224,208,0.08)');
        grad.addColorStop(1, 'rgba(63,224,208,0)');
        g.fillStyle = grad;
        g.fillRect(0, 0, 256, 256);
        const glow = new T.Mesh(new T.PlaneGeometry(13, 13), new T.MeshBasicMaterial({
            map: new T.CanvasTexture(glowCanvas), transparent: true, depthWrite: false
        }));
        glow.rotation.x = -Math.PI / 2;
        glow.position.y = -1.6;
        glow.renderOrder = -2;
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
                    trailAlpha[alphaIndex] = p.opacity * (1 - j / (history - 1)) ** 1.15;
                    trailAlpha[alphaIndex + 1] = trailAlpha[alphaIndex];
                }
            });
            trailsGeometry.attributes.position.needsUpdate = true;
            trailsGeometry.attributes.nextPosition.needsUpdate = true;
            trailsGeometry.attributes.trailAlpha.needsUpdate = true;
            particles.forEach((p, i) => {
                headPositions[i * 3] = p.position.x;
                headPositions[i * 3 + 1] = p.retiring ? 1e4 : p.position.y;
                headPositions[i * 3 + 2] = p.position.z;
            });
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