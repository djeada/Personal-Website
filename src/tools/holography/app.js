/* Digital holography and phase retrieval: page glue (model: ../shared/optics/holography.js). */
(function() {
    "use strict";
    const UI = window.OpticsUI,
        core = window.OpticsModels.core,
        HG = window.OpticsModels.holography;
    const $ = (id) => document.getElementById(id);
    const TH = UI.CANVAS_PALETTE;
    const FS = 12;
    const DEG = Math.PI / 180;
    const fmt = (v, d = 3) => (Number.isFinite(v) ? Number(v.toPrecision(d)).toString() : "—");
    const cpm = (f, d = 3) => (Number.isFinite(f) ? fmt(f * 1e-3, d) + " cycles/mm" : "—");
    const um = (m, d = 3) => (Number.isFinite(m) ? fmt(m * 1e6, d) + " µm" : "—");
    const degs = (r, d = 2) => (Number.isFinite(r) ? (r / DEG).toFixed(d) + "°" : "—");
    const setText = (id, t) => {
        const el = $(id);
        if (el) el.textContent = t;
    };

    // ------------------------------------------------------------------ state (UI units)
    const DEFAULTS = Object.freeze({
        obj: "letters",
        phi: 1.5,
        nao: 0.012,
        z: 12,
        lam: 633,
        geo: "offaxis",
        th: 2.6,
        az: "0",
        beta: 0.6,
        px: 5,
        N: "256",
        ff: 1,
        bits: "0",
        meth: "filter",
        rw: 1,
        pse: 0,
        zr: 1,
        view: "amp",
        gsp: "fresnel",
        gss: "flat",
        gsn: 150,
        hview: "holo",
        zoom: "1"
    });
    const PRESETS = {
        offaxis: {
            v: {},
            note: "Off-axis reference at θ = 2.61°. Expect three separate discs in the spectrum (DC, +1, −1) and a Fourier-filtered reconstruction with ρ ≈ 0.999. The unfiltered reconstruction (method table) gets only ρ ≈ 0.39."
        },
        gabor: {
            v: {
                geo: "inline",
                meth: "direct"
            },
            note: "In-line (Gabor): every order sits at DC. Expect “HOLO” surrounded by a ringing halo, the twin image defocused by 2z, and ρ ≈ 0.77. A spatial filter cannot help."
        },
        twinFocus: {
            v: {
                geo: "inline",
                meth: "direct",
                zr: -1
            },
            note: "Back-propagate to z_r = −z. Now the conjugate (twin) wave is in focus and the true image is blurred by 2z. The twin is a real image on the other side of the hologram."
        },
        ps4: {
            v: {
                geo: "inline",
                meth: "ps4"
            },
            note: "Four in-line exposures with the reference phase stepped by π/2. DC and twin cancel exactly: ρ = 1.0000 on the ideal sensor (exact to machine precision with point sampling)."
        },
        psError: {
            v: {
                geo: "inline",
                meth: "ps4",
                pse: 10,
                bits: "8"
            },
            note: "A 10° error per phase step and an 8-bit sensor. A weak residual twin returns and ρ drops to ≈ 0.996. Set ε = 0 and bit depth ‘Ideal’ to recover 1.0000."
        },
        tooSmall: {
            v: {
                th: 1.2
            },
            note: "θ = 1.19°: the carrier |f_c| = 32.8 cycles/mm is below 3B = 56.9 cycles/mm, so the +1 disc overlaps the |O|² halo. A warning appears and ρ falls to ≈ 0.91."
        },
        aliased: {
            v: {
                th: 6,
                zoom: "8"
            },
            note: "θ = 5.99° > θ_max = 3.63°: the fringe period is 1.21 px and the carrier aliases to −35 cycles/mm, onto the DC halo. Expect overlap warnings and ρ ≈ 0.58. Compare θ = 5.0°, which aliases to a clean spot (ρ ≈ 0.99)."
        },
        diagonal: {
            v: {
                nao: 0.02,
                az: "45",
                th: 3.48
            },
            note: "NA_o = 0.02 (B = 31.6 cycles/mm) cannot be separated along x because 3B > f_N − B. Along the diagonal the orders just fit: ρ ≈ 0.998. Switch the carrier direction to ‘Along x’ to see them collide."
        },
        intensity: {
            v: {
                obj: "phase",
                meth: "intensity"
            },
            note: "Phase object recorded WITHOUT a reference. Back-propagating √I with zero phase gives ρ ≈ 0.70 because the camera recorded intensity, not amplitude. The hologram of the same object (method table, first row) gives ρ ≈ 1.000."
        },
        bits: {
            v: {
                bits: "2",
                zoom: "8"
            },
            note: "2-bit sensor (4 grey levels). The coarse fringes still encode the carrier and the reconstruction stays recognisable, ρ ≈ 0.82. With 8 bits ρ is back above 0.99."
        },
        gs: {
            v: {
                obj: "phase",
                meth: "gs",
                z: 17,
                gsp: "fresnel",
                gss: "flat"
            },
            note: "Gerchberg–Saxton from one defocused intensity (z = 17 mm) plus the known object amplitude. E_M decreases monotonically to ≈ 0.02 and the true error to ≈ 0.3 after 150 iterations: the phase features appear, but not perfectly. A random start stalls near E_M ≈ 0.2."
        },
        gsFourier: {
            v: {
                obj: "points",
                meth: "gs",
                gsp: "fourier",
                gss: "random"
            },
            note: "Fourier-plane GS for the point scatterers with known amplitude |o|, from a random phase. It converges: E_M and the true error both fall below 10⁻² within about 100 iterations."
        }
    };

    const ctl = UI.bindControls({
        obj: "#objSelect",
        phi: "#phiSlider",
        nao: "#naoSlider",
        z: "#zSlider",
        lam: "#lamSlider",
        geo: "radio:geo",
        th: "#thSlider",
        az: "#azSelect",
        beta: "#betaSlider",
        px: "#pxSlider",
        N: "#nSelect",
        ff: "#ffSlider",
        bits: "#bitsSelect",
        meth: "#methSelect",
        rw: "#rwSlider",
        pse: "#pseSlider",
        zr: "#zrSlider",
        view: "#viewSelect",
        gsp: "#gspSelect",
        gss: "#gssSelect",
        gsn: "#gsnSlider",
        hview: "#hviewSelect",
        zoom: "#zoomSelect"
    }, () => {
        url.update();
        schedule();
    });
    const sliderOpts = {
        phiSlider: {
            unit: "rad"
        },
        naoSlider: {
            unit: ""
        },
        zSlider: {
            unit: "mm"
        },
        lamSlider: {
            unit: "nm"
        },
        thSlider: {
            unit: "°"
        },
        betaSlider: {
            unit: "log₁₀β"
        },
        pxSlider: {
            unit: "µm"
        },
        ffSlider: {
            unit: ""
        },
        rwSlider: {
            unit: "× B"
        },
        pseSlider: {
            unit: "°"
        },
        zrSlider: {
            unit: "× z"
        },
        gsnSlider: {
            unit: ""
        }
    };
    UI.enhanceAllSliders(document.querySelector(".options-sidebar"), sliderOpts);
    const url = UI.urlState({
        get: ctl.get,
        set: ctl.set
    });

    function toParams(s) {
        const z = s.z * 1e-3;
        return {
            N: Number(s.N) || 256,
            dx: s.px * 1e-6,
            lambda: s.lam * 1e-9,
            z,
            object: HG.OBJECTS.includes(s.obj) ? s.obj : "letters",
            NAo: s.nao,
            phi: s.phi,
            geometry: s.geo === "inline" ? "inline" : "offaxis",
            theta: s.th * DEG,
            azimuth: Number(s.az) * DEG,
            beta: Math.pow(10, s.beta),
            fill: s.ff,
            bits: Number(s.bits) || 0,
            method: HG.METHODS.includes(s.meth) ? s.meth : "filter",
            rw: s.rw,
            zr: s.zr * z,
            psError: s.pse * DEG,
            gsPlane: s.gsp === "fourier" ? "fourier" : "fresnel",
            gsStart: s.gss === "random" ? "random" : "flat"
        };
    }

    // ------------------------------------------------------------------ compute
    let res = null,
        prep = null,
        lastMs = 0;
    let gs = null,
        gsKey = "";
    let cutRow = -1; // row index of the line cut (−1 → centre)
    let pending = 0;

    function schedule() {
        if (pending) return;
        setText("computeStatus", "Computing…");
        pending = requestAnimationFrame(() => {
            pending = 0;
            compute();
            drawAll();
        });
    }

    function compute() {
        const s = ctl.get(),
            p = toParams(s);
        const t0 = performance.now();
        try {
            res = HG.simulate(p, prep);
        } catch (err) {
            setText("computeStatus", "Error: " + (err && err.message || err));
            return;
        }
        prep = res.prep;
        lastMs = performance.now() - t0;
        if (cutRow < 0 || cutRow >= p.N) cutRow = p.N / 2;
        const key = [prep.key, p.fill, p.bits, p.gsPlane, p.gsStart].join("|");
        if (key !== gsKey) {
            gsKey = key;
            resetGS(p);
        }
        updateText(s, p);
        setText("computeStatus", "Computed in " + Math.round(lastMs) + " ms on a " + p.N + " × " + p.N + " sensor.");
    }

    // ------------------------------------------------------------------ Gerchberg–Saxton loop
    function resetGS(p) {
        const was = loop.running;
        loop.stop();
        gs = HG.gsFromParams(p || toParams(ctl.get()), prep).state;
        updateGSText();
        if (was && p && p.method === "gs") loop.start();
    }
    const loop = UI.createLoop(() => {
        if (!gs) return;
        const target = ctl.get().gsn;
        const t0 = performance.now();
        while (gs.iter < target && performance.now() - t0 < 28) HG.gsStep(gs, 1, prep.obj);
        if (gs.iter >= target) loop.stop();
        gsChanged();
    }, {
        onChange: (running) => {
            $("gsRun").textContent = running ? "⏸ Pause" : "▶ Run";
            updateGSText();
        }
    });

    function gsChanged() {
        cv.gs.redraw();
        if (res && res.params.method === "gs") {
            cv.rec.redraw();
            cv.cut.redraw();
            updateStatsRho();
            fillTable();
        }
        updateGSText();
    }

    function gsTruthRho() {
        return gs && gs.truthErr.length ? Math.sqrt(Math.max(0, 1 - Math.pow(gs.truthErr[gs.truthErr.length - 1], 2))) : NaN;
    }

    function updateGSText() {
        if (!gs) return;
        const n = gs.iter,
            eM = gs.errMeas[n - 1],
            eT = gs.truthErr[n - 1];
        setText("gsBadge", n + " iteration" + (n === 1 ? "" : "s"));
        setText("gsStatus", n ?
            "Iteration " + n + ": E_M = " + fmt(eM, 3) + ", true error √(1 − ρ²) = " + fmt(eT, 3) + (loop.running ? " (running)" : "") + "." :
            "Ready: " + (gs.plane === "fourier" ? "Fourier-plane" : "sensor-plane (Fresnel)") + " intensity plus the object amplitude |o|. Press Run or Step.");
        if (descs.gs) descs.gs.update("Gerchberg–Saxton after " + n + " iterations: measurement-plane error " + fmt(eM, 3) + ", true error " + fmt(eT, 3) + ".");
    }
    $("gsRun").addEventListener("click", () => {
        if (loop.running) {
            loop.stop();
            return;
        }
        if (ctl.get().meth !== "gs") ctl.set({
            meth: "gs"
        });
        if (gs && gs.iter >= ctl.get().gsn) resetGS();
        loop.start();
    });
    $("gsStep").addEventListener("click", () => {
        loop.stop();
        if (gs) {
            HG.gsStep(gs, 1, prep.obj);
            gsChanged();
        }
    });
    $("gsReset").addEventListener("click", () => {
        loop.stop();
        resetGS();
        gsChanged();
    });

    // ------------------------------------------------------------------ drawing helpers
    const cv = {},
        maps = {};
    let descs = {};

    function setup(id, key, aspect, draw, minHeight = 240) {
        cv[key] = UI.setupCanvas($(id), {
            aspect,
            minHeight,
            maxHeight: 560,
            draw
        });
    }

    function drawAll() {
        for (const k in cv) cv[k].redraw();
    }

    /** Square image with axes and a vertical colour bar. Returns the plot mapping. */
    function drawMap(ctx, w, h, o) {
        const l = FS * 4.2,
            rr = 74,
            t = 24,
            b = FS * 3.4;
        const size = Math.max(60, Math.min(w - l - rr, h - t - b));
        const x0 = Math.max(0, (w - (l + size + rr)) / 2);
        const map = UI.plot(ctx, {
            x: x0,
            y: 0,
            w: l + size + rr,
            h: t + size + b
        }, {
            x: {
                min: o.ext[0],
                max: o.ext[1],
                label: o.xlabel,
                unit: o.unit
            },
            y: {
                min: o.ext[0],
                max: o.ext[1],
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
        ctx.fillStyle = TH.panel;
        ctx.fillRect(P.x, P.y, P.w, P.h);
        const norm = UI.imageFromArray(ctx, o.data, o.n, o.n, P, o.cmap, Object.assign({
            smooth: false
        }, o.norm || {}));
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
            ctx.fillText(o.cbLabel, Math.min(w - 2, cb.x + 64), 4);
        }
        return map;
    }

    function tag(ctx, text, x, y, color, align = "left") {
        ctx.font = FS + "px " + TH.font;
        const tw = ctx.measureText(text).width;
        const x0 = align === "right" ? x - tw : align === "center" ? x - tw / 2 : x;
        ctx.fillStyle = "rgba(7,7,13,0.8)";
        ctx.fillRect(x0 - 3, y - 2, tw + 6, FS + 5);
        ctx.fillStyle = color || TH.text;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText(text, x0, y);
    }
    const spatialExt = (N, dx, off = 0, n = N) => [((off - N / 2) - 0.5) * dx * 1e3, ((off + n - 1 - N / 2) + 0.5) * dx * 1e3];

    function ampPhase(u, n, mode, maskRel = 0.05) {
        const out = new Float64Array(n * n);
        let mx = 0;
        for (let k = 0; k < n * n; k++) mx = Math.max(mx, Math.hypot(u.re[k], u.im[k]));
        for (let k = 0; k < n * n; k++) {
            const a = Math.hypot(u.re[k], u.im[k]);
            out[k] = mode === "phase" ? (a > maskRel * mx ? Math.atan2(u.im[k], u.re[k]) : NaN) : a;
        }
        return {
            data: out,
            max: mx
        };
    }

    function truthScale() {
        let mx = 0;
        const o = prep.obj;
        for (let k = 0; k < o.re.length; k++) mx = Math.max(mx, Math.hypot(o.re[k], o.im[k]));
        return mx;
    }

    function mapOpts(mode, amax) {
        return mode === "phase" ?
            {
                cmap: "twilight",
                norm: {
                    min: -Math.PI,
                    max: Math.PI
                },
                cb: {
                    ticks: [-Math.PI, 0, Math.PI],
                    format: (v) => (v === 0 ? "0" : (v > 0 ? "π" : "−π"))
                },
                cbLabel: "arg u (rad)"
            } :
            {
                cmap: "viridis",
                norm: {
                    min: 0,
                    max: amax
                },
                cbLabel: "|u| (illum.)"
            };
    }

    function cutOverlay(ctx, map) {
        const y = (cutRow - res.grid.N / 2) * res.grid.dx * 1e3;
        const py = map.yToPx(y);
        ctx.strokeStyle = TH.marker;
        ctx.setLineDash([6, 4]);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(map.plot.x, py);
        ctx.lineTo(map.plot.x + map.plot.w, py);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    /** Reconstruction shown in panel 4 (object plane at z_r) and the truth at the same plane. */
    function currentRecon() {
        if (!res) return null;
        if (res.params.method === "gs") {
            if (!gs) return null;
            const c = HG.correlation(gs.g, prep.obj);
            return {
                u: HG.dephase(gs.g, c.phase),
                truth: prep.obj,
                rho: gs.iter ? c.rho : NaN,
                label: "GS estimate, object plane"
            };
        }
        return {
            u: res.recon.object,
            truth: res.recon.truthObject,
            rho: res.recon.corr.rho,
            label: "z_r = " + fmt(res.params.zr * 1e3, 3) + " mm"
        };
    }

    // ------------------------------------------------------------------ panels
    function drawObject(ctx, w, h) {
        if (!res) return;
        const g = res.grid,
            mode = ctl.get().view;
        const ap = ampPhase(prep.obj, g.N, mode);
        maps.obj = drawMap(ctx, w, h, Object.assign({
            data: ap.data,
            n: g.N,
            ext: spatialExt(g.N, g.dx),
            xlabel: "x",
            ylabel: "y",
            unit: "mm",
            overlay: cutOverlay
        }, mapOpts(mode, truthScale())));
    }

    function drawHolo(ctx, w, h) {
        if (!res) return;
        const g = res.grid,
            s = ctl.get(),
            N = g.N;
        const zoom = Math.max(1, Math.min(N / 8, Number(s.zoom) || 1)),
            n = N / zoom,
            off = N / 2 - n / 2;
        const src = s.hview === "obj" ? res.Iobj : res.H;
        const bits = res.params.bits;
        let scale = 1,
            label = s.hview === "obj" ? "|O|² (I_illum)" : "H (I_illum)";
        if (bits > 0) {
            let mx = 0;
            for (let i = 0; i < src.length; i++) mx = Math.max(mx, src[i]);
            scale = (Math.pow(2, bits) - 1) / (mx || 1);
            label = "ADU (" + bits + "-bit)";
        }
        const data = new Float64Array(n * n);
        let mn = Infinity,
            mx = -Infinity;
        for (let y = 0; y < n; y++)
            for (let x = 0; x < n; x++) {
                const v = src[(y + off) * N + x + off] * scale;
                data[y * n + x] = v;
                if (v < mn) mn = v;
                if (v > mx) mx = v;
            }
        const ext = spatialExt(N, g.dx, off, n);
        maps.holo = drawMap(ctx, w, h, {
            data,
            n,
            ext,
            xlabel: "x",
            ylabel: "y",
            unit: "mm",
            cmap: "inferno",
            norm: {
                min: Math.min(0, mn),
                max: mx > 0 ? mx : 1
            },
            cbLabel: label,
            overlay: (c, map) => {
                if (zoom >= 8) tag(c, n + " × " + n + " pixels shown", map.plot.x + 6, map.plot.y + 6, TH.textMuted);
            }
        });
    }

    function drawSpectrum(ctx, w, h) {
        if (!res) return;
        const g = res.grid,
            N = g.N,
            L = res.layout,
            B = res.B;
        let mx = 0;
        for (let i = 0; i < res.spectrum.length; i++) mx = Math.max(mx, res.spectrum[i]);
        const df = g.df * 1e-3,
            ext = [(-N / 2 - 0.5) * df, (N / 2 - 0.5) * df],
            period = N * df;
        const specN = res.spectrum.map((v) => v / (mx || 1));
        maps.spec = drawMap(ctx, w, h, {
            data: specN,
            n: N,
            ext,
            xlabel: "f_x",
            ylabel: "f_y",
            unit: "cycles/mm",
            cmap: "inferno",
            norm: {
                log: true,
                min: 1e-6,
                max: 1
            },
            cbLabel: "|Ĥ|/max",
            overlay: (c, map) => {
                const circ = (fx, fy, r, color, dash, label, labelBelow) => {
                    for (const kx of [-1, 0, 1])
                        for (const ky of [-1, 0, 1]) {
                            const cx = fx * 1e-3 + kx * period,
                                cy = fy * 1e-3 + ky * period;
                            const p = map.toPx(cx, cy),
                                rp = Math.abs(map.xToPx(r * 1e-3) - map.xToPx(0));
                            c.strokeStyle = color;
                            c.lineWidth = 1.8;
                            c.setLineDash(dash);
                            c.beginPath();
                            c.arc(p.x, p.y, rp, 0, 2 * Math.PI);
                            c.stroke();
                            c.setLineDash([]);
                            if (kx === 0 && ky === 0 && label) tag(c, label, p.x, labelBelow ? p.y + rp + 3 : p.y - rp - FS - 5, color, "center");
                        }
                };
                circ(0, 0, 2 * B, TH.textMuted, [5, 4], "DC (2B)", true);
                circ(L.minus[0], L.minus[1], B, TH.series[2], [], L.inline ? "" : "−1 twin", false);
                circ(L.plus[0], L.plus[1], B, TH.series[0], [], L.inline ? "±1 at DC" : "+1 (O)", false);
                if (res.params.method === "filter") circ(L.plus[0], L.plus[1], res.rw, TH.series[1], [3, 3], "", false);
            }
        });
    }

    function drawRecon(ctx, w, h) {
        const r = currentRecon();
        if (!r) return;
        const g = res.grid,
            mode = ctl.get().view;
        const ap = ampPhase(r.u, g.N, mode);
        maps.rec = drawMap(ctx, w, h, Object.assign({
            data: ap.data,
            n: g.N,
            ext: spatialExt(g.N, g.dx),
            xlabel: "x",
            ylabel: "y",
            unit: "mm",
            overlay: cutOverlay
        }, mapOpts(mode, truthScale())));
    }

    function cutData() {
        const r = currentRecon();
        if (!r) return null;
        const g = res.grid,
            N = g.N,
            mode = ctl.get().view,
            row = cutRow;
        const xs = [],
            ys = [],
            yt = [];
        for (let i = 0; i < N; i++) {
            const k = row * N + i;
            xs.push((i - N / 2) * g.dx * 1e3);
            if (mode === "phase") {
                const a = Math.hypot(r.u.re[k], r.u.im[k]),
                    at = Math.hypot(r.truth.re[k], r.truth.im[k]);
                ys.push(a > 1e-3 ? Math.atan2(r.u.im[k], r.u.re[k]) : NaN);
                yt.push(at > 1e-3 ? Math.atan2(r.truth.im[k], r.truth.re[k]) : NaN);
            } else {
                ys.push(Math.hypot(r.u.re[k], r.u.im[k]));
                yt.push(Math.hypot(r.truth.re[k], r.truth.im[k]));
            }
        }
        return {
            xs,
            ys,
            yt,
            mode,
            y: (row - N / 2) * g.dx
        };
    }

    function drawCut(ctx, w, h) {
        const c = cutData();
        if (!c) return;
        const phase = c.mode === "phase";
        maps.cut = UI.plot(ctx, {
            x: 0,
            y: 0,
            w,
            h
        }, {
            x: {
                min: c.xs[0],
                max: c.xs[c.xs.length - 1],
                label: "x",
                unit: "mm"
            },
            y: phase ? {
                min: -Math.PI - 0.2,
                max: Math.PI + 0.2,
                label: "arg u",
                unit: "rad"
            } : {
                min: 0,
                label: "|u|",
                unit: "illum. amplitude"
            },
            series: [{
                xs: c.xs,
                ys: c.ys,
                label: "reconstruction",
                color: TH.series[0]
            }, {
                xs: c.xs,
                ys: c.yt,
                label: "ground truth",
                color: TH.series[1],
                dash: [7, 4]
            }]
        });
    }

    function drawSweep(ctx, w, h) {
        if (!res || !res.sweep) return;
        const L = res.layout,
            xs = res.sweep.thetas.map((t) => t / DEG);
        const markers = [];
        if (Number.isFinite(L.thetaSep)) markers.push({
            x: L.thetaSep / DEG,
            label: "3B",
            color: TH.textMuted,
            dash: [4, 4]
        });
        if (Number.isFinite(L.thetaClean) && L.thetaClean > 0) markers.push({
            x: L.thetaClean / DEG,
            label: "f_N − B",
            color: TH.series[4],
            dash: [4, 4]
        });
        if (Number.isFinite(L.thetaNyquist)) markers.push({
            x: L.thetaNyquist / DEG,
            label: "θ_max",
            color: TH.warning,
            dash: [2, 3]
        });
        const cursor = res.params.geometry === "offaxis" ? {
            x: res.car.theta / DEG,
            label: "θ = " + degs(res.car.theta)
        } : null;
        maps.sweep = UI.plot(ctx, {
            x: 0,
            y: 0,
            w,
            h
        }, {
            x: {
                min: 0,
                max: xs[xs.length - 1],
                label: "reference tilt θ",
                unit: "°"
            },
            y: {
                min: 0,
                max: 1.05,
                label: "ρ"
            },
            series: [{
                xs,
                ys: res.sweep.rho,
                label: "filtered +1 order",
                color: TH.series[0]
            }],
            markers,
            cursor,
            legend: false
        });
    }

    function drawGS(ctx, w, h) {
        if (!gs) return;
        const n = Math.max(gs.iter, 1),
            target = Math.max(ctl.get().gsn, n);
        const it = Array.from({
            length: gs.iter
        }, (_, i) => i + 1);
        let lo = 1;
        for (const v of gs.errMeas)
            if (v > 0) lo = Math.min(lo, v);
        for (const v of gs.truthErr)
            if (v > 0) lo = Math.min(lo, v);
        const ymin = Math.pow(10, Math.floor(Math.log10(Math.max(lo, 1e-8)) - 0.2));
        maps.gs = UI.plot(ctx, {
            x: 0,
            y: 0,
            w,
            h
        }, {
            x: {
                min: 0,
                max: target,
                label: "iteration"
            },
            y: {
                min: ymin,
                max: 3,
                log: true,
                label: "error"
            },
            series: [{
                    xs: it,
                    ys: gs.errMeas,
                    label: "E_M (measured plane)",
                    color: TH.series[0]
                },
                {
                    xs: it,
                    ys: gs.truthErr,
                    label: "true error",
                    color: TH.series[2],
                    dash: [7, 4]
                }
            ]
        });
        if (!gs.iter) {
            ctx.font = FS + "px " + TH.font;
            ctx.fillStyle = TH.textMuted;
            ctx.textAlign = "center";
            ctx.fillText("Press Run or Step in the GS card", w / 2, h / 2);
        }
    }

    // ------------------------------------------------------------------ text, readouts, table
    const readoutEl = $("readouts");

    function updateStatsRho() {
        const r = currentRecon();
        setText("statRho", r && Number.isFinite(r.rho) ? r.rho.toFixed(4) : "—");
        if (r) setText("recBadge", ({
            filter: "filtered +1",
            direct: "all orders",
            ps4: "4-step PS",
            intensity: "√I, no phase",
            gs: "GS"
        })[res.params.method] + " · ρ = " + (Number.isFinite(r.rho) ? r.rho.toFixed(3) : "—"));
    }

    function fillTable() {
        if (!res) return;
        const tb = $("methodTable").querySelector("tbody");
        const exp = {
            filter: "1",
            direct: "1",
            gabor: "1",
            ps4: "4",
            intensity: "1 (no reference)"
        };
        const rows = res.table.map((t) => ({
            id: t.id,
            label: t.label,
            exp: exp[t.id],
            rho: t.rho,
            err: t.relErr
        }));
        if (gs && gs.iter) {
            const rho = gsTruthRho();
            rows.push({
                id: "gs",
                label: "Gerchberg–Saxton, " + gs.iter + " iterations (object plane)",
                exp: "1 intensity + |o|",
                rho,
                err: gs.truthErr[gs.iter - 1]
            });
        }
        const cur = res.params.method === "direct" && res.layout.inline ? "direct" : res.params.method;
        tb.innerHTML = rows.map((r) => "<tr" + (r.id === cur ? ' class="ho-current"' : "") + "><td>" + r.label + (r.id === cur ? " ◀" : "") + "</td><td>" + r.exp + "</td><td>" + r.rho.toFixed(4) + "</td><td>" + fmt(r.err, 3) + "</td></tr>").join("");
    }

    function updateText(s, p) {
        const g = res.grid,
            L = res.layout,
            B = res.B;
        setText("phiValue", s.phi.toFixed(2) + " rad");
        setText("naoValue", s.nao.toFixed(4) + " → B = " + fmt(B * 1e-3) + " /mm");
        setText("zValue", s.z + " mm");
        setText("lamValue", s.lam + " nm");
        setText("thValue", p.geometry === "inline" ? "0 (in-line)" : degs(res.car.theta) + " (asked " + s.th.toFixed(2) + "°)");
        setText("betaValue", fmt(p.beta, 3));
        setText("pxValue", s.px.toFixed(1) + " µm");
        setText("ffValue", s.ff.toFixed(2));
        setText("rwValue", s.rw.toFixed(2) + " → " + cpm(res.rw));
        setText("pseValue", s.pse + "°");
        setText("zrValue", s.zr.toFixed(2) + " → " + fmt(p.zr * 1e3, 3) + " mm");
        setText("gsnValue", String(s.gsn));
        $("thSlider").disabled = p.geometry === "inline";
        document.querySelectorAll("[data-for]").forEach((el) => {
            el.hidden = !el.dataset.for.split(" ").includes(p.object);
        });
        document.querySelectorAll("[data-meth]").forEach((el) => {
            el.hidden = !el.dataset.meth.split(" ").includes(p.method);
        });

        setText("statTheta", p.geometry === "inline" ? "0° (in-line)" : degs(res.car.theta));
        setText("statPeriod", L.inline ? "∞ (in-line)" : um(L.fringePeriod) + " = " + L.periodPx.toFixed(2) + " px");
        setText("statThetaMax", degs(L.thetaNyquist));
        setText("statOrders", L.inline ? "overlapping (in-line)" : L.overlap ? "OVERLAP" + (L.aliased ? " (aliased)" : "") : (L.aliased ? "separate (aliased)" : "separate"));
        updateStatsRho();

        const host = $("warnHost");
        host.innerHTML = "";
        for (const w of res.warnings) {
            const el = document.createElement("p");
            el.className = "optics-warning";
            el.textContent = w;
            host.appendChild(el);
        }

        const pixC = HG.pixelMTF(res.car.fc[0], res.car.fc[1], p.fill * p.dx);
        const V = 2 * Math.sqrt(p.beta) / (1 + p.beta);
        const rows = [
            ["Object bandwidth B = NA_o/λ", cpm(B) + " (resolution ≈ 1/(2B) = " + um(1 / (2 * B)) + ")"],
            ["Nyquist f_N = 1/(2Δx)", cpm(g.fN) + " · sensor " + fmt(g.L * 1e3, 3) + " mm"],
            ["Carrier f_c (snapped)", L.inline ? "0 (in-line)" : cpm(res.car.fcAbs) + " = (" + res.car.c[0] + ", " + res.car.c[1] + ") bins"],
            ["Aliased carrier position", L.inline ? "—" : "(" + fmt(L.alias[0] * 1e-3) + ", " + fmt(L.alias[1] * 1e-3) + ") cycles/mm" + (L.aliased ? " (ALIASED)" : "")],
            ["Separation needs |f_c| ≥ 3B", cpm(3 * B) + " → θ ≥ " + degs(L.thetaSep)],
            ["Clean upper edge f_N − B (this direction)", cpm(L.fCleanDir) + " → θ ≤ " + degs(L.thetaClean)],
            ["Sampling limit θ_max (2-px fringes)", degs(L.thetaNyquist) + (Number(s.az) ? " (along x: " + degs(L.thetaNyquistX) + ")" : "")],
            ["Distance of +1 from DC / from −1", L.inline ? "0 / 0" : cpm(L.dDC) + " / " + cpm(L.dTwin)],
            ["Pixel MTF at the carrier", L.inline ? "1" : fmt(pixC, 3) + " (fringe contrast factor)"],
            ["Mean fringe visibility 2√β/(1+β)", fmt(V, 3) + " × pixel MTF"],
            ["Reference amplitude |R| (β = " + fmt(p.beta, 3) + ")", fmt(res.A, 4) + " · ⟨|O|²⟩ = " + fmt(res.meanI, 4)],
            ["Largest z for this B: L/(2λB)", fmt(res.zMax * 1e3, 3) + " mm"],
            ["Selected reconstruction ρ", res.recon ? res.recon.corr.rho.toFixed(5) + " (residual " + fmt(res.recon.corr.relErr, 3) + ")" : "GS: see panel 7"]
        ];
        readoutEl.innerHTML = rows.map(([k, v]) => "<div><dt>" + k + "</dt><dd>" + v + "</dd></div>").join("");
        fillTable();

        setText("objBadge", s.view === "phase" ? "arg o" : "|o|");
        setText("objCaption", "Ground truth: " + prep.obj.info + ", band-limited to |f| ≤ B = " + cpm(B) + ". Unit plane-wave illumination; " + (s.view === "phase" ? "phase masked where |o| < 5 % of max." : "amplitude in units of the illumination amplitude."));
        setText("holoBadge", s.hview === "obj" ? "|O|² only" : "|O + R|²");
        setText("holoCaption", (s.hview === "obj" ?
                "Intensity of the object wave alone, |O|², as a camera without a reference would record it. Its phase is gone." :
                "Recorded hologram H = |O + R|²: a real, non-negative intensity per pixel (" + (p.fill > 0 ? "pixel fill " + p.fill.toFixed(2) : "point sampling") + (p.bits ? ", " + p.bits + "-bit" : ", unquantised") + "). The phase of O is encoded in the fringe positions.") +
            (Number(s.zoom) > 1 ? " Centre " + (100 / Number(s.zoom)).toFixed(1) + " % of the sensor shown, nearest-pixel rendering." : ""));
        setText("recCaption", p.method === "gs" ?
            "Gerchberg–Saxton estimate in the object plane (global phase aligned to the truth). Same colour scale as panel 1." :
            "Back-propagated to z_r = " + fmt(p.zr * 1e3, 3) + " mm (" + (s.zr === 1 ? "the object plane" : s.zr.toFixed(2) + " z") + "); global phase aligned to the truth. Same colour scale as panel 1; values above it saturate.");
        setText("cutBadge", "y = " + fmt((cutRow - p.N / 2) * p.dx * 1e3, 3) + " mm · " + (s.view === "phase" ? "phase" : "amplitude"));
        setText("sweepCaption", "ρ of the Fourier-filtered off-axis reconstruction versus tilt along the " + (Number(s.az) === 45 ? "diagonal" : Number(s.az) === 90 ? "y axis" : "x axis") + " (same object and sensor, no quantisation). Markers: 3B (orders clear DC), f_N − B (+1 still inside the band), θ_max (2-px fringes). Click or use ←/→ to set θ.");

        if (descs.obj) {
            descs.obj.update("Ground truth " + p.object + " object, bandwidth " + cpm(B) + ".");
            descs.holo.update((s.hview === "obj" ? "Object intensity only" : "Hologram") + ": fringe period " + (L.inline ? "infinite (in-line)" : um(L.fringePeriod) + " = " + L.periodPx.toFixed(2) + " pixels") + ", mean intensity " + fmt(res.A * res.A + res.meanI, 3) + ".");
            descs.spec.update("Hologram spectrum: DC disc radius " + cpm(2 * B) + "; +1 order at (" + fmt(L.plus[0] * 1e-3) + ", " + fmt(L.plus[1] * 1e-3) + ") cycles/mm; " + (L.overlap ? "orders overlap." : "orders separated."));
            const r = currentRecon();
            descs.rec.update("Reconstruction by " + p.method + ": correlation with the truth " + (r && Number.isFinite(r.rho) ? r.rho.toFixed(4) : "not yet available") + ".");
            descs.sweep.update("Correlation versus reference angle: plateau between " + degs(L.thetaSep) + " and " + degs(L.thetaClean) + "; sampling limit " + degs(L.thetaNyquist) + "; current θ " + degs(res.car.theta) + ".");
            descs.cut.update("Line cut at y = " + fmt((cutRow - p.N / 2) * p.dx * 1e3, 3) + " mm comparing reconstruction and truth.");
        }
    }

    // ------------------------------------------------------------------ init
    compute();
    setup("objCanvas", "obj", 1.08, drawObject);
    setup("holoCanvas", "holo", 1.08, drawHolo);
    setup("specCanvas", "spec", 1.08, drawSpectrum);
    setup("recCanvas", "rec", 1.08, drawRecon);
    setup("cutCanvas", "cut", 3.2, drawCut, 230);
    setup("sweepCanvas", "sweep", 1.45, drawSweep, 260);
    setup("gsCanvas", "gs", 1.45, drawGS, 260);
    descs = {
        obj: UI.describeCanvas($("objCanvas"), "Object", {
            label: "Ground-truth object amplitude or phase"
        }),
        holo: UI.describeCanvas($("holoCanvas"), "Hologram", {
            label: "Recorded sensor intensity"
        }),
        spec: UI.describeCanvas($("specCanvas"), "Spectrum", {
            label: "Hologram spectrum with DC, +1 and −1 orders"
        }),
        rec: UI.describeCanvas($("recCanvas"), "Reconstruction", {
            label: "Reconstructed field amplitude or phase"
        }),
        cut: UI.describeCanvas($("cutCanvas"), "Line cut", {
            label: "Line cut through reconstruction and truth"
        }),
        sweep: UI.describeCanvas($("sweepCanvas"), "Angle sweep", {
            label: "Reconstruction correlation versus reference angle"
        }),
        gs: UI.describeCanvas($("gsCanvas"), "GS error", {
            label: "Gerchberg–Saxton error versus iteration"
        })
    };
    if (res) updateText(ctl.get(), toParams(ctl.get()));
    updateGSText();

    // cut row: click or arrow keys on either map
    for (const key of ["obj", "rec"]) {
        const el = cv[key].canvas;
        el.addEventListener("click", (e) => {
            const m = maps[key];
            if (!m || !res) return;
            const r = el.getBoundingClientRect(),
                px = e.clientX - r.left,
                py = e.clientY - r.top;
            if (!m.contains(px, py)) return;
            cutRow = Math.max(0, Math.min(res.grid.N - 1, Math.round(m.pxToY(py) * 1e-3 / res.grid.dx + res.grid.N / 2)));
            updateText(ctl.get(), toParams(ctl.get()));
            cv.obj.redraw();
            cv.rec.redraw();
            cv.cut.redraw();
        });
        el.addEventListener("keydown", (e) => {
            if (!res || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
            e.preventDefault();
            cutRow = Math.max(0, Math.min(res.grid.N - 1, cutRow + (e.key === "ArrowUp" ? 1 : -1) * (e.shiftKey ? 8 : 1)));
            updateText(ctl.get(), toParams(ctl.get()));
            cv.obj.redraw();
            cv.rec.redraw();
            cv.cut.redraw();
        });
    }
    // reference angle from the sweep plot
    const sweepEl = cv.sweep.canvas;
    const setTheta = (deg) => {
        const th = $("thSlider");
        ctl.set({
            geo: "offaxis",
            th: Math.max(Number(th.min), Math.min(Number(th.max), Math.round(deg * 100) / 100))
        });
    };
    sweepEl.addEventListener("click", (e) => {
        const m = maps.sweep;
        if (!m) return;
        const r = sweepEl.getBoundingClientRect(),
            px = e.clientX - r.left,
            py = e.clientY - r.top;
        if (m.contains(px, py)) setTheta(m.pxToX(px));
    });
    sweepEl.addEventListener("keydown", (e) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        e.preventDefault();
        setTheta(ctl.get().th + (e.key === "ArrowRight" ? 1 : -1) * (e.shiftKey ? 0.5 : 0.05));
    });

    function applyPreset(name) {
        const pr = PRESETS[name];
        if (!pr) return;
        loop.stop();
        cutRow = -1;
        ctl.set(Object.assign({}, DEFAULTS, pr.v));
        document.querySelectorAll("[data-preset]").forEach((b) => b.classList.toggle("active", b.dataset.preset === name));
        setText("presetNote", pr.note);
        if (pr.v.meth === "gs") {
            // recompute now so the GS state matches, then run unless reduced motion is requested
            if (pending) {
                cancelAnimationFrame(pending);
                pending = 0;
            }
            compute();
            drawAll();
            if (!UI.prefersReducedMotion()) loop.start();
        }
    }
    document.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => applyPreset(b.dataset.preset)));
    $("resetBtn").addEventListener("click", () => {
        loop.stop();
        cutRow = -1;
        ctl.set(Object.assign({}, DEFAULTS));
        document.querySelectorAll("[data-preset]").forEach((b) => b.classList.remove("active"));
        setText("presetNote", "Reset to the default off-axis hologram of the letters “HOLO” (λ = 633 nm, Δx = 5 µm, z = 12 mm).");
    });

    UI.addExportBar($("exportHost"), {
        name: "holography",
        url,
        getState: () => Object.assign({}, ctl.get(), res ? {
            results: {
                thetaSnappedDeg: res.car.theta / DEG,
                carrierBins: res.car.c,
                fringePeriodPx: res.layout.periodPx,
                thetaMaxDeg: res.layout.thetaNyquist / DEG,
                overlap: res.layout.overlap,
                aliased: res.layout.aliased,
                bandwidthCyclesPerMm: res.B * 1e-3,
                table: res.table,
                warnings: res.warnings,
                gs: gs ? {
                    iterations: gs.iter,
                    errMeas: gs.errMeas,
                    truthErr: gs.truthErr
                } : null,
                sweep: res.sweep ? {
                    thetaDeg: res.sweep.thetas.map((t) => t / DEG),
                    rho: res.sweep.rho
                } : null
            }
        } : {}),
        getCSV: () => {
            const c = cutData();
            const rows = c ? c.xs.map((x, i) => [x, c.ys[i], c.yt[i]]) : [];
            const q = c && c.mode === "phase" ? "arg u (rad)" : "|u| (illumination amplitude)";
            return {
                headers: ["x (mm) at y = " + (c ? fmt(c.y * 1e3, 4) : "0") + " mm", "reconstruction " + q, "ground truth " + q],
                rows
            };
        },
        canvases: [cv.obj.canvas, cv.holo.canvas, cv.spec.canvas, cv.rec.canvas, cv.cut.canvas, cv.sweep.canvas, cv.gs.canvas],
        caption: () => {
            if (!res) return "Holography";
            const p = res.params;
            return "Holography: " + p.object + ", " + p.geometry + (p.geometry === "offaxis" ? " θ = " + degs(res.car.theta) : "") + ", method " + p.method + ", λ = " + Math.round(p.lambda * 1e9) + " nm, Δx = " + fmt(p.dx * 1e6) + " µm, z = " + fmt(p.z * 1e3) + " mm";
        }
    });
    UI.onThemeChange(() => drawAll());
    url.ready.then(() => schedule());
})();