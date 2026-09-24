"use strict";


(function() {
    const UI = window.OpticsUI;
    const core = window.OpticsModels.core;
    const Model = window.OpticsModels.dispersion;
    const PAL = UI.CANVAS_PALETTE;
    const $ = (id) => document.getElementById(id);
    const c0 = core.constants.c;
    const FS = 1e-15;
    const B1 = 1e12,
        B2 = 1e27,
        B3 = 1e42;


    const DEFAULT_STATE = {
        mat: "bk7",
        nc: 1.5,
        lr: 600,
        lg: 0.02,
        ls: 0.01,
        le: 1,
        lam: 800,
        fw: 10,
        gdd: 0,
        z: 10,
        mode: "exact",
        b0: true,
        b1: true,
        b2: true,
        b3: true,
        frame: "group",
        bp: false,
        A: 60,
        Lp: 50
    };
    const PRESETS = {
        bk7: {
            state: {},
            note: "10 fs (FWHM) at 800 nm through 1 cm of N-BK7. Expect GDD = 446.5 fs², L_D = 0.81 mm and an output of ≈ 124 fs (Gaussian β₂-only prediction 124.2 fs), with a slight TOD asymmetry. The spectrum does not change."
        },
        nondisp: {
            state: {
                mat: "constant",
                nc: 1.5,
                z: 0.03,
                frame: "vacuum"
            },
            note: "Constant n = 1.5, z = 30 µm, lab (vacuum) frame. Expect a pure delay (n − 1)z/c = 50.0 fs, FWHM still 10.0 fs, flat spectral phase and no carrier slip (v_p = v_g)."
        },
        gauss: {
            state: {
                mat: "fused_silica",
                z: 1.0,
                mode: "taylor",
                b3: false
            },
            note: "Only the quadratic phase β₂z Ω²/2 (fused silica, z = 1 mm ≈ L_D = 0.998 mm). Expect τ/τ₀ = √(1 + (z/L_D)²) = 1.416, i.e. FWHM = 14.16 fs, a parabolic spectral phase and a straight group-delay line."
        },
        compress: {
            state: {
                gdd: -446.5
            },
            note: "Input pre-chirped with −446.5 fs² (≈ 124 fs long) enters 1 cm of N-BK7. Expect compression back to ≈ 11.9 fs: the GDD cancels, and the residual TOD (β₃z ≈ 321 fs³) stops it reaching 10 fs."
        },
        cep: {
            state: {
                mat: "fused_silica",
                fw: 6,
                z: 0.029
            },
            note: "6 fs pulse, 29 µm of fused silica, envelope frame. Expect a carrier–envelope slip of ≈ −π (the crest under the peak becomes a trough) with the envelope almost unchanged. Switch the frame to phase velocity: the carrier stays and the envelope moves ≈ 1.34 fs."
        },
        zdw: {
            state: {
                mat: "fused_silica",
                lam: 1273,
                z: 10
            },
            note: "Fused silica at its zero-GVD wavelength (≈ 1.273 µm). β₂z ≈ 0 but β₃z ≈ 740 fs³: expect ≈ 13.9 fs with trailing ripples and a parabolic group delay (both spectral edges arrive late)."
        },
        taylor: {
            state: {
                mat: "fused_silica",
                fw: 5,
                z: 3,
                mode: "taylor",
                b3: false
            },
            note: "5 fs pulse, 3 mm fused silica, β₂ only: expect a symmetric ≈ 60.4 fs pulse. Switch to Exact: ≈ 59.7 fs and asymmetric. The Taylor residual beyond β₃ is ≈ 1.5 rad, so for a few-cycle pulse even β₃ is not enough."
        },
        resonance: {
            state: {
                mat: "lorentz",
                lr: 600,
                lg: 0.02,
                ls: 0.01,
                le: 1,
                lam: 650,
                fw: 20,
                z: 0.01
            },
            note: "Lorentz line at 600 nm (γ/ω_R = 0.02), carrier 650 nm, 10 µm path. Expect strong, wavelength-dependent loss that reshapes the spectrum and the pulse. Click the index plot near 600 nm: n_g goes below 1 and then negative, and the warning explains why that is not faster-than-light signalling."
        }
    };


    UI.enhanceAllSliders(document.querySelector(".options-sidebar"), {
        nConst: {
            format: (v) => Number(v).toFixed(3)
        },
        lorLambda: {
            unit: "nm"
        },
        lorGamma: {},
        lorS: {},
        lorEps: {},
        lambda0: {
            unit: "nm"
        },
        fwhm: {
            unit: "fs"
        },
        gdd0: {
            unit: "fs²"
        },
        zLen: {
            unit: "mm"
        },
        apex: {
            unit: "°"
        },
        prismL: {
            unit: "cm"
        }
    });

    let S = null;
    let renderQueued = false;
    let lamCursor = NaN;
    let tauCursor = NaN;

    const ctl = UI.bindControls({
        mat: "#material",
        nc: "#nConst",
        lr: "#lorLambda",
        lg: "#lorGamma",
        ls: "#lorS",
        le: "#lorEps",
        lam: "#lambda0",
        fw: "#fwhm",
        gdd: "#gdd0",
        z: "#zLen",
        mode: "#mode",
        b0: "#tb0",
        b1: "#tb1",
        b2: "#tb2",
        b3: "#tb3",
        frame: "#frame",
        bp: "#showBack",
        A: "#apex",
        Lp: "#prismL"
    }, () => {
        url.update();
        requestRender();
    });


    const fmt = (v, d = 4) => Number.isFinite(v) ? Number(v.toPrecision(d)).toString() : "—";
    const fmtFixed = (v, d) => Number.isFinite(v) ? v.toFixed(d) : "—";
    const fmtFs = (t) => {
        if (!Number.isFinite(t)) return "—";
        const a = Math.abs(t);
        if (a >= 1e-9) return fmt(t * 1e9, 4) + " ns";
        if (a >= 1e-12) return fmt(t * 1e12, 4) + " ps";
        return fmt(t / FS, 4) + " fs";
    };
    const fmtLen = (m) => core.formatSI(m, "m", 3);

    function materialSpec(s) {
        if (s.mat === "constant") return {
            kind: "constant",
            n: s.nc
        };
        if (s.mat === "lorentz") return {
            kind: "lorentz",
            lambdaR: s.lr * 1e-9,
            gammaRel: s.lg,
            strength: s.ls,
            epsInf: s.le
        };
        return s.mat;
    }

    function robustRange(vals, includeZero) {
        const f = vals.filter(Number.isFinite).sort((a, b) => a - b);
        if (!f.length) return [0, 1];
        let lo = f[Math.floor(0.02 * (f.length - 1))],
            hi = f[Math.ceil(0.98 * (f.length - 1))];
        if (includeZero) {
            lo = Math.min(lo, 0);
            hi = Math.max(hi, 0);
        }
        const pad = (hi - lo || Math.abs(hi) || 1) * 0.08;
        return [lo - pad, hi + pad];
    }


    let curveCache = {
        key: "",
        data: null
    };

    function materialCurves(spec, mat, s) {
        const lam0 = s.lam;
        let lo, hi;
        if (mat.kind === "lorentz") {
            lo = 0.45 * s.lr;
            hi = 2.6 * s.lr;
        } else if (mat.kind === "constant") {
            lo = 200;
            hi = 3000;
        } else {
            lo = mat.range[0] * 1e9;
            hi = Math.min(mat.range[1] * 1e9, 3000);
        }
        lo = Math.max(120, Math.min(lo, lam0 * 0.92));
        hi = Math.max(hi, lam0 * 1.08);
        const key = JSON.stringify([spec, Math.round(lo), Math.round(hi)]);
        if (curveCache.key === key) return curveCache.data;
        const M = mat.kind === "lorentz" ? 700 : 360;
        const relStep = mat.kind === "lorentz" ? Math.min(2e-3, s.lg / 10) : 2e-3;
        const xs = [],
            n = [],
            ng = [],
            b2 = [],
            kap = [];
        for (let i = 0; i < M; i++) {
            const l = lo + (hi - lo) * i / (M - 1);
            const d = Model.dispersionAt(mat, l * 1e-9, {
                relStep
            });
            xs.push(l);
            n.push(d.n);
            ng.push(d.ng);
            b2.push(d.beta2 * B2);
            kap.push(d.kappa);
        }

        let zdw = [];
        if (mat.kind === "sellmeier") zdw = Model.zeroGVD(mat).map((x) => x * 1e9);
        else if (mat.kind === "lorentz") {
            for (let i = 1; i < M; i++) {
                if (Number.isFinite(b2[i]) && Number.isFinite(b2[i - 1]) && b2[i] * b2[i - 1] < 0 && Math.abs(b2[i] - b2[i - 1]) < 1e6) {
                    zdw.push(xs[i - 1] + (xs[i] - xs[i - 1]) * b2[i - 1] / (b2[i - 1] - b2[i]));
                }
            }
        }

        let kk = null;
        if (mat.kind === "lorentz") {
            const K = 110,
                kx = [],
                om = [];
            for (let i = 0; i < K; i++) {
                const l = lo + (hi - lo) * (i + 0.5) / K;
                kx.push(l);
                om.push(2 * Math.PI * c0 / (l * 1e-9));
            }
            const W = Math.max(40 * mat.omegaR, 3 * Math.max(...om));
            const pts = Math.min(60000, Math.max(6000, Math.ceil(W / (mat.gammaRel * mat.omegaR / 6))));
            const kn = Model.kramersKronigN((w) => Model.complexIndex(mat, w).im, om, {
                nInf: Math.sqrt(mat.epsInf),
                omegaMax: W,
                points: pts
            });
            kk = {
                xs: kx,
                n: Array.from(kn)
            };
        }
        const data = {
            lo,
            hi,
            xs,
            n,
            ng,
            b2,
            kap,
            zdw,
            kk,
            relStep
        };
        curveCache = {
            key,
            data
        };
        return data;
    }


    function compute() {
        const s = ctl.get();
        const spec = materialSpec(s);
        const mat = Model.resolveMaterial(spec);
        const lambda0 = s.lam * 1e-9;
        const relStep = mat.kind === "lorentz" ? Math.min(2e-3, s.lg / 10) : 2e-3;
        const disp = Model.dispersionAt(mat, lambda0, {
            relStep
        });
        const idx = Model.indexAt(mat, lambda0);
        const curves = materialCurves(spec, mat, s);
        const out = {
            s,
            spec,
            mat,
            disp,
            idx,
            curves,
            lambda0
        };
        out.refused = !Number.isFinite(disp.n) || !Number.isFinite(disp.beta2);
        if (!out.refused) {
            const z = s.z * 1e-3;
            const res = Model.propagatePulse({
                material: mat,
                lambda0,
                fwhm: s.fw * FS,
                gdd0: s.gdd * 1e-30,
                z,
                mode: s.mode,
                terms: {
                    b0: s.b0,
                    b1: s.b1,
                    b2: s.b2,
                    b3: s.b3
                },
                frame: s.frame
            });
            out.res = res;
            out.z = z;
            out.back = s.bp ? Model.backPropagate(res) : null;
            out.resid = mat.kind === "constant" ? 0 : Model.taylorResidual(mat, lambda0, s.fw * FS, z);
            const tau0 = res.tau0;
            out.gddSlab = disp.beta2 * z;
            out.gddTotal = out.gddSlab + s.gdd * 1e-30;
            out.tod = disp.beta3 * z;
            out.LD = Model.dispersionLength(tau0, disp.beta2);
            out.gaussFwhm = Model.fwhmFromTau0(Model.gaussianTau(tau0, out.gddTotal));
            out.chirpedInFwhm = Model.fwhmFromTau0(Model.gaussianTau(tau0, s.gdd * 1e-30));
            out.time = timeSeries(out);
            out.spectral = spectralSeries(out);
        }
        out.prism = prismData(out);
        S = out;
    }

    function timeSeries(o) {
        const r = o.res,
            mi = r.metricsIn,
            mo = r.metricsOut;
        const wid = (m) => Math.max(Number.isFinite(m.fwhm) ? 1.6 * m.fwhm : 0, 4 * m.rms);
        const wIn = wid(mi),
            wOut = wid(mo);
        let lo = Math.min(mi.centroid - wIn, mo.centroid - wOut),
            hi = Math.max(mi.centroid + wIn, mo.centroid + wOut);
        let inputShown = true;
        if (hi - lo > 12 * Math.max(wIn, wOut)) {
            lo = mo.centroid - wOut;
            hi = mo.centroid + wOut;
            inputShown = false;
        }
        const period = o.lambda0 / c0;
        const carrier = (hi - lo) / period <= 160;
        const scale = 1 / Math.sqrt(mi.peak);
        const taus = [];
        const M = carrier ? Math.min(1800, Math.max(400, Math.ceil(12 * (hi - lo) / period))) : 900;
        for (let i = 0; i < M; i++) taus.push(lo + (hi - lo) * i / (M - 1));
        let eo, ei;
        if (carrier) {
            eo = r.evalEnvelope("out", taus);
            ei = inputShown ? r.evalEnvelope("in", taus) : null;
        }
        const interp = (t, re, im, grid) => {
            const re2 = [],
                im2 = [];
            for (const x of taus) {
                re2.push(UI.interpAt(grid, re, x));
                im2.push(UI.interpAt(grid, im, x));
            }
            return {
                re: re2,
                im: im2
            };
        };
        if (!carrier) {
            eo = interp(taus, r.outRe, r.outIm, r.tOut);
            ei = inputShown ? interp(taus, r.inRe, r.inIm, r.tIn) : null;
        }
        const w0 = r.disp.omega0;
        const xs = taus.map((t) => t / FS);
        const envOut = [],
            envNeg = [],
            field = [],
            envIn = [],
            envInNeg = [];
        for (let i = 0; i < M; i++) {
            const a = Math.hypot(eo.re[i], eo.im[i]) * scale;
            envOut.push(a);
            envNeg.push(-a);

            field.push(carrier ? (eo.re[i] * Math.cos(w0 * taus[i]) + eo.im[i] * Math.sin(w0 * taus[i])) * scale : NaN);
            if (ei) {
                const b = Math.hypot(ei.re[i], ei.im[i]);
                const bb = Number.isFinite(b) ? b * scale : NaN;
                envIn.push(bb);
                envInNeg.push(-bb);
            }
        }
        let back = null;
        if (o.back) {
            const bx = [],
                by = [];
            for (let i = 0; i < r.N; i++) {
                const t = r.tIn[i];
                if (t < lo || t > hi) continue;
                bx.push(t / FS);
                by.push(Math.hypot(o.back.re[i], o.back.im[i]) * scale);
            }
            back = {
                xs: bx,
                ys: by
            };
        }
        return {
            xs,
            envOut,
            envNeg,
            field,
            envIn,
            envInNeg,
            inputShown,
            carrier,
            lo: lo / FS,
            hi: hi / FS,
            back,
            period
        };
    }

    function spectralSeries(o) {
        const r = o.res;
        const N = r.N;
        const w0 = r.disp.omega0;

        let j0 = 0;
        for (let j = 0; j < N; j++)
            if (Math.abs(r.omega[j] - w0) < Math.abs(r.omega[j0] - w0)) j0 = j;
        const dw = r.omega[1] - r.omega[0];
        const slope = (r.phaseOut[j0 + 1] - r.phaseOut[j0 - 1]) / (2 * dw);
        const p0 = r.phaseOut[j0];
        const lam = [],
            sIn = [],
            sOut = [],
            ph = [],
            phIn = [],
            gd = [],
            gdIn = [];
        const gdd0 = o.s.gdd * 1e-30;
        let jl = N,
            jh = -1;
        for (let j = 0; j < N; j++)
            if (r.specIn[j] > 1e-4 && r.omega[j] > 0) {
                jl = Math.min(jl, j);
                jh = Math.max(jh, j);
            }
        const stride = Math.max(1, Math.ceil((jh - jl + 1) / 1500));
        for (let j = jh; j >= jl; j -= stride) {
            const w = r.omega[j];
            const Om = w - w0;
            lam.push(2 * Math.PI * c0 / w * 1e9);
            sIn.push(r.specIn[j]);
            sOut.push(r.specOut[j]);
            const strong = r.specIn[j] > 1e-3;
            ph.push(strong ? r.phaseOut[j] - p0 - slope * Om : NaN);
            phIn.push(strong ? gdd0 * Om * Om / 2 : NaN);
            const g = (j > 0 && j < N - 1) ? (r.phaseOut[j + 1] - r.phaseOut[j - 1]) / (2 * dw) : NaN;
            gd.push(strong ? g / FS : NaN);
            gdIn.push(strong ? gdd0 * Om / FS : NaN);
        }

        const dOm = Math.sqrt(Math.log(100)) / r.tau0;
        return {
            lam,
            sIn,
            sOut,
            ph,
            phIn,
            gd,
            gdIn,
            lamLo: lam[0],
            lamHi: lam[lam.length - 1],
            edgeOm: dOm
        };
    }

    function prismData(o) {
        const A = o.s.A * Math.PI / 180;
        const n0 = o.disp.n;
        const g = Model.prismMinDeviation(n0, A);
        const out = {
            A,
            n0,
            g,
            rays: [],
            factor: 1
        };
        if (!Number.isFinite(g.deltaMin)) return out;
        out.ddl = Model.prismAngularDispersion(n0, o.disp.dndl, A);
        const pair = Model.prismPairGDD(o.mat, o.lambda0, o.s.Lp * 1e-2);
        out.pair = pair;
        out.perMetre = Model.prismPairGDD(o.mat, o.lambda0, 1).angular;
        const w0 = o.disp.omega0;
        const dOm = o.spectral ? o.spectral.edgeOm : 0;
        const edges = [];
        if (dOm > 0) {
            if (w0 + dOm > 0) edges.push(2 * Math.PI * c0 / (w0 + dOm));
            edges.push(o.lambda0);
            if (w0 - dOm > 0) edges.push(2 * Math.PI * c0 / (w0 - dOm));
        } else edges.push(o.lambda0);
        let spread = 0;
        for (const l of edges) {
            const n = Model.complexIndex(o.mat, 2 * Math.PI * c0 / l).re;
            const d = Model.prismDeviation(n, A, g.theta1);
            out.rays.push({
                lambda: l,
                n,
                delta: d
            });
            if (Number.isFinite(d)) spread = Math.max(spread, Math.abs(d - g.deltaMin));
        }
        const target = 6 * Math.PI / 180;
        out.factor = spread > 0 && spread < target ? niceFactor(target / spread) : 1;
        return out;
    }

    function niceFactor(x) {
        const p = Math.pow(10, Math.floor(Math.log10(x)));
        const m = x / p;
        return (m >= 5 ? 5 : m >= 2 ? 2 : 1) * p;
    }


    let timeMap = null,
        specMap = null,
        phaseMap = null,
        gdMap = null,
        nMap = null,
        b2Map = null,
        kMap = null;

    function noData(ctx, w, h, text) {
        ctx.fillStyle = PAL.panel;
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = PAL.warning;
        ctx.font = "13px " + PAL.font;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const words = text.split(" ");
        const lines = [];
        let line = "";
        for (const wd of words) {
            if (ctx.measureText(line + " " + wd).width > w - 30 && line) {
                lines.push(line);
                line = wd;
            } else line = line ? line + " " + wd : wd;
        }
        lines.push(line);
        lines.forEach((l, i) => ctx.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * 17));
    }

    function hatch(ctx, map, x0, x1) {
        const P = map.plot;
        const a = Math.max(P.x, map.xToPx(x0)),
            b = Math.min(P.x + P.w, map.xToPx(x1));
        if (!(b > a)) return;
        ctx.save();
        ctx.beginPath();
        ctx.rect(a, P.y, b - a, P.h);
        ctx.clip();
        ctx.fillStyle = "rgba(255, 184, 107, 0.07)";
        ctx.fillRect(a, P.y, b - a, P.h);
        ctx.strokeStyle = "rgba(255, 184, 107, 0.35)";
        ctx.lineWidth = 1;
        for (let x = a - P.h; x < b; x += 9) {
            ctx.beginPath();
            ctx.moveTo(x, P.y + P.h);
            ctx.lineTo(x + P.h, P.y);
            ctx.stroke();
        }
        ctx.restore();
    }

    function hatchInvalid(ctx, map) {
        const r = S.mat.range;
        if (!Number.isFinite(r[1])) return;
        hatch(ctx, map, map.x.min, r[0] * 1e9);
        hatch(ctx, map, r[1] * 1e9, map.x.max);
    }

    function drawTime(ctx, w, h) {
        if (!S || S.refused) {
            timeMap = null;
            return noData(ctx, w, h, "No pulse: the material index is undefined at this carrier wavelength (outside the data's range).");
        }
        const T = S.time;
        const series = [];
        if (T.carrier) series.push({
            xs: T.xs,
            ys: T.field,
            color: PAL.series[3],
            width: 1.1,
            label: "Re E (carrier)"
        });
        series.push({
            xs: T.xs,
            ys: T.envOut,
            color: PAL.series[0],
            width: 2.2,
            label: "output ±|A|"
        });
        series.push({
            xs: T.xs,
            ys: T.envNeg,
            color: PAL.series[0],
            width: 2.2
        });
        if (T.inputShown) {
            series.push({
                xs: T.xs,
                ys: T.envIn,
                color: PAL.series[1],
                dash: [7, 4],
                width: 1.6,
                label: "input |A|, z = 0"
            });
            series.push({
                xs: T.xs,
                ys: T.envInNeg,
                color: PAL.series[1],
                dash: [7, 4],
                width: 1.6
            });
        }
        if (T.back) series.push({
            xs: T.back.xs,
            ys: T.back.ys,
            color: PAL.series[2],
            dash: [2, 3],
            width: 2,
            label: "back-propagated (−z)"
        });
        const lab = Number.isFinite(tauCursor) ? cursorTimeLabel(tauCursor) : null;
        timeMap = UI.plot(ctx, {
            x: 0,
            y: 0,
            w,
            h
        }, {
            x: {
                min: T.lo,
                max: T.hi,
                label: "retarded time τ",
                unit: "fs"
            },
            y: {
                min: -1.08,
                max: 1.08,
                label: "field / input peak"
            },
            series,
            hlines: [{
                y: 0,
                color: PAL.gridStrong
            }],
            cursor: lab ? {
                x: tauCursor,
                label: lab
            } : null
        });
    }

    function cursorTimeLabel(t) {
        const T = S.time;
        const a = UI.interpAt(T.xs, T.envOut, t);
        return "τ = " + fmt(t, 4) + " fs, |A|²/|A_in|²max = " + fmt(a * a, 3);
    }

    function drawSpec(ctx, w, h) {
        if (!S || S.refused) {
            specMap = null;
            return noData(ctx, w, h, "No spectrum.");
        }
        const P = S.spectral;
        specMap = UI.plot(ctx, {
            x: 0,
            y: 0,
            w,
            h
        }, {
            x: {
                min: P.lamLo,
                max: P.lamHi,
                label: "λ",
                unit: "nm"
            },
            y: {
                min: 0,
                max: 1.08,
                label: "|Ã|²"
            },
            series: [{
                    xs: P.lam,
                    ys: P.sIn,
                    color: PAL.series[1],
                    dash: [7, 4],
                    width: 1.6,
                    label: "input"
                },
                {
                    xs: P.lam,
                    ys: P.sOut,
                    color: PAL.series[0],
                    width: 2.2,
                    label: "output"
                }
            ],
            markers: [{
                x: S.s.lam,
                label: "λ₀",
                color: PAL.marker
            }]
        });
        hatchInvalid(ctx, specMap);
    }

    function drawPhase(ctx, w, h) {
        if (!S || S.refused) {
            phaseMap = null;
            return noData(ctx, w, h, "No spectral phase.");
        }
        const P = S.spectral;
        const [lo, hi] = robustRange(P.ph.concat(P.phIn), true);
        phaseMap = UI.plot(ctx, {
            x: 0,
            y: 0,
            w,
            h
        }, {
            x: {
                min: P.lamLo,
                max: P.lamHi,
                label: "λ",
                unit: "nm"
            },
            y: {
                min: Math.min(lo, -1),
                max: Math.max(hi, 1),
                label: "residual phase",
                unit: "rad"
            },
            series: [{
                    xs: P.lam,
                    ys: P.phIn,
                    color: PAL.series[1],
                    dash: [7, 4],
                    width: 1.6,
                    label: "input chirp"
                },
                {
                    xs: P.lam,
                    ys: P.ph,
                    color: PAL.series[0],
                    width: 2.2,
                    label: "output"
                }
            ],
            hlines: [{
                y: 0
            }],
            markers: [{
                x: S.s.lam,
                label: "λ₀",
                color: PAL.marker
            }]
        });
        hatchInvalid(ctx, phaseMap);
    }

    function drawGd(ctx, w, h) {
        if (!S || S.refused) {
            gdMap = null;
            return noData(ctx, w, h, "No group delay.");
        }
        const P = S.spectral;
        const [lo, hi] = robustRange(P.gd.concat(P.gdIn), true);
        gdMap = UI.plot(ctx, {
            x: 0,
            y: 0,
            w,
            h
        }, {
            x: {
                min: P.lamLo,
                max: P.lamHi,
                label: "λ",
                unit: "nm"
            },
            y: {
                min: lo,
                max: hi,
                label: "τ_g",
                unit: "fs"
            },
            series: [{
                    xs: P.lam,
                    ys: P.gdIn,
                    color: PAL.series[1],
                    dash: [7, 4],
                    width: 1.6,
                    label: "input chirp"
                },
                {
                    xs: P.lam,
                    ys: P.gd,
                    color: PAL.series[0],
                    width: 2.2,
                    label: "output (frame-relative)"
                }
            ],
            hlines: [{
                y: 0
            }],
            markers: [{
                x: S.s.lam,
                label: "λ₀",
                color: PAL.marker
            }]
        });
        hatchInvalid(ctx, gdMap);
    }

    function materialMarkers(extra) {
        const mk = [{
            x: S.s.lam,
            label: "λ₀ = " + S.s.lam + " nm",
            color: PAL.marker
        }];
        return mk.concat(extra || []);
    }

    function lamCursorOpt(vals, name, unit) {
        if (!Number.isFinite(lamCursor)) return null;
        const v = UI.interpAt(S.curves.xs, vals, lamCursor);
        return {
            x: lamCursor,
            label: fmt(lamCursor, 4) + " nm: " + name + " = " + fmt(v, 5) + (unit ? " " + unit : "")
        };
    }

    function drawN(ctx, w, h) {
        if (!S) return;
        const C = S.curves;
        const series = [{
                xs: C.xs,
                ys: C.n,
                color: PAL.series[0],
                width: 2.2,
                label: "n"
            },
            {
                xs: C.xs,
                ys: C.ng,
                color: PAL.series[2],
                dash: [7, 4],
                width: 1.8,
                label: "n_g"
            }
        ];
        if (C.kk) series.push({
            xs: C.kk.xs,
            ys: C.kk.n,
            color: PAL.series[1],
            pointsOnly: true,
            pointRadius: 2.2,
            label: "n from KK(κ)"
        });

        const nf = C.n.filter(Number.isFinite);
        const nlo = Math.min(...nf),
            nhi = Math.max(...nf);
        const span = Math.max(nhi - nlo, 0.02);
        const ngNear = C.ng.filter((v) => Number.isFinite(v) && v > nlo - span && v < nhi + 2 * span);
        const all = nf.concat(ngNear),
            pad = 0.06 * Math.max(Math.max(...all) - Math.min(...all), 0.01);
        const lo = Math.min(...all) - pad,
            hi = Math.max(...all) + pad;
        nMap = UI.plot(ctx, {
            x: 0,
            y: 0,
            w,
            h
        }, {
            x: {
                min: C.lo,
                max: C.hi,
                label: "λ",
                unit: "nm"
            },
            y: {
                min: lo,
                max: hi,
                label: "index"
            },
            series,
            markers: materialMarkers(),
            cursor: lamCursorOpt(C.n, "n")
        });
        hatchInvalid(ctx, nMap);
    }

    function drawB2(ctx, w, h) {
        if (!S) return;
        const C = S.curves;
        const lor = S.mat.kind === "lorentz";
        const [lo, hi] = lor ? robustRange(C.b2.filter((v, i) => Math.abs(C.xs[i] - S.s.lr) > 0.15 * S.s.lr), true) : robustRange(C.b2, true);
        b2Map = UI.plot(ctx, {
            x: 0,
            y: 0,
            w,
            h
        }, {
            x: {
                min: C.lo,
                max: C.hi,
                label: "λ",
                unit: "nm"
            },
            y: {
                min: lo,
                max: hi,
                label: "β₂",
                unit: "fs²/mm"
            },
            series: [{
                xs: C.xs,
                ys: C.b2,
                color: PAL.series[0],
                width: 2.2,
                label: "β₂"
            }],
            hlines: [{
                y: 0,
                color: PAL.gridStrong
            }],
            markers: materialMarkers(C.zdw.map((x) => ({
                x,
                label: C.zdw.length <= 1 ? "β₂ = 0: " + fmt(x, 4) + " nm" : "",
                color: PAL.series[4],
                dash: [2, 3]
            }))),
            cursor: lamCursorOpt(C.b2, "β₂", "fs²/mm"),
            legend: false
        });
        hatchInvalid(ctx, b2Map);
    }

    function drawK(ctx, w, h) {
        if (!S) return;
        const C = S.curves;
        const kmax = Math.max(0, ...C.kap.filter(Number.isFinite));
        kMap = UI.plot(ctx, {
            x: 0,
            y: 0,
            w,
            h
        }, {
            x: {
                min: C.lo,
                max: C.hi,
                label: "λ",
                unit: "nm"
            },
            y: {
                min: 0,
                max: kmax > 0 ? kmax * 1.1 : 1e-3,
                label: "κ",
                format: (v) => v === 0 ? "0" : Math.abs(v) < 1e-2 ? v.toExponential(0) : v.toPrecision(2)
            },
            series: [{
                xs: C.xs,
                ys: C.kap,
                color: PAL.series[5],
                width: 2.2,
                label: "κ",
                fill: true
            }],
            markers: materialMarkers(),
            cursor: lamCursorOpt(C.kap, "κ"),
            legend: false
        });
        if (kmax === 0) {
            const P = kMap.plot;
            ctx.fillStyle = PAL.textMuted;
            ctx.font = "12px " + PAL.font;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(S.mat.kind === "constant" ? "lossless idealisation: κ = 0" : "Sellmeier fit is lossless: κ = 0 in its range", P.x + P.w / 2, P.y + P.h / 2);
        }
        hatchInvalid(ctx, kMap);
    }

    function drawPrism(ctx, w, h) {
        ctx.fillStyle = PAL.panel;
        ctx.fillRect(0, 0, w, h);
        if (!S) return;
        const Pd = S.prism;
        const A = Pd.A;

        const apexY = 84;
        const Lside = Math.max(40, Math.min(w * 0.38, (h - apexY - 50) / Math.cos(A / 2)));
        const cx = w * 0.42;
        const apex = {
            x: cx,
            y: apexY
        };
        const bl = {
            x: cx - Lside * Math.sin(A / 2),
            y: apexY + Lside * Math.cos(A / 2)
        };
        const br = {
            x: cx + Lside * Math.sin(A / 2),
            y: bl.y
        };
        ctx.beginPath();
        ctx.moveTo(apex.x, apex.y);
        ctx.lineTo(br.x, br.y);
        ctx.lineTo(bl.x, bl.y);
        ctx.closePath();
        ctx.fillStyle = "rgba(167, 139, 250, 0.14)";
        ctx.fill();
        ctx.strokeStyle = PAL.series[3];
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = PAL.textMuted;
        ctx.font = "12px " + PAL.font;
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText("A = " + S.s.A + "°", apex.x, apex.y - 4);
        if (!Number.isFinite(Pd.g.deltaMin)) {
            ctx.fillStyle = PAL.warning;
            ctx.textBaseline = "middle";
            ctx.fillText(Pd.n0 * Math.sin(A / 2) >= 1 ? "n sin(A/2) ≥ 1: no ray can leave (total internal reflection)" : "Index undefined here", w / 2, h * 0.9);
            return;
        }

        const t = 0.5;
        const pin = {
            x: apex.x + (bl.x - apex.x) * t,
            y: apex.y + (bl.y - apex.y) * t
        };
        const pout = {
            x: apex.x + (br.x - apex.x) * t,
            y: pin.y
        };

        const nIn = {
            x: Math.cos(A / 2),
            y: Math.sin(A / 2)
        };
        const rot = (v, a) => ({
            x: v.x * Math.cos(a) - v.y * Math.sin(a),
            y: v.x * Math.sin(a) + v.y * Math.cos(a)
        });
        const dIn = rot(nIn, -Pd.g.theta1);
        const L1 = w * 0.3;
        ctx.strokeStyle = "#f5f3ff";
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(pin.x - dIn.x * L1, pin.y - dIn.y * L1);
        ctx.lineTo(pin.x, pin.y);
        ctx.lineTo(pout.x, pout.y);
        ctx.stroke();

        const L2 = w * 0.36;

        const style = (r, i) => {
            if (r.lambda === S.lambda0) return {
                color: PAL.marker,
                dash: [],
                name: "λ₀"
            };
            return r.lambda < S.lambda0 ? {
                color: PAL.series[6],
                dash: [7, 4],
                name: "blue edge"
            } : {
                color: PAL.series[5],
                dash: [2, 3],
                name: "red edge"
            };
        };
        const legend = [];
        Pd.rays.forEach((r, i) => {
            if (!Number.isFinite(r.delta)) return;
            const st = style(r, i);
            const dd = Pd.g.deltaMin + (r.delta - Pd.g.deltaMin) * Pd.factor;
            const dOut = rot(dIn, dd);
            ctx.strokeStyle = st.color;
            ctx.lineWidth = 2;
            ctx.setLineDash(st.dash);
            ctx.beginPath();
            ctx.moveTo(pout.x, pout.y);
            ctx.lineTo(pout.x + dOut.x * L2, pout.y + dOut.y * L2);
            ctx.stroke();
            ctx.setLineDash([]);
            legend.push({
                st,
                text: st.name + " " + fmt(r.lambda * 1e9, 4) + " nm: δ = " + fmt(r.delta * 180 / Math.PI, 5) + "°"
            });
        });
        ctx.font = "12px " + PAL.font;
        const lw = Math.max(...legend.map((l) => ctx.measureText(l.text).width)) + 36,
            lh = 17;
        const lx = Math.max(4, w - lw - 6),
            ly = 6;
        ctx.fillStyle = "rgba(7, 7, 13, 0.82)";
        ctx.fillRect(lx, ly, lw, legend.length * lh + 6);
        legend.forEach((l, i) => {
            const yy = ly + 3 + lh * i + lh / 2;
            ctx.strokeStyle = l.st.color;
            ctx.lineWidth = 2;
            ctx.setLineDash(l.st.dash);
            ctx.beginPath();
            ctx.moveTo(lx + 6, yy);
            ctx.lineTo(lx + 26, yy);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = PAL.text;
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            ctx.fillText(l.text, lx + 31, yy);
        });
        ctx.fillStyle = PAL.text;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.font = "12px " + PAL.font;
        ctx.fillText("δ_min = " + fmt(Pd.g.deltaMin * 180 / Math.PI, 4) + "°,  θ₁ = " + fmt(Pd.g.theta1 * 180 / Math.PI, 4) + "°", 8, h - 36);
        ctx.fillStyle = Pd.factor > 1 ? PAL.warning : PAL.textMuted;
        ctx.fillText(Pd.factor > 1 ? "angular spread × " + Pd.factor + " (schematic)" : "angles to scale", 8, h - 19);
    }


    const cv = {
        time: $("timeCanvas"),
        spec: $("specCanvas"),
        phase: $("phaseCanvas"),
        gd: $("gdCanvas"),
        n: $("nCanvas"),
        b2: $("b2Canvas"),
        k: $("kCanvas"),
        prism: $("prismCanvas")
    };
    const desc = {
        time: UI.describeCanvas(cv.time, "Pulse in time.", {
            label: "Pulse field and envelope versus retarded time, input and output"
        }),
        spec: UI.describeCanvas(cv.spec, "Power spectrum.", {
            label: "Input and output power spectrum versus wavelength"
        }),
        phase: UI.describeCanvas(cv.phase, "Spectral phase.", {
            label: "Residual spectral phase versus wavelength"
        }),
        gd: UI.describeCanvas(cv.gd, "Group delay.", {
            label: "Group delay of each spectral component versus wavelength"
        }),
        n: UI.describeCanvas(cv.n, "Index.", {
            label: "Refractive index and group index versus wavelength; click to set the carrier"
        }),
        b2: UI.describeCanvas(cv.b2, "GVD.", {
            label: "Group-velocity dispersion beta 2 versus wavelength; click to set the carrier"
        }),
        k: UI.describeCanvas(cv.k, "Absorption.", {
            label: "Extinction coefficient kappa versus wavelength; click to set the carrier"
        }),
        prism: UI.describeCanvas(cv.prism, "Prism.", {
            label: "Prism at minimum deviation with rays for the spectral edges, angles exaggerated"
        })
    };
    const H = {
        time: UI.setupCanvas(cv.time, {
            aspect: 2.8,
            minHeight: 240,
            maxHeight: 380,
            draw: drawTime
        }),
        spec: UI.setupCanvas(cv.spec, {
            aspect: 1.6,
            minHeight: 220,
            maxHeight: 340,
            draw: drawSpec
        }),
        phase: UI.setupCanvas(cv.phase, {
            aspect: 1.6,
            minHeight: 220,
            maxHeight: 340,
            draw: drawPhase
        }),
        gd: UI.setupCanvas(cv.gd, {
            aspect: 3.2,
            minHeight: 210,
            maxHeight: 300,
            draw: drawGd
        }),
        n: UI.setupCanvas(cv.n, {
            aspect: 1.5,
            minHeight: 230,
            maxHeight: 360,
            draw: drawN
        }),
        b2: UI.setupCanvas(cv.b2, {
            aspect: 1.5,
            minHeight: 230,
            maxHeight: 360,
            draw: drawB2
        }),
        k: UI.setupCanvas(cv.k, {
            aspect: 1.5,
            minHeight: 230,
            maxHeight: 360,
            draw: drawK
        }),
        prism: UI.setupCanvas(cv.prism, {
            aspect: 1.5,
            minHeight: 230,
            maxHeight: 360,
            draw: drawPrism
        })
    };


    const lamSlider = $("lambda0");

    function setLambda(nm) {
        const v = Math.round(Math.min(Number(lamSlider.max), Math.max(Number(lamSlider.min), nm)));
        lamSlider.value = v;
        lamSlider.dispatchEvent(new Event("input", {
            bubbles: true
        }));
        lamSlider.dispatchEvent(new Event("change", {
            bubbles: true
        }));
    }
    [
        ["n", () => nMap],
        ["b2", () => b2Map],
        ["k", () => kMap]
    ].forEach(([key, getMap]) => {
        const c = cv[key];
        const pos = (e) => {
            const r = c.getBoundingClientRect();
            return {
                px: e.clientX - r.left,
                py: e.clientY - r.top
            };
        };
        c.addEventListener("pointermove", (e) => {
            const m = getMap();
            if (!m) return;
            const p = pos(e);
            if (!m.contains(p.px, p.py)) return;
            lamCursor = m.pxToX(p.px);
            redrawMaterial();
        });
        c.addEventListener("pointerleave", () => {
            lamCursor = NaN;
            redrawMaterial();
        });
        c.addEventListener("click", (e) => {
            const m = getMap();
            if (!m) return;
            const p = pos(e);
            if (m.contains(p.px, p.py)) setLambda(m.pxToX(p.px));
        });
        c.addEventListener("keydown", (e) => {
            const d = {
                ArrowLeft: -1,
                ArrowRight: 1
            } [e.key];
            if (!d) return;
            e.preventDefault();
            setLambda(S.s.lam + d * (e.shiftKey ? 10 : 1));
        });
    });
    cv.time.addEventListener("pointermove", (e) => {
        if (!timeMap) return;
        const r = cv.time.getBoundingClientRect();
        const px = e.clientX - r.left,
            py = e.clientY - r.top;
        if (!timeMap.contains(px, py)) return;
        tauCursor = timeMap.pxToX(px);
        H.time.redraw();
    });
    cv.time.addEventListener("pointerleave", () => {
        tauCursor = NaN;
        H.time.redraw();
    });
    cv.time.addEventListener("keydown", (e) => {
        const d = {
            ArrowLeft: -1,
            ArrowRight: 1
        } [e.key];
        if (!d || !S || !S.time) return;
        e.preventDefault();
        const T = S.time;
        const step = (T.hi - T.lo) / (e.shiftKey ? 20 : 200);
        tauCursor = Math.min(T.hi, Math.max(T.lo, (Number.isFinite(tauCursor) ? tauCursor : (T.lo + T.hi) / 2) + d * step));
        H.time.redraw();
    });

    function redrawMaterial() {
        H.n.redraw();
        H.b2.redraw();
        H.k.redraw();
        const C = S.curves;
        if (Number.isFinite(lamCursor)) {
            const g = (a) => UI.interpAt(C.xs, a, lamCursor);
            $("rCursor").textContent = "λ = " + fmt(lamCursor, 4) + " nm: n = " + fmt(g(C.n), 6) + ", n_g = " + fmt(g(C.ng), 5) + ", β₂ = " + fmt(g(C.b2), 4) + " fs²/mm, κ = " + fmt(g(C.kap), 3);
        } else $("rCursor").textContent = "hover a material plot";
    }


    function updateDom() {
        const s = S.s,
            d = S.disp,
            mat = S.mat;

        $("grpConst").hidden = s.mat !== "constant";
        $("grpLorentz").hidden = s.mat !== "lorentz";
        $("taylorTerms").disabled = s.mode !== "taylor";

        $("ncValue").textContent = s.nc.toFixed(3);
        $("lrValue").textContent = s.lr + " nm";
        $("lgValue").textContent = String(s.lg);
        $("lsValue").textContent = String(s.ls);
        $("leValue").textContent = s.le.toFixed(2);
        $("lamValue").textContent = s.lam + " nm";
        $("fwValue").textContent = s.fw + " fs";
        $("gddValue").textContent = s.gdd + " fs²";
        $("zValue").textContent = (s.z < 1 ? fmt(s.z * 1000, 4) + " µm" : fmt(s.z, 5) + " mm");
        $("apexValue").textContent = s.A + "°";
        $("lpValue").textContent = s.Lp + " cm";

        if (mat.kind === "sellmeier") {
            $("materialInfo").innerHTML = "Sellmeier, λ in µm, C<sub>i</sub> in µm². Valid " + (mat.range[0] * 1e6).toFixed(3) + "–" + (mat.range[1] * 1e6).toFixed(3) + " µm, " + mat.temperature + ". Source: " + mat.ref + ".";
            $("nBadge").textContent = "Sellmeier";
        } else if (mat.kind === "lorentz") {
            $("materialInfo").textContent = "ε(ω) = ε∞ + S ω_R²/(ω_R² − ω² − iγω). Static index √(ε∞ + S) = " + fmt(Math.sqrt(s.le + s.ls), 4) + "; a model medium, valid for all ω > 0.";
            $("nBadge").textContent = "Lorentz + KK check";
        } else {
            $("materialInfo").textContent = "Idealised nondispersive medium: n_g = n, β₂ = β₃ = 0.";
            $("nBadge").textContent = "constant";
        }
        $("kBadge").textContent = mat.kind === "lorentz" ? "κ = Im ñ (Lorentz)" : "κ = Im ñ (lossless model)";
        $("nCaption").innerHTML = "Solid: n(λ); dashed: n<sub>g</sub> = n − λ dn/dλ." + (mat.kind === "lorentz" ? " Dots: n rebuilt from κ alone with the Kramers–Kronig integral (n<sub>∞</sub> = √ε<sub>∞</sub>)." : "") + " Vertical line: carrier λ₀. Click to set λ₀." + (mat.kind === "sellmeier" ? " Hatched: outside the fitted range." : "");


        $("rN").textContent = fmt(d.n, 6) + (mat.kind === "lorentz" ? " / κ = " + fmt(d.kappa, 3) : " / κ = 0");
        $("rNg").textContent = fmt(d.ng, 6);
        $("rV").textContent = "v_p = " + fmt(1 / d.n, 5) + " c, v_g = " + fmt(1 / d.ng, 5) + " c";
        $("rB1").textContent = fmt(d.beta1 * B1, 6) + " fs/mm";
        $("rB2").textContent = fmt(d.beta2 * B2, 5) + " fs²/mm";
        $("rB3").textContent = fmt(d.beta3 * B3, 4) + " fs³/mm";
        $("rAlpha").textContent = mat.kind === "lorentz" ? fmt(d.alpha * 1e-3, 4) + " mm⁻¹ (1/α = " + fmtLen(1 / d.alpha) + ")" : "0 (lossless model)";
        $("rZdw").textContent = S.curves.zdw.length ? S.curves.zdw.map((x) => fmt(x / 1000, 5) + " µm").join(", ") : "none in plotted range";
        $("stat-lambda").textContent = s.lam + " nm";
        $("stat-ng").textContent = fmt(d.ng, 5);
        $("stat-b2").textContent = fmt(d.beta2 * B2, 4);


        const Pd = S.prism;
        if (Number.isFinite(Pd.g.deltaMin)) {
            $("rDelta").textContent = fmt(Pd.g.deltaMin * 180 / Math.PI, 5) + "° at θ₁ = " + fmt(Pd.g.theta1 * 180 / Math.PI, 5) + "°";
            $("rDdl").textContent = fmt(Pd.ddl * 1e-6 * 180 / Math.PI, 4) + " °/µm (" + fmt(Pd.ddl * 1e-9 * 1e3, 4) + " mrad/nm)";
            $("rPair").textContent = fmt(Pd.pair.angular * 1e30, 5) + " fs² (angular term, L = " + s.Lp + " cm)";
            const slab = S.gddSlab;
            if (Number.isFinite(slab) && slab > 0 && Pd.perMetre < 0) $("rPairL").textContent = fmt(slab / -Pd.perMetre * 100, 4) + " cm (same prism material)";
            else $("rPairL").textContent = "not needed (slab GDD ≤ 0)";
        } else {
            ["rDelta", "rDdl", "rPair", "rPairL"].forEach((id) => {
                $(id).textContent = "—";
            });
        }
        $("prismBadge").textContent = Pd.factor > 1 ? "angular spread ×" + Pd.factor : "to scale";
        $("prismCaption").textContent = "Prism of " + (mat.name || "the selected medium") + " with apex A = " + s.A + "°; the incident beam is at minimum deviation for λ₀. Output rays for the blue and red edges of the pulse spectrum (|Ã|² = 1 %) are drawn" + (Pd.factor > 1 ? " with their angular separation magnified " + Pd.factor + "×." : " to scale.");


        const rows = Object.values(Model.MATERIALS).map((m) => {
            const dd = Model.dispersionAt(m, S.lambda0);
            const ok = Model.inRange(m, S.lambda0);
            const star = ok ? "" : " *";
            return "<tr" + (m.id === s.mat ? ' aria-current="true" style="font-weight:600"' : "") + "><td>" + m.name + star + "</td><td>" + fmt(dd.n, 6) + "</td><td>" + fmt(dd.ng, 5) + "</td><td>" + fmt(dd.beta2 * B2, 4) + "</td><td>" + fmt(dd.beta3 * B3, 4) + "</td><td>" + (m.range[0] * 1e6).toFixed(3) + "–" + (m.range[1] * 1e6).toFixed(3) + "</td><td>" + m.ref + "</td></tr>";
        });
        const anyOut = Object.values(Model.MATERIALS).some((m) => !Model.inRange(m, S.lambda0));
        $("matTable").querySelector("tbody").innerHTML = rows.join("") + (anyOut ? '<tr><td colspan="7">* λ₀ is outside this dataset’s validity interval: value extrapolated, do not trust it.</td></tr>' : "");


        const warns = [];
        if (!S.idx.valid && mat.kind === "sellmeier") warns.push("Carrier λ₀ = " + s.lam + " nm lies outside the " + mat.name + " data interval (" + (mat.range[0] * 1e6).toFixed(3) + "–" + (mat.range[1] * 1e6).toFixed(3) + " µm). The Sellmeier formula is being extrapolated" + (S.refused ? " and gives n² ≤ 0 here, so the tool refuses to propagate." : ": treat every number as unreliable."));
        if (!S.refused) {
            const r = S.res;
            if (r.fractionOutside > 1e-4) warns.push(fmt(100 * r.fractionOutside, 3) + " % of the pulse energy lies at wavelengths outside the material data’s validity interval (hatched). Use a longer pulse or move λ₀ inward.");
            if (r.dropped > 1e-12) warns.push("Spectral components carrying " + fmt(100 * r.dropped, 3) + " % of the energy were removed because the index is undefined there (ω ≤ 0 or n² ≤ 0).");
            if (r.undersampled) warns.push("The FFT grid hit its size limit: the time window or bandwidth is under-resolved and the result may alias.");
            if (mat.kind === "lorentz") {
                const az = d.alpha * S.z;
                if (az > 0.1 || d.ng < 1 || d.ng <= 0) {
                    warns.push("Near the absorption line (α z = " + fmt(az, 3) + ", n_g = " + fmt(d.ng, 4) + "): the group velocity c/n_g no longer predicts when the pulse peak arrives, because different frequencies are absorbed differently and the pulse is reshaped. n_g < 1 or < 0 does not mean information travels faster than c. The signal front always moves at c. The exact FFT curve is still the correct linear-model answer; the Taylor numbers and L_D are not meaningful here.");
                }
            }
            if (s.mode === "taylor" && S.resid > 0.5) warns.push("Taylor mode: over the pulse bandwidth the exact phase k(ω)z differs from its expansion through β₃ by up to " + fmt(S.resid, 3) + " rad. Compare with the exact mode.");
            if (s.fw * FS < 2 * S.time.period) warns.push("The pulse is shorter than two optical cycles: a few-cycle pulse. The envelope/carrier split and the Taylor series are only rough guides here, but the exact FFT propagation still applies to the linear field.");
        }
        const wb = $("warnBox");
        if (warns.length) {
            wb.hidden = false;
            wb.innerHTML = "<strong>Check the model’s validity:</strong><ul>" + warns.map((w) => "<li>" + w + "</li>").join("") + "</ul>";
        } else {
            wb.hidden = true;
            wb.innerHTML = "";
        }


        if (S.refused) {
            ["rPhaseDelay", "rGroupDelay", "rCEP", "rGDD", "rTOD", "rLD", "rFwIn", "rFwOut", "rFwGauss", "rPeak", "rTrans", "rResid", "rOutside", "rGrid", "rBack"].forEach((id) => {
                $(id).textContent = "—";
            });
            ["stat-gdd", "stat-fwhm", "stat-trans"].forEach((id) => {
                $(id).textContent = "—";
            });
            desc.time.update("No pulse: index undefined at this carrier wavelength.");
            return;
        }
        const r = S.res,
            mi = r.metricsIn,
            mo = r.metricsOut;
        const cep = r.carrierPhase;
        const wrap = (p) => {
            let q = ((p + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
            return q;
        };
        $("rPhaseDelay").textContent = fmtFs(r.phaseDelay);
        $("rGroupDelay").textContent = fmtFs(r.groupDelay) + " (Δ = " + fmtFs(r.groupDelay - r.phaseDelay) + ")";
        const cepExact = S.disp.omega0 * S.z * (d.n - d.ng) / c0;
        $("rCEP").textContent = fmt(cepExact, 5) + " rad ≡ " + fmt(wrap(cepExact) / Math.PI, 3) + "π (mod 2π)";
        $("rGDD").textContent = fmt(S.gddSlab * 1e30, 5) + " fs² / " + fmt(S.gddTotal * 1e30, 5) + " fs²";
        $("rTOD").textContent = fmt(S.tod * 1e45, 4) + " fs³";
        $("rLD").textContent = Number.isFinite(S.LD) ? fmtLen(S.LD) + " (z/L_D = " + fmt(S.z / S.LD, 4) + ")" : "∞ (β₂ = 0)";
        $("rFwIn").textContent = fmt(s.fw, 4) + " fs / " + fmt(mi.fwhm / FS, 5) + " fs";
        $("rFwOut").textContent = fmt(mo.fwhm / FS, 5) + " fs (τ_rms√2 = " + fmt(mo.tauRms / FS, 4) + " fs)";
        $("rFwGauss").textContent = fmt(S.gaussFwhm / FS, 5) + " fs";
        $("rPeak").textContent = fmt(mo.peak / mi.peak, 4);
        $("rTrans").textContent = fmt(100 * r.transmission, 6) + " %";
        $("rResid").textContent = mat.kind === "constant" ? "0 (k exactly linear)" : fmt(S.resid, 3) + " rad";
        $("rOutside").textContent = mat.kind === "sellmeier" ? (r.fractionOutside < 1e-12 ? "< 10⁻¹² of energy" : fmt(100 * r.fractionOutside, 3) + " % of energy") : "n/a (model valid for all ω)";
        $("rGrid").textContent = "N = " + r.N + ", Δτ = " + fmt(r.dt / FS, 3) + " fs, window " + fmtFs(r.N * r.dt);
        $("rBack").textContent = S.back ? fmt(S.back.relError, 2) + " (max |A_back − A_in| / peak)" + (r.lossless ? "" : " — lossy: gain undoes absorption") : "tick “Inverse-propagation check”";
        $("stat-gdd").textContent = fmt(S.gddTotal * 1e30, 4);
        $("stat-fwhm").textContent = fmt(mo.fwhm / FS, 4) + " fs";
        $("stat-trans").textContent = fmt(100 * r.transmission, 4) + " %";


        const T = S.time;
        desc.time.update("Retarded time " + fmt(T.lo, 4) + " to " + fmt(T.hi, 4) + " fs (" + s.frame + " frame). Input FWHM " + fmt(mi.fwhm / FS, 4) + " fs centred at " + fmt(mi.centroid / FS, 4) +
            " fs; output FWHM " + fmt(mo.fwhm / FS, 4) + " fs centred at " + fmt(mo.centroid / FS, 4) + " fs, peak intensity " + fmt(mo.peak / mi.peak, 3) + " of the input. " +
            (T.carrier ? "Carrier drawn." : "Carrier too dense to draw at this scale.") + (T.inputShown ? "" : " Input lies off-axis at τ ≈ " + fmt(mi.centroid / FS, 4) + " fs."));
        const Sp = S.spectral;
        desc.spec.update("Power spectrum from " + fmt(Sp.lamLo, 4) + " to " + fmt(Sp.lamHi, 4) + " nm; output/input energy " + fmt(r.transmission, 4) + ".");
        desc.phase.update("Residual spectral phase after removing constant and linear terms: GDD " + fmt(S.gddTotal * 1e30, 4) + " fs², TOD " + fmt(S.tod * 1e45, 4) + " fs³.");
        const gdv = Sp.gd.filter(Number.isFinite);
        desc.gd.update("Group delay across the spectrum spans " + fmt(Math.min(...gdv), 4) + " to " + fmt(Math.max(...gdv), 4) + " fs in the " + s.frame + " frame.");
        desc.n.update(mat.name + ": n(" + s.lam + " nm) = " + fmt(d.n, 6) + ", n_g = " + fmt(d.ng, 5) + ". Plotted from " + fmt(S.curves.lo, 4) + " to " + fmt(S.curves.hi, 4) + " nm.");
        desc.b2.update("β₂(" + s.lam + " nm) = " + fmt(d.beta2 * B2, 4) + " fs²/mm. Zero-GVD: " + $("rZdw").textContent + ".");
        desc.k.update(mat.kind === "lorentz" ? "κ peaks near " + s.lr + " nm; at λ₀, κ = " + fmt(d.kappa, 3) + ", α = " + fmt(d.alpha * 1e-3, 4) + " per mm." : "κ = 0 (lossless model).");
        desc.prism.update("Prism A = " + s.A + "°, minimum deviation " + $("rDelta").textContent + ", angular dispersion " + $("rDdl").textContent + ".");
    }


    function redrawAll() {
        Object.values(H).forEach((h) => h.redraw());
        updateDom();
        redrawMaterial();
    }

    function renderNow() {
        renderQueued = false;
        compute();
        redrawAll();
    }

    function requestRender() {
        if (renderQueued) return;
        renderQueued = true;
        requestAnimationFrame(renderNow);
    }


    function applyPreset(name) {
        const p = PRESETS[name] || PRESETS.bk7;
        lamCursor = NaN;
        tauCursor = NaN;
        ctl.set(Object.assign({}, DEFAULT_STATE, p.state));
        $("presetNote").textContent = p.note;
        document.querySelectorAll("[data-preset]").forEach((b) => {
            const on = b.dataset.preset === name;
            b.classList.toggle("active", on);
            b.setAttribute("aria-pressed", on ? "true" : "false");
        });
        url.update();
        renderNow();
    }
    document.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => applyPreset(b.dataset.preset)));

    function clearPresetHighlight() {
        document.querySelectorAll("[data-preset]").forEach((b) => {
            b.classList.remove("active");
            b.setAttribute("aria-pressed", "false");
        });
    }
    ["input", "change"].forEach((ev) => document.querySelector(".options-sidebar").addEventListener(ev, (e) => {
        if (e.isTrusted && !e.target.closest(".preset-card")) clearPresetHighlight();
    }));
    $("resetBtn").addEventListener("click", () => applyPreset("bk7"));


    const url = UI.urlState({
        get: ctl.get,
        set: ctl.set
    });
    UI.addExportBar($("exportHost"), {
        name: "dispersion-pulses",
        url,
        getState: () => Object.assign({
            tool: "dispersion_pulses",
            units: {
                nc: "1",
                lr: "nm",
                lg: "γ/ω_R",
                ls: "ω_p²/ω_R²",
                le: "1",
                lam: "nm",
                fw: "fs (intensity FWHM, transform limit)",
                gdd: "fs²",
                z: "mm",
                A: "deg",
                Lp: "cm"
            },
            conventions: "E = Re{A exp(−iω0 t)}, spectral phase exp(+iφ), τ_g = dφ/dω; |A|² = exp(−t²/τ0²), FWHM = 1.665 τ0"
        }, ctl.get(), {
            results: S && !S.refused ? {
                n: S.disp.n,
                kappa: S.disp.kappa,
                ng: S.disp.ng,
                beta1_fs_per_mm: S.disp.beta1 * B1,
                beta2_fs2_per_mm: S.disp.beta2 * B2,
                beta3_fs3_per_mm: S.disp.beta3 * B3,
                gddSlab_fs2: S.gddSlab * 1e30,
                tod_fs3: S.tod * 1e45,
                LD_m: S.LD,
                fwhmIn_fs: S.res.metricsIn.fwhm / FS,
                fwhmOut_fs: S.res.metricsOut.fwhm / FS,
                gaussianPrediction_fs: S.gaussFwhm / FS,
                transmission: S.res.transmission,
                groupDelay_s: S.res.groupDelay,
                phaseDelay_s: S.res.phaseDelay,
                fractionOutsideValidity: S.res.fractionOutside,
                taylorResidual_rad: S.resid,
                fftN: S.res.N,
                dt_fs: S.res.dt / FS,
                zeroGVD_nm: S.curves.zdw,
                backPropagationRelError: S.back ? S.back.relError : null
            } : null
        }),
        getCSV: () => {
            const r = S && S.res;
            if (!r) return {
                headers: ["none"],
                rows: []
            };
            const rows = [];
            for (let i = 0; i < r.N; i++) {
                rows.push([r.tOut[i] / FS, r.outRe[i], r.outIm[i], r.outRe[i] ** 2 + r.outIm[i] ** 2, r.tIn[i] / FS, r.inRe[i] ** 2 + r.inIm[i] ** 2]);
            }
            return {
                headers: ["tau_out (fs)", "Re A_out", "Im A_out", "|A_out|^2", "tau_in (fs)", "|A_in|^2"],
                rows
            };
        },
        canvases: Object.values(cv),
        caption: () => S ? (S.mat.name + ", λ0 = " + S.s.lam + " nm, FWHM0 = " + S.s.fw + " fs, input GDD = " + S.s.gdd + " fs², z = " + S.s.z + " mm, " + S.s.mode + " k(ω), " + S.s.frame + " frame") : ""
    });


    $("presetNote").textContent = PRESETS.bk7.note;
    url.ready.then((restored) => {
        if (restored) {
            clearPresetHighlight();
            $("presetNote").textContent = "";
        }
        renderNow();
    });
    renderNow();
})();