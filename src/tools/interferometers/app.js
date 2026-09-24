"use strict";



(function() {
    const UI = window.OpticsUI;
    const core = window.OpticsModels.core;
    const IF = window.OpticsModels.interferometers;
    const PAL = UI.CANVAS_PALETTE;
    const c0 = core.constants.c;
    const $ = (id) => document.getElementById(id);
    const fmt = (v, u, d = 3) => core.formatSI(v, u, d);
    const deg = (r) => r * 180 / Math.PI;
    const FS = 12;


    const DEFAULTS = Object.freeze({
        mode: "michelson",
        L1: 100,
        L2: 100,
        d: 5,
        phi: 0,
        psi: 0,
        R1: 50,
        R2: 50,
        e1: 100,
        e2: 100,
        spec: "mono",
        lam: 632.8,
        bw: -2.7,
        nar: 2,
        ths: 0,
        img: "tilted",
        tilt: 80,
        win: 0.3,
        vr: 2,
        scan: "opd",
        spd: 0.5
    });
    const L10 = Math.log10;
    const PRESETS = {
        halfwave: {
            s: {
                spec: "mono",
                lam: 632.8,
                d: 0,
                ths: 0,
                img: "tilted",
                tilt: 60,
                win: L10(1.5),
                vr: 2,
                scan: "opd"
            },
            note: "<strong>Expect:</strong> P₁ = 1 at d = 0. Every λ/2 = 316.4 nm of mirror travel repeats the fringe (one period on the plot), and λ/4 gives a dark detector. Press Step 8 times (8 × λ/16 = λ/2) and P₁ returns to its starting value."
        },
        white: {
            s: {
                spec: "gauss",
                lam: 560,
                bw: L10(120),
                d: 0,
                ths: 0,
                img: "tilted",
                tilt: 150,
                win: L10(4),
                vr: L10(5),
                scan: "opd"
            },
            note: "<strong>Expect:</strong> only 2–3 fringes around Δ = 0. V = ½ at Δ = 2ln2·λ₀²/(πΔλ) = 1.15 µm (d = 0.58 µm). The FT curve and the closed form coincide. The phase-stepped dots sit up to 2 % off because one fringe (0.56 µm) is a large fraction of l<sub>c</sub>, so the envelope changes within the measurement window."
        },
        led: {
            s: {
                spec: "lorentz",
                lam: 850,
                bw: L10(40),
                d: 0,
                ths: 0,
                img: "tilted",
                tilt: 100,
                win: L10(20),
                vr: L10(60),
                scan: "opd"
            },
            note: "<strong>Expect:</strong> V = exp(−πΔν|τ|) with a cusp at Δ = 0. V = 1/e at Δ = λ₀²/(πΔλ) = 5.75 µm. Because of its long spectral tails a Lorentzian loses visibility faster near zero OPD than a Gaussian of the same FWHM."
        },
        rect: {
            s: {
                spec: "rect",
                lam: 600,
                bw: 1,
                d: 0,
                ths: 0,
                img: "tilted",
                tilt: 80,
                win: L10(40),
                vr: 2,
                scan: "opd"
            },
            note: "<strong>Expect:</strong> V = |sinc(πΔντ)|. The fringes vanish at Δ = λ₀²/Δλ = 36.0 µm (d = 18.0 µm) and return with V = 0.217 near Δ = 51.5 µm."
        },
        sodium: {
            s: {
                spec: "sodium",
                bw: L10(0.002),
                nar: 2,
                d: 145.38,
                ths: 0,
                img: "tilted",
                tilt: 60,
                win: L10(800),
                vr: L10(1500),
                scan: "opd"
            },
            note: "<strong>Expect:</strong> the visibility beats between 1 and (2 − 1)/(2 + 1) = 1/3 with OPD period λ₁λ₂/Δλ = 581.5 µm. At d = 145.4 µm (Δ = 290.8 µm) the fringes are at their faintest."
        },
        sodium11: {
            s: {
                spec: "sodium",
                bw: L10(0.002),
                nar: 1,
                d: 145.38,
                ths: 0,
                img: "tilted",
                tilt: 60,
                win: L10(800),
                vr: L10(1500),
                scan: "opd"
            },
            note: "<strong>Expect:</strong> with equal line strengths the fringes vanish completely (V → 0) at d = 145.4 µm, even though P₁ + P₂ = 1. Move d by ±5 µm and they reappear."
        },
        jacquinot: {
            s: {
                spec: "mono",
                lam: 632.8,
                L1: 100,
                L2: 101.25,
                d: 0,
                ths: 40,
                img: "circular",
                scan: "src",
                win: 0.3,
                vr: 3.5
            },
            note: "<strong>Expect:</strong> about 3.2 rings of equal inclination fill the cone θₛ = 40 mrad (Δ = 2.5 mm). The on-axis visibility follows |sinc[kΔ(1 − cos θₛ)/2]|, with its first zero at θₛ = 22.5 mrad."
        },
        crossed: {
            s: {
                spec: "mono",
                lam: 632.8,
                d: 0,
                psi: 90,
                ths: 0,
                img: "tilted",
                tilt: 80,
                scan: "pol"
            },
            note: "<strong>Expect:</strong> orthogonally polarized arms do not interfere, so V = 0 and P₁ = P₂ = ½ for every d, while P₁ + P₂ = 1. The polarization scan shows V = |cos ψ|."
        },
        mz: {
            s: {
                mode: "mz",
                spec: "mono",
                lam: 632.8,
                d: 0,
                ths: 0,
                img: "tilted",
                tilt: 60,
                scan: "opd"
            },
            note: "<strong>Expect:</strong> with the symmetric splitter convention port 1 is dark and port 2 bright at Δ = 0. Setting φ = 180° swaps them. The delay stage adds 2d, so λ/2 of travel is again one fringe."
        },
        mzunbal: {
            s: {
                mode: "mz",
                spec: "mono",
                lam: 632.8,
                R1: 90,
                R2: 50,
                d: 0,
                ths: 0,
                img: "tilted",
                tilt: 60,
                scan: "bs"
            },
            note: "<strong>Expect:</strong> V₁ = 2√(T₁T₂R₁R₂)/(T₁T₂ + R₁R₂) = 0.60 and V₂ = 0.60, while P₁ + P₂ = 1. Unequal amplitudes, not incoherence, reduce the contrast."
        }
    };

    function toCfg(S) {
        return {
            type: S.mode === "mz" ? "mz" : "michelson",
            L1: S.L1 * 1e-3,
            L2: S.L2 * 1e-3,
            d: S.d * 1e-6,
            R1: S.R1 / 100,
            R2: S.R2 / 100,
            eta1: S.e1 / 100,
            eta2: S.e2 / 100,
            phi: S.phi * Math.PI / 180,
            psi: S.psi * Math.PI / 180,
            thetaS: S.ths * 1e-3
        };
    }


    const sidebar = document.querySelector(".options-sidebar");
    const pow10 = (v) => Number(Math.pow(10, v).toPrecision(4));
    UI.enhanceAllSliders(sidebar, {
        bwS: {
            format: pow10,
            parse: (v) => Math.log10(Math.max(1e-5, v)),
            unit: "nm",
            label: "Bandwidth Δλ"
        },
        winS: {
            format: pow10,
            parse: (v) => Math.log10(Math.max(0.2, v)),
            unit: "µm",
            label: "Fringe-plot window"
        },
        vrS: {
            format: pow10,
            parse: (v) => Math.log10(Math.max(1, v)),
            unit: "µm",
            label: "Visibility plot OPD range"
        }
    });
    const ctl = UI.bindControls({
        mode: "#modeSel",
        L1: "#L1S",
        L2: "#L2S",
        d: "#dS",
        phi: "#phiS",
        psi: "#psiS",
        R1: "#R1S",
        R2: "#R2S",
        e1: "#e1S",
        e2: "#e2S",
        spec: "#specSel",
        lam: "#lamS",
        bw: "#bwS",
        nar: "#narS",
        ths: "#thsS",
        img: "#imgSel",
        tilt: "#tiltS",
        win: "#winS",
        vr: "#vrS",
        scan: "#scanSel",
        spd: "#spdS"
    }, () => onStateChange());

    let suppress = false;

    function onStateChange() {
        if (suppress) return;
        clearPresetHighlight();
        url.update();
        scheduleRender();
    }

    function applyState(partial) {
        suppress = true;
        ctl.set(Object.assign({}, DEFAULTS, partial));
        suppress = false;
        url.update();
        scheduleRender();
    }
    const url = UI.urlState({
        get: ctl.get,
        set: (s) => {
            suppress = true;
            ctl.set(s);
            suppress = false;
            scheduleRender();
        }
    });

    const presetNote = $("presetNote");

    function clearPresetHighlight() {
        document.querySelectorAll("#presetButtons .preset-option.active").forEach((b) => b.classList.remove("active"));
    }
    document.querySelectorAll("#presetButtons .preset-option").forEach((btn) => {
        btn.addEventListener("click", () => {
            const p = PRESETS[btn.dataset.preset];
            if (!p) return;
            loop.stop();
            applyState(p.s);
            clearPresetHighlight();
            btn.classList.add("active");
            presetNote.innerHTML = p.note;
        });
    });


    const playBtn = $("playBtn");
    const loop = UI.createLoop((dt) => advance(dt * ctl.get().spd * 8), {
        onChange: (running) => {
            playBtn.innerHTML = running ? '<span aria-hidden="true">⏸</span> Pause scan' : '<span aria-hidden="true">▶</span> Scan mirror';
            playBtn.setAttribute("aria-pressed", String(running));
        }
    });

    function advance(nSixteenths) {
        const S = ctl.get();
        const lamUm = (S.spec === "sodium" ? M.spec.lambda0 * 1e6 : S.lam * 1e-3);
        let d = S.d + nSixteenths * lamUm / 16;
        const el = $("dS");
        if (d > +el.max) d = +el.min + (d - +el.max);
        el.value = String(Number(d.toFixed(6)));
        url.update();
        scheduleRender();
    }
    playBtn.addEventListener("click", () => loop.toggle());
    $("stepBtn").addEventListener("click", () => {
        loop.stop();
        advance(1);
    });
    $("resetBtn").addEventListener("click", () => {
        loop.stop();
        applyState({});
        clearPresetHighlight();
        presetNote.textContent = "Defaults restored: HeNe laser, balanced Michelson, d = 5 µm.";
    });


    const M = {};
    let scanCache = {
            key: "",
            data: null
        },
        lastScanTime = 0;

    function compute() {
        const S = ctl.get();
        const cfg = toCfg(S);
        const A = IF.armCoefficients(cfg);
        const opd = A.paths.opd;
        const winUm = Math.pow(10, S.win),
            vrM = Math.pow(10, S.vr) * 1e-6;
        const tauMax = Math.max(vrM, Math.abs(opd) + 2 * winUm * 1e-6) / c0;
        const spec = IF.spectrum({
            kind: S.spec,
            lambda0: S.lam * 1e-9,
            dLambda: S.spec === "mono" ? 0 : Math.pow(10, S.bw) * 1e-9,
            ratio: S.nar,
            tauMax
        });
        const lam0 = spec.lambda0;
        const terms = IF.portTerms(A);
        const isMi = A.cfg.type === "michelson";
        const thS = isMi ? A.cfg.thetaS : 0;
        Object.assign(M, {
            S,
            cfg: A.cfg,
            A,
            terms,
            opd,
            spec,
            lam0,
            isMi,
            thS,
            winUm,
            vrM
        });
        M.det = IF.detect(null, spec, {
            coefficients: A,
            terms
        });
        M.vis = [IF.measureVisibility(null, spec, 0, {
            coefficients: A
        }), IF.measureVisibility(null, spec, 1, {
            coefficients: A
        })];
        M.mono = IF.monochromatic(null, lam0, {
            coefficients: A
        });
        M.V0 = IF.analyticContrast(A.cfg, 0);
        M.Fsrc = isMi ? IF.sourceSizeFactor(lam0, opd, thS) : 1;
        M.gAbs = IF.analyticDegree(spec, opd / c0);
        M.lengths = IF.coherenceLengths(spec);
        computeFringe();
        M.image = IF.detectorImage(null, spec, {
            coefficients: A,
            mode: S.img,
            nx: 160,
            fov: Math.max(thS, 1e-3) * 1.04,
            tilt: S.tilt * 1e-6,
            beamDiameter: 10e-3
        });
        const now = performance.now();
        if (!loop.isRunning() || S.scan === "opd" || now - lastScanTime > 250) {
            computeScan();
            lastScanTime = now;
        }
    }

    function computeFringe() {
        const {
            S,
            spec,
            A,
            terms,
            opd,
            lam0
        } = M;
        const win = M.winUm,
            d0 = S.d;
        const x0 = d0 - win / 2,
            x1 = d0 + win / 2;
        const fringes = 2 * win * 1e-6 / lam0;
        const envelope = fringes > 90;
        const n = envelope ? 360 : Math.max(200, Math.min(900, Math.round(fringes * 24)));
        const xs = new Float64Array(n),
            p1 = new Float64Array(n),
            p2 = new Float64Array(n),
            lo1 = new Float64Array(n),
            hi1 = new Float64Array(n),
            lo2 = new Float64Array(n),
            hi2 = new Float64Array(n);
        for (let i = 0; i < n; i++) {
            const x = x0 + (x1 - x0) * i / (n - 1);
            xs[i] = x;
            const o = opd + 2 * (x - d0) * 1e-6;
            if (envelope) {
                const g = core.complex.abs(IF.coherence(spec, o, {
                    thetaS: M.thS,
                    carrier: false
                }));
                const a1 = 2 * core.complex.abs(terms[0].X) * g,
                    a2 = 2 * core.complex.abs(terms[1].X) * g;
                lo1[i] = terms[0].A - a1;
                hi1[i] = terms[0].A + a1;
                lo2[i] = terms[1].A - a2;
                hi2[i] = terms[1].A + a2;
            } else {
                const r = IF.detect(null, spec, {
                    coefficients: A,
                    terms,
                    opd: o
                });
                p1[i] = r.P[0];
                p2[i] = r.P[1];
            }
        }
        M.fringe = {
            xs,
            p1,
            p2,
            lo1,
            hi1,
            lo2,
            hi2,
            envelope,
            x0,
            x1,
            fringes
        };
    }

    function computeScan() {
        const {
            S,
            spec,
            A,
            cfg,
            opd,
            lam0,
            isMi
        } = M;
        const scan = S.scan;
        const gAn = (o) => IF.analyticDegree(spec, o / c0);
        const F = (o, th) => (isMi ? IF.sourceSizeFactor(lam0, o, th) : 1);
        let data;
        if (scan === "opd") {
            const key = JSON.stringify([S.mode, S.L1, S.L2, S.phi, S.psi, S.R1, S.R2, S.e1, S.e2, S.spec, S.lam, S.bw, S.nar, S.ths, S.vr]);
            if (scanCache.key === key) {
                M.scan = scanCache.data;
                return;
            }
            const vr = M.vrM;
            const useMm = vr >= 1e-2;
            const k = useMm ? 1e3 : 1e6;
            const n = 121;
            const xs = [],
                meas = [],
                ft = [],
                an = [];
            for (let i = 0; i < n; i++) {
                const o = vr * i / (n - 1);
                xs.push(o * k);
                meas.push(IF.measureVisibility(null, spec, 0, {
                    coefficients: A,
                    opd: o
                }).V);
                const f = F(o, M.thS);
                ft.push(M.V0 * core.complex.abs(IF.coherence(spec, o, {
                    carrier: false
                })) * f);
                an.push(M.V0 * gAn(o) * f);
            }
            data = {
                scan,
                xs,
                series: [meas, ft, an],
                k,
                unit: useMm ? "mm" : "µm",
                label: "OPD Δ",
                xmax: vr * k
            };
            scanCache = {
                key,
                data
            };
        } else {
            const xs = [],
                m1 = [],
                m2 = [],
                a1 = [],
                a2 = [];
            let n, xmax, unit, label;
            const set = (i) => {
                const t = i / (n - 1);
                const c = Object.assign({}, cfg);
                let x, thS = M.thS;
                if (scan === "src") {
                    x = 60 * t;
                    thS = x * 1e-3;
                    c.thetaS = thS;
                } else if (scan === "pol") {
                    x = 180 * t;
                    c.psi = x * Math.PI / 180;
                } else if (scan === "bs") {
                    x = 100 * t;
                    c.R1 = x / 100;
                } else {
                    x = 100 * t;
                    c.eta2 = x / 100;
                }
                return {
                    x,
                    c,
                    thS
                };
            };
            if (scan === "src") {
                n = 61;
                xmax = 60;
                unit = "mrad";
                label = "Source radius θₛ";
            } else if (scan === "pol") {
                n = 61;
                xmax = 180;
                unit = "°";
                label = "Rotation ψ";
            } else if (scan === "bs") {
                n = 51;
                xmax = 100;
                unit = "%";
                label = "BS1 reflectance R₁";
            } else {
                n = 51;
                xmax = 100;
                unit = "%";
                label = "Arm 2 transmission η₂";
            }
            for (let i = 0; i < n; i++) {
                const {
                    x,
                    c,
                    thS
                } = set(i);
                const Ac = IF.armCoefficients(c);
                xs.push(x);
                m1.push(IF.measureVisibility(null, spec, 0, {
                    coefficients: Ac,
                    opd
                }).V);
                m2.push(IF.measureVisibility(null, spec, 1, {
                    coefficients: Ac,
                    opd
                }).V);
                const env = gAn(opd) * F(opd, thS);
                a1.push(IF.analyticContrast(c, 0) * env);
                a2.push(IF.analyticContrast(c, 1) * env);
            }
            data = {
                scan,
                xs,
                series: [m1, a1, m2, a2],
                unit,
                label,
                xmax
            };
        }
        M.scan = data;
    }


    const beamColor = () => {
        const nm = M.lam0 * 1e9;
        if (nm < 400 || nm > 700) return PAL.series[0];
        return UI.wavelengthToCSS(nm);
    };

    function text(ctx, s, x, y, opts = {}) {
        ctx.save();
        ctx.font = (opts.weight ? opts.weight + " " : "") + (opts.size || FS) + "px " + PAL.font;
        ctx.fillStyle = opts.color || PAL.text;
        ctx.textAlign = opts.align || "left";
        ctx.textBaseline = opts.baseline || "middle";
        if (opts.bg) {
            const w = ctx.measureText(s).width,
                hgt = (opts.size || FS) + 6;
            const bx = opts.align === "center" ? x - w / 2 : opts.align === "right" ? x - w : x;
            ctx.fillStyle = "rgba(7, 7, 13, 0.82)";
            ctx.fillRect(bx - 3, y - hgt / 2, w + 6, hgt);
            ctx.fillStyle = opts.color || PAL.text;
        }
        ctx.fillText(s, x, y);
        ctx.restore();
    }

    function beam(ctx, x1, y1, x2, y2, power, color) {
        if (!(power > 1e-4)) {
            ctx.save();
            ctx.strokeStyle = PAL.grid;
            ctx.setLineDash([3, 4]);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
            ctx.restore();
            return;
        }
        ctx.save();
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.35 + 0.65 * Math.min(1, power);
        ctx.lineWidth = 1.2 + 6 * Math.min(1, power);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.restore();
    }

    function arrowHead(ctx, x, y, ang, size, color) {
        ctx.save();
        ctx.fillStyle = color;
        ctx.translate(x, y);
        ctx.rotate(ang);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-size, size * 0.5);
        ctx.lineTo(-size, -size * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    function splitter(ctx, x, y, s, label) {
        ctx.save();
        ctx.strokeStyle = "#c9d6ff";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x - s, y + s);
        ctx.lineTo(x + s, y - s);
        ctx.stroke();
        ctx.restore();
        if (label) text(ctx, label, x + s + 4, y + s + 8, {
            color: PAL.textMuted,
            size: 11
        });
    }

    function mirrorLine(ctx, x1, y1, x2, y2) {
        ctx.save();
        ctx.strokeStyle = "#e6e6f0";
        ctx.lineWidth = 4;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.restore();
    }

    function box(ctx, x, y, w, h, label, active) {
        ctx.save();
        ctx.fillStyle = active ? "rgba(248, 212, 119, 0.22)" : "rgba(184, 178, 207, 0.12)";
        ctx.strokeStyle = active ? PAL.marker : PAL.axis;
        ctx.lineWidth = 1;
        ctx.fillRect(x - w / 2, y - h / 2, w, h);
        ctx.strokeRect(x - w / 2 + 0.5, y - h / 2 + 0.5, w - 1, h - 1);
        ctx.restore();
        text(ctx, label, x, y, {
            align: "center",
            size: 11,
            color: active ? PAL.marker : PAL.text
        });
    }

    function detector(ctx, x, y, label, power, side) {
        ctx.save();
        ctx.fillStyle = "#2b2b3d";
        ctx.strokeStyle = PAL.textMuted;
        ctx.fillRect(x - 9, y - 9, 18, 18);
        ctx.strokeRect(x - 8.5, y - 8.5, 17, 17);
        ctx.fillStyle = beamColor();
        ctx.globalAlpha = Math.min(1, Math.max(0.05, power));
        ctx.fillRect(x - 6, y - 6, 12, 12);
        ctx.restore();
        const s = label + ": " + power.toFixed(3);
        if (side === "left") text(ctx, s, x - 14, y, {
            align: "right",
            bg: true
        });
        else if (side === "below") text(ctx, s, x + 9, y + 22, {
            align: "right",
            bg: true
        });
        else if (side === "above") text(ctx, s, x, y - 20, {
            align: "center",
            bg: true
        });
        else text(ctx, s, x + 14, y, {
            bg: true
        });
    }


    function drawDiagram(ctx, w, h) {
        ctx.fillStyle = PAL.background;
        ctx.fillRect(0, 0, w, h);
        if (!M.cfg) return;
        if (M.isMi) drawMichelson(ctx, w, h);
        else drawMZ(ctx, w, h);
    }

    function drawMichelson(ctx, w, h) {
        const {
            S,
            cfg,
            det
        } = M;
        const col = beamColor();
        const T = 1 - cfg.R1,
            R = cfg.R1;
        const bx = w * 0.34,
            by = h * 0.6;
        const availR = w - bx - 40,
            availU = by - 44;
        const scale = Math.min(availR, availU) / Math.max(S.L1, S.L2);
        const len1 = S.L1 * scale,
            len2 = S.L2 * scale;
        const m1x = bx + len1,
            m2y = by - len2;
        const sx = 26;

        beam(ctx, sx, by, bx, by, 1, col);
        beam(ctx, bx, by - 3, m1x, by - 3, T, col);
        beam(ctx, bx, by + 3, m1x, by + 3, T * cfg.eta1, col);
        beam(ctx, bx - 3, by, bx - 3, m2y, R, col);
        beam(ctx, bx + 3, by, bx + 3, m2y, R * cfg.eta2, col);
        beam(ctx, bx, by, bx, h - 40, det.P[0], col);
        beam(ctx, bx, by + 7, sx + 30, by + 7, det.P[1], col);
        arrowHead(ctx, sx + 30, by + 7, Math.PI, 8, PAL.textMuted);

        ctx.save();
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(sx - 4, by, 8, 0, 2 * Math.PI);
        ctx.fill();
        ctx.restore();
        text(ctx, "Source", sx - 12, by - 20, {
            size: 11,
            color: PAL.textMuted
        });

        splitter(ctx, bx, by, 16, "");
        text(ctx, "BS R = " + S.R1 + " %", bx + 20, by + 22, {
            size: 11,
            color: PAL.textMuted
        });
        mirrorLine(ctx, m1x, by - 18, m1x, by + 18);
        text(ctx, "M₁", m1x + 6, by - 26, {
            size: 11,
            color: PAL.textMuted
        });
        mirrorLine(ctx, bx - 18, m2y, bx + 18, m2y);
        text(ctx, "M₂", bx + 24, m2y - 2, {
            size: 11,
            color: PAL.textMuted
        });

        ctx.save();
        ctx.strokeStyle = PAL.marker;
        ctx.lineWidth = 1.5;
        const dir = S.d >= 0 ? -1 : 1;
        ctx.beginPath();
        ctx.moveTo(bx - 28, m2y);
        ctx.lineTo(bx - 28, m2y + dir * 16);
        ctx.stroke();
        arrowHead(ctx, bx - 28, m2y + dir * 16, dir < 0 ? -Math.PI / 2 : Math.PI / 2, 7, PAL.marker);
        ctx.restore();
        text(ctx, "d = " + fmt(S.d * 1e-6, "m", 4), bx - 34, m2y + 4, {
            align: "right",
            size: 11,
            color: PAL.marker,
            bg: true
        });

        const ey = (by + m2y) / 2;
        box(ctx, bx, ey - 16, 30, 20, "φ", Math.abs(S.phi) > 0);
        box(ctx, bx, ey + 12, 30, 20, "ψ", Math.abs(S.psi) > 0);
        text(ctx, "L₂ = " + S.L2.toFixed(3) + " mm", bx + 22, m2y + 26, {
            size: 11,
            color: PAL.textMuted
        });
        text(ctx, "L₁ = " + S.L1.toFixed(3) + " mm", (bx + m1x) / 2 + 12, by - 16, {
            align: "center",
            size: 11,
            color: PAL.textMuted
        });
        detector(ctx, bx, h - 30, "P₁", det.P[0], "right");
        text(ctx, "P₂ (return): " + det.P[1].toFixed(3), sx - 14, by + 44, {
            size: 11,
            bg: true
        });
        text(ctx, "Δ = 2(L₂ + d − L₁) = " + fmt(M.opd, "m", 5), 10, 16, {
            size: 12,
            weight: 600
        });
    }

    function drawMZ(ctx, w, h) {
        const {
            S,
            cfg,
            det
        } = M;
        const col = beamColor();
        const T1 = 1 - cfg.R1,
            R1 = cfg.R1;
        const x1 = w * 0.24,
            x2 = w * 0.7,
            yb = h * 0.76,
            yt = h * 0.26;
        const sx = 20;
        beam(ctx, sx, yb, x1, yb, 1, col);
        beam(ctx, x1, yb, x2, yb, T1, col);
        beam(ctx, x2, yb, x2, yt, T1 * cfg.eta1, col);
        beam(ctx, x1, yb, x1, yt, R1, col);
        beam(ctx, x1, yt, x2, yt, R1 * cfg.eta2, col);
        beam(ctx, x2, yt, x2, 26, det.P[0], col);
        beam(ctx, x2, yt, w - 30, yt, det.P[1], col);
        ctx.save();
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(sx - 2, yb, 7, 0, 2 * Math.PI);
        ctx.fill();
        ctx.restore();
        splitter(ctx, x1, yb, 15, "");
        text(ctx, "BS1 " + S.R1 + " %", x1 - 16, yb + 24, {
            size: 11,
            color: PAL.textMuted,
            align: "right"
        });
        splitter(ctx, x2, yt, 15, "");
        text(ctx, "BS2 " + S.R2 + " %", x2 - 18, yt + 26, {
            size: 11,
            color: PAL.textMuted,
            align: "right"
        });

        mirrorLine(ctx, x2 - 14, yb + 14, x2 + 14, yb - 14);
        mirrorLine(ctx, x1 - 14, yt + 14, x1 + 14, yt - 14);
        text(ctx, "arm 1: L₁ = " + S.L1.toFixed(3) + " mm", (x1 + x2) / 2 + 6, yb + 22, {
            align: "center",
            size: 11,
            color: PAL.textMuted
        });
        const ex = (x1 + x2) / 2;
        box(ctx, ex - 40, yt, 26, 20, "φ", Math.abs(S.phi) > 0);
        box(ctx, ex - 8, yt, 26, 20, "ψ", Math.abs(S.psi) > 0);
        box(ctx, ex + 34, yt, 40, 20, "+2d", Math.abs(S.d) > 0);
        text(ctx, "arm 2: L₂ = " + S.L2.toFixed(3) + " mm", ex, yt - 24, {
            align: "center",
            size: 11,
            color: PAL.textMuted
        });
        detector(ctx, x2, 20, "P₁", det.P[0], "left");
        detector(ctx, w - 22, yt, "P₂", det.P[1], "below");
        text(ctx, "Δ = L₂ + 2d − L₁ = " + fmt(M.opd, "m", 5), 10, h - 12, {
            size: 12,
            weight: 600
        });
    }


    function drawPhasors(ctx, w, h) {
        ctx.fillStyle = PAL.background;
        ctx.fillRect(0, 0, w, h);
        if (!M.mono) return;
        const names = M.isMi ? ["Port 1 (detector)", "Port 2 (return)"] : ["Port 1 (BS2 up)", "Port 2 (BS2 right)"];
        const cw = w / 2;
        const R = Math.max(30, Math.min(cw * 0.36, (h - 110) / 2));
        for (let p = 0; p < 2; p++) {
            const cxp = cw * p + cw / 2,
                cyp = 30 + R + 8;
            const [c1, c2] = M.mono.contributions[p];
            const a1 = c1[0],
                a2 = c2[0];
            const perp = c2[1].re * c2[1].re + c2[1].im * c2[1].im;
            const ref = core.complex.abs(a1) > 1e-9 ? core.complex.arg(a1) : core.complex.arg(a2);
            const rot = core.complex.expi(-ref);
            const u1 = core.complex.mul(a1, rot),
                u2 = core.complex.mul(a2, rot);
            const sum = core.complex.add(u1, u2);
            text(ctx, names[p], cxp, 14, {
                align: "center",
                weight: 600
            });
            ctx.save();
            ctx.strokeStyle = PAL.gridStrong;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(cxp, cyp, R, 0, 2 * Math.PI);
            ctx.stroke();
            ctx.strokeStyle = PAL.grid;
            ctx.beginPath();
            ctx.moveTo(cxp - R - 6, cyp);
            ctx.lineTo(cxp + R + 6, cyp);
            ctx.moveTo(cxp, cyp - R - 6);
            ctx.lineTo(cxp, cyp + R + 6);
            ctx.stroke();
            ctx.restore();
            const P = (z) => ({
                x: cxp + z.re * R,
                y: cyp - z.im * R
            });
            const vec = (from, to, color, width, dash) => {
                const d = Math.hypot(to.x - from.x, to.y - from.y);
                if (d < 1) return;
                ctx.save();
                ctx.strokeStyle = color;
                ctx.lineWidth = width;
                ctx.setLineDash(dash || []);
                ctx.beginPath();
                ctx.moveTo(from.x, from.y);
                ctx.lineTo(to.x, to.y);
                ctx.stroke();
                ctx.restore();
                arrowHead(ctx, to.x, to.y, Math.atan2(to.y - from.y, to.x - from.x), 8, color);
            };
            const o = {
                    x: cxp,
                    y: cyp
                },
                t1 = P(u1),
                t2 = P(sum);
            vec(o, t1, PAL.series[0], 2.5);
            vec(t1, t2, PAL.series[1], 2.5, [6, 3]);
            vec(o, t2, PAL.cursor, 1.5, [2, 2]);
            const ph = deg(core.complex.arg(u2) - core.complex.arg(u1));
            let phn = ((ph + 540) % 360) - 180;
            if (phn <= -179.5) phn = 180;
            const ly = cyp + R + 18;
            text(ctx, "— arm 1: |a₁| = " + core.complex.abs(u1).toFixed(3), cxp - cw * 0.44, ly, {
                size: 11,
                color: PAL.series[0]
            });
            text(ctx, "- - arm 2∥: " + core.complex.abs(u2).toFixed(3) + " ∠ " + (core.complex.abs(u2) > 1e-9 ? phn.toFixed(0) + "°" : "—"), cxp - cw * 0.44, ly + 16, {
                size: 11,
                color: PAL.series[1]
            });
            text(ctx, "··· sum: |E∥|² = " + (sum.re * sum.re + sum.im * sum.im).toFixed(3), cxp - cw * 0.44, ly + 32, {
                size: 11
            });
            if (perp > 1e-6) text(ctx, "arm 2⊥ adds " + perp.toFixed(3) + " (no fringe)", cxp - cw * 0.44, ly + 48, {
                size: 11,
                color: PAL.textMuted
            });
        }
        if (w >= 420) text(ctx, "λ₀ = " + fmt(M.lam0, "m", 5) + ", monochromatic, on axis; arm 1 rotated to 0°", w / 2, h - 10, {
            align: "center",
            size: 11,
            color: PAL.textMuted
        });
        else {
            text(ctx, "λ₀ = " + fmt(M.lam0, "m", 5) + ", monochromatic, on axis", w / 2, h - 24, {
                align: "center",
                size: 11,
                color: PAL.textMuted
            });
            text(ctx, "arm 1 rotated to 0°", w / 2, h - 9, {
                align: "center",
                size: 11,
                color: PAL.textMuted
            });
        }
    }


    let fringeMap = null;

    function drawFringe(ctx, w, h) {
        ctx.fillStyle = PAL.background;
        ctx.fillRect(0, 0, w, h);
        const F = M.fringe;
        if (!F) return;
        const S = M.S;
        const markers = [];
        const halfUm = M.lam0 / 2 * 1e6;
        if (!F.envelope && F.fringes < 30) {
            for (const k of [-1, 1]) {
                const x = S.d + k * halfUm;
                if (x > F.x0 && x < F.x1) markers.push({
                    x,
                    label: (k > 0 ? "+" : "−") + "λ/2",
                    color: PAL.textMuted,
                    dash: [3, 4]
                });
            }
        }
        let series;
        if (F.envelope) {
            series = [{
                    xs: F.xs,
                    ys: F.hi1,
                    label: "P₁ envelope",
                    color: PAL.series[0]
                }, {
                    xs: F.xs,
                    ys: F.lo1,
                    color: PAL.series[0]
                },
                {
                    xs: F.xs,
                    ys: F.hi2,
                    label: "P₂ envelope",
                    color: PAL.series[1],
                    dash: [7, 4]
                }, {
                    xs: F.xs,
                    ys: F.lo2,
                    color: PAL.series[1],
                    dash: [7, 4]
                }
            ];
        } else {
            series = [{
                    xs: F.xs,
                    ys: F.p1,
                    label: "P₁",
                    color: PAL.series[0]
                },
                {
                    xs: F.xs,
                    ys: F.p2,
                    label: "P₂",
                    color: PAL.series[1],
                    dash: [7, 4]
                }
            ];
        }
        fringeMap = UI.plot(ctx, {
            x: 0,
            y: 0,
            w,
            h
        }, {
            x: {
                min: F.x0,
                max: F.x1,
                label: "Displacement d",
                unit: "µm"
            },
            y: {
                min: 0,
                max: 1.3,
                label: "P / P_in",
                ticks: [0, 0.2, 0.4, 0.6, 0.8, 1]
            },
            series,
            markers,
            legend: w >= 420,
            cursor: {
                x: S.d,
                label: "P₁ " + M.det.P[0].toFixed(3) + " · P₂ " + M.det.P[1].toFixed(3)
            }
        });
        if (F.envelope) {

            ctx.save();
            ctx.beginPath();
            ctx.rect(fringeMap.plot.x, fringeMap.plot.y, fringeMap.plot.w, fringeMap.plot.h);
            ctx.clip();
            ctx.globalAlpha = 0.16;
            for (const [lo, hi, c] of [
                    [F.lo1, F.hi1, PAL.series[0]],
                    [F.lo2, F.hi2, PAL.series[1]]
                ]) {
                ctx.fillStyle = c;
                ctx.beginPath();
                for (let i = 0; i < F.xs.length; i++) {
                    const p = fringeMap.toPx(F.xs[i], hi[i]);
                    if (i) ctx.lineTo(p.x, p.y);
                    else ctx.moveTo(p.x, p.y);
                }
                for (let i = F.xs.length - 1; i >= 0; i--) {
                    const p = fringeMap.toPx(F.xs[i], lo[i]);
                    ctx.lineTo(p.x, p.y);
                }
                ctx.closePath();
                ctx.fill();
            }
            ctx.restore();
        }
    }


    let imageMap = null;

    function drawImage(ctx, w, h) {
        ctx.fillStyle = PAL.background;
        ctx.fillRect(0, 0, w, h);
        const img = M.image;
        if (!img) return;
        const cb = 74;
        const ml = FS * 4.4,
            mr = FS * 1.1,
            mt = FS * 0.9,
            mb = FS * 3.4;
        const side = Math.max(60, Math.min(w - cb - ml - mr, h - mt - mb));
        const rect = {
            x: Math.max(0, (w - cb - side - ml - mr) / 2),
            y: 0,
            w: side + ml + mr,
            h: side + mt + mb
        };
        const circ = img.mode === "circular";
        const k = 1e3;
        const ex = img.extent;
        imageMap = UI.plot(ctx, rect, {
            x: {
                min: ex.x0 * k,
                max: ex.x1 * k,
                label: circ ? "θx" : "x",
                unit: circ ? "mrad" : "mm"
            },
            y: {
                min: ex.y0 * k,
                max: ex.y1 * k,
                label: circ ? "θy" : "y",
                unit: circ ? "mrad" : "mm"
            },
            series: [],
            legend: false
        });
        const P = imageMap.plot;
        const allNaN = !Number.isFinite(img.opdMin);
        if (!allNaN) UI.imageFromArray(ctx, img.data, img.nx, img.ny, P, "inferno", {
            min: 0,
            max: 1
        });
        ctx.save();
        ctx.strokeStyle = PAL.axis;
        ctx.strokeRect(P.x + 0.5, P.y + 0.5, P.w - 1, P.h - 1);
        ctx.restore();
        UI.drawColorbar(ctx, {
            x: rect.x + rect.w + 24,
            y: P.y,
            w: 12,
            h: P.h
        }, "inferno", {
            min: 0,
            max: 1,
            label: "P₁ / P_in"
        });
        if (allNaN) {
            text(ctx, "Point source: only the axis is lit.", P.x + P.w / 2, P.y + P.h / 2 - 10, {
                align: "center"
            });
            text(ctx, "Raise θₛ to see rings.", P.x + P.w / 2, P.y + P.h / 2 + 10, {
                align: "center",
                color: PAL.textMuted
            });
        }
    }


    function drawSpectrum(ctx, w, h) {
        ctx.fillStyle = PAL.background;
        ctx.fillRect(0, 0, w, h);
        const sp = M.spec;
        if (!sp) return;
        const pts = [];
        let dmax = 0;
        for (let i = 0; i < sp.nu.length; i++) {
            const dens = sp.bin[i] > 0 ? sp.w[i] / sp.bin[i] : 1;
            pts.push([c0 / sp.nu[i] * 1e9, dens]);
            if (dens > dmax) dmax = dens;
        }
        pts.sort((a, b) => a[0] - b[0]);
        const lamNm = sp.lambda0 * 1e9;
        const ln = sp.lines[0];
        const fwhmNm = ln.dNu > 0 ? ln.dNu * sp.lambda0 * sp.lambda0 / c0 * 1e9 : 0;
        let x0, x1;
        if (sp.kind === "sodium") {
            x0 = 588.9;
            x1 = 590.0;
        } else if (ln.shape === "mono") {
            x0 = lamNm - 1;
            x1 = lamNm + 1;
        } else if (ln.shape === "rect") {
            x0 = lamNm - 0.9 * fwhmNm;
            x1 = lamNm + 0.9 * fwhmNm;
        } else {
            const f = ln.shape === "lorentz" ? 5 : 2;
            x0 = lamNm - f * fwhmNm;
            x1 = lamNm + f * fwhmNm;
        }
        let series;
        if (ln.shape === "mono") series = [{
            xs: [lamNm, lamNm],
            ys: [0, 1],
            label: "single line",
            color: PAL.series[0],
            width: 3
        }];
        else {
            const xs = pts.map((p) => p[0]),
                ys = pts.map((p) => p[1] / dmax);
            const visible = xs.filter((x) => x >= x0 && x <= x1).length;
            series = [{
                xs,
                ys,
                label: "s(ν) samples",
                color: PAL.series[0],
                points: visible <= 160,
                fill: true
            }];
        }
        UI.plot(ctx, {
            x: 0,
            y: 0,
            w,
            h
        }, {
            x: {
                min: x0,
                max: x1,
                label: "Vacuum wavelength λ",
                unit: "nm"
            },
            y: {
                min: 0,
                max: 1.08,
                label: "s / s_max"
            },
            series,
            markers: sp.kind === "sodium" ? [{
                x: IF.SODIUM.D2 * 1e9,
                label: "D₂"
            }, {
                x: IF.SODIUM.D1 * 1e9,
                label: "D₁"
            }] : []
        });
    }


    let visMap = null;

    function drawVis(ctx, w, h) {
        ctx.fillStyle = PAL.background;
        ctx.fillRect(0, 0, w, h);
        const D = M.scan;
        if (!D) return;
        const S = M.S;
        let series, markers = [],
            cursorX, xLabel = D.label;
        if (D.scan === "opd") {
            const srcNote = M.isMi && M.thS > 0 ? " × F_src" : "";
            series = [{
                    xs: D.xs,
                    ys: D.series[0],
                    label: "measured (phase stepping)",
                    color: PAL.series[0],
                    pointsOnly: true,
                    pointRadius: 2.6
                },
                {
                    xs: D.xs,
                    ys: D.series[1],
                    label: "V₀|FT s(ν)|" + srcNote,
                    color: PAL.series[1],
                    width: 2
                },
                {
                    xs: D.xs,
                    ys: D.series[2],
                    label: "closed form" + srcNote,
                    color: PAL.series[2],
                    dash: [7, 4],
                    width: 1.6
                }
            ];
            const L = M.lengths;
            if (Number.isFinite(L.halfVisibility) && M.spec.kind !== "sodium" && L.halfVisibility * D.k < D.xmax) markers.push({
                x: L.halfVisibility * D.k,
                label: "l_c (V=½)"
            });
            if (M.spec.kind === "rect") {
                const z = c0 / M.spec.lines[0].dNu;
                if (z * D.k < D.xmax) markers.push({
                    x: z * D.k,
                    label: "λ²/Δλ",
                    color: PAL.series[3]
                });
            }
            if (L.beatOPD)
                for (let m = 1; m <= 6; m++) {
                    const x = m * L.beatOPD / 2 * D.k;
                    if (x < D.xmax) markers.push({
                        x,
                        label: m % 2 ? (m === 1 ? "beat/2" : "") : "",
                        color: PAL.series[3],
                        dash: [2, 4]
                    });
                }
            cursorX = Math.abs(M.opd) * D.k;
            xLabel = "OPD |Δ|";
        } else {
            series = [{
                    xs: D.xs,
                    ys: D.series[0],
                    label: "port 1 measured",
                    color: PAL.series[0],
                    pointsOnly: true,
                    pointRadius: 2.6
                },
                {
                    xs: D.xs,
                    ys: D.series[1],
                    label: "port 1 closed form",
                    color: PAL.series[0],
                    dash: [7, 4],
                    width: 1.5
                },
                {
                    xs: D.xs,
                    ys: D.series[2],
                    label: "port 2 measured",
                    color: PAL.series[1],
                    pointsOnly: true,
                    pointRadius: 2
                },
                {
                    xs: D.xs,
                    ys: D.series[3],
                    label: "port 2 closed form",
                    color: PAL.series[1],
                    dash: [2, 3],
                    width: 1.5
                }
            ];
            cursorX = D.scan === "src" ? S.ths : D.scan === "pol" ? S.psi : D.scan === "bs" ? S.R1 : S.e2;
            if (D.scan === "src" && M.isMi) {
                const th0 = Math.acos(Math.max(-1, 1 - M.lam0 / Math.max(1e-12, Math.abs(M.opd))));
                if (th0 * 1e3 < 60) markers.push({
                    x: th0 * 1e3,
                    label: "Δ(1−cos θₛ)=λ"
                });
            }
        }
        visMap = UI.plot(ctx, {
            x: 0,
            y: 0,
            w,
            h
        }, {
            x: {
                min: 0,
                max: D.xmax,
                label: xLabel,
                unit: D.unit
            },
            y: {
                min: 0,
                max: 1.3,
                label: "Visibility V",
                ticks: [0, 0.2, 0.4, 0.6, 0.8, 1]
            },
            series,
            markers,
            legend: w >= 420,
            cursor: {
                x: cursorX,
                label: "V₁ = " + M.vis[0].V.toFixed(3)
            }
        });
    }


    const cDiagram = UI.setupCanvas($("diagramCanvas"), {
        aspect: 1.45,
        minHeight: 280,
        maxHeight: 420,
        draw: drawDiagram
    });
    const cPhasor = UI.setupCanvas($("phasorCanvas"), {
        aspect: 1.25,
        minHeight: 280,
        maxHeight: 420,
        draw: drawPhasors
    });
    const cFringe = UI.setupCanvas($("fringeCanvas"), {
        aspect: 1.45,
        minHeight: 260,
        maxHeight: 420,
        draw: drawFringe
    });
    const cImage = UI.setupCanvas($("imageCanvas"), {
        aspect: 1.2,
        minHeight: 280,
        maxHeight: 440,
        draw: drawImage
    });
    const cSpec = UI.setupCanvas($("specCanvas"), {
        aspect: 1.6,
        minHeight: 240,
        maxHeight: 380,
        draw: drawSpectrum
    });
    const cVis = UI.setupCanvas($("visCanvas"), {
        aspect: 1.45,
        minHeight: 260,
        maxHeight: 420,
        draw: drawVis
    });
    const canvases = [cDiagram, cPhasor, cFringe, cImage, cSpec, cVis];

    const dDiagram = UI.describeCanvas(cDiagram.canvas, "Interferometer schematic.", {
        label: "Interferometer schematic with beam powers"
    });
    const dPhasor = UI.describeCanvas(cPhasor.canvas, "Path phasors.", {
        label: "Phasor sums of the two arm fields at each output port"
    });
    const dFringe = UI.describeCanvas(cFringe.canvas, "Fringes.", {
        label: "Output port powers versus mirror displacement"
    });
    const dImage = UI.describeCanvas(cImage.canvas, "Detector image.", {
        label: "Port 1 detector image"
    });
    const dSpec = UI.describeCanvas(cSpec.canvas, "Spectrum.", {
        label: "Source power spectrum"
    });
    const dVis = UI.describeCanvas(cVis.canvas, "Visibility scan.", {
        label: "Fringe visibility scan"
    });


    function dragOn(canvas, getMap, apply) {
        let down = false;
        const handle = (e) => {
            const map = getMap();
            if (!map) return;
            const r = canvas.getBoundingClientRect();
            const px = e.clientX - r.left,
                py = e.clientY - r.top;
            if (!map.contains(px, py)) return;
            loop.stop();
            apply(map.pxToX(px));
        };
        canvas.addEventListener("pointerdown", (e) => {
            down = true;
            handle(e);
        });
        canvas.addEventListener("pointermove", (e) => {
            if (down) handle(e);
        });
        window.addEventListener("pointerup", () => {
            down = false;
        });
    }
    const setSlider = (id, v) => {
        const el = $(id);
        el.value = String(Math.min(+el.max, Math.max(+el.min, v)));
        onStateChange();
    };
    dragOn(cFringe.canvas, () => fringeMap, (x) => setSlider("dS", Number(x.toFixed(6))));
    dragOn(cVis.canvas, () => visMap, (x) => {
        const S = ctl.get(),
            D = M.scan;
        if (!D) return;
        if (D.scan === "opd") {
            const o = x / D.k;
            const d = M.isMi ? o / 2 - (S.L2 - S.L1) * 1e-3 : (o - (S.L2 - S.L1) * 1e-3) / 2;
            setSlider("dS", Number((d * 1e6).toFixed(6)));
        } else if (D.scan === "src") setSlider("thsS", Number(x.toFixed(1)));
        else if (D.scan === "pol") setSlider("psiS", Math.round(x));
        else if (D.scan === "bs") setSlider("R1S", Math.round(x));
        else setSlider("e2S", Math.round(x));
    });


    function setText(id, s) {
        const el = $(id);
        if (el && el.textContent !== s) el.textContent = s;
    }

    function lenStr(v) {
        return Number.isFinite(v) ? fmt(v, "m", 4) : "∞ (monochromatic)";
    }

    function updateControlsState() {
        const S = M.S;
        const dis = (groupId, off) => {
            const g = $(groupId);
            if (!g) return;
            g.classList.toggle("is-disabled", off);
            g.querySelectorAll("input").forEach((i) => {
                i.disabled = off;
            });
        };
        dis("R2Group", S.mode !== "mz");
        dis("lamGroup", S.spec === "sodium");
        dis("bwGroup", S.spec === "mono");
        dis("narGroup", S.spec !== "sodium");
        dis("tiltGroup", S.img !== "tilted");
        setText("bwLabel", S.spec === "rect" ? "Full width Δλ (nm, log slider)" : S.spec === "sodium" ? "Line FWHM Δλ each (nm, log slider)" : "Bandwidth FWHM Δλ (nm, log slider)");
        setText("dLabel", S.mode === "mz" ? "Delay stage d in arm 2 (µm; adds 2d)" : "Mirror M₂ displacement d (µm)");
        setText("diagramBadge", S.mode === "mz" ? "Mach–Zehnder" : "Michelson");
        setText("imageBadge", S.img === "tilted" ? "tilted, collimated" : "circular, extended source");
        const vals = {
            L1Val: S.L1.toFixed(3),
            L2Val: S.L2.toFixed(3),
            dVal: S.d.toFixed(4),
            phiVal: S.phi + "°",
            psiVal: S.psi + "°",
            R1Val: S.R1 + " %",
            R2Val: S.R2 + " %",
            e1Val: S.e1 + " %",
            e2Val: S.e2 + " %",
            lamVal: S.spec === "sodium" ? "589.46 (Na)" : S.lam.toFixed(1),
            bwVal: pow10(S.bw) + " nm",
            narVal: S.nar.toFixed(2),
            thsVal: S.ths.toFixed(1),
            tiltVal: String(S.tilt),
            winVal: pow10(S.win) + " µm",
            vrVal: pow10(S.vr) + " µm",
            spdVal: S.spd.toFixed(1)
        };
        for (const k in vals) setText(k, vals[k]);
    }

    function updateReadouts() {
        const {
            det,
            vis,
            opd,
            lam0,
            lengths: L,
            spec,
            S
        } = M;
        const phase = ((deg(2 * Math.PI * opd / lam0 + M.cfg.phi) % 360) + 360) % 360;
        const vth = M.V0 * M.gAbs * M.Fsrc;
        setText("rOpd", fmt(opd, "m", 6));
        setText("rOrder", (opd / lam0).toFixed(3));
        setText("rPhase", phase.toFixed(1) + "°");
        setText("rP", det.P[0].toFixed(4) + " / " + det.P[1].toFixed(4));
        setText("rTot", det.total.toFixed(4) + " (" + Math.max(0, 1 - det.total).toFixed(4) + ")");
        setText("rV", vis[0].V.toFixed(4) + " / " + vis[1].V.toFixed(4));
        setText("rVth", M.V0.toFixed(3) + " × " + M.gAbs.toFixed(4) + " × " + M.Fsrc.toFixed(4) + " = " + vth.toFixed(4));
        setText("rLc", spec.kind === "sodium" ? lenStr(L.halfVisibility) + " (one line)" : lenStr(L.halfVisibility));
        setText("rMandel", lenStr(L.mandel));
        setText("rRule", lenStr(L.ruleOfThumb));
        setText("rBeat", L.beatOPD ? fmt(L.beatOPD, "m", 4) + " / " + fmt(L.beatOPD / 2, "m", 4) : "— (no doublet)");
        setText("rSrc", M.isMi ? M.Fsrc.toFixed(4) + (M.thS > 0 ? " (θₛ = " + S.ths.toFixed(1) + " mrad)" : " (point source)") : "1 (aligned MZ)");
        if (S.img === "tilted") setText("rImg", S.tilt > 0 ? "period λ₀/(2α) = " + fmt(lam0 / (2 * S.tilt * 1e-6), "m", 4) : "α = 0: uniform field");
        else {
            const rings = M.isMi && M.thS > 0 ? Math.abs(opd) * (1 - Math.cos(M.thS)) / lam0 : 0;
            const first = IF.brightRingAngles(opd, lam0, 1)[0];
            setText("rImg", M.isMi ? rings.toFixed(2) + " ring orders in cone" + (first != null && first < M.thS ? "; 1st bright ring " + (first * 1e3).toFixed(2) + " mrad" : "") : "uniform (no angular OPD in MZ)");
        }
        setText("rN", spec.N + (spec.bin[0] > 0 ? " (δν = " + fmt(spec.bin[0], "Hz", 3) + ")" : ""));
        const F = M.fringe;
        setText("fringeCaption", F.envelope ?
            "Fringes are too dense to draw (" + Math.round(F.fringes) + " in the window), so the shaded band shows the envelope (solid P₁, dashed P₂) P = Ī ± 2|X||γ| of each port. Narrow the window to see individual fringes. The vertical line is the current d; click or drag to set it." :
            "Port powers as fractions of the input power (solid P₁, dashed P₂) while the mirror moves (" + F.fringes.toFixed(1) + " fringes, one per λ₀/2 = " + (M.lam0 / 2 * 1e9).toFixed(1) + " nm of travel). The vertical line is the current d; click or drag to set it.");

        setText("stat-opd", fmt(opd, "m", 4));
        setText("stat-p1", det.P[0].toFixed(3));
        setText("stat-p2", det.P[1].toFixed(3));
        setText("stat-vis", vis[0].V.toFixed(3));
        setText("stat-lc", Number.isFinite(L.halfVisibility) ? fmt(L.halfVisibility, "m", 3) : "∞");


        const warns = [];
        if (spec.kind !== "mono" && Number.isFinite(spec.revivalOPD) && spec.revivalOPD < Math.max(M.vrM, Math.abs(opd)) * 1.05) {
            warns.push("The spectral grid (N = " + spec.N + ") would revive at OPD c/δν = " + fmt(spec.revivalOPD, "m") + ", inside the range shown. Bin integration suppresses the revival, but small residual fringes there are sampling artefacts.");
        }
        if (spec.kind === "lorentz") warns.push("The Lorentzian is truncated at ±100 FWHM and renormalised (" + (spec.truncated * 100).toFixed(2) + " % of the power is cut). Its measured visibility therefore sits about that much above exp(−πΔν|τ|) away from τ = 0.");
        if (S.img === "circular" && M.isMi && M.thS > 0) {
            const k = 2 * Math.PI / lam0,
                fov = M.thS * 1.04;
            const phasePerPx = k * Math.abs(opd) * Math.sin(fov) * (2 * fov / 160);
            if (phasePerPx > Math.PI / 2) warns.push("The rings near the edge are closer than the image pixels (" + (phasePerPx / Math.PI).toFixed(1) + "π per pixel), so the outer image is aliased. Reduce |Δ| or θₛ to resolve them.");
        }
        if (S.img === "circular" && !M.isMi) warns.push("An aligned Mach–Zehnder has no angle-dependent OPD, so the circular-fringe image is uniform. Choose tilted fringes.");
        if (S.img === "tilted" && M.isMi && M.thS > 0) warns.push("The tilted-fringe image assumes a collimated point source. θₛ affects only the on-axis detector (P₁, P₂, V) and the circular image.");
        const host = $("warnHost");
        const html = warns.map((w) => '<p class="optics-warning">' + w + "</p>").join("");
        if (host.innerHTML !== html) host.innerHTML = html;
    }

    function updateDescriptions() {
        const {
            det,
            vis,
            opd,
            S,
            lengths: L,
            spec
        } = M;
        const typ = M.isMi ? "Michelson" : "Mach–Zehnder";
        dDiagram.update(typ + " with L1 = " + S.L1.toFixed(3) + " mm, L2 = " + S.L2.toFixed(3) + " mm, d = " + S.d + " µm, BS1 R = " + S.R1 + " %, arm transmissions " + S.e1 + " % and " + S.e2 + " %, phase shifter " + S.phi + "°, polarization rotation " + S.psi + "°. OPD " + fmt(opd, "m", 5) + ". Port powers P1 = " + det.P[0].toFixed(3) + ", P2 = " + det.P[1].toFixed(3) + ".");
        const [c1, c2] = M.mono.contributions[0];
        dPhasor.update("At port 1 arm 1 contributes amplitude " + core.complex.abs(c1[0]).toFixed(3) + " and arm 2 contributes " + core.complex.abs(c2[0]).toFixed(3) + " parallel to it, with relative phase " + (deg(core.complex.arg(core.complex.mul(c2[0], core.complex.conj(c1[0])))) || 0).toFixed(0) + " degrees at the centre wavelength.");
        const F = M.fringe;
        dFringe.update("Port powers over d from " + F.x0.toFixed(3) + " to " + F.x1.toFixed(3) + " µm (" + F.fringes.toFixed(1) + " fringes" + (F.envelope ? ", shown as an envelope" : "") + "). At d = " + S.d + " µm: P1 = " + det.P[0].toFixed(3) + ", P2 = " + det.P[1].toFixed(3) + ". One fringe per " + (M.lam0 / 2 * 1e6).toFixed(4) + " µm of travel.");
        dImage.update(S.img === "tilted" ? "Tilted fringes across a 10 mm collimated beam with M2 tilted by " + S.tilt + " µrad, fringe period " + (S.tilt > 0 ? fmt(M.lam0 / (2 * S.tilt * 1e-6), "m", 3) : "infinite") + "." : "Circular fringes of equal inclination inside a source cone of " + S.ths + " mrad; " + $("rImg").textContent + ".");
        dSpec.update("Spectrum " + spec.kind + " centred at " + fmt(spec.lambda0, "m", 5) + (spec.kind === "mono" ? "" : ", width " + pow10(S.bw) + " nm") + ", sampled with " + spec.N + " points.");
        dVis.update("Visibility scan over " + M.scan.label + ". Current measured visibility at port 1 is " + vis[0].V.toFixed(3) + ", theory " + (M.V0 * M.gAbs * M.Fsrc).toFixed(3) + ". Coherence length at half visibility " + (Number.isFinite(L.halfVisibility) ? fmt(L.halfVisibility, "m") : "infinite") + ".");
    }


    let pending = false;

    function scheduleRender() {
        if (pending) return;
        pending = true;
        requestAnimationFrame(() => {
            pending = false;
            render();
        });
    }

    function render() {
        compute();
        updateControlsState();
        updateReadouts();
        canvases.forEach((c) => c.redraw());
        updateDescriptions();
    }


    UI.addExportBar($("exportHost"), {
        name: "interferometer",
        url,
        getState: () => Object.assign({
            tool: "interferometers"
        }, ctl.get()),
        getCSV: () => {
            const D = M.scan;
            if (D.scan === "opd") return {
                headers: ["OPD (" + D.unit + ")", "V measured port 1", "V0*|FT s(nu)|" + (M.isMi && M.thS > 0 ? "*F_src" : ""), "V closed form"],
                rows: D.xs.map((x, i) => [x, D.series[0][i], D.series[1][i], D.series[2][i]])
            };
            return {
                headers: [D.label + " (" + D.unit + ")", "V1 measured", "V1 closed form", "V2 measured", "V2 closed form"],
                rows: D.xs.map((x, i) => [x, D.series[0][i], D.series[1][i], D.series[2][i], D.series[3][i]])
            };
        },
        canvases: canvases.map((c) => c.canvas),
        caption: () => (M.isMi ? "Michelson" : "Mach–Zehnder") + ", " + M.spec.kind + " source λ0 = " + fmt(M.lam0, "m", 5) + ", OPD = " + fmt(M.opd, "m", 5)
    });

    render();
    url.ready.then(() => scheduleRender());
})();