"use strict";



(function() {
    const UI = window.OpticsUI;
    const core = window.OpticsModels.core;
    const QO = window.OpticsModels.quantumOptics;
    const PAL = UI.CANVAS_PALETTE;
    const $ = (id) => document.getElementById(id);
    const FS = 12;
    const RAD = Math.PI / 180;
    const fx = (v, d = 3) => (Number.isFinite(v) ? Number(v.toFixed(d)).toString() : "—");
    const fp = (v, d = 3) => (Number.isFinite(v) ? Number(v.toPrecision(d)).toString() : "—");
    const fsi = (v, u, d = 3) => core.formatSI(v, u, d);
    const pow10 = (v) => Number(Math.pow(10, v).toPrecision(4));
    const reduced = UI.prefersReducedMotion();


    const DEFAULTS = Object.freeze({
        exp: "mz",
        phi: 60,
        th: 0,
        r1: 50,
        gam: 0,
        pol: "none",
        chi: 45,
        etaM: 100,
        pd: 0,
        spd: 1.5,
        seedM: 1,
        st: "coherent",
        nbar: 4,
        nf: 3,
        nc: 60,
        etaS: 100,
        dk: 0,
        sh: 3.7,
        seedS: 1,
        src: "thermal",
        line: "lorentz",
        t0: 3,
        rate: 5,
        etaH: 50,
        dark: 0,
        jit: -2,
        tacq: -0.52,
        seedH: 1
    });
    const L10 = Math.log10;
    const PRESETS = {
        mzClean: {
            s: {
                exp: "mz",
                th: 0,
                r1: 50,
                gam: 0,
                pol: "none"
            },
            note: "<strong>Expect:</strong> V = 1 and D = 0. D₁ clicks with probability ½(1 − cos φ): never at φ = 0 (dark port) and always at φ = 180°. Every photon still gives exactly one click."
        },
        mzPartial: {
            s: {
                exp: "mz",
                th: 60,
                r1: 50,
                gam: 0,
                pol: "none"
            },
            note: "<strong>Expect:</strong> V = cos 60° = 0.50 and D = sin 60° = 0.87, with V² + D² = 1. The fringe still has its full period, but its contrast is halved."
        },
        mzFull: {
            s: {
                exp: "mz",
                th: 90,
                r1: 50,
                gam: 0,
                pol: "none"
            },
            note: "<strong>Expect:</strong> orthogonal markers carry complete which-path information (D = 1), so V = 0: each detector clicks for half the photons at every φ."
        },
        mzErase: {
            s: {
                exp: "mz",
                th: 90,
                r1: 50,
                gam: 0,
                pol: "p45"
            },
            note: "<strong>Expect:</strong> the +45° polarizer blocks half the photons (P(blocked) = 0.5). The photons that pass show fringes with V = 1: D₁ ∝ ¼(1 − cos φ). The which-path information has been erased."
        },
        mzAnti: {
            s: {
                exp: "mz",
                th: 90,
                r1: 50,
                gam: 0,
                pol: "m45"
            },
            note: "<strong>Expect:</strong> anti-fringes, D₁ ∝ ¼(1 + cos φ). Added to the +45° pattern they give the flat which-path result, so the polarizer choice cannot signal anything."
        },
        mzUnbal: {
            s: {
                exp: "mz",
                th: 0,
                r1: 90,
                gam: 0,
                pol: "none"
            },
            note: "<strong>Expect:</strong> the path is partly predictable, P = |0.1 − 0.9| = 0.8 = D, and V = 2√(0.1 × 0.9) = 0.6. With no marker, V² + D² = 1 is still saturated."
        },
        mzDephase: {
            s: {
                exp: "mz",
                th: 30,
                r1: 50,
                gam: 40,
                pol: "none"
            },
            note: "<strong>Expect:</strong> V = cos 30° × (1 − 0.4) = 0.52 while D = 0.5, so V² + D² = 0.52 &lt; 1. Information lost to an unread environment reduces V without giving you D."
        },
        mzNoisy: {
            s: {
                exp: "mz",
                th: 0,
                r1: 50,
                gam: 0,
                pol: "none",
                etaM: 60,
                pd: 5
            },
            note: "<strong>Expect:</strong> the D₁ click probability swings from p<sub>d</sub> = 0.05 to 1 − 0.4 × 0.95 = 0.62. The click visibility drops to 0.85 while the photon visibility is still V = 1."
        },
        stLaser: {
            s: {
                exp: "stats",
                st: "coherent",
                nbar: 4,
                nc: 40,
                etaS: 100,
                dk: 0
            },
            note: "<strong>Expect:</strong> a Poisson distribution with ⟨m⟩ = Var = 4, Q = 0 and g²(0) = 1. The bars scatter around the dots within about ±1σ."
        },
        stThermal: {
            s: {
                exp: "stats",
                st: "thermal",
                nbar: 4,
                nc: 80,
                etaS: 100,
                dk: 0
            },
            note: "<strong>Expect:</strong> a geometric (Bose–Einstein) distribution, most probable at m = 0, with Var = n̄ + n̄² = 20, Q = 4 and g²(0) = 2. The density matrix is diagonal."
        },
        stFock: {
            s: {
                exp: "stats",
                st: "fock",
                nf: 3,
                nc: 10,
                etaS: 100,
                dk: 0
            },
            note: "<strong>Expect:</strong> every gate gives exactly 3 counts: Var = 0, Q = −1 and g²(0) = 1 − 1/3 = 0.667."
        },
        stFockLoss: {
            s: {
                exp: "stats",
                st: "fock",
                nf: 3,
                nc: 10,
                etaS: 50,
                dk: 0
            },
            note: "<strong>Expect:</strong> a binomial(3, ½) distribution, 1:3:3:1 / 8, with ⟨m⟩ = 1.5, Var = 0.75 and Q = −0.5. g²(0) stays 0.667."
        },
        stThermLoss: {
            s: {
                exp: "stats",
                st: "thermal",
                nbar: 5,
                nc: 120,
                etaS: 20,
                dk: 0
            },
            note: "<strong>Expect:</strong> still thermal, now with n̄ = 1: P(m) = 1/2<sup>m+1</sup>, Q = ηn̄ = 1 and g²(0) = 2. Loss never turns chaotic light into laser light."
        },
        stSqueezed: {
            s: {
                exp: "stats",
                st: "squeezed",
                nbar: 1,
                nc: 60,
                etaS: 100,
                dk: 0
            },
            note: "<strong>Expect:</strong> only even photon numbers (pairs), with Var = 2n̄(n̄ + 1) = 4, Q = 3 and g²(0) = 3 + 1/n̄ = 4. Loss fills in the odd numbers."
        },
        stDark: {
            s: {
                exp: "stats",
                st: "fock",
                nf: 0,
                nc: 4,
                etaS: 90,
                dk: 0.5
            },
            note: "<strong>Expect:</strong> the vacuum gives counts only from dark noise, Poisson with mean 0.5: P(0) = 0.607, P(1) = 0.303 and Q = 0."
        },
        stTrunc: {
            s: {
                exp: "stats",
                st: "coherent",
                nbar: 20,
                nc: 20,
                etaS: 100,
                dk: 0
            },
            note: "<strong>Expect:</strong> a warning. The basis |0⟩…|20⟩ discards P(n &gt; 20) = 0.44, so the renormalised state has ⟨n⟩ ≈ 16.8 instead of 20. Raise N to about 50 and the error drops below 10⁻⁶."
        },
        hbLaser: {
            s: {
                exp: "hbt",
                src: "coherent",
                t0: 3,
                rate: 5,
                dark: 0,
                jit: -2,
                tacq: 0.3
            },
            note: "<strong>Expect:</strong> g²(τ) = 1 at every delay, within the Poisson error bars. The two detectors click independently."
        },
        hbThermL: {
            s: {
                exp: "hbt",
                src: "thermal",
                line: "lorentz",
                t0: 3,
                rate: 5,
                dark: 0,
                jit: -2,
                tacq: -0.52
            },
            note: "<strong>Expect:</strong> bunching. g²(0) ≈ 2 (the two centre bins average over the cusp and read ≈ 1.86), decaying as 1 + e<sup>−2|τ|/τc</sup> with τc = 1 µs (rotating ground-glass pseudo-thermal light)."
        },
        hbThermG: {
            s: {
                exp: "hbt",
                src: "thermal",
                line: "gauss",
                t0: 3,
                rate: 5,
                dark: 0,
                jit: -2,
                tacq: -0.7
            },
            note: "<strong>Expect:</strong> g²(0) ≈ 2 with a Gaussian decay 1 + e<sup>−π(τ/τc)²</sup>. The peak has a rounded top instead of the Lorentzian cusp, and the same area τc."
        },
        hbJitter: {
            s: {
                exp: "hbt",
                src: "thermal",
                line: "lorentz",
                t0: L10(5),
                rate: L10(2e7),
                dark: 0,
                jit: L10(5),
                tacq: -2.82
            },
            note: "<strong>Expect:</strong> with σ = τc = 5 ns the peak falls to g²(0) ≈ 1.25 and broadens, while its area stays τc. Set σ to 0.01 ns to recover g²(0) = 2."
        },
        hbEmitter: {
            s: {
                exp: "hbt",
                src: "emitter",
                t0: 0,
                rate: L10(2e6),
                etaH: 50,
                dark: 0,
                jit: -2,
                tacq: -0.3
            },
            note: "<strong>Expect:</strong> antibunching. g²(0) ≈ 0 (averaging the two centre bins over the 0.15 ns bin width leaves about 0.07), recovering as 1 − e<sup>−|τ|/τ₀</sup> with τ₀ = 1 ns. No classical light can go below 1."
        },
        hbEmitDark: {
            s: {
                exp: "hbt",
                src: "emitter",
                t0: 0,
                rate: 6,
                etaH: 50,
                dark: L10(1.111e5),
                jit: L10(0.3),
                tacq: 0.176
            },
            note: "<strong>Expect:</strong> the worked example. ρ = 0.9 and σ = 0.3 ns give g²(0) ≈ 0.40 (0.405 before bin averaging), below the two-emitter limit of 0.5."
        }
    };


    const sidebar = document.querySelector(".options-sidebar");
    UI.enhanceAllSliders(sidebar, {
        spdS: {
            format: pow10,
            parse: (v) => L10(Math.max(1, v)),
            unit: "/s",
            label: "Emission speed"
        },
        shS: {
            format: (v) => Math.round(Math.pow(10, v)),
            parse: (v) => L10(Math.max(10, v)),
            label: "Number of gates"
        },
        t0S: {
            format: pow10,
            parse: (v) => L10(Math.max(0.1, v)),
            unit: "ns",
            label: "Source time"
        },
        rateS: {
            format: pow10,
            parse: (v) => L10(Math.max(1e3, v)),
            unit: "/s",
            label: "Signal rate"
        },
        darkS: {
            format: (v) => (v <= 0 ? 0 : pow10(v)),
            parse: (v) => (v < 1 ? 0 : L10(v)),
            unit: "/s",
            label: "Dark-count rate (0 = off)"
        },
        jitS: {
            format: (v) => (v <= -2 ? 0 : pow10(v)),
            parse: (v) => (v < 0.01 ? -2 : L10(v)),
            unit: "ns",
            label: "Timing jitter σ (0 = off)"
        },
        tacqS: {
            format: pow10,
            parse: (v) => L10(Math.max(1e-3, v)),
            unit: "s",
            label: "Acquisition time"
        }
    });
    const ctl = UI.bindControls({
        exp: "radio:exp",
        phi: "#phiS",
        th: "#thS",
        r1: "#r1S",
        gam: "#gamS",
        pol: "#polSel",
        chi: "#chiS",
        etaM: "#etaMS",
        pd: "#pdS",
        spd: "#spdS",
        seedM: "#seedMS",
        st: "#stSel",
        nbar: "#nbarS",
        nf: "#nfS",
        nc: "#ncS",
        etaS: "#etaSS",
        dk: "#dkS",
        sh: "#shS",
        seedS: "#seedSS",
        src: "#srcSel",
        line: "#lineSel",
        t0: "#t0S",
        rate: "#rateS",
        etaH: "#etaHS",
        dark: "#darkS",
        jit: "#jitS",
        tacq: "#tacqS",
        seedH: "#seedHS"
    }, () => onStateChange());

    let suppress = false;

    function onStateChange() {
        if (suppress) return;
        clearPresetHighlight();
        url.update();
        refresh();
    }

    function applyState(partial) {
        suppress = true;
        ctl.set(Object.assign({}, DEFAULTS, partial));
        suppress = false;
        url.update();
        refresh();
    }
    const url = UI.urlState({
        get: ctl.get,
        set: (s) => {
            suppress = true;
            ctl.set(s);
            suppress = false;
            refresh();
        }
    });

    const presetNote = $("presetNote");

    function clearPresetHighlight() {
        document.querySelectorAll(".preset-buttons .preset-option.active").forEach((b) => b.classList.remove("active"));
    }
    document.querySelectorAll(".preset-buttons .preset-option").forEach((btn) => {
        btn.addEventListener("click", () => {
            const p = PRESETS[btn.dataset.preset];
            if (!p) return;
            applyState(p.s);
            clearPresetHighlight();
            btn.classList.add("active");
            presetNote.innerHTML = p.note;
        });
    });

    function setDisabled(groupId, off) {
        const g = $(groupId);
        if (!g) return;
        g.classList.toggle("is-disabled", off);
        g.querySelectorAll("input, select").forEach((el) => {
            el.disabled = off;
        });
    }


    let currentExp = null;

    function showExperiment(exp) {
        if (exp === currentExp) return;
        currentExp = exp;
        document.querySelectorAll(".qo-exp-ctl, .qo-exp").forEach((el) => {
            el.hidden = el.dataset.exp !== exp;
        });
        if (exp !== "mz") mzLoop.stop();
        presetNote.textContent = "";
        clearPresetHighlight();
    }

    function refresh() {
        const S = ctl.get();
        showExperiment(S.exp);
        if (S.exp === "mz") mzRefresh(S);
        else if (S.exp === "stats") statsRefresh(S);
        else hbtRefresh(S);
    }


    function stat(i, icon, value, label) {
        $("s" + i + "i").innerHTML = icon;
        $("s" + i + "v").textContent = value;
        $("s" + i + "l").textContent = label;
    }

    function warn(host, msgs) {
        host.innerHTML = "";
        for (const m of msgs) {
            const p = document.createElement("p");
            p.className = "optics-warning";
            p.innerHTML = m;
            host.appendChild(p);
        }
    }


    const NB = 24;
    const MZ = {
        key: "",
        rng: null,
        sent: 0,
        n1: new Float64Array(NB),
        n2: new Float64Array(NB),
        trials: new Float64Array(NB),
        dark: 0,
        record: [],
        flash: {
            d: 0,
            t: 0
        },
        cfg: null,
        det: null
    };
    const binPhi = (b) => (b + 0.5) * 2 * Math.PI / NB;

    function mzCfg(S) {
        const polMap = {
            none: null,
            p45: 45,
            m45: -45,
            h: 0,
            v: 90,
            custom: S.chi
        };
        const pol = polMap[S.pol];
        return {
            cfg: {
                R1: S.r1 / 100,
                theta: S.th * RAD,
                dephase: S.gam / 100,
                polarizer: pol == null ? null : pol * RAD,
                phi: S.phi * RAD
            },
            det: {
                eta: S.etaM / 100,
                pDark: S.pd / 100
            },
            polDeg: pol
        };
    }

    function mzResetCounts(S) {
        MZ.rng = core.createRng(S.seedM);
        MZ.sent = 0;
        MZ.dark = 0;
        MZ.n1.fill(0);
        MZ.n2.fill(0);
        MZ.trials.fill(0);
        MZ.record = [];
    }

    function mzEmit(count) {
        const det = MZ.det;
        let last = null;
        for (let i = 0; i < count; i++) {
            const b = MZ.sent % NB;
            const probs = MZ.probsBin[b];
            const e = QO.mzSampleEvent(probs, det, MZ.rng);
            MZ.trials[b]++;
            if (e.c1) MZ.n1[b]++;
            if (e.c2) MZ.n2[b]++;
            const p1 = e.detected && e.port === 1,
                p2 = e.detected && e.port === 2;
            const d1 = e.c1 && !p1,
                d2 = e.c2 && !p2;
            if (d1) MZ.dark++;
            if (d2) MZ.dark++;
            MZ.record.push({
                p1,
                p2,
                d1,
                d2
            });
            if (MZ.record.length > 90) MZ.record.shift();
            MZ.sent++;
            last = e;
        }
        if (last) MZ.flash = {
            d: last.c1 && last.c2 ? 3 : last.c1 ? 1 : last.c2 ? 2 : 0,
            t: performance.now()
        };
    }

    const mzPlay = $("mzPlay");
    let emitAcc = 0;
    const mzLoop = UI.createLoop((dt) => {
        const S = ctl.get();
        emitAcc += dt * Math.pow(10, S.spd);
        const n = Math.min(2000, Math.floor(emitAcc));
        emitAcc -= n;
        if (n > 0) {
            mzEmit(n);
            mzDrawAll();
        } else mzCanvas.redraw();
    }, {
        onChange: (running) => {
            mzPlay.innerHTML = running ? '<span aria-hidden="true">⏸</span> Pause' : '<span aria-hidden="true">▶</span> Emit photons';
            mzPlay.setAttribute("aria-pressed", String(running));
        }
    });
    mzPlay.addEventListener("click", () => mzLoop.toggle());
    $("mzStep").addEventListener("click", () => {
        mzLoop.stop();
        mzEmit(1);
        mzDrawAll();
    });
    $("mzBurst").addEventListener("click", () => {
        mzEmit(1000);
        mzDrawAll();
    });
    $("mzReset").addEventListener("click", () => {
        mzLoop.stop();
        mzResetCounts(ctl.get());
        mzDrawAll();
    });

    function mzRefresh(S) {
        const m = mzCfg(S);
        setDisabled("chiGroup", S.pol !== "custom");
        const key = JSON.stringify([m.cfg.R1, m.cfg.theta, m.cfg.dephase, m.cfg.polarizer, m.det, S.seedM]);
        MZ.cfg = m.cfg;
        MZ.det = m.det;
        MZ.polDeg = m.polDeg;
        if (key !== MZ.key) {
            MZ.key = key;
            MZ.probsBin = [];
            for (let b = 0; b < NB; b++) MZ.probsBin.push(QO.mzProbabilities(Object.assign({}, m.cfg, {
                phi: binPhi(b)
            })));
            mzResetCounts(S);
        }

        const n = 181,
            xs = new Float64Array(n),
            c1 = new Float64Array(n),
            c2 = new Float64Array(n),
            p1 = new Float64Array(n);
        for (let i = 0; i < n; i++) {
            const ph = i * 2;
            xs[i] = ph;
            const pr = QO.mzProbabilities(Object.assign({}, m.cfg, {
                phi: ph * RAD
            }));
            const c = QO.mzClickProbabilities(pr, m.det);
            c1[i] = c.c1;
            c2[i] = c.c2;
            p1[i] = pr.P1;
        }
        MZ.curve = {
            xs,
            c1,
            c2,
            p1
        };
        MZ.now = QO.mzProbabilities(m.cfg);
        MZ.clickNow = QO.mzClickProbabilities(MZ.now, m.det);
        MZ.vis = QO.mzVisibility(Object.assign({}, m.cfg, {
            polarizer: null
        }));
        MZ.visE = m.cfg.polarizer == null ? null : QO.mzVisibility(m.cfg);
        MZ.wp = QO.whichPath(m.cfg);
        MZ.purity = QO.purity(MZ.now.rhoIn);

        const ck = [0, 0.5, 1, 1.5].map((k) => QO.mzClickProbabilities(QO.mzProbabilities(Object.assign({}, m.cfg, {
            phi: k * Math.PI
        })), m.det).c1);
        const A = (ck[0] + ck[1] + ck[2] + ck[3]) / 4,
            B = 0.5 * Math.hypot(ck[0] - ck[2], ck[1] - ck[3]);
        MZ.clickV = A > 0 ? B / A : 0;

        const sw = {
            V: [],
            D: []
        };
        for (let i = 0; i <= 90; i++) {
            const c = Object.assign({}, m.cfg, {
                theta: i * RAD
            });
            const w = QO.whichPath(c);
            sw.V.push(w.V);
            sw.D.push(w.D);
        }
        MZ.sweep = sw;
        const w = [];
        if (S.pol !== "none" && S.th < 45) w.push("The eraser polarizer only has something to erase when arm b carries a marker (θ &gt; 0). With θ = " + S.th + "° it mainly removes photons.");
        if (S.etaM < 100 || S.pd > 0) w.push("Detector efficiency and dark clicks change the <em>click</em> fringe (plot) but not the photon visibility V, which is defined from the Born probabilities.");
        warn($("mzWarn"), w);
        mzDrawAll();
    }

    function fitVisibility() {

        const M = [
                [0, 0, 0],
                [0, 0, 0],
                [0, 0, 0]
            ],
            v = [0, 0, 0];
        let used = 0;
        for (let b = 0; b < NB; b++) {
            const n = MZ.trials[b];
            if (!n) continue;
            const p = QO.mzClickProbabilities(MZ.probsBin[b], MZ.det).c1;
            const varI = Math.max(p * (1 - p), 0.25 / n) / n;
            const w = 1 / varI,
                y = MZ.n1[b] / n,
                ph = binPhi(b);
            const f = [1, Math.cos(ph), Math.sin(ph)];
            for (let i = 0; i < 3; i++) {
                v[i] += w * f[i] * y;
                for (let j = 0; j < 3; j++) M[i][j] += w * f[i] * f[j];
            }
            used++;
        }
        if (used < 4) return null;
        const inv = inv3(M);
        if (!inv) return null;
        const c = [0, 1, 2].map((i) => inv[i][0] * v[0] + inv[i][1] * v[1] + inv[i][2] * v[2]);
        const amp = Math.hypot(c[1], c[2]);
        if (!(c[0] > 0)) return null;
        const V = amp / c[0];

        const g = [-amp / (c[0] * c[0]), amp > 0 ? c[1] / (amp * c[0]) : 0, amp > 0 ? c[2] / (amp * c[0]) : 0];
        let varV = 0;
        for (let i = 0; i < 3; i++)
            for (let j = 0; j < 3; j++) varV += g[i] * inv[i][j] * g[j];
        return {
            V,
            sd: Math.sqrt(Math.max(varV, 0))
        };
    }

    function inv3(m) {
        const [a, b, c] = m[0], [d, e, f] = m[1], [g, h, k] = m[2];
        const A = e * k - f * h,
            B = -(d * k - f * g),
            C = d * h - e * g;
        const det = a * A + b * B + c * C;
        if (!Number.isFinite(det) || Math.abs(det) < 1e-300) return null;
        return [
            [A / det, -(b * k - c * h) / det, (b * f - c * e) / det],
            [B / det, (a * k - c * g) / det, -(a * f - c * d) / det],
            [C / det, -(a * h - b * g) / det, (a * e - b * d) / det]
        ];
    }


    let buildMap = null;
    const mzCanvas = UI.setupCanvas($("mzCanvas"), {
        aspect: 2.8,
        minHeight: 250,
        maxHeight: 300,
        draw: drawSetup
    });
    const buildCanvas = UI.setupCanvas($("buildCanvas"), {
        aspect: 1.45,
        minHeight: 260,
        draw: drawBuild
    });
    const vdCanvas = UI.setupCanvas($("vdCanvas"), {
        aspect: 1.45,
        minHeight: 260,
        draw: drawVD
    });
    const recCanvas = UI.setupCanvas($("recCanvas"), {
        aspect: 6,
        minHeight: 120,
        maxHeight: 150,
        draw: drawRecord
    });
    const dSetup = UI.describeCanvas($("mzCanvas"), "Mach–Zehnder interferometer schematic.", {
        label: "Mach–Zehnder interferometer with which-path marker"
    });
    const dBuild = UI.describeCanvas($("buildCanvas"), "Click fractions versus phase.", {
        label: "Fringes built from single-photon clicks"
    });
    const dVD = UI.describeCanvas($("vdCanvas"), "Visibility versus distinguishability.", {
        label: "Complementarity plot"
    });
    const dRec = UI.describeCanvas($("recCanvas"), "Detection record.", {
        label: "Record of the last 90 heralded photons"
    });

    $("buildCanvas").addEventListener("pointerdown", (e) => {
        if (!buildMap) return;
        const r = e.currentTarget.getBoundingClientRect();
        const px = e.clientX - r.left,
            py = e.clientY - r.top;
        if (buildMap.contains(px, py)) {
            const el = $("phiS");
            el.value = String(Math.round(Math.min(360, Math.max(0, buildMap.pxToX(px)))));
            el.dispatchEvent(new Event("input", {
                bubbles: true
            }));
        }
    });

    function mzDrawAll() {
        if (!MZ.curve) return;
        mzCanvas.redraw();
        buildCanvas.redraw();
        vdCanvas.redraw();
        recCanvas.redraw();
        mzReadouts();
    }

    function drawSetup(ctx, w, h) {
        ctx.fillStyle = PAL.background;
        ctx.fillRect(0, 0, w, h);
        if (!MZ.cfg) return;
        const fs = w < 520 ? 11 : 12;
        ctx.font = fs + "px " + PAL.font;
        const narrow = w < 560;
        const L = narrow ? 70 : 120;
        const xB1 = L,
            xB2 = w - (narrow ? 90 : 170),
            yB = h - 46,
            yT = 46;
        const beamA = PAL.series[0],
            beamB = PAL.series[2];
        const wa = 1 - MZ.cfg.R1,
            wb = MZ.cfg.R1;
        const lw = (p) => 1 + 5 * p;
        const line = (x0, y0, x1, y1, col, width, dash) => {
            ctx.strokeStyle = col;
            ctx.lineWidth = width;
            ctx.setLineDash(dash || []);
            ctx.beginPath();
            ctx.moveTo(x0, y0);
            ctx.lineTo(x1, y1);
            ctx.stroke();
            ctx.setLineDash([]);
        };

        line(14, yB, xB1, yB, PAL.text, lw(1));

        if (wa > 0) {
            line(xB1, yB, xB2, yB, beamA, lw(wa));
            line(xB2, yB, xB2, yT, beamA, lw(wa));
        }
        if (wb > 0) {
            line(xB1, yB, xB1, yT, beamB, lw(wb));
            line(xB1, yT, xB2, yT, beamB, lw(wb));
        }

        const P1 = MZ.now.P1,
            P2 = MZ.now.P2;
        const xD1 = w - 26,
            yD2 = 14;
        line(xB2, yT, xD1 - 12, yT, PAL.text, lw(Math.min(1, P1 + 1e-3)));
        line(xB2, yT, xB2, yD2 + 10, PAL.text, lw(Math.min(1, P2 + 1e-3)));

        const bs = (x, y, lab, dx, dy) => {
            ctx.strokeStyle = PAL.series[3];
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(x - 13, y + 13);
            ctx.lineTo(x + 13, y - 13);
            ctx.stroke();
            ctx.fillStyle = PAL.textMuted;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(lab, x + dx, y + dy);
        };
        const mirror = (x, y, lab, dx, dy) => {
            ctx.strokeStyle = PAL.axis;
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.moveTo(x - 13, y + 13);
            ctx.lineTo(x + 13, y - 13);
            ctx.stroke();
            ctx.fillStyle = PAL.textMuted;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(lab, x + dx, y + dy);
        };
        bs(xB1, yB, "BS1 R₁=" + Math.round(MZ.cfg.R1 * 100) + "%", 0, 26);
        if (narrow) {
            ctx.save();
            bs(xB2, yT, "", 0, 0);
            ctx.restore();
            ctx.fillStyle = PAL.textMuted;
            ctx.textAlign = "right";
            ctx.textBaseline = "top";
            ctx.fillText("BS2 50:50", xB2 - 8, yT + 18);
        } else bs(xB2, yT, "BS2 50:50", -44, -20);
        mirror(xB2, yB, "M", 20, 12);
        mirror(xB1, yT, "M", -20, -8);

        ctx.fillStyle = PAL.text;
        ctx.textAlign = "left";
        ctx.textBaseline = "bottom";
        ctx.fillText(narrow ? "1 γ, H" : "single photon, H", 6, yB - 8);

        const glyph = (x, y, ang, col) => {
            ctx.strokeStyle = col;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(x, y, 11, 0, 2 * Math.PI);
            ctx.stroke();
            const c = Math.cos(ang),
                s = Math.sin(ang);
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x - 8 * c, y + 8 * s);
            ctx.lineTo(x + 8 * c, y - 8 * s);
            ctx.stroke();
        };
        const midA = (xB1 + xB2) / 2;
        if (wa > 0 && !narrow) {
            glyph(midA, yB + 20, 0, beamA);
            {
                ctx.fillStyle = PAL.textMuted;
                ctx.textAlign = "left";
                ctx.textBaseline = "middle";
                ctx.fillText("arm a: H", midA + 16, yB + 20);
            }
        }

        const yM = (yB + yT) / 2;
        ctx.fillStyle = "rgba(241,135,200,0.25)";
        ctx.fillRect(xB1 - 16, yM - 5, 32, 10);
        ctx.strokeStyle = beamB;
        ctx.lineWidth = 1;
        ctx.strokeRect(xB1 - 16, yM - 5, 32, 10);
        ctx.fillStyle = PAL.text;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText("θ = " + Math.round(MZ.cfg.theta / RAD) + "°", xB1 + 20, yM);
        if (wb > 0) glyph(xB1 + 20 + ctx.measureText("θ = " + Math.round(MZ.cfg.theta / RAD) + "°").width + 16, yM, MZ.cfg.theta, beamB);

        const xP = xB1 + (xB2 - xB1) * 0.35;
        ctx.fillStyle = "rgba(167,139,250,0.25)";
        ctx.fillRect(xP - 6, yT - 14, 12, 28);
        ctx.strokeStyle = PAL.series[3];
        ctx.strokeRect(xP - 6, yT - 14, 12, 28);
        ctx.fillStyle = PAL.text;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText("φ = " + Math.round(MZ.cfg.phi / RAD) + "°", xP, yT + 17);
        if (MZ.cfg.dephase > 0) {
            ctx.fillStyle = PAL.warning;
            ctx.textAlign = "center";
            ctx.fillText("dephasing γ = " + Math.round(MZ.cfg.dephase * 100) + "%", xP + (narrow ? 20 : 90), yT + 17 + fs + 4);
        }

        if (MZ.polDeg != null) {
            const pz = (x, y, vertical) => {
                ctx.fillStyle = "rgba(248,212,119,0.25)";
                if (vertical) ctx.fillRect(x - 4, y - 14, 8, 28);
                else ctx.fillRect(x - 14, y - 4, 28, 8);
                if (!narrow) glyph(x + (vertical ? 0 : 26), y + (vertical ? -26 : 0), MZ.polDeg * RAD, PAL.marker);
            };
            pz(xD1 - 26, yT, true);
            pz(xB2, yD2 + 26, false);
            ctx.fillStyle = PAL.marker;
            ctx.textAlign = "right";
            ctx.textBaseline = "top";
            if (narrow) ctx.fillText("polarizers χ = " + MZ.polDeg + "°", xB2 - 8, yT + 24 + fs + 6);
            else ctx.fillText("polarizer χ = " + MZ.polDeg + "°", xD1 - 34, yT + 40);
        }

        const age = (performance.now() - MZ.flash.t) / 350;
        const glow = Math.max(0, 1 - age);
        const det = (x, y, lab, count, on) => {
            ctx.fillStyle = on ? "rgba(255,255,255," + (0.25 + 0.75 * glow) + ")" : PAL.panel;
            ctx.strokeStyle = PAL.text;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(x, y, 10, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = PAL.text;
            ctx.textAlign = "right";
            ctx.textBaseline = "middle";
            return count;
        };
        const f1 = glow > 0 && (MZ.flash.d === 1 || MZ.flash.d === 3),
            f2 = glow > 0 && (MZ.flash.d === 2 || MZ.flash.d === 3);
        det(xD1, yT, "D₁", 0, f1);
        det(xB2, yD2, "D₂", 0, f2);
        let k1 = 0,
            k2 = 0;
        for (let b = 0; b < NB; b++) {
            k1 += MZ.n1[b];
            k2 += MZ.n2[b];
        }
        ctx.fillStyle = PAL.text;
        ctx.textAlign = "right";
        ctx.textBaseline = "top";
        ctx.fillText("D₁: " + k1, xD1 + 12, yT + 14);
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText("D₂: " + k2, xB2 + 16, yD2 + 2);

        ctx.fillStyle = PAL.textMuted;
        ctx.textAlign = "right";
        ctx.textBaseline = "bottom";
        if (narrow) ctx.fillText("P: D₁ " + fx(P1, 2) + " · D₂ " + fx(P2, 2) + (MZ.polDeg != null ? " · blocked " + fx(MZ.now.Pblocked, 2) : ""), w - 8, h - 6);
        else ctx.fillText("P(D₁) = " + fx(P1) + "   P(D₂) = " + fx(P2) + (MZ.polDeg != null ? "   blocked " + fx(MZ.now.Pblocked) : ""), w - 8, h - 6);
    }

    function drawBuild(ctx, w, h) {
        if (!MZ.curve) return;
        const S = ctl.get();
        const opts = {
            x: {
                min: 0,
                max: 360,
                label: "phase φ",
                unit: "°",
                ticks: Object.assign([0, 90, 180, 270, 360], {
                    step: 90
                })
            },
            y: {
                min: 0,
                max: 1.05,
                label: "clicks per photon"
            },
            series: [{
                    xs: MZ.curve.xs,
                    ys: MZ.curve.c1,
                    label: "D₁ Born-rule",
                    color: PAL.series[0]
                },
                {
                    xs: MZ.curve.xs,
                    ys: MZ.curve.c2,
                    label: "D₂ Born-rule",
                    color: PAL.series[1],
                    dash: [7, 4]
                }
            ],
            cursor: {
                x: S.phi,
                label: "φ = " + S.phi + "°"
            },
            legendPosition: "left"
        };
        buildMap = UI.plot(ctx, {
            x: 0,
            y: 0,
            w,
            h
        }, opts);
        const m = buildMap;
        ctx.save();
        ctx.beginPath();
        ctx.rect(m.plot.x, m.plot.y, m.plot.w, m.plot.h);
        ctx.clip();
        for (let b = 0; b < NB; b++) {
            const n = MZ.trials[b];
            if (!n) continue;
            const x = binPhi(b) / RAD;
            for (const [arr, col, sq] of [
                    [MZ.n1, PAL.series[0], false],
                    [MZ.n2, PAL.series[1], true]
                ]) {
                const p = arr[b] / n,
                    sd = Math.sqrt(Math.max(p * (1 - p), 1e-12) / n);
                const px = m.xToPx(x) + (sq ? 3 : -3);
                ctx.strokeStyle = col;
                ctx.lineWidth = 1.2;
                ctx.beginPath();
                ctx.moveTo(px, m.yToPx(Math.max(0, p - sd)));
                ctx.lineTo(px, m.yToPx(Math.min(1.05, p + sd)));
                ctx.stroke();
                ctx.fillStyle = col;
                if (sq) ctx.fillRect(px - 3.5, m.yToPx(p) - 3.5, 7, 7);
                else {
                    ctx.beginPath();
                    ctx.arc(px, m.yToPx(p), 3.8, 0, 2 * Math.PI);
                    ctx.fill();
                }
            }
        }
        ctx.restore();
    }

    function drawVD(ctx, w, h) {
        if (!MZ.wp) return;
        const n = 91,
            cx = new Float64Array(n),
            cy = new Float64Array(n);
        for (let i = 0; i < n; i++) {
            const a = i / (n - 1) * Math.PI / 2;
            cx[i] = Math.cos(a);
            cy[i] = Math.sin(a);
        }
        const m = UI.plot(ctx, {
            x: 0,
            y: 0,
            w,
            h
        }, {
            x: {
                min: 0,
                max: 1.05,
                label: "visibility V"
            },
            y: {
                min: 0,
                max: 1.34,
                label: "distinguishability D",
                ticks: Object.assign([0, 0.2, 0.4, 0.6, 0.8, 1], {
                    step: 0.2
                })
            },
            series: [{
                    xs: cx,
                    ys: cy,
                    label: "V² + D² = 1",
                    color: PAL.textMuted,
                    width: 1.5
                },
                {
                    xs: MZ.sweep.V,
                    ys: MZ.sweep.D,
                    label: "θ sweep (current R₁, γ)",
                    color: PAL.series[2],
                    dash: [6, 4]
                }
            ],
            legendPosition: "left"
        });

        const px = m.xToPx(MZ.vis.V),
            py = m.yToPx(MZ.wp.D);
        ctx.fillStyle = PAL.marker;
        ctx.beginPath();
        ctx.arc(px, py, 6, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = PAL.background;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.font = FS + "px " + PAL.font;
        ctx.fillStyle = PAL.marker;
        ctx.textBaseline = "bottom";
        const lab = "V = " + fx(MZ.vis.V, 2) + ", D = " + fx(MZ.wp.D, 2);
        const tw = ctx.measureText(lab).width;
        ctx.textAlign = "left";

        ctx.textBaseline = "top";
        ctx.fillText(lab, Math.max(m.plot.x + 4, Math.min(px + 9, m.plot.x + m.plot.w - tw - 4)), Math.min(py + 9, m.plot.y + m.plot.h - FS - 4));

        const fit = MZ.fit;
        if (fit && MZ.polDeg == null && MZ.det.eta === 1 && MZ.det.pDark === 0) {
            const sx = m.xToPx(Math.min(1.05, fit.V));
            ctx.strokeStyle = PAL.series[0];
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(sx - 6, py - 6);
            ctx.lineTo(sx + 6, py + 6);
            ctx.moveTo(sx - 6, py + 6);
            ctx.lineTo(sx + 6, py - 6);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(m.xToPx(Math.max(0, fit.V - fit.sd)), py);
            ctx.lineTo(m.xToPx(Math.min(1.05, fit.V + fit.sd)), py);
            ctx.stroke();
        }
    }

    function drawRecord(ctx, w, h) {
        ctx.fillStyle = PAL.background;
        ctx.fillRect(0, 0, w, h);
        const fs = 12,
            l = 34,
            r = 8,
            top = 10,
            bot = 26;
        const rowH = (h - top - bot) / 2;
        ctx.font = fs + "px " + PAL.font;
        ctx.fillStyle = PAL.text;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText("D₁", 6, top + rowH / 2);
        ctx.fillText("D₂", 6, top + rowH * 1.5);
        ctx.strokeStyle = PAL.grid;
        ctx.lineWidth = 1;
        ctx.strokeRect(l + 0.5, top + 0.5, w - l - r - 1, 2 * rowH - 1);
        ctx.beginPath();
        ctx.moveTo(l, top + rowH);
        ctx.lineTo(w - r, top + rowH);
        ctx.stroke();
        const N = 90,
            cw = (w - l - r) / N,
            sz = Math.max(3, Math.min(rowH - 8, cw - 1.5));
        const rec = MZ.record,
            off = N - rec.length;
        rec.forEach((e, i) => {
            const x = l + (off + i + 0.5) * cw;
            const cell = (row, fill, col) => {
                const y = top + rowH * (row + 0.5);
                ctx.strokeStyle = col;
                ctx.fillStyle = col;
                ctx.lineWidth = 1.3;
                if (fill) ctx.fillRect(x - sz / 2, y - sz / 2, sz, sz);
                else ctx.strokeRect(x - sz / 2 + 0.5, y - sz / 2 + 0.5, sz - 1, sz - 1);
            };
            if (e.p1) cell(0, true, PAL.series[0]);
            else if (e.d1) cell(0, false, PAL.warning);
            if (e.p2) cell(1, true, PAL.series[1]);
            else if (e.d2) cell(1, false, PAL.warning);
        });
        ctx.fillStyle = PAL.textMuted;
        ctx.textAlign = "left";
        ctx.textBaseline = "bottom";
        ctx.fillText("older ←", l, h - 5);
        ctx.textAlign = "right";
        ctx.fillText("→ newest (photon #" + MZ.sent + ")", w - r, h - 5);
    }

    function mzReadouts() {
        const S = ctl.get();
        MZ.fit = MZ.sent >= NB * 4 ? fitVisibility() : null;
        let k1 = 0,
            k2 = 0;
        for (let b = 0; b < NB; b++) {
            k1 += MZ.n1[b];
            k2 += MZ.n2[b];
        }
        const now = MZ.now,
            c = MZ.clickNow;
        $("mP").textContent = fx(now.P1) + " / " + fx(now.P2) + " / " + fx(now.Pblocked);
        $("mC").textContent = fx(c.c1) + " / " + fx(c.c2);
        $("mV").textContent = fx(MZ.vis.V) + (S.etaM < 100 || S.pd > 0 ? " (D₁ click V " + fx(MZ.clickV) + ")" : "");
        $("mVc").textContent = MZ.visE ? fx(MZ.visE.Vcond) + " (" + fx(1 - MZ.now.Pblocked) + " of photons pass)" : "no polarizer";
        $("mD").textContent = fx(MZ.wp.D) + " / " + fx(MZ.wp.P);
        const vd = MZ.vis.V * MZ.vis.V + MZ.wp.D * MZ.wp.D;
        $("mVD").textContent = fx(vd, 4) + (Math.abs(vd - 1) < 1e-9 ? " (pure: equality)" : " (< 1: mixed)");
        $("mG").textContent = fx(MZ.wp.guess);
        $("mO").textContent = fx(MZ.wp.overlap);
        $("mPur").textContent = fx(MZ.purity, 4);
        $("mVs").textContent = MZ.fit ? fx(MZ.fit.V) + " ± " + fx(MZ.fit.sd) + " (D₁ clicks; theory " + fx(MZ.clickV) + ")" : "send ≥ " + NB * 4 + " photons";
        $("mN").textContent = MZ.sent + " / " + fx(MZ.sent / NB, 1);
        $("mK").textContent = k1 + " / " + k2 + " / " + MZ.dark;
        stat(1, "N", String(MZ.sent), "Heralded photons");
        stat(2, "D₁", String(k1), "Clicks at D₁");
        stat(3, "D₂", String(k2), "Clicks at D₂");
        stat(4, "V", fx(MZ.vis.V), "Visibility (theory)");
        stat(5, "D", fx(MZ.wp.D), "Distinguishability");
        dSetup.update(`Mach–Zehnder with BS1 reflectance ${S.r1} %, marker rotation ${S.th}°, phase ${S.phi}°, ${MZ.polDeg == null ? "no polarizer" : "polarizer at " + MZ.polDeg + "°"}. Born probabilities: D1 ${fx(now.P1)}, D2 ${fx(now.P2)}, blocked ${fx(now.Pblocked)}. Clicks so far: D1 ${k1}, D2 ${k2}.`);
        dBuild.update(`Theory visibility ${fx(MZ.vis.V)}; after ${MZ.sent} photons the fitted D1 click visibility is ${MZ.fit ? fx(MZ.fit.V) + " ± " + fx(MZ.fit.sd) : "not yet available"} (theory ${fx(MZ.clickV)}).`);
        dVD.update(`V = ${fx(MZ.vis.V)}, D = ${fx(MZ.wp.D)}, V² + D² = ${fx(vd, 4)}.`);
        const last = MZ.record.slice(-10).map((e) => (e.p1 ? "D1" : e.p2 ? "D2" : e.d1 || e.d2 ? "dark" : "none")).join(", ");
        dRec.update(`Last ten photons: ${last || "none yet"}.`);
    }


    const ST = {};
    const histCanvas = UI.setupCanvas($("histCanvas"), {
        aspect: 2.6,
        minHeight: 260,
        maxHeight: 420,
        draw: drawHist
    });
    const rhoCanvas = UI.setupCanvas($("rhoCanvas"), {
        aspect: 1.25,
        minHeight: 260,
        draw: drawRho
    });
    const qCanvas = UI.setupCanvas($("qCanvas"), {
        aspect: 1.25,
        minHeight: 260,
        draw: drawQ
    });
    const dHist = UI.describeCanvas($("histCanvas"), "Count histogram.", {
        label: "Photon-count histogram, sampled and predicted"
    });
    const dRho = UI.describeCanvas($("rhoCanvas"), "Density matrix magnitudes.", {
        label: "Fock-basis density matrix after loss"
    });
    const dQ = UI.describeCanvas($("qCanvas"), "Mandel Q and g2 versus efficiency.", {
        label: "Mandel Q and g²(0) against detector efficiency"
    });

    function statsRefresh(S) {
        const isFock = S.st === "fock";
        setDisabled("nbarGroup", isFock);
        setDisabled("nfGroup", !isFock);
        const N = Math.max(S.nc, isFock ? S.nf : 0);
        if (isFock && S.nf > S.nc) {
            suppress = true;
            $("ncS").value = String(S.nf);
            suppress = false;
        }
        const par = isFock ? {
            n: S.nf
        } : {
            nbar: S.nbar,
            phase: 0
        };
        const state = QO.makeState(S.st, par, N);
        const eta = S.etaS / 100,
            dark = S.dk;
        const rhoL = QO.lossChannel(state.rho, eta);
        const pLoss = QO.numberDistribution(rhoL);
        const pDet = QO.detectedDistribution(state.p, eta, dark);
        const shots = Math.round(Math.pow(10, S.sh));
        const sample = QO.sampleDetections(state.p, {
            eta,
            dark
        }, shots, core.createRng(S.seedS));
        const chk = QO.checkDensity(rhoL, {
            skipEigen: rhoL.n > 81
        });
        Object.assign(ST, {
            S,
            state,
            rhoL,
            pLoss,
            pDet,
            shots,
            sample,
            chk,
            eta,
            dark,
            mState: QO.momentsOf(state.p),
            mDet: QO.momentsOf(pDet),
            aDet: QO.detectedMomentsAnalytic(state.exact, eta, dark),
            chi: QO.chiSquare(sample.hist, pDet, shots)
        });
        const w = [];
        if (state.truncation > 1e-6) w.push(`Truncation: the basis |0⟩…|${N}⟩ discards P(n &gt; ${N}) = ${fp(state.truncation)} of the exact state, so the moments below are biased (⟨n⟩ = ${fx(ST.mState.mean)} instead of ${fx(state.exact.mean)}). Increase N.`);
        if (S.st === "squeezed" && S.nbar === 0) w.push("n̄ = 0 is the vacuum: g²(0) and Q are undefined.");
        if (isFock && S.nf === 0 && dark === 0) w.push("The vacuum |0⟩ gives no counts at all without dark counts: ⟨m⟩ = 0, so Q and g²(0) are undefined.");
        warn($("stWarn"), w);
        histCanvas.redraw();
        rhoCanvas.redraw();
        qCanvas.redraw();
        statsReadouts();
    }

    function histRange() {
        const {
            pDet,
            sample,
            state
        } = ST;

        const q999 = (p) => {
            let c = 0;
            for (let i = 0; i < p.length; i++) {
                c += p[i];
                if (c >= 0.999) return i;
            }
            return p.length - 1;
        };
        let mMax = Math.max(4, q999(pDet), q999(state.p));
        void sample;
        return Math.min(mMax + 1, 160);
    }

    function drawHist(ctx, w, h) {
        if (!ST.state) return;
        const {
            pDet,
            sample,
            state,
            shots,
            mDet
        } = ST;
        const mMax = histRange();
        let yMax = 0;
        for (let i = 0; i <= mMax; i++) yMax = Math.max(yMax, pDet[i] || 0, (sample.hist[i] || 0) / shots, state.p[i] || 0);
        yMax = Math.min(1.05, yMax * 1.15 + 0.01);
        const xs = [],
            ideal = [],
            pois = [];
        for (let i = 0; i <= mMax; i++) {
            xs.push(i - 0.5, i + 0.5);
            const v = state.p[i] || 0;
            ideal.push(v, v);
        }
        const px = [],
            py = [];
        for (let i = 0; i <= mMax; i++) {
            px.push(i);
            py.push(mDet.mean > 0 ? Math.exp(-mDet.mean + i * Math.log(mDet.mean) - core.logGamma(i + 1)) : (i === 0 ? 1 : 0));
        }
        const axes = {
            x: {
                min: -0.7,
                max: mMax + 0.7,
                label: "counts m (or photon number n)"
            },
            y: {
                min: 0,
                max: yMax,
                label: "probability"
            }
        };
        const m = UI.plot(ctx, {
            x: 0,
            y: 0,
            w,
            h
        }, Object.assign({
            series: []
        }, axes));

        const bw = Math.max(1, (m.xToPx(1) - m.xToPx(0)) * 0.72);
        ctx.fillStyle = "rgba(105, 245, 231, 0.42)";
        ctx.strokeStyle = PAL.series[0];
        ctx.lineWidth = 1;
        for (let i = 0; i <= mMax; i++) {
            const f = (sample.hist[i] || 0) / shots;
            if (!f) continue;
            const x0 = m.xToPx(i) - bw / 2,
                y0 = m.yToPx(f),
                y1 = m.yToPx(0);
            ctx.fillRect(x0, y0, bw, y1 - y0);
            ctx.strokeRect(x0 + 0.5, y0 + 0.5, bw - 1, y1 - y0 - 1);
        }
        UI.plot(ctx, {
            x: 0,
            y: 0,
            w,
            h
        }, Object.assign({}, axes, {
            background: false,
            series: [{
                    xs: [],
                    ys: [],
                    label: "sampled (bars), " + shots + " gates",
                    color: PAL.series[0],
                    width: 8
                },
                {
                    xs: [],
                    ys: [],
                    label: "predicted P(m) ± 1σ",
                    color: PAL.marker
                },
                {
                    xs,
                    ys: ideal,
                    label: "state p(n) before detector",
                    color: PAL.series[2],
                    dash: [7, 4]
                },
                {
                    xs: px,
                    ys: py,
                    label: "Poisson, same mean",
                    color: PAL.textMuted,
                    dash: [2, 3],
                    width: 1.5
                }
            ]
        }));

        ctx.save();
        ctx.beginPath();
        ctx.rect(m.plot.x, m.plot.y, m.plot.w, m.plot.h);
        ctx.clip();
        ctx.fillStyle = PAL.marker;
        ctx.strokeStyle = PAL.marker;
        ctx.lineWidth = 1.5;
        for (let i = 0; i <= mMax; i++) {
            const p = pDet[i] || 0;
            if (p < 1e-6) continue;
            const sd = Math.sqrt(p * (1 - p) / shots),
                x = m.xToPx(i);
            ctx.beginPath();
            ctx.moveTo(x, m.yToPx(Math.max(0, p - sd)));
            ctx.lineTo(x, m.yToPx(p + sd));
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x - 4, m.yToPx(p - sd));
            ctx.lineTo(x + 4, m.yToPx(p - sd));
            ctx.moveTo(x - 4, m.yToPx(p + sd));
            ctx.lineTo(x + 4, m.yToPx(p + sd));
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(x, m.yToPx(p), 3.5, 0, 2 * Math.PI);
            ctx.fill();
        }
        ctx.restore();
    }

    function drawRho(ctx, w, h) {
        if (!ST.rhoL) return;
        const R = ST.rhoL;
        let K = 2;
        for (let i = 0; i < R.n; i++)
            if (R.re[i * R.n + i] > 1e-4) K = Math.max(K, i + 1);
        K = Math.min(R.n, Math.max(4, K + 1), 40);
        let mx = 0;
        const data = new Float64Array(K * K);
        for (let i = 0; i < K; i++)
            for (let j = 0; j < K; j++) {
                const v = Math.hypot(R.re[i * R.n + j], R.im[i * R.n + j]);
                data[i * K + j] = v;
                mx = Math.max(mx, v);
            }
        for (let k = 0; k < data.length; k++) data[k] = Math.sqrt(data[k] / (mx || 1));
        ctx.fillStyle = PAL.background;
        ctx.fillRect(0, 0, w, h);
        const fs = 12,
            l = 44,
            t = 12,
            b = 40,
            cbw = 12,
            cbSpace = 58;
        const side = Math.max(40, Math.min(w - l - cbSpace - 8, h - t - b));
        const rect = {
            x: l,
            y: t,
            w: side,
            h: side
        };
        UI.imageFromArray(ctx, data, K, K, rect, "viridis", {
            min: 0,
            max: 1,
            origin: "upper"
        });
        ctx.strokeStyle = PAL.axis;
        ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);
        ctx.font = fs + "px " + PAL.font;
        ctx.fillStyle = PAL.textMuted;
        const step = K <= 10 ? 1 : K <= 20 ? 2 : 5;
        const cs = side / K;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        for (let i = 0; i < K; i += step) ctx.fillText(String(i), rect.x + (i + 0.5) * cs, rect.y + side + 3);
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        for (let i = 0; i < K; i += step) ctx.fillText(String(i), rect.x - 4, rect.y + (i + 0.5) * cs);
        ctx.fillStyle = PAL.text;
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText("column n", rect.x + side / 2, rect.y + side + b - 2);
        ctx.save();
        ctx.translate(10, rect.y + side / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textBaseline = "top";
        ctx.fillText("row m", 0, -6);
        ctx.restore();
        UI.drawColorbar(ctx, {
            x: rect.x + side + 30,
            y: rect.y,
            w: cbw,
            h: side
        }, "viridis", {
            min: 0,
            max: 1,
            label: "√(|ρ|/max)",
            ticks: Object.assign([0, 0.5, 1], {
                step: 0.5
            })
        });
    }

    function drawQ(ctx, w, h) {
        if (!ST.state) return;
        const ex = ST.state.exact,
            n = 101;
        const xs = new Float64Array(n),
            q = new Float64Array(n),
            g = new Float64Array(n);
        for (let i = 0; i < n; i++) {
            const e = Math.max(1e-6, i / (n - 1));
            xs[i] = i / (n - 1);
            const a = QO.detectedMomentsAnalytic(ex, e, ST.dark);
            q[i] = a.Q;
            g[i] = a.g2;
        }
        let lo = Infinity,
            hi = -Infinity;
        for (let i = 0; i < n; i++)
            for (const v of [q[i], g[i]])
                if (Number.isFinite(v)) {
                    lo = Math.min(lo, v);
                    hi = Math.max(hi, v);
                }
        if (!Number.isFinite(lo)) {
            lo = -1;
            hi = 2;
        }
        lo = Math.min(lo, 0, -0.1);
        hi = Math.max(hi, 1.2);
        const pad = 0.08 * (hi - lo);
        const m = UI.plot(ctx, {
            x: 0,
            y: 0,
            w,
            h
        }, {
            x: {
                min: 0,
                max: 1,
                label: "detector efficiency η"
            },
            y: {
                min: lo - pad,
                max: hi + pad,
                label: "detected value"
            },
            series: [{
                    xs,
                    ys: q,
                    label: "Mandel Q",
                    color: PAL.series[0]
                },
                {
                    xs,
                    ys: g,
                    label: "g²(0)",
                    color: PAL.series[2],
                    dash: [7, 4]
                }
            ],
            hlines: [{
                y: 0,
                label: "",
                color: PAL.gridStrong
            }],
            legendPosition: "left"
        });
        const e = ST.eta;
        const a = QO.detectedMomentsAnalytic(ex, e, ST.dark);
        for (const [v, col] of [
                [a.Q, PAL.series[0]],
                [a.g2, PAL.series[2]]
            ]) {
            if (!Number.isFinite(v)) continue;
            ctx.fillStyle = col;
            ctx.beginPath();
            ctx.arc(m.xToPx(e), m.yToPx(v), 5, 0, 2 * Math.PI);
            ctx.fill();
        }
        const sQ = ST.sample.mean > 0 ? ST.sample.variance / ST.sample.mean - 1 : NaN;
        if (Number.isFinite(sQ)) {
            const x = m.xToPx(e),
                y = m.yToPx(sQ);
            ctx.strokeStyle = PAL.text;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x - 6, y - 6);
            ctx.lineTo(x + 6, y + 6);
            ctx.moveTo(x - 6, y + 6);
            ctx.lineTo(x + 6, y - 6);
            ctx.stroke();
        }
    }

    function statsReadouts() {
        const {
            state,
            mState,
            mDet,
            aDet,
            sample,
            chk,
            chi,
            shots,
            pDet
        } = ST;
        const ex = state.exact;
        $("sM").textContent = fx(mState.mean, 4) + " / " + fx(mState.variance, 4);
        $("sMx").textContent = fx(ex.mean, 4) + " / " + fx(ex.variance, 4);
        $("sQ").textContent = fx(mState.Q, 4) + " / " + fx(mState.g2, 4) + "  (exact " + fx(ex.Q, 3) + " / " + fx(ex.g2, 3) + ")";
        $("sT").textContent = state.truncation < 1e-300 ? "0" : fp(state.truncation, 3);
        $("sChk").textContent = fx(chk.trace, 12) + ", " + fp(chk.hermiticityError, 2) + ", " + (Number.isFinite(chk.minEigenvalue) ? fp(chk.minEigenvalue, 2) : "skipped (N > 80)") + ", " + fx(chk.purity, 4);
        $("sDm").textContent = fx(mDet.mean, 4) + " / " + fx(mDet.variance, 4) + "  (analytic " + fx(aDet.mean, 3) + " / " + fx(aDet.variance, 3) + ")";
        $("sDq").textContent = fx(mDet.Q, 4) + " / " + fx(mDet.g2, 4);
        const sQ = sample.mean > 0 ? sample.variance / sample.mean - 1 : NaN;
        const sG = sample.mean > 0 ? (sample.variance + sample.mean * sample.mean - sample.mean) / (sample.mean * sample.mean) : NaN;
        $("sS").textContent = fx(sample.mean, 4) + " ± " + fx(sample.seMean, 4) + " / " + fx(sample.variance, 4);
        $("sSq").textContent = fx(sQ, 3) + " / " + fx(sG, 3);
        $("sChi").textContent = fx(chi.chi2, 1) + " / " + chi.dof + (chi.chi2 > chi.dof + 4 * Math.sqrt(2 * chi.dof) ? " (unusually large)" : " (consistent)");
        $("histBadge").textContent = {
            coherent: "coherent",
            thermal: "thermal",
            fock: "Fock |" + ST.S.nf + "⟩",
            squeezed: "squeezed vacuum"
        } [ST.S.st] + ", η = " + ST.S.etaS + " %";

        const tb = document.querySelector("#stTable tbody");
        const rows = [];
        const mMax = Math.min(histRange(), 15);
        for (let i = 0; i <= mMax; i++) {
            const p = pDet[i] || 0,
                f = (sample.hist[i] || 0) / shots;
            rows.push(`<tr><td>${i}</td><td>${fx(state.p[i] || 0, 5)}</td><td>${fx(p, 5)}</td><td>${fx(f, 5)}</td><td>${fx(Math.sqrt(p * (1 - p) / shots), 5)}</td></tr>`);
        }
        tb.innerHTML = rows.join("");
        stat(1, "⟨m⟩", fx(mDet.mean, 3), "Mean detected counts");
        stat(2, "σ²", fx(mDet.variance, 3), "Variance of counts");
        stat(3, "Q", fx(mDet.Q, 3), "Mandel Q (detected)");
        stat(4, "g²", fx(mDet.g2, 3), "g²(0) (detected)");
        stat(5, "ε", state.truncation < 1e-300 ? "0" : fp(state.truncation, 2), "Truncation error");
        dHist.update(`Detected mean ${fx(mDet.mean, 3)}, variance ${fx(mDet.variance, 3)}, Q ${fx(mDet.Q, 3)}. Sampled from ${shots} gates: mean ${fx(sample.mean, 3)} ± ${fx(sample.seMean, 3)}, chi-square ${fx(chi.chi2, 1)} for ${chi.dof} degrees of freedom.`);
        dRho.update(`Density matrix after loss, trace ${fx(chk.trace, 6)}, purity ${fx(chk.purity, 3)}.`);
        dQ.update(`At efficiency ${ST.S.etaS} %: Q = ${fx(mDet.Q, 3)}, g2(0) = ${fx(mDet.g2, 3)}; sampled Q = ${fx(sQ, 3)}.`);
    }


    const HB = {
        key: "",
        res: null,
        timer: 0
    };
    const g2Canvas = UI.setupCanvas($("g2Canvas"), {
        aspect: 2.5,
        minHeight: 280,
        maxHeight: 440,
        draw: drawG2
    });
    const streamCanvas = UI.setupCanvas($("streamCanvas"), {
        aspect: 4.2,
        minHeight: 180,
        maxHeight: 260,
        draw: drawStream
    });
    const dG2 = UI.describeCanvas($("g2Canvas"), "g2 histogram.", {
        label: "Coincidence histogram normalised to g²(τ)"
    });
    const dStream = UI.describeCanvas($("streamCanvas"), "Time tags.", {
        label: "Time-tag streams of the two detectors"
    });

    function timeUnit(W) {
        if (W < 2e-6) return {
            f: 1e9,
            u: "ns"
        };
        if (W < 2e-3) return {
            f: 1e6,
            u: "µs"
        };
        return {
            f: 1e3,
            u: "ms"
        };
    }

    function hbtParams(S) {
        return {
            kind: S.src,
            line: S.line,
            tau0: Math.pow(10, S.t0) * 1e-9,
            rate: Math.pow(10, S.rate),
            dark: S.dark <= 0 ? 0 : Math.pow(10, S.dark),
            eta: S.etaH / 100,
            jitter: S.jit <= -2 ? 0 : Math.pow(10, S.jit) * 1e-9,
            T: Math.pow(10, S.tacq),
            seed: S.seedH,
            maxSteps: S.line === "gauss" ? 2e6 : 3e6,
            maxEvents: 4e6
        };
    }

    function hbtRefresh(S) {
        setDisabled("lineGroup", S.src !== "thermal");
        setDisabled("etaHGroup", S.src !== "emitter");
        $("t0Label").textContent = S.src === "thermal" ? "Coherence time τc (ns, log)" : S.src === "emitter" ? "Antibunching time τ₀ (ns, log)" : "Plot time scale τ₀ (ns, log; no correlation)";
        $("g2Badge").textContent = {
            coherent: "coherent",
            thermal: "thermal, " + (S.line === "gauss" ? "Gaussian" : "Lorentzian"),
            emitter: "single emitter"
        } [S.src];
        const P = hbtParams(S);
        const key = JSON.stringify(P);
        if (key === HB.key && HB.res) {
            hbtDraw();
            return;
        }
        HB.key = key;
        $("hbStatus").textContent = "Acquiring seeded time tags…";
        clearTimeout(HB.timer);
        HB.timer = setTimeout(() => {
            const t0 = performance.now();
            const sim = QO.simulateHBT(P);
            const W = Math.max(6 * P.tau0, 5 * Math.SQRT2 * P.jitter);
            const hist = QO.coincidenceHistogram(sim.t1, sim.t2, {
                binWidth: 2 * W / 80,
                range: W,
                T: sim.T
            });

            const sig = P.kind === "emitter" && sim.info.saturated ? sim.info.Remit * P.eta / 2 : P.rate;
            const rho1 = sig > 0 ? sig / (sig + P.dark) : 0,
                rho = rho1;
            const par = {
                tau0: P.tau0,
                line: P.line,
                jitter: P.jitter,
                binWidth: hist.binWidth,
                rho1: rho,
                rho2: rho
            };
            const pred = Float64Array.from(hist.centers, (t) => QO.g2Measured(P.kind, t, par));
            const n = 401,
                fxs = new Float64Array(n),
                fys = new Float64Array(n),
                fid = new Float64Array(n);
            for (let i = 0; i < n; i++) {
                const t = -W + 2 * W * i / (n - 1);
                fxs[i] = t;
                fys[i] = QO.g2Measured(P.kind, t, Object.assign({}, par, {
                    binWidth: 0
                }));
                fid[i] = QO.g2Ideal(P.kind, t, par);
            }
            HB.res = {
                P,
                sim,
                hist,
                W,
                pred,
                fine: {
                    xs: fxs,
                    ys: fys,
                    ideal: fid
                },
                rho: rho1,
                sig,
                ms: performance.now() - t0
            };
            $("hbStatus").textContent = `Acquired ${sim.t1.length + sim.t2.length} time tags in ${Math.round(HB.res.ms)} ms (seed ${P.seed}).`;
            hbtDraw();
        }, 60);
    }

    function hbtDraw() {
        const R = HB.res;
        if (!R) return;
        g2Canvas.redraw();
        streamCanvas.redraw();
        const {
            P,
            sim,
            hist,
            pred
        } = R;
        const mid = hist.g2.length / 2;
        const g0 = 0.5 * (hist.g2[mid - 1] + hist.g2[mid]),
            e0 = 0.5 * Math.hypot(hist.err[mid - 1], hist.err[mid]);
        const p0 = 0.5 * (pred[mid - 1] + pred[mid]);
        const tu = timeUnit(R.W);
        $("hG").textContent = fx(g0) + " ± " + fx(e0);
        $("hGp").textContent = fx(p0) + " (bin-averaged; " + fx(QO.g2Measured(P.kind, 0, {
            tau0: P.tau0,
            line: P.line,
            jitter: P.jitter,
            rho1: R.rho,
            rho2: R.rho
        })) + " at τ = 0)";
        $("hGi").textContent = fx(QO.g2Ideal(P.kind, 0, P));
        $("hN").textContent = sim.t1.length + " / " + sim.t2.length;
        $("hRho").textContent = fx(R.rho, 4);
        $("hBin").textContent = fsi(hist.binWidth, "s") + " / " + fsi(R.W, "s");
        $("hAcc").textContent = fx(hist.expectedAccidental, 1) + " (relative error ≈ " + fx(1 / Math.sqrt(Math.max(hist.expectedAccidental, 1e-9)), 3) + ")";
        $("hT").textContent = fsi(sim.T, "s") + (sim.truncated ? " (shortened from " + fsi(P.T, "s") + ")" : "");
        $("hX").textContent = fp(R.sig * P.tau0, 3);
        $("hEm").textContent = P.kind === "emitter" ? fsi(sim.info.gammaP, "s⁻¹") + " / " + fsi(sim.info.gammaR, "s⁻¹") + " (emission " + fsi(sim.info.Remit, "Hz") + ")" : "—";
        const w = [];
        if (sim.truncated) w.push(`Browser budget: the acquisition was shortened to T = ${fsi(sim.T, "s")} (at most 3 million field steps of τc/10, 4 million time tags or 12 million emitter photons). Raise the rate or accept larger error bars.`);
        if (P.kind === "emitter" && sim.info.saturated) w.push(`Saturated emitter: ${fsi(2 * P.rate / P.eta, "Hz")} emissions would be needed, but at most 1/(4τ₀) = ${fsi(sim.info.Rmax, "Hz")} is possible with τ₀ = ${fsi(P.tau0, "s")}. The emission rate was capped, so the detected rate is lower than set.`);
        if (P.rate > 1e7) w.push("Count rates above about 10 Mcps would saturate real single-photon detectors; dead time is not modelled.");
        if (hist.expectedAccidental < 30) w.push(`Only ${fx(hist.expectedAccidental, 1)} accidental coincidences per bin: the histogram is dominated by Poisson noise. Increase T or the rate.`);
        if (P.kind === "thermal" && P.rate * P.tau0 < 0.003) w.push("Fewer than 0.003 counts per coherence time: bunching is present but needs very long acquisitions to resolve.");
        warn($("hbWarn"), w);
        stat(1, "g²", fx(g0), "g²(0) measured");
        stat(2, "±", fx(e0), "Statistical error (1σ)");
        stat(3, "th", fx(p0), "g²(0) predicted (bin)");
        stat(4, "N₁", String(sim.t1.length), "Counts at D₁");
        stat(5, "N₂", String(sim.t2.length), "Counts at D₂");
        dG2.update(`Measured g2(0) = ${fx(g0)} ± ${fx(e0)}; prediction ${fx(p0)}; ideal ${fx(QO.g2Ideal(P.kind, 0, P))}. Histogram range ±${fx(R.W * tu.f, 3)} ${tu.u} in ${hist.g2.length} bins.`);
        dStream.update(`${sim.t1.length} counts at D1 and ${sim.t2.length} at D2 over ${fsi(sim.T, "s")}.`);
    }

    function drawG2(ctx, w, h) {
        const R = HB.res;
        if (!R) {
            ctx.fillStyle = PAL.background;
            ctx.fillRect(0, 0, w, h);
            return;
        }
        const tu = timeUnit(R.W),
            f = tu.f;
        const {
            hist
        } = R;
        let lo = 0,
            hi = 1.2;
        for (let i = 0; i < hist.g2.length; i++)
            if (Number.isFinite(hist.g2[i])) {
                hi = Math.max(hi, hist.g2[i] + hist.err[i]);
                lo = Math.min(lo, hist.g2[i] - hist.err[i]);
            }
        for (const v of R.fine.ideal) hi = Math.max(hi, v);
        hi = Math.min(hi + 0.28 * (hi - Math.min(lo, 0)), 7);
        const pts = {
            xs: Float64Array.from(hist.centers, (t) => t * f),
            ys: hist.g2
        };
        const m = UI.plot(ctx, {
            x: 0,
            y: 0,
            w,
            h
        }, {
            x: {
                min: -R.W * f,
                max: R.W * f,
                label: "delay τ = t₂ − t₁",
                unit: tu.u
            },
            y: {
                min: Math.min(lo, 0),
                max: hi,
                label: "g²(τ)"
            },
            series: [{
                    xs: Float64Array.from(R.fine.xs, (t) => t * f),
                    ys: R.fine.ys,
                    label: "prediction (jitter, dark, bin)",
                    color: PAL.series[1]
                },
                {
                    xs: Float64Array.from(R.fine.xs, (t) => t * f),
                    ys: R.fine.ideal,
                    label: "ideal source",
                    color: PAL.series[2],
                    dash: [7, 4]
                },
                Object.assign({
                    label: "simulated ± 1σ",
                    color: PAL.series[0],
                    pointsOnly: true,
                    points: true,
                    pointRadius: 2.6
                }, pts)
            ],
            hlines: [{
                y: 1,
                color: PAL.gridStrong
            }]
        });
        ctx.save();
        ctx.beginPath();
        ctx.rect(m.plot.x, m.plot.y, m.plot.w, m.plot.h);
        ctx.clip();
        ctx.strokeStyle = PAL.series[0];
        ctx.lineWidth = 1;
        for (let i = 0; i < hist.g2.length; i++) {
            const x = m.xToPx(hist.centers[i] * f);
            ctx.beginPath();
            ctx.moveTo(x, m.yToPx(hist.g2[i] - hist.err[i]));
            ctx.lineTo(x, m.yToPx(hist.g2[i] + hist.err[i]));
            ctx.stroke();
        }
        ctx.restore();
    }

    function drawStream(ctx, w, h) {
        ctx.fillStyle = PAL.background;
        ctx.fillRect(0, 0, w, h);
        const R = HB.res;
        if (!R) return;
        const {
            P,
            sim
        } = R;
        let Tw;
        if (P.kind === "thermal") Tw = Math.min(sim.T, 40 * P.tau0);
        else if (P.kind === "emitter") {
            const e = sim.info.emitted || [];
            Tw = e.length ? e[Math.min(59, e.length - 1)] * 1.02 : sim.T;
        } else Tw = Math.min(sim.T, 40 / Math.max(P.rate + P.dark, 1));
        const tu = timeUnit(Tw / 2),
            f = tu.f;
        const m = UI.plot(ctx, {
            x: 0,
            y: 0,
            w,
            h
        }, {
            x: {
                min: 0,
                max: Tw * f,
                label: "time t",
                unit: tu.u
            },
            y: {
                min: 0,
                max: 3,
                ticks: Object.assign([], {
                    step: 1
                })
            },
            series: [],
            margin: {
                l: 38
            }
        });
        const lane = (y0, y1, arr, col, label) => {
            ctx.fillStyle = PAL.text;
            ctx.font = "12px " + PAL.font;
            ctx.textAlign = "right";
            ctx.textBaseline = "middle";
            ctx.fillText(label, m.plot.x - 4, (m.yToPx(y0) + m.yToPx(y1)) / 2);
            ctx.strokeStyle = col;
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            for (let i = 0; i < arr.length && arr[i] <= Tw; i++) {
                if (arr[i] < 0) continue;
                const x = m.xToPx(arr[i] * f);
                ctx.moveTo(x, m.yToPx(y0));
                ctx.lineTo(x, m.yToPx(y1));
            }
            ctx.stroke();
        };
        lane(2.2, 2.9, sim.t1, PAL.series[0], "D₁");
        lane(1.45, 2.15, sim.t2, PAL.series[1], "D₂");
        ctx.save();
        ctx.beginPath();
        ctx.rect(m.plot.x, m.plot.y, m.plot.w, m.plot.h);
        ctx.clip();
        if (P.kind === "thermal" && sim.info.intensity) {
            const {
                dt,
                I
            } = sim.info.intensity;
            let Imax = 4;
            ctx.strokeStyle = PAL.textMuted;
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            for (let i = 0; i < I.length && i * dt <= Tw; i++) {
                const x = m.xToPx((i + 0.5) * dt * f),
                    y = m.yToPx(0.05 + 1.3 * Math.min(I[i], Imax) / Imax);
                if (i) ctx.lineTo(x, y);
                else ctx.moveTo(x, y);
            }
            ctx.stroke();
            ctx.fillStyle = PAL.textMuted;
            ctx.textAlign = "left";
            ctx.textBaseline = "top";
            ctx.font = "12px " + PAL.font;
            ctx.fillText("|E(t)|²/⟨|E|²⟩ (0–4)", m.plot.x + 4, m.yToPx(1.4));
        } else if (P.kind === "emitter") {
            ctx.strokeStyle = PAL.series[2];
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            for (const t of sim.info.emitted || []) {
                if (t > Tw) break;
                const x = m.xToPx(t * f);
                ctx.moveTo(x, m.yToPx(0.2));
                ctx.lineTo(x, m.yToPx(0.9));
            }
            ctx.stroke();
            ctx.fillStyle = PAL.series[2];
            ctx.textAlign = "left";
            ctx.textBaseline = "top";
            ctx.font = "12px " + PAL.font;
            ctx.fillText("emission times (most photons are not detected, η = " + Math.round(P.eta * 100) + " %)", m.plot.x + 4, m.yToPx(1.35));
        } else {
            ctx.fillStyle = PAL.textMuted;
            ctx.textAlign = "left";
            ctx.textBaseline = "top";
            ctx.font = "12px " + PAL.font;
            ctx.fillText("constant intensity: independent Poisson clicks", m.plot.x + 4, m.yToPx(1.2));
        }
        ctx.restore();
    }


    UI.addExportBar($("mzExport"), {
        name: "quantum-optics-mach-zehnder",
        url,
        getState: () => Object.assign({
            experiment: "mz"
        }, ctl.get()),
        getCSV: () => ({
            headers: ["phi (deg)", "photons", "D1 clicks", "D2 clicks", "P(D1) Born", "P(D2) Born", "P(click D1) theory", "P(click D2) theory"],
            rows: Array.from({
                length: NB
            }, (_, b) => {
                const pr = MZ.probsBin[b],
                    c = QO.mzClickProbabilities(pr, MZ.det);
                return [binPhi(b) / RAD, MZ.trials[b], MZ.n1[b], MZ.n2[b], pr.P1, pr.P2, c.c1, c.c2];
            })
        }),
        canvases: [$("mzCanvas"), $("buildCanvas"), $("vdCanvas"), $("recCanvas")],
        caption: () => {
            const S = ctl.get();
            return `Single-photon MZ: R1 = ${S.r1} %, θ = ${S.th}°, γ = ${S.gam} %, polarizer ${S.pol}, η = ${S.etaM} %, pd = ${S.pd} %, ${MZ.sent} photons, seed ${S.seedM}`;
        }
    });
    UI.addExportBar($("stExport"), {
        name: "quantum-optics-photon-statistics",
        url,
        getState: () => Object.assign({
            experiment: "stats"
        }, ctl.get()),
        getCSV: () => {
            const L = Math.max(ST.pDet.length, ST.sample.hist.length, ST.state.p.length);
            return {
                headers: ["m", "p(n=m) state", "P(m) detected", "sampled count", "sampled fraction"],
                rows: Array.from({
                    length: L
                }, (_, i) => [i, ST.state.p[i] || 0, ST.pDet[i] || 0, ST.sample.hist[i] || 0, (ST.sample.hist[i] || 0) / ST.shots])
            };
        },
        canvases: [$("histCanvas"), $("rhoCanvas"), $("qCanvas")],
        caption: () => {
            const S = ctl.get();
            return `${S.st} state, ${S.st === "fock" ? "n = " + S.nf : "n̄ = " + S.nbar}, N = ${S.nc}, η = ${S.etaS} %, d = ${S.dk}, ${Math.round(Math.pow(10, S.sh))} gates, seed ${S.seedS}`;
        }
    });
    UI.addExportBar($("hbExport"), {
        name: "quantum-optics-hbt",
        url,
        getState: () => Object.assign({
            experiment: "hbt"
        }, ctl.get()),
        getCSV: () => {
            const R = HB.res;
            if (!R) return {
                headers: [],
                rows: []
            };
            return {
                headers: ["tau (s)", "coincidences", "g2 measured", "g2 1-sigma", "g2 predicted (bin)", "g2 ideal"],
                rows: Array.from(R.hist.centers, (t, i) => [t, R.hist.counts[i], R.hist.g2[i], R.hist.err[i], R.pred[i], QO.g2Ideal(R.P.kind, t, R.P)])
            };
        },
        canvases: [$("g2Canvas"), $("streamCanvas")],
        caption: () => {
            const R = HB.res;
            if (!R) return "";
            const P = R.P;
            return `HBT ${P.kind}${P.kind === "thermal" ? " (" + P.line + ")" : ""}: τ0 = ${fsi(P.tau0, "s")}, R = ${fsi(P.rate, "Hz")}, dark = ${fsi(P.dark, "Hz")}, σ = ${fsi(P.jitter, "s")}, T = ${fsi(R.sim.T, "s")}, seed ${P.seed}`;
        }
    });


    refresh();
    url.ready.then(() => {
        refresh();
        if (!reduced && ctl.get().exp === "mz") mzLoop.start();
    });
})();