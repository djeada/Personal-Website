(function() {
    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function rand(min, max) {
        return min + Math.random() * (max - min);
    }

    function setColorAttribute(colors, index, color, strength) {
        const offset = index * 3;
        colors[offset] = color.r * strength;
        colors[offset + 1] = color.g * strength;
        colors[offset + 2] = color.b * strength;
    }

    function createPointTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 96;
        canvas.height = 96;
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createRadialGradient(48, 48, 0, 48, 48, 48);
        gradient.addColorStop(0, 'rgba(255,255,255,1)');
        gradient.addColorStop(0.24, 'rgba(255,245,220,0.9)');
        gradient.addColorStop(0.55, 'rgba(160,190,255,0.32)');
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 96, 96);
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        return texture;
    }

    function createSmokeTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createRadialGradient(64, 64, 8, 64, 64, 64);
        gradient.addColorStop(0, 'rgba(255,255,255,0.55)');
        gradient.addColorStop(0.38, 'rgba(210,170,255,0.22)');
        gradient.addColorStop(0.72, 'rgba(100,130,180,0.08)');
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 128, 128);
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        return texture;
    }

    function createShardGeometry() {
        const geometry = new THREE.ConeGeometry(0.45, 2.8, 5, 1);
        geometry.translate(0, 1.4, 0);
        return geometry;
    }

    function addRuneMarks(group, colors, quality) {
        const runeCount = quality.isMobile ? 20 : 36;
        const runeMaterial = new THREE.MeshBasicMaterial({
            color: colors.rune,
            transparent: true,
            opacity: 0.72,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        for (let i = 0; i < runeCount; i++) {
            const angle = (i / runeCount) * Math.PI * 2;
            const mark = new THREE.Mesh(
                new THREE.BoxGeometry(0.04, i % 3 === 0 ? 0.42 : 0.24, 0.025),
                runeMaterial
            );
            mark.position.set(Math.cos(angle) * 5.1, Math.sin(angle) * 5.1, 0.05);
            mark.rotation.z = angle;
            group.add(mark);
        }

        return runeMaterial;
    }

    function createRingGroup(colors, quality) {
        const group = new THREE.Group();

        const ringMaterial = new THREE.MeshPhysicalMaterial({
            color: colors.iron,
            metalness: 0.98,
            roughness: 0.18,
            clearcoat: 0.85,
            clearcoatRoughness: 0.08,
            emissive: colors.ringGlow,
            emissiveIntensity: 0.18
        });

        const ring = new THREE.Mesh(
            new THREE.TorusGeometry(4.15, 0.38, quality.isMobile ? 28 : 48, quality.isMobile ? 120 : 220),
            ringMaterial
        );
        ring.castShadow = quality.shadows;
        group.add(ring);

        const innerMaterial = new THREE.MeshBasicMaterial({
            color: colors.portal,
            transparent: true,
            opacity: 0.32,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const inner = new THREE.Mesh(new THREE.CircleGeometry(3.62, quality.isMobile ? 80 : 160), innerMaterial);
        group.add(inner);

        const veilMaterial = new THREE.MeshBasicMaterial({
            color: colors.ember,
            transparent: true,
            opacity: 0.16,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const veil = new THREE.Mesh(new THREE.RingGeometry(2.2, 4.95, quality.isMobile ? 80 : 180), veilMaterial);
        group.add(veil);

        const crownMaterial = new THREE.MeshPhysicalMaterial({
            color: colors.bone,
            metalness: 0.55,
            roughness: 0.28,
            emissive: colors.ember,
            emissiveIntensity: 0.18
        });
        const shardGeometry = createShardGeometry();
        const shardCount = quality.isMobile ? 12 : 22;
        const shards = [];
        for (let i = 0; i < shardCount; i++) {
            const angle = (i / shardCount) * Math.PI * 2;
            const shard = new THREE.Mesh(shardGeometry, crownMaterial);
            const radius = 4.85 + (i % 2) * 0.36;
            shard.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, -0.18);
            shard.rotation.z = angle - Math.PI / 2;
            shard.rotation.x = rand(-0.35, 0.35);
            shard.scale.setScalar(rand(0.55, 1.25));
            shard.castShadow = quality.shadows;
            group.add(shard);
            shards.push(shard);
        }

        const runeMaterial = addRuneMarks(group, colors, quality);

        return {
            group,
            ring,
            inner,
            veil,
            shards,
            materials: {
                ringMaterial,
                innerMaterial,
                veilMaterial,
                crownMaterial,
                runeMaterial
            }
        };
    }

    function createStars(count, texture, colors) {
        const positions = new Float32Array(count * 3);
        const starColors = new Float32Array(count * 3);
        const phases = new Float32Array(count);
        const speeds = new Float32Array(count);

        const cold = new THREE.Color(colors.starCold);
        const warm = new THREE.Color(colors.starWarm);
        const pale = new THREE.Color(colors.starPale);

        for (let i = 0; i < count; i++) {
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(rand(-1, 1));
            const radius = rand(95, 720);
            const offset = i * 3;
            positions[offset] = radius * Math.sin(phi) * Math.cos(theta);
            positions[offset + 1] = radius * Math.sin(phi) * Math.sin(theta) * 0.72 + rand(-20, 28);
            positions[offset + 2] = radius * Math.cos(phi);
            setColorAttribute(starColors, i, Math.random() < 0.16 ? warm : Math.random() < 0.45 ? cold : pale, rand(0.35, 1.1));
            phases[i] = Math.random() * Math.PI * 2;
            speeds[i] = rand(0.25, 1.5);
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
        const material = new THREE.PointsMaterial({
            map: texture,
            size: 2.5,
            sizeAttenuation: true,
            vertexColors: true,
            transparent: true,
            opacity: 0.86,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        return {
            points: new THREE.Points(geometry, material),
            colors: starColors,
            baseColors: starColors.slice(),
            phases,
            speeds
        };
    }

    function createClouds(count, texture, colors) {
        const positions = new Float32Array(count * 3);
        const cloudColors = new Float32Array(count * 3);
        const data = [];
        const violet = new THREE.Color(colors.nebulaViolet);
        const cyan = new THREE.Color(colors.nebulaCyan);
        const red = new THREE.Color(colors.blood);

        for (let i = 0; i < count; i++) {
            const arm = i % 3;
            const angle = (i / count) * Math.PI * 9 + arm * 2.1 + rand(-0.35, 0.35);
            const radius = rand(24, 135);
            const offset = i * 3;
            positions[offset] = Math.cos(angle) * radius;
            positions[offset + 1] = rand(-28, 45) + Math.sin(angle * 0.5) * 10;
            positions[offset + 2] = Math.sin(angle) * radius - 45;
            setColorAttribute(cloudColors, i, arm === 0 ? violet : arm === 1 ? cyan : red, rand(0.32, 0.85));
            data.push({
                drift: rand(0.015, 0.055),
                phase: rand(0, Math.PI * 2),
                lift: rand(0.3, 1.6)
            });
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(cloudColors, 3));
        const material = new THREE.PointsMaterial({
            map: texture,
            size: 15,
            sizeAttenuation: true,
            vertexColors: true,
            transparent: true,
            opacity: 0.28,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        return {
            points: new THREE.Points(geometry, material),
            positions,
            data
        };
    }

    function createOrbitParticles(count, texture, colors) {
        const positions = new Float32Array(count * 3);
        const particleColors = new Float32Array(count * 3);
        const data = [];
        const portal = new THREE.Color(colors.portal);
        const ember = new THREE.Color(colors.ember);
        const ghost = new THREE.Color(colors.ghost);

        for (let i = 0; i < count; i++) {
            const radius = rand(2.0, 9.6);
            const angle = Math.random() * Math.PI * 2;
            const y = rand(-3.0, 3.0);
            const offset = i * 3;
            positions[offset] = Math.cos(angle) * radius;
            positions[offset + 1] = y;
            positions[offset + 2] = Math.sin(angle) * radius;
            setColorAttribute(particleColors, i, i % 5 === 0 ? ember : i % 3 === 0 ? ghost : portal, rand(0.55, 1.3));
            data.push({
                angle,
                radius,
                y,
                speed: rand(0.35, 1.35) * (Math.random() < 0.5 ? -1 : 1),
                wobble: rand(0.5, 2.4)
            });
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));
        const material = new THREE.PointsMaterial({
            map: texture,
            size: 2.6,
            sizeAttenuation: true,
            vertexColors: true,
            transparent: true,
            opacity: 0.72,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        return {
            points: new THREE.Points(geometry, material),
            positions,
            data
        };
    }

    function createObelisks(scene, colors, quality) {
        const material = new THREE.MeshPhysicalMaterial({
            color: colors.obsidian,
            roughness: 0.5,
            metalness: 0.36,
            emissive: colors.blood,
            emissiveIntensity: 0.06
        });
        const topMaterial = new THREE.MeshBasicMaterial({
            color: colors.ember,
            transparent: true,
            opacity: 0.42,
            blending: THREE.AdditiveBlending
        });
        const count = quality.isMobile ? 12 : 24;
        const obelisks = [];

        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2 + rand(-0.08, 0.08);
            const radius = rand(17, 43);
            const height = rand(5, 19);
            const group = new THREE.Group();
            group.position.set(Math.cos(angle) * radius, -7.4, Math.sin(angle) * radius - 8);
            group.rotation.y = -angle + rand(-0.45, 0.45);

            const body = new THREE.Mesh(new THREE.ConeGeometry(rand(0.55, 1.2), height, 5), material);
            body.position.y = height * 0.5;
            body.castShadow = quality.shadows;
            group.add(body);

            const ember = new THREE.Mesh(new THREE.SphereGeometry(rand(0.12, 0.28), 10, 8), topMaterial);
            ember.position.y = height + 0.16;
            group.add(ember);

            scene.add(group);
            obelisks.push({
                group,
                ember,
                phase: rand(0, Math.PI * 2),
                baseHeight: height
            });
        }

        return {
            obelisks,
            material,
            topMaterial
        };
    }

    function createGround(scene, colors, quality) {
        const groundMaterial = new THREE.MeshPhysicalMaterial({
            color: colors.ground,
            roughness: 0.92,
            metalness: 0.08,
            emissive: colors.nebulaViolet,
            emissiveIntensity: 0.035
        });
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(190, 190, 20, 20), groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -7.5;
        ground.receiveShadow = quality.shadows;
        scene.add(ground);

        const circleMaterial = new THREE.MeshBasicMaterial({
            color: colors.portal,
            transparent: true,
            opacity: 0.12,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const circle = new THREE.Mesh(new THREE.RingGeometry(5.8, 28, 128), circleMaterial);
        circle.rotation.x = -Math.PI / 2;
        circle.position.y = -7.35;
        scene.add(circle);

        return {
            ground,
            circle,
            materials: {
                groundMaterial,
                circleMaterial
            }
        };
    }

    function createSimulation(container, options) {
        if (!window.THREE) {
            return null;
        }

        const isMobile = window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const quality = {
            isMobile,
            shadows: !isMobile,
            pixelRatio: isMobile ? 1 : Math.min(window.devicePixelRatio || 1, 2),
            stars: isMobile ? 950 : 2600,
            clouds: isMobile ? 80 : 190,
            motes: isMobile ? 220 : 620
        };

        const palettes = {
            dark: {
                background: 0x05040b,
                fog: 0x090716,
                iron: 0x24202a,
                ringGlow: 0xa277ff,
                portal: 0x80f7ff,
                ember: 0xff8a3d,
                rune: 0xd8c4ff,
                bone: 0xb8a489,
                ghost: 0xbaf7e8,
                blood: 0x8d1637,
                obsidian: 0x09090d,
                ground: 0x08070c,
                nebulaViolet: 0x5e3b99,
                nebulaCyan: 0x257c91,
                starCold: 0x9fc8ff,
                starWarm: 0xffc28b,
                starPale: 0xf4f0ff
            },
            light: {
                background: 0x080914,
                fog: 0x101126,
                iron: 0x302b36,
                ringGlow: 0x9a8cff,
                portal: 0x9df9ff,
                ember: 0xff9d4d,
                rune: 0xe2d8ff,
                bone: 0xc4b093,
                ghost: 0xc8fff2,
                blood: 0xa51d3d,
                obsidian: 0x101017,
                ground: 0x0d0c14,
                nebulaViolet: 0x6d4db3,
                nebulaCyan: 0x2d8ba0,
                starCold: 0xaed4ff,
                starWarm: 0xffc994,
                starPale: 0xffffff
            }
        };

        let darkMode = Boolean(options.getDarkMode && options.getDarkMode());
        let colors = darkMode ? palettes.dark : palettes.light;

        const scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(colors.fog, isMobile ? 0.012 : 0.007);

        const camera = new THREE.PerspectiveCamera(isMobile ? 76 : 66, 1, 0.1, 1400);
        camera.position.set(0, 7, isMobile ? 31 : 38);

        const renderer = new THREE.WebGLRenderer({
            alpha: true,
            antialias: !isMobile,
            powerPreference: isMobile ? 'default' : 'high-performance'
        });
        renderer.setPixelRatio(quality.pixelRatio);
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setClearColor(colors.background, 1);
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.18;
        if (quality.shadows) {
            renderer.shadowMap.enabled = true;
            renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        }
        container.appendChild(renderer.domElement);

        const pointTexture = createPointTexture();
        const smokeTexture = createSmokeTexture();

        scene.add(new THREE.HemisphereLight(0x95b8ff, 0x18050b, isMobile ? 0.58 : 0.42));

        const moonLight = new THREE.DirectionalLight(0xd9e7ff, isMobile ? 0.9 : 1.15);
        moonLight.position.set(-25, 46, 18);
        moonLight.castShadow = quality.shadows;
        if (quality.shadows) {
            moonLight.shadow.mapSize.set(2048, 2048);
            moonLight.shadow.camera.left = -55;
            moonLight.shadow.camera.right = 55;
            moonLight.shadow.camera.top = 55;
            moonLight.shadow.camera.bottom = -55;
        }
        scene.add(moonLight);

        const portalLight = new THREE.PointLight(colors.portal, 5.4, 86, 1.45);
        portalLight.position.set(0, 2, 0);
        scene.add(portalLight);

        const emberLight = new THREE.PointLight(colors.ember, 2.1, 60, 2);
        emberLight.position.set(10, -1, 6);
        scene.add(emberLight);

        const ring = createRingGroup(colors, quality);
        ring.group.position.set(0, 1.2, 0);
        ring.group.rotation.x = -0.1;
        scene.add(ring.group);

        const stars = createStars(quality.stars, pointTexture, colors);
        scene.add(stars.points);

        const clouds = createClouds(quality.clouds, smokeTexture, colors);
        scene.add(clouds.points);

        const motes = createOrbitParticles(quality.motes, pointTexture, colors);
        scene.add(motes.points);

        const ground = createGround(scene, colors, quality);
        const obelisks = createObelisks(scene, colors, quality);

        const voidCoreMaterial = new THREE.MeshBasicMaterial({
            color: colors.background,
            transparent: true,
            opacity: 0.62,
            side: THREE.BackSide
        });
        const voidCore = new THREE.Mesh(new THREE.SphereGeometry(2.05, 48, 32), voidCoreMaterial);
        ring.group.add(voidCore);

        const state = {
            pointerDown: false,
            pointerX: 0,
            pointerY: 0,
            dragX: 0,
            dragY: 0,
            targetYaw: 0,
            yaw: -0.15,
            pitch: 0.18,
            targetPitch: 0.18,
            distance: isMobile ? 31 : 38,
            targetDistance: isMobile ? 31 : 38,
            pulse: 0,
            visible: true,
            raf: 0,
            disposed: false
        };

        const observer = new IntersectionObserver((entries) => {
            state.visible = entries[0] ? entries[0].isIntersecting : true;
        }, {
            threshold: 0.02
        });
        observer.observe(container);

        function resize() {
            const width = Math.max(1, container.clientWidth);
            const height = Math.max(1, container.clientHeight);
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            renderer.setSize(width, height);
        }

        function launchPulse(strength) {
            state.pulse = Math.max(state.pulse, strength);
            portalLight.intensity = 8 + strength * 6;
            ring.group.scale.setScalar(1 + strength * 0.045);
        }

        function onPointerDown(event) {
            state.pointerDown = true;
            state.pointerX = event.clientX;
            state.pointerY = event.clientY;
            state.dragX = 0;
            state.dragY = 0;
            renderer.domElement.setPointerCapture(event.pointerId);
        }

        function onPointerMove(event) {
            if (!state.pointerDown) return;
            const dx = event.clientX - state.pointerX;
            const dy = event.clientY - state.pointerY;
            state.pointerX = event.clientX;
            state.pointerY = event.clientY;
            state.dragX += Math.abs(dx);
            state.dragY += Math.abs(dy);
            state.targetYaw += dx * 0.006;
            state.targetPitch = clamp(state.targetPitch + dy * 0.0035, -0.28, 0.85);
            ring.group.rotation.z += dx * 0.002;
            ring.group.rotation.x += dy * 0.0015;
        }

        function onPointerUp(event) {
            if (state.pointerDown && state.dragX + state.dragY < 8) {
                launchPulse(1);
            }
            state.pointerDown = false;
            if (renderer.domElement.hasPointerCapture(event.pointerId)) {
                renderer.domElement.releasePointerCapture(event.pointerId);
            }
        }

        function onDoubleClick() {
            launchPulse(1.8);
        }

        function onWheel(event) {
            event.preventDefault();
            state.targetDistance = clamp(state.targetDistance + event.deltaY * 0.035, isMobile ? 18 : 20, 72);
        }

        function onKeyDown(event) {
            if (!container.matches(':hover')) return;
            if (event.code === 'KeyR') {
                state.targetYaw = 0;
                state.targetPitch = 0.18;
                state.targetDistance = isMobile ? 31 : 38;
                launchPulse(1.2);
            }
            if (event.code === 'Space') {
                event.preventDefault();
                launchPulse(1.5);
            }
        }

        renderer.domElement.addEventListener('pointerdown', onPointerDown);
        renderer.domElement.addEventListener('pointermove', onPointerMove);
        renderer.domElement.addEventListener('pointerup', onPointerUp);
        renderer.domElement.addEventListener('pointercancel', onPointerUp);
        renderer.domElement.addEventListener('dblclick', onDoubleClick);
        renderer.domElement.addEventListener('wheel', onWheel, {
            passive: false
        });
        window.addEventListener('resize', resize);
        window.addEventListener('keydown', onKeyDown);

        const clock = new THREE.Clock();
        let frame = 0;

        function applyPalette(nextColors) {
            colors = nextColors;
            renderer.setClearColor(colors.background, 1);
            scene.fog.color.setHex(colors.fog);
            portalLight.color.setHex(colors.portal);
            emberLight.color.setHex(colors.ember);
            ring.materials.ringMaterial.color.setHex(colors.iron);
            ring.materials.ringMaterial.emissive.setHex(colors.ringGlow);
            ring.materials.innerMaterial.color.setHex(colors.portal);
            ring.materials.veilMaterial.color.setHex(colors.ember);
            ring.materials.crownMaterial.color.setHex(colors.bone);
            ring.materials.crownMaterial.emissive.setHex(colors.ember);
            ring.materials.runeMaterial.color.setHex(colors.rune);
            ground.materials.groundMaterial.color.setHex(colors.ground);
            ground.materials.circleMaterial.color.setHex(colors.portal);
            obelisks.material.color.setHex(colors.obsidian);
            obelisks.material.emissive.setHex(colors.blood);
            obelisks.topMaterial.color.setHex(colors.ember);
            voidCoreMaterial.color.setHex(colors.background);
        }

        function animate() {
            state.raf = requestAnimationFrame(animate);
            if (state.disposed || !state.visible) return;

            const dt = Math.min(clock.getDelta(), 0.05);
            const t = clock.elapsedTime;
            frame++;

            const nextDarkMode = Boolean(options.getDarkMode && options.getDarkMode());
            if (nextDarkMode !== darkMode) {
                darkMode = nextDarkMode;
                applyPalette(darkMode ? palettes.dark : palettes.light);
            }

            state.pulse = Math.max(0, state.pulse - dt * 1.75);
            const pulse = state.pulse;
            const breathing = 0.5 + 0.5 * Math.sin(t * 1.15);
            const slowBreath = 0.5 + 0.5 * Math.sin(t * 0.32);

            ring.group.scale.lerp(new THREE.Vector3(1 + pulse * 0.08, 1 + pulse * 0.08, 1 + pulse * 0.08), 0.08);
            ring.group.rotation.y += dt * (0.16 + pulse * 0.28);
            ring.group.rotation.z += dt * 0.035;
            ring.inner.rotation.z -= dt * (0.32 + pulse * 0.9);
            ring.veil.rotation.z += dt * (0.17 + pulse * 0.5);
            ring.inner.scale.setScalar(1 + breathing * 0.035 + pulse * 0.08);
            ring.veil.scale.setScalar(1 + slowBreath * 0.08 + pulse * 0.12);
            ring.materials.innerMaterial.opacity = 0.24 + breathing * 0.12 + pulse * 0.18;
            ring.materials.veilMaterial.opacity = 0.12 + slowBreath * 0.09 + pulse * 0.16;
            ring.materials.ringMaterial.emissiveIntensity = 0.16 + breathing * 0.12 + pulse * 0.65;
            ring.materials.runeMaterial.opacity = 0.42 + breathing * 0.36 + pulse * 0.22;
            voidCore.scale.setScalar(1 + slowBreath * 0.08 + pulse * 0.12);
            voidCoreMaterial.opacity = 0.52 + pulse * 0.14;

            for (let i = 0; i < ring.shards.length; i++) {
                ring.shards[i].position.z = -0.22 + Math.sin(t * 1.4 + i * 0.7) * 0.18 + pulse * 0.22;
                ring.shards[i].rotation.x += dt * (0.04 + (i % 3) * 0.01);
            }

            const motePositions = motes.positions;
            for (let i = 0; i < motes.data.length; i++) {
                const mote = motes.data[i];
                mote.angle += dt * mote.speed * (1 + pulse * 1.5);
                const radius = mote.radius + Math.sin(t * mote.wobble + i) * 0.25 + pulse * 0.8;
                const offset = i * 3;
                motePositions[offset] = Math.cos(mote.angle) * radius;
                motePositions[offset + 1] = mote.y + Math.sin(t * 1.7 + i) * 0.65 + pulse * rand(-0.025, 0.025);
                motePositions[offset + 2] = Math.sin(mote.angle) * radius;
            }
            motes.points.geometry.attributes.position.needsUpdate = true;
            motes.points.rotation.y = t * 0.08;
            motes.points.material.opacity = 0.58 + pulse * 0.25;

            if (frame % (isMobile ? 3 : 1) === 0) {
                const cloudPositions = clouds.positions;
                for (let i = 0; i < clouds.data.length; i++) {
                    const cloud = clouds.data[i];
                    const offset = i * 3;
                    cloudPositions[offset] += Math.sin(t * cloud.drift + cloud.phase) * 0.018;
                    cloudPositions[offset + 1] += Math.cos(t * cloud.drift * 0.8 + cloud.phase) * 0.012 * cloud.lift;
                }
                clouds.points.geometry.attributes.position.needsUpdate = true;
            }
            clouds.points.rotation.y = t * 0.018;
            clouds.points.rotation.x = Math.sin(t * 0.08) * 0.09;
            clouds.points.material.opacity = 0.22 + slowBreath * 0.08;

            if (frame % (isMobile ? 8 : 4) === 0) {
                const updateCount = isMobile ? Math.floor(quality.stars / 18) : Math.floor(quality.stars / 8);
                for (let i = 0; i < updateCount; i++) {
                    const index = (frame * 17 + i * 23) % quality.stars;
                    const offset = index * 3;
                    const twinkle = 0.72 + Math.sin(t * stars.speeds[index] + stars.phases[index]) * 0.28;
                    stars.colors[offset] = stars.baseColors[offset] * twinkle;
                    stars.colors[offset + 1] = stars.baseColors[offset + 1] * twinkle;
                    stars.colors[offset + 2] = stars.baseColors[offset + 2] * twinkle;
                }
                stars.points.geometry.attributes.color.needsUpdate = true;
            }
            stars.points.rotation.y = t * 0.0025;
            stars.points.rotation.x = t * 0.0009;

            ground.circle.rotation.z -= dt * (0.06 + pulse * 0.15);
            ground.materials.circleMaterial.opacity = 0.08 + slowBreath * 0.05 + pulse * 0.16;

            for (let i = 0; i < obelisks.obelisks.length; i++) {
                const item = obelisks.obelisks[i];
                item.group.position.y = -7.4 + Math.sin(t * 0.7 + item.phase) * 0.12;
                item.ember.scale.setScalar(1 + Math.sin(t * 2.5 + item.phase) * 0.32 + pulse * 0.6);
            }

            portalLight.intensity += ((4.8 + breathing * 1.8 + pulse * 8) - portalLight.intensity) * 0.08;
            portalLight.position.set(Math.sin(t * 0.8) * 1.5, 1.4 + Math.sin(t * 1.1) * 0.8, Math.cos(t * 0.7) * 1.5);
            emberLight.intensity = 1.4 + slowBreath * 1.3 + pulse * 3;
            emberLight.position.set(Math.sin(t * 0.43) * 18, -2 + Math.sin(t * 0.7) * 2, Math.cos(t * 0.37) * 18);

            state.yaw += (state.targetYaw - state.yaw) * 0.075;
            state.pitch += (state.targetPitch - state.pitch) * 0.075;
            state.distance += (state.targetDistance - state.distance) * 0.08;
            if (!state.pointerDown) {
                state.targetYaw += dt * 0.055;
            }

            const height = 7 + state.pitch * 13 + Math.sin(t * 0.3) * 1.4;
            camera.position.x = Math.sin(state.yaw) * state.distance;
            camera.position.z = Math.cos(state.yaw) * state.distance + 8;
            camera.position.y = height;
            camera.lookAt(0, 0.15, 0);

            renderer.render(scene, camera);
        }

        resize();
        animate();

        const controls = document.createElement('div');
        controls.className = 'ring-universe-controls';
        controls.innerHTML = isMobile ? 'Tap pulse | drag orbit' : 'Click pulse | drag orbit | wheel depth | R reset';
        container.appendChild(controls);
        window.setTimeout(() => controls.classList.add('is-muted'), 7000);

        return {
            dispose() {
                state.disposed = true;
                cancelAnimationFrame(state.raf);
                observer.disconnect();
                window.removeEventListener('resize', resize);
                window.removeEventListener('keydown', onKeyDown);
                renderer.domElement.removeEventListener('pointerdown', onPointerDown);
                renderer.domElement.removeEventListener('pointermove', onPointerMove);
                renderer.domElement.removeEventListener('pointerup', onPointerUp);
                renderer.domElement.removeEventListener('pointercancel', onPointerUp);
                renderer.domElement.removeEventListener('dblclick', onDoubleClick);
                renderer.domElement.removeEventListener('wheel', onWheel);
                renderer.dispose();
                pointTexture.dispose();
                smokeTexture.dispose();
                container.replaceChildren();
            }
        };
    }

    window.createRingUniverseSimulation = createSimulation;
})();
