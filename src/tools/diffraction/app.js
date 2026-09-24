"use strict";


(function() {
    const UI = window.OpticsUI;
    const core = window.OpticsModels.core;
    const Model = window.OpticsModels.diffraction;
    const C = UI.CANVAS_PALETTE;
    const $ = (id) => document.getElementById(id);


    const DEFAULT_STATE = {
        ap: "slit",
        a: 100,
        lam: 550,
        L: 1000,
        Iin: 1000,
        norm: "peak",
        scale: "linear",
        fov: "auto",
        cmp: false,
        wav: false
    };
    const PRESETS = {
        slit100: {
            state: {},
            note: "Acceptance case: 100 µm slit, λ = 550 nm, L = 1 m. Expect the first dark fringe at y₁ ≈ 5.50 mm (= λL/a) and a central maximum 11.0 mm wide that holds 90.3 % of the power."
        },
        circle100: {
            state: {
                ap: "circular",
                cmp: true
            },
            note: "Circular aperture with D = 100 µm (dashed curve: slit with a = 100 µm). Expect the first dark ring at ≈ 6.71 mm, 1.22× the slit’s 5.50 mm, with 83.8 % of the power in the Airy disk."
        },
        halfwidth: {
            state: {
                a: 50
            },
            note: "Slit halved to 50 µm. Expect y₁ to double to ≈ 11.0 mm: the diffraction angle scales as λ/a."
        },
        blue: {
            state: {
                lam: 450
            },
            note: "Blue light, 450 nm. Expect y₁ ≈ 4.50 mm, narrower than the 5.50 mm at 550 nm in proportion to λ."
        },
        sidelobes: {
            state: {
                ap: "circular",
                scale: "log5",
                fov: "20"
            },
            note: "Airy pattern on a log scale (floor 10⁻⁵). The rings at 1.75 %, 0.42 % and 0.16 % of the peak become visible, with dark rings at 6.71, 12.28 and 17.81 mm."
        },
        nearfield: {
            state: {
                a: 200,
                lam: 380,
                L: 50
            },
            note: "Audit case: a = 200 µm, λ = 380 nm, L = 50 mm gives N_F ≈ 0.53. Expect a warning, because the sinc² curve is not what a screen 50 mm away would show."
        }
    };


    const sliderOpts = {
        apertureWidth: {
            unit: "µm",
            label: "Aperture size (slit width a or diameter D)"
        },
        wavelength: {
            unit: "nm",
            label: "Wavelength"
        },
        screenDistance: {
            unit: "mm",
            label: "Screen distance"
        },
        irradiance: {
            unit: "W/m²",
            label: "Incident irradiance"
        }
    };
    UI.enhanceAllSliders(document.querySelector(".options-sidebar"), sliderOpts);

    const holdBox = $("holdScale");
    let held = null;
    let cursor = {
        x: NaN,
        y: 0
    };
    let presetNote = "";
    let S = null;
    let phase = 0;
    let renderQueued = false;

    const ctl = UI.bindControls({
        ap: "#apType",
        a: "#apertureWidth",
        lam: "#wavelength",
        L: "#screenDistance",
        Iin: "#irradiance",
        norm: "#normMode",
        scale: "#intensityScale",
        fov: "#detectorRange",
        cmp: "#compareOther",
        wav: "#showWavelets"
    }, () => {
        url.update();
        requestRender();
    });

    ["normMode", "intensityScale", "apType"].forEach((id) => $(id).addEventListener("change", () => {
        if (holdBox.checked) {
            holdBox.checked = false;
            held = null;
        }
    }));
    holdBox.addEventListener("change", () => {
        held = null;
        requestRender();
    });


    const N_CUT = 1201;
    let imgCache = {
        key: "",
        data: null,
        n: 0
    };

    function displayUnits(type, norm, peakSI) {
        if (norm === "power") {
            return type === "circular" ? {
                label: "I/P",
                unit: "mm⁻²",
                factor: 1e-6
            } : {
                label: "I/P′",
                unit: "mm⁻¹",
                factor: 1e-3
            };
        }
        if (norm === "absolute") {
            const e = Math.floor(Math.log10(peakSI || 1) / 3) * 3;
            const prefixes = {
                "-12": "p",
                "-9": "n",
                "-6": "µ",
                "-3": "m",
                "0": "",
                "3": "k",
                "6": "M",
                "9": "G"
            };
            const k = String(Math.max(-12, Math.min(9, e)));
            return {
                label: "I",
                unit: prefixes[k] + "W/m²",
                factor: Math.pow(10, -Number(k))
            };
        }
        return {
            label: "I/I₀",
            unit: "",
            factor: 1
        };
    }

    function compute() {
        const s = ctl.get();
        const type = s.ap === "circular" ? "circular" : "slit";
        const params = {
            type,
            size: s.a * 1e-6,
            lambda: s.lam * 1e-9,
            L: s.L * 1e-3
        };
        const mins = Model.minima(params, 12);
        const y1 = mins.length ? mins[0].y : Infinity;
        let R;
        if (s.fov === "auto") R = Number.isFinite(y1) ? Math.min(4.2 * y1, 0.5) : 0.5 * params.L;
        else R = Number(s.fov) * 1e-3;
        const Rmm = R * 1e3;
        const nf = Model.fresnelNumber(params.size, params.lambda, params.L);
        const peakSI = Model.peakValue(params, s.norm, s.Iin);
        const logDec = s.scale === "log3" ? 3 : s.scale === "log5" ? 5 : 0;
        const key = [type, s.norm, s.scale].join("|");
        if (!holdBox.checked || (held && held.key !== key)) held = null;
        const du = held ? held.du : displayUnits(type, s.norm, peakSI);
        const peak = peakSI * du.factor;
        const cut = Model.lineCut(params, R, N_CUT);
        const xs = Array.from(cut.ys, (y) => y * 1e3);
        const other = s.cmp ? {
            ...params,
            type: type === "circular" ? "slit" : "circular"
        } : null;

        const otherPeak = other ? peak : 0;
        const otherI = other ? Model.lineCut(other, R, N_CUT).I : null;

        if (holdBox.checked && !held) held = {
            key,
            du,
            peakSI
        };
        const refPeak = held ? held.peakSI * du.factor : peak;
        const yMax = logDec ? refPeak * 1.5 : (held ? refPeak : Math.max(peak, otherPeak)) * 1.05;
        const floor = logDec ? refPeak * Math.pow(10, -logDec) : 0;

        const nE = 301;
        const eXs = [],
            eYs = [];
        for (let i = 0; i < nE; i++) {
            const Y = (R * i) / (nE - 1);
            eXs.push(Y * 1e3);
            eYs.push(100 * Model.enclosedPower(params, Y));
        }
        if (!Number.isFinite(cursor.x) || Math.abs(cursor.x) > Rmm || Math.abs(cursor.y) > Rmm) {
            cursor = {
                x: Number.isFinite(y1) && y1 < R ? y1 * 1e3 : Rmm / 2,
                y: 0
            };
        }
        S = {
            s,
            type,
            params,
            mins,
            y1,
            R,
            Rmm,
            nf,
            regime: Model.regime(nf),
            peakSI,
            peak,
            du,
            cut,
            xs,
            other,
            otherI,
            otherPeak,
            logDec,
            yMax,
            floor,
            eXs,
            eYs,
            captured: Model.enclosedPower(params, R),
            central: Model.centralLobeFraction(type)
        };
    }

    function detectorData(n) {
        const key = [S.type, S.params.size, S.params.lambda, S.params.L, S.R, n].join("|");
        if (imgCache.key !== key) imgCache = {
            key,
            n,
            data: Model.detectorImage(S.params, S.R, n)
        };
        return imgCache.data;
    }

    function probeValue(xmm, ymm) {
        const r = S.type === "circular" ? Math.hypot(xmm, ymm) : Math.abs(xmm);
        return Model.intensityAt(r * 1e-3, S.params);
    }


    const fmtMm = (vm) => {
        if (!Number.isFinite(vm)) return "none (a < λ)";
        return vm < 1 ? Number((vm * 1e3).toPrecision(4)).toFixed(Math.max(0, 3 - Math.floor(Math.log10(vm * 1e3 || 1)))) + " mm" : core.formatSI(vm, "m", 4);
    };
    const fmtVal = (v) => {
        if (!Number.isFinite(v)) return "—";
        if (v === 0 || (S && Math.abs(v) < 1e-12 * S.peak)) return "≈ 0";
        const a = Math.abs(v);
        return a >= 0.01 && a < 1e4 ? String(Number(v.toPrecision(4))) : v.toExponential(3);
    };
    const unitSuffix = () => (S.du.unit ? " " + S.du.unit : "");
    const quantityLabel = () => S.du.label + (S.du.unit ? " (" + S.du.unit + ")" : "");
    const scaleText = () => (S.logDec ? "log, floor 10⁻" + S.logDec + " of peak" : "linear");


    const detCanvas = $("detectorCanvas");
    const cutCanvas = $("cutCanvas");
    const powCanvas = $("powerCanvas");
    const schCanvas = $("schematicCanvas");
    let detMap = null,
        cutMap = null;

    const descDet = UI.describeCanvas(detCanvas, "2D detector image.", {
        label: "Two-dimensional detector image of the far-field diffraction pattern"
    });
    const descCut = UI.describeCanvas(cutCanvas, "Line cut.", {
        label: "Intensity line cut through the centre of the detector"
    });
    const descPow = UI.describeCanvas(powCanvas, "Enclosed power.", {
        label: "Enclosed power fraction versus detector half-width"
    });
    const descSch = UI.describeCanvas(schCanvas, "Schematic.", {
        label: "Schematic of plane waves diffracting at the aperture, not to scale"
    });

    function drawDetector(ctx, w, h) {
        if (!S) return;
        const fs = w < 420 ? 11 : 12;
        const m = {
            l: fs * 4.2,
            r: 10,
            t: 12,
            b: fs * 3.4
        };
        const cbArea = 64;
        const side = Math.max(60, Math.min(w - m.l - m.r - cbArea, h - m.t - m.b));
        const x0 = Math.max(0, (w - (side + m.l + m.r + cbArea)) / 2);
        const R = S.Rmm;
        detMap = UI.plot(ctx, {
            x: x0,
            y: 0,
            w: side + m.l + m.r,
            h: side + m.t + m.b
        }, {
            x: {
                min: -R,
                max: R,
                label: "x",
                unit: "mm",
                grid: false
            },
            y: {
                min: -R,
                max: R,
                label: "y",
                unit: "mm",
                grid: false
            },
            series: [],
            legend: false,
            margin: m,
            fontSize: fs
        });
        const P = detMap.plot;
        const n = Math.max(64, Math.min(320, Math.round(P.w)));
        const data = detectorData(n);

        const toNorm = 1 / S.peak;
        const opts = S.logDec ? {
            log: true,
            min: S.floor * toNorm,
            max: S.yMax * toNorm
        } : {
            min: 0,
            max: S.yMax * toNorm
        };
        UI.imageFromArray(ctx, data, n, n, P, "inferno", opts);
        ctx.save();
        ctx.beginPath();
        ctx.rect(P.x, P.y, P.w, P.h);
        ctx.clip();

        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = "rgba(105, 245, 231, 0.75)";
        const cx = detMap.xToPx(0),
            cy = detMap.yToPx(0),
            pxPerMm = P.w / (2 * R);
        S.mins.forEach((mn) => {
            const r = mn.y * 1e3;
            if (r > R * 1.5) return;
            ctx.beginPath();
            if (S.type === "circular") ctx.arc(cx, cy, r * pxPerMm, 0, 2 * Math.PI);
            else {
                ctx.moveTo(cx + r * pxPerMm, P.y);
                ctx.lineTo(cx + r * pxPerMm, P.y + P.h);
                ctx.moveTo(cx - r * pxPerMm, P.y);
                ctx.lineTo(cx - r * pxPerMm, P.y + P.h);
            }
            ctx.stroke();
        });
        ctx.setLineDash([]);

        const px = detMap.xToPx(cursor.x),
            py = detMap.yToPx(cursor.y);
        ctx.strokeStyle = C.cursor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(px - 8, py);
        ctx.lineTo(px + 8, py);
        ctx.moveTo(px, py - 8);
        ctx.lineTo(px, py + 8);
        ctx.stroke();
        ctx.restore();

        if (S.mins.length && S.mins[0].y * 1e3 < R) {
            ctx.font = fs + "px " + C.font;
            ctx.fillStyle = C.text;
            ctx.textAlign = "left";
            ctx.textBaseline = "top";
            const label = (S.type === "circular" ? "1st dark ring r₁ = " : "y₁ = ") + (S.mins[0].y * 1e3).toPrecision(3) + " mm";
            ctx.fillStyle = "rgba(7,7,13,0.72)";
            const tw = ctx.measureText(label).width;
            ctx.fillRect(P.x + 4, P.y + 4, tw + 8, fs + 6);
            ctx.fillStyle = C.text;
            ctx.fillText(label, P.x + 8, P.y + 7);
        }
        UI.drawColorbar(ctx, {
            x: P.x + P.w + 14,
            y: P.y,
            w: 12,
            h: P.h
        }, "inferno", {
            min: S.logDec ? S.floor : 0,
            max: S.yMax,
            log: !!S.logDec,
            fontSize: 11
        });
        ctx.font = "11px " + C.font;
        ctx.fillStyle = C.textMuted;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText(S.du.label + (S.du.unit ? " [" + S.du.unit + "]" : ""), P.x + P.w + 10, P.y + P.h + 6);
    }

    function drawCut(ctx, w, h) {
        if (!S) return;
        const fs = w < 420 ? 11 : 12;
        const clampLog = (v) => (S.logDec ? Math.max(v, S.floor) : v);
        const ys = Array.from(S.cut.I, (v) => clampLog(v * S.peak));
        const series = [{
            xs: S.xs,
            ys,
            label: S.type === "circular" ? "circle [2J₁(u)/u]²" : "slit sinc²β",
            color: C.series[0],
            width: 2
        }];
        if (S.otherI) {
            series.push({
                xs: S.xs,
                ys: Array.from(S.otherI, (v) => clampLog(v * S.otherPeak)),
                label: (S.type === "circular" ? "slit, a = D" : "circle, D = a") + (S.s.norm === "peak" ? "" : " (peak-matched)"),
                color: C.series[1],
                dash: [7, 4],
                width: 1.6
            });
        }
        const markers = [];
        S.mins.forEach((mn, i) => {
            const y = mn.y * 1e3;
            if (y > S.Rmm) return;
            markers.push({
                x: y,
                label: "",
                color: C.marker,
                dash: [3, 3]
            });
            markers.push({
                x: -y,
                label: i === 0 ? "−y₁" : "",
                color: C.marker,
                dash: [3, 3]
            });
        });
        const Ic = probeValue(cursor.x, 0) * S.peak;
        cutMap = UI.plot(ctx, {
            x: 0,
            y: 0,
            w,
            h
        }, {
            x: {
                min: -S.Rmm,
                max: S.Rmm,
                label: S.type === "circular" ? "x (y = 0)" : "y",
                unit: "mm"
            },
            y: {
                min: S.logDec ? S.floor : 0,
                max: S.yMax,
                log: !!S.logDec,
                label: S.du.label,
                unit: S.du.unit
            },
            series,
            markers,
            fontSize: fs,
            cursor: {
                x: cursor.x,
                label: fmtVal(Ic) + unitSuffix()
            }
        });
    }

    function drawPower(ctx, w, h) {
        if (!S) return;
        const fs = w < 420 ? 11 : 12;
        const markers = [];
        if (Number.isFinite(S.y1) && S.y1 * 1e3 <= S.Rmm) markers.push({
            x: S.y1 * 1e3,
            label: "1st zero",
            color: C.marker,
            dash: [3, 3]
        });
        const rc = S.type === "circular" ? Math.hypot(cursor.x, cursor.y) : Math.abs(cursor.x);
        UI.plot(ctx, {
            x: 0,
            y: 0,
            w,
            h
        }, {
            x: {
                min: 0,
                max: S.Rmm,
                label: S.type === "circular" ? "radius R" : "half-width Y",
                unit: "mm"
            },
            y: {
                min: 0,
                max: 100,
                label: "enclosed power",
                unit: "%"
            },
            series: [{
                xs: S.eXs,
                ys: S.eYs,
                label: "fraction inside",
                color: C.series[2],
                width: 2
            }],
            hlines: [{
                y: 100 * S.central,
                label: (100 * S.central).toFixed(1) + " % in central max",
                color: C.textMuted
            }],
            markers,
            legend: false,
            fontSize: fs,
            cursor: {
                x: Math.min(rc, S.Rmm),
                label: (100 * Model.enclosedPower(S.params, rc * 1e-3)).toFixed(1) + " %"
            }
        });
    }

    function drawSchematic(ctx, w, h) {
        if (!S) return;
        const fs = w < 420 ? 11 : 12;
        ctx.fillStyle = C.background;
        ctx.fillRect(0, 0, w, h);
        const xa = Math.round(w * 0.28),
            xs = Math.round(w * 0.8),
            cy = h / 2;
        const half = h * 0.42;
        const gap = Math.max(10, Math.min(h * 0.32, 10 + Math.sqrt(S.s.a) * 3));
        const col = UI.wavelengthToCSS(S.s.lam, 1);
        const colA = (a) => UI.wavelengthToCSS(S.s.lam, a);
        const lamPx = 14 * (S.s.lam / 550);
        const off = ((phase % lamPx) + lamPx) % lamPx;

        ctx.lineWidth = 2;
        for (let x = off; x < xa; x += lamPx) {
            ctx.strokeStyle = colA(0.55);
            ctx.beginPath();
            ctx.moveTo(x, cy - half);
            ctx.lineTo(x, cy + half);
            ctx.stroke();
        }

        const dist = xs - xa;
        const Iat = (phi) => {
            const v = Math.tan(phi) * dist;
            if (Math.abs(v) > half) return 0;
            return probeValue((v / half) * S.Rmm, 0);
        };
        ctx.lineWidth = 1.6;
        for (let r = off; r < dist; r += lamPx) {
            if (r < 2) continue;
            const segs = 48;
            const phiMax = Math.PI / 2 - 0.05;
            for (let k = 0; k < segs; k++) {
                const p0 = -phiMax + (2 * phiMax * k) / segs,
                    p1 = p0 + (2 * phiMax) / segs;
                const I = Iat((p0 + p1) / 2);
                if (I < 0.004) continue;
                ctx.strokeStyle = colA(Math.min(0.9, 0.15 + 0.85 * Math.sqrt(I)));
                ctx.beginPath();
                ctx.arc(xa, cy, r, p0, p1);
                ctx.stroke();
            }
        }

        if (S.s.wav) {
            ctx.lineWidth = 1;
            ctx.strokeStyle = "rgba(236, 233, 248, 0.28)";
            const nSrc = 7;
            for (let i = 0; i < nSrc; i++) {
                const yy = cy - gap / 2 + (gap * (i + 0.5)) / nSrc;
                for (let r = off; r < lamPx * 4; r += lamPx) {
                    if (r < 1) continue;
                    ctx.beginPath();
                    ctx.arc(xa, yy, r, -Math.PI / 2, Math.PI / 2);
                    ctx.stroke();
                }
                ctx.fillStyle = C.text;
                ctx.beginPath();
                ctx.arc(xa, yy, 1.8, 0, 2 * Math.PI);
                ctx.fill();
            }
        }

        ctx.fillStyle = "#3a3654";
        ctx.fillRect(xa - 4, 0, 8, cy - gap / 2);
        ctx.fillRect(xa - 4, cy + gap / 2, 8, h - cy - gap / 2);

        ctx.fillStyle = "#26233a";
        ctx.fillRect(xs, cy - half, 4, 2 * half);
        const prof = Math.max(20, w - xs - 14);
        ctx.strokeStyle = col;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        for (let i = 0; i <= 160; i++) {
            const v = -half + (2 * half * i) / 160;
            const I = probeValue((v / half) * S.Rmm, 0);
            const x = xs + 6 + prof * I,
                y = cy + v;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();

        if (Number.isFinite(S.y1) && S.y1 * 1e3 <= S.Rmm) {
            const v1 = (S.y1 * 1e3 / S.Rmm) * half;
            ctx.setLineDash([4, 4]);
            ctx.strokeStyle = C.marker;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(xa, cy);
            ctx.lineTo(xs, cy - v1);
            ctx.moveTo(xa, cy);
            ctx.lineTo(xs, cy + v1);
            ctx.moveTo(xa, cy);
            ctx.lineTo(xs, cy);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = C.marker;
            ctx.font = fs + "px " + C.font;
            ctx.textAlign = "left";
            ctx.textBaseline = "bottom";
            ctx.fillText("θ₁ = " + (S.mins[0].theta * 1e3).toPrecision(3) + " mrad", xa + 12, cy - 4);
        }

        ctx.font = fs + "px " + C.font;
        ctx.fillStyle = C.textMuted;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText("NOT TO SCALE", 8, 6);
        ctx.textBaseline = "bottom";
        ctx.fillStyle = C.text;
        ctx.fillText((S.type === "circular" ? "D = " : "a = ") + S.s.a + " µm", Math.max(4, xa - 40), h - 4);
        ctx.textAlign = "right";
        ctx.fillText("L = " + core.formatSI(S.params.L, "m", 3), xs + 2, h - 4);
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText("λ = " + S.s.lam + " nm", 8, 6 + fs + 4);
    }

    const det = UI.setupCanvas(detCanvas, {
        aspect: 1.2,
        minHeight: 260,
        maxHeight: 520,
        draw: drawDetector
    });
    const cutH = UI.setupCanvas(cutCanvas, {
        aspect: 1.45,
        minHeight: 240,
        maxHeight: 460,
        draw: drawCut
    });
    const powH = UI.setupCanvas(powCanvas, {
        aspect: 1.9,
        minHeight: 200,
        maxHeight: 360,
        draw: drawPower
    });
    const schH = UI.setupCanvas(schCanvas, {
        aspect: 1.9,
        minHeight: 200,
        maxHeight: 360,
        draw: drawSchematic
    });


    function setProbeFromDetector(e) {
        if (!detMap) return;
        const r = detCanvas.getBoundingClientRect();
        const px = e.clientX - r.left,
            py = e.clientY - r.top;
        if (!detMap.contains(px, py)) return;
        cursor = {
            x: detMap.pxToX(px),
            y: detMap.pxToY(py)
        };
        redrawData();
    }

    function setProbeFromCut(e) {
        if (!cutMap) return;
        const r = cutCanvas.getBoundingClientRect();
        const px = e.clientX - r.left,
            py = e.clientY - r.top;
        if (!cutMap.contains(px, py)) return;
        cursor = {
            x: cutMap.pxToX(px),
            y: 0
        };
        redrawData();
    }
    detCanvas.addEventListener("pointerdown", setProbeFromDetector);
    detCanvas.addEventListener("pointermove", (e) => {
        if (e.buttons || e.pointerType === "mouse") setProbeFromDetector(e);
    });
    cutCanvas.addEventListener("pointerdown", setProbeFromCut);
    cutCanvas.addEventListener("pointermove", (e) => {
        if (e.buttons || e.pointerType === "mouse") setProbeFromCut(e);
    });

    function keyProbe(e, allowY) {
        const step = (S ? S.Rmm : 10) / (e.shiftKey ? 10 : 100);
        const d = {
            ArrowLeft: [-step, 0],
            ArrowRight: [step, 0],
            ArrowUp: [0, step],
            ArrowDown: [0, -step]
        } [e.key];
        if (!d || (!allowY && d[1] !== 0)) return;
        e.preventDefault();
        const R = S.Rmm;
        cursor = {
            x: Math.max(-R, Math.min(R, cursor.x + d[0])),
            y: allowY ? Math.max(-R, Math.min(R, cursor.y + d[1])) : 0
        };
        redrawData();
    }
    detCanvas.addEventListener("keydown", (e) => keyProbe(e, true));
    cutCanvas.addEventListener("keydown", (e) => keyProbe(e, false));


    function updateDom() {
        const s = S.s,
            circ = S.type === "circular";
        const sym = circ ? "D" : "a";
        $("apertureLabel").textContent = circ ? "Diameter D" : "Slit width a";
        $("apertureValue").textContent = s.a + " µm";
        $("wavelengthValue").textContent = s.lam + " nm";
        $("screenDistValue").textContent = s.L + " mm";
        $("irradianceValue").textContent = s.Iin + " W/m²";
        $("stat-aperture").textContent = sym + " = " + s.a + " µm";
        $("stat-aperture-label").textContent = circ ? "Diameter" : "Slit Width";
        $("stat-wavelength").textContent = s.lam + " nm";
        $("stat-distance").textContent = core.formatSI(S.params.L, "m", 3);
        $("stat-pattern").textContent = circ ? "Circular" : "Single Slit";
        $("stat-first-min").textContent = fmtMm(S.y1);
        $("stat-fresnel").textContent = S.nf < 0.01 ? S.nf.toExponential(2) : S.nf.toPrecision(3);

        const t1 = S.mins.length ? S.mins[0].theta : NaN;
        $("rY1").textContent = fmtMm(S.y1);
        $("rY1p").textContent = S.mins.length ? fmtMm(Model.smallAngleMinimum(S.params, 1)) : "—";
        $("rTheta1").textContent = Number.isFinite(t1) ? (t1 * 1e3).toPrecision(4) + " mrad" : "—";
        $("rWidth").textContent = Number.isFinite(S.y1) ? fmtMm(2 * S.y1) : "—";
        $("rNF").textContent = (S.nf < 0.01 ? S.nf.toExponential(2) : S.nf.toPrecision(3)) + " (" + S.regime + ")";
        $("rPeak").textContent = S.s.norm === "peak" ?
            "1 (I/I₀)" :
            fmtVal(S.peak) + unitSuffix();
        $("rCentral").textContent = (100 * S.central).toFixed(1) + " %";
        $("rCaptured").textContent = (100 * S.captured).toFixed(2) + " %";
        const rC = circ ? Math.hypot(cursor.x, cursor.y) : Math.abs(cursor.x);
        const thC = Math.atan(rC * 1e-3 / S.params.L);
        $("rCurPos").textContent = (circ ? "r = " : "y = ") + rC.toPrecision(4) + " mm";
        $("rCurTheta").textContent = (thC * 1e3).toPrecision(4) + " mrad";
        const IC = probeValue(cursor.x, cursor.y);
        $("rCurI").textContent = fmtVal(IC * S.peak) + unitSuffix();


        const rows = [];
        let prev = 0;
        S.mins.slice(0, 8).forEach((mn) => {
            const ym = mn.y * 1e3,
                yp = Model.smallAngleMinimum(S.params, mn.order) * 1e3;
            const out = ym > S.Rmm ? " *" : "";
            rows.push("<tr><td>" + mn.order + out + "</td><td>" + mn.sinTheta.toPrecision(4) + "</td><td>" + ym.toPrecision(5) + "</td><td>" + yp.toPrecision(5) + "</td><td>" + (ym - prev).toPrecision(4) + "</td></tr>");
            prev = ym;
        });
        if (!rows.length) rows.push('<tr><td colspan="5">No minima: the aperture is narrower than the wavelength (sin θ₁ &gt; 1).</td></tr>');
        const beyond = S.mins.slice(0, 8).some((mn) => mn.y * 1e3 > S.Rmm);
        $("minimaTable").querySelector("tbody").innerHTML = rows.join("") + (beyond ? '<tr><td colspan="5">* outside the current field of view</td></tr>' : "");


        const warn = $("regimeWarn");
        if (S.regime !== "fraunhofer") {
            warn.hidden = false;
            warn.innerHTML = "<strong>" + (S.regime === "fresnel" ? "Far-field model not valid" : "Far-field model only approximate") +
                ":</strong> Fresnel number N<sub>F</sub> = b²/(λL) = " + S.nf.toPrecision(3) + " (b = " + (circ ? "D" : "a") + "/2 = " +
                (s.a / 2) + " µm). Fraunhofer theory needs N<sub>F</sub> ≪ 1; at this distance the screen shows a near-field (Fresnel) pattern " +
                "that differs from the curves below. Increase L or reduce the aperture, or compute the near field with the " +
                '<a href="../aperture_propagation/">aperture propagation (numerical Fresnel) tool</a>.';
        } else {
            warn.hidden = true;
            warn.textContent = "";
        }
        const badge = S.regime === "fraunhofer" ? "Fraunhofer, N_F = " + S.nf.toExponential(1) : "outside Fraunhofer regime";
        $("detBadge").textContent = badge;
        $("cutBadge").textContent = (S.s.norm === "peak" ? "peak-normalized" : S.s.norm === "power" ? "power-normalized" : "absolute") + ", " + scaleText();


        const y1t = Number.isFinite(S.y1) ? (S.y1 * 1e3).toPrecision(3) + " mm" : "none";
        const shape = circ ? "Airy rings" : "vertical fringes";
        descDet.update("2D detector, ±" + S.Rmm.toPrecision(3) + " mm, " + scaleText() + ", colour scale 0 to " + fmtVal(S.yMax) + unitSuffix() + ". " +
            (circ ? "Circular aperture D = " : "Slit a = ") + s.a + " µm, λ = " + s.lam + " nm, L = " + s.L + " mm: " + shape +
            " with first minimum at " + y1t + ". Probe at (" + cursor.x.toFixed(2) + ", " + cursor.y.toFixed(2) + ") mm reads " + fmtVal(IC * S.peak) + unitSuffix() + ".");
        descCut.update("Line cut, " + S.du.label + " versus position from −" + S.Rmm.toPrecision(3) + " to +" + S.Rmm.toPrecision(3) + " mm. Peak " + fmtVal(S.peak) + unitSuffix() +
            " at 0. Minima at ±" + S.mins.filter((mn) => mn.y * 1e3 <= S.Rmm).map((mn) => (mn.y * 1e3).toPrecision(3)).join(", ±") + " mm." +
            (S.otherI ? " Dashed overlay: " + (circ ? "slit" : "circle") + " of the same size, first minimum " + (Model.firstMinimum(S.other) * 1e3).toPrecision(3) + " mm." : ""));
        descPow.update("Enclosed power rises from 0 to " + (100 * S.captured).toFixed(1) + " % at the detector edge; " + (100 * S.central).toFixed(1) + " % lies inside the first minimum.");
        descSch.update("Schematic, not to scale: plane waves at " + s.lam + " nm reach a " + (circ ? "circular aperture" : "slit") + " and spread toward a screen; first-minimum angle " +
            (Number.isFinite(t1) ? (t1 * 1e3).toPrecision(3) + " mrad" : "undefined") + ". Animation " + (loop.isRunning() ? "running" : "paused") + ".");
    }


    function redrawData() {
        det.redraw();
        cutH.redraw();
        powH.redraw();
        schH.redraw();
        updateDom();
    }

    function renderNow() {
        renderQueued = false;
        compute();
        redrawData();
    }

    function requestRender() {
        if (renderQueued) return;
        renderQueued = true;
        requestAnimationFrame(renderNow);
    }


    const startBtn = $("startStopBtn");
    const loop = UI.createLoop((dt) => {
        phase += 40 * dt;
        schH.redraw();
    }, {
        onChange: (running) => {
            startBtn.textContent = running ? "⏸ Pause" : "▶ Start";
            startBtn.setAttribute("aria-pressed", running ? "true" : "false");
        }
    });
    startBtn.addEventListener("click", () => loop.toggle());
    $("stepBtn").addEventListener("click", () => {
        loop.stop();
        loop.stepOnce(1 / 15);
    });


    function applyPreset(name) {
        const p = PRESETS[name] || PRESETS.slit100;
        holdBox.checked = false;
        held = null;
        cursor = {
            x: NaN,
            y: 0
        };
        ctl.set(Object.assign({}, DEFAULT_STATE, p.state));
        presetNote = p.note;
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
    document.querySelector(".options-sidebar").addEventListener("input", (e) => {
        if (e.isTrusted && !e.target.closest(".preset-card")) clearPresetHighlight();
    });
    document.querySelector(".options-sidebar").addEventListener("change", (e) => {
        if (e.isTrusted && !e.target.closest(".preset-card")) clearPresetHighlight();
    });

    function clearPresetHighlight() {
        document.querySelectorAll("[data-preset]").forEach((b) => {
            b.classList.remove("active");
            b.setAttribute("aria-pressed", "false");
        });
    }
    $("resetBtn").addEventListener("click", () => {
        loop.stop();
        loop.reset();
        phase = 0;
        applyPreset("slit100");
    });


    const url = UI.urlState({
        get: ctl.get,
        set: ctl.set
    });
    UI.addExportBar($("exportHost"), {
        name: "diffraction",
        url,
        getState: () => Object.assign({
            tool: "diffraction",
            units: {
                a: "µm",
                lam: "nm",
                L: "mm",
                Iin: "W/m²"
            }
        }, ctl.get(), {
            results: S ? {
                firstMinimum_m: S.y1,
                fresnelNumber: S.nf,
                regime: S.regime,
                peak: S.peak,
                peakUnit: quantityLabel(),
                centralLobePowerFraction: S.central,
                detectorPowerFraction: S.captured
            } : null
        }),
        getCSV: () => ({
            headers: ["y (mm)", "sin theta", "I/I0", quantityLabel()],
            rows: S.xs.map((x, i) => [x, Model.sinThetaFromY(x * 1e-3, S.params.L), S.cut.I[i], S.cut.I[i] * S.peak])
        }),
        canvases: [detCanvas, cutCanvas, powCanvas, schCanvas],
        caption: () => S ? ((S.type === "circular" ? "D = " : "a = ") + S.s.a + " µm, λ = " + S.s.lam + " nm, L = " + S.s.L +
            " mm, " + quantityLabel() + ", " + scaleText() + ", Fraunhofer (N_F = " + S.nf.toPrecision(2) + ")") : ""
    });


    $("presetNote").textContent = PRESETS.slit100.note;
    presetNote = PRESETS.slit100.note;
    url.ready.then((restored) => {
        if (restored) clearPresetHighlight();
        renderNow();
    });
    renderNow();
})();