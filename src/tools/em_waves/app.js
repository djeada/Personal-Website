/*
 * Electromagnetic waves and energy flow — page glue.
 * Physics lives in ../shared/optics/emWaves.js (pure, tested in tests/optics/em_waves.test.js).
 * Units: SI internally; λ in nm, z in µm, t in fs only at the display boundary.
 */
(function() {
    "use strict";

    const UI = window.OpticsUI;
    const core = window.OpticsModels.core;
    const em = window.OpticsModels.emWaves;
    const pal = UI.CANVAS_PALETTE;
    const fmt = (v, u, d) => core.formatSI(v, u, d);
    const $ = (id) => document.getElementById(id);

    const COL = {
        Ex: "#69f5e7",
        Ey: "#8ab4ff",
        Hx: "#ff9f6b",
        Hy: "#f8d477",
        E: "#69f5e7",
        H: "#f8d477",
        S: "#f187c8",
        tot: "#ece9f8"
    };
    const Z_MIN = -2.5,
        Z_MAX = 1.0; // display window in units of λ1
    const NZ = 481,
        NT = 241,
        N_ARROWS = 42;

    const DEFAULTS = {
        lam: 633,
        n1: 1,
        e0: 100,
        pol: "linear",
        psi: 0,
        dl: 90,
        bnd: "none",
        n2: 1.5,
        tph: 0,
        zp: -0.6,
        spd: 0.25,
        sh: true,
        sl: true,
        ss: true
    };

    const PRESETS = {
        vacuum: {
            state: {
                lam: 633,
                n1: 1,
                e0: 100,
                pol: "linear",
                psi: 0,
                bnd: "none",
                zp: -0.6,
                tph: 0
            },
            note: "Expect E ⟂ η₁H ⟂ z at every point; S_z swings between 0 and 2I₀ = 26.5 W/m² at twice the optical frequency, averaging I₀ = 13.3 W/m²; u_E = u_H everywhere."
        },
        circular: {
            state: {
                lam: 633,
                n1: 1.5,
                e0: 100,
                pol: "rcp",
                psi: 0,
                bnd: "none",
                zp: -0.6,
                tph: 0
            },
            note: "Expect arrow tips on a helix, |E| = E₀/√2 = 70.7 V/m at all times, and a perfectly steady S_z = I₀ = 19.9 W/m² (1.5× vacuum, because I = nε₀cE₀²/2)."
        },
        mirror: {
            state: {
                lam: 633,
                n1: 1,
                e0: 100,
                pol: "linear",
                psi: 0,
                bnd: "pec",
                zp: -0.125,
                tph: 0.125
            },
            note: "Expect E nodes at z = 0, −316.5 nm, −633 nm, …, zero net flux ⟨S_z⟩ = 0, and at z_p = −λ₁/8 u_E and u_H peaking a quarter period apart while S_z changes sign."
        },
        airglass: {
            state: {
                lam: 633,
                n1: 1,
                e0: 100,
                pol: "linear",
                psi: 0,
                bnd: "dielectric",
                n2: 1.5,
                zp: -0.25,
                tph: 0
            },
            note: "Expect r = −0.20, R = 4 %, T = 96 %, a partial standing wave with SWR = 1.5 (E envelope minimum at the interface), and ⟨S_z⟩ = 0.96 I₀ at every z in air."
        },
        glassair: {
            state: {
                lam: 633,
                n1: 1.5,
                e0: 100,
                pol: "linear",
                psi: 0,
                bnd: "dielectric",
                n2: 1,
                zp: -0.25,
                tph: 0
            },
            note: "Expect r = +0.20: the same R = 4 %, but now the E envelope has a maximum at the interface (no phase flip on reflection)."
        },
        sunlight: {
            state: {
                lam: 550,
                n1: 1,
                e0: 868,
                pol: "linear",
                psi: 0,
                bnd: "none",
                zp: -0.6,
                tph: 0
            },
            note: "Expect I₀ ≈ 1.00 kW/m², E_rms ≈ 614 V/m, H₀ ≈ 2.30 A/m and a mean energy density I₀/c ≈ 3.34 µJ/m³ (worked example below)."
        }
    };

    // ------------------------------------------------------------------ controls
    const sidebar = document.querySelector(".options-sidebar");
    const deg = (v) => v + "°";
    UI.enhanceAllSliders(sidebar, {
        lamSlider: {
            unit: "nm"
        },
        e0Slider: {
            unit: "V/m"
        },
        psiSlider: {
            unit: "°"
        },
        deltaSlider: {
            unit: "°"
        }
    });

    let state = Object.assign({}, DEFAULTS);
    let cfg = null,
        zs = [],
        sZ = null,
        sT = null,
        ranges = null,
        poynt = null;
    let needModel = true,
        renderQueued = false;

    const ctl = UI.bindControls({
        lam: "#lamSlider",
        n1: "#n1Slider",
        e0: "#e0Slider",
        pol: "#polSelect",
        psi: "#psiSlider",
        dl: "#deltaSlider",
        bnd: "#bndSelect",
        n2: "#n2Slider",
        tph: "#tphSlider",
        zp: "#zpSlider",
        spd: "#spdSlider",
        sh: "#showH",
        sl: "#showLoci",
        ss: "#showS"
    }, (s) => {
        const physics = ["lam", "n1", "e0", "pol", "psi", "dl", "bnd", "n2"].some((k) => s[k] !== state[k]);
        state = s;
        if (physics) {
            needModel = true;
            clearPresetMark();
        }
        url.update();
        queueRender();
    });
    const url = UI.urlState({
        get: ctl.get,
        set: ctl.set
    });

    function clearPresetMark() {
        if (applyingPreset) return;
        document.querySelectorAll(".emw-presets .preset-option").forEach((b) => b.classList.remove("active"));
    }

    let applyingPreset = false;

    function applyState(obj, note) {
        applyingPreset = true;
        ctl.set(obj);
        applyingPreset = false;
        state = ctl.get();
        needModel = true;
        $("presetNote").textContent = note || "";
        queueRender();
    }

    document.querySelectorAll(".emw-presets .preset-option").forEach((btn) => {
        btn.addEventListener("click", () => {
            const p = PRESETS[btn.dataset.preset];
            applyState(Object.assign({}, DEFAULTS, {
                sh: state.sh,
                sl: state.sl,
                ss: state.ss,
                spd: state.spd
            }, p.state), p.note);
            document.querySelectorAll(".emw-presets .preset-option").forEach((b) => b.classList.toggle("active", b === btn));
        });
    });

    // ------------------------------------------------------------------ model
    function polSpec(s) {
        const psi = core.units.toRad(s.psi),
            delta = core.units.toRad(s.dl);
        if (s.pol === "rcp" || s.pol === "lcp") return {
            type: s.pol
        };
        if (s.pol === "elliptical") return {
            type: "elliptical",
            psi,
            delta
        };
        return {
            type: "linear",
            psi
        };
    }

    function rebuildModel() {
        cfg = em.setup({
            lambda0: state.lam * 1e-9,
            n1: state.n1,
            n2: state.n2,
            E0: state.e0,
            pol: polSpec(state),
            boundary: state.bnd
        });
        zs = core.linspace(Z_MIN * cfg.lambda1, Z_MAX * cfg.lambda1, NZ);
        // stable axis ranges from time-independent bounds (|E(t)| ≤ |Ẽ|, |S| ≤ |Ẽ||H̃|)
        let fMax = 0,
            uMax = 0,
            sMax = 0;
        for (const z of zs) {
            const a = em.timeAverage(cfg, z);
            const eps = em.region(cfg, z) === 1 ? cfg.m1.eps : em.region(cfg, z) === 2 ? cfg.m2.eps : 0;
            fMax = Math.max(fMax, a.Eamp, cfg.m1.eta * a.Hamp);
            uMax = Math.max(uMax, 0.5 * eps * a.Eamp * a.Eamp, 0.5 * core.constants.mu0 * a.Hamp * a.Hamp);
            sMax = Math.max(sMax, a.Eamp * a.Hamp);
        }
        // tighter energy/flux bounds from a coarse space-time sweep (fixed per configuration)
        uMax = 0;
        sMax = 0;
        for (let i = 0; i < zs.length; i += 4) {
            for (let j = 0; j < 24; j++) {
                const f = em.fields(cfg, zs[i], j * cfg.period / 24);
                uMax = Math.max(uMax, f.uE, f.uH);
                sMax = Math.max(sMax, Math.abs(f.S[2]));
            }
        }
        ranges = {
            f: fMax || 1,
            u: uMax / cfg.u0 || 1,
            s: sMax / cfg.I0 || 1,
            sAbs: sMax || 1
        };
        // Poynting theorem check away from the interface, several instants
        let worst = 0;
        for (let i = 0; i < 36; i++) {
            const z = (Z_MIN + (i + 0.5) * (Z_MAX - Z_MIN) / 36) * cfg.lambda1;
            if (Math.abs(z) < 0.02 * cfg.lambda1 || em.region(cfg, z) === 0) continue;
            for (let j = 0; j < 5; j++) worst = Math.max(worst, Math.abs(em.poyntingResidual(cfg, z, (j + 0.3) * cfg.period / 5).residual));
        }
        poynt = worst;
        needModel = false;
    }

    const tNow = () => state.tph * cfg.period;
    const zProbe = () => state.zp * cfg.lambda1;

    function sampleAll() {
        sZ = em.sampleZ(cfg, zs, tNow());
        const ts = core.linspace(0, 2 * cfg.period, NT);
        sT = em.sampleT(cfg, zProbe(), ts);
    }

    // ------------------------------------------------------------------ 3-D view
    function layout3D(w, h) {
        const wide = w >= 560;
        if (wide) {
            const insetW = Math.min(190, Math.max(150, w * 0.2));
            return {
                main: {
                    x: 0,
                    y: 0,
                    w: w - insetW,
                    h
                },
                inset: {
                    x: w - insetW,
                    y: 0,
                    w: insetW,
                    h
                }
            };
        }
        const ih = Math.min(170, h * 0.36);
        return {
            main: {
                x: 0,
                y: 0,
                w,
                h: h - ih
            },
            inset: {
                x: 0,
                y: h - ih,
                w,
                h: ih
            }
        };
    }

    function arrow(ctx, x0, y0, x1, y1, color, width, head = 7) {
        const dx = x1 - x0,
            dy = y1 - y0,
            L = Math.hypot(dx, dy);
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
        if (L > head * 1.2) {
            const ux = dx / L,
                uy = dy / L,
                hw = head * 0.45;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x1 - ux * head - uy * hw, y1 - uy * head + ux * hw);
            ctx.lineTo(x1 - ux * head + uy * hw, y1 - uy * head - ux * hw);
            ctx.closePath();
            ctx.fill();
        }
    }

    function text(ctx, s, x, y, opts = {}) {
        ctx.font = `${opts.weight || 500} ${opts.size || 12}px ${pal.font}`;
        ctx.fillStyle = opts.color || pal.text;
        ctx.textAlign = opts.align || "left";
        ctx.textBaseline = opts.base || "alphabetic";
        ctx.fillText(s, x, y);
    }

    function draw3D(ctx, w, h) {
        ctx.fillStyle = pal.background;
        ctx.fillRect(0, 0, w, h);
        if (!cfg || !sZ) return;
        const L = layout3D(w, h),
            M = L.main;
        const A = Math.min(M.h * 0.3, 140); // px for the largest field in the window
        const sc = A / ranges.f; // px per V/m
        const oblX = -0.47,
            oblY = 0.27; // screen direction of +y (toward the viewer)
        const left = M.x + 30 + A * 0.5,
            right = M.x + M.w - 22;
        const zmin = zs[0],
            zmax = zs[zs.length - 1];
        const Kz = (right - left) / (zmax - zmin);
        const yc = M.y + 34 + A;
        const P = (z, x, y) => [left + (z - zmin) * Kz + y * sc * oblX, yc - x * sc + y * sc * oblY];
        const um = (z) => z * 1e6;

        // medium 2 / conductor region
        if (cfg.boundary !== "none") {
            const x0 = P(0, 0, 0)[0];
            ctx.fillStyle = cfg.boundary === "pec" ? "rgba(184,178,207,0.16)" : "rgba(138,180,255,0.08)";
            ctx.fillRect(x0, M.y, right + 12 - x0, M.h - 4);
            // interface plane (parallelogram in x–y)
            const e = ranges.f * 1.08;
            const c1 = P(0, e, -e),
                c2 = P(0, e, e),
                c3 = P(0, -e, e),
                c4 = P(0, -e, -e);
            ctx.fillStyle = "rgba(167,139,250,0.10)";
            ctx.strokeStyle = "rgba(167,139,250,0.55)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(...c1);
            ctx.lineTo(...c2);
            ctx.lineTo(...c3);
            ctx.lineTo(...c4);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            const lab = cfg.boundary === "pec" ? "PEC (z ≥ 0)" : `n₂ = ${cfg.m2.n.toFixed(2)}`;
            text(ctx, lab, x0 + 6, M.y + M.h - 62, {
                color: pal.text,
                weight: 600
            });
        }
        text(ctx, `n₁ = ${cfg.m1.n.toFixed(2)}`, M.x + 8, M.y + 16, {
            color: pal.text,
            weight: 600
        });
        // propagation directions (top-right of the main view, clear of the x axis)
        const kr = M.x + M.w - 10,
            ky = M.y + 16;
        text(ctx, "k̂ incident", kr - 42, ky, {
            color: pal.textMuted,
            size: 11,
            align: "right"
        });
        arrow(ctx, kr - 36, ky - 4, kr, ky - 4, pal.textMuted, 1.6, 6);
        if (cfg.boundary !== "none") {
            text(ctx, `← reflected, r = ${cfg.r.re.toFixed(2)}`, kr, ky + 16, {
                color: pal.textMuted,
                size: 11,
                align: "right"
            });
        }
        // axes: z along the axis, x and y at the left end
        const o = P(zmin, 0, 0);
        ctx.setLineDash([]);
        arrow(ctx, o[0], o[1], right + 12, o[1], pal.axis, 1.2, 8);
        text(ctx, "z", right + 6, o[1] - 8, {
            color: pal.text,
            weight: 700
        });
        const ax = P(zmin, ranges.f * 1.12, 0),
            ay = P(zmin, 0, ranges.f * 1.12);
        arrow(ctx, o[0], o[1], ax[0], ax[1], pal.axis, 1.2, 7);
        arrow(ctx, o[0], o[1], ay[0], ay[1], pal.axis, 1.2, 7);
        text(ctx, "x", ax[0] + 5, ax[1] + 4, {
            color: pal.text,
            weight: 700
        });
        text(ctx, "y", ay[0] - 12, ay[1] + 4, {
            color: pal.text,
            weight: 700
        });

        // tip loci ("trajectories"): dotted, thin — a curve through the tips, not a path
        const eta1 = cfg.m1.eta;
        if (state.sl) {
            ctx.lineWidth = 1.3;
            ctx.setLineDash([2, 3]);
            const curve = (fx, fy, color) => {
                ctx.strokeStyle = color;
                ctx.globalAlpha = 0.85;
                ctx.beginPath();
                for (let i = 0; i < zs.length; i++) {
                    const p = P(zs[i], fx(i), fy(i));
                    i ? ctx.lineTo(...p) : ctx.moveTo(...p);
                }
                ctx.stroke();
                ctx.globalAlpha = 1;
            };
            curve((i) => sZ.Ex[i], (i) => sZ.Ey[i], COL.E);
            if (state.sh) curve((i) => eta1 * sZ.Hx[i], (i) => eta1 * sZ.Hy[i], COL.H);
            ctx.setLineDash([]);
        }

        // field arrows at sample points on the axis
        const t = tNow();
        const nA = Math.round(core.clamp(M.w / 17, 18, N_ARROWS));
        for (let i = 0; i < nA; i++) {
            const z = zmin + (i + 0.5) * (zmax - zmin) / nA;
            if (em.region(cfg, z) === 0) continue;
            const f = em.fields(cfg, z, t);
            const b = P(z, 0, 0);
            if (state.sh) {
                const hp = P(z, eta1 * f.H[0], eta1 * f.H[1]);
                arrow(ctx, b[0], b[1], hp[0], hp[1], COL.H, 1.5, 6);
            }
            const ep = P(z, f.E[0], f.E[1]);
            arrow(ctx, b[0], b[1], ep[0], ep[1], COL.E, 1.8, 6);
        }

        // probe plane + bold arrows
        const zp = zProbe(),
            fp = em.fields(cfg, zp, t);
        {
            const e = ranges.f;
            const c1 = P(zp, e, -e),
                c2 = P(zp, e, e),
                c3 = P(zp, -e, e),
                c4 = P(zp, -e, -e);
            ctx.setLineDash([5, 4]);
            ctx.strokeStyle = pal.textMuted;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(...c1);
            ctx.lineTo(...c2);
            ctx.lineTo(...c3);
            ctx.lineTo(...c4);
            ctx.closePath();
            ctx.stroke();
            ctx.setLineDash([]);
            const b = P(zp, 0, 0);
            if (state.sh) {
                const hp = P(zp, eta1 * fp.H[0], eta1 * fp.H[1]);
                arrow(ctx, b[0], b[1], hp[0], hp[1], COL.H, 3.2, 10);
                text(ctx, "η₁H", hp[0] + 5, hp[1] + 12, {
                    color: COL.H,
                    weight: 700
                });
            }
            const ep = P(zp, fp.E[0], fp.E[1]);
            arrow(ctx, b[0], b[1], ep[0], ep[1], COL.E, 3.4, 10);
            text(ctx, "E", ep[0] + 5, ep[1] - 3, {
                color: COL.E,
                weight: 700
            });
            text(ctx, "z_p", c1[0] - 8, c1[1] - 5, {
                color: pal.textMuted,
                size: 11,
                align: "center"
            });
        }

        // Poynting rail
        const railY = M.y + M.h - 40;
        const railL = left,
            railR = right;
        ctx.strokeStyle = pal.gridStrong;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(railL, railY);
        ctx.lineTo(railR, railY);
        ctx.stroke();
        text(ctx, "S_z", M.x + 6, railY + 4, {
            color: COL.S,
            weight: 700
        });
        if (state.ss) {
            const nS = Math.max(8, Math.round(nA / 2)),
                gap = (railR - railL) / nS;
            for (let i = 0; i < nS; i++) {
                const z = zmin + (i + 0.5) * (zmax - zmin) / nS;
                if (em.region(cfg, z) === 0) continue;
                const s = em.fields(cfg, z, t).S[2] / ranges.sAbs; // −1..1
                const xc = railL + (i + 0.5) * gap,
                    len = s * gap * 0.9;
                if (Math.abs(len) < 1.5) {
                    ctx.fillStyle = COL.S;
                    ctx.beginPath();
                    ctx.arc(xc, railY, 1.8, 0, 7);
                    ctx.fill();
                    continue;
                }
                arrow(ctx, xc - len / 2, railY, xc + len / 2, railY, COL.S, 3, 7);
            }
        }
        // z ticks (µm) under the rail
        const ticks = UI.niceTicks(um(zmin), um(zmax), Math.max(3, Math.round(M.w / 110)));
        for (const tv of ticks) {
            const x = left + (tv * 1e-6 - zmin) * Kz;
            ctx.strokeStyle = pal.axis;
            ctx.beginPath();
            ctx.moveTo(x, railY + 6);
            ctx.lineTo(x, railY + 11);
            ctx.stroke();
            text(ctx, UI.formatTick(tv, ticks.step), x, railY + 24, {
                color: pal.textMuted,
                size: 11,
                align: "center"
            });
        }
        text(ctx, "z (µm)", M.x + 6, railY + 24, {
            color: pal.textMuted,
            size: 11
        });

        drawInset(ctx, L.inset, fp);
    }

    function drawInset(ctx, R, fp) {
        const r = Math.max(34, Math.min(R.w, R.h) * 0.5 - 26);
        const cx = R.x + R.w / 2,
            cy = R.y + R.h / 2 + 8;
        const s = r / ranges.f,
            eta1 = cfg.m1.eta;
        const Q = (x, y) => [cx - y * s, cy - x * s]; // facing the source: x up, y to the left
        ctx.fillStyle = pal.panel;
        ctx.strokeStyle = pal.gridStrong;
        ctx.lineWidth = 1;
        ctx.fillRect(R.x + 4, R.y + 4, R.w - 8, R.h - 8);
        ctx.strokeRect(R.x + 4, R.y + 4, R.w - 8, R.h - 8);
        text(ctx, "at z_p, facing source", cx, R.y + 20, {
            color: pal.textMuted,
            size: 11,
            align: "center"
        });
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, 2 * Math.PI);
        ctx.strokeStyle = pal.grid;
        ctx.stroke();
        arrow(ctx, cx, cy + r, cx, cy - r - 4, pal.axis, 1, 6);
        arrow(ctx, cx + r, cy, cx - r - 4, cy, pal.axis, 1, 6);
        text(ctx, "x", cx + 5, cy - r + 2, {
            color: pal.text,
            weight: 700,
            size: 11
        });
        text(ctx, "y", cx - r - 4, cy - 6, {
            color: pal.text,
            weight: 700,
            size: 11
        });
        // polarisation ellipse traced over one period (dotted)
        ctx.setLineDash([2, 3]);
        ctx.strokeStyle = COL.E;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (let i = 0; i <= 64; i++) {
            const f = em.fields(cfg, zProbe(), i / 64 * cfg.period);
            const p = Q(f.E[0], f.E[1]);
            i ? ctx.lineTo(...p) : ctx.moveTo(...p);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        if (state.sh) {
            const hp = Q(eta1 * fp.H[0], eta1 * fp.H[1]);
            arrow(ctx, cx, cy, hp[0], hp[1], COL.H, 2.6, 8);
        }
        const ep = Q(fp.E[0], fp.E[1]);
        arrow(ctx, cx, cy, ep[0], ep[1], COL.E, 2.8, 8);
        // S along ±z: ⊙ toward the viewer (+z), ⊗ away
        const Sz = fp.S[2],
            mag = Math.abs(Sz) / ranges.sAbs;
        const rr = 4 + 5 * Math.min(1, mag);
        ctx.strokeStyle = COL.S;
        ctx.fillStyle = COL.S;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(cx, cy, rr, 0, 2 * Math.PI);
        ctx.stroke();
        if (mag < 0.01) {
            /* no flow this instant */ } else if (Sz > 0) {
            ctx.beginPath();
            ctx.arc(cx, cy, 2, 0, 2 * Math.PI);
            ctx.fill();
        } else {
            const d = rr * 0.7;
            ctx.beginPath();
            ctx.moveTo(cx - d, cy - d);
            ctx.lineTo(cx + d, cy + d);
            ctx.moveTo(cx + d, cy - d);
            ctx.lineTo(cx - d, cy + d);
            ctx.stroke();
        }
        const sLab = mag < 0.01 ? "S_z ≈ 0" : Sz > 0 ? "S ⊙ toward you (+z)" : "S ⊗ away (−z)";
        text(ctx, sLab, cx, R.y + R.h - 10, {
            color: COL.S,
            size: 11,
            align: "center"
        });
    }

    // ------------------------------------------------------------------ plots
    function shadeRegion2(ctx, map) {
        if (cfg.boundary === "none") return;
        const x0 = map.xToPx(0),
            x1 = map.plot.x + map.plot.w;
        ctx.fillStyle = cfg.boundary === "pec" ? "rgba(184,178,207,0.14)" : "rgba(138,180,255,0.08)";
        ctx.fillRect(x0, map.plot.y, x1 - x0, map.plot.h);
    }

    const zUm = () => Array.from(zs, (z) => z * 1e6);
    const active = () => {
        const J = cfg.J,
            tiny = 1e-9;
        return {
            x: Math.hypot(J.x.re, J.x.im) > tiny,
            y: Math.hypot(J.y.re, J.y.im) > tiny
        };
    };
    const zMarkers = () => {
        const m = [{
            x: zProbe() * 1e6,
            label: "z_p",
            color: pal.cursor,
            dash: [5, 4]
        }];
        if (cfg.boundary !== "none") m.push({
            x: 0,
            label: "z = 0",
            color: pal.marker,
            dash: [2, 3]
        });
        return m;
    };

    let mapZF, mapTF, mapZE, mapTE;

    function drawZField(ctx, w, h) {
        if (!cfg || !sZ) return;
        const xs = zUm(),
            a = active(),
            eta1 = cfg.m1.eta,
            series = [];
        if (a.x) series.push({
            xs,
            ys: sZ.Ex,
            color: COL.Ex,
            label: "E_x",
            width: 2
        });
        if (a.y) series.push({
            xs,
            ys: sZ.Ey,
            color: COL.Ey,
            label: "E_y",
            width: 2,
            dash: [8, 3]
        });
        if (a.y) series.push({
            xs,
            ys: Array.from(sZ.Hx, (v) => eta1 * v),
            color: COL.Hx,
            label: "η₁H_x",
            width: 2,
            dash: [2, 3]
        });
        if (a.x) series.push({
            xs,
            ys: Array.from(sZ.Hy, (v) => eta1 * v),
            color: COL.Hy,
            label: "η₁H_y",
            width: 2,
            dash: [6, 4]
        });
        series.push({
            xs,
            ys: sZ.envE,
            color: pal.textMuted,
            label: "±|Ẽ|",
            width: 1,
            dash: [1, 3]
        });
        series.push({
            xs,
            ys: Array.from(sZ.envE, (v) => -v),
            color: pal.textMuted,
            width: 1,
            dash: [1, 3]
        });
        const F = ranges.f * 1.1;
        mapZF = UI.plot(ctx, {
            x: 0,
            y: 0,
            w,
            h
        }, {
            x: {
                min: xs[0],
                max: xs[xs.length - 1],
                label: "z",
                unit: "µm"
            },
            y: {
                min: -F,
                max: F,
                label: "field",
                unit: "V/m"
            },
            series,
            markers: zMarkers()
        });
        shadeRegion2(ctx, mapZF);
    }

    function drawTField(ctx, w, h) {
        if (!cfg || !sT) return;
        const xs = Array.from(sT.t, (t) => t * 1e15),
            a = active(),
            eta1 = cfg.m1.eta,
            series = [];
        if (a.x) series.push({
            xs,
            ys: sT.Ex,
            color: COL.Ex,
            label: "E_x",
            width: 2
        });
        if (a.y) series.push({
            xs,
            ys: sT.Ey,
            color: COL.Ey,
            label: "E_y",
            width: 2,
            dash: [8, 3]
        });
        if (a.y) series.push({
            xs,
            ys: Array.from(sT.Hx, (v) => eta1 * v),
            color: COL.Hx,
            label: "η₁H_x",
            width: 2,
            dash: [2, 3]
        });
        if (a.x) series.push({
            xs,
            ys: Array.from(sT.Hy, (v) => eta1 * v),
            color: COL.Hy,
            label: "η₁H_y",
            width: 2,
            dash: [6, 4]
        });
        const F = ranges.f * 1.1;
        mapTF = UI.plot(ctx, {
            x: 0,
            y: 0,
            w,
            h
        }, {
            x: {
                min: 0,
                max: xs[xs.length - 1],
                label: "t",
                unit: "fs"
            },
            y: {
                min: -F,
                max: F,
                label: "field",
                unit: "V/m"
            },
            series,
            cursor: {
                x: tNow() * 1e15,
                label: "now"
            }
        });
    }

    function drawZEnergy(ctx, w, h) {
        if (!cfg || !sZ) return;
        const xs = zUm(),
            u0 = cfg.u0,
            I0 = cfg.I0;
        const n = (arr, s) => Array.from(arr, (v) => v / s);
        const top = Math.max(ranges.u, ranges.s) * 1.1;
        const bottom = cfg.boundary === "none" ? -0.1 * top : -ranges.s * 1.1;
        mapZE = UI.plot(ctx, {
            x: 0,
            y: 0,
            w,
            h
        }, {
            x: {
                min: xs[0],
                max: xs[xs.length - 1],
                label: "z",
                unit: "µm"
            },
            y: {
                min: bottom,
                max: top,
                label: "u/ū₀, S_z/I₀"
            },
            series: [{
                    xs,
                    ys: n(sZ.uE, u0),
                    color: COL.E,
                    label: "u_E",
                    width: 2
                },
                {
                    xs,
                    ys: n(sZ.uH, u0),
                    color: COL.H,
                    label: "u_H",
                    width: 2,
                    dash: [6, 4]
                },
                {
                    xs,
                    ys: n(sZ.Sz, I0),
                    color: COL.S,
                    label: "S_z",
                    width: 2.4,
                    dash: [10, 3, 2, 3]
                },
                {
                    xs,
                    ys: n(sZ.avgUE, u0),
                    color: COL.E,
                    label: "⟨u_E⟩",
                    width: 1.2,
                    dash: [2, 3]
                },
                {
                    xs,
                    ys: n(sZ.avgUH, u0),
                    color: COL.H,
                    label: "⟨u_H⟩",
                    width: 1.2,
                    dash: [2, 3]
                },
                {
                    xs,
                    ys: n(sZ.avgSz, I0),
                    color: COL.S,
                    label: "⟨S_z⟩",
                    width: 1.2,
                    dash: [2, 3]
                }
            ],
            markers: zMarkers(),
            hlines: [{
                y: 0,
                color: pal.gridStrong
            }]
        });
        shadeRegion2(ctx, mapZE);
    }

    function drawTEnergy(ctx, w, h) {
        if (!cfg || !sT) return;
        const xs = Array.from(sT.t, (t) => t * 1e15),
            u0 = cfg.u0,
            I0 = cfg.I0;
        const top = Math.max(ranges.u, ranges.s) * 1.1;
        const bottom = cfg.boundary === "none" ? -0.1 * top : -ranges.s * 1.1;
        mapTE = UI.plot(ctx, {
            x: 0,
            y: 0,
            w,
            h
        }, {
            x: {
                min: 0,
                max: xs[xs.length - 1],
                label: "t",
                unit: "fs"
            },
            y: {
                min: bottom,
                max: top,
                label: "u/ū₀, S_z/I₀"
            },
            series: [{
                    xs,
                    ys: Array.from(sT.uE, (v) => v / u0),
                    color: COL.E,
                    label: "u_E",
                    width: 2
                },
                {
                    xs,
                    ys: Array.from(sT.uH, (v) => v / u0),
                    color: COL.H,
                    label: "u_H",
                    width: 2,
                    dash: [6, 4]
                },
                {
                    xs,
                    ys: Array.from(sT.uE, (v, i) => (v + sT.uH[i]) / u0),
                    color: COL.tot,
                    label: "u",
                    width: 1.4,
                    dash: [2, 3]
                },
                {
                    xs,
                    ys: Array.from(sT.Sz, (v) => v / I0),
                    color: COL.S,
                    label: "S_z",
                    width: 2.4,
                    dash: [10, 3, 2, 3]
                }
            ],
            cursor: {
                x: tNow() * 1e15,
                label: "now"
            },
            hlines: [{
                y: 0,
                color: pal.gridStrong
            }]
        });
    }

    const view = UI.setupCanvas($("viewCanvas"), {
        aspect: 2.3,
        minHeight: 400,
        maxHeight: 470,
        draw: draw3D
    });
    const cZF = UI.setupCanvas($("zFieldCanvas"), {
        aspect: 1.55,
        minHeight: 250,
        maxHeight: 380,
        draw: drawZField
    });
    const cTF = UI.setupCanvas($("tFieldCanvas"), {
        aspect: 1.55,
        minHeight: 250,
        maxHeight: 380,
        draw: drawTField
    });
    const cZE = UI.setupCanvas($("zEnergyCanvas"), {
        aspect: 1.55,
        minHeight: 250,
        maxHeight: 380,
        draw: drawZEnergy
    });
    const cTE = UI.setupCanvas($("tEnergyCanvas"), {
        aspect: 1.55,
        minHeight: 250,
        maxHeight: 380,
        draw: drawTEnergy
    });

    const dView = UI.describeCanvas(view.canvas, "", {
        label: "Oblique 3-D view of the electric and magnetic field vectors along z"
    });
    const dZF = UI.describeCanvas(cZF.canvas, "", {
        label: "Field components versus z at the current time"
    });
    const dTF = UI.describeCanvas(cTF.canvas, "", {
        label: "Field components versus time at the probe"
    });
    const dZE = UI.describeCanvas(cZE.canvas, "", {
        label: "Energy densities and Poynting flux versus z"
    });
    const dTE = UI.describeCanvas(cTE.canvas, "", {
        label: "Energy densities and Poynting flux versus time at the probe"
    });

    // drag on the z plots to move the probe
    for (const [c, getMap] of [
            [cZF.canvas, () => mapZF],
            [cZE.canvas, () => mapZE]
        ]) {
        let down = false;
        const move = (e) => {
            const map = getMap();
            if (!map || !cfg) return;
            const r = c.getBoundingClientRect(),
                px = e.clientX - r.left,
                py = e.clientY - r.top;
            if (!map.contains(px, py) && !down) return;
            const zp = core.clamp(map.pxToX(px) * 1e-6 / cfg.lambda1, Z_MIN, Z_MAX);
            $("zpSlider").value = (Math.round(zp * 200) / 200).toFixed(3);
            $("zpSlider").dispatchEvent(new Event("input", {
                bubbles: true
            }));
        };
        c.addEventListener("pointerdown", (e) => {
            down = true;
            c.setPointerCapture(e.pointerId);
            move(e);
        });
        c.addEventListener("pointermove", (e) => {
            if (down) move(e);
        });
        c.addEventListener("pointerup", () => {
            down = false;
        });
        c.addEventListener("pointercancel", () => {
            down = false;
        });
    }

    // ------------------------------------------------------------------ readouts
    const sig = (v, d = 3) => (Math.abs(v) < 1e-300 ? "0" : Number(v.toPrecision(d)).toString());
    const sci = (v) => (v === 0 ? "0" : v.toExponential(1).replace(/e([+-])(\d+)/, (m, s, e) => "×10" + (s === "-" ? "⁻" : "") + e.split("").map((c) => "⁰¹²³⁴⁵⁶⁷⁸⁹" [c]).join("")));

    function updateText() {
        const I0 = cfg.I0,
            net1 = (1 - cfg.R) * I0;
        $("lamVal").textContent = state.lam + " nm";
        $("n1Val").textContent = state.n1.toFixed(2);
        $("n2Val").textContent = state.n2.toFixed(2);
        $("e0Val").textContent = state.e0 + " V/m";
        $("psiVal").textContent = deg(state.psi);
        $("deltaVal").textContent = deg(state.dl);
        $("tphVal").textContent = state.tph.toFixed(3);
        $("zpVal").textContent = state.zp.toFixed(3).replace("-", "−") + " λ₁";
        $("spdVal").textContent = state.spd.toFixed(2);
        $("psiGroup").classList.toggle("is-disabled", state.pol === "rcp" || state.pol === "lcp");
        $("psiSlider").disabled = state.pol === "rcp" || state.pol === "lcp";
        $("deltaGroup").classList.toggle("is-disabled", state.pol !== "elliptical");
        $("deltaSlider").disabled = state.pol !== "elliptical";
        $("n2Group").classList.toggle("is-disabled", state.bnd !== "dielectric");
        $("n2Slider").disabled = state.bnd !== "dielectric";

        $("statEta").textContent = fmt(cfg.m1.eta, "Ω", 4);
        $("statLambda1").textContent = fmt(cfg.lambda1, "m", 4);
        $("statI0").textContent = fmt(I0, "W/m²");
        $("statR").textContent = cfg.boundary === "none" ? "0" : (100 * cfg.R).toFixed(2) + " %";
        $("statNet").textContent = fmt(net1, "W/m²");

        $("rI0").textContent = fmt(I0, "W/m²", 4);
        $("rErms").textContent = fmt(cfg.E0 / Math.SQRT2, "V/m", 4);
        $("rH0").textContent = fmt(cfg.E0 / cfg.m1.eta, "A/m", 4);
        $("rV").textContent = fmt(cfg.m1.v, "m/s", 4);
        $("rT").textContent = fmt(cfg.period, "s", 4);
        $("rR").textContent = cfg.boundary === "none" ? "0 (no boundary)" : `${cfg.r.re >= 0 ? "+" : "−"}${Math.abs(cfg.r.re).toFixed(4)} (${cfg.coeffSource})`;
        $("rRT").textContent = cfg.boundary === "none" ? "—" : `${cfg.R.toFixed(4)}, ${cfg.T.toFixed(4)}, ${(cfg.R + cfg.T).toFixed(6)}`;
        const net2 = cfg.boundary === "dielectric" ? em.timeAverage(cfg, 0.3 * cfg.lambda2).Sz : 0;
        const net1m = em.timeAverage(cfg, zProbe() < 0 || cfg.boundary === "none" ? zProbe() : -0.3 * cfg.lambda1).Sz;
        $("rNet").textContent = `${fmt(net1m, "W/m²", 4)} (${sig(net1m / I0, 4)} I₀)` + (cfg.boundary === "none" ? "" : ` / ${fmt(net2, "W/m²", 4)}`);
        $("rSwr").textContent = cfg.boundary === "none" ? "1 (travelling wave)" : Number.isFinite(cfg.swr) ? cfg.swr.toFixed(3) : "∞ (pure standing wave)";

        const f = em.fields(cfg, zProbe(), tNow());
        const eta1 = cfg.m1.eta;
        const Em = em.vec.norm(f.E),
            Hm = em.vec.norm(f.H);
        const ang = Em > 1e-9 * cfg.E0 && Hm > 1e-9 * cfg.E0 / eta1 ? Math.acos(core.clamp(em.vec.dot(f.E, f.H) / (Em * Hm), -1, 1)) * 180 / Math.PI : NaN;
        $("rTrans").textContent = `${sig(f.E[2])} V/m, ${sig(eta1 * f.H[2])} V/m, η₁E·H/E₀² = ${sig(eta1 * em.vec.dot(f.E, f.H) / (cfg.E0 * cfg.E0), 2)}` +
            (Number.isFinite(ang) ? `; ∠(E, H) = ${ang.toFixed(1)}°` : "");
        const snap = (v, scale) => (Math.abs(v) < 1e-9 * scale ? 0 : v); // hide round-off at exact nodes
        $("rProbe").textContent = `${fmt(snap(f.uE, cfg.u0), "J/m³")}, ${fmt(snap(f.uH, cfg.u0), "J/m³")}, ${fmt(snap(f.S[2], cfg.I0), "W/m²")}`;
        const av = em.timeAverage(cfg, zProbe());
        $("rRatio").textContent = av.uH > 0 ? `${fmt(av.uE, "J/m³")} / ${fmt(av.uH, "J/m³")} = ${sig(av.uE / av.uH, 4)}` : "— (inside conductor)";
        $("rPoynt").textContent = `${sci(poynt)} (central differences, steps 10⁻⁵λ₀, 10⁻⁵T)`;

        const warn = $("regimeWarn");
        const msgs = [];
        if (cfg.boundary === "pec") msgs.push("Ideal conductor: fields vanish for z ≥ 0 and R = 1 exactly. Real metals at optical frequencies absorb a few percent and let the field penetrate a skin depth.");
        if (cfg.boundary !== "none" && (state.pol === "rcp" || state.pol === "lcp" || state.pol === "elliptical")) msgs.push("The reflected wave travels along −z, so its helicity (handedness) is opposite to the incident wave's although its Jones vector is only scaled by r.");
        warn.hidden = !msgs.length;
        warn.textContent = msgs.join(" ");
    }

    function updateDescriptions() {
        const I0 = cfg.I0,
            a = active();
        const zp = zProbe(),
            f = em.fields(cfg, zp, tNow());
        const polName = {
            linear: `linear at ψ = ${state.psi}°`,
            rcp: "right-handed circular",
            lcp: "left-handed circular",
            elliptical: `elliptical (ψ = ${state.psi}°, δ = ${state.dl}°)`
        } [state.pol];
        const bnd = cfg.boundary === "none" ? "no boundary" : cfg.boundary === "pec" ? "a perfect conductor at z = 0" : `a dielectric n₂ = ${cfg.m2.n.toFixed(2)} at z = 0 (r = ${cfg.r.re.toFixed(3)})`;
        dView.update(`${polName} wave, λ₀ = ${state.lam} nm, n₁ = ${cfg.m1.n.toFixed(2)}, ${bnd}, t = ${state.tph.toFixed(3)} T. At the probe z = ${fmt(zp, "m")}: E = (${sig(f.E[0])}, ${sig(f.E[1])}, 0) V/m, η₁H = (${sig(cfg.m1.eta * f.H[0])}, ${sig(cfg.m1.eta * f.H[1])}, 0) V/m, S_z = ${fmt(f.S[2], "W/m²")}.`);
        const eMaxNow = Math.max(...Array.from(sZ.Ex, (v, i) => Math.hypot(v, sZ.Ey[i])));
        const nodes = em.eNodes(cfg, zs[0]).map((z) => fmt(z, "m")).slice(0, 4);
        dZF.update(`Fields versus z at t = ${state.tph.toFixed(3)} T over ${fmt(zs[0], "m")} to ${fmt(zs[zs.length - 1], "m")}. Maximum |E| now ${sig(eMaxNow)} V/m; envelope max ${sig(Math.max(...sZ.envE))} V/m, min ${sig(Math.min(...sZ.envE.filter((v, i) => zs[i] < 0 || cfg.boundary === "none")))} V/m.` + (nodes.length ? ` Envelope minima at ${nodes.join(", ")}.` : "") + (a.x && a.y ? " Both x and y components present." : ""));
        const pk = (arr) => Math.max(...arr),
            mn = (arr) => Math.min(...arr);
        dTF.update(`Fields versus time at z = ${fmt(zp, "m")} over two periods (T = ${fmt(cfg.period, "s")}). E_x range ${sig(mn(sT.Ex))} to ${sig(pk(sT.Ex))} V/m; E_y range ${sig(mn(sT.Ey))} to ${sig(pk(sT.Ey))} V/m.`);
        dZE.update(`Normalised energy and flux versus z. Time-averaged S_z/I₀ = ${sig(sZ.avgSz[0] / I0, 4)} in medium 1; instantaneous S_z/I₀ ranges ${sig(mn(sZ.Sz) / I0)} to ${sig(pk(sZ.Sz) / I0)}. Time-averaged u_E/ū₀ ranges ${sig(mn(sZ.avgUE) / cfg.u0)} to ${sig(pk(sZ.avgUE) / cfg.u0)}.`);
        dTE.update(`At z = ${fmt(zp, "m")}: u_E/ū₀ from ${sig(mn(sT.uE) / cfg.u0)} to ${sig(pk(sT.uE) / cfg.u0)}, u_H/ū₀ from ${sig(mn(sT.uH) / cfg.u0)} to ${sig(pk(sT.uH) / cfg.u0)}, S_z/I₀ from ${sig(mn(sT.Sz) / I0)} to ${sig(pk(sT.Sz) / I0)}.`);
    }

    // ------------------------------------------------------------------ render
    function render(timeOnly) {
        renderQueued = false;
        if (needModel || !cfg) rebuildModel();
        sampleAll();
        view.redraw();
        cZF.redraw();
        cTF.redraw();
        cZE.redraw();
        cTE.redraw();
        updateText();
        if (!timeOnly) updateDescriptions();
    }

    function queueRender() {
        if (renderQueued) return;
        renderQueued = true;
        requestAnimationFrame(() => render(false));
    }

    // ------------------------------------------------------------------ animation
    const playBtn = $("playBtn");
    let frameCount = 0;
    const loop = UI.createLoop((dt) => {
        const next = (state.tph + dt * state.spd) % 1;
        state.tph = next;
        $("tphSlider").value = next.toFixed(3);
        render(true);
        if (++frameCount % 30 === 0) updateDescriptions();
    }, {
        onChange: (running) => {
            playBtn.innerHTML = running ? "<span>⏸</span> Pause" : "<span>▶</span> Play";
            playBtn.setAttribute("aria-pressed", running ? "true" : "false");
            if (!running) {
                state = ctl.get();
                url.update();
                updateDescriptions();
            }
        }
    });
    playBtn.addEventListener("click", () => loop.toggle());
    $("stepBtn").addEventListener("click", () => {
        loop.stop();
        const next = (Math.round(state.tph * 24) + 1) % 24 / 24;
        $("tphSlider").value = next.toFixed(3);
        $("tphSlider").dispatchEvent(new Event("input", {
            bubbles: true
        }));
    });
    $("resetBtn").addEventListener("click", () => {
        loop.stop();
        document.querySelectorAll(".emw-presets .preset-option").forEach((b) => b.classList.remove("active"));
        applyState(Object.assign({}, DEFAULTS), "Reset to a linearly polarized wave in vacuum at t = 0.");
    });

    UI.addExportBar($("exportHost"), {
        name: "em-waves",
        url,
        getState: () => Object.assign(ctl.get(), {
            derived: {
                I0_W_m2: cfg.I0,
                r: cfg.r.re,
                R: cfg.R,
                T: cfg.T,
                eta1_ohm: cfg.m1.eta,
                period_s: cfg.period,
                poyntingResidual: poynt,
                convention: "E0 is the peak phasor amplitude; I = n eps0 c E0^2 / 2"
            }
        }),
        getCSV: () => ({
            headers: ["z (m)", "Ex (V/m)", "Ey (V/m)", "Hx (A/m)", "Hy (A/m)", "Sz (W/m^2)", "uE (J/m^3)", "uH (J/m^3)", "<uE> (J/m^3)", "<uH> (J/m^3)", "<Sz> (W/m^2)"],
            rows: Array.from(zs, (z, i) => [z, sZ.Ex[i], sZ.Ey[i], sZ.Hx[i], sZ.Hy[i], sZ.Sz[i], sZ.uE[i], sZ.uH[i], sZ.avgUE[i], sZ.avgUH[i], sZ.avgSz[i]])
        }),
        canvases: [view.canvas, cZF.canvas, cTF.canvas, cZE.canvas, cTE.canvas],
        caption: () => `λ₀ = ${state.lam} nm, n₁ = ${state.n1}, E₀ = ${state.e0} V/m (peak), ${state.pol}, boundary ${state.bnd}${state.bnd === "dielectric" ? " n₂ = " + state.n2 : ""}, t = ${state.tph.toFixed(3)} T`
    });

    UI.onThemeChange(() => render(false));

    render(false);
    url.ready.then((restored) => {
        state = ctl.get();
        needModel = true;
        render(false);
        if (!UI.prefersReducedMotion() && !restored) loop.start();
    });
})();