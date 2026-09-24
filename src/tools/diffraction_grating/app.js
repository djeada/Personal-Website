(function() {
    "use strict";
    const UI = window.OpticsUI,
        core = window.OpticsModels.core,
        G = window.OpticsModels.grating;
    const NM = 1e-9,
        UM = 1e-6,
        MM = 1e-3,
        DEG = Math.PI / 180;
    const NPIX = 2048;
    const pal = UI.CANVAS_PALETTE;
    const $ = (id) => document.getElementById(id);
    const fmt = (v, digits = 3, unit = "") => core.formatSI(v, unit, digits);
    const fixed = (v, n) => (Number.isFinite(v) ? v.toFixed(n) : "—");


    const DEFAULTS = {
        sp: "hg",
        l0: 500,
        dl: 0.5,
        N: 3000,
        lpm: 600,
        af: 0.4,
        ti: 0,
        m: 1,
        lc: 492,
        zc: 578,
        sw: 10,
        fco: 150,
        fca: 150,
        px: 10,
        v: "all",
        log: false
    };
    const PRESETS = {
        hg: {
            state: {},
            note: "Mercury lamp, 600 lines/mm, N = 3000. Expect all five lines in orders ±1 and ±2 (only 404.7, 435.8 and 546.1 nm still propagate in order ±3); the yellow pair 577.0/579.1 nm (2.1 nm apart) needs only N ≈ 275 in first order, so the zoom shows it cleanly split."
        },
        naLow: {
            state: {
                sp: "na",
                N: 500,
                lc: 589.3,
                zc: 589.3,
                fco: 500,
                fca: 500,
                px: 5,
                v: "zoom"
            },
            note: "N = 500 is below λ/(mΔλ) ≈ 987: the two D lines merge into a single peak with no dip, for the ideal grating and on the pixels."
        },
        naHigh: {
            state: {
                sp: "na",
                N: 2000,
                lc: 589.3,
                zc: 589.3,
                fco: 500,
                fca: 500,
                px: 5,
                v: "zoom"
            },
            note: "N = 2000 is twice the Rayleigh requirement: two peaks 0.597 nm (192 µm, 38 pixels) apart with a deep dip between them."
        },
        rayleigh: {
            state: {
                sp: "two",
                l0: 500,
                dl: 0.5,
                N: 1000,
                lc: 500,
                zc: 500,
                sw: 2,
                fco: 500,
                fca: 500,
                px: 2,
                v: "zoom"
            },
            note: "Δλ = λ/(mN) exactly: each peak sits on the other's first zero. The ideal dip is close to 8/π² ≈ 81 %; lower N by 20 % and it vanishes."
        },
        slit: {
            state: {
                sp: "na",
                N: 5000,
                lc: 589.3,
                zc: 589.3,
                sw: 300,
                fco: 500,
                fca: 500,
                px: 5,
                v: "zoom"
            },
            note: "mN = 5000 would split the doublet five times over, but the 300 µm slit image (≈ 1 nm) blurs it: the ideal dip is deep, the pixel signal shows none."
        },
        missing: {
            state: {
                sp: "mono",
                l0: 550,
                N: 10,
                lpm: 100,
                af: 0.333,
                lc: 550,
                zc: 550,
                v: "all"
            },
            note: "a = d/3: orders ±3, ±6, ±9 … land on zeros of the single-slit envelope and vanish. With N = 10 there are 8 weak side lobes between neighbouring orders."
        },
        balmer: {
            state: {
                sp: "balmer",
                lc: 533,
                zc: 656.28,
                fco: 100,
                fca: 100,
                px: 12
            },
            note: "Hydrogen Balmer lines Hα–Hδ in first order. Their spacing shrinks towards the violet as the series converges on 364.6 nm."
        },
        white: {
            state: {
                sp: "white",
                N: 2000,
                lpm: 300,
                m: 2,
                lc: 550,
                zc: 650,
                fco: 100,
                fca: 100,
                v: "all",
                log: true
            },
            note: "Second-order 600–700 nm shares its angles with third-order 400–467 nm: above 600 nm the signal steps up as third-order violet light adds to the second-order red. Use the log axis to see the weak continuum next to the zero order."
        }
    };


    const sidebar = document.querySelector(".options-sidebar");
    UI.enhanceAllSliders(sidebar, {
        l0Slider: {
            unit: "nm"
        },
        dlSlider: {
            unit: "nm"
        },
        lpmSlider: {
            unit: "/mm"
        },
        tiSlider: {
            unit: "°"
        },
        lcSlider: {
            unit: "nm"
        },
        zcSlider: {
            unit: "nm"
        },
        swSlider: {
            unit: "µm"
        },
        fcoSlider: {
            unit: "mm"
        },
        fcaSlider: {
            unit: "mm"
        },
        pxSlider: {
            unit: "µm"
        }
    });
    const nInput = $("nInput"),
        nSlider = $("nSlider");
    let applyingPreset = false;
    let url = null;
    const ctl = UI.bindControls({
        sp: "#specSelect",
        l0: "#l0Slider",
        dl: "#dlSlider",
        N: "#nInput",
        lpm: "#lpmSlider",
        af: "#afSlider",
        ti: "#tiSlider",
        m: "#mSlider",
        lc: "#lcSlider",
        zc: "#zcSlider",
        sw: "#swSlider",
        fco: "#fcoSlider",
        fca: "#fcaSlider",
        px: "#pxSlider",
        v: "#viewSelect",
        log: "#logBox"
    }, () => {
        syncVisibility();
        if (!applyingPreset) markPreset(null);
        if (url) url.update();
        schedule();
    });

    const clampN = (v) => Math.min(20000, Math.max(1, Math.round(Number(v) || 1)));
    nSlider.addEventListener("input", () => {
        nInput.value = String(clampN(Math.pow(10, Number(nSlider.value))));
        nInput.dispatchEvent(new Event("input", {
            bubbles: true
        }));
    });
    const syncNSlider = () => {
        const n = Number(nInput.value);
        if (Number.isFinite(n) && n >= 1) nSlider.value = String(Math.log10(Math.min(20000, n)));
    };
    nInput.addEventListener("input", syncNSlider);
    nInput.addEventListener("change", () => {
        const raw = nInput.value.trim(),
            n = Number(raw);
        if (raw === "" || !Number.isFinite(n)) {
            nInput.setAttribute("aria-invalid", "true");
            setTimeout(() => {
                nInput.removeAttribute("aria-invalid");
                nInput.value = String(lastN);
                syncNSlider();
            }, 900);
            return;
        }
        const c = clampN(n);
        if (String(c) !== raw) {
            nInput.value = String(c);
            nInput.dispatchEvent(new Event("input", {
                bubbles: true
            }));
        }
        syncNSlider();
    });
    let lastN = DEFAULTS.N;

    function syncVisibility() {
        const sp = $("specSelect").value;
        $("l0Group").hidden = !(sp === "two" || sp === "mono");
        $("dlGroup").hidden = sp !== "two";
    }

    function readState() {
        const s = ctl.get();
        const raw = nInput.value.trim();
        s.N = raw === "" || !Number.isFinite(Number(raw)) ? lastN : clampN(raw);
        lastN = s.N;
        return s;
    }


    function compute(st) {
        const d = MM / st.lpm;
        const g = {
            N: st.N,
            d,
            a: st.af * d
        };
        const thetaI = st.ti * DEG;
        const spec = G.makeSpectrum(st.sp, {
            lambda0: st.l0 * NM,
            dLambda: st.dl * NM
        });
        const lamC = st.lc * NM;
        const cfg = {
            spec,
            g,
            thetaI,
            m: st.m,
            lamC,
            fCol: st.fco * MM,
            fCam: st.fca * MM,
            slitW: st.sw * UM,
            pixel: st.px * UM,
            nPix: NPIX
        };
        const sim = G.simulateDetector(cfg);
        const prof = sim.ok ? G.instrumentProfile(cfg) : null;
        const orders = G.allowedOrders(lamC, d, thetaI);
        const missing = G.missingOrders(orders, g);


        const zc = st.zc * NM;
        const F = prof ? Math.max(prof.fwhmLambda.inst, prof.fwhmLambda.ideal) : 1 * NM;
        const sorted = spec.lines.slice().sort((p, q) => p.lambda - q.lambda);
        let pair = null;
        for (let i = 0; i + 1 < sorted.length; i++) {
            const a = sorted[i],
                b = sorted[i + 1],
                mid = 0.5 * (a.lambda + b.lambda);
            if (b.lambda - a.lambda > 5 * NM) continue;
            if (Math.abs(mid - zc) > Math.max(3 * NM, 10 * F)) continue;
            if (!pair || Math.abs(mid - zc) < Math.abs(pair.mid - zc)) pair = {
                a,
                b,
                mid,
                sep: b.lambda - a.lambda
            };
        }
        let dipIdeal = null,
            dipInst = null,
            nNeed = NaN;
        if (pair) {
            nNeed = pair.mid / (st.m * pair.sep);
            if (Math.abs(G.orderSin(st.m, pair.b.lambda, d, thetaI)) < 1) {
                dipIdeal = G.twoLineDip(pair.a.lambda, pair.b.lambda, [pair.a.weight, pair.b.weight], g, st.m);
            }
            if (sim.ok) {
                const x1 = sim.geo.xAtLambda(pair.a.lambda),
                    x2 = sim.geo.xAtLambda(pair.b.lambda);
                const W = sim.geo.width / 2;
                if (Math.abs(x1) < W && Math.abs(x2) < W) dipInst = G.dipRatio(sim.pixX, sim.pixels, x1, x2);
                else dipInst = {
                    offDetector: true
                };
            }
        }

        const centre = pair ? pair.mid : zc;
        let half = pair ? Math.max(6 * F, 0.5 * pair.sep + 4 * F) : 6 * F;
        if (prof) half = Math.max(half, 4 * prof.pixelLambda);
        half = Math.max(half, 0.02 * NM);
        const zoom = sim.ok ? zoomData(sim, cfg, centre - half, centre + half) : null;


        const sM = Number.isFinite(G.orderAngle(st.m, lamC, d, thetaI)) ? st.m * lamC / d : 0;
        const w = lamC / (g.N * d);
        const sCheck = [];
        for (let i = 0; i < 120; i++) sCheck.push(sM + (i / 119 - 0.5) * 8 * w + (i % 7) * 1e-3 * w);
        const check = G.crossCheck(sCheck, lamC, g, 256);

        return {
            st,
            g,
            d,
            thetaI,
            spec,
            lamC,
            cfg,
            sim,
            prof,
            orders,
            missing,
            pair,
            dipIdeal,
            dipInst,
            nNeed,
            zoom,
            check
        };
    }


    function zoomData(sim, cfg, l0, l1) {
        const geo = sim.geo,
            wImg = geo.slitImage,
            p = cfg.pixel;
        const xa = geo.xAtLambda(l0),
            xb = geo.xAtLambda(l1);
        if (!Number.isFinite(xa) || !Number.isFinite(xb)) return null;
        const pad = wImg / 2 + p;
        const h = Math.max((xb - xa + 2 * pad) / 20000, Math.min((xb - xa) / 1200, geo.diffX / 8));
        const n = Math.ceil((xb - xa + 2 * pad) / h);
        const xs = new Float64Array(n),
            f = new Float64Array(n);
        for (let i = 0; i < n; i++) {
            xs[i] = xa - pad + (i + 0.5) * h;
            f[i] = G.spectrumIntensityS(geo.xToS(xs[i]), cfg.spec, cfg.g);
        }
        const sl = G.boxFilter(f, h, wImg);
        const lam = [],
            ideal = [],
            slit = [];
        for (let i = 0; i < n; i++) {
            if (xs[i] < xa || xs[i] > xb) continue;
            lam.push(geo.lambdaAt(xs[i]) / NM);
            ideal.push(f[i]);
            slit.push(sl[i]);
        }
        const pxL = [],
            pxV = [];
        for (let i = 0; i < sim.pixX.length; i++) {
            const e0 = sim.pixX[i] - p / 2,
                e1 = sim.pixX[i] + p / 2;
            if (e1 < xa || e0 > xb) continue;
            pxL.push(geo.lambdaAt(e0) / NM, geo.lambdaAt(e1) / NM);
            pxV.push(sim.pixels[i], sim.pixels[i]);
        }
        return {
            l0: l0 / NM,
            l1: l1 / NM,
            lam,
            ideal,
            slit,
            pxL,
            pxV
        };
    }


    function decimate(xs, ys, ncol) {
        const n = xs.length;
        if (n <= 3 * ncol) return {
            xs,
            ys
        };
        const x0 = xs[0],
            x1 = xs[n - 1],
            span = (x1 - x0) || 1;
        const ox = [],
            oy = [];
        let c = -1,
            imn = 0,
            imx = 0;
        const flush = () => {
            if (c < 0) return;
            if (imn < imx) {
                ox.push(xs[imn], xs[imx]);
                oy.push(ys[imn], ys[imx]);
            } else if (imx < imn) {
                ox.push(xs[imx], xs[imn]);
                oy.push(ys[imx], ys[imn]);
            } else {
                ox.push(xs[imn]);
                oy.push(ys[imn]);
            }
        };
        for (let i = 0; i < n; i++) {
            const col = Math.min(ncol - 1, Math.floor((xs[i] - x0) / span * ncol));
            if (col !== c) {
                flush();
                c = col;
                imn = imx = i;
            } else {
                if (ys[i] < ys[imn]) imn = i;
                if (ys[i] > ys[imx]) imx = i;
            }
        }
        flush();
        return {
            xs: ox,
            ys: oy
        };
    }
    const maxOf = (a) => {
        let m = 0;
        for (let i = 0; i < a.length; i++)
            if (a[i] > m) m = a[i];
        return m;
    };
    const scaled = (a, s) => Array.from(a, (v) => v * s);
    const rgbOf = (nm) => UI.wavelengthToRGB(nm);


    function drawStrip(ctx, x, y, w, h, n, comps, logScale) {
        const tot = new Float64Array(n);
        for (const c of comps)
            for (let i = 0; i < n; i++) tot[i] += c.values[i];
        const mx = maxOf(tot) || 1;
        ctx.fillStyle = "#000";
        ctx.fillRect(x, y, w, h);
        const cw = w / n;
        for (let i = 0; i < n; i++) {
            if (!(tot[i] > 0)) continue;
            let r = 0,
                gg = 0,
                b = 0;
            for (const c of comps) {
                const v = c.values[i];
                if (!(v > 0)) continue;
                const rgb = c.colorAt(i);
                r += v * rgb[0];
                gg += v * rgb[1];
                b += v * rgb[2];
            }
            let t = tot[i] / mx;
            t = logScale ? Math.max(0, 1 + Math.log10(t) / 5) : Math.sqrt(t);
            if (t <= 0.004) continue;
            const k = t / tot[i];
            ctx.fillStyle = "rgb(" + Math.min(255, r * k) + "," + Math.min(255, gg * k) + "," + Math.min(255, b * k) + ")";
            ctx.fillRect(x + i * cw, y, Math.max(1, cw + 0.5), h);
        }
        ctx.strokeStyle = pal.axis;
        ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    }

    function noData(ctx, w, h, msg) {
        ctx.fillStyle = pal.background;
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = pal.warning;
        ctx.font = "13px " + pal.font;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const words = msg.split(" "),
            lines = [];
        let cur = "";
        for (const wd of words) {
            const t = cur ? cur + " " + wd : wd;
            if (ctx.measureText(t).width > w - 30 && cur) {
                lines.push(cur);
                cur = wd;
            } else cur = t;
        }
        lines.push(cur);
        lines.forEach((l, i) => ctx.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * 18));
    }


    let M = null;
    let angCursor = NaN,
        detCursor = NaN,
        zoomCursor = NaN;
    let angMap = null,
        detMap = null,
        zoomMap = null;
    let angLast = null;


    function angRange() {
        const st = M.st;
        if (st.v === "zoom") {
            const [lo, hi] = G.spectrumBand(M.spec);
            const tA = G.orderAngle(st.m, lo, M.d, M.thetaI),
                tB = G.orderAngle(st.m, hi, M.d, M.thetaI);
            const clampT = (t, lam) => Number.isFinite(t) ? t : (G.orderSin(st.m, lam, M.d, M.thetaI) > 0 ? 89.9 * DEG : -89.9 * DEG);
            let a = clampT(tA, lo) / DEG,
                b = clampT(tB, hi) / DEG;
            if (a > b)[a, b] = [b, a];
            const cosT = Math.max(0.05, Math.cos(0.5 * (a + b) * DEG));
            const pk = (hi / (M.g.N * M.d * cosT)) / DEG;
            const pad = Math.max(0.15 * (b - a), 4 * pk, 0.2);
            return [Math.max(-90, a - pad), Math.min(90, b + pad)];
        }
        return [-90, 90];
    }

    function drawAng(ctx, w, h) {
        if (!M) return;
        const [t0, t1] = angRange();
        const top = 22;
        const fs = 12,
            ml = fs * 4.4,
            mr = fs * 1.1;
        const ncol = Math.max(200, Math.round(w - ml - mr));
        const sinI = Math.sin(M.thetaI);
        const edges = new Float64Array(ncol + 1);
        for (let i = 0; i <= ncol; i++) edges[i] = Math.sin((t0 + (t1 - t0) * i / ncol) * DEG) - sinI;
        const cm = G.columnMax(edges, M.spec, M.g);
        const xs = new Array(ncol),
            ys = new Array(ncol);
        for (let i = 0; i < ncol; i++) {
            xs[i] = t0 + (t1 - t0) * (i + 0.5) / ncol;
            ys[i] = cm.total[i];
        }
        const mx = maxOf(cm.total) || 1;
        const log = M.st.log;
        const floor = mx * 1e-5;
        const yv = log ? ys.map((v) => Math.max(v, floor)) : ys;
        const markers = [];
        const many = M.orders.length > 13;
        for (const m of M.orders) {
            if (many && Math.abs(m) > 6) continue;
            const th = G.orderAngle(m, M.lamC, M.d, M.thetaI) / DEG;
            const miss = M.missing.includes(m);
            markers.push({
                x: th,
                label: "m=" + m + (miss ? " ✕" : ""),
                color: miss ? pal.warning : pal.marker,
                dash: [3, 4]
            });
        }
        const cursor = Number.isFinite(angCursor) ? {
            x: angCursor,
            label: "θ = " + angCursor.toFixed(2) + "°"
        } : null;
        angMap = UI.plot(ctx, {
            x: 0,
            y: top,
            w,
            h: h - top
        }, {
            x: {
                min: t0,
                max: t1,
                label: "diffraction angle θ",
                unit: "°"
            },
            y: log ? {
                min: floor,
                max: mx * 1.6,
                log: true,
                label: "I/I₀ (log, floor 1e-5)"
            } : {
                min: 0,
                max: mx * 1.05,
                label: "I/I₀"
            },
            series: [{
                xs,
                ys: yv,
                color: pal.series[0],
                width: 1.5,
                label: "total (per-column max)"
            }],
            markers,
            cursor,
            legend: false
        });
        angLast = {
            xs,
            ys,
            cm,
            edges,
            ncol
        };

        const P = angMap.plot;
        const comps = cm.comps.map((c) => ({
            values: c.values,
            colorAt: c.kind === "line" ? (() => {
                const rgb = rgbOf(c.lambda / NM);
                return () => rgb;
            })() : (c.order === 0 ? () => [255, 255, 255] : (i) => rgbOf(M.d * 0.5 * (edges[i] + edges[i + 1]) / c.order / NM))
        }));
        drawStrip(ctx, P.x, 4, P.w, 14, ncol, comps, log);
    }

    function angReadout() {
        if (!M || !Number.isFinite(angCursor) || !angLast) return;
        const th = angCursor * DEG,
            s = Math.sin(th) - Math.sin(M.thetaI);
        const I = G.spectrumIntensityS(s, M.spec, M.g);
        const parts = [];
        for (let m = 1; m <= 8; m++) {
            for (const sg of [1, -1]) {
                const lam = M.d * s / (sg * m);
                if (lam >= 200 * NM && lam <= 1100 * NM) parts.push("m=" + sg * m + ": " + (lam / NM).toFixed(1) + " nm");
            }
        }
        $("angCursor").textContent = "θ = " + angCursor.toFixed(3) + "°, sin θ − sin θᵢ = " + s.toFixed(5) + ", I/I₀ = " + I.toExponential(3) +
            (parts.length ? ". Wavelengths sent here: " + parts.slice(0, 6).join(", ") : ". No order sends 200–1100 nm light here.");
    }


    function drawDet(ctx, w, h) {
        if (!M) return;
        const sim = M.sim;
        if (!sim.ok) {
            detMap = null;
            noData(ctx, w, h, "Order " + M.st.m + " of λc = " + M.st.lc + " nm does not propagate (|sin θ| ≥ 1): no detector image.");
            return;
        }
        const geo = sim.geo,
            st = M.st;
        const top = 52;
        const W2 = geo.width / 2 / MM;
        const ncol = Math.max(200, Math.round(w));
        const idealMax = maxOf(sim.ideal) || 1,
            slitMax = maxOf(sim.slit) || 1,
            pixMax = maxOf(sim.pixels) || 1;
        const xmm = Array.from(sim.x, (v) => v / MM);
        const dI = decimate(xmm, scaled(sim.ideal, 1 / idealMax), ncol);
        const dS = decimate(xmm, scaled(sim.slit, 1 / slitMax), ncol);
        const px = [],
            pv = [];
        for (let i = 0; i < NPIX; i++) {
            const c = sim.pixX[i] / MM,
                hw = st.px * UM / 2 / MM;
            px.push(c - hw, c + hw);
            pv.push(sim.pixels[i] / pixMax, sim.pixels[i] / pixMax);
        }
        const dP = decimate(px, pv, ncol);

        const markers = [];
        for (const l of M.spec.lines) {
            for (const m of G.allowedOrders(l.lambda, M.d, M.thetaI)) {
                if (m === 0) continue;
                const x = geo.xAtLambda(l.lambda, m);
                if (!(Math.abs(x) < geo.width / 2)) continue;
                const other = m !== st.m;
                markers.push({
                    x: x / MM,
                    label: (l.lambda / NM).toFixed(1) + (other ? " (m=" + m + ")" : ""),
                    color: other ? pal.warning : pal.marker,
                    dash: other ? [2, 3] : [5, 4]
                });
            }
        }
        if (markers.length > 12) markers.length = 12;
        const cursor = Number.isFinite(detCursor) ? {
            x: detCursor,
            label: (geo.lambdaAt(detCursor * MM) / NM).toFixed(2) + " nm"
        } : null;
        detMap = UI.plot(ctx, {
            x: 0,
            y: top,
            w,
            h: h - top
        }, {
            x: {
                min: -W2,
                max: W2,
                label: "detector position x",
                unit: "mm"
            },
            y: {
                min: 0,
                max: 1.08,
                label: "signal (peak-normalised)"
            },
            series: [{
                    xs: dI.xs,
                    ys: dI.ys,
                    color: pal.series[6],
                    dash: [5, 3],
                    width: 1.25,
                    label: "grating only"
                },
                {
                    xs: dS.xs,
                    ys: dS.ys,
                    color: pal.series[0],
                    width: 1.5,
                    label: "⊗ slit image"
                },
                {
                    xs: dP.xs,
                    ys: dP.ys,
                    color: pal.series[1],
                    width: 1.25,
                    label: "pixel signal"
                }
            ],
            markers,
            cursor
        });
        const P = detMap.plot;

        const lA = geo.lambdaAt(-geo.width / 2) / NM,
            lB = geo.lambdaAt(geo.width / 2) / NM;
        const ticks = UI.niceTicks(Math.min(lA, lB), Math.max(lA, lB), Math.max(3, Math.round(P.w / 80)));
        ctx.save();
        ctx.font = "12px " + pal.font;
        ctx.fillStyle = pal.textMuted;
        ctx.strokeStyle = pal.axis;
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.beginPath();
        ctx.moveTo(P.x, 34.5);
        ctx.lineTo(P.x + P.w, 34.5);
        ctx.stroke();
        for (const t of ticks) {
            const xp = detMap.xToPx(geo.xAtLambda(t * NM) / MM);
            if (!(xp >= P.x && xp <= P.x + P.w)) continue;
            ctx.beginPath();
            ctx.moveTo(xp + 0.5, 30);
            ctx.lineTo(xp + 0.5, 35);
            ctx.stroke();
            ctx.fillText(UI.formatTick(t, ticks.step), xp, 29);
        }
        ctx.textAlign = "right";
        ctx.fillStyle = pal.text;
        ctx.fillText("λ (nm)", P.x - 6, 29);
        ctx.restore();
        const comps = sim.comps.map((c) => ({
            values: c.pixels,
            colorAt: c.kind === "line" ? (() => {
                const rgb = rgbOf(c.lambda / NM);
                return () => rgb;
            })() : (c.order === 0 ? () => [255, 255, 255] : (i) => rgbOf(geo.lambdaAt(sim.pixX[i], c.order) / NM))
        }));
        drawStrip(ctx, P.x, 36, P.w, 12, NPIX, comps, false);
    }

    function detReadout() {
        if (!M || !M.sim.ok || !Number.isFinite(detCursor)) return;
        const geo = M.sim.geo,
            x = detCursor * MM;
        const pix = Math.floor((x + geo.width / 2) / (M.st.px * UM));
        const lam = geo.lambdaAt(x);
        const others = [];
        for (let m = 1; m <= 8; m++) {
            if (m === M.st.m) continue;
            const l = geo.lambdaAt(x, m);
            if (l >= 200 * NM && l <= 1100 * NM) others.push("m=" + m + ": " + (l / NM).toFixed(1) + " nm");
        }
        const sig = pix >= 0 && pix < NPIX ? M.sim.pixels[pix] : NaN;
        $("detCursor").textContent = "x = " + detCursor.toFixed(3) + " mm, pixel " + pix + ", λ(m=" + M.st.m + ") = " + (lam / NM).toFixed(3) +
            " nm, pixel signal " + (Number.isFinite(sig) ? sig.toExponential(3) : "—") + (others.length ? ". Same position in other orders: " + others.join(", ") : "");
    }


    function drawZoom(ctx, w, h) {
        if (!M) return;
        const z = M.zoom;
        if (!M.sim.ok || !z) {
            zoomMap = null;
            noData(ctx, w, h, "No detector image for this order.");
            return;
        }
        const ncol = Math.max(200, Math.round(w));
        const iM = maxOf(z.ideal) || 1,
            sM = maxOf(z.slit) || 1,
            pM = maxOf(z.pxV) || 1;
        const dI = decimate(z.lam, z.ideal.map((v) => v / iM), ncol);
        const dS = decimate(z.lam, z.slit.map((v) => v / sM), ncol);
        const markers = [];
        for (const l of M.spec.lines) {
            const nm = l.lambda / NM;
            if (nm >= z.l0 && nm <= z.l1) markers.push({
                x: nm,
                label: nm.toFixed(2),
                color: pal.marker
            });
        }
        const cursor = Number.isFinite(zoomCursor) ? {
            x: zoomCursor,
            label: zoomCursor.toFixed(3) + " nm"
        } : null;
        zoomMap = UI.plot(ctx, {
            x: 0,
            y: 0,
            w,
            h
        }, {
            x: {
                min: z.l0,
                max: z.l1,
                label: "λ in order " + M.st.m,
                unit: "nm"
            },
            y: {
                min: 0,
                max: 1.12,
                label: "peak-normalised"
            },
            series: [{
                    xs: dI.xs,
                    ys: dI.ys,
                    color: pal.series[6],
                    dash: [5, 3],
                    width: 1.25,
                    label: "grating only"
                },
                {
                    xs: dS.xs,
                    ys: dS.ys,
                    color: pal.series[0],
                    width: 1.5,
                    label: "⊗ slit"
                },
                {
                    xs: z.pxL,
                    ys: z.pxV.map((v) => v / pM),
                    color: pal.series[1],
                    width: 1.5,
                    label: "pixels"
                }
            ],
            markers,
            cursor,
            legend: w >= 440,
            legendPosition: "left"
        });
    }


    function drawSchem(ctx, w, h) {
        ctx.fillStyle = pal.background;
        ctx.fillRect(0, 0, w, h);
        if (!M) return;
        const st = M.st,
            ti = M.thetaI;
        const thC = M.sim.ok ? M.sim.geo.thetaC : NaN;
        const fs = w < 420 ? 11 : 12;
        ctx.font = fs + "px " + pal.font;
        const gx = w * 0.47,
            gy = h * 0.54;
        const L = Math.min(w, h * 1.6);
        const beamCol = UI.wavelengthToCSS(Math.min(760, Math.max(390, st.lc)));
        const uIn = [Math.cos(ti), -Math.sin(ti)],
            nIn = [Math.sin(ti), Math.cos(ti)];

        ctx.strokeStyle = pal.gridStrong;
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(gx - 0.42 * L, gy);
        ctx.lineTo(gx + 0.45 * L, gy);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = pal.textMuted;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText("normal", gx + 0.08 * L, gy + 3);

        const Lin = 0.4 * L,
            hb = Math.min(0.1 * h, 0.065 * L);
        const slit = [gx - Lin * uIn[0], gy - Lin * uIn[1]];
        const lens = [slit[0] + 0.42 * Lin * uIn[0], slit[1] + 0.42 * Lin * uIn[1]];
        ctx.strokeStyle = beamCol;
        ctx.globalAlpha = 0.85;
        ctx.lineWidth = 1.2;
        const hits = [];
        for (const sgn of [-1, 1]) {
            const e = [lens[0] + sgn * hb * nIn[0], lens[1] + sgn * hb * nIn[1]];
            const t = (gx - e[0]) / uIn[0];
            const hit = [gx, e[1] + t * uIn[1]];
            hits.push(hit);
            ctx.beginPath();
            ctx.moveTo(slit[0], slit[1]);
            ctx.lineTo(e[0], e[1]);
            ctx.lineTo(hit[0], hit[1]);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;

        ctx.strokeStyle = pal.text;
        ctx.lineWidth = 2;
        const sn = nIn;
        ctx.beginPath();
        ctx.moveTo(slit[0] + sn[0] * 12, slit[1] + sn[1] * 12);
        ctx.lineTo(slit[0] + sn[0] * 3, slit[1] + sn[1] * 3);
        ctx.moveTo(slit[0] - sn[0] * 3, slit[1] - sn[1] * 3);
        ctx.lineTo(slit[0] - sn[0] * 12, slit[1] - sn[1] * 12);
        ctx.stroke();

        const drawLens = (c, n, half) => {
            ctx.strokeStyle = "#8ab4ff";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(c[0] - n[0] * half, c[1] - n[1] * half);
            ctx.lineTo(c[0] + n[0] * half, c[1] + n[1] * half);
            ctx.stroke();
            for (const s of [-1, 1]) {
                const tip = [c[0] + s * n[0] * half, c[1] + s * n[1] * half];
                ctx.beginPath();
                ctx.moveTo(tip[0] - s * n[0] * 6 + n[1] * 5, tip[1] - s * n[1] * 6 - n[0] * 5);
                ctx.lineTo(tip[0], tip[1]);
                ctx.lineTo(tip[0] - s * n[0] * 6 - n[1] * 5, tip[1] - s * n[1] * 6 + n[0] * 5);
                ctx.stroke();
            }
        };
        drawLens(lens, nIn, hb + 6);

        const gh = Math.max(hb * 1.6, 0.2 * h);
        ctx.strokeStyle = pal.text;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(gx, gy - gh);
        ctx.lineTo(gx, gy + gh);
        ctx.stroke();
        ctx.lineWidth = 1;
        for (let y = gy - gh; y <= gy + gh; y += 5) {
            ctx.beginPath();
            ctx.moveTo(gx, y);
            ctx.lineTo(gx + 4, y);
            ctx.stroke();
        }

        const ray = (th, len, col, dash, lw = 1) => {
            ctx.strokeStyle = col;
            ctx.setLineDash(dash);
            ctx.lineWidth = lw;
            ctx.beginPath();
            ctx.moveTo(gx, gy);
            ctx.lineTo(gx + len * Math.cos(th), gy - len * Math.sin(th));
            ctx.stroke();
            ctx.setLineDash([]);
        };
        ray(ti, 0.36 * L, pal.textMuted, [5, 4]);
        ctx.fillStyle = pal.textMuted;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        const lbl = (th, len, text, col) => {
            ctx.fillStyle = col;
            const x = gx + len * Math.cos(th),
                y = gy - len * Math.sin(th);
            ctx.textAlign = x > gx + 2 ? "left" : "right";
            ctx.fillText(text, x + (x > gx ? 3 : -3), y);
        };
        lbl(ti, 0.37 * L, "m = 0", pal.textMuted);
        for (const m of M.orders) {
            if (m === 0 || m === st.m || Math.abs(m) > 3) continue;
            const th = G.orderAngle(m, M.lamC, M.d, ti);
            ray(th, 0.2 * L, "rgba(184,178,207,0.45)", [2, 3]);
            lbl(th, 0.21 * L, "m=" + m, pal.textMuted);
        }

        if (Number.isFinite(thC)) {
            const uO = [Math.cos(thC), -Math.sin(thC)],
                nO = [Math.sin(thC), Math.cos(thC)];
            const Lc = 0.3 * L,
                Lf = 0.12 * L;
            const cam = [gx + Lc * uO[0], gy + Lc * uO[1]];
            const focus = [cam[0] + Lf * uO[0], cam[1] + Lf * uO[1]];
            ctx.strokeStyle = beamCol;
            ctx.lineWidth = 1.2;
            ctx.globalAlpha = 0.85;
            let hbo = 0;
            for (const hit of hits) {
                const t = (cam[0] - hit[0]) * uO[0] + (cam[1] - hit[1]) * uO[1];
                const e = [hit[0] + t * uO[0], hit[1] + t * uO[1]];
                hbo = Math.max(hbo, Math.abs((e[0] - cam[0]) * nO[0] + (e[1] - cam[1]) * nO[1]));
                ctx.beginPath();
                ctx.moveTo(hit[0], hit[1]);
                ctx.lineTo(e[0], e[1]);
                ctx.lineTo(focus[0], focus[1]);
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
            drawLens(cam, nO, hbo + 6);
            ctx.strokeStyle = pal.series[1];
            ctx.lineWidth = 3;
            const dl = 0.16 * h;
            ctx.beginPath();
            ctx.moveTo(focus[0] - nO[0] * dl, focus[1] - nO[1] * dl);
            ctx.lineTo(focus[0] + nO[0] * dl, focus[1] + nO[1] * dl);
            ctx.stroke();
            ctx.fillStyle = pal.series[1];
            ctx.textAlign = "center";
            ctx.textBaseline = "bottom";
            const dlab = [focus[0] + 0.06 * L * uO[0], focus[1] + 0.06 * L * uO[1] - dl * 0.3];
            ctx.fillText("detector", Math.min(w - 32, Math.max(32, dlab[0])), Math.max(fs + 2, Math.min(h - 4, dlab[1] - 4)));

            ctx.strokeStyle = pal.series[0];
            ctx.lineWidth = 1;
            const r1 = 0.1 * L;
            ctx.beginPath();
            ctx.arc(gx, gy, r1, Math.min(0, -thC), Math.max(0, -thC));
            ctx.stroke();
        }

        if (Math.abs(ti) > 0.2 * DEG) {
            ctx.strokeStyle = pal.series[2];
            ctx.lineWidth = 1;
            const r0 = 0.06 * L;
            ctx.beginPath();
            ctx.arc(gx, gy, r0, Math.PI + Math.min(0, -ti), Math.PI + Math.max(0, -ti));
            ctx.stroke();
        }

        ctx.fillStyle = pal.text;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText("slit " + st.sw + " µm", Math.max(2, slit[0] - 20), Math.min(h - fs - 2, slit[1] + 16));
        ctx.textAlign = "center";
        ctx.fillText(st.lpm + " /mm, N = " + st.N, gx, Math.max(2, gy - gh - fs - 4));
        ctx.textAlign = "left";
        ctx.fillStyle = pal.textMuted;
        ctx.fillText("f_col " + st.fco + " mm · f_cam " + st.fca + " mm", 6, 6);
        ctx.fillText("λc = " + st.lc + " nm, order m = " + st.m, 6, 6 + fs + 4);
        ctx.fillStyle = pal.series[2];
        ctx.fillText("θᵢ = " + st.ti.toFixed(1) + "°", 6, h - 2 * fs - 10);
        ctx.fillStyle = pal.series[0];
        ctx.fillText("θm = " + (Number.isFinite(thC) ? (thC / DEG).toFixed(2) + "°" : "none"), 6, h - fs - 6);
    }


    M = compute(readState());
    const angH = UI.setupCanvas($("angCanvas"), {
        aspect: 2.6,
        minHeight: 250,
        maxHeight: 420,
        draw: drawAng
    });
    const detH = UI.setupCanvas($("detCanvas"), {
        aspect: 2.4,
        minHeight: 290,
        maxHeight: 460,
        draw: drawDet
    });
    const zoomH = UI.setupCanvas($("zoomCanvas"), {
        aspect: 1.45,
        minHeight: 250,
        maxHeight: 420,
        draw: drawZoom
    });
    const schemH = UI.setupCanvas($("schemCanvas"), {
        aspect: 1.45,
        minHeight: 250,
        maxHeight: 420,
        draw: drawSchem
    });
    const angDesc = UI.describeCanvas(angH.canvas, "Angular intensity of the grating", {
        label: "Far-field angular intensity versus diffraction angle"
    });
    const detDesc = UI.describeCanvas(detH.canvas, "Detector signal", {
        label: "Detector signal versus position with a wavelength scale"
    });
    const zoomDesc = UI.describeCanvas(zoomH.canvas, "Zoomed spectrum", {
        label: "Zoomed spectrum: ideal grating versus instrument"
    });
    const schemDesc = UI.describeCanvas(schemH.canvas, "Spectrometer layout", {
        label: "Schematic of the spectrometer"
    });

    function hover(handle, getMap, set, readout, get) {
        const c = handle.canvas;

        c.tabIndex = 0;
        c.addEventListener("keydown", (e) => {
            const map = getMap();
            if (!map || !["ArrowLeft", "ArrowRight", "Escape"].includes(e.key)) return;
            e.preventDefault();
            if (e.key === "Escape") set(NaN);
            else {
                const lo = map.x.min,
                    hi = map.x.max,
                    cur = get();
                const step = ((hi - lo) / 400) * (e.shiftKey ? 10 : 1) * (e.key === "ArrowLeft" ? -1 : 1);
                set(Math.min(hi, Math.max(lo, Number.isFinite(cur) ? cur + step : 0.5 * (lo + hi))));
            }
            handle.redraw();
            if (readout) readout();
        });
        c.addEventListener("pointermove", (e) => {
            const map = getMap();
            if (!map) return;
            const r = c.getBoundingClientRect(),
                px = e.clientX - r.left,
                py = e.clientY - r.top;
            if (map.contains(px, py)) {
                set(map.pxToX(px));
                handle.redraw();
                if (readout) readout();
            }
        });
        c.addEventListener("pointerleave", () => {
            set(NaN);
            handle.redraw();
        });
    }
    hover(angH, () => angMap, (v) => {
        angCursor = v;
    }, angReadout, () => angCursor);
    hover(detH, () => detMap, (v) => {
        detCursor = v;
    }, detReadout, () => detCursor);
    hover(zoomH, () => zoomMap, (v) => {
        zoomCursor = v;
    }, null, () => zoomCursor);
    detH.canvas.addEventListener("keydown", (e) => {

        if (e.key !== "Enter" || !M.sim.ok || !Number.isFinite(detCursor)) return;
        e.preventDefault();
        const lam = M.sim.geo.lambdaAt(detCursor * MM) / NM;
        ctl.set({
            zc: Math.min(800, Math.max(350, Number(lam.toFixed(2))))
        });
    });
    detH.canvas.addEventListener("click", (e) => {
        if (!detMap || !M.sim.ok) return;
        const r = detH.canvas.getBoundingClientRect(),
            px = e.clientX - r.left,
            py = e.clientY - r.top;
        if (!detMap.contains(px, py)) return;
        const lam = M.sim.geo.lambdaAt(detMap.pxToX(px) * MM) / NM;
        ctl.set({
            zc: Math.min(800, Math.max(350, Number(lam.toFixed(2))))
        });
    });


    const setText = (id, t) => {
        const el = $(id);
        if (el && el.textContent !== t) el.textContent = t;
    };
    const nmStr = (v, dig = 3) => fmt(v, dig, "m");
    const dipText = (dp) => {
        if (!dp) return "— (no close pair)";
        if (dp.offDetector) return "pair off the detector";
        if (dp.ratio >= 1) return "no dip → unresolved";
        if (Math.abs(dp.ratio - G.RAYLEIGH_DIP) < 0.01) return (100 * dp.ratio).toFixed(1) + " % → at the Rayleigh limit";
        return (100 * dp.ratio).toFixed(1) + " % → " + (dp.resolved ? "resolved" : "not resolved");
    };

    function updateDom() {
        const {
            st,
            g,
            d,
            sim,
            prof,
            orders,
            missing,
            pair,
            dipIdeal,
            dipInst,
            nNeed,
            lamC
        } = M;
        setText("stat-lpm", String(st.lpm));
        setText("stat-N", String(st.N));
        setText("stat-m", String(st.m));
        setText("stat-R", String(G.resolvingPower(st.m, st.N)));
        setText("stat-Rinst", prof ? Math.round(prof.instR).toString() : "—");
        setText("stat-dl", prof ? nmStr(prof.fwhmLambda.inst) : "—");
        setText("lpmValue", "d = " + fmt(d, 4, "m"));
        setText("afValue", "a = " + fmt(g.a, 3, "m"));
        setText("swValue", sim.ok ? "w′ = " + fmt(sim.geo.slitImage, 3, "m") : "");
        setText("pxValue", "width " + (NPIX * st.px / 1000).toFixed(2) + " mm");
        setText("mValue", sim.ok ? "θm = " + (sim.geo.thetaC / DEG).toFixed(2) + "°" : "not propagating");
        setText("gratingNote", "d = " + fmt(d, 4, "m") + ", a = " + fmt(g.a, 3, "m") + ", illuminated width Nd = " + fmt(st.N * d, 3, "m") + ".");
        $("detBadge").textContent = "order " + st.m;

        const thC = G.orderAngle(st.m, lamC, d, M.thetaI);
        setText("rDA", fmt(d, 4, "m") + " / " + fmt(g.a, 3, "m"));
        setText("rTheta", Number.isFinite(thC) ? (thC / DEG).toFixed(3) + "°" : "|sin θ| ≥ 1");
        setText("rOrders", orders.length ? orders[0] + " … " + orders[orders.length - 1] + " (" + orders.length + ")" : "none");
        const mis = missing.filter((m) => m > 0);
        setText("rMissing", mis.length ? "±" + mis.slice(0, 6).join(", ±") + (mis.length > 6 ? " …" : "") : "none");
        if (Number.isFinite(thC)) {
            const ad = G.angularDispersion(st.m, lamC, d, M.thetaI);
            setText("rAngDisp", (ad * NM * 1e3).toFixed(4) + " mrad/nm");
        } else setText("rAngDisp", "—");
        setText("rRideal", String(G.resolvingPower(st.m, st.N)));
        setText("rRay", nmStr(lamC / G.resolvingPower(st.m, st.N)));
        setText("rFSR", nmStr(G.freeSpectralRange(lamC, st.m), 4));
        if (prof) {
            setText("rLinDisp", fixed(1 / (sim.geo.dispersion * NM / MM), 3) + " nm/mm");
            setText("rFwIdeal", nmStr(prof.fwhmLambda.ideal));
            setText("rSlit", fmt(sim.geo.slitImage, 3, "m") + " (" + nmStr(prof.slitLambda) + ")");
            setText("rPix", fmt(st.px * UM, 3, "m") + " (" + nmStr(prof.pixelLambda) + ")");
            setText("rFwInst", nmStr(prof.fwhmLambda.inst));
            setText("rRinst", Math.round(prof.instR) + " (grating alone " + Math.round(lamC / prof.fwhmLambda.ideal) + ")");
            const c = [
                ["grating diffraction", prof.fwhmLambda.ideal],
                ["entrance slit", prof.slitLambda],
                ["pixel sampling (2 px)", 2 * prof.pixelLambda]
            ];
            c.sort((p, q) => q[1] - p[1]);
            setText("rLimit", c[0][0]);
        } else ["rLinDisp", "rFwIdeal", "rSlit", "rPix", "rFwInst", "rRinst", "rLimit"].forEach((id) => setText(id, "—"));
        setText("rNneed", pair ? Math.ceil(nNeed) + " (Δλ = " + nmStr(pair.sep) + ")" : "—");
        setText("rDipIdeal", dipText(dipIdeal));
        setText("rDipInst", dipText(dipInst));
        setText("rCheck", "max |ΔI| = " + M.check.toExponential(1));


        let overlap = "";
        if (sim.ok) {
            const geo = sim.geo,
                lA = geo.lambdaAt(-geo.width / 2),
                lB = geo.lambdaAt(geo.width / 2);
            const [bLo, bHi] = G.spectrumBand(M.spec);
            const parts = [];
            for (let m = 1; m <= 8; m++) {
                if (m === st.m) continue;
                const lo = lA * st.m / m,
                    hi = lB * st.m / m;
                const oLo = Math.max(lo, bLo),
                    oHi = Math.min(hi, bHi);
                const lineHits = M.spec.lines.filter((l) => l.lambda >= lo && l.lambda <= hi);
                if (M.spec.continuum && oHi > oLo) parts.push("order " + m + " delivers " + (oLo / NM).toFixed(0) + "–" + (oHi / NM).toFixed(0) + " nm");
                else if (lineHits.length) parts.push("order " + m + ": " + lineHits.map((l) => (l.lambda / NM).toFixed(1)).join(", ") + " nm");
            }
            overlap = "Detector covers " + (lA / NM).toFixed(1) + "–" + (lB / NM).toFixed(1) + " nm in order " + st.m + " (" +
                (geo.width / MM).toFixed(2) + " mm). Free spectral range at the short end: " + (lA / st.m / NM).toFixed(1) + " nm. " +
                (parts.length ? "Overlapping light from other orders: " + parts.join("; ") + "." : "No source light from other orders reaches the detector.");
        }
        setText("overlapNote", overlap);


        const tb = $("orderTable").querySelector("tbody");
        const rows = [];
        const shown = orders.length > 25 ? orders.filter((m) => Math.abs(m) <= 12) : orders;
        for (const m of shown) {
            const th = G.orderAngle(m, lamC, d, M.thetaI);
            const env = G.orderEnvelope(m, g);
            const miss = missing.includes(m);
            rows.push("<tr><td>" + m + "</td><td>" + (th / DEG).toFixed(3) + "</td><td" + (miss ? ' class="dg-missing"' : "") + ">" + env.toExponential(2) +
                "</td><td>" + (m === 0 ? "0" : (G.angularDispersion(m, lamC, d, M.thetaI) * NM * 1e3).toFixed(4)) + "</td><td>" + (m === 0 ? "—" : G.resolvingPower(m, st.N)) +
                "</td><td>" + (m === 0 ? "—" : (G.freeSpectralRange(lamC, m) / NM).toFixed(1)) + "</td><td" + (miss ? ' class="dg-missing"' : "") + ">" +
                (m === 0 ? "undeviated" : miss ? "missing (envelope zero)" : m === st.m ? "on detector" : "propagating") + "</td></tr>");
        }
        if (shown.length < orders.length) rows.push('<tr><td colspan="7">… ' + (orders.length - shown.length) + " further orders with |m| > 12 not listed</td></tr>");
        const html = rows.join("");
        if (tb.innerHTML !== html) tb.innerHTML = html;


        const warn = [];
        if (!sim.ok) warn.push("Order " + st.m + " of λc = " + st.lc + " nm does not propagate: |sin θ| = " + Math.abs(G.orderSin(st.m, lamC, d, M.thetaI)).toFixed(3) + " ≥ 1. Lower m, reduce the groove density or change θᵢ.");
        if (M.spec.continuum && st.N < 10) warn.push("White light with N < 10: orders overlap their neighbours' side lobes and the order-integrated continuum model is only qualitative.");
        if (sim.ok && sim.underResolved) warn.push("The detector grid cannot resolve the diffraction-limited line width (N·d = " + fmt(st.N * d, 3, "m") + "); the grating-only curve is under-sampled. Readouts use a separate fine profile.");
        if (sim.ok && Math.abs(sim.geo.thetaC) > 70 * DEG) warn.push("Diffraction angle above 70°: without an obliquity factor and polarization the scalar order heights are approximate.");
        if (pair && dipIdeal && dipIdeal.ratio < 1 && M.st.sp === "na") warn.push("Na D2 is twice as strong as D1; the dip is quoted relative to the weaker line, so it is shallower than for two equal lines.");
        const wEl = $("regimeWarn");
        wEl.hidden = !warn.length;
        setText("regimeWarn", warn.join(" "));


        const angParts = orders.filter((m) => Math.abs(m) <= 3).map((m) => "m=" + m + " at " + (G.orderAngle(m, lamC, d, M.thetaI) / DEG).toFixed(2) + "°" + (missing.includes(m) ? " (missing)" : ""));
        angDesc.update("Angular intensity for N = " + st.N + ", " + st.lpm + " lines/mm, a/d = " + st.af + ", θᵢ = " + st.ti + "°. Orders of λc = " + st.lc + " nm: " + angParts.join(", ") + ". " + orders.length + " orders propagate.");
        if (sim.ok) {
            let ib = 0;
            for (let i = 1; i < NPIX; i++)
                if (sim.pixels[i] > sim.pixels[ib]) ib = i;
            detDesc.update(overlap + " Brightest pixel " + ib + " at x = " + (sim.pixX[ib] / MM).toFixed(3) + " mm, λ = " + (sim.lamPix[ib] / NM).toFixed(2) + " nm.");
        } else detDesc.update("No detector image: order " + st.m + " does not propagate.");
        zoomDesc.update(M.zoom ? "Zoom " + M.zoom.l0.toFixed(3) + "–" + M.zoom.l1.toFixed(3) + " nm. Instrument FWHM " + (prof ? nmStr(prof.fwhmLambda.inst) : "—") + ", grating-only FWHM " + (prof ? nmStr(prof.fwhmLambda.ideal) : "—") + ". Ideal dip " + dipText(dipIdeal) + "; pixel dip " + dipText(dipInst) + "." : "No zoom data.");
        schemDesc.update("Slit " + st.sw + " µm at the focus of a " + st.fco + " mm collimator, grating " + st.lpm + " lines/mm at θᵢ = " + st.ti + "°, camera " + st.fca + " mm aimed at order " + st.m + (sim.ok ? " (θm = " + (sim.geo.thetaC / DEG).toFixed(2) + "°)." : " (not propagating)."));
    }

    function render() {
        M = compute(readState());
        updateDom();
        angH.redraw();
        detH.redraw();
        zoomH.redraw();
        schemH.redraw();
        angReadout();
        detReadout();
    }
    let pending = false;

    function schedule() {
        if (pending) return;
        pending = true;
        requestAnimationFrame(() => {
            pending = false;
            render();
        });
    }


    const presetBtns = Array.from(document.querySelectorAll("[data-preset]"));

    function markPreset(name) {
        presetBtns.forEach((b) => b.classList.toggle("active", b.dataset.preset === name));
        if (!name) setText("presetNote", "");
    }

    function applyState(obj) {
        applyingPreset = true;
        ctl.set(obj);
        syncNSlider();
        applyingPreset = false;
        syncVisibility();
        url.update();
        schedule();
    }
    presetBtns.forEach((b) => b.addEventListener("click", () => {
        const p = PRESETS[b.dataset.preset];
        applyState(Object.assign({}, DEFAULTS, p.state));
        markPreset(b.dataset.preset);
        setText("presetNote", p.note);
    }));
    $("resetBtn").addEventListener("click", () => {
        applyState(Object.assign({}, DEFAULTS));
        markPreset("hg");
        setText("presetNote", "Reset to the default experiment. " + PRESETS.hg.note);
    });

    url = UI.urlState({
        get: ctl.get,
        set: (o) => {
            applyingPreset = true;
            ctl.set(o);
            syncNSlider();
            applyingPreset = false;
        }
    });
    UI.addExportBar($("exportHost"), {
        name: "diffraction_grating",
        url,
        getState: () => Object.assign(readState(), {
            model: "grating.js scalar Fraunhofer; spectrometer 2048 px"
        }),
        getCSV: () => {
            if (!M.sim.ok) return {
                headers: ["note"],
                rows: [
                    ["order does not propagate"]
                ]
            };
            const rows = [];
            for (let i = 0; i < NPIX; i++) rows.push([i, M.sim.pixX[i] / MM, M.sim.lamPix[i] / NM, M.sim.pixels[i]]);
            return {
                headers: ["pixel", "x (mm)", "lambda in order " + M.st.m + " (nm)", "signal (I/I0 zero-order units, fixed power)"],
                rows
            };
        },
        canvases: [angH.canvas, detH.canvas, zoomH.canvas, schemH.canvas],
        caption: () => M.st.lpm + " lines/mm, N = " + M.st.N + ", a/d = " + M.st.af + ", θi = " + M.st.ti + "°, order " + M.st.m + ", slit " + M.st.sw + " µm, f " + M.st.fco + "/" + M.st.fca + " mm, pixel " + M.st.px + " µm"
    });

    syncVisibility();
    url.ready.then((restored) => {
        syncNSlider();
        syncVisibility();
        if (!restored) {
            markPreset("hg");
            setText("presetNote", PRESETS.hg.note);
        }
        render();
    });
    render();
})();