/*
 * Injected into a live optics tool page. Camera, captions, the control HUD, the
 * live readout chips and the end card are pure functions of the timeline time t,
 * so any frame always looks the same. Everything eases; nothing cuts or flashes.
 */
(function () {
    "use strict";
    const W = 540, H = 960;
    let timeline, main, root, caption, hud, hudLabel, hudValue, hudFill, hudKnob, finger, chips, end, mark, band, foot, dim, spot;
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
        // Tools move focus when they rebuild their controls; a focus that scrolls the
        // page would knock the camera and spotlight off their targets.
        const focus = HTMLElement.prototype.focus;
        HTMLElement.prototype.focus = function (options) { focus.call(this, { ...options, preventScroll: true }); };
        main = document.querySelector("main.tool-main");
        root = document.createElement("div");
        root.id = "reel-root";
        document.body.appendChild(root);
        spot = el("div", "reel-spot");
        band = el("div", "reel-band");
        foot = el("div", "reel-foot");
        mark = el("div", "reel-mark", timeline.mark);
        caption = el("div", "reel-caption");
        chips = el("div", "reel-chips");
        hud = el("div", "reel-hud", `<div class="hud-row"><span class="label"></span><span class="value"></span></div><div class="track"><div class="fill"></div><div class="knob"></div></div>`);
        hudLabel = hud.querySelector(".label");
        hudValue = hud.querySelector(".value");
        hudFill = hud.querySelector(".fill");
        hudKnob = hud.querySelector(".knob");
        finger = el("div", "reel-finger", "<i></i>");
        dim = el("div", "reel-dim");
        const e = timeline.end;
        end = el("div", "reel-end", `
            <div class="kicker">FREE INTERACTIVE OPTICS</div>
            <h1>${e.title}</h1>
            <div class="rule"></div>
            <div class="formula">${e.formula}</div>
            <div class="list">${e.list}</div>
            <div class="url">${e.url}</div>
            <div class="small">IN YOUR BROWSER · NO SIGN-UP</div>`);
    }

    function active(list, t, lead = 0, tail = 0) {
        return list.find(item => t >= item.from - lead && t < item.to + tail);
    }

    // Where a shot puts the page: scale s and translation so the target sits at height y.
    // `fit` (a gutter in px) caps the zoom so the whole target width stays in frame.
    function placement(shot) {
        main.style.transform = "none";
        const target = document.querySelector(shot.target);
        const base = main.getBoundingClientRect();
        const rect = target ? target.getBoundingClientRect() : base;
        const s = shot.fit == null ? shot.zoom : Math.min(shot.zoom ?? Infinity, (W - 2 * shot.fit) / rect.width);
        const cx = rect.left - base.left + rect.width * (shot.ax ?? .5);
        const cy = rect.top - base.top + rect.height * (shot.anchor ?? .5);
        return { s, tx: W / 2 - s * cx, ty: H * shot.y - s * cy };
    }

    // Nearby shots glide; far-apart shots dip to dark and cut, so the camera never
    // sweeps past other parts of the page on the way.
    function camera(t) {
        const index = timeline.shots.findIndex((shot, i) => shot.t <= t && (i === timeline.shots.length - 1 || timeline.shots[i + 1].t > t));
        const shot = timeline.shots[Math.max(0, index)];
        const now = placement(shot);
        let p = now, darkness = 0, current = shot;
        if (index > 0 && t - shot.t < CAMERA_MOVE) {
            const previous = timeline.shots[index - 1], before = placement(previous);
            if (shot.dip || Math.abs(before.ty - now.ty) > JUMP) {
                const age = t - shot.t;
                if (age < DIP) { p = before; current = previous; darkness = ease(age / DIP); }
                else darkness = 1 - ease((age - DIP) / DIP);
            } else {
                const k = ease((t - shot.t) / CAMERA_MOVE);
                p = { s: before.s + (now.s - before.s) * k, tx: before.tx + (now.tx - before.tx) * k, ty: before.ty + (now.ty - before.ty) * k };
            }
        }
        main.style.transform = `translate(${p.tx.toFixed(2)}px, ${p.ty.toFixed(2)}px) scale(${p.s.toFixed(4)})`;
        dim.style.opacity = darkness.toFixed(3);
        renderSpot(current);
    }

    // A spotlight dims everything around the filmed element (or `spot` selector). It
    // tracks the live element through camera moves, so it never needs to fade.
    function renderSpot(shot) {
        const selector = shot.spot === false ? null : (typeof shot.spot === "string" ? shot.spot : shot.target);
        const node = selector && document.querySelector(selector);
        if (!node) { spot.style.opacity = "0"; return; }
        const rect = node.getBoundingClientRect(), pad = shot.pad ?? 8;
        Object.assign(spot.style, { left: `${rect.left - pad}px`, top: `${rect.top - pad}px`, width: `${rect.width + 2 * pad}px`, height: `${rect.height + 2 * pad}px` });
        spot.style.opacity = "1";
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
        caption.style.opacity = Math.min(fadeIn, fadeOut).toFixed(3);
        caption.style.top = `${52 + (1 - fadeIn) * 14}px`;
    }

    const format = (v, spec) => {
        const x = v * (spec.scale ?? 1);
        return `${x.toFixed(spec.digits ?? 0).replace("-", "−")}${spec.unit ?? ""}`;
    };

    // The control being changed, drawn as a large slider that follows the real input.
    function renderHud(t) {
        const item = active(timeline.huds, t);
        if (!item) { hud.style.opacity = "0"; finger.style.opacity = "0"; return; }
        const input = document.querySelector(item.target);
        const v = Number(input.value);
        const min = item.min ?? Number(input.min), max = item.max ?? Number(input.max);
        const k = Math.min(1, Math.max(0, (v - min) / (max - min)));
        hudLabel.innerHTML = item.label;
        hudValue.textContent = format(v, item);
        hudFill.style.width = `${(k * 100).toFixed(2)}%`;
        hudKnob.style.left = `${(k * 100).toFixed(2)}%`;
        const show = Math.min(ease((t - item.from) / FADE), ease((item.to - t) / FADE));
        hud.style.opacity = show.toFixed(3);
        const sweep = timeline.sweeps.find(s => s.target === item.target && t >= s.from - .5 && t <= s.to + .4);
        if (!sweep) { finger.style.opacity = "0"; return; }
        const rect = hudKnob.getBoundingClientRect();
        finger.style.opacity = (show * Math.min(ease((t - sweep.from + .5) / .4), ease((sweep.to + .4 - t) / .4))).toFixed(3);
        finger.firstElementChild.style.left = `${rect.left + rect.width / 2}px`;
        finger.firstElementChild.style.top = `${rect.top + rect.height / 2}px`;
    }

    // Live readouts copied from the page's own result fields every frame.
    function renderChips(t) {
        const item = active(timeline.chips, t);
        if (!item) { chips.style.opacity = "0"; return; }
        const key = String(timeline.chips.indexOf(item));
        if (chips.dataset.key !== key) {
            chips.dataset.key = key;
            chips.innerHTML = item.items.map(c => `<div class="chip${c.accent ? " accent" : ""}"><span class="k">${c.label}</span><span class="v"></span></div>`).join("");
        }
        [...chips.children].forEach((node, i) => {
            const c = item.items[i];
            const source = document.querySelector(c.source);
            let text = source ? source.textContent.trim().replace(/\s+/g, " ") : "—";
            // `row`: the value beside the readout label that starts with this text.
            if (c.row && source) {
                const dt = [...source.querySelectorAll("dt")].find(d => d.textContent.trim().startsWith(c.row));
                text = dt && dt.nextElementSibling ? dt.nextElementSibling.textContent.trim() : "—";
            }
            if (c.pick) text = (text.match(new RegExp(c.pick)) || [, text])[1];
            node.lastElementChild.textContent = text;
            if (c.labelFrom) node.firstElementChild.textContent = document.querySelector(c.labelFrom).textContent.trim();
        });
        chips.style.opacity = Math.min(ease((t - item.from) / FADE), ease((item.to - t) / FADE)).toFixed(3);
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
            const v = s.a + (s.b - s.a) * (s.linear ? Math.min(1, Math.max(0, (t - s.from) / (s.to - s.from))) : ease((t - s.from) / (s.to - s.from)));
            if (Math.abs(Number(input.value) - v) < 1e-6) continue;
            input.value = String(v);
            input.dispatchEvent(new Event("input", { bubbles: true }));
            if (t >= s.to) input.dispatchEvent(new Event("change", { bubbles: true }));
        }
    }

    function act(action) {
        const node = document.querySelector(action.target || "body");
        if (!node) throw new Error(`reel action target missing: ${action.target}`);
        if (action.act === "click") node.click();
        if (action.act === "label") node.textContent = action.text;
        if (action.act === "check" && node.checked !== action.value) node.click();
        if (action.act === "set" || action.act === "select" || action.act === "option") {
            const option = action.act === "option" && [...node.options].find(o => new RegExp(action.match).test(o.textContent));
            if (action.act === "option" && !option) throw new Error(`no option matching ${action.match} in ${action.target}`);
            node.value = option ? option.value : String(action.value);
            node.dispatchEvent(new Event("input", { bubbles: true }));
            node.dispatchEvent(new Event("change", { bubbles: true }));
        }
    }

    function frame(t) {
        if (scrollX || scrollY) scrollTo(0, 0);
        sweep(t);
        camera(t);
        renderCaption(t);
        renderHud(t);
        renderChips(t);
        renderEnd(t);
    }

    window.__reel = { init, frame, act };
})();
