(() => {
    "use strict";

    const W = 800, H = 600, TAU = Math.PI * 2, GRID = 8;
    const HARVEST_AMOUNT = 8;
    const nest = { x: 400, y: 310, radius: 38 };
    const food = [
        { x: 126, y: 135, radius: 28, amount: 1000, max: 1000, hue: 82 },
        { x: 665, y: 448, radius: 31, amount: 1000, max: 1000, hue: 44 },
        { x: 687, y: 126, radius: 25, amount: 800, max: 800, hue: 188 }
    ];
    const settings = { antCount: 70, strength: 120, evaporation: .99, speed: 1, trails: true, sensors: false };
    const obstacles = [], ants = [], motes = [];
    const cols = Math.ceil(W / GRID), rows = Math.ceil(H / GRID);
    let home = new Float32Array(cols * rows), nectar = new Float32Array(cols * rows);
    let canvas, ctx, drawing = false, lastPoint = null, frame = 0, delivered = 0;

    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const distance = (a, b, x = a.x, y = a.y) => Math.hypot(x - b.x, y - b.y);
    const angleDelta = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
    const gridIndex = (x, y) => clamp(Math.floor(y / GRID), 0, rows - 1) * cols + clamp(Math.floor(x / GRID), 0, cols - 1);

    function roundedPolygon(cx, cy, points, fill, stroke) {
        ctx.beginPath();
        points.forEach(([a, r], i) => {
            const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
            i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        });
        ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
        if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
    }

    function makeMotes() {
        motes.length = 0;
        for (let i = 0; i < 45; i++) motes.push({
            x: Math.random() * W, y: Math.random() * H, r: .4 + Math.random() * 1.6,
            phase: Math.random() * TAU, speed: .002 + Math.random() * .006,
            drift: .08 + Math.random() * .18, gold: Math.random() > .7
        });
    }

    function seedHomeTrail() {
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
            const d = Math.hypot(c * GRID - nest.x, r * GRID - nest.y);
            home[r * cols + c] = Math.max(0, 170 - d * 1.25);
        }
    }

    class Ant {
        constructor() { this.reset(true); }
        reset(fresh = false) {
            const a = Math.random() * TAU, r = Math.random() * nest.radius * .75;
            this.x = nest.x + Math.cos(a) * r; this.y = nest.y + Math.sin(a) * r;
            this.angle = fresh ? a : Math.random() * TAU; this.target = this.angle;
            this.carrying = false; this.speed = .85 + Math.random() * .5; this.seed = Math.random() * 100;
            this.stuckFrames = 0;
        }
        sense(field, offset) {
            const a = this.angle + offset, d = 28;
            let value = 0;
            for (let spread = -1; spread <= 1; spread++) {
                const x = this.x + Math.cos(a + spread * .08) * d;
                const y = this.y + Math.sin(a + spread * .08) * d;
                value += field[gridIndex(x, y)];
            }
            return value;
        }
        blocked(x, y, padding = 2) { return obstacles.some(o => Math.hypot(x - o.x, y - o.y) < o.r + padding); }
        avoidObstacles() {
            const look = 18;
            const ahead = this.blocked(this.x + Math.cos(this.angle) * look, this.y + Math.sin(this.angle) * look, 4);
            if (!ahead) return;
            const leftAngle = this.angle - .9, rightAngle = this.angle + .9;
            const leftFree = !this.blocked(this.x + Math.cos(leftAngle) * look, this.y + Math.sin(leftAngle) * look, 3);
            const rightFree = !this.blocked(this.x + Math.cos(rightAngle) * look, this.y + Math.sin(rightAngle) * look, 3);
            if (leftFree !== rightFree) this.target = leftFree ? leftAngle : rightAngle;
            else this.target += (this.seed % 2 > 1 ? 1 : -1) * 1.15;
        }
        update() {
            const field = this.carrying ? home : nectar;
            const left = this.sense(field, -.62), center = this.sense(field, 0), right = this.sense(field, .62);
            if (center + left + right > 4) {
                if (center >= left && center >= right) this.target += (Math.random() - .5) * .06;
                else this.target += left > right ? -.14 : .14;
            } else this.target += (Math.random() - .5) * .34;
            if (this.carrying) {
                const homeAngle = Math.atan2(nest.y - this.y, nest.x - this.x);
                this.target += angleDelta(this.target, homeAngle) * .075;
            }
            this.avoidObstacles();
            this.angle += angleDelta(this.angle, this.target) * .24;
            const step = this.speed * 1.35, nx = this.x + Math.cos(this.angle) * step, ny = this.y + Math.sin(this.angle) * step;
            if (nx < 8 || nx > W - 8 || ny < 8 || ny > H - 8 || this.blocked(nx, ny)) {
                this.stuckFrames++;
                this.target += (this.seed % 2 > 1 ? 1 : -1) * (1.05 + Math.random() * .55); this.angle = this.target;
                if (this.stuckFrames > 20) {
                    const nearest = obstacles.reduce((best, o) => !best || distance(this, o) < distance(this, best) ? o : best, null);
                    const escape = nearest ? Math.atan2(this.y - nearest.y, this.x - nearest.x) : this.angle + Math.PI;
                    this.x = clamp(this.x + Math.cos(escape) * 9, 10, W - 10);
                    this.y = clamp(this.y + Math.sin(escape) * 9, 10, H - 10);
                    this.target = escape + (Math.random() - .5) * .7; this.angle = this.target; this.stuckFrames = 0;
                }
            } else { this.x = nx; this.y = ny; this.stuckFrames = Math.max(0, this.stuckFrames - 2); }
            const i = gridIndex(this.x, this.y);
            (this.carrying ? nectar : home)[i] = Math.min(255, (this.carrying ? nectar : home)[i] + settings.strength * .12);
            if (!this.carrying) for (const source of food) {
                const remaining = source.amount / source.max;
                const harvestRadius = source.radius * (.3 + .7 * Math.sqrt(remaining));
                if (source.amount > 0 && distance(this, source) < harvestRadius) {
                    source.amount = Math.max(0, source.amount - HARVEST_AMOUNT);
                    this.carrying = true; this.angle += Math.PI; this.target = this.angle;
                    nectar[gridIndex(source.x, source.y)] = 255; break;
                }
            }
            if (this.carrying && distance(this, nest) < nest.radius) {
                this.carrying = false; delivered++; this.angle += Math.PI; this.target = this.angle;
            }
        }
        draw() {
            ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.angle);
            const leg = Math.sin(frame * .18 + this.seed) * 1.8;
            ctx.strokeStyle = this.carrying ? "rgba(255,220,118,.9)" : "rgba(182,181,217,.72)";
            ctx.lineWidth = .75;
            [[-1, -1], [0, 1], [1, -1]].forEach(([px, side], i) => {
                ctx.beginPath(); ctx.moveTo(px, side * 1.5); ctx.lineTo(px - 1 + leg * (i % 2 ? -1 : 1), side * 4); ctx.stroke();
            });
            ctx.shadowBlur = this.carrying ? 10 : 3; ctx.shadowColor = this.carrying ? "#ffd36e" : "#8f7cff";
            ctx.fillStyle = this.carrying ? "#f1c267" : "#c5c1d9";
            ctx.beginPath(); ctx.ellipse(-2.5, 0, 2.4, 1.8, 0, 0, TAU); ctx.ellipse(1, 0, 1.8, 1.5, 0, 0, TAU); ctx.ellipse(3.7, 0, 1.5, 1.3, 0, 0, TAU); ctx.fill();
            if (this.carrying) { ctx.fillStyle = "#dfff92"; ctx.beginPath(); ctx.arc(6.2, 0, 1.8, 0, TAU); ctx.fill(); }
            ctx.restore();
            if (settings.sensors) {
                ctx.strokeStyle = "rgba(214,255,174,.16)";
                [-.62, 0, .62].forEach(o => { ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(this.x + Math.cos(this.angle + o) * 28, this.y + Math.sin(this.angle + o) * 28); ctx.stroke(); });
            }
        }
    }

    function resizeAnts() {
        while (ants.length < settings.antCount) ants.push(new Ant());
        ants.length = settings.antCount;
    }

    function updateTrails() {
        if (frame % 2) return;
        const fade = Math.pow(settings.evaporation, 1.4);
        for (let i = 0; i < home.length; i++) { home[i] = home[i] < .3 ? 0 : home[i] * fade; nectar[i] = nectar[i] < .3 ? 0 : nectar[i] * fade; }
    }

    function drawGround() {
        const bg = ctx.createRadialGradient(410, 300, 20, 400, 300, 520);
        bg.addColorStop(0, "#22352f"); bg.addColorStop(.48, "#142421"); bg.addColorStop(1, "#0a1115");
        ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
        ctx.save(); ctx.globalAlpha = .18; ctx.strokeStyle = "#61715c"; ctx.lineWidth = 1;
        for (let i = 0; i < 32; i++) {
            const y = (i * 83) % H, x = (i * 137) % W;
            ctx.beginPath(); ctx.moveTo(x - 65, y); ctx.bezierCurveTo(x - 20, y - 22, x + 22, y + 27, x + 85, y - 6); ctx.stroke();
        }
        ctx.restore();
        const edge = ctx.createRadialGradient(400, 300, 190, 400, 300, 510);
        edge.addColorStop(0, "rgba(0,0,0,0)"); edge.addColorStop(1, "rgba(0,0,0,.72)");
        ctx.fillStyle = edge; ctx.fillRect(0, 0, W, H);
    }

    function drawTrails() {
        if (!settings.trails) return;
        ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.shadowBlur = 9;
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
            const i = r * cols + c, a = nectar[i], b = home[i];
            if (a > 2) { ctx.shadowColor = "#9dff55"; ctx.fillStyle = `rgba(164,255,83,${Math.min(.42, .035 + a / 620)})`; ctx.beginPath(); ctx.arc(c * GRID + 4, r * GRID + 4, 4.8, 0, TAU); ctx.fill(); }
            if (b > 2) { ctx.shadowColor = "#8d7cff"; ctx.fillStyle = `rgba(139,118,255,${Math.min(.38, .03 + b / 700)})`; ctx.beginPath(); ctx.arc(c * GRID + 4, r * GRID + 4, 4.5, 0, TAU); ctx.fill(); }
        }
        ctx.restore();
    }

    function drawMotes() {
        ctx.save(); ctx.globalCompositeOperation = "lighter";
        motes.forEach(m => {
            m.y -= m.drift; m.x += Math.sin(frame * m.speed + m.phase) * .12;
            if (m.y < -5) { m.y = H + 5; m.x = Math.random() * W; }
            const pulse = .25 + .45 * (1 + Math.sin(frame * .025 + m.phase)) / 2;
            ctx.shadowBlur = 8; ctx.shadowColor = m.gold ? "#ffc966" : "#91eecb";
            ctx.fillStyle = m.gold ? `rgba(255,207,104,${pulse})` : `rgba(151,231,201,${pulse})`;
            ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, TAU); ctx.fill();
        }); ctx.restore();
    }

    function drawNest() {
        ctx.save(); ctx.translate(nest.x, nest.y);
        ctx.shadowBlur = 30; ctx.shadowColor = "rgba(151,112,255,.55)";
        roundedPolygon(0, 0, Array.from({ length: 12 }, (_, i) => [i / 12 * TAU, i % 2 ? 43 : 48]), "#17201d", "#66558b");
        ctx.shadowBlur = 0; ctx.lineWidth = 2;
        ctx.strokeStyle = "rgba(168,131,255,.55)";
        for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 27, Math.sin(a) * 27); ctx.lineTo(Math.cos(a) * 40, Math.sin(a) * 40); ctx.stroke(); }
        const hole = ctx.createRadialGradient(-8, -7, 2, 0, 0, 29);
        hole.addColorStop(0, "#000305"); hole.addColorStop(.72, "#080b0d"); hole.addColorStop(1, "#392d4b");
        ctx.fillStyle = hole; ctx.beginPath(); ctx.arc(0, 0, 29, 0, TAU); ctx.fill();
        ctx.fillStyle = "rgba(204,184,255,.75)"; ctx.font = "600 9px Georgia"; ctx.textAlign = "center"; ctx.fillText("GLOAMROOT", 0, 4);
        ctx.restore();
    }

    function drawFood() {
        food.forEach((f, fi) => {
            if (f.amount <= 0) return;
            const remaining = f.amount / f.max;
            const scale = .12 + .88 * Math.sqrt(remaining), pulse = 1 + Math.sin(frame * .025 + fi * 2) * .05;
            const shardCount = Math.max(1, Math.ceil(7 * remaining));
            ctx.save(); ctx.translate(f.x, f.y); ctx.scale(scale * pulse, scale * pulse);
            ctx.globalCompositeOperation = "lighter"; ctx.shadowBlur = 24; ctx.shadowColor = `hsla(${f.hue},90%,65%,.75)`;
            for (let i = 0; i < shardCount; i++) {
                const a = i / shardCount * TAU + fi, h = 12 + (i % 3) * 6;
                ctx.fillStyle = `hsla(${f.hue + i * 4},75%,${52 + i * 3}%,.72)`;
                ctx.beginPath(); ctx.moveTo(Math.cos(a) * 5, Math.sin(a) * 5); ctx.lineTo(Math.cos(a - .2) * h, Math.sin(a - .2) * h); ctx.lineTo(Math.cos(a + .2) * h, Math.sin(a + .2) * h); ctx.closePath(); ctx.fill();
            }
            ctx.fillStyle = "rgba(235,255,203,.85)"; ctx.beginPath(); ctx.arc(0, 0, 6, 0, TAU); ctx.fill();
            ctx.restore();
        });
    }

    function drawObstacles() {
        obstacles.forEach((o, i) => {
            ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.angle);
            ctx.shadowBlur = 9; ctx.shadowColor = "rgba(99,212,180,.25)";
            roundedPolygon(0, 0, o.points, "#202a28", "#55746b");
            ctx.strokeStyle = "rgba(125,214,181,.45)"; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(-o.r * .35, o.r * .25); ctx.lineTo(0, -o.r * .35); ctx.lineTo(o.r * .28, o.r * .2); ctx.stroke();
            ctx.restore();
        });
    }

    function drawStats() {
        document.getElementById("stat-ants").textContent = ants.length;
        document.getElementById("stat-carrying").textContent = ants.filter(a => a.carrying).length;
        document.getElementById("stat-food").textContent = food.reduce((s, f) => s + f.amount, 0);
        document.getElementById("stat-pheromones").textContent = settings.trails ? "Glowing" : "Veiled";
    }

    function loop() {
        frame++; for (let s = 0; s < Math.max(1, Math.round(settings.speed)); s++) ants.forEach(a => a.update());
        updateTrails(); drawGround(); drawTrails(); drawMotes(); drawFood(); drawObstacles(); drawNest(); ants.forEach(a => a.draw());
        if (frame % 12 === 0) drawStats(); requestAnimationFrame(loop);
    }

    function point(e) {
        const r = canvas.getBoundingClientRect(), touch = e.touches && e.touches[0], p = touch || e;
        return { x: (p.clientX - r.left) * W / r.width, y: (p.clientY - r.top) * H / r.height };
    }
    function addStone(p) {
        if (distance(p, nest) < 65 || food.some(f => distance(p, f) < f.radius + 25)) return;
        if (lastPoint && distance(p, lastPoint) < 16) return;
        const r = 9 + Math.random() * 5;
        obstacles.push({ x: p.x, y: p.y, r, angle: Math.random() * TAU, points: Array.from({ length: 7 }, (_, i) => [i / 7 * TAU, r * (.78 + Math.random() * .32)]) });
        lastPoint = p;
    }
    function bind() {
        const slider = (id, output, fn) => document.getElementById(id).addEventListener("input", e => { fn(+e.target.value); document.getElementById(output).textContent = id === "simulation-speed" ? settings.speed.toFixed(1) + "x" : id === "evaporation-rate" ? settings.evaporation.toFixed(2) : e.target.value; });
        slider("ant-count", "ant-count-value", v => { settings.antCount = v; resizeAnts(); });
        slider("pheromone-strength", "pheromone-strength-value", v => settings.strength = v);
        slider("evaporation-rate", "evaporation-rate-value", v => settings.evaporation = v / 100);
        slider("simulation-speed", "simulation-speed-value", v => settings.speed = v / 100);
        document.getElementById("show-pheromones").onchange = e => settings.trails = e.target.checked;
        document.getElementById("show-sensors").onchange = e => settings.sensors = e.target.checked;
        document.getElementById("clear-pheromones").onclick = () => { home.fill(0); nectar.fill(0); seedHomeTrail(); };
        document.getElementById("clear-obstacles").onclick = () => obstacles.length = 0;
        document.getElementById("reset-simulation").onclick = () => { obstacles.length = 0; delivered = 0; food.forEach(f => f.amount = f.max); home.fill(0); nectar.fill(0); seedHomeTrail(); ants.forEach(a => a.reset()); };
        ["mousedown", "touchstart"].forEach(type => canvas.addEventListener(type, e => { if (type[0] === "t") e.preventDefault(); drawing = true; lastPoint = null; addStone(point(e)); }, { passive: false }));
        ["mousemove", "touchmove"].forEach(type => canvas.addEventListener(type, e => { if (!drawing) return; if (type[0] === "t") e.preventDefault(); addStone(point(e)); }, { passive: false }));
        ["mouseup", "mouseleave", "touchend"].forEach(type => canvas.addEventListener(type, () => { drawing = false; lastPoint = null; }));
    }

    function init() {
        canvas = document.getElementById("canvas"); if (!canvas) return; ctx = canvas.getContext("2d");
        settings.antCount = +document.getElementById("ant-count").value;
        makeMotes(); seedHomeTrail(); resizeAnts(); bind(); loop();
    }
    window.addEventListener("DOMContentLoaded", init);
})();
