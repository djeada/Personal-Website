(function() {
    "use strict";
    const UI = window.OpticsUI;
    const core = window.OpticsModels.core;
    const res = window.OpticsModels.resonator;
    const PAL = UI.CANVAS_PALETTE;
    const $ = (id) => document.getElementById(id);
    const fmt = (v, u, d = 3) => core.formatSI(v, u, d);
    const fixed = (v, d) => (Number.isFinite(v) ? v.toFixed(d) : "—");


    const DEFAULTS = {
        R1: 99,
        R2: 99,
        rc1: 200,
        rc2: 200,
        f1: false,
        f2: false,
        L: 100,
        n: 1,
        loss: 0,
        disp: false,
        ng: 1,
        lam: 1064,
        det: 0,
        zoom: false,
        log: false,
        ord: "3",
        zwin: "m2"
    };
    const PRESETS = {
        etalon: {
            v: {
                R1: 90,
                R2: 90,
                f1: true,
                f2: true,
                L: 10,
                n: 1,
                loss: 0
            },
            note: "Planar, lossless, R = 90 %: expect T = 1 on resonance, R + T = 1 everywhere, 𝓕 ≈ 29.8 and Δν ≈ 503 MHz (FSR 14.99 GHz)."
        },
        worked: {
            v: {},
            note: "Worked example: FSR 1.499 GHz, 𝓕 = 312.6, Δν = 4.80 MHz, τₚ = 33.2 ns, ψ = 60° so TEMmn repeat every 3 orders; w₀ = 171 µm."
        },
        ringdown: {
            v: {
                R1: 99.95,
                R2: 99.95,
                rc1: 1000,
                rc2: 1000,
                L: 500,
                log: true
            },
            note: "S = 0.9990: the ring-down is a straight line on the log axis with 1/e time τₚ ≈ 3.33 µs; Δν ≈ 47.7 kHz and 2πτₚΔν = 1."
        },
        mismatch: {
            v: {
                R1: 90,
                R2: 99,
                f1: true,
                f2: true,
                L: 50
            },
            note: "Unequal mirrors, no loss: T on resonance drops to (1−R₁)(1−R₂)/(1−√(R₁R₂))² ≈ 0.318 and R ≈ 0.682, but the finesse is set by √(R₁R₂)."
        },
        critical: {
            v: {
                R1: 95.08,
                R2: 99,
                loss: 2,
                f1: true,
                f2: true,
                L: 50
            },
            note: "R₁ = R₂(1−ℓ)² (critical coupling): reflection vanishes on resonance; ≈ 80 % of the power is absorbed and ≈ 20 % transmitted."
        },
        glass: {
            v: {
                R1: 4,
                R2: 4,
                f1: true,
                f2: true,
                L: 1,
                n: 1.5
            },
            note: "Uncoated 1 mm glass plate (Fresnel R = 4 %): shallow fringes between T = 0.85 and 1; ρ < 0.17 so the finesse is undefined (no half-maximum)."
        },
        confocal: {
            v: {
                rc1: 100,
                rc2: 100,
                L: 100
            },
            note: "Symmetric confocal (g₁ = g₂ = 0, marginal): ψ = 90°, odd transverse orders sit half-way between longitudinal modes, even ones coincide."
        },
        concentric: {
            v: {
                rc1: 50.5,
                rc2: 50.5,
                L: 100
            },
            note: "Near-concentric (g ≈ −0.98): tiny waist (≈ 41 µm) but large spots on the mirrors; the transverse spacing approaches a full FSR."
        },
        halfsym: {
            v: {
                R2: 95,
                f1: true,
                rc2: 250,
                L: 100
            },
            note: "Flat input mirror + 250 mm output: the waist sits on the flat mirror, g₁ = 1, g₂ = 0.6, ψ = arccos√0.6 = 39.2°."
        },
        unstable: {
            v: {
                rc1: 40,
                rc2: 40,
                L: 100
            },
            note: "g₁ = g₂ = −1.5: |(A+D)/2| = 3.5 > 1, no self-consistent Gaussian mode. The spectrum falls back to the plane-wave Airy function."
        },
        dispersive: {
            v: {
                R1: 95,
                R2: 95,
                f1: true,
                f2: true,
                L: 10,
                n: 1.45,
                disp: true,
                ng: 1.47
            },
            note: "Dispersive fill: FSR = c/(2n_gL) = 10.20 GHz, not c/(2nL) = 10.34 GHz. The phase index still fixes the order q."
        }
    };


    const sidebar = document.querySelector(".options-sidebar");
    UI.enhanceAllSliders(sidebar, {
        R1Slider: {
            unit: "%"
        },
        R2Slider: {
            unit: "%"
        },
        LSlider: {
            unit: "mm"
        },
        lossSlider: {
            unit: "%"
        },
        lamSlider: {
            unit: "nm"
        },
        detSlider: {
            unit: "FSR"
        }
    });
    let renderPending = false;
    let url = null;
    const ctl = UI.bindControls({
        R1: "#R1Slider",
        R2: "#R2Slider",
        rc1: "#Rc1Input",
        rc2: "#Rc2Input",
        f1: "#flat1Box",
        f2: "#flat2Box",
        L: "#LSlider",
        n: "#nSlider",
        loss: "#lossSlider",
        disp: "#dispBox",
        ng: "#ngSlider",
        lam: "#lamSlider",
        det: "#detSlider",
        zoom: "#zoomBox",
        log: "#logBox",
        ord: "#orderSelect",
        zwin: "radio:zwin"
    }, () => {
        if (url) url.update();
        clearPresetMark();
        scheduleRender();
    });

    function scheduleRender() {
        if (renderPending) return;
        renderPending = true;
        requestAnimationFrame(() => {
            renderPending = false;
            render();
        });
    }

    let presetApplying = false;

    function clearPresetMark() {
        if (presetApplying) return;
        document.querySelectorAll("#presetButtons .preset-option.active").forEach((b) => b.classList.remove("active"));
    }

    function applyPreset(key) {
        const p = PRESETS[key];
        presetApplying = true;
        ctl.set(Object.assign({}, DEFAULTS, p.v));
        presetApplying = false;
        document.querySelectorAll("#presetButtons .preset-option").forEach((b) => b.classList.toggle("active", b.dataset.preset === key));
        $("presetNote").textContent = p.note;
        scheduleRender();
    }
    document.querySelectorAll("#presetButtons .preset-option").forEach((b) => b.addEventListener("click", () => applyPreset(b.dataset.preset)));
    $("resetBtn").addEventListener("click", () => {
        ctl.set(DEFAULTS);
        phase = 0;
        loop.stop();
        $("presetNote").textContent = "Reset to the worked-example cavity.";
        scheduleRender();
    });


    let S = null;
    let lastValid = {
        rc1: DEFAULTS.rc1,
        rc2: DEFAULTS.rc2
    };

    function readRadius(key, flatKey, v) {
        const el = $(key === "rc1" ? "Rc1Input" : "Rc2Input");
        el.disabled = !!v[flatKey];
        if (v[flatKey]) {
            el.removeAttribute("aria-invalid");
            return Infinity;
        }
        const mm = Number(v[key]);
        if (!Number.isFinite(mm) || Math.abs(mm) < 0.5) {
            el.setAttribute("aria-invalid", "true");
            return lastValid[key] / 1000;
        }
        el.removeAttribute("aria-invalid");
        lastValid[key] = mm;
        return mm / 1000;
    }

    function pickUnit(spanHz) {
        if (spanHz >= 2e9) return {
            s: 1e9,
            u: "GHz"
        };
        if (spanHz >= 2e6) return {
            s: 1e6,
            u: "MHz"
        };
        if (spanHz >= 2e3) return {
            s: 1e3,
            u: "kHz"
        };
        return {
            s: 1,
            u: "Hz"
        };
    }

    function pickTimeUnit(t) {
        if (t >= 2e-3) return {
            s: 1e-3,
            u: "ms"
        };
        if (t >= 2e-6) return {
            s: 1e-6,
            u: "µs"
        };
        if (t >= 2e-9) return {
            s: 1e-9,
            u: "ns"
        };
        return {
            s: 1e-12,
            u: "ps"
        };
    }


    function decimate(xs, ys, maxPts) {
        const n = xs.length;
        if (n <= maxPts) return {
            xs: Array.from(xs),
            ys: Array.from(ys)
        };
        const bins = Math.floor(maxPts / 2),
            ox = [],
            oy = [];
        for (let b = 0; b < bins; b++) {
            const i0 = Math.floor(b * n / bins),
                i1 = Math.floor((b + 1) * n / bins);
            let iMin = i0,
                iMax = i0;
            for (let i = i0; i < i1; i++) {
                if (ys[i] < ys[iMin]) iMin = i;
                if (ys[i] > ys[iMax]) iMax = i;
            }
            const [a, c] = iMin < iMax ? [iMin, iMax] : [iMax, iMin];
            ox.push(xs[a], xs[c]);
            oy.push(ys[a], ys[c]);
        }
        return {
            xs: ox,
            ys: oy
        };
    }

    function compute() {
        const v = ctl.get();
        const Rc1 = readRadius("rc1", "f1", v),
            Rc2 = readRadius("rc2", "f2", v);
        const L = v.L * 1e-3;
        $("ngGroup").hidden = !v.disp;
        const p = {
            R1: v.R1 / 100,
            R2: v.R2 / 100,
            loss: v.loss / 100,
            L,
            n: v.n,
            ng: v.disp ? v.ng : v.n,
            lambda0: v.lam * 1e-9,
            Rc1,
            Rc2
        };
        const cav = res.cavity(p);
        const nuProbe = cav.nuRes + v.det * cav.fsr;
        const probe = res.response(cav, nuProbe);
        const maxOrd = Number(v.ord) || 0;


        let lo, hi, zoomed = false;
        if (v.zoom && Number.isFinite(cav.fwhm)) {
            const center = cav.nuRes + Math.round(v.det) * cav.fsr;
            lo = center - 4 * cav.fwhm;
            hi = center + 4 * cav.fwhm;
            zoomed = true;
        } else {
            lo = cav.nuRes - 0.5 * cav.fsr;
            hi = cav.nuRes + 1.5 * cav.fsr;
        }
        const unit = pickUnit(hi - lo);
        const nus = zoomed ? core.linspace(lo, hi, 801) : res.adaptiveGrid(cav, lo, hi);
        const sp = res.spectrum(cav, nus);
        const xs = Array.from(nus, (nu) => (nu - cav.nuRes) / unit.s);


        const perTau = Number.isFinite(cav.tauP) && cav.tauP > 0 ? cav.tauP / cav.Trt : 1;
        const nOn = Math.max(30, Math.min(200000, Math.ceil(8 * perTau)));
        const tr = res.timeResponse(cav, nuProbe, nOn, nOn);

        let fitTau = NaN;
        {
            const nFit = Math.max(3, Math.min(nOn, Math.ceil(3 * perTau)));
            let sx = 0,
                sy = 0,
                sxx = 0,
                sxy = 0,
                k = 0;
            for (let j = 0; j < nFit; j++) {
                const i = nOn + j,
                    pc = tr.Pc[i];
                if (!(pc > 0)) break;
                const x = tr.t[i],
                    y = Math.log(pc);
                sx += x;
                sy += y;
                sxx += x * x;
                sxy += x * y;
                k++;
            }
            if (k >= 3) {
                const slope = (k * sxy - sx * sy) / (k * sxx - sx * sx);
                fitTau = -1 / slope;
            }
        }

        S = {
            v,
            p,
            cav,
            nuProbe,
            probe,
            maxOrd,
            lo,
            hi,
            zoomed,
            unit,
            nus,
            sp,
            xs,
            tr,
            nOn,
            fitTau
        };
    }


    function updateReadouts() {
        const {
            v,
            cav,
            probe,
            fitTau
        } = S;
        const md = cav.mode;
        const set = (id, t) => {
            const el = $(id);
            if (el.textContent !== t) el.textContent = t;
        };
        set("R1Value", v.R1.toFixed(2) + " %");
        set("R2Value", v.R2.toFixed(2) + " %");
        set("LValue", v.L.toFixed(1) + " mm");
        set("nValue", v.n.toFixed(3));
        set("ngValue", (v.disp ? v.ng : v.n).toFixed(3));
        set("lossValue", v.loss.toFixed(2) + " %");
        set("lamValue", v.lam + " nm");
        set("detValue", v.det.toFixed(6));
        set("g1Value", "g₁ = " + fixed(md.g1, 3));
        set("g2Value", "g₂ = " + fixed(md.g2, 3));

        set("statFSR", fmt(cav.fsr, "Hz"));
        set("statFWHM", fmt(cav.fwhm, "Hz"));
        set("statFinesse", Number.isFinite(cav.finesse) ? cav.finesse.toPrecision(4) : "undef.");
        set("statTau", fmt(cav.tauP, "s"));
        set("statStab", fixed(md.g1 * md.g2, 3) + " · " + md.status);
        set("statW0", Number.isFinite(md.w0) ? fmt(md.w0, "m") : "no mode");

        set("rFSR", fmt(cav.fsr, "Hz", 5));
        set("rTrt", fmt(cav.Trt, "s", 4));
        set("rS", cav.S.toFixed(6));
        set("rF", Number.isFinite(cav.finesse) ? cav.finesse.toPrecision(6) : "undefined (ρ < 0.172)");
        set("rFa", Number.isFinite(cav.finesseApprox) ? cav.finesseApprox.toPrecision(6) : "—");
        set("rCF", cav.coefF.toPrecision(5));
        set("rFWHM", fmt(cav.fwhm, "Hz", 4));
        set("rTau", fmt(cav.tauP, "s", 4));
        set("rTauFit", fmt(fitTau, "s", 4));
        set("rProd", Number.isFinite(cav.fwhm) ? (2 * Math.PI * cav.tauP * cav.fwhm).toFixed(4) : "—");
        set("rQ", Number.isFinite(cav.Q) ? cav.Q.toExponential(3) : "—");
        set("rTmax", cav.Tmax.toFixed(4));
        set("rRmin", cav.Rmin.toFixed(4));
        set("rLoss", cav.lossOnRes.toFixed(4));
        set("rBuild", cav.buildup.toPrecision(4) + " ×");
        set("rProbe", probe.T.toFixed(4) + ", " + probe.R.toFixed(4));
        set("rQord", String(cav.q0));
        set("rNu", fmt(cav.nuRes, "Hz", 7) + " (" + fmt(core.constants.c / cav.nuRes, "m", 6) + ")");
        set("rG", fixed(md.g1, 4) + ", " + fixed(md.g2, 4));
        set("rM", fixed(md.m, 4) + " (" + md.status + ")");
        set("rGouy", Number.isFinite(md.gouy) ? (md.gouy * 180 / Math.PI).toFixed(3) + "°" : "— (unstable)");
        set("rDT", md.status === "unstable" ? "— (unstable)" : cav.psi ? fmt(cav.fsr * cav.psi / Math.PI, "Hz", 4) : "0 (degenerate)");
        set("rW0", Number.isFinite(md.w0) ? fmt(md.w0, "m") + " at " + fmt(Math.abs(md.zWaist) < 1e-15 ? 0 : md.zWaist, "m") : "—");
        set("rW12", Number.isFinite(md.w1) ? fmt(md.w1, "m") + ", " + fmt(md.w2, "m") : "—");
        set("rZR", Number.isFinite(md.zR) ? fmt(md.zR, "m") : "—");


        const warn = $("stabWarn");
        const msgs = [];
        if (md.status === "unstable") msgs.push("Unstable resonator: |(A + D)/2| = " + Math.abs(md.m).toFixed(3) + " > 1, so no self-consistent Gaussian mode exists. The spectrum shows the plane-wave Airy idealisation and transverse modes are undefined.");
        else if (md.status === "marginal") msgs.push("Marginally stable (|(A + D)/2| = 1): " + (md.boundary.label || "boundary") + ". " + md.boundary.note);
        if (!Number.isFinite(cav.finesse)) msgs.push("ρ = " + cav.rho.toFixed(3) + " < 3 − 2√2 ≈ 0.172: the Airy peaks never drop to half their height, so the FWHM, finesse and Q are undefined.");
        warn.hidden = msgs.length === 0;
        warn.textContent = msgs.join(" ");
        $("boundaryNote").textContent = md.status === "stable" ?
            "Stable interior: ψ = arccos(" + (md.g1 < 0 ? "−" : "+") + "√(g₁g₂)) = " + (md.gouy * 180 / Math.PI).toFixed(2) + "°; ray matrix gives the same value as the propagated beam (" + (md.gouyPropagated * 180 / Math.PI).toFixed(2) + "°)." :
            (md.boundary.note || (md.status === "unstable" ? "Outside the stable region: rays walk off after a few round trips." : ""));


        const tb = document.querySelector("#modeTable tbody");
        const rows = [];
        for (let N = 0; N <= S.maxOrd; N++) {
            if (md.status === "unstable") {
                rows.push(`<tr><td>${N}</td><td>—</td><td>—</td><td>${N + 1}</td></tr>`);
                continue;
            }
            const d = res.resonanceFrequency(cav, cav.q0, N) - cav.nuRes;
            let frac = d / cav.fsr;
            frac -= Math.floor(frac + 1e-9);
            rows.push(`<tr><td>${N}</td><td>${fmt(d, "Hz", 4)}</td><td>${frac.toFixed(4)}</td><td>${N + 1}</td></tr>`);
        }
        tb.innerHTML = rows.join("");
    }


    function noteText(ctx, map, text) {
        const P = map.plot;
        ctx.save();
        ctx.font = "13px " + PAL.font;
        ctx.fillStyle = PAL.warning;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, P.x + P.w / 2, P.y + P.h / 2);
        ctx.restore();
    }

    function arrow(ctx, x0, x1, y, color, label) {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x0, y);
        ctx.lineTo(x1, y);
        ctx.stroke();
        const head = (x, dir) => {
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x - dir * 7, y - 4);
            ctx.lineTo(x - dir * 7, y + 4);
            ctx.closePath();
            ctx.fill();
        };
        head(x1, Math.sign(x1 - x0) || 1);
        head(x0, -(Math.sign(x1 - x0) || 1));
        if (label) {
            ctx.font = "12px " + PAL.font;
            ctx.textAlign = "center";
            ctx.textBaseline = "bottom";
            const tw = ctx.measureText(label).width;
            ctx.fillStyle = "rgba(7,7,13,0.8)";
            ctx.fillRect((x0 + x1) / 2 - tw / 2 - 3, y - 18, tw + 6, 15);
            ctx.fillStyle = color;
            ctx.fillText(label, (x0 + x1) / 2, y - 4);
        }
        ctx.restore();
    }
    const small = (w) => w < 520;


    let beamMap;

    function drawBeam(ctx, w, h) {
        const {
            cav
        } = S, md = cav.mode, L = cav.L;
        const Lmm = L * 1e3;
        const zs = core.linspace(0, L, 241);
        let series = [],
            ymax = 1;
        const bound = Number.isFinite(md.w0);
        if (bound) {
            const ws = Array.from(zs, (z) => res.beamRadius(md, z) * 1e6);
            ymax = Math.max(...ws) * 1.35;
            const zmm = Array.from(zs, (z) => z * 1e3);
            series = [{
                    xs: zmm,
                    ys: ws,
                    color: PAL.series[0],
                    fill: true,
                    label: "+w(z)"
                },
                {
                    xs: zmm,
                    ys: ws.map((x) => -x),
                    color: PAL.series[0],
                    fill: false
                }
            ];
        }
        const pad = 0.08 * Lmm;
        beamMap = UI.plot(ctx, {
            x: 0,
            y: 0,
            w,
            h
        }, {
            x: {
                min: -pad,
                max: Lmm + pad,
                label: "z (from mirror 1)",
                unit: "mm"
            },
            y: {
                min: -ymax,
                max: ymax,
                label: bound ? "radius" : "radius (no mode)",
                unit: bound ? "µm" : ""
            },
            series,
            legend: false,
            fontSize: small(w) ? 11 : 12,
            markers: bound ? [{
                x: md.zWaist * 1e3,
                label: "waist w₀ = " + fmt(md.w0, "m"),
                color: PAL.marker
            }] : []
        });
        const P = beamMap.plot;

        ctx.save();
        ctx.strokeStyle = PAL.gridStrong;
        ctx.setLineDash([6, 4]);
        const y0 = beamMap.yToPx(0);
        ctx.beginPath();
        ctx.moveTo(P.x, y0);
        ctx.lineTo(P.x + P.w, y0);
        ctx.stroke();
        ctx.setLineDash([]);

        const drawMirror = (zmm, Rc, dirIn, label, R) => {
            const x = beamMap.xToPx(zmm);
            const half = P.h * 0.42;
            const curv = Number.isFinite(Rc) ? Math.max(-1, Math.min(1, L / Rc)) : 0;
            const sag = 14 * curv * dirIn;
            ctx.strokeStyle = "#c9d4ff";
            ctx.lineWidth = 5;
            ctx.lineCap = "round";
            ctx.beginPath();
            for (let i = 0; i <= 30; i++) {
                const u = -1 + 2 * i / 30;
                const px = x + sag * u * u,
                    py = y0 + u * half;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.stroke();
            ctx.font = "12px " + PAL.font;
            ctx.fillStyle = PAL.text;
            ctx.textBaseline = "top";
            ctx.textAlign = dirIn > 0 ? "left" : "right";
            ctx.fillText(label + "  R = " + (R * 100).toFixed(2) + " %", x + dirIn * 8, P.y + 4);
            ctx.fillStyle = PAL.textMuted;
            ctx.fillText(Number.isFinite(Rc) ? "Rc = " + fmt(Rc, "m") : "planar", x + dirIn * 8, P.y + 20);
        };
        drawMirror(0, S.p.Rc1, 1, "M1", cav.R1);
        drawMirror(Lmm, S.p.Rc2, -1, "M2", cav.R2);
        ctx.restore();
        if (!bound) noteText(ctx, beamMap, md.status === "unstable" ? "Unstable: no self-consistent Gaussian mode" : "Marginal (" + (md.boundary.label || "boundary") + "): no finite Gaussian mode");
    }


    let specMap;

    function drawSpectrum(ctx, w, h) {
        const {
            cav,
            sp,
            xs,
            unit,
            lo,
            hi,
            v,
            probe,
            nuProbe,
            zoomed
        } = S;
        const log = v.log;
        let yMin = 0,
            yMax = 1.05;
        if (log) {
            let m = Infinity;
            for (let i = 0; i < sp.T.length; i++)
                if (sp.T[i] > 0) m = Math.min(m, sp.T[i]);
            yMin = Math.max(1e-10, Math.min(0.1, m * 0.5));
            yMax = 1.5;
        }
        const markers = [];
        for (let k = -1; k <= 2; k++) {
            const nu = cav.nuRes + k * cav.fsr;
            if (nu >= lo && nu <= hi) markers.push({
                x: (nu - cav.nuRes) / unit.s,
                label: k === 0 ? "q = " + cav.q0 : "q " + (k > 0 ? "+ " : "− ") + Math.abs(k),
                color: PAL.gridStrong,
                dash: [3, 4]
            });
        }
        const series = [{
                xs,
                ys: Array.from(sp.T),
                label: "T",
                color: PAL.series[0],
                width: 2.2
            },
            {
                xs,
                ys: Array.from(sp.R),
                label: "R",
                color: PAL.series[1],
                dash: [7, 4]
            }
        ];
        if (cav.A < 1) series.push({
            xs,
            ys: Array.from(sp.loss),
            label: "loss 1−R−T",
            color: PAL.series[2],
            dash: [2, 3]
        });
        specMap = UI.plot(ctx, {
            x: 0,
            y: 0,
            w,
            h
        }, {
            x: {
                min: (lo - cav.nuRes) / unit.s,
                max: (hi - cav.nuRes) / unit.s,
                label: "ν − ν_q,00",
                unit: unit.u
            },
            y: {
                min: yMin,
                max: yMax,
                label: "power / input",
                log
            },
            series,
            markers,
            fontSize: small(w) ? 11 : 12,
            hlines: Number.isFinite(cav.fwhm) ? [{
                y: cav.Tmax / 2,
                color: "rgba(105,245,231,0.45)"
            }] : [],
            cursor: {
                x: (nuProbe - cav.nuRes) / unit.s,
                label: "T " + probe.T.toFixed(3) + "  R " + probe.R.toFixed(3)
            }
        });

        const yA = log ? specMap.yToPx(Math.sqrt(cav.Tmax / 2 * yMax)) : specMap.yToPx(Math.min(0.8, cav.Tmax * 0.75));
        if (!zoomed) {
            const x0 = specMap.xToPx(0),
                x1 = specMap.xToPx(cav.fsr / unit.s);
            arrow(ctx, x0, x1, yA, PAL.marker, "FSR = " + fmt(cav.fsr, "Hz", 4));
        } else {
            const c0 = cav.nuRes + Math.round(v.det) * cav.fsr;
            const x0 = specMap.xToPx((c0 - cav.fwhm / 2 - cav.nuRes) / unit.s),
                x1 = specMap.xToPx((c0 + cav.fwhm / 2 - cav.nuRes) / unit.s);
            arrow(ctx, x0, x1, specMap.yToPx(log ? cav.Tmax / 2 : cav.Tmax / 2), PAL.marker, "Δν = " + fmt(cav.fwhm, "Hz", 4));
        }
    }


    let combMap;

    function drawComb(ctx, w, h) {
        const {
            cav,
            lo,
            hi,
            unit,
            maxOrd
        } = S;
        const md = cav.mode;
        const ticks = [];
        for (let N = 0; N <= maxOrd; N++) ticks.push(N);
        ticks.step = 1;
        combMap = UI.plot(ctx, {
            x: 0,
            y: 0,
            w,
            h
        }, {
            x: {
                min: (lo - cav.nuRes) / unit.s,
                max: (hi - cav.nuRes) / unit.s,
                label: "ν − ν_q,00",
                unit: unit.u
            },
            y: {
                min: -0.6,
                max: maxOrd + 0.6,
                label: "m + n",
                ticks,
                format: (x) => String(x)
            },
            series: [],
            legend: false,
            fontSize: small(w) ? 11 : 12
        });
        const P = combMap.plot;
        ctx.save();
        ctx.beginPath();
        ctx.rect(P.x, P.y, P.w, P.h);
        ctx.clip();

        ctx.strokeStyle = PAL.gridStrong;
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1;
        for (let k = -2; k <= 3; k++) {
            const x = combMap.xToPx((k * cav.fsr) / unit.s);
            ctx.beginPath();
            ctx.moveTo(x, P.y);
            ctx.lineTo(x, P.y + P.h);
            ctx.stroke();
        }
        ctx.setLineDash([]);
        if (md.status !== "unstable") {
            const list = res.modeComb(cav, lo, hi, maxOrd);
            const wpx = Number.isFinite(cav.fwhm) ? Math.max(2, Math.abs(combMap.xToPx(cav.fwhm / unit.s) - combMap.xToPx(0))) : 2;
            for (const m of list) {
                const x = combMap.xToPx((m.nu - cav.nuRes) / unit.s),
                    y = combMap.yToPx(m.N);
                const half = Math.max(6, (combMap.yToPx(0) - combMap.yToPx(1)) * 0.36 || 8);
                ctx.fillStyle = PAL.series[m.N % PAL.series.length];
                ctx.fillRect(x - wpx / 2, y - half, wpx, 2 * half);
                if (P.w > 420 || m.N === 0) {
                    ctx.font = "11px " + PAL.font;
                    ctx.textAlign = "left";
                    ctx.textBaseline = "middle";
                    ctx.fillText(m.N === 0 ? "q=" + m.q : "", x + wpx / 2 + 3, y);
                }
            }
        }
        ctx.restore();
        if (md.status === "unstable") noteText(ctx, combMap, "Unstable: transverse modes are not defined");
        else if (!cav.psi && maxOrd > 0) {
            ctx.save();
            ctx.font = "12px " + PAL.font;
            ctx.fillStyle = PAL.warning;
            ctx.textAlign = "right";
            ctx.textBaseline = "top";
            ctx.fillText("ψ = 0: all orders degenerate", P.x + P.w - 6, P.y + 4);
            ctx.restore();
        }
    }


    let phase = 0;
    let fieldCache = null;

    function fieldData() {
        const key = [S.cav.L, S.cav.R1, S.cav.R2, S.cav.A, S.cav.n, S.cav.ng, S.cav.lambda0, S.nuProbe, S.cav.psi, S.v.zwin].join("|");
        if (fieldCache && fieldCache.key === key) return fieldCache;
        const {
            cav,
            nuProbe
        } = S;
        const L = cav.L;
        const zsFull = core.linspace(0, L, 401);
        const full = res.intracavityField(cav, nuProbe, zsFull);
        const lamM = cav.lambda0 / cav.n;
        let a, b, ref, label;
        if (S.v.zwin === "m1") {
            a = -0.35 * lamM;
            b = 3 * lamM;
            ref = 0;
            label = "z (from mirror 1)";
        } else if (S.v.zwin === "mid") {
            a = L / 2 - 1.5 * lamM;
            b = L / 2 + 1.5 * lamM;
            ref = L / 2;
            label = "z − L/2";
        } else {
            a = L - 3 * lamM;
            b = L + 0.35 * lamM;
            ref = L;
            label = "z − L";
        }
        const nz = 601,
            zs = core.linspace(a, b, nz);
        const inside = Array.from(zs, (z) => z >= 0 && z <= L);
        const zf = Float64Array.from(zs, (z) => Math.min(L, Math.max(0, z)));
        const zoom = res.intracavityField(cav, nuProbe, zf);

        let iMax = 0;
        for (let i = 0; i < nz; i++)
            if (inside[i] && zoom.abs2[i] > zoom.abs2[iMax]) iMax = i;
        const phRef = Math.atan2(zoom.im[iMax], zoom.re[iMax]);
        fieldCache = {
            key,
            zsFull,
            full,
            zs,
            zoom,
            inside,
            ref,
            label,
            a,
            b,
            phRef
        };
        return fieldCache;
    }

    function drawField(ctx, w, h) {
        const f = fieldData();
        const {
            cav
        } = S;
        const fs = small(w) ? 11 : 12;
        const hTop = Math.round(h * 0.44);
        const zmm = Array.from(f.zsFull, (z) => z * 1e3);
        const mean = Array.from(f.full.fwd2, (x, i) => x + f.full.bwd2[i]);
        let top = 0;
        for (const x of f.full.envMax) top = Math.max(top, x);
        const m1 = UI.plot(ctx, {
            x: 0,
            y: 0,
            w,
            h: hTop
        }, {
            x: {
                min: 0,
                max: cav.L * 1e3,
                label: "z",
                unit: "mm"
            },
            y: {
                min: 0,
                max: top * 1.08 || 1,
                label: "|E|²/|E_in|²"
            },
            series: [{
                    xs: zmm,
                    ys: Array.from(f.full.envMax),
                    label: "max",
                    color: PAL.series[0],
                    fill: true
                },
                {
                    xs: zmm,
                    ys: Array.from(f.full.envMin),
                    label: "min",
                    color: PAL.series[3],
                    dash: [7, 4]
                },
                {
                    xs: zmm,
                    ys: mean,
                    label: "|E₊|²+|E₋|²",
                    color: PAL.series[1],
                    dash: [2, 3]
                }
            ],
            fontSize: fs,
            margin: {
                b: fs * 3.0
            }
        });

        const za = Math.max(0, f.a) * 1e3,
            zb = Math.min(cav.L, f.b) * 1e3;
        ctx.save();
        ctx.fillStyle = "rgba(248,212,119,0.35)";
        const xa = m1.xToPx(za),
            xb = Math.max(xa + 3, m1.xToPx(zb));
        ctx.fillRect(xa - 1, m1.plot.y, xb - xa + 2, m1.plot.h);
        ctx.restore();


        const um = Array.from(f.zs, (z) => (z - f.ref) * 1e6);
        const mag = [],
            neg = [],
            inst = [];
        const c = Math.cos(phase + f.phRef),
            s = Math.sin(phase + f.phRef);
        for (let i = 0; i < f.zs.length; i++) {
            if (!f.inside[i]) {
                mag.push(NaN);
                neg.push(NaN);
                inst.push(NaN);
                continue;
            }
            const re = f.zoom.re[i],
                im = f.zoom.im[i];
            const a = Math.hypot(re, im);
            mag.push(a);
            neg.push(-a);
            inst.push(re * c + im * s);
        }
        let ym = 0;
        for (const x of mag)
            if (Number.isFinite(x)) ym = Math.max(ym, x);
        ym = ym * 1.12 || 1;
        const m2 = UI.plot(ctx, {
            x: 0,
            y: hTop,
            w,
            h: h - hTop
        }, {
            x: {
                min: um[0],
                max: um[um.length - 1],
                label: f.label,
                unit: "µm"
            },
            y: {
                min: -ym,
                max: ym,
                label: "E/E_in"
            },
            series: [{
                    xs: um,
                    ys: mag,
                    label: "±|E|",
                    color: PAL.series[0]
                },
                {
                    xs: um,
                    ys: neg,
                    color: PAL.series[0]
                },
                {
                    xs: um,
                    ys: inst,
                    label: "Re{E e^−iωt}",
                    color: PAL.series[2],
                    dash: [6, 3],
                    width: 1.8
                }
            ],
            fontSize: fs,
            legendPosition: S.v.zwin === "m1" ? "right" : "left"
        });

        ctx.save();
        const P = m2.plot;
        ctx.beginPath();
        ctx.rect(P.x, P.y, P.w, P.h);
        ctx.clip();
        ctx.fillStyle = "rgba(201,212,255,0.28)";
        if (f.a < 0) {
            const x = m2.xToPx((0 - f.ref) * 1e6);
            ctx.fillRect(P.x, P.y, x - P.x, P.h);
        }
        if (f.b > cav.L) {
            const x = m2.xToPx((cav.L - f.ref) * 1e6);
            ctx.fillRect(x, P.y, P.x + P.w - x, P.h);
        }
        ctx.restore();
    }


    let timeMap;

    function drawTime(ctx, w, h) {
        const {
            cav,
            tr,
            nOn,
            v
        } = S;
        const tEnd = tr.t[tr.t.length - 1];
        const tu = pickTimeUnit(tEnd);
        const tx = Array.from(tr.t, (t) => t / tu.s);
        const dec = decimate(tx, tr.Pt, 2400);
        const tOff = cav.Trt * nOn;
        const Ps = tr.Pt[nOn - 1],
            tLast = tr.t[nOn - 1];
        const refX = [],
            refY = [];
        for (let i = 0; i <= 200; i++) {
            const t = tLast + (tEnd - tLast) * i / 200;
            refX.push(t / tu.s);
            refY.push(Ps * Math.exp(-(t - tLast) / cav.tauP));
        }
        let ymax = 0;
        for (const y of tr.Pt) ymax = Math.max(ymax, y);
        const log = v.log;
        const ymin = log ? Math.max(1e-12, ymax * 1e-5) : 0;
        timeMap = UI.plot(ctx, {
            x: 0,
            y: 0,
            w,
            h
        }, {
            x: {
                min: 0,
                max: tEnd / tu.s,
                label: "t",
                unit: tu.u
            },
            y: {
                min: ymin,
                max: log ? ymax * 2 : ymax * 1.1 || 1,
                label: "P_t / P_in",
                log
            },
            series: [{
                    xs: dec.xs,
                    ys: dec.ys,
                    label: "transmitted (round-trip sum)",
                    color: PAL.series[0]
                },
                {
                    xs: refX,
                    ys: refY,
                    label: "e^(−t/τp)",
                    color: PAL.series[1],
                    dash: [7, 4]
                }
            ],
            markers: [{
                x: tOff / tu.s,
                label: "input off",
                color: PAL.gridStrong
            }, {
                x: (tOff + cav.tauP) / tu.s,
                label: "+τp",
                color: PAL.marker
            }],
            hlines: [{
                y: tr.steadyT,
                color: "rgba(105,245,231,0.4)"
            }],
            fontSize: small(w) ? 11 : 12,
            legendPosition: "left"
        });
    }


    let gMap;
    const GR = 2.5;

    function drawG(ctx, w, h) {
        const md = S.cav.mode;
        gMap = UI.plot(ctx, {
            x: 0,
            y: 0,
            w,
            h
        }, {
            x: {
                min: -GR,
                max: GR,
                label: "g₁ = 1 − L/Rc₁"
            },
            y: {
                min: -GR,
                max: GR,
                label: "g₂ = 1 − L/Rc₂"
            },
            series: [],
            legend: false,
            fontSize: small(w) ? 11 : 12
        });
        const P = gMap.plot,
            X = gMap.xToPx,
            Y = gMap.yToPx;
        ctx.save();
        ctx.beginPath();
        ctx.rect(P.x, P.y, P.w, P.h);
        ctx.clip();

        ctx.fillStyle = "rgba(105,245,231,0.16)";
        for (const s of [1, -1]) {
            ctx.beginPath();
            ctx.moveTo(X(0), Y(0));
            ctx.lineTo(X(s * GR), Y(0));
            for (let i = 0; i <= 80; i++) {
                const g1 = s * (GR - (GR - 1 / GR) * i / 80);
                ctx.lineTo(X(g1), Y(1 / g1));
            }
            ctx.lineTo(X(0), Y(s * GR));
            ctx.closePath();
            ctx.fill();
        }

        ctx.strokeStyle = PAL.text;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(X(-GR), Y(0));
        ctx.lineTo(X(GR), Y(0));
        ctx.moveTo(X(0), Y(-GR));
        ctx.lineTo(X(0), Y(GR));
        ctx.stroke();
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = PAL.series[1];
        for (const s of [1, -1]) {
            ctx.beginPath();
            for (let i = 0; i <= 80; i++) {
                const g1 = s * (1 / GR + (GR - 1 / GR) * i / 80);
                const p = [X(g1), Y(1 / g1)];
                if (i) ctx.lineTo(p[0], p[1]);
                else ctx.moveTo(p[0], p[1]);
            }
            ctx.stroke();
        }

        ctx.setLineDash([1, 4]);
        ctx.strokeStyle = PAL.gridStrong;
        ctx.beginPath();
        ctx.moveTo(X(-GR), Y(-GR));
        ctx.lineTo(X(GR), Y(GR));
        ctx.stroke();

        const k1 = Number.isFinite(S.p.Rc1) ? 1 / S.p.Rc1 : 0,
            k2 = Number.isFinite(S.p.Rc2) ? 1 / S.p.Rc2 : 0;
        if (k1 || k2) {
            const tMax = 10 / Math.max(Math.abs(k1), Math.abs(k2));
            ctx.setLineDash([2, 3]);
            ctx.strokeStyle = PAL.series[3];
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(X(1), Y(1));
            ctx.lineTo(X(1 - tMax * k1), Y(1 - tMax * k2));
            ctx.stroke();
        }
        ctx.setLineDash([]);

        ctx.font = "12px " + PAL.font;
        ctx.fillStyle = PAL.textMuted;
        ctx.textBaseline = "middle";
        const pts = [
            [1, 1, "planar"],
            [0, 0, "confocal"],
            [-1, -1, "concentric"]
        ];
        for (const [a, b, t] of pts) {
            ctx.beginPath();
            ctx.arc(X(a), Y(b), 3, 0, 2 * Math.PI);
            ctx.fill();
            ctx.textAlign = a < 0 ? "left" : "left";
            ctx.fillText(t, X(a) + 6, Y(b) + (a === 0 ? 10 : -10));
        }
        ctx.fillStyle = "rgba(105,245,231,0.9)";
        ctx.textAlign = "center";
        ctx.fillText("stable", X(0.3), Y(1.9));
        ctx.fillText("stable", X(-0.3), Y(-1.9));
        ctx.fillStyle = PAL.textMuted;
        ctx.fillText("unstable", X(1.75), Y(1.75));
        ctx.fillText("unstable", X(1.5), Y(-1.5));

        const g1 = Math.max(-GR, Math.min(GR, md.g1)),
            g2 = Math.max(-GR, Math.min(GR, md.g2));
        const col = md.status === "stable" ? PAL.series[4] : md.status === "marginal" ? PAL.marker : "#ff6b6b";
        ctx.beginPath();
        ctx.arc(X(g1), Y(g2), 8, 0, 2 * Math.PI);
        ctx.fillStyle = col;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#07070d";
        ctx.stroke();
        if (gFocused) {
            ctx.beginPath();
            ctx.arc(X(g1), Y(g2), 12, 0, 2 * Math.PI);
            ctx.strokeStyle = PAL.cursor;
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }
        ctx.restore();

        ctx.save();
        ctx.font = "12px " + PAL.mono;
        ctx.fillStyle = PAL.text;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        const lab = "(" + md.g1.toFixed(3) + ", " + md.g2.toFixed(3) + ")  " + md.status;
        const tw = ctx.measureText(lab).width;
        ctx.fillStyle = "rgba(7,7,13,0.85)";
        ctx.fillRect(P.x + 4, P.y + 4, tw + 8, 18);
        ctx.fillStyle = col;
        ctx.fillText(lab, P.x + 8, P.y + 7);
        ctx.restore();
    }


    compute();
    let gFocused = false;
    const beamCv = UI.setupCanvas($("beamCanvas"), {
        aspect: 3.4,
        minHeight: 200,
        maxHeight: 300,
        draw: drawBeam
    });
    const specCv = UI.setupCanvas($("specCanvas"), {
        aspect: 2.6,
        minHeight: 260,
        maxHeight: 420,
        draw: drawSpectrum
    });
    const combCv = UI.setupCanvas($("combCanvas"), {
        aspect: 4.2,
        minHeight: 180,
        maxHeight: 260,
        draw: drawComb
    });
    const fieldCv = UI.setupCanvas($("fieldCanvas"), {
        aspect: 1.05,
        minHeight: 380,
        maxHeight: 560,
        draw: drawField
    });
    const timeCv = UI.setupCanvas($("timeCanvas"), {
        aspect: 1.25,
        minHeight: 300,
        maxHeight: 480,
        draw: drawTime
    });
    const gCv = UI.setupCanvas($("gCanvas"), {
        aspect: 1.05,
        minHeight: 300,
        maxHeight: 520,
        draw: drawG
    });
    const all = [beamCv, specCv, combCv, fieldCv, timeCv, gCv];

    const dBeam = UI.describeCanvas(beamCv.canvas, "", {
        label: "Cavity schematic with the TEM00 beam radius along the axis"
    });
    const dSpec = UI.describeCanvas(specCv.canvas, "", {
        label: "Transmission and reflection spectrum of the cavity; click to set the probe frequency"
    });
    const dComb = UI.describeCanvas(combCv.canvas, "", {
        label: "Transverse-mode frequency comb by order m + n"
    });
    const dField = UI.describeCanvas(fieldCv.canvas, "", {
        label: "Intracavity standing-wave field at the probe frequency"
    });
    const dTime = UI.describeCanvas(timeCv.canvas, "", {
        label: "Transmitted power buildup and ring-down versus time"
    });
    const dG = UI.describeCanvas(gCv.canvas, "", {
        label: "g1–g2 stability diagram with the current cavity point; arrow keys move it"
    });

    function describeAll() {
        const {
            cav,
            probe,
            fitTau,
            nOn
        } = S, md = cav.mode;
        dBeam.update(Number.isFinite(md.w0) ?
            `TEM00 beam: waist ${fmt(md.w0, "m")} at ${fmt(md.zWaist, "m")} from mirror 1, spot ${fmt(md.w1, "m")} on mirror 1 and ${fmt(md.w2, "m")} on mirror 2, cavity length ${fmt(cav.L, "m")}.` :
            `No finite Gaussian mode: resonator is ${md.status}.`);
        dSpec.update(`Airy spectrum: FSR ${fmt(cav.fsr, "Hz")}, FWHM ${fmt(cav.fwhm, "Hz")}, finesse ${Number.isFinite(cav.finesse) ? cav.finesse.toFixed(1) : "undefined"}, T on resonance ${cav.Tmax.toFixed(3)}, minimum T ${cav.Tmin.toFixed(4)}. Probe at ${fmt(S.nuProbe - cav.nuRes, "Hz")} from resonance: T ${probe.T.toFixed(3)}, R ${probe.R.toFixed(3)}.`);
        dComb.update(md.status === "unstable" ? "Unstable resonator: no transverse modes." :
            `Transverse modes shift by ${fmt(cav.fsr * cav.psi / Math.PI, "Hz")} per unit of m + n (Gouy phase ${(cav.psi * 180 / Math.PI).toFixed(1)}°), orders 0 to ${S.maxOrd}.`);
        dField.update(`Standing wave at the probe frequency: forward-wave power just inside mirror 1 is ${probe.circ.toPrecision(4)} times the input; the pattern has ${cav.q0} half-wavelengths at resonance.`);
        dTime.update(`Input on for ${nOn} round trips (${fmt(nOn * cav.Trt, "s")}); steady transmitted power ${S.tr.steadyT.toFixed(4)}; after switch-off the power decays with fitted lifetime ${fmt(fitTau, "s")}, model τp ${fmt(cav.tauP, "s")}.`);
        dG.update(`Cavity point g1 = ${md.g1.toFixed(3)}, g2 = ${md.g2.toFixed(3)}, g1g2 = ${(md.g1 * md.g2).toFixed(3)}, (A+D)/2 = ${md.m.toFixed(3)}: ${md.status}.`);
    }

    function render() {
        compute();
        updateReadouts();
        all.forEach((c) => c.redraw());
        describeAll();
    }



    const detEl = $("detSlider");

    function setDet(d) {
        d = Math.max(-0.5, Math.min(1.5, d));
        ctl.set({
            det: Number(d.toPrecision(9))
        });
    }
    let specDrag = false;

    function specPointer(e) {
        if (!specMap) return;
        const r = specCv.canvas.getBoundingClientRect();
        const px = e.clientX - r.left,
            py = e.clientY - r.top;
        if (!specMap.contains(px, py) && e.type === "pointerdown") return;
        const x = specMap.pxToX(Math.max(specMap.plot.x, Math.min(specMap.plot.x + specMap.plot.w, px)));
        setDet(x * S.unit.s / S.cav.fsr);
    }
    specCv.canvas.addEventListener("pointerdown", (e) => {
        specDrag = true;
        specCv.canvas.setPointerCapture(e.pointerId);
        specPointer(e);
    });
    specCv.canvas.addEventListener("pointermove", (e) => {
        if (specDrag) specPointer(e);
    });
    specCv.canvas.addEventListener("pointerup", () => {
        specDrag = false;
    });
    specCv.canvas.addEventListener("pointercancel", () => {
        specDrag = false;
    });
    specCv.canvas.addEventListener("keydown", (e) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        e.preventDefault();
        const base = Number.isFinite(S.cav.fwhm) ? Math.max(1e-5, S.cav.fwhm / S.cav.fsr / 10) : 0.005;
        const step = base * (e.shiftKey ? 10 : 1) * (e.key === "ArrowLeft" ? -1 : 1);
        setDet(Number(detEl.value) + step);
    });
    $("lockBtn").addEventListener("click", () => setDet(Math.round(Number(detEl.value))));
    $("halfBtn").addEventListener("click", () => {
        if (!Number.isFinite(S.cav.fwhm)) {
            $("presetNote").textContent = "No half maximum: the finesse is undefined for ρ < 0.172.";
            return;
        }
        setDet(Math.round(Number(detEl.value)) + S.cav.fwhm / 2 / S.cav.fsr);
    });


    function setG(g1, g2) {
        const snap = (g) => {
            for (const t of [1, 0, -1])
                if (Math.abs(g - t) < 0.02) return t;
            return g;
        };
        g1 = snap(Math.max(-GR, Math.min(GR, g1)));
        g2 = snap(Math.max(-GR, Math.min(GR, g2)));
        const Lmm = S.v.L;
        const upd = {};
        for (const [g, rk, fk] of [
                [g1, "rc1", "f1"],
                [g2, "rc2", "f2"]
            ]) {
            if (Math.abs(1 - g) < 1e-9) {
                upd[fk] = true;
            } else {
                upd[fk] = false;
                upd[rk] = Number((Lmm / (1 - g)).toPrecision(6));
            }
        }
        ctl.set(upd);
    }
    let gDrag = false;

    function gPointer(e) {
        const r = gCv.canvas.getBoundingClientRect();
        const px = e.clientX - r.left,
            py = e.clientY - r.top;
        setG(gMap.pxToX(px), gMap.pxToY(py));
    }
    gCv.canvas.addEventListener("pointerdown", (e) => {
        const r = gCv.canvas.getBoundingClientRect();
        if (!gMap.contains(e.clientX - r.left, e.clientY - r.top)) return;
        gDrag = true;
        gCv.canvas.classList.add("dragging");
        gCv.canvas.setPointerCapture(e.pointerId);
        gPointer(e);
    });
    gCv.canvas.addEventListener("pointermove", (e) => {
        if (gDrag) gPointer(e);
    });
    const endG = () => {
        gDrag = false;
        gCv.canvas.classList.remove("dragging");
    };
    gCv.canvas.addEventListener("pointerup", endG);
    gCv.canvas.addEventListener("pointercancel", endG);
    gCv.canvas.addEventListener("focus", () => {
        gFocused = true;
        gCv.redraw();
    });
    gCv.canvas.addEventListener("blur", () => {
        gFocused = false;
        gCv.redraw();
    });
    gCv.canvas.addEventListener("keydown", (e) => {
        const d = e.shiftKey ? 0.1 : 0.01;
        const md = S.cav.mode;
        let g1 = md.g1,
            g2 = md.g2;
        if (e.key === "ArrowLeft") g1 -= d;
        else if (e.key === "ArrowRight") g1 += d;
        else if (e.key === "ArrowDown") g2 -= d;
        else if (e.key === "ArrowUp") g2 += d;
        else return;
        e.preventDefault();
        setG(Number(g1.toFixed(4)), Number(g2.toFixed(4)));
    });


    const playBtn = $("playBtn");
    const loop = UI.createLoop((dt) => {
        phase = (phase + Math.PI * dt) % (2 * Math.PI);
        fieldCv.redraw();
    }, {
        onChange: (running) => {
            playBtn.textContent = running ? "⏸ Pause" : "▶ Animate field";
            playBtn.setAttribute("aria-pressed", running ? "true" : "false");
        }
    });
    playBtn.addEventListener("click", () => loop.toggle());
    $("stepBtn").addEventListener("click", () => {
        loop.stop();
        phase = (phase + Math.PI / 8) % (2 * Math.PI);
        fieldCv.redraw();
    });
    $("phaseResetBtn").addEventListener("click", () => {
        loop.stop();
        phase = 0;
        loop.reset();
        fieldCv.redraw();
    });

    UI.onThemeChange(() => all.forEach((c) => c.redraw()));


    url = UI.urlState({
        get: ctl.get,
        set: ctl.set
    });
    url.ready.then(() => scheduleRender());
    UI.addExportBar($("exportHost"), {
        name: "fabry-perot",
        url,
        getState: () => {
            const {
                cav
            } = S, md = cav.mode;
            return Object.assign({}, ctl.get(), {
                derived: {
                    FSR_Hz: cav.fsr,
                    FWHM_Hz: cav.fwhm,
                    finesse: cav.finesse,
                    finesseApprox: cav.finesseApprox,
                    S: cav.S,
                    roundTrip_s: cav.Trt,
                    photonLifetime_s: cav.tauP,
                    fittedLifetime_s: S.fitTau,
                    Tmax: cav.Tmax,
                    Rmin: cav.Rmin,
                    q: cav.q0,
                    nu_q00_Hz: cav.nuRes,
                    g1: md.g1,
                    g2: md.g2,
                    halfTrace: md.m,
                    stability: md.status,
                    gouy_rad: md.gouy,
                    w0_m: md.w0,
                    waistFromM1_m: md.zWaist,
                    w1_m: md.w1,
                    w2_m: md.w2
                }
            });
        },
        getCSV: () => ({
            headers: ["nu - nu_q00 (Hz)", "T", "R", "loss"],
            rows: Array.from(S.nus, (nu, i) => [nu - S.cav.nuRes, S.sp.T[i], S.sp.R[i], S.sp.loss[i]])
        }),
        canvases: all.map((c) => c.canvas),
        caption: () => {
            const v = S.v;
            return `R1 ${v.R1}%, R2 ${v.R2}%, loss ${v.loss}%/pass, L ${v.L} mm, n ${v.n}${v.disp ? ", ng " + v.ng : ""}, Rc1 ${v.f1 ? "∞" : v.rc1 + " mm"}, Rc2 ${v.f2 ? "∞" : v.rc2 + " mm"}, λ0 ${v.lam} nm`;
        }
    });

    render();
})();