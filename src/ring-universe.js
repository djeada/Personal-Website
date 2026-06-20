(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const DESTINATIONS = [
    { label: 'Projects', href: 'core/projects.html', color: 0x8ef6ff, angle: -0.95 },
    { label: 'Tools', href: 'core/tools.html', color: 0xffb36a, angle: -0.42 },
    { label: 'Blog', href: 'core/blog.html', color: 0xd5b4ff, angle: 0.1 },
    { label: 'Courses', href: 'core/courses.html', color: 0xa7f3d0, angle: 0.62 },
    { label: 'Resume', href: 'core/resume.html', color: 0xff8fb3, angle: 1.12 }
  ];

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function pick(list) {
    return list[(Math.random() * list.length) | 0];
  }

  function setColorAttribute(array, index, color, strength) {
    const offset = index * 3;
    array[offset] = color.r * strength;
    array[offset + 1] = color.g * strength;
    array[offset + 2] = color.b * strength;
  }

  function injectStyles() {
    if (document.getElementById('ring-universe-immersive-styles')) return;
    const style = document.createElement('style');
    style.id = 'ring-universe-immersive-styles';
    style.textContent = `
      .ring-universe-shell {
        position: relative;
        overflow: hidden;
        isolation: isolate;
        background: #03030a;
        cursor: grab;
        touch-action: none;
        user-select: none;
      }
      .ring-universe-shell.is-dragging { cursor: grabbing; }
      .ring-universe-shell canvas {
        display: block;
        width: 100%;
        height: 100%;
        outline: none;
      }
      .ring-universe-vignette,
      .ring-universe-grain,
      .ring-universe-hud {
        position: absolute;
        inset: 0;
        pointer-events: none;
      }
      .ring-universe-vignette {
        z-index: 3;
        background:
          radial-gradient(circle at 50% 45%, transparent 0%, transparent 46%, rgba(2, 2, 8, 0.24) 70%, rgba(0, 0, 0, 0.84) 100%),
          linear-gradient(180deg, rgba(120, 120, 255, 0.05), rgba(255, 70, 30, 0.025));
        mix-blend-mode: screen;
      }
      .ring-universe-grain {
        z-index: 4;
        opacity: .12;
        background-image:
          repeating-radial-gradient(circle at 17% 23%, rgba(255,255,255,.09) 0 1px, transparent 1px 4px),
          repeating-linear-gradient(115deg, rgba(255,255,255,.04) 0 1px, transparent 1px 7px);
        mix-blend-mode: overlay;
      }
      .ring-universe-hud {
        z-index: 5;
        inset: auto 18px 18px 18px;
        display: flex;
        align-items: end;
        justify-content: space-between;
        gap: 14px;
        font: 500 11px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        letter-spacing: .08em;
        text-transform: uppercase;
        color: rgba(235, 245, 255, .78);
        text-shadow: 0 0 18px rgba(125, 245, 255, .35);
        transition: opacity .7s ease, transform .7s ease;
      }
      .ring-universe-hud.is-muted { opacity: .28; transform: translateY(4px); }
      .ring-universe-hud.is-hidden { opacity: 0; }
      .ring-universe-hud__panel {
        max-width: min(520px, 72vw);
        padding: 11px 13px;
        border: 1px solid rgba(165, 210, 255, .18);
        border-radius: 14px;
        background: linear-gradient(180deg, rgba(10, 12, 26, .66), rgba(5, 6, 13, .34));
        box-shadow: 0 10px 36px rgba(0, 0, 0, .28), inset 0 1px rgba(255,255,255,.08);
        backdrop-filter: blur(10px);
      }
      .ring-universe-hud__status {
        white-space: nowrap;
        padding: 11px 13px;
        border-radius: 999px;
        border: 1px solid rgba(160, 255, 250, .18);
        background: rgba(4, 9, 18, .48);
        box-shadow: inset 0 1px rgba(255,255,255,.08);
      }
      .ring-universe-charge {
        display: inline-block;
        width: 72px;
        height: 3px;
        margin-left: 8px;
        vertical-align: 2px;
        border-radius: 999px;
        background: rgba(255, 255, 255, .15);
        overflow: hidden;
      }
      .ring-universe-charge > i {
        display: block;
        height: 100%;
        width: var(--charge, 0%);
        border-radius: inherit;
        background: linear-gradient(90deg, rgba(125,245,255,.85), rgba(255,142,68,.9));
        box-shadow: 0 0 14px rgba(125,245,255,.75);
      }
      @media (max-width: 760px) {
        .ring-universe-hud {
          inset: auto 12px 12px 12px;
          font-size: 9px;
          align-items: stretch;
          flex-direction: column;
        }
        .ring-universe-hud__panel { max-width: none; }
        .ring-universe-hud__status { align-self: flex-start; }
      }
    `;
    document.head.appendChild(style);
  }

  function createRadialTexture(size, stops) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    stops.forEach((stop) => gradient.addColorStop(stop[0], stop[1]));
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
  }

  function createPointTexture() {
    return createRadialTexture(128, [
      [0.00, 'rgba(255,255,255,1)'],
      [0.18, 'rgba(255,248,224,.95)'],
      [0.45, 'rgba(155,205,255,.35)'],
      [1.00, 'rgba(0,0,0,0)']
    ]);
  }

  function createSmokeTexture() {
    return createRadialTexture(192, [
      [0.00, 'rgba(255,255,255,.55)'],
      [0.25, 'rgba(216,190,255,.28)'],
      [0.62, 'rgba(80,155,210,.10)'],
      [1.00, 'rgba(0,0,0,0)']
    ]);
  }

  function createStrokeTexture() {
    return createRadialTexture(96, [
      [0.00, 'rgba(255,255,255,.96)'],
      [0.22, 'rgba(160,255,250,.64)'],
      [0.62, 'rgba(120,80,255,.12)'],
      [1.00, 'rgba(0,0,0,0)']
    ]);
  }

  function createLabelTexture(text, color) {
    const canvas = document.createElement('canvas');
    canvas.width = 384;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const hex = `#${color.toString(16).padStart(6, '0')}`;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.shadowColor = hex;
    ctx.shadowBlur = 22;
    ctx.strokeStyle = 'rgba(255,255,255,.34)';
    ctx.lineWidth = 2;
    ctx.fillStyle = 'rgba(4,6,18,.58)';
    if (ctx.roundRect) {
      ctx.roundRect(22, 26, 340, 76, 14);
    } else {
      ctx.rect(22, 26, 340, 76);
    }
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 12;
    ctx.fillStyle = hex;
    ctx.font = '700 38px Inter, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 192, 64);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    return texture;
  }

  function makePortalMaterial(colors) {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uPulse: { value: 0 },
        uCharge: { value: 0 },
        uPointer: { value: new THREE.Vector2(0.5, 0.5) },
        uPortal: { value: new THREE.Color(colors.portal) },
        uRune: { value: new THREE.Color(colors.rune) },
        uEmber: { value: new THREE.Color(colors.ember) },
        uVoid: { value: new THREE.Color(colors.background) }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        varying vec2 vUv;
        uniform float uTime;
        uniform float uPulse;
        uniform float uCharge;
        uniform vec2 uPointer;
        uniform vec3 uPortal;
        uniform vec3 uRune;
        uniform vec3 uEmber;
        uniform vec3 uVoid;

        float hash(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }

        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          float a = hash(i);
          float b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0));
          float d = hash(i + vec2(1.0, 1.0));
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
        }

        void main() {
          vec2 p = vUv - 0.5;
          float r = length(p) * 2.0;
          if (r > 1.0) discard;

          float a = atan(p.y, p.x);
          float spiral = sin(a * 9.0 - r * 18.0 + uTime * 2.35);
          float spiral2 = sin(a * -15.0 + r * 28.0 - uTime * 1.65);
          float rings = sin(r * 62.0 - uTime * 3.0 + spiral * 0.75);
          float grain = noise(vec2(a * 3.0, r * 9.0 - uTime * .45));

          float pointerPull = 1.0 - smoothstep(0.0, 0.62, distance(vUv, uPointer));
          float rim = smoothstep(.82, 1.0, r);
          float core = 1.0 - smoothstep(.0, .38 + uPulse * .07, r);
          float veil = (1.0 - smoothstep(.2, 1.0, r)) * (.28 + .32 * grain);
          float filament = smoothstep(.72, 1.0, abs(spiral)) * (1.0 - r);
          float glyph = smoothstep(.94, .99, abs(rings)) * smoothstep(.25, .98, r);

          vec3 color = mix(uPortal, uRune, .26 + .25 * spiral);
          color = mix(color, uEmber, .20 * spiral2 + .28 * uPulse + .22 * uCharge);
          color += uPortal * pointerPull * (.28 + uCharge * .65);
          color += uRune * glyph * .85;
          color = mix(color, uVoid, core * .72);

          float alpha = veil * .78 + rim * .42 + filament * .38 + glyph * .36 + pointerPull * .18;
          alpha += uPulse * (1.0 - r) * .42 + uCharge * .20;
          gl_FragColor = vec4(color, clamp(alpha, 0.0, .86));
        }
      `
    });
  }

  function makeShockwaveMaterial(color) {
    return new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    });
  }

  function createShardGeometry() {
    const geometry = new THREE.ConeGeometry(0.45, 3.15, 5, 1);
    geometry.translate(0, 1.55, 0);
    return geometry;
  }

  function addRuneMarks(group, colors, quality, interactiveTargets) {
    const runeCount = quality.isMobile ? 28 : 54;
    const runeMaterial = new THREE.MeshBasicMaterial({
      color: colors.rune,
      transparent: true,
      opacity: 0.68,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const longGeometry = new THREE.BoxGeometry(0.034, 0.46, 0.018);
    const shortGeometry = new THREE.BoxGeometry(0.03, 0.24, 0.018);

    for (let i = 0; i < runeCount; i++) {
      const angle = (i / runeCount) * TAU;
      const mark = new THREE.Mesh(i % 4 === 0 ? longGeometry : shortGeometry, runeMaterial);
      const radius = i % 5 === 0 ? 5.38 : 5.05;
      mark.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0.07);
      mark.rotation.z = angle;
      mark.userData.interactive = 'rune';
      mark.userData.phase = i * 0.31;
      group.add(mark);
      interactiveTargets.push(mark);
    }

    return { runeMaterial, longGeometry, shortGeometry };
  }

  function createRingGroup(colors, quality, interactiveTargets) {
    const group = new THREE.Group();

    const ringMaterial = new THREE.MeshPhysicalMaterial({
      color: colors.iron,
      metalness: 0.96,
      roughness: 0.14,
      clearcoat: 0.95,
      clearcoatRoughness: 0.06,
      emissive: colors.ringGlow,
      emissiveIntensity: 0.18
    });

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(4.18, 0.36, quality.isMobile ? 36 : 72, quality.isMobile ? 144 : 288),
      ringMaterial
    );
    ring.castShadow = quality.shadows;
    ring.userData.interactive = 'ring';
    group.add(ring);
    interactiveTargets.push(ring);

    const rimMaterial = new THREE.MeshBasicMaterial({
      color: colors.portal,
      transparent: true,
      opacity: 0.26,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const rim = new THREE.Mesh(new THREE.RingGeometry(3.74, 4.64, quality.isMobile ? 128 : 256), rimMaterial);
    group.add(rim);

    const portalMaterial = makePortalMaterial(colors);
    const inner = new THREE.Mesh(new THREE.CircleGeometry(3.66, quality.isMobile ? 112 : 224), portalMaterial);
    inner.userData.interactive = 'portal';
    group.add(inner);
    interactiveTargets.push(inner);

    const veilMaterial = new THREE.MeshBasicMaterial({
      color: colors.ember,
      transparent: true,
      opacity: 0.13,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const veil = new THREE.Mesh(new THREE.RingGeometry(2.15, 5.05, quality.isMobile ? 112 : 224), veilMaterial);
    group.add(veil);

    const crownMaterial = new THREE.MeshPhysicalMaterial({
      color: colors.bone,
      metalness: 0.5,
      roughness: 0.24,
      clearcoat: 0.5,
      emissive: colors.ember,
      emissiveIntensity: 0.14
    });
    const shardGeometry = createShardGeometry();
    const shardCount = quality.isMobile ? 18 : 32;
    const shards = [];
    for (let i = 0; i < shardCount; i++) {
      const angle = (i / shardCount) * TAU;
      const shard = new THREE.Mesh(shardGeometry, crownMaterial);
      const radius = 4.92 + (i % 2) * 0.38 + (i % 7 === 0 ? 0.24 : 0);
      shard.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, -0.22);
      shard.rotation.z = angle - Math.PI / 2;
      shard.rotation.x = rand(-0.35, 0.35);
      shard.rotation.y = rand(-0.14, 0.14);
      shard.scale.setScalar(rand(0.55, 1.28));
      shard.castShadow = quality.shadows;
      shard.userData.interactive = 'shard';
      shard.userData.home = shard.position.clone();
      shard.userData.baseRotationX = shard.rotation.x;
      shard.userData.baseRotationY = shard.rotation.y;
      shard.userData.baseRotationZ = shard.rotation.z;
      shard.userData.angle = angle;
      shard.userData.phase = rand(0, TAU);
      group.add(shard);
      interactiveTargets.push(shard);
      shards.push(shard);
    }

    const runes = addRuneMarks(group, colors, quality, interactiveTargets);

    return {
      group,
      ring,
      rim,
      inner,
      veil,
      shards,
      materials: {
        ringMaterial,
        rimMaterial,
        portalMaterial,
        veilMaterial,
        crownMaterial,
        runeMaterial: runes.runeMaterial
      },
      geometries: {
        ringGeometry: ring.geometry,
        rimGeometry: rim.geometry,
        innerGeometry: inner.geometry,
        veilGeometry: veil.geometry,
        shardGeometry,
        runeLongGeometry: runes.longGeometry,
        runeShortGeometry: runes.shortGeometry
      }
    };
  }

  function createStars(count, texture, colors) {
    const positions = new Float32Array(count * 3);
    const starColors = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    const speeds = new Float32Array(count);
    const sizes = new Float32Array(count);

    const cold = new THREE.Color(colors.starCold);
    const warm = new THREE.Color(colors.starWarm);
    const pale = new THREE.Color(colors.starPale);

    for (let i = 0; i < count; i++) {
      const theta = Math.random() * TAU;
      const phi = Math.acos(rand(-1, 1));
      const radius = rand(120, 980);
      const offset = i * 3;
      positions[offset] = radius * Math.sin(phi) * Math.cos(theta);
      positions[offset + 1] = radius * Math.sin(phi) * Math.sin(theta) * 0.74 + rand(-35, 42);
      positions[offset + 2] = radius * Math.cos(phi);
      setColorAttribute(starColors, i, pick([cold, cold, pale, pale, warm]), rand(0.34, 1.16));
      phases[i] = Math.random() * TAU;
      speeds[i] = rand(0.20, 1.65);
      sizes[i] = rand(0.5, 1.0);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(starColors, 3));

    const material = new THREE.PointsMaterial({
      map: texture,
      size: 2.25,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    return {
      points: new THREE.Points(geometry, material),
      colors: starColors,
      baseColors: starColors.slice(),
      phases,
      speeds,
      sizes,
      geometry,
      material
    };
  }

  function createClouds(count, texture, colors) {
    const positions = new Float32Array(count * 3);
    const cloudColors = new Float32Array(count * 3);
    const data = [];
    const violet = new THREE.Color(colors.nebulaViolet);
    const cyan = new THREE.Color(colors.nebulaCyan);
    const blood = new THREE.Color(colors.blood);

    for (let i = 0; i < count; i++) {
      const arm = i % 4;
      const angle = (i / count) * Math.PI * 12 + arm * 1.55 + rand(-0.55, 0.55);
      const radius = rand(22, 165);
      const offset = i * 3;
      positions[offset] = Math.cos(angle) * radius;
      positions[offset + 1] = rand(-34, 52) + Math.sin(angle * 0.55) * 14;
      positions[offset + 2] = Math.sin(angle) * radius - 58;
      setColorAttribute(cloudColors, i, arm === 0 ? violet : arm === 1 ? cyan : arm === 2 ? blood : violet, rand(0.28, 0.76));
      data.push({
        drift: rand(0.012, 0.052),
        phase: rand(0, TAU),
        lift: rand(0.3, 1.7),
        baseX: positions[offset],
        baseY: positions[offset + 1],
        baseZ: positions[offset + 2]
      });
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(cloudColors, 3));
    const material = new THREE.PointsMaterial({
      map: texture,
      size: 18,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.24,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    return { points: new THREE.Points(geometry, material), positions, data, geometry, material };
  }

  function createOrbitParticles(count, texture, colors) {
    const positions = new Float32Array(count * 3);
    const particleColors = new Float32Array(count * 3);
    const data = [];
    const portal = new THREE.Color(colors.portal);
    const ember = new THREE.Color(colors.ember);
    const ghost = new THREE.Color(colors.ghost);
    const rune = new THREE.Color(colors.rune);

    for (let i = 0; i < count; i++) {
      const radius = rand(2.4, 9.4);
      const angle = Math.random() * TAU;
      const y = rand(-2.85, 3.0);
      const offset = i * 3;
      positions[offset] = Math.cos(angle) * radius;
      positions[offset + 1] = y;
      positions[offset + 2] = Math.sin(angle) * radius;
      setColorAttribute(particleColors, i, pick([portal, portal, ember, ghost, rune]), rand(0.34, 0.98));
      data.push({
        angle,
        radius,
        y,
        speed: rand(0.32, 1.58) * (Math.random() < 0.5 ? -1 : 1),
        wobble: rand(0.5, 2.7),
        pull: rand(0.02, 0.11)
      });
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));
    const material = new THREE.PointsMaterial({
      map: texture,
      size: 1.95,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.48,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    return { points: new THREE.Points(geometry, material), positions, data, geometry, material };
  }

  function createTrailSystem(maxCount, texture, colors) {
    const positions = new Float32Array(maxCount * 3);
    const trailColors = new Float32Array(maxCount * 3);
    const life = new Float32Array(maxCount);
    const velocity = Array.from({ length: maxCount }, () => new THREE.Vector3());
    const portal = new THREE.Color(colors.portal);
    const ember = new THREE.Color(colors.ember);
    const rune = new THREE.Color(colors.rune);

    for (let i = 0; i < maxCount; i++) {
      positions[i * 3 + 1] = -9999;
      setColorAttribute(trailColors, i, pick([portal, portal, rune, ember]), rand(0.55, 1.2));
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(trailColors, 3));

    const material = new THREE.PointsMaterial({
      map: texture,
      size: 3.15,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    return {
      points: new THREE.Points(geometry, material),
      positions,
      colors: trailColors,
      life,
      velocity,
      cursor: 0,
      geometry,
      material,
      emit(world, amount, burst) {
        for (let n = 0; n < amount; n++) {
          const i = this.cursor;
          const offset = i * 3;
          const spread = burst ? 0.55 : 0.14;
          positions[offset] = world.x + rand(-spread, spread);
          positions[offset + 1] = world.y + rand(-spread, spread);
          positions[offset + 2] = world.z + rand(-spread, spread);
          life[i] = burst ? rand(0.9, 1.35) : rand(0.45, 0.95);
          velocity[i].set(rand(-0.45, 0.45), rand(-0.35, 0.65), rand(-0.45, 0.45)).multiplyScalar(burst ? 1.4 : 0.55);
          setColorAttribute(trailColors, i, pick([portal, portal, rune, ember]), rand(0.7, 1.35));
          this.cursor = (this.cursor + 1) % maxCount;
        }
        geometry.attributes.position.needsUpdate = true;
        geometry.attributes.color.needsUpdate = true;
      },
      update(dt) {
        for (let i = 0; i < maxCount; i++) {
          if (life[i] <= 0) continue;
          life[i] -= dt;
          const offset = i * 3;
          positions[offset] += velocity[i].x * dt;
          positions[offset + 1] += velocity[i].y * dt;
          positions[offset + 2] += velocity[i].z * dt;
          velocity[i].multiplyScalar(0.985);
          const fade = clamp(life[i], 0, 1);
          trailColors[offset] *= 0.985 + fade * 0.006;
          trailColors[offset + 1] *= 0.985 + fade * 0.006;
          trailColors[offset + 2] *= 0.985 + fade * 0.006;
          if (life[i] <= 0) positions[offset + 1] = -9999;
        }
        geometry.attributes.position.needsUpdate = true;
        geometry.attributes.color.needsUpdate = true;
      }
    };
  }

  function createGround(scene, colors, quality) {
    const groundMaterial = new THREE.MeshPhysicalMaterial({
      color: colors.ground,
      roughness: 0.92,
      metalness: 0.08,
      emissive: colors.nebulaViolet,
      emissiveIntensity: 0.012,
      transparent: true,
      opacity: 0.58
    });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(180, 180, 24, 24), groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -9.6;
    ground.receiveShadow = quality.shadows;
    scene.add(ground);

    const circleMaterial = new THREE.MeshBasicMaterial({
      color: colors.portal,
      transparent: true,
      opacity: 0.055,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const circle = new THREE.Mesh(new THREE.RingGeometry(6.8, 25, quality.isMobile ? 128 : 220), circleMaterial);
    circle.rotation.x = -Math.PI / 2;
    circle.position.y = -9.42;
    scene.add(circle);

    const sigilMaterial = new THREE.MeshBasicMaterial({
      color: colors.rune,
      transparent: true,
      opacity: 0.04,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const sigil = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(8 + i * 3.1, 8.05 + i * 3.1, 144), sigilMaterial);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = -9.39 + i * 0.004;
      sigil.add(ring);
    }
    scene.add(sigil);

    return { ground, circle, sigil, materials: { groundMaterial, circleMaterial, sigilMaterial } };
  }

  function createObelisks(scene, colors, quality, interactiveTargets) {
    const material = new THREE.MeshPhysicalMaterial({
      color: colors.obsidian,
      roughness: 0.48,
      metalness: 0.38,
      clearcoat: 0.18,
      emissive: colors.blood,
      emissiveIntensity: 0.06
    });
    const topMaterial = new THREE.MeshBasicMaterial({
      color: colors.ember,
      transparent: true,
      opacity: 0.44,
      blending: THREE.AdditiveBlending
    });
    const count = quality.isMobile ? 8 : 16;
    const obelisks = [];

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * TAU + rand(-0.08, 0.08);
      const radius = rand(24, 58);
      const height = rand(4, 13);
      const group = new THREE.Group();
      group.position.set(Math.cos(angle) * radius, -9.55, -24 - Math.abs(Math.sin(angle)) * radius * 0.58);
      group.rotation.y = -angle + rand(-0.45, 0.45);

      const body = new THREE.Mesh(new THREE.ConeGeometry(rand(0.28, 0.72), height, 5), material);
      body.position.y = height * 0.5;
      body.castShadow = quality.shadows;
      body.userData.interactive = 'obelisk';
      body.userData.parentObelisk = group;
      body.userData.phase = rand(0, TAU);
      group.add(body);
      interactiveTargets.push(body);

      const ember = new THREE.Mesh(new THREE.SphereGeometry(rand(0.12, 0.29), 14, 10), topMaterial);
      ember.position.y = height + 0.18;
      group.add(ember);

      scene.add(group);
      obelisks.push({ group, body, ember, phase: rand(0, TAU), baseHeight: height, angle });
    }

    return { obelisks, material, topMaterial };
  }

  function createMeteor(scene, colors, quality) {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(6);
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.LineBasicMaterial({
      color: colors.starWarm,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const line = new THREE.Line(geometry, material);
    scene.add(line);
    return {
      line,
      geometry,
      material,
      active: false,
      life: 0,
      pos: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      launch() {
        this.active = true;
        this.life = rand(0.7, 1.3);
        this.pos.set(rand(-85, 85), rand(50, 90), rand(-120, -30));
        this.vel.set(rand(-32, 22), rand(-35, -18), rand(26, 42));
        material.opacity = quality.isMobile ? 0.55 : 0.78;
      },
      update(dt) {
        if (!this.active) return;
        this.life -= dt;
        this.pos.addScaledVector(this.vel, dt);
        const tail = this.pos.clone().addScaledVector(this.vel, -0.045);
        positions[0] = this.pos.x;
        positions[1] = this.pos.y;
        positions[2] = this.pos.z;
        positions[3] = tail.x;
        positions[4] = tail.y;
        positions[5] = tail.z;
        geometry.attributes.position.needsUpdate = true;
        material.opacity = Math.max(0, Math.min(0.9, this.life));
        if (this.life <= 0) {
          this.active = false;
          material.opacity = 0;
        }
      }
    };
  }

  function createDestinationNodes() {
    const group = new THREE.Group();
    group.visible = false;
    const nodes = DESTINATIONS.map((item) => {
      const node = new THREE.Group();
      const texture = createLabelTexture(item.label, item.color);
      const label = new THREE.Sprite(new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: 0,
        depthWrite: false
      }));
      label.scale.set(5.4, 1.8, 1);
      label.userData.interactive = 'destination';
      label.userData.href = item.href;
      label.userData.label = item.label;

      const glow = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 18, 12),
        new THREE.MeshBasicMaterial({
          color: item.color,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );

      node.add(glow, label);
      node.userData.angle = item.angle;
      node.userData.radius = 9.6;
      group.add(node);
      return { group: node, label, glow, texture };
    });

    return {
      group,
      nodes,
      update(t, openProgress, hovered) {
        group.visible = openProgress > 0.01;
        nodes.forEach((node, index) => {
          const reveal = clamp(openProgress * 1.35 - index * 0.12, 0, 1);
          const angle = node.group.userData.angle + Math.sin(t * 0.35 + index) * 0.04;
          const radius = node.group.userData.radius;
          const hoverBoost = hovered === node.label ? 1.12 : 1;
          node.group.position.set(Math.sin(angle) * radius, 2.4 + Math.cos(index * 1.7 + t * 0.5) * 0.38, Math.cos(angle) * 2.2 - 1.8);
          node.group.scale.setScalar(hoverBoost);
          node.label.material.opacity = reveal;
          node.glow.material.opacity = reveal * (0.58 + Math.sin(t * 2 + index) * 0.16);
          node.glow.scale.setScalar(1 + reveal * (4 + Math.sin(t * 2.4 + index) * 0.6));
        });
      },
      dispose() {
        nodes.forEach((node) => {
          node.texture.dispose();
          node.label.material.dispose();
          node.glow.geometry.dispose();
          node.glow.material.dispose();
        });
      }
    };
  }

  function createSimulation(container, options) {
    options = options || {};
    if (!window.THREE || !container) return null;

    injectStyles();
    container.classList.add('ring-universe-shell');
    container.tabIndex = container.tabIndex >= 0 ? container.tabIndex : 0;

    const isMobile = window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const quality = {
      isMobile,
      shadows: !isMobile,
      pixelRatio: isMobile ? Math.min(window.devicePixelRatio || 1, 1.45) : Math.min(window.devicePixelRatio || 1, 2.25),
      stars: isMobile ? 1200 : 3800,
      clouds: isMobile ? 105 : 245,
      motes: isMobile ? 320 : 900,
      trails: isMobile ? 140 : 300,
      meteors: isMobile ? 3 : 7
    };

    const palettes = {
      dark: {
        background: 0x03030a,
        fog: 0x070615,
        iron: 0x211d28,
        ringGlow: 0xa685ff,
        portal: 0x74faff,
        ember: 0xff8b44,
        rune: 0xe6d4ff,
        bone: 0xb9a98d,
        ghost: 0xc2fff2,
        blood: 0x96173d,
        obsidian: 0x08080f,
        ground: 0x06060b,
        nebulaViolet: 0x6544ad,
        nebulaCyan: 0x238ba0,
        starCold: 0xa7ccff,
        starWarm: 0xffc18a,
        starPale: 0xf5f0ff
      },
      light: {
        background: 0x070816,
        fog: 0x101128,
        iron: 0x302b38,
        ringGlow: 0x9f91ff,
        portal: 0x9efbff,
        ember: 0xff9d4d,
        rune: 0xefe6ff,
        bone: 0xc9b797,
        ghost: 0xd0fff5,
        blood: 0xa72041,
        obsidian: 0x101017,
        ground: 0x0d0c14,
        nebulaViolet: 0x704fba,
        nebulaCyan: 0x2a93a8,
        starCold: 0xb5d6ff,
        starWarm: 0xffca96,
        starPale: 0xffffff
      }
    };

    let darkMode = Boolean(options.getDarkMode && options.getDarkMode());
    let colors = darkMode ? palettes.dark : palettes.light;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(colors.fog, isMobile ? 0.0135 : 0.0074);

    const camera = new THREE.PerspectiveCamera(isMobile ? 68 : 56, 1, 0.1, 1600);
    camera.position.set(0, isMobile ? 4.8 : 5.8, isMobile ? 26 : 30);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: isMobile ? 'default' : 'high-performance'
    });
    renderer.setPixelRatio(quality.pixelRatio);
    renderer.setSize(container.clientWidth || 1, container.clientHeight || 1);
    renderer.setClearColor(colors.background, 1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    if ('outputColorSpace' in renderer && THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;
    if ('useLegacyLights' in renderer) renderer.useLegacyLights = false;
    if (quality.shadows) {
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    container.appendChild(renderer.domElement);

    const vignette = document.createElement('div');
    vignette.className = 'ring-universe-vignette';
    const grain = document.createElement('div');
    grain.className = 'ring-universe-grain';
    const hud = document.createElement('div');
    hud.className = 'ring-universe-hud';
    hud.innerHTML = `
      <div class="ring-universe-hud__panel">${isMobile ? 'Tap pulse | drag orbit | pinch depth | two-finger charge' : 'Hold to charge | release shockwave | drag orbit | wheel depth | Shift+drag draw sigils | WASD/QE fly | Space pulse | C cinematic | M meteors | R reset'}</div>
      <div class="ring-universe-hud__status">Charge <span class="ring-universe-charge"><i></i></span></div>
    `;
    container.appendChild(vignette);
    container.appendChild(grain);
    container.appendChild(hud);
    const chargeBar = hud.querySelector('.ring-universe-charge > i');
    window.setTimeout(() => hud.classList.add('is-muted'), 8000);

    const pointTexture = createPointTexture();
    const smokeTexture = createSmokeTexture();
    const strokeTexture = createStrokeTexture();

    scene.add(new THREE.HemisphereLight(0x9bbcff, 0x17040a, isMobile ? 0.64 : 0.46));

    const moonLight = new THREE.DirectionalLight(0xdce9ff, isMobile ? 0.95 : 1.18);
    moonLight.position.set(-28, 50, 20);
    moonLight.castShadow = quality.shadows;
    if (quality.shadows) {
      moonLight.shadow.mapSize.set(2048, 2048);
      moonLight.shadow.camera.left = -62;
      moonLight.shadow.camera.right = 62;
      moonLight.shadow.camera.top = 62;
      moonLight.shadow.camera.bottom = -62;
    }
    scene.add(moonLight);

    const portalLight = new THREE.PointLight(colors.portal, 5.6, 92, 1.45);
    portalLight.position.set(0, 2, 0);
    scene.add(portalLight);

    const emberLight = new THREE.PointLight(colors.ember, 2.2, 65, 2.0);
    emberLight.position.set(12, -1, 7);
    scene.add(emberLight);

    const interactiveTargets = [];
    const ring = createRingGroup(colors, quality, interactiveTargets);
    ring.group.position.set(0, 2.05, 0);
    ring.group.rotation.x = -0.1;
    scene.add(ring.group);

    const voidCoreMaterial = new THREE.MeshBasicMaterial({
      color: colors.background,
      transparent: true,
      opacity: 0.64,
      side: THREE.BackSide
    });
    const voidCore = new THREE.Mesh(new THREE.SphereGeometry(2.02, quality.isMobile ? 48 : 80, quality.isMobile ? 30 : 48), voidCoreMaterial);
    voidCore.userData.interactive = 'void';
    ring.group.add(voidCore);
    interactiveTargets.push(voidCore);

    const stars = createStars(quality.stars, pointTexture, colors);
    scene.add(stars.points);

    const clouds = createClouds(quality.clouds, smokeTexture, colors);
    scene.add(clouds.points);

    const motes = createOrbitParticles(quality.motes, pointTexture, colors);
    scene.add(motes.points);

    const trails = createTrailSystem(quality.trails, strokeTexture, colors);
    scene.add(trails.points);

    const ground = createGround(scene, colors, quality);
    const obelisks = createObelisks(scene, colors, quality, interactiveTargets);
    const meteors = Array.from({ length: quality.meteors }, () => createMeteor(scene, colors, quality));
    const destinations = createDestinationNodes();
    scene.add(destinations.group);
    destinations.nodes.forEach((node) => interactiveTargets.push(node.label));

    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2(0, 0);
    const pointerUv = new THREE.Vector2(0.5, 0.5);
    const pointerPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const pointerWorld = new THREE.Vector3();
    const pointerTargetWorld = new THREE.Vector3();
    const cameraTarget = new THREE.Vector3(0, 1.65, 0);
    const cameraTargetTarget = new THREE.Vector3(0, 1.65, 0);
    const tempVector = new THREE.Vector3();
    const tempVector2 = new THREE.Vector3();

    const state = {
      pointerDown: false,
      pointerId: null,
      pointerX: 0,
      pointerY: 0,
      lastPointerX: 0,
      lastPointerY: 0,
      dragDistance: 0,
      targetYaw: -0.15,
      yaw: -0.15,
      pitch: 0.08,
      targetPitch: 0.08,
      roll: 0,
      targetRoll: 0,
      distance: isMobile ? 26 : 30,
      targetDistance: isMobile ? 26 : 30,
      pulse: 0,
      charge: 0,
      charging: false,
      selected: null,
      selectedType: '',
      selectedBoost: 0,
      hover: null,
      hoverBoost: 0,
      visible: true,
      raf: 0,
      disposed: false,
      cinematic: false,
      screenShake: 0,
      pointerInfluence: 0,
      drawing: false,
      portalOpen: false,
      portalOpenProgress: 0,
      nextMeteor: rand(4, 9),
      keys: Object.create(null),
      hudHidden: false,
      pinch: {
        active: false,
        ids: [],
        startDistance: 0,
        startCameraDistance: 0,
        chargeStart: 0
      },
      activePointers: new Map()
    };

    const shockwaves = [];

    const observer = new IntersectionObserver((entries) => {
      state.visible = entries[0] ? entries[0].isIntersecting : true;
    }, { threshold: 0.02 });
    observer.observe(container);

    function resize() {
      const width = Math.max(1, container.clientWidth);
      const height = Math.max(1, container.clientHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    }

    function updatePointerFromEvent(event) {
      const rect = renderer.domElement.getBoundingClientRect();
      const x = (event.clientX - rect.left) / Math.max(1, rect.width);
      const y = (event.clientY - rect.top) / Math.max(1, rect.height);
      pointerNdc.set(x * 2 - 1, -(y * 2 - 1));
      pointerUv.set(clamp(x, 0, 1), clamp(1 - y, 0, 1));
      raycaster.setFromCamera(pointerNdc, camera);
      if (raycaster.ray.intersectPlane(pointerPlane, pointerTargetWorld)) {
        pointerTargetWorld.copy(pointerTargetWorld);
      }
    }

    function updateHover() {
      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObjects(interactiveTargets, false);
      const hit = hits.length ? hits[0].object : null;
      state.hover = hit;
      if (hit) {
        state.hoverBoost = 1;
        state.selectedType = hit.userData.interactive || '';
      }
    }

    function spawnShockwave(strength, origin) {
      const material = makeShockwaveMaterial(strength > 1.55 ? colors.ember : colors.portal);
      const mesh = new THREE.Mesh(new THREE.RingGeometry(0.72, 0.78, 160), material);
      mesh.position.copy(origin || ring.group.position);
      mesh.position.z += 0.04;
      mesh.rotation.copy(ring.group.rotation);
      ring.group.add(mesh);
      shockwaves.push({ mesh, material, life: 1, strength, speed: lerp(7.5, 13.5, clamp(strength / 2, 0, 1)) });
    }

    function launchPulse(strength, origin) {
      const s = clamp(strength, 0.25, 3.0);
      state.pulse = Math.max(state.pulse, s);
      state.screenShake = Math.max(state.screenShake, s * 0.32);
      state.pointerInfluence = Math.max(state.pointerInfluence, s);
      state.selectedBoost = Math.max(state.selectedBoost, s);
      portalLight.intensity = 9 + s * 6.2;
      ring.group.scale.setScalar(1 + s * 0.045);
      spawnShockwave(s, origin || new THREE.Vector3(0, 0, 0));
      trails.emit(pointerWorld, Math.floor(18 + s * 18), true);
      for (let i = 0; i < ring.shards.length; i++) {
        const shard = ring.shards[i];
        const angle = shard.userData.angle;
        shard.position.x += Math.cos(angle) * s * 0.075;
        shard.position.y += Math.sin(angle) * s * 0.075;
        shard.position.z += s * 0.07;
      }
    }

    function focusObject(object) {
      if (!object) return;
      if (object.userData.interactive === 'destination' && object.userData.href) {
        window.location.href = object.userData.href;
        return;
      }
      object.getWorldPosition(tempVector);
      cameraTargetTarget.lerp(tempVector, 0.28);
      state.selected = object;
      state.selectedBoost = 1.4;
      if (object.userData.interactive === 'obelisk' && object.userData.parentObelisk) {
        object.userData.parentObelisk.position.y += 0.26;
      }
      launchPulse(object.userData.interactive === 'void' ? 1.8 : 1.1, ring.group.worldToLocal(tempVector.clone()));
    }

    function resetView() {
      state.targetYaw = -0.15;
      state.targetPitch = 0.08;
      state.targetRoll = 0;
      state.targetDistance = isMobile ? 26 : 30;
      cameraTargetTarget.set(0, 1.65, 0);
      state.cinematic = false;
      state.portalOpen = false;
      state.portalOpenProgress = 0;
      launchPulse(1.15);
    }

    function updatePinch() {
      const points = state.pinch.ids.map((id) => state.activePointers.get(id)).filter(Boolean);
      if (points.length < 2) {
        state.pinch.active = false;
        return;
      }
      const dx = points[0].x - points[1].x;
      const dy = points[0].y - points[1].y;
      const distance = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      if (!state.pinch.active) {
        state.pinch.active = true;
        state.pinch.startDistance = distance;
        state.pinch.startCameraDistance = state.targetDistance;
        state.pinch.chargeStart = state.charge;
      }
      const scale = state.pinch.startDistance / distance;
      state.targetDistance = clamp(state.pinch.startCameraDistance * scale, isMobile ? 19 : 22, 58);
      state.charging = true;
      state.charge = clamp(state.pinch.chargeStart + Math.abs(1 - scale) * 1.35, 0, 1.7);
    }

    function onPointerDown(event) {
      container.focus({ preventScroll: true });
      updatePointerFromEvent(event);
      state.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (state.activePointers.size >= 2) {
        state.pinch.ids = Array.from(state.activePointers.keys()).slice(0, 2);
        updatePinch();
        return;
      }
      state.pointerDown = true;
      state.pointerId = event.pointerId;
      state.pointerX = event.clientX;
      state.pointerY = event.clientY;
      state.lastPointerX = event.clientX;
      state.lastPointerY = event.clientY;
      state.dragDistance = 0;
      state.charging = true;
      state.drawing = event.shiftKey || event.button === 2;
      container.classList.add('is-dragging');
      renderer.domElement.setPointerCapture(event.pointerId);
      updateHover();
    }

    function onPointerMove(event) {
      updatePointerFromEvent(event);
      state.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (state.activePointers.size >= 2) {
        updatePinch();
        return;
      }
      updateHover();
      if (!state.pointerDown || state.pointerId !== event.pointerId) return;

      const dx = event.clientX - state.lastPointerX;
      const dy = event.clientY - state.lastPointerY;
      state.lastPointerX = event.clientX;
      state.lastPointerY = event.clientY;
      state.dragDistance += Math.abs(dx) + Math.abs(dy);

      if (event.shiftKey || state.drawing) {
        state.drawing = true;
        trails.emit(pointerWorld, isMobile ? 1 : 2, false);
        state.charge = clamp(state.charge + 0.0028 * (Math.abs(dx) + Math.abs(dy)), 0, 1.85);
        state.pointerInfluence = Math.max(state.pointerInfluence, 0.5);
      } else {
        state.targetYaw += dx * 0.006;
        state.targetPitch = clamp(state.targetPitch + dy * 0.0034, -0.32, 0.90);
        ring.group.rotation.z += dx * 0.00175;
        ring.group.rotation.x += dy * 0.0011;
      }
    }

    function onPointerUp(event) {
      state.activePointers.delete(event.pointerId);
      if (state.activePointers.size < 2) state.pinch.active = false;

      if (state.pointerId === event.pointerId || state.pointerDown) {
        const wasTap = state.dragDistance < 9;
        const strength = wasTap ? Math.max(1, 0.65 + state.charge * 1.2) : Math.max(0.65, state.charge * 1.35);
        if (state.charge > 1.5) {
          state.portalOpen = true;
          hud.classList.remove('is-muted');
        }
        if (state.hover && wasTap) focusObject(state.hover);
        else launchPulse(strength);
      }

      state.pointerDown = false;
      state.pointerId = null;
      state.charging = false;
      state.drawing = false;
      state.charge = 0;
      container.classList.remove('is-dragging');
      if (renderer.domElement.hasPointerCapture && renderer.domElement.hasPointerCapture(event.pointerId)) {
        renderer.domElement.releasePointerCapture(event.pointerId);
      }
    }

    function onDoubleClick(event) {
      updatePointerFromEvent(event);
      launchPulse(2.25);
    }

    function onContextMenu(event) {
      event.preventDefault();
    }

    function onWheel(event) {
      event.preventDefault();
      state.targetDistance = clamp(state.targetDistance + event.deltaY * 0.036, isMobile ? 19 : 22, 58);
      state.pointerInfluence = Math.max(state.pointerInfluence, 0.45);
    }

    function onKeyDown(event) {
      state.keys[event.code] = true;
      if (event.code === 'Space') {
        event.preventDefault();
        launchPulse(1.65 + state.charge * 0.5);
      } else if (event.code === 'KeyR') {
        resetView();
      } else if (event.code === 'KeyC') {
        state.cinematic = !state.cinematic;
        hud.classList.toggle('is-muted', !state.cinematic);
      } else if (event.code === 'KeyH') {
        state.hudHidden = !state.hudHidden;
        hud.classList.toggle('is-hidden', state.hudHidden);
      } else if (event.code === 'KeyM') {
        meteors.forEach((meteor, index) => window.setTimeout(() => meteor.launch(), index * 90));
        state.screenShake = Math.max(state.screenShake, 0.34);
      } else if (event.code === 'KeyF') {
        focusObject(voidCore);
      }
    }

    function onKeyUp(event) {
      state.keys[event.code] = false;
    }

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointercancel', onPointerUp);
    renderer.domElement.addEventListener('dblclick', onDoubleClick);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
    renderer.domElement.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('resize', resize);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    function applyPalette(nextColors) {
      colors = nextColors;
      renderer.setClearColor(colors.background, 1);
      scene.fog.color.setHex(colors.fog);
      portalLight.color.setHex(colors.portal);
      emberLight.color.setHex(colors.ember);
      ring.materials.ringMaterial.color.setHex(colors.iron);
      ring.materials.ringMaterial.emissive.setHex(colors.ringGlow);
      ring.materials.rimMaterial.color.setHex(colors.portal);
      ring.materials.portalMaterial.uniforms.uPortal.value.setHex(colors.portal);
      ring.materials.portalMaterial.uniforms.uRune.value.setHex(colors.rune);
      ring.materials.portalMaterial.uniforms.uEmber.value.setHex(colors.ember);
      ring.materials.portalMaterial.uniforms.uVoid.value.setHex(colors.background);
      ring.materials.veilMaterial.color.setHex(colors.ember);
      ring.materials.crownMaterial.color.setHex(colors.bone);
      ring.materials.crownMaterial.emissive.setHex(colors.ember);
      ring.materials.runeMaterial.color.setHex(colors.rune);
      ground.materials.groundMaterial.color.setHex(colors.ground);
      ground.materials.circleMaterial.color.setHex(colors.portal);
      ground.materials.sigilMaterial.color.setHex(colors.rune);
      obelisks.material.color.setHex(colors.obsidian);
      obelisks.material.emissive.setHex(colors.blood);
      obelisks.topMaterial.color.setHex(colors.ember);
      voidCoreMaterial.color.setHex(colors.background);
      meteors.forEach((meteor) => meteor.material.color.setHex(colors.starWarm));
    }

    const clock = new THREE.Clock();
    let frame = 0;

    function animate() {
      state.raf = requestAnimationFrame(animate);
      if (state.disposed) return;
      if (!state.visible) {
        clock.getDelta();
        return;
      }

      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;
      frame++;

      pointerWorld.lerp(pointerTargetWorld, 0.18);

      const nextDarkMode = Boolean(options.getDarkMode && options.getDarkMode());
      if (nextDarkMode !== darkMode) {
        darkMode = nextDarkMode;
        applyPalette(darkMode ? palettes.dark : palettes.light);
      }

      if (state.charging) {
        state.charge = clamp(state.charge + dt * (state.drawing ? 0.18 : 0.42), 0, 1.85);
        state.pointerInfluence = Math.max(state.pointerInfluence, 0.32 + state.charge * 0.5);
      }
      if (chargeBar) chargeBar.style.setProperty('--charge', `${clamp(state.charge / 1.85, 0, 1) * 100}%`);

      state.pulse = Math.max(0, state.pulse - dt * 1.55);
      state.screenShake = Math.max(0, state.screenShake - dt * 1.6);
      state.pointerInfluence = Math.max(0, state.pointerInfluence - dt * 0.9);
      state.selectedBoost = Math.max(0, state.selectedBoost - dt * 0.9);
      state.hoverBoost = Math.max(0, state.hoverBoost - dt * 2.2);
      state.portalOpenProgress += ((state.portalOpen ? 1 : 0) - state.portalOpenProgress) * 0.07;

      const pulse = state.pulse;
      const charge = state.charge;
      const breathing = 0.5 + 0.5 * Math.sin(t * 1.08);
      const slowBreath = 0.5 + 0.5 * Math.sin(t * 0.31);

      ring.materials.portalMaterial.uniforms.uTime.value = t;
      ring.materials.portalMaterial.uniforms.uPulse.value = pulse;
      ring.materials.portalMaterial.uniforms.uCharge.value = charge;
      ring.materials.portalMaterial.uniforms.uPointer.value.copy(pointerUv);

      for (let i = shockwaves.length - 1; i >= 0; i--) {
        const wave = shockwaves[i];
        wave.life -= dt * 0.78;
        const progress = 1 - wave.life;
        wave.mesh.scale.setScalar(1 + progress * wave.speed * wave.strength);
        wave.material.opacity = Math.max(0, wave.life) * (0.55 + 0.25 * wave.strength);
        wave.mesh.rotation.z += dt * (0.6 + wave.strength * 0.4);
        if (wave.life <= 0) {
          ring.group.remove(wave.mesh);
          wave.mesh.geometry.dispose();
          wave.material.dispose();
          shockwaves.splice(i, 1);
        }
      }

      if (state.keys.KeyA) state.targetYaw -= dt * 1.0;
      if (state.keys.KeyD) state.targetYaw += dt * 1.0;
      if (state.keys.KeyW) state.targetDistance = clamp(state.targetDistance - dt * 18, isMobile ? 19 : 22, 58);
      if (state.keys.KeyS) state.targetDistance = clamp(state.targetDistance + dt * 18, isMobile ? 19 : 22, 58);
      if (state.keys.KeyQ) state.targetRoll = clamp(state.targetRoll - dt * 0.7, -0.32, 0.32);
      if (state.keys.KeyE) state.targetRoll = clamp(state.targetRoll + dt * 0.7, -0.32, 0.32);
      if (!state.keys.KeyQ && !state.keys.KeyE) state.targetRoll *= 0.94;

      if (state.cinematic && !state.pointerDown) {
        state.targetYaw += dt * 0.09;
        state.targetPitch = 0.08 + Math.sin(t * 0.19) * 0.09;
        state.targetDistance = (isMobile ? 26 : 30) + Math.sin(t * 0.23) * 4.5;
      } else if (!state.pointerDown && !state.pinch.active) {
        state.targetYaw += dt * 0.045;
      }

      ring.group.scale.lerp(tempVector.setScalar(1 + pulse * 0.075 + charge * 0.035), 0.095);
      ring.group.rotation.y += dt * (0.145 + pulse * 0.25 + charge * 0.08);
      ring.group.rotation.z += dt * (0.032 + charge * 0.04);
      ring.inner.rotation.z -= dt * (0.38 + pulse * 1.1 + charge * 0.55);
      ring.rim.rotation.z += dt * (0.14 + pulse * 0.4);
      ring.veil.rotation.z += dt * (0.18 + pulse * 0.48 + charge * 0.2);
      ring.inner.scale.setScalar(1 + breathing * 0.03 + pulse * 0.08 + charge * 0.04);
      ring.rim.scale.setScalar(1 + breathing * 0.012 + pulse * 0.035);
      ring.veil.scale.setScalar(1 + slowBreath * 0.075 + pulse * 0.12 + charge * 0.05);
      ring.materials.rimMaterial.opacity = 0.18 + breathing * 0.12 + pulse * 0.18 + charge * 0.1;
      ring.materials.veilMaterial.opacity = 0.10 + slowBreath * 0.09 + pulse * 0.15 + charge * 0.08;
      ring.materials.ringMaterial.emissiveIntensity = 0.15 + breathing * 0.11 + pulse * 0.65 + charge * 0.22 + state.hoverBoost * 0.12;
      ring.materials.runeMaterial.opacity = 0.38 + breathing * 0.34 + pulse * 0.22 + charge * 0.18;
      voidCore.scale.setScalar(1 + slowBreath * 0.07 + pulse * 0.12 + charge * 0.08);
      voidCoreMaterial.opacity = 0.54 + pulse * 0.12 + charge * 0.08;

      for (let i = 0; i < ring.shards.length; i++) {
        const shard = ring.shards[i];
        const home = shard.userData.home;
        const outward = 1 + pulse * 0.055 + charge * 0.04 + (state.hover === shard ? 0.05 : 0);
        shard.position.x += (home.x * outward - shard.position.x) * 0.045;
        shard.position.y += (home.y * outward - shard.position.y) * 0.045;
        shard.position.z += (-0.22 + Math.sin(t * 1.35 + shard.userData.phase) * 0.18 + pulse * 0.22 + charge * 0.12 - shard.position.z) * 0.05;
        shard.rotation.x = shard.userData.baseRotationX + Math.sin(t * 1.15 + shard.userData.phase) * (0.045 + charge * 0.025);
        shard.rotation.y = shard.userData.baseRotationY + (state.hover === shard ? Math.sin(t * 4.2) * 0.08 : 0);
        shard.rotation.z = shard.userData.baseRotationZ;
      }

      const motePositions = motes.positions;
      const influence = state.pointerInfluence;
      for (let i = 0; i < motes.data.length; i++) {
        const mote = motes.data[i];
        mote.angle += dt * mote.speed * (1 + pulse * 1.35 + charge * 0.65);
        const radius = mote.radius + Math.sin(t * mote.wobble + i) * 0.24 + pulse * 0.75 + charge * 0.34;
        const offset = i * 3;
        const targetX = Math.cos(mote.angle) * radius;
        const targetY = mote.y + Math.sin(t * 1.7 + i) * 0.65;
        const targetZ = Math.sin(mote.angle) * radius;
        motePositions[offset] = lerp(targetX, pointerWorld.x * 0.42, influence * mote.pull);
        motePositions[offset + 1] = lerp(targetY, pointerWorld.y * 0.38, influence * mote.pull);
        motePositions[offset + 2] = lerp(targetZ, pointerWorld.z * 0.42, influence * mote.pull);
      }
      motes.geometry.attributes.position.needsUpdate = true;
      motes.points.rotation.y = t * 0.078;
      motes.material.opacity = 0.38 + pulse * 0.16 + charge * 0.1;

      if (state.drawing || state.charging) {
        trails.emit(pointerWorld, state.drawing ? (isMobile ? 1 : 2) : 1, false);
      }
      trails.update(dt);

      if (frame % (isMobile ? 3 : 1) === 0) {
        const cloudPositions = clouds.positions;
        for (let i = 0; i < clouds.data.length; i++) {
          const cloud = clouds.data[i];
          const offset = i * 3;
          cloudPositions[offset] = cloud.baseX + Math.sin(t * cloud.drift + cloud.phase) * (0.45 + charge * 1.8);
          cloudPositions[offset + 1] = cloud.baseY + Math.cos(t * cloud.drift * 0.8 + cloud.phase) * 0.62 * cloud.lift;
          cloudPositions[offset + 2] = cloud.baseZ + Math.sin(t * cloud.drift * 0.6 + cloud.phase) * (0.8 + pulse * 2.2);
        }
        clouds.geometry.attributes.position.needsUpdate = true;
      }
      clouds.points.rotation.y = t * 0.017 + state.yaw * 0.015;
      clouds.points.rotation.x = Math.sin(t * 0.08) * 0.09;
      clouds.material.opacity = 0.20 + slowBreath * 0.075 + charge * 0.045;

      if (frame % (isMobile ? 8 : 4) === 0) {
        const updateCount = isMobile ? Math.floor(quality.stars / 16) : Math.floor(quality.stars / 7);
        for (let i = 0; i < updateCount; i++) {
          const index = (frame * 17 + i * 23) % quality.stars;
          const offset = index * 3;
          const twinkle = 0.72 + Math.sin(t * stars.speeds[index] + stars.phases[index]) * 0.28 + pulse * 0.08;
          stars.colors[offset] = stars.baseColors[offset] * twinkle;
          stars.colors[offset + 1] = stars.baseColors[offset + 1] * twinkle;
          stars.colors[offset + 2] = stars.baseColors[offset + 2] * twinkle;
        }
        stars.geometry.attributes.color.needsUpdate = true;
      }
      stars.points.rotation.y = t * 0.0024 + state.yaw * 0.004;
      stars.points.rotation.x = t * 0.00085;

      ground.circle.rotation.z -= dt * (0.062 + pulse * 0.16 + charge * 0.07);
      ground.sigil.rotation.y += dt * 0.014;
      ground.materials.circleMaterial.opacity = 0.04 + slowBreath * 0.03 + pulse * 0.08 + charge * 0.04;
      ground.materials.sigilMaterial.opacity = 0.025 + pulse * 0.045 + charge * 0.045;

      for (let i = 0; i < obelisks.obelisks.length; i++) {
        const item = obelisks.obelisks[i];
        item.group.position.y += (-9.55 + Math.sin(t * 0.68 + item.phase) * 0.1 - item.group.position.y) * 0.045;
        item.ember.scale.setScalar(1 + Math.sin(t * 2.55 + item.phase) * 0.32 + pulse * 0.55 + charge * 0.22);
        item.group.rotation.y += Math.sin(t * 0.26 + item.phase) * 0.0009;
      }

      state.nextMeteor -= dt;
      if (state.nextMeteor <= 0) {
        const inactive = meteors.find((meteor) => !meteor.active);
        if (inactive) inactive.launch();
        state.nextMeteor = rand(isMobile ? 9 : 5, isMobile ? 18 : 12);
      }
      meteors.forEach((meteor) => meteor.update(dt));
      destinations.update(t, state.portalOpenProgress, state.hover);

      portalLight.intensity += ((4.85 + breathing * 1.75 + pulse * 8.2 + charge * 3.0 + state.portalOpenProgress * 4.2 + state.hoverBoost * 0.8) - portalLight.intensity) * 0.08;
      portalLight.position.set(Math.sin(t * 0.8) * 1.45, 1.45 + Math.sin(t * 1.1) * 0.82, Math.cos(t * 0.7) * 1.45);
      emberLight.intensity = 1.45 + slowBreath * 1.25 + pulse * 3.2 + charge * 0.9;
      emberLight.position.set(Math.sin(t * 0.43) * 19, -2 + Math.sin(t * 0.7) * 2, Math.cos(t * 0.37) * 19);

      state.yaw += (state.targetYaw - state.yaw) * 0.078;
      state.pitch += (state.targetPitch - state.pitch) * 0.078;
      state.distance += (state.targetDistance - state.distance) * 0.08;
      state.roll += (state.targetRoll - state.roll) * 0.08;
      cameraTarget.lerp(cameraTargetTarget, 0.05);
      cameraTargetTarget.lerp(tempVector2.set(0, 1.65, 0), 0.006);

      const shake = state.screenShake;
      const shakeX = shake ? Math.sin(t * 39.7) * shake : 0;
      const shakeY = shake ? Math.cos(t * 31.1) * shake * 0.55 : 0;
      const height = 4.8 + state.pitch * 8 + Math.sin(t * 0.3) * 0.75 + shakeY;
      camera.position.x = Math.sin(state.yaw) * state.distance + shakeX;
      camera.position.z = Math.cos(state.yaw) * state.distance + 5.5;
      camera.position.y = height;
      camera.rotation.z = state.roll;
      camera.lookAt(cameraTarget);

      renderer.render(scene, camera);
    }

    resize();
    animate();

    return {
      pulse(strength) {
        launchPulse(strength || 1.4);
      },
      cinematic(enabled) {
        state.cinematic = Boolean(enabled);
      },
      dispose() {
        state.disposed = true;
        cancelAnimationFrame(state.raf);
        observer.disconnect();
        window.removeEventListener('resize', resize);
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        renderer.domElement.removeEventListener('pointerdown', onPointerDown);
        renderer.domElement.removeEventListener('pointermove', onPointerMove);
        renderer.domElement.removeEventListener('pointerup', onPointerUp);
        renderer.domElement.removeEventListener('pointercancel', onPointerUp);
        renderer.domElement.removeEventListener('dblclick', onDoubleClick);
        renderer.domElement.removeEventListener('wheel', onWheel);
        renderer.domElement.removeEventListener('contextmenu', onContextMenu);

        shockwaves.forEach((wave) => {
          ring.group.remove(wave.mesh);
          wave.mesh.geometry.dispose();
          wave.material.dispose();
        });
        meteors.forEach((meteor) => {
          scene.remove(meteor.line);
          meteor.geometry.dispose();
          meteor.material.dispose();
        });
        destinations.dispose();

        [pointTexture, smokeTexture, strokeTexture].forEach((texture) => texture.dispose());
        [stars.geometry, clouds.geometry, motes.geometry, trails.geometry].forEach((geometry) => geometry.dispose());
        [stars.material, clouds.material, motes.material, trails.material].forEach((material) => material.dispose());
        Object.values(ring.materials).forEach((material) => material.dispose());
        Object.values(ring.geometries).forEach((geometry) => geometry.dispose());
        ground.ground.geometry.dispose();
        ground.circle.geometry.dispose();
        ground.sigil.children.forEach((child) => child.geometry.dispose());
        Object.values(ground.materials).forEach((material) => material.dispose());
        obelisks.material.dispose();
        obelisks.topMaterial.dispose();
        voidCore.geometry.dispose();
        voidCoreMaterial.dispose();
        renderer.dispose();
        container.replaceChildren();
        container.classList.remove('ring-universe-shell', 'is-dragging');
      }
    };
  }

  window.createRingUniverseSimulation = createSimulation;
})();
