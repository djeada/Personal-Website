/* Electro-/acousto-optic modulators: page glue. Physics lives in ../shared/optics/electroOptics.js. */
(function() {
    "use strict";
    const UI = window.OpticsUI,
        core = window.OpticsModels.core,
        EO = window.OpticsModels.electroOptics;
    const $ = (id) => document.getElementById(id);
    const PAL = UI.CANVAS_PALETTE;
    const SER = PAL.series;
    const fmtSI = (v, u, d = 3) => core.formatSI(v, u, d);
    const fx = (v, n = 3) => (Number.isFinite(v) ? v.toFixed(n) : "—");
    const fp = (v, n = 4) => (Number.isFinite(v) ? Number(v.toPrecision(n)).toString() : "—");
    const pct = (v, n = 1) => (Number.isFinite(v) ? (100 * v).toFixed(n) + " %" : "—");
    const DEG = Math.PI / 180;

    // ------------------------------------------------------------------ defaults & presets
    const DEFAULTS = {
        dev: "pm",
        lam: 1550,
        gap: 10,
        len: 20,
        ovl: 0.5,
        vm: 3,
        fm: 10,
        lg: false,
        bias: -90,
        s2: 1,
        er: 60,
        drv: "sine",
        mvm: 0.5,
        fm2: 10,
        br: 10,
        sw: 1,
        rise: 0.4,
        pcx: "kdp",
        pcv: 0,
        pcd: 2,
        pcl: 20,
        g0: 0,
        ana: "cross",
        aoMat: "TeO2",
        fa: 80,
        aoL: 3,
        aoH: 1,
        pa: 0.5,
        inc: 1,
        lc: 5,
        dl: 5,
        dcv: 0,
        rev: false
    };
    const PRESETS = {
        pmNull: {
            s: {
                dev: "pm",
                vm: 3.94
            },
            note: "β = πV_m/V_π = 2.40 (V_π = 5.15 V): the carrier J₀² drops to ≈ 10⁻⁶. Each first sideband carries 27.0 %, each second 18.6 %; lines stay 10 GHz apart and Σ J_n² = 1."
        },
        pmSmall: {
            s: {
                dev: "pm",
                vm: 0.33,
                lg: true
            },
            note: "β ≈ 0.20: the carrier keeps 98 % and each first sideband ≈ β²/4 = 1.0 % (−20 dB). Higher orders fall ≈ 26 dB per order (J_n ∝ βⁿ)."
        },
        mzmLin: {
            s: {
                dev: "mzm",
                bias: -90,
                s2: 1,
                er: 60,
                drv: "sine",
                mvm: 0.5,
                fm2: 10
            },
            note: "Push-pull, quadrature bias: V_π = 2.58 V, slope π/(2V_π) = 0.61 V⁻¹, HD2 = 0 (odd symmetry) and HD3 ≈ −36 dBc. Chirp α = 0."
        },
        mzmCS: {
            s: {
                dev: "mzm",
                bias: 180,
                s2: 1,
                er: 60,
                drv: "sine",
                mvm: 1.5,
                fm2: 10
            },
            note: "Null bias: the carrier and every even order cancel; the two first-order lines (20 GHz apart) dominate: carrier-suppressed double sideband, used for optical frequency doubling."
        },
        mzmEye: {
            s: {
                dev: "mzm",
                bias: -90,
                s2: 1,
                er: 60,
                drv: "nrz",
                br: 10,
                sw: 1,
                rise: 0.5
            },
            note: "10 Gb/s PRBS7, V_pp = V_π about quadrature, driver rise time 50 ps: “1” ≈ 0.989, “0” ≈ 0.012, eye opening ≈ 0.95, dynamic extinction ≈ 19 dB. Raise the rise time to watch the eye close."
        },
        mzmChirp: {
            s: {
                dev: "mzm",
                bias: -90,
                s2: 0,
                er: 60,
                drv: "sine",
                mvm: 0.5,
                fm2: 10
            },
            note: "Only arm 1 is driven: V_π doubles to 5.15 V and the common phase now follows the drive: |α| = 1 at quadrature. The phasor sum turns as it shrinks."
        },
        pcHalf: {
            s: {
                dev: "pc",
                lam: 1064,
                pcx: "kdp",
                pcv: 1,
                g0: 0,
                ana: "cross"
            },
            note: "Longitudinal KDP at 1064 nm: V_π = λ₀/(2n_o³r₆₃) = 14.7 kV, independent of the crystal size. At V = V_π the cell is a half-wave plate at 45°: x turns into y and T(crossed) = 1."
        },
        pcQuarter: {
            s: {
                dev: "pc",
                lam: 1064,
                pcx: "ln",
                pcd: 2,
                pcl: 20,
                pcv: 0.1,
                g0: 90,
                ana: "cross"
            },
            note: "Transverse LiNbO₃ (2 mm × 20 mm): V_π ≈ 500 V. A λ/4 bias (Γ₀ = 90°) puts the cell at T = 50 % with circular output at V = 0. At V = 0.1 V_π, T = 0.654, close to the linear estimate 0.5 + (π/2)(0.1) = 0.657."
        },
        aoBragg: {
            s: {
                dev: "aom",
                lam: 633,
                aoMat: "TeO2",
                fa: 110,
                aoL: 10,
                aoH: 1,
                pa: 0.58,
                inc: 1
            },
            note: "TeO₂, 110 MHz, L = 10 mm: Q ≈ 12 (Bragg). Only orders 0 and +1 matter; θ_B = 8.3 mrad in air, order +1 shifted by +110 MHz. P_a = P₁₀₀ = 0.58 W sends ≈ 96 % into order +1 (sin²(ν/2) = 1 for Q → ∞)."
        },
        aoRN: {
            s: {
                dev: "aom",
                lam: 633,
                aoMat: "TeO2",
                fa: 20,
                aoL: 1,
                aoH: 1,
                pa: 3.4,
                inc: 0
            },
            note: "20 MHz, L = 1 mm: Q ≈ 0.04 (thin grating). Normal incidence gives a symmetric fan of orders with powers J_m²(ν), ν ≈ 2.4, so the zero order is nearly empty. Order m is shifted by m·20 MHz."
        },
        dcFull: {
            s: {
                dev: "dc",
                lc: 5,
                dl: 5,
                dcv: 0,
                rev: false
            },
            note: "Phase-matched, L = L_c = 5 mm: all power crosses to guide 2 at the output; P₁ + P₂ = 1 everywhere."
        },
        dcMis: {
            s: {
                dev: "dc",
                lc: 5,
                dl: 20,
                dcv: 10.3,
                rev: false
            },
            note: "V = 10.3 V makes Δβ = 2κ: at most 1/(1+1) = 50 % ever reaches guide 2, and the beat length shortens by √2."
        },
        dcSwitch: {
            s: {
                dev: "dc",
                lc: 5,
                dl: 5,
                dcv: 17.85,
                rev: false
            },
            note: "Δβ = √3π/L_c (V ≈ 17.9 V): g L_c = π, so the light returns to guide 1: electro-optic switch from cross to bar."
        },
        dcRev: {
            s: {
                dev: "dc",
                lc: 5,
                dl: 10,
                dcv: 8.23,
                rev: true
            },
            note: "L = 2L_c is in the bar state at V = 0 and a uniform electrode can never reach full cross (dashed vs solid curve). With Δβ-reversal, V ≈ 8.2 V gives P₂ ≈ 1 (cross state)."
        }
    };

    // ------------------------------------------------------------------ controls
    UI.enhanceSlider($("lamSlider"), {
        unit: "nm",
        label: "Vacuum wavelength"
    });
    UI.enhanceSlider($("gapSlider"), {
        unit: "µm",
        label: "Electrode gap"
    });
    UI.enhanceSlider($("lenSlider"), {
        unit: "mm",
        label: "Electrode length"
    });
    UI.enhanceSlider($("ovlSlider"), {
        label: "Overlap factor"
    });
    UI.enhanceSlider($("vmSlider"), {
        unit: "V",
        label: "Phase modulator drive amplitude"
    });
    UI.enhanceSlider($("fmSlider"), {
        unit: "GHz",
        label: "Modulation frequency"
    });
    UI.enhanceSlider($("biasSlider"), {
        unit: "°",
        label: "MZM bias phase"
    });
    UI.enhanceSlider($("s2Slider"), {
        label: "Arm 2 drive weight"
    });
    UI.enhanceSlider($("erSlider"), {
        unit: "dB",
        label: "Static extinction ratio"
    });
    UI.enhanceSlider($("mvmSlider"), {
        unit: "V",
        label: "MZM sine amplitude"
    });
    UI.enhanceSlider($("fm2Slider"), {
        unit: "GHz",
        label: "MZM modulation frequency"
    });
    UI.enhanceSlider($("brSlider"), {
        unit: "Gb/s",
        label: "Bit rate"
    });
    UI.enhanceSlider($("swSlider"), {
        unit: "×Vπ",
        label: "Drive swing"
    });
    UI.enhanceSlider($("riseSlider"), {
        unit: "UI",
        label: "Rise time"
    });
    UI.enhanceSlider($("pcvSlider"), {
        unit: "×Vπ",
        label: "Pockels cell voltage"
    });
    UI.enhanceSlider($("pcdSlider"), {
        unit: "mm",
        label: "Crystal thickness"
    });
    UI.enhanceSlider($("pclSlider"), {
        unit: "mm",
        label: "Crystal length"
    });
    UI.enhanceSlider($("g0Slider"), {
        unit: "°",
        label: "Static retardation"
    });
    UI.enhanceSlider($("faSlider"), {
        unit: "MHz",
        label: "Acoustic frequency"
    });
    UI.enhanceSlider($("aoLSlider"), {
        unit: "mm",
        label: "Interaction length"
    });
    UI.enhanceSlider($("aoHSlider"), {
        unit: "mm",
        label: "Transducer height"
    });
    UI.enhanceSlider($("paSlider"), {
        unit: "W",
        label: "Acoustic power"
    });
    UI.enhanceSlider($("incSlider"), {
        unit: "θB",
        label: "Incidence angle"
    });
    UI.enhanceSlider($("lcSlider"), {
        unit: "mm",
        label: "Coupling length"
    });
    UI.enhanceSlider($("dlSlider"), {
        unit: "mm",
        label: "Device length"
    });
    UI.enhanceSlider($("dcvSlider"), {
        unit: "V",
        label: "Coupler voltage"
    });

    const ctl = UI.bindControls({
        dev: "radio:dev",
        lam: "#lamSlider",
        gap: "#gapSlider",
        len: "#lenSlider",
        ovl: "#ovlSlider",
        vm: "#vmSlider",
        fm: "#fmSlider",
        lg: "#logBox",
        bias: "#biasSlider",
        s2: "#s2Slider",
        er: "#erSlider",
        drv: "radio:drv",
        mvm: "#mvmSlider",
        fm2: "#fm2Slider",
        br: "#brSlider",
        sw: "#swSlider",
        rise: "#riseSlider",
        pcx: "radio:pcx",
        pcv: "#pcvSlider",
        pcd: "#pcdSlider",
        pcl: "#pclSlider",
        g0: "#g0Slider",
        ana: "radio:ana",
        aoMat: "#aoMatSel",
        fa: "#faSlider",
        aoL: "#aoLSlider",
        aoH: "#aoHSlider",
        pa: "#paSlider",
        inc: "#incSlider",
        lc: "#lcSlider",
        dl: "#dlSlider",
        dcv: "#dcvSlider",
        rev: "#revBox"
    }, () => {
        url.update();
        schedule();
    });
    const url = UI.urlState({
        get: ctl.get,
        set: (o) => {
            ctl.set(o);
            schedule();
        }
    });

    // ------------------------------------------------------------------ state + model evaluation
    let S = ctl.get();
    let R = {}; // derived results for the current device
    let ph = 0; // animation phase (fraction of a drive period)
    let pending = false;

    function schedule() {
        if (pending) return;
        pending = true;
        requestAnimationFrame(() => {
            pending = false;
            render();
        });
    }

    function geometry() {
        const lambda0 = S.lam * 1e-9;
        const n = EO.lnbIndex(lambda0);
        return {
            lambda0,
            n: n.ne,
            no: n.no,
            r: EO.MATERIALS.LiNbO3.r33,
            d: S.gap * 1e-6,
            L: S.len * 1e-3,
            overlap: S.ovl
        };
    }

    function mzmP() {
        const g = geometry();
        return {
            VpiPM: EO.vPiPhase(g),
            s1: 1,
            s2: S.s2,
            bias: S.bias * DEG,
            erDb: S.er >= 60 ? Infinity : S.er
        };
    }

    function computePM() {
        const g = geometry();
        const Vpi = EO.vPiPhase(g),
            beta = Math.PI * S.vm / Vpi,
            fm = S.fm * 1e9;
        const sb = EO.pmSidebands(beta, fm);
        const bw = EO.pmBandwidth(beta, fm);
        return {
            g,
            Vpi,
            beta,
            fm,
            sb,
            bw,
            sum: sb.reduce((s, x) => s + x.power, 0)
        };
    }

    function computeMZM() {
        const p = mzmP();
        const q = EO.mzmParams(p);
        const at0 = EO.mzmFields(q, 0);
        const out = {
            p,
            q,
            at0,
            slope: EO.mzmSlope(p, 0),
            chirp: q.r === 0.5 ? EO.mzmChirp(p, 0) : EO.mzmChirpNumeric(p, 0)
        };
        const pmax = Math.max(EO.mzmTransfer(q, 0 - q.bias / Math.PI * q.Vpi), 1e-300);
        const pmin = EO.mzmTransfer(q, q.Vpi - q.bias / Math.PI * q.Vpi);
        out.staticER = pmin > 1e-15 ? 10 * Math.log10(pmax / pmin) : Infinity;
        if (S.drv === "sine") {
            const fm = S.fm2 * 1e9;
            out.fm = fm;
            out.sb = EO.mzmSidebands(p, S.mvm, fm);
            out.harm = EO.mzmHarmonics(p, S.mvm);
            out.excursion = [-S.mvm, S.mvm];
        } else {
            out.eye = EO.mzmEye(p, {
                swing: S.sw * q.Vpi,
                riseFrac: S.rise,
                spb: 32
            });
            out.excursion = [-S.sw * q.Vpi / 2, S.sw * q.Vpi / 2];
        }
        return out;
    }

    function computePC() {
        const lambda0 = S.lam * 1e-9;
        const Vpi = S.pcx === "kdp" ? EO.vPiKDP(lambda0) : EO.vPiTransverseAmplitude({
            lambda0,
            d: S.pcd * 1e-3,
            L: S.pcl * 1e-3
        });
        const V = S.pcv * Vpi;
        const res = EO.pockelsCell({
            V,
            Vpi,
            gamma0: S.g0 * DEG
        });
        return {
            lambda0,
            Vpi,
            V,
            res,
            idx: EO.lnbIndex(lambda0)
        };
    }

    let aoCache = {
        key: "",
        pw: null,
        qs: null
    };

    function computeAO() {
        const m = EO.MATERIALS.ao[S.aoMat] || EO.MATERIALS.ao.TeO2;
        const p = {
            lambda0: S.lam * 1e-9,
            fa: S.fa * 1e6,
            v: m.v,
            n: m.n,
            M2: m.M2,
            L: S.aoL * 1e-3,
            H: S.aoH * 1e-3,
            Pa: S.pa
        };
        const a = EO.aom(p);
        const ord = EO.aomOrders(a.nu, a.Q, S.inc);
        const i1 = ord.orders.indexOf(1);
        const key = [S.lam, S.aoMat, S.fa, S.aoL, S.aoH, S.inc].join("|");
        const keyQ = key + "|" + a.nu.toFixed(6);
        // efficiency vs power (current Q, a)
        const Pmax = Math.max(1.5 * a.P100, 1.2 * S.pa, 0.05);
        if (aoCache.key !== key || aoCache.Pmax !== Pmax) {
            const Ps = [],
                num = [],
                bragg = [],
                thin = [];
            for (let i = 0; i <= 48; i++) {
                const P = Pmax * i / 48;
                const aa = EO.aom({
                    ...p,
                    Pa: P
                });
                const o = EO.aomOrders(aa.nu, aa.Q, S.inc, {
                    M: Math.ceil(aa.nu) + 6
                });
                Ps.push(P);
                num.push(o.power[o.orders.indexOf(1)]);
                bragg.push(aa.etaBragg);
                thin.push(core.besselJ(1, aa.nu) ** 2);
            }
            aoCache.key = key;
            aoCache.Pmax = Pmax;
            aoCache.pw = {
                Ps,
                num,
                bragg,
                thin
            };
        }
        if (aoCache.keyQ !== keyQ) {
            const Qs = [],
                rows = {
                    m0: [],
                    p1: [],
                    m1: [],
                    p2: []
                };
            for (let i = 0; i <= 60; i++) {
                const Q = Math.pow(10, -1.3 + 3.6 * i / 60);
                const o = EO.aomOrders(a.nu, Q, S.inc, {
                    M: Math.ceil(a.nu) + 6
                });
                const at = (k) => o.power[o.orders.indexOf(k)];
                Qs.push(Q);
                rows.m0.push(at(0));
                rows.p1.push(at(1));
                rows.m1.push(at(-1));
                rows.p2.push(at(2));
            }
            aoCache.keyQ = keyQ;
            aoCache.qs = {
                Qs,
                rows
            };
        }
        return {
            m,
            p,
            a,
            ord,
            eta1: ord.power[i1],
            sum: ord.power.reduce((s, x) => s + x, 0),
            pw: aoCache.pw,
            qs: aoCache.qs
        };
    }

    function computeDC() {
        const g = geometry();
        const Lc = S.lc * 1e-3,
            L = S.dl * 1e-3,
            kappa = Math.PI / (2 * Lc);
        const perV = EO.dbetaFromVoltage(g, 1);
        const dbeta = perV * S.dcv;
        const c = EO.coupler({
            kappa,
            dbeta,
            L,
            reversal: S.rev
        });
        const prop = EO.couplerPropagate({
            kappa,
            dbeta,
            L,
            reversal: S.rev
        }, 401);
        const Vbar = Math.sqrt(3) * Math.PI / Lc / perV;
        const Vr = Math.max(60, Math.abs(S.dcv) * 1.1);
        const Vs = [],
            Pu = [],
            Pr = [];
        for (let i = 0; i <= 240; i++) {
            const V = -Vr + 2 * Vr * i / 240;
            Vs.push(V);
            Pu.push(EO.coupler({
                kappa,
                dbeta: perV * V,
                L
            }).P2);
            Pr.push(EO.coupler({
                kappa,
                dbeta: perV * V,
                L,
                reversal: true
            }).P2);
        }
        return {
            g,
            Lc,
            L,
            kappa,
            perV,
            dbeta,
            c,
            prop,
            Vbar,
            sweep: {
                Vs,
                Pu,
                Pr
            }
        };
    }

    // ------------------------------------------------------------------ drawing helpers
    function stems(xs, ys, base) {
        const X = [],
            Y = [];
        xs.forEach((x, i) => {
            X.push(x, x, NaN);
            Y.push(base, ys[i], NaN);
        });
        return {
            xs: X,
            ys: Y
        };
    }
    const dB = (p, floor = -60) => (p > 0 ? Math.max(floor, 10 * Math.log10(p)) : floor);

    function text(ctx, s, x, y, opts = {}) {
        ctx.save();
        ctx.font = (opts.weight ? opts.weight + " " : "") + (opts.size || 12) + "px " + PAL.font;
        ctx.fillStyle = opts.color || PAL.text;
        ctx.textAlign = opts.align || "left";
        ctx.textBaseline = opts.baseline || "middle";
        ctx.fillText(s, x, y);
        ctx.restore();
    }

    function arrow(ctx, x0, y0, x1, y1, color, width = 2.5, dash) {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = width;
        if (dash) ctx.setLineDash(dash);
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
        ctx.setLineDash([]);
        const a = Math.atan2(y1 - y0, x1 - x0),
            L = Math.hypot(x1 - x0, y1 - y0);
        if (L > 6) {
            const h = Math.min(10, L * 0.4);
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x1 - h * Math.cos(a - 0.4), y1 - h * Math.sin(a - 0.4));
            ctx.lineTo(x1 - h * Math.cos(a + 0.4), y1 - h * Math.sin(a + 0.4));
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();
    }

    function bg(ctx, w, h) {
        ctx.fillStyle = PAL.background;
        ctx.fillRect(0, 0, w, h);
    }

    /** Line spectrum (stems) with order labels. lines: [{offset (GHz), power, n}] */
    function drawSpectrum(ctx, w, h, lines, opts) {
        bg(ctx, w, h);
        const log = !!S.lg;
        const floor = -60;
        const xs = lines.map((l) => l.offset),
            ys = lines.map((l) => (log ? dB(l.power, floor) : l.power));
        const span = Math.max(...xs.map(Math.abs), opts.minSpan || 1);
        const xr = span * 1.08;
        const base = log ? floor : 0;
        const st = stems(xs, ys, base);
        const map = UI.plot(ctx, {
            x: 0,
            y: 0,
            w,
            h
        }, {
            x: {
                min: -xr,
                max: xr,
                label: "Offset from carrier ν − ν₀",
                unit: "GHz"
            },
            y: log ? {
                min: floor,
                max: 3,
                label: "Line power",
                unit: "dB"
            } : {
                min: 0,
                max: Math.max(0.05, Math.max(...ys) * 1.18),
                label: "Line power / P_in"
            },
            series: [{
                ...st,
                width: 3,
                color: SER[0]
            }, {
                xs,
                ys,
                pointsOnly: true,
                points: true,
                pointRadius: 3.5,
                color: SER[0]
            }],
            markers: opts.markers || [],
            legend: false
        });
        // order labels
        const pxStep = lines.length > 1 ? Math.abs(map.xToPx(lines[1].offset) - map.xToPx(lines[0].offset)) : 99;
        if (pxStep > 15) {
            lines.forEach((l, i) => {
                const y = ys[i];
                if ((log ? y > floor + 1 : l.power > 0.004)) text(ctx, String(l.n), map.xToPx(l.offset), map.yToPx(y) - 9, {
                    align: "center",
                    size: 11,
                    color: PAL.textMuted
                });
            });
        }
        return map;
    }

    // ------------------------------------------------------------------ canvases
    const cv = {};
    const desc = {};

    function canvas(id, aspect, draw, label, minHeight = 220) {
        const el = $(id);
        desc[id] = UI.describeCanvas(el, label, {
            label
        });
        const key = {
            pm: "pm",
            mzm: "mzm",
            pc: "pc",
            ao: "ao",
            dc: "dc"
        } [id.match(/^(mzm|pm|pc|ao|dc)/)[1]];
        cv[id] = UI.setupCanvas(el, {
            aspect,
            minHeight,
            draw: (ctx, w, h) => {
                if (R && R[key]) draw(ctx, w, h);
                else bg(ctx, w, h);
            }
        });
        el.dataset.exportName = id.replace("Canvas", "");
        return cv[id];
    }

    // ---- phase modulator
    canvas("pmSpecCanvas", 2.6, (ctx, w, h) => {
        const r = R.pm;
        const lines = r.sb.filter((x) => Math.abs(x.n) <= Math.ceil(r.beta) + 4).map((x) => ({
            n: x.n,
            offset: x.offset / 1e9,
            power: x.power
        }));
        const c = r.bw.carson / 2 / 1e9;
        drawSpectrum(ctx, w, h, lines, {
            minSpan: 3 * S.fm,
            markers: [{
                x: -c,
                label: "Carson",
                color: PAL.textMuted
            }, {
                x: c,
                color: PAL.textMuted
            }]
        });
    }, "Phase-modulation line spectrum");
    canvas("pmBesselCanvas", 1.5, (ctx, w, h) => {
        bg(ctx, w, h);
        const bmax = Math.max(6, R.pm.beta * 1.15);
        const xs = core.linspace(0, bmax, 300);
        const series = [0, 1, 2, 3].map((n) => ({
            xs,
            ys: Array.from(xs, (b) => core.besselJ(n, b) ** 2),
            label: "J" + "₀₁₂₃" [n] + "²",
            dash: PAL.dashes[n]
        }));
        UI.plot(ctx, {
            x: 0,
            y: 0,
            w,
            h
        }, {
            x: {
                min: 0,
                max: bmax,
                label: "Modulation index β",
                unit: "rad"
            },
            y: {
                min: 0,
                max: 1.05,
                label: "Power fraction"
            },
            series,
            cursor: {
                x: R.pm.beta,
                label: "β = " + R.pm.beta.toFixed(3)
            },
            markers: [{
                x: 2.404825557695773,
                label: "J₀ = 0"
            }]
        });
    }, "Bessel sideband powers versus modulation index");
    canvas("pmPhasorCanvas", 1.5, (ctx, w, h) => {
        bg(ctx, w, h);
        const r = R.pm;
        const sq = Math.min(h, w * 0.45);
        const cx0 = sq / 2 + 4,
            cy0 = h / 2,
            rad = Math.max(8, sq / 2 - 26);
        ctx.strokeStyle = PAL.gridStrong;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx0, cy0, rad, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx0 - rad - 8, cy0);
        ctx.lineTo(cx0 + rad + 8, cy0);
        ctx.moveTo(cx0, cy0 - rad - 8);
        ctx.lineTo(cx0, cy0 + rad + 8);
        ctx.stroke();
        // swing arc ±β
        const b = Math.min(Math.PI, r.beta);
        ctx.strokeStyle = PAL.textMuted;
        ctx.lineWidth = 5;
        ctx.globalAlpha = 0.45;
        ctx.beginPath();
        ctx.arc(cx0, cy0, rad, -b, b);
        ctx.stroke();
        ctx.globalAlpha = 1;
        const phi = r.beta * Math.sin(2 * Math.PI * ph);
        arrow(ctx, cx0, cy0, cx0 + rad * Math.cos(phi), cy0 - rad * Math.sin(phi), SER[0], 3);
        text(ctx, "Re a", cx0 + rad + 6, cy0 + 12, {
            size: 11,
            color: PAL.textMuted,
            align: "right"
        });
        text(ctx, "Im a", cx0 + 6, cy0 - rad - 2, {
            size: 11,
            color: PAL.textMuted
        });
        text(ctx, "φ = " + phi.toFixed(2) + " rad", 8, 14, {
            size: 12
        });
        // φ(t) plot on the right
        const ts = core.linspace(0, 2, 200);
        UI.plot(ctx, {
            x: sq + 6,
            y: 0,
            w: w - sq - 6,
            h
        }, {
            x: {
                min: 0,
                max: 2,
                label: "t · f_m"
            },
            y: {
                min: -Math.max(0.5, r.beta) * 1.15,
                max: Math.max(0.5, r.beta) * 1.15,
                label: "φ(t)",
                unit: "rad"
            },
            series: [{
                xs: ts,
                ys: Array.from(ts, (t) => r.beta * Math.sin(2 * Math.PI * t)),
                color: SER[0]
            }],
            cursor: {
                x: ph % 1 + (Math.floor(ph) % 2),
                color: PAL.cursor
            },
            legend: false,
            background: true
        });
    }, "Animated field phasor of the phase modulator", 200);

    // ---- MZM
    canvas("mzmTfCanvas", 1.5, (ctx, w, h) => {
        bg(ctx, w, h);
        const r = R.mzm,
            q = r.q;
        const X = 2 * q.Vpi;
        const xs = core.linspace(-X, X, 400);
        const P2 = Array.from(xs, (v) => EO.mzmFields(q, v).P2),
            P1 = P2.map((v) => 1 - v);
        UI.plot(ctx, {
            x: 0,
            y: 0,
            w,
            h
        }, {
            x: {
                min: -X,
                max: X,
                label: "Drive voltage V",
                unit: "V"
            },
            y: {
                min: 0,
                max: 1.05,
                label: "P_out / P_in"
            },
            series: [{
                xs,
                ys: P2,
                label: "main port"
            }, {
                xs,
                ys: P1,
                label: "other port",
                dash: [7, 4]
            }],
            markers: [{
                x: r.excursion[0],
                color: PAL.marker
            }, {
                x: r.excursion[1],
                color: PAL.marker
            }],
            cursor: {
                x: 0,
                label: "bias: " + fx(r.at0.P2, 3)
            },
            legendPosition: "left"
        });
    }, "MZM transfer curve");

    function mzmDriveAt(t) { // t in drive periods (sine) or displayed bits (nrz)
        const r = R.mzm;
        if (S.drv === "sine") return S.mvm * Math.sin(2 * Math.PI * t);
        const e = r.eye,
            spb = e.spb,
            n = e.drive.length;
        const i = Math.floor(t * spb) % n;
        return e.drive[(i + n) % n];
    }
    canvas("mzmPhasorCanvas", 1.5, (ctx, w, h) => {
        bg(ctx, w, h);
        const r = R.mzm,
            q = r.q;
        const t = S.drv === "sine" ? ph : ph * 8;
        const V = mzmDriveAt(t);
        const f = EO.mzmFields(q, V);
        const a1 = core.complex.scale(core.complex.expi(f.phi1), Math.sqrt(q.r));
        const a2 = core.complex.scale(core.complex.expi(f.phi2), Math.sqrt(1 - q.r));
        const sum = core.complex.add(a1, a2),
            dif = core.complex.sub(a1, a2);
        const cx0 = w * 0.36,
            cy0 = h / 2,
            rad = Math.max(8, Math.min(h / 2 - 22, w * 0.3));
        ctx.strokeStyle = PAL.gridStrong;
        ctx.lineWidth = 1;
        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(cx0, cy0, rad / 1.45 * Math.SQRT2, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.restore();
        ctx.beginPath();
        ctx.moveTo(cx0 - rad * 1.45, cy0);
        ctx.lineTo(cx0 + rad * 1.45, cy0);
        ctx.moveTo(cx0, cy0 - rad - 8);
        ctx.lineTo(cx0, cy0 + rad + 8);
        ctx.stroke();
        const sc = rad / 1.45; // |sum| ≤ √2 fits inside the circle
        const P = (z) => [cx0 + sc * z.re, cy0 - sc * z.im];
        const [x1, y1] = P(a1), [x2, y2] = P(a2), [xs, ys] = P(sum);
        arrow(ctx, cx0, cy0, x1, y1, SER[0], 2.5);
        arrow(ctx, cx0, cy0, x2, y2, SER[2], 2.5);
        ctx.save();
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = PAL.textMuted;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(xs, ys);
        ctx.stroke();
        ctx.restore();
        arrow(ctx, cx0, cy0, xs, ys, SER[1], 3.5);
        const [xd, yd] = P(dif);
        arrow(ctx, cx0, cy0, xd, yd, SER[3], 2, [6, 4]);
        const lx = Math.min(w - 150, cx0 + rad * 1.1 + 8);
        const rows = [
            ["arm 1", SER[0]],
            ["arm 2", SER[2]],
            ["sum → main " + fx(f.P2, 3), SER[1]],
            ["diff → other " + fx(f.P1, 3), SER[3]]
        ];
        rows.forEach(([s, c], i) => text(ctx, s, Math.max(lx, 8), 16 + i * 17, {
            size: 12,
            color: c
        }));
        text(ctx, "V = " + fp(V, 3) + " V", 8, h - 14, {
            size: 12
        });
        text(ctx, "dashed circle: |a₁ + a₂| = √2", w - 8, h - 14, {
            size: 11,
            color: PAL.textMuted,
            align: "right"
        });
    }, "Animated MZM arm phasors", 200);
    canvas("mzmTimeCanvas", 2.8, (ctx, w, h) => {
        bg(ctx, w, h);
        const r = R.mzm,
            q = r.q;
        let ts, V, P, xlab, xmax, cur;
        if (S.drv === "sine") {
            ts = core.linspace(0, 2, 400);
            V = Array.from(ts, (t) => S.mvm * Math.sin(2 * Math.PI * t));
            P = V.map((v) => EO.mzmFields(q, v).P2);
            const T = 1 / S.fm2; // ns
            ts = Array.from(ts, (t) => t * T * 1e3);
            xlab = "Time";
            xmax = 2 * T * 1e3;
            cur = (ph % 2) * T * 1e3;
        } else {
            const e = r.eye,
                nb = 24,
                spb = e.spb,
                Tb = 1 / S.br * 1e3; // ps
            ts = [];
            V = [];
            P = [];
            for (let i = 0; i < nb * spb; i++) {
                ts.push(i / spb * Tb);
                V.push(e.drive[i]);
                P.push(e.power[i]);
            }
            xlab = "Time";
            xmax = nb * Tb;
            cur = (ph * 8 % nb) * Tb;
        }
        const hTop = Math.round(h * 0.42);
        const vmax = Math.max(0.1, ...V.map(Math.abs)) * 1.2;
        UI.plot(ctx, {
            x: 0,
            y: 0,
            w,
            h: hTop
        }, {
            x: {
                min: 0,
                max: xmax,
                label: ""
            },
            y: {
                min: -vmax,
                max: vmax,
                label: "V(t)",
                unit: "V"
            },
            series: [{
                xs: ts,
                ys: V,
                color: SER[1]
            }],
            cursor: {
                x: cur
            },
            legend: false,
            margin: {
                b: 22
            }
        });
        UI.plot(ctx, {
            x: 0,
            y: hTop,
            w,
            h: h - hTop
        }, {
            x: {
                min: 0,
                max: xmax,
                label: xlab,
                unit: "ps"
            },
            y: {
                min: 0,
                max: 1.05,
                label: "P/P_in"
            },
            series: [{
                xs: ts,
                ys: P,
                color: SER[0]
            }],
            cursor: {
                x: cur
            },
            legend: false
        });
    }, "Drive voltage and detected power versus time", 300);
    canvas("mzmSpecCanvas", 2.6, (ctx, w, h) => {
        const r = R.mzm;
        if (!r.sb) {
            bg(ctx, w, h);
            return;
        }
        const N = Math.ceil(Math.PI * S.mvm / r.q.VpiPM * Math.max(1, S.s2)) + 4;
        const lines = r.sb.filter((x) => Math.abs(x.n) <= Math.max(4, N)).map((x) => ({
            n: x.n,
            offset: x.offset / 1e9,
            power: x.power2
        }));
        drawSpectrum(ctx, w, h, lines, {
            minSpan: 3 * S.fm2
        });
    }, "MZM main-port optical spectrum");
    canvas("mzmEyeCanvas", 2.4, (ctx, w, h) => {
        bg(ctx, w, h);
        const e = R.mzm.eye;
        if (!e) return;
        const Tb = 1 / S.br * 1e3;
        const map = UI.plot(ctx, {
            x: 0,
            y: 0,
            w,
            h
        }, {
            x: {
                min: 0,
                max: 2 * Tb,
                label: "Time within two bit periods",
                unit: "ps"
            },
            y: {
                min: -0.05,
                max: 1.1,
                label: "P/P_in"
            },
            series: [],
            markers: [{
                x: 0.5 * Tb,
                label: "sample"
            }, {
                x: 1.5 * Tb
            }],
            legend: false,
            hlines: [{
                y: e.levels.mean1,
                color: PAL.gridStrong
            }, {
                y: e.levels.mean0,
                color: PAL.gridStrong
            }]
        });
        const P = map.plot,
            spb = e.spb,
            nb = e.bits.length,
            n = e.power.length;
        ctx.save();
        ctx.beginPath();
        ctx.rect(P.x, P.y, P.w, P.h);
        ctx.clip();
        ctx.strokeStyle = SER[0];
        ctx.globalAlpha = 0.28;
        ctx.lineWidth = 1.4;
        for (let b = 0; b < nb; b++) {
            ctx.beginPath();
            for (let k = 0; k <= 2 * spb; k++) {
                const v = e.power[(b * spb + k) % n];
                const x = map.xToPx(k / spb * Tb),
                    y = map.yToPx(v);
                if (k) ctx.lineTo(x, y);
                else ctx.moveTo(x, y);
            }
            ctx.stroke();
        }
        ctx.restore();
        // eye-opening bar at the sampling instant
        const xo = map.xToPx(0.5 * Tb) + 6;
        arrow(ctx, xo, map.yToPx(e.levels.maxLow), xo, map.yToPx(e.levels.minHigh), PAL.marker, 1.5);
        text(ctx, "opening " + fx(e.opening, 3), xo + 6, map.yToPx((e.levels.maxLow + e.levels.minHigh) / 2), {
            size: 12,
            color: PAL.marker
        });
    }, "Eye diagram");

    // ---- Pockels cell
    canvas("pcTfCanvas", 1.5, (ctx, w, h) => {
        bg(ctx, w, h);
        const r = R.pc;
        const xs = core.linspace(-2, 2, 400);
        const g0 = S.g0 * DEG;
        UI.plot(ctx, {
            x: 0,
            y: 0,
            w,
            h
        }, {
            x: {
                min: -2,
                max: 2,
                label: "V / V_π"
            },
            y: {
                min: 0,
                max: 1.05,
                label: "Transmission"
            },
            series: [{
                    xs,
                    ys: Array.from(xs, (v) => Math.sin((g0 + Math.PI * v) / 2) ** 2),
                    label: "crossed",
                    width: S.ana === "cross" ? 3 : 1.5
                },
                {
                    xs,
                    ys: Array.from(xs, (v) => Math.cos((g0 + Math.PI * v) / 2) ** 2),
                    label: "parallel",
                    dash: [7, 4],
                    width: S.ana === "par" ? 3 : 1.5
                }
            ],
            cursor: {
                x: S.pcv,
                label: "T = " + fx(S.ana === "cross" ? r.res.Tcrossed : r.res.Tparallel, 3)
            },
            legendPosition: "left"
        });
    }, "Pockels cell transmission versus voltage");
    canvas("pcEllipseCanvas", 1.5, (ctx, w, h) => {
        bg(ctx, w, h);
        const r = R.pc,
            [Ex, Ey] = r.res.jones;
        // bench schematic (left 45 %)
        const bw = w * 0.44,
            y0 = h / 2;
        ctx.strokeStyle = PAL.axis;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(6, y0);
        ctx.lineTo(bw - 4, y0);
        ctx.stroke();
        const box = (x, lab, sub, col) => {
            ctx.fillStyle = "rgba(167,139,250,0.14)";
            ctx.strokeStyle = col;
            ctx.lineWidth = 1.5;
            ctx.fillRect(x - 14, y0 - 36, 28, 72);
            ctx.strokeRect(x - 14, y0 - 36, 28, 72);
            text(ctx, lab, x, y0 - 48, {
                align: "center",
                size: 11
            });
            text(ctx, sub, x, y0 + 50, {
                align: "center",
                size: 11,
                color: PAL.textMuted
            });
        };
        box(bw * 0.15, "P", "∥ x", SER[0]);
        box(bw * 0.5, "EO cell", "axes ±45°", SER[1]);
        box(bw * 0.85, "A", S.ana === "cross" ? "∥ y" : "∥ x", SER[2]);
        text(ctx, "V = " + fmtSI(r.V, "V"), bw * 0.5, y0 + 68, {
            align: "center",
            size: 11,
            color: PAL.marker
        });
        // ellipse (right part)
        const cx0 = bw + (w - bw) / 2,
            rad = Math.max(8, Math.min((w - bw) / 2 - 14, h / 2 - 22));
        ctx.strokeStyle = PAL.gridStrong;
        ctx.lineWidth = 1;
        ctx.strokeRect(cx0 - rad, y0 - rad, 2 * rad, 2 * rad);
        ctx.beginPath();
        ctx.moveTo(cx0 - rad, y0);
        ctx.lineTo(cx0 + rad, y0);
        ctx.moveTo(cx0, y0 - rad);
        ctx.lineTo(cx0, y0 + rad);
        ctx.stroke();
        text(ctx, "x", cx0 + rad - 4, y0 + 10, {
            size: 11,
            color: PAL.textMuted,
            align: "right"
        });
        text(ctx, "y", cx0 + 6, y0 - rad + 8, {
            size: 11,
            color: PAL.textMuted
        });
        ctx.strokeStyle = SER[1];
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let i = 0; i <= 120; i++) {
            const wt = 2 * Math.PI * i / 120;
            const ex = Ex.re * Math.cos(wt) + Ex.im * Math.sin(wt),
                ey = Ey.re * Math.cos(wt) + Ey.im * Math.sin(wt);
            const X = cx0 + rad * 0.95 * ex,
                Y = y0 - rad * 0.95 * ey;
            if (i) ctx.lineTo(X, Y);
            else ctx.moveTo(X, Y);
        }
        ctx.stroke();
        text(ctx, "Γ = " + (r.res.gamma / DEG).toFixed(1) + "°", cx0 - rad, y0 - rad - 10, {
            size: 12
        });
    }, "Polarization state after the Pockels cell");

    // ---- AOM
    canvas("aoGeoCanvas", 2.4, (ctx, w, h) => {
        bg(ctx, w, h);
        const r = R.ao,
            a = r.a;
        const cellX = w * 0.3,
            cellW = w * 0.16,
            cellY = h * 0.12,
            cellH = h * 0.7;
        // sound column + wavefronts
        ctx.fillStyle = "rgba(105,245,231,0.07)";
        ctx.fillRect(cellX, cellY, cellW, cellH);
        ctx.strokeStyle = PAL.axis;
        ctx.lineWidth = 1.2;
        ctx.strokeRect(cellX, cellY, cellW, cellH);
        const nWave = 9;
        ctx.strokeStyle = "rgba(105,245,231,0.35)";
        for (let i = 1; i < nWave; i++) {
            const y = cellY + cellH * i / nWave;
            ctx.beginPath();
            ctx.moveTo(cellX, y);
            ctx.lineTo(cellX + cellW, y);
            ctx.stroke();
        }
        ctx.fillStyle = "#6b7280";
        ctx.fillRect(cellX, cellY + cellH, cellW, 8);
        text(ctx, "transducer " + fp(S.fa, 3) + " MHz", cellX + cellW / 2, cellY + cellH + 18, {
            align: "center",
            size: 11,
            color: PAL.textMuted
        });
        arrow(ctx, cellX - 12, cellY + cellH * 0.98, cellX - 12, cellY + cellH * 0.66, SER[0], 1.8);
        text(ctx, "sound", cellX - 18, cellY + cellH * 0.82, {
            size: 11,
            color: SER[0],
            align: "right"
        });
        text(ctx, "Λ = " + fmtSI(a.Lambda, "m"), cellX + cellW / 2, cellY - 8, {
            align: "center",
            size: 11,
            color: PAL.textMuted
        });
        // exaggerated angles
        const thB = a.thetaBOut;
        const short = w < 600;
        const LoutPre = Math.max(40, w - (cellX + cellW / 2) - (short ? 62 : 165));
        const shown = r.ord.orders.filter((m, i) => r.ord.power[i] >= 2e-3 && Math.abs(m) <= 5);
        const spread = Math.max(1, ...shown.map((m) => Math.abs(m - S.inc / 2) * 2)); // in units of θ_B
        let ex = Math.max((7 * DEG) / Math.max(thB, 1e-9), 16 / (LoutPre * 2 * Math.max(thB, 1e-9)));
        const angMax = Math.min(35 * DEG, Math.asin(Math.min(1, (h / 2 - 24) / LoutPre)));
        ex = Math.min(ex, angMax / (spread * Math.max(thB, 1e-9)), 1e4);
        const cx0 = cellX + cellW / 2,
            cy0 = cellY + cellH / 2;
        const tin = -S.inc * thB * ex;
        const Lin = cx0 - 10;
        // travel direction (cos t, sin t) with + = up; canvas y points down
        arrow(ctx, cx0 - Lin * Math.cos(tin), cy0 + Lin * Math.sin(tin), cx0, cy0, PAL.text, 2.5);
        text(ctx, "incident ν₀", 10, cy0 + Lin * Math.sin(tin) - 12, {
            size: 12
        });
        const Lout = LoutPre;
        r.ord.orders.forEach((m, i) => {
            const pw = r.ord.power[i];
            if (pw < 2e-3 || Math.abs(m) > 5) return;
            const ang = tin + m * 2 * thB * ex; // + = towards the sound direction (up)
            const x1 = cx0 + Lout * Math.cos(ang),
                y1 = cy0 - Lout * Math.sin(ang);
            ctx.save();
            ctx.strokeStyle = m === 0 ? PAL.text : m > 0 ? SER[1] : SER[2];
            ctx.globalAlpha = 0.35 + 0.65 * Math.sqrt(pw);
            ctx.lineWidth = 1 + 6 * pw;
            ctx.beginPath();
            ctx.moveTo(cx0, cy0);
            ctx.lineTo(x1, y1);
            ctx.stroke();
            ctx.restore();
            const sh = m === 0 ? "ν₀" : "ν₀ " + (m > 0 ? "+ " : "− ") + (Math.abs(m) === 1 ? "" : Math.abs(m)) + "f_a";
            text(ctx, (m > 0 ? "+" : "") + m + ": " + (short ? "" : sh + " · ") + (100 * pw).toFixed(pw < 0.1 ? 1 : 0) + " %", x1 + 6, y1, {
                size: 11,
                align: "left",
                color: m === 0 ? PAL.text : m > 0 ? SER[1] : SER[2]
            });
        });
        text(ctx, "angles ×" + fp(ex, 2), 8, h - 10, {
            size: 11,
            color: PAL.textMuted
        });
    }, "Acousto-optic cell geometry and diffracted orders", 260);
    canvas("aoOrdersCanvas", 1.5, (ctx, w, h) => {
        bg(ctx, w, h);
        const r = R.ao,
            M = Math.min(6, Math.max(3, Math.ceil(r.a.nu) + 2));
        const ords = [],
            pw = [],
            thin = [];
        r.ord.orders.forEach((m, i) => {
            if (Math.abs(m) <= M) {
                ords.push(m);
                pw.push(r.ord.power[i]);
                thin.push(core.besselJ(m, r.a.nu) ** 2);
            }
        });
        const map = UI.plot(ctx, {
            x: 0,
            y: 0,
            w,
            h
        }, {
            x: {
                min: -M - 0.7,
                max: M + 0.7,
                label: "Diffraction order m",
                ticks: Object.assign(ords.slice(), {
                    step: 1
                }),
                format: (v) => String(Math.round(v))
            },
            y: {
                min: 0,
                max: 1.05,
                label: "Power fraction"
            },
            series: [{
                xs: ords,
                ys: thin,
                pointsOnly: true,
                pointRadius: 4,
                color: SER[1],
                label: "J_m²(ν)"
            }],
            legendPosition: "left"
        });
        const bwPx = Math.max(4, (map.xToPx(1) - map.xToPx(0)) * 0.55);
        ctx.save();
        ctx.fillStyle = SER[0];
        ctx.globalAlpha = 0.8;
        ords.forEach((m, i) => {
            const x = map.xToPx(m),
                y = map.yToPx(pw[i]),
                y0 = map.yToPx(0);
            ctx.fillRect(x - bwPx / 2, y, bwPx, y0 - y);
        });
        ctx.restore();
        // redraw the dots above the bars
        ctx.fillStyle = SER[1];
        ords.forEach((m, i) => {
            ctx.beginPath();
            ctx.arc(map.xToPx(m), map.yToPx(thin[i]), 4, 0, 2 * Math.PI);
            ctx.fill();
        });
    }, "Power per diffraction order");
    canvas("aoPowerCanvas", 1.5, (ctx, w, h) => {
        bg(ctx, w, h);
        const d = R.ao.pw;
        UI.plot(ctx, {
            x: 0,
            y: 0,
            w,
            h
        }, {
            x: {
                min: 0,
                max: d.Ps[d.Ps.length - 1],
                label: "Acoustic power P_a",
                unit: "W"
            },
            y: {
                min: 0,
                max: 1.05,
                label: "η₁"
            },
            series: [{
                xs: d.Ps,
                ys: d.num,
                label: "coupled-wave"
            }, {
                xs: d.Ps,
                ys: d.bragg,
                label: "sin²(ν/2)",
                dash: [7, 4]
            }, {
                xs: d.Ps,
                ys: d.thin,
                label: "J₁²(ν)",
                dash: [2, 3]
            }],
            cursor: {
                x: S.pa,
                label: "η₁ = " + fx(R.ao.eta1, 3)
            },
            markers: [{
                x: R.ao.a.P100,
                label: "P₁₀₀"
            }],
            legendPosition: "left"
        });
    }, "First-order efficiency versus acoustic power");
    canvas("aoQCanvas", 2.8, (ctx, w, h) => {
        bg(ctx, w, h);
        const d = R.ao.qs;
        UI.plot(ctx, {
            x: 0,
            y: 0,
            w,
            h
        }, {
            x: {
                min: d.Qs[0],
                max: d.Qs[d.Qs.length - 1],
                log: true,
                label: "Klein–Cook Q"
            },
            y: {
                min: 0,
                max: 1.5,
                label: "Power fraction",
                ticks: Object.assign([0, 0.2, 0.4, 0.6, 0.8, 1], {
                    step: 0.2
                })
            },
            legendPosition: "left",
            series: [{
                    xs: d.Qs,
                    ys: d.rows.m0,
                    label: "order 0"
                }, {
                    xs: d.Qs,
                    ys: d.rows.p1,
                    label: "order +1",
                    dash: [7, 4]
                },
                {
                    xs: d.Qs,
                    ys: d.rows.m1,
                    label: "order −1",
                    dash: [2, 3]
                }, {
                    xs: d.Qs,
                    ys: d.rows.p2,
                    label: "order +2",
                    dash: [10, 3, 2, 3]
                }
            ],
            cursor: {
                x: R.ao.a.Q,
                label: "Q = " + fp(R.ao.a.Q, 3)
            },
            markers: [{
                x: 1,
                label: "Q = 1",
                color: PAL.textMuted
            }, {
                x: 10,
                label: "Q = 10",
                color: PAL.textMuted
            }]
        });
    }, "Order powers versus Klein–Cook Q");

    // ---- directional coupler
    canvas("dcZCanvas", 2.8, (ctx, w, h) => {
        bg(ctx, w, h);
        const r = R.dc,
            z = Array.from(r.prop.z, (v) => v * 1e3);
        const mk = [];
        for (let k = 1; k * S.lc <= S.dl + 1e-9 && k <= 12; k++) mk.push({
            x: k * S.lc,
            label: k === 1 ? "L_c" : k + "L_c"
        });
        if (S.rev) mk.push({
            x: S.dl / 2,
            label: "Δβ → −Δβ",
            color: SER[3]
        });
        UI.plot(ctx, {
            x: 0,
            y: 0,
            w,
            h
        }, {
            x: {
                min: 0,
                max: S.dl,
                label: "Position z",
                unit: "mm"
            },
            y: {
                min: 0,
                max: 1.05,
                label: "Power / P_in"
            },
            series: [{
                xs: z,
                ys: Array.from(r.prop.P1),
                label: "guide 1"
            }, {
                xs: z,
                ys: Array.from(r.prop.P2),
                label: "guide 2",
                dash: [7, 4]
            }],
            markers: mk,
            legendPosition: "left"
        });
    }, "Power along the coupler");
    canvas("dcMaxCanvas", 1.5, (ctx, w, h) => {
        bg(ctx, w, h);
        const x0 = Math.abs(R.dc.dbeta / (2 * R.dc.kappa));
        const X = Math.max(4, x0 * 1.2);
        const xs = core.linspace(0, X, 300);
        UI.plot(ctx, {
            x: 0,
            y: 0,
            w,
            h
        }, {
            x: {
                min: 0,
                max: X,
                label: "|Δβ| / 2κ"
            },
            y: {
                min: 0,
                max: 1.05,
                label: "Max transfer"
            },
            series: [{
                xs,
                ys: Array.from(xs, (x) => 1 / (1 + x * x))
            }],
            legend: false,
            cursor: {
                x: x0,
                label: fx(1 / (1 + x0 * x0), 3)
            }
        });
    }, "Maximum transfer versus phase mismatch");
    canvas("dcVCanvas", 1.5, (ctx, w, h) => {
        bg(ctx, w, h);
        const s = R.dc.sweep;
        UI.plot(ctx, {
            x: 0,
            y: 0,
            w,
            h
        }, {
            x: {
                min: s.Vs[0],
                max: s.Vs[s.Vs.length - 1],
                label: "Voltage V",
                unit: "V"
            },
            y: {
                min: 0,
                max: 1.05,
                label: "P₂(L)"
            },
            series: [{
                xs: s.Vs,
                ys: s.Pu,
                label: "uniform"
            }, {
                xs: s.Vs,
                ys: s.Pr,
                label: "Δβ-reversal",
                dash: [7, 4]
            }],
            cursor: {
                x: S.dcv,
                label: fx(R.dc.c.P2, 3)
            },
            legendPosition: "left"
        });
    }, "Cross-port power versus voltage");

    // ------------------------------------------------------------------ visibility
    function applyVisibility() {
        document.querySelectorAll("[data-dev]").forEach((el) => {
            const on = el.dataset.dev.split(/\s+/).includes(S.dev);
            if (el.hidden === on) el.hidden = !on;
        });
        document.querySelectorAll("[data-drv]").forEach((el) => {
            el.hidden = el.dataset.drv !== S.drv;
        });
        document.querySelectorAll("[data-pcx]").forEach((el) => {
            el.hidden = el.dataset.pcx !== S.pcx;
        });
    }

    // ------------------------------------------------------------------ readouts, stats
    const setText = (id, v) => {
        const el = $(id);
        if (el && el.textContent !== v) el.textContent = v;
    };

    function stats(rows) {
        rows.forEach(([icon, val, label], i) => {
            setText("st" + i + "i", icon);
            setText("st" + i + "v", val);
            setText("st" + i + "l", label);
        });
    }

    function labels() {
        setText("lamValue", S.lam + " nm");
        setText("gapValue", S.gap + " µm");
        setText("lenValue", S.len + " mm");
        setText("ovlValue", S.ovl.toFixed(2));
        setText("vmValue", S.vm + " V");
        setText("fmValue", S.fm + " GHz");
        setText("biasValue", S.bias + "°");
        setText("s2Value", String(S.s2));
        setText("erValue", S.er >= 60 ? "ideal" : S.er + " dB");
        setText("mvmValue", S.mvm + " V");
        setText("fm2Value", S.fm2 + " GHz");
        setText("brValue", S.br + " Gb/s");
        setText("swValue", String(S.sw));
        setText("riseValue", String(S.rise));
        setText("pcvValue", String(S.pcv));
        setText("pcdValue", S.pcd + " mm");
        setText("pclValue", S.pcl + " mm");
        setText("g0Value", S.g0 + "°");
        setText("faValue", S.fa + " MHz");
        setText("aoLValue", S.aoL + " mm");
        setText("aoHValue", S.aoH + " mm");
        setText("paValue", S.pa + " W");
        setText("incValue", String(S.inc));
        setText("lcValue", S.lc + " mm");
        setText("dlValue", S.dl + " mm");
        setText("dcvValue", S.dcv + " V");
    }

    let warnText = "";

    function render() {
        S = ctl.get();
        applyVisibility();
        labels();
        R = {
            ok: true
        };
        warnText = "";
        const nm = S.lam;
        if (S.dev === "pm") {
            const r = R.pm = computePM();
            const J = (n) => r.sb.find((x) => x.n === n).power;
            setText("pmNe", r.g.n.toFixed(4) + " (n_o " + r.g.no.toFixed(4) + ")");
            setText("pmVpi", fmtSI(r.Vpi, "V"));
            setText("pmBeta", fx(r.beta, 3) + " rad");
            setText("pmJ0", fp(J(0), 4) + " (" + fx(dB(J(0), -300), 1) + " dB)");
            setText("pmJ1", fp(J(1), 4) + " (" + fx(dB(J(1), -300), 1) + " dB)");
            setText("pmSum", fx(r.sum, 12));
            setText("pmSpacing", fmtSI(r.fm, "Hz") + " = f_m");
            setText("pmDev", fmtSI(r.bw.peakDeviation, "Hz"));
            setText("pmCarson", fmtSI(r.bw.carson, "Hz"));
            setText("pmNullV", fmtSI(2.404825557695773 * r.Vpi / Math.PI, "V"));
            setText("pmSpecBadge", S.lg ? "dB, power-normalised" : "power-normalised");
            stats([
                ["V", fmtSI(r.Vpi, "V"), "V_π (phase)"],
                ["β", fx(r.beta, 3), "Modulation index"],
                ["J₀²", fp(J(0), 3), "Carrier power"],
                ["Σ", fx(r.sum, 6), "Σ J_n²"]
            ]);
            desc.pmSpecCanvas.update(`Line spectrum: β = ${fx(r.beta, 3)}, lines every ${fmtSI(r.fm, "Hz")}; carrier ${pct(J(0))}, first sidebands ${pct(J(1))} each, second ${pct(J(2))} each; total ${fx(r.sum, 6)}.`);
            desc.pmBesselCanvas.update(`J_n²(β) curves for n = 0 to 3 with the current β = ${fx(r.beta, 3)} marked; the carrier vanishes at β = 2.405.`);
            desc.pmPhasorCanvas.update(`Unit phasor swinging ±${fx(r.beta, 2)} rad at the drive frequency; constant length, so the detected power is constant.`);
            if (S.lam < 500) warnText = "Below ≈ 500 nm LiNbO₃ absorbs and suffers photorefractive damage; the Sellmeier data are extrapolated.";
        } else if (S.dev === "mzm") {
            const r = R.mzm = computeMZM(),
                q = r.q;
            setText("mzVpi", fmtSI(q.Vpi, "V") + " (V_π,PM " + fmtSI(q.VpiPM, "V") + ")");
            setText("mzP", fx(r.at0.P2, 4));
            setText("mzSum", fx(r.at0.P1 + r.at0.P2, 12));
            setText("mzSlope", fp(r.slope, 4) + " V⁻¹");
            setText("mzSlopeQ", fp(Math.PI / (2 * q.Vpi) * 2 * Math.sqrt(q.r * (1 - q.r)), 4) + " V⁻¹");
            setText("mzChirp", Number.isFinite(r.chirp) ? fx(r.chirp, 3) : "undefined at the null");
            setText("mzER", Number.isFinite(r.staticER) ? fx(r.staticER, 1) + " dB" : "∞ (ideal)");
            let st3 = ["α", Number.isFinite(r.chirp) ? fx(r.chirp, 2) : "—", "Chirp α"];
            if (r.sb) {
                const c = r.sb.find((x) => x.n === 0).power2,
                    p1 = r.sb.find((x) => x.n === 1).power2;
                if (r.harm.h[0] < 1e-9) setText("mzHD", "no fundamental: detected power oscillates at 2f_m (" + fp(r.harm.h[1], 3) + ")");
                else setText("mzHD", (Number.isFinite(r.harm.hd2) && r.harm.hd2 > -200 ? fx(r.harm.hd2, 1) + " dBc" : "0 (−∞ dBc)") + " / " + (r.harm.hd3 > -200 ? fx(r.harm.hd3, 1) + " dBc" : "−∞"));
                setText("mzSB", fp(c, 3) + " / " + fp(p1, 3));
                desc.mzmSpecCanvas.update(`Main-port optical spectrum for a ${S.mvm} V sine at ${S.fm2} GHz: carrier ${pct(c)}, ±1st orders ${pct(p1)} each.`);
                desc.mzmTimeCanvas.update(`Two drive periods: V(t) = ${S.mvm} sin Ωt V and detected power between ${fx(Math.min(...[0, 0.25, 0.5, 0.75].map((t) => EO.mzmTransfer(q, S.mvm * Math.sin(2 * Math.PI * t)))), 3)} and ${fx(Math.max(...[0, 0.25, 0.5, 0.75].map((t) => EO.mzmTransfer(q, S.mvm * Math.sin(2 * Math.PI * t)))), 3)}.`);
            } else {
                const e = r.eye;
                setText("mzLevels", fx(e.P1, 4) + " / " + fx(e.P0, 4) + (e.inverted ? " (inverted: bit 1 → low power)" : ""));
                setText("mzDynER", Number.isFinite(e.erDb) ? fx(e.erDb, 1) + " dB" : "∞");
                setText("mzEyeOpen", fx(e.opening, 3) + " of P_in");
                st3 = ["👁", fx(e.opening, 3), "Eye opening"];
                desc.mzmEyeCanvas.update(`Eye of a ${S.br} Gb/s PRBS7: high level ${fx(e.P1, 3)}, low ${fx(e.P0, 3)}, vertical opening ${fx(e.opening, 3)}, dynamic extinction ${fx(e.erDb, 1)} dB.`);
                desc.mzmTimeCanvas.update(`First 24 bits of the NRZ drive (±${fp(S.sw * q.Vpi / 2, 3)} V) and the detected power.`);
            }
            stats([
                ["V", fmtSI(q.Vpi, "V"), "V_π (MZM)"],
                ["P", fx(r.at0.P2, 3), "P_out at bias"],
                ["∂", fp(r.slope, 3) + " /V", "Slope at bias"], st3
            ]);
            desc.mzmTfCanvas.update(`Transfer curves: main port ${fx(r.at0.P2, 3)} and other port ${fx(r.at0.P1, 3)} at the bias; V_π = ${fmtSI(q.Vpi, "V")}; drive range ${fp(r.excursion[0], 3)} to ${fp(r.excursion[1], 3)} V.`);
            desc.mzmPhasorCanvas.update("Arm phasors and their sum (main port) and difference (other port) over the drive cycle.");
            const t = $("mzmTimeTitle");
            if (t) t.textContent = S.drv === "sine" ? "Drive and detected power vs time (two periods)" : "NRZ drive and detected power (first 24 bits)";
        } else if (S.dev === "pc") {
            const r = R.pc = computePC();
            setText("pcVpi", fmtSI(r.Vpi, "V") + (S.pcx === "kdp" ? " (λ₀/2n_o³r₆₃, size-independent)" : " (λ₀d/[L(n_e³r₃₃ − n_o³r₁₃)])"));
            setText("pcV", fmtSI(r.V, "V"));
            setText("pcGamma", fx(r.res.gamma / DEG, 1) + "° (" + fx(r.res.gamma / Math.PI, 3) + "π)");
            setText("pcTc", fx(r.res.Tcrossed, 4));
            setText("pcTp", fx(r.res.Tparallel, 4));
            const s = r.res.stokes;
            setText("pcStokes", [s.S1, s.S2, s.S3].map((v) => fx(v, 3)).join(", "));
            setText("pcIdx", S.pcx === "kdp" ? "KDP n_o = 1.51, r₆₃ = 10.5 pm/V" : "n_e = " + r.idx.ne.toFixed(4) + ", n_o = " + r.idx.no.toFixed(4) + ", r₃₃ = 30.8, r₁₃ = 8.6 pm/V");
            const T = S.ana === "cross" ? r.res.Tcrossed : r.res.Tparallel;
            stats([
                ["V", fmtSI(r.Vpi, "V"), "Half-wave voltage"],
                ["Γ", fx(r.res.gamma / DEG, 1) + "°", "Retardation"],
                ["T", fx(T, 3), S.ana === "cross" ? "T (crossed)" : "T (parallel)"],
                ["Σ", fx(r.res.Tcrossed + r.res.Tparallel, 6), "T⊥ + T∥"]
            ]);
            desc.pcTfCanvas.update(`Crossed and parallel transmission versus V/V_π; at V = ${fmtSI(r.V, "V")} T(crossed) = ${fx(r.res.Tcrossed, 3)}.`);
            desc.pcEllipseCanvas.update(`Output polarization ellipse for Γ = ${fx(r.res.gamma / DEG, 1)}°; Stokes S1 = ${fx(s.S1, 3)}, S2 = ${fx(s.S2, 3)}, S3 = ${fx(s.S3, 3)}.`);
        } else if (S.dev === "aom") {
            const r = R.ao = computeAO(),
                a = r.a;
            setText("aoLam", fmtSI(a.Lambda, "m"));
            setText("aoTheta", fmtSI(a.thetaBOut, "rad") + " = " + fx(a.thetaBOut / DEG, 3) + "°");
            setText("aoThetaIn", fmtSI(a.thetaBIn, "rad"));
            setText("aoDefl", fmtSI(a.deflection, "rad"));
            setText("aoQ", fp(a.Q, 3) + " (" + a.regime + ")");
            setText("aoNu", fx(a.nu, 3) + " rad");
            setText("aoEtaB", pct(a.etaBragg));
            setText("aoEtaN", pct(r.eta1, 2));
            setText("aoP100", fmtSI(a.P100, "W"));
            setText("aoShift", "ν₀ + " + fmtSI(S.fa * 1e6, "Hz") + " / ν₀ − " + fmtSI(S.fa * 1e6, "Hz"));
            setText("aoSum", fx(r.sum, 10));
            setText("aoRegimeBadge", a.regime + " (Q = " + fp(a.Q, 2) + ")");
            stats([
                ["θ", fmtSI(a.thetaBOut, "rad"), "Bragg angle (air)"],
                ["Q", fp(a.Q, 3), a.regime],
                ["η", pct(r.eta1), "Order +1"],
                ["Δν", "+" + fmtSI(S.fa * 1e6, "Hz"), "Shift of order +1"]
            ]);
            desc.aoGeoCanvas.update(`Bragg cell schematic: Λ = ${fmtSI(a.Lambda, "m")}, θ_B = ${fmtSI(a.thetaBOut, "rad")}, order +1 at ν₀ + ${S.fa} MHz with ${pct(r.eta1)}.`);
            desc.aoOrdersCanvas.update("Order powers: " + r.ord.orders.filter((m) => Math.abs(m) <= 3).map((m) => m + ": " + pct(r.ord.power[r.ord.orders.indexOf(m)])).join(", ") + ".");
            desc.aoPowerCanvas.update(`First-order efficiency versus acoustic power; P₁₀₀ = ${fmtSI(a.P100, "W")}; at ${S.pa} W η₁ = ${pct(r.eta1)} (Bragg formula ${pct(a.etaBragg)}).`);
            desc.aoQCanvas.update(`Order powers versus Q at ν = ${fx(a.nu, 2)}; current Q = ${fp(a.Q, 3)}.`);
            if (S.inc !== 1 && a.Q > 10) warnText = "Bragg regime with the beam off the Bragg angle: the diffraction efficiency drops sharply (phase mismatch ∝ Q).";
        } else {
            const r = R.dc = computeDC();
            setText("dcKappa", fmtSI(r.kappa, "m⁻¹"));
            setText("dcDbeta", fmtSI(r.dbeta, "m⁻¹") + " (" + fp(r.perV, 4) + " m⁻¹/V)");
            setText("dcRatio", fx(r.dbeta / (2 * r.kappa), 3));
            setText("dcMax", fx(r.c.maxTransfer, 4) + (S.rev ? " (per uniform half)" : ""));
            setText("dcOut", fx(r.c.P1, 4) + " / " + fx(r.c.P2, 4));
            setText("dcSum", fx(r.c.P1 + r.c.P2, 12));
            setText("dcLL", fx(r.L / r.Lc, 3));
            setText("dcVsw", fmtSI(r.Vbar, "V"));
            setText("dcBadge", S.rev ? "Δβ-reversal" : "uniform electrodes");
            stats([
                ["L", fmtSI(r.Lc, "m"), "Coupling length"],
                ["Δβ", fx(r.dbeta / (2 * r.kappa), 3), "Δβ / 2κ"],
                ["P₂", fx(r.c.P2, 3), "Cross output"],
                ["Σ", fx(r.c.P1 + r.c.P2, 6), "P₁ + P₂"]
            ]);
            desc.dcZCanvas.update(`Power along a ${S.dl} mm coupler (L_c = ${S.lc} mm, Δβ/2κ = ${fx(r.dbeta / (2 * r.kappa), 3)}): output guide 1 ${fx(r.c.P1, 3)}, guide 2 ${fx(r.c.P2, 3)}.`);
            desc.dcMaxCanvas.update(`Maximum transfer 1/(1+(Δβ/2κ)²) = ${fx(r.c.maxTransfer, 3)} at the current mismatch.`);
            desc.dcVCanvas.update(`Cross-port output versus voltage for uniform and Δβ-reversal electrodes; at ${S.dcv} V: ${fx(r.c.P2, 3)}.`);
        }
        const w = $("warn");
        w.hidden = !warnText;
        w.textContent = warnText;
        void nm;
        for (const id in cv) {
            const el = cv[id].canvas;
            if (el.offsetParent !== null) {
                cv[id].resize();
            }
        }
    }

    // ------------------------------------------------------------------ animation
    function setPlay(running) {
        ["playBtn", "playBtn2"].forEach((id) => {
            const b = $(id);
            b.textContent = running ? "⏸ Pause" : "▶ Start";
            b.setAttribute("aria-pressed", String(running));
        });
    }
    const loop = UI.createLoop((dt) => {
        ph = (ph + dt * 0.4) % 1000;
        drawAnimated();
    }, {
        onChange: setPlay
    });

    function drawAnimated() {
        if (S.dev === "pm") cv.pmPhasorCanvas.redraw();
        else if (S.dev === "mzm") {
            cv.mzmPhasorCanvas.redraw();
            cv.mzmTimeCanvas.redraw();
        }
    }
    ["playBtn", "playBtn2"].forEach((id) => $(id).addEventListener("click", () => loop.toggle()));
    ["stepBtn", "stepBtn2"].forEach((id) => $(id).addEventListener("click", () => {
        loop.stop();
        ph = Math.round((ph + 1 / 16) * 16) / 16;
        drawAnimated();
    }));
    ["resetBtn", "resetBtn2"].forEach((id) => $(id).addEventListener("click", () => {
        loop.stop();
        ph = 0;
        ctl.set(DEFAULTS);
        $("presetNote").textContent = "Defaults restored.";
        url.update();
        render();
    }));

    // ------------------------------------------------------------------ presets
    document.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => {
        const p = PRESETS[b.dataset.preset];
        if (!p) return;
        ph = 0;
        ctl.set(Object.assign({}, DEFAULTS, p.s));
        $("presetNote").textContent = p.note;
        url.update();
        render();
    }));

    // ------------------------------------------------------------------ export
    function csv() {
        if (S.dev === "pm") return {
            headers: ["order n", "offset (GHz)", "amplitude Re", "amplitude Im", "power / P_in"],
            rows: R.pm.sb.map((x) => [x.n, x.offset / 1e9, x.amp.re, x.amp.im, x.power])
        };
        if (S.dev === "mzm") {
            const q = R.mzm.q,
                rows = [];
            for (let i = 0; i <= 400; i++) {
                const V = -2 * q.Vpi + 4 * q.Vpi * i / 400;
                const f = EO.mzmFields(q, V);
                rows.push([V, f.P2, f.P1]);
            }
            return {
                headers: ["drive V (V)", "P main / P_in", "P other / P_in"],
                rows
            };
        }
        if (S.dev === "pc") {
            const rows = [];
            for (let i = 0; i <= 200; i++) {
                const v = -2 + 4 * i / 200;
                const res = EO.pockelsCell({
                    V: v * R.pc.Vpi,
                    Vpi: R.pc.Vpi,
                    gamma0: S.g0 * DEG
                });
                rows.push([v, v * R.pc.Vpi, res.Tcrossed, res.Tparallel]);
            }
            return {
                headers: ["V/V_pi", "V (V)", "T crossed", "T parallel"],
                rows
            };
        }
        if (S.dev === "aom") return {
            headers: ["order m", "frequency shift (MHz)", "power (coupled-wave)", "J_m^2(nu)"],
            rows: R.ao.ord.orders.map((m, i) => [m, m * S.fa, R.ao.ord.power[i], core.besselJ(m, R.ao.a.nu) ** 2])
        };
        return {
            headers: ["z (mm)", "P1", "P2"],
            rows: Array.from(R.dc.prop.z, (z, i) => [z * 1e3, R.dc.prop.P1[i], R.dc.prop.P2[i]])
        };
    }
    const bar = UI.addExportBar($("exportHost"), {
        name: "electro-optics",
        url,
        getState: ctl.get,
        getCSV: csv
    });
    const pngBtn = document.createElement("button");
    pngBtn.type = "button";
    pngBtn.className = "optics-export-btn";
    pngBtn.textContent = "PNG (visible plots)";
    pngBtn.title = "Download every plot of the current device as PNG";
    pngBtn.addEventListener("click", () => {
        Object.values(cv).map((h) => h.canvas).filter((c) => c.offsetParent !== null)
            .forEach((c) => UI.exportPNG("electro-optics-" + c.dataset.exportName, c, {
                caption: "Electro-/acousto-optics · " + S.dev + " · λ₀ = " + S.lam + " nm"
            }));
    });
    bar.insertBefore(pngBtn, bar.querySelector(".optics-export-status"));

    UI.onThemeChange(() => render());
    url.ready.then(() => {
        render();
        if (!UI.prefersReducedMotion()) {
            /* stay paused by default: animation is optional */ }
    });
    render();
})();