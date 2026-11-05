(function() {
    "use strict";

    const GRID = 20;
    const BEST_KEY = "SNAKE_HIGH_SCORE";
    const PACE_KEY = "SNAKE_PACE";
    const RESTART_GUARD_MS = 450;
    const MAX_FRAME_MS = 250;
    const SWIPE_PX = 22;

    const canvas = document.getElementById("canvas");
    const ctx = canvas.getContext("2d");
    const board = document.getElementById("board");
    const frame = document.getElementById("game-frame");
    const overlay = document.getElementById("overlay");
    const el = {
        score: document.getElementById("score"),
        best: document.getElementById("best"),
        level: document.getElementById("level"),
        pause: document.getElementById("pause-btn"),
        play: document.getElementById("play-btn"),
        kicker: document.getElementById("overlay-kicker"),
        title: document.getElementById("overlay-title"),
        copy: document.getElementById("overlay-copy"),
        hint: document.getElementById("overlay-hint"),
        status: document.getElementById("status")
    };

    const fullscreen = ArcadeFullscreen.attach(frame, document.getElementById("fs-btn"));
    const paceInputs = Array.from(document.querySelectorAll('#pace input[name="pace"]'));
    const paceBox = document.getElementById("pace");

    function readPace() {
        try {
            const saved = localStorage.getItem(PACE_KEY);
            if (SnakeEngine.PACES[saved]) return saved;
        } catch (e) {}
        return SnakeEngine.DEFAULT_PACE;
    }

    const engine = SnakeEngine.create({ size: GRID, pace: readPace() });
    const state = engine.state;
    let pal = ToolShared.palette();
    let mode = "ready";
    let best = readBest();
    let lastFrame = 0;
    let carry = 0;
    let rafId = 0;
    let overAt = 0;
    let cell = 1;
    let bestAtStart = best;
    let progress = 0;

    function bestKey() {
        return engine.pace === "classic" ? BEST_KEY : `${BEST_KEY}_${engine.pace}`;
    }

    function readBest() {
        let value = 0;
        try {
            value = parseInt(localStorage.getItem(bestKey()), 10) || 0;
        } catch (e) {}
        if (!value && engine.pace === "classic") {
            const m = document.cookie.match(new RegExp("(?:^|; )" + BEST_KEY + "=([^;]*)"));
            value = m ? parseInt(m[1], 10) || 0 : 0;
        }
        return value;
    }

    function saveBest() {
        try {
            localStorage.setItem(bestKey(), String(best));
        } catch (e) {}
    }

    function setText(node, text) {
        if (node.textContent !== String(text)) node.textContent = text;
    }

    paceInputs.forEach(input => {
        input.checked = input.value === engine.pace;
        input.addEventListener("change", () => {
            if (!input.checked) return;
            engine.setPace(input.value);
            try {
                localStorage.setItem(PACE_KEY, input.value);
            } catch (e) {}
            best = readBest();
            bestAtStart = best;
            updateHud();
        });
    });

    function updateHud() {
        setText(el.score, state.score);
        setText(el.best, best);
        setText(el.level, state.level);
    }

    function showOverlay(kicker, title, copy, button, hint, choosePace) {
        paceBox.hidden = !choosePace;
        el.kicker.textContent = kicker;
        el.title.textContent = title;
        el.copy.textContent = copy;
        el.play.textContent = button;
        el.hint.textContent = hint;
        overlay.classList.add("is-visible");
        overlay.removeAttribute("aria-hidden");
    }

    function hideOverlay() {
        overlay.classList.remove("is-visible");
        overlay.setAttribute("aria-hidden", "true");
    }

    function fitCanvas() {
        const rect = board.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 3);
        const px = Math.max(GRID * 8, Math.round(rect.width * dpr));
        if (canvas.width !== px) {
            canvas.width = px;
            canvas.height = px;
        }
        cell = canvas.width / GRID;
        draw();
    }

    function inset(x, y, margin, color) {
        ctx.fillStyle = color;
        ctx.fillRect(x * cell + margin, y * cell + margin, cell - margin * 2, cell - margin * 2);
    }

    function draw() {
        ctx.fillStyle = pal.canvas;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = pal.grid;
        for (let y = 0; y < GRID; y++) {
            for (let x = 0; x < GRID; x++) {
                if ((x + y) % 2 === 0) ctx.fillRect(x * cell, y * cell, cell, cell);
            }
        }

        const m = Math.max(1, Math.round(cell * 0.1));
        state.obstacles.forEach(o => {
            inset(o.x, o.y, m, pal.ink3);
            ctx.strokeStyle = pal.canvas;
            ctx.lineWidth = Math.max(1, cell * 0.08);
            ctx.beginPath();
            ctx.moveTo(o.x * cell + m * 2, o.y * cell + m * 2);
            ctx.lineTo((o.x + 1) * cell - m * 2, (o.y + 1) * cell - m * 2);
            ctx.moveTo((o.x + 1) * cell - m * 2, o.y * cell + m * 2);
            ctx.lineTo(o.x * cell + m * 2, (o.y + 1) * cell - m * 2);
            ctx.stroke();
        });

        if (state.food) drawFood(state.food);
        drawSnake();
    }

    function drawFood(food) {
        const cx = (food.x + 0.5) * cell;
        const cy = (food.y + 0.5) * cell;
        const r = cell * 0.34;
        ctx.fillStyle = pal.rose;
        ctx.beginPath();
        ctx.arc(cx, cy + r * 0.12, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = pal.gold;
        ctx.lineWidth = Math.max(2, cell * 0.08);
        ctx.beginPath();
        ctx.moveTo(cx, cy - r * 0.7);
        ctx.lineTo(cx + r * 0.4, cy - r * 1.3);
        ctx.stroke();
    }

    function mix(a, b, t) {
        const parse = value => {
            ctx.fillStyle = "#000";
            ctx.fillStyle = value;
            const hex = ctx.fillStyle;
            return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
        };
        const [r1, g1, b1] = parse(a);
        const [r2, g2, b2] = parse(b);
        const to = (x, y) => Math.round(x + (y - x) * t).toString(16).padStart(2, "0");
        return `#${to(r1, r2)}${to(g1, g2)}${to(b1, b2)}`;
    }

    function drawSnake() {
        const snake = state.snake;
        const crashed = state.over && !state.won;
        const look = (mode === "playing" || mode === "paused") && progress > 0 ? engine.peek() : null;
        const adv = look && !look.fatal ? Math.min(1, progress) : 0;
        const face = look ? look.dir : state.dir;

        const pts = [];
        if (adv > 0) pts.push({ x: snake[0].x + face.x * adv, y: snake[0].y + face.y * adv });
        snake.forEach(s => pts.push({ x: s.x, y: s.y }));
        const last = pts.length - 1;
        if (adv > 0 && !look.eat && last >= 1) {
            pts[last] = {
                x: pts[last].x + (pts[last - 1].x - pts[last].x) * adv,
                y: pts[last].y + (pts[last - 1].y - pts[last].y) * adv
            };
        }

        const dist = [0];
        for (let k = 1; k < pts.length; k++) {
            dist[k] = dist[k - 1] + Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y);
        }
        const total = dist[last];
        const TAPER = 2.4;
        const width = d => 1 - 0.5 * Math.min(1, Math.max(0, (d - (total - TAPER)) / TAPER));
        const base = cell * 0.72;
        const at = p => [(p.x + 0.5) * cell, (p.y + 0.5) * cell];

        const bodyColor = crashed ? pal.ink3 : pal.verdigris;
        const spotColor = crashed ? mix(pal.ink3, "#000000", 0.25) : mix(pal.verdigris, "#000000", 0.3);
        const headColor = crashed ? pal.rose : mix(pal.verdigris, "#ffffff", 0.12);

        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = bodyColor;
        const PIECES = 6;
        for (let k = last; k >= 1; k--) {
            for (let j = 0; j < PIECES; j++) {
                const t0 = j / PIECES;
                const t1 = (j + 1) / PIECES;
                const lerp = (t) => ({
                    x: pts[k].x + (pts[k - 1].x - pts[k].x) * t,
                    y: pts[k].y + (pts[k - 1].y - pts[k].y) * t
                });
                const [x1, y1] = at(lerp(t0));
                const [x2, y2] = at(lerp(t1));
                ctx.lineWidth = base * width(dist[k] + (dist[k - 1] - dist[k]) * ((t0 + t1) / 2));
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();
            }
        }

        const offset = adv > 0 ? 1 : 0;
        ctx.fillStyle = spotColor;
        for (let i = 1; i < snake.length - 1; i++) {
            if ((state.moves + i) % 2 !== 0) continue;
            const k = i + offset;
            const [x, y] = at(pts[k]);
            ctx.beginPath();
            ctx.arc(x, y, base * 0.2 * width(dist[k]), 0, Math.PI * 2);
            ctx.fill();
        }

        const [hx, hy] = at(pts[0]);
        const px = -face.y;
        const py = face.x;
        ctx.fillStyle = headColor;
        ctx.beginPath();
        ctx.ellipse(hx + face.x * cell * 0.04, hy + face.y * cell * 0.04, cell * 0.52, cell * 0.46, Math.atan2(face.y, face.x), 0, Math.PI * 2);
        ctx.fill();

        const sclera = pal.isDark ? pal.ink : "#ffffff";
        const pupil = pal.isDark ? pal.bg : pal.ink;
        [-1, 1].forEach(side => {
            const ex = hx + face.x * cell * 0.12 + px * side * cell * 0.2;
            const ey = hy + face.y * cell * 0.12 + py * side * cell * 0.2;
            if (crashed) {
                const r = cell * 0.09;
                ctx.strokeStyle = pal.canvas;
                ctx.lineWidth = Math.max(1.5, cell * 0.06);
                ctx.lineCap = "butt";
                ctx.beginPath();
                ctx.moveTo(ex - r, ey - r);
                ctx.lineTo(ex + r, ey + r);
                ctx.moveTo(ex + r, ey - r);
                ctx.lineTo(ex - r, ey + r);
                ctx.stroke();
                return;
            }
            ctx.fillStyle = sclera;
            ctx.beginPath();
            ctx.arc(ex, ey, cell * 0.13, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = pupil;
            ctx.beginPath();
            ctx.arc(ex + face.x * cell * 0.04, ey + face.y * cell * 0.04, cell * 0.065, 0, Math.PI * 2);
            ctx.fill();
        });

        if (!crashed && state.moves % 2 === 0) {
            const sx = hx + face.x * cell * 0.5;
            const sy = hy + face.y * cell * 0.5;
            const mx = sx + face.x * cell * 0.2;
            const my = sy + face.y * cell * 0.2;
            ctx.strokeStyle = pal.rose;
            ctx.lineWidth = Math.max(1.5, cell * 0.06);
            ctx.lineCap = "butt";
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(mx, my);
            [-1, 1].forEach(side => {
                ctx.moveTo(mx, my);
                ctx.lineTo(mx + face.x * cell * 0.16 + px * side * cell * 0.1, my + face.y * cell * 0.16 + py * side * cell * 0.1);
            });
            ctx.stroke();
        }
        ctx.lineCap = "butt";
    }

    function frameLoop(now) {
        rafId = 0;
        if (mode !== "playing") return;
        const dt = Math.min(MAX_FRAME_MS, now - lastFrame);
        lastFrame = now;
        carry += dt;
        const interval = engine.speed();
        while (carry >= interval && mode === "playing") {
            carry -= interval;
            const result = engine.step();
            if (result.type === "eat") onEat(result);
            else if (result.type === "crash" || result.type === "win") onEnd(result.type === "win");
        }
        progress = mode === "playing" ? Math.min(1, carry / interval) : 0;
        draw();
        if (mode === "playing") rafId = requestAnimationFrame(frameLoop);
    }

    function startLoop() {
        lastFrame = performance.now();
        if (!rafId) rafId = requestAnimationFrame(frameLoop);
    }

    function stopLoop() {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = 0;
    }

    function onEat(result) {
        if (state.score > best) {
            best = state.score;
            saveBest();
        }
        updateHud();
        if (result.leveled) el.status.textContent = `Level ${state.level}`;
    }

    function onEnd(won) {
        mode = "over";
        progress = 0;
        overAt = performance.now();
        stopLoop();
        el.pause.disabled = true;
        if (state.score > best) {
            best = state.score;
            saveBest();
        }
        updateHud();
        draw();
        const record = state.score > 0 && state.score > bestAtStart;
        if (!won && navigator.vibrate) navigator.vibrate(60);
        showOverlay(
            won ? "You filled the board" : (record ? "New best" : "Game over"),
            won ? "Perfect game" : `Score ${state.score}`,
            won ? `${state.score} apples. There is nowhere left to go.` : `Level ${state.level}. Best ${best}.`,
            "Play again",
            "Enter or tap to restart",
            true
        );
        el.status.textContent = won ? "You win" : `Game over. Score ${state.score}`;
        if (document.activeElement === document.body) el.play.focus({ preventScroll: true });
    }

    function startGame(direction) {
        engine.reset(direction);
        carry = 0;
        progress = 0;
        bestAtStart = best;
        mode = "playing";
        hideOverlay();
        updateHud();
        el.pause.disabled = false;
        el.pause.textContent = "Pause";
        el.status.textContent = "Go";
        draw();
        startLoop();
        fullscreen.autoEnter();
        if (!fullscreen.active && window.matchMedia("(pointer: coarse)").matches) {
            const top = frame.getBoundingClientRect().top;
            if (top < 0 || top > 80) frame.scrollIntoView({ block: "start", behavior: "smooth" });
        }
    }

    function pauseGame() {
        if (mode !== "playing") return;
        mode = "paused";
        stopLoop();
        el.pause.textContent = "Resume";
        showOverlay("Paused", "Paused", "Take a breath. The snake will wait.", "Resume", "Space or P to resume", false);
    }

    function resumeGame() {
        if (mode !== "paused") return;
        mode = "playing";
        hideOverlay();
        el.pause.textContent = "Pause";
        startLoop();
    }

    function togglePause() {
        if (mode === "playing") pauseGame();
        else if (mode === "paused") resumeGame();
    }

    function primaryAction(direction) {
        if (mode === "ready") startGame(direction);
        else if (mode === "over") {
            if (performance.now() - overAt >= RESTART_GUARD_MS) startGame(direction);
        } else if (mode === "paused") resumeGame();
    }

    function turn(direction) {
        if (mode === "playing") engine.turn(direction);
        else if (mode === "ready" || (mode === "over" && performance.now() - overAt >= RESTART_GUARD_MS)) primaryAction(direction);
    }

    const KEYS = {
        ArrowUp: "up",
        ArrowDown: "down",
        ArrowLeft: "left",
        ArrowRight: "right",
        w: "up",
        s: "down",
        a: "left",
        d: "right",
        W: "up",
        S: "down",
        A: "left",
        D: "right"
    };

    function typingTarget(target) {
        if (!target || !target.tagName) return false;
        const tag = target.tagName;
        return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
    }

    window.addEventListener("keydown", e => {
        if (e.ctrlKey || e.metaKey || e.altKey || typingTarget(e.target)) return;
        const onButton = e.target && e.target.tagName === "BUTTON";
        const dir = KEYS[e.key];
        if (dir) {
            if (mode === "playing" && e.repeat) {
                e.preventDefault();
                return;
            }
            turn(dir);
            if (mode === "playing" || mode === "ready" || mode === "over") e.preventDefault();
            return;
        }
        if (e.key === " " || e.key === "Spacebar") {
            if (onButton) return;
            if (mode === "playing" || mode === "paused") togglePause();
            else primaryAction();
            e.preventDefault();
        } else if (e.key === "p" || e.key === "P") {
            togglePause();
        } else if (e.key === "Enter") {
            if (onButton) return;
            if (mode === "over" || mode === "ready") {
                primaryAction();
                e.preventDefault();
            } else if (mode === "paused") resumeGame();
        } else if (e.key === "Escape" && mode === "over") {
            primaryAction();
        } else if (e.key === "f" || e.key === "F") {
            fullscreen.toggle();
        }
    });

    el.play.addEventListener("click", () => {
        if (mode === "paused") resumeGame();
        else primaryAction();
        if (mode === "playing") canvas.focus({ preventScroll: true });
    });
    el.pause.addEventListener("click", () => {
        togglePause();
        el.pause.blur();
    });

    document.querySelectorAll(".snake-pad [data-dir]").forEach(btn => {
        btn.addEventListener("pointerdown", e => {
            e.preventDefault();
            turn(btn.dataset.dir);
        });
        btn.addEventListener("click", e => {
            if (e.detail === 0) turn(btn.dataset.dir);
        });
    });

    let swipe = null;
    board.addEventListener("pointerdown", e => {
        if (e.pointerType === "mouse") return;
        swipe = { id: e.pointerId, x: e.clientX, y: e.clientY };
        if (mode === "playing") e.preventDefault();
    });
    board.addEventListener("pointermove", e => {
        if (!swipe || swipe.id !== e.pointerId || mode !== "playing") return;
        const dx = e.clientX - swipe.x;
        const dy = e.clientY - swipe.y;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_PX) return;
        if (Math.abs(dx) > Math.abs(dy)) turn(dx > 0 ? "right" : "left");
        else turn(dy > 0 ? "down" : "up");
        swipe.x = e.clientX;
        swipe.y = e.clientY;
    });
    const endSwipe = e => {
        if (swipe && swipe.id === e.pointerId) swipe = null;
    };
    board.addEventListener("pointerup", endSwipe);
    board.addEventListener("pointercancel", endSwipe);

    document.addEventListener("visibilitychange", () => {
        if (document.hidden) pauseGame();
    });
    window.addEventListener("blur", pauseGame);

    if (window.ResizeObserver) new ResizeObserver(fitCanvas).observe(board);
    else window.addEventListener("resize", fitCanvas);

    ToolShared.onThemeChange(next => {
        pal = next;
        draw();
    });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => {
        pal = ToolShared.palette();
        draw();
    });

    updateHud();
    fitCanvas();

    window.SnakeGame = {
        engine,
        get mode() {
            return mode;
        }
    };
})();
