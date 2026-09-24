"use strict";


(function() {
    const model = window.OpticsModels.interference;
    const UI = window.OpticsUI;
    const PAL = UI.palette().canvas;
    const DEG = Math.PI / 180;

    const LAMBDA1 = 1;
    const C = 1;
    const A1 = 1;
    const I1_UNIT = model.singleIntensity(A1);
    const FIXED_FIELD = 3.2;
    const FIXED_INTENSITY = 9.4;


    const COLORS = {
        wave1: PAL.series[6],
        wave2: PAL.series[4],
        resultant: PAL.series[5],
        perp: PAL.series[2],
        cycle: PAL.series[5],
        detector: PAL.series[0],
        probe: PAL.marker,
        analyser: PAL.series[1],
    };

    const $ = (id) => document.getElementById(id);


    const DEFAULTS = {
        ph: 0,
        a2: 1,
        lr: 1,
        g: 1,
        ga: 0,
        th: 0,
        an: false,
        al: 45,
        xp: 1,
        T: 0,
        s1: true,
        s2: true,
        auto: true,
        sp: 1,
    };
    const PHYSICS_DEFAULTS = {
        ph: 0,
        a2: 1,
        lr: 1,
        g: 1,
        ga: 0,
        th: 0,
        an: false,
        al: 45,
        T: 0
    };
    const PRESETS = {
        constructive: {
            v: {},
            note: "Expected: steady I = 4 I₁ (twice I₁ + I₂) and V = 1. The two field traces coincide.",
        },
        destructive: {
            v: {
                ph: 180
            },
            note: "Expected: I = 0 at every x and t. E₁ and E₂ cancel everywhere.",
        },
        quadrature: {
            v: {
                ph: 90
            },
            note: "Expected: I = 2 I₁ = I₁ + I₂. At Δφ = 90° the cross term is zero.",
        },
        unequal: {
            v: {
                ph: 180,
                a2: 0.5
            },
            note: "Expected: the minimum stays at (A₁ − A₂)²/2 = 0.25 I₁ and V = 0.8.",
        },
        partial: {
            v: {
                lr: 1.1,
                g: 0.5
            },
            note: "Press Start. Expected: the beat swings only between 1 and 3 I₁, so V = |γ₁₂| = 0.5.",
        },
        gammaPhase: {
            v: {
                ga: 90
            },
            note: "Expected: the reading drops from 4 I₁ to 2 I₁ because the maximum moved to φ₂ − φ₁ = −90°. Set φ = 270° to get 4 I₁ back.",
        },
        orthogonal: {
            v: {
                th: 90,
                lr: 1.1
            },
            note: "Press Start. Expected: the fields beat, but the detector reads a steady 2 I₁ and V = 0 (Fresnel–Arago).",
        },
        analyser: {
            v: {
                th: 90,
                lr: 1.1,
                an: true,
                al: 45
            },
            note: "Press Start. Expected: the beat returns between 0 and 2 I₁, so V = 1. Malus's law halves each beam.",
        },
        beating: {
            v: {
                lr: 1.1
            },
            note: "Press Start. Expected: I beats between 0 and 4 I₁ every 11 T₁ (|Δf| = 0.0909 f₁).",
        },
        slowDetector: {
            v: {
                lr: 1.1,
                T: 22
            },
            note: "Expected: a steady 2 I₁ = I₁ + I₂. Integrating over two whole beat periods (22 T₁) removes the cross term.",
        },
    };

    const sidebar = document.querySelector(".options-sidebar");
    UI.enhanceAllSliders(sidebar, {
        idphase: {
            unit: "°"
        },
        idgarg: {
            unit: "°"
        },
        idpol: {
            unit: "°"
        },
        idalpha: {
            unit: "°"
        },
        idprobe: {
            unit: "λ₁"
        },
        idint: {
            unit: "T₁"
        },
        idspeed: {
            unit: "T₁/s"
        },
    });

    let t = 0;
    let activePreset = "constructive";
    let applyingPreset = false;
    let cursorT = null;
    let lastState = null;

    const ctl = UI.bindControls({
        ph: "#idphase",
        a2: "#idamp",
        lr: "#idwave",
        g: "#idgamma",
        ga: "#idgarg",
        th: "#idpol",
        an: "#idan",
        al: "#idalpha",
        xp: "#idprobe",
        T: "#idint",
        s1: "#showWave1",
        s2: "#showWave2",
        auto: "#autoScale",
        sp: "#idspeed",
    }, onControlsChanged);

    const PHYSICS_KEYS = Object.keys(PHYSICS_DEFAULTS);
    let physicsSnapshot = JSON.stringify(pick(ctl.get(), PHYSICS_KEYS));

    function pick(o, keys) {
        const r = {};
        for (const k of keys) r[k] = o[k];
        return r;
    }

    function onControlsChanged() {
        const snap = JSON.stringify(pick(ctl.get(), PHYSICS_KEYS));
        if (!applyingPreset && snap !== physicsSnapshot) setActivePreset(null);
        physicsSnapshot = snap;
        url.update();
        render();
    }

    const presetNote = $("presetNote");
    const presetButtons = Array.from(document.querySelectorAll("[data-preset]"));

    function setActivePreset(key) {
        activePreset = key;
        presetButtons.forEach((b) => {
            const on = b.dataset.preset === key;
            b.classList.toggle("active", on);
            b.setAttribute("aria-pressed", on ? "true" : "false");
        });
        presetNote.textContent = key ? PRESETS[key].note : "";
    }

    function applyPreset(key) {
        applyingPreset = true;
        t = 0;
        ctl.set(Object.assign({}, PHYSICS_DEFAULTS, PRESETS[key].v));
        applyingPreset = false;
        physicsSnapshot = JSON.stringify(pick(ctl.get(), PHYSICS_KEYS));
        setActivePreset(key);
        url.update();
        render();
    }

    presetButtons.forEach((b) => b.addEventListener("click", () => applyPreset(b.dataset.preset)));


    function buildState() {
        const s = ctl.get();
        const phi = s.ph * DEG,
            theta = s.th * DEG,
            gArg = s.ga * DEG,
            alpha = s.al * DEG;
        const w1 = model.makeWave(A1, LAMBDA1, 0, C);

        const w2 = model.makeWave(s.a2, LAMBDA1 * s.lr, phi + gArg, C);
        const w2par = model.makeWave(s.a2 * Math.cos(theta), LAMBDA1 * s.lr, phi + gArg, C);
        const beams = model.detectorBeams(A1, s.a2, theta, s.an ? alpha : null);
        const mu = model.crossFactor(model.complexGamma(s.g, gArg), beams.overlap);

        const d1 = model.makeWave(beams.A1, LAMBDA1, 0, C);
        const d2 = model.makeWave(beams.A2, LAMBDA1 * s.lr, phi, C);
        const beat = model.beat(w1, w2);
        const dOmega = w2.omega - w1.omega;
        return {
            s,
            phi,
            theta,
            gArg,
            alpha,
            w1,
            w2,
            w2par,
            beams,
            mu,
            d1,
            d2,
            beat,
            dOmega
        };
    }

    const Idet = (st, tt) => model.detectedIntensity(st.d1, st.d2, st.s.xp, tt, st.s.T, st.mu) / I1_UNIT;
    const Icyc = (st, tt) => model.intensity(st.d1, st.d2, st.s.xp, tt, st.mu) / I1_UNIT;

    function spatialRange(beat) {
        if (!Number.isFinite(beat.spatialPeriod)) return 4;
        return Math.min(24, Math.max(4, 1.25 * beat.spatialPeriod));
    }

    function timeWindow(beat) {
        if (!Number.isFinite(beat.TBeat)) return 6;
        return Math.min(60, Math.max(6, 2.5 * beat.TBeat));
    }

    function fieldLimit(st) {
        return st.s.auto ? Math.max(1, (A1 + st.s.a2) * 1.1) : FIXED_FIELD;
    }

    function sample(n, a, b, fn) {
        const xs = new Float64Array(n + 1),
            ys = new Float64Array(n + 1);
        for (let i = 0; i <= n; i++) {
            const x = a + ((b - a) * i) / n;
            xs[i] = x;
            ys[i] = fn(x);
        }
        return {
            xs,
            ys
        };
    }


    let spatialMap = null,
        intensityMap = null;
    const narrow = (w) => w < 460;
    const margin = (w) => (narrow(w) ? {
        l: 46,
        r: 10,
        t: 10,
        b: 38
    } : {
        l: 54,
        r: 14,
        t: 10,
        b: 40
    });

    function drawSpatial(ctx, w, h) {
        const st = lastState;
        if (!st) return;
        const {
            s,
            w1,
            w2,
            w2par,
            beat,
            theta
        } = st;
        const xMax = spatialRange(beat);
        const lim = fieldLimit(st);
        const n = Math.max(400, Math.round(xMax * 60));
        const series = [];
        if (Number.isFinite(beat.spatialPeriod) && Math.abs(Math.cos(theta)) > 1e-9) {
            const env = sample(n, 0, xMax, (x) => model.resultantPhasor([w1, w2par], x, t).magnitude);
            series.push({
                xs: env.xs,
                ys: env.ys,
                color: COLORS.resultant,
                width: 1,
                dash: [4, 4]
            });
            series.push({
                xs: env.xs,
                ys: Array.from(env.ys, (v) => -v),
                color: COLORS.resultant,
                width: 1,
                dash: [4, 4]
            });
        }
        if (s.s1) series.push(Object.assign(sample(n, 0, xMax, (x) => model.field(w1, x, t)), {
            color: COLORS.wave1,
            width: 1.6
        }));
        if (s.s2) series.push(Object.assign(sample(n, 0, xMax, (x) => model.field(w2, x, t)), {
            color: COLORS.wave2,
            width: 1.6,
            dash: [7, 4]
        }));
        if (Math.abs(Math.sin(theta)) > 1e-9) {
            series.push(Object.assign(sample(n, 0, xMax, (x) => model.fieldComponents(w1, w2, x, t, theta).perp), {
                color: COLORS.perp,
                width: 2,
                dash: [2, 3]
            }));
        }
        series.push(Object.assign(sample(n, 0, xMax, (x) => model.fieldComponents(w1, w2, x, t, theta).par), {
            color: COLORS.resultant,
            width: 2.6
        }));
        spatialMap = UI.plot(ctx, {
            x: 0,
            y: 0,
            w,
            h
        }, {
            x: {
                min: 0,
                max: xMax,
                label: "x",
                unit: "λ₁"
            },
            y: {
                min: -lim,
                max: lim,
                label: "E",
                unit: "A₁"
            },
            series,
            legend: "outside",
            margin: margin(w),
            markers: [{
                x: s.xp,
                label: "xₚ",
                color: COLORS.probe,
                dash: [3, 3]
            }],
        });
        const e = model.fieldComponents(w1, w2, s.xp, t, theta).par;
        const p = spatialMap.toPx(s.xp, Math.max(-lim, Math.min(lim, e)));
        ctx.fillStyle = COLORS.resultant;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4.5, 0, 2 * Math.PI);
        ctx.fill();
    }

    function drawTime(ctx, w, h) {
        const st = lastState;
        if (!st) return;
        const {
            s,
            w1,
            w2,
            w2par,
            beat,
            theta
        } = st;
        const W = timeWindow(beat);
        const lim = fieldLimit(st);
        const n = Math.max(600, Math.round(W * 40));
        const series = [];
        if (Number.isFinite(beat.TBeat) && Math.abs(Math.cos(theta)) > 1e-9) {
            const env = sample(n, t - W, t, (tt) => model.resultantPhasor([w1, w2par], s.xp, tt).magnitude);
            series.push({
                xs: env.xs,
                ys: env.ys,
                color: COLORS.resultant,
                width: 1,
                dash: [4, 4]
            });
            series.push({
                xs: env.xs,
                ys: Array.from(env.ys, (v) => -v),
                color: COLORS.resultant,
                width: 1,
                dash: [4, 4]
            });
        }
        if (Math.abs(Math.sin(theta)) > 1e-9) {
            series.push(Object.assign(sample(n, t - W, t, (tt) => model.fieldComponents(w1, w2, s.xp, tt, theta).perp), {
                color: COLORS.perp,
                width: 1.6,
                dash: [2, 3]
            }));
        }
        series.push(Object.assign(sample(n, t - W, t, (tt) => model.fieldComponents(w1, w2, s.xp, tt, theta).par), {
            color: COLORS.resultant,
            width: 1.8
        }));
        UI.plot(ctx, {
            x: 0,
            y: 0,
            w,
            h
        }, {
            x: {
                min: t - W,
                max: t,
                label: "t′",
                unit: "T₁"
            },
            y: {
                min: -lim,
                max: lim,
                label: "E(xₚ)",
                unit: "A₁"
            },
            series,
            legend: "outside",
            margin: margin(w),
        });
    }

    function drawIntensity(ctx, w, h) {
        const st = lastState;
        if (!st) return;
        const {
            s,
            beams,
            beat
        } = st;
        const W = timeWindow(beat);
        const ext = model.intensityExtremes(beams.A1, beams.A2, 1, 0, 0);
        const yMax = s.auto ? Math.max(1, (ext.Imax / I1_UNIT) * 1.1) : FIXED_INTENSITY;
        const n = Math.max(400, Math.round(W * 20));
        const cyc = sample(n, t - W, t, (tt) => Icyc(st, tt));
        const det = sample(n, t - W, t, (tt) => Idet(st, tt));
        const sumI = (model.singleIntensity(beams.A1) + model.singleIntensity(beams.A2)) / I1_UNIT;
        let cursor = null;
        if (cursorT !== null && cursorT >= t - W && cursorT <= t) {
            cursor = {
                x: cursorT,
                label: `t′=${cursorT.toFixed(2)}  I=${Idet(st, cursorT).toFixed(3)}`
            };
        }
        intensityMap = UI.plot(ctx, {
            x: 0,
            y: 0,
            w,
            h
        }, {
            x: {
                min: t - W,
                max: t,
                label: "t′",
                unit: "T₁"
            },
            y: {
                min: 0,
                max: yMax,
                label: "I",
                unit: "I₁"
            },
            series: [{
                    xs: cyc.xs,
                    ys: cyc.ys,
                    color: COLORS.cycle,
                    width: 1.4,
                    dash: [6, 4]
                },
                {
                    xs: det.xs,
                    ys: det.ys,
                    color: COLORS.detector,
                    width: 2.6
                },
            ],
            hlines: [{
                y: sumI,
                color: PAL.textMuted,
                dash: [2, 4]
            }],
            legend: "outside",
            margin: margin(w),
            cursor,
        });
        ctx.font = `11px ${PAL.font}`;
        ctx.fillStyle = PAL.textMuted;
        ctx.textAlign = "left";
        ctx.textBaseline = "bottom";
        const py = intensityMap.yToPx(sumI);
        if (py > intensityMap.plot.y + 12) ctx.fillText("I₁+I₂", intensityMap.plot.x + 4, py - 2);
    }

    function arrow(ctx, a, b, color, width, dash) {
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        ctx.save();
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = width;
        ctx.setLineDash(dash || []);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.setLineDash([]);
        if (len > 3) {
            const head = Math.min(10, len * 0.4);
            const ang = Math.atan2(b.y - a.y, b.x - a.x);
            ctx.beginPath();
            ctx.moveTo(b.x, b.y);
            ctx.lineTo(b.x - head * Math.cos(ang - Math.PI / 7), b.y - head * Math.sin(ang - Math.PI / 7));
            ctx.lineTo(b.x - head * Math.cos(ang + Math.PI / 7), b.y - head * Math.sin(ang + Math.PI / 7));
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();
    }

    function squareRect(w, h, m) {
        const s = Math.max(60, Math.min(w - m.l - m.r, h - m.t - m.b));
        const rw = s + m.l + m.r,
            rh = s + m.t + m.b;
        return {
            x: (w - rw) / 2,
            y: (h - rh) / 2,
            w: rw,
            h: rh
        };
    }

    function drawPhasor(ctx, w, h) {
        const st = lastState;
        if (!st) return;
        const {
            s,
            w1,
            w2,
            w2par,
            theta
        } = st;
        const R = s.auto ? Math.max(1, A1 + s.a2) * 1.1 : FIXED_FIELD;
        const m = {
            l: 46,
            r: 12,
            t: 10,
            b: 38
        };
        const map = UI.plot(ctx, squareRect(w, h, m), {
            x: {
                min: -R,
                max: R,
                label: "Re",
                unit: "A₁"
            },
            y: {
                min: -R,
                max: R,
                label: "Im",
                unit: "A₁"
            },
            series: [],
            legend: "outside",
            margin: m,
        });
        const O = map.toPx(0, 0);
        const unit = map.plot.w / (2 * R);
        ctx.save();
        ctx.beginPath();
        ctx.rect(map.plot.x, map.plot.y, map.plot.w, map.plot.h);
        ctx.clip();
        ctx.strokeStyle = PAL.gridStrong;
        ctx.setLineDash([4, 4]);
        const a2p = s.a2 * Math.cos(theta);
        for (const r of [Math.abs(A1 + a2p), Math.abs(A1 - a2p)]) {
            if (r <= 1e-6) continue;
            ctx.beginPath();
            ctx.arc(O.x, O.y, r * unit, 0, 2 * Math.PI);
            ctx.stroke();
        }
        ctx.setLineDash([]);
        const q1 = model.phasor(w1, s.xp, t);
        const q2 = model.phasor(w2par, s.xp, t);
        const q2full = model.phasor(w2, s.xp, t);
        const r = model.resultantPhasor([w1, w2par], s.xp, t);

        ctx.strokeStyle = COLORS.resultant;
        ctx.globalAlpha = 0.6;
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.moveTo(map.xToPx(r.re), map.yToPx(r.im));
        ctx.lineTo(map.xToPx(r.re), O.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
        ctx.fillStyle = COLORS.resultant;
        ctx.beginPath();
        ctx.arc(map.xToPx(r.re), O.y, 3.5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.globalAlpha = 0.85;
        arrow(ctx, O, map.toPx(r.re, r.im), COLORS.resultant, 5);
        ctx.globalAlpha = 1;
        if (s.s1) arrow(ctx, O, map.toPx(q1.re, q1.im), COLORS.wave1, 2.2);
        if (s.s2) {
            const len = Math.hypot(q2.re, q2.im) || 1;
            const nx = (-q2.im / len) * 4,
                ny = (-q2.re / len) * 4;
            const a = map.toPx(q1.re, q1.im),
                b = map.toPx(q1.re + q2.re, q1.im + q2.im);
            arrow(ctx, {
                x: a.x + nx,
                y: a.y + ny
            }, {
                x: b.x + nx,
                y: b.y + ny
            }, COLORS.wave2, 2.2, [6, 3]);
            if (Math.abs(Math.sin(theta)) > 1e-9) {
                const sn = Math.sin(theta);
                arrow(ctx, O, map.toPx(q2full.re * sn, q2full.im * sn), COLORS.perp, 1.8, [2, 3]);
            }
        }
        ctx.restore();
        ctx.font = `12px ${PAL.mono}`;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillStyle = PAL.text;
        ctx.fillText(`|E∥| = ${r.magnitude.toFixed(2)}`, map.plot.x + 5, map.plot.y + 4);
        ctx.fillText(`E∥(xₚ) = ${r.re.toFixed(2)}`, map.plot.x + 5, map.plot.y + 20);
    }

    function drawPol(ctx, w, h) {
        const st = lastState;
        if (!st) return;
        const {
            s,
            theta,
            alpha
        } = st;
        ctx.fillStyle = PAL.panel;
        ctx.fillRect(0, 0, w, h);

        const top = 44,
            bottom = 30;
        const cx = w / 2,
            cy = top + (h - top - bottom) / 2;
        const R = Math.max(30, Math.min(w / 2 - 34, (h - top - bottom) / 2 - 16));
        const P = (u, v, k) => ({
            x: cx + (k || R) * u,
            y: cy - (k || R) * v
        });
        ctx.font = `12px ${PAL.font}`;

        ctx.strokeStyle = PAL.grid;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx - R - 12, cy);
        ctx.lineTo(cx + R + 12, cy);
        ctx.moveTo(cx, cy + R + 12);
        ctx.lineTo(cx, cy - R - 12);
        ctx.stroke();
        ctx.strokeStyle = PAL.gridStrong;
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.arc(cx, cy, R, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = PAL.textMuted;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText("y", cx + R + 14, cy);
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText("z", cx, cy - R - 12);

        if (s.an) {
            const a = P(Math.cos(alpha), Math.sin(alpha), R + 10),
                b = P(-Math.cos(alpha), -Math.sin(alpha), R + 10);
            ctx.strokeStyle = COLORS.analyser;
            ctx.lineWidth = 2;
            ctx.setLineDash([10, 3, 2, 3]);
            ctx.beginPath();
            ctx.moveTo(b.x, b.y);
            ctx.lineTo(a.x, a.y);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = COLORS.analyser;
            ctx.textBaseline = "middle";
            const txt = `analyser α=${s.al.toFixed(0)}°`;
            const tw = ctx.measureText(txt).width;
            const lab = P(Math.cos(alpha), Math.sin(alpha), R + 14);
            let lx = Math.cos(alpha) >= 0 ? lab.x : lab.x - tw;
            lx = Math.max(4, Math.min(w - 4 - tw, lx));
            ctx.textAlign = "left";
            ctx.fillText(txt, lx, Math.max(top + 4, Math.min(h - bottom - 4, lab.y)));
        }

        ctx.strokeStyle = PAL.textMuted;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, R * 0.28, -theta, 0, false);
        ctx.stroke();
        if (theta > 0.05) {
            ctx.fillStyle = PAL.text;
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            const lp = P(Math.cos(theta / 2), Math.sin(theta / 2), R * 0.28 + 8);
            ctx.fillText(`θ=${s.th.toFixed(0)}°`, lp.x, lp.y);
        }

        const ct = Math.cos(theta);
        const tip2 = P(Math.cos(theta), Math.sin(theta));
        const foot = P(ct, 0);
        ctx.strokeStyle = PAL.textMuted;
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.moveTo(tip2.x, tip2.y);
        ctx.lineTo(foot.x, foot.y);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.strokeStyle = COLORS.resultant;
        ctx.lineWidth = 6;
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(foot.x, foot.y);
        ctx.stroke();
        ctx.globalAlpha = 1;
        arrow(ctx, P(0, 0), P(1, 0), COLORS.wave1, 2.4);
        arrow(ctx, P(0, 0), tip2, COLORS.wave2, 2.4, [6, 3]);
        ctx.fillStyle = COLORS.wave1;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText("ê₁", P(1, 0).x - 14, cy + 6);
        ctx.fillStyle = COLORS.wave2;
        ctx.textBaseline = "bottom";
        ctx.textAlign = Math.cos(theta) >= 0 ? "left" : "right";
        ctx.fillText("ê₂", tip2.x + (Math.cos(theta) >= 0 ? 4 : -4), tip2.y - 2);
        ctx.font = `12px ${PAL.mono}`;
        ctx.fillStyle = PAL.text;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText(`ê₁·ê₂ = cos θ = ${ct.toFixed(3)}`, 8, 6);
        ctx.fillText(`|μ| = |γ₁₂|·|overlap| = ${st.mu.mag.toFixed(3)}`, 8, 22);
        if (s.an) ctx.fillText(`after analyser: A₁′=${st.beams.A1.toFixed(2)}, A₂′=${st.beams.A2.toFixed(2)}`, 8, h - 20);
    }


    const cvSpatial = $("canvas"),
        cvTime = $("timeCanvas"),
        cvInt = $("intensityCanvas"),
        cvPhasor = $("phasorCanvas"),
        cvPol = $("polCanvas");
    const desc = {
        spatial: UI.describeCanvas(cvSpatial, "Spatial field plot", {
            label: "Field versus position with probe marker; click to move the probe"
        }),
        time: UI.describeCanvas(cvTime, "Time trace", {
            label: "Field at the probe versus time"
        }),
        intensity: UI.describeCanvas(cvInt, "Detector trace", {
            label: "Detector intensity at the probe versus time"
        }),
        phasor: UI.describeCanvas(cvPhasor, "Phasor diagram", {
            label: "Rotating phasors at the probe"
        }),
        pol: UI.describeCanvas(cvPol, "Polarization overlap", {
            label: "Polarization directions, overlap and analyser"
        }),
    };

    lastState = buildState();
    const views = [
        UI.setupCanvas(cvSpatial, {
            aspect: 2.6,
            minHeight: 210,
            maxHeight: 300,
            draw: drawSpatial
        }),
        UI.setupCanvas(cvTime, {
            aspect: 1.7,
            minHeight: 200,
            maxHeight: 280,
            draw: drawTime
        }),
        UI.setupCanvas(cvInt, {
            aspect: 1.7,
            minHeight: 200,
            maxHeight: 280,
            draw: drawIntensity
        }),
        UI.setupCanvas(cvPhasor, {
            aspect: 1.15,
            minHeight: 280,
            maxHeight: 420,
            draw: drawPhasor
        }),
        UI.setupCanvas(cvPol, {
            aspect: 1.15,
            minHeight: 280,
            maxHeight: 420,
            draw: drawPol
        }),
    ];


    function setProbeFromPointer(e) {
        if (!spatialMap) return;
        const r = cvSpatial.getBoundingClientRect();
        const px = e.clientX - r.left,
            py = e.clientY - r.top;
        if (!spatialMap.contains(px, py)) return;
        const x = Math.max(0, Math.min(4, spatialMap.pxToX(px)));
        ctl.set({
            xp: Math.round(x / 0.05) * 0.05
        });
    }
    cvSpatial.addEventListener("pointerdown", (e) => {
        setProbeFromPointer(e);
        cvSpatial.setPointerCapture && cvSpatial.setPointerCapture(e.pointerId);
    });
    cvSpatial.addEventListener("pointermove", (e) => {
        if (e.buttons & 1) setProbeFromPointer(e);
    });
    cvInt.addEventListener("pointermove", (e) => {
        if (!intensityMap) return;
        const r = cvInt.getBoundingClientRect();
        const px = e.clientX - r.left,
            py = e.clientY - r.top;
        cursorT = intensityMap.contains(px, py) ? intensityMap.pxToX(px) : null;
        views[2].redraw();
    });
    cvInt.addEventListener("pointerleave", () => {
        cursorT = null;
        views[2].redraw();
    });


    const fmt = (v, d) => (Number.isFinite(v) ? v.toFixed(d === undefined ? 3 : d) : "∞");
    const statPhase = $("stat-phase"),
        statIntensity = $("stat-intensity"),
        statVisibility = $("stat-visibility"),
        statMu = $("stat-mu"),
        statBeat = $("stat-beat");
    const readout = $("readout"),
        freqNote = $("freqNote"),
        polNote = $("polNote"),
        timeReadout = $("timeReadout"),
        regimeWarn = $("regimeWarn");
    const alphaGroup = $("idalpha").closest(".control-group");

    function updateText(st) {
        const {
            s,
            w1,
            w2,
            d1,
            d2,
            beams,
            mu,
            beat,
            dOmega,
            theta
        } = st;
        const dPhi = model.wrapPhase(model.phaseDifference(w1, model.makeWave(s.a2, LAMBDA1 * s.lr, st.phi, C), s.xp, t));
        const I1 = model.singleIntensity(beams.A1) / I1_UNIT;
        const I2 = model.singleIntensity(beams.A2) / I1_UNIT;
        const ic = Icyc(st, t);
        const id = Idet(st, t);
        const ext = model.intensityExtremes(beams.A1, beams.A2, mu.mag, dOmega, s.T);
        const V = model.predictedVisibility(beams.A1, beams.A2, mu.mag, dOmega, s.T);
        const V0 = model.predictedVisibility(beams.A1, beams.A2, mu.mag, 0, 0);
        const beating = beat.fBeat > 1e-12;
        const sincF = model.sinc((dOmega * s.T) / 2);

        statPhase.textContent = `${fmt(dPhi / DEG, 1)}°`;
        statIntensity.textContent = `${fmt(id, 3)} I₁`;
        statVisibility.textContent = fmt(V, 3);
        statMu.textContent = fmt(mu.mag, 3);
        statBeat.textContent = beating ? `${fmt(beat.fBeat, 4)} f₁` : "0 (steady)";
        freqNote.textContent = `f₂/f₁ = ${fmt(w2.f / w1.f, 4)} (non-dispersive, f = c/λ)`;
        polNote.textContent = `Overlap ê₁·ê₂ = cos θ = ${fmt(Math.cos(theta), 3)}${s.an ? " (before the analyser)" : ""}`;
        timeReadout.textContent = `t = ${fmt(t, 2)} T₁`;
        alphaGroup.classList.toggle("is-disabled", !s.an);
        $("idalpha").disabled = !s.an;
        const alphaNum = $("idalpha").__opticsNum;
        if (alphaNum) alphaNum.input.disabled = !s.an;

        const rows = [
            ["I₁, I₂ at detector", `${fmt(I1, 3)}, ${fmt(I2, 3)} I₁`],
            ["Polarization overlap", s.an ? `${beams.overlap > 0 ? "+1" : "−1"} (analyser)` : `cos θ = ${fmt(Math.cos(theta), 3)}`],
            ["γ₁₂", `${fmt(s.g, 3)} ∠ ${fmt(s.ga, 0)}°`],
            ["μ = γ₁₂ × overlap", `${fmt(mu.mag, 3)} ∠ ${fmt(mu.arg / DEG, 1)}°`],
            ["Cycle-avg. I(xₚ, t)", `${fmt(ic, 3)} I₁`],
            [`Detector I (T = ${fmt(s.T, 1)} T₁)`, `${fmt(id, 3)} I₁`],
            ["Detected I_max / I_min", `${fmt(ext.Imax / I1_UNIT, 3)} / ${fmt(ext.Imin / I1_UNIT, 3)} I₁`],
            ["Visibility V", `${fmt(V, 3)} (T = 0: ${fmt(V0, 3)})`],
            ["Beat |Δf|, period", beating ? `${fmt(beat.fBeat, 4)} f₁, ${fmt(beat.TBeat, 2)} T₁` : "none (f₁ = f₂)"],
            ["Spatial beat Λ", beating ? `${fmt(beat.spatialPeriod, 2)} λ₁, v_g = ${fmt(beat.groupVelocity, 2)} c` : "none"],
            ["Averaging factor sinc(ΔωT/2)", fmt(sincF, 3)],
        ];
        readout.innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");

        let warn = "";
        if (s.an && beams.A1 < 1e-9 && beams.A2 < 1e-9) warn = "The analyser blocks both beams: nothing reaches the detector.";
        else if (!s.an && Math.abs(Math.cos(theta)) < 1e-9 && s.a2 > 0) warn = "Orthogonal polarizations: no interference term. Turn on the analyser to project both beams onto one axis.";
        else if (mu.mag < 1e-9 && s.a2 > 0) warn = "|γ₁₂| = 0: the beams add incoherently (I = I₁ + I₂).";
        regimeWarn.hidden = !warn;
        regimeWarn.textContent = warn;

        const I2abs = model.singleIntensity(s.a2) / I1_UNIT;
        desc.spatial.update(`Field snapshot at t = ${fmt(t, 2)} T₁ over x = 0 to ${fmt(spatialRange(beat), 1)} λ₁. Wave 2 has amplitude ${fmt(s.a2, 2)} A₁ and wavelength ${fmt(s.lr, 2)} λ₁. ` +
            `Parallel component at the probe x = ${fmt(s.xp, 2)} λ₁ is ${fmt(model.fieldComponents(w1, w2, s.xp, t, theta).par, 3)} A₁` +
            (Math.abs(Math.sin(theta)) > 1e-9 ? `; perpendicular component ${fmt(model.fieldComponents(w1, w2, s.xp, t, theta).perp, 3)} A₁.` : ".") +
            (beating ? ` Spatial beat envelope period ${fmt(beat.spatialPeriod, 2)} λ₁.` : ""));
        desc.time.update(`Field at the probe over the last ${fmt(timeWindow(beat), 1)} T₁. ` + (beating ? `The envelope beats with period ${fmt(beat.TBeat, 2)} T₁.` : "Constant envelope: equal frequencies."));
        desc.intensity.update(`Detector reading now ${fmt(id, 3)} I₁; cycle-averaged intensity ${fmt(ic, 3)} I₁; I₁ + I₂ = ${fmt(I1 + I2, 3)} I₁. ` +
            `Scanned extremes ${fmt(ext.Imax / I1_UNIT, 3)} and ${fmt(ext.Imin / I1_UNIT, 3)} I₁, visibility ${fmt(V, 3)}.`);
        const r = model.resultantPhasor([w1, st.w2par], s.xp, t);
        desc.phasor.update(`Phasor E₁ length 1, E₂ parallel projection ${fmt(Math.abs(s.a2 * Math.cos(theta)), 3)} A₁; resultant length ${fmt(r.magnitude, 3)} A₁ at ${fmt(r.angle / DEG, 1)}°. ` +
            `Orthogonal part ${fmt(Math.abs(s.a2 * Math.sin(theta)), 3)} A₁ (adds ${fmt(I2abs * Math.sin(theta) ** 2, 3)} I₁ of background).`);
        desc.pol.update(`Angle between polarizations ${fmt(s.th, 0)}°, overlap cos θ = ${fmt(Math.cos(theta), 3)}, |μ| = ${fmt(mu.mag, 3)}.` +
            (s.an ? ` Analyser at ${fmt(s.al, 0)}° passes amplitudes ${fmt(beams.A1, 3)} and ${fmt(beams.A2, 3)} A₁.` : " No analyser."));
    }

    function render() {
        lastState = buildState();
        views.forEach((v) => v.redraw());
        updateText(lastState);
    }


    document.querySelectorAll("#plotLegend .swatch").forEach((el) => {
        el.style.borderTopColor = COLORS[el.dataset.key];
    });


    const startStopBtn = $("startStopBtn");
    const loop = UI.createLoop((dt) => {
        t += dt * ctl.get().sp;
        render();
    }, {
        onChange(running) {
            startStopBtn.innerHTML = running ? '<span aria-hidden="true">⏸️</span> Pause' : '<span aria-hidden="true">▶️</span> Start';
            startStopBtn.setAttribute("aria-pressed", running ? "true" : "false");
        },
    });
    startStopBtn.addEventListener("click", () => loop.toggle());
    $("stepBtn").addEventListener("click", () => {
        t += 0.1;
        render();
    });
    $("resetBtn").addEventListener("click", () => {
        loop.stop();
        t = 0;
        applyingPreset = true;
        ctl.set(DEFAULTS);
        applyingPreset = false;
        physicsSnapshot = JSON.stringify(pick(ctl.get(), PHYSICS_KEYS));
        setActivePreset("constructive");
        url.update();
        render();
    });


    const url = UI.urlState({
        get: ctl.get,
        set: ctl.set
    });
    url.ready.then((restored) => {
        if (restored) {
            physicsSnapshot = JSON.stringify(pick(ctl.get(), PHYSICS_KEYS));
            const match = Object.keys(PRESETS).find((k) =>
                JSON.stringify(pick(Object.assign({}, PHYSICS_DEFAULTS, PRESETS[k].v), PHYSICS_KEYS)) === physicsSnapshot);
            setActivePreset(match || null);
        }
        render();
    });

    UI.addExportBar($("exportHost"), {
        name: "interference",
        url,
        getState: () => Object.assign({
            t_T1: t,
            units: "lambda1 = 1, T1 = 1, A1 = 1, I in I1 = A1^2/2, angles in degrees"
        }, ctl.get()),
        getCSV: () => {
            const st = lastState;
            const W = timeWindow(st.beat);
            const rows = [];
            for (let i = 0; i <= 400; i++) {
                const tt = t - W + (W * i) / 400;
                const c = model.fieldComponents(st.w1, st.w2, st.s.xp, tt, st.theta);
                rows.push([tt, c.par, c.perp, Icyc(st, tt), Idet(st, tt)]);
            }
            return {
                headers: ["t (T1)", "E_par at xp (A1)", "E_perp at xp (A1)", "I cycle-avg (I1)", "I detector (I1)"],
                rows
            };
        },
        canvases: [cvSpatial, cvTime, cvInt, cvPhasor, cvPol],
        caption: () => {
            const s = ctl.get();
            return `φ=${s.ph}° A₂=${s.a2} λ₂/λ₁=${s.lr} γ=${s.g}∠${s.ga}° θ=${s.th}°` +
                (s.an ? ` α=${s.al}°` : "") + ` xₚ=${s.xp} T=${s.T} t=${t.toFixed(1)}`;
        },
    });

    setActivePreset("constructive");
    render();
})();