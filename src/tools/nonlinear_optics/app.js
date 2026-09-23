/*
 * Nonlinear optics (SHG + Kerr/SPM): page glue.
 * Physics lives in ../shared/optics/nonlinearOptics.js (pure; tests in tests/optics/nonlinear_optics.test.js).
 * Controls are in display units (nm, mrad, µm, mm, MW/cm², ps, W, ps²/km, W⁻¹km⁻¹, m); SI inside.
 */
(function() {
    "use strict";
    const UI = window.OpticsUI,
        core = window.OpticsModels.core,
        NLO = window.OpticsModels.nonlinearOptics;
    const $ = (id) => document.getElementById(id);
    const NM = 1e-9,
        UM = 1e-6,
        MM = 1e-3,
        PS = 1e-12,
        KM = 1e3,
        MWCM2 = 1e10,
        PMV = 1e-12;
    const TH = UI.palette().canvas;
    const COL = {
        pump: TH.series[0],
        sh: TH.series[1],
        ref: TH.series[2],
        qpm: TH.series[3],
        none: TH.series[5],
        ideal: TH.series[4]
    };
    const SINC2_HALF = 2.7831; // sinc²(x/2)=½ at x = ±2.7831 → FWHM in ΔkL = 5.566

    const DEFAULTS = {
        cr: "bbo",
        lam: 1064,
        dth: 0,
        qpm: true,
        per: 6.818,
        n1: 1.6,
        n2: 1.6,
        deff: 2,
        dk: 0,
        L: 10,
        Ilog: 0,
        steps: 400,
        shape: "sech",
        T0: 1,
        P0: 15.3846,
        b2: -20,
        gam: 1.3,
        Lf: 250,
        nz: 200
    };

    const fmt = (v, d = 3) => (Number.isFinite(v) ? Number(v.toPrecision(d)).toString() : "—");
    const fmtE = (v, d = 2) => (!Number.isFinite(v) ? "—" : v === 0 ? "0" : Math.abs(v) >= 1e-3 && Math.abs(v) < 1e4 ? fmt(v, d + 1) : v.toExponential(d));
    const fmtPct = (v) => (Number.isFinite(v) ? (v >= 0.01 ? (100 * v).toFixed(2) + " %" : v.toExponential(3)) : "—");
    const fmtLen = (v) => core.formatSI(v, "m");
    const mwFromLog = (x) => Math.pow(10, x);
    const SUP = {
        "-": "⁻",
        0: "⁰",
        1: "¹",
        2: "²",
        3: "³",
        4: "⁴",
        5: "⁵",
        6: "⁶",
        7: "⁷",
        8: "⁸",
        9: "⁹"
    };
    const pow10 = (v) => "10" + String(Math.round(Math.log10(v))).split("").map((ch) => SUP[ch]).join("");

    // ------------------------------------------------------------------ controls
    const sidebar = document.querySelector(".options-sidebar");
    UI.enhanceAllSliders(sidebar, {
        lam: {
            unit: "nm"
        },
        dth: {
            unit: "mrad"
        },
        per: {
            unit: "µm"
        },
        deff: {
            unit: "pm/V"
        },
        dk: {
            unit: "rad/mm"
        },
        len: {
            unit: "mm"
        },
        Ilog: {
            unit: "MW/cm²",
            format: mwFromLog,
            parse: (v) => Math.log10(Math.max(1e-6, v))
        },
        T0: {
            unit: "ps"
        },
        P0: {
            unit: "W"
        },
        b2: {
            unit: "ps²/km"
        },
        gam: {
            unit: "/W/km"
        },
        Lf: {
            unit: "m"
        }
    });
    const ctl = UI.bindControls({
        cr: "#crystal",
        lam: "#lam",
        dth: "#dth",
        qpm: "#qpm",
        per: "#per",
        n1: "#n1",
        n2: "#n2",
        deff: "#deff",
        dk: "#dk",
        L: "#len",
        Ilog: "#Ilog",
        steps: "#steps",
        shape: "#shape",
        T0: "#T0",
        P0: "#P0",
        b2: "#b2",
        gam: "#gam",
        Lf: "#Lf",
        nz: "#nz"
    }, () => {
        url.update();
        schedule();
    });
    const url = UI.urlState({
        get: ctl.get,
        set: ctl.set
    });

    // ------------------------------------------------------------------ SHG model
    let shg = null,
        sweep = null,
        growth = null,
        kerr = null,
        conv = null;
    let zCursor = NaN;

    function shgSetup(s) {
        const lam = s.lam * NM,
            L = s.L * MM,
            I0 = mwFromLog(s.Ilog) * MWCM2;
        const o = {
            lam,
            L,
            I0,
            cr: s.cr,
            warn: []
        };
        if (s.cr === "custom") {
            o.n1 = s.n1;
            o.n2 = s.n2;
            o.dEff = s.deff * PMV;
            o.dk = s.dk / MM;
        } else {
            const C = NLO.CRYSTALS[s.cr];
            if (lam < C.range[0] * 2 || lam > C.range[1]) o.warn.push(`λ₁ = ${s.lam} nm or its harmonic lies outside the ${C.name} Sellmeier fit range (${C.range[0] / UM}–${C.range[1] / UM} µm).`);
            if (C.type === "birefringent") {
                o.thpm = NLO.typeIAngle(s.cr, lam);
                if (!Number.isFinite(o.thpm)) o.warn.push(`No type I phase-matching angle exists in ${C.name} at ${s.lam} nm (n_e(2ω) > n_o(ω) for every θ). θ = 90° is used.`);
                o.theta = Math.min(Math.PI / 2, (Number.isFinite(o.thpm) ? o.thpm : Math.PI / 2) + s.dth * 1e-3);
            }
            const p = NLO.shgParams(s.cr, lam, o.theta);
            // Δk at θpm is zero up to root-finding round-off (~1e-9 rad/m): snap so the closed form is tanh²
            Object.assign(o, {
                n1: p.n1,
                n2: p.n2,
                dEff: p.dEff,
                dk: Math.abs(p.dk * L) < 1e-9 ? 0 : p.dk,
                walkoff: p.walkoff
            });
            if (C.type === "birefringent") o.dDk = NLO.dDkdTheta(s.cr, lam, o.theta);
        }
        o.qpm = (s.cr === "ppln" || s.cr === "custom") && s.qpm && s.per > 0 ? {
            period: s.per * UM
        } : null;
        o.kappa = NLO.kappa(o.dEff, lam, o.n1, o.n2);
        o.Gamma = o.kappa * Math.sqrt(I0);
        o.lc = Math.PI / Math.abs(o.dk);
        o.dkRes = o.qpm ? o.dk - 2 * Math.PI / o.qpm.period : o.dk; // residual mismatch that the sinc² sees
        if (o.qpm) {
            o.nDom = Math.ceil(L / (o.qpm.period / 2) - 1e-9);
            if (o.nDom > 40000) {
                o.warn.push(`${o.nDom} domains: the period is too short for this length; shortened to 40 000 domains for speed.`);
                o.L = L * 40000 / o.nDom;
                o.nDom = 40000;
            }
            o.spd = Math.max(8, Math.ceil(s.steps / o.nDom));
            o.qpm.stepsPerDomain = o.spd;
        }
        return o;
    }

    function solve(o, stepsMul = 1, record = 600) {
        return NLO.solveSHG({
            kappa: o.kappa,
            dk: o.dk,
            L: o.L,
            I0: o.I0,
            steps: Math.round(ctl.get().steps * stepsMul),
            qpm: o.qpm ? {
                period: o.qpm.period,
                stepsPerDomain: o.spd * stepsMul
            } : null,
            record
        });
    }

    function closedForm(o, z) {
        // reference for the SH curve along z
        if (o.qpm) {
            const G = o.Gamma * 2 / Math.PI,
                x = o.dkRes * z / 2,
                s = Math.abs(x) < 1e-12 ? 1 : Math.sin(x) / x;
            return Math.abs(o.dkRes * o.L) < 1e-9 ? Math.tanh(G * z) ** 2 : (G * z) ** 2 * s * s;
        }
        return o.dk === 0 ? NLO.etaDepleted(o.kappa, o.I0, z) : NLO.etaUndepleted(o.kappa, o.I0, z, o.dk);
    }

    function closedLabel(o) {
        if (o.qpm) return Math.abs(o.dkRes * o.L) < 1e-9 ? "tanh²((2/π)Γz)" : "(2Γz/π)² sinc²";
        return o.dk === 0 ? "tanh²(Γz)" : "undepleted sinc²";
    }

    function computeSHG() {
        const s = ctl.get();
        const o = shgSetup(s);
        const r = solve(o);
        const r2 = solve(o, 2, 0);
        shg = {
            o,
            r,
            r2,
            s
        };
    }

    function computeSlow() {
        const o = shg.o;
        // efficiency vs residual mismatch x = Δk_res·L
        const perRun = o.qpm ? o.nDom * 6 : Math.min(400, ctl.get().steps);
        const n = o.qpm ? Math.max(15, Math.min(81, Math.floor(3e5 / perRun))) : 121;
        const span = 4 * Math.PI;
        const xs = [],
            eta = [],
            ana = [];
        const G = o.qpm ? o.Gamma * 2 / Math.PI : o.Gamma;
        for (let i = 0; i < n; i++) {
            const x = -span + 2 * span * i / (n - 1);
            xs.push(x);
            const dk = (o.qpm ? 2 * Math.PI / o.qpm.period : 0) + x / o.L;
            const r = NLO.solveSHG({
                kappa: o.kappa,
                dk,
                L: o.L,
                I0: o.I0,
                steps: Math.min(400, ctl.get().steps),
                qpm: o.qpm ? {
                    period: o.qpm.period,
                    stepsPerDomain: 6
                } : null,
                record: 0
            });
            eta.push(r.eta);
            const h = x / 2,
                sc = Math.abs(h) < 1e-12 ? 1 : Math.sin(h) / h;
            ana.push((G * o.L) ** 2 * sc * sc);
        }
        sweep = {
            xs,
            eta,
            ana
        };
        // ideal Δk = 0 reference with the same d (for the QPM ratio)
        const ideal = NLO.solveSHG({
            kappa: o.kappa,
            dk: 0,
            L: o.L,
            I0: o.I0,
            steps: 400,
            record: 0
        });
        shg.ideal = ideal;
        // growth over the first coherence lengths (weak pump so the three curves are comparable)
        if (o.cr === "ppln" || o.cr === "custom") {
            const Lg = Number.isFinite(o.lc) && o.lc * 12 < o.L ? o.lc * 12 : o.L;
            const Iw = Math.min(o.I0, 1e-4 / Math.max(1e-30, (o.kappa * Lg) ** 2));
            const base = {
                kappa: o.kappa,
                L: Lg,
                I0: Iw,
                record: 900
            };
            const period = o.qpm ? o.qpm.period : 2 * o.lc;
            growth = {
                Lg,
                Iw,
                pm: NLO.solveSHG(Object.assign({
                    dk: 0,
                    steps: 600
                }, base)),
                none: NLO.solveSHG(Object.assign({
                    dk: o.dk,
                    steps: 1800
                }, base)),
                qpm: Number.isFinite(period) ? NLO.solveSHG(Object.assign({
                    dk: o.dk,
                    qpm: {
                        period,
                        stepsPerDomain: 24
                    }
                }, base)) : null
            };
        } else growth = null;
    }

    // ------------------------------------------------------------------ Kerr model
    function kerrSetup(s) {
        const T0 = s.T0 * PS,
            P0 = s.P0,
            b2 = s.b2 * PS * PS / KM,
            gam = s.gam / KM,
            Lf = s.Lf;
        const LD = b2 === 0 ? Infinity : T0 * T0 / Math.abs(b2);
        const LNL = gam * P0 > 0 ? 1 / (gam * P0) : Infinity;
        const N = Number.isFinite(LD) && Number.isFinite(LNL) ? Math.sqrt(LD / LNL) : (b2 === 0 ? Infinity : 0);
        const phi = gam * P0 * Lf;
        const zr = Number.isFinite(LD) ? Lf / LD : 0;
        const spread = b2 > 0 ? Math.sqrt(1 + (1 + 1.5 * N * N) * zr * zr) : Math.sqrt(1 + zr * zr);
        const win = T0 * Math.min(1500, Math.max(40, 16 * spread));
        const dtMax = Math.min(T0 / 10, Math.PI * T0 / (3 * (phi + 3 + 2 * (Number.isFinite(N) ? N : 0))));
        let Npts = core.nextPow2(Math.ceil(win / dtMax));
        Npts = Math.max(512, Math.min(8192, Npts));
        return {
            T0,
            P0,
            b2,
            gam,
            Lf,
            LD,
            LNL,
            N,
            phi,
            win,
            Npts,
            shape: s.shape,
            nz: Math.max(1, Math.round(s.nz)),
            undersampled: win / Npts > dtMax * 1.001
        };
    }

    function computeKerr() {
        const s = ctl.get();
        const k = kerrSetup(s);
        const p = NLO.makePulse({
            N: k.Npts,
            window: k.win,
            T0: k.T0,
            P0: k.P0,
            shape: k.shape
        });
        const opts = {
            t: p.t,
            re: p.re,
            im: p.im,
            dt: p.dt,
            beta2: k.b2,
            gamma: k.gam,
            L: k.Lf
        };
        const out = NLO.splitStep(Object.assign({}, opts, {
            steps: k.nz,
            record: Math.min(120, Math.max(24, k.nz))
        }));
        const out2 = NLO.splitStep(Object.assign({}, opts, {
            steps: 2 * k.nz
        }));
        const soliton = k.shape === "sech" && k.b2 < 0 && Math.abs(k.N - 1) < 1e-4;
        const exact = soliton ? NLO.solitonField(p.t, k.T0, k.P0, k.gam, k.Lf) : null;
        const Iin = Array.from(p.re, (v, i) => v * v + p.im[i] * p.im[i]);
        const Iout = Array.from(out.re, (v, i) => v * v + out.im[i] * out.im[i]);
        const sIn = NLO.spectrum(p.re, p.im, p.dt),
            sOut = NLO.spectrum(out.re, out.im, p.dt);
        // edge energy (periodic-window wrap warning)
        let eEdge = 0,
            eAll = 0;
        const edge = Math.floor(0.05 * k.Npts);
        for (let i = 0; i < k.Npts; i++) {
            eAll += Iout[i];
            if (i < edge || i >= k.Npts - edge) eEdge += Iout[i];
        }
        kerr = {
            k,
            p,
            out,
            out2,
            exact,
            soliton,
            Iin,
            Iout,
            sIn,
            sOut,
            edgeFrac: eEdge / eAll,
            richardson: NLO.relL2(out.re, out.im, out2.re, out2.im) * 4 / 3,
            trueErr: exact ? NLO.relL2(out.re, out.im, exact.re, exact.im) : NaN
        };
        conv = null;
    }

    function computeConv() {
        const {
            k,
            p,
            exact
        } = kerr;
        const opts = {
            t: p.t,
            re: p.re,
            im: p.im,
            dt: p.dt,
            beta2: k.b2,
            gamma: k.gam,
            L: k.Lf
        };
        const base = Math.pow(2, Math.floor(Math.log2(Math.max(4, Math.min(64, k.nz / 16)))));
        conv = NLO.convergence(opts, base, 6, exact);
        conv.refSteps = base * 128;
        conv.ref = exact ? "analytic soliton" : conv.refSteps + "-step reference";
    }

    // ------------------------------------------------------------------ scheduling
    let rafPending = false,
        slowTimer = 0,
        kerrTimer = 0,
        dirtyShg = true,
        dirtyKerr = true,
        lastState = "";

    function schedule() {
        const st = ctl.get();
        const key = (o) => JSON.stringify(o);
        const shgKeys = ["cr", "lam", "dth", "qpm", "per", "n1", "n2", "deff", "dk", "L", "Ilog", "steps"];
        const cur = {
            shg: key(shgKeys.map((kk) => st[kk])),
            kerr: key(Object.keys(st).filter((kk) => !shgKeys.includes(kk)).map((kk) => st[kk]))
        };
        const prev = lastState ? JSON.parse(lastState) : {};
        if (cur.shg !== prev.shg) dirtyShg = true;
        if (cur.kerr !== prev.kerr) dirtyKerr = true;
        lastState = JSON.stringify(cur);
        if (rafPending) return;
        rafPending = true;
        requestAnimationFrame(() => {
            rafPending = false;
            updateVisibility();
            if (dirtyShg) {
                dirtyShg = false;
                computeSHG();
                if (sweep) sweep.stale = true;
                renderSHG();
                clearTimeout(slowTimer);
                slowTimer = setTimeout(() => {
                    computeSlow();
                    renderSHG();
                }, 140);
            }
            if (dirtyKerr) {
                dirtyKerr = false;
                clearTimeout(kerrTimer);
                kerrTimer = setTimeout(() => {
                    computeKerr();
                    renderKerr();
                    setTimeout(() => {
                        if (!conv) {
                            computeConv();
                            renderKerr();
                        }
                    }, 60);
                }, 30);
            }
            updateLabels();
        });
    }

    // ------------------------------------------------------------------ labels / visibility
    function updateVisibility() {
        const s = ctl.get();
        const bi = s.cr === "bbo" || s.cr === "kdp";
        $("grpTheta").hidden = !bi;
        $("grpQpm").hidden = bi;
        $("grpCustom").hidden = s.cr !== "custom";
        const C = NLO.CRYSTALS[s.cr];
        $("crystalInfo").textContent = s.cr === "custom" ?
            "Idealised crystal: n(ω) and n(2ω) set only the coupling κ; Δk is entered directly (e.g. from a non-collinear geometry or temperature detuning)." :
            C.ref + ".";
    }

    function updateLabels() {
        const s = ctl.get();
        $("lamValue").textContent = s.lam + " nm";
        $("dthValue").textContent = s.dth + " mrad";
        $("perValue").textContent = s.per + " µm";
        $("n1Value").textContent = s.n1;
        $("n2Value").textContent = s.n2;
        $("deffValue").textContent = s.deff + " pm/V";
        $("dkValue").textContent = s.dk + " rad/mm";
        $("LValue").textContent = s.L + " mm";
        $("IValue").textContent = fmt(mwFromLog(s.Ilog), 3) + " MW/cm²";
        $("stepsValue").textContent = s.steps;
        $("T0Value").textContent = s.T0 + " ps";
        $("P0Value").textContent = s.P0 + " W";
        $("b2Value").textContent = String(s.b2).replace("-", "−") + " ps²/km";
        $("gamValue").textContent = s.gam + " /W/km";
        $("LfValue").textContent = s.Lf + " m";
        $("nzValue").textContent = s.nz;
    }

    // ------------------------------------------------------------------ SHG drawing
    const descZ = UI.describeCanvas($("zCanvas"), "Pump and second-harmonic intensity versus position in the crystal.", {
        label: "Pump and SH intensity along the crystal"
    });
    const descDk = UI.describeCanvas($("dkCanvas"), "Conversion efficiency versus phase mismatch.", {
        label: "Efficiency versus Δk·L"
    });
    const descPm = UI.describeCanvas($("pmCanvas"), "Phase-matching diagram.", {
        label: "Phase-matching diagram"
    });
    let zMap = null;

    const zPlot = UI.setupCanvas($("zCanvas"), {
        aspect: 2.1,
        minHeight: 360,
        maxHeight: 520,
        draw(ctx, w, h) {
            if (!shg) return;
            const {
                o,
                r
            } = shg;
            const zmm = Array.from(r.z, (z) => z / MM);
            const i2 = Array.from(r.I2, (v) => v / o.I0),
                i1 = Array.from(r.I1, (v) => v / o.I0);
            const ref = zmm.map((z) => closedForm(o, z * MM));
            const i2max = Math.max(...i2, 1e-30);
            const shScale = i2max < 0.01 ? Math.pow(10, -Math.floor(Math.log10(i2max))) : 1;
            const cur = Number.isFinite(zCursor) ? zCursor : null;
            const lab = (v) => fmtE(v, 3);
            const hTop = Math.round(h * 0.56);
            const x = {
                min: 0,
                max: o.L / MM,
                label: "z",
                unit: "mm"
            };
            zMap = UI.plot(ctx, {
                x: 0,
                y: 0,
                w,
                h: hTop
            }, {
                x: Object.assign({}, x, {
                    label: "",
                    unit: ""
                }),
                y: {
                    min: 0,
                    max: Math.max(i2max * 1.12, 1e-30) * shScale,
                    label: shScale > 1 ? `I₂/I₁(0) × ${pow10(shScale)}` : "I₂/I₁(0)"
                },
                series: [{
                        xs: zmm,
                        ys: i2.map((v) => v * shScale),
                        color: COL.sh,
                        label: "SH, RK4",
                        width: 2.5
                    },
                    {
                        xs: zmm,
                        ys: ref.map((v) => v * shScale),
                        color: COL.ref,
                        dash: [7, 4],
                        label: closedLabel(o)
                    }
                ],
                legendPosition: "left",
                margin: {
                    b: 22,
                    l: 62
                },
                cursor: cur != null ? {
                    x: cur,
                    label: `z = ${cur.toFixed(3)} mm  η = ${lab(UI.interpAt(zmm, i2, cur))}`
                } : null
            });
            UI.plot(ctx, {
                x: 0,
                y: hTop,
                w,
                h: h - hTop
            }, {
                x,
                y: {
                    min: Math.min(...i1) - 0.05 * (1 - Math.min(...i1) + 1e-9),
                    max: 1 + 0.05 * (1 - Math.min(...i1) + 1e-9) + 1e-12,
                    label: "I₁/I₁(0)"
                },
                series: [{
                    xs: zmm,
                    ys: i1,
                    color: COL.pump,
                    label: "pump, RK4",
                    width: 2.5
                }],
                legendPosition: "left",
                margin: {
                    l: 62
                },
                cursor: cur != null ? {
                    x: cur,
                    label: ""
                } : null
            });
        }
    });
    $("zCanvas").addEventListener("pointermove", (e) => {
        if (!zMap) return;
        const rct = e.currentTarget.getBoundingClientRect(),
            px = e.clientX - rct.left;
        if (px >= zMap.plot.x && px <= zMap.plot.x + zMap.plot.w) {
            zCursor = zMap.pxToX(px);
            zPlot.redraw();
            cursorReadout();
        }
    });
    $("zCanvas").addEventListener("pointerleave", () => {
        zCursor = NaN;
        zPlot.redraw();
        cursorReadout();
    });

    function cursorReadout() {
        if (!shg || !Number.isFinite(zCursor)) {
            $("rCursor").textContent = "hover the z plot";
            return;
        }
        const {
            o,
            r
        } = shg, zmm = Array.from(r.z, (z) => z / MM);
        const i2 = UI.interpAt(zmm, Array.from(r.I2), zCursor) / o.I0,
            i1 = UI.interpAt(zmm, Array.from(r.I1), zCursor) / o.I0;
        $("rCursor").textContent = `z = ${zCursor.toFixed(4)} mm: I₂/I₁(0) = ${fmtE(i2, 4)}, I₁/I₁(0) = ${fmtE(i1, 5)}`;
    }

    const dkPlot = UI.setupCanvas($("dkCanvas"), {
        aspect: 1.45,
        minHeight: 250,
        draw(ctx, w, h) {
            if (!shg || !sweep) return;
            const {
                o,
                r
            } = shg;
            const numMax = Math.max(...sweep.eta, 1e-30);
            const scale = numMax < 0.01 ? Math.pow(10, -Math.floor(Math.log10(numMax))) : 1;
            const xCur = o.dkRes * o.L;
            const ymax = numMax * 1.2 * scale;
            UI.plot(ctx, {
                x: 0,
                y: 0,
                w,
                h
            }, {
                x: {
                    min: -4 * Math.PI,
                    max: 4 * Math.PI,
                    label: o.qpm ? "(Δk − 2π/Λ)·L" : "Δk·L",
                    unit: "rad",
                    ticks: Object.assign((w < 420 ? [-4, -2, 0, 2, 4] : [-4, -3, -2, -1, 0, 1, 2, 3, 4]).map((k) => k * Math.PI), {
                        step: Math.PI
                    }),
                    format: (v) => {
                        const k = Math.round(v / Math.PI);
                        return k === 0 ? "0" : (k === 1 ? "" : k === -1 ? "−" : String(k).replace("-", "−")) + "π";
                    }
                },
                y: {
                    min: 0,
                    max: ymax,
                    label: scale > 1 ? `η × ${pow10(scale)}` : "η"
                },
                series: [{
                        xs: sweep.xs,
                        ys: sweep.eta.map((v) => v * scale),
                        color: COL.sh,
                        label: "RK4",
                        width: 2.5
                    },
                    {
                        xs: sweep.xs,
                        ys: sweep.ana.map((v) => v * scale),
                        color: COL.ref,
                        dash: [7, 4],
                        label: o.qpm ? "(2/π)²(ΓL)² sinc²" : "(ΓL)² sinc²"
                    }
                ],
                markers: [{
                    x: Math.max(-4 * Math.PI, Math.min(4 * Math.PI, xCur)),
                    label: Math.abs(xCur) > 4 * Math.PI ? "current (off scale)" : "current",
                    color: TH.marker
                }],
                hlines: [{
                    y: r.eta * scale,
                    color: "rgba(248,212,119,0.35)"
                }],
                legendPosition: "left",
                margin: {
                    l: 58
                }
            });
            if (sweep.stale) {
                ctx.save();
                ctx.fillStyle = TH.textMuted;
                ctx.font = "12px " + TH.font;
                ctx.textAlign = "right";
                ctx.fillText("updating…", w - 14, h - 50);
                ctx.restore();
            }
        }
    });

    let pmMap = null;
    const pmPlot = UI.setupCanvas($("pmCanvas"), {
        aspect: 1.45,
        minHeight: 250,
        draw(ctx, w, h) {
            if (!shg) return;
            const {
                o
            } = shg;
            if (o.cr === "bbo" || o.cr === "kdp") {
                const a = NLO.indices(o.cr, o.lam),
                    b = NLO.indices(o.cr, o.lam / 2);
                const th = core.linspace(0, 90, 181),
                    ne2 = th.map((t) => NLO.neTheta(b.no, b.ne, t * Math.PI / 180));
                const lo = Math.min(b.ne, a.no) - 0.01,
                    hi = Math.max(b.no, a.no) + 0.01;
                const mk = [];
                if (Number.isFinite(o.thpm)) mk.push({
                    x: o.thpm * 180 / Math.PI,
                    label: "θpm " + (o.thpm * 180 / Math.PI).toFixed(2) + "°"
                });
                pmMap = UI.plot(ctx, {
                    x: 0,
                    y: 0,
                    w,
                    h
                }, {
                    x: {
                        min: 0,
                        max: 90,
                        label: "θ (k to optic axis)",
                        unit: "°"
                    },
                    y: {
                        min: lo,
                        max: hi,
                        label: "index"
                    },
                    series: [{
                            xs: Array.from(th),
                            ys: th.map(() => a.no),
                            color: COL.pump,
                            label: "n_o(ω)",
                            width: 2.5
                        },
                        {
                            xs: Array.from(th),
                            ys: ne2,
                            color: COL.sh,
                            dash: [7, 4],
                            label: "n_e(2ω, θ)",
                            width: 2.5
                        }
                    ],
                    markers: mk,
                    legendPosition: "right"
                });
            } else if (growth) {
                const lc = Number.isFinite(o.lc) ? o.lc : growth.Lg;
                const xs = (r) => Array.from(r.z, (z) => z / lc);
                const n = (r) => Array.from(r.I2, (v) => v / growth.Iw);
                const all = [growth.pm, growth.none, growth.qpm].filter(Boolean);
                const ymax = Math.max(...all.map((r) => Math.max(...n(r)))) * 1.08;
                const series = [{
                        xs: xs(growth.pm),
                        ys: n(growth.pm),
                        color: COL.ideal,
                        dash: [2, 3],
                        label: "Δk = 0 (ideal)"
                    },
                    {
                        xs: xs(growth.none),
                        ys: n(growth.none),
                        color: COL.none,
                        dash: [7, 4],
                        label: "no poling"
                    }
                ];
                if (growth.qpm) series.push({
                    xs: xs(growth.qpm),
                    ys: n(growth.qpm),
                    color: COL.qpm,
                    label: o.qpm ? "poled, Λ" : "poled, Λ = 2L_c",
                    width: 2.5
                });
                pmMap = UI.plot(ctx, {
                    x: 0,
                    y: 0,
                    w,
                    h
                }, {
                    x: {
                        min: 0,
                        max: growth.Lg / lc,
                        label: Number.isFinite(o.lc) ? "z / L_c" : "z / L"
                    },
                    y: {
                        min: 0,
                        max: ymax,
                        label: "I₂/I₁(0) (weak pump)"
                    },
                    series,
                    legendPosition: "left"
                });
            }
        }
    });

    function renderSHG() {
        if (!shg) return;
        const {
            o,
            r,
            r2,
            s
        } = shg;
        const warn = o.warn.slice();
        if (o.Gamma * o.L > 0.3 && o.dk !== 0 && !o.qpm) warn.push("ΓL > 0.3 with Δk ≠ 0: the dashed undepleted sinc² reference is no longer accurate. Trust the RK4 curve.");
        if (mwFromLog(s.Ilog) > 1000) warn.push("Above ~1 GW/cm² most crystals are damaged by ns pulses; this is a plane-wave idealisation.");
        $("shgWarn").hidden = !warn.length;
        $("shgWarn").textContent = warn.join(" ");

        $("rN").textContent = `${o.n1.toFixed(5)} / ${o.n2.toFixed(5)}`;
        $("rDk").textContent = `${fmtE(o.dk / 1e3, 4)} rad/mm` + (o.qpm ? `; residual Δk − 2π/Λ = ${fmtE(o.dkRes / 1e3, 4)} rad/mm` : "");
        $("rLc").textContent = Number.isFinite(o.lc) ? fmtLen(o.lc) + ` (Λ for first-order QPM = ${fmtLen(2 * o.lc)})` : "∞ (phase matched)";
        $("rTheta").textContent = o.theta != null ? (Number.isFinite(o.thpm) ? (o.thpm * 180 / Math.PI).toFixed(3) + "°" : "none") + " / " + (o.theta * 180 / Math.PI).toFixed(4) + "°" : "— (θ = 90°, non-critical)";
        $("rAccept").textContent = o.dDk ? `${fmt(2 * SINC2_HALF / (o.L * Math.abs(o.dDk)) * 1e3, 3)} mrad internal (${fmt(2 * SINC2_HALF / (0.01 * Math.abs(o.dDk)) * 1e3, 3)} mrad·cm)` : o.qpm ? `period tolerance ≈ ${fmt(2 * SINC2_HALF * o.qpm.period / (2 * Math.PI * o.L) * o.qpm.period / UM * 1e3, 3)} nm FWHM` : "—";
        $("rWalk").textContent = o.walkoff ? `${fmt(Math.abs(o.walkoff) * 1e3, 3)} mrad; lateral shift ρL = ${fmtLen(Math.abs(o.walkoff) * o.L)}` : "0 (propagation along a principal axis)";
        $("rKappa").textContent = `${fmt(o.dEff / PMV, 3)} pm/V${o.qpm ? " (×2/π on average)" : ""} / κ = ${o.kappa.toExponential(4)} m⁻¹(W/m²)^−½`;
        $("rGamma").textContent = `Γ = ${fmt(o.Gamma, 4)} m⁻¹; ΓL = ${fmt(o.Gamma * o.L, 4)}`;
        $("rEta").textContent = `${fmtPct(r.eta)} (${r.steps} steps${o.qpm ? `, ${o.nDom} domains × ${o.spd}` : ""})`;
        const etaA = closedForm(o, o.L);
        $("rEtaA").textContent = `${fmtPct(etaA)}: ${closedLabel(o)}` + (etaA > 1 ? " (unphysical: assumption violated)" : "");
        $("rConv").textContent = `${fmtPct(r2.eta)}; |Δη|/η = ${fmtE(Math.abs(r2.eta - r.eta) / Math.max(r.eta, 1e-300), 2)}`;
        $("rEnergy").textContent = fmtE(r.energyError, 2);
        const f0 = NLO.photonFlux(o.I0, 0, o.lam),
            f1 = NLO.photonFlux(r.I1out, r.I2out, o.lam);
        $("rMR").textContent = `${f0.N1.toExponential(5)} → ${(f1.N1 + 2 * f1.N2).toExponential(5)} photons s⁻¹m⁻² (rel. error ${fmtE(r.mrError, 1)})`;
        $("rQpm").textContent = o.qpm && shg.ideal ? `η/η(Δk=0) = ${(r.eta / shg.ideal.eta).toFixed(4)}; (2/π)² = 0.4053` : "— (poling off)";
        cursorReadout();

        $("stat-eta").textContent = fmtPct(r.eta);
        $("stat-dkl").textContent = fmt(o.dkRes * o.L, 3);
        $("stat-gl").textContent = fmt(o.Gamma * o.L, 3);

        const zPts = Array.from(r.z);
        let zHalf = NaN;
        for (let i = 1; i < zPts.length; i++)
            if (r.I2[i] >= 0.5 * r.eta * o.I0) {
                zHalf = zPts[i];
                break;
            }
        descZ.update(`Along ${s.L} mm the SH grows to η = ${fmtPct(r.eta)} while the pump falls to ${fmtPct(r.I1out / o.I0)}. Half the final SH is reached at z ≈ ${fmtLen(zHalf)}. Closed-form ${closedLabel(o)} gives ${fmtPct(etaA)}.`);
        if (sweep && !sweep.stale) {
            let im = 0;
            sweep.eta.forEach((v, i) => {
                if (v > sweep.eta[im]) im = i;
            });
            descDk.update(`Numerical efficiency peaks at ${fmtPct(sweep.eta[im])} at mismatch ${fmt(sweep.xs[im], 3)} rad; the current setting ${fmt(o.dkRes * o.L, 3)} rad gives ${fmtPct(r.eta)}. Undepleted sinc² peak ${fmtPct(Math.max(...sweep.ana))}.`);
        }
        if (o.cr === "bbo" || o.cr === "kdp") {
            $("pmBadge").textContent = "indices vs θ";
            $("pmCaption").textContent = "Solid: ordinary index of the pump n_o(ω), independent of θ. Dashed: extraordinary index of the SH n_e(2ω, θ). Phase matching (Δk = 0) occurs where they cross. The dispersion n_o(2ω) > n_o(ω) is compensated by birefringence.";
            descPm.update(`n_o(ω) = ${o.n1.toFixed(4)} crosses n_e(2ω, θ) at θpm = ${Number.isFinite(o.thpm) ? (o.thpm * 180 / Math.PI).toFixed(2) + "°" : "no angle"}.`);
        } else {
            $("pmBadge").textContent = "SH growth, first coherence lengths";
            $("pmCaption").textContent = "Weak-pump SH intensity over the first 12 coherence lengths (or the whole crystal if shorter). Dotted: ideal Δk = 0. Dashed: no poling, which oscillates with period 2L_c. Solid: poled crystal, where each domain flip resets the phase and the SH grows in steps.";
            if (growth) descPm.update(`Over ${fmt(growth.Lg / (Number.isFinite(o.lc) ? o.lc : growth.Lg), 3)} coherence lengths the poled crystal reaches ${growth.qpm ? fmtE(growth.qpm.I2out / growth.pm.I2out, 3) : "—"} of the ideal SH; the unpoled crystal ${fmtE(growth.none.I2out / growth.pm.I2out, 3)}.`);
        }
        zPlot.redraw();
        dkPlot.redraw();
        pmPlot.redraw();
    }

    // ------------------------------------------------------------------ Kerr drawing
    const descEvo = UI.describeCanvas($("evoCanvas"), "Pulse evolution along the fibre.", {
        label: "Pulse power versus time and distance"
    });
    const descTime = UI.describeCanvas($("timeCanvas"), "Input and output temporal profiles.", {
        label: "Temporal profile"
    });
    const descSpec = UI.describeCanvas($("specCanvas"), "Input and output spectra.", {
        label: "Power spectrum"
    });
    const descConv = UI.describeCanvas($("convCanvas"), "Convergence of the split-step solver.", {
        label: "Split-step convergence"
    });

    function displayWindow() {
        const {
            k,
            p,
            out,
            Iin
        } = kerr;
        let m = 0;
        for (const s of out.snaps)
            for (let i = 0; i < s.length; i++) m = Math.max(m, s[i]);
        let ext = 0;
        const thr = 1e-3 * m;
        for (const s of out.snaps)
            for (let i = 0; i < s.length; i++)
                if (s[i] > thr) ext = Math.max(ext, Math.abs(p.t[i]));
        for (let i = 0; i < Iin.length; i++)
            if (Iin[i] > thr) ext = Math.max(ext, Math.abs(p.t[i]));
        const half = Math.min(k.win / 2, Math.max(4 * k.T0, ext * 1.15));
        const u = half >= 0.5 * PS ? {
            s: PS,
            u: "ps"
        } : {
            s: 1e-15,
            u: "fs"
        };
        return {
            half,
            u,
            peak: m
        };
    }

    const evoPlot = UI.setupCanvas($("evoCanvas"), {
        aspect: 2.4,
        minHeight: 260,
        maxHeight: 460,
        draw(ctx, w, h) {
            if (!kerr) return;
            const {
                k,
                p,
                out
            } = kerr;
            const dw = displayWindow();
            const i0 = Math.max(0, p.t.findIndex((t) => t >= -dw.half)),
                i1 = (() => {
                    let j = p.t.length - 1;
                    while (j > 0 && p.t[j] > dw.half) j--;
                    return j;
                })();
            const nxAll = i1 - i0 + 1,
                nx = Math.min(480, nxAll),
                ny = out.snaps.length;
            const data = new Float64Array(nx * ny);
            const Pref = Math.max(k.P0, 1e-30);
            const cmax = Math.max(1, dw.peak / Pref);
            for (let iy = 0; iy < ny; iy++) {
                const sn = out.snaps[iy];
                for (let ix = 0; ix < nx; ix++) {
                    const a = i0 + Math.floor(ix * nxAll / nx),
                        b = Math.max(a + 1, i0 + Math.floor((ix + 1) * nxAll / nx));
                    let mx = 0;
                    for (let j = a; j < b; j++) mx = Math.max(mx, sn[j]);
                    data[iy * nx + ix] = mx / Pref;
                }
            }
            const zu = k.Lf >= 1000 ? {
                s: 1000,
                u: "km"
            } : {
                s: 1,
                u: "m"
            };
            const map = UI.plot(ctx, {
                x: 0,
                y: 0,
                w,
                h
            }, {
                x: {
                    min: -dw.half / dw.u.s,
                    max: dw.half / dw.u.s,
                    label: "T",
                    unit: dw.u.u
                },
                y: {
                    min: 0,
                    max: k.Lf / zu.s,
                    label: "z",
                    unit: zu.u
                },
                series: [],
                legend: false,
                margin: {
                    r: 78
                }
            });
            UI.imageFromArray(ctx, data, nx, ny, map.plot, "inferno", {
                min: 0,
                max: cmax
            });
            ctx.strokeStyle = TH.axis;
            ctx.lineWidth = 1;
            ctx.strokeRect(map.plot.x + 0.5, map.plot.y + 0.5, map.plot.w - 1, map.plot.h - 1);
            UI.drawColorbar(ctx, {
                x: map.plot.x + map.plot.w + 12,
                y: map.plot.y,
                w: 12,
                h: map.plot.h
            }, "inferno", {
                min: 0,
                max: cmax,
                label: "|A|²/P₀"
            });
            // soliton-period guides
            if (k.b2 < 0 && Number.isFinite(k.LD)) {
                const z0 = Math.PI * k.LD / 2;
                ctx.save();
                ctx.strokeStyle = "rgba(255,255,255,0.35)";
                ctx.setLineDash([3, 5]);
                ctx.fillStyle = TH.textMuted;
                ctx.font = "11px " + TH.font;
                for (let j = 1; j * z0 <= k.Lf && j <= 12; j++) {
                    const py = map.yToPx(j * z0 / zu.s);
                    ctx.beginPath();
                    ctx.moveTo(map.plot.x, py);
                    ctx.lineTo(map.plot.x + map.plot.w, py);
                    ctx.stroke();
                    if (j <= 3) ctx.fillText(j + "z₀", map.plot.x + 4, py - 3);
                }
                ctx.restore();
            }
        }
    });

    const timePlot = UI.setupCanvas($("timeCanvas"), {
        aspect: 1.45,
        minHeight: 250,
        draw(ctx, w, h) {
            if (!kerr) return;
            const {
                k,
                p,
                Iin,
                Iout
            } = kerr;
            const dw = displayWindow();
            const sel = [];
            for (let i = 0; i < p.t.length; i++)
                if (Math.abs(p.t[i]) <= dw.half) sel.push(i);
            const xs = sel.map((i) => p.t[i] / dw.u.s);
            const series = [{
                    xs,
                    ys: sel.map((i) => Iin[i] / k.P0),
                    color: COL.pump,
                    dash: [7, 4],
                    label: "input"
                },
                {
                    xs,
                    ys: sel.map((i) => Iout[i] / k.P0),
                    color: COL.sh,
                    label: "output",
                    width: 2.5
                }
            ];
            if (k.b2 < 0 && k.shape === "sech") {
                series.push({
                    xs,
                    ys: sel.map((i) => 1 / Math.cosh(p.t[i] / k.T0) ** 2),
                    color: COL.ref,
                    dash: [2, 3],
                    label: "N = 1 soliton"
                });
            }
            const ymax = Math.max(1, ...Iout.map((v) => v / k.P0)) * 1.08;
            UI.plot(ctx, {
                x: 0,
                y: 0,
                w,
                h
            }, {
                x: {
                    min: -dw.half / dw.u.s,
                    max: dw.half / dw.u.s,
                    label: "T",
                    unit: dw.u.u
                },
                y: {
                    min: 0,
                    max: ymax,
                    label: "|A|²/P₀"
                },
                series,
                legendPosition: "right"
            });
        }
    });

    const specPlot = UI.setupCanvas($("specCanvas"), {
        aspect: 1.45,
        minHeight: 250,
        draw(ctx, w, h) {
            if (!kerr) return;
            const {
                sIn,
                sOut
            } = kerr;
            const m0 = Math.max(...sIn.S);
            let ext = 0;
            const mo = Math.max(...sOut.S);
            for (let i = 0; i < sOut.nu.length; i++)
                if (sOut.S[i] > 1e-3 * mo || sIn.S[i] > 1e-3 * m0) ext = Math.max(ext, Math.abs(sOut.nu[i]));
            const u = ext >= 0.5e12 ? {
                s: 1e12,
                u: "THz"
            } : {
                s: 1e9,
                u: "GHz"
            };
            const half = ext * 1.15 / u.s;
            const sel = [];
            for (let i = 0; i < sIn.nu.length; i++)
                if (Math.abs(sIn.nu[i] / u.s) <= half) sel.push(i);
            const xs = sel.map((i) => sIn.nu[i] / u.s);
            UI.plot(ctx, {
                x: 0,
                y: 0,
                w,
                h
            }, {
                x: {
                    min: -half,
                    max: half,
                    label: "ν − ν₀",
                    unit: u.u
                },
                y: {
                    min: 0,
                    max: Math.max(1, mo / m0) * 1.08,
                    label: "|Ã|² / input peak"
                },
                series: [{
                        xs,
                        ys: sel.map((i) => sIn.S[i] / m0),
                        color: COL.pump,
                        dash: [7, 4],
                        label: "input"
                    },
                    {
                        xs,
                        ys: sel.map((i) => sOut.S[i] / m0),
                        color: COL.sh,
                        label: "output",
                        width: 2
                    }
                ],
                legendPosition: "right"
            });
        }
    });

    const convPlot = UI.setupCanvas($("convCanvas"), {
        aspect: 3.0,
        minHeight: 230,
        maxHeight: 340,
        draw(ctx, w, h) {
            if (!kerr) return;
            if (!conv) {
                ctx.fillStyle = TH.textMuted;
                ctx.font = "13px " + TH.font;
                ctx.fillText("computing convergence study…", 20, 30);
                return;
            }
            const {
                steps,
                errors
            } = conv;
            const good = errors.map((e) => Math.max(e, 1e-16));
            const ymin = Math.max(1e-16, Math.min(...good) / 3),
                ymax = Math.max(...good) * 30;
            const guideY = steps.map((s) => good[0] * (steps[0] / s) ** 2);
            const nzC = kerr.k.nz;
            UI.plot(ctx, {
                x: 0,
                y: 0,
                w,
                h
            }, {
                x: {
                    min: steps[0] / 1.4,
                    max: Math.max(steps[steps.length - 1], nzC) * 1.4,
                    log: true,
                    label: "split steps"
                },
                y: {
                    min: ymin,
                    max: ymax,
                    log: true,
                    label: "rel. L2 error"
                },
                series: [{
                        xs: steps,
                        ys: good,
                        color: COL.sh,
                        label: "error vs " + (conv.ref === "analytic soliton" ? "exact" : "reference"),
                        points: true,
                        pointRadius: 3.5,
                        width: 2
                    },
                    Number.isFinite(conv.order) ? {
                        xs: steps,
                        ys: guideY,
                        color: COL.ref,
                        dash: [7, 4],
                        label: "slope −2"
                    } : {
                        xs: [],
                        ys: []
                    }
                ],
                markers: [{
                    x: nzC,
                    label: "your " + nzC + " steps"
                }],
                legendPosition: "left"
            });
        }
    });

    function renderKerr() {
        if (!kerr) return;
        const {
            k,
            p,
            out,
            Iin,
            Iout,
            sIn,
            sOut
        } = kerr;
        const warn = [];
        if (kerr.edgeFrac > 1e-6) warn.push(`${fmtE(kerr.edgeFrac, 1)} of the energy reaches the outer 5 % of the periodic time window: radiation may wrap around.`);
        if (k.undersampled) warn.push("The time grid is capped at 8192 points: the spectrum may alias at this power and length. Reduce P₀ or L_f.");
        if (k.nz * k.Npts > 4e6) warn.push("Large step × grid product: updates may be slow.");
        $("kerrWarn").hidden = !warn.length;
        $("kerrWarn").textContent = warn.join(" ");

        $("kLD").textContent = Number.isFinite(k.LD) ? fmtLen(k.LD) + ` (L_f = ${fmt(k.Lf / k.LD, 3)} L_D)` : "∞ (β₂ = 0)";
        $("kLNL").textContent = Number.isFinite(k.LNL) ? fmtLen(k.LNL) : "∞ (no Kerr)";
        $("kN").textContent = Number.isFinite(k.N) ? fmt(k.N, 4) + (k.b2 > 0 ? " (normal GVD: no bright soliton)" : "") : "—";
        $("kZ0").textContent = Number.isFinite(k.LD) ? fmtLen(Math.PI * k.LD / 2) : "—";
        $("kPhi").textContent = `${fmt(k.phi, 4)} rad = ${fmt(k.phi / Math.PI, 3)}π`;
        const ic = Math.floor(k.Npts / 2);
        const phNum = Math.atan2(out.im[ic], out.re[ic]);
        const wrap = (x) => {
            let y = x % (2 * Math.PI);
            if (y > Math.PI) y -= 2 * Math.PI;
            if (y <= -Math.PI) y += 2 * Math.PI;
            return y;
        };
        $("kPhiNum").textContent = k.b2 === 0 ? `φ(0) mod 2π = ${phNum.toFixed(6)} (γP₀L mod 2π = ${wrap(k.phi).toFixed(6)})` : "— (only exact for β₂ = 0)";
        const pk = Math.max(...Iout);
        $("kPeak").textContent = k.P0 > 0 ? fmt(pk / k.P0, 5) : "—";
        const tw = NLO.rmsWidth(p.t, Iout) / NLO.rmsWidth(p.t, Iin),
            sw = NLO.rmsWidth(sOut.nu, sOut.S) / NLO.rmsWidth(sIn.nu, sIn.S);
        $("kTw").textContent = fmt(tw, 4);
        $("kSw").textContent = fmt(sw, 4) + (k.b2 === 0 && k.shape === "gauss" ? ` (Agrawal 4.1.13: ${fmt(NLO.spmGaussianBroadening(k.phi), 4)})` : "");
        $("kEnergy").textContent = fmt(out.energyOut / out.energyIn, 12);
        $("kErr").textContent = `≈ ${fmtE(kerr.richardson, 2)} (Richardson from ${k.nz} vs ${2 * k.nz} steps)` + (Number.isFinite(kerr.trueErr) ? `; vs analytic soliton ${fmtE(kerr.trueErr, 2)}` : "");
        $("kOrder").textContent = !conv ? "computing…" : Number.isFinite(conv.order) ? `${fmt(conv.order, 3)} (expected 2; vs ${conv.ref})` :
            "— (all errors at round-off: with β₂ = 0 or γ = 0 each step is exact)";
        $("kGrid").textContent = `${k.Npts} points over ${core.formatSI(k.win, "s")} (Δt = ${core.formatSI(p.dt, "s")}); step h = ${fmtLen(k.Lf / k.nz)}`;
        $("stat-N").textContent = Number.isFinite(k.N) ? fmt(k.N, 3) : "∞";
        $("stat-phi").textContent = fmt(k.phi, 3);

        descEvo.update(`Over ${fmtLen(k.Lf)} the peak power changes from P₀ = ${fmt(k.P0, 4)} W to ${fmt(pk, 4)} W; rms duration ×${fmt(tw, 3)}. Soliton order N = ${fmt(k.N, 3)}.`);
        descTime.update(`Output peak ${fmt(pk / Math.max(k.P0, 1e-30), 4)} P₀, rms width ${fmt(tw, 4)} × input.`);
        descSpec.update(`Output rms spectral width ${fmt(sw, 4)} × input; peak nonlinear phase ${fmt(k.phi, 3)} rad.`);
        if (conv) descConv.update(`Errors ${conv.errors.map((e) => e.toExponential(1)).join(", ")} at steps ${conv.steps.join(", ")}; observed order ${fmt(conv.order, 3)}.`);
        evoPlot.redraw();
        timePlot.redraw();
        specPlot.redraw();
        convPlot.redraw();
    }

    // ------------------------------------------------------------------ presets
    const SHG_PRESETS = {
        bboWeak: {
            s: {
                cr: "bbo",
                lam: 1064,
                dth: 0,
                L: 10,
                Ilog: 0,
                steps: 400
            },
            note: "Expect η ≈ 2.4 % with RK4 and tanh² on top of each other; (ΓL)² differs by only 1.6 %. The sweep traces a clean sinc² with its first zeros at ΔkL = ±2π."
        },
        bboDeplete: {
            s: {
                cr: "bbo",
                lam: 1064,
                dth: 0,
                L: 10,
                Ilog: Math.log10(300),
                steps: 400
            },
            note: "ΓL ≈ 2.7: the pump is almost fully converted (η ≈ 98 %) and follows sech²(Γz). The undepleted formula would claim 727 %. The sweep curve is no longer a sinc²: it is flattened and broadened."
        },
        kdpDetune: {
            s: {
                cr: "kdp",
                lam: 1064,
                dth: 0.5638,
                L: 10,
                Ilog: 0,
                steps: 400
            },
            note: "The detune is half the FWHM angular acceptance of a 1 cm KDP crystal, so ΔkL ≈ 2.78 and η falls to half of its phase-matched value."
        },
        pplnQpm: {
            s: {
                cr: "ppln",
                lam: 1064,
                qpm: true,
                per: 6.818,
                L: 1,
                Ilog: 0,
                steps: 400
            },
            note: "First-order QPM: η ≈ 0.64 %, which is (2/π)² = 0.405 of an ideally phase-matched crystal with the same d₃₃. Zoom into the growth plot to see the staircase."
        },
        pplnOff: {
            s: {
                cr: "ppln",
                lam: 1064,
                qpm: false,
                per: 6.818,
                L: 0.05,
                Ilog: 0,
                steps: 2000
            },
            note: "Without poling the SH oscillates with period 2L_c ≈ 6.8 µm and never exceeds (2/π)² of the phase-matched value at z = L_c."
        },
        custom: {
            s: {
                cr: "custom",
                lam: 1064,
                n1: 1.6,
                n2: 1.6,
                deff: 2,
                dk: 0.3,
                qpm: false,
                L: 10,
                Ilog: 0,
                steps: 400
            },
            note: "Custom Δk = 0.3 rad/mm with L = 10 mm gives ΔkL = 3 rad, just past the sinc² half-width: η ≈ 0.44 × its phase-matched value. Try Δk = 0.6283 rad/mm (ΔkL = 2π) for the first zero."
        }
    };
    const P1 = (b2, gam, T0) => Math.abs(b2) / (gam * T0 * T0);
    const KERR_PRESETS = {
        soliton: {
            s: {
                shape: "sech",
                T0: 1,
                b2: -20,
                gam: 1.3,
                P0: 15.3846,
                Lf: 250,
                nz: 200
            },
            note: "N = 1 over 5 L_D: the output is identical to the input in both time and frequency (peak ≈ 1.000). Only the phase γP₀z/2 accumulates."
        },
        soliton2: {
            s: {
                shape: "sech",
                T0: 1,
                b2: -20,
                gam: 1.3,
                P0: 61.5385,
                Lf: 157.08,
                nz: 400
            },
            note: "N = 2: the pulse compresses, splits in the spectrum and reforms at every soliton period z₀ = πL_D/2 ≈ 78.5 m (dotted guides)."
        },
        spm: {
            s: {
                shape: "gauss",
                T0: 1,
                b2: 0,
                gam: 1.3,
                P0: 108.75,
                Lf: 100,
                nz: 50
            },
            note: "φmax = 4.5π: the temporal profile is unchanged but the spectrum shows 5 peaks (Agrawal Fig. 4.2). The split-step is exact at any step count here."
        },
        normal: {
            s: {
                shape: "gauss",
                T0: 1,
                b2: 20,
                gam: 1.3,
                P0: 150,
                Lf: 100,
                nz: 400
            },
            note: "Normal GVD + SPM: the pulse broadens faster than by dispersion alone and becomes flat-topped with a nearly linear chirp, which is the basis of fibre-grating pulse compression."
        },
        linear: {
            s: {
                shape: "gauss",
                T0: 1,
                b2: -20,
                gam: 0,
                P0: 15.3846,
                Lf: 100,
                nz: 10
            },
            note: "γ = 0: pure dispersion. The rms width grows to √(1 + (L/L_D)²) = √5 ≈ 2.24 and the spectrum is untouched."
        }
    };

    function applyPreset(kind, name) {
        const P = (kind === "shg" ? SHG_PRESETS : KERR_PRESETS)[name];
        if (!P) return;
        const base = kind === "shg" ?
            {
                cr: DEFAULTS.cr,
                lam: DEFAULTS.lam,
                dth: 0,
                qpm: true,
                per: DEFAULTS.per,
                n1: 1.6,
                n2: 1.6,
                deff: 2,
                dk: 0,
                L: 10,
                Ilog: 0,
                steps: 400
            } :
            {};
        ctl.set(Object.assign(base, P.s));
        $(kind === "shg" ? "shgNote" : "kerrNote").textContent = P.note;
        document.querySelectorAll(kind === "shg" ? "[data-preset]" : "[data-kpreset]").forEach((b) => b.classList.toggle("active", b.dataset[kind === "shg" ? "preset" : "kpreset"] === name));
        url.update();
        schedule();
    }
    document.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => applyPreset("shg", b.dataset.preset)));
    document.querySelectorAll("[data-kpreset]").forEach((b) => b.addEventListener("click", () => applyPreset("kerr", b.dataset.kpreset)));

    $("perMatch").addEventListener("click", () => {
        const o = shgSetup(ctl.get());
        if (Number.isFinite(o.dk) && o.dk !== 0) ctl.set({
            per: Math.min(1000, Math.max(1, 2 * Math.PI / Math.abs(o.dk) / UM)).toFixed(3)
        });
    });
    $("solitonBtn").addEventListener("click", () => {
        const s = ctl.get();
        if (s.b2 >= 0 || s.gam <= 0) {
            $("kerrNote").textContent = "A bright soliton needs β₂ < 0 and γ > 0.";
            return;
        }
        ctl.set({
            P0: Math.min(500, P1(s.b2, s.gam, s.T0)).toFixed(4)
        });
    });
    $("resetBtn").addEventListener("click", () => {
        ctl.set(DEFAULTS);
        $("shgNote").textContent = "";
        $("kerrNote").textContent = "";
        document.querySelectorAll(".preset-option").forEach((b) => b.classList.remove("active"));
        url.update();
        schedule();
    });

    // ------------------------------------------------------------------ export
    UI.addExportBar($("exportShg"), {
        name: "nonlinear-optics-shg",
        url,
        getState: () => Object.assign({
            model: "SHG coupled-amplitude RK4",
            eta: shg && shg.r.eta
        }, ctl.get()),
        getCSV: () => ({
            headers: ["z (mm)", "I1/I1(0)", "I2/I1(0)", "closed form I2/I1(0)"],
            rows: shg ? Array.from(shg.r.z, (z, i) => [z / MM, shg.r.I1[i] / shg.o.I0, shg.r.I2[i] / shg.o.I0, closedForm(shg.o, z)]) : []
        }),
        canvases: [$("zCanvas"), $("dkCanvas"), $("pmCanvas")],
        caption: () => shg ? `${shg.o.cr.toUpperCase()}, λ1 = ${shg.s.lam} nm, L = ${shg.s.L} mm, I = ${fmt(mwFromLog(shg.s.Ilog), 3)} MW/cm², η = ${fmtPct(shg.r.eta)}` : ""
    });
    $("zCanvas").dataset.exportName = "z";
    $("dkCanvas").dataset.exportName = "dk";
    $("pmCanvas").dataset.exportName = "pm";
    UI.addExportBar($("exportKerr"), {
        name: "nonlinear-optics-kerr",
        getState: () => Object.assign({
            model: "NLSE symmetric split-step"
        }, ctl.get()),
        getCSV: () => ({
            headers: ["T (ps)", "|A_in|^2 (W)", "|A_out|^2 (W)"],
            rows: kerr ? Array.from(kerr.p.t, (t, i) => [t / PS, kerr.Iin[i], kerr.Iout[i]]) : []
        }),
        canvases: [$("evoCanvas"), $("timeCanvas"), $("specCanvas"), $("convCanvas")],
        caption: () => kerr ? `β2 = ${ctl.get().b2} ps²/km, γ = ${ctl.get().gam} /W/km, T0 = ${ctl.get().T0} ps, P0 = ${ctl.get().P0} W, L = ${ctl.get().Lf} m, N = ${fmt(kerr.k.N, 3)}` : ""
    });
    ["evoCanvas", "timeCanvas", "specCanvas", "convCanvas"].forEach((id, i) => {
        $(id).dataset.exportName = ["evolution", "time", "spectrum", "convergence"][i];
    });

    UI.onThemeChange(() => {
        if (shg) renderSHG();
        if (kerr) renderKerr();
    });
    url.ready.then(() => schedule());
    schedule();
})();