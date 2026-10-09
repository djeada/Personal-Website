/*
 * Injected into the live game page. Everything here is a pure function of the
 * timeline time t, so a frame can be rendered in any order and always looks the
 * same: the camera, captions, flashes, shake and grain are recomputed per frame
 * rather than animated. Game-side CSS animations are paused and stepped by hand.
 */
(function () {
    "use strict";
    const W = 540, H = 960;
    let timeline, shade, root, caption, flash, grain, grainCtx, tap, end, mark, section;
    const seen = new WeakSet();

    function el(tag, id, html) {
        const node = document.createElement(tag);
        if (id) node.id = id;
        if (html) node.innerHTML = html;
        root.appendChild(node);
        return node;
    }

    function rng(seed) {
        let a = seed >>> 0;
        return () => {
            a = (a + 0x6D2B79F5) >>> 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    const easeOut = x => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
    const decay = (age, rate) => (age < 0 ? 0 : Math.exp(-age * rate));
    const inRanges = (t, ranges) => ranges.some(([a, b]) => t >= a && t < b);

    function init(data) {
        timeline = data;
        section = document.querySelector(".oracle");
        root = document.createElement("div");
        root.id = "promo-root";
        document.body.appendChild(root);
        grain = el("canvas", "promo-grain");
        grain.width = 270; grain.height = 480;
        grainCtx = grain.getContext("2d");
        el("div", "promo-vignette");
        shade = el("div", "promo-shade");
        mark = el("div", "promo-mark", "OUTCLICK THE ORACLE · ADAMDJELLOULI.COM");
        end = el("div", "promo-end", `
            <div class="kicker">A NEURAL NET VS. YOU</div>
            <h1>Outclick<br>the <em>Oracle</em></h1>
            <div class="symbols"><span style="color:#84eee0">◯</span><span style="color:#c4acff">△</span><span style="color:#ffc576">ϟ</span></div>
            <div class="url">adamdjellouli.com/tools/neural_oracle</div>
            <div class="small">FREE · IN YOUR BROWSER · 30 CLICKS</div>`);
        tap = el("div", "promo-tap", "<i></i><b></b>");
        caption = el("div", "promo-caption");
        flash = el("div", "promo-flash");
        if (!document.fonts.check('76px "Anton"')) root.classList.add("fallback-font");
    }

    // Pause every CSS animation/transition the game starts and step it with the frame clock.
    function advance(dt) {
        for (const animation of document.getAnimations()) {
            if (!seen.has(animation)) {
                seen.add(animation);
                animation.pause();
                animation.currentTime = 0;
            }
            if (animation.playState === "paused") animation.currentTime = (Number(animation.currentTime) || 0) + dt;
        }
    }

    function shotAt(t) {
        return timeline.shots.filter(s => s.t <= t + 1e-6).pop() || timeline.shots[0];
    }

    function camera(t) {
        const shot = shotAt(t);
        section.style.transform = "none";
        const target = document.querySelector(shot.target);
        const base = section.getBoundingClientRect();
        const rect = target ? target.getBoundingClientRect() : base;
        const age = t - shot.t;
        let s = shot.zoom * (1 + (shot.drift || 0) * age);
        // Punch-in on every click, plus a lighter pulse on each beat once the drop hits.
        for (const move of timeline.moves) s *= 1 + .07 * decay(t - move.t, 11);
        if (t >= 4 && t < timeline.endCard) s *= 1 + .02 * decay((t - 4) % timeline.BEAT, 9);
        const cx = rect.left - base.left + rect.width / 2;
        const cy = rect.top - base.top + rect.height * (shot.anchor ?? .5);
        let tx = W / 2 - s * cx, ty = H * shot.y - s * cy;
        const sw = base.width * s;
        tx = sw > W ? Math.min(0, Math.max(W - sw, tx)) : (W - sw) / 2;
        // Shake: hard on predicted clicks and on the big escape, light on the rest.
        let amp = 0;
        timeline.moves.forEach((move, i) => {
            const strength = !move.escaped ? 9 : i === 6 ? 20 : 4;
            amp += strength * decay(t - move.t, 10);
        });
        const r = rng(Math.floor(t * timeline.FPS) + 7);
        tx += (r() - .5) * 2 * amp; ty += (r() - .5) * 2 * amp;
        const rot = (r() - .5) * amp * .08;
        section.style.transform = `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) scale(${s.toFixed(4)}) rotate(${rot.toFixed(3)}deg)`;
        const mono = inRanges(t, timeline.mono);
        section.parentElement.style.filter = mono ? "grayscale(1) contrast(1.55) brightness(1.08)" : "saturate(1.3) contrast(1.1)";
        return mono;
    }

    function renderCaption(t) {
        const index = timeline.captions.findIndex(c => t >= c.t && t < c.end);
        const current = timeline.captions[index];
        shade.style.opacity = current && current.pos < .3 && t < timeline.endCard ? "1" : "0";
        if (index < 0) { caption.innerHTML = ""; return; }
        const previous = timeline.captions[index - 1];
        const carried = previous && Math.abs(previous.end - current.t) < 1e-6 && current.lines.length > previous.lines.length &&
            previous.lines.every((line, i) => line === current.lines[i]) ? previous.lines.length : 0;
        const age = t - current.t;
        const key = `${index}`;
        if (caption.dataset.key !== key) {
            caption.dataset.key = key;
            caption.innerHTML = `<div class="block">${current.lines.map(line => `<span class="line">${line}</span>`).join("")}</div>`;
            caption.querySelectorAll(".line").forEach(line => { line.style.fontSize = `${76 * (current.size || 1)}px`; });
            const widest = Math.max(...[...caption.querySelectorAll(".line")].map(line => line.scrollWidth));
            if (widest > W - 40) caption.querySelectorAll(".line").forEach(line => { line.style.fontSize = `${parseFloat(line.style.fontSize) * (W - 40) / widest}px`; });
        }
        const block = caption.firstElementChild;
        block.style.top = `${H * current.pos - block.offsetHeight / 2}px`;
        const slam = 1 - easeOut(age / .13);
        caption.querySelectorAll(".line").forEach((line, i) => {
            const fresh = i >= carried;
            const k = fresh ? slam : 0;
            line.style.transform = `scale(${(1 + .75 * k).toFixed(3)}) rotate(${(-4 * k).toFixed(2)}deg)`;
            const split = (fresh ? 9 * k : 0) + 1.5;
            line.style.textShadow = `${-split}px 0 rgba(255,40,80,.85), ${split}px 0 rgba(60,240,255,.85), 0 5px 0 #000, 0 10px 30px rgba(0,0,0,.7)`;
        });
    }

    function renderTap(t) {
        const move = timeline.moves.filter(m => m.t <= t + 1e-6).pop();
        const age = move ? t - move.t : 99;
        if (age > .35) { tap.style.display = "none"; return; }
        const button = document.querySelector(`[data-choice="${move.choice}"]`);
        const rect = button.getBoundingClientRect();
        const x = rect.left + rect.width / 2, y = rect.top + rect.height * .45;
        if (x < 0 || x > W || y < 0 || y > H) { tap.style.display = "none"; return; }
        tap.style.display = "block";
        const ring = tap.firstElementChild, dot = tap.lastElementChild;
        const size = 30 + easeOut(age / .35) * 90;
        Object.assign(ring.style, { left: `${x}px`, top: `${y}px`, width: `${size}px`, height: `${size}px`, opacity: String(1 - age / .35) });
        Object.assign(dot.style, { left: `${x}px`, top: `${y}px`, opacity: String(Math.max(0, 1 - age / .15)) });
    }

    function renderFlash(t) {
        let white = 0, tint = null, tintAmount = 0;
        timeline.moves.forEach((move, i) => {
            const age = t - move.t;
            if (age < 0 || age > .5) return;
            const amount = i === 6 ? .95 * decay(age, 9) : move.escaped ? .22 * decay(age, 16) : .4 * decay(age, 14);
            if (i === 6) white = Math.max(white, amount);
            else if (amount > tintAmount) { tintAmount = amount; tint = move.escaped ? "#84eee0" : "#fc94c3"; }
        });
        for (const shot of timeline.shots) white = Math.max(white, .16 * decay(t - shot.t, 22));
        white = Math.max(white, .9 * decay(t - timeline.endCard, 7), .7 * decay(t - 4, 10), .8 * decay(t - 23, 12));
        if (tintAmount > white) { flash.style.background = tint; flash.style.opacity = tintAmount.toFixed(3); }
        else { flash.style.background = "#fff"; flash.style.opacity = white.toFixed(3); }
    }

    function renderGrain(t, mono) {
        const r = rng(Math.floor(t * timeline.FPS) * 13 + 1);
        const image = grainCtx.createImageData(grain.width, grain.height);
        for (let i = 0; i < image.data.length; i += 4) {
            const v = r() * 255;
            image.data[i] = image.data[i + 1] = image.data[i + 2] = v; image.data[i + 3] = 255;
        }
        grainCtx.putImageData(image, 0, 0);
        grain.style.opacity = mono ? ".18" : ".06";
    }

    function renderEnd(t) {
        const age = t - (timeline.endCard + 2);
        end.style.opacity = t >= timeline.endCard ? (age < 0 ? ".86" : "1") : "0";
        const card = [...end.children];
        card.forEach((child, i) => {
            const k = 1 - easeOut((age - i * .12) / .16);
            child.style.opacity = age < i * .12 ? "0" : "1";
            child.style.transform = `scale(${(1 + .6 * k).toFixed(3)})`;
        });
        const symbols = end.querySelector(".symbols").children;
        [...symbols].forEach((symbol, i) => {
            const pulse = decay((t - timeline.endCard - 2 - i * timeline.BEAT / 2) % (timeline.BEAT * 2), 6);
            symbol.style.transform = `translateY(${(-14 * pulse).toFixed(2)}px) scale(${(1 + .25 * pulse).toFixed(3)})`;
        });
        mark.style.opacity = t >= 4 && t < timeline.endCard ? "1" : "0";
    }

    function frame(t, dt) {
        advance(dt);
        const mono = camera(t);
        renderCaption(t);
        renderTap(t);
        renderFlash(t);
        renderGrain(t, mono);
        renderEnd(t);
    }

    window.__promo = { init, frame };
})();
