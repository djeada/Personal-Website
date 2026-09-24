(function() {
    "use strict";
    const UI = window.OpticsUI,
        core = window.OpticsModels.core,
        FO = window.OpticsModels.fourierOptics;
    const $ = (id) => document.getElementById(id);
    const TH = UI.CANVAS_PALETTE;
    const FS = 12;
    const fmt = (v, d = 3) => (Number.isFinite(v) ? Number(v.toPrecision(d)).toString() : "—");
    const um = (m, d = 3) => (Number.isFinite(m) ? fmt(m * 1e6, d) + " µm" : "—");
    const perUm = (f, d = 3) => (Number.isFinite(f) ? fmt(f * 1e-6, d) + " /µm" : "—");


    const DEFAULTS = Object.freeze({
        mode: "incoherent",
        obj: "twoPoints",
        sep: 1,
        pph: 0,
        nu: 1,
        phi: 0.3,
        txt: "OPTICS",
        lam: 550,
        na: 0.5,
        fov: 16,
        fl: 100,
        N: "256",
        filt: "none",
        r1: 0.5,
        r2: 1,
        dz: 0,
        z2: 0,
        z4: 0,
        z6: 0,
        z8: 0,
        z11: 0,
        lspec: true,
        lpsf: false
    });
    const PRESETS = {
        airy: {
            v: {
                obj: "point",
                lpsf: true
            },
            note: "Single point, open circular pupil. Expect an Airy pattern whose first dark ring sits at 0.61λ₀/NA = 0.671 µm (compare the measured PSF zero readout) and an MTF that reaches zero at 2NA/λ₀ = 1.82 /µm."
        },
        rayleigh: {
            v: {
                obj: "twoPoints",
                sep: 0.67
            },
            note: "Incoherent points at the Rayleigh separation 0.61λ₀/NA. Expect a midpoint dip to about 0.735 of the peak intensity (a 26 % dip)."
        },
        cohPoints: {
            v: {
                obj: "twoPoints",
                sep: 0.67,
                mode: "coherent"
            },
            note: "Same points, coherent and in phase. Expect no dip: the amplitudes add at the midpoint (ratio > 1). Set the relative phase to 180° and the midpoint goes dark."
        },
        cutoff: {
            v: {
                obj: "sinusoid",
                nu: 1.2,
                mode: "coherent"
            },
            note: "ν ≈ 1.19 /µm lies between NA/λ₀ = 0.91 and 2NA/λ₀ = 1.82 /µm. Coherent: the ±1 orders miss the pupil and the image is uniform. Switch to incoherent: the contrast becomes MTF(ν) ≈ 0.23."
        },
        mtf: {
            v: {
                obj: "sinusoid",
                nu: 0.6
            },
            note: "Incoherent sinusoid at ν = 0.625 /µm (snapped). Expect image modulation = MTF(ν) ≈ 0.57; the ν marker on the MTF plot shows the same value."
        },
        phaseContrast: {
            v: {
                obj: "phase",
                mode: "coherent",
                na: 0.9,
                phi: 0.2,
                filt: "phasecontrast",
                r1: 0.03
            },
            note: "Transparent cell (φ = 0.2 rad). With the +π/2 phase dot on the undiffracted light the cell appears bright: I ≈ (1 + φ)², an intensity step of about 2φ = 0.4. Set the filter to None and it almost disappears."
        },
        darkField: {
            v: {
                obj: "phase",
                mode: "coherent",
                na: 0.9,
                phi: 0.2,
                filt: "darkfield",
                r1: 0.03
            },
            note: "Dark-field stop blocks the DC light. Expect a black background with glowing phase edges (intensity ∝ φ²)."
        },
        schlieren: {
            v: {
                obj: "phase",
                mode: "coherent",
                na: 0.9,
                phi: 0.2,
                filt: "knife"
            },
            note: "Knife edge blocks f_x < 0. Expect one-sided shading: phase edges are bright on one side and dark on the other (phase-gradient contrast)."
        },
        lowpass: {
            v: {
                obj: "letters",
                mode: "coherent",
                na: 0.9,
                nu: 1.2,
                filt: "lowpass",
                r1: 0.3
            },
            note: "Low-pass r₁ = 0.3 keeps |f| ≤ 0.49 /µm, coarser than the 0.42 µm strokes (1.2 cycles/µm fundamental). Expect blurred, ringing letters."
        },
        highpass: {
            v: {
                obj: "letters",
                mode: "coherent",
                na: 0.9,
                nu: 1,
                filt: "highpass",
                r1: 0.1
            },
            note: "High-pass removes DC and low frequencies. Expect edge enhancement: stroke outlines stay bright while uniform regions go dark."
        },
        marechal: {
            v: {
                obj: "point",
                z11: 0.05
            },
            note: "0.05 waves RMS of primary spherical aberration. Expect a Strehl ratio ≈ 0.905 against the Maréchal estimate exp[−(2π·0.05)²] = 0.906, and light moved into the rings."
        },
        dof: {
            v: {
                obj: "point",
                dz: 1.1
            },
            note: "Defocus Δz = λ₀/(2NA²) = 1.10 µm, the edge of the depth of focus. The paraxial quarter-wave rule predicts S = 0.81. The exact angular-spectrum phase at NA 0.5 gives a slightly lower value (see the through-focus plot)."
        },
        astig: {
            v: {
                obj: "bars",
                nu: 0.8,
                z6: 0.15,
                z4: -0.105
            },
            note: "Astigmatism (Z₆ = 0.15 λ) with Z₄ = −0.105 λ puts the line focus in this plane. Expect sharp vertical bars and blurred horizontal bars; the MTF cuts along f_x and f_y separate."
        }
    };

    let res = null,
        tf = null;
    let descs = {};
    const maps = {};
    const cursors = {
        cut: NaN,
        mtf: NaN,
        focus: NaN,
        trade: NaN
    };

    const ctl = UI.bindControls({
        mode: "radio:mode",
        obj: "#objSelect",
        sep: "#sepSlider",
        pph: "#pphSlider",
        nu: "#nuSlider",
        phi: "#phiSlider",
        txt: "#textInput",
        lam: "#lamSlider",
        na: "#naSlider",
        fov: "#fovSlider",
        fl: "#flSlider",
        N: "#gridSelect",
        filt: "#filterSelect",
        r1: "#r1Slider",
        r2: "#r2Slider",
        dz: "#dzSlider",
        z2: "#z2Slider",
        z4: "#z4Slider",
        z6: "#z6Slider",
        z8: "#z8Slider",
        z11: "#z11Slider",
        lspec: "#logSpec",
        lpsf: "#logPsf"
    }, () => {
        url.update();
        schedule();
    });
    const sliderUnits = {
        sepSlider: "µm",
        pphSlider: "°",
        nuSlider: "/µm",
        phiSlider: "rad",
        lamSlider: "nm",
        fovSlider: "µm",
        flSlider: "mm",
        dzSlider: "µm",
        z2Slider: "λ",
        z4Slider: "λ",
        z6Slider: "λ",
        z8Slider: "λ",
        z11Slider: "λ"
    };
    const sliderOpts = {};
    for (const id in sliderUnits) sliderOpts[id] = {
        unit: sliderUnits[id]
    };
    UI.enhanceAllSliders(document.querySelector(".options-sidebar"), sliderOpts);
    const url = UI.urlState({
        get: ctl.get,
        set: ctl.set
    });

    function toParams(s) {
        return {
            N: Number(s.N) || 256,
            fov: s.fov * 1e-6,
            lambda: s.lam * 1e-9,
            NA: s.na,
            fLens: s.fl * 1e-3,
            mode: s.mode === "coherent" ? "coherent" : "incoherent",
            object: FO.OBJECT_TYPES.includes(s.obj) ? s.obj : "twoPoints",
            sep: s.sep * 1e-6,
            nu: s.nu * 1e6,
            phi: s.phi,
            pointPhase: s.pph * Math.PI / 180,
            text: String(s.txt || "").toUpperCase().replace(/[^A-Z ]/g, "") || "A",
            filter: FO.FILTER_TYPES.includes(s.filt) ? s.filt : "none",
            r1: s.r1,
            r2: s.r2,
            dz: s.dz * 1e-6,
            zernike: {
                2: s.z2,
                4: s.z4,
                6: s.z6,
                8: s.z8,
                11: s.z11
            }
        };
    }


    function crop(a, N, half) {
        half = Math.min(N / 2, Math.max(4, Math.round(half)));
        const n = 2 * half,
            out = new Float64Array(n * n),
            o = N / 2 - half;
        for (let y = 0; y < n; y++)
            for (let x = 0; x < n; x++) out[y * n + x] = a[(y + o) * N + x + o];
        return {
            data: out,
            n,
            half
        };
    }

    function drawMap(ctx, w, h, o) {
        const l = FS * 4.2,
            rr = 70,
            t = 22,
            b = FS * 3.4;
        const size = Math.max(60, Math.min(w - l - rr, h - t - b));
        const x0 = Math.max(0, (w - (l + size + rr)) / 2);
        const ext = [o.min, o.max];
        const map = UI.plot(ctx, {
            x: x0,
            y: 0,
            w: l + size + rr,
            h: t + size + b
        }, {
            x: {
                min: ext[0],
                max: ext[1],
                label: o.xlabel,
                unit: o.unit
            },
            y: {
                min: ext[0],
                max: ext[1],
                label: o.ylabel,
                unit: o.unit
            },
            series: [],
            legend: false,
            margin: {
                l,
                r: rr,
                t,
                b
            }
        });
        const P = map.plot;
        if (o.under) {
            ctx.save();
            o.under(ctx, map);
            ctx.restore();
        }
        const norm = UI.imageFromArray(ctx, o.data, o.n, o.n, P, o.cmap, o.norm || {});
        ctx.strokeStyle = TH.axis;
        ctx.lineWidth = 1;
        ctx.strokeRect(P.x + 0.5, P.y + 0.5, P.w - 1, P.h - 1);
        if (o.overlay) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(P.x, P.y, P.w, P.h);
            ctx.clip();
            o.overlay(ctx, map);
            ctx.restore();
        }
        const cb = {
            x: P.x + P.w + 10,
            y: P.y,
            w: 12,
            h: P.h
        };
        UI.drawColorbar(ctx, cb, o.cmap, Object.assign({
            min: norm.min,
            max: norm.max,
            log: norm.log
        }, o.cb || {}));
        if (o.cbLabel) {
            ctx.font = FS + "px " + TH.font;
            ctx.fillStyle = TH.text;
            ctx.textAlign = "right";
            ctx.textBaseline = "top";
            ctx.fillText(o.cbLabel, Math.min(w - 2, cb.x + 60), 3);
        }
        return map;
    }

    function circle(ctx, map, r, color, dash, width = 1.5) {
        const c = map.toPx(0, 0),
            rx = Math.abs(map.xToPx(r) - c.x);
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.setLineDash(dash || []);
        ctx.beginPath();
        ctx.arc(c.x, c.y, rx, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    function tag(ctx, text, x, y, color) {
        ctx.font = FS + "px " + TH.font;
        const tw = ctx.measureText(text).width;
        ctx.fillStyle = "rgba(7,7,13,0.78)";
        ctx.fillRect(x - 3, y - 2, tw + 6, FS + 5);
        ctx.fillStyle = color || TH.text;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText(text, x, y);
    }

    function rowOf(a, N) {
        return a.slice((N / 2) * N, (N / 2) * N + N);
    }

    function colOf(a, N) {
        const c = new Float64Array(N);
        for (let i = 0; i < N; i++) c[i] = a[i * N + N / 2];
        return c;
    }


    let pending = 0;

    function schedule() {
        if (!pending) pending = requestAnimationFrame(() => {
            pending = 0;
            compute();
            drawAll();
        });
    }

    function compute() {
        const s = ctl.get();
        const p = toParams(s);
        res = FO.simulate(p);

        const dof = FO.depthOfFocus(p.lambda, p.NA);
        const range = Math.max(2.5 * dof, 1.25 * Math.abs(p.dz));
        const zs = core.linspace(-range, range, 161);
        const zRel = Array.from(zs, (z) => z - p.dz);
        const I = FO.throughFocus(res.grid, res.pupil, p.lambda, zRel);
        tf = {
            zs,
            I,
            ref: Array.from(zs, (z) => FO.axialIntensityParaxial(z, p.lambda, p.NA)),
            dof
        };
        updateText(s, p);
    }


    const cv = {};

    function setup(id, key, aspect, draw, minHeight = 240) {
        cv[key] = UI.setupCanvas($(id), {
            aspect,
            minHeight,
            maxHeight: 520,
            draw
        });
    }

    function drawAll() {
        for (const k in cv) cv[k].redraw();
    }


    function viewHalf() {
        const g = res.grid,
            p = res.params,
            R = res.readouts;
        if (p.object !== "point" && p.object !== "twoPoints") return g.N / 2;
        const ext = (p.object === "twoPoints" ? p.sep / 2 : 0) + 3.5 * R.rayleigh;
        return Math.min(g.N / 2, Math.ceil(ext / g.dx));
    }

    function drawObject(ctx, w, h) {
        if (!res) return;
        const g = res.grid,
            N = g.N,
            o = res.object;
        const half = viewHalf(),
            d = g.dx * 1e6;
        const isPhase = o.type === "phase";
        const data = isPhase ? o.phaseMap : o.intensity;
        const c = crop(data, N, half);
        maps.obj = drawMap(ctx, w, h, {
            data: c.data,
            n: c.n,
            min: (-c.half - 0.5) * d,
            max: (c.half - 0.5) * d,
            xlabel: "x",
            ylabel: "y",
            unit: "µm",
            cmap: "viridis",
            norm: isPhase ? {
                min: 0,
                max: Math.max(1e-6, 3 * o.phi)
            } : {
                min: 0,
                max: 1
            },
            cbLabel: isPhase ? "phase φ (rad)" : "|t|²",
            overlay: (cx, map) => {
                if (o.points)
                    for (const pt of o.points) {
                        const q = map.toPx(pt.x * 1e6, pt.y * 1e6);
                        cx.strokeStyle = TH.marker;
                        cx.lineWidth = 1.5;
                        cx.beginPath();
                        cx.arc(q.x, q.y, 6, 0, 2 * Math.PI);
                        cx.stroke();
                    }
            }
        });
    }

    function drawSpectrum(ctx, w, h) {
        if (!res) return;
        const g = res.grid,
            N = g.N,
            R = res.readouts,
            p = res.params;
        const rp = R.fc / g.df;
        const half = Math.min(N / 2, Math.ceil(2.3 * rp) + 2);
        const n = N * N,
            pw = new Float64Array(n);
        let mx = 0;
        for (let k = 0; k < n; k++) {
            pw[k] = Math.hypot(res.fourier.re[k], res.fourier.im[k]) ** 2;
            if (pw[k] > mx) mx = pw[k];
        }
        for (let k = 0; k < n; k++) pw[k] /= mx || 1;
        const c = crop(pw, N, half),
            d = g.df * 1e-6;
        const log = ctl.get().lspec;
        maps.spec = drawMap(ctx, w, h, {
            data: c.data,
            n: c.n,
            min: (-c.half - 0.5) * d,
            max: (c.half - 0.5) * d,
            xlabel: "fx",
            ylabel: "fy",
            unit: "1/µm",
            cmap: "inferno",
            norm: log ? {
                log: true,
                min: 1e-6,
                max: 1
            } : {
                min: 0,
                max: 1
            },
            cbLabel: (p.mode === "coherent" ? "|T|²" : "|Ĩ|²") + (log ? " (log)" : "") + ", peak = 1",
            overlay: (cx, map) => {
                const fc = R.fc * 1e-6;
                if (p.filter === "knife") {
                    const x0 = map.xToPx(0);
                    cx.fillStyle = "rgba(7,7,13,0.55)";
                    cx.fillRect(map.plot.x, map.plot.y, x0 - map.plot.x, map.plot.h);
                }
                circle(cx, map, fc, "#ffffff", [], 1.5);
                circle(cx, map, 2 * fc, "#ffffff", [6, 4], 1.2);
                if (["lowpass", "highpass", "bandpass"].includes(p.filter)) circle(cx, map, p.r1 * fc, TH.series[0], [4, 3], 1.5);
                if (p.filter === "bandpass") circle(cx, map, p.r2 * fc, TH.series[0], [4, 3], 1.5);
                if (p.filter === "darkfield" || p.filter === "phasecontrast") circle(cx, map, Math.max(0.51 * g.df, p.r1 * R.fc) * 1e-6, TH.series[0], [], 2);
                const q = map.toPx(fc * Math.SQRT1_2, fc * Math.SQRT1_2);
                tag(cx, "NA/λ₀", q.x + 3, q.y - FS - 6, "#ffffff");
            }
        });
    }

    function drawPupil(ctx, w, h) {
        if (!res) return;
        const g = res.grid,
            N = g.N,
            R = res.readouts,
            p = res.params,
            pu = res.pupil;
        const rp = R.fc / g.df;
        const half = Math.min(N / 2, Math.ceil(1.15 * rp) + 2);
        const n = N * N,
            W = new Float64Array(n);
        let wmax = 0.05;
        for (let k = 0; k < n; k++) {
            const pass = Math.hypot(pu.filterRe[k], pu.filterIm[k]) > 0;
            W[k] = pu.aperture[k] > 0 && pass ? pu.W[k] : NaN;
            if (pu.aperture[k] > 0) wmax = Math.max(wmax, Math.abs(pu.W[k]));
        }
        wmax = Number(wmax.toPrecision(2));
        const c = crop(W, N, half),
            d = g.df * 1e-6;
        maps.pupil = drawMap(ctx, w, h, {
            data: c.data,
            n: c.n,
            min: (-c.half - 0.5) * d,
            max: (c.half - 0.5) * d,
            xlabel: "fx",
            ylabel: "fy",
            unit: "1/µm",
            cmap: "diverging",
            norm: {
                min: -wmax,
                max: wmax
            },
            cbLabel: "W (waves)",
            under: (cx, map) => {
                const cc = map.toPx(0, 0),
                    r = Math.abs(map.xToPx(R.fc * 1e-6) - cc.x);
                cx.beginPath();
                cx.arc(cc.x, cc.y, r, 0, 2 * Math.PI);
                cx.clip();
                cx.fillStyle = "#1c1a2b";
                cx.fillRect(cc.x - r, cc.y - r, 2 * r, 2 * r);
                cx.strokeStyle = "rgba(184,178,207,0.55)";
                cx.lineWidth = 1;
                for (let s = -2 * r; s < 2 * r; s += 7) {
                    cx.beginPath();
                    cx.moveTo(cc.x + s, cc.y - r);
                    cx.lineTo(cc.x + s + 2 * r, cc.y + r);
                    cx.stroke();
                }
            },
            overlay: (cx, map) => {
                circle(cx, map, R.fc * 1e-6, "#ffffff", [], 1.2);
                if (p.filter === "phasecontrast") {
                    const rr = Math.max(0.51 * g.df, p.r1 * R.fc) * 1e-6;
                    circle(cx, map, rr, TH.marker, [], 2.5);
                    const q = map.toPx(rr, rr);
                    tag(cx, "+π/2", q.x + 4, q.y - FS - 4, TH.marker);
                }
                const q = map.toPx(-R.fc * 1e-6 * 1.08, R.fc * 1e-6 * 1.1);
                tag(cx, "pupil ⌀ " + fmt(2 * R.fourierPlaneRadius * 1e3, 3) + " mm (f = " + p.fLens * 1e3 + " mm)", Math.max(map.plot.x + 4, q.x), map.plot.y + 4, TH.textMuted);
            }
        });
    }

    function drawImage(ctx, w, h) {
        if (!res) return;
        const g = res.grid,
            N = g.N,
            R = res.readouts,
            pt = res.params.object === "point" || res.params.object === "twoPoints";
        const scale = pt ? 1 / R.pointNorm : 1;
        const I = new Float64Array(N * N);
        let mx = 0;
        for (let k = 0; k < I.length; k++) {
            I[k] = res.image.I[k] * scale;
            if (I[k] > mx) mx = I[k];
        }
        const half = viewHalf(),
            d = g.dx * 1e6;
        const c = crop(I, N, half);
        maps.img = drawMap(ctx, w, h, {
            data: c.data,
            n: c.n,
            min: (-c.half - 0.5) * d,
            max: (c.half - 0.5) * d,
            xlabel: "x",
            ylabel: "y",
            unit: "µm",
            cmap: "viridis",
            norm: {
                min: 0,
                max: Math.max(mx, 1e-12)
            },
            cbLabel: pt ? "I / ideal point peak" : "I / I_illum"
        });
    }

    function drawPsf(ctx, w, h) {
        if (!res) return;
        const g = res.grid,
            N = g.N,
            R = res.readouts;
        const half = Math.min(N / 2, Math.ceil(3.5 * R.rayleigh / g.dx));
        const c = crop(res.psf.I, N, half),
            d = g.dx * 1e6;
        let mx = 0;
        for (const v of c.data)
            if (v > mx) mx = v;
        const log = ctl.get().lpsf;
        maps.psf = drawMap(ctx, w, h, {
            data: c.data,
            n: c.n,
            min: (-c.half - 0.5) * d,
            max: (c.half - 0.5) * d,
            xlabel: "x",
            ylabel: "y",
            unit: "µm",
            cmap: "inferno",
            norm: log ? {
                log: true,
                min: 1e-4 * Math.max(mx, 1e-12),
                max: Math.max(mx, 1e-12)
            } : {
                min: 0,
                max: Math.max(mx, 1e-12)
            },
            cbLabel: "|h|² / |h₀(0)|²" + (log ? " (log)" : ""),
            overlay: (cx, map) => {
                circle(cx, map, R.rayleigh * 1e6, TH.series[0], [5, 4], 1.4);
                tag(cx, "0.61λ₀/NA", map.plot.x + 4, map.plot.y + 4, TH.series[0]);
            }
        });
    }

    function drawMtf(ctx, w, h) {
        if (!res) return;
        const g = res.grid,
            N = g.N,
            R = res.readouts,
            p = res.params,
            cuts = res.cuts;
        const fmax = Math.min(g.fNyquist, 2.3 * R.fc) * 1e-6;
        const xs = [],
            mtfX = [],
            mtfY = [],
            ctf = [],
            mref = [],
            cref = [];
        const my = colOf(res.otf.mtf, N);
        let differs = false;
        for (let i = N / 2; i < N; i++) {
            const f = cuts.f[i];
            if (f * 1e-6 > fmax + 1e-9) break;
            xs.push(f * 1e-6);
            mtfX.push(cuts.mtf[i]);
            mtfY.push(my[i]);
            ctf.push(cuts.ctf[i]);
            mref.push(FO.mtfCircular(f, p.lambda, p.NA));
            cref.push(FO.ctfCircular(f, p.lambda, p.NA));
            if (Math.abs(my[i] - cuts.mtf[i]) > 2e-3) differs = true;
        }

        const inc = p.mode === "incoherent";
        const series = [{
                xs,
                ys: mtfX,
                label: "MTF fx" + (inc ? " ★" : ""),
                color: TH.series[0],
                width: inc ? 2.6 : 1.6
            },
            {
                xs,
                ys: mref,
                label: "MTF ideal",
                color: TH.series[0],
                dash: [6, 4],
                width: 1.2
            },
            {
                xs,
                ys: ctf,
                label: "|CTF| fx" + (inc ? "" : " ★"),
                color: TH.series[1],
                width: inc ? 1.6 : 2.6
            },
            {
                xs,
                ys: cref,
                label: "CTF ideal",
                color: TH.series[1],
                dash: [2, 3],
                width: 1.2
            }
        ];
        if (differs) series.splice(1, 0, {
            xs,
            ys: mtfY,
            label: "MTF fy",
            color: TH.series[2],
            dash: [10, 3, 2, 3],
            width: 2
        });
        const markers = [{
            x: R.fc * 1e-6,
            label: "NA/λ₀"
        }, {
            x: 2 * R.fc * 1e-6,
            label: "2NA/λ₀"
        }];
        if (R.target) markers.push({
            x: R.target.nu * 1e-6,
            label: "ν",
            color: TH.series[4]
        });
        const cx = cursors.mtf;
        maps.mtf = UI.plot(ctx, {
            x: 0,
            y: 0,
            w,
            h
        }, {
            x: {
                min: 0,
                max: fmax,
                label: "spatial frequency f",
                unit: "1/µm"
            },
            y: {
                min: 0,
                max: 1.5,
                label: "transfer",
                ticks: Object.assign([0, 0.2, 0.4, 0.6, 0.8, 1], {
                    step: 0.2
                })
            },
            series,
            markers,
            legendPosition: "left",
            cursor: Number.isFinite(cx) ? {
                x: cx,
                label: "f=" + fmt(cx) + " MTF=" + fmt(UI.interpAt(xs, mtfX, cx), 3) + " |CTF|=" + fmt(UI.interpAt(xs, ctf, cx), 3)
            } : null
        });
    }

    function drawCut(ctx, w, h) {
        if (!res) return;
        const g = res.grid,
            R = res.readouts,
            p = res.params,
            cuts = res.cuts;
        const pt = p.object === "point" || p.object === "twoPoints";
        const xs = Array.from(cuts.x, (v) => v * 1e6);
        const img = Array.from(cuts.image, (v) => (pt ? v / R.pointNorm : v));
        const obj = Array.from(cuts.object);
        let mx = 0;
        for (const v of img) mx = Math.max(mx, v);
        const ymax = pt ? Math.max(1.4, mx * 1.35) : Math.max(1.3, mx * 1.3, ...obj);
        const series = [{
                xs,
                ys: obj,
                label: p.object === "phase" ? "object |t|² (= 1, phase only)" : "object |t|²",
                color: TH.series[3],
                dash: [6, 4],
                width: 1.4
            },
            {
                xs,
                ys: img,
                label: "image (" + p.mode + ")",
                color: TH.series[0],
                width: 2.2
            }
        ];
        const markers = [];
        if (p.object === "twoPoints") {
            markers.push({
                x: -p.sep * 5e5,
                label: "−s/2"
            }, {
                x: p.sep * 5e5,
                label: "+s/2"
            });
        }
        const cx = cursors.cut;
        maps.cut = UI.plot(ctx, {
            x: 0,
            y: 0,
            w,
            h
        }, {
            x: pt ? {
                min: -viewHalf() * g.dx * 1e6,
                max: viewHalf() * g.dx * 1e6,
                label: "x",
                unit: "µm"
            } : {
                min: xs[0],
                max: xs[xs.length - 1],
                label: "x",
                unit: "µm"
            },
            y: {
                min: 0,
                max: ymax,
                label: pt ? "I / ideal point peak" : "I / I_illum"
            },
            series,
            markers,
            cursor: Number.isFinite(cx) ? {
                x: cx,
                label: "x=" + fmt(cx) + " µm  I=" + fmt(UI.interpAt(xs, img, cx), 3)
            } : null
        });
    }

    function drawFocus(ctx, w, h) {
        if (!res || !tf) return;
        const xs = Array.from(tf.zs, (z) => z * 1e6);
        const d2 = tf.dof / 2 * 1e6;
        const cx = cursors.focus;
        maps.focus = UI.plot(ctx, {
            x: 0,
            y: 0,
            w,
            h
        }, {
            x: {
                min: xs[0],
                max: xs[xs.length - 1],
                label: "defocus Δz",
                unit: "µm"
            },
            y: {
                min: 0,
                max: 1.2,
                label: "I(0, Δz) / I₀",
                ticks: Object.assign([0, 0.2, 0.4, 0.6, 0.8, 1], {
                    step: 0.2
                })
            },
            series: [{
                    xs,
                    ys: Array.from(tf.I),
                    label: "exact (current pupil)",
                    color: TH.series[0],
                    width: 2.2
                },
                {
                    xs,
                    ys: tf.ref,
                    label: "paraxial sinc², no aberration",
                    color: TH.series[1],
                    dash: [6, 4],
                    width: 1.4
                }
            ],
            markers: [{
                x: -d2,
                label: "−λ₀/2NA²"
            }, {
                x: d2,
                label: "+λ₀/2NA²"
            }, {
                x: res.params.dz * 1e6,
                label: "Δz",
                color: TH.series[4],
                dash: []
            }],
            legend: "outside",
            cursor: Number.isFinite(cx) ? {
                x: cx,
                label: "Δz=" + fmt(cx) + " µm  I=" + fmt(UI.interpAt(xs, Array.from(tf.I), cx), 3)
            } : null
        });
    }

    function drawTrade(ctx, w, h) {
        if (!res) return;
        const lam = res.params.lambda,
            NA = res.params.NA;
        const nas = Array.from(core.linspace(0.05, 0.95, 181));
        const ray = nas.map((a) => FO.rayleigh(lam, a) * 1e6),
            dof = nas.map((a) => FO.depthOfFocus(lam, a) * 1e6);
        const eta = nas.map((a) => FO.collectedFraction(a)),
            par = nas.map((a) => a * a / 4);
        const hTop = Math.round(h * 0.56);
        const cx = Number.isFinite(cursors.trade) ? cursors.trade : NA;
        maps.trade = UI.plot(ctx, {
            x: 0,
            y: 0,
            w,
            h: hTop
        }, {
            x: {
                min: 0.05,
                max: 0.95,
                label: "NA"
            },
            y: {
                min: 0.1,
                max: 300,
                log: true,
                label: "length",
                unit: "µm"
            },
            series: [{
                xs: nas,
                ys: ray,
                label: "Rayleigh 0.61λ₀/NA",
                color: TH.series[0]
            }, {
                xs: nas,
                ys: dof,
                label: "DOF λ₀/NA²",
                color: TH.series[1],
                dash: [6, 4]
            }],
            cursor: {
                x: cx,
                label: "NA " + fmt(cx, 2) + ": r " + fmt(FO.rayleigh(lam, cx) * 1e6) + " µm, DOF " + fmt(FO.depthOfFocus(lam, cx) * 1e6) + " µm"
            }
        });
        maps.trade2 = UI.plot(ctx, {
            x: 0,
            y: hTop,
            w,
            h: h - hTop
        }, {
            x: {
                min: 0.05,
                max: 0.95,
                label: "NA"
            },
            y: {
                min: 0,
                max: 0.36,
                label: "collected"
            },
            series: [{
                xs: nas,
                ys: eta,
                label: "(1 − cos θ)/2",
                color: TH.series[2]
            }, {
                xs: nas,
                ys: par,
                label: "NA²/4",
                color: TH.series[3],
                dash: [2, 3]
            }],
            cursor: {
                x: cx,
                label: fmt(FO.collectedFraction(cx) * 100, 3) + " %"
            },
            legendPosition: "left"
        });
    }


    function setText(id, t) {
        const e = $(id);
        if (e && e.textContent !== t) e.textContent = t;
    }
    const readoutEl = $("readouts");

    function updateText(s, p) {
        const R = res.readouts;
        const coh = p.mode === "coherent";
        setText("sepValue", s.sep.toFixed(2) + " µm");
        setText("pphValue", s.pph + "°");
        setText("nuValue", s.nu.toFixed(2) + " /µm");
        setText("phiValue", s.phi.toFixed(2) + " rad");
        setText("lamValue", s.lam + " nm");
        setText("naValue", s.na.toFixed(2));
        setText("fovValue", s.fov + " µm");
        setText("flValue", s.fl + " mm");
        setText("r1Value", s.r1.toFixed(2));
        setText("r2Value", s.r2.toFixed(2));
        setText("dzValue", s.dz + " µm");
        for (const z of ["z2", "z4", "z6", "z8", "z11"]) setText(z + "Value", s[z].toFixed(3) + " λ");

        document.querySelectorAll("[data-for]").forEach((el) => {
            el.hidden = !el.dataset.for.split(" ").includes(p.object);
        });
        document.querySelectorAll("[data-filter]").forEach((el) => {
            el.hidden = !el.dataset.filter.split(" ").includes(p.filter);
        });

        setText("statMode", coh ? "Coherent" : "Incoherent");
        setText("statNA", p.NA.toFixed(2));
        setText("statRayleigh", um(R.rayleigh));
        setText("statCutoff", perUm(coh ? R.fc : 2 * R.fc));
        setText("statCutoffLabel", coh ? "Coherent cutoff NA/λ₀" : "Incoherent cutoff 2NA/λ₀");
        setText("statStrehl", R.strehl.toFixed(3));
        setText("statDof", um(R.dof));
        const badge = $("modeBadge");
        badge.textContent = coh ? "coherent · I = |F⁻¹{T·P}|²" : "incoherent · I = I_obj ⊛ |h|²";
        badge.dataset.mode = p.mode;
        setText("tfBadge", coh ? "|CTF| active" : "MTF active");
        $("modeHint").innerHTML = coh ?
            "Coherent: U<sub>img</sub> = F⁻¹{T·P}, I = |U<sub>img</sub>|². The pupil acts on the complex amplitude; cutoff NA/λ₀." :
            "Incoherent: I<sub>img</sub> = I<sub>obj</sub> ⊛ |h|². Transfer function OTF = normalised autocorrelation of the pupil; cutoff 2NA/λ₀.";
        setText("objBadge", p.object === "phase" ? "phase" : "|t|²");
        setText("specBadge", coh ? "|T(f)|²" : "|Ĩ(f)|²");
        setText("specCaption", (coh ?
                "Coherent: amplitude spectrum T of the object at the back focal plane of lens 1 (u = λ₀f·fx). " :
                "Incoherent: there is no fixed Fourier-plane pattern; shown is the object intensity spectrum Ĩ that the OTF (support 2NA/λ₀) filters. ") +
            "Solid circle: pupil edge NA/λ₀ ↔ u = NA·f = " + fmt(R.fourierPlaneRadius * 1e3) + " mm; dashed: 2NA/λ₀.");
        const pt = p.object === "point" || p.object === "twoPoints";
        setText("cutBadge", pt ? "normalised to one ideal point" : "units of illumination");
        const vh = viewHalf();
        setText("objCaption", "Object: " + res.object.info + ". " + (vh < p.N / 2 ? "View zoomed to ±" + um(vh * R.dx) + " of the " : "Full ") + "periodic field " + s.fov + " µm, " + p.N + " × " + p.N + " samples (dx = " + um(R.dx) + "). Object and image panels share the same view.");

        const warn = $("warnBox");
        warn.hidden = !res.warnings.length;
        warn.textContent = res.warnings.join(" ");

        const rows = [
            ["Mode", coh ? "coherent (amplitude)" : "incoherent (intensity)"],
            ["Coherent cutoff NA/λ₀", perUm(R.fc) + " (measured |CTF| = ½ at " + perUm(R.coherentCutoffMeasured) + ")"],
            ["Incoherent cutoff 2NA/λ₀", perUm(2 * R.fc) + " (MTF < 10⁻³ at " + perUm(R.incoherentCutoffMeasured) + ")"],
            ["Rayleigh 0.61λ₀/NA", um(R.rayleigh)],
            ["Measured PSF first minimum", um(R.psfFirstZero) + (p.filter === "none" && R.rmsWaves < 1e-9 ? " (unaberrated: Airy)" : "")],
            ["Abbe coherent period λ₀/NA", um(R.abbe)],
            ["Depth of focus λ₀/NA²", um(R.dof)],
            ["Collected fraction (1 − cos θ)/2", (R.collectedFraction * 100).toFixed(2) + " %"],
            ["Strehl ratio (aberrations)", R.strehl.toFixed(4) + (R.strehl < 0.8 ? " (below 0.8)" : "")],
            ["RMS / P-V wavefront", fmt(R.rmsWaves, 3) + " / " + fmt(R.pvWaves, 3) + " waves"],
            ["Maréchal exp[−(2πω)²]", R.marechal.toFixed(4)],
            ["Pupil transmission ∫|P·F|²/∫|A|²", R.pupilThroughput.toFixed(3)],
            ["Pupil radius in the 4f plane", fmt(R.fourierPlaneRadius * 1e3) + " mm (" + R.pupilRadiusPx.toFixed(1) + " samples)"]
        ];
        if (R.twoPoint && p.object === "twoPoints") {
            rows.push(["Two-point dip (midpoint / peak)", R.twoPoint.dipRatio.toFixed(3) + " at s = " + fmt(R.twoPoint.sepOverRayleigh, 3) + " × Rayleigh"]);
        }
        if (R.target) {
            rows.push(["Target ν (used)", perUm(R.target.nu) + " = " + fmt(R.target.nuOverFc, 3) + " f_c"]);
            rows.push(["Image / object modulation", fmt(R.target.imageModulation / Math.max(R.target.objectModulation, 1e-12), 3) + (coh || p.object !== "sinusoid" ? "" : " (MTF(ν) = " + fmt(R.target.mtfAtNu, 3) + ")")]);
        }
        const sc = pt ? 1 / R.pointNorm : 1;
        rows.push(["Image min / max", fmt(R.image.min * sc, 3) + " / " + fmt(R.image.max * sc, 3) + (pt ? " × ideal point peak" : " × I_illum")]);
        readoutEl.innerHTML = rows.map(([k, v]) => "<div><dt>" + k + "</dt><dd>" + v + "</dd></div>").join("");


        if (descs.img) {
            descs.obj.update("Object: " + res.object.info + ".");
            descs.spec.update("Fourier plane: " + (coh ? "amplitude" : "intensity") + " spectrum; pupil radius NA/λ₀ = " + perUm(R.fc) + "; filter " + p.filter + ".");
            descs.pupil.update("Pupil wavefront: RMS " + fmt(R.rmsWaves) + " waves, peak-to-valley " + fmt(R.pvWaves) + " waves; filter " + p.filter + ".");
            descs.img.update((coh ? "Coherent" : "Incoherent") + " image: intensity range " + fmt(R.image.min) + " to " + fmt(R.image.max) + (R.twoPoint ? "; two-point midpoint/peak ratio " + R.twoPoint.dipRatio.toFixed(3) : "") + (R.target ? "; modulation " + fmt(R.target.imageModulation) : "") + ".");
            descs.psf.update("PSF: Strehl " + R.strehl.toFixed(3) + ", first minimum at " + um(R.psfFirstZero) + ", Airy prediction " + um(R.rayleigh) + ".");
            descs.mtf.update("Transfer functions: MTF reaches zero at " + perUm(R.incoherentCutoffMeasured) + " (theory 2NA/λ₀ = " + perUm(2 * R.fc) + "); CTF edge at " + perUm(R.coherentCutoffMeasured) + " (theory " + perUm(R.fc) + ").");
            descs.cut.update("Line cut at y = 0: image intensity maximum " + fmt(R.image.max) + ".");
            descs.focus.update("Through focus: on-axis intensity at the current defocus " + s.dz + " µm is " + fmt(R.strehlOnAxis, 3) + "; depth of focus λ₀/NA² = " + um(R.dof) + ".");
            descs.trade.update("At NA " + p.NA.toFixed(2) + ": Rayleigh " + um(R.rayleigh) + ", depth of focus " + um(R.dof) + ", collected fraction " + (R.collectedFraction * 100).toFixed(2) + " %.");
        }
    }


    compute();
    setup("objCanvas", "obj", 1.08, drawObject);
    setup("specCanvas", "spec", 1.08, drawSpectrum);
    setup("pupilCanvas", "pupil", 1.08, drawPupil);
    setup("imgCanvas", "img", 1.08, drawImage);
    setup("psfCanvas", "psf", 1.08, drawPsf);
    setup("mtfCanvas", "mtf", 1.08, drawMtf);
    setup("cutCanvas", "cut", 3.2, drawCut, 220);
    setup("focusCanvas", "focus", 1.5, drawFocus, 260);
    setup("tradeCanvas", "trade", 1.2, drawTrade, 340);

    descs = {
        obj: UI.describeCanvas($("objCanvas"), "Object", {
            label: "Object intensity or phase map"
        }),
        spec: UI.describeCanvas($("specCanvas"), "Fourier plane", {
            label: "Fourier-plane spectrum with pupil and filter outlines"
        }),
        pupil: UI.describeCanvas($("pupilCanvas"), "Pupil", {
            label: "Pupil wavefront error and filter"
        }),
        img: UI.describeCanvas($("imgCanvas"), "Image", {
            label: "Image intensity"
        }),
        psf: UI.describeCanvas($("psfCanvas"), "PSF", {
            label: "Intensity point-spread function"
        }),
        mtf: UI.describeCanvas($("mtfCanvas"), "Transfer functions", {
            label: "MTF and coherent transfer function versus spatial frequency"
        }),
        cut: UI.describeCanvas($("cutCanvas"), "Line cut", {
            label: "Object and image intensity along x at y = 0"
        }),
        focus: UI.describeCanvas($("focusCanvas"), "Through focus", {
            label: "On-axis intensity versus defocus"
        }),
        trade: UI.describeCanvas($("tradeCanvas"), "Trade-offs", {
            label: "Resolution, depth of focus and collected power versus NA"
        })
    };
    updateText(ctl.get(), toParams(ctl.get()));

    function hover(canvasKey, mapKey, cursorKey) {
        const el = cv[canvasKey].canvas;
        el.addEventListener("pointermove", (e) => {
            const m = maps[mapKey];
            if (!m) return;
            const r = el.getBoundingClientRect(),
                px = e.clientX - r.left,
                py = e.clientY - r.top;
            const m2 = mapKey === "trade" ? maps.trade2 : null;
            if (m.contains(px, py) || (m2 && m2.contains(px, py))) {
                cursors[cursorKey] = m.pxToX(px);
                cv[canvasKey].redraw();
            }
        });
        el.addEventListener("pointerleave", () => {
            cursors[cursorKey] = NaN;
            cv[canvasKey].redraw();
        });
    }
    hover("cut", "cut", "cut");
    hover("mtf", "mtf", "mtf");
    hover("focus", "focus", "focus");
    hover("trade", "trade", "trade");

    function applyPreset(name) {
        const pr = PRESETS[name];
        if (!pr) return;
        ctl.set(Object.assign({}, DEFAULTS, pr.v));
        document.querySelectorAll("[data-preset]").forEach((b) => b.classList.toggle("active", b.dataset.preset === name));
        setText("presetNote", pr.note);
    }
    document.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => applyPreset(b.dataset.preset)));
    $("resetBtn").addEventListener("click", () => {
        ctl.set(Object.assign({}, DEFAULTS));
        document.querySelectorAll("[data-preset]").forEach((b) => b.classList.remove("active"));
        setText("presetNote", "Reset to the default system: two incoherent points 1 µm apart, λ₀ = 550 nm, NA = 0.5.");
    });

    UI.addExportBar($("exportHost"), {
        name: "fourier-optics",
        url,
        getState: () => Object.assign({
            readouts: res && res.readouts,
            warnings: res && res.warnings
        }, ctl.get()),
        getCSV: () => {
            const c = res.cuts,
                N = res.grid.N,
                p = res.params;
            const rows = [];
            for (let i = 0; i < N; i++) {
                rows.push([c.x[i] * 1e6, c.object[i], c.image[i], c.psf[i], c.f[i] * 1e-6, c.mtf[i], c.ctf[i], FO.mtfCircular(c.f[i], p.lambda, p.NA)]);
            }
            return {
                headers: ["x (um)", "object |t|^2", "image I (" + p.mode + ", absolute)", "PSF |h|^2/|h0(0)|^2", "f (1/um)", "MTF (fy=0)", "|CTF| (fy=0)", "MTF diffraction-limited"],
                rows
            };
        },
        canvases: [cv.obj.canvas, cv.spec.canvas, cv.pupil.canvas, cv.img.canvas, cv.psf.canvas, cv.mtf.canvas, cv.cut.canvas, cv.focus.canvas, cv.trade.canvas],
        caption: () => {
            const p = res.params;
            return "Fourier optics: " + p.mode + ", " + p.object + ", λ0 = " + Math.round(p.lambda * 1e9) + " nm, NA = " + p.NA + ", filter " + p.filter + ", Strehl " + res.readouts.strehl.toFixed(3);
        }
    });

    url.ready.then(() => schedule());
})();