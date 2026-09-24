(function() {
    "use strict";
    const UI = window.OpticsUI,
        core = window.OpticsModels.core,
        RM = window.OpticsModels.radiometry;
    const $ = (s) => document.querySelector(s);
    const fmt = (v, u, d = 3) => core.formatSI(v, u, d);
    const pct = (v, d = 3) => (Number.isFinite(v) ? Number((v * 100).toPrecision(d)) + " %" : "—");
    const sci = (v, d = 3) => {
        if (!Number.isFinite(v)) return "—";
        if (v === 0) return "0";
        const a = Math.abs(v);
        return a >= 1e-3 && a < 1e5 ? String(Number(v.toPrecision(d))) : v.toExponential(d - 1).replace("e", "×10^").replace(/\^\+?(-?\d+)/, (m, e) => "^" + e);
    };

    const SUP = {
        "-": "⁻",
        "0": "⁰",
        "1": "¹",
        "2": "²",
        "3": "³",
        "4": "⁴",
        "5": "⁵",
        "6": "⁶",
        "7": "⁷",
        "8": "⁸",
        "9": "⁹"
    };
    const pretty = (s) => s.replace(/\^(-?\d+)/g, (m, e) => [...e].map((ch) => SUP[ch]).join(""));
    const num = (v, d = 3) => pretty(sci(v, d));

    const DEFAULTS = {
        src: "lambert",
        L: -3,
        a: 2,
        I: -9,
        P0: -6,
        w0: 0.5,
        lam: 550,
        so: 200,
        D: 25,
        f: 50,
        no: 1,
        ni: 1,
        ng: 1.5,
        coat: false,
        Tf: 0.9,
        rd: 1,
        eta: 0.7,
        t: -3,
        idark: 100,
        rn: 5,
        fw: 6,
        trials: 2000,
        seed: 1,
        snrx: "time"
    };
    const PRESETS = {
        lamp: {
            set: {},
            note: "Lamp → lens: Φ_c = 0.389 % of the emitted power, S ≈ 2.5×10⁵ e⁻, SNR ≈ 497 ≈ √S (shot-noise limited). This is the worked example."
        },
        starved: {
            set: {
                src: "point",
                I: -12.88,
                lam: 650,
                so: 150,
                D: 20,
                f: 50,
                rd: 0.5,
                eta: 0.8,
                t: -2.3,
                idark: 50,
                rn: 5,
                fw: 5,
                trials: 20000
            },
            note: "Photon-starved: S ≈ 20 e⁻ but σ_r² = 25 e⁻². Expect variance ≈ S + D + σ_r² and SNR ≈ 3, read-noise limited."
        },
        poisson: {
            set: {
                src: "point",
                I: -13.5,
                lam: 550,
                so: 150,
                D: 20,
                f: 50,
                rd: 0.5,
                eta: 1,
                t: -2,
                idark: 0,
                rn: 0,
                fw: 5,
                trials: 20000,
                Tf: 1,
                coat: true
            },
            note: "Ideal counter (η = 1, no dark current, no read noise, S ≈ 12 e⁻): the histogram follows the Poisson pmf and variance = mean within the Monte Carlo standard error."
        },
        laser: {
            set: {
                src: "laser",
                P0: -9,
                w0: 0.1,
                lam: 633,
                so: 500,
                D: 2.0,
                f: 100,
                rd: 0.05,
                eta: 0.6,
                t: -4,
                rn: 5,
                idark: 100,
                fw: 6
            },
            note: "Laser clipping: a 0.1 mm waist diverges to w ≈ 1.01 mm at the stop, about D/2, so the aperture passes ≈ 1 − e⁻² = 86 %. Try D = 4 mm (≈ 100 %) and D = 1 mm (≈ 39 %)."
        },
        immersion: {
            set: {
                src: "lambert",
                L: -3,
                a: 0.1,
                lam: 520,
                so: 20,
                D: 30,
                f: 12,
                no: 1.515,
                ni: 1,
                coat: true,
                Tf: 1,
                rd: 1
            },
            note: "Immersion: L/n² is the same in object and image space except for the two coated surfaces (×0.995); the radiance L in air is 1/1.515² = 0.44 of that in oil."
        },
        saturate: {
            set: {
                src: "lambert",
                L: -3,
                t: 0.7,
                fw: 5,
                trials: 5000
            },
            note: "Full well: S + D ≫ 10⁵ e⁻, so every exposure is clipped at the well. The histogram collapses onto the well and the SNR curve stops."
        }
    };


    const sidebar = $(".options-sidebar");
    const SLIDER_OPTS = {
        LSlider: {
            unit: "log₁₀"
        },
        ISlider: {
            unit: "log₁₀"
        },
        P0Slider: {
            unit: "log₁₀"
        },
        tSlider: {
            unit: "log₁₀ s"
        },
        fwSlider: {
            unit: "log₁₀"
        },
        aSlider: {
            unit: "mm"
        },
        w0Slider: {
            unit: "mm"
        },
        lamSlider: {
            unit: "nm"
        },
        soSlider: {
            unit: "mm"
        },
        DSlider: {
            unit: "mm"
        },
        fSlider: {
            unit: "mm"
        },
        rdSlider: {
            unit: "mm"
        },
        idarkSlider: {
            unit: "e⁻/s"
        },
        rnSlider: {
            unit: "e⁻"
        }
    };

    sidebar.querySelectorAll('input[type="range"]').forEach((r) => {
        const span = r.closest(".control-group").querySelector(".control-label span");
        let name = span ? span.textContent.trim() : r.id;
        if (SLIDER_OPTS[r.id] && SLIDER_OPTS[r.id].unit) name = name.replace(/\s*\([^)]*\)\s*$/, "");
        r.setAttribute("aria-label", name);
    });
    UI.enhanceAllSliders(sidebar, SLIDER_OPTS);
    let scheduled = false;
    const ctl = UI.bindControls({
        src: "radio:src",
        L: "#LSlider",
        a: "#aSlider",
        I: "#ISlider",
        P0: "#P0Slider",
        w0: "#w0Slider",
        lam: "#lamSlider",
        so: "#soSlider",
        D: "#DSlider",
        f: "#fSlider",
        no: "#noSlider",
        ni: "#niSlider",
        ng: "#ngSlider",
        coat: "#coatBox",
        Tf: "#TfSlider",
        rd: "#rdSlider",
        eta: "#etaSlider",
        t: "#tSlider",
        idark: "#idarkSlider",
        rn: "#rnSlider",
        fw: "#fwSlider",
        trials: "#trialsSlider",
        seed: "#seedInput",
        snrx: "radio:snrx"
    }, () => {
        if (url) url.update();
        schedule();
    });
    const url = UI.urlState({
        get: ctl.get,
        set: ctl.set
    });

    function schedule() {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(() => {
            scheduled = false;
            render();
        });
    }

    function applyState(obj) {
        ctl.set(Object.assign({}, DEFAULTS, obj));
        url.update();
        schedule();
    }
    document.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => {
        const p = PRESETS[b.dataset.preset];
        applyState(p.set);
        document.querySelectorAll("[data-preset]").forEach((x) => x.classList.toggle("active", x === b));
        $("#presetNote").textContent = p.note;
    }));
    $("#resetBtn").addEventListener("click", () => {
        applyState({});
        document.querySelectorAll("[data-preset]").forEach((x) => x.classList.remove("active"));
        $("#presetNote").textContent = "Reset to the default experiment (Lamp → lens).";
    });
    $("#resampleBtn").addEventListener("click", () => {
        const s = ctl.get();
        ctl.set({
            seed: (Math.round(s.seed) % 999999) + 1
        });
    });
    $("#seedInput").addEventListener("change", () => {
        const el = $("#seedInput");
        const v = Math.round(Number(el.value));
        el.value = String(Number.isFinite(v) && v >= 1 ? Math.min(999999, v) : 1);
    });


    function params(s) {
        return {
            source: s.src,
            L: 10 ** s.L,
            a: s.a * 1e-3,
            I: 10 ** s.I,
            P0: 10 ** s.P0,
            w0: s.w0 * 1e-3,
            lambda0: s.lam * 1e-9,
            so: s.so * 1e-3,
            f: s.f * 1e-3,
            D: s.D * 1e-3,
            no: s.no,
            ni: s.ni,
            ng: s.ng,
            coated: !!s.coat,
            Tf: s.Tf,
            rd: s.rd * 1e-3,
            eta: s.eta,
            t: 10 ** s.t,
            idark: s.idark,
            readNoise: s.rn,
            fullWell: Math.round(10 ** s.fw)
        };
    }


    let S = null,
        P = null,
        E = null,
        MC = null,
        naSweep = null,
        irr = null,
        snrData = null;

    function compute() {
        S = ctl.get();
        if (!Number.isFinite(S.seed) || S.seed < 1) S.seed = 1;
        P = params(S);
        E = RM.experiment(P);


        const mean = E.S + E.dark;
        const trials = Math.max(100, Math.round(S.trials));
        const samples = RM.simulateCounts({
            mean,
            readNoise: P.readNoise,
            fullWell: P.fullWell,
            trials,
            seed: Math.round(S.seed)
        });
        const stats = RM.sampleStats(samples);
        const sigmaPhys = Math.sqrt(mean + P.readNoise ** 2);
        const integer = P.readNoise === 0 && sigmaPhys < 30;
        let edges;
        if (mean - 4 * Math.sqrt(mean) > P.fullWell) {
            edges = RM.histogramEdges(P.fullWell - 3 * Math.max(P.readNoise, 1), 3 * Math.max(P.readNoise, 1), {
                integer,
                fullWell: P.fullWell,
                maxBins: 40
            });
        } else {
            edges = RM.histogramEdges(mean, sigmaPhys, {
                integer,
                fullWell: P.fullWell
            });
        }
        const counts = RM.histogram(samples, edges);
        const theory = RM.countDistribution({
            mean,
            readNoise: P.readNoise,
            fullWell: P.fullWell
        }, edges);

        const mom = RM.readoutMoments({
            mean,
            readNoise: P.readNoise,
            fullWell: P.fullWell
        });
        const tMean = mom.mean,
            tVar = mom.variance;
        const clipped = mean + 3 * Math.sqrt(mean) > P.fullWell;
        MC = {
            mean,
            samples,
            stats,
            edges,
            counts,
            theory,
            trials,
            tMean,
            tVar,
            clipped,
            integer,
            sigmaPhys
        };


        const Ds = [];
        for (let i = 0; i <= 160; i++) Ds.push(0.2e-3 * Math.pow(100 / 0.2, i / 160));
        naSweep = Ds.map((D) => {
            const r = RM.experiment(Object.assign({}, P, {
                D
            }));
            return {
                D,
                NA: r.NAo,
                frac: r.collectedFraction,
                approx: r.PcollApprox / r.Pemit,
                res: r.resObj
            };
        });


        const rhoMax = Math.max(1.4 * E.R, P.source === "lambert" ? 1.6 * P.a : 0, P.source === "laser" ? 1.8 * E.wLens : 0);
        const nPts = 90,
            xs = [],
            ys = [];
        for (let i = 0; i <= nPts; i++) {
            const rho = rhoMax * i / nPts;
            xs.push(rho);
            ys.push(P.source === "lambert" ? RM.lambertIrradianceAt(P.L, P.a, P.so, rho, 1e-9) :
                P.source === "point" ? RM.pointIrradianceAt(P.I, P.so, rho) :
                RM.gaussianIrradianceAt(P.P0, E.wLens, rho));
        }

        let PcollNum, E0num, E0ana;
        const Ef = (rho) => (P.source === "lambert" ? RM.lambertIrradianceAt(P.L, P.a, P.so, rho, 1e-11) :
            P.source === "point" ? RM.pointIrradianceAt(P.I, P.so, rho) : RM.gaussianIrradianceAt(P.P0, E.wLens, rho));
        if (P.source === "lambert") {
            PcollNum = RM.diskToDiskPowerNumeric(P.L, P.a, E.R, P.so, 120);
            E0num = RM.lambertIrradianceAt(P.L, P.a, P.so, 0, 1e-12);
            E0ana = RM.lambertOnAxisIrradiance(P.L, P.a, P.so);
        } else {
            PcollNum = core.simpson((r) => Ef(r) * 2 * Math.PI * r, 0, E.R, 400);
            E0num = P.source === "point" ? P.I / (P.so * P.so) : E.Ecenter;
            E0ana = E0num;
        }
        irr = {
            xs,
            ys,
            rhoMax,
            PcollNum,
            E0num,
            E0ana
        };


        const pts = 160,
            eRatePerW = P.eta * P.lambda0 / (core.constants.h * core.constants.c);
        const X = [],
            snr = [],
            shot = [],
            read = [];
        const byTime = S.snrx !== "power";
        let lo, hi;
        if (byTime) {
            lo = 1e-6;
            hi = 10;
        } else {
            const p0 = E.Pdet > 0 ? E.Pdet : 1e-15;
            lo = p0 / 1e4;
            hi = p0 * 1e4;
        }
        for (let i = 0; i <= pts; i++) {
            const x = lo * Math.pow(hi / lo, i / pts);
            const t = byTime ? P.t : P.t;
            const sig = byTime ? E.eRate * x : eRatePerW * x * t;
            const dk = P.idark * (byTime ? x : t);
            const r = RM.snr({
                signal: sig,
                dark: dk,
                readNoise: P.readNoise
            });
            X.push(x);
            snr.push(sig + dk > P.fullWell ? NaN : r.snr);
            shot.push(Math.sqrt(sig));
            read.push(P.readNoise > 0 ? sig / P.readNoise : NaN);
        }

        let xCross = NaN,
            xSat = NaN;
        if (byTime) {
            if (E.eRate > P.idark && P.readNoise > 0) xCross = P.readNoise ** 2 / (E.eRate - P.idark);
            xSat = P.fullWell / (E.eRate + P.idark);
        } else {
            const need = P.readNoise ** 2 + P.idark * P.t;
            if (P.readNoise > 0) xCross = need / (eRatePerW * P.t);
            xSat = (P.fullWell - P.idark * P.t) / (eRatePerW * P.t);
        }
        snrData = {
            X,
            snr,
            shot,
            read,
            lo,
            hi,
            byTime,
            xCross,
            xSat,
            xNow: byTime ? P.t : E.Pdet
        };
    }


    const PAL = UI.CANVAS_PALETTE;
    let naMap = null;

    function prefixScale(maxAbs, unit) {
        const table = [
            [1e6, "M"],
            [1e3, "k"],
            [1, ""],
            [1e-3, "m"],
            [1e-6, "µ"],
            [1e-9, "n"],
            [1e-12, "p"],
            [1e-15, "f"],
            [1e-18, "a"]
        ];
        if (!(maxAbs > 0)) return {
            scale: 1,
            unit
        };
        const best = table.find((p) => maxAbs >= p[0] * 0.999) || table[table.length - 1];
        return {
            scale: best[0],
            unit: best[1] + unit
        };
    }

    function beamColor(alpha) {
        const nm = Math.min(700, Math.max(400, P.lambda0 * 1e9));
        return P.lambda0 * 1e9 > 720 || P.lambda0 * 1e9 < 380 ? "rgba(241, 135, 200, " + alpha + ")" : UI.wavelengthToCSS(nm, alpha);
    }

    function drawBench(ctx, w, h) {
        ctx.fillStyle = PAL.background;
        ctx.fillRect(0, 0, w, h);
        if (!E) return;
        const small = w < 520;
        const fs = small ? 11 : 12;
        ctx.font = fs + "px " + PAL.font;
        const ml = small ? 26 : 44,
            mr = small ? 26 : 44,
            mt = small ? 3 * (fs + 3) + 14 : 2 * (fs + 3) + 14,
            mb = small ? 46 : 42;
        const real = E.img.real;
        const si = real ? E.img.si : P.so * 0.6;
        const total = P.so + si;
        const sx = (w - ml - mr) / total;
        const imgR = real ? E.imgRadius : 0;
        const srcH = P.source === "lambert" ? P.a : P.source === "laser" ? P.w0 : 0;
        const ymax = Math.max(E.R, srcH, P.rd, imgR, P.source === "laser" ? E.wLens : 0) * 1.12;
        const sy = (h - mt - mb) / 2 / ymax;
        const X = (z) => ml + z * sx,
            Y = (y) => mt + (h - mt - mb) / 2 - y * sy;
        const zL = P.so,
            zD = P.so + si;


        if (P.no > 1.0001) {
            ctx.fillStyle = "rgba(138, 180, 255, " + Math.min(0.22, (P.no - 1) * 0.3) + ")";
            ctx.fillRect(0, mt - 8, X(zL), h - mt - mb + 16);
        }
        if (P.ni > 1.0001) {
            ctx.fillStyle = "rgba(138, 180, 255, " + Math.min(0.22, (P.ni - 1) * 0.3) + ")";
            ctx.fillRect(X(zL), mt - 8, w - X(zL), h - mt - mb + 16);
        }

        ctx.strokeStyle = PAL.gridStrong;
        ctx.setLineDash([6, 5]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(4, Y(0));
        ctx.lineTo(w - 4, Y(0));
        ctx.stroke();
        ctx.setLineDash([]);


        ctx.fillStyle = beamColor(0.2);
        if (P.source === "laser") {

            ctx.beginPath();
            const N = 60;
            for (let i = 0; i <= N; i++) {
                const z = zL * i / N;
                ctx.lineTo(X(z), Y(Math.min(E.R, RM.gaussianBeamRadius(P.w0, z, P.lambda0, P.no))));
            }
            for (let i = N; i >= 0; i--) {
                const z = zL * i / N;
                ctx.lineTo(X(z), Y(-Math.min(E.R, RM.gaussianBeamRadius(P.w0, z, P.lambda0, P.no))));
            }
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = beamColor(0.7);
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let i = 0; i <= N; i++) {
                const z = zL * i / N;
                const y = RM.gaussianBeamRadius(P.w0, z, P.lambda0, P.no);
                ctx.lineTo(X(z), Y(y));
            }
            ctx.stroke();
            ctx.beginPath();
            for (let i = 0; i <= N; i++) {
                const z = zL * i / N;
                const y = RM.gaussianBeamRadius(P.w0, z, P.lambda0, P.no);
                ctx.lineTo(X(z), Y(-y));
            }
            ctx.stroke();
        } else {
            ctx.beginPath();
            ctx.moveTo(X(0), Y(0));
            ctx.lineTo(X(zL), Y(E.R));
            ctx.lineTo(X(zL), Y(-E.R));
            ctx.closePath();
            ctx.fill();
            if (P.source === "lambert") {
                ctx.fillStyle = beamColor(0.08);
                ctx.beginPath();
                ctx.moveTo(X(0), Y(P.a));
                ctx.lineTo(X(zL), Y(E.R));
                ctx.lineTo(X(zL), Y(-E.R));
                ctx.lineTo(X(0), Y(-P.a));
                ctx.closePath();
                ctx.fill();
            }
            ctx.strokeStyle = beamColor(0.9);
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(X(0), Y(0));
            ctx.lineTo(X(zL), Y(E.R));
            ctx.moveTo(X(0), Y(0));
            ctx.lineTo(X(zL), Y(-E.R));
            ctx.stroke();
        }
        if (real) {
            ctx.fillStyle = beamColor(0.2);
            ctx.beginPath();
            ctx.moveTo(X(zL), Y(E.R));
            ctx.lineTo(X(zD), Y(0));
            ctx.lineTo(X(zL), Y(-E.R));
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = beamColor(0.9);
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(X(zL), Y(E.R));
            ctx.lineTo(X(zD), Y(0));
            ctx.lineTo(X(zL), Y(-E.R));
            ctx.stroke();

            if (P.source === "lambert") {
                ctx.strokeStyle = PAL.marker;
                ctx.setLineDash([4, 3]);
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(X(0), Y(P.a));
                ctx.lineTo(X(zL), Y(0));
                ctx.lineTo(X(zD), Y(E.img.m * P.a));
                ctx.stroke();
                ctx.setLineDash([]);
            }
        } else {
            ctx.strokeStyle = beamColor(0.6);
            ctx.setLineDash([3, 4]);
            ctx.lineWidth = 1.2;
            const slope = E.R / P.so * 0.4;
            ctx.beginPath();
            ctx.moveTo(X(zL), Y(E.R));
            ctx.lineTo(X(zD), Y(E.R + slope * si));
            ctx.moveTo(X(zL), Y(-E.R));
            ctx.lineTo(X(zD), Y(-E.R - slope * si));
            ctx.stroke();
            ctx.setLineDash([]);
        }


        if (P.source === "lambert") {
            ctx.fillStyle = PAL.marker;
            ctx.fillRect(X(0) - 3, Y(P.a), 6, Math.max(2, 2 * P.a * sy));
        } else if (P.source === "point") {
            ctx.fillStyle = PAL.marker;
            ctx.beginPath();
            ctx.arc(X(0), Y(0), 4.5, 0, 2 * Math.PI);
            ctx.fill();
            ctx.strokeStyle = PAL.marker;
            ctx.lineWidth = 1;
            for (let k = 0; k < 8; k++) {
                const an = k * Math.PI / 4;
                ctx.beginPath();
                ctx.moveTo(X(0) + 7 * Math.cos(an), Y(0) + 7 * Math.sin(an));
                ctx.lineTo(X(0) + 11 * Math.cos(an), Y(0) + 11 * Math.sin(an));
                ctx.stroke();
            }
        } else {
            ctx.fillStyle = "#3a3550";
            ctx.fillRect(X(0) - 14, Y(0) - 8, 12, 16);
            ctx.fillStyle = beamColor(1);
            ctx.fillRect(X(0) - 2, Y(P.w0), 3, Math.max(2, 2 * P.w0 * sy));
        }

        ctx.fillStyle = "#4a4560";
        ctx.fillRect(X(zL) - 3, Y(ymax * 1.05), 6, Y(E.R) - Y(ymax * 1.05));
        ctx.fillRect(X(zL) - 3, Y(-E.R), 6, Y(-ymax * 1.05) - Y(-E.R));
        const lensW = Math.max(6, Math.min(16, E.R * sy * 0.25));
        ctx.fillStyle = "rgba(105, 245, 231, 0.18)";
        ctx.strokeStyle = "#69f5e7";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(X(zL), Y(0), lensW / 2, Math.max(3, E.R * sy), 0, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#8ab4ff";
        ctx.fillRect(X(zD) - 2, Y(P.rd), 5, Math.max(2, 2 * P.rd * sy));
        ctx.strokeStyle = "#8ab4ff";
        ctx.lineWidth = 1;
        ctx.strokeRect(X(zD) + 3, Y(P.rd), 5, Math.max(2, 2 * P.rd * sy));
        if (real && imgR > 0) {
            ctx.strokeStyle = PAL.marker;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(X(zD) - 7, Y(imgR));
            ctx.lineTo(X(zD) - 7, Y(-imgR));
            ctx.stroke();
        }

        if (P.source !== "laser") {
            const rArc = Math.min(60, X(zL) - X(0) - 10) * 0.7;
            const ang = Math.atan2(E.R * sy, P.so * sx);
            ctx.strokeStyle = PAL.text;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(X(0), Y(0), rArc, -ang, 0);
            ctx.stroke();
            ctx.fillStyle = PAL.text;
            ctx.textAlign = "left";
            ctx.textBaseline = "bottom";
            ctx.fillText("θ₀ = " + (E.thO * 180 / Math.PI).toFixed(2) + "°", X(0) + rArc + 4, Y(0) - 3);
        }

        ctx.textBaseline = "top";
        const srcLabel = P.source === "lambert" ? "Lambertian disk" : P.source === "point" ? "point source" : "laser waist";
        const lh = fs + 3;
        ctx.textAlign = "left";
        ctx.fillStyle = PAL.text;
        ctx.fillText(srcLabel, 4, 4);
        ctx.fillStyle = PAL.textMuted;
        ctx.fillText("Φ = " + fmt(E.Pemit, "W"), 4, 4 + lh);
        ctx.textAlign = "right";
        ctx.fillStyle = PAL.text;
        ctx.fillText("detector", w - 4, 4);
        ctx.fillStyle = PAL.textMuted;
        ctx.fillText("Φ_d = " + fmt(E.Pdet, "W"), w - 4, 4 + lh);
        const lensTxt = "stop + lens, D = " + (P.D * 1e3).toFixed(1) + " mm";
        const collTxt = "Φ_c = " + fmt(E.Pcoll, "W");
        ctx.textAlign = "center";
        if (small) {
            const t = lensTxt + " · " + collTxt;
            const tw = ctx.measureText(t).width;
            const cxl = Math.min(w - tw / 2 - 4, Math.max(tw / 2 + 4, X(zL)));
            ctx.fillStyle = PAL.text;
            ctx.fillText(t, cxl, 4 + 2 * lh);
        } else {
            const tw = Math.max(ctx.measureText(lensTxt).width, ctx.measureText(collTxt).width);
            const cxl = Math.min(w - tw / 2 - 90, Math.max(tw / 2 + 130, X(zL)));
            ctx.fillStyle = PAL.text;
            ctx.fillText(lensTxt, cxl, 4);
            ctx.fillStyle = PAL.textMuted;
            ctx.fillText(collTxt, cxl, 4 + lh);
        }

        const yb = h - mb + 8;
        ctx.strokeStyle = PAL.axis;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(X(0), yb);
        ctx.lineTo(X(zL), yb);
        ctx.moveTo(X(zL), yb);
        ctx.lineTo(X(zD), yb);
        ctx.moveTo(X(0), yb - 4);
        ctx.lineTo(X(0), yb + 4);
        ctx.moveTo(X(zL), yb - 4);
        ctx.lineTo(X(zL), yb + 4);
        ctx.moveTo(X(zD), yb - 4);
        ctx.lineTo(X(zD), yb + 4);
        ctx.stroke();
        ctx.fillStyle = PAL.textMuted;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText("sₒ = " + (P.so * 1e3).toFixed(0) + " mm, n₀ = " + P.no.toFixed(3), (X(0) + X(zL)) / 2, yb + 5);
        const siLabel = real ? "sᵢ = " + (si * 1e3).toFixed(1) + " mm" : "no real image";
        ctx.fillText(small ? siLabel : siLabel + ", nᵢ = " + P.ni.toFixed(3), Math.min(w - 70, Math.max((X(zL) + X(zD)) / 2, X(zL) + 60)), yb + 5);
        ctx.textAlign = "left";
        ctx.fillText("NA = " + E.NAo.toFixed(4) + "   heights ×" + num(sy / sx, 2), 4, h - fs - 4);
    }
    const bench = UI.setupCanvas($("#benchCanvas"), {
        aspect: 2.5,
        minHeight: 250,
        maxHeight: 400,
        draw: drawBench
    });
    const benchDesc = UI.describeCanvas($("#benchCanvas"), "Schematic of the source, aperture, lens and detector.", {
        label: "Experiment schematic with collection cone"
    });

    function drawNA(ctx, w, h) {
        ctx.fillStyle = PAL.background;
        ctx.fillRect(0, 0, w, h);
        if (!naSweep) return;
        const xs = naSweep.map((d) => d.NA);
        const xMax = Math.max(...xs) * 1.02;
        const top = {
                x: 0,
                y: 0,
                w,
                h: h * 0.55
            },
            bot = {
                x: 0,
                y: h * 0.55,
                w,
                h: h * 0.45
            };
        naMap = UI.plot(ctx, top, {
            x: {
                min: 0,
                max: xMax,
                label: ""
            },
            y: {
                log: true,
                label: "Φ_c / Φ_emit",
                min: Math.max(1e-12, Math.min(...naSweep.map((d) => d.frac)) * 0.8),
                max: Math.min(30, Math.max(...naSweep.map((d) => d.frac)) * 60)
            },
            series: [{
                    xs,
                    ys: naSweep.map((d) => d.frac),
                    label: "exact"
                },
                {
                    xs,
                    ys: naSweep.map((d) => d.approx),
                    label: P.source === "laser" ? "(same)" : "small-angle",
                    dash: [6, 4],
                    color: PAL.series[1]
                }
            ],
            markers: [{
                x: E.NAo,
                label: "NA = " + E.NAo.toFixed(3)
            }],
            margin: {
                b: 28
            }
        });
        UI.plot(ctx, bot, {
            x: {
                min: 0,
                max: xMax,
                label: "object-side NA = n₀ sin θ₀"
            },
            y: {
                log: true,
                label: "δ (µm)"
            },
            series: [{
                xs,
                ys: naSweep.map((d) => d.res * 1e6),
                label: "0.61 λ₀/NA",
                color: PAL.series[2]
            }],
            markers: [{
                x: E.NAo,
                label: (E.resObj * 1e6).toPrecision(3) + " µm"
            }],
            margin: {
                t: 8
            }
        });
    }
    const naCv = UI.setupCanvas($("#naCanvas"), {
        aspect: 1.25,
        minHeight: 300,
        maxHeight: 460,
        draw: drawNA
    });
    const naDesc = UI.describeCanvas($("#naCanvas"), "Collected power fraction and resolution versus numerical aperture.", {
        label: "Collected power and resolution versus NA"
    });

    function setNAFromPointer(e) {
        if (!naMap) return;
        const r = naCv.canvas.getBoundingClientRect();
        const px = e.clientX - r.left;
        let NA = naMap.pxToX(px);
        setNA(NA);
    }

    function setNA(NA) {
        const s = ctl.get();
        NA = Math.max(1e-4, Math.min(NA, 0.999 * s.no));
        const D = 2 * s.so * Math.tan(Math.asin(NA / s.no));
        ctl.set({
            D: Math.min(100, Math.max(0.2, Math.round(D * 10) / 10))
        });
    }
    naCv.canvas.addEventListener("pointerdown", (e) => {
        naCv.canvas.setPointerCapture(e.pointerId);
        setNAFromPointer(e);
    });
    naCv.canvas.addEventListener("pointermove", (e) => {
        if (e.buttons & 1) setNAFromPointer(e);
    });
    naCv.canvas.addEventListener("keydown", (e) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        e.preventDefault();
        const s = ctl.get();
        const D = s.D * (e.key === "ArrowRight" ? 1.1 : 1 / 1.1);
        ctl.set({
            D: Math.min(100, Math.max(0.2, Math.round(D * 10) / 10))
        });
    });

    function drawIrr(ctx, w, h) {
        ctx.fillStyle = PAL.background;
        ctx.fillRect(0, 0, w, h);
        if (!irr) return;
        const ymaxV = Math.max(...irr.ys);
        const ps = prefixScale(ymaxV, "W m⁻²");
        const xs = irr.xs.map((x) => x * 1e3);
        const series = [{
            xs,
            ys: irr.ys.map((y) => y / ps.scale),
            label: P.source === "lambert" ? "numerical ∫L cosθ dΩ" : P.source === "point" ? "I cos³θ / sₒ²" : "Gaussian 2Φ/(πw²)e^(−2ρ²/w²)",
            fill: true
        }];
        if (P.source === "lambert") series.push({
            xs: [0],
            ys: [irr.E0ana / ps.scale],
            label: "πL sin²θ (analytic)",
            pointsOnly: true,
            pointRadius: 5,
            color: PAL.series[1]
        });
        const markers = [{
            x: E.R * 1e3,
            label: "D/2",
            color: "#69f5e7"
        }];
        if (P.source === "lambert" && P.a * 1e3 < irr.rhoMax * 1e3) markers.push({
            x: P.a * 1e3,
            label: "ρ = a",
            color: PAL.series[2],
            dash: [2, 3]
        });
        UI.plot(ctx, {
            x: 0,
            y: 0,
            w,
            h
        }, {
            x: {
                min: 0,
                max: irr.rhoMax * 1e3,
                label: "radius on aperture plane ρ",
                unit: "mm"
            },
            y: {
                min: 0,
                max: ymaxV / ps.scale * 1.08,
                label: "E",
                unit: ps.unit
            },
            series,
            markers,
            legend: false
        });
    }
    const irrCv = UI.setupCanvas($("#irrCanvas"), {
        aspect: 1.25,
        minHeight: 300,
        maxHeight: 460,
        draw: drawIrr
    });
    const irrDesc = UI.describeCanvas($("#irrCanvas"), "Irradiance across the aperture plane.", {
        label: "Irradiance profile on the aperture plane"
    });

    function drawHist(ctx, w, h) {
        ctx.fillStyle = PAL.background;
        ctx.fillRect(0, 0, w, h);
        if (!MC) return;
        const {
            edges,
            counts,
            theory,
            trials
        } = MC;
        const n = edges.length - 1,
            bw = (edges[n] - edges[0]) / n;
        const big = Math.max(Math.abs(edges[0]), Math.abs(edges[n])) >= 1e4;
        const scaleX = big ? 1e3 : 1,
            xUnit = big ? "ke⁻" : "e⁻";
        const sx = [],
            sy = [],
            cx = [],
            cy = [],
            hiB = [],
            loB = [];
        for (let i = 0; i < n; i++) {
            const d = counts[i] / (trials * bw);
            sx.push(edges[i] / scaleX, edges[i + 1] / scaleX);
            sy.push(d, d);
            const p = theory.probs[i];
            const se = Math.sqrt(trials * p * (1 - p)) / (trials * bw);
            cx.push((edges[i] + edges[i + 1]) / 2 / scaleX);
            cy.push(p / bw);
            hiB.push(p / bw + 2 * se);
            loB.push(Math.max(0, p / bw - 2 * se));
        }
        const ymax = Math.max(...sy, ...hiB) * 1.1 || 1;
        const markers = [{
            x: MC.tMean / scaleX,
            label: "μ",
            color: PAL.marker
        }];
        if (P.fullWell <= edges[n] + bw) markers.push({
            x: P.fullWell / scaleX,
            label: "full well",
            color: PAL.warning
        });
        UI.plot(ctx, {
            x: 0,
            y: 0,
            w,
            h
        }, {
            x: {
                min: edges[0] / scaleX,
                max: edges[n] / scaleX,
                label: "electrons per exposure",
                unit: xUnit
            },
            y: {
                min: 0,
                max: ymax,
                label: "probability per e⁻"
            },
            series: [{
                    xs: sx,
                    ys: sy,
                    label: "MC histogram (N = " + trials + ")",
                    fill: true,
                    width: 1.5
                },
                {
                    xs: cx,
                    ys: cy,
                    label: theory.approx ? "theory (normal approx.)" : "theory (exact)",
                    pointsOnly: true,
                    pointRadius: 2.8,
                    color: PAL.series[1]
                },
                {
                    xs: cx,
                    ys: hiB,
                    label: "±2 SE (finite N)",
                    dash: [2, 3],
                    width: 1,
                    color: PAL.series[3]
                },
                {
                    xs: cx,
                    ys: loB,
                    dash: [2, 3],
                    width: 1,
                    color: PAL.series[3]
                }
            ],
            markers,
            legend: false
        });
    }
    const histCv = UI.setupCanvas($("#histCanvas"), {
        aspect: 1.25,
        minHeight: 300,
        maxHeight: 460,
        draw: drawHist
    });
    const histDesc = UI.describeCanvas($("#histCanvas"), "Histogram of simulated counts with the theoretical distribution.", {
        label: "Count histogram versus theory"
    });

    function drawSNR(ctx, w, h) {
        ctx.fillStyle = PAL.background;
        ctx.fillRect(0, 0, w, h);
        if (!snrData) return;
        const d = snrData;
        const xsc = d.byTime ? 1 : 1;
        const all = [...d.snr, ...d.shot].filter((v) => Number.isFinite(v) && v > 0);
        let ymin = Math.max(1e-3, Math.min(...all)),
            ymax = Math.max(...all);
        if (!(ymax > ymin)) {
            ymin = 1e-3;
            ymax = 10;
        }
        const markers = [{
            x: d.xNow * xsc,
            label: d.byTime ? "t now" : "Φ now"
        }];
        if (Number.isFinite(d.xCross) && d.xCross > d.lo && d.xCross < d.hi) markers.push({
            x: d.xCross,
            label: "S = σ_r² + D",
            color: PAL.series[3]
        });
        if (Number.isFinite(d.xSat) && d.xSat > d.lo && d.xSat < d.hi) markers.push({
            x: d.xSat,
            label: "full well",
            color: PAL.warning
        });
        UI.plot(ctx, {
            x: 0,
            y: 0,
            w,
            h
        }, {
            x: {
                log: true,
                min: d.lo,
                max: d.hi,
                label: d.byTime ? "exposure t" : "power on detector",
                unit: d.byTime ? "s" : "W"
            },
            y: {
                log: true,
                min: ymin,
                max: ymax * 1.5,
                label: "SNR"
            },
            series: [{
                    xs: d.X,
                    ys: d.snr,
                    label: "SNR"
                },
                {
                    xs: d.X,
                    ys: d.shot,
                    label: "√S (shot limit)",
                    dash: [7, 4],
                    color: PAL.series[1]
                },
                {
                    xs: d.X,
                    ys: d.read,
                    label: "S/σ_r (read limit)",
                    dash: [2, 3],
                    color: PAL.series[2]
                }
            ],
            markers,
            legend: false
        });
    }
    const snrCv = UI.setupCanvas($("#snrCanvas"), {
        aspect: 1.25,
        minHeight: 300,
        maxHeight: 460,
        draw: drawSNR
    });
    const snrDesc = UI.describeCanvas($("#snrCanvas"), "SNR versus exposure time.", {
        label: "Signal-to-noise ratio regimes"
    });


    const setText = (id, t) => {
        const el = document.getElementById(id);
        if (el) el.textContent = t;
    };

    function cell(tr, text, cls) {
        const td = document.createElement("td");
        td.textContent = text;
        if (cls) td.className = cls;
        tr.appendChild(td);
        return td;
    }

    function updateLabels() {
        setText("LValue", fmt(P.L, "W m⁻² sr⁻¹"));
        setText("aValue", (S.a).toFixed(1) + " mm");
        setText("IValue", fmt(P.I, "W/sr"));
        setText("P0Value", fmt(P.P0, "W"));
        setText("w0Value", S.w0.toFixed(2) + " mm");
        setText("lamValue", S.lam + " nm");
        setText("soValue", S.so + " mm");
        setText("DValue", S.D.toFixed(1) + " mm");
        setText("fValue", S.f + " mm");
        setText("noValue", S.no.toFixed(3));
        setText("niValue", S.ni.toFixed(3));
        setText("ngValue", S.ng.toFixed(2));
        setText("TfValue", S.Tf.toFixed(2));
        setText("rdValue", S.rd.toFixed(2) + " mm");
        setText("etaValue", S.eta.toFixed(2));
        setText("tValue", fmt(P.t, "s"));
        setText("idarkValue", S.idark + " e⁻/s");
        setText("rnValue", S.rn.toFixed(1) + " e⁻");
        setText("fwValue", num(P.fullWell, 3) + " e⁻");
        setText("trialsValue", String(Math.round(S.trials)));
        document.querySelectorAll(".src-group").forEach((g) => {
            g.hidden = g.dataset.src !== S.src;
        });
        document.querySelectorAll(".seg-option").forEach((l) => {
            const i = l.querySelector("input");
            l.classList.toggle("active", !!(i && i.checked));
        });
    }

    function updateTables() {

        const tb = $("#budgetBody");
        tb.textContent = "";
        E.rows.forEach((r, i) => {
            const tr = document.createElement("tr");
            if (i === E.rows.length - 1) tr.className = "budget-final";
            const th = document.createElement("th");
            th.scope = "row";
            th.textContent = r.stage;
            tr.appendChild(th);
            cell(tr, Number.isFinite(r.factor) ? (r.factor < 1e-3 ? num(r.factor, 4) : r.factor.toFixed(4)) : "—");
            cell(tr, Number.isFinite(r.power) ? fmt(r.power, "W", 4) : "—");
            cell(tr, num(r.photonRate, 4) + (i === E.rows.length - 1 ? " e⁻/s" : " /s"));
            cell(tr, r.note, "note");
            tb.appendChild(tr);
        });
        const trS = document.createElement("tr");
        trS.className = "budget-final";
        const thS = document.createElement("th");
        thS.scope = "row";
        thS.textContent = "Mean signal in t = " + fmt(P.t, "s");
        trS.appendChild(thS);
        cell(trS, "× t");
        cell(trS, "—");
        cell(trS, num(E.S, 4) + " e⁻");
        cell(trS, "N = η Φ_d t λ₀/(hc); dark adds " + num(E.dark, 3) + " e⁻", "note");
        tb.appendChild(trS);


        const cb = $("#checkBody");
        cb.textContent = "";
        const rd = (a, b) => (Number.isFinite(a) && Number.isFinite(b) && b !== 0 ? num(Math.abs(a - b) / Math.abs(b), 2) : "—");
        const rowC = (q, a, b, note) => {
            const tr = document.createElement("tr");
            const th = document.createElement("th");
            th.scope = "row";
            th.textContent = q;
            tr.appendChild(th);
            cell(tr, a);
            cell(tr, b);
            cell(tr, note);
            cb.appendChild(tr);
        };
        if (P.source === "lambert") {
            rowC("On-axis E at the stop", "πL sin²θ = " + fmt(irr.E0ana, "W m⁻²", 6), "∫L cosθ dΩ = " + fmt(irr.E0num, "W m⁻²", 6), rd(irr.E0num, irr.E0ana));
            rowC("Collected power Φ_c", "view factor: " + fmt(E.Pcoll, "W", 6), "∫E(ρ)2πρ dρ: " + fmt(irr.PcollNum, "W", 6), rd(irr.PcollNum, E.Pcoll));
            rowC("Small-angle model", "Φ_c exact " + fmt(E.Pcoll, "W", 4), "L·A·π sin²θ₀ = " + fmt(E.PcollApprox, "W", 4), rd(E.PcollApprox, E.Pcoll));
        } else if (P.source === "point") {
            rowC("Collected power Φ_c", "I·2π(1 − cos θ₀) = " + fmt(E.Pcoll, "W", 6), "∫E(ρ)2πρ dρ: " + fmt(irr.PcollNum, "W", 6), rd(irr.PcollNum, E.Pcoll));
            rowC("Small-angle model", "Φ_c exact " + fmt(E.Pcoll, "W", 4), "I·π(D/2sₒ)² = " + fmt(E.PcollApprox, "W", 4), rd(E.PcollApprox, E.Pcoll));
        } else {
            rowC("Collected power Φ_c", "Φ₀(1 − e^(−2R²/w²)) = " + fmt(E.Pcoll, "W", 6), "∫E(ρ)2πρ dρ: " + fmt(irr.PcollNum, "W", 6), rd(irr.PcollNum, E.Pcoll));
            rowC("Beam radius at stop", "w(sₒ) = " + fmt(E.wLens, "m"), "D/2 = " + fmt(E.R, "m"), "R/w = " + (E.R / E.wLens).toFixed(3));
        }
        rowC("Counts formula", "η Φ_d t λ₀/(hc) = " + num(E.S, 6), "responsivity × Φ_d × t / q = " + num(E.responsivity * E.Pdet * P.t / core.constants.e, 6), rd(E.responsivity * E.Pdet * P.t / core.constants.e, E.S));


        const ub = $("#unitsBody");
        ub.textContent = "";
        const rowU = (q, s, m, v) => {
            const tr = document.createElement("tr");
            const th = document.createElement("th");
            th.scope = "row";
            th.textContent = q;
            tr.appendChild(th);
            cell(tr, s);
            cell(tr, m, "note");
            cell(tr, v);
            ub.appendChild(tr);
        };
        rowU("Radiant flux", "Φ, W", "power crossing a surface", "Φ_c = " + fmt(E.Pcoll, "W"));
        rowU("Irradiance", "E, W m⁻²", "power per receiving area", "E(stop centre) = " + fmt(E.Ecenter, "W m⁻²"));
        rowU("Radiant intensity", "I, W sr⁻¹", "power per solid angle from a (small) source", P.source === "laser" ? "far-field on-axis " + fmt(E.intensity, "W/sr") : fmt(E.intensity, "W/sr") + (P.source === "lambert" ? " (= L·A on axis)" : ""));
        rowU("Radiance", "L, W m⁻² sr⁻¹", "power per projected area per solid angle", P.source === "point" ? "undefined (zero-area source)" : fmt(E.radiance, "W m⁻² sr⁻¹") + (P.source === "laser" ? " (peak, 4Φn²/λ₀²)" : ""));
        rowU("Photon flux", "Φ_p, s⁻¹", "Φ λ₀/(hc)", num(E.photonRateDet, 4) + " /s on detector");
        rowU("Étendue", "G, m² sr", "n² A π sin²θ; throughput of the system", Number.isFinite(E.Gobj) ? num(E.Gobj, 4) + " m² sr" : "0 (ideal point)");


        const rb = $("#radianceBody");
        rb.textContent = "";
        if (E.ray) {
            const names = ["Object space (source)", "Inside the lens glass", "Image space (after filter)"];
            E.ray.forEach((r, i) => {
                const tr = document.createElement("tr");
                const th = document.createElement("th");
                th.scope = "row";
                th.textContent = names[i];
                tr.appendChild(th);
                cell(tr, r.n.toFixed(3));
                cell(tr, fmt(r.L, "W m⁻² sr⁻¹", 4));
                cell(tr, fmt(r.reduced, "W m⁻² sr⁻¹", 4));
                rb.appendChild(tr);
            });
            const tr = document.createElement("tr");
            const th = document.createElement("th");
            th.scope = "row";
            th.textContent = "Ratio (image / object) of L/n²";
            tr.appendChild(th);
            cell(tr, "");
            cell(tr, "");
            cell(tr, (E.ray[2].reduced / E.ray[0].reduced).toFixed(5) + " = T_lens T_f");
            rb.appendChild(tr);
        } else {
            const tr = document.createElement("tr");
            const td = document.createElement("td");
            td.colSpan = 4;
            td.textContent = "An ideal point source has no finite radiance (zero area); choose the disk or laser source.";
            tr.appendChild(td);
            rb.appendChild(tr);
        }
        setText("rGo", Number.isFinite(E.Gobj) ? num(E.Gobj, 4) + " m² sr" : "—");
        setText("rGi", Number.isFinite(E.Gimg) ? num(E.Gimg, 4) + " m² sr" : P.source === "laser" ? "λ₀²/4 (TEM₀₀)" : "—");
        setText("rEimg", Number.isFinite(E.Eimage) ? fmt(E.Eimage, "W m⁻²", 4) : "—");
        const Ebud = P.source === "lambert" && E.img.real ? E.Pcoll * E.Ttot / (Math.PI * E.imgRadius ** 2) : NaN;
        setText("rEbud", Number.isFinite(Ebud) ? fmt(Ebud, "W m⁻²", 4) : "—");
        setText("etendueNote", P.source === "lambert" && E.img.real ?
            "G_image/G_object = " + (E.Gimg / E.Gobj).toFixed(5) + " = (cos θᵢ/cos θ₀)² = " + ((Math.cos(E.thI) / Math.cos(E.thO)) ** 2).toFixed(5) + ". A paraxial thin lens conserves étendue only to first order in the angles; an aplanatic system (sine condition) conserves it exactly. The radiance-theorem irradiance E′ = T πL NAᵢ²/n₀² and the budget-based mean differ by the same kind of factor." :
            P.source === "laser" ? "A TEM₀₀ beam has the minimum étendue allowed by diffraction, G = λ₀²/4 (πw₀²/2 × πθ²/2 × n²), so its radiance 4Φn²/λ₀² is enormous." : "");


        const mb = $("#mcBody");
        mb.textContent = "";
        const st = MC.stats;
        const rowM = (q, th_, est, dev) => {
            const tr = document.createElement("tr");
            const th = document.createElement("th");
            th.scope = "row";
            th.textContent = q;
            tr.appendChild(th);
            cell(tr, th_);
            cell(tr, est);
            cell(tr, dev);
            mb.appendChild(tr);
        };
        const dig = MC.mean < 1e4 ? 4 : 6;
        rowM("Mean readout (e⁻)", num(MC.tMean, dig), num(st.mean, dig) + " ± " + num(st.sem, 2), (Math.abs(st.mean - MC.tMean) / st.sem).toFixed(2));
        rowM("Variance (e⁻²)", num(MC.tVar, dig), num(st.variance, dig) + " ± " + num(st.seVar, 2), Number.isFinite(st.seVar) && st.seVar > 0 ? (Math.abs(st.variance - MC.tVar) / st.seVar).toFixed(2) : "—");
        rowM("Physical noise σ (e⁻)", num(Math.sqrt(MC.tVar), 4), num(st.sd, 4), "does not shrink with N");
        rowM("Sampling error of the mean", "σ/√N = " + num(Math.sqrt(MC.tVar / MC.trials), 3), num(st.sem, 3), "shrinks as 1/√N");
        if (P.readNoise === 0 && P.idark === 0 && !MC.clipped) rowM("Fano factor var/mean", "1 (Poisson)", (st.variance / st.mean).toFixed(4), "");
        setText("mcNote", "Deviation / SE below about 2 means the Monte Carlo agrees with the theory within its own sampling error. " +
            "Physical noise σ = √(S + D + σ_r²) = " + num(MC.sigmaPhys, 4) + " e⁻ is what one real exposure shows; the standard error σ/√N is only the uncertainty of the estimate made from N = " + MC.trials + " simulated exposures (seed " + Math.round(S.seed) + ")." +
            (MC.clipped ? " The well clips part of the distribution, so theory values come from the clipped model distribution." : ""));
        setText("mcBadge", "seed " + Math.round(S.seed) + ", N = " + MC.trials + (MC.theory.approx ? ", normal approx." : ", exact theory"));


        setText("rV", E.V.toFixed(5));
        setText("rKv", (683 * E.V).toFixed(2) + " lm/W");
        setText("rLum", fmt(E.luminousDet, "lm"));
        setText("rLumC", fmt(RM.luminousFlux(E.Pcoll, P.lambda0), "lm"));
    }

    function updateReadouts() {
        setText("statNA", E.NAo.toFixed(4));
        setText("statPcoll", fmt(E.Pcoll, "W"));
        setText("statPdet", fmt(E.Pdet, "W"));
        setText("statS", num(E.S, 3));
        setText("statSNR", E.saturated ? "saturated" : num(E.snr, 3));
        setText("statRes", fmt(E.resObj, "m"));
        setText("rSi", E.img.real ? fmt(E.img.si, "m") : "virtual");
        setText("rM", E.img.real ? E.img.m.toFixed(4) : "—");
        setText("rNAi", E.img.real ? E.NAi.toFixed(4) : "—");
        setText("rResO", fmt(E.resObj, "m"));
        setText("rResI", fmt(E.resImg, "m"));
        setText("rImgR", fmt(E.imgRadius, "m"));
        setText("rResp", E.responsivity.toFixed(4) + " A/W");
        setText("rIph", fmt(E.photocurrent, "A"));

        const iw = $("#imgWarn");
        iw.hidden = E.img.real;
        iw.textContent = "sₒ ≤ n₀f: the lens forms no real image, so nothing is focused on the detector (the detector row is 0). Increase sₒ or shorten f.";
        const sw = $("#satWarn");
        sw.hidden = !E.saturated;
        sw.textContent = "Saturated: S + D = " + num(E.S + E.dark, 3) + " e⁻ exceeds the full well of " + num(P.fullWell, 3) + " e⁻. Readouts are clipped and the SNR formula no longer applies; shorten t or attenuate.";
        const nw = $("#naWarn");
        const bigNA = E.thO > 0.35 || (E.img.real && E.thI > 0.35);
        nw.hidden = !bigNA;
        nw.textContent = "Collection half-angle above 20°: the thin-lens imaging (tan-angles, no sine condition), uniform image and detector-fill estimates are rough. The aperture collection itself (view factor, Ω, Gaussian clip) stays exact.";
    }

    function updateDescriptions() {
        benchDesc.update(`${P.source === "lambert" ? "Lambertian disk of radius " + fmt(P.a, "m") : P.source === "point" ? "Point source" : "Laser waist " + fmt(P.w0, "m")} at ${fmt(P.so, "m")} from a ${fmt(P.D, "m")} stop and f = ${fmt(P.f, "m")} lens. Collection half-angle ${(E.thO * 180 / Math.PI).toFixed(2)} degrees, NA ${E.NAo.toFixed(4)}. ${E.img.real ? "Image at " + fmt(E.img.si, "m") + ", magnification " + E.img.m.toFixed(3) : "No real image"}. Emitted ${fmt(E.Pemit, "W")}, collected ${fmt(E.Pcoll, "W")}, on detector ${fmt(E.Pdet, "W")}.`);
        naDesc.update(`At NA ${E.NAo.toFixed(4)} the aperture collects ${pct(E.collectedFraction)} of the emitted power and the Rayleigh resolution is ${fmt(E.resObj, "m")}. Over the plotted range NA runs from ${naSweep[0].NA.toFixed(4)} to ${naSweep[naSweep.length - 1].NA.toFixed(3)}.`);
        irrDesc.update(`Irradiance at the stop centre ${fmt(irr.E0num, "W m⁻²")}; at the stop edge ${fmt(irr.ys[Math.min(irr.ys.length - 1, Math.round(E.R / irr.rhoMax * (irr.ys.length - 1)))], "W m⁻²")}. Integrated over the stop: ${fmt(irr.PcollNum, "W")} numerically versus ${fmt(E.Pcoll, "W")} analytically.`);
        histDesc.update(`${MC.trials} simulated exposures with seed ${Math.round(S.seed)}: sample mean ${num(MC.stats.mean, 5)} ± ${num(MC.stats.sem, 2)} e⁻, variance ${num(MC.stats.variance, 5)} ± ${num(MC.stats.seVar, 2)}. Theory mean ${num(MC.tMean, 5)}, variance ${num(MC.tVar, 5)}.`);
        snrDesc.update(`SNR ${num(E.snr, 3)} at the current setting (shot limit √S = ${num(Math.sqrt(E.S), 3)}). ${Number.isFinite(snrData.xCross) ? "Read-noise/shot-noise crossover at " + (snrData.byTime ? fmt(snrData.xCross, "s") : fmt(snrData.xCross, "W")) + "." : ""} ${Number.isFinite(snrData.xSat) ? "Well saturates at " + (snrData.byTime ? fmt(snrData.xSat, "s") : fmt(snrData.xSat, "W")) + "." : ""}`);
    }

    function render() {
        compute();
        updateLabels();
        updateReadouts();
        updateTables();
        bench.redraw();
        naCv.redraw();
        irrCv.redraw();
        histCv.redraw();
        snrCv.redraw();
        updateDescriptions();
    }

    ["bench", "na", "irradiance", "histogram", "snr"].forEach((n, i) => {
        [bench, naCv, irrCv, histCv, snrCv][i].canvas.dataset.exportName = n;
    });
    UI.addExportBar($("#exportHost"), {
        name: "radiometry",
        url,
        getState: () => ({
            settings: ctl.get(),
            SI: P,
            results: {
                Pemit_W: E.Pemit,
                Pcoll_W: E.Pcoll,
                Pdet_W: E.Pdet,
                NA_object: E.NAo,
                NA_image: E.NAi,
                signal_e: E.S,
                dark_e: E.dark,
                SNR: E.snr,
                resolution_object_m: E.resObj,
                etendue_object_m2sr: E.Gobj,
                mc: MC.stats
            }
        }),
        getCSV: () => ({
            headers: ["stage", "factor", "power (W)", "photon or electron rate (1/s)", "note"],
            rows: E.rows.map((r) => [r.stage, r.factor, r.power, r.photonRate, r.note])
                .concat([
                    ["mean signal electrons per exposure", "", "", E.S, "t = " + P.t + " s"],
                    ["SNR", "", "", E.snr, ""]
                ])
        }),
        canvases: [bench.canvas, naCv.canvas, irrCv.canvas, histCv.canvas, snrCv.canvas],
        caption: () => `radiometry: ${S.src}, λ0 = ${S.lam} nm, D = ${S.D} mm, so = ${S.so} mm, t = ${fmt(P.t, "s")}, seed ${Math.round(S.seed)}`
    });

    render();
    url.ready.then(() => schedule());
})();