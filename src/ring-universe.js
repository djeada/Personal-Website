(function() {
    'use strict';

    // ---------------------------------------------------------------------
    // Physics (pure, shared with tests/ring-physics.spec.js)
    // ---------------------------------------------------------------------

    // Air-core, densely wound ideal toroid: B_phi = B0 R / r, with |q/m| = 1.
    const MAJOR_RADIUS = 3.25;
    const TUBE_RADIUS = 0.82;
    const REFERENCE_FIELD = 7;

    function toroidalField(position, current = 1) {
        const scale = REFERENCE_FIELD * current * MAJOR_RADIUS / (position.x ** 2 + position.z ** 2);
        return {
            x: -position.z * scale,
            y: 0,
            z: position.x * scale
        };
    }

    // Boris rotation with leapfrog positions; no electric field or drag.
    // https://www.particleincell.com/2011/vxb-rotation/
    function advanceParticle(particle, magneticField, dt) {
        const v = particle.velocity;
        const half = particle.charge * dt / 2;
        const tx = magneticField.x * half,
            ty = magneticField.y * half,
            tz = magneticField.z * half;
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
        if ((Math.hypot(p.position.x, p.position.z) - MAJOR_RADIUS) ** 2 + p.position.y ** 2 > TUBE_RADIUS ** 2) {
            p.retiring = true;
        }
        p.age += dt;
        const fadeIn = Math.min(1, p.age / 0.7);
        p.opacity = fadeIn * fadeIn * (3 - 2 * fadeIn);
        p.cursor = (p.cursor + 1) % p.history.length;
        Object.assign(p.history[p.cursor], p.position);
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            toroidalField,
            advanceParticle,
            advanceTrail
        };
    }
    if (typeof window === 'undefined') return;

    // ---------------------------------------------------------------------
    // Scene description. Layout and styling live in 13_intro_page.css.
    // Every material is a small shader writing display colors directly, so
    // the scene needs no lights or tone mapping.
    // ---------------------------------------------------------------------

    const PARTICLE_COUNT = 18;
    const TRAIL_LENGTH = 480;
    const STEP = 1 / 120;
    const PLAYBACK_RATE = 0.35;
    const DEFAULT_VIEW = {
        yaw: 0.45,
        pitch: 0.5
    };
    const WINDING = {
        turns: 48,
        radius: 0.88,
        wire: 0.024,
        segments: 48 * 48
    };
    const EXTENT = {
        inner: MAJOR_RADIUS - WINDING.radius - WINDING.wire,
        outer: MAJOR_RADIUS + WINDING.radius + WINDING.wire,
        height: WINDING.radius + WINDING.wire
    };
    const COLORS = {
        positive: 0x3fe0d0,
        negative: 0xffa64d
    };

    const icon = paths => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths}</svg>`;
    const ICONS = {
        field: icon('<ellipse cx="12" cy="12" rx="9.5" ry="5"/><ellipse cx="12" cy="12" rx="5" ry="2.2"/>'),
        pause: icon('<path d="M9 6v12M15 6v12"/>'),
        play: icon('<path d="M8 5.5v13l10.5-6.5z"/>'),
        reset: icon('<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4.5v4h4"/>'),
        info: icon('<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6v.1"/>')
    };

    const MARKUP = `
      <div class="ring-lab__header">
        <div class="ring-lab__heading">
          <div class="ring-lab__title" role="heading" aria-level="3">Toroidal coil</div>
          <div class="ring-lab__equation" aria-label="Magnetic field equals mu zero N I over two pi r">B(r) = μ₀NI / 2πr</div>
        </div>
        <div class="ring-lab__legend"><span><i data-charge="positive"></i>Positive</span><span><i data-charge="negative"></i>Negative</span></div>
      </div>
      <div class="ring-lab__stage" data-stage></div>
      <div class="ring-lab__footer">
        <div class="ring-lab__bar">
          <div class="ring-lab__current">
            <span class="ring-lab__current-label">Current <output data-current></output></span>
            <span class="ring-lab__metrics" title="Field magnitude across the tube, and the reference gyroradius">B <output data-outer-field></output>–<output data-inner-field></output> · r<sub>L</sub> <output data-radius></output></span>
            <input aria-label="Coil current" type="range" min="0.4" max="2" step="0.1" value="1">
          </div>
          <div class="ring-lab__buttons">
            <button type="button" data-field aria-pressed="true" aria-label="Field lines" title="Field lines">${ICONS.field}</button>
            <button type="button" data-pause aria-pressed="false" aria-label="Pause" title="Pause"></button>
            <button type="button" data-reset aria-label="Reset view" title="Reset view">${ICONS.reset}</button>
            <details class="ring-lab__model"><summary aria-label="About the model" title="About the model">${ICONS.info}</summary><div class="ring-lab__model-body">
              <p>Charged particles in the field of an ideal toroidal coil. Opposite charges spiral in opposite directions; more current tightens the spiral. Field-line dashes move along B, faster where the field is stronger. Drag or use the arrow keys to orbit, + and − to zoom. Playback runs at 0.35×.</p>
              <p>dv/dt = (q/m) v × B. Normalized units: major radius R = 3.25, tube radius a = 0.82, reference field B₀ = 7, equal |q/m| = 1. The readout shows |B| at the outer and inner tube wall, and the gyroradius r<sub>L</sub> = v⊥ / (|q/m| B₀) with v⊥ = 1.</p>
              <p>A complete winding is modeled; its near side is drawn translucent to expose the field. Current selects a prescribed static field; induction, collisions and particle self-fields are omitted. Test particles drift out of a pure toroidal field, fade, and are reinjected.</p>
              <p><a href="https://openstax.org/books/university-physics-volume-2/pages/12-6-solenoids-and-toroids">Field model</a> · <a href="https://www.particleincell.com/2011/vxb-rotation/">Particle integration</a></p>
            </div></details>
          </div>
        </div>
      </div>`;

    const VIEW_VARYINGS_VERTEX = `varying vec3 viewNormal;
        varying vec3 viewPosition;
        varying float nearness;
        void setViewVaryings(float reach) {
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vec4 centre = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
            viewNormal = normalize(normalMatrix * normal);
            viewPosition = mv.xyz;
            nearness = (mv.z - centre.z) / reach;
            gl_Position = projectionMatrix * mv;
        }`;

    // Copper winding lit by a camera-fixed key light. The side facing the
    // viewer fades out, so the field region stays visible from every angle.
    function buildWinding(T) {
        const curve = new T.Curve();
        curve.getPoint = (t, target = new T.Vector3()) => {
            const a = t * Math.PI * 2;
            const b = a * WINDING.turns;
            const r = MAJOR_RADIUS + WINDING.radius * Math.cos(b);
            return target.set(r * Math.cos(a), WINDING.radius * Math.sin(b), r * Math.sin(a));
        };
        // The helix has nearly constant speed, so parameter and arc length agree.
        curve.getPointAt = curve.getPoint;
        curve.getTangentAt = curve.getTangent;
        const material = new T.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            uniforms: {
                reach: {
                    value: EXTENT.outer
                }
            },
            vertexShader: `uniform float reach;
                ${VIEW_VARYINGS_VERTEX}
                void main() { setViewVaryings(reach); }`,
            fragmentShader: `varying vec3 viewNormal;
                varying vec3 viewPosition;
                varying float nearness;
                void main() {
                    vec3 n = normalize(viewNormal);
                    vec3 v = normalize(-viewPosition);
                    vec3 l = normalize(vec3(-0.45, 0.8, 0.55));
                    vec3 copper = vec3(0.78, 0.43, 0.2);
                    float diffuse = 0.3 + 0.7 * max(dot(n, l), 0.0);
                    float specular = pow(max(dot(n, normalize(l + v)), 0.0), 40.0);
                    vec3 color = copper * diffuse + vec3(1.0, 0.84, 0.66) * specular * 0.75;
                    float alpha = mix(0.95, 0.12, smoothstep(-0.3, 0.7, nearness));
                    gl_FragColor = vec4(color, alpha);
                }`
        });
        const mesh = new T.Mesh(new T.TubeGeometry(curve, WINDING.segments, WINDING.wire, 6, true), material);
        mesh.renderOrder = 1;
        return mesh;
    }

    // Glass-like outline of the field region: transparent face-on, visible
    // only where the surface turns away from the viewer.
    function buildShell(T) {
        const material = new T.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            side: T.DoubleSide,
            uniforms: {
                reach: {
                    value: EXTENT.outer
                }
            },
            vertexShader: `uniform float reach;
                ${VIEW_VARYINGS_VERTEX}
                void main() { setViewVaryings(reach); }`,
            fragmentShader: `varying vec3 viewNormal;
                varying vec3 viewPosition;
                void main() {
                    float facing = abs(dot(normalize(viewNormal), normalize(-viewPosition)));
                    float edge = pow(1.0 - facing, 3.0);
                    gl_FragColor = vec4(0.4, 0.8, 0.82, 0.015 + edge * 0.2);
                }`
        });
        const mesh = new T.Mesh(new T.TorusGeometry(MAJOR_RADIUS, TUBE_RADIUS, 48, 192), material);
        mesh.rotation.x = Math.PI / 2;
        mesh.renderOrder = 0;
        return mesh;
    }

    // Circular field lines drawn as dashes travelling along B. Dash speed is
    // proportional to |B| = B0 R / r, so the inner side runs visibly faster.
    function buildFieldLines(T) {
        const segments = 256;
        const positions = [],
            arcs = [],
            dashes = [],
            rates = [];
        const lines = [
            [0, 0]
        ];
        for (let k = 0; k < 6; k++) lines.push([0.32, k / 6 * Math.PI * 2]);
        for (let k = 0; k < 8; k++) lines.push([0.62, (k + 0.5) / 8 * Math.PI * 2]);
        for (const [shell, theta] of lines) {
            const radius = MAJOR_RADIUS + shell * Math.cos(theta);
            const y = shell * Math.sin(theta);
            const count = Math.round(radius * 5);
            const rate = MAJOR_RADIUS * count / (2 * Math.PI * radius * radius);
            for (let i = 0; i < segments; i++) {
                for (const arc of [i / segments, (i + 1) / segments]) {
                    const a = arc * Math.PI * 2;
                    positions.push(radius * Math.cos(a), y, radius * Math.sin(a));
                    arcs.push(arc);
                    dashes.push(count);
                    rates.push(rate);
                }
            }
        }
        const geometry = new T.BufferGeometry();
        geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('arc', new T.Float32BufferAttribute(arcs, 1));
        geometry.setAttribute('dashes', new T.Float32BufferAttribute(dashes, 1));
        geometry.setAttribute('rate', new T.Float32BufferAttribute(rates, 1));
        const material = new T.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            uniforms: {
                time: {
                    value: 0
                }
            },
            vertexShader: `attribute float arc;
                attribute float dashes;
                attribute float rate;
                uniform float time;
                varying float phase;
                void main() {
                    phase = arc * dashes - time * rate;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }`,
            fragmentShader: `varying float phase;
                void main() {
                    float d = fract(phase);
                    float dash = smoothstep(0.0, 0.1, d) * (1.0 - smoothstep(0.32, 0.45, d));
                    gl_FragColor = vec4(0.62, 0.88, 0.9, 0.07 + 0.4 * dash);
                }`
        });
        const mesh = new T.LineSegments(geometry, material);
        mesh.renderOrder = 2;
        return {
            mesh,
            setTime(time) {
                material.uniforms.time.value = time;
            }
        };
    }

    function createParticles(T) {
        return Array.from({
            length: PARTICLE_COUNT
        }, (_, i) => {
            // Matched initial conditions make the effect of charge sign clear.
            const pair = Math.floor(i / 2);
            const a = pair / (PARTICLE_COUNT / 2) * Math.PI * 2;
            const r = MAJOR_RADIUS + 0.2 * Math.sin(pair * 2.4);
            const position = new T.Vector3(r * Math.cos(a), 0.2 * Math.cos(pair * 1.7), r * Math.sin(a));
            const phase = pair * 2.399;
            const velocity = new T.Vector3(-Math.sin(a) * 1.35 + Math.cos(a) * Math.cos(phase),
                Math.sin(phase), Math.cos(a) * 1.35 + Math.sin(a) * Math.cos(phase));
            return {
                position,
                velocity,
                charge: i % 2 === 0 ? -1 : 1,
                initialPosition: position.clone(),
                initialVelocity: velocity.clone(),
                cursor: 0,
                age: 0,
                opacity: 0,
                retiring: false,
                history: Array.from({
                    length: TRAIL_LENGTH
                }, () => position.clone())
            };
        });
    }

    const chargeColor = (T, p) => new T.Color(p.charge > 0 ? COLORS.positive : COLORS.negative);

    // Screen-space ribbons: each history sample becomes two vertices pushed
    // apart perpendicular to the projected direction of travel. Ordinary
    // alpha blending bounds brightness at crossings.
    function createTrails(T, particles) {
        const vertexCount = particles.length * TRAIL_LENGTH * 2;
        const positions = new Float32Array(vertexCount * 3);
        const nextPositions = new Float32Array(vertexCount * 3);
        const colors = new Float32Array(vertexCount * 3);
        const alphas = new Float32Array(vertexCount);
        const sides = new Float32Array(vertexCount);
        const indices = [];
        particles.forEach((p, i) => {
            const color = chargeColor(T, p);
            for (let j = 0; j < TRAIL_LENGTH; j++) {
                const v = (i * TRAIL_LENGTH + j) * 2;
                color.toArray(colors, v * 3);
                color.toArray(colors, v * 3 + 3);
                sides[v] = -1;
                sides[v + 1] = 1;
                if (j < TRAIL_LENGTH - 1) indices.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
            }
        });
        const geometry = new T.BufferGeometry();
        const dynamic = (array, size) => new T.BufferAttribute(array, size).setUsage(T.DynamicDrawUsage);
        geometry.setAttribute('position', dynamic(positions, 3));
        geometry.setAttribute('nextPosition', dynamic(nextPositions, 3));
        geometry.setAttribute('trailAlpha', dynamic(alphas, 1));
        geometry.setAttribute('color', new T.BufferAttribute(colors, 3));
        geometry.setAttribute('side', new T.BufferAttribute(sides, 1));
        geometry.setIndex(indices);
        const material = new T.ShaderMaterial({
            vertexColors: true,
            transparent: true,
            depthWrite: false,
            side: T.DoubleSide,
            uniforms: {
                viewport: {
                    value: new T.Vector2(1, 1)
                },
                lineWidth: {
                    value: 3
                }
            },
            vertexShader: `attribute float trailAlpha;
                attribute vec3 nextPosition;
                attribute float side;
                uniform vec2 viewport;
                uniform float lineWidth;
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
                    current.xy += normal * side * lineWidth * (0.45 + 0.55 * alpha) / viewport * current.w;
                    gl_Position = current;
                }`,
            fragmentShader: `varying float alpha;
                varying vec3 tint;
                varying float edge;
                void main() {
                    float coverage = 1.0 - smoothstep(0.35, 1.0, abs(edge));
                    gl_FragColor = vec4(tint * (0.8 + 0.5 * alpha), alpha * coverage * 0.95);
                }`
        });
        const mesh = new T.Mesh(geometry, material);
        mesh.frustumCulled = false;
        mesh.renderOrder = 3;
        return {
            mesh,
            resize(width, height) {
                material.uniforms.viewport.value.set(width, height);
                material.uniforms.lineWidth.value = width < 600 ? 2.8 : 3.4;
            },
            update() {
                particles.forEach((p, i) => {
                    for (let j = 0; j < TRAIL_LENGTH; j++) {
                        const v = (i * TRAIL_LENGTH + j) * 2;
                        const point = p.history[(p.cursor - j + TRAIL_LENGTH) % TRAIL_LENGTH];
                        const next = p.history[(p.cursor - Math.min(j + 1, TRAIL_LENGTH - 1) + TRAIL_LENGTH) % TRAIL_LENGTH];
                        point.toArray(positions, v * 3);
                        point.toArray(positions, v * 3 + 3);
                        next.toArray(nextPositions, v * 3);
                        next.toArray(nextPositions, v * 3 + 3);
                        alphas[v] = alphas[v + 1] = p.opacity * (1 - j / (TRAIL_LENGTH - 1)) ** 1.15;
                    }
                });
                geometry.attributes.position.needsUpdate = true;
                geometry.attributes.nextPosition.needsUpdate = true;
                geometry.attributes.trailAlpha.needsUpdate = true;
            }
        };
    }

    // Round head on each trail, faded with the trail so reinjection never pops.
    function createHeads(T, particles) {
        const positions = new Float32Array(particles.length * 3);
        const colors = new Float32Array(particles.length * 3);
        const alphas = new Float32Array(particles.length);
        particles.forEach((p, i) => chargeColor(T, p).toArray(colors, i * 3));
        const geometry = new T.BufferGeometry();
        geometry.setAttribute('position', new T.BufferAttribute(positions, 3).setUsage(T.DynamicDrawUsage));
        geometry.setAttribute('headAlpha', new T.BufferAttribute(alphas, 1).setUsage(T.DynamicDrawUsage));
        geometry.setAttribute('color', new T.BufferAttribute(colors, 3));
        const material = new T.ShaderMaterial({
            vertexColors: true,
            transparent: true,
            depthWrite: false,
            uniforms: {
                size: {
                    value: 9
                }
            },
            vertexShader: `attribute float headAlpha;
                uniform float size;
                varying float alpha;
                varying vec3 tint;
                void main() {
                    alpha = headAlpha;
                    tint = color;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = size;
                }`,
            fragmentShader: `varying float alpha;
                varying vec3 tint;
                void main() {
                    float r = length(gl_PointCoord * 2.0 - 1.0);
                    if (r > 1.0) discard;
                    vec3 core = mix(tint, vec3(1.0), 0.65 * (1.0 - smoothstep(0.0, 0.5, r)));
                    gl_FragColor = vec4(core, alpha * (1.0 - smoothstep(0.55, 1.0, r)));
                }`
        });
        const points = new T.Points(geometry, material);
        points.frustumCulled = false;
        points.renderOrder = 4;
        return {
            points,
            resize(width, pixelRatio) {
                material.uniforms.size.value = (width < 600 ? 7 : 9) * pixelRatio;
            },
            update() {
                particles.forEach((p, i) => {
                    p.position.toArray(positions, i * 3);
                    alphas[i] = p.retiring ? 0 : p.opacity;
                });
                geometry.attributes.position.needsUpdate = true;
                geometry.attributes.headAlpha.needsUpdate = true;
            }
        };
    }

    // Projected extent of the apparatus for a camera at the given distance and
    // pitch looking at the origin, in units of the focal length. The apparatus
    // is rotationally symmetric, so yaw does not matter.
    function silhouette(distance, pitch) {
        const sin = Math.sin(pitch),
            cos = Math.cos(pitch);
        let halfWidth = 0,
            top = -Infinity,
            bottom = Infinity;
        for (let k = 0; k < 32; k++) {
            const a = k / 32 * Math.PI * 2;
            for (const radius of [EXTENT.inner, EXTENT.outer]) {
                for (const y of [-EXTENT.height, EXTENT.height]) {
                    const x = radius * Math.cos(a),
                        z = radius * Math.sin(a);
                    const depth = distance - (y * sin + z * cos);
                    const screenY = (y * cos - z * sin) / depth;
                    halfWidth = Math.max(halfWidth, Math.abs(x) / depth);
                    top = Math.max(top, screenY);
                    bottom = Math.min(bottom, screenY);
                }
            }
        }
        return {
            halfWidth,
            halfHeight: (top - bottom) / 2,
            center: (top + bottom) / 2
        };
    }

    // Smallest distance at which the silhouette fits the given half extents.
    function fittingDistance(pitch, halfWidth, halfHeight) {
        let near = 5,
            far = 80;
        for (let i = 0; i < 20; i++) {
            const middle = (near + far) / 2;
            const extent = silhouette(middle, pitch);
            if (extent.halfWidth <= halfWidth && extent.halfHeight <= halfHeight) far = middle;
            else near = middle;
        }
        return far;
    }

    window.createRingUniverseSimulation = function(container) {
        if (!container || !window.THREE) return null;
        const T = window.THREE;
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        const renderer = new T.WebGLRenderer({
            antialias: true,
            alpha: true
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

        container.classList.add('ring-lab');
        container.innerHTML = MARKUP;
        const canvas = renderer.domElement;
        canvas.tabIndex = 0;
        canvas.setAttribute('role', 'img');
        canvas.setAttribute('aria-label', 'Interactive toroidal magnetic field with charged particle trajectories. Drag or use arrow keys to orbit, plus and minus to zoom.');
        container.prepend(canvas);
        const stage = container.querySelector('[data-stage]');

        const scene = new T.Scene();
        const fieldLines = buildFieldLines(T);
        const particles = createParticles(T);
        const trails = createTrails(T, particles);
        const heads = createHeads(T, particles);
        scene.add(buildShell(T), buildWinding(T), fieldLines.mesh, trails.mesh, heads.points);
        const camera = new T.PerspectiveCamera(36, 1, 0.1, 100);

        const view = {
            yaw: DEFAULT_VIEW.yaw,
            pitch: DEFAULT_VIEW.pitch,
            targetYaw: DEFAULT_VIEW.yaw,
            targetPitch: DEFAULT_VIEW.pitch,
            zoom: 1,
            width: 1,
            height: 1,
            focal: 1,
            stageX: 0.5,
            stageY: 0.5,
            stageHalfWidth: 0.5,
            stageHalfHeight: 0.5
        };
        let current = 1,
            fieldTime = 0,
            paused = reducedMotion.matches,
            visible = false,
            disposed = false,
            dragging = null,
            previous = 0,
            accumulator = 0,
            raf;

        function integrate() {
            particles.forEach(p => advanceTrail(p, current, STEP));
            fieldTime += STEP * current;
        }
        for (let i = 0; i < TRAIL_LENGTH; i++) integrate();

        // Keep the apparatus framed inside the stage element, which is the
        // space the header and footer leave free, at every container size.
        function placeCamera() {
            view.yaw += (view.targetYaw - view.yaw) * 0.12;
            view.pitch += (view.targetPitch - view.pitch) * 0.12;
            const distance = view.zoom * fittingDistance(view.pitch,
                view.stageHalfWidth / view.focal, view.stageHalfHeight / view.focal);
            const lift = silhouette(distance, view.pitch).center * view.focal;
            camera.setViewOffset(view.width, view.height,
                view.width / 2 - view.stageX, view.height / 2 - view.stageY - lift, view.width, view.height);
            camera.position.set(distance * Math.cos(view.pitch) * Math.sin(view.yaw), distance * Math.sin(view.pitch),
                distance * Math.cos(view.pitch) * Math.cos(view.yaw));
            camera.lookAt(0, 0, 0);
        }

        function draw() {
            trails.update();
            heads.update();
            fieldLines.setTime(fieldTime);
            placeCamera();
            renderer.render(scene, camera);
        }

        function frame(now) {
            if (disposed) return;
            raf = requestAnimationFrame(frame);
            const elapsed = previous ? Math.min((now - previous) / 1000, 0.05) : 0;
            previous = now;
            if (!visible || document.hidden) return;
            if (!paused) {
                accumulator += elapsed * PLAYBACK_RATE;
                while (accumulator >= STEP) {
                    integrate();
                    accumulator -= STEP;
                }
            }
            draw();
        }

        function resize() {
            const width = Math.max(container.clientWidth, 1),
                height = Math.max(container.clientHeight, 1);
            Object.assign(view, {
                width,
                height,
                focal: height / 2 / Math.tan(camera.fov * Math.PI / 360),
                stageX: stage.offsetLeft + stage.offsetWidth / 2,
                stageY: stage.offsetTop + stage.offsetHeight / 2,
                stageHalfWidth: Math.max(stage.offsetWidth, 120) * 0.47,
                stageHalfHeight: Math.max(stage.offsetHeight, 120) * 0.47
            });
            renderer.setSize(width, height, false);
            trails.resize(width, height);
            heads.resize(width, renderer.getPixelRatio());
            draw();
        }

        const listeners = [];

        function on(target, event, handler) {
            target.addEventListener(event, handler);
            listeners.push(() => target.removeEventListener(event, handler));
        }
        const clampPitch = pitch => Math.max(0.12, Math.min(1.4, pitch));
        const clampZoom = zoom => Math.max(0.6, Math.min(1.6, zoom));

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
            view.targetYaw -= (e.clientX - dragging.x) * 0.008;
            view.targetPitch = clampPitch(view.targetPitch + (e.clientY - dragging.y) * 0.006);
            dragging.x = e.clientX;
            dragging.y = e.clientY;
        });
        ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(event => on(canvas, event, () => {
            dragging = null;
        }));
        on(canvas, 'keydown', e => {
            if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-'].includes(e.key)) return;
            e.preventDefault();
            if (e.key === 'ArrowLeft') view.targetYaw -= 0.15;
            if (e.key === 'ArrowRight') view.targetYaw += 0.15;
            if (e.key === 'ArrowUp') view.targetPitch = clampPitch(view.targetPitch + 0.1);
            if (e.key === 'ArrowDown') view.targetPitch = clampPitch(view.targetPitch - 0.1);
            if (e.key === '+' || e.key === '=') view.zoom = clampZoom(view.zoom - 0.1);
            if (e.key === '-') view.zoom = clampZoom(view.zoom + 0.1);
        });

        // The pause toggle keeps a constant name; aria-pressed carries its state.
        const pause = container.querySelector('[data-pause]');

        function updatePause() {
            pause.innerHTML = paused ? ICONS.play : ICONS.pause;
            pause.setAttribute('aria-pressed', String(paused));
            pause.title = paused ? 'Resume' : 'Pause';
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

        function updateReadouts() {
            container.querySelector('[data-current]').value = `${current.toFixed(1)}×`;
            container.querySelector('[data-inner-field]').value = (REFERENCE_FIELD * current * MAJOR_RADIUS / (MAJOR_RADIUS - TUBE_RADIUS)).toFixed(2);
            container.querySelector('[data-outer-field]').value = (REFERENCE_FIELD * current * MAJOR_RADIUS / (MAJOR_RADIUS + TUBE_RADIUS)).toFixed(2);
            container.querySelector('[data-radius]').value = (1 / (REFERENCE_FIELD * current)).toFixed(3);
        }
        updateReadouts();
        on(container.querySelector('input'), 'input', e => {
            current = Number(e.target.value);
            updateReadouts();
        });
        on(container.querySelector('[data-field]'), 'click', e => {
            fieldLines.mesh.visible = !fieldLines.mesh.visible;
            e.currentTarget.setAttribute('aria-pressed', String(fieldLines.mesh.visible));
        });
        on(container.querySelector('[data-reset]'), 'click', () => {
            view.targetYaw = DEFAULT_VIEW.yaw;
            view.targetPitch = DEFAULT_VIEW.pitch;
            view.zoom = 1;
        });

        const resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(container);
        resizeObserver.observe(stage);
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
                scene.traverse(object => {
                    if (object.geometry) object.geometry.dispose();
                    if (object.material) object.material.dispose();
                });
                renderer.dispose();
                container.replaceChildren();
                container.classList.remove('ring-lab');
            }
        };
    };
})();