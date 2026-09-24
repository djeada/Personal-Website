(function() {
    "use strict";
    const UI = window.OpticsUI,
        core = window.OpticsModels.core,
        P = window.OpticsModels.propagation;
    const $ = (id) => document.getElementById(id);
    const UM = 1e-6,
        MM = 1e-3,
        NP_MAX = 2048;
    const pal = UI.palette().canvas;
    const fmt = (v, u, d) => core.formatSI(v, u, d);

    const fmtArea = (v) => {
        if (!Number.isFinite(v)) return "—";
        if (v === 0) return "0 m²";
        const u = [
            [1, "m²"],
            [1e-6, "mm²"],
            [1e-12, "µm²"],
            [1e-18, "nm²"]
        ].find(([f]) => Math.abs(v) >= f * 0.01) || [1e-18, "nm²"];
        return Number((v / u[0]).toPrecision(3)) + " " + u[1];
    };
    const pct = (x) => (!Number.isFinite(x) ? "—" : x === 0 ? "0 %" : Math.abs(x) < 1e-4 ? (x * 100).toExponential(1) + " %" : (x * 100).toFixed(x < 0.01 ? 3 : 2) + " %");
    const lg = Math.log10;



    const BASE = {
        sh: "circle",
        a: 1000,
        b: 3000,
        d: 250,
        eps: 0.5,
        fzp: 200,
        zn: 8,
        zpp: false,
        il: "plane",
        w: 2500,
        lam: 633,
        z: 0.1,
        m: "asm",
        ev: "drop",
        bl: true,
        n: "256",
        L: 4,
        pad: "2",
        sc: "lin",
        fl: 4,
        apv: "amp",
        view: "det",
        zm: "1",
        ref: true
    };
    const PRESETS = [{
            id: "circFresnel",
            label: "Circle: Fresnel",
            set: {},
            note: "N_F ≈ 3.95 (almost 4 Fresnel zones): the centre is nearly dark. Compare “On-axis |U|²” with the exact Rayleigh–Sommerfeld value. The rings are Fresnel fringes, not the Airy pattern."
        },
        {
            id: "airy",
            label: "Airy far field",
            set: {
                a: 200,
                z: 2,
                m: "fraunhofer",
                L: 1,
                pad: "4",
                zm: "8"
            },
            note: "N_F ≈ 0.008 ≪ 1. Expect the first dark ring at 1.22λz/D ≈ 7.7 mm, with the dashed analytic Airy cut on top of the numerical one."
        },
        {
            id: "slit",
            label: "Slit far field",
            set: {
                sh: "slit",
                a: 50,
                b: 500,
                z: 2,
                m: "fraunhofer",
                L: 1,
                pad: "4",
                zm: "2"
            },
            note: "Expect zeros along x at multiples of λz/a ≈ 25.3 mm; along y the pattern is 10× narrower because b = 10a."
        },
        {
            id: "rect",
            label: "Rectangle: near field",
            set: {
                sh: "rect",
                a: 1000,
                b: 500,
                z: 0.05,
                m: "asm"
            },
            note: "N_F ≈ 7.9 along x: the light still has the rectangle’s shape, with Fresnel fringes inside the edges. Increase z towards a²/λ to watch it become a sinc² far field."
        },
        {
            id: "annulus",
            label: "Annulus",
            set: {
                sh: "annulus",
                a: 400,
                eps: 0.5,
                z: 3,
                m: "fraunhofer",
                L: 1.2,
                pad: "4",
                zm: "8"
            },
            note: "Compared with a full disk of the same outer diameter, the central lobe is narrower and the first ring is brighter (a thin ring tends to J₀²)."
        },
        {
            id: "double",
            label: "Double slit",
            set: {
                sh: "doubleSlit",
                a: 50,
                b: 500,
                d: 250,
                z: 2,
                m: "fraunhofer",
                L: 1,
                pad: "4",
                zm: "4"
            },
            note: "Expect fringes spaced λz/d ≈ 5.06 mm under a single-slit envelope whose first zero is λz/a ≈ 25.3 mm: the 5th order is missing."
        },
        {
            id: "edge",
            label: "Straight edge",
            set: {
                sh: "edge",
                il: "gauss",
                w: 2500,
                z: 0.5,
                n: "512",
                L: 12
            },
            note: "At the geometric shadow (x = 0) the intensity is ≈ ¼ of the local incident value. The first bright fringe (≈ 1.37×) is near x = 1.22·√(λz/2) ≈ 0.49 mm."
        },
        {
            id: "zp",
            label: "Zone plate",
            set: {
                sh: "zonePlate",
                fzp: 200,
                zn: 8,
                z: 0.2
            },
            note: "At z = f = 200 mm the 8-zone amplitude plate focuses to ≈ N² = 64 I₀ on axis. Try z = f/3 ≈ 66.7 mm for the third-order focus, or tick the π-phase option."
        },
        {
            id: "poisson",
            label: "Poisson spot",
            set: {
                sh: "disk",
                a: 1000,
                il: "gauss",
                w: 2500,
                z: 0.3,
                n: "512",
                L: 12
            },
            note: "A bright spot of ≈ 0.92 I₀ appears on axis in the middle of the geometric shadow. Plane-wave theory gives z²/(z² + R²) ≈ 1 (R = 0.5 mm disk radius); the Gaussian beam lowers the rim intensity by e^(−2R²/w²) ≈ 0.92."
        },
        {
            id: "evan",
            label: "Sub-λ slit",
            set: {
                sh: "slit",
                a: 0.4,
                b: 4,
                z: 5e-7,
                ev: "decay",
                n: "128",
                L: 0.0128,
                sc: "log"
            },
            note: "Δx = 0.1 µm < λ/2, so the grid holds evanescent frequencies. Much of a 0.4 µm slit’s spectrum lies beyond 1/λ. Switch Decay ↔ Drop and read “Removed”. This is a scalar model; real sub-λ slits need vector theory."
        }
    ];


    function toControls(nat) {
        const o = {
            sh: nat.sh,
            a: lg(nat.a),
            b: lg(nat.b),
            d: lg(nat.d),
            eps: nat.eps,
            fzp: nat.fzp,
            zn: nat.zn,
            zpp: nat.zpp,
            il: nat.il,
            w: lg(nat.w),
            lam: nat.lam,
            z: lg(nat.z),
            m: nat.m,
            ev: nat.ev,
            bl: nat.bl,
            n: nat.n,
            L: lg(nat.L * 1000),
            pad: nat.pad,
            sc: nat.sc,
            fl: nat.fl,
            apv: nat.apv,
            view: nat.view,
            zm: nat.zm,
            ref: nat.ref
        };
        return o;
    }


    const logFmt = (scale) => ({
        format: (v) => Number((Math.pow(10, v) * scale).toPrecision(4)),
        parse: (d) => lg(Number(d) / scale)
    });
    UI.enhanceAllSliders(document.querySelector(".options-sidebar"), {
        aSlider: Object.assign({
            unit: "µm"
        }, logFmt(1)),
        bSlider: Object.assign({
            unit: "µm"
        }, logFmt(1)),
        dSlider: Object.assign({
            unit: "µm"
        }, logFmt(1)),
        wSlider: Object.assign({
            unit: "µm"
        }, logFmt(1)),
        brushSlider: Object.assign({
            unit: "µm"
        }, logFmt(1)),
        zSlider: Object.assign({
            unit: "mm"
        }, logFmt(1000)),
        extentSlider: Object.assign({
            unit: "mm"
        }, logFmt(1e-3)),
        lambdaSlider: {
            unit: "nm"
        },
        fzpSlider: {
            unit: "mm"
        },
        brushPSlider: {
            unit: "°"
        }
    });

    const ctl = UI.bindControls({
        sh: "#shapeSel",
        a: "#aSlider",
        b: "#bSlider",
        d: "#dSlider",
        eps: "#epsSlider",
        fzp: "#fzpSlider",
        zn: "#zonesSlider",
        zpp: "#zpPhaseBox",
        il: "#illumSel",
        w: "#wSlider",
        lam: "#lambdaSlider",
        z: "#zSlider",
        m: "#methodSel",
        ev: "#evanSel",
        bl: "#blBox",
        n: "#nSel",
        L: "#extentSlider",
        pad: "#padSel",
        sc: "#scaleSel",
        fl: "#floorSlider",
        apv: "#apViewSel",
        view: "#viewSel",
        zm: "#zoomSel",
        ref: "#refBox"
    }, onControlChange);
    const toolCtl = UI.bindControls({
        tool: "radio:tool",
        br: "#brushSlider",
        bt: "#brushTSlider",
        bp: "#brushPSlider"
    }, () => {
        updateLabels();
        setCanvasMode();
    });


    let strokes = [];
    const flatStrokes = () => strokes.flat();

    function encodeStrokes() {
        const pts = flatStrokes().length;
        if (!pts || pts > 400) return "";
        return strokes.map((g) => g.map((s) => [s.x / UM, s.y / UM, s.r / UM].map((v) => +v.toFixed(1)).join(",") + "," + (s.mode === "erase" ? "e" : "p") + "," + (+s.t.toFixed(2)) + "," + Math.round(s.p * 180 / Math.PI)).join(";")).join("|");
    }

    function decodeStrokes(str) {
        if (!str) return [];
        try {
            return String(str).split("|").map((g) => g.split(";").map((t) => {
                const q = t.split(",");
                return {
                    x: +q[0] * UM,
                    y: +q[1] * UM,
                    r: +q[2] * UM,
                    mode: q[3] === "e" ? "erase" : "paint",
                    t: +q[4],
                    p: +q[5] * Math.PI / 180
                };
            }).filter((s) => [s.x, s.y, s.r, s.t, s.p].every(Number.isFinite))).filter((g) => g.length);
        } catch (e) {
            return [];
        }
    }

    const url = UI.urlState({
        get: () => Object.assign(ctl.get(), {
            st: encodeStrokes()
        }),
        set: (o) => {
            if ("st" in o) strokes = decodeStrokes(o.st);
            ctl.set(o);
            updateStrokeInfo();
            scheduleCompute();
        }
    });

    function readState() {
        const s = ctl.get();
        return {
            shape: s.sh,
            a: Math.pow(10, s.a) * UM,
            b: Math.pow(10, s.b) * UM,
            d: Math.pow(10, s.d) * UM,
            eps: s.eps,
            f: s.fzp * MM,
            zones: Math.round(s.zn),
            zpPhase: s.zpp,
            illum: s.il,
            w: Math.pow(10, s.w) * UM,
            lambda: s.lam * 1e-9,
            z: Math.pow(10, s.z),
            method: s.m,
            evanescent: s.ev,
            bandLimit: s.bl,
            N: Number(s.n),
            L: Math.pow(10, s.L) * UM,
            pad: Number(s.pad),
            scale: s.sc,
            floor: s.fl,
            apView: s.apv,
            view: s.view,
            zoom: Number(s.zm) || 1,
            ref: s.ref
        };
    }

    function updateLabels() {
        const st = readState(),
            t = toolCtl.get();
        $("aLabel").textContent = {
            circle: "Diameter D",
            annulus: "Outer diameter D",
            disk: "Disk diameter D",
            slit: "Slit width a",
            rect: "Width a",
            doubleSlit: "Slit width a"
        } [st.shape] || "Width / diameter";
        $("aValue").textContent = fmt(st.a, "m");
        $("bValue").textContent = fmt(st.b, "m");
        $("dValue").textContent = fmt(st.d, "m");
        $("epsValue").textContent = st.eps.toFixed(2);
        $("fzpValue").textContent = fmt(st.f, "m");
        $("zonesValue").textContent = String(st.zones);
        $("wValue").textContent = fmt(st.w, "m");
        $("lambdaValue").textContent = fmt(st.lambda, "m");
        $("zValue").textContent = fmt(st.z, "m");
        $("extentValue").textContent = fmt(st.L, "m") + " (Δx = " + fmt(st.L / st.N, "m") + ")";
        $("floorValue").textContent = "10^−" + st.floor;
        $("brushValue").textContent = fmt(Math.pow(10, t.br) * UM, "m");
        $("brushTValue").textContent = Number(t.bt).toFixed(2);
        $("brushPValue").textContent = t.bp + "°";
        document.querySelectorAll("[data-for]").forEach((el) => {
            el.hidden = !el.dataset.for.split(" ").includes(st.shape);
        });
        document.querySelectorAll("[data-illum]").forEach((el) => {
            el.hidden = el.dataset.illum !== st.illum;
        });
        $("evanSel").disabled = st.method !== "asm";
        $("blBox").disabled = !(st.method === "asm" || st.method === "tf");
        $("statLambda").textContent = fmt(st.lambda, "m");
        $("statZ").textContent = fmt(st.z, "m");
        $("statMethod").textContent = {
            asm: "ASM",
            tf: "Fresnel TF",
            ir: "Fresnel IR",
            fresnel: "1-FFT Fresnel",
            fraunhofer: "Fraunhofer"
        } [st.method];
    }

    function onControlChange() {
        updateLabels();
        url.update();
        scheduleCompute();
    }


    let seq = 0,
        worker = null,
        workerOK = typeof Worker === "function",
        running = null,
        pending = null;

    function spawnWorker() {
        if (!workerOK) return null;
        try {
            const w = new Worker("worker.js");
            w.onmessage = (e) => onWorkerMessage(e.data);
            w.onerror = (e) => {
                e.preventDefault && e.preventDefault();

                workerOK = false;
                worker = null;
                const job = running || pending;
                running = null;
                pending = null;
                if (job) runOnMain(job);
            };
            return w;
        } catch (err) {
            workerOK = false;
            return null;
        }
    }

    function submit(job) {
        job.id = ++seq;
        if (!workerOK) {
            pending = job;
            clearTimeout(submit.t);
            submit.t = setTimeout(() => {
                const j = pending;
                pending = null;
                if (j) runOnMain(j);
            }, 0);
            return;
        }
        if (!worker) worker = spawnWorker();
        if (!worker) {
            submit(job);
            return;
        }
        if (running) {
            pending = job;
            if (performance.now() - running.t0 > 250) {

                worker.terminate();
                worker = spawnWorker();
                running = null;
                startJob(pending);
                pending = null;
            }
            setStatus("busy");
            return;
        }
        startJob(job);
    }

    function startJob(job) {
        running = job;
        job.t0 = performance.now();
        setStatus("busy");
        worker.postMessage({
            id: job.id,
            spec: job.spec,
            N: job.N,
            L: job.L,
            params: job.params
        });
    }

    function onWorkerMessage(msg) {
        if (!running || msg.id !== running.id) return;
        const job = running;
        running = null;
        if (msg.ok) accept(job, msg.field, msg.res, msg.ms, "worker");
        else showError(msg.error);
        if (pending) {
            const j = pending;
            pending = null;
            startJob(j);
        } else setStatus("idle");
    }

    function runOnMain(job) {
        setStatus("busy");
        setTimeout(() => {
            if (job.id !== seq) return;
            try {
                const t0 = performance.now();
                const grid = P.createGrid(job.N, job.L);
                const field = P.buildAperture(job.spec, grid);
                const res = P.propagate(field, grid, job.params);
                accept(job, field, res, performance.now() - t0, "main thread");
            } catch (err) {
                showError(String(err.message || err));
            }
            setStatus("idle");
        }, 20);
    }


    const DISPLAY_KEYS = ["sc", "fl", "apv", "view", "zm", "ref"];
    let computeTimer = 0,
        analyseTimer = 0,
        submitPending = false,
        lastPhysKey = "";

    function physKey() {
        const s = ctl.get();
        return JSON.stringify(Object.keys(s).filter((k) => !DISPLAY_KEYS.includes(k)).map((k) => s[k])) + "|" + JSON.stringify(flatStrokes());
    }

    function scheduleCompute() {
        const k = physKey();
        if (cur && k === lastPhysKey) {

            if (!submitPending) {
                clearTimeout(analyseTimer);
                analyseTimer = setTimeout(analyse, 0);
            }
            return;
        }
        lastPhysKey = k;
        clearTimeout(computeTimer);
        submitPending = true;
        computeTimer = setTimeout(() => {
            submitPending = false;
            submit(makeJob());
        }, 40);
    }

    function makeJob() {
        const st = readState();
        let pad = st.pad;
        while (st.N * pad > NP_MAX && pad > 1) pad /= 2;
        const spec = {
            shape: st.shape,
            a: st.a,
            b: st.b,
            d: st.d,
            eps: st.eps,
            f: st.f,
            zones: st.zones,
            zpPhase: st.zpPhase,
            illum: st.illum,
            w: st.w,
            lambda: st.lambda,
            strokes: flatStrokes()
        };
        return {
            spec,
            N: st.N,
            L: st.L,
            padReduced: pad !== st.pad,
            st,
            params: {
                lambda: st.lambda,
                z: st.z,
                method: st.method,
                pad,
                evanescent: st.evanescent,
                bandLimit: st.bandLimit
            }
        };
    }

    let statusText = "Preparing…";

    function setStatus(mode) {
        const el = $("computeStatus");
        el.classList.toggle("busy", mode === "busy");
        const job = running || pending;
        el.textContent = mode === "busy" && job ? "Computing " + job.N * job.params.pad + "² grid…" : statusText;
    }

    function showError(text) {
        statusText = "Computation failed: " + text;
        setStatus("idle");
    }


    let cur = null;
    let cursor = {
        x: 0,
        y: 0
    };

    function accept(job, field, res, ms, where) {
        const grid = P.createGrid(job.N, job.L);
        cur = {
            job,
            grid,
            field,
            res,
            ms,
            where
        };
        analyse();
        statusText = "Computed " + res.n + "² in " + Math.round(ms) + " ms (" + where + ")" + (job.padReduced ? " · padding reduced to " + res.pad + "× (grid limit " + NP_MAX + ")" : "");
    }

    function blockDownsample(arr, n, f, mode) {
        if (f === 1) return {
            data: arr,
            n
        };
        const m = n / f,
            out = new Float64Array(m * m);
        for (let j = 0; j < m; j++)
            for (let i = 0; i < m; i++) {
                if (mode === "pick") {
                    out[j * m + i] = arr[(j * f + (f >> 1)) * n + i * f + (f >> 1)];
                    continue;
                }
                let s = 0;
                for (let b = 0; b < f; b++)
                    for (let a = 0; a < f; a++) s += arr[(j * f + b) * n + i * f + a];
                out[j * m + i] = s / (f * f);
            }
        return {
            data: out,
            n: m
        };
    }

    function analyse() {
        if (!cur) return;
        const {
            job,
            grid,
            field,
            res
        } = cur;
        const st = readState();
        cur.info = P.samplingInfo(job.spec, grid, job.params);
        cur.viewFull = P.extractView(res, {
            full: st.view === "full"
        });
        cur.view = cropView(cur.viewFull, st.zoom);
        const N = job.N,
            amp = new Float64Array(N * N),
            ph = new Float64Array(N * N);
        for (let i = 0; i < N * N; i++) {
            const a = Math.hypot(field.re[i], field.im[i]);
            amp[i] = a;
            ph[i] = a > 1e-3 ? Math.atan2(field.im[i], field.re[i]) : NaN;
        }
        cur.apAmp = amp;
        cur.apPhase = ph;

        const nf = cur.info.NF;
        cur.refNote = "";
        cur.ref = st.ref ? P.fraunhoferAnalytic(job.spec, job.params.lambda, job.params.z) : null;
        if (cur.ref && Number.isFinite(nf) && nf > 1 && job.params.method !== "fraunhofer") {
            cur.ref = null;
            cur.refNote = "hidden: N_F = " + nf.toPrecision(3) + " > 1 (Fresnel regime)";
        }
        clampCursor();
        redrawAll();
        updateReadouts();
    }

    function cropView(v, zoom) {
        const z = Math.max(1, Math.min(zoom, v.size / 16));
        if (z === 1) return v;
        const m = Math.round(v.size / z),
            off = Math.round((v.size - m) / 2);
        const I = new Float64Array(m * m),
            Ph = new Float64Array(m * m);
        let max = 0;
        for (let j = 0; j < m; j++)
            for (let i = 0; i < m; i++) {
                const k = (j + off) * v.size + i + off;
                I[j * m + i] = v.I[k];
                Ph[j * m + i] = v.P[k];
                if (v.I[k] > max) max = v.I[k];
            }
        return {
            I,
            P: Ph,
            size: m,
            dx: v.dx,
            max
        };
    }

    function viewHalf() {
        return cur ? cur.view.size * cur.view.dx / 2 : 1;
    }

    function clampCursor() {
        const h = viewHalf();
        cursor.x = Math.max(-h, Math.min(h - cur.view.dx, cursor.x));
        cursor.y = Math.max(-h, Math.min(h - cur.view.dx, cursor.y));
    }

    function cursorIndex() {
        const v = cur.view;
        const ix = Math.max(0, Math.min(v.size - 1, Math.round(cursor.x / v.dx + v.size / 2)));
        const iy = Math.max(0, Math.min(v.size - 1, Math.round(cursor.y / v.dx + v.size / 2)));
        return {
            ix,
            iy
        };
    }

    function lengthUnit(extent) {
        if (extent >= 2) return {
            unit: "m",
            s: 1
        };
        if (extent >= 2e-3) return {
            unit: "mm",
            s: 1e3
        };
        if (extent >= 2e-6) return {
            unit: "µm",
            s: 1e6
        };
        return {
            unit: "nm",
            s: 1e9
        };
    }

    function cuts() {
        const v = cur.view,
            n = v.size,
            {
                ix,
                iy
            } = cursorIndex();
        const xs = new Float64Array(n),
            Ix = new Float64Array(n),
            Iy = new Float64Array(n);
        for (let i = 0; i < n; i++) {
            xs[i] = (i - n / 2) * v.dx;
            Ix[i] = v.I[iy * n + i];
            Iy[i] = v.I[i * n + ix];
        }
        const yc = (iy - n / 2) * v.dx,
            xc = (ix - n / 2) * v.dx;
        let Rx = null,
            Ry = null;
        if (cur.ref) {
            Rx = xs.map((x) => cur.ref(x, yc));
            Ry = xs.map((y) => cur.ref(xc, y));
        }
        return {
            xs,
            Ix,
            Iy,
            Rx,
            Ry,
            xc,
            yc
        };
    }


    const MARGIN_WIDE = {
        l: 56,
        r: 66,
        t: 12,
        b: 42
    };

    function imagePanel(ctx, w, h, o) {
        ctx.fillStyle = pal.background;
        ctx.fillRect(0, 0, w, h);
        const MARGIN = w < 420 ? {
            l: 46,
            r: 54,
            t: 10,
            b: 40
        } : MARGIN_WIDE;
        const side = Math.max(60, Math.min(w - MARGIN.l - MARGIN.r, h - MARGIN.t - MARGIN.b));
        const rect = {
            x: Math.max(0, (w - (side + MARGIN.l + MARGIN.r)) / 2),
            y: Math.max(0, (h - side - MARGIN.t - MARGIN.b) / 2),
            w: side + MARGIN.l + MARGIN.r,
            h: side + MARGIN.t + MARGIN.b
        };
        const u = lengthUnit(o.n * o.dx);
        const lo = (-o.n / 2 - 0.5) * o.dx * u.s,
            hi = (o.n / 2 - 0.5) * o.dx * u.s;
        const map = UI.plot(ctx, rect, {
            x: {
                min: lo,
                max: hi,
                label: "x",
                unit: u.unit
            },
            y: {
                min: lo,
                max: hi,
                label: "y",
                unit: u.unit
            },
            series: [],
            legend: false,
            margin: MARGIN
        });
        const shown = o.n > 1024 ? blockDownsample(o.data, o.n, o.n / 1024, o.pick ? "pick" : "mean") : {
            data: o.data,
            n: o.n
        };
        ctx.save();
        ctx.fillStyle = "#000";
        ctx.fillRect(map.plot.x, map.plot.y, map.plot.w, map.plot.h);
        UI.imageFromArray(ctx, shown.data, shown.n, shown.n, map.plot, o.cmap, o.norm);
        ctx.restore();
        ctx.strokeStyle = pal.axis;
        ctx.lineWidth = 1;
        ctx.strokeRect(map.plot.x + 0.5, map.plot.y + 0.5, map.plot.w - 1, map.plot.h - 1);
        UI.drawColorbar(ctx, {
            x: map.plot.x + map.plot.w + 10,
            y: map.plot.y,
            w: 12,
            h: map.plot.h
        }, o.cmap, o.bar);
        if (o.cursor) {
            const p = map.toPx(cursor.x * u.s, cursor.y * u.s);
            ctx.save();
            ctx.strokeStyle = "rgba(255,255,255,0.75)";
            ctx.setLineDash([4, 4]);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(map.plot.x, p.y);
            ctx.lineTo(map.plot.x + map.plot.w, p.y);
            ctx.moveTo(p.x, map.plot.y);
            ctx.lineTo(p.x, map.plot.y + map.plot.h);
            ctx.stroke();
            ctx.restore();
        }
        if (o.overlay) o.overlay(ctx, map, u);
        return {
            map,
            u
        };
    }

    const phaseBar = {
        min: -Math.PI,
        max: Math.PI,
        ticks: [-Math.PI, -Math.PI / 2, 0, Math.PI / 2, Math.PI],
        format: (v) => ({
            "-3.14": "−π",
            "-1.57": "−π/2",
            "0.00": "0",
            "1.57": "π/2",
            "3.14": "π"
        } [v.toFixed(2)] || v.toFixed(1))
    };

    let apMap = null,
        intMap = null,
        phMap = null;
    const apC = UI.setupCanvas($("apCanvas"), {
        aspect: 1.12,
        minHeight: 280,
        maxHeight: 620,
        draw(ctx, w, h) {
            if (!cur) {
                ctx.fillStyle = pal.background;
                ctx.fillRect(0, 0, w, h);
                return;
            }
            const st = readState();
            const isPhase = st.apView === "phase";
            const r = imagePanel(ctx, w, h, {
                data: isPhase ? cur.apPhase : cur.apAmp,
                n: cur.job.N,
                dx: cur.grid.dx,
                pick: isPhase,
                cmap: isPhase ? "twilight" : "gray",
                norm: isPhase ? {
                    min: -Math.PI,
                    max: Math.PI
                } : {
                    min: 0,
                    max: 1
                },
                bar: isPhase ? phaseBar : {
                    min: 0,
                    max: 1
                },
                overlay: brushOverlay
            });
            apMap = r;
        }
    });
    const intC = UI.setupCanvas($("intCanvas"), {
        aspect: 1.12,
        minHeight: 280,
        maxHeight: 620,
        draw(ctx, w, h) {
            if (!cur) {
                ctx.fillStyle = pal.background;
                ctx.fillRect(0, 0, w, h);
                return;
            }
            const st = readState(),
                v = cur.view,
                peak = v.max || 1;
            const norm = st.scale === "log" ? {
                log: true,
                max: peak,
                min: peak * Math.pow(10, -st.floor)
            } : {
                min: 0,
                max: peak
            };
            intMap = imagePanel(ctx, w, h, {
                data: v.I,
                n: v.size,
                dx: v.dx,
                cmap: "inferno",
                norm,
                bar: norm,
                cursor: true
            });
        }
    });
    const phC = UI.setupCanvas($("phaseCanvas"), {
        aspect: 1.12,
        minHeight: 280,
        maxHeight: 620,
        draw(ctx, w, h) {
            if (!cur) {
                ctx.fillStyle = pal.background;
                ctx.fillRect(0, 0, w, h);
                return;
            }
            const v = cur.view;
            phMap = imagePanel(ctx, w, h, {
                data: v.P,
                n: v.size,
                dx: v.dx,
                cmap: "twilight",
                pick: true,
                norm: {
                    min: -Math.PI,
                    max: Math.PI
                },
                bar: phaseBar,
                cursor: true
            });
        }
    });
    let cutData = null;
    const cutC = UI.setupCanvas($("cutCanvas"), {
        aspect: 1.12,
        minHeight: 320,
        maxHeight: 620,
        draw(ctx, w, h) {
            ctx.fillStyle = pal.background;
            ctx.fillRect(0, 0, w, h);
            if (!cur) return;
            const st = readState(),
                c = cuts();
            cutData = c;
            const u = lengthUnit(cur.view.size * cur.view.dx);
            const xs = Array.from(c.xs, (x) => x * u.s);
            const peak = cur.view.max || 1;
            const log = st.scale === "log";
            const clean = (arr) => arr ? Array.from(arr, (v) => (log && !(v > peak * Math.pow(10, -st.floor)) ? NaN : v)) : null;
            let ymax = 0;
            for (const a of [c.Ix, c.Iy])
                for (const v of a) ymax = Math.max(ymax, v);
            const yAxis = log ? {
                min: peak * Math.pow(10, -st.floor),
                max: peak * 1.5,
                log: true,
                label: "|U|²/I₀"
            } : {
                min: 0,
                max: (ymax || 1) * 1.08,
                label: "|U|²/I₀"
            };
            const mk = (I, R, label, other) => {
                const s = [{
                    xs,
                    ys: clean(I),
                    label: "numerical " + label + "-cut",
                    color: pal.series[0],
                    width: 1.8
                }];
                if (R) s.push({
                    xs,
                    ys: clean(R),
                    label: "Fraunhofer (analytic)",
                    color: pal.series[1],
                    dash: [6, 4],
                    width: 1.5
                });
                return s;
            };
            const half = h / 2,
                margin = {
                    l: 70,
                    r: 14,
                    t: 12,
                    b: 42
                };
            UI.plot(ctx, {
                x: 0,
                y: 0,
                w,
                h: half
            }, {
                margin,
                x: {
                    min: xs[0],
                    max: xs[xs.length - 1],
                    label: "x (" + u.unit + "), cut at y = " + +(c.yc * u.s).toPrecision(3) + " " + u.unit
                },
                y: Object.assign({}, yAxis),
                series: mk(c.Ix, c.Rx, "x"),
                cursor: {
                    x: cursor.x * u.s
                },
                legend: true
            });
            UI.plot(ctx, {
                x: 0,
                y: half,
                w,
                h: half
            }, {
                margin,
                x: {
                    min: xs[0],
                    max: xs[xs.length - 1],
                    label: "y (" + u.unit + "), cut at x = " + +(c.xc * u.s).toPrecision(3) + " " + u.unit
                },
                y: Object.assign({}, yAxis),
                series: mk(c.Iy, c.Ry, "y"),
                cursor: {
                    x: cursor.y * u.s
                },
                legend: true
            });
        }
    });

    function brushOverlay(ctx, map, u) {
        if (!hover || toolCtl.get().tool === "probe") return;
        const r = Math.pow(10, toolCtl.get().br) * UM;
        const c = map.toPx(hover.x * u.s, hover.y * u.s);
        const rpx = Math.abs(map.xToPx(r * u.s) - map.xToPx(0));
        ctx.save();
        ctx.strokeStyle = toolCtl.get().tool === "erase" ? "#ff9f6b" : "#69f5e7";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(c.x, c.y, Math.max(2, rpx), 0, 2 * Math.PI);
        ctx.stroke();
        ctx.restore();
    }

    function redrawAll() {
        apC.redraw();
        intC.redraw();
        phC.redraw();
        cutC.redraw();
    }


    const descAp = UI.describeCanvas($("apCanvas"), "Aperture amplitude map.", {
        label: "Aperture transmittance map (editable with the brush)"
    });
    const descInt = UI.describeCanvas($("intCanvas"), "Propagated intensity map.", {
        label: "Propagated intensity map with cross-hair"
    });
    const descPh = UI.describeCanvas($("phaseCanvas"), "Propagated phase map.", {
        label: "Propagated phase map"
    });
    const descCut = UI.describeCanvas($("cutCanvas"), "Line cuts.", {
        label: "Intensity line cuts along x and y through the cross-hair"
    });

    function updateReadouts() {
        if (!cur) return;
        const {
            info,
            res,
            view,
            job
        } = cur, pw = res.power, st = job.st;
        const set = (id, t) => {
            $(id).textContent = t;
        };
        set("rDx", fmt(info.dx, "m"));
        set("rL", fmt(info.L, "m") + ", N = " + info.N);
        set("rNp", res.n + "² (" + res.pad + "×), Lp = " + fmt(res.n * info.dx, "m"));
        set("rOutDx", fmt(res.dx, "m") + (job.params.method === "fresnel" || job.params.method === "fraunhofer" ? " = λz/(NpΔx)" : " (= Δx)"));
        set("rOutL", fmt(cur.viewFull.size * view.dx, "m") + (view.size !== cur.viewFull.size ? " (showing " + fmt(view.size * view.dx, "m") + ")" : ""));
        set("rNF", Number.isFinite(info.NF) ? (info.NF < 0.01 ? info.NF.toExponential(2) : info.NF.toPrecision(3)) + " (a = " + fmt(info.a, "m") + ")" : "— (unbounded aperture)");
        set("rZc", fmt(info.zc, "m"));
        set("rSuggest", job.params.z <= info.zc ? "ASM or TF (z ≤ zc)" : "BL-ASM, IR or 1-FFT (z > zc)");
        const perMm = (f) => Number((f * 1e-3).toPrecision(3)) + " mm⁻¹";
        set("rBL", Number.isFinite(res.bandLimit) ? perMm(res.bandLimit) + " (" + (info.bandFraction * 100).toFixed(0) + " %)" : "off (grid fmax " + perMm(info.fMax) + ")");
        set("rPx", Number.isFinite(info.pxPerFeature) ? info.pxPerFeature.toFixed(1) : "—");
        set("rPin", fmtArea(pw.input) + "·I₀");
        set("rPdet", pct(pw.detector / pw.input));
        set("rPout", pct(pw.outside / pw.input));
        set("rPrem", pct(pw.removed / pw.input) + (pw.evanescentFraction > 0 ? " (evanescent " + pct(pw.evanescentFraction) + ")" : ""));
        set("rPedge", pct(pw.edge / pw.input));
        set("rPeak", cur.viewFull.max.toPrecision(4) + " I₀");
        const c = view.size / 2,
            onAxis = view.I[c * view.size + c];
        set("rAxis", onAxis.toPrecision(4) + " I₀");
        let exact = "—";
        const plain = !job.spec.strokes.length;
        if (plain && job.spec.shape === "circle" && job.spec.illum === "plane") exact = P.onAxisCircle(job.params.lambda, job.params.z, job.spec.a / 2).aperture.toPrecision(4) + " I₀";
        if (plain && job.spec.shape === "disk") {
            const q = P.onAxisCircle(job.params.lambda, job.params.z, job.spec.a / 2).disk;
            exact = job.spec.illum === "plane" ? q.toPrecision(4) + " I₀" : (q * Math.exp(-2 * Math.pow(job.spec.a / 2 / job.spec.w, 2))).toPrecision(3) + " I₀ (× Gaussian rim factor)";
        }
        set("rAxisExact", exact);
        const {
            ix,
            iy
        } = cursorIndex();
        const u = lengthUnit(view.size * view.dx);
        set("rCursor", "(" + ((ix - view.size / 2) * view.dx * u.s).toPrecision(3) + ", " + ((iy - view.size / 2) * view.dx * u.s).toPrecision(3) + ") " + u.unit);
        const vI = view.I[iy * view.size + ix],
            vP = view.P[iy * view.size + ix];
        set("rCursorVal", vI.toPrecision(3) + " I₀, " + (Number.isFinite(vP) ? vP.toFixed(2) + " rad" : "phase undefined"));
        let refText = cur.refNote || (readState().ref ? "no closed form for this case" : "overlay off");
        const cd = cuts();
        if (cd.Rx) {
            let s = 0,
                m = 0;
            for (let i = 0; i < cd.Ix.length; i++) {
                s += (cd.Ix[i] - cd.Rx[i]) ** 2;
                m = Math.max(m, cd.Rx[i]);
            }
            refText = (Math.sqrt(s / cd.Ix.length) / (m || 1)).toExponential(2) + (Number.isFinite(info.NF) && info.NF > 0.1 ? " (N_F not ≪ 1)" : "");
        }
        set("rRef", refText);
        set("rTime", Math.round(cur.ms) + " ms (" + cur.where + ")");
        $("statNF").textContent = Number.isFinite(info.NF) ? info.NF.toPrecision(3) : "—";
        $("statPower").textContent = pct(pw.detector / pw.input);
        $("intBadge").textContent = (st.scale === "log" ? "log, floor 10^−" + st.floor + " × peak" : "linear") + " · I/I₀";


        const host = $("warnHost");
        host.textContent = "";
        const warns = info.warnings.slice();
        const edgeFrac = pw.edge / pw.input,
            direct = job.params.method === "fresnel" || job.params.method === "fraunhofer";
        if (edgeFrac > 1e-3) warns.push({
            level: edgeFrac > 1e-2 ? "warn" : "info",
            text: pct(edgeFrac) + " of the power sits in the outer band of the computational grid, so light aliases across the periodic FFT window. " + (direct ? "The output field spans λz/Δx: reduce Δx (larger N or smaller window) to widen it." : "Increase the padding or the window extent.")
        });
        if (pw.removed / pw.input > 0.01) warns.push({
            level: "info",
            text: pct(pw.removed / pw.input) + " of the power was removed by the " + (pw.evanescentFraction > 0.005 ? "evanescent treatment / " : "") + "band limit and is reported, not renormalised."
        });
        if (job.padReduced) warns.push({
            level: "info",
            text: "Padding reduced to " + res.pad + "× to keep the FFT grid ≤ " + NP_MAX + "²."
        });
        for (const w of warns) {
            const p = document.createElement("p");
            p.className = "optics-warning";
            p.textContent = (w.level === "warn" ? "⚠ " : "ℹ ") + w.text;
            host.appendChild(p);
        }

        descAp.update("Aperture on a " + job.N + "² grid, extent " + fmt(info.L, "m") + ", shape " + job.spec.shape + ", " + job.spec.strokes.length + " brush points; transmitted power " + fmtArea(pw.input) + " × I₀.");
        descInt.update("Intensity at z = " + fmt(job.params.z, "m") + " by " + job.params.method + ": peak " + view.max.toPrecision(3) + " I₀, on-axis " + onAxis.toPrecision(3) + " I₀, detector extent " + fmt(view.size * view.dx, "m") + ", " + pct(pw.detector / pw.input) + " of the power on the detector.");
        descPh.update("Phase map with carrier removed; undefined where intensity is below 10⁻³ of the peak. At the cross-hair: " + (Number.isFinite(vP) ? vP.toFixed(2) + " rad" : "undefined") + ".");
        descCut.update("Cuts through (" + fmt(cd.xc, "m") + ", " + fmt(cd.yc, "m") + "): x-cut max " + Math.max(...cd.Ix).toPrecision(3) + " I₀, y-cut max " + Math.max(...cd.Iy).toPrecision(3) + " I₀. Deviation from analytic Fraunhofer: " + refText + ".");
    }


    let hover = null,
        drawing = null;

    function setCanvasMode() {
        const tool = toolCtl.get().tool;
        $("apCanvas").classList.toggle("painting", tool !== "probe");
        apC.redraw();
    }

    function apPoint(e) {
        if (!apMap) return null;
        const r = $("apCanvas").getBoundingClientRect(),
            px = e.clientX - r.left,
            py = e.clientY - r.top;
        if (!apMap.map.contains(px, py)) return null;
        const p = apMap.map.fromPx(px, py);
        return {
            x: p.x / apMap.u.s,
            y: p.y / apMap.u.s
        };
    }

    function addPoint(pt) {
        const t = toolCtl.get();
        const s = {
            x: pt.x,
            y: pt.y,
            r: Math.pow(10, t.br) * UM,
            mode: t.tool === "erase" ? "erase" : "paint",
            t: Number(t.bt),
            p: Number(t.bp) * Math.PI / 180
        };
        const g = drawing.group,
            last = g[g.length - 1];
        if (last) {

            const dist = Math.hypot(s.x - last.x, s.y - last.y),
                step = Math.max(s.r / 2, cur.grid.dx / 2);
            const k = Math.min(200, Math.floor(dist / step));
            for (let i = 1; i <= k; i++) pushPoint(Object.assign({}, s, {
                x: last.x + (s.x - last.x) * i / (k + 1),
                y: last.y + (s.y - last.y) * i / (k + 1)
            }));
        }
        pushPoint(s);
    }

    function pushPoint(s) {
        drawing.group.push(s);
        if (!cur) return;

        const g = cur.grid,
            N = g.N,
            sp = cur.job.spec;
        const illum = sp.illum === "gauss" ? Math.exp(-(s.x * s.x + s.y * s.y) / (sp.w * sp.w)) : 1;
        P.applyStroke(cur.field.re, cur.field.im, g, Object.assign({}, s, {
            t: s.t * illum
        }), 2);
        const i0 = Math.max(0, Math.floor((s.x - s.r) / g.dx + N / 2) - 1),
            i1 = Math.min(N - 1, Math.ceil((s.x + s.r) / g.dx + N / 2) + 1);
        const j0 = Math.max(0, Math.floor((s.y - s.r) / g.dx + N / 2) - 1),
            j1 = Math.min(N - 1, Math.ceil((s.y + s.r) / g.dx + N / 2) + 1);
        for (let iy = j0; iy <= j1; iy++)
            for (let ix = i0; ix <= i1; ix++) {
                const k = iy * N + ix,
                    a = Math.hypot(cur.field.re[k], cur.field.im[k]);
                cur.apAmp[k] = a;
                cur.apPhase[k] = a > 1e-3 ? Math.atan2(cur.field.im[k], cur.field.re[k]) : NaN;
            }
    }
    const apEl = $("apCanvas");
    apEl.addEventListener("pointerdown", (e) => {
        const tool = toolCtl.get().tool,
            pt = apPoint(e);
        if (!pt) return;
        if (tool === "probe") {
            if (!cur) return;
            const N = cur.job.N,
                ix = Math.round(pt.x / cur.grid.dx + N / 2),
                iy = Math.round(pt.y / cur.grid.dx + N / 2);
            if (ix < 0 || iy < 0 || ix >= N || iy >= N) return;
            const k = iy * N + ix;
            $("strokeInfo").textContent = "t(" + fmt(pt.x, "m") + ", " + fmt(pt.y, "m") + ") = " + cur.apAmp[k].toFixed(3) + (Number.isFinite(cur.apPhase[k]) ? " ∠ " + (cur.apPhase[k] * 180 / Math.PI).toFixed(0) + "°" : "") + " (incl. illumination)";
            return;
        }
        e.preventDefault();
        apEl.setPointerCapture(e.pointerId);
        drawing = {
            group: []
        };
        addPoint(pt);
        apC.redraw();
    });
    apEl.addEventListener("pointermove", (e) => {
        hover = apPoint(e);
        if (drawing && hover) addPoint(hover);
        if (toolCtl.get().tool !== "probe" || drawing) apC.redraw();
    });
    apEl.addEventListener("pointerleave", () => {
        hover = null;
        apC.redraw();
    });
    const endStroke = () => {
        if (!drawing) return;
        if (drawing.group.length) strokes.push(drawing.group);
        drawing = null;
        updateStrokeInfo();
        url.update();
        scheduleCompute();
    };
    apEl.addEventListener("pointerup", endStroke);
    apEl.addEventListener("pointercancel", endStroke);

    function updateStrokeInfo() {
        const n = flatStrokes().length;
        $("strokeInfo").textContent = n ? strokes.length + " stroke(s), " + n + " brush discs" + (n > 400 ? " (too many for a share link; use JSON export)" : "") + "." : "No brush strokes. Choose Paint or Erase, then drag on the aperture view.";
        $("undoBtn").disabled = !n;
        $("clearBtn").disabled = !n;
    }
    $("undoBtn").addEventListener("click", () => {
        strokes.pop();
        updateStrokeInfo();
        url.update();
        scheduleCompute();
    });
    $("clearBtn").addEventListener("click", () => {
        strokes = [];
        updateStrokeInfo();
        url.update();
        scheduleCompute();
    });

    function moveCursorTo(map, e) {
        const r = e.target.getBoundingClientRect(),
            px = e.clientX - r.left,
            py = e.clientY - r.top;
        if (!map || !map.map.contains(px, py)) return;
        const p = map.map.fromPx(px, py);
        cursor = {
            x: p.x / map.u.s,
            y: p.y / map.u.s
        };
        clampCursor();
        intC.redraw();
        phC.redraw();
        cutC.redraw();
        updateReadouts();
    }
    for (const [el, getMap] of [
            [$("intCanvas"), () => intMap],
            [$("phaseCanvas"), () => phMap]
        ]) {
        let down = false;
        el.addEventListener("pointerdown", (e) => {
            down = true;
            moveCursorTo(getMap(), e);
        });
        el.addEventListener("pointermove", (e) => {
            if (down) moveCursorTo(getMap(), e);
        });
        window.addEventListener("pointerup", () => {
            down = false;
        });
    }
    $("intCanvas").addEventListener("keydown", (e) => {
        if (!cur) return;
        const d = cur.view.dx * (e.shiftKey ? 10 : 1);
        const mv = {
            ArrowLeft: [-d, 0],
            ArrowRight: [d, 0],
            ArrowUp: [0, d],
            ArrowDown: [0, -d]
        } [e.key];
        if (e.key === "Home") {
            cursor = {
                x: 0,
                y: 0
            };
        } else if (!mv) return;
        else {
            cursor.x += mv[0];
            cursor.y += mv[1];
        }
        e.preventDefault();
        clampCursor();
        intC.redraw();
        phC.redraw();
        cutC.redraw();
        updateReadouts();
    });


    const presetHost = $("presetButtons");

    function applyPreset(p) {
        strokes = [];
        cursor = {
            x: 0,
            y: 0
        };
        ctl.set(toControls(Object.assign({}, BASE, p.set)));
        toolCtl.set({
            tool: "probe"
        });
        presetHost.querySelectorAll(".preset-option").forEach((b) => b.classList.toggle("active", b.dataset.preset === p.id));
        $("presetNote").textContent = "Expected: " + p.note;
        updateStrokeInfo();
        updateLabels();
        url.update();
        scheduleCompute();
    }
    for (const p of PRESETS) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "preset-option";
        b.dataset.preset = p.id;
        b.textContent = p.label;
        b.title = p.note;
        b.addEventListener("click", () => applyPreset(p));
        presetHost.appendChild(b);
    }
    $("resetBtn").addEventListener("click", () => {
        toolCtl.set({
            br: 2,
            bt: 1,
            bp: 0
        });
        applyPreset(PRESETS[0]);
    });

    UI.addExportBar($("exportHost"), {
        name: "aperture-propagation",
        url,
        getState: () => Object.assign({
            settings: ctl.get(),
            strokes: flatStrokes(),
            units: "SI (strokes in m, phase in rad); slider values: log10(µm) for a,b,d,w; log10(m) for z; log10(µm) for L"
        }, cur ? {
            power: cur.res.power,
            outputPitch_m: cur.res.dx,
            fresnelNumber: cur.info.NF,
            criticalDistance_m: cur.info.zc
        } : {}),
        getCSV: () => {
            const c = cutData || cuts();
            const rows = [];
            for (let i = 0; i < c.xs.length; i++) rows.push([c.xs[i], c.Ix[i], c.Rx ? c.Rx[i] : "", c.Iy[i], c.Ry ? c.Ry[i] : ""]);
            return {
                headers: ["position (m)", "I_x-cut/I0", "I_x-cut Fraunhofer/I0", "I_y-cut/I0", "I_y-cut Fraunhofer/I0"],
                rows
            };
        },
        canvases: [$("apCanvas"), $("intCanvas"), $("phaseCanvas"), $("cutCanvas")],
        caption: () => {
            if (!cur) return "";
            const j = cur.job;
            return "λ = " + fmt(j.params.lambda, "m") + ", z = " + fmt(j.params.z, "m") + ", " + j.params.method + ", N = " + j.N + ", L = " + fmt(j.L, "m") + ", pad " + cur.res.pad + "×, N_F = " + (Number.isFinite(cur.info.NF) ? cur.info.NF.toPrecision(3) : "—");
        }
    });


    const initial = toControls(BASE);
    ctl.set(initial);
    $("presetNote").textContent = "Expected: " + PRESETS[0].note;
    presetHost.querySelector('[data-preset="circFresnel"]').classList.add("active");
    updateStrokeInfo();
    updateLabels();
    setCanvasMode();
    url.ready.then(() => {
        updateLabels();
        scheduleCompute();
    });
    scheduleCompute();


    window.__apertureTool = {
        get state() {
            return {
                settings: ctl.get(),
                cursor: Object.assign({}, cursor),
                result: cur && {
                    n: cur.res.n,
                    dx: cur.res.dx,
                    power: cur.res.power,
                    info: cur.info,
                    peak: cur.view.max
                }
            };
        },
        presets: PRESETS.map((p) => p.id),
        applyPreset: (id) => applyPreset(PRESETS.find((p) => p.id === id))
    };
})();