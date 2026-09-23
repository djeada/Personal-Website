/* Waveguides and optical fibres: page glue. Physics lives in ../shared/optics/waveguides.js. */
(function() {
    "use strict";
    const UI = window.OpticsUI,
        core = window.OpticsModels.core,
        W = window.OpticsModels.waveguides;
    const $ = (id) => document.getElementById(id);
    const PAL = UI.CANVAS_PALETTE;
    const DEG = 180 / Math.PI;
    const C0 = core.constants.c;

    // ------------------------------------------------------------------ defaults & presets
    const DEFAULTS = {
        geo: "slab",
        pol: "TE",
        n1: 1.5,
        n2: 1.48,
        d: Math.log10(6),
        lam: 1550,
        sweep: "lambda",
        inten: false,
        gap: 2
    };
    const DEFAULT_MODE = "TE0";
    const PRESETS = {
        smf: {
            s: {
                geo: "fibre",
                n1: 1.4492,
                n2: 1.444,
                d: Math.log10(8.2),
                lam: 1550,
                gap: 5,
                sweep: "lambda"
            },
            mode: "LP01",
            note: "Step-index SMF: V ≈ 2.04 < 2.405, so only LP01 (two polarizations) is guided. Γ ≈ 0.75: a quarter of the power travels in the cladding. Cut-off wavelength λc ≈ 1314 nm."
        },
        smf1000: {
            s: {
                geo: "fibre",
                n1: 1.4492,
                n2: 1.444,
                d: Math.log10(8.2),
                lam: 1000,
                gap: 5,
                sweep: "lambda"
            },
            mode: "LP11",
            note: "Same fibre at 1000 nm: V ≈ 3.16 > 2.405, so LP11 (TE01, TM01, HE21) is guided too. LP01 is now more tightly confined (Γ ≈ 0.91)."
        },
        mmf: {
            s: {
                geo: "fibre",
                n1: 1.48,
                n2: 1.46,
                d: Math.log10(50),
                lam: 850,
                gap: 5,
                sweep: "size"
            },
            mode: "LP01",
            note: "50 µm multimode fibre: V ≈ 44.8, 263 LP modes (1022 counting degeneracy ≈ V²/2). Intermodal delay ≈ 63 ns/km from the modes, 68 ns/km from rays."
        },
        slab: {
            s: {
                geo: "slab",
                pol: "TE",
                n1: 1.5,
                n2: 1.48,
                d: Math.log10(6),
                lam: 1550,
                gap: 2,
                sweep: "lambda"
            },
            mode: "TE0",
            note: "Symmetric slab, V ≈ 2.97: TE0 and TE1 are guided (TE1 appeared at V = π/2, TE2 needs V > π). Switch to TE1: steeper ray (θ ≈ 7.2° vs 3.7°) and lower Γ."
        },
        nearcut: {
            s: {
                geo: "slab",
                pol: "TE",
                n1: 1.5,
                n2: 1.45,
                d: Math.log10(1.35),
                lam: 1000,
                gap: 2,
                sweep: "size"
            },
            mode: "TE1",
            note: "V ≈ 1.63, just above the TE1 cut-off π/2: TE1 has b ≈ 0.003, Γ ≈ 0.09 and a 1/e tail of ≈ 7.5 µm, much wider than the 1.35 µm core."
        },
        thin: {
            s: {
                geo: "slab",
                pol: "TE",
                n1: 1.5,
                n2: 1.48,
                d: Math.log10(0.1),
                lam: 1550,
                gap: 2,
                sweep: "size"
            },
            mode: "TE0",
            note: "V ≈ 0.05: the symmetric slab's TE0 mode is still guided (no cut-off), but b ≈ V² ≈ 0.0024, Γ ≈ 0.005 and the tail reaches ≈ 20 µm."
        },
        soi: {
            s: {
                geo: "slab",
                pol: "TE",
                n1: 3.48,
                n2: 1.444,
                d: Math.log10(0.22),
                lam: 1550,
                gap: 0.3,
                sweep: "lambda"
            },
            mode: "TE0",
            note: "220 nm silicon slab in silica: single TE0 (n_eff ≈ 2.85) and TM0 (≈ 2.06). High contrast gives strong birefringence and n_g ≈ 3.6 > n_eff. The LP fibre model would be invalid here."
        },
        coupler: {
            s: {
                geo: "slab",
                pol: "TE",
                n1: 1.5,
                n2: 1.48,
                d: Math.log10(3),
                lam: 1550,
                gap: 2,
                sweep: "lambda"
            },
            mode: "TE0",
            note: "Two 3 µm slabs 2 µm apart: exact supermodes give L_c ≈ 0.43 mm and coupled-mode theory agrees within 0.5 %. Add 1 µm to the gap and L_c grows by ≈ e^(γ·1 µm)."
        }
    };

    // ------------------------------------------------------------------ controls
    const sliders = ["n1Slider", "n2Slider", "dSlider", "lambdaSlider", "gapSlider"].map($);
    UI.enhanceSlider($("n1Slider"), {
        unit: "",
        label: "Core index n1"
    });
    UI.enhanceSlider($("n2Slider"), {
        unit: "",
        label: "Cladding index n2"
    });
    UI.enhanceSlider($("dSlider"), {
        unit: "µm",
        label: "Core size d",
        format: (v) => Number(Math.pow(10, v).toPrecision(4)),
        parse: (x) => Math.log10(Math.max(1e-6, x))
    });
    UI.enhanceSlider($("lambdaSlider"), {
        unit: "nm",
        label: "Vacuum wavelength"
    });
    UI.enhanceSlider($("gapSlider"), {
        unit: "µm",
        label: "Coupler gap"
    });
    void sliders;

    let wantedMode = DEFAULT_MODE;
    const ctl = UI.bindControls({
        geo: "radio:geo",
        pol: "radio:pol",
        n1: "#n1Slider",
        n2: "#n2Slider",
        d: "#dSlider",
        lam: "#lambdaSlider",
        sweep: "#sweepSel",
        inten: "#intensityBox",
        gap: "#gapSlider"
    }, () => {
        url.update();
        schedule();
    });
    const modeSel = $("modeSel");
    modeSel.addEventListener("change", () => {
        wantedMode = modeSel.value;
        url.update();
        schedule();
    });
    const url = UI.urlState({
        get: () => Object.assign(ctl.get(), {
            mode: wantedMode
        }),
        set: (o) => {
            if (o.mode) wantedMode = String(o.mode);
            const c = Object.assign({}, o);
            delete c.mode;
            ctl.set(c);
            schedule();
        }
    });

    // ------------------------------------------------------------------ state
    let S = ctl.get();
    let input = null,
        sol = null,
        sel = null,
        profile = null,
        gi = null,
        disp = null,
        coup = null;
    let phase = 0,
        profCursor = NaN;

    const fmt = (v, n = 4) => (Number.isFinite(v) ? Number(v.toPrecision(n)).toString() : "—");
    const fmtFixed = (v, n = 4) => (Number.isFinite(v) ? v.toFixed(n) : "—");

    function readState() {
        S = ctl.get();
        input = {
            n1: S.n1,
            n2: S.n2,
            d: Math.pow(10, S.d) * 1e-6,
            lambda0: S.lam * 1e-9
        };
    }

    function solve() {
        readState();
        if (S.geo === "slab") sol = W.solveSlab(input, S.pol);
        else sol = W.solveFibre(input);
        const labels = sol.modes.map((m) => m.label);
        // repopulate the mode selector when the list changed
        const current = Array.from(modeSel.options).map((o) => o.value).join("|");
        if (current !== labels.join("|")) {
            modeSel.innerHTML = "";
            for (const m of sol.modes.slice(0, 200)) {
                const o = document.createElement("option");
                o.value = m.label;
                o.textContent = m.label + (m.vectorModes ? " (" + m.vectorModes + ")" : "") + " · n_eff " + m.neff.toFixed(5);
                modeSel.appendChild(o);
            }
        }
        // keep the requested mode if it exists; map TE↔TM of the same order when the polarization changes
        let target = wantedMode;
        if (S.geo === "slab" && /^T[EM]\d+$/.test(target)) target = S.pol + target.slice(2);
        if (S.geo === "slab" && /^LP/.test(target)) target = S.pol + "0";
        if (S.geo === "fibre" && !/^LP/.test(target)) target = "LP01";
        sel = sol.modes.find((m) => m.label === target) || sol.modes[0] || null;
        if (sel) {
            modeSel.value = sel.label;
            wantedMode = sel.label;
        }
        modeSel.disabled = !sel;

        profile = sel ? buildProfile(sel) : null;
        gi = sel ? W.groupIndex(S.geo, input, sel.label) : null;
        disp = sol.modes.length ? W.modalDispersion(S.geo, input, sol.modes) : null;
        const gap = S.gap * 1e-6;
        coup = S.geo === "slab" ? W.coupledSlabs(input, S.pol, gap) : W.coupledFibres(input, gap);
    }

    /** Transverse cut through the selected mode: x in µm, ψ peak-normalised (fibre: along φ = 0/π). */
    function buildProfile(m) {
        const a = m.a;
        const tail = Number.isFinite(m.decayLength) ? m.decayLength : 4 * a;
        const X = Math.min(4 * a, Math.max(1.6 * a, a + 3 * tail));
        const n = 401,
            xs = [],
            ps = [];
        for (let i = 0; i < n; i++) {
            const x = -X + 2 * X * i / (n - 1);
            xs.push(x * 1e6);
            ps.push(m.kind === "slab" ? W.slabField(m, x, true) : W.lpField(m, Math.abs(x), x < 0 ? Math.PI : 0));
        }
        const mx = Math.max(...ps.map(Math.abs)) || 1;
        const psi = ps.map((v) => v / mx);
        const inten = psi.map((v) => v * v);
        let ex = null;
        if (m.kind === "slab" && m.pol === "TM") {
            const raw = ps.map((v, i) => v / Math.pow(Math.abs(xs[i] * 1e-6) <= a ? m.n1 : m.n2, 2));
            const mxe = Math.max(...raw.map(Math.abs)) || 1;
            ex = raw.map((v) => v / mxe);
        }
        return {
            X,
            Xum: X * 1e6,
            aum: a * 1e6,
            xs,
            psi,
            inten,
            ex,
            fn: (xm) => (m.kind === "slab" ? W.slabField(m, xm, true) : W.lpField(m, Math.abs(xm), xm < 0 ? Math.PI : 0)) / mx
        };
    }

    // ------------------------------------------------------------------ helpers
    function noData(ctx, w, h, text) {
        ctx.fillStyle = PAL.background;
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = PAL.textMuted;
        ctx.font = "13px " + PAL.font;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, w / 2, h / 2);
    }
    const colorOf = (i) => PAL.series[i % PAL.series.length];
    const dashOf = (i) => PAL.dashes[Math.floor(i / PAL.series.length) % PAL.dashes.length];

    /** Choose a length unit for an axis range given in metres. */
    function lengthUnit(maxM) {
        if (maxM >= 0.5) return {
            unit: "m",
            s: 1
        };
        if (maxM >= 5e-4) return {
            unit: "mm",
            s: 1e3
        };
        return {
            unit: "µm",
            s: 1e6
        };
    }

    // ------------------------------------------------------------------ canvas 1: field snapshot
    let fieldMap = null;
    const fieldCv = UI.setupCanvas($("fieldCanvas"), {
        aspect: 2.6,
        minHeight: 210,
        maxHeight: 380,
        draw(ctx, w, h) {
            if (!sel || !profile) {
                noData(ctx, w, h, "No guided mode (need n₁ > n₂)");
                fieldMap = null;
                return;
            }
            const fs = w < 520 ? 11 : 12;
            const X = profile.Xum;
            const margin = {
                r: 62
            };
            // provisional mapping to learn the plot rectangle
            const lamG = sel.lambda0 / sel.neff * 1e6; // guided wavelength in µm
            const tmp = UI.plot(ctx, {
                x: 0,
                y: 0,
                w,
                h
            }, {
                x: {
                    min: 0,
                    max: 1
                },
                y: {
                    min: -X,
                    max: X
                },
                series: [],
                margin,
                fontSize: fs,
                background: false
            });
            const P = tmp.plot;
            ctx.clearRect(0, 0, w, h);
            let Z = (P.w / P.h) * 2 * X; // equal scale
            const pxPerFringe = P.w * lamG / Z;
            let compressed = false;
            if (pxPerFringe < 8) {
                Z = P.w * lamG / 8;
                compressed = true;
            }
            fieldMap = UI.plot(ctx, {
                x: 0,
                y: 0,
                w,
                h
            }, {
                x: {
                    min: 0,
                    max: Z,
                    label: "z",
                    unit: "µm"
                },
                y: {
                    min: -X,
                    max: X,
                    label: "x",
                    unit: "µm"
                },
                series: [],
                margin,
                fontSize: fs
            });
            const Q = fieldMap.plot;
            const nx = Math.max(60, Math.min(420, Math.round(Q.w))),
                ny = Math.max(40, Math.min(180, Math.round(Q.h)));
            const col = new Float64Array(nx),
                row = new Float64Array(ny);
            const beta = sel.beta * 1e-6; // rad/µm
            for (let i = 0; i < nx; i++) col[i] = Math.cos(beta * (Z * (i + 0.5) / nx) - phase);
            for (let j = 0; j < ny; j++) row[j] = profile.fn((-X + 2 * X * (j + 0.5) / ny) * 1e-6);
            const data = new Float64Array(nx * ny);
            for (let j = 0; j < ny; j++)
                for (let i = 0; i < nx; i++) data[j * nx + i] = row[j] * col[i];
            UI.imageFromArray(ctx, data, nx, ny, Q, "diverging", {
                min: -1,
                max: 1,
                smooth: true
            });
            // core boundaries
            ctx.save();
            ctx.strokeStyle = "rgba(236, 233, 248, 0.75)";
            ctx.setLineDash([6, 4]);
            ctx.lineWidth = 1.2;
            for (const xb of [profile.aum, -profile.aum]) {
                const py = fieldMap.yToPx(xb);
                ctx.beginPath();
                ctx.moveTo(Q.x, py);
                ctx.lineTo(Q.x + Q.w, py);
                ctx.stroke();
            }
            ctx.setLineDash([]);
            ctx.strokeStyle = PAL.axis;
            ctx.strokeRect(Q.x + 0.5, Q.y + 0.5, Q.w - 1, Q.h - 1);
            // ray directions ±θ (screen angle respects the axis scales)
            const sx = Q.w / Z,
                sy = Q.h / (2 * X);
            const L = Math.min(Q.w * 0.22, 140);
            const cx0 = Q.x + Q.w * 0.06,
                cy0 = Q.y + Q.h / 2;
            for (const sgn of [1, -1]) {
                const vx = Math.cos(sel.theta) * sx,
                    vy = -sgn * Math.sin(sel.theta) * sy;
                const nrm = Math.hypot(vx, vy);
                const ex = cx0 + L * vx / nrm,
                    ey = cy0 + L * vy / nrm;
                arrow(ctx, cx0, cy0, ex, ey, PAL.marker);
            }
            ctx.fillStyle = PAL.text;
            ctx.font = fs + "px " + PAL.font;
            ctx.textAlign = "left";
            ctx.textBaseline = "top";
            const factor = fmt((P.w / P.h) * 2 * X / Z, 2);
            if (Q.w < 560) {
                labelBox(ctx, `${sel.label}: n_eff ${sel.neff.toFixed(5)}, ±θ ${(sel.theta * DEG).toFixed(2)}°`, Q.x + 6, Q.y + 6, fs);
                labelBox(ctx, `λ₀/n_eff = ${fmt(lamG, 4)} µm`, Q.x + 6, Q.y + fs + 14, fs);
                if (compressed) labelBox(ctx, `z compressed ×${factor} vs x`, Q.x + 6, Q.y + Q.h - fs - 12, fs, PAL.warning);
            } else {
                labelBox(ctx, `${sel.label}: n_eff = ${sel.neff.toFixed(5)}, guided λ = λ₀/n_eff = ${fmt(lamG, 4)} µm, rays ±θ = ${(sel.theta * DEG).toFixed(2)}°`, Q.x + 6, Q.y + 6, fs);
                if (compressed) labelBox(ctx, `z axis compressed ×${factor} relative to x so that phase fronts stay resolvable`, Q.x + 6, Q.y + Q.h - fs - 12, fs, PAL.warning);
            }
            ctx.restore();
            UI.drawColorbar(ctx, {
                x: Q.x + Q.w + 14,
                y: Q.y,
                w: 10,
                h: Q.h
            }, "diverging", {
                min: -1,
                max: 1,
                ticks: [-1, 0, 1],
                fontSize: 11
            });
        }
    });

    function labelBox(ctx, text, x, y, fs, color) {
        ctx.save();
        ctx.font = fs + "px " + PAL.font;
        const tw = ctx.measureText(text).width;
        ctx.fillStyle = "rgba(7, 7, 13, 0.78)";
        ctx.fillRect(x - 3, y - 2, tw + 6, fs + 6);
        ctx.fillStyle = color || PAL.text;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText(text, x, y + 1);
        ctx.restore();
    }

    function arrow(ctx, x0, y0, x1, y1, color) {
        ctx.save();
        ctx.strokeStyle = "rgba(7, 7, 13, 0.85)";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
        const ang = Math.atan2(y1 - y0, x1 - x0),
            hl = 8;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x1 - hl * Math.cos(ang - 0.4), y1 - hl * Math.sin(ang - 0.4));
        ctx.lineTo(x1 - hl * Math.cos(ang + 0.4), y1 - hl * Math.sin(ang + 0.4));
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    // ------------------------------------------------------------------ canvas 2: ray picture
    const rayCv = UI.setupCanvas($("rayCanvas"), {
        aspect: 2.8,
        minHeight: 230,
        maxHeight: 360,
        draw(ctx, w, h) {
            if (!sel || !profile) {
                noData(ctx, w, h, "No guided mode (need n₁ > n₂)");
                return;
            }
            const fs = w < 520 ? 11 : 12;
            const narrow = w < 560;
            const splitW = narrow ? w : Math.round(w * 0.72);
            const rayH = narrow ? Math.round(h * 0.62) : h;
            const aum = profile.aum,
                Y = 1.6 * aum;
            const tanT = Math.tan(sel.theta);
            const period = 4 * sel.a / Math.max(tanT, 1e-9); // metres, one full zig-zag cycle
            const zMax = 2 * period,
                zMin = -0.3 * period;
            const U = lengthUnit(zMax);
            const map = UI.plot(ctx, {
                x: 0,
                y: 0,
                w: splitW,
                h: rayH
            }, {
                x: {
                    min: zMin * U.s,
                    max: zMax * U.s,
                    label: "z (compressed scale)",
                    unit: U.unit
                },
                y: {
                    min: -Y,
                    max: Y,
                    label: "x",
                    unit: "µm"
                },
                series: [],
                fontSize: fs,
                legend: false
            });
            const P = map.plot;
            ctx.save();
            ctx.beginPath();
            ctx.rect(P.x, P.y, P.w, P.h);
            ctx.clip();
            // core and cladding shading, air on the left of the entrance face
            const z0 = map.xToPx(0);
            ctx.fillStyle = "rgba(105, 245, 231, 0.10)";
            ctx.fillRect(z0, map.yToPx(aum), P.x + P.w - z0, map.yToPx(-aum) - map.yToPx(aum));
            ctx.fillStyle = "rgba(167, 139, 250, 0.08)";
            ctx.fillRect(z0, P.y, P.x + P.w - z0, map.yToPx(aum) - P.y);
            ctx.fillRect(z0, map.yToPx(-aum), P.x + P.w - z0, P.y + P.h - map.yToPx(-aum));
            ctx.strokeStyle = "rgba(236, 233, 248, 0.6)";
            ctx.lineWidth = 1;
            for (const xb of [aum, -aum]) {
                ctx.beginPath();
                ctx.moveTo(z0, map.yToPx(xb));
                ctx.lineTo(P.x + P.w, map.yToPx(xb));
                ctx.stroke();
            }
            ctx.beginPath();
            ctx.moveTo(z0, P.y);
            ctx.lineTo(z0, P.y + P.h);
            ctx.stroke();
            // steepest guided ray (dashed)
            const tMax = Math.acos(sel.n2 / sel.n1);
            drawZigZag(ctx, map, U, tMax, zMax, "rgba(248, 212, 119, 0.55)", [6, 5], 1.3, aum);
            // the mode's ray
            drawZigZag(ctx, map, U, sel.theta, zMax, PAL.series[0], [], 2.2, aum);
            // external ray and acceptance cone in air (n0 = 1)
            const sinAir = sel.n1 * Math.sin(sel.theta);
            const sinAcc = Math.min(1, sel.n1 * Math.sin(tMax));
            const zAir = zMin * 0.92;
            const slopeAir = Math.tan(Math.asin(Math.min(1, sinAir)));
            const slopeAcc = Math.tan(Math.asin(Math.min(0.999, sinAcc)));
            // cone (data coordinates: x = slope · (z − 0) · 1e6 µm)
            ctx.fillStyle = "rgba(248, 212, 119, 0.10)";
            ctx.beginPath();
            ctx.moveTo(z0, map.yToPx(0));
            ctx.lineTo(map.xToPx(zAir * U.s), map.yToPx(Math.max(-Y, slopeAcc * zAir * 1e6)));
            ctx.lineTo(map.xToPx(zAir * U.s), map.yToPx(Math.min(Y, -slopeAcc * zAir * 1e6)));
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = PAL.series[0];
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(map.xToPx(zAir * U.s), map.yToPx(slopeAir * zAir * 1e6));
            ctx.lineTo(z0, map.yToPx(0));
            ctx.stroke();
            ctx.restore();
            // labels
            ctx.save();
            labelBox(ctx, narrow ? `θ = ${(sel.theta * DEG).toFixed(2)}°, wall ${(sel.incidence * DEG).toFixed(2)}° > θc ${(Math.asin(sel.n2 / sel.n1) * DEG).toFixed(2)}°` :
                `θ = ${(sel.theta * DEG).toFixed(2)}° (incidence on wall ${(sel.incidence * DEG).toFixed(2)}° > θc ${(Math.asin(sel.n2 / sel.n1) * DEG).toFixed(2)}°)`, P.x + 6, P.y + 6, fs);
            labelBox(ctx, `dashed: θmax = ${(tMax * DEG).toFixed(2)}°`, P.x + 6, P.y + fs + 14, fs, PAL.marker);
            labelBox(ctx, "air", map.xToPx(zMin * U.s) + 4, P.y + P.h - fs - 10, fs, PAL.textMuted);
            ctx.restore();
            // profile panel
            const pr = narrow ? {
                x: 0,
                y: rayH,
                w,
                h: h - rayH
            } : {
                x: splitW,
                y: 0,
                w: w - splitW,
                h
            };
            if (narrow) {
                UI.plot(ctx, pr, {
                    x: {
                        min: -Y,
                        max: Y,
                        label: "x",
                        unit: "µm"
                    },
                    y: {
                        min: -1.1,
                        max: 1.1,
                        label: "ψ",
                        ticks: [-1, 0, 1]
                    },
                    series: [{
                        xs: profile.xs,
                        ys: profile.psi,
                        color: PAL.series[0]
                    }],
                    markers: [{
                        x: -aum
                    }, {
                        x: aum
                    }],
                    fontSize: fs,
                    margin: {
                        t: 8
                    }
                });
            } else {
                UI.plot(ctx, pr, {
                    x: {
                        min: -1.1,
                        max: 1.1,
                        label: "ψ (peak = 1)",
                        ticks: [-1, 0, 1]
                    },
                    y: {
                        min: -Y,
                        max: Y,
                        label: "x",
                        unit: "µm"
                    },
                    series: [{
                        xs: profile.psi,
                        ys: profile.xs,
                        color: PAL.series[0]
                    }],
                    hlines: [{
                        y: aum,
                        color: "rgba(236,233,248,0.5)"
                    }, {
                        y: -aum,
                        color: "rgba(236,233,248,0.5)"
                    }],
                    fontSize: fs,
                    margin: {
                        l: fs * 3.4
                    }
                });
            }
        }
    });

    function drawZigZag(ctx, map, U, theta, zMax, color, dash, width, aum) {
        const t = Math.tan(theta);
        if (!(t > 0)) return;
        const a = aum * 1e-6;
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.setLineDash(dash);
        ctx.beginPath();
        let z = 0,
            x = 0,
            dir = 1;
        ctx.moveTo(map.xToPx(0), map.yToPx(0));
        for (let k = 0; k < 400 && z < zMax; k++) {
            const target = dir > 0 ? a : -a;
            const dz = Math.abs(target - x) / t;
            z += dz;
            x = target;
            dir = -dir;
            ctx.lineTo(map.xToPx(z * U.s), map.yToPx(x * 1e6));
        }
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // ------------------------------------------------------------------ canvas 3: profile
    let profMap = null;
    const profCv = UI.setupCanvas($("profileCanvas"), {
        aspect: 1.6,
        minHeight: 230,
        maxHeight: 400,
        draw(ctx, w, h) {
            if (!sel || !profile) {
                noData(ctx, w, h, "No guided mode");
                profMap = null;
                return;
            }
            const fs = w < 420 ? 11 : 12;
            const series = [{
                    xs: profile.xs,
                    ys: profile.psi,
                    label: sel.kind === "slab" ? (sel.pol === "TE" ? "E_y" : "H_y") : "ψ (φ = 0 / π)",
                    color: PAL.series[0]
                },
                {
                    xs: profile.xs,
                    ys: profile.inten,
                    label: "intensity",
                    color: PAL.series[1],
                    dash: [7, 4]
                }
            ];
            if (profile.ex) series.push({
                xs: profile.xs,
                ys: profile.ex,
                label: "E_x ∝ H_y/n²",
                color: PAL.series[2],
                dash: [2, 3]
            });
            let cursor = null;
            if (Number.isFinite(profCursor)) {
                const v = profile.fn(profCursor * 1e-6);
                cursor = {
                    x: profCursor,
                    label: `x = ${fmt(profCursor, 3)} µm, ψ = ${v.toFixed(3)}`
                };
            }
            profMap = UI.plot(ctx, {
                x: 0,
                y: 0,
                w,
                h
            }, {
                x: {
                    min: -profile.Xum,
                    max: profile.Xum,
                    label: "x",
                    unit: "µm"
                },
                y: {
                    min: -1.1,
                    max: 1.1,
                    label: "normalised field"
                },
                series,
                markers: [{
                    x: -profile.aum,
                    label: "−d/2"
                }, {
                    x: profile.aum,
                    label: "+d/2"
                }],
                cursor,
                fontSize: fs,
                legendPosition: "left"
            });
        }
    });
    $("profileCanvas").addEventListener("pointermove", (e) => {
        if (!profMap) return;
        const r = e.currentTarget.getBoundingClientRect();
        const px = e.clientX - r.left,
            py = e.clientY - r.top;
        if (profMap.contains(px, py)) {
            profCursor = profMap.pxToX(px);
            profCv.redraw();
        }
    });
    $("profileCanvas").addEventListener("pointerleave", () => {
        profCursor = NaN;
        profCv.redraw();
    });

    // ------------------------------------------------------------------ canvas 4: all modes / LP image
    const imgCv = UI.setupCanvas($("imageCanvas"), {
        aspect: 1.25,
        minHeight: 260,
        maxHeight: 440,
        draw(ctx, w, h) {
            if (!sel) {
                noData(ctx, w, h, "No guided mode");
                return;
            }
            const fs = w < 420 ? 11 : 12;
            if (S.geo === "slab") drawAllSlabModes(ctx, w, h, fs);
            else drawLPImage(ctx, w, h, fs);
        }
    });

    function drawAllSlabModes(ctx, w, h, fs) {
        const modes = sol.modes.slice(0, 14);
        const last = modes[modes.length - 1];
        const tail = last.decayLength;
        const X = Math.min(3 * last.a, Math.max(1.5 * last.a, last.a + 2.5 * tail));
        const n = 241,
            series = [];
        const xs = [];
        for (let i = 0; i < n; i++) xs.push(-X + 2 * X * i / (n - 1));
        modes.forEach((m, i) => {
            const ys = xs.map((x) => W.slabField(m, x, true));
            const mx = Math.max(...ys.map(Math.abs)) || 1;
            series.push({
                xs: xs.map((x) => x * 1e6),
                ys: ys.map((v) => i + 0.42 * v / mx),
                color: colorOf(i),
                dash: dashOf(i),
                width: m === sel ? 3 : 1.6
            });
        });
        const ticks = modes.map((_, i) => i);
        ticks.step = 1;
        const map = UI.plot(ctx, {
            x: 0,
            y: 0,
            w,
            h
        }, {
            x: {
                min: -X * 1e6,
                max: X * 1e6,
                label: "x",
                unit: "µm"
            },
            y: {
                min: -0.6,
                max: modes.length - 0.4,
                label: "mode order m (offset)",
                ticks,
                format: (v) => String(v)
            },
            series,
            markers: [{
                x: -last.a * 1e6
            }, {
                x: last.a * 1e6
            }],
            legend: false,
            fontSize: fs
        });
        ctx.save();
        ctx.font = fs + "px " + PAL.font;
        modes.forEach((m, i) => {
            if (modes.length > 8 && m !== sel && i % 2) return;
            labelBox(ctx, `${m.label}  n_eff ${m.neff.toFixed(4)}`, map.plot.x + map.plot.w - ctx.measureText(`${m.label}  n_eff ${m.neff.toFixed(4)}`).width - 10, map.yToPx(i + 0.3) - fs / 2, fs, colorOf(i));
        });
        ctx.restore();
        $("imageTitle").textContent = `All guided ${S.pol} modes (${sol.modes.length})`;
        $("imageCaption").textContent = `Every guided ${S.pol} mode, peak-normalised and offset by its order m. Mode m has m zero crossings and a longer evanescent tail; the thick curve is the displayed mode.${sol.modes.length > 14 ? " Showing the first 14." : ""}`;
    }

    function drawLPImage(ctx, w, h, fs) {
        const R = profile.X;
        const N = 121;
        const data = new Float64Array(N * N);
        let mx = 0;
        for (let j = 0; j < N; j++)
            for (let i = 0; i < N; i++) {
                const x = -R + 2 * R * (i + 0.5) / N,
                    y = -R + 2 * R * (j + 0.5) / N;
                let v = W.lpField(sel, Math.hypot(x, y), Math.atan2(y, x));
                if (S.inten) v = v * v;
                data[j * N + i] = v;
                mx = Math.max(mx, Math.abs(v));
            }
        for (let k = 0; k < data.length; k++) data[k] /= mx || 1;
        const cbW = 12,
            gutter = 56;
        const side = Math.min(w - gutter - fs * 4.5, h - fs * 4);
        const rect = {
            x: fs * 3.8,
            y: fs * 0.9,
            w: side,
            h: side
        };
        ctx.fillStyle = PAL.background;
        ctx.fillRect(0, 0, w, h);
        const map = UI.plot(ctx, {
            x: 0,
            y: 0,
            w: rect.x + side + fs * 1.1,
            h: side + fs * 0.9 + fs * 3.4
        }, {
            x: {
                min: -R * 1e6,
                max: R * 1e6,
                label: "x",
                unit: "µm"
            },
            y: {
                min: -R * 1e6,
                max: R * 1e6,
                label: "y",
                unit: "µm"
            },
            series: [],
            fontSize: fs,
            margin: {
                l: rect.x,
                r: fs * 1.1,
                t: fs * 0.9,
                b: fs * 3.4
            }
        });
        const cmap = S.inten ? "inferno" : "diverging";
        UI.imageFromArray(ctx, data, N, N, map.plot, cmap, S.inten ? {
            min: 0,
            max: 1,
            smooth: true
        } : {
            min: -1,
            max: 1,
            smooth: true
        });
        ctx.save();
        ctx.strokeStyle = "rgba(236, 233, 248, 0.8)";
        ctx.setLineDash([5, 4]);
        const c = map.toPx(0, 0),
            rpx = map.xToPx(sel.a * 1e6) - c.x;
        ctx.beginPath();
        ctx.arc(c.x, c.y, rpx, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.restore();
        labelBox(ctx, `${sel.label}  (${sel.vectorModes})`, map.plot.x + 6, map.plot.y + 6, fs);
        UI.drawColorbar(ctx, {
                x: map.plot.x + map.plot.w + 14,
                y: map.plot.y,
                w: cbW,
                h: map.plot.h
            }, cmap,
            S.inten ? {
                min: 0,
                max: 1,
                ticks: [0, 0.5, 1]
            } : {
                min: -1,
                max: 1,
                ticks: [-1, 0, 1]
            });
        $("imageTitle").textContent = `LP mode image: ${sel.label}`;
        $("imageCaption").textContent = `Scalar LP field ψ(r, φ) = J_l(ur/a) cos lφ inside, K_l(wr/a) cos lφ outside (${S.inten ? "intensity |ψ|², inferno" : "signed field, diverging ±peak"}); dashed circle = core (radius a). LP approximation: valid for Δ ≪ 1. Degeneracy ${sel.degeneracy} (orientations × polarizations).`;
    }

    // ------------------------------------------------------------------ canvas 5: b–V diagram
    const bvCache = new Map();

    function bvCurves(geo, Vmax, ratio) {
        const key = geo + "|" + Vmax + "|" + (geo === "slab" ? ratio.toFixed(4) : "");
        if (bvCache.has(key)) return bvCache.get(key);
        const Vs = core.linspace(1e-3, Vmax, 110);
        const curves = [];
        if (geo === "slab") {
            for (let m = 0; m * Math.PI / 2 < Vmax; m++) {
                curves.push({
                    label: "TE" + m,
                    idx: m,
                    ys: W.slabBV(Vs, m, 1),
                    dash: []
                });
                curves.push({
                    label: "TM" + m,
                    idx: m,
                    ys: W.slabBV(Vs, m, ratio),
                    dash: [5, 4],
                    tm: true
                });
            }
        } else {
            W.lpModeList(Vmax).slice(0, 40).forEach((q, i) => curves.push({
                label: W.lpLabel(q.l, q.m),
                idx: i,
                ys: W.lpBV(Vs, q.l, q.m),
                dash: dashOf(i),
                cutoff: q.cutoffV
            }));
        }
        const out = {
            Vs,
            curves
        };
        if (bvCache.size > 24) bvCache.clear();
        bvCache.set(key, out);
        return out;
    }
    let bvMap = null;
    const bvCv = UI.setupCanvas($("bvCanvas"), {
        aspect: 1.45,
        minHeight: 240,
        maxHeight: 420,
        draw(ctx, w, h) {
            if (!sol || !(sol.n1 > sol.n2)) {
                noData(ctx, w, h, "Need n₁ > n₂");
                bvMap = null;
                return;
            }
            const fs = w < 420 ? 11 : 12;
            const V = sol.V;
            const Vmax = Math.max(4, Math.min(16, Math.ceil(V * 1.3)));
            const ratio = (sol.n2 / sol.n1) ** 2;
            const {
                Vs,
                curves
            } = bvCurves(S.geo, Vmax, ratio);
            const series = curves.map((c) => ({
                xs: Vs,
                ys: c.ys,
                color: colorOf(c.idx),
                dash: c.dash,
                width: c.tm ? 1.4 : 1.8
            }));
            const dots = sol.modes.filter((m) => V <= Vmax).map((m) => [V, m.b]);
            if (S.geo === "slab") {
                // the other polarization at the current V
                const other = W.solveSlab(input, S.pol === "TE" ? "TM" : "TE").modes;
                other.forEach((m) => {
                    if (V <= Vmax) dots.push([V, m.b]);
                });
            }
            series.push({
                data: dots,
                pointsOnly: true,
                points: true,
                pointRadius: 4,
                color: PAL.cursor
            });
            const markers = S.geo === "slab" ?
                [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((k) => ({
                    x: k * Math.PI / 2,
                    label: k === 1 ? "π/2" : undefined,
                    color: "rgba(248,212,119,0.55)"
                })) :
                [{
                    x: W.SINGLE_MODE_FIBRE_V,
                    label: "2.405",
                    color: PAL.marker
                }];
            bvMap = UI.plot(ctx, {
                x: 0,
                y: 0,
                w,
                h
            }, {
                x: {
                    min: 0,
                    max: Vmax,
                    label: "V = k₀ a NA"
                },
                y: {
                    min: 0,
                    max: 1,
                    label: "b"
                },
                series,
                markers,
                cursor: V <= Vmax ? {
                    x: V,
                    label: `V = ${V.toFixed(3)}`
                } : null,
                legend: false,
                fontSize: fs
            });
            // curve labels
            ctx.save();
            ctx.font = (fs - 0) + "px " + PAL.font;
            curves.filter((c) => !c.tm).slice(0, S.geo === "slab" ? 8 : 10).forEach((c) => {
                let k = c.ys.findIndex((b) => b > 0.08);
                if (k < 0) return;
                k = Math.min(Vs.length - 1, k + 3);
                const p = bvMap.toPx(Vs[k], c.ys[k]);
                if (!Number.isFinite(p.y)) return;
                ctx.fillStyle = colorOf(c.idx);
                ctx.textAlign = "left";
                ctx.textBaseline = "bottom";
                ctx.fillText(c.label, p.x + 3, p.y - 2);
            });
            if (V > Vmax) labelBox(ctx, `current V = ${V.toFixed(1)} is off-scale (${sol.modes.length} modes)`, bvMap.plot.x + 6, bvMap.plot.y + 6, fs, PAL.warning);
            ctx.restore();
            $("bvBadge").textContent = S.geo === "slab" ? "slab: TE solid, TM dashed" : "LP, universal";
            $("bvCaption").textContent = S.geo === "slab" ?
                "Slab b–V: TE curves (solid) are universal; TM curves (dashed) depend on (n₂/n₁)². Mode m appears at V = mπ/2 (markers). TE0/TM0 have no cut-off. Dots mark the current modes of both polarizations at the current V. Click to set V (changes d)." :
                "Fibre LP b–V (weak guidance, universal). LP11 appears at V = 2.405 = j₀,₁ (marker); below it the fibre is single-mode. Dots mark the current modes. Click to set V (changes d).";
        }
    });
    $("bvCanvas").addEventListener("click", (e) => {
        if (!bvMap || !sol) return;
        const r = e.currentTarget.getBoundingClientRect();
        const px = e.clientX - r.left,
            py = e.clientY - r.top;
        if (!bvMap.contains(px, py)) return;
        const V = Math.max(0.02, bvMap.pxToX(px));
        const d = 2 * V / (sol.k0 * sol.NA) * 1e6;
        setSlider("dSlider", Math.log10(d));
    });

    function setSlider(id, v) {
        const el = $(id);
        el.value = String(Math.min(Number(el.max), Math.max(Number(el.min), v)));
        el.dispatchEvent(new Event("input", {
            bubbles: true
        }));
        el.dispatchEvent(new Event("change", {
            bubbles: true
        }));
    }

    // ------------------------------------------------------------------ sweeps (n_eff, Γ)
    let sweep = null,
        sweepKey = "";

    function computeSweep() {
        const key = [S.geo, S.pol, S.n1, S.n2, S.sweep, S.sweep === "lambda" ? S.d : S.lam, S.sweep === "size" ? S.d : ""].join("|");
        if (key === sweepKey && sweep) return sweep;
        sweepKey = key;
        const nPts = 81;
        const dNow = Math.pow(10, S.d);
        const xs = S.sweep === "lambda" ? core.linspace(400, 2000, nPts) : core.linspace(dNow * 0.02, dNow * 2.5, nPts);
        const inputAt = (x) => S.sweep === "lambda" ? {
            ...input,
            lambda0: x * 1e-9
        } : {
            ...input,
            d: x * 1e-6
        };
        // tracked modes: those guided at the high-V end of the sweep
        const hiInput = S.sweep === "lambda" ? inputAt(400) : inputAt(xs[nPts - 1]);
        let labels;
        if (!(S.n1 > S.n2)) labels = [];
        else if (S.geo === "slab") labels = W.solveSlab(hiInput, S.pol).modes.slice(0, 10).map((m) => m.label);
        else labels = W.lpModeList(W.params(hiInput).V).slice(0, 10).map((q) => W.lpLabel(q.l, q.m));
        if (sel && !labels.includes(sel.label)) labels.push(sel.label);
        const neff = labels.map(() => []),
            gam = labels.map(() => []);
        for (const x of xs) {
            const inp = inputAt(x);
            const s = S.geo === "slab" ? W.solveSlab(inp, S.pol) : W.solveFibre(inp, {
                maxModes: 10,
                tol: 1e-11
            });
            const byLabel = new Map(s.modes.map((m) => [m.label, m]));
            labels.forEach((lab, i) => {
                let m = byLabel.get(lab);
                if (!m && S.geo === "fibre" && sel && lab === sel.label) {
                    const [l, mm] = W.parseLP(lab);
                    const u = W.lpU(W.params(inp).V, l, mm, 1e-11);
                    if (Number.isFinite(u)) m = W.solveFibre(inp).modes.find((q) => q.label === lab);
                }
                neff[i].push(m ? m.neff : NaN);
                gam[i].push(m ? m.confinement : NaN);
            });
        }
        sweep = {
            xs,
            labels,
            neff,
            gam,
            unit: S.sweep === "lambda" ? "nm" : "µm",
            name: S.sweep === "lambda" ? "λ₀" : "d"
        };
        return sweep;
    }
    let sweepMap = null,
        gammaMap = null;
    /** Label each curve at its last finite point (used when the legend would be too long). */
    function endLabels(ctx, map, values, fs) {
        if (!map) return;
        ctx.save();
        ctx.font = fs + "px " + PAL.font;
        ctx.textBaseline = "middle";
        const used = [];
        sweep.labels.forEach((lab, i) => {
            const ys = values[i];
            let k = ys.length - 1;
            while (k >= 0 && !Number.isFinite(ys[k])) k--;
            if (k < 0) return;
            const p = map.toPx(sweep.xs[k], ys[k]);
            const tw = ctx.measureText(lab).width;
            let x = p.x + 4,
                y = p.y - 7;
            if (x + tw > map.plot.x + map.plot.w - 2) x = p.x - tw - 4;
            if (used.some((q) => Math.abs(q[0] - x) < tw && Math.abs(q[1] - y) < fs)) return;
            used.push([x, y]);
            ctx.fillStyle = "rgba(7, 7, 13, 0.75)";
            ctx.fillRect(x - 2, y - fs / 2 - 1, tw + 4, fs + 2);
            ctx.fillStyle = colorOf(i);
            ctx.fillText(lab, x, y);
        });
        ctx.restore();
    }

    function sweepCurrent() {
        return S.sweep === "lambda" ? S.lam : Math.pow(10, S.d);
    }

    function sweepSeries(values) {
        return sweep.labels.map((lab, i) => ({
            xs: sweep.xs,
            ys: values[i],
            label: lab,
            color: colorOf(i),
            dash: dashOf(i),
            width: sel && lab === sel.label ? 3 : 1.8
        }));
    }
    const sweepCv = UI.setupCanvas($("sweepCanvas"), {
        aspect: 1.45,
        minHeight: 240,
        maxHeight: 420,
        draw(ctx, w, h) {
            if (!sweep || !sweep.labels.length) {
                noData(ctx, w, h, "No guided modes");
                sweepMap = null;
                return;
            }
            const fs = w < 420 ? 11 : 12;
            const pad = (S.n1 - S.n2) * 0.06;
            sweepMap = UI.plot(ctx, {
                x: 0,
                y: 0,
                w,
                h
            }, {
                x: {
                    min: sweep.xs[0],
                    max: sweep.xs[sweep.xs.length - 1],
                    label: sweep.name,
                    unit: sweep.unit
                },
                y: {
                    min: S.n2 - pad,
                    max: S.n1 + pad,
                    label: "n_eff"
                },
                series: sweepSeries(sweep.neff),
                hlines: [{
                    y: S.n1,
                    label: "n1"
                }, {
                    y: S.n2,
                    label: "n2"
                }],
                cursor: {
                    x: sweepCurrent(),
                    label: `${sweep.name} = ${fmt(sweepCurrent(), 4)} ${sweep.unit}`
                },
                legend: false,
                fontSize: fs
            });
            endLabels(ctx, sweepMap, sweep.neff, fs);
        }
    });
    const gammaCv = UI.setupCanvas($("gammaCanvas"), {
        aspect: 1.45,
        minHeight: 240,
        maxHeight: 420,
        draw(ctx, w, h) {
            if (!sweep || !sweep.labels.length) {
                noData(ctx, w, h, "No guided modes");
                gammaMap = null;
                return;
            }
            const fs = w < 420 ? 11 : 12;
            gammaMap = UI.plot(ctx, {
                x: 0,
                y: 0,
                w,
                h
            }, {
                x: {
                    min: sweep.xs[0],
                    max: sweep.xs[sweep.xs.length - 1],
                    label: sweep.name,
                    unit: sweep.unit
                },
                y: {
                    min: 0,
                    max: 1.02,
                    label: "Γ (power fraction in core)"
                },
                series: sweepSeries(sweep.gam),
                cursor: {
                    x: sweepCurrent(),
                    label: sel ? `${sel.label}: Γ = ${sel.confinement.toFixed(3)}` : ""
                },
                legend: false,
                fontSize: fs
            });
            endLabels(ctx, gammaMap, sweep.gam, fs);
        }
    });

    function sweepClick(getMap) {
        return (e) => {
            const map = getMap();
            if (!map) return;
            const r = e.currentTarget.getBoundingClientRect();
            const px = e.clientX - r.left,
                py = e.clientY - r.top;
            if (!map.contains(px, py)) return;
            const v = map.pxToX(px);
            if (S.sweep === "lambda") setSlider("lambdaSlider", Math.round(v));
            else setSlider("dSlider", Math.log10(Math.max(0.01, v)));
        };
    }
    $("sweepCanvas").addEventListener("click", sweepClick(() => sweepMap));
    $("gammaCanvas").addEventListener("click", sweepClick(() => gammaMap));

    // ------------------------------------------------------------------ group index vs λ
    let group = null,
        groupKey = "",
        groupMap = null;

    function computeGroup() {
        if (!sel) {
            group = null;
            return;
        }
        const key = [S.geo, S.pol, S.n1, S.n2, S.d, sel.label].join("|");
        if (key === groupKey && group) return;
        groupKey = key;
        const xs = core.linspace(400, 2000, 65);
        const ne = [],
            ng = [];
        for (const L of xs) {
            const g = W.groupIndex(S.geo, {
                ...input,
                lambda0: L * 1e-9
            }, sel.label);
            ne.push(g.neff);
            ng.push(g.ng);
        }
        group = {
            xs,
            ne,
            ng
        };
    }
    const groupCv = UI.setupCanvas($("groupCanvas"), {
        aspect: 1.45,
        minHeight: 240,
        maxHeight: 420,
        draw(ctx, w, h) {
            if (!group) {
                noData(ctx, w, h, "No guided mode");
                groupMap = null;
                return;
            }
            const fs = w < 420 ? 11 : 12;
            const all = group.ne.concat(group.ng).filter(Number.isFinite);
            const lo = Math.min(S.n2, ...all),
                hi = Math.max(S.n1, ...all);
            const pad = (hi - lo) * 0.06 || 0.01;
            groupMap = UI.plot(ctx, {
                x: 0,
                y: 0,
                w,
                h
            }, {
                x: {
                    min: 400,
                    max: 2000,
                    label: "λ₀",
                    unit: "nm"
                },
                y: {
                    min: lo - pad,
                    max: hi + pad,
                    label: "index"
                },
                series: [{
                        xs: group.xs,
                        ys: group.ne,
                        label: `n_eff (${sel.label})`,
                        color: PAL.series[0]
                    },
                    {
                        xs: group.xs,
                        ys: group.ng,
                        label: "n_g",
                        color: PAL.series[1],
                        dash: [7, 4]
                    }
                ],
                hlines: [{
                    y: S.n1
                }, {
                    y: S.n2
                }],
                cursor: {
                    x: S.lam,
                    label: gi ? `n_g = ${fmtFixed(gi.ng, 4)}` : ""
                },
                fontSize: fs
            });
        }
    });
    $("groupCanvas").addEventListener("click", (e) => {
        if (!groupMap) return;
        const r = e.currentTarget.getBoundingClientRect();
        const px = e.clientX - r.left,
            py = e.clientY - r.top;
        if (groupMap.contains(px, py)) setSlider("lambdaSlider", Math.round(groupMap.pxToX(px)));
    });

    // ------------------------------------------------------------------ coupler
    function couplerLc() {
        if (!coup) return {
            Lc: NaN,
            source: ""
        };
        if (S.geo === "slab" && coup.reliable && Number.isFinite(coup.Lc)) return {
            Lc: coup.Lc,
            source: "exact"
        };
        if (Number.isFinite(coup.LcCMT)) return {
            Lc: coup.LcCMT,
            source: "CMT"
        };
        return {
            Lc: NaN,
            source: ""
        };
    }
    const coupleCv = UI.setupCanvas($("coupleCanvas"), {
        aspect: 3.2,
        minHeight: 200,
        maxHeight: 320,
        draw(ctx, w, h) {
            const {
                Lc,
                source
            } = couplerLc();
            if (!Number.isFinite(Lc) || !(Lc > 0)) {
                noData(ctx, w, h, S.geo === "slab" ? "Coupling not available (need a guided fundamental mode)" : "Coupling not available");
                return;
            }
            const fs = w < 520 ? 11 : 12;
            const zMax = 2.4 * Lc;
            const U = lengthUnit(zMax);
            const zs = core.linspace(0, zMax, 400);
            const series = [{
                    xs: zs.map((z) => z * U.s),
                    ys: zs.map((z) => 1 - W.couplerPower(z, Lc)),
                    label: "P₁ (launch guide)",
                    color: PAL.series[0]
                },
                {
                    xs: zs.map((z) => z * U.s),
                    ys: zs.map((z) => W.couplerPower(z, Lc)),
                    label: `P₂ (${source === "exact" ? "exact supermodes" : "coupled-mode theory"})`,
                    color: PAL.series[1],
                    dash: [7, 4]
                }
            ];
            if (S.geo === "slab" && source === "exact" && Number.isFinite(coup.LcCMT)) {
                series.push({
                    xs: zs.map((z) => z * U.s),
                    ys: zs.map((z) => W.couplerPower(z, coup.LcCMT)),
                    label: "P₂ (CMT, TE)",
                    color: PAL.series[2],
                    dash: [2, 3]
                });
            }
            UI.plot(ctx, {
                x: 0,
                y: 0,
                w,
                h
            }, {
                x: {
                    min: 0,
                    max: zMax * U.s,
                    label: "propagation distance z",
                    unit: U.unit
                },
                y: {
                    min: 0,
                    max: 1.05,
                    label: "power fraction"
                },
                series,
                markers: [{
                    x: Lc * U.s,
                    label: "L_c"
                }, {
                    x: 2 * Lc * U.s,
                    label: "2L_c"
                }],
                fontSize: fs
            });
        }
    });

    // ------------------------------------------------------------------ readouts, table, warnings
    const descs = {
        field: UI.describeCanvas($("fieldCanvas"), "Field snapshot of the guided mode", {
            label: "Guided mode field in the x–z plane"
        }),
        ray: UI.describeCanvas($("rayCanvas"), "Ray picture", {
            label: "Zig-zag total internal reflection ray for the displayed mode"
        }),
        prof: UI.describeCanvas($("profileCanvas"), "Transverse profile", {
            label: "Transverse field profile across the guide"
        }),
        img: UI.describeCanvas($("imageCanvas"), "Mode shapes", {
            label: "Guided mode shapes"
        }),
        bv: UI.describeCanvas($("bvCanvas"), "b–V diagram", {
            label: "Normalised propagation constant b versus V"
        }),
        sweep: UI.describeCanvas($("sweepCanvas"), "Effective index sweep", {
            label: "Effective index of each mode versus the swept variable"
        }),
        gamma: UI.describeCanvas($("gammaCanvas"), "Confinement sweep", {
            label: "Guided power fraction in the core versus the swept variable"
        }),
        group: UI.describeCanvas($("groupCanvas"), "Group index", {
            label: "Effective and group index versus wavelength"
        }),
        couple: UI.describeCanvas($("coupleCanvas"), "Coupler", {
            label: "Power exchange between two coupled guides"
        })
    };

    function updateText() {
        const slab = S.geo === "slab";
        const hasGuide = sol && sol.n1 > sol.n2;
        $("warnIndex").hidden = !!hasGuide;
        const delta = hasGuide ? sol.delta : 0;
        const warnLP = $("warnLP");
        if (!slab && delta > 0.05) {
            warnLP.hidden = false;
            warnLP.textContent = `Δ = (n₁² − n₂²)/2n₁² = ${delta.toFixed(3)}: the weakly guiding LP approximation is not reliable at this contrast. True fibre modes are hybrid (HE/EH/TE/TM) with split effective indices, so treat the numbers as qualitative.`;
        } else warnLP.hidden = true;
        document.querySelectorAll('input[name="pol"]').forEach((r) => {
            r.disabled = !slab;
        });
        $("polField").classList.toggle("is-disabled", !slab);
        $("dLabel").textContent = slab ? "Slab thickness d" : "Core diameter d = 2a";
        $("n1Value").textContent = S.n1.toFixed(4);
        $("n2Value").textContent = S.n2.toFixed(4);
        $("dValue").textContent = fmt(Math.pow(10, S.d), 4) + " µm";
        $("lambdaValue").textContent = S.lam + " nm";
        $("gapValue").textContent = fmt(S.gap, 3) + " µm";
        $("fieldBadge").textContent = slab ? `exact slab ${S.pol}` : "LP approximation (φ = 0 / π cut)";
        $("sweepName").textContent = S.sweep === "lambda" ? "λ₀" : "core size d";

        const V = hasGuide ? sol.V : NaN;
        $("statV").textContent = fmtFixed(V, 3);
        $("statNA").textContent = hasGuide ? sol.NA.toFixed(4) : "—";
        if (slab) {
            $("statModes").textContent = hasGuide ? `${sol.modes.length} ${S.pol}` : "0";
            $("statModesLabel").textContent = `Guided ${S.pol} modes (floor(2V/π)+1 = ${hasGuide ? W.slabModeCountEstimate(V) : 0})`;
            $("statCutLabel").textContent = "Single-mode below λ (TE1/TM1 cut-off, V = π/2)";
            $("statCut").textContent = hasGuide ? fmt(2 * sol.d * sol.NA * 1e9, 4) + " nm" : "—";
        } else {
            $("statModes").textContent = hasGuide ? `${sol.lpCount} LP` : "0";
            $("statModesLabel").textContent = hasGuide ? `LP modes (${sol.totalModes} with degeneracy)` : "LP modes";
            $("statCutLabel").textContent = "Single-mode above λc (LP11 cut-off, V = 2.405)";
            $("statCut").textContent = hasGuide ? fmt(2 * Math.PI * sol.a * sol.NA / W.SINGLE_MODE_FIBRE_V * 1e9, 4) + " nm" : "—";
        }
        $("statNeff").textContent = sel ? sel.neff.toFixed(5) : "—";
        $("statNeffLabel").textContent = sel ? `n_eff (${sel.label})` : "n_eff";
        $("statGamma").textContent = sel ? sel.confinement.toFixed(3) : "—";

        const set = (id, t) => {
            $(id).textContent = t;
        };
        set("rV", fmtFixed(V, 4) + (slab ? " (half-thickness)" : " (core radius)"));
        set("rNA", hasGuide ? sol.NA.toFixed(4) : "—");
        set("rAcc", hasGuide ? (sol.NA >= 1 ? "90° (NA ≥ 1)" : (Math.asin(sol.NA) * DEG).toFixed(2) + "°") : "—");
        if (sel) {
            set("rMode", sel.label + (sel.vectorModes ? ` (${sel.vectorModes})` : "") + (sel.nearCutoff ? " — at cut-off" : ""));
            set("rNeff", sel.neff.toFixed(6));
            set("rBeta", (sel.beta * 1e-6).toFixed(5) + " rad/µm");
            set("rB", sel.b.toPrecision(4));
            set("rUW", `${sel.u.toFixed(4)}, ${sel.w.toFixed(4)}`);
            set("rGamma", sel.confinement.toFixed(4));
            set("rDecay", Number.isFinite(sel.decayLength) ? core.formatSI(sel.decayLength, "m") : "∞ (cut-off)");
            set("rTheta", (sel.theta * DEG).toFixed(3) + "°");
            set("rThetaMax", (Math.acos(sel.n2 / sel.n1) * DEG).toFixed(3) + "°");
            if (slab) {
                set("rResLabel", "2k_x d + 2φ_r − 2πm (TIR round trip)");
                set("rRes", sel.resonanceResidual.toExponential(1) + " rad");
            } else {
                set("rResLabel", "Degeneracy (pol. × orientation)");
                set("rRes", String(sel.degeneracy));
            }
            set("rNg", gi && Number.isFinite(gi.ng) ? gi.ng.toFixed(5) : "— (near cut-off)");
            set("rDw", gi && Number.isFinite(gi.Dw) ? (gi.Dw * 1e6).toFixed(3) + " ps/(nm·km)" : "—");
            set("rCut", slab ? `${fmt(sel.cutoffV, 4)} (= ${sel.m}π/2)` : fmt(sel.cutoffV, 5));
        } else {
            ["rMode", "rNeff", "rBeta", "rB", "rUW", "rGamma", "rDecay", "rTheta", "rThetaMax", "rRes", "rNg", "rDw", "rCut"].forEach((id) => set(id, "—"));
        }

        // modal dispersion (1 km)
        if (disp && hasGuide) {
            const L = 1000;
            set("dRay", core.formatSI(disp.rayDelayPerLength * L, "s"));
            const n = sol.modes.length;
            set("dMode", n > 1 ? core.formatSI(disp.modeDelayPerLength * L, "s") + ` (${n} ${slab ? S.pol : "LP"} modes)` : "0 (one mode)");
            set("dSingle", n === 1 ? "0 — single-mode" : "0 if made single-mode");
            const dt = n > 1 ? disp.modeDelayPerLength * L : NaN;
            set("dRate", Number.isFinite(dt) && dt > 0 ? core.formatSI(1 / (2 * dt), "bit/s") : "not modal-limited");
        } else ["dRay", "dMode", "dSingle", "dRate"].forEach((id) => set(id, "—"));
        $("dispCaption").textContent = slab ?
            "Slab: the spread is over the guided modes of the chosen polarization. The ray estimate compares the axial ray with the steepest guided ray. A single-mode guide has no intermodal delay; what remains is chromatic dispersion (D_w above, plus material dispersion, which this tool leaves out)." :
            "The ray estimate (meridional rays) compares the axial ray with the ray at the critical angle; it is meaningful only for V ≫ 1, where many modes fill the ray angles. The mode-based value is the spread of the computed LP group delays. A single-mode fibre has no intermodal delay; what remains is chromatic dispersion (D_w above, plus material dispersion, which this tool leaves out).";

        // coupler readouts
        const {
            Lc,
            source
        } = couplerLc();
        if (S.geo === "slab") {
            $("coupleBadge").textContent = `exact ${S.pol} supermodes${S.pol === "TE" ? " + CMT" : ""}`;
            set("cDB", Number.isFinite(coup.betaEven - coup.betaOdd) ? ((coup.betaEven - coup.betaOdd) * 1e-3).toPrecision(4) + " rad/mm" : "—");
            set("cLc", Number.isFinite(coup.Lc) && coup.reliable ? core.formatSI(coup.Lc, "m") :
                !Number.isFinite(coup.betaOdd) ? "odd supermode not guided" : "beyond double precision");
            set("cLcCMT", S.pol === "TE" && Number.isFinite(coup.LcCMT) ? core.formatSI(coup.LcCMT, "m") : "TE only");
            set("cRatio", S.pol === "TE" && coup.reliable ? (coup.LcCMT / coup.Lc).toFixed(4) : "—");
            $("coupleCaption").textContent = `Two identical slabs (d = ${fmt(Math.pow(10, S.d), 4)} µm) with an edge-to-edge gap of ${fmt(S.gap, 3)} µm. The even and odd five-layer supermodes beat with L_c = π/(β_e − β_o). For TE the dotted curve is the Yariv–Yeh coupled-mode estimate κ = 2k_x²γe^(−γs)/[β(d + 2/γ)(k_x² + γ²)]. P₂ = sin²(πz/2L_c) for phase-matched lossless guides.`;
            if (!Number.isFinite(coup.betaOdd) && Number.isFinite(coup.betaEven)) {
                $("coupleCaption").textContent = "The odd supermode of this pair is cut off, so the two-mode beating picture fails: light launched into one guide partly radiates instead of oscillating. The curve shows the coupled-mode estimate only, which is not trustworthy here.";
            }
        } else {
            $("coupleBadge").textContent = "LP01 coupled-mode theory";
            set("cDB", Number.isFinite(coup.kappaCMT) ? (2 * coup.kappaCMT * 1e-3).toPrecision(4) + " rad/mm (2κ)" : "—");
            set("cLc", "no exact fibre solver here");
            set("cLcCMT", Number.isFinite(coup.LcCMT) ? core.formatSI(coup.LcCMT, "m") : "—");
            set("cRatio", "—");
            $("coupleCaption").textContent = `Two identical weakly guiding fibres with centre separation D = d + s = ${fmt(Math.pow(10, S.d) + S.gap, 4)} µm. Snyder–Love coupled-mode estimate κ = (√(2Δ)/a)(u²/V³)K₀(wD/a)/K₁(w)², L_c = π/2κ. P₂ = sin²(πz/2L_c).`;
        }
        void source;
        void Lc;

        buildTable();

        // canvas descriptions
        if (sel) {
            descs.field.update(`${sel.label} field snapshot: core |x| < ${fmt(profile.aum, 4)} µm, n_eff ${sel.neff.toFixed(5)}, evanescent 1/e depth ${Number.isFinite(sel.decayLength) ? core.formatSI(sel.decayLength, "m") : "infinite"}, ray angle ${(sel.theta * DEG).toFixed(2)} degrees.`);
            descs.ray.update(`Zig-zag ray at ${(sel.theta * DEG).toFixed(2)} degrees to the axis, steepest guided ray ${(Math.acos(sel.n2 / sel.n1) * DEG).toFixed(2)} degrees, acceptance angle in air ${hasGuide && sol.NA < 1 ? (Math.asin(sol.NA) * DEG).toFixed(2) : 90} degrees.`);
            descs.prof.update(`Profile of ${sel.label}: peak-normalised field with ${slab ? sel.m : "radial and azimuthal"} nodes; confinement ${sel.confinement.toFixed(3)}.`);
            descs.img.update(slab ? `${sol.modes.length} guided ${S.pol} modes: ${sol.modes.map((m) => m.label + " n_eff " + m.neff.toFixed(4)).slice(0, 12).join(", ")}.` : `${sel.label} image, ${sel.vectorModes}, degeneracy ${sel.degeneracy}.`);
        } else {
            Object.values(descs).forEach((d) => d.update("No guided mode: the core index must exceed the cladding index."));
        }
        if (hasGuide) {
            descs.bv.update(`b–V diagram, V = ${V.toFixed(3)}; current b values ${sol.modes.slice(0, 10).map((m) => m.label + " " + m.b.toFixed(3)).join(", ")}.`);
            if (sweep && sweep.labels.length) {
                descs.sweep.update(`Effective index versus ${sweep.name} from ${fmt(sweep.xs[0], 3)} to ${fmt(sweep.xs[sweep.xs.length - 1], 4)} ${sweep.unit} for ${sweep.labels.join(", ")}; all curves lie between n2 = ${S.n2} and n1 = ${S.n1}.`);
                descs.gamma.update(`Core power fraction versus ${sweep.name}; current ${sel ? sel.label + " Γ = " + sel.confinement.toFixed(3) : ""}.`);
            }
            if (gi) descs.group.update(`At ${S.lam} nm, ${sel.label}: n_eff ${gi.neff.toFixed(5)}, n_g ${fmtFixed(gi.ng, 5)}, waveguide dispersion ${fmtFixed(gi.Dw * 1e6, 3)} ps per nm per km.`);
            descs.couple.update(Number.isFinite(Lc) ? `Coupling length ${core.formatSI(Lc, "m")} (${source}); full power transfer at z = L_c.` : "Coupling not available.");
        }
    }

    function tableRows() {
        const slab = S.geo === "slab";
        return sol.modes.map((m, i) => {
            const ng = disp ? disp.ngs[i] : NaN;
            const base = [m.label, m.neff, m.beta * 1e-6, m.b, m.u, m.w, m.confinement, m.theta * DEG, m.cutoffV, ng];
            return slab ? base : base.concat([m.degeneracy, m.vectorModes]);
        });
    }

    function tableHeaders() {
        const h = ["mode", "n_eff", "beta (rad/um)", "b", "u", "w", "Gamma", "theta (deg)", "cut-off V", "n_g"];
        return S.geo === "slab" ? h : h.concat(["degeneracy", "vector modes"]);
    }

    function buildTable() {
        const head = $("modeTableHead"),
            body = $("modeTableBody");
        const hd = ["Mode", "n_eff", "β (rad/µm)", "b", "u", "w", "Γ", "θ (°)", "cut-off V", "n_g"].concat(S.geo === "slab" ? [] : ["deg.", "vector modes"]);
        head.innerHTML = hd.map((t) => `<th scope="col">${t}</th>`).join("");
        if (!sol || !sol.modes.length) {
            body.innerHTML = `<tr><td colspan="${hd.length}">No guided modes.</td></tr>`;
            $("modeTableCaption").textContent = "Guided modes";
            return;
        }
        const rows = tableRows();
        const maxRows = 60;
        body.innerHTML = rows.slice(0, maxRows).map((r, i) => {
            const cls = sol.modes[i] === sel ? ' class="is-selected"' : "";
            const cells = r.map((v, k) => {
                if (k === 0) return `<th scope="row">${v}</th>`;
                if (typeof v === "string") return `<td>${v}</td>`;
                const digits = [0, 6, 5, 4, 4, 4, 4, 3, 4, 5, 0][k] ?? 4;
                return `<td>${Number.isFinite(v) ? (k === 10 ? v : v.toFixed(digits)) : "—"}</td>`;
            }).join("");
            return `<tr${cls}>${cells}</tr>`;
        }).join("");
        $("modeTableCaption").textContent = S.geo === "slab" ?
            `Guided ${S.pol} modes of the symmetric slab (${sol.modes.length}; floor(2V/π) + 1 = ${W.slabModeCountEstimate(sol.V)}). n_g from a numerical derivative.` :
            `Guided LP modes (${sol.lpCount} LP, ${sol.totalModes} counting degeneracy; V²/2 ≈ ${Math.round(sol.V * sol.V / 2)})${sol.modes.length > maxRows ? `, showing the first ${maxRows} (CSV has all)` : ""}.`;
    }

    // ------------------------------------------------------------------ render scheduling
    let pending = false;

    function schedule() {
        if (pending) return;
        pending = true;
        requestAnimationFrame(() => {
            pending = false;
            renderAll();
        });
    }

    function renderAll() {
        solve();
        computeSweep();
        computeGroup();
        updateText();
        [fieldCv, rayCv, profCv, imgCv, bvCv, sweepCv, gammaCv, groupCv, coupleCv].forEach((c) => c.redraw());
    }

    // ------------------------------------------------------------------ animation
    const playBtn = $("playBtn");
    const loop = UI.createLoop((dt) => {
        phase = (phase + 2 * Math.PI * 0.5 * dt) % (2 * Math.PI);
        fieldCv.redraw();
    }, {
        onChange: (running) => {
            playBtn.textContent = running ? "⏸ Pause" : "▶ Start";
            playBtn.setAttribute("aria-pressed", String(running));
        }
    });
    playBtn.addEventListener("click", () => loop.toggle());
    $("stepBtn").addEventListener("click", () => {
        loop.stop();
        phase = (phase + Math.PI / 4) % (2 * Math.PI);
        fieldCv.redraw();
    });
    $("resetBtn").addEventListener("click", () => {
        loop.stop();
        phase = 0;
        wantedMode = DEFAULT_MODE;
        ctl.set(DEFAULTS);
        document.querySelectorAll(".wg-presets .preset-option").forEach((b) => b.classList.remove("active"));
        $("presetNote").textContent = "Reset to the default two-mode slab.";
        url.update();
        schedule();
    });

    // ------------------------------------------------------------------ presets
    document.querySelectorAll(".wg-presets .preset-option").forEach((btn) => {
        btn.addEventListener("click", () => {
            const p = PRESETS[btn.dataset.preset];
            if (!p) return;
            wantedMode = p.mode;
            ctl.set(Object.assign({}, DEFAULTS, p.s));
            document.querySelectorAll(".wg-presets .preset-option").forEach((b) => b.classList.toggle("active", b === btn));
            $("presetNote").textContent = p.note;
            url.update();
            schedule();
        });
    });

    // ------------------------------------------------------------------ export
    UI.addExportBar($("exportHost"), {
        name: "waveguides",
        url,
        getState: () => Object.assign(ctl.get(), {
            mode: wantedMode,
            d_um: Math.pow(10, S.d),
            V: sol ? sol.V : null
        }),
        getCSV: () => ({
            headers: tableHeaders(),
            rows: sol ? tableRows() : []
        }),
        canvases: [fieldCv.canvas, rayCv.canvas, profCv.canvas, imgCv.canvas, bvCv.canvas, sweepCv.canvas, gammaCv.canvas, groupCv.canvas, coupleCv.canvas],
        caption: () => `${S.geo === "slab" ? "Symmetric slab " + S.pol : "Step-index fibre (LP)"}: n1 = ${S.n1}, n2 = ${S.n2}, d = ${fmt(Math.pow(10, S.d), 4)} µm, λ0 = ${S.lam} nm, V = ${sol ? sol.V.toFixed(3) : "—"}`
    });

    UI.onThemeChange(() => renderAll());
    renderAll();
    url.ready.then(() => {
        renderAll();
        if (!UI.prefersReducedMotion()) loop.start();
    });
})();