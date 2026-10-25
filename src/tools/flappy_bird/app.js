(() => {
    'use strict';

    const W = 960;
    const H = 600;
    const TAU = Math.PI * 2;
    const STEP = 1 / 60;
    const MAX_STEPS = 6;
    const GATE_WIDTH = 74;
    const GATE_PADDING = 13;
    const MAX_PARTICLES = 96;
    const MAX_TRAIL = 10;
    const CONFIG = {
        easy: { speed: 155, gap: 190, gravity: 900, flap: -340 },
        normal: { speed: 180, gap: 170, gravity: 980, flap: -365 },
        hard: { speed: 205, gap: 150, gravity: 1040, flap: -380 },
        insane: { speed: 230, gap: 136, gravity: 1100, flap: -395 }
    };
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const rand = (min, max) => min + Math.random() * (max - min);
    const lerp = (from, to, amount) => from + (to - from) * amount;
    const $ = selector => document.querySelector(selector);
    const canvas = $('#canvas');
    const ctx = canvas.getContext('2d', { alpha: false });
    const ui = {
        overlay: $('#game-overlay'), title: $('#overlay-title'), copy: $('#overlay-copy'),
        kicker: $('#overlay-kicker'), start: $('#start-btn'), score: $('#score-label'),
        best: $('#hs-badge'), pause: $('#pause-btn'), mute: $('#mute-btn'),
        restart: $('#restart-btn'), difficulty: $('#difficulty'), skin: $('#bird-skin'),
        theme: $('#theme-mode')
    };
    const startLabel = ui.start.querySelector('span');

    // Storage can be unavailable in private browsing or embedded pages.
    const storage = {
        get(key, fallback) {
            try { return localStorage.getItem(key) ?? fallback; } catch (_) { return fallback; }
        },
        set(key, value) {
            try { localStorage.setItem(key, String(value)); } catch (_) {}
        }
    };
    const best = Number(storage.get('flappy_highscore', 0));
    const settings = {
        best: Number.isSafeInteger(best) && best > 0 ? best : 0,
        muted: storage.get('moonveil_muted', '0') === '1'
    };
    for (const [name, key, fallback] of [
        ['difficulty', 'moonveil_difficulty', 'normal'],
        ['skin', 'flappy_bird_skin', 'ember'],
        ['theme', 'flappy_theme', 'auto']
    ]) {
        const value = storage.get(key, fallback);
        ui[name].value = Array.from(ui[name].options).some(option => option.value === value) ? value : fallback;
    }
    let flight = CONFIG[ui.difficulty.value];

    const night = (() => {
        const probe = document.createElement('div');
        probe.className = 'dark-mode';
        probe.hidden = true;
        document.body.appendChild(probe);
        const style = getComputedStyle(probe);
        const colors = {};
        for (const key of ['bg', 'canvas', 'panel-2', 'rule-strong', 'ink', 'ink-2', 'ink-3', 'gold', 'verdigris', 'moon', 'ember']) {
            colors[key] = style.getPropertyValue(`--g-${key}`).trim();
        }
        probe.remove();
        return colors;
    })();
    const skins = {
        ember: [night.gold, night.ember], frost: [night.moon, night['ink-3']],
        moss: [night.verdigris, night['rule-strong']], spirit: [night.ink, night.moon]
    };
    let birdColors = skins[ui.skin.value];
    const bodyPath = new Path2D();
    bodyPath.ellipse(0, 0, 23, 17, -.08, 0, TAU);
    const tailPath = new Path2D('M-17 2 Q-35-9-40 1 Q-29 11-14 10 Z');
    const beakPath = new Path2D('M18-3 L33 1 L18 6 Z');
    const runePath = new Path2D();
    const runeRadius = 70;
    for (let i = 0; i < 8; i++) {
        const angle = i * TAU / 8;
        const sin = Math.sin(angle);
        const cos = Math.cos(angle);
        runePath.moveTo(-3 * cos - runeRadius * sin, -3 * sin + runeRadius * cos);
        runePath.lineTo(-(runeRadius + 7) * sin, (runeRadius + 7) * cos);
        runePath.lineTo(3 * cos - runeRadius * sin, 3 * sin + runeRadius * cos);
        runePath.closePath();
    }

    const background = new Image();
    const backgroundLayer = document.createElement('canvas');
    const backgroundCtx = backgroundLayer.getContext('2d', { alpha: false });
    const particlePool = Array.from({ length: MAX_PARTICLES }, () => ({}));
    const trailPool = Array.from({ length: MAX_TRAIL }, () => ({}));
    const gatePool = [];
    const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
    let reducedMotion = motionQuery.matches;
    let frameId = 0;
    let endTimer = 0;
    let audio = null;
    const state = {
        mode: 'ready', score: 0, best: settings.best, runBest: settings.best,
        time: 0, previousTime: 0, distance: 0, previousDistance: 0,
        last: null, acc: 0, flash: 0, nextGate: 650, trailClock: 0,
        gates: [], particles: [], trail: [],
        fireflies: Array.from({ length: 12 }, () => ({
            x: rand(0, W), y: rand(30, H - 80), r: rand(1, 2.2), phase: rand(0, TAU)
        })),
        bird: { x: 220, y: H * .48, previousY: H * .48, vy: 0, rot: 0, previousRot: 0, wing: 0 }
    };

    function requestFrame() {
        if (!frameId && !document.hidden) frameId = requestAnimationFrame(loop);
    }

    function stopAnimation() {
        cancelAnimationFrame(frameId);
        frameId = 0;
        state.last = null;
        state.acc = 0;
    }

    function cacheBackground() {
        backgroundLayer.width = canvas.width;
        backgroundLayer.height = canvas.height;
        backgroundCtx.fillStyle = night.canvas;
        backgroundCtx.fillRect(0, 0, canvas.width, canvas.height);
        if (background.complete && background.naturalWidth) {
            backgroundCtx.filter = 'saturate(0.5) brightness(0.88)';
            backgroundCtx.drawImage(background, 0, 0, canvas.width, canvas.height);
            backgroundCtx.filter = 'none';
        }
        const theme = ui.theme.value;
        backgroundCtx.globalAlpha = theme === 'day' ? .1 : theme === 'night' ? .24 : .08;
        backgroundCtx.fillStyle = theme === 'day' ? night.ember : night.bg;
        backgroundCtx.fillRect(0, 0, canvas.width, canvas.height);
        backgroundCtx.globalAlpha = 1;
    }

    function resize() {
        const rect = canvas.getBoundingClientRect();
        const dpr = Math.min(devicePixelRatio || 1, innerWidth < 700 ? 1 : 1.25);
        const width = Math.max(1, Math.round(rect.width * dpr));
        const height = Math.max(1, Math.round(rect.height * dpr));
        if (canvas.width === width && canvas.height === height && backgroundLayer.width === width && backgroundLayer.height === height) return;
        canvas.width = width;
        canvas.height = height;
        cacheBackground();
        for (const gate of state.gates) cacheGate(gate);
        requestFrame();
    }

    function persistBest() {
        if (state.best <= settings.best) return;
        storage.set('flappy_highscore', state.best);
        settings.best = state.best;
    }

    function recycleAll(active, pool) {
        while (active.length) pool.push(active.pop());
    }

    function reset(start = false) {
        persistBest();
        stopAnimation();
        clearTimeout(endTimer);
        endTimer = 0;
        recycleAll(state.gates, gatePool);
        recycleAll(state.particles, particlePool);
        recycleAll(state.trail, trailPool);
        Object.assign(state, {
            mode: start ? 'playing' : 'ready', score: 0, runBest: state.best,
            time: 0, previousTime: 0, distance: 0, previousDistance: 0,
            flash: 0, nextGate: 650, trailClock: 0
        });
        Object.assign(state.bird, { y: H * .48, previousY: H * .48, vy: 0, rot: 0, previousRot: 0, wing: 0 });
        ui.score.textContent = '0';
        ui.pause.disabled = !start;
        ui.pause.textContent = 'Pause';
        ui.pause.setAttribute('aria-label', 'Pause game');
        if (start) {
            hideOverlay();
            state.bird.vy = flight.flap;
            sound('flap');
        } else {
            showOverlay('THE WOODS ARE LISTENING', 'Ready to fly?', 'Glide between ancient gates and collect their light.', 'Begin flight');
        }
        requestFrame();
    }

    function flap() {
        if (state.mode === 'ready' || state.mode === 'over') return reset(true);
        if (state.mode !== 'playing') return;
        state.bird.vy = flight.flap;
        state.bird.wing = 1;
        burst(state.bird.x - 12, state.bird.y, 7, night.gold, .7);
        sound('flap');
    }

    function spawnGate() {
        const previous = state.gates.at(-1)?.gapY ?? H * .48;
        const gate = gatePool.pop() || { layer: document.createElement('canvas') };
        Object.assign(gate, {
            x: W + 75, previousX: W + 75,
            gapY: clamp(previous + rand(-125, 125), 135, H - 135),
            gap: flight.gap, passed: false, seed: Math.random() * 99
        });
        cacheGate(gate);
        state.gates.push(gate);
        state.nextGate = rand(320, 390);
    }

    // Each gate's stonework is rasterized once, then copied until it leaves the screen.
    function cacheGate(gate) {
        const width = GATE_WIDTH + GATE_PADDING * 2;
        gate.layer.width = Math.max(1, Math.ceil(width * canvas.width / W));
        gate.layer.height = canvas.height;
        const target = gate.layer.getContext('2d');
        target.setTransform(gate.layer.width / width, 0, 0, canvas.height / H, 0, 0);
        pillar(target, 0, gate.gapY - gate.gap / 2, true);
        pillar(target, gate.gapY + gate.gap / 2, H, false);
    }

    function pillar(target, y, end, top) {
        const height = end - y;
        const edge = top ? end : y;
        const x = GATE_PADDING;
        target.fillStyle = night.bg;
        target.fillRect(x - 5, y, GATE_WIDTH + 10, height);
        target.fillStyle = night['ink-2'];
        target.fillRect(x, y, GATE_WIDTH, height);
        target.fillStyle = night.ink;
        target.fillRect(x + 18, y, GATE_WIDTH - 36, height);
        target.strokeStyle = night['rule-strong'];
        target.lineWidth = 2;
        target.strokeRect(x + 7, y, GATE_WIDTH - 14, height);
        target.fillStyle = night['panel-2'];
        target.fillRect(0, top ? edge - 25 : edge, GATE_WIDTH + GATE_PADDING * 2, 25);
        target.fillStyle = night.gold;
        target.fillRect(0, top ? edge - 3 : edge, GATE_WIDTH + GATE_PADDING * 2, 3);
        for (let i = 0; i < 3; i++) {
            const cx = x + 17.5 + i * 21;
            const cy = top ? edge - 13.5 : edge + 13.5;
            target.beginPath();
            target.moveTo(cx, cy - 4);
            target.lineTo(cx + 4, cy);
            target.lineTo(cx, cy + 4);
            target.lineTo(cx - 4, cy);
            target.closePath();
            target.fill();
        }
    }

    function update(dt) {
        if (state.mode === 'playing') {
            const bird = state.bird;
            state.previousTime = state.time;
            state.previousDistance = state.distance;
            bird.previousY = bird.y;
            bird.previousRot = bird.rot;
            state.time += dt;
            const travel = flight.speed * dt;
            state.distance += travel;
            state.nextGate -= travel;
            if (state.nextGate <= 0) spawnGate();
            bird.vy = Math.min(bird.vy + flight.gravity * dt, 620);
            bird.y += bird.vy * dt;
            bird.rot = clamp(bird.vy / 650, -.5, 1);
            bird.wing = Math.max(0, bird.wing - dt * 5);
            state.trailClock += dt;
            if (!reducedMotion && state.trailClock >= .08 && trailPool.length) {
                state.trailClock %= .08;
                const trail = trailPool.pop();
                trail.x = bird.x - 19;
                trail.y = bird.y + rand(-2, 2);
                trail.life = 1;
                state.trail.push(trail);
            }
            let count = 0;
            for (const gate of state.gates) {
                gate.previousX = gate.x;
                gate.x -= travel;
                if (!gate.passed && gate.x + GATE_WIDTH < bird.x) {
                    gate.passed = true;
                    state.score++;
                    ui.score.textContent = state.score;
                    if (state.score > state.best) {
                        state.best = state.score;
                        ui.best.textContent = state.best;
                    }
                    burst(gate.x + GATE_WIDTH / 2, gate.gapY, 12, night.gold, .8);
                    state.flash = reducedMotion ? 0 : .12;
                    sound('score');
                }
                if (gate.x > -120) state.gates[count++] = gate;
                else gatePool.push(gate);
            }
            state.gates.length = count;
            if (collides() || bird.y < -30 || bird.y > H - 35) end();
        }
        updateEffects(dt);
    }

    function updateEffects(dt) {
        for (let i = state.trail.length - 1; i >= 0; i--) {
            const trail = state.trail[i];
            trail.x -= flight.speed * .3 * dt;
            trail.life -= dt * 2;
            if (trail.life <= 0) {
                state.trail[i] = state.trail[state.trail.length - 1];
                state.trail.pop();
                trailPool.push(trail);
            }
        }
        for (let i = state.particles.length - 1; i >= 0; i--) {
            const particle = state.particles[i];
            particle.x += particle.vx * dt;
            particle.y += particle.vy * dt;
            particle.vy += 45 * dt;
            particle.life -= dt;
            if (particle.life <= 0) {
                state.particles[i] = state.particles[state.particles.length - 1];
                state.particles.pop();
                particlePool.push(particle);
            }
        }
        state.flash = Math.max(0, state.flash - dt);
    }

    function collides() {
        const bird = state.bird;
        const radius = 12;
        for (const gate of state.gates) {
            if (bird.x + radius > gate.x + 5 && bird.x - radius < gate.x + GATE_WIDTH - 5 &&
                (bird.y - radius < gate.gapY - gate.gap / 2 + 4 || bird.y + radius > gate.gapY + gate.gap / 2 - 4)) return true;
        }
        return false;
    }

    function end() {
        if (state.mode !== 'playing') return;
        state.mode = 'over';
        ui.pause.disabled = true;
        persistBest();
        sound('hit');
        burst(state.bird.x, state.bird.y, 14, night.ember, .8);
        endTimer = setTimeout(() => {
            endTimer = 0;
            if (state.mode !== 'over') return;
            showOverlay(state.score > state.runBest ? 'A NEW LEGEND' : 'THE FOREST REMEMBERS',
                state.score ? `${state.score} gate${state.score === 1 ? '' : 's'} crossed` : 'The first gate awaits',
                `Best flight: ${state.best} gates. The moonwing is ready to try again.`, 'Fly again');
        }, 180);
    }

    function pause() {
        if (state.mode === 'playing') {
            state.mode = 'paused';
            persistBest();
            stopAnimation();
            showOverlay('A QUIET MOMENT', 'Flight paused', 'The forest will wait for you.', 'Continue');
            ui.pause.textContent = 'Resume';
            ui.pause.setAttribute('aria-label', 'Resume game');
        } else if (state.mode === 'paused') {
            state.mode = 'playing';
            stopAnimation();
            hideOverlay();
            ui.pause.textContent = 'Pause';
            ui.pause.setAttribute('aria-label', 'Pause game');
        }
        requestFrame();
    }

    function showOverlay(kicker, title, copy, button) {
        ui.kicker.textContent = kicker;
        ui.title.textContent = title;
        ui.copy.textContent = copy;
        startLabel.textContent = button;
        ui.overlay.inert = false;
        ui.overlay.setAttribute('aria-hidden', 'false');
        ui.overlay.classList.add('is-visible');
    }

    function hideOverlay() {
        canvas.focus({ preventScroll: true });
        ui.overlay.inert = true;
        ui.overlay.setAttribute('aria-hidden', 'true');
        ui.overlay.classList.remove('is-visible');
    }

    function render(alpha) {
        // The backdrop matches the backing store: no full-screen resampling or tint pass per frame.
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(backgroundLayer, 0, 0);
        ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
        const time = lerp(state.previousTime, state.time, alpha);
        const distance = lerp(state.previousDistance, state.distance, alpha);
        drawFireflies(time, distance);
        drawGates(alpha, time);
        ctx.fillStyle = night.gold;
        for (const trail of state.trail) {
            ctx.globalAlpha = trail.life * .4;
            ctx.fillRect(trail.x, trail.y, 3 * trail.life, 3 * trail.life);
        }
        for (const particle of state.particles) {
            ctx.globalAlpha = clamp(particle.life / particle.max, 0, 1);
            ctx.fillStyle = particle.color;
            ctx.beginPath();
            ctx.arc(particle.x, particle.y, particle.r, 0, TAU);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        drawBird(alpha, time);
        ctx.globalAlpha = .22;
        ctx.fillStyle = night.bg;
        ctx.fillRect(0, H - 45, W, 45);
        if (state.flash) {
            ctx.globalAlpha = state.flash * .35;
            ctx.fillStyle = night.gold;
            ctx.fillRect(0, 0, W, H);
        }
        ctx.globalAlpha = 1;
    }

    function drawFireflies(time, distance) {
        ctx.fillStyle = night.gold;
        for (const firefly of state.fireflies) {
            const x = ((firefly.x - distance * .07) % W + W) % W;
            ctx.globalAlpha = reducedMotion ? .6 : .6 + .25 * Math.sin(time * 2 + firefly.phase);
            const y = firefly.y + (reducedMotion ? 0 : Math.sin(time + firefly.phase) * 3);
            ctx.fillRect(x, y, firefly.r * 2, firefly.r * 2);
        }
        ctx.globalAlpha = 1;
    }

    function drawGates(alpha, time) {
        for (const gate of state.gates) {
            const x = lerp(gate.previousX, gate.x, alpha);
            if (x - GATE_PADDING > W || x + GATE_WIDTH + GATE_PADDING < 0) continue;
            ctx.drawImage(gate.layer, x - GATE_PADDING, 0, GATE_WIDTH + GATE_PADDING * 2, H);
            const pulse = reducedMotion ? .5 : .5 + .5 * Math.sin(time * 3 + gate.seed);
            const radius = gate.gap * .32;
            ctx.save();
            ctx.translate(x + GATE_WIDTH / 2, gate.gapY);
            ctx.globalAlpha = .45 + pulse * .3;
            ctx.strokeStyle = night.gold;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(0, 0, radius + pulse * 2, 0, TAU);
            ctx.stroke();
            ctx.globalAlpha = 1;
            ctx.rotate((reducedMotion ? 0 : time * .18) + gate.seed);
            const scale = (radius + 5) / runeRadius;
            ctx.scale(scale, scale);
            ctx.fillStyle = night.gold;
            ctx.fill(runePath);
            ctx.restore();
        }
    }

    function drawBird(alpha, time) {
        const bird = state.bird;
        ctx.save();
        ctx.translate(bird.x, lerp(bird.previousY, bird.y, alpha));
        ctx.rotate(lerp(bird.previousRot, bird.rot, alpha));
        ctx.strokeStyle = night.bg;
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        ctx.fillStyle = birdColors[1];
        ctx.fill(tailPath);
        ctx.stroke(tailPath);
        ctx.fillStyle = birdColors[0];
        ctx.fill(bodyPath);
        ctx.stroke(bodyPath);
        const wing = Math.sin(time * 18) * 5 - bird.wing * 12;
        ctx.fillStyle = birdColors[1];
        ctx.beginPath();
        ctx.moveTo(-10, 2);
        ctx.quadraticCurveTo(-29, -15 + wing, -30, 11);
        ctx.quadraticCurveTo(-10, 14, 6, 6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = night.ink;
        ctx.beginPath();
        ctx.arc(9, -6, 7, 0, TAU);
        ctx.fill();
        ctx.fillStyle = night.bg;
        ctx.beginPath();
        ctx.arc(12, -7, 3, 0, TAU);
        ctx.fill();
        ctx.fillStyle = night.ember;
        ctx.fill(beakPath);
        ctx.lineWidth = 2;
        ctx.stroke(beakPath);
        ctx.restore();
    }

    function burst(x, y, count, color, life) {
        if (reducedMotion) return;
        for (let i = 0; i < count && particlePool.length; i++) {
            const angle = rand(0, TAU);
            const speed = rand(35, 150);
            const particle = particlePool.pop();
            particle.x = x;
            particle.y = y;
            particle.vx = Math.cos(angle) * speed;
            particle.vy = Math.sin(angle) * speed;
            particle.life = rand(life * .5, life);
            particle.max = life;
            particle.r = rand(1, 3.5);
            particle.color = color;
            state.particles.push(particle);
        }
    }

    function sound(kind) {
        if (settings.muted) return;
        try {
            audio ||= new (window.AudioContext || window.webkitAudioContext)();
            if (audio.state === 'suspended') audio.resume().catch(() => {});
            const oscillator = audio.createOscillator();
            const gain = audio.createGain();
            const now = audio.currentTime;
            oscillator.type = kind === 'hit' ? 'sawtooth' : 'sine';
            oscillator.frequency.setValueAtTime(kind === 'score' ? 720 : kind === 'hit' ? 130 : 420, now);
            oscillator.frequency.exponentialRampToValueAtTime(kind === 'score' ? 1040 : kind === 'hit' ? 70 : 620, now + .1);
            gain.gain.setValueAtTime(.045, now);
            gain.gain.exponentialRampToValueAtTime(.001, now + (kind === 'hit' ? .28 : .11));
            oscillator.connect(gain).connect(audio.destination);
            oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
            oscillator.start();
            oscillator.stop(now + .3);
        } catch (_) {}
    }

    function updateMute() {
        ui.mute.textContent = settings.muted ? 'Sound off' : 'Sound on';
        ui.mute.setAttribute('aria-pressed', String(settings.muted));
    }

    function isAnimating() {
        return state.mode === 'playing' || (state.mode === 'over' &&
            (state.particles.length > 0 || state.trail.length > 0 || state.flash > 0));
    }

    function loop(timestamp) {
        frameId = 0;
        if (document.hidden) return;
        if (isAnimating()) {
            const elapsed = state.last === null ? 0 : (timestamp - state.last) / 1000;
            state.last = timestamp;
            // Bound catch-up work after a stall while keeping physics independent of refresh rate.
            state.acc = Math.min(state.acc + elapsed, STEP * MAX_STEPS);
            while (state.acc >= STEP && isAnimating()) {
                update(STEP);
                state.acc -= STEP;
            }
        }
        render(state.mode === 'playing' ? state.acc / STEP : 1);
        if (isAnimating()) requestFrame();
        else { state.last = null; state.acc = 0; }
    }

    function action() {
        if (document.hidden) return;
        state.mode === 'paused' ? pause() : flap();
    }

    canvas.addEventListener('pointerdown', event => {
        if (!event.isPrimary || event.button !== 0) return;
        event.preventDefault();
        canvas.focus({ preventScroll: true });
        action();
    });
    ui.start.addEventListener('click', action);
    ui.pause.addEventListener('click', pause);
    ui.restart.addEventListener('click', () => reset(true));
    ui.mute.addEventListener('click', () => {
        settings.muted = !settings.muted;
        storage.set('moonveil_muted', settings.muted ? '1' : '0');
        updateMute();
    });
    window.addEventListener('keydown', event => {
        if (event.defaultPrevented || event.repeat || event.isComposing || event.altKey || event.ctrlKey || event.metaKey ||
            event.target.closest('input, select, textarea, button, a, [contenteditable]')) return;
        if (event.code === 'Space' || event.code === 'ArrowUp') action();
        else if (event.code === 'KeyP') pause();
        else if (event.code === 'KeyM') ui.mute.click();
        else if (event.code === 'Escape') reset(true);
        else return;
        event.preventDefault();
    });
    ui.difficulty.addEventListener('change', () => {
        flight = CONFIG[ui.difficulty.value];
        storage.set('moonveil_difficulty', ui.difficulty.value);
    });
    ui.skin.addEventListener('change', () => {
        birdColors = skins[ui.skin.value];
        storage.set('flappy_bird_skin', ui.skin.value);
        requestFrame();
    });
    ui.theme.addEventListener('change', () => {
        storage.set('flappy_theme', ui.theme.value);
        cacheBackground();
        requestFrame();
    });
    motionQuery.addEventListener('change', event => {
        reducedMotion = event.matches;
        if (reducedMotion) {
            recycleAll(state.particles, particlePool);
            recycleAll(state.trail, trailPool);
            state.flash = 0;
        }
        requestFrame();
    });
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            if (state.mode === 'playing') pause();
            stopAnimation();
        } else requestFrame();
    });
    window.addEventListener('pagehide', () => {
        if (state.mode === 'playing') pause();
        persistBest();
        stopAnimation();
    });
    window.addEventListener('pageshow', requestFrame);
    new ResizeObserver(resize).observe(canvas);
    background.onload = () => { cacheBackground(); requestFrame(); };
    background.src = 'assets/moonveil-background.webp';
    ui.best.textContent = state.best;
    updateMute();
    resize();
    reset();
})();
