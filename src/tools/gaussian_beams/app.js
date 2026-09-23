/*
 * Gaussian beams and beam transformation: page glue.
 * Physics lives in ../shared/optics/gaussianBeams.js (pure, tested in tests/optics/gaussian_beams.test.js).
 * Controls are in display units (nm, µm, mm, mW); everything is converted to SI before the model.
 */
(function() {
    "use strict";
    const UI = window.OpticsUI,
        core = window.OpticsModels.core,
        GB = window.OpticsModels.gaussianBeams;
    const $ = (id) => document.getElementById(id);
    const NM = 1e-9,
        UM = 1e-6,
        MM = 1e-3,
        MW = 1e-3;
    const TH = UI.palette().canvas;
    const COL = {
        beam: TH.series[0],
        arc: TH.series[1],
        lens: TH.series[3],
        waist: TH.marker,
        zr: "rgba(105, 245, 231, 0.07)",
        phase: TH.series[2]
    };
    const F_MIN_MM = 5;

    const DEFAULTS = {
        lam: 1064,
        n: 1,
        w0: 1000,
        z0: 0,
        pow: 1,
        m2: 1,
        nl: "1",
        x1: 100,
        f1: 100,
        x2: 300,
        f2: 150,
        x3: 500,
        f3: 200,
        L: 300,
        zc: 200,
        arcs: true,
        fix: false,
        mm: "single",
        wt: 50,
        zt: 1500
    };

    // ------------------------------------------------------------------ state
    let model = null; // last computed model (SI)
    let exactCursor = null; // metres; set by buttons/presets so a waist can be hit exactly
    let renderPending = false;
    let envMap = null,
        drag = null;

    const sidebar = document.querySelector(".options-sidebar");
    UI.enhanceAllSliders(sidebar, {
        lam: {
            unit: "nm"
        },
        w0: {
            unit: "µm"
        },
        z0: {
            unit: "mm"
        },
        pow: {
            unit: "mW"
        },
        x1: {
            unit: "mm"
        },
        x2: {
            unit: "mm"
        },
        x3: {
            unit: "mm"
        },
        f1: {
            unit: "mm"
        },
        f2: {
            unit: "mm"
        },
        f3: {
            unit: "mm"
        },
        benchL: {
            unit: "mm"
        },
        zc: {
            unit: "mm"
        },
        wt: {
            unit: "µm"
        },
        zt: {
            unit: "mm"
        }
    });

    const ctl = UI.bindControls({
        lam: "#lam",
        n: "#nIdx",
        w0: "#w0",
        z0: "#z0",
        pow: "#pow",
        m2: "#m2",
        nl: "#nLens",
        x1: "#x1",
        f1: "#f1",
        x2: "#x2",
        f2: "#f2",
        x3: "#x3",
        f3: "#f3",
        L: "#benchL",
        zc: "#zc",
        arcs: "#showArcs",
        fix: "#fixWin",
        mm: "#mmMode",
        wt: "#wt",
        zt: "#zt"
    }, () => {
        url.update();
        scheduleRender();
    });
    const url = UI.urlState({
        get: ctl.get,
        set: ctl.set
    });

    // user edits of the cursor slider drop the exact cursor
    $("zc").addEventListener("input", (e) => {
        if (e.isTrusted || !exactCursorLocked) exactCursor = null;
    });
    let exactCursorLocked = false;

    // ------------------------------------------------------------------ helpers
    const clampF = (fmm) => {
        const s = fmm < 0 ? -1 : 1;
        return s * Math.max(F_MIN_MM, Math.abs(fmm));
    };
    const fmtLen = (v) => UI.formatSI(v, "m");
    const fmtMM = (v, d = 2) => (v / MM).toFixed(d) + " mm";
    const fmtRad = (v) => v.toFixed(3) + " rad";
    const fmtExp = (v) => (v === 0 ? "0" : v.toExponential(1));

    function wUnit(maxW) {
        return maxW < 1e-3 ? {
            s: UM,
            u: "µm"
        } : {
            s: MM,
            u: "mm"
        };
    }

    function fmtIntensity(Iwm2) {
        return UI.formatSI(Iwm2 * 1e-4, "W/cm²");
    }
    /** display unit for a peak intensity given in W/cm², so tick labels stay short */
    function intUnit(peakWcm2) {
        const U = [
            [1e9, "GW/cm²"],
            [1e6, "MW/cm²"],
            [1e3, "kW/cm²"],
            [1, "W/cm²"],
            [1e-3, "mW/cm²"],
            [1e-6, "µW/cm²"]
        ];
        for (const [f, u] of U)
            if (peakWcm2 >= f) return {
                f,
                u
            };
        return {
            f: 1e-6,
            u: "µW/cm²"
        };
    }

    function readState() {
        const s = ctl.get();
        const nl = Math.max(0, Math.min(3, Number(s.nl) || 0));
        const lenses = [];
        for (let i = 1; i <= nl; i++) lenses.push({
            z: s["x" + i] * MM,
            f: clampF(s["f" + i]) * MM,
            idx: i,
            fRaw: s["f" + i]
        });
        return {
            s,
            nl,
            lenses,
            lambda0: s.lam * NM,
            n: s.n,
            M2: s.m2,
            w0: s.w0 * UM,
            z0: s.z0 * MM,
            P: s.pow * MW,
            L: s.L * MM
        };
    }

    function compute() {
        const st = readState();
        const {
            lambda0,
            n,
            M2,
            w0,
            z0,
            L,
            lenses
        } = st;
        const tr = GB.traceLenses({
            w0,
            z0,
            lambda0,
            n,
            M2
        }, lenses);
        // envelope samples, including the lens planes exactly (kinks)
        const N = 700;
        const zs = [];
        for (let i = 0; i <= N; i++) zs.push(L * i / N);
        for (const Ls of tr.lenses)
            if (Ls.z > 0 && Ls.z < L) zs.push(Ls.z);
        zs.sort((a, b) => a - b);
        const ws = [],
            invRs = [],
            gouys = [];
        let wMax = 0;
        for (const z of zs) {
            const q = GB.stateAt(tr, z);
            ws.push(q.w);
            invRs.push(q.invR);
            gouys.push(q.gouy);
            if (q.w > wMax) wMax = q.w;
        }
        let zc = exactCursor != null && Math.abs(exactCursor / MM - st.s.zc) < 0.051 ? exactCursor : st.s.zc * MM;
        zc = Math.min(Math.max(zc, 0), L);
        const cur = GB.stateAt(tr, zc);
        // divergence / paraxial check for every segment that overlaps the bench
        let thetaMax = 0,
            thetaSeg = null;
        tr.segments.forEach((sg, k) => {
            if (sg.zEnd <= 0 || sg.zStart >= L) return;
            const th = GB.divergence(sg.w0, lambda0, n, M2);
            if (th > thetaMax) {
                thetaMax = th;
                thetaSeg = k;
            }
        });
        // per-lens transformation table
        const rows = tr.lenses.map((Ls, k) => {
            const before = tr.segments[k],
                after = tr.segments[k + 1];
            const s = Ls.z - before.z0,
                sOut = after.z0 - Ls.z;
            const self = GB.selfImaging(s, before.zR, Ls.f);
            const dSelf = Math.max(Math.abs(self.sOut - sOut) / Math.max(Math.abs(sOut), Math.abs(Ls.f)), Math.abs(self.m * before.w0 - after.w0) / after.w0);
            // direct ABCD from the input plane z = min(0, first lens) to three planes after this lens
            const zA = Math.min(0, tr.lenses[0].z) - 1e-3;
            const qA = GB.qAt(zA, tr.beam);
            let dAbcd = 0;
            const zEnd = Number.isFinite(after.zEnd) ? after.zEnd : Ls.z + Math.max(3 * after.zR, 0.1);
            for (const t of [0.1, 0.5, 0.9]) {
                const z = Ls.z + t * (zEnd - Ls.z);
                const b = GB.beamFromQ(GB.applyABCD(GB.systemMatrix(tr.lenses, zA, z), qA), lambda0, n, M2);
                dAbcd = Math.max(dAbcd, Math.abs(b.w - GB.stateAt(tr, z).w) / b.w);
            }
            return {
                lens: Ls,
                zEnd: after.zEnd,
                s,
                sOut,
                w0in: before.w0,
                w0out: after.w0,
                zRout: after.zR,
                m: self.m,
                sSelf: self.sOut,
                dSelf,
                dAbcd
            };
        });
        // numerical power check at the cursor (Simpson over r ∈ [0, 6w])
        const nR = 400,
            rMax = 6 * cur.w,
            h = rMax / nR;
        const samples = [];
        for (let i = 0; i <= nR; i++) {
            const r = i * h;
            samples.push(2 * Math.PI * r * GB.intensity(r, cur.w, st.P));
        }
        const pNum = core.simpsonSamples(samples, h);
        model = {
            st,
            tr,
            zs,
            ws,
            invRs,
            gouys,
            wMax,
            zc,
            cur,
            thetaMax,
            thetaSeg,
            rows,
            pNum
        };
        return model;
    }

    // ------------------------------------------------------------------ canvases
    const envCanvas = $("envCanvas"),
        curvCanvas = $("curvCanvas"),
        intCanvas = $("intCanvas"),
        phCanvas = $("phCanvas"),
        cutCanvas = $("cutCanvas");
    const descEnv = UI.describeCanvas(envCanvas, "Beam envelope", {
        label: "Beam radius ±w(z) along the bench with lenses, waists and wavefront arcs"
    });
    const descCurv = UI.describeCanvas(curvCanvas, "Curvature and Gouy phase", {
        label: "Wavefront curvature 1/R(z) and accumulated Gouy phase along z"
    });
    const descInt = UI.describeCanvas(intCanvas, "Transverse intensity", {
        label: "Transverse intensity map at the cursor plane"
    });
    const descPh = UI.describeCanvas(phCanvas, "Transverse phase", {
        label: "Transverse phase map at the cursor plane"
    });
    const descCut = UI.describeCanvas(cutCanvas, "Line cut", {
        label: "Intensity and phase line cuts through the beam axis"
    });

    function drawEnvelope(ctx, W, H) {
        if (!model) return;
        const {
            st,
            tr,
            zs,
            ws,
            wMax,
            zc,
            cur
        } = model;
        const L = st.L,
            wu = wUnit(wMax);
        const yMax = 1.3 * wMax / wu.s;
        const zmm = zs.map((z) => z / MM);
        const up = ws.map((w) => w / wu.s),
            dn = ws.map((w) => -w / wu.s);
        const map = UI.plot(ctx, {
            x: 0,
            y: 0,
            w: W,
            h: H
        }, {
            x: {
                min: 0,
                max: L / MM,
                label: "z",
                unit: "mm"
            },
            y: {
                min: -yMax,
                max: yMax,
                label: "±w",
                unit: wu.u
            },
            series: [{
                xs: zmm,
                ys: up,
                color: COL.beam,
                label: "+w(z)"
            }, {
                xs: zmm,
                ys: dn,
                color: COL.beam,
                dash: [6, 3],
                label: "−w(z)"
            }],
            hlines: [{
                y: 0,
                color: TH.gridStrong,
                dash: [2, 4]
            }],
            cursor: {
                x: zc / MM,
                label: "z = " + (zc / MM).toFixed(1) + " mm"
            },
            legend: false,
            fontSize: 12
        });
        envMap = map;
        const P = map.plot;
        ctx.save();
        ctx.beginPath();
        ctx.rect(P.x, P.y, P.w, P.h);
        ctx.clip();
        // Rayleigh-range strips
        ctx.fillStyle = COL.zr;
        for (const sg of tr.segments) {
            const a = Math.max(sg.z0 - sg.zR, sg.zStart, 0),
                b = Math.min(sg.z0 + sg.zR, sg.zEnd, L);
            if (b > a) ctx.fillRect(map.xToPx(a / MM), P.y, map.xToPx(b / MM) - map.xToPx(a / MM), P.h);
        }
        // beam band
        ctx.beginPath();
        zmm.forEach((z, i) => {
            const x = map.xToPx(z),
                y = map.yToPx(up[i]);
            if (i) ctx.lineTo(x, y);
            else ctx.moveTo(x, y);
        });
        for (let i = zmm.length - 1; i >= 0; i--) ctx.lineTo(map.xToPx(zmm[i]), map.yToPx(dn[i]));
        ctx.closePath();
        ctx.fillStyle = "rgba(105, 245, 231, 0.16)";
        ctx.fill();
        // wavefront arcs (constant-phase surfaces z = zi − r² invR / 2, sag exaggerated by E)
        let E = null;
        if (st.s.arcs) {
            const nA = 11,
                pxPerM = P.w / L;
            const arcs = [];
            for (let i = 0; i < nA; i++) {
                const z = L * (i + 0.5) / nA;
                if (tr.lenses.some((Ls) => Math.abs(Ls.z - z) < 0.02 * L)) continue;
                arcs.push({
                    z,
                    s: GB.stateAt(tr, z),
                    hi: false
                });
            }
            arcs.push({
                z: zc,
                s: cur,
                hi: true
            });
            const spacing = P.w / nA;
            const maxSag = Math.max(...arcs.map((a) => Math.abs(a.s.w * a.s.w * a.s.invR / 2) * pxPerM));
            if (maxSag > 0) {
                const raw = Math.min(22, 0.4 * spacing) / maxSag;
                const p10 = Math.pow(10, Math.floor(Math.log10(raw)));
                E = Math.max(1, Math.floor(raw / p10) * p10);
            } else E = 1;
            for (const a of arcs) {
                ctx.strokeStyle = a.hi ? TH.cursor : COL.arc;
                ctx.lineWidth = a.hi ? 2 : 1.4;
                ctx.globalAlpha = a.hi ? 1 : 0.75;
                ctx.beginPath();
                for (let j = 0; j <= 40; j++) {
                    const r = a.s.w * (-1 + 2 * j / 40);
                    const x = map.xToPx(a.z / MM) - E * (r * r * a.s.invR / 2) * pxPerM;
                    const y = map.yToPx(r / wu.s);
                    if (j) ctx.lineTo(x, y);
                    else ctx.moveTo(x, y);
                }
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
        }
        // waists
        ctx.font = "12px " + TH.font;
        tr.segments.forEach((sg, k) => {
            if (!(sg.z0 >= Math.max(sg.zStart, 0) && sg.z0 <= Math.min(sg.zEnd, L))) return;
            const x = map.xToPx(sg.z0 / MM),
                y0 = map.yToPx(0);
            ctx.strokeStyle = COL.waist;
            ctx.lineWidth = 1.5;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(x, map.yToPx(sg.w0 / wu.s));
            ctx.lineTo(x, map.yToPx(-sg.w0 / wu.s));
            ctx.stroke();
            ctx.setLineDash([]);
            const r = k === 0 ? 7 : 5.5;
            ctx.fillStyle = COL.waist;
            ctx.beginPath();
            ctx.moveTo(x, y0 - r);
            ctx.lineTo(x + r, y0);
            ctx.lineTo(x, y0 + r);
            ctx.lineTo(x - r, y0);
            ctx.closePath();
            ctx.fill();
            if (k === 0) {
                ctx.strokeStyle = TH.text;
                ctx.lineWidth = 1;
                ctx.stroke();
            }
            const label = (k === 0 ? "w₀ " : "w₀′ ") + fmtLen(sg.w0);
            const tw = ctx.measureText(label).width;
            const lx = Math.min(P.x + P.w - tw - 4, Math.max(P.x + 4, x - tw / 2));
            ctx.fillStyle = "rgba(7,7,13,0.8)";
            ctx.fillRect(lx - 2, y0 + 10, tw + 4, 16);
            ctx.fillStyle = COL.waist;
            ctx.textAlign = "left";
            ctx.textBaseline = "top";
            ctx.fillText(label, lx, y0 + 12);
        });
        // lenses
        const top = map.yToPx(1.18 * wMax / wu.s),
            bot = map.yToPx(-1.18 * wMax / wu.s);
        for (const Ls of tr.lenses) {
            if (Ls.z < 0 || Ls.z > L) continue;
            const x = map.xToPx(Ls.z / MM),
                conv = Ls.f > 0,
                hd = 7;
            ctx.strokeStyle = COL.lens;
            ctx.lineWidth = drag && drag.kind === "lens" && drag.idx === Ls.idx ? 3.5 : 2.5;
            ctx.beginPath();
            ctx.moveTo(x, top);
            ctx.lineTo(x, bot);
            ctx.stroke();
            ctx.beginPath();
            if (conv) {
                ctx.moveTo(x - hd, top + hd);
                ctx.lineTo(x, top);
                ctx.lineTo(x + hd, top + hd);
                ctx.moveTo(x - hd, bot - hd);
                ctx.lineTo(x, bot);
                ctx.lineTo(x + hd, bot - hd);
            } else {
                ctx.moveTo(x - hd, top - hd);
                ctx.lineTo(x, top);
                ctx.lineTo(x + hd, top - hd);
                ctx.moveTo(x - hd, bot + hd);
                ctx.lineTo(x, bot);
                ctx.lineTo(x + hd, bot + hd);
            }
            ctx.stroke();
            const label = "L" + Ls.idx + " f=" + Math.round(Ls.f / MM);
            const tw = ctx.measureText(label).width;
            const lx = Math.min(P.x + P.w - tw - 4, Math.max(P.x + 4, x - tw / 2));
            ctx.fillStyle = "rgba(7,7,13,0.8)";
            ctx.fillRect(lx - 2, P.y + 3, tw + 4, 16);
            ctx.fillStyle = COL.lens;
            ctx.textAlign = "left";
            ctx.textBaseline = "top";
            ctx.fillText(label, lx, P.y + 5);
        }
        ctx.restore();
        if (E != null) {
            ctx.font = "12px " + TH.font;
            ctx.textAlign = "left";
            ctx.textBaseline = "top";
            const lines = ["arc sag ×" + E];
            if (cur.invR === 0) lines.push("cursor: planar (R = ∞)");
            lines.forEach((txt, i) => {
                const y = P.y + P.h - 22 - 18 * (lines.length - i);
                ctx.fillStyle = "rgba(7,7,13,0.8)";
                ctx.fillRect(P.x + 4, y - 2, ctx.measureText(txt).width + 8, 16);
                ctx.fillStyle = TH.textMuted;
                ctx.fillText(txt, P.x + 8, y);
            });
        }
    }

    function drawCurv(ctx, W, H) {
        if (!model) return;
        const {
            st,
            tr,
            zs,
            invRs,
            gouys,
            zc,
            cur
        } = model;
        const zmm = zs.map((z) => z / MM);
        const kMax = Math.max(1e-9, ...invRs.map(Math.abs)) * 1.15;
        const markers = tr.lenses.filter((Ls) => Ls.z >= 0 && Ls.z <= st.L).map((Ls) => ({
            x: Ls.z / MM,
            label: "L" + Ls.idx,
            color: COL.lens
        }));
        const hTop = Math.round(H * 0.52);
        UI.plot(ctx, {
            x: 0,
            y: 0,
            w: W,
            h: hTop
        }, {
            x: {
                min: 0,
                max: st.L / MM,
                label: "",
                unit: ""
            },
            y: {
                min: -kMax,
                max: kMax,
                label: "1/R",
                unit: "m⁻¹"
            },
            series: [{
                xs: zmm,
                ys: invRs,
                color: COL.arc,
                label: "1/R(z)"
            }],
            hlines: [{
                y: 0,
                color: TH.gridStrong
            }],
            markers,
            cursor: {
                x: zc / MM,
                label: "1/R = " + (cur.invR === 0 ? "0 (planar)" : cur.invR.toPrecision(3) + " m⁻¹")
            },
            margin: {
                b: 22
            },
            legend: false
        });
        UI.plot(ctx, {
            x: 0,
            y: hTop,
            w: W,
            h: H - hTop
        }, {
            x: {
                min: 0,
                max: st.L / MM,
                label: "z",
                unit: "mm"
            },
            y: {
                label: "ψ",
                unit: "rad"
            },
            series: [{
                xs: zmm,
                ys: gouys,
                color: COL.phase,
                label: "ψ(z)"
            }],
            markers,
            cursor: {
                x: zc / MM,
                label: "ψ = " + cur.gouy.toFixed(3) + " rad"
            },
            legend: false
        });
    }

    function transverseWindow() {
        const {
            st,
            cur,
            wMax
        } = model;
        return 2.5 * (st.s.fix ? wMax : cur.w);
    }

    function squareRect(W, H, m) {
        const side = Math.max(40, Math.min(W - m.l - m.r, H - m.t - m.b));
        return {
            x: m.l + (W - m.l - m.r - side) / 2,
            y: m.t,
            side
        };
    }

    function drawMap(ctx, W, H, kind) {
        if (!model) return;
        const {
            st,
            cur
        } = model;
        const hw = transverseWindow(),
            wu = wUnit(hw);
        const cbW = 12,
            m = {
                l: 50,
                r: 20 + cbW + 58,
                t: 12,
                b: 42
            };
        const sq = squareRect(W, H, m);
        const rect = {
            x: sq.x,
            y: sq.y,
            w: sq.side,
            h: sq.side
        };
        const N = 121,
            data = new Float64Array(N * N);
        const I0 = GB.intensity(0, cur.w, st.P);
        const iu = intUnit(I0 * 1e-4);
        for (let iy = 0; iy < N; iy++)
            for (let ix = 0; ix < N; ix++) {
                const x = -hw + 2 * hw * ix / (N - 1),
                    y = -hw + 2 * hw * iy / (N - 1),
                    r = Math.hypot(x, y);
                const I = GB.intensity(r, cur.w, st.P);
                if (kind === "int") data[iy * N + ix] = I * 1e-4 / iu.f;
                else {
                    if (I < 1e-3 * I0) {
                        data[iy * N + ix] = NaN;
                        continue;
                    }
                    const ph = GB.transversePhase(r, cur.invR, cur.gouy, st.lambda0, st.n);
                    data[iy * N + ix] = Math.atan2(Math.sin(ph), Math.cos(ph));
                }
            }
        ctx.fillStyle = TH.panel;
        ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
        const cm = kind === "int" ? "inferno" : "twilight";
        const range = kind === "int" ? {
            min: 0,
            max: I0 * 1e-4 / iu.f
        } : {
            min: -Math.PI,
            max: Math.PI
        };
        UI.imageFromArray(ctx, data, N, N, rect, cm, range);
        // axes via plot overlay (no background, no series)
        UI.plot(ctx, {
            x: rect.x - m.l,
            y: rect.y - m.t,
            w: rect.w + m.l + 6,
            h: rect.h + m.t + m.b
        }, {
            x: {
                min: -hw / wu.s,
                max: hw / wu.s,
                label: "x",
                unit: wu.u,
                grid: false
            },
            y: {
                min: -hw / wu.s,
                max: hw / wu.s,
                label: "y",
                unit: wu.u,
                grid: false
            },
            series: [],
            background: false,
            legend: false,
            margin: {
                l: m.l,
                r: 6,
                t: m.t,
                b: m.b
            }
        });
        // r = w circle
        ctx.save();
        ctx.strokeStyle = kind === "int" ? "rgba(255,255,255,0.85)" : TH.text;
        ctx.setLineDash([5, 4]);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(rect.x + rect.w / 2, rect.y + rect.h / 2, cur.w / hw * rect.w / 2, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.restore();
        const cbRect = {
            x: rect.x + rect.w + 16,
            y: rect.y,
            w: cbW,
            h: rect.h
        };
        if (kind === "int") UI.drawColorbar(ctx, cbRect, cm, {
            min: 0,
            max: I0 * 1e-4 / iu.f,
            label: "I",
            unit: iu.u
        });
        else UI.drawColorbar(ctx, cbRect, cm, {
            min: -Math.PI,
            max: Math.PI,
            label: "φ",
            unit: "rad",
            ticks: [-Math.PI, -Math.PI / 2, 0, Math.PI / 2, Math.PI],
            format: (v) => ["−π", "−π/2", "0", "π/2", "π"][Math.round(v / (Math.PI / 2)) + 2]
        });
    }

    function drawCut(ctx, W, H) {
        if (!model) return;
        const {
            st,
            cur
        } = model;
        const hw = transverseWindow(),
            wu = wUnit(hw);
        const n = 401,
            xs = [],
            Is = [],
            phs = [];
        const iu = intUnit(GB.intensity(0, cur.w, st.P) * 1e-4);
        for (let i = 0; i < n; i++) {
            const x = -hw + 2 * hw * i / (n - 1);
            xs.push(x / wu.s);
            Is.push(GB.intensity(Math.abs(x), cur.w, st.P) * 1e-4 / iu.f);
            phs.push(GB.transversePhase(x, cur.invR, cur.gouy, st.lambda0, st.n));
        }
        const I0 = GB.intensity(0, cur.w, st.P) * 1e-4 / iu.f;
        const stacked = W < 620;
        const r1 = stacked ? {
            x: 0,
            y: 0,
            w: W,
            h: H / 2
        } : {
            x: 0,
            y: 0,
            w: W / 2,
            h: H
        };
        const r2 = stacked ? {
            x: 0,
            y: H / 2,
            w: W,
            h: H / 2
        } : {
            x: W / 2,
            y: 0,
            w: W / 2,
            h: H
        };
        const wm = cur.w / wu.s;
        UI.plot(ctx, r1, {
            x: {
                min: -hw / wu.s,
                max: hw / wu.s,
                label: "x",
                unit: wu.u
            },
            y: {
                min: 0,
                max: I0 * 1.08,
                label: "I",
                unit: iu.u
            },
            series: [{
                xs,
                ys: Is,
                color: COL.beam,
                label: "I(x, 0)"
            }],
            markers: [{
                x: -wm,
                label: "−w"
            }, {
                x: wm,
                label: "+w"
            }],
            hlines: [{
                y: I0 * Math.exp(-2),
                color: TH.warning,
                dash: [3, 3]
            }],
            legend: false
        });
        let lo = Math.min(...phs),
            hi = Math.max(...phs);
        if (hi - lo < 0.5) {
            const c = (hi + lo) / 2;
            lo = c - 0.5;
            hi = c + 0.5;
        }
        UI.plot(ctx, r2, {
            x: {
                min: -hw / wu.s,
                max: hw / wu.s,
                label: "x",
                unit: wu.u
            },
            y: {
                min: lo - 0.05 * (hi - lo),
                max: hi + 0.05 * (hi - lo),
                label: "φ",
                unit: "rad"
            },
            series: [{
                xs,
                ys: phs,
                color: COL.phase,
                label: "φ(x)"
            }],
            markers: [{
                x: -wm,
                label: "−w"
            }, {
                x: wm,
                label: "+w"
            }],
            legend: false
        });
    }

    const envH = UI.setupCanvas(envCanvas, {
        aspect: 2.3,
        minHeight: 260,
        maxHeight: 480,
        draw: drawEnvelope
    });
    const curvH = UI.setupCanvas(curvCanvas, {
        aspect: 2.6,
        minHeight: 300,
        maxHeight: 420,
        draw: drawCurv
    });
    const intH = UI.setupCanvas(intCanvas, {
        aspect: 1.15,
        minHeight: 250,
        maxHeight: 460,
        draw: (c, w, h) => drawMap(c, w, h, "int")
    });
    const phH = UI.setupCanvas(phCanvas, {
        aspect: 1.15,
        minHeight: 250,
        maxHeight: 460,
        draw: (c, w, h) => drawMap(c, w, h, "ph")
    });
    const cutH = UI.setupCanvas(cutCanvas, {
        aspect: 2.8,
        minHeight: 300,
        maxHeight: 400,
        draw: drawCut
    });

    // ------------------------------------------------------------------ DOM readouts
    function setText(id, t) {
        const el = $(id);
        if (el && el.textContent !== t) el.textContent = t;
    }

    function updateDOM() {
        const {
            st,
            tr,
            cur,
            zc,
            thetaMax,
            rows,
            pNum
        } = model;
        const s = st.s;
        setText("lamValue", s.lam + " nm");
        setText("nValue", Number(s.n).toFixed(2));
        setText("w0Value", s.w0 + " µm");
        setText("z0Value", s.z0 + " mm");
        setText("pValue", s.pow + " mW");
        setText("m2Value", Number(s.m2).toFixed(2));
        for (let i = 1; i <= 3; i++) {
            setText("x" + i + "Value", s["x" + i] + " mm");
            const fr = s["f" + i],
                fe = clampF(fr);
            setText("f" + i + "Value", (fe > 0 ? "+" : "") + fe + " mm" + (fe !== fr ? " (clamped)" : ""));
            $("lensGroup" + i).hidden = i > st.nl;
        }
        setText("LValue", s.L + " mm");
        setText("zcValue", (zc / MM).toFixed(exactCursor != null ? 3 : 1) + " mm");
        setText("wtValue", s.wt + " µm");
        setText("ztValue", s.zt + " mm");
        $("ztGroup").hidden = s.mm !== "two";
        $("solveBtn").textContent = s.mm === "focus" ? "Solve for f₁" : "Solve lens positions";

        const seg = cur.segment,
            segIdx = tr.segments.indexOf(seg);
        const Rtxt = GB.formatCurvatureRadius(cur.invR, fmtLen);
        const theta = GB.divergence(seg.w0, st.lambda0, st.n, st.M2);
        setText("statZR", fmtLen(tr.segments[0].zR));
        setText("statW", fmtLen(cur.w));
        setText("statR", cur.invR === 0 ? "∞ (planar)" : fmtLen(1 / cur.invR));
        setText("statGouy", fmtRad(cur.gouy));
        const last = tr.segments[tr.segments.length - 1];
        setText("statOut", fmtLen(last.w0) + " @ " + (last.z0 / MM).toFixed(1) + " mm");
        setText("statTheta", (thetaMax * 1e3).toPrecision(3) + " mrad");

        setText("rZ", fmtMM(zc, 3) + (segIdx === 0 ? " (input)" : " (after L" + tr.lenses[segIdx - 1].idx + ")"));
        setText("rW", fmtLen(cur.w) + " = " + (cur.w / seg.w0).toFixed(4) + " w₀");
        setText("rR", Rtxt + (cur.invR === 0 ? "" : cur.invR > 0 ? " (diverging)" : " (converging)"));
        setText("rG", fmtRad(cur.gouy) + " / " + fmtRad(cur.gouyLocal));
        setText("rQ", (cur.q.re === 0 ? "0" : fmtLen(cur.q.re)) + " + i " + fmtLen(cur.q.im));
        setText("rW0", fmtLen(seg.w0) + " @ " + fmtMM(seg.z0, 1) + (seg.z0 < Math.max(seg.zStart, -1e9) || seg.z0 > seg.zEnd ? " (virtual)" : ""));
        setText("rZR", fmtLen(seg.zR) + ", " + (theta * 1e3).toPrecision(3) + " mrad");
        setText("rI0", fmtIntensity(GB.intensity(0, cur.w, st.P)));
        setText("rPow", (pNum / st.P).toFixed(8));
        const status = GB.paraxialStatus(thetaMax);
        setText("rParax", thetaMax.toFixed(4) + " rad: " + (status === "ok" ? "OK (< 0.1)" : status === "marginal" ? "marginal (0.1–0.3)" : "NOT paraxial (> 0.3)"));
        const warn = $("paraxWarn");
        if (status === "ok") warn.hidden = true;
        else {
            warn.hidden = false;
            const wSeg = tr.segments[model.thetaSeg];
            warn.textContent = status === "marginal" ?
                `Paraxial validity marginal: the waist ${fmtLen(wSeg.w0)} has divergence θ = ${thetaMax.toFixed(3)} rad (0.1–0.3). Expect errors of order θ² ≈ ${(thetaMax * thetaMax * 100).toFixed(0)} % in spot size and focus position.` :
                `Paraxial model NOT valid: the waist ${fmtLen(wSeg.w0)} (≈ ${(wSeg.w0 / st.lambda0).toFixed(2)} λ₀) has θ = ${thetaMax.toFixed(3)} rad > 0.3. Real focusing needs non-paraxial vector diffraction theory; the numbers shown are paraxial extrapolations only.`;
        }
        $("m2Warn").hidden = !(st.M2 > 1);
        $("m2Badge").hidden = !(st.M2 > 1);

        // lens table
        const body = $("lensBody");
        body.textContent = "";
        if (!rows.length) {
            const tr0 = document.createElement("tr");
            const td = document.createElement("td");
            td.colSpan = 9;
            td.textContent = "No lenses: free-space propagation of the input waist.";
            tr0.appendChild(td);
            body.appendChild(tr0);
        }
        for (const r of rows) {
            const trow = document.createElement("tr");
            const cells = ["L" + r.lens.idx, (r.lens.z / MM).toFixed(1), (r.lens.f / MM).toFixed(0), (r.s / MM).toFixed(2),
                fmtLen(r.w0out), (r.sOut / MM).toFixed(2) + (r.sOut < 0 ? " (virtual)" : r.lens.z + r.sOut > r.zEnd ? " (beyond next lens)" : ""), r.m.toFixed(4), fmtExp(r.dSelf), fmtExp(r.dAbcd)
            ];
            for (const c of cells) {
                const td = document.createElement("td");
                td.textContent = c;
                trow.appendChild(td);
            }
            body.appendChild(trow);
        }

        // text equivalents
        const wu = wUnit(model.wMax);
        const waistTxt = tr.segments.map((sg, k) => `${k === 0 ? "input" : "after L" + tr.lenses[k - 1].idx} waist ${fmtLen(sg.w0)} at ${(sg.z0 / MM).toFixed(1)} mm (zR ${fmtLen(sg.zR)})`).join("; ");
        descEnv.update(`Bench 0–${s.L} mm, ${st.nl} lens(es). ${waistTxt}. Largest radius on bench ${fmtLen(model.wMax)} (${wu.u} axis). Cursor at ${(zc / MM).toFixed(2)} mm: w = ${fmtLen(cur.w)}, R = ${Rtxt}.`);
        descCurv.update(`Curvature 1/R is ${cur.invR === 0 ? "exactly 0 (planar wavefront)" : cur.invR.toPrecision(3) + " per metre"} at the cursor and crosses zero at each waist. Accumulated Gouy phase ${fmtRad(model.gouys[0])} at z = 0 to ${fmtRad(model.gouys[model.gouys.length - 1])} at the bench end.`);
        descInt.update(`Gaussian spot, radius w = ${fmtLen(cur.w)}, peak ${fmtIntensity(GB.intensity(0, cur.w, st.P))}, window ±${fmtLen(transverseWindow())}; integrated power ${(pNum / MW).toPrecision(6)} mW of ${s.pow} mW.`);
        descPh.update(cur.invR === 0 ? `Uniform phase ${fmtRad(-cur.gouy)}: planar wavefront at a waist.` : `Concentric phase rings: curvature phase k r²/(2R) with R = ${Rtxt}; ${((2 * Math.PI * st.n / st.lambda0) * cur.w * cur.w * Math.abs(cur.invR) / 2).toFixed(2)} rad from axis to r = w.`);
        descCut.update(`I(x) peaks at ${fmtIntensity(GB.intensity(0, cur.w, st.P))} and falls to I₀/e² at x = ±${fmtLen(cur.w)}. Phase across ±w varies by ${((2 * Math.PI * st.n / st.lambda0) * cur.w * cur.w * Math.abs(cur.invR) / 2).toFixed(3)} rad.`);
    }

    function render() {
        renderPending = false;
        compute();
        envH.redraw();
        curvH.redraw();
        intH.redraw();
        phH.redraw();
        cutH.redraw();
        updateDOM();
    }

    function scheduleRender() {
        if (renderPending) return;
        renderPending = true;
        requestAnimationFrame(render);
    }

    // ------------------------------------------------------------------ envelope interaction
    function hitTest(px, py) {
        if (!envMap || !model) return null;
        for (const Ls of model.tr.lenses) {
            if (Ls.z < 0 || Ls.z > model.st.L) continue;
            if (Math.abs(envMap.xToPx(Ls.z / MM) - px) <= 10) return {
                kind: "lens",
                idx: Ls.idx
            };
        }
        const z0px = envMap.xToPx(model.st.z0 / MM),
            y0 = envMap.yToPx(0);
        if (model.st.z0 >= 0 && model.st.z0 <= model.st.L && Math.abs(z0px - px) <= 11 && Math.abs(py - y0) <= 16) return {
            kind: "waist"
        };
        return {
            kind: "cursor"
        };
    }

    function setFromPx(px) {
        const zmm = envMap.pxToX(px),
            Lmm = model.st.L / MM;
        if (drag.kind === "lens") ctl.set({
            ["x" + drag.idx]: Math.round(Math.min(Lmm, Math.max(0, zmm)) * 2) / 2
        });
        else if (drag.kind === "waist") ctl.set({
            z0: Math.round(Math.min(1000, Math.max(-1000, zmm)))
        });
        else {
            exactCursor = null;
            ctl.set({
                zc: Math.round(Math.min(Lmm, Math.max(0, zmm)) * 10) / 10
            });
        }
    }
    envCanvas.addEventListener("pointerdown", (e) => {
        const r = envCanvas.getBoundingClientRect(),
            px = e.clientX - r.left,
            py = e.clientY - r.top;
        if (!envMap || !envMap.contains(px, py)) return;
        drag = hitTest(px, py);
        envCanvas.setPointerCapture(e.pointerId);
        setFromPx(px);
        e.preventDefault();
    });
    envCanvas.addEventListener("pointermove", (e) => {
        const r = envCanvas.getBoundingClientRect(),
            px = e.clientX - r.left,
            py = e.clientY - r.top;
        if (drag) {
            setFromPx(px);
            return;
        }
        const h = envMap && envMap.contains(px, py) ? hitTest(px, py) : null;
        envCanvas.style.cursor = !h ? "default" : h.kind === "cursor" ? "crosshair" : "ew-resize";
    });
    const endDrag = () => {
        if (drag) {
            drag = null;
            scheduleRender();
        }
    };
    envCanvas.addEventListener("pointerup", endDrag);
    envCanvas.addEventListener("pointercancel", endDrag);
    envCanvas.addEventListener("keydown", (e) => {
        if (!model) return;
        const Lmm = model.st.L / MM,
            step = (e.shiftKey ? 0.05 : 0.005) * Lmm;
        let z = model.zc / MM;
        if (e.key === "ArrowRight" || e.key === "ArrowUp") z += step;
        else if (e.key === "ArrowLeft" || e.key === "ArrowDown") z -= step;
        else if (e.key === "Home") z = 0;
        else if (e.key === "End") z = Lmm;
        else return;
        e.preventDefault();
        exactCursor = null;
        ctl.set({
            zc: Math.round(Math.min(Lmm, Math.max(0, z)) * 10) / 10
        });
    });

    // ------------------------------------------------------------------ cursor helpers
    function setCursorExact(zMetres) {
        const st = readState();
        if (zMetres > st.L) ctl.set({
            L: Math.min(3000, Math.ceil(zMetres / MM * 1.2))
        });
        exactCursor = zMetres;
        exactCursorLocked = true;
        ctl.set({
            zc: Math.round(zMetres / MM * 10) / 10
        });
        exactCursorLocked = false;
        exactCursor = zMetres;
        scheduleRender();
    }
    $("waistBtn").addEventListener("click", () => {
        const m = compute();
        const cand = m.tr.segments.filter((sg) => sg.z0 >= Math.max(sg.zStart, 0) && sg.z0 <= Math.min(sg.zEnd, m.st.L));
        if (!cand.length) {
            $("presetNote").textContent = "No real waist lies on the bench.";
            return;
        }
        cand.sort((a, b) => Math.abs(a.z0 - m.zc) - Math.abs(b.z0 - m.zc));
        setCursorExact(cand[0].z0);
    });
    $("zrBtn").addEventListener("click", () => {
        const m = compute(),
            sg = m.cur.segment;
        const z = sg.z0 + sg.zR;
        if (z < 0 || z > 3) {
            $("presetNote").textContent = "z₀ + z_R of this segment is outside the 0–3000 mm bench range.";
            return;
        }
        setCursorExact(z);
    });

    // ------------------------------------------------------------------ solvers
    const solveOut = $("solveOut");

    function showSolutions(msg, sols) {
        solveOut.textContent = "";
        const p = document.createElement("p");
        p.textContent = msg;
        solveOut.appendChild(p);
        sols.forEach((sol, i) => {
            const b = document.createElement("button");
            b.type = "button";
            b.className = "preset-option gb-apply";
            b.textContent = "Apply " + (i + 1) + ": " + sol.text;
            b.addEventListener("click", () => sol.apply());
            solveOut.appendChild(b);
        });
    }

    function solve() {
        const st = readState(),
            s = st.s;
        const wt = s.wt * UM;
        if (s.mm === "single") {
            const f = clampF(s.f1) * MM;
            const sols = GB.modeMatchSingle(st.w0, wt, f, st.lambda0, st.n, st.M2);
            const f0 = GB.minFocalForMatch(st.w0, wt, st.lambda0, st.n, st.M2);
            if (!sols.length) {
                showSolutions(`Impossible with f₁ = ${(f / MM).toFixed(0)} mm: single-lens matching needs f ≥ f₀ = π n w₀ w_T/(M²λ₀) = ${(f0 / MM).toFixed(2)} mm.`, []);
                return;
            }
            const ok = sols.map((so) => ({
                x1: st.z0 + so.d1,
                zw: st.z0 + so.d1 + so.d2,
                so
            })).filter((o) => o.x1 >= 0 && o.x1 <= 3);
            showSolutions(`f₀ = ${(f0 / MM).toFixed(2)} mm ≤ f₁. ${sols.length} solution(s) (Kogelnik): d₁ = f ± (w₀/w_T)√(f² − f₀²), d₂ = f ± (w_T/w₀)√(f² − f₀²).` + (ok.length < sols.length ? " Solutions with the lens outside 0–3000 mm are omitted." : ""),
                ok.map((o) => ({
                    text: `lens at ${(o.x1 / MM).toFixed(1)} mm, waist at ${(o.zw / MM).toFixed(1)} mm`,
                    apply() {
                        ctl.set({
                            nl: "1",
                            x1: Math.round(o.x1 / MM * 2) / 2
                        });
                        setCursorExact(o.zw < 0 ? 0 : o.zw);
                        if (o.zw > readState().L) ctl.set({
                            L: Math.min(3000, Math.ceil(o.zw / MM * 1.2))
                        });
                        $("presetNote").textContent = "Lens position is rounded to the 0.5 mm slider step; the table shows the waist actually reached.";
                    }
                })));
        } else if (s.mm === "two") {
            const f1 = clampF(s.f1) * MM,
                f2 = clampF(s.f2) * MM,
                zT = s.zt * MM;
            if (zT <= Math.max(0, st.z0)) {
                showSolutions("The target position must lie after the input waist and after z = 0.", []);
                return;
            }
            const sols = GB.modeMatchTwo({
                w1: st.w0,
                z1: st.z0,
                w2: wt,
                zT,
                f1,
                f2,
                lambda0: st.lambda0,
                n: st.n,
                M2: st.M2,
                zMin: Math.max(0, st.z0) + 1e-4,
                zMax: zT
            });
            if (!sols.length) {
                showSolutions(`No placement of f₁ = ${(f1 / MM).toFixed(0)} mm and f₂ = ${(f2 / MM).toFixed(0)} mm between ${Math.max(0, s.z0)} mm and ${s.zt} mm gives ${s.wt} µm at z_T. Try a different f₂ (f₂ must exceed π n w′ w_T/λ₀ for the intermediate waist w′) or move z_T.`, []);
                return;
            }
            showSolutions(`${sols.length} solution(s): lens 1 is scanned and lens 2 is placed by single-lens matching of the intermediate waist; the waist-position residual is solved by Brent's method.`,
                sols.slice(0, 4).map((so) => ({
                    text: `L1 ${(so.x1 / MM).toFixed(1)} mm, L2 ${(so.x2 / MM).toFixed(1)} mm`,
                    apply() {
                        const Lneed = Math.max(readState().s.L, Math.min(3000, Math.ceil(s.zt * 1.15)));
                        ctl.set({
                            nl: "2",
                            x1: Math.round(so.x1 / MM * 2) / 2,
                            x2: Math.round(so.x2 / MM * 2) / 2,
                            L: Lneed
                        });
                        setCursorExact(zT);
                        $("presetNote").textContent = "Positions are rounded to 0.5 mm; compare w₀′ in the table with the target.";
                    }
                })));
        } else {
            // focus to spot: beam arriving at lens 1 (earlier lenses included, lens 1 excluded)
            const x1 = s.x1 * MM;
            const others = st.lenses.filter((Ls) => Ls.idx !== 1);
            const trNo = GB.traceLenses({
                w0: st.w0,
                z0: st.z0,
                lambda0: st.lambda0,
                n: st.n,
                M2: st.M2
            }, others);
            const a = GB.stateAt(trNo, x1);
            const spot = (f) => GB.focusSpot(a.w, a.invR, f, st.lambda0, st.n, st.M2).exact.w0;
            const fApprox = Math.PI * st.n * a.w * wt / (st.M2 * st.lambda0);
            let fSol = null;
            const fs = [];
            for (let i = 0; i <= 400; i++) fs.push(F_MIN_MM * MM * Math.pow(1000 / F_MIN_MM, i / 400));
            for (let i = 1; i < fs.length && fSol == null; i++) {
                const g0 = spot(fs[i - 1]) - wt,
                    g1 = spot(fs[i]) - wt;
                if (g0 === 0) fSol = fs[i - 1];
                else if (g0 * g1 < 0) fSol = core.brent((f) => spot(f) - wt, fs[i - 1], fs[i], {
                    tol: 1e-12
                });
            }
            const head = `Beam at lens 1: w = ${fmtLen(a.w)}, R = ${GB.formatCurvatureRadius(a.invR, fmtLen)}. Estimate f ≈ π n w w_T/(M²λ₀) = ${(fApprox / MM).toFixed(1)} mm.`;
            if (fSol == null) {
                showSolutions(head + ` No f between 5 and 1000 mm gives an exact spot of ${s.wt} µm (smallest reachable ≈ ${fmtLen(spot(F_MIN_MM * MM))}; largest ${fmtLen(spot(1))}).`, []);
                return;
            }
            const fr = Math.round(fSol / MM);
            showSolutions(head + ` Exact q-law solution f = ${(fSol / MM).toFixed(2)} mm; rounded to ${fr} mm this gives ${fmtLen(spot(fr * MM))}.`, [{
                text: `f₁ = ${fr} mm`,
                apply() {
                    ctl.set({
                        nl: String(Math.max(1, st.nl)),
                        f1: fr
                    });
                    const m = compute();
                    const k = m.tr.lenses.findIndex((Ls) => Ls.idx === 1);
                    setCursorExact(Math.max(0, m.tr.segments[k + 1].z0));
                }
            }]);
        }
    }
    $("solveBtn").addEventListener("click", solve);
    $("mmMode").addEventListener("change", () => {
        solveOut.textContent = "";
    });

    // ------------------------------------------------------------------ presets
    const PRESETS = {
        hene: {
            v: {
                lam: 633,
                n: 1,
                w0: 500,
                z0: 0,
                pow: 1,
                m2: 1,
                nl: "0",
                L: 3000
            },
            cursor: (m) => m.tr.segments[0].z0 + m.tr.segments[0].zR,
            note: "Expected: at the cursor (z = zR = 1.241 m) w = √2 w₀ = 707 µm and R = 2zR = 2.48 m, the most curved wavefront anywhere; Gouy phase π/4."
        },
        focus: {
            v: {
                lam: 1064,
                n: 1,
                w0: 1000,
                z0: 100,
                pow: 1000,
                m2: 1,
                nl: "1",
                x1: 100,
                f1: 100,
                L: 300
            },
            cursor: (m) => m.tr.segments[1].z0,
            note: "Expected: waist w₀′ = 33.85 µm at 99.885 mm after the lens (0.115 mm before the focal plane), zR′ = 3.38 mm, I₀ = 5.56 × 10⁴ W/cm² at 1 W, planar wavefront at the cursor."
        },
        self: {
            v: {
                lam: 1064,
                n: 1,
                w0: 100,
                z0: 0,
                pow: 1,
                m2: 1,
                nl: "1",
                x1: 150,
                f1: 100,
                L: 450
            },
            cursor: (m) => m.tr.segments[1].z0,
            note: "Expected: Self's formula puts the output waist 248.3 mm after the lens with m = 1.72 (172 µm). Geometric imaging would predict 300 mm and m = 2."
        },
        kepler: {
            v: {
                lam: 633,
                n: 1,
                w0: 500,
                z0: 0,
                pow: 1,
                m2: 1,
                nl: "2",
                x1: 100,
                f1: 50,
                x2: 300,
                f2: 150,
                L: 1500
            },
            cursor: () => 1.2,
            note: "Expected: lenses separated by f₁ + f₂ = 200 mm (afocal). The output w ≈ 3 × input (≈ 1.5 mm) and the divergence ÷ 3, with a real internal focus of about 20 µm between the lenses."
        },
        galileo: {
            v: {
                lam: 633,
                n: 1,
                w0: 500,
                z0: 0,
                pow: 1,
                m2: 1,
                nl: "2",
                x1: 100,
                f1: -50,
                x2: 200,
                f2: 150,
                L: 1500
            },
            cursor: () => 1.2,
            note: "Expected: the same 3× expansion in a 100 mm package (f₁ + f₂ with f₁ < 0), with no real internal focus. The intermediate waist is virtual."
        },
        match: {
            v: {
                lam: 1064,
                n: 1,
                w0: 400,
                z0: 0,
                pow: 1,
                m2: 1,
                nl: "1",
                x1: 200,
                f1: 150,
                L: 700,
                mm: "single",
                wt: 50
            },
            solve: true,
            note: "Expected: f₀ = π w₀ w_T/λ₀ = 59.0 mm < 150 mm, so Kogelnik's formula has two solutions. One needs the lens before the source waist (d₁ < 0) and is rejected; the applied one gives w₀′ = 50 µm (see the table)."
        },
        tight: {
            v: {
                lam: 532,
                n: 1,
                w0: 3000,
                z0: 0,
                pow: 1,
                m2: 1,
                nl: "1",
                x1: 20,
                f1: 8,
                L: 40
            },
            cursor: (m) => m.tr.segments[1].z0,
            note: "Expected: paraxial spot ≈ λf/(πw) ≈ 0.45 µm (below λ). θ ≈ 0.38 rad > 0.3, so the warning is shown: the paraxial Gaussian result is not trustworthy here."
        },
        multimode: {
            v: {
                lam: 1064,
                n: 1,
                w0: 1000,
                z0: 100,
                pow: 1,
                m2: 1.8,
                nl: "1",
                x1: 100,
                f1: 100,
                L: 300
            },
            cursor: (m) => m.tr.segments[1].z0,
            note: "Expected (embedded Gaussian): focused width 1.8 × 33.9 = 61 µm and zR′ 1.8× the TEM₀₀ value. The profile shown is Gaussian by assumption, not measured."
        }
    };

    function applyPreset(name) {
        const p = PRESETS[name];
        if (!p) return;
        exactCursor = null;
        ctl.set(Object.assign({}, DEFAULTS, p.v));
        document.querySelectorAll("[data-preset]").forEach((b) => b.classList.toggle("active", b.dataset.preset === name));
        const m = compute();
        if (p.cursor) setCursorExact(p.cursor(m));
        solveOut.textContent = "";
        if (p.solve) {
            solve();
            const first = solveOut.querySelector(".gb-apply");
            if (first) first.click();
        }
        $("presetNote").textContent = p.note;
        url.update();
    }
    document.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => applyPreset(b.dataset.preset)));

    $("resetBtn").addEventListener("click", () => {
        exactCursor = null;
        ctl.set(Object.assign({}, DEFAULTS));
        document.querySelectorAll("[data-preset]").forEach((b) => b.classList.remove("active"));
        solveOut.textContent = "";
        $("presetNote").textContent = "Reset to a 1 mm waist at z = 0 and one f = 100 mm lens.";
        url.update();
    });

    // ------------------------------------------------------------------ export
    UI.addExportBar($("exportHost"), {
        name: "gaussian-beams",
        url,
        getState: () => {
            const m = model || compute();
            return {
                controls: ctl.get(),
                conventions: "SI; w = 1/e² intensity radius; q = z + i zR, 1/q = 1/R − i M²λ0/(π n w²); ABCD on [y, θ]",
                segments: m.tr.segments.map((sg) => ({
                    zStart_m: Number.isFinite(sg.zStart) ? sg.zStart : null,
                    zEnd_m: Number.isFinite(sg.zEnd) ? sg.zEnd : null,
                    z0_m: sg.z0,
                    w0_m: sg.w0,
                    zR_m: sg.zR
                })),
                cursor: {
                    z_m: m.zc,
                    w_m: m.cur.w,
                    invR_per_m: m.cur.invR,
                    R_m: m.cur.invR === 0 ? "infinite (planar)" : 1 / m.cur.invR,
                    gouy_rad: m.cur.gouy
                },
                maxDivergence_rad: m.thetaMax
            };
        },
        getCSV: () => {
            const m = model || compute(),
                wu = wUnit(m.wMax);
            return {
                headers: ["z (mm)", "w (um)", "1/R (1/m)", "Gouy psi (rad)", "segment"],
                rows: m.zs.map((z, i) => [z / MM, m.ws[i] / UM, m.invRs[i], m.gouys[i], m.tr.segments.indexOf(GB.stateAt(m.tr, z).segment)]),
                unit: wu.u
            };
        },
        canvases: [envCanvas, curvCanvas, intCanvas, phCanvas, cutCanvas],
        caption: () => {
            const s = ctl.get();
            return `Gaussian beam λ0 = ${s.lam} nm, n = ${s.n}, w0 = ${s.w0} µm at z0 = ${s.z0} mm, M² = ${s.m2}, ${s.nl} lens(es); cursor z = ${(model ? model.zc / MM : s.zc).toFixed(2)} mm`;
        }
    });

    UI.onThemeChange(() => scheduleRender());
    url.ready.then(() => scheduleRender());
    render();
})();