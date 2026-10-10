/*
 * Injected into the live lab page. The camera, captions, finger and end card are
 * pure functions of the timeline time t, so any frame always looks the same.
 * Everything moves with easing; nothing cuts, shakes or flashes.
 */
(function () {
    "use strict";
    const W = 540, H = 960;
    let timeline, main, root, caption, finger, end, mark, band, foot, dim, spot;
    const ease = x => { const k = Math.min(1, Math.max(0, x)); return k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
    const CAMERA_MOVE = 1.1, FADE = .45, JUMP = 520, DIP = .5;

    function el(tag, id, html) {
        const node = document.createElement(tag);
        node.id = id;
        if (html) node.innerHTML = html;
        root.appendChild(node);
        return node;
    }

    function init(data) {
        timeline = data;
        main = document.querySelector("main.tool-main");
        root = document.createElement("div");
        root.id = "reel-root";
        document.body.appendChild(root);
        spot = el("div", "reel-spot");
        band = el("div", "reel-band");
        foot = el("div", "reel-foot");
        mark = el("div", "reel-mark", "MOMENT OF INERTIA LAB · ADAMDJELLOULI.COM");
        caption = el("div", "reel-caption");
        finger = el("div", "reel-finger", "<i></i>");
        dim = el("div", "reel-dim");
        end = el("div", "reel-end", `
            <div class="kicker">FREE INTERACTIVE PHYSICS</div>
            <h1>Moment of<br>Inertia Lab</h1>
            <div class="formula">I = ∫ r² dm</div>
            <div class="list">Drag the ball · race two bodies<br>watch the integral add itself up</div>
            <div class="url">adamdjellouli.com/tools/moment_of_inertia</div>
            <div class="small">IN YOUR BROWSER · NO SIGN-UP</div>`);
    }

    // Where a shot puts the page: scale s and translation so the target sits at height y.
    function placement(shot) {
        main.style.transform = "none";
        const target = document.querySelector(shot.target);
        const base = main.getBoundingClientRect();
        const rect = target ? target.getBoundingClientRect() : base;
        const s = shot.zoom;
        const cx = rect.left - base.left + rect.width / 2;
        const cy = rect.top - base.top + rect.height * (shot.anchor ?? .5);
        return { s, tx: W / 2 - s * cx, ty: H * shot.y - s * cy };
    }

    // Nearby shots glide; far-apart shots dip to dark and cut, so the camera never
    // sweeps past other parts of the page on the way.
    function camera(t) {
        const index = timeline.shots.findIndex((shot, i) => shot.t <= t && (i === timeline.shots.length - 1 || timeline.shots[i + 1].t > t));
        const shot = timeline.shots[Math.max(0, index)];
        const now = placement(shot);
        let p = now, darkness = 0, active = shot;
        if (index > 0 && t - shot.t < CAMERA_MOVE) {
            const previous = timeline.shots[index - 1], before = placement(previous);
            if (Math.abs(before.ty - now.ty) > JUMP) {
                const age = t - shot.t;
                if (age < DIP) { p = before; active = previous; darkness = ease(age / DIP); }
                else darkness = 1 - ease((age - DIP) / DIP);
            } else {
                const k = ease((t - shot.t) / CAMERA_MOVE);
                p = { s: before.s + (now.s - before.s) * k, tx: before.tx + (now.tx - before.tx) * k, ty: before.ty + (now.ty - before.ty) * k };
            }
        }
        main.style.transform = `translate(${p.tx.toFixed(2)}px, ${p.ty.toFixed(2)}px) scale(${p.s.toFixed(4)})`;
        dim.style.opacity = darkness.toFixed(3);
        renderSpot(active, t);
    }

    // A spotlight dims everything around the target of shots marked `spot`.
    function renderSpot(shot, t) {
        if (!shot.spot) { spot.style.opacity = "0"; return; }
        const rect = document.querySelector(shot.target).getBoundingClientRect(), pad = 12;
        Object.assign(spot.style, { left: `${rect.left - pad}px`, top: `${rect.top - pad}px`, width: `${rect.width + 2 * pad}px`, height: `${rect.height + 2 * pad}px` });
        spot.style.opacity = ease((t - shot.t - .3) / .8).toFixed(3);
    }

    function renderCaption(t) {
        const current = timeline.captions.find(c => t >= c.t && t < c.end);
        if (!current) { caption.style.opacity = "0"; return; }
        const key = String(timeline.captions.indexOf(current));
        if (caption.dataset.key !== key) {
            caption.dataset.key = key;
            caption.innerHTML = current.lines.map(line => `<span class="line">${line}</span>`).join("") + (current.sub ? `<span class="sub">${current.sub}</span>` : "");
        }
        const fadeIn = ease((t - current.t) / FADE), fadeOut = ease((current.end - t) / FADE);
        const k = Math.min(fadeIn, fadeOut);
        caption.style.opacity = k.toFixed(3);
        caption.style.top = `${70 + (1 - fadeIn) * 14}px`;
    }

    function renderFinger(t) {
        const sweep = timeline.sweeps.find(s => s.finger && t >= s.from - .6 && t <= s.to + .5);
        if (!sweep) { finger.style.opacity = "0"; return; }
        const canvas = document.getElementById("primer-canvas"), rect = canvas.getBoundingClientRect();
        const w = canvas.clientWidth, h = canvas.clientHeight;
        const r = Number(document.getElementById("primer-r").value);
        const ax = w * .42, ay = h * .5, px = Math.min(w * .4, h * .46) / (1.2 * Math.SQRT2);
        const x = rect.left + (ax + r * px * Math.cos(-.4)) * rect.width / w;
        const y = rect.top + (ay + r * px * Math.sin(-.4)) * rect.height / h;
        const show = Math.min(ease((t - sweep.from + .6) / .4), ease((sweep.to + .5 - t) / .4));
        finger.style.opacity = show.toFixed(3);
        finger.firstElementChild.style.left = `${x}px`;
        finger.firstElementChild.style.top = `${y}px`;
    }

    function renderEnd(t) {
        const k = ease((t - timeline.endCard) / .8);
        end.style.opacity = k.toFixed(3);
        [...end.children].forEach((child, i) => {
            const c = ease((t - timeline.endCard - .3 - i * .35) / .6);
            child.style.opacity = c.toFixed(3);
            child.style.transform = `translateY(${((1 - c) * 18).toFixed(1)}px)`;
        });
        const film = t < timeline.endCard ? 1 : 1 - k;
        mark.style.opacity = band.style.opacity = foot.style.opacity = film.toFixed(3);
    }

    // Sliders swept every frame: step="any" so the value glides instead of snapping.
    function sweep(t) {
        for (const s of timeline.sweeps) {
            if (t < s.from - .05 || t > s.to + .05) continue;
            const input = document.querySelector(s.target);
            input.step = "any";
            const v = s.a + (s.b - s.a) * ease((t - s.from) / (s.to - s.from));
            if (Math.abs(Number(input.value) - v) < 1e-4) continue;
            input.value = String(v);
            input.dispatchEvent(new Event("input", { bubbles: true }));
        }
    }

    function act(action) {
        const node = document.querySelector(action.target || "body");
        if (action.act === "click") node.click();
        if (action.act === "label") node.textContent = action.text;
        if (action.act === "builder") {
            const speed = document.getElementById("build-speed");
            if (![...speed.options].some(o => o.value === String(action.speed))) speed.add(new Option("reel", String(action.speed)));
            speed.value = String(action.speed);
            const resolution = document.getElementById("resolution");
            resolution.value = String(action.resolution);
            resolution.dispatchEvent(new Event("change", { bubbles: true }));
        }
    }

    function frame(t) {
        sweep(t);
        camera(t);
        renderCaption(t);
        renderFinger(t);
        renderEnd(t);
    }

    window.__reel = { init, frame, act, placement: shot => { const p = placement(shot); main.style.transform = `translate(${p.tx}px, ${p.ty}px) scale(${p.s})`; } };
})();
