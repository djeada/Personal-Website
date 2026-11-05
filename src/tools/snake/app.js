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

    function drawSnake() {
        const snake = state.snake;
        const m = Math.max(1, Math.round(cell * 0.1));
        const body = state.over && !state.won ? pal.ink3 : pal.verdigris;
        for (let i = snake.length - 1; i > 0; i--) {
            const s = snake[i];
            inset(s.x, s.y, m, body);
            const prev = snake[i - 1];
            const dx = prev.x - s.x;
            const dy = prev.y - s.y;
            if (Math.abs(dx) + Math.abs(dy) === 1) {
                const x = Math.min(s.x, prev.x) * cell + (dx ? cell - m : m);
                const y = Math.min(s.y, prev.y) * cell + (dy ? cell - m : m);
                ctx.fillStyle = body;
                ctx.fillRect(x, y, dx ? m * 2 : cell - m * 2, dy ? m * 2 : cell - m * 2);
            }
        }

        const head = snake[0];
        const crashed = state.over && !state.won;
        inset(head.x, head.y, Math.max(1, m - 1), crashed ? pal.rose : pal.gold);
        const d = state.dir;
        const px = -d.y;
        const py = d.x;
        const hx = (head.x + 0.5) * cell;
        const hy = (head.y + 0.5) * cell;
        const eye = Math.max(2, cell * 0.14);
        ctx.fillStyle = pal.canvas;
        [-1, 1].forEach(side => {
            const ex = hx + d.x * cell * 0.17 + px * side * cell * 0.2;
            const ey = hy + d.y * cell * 0.17 + py * side * cell * 0.2;
            ctx.fillRect(ex - eye / 2, ey - eye / 2, eye, eye);
        });
    }

    function frameLoop(now) {
        rafId = 0;
        if (mode !== "playing") return;
        const dt = Math.min(MAX_FRAME_MS, now - lastFrame);
        lastFrame = now;
        carry += dt;
        let redraw = false;
        const interval = engine.speed();
        while (carry >= interval && mode === "playing") {
            carry -= interval;
            const result = engine.step();
            redraw = true;
            if (result.type === "eat") onEat(result);
            else if (result.type === "crash" || result.type === "win") onEnd(result.type === "win");
        }
        if (redraw) draw();
        if (mode === "playing") rafId = requestAnimationFrame(frameLoop);
    }

    function startLoop() {
        lastFrame = performance.now();
        carry = 0;
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
