(function() {
    "use strict";

    const W = TetrisEngine.WIDTH;
    const H = TetrisEngine.HEIGHT;
    const BEST_KEY = "TETRIS_BEST";
    const PACE_KEY = "TETRIS_PACE";
    const DAS = 160;
    const ARR = 45;
    const MAX_FRAME_MS = 120;
    const RESTART_GUARD_MS = 450;
    const FLASH_MS = 170;

    const $ = id => document.getElementById(id);
    const canvas = $("canvas");
    const ctx = canvas.getContext("2d");
    const holdCanvas = $("hold-canvas");
    const nextCanvas = $("next-canvas");
    const board = $("board");
    const frame = $("game-frame");
    const overlay = $("overlay");
    const el = {
        score: $("score"),
        lines: $("lines"),
        level: $("level"),
        best: $("best"),
        pause: $("pause-btn"),
        play: $("play-btn"),
        kicker: $("overlay-kicker"),
        title: $("overlay-title"),
        copy: $("overlay-copy"),
        hint: $("overlay-hint"),
        status: $("status"),
        paceBox: $("pace")
    };
    const fullscreen = ArcadeFullscreen.attach(frame, document.getElementById("fs-btn"));
    const paceInputs = Array.from(document.querySelectorAll('#pace input[name="pace"]'));

    function readPace() {
        try {
            const saved = localStorage.getItem(PACE_KEY);
            if (TetrisEngine.PACES[saved]) return saved;
        } catch (e) {}
        return TetrisEngine.DEFAULT_PACE;
    }

    const engine = TetrisEngine.create({
        pace: readPace()
    });
    const state = engine.state;
    let pal = ToolShared.palette();
    let colors = {};
    let mode = "ready";
    let best = 0;
    let bestAtStart = 0;
    let lastFrame = 0;
    let rafId = 0;
    let overAt = 0;
    let cell = 1;
    let flash = null;
    const held = {
        left: false,
        right: false,
        down: false
    };
    const repeat = {
        dir: null,
        t: 0,
        started: false
    };

    function bestKey() {
        return `${BEST_KEY}_${engine.pace}`;
    }

    function readBest() {
        try {
            return parseInt(localStorage.getItem(bestKey()), 10) || 0;
        } catch (e) {
            return 0;
        }
    }

    function saveBest() {
        try {
            localStorage.setItem(bestKey(), String(best));
        } catch (e) {}
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

    function refreshColors() {
        pal = ToolShared.palette();
        colors = {
            I: pal.gold,
            J: pal.moon,
            L: pal.ember,
            O: pal.ink2,
            S: pal.verdigris,
            T: mix(pal.moon, pal.rose, 0.55),
            Z: pal.rose
        };
    }

    function setText(node, text) {
        if (node.textContent !== String(text)) node.textContent = text;
    }

    function updateHud() {
        setText(el.score, state.score);
        setText(el.lines, state.lines);
        setText(el.level, state.level);
        setText(el.best, best);
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

    function showOverlay(kicker, title, copy, button, hint, choosePace) {
        el.paceBox.hidden = !choosePace;
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

    function sizeCanvas(target, width, height) {
        const dpr = Math.min(window.devicePixelRatio || 1, 3);
        const w = Math.max(8, Math.round(width * dpr));
        const h = Math.max(8, Math.round(height * dpr));
        if (target.width !== w || target.height !== h) {
            target.width = w;
            target.height = h;
        }
    }

    function fit() {
        const r = board.getBoundingClientRect();
        sizeCanvas(canvas, r.width, r.height);
        cell = canvas.width / W;
        [holdCanvas, nextCanvas].forEach(c => {
            const cr = c.getBoundingClientRect();
            sizeCanvas(c, cr.width, cr.height);
        });
        drawAll();
    }

    function block(c, x, y, size, color, alpha) {
        const m = Math.max(1, Math.round(size * 0.06));
        c.globalAlpha = alpha === undefined ? 1 : alpha;
        c.fillStyle = color;
        c.fillRect(x + m, y + m, size - m * 2, size - m * 2);
        c.globalAlpha = (alpha === undefined ? 1 : alpha) * 0.35;
        c.strokeStyle = pal.canvas;
        c.lineWidth = Math.max(1, size * 0.07);
        const i = size * 0.22;
        c.strokeRect(x + i, y + i, size - i * 2, size - i * 2);
        c.globalAlpha = 1;
    }

    function drawBoard() {
        ctx.fillStyle = pal.canvas;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = pal.grid;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 1; x < W; x++) {
            ctx.moveTo(Math.round(x * cell) + 0.5, 0);
            ctx.lineTo(Math.round(x * cell) + 0.5, canvas.height);
        }
        for (let y = 1; y < H; y++) {
            ctx.moveTo(0, Math.round(y * cell) + 0.5);
            ctx.lineTo(canvas.width, Math.round(y * cell) + 0.5);
        }
        ctx.stroke();

        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                const t = state.board[y][x];
                if (t) block(ctx, x * cell, y * cell, cell, colors[t]);
            }
        }

        if (state.piece && mode !== "ready") {
            const ghost = engine.ghost();
            const color = colors[state.piece.type];
            if (ghost && ghost.y !== state.piece.y) {
                TetrisEngine.cellsOf(ghost).forEach(({
                    x,
                    y
                }) => {
                    if (y < 0) return;
                    ctx.strokeStyle = color;
                    ctx.globalAlpha = 0.55;
                    ctx.lineWidth = Math.max(1, cell * 0.06);
                    ctx.strokeRect(x * cell + cell * 0.1, y * cell + cell * 0.1, cell * 0.8, cell * 0.8);
                    ctx.globalAlpha = 1;
                });
            }
            TetrisEngine.cellsOf(state.piece).forEach(({
                x,
                y
            }) => {
                if (y >= 0) block(ctx, x * cell, y * cell, cell, color);
            });
        }

        if (flash) {
            const left = flash.until - performance.now();
            if (left > 0) {
                ctx.fillStyle = pal.ink;
                ctx.globalAlpha = Math.min(0.85, left / FLASH_MS);
                flash.rows.forEach(row => ctx.fillRect(0, row * cell, canvas.width, cell));
                ctx.globalAlpha = 1;
            } else flash = null;
        }
    }

    function drawMini(target, types, slotRows) {
        const c = target.getContext("2d");
        c.clearRect(0, 0, target.width, target.height);
        c.fillStyle = pal.canvas;
        c.fillRect(0, 0, target.width, target.height);
        const size = Math.min(target.width / 5, target.height / (slotRows * types.length));
        types.forEach((type, index) => {
            if (!type) return;
            const rot = TetrisEngine.ROTATIONS[type][0];
            const xs = rot.map(p => p[0]);
            const ys = rot.map(p => p[1]);
            const w = Math.max(...xs) - Math.min(...xs) + 1;
            const h = Math.max(...ys) - Math.min(...ys) + 1;
            const ox = (target.width - w * size) / 2 - Math.min(...xs) * size;
            const slotH = target.height / types.length;
            const oy = index * slotH + (slotH - h * size) / 2 - Math.min(...ys) * size;
            const dim = target === holdCanvas && !state.canHold && mode === "playing";
            rot.forEach(([x, y]) => block(c, ox + x * size, oy + y * size, size, colors[type], dim ? 0.35 : 1));
        });
    }

    function nextCount() {
        return window.matchMedia("(max-width: 899px)").matches ? 1 : 4;
    }

    function drawSide() {
        drawMini(holdCanvas, [state.hold], 3);
        const types = state.queue.slice(0, nextCount());
        drawMini(nextCanvas, types, 3);
    }

    function drawAll() {
        drawBoard();
        drawSide();
    }

    function startLoop() {
        lastFrame = performance.now();
        if (!rafId) rafId = requestAnimationFrame(frameLoop);
    }

    function stopLoop() {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = 0;
    }

    function stepRepeat(dt) {
        const dir = held.left && held.right ? repeat.dir : held.left ? "left" : held.right ? "right" : null;
        if (!dir) {
            repeat.dir = null;
            return;
        }
        if (repeat.dir !== dir) {
            repeat.dir = dir;
            repeat.t = 0;
            repeat.started = false;
            return;
        }
        repeat.t += dt;
        if (!repeat.started) {
            if (repeat.t < DAS) return;
            repeat.started = true;
            repeat.t -= DAS;
            engine[dir]();
        }
        while (repeat.t >= ARR) {
            repeat.t -= ARR;
            if (!engine[dir]()) break;
        }
    }

    function frameLoop(now) {
        rafId = 0;
        if (mode !== "playing") return;
        const dt = Math.min(MAX_FRAME_MS, now - lastFrame);
        lastFrame = now;
        stepRepeat(dt);
        engine.setSoftDrop(held.down);
        engine.tick(dt);
        handleEvents();
        drawAll();
        if (mode === "playing") rafId = requestAnimationFrame(frameLoop);
    }

    function handleEvents() {
        const events = engine.drainEvents();
        if (!events.length) return;
        let over = false;
        events.forEach(e => {
            if (e.type === "clear") {
                flash = {
                    rows: e.rows,
                    until: performance.now() + FLASH_MS
                };
                el.status.textContent = e.rows.length === 4 ? "Tetris" : `${e.rows.length} line${e.rows.length > 1 ? "s" : ""}`;
                if (e.leveled) el.status.textContent += `. Level ${state.level}`;
            }
            if (e.type === "over") over = true;
        });
        if (state.score > best) {
            best = state.score;
            saveBest();
        }
        updateHud();
        if (over) onEnd();
    }

    function onEnd() {
        mode = "over";
        overAt = performance.now();
        stopLoop();
        clearHeld();
        el.pause.disabled = true;
        drawAll();
        const record = state.score > 0 && state.score > bestAtStart;
        if (navigator.vibrate) navigator.vibrate(60);
        showOverlay(
            record ? "New best" : "Game over",
            `Score ${state.score}`,
            `${state.lines} lines, level ${state.level}. Best ${best}.`,
            "Play again",
            "Enter or tap to restart",
            true
        );
        el.status.textContent = `Game over. Score ${state.score}`;
        if (document.activeElement === document.body) el.play.focus({
            preventScroll: true
        });
    }

    function clearHeld() {
        held.left = held.right = held.down = false;
        repeat.dir = null;
        engine.setSoftDrop(false);
        document.querySelectorAll(".tetris-pad .is-down").forEach(b => b.classList.remove("is-down"));
    }

    function startGame() {
        engine.reset();
        flash = null;
        clearHeld();
        bestAtStart = best;
        mode = "playing";
        hideOverlay();
        el.pause.disabled = false;
        el.pause.textContent = "Pause";
        el.status.textContent = "Go";
        updateHud();
        drawAll();
        startLoop();
        fullscreen.autoEnter();
        if (!fullscreen.active && window.matchMedia("(pointer: coarse), (max-width: 899px)").matches) {
            const top = frame.getBoundingClientRect().top;
            if (top < 0 || top > 80) frame.scrollIntoView({
                block: "start",
                behavior: "smooth"
            });
        }
    }

    function pauseGame() {
        if (mode !== "playing") return;
        mode = "paused";
        stopLoop();
        clearHeld();
        el.pause.textContent = "Resume";
        showOverlay("Paused", "Paused", "Your board is safe. Take a breath.", "Resume", "P or Esc to resume", false);
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

    function primaryAction() {
        if (mode === "ready") startGame();
        else if (mode === "over") {
            if (performance.now() - overAt >= RESTART_GUARD_MS) startGame();
        } else if (mode === "paused") resumeGame();
    }

    function act(name) {
        if (mode !== "playing") return;
        if (name === "left") engine.left();
        else if (name === "right") engine.right();
        else if (name === "rotate") engine.rotate(1);
        else if (name === "rotate-ccw") engine.rotate(-1);
        else if (name === "soft") engine.softStep();
        else if (name === "drop") engine.hardDrop();
        else if (name === "hold") engine.holdPiece();
        handleEvents();
        if (mode === "playing") drawAll();
    }

    function press(dir) {
        if (mode !== "playing" || held[dir]) return;
        held[dir] = true;
        if (dir === "down") {
            act("soft");
            return;
        }
        act(dir);
        if (repeat.dir !== dir) {
            repeat.dir = dir;
            repeat.t = 0;
            repeat.started = false;
        }
    }

    function release(dir) {
        held[dir] = false;
        if (dir === "down") engine.setSoftDrop(false);
    }

    function typingTarget(target) {
        if (!target || !target.tagName) return false;
        const tag = target.tagName;
        return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
    }

    const GAME_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", " "]);

    window.addEventListener("keydown", e => {
        if (e.ctrlKey || e.metaKey || e.altKey || typingTarget(e.target)) return;
        const onButton = e.target && e.target.tagName === "BUTTON";
        const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
        if (mode === "playing" && GAME_KEYS.has(key)) e.preventDefault();

        if (key === "f") {
            fullscreen.toggle();
            return;
        }
        if (key === "p" || key === "Escape") {
            if (mode === "playing" || mode === "paused") {
                togglePause();
                e.preventDefault();
            } else if (key === "Escape" && mode === "over") primaryAction();
            return;
        }
        if (mode === "ready" || mode === "over") {
            if ((key === "Enter" || key === " ") && !onButton) {
                primaryAction();
                e.preventDefault();
            }
            return;
        }
        if (mode === "paused") {
            if ((key === "Enter" || key === " ") && !onButton) {
                resumeGame();
                e.preventDefault();
            }
            return;
        }
        if (e.repeat) return;
        if (key === "ArrowLeft" || key === "a") press("left");
        else if (key === "ArrowRight" || key === "d") press("right");
        else if (key === "ArrowDown" || key === "s") press("down");
        else if (key === "ArrowUp" || key === "x" || key === "w") act("rotate");
        else if (key === "z") act("rotate-ccw");
        else if (key === " " && !onButton) act("drop");
        else if (key === "c" || key === "Shift") act("hold");
        else if (key === "r") startGame();
    });

    window.addEventListener("keyup", e => {
        const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
        if (key === "ArrowLeft" || key === "a") release("left");
        else if (key === "ArrowRight" || key === "d") release("right");
        else if (key === "ArrowDown" || key === "s") release("down");
    });

    el.play.addEventListener("click", () => {
        primaryAction();
        if (mode === "playing") canvas.focus({
            preventScroll: true
        });
    });
    el.pause.addEventListener("click", () => {
        togglePause();
        el.pause.blur();
    });

    document.querySelectorAll(".tetris-pad [data-act]").forEach(btn => {
        const name = btn.dataset.act;
        const holdable = name === "left" || name === "right" || name === "down";
        btn.addEventListener("pointerdown", e => {
            e.preventDefault();
            if (mode !== "playing") return;
            if (holdable) {
                btn.classList.add("is-down");
                try {
                    btn.setPointerCapture(e.pointerId);
                } catch (err) {}
                press(name);
            } else act(name);
        });
        if (holdable) {
            const up = () => {
                btn.classList.remove("is-down");
                release(name);
            };
            btn.addEventListener("pointerup", up);
            btn.addEventListener("pointercancel", up);
            btn.addEventListener("lostpointercapture", up);
        }
        btn.addEventListener("click", e => {
            if (e.detail !== 0) return;
            if (holdable) {
                if (name === "down") act("soft");
                else act(name);
            } else act(name);
        });
    });

    let touch = null;
    board.addEventListener("pointerdown", e => {
        if (e.pointerType === "mouse" || mode !== "playing") return;
        touch = {
            id: e.pointerId,
            x: e.clientX,
            y: e.clientY,
            startX: e.clientX,
            startY: e.clientY,
            t: performance.now(),
            moved: 0,
            soft: 0
        };
        e.preventDefault();
    });
    board.addEventListener("pointermove", e => {
        if (!touch || touch.id !== e.pointerId || mode !== "playing") return;
        const cellPx = board.getBoundingClientRect().width / W;
        const dx = e.clientX - touch.x;
        const dy = e.clientY - touch.y;
        const stepX = Math.trunc(dx / (cellPx * 0.85));
        if (stepX) {
            for (let i = 0; i < Math.abs(stepX); i++) act(stepX > 0 ? "right" : "left");
            touch.x += stepX * cellPx * 0.85;
            touch.moved += Math.abs(stepX);
        }
        const stepY = Math.trunc(dy / (cellPx * 0.9));
        if (stepY > 0 && Math.abs(dy) > Math.abs(dx)) {
            for (let i = 0; i < stepY; i++) act("soft");
            touch.y += stepY * cellPx * 0.9;
            touch.soft += stepY;
        }
        if (Math.abs(e.clientX - touch.startX) > 8 || Math.abs(e.clientY - touch.startY) > 8) touch.moved = touch.moved || 0.5;
    });
    const endTouch = e => {
        if (!touch || touch.id !== e.pointerId) return;
        const t = touch;
        touch = null;
        if (e.type === "pointercancel" || mode !== "playing") return;
        const dt = performance.now() - t.t;
        const totalX = e.clientX - t.startX;
        const totalY = e.clientY - t.startY;
        const cellPx = board.getBoundingClientRect().width / W;
        if (Math.abs(totalX) < 10 && Math.abs(totalY) < 10 && dt < 300) act("rotate");
        else if (totalY > cellPx * 3 && Math.abs(totalY) > Math.abs(totalX) * 1.5 && dt < 260) act("drop");
        else if (totalY < -cellPx * 2.5 && Math.abs(totalY) > Math.abs(totalX) * 1.5 && dt < 300) act("hold");
    };
    board.addEventListener("pointerup", endTouch);
    board.addEventListener("pointercancel", endTouch);

    document.addEventListener("visibilitychange", () => {
        if (document.hidden) pauseGame();
    });
    window.addEventListener("blur", pauseGame);

    if (window.ResizeObserver) new ResizeObserver(fit).observe(board);
    window.addEventListener("resize", fit);

    ToolShared.onThemeChange(() => {
        refreshColors();
        drawAll();
    });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => {
        refreshColors();
        drawAll();
    });

    refreshColors();
    best = readBest();
    bestAtStart = best;
    updateHud();
    fit();

    window.TetrisGame = {
        engine,
        get mode() {
            return mode;
        }
    };
})();