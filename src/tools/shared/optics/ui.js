(function(root, factory) {
    const m = factory();
    if (typeof module === "object" && module.exports) module.exports = m;
    else root.OpticsUI = m;
})(typeof self !== "undefined" ? self : this, function() {
    "use strict";

    const hasDOM = typeof window !== "undefined" && typeof document !== "undefined";
    const FONT_FAMILY = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
    const MONO_FAMILY = "ui-monospace, SFMono-Regular, Consolas, monospace";



    const CANVAS_PALETTE = Object.freeze({
        background: "#07070d",
        panel: "#0d0d18",
        grid: "rgba(184, 178, 207, 0.13)",
        gridStrong: "rgba(184, 178, 207, 0.28)",
        axis: "#8f89a8",
        text: "#ece9f8",
        textMuted: "#b8b2cf",
        cursor: "#ffffff",
        marker: "#f8d477",
        warning: "#ffb86b",
        font: FONT_FAMILY,
        mono: MONO_FAMILY,

        series: ["#69f5e7", "#f8d477", "#f187c8", "#a78bfa", "#7ee787", "#ff9f6b", "#8ab4ff"],
        dashes: [
            [],
            [7, 4],
            [2, 3],
            [10, 3, 2, 3],
            [4, 4],
            [1, 2],
            [12, 4]
        ]
    });

    const LIGHT_FALLBACK = {
        text: "#202437",
        textSecondary: "#4c5368",
        textMuted: "#5f667b",
        surface: "#ffffff",
        surfaceElevated: "#f7f6fb",
        border: "#dcd8eb",
        primary: "#6855bd",
        accent: "#0f8c86"
    };
    const DARK_FALLBACK = {
        text: "#f5f3ff",
        textSecondary: "#b8b2cf",
        textMuted: "#9d97b5",
        surface: "#0d0d18",
        surfaceElevated: "#131322",
        border: "rgba(167, 139, 250, .18)",
        primary: "#a78bfa",
        accent: "#69f5e7"
    };

    function isDarkTheme() {
        if (!hasDOM) return true;
        const de = document.documentElement,
            b = document.body;
        if (de.dataset.theme === "dark" || (b && b.dataset.theme === "dark")) return true;
        if (de.dataset.theme === "light" || (b && b.dataset.theme === "light")) return false;
        return !!((b && b.classList.contains("dark-mode")) || de.classList.contains("dark") || de.classList.contains("dark-mode"));
    }

    function readToken(name) {
        if (!hasDOM) return "";

        const fromBody = document.body ? getComputedStyle(document.body).getPropertyValue(name).trim() : "";
        return fromBody || getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    }


    function palette() {
        const dark = isDarkTheme();
        const fb = dark ? DARK_FALLBACK : LIGHT_FALLBACK;
        const tok = (n, f) => readToken(n) || f;
        return {
            isDark: dark,
            text: tok("--text-primary", fb.text),
            textSecondary: tok("--text-secondary", fb.textSecondary),
            textMuted: tok("--text-muted", fb.textMuted),
            surface: tok("--surface-color", fb.surface),
            surfaceElevated: tok("--surface-elevated", fb.surfaceElevated),
            border: tok("--border-color", fb.border),
            primary: tok("--primary-color", fb.primary),
            accent: fb.accent,
            spectrum: {
                cyan: tok("--spectrum-cyan", "#69f5e7"),
                violet: tok("--spectrum-violet", "#a78bfa"),
                rose: tok("--spectrum-rose", "#f187c8"),
                gold: tok("--spectrum-gold", "#f8d477")
            },
            canvas: CANVAS_PALETTE
        };
    }


    function onThemeChange(cb) {
        if (!hasDOM) return () => {};
        let last = isDarkTheme(),
            pending = false;
        const fire = () => {
            if (pending) return;
            pending = true;
            requestAnimationFrame(() => {
                pending = false;
                const now = isDarkTheme();
                if (now !== last) {
                    last = now;
                    cb(palette());
                }
            });
        };
        const mo = new MutationObserver(fire);
        const opts = {
            attributes: true,
            attributeFilter: ["class", "data-theme"]
        };
        mo.observe(document.documentElement, opts);
        if (document.body) mo.observe(document.body, opts);
        const mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
        if (mq && mq.addEventListener) mq.addEventListener("change", fire);
        return () => {
            mo.disconnect();
            if (mq && mq.removeEventListener) mq.removeEventListener("change", fire);
        };
    }

    function prefersReducedMotion() {
        return hasDOM && !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }



    function setupCanvas(canvas, opts = {}) {
        const {
            aspect = 16 / 9, minHeight = 180, maxHeight = 560
        } = opts;
        let draw = opts.draw;
        const ctx = canvas.getContext("2d");
        const handle = {
            canvas,
            ctx,
            width: 0,
            height: 0,
            dpr: 1
        };
        let lastKey = "",
            mqDpr = null;

        function measure() {
            const cssW = canvas.clientWidth || (canvas.parentElement && canvas.parentElement.clientWidth) || 600;
            const h = opts.height != null ? opts.height : Math.round(Math.min(maxHeight, Math.max(minHeight, cssW / aspect)));
            return {
                w: Math.max(1, Math.round(cssW)),
                h
            };
        }

        function resize(force) {
            const {
                w,
                h
            } = measure();
            const dpr = Math.max(1, window.devicePixelRatio || 1);
            const key = w + "x" + h + "@" + dpr;
            if (!force && key === lastKey) return false;
            lastKey = key;
            canvas.style.setProperty("height", h + "px", "important");
            canvas.width = Math.round(w * dpr);
            canvas.height = Math.round(h * dpr);
            handle.width = w;
            handle.height = h;
            handle.dpr = dpr;
            redraw();
            return true;
        }

        function redraw() {
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.setTransform(handle.dpr, 0, 0, handle.dpr, 0, 0);
            if (typeof draw === "function") {
                ctx.save();
                draw(ctx, handle.width, handle.height, handle);
                ctx.restore();
            }
        }

        function watchDpr() {
            if (!window.matchMedia) return;
            if (mqDpr) mqDpr.removeEventListener("change", onDpr);
            mqDpr = window.matchMedia("(resolution: " + (window.devicePixelRatio || 1) + "dppx)");
            mqDpr.addEventListener("change", onDpr);
        }

        function onDpr() {
            watchDpr();
            resize(true);
        }

        const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => resize(false)) : null;
        if (ro) {
            ro.observe(canvas);
            if (canvas.parentElement) ro.observe(canvas.parentElement);
        } else window.addEventListener("resize", () => resize(false));
        watchDpr();

        handle.redraw = redraw;
        handle.resize = () => resize(true);
        handle.setDraw = (fn) => {
            draw = fn;
            redraw();
        };
        handle.destroy = () => {
            if (ro) ro.disconnect();
            if (mqDpr) mqDpr.removeEventListener("change", onDpr);
        };
        resize(true);
        return handle;
    }



    function createLoop(step, opts = {}) {
        const maxDt = opts.maxDt || 0.1;
        let wanted = false,
            rafId = 0,
            last = null,
            elapsed = 0;

        function frame(now) {
            rafId = 0;
            if (!wanted || (hasDOM && document.hidden)) return;
            const dt = last == null ? 0 : Math.min(maxDt, Math.max(0, (now - last) / 1000));
            last = now;
            elapsed += dt;
            step(dt, elapsed, now);
            if (wanted && !rafId) rafId = requestAnimationFrame(frame);
        }

        function schedule() {
            if (!rafId && wanted && !(hasDOM && document.hidden)) {
                last = null;
                rafId = requestAnimationFrame(frame);
            }
        }

        function cancel() {
            if (rafId) cancelAnimationFrame(rafId);
            rafId = 0;
        }
        const notify = () => {
            if (opts.onChange) opts.onChange(wanted);
        };
        const onVis = () => {
            if (document.hidden) cancel();
            else schedule();
        };
        if (hasDOM) document.addEventListener("visibilitychange", onVis);
        const loop = {
            start() {
                if (wanted) return;
                wanted = true;
                schedule();
                notify();
            },
            stop() {
                if (!wanted) return;
                wanted = false;
                cancel();
                notify();
            },
            toggle() {
                if (wanted) loop.stop();
                else loop.start();
                return wanted;
            },
            isRunning: () => wanted,

            stepOnce(dt = 1 / 60) {
                elapsed += dt;
                step(dt, elapsed, hasDOM ? performance.now() : 0);
            },
            reset() {
                elapsed = 0;
                last = null;
            },
            elapsed: () => elapsed,
            destroy() {
                wanted = false;
                cancel();
                if (hasDOM) document.removeEventListener("visibilitychange", onVis);
            }
        };
        return loop;
    }



    function niceStep(range, n = 5) {
        if (!(range > 0) || !Number.isFinite(range)) return 1;
        const raw = range / Math.max(1, n);
        const mag = Math.pow(10, Math.floor(Math.log10(raw)));
        const r = raw / mag;
        return (r < 1.5 ? 1 : r < 3.5 ? 2 : r < 7.5 ? 5 : 10) * mag;
    }


    function niceTicks(min, max, n = 5) {
        if (min > max)[min, max] = [max, min];
        if (!(Number.isFinite(min) && Number.isFinite(max))) return Object.assign([], {
            step: NaN
        });
        if (min === max) return Object.assign([min], {
            step: 0
        });
        const step = niceStep(max - min, n);
        const out = [];
        const start = Math.ceil(min / step - 1e-9);
        for (let i = start; i * step <= max + step * 1e-9; i++) {
            const v = i * step;
            out.push(Math.abs(v) < step * 1e-9 ? 0 : Number(v.toPrecision(12)));
        }
        return Object.assign(out, {
            step
        });
    }


    function logTicks(min, max) {
        const out = [];
        if (!(min > 0 && max > min)) return out;
        const lo = Math.floor(Math.log10(min)),
            hi = Math.ceil(Math.log10(max));
        const sub = hi - lo <= 3 ? [1, 2, 5] : [1];
        for (let e = lo; e <= hi; e++)
            for (const s of sub) {
                const v = s * Math.pow(10, e);
                if (v >= min * (1 - 1e-9) && v <= max * (1 + 1e-9)) out.push(Number(v.toPrecision(12)));
            }
        return out;
    }


    function formatTick(v, step) {
        if (v === 0) return "0";
        const av = Math.abs(v);
        if (av >= 1e5 || av < 1e-3) {
            const s = v.toExponential(2).replace(/\.?0+e/, "e").replace("e+", "e");
            return s.replace("-", "−");
        }
        if (!(step > 0)) return String(Number(v.toPrecision(3))).replace("-", "−");
        const dec = Math.max(0, Math.min(6, -Math.floor(Math.log10(step) + 1e-9)));
        return v.toFixed(dec).replace("-", "−");
    }


    function seriesPoints(s) {
        if (s.data) return {
            n: s.data.length,
            x: (i) => s.data[i][0],
            y: (i) => s.data[i][1]
        };
        return {
            n: s.ys.length,
            x: (i) => s.xs[i],
            y: (i) => s.ys[i]
        };
    }


    function dataRange(series, which, log) {
        let lo = Infinity,
            hi = -Infinity;
        for (const s of series) {
            const p = seriesPoints(s);
            for (let i = 0; i < p.n; i++) {
                const v = which === "x" ? p.x(i) : p.y(i);
                if (!Number.isFinite(v) || (log && v <= 0)) continue;
                if (v < lo) lo = v;
                if (v > hi) hi = v;
            }
        }
        return lo <= hi ? [lo, hi] : [0, 1];
    }

    function axisLabel(a) {
        return (a.label || "") + (a.unit ? " (" + a.unit + ")" : "");
    }


    function plot(ctx, rect, opts) {
        const th = opts.theme || CANVAS_PALETTE;
        const fs = Math.max(11, opts.fontSize || 12);
        const series = opts.series || [];
        const ax = Object.assign({
                grid: true
            }, opts.x || {}),
            ay = Object.assign({
                grid: true
            }, opts.y || {});
        for (const [a, w] of [
                [ax, "x"],
                [ay, "y"]
            ]) {
            if (a.min == null || a.max == null) {
                const [lo, hi] = dataRange(series, w, a.log);
                if (a.log) {
                    if (a.min == null) a.min = lo;
                    if (a.max == null) a.max = hi;
                } else {
                    const pad = w === "y" ? (hi - lo || Math.abs(hi) || 1) * 0.05 : 0;
                    if (a.min == null) a.min = lo - pad;
                    if (a.max == null) a.max = hi + pad;
                }
            }
            if (a.max === a.min) {
                a.max += a.log ? a.max : 0.5;
                a.min -= a.log ? a.min / 2 : 0.5;
            }
        }
        const m = Object.assign({
            l: fs * 4.4,
            r: fs * 1.1,
            t: opts.title ? fs * 2.1 : fs * 0.9,
            b: fs * 3.4
        }, opts.margin || {});
        const P = {
            x: rect.x + m.l,
            y: rect.y + m.t,
            w: Math.max(10, rect.w - m.l - m.r),
            h: Math.max(10, rect.h - m.t - m.b)
        };
        const tx = (v) => ax.log ? Math.log10(v) : v,
            ty = (v) => ay.log ? Math.log10(v) : v;
        const x0 = tx(ax.min),
            x1 = tx(ax.max),
            y0 = ty(ay.min),
            y1 = ty(ay.max);
        const xToPx = (v) => P.x + (tx(v) - x0) / (x1 - x0) * P.w;
        const yToPx = (v) => P.y + P.h - (ty(v) - y0) / (y1 - y0) * P.h;
        const pxToX = (px) => {
            const t = x0 + (px - P.x) / P.w * (x1 - x0);
            return ax.log ? Math.pow(10, t) : t;
        };
        const pxToY = (py) => {
            const t = y0 + (P.y + P.h - py) / P.h * (y1 - y0);
            return ay.log ? Math.pow(10, t) : t;
        };
        const map = {
            plot: P,
            x: ax,
            y: ay,
            xToPx,
            yToPx,
            pxToX,
            pxToY,
            toPx: (x, y) => ({
                x: xToPx(x),
                y: yToPx(y)
            }),
            fromPx: (px, py) => ({
                x: pxToX(px),
                y: pxToY(py)
            }),
            contains: (px, py) => px >= P.x && px <= P.x + P.w && py >= P.y && py <= P.y + P.h
        };

        ctx.save();
        ctx.font = fs + "px " + (th.font || FONT_FAMILY);
        if (opts.background !== false) {
            ctx.fillStyle = th.panel || th.background;
            ctx.fillRect(P.x, P.y, P.w, P.h);
        }

        const xt = ax.ticks || (ax.log ? logTicks(ax.min, ax.max) : niceTicks(ax.min, ax.max, Math.max(2, Math.round(P.w / (fs * 7)))));
        const yt = ay.ticks || (ay.log ? logTicks(ay.min, ay.max) : niceTicks(ay.min, ay.max, Math.max(2, Math.round(P.h / (fs * 3.5)))));
        const fmtX = ax.format || ((v) => formatTick(v, xt.step));
        const fmtY = ay.format || ((v) => formatTick(v, yt.step));
        ctx.lineWidth = 1;
        ctx.textBaseline = "top";
        ctx.textAlign = "center";
        for (const v of xt) {
            const px = Math.round(xToPx(v)) + 0.5;
            if (px < P.x - 0.5 || px > P.x + P.w + 0.5) continue;
            if (ax.grid) {
                ctx.strokeStyle = th.grid;
                ctx.beginPath();
                ctx.moveTo(px, P.y);
                ctx.lineTo(px, P.y + P.h);
                ctx.stroke();
            }
            ctx.strokeStyle = th.axis;
            ctx.beginPath();
            ctx.moveTo(px, P.y + P.h);
            ctx.lineTo(px, P.y + P.h + 4);
            ctx.stroke();
            ctx.fillStyle = th.textMuted;
            ctx.fillText(fmtX(v), px, P.y + P.h + 6);
        }
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        for (const v of yt) {
            const py = Math.round(yToPx(v)) + 0.5;
            if (py < P.y - 0.5 || py > P.y + P.h + 0.5) continue;
            if (ay.grid) {
                ctx.strokeStyle = th.grid;
                ctx.beginPath();
                ctx.moveTo(P.x, py);
                ctx.lineTo(P.x + P.w, py);
                ctx.stroke();
            }
            ctx.strokeStyle = th.axis;
            ctx.beginPath();
            ctx.moveTo(P.x - 4, py);
            ctx.lineTo(P.x, py);
            ctx.stroke();
            ctx.fillStyle = th.textMuted;
            ctx.fillText(fmtY(v), P.x - 6, py);
        }

        ctx.strokeStyle = th.axis;
        ctx.strokeRect(P.x + 0.5, P.y + 0.5, P.w - 1, P.h - 1);

        ctx.fillStyle = th.text;
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        if (ax.label || ax.unit) ctx.fillText(axisLabel(ax), P.x + P.w / 2, rect.y + rect.h - 2);
        if (ay.label || ay.unit) {
            ctx.save();
            ctx.translate(rect.x + fs * 0.2, P.y + P.h / 2);
            ctx.rotate(-Math.PI / 2);
            ctx.textBaseline = "top";
            ctx.fillText(axisLabel(ay), 0, 0);
            ctx.restore();
        }
        if (opts.title) {
            ctx.textAlign = "left";
            ctx.textBaseline = "top";
            ctx.font = "600 " + (fs + 1) + "px " + (th.font || FONT_FAMILY);
            ctx.fillText(opts.title, P.x, rect.y + fs * 0.35);
            ctx.font = fs + "px " + (th.font || FONT_FAMILY);
        }

        ctx.save();
        ctx.beginPath();
        ctx.rect(P.x, P.y, P.w, P.h);
        ctx.clip();
        for (const h of opts.hlines || []) {
            const py = yToPx(h.y);
            ctx.strokeStyle = h.color || th.gridStrong;
            ctx.setLineDash(h.dash || [4, 4]);
            ctx.beginPath();
            ctx.moveTo(P.x, py);
            ctx.lineTo(P.x + P.w, py);
            ctx.stroke();
        }
        series.forEach((s, si) => {
            const p = seriesPoints(s);
            const color = s.color || th.series[si % th.series.length];
            ctx.strokeStyle = color;
            ctx.lineWidth = s.width || 2;
            ctx.lineJoin = "round";
            ctx.setLineDash(s.dash || []);
            ctx.beginPath();
            let pen = false,
                firstX = null,
                lastX = null;
            for (let i = 0; i < p.n; i++) {
                const xv = p.x(i),
                    yv = p.y(i);
                if (!Number.isFinite(xv) || !Number.isFinite(yv) || (ax.log && xv <= 0) || (ay.log && yv <= 0)) {
                    pen = false;
                    continue;
                }
                const px = xToPx(xv),
                    py = yToPx(yv);
                if (pen) ctx.lineTo(px, py);
                else {
                    ctx.moveTo(px, py);
                    if (firstX == null) firstX = px;
                }
                lastX = px;
                pen = true;
            }
            if (s.fill && firstX != null) {
                ctx.save();
                ctx.lineTo(lastX, P.y + P.h);
                ctx.lineTo(firstX, P.y + P.h);
                ctx.closePath();
                ctx.globalAlpha = 0.18;
                ctx.fillStyle = s.fill === true ? color : s.fill;
                ctx.fill();
                ctx.restore();

                ctx.beginPath();
                pen = false;
                for (let i = 0; i < p.n; i++) {
                    const xv = p.x(i),
                        yv = p.y(i);
                    if (!Number.isFinite(xv) || !Number.isFinite(yv)) {
                        pen = false;
                        continue;
                    }
                    if (pen) ctx.lineTo(xToPx(xv), yToPx(yv));
                    else ctx.moveTo(xToPx(xv), yToPx(yv));
                    pen = true;
                }
            }
            if (!s.pointsOnly) ctx.stroke();
            if (s.points || s.pointsOnly) {
                ctx.fillStyle = color;
                ctx.setLineDash([]);
                for (let i = 0; i < p.n; i++) {
                    const xv = p.x(i),
                        yv = p.y(i);
                    if (!Number.isFinite(xv) || !Number.isFinite(yv)) continue;
                    ctx.beginPath();
                    ctx.arc(xToPx(xv), yToPx(yv), s.pointRadius || 2.5, 0, 2 * Math.PI);
                    ctx.fill();
                }
            }
        });
        ctx.setLineDash([]);
        ctx.restore();

        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        let labelRow = 0;
        for (const mk of opts.markers || []) {
            const px = xToPx(mk.x);
            if (!(px >= P.x && px <= P.x + P.w)) continue;
            ctx.strokeStyle = mk.color || th.marker;
            ctx.lineWidth = 1.25;
            ctx.setLineDash(mk.dash || [5, 4]);
            ctx.beginPath();
            ctx.moveTo(px, P.y);
            ctx.lineTo(px, P.y + P.h);
            ctx.stroke();
            ctx.setLineDash([]);
            if (mk.label) {
                ctx.fillStyle = mk.color || th.marker;
                const tw = ctx.measureText(mk.label).width;
                const lx = px + 4 + tw > P.x + P.w ? px - 4 - tw : px + 4;
                ctx.fillText(mk.label, lx, P.y + 4 + (labelRow++ % 3) * (fs + 3));
            }
        }

        if (opts.cursor && Number.isFinite(opts.cursor.x)) {
            const px = xToPx(opts.cursor.x);
            if (px >= P.x && px <= P.x + P.w) {
                ctx.strokeStyle = opts.cursor.color || th.cursor;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(px + 0.5, P.y);
                ctx.lineTo(px + 0.5, P.y + P.h);
                ctx.stroke();
                if (opts.cursor.label) {
                    ctx.font = fs + "px " + (th.mono || MONO_FAMILY);
                    const tw = ctx.measureText(opts.cursor.label).width;
                    const lx = Math.min(P.x + P.w - tw - 8, Math.max(P.x + 2, px + 6));
                    const ly = P.y + P.h - fs - 10;
                    ctx.fillStyle = "rgba(7, 7, 13, 0.85)";
                    ctx.fillRect(lx - 3, ly - 2, tw + 6, fs + 6);
                    ctx.fillStyle = opts.cursor.color || th.cursor;
                    ctx.fillText(opts.cursor.label, lx, ly + 1);
                    ctx.font = fs + "px " + (th.font || FONT_FAMILY);
                }
            }
        }

        const labelled = series.map((s, i) => ({
            s,
            i
        })).filter((o) => o.s.label);
        if (opts.legend !== false && opts.legend !== "outside" && labelled.length) {
            const rowH = fs + 6,
                sw = 22;
            const w = Math.max(...labelled.map((o) => ctx.measureText(o.s.label).width)) + sw + 18;
            const h = labelled.length * rowH + 6;
            const lx = opts.legendPosition === "left" ? P.x + 6 : P.x + P.w - w - 6,
                ly = P.y + 6;
            ctx.fillStyle = "rgba(7, 7, 13, 0.82)";
            ctx.fillRect(lx, ly, w, h);
            ctx.strokeStyle = th.grid;
            ctx.strokeRect(lx + 0.5, ly + 0.5, w - 1, h - 1);
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            labelled.forEach(({
                s,
                i
            }, r) => {
                const yy = ly + 3 + rowH * r + rowH / 2;
                ctx.strokeStyle = s.color || th.series[i % th.series.length];
                ctx.lineWidth = s.width || 2;
                ctx.setLineDash(s.dash || []);
                ctx.beginPath();
                ctx.moveTo(lx + 6, yy);
                ctx.lineTo(lx + 6 + sw, yy);
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.fillStyle = th.text;
                ctx.fillText(s.label, lx + sw + 12, yy);
            });
        }
        ctx.restore();
        return map;
    }


    function interpAt(xs, ys, x) {
        const n = xs.length;
        if (!n || x < xs[0] || x > xs[n - 1]) return NaN;
        let lo = 0,
            hi = n - 1;
        while (hi - lo > 1) {
            const mid = (lo + hi) >> 1;
            if (xs[mid] <= x) lo = mid;
            else hi = mid;
        }
        const t = xs[hi] === xs[lo] ? 0 : (x - xs[lo]) / (xs[hi] - xs[lo]);
        return ys[lo] + t * (ys[hi] - ys[lo]);
    }


    const CMAP_STOPS = {

        viridis: ["#440154", "#482475", "#414487", "#355f8d", "#2a788e", "#21918c", "#22a884", "#44bf70", "#7ad151", "#bddf26", "#fde725"],
        inferno: ["#000004", "#160b39", "#420a68", "#6a176e", "#932667", "#bc3754", "#dd513a", "#f37819", "#fca50a", "#f6d746", "#fcffa4"],

        diverging: ["#053061", "#2166ac", "#4393c3", "#92c5de", "#d1e5f0", "#f7f7f7", "#fddbc7", "#f4a582", "#d6604d", "#b2182b", "#67001f"],

        twilight: ["#e2d9e2", "#a8bfd3", "#6d8fc5", "#5a5fb3", "#4a2f84", "#2f1436", "#5c1f4d", "#8f3a4d", "#b8684e", "#d2a384", "#e2d9e2"],

        hsv: ["#ff0000", "#ffff00", "#00ff00", "#00ffff", "#0000ff", "#ff00ff", "#ff0000"],
        gray: ["#000000", "#ffffff"]
    };
    CMAP_STOPS.bwr = CMAP_STOPS.diverging;
    CMAP_STOPS.phase = CMAP_STOPS.twilight;
    const CMAP_KIND = {
        viridis: "sequential",
        inferno: "sequential",
        gray: "sequential",
        diverging: "diverging",
        bwr: "diverging",
        twilight: "cyclic",
        phase: "cyclic",
        hsv: "cyclic"
    };

    const hexToRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    const cmapCache = {};


    function colormap(name = "viridis") {
        if (typeof name === "object" && name.lut) return name;
        if (cmapCache[name]) return cmapCache[name];
        const stops = CMAP_STOPS[name];
        if (!stops) throw new RangeError("unknown colormap " + name);
        const rgbStops = stops.map(hexToRgb);
        const lut = new Uint8ClampedArray(256 * 3);
        for (let i = 0; i < 256; i++) {
            const t = i / 255 * (rgbStops.length - 1);
            const k = Math.min(rgbStops.length - 2, Math.floor(t)),
                f = t - k;
            for (let c = 0; c < 3; c++) lut[i * 3 + c] = Math.round(rgbStops[k][c] + f * (rgbStops[k + 1][c] - rgbStops[k][c]));
        }
        const kind = CMAP_KIND[name] || "sequential";
        const idx = (t) => {
            if (!Number.isFinite(t)) return 0;
            if (kind === "cyclic") t -= Math.floor(t);
            return Math.max(0, Math.min(255, Math.round(t * 255)));
        };
        const cm = {
            name,
            kind,
            lut,
            index: idx,
            rgb: (t) => {
                const i = idx(t) * 3;
                return [lut[i], lut[i + 1], lut[i + 2]];
            },
            css: (t) => {
                const i = idx(t) * 3;
                return "rgb(" + lut[i] + "," + lut[i + 1] + "," + lut[i + 2] + ")";
            }
        };
        cmapCache[name] = cm;
        return cm;
    }
    const colormapNames = Object.keys(CMAP_STOPS);


    function makeNorm(opts, dataMin, dataMax) {
        const log = !!opts.log;
        let max = opts.max != null ? opts.max : dataMax;
        let min = opts.min != null ? opts.min : log ? (opts.floor != null ? opts.floor : max * 1e-4) : dataMin;
        if (log) {
            if (!(max > 0)) max = 1;
            if (!(min > 0)) min = max * 1e-4;
            const lmin = Math.log10(min),
                span = Math.log10(max) - lmin || 1;
            return {
                min,
                max,
                log,
                t: (v) => (v > 0 ? (Math.log10(v) - lmin) / span : 0)
            };
        }
        const span = max - min || 1;
        return {
            min,
            max,
            log,
            t: (v) => (v - min) / span
        };
    }


    function imageFromArray(ctx, data, nx, ny, rect, cmap = "viridis", opts = {}) {
        const cm = colormap(cmap);
        let dmin = Infinity,
            dmax = -Infinity;
        if (opts.min == null || opts.max == null) {
            for (let i = 0; i < data.length; i++) {
                const v = data[i];
                if (Number.isFinite(v)) {
                    if (v < dmin) dmin = v;
                    if (v > dmax) dmax = v;
                }
            }
        }
        const norm = makeNorm(opts, dmin, dmax);
        const off = document.createElement("canvas");
        off.width = nx;
        off.height = ny;
        const octx = off.getContext("2d");
        const img = octx.createImageData(nx, ny);
        const px = img.data,
            lut = cm.lut;
        const upper = opts.origin === "upper";
        for (let iy = 0; iy < ny; iy++) {
            const row = upper ? iy : ny - 1 - iy;
            for (let ix = 0; ix < nx; ix++) {
                const v = data[iy * nx + ix];
                const o = (row * nx + ix) * 4;
                if (!Number.isFinite(v)) {
                    px[o + 3] = 0;
                    continue;
                }
                const li = cm.index(norm.t(v)) * 3;
                px[o] = lut[li];
                px[o + 1] = lut[li + 1];
                px[o + 2] = lut[li + 2];
                px[o + 3] = opts.alpha ? Math.round(255 * opts.alpha(ix, iy, v)) : 255;
            }
        }
        octx.putImageData(img, 0, 0);
        ctx.save();
        ctx.imageSmoothingEnabled = !!opts.smooth;
        ctx.drawImage(off, rect.x, rect.y, rect.w, rect.h);
        ctx.restore();
        return {
            min: norm.min,
            max: norm.max,
            log: norm.log
        };
    }


    function drawColorbar(ctx, rect, cmap, opts = {}) {
        const cm = colormap(cmap),
            th = opts.theme || CANVAS_PALETTE;
        const fs = Math.max(11, opts.fontSize || 11);
        const vertical = opts.orientation !== "horizontal";
        const norm = makeNorm(opts, opts.min, opts.max);
        const n = 128;
        for (let i = 0; i < n; i++) {
            ctx.fillStyle = cm.css(i / (n - 1));
            if (vertical) {
                const y0 = rect.y + rect.h - (i + 1) * rect.h / n;
                ctx.fillRect(rect.x, y0, rect.w, rect.h / n + 0.6);
            } else {
                ctx.fillRect(rect.x + i * rect.w / n, rect.y, rect.w / n + 0.6, rect.h);
            }
        }
        ctx.strokeStyle = th.axis;
        ctx.lineWidth = 1;
        ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);
        const ticks = opts.ticks || (norm.log ? logTicks(norm.min, norm.max) : niceTicks(norm.min, norm.max, vertical ? Math.max(2, Math.round(rect.h / 40)) : 4));
        const fmt = opts.format || ((v) => formatTick(v, ticks.step));
        ctx.font = fs + "px " + (th.font || FONT_FAMILY);
        ctx.fillStyle = th.textMuted;
        for (const v of ticks) {
            const t = norm.t(v);
            if (t < -1e-9 || t > 1 + 1e-9) continue;
            if (vertical) {
                const y = rect.y + rect.h - t * rect.h;
                ctx.strokeStyle = th.axis;
                ctx.beginPath();
                ctx.moveTo(rect.x + rect.w, y);
                ctx.lineTo(rect.x + rect.w + 4, y);
                ctx.stroke();
                ctx.textAlign = "left";
                ctx.textBaseline = "middle";
                ctx.fillText(fmt(v), rect.x + rect.w + 6, y);
            } else {
                const x = rect.x + t * rect.w;
                ctx.strokeStyle = th.axis;
                ctx.beginPath();
                ctx.moveTo(x, rect.y + rect.h);
                ctx.lineTo(x, rect.y + rect.h + 4);
                ctx.stroke();
                ctx.textAlign = "center";
                ctx.textBaseline = "top";
                ctx.fillText(fmt(v), x, rect.y + rect.h + 5);
            }
        }
        if (opts.label || opts.unit) {
            ctx.fillStyle = th.text;
            const text = axisLabel(opts);
            if (vertical) {
                ctx.save();
                ctx.translate(rect.x - 4, rect.y + rect.h / 2);
                ctx.rotate(-Math.PI / 2);
                ctx.textAlign = "center";
                ctx.textBaseline = "bottom";
                ctx.fillText(text, 0, 0);
                ctx.restore();
            } else {
                ctx.textAlign = "left";
                ctx.textBaseline = "bottom";
                ctx.fillText(text, rect.x, rect.y - 3);
            }
        }
    }


    function wavelengthToRGB(nm, gamma = 0.8) {
        let r = 0,
            g = 0,
            b = 0;
        if (nm >= 380 && nm < 440) {
            r = -(nm - 440) / 60;
            b = 1;
        } else if (nm >= 440 && nm < 490) {
            g = (nm - 440) / 50;
            b = 1;
        } else if (nm >= 490 && nm < 510) {
            g = 1;
            b = -(nm - 510) / 20;
        } else if (nm >= 510 && nm < 580) {
            r = (nm - 510) / 70;
            g = 1;
        } else if (nm >= 580 && nm < 645) {
            r = 1;
            g = -(nm - 645) / 65;
        } else if (nm >= 645 && nm <= 780) {
            r = 1;
        }
        let f = 0;
        if (nm >= 380 && nm < 420) f = 0.3 + 0.7 * (nm - 380) / 40;
        else if (nm >= 420 && nm <= 700) f = 1;
        else if (nm > 700 && nm <= 780) f = 0.3 + 0.7 * (780 - nm) / 80;
        const conv = (c) => (c === 0 ? 0 : Math.round(255 * Math.pow(c * f, gamma)));
        return [conv(r), conv(g), conv(b)];
    }

    function wavelengthToCSS(nm, alpha = 1) {
        const [r, g, b] = wavelengthToRGB(nm);
        return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
    }


    function labelFor(input) {
        if (input.getAttribute("aria-label")) return input.getAttribute("aria-label");
        if (input.id) {
            const l = document.querySelector('label[for="' + input.id + '"]');
            if (l) return l.textContent.trim();
        }
        const group = input.closest(".control-group, .option-card, label");
        if (group) {
            const lab = group.querySelector(".control-label span, .control-label, label, h3");
            if (lab && lab !== input) return lab.textContent.trim().replace(/\s+/g, " ");
        }
        return input.name || input.id || "value";
    }

    const nativeValue = hasDOM ? Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value") : null;


    function enhanceSlider(range, opts = {}) {
        if (range.__opticsNum) return range.__opticsNum;
        const format = opts.format || ((v) => v);

        const displayNum = (v) => String(Number(opts.format ? v.toPrecision(6) : v.toFixed(decimals)));
        const parse = opts.parse || ((v) => v);
        const label = opts.label || labelFor(range);
        if (!range.getAttribute("aria-label")) range.setAttribute("aria-label", label);
        const wrap = document.createElement("span");
        wrap.className = "optics-num-wrap";
        const input = document.createElement("input");
        input.type = "number";
        input.className = "optics-num-input";
        input.inputMode = "decimal";
        input.setAttribute("aria-label", label + (opts.unit ? " (" + opts.unit + ")" : ""));
        const lo = Number(range.min || 0),
            hi = Number(range.max || 100);
        const step = range.step === "any" ? NaN : Number(range.step || 1);
        const dlo = format(lo),
            dhi = format(hi);
        input.min = String(Math.min(dlo, dhi));
        input.max = String(Math.max(dlo, dhi));
        input.step = opts.format ? "any" : (Number.isFinite(step) ? String(step) : "any");
        wrap.appendChild(input);
        if (opts.unit) {
            const u = document.createElement("span");
            u.className = "optics-num-unit";
            u.setAttribute("aria-hidden", "true");
            u.textContent = opts.unit;
            wrap.appendChild(u);
        }
        if (opts.container) opts.container.appendChild(wrap);
        else range.insertAdjacentElement("afterend", wrap);

        const decimals = Number.isFinite(step) && step > 0 ? Math.max(0, -Math.floor(Math.log10(step) + 1e-9)) : 6;

        function sync() {
            const v = format(Number(nativeValue.get.call(range)));
            if (document.activeElement !== input) input.value = displayNum(Number(v));
            input.removeAttribute("aria-invalid");
        }

        function commit() {
            const raw = input.value.trim();
            const num = Number(raw);
            if (raw === "" || !Number.isFinite(num)) {
                input.setAttribute("aria-invalid", "true");
                setTimeout(() => {
                    input.removeAttribute("aria-invalid");
                    sync();
                }, 900);
                return;
            }
            let v = Math.min(hi, Math.max(lo, parse(num)));
            if (Number.isFinite(step) && step > 0) v = Math.min(hi, lo + Math.round((v - lo) / step) * step);
            nativeValue.set.call(range, String(Number(v.toFixed(Math.min(12, decimals + 2)))));
            range.dispatchEvent(new Event("input", {
                bubbles: true
            }));
            range.dispatchEvent(new Event("change", {
                bubbles: true
            }));
            input.value = displayNum(Number(format(Number(range.value))));
        }
        input.addEventListener("change", commit);
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                commit();
            }
        });
        input.addEventListener("blur", sync);
        range.addEventListener("input", sync);
        range.addEventListener("change", sync);

        try {
            Object.defineProperty(range, "value", {
                configurable: true,
                get() {
                    return nativeValue.get.call(this);
                },
                set(v) {
                    nativeValue.set.call(this, v);
                    sync();
                }
            });
        } catch (e) {

        }
        sync();
        const handle = {
            input,
            sync,
            destroy() {
                delete range.value;
                wrap.remove();
                delete range.__opticsNum;
            }
        };
        range.__opticsNum = handle;
        return handle;
    }


    function enhanceAllSliders(root = document, optsById = {}) {
        return Array.from(root.querySelectorAll('input[type="range"]:not([data-no-number])'))
            .map((r) => enhanceSlider(r, optsById[r.id] || {}));
    }


    function bindControls(map, onChange) {
        const els = {};
        for (const [k, v] of Object.entries(map)) {
            els[k] = typeof v === "string" ? (v.startsWith("radio:") ? document.querySelectorAll('input[name="' + v.slice(6) + '"]') : document.querySelector(v)) : v;
        }
        const read = (el) => {
            if (el instanceof NodeList || Array.isArray(el)) {
                const c = Array.from(el).find((r) => r.checked);
                return c ? c.value : null;
            }
            if (el.type === "checkbox") return el.checked;
            if (el.type === "range" || el.type === "number") return Number(el.value);
            return el.value;
        };
        const write = (el, v) => {
            if (el instanceof NodeList || Array.isArray(el)) {
                Array.from(el).forEach((r) => {
                    r.checked = String(r.value) === String(v);
                });
                const c = Array.from(el).find((r) => r.checked);
                if (c) c.dispatchEvent(new Event("change", {
                    bubbles: true
                }));
                return;
            }
            if (el.type === "checkbox") el.checked = !!v;
            else el.value = String(v);
            el.dispatchEvent(new Event("input", {
                bubbles: true
            }));
            el.dispatchEvent(new Event("change", {
                bubbles: true
            }));
        };
        if (onChange) {
            for (const el of Object.values(els)) {
                const list = el instanceof NodeList || Array.isArray(el) ? Array.from(el) : [el];
                list.forEach((e) => e.addEventListener(e.type === "checkbox" || e.type === "radio" || e.tagName === "SELECT" ? "change" : "input", () => onChange(api.get())));
            }
        }
        const api = {
            elements: els,
            get() {
                const o = {};
                for (const k in els)
                    if (els[k]) o[k] = read(els[k]);
                return o;
            },
            set(obj) {
                for (const k in obj)
                    if (els[k] && obj[k] != null) write(els[k], obj[k]);
            }
        };
        return api;
    }



    function encodeState(obj) {
        const parts = [];
        for (const [k, v] of Object.entries(obj)) {
            if (v === undefined || v === null) continue;
            let s;
            if (typeof v === "number") s = Number.isFinite(v) ? String(Number(v.toPrecision(10))) : "";
            else if (typeof v === "boolean") s = v ? "1" : "0";
            else if (typeof v === "object") s = JSON.stringify(v);
            else s = String(v);
            parts.push(encodeURIComponent(k) + "=" + encodeURIComponent(s));
        }
        return parts.join("&");
    }


    function decodeState(str, template) {
        const out = {};
        const s = String(str || "").replace(/^[#?]/, "");
        if (!s) return out;
        for (const part of s.split("&")) {
            const eq = part.indexOf("=");
            if (eq < 0) continue;
            let k, raw;
            try {
                k = decodeURIComponent(part.slice(0, eq));
                raw = decodeURIComponent(part.slice(eq + 1));
            } catch (e) {
                continue;
            }
            if (!(k in template)) continue;
            const t = template[k];
            if (typeof t === "number") {
                const n = Number(raw);
                if (raw !== "" && Number.isFinite(n)) out[k] = n;
            } else if (typeof t === "boolean") out[k] = raw === "1" || raw === "true";
            else if (t !== null && typeof t === "object") {
                try {
                    out[k] = JSON.parse(raw);
                } catch (e) {

                }
            } else out[k] = raw;
        }
        return out;
    }


    function urlState(cfg) {
        const mode = cfg.mode || "query";
        const delay = cfg.debounce == null ? 300 : cfg.debounce;
        const keys = () => Object.keys(cfg.get());
        let timer = 0;

        function currentParams() {
            return new URLSearchParams(mode === "hash" ? location.hash.slice(1) : location.search.slice(1));
        }

        function buildURL() {
            const own = encodeState(cfg.get());
            const params = currentParams();
            for (const k of keys()) params.delete(k);
            const rest = params.toString();
            const qs = [rest, own].filter(Boolean).join("&");
            const u = new URL(location.href);
            if (mode === "hash") u.hash = qs ? "#" + qs : "";
            else u.search = qs ? "?" + qs : "";
            return u.toString();
        }

        function flush() {
            clearTimeout(timer);
            timer = 0;
            try {
                history.replaceState(history.state, "", buildURL());
            } catch (e) {

            }
        }

        function load() {
            const raw = mode === "hash" ? location.hash : location.search;
            const decoded = decodeState(raw, cfg.get());
            return Object.keys(decoded).length ? decoded : null;
        }
        const api = {
            update() {
                clearTimeout(timer);
                timer = setTimeout(flush, delay);
            },
            flush,
            url: buildURL,
            load,
            clear() {
                const params = currentParams();
                for (const k of keys()) params.delete(k);
                const u = new URL(location.href);
                const qs = params.toString();
                if (mode === "hash") u.hash = qs ? "#" + qs : "";
                else u.search = qs ? "?" + qs : "";
                history.replaceState(history.state, "", u.toString());
            }
        };


        api.ready = new Promise((resolve) => {
            queueMicrotask(() => {
                let s = null;
                if (cfg.restore !== false) {
                    s = load();
                    if (s) cfg.set(s);
                }
                resolve(s);
            });
        });
        return api;
    }

    function download(name, blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1500);
    }

    const withExt = (name, ext) => (name.toLowerCase().endsWith("." + ext) ? name : name + "." + ext);

    function exportJSON(name, obj) {
        download(withExt(name, "json"), new Blob([JSON.stringify(obj, null, 2) + "\n"], {
            type: "application/json"
        }));
    }


    function csvString(headers, rows) {
        const cell = (v) => {
            if (v === null || v === undefined) return "";
            const s = typeof v === "number" ? (Number.isFinite(v) ? String(v) : "") : String(v);
            return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
        };
        const lines = [];
        if (headers && headers.length) lines.push(headers.map(cell).join(","));
        for (const r of rows) lines.push(Array.from(r, cell).join(","));
        return lines.join("\r\n") + "\r\n";
    }

    function exportCSV(name, headers, rows) {
        download(withExt(name, "csv"), new Blob([csvString(headers, rows)], {
            type: "text/csv"
        }));
    }

    /**
     * Save a canvas as PNG, composited onto the dark canvas background (canvas pixels are
     * transparent where nothing was drawn) with an optional caption strip for a labelled figure.
     * opts: { caption, background }
     */
    function exportPNG(name, canvas, opts = {}) {
        const dpr = canvas.width / (canvas.clientWidth || canvas.width) || 1;
        const capH = opts.caption ? Math.round(28 * dpr) : 0;
        const out = document.createElement("canvas");
        out.width = canvas.width;
        out.height = canvas.height + capH;
        const c = out.getContext("2d");
        c.fillStyle = opts.background || CANVAS_PALETTE.background;
        c.fillRect(0, 0, out.width, out.height);
        c.drawImage(canvas, 0, 0);
        if (opts.caption) {
            c.fillStyle = CANVAS_PALETTE.textMuted;
            c.font = Math.round(12 * dpr) + "px " + FONT_FAMILY;
            c.textBaseline = "middle";
            c.fillText(opts.caption, 10 * dpr, canvas.height + capH / 2);
        }
        out.toBlob((blob) => {
            if (blob) download(withExt(name, "png"), blob);
        }, "image/png");
    }

    async function copyText(text) {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
                return true;
            }
        } catch (e) {
            /* fall through */
        }
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        let ok = false;
        try {
            ok = document.execCommand("copy");
        } catch (e) {
            ok = false;
        }
        ta.remove();
        return ok;
    }

    /**
     * Render a small export toolbar into container. Buttons appear only for what is provided.
     * opts: { name = "optics", url: urlState handle (for Share link) | true (use current URL),
     *   getState: () => obj (JSON), getCSV: () => ({headers, rows}), canvas | canvases: [..] (PNG),
     *   caption: string | () => string (PNG caption) }
     * Returns the toolbar element. Status messages go to a polite live region.
     */
    function addExportBar(container, opts = {}) {
        const name = opts.name || (document.title || "optics").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        const bar = document.createElement("div");
        bar.className = "optics-export-bar";
        bar.setAttribute("role", "toolbar");
        bar.setAttribute("aria-label", "Share and export");
        const status = document.createElement("span");
        status.className = "optics-export-status";
        status.setAttribute("role", "status");
        status.setAttribute("aria-live", "polite");
        const say = (t) => {
            status.textContent = t;
            clearTimeout(say.t);
            say.t = setTimeout(() => {
                status.textContent = "";
            }, 3000);
        };
        const btn = (label, title, fn) => {
            const b = document.createElement("button");
            b.type = "button";
            b.className = "optics-export-btn";
            b.textContent = label;
            b.title = title;
            b.addEventListener("click", fn);
            bar.appendChild(b);
            return b;
        };
        const caption = () => (typeof opts.caption === "function" ? opts.caption() : opts.caption);
        if (opts.url) {
            btn("Copy link", "Copy a link that reproduces the current settings", async () => {
                const u = opts.url === true ? location.href : (opts.url.flush(), opts.url.url());
                say((await copyText(u)) ? "Link copied" : "Copy failed: " + u);
            });
        }
        if (opts.getState) btn("JSON", "Download the current configuration as JSON", () => {
            exportJSON(name, opts.getState());
            say("JSON saved");
        });
        if (opts.getCSV) btn("CSV", "Download the plotted measurements as CSV", () => {
            const d = opts.getCSV();
            exportCSV(name, d.headers, d.rows);
            say("CSV saved");
        });
        const canvases = opts.canvases || (opts.canvas ? [opts.canvas] : []);
        canvases.forEach((cv, i) => {
            const lab = canvases.length > 1 ? "PNG " + (cv.dataset.exportName || i + 1) : "PNG";
            btn(lab, "Download the figure as PNG", () => {
                exportPNG(name + (canvases.length > 1 ? "-" + (cv.dataset.exportName || i + 1) : ""), cv, {
                    caption: caption()
                });
                say("PNG saved");
            });
        });
        bar.appendChild(status);
        container.appendChild(bar);
        return bar;
    }

    // =================================================================== accessibility
    let srCounter = 0;
    /**
     * Give a canvas role="img" + aria-label and a visually hidden text summary (aria-describedby)
     * that is also a polite live region. update(text) is debounced (600 ms) so slider drags do not
     * flood screen readers. Returns { update(summary, label?), element }.
     */
    function describeCanvas(canvas, text, opts = {}) {
        if (canvas.__opticsDesc) {
            canvas.__opticsDesc.update(text, opts.label);
            return canvas.__opticsDesc;
        }
        canvas.setAttribute("role", "img");
        if (opts.label || !canvas.getAttribute("aria-label")) canvas.setAttribute("aria-label", opts.label || text);
        const el = document.createElement("p");
        el.className = "sr-only optics-canvas-summary";
        el.id = canvas.id ? canvas.id + "-summary" : "optics-canvas-summary-" + (++srCounter);
        el.setAttribute("aria-live", opts.live === false ? "off" : "polite");
        el.textContent = text;
        canvas.insertAdjacentElement("afterend", el);
        canvas.setAttribute("aria-describedby", el.id);
        // Throttle (not debounce): continuous animation updates still land every 600 ms.
        let t = 0;
        let pending = text;
        const handle = {
            element: el,
            update(summary, label) {
                if (label) canvas.setAttribute("aria-label", label);
                pending = summary;
                if (t) return;
                t = setTimeout(() => {
                    t = 0;
                    if (el.textContent !== pending) el.textContent = pending;
                }, 600);
            }
        };
        canvas.__opticsDesc = handle;
        return handle;
    }

    /** core.formatSI when core.js is loaded (load it first), else a plain fallback. */
    function formatSI(v, unit = "", digits = 3) {
        const core = typeof self !== "undefined" && self.OpticsModels && self.OpticsModels.core;
        if (core) return core.formatSI(v, unit, digits);
        return Number.isFinite(v) ? Number(v.toPrecision(digits)) + (unit ? " " + unit : "") : "—";
    }

    return {
        // theme
        CANVAS_PALETTE,
        palette,
        onThemeChange,
        isDarkTheme,
        prefersReducedMotion,
        // canvas + loop
        setupCanvas,
        createLoop,
        // plotting
        plot,
        niceTicks,
        niceStep,
        logTicks,
        formatTick,
        interpAt,
        dataRange,
        colormap,
        colormapNames,
        makeNorm,
        imageFromArray,
        drawColorbar,
        wavelengthToRGB,
        wavelengthToCSS,
        // controls + state
        enhanceSlider,
        enhanceAllSliders,
        bindControls,
        encodeState,
        decodeState,
        urlState,
        exportJSON,
        exportCSV,
        exportPNG,
        csvString,
        addExportBar,
        copyText,
        // a11y
        describeCanvas,
        formatSI
    };
});