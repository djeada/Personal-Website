"use strict";




(function() {
    const Fresnel = window.OpticsModels.fresnel;
    const UI = window.OpticsUI;
    const PAL = UI.CANVAS_PALETTE;
    const C = Fresnel.complex;
    const DEG = Math.PI / 180;
    const deg = (rad) => rad / DEG;


    const COL = {
        incident: "#f8d477",
        reflected: "#f187c8",
        transmitted: "#7ee787",
        s: "#8ab4ff",
        p: "#ff9f6b",
        sDim: "rgba(138, 180, 255, 0.32)",
        pDim: "rgba(255, 159, 107, 0.32)",
        unpol: "#ece9f8",
        brewster: "#f8d477",
        critical: "#a78bfa",
        interface: "#8f89a8",
        guide: "rgba(184, 178, 207, 0.6)",
        medium1: "rgba(138, 180, 255, 0.04)",
        medium2: "rgba(138, 180, 255, 0.12)",
        band: "126, 231, 135"
    };

    const DEFAULTS = {
        n1: 1,
        n2: 1.5,
        k2: 0,
        th: 45,
        lam: 633,
        pol: "both",
        ef: true,
        wf: true
    };
    const THETA_B_GLASS = +deg(Math.atan(1.5)).toFixed(2);
    const THETA_C_GLASS = +deg(Math.asin(1 / 1.5)).toFixed(2);
    const PRESETS = {
        normal: {
            state: {
                n1: 1,
                n2: 1.5,
                k2: 0,
                th: 0
            },
            note: "Expect R = 0.040 and T = 0.960 for s and p. |t| = 0.800, so |t|² = 0.64 ≠ T: power needs the flux factor."
        },
        brewster: {
            state: {
                n1: 1,
                n2: 1.5,
                k2: 0,
                th: THETA_B_GLASS
            },
            note: "Expect Rp = 0 at θB = 56.31°, Rs = 0.148 and θ₁ + θ₂ = 90°: the reflected light is purely s-polarized."
        },
        critical: {
            state: {
                n1: 1.5,
                n2: 1,
                k2: 0,
                th: THETA_C_GLASS
            },
            note: "θc = 41.81°: the transmitted wave grazes the surface (θ₂ → 90°). Add 0.1° with the number box: R jumps to 1 and the evanescent depth becomes finite."
        },
        tir: {
            state: {
                n1: 1.5,
                n2: 1,
                k2: 0,
                th: 60
            },
            note: "Expect R = 1 and T = 0 for s and p, phases φs = −95.7° and φp = −136.2°, and a 1/e field depth of 121.5 nm at 633 nm, with |ts| = 1.34."
        },
        metal: {
            state: {
                n1: 1,
                n2: 0.2,
                k2: 3.09,
                th: 0,
                lam: 633
            },
            note: "Gold-like metal at 633 nm: expect R = 0.927 at normal incidence and a 1/e field depth of 32.6 nm. Sweep θ₁: Rp dips to ≈ 0.87 near 70.6° but never reaches 0."
        },
        atr: {
            state: {
                n1: 1.5,
                n2: 1,
                k2: 0.02,
                th: 60
            },
            note: "A weak absorber (κ₂ = 0.02) behind the glass frustrates TIR: expect Rs = 0.944 and Rp = 0.909 instead of 1, with R + T = 1. ATR spectroscopy works this way."
        }
    };
    const ZERO_POWER = 1e-3;
    const SWEEP_N = 541;


    const $ = (id) => document.getElementById(id);
    const sidebar = document.querySelector(".options-sidebar");
    const presetNote = $("presetNote");
    const presetButtons = Array.from(document.querySelectorAll("[data-preset]"));
    const startStopBtn = $("startStopBtn");
    const out = {
        theta: $("stat-theta"),
        theta2: $("stat-theta2"),
        R: $("stat-R"),
        RLabel: $("stat-R-label"),
        brewster: $("stat-brewster"),
        brewsterLabel: $("stat-brewster-label"),
        critical: $("stat-critical"),
        pol: $("stat-polarization"),
        rsBar: $("rsBar"),
        rpBar: $("rpBar"),
        tsBar: $("tsBar"),
        tpBar: $("tpBar"),
        rsValue: $("rsValue"),
        rpValue: $("rpValue"),
        tsValue: $("tsValue"),
        tpValue: $("tpValue"),
        energy: $("energyCheck"),
        ampRs: $("ampRs"),
        ampRp: $("ampRp"),
        ampTs: $("ampTs"),
        ampTp: $("ampTp"),
        freq: $("factFreq"),
        lambda1: $("factLambda1"),
        lambda2: $("factLambda2"),
        kz2: $("factKz2"),
        decay: $("factDecay"),
        brewsterInd: $("brewsterIndicator"),
        brewsterText: $("brewsterText"),
        tirInd: $("tirIndicator"),
        tirText: $("tirText"),
        geoBadge: $("geoBadge"),
        depthBadge: $("depthBadge")
    };


    let st = Object.assign({}, DEFAULTS);
    let sol = null;
    let aux = null;
    let wt = 0;
    let applyingPreset = false;
    let sweepKey = "",
        sweepCache = null;

    const n2Of = (s) => (s.k2 > 0 ? {
        re: s.n2,
        im: s.k2
    } : s.n2);
    const polMode = () => (st.pol === "both" ? "unpolarized" : st.pol);

    function sanitize(s) {
        const clamp = (v, lo, hi, d) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
        return {
            n1: clamp(s.n1, 1, 3, DEFAULTS.n1),
            n2: clamp(s.n2, 0.05, 4, DEFAULTS.n2),
            k2: clamp(s.k2, 0, 8, 0),
            th: clamp(s.th, 0, 89.9, DEFAULTS.th),
            lam: clamp(s.lam, 200, 1600, DEFAULTS.lam),
            pol: s.pol === "s" || s.pol === "p" ? s.pol : "both",
            ef: s.ef !== false,
            wf: s.wf !== false
        };
    }

    function getSweep() {
        const key = st.n1 + "|" + st.n2 + "|" + st.k2;
        if (key !== sweepKey) {
            const raw = Fresnel.sweep(st.n1, n2Of(st), SWEEP_N, 89.99 * DEG);
            const th = raw.map((d) => deg(d.theta));
            const col = (k) => raw.map((d) => d[k]);
            sweepCache = {
                th,
                Rs: col("Rs"),
                Rp: col("Rp"),
                Ts: col("Ts"),
                Tp: col("Tp"),
                Ru: raw.map((d) => (d.Rs + d.Rp) / 2),
                phs: wrapSeries(raw.map((d) => phaseDeg(d.phaseRs))),
                php: wrapSeries(raw.map((d) => phaseDeg(d.phaseRp)))
            };
            sweepKey = key;
        }
        return sweepCache;
    }

    function recompute() {
        sol = Fresnel.solve(st.n1, n2Of(st), st.th * DEG, st.lam * 1e-9);
        const absorbing = st.k2 > 0;
        const thB = absorbing ? Fresnel.pseudoBrewster(st.n1, n2Of(st)) : Fresnel.brewsterAngle(st.n1, st.n2);


        const thC = absorbing && st.k2 > 0.25 * st.n2 ? null : Fresnel.criticalAngle(st.n1, st.n2);
        aux = {
            absorbing,
            thB,
            thC,
            sweep: getSweep()
        };
    }


    function formatLength(m) {
        if (m === Infinity) return "∞";
        if (!Number.isFinite(m)) return "—";
        const nm = m * 1e9;
        if (nm >= 10000) return (nm / 1000).toFixed(1) + " µm";
        if (nm >= 1000) return (nm / 1000).toFixed(2) + " µm";
        return nm.toFixed(1) + " nm";
    }

    function phaseDeg(rad) {
        let d = deg(rad);
        if (d <= -179.995) d = 180;
        return d;
    }

    function wrapSeries(ys) {
        const outYs = [];
        for (let i = 0; i < ys.length; i++) {
            if (i > 0 && Math.abs(ys[i] - ys[i - 1]) > 180) outYs.push(NaN);
            outYs.push(ys[i]);
        }
        return outYs;
    }

    function formatComplex(z) {
        const mag = C.abs(z);
        if (mag < 5e-4) return "0.000";
        const ph = phaseDeg(C.arg(z));
        return mag.toFixed(3) + " ∠ " + (Math.abs(ph) < 0.05 ? "0.0" : ph.toFixed(1)) + "°";
    }

    function formatIndex(s) {
        return s.k2 > 0 ? s.n2.toFixed(2) + " + " + s.k2.toFixed(2) + "i" : s.n2.toFixed(2);
    }
    const f3 = (v) => v.toFixed(3);

    function selectedPower() {
        return Fresnel.powerFor(sol, polMode());
    }

    function polLabel() {
        return st.pol === "both" ? "unpolarized" : st.pol + "-polarized";
    }

    function sweepThetaWithGaps(ys) {
        const th = aux.sweep.th,
            xs = [];
        let j = 0;
        for (let i = 0; i < ys.length; i++) {
            if (Number.isNaN(ys[i])) xs.push(NaN);
            else xs.push(th[j++]);
        }
        return xs;
    }


    function updateReadouts() {
        const s = sol;
        const Pw = selectedPower();
        out.theta.textContent = st.th.toFixed(2) + "°";
        out.theta2.textContent = s.tir ? "TIR" : deg(s.theta2).toFixed(2) + "°";
        out.R.textContent = f3(Pw.R);
        out.RLabel.textContent = "Reflectance (" + (st.pol === "both" ? "unpol." : st.pol) + ")";
        out.brewster.textContent = deg(aux.thB).toFixed(2) + "°";
        out.brewsterLabel.textContent = aux.absorbing ? "Min-Rp angle" : "Brewster angle";
        out.critical.textContent = aux.thC === null ? "none" : deg(aux.thC).toFixed(2) + "°" + (aux.absorbing ? "*" : "");
        out.critical.title = aux.absorbing && aux.thC !== null ? "Critical angle of the real part n₂; with absorption there is no strict TIR" : "";
        out.pol.textContent = st.pol === "both" ? "Unpolarized" : st.pol === "s" ? "s (TE)" : "p (TM)";

        const bar = (b, label, v) => {
            b.style.width = (Math.max(0, Math.min(1, v)) * 100).toFixed(2) + "%";
            label.textContent = (v * 100).toFixed(1) + "%";
        };
        bar(out.rsBar, out.rsValue, s.Rs);
        bar(out.rpBar, out.rpValue, s.Rp);
        bar(out.tsBar, out.tsValue, s.Ts);
        bar(out.tpBar, out.tpValue, s.Tp);
        out.energy.textContent = "R + T:  s = " + (s.Rs + s.Ts).toFixed(4) + ",  p = " + (s.Rp + s.Tp).toFixed(4) +
            (aux.absorbing ? "   (T enters the absorber and is dissipated: A = T for a semi-infinite medium 2)" :
                "   (T uses the flux factor Re(k_z2)/k_z1, not |t|²)");

        out.ampRs.textContent = formatComplex(s.rs);
        out.ampRp.textContent = formatComplex(s.rp);
        const tag = s.tir ? " (evanescent)" : aux.absorbing ? " (decaying)" : "";
        out.ampTs.textContent = formatComplex(s.ts) + tag;
        out.ampTp.textContent = formatComplex(s.tp) + tag;

        const lam0 = st.lam * 1e-9;
        out.freq.textContent = (Fresnel.frequency(lam0) / 1e12).toFixed(1) + " THz";
        out.lambda1.textContent = formatLength(lam0 / st.n1);
        if (s.tir) out.lambda2.textContent = "no propagating wave (λ₀/n₂ = " + formatLength(lam0 / st.n2) + ")";
        else {
            const kPhase = Math.hypot(s.kx, s.kz2.re);
            out.lambda2.textContent = formatLength(lam0 / kPhase) + (aux.absorbing ? " (λ₀/|Re k|)" : "");
        }
        out.kz2.textContent = s.kz2.re.toFixed(4) + (s.kz2.im >= 0 ? " + " : " − ") + Math.abs(s.kz2.im).toFixed(4) + "i";
        out.decay.textContent = s.fieldDecayLength === Infinity ? "∞ (grazing, at θc)" :
            s.fieldDecayLength ? formatLength(s.fieldDecayLength) + " (intensity: " + formatLength(s.intensityDecayLength) + ")" :
            s.atCritical ? "∞ (at θc)" : "— (lossless, propagating)";

        const atB = Math.abs(st.th * DEG - aux.thB) < 0.003;
        out.brewsterInd.classList.toggle("active", atB);
        out.brewsterText.textContent = aux.absorbing ?
            "At the minimum-Rp (pseudo-Brewster) angle: Rp = " + f3(s.Rp) + " is small but not zero because ñ₂ is complex" :
            "At the Brewster angle: Rp = 0, so the reflected light is purely s-polarized";
        out.tirInd.classList.toggle("active", s.tir);
        out.tirText.textContent = s.tir ?
            "Total internal reflection: R = 1 and T = 0, but |ts| = " + f3(C.abs(s.ts)) + ": an evanescent field decays into medium 2 over " + formatLength(s.fieldDecayLength) : "";

        out.geoBadge.textContent = aux.absorbing ? "absorbing ñ₂" : s.tir ? "TIR" : "lossless";
        out.depthBadge.textContent = s.tir ? "evanescent" : aux.absorbing ? "absorbed" : "propagating";
    }


    function arrow(ctx, ax, ay, bx, by, color, width, head) {
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = width;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        const ang = Math.atan2(by - ay, bx - ax);
        ctx.lineTo(bx - Math.cos(ang) * head * 0.6, by - Math.sin(ang) * head * 0.6);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx - head * Math.cos(ang - 0.45), by - head * Math.sin(ang - 0.45));
        ctx.lineTo(bx - head * Math.cos(ang + 0.45), by - head * Math.sin(ang + 0.45));
        ctx.closePath();
        ctx.fill();
    }

    function label(ctx, text, x, y, color, align, w, fs) {
        ctx.font = fs + "px " + PAL.font;
        const tw = ctx.measureText(text).width;
        let lx = align === "right" ? x - tw : align === "center" ? x - tw / 2 : x;
        lx = Math.max(4, Math.min(w - tw - 4, lx));
        ctx.fillStyle = "rgba(7, 7, 13, 0.72)";
        ctx.fillRect(lx - 3, y - fs + 1, tw + 6, fs + 5);
        ctx.fillStyle = color;
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        ctx.fillText(text, lx, y + 1);
    }

    function drawSField(ctx, X, Y, value, color) {
        const mag = Math.abs(value);
        if (mag < 0.03) {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(X, Y, 1.5, 0, 2 * Math.PI);
            ctx.fill();
            return;
        }
        const r = 3 + 6 * Math.min(mag, 2);
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(X, Y, r, 0, 2 * Math.PI);
        ctx.stroke();
        if (value > 0) {
            ctx.beginPath();
            ctx.arc(X, Y, Math.max(1.8, r * 0.3), 0, 2 * Math.PI);
            ctx.fill();
        } else {
            const k = r * 0.68;
            ctx.beginPath();
            ctx.moveTo(X - k, Y - k);
            ctx.lineTo(X + k, Y + k);
            ctx.moveTo(X + k, Y - k);
            ctx.lineTo(X - k, Y + k);
            ctx.stroke();
        }
    }

    function drawGeometry(ctx, w, h) {
        const s = sol;
        const Pw = selectedPower();
        const fs = w < 520 ? 12 : 13;
        const ox = w / 2,
            oy = Math.round(h / 2);
        const scale = Math.max(26, Math.min(64, Math.min(w, h) / 8));
        const L = Math.min(w * 0.44, oy - 22);
        const Llam = L / scale;

        ctx.fillStyle = PAL.background;
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = COL.medium1;
        ctx.fillRect(0, 0, w, oy);
        ctx.fillStyle = COL.medium2;
        ctx.fillRect(0, oy, w, h - oy);


        const kappa = s.kz2.im;
        const decaying = kappa > 0;
        const dPx = decaying ? scale / (2 * Math.PI * kappa) : Infinity;
        const zoom = decaying && dPx < 40 ? Math.min(400, Math.ceil(40 / dPx)) : 1;
        const bandMode = s.tir || zoom > 1;
        const dDisp = dPx * zoom;
        const toX = (xl) => ox + xl * scale;
        const toY = (zl) => oy + zl * scale * (zl > 0 ? zoom : 1);

        if (decaying) {
            const depth = h - oy;
            const g = ctx.createLinearGradient(0, oy, 0, h);
            for (let i = 0; i <= 10; i++) {
                const z = depth * i / 10;
                g.addColorStop(i / 10, "rgba(" + COL.band + "," + (0.34 * Math.exp(-2 * z / dDisp)).toFixed(3) + ")");
            }
            ctx.fillStyle = g;
            ctx.fillRect(0, oy, w, depth);
        }


        ctx.strokeStyle = COL.interface;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, oy);
        ctx.lineTo(w, oy);
        ctx.stroke();
        ctx.strokeStyle = COL.guide;
        ctx.lineWidth = 1.2;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(ox, 8);
        ctx.lineTo(ox, h - 8);
        ctx.stroke();
        ctx.setLineDash([]);

        const pol = st.pol;
        const amps = pol === "p" ? {
            reflected: s.rp,
            transmitted: s.tp
        } : {
            reflected: s.rs,
            transmitted: s.ts
        };
        const sin1 = Math.sin(s.theta1),
            cos1 = Math.cos(s.theta1);
        const uInc = {
            x: sin1,
            z: cos1
        };
        const uRef = {
            x: sin1,
            z: -cos1
        };
        const kT = {
            x: s.kx,
            z: s.kz2.re
        };
        const kTn = Math.hypot(kT.x, kT.z);
        const uTr = !s.tir && kTn > 0 ? {
            x: kT.x / kTn,
            z: kT.z / kTn
        } : null;

        const sep = st.th < 12 ? Math.round(12 * (1 - st.th / 12)) + 2 : 0;
        const decayAt = (zl) => Math.exp(-2 * Math.PI * kappa * Math.max(0, zl));


        if (st.wf) {
            ctx.lineWidth = 1.5;
            const crest = (u, kmag, phi0, sMin, sMax, color, alpha, fade, xo = 0) => {
                if (!(kmag > 0)) return;
                const lam = 1 / kmag;
                const sOff = (wt - phi0) / (2 * Math.PI) * lam;
                const half = 13;
                for (let m = Math.ceil((sMin - sOff) / lam);; m++) {
                    const sv = sOff + m * lam;
                    if (sv > sMax) break;
                    if (Math.abs(sv) < 0.12 * lam) continue;
                    const X = toX(u.x * sv) + xo,
                        Y = toY(u.z * sv);
                    ctx.globalAlpha = alpha * (fade ? fade(u.z * sv) : 1);
                    ctx.strokeStyle = color;
                    ctx.beginPath();
                    ctx.moveTo(X + u.z * half, Y - u.x * half);
                    ctx.lineTo(X - u.z * half, Y + u.x * half);
                    ctx.stroke();
                }
                ctx.globalAlpha = 1;
            };
            crest(uInc, st.n1, 0, -Llam, 0, COL.incident, 0.8, null, -sep);
            if (Pw.R >= ZERO_POWER) crest(uRef, st.n1, C.arg(amps.reflected), 0, Llam, COL.reflected, 0.3 + 0.5 * Math.sqrt(Pw.R), null, sep);
            if (uTr && !bandMode && Pw.T >= ZERO_POWER) {
                crest(uTr, kTn, C.arg(amps.transmitted), 0, Llam, COL.transmitted, 0.3 + 0.5 * Math.sqrt(Pw.T), (z) => decayAt(z));
            }
            if (bandMode) {

                const phi0 = C.arg(amps.transmitted);
                const depthL = (h - oy) / (scale * zoom);
                ctx.strokeStyle = "rgb(" + COL.band + ")";
                if (s.kx > 1e-6) {
                    for (let m = -80; m <= 80; m++) {
                        const xAt = (z) => (m - (phi0 - wt) / (2 * Math.PI) - s.kz2.re * z) / s.kx;
                        const x0 = toX(xAt(0)),
                            x1 = toX(xAt(depthL));
                        if (Math.max(x0, x1) < 0 || Math.min(x0, x1) > w) continue;
                        const segs = 8;
                        for (let i = 0; i < segs; i++) {
                            const za = depthL * i / segs,
                                zb = depthL * (i + 1) / segs;
                            ctx.globalAlpha = 0.85 * decayAt((za + zb) / 2);
                            if (ctx.globalAlpha < 0.02) break;
                            ctx.beginPath();
                            ctx.moveTo(toX(xAt(za)), oy + za * scale * zoom);
                            ctx.lineTo(toX(xAt(zb)), oy + zb * scale * zoom);
                            ctx.stroke();
                        }
                    }
                } else if (s.kz2.re > 1e-9) {
                    for (let m = 0; m < 400; m++) {
                        const z = (m - (phi0 - wt) / (2 * Math.PI)) / s.kz2.re;
                        if (z < 0) continue;
                        if (z > depthL) break;
                        ctx.globalAlpha = 0.85 * decayAt(z);
                        if (ctx.globalAlpha < 0.02) break;
                        const Y = oy + z * scale * zoom;
                        ctx.beginPath();
                        ctx.moveTo(0, Y);
                        ctx.lineTo(w, Y);
                        ctx.stroke();
                    }
                }
                ctx.globalAlpha = 1;
            }
        }


        const drawRay = (u, power, color, name, incident, fade, xo = 0) => {
            const sx = (incident ? ox - u.x * L : ox) + xo,
                sy = incident ? oy - u.z * L : oy;
            const ex = (incident ? ox : ox + u.x * L) + xo,
                ey = incident ? oy : oy + u.z * L;
            const lx = incident ? sx : ex,
                ly = incident ? sy : ey;
            const below = ly > oy;

            const topMin = incident && (sep || lx < 8 + 190) ? 3 * fs + 22 : fs + 2;
            const ty = below ? Math.min(h - 8, ly + fs + 4) : Math.max(topMin, ly - 6);
            if (power < ZERO_POWER) {
                ctx.strokeStyle = COL.guide;
                ctx.lineWidth = 1.4;
                ctx.setLineDash([5, 6]);
                ctx.beginPath();
                ctx.moveTo(sx, sy);
                ctx.lineTo(ex, ey);
                ctx.stroke();
                ctx.setLineDash([]);
                label(ctx, name + " = 0 (direction only)", lx, ty, PAL.textMuted, u.x >= 0 ? "right" : "left", w, fs);
                return;
            }
            const width = incident ? 8 : 1.5 + 7 * power;
            if (fade) {
                const segs = 12;
                for (let i = 0; i < segs; i++) {
                    const a = i / segs,
                        b = (i + 1) / segs;
                    ctx.globalAlpha = Math.max(0.08, (0.35 + 0.65 * Math.sqrt(power)) * fade(u.z * Llam * (a + b) / 2) ** 2);
                    ctx.strokeStyle = color;
                    ctx.lineWidth = width;
                    ctx.lineCap = "butt";
                    ctx.beginPath();
                    ctx.moveTo(sx + (ex - sx) * a, sy + (ey - sy) * a);
                    ctx.lineTo(sx + (ex - sx) * b, sy + (ey - sy) * b);
                    ctx.stroke();
                }
                ctx.globalAlpha = 1;
            } else {
                ctx.globalAlpha = 0.35 + 0.65 * Math.sqrt(power);
                arrow(ctx, sx, sy, ex, ey, color, width, 10 + 5 * power);
                ctx.globalAlpha = 1;
            }
            const txt = incident ? "incident, P = 1" : name + " = " + f3(power);
            const align = sep ? (incident ? "right" : "left") : (incident ? "left" : (u.x >= 0 ? "right" : "left"));
            label(ctx, txt, lx + (sep ? (incident ? -8 : 8) : 0), ty, color, align, w, fs);
        };
        drawRay(uInc, 1, COL.incident, "P", true, null, -sep);
        drawRay(uRef, Pw.R, COL.reflected, "R", false, null, sep);
        if (uTr && !bandMode) drawRay(uTr, Pw.T, COL.transmitted, "T", false, decaying ? decayAt : null);


        const arc = (r, a0, a1, text, color) => {
            if (Math.abs(a1 - a0) < 0.01) return;
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.arc(ox, oy, r, a0, a1);
            ctx.stroke();
            const mid = (a0 + a1) / 2;
            ctx.fillStyle = color;
            ctx.font = fs + "px " + PAL.font;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(text, ox + (r + 12) * Math.cos(mid), oy + (r + 12) * Math.sin(mid));
        };
        arc(34, -Math.PI / 2 - s.theta1, -Math.PI / 2, "θ₁", COL.incident);
        arc(48, -Math.PI / 2, -Math.PI / 2 + s.theta1, "θ₁", COL.reflected);
        if (uTr && !bandMode) arc(34, Math.PI / 2 - s.theta2, Math.PI / 2, "θ₂", COL.transmitted);


        if (st.ef) {
            const pols = pol === "both" ? ["s", "p"] : [pol];
            const pScale = 0.36 * scale;
            pols.forEach((pp) => {
                const waves = Fresnel.planeWaves(sol, pp);
                const color = pp === "s" ? COL.s : COL.p;
                const shift = pols.length === 2 ? (pp === "s" ? -9 : 9) : 0;
                const put = (wave, xl, zl, zDisp, perp, xo = 0) => {
                    const f = Fresnel.waveField(wave, xl, zl, wt);
                    const X = toX(xl) + (perp ? perp.x * shift : 0) + xo;
                    const Y = oy + zDisp * scale + (perp ? perp.z * shift : 0);
                    if (X < 6 || X > w - 6 || Y < 6 || Y > h - 6) return;
                    if (pp === "s") drawSField(ctx, X, Y, f.y, color);
                    else {
                        const len = Math.hypot(f.x, f.z);
                        if (len < 0.02) return;
                        const k = Math.min(1, 2.2 / len) * pScale;
                        arrow(ctx, X, Y, X + f.x * k, Y + f.z * k, color, 2, 6);
                    }
                };
                const fr = [0.3, 0.55, 0.8];
                const along = (u, wave, sign, xo = 0) => {
                    const perp = {
                        x: -u.z,
                        z: u.x
                    };
                    fr.forEach((q) => {
                        const sv = sign * q * Llam;
                        put(wave, u.x * sv, u.z * sv, u.z * sv, perp, xo);
                    });
                };

                const mo = sep ? 3 * sep : 0;
                along(uInc, waves.incident, -1, -mo);
                along(uRef, waves.reflected, 1, mo);
                if (uTr && !bandMode) along(uTr, waves.transmitted, 1);
                if (bandMode) {
                    const dL = 1 / (2 * Math.PI * kappa);
                    [0.5, 1.4, 2.3].forEach((xs) => {
                        const x = ((xs * scale) < w / 2 - 12 ? xs : xs * 0.5) + shift / scale;
                        [0, dL, 2 * dL].forEach((z) => {
                            const zd = z * zoom;
                            if (zd * scale > h - oy - 10) return;
                            put(waves.transmitted, x, z, zd, null);
                        });
                    });
                }
            });
        }


        if (Math.abs(st.th * DEG - aux.thB) < 0.003 && !aux.absorbing) {
            ctx.strokeStyle = COL.brewster;
            ctx.lineWidth = 2;
            for (let i = 0; i < 8; i++) {
                const a = i / 8 * 2 * Math.PI;
                ctx.beginPath();
                ctx.moveTo(ox + 10 * Math.cos(a), oy + 10 * Math.sin(a));
                ctx.lineTo(ox + 17 * Math.cos(a), oy + 17 * Math.sin(a));
                ctx.stroke();
            }
        }


        const lam0 = st.lam * 1e-9;
        label(ctx, "Medium 1: n₁ = " + st.n1.toFixed(2), 8, fs + 6, PAL.text, "left", w, fs);
        label(ctx, "λ₁ = λ₀/n₁ = " + formatLength(lam0 / st.n1), 8, 2 * fs + 12, PAL.textMuted, "left", w, fs);
        label(ctx, "Medium 2: ñ₂ = " + formatIndex(st), 8, h - fs - 14, PAL.text, "left", w, fs);
        label(ctx, s.tir ? "evanescent: T = 0, |E| ≠ 0" : "λ₂ = " + formatLength(lam0 / kTn) + (aux.absorbing ? " (phase)" : ""), 8, h - 8, PAL.textMuted, "left", w, fs);
        if (Math.abs(st.th * DEG - aux.thB) < 0.003) {
            label(ctx, aux.absorbing ? "min Rp = " + f3(s.Rp) : "Brewster: Rp = 0", ox + 12, oy - 58, COL.brewster, "left", w, fs);
        }

        const sbx = w - 10 - scale,
            sby = fs + 10;
        ctx.strokeStyle = PAL.text;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sbx, sby);
        ctx.lineTo(sbx + scale, sby);
        ctx.moveTo(sbx, sby - 4);
        ctx.lineTo(sbx, sby + 4);
        ctx.moveTo(sbx + scale, sby - 4);
        ctx.lineTo(sbx + scale, sby + 4);
        ctx.stroke();
        label(ctx, "λ₀ = " + st.lam.toFixed(0) + " nm", w - 8, sby + fs + 8, PAL.textMuted, "right", w, fs);
        if (decaying) {

            const mx = w - 18,
                my = oy + Math.min(dDisp, h - oy - 30);
            ctx.strokeStyle = PAL.text;
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(mx, oy);
            ctx.lineTo(mx, my);
            ctx.moveTo(mx - 5, my);
            ctx.lineTo(mx + 5, my);
            ctx.stroke();
            const d = s.fieldDecayLength;
            label(ctx, "d = " + formatLength(d) + (zoom > 1 ? ", depth ×" + zoom : ""), mx - 8, Math.min(h - fs - 14, my + fs + 6), PAL.text, "right", w, fs);
        }

        const geo = ctx.canvas;
        geo.dataset.tir = String(s.tir);
        geo.dataset.reflected = Pw.R.toFixed(6);
        geo.dataset.transmitted = Pw.T.toFixed(6);
        geo.dataset.zoom = String(zoom);
    }


    let rtMap = null,
        phMap = null,
        depthMap = null;

    function drawRT(ctx, w, h) {
        const sw = aux.sweep;
        const dimS = st.pol === "p",
            dimP = st.pol === "s";
        const cs = dimS ? COL.sDim : COL.s,
            cp = dimP ? COL.pDim : COL.p;
        const series = [{
                xs: sw.th,
                ys: sw.Rs,
                color: cs,
                label: "Rs"
            },
            {
                xs: sw.th,
                ys: sw.Ts,
                color: cs,
                dash: [7, 4],
                label: "Ts"
            },
            {
                xs: sw.th,
                ys: sw.Rp,
                color: cp,
                label: "Rp"
            },
            {
                xs: sw.th,
                ys: sw.Tp,
                color: cp,
                dash: [7, 4],
                label: "Tp"
            }
        ];
        if (st.pol === "both") series.push({
            xs: sw.th,
            ys: sw.Ru,
            color: COL.unpol,
            dash: [2, 3],
            width: 1.6,
            label: "R unpol."
        });
        const Pw = selectedPower();
        rtMap = UI.plot(ctx, {
            x: 0,
            y: 0,
            w,
            h
        }, {
            x: {
                min: 0,
                max: 90,
                label: "θ₁",
                unit: "deg",
                ticks: Object.assign([0, 15, 30, 45, 60, 75, 90], {
                    step: 15
                })
            },
            y: {
                min: 0,
                max: 1.02,
                label: "power fraction"
            },
            series,
            legend: false,
            markers: markerList(),
            cursor: {
                x: st.th,
                label: "θ₁ " + st.th.toFixed(1) + "°  R " + f3(Pw.R) + "  T " + f3(Pw.T)
            }
        });
    }

    function markerList() {
        const m = [{
            x: deg(aux.thB),
            label: (aux.absorbing ? "min Rp " : "θB ") + deg(aux.thB).toFixed(2) + "°",
            color: COL.brewster
        }];
        if (aux.thC !== null) m.push({
            x: deg(aux.thC),
            label: "θc " + deg(aux.thC).toFixed(2) + "°",
            color: COL.critical
        });
        return m;
    }

    function drawPhase(ctx, w, h) {
        const sw = aux.sweep;
        const dimS = st.pol === "p",
            dimP = st.pol === "s";
        const series = [{
                xs: sweepThetaWithGaps(sw.phs),
                ys: sw.phs,
                color: dimS ? COL.sDim : COL.s,
                label: "arg rs"
            },
            {
                xs: sweepThetaWithGaps(sw.php),
                ys: sw.php,
                color: dimP ? COL.pDim : COL.p,
                dash: [7, 4],
                label: "arg rp"
            }
        ];
        const ps = phaseDeg(sol.phaseRs),
            pp = phaseDeg(sol.phaseRp);
        phMap = UI.plot(ctx, {
            x: 0,
            y: 0,
            w,
            h
        }, {
            x: {
                min: 0,
                max: 90,
                label: "θ₁",
                unit: "deg",
                ticks: Object.assign([0, 15, 30, 45, 60, 75, 90], {
                    step: 15
                })
            },
            y: {
                min: -190,
                max: 190,
                label: "arg r",
                unit: "deg",
                ticks: Object.assign([-180, -90, 0, 90, 180], {
                    step: 90
                })
            },
            series,
            legend: false,
            markers: markerList(),
            cursor: {
                x: st.th,
                label: "φs " + ps.toFixed(1) + "°  φp " + pp.toFixed(1) + "°"
            }
        });
    }

    function depthData() {
        const lam0 = st.lam * 1e-9;
        const d = sol.fieldDecayLength;
        const zMax = d && Number.isFinite(d) ? Math.min(3 * lam0, Math.max(4 * d, 0.05 * lam0)) : 2 * lam0;
        const N = 241,
            zs = [],
            Is = [],
            Ip = [];
        for (let i = 0; i < N; i++) {
            const z = zMax * i / (N - 1);
            zs.push(z * 1e9);
            Is.push(Fresnel.transmittedIntensity(sol, "s", z));
            Ip.push(Fresnel.transmittedIntensity(sol, "p", z));
        }
        return {
            zs,
            Is,
            Ip,
            zMax
        };
    }

    function drawDepth(ctx, w, h) {
        const D = depthData();
        const series = [];
        if (st.pol !== "p") series.push({
            xs: D.zs,
            ys: D.Is,
            color: COL.s,
            label: "s"
        });
        if (st.pol !== "s") series.push({
            xs: D.zs,
            ys: D.Ip,
            color: COL.p,
            dash: [7, 4],
            label: "p"
        });
        const maxY = Math.max(1, ...series.map((s) => s.ys[0]));
        const d = sol.fieldDecayLength;
        const markers = d && Number.isFinite(d) && d * 1e9 <= D.zMax * 1e9 ? [{
            x: d * 1e9,
            label: "1/e field depth d = " + formatLength(d),
            color: PAL.marker
        }] : [];
        depthMap = UI.plot(ctx, {
            x: 0,
            y: 0,
            w,
            h
        }, {
            x: {
                min: 0,
                max: D.zMax * 1e9,
                label: "depth z in medium 2",
                unit: "nm"
            },
            y: {
                min: 0,
                max: maxY * 1.08,
                label: "|Eₜ|²/|E₀|²"
            },
            series,
            legendPosition: "right",
            hlines: [{
                y: 1,
                label: "incident",
                color: PAL.gridStrong
            }],
            markers
        });
    }


    function describeAll() {
        const s = sol,
            Pw = selectedPower();
        const where = s.tir ? "Total internal reflection: no transmitted beam; an evanescent field decays over " + formatLength(s.fieldDecayLength) + "." :
            aux.absorbing ? "Transmitted wave refracts at " + deg(s.theta2).toFixed(1) + "° (phase fronts) and its field decays over " + formatLength(s.fieldDecayLength) + "." :
            "Transmitted beam at θ₂ = " + deg(s.theta2).toFixed(1) + "°.";
        dGeo.update("Interface diagram: n₁ = " + st.n1.toFixed(2) + " to ñ₂ = " + formatIndex(st) + ", θ₁ = " + st.th.toFixed(1) +
            "°, " + polLabel() + ". Reflected power R = " + f3(Pw.R) + ", transmitted T = " + f3(Pw.T) + ". " + where);
        const minRp = Math.min(...aux.sweep.Rp);
        dRT.update("R and T versus angle from 0 to 90°. At θ₁ = " + st.th.toFixed(1) + "°: Rs = " + f3(s.Rs) + ", Rp = " + f3(s.Rp) +
            ", Ts = " + f3(s.Ts) + ", Tp = " + f3(s.Tp) + ". Rp reaches its minimum " + minRp.toFixed(4) + " at " + deg(aux.thB).toFixed(2) + "°" +
            (aux.thC !== null && !aux.absorbing ? "; R = 1 beyond the critical angle " + deg(aux.thC).toFixed(2) + "°." : "."));
        dPh.update("Reflection phase versus angle. At θ₁ = " + st.th.toFixed(1) + "°: arg rs = " + phaseDeg(s.phaseRs).toFixed(1) +
            "°, arg rp = " + phaseDeg(s.phaseRp).toFixed(1) + "°.");
        dDepth.update("Transmitted |E|² versus depth: at the surface s = " + f3(Fresnel.transmittedIntensity(s, "s", 0)) + ", p = " +
            f3(Fresnel.transmittedIntensity(s, "p", 0)) + " times the incident value; " +
            (s.fieldDecayLength && Number.isFinite(s.fieldDecayLength) ? "it falls to 1/e² of its surface value at depth " + formatLength(s.fieldDecayLength) + "." : "it is constant with depth (lossless propagating wave)."));
    }


    let renderQueued = false;

    function render() {
        renderQueued = false;
        st = sanitize(ctl.get());
        recompute();
        updateReadouts();
        geoCanvas.redraw();
        rtCanvas.redraw();
        phCanvas.redraw();
        depthCanvas.redraw();
        describeAll();
    }

    function scheduleRender() {
        if (renderQueued) return;
        renderQueued = true;
        queueMicrotask(render);
    }


    recompute();
    const geoCanvas = UI.setupCanvas($("canvas"), {
        aspect: 1.45,
        minHeight: 330,
        maxHeight: 540,
        draw: (c, w, h) => drawGeometry(c, w, h)
    });
    const rtCanvas = UI.setupCanvas($("plotCanvas"), {
        aspect: 1.35,
        minHeight: 250,
        maxHeight: 380,
        draw: drawRT
    });
    const phCanvas = UI.setupCanvas($("phaseCanvas"), {
        aspect: 1.35,
        minHeight: 250,
        maxHeight: 380,
        draw: drawPhase
    });
    const depthCanvas = UI.setupCanvas($("depthCanvas"), {
        aspect: 3,
        minHeight: 220,
        maxHeight: 300,
        draw: drawDepth
    });
    const dGeo = UI.describeCanvas(geoCanvas.canvas, "Interface diagram", {
        label: "Ray and field diagram of reflection and refraction at the interface"
    });
    const dRT = UI.describeCanvas(rtCanvas.canvas, "R and T versus angle", {
        label: "Plot of reflectance and transmittance versus angle of incidence"
    });
    const dPh = UI.describeCanvas(phCanvas.canvas, "Reflection phase versus angle", {
        label: "Plot of reflection phase versus angle of incidence"
    });
    const dDepth = UI.describeCanvas(depthCanvas.canvas, "Transmitted field versus depth", {
        label: "Plot of transmitted field intensity versus depth in medium 2"
    });


    UI.enhanceAllSliders(sidebar, {
        thetaSlider: {
            unit: "°"
        },
        lambdaSlider: {
            unit: "nm"
        }
    });
    const ctl = UI.bindControls({
        n1: "#n1Slider",
        n2: "#n2Slider",
        k2: "#k2Slider",
        th: "#thetaSlider",
        lam: "#lambdaSlider",
        pol: "radio:pol",
        ef: "#showEFields",
        wf: "#showWavefronts"
    }, () => {
        if (!applyingPreset) setActivePreset(null);
        url.update();
        scheduleRender();
    });
    const url = UI.urlState({
        get: () => sanitize(ctl.get()),
        set: (o) => ctl.set(o)
    });

    function setActivePreset(name) {
        presetButtons.forEach((b) => {
            const on = b.dataset.preset === name;
            b.classList.toggle("active", on);
            b.setAttribute("aria-pressed", String(on));
        });
        presetNote.textContent = name ? PRESETS[name].note : "";
    }
    presetButtons.forEach((b) => b.addEventListener("click", () => {
        const p = PRESETS[b.dataset.preset];
        applyingPreset = true;
        ctl.set(p.state);
        applyingPreset = false;
        setActivePreset(b.dataset.preset);
    }));


    function bindAngleDrag(handle, getMap) {
        const cv = handle.canvas;
        let dragging = false;
        const setFrom = (e) => {
            const map = getMap();
            if (!map) return;
            const r = cv.getBoundingClientRect();
            const px = e.clientX - r.left;
            const v = Math.min(89.9, Math.max(0, map.pxToX(px)));
            const slider = $("thetaSlider");
            slider.value = v.toFixed(2);
            slider.dispatchEvent(new Event("input", {
                bubbles: true
            }));
        };
        cv.addEventListener("pointerdown", (e) => {
            const map = getMap();
            const r = cv.getBoundingClientRect();
            if (!map || !map.contains(e.clientX - r.left, e.clientY - r.top)) return;
            dragging = true;
            if (cv.setPointerCapture) cv.setPointerCapture(e.pointerId);
            setFrom(e);
        });
        cv.addEventListener("pointermove", (e) => {
            if (dragging) setFrom(e);
        });
        ["pointerup", "pointercancel"].forEach((t) => cv.addEventListener(t, () => {
            dragging = false;
        }));
    }
    bindAngleDrag(rtCanvas, () => rtMap);
    bindAngleDrag(phCanvas, () => phMap);


    const loop = UI.createLoop((dt) => {
        wt = (wt + 2 * Math.PI * dt / 1.6) % (2 * Math.PI * 1000);
        geoCanvas.redraw();
    }, {
        onChange: (running) => {
            startStopBtn.innerHTML = running ? '<span aria-hidden="true">⏸</span> Pause' : '<span aria-hidden="true">▶</span> Animate ωt';
            startStopBtn.setAttribute("aria-pressed", String(running));
        }
    });
    startStopBtn.addEventListener("click", () => loop.toggle());
    $("stepBtn").addEventListener("click", () => {
        loop.stop();
        wt += Math.PI / 8;
        geoCanvas.redraw();
    });
    $("resetBtn").addEventListener("click", () => {
        loop.stop();
        loop.reset();
        wt = 0;
        applyingPreset = true;
        ctl.set(DEFAULTS);
        applyingPreset = false;
        setActivePreset(null);
        url.clear();
        scheduleRender();
    });


    function csvRows() {
        const n = aux.sweep.th.length;
        const raw = Fresnel.sweep(st.n1, n2Of(st), n, 89.99 * DEG);
        return raw.map((d) => [deg(d.theta), d.Rs, d.Rp, d.Ts, d.Tp, deg(d.phaseRs), deg(d.phaseRp)]);
    }
    UI.addExportBar($("exportHost"), {
        name: "fresnel-interface",
        url,
        getState: () => {
            const s = sol;
            return {
                tool: "fresnel-interface-coefficients",
                conventions: "E = Re{E0 exp[i(k·r − ωt)]}; s: E ∥ y; p: H ∥ y, ê_p = ŷ×k/(ñk0); T = normal Poynting-flux ratio",
                state: st,
                results: {
                    Rs: s.Rs,
                    Rp: s.Rp,
                    Ts: s.Ts,
                    Tp: s.Tp,
                    rs: s.rs,
                    rp: s.rp,
                    ts: s.ts,
                    tp: s.tp,
                    theta2_deg: s.theta2 === null ? null : deg(s.theta2),
                    tir: s.tir,
                    fieldDecayLength_m: Number.isFinite(s.fieldDecayLength) ? s.fieldDecayLength : null,
                    brewster_or_minRp_deg: deg(aux.thB),
                    critical_deg: aux.thC === null ? null : deg(aux.thC)
                }
            };
        },
        getCSV: () => ({
            headers: ["theta1 (deg)", "Rs", "Rp", "Ts", "Tp", "arg rs (deg)", "arg rp (deg)"],
            rows: csvRows()
        }),
        canvases: [geoCanvas.canvas, rtCanvas.canvas, phCanvas.canvas, depthCanvas.canvas],
        caption: () => "Fresnel interface: n1 = " + st.n1.toFixed(2) + ", n2 = " + formatIndex(st) + ", θ1 = " + st.th.toFixed(2) +
            "°, λ0 = " + st.lam + " nm, " + polLabel()
    });


    render();
    url.ready.then(() => scheduleRender());
})();