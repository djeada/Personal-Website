"use strict";


(function() {
    const SW = window.OpticsModels.standingWaves;
    const UI = window.OpticsUI;
    const PAL = UI.CANVAS_PALETTE;
    const TWO_PI = 2 * Math.PI;
    const $ = (id) => document.getElementById(id);


    const modeSelect = $("modeSelect");
    const boundarySelect = $("boundaryType");
    const mirrorSelect = $("mirrorConfig");
    const n2Slider = $("n2Slider");
    const rMagSlider = $("rMagSlider");
    const rPhaseSlider = $("rPhaseSlider");
    const freqSlider = $("frequencySlider");
    const modeSlider = $("modeSlider");
    const mirrorRSlider = $("mirrorRSlider");
    const lengthSlider = $("lengthSlider");
    const indexSlider = $("indexSlider");
    const phaseSlider = $("phaseSlider");
    const periodSlider = $("periodSlider");
    const showIncidentCheck = $("showIncident");
    const showReflectedCheck = $("showReflected");
    const showHCheck = $("showH");
    const startStopBtn = $("startStopBtn");
    const stepBtn = $("stepBtn");
    const resetBtn = $("resetBtn");
    const presetButtons = Array.from(document.querySelectorAll("[data-preset]"));
    const presetExpect = $("presetExpect");
    const readout = $("modelReadout");
    const warnEl = $("swWarn");
    const spectrumPanel = $("spectrumPanel");
    const fieldLegend = $("fieldLegend");


    const MIRROR_CONFIGS = {
        "pec-pec": {
            r1: SW.REFLECTOR_PRESETS.pec.r,
            r2: SW.REFLECTOR_PRESETS.pec.r,
            label: "PEC | PEC"
        },
        "pmc-pmc": {
            r1: SW.REFLECTOR_PRESETS.pmc.r,
            r2: SW.REFLECTOR_PRESETS.pmc.r,
            label: "PMC | PMC"
        },
        "pec-pmc": {
            r1: SW.REFLECTOR_PRESETS.pec.r,
            r2: SW.REFLECTOR_PRESETS.pmc.r,
            label: "PEC | PMC"
        },
    };


    const DEFAULTS = {
        mode: "single",
        bnd: "pec",
        n2: 1.5,
        rm: 0.5,
        rp: 180,
        f: 500,
        mir: "pec-pec",
        m: 4,
        R: 0.9,
        L: 1.5,
        n: 1,
        phi: 0,
        per: 2,
        inc: false,
        ref: false,
        h: false,
    };

    const PRESETS = {
        pec: {
            values: {
                mode: "single",
                bnd: "pec",
                n: 1,
                L: 1.5,
                f: 500
            },
            expect: "Expect: an E node exactly on the mirror, further nodes every λ/2 = 299.8 nm, SWR = ∞, and η²|H|² = 4 at the surface.",
        },
        glass: {
            values: {
                mode: "single",
                bnd: "dielectric",
                n: 1,
                n2: 1.5,
                L: 1.5,
                f: 500
            },
            expect: "Expect: r = −0.2, an E minimum of 0.8 E₀ at the interface, SWR = 1.5, and 96 % of the power transmitted.",
        },
        glassOut: {
            values: {
                mode: "single",
                bnd: "dielectric",
                n: 1.5,
                n2: 1,
                L: 1.5,
                f: 500
            },
            expect: "Expect: r = +0.2, an E maximum of 1.2 E₀ at the interface, and SWR = 1.5 with λ = 399.7 nm in the glass.",
        },
        absorber: {
            values: {
                mode: "single",
                bnd: "absorber",
                n: 1,
                L: 1.5,
                f: 500,
                h: true
            },
            expect: "Expect: a pure travelling wave, flat envelope |E| = E₀, SWR = 1, no extrema, and E and H in phase at every x.",
        },
        cavity1: {
            values: {
                mode: "resonator",
                mir: "pec-pec",
                m: 1,
                n: 1,
                L: 1.5,
                R: 0.9
            },
            expect: "Expect: ν₁ = c/(2L) = 99.93 THz, one antinode at the centre, and nodes on both mirrors.",
        },
        cavity4: {
            values: {
                mode: "resonator",
                mir: "pec-pec",
                m: 4,
                n: 1,
                L: 1.5,
                R: 0.9
            },
            expect: "Expect: ν₄ = 399.7 THz with 5 nodes and 4 antinodes. At R = 0.9, F ≈ 29.8 and δν ≈ 3.35 THz.",
        },
        quarter: {
            values: {
                mode: "resonator",
                mir: "pec-pmc",
                m: 3,
                n: 1,
                L: 1.5,
                R: 0.9
            },
            expect: "Expect: quarter-wave modes ν = (2m − 1)c/(4L), so ν₃ = 249.8 THz, with a node at x = 0 and an antinode at x = L.",
        },
        micro: {
            values: {
                mode: "resonator",
                mir: "pec-pec",
                m: 8,
                n: 3.5,
                L: 1.5,
                R: 0.99
            },
            expect: "Worked example: ν₈ = 228.4 THz (λ₀ = 1312.5 nm), FSR = 28.55 THz, F = 312.6, δν = 91.3 GHz, Q ≈ 2500, τ = 1.74 ps.",
        },
    };

    const COLORS = {
        e: "#ff9f6b",
        envE: "rgba(255, 159, 107, 0.7)",
        h: "#69f5e7",
        envH: "rgba(105, 245, 231, 0.6)",
        inc: "#8ab4ff",
        ref: "#f187c8",
        sum: PAL.textMuted,
        node: "#ff6b8b",
        antinode: "#7ee787",
        wall: "#e4e0f5",
        airy: "#f8d477",
        mode: "#a78bfa",
    };
    const DASH = {
        env: [5, 4],
        envH: [2, 3],
        inc: [7, 4],
        ref: [10, 3, 2, 3],
        h: [7, 4],
        sum: [2, 3]
    };
    const BEYOND_FRAC = 0.2;


    let opticalTime = 0;
    let probeFrac = 0.5;
    let specCursorTHz = NaN;
    let cache = null;
    let cacheKey = "";
    let state = null;
    let pr = null;
    let fieldMap = null,
        energyMap = null,
        specMap = null;
    let applyingPreset = false;
    let specPngBtn = null;

    function readState() {
        const mode = modeSelect.value;
        const n = +indexSlider.value;
        const L = +lengthSlider.value * 1e-6;
        const st = {
            mode: mode,
            n: n,
            L: L,
            phi0: (+phaseSlider.value * Math.PI) / 180
        };
        if (mode === "resonator") {
            const cfg = MIRROR_CONFIGS[mirrorSelect.value] || MIRROR_CONFIGS["pec-pec"];
            const m = Math.max(1, Math.round(+modeSlider.value));
            st.mirrors = cfg;
            st.r1 = cfg.r1;
            st.r2 = cfg.r2;
            st.modeNumber = m;
            st.nu = SW.resonatorModeFrequency(m, n, L, cfg.r1.phase, cfg.r2.phase);
            st.fsr = SW.freeSpectralRange(n, L);
            st.modes = SW.resonatorModes(n, L, cfg.r1.phase, cfg.r2.phase, m + 3);
            st.R = Math.min(0.999, Math.max(0, +mirrorRSlider.value));
            st.finesse = SW.finesse(st.R, st.R);
            st.fwhm = SW.airyFWHM(n, L, st.R, st.R);
            st.life = SW.cavityLifetime(st.nu, n, L, st.R, st.R);
        } else {
            st.nu = +freqSlider.value * 1e12;
            st.boundary = boundarySelect.value;
            if (st.boundary === "dielectric") {
                st.n2 = +n2Slider.value;
                st.r = SW.reflectionFromIndices(n, st.n2);
            } else if (st.boundary === "custom") {
                st.r = SW.complexPolar(+rMagSlider.value, (+rPhaseSlider.value * Math.PI) / 180);
            } else {
                st.r = (SW.REFLECTOR_PRESETS[st.boundary] || SW.REFLECTOR_PRESETS.pec).r;
            }
        }
        st.period = 1 / st.nu;
        st.slowdown = +periodSlider.value * st.nu;
        return st;
    }


    function getProfile(st) {
        const key = JSON.stringify([st.mode, st.n, st.L, st.nu, st.r, st.r1, st.r2, st.n2]);
        if (key !== cacheKey) {
            const periods = st.L / SW.wavelengthInMedium(st.nu, st.n);
            const samples = Math.min(8000, Math.max(1200, Math.ceil(periods * 64)));
            const p = SW.profile(st, samples);
            const N = p.x.length;
            p.xUm = Float64Array.from(p.x, (v) => v * 1e6);
            p.negEnvE = Float64Array.from(p.envE, (v) => -v);
            p.negEnvH = Float64Array.from(p.envH, (v) => -v);
            p.e2 = Float64Array.from(p.envE, (v) => v * v);
            p.h2 = Float64Array.from(p.envH, (v) => v * v);
            p.sum = Float64Array.from(p.e2, (v, i) => v + p.h2[i]);
            p.bufE = new Float64Array(N);
            p.bufH = new Float64Array(N);
            p.bufInc = new Float64Array(N);
            p.bufRef = new Float64Array(N);


            const xRef = p.maxima.length ? p.maxima[0] : (st.mode === "single" ? st.L : 0);
            const ref = SW.phasors(p.cfg, xRef);
            p.timeOriginPhase = -Math.atan2(ref.eIm, ref.eRe);

            if (st.mode === "single") {
                const M = 240;
                p.beyondUm = new Float64Array(M);
                p.beyondRe = new Float64Array(M);
                p.beyondIm = new Float64Array(M);
                p.bufBeyond = new Float64Array(M);
                for (let i = 0; i < M; i++) {
                    const d = (st.L * BEYOND_FRAC * i) / (M - 1);
                    p.beyondUm[i] = (st.L + d) * 1e6;
                    if (st.boundary === "dielectric") {
                        const t = SW.transmittedPhasor(st.nu, st.n, st.n2, d);
                        p.beyondRe[i] = t.re;
                        p.beyondIm[i] = t.im;
                    } else if (st.boundary === "pec") {
                        p.beyondRe[i] = 0;
                        p.beyondIm[i] = 0;
                    } else {
                        p.beyondRe[i] = NaN;
                        p.beyondIm[i] = NaN;
                    }
                }
            }
            cache = p;
            cacheKey = key;
        }
        return cache;
    }


    const fmtFreq = (nu) => UI.formatSI(nu, "Hz", 4);
    const fmtLen = (m) => UI.formatSI(m, "m", 4);
    const fmtNum = (v, d) => (Number.isFinite(v) ? v.toFixed(d) : "∞");
    const fmtPhaseDeg = (rad) => Math.round((SW.wrapPhase(rad) * 180) / Math.PI) + "°";

    function fmtR(r) {
        if (r.mag === 0) return "0";
        return r.mag.toFixed(2) + " ∠" + fmtPhaseDeg(r.phase);
    }

    function fmtSci(v) {
        if (!isFinite(v)) return "∞";
        const e = Math.floor(Math.log10(v));
        return (v / Math.pow(10, e)).toFixed(2) + "×10" + superscript(e);
    }

    function superscript(n) {
        const map = {
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
        return String(n).split("").map((c) => map[c]).join("");
    }


    function phiNow() {
        return state.phi0 + pr.timeOriginPhase;
    }

    function omegaT() {
        return TWO_PI * state.nu * opticalTime;
    }

    function probeX() {
        return probeFrac * state.L;
    }

    function probeValues() {
        const p = SW.phasors(pr.cfg, probeX());
        const e2 = p.eRe * p.eRe + p.eIm * p.eIm;
        const h2 = p.hRe * p.hRe + p.hIm * p.hIm;

        const re = p.eRe * p.hRe + p.eIm * p.hIm;
        const im = p.eIm * p.hRe - p.eRe * p.hIm;
        const lag = e2 > 1e-20 && h2 > 1e-20 ? (Math.atan2(im, re) * 180) / Math.PI : NaN;
        return {
            p: p,
            e2: e2,
            h2: h2,
            lag: lag,
            flux: re / 2
        };
    }


    function textStrip(ctx, text, x, y, align, color, bold) {
        ctx.font = (bold ? "600 " : "") + "12px " + PAL.font;
        ctx.textAlign = align;
        ctx.textBaseline = "alphabetic";
        ctx.fillStyle = color || PAL.text;
        ctx.fillText(text, x, y);
    }

    function diamond(ctx, x, y, s) {
        ctx.beginPath();
        ctx.moveTo(x, y - s);
        ctx.lineTo(x + s, y);
        ctx.lineTo(x, y + s);
        ctx.lineTo(x - s, y);
        ctx.closePath();
        ctx.fill();
    }


    function drawField(ctx, w, h) {
        if (!state) return;
        const single = state.mode === "single";
        const Lum = state.L * 1e6;
        const xMax = single ? Lum * (1 + BEYOND_FRAC) : Lum;
        const wt = omegaT(),
            phi = phiNow();
        const N = pr.x.length;
        const series = [];
        series.push({
            xs: pr.xUm,
            ys: pr.envE,
            color: COLORS.envE,
            dash: DASH.env,
            width: 1.25
        });
        series.push({
            xs: pr.xUm,
            ys: pr.negEnvE,
            color: COLORS.envE,
            dash: DASH.env,
            width: 1.25
        });
        if (showHCheck.checked) {
            series.push({
                xs: pr.xUm,
                ys: pr.envH,
                color: COLORS.envH,
                dash: DASH.envH,
                width: 1.25
            });
            series.push({
                xs: pr.xUm,
                ys: pr.negEnvH,
                color: COLORS.envH,
                dash: DASH.envH,
                width: 1.25
            });
        }
        if (showIncidentCheck.checked) {
            for (let i = 0; i < N; i++) pr.bufInc[i] = SW.instantaneous(pr.incRe[i], pr.incIm[i], wt, phi);
            series.push({
                xs: pr.xUm,
                ys: pr.bufInc,
                color: COLORS.inc,
                dash: DASH.inc,
                width: 1.5
            });
        }
        if (showReflectedCheck.checked) {
            for (let i = 0; i < N; i++) pr.bufRef[i] = SW.instantaneous(pr.refRe[i], pr.refIm[i], wt, phi);
            series.push({
                xs: pr.xUm,
                ys: pr.bufRef,
                color: COLORS.ref,
                dash: DASH.ref,
                width: 1.5
            });
        }
        if (showHCheck.checked) {
            for (let i = 0; i < N; i++) pr.bufH[i] = SW.instantaneous(pr.hRe[i], pr.hIm[i], wt, phi);
            series.push({
                xs: pr.xUm,
                ys: pr.bufH,
                color: COLORS.h,
                dash: DASH.h,
                width: 2
            });
        }
        for (let i = 0; i < N; i++) pr.bufE[i] = SW.instantaneous(pr.eRe[i], pr.eIm[i], wt, phi);
        series.push({
            xs: pr.xUm,
            ys: pr.bufE,
            color: COLORS.e,
            width: 2.75
        });
        if (single && pr.beyondUm) {
            for (let i = 0; i < pr.beyondUm.length; i++) pr.bufBeyond[i] = SW.instantaneous(pr.beyondRe[i], pr.beyondIm[i], wt, phi);
            series.push({
                xs: pr.beyondUm,
                ys: pr.bufBeyond,
                color: COLORS.e,
                width: 2.75
            });
        }
        const xp = probeX() * 1e6;
        fieldMap = UI.plot(ctx, {
            x: 0,
            y: 0,
            w: w,
            h: h
        }, {
            x: {
                min: 0,
                max: xMax,
                label: "x",
                unit: "µm"
            },
            y: {
                min: -2.85,
                max: 2.3,
                label: "E / E₀",
                ticks: [-2, -1, 0, 1, 2]
            },
            series: series,
            legend: false,
            margin: {
                t: 28
            },
            hlines: [{
                y: 0,
                color: PAL.gridStrong,
                dash: [4, 4]
            }],
            cursor: {
                x: xp
            },
        });
        const P = fieldMap.plot;
        const X = fieldMap.xToPx,
            Y = fieldMap.yToPx;
        const wallR = X(Lum),
            wallL = X(0);

        let nameW = 0;

        if (single) {
            const fills = {
                pec: "rgba(228, 224, 245, 0.22)",
                pmc: "rgba(105, 245, 231, 0.12)",
                absorber: "rgba(0, 0, 0, 0.45)",
                dielectric: "rgba(167, 139, 250, " + Math.min(0.32, 0.06 + 0.1 * ((state.n2 || 1) - 1)) + ")",
                custom: "rgba(184, 178, 207, 0.14)",
            };
            const names = {
                pec: "PEC",
                pmc: "ideal PMC",
                absorber: "absorber",
                dielectric: "n₂ = " + (state.n2 || 1).toFixed(2),
                custom: "reflector"
            };
            ctx.fillStyle = fills[state.boundary] || fills.custom;
            ctx.fillRect(wallR, P.y, P.x + P.w - wallR, P.h);

            ctx.font = "600 12px " + PAL.font;
            const name = names[state.boundary] || "";
            nameW = ctx.measureText(name).width;
            const nx = Math.min(w - 4 - nameW, wallR + 6);
            textStrip(ctx, name, nx, P.y - 9, "left", PAL.textMuted, true);
        }


        const wall = (px, thick) => {
            ctx.strokeStyle = COLORS.wall;
            ctx.lineWidth = thick ? 3 : 1.5;
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.moveTo(px, P.y);
            ctx.lineTo(px, P.y + P.h);
            ctx.stroke();
        };
        if (single) {
            wall(wallR, state.boundary !== "dielectric" && state.boundary !== "absorber");
            textStrip(ctx, "r = " + fmtR(state.r), Math.min(wallR, w - 4 - nameW - 12) - 6, P.y - 9, "right", PAL.text, true);
        } else {
            wall(wallL + 1.5, true);
            wall(wallR - 1.5, true);
            textStrip(ctx, "r₁ = " + fmtR(state.r1), wallL, P.y - 9, "left", PAL.text, true);
            textStrip(ctx, "r₂ = " + fmtR(state.r2), wallR, P.y - 9, "right", PAL.text, true);
        }


        const perfect = pr.cfg.r.mag >= 1 - 1e-12;
        const spacingPx = ((pr.wavelength / 2) * 1e6 / xMax) * P.w;
        ctx.font = "600 12px " + PAL.font;
        const labelText = perfect ? "N" : "min";
        const labelW = ctx.measureText(labelText).width;
        const showLabels = spacingPx > labelW + 10;
        const walls = single ? [wallR] : [wallL, wallR];
        ctx.save();
        pr.minima.forEach((x) => {
            const px = X(x * 1e6);
            ctx.fillStyle = COLORS.node;
            ctx.strokeStyle = PAL.background;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(px, Y(0), perfect ? 5 : 4, 0, TWO_PI);
            ctx.fill();
            ctx.stroke();
            if (!perfect) {

                ctx.fillRect(px - 5, Y(pr.eMin) - 1, 10, 2);
                ctx.fillRect(px - 5, Y(-pr.eMin) - 1, 10, 2);
            }
            if (showLabels) {



                let lx = px,
                    align = "center",
                    skip = false;
                for (const wx of walls) {
                    if (Math.abs(px - wx) < 14) {
                        align = px <= P.x + P.w / 2 ? "left" : "right";
                        lx = align === "left" ? wx + 7 : wx - 7;
                        if (spacingPx < 2 * labelW + 22) skip = true;
                    }
                }
                if (!skip) textStrip(ctx, labelText, lx, Y(0) + 20, align, COLORS.node, true);
            }
        });
        ctx.fillStyle = COLORS.antinode;
        pr.maxima.forEach((x) => {
            const px = X(x * 1e6);
            diamond(ctx, px, Y(pr.eMax), 5);
            diamond(ctx, px, Y(-pr.eMax), 5);
        });
        ctx.restore();


        const pxp = X(xp);
        if (pxp >= P.x && pxp <= P.x + P.w) {
            const label = "xₚ = " + xp.toFixed(3) + " µm";
            ctx.font = "12px " + PAL.mono;
            const tw = ctx.measureText(label).width;
            const lx = Math.min(P.x + P.w - tw - 6, Math.max(P.x + 4, pxp + 6));
            const ly = Y(-2.47);
            ctx.fillStyle = "rgba(7, 7, 13, 0.9)";
            ctx.fillRect(lx - 3, ly - 9, tw + 6, 18);
            ctx.fillStyle = PAL.cursor;
            ctx.textBaseline = "middle";
            ctx.textAlign = "left";
            ctx.fillText(label, lx, ly);
        }
    }

    function legendHTML(items) {
        return items.map(([color, dash, label, shape]) => {
            let sw;
            if (shape === "circle") sw = '<svg width="16" height="12" viewBox="0 0 16 12"><circle cx="8" cy="6" r="4.5" fill="' + color + '"/></svg>';
            else if (shape === "diamond") sw = '<svg width="16" height="12" viewBox="0 0 16 12"><path d="M8 1 L13 6 L8 11 L3 6 Z" fill="' + color + '"/></svg>';
            else sw = '<svg width="26" height="12" viewBox="0 0 26 12"><line x1="1" y1="6" x2="25" y2="6" stroke="' + color + '" stroke-width="2.5"' + (dash && dash.length ? ' stroke-dasharray="' + dash.join(" ") + '"' : "") + "/></svg>";
            return '<span class="sw-legend-item">' + sw + "<span>" + label + "</span></span>";
        }).join("");
    }

    function updateLegend() {
        const res = state.mode === "resonator";
        const perfect = pr.cfg.r.mag >= 1 - 1e-12;
        const items = [
            [COLORS.e, [], "E(x, t)"],
            [COLORS.envE, DASH.env, "±|Ẽ(x)| envelope"]
        ];
        if (showHCheck.checked) items.push([COLORS.h, DASH.h, "ηH(x, t)"], [COLORS.envH, DASH.envH, "±η|H̃(x)|"]);
        if (showIncidentCheck.checked) items.push([COLORS.inc, DASH.inc, res ? "−x wave" : "incident"]);
        if (showReflectedCheck.checked) items.push([COLORS.ref, DASH.ref, res ? "+x wave" : "reflected"]);
        items.push([COLORS.node, null, perfect ? "node (E = 0)" : "E minimum", "circle"]);
        items.push([COLORS.antinode, null, "E maximum", "diamond"]);
        fieldLegend.innerHTML = legendHTML(items);
    }


    function drawEnergy(ctx, w, h) {
        if (!state) return;
        const xp = probeX() * 1e6;
        const pv = probeValues();
        energyMap = UI.plot(ctx, {
            x: 0,
            y: 0,
            w: w,
            h: h
        }, {
            x: {
                min: 0,
                max: state.L * 1e6,
                label: "x",
                unit: "µm"
            },
            y: {
                min: 0,
                max: 4.4,
                label: "energy density / (εE₀²/4)",
                ticks: [0, 1, 2, 3, 4]
            },
            series: [{
                    xs: pr.xUm,
                    ys: pr.e2,
                    color: COLORS.e,
                    width: 2.25,
                    label: "|Ẽ|²/E₀²"
                },
                {
                    xs: pr.xUm,
                    ys: pr.h2,
                    color: COLORS.h,
                    width: 2,
                    dash: DASH.h,
                    label: "η²|H̃|²/E₀²"
                },
                {
                    xs: pr.xUm,
                    ys: pr.sum,
                    color: COLORS.sum,
                    width: 1.5,
                    dash: DASH.sum,
                    label: "sum"
                },
            ],
            legend: false,
            margin: {
                t: 26
            },
            cursor: {
                x: xp,
                label: "|Ẽ|² = " + pv.e2.toFixed(3)
            },
        });
        drawMiniLegend(ctx, energyMap.plot, [
            [COLORS.e, [], "|Ẽ|²"],
            [COLORS.h, DASH.h, "η²|H̃|²"],
            [COLORS.sum, DASH.sum, "sum"]
        ]);
    }


    function drawMiniLegend(ctx, P, items) {
        ctx.save();
        ctx.font = "12px " + PAL.font;
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        let x = P.x + 4;
        const y = Math.max(8, P.y - 9);
        items.forEach(([color, dash, label]) => {
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.setLineDash(dash || []);
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + 18, y);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = PAL.text;
            ctx.fillText(label, x + 22, y);
            x += 22 + ctx.measureText(label).width + 12;
        });
        ctx.restore();
    }


    function drawTrace(ctx, w, h) {
        if (!state) return;
        const T = state.period;
        const Tfs = T * 1e15;
        const M = 241;
        const ts = new Float64Array(M),
            es = new Float64Array(M),
            hs = new Float64Array(M);
        const p = SW.phasors(pr.cfg, probeX());
        const phi = phiNow();
        for (let i = 0; i < M; i++) {
            const t = (2 * T * i) / (M - 1);
            ts[i] = t * 1e15;
            es[i] = SW.instantaneous(p.eRe, p.eIm, TWO_PI * state.nu * t, phi);
            hs[i] = SW.instantaneous(p.hRe, p.hIm, TWO_PI * state.nu * t, phi);
        }
        const tNow = ((opticalTime % (2 * T)) + 2 * T) % (2 * T);
        const map = UI.plot(ctx, {
            x: 0,
            y: 0,
            w: w,
            h: h
        }, {
            x: {
                min: 0,
                max: 2 * Tfs,
                label: "t",
                unit: "fs"
            },
            y: {
                min: -2.3,
                max: 2.3,
                label: "field / E₀",
                ticks: [-2, -1, 0, 1, 2]
            },
            series: [{
                    xs: ts,
                    ys: es,
                    color: COLORS.e,
                    width: 2.25,
                    label: "E"
                },
                {
                    xs: ts,
                    ys: hs,
                    color: COLORS.h,
                    width: 2,
                    dash: DASH.h,
                    label: "ηH"
                },
            ],
            legend: false,
            hlines: [{
                y: 0,
                color: PAL.gridStrong,
                dash: [4, 4]
            }],
            cursor: {
                x: tNow * 1e15
            },
            margin: {
                t: 26
            },
        });
        drawMiniLegend(ctx, map.plot, [
            [COLORS.e, [], "E(xₚ, t)"],
            [COLORS.h, DASH.h, "ηH(xₚ, t)"]
        ]);
    }


    function spectrumData() {
        const fsr = state.fsr;
        const nuM = state.nu;
        const lo = Math.max(0, nuM - 2.5 * fsr),
            hi = nuM + 2.5 * fsr;
        const p = {
            n: state.n,
            L: state.L,
            R1: state.R,
            R2: state.R,
            theta1: state.r1.phase,
            theta2: state.r2.phase
        };
        const pts = [];
        const U = 1600;
        for (let i = 0; i <= U; i++) pts.push(lo + ((hi - lo) * i) / U);

        const width = Number.isFinite(state.fwhm) ? state.fwhm : fsr / Math.max(1, state.finesse);
        const allModes = SW.resonatorModes(state.n, state.L, state.r1.phase, state.r2.phase, state.modeNumber + 4);
        const inWindow = allModes.filter((md) => md.nu >= lo && md.nu <= hi);
        inWindow.forEach((md) => {
            for (let j = -120; j <= 120; j++) {
                const nu = md.nu + (j / 120) * 6 * width;
                if (nu >= lo && nu <= hi) pts.push(nu);
            }
        });
        pts.sort((a, b) => a - b);
        const xs = new Float64Array(pts.length),
            ys = new Float64Array(pts.length);
        pts.forEach((nu, i) => {
            xs[i] = nu / 1e12;
            ys[i] = SW.airyTransmission(nu, p);
        });
        return {
            xs: xs,
            ys: ys,
            lo: lo,
            hi: hi,
            modes: inWindow,
            params: p
        };
    }

    let specCache = null,
        specKey = "";

    function drawSpectrum(ctx, w, h) {
        if (!state || state.mode !== "resonator") return;
        const key = JSON.stringify([state.n, state.L, state.R, state.modeNumber, mirrorSelect.value]);
        if (key !== specKey) {
            specCache = spectrumData();
            specKey = key;
        }
        const sd = specCache;
        const markers = sd.modes.map((md) => ({
            x: md.nu / 1e12,
            label: md.m === state.modeNumber ? "m = " + md.m : "",
            color: md.m === state.modeNumber ? PAL.marker : "rgba(167, 139, 250, 0.7)",
            dash: md.m === state.modeNumber ? [] : [3, 4],
        }));
        let cursor = null;
        if (Number.isFinite(specCursorTHz) && specCursorTHz >= sd.lo / 1e12 && specCursorTHz <= sd.hi / 1e12) {
            const T = SW.airyTransmission(specCursorTHz * 1e12, sd.params);
            cursor = {
                x: specCursorTHz,
                label: specCursorTHz.toFixed(2) + " THz  T = " + T.toFixed(3)
            };
        }
        specMap = UI.plot(ctx, {
            x: 0,
            y: 0,
            w: w,
            h: h
        }, {
            x: {
                min: sd.lo / 1e12,
                max: sd.hi / 1e12,
                label: "ν",
                unit: "THz"
            },
            y: {
                min: 0,
                max: 1.08,
                label: "transmission T",
                ticks: [0, 0.25, 0.5, 0.75, 1]
            },
            series: [{
                xs: sd.xs,
                ys: sd.ys,
                color: COLORS.airy,
                width: 2,
                fill: true
            }],
            legend: false,
            markers: markers,
            hlines: [{
                y: 0.5,
                color: PAL.gridStrong,
                dash: [2, 4]
            }],
            cursor: cursor,
            margin: {
                t: 26
            },
        });
        drawMiniLegend(ctx, specMap.plot, [
            [COLORS.airy, [], "Airy T(ν), R = " + state.R.toFixed(3)],
            ["rgba(167, 139, 250, 0.9)", [3, 4], "ideal modes"]
        ]);
    }


    const fieldCanvas = $("fieldCanvas"),
        energyCanvas = $("energyCanvas"),
        traceCanvas = $("traceCanvas"),
        spectrumCanvas = $("spectrumCanvas");
    state = readState();
    pr = getProfile(state);
    const fieldView = UI.setupCanvas(fieldCanvas, {
        aspect: 2.5,
        minHeight: 280,
        maxHeight: 420,
        draw: drawField
    });
    const energyView = UI.setupCanvas(energyCanvas, {
        aspect: 1.55,
        minHeight: 230,
        maxHeight: 340,
        draw: drawEnergy
    });
    const traceView = UI.setupCanvas(traceCanvas, {
        aspect: 1.55,
        minHeight: 230,
        maxHeight: 340,
        draw: drawTrace
    });
    const spectrumView = UI.setupCanvas(spectrumCanvas, {
        aspect: 3,
        minHeight: 240,
        maxHeight: 360,
        draw: drawSpectrum
    });

    const descField = UI.describeCanvas(fieldCanvas, "Instantaneous electric field along x.", {
        label: "Standing-wave field E(x, t) along x"
    });
    const descEnergy = UI.describeCanvas(energyCanvas, "Time-averaged energy density along x.", {
        label: "Time-averaged electric and magnetic energy density along x"
    });
    const descTrace = UI.describeCanvas(traceCanvas, "Field at the probe versus time.", {
        label: "E and ηH at the probe position versus time"
    });
    const descSpec = UI.describeCanvas(spectrumCanvas, "Cavity transmission spectrum.", {
        label: "Cavity mode frequencies and Airy transmission spectrum"
    });


    function row(k, v) {
        return "<div><dt>" + k + "</dt><dd>" + v + "</dd></div>";
    }

    function updateReadouts() {
        const single = state.mode === "single";
        const lambda0 = SW.C / state.nu;
        const perfect = pr.cfg.r.mag >= 1 - 1e-12;
        const pv = probeValues();
        const xp = probeX();

        $("stat-freq").textContent = fmtFreq(state.nu);
        $("stat-lambda").textContent = fmtLen(pr.wavelength);
        $("stat-boundary").textContent = single ? fmtR(state.r) : state.mirrors.label;
        $("stat-swr").textContent = single ? (isFinite(pr.swr) ? pr.swr.toFixed(2) : "∞") : "∞";
        $("stat-nodes").textContent = pr.minima.length;
        $("stat-nodes-label").textContent = perfect ? "Nodes (E = 0)" : "E minima";

        const rows = [];
        rows.push(row("Vacuum wavelength λ₀ = c/ν", fmtLen(lambda0)));
        rows.push(row("Medium wavelength λ = λ₀/n", fmtLen(pr.wavelength)));
        rows.push(row("Minimum spacing λ/2", fmtLen(pr.wavelength / 2)));
        if (single) {
            rows.push(row("|E| max E₀(1 + |r|)", pr.eMax.toFixed(3) + " E₀"));
            rows.push(row("|E| min E₀(1 − |r|)", pr.eMin.toFixed(3) + " E₀"));
            rows.push(row("SWR (1 + |r|)/(1 − |r|)", isFinite(pr.swr) ? pr.swr.toFixed(3) : "∞"));
            rows.push(row("Net power ⟨S⟩/S<sub>inc</sub> = 1 − |r|²", pr.netPower.toFixed(3)));
            if (state.boundary === "dielectric") {
                rows.push(row("Fresnel r = (n₁ − n₂)/(n₁ + n₂)", ((state.n - state.n2) / (state.n + state.n2)).toFixed(3)));
                rows.push(row("Transmitted t = 1 + r", SW.transmissionFromIndices(state.n, state.n2).toFixed(3)));
            }
            if (pr.minima.length) {
                const d = state.L - pr.minima[pr.minima.length - 1];
                rows.push(row("First minimum in front of boundary", d < 1e-12 ? "0 (at surface)" : fmtLen(d)));
            }
        } else {
            rows.push(row("Mode ν<sub>" + state.modeNumber + "</sub>", fmtFreq(state.nu)));
            rows.push(row("Free spectral range c/(2nL)", fmtFreq(state.fsr)));
            rows.push(row("Antinodes / E nodes", pr.maxima.length + " / " + pr.minima.length));
            rows.push(row("Allowed ν<sub>m</sub> (THz)", state.modes.slice(0, Math.max(state.modeNumber + 2, 5)).map((md) =>
                (md.m === state.modeNumber ? "<u>" : "") + (md.nu / 1e12).toFixed(1) + (md.m === state.modeNumber ? "</u>" : "")).join(", ")));
            rows.push(row("Finesse F at R = " + state.R.toFixed(3), fmtNum(state.finesse, 1)));
            rows.push(row("Linewidth FSR/F", fmtFreq(state.fsr / state.finesse)));
            rows.push(row("Exact Airy FWHM", Number.isFinite(state.fwhm) ? fmtFreq(state.fwhm) : "no half-maximum"));
            rows.push(row("Q = ν/δν", Number.isFinite(state.fwhm) ? Math.round(state.nu / state.fwhm).toLocaleString("en-US") : "—"));
            rows.push(row("Round trip t<sub>rt</sub> = 2nL/c", UI.formatSI(state.life.roundTripTime, "s", 3)));
            rows.push(row("Photon lifetime τ", UI.formatSI(state.life.tau, "s", 3)));
        }
        rows.push(row("Probe x<sub>p</sub>", fmtLen(xp)));
        rows.push(row("|Ẽ|²/E₀² at x<sub>p</sub>", pv.e2.toFixed(3)));
        rows.push(row("η²|H̃|²/E₀² at x<sub>p</sub>", pv.h2.toFixed(3)));
        rows.push(row("E–H phase arg(Ẽ·ηH̃*)", Number.isFinite(pv.lag) ? pv.lag.toFixed(1) + "°" : "undefined (zero field)"));
        rows.push(row("Optical period T = 1/ν", UI.formatSI(state.period, "s", 4)));
        rows.push(row("Slow-down (wall/optical time)", fmtSci(state.slowdown)));
        readout.innerHTML = rows.join("");


        const warns = [];
        const plotW = fieldMap ? fieldMap.plot.w : 600;
        const spacingPx = ((pr.wavelength / 2) / (single ? state.L * (1 + BEYOND_FRAC) : state.L)) * plotW;
        if (spacingPx < 5) warns.push("λ/2 spans only " + spacingPx.toFixed(1) + " px at this width, so the drawn pattern is under-resolved. Positions, counts and readouts are still exact (analytic).");
        if (!single && Number.isFinite(state.fwhm) && Math.abs(state.fsr / state.finesse - state.fwhm) / state.fwhm > 0.05) {
            warns.push("Low finesse: FSR/F differs from the exact Airy FWHM by " + Math.round((100 * Math.abs(state.fsr / state.finesse - state.fwhm)) / state.fwhm) + " %. The Lorentzian approximation needs R close to 1.");
        }
        if (!single && !Number.isFinite(state.fwhm)) warns.push("The resonances overlap so strongly that T never falls to half its peak.");
        warnEl.hidden = !warns.length;
        warnEl.textContent = warns.join(" ");

        updateDescriptions(pv);
    }

    function updateDescriptions(pv) {
        const single = state.mode === "single";
        const nodes = pr.minima.map((x) => (x * 1e9).toFixed(0)).slice(0, 12).join(", ");
        const perfect = pr.cfg.r.mag >= 1 - 1e-12;
        const where = single ? "Reflector at x = L = " + fmtLen(state.L) + " with r = " + fmtR(state.r) + "." :
            "Resonator " + state.mirrors.label + ", L = " + fmtLen(state.L) + ", mode m = " + state.modeNumber + " at " + fmtFreq(state.nu) + ".";
        descField.update(where + " Medium index " + state.n.toFixed(2) + ", wavelength " + fmtLen(pr.wavelength) + ". " +
            (pr.minima.length ? (perfect ? "Nodes" : "Minima of " + pr.eMin.toFixed(2) + " E₀") + " at x = " + nodes + (pr.minima.length > 12 ? " …" : "") + " nm." : "No extrema: travelling wave.") +
            " Maxima " + pr.eMax.toFixed(2) + " E₀ at " + pr.maxima.length + " positions.");
        descEnergy.update("Time-averaged energy: |E|²/E₀² ranges " + (pr.eMin ** 2).toFixed(2) + " to " + (pr.eMax ** 2).toFixed(2) +
            "; electric plus magnetic is constant at " + (2 * (1 + pr.cfg.r.mag ** 2)).toFixed(2) + ". At the probe x = " + fmtLen(probeX()) +
            ": |E|² = " + pv.e2.toFixed(3) + ", η²|H|² = " + pv.h2.toFixed(3) + ".");
        descTrace.update("At the probe, E and ηH oscillate with period " + UI.formatSI(state.period, "s", 3) + " and peak amplitudes " +
            Math.sqrt(pv.e2).toFixed(2) + " and " + Math.sqrt(pv.h2).toFixed(2) + " E₀; phase difference " + (Number.isFinite(pv.lag) ? pv.lag.toFixed(0) + "°" : "undefined") + ".");
        if (!single) {
            descSpec.update("Ideal modes every " + fmtFreq(state.fsr) + "; selected mode " + state.modeNumber + " at " + fmtFreq(state.nu) +
                ". With mirror reflectance " + state.R.toFixed(3) + " the Airy peaks have finesse " + fmtNum(state.finesse, 1) + " and width " +
                (Number.isFinite(state.fwhm) ? fmtFreq(state.fwhm) : "undefined") + ".");
        }
    }


    function updateVisibility() {
        const single = modeSelect.value === "single";
        $("singleControls").hidden = !single;
        $("resonatorControls").hidden = single;
        $("dielectricGroup").hidden = !(single && boundarySelect.value === "dielectric");
        $("customGroup").hidden = !(single && boundarySelect.value === "custom");
        spectrumPanel.hidden = single;
        $("fieldBadge").textContent = single ? "1D plane wave, to scale" : "ideal mirrors, R → 1";
        if (specPngBtn) specPngBtn.hidden = single;
    }

    function updateLabels() {
        $("frequencyValue").textContent = (+freqSlider.value).toFixed(0) + " THz";
        $("n2Value").textContent = (+n2Slider.value).toFixed(2);
        $("rMagValue").textContent = (+rMagSlider.value).toFixed(2);
        $("rPhaseValue").textContent = rPhaseSlider.value + "°";
        $("modeValue").textContent = modeSlider.value;
        $("mirrorRValue").textContent = (+mirrorRSlider.value).toFixed(3);
        $("lengthValue").textContent = (+lengthSlider.value).toFixed(2) + " µm";
        $("indexValue").textContent = (+indexSlider.value).toFixed(2);
        $("phaseValue").textContent = phaseSlider.value + "°";
        $("periodValue").textContent = (+periodSlider.value).toFixed(1) + " s";
    }

    function drawDynamic() {
        fieldView.redraw();
        traceView.redraw();
        $("stat-time").textContent = (opticalTime * 1e15).toFixed(2) + " fs";
    }

    function updateAll() {
        state = readState();
        pr = getProfile(state);
        updateVisibility();
        updateLabels();
        updateLegend();
        $("stat-slow").textContent = fmtSci(state.slowdown);
        drawDynamic();
        energyView.redraw();
        if (state.mode === "resonator") {

            if (!spectrumView.resize()) spectrumView.redraw();
        }
        updateReadouts();
    }

    let pending = false;

    function scheduleUpdate() {
        if (pending) return;
        pending = true;
        queueMicrotask(() => {
            pending = false;
            updateAll();
        });
    }


    const optsById = {
        frequencySlider: {
            unit: "THz"
        },
        lengthSlider: {
            unit: "µm"
        },
        rPhaseSlider: {
            unit: "°"
        },
        phaseSlider: {
            unit: "°"
        },
        periodSlider: {
            unit: "s"
        },
    };
    UI.enhanceAllSliders(document.querySelector(".options-sidebar"), optsById);

    const ctl = UI.bindControls({
        mode: modeSelect,
        bnd: boundarySelect,
        n2: n2Slider,
        rm: rMagSlider,
        rp: rPhaseSlider,
        f: freqSlider,
        mir: mirrorSelect,
        m: modeSlider,
        R: mirrorRSlider,
        L: lengthSlider,
        n: indexSlider,
        phi: phaseSlider,
        per: periodSlider,
        inc: showIncidentCheck,
        ref: showReflectedCheck,
        h: showHCheck,
    }, () => {
        if (!applyingPreset) setActivePreset(null);
        url.update();
        scheduleUpdate();
    });
    const url = UI.urlState({
        get: ctl.get,
        set: ctl.set
    });

    function profileCSV() {
        const wt = omegaT(),
            phi = phiNow();
        const rows = [];
        for (let i = 0; i < pr.x.length; i++) {
            rows.push([pr.x[i] * 1e6, pr.envE[i], pr.envH[i], pr.e2[i], pr.h2[i],
                SW.instantaneous(pr.eRe[i], pr.eIm[i], wt, phi), SW.instantaneous(pr.hRe[i], pr.hIm[i], wt, phi)
            ]);
        }
        return {
            headers: ["x (um)", "|E|/E0", "eta|H|/E0", "|E|^2/E0^2", "eta^2|H|^2/E0^2", "E(x,t)/E0 at t = " + (opticalTime * 1e15).toFixed(3) + " fs", "etaH(x,t)/E0"],
            rows: rows,
        };
    }

    function exportState() {
        const single = state.mode === "single";
        const out = {
            tool: "standing_waves",
            settings: ctl.get(),
            conventions: "E(x,t) = Re[E~(x) exp(-i(omega t - phi))]; SI units; r defined at the boundary",
            derived: {
                frequency_Hz: state.nu,
                vacuum_wavelength_m: SW.C / state.nu,
                medium_wavelength_m: pr.wavelength,
                E_minima_x_m: Array.from(pr.minima),
                E_maxima_x_m: Array.from(pr.maxima),
                E_min_over_E0: pr.eMin,
                E_max_over_E0: pr.eMax,
                optical_time_s: opticalTime,
            },
        };
        if (single) {
            out.derived.r = {
                mag: state.r.mag,
                phase_rad: state.r.phase
            };
            out.derived.SWR = isFinite(pr.swr) ? pr.swr : "infinite";
            out.derived.net_power_fraction = pr.netPower;
        } else {
            out.derived.mode_number = state.modeNumber;
            out.derived.free_spectral_range_Hz = state.fsr;
            out.derived.preview_mirror_reflectance = state.R;
            out.derived.finesse = state.finesse;
            out.derived.airy_fwhm_Hz = Number.isFinite(state.fwhm) ? state.fwhm : null;
            out.derived.photon_lifetime_s = state.life.tau;
        }
        return out;
    }

    const exportBar = UI.addExportBar($("exportHost"), {
        name: "standing-waves",
        url: url,
        getState: exportState,
        getCSV: profileCSV,
        canvases: [fieldCanvas, energyCanvas, traceCanvas, spectrumCanvas],
        caption: () => state.mode === "single" ?
            "Standing wave: n = " + state.n.toFixed(2) + ", L = " + fmtLen(state.L) + ", ν = " + fmtFreq(state.nu) + ", r = " + fmtR(state.r) : "Resonator " + state.mirrors.label + ": n = " + state.n.toFixed(2) + ", L = " + fmtLen(state.L) + ", m = " + state.modeNumber + ", ν = " + fmtFreq(state.nu) + ", R = " + state.R.toFixed(3),
    });
    specPngBtn = Array.from(exportBar.querySelectorAll("button")).find((b) => b.textContent === "PNG spectrum") || null;


    function setActivePreset(name) {
        presetButtons.forEach((b) => {
            const on = b.dataset.preset === name;
            b.classList.toggle("active", on);
            b.setAttribute("aria-pressed", on ? "true" : "false");
        });
        presetExpect.textContent = name ? PRESETS[name].expect : "Custom settings. Use an experiment button to return to a reproducible setup.";
    }

    function applyPreset(name, extra) {
        applyingPreset = true;
        ctl.set(Object.assign({}, DEFAULTS, PRESETS[name] ? PRESETS[name].values : {}, extra || {}));
        applyingPreset = false;
        opticalTime = 0;
        probeFrac = 0.5;
        specCursorTHz = NaN;
        setActivePreset(PRESETS[name] ? name : null);
        url.update();
        scheduleUpdate();
    }

    presetButtons.forEach((btn) => btn.addEventListener("click", () => applyPreset(btn.dataset.preset)));


    function setProbeFromMap(map, e, canvas) {
        if (!map) return false;
        const rect = canvas.getBoundingClientRect();
        const px = e.clientX - rect.left,
            py = e.clientY - rect.top;
        if (!map.contains(px, py)) return false;
        const xUm = map.pxToX(px);
        probeFrac = Math.min(1, Math.max(0, xUm * 1e-6 / state.L));
        return true;
    }

    function onProbeChanged() {
        fieldView.redraw();
        energyView.redraw();
        traceView.redraw();
        updateReadouts();
    }

    [
        [fieldCanvas, () => fieldMap],
        [energyCanvas, () => energyMap]
    ].forEach(([canvas, getMap]) => {
        let dragging = false;
        canvas.addEventListener("pointerdown", (e) => {
            if (setProbeFromMap(getMap(), e, canvas)) {
                dragging = true;
                try {
                    canvas.setPointerCapture(e.pointerId);
                } catch (err) {

                }
                onProbeChanged();
            }
        });
        canvas.addEventListener("pointermove", (e) => {
            if (!(dragging || e.pointerType === "mouse")) return;
            if (setProbeFromMap(getMap(), e, canvas)) onProbeChanged();
        });
        const end = () => {
            dragging = false;
        };
        canvas.addEventListener("pointerup", end);
        canvas.addEventListener("pointercancel", end);
        canvas.addEventListener("keydown", (e) => {
            if (e.key !== "ArrowLeft" && e.key !== "ArrowRight" && e.key !== "Home" && e.key !== "End") return;
            e.preventDefault();
            const stepFrac = (pr.wavelength / 16) / state.L * (e.shiftKey ? 4 : 1);
            if (e.key === "Home") probeFrac = 0;
            else if (e.key === "End") probeFrac = 1;
            else probeFrac = Math.min(1, Math.max(0, probeFrac + (e.key === "ArrowRight" ? stepFrac : -stepFrac)));
            onProbeChanged();
        });
    });

    spectrumCanvas.addEventListener("pointermove", (e) => {
        if (!specMap) return;
        const rect = spectrumCanvas.getBoundingClientRect();
        const px = e.clientX - rect.left,
            py = e.clientY - rect.top;
        if (specMap.contains(px, py)) {
            specCursorTHz = specMap.pxToX(px);
            spectrumView.redraw();
        }
    });
    spectrumCanvas.addEventListener("keydown", (e) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        e.preventDefault();
        const step = (state.fwhm && Number.isFinite(state.fwhm) ? state.fwhm / 4 : state.fsr / 50) / 1e12 * (e.shiftKey ? 10 : 1);
        if (!Number.isFinite(specCursorTHz)) specCursorTHz = state.nu / 1e12;
        specCursorTHz += e.key === "ArrowRight" ? step : -step;
        spectrumView.redraw();
    });


    const loop = UI.createLoop((dt) => {
        opticalTime += dt / state.slowdown;
        drawDynamic();
    }, {
        onChange: (running) => {
            startStopBtn.innerHTML = running ? '<span aria-hidden="true">⏸️</span> Pause' : '<span aria-hidden="true">▶️</span> Start Animation';
            startStopBtn.setAttribute("aria-pressed", running ? "true" : "false");
        },
    });

    startStopBtn.addEventListener("click", () => loop.toggle());
    stepBtn.addEventListener("click", () => {
        opticalTime += state.period / 16;
        drawDynamic();
    });
    resetBtn.addEventListener("click", () => {
        loop.stop();
        loop.reset();
        applyPreset("pec", {
            inc: false,
            ref: false,
            h: false
        });
    });


    setActivePreset("pec");
    updateAll();
    url.ready.then((restored) => {
        if (restored) setActivePreset(null);
        updateAll();
        if (!UI.prefersReducedMotion()) loop.start();
    });
})();