"use strict";

/*
 * Laser cavity simulator UI.
 * Physics lives in ../shared/optics/laserCavity.js (four-level rate equations,
 * fixed-step RK4 in physical time, pump sweep, relaxation analysis, passive-cavity
 * mode numbers). This file converts UI units, advances the model, and draws.
 * Atom and photon dots are an illustrative view of the model state (N, q).
 */
(function() {
    const UI = window.OpticsUI;
    const core = window.OpticsModels.core;
    const model = window.OpticsModels.laserCavity;
    const PAL = UI.CANVAS_PALETTE;
    const $ = (id) => document.getElementById(id);
    const fmt = (v, unit, d) => core.formatSI(v, unit, d == null ? 3 : d);

    const PUMP_PHOTON_ENERGY = model.H * model.C / model.DEFAULTS.pumpWavelength;
    const COLORS = {
        inv: "#f187c8",
        q: "#69f5e7",
        out: "#7ee787",
        gain: "#a78bfa",
        loss: "#ff9f6b",
        analytic: "#f8d477",
        sweep: "#69f5e7",
        mirror1: "#8ab4ff",
        mirror2: "#a78bfa",
        beam: "239, 68, 68"
    };

    // ------------------------------------------------------------------ elements
    const sliders = {
        pump: $("pumpSlider"),
        R2: $("reflectivitySlider"),
        L: $("lengthSlider"),
        lg: $("gainLengthSlider"),
        alpha: $("lossSlider")
    };
    const couplingSelect = $("couplingSelect");
    const speedSelect = $("speedSelect");
    const showEnergyLevels = $("showEnergyLevels");
    const logPhotons = $("logPhotons");
    const logLI = $("logLI");
    const startStopBtn = $("startStopBtn");
    const stepBtn = $("stepBtn");
    const resetBtn = $("resetBtn");
    const sweepBtn = $("sweepBtn");
    const sweepStatus = $("sweepStatus");
    const presetNote = $("presetNote");
    const levelsPanel = $("levelsPanel");
    const cavityPanel = $("cavityPanel");
    const ro = (id) => $(id);

    // ------------------------------------------------------------------ parameters
    // Exact parameter values (SI). Sliders display them; presets may set values finer than a
    // slider step so that "At threshold" is exactly at threshold.
    const cavity = {
        pumpPower: 0, // absorbed pump power [W]
        R2: 0.95,
        L: 0.10,
        gainLength: 0.05,
        alpha: 0.2,
        outputCoupling: "transmission"
    };
    let activePreset = null;

    function getParams() {
        return model.withDefaults({
            R2: cavity.R2,
            L: cavity.L,
            gainLength: Math.min(cavity.gainLength, cavity.L),
            alpha: cavity.alpha,
            outputCoupling: cavity.outputCoupling,
            pumpRate: cavity.pumpPower / PUMP_PHOTON_ENERGY
        });
    }

    let params = getParams();
    let derivedParams = model.derived(params);

    function refreshModel() {
        params = getParams();
        derivedParams = model.derived(params);
    }

    // ------------------------------------------------------------------ simulation state
    let simTime = 0; // s
    let state = [0, 0]; // [N, q]
    const HISTORY_BINS = 480;
    let history = []; // {t, N, g, q (bin peak), pOut (bin peak)}
    let binPeakQ = 0;
    let binEnd = 0;
    let peakTrack = {
        a: NaN,
        b: NaN,
        times: []
    }; // full-resolution spike detection
    let cursorT = null; // shared time cursor (s)
    let qSteady = 0;

    const speedFactor = () => (+speedSelect.value) * 1e-6; // simulated seconds per wall second
    const plotWindow = () => 5 * speedFactor(); // 5 s of wall-clock time
    const binWidth = () => plotWindow() / HISTORY_BINS;

    function advance(duration) {
        const dt = model.suggestedTimeStep(params);
        const steps = Math.min(Math.ceil(duration / dt), 400000);
        if (steps <= 0) return;
        const h = duration / steps;
        const pk = peakTrack;
        const qMin = Math.max(1e3, qSteady * (1 + 1e-5));
        for (let i = 0; i < steps; i++) {
            state = model.rk4Step(state, h, derivedParams);
            simTime += h;
            const q = state[1];
            if (q > binPeakQ) binPeakQ = q;
            if (pk.b > pk.a && pk.b >= q && pk.b > qMin) {
                pk.times.push(simTime - h);
                if (pk.times.length > 4) pk.times.shift();
            }
            pk.a = pk.b;
            pk.b = q;
            if (simTime >= binEnd) {
                pushSample(binPeakQ);
                binPeakQ = 0;
                binEnd = simTime + binWidth();
            }
        }
    }

    function pushSample(qPeak) {
        const pw = model.powers(params, qPeak);
        history.push({
            t: simTime,
            N: state[0],
            g: model.gainFromInversion(params, state[0]),
            q: qPeak,
            pCirc: pw.circulating,
            pOut: pw.output
        });
        const tMin = simTime - plotWindow();
        while (history.length && history[0].t < tMin) history.shift();
    }

    function resetState() {
        simTime = 0;
        state = [0, 0];
        history = [];
        binPeakQ = 0;
        binEnd = binWidth();
        peakTrack = {
            a: NaN,
            b: NaN,
            times: []
        };
        photons = [];
        sparks = [];
        pushSample(0);
    }

    // ------------------------------------------------------------------ formatting
    function formatCount(q) {
        if (!Number.isFinite(q)) return "—";
        if (q < 1000) return q.toFixed(q < 10 ? 2 : 0);
        const e = Math.floor(Math.log10(q));
        return (q / Math.pow(10, e)).toFixed(2) + "×10" + superscript(e);
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

    /** Pick a display unit for powers up to pMax. */
    function powerUnit(pMax) {
        if (pMax >= 1) return {
            s: 1,
            u: "W"
        };
        if (pMax >= 1e-3) return {
            s: 1e3,
            u: "mW"
        };
        if (pMax >= 1e-6) return {
            s: 1e6,
            u: "µW"
        };
        return {
            s: 1e9,
            u: "nW"
        };
    }

    // ------------------------------------------------------------------ controls
    UI.enhanceSlider(sliders.pump, {
        unit: "W"
    });
    UI.enhanceSlider(sliders.R2, {
        unit: "%"
    });
    UI.enhanceSlider(sliders.L, {
        unit: "cm"
    });
    UI.enhanceSlider(sliders.lg, {
        unit: "cm"
    });
    UI.enhanceSlider(sliders.alpha, {
        unit: "m⁻¹"
    });

    function syncSlidersFromState() {
        sliders.pump.value = cavity.pumpPower.toFixed(2);
        sliders.R2.value = (cavity.R2 * 100).toFixed(1);
        sliders.L.value = (cavity.L * 100).toFixed(1);
        sliders.lg.value = (cavity.gainLength * 100).toFixed(1);
        sliders.alpha.value = cavity.alpha.toFixed(2);
        couplingSelect.value = cavity.outputCoupling;
    }

    const presetButtons = Array.from(document.querySelectorAll(".preset-option[data-preset]"));

    function presetExpectation(name) {
        const p = model.preset(name, {
            outputCoupling: cavity.outputCoupling
        });
        const d = model.derived(p);
        const an = model.relaxationAnalytic(p);
        const pOut = model.analyticOutput(p);
        const r = d.pumpRatio;
        const delay = r > 1 ? p.tau * Math.log(r / (r - 1)) : Infinity;
        switch (name) {
            case "below":
                return "Expected: N rises to 0.6 N_th and the gain stays below the loss line. q stays at tens of photons (spontaneous emission only), and P_out is at the nanowatt level.";
            case "at":
                return "Expected: N creeps up to N_th over about 1 ms, with no spike. Near M = 1 the photon number grows very slowly, and the output stays orders of magnitude below the lasing level.";
            case "closed":
                return "Expected: threshold drops to " + fmt(d.thresholdPumpPower, "W") + ". The cavity lases (P_circ → " + fmt(model.powers(p, model.steadyState(p).q).circulating, "W") + "), but P_out = 0 exactly because T₂ = 0.";
            default:
                return "Expected: first spike near t ≈ τ ln(r/(r−1)) = " + fmt(delay, "s") + ", then damped relaxation oscillations at f_R ≈ " + fmt(an.frequency, "Hz") + " decaying as e^(−t/" + fmt(1 / an.gamma, "s") + "). Gain clamps at g_th and P_out → " + fmt(pOut, "W") + ".";
        }
    }

    function updatePresetButtons() {
        presetButtons.forEach((btn) => {
            const on = btn.dataset.preset === activePreset;
            btn.classList.toggle("active", on);
            btn.setAttribute("aria-pressed", on ? "true" : "false");
        });
        presetNote.textContent = activePreset ? presetExpectation(activePreset) : "Custom settings. Pick an experiment to see its expected observation.";
    }

    function applyPreset(name, opts) {
        // The pump is derived from the model's threshold for the preset cavity.
        const p = model.preset(name);
        cavity.R2 = p.R2;
        cavity.L = p.L;
        cavity.gainLength = p.gainLength;
        cavity.alpha = p.alpha;
        cavity.pumpPower = p.pumpRate * PUMP_PHOTON_ENERGY;
        activePreset = name;
        syncSlidersFromState();
        updatePresetButtons();
        resetSimulation();
        onCavityChanged();
        if (!opts || !opts.silentUrl) url.update();
    }

    presetButtons.forEach((btn) => btn.addEventListener("click", () => applyPreset(btn.dataset.preset)));

    const sliderKeys = {
        pump: (v) => {
            cavity.pumpPower = v;
        },
        R2: (v) => {
            cavity.R2 = v / 100;
        },
        L: (v) => {
            cavity.L = v / 100;
        },
        lg: (v) => {
            cavity.gainLength = v / 100;
        },
        alpha: (v) => {
            cavity.alpha = v;
        }
    };
    Object.entries(sliders).forEach(([key, el]) => {
        el.addEventListener("input", () => {
            sliderKeys[key](+el.value);
            activePreset = null;
            updatePresetButtons();
            updateDisplays();
            if (key === "pump") scheduleRelaxation();
            else onCavityChanged();
            if (!loop.isRunning()) drawAll();
            url.update();
        });
    });

    couplingSelect.addEventListener("change", () => {
        cavity.outputCoupling = couplingSelect.value;
        updateDisplays();
        onCavityChanged();
        updatePresetButtons();
        drawAll();
        url.update();
    });

    speedSelect.addEventListener("change", () => {
        history = history.filter((s) => s.t >= simTime - plotWindow());
        binEnd = simTime + binWidth();
        drawAll();
        url.update();
    });
    showEnergyLevels.addEventListener("change", () => {
        applyLevelsVisibility();
        url.update();
    });
    logPhotons.addEventListener("change", () => {
        photonPlot.redraw();
        url.update();
    });
    logLI.addEventListener("change", () => {
        liPlot.redraw();
        url.update();
    });

    function applyLevelsVisibility() {
        levelsPanel.hidden = !showEnergyLevels.checked;
        cavityPanel.classList.toggle("wide", !showEnergyLevels.checked);
        cavityPlot.resize();
        if (!levelsPanel.hidden) levelsPlot.resize();
    }

    // ------------------------------------------------------------------ readouts
    function updateDisplays() {
        refreshModel();
        const d = derivedParams;
        qSteady = model.steadyState(params).q;
        $("stat-pump").textContent = d.pumpRatio.toFixed(2) + " × P_th";
        $("stat-reflectivity").textContent = (cavity.R2 * 100).toFixed(1) + "%";
        $("stat-pout").textContent = fmt(model.powers(params, qSteady).output, "W");
        const regime = model.classify(params);
        const status = $("stat-status");
        status.textContent = regime === "below" ? "Below threshold" : regime === "at" ? "At threshold (±1 %)" : "Lasing";
        status.dataset.regime = regime;

        ro("ro-roundtrip").textContent = fmt(d.roundTripTime, "s");
        ro("ro-delta").textContent = d.logLossPerRoundTrip.toFixed(4);
        ro("ro-photon-lifetime").textContent = fmt(d.photonLifetime, "s");
        ro("ro-gth").textContent = d.thresholdGain.toFixed(3) + " m⁻¹";
        ro("ro-nth").textContent = formatCount(d.thresholdInversion);
        ro("ro-pth").textContent = fmt(d.thresholdPumpPower, "W");
        ro("ro-dt").textContent = fmt(model.suggestedTimeStep(params), "s");

        const modes = model.cavityModes(params);
        ro("ro-fsr").textContent = fmt(modes.fsr, "Hz");
        ro("ro-linewidth").textContent = fmt(modes.linewidth, "Hz");
        ro("ro-finesse").textContent = modes.finesse.toFixed(1);
        ro("ro-nmodes").textContent = "≈ " + modes.modesInGainBandwidth + " (120 GHz / FSR)";

        const b = model.photonBudget(params, {
            N: d.thresholdInversion,
            q: 1
        });
        const tot = b.output + b.backMirror + b.internal;
        ro("ro-shares").textContent = [b.output, b.backMirror, b.internal].map((x) => (100 * x / tot).toFixed(1) + " %").join(" / ");
        updateAnalysisReadouts();
        updateLiveReadouts();
    }

    function updateLiveReadouts() {
        const g = model.gainFromInversion(params, state[0]);
        const pw = model.powers(params, state[1]);
        ro("ro-time").textContent = fmt(simTime, "s");
        ro("ro-inv").textContent = (state[0] / derivedParams.thresholdInversion).toFixed(4);
        ro("ro-gain").textContent = g.toFixed(4) + " m⁻¹";
        ro("ro-m").textContent = model.roundTripMultiplier(params, g).toFixed(5);
        ro("ro-q").textContent = formatCount(state[1]);
        ro("ro-pcirc").textContent = fmt(pw.circulating, "W");
        ro("ro-pout").textContent = fmt(pw.output, "W");
        const pt = peakTrack.times;
        ro("ro-spacing").textContent = pt.length >= 2 ? fmt(pt[pt.length - 1] - pt[pt.length - 2], "s") : "no spikes yet";
    }

    function updateAnalysisReadouts() {
        const d = derivedParams;
        const eta = model.slopeEfficiency(params);
        const fit = sweep.fit;
        ro("ro-pth-cmp").textContent = fmt(d.thresholdPumpPower, "W", 4) + " / " + (fit ? fmt(fit.threshold, "W", 4) : "…");
        ro("ro-eta-cmp").textContent = eta.toFixed(4) + " / " + (fit ? fit.slope.toFixed(4) : "…");
        ro("ro-pout-ss").textContent = fmt(model.powers(params, qSteady).output, "W") + " (analytic " + fmt(model.analyticOutput(params), "W") + ")";
        const an = model.relaxationAnalytic(params);
        const rr = relax.result;
        if (!an) {
            ro("ro-fr-cmp").textContent = "none below threshold";
            ro("ro-gamma-cmp").textContent = "—";
        } else {
            ro("ro-fr-cmp").textContent = fmt(an.frequency, "Hz", 5) + " / " + (rr ? fmt(rr.frequency, "Hz", 5) : "…");
            ro("ro-gamma-cmp").textContent = fmt(an.gamma, "s⁻¹", 4) + " / " + (rr ? fmt(rr.gamma, "s⁻¹", 4) : "…");
        }
    }

    // ------------------------------------------------------------------ pump sweep (L–I)
    const sweep = {
        job: null,
        timer: 0,
        points: [],
        fit: null,
        key: "",
        maxPower: 0
    };

    function cavityKey() {
        return [cavity.R2, cavity.L, cavity.gainLength, cavity.alpha, cavity.outputCoupling].join("|");
    }

    function startSweep() {
        clearTimeout(sweep.timer);
        const d = derivedParams;
        const pMax = Math.min(40, Math.max(3 * d.thresholdPumpPower, 1.25 * cavity.pumpPower, 0.5));
        const powers = model.sweepPowers(pMax, 17);
        sweep.maxPower = pMax;
        sweep.key = cavityKey();
        sweep.points = [];
        sweep.fit = null;
        const base = Object.assign({}, params);
        sweep.job = model.createPumpSweep(base, powers);
        sweep.points = sweep.job.points;
        sweepStatus.textContent = "Sweeping…";
        const tick = () => {
            const t0 = performance.now();
            while (!sweep.job.done && performance.now() - t0 < 12) sweep.job.advance(20000);
            if (sweep.job.done) {
                sweep.fit = model.fitLI(sweep.points, 1.2);
                const nc = sweep.points.filter((p) => !p.converged).length;
                sweepStatus.textContent = sweep.points.length + " pump steps settled" + (nc ? " (" + nc + " hit the time limit near threshold)" : "") + ".";
                updateAnalysisReadouts();
                describeLI();
            } else {
                sweepStatus.textContent = "Sweeping… " + sweep.points.length + "/" + sweep.job.total;
                sweep.timer = setTimeout(tick, 0);
            }
            liPlot.redraw();
        };
        sweep.timer = setTimeout(tick, 0);
    }

    let cavityTimer = 0;

    function onCavityChanged() {
        clearTimeout(cavityTimer);
        cavityTimer = setTimeout(() => {
            if (sweep.key !== cavityKey() || !sweep.job) startSweep();
            else liPlot.redraw();
        }, 250);
        scheduleRelaxation();
    }
    sweepBtn.addEventListener("click", startSweep);

    // ------------------------------------------------------------------ relaxation analysis
    const relax = {
        result: null,
        timer: 0
    };

    function scheduleRelaxation() {
        clearTimeout(relax.timer);
        relax.timer = setTimeout(() => {
            refreshModel();
            const an = model.relaxationAnalytic(params);
            relax.result = an && !an.overdamped ? model.relaxationResponse(params, {
                kick: 1e-3,
                periods: 6,
                maxSteps: 3e6
            }) : null;
            updateAnalysisReadouts();
            roPlot.redraw();
            liPlot.redraw();
            describeRelax();
        }, 120);
    }

    // ------------------------------------------------------------------ illustrative particle view
    const MAX_DOTS = 40;
    let photons = []; // {x in [0,1] between mirrors, y, dir}
    let sparks = []; // spontaneous emission, random direction (not into the mode)
    const numAtoms = 12;
    let atoms = [];
    const rng = core.createRng ? core.createRng(1064) : null;
    const rand = () => (rng ? rng.uniform() : Math.random());

    function initAtoms() {
        atoms = [];
        for (let i = 0; i < numAtoms; i++) atoms.push({
            rank: (i * 7) % numAtoms,
            excited: false,
            anim: 0
        });
    }

    /** Mode-photon dots: 0 for q ≤ 10⁴, MAX_DOTS at q = 10¹², logarithmic between. */
    function targetPhotonDots(q) {
        if (q <= 1e4) return 0;
        return Math.min(MAX_DOTS, Math.round(MAX_DOTS * (Math.log10(q) - 4) / 8));
    }

    /** Red atoms: fraction N/(2 N_th) of the drawn atoms (half red at threshold). */
    function targetExcited(N) {
        return Math.min(numAtoms, Math.round(numAtoms * N / (2 * derivedParams.thresholdInversion)));
    }

    function gainRegion() {
        const frac = params.gainLength / params.L;
        return {
            x0: 0.5 - frac / 2,
            x1: 0.5 + frac / 2
        };
    }

    function updateIllustration(wallDt) {
        const gr = gainRegion();
        const nExc = targetExcited(state[0]);
        atoms.forEach((atom) => {
            const shouldBe = atom.rank < nExc;
            if (shouldBe !== atom.excited) {
                if (atom.excited) {
                    const a = rand() * Math.PI * 2;
                    sparks.push({
                        x: gr.x0 + rand() * (gr.x1 - gr.x0),
                        y: 0.3 + rand() * 0.4,
                        vx: Math.cos(a),
                        vy: Math.sin(a),
                        life: 1
                    });
                }
                atom.excited = shouldBe;
                atom.anim = 1;
            }
            atom.anim = Math.max(0, atom.anim - wallDt * 3);
        });

        const target = targetPhotonDots(state[1]);
        while (photons.length < target) {
            const src = photons.length ? photons[Math.floor(rand() * photons.length)] : null;
            photons.push({
                // stimulated emission copies the direction of an existing mode photon
                x: gr.x0 + rand() * (gr.x1 - gr.x0),
                y: src ? Math.min(0.8, Math.max(0.2, src.y + (rand() - 0.5) * 0.08)) : 0.35 + rand() * 0.3,
                dir: src ? src.dir : (rand() < 0.5 ? 1 : -1),
                leaving: false
            });
        }
        let excess = photons.length - target;
        photons.forEach((ph) => {
            if (excess > 0 && !ph.leaving) {
                ph.leaving = true;
                excess--;
            }
        });

        const speed = 0.9 * wallDt; // cavity widths per wall second (illustrative; real photons cross in L/c)
        photons = photons.filter((ph) => {
            ph.x += ph.dir * speed;
            if (ph.x >= 1) {
                if (ph.leaving) return false; // a surplus dot leaves at a mirror
                ph.x = 2 - ph.x;
                ph.dir = -1;
            } else if (ph.x <= 0) {
                if (ph.leaving) return false;
                ph.x = -ph.x;
                ph.dir = 1;
            }
            return true;
        });
        sparks.forEach((s) => {
            s.x += s.vx * wallDt * 0.3;
            s.y += s.vy * wallDt * 0.6;
            s.life -= wallDt * 1.5;
        });
        sparks = sparks.filter((s) => s.life > 0);
    }

    // ------------------------------------------------------------------ drawing: schematic
    function setFont(ctx, size, weight) {
        ctx.font = (weight ? weight + " " : "") + size + "px " + PAL.font;
    }

    function drawCavity(ctx, w, h) {
        ctx.fillStyle = PAL.background;
        ctx.fillRect(0, 0, w, h);
        const narrow = w < 460;
        const left = narrow ? 26 : 44;
        const right = w - (narrow ? 64 : 110);
        const top = 52;
        const bottom = h - (narrow ? 74 : 66);
        const span = right - left;
        const regime = model.classify(params);
        const midY = (top + bottom) / 2;

        // cavity length dimension line
        ctx.strokeStyle = PAL.axis;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(left, 30);
        ctx.lineTo(right, 30);
        ctx.moveTo(left, 25);
        ctx.lineTo(left, 35);
        ctx.moveTo(right, 25);
        ctx.lineTo(right, 35);
        ctx.stroke();
        ctx.fillStyle = PAL.text;
        setFont(ctx, 12);
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText("L = " + (params.L * 100).toFixed(1) + " cm, T_rt = 2L/c = " + fmt(derivedParams.roundTripTime, "s"), (left + right) / 2, 24);

        // gain medium, to scale
        const gr = gainRegion();
        const gx0 = left + gr.x0 * span,
            gx1 = left + gr.x1 * span;
        ctx.fillStyle = regime === "above" ? "rgba(241, 135, 200, 0.22)" : "rgba(184, 178, 207, 0.16)";
        ctx.fillRect(gx0, top + 14, gx1 - gx0, bottom - top - 28);
        ctx.strokeStyle = PAL.axis;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(gx0, top + 14, gx1 - gx0, bottom - top - 28);
        ctx.fillStyle = PAL.textMuted;
        setFont(ctx, 12);
        ctx.textBaseline = "top";
        ctx.fillText("gain medium l_g = " + (params.gainLength * 100).toFixed(1) + " cm", (gx0 + gx1) / 2, bottom - 10);

        // output beam from Pout = T2 · Pcirc of the model state
        const pw = model.powers(params, state[1]);
        if (pw.output > 1e-6) {
            const a = Math.min(1, Math.max(0.1, Math.log10(pw.output / 1e-6) / 6));
            const grad = ctx.createLinearGradient(right, 0, w, 0);
            grad.addColorStop(0, "rgba(" + COLORS.beam + ", " + a + ")");
            grad.addColorStop(1, "rgba(" + COLORS.beam + ", 0)");
            ctx.fillStyle = grad;
            const bh = 6 + 16 * a;
            ctx.fillRect(right + 4, midY - bh / 2, w - right - 4, bh);
        }
        ctx.fillStyle = pw.output > 1e-6 ? "#ff8a8a" : PAL.textMuted;
        setFont(ctx, 12, 600);
        ctx.textAlign = "center";
        const outX = Math.min(w - 30, (right + w) / 2 + 4);
        ctx.textBaseline = "bottom";
        ctx.fillText("P_out", outX, midY - 16);
        setFont(ctx, 12);
        ctx.textBaseline = "top";
        ctx.fillText(params.R2 >= 1 ? "0" : fmt(pw.output, "W"), outX, midY + 16);

        // sparks: spontaneous emission, random directions
        sparks.forEach((s) => {
            ctx.fillStyle = "rgba(248, 212, 119, " + (0.6 * s.life) + ")";
            ctx.beginPath();
            ctx.arc(left + s.x * span, top + s.y * (bottom - top), 2.5, 0, Math.PI * 2);
            ctx.fill();
        });
        // mode photons (turning points are exactly the mirror lines)
        photons.forEach((ph) => {
            const px = left + ph.x * span,
                py = top + ph.y * (bottom - top);
            const g = ctx.createRadialGradient(px, py, 0, px, py, 8);
            g.addColorStop(0, "rgba(248, 212, 119, 0.8)");
            g.addColorStop(1, "rgba(248, 212, 119, 0)");
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(px, py, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = PAL.marker;
            ctx.beginPath();
            ctx.arc(px, py, 3.5, 0, Math.PI * 2);
            ctx.fill();
        });

        // mirrors
        ctx.lineWidth = 6;
        ctx.strokeStyle = COLORS.mirror1;
        ctx.beginPath();
        ctx.moveTo(left, top);
        ctx.lineTo(left, bottom);
        ctx.stroke();
        ctx.strokeStyle = COLORS.mirror2;
        ctx.beginPath();
        ctx.moveTo(right, top);
        ctx.lineTo(right, bottom);
        ctx.stroke();
        setFont(ctx, 12);
        ctx.fillStyle = PAL.text;
        ctx.textBaseline = "top";
        ctx.textAlign = "left";
        ctx.fillText("R₁ = " + (params.R1 * 100).toFixed(1) + " %", left - 4, bottom + 8);
        ctx.fillStyle = PAL.textMuted;
        ctx.fillText("back mirror", left - 4, bottom + 24);
        ctx.textAlign = "right";
        ctx.fillStyle = PAL.text;
        ctx.fillText("R₂ = " + (params.R2 * 100).toFixed(1) + " %, T₂ = " + ((1 - params.R2) * 100).toFixed(1) + " %", Math.min(w - 4, right + 40), bottom + 8);
        ctx.fillStyle = PAL.textMuted;
        ctx.fillText("output coupler", Math.min(w - 4, right + 40), bottom + 24);
        ctx.textAlign = "left";
        ctx.fillText(narrow ? "dots: illustrative" : "dots: illustrative (count ∝ log₁₀ q, speed ≠ c)", left - 4, h - 16);
    }

    function drawArrow(ctx, x1, y1, x2, y2, color) {
        const hl = 8,
            ang = Math.atan2(y2 - y1, x2 - x1);
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - hl * Math.cos(ang - Math.PI / 6), y2 - hl * Math.sin(ang - Math.PI / 6));
        ctx.lineTo(x2 - hl * Math.cos(ang + Math.PI / 6), y2 - hl * Math.sin(ang + Math.PI / 6));
        ctx.closePath();
        ctx.fill();
    }

    function drawLevels(ctx, w, h) {
        ctx.fillStyle = PAL.background;
        ctx.fillRect(0, 0, w, h);
        const narrow = w < 430;
        const labelW = narrow ? 92 : 150;
        const left = 64;
        const right = w - labelW - 8;
        const yE3 = 26,
            yE2 = 56,
            yE1 = h - 58,
            yE0 = h - 28;
        const labels = narrow ? [
            [yE3, "E₃ pump band"],
            [yE2, "E₂ upper (τ)"],
            [yE1, "E₁ lower"],
            [yE0, "E₀ ground"]
        ] : [
            [yE3, "E₃ pump band"],
            [yE2, "E₂ upper level (τ)"],
            [yE1, "E₁ lower level (fast)"],
            [yE0, "E₀ ground"]
        ];
        setFont(ctx, 12);
        labels.forEach(([y, lab]) => {
            ctx.strokeStyle = PAL.axis;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(left, y);
            ctx.lineTo(right, y);
            ctx.stroke();
            ctx.fillStyle = PAL.textMuted;
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            ctx.fillText(lab, right + 8, y);
        });
        drawArrow(ctx, left - 26, yE0, left - 26, yE3 + 2, "#7ee787");
        ctx.fillStyle = "#7ee787";
        ctx.save();
        ctx.translate(left - 36, (yE0 + yE3) / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText("pump R_p", 0, 0);
        ctx.restore();
        drawArrow(ctx, right - 16, yE2 + 3, right - 16, yE1 - 3, PAL.marker);
        ctx.fillStyle = PAL.marker;
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillText("laser hν", right - 22, (yE2 + yE1) / 2);

        const r = Math.max(4, Math.min(7, (right - left - 60) / (numAtoms * 3)));
        atoms.forEach((atom, i) => {
            const x = left + 14 + (i / (numAtoms - 1)) * (right - left - 90);
            const target = atom.excited ? yE2 + r + 2 : yE0 - r - 2;
            const from = atom.excited ? yE0 - r - 2 : yE2 + r + 2;
            const y = target + (from - target) * atom.anim;
            ctx.fillStyle = atom.excited ? "#ff6b6b" : "#8ab4ff";
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.fillStyle = PAL.textMuted;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText("N/N_th = " + (state[0] / derivedParams.thresholdInversion).toFixed(3), left, h - 16);
    }

    // ------------------------------------------------------------------ drawing: time traces
    function timeAxis() {
        const W = plotWindow();
        const tMax = Math.max(W, simTime);
        return {
            min: (tMax - W) * 1e6,
            max: tMax * 1e6,
            label: "t",
            unit: "µs"
        };
    }

    function cursorSample() {
        if (cursorT == null || !history.length) return null;
        let best = history[0];
        for (const s of history)
            if (Math.abs(s.t - cursorT) < Math.abs(best.t - cursorT)) best = s;
        return best;
    }

    const maps = {};

    function timePlot(key, ctx, w, h, cfg) {
        const xs = history.map((s) => s.t * 1e6);
        const cs = cursorSample();
        const opts = {
            x: timeAxis(),
            y: cfg.y,
            series: cfg.series(xs),
            hlines: cfg.hlines || [],
            legend: cfg.legend !== false
        };
        if (cs) opts.cursor = {
            x: cs.t * 1e6,
            label: cfg.cursorLabel(cs)
        };
        ctx.fillStyle = PAL.background;
        ctx.fillRect(0, 0, w, h);
        maps[key] = UI.plot(ctx, {
            x: 0,
            y: 0,
            w,
            h
        }, opts);
    }

    function drawInversion(ctx, w, h) {
        let yMax = 1.3;
        history.forEach((s) => {
            yMax = Math.max(yMax, 1.05 * s.N / derivedParams.thresholdInversion);
        });
        timePlot("inv", ctx, w, h, {
            y: {
                min: 0,
                max: yMax,
                label: "N / N_th"
            },
            series: (xs) => [{
                xs,
                ys: history.map((s) => s.N / derivedParams.thresholdInversion),
                color: COLORS.inv,
                label: "N/N_th"
            }],
            hlines: [{
                y: 1,
                color: COLORS.loss,
                dash: [6, 4]
            }],
            legend: false,
            cursorLabel: (s) => "N/N_th = " + (s.N / derivedParams.thresholdInversion).toFixed(3)
        });
    }

    function drawPhotons(ctx, w, h) {
        const log = logPhotons.checked;
        let qMax = 0;
        history.forEach((s) => {
            qMax = Math.max(qMax, s.q);
        });
        if (log) {
            const lo = 1;
            const hi = Math.max(10, qMax * 2);
            timePlot("q", ctx, w, h, {
                y: {
                    min: lo,
                    max: Math.pow(10, Math.ceil(Math.log10(hi))),
                    log: true,
                    label: "q (photons)"
                },
                series: (xs) => [{
                    xs,
                    ys: history.map((s) => Math.max(s.q, 1e-3)),
                    color: COLORS.q,
                    label: "q"
                }],
                legend: false,
                cursorLabel: (s) => "q = " + s.q.toExponential(2) + ", P_circ = " + fmt(s.pCirc, "W")
            });
            return;
        }
        const e = qMax > 0 ? Math.floor(Math.log10(qMax)) : 0;
        const sc = Math.pow(10, e);
        timePlot("q", ctx, w, h, {
            y: {
                min: 0,
                max: Math.max(1, qMax / sc) * 1.08,
                label: "q",
                unit: "10" + superscript(e) + " photons"
            },
            series: (xs) => [{
                xs,
                ys: history.map((s) => s.q / sc),
                color: COLORS.q,
                label: "q"
            }],
            hlines: qSteady > 1e3 && qSteady / sc < qMax / sc * 1.08 ? [{
                y: qSteady / sc,
                color: COLORS.analytic,
                dash: [6, 4]
            }] : [],
            legend: false,
            cursorLabel: (s) => "q = " + s.q.toExponential(2) + ", P_circ = " + fmt(s.pCirc, "W")
        });
    }

    function drawOutput(ctx, w, h) {
        let pMax = 0;
        history.forEach((s) => {
            pMax = Math.max(pMax, s.pOut);
        });
        const pSS = model.powers(params, qSteady).output;
        const U = powerUnit(Math.max(pMax, pSS, 1e-9));
        const top = Math.max(pMax, pSS, 1e-9) * U.s * 1.08;
        timePlot("out", ctx, w, h, {
            y: {
                min: 0,
                max: top,
                label: "P_out",
                unit: U.u
            },
            series: (xs) => [{
                xs,
                ys: history.map((s) => s.pOut * U.s),
                color: COLORS.out,
                label: "P_out"
            }],
            hlines: pSS > 0 ? [{
                y: pSS * U.s,
                color: COLORS.analytic,
                dash: [6, 4]
            }] : [],
            legend: false,
            cursorLabel: (s) => "P_out = " + fmt(s.pOut, "W")
        });
        ctx.fillStyle = COLORS.analytic;
        setFont(ctx, 11);
        ctx.textAlign = "right";
        ctx.textBaseline = "top";
        const m = maps.out;
        if (pSS > 0) ctx.fillText("steady state " + fmt(pSS, "W"), m.plot.x + m.plot.w - 6, Math.min(m.plot.y + m.plot.h - 16, m.yToPx(pSS * U.s) + 4));
    }

    function drawGain(ctx, w, h) {
        const gth = derivedParams.thresholdGain;
        let gMax = gth * 1.35;
        history.forEach((s) => {
            gMax = Math.max(gMax, s.g * 1.05);
        });
        timePlot("gain", ctx, w, h, {
            y: {
                min: 0,
                max: gMax,
                label: "g",
                unit: "m⁻¹"
            },
            series: (xs) => [{
                    xs,
                    ys: history.map((s) => s.g),
                    color: COLORS.gain,
                    label: "gain g(t)"
                },
                {
                    xs: [timeAxis().min, timeAxis().max],
                    ys: [gth, gth],
                    color: COLORS.loss,
                    dash: [6, 4],
                    label: "loss g_th (M = 1)"
                }
            ],
            cursorLabel: (s) => "g = " + s.g.toFixed(3) + " m⁻¹, M = " + model.roundTripMultiplier(params, s.g).toFixed(4)
        });
    }

    // ------------------------------------------------------------------ drawing: L–I and relaxation
    function drawLI(ctx, w, h) {
        ctx.fillStyle = PAL.background;
        ctx.fillRect(0, 0, w, h);
        const d = derivedParams;
        const pMax = sweep.maxPower || Math.max(3 * d.thresholdPumpPower, 1);
        const log = logLI.checked;
        // exact algebraic steady state (β included) on a dense grid
        const xs = [],
            exact = [],
            analytic = [];
        for (let i = 0; i <= 240; i++) {
            const Pp = pMax * i / 240;
            const p = Object.assign({}, params, {
                pumpRate: Pp / PUMP_PHOTON_ENERGY
            });
            xs.push(Pp);
            exact.push(model.powers(p, model.steadyState(p).q).output);
            analytic.push(model.analyticOutput(p, Pp));
        }
        const yTop = Math.max(...exact, ...sweep.points.map((p) => p.output), 1e-6);
        const U = log ? {
            s: 1,
            u: "W"
        } : powerUnit(yTop);
        const series = [{
                xs,
                ys: exact.map((v) => v * U.s),
                color: COLORS.out,
                label: "exact steady state"
            },
            {
                xs,
                ys: analytic.map((v) => (log && v <= 0 ? NaN : v * U.s)),
                color: COLORS.analytic,
                dash: [7, 4],
                label: "η_s (P_p − P_th)"
            },
            {
                xs: sweep.points.map((p) => p.pumpPower),
                ys: sweep.points.map((p) => p.output * U.s),
                color: COLORS.sweep,
                pointsOnly: true,
                pointRadius: 3.5,
                label: "sweep (integrated)"
            }
        ];
        const pNow = model.powers(params, qSteady).output;
        const yAxis = log ? {
            min: 1e-12,
            max: Math.pow(10, Math.ceil(Math.log10(yTop * 1.5))),
            log: true,
            label: "P_out",
            unit: "W"
        } : {
            min: 0,
            max: yTop * U.s * 1.1,
            label: "P_out",
            unit: U.u
        };
        maps.li = UI.plot(ctx, {
            x: 0,
            y: 0,
            w,
            h
        }, {
            x: {
                min: 0,
                max: pMax,
                label: "absorbed pump P_p",
                unit: "W"
            },
            y: yAxis,
            series,
            legendPosition: "left",
            markers: [{
                x: d.thresholdPumpPower,
                color: COLORS.loss
            }],
            cursor: cavity.pumpPower <= pMax ? {
                x: cavity.pumpPower,
                label: fmt(pNow, "W")
            } : null
        });
        const m = maps.li;
        if (!(model.derived(params).outputFraction > 0)) {
            setFont(ctx, 13);
            ctx.fillStyle = PAL.warning;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("T₂ = 0: P_out = 0 at every pump", m.plot.x + m.plot.w / 2, m.plot.y + m.plot.h * 0.3);
        }
        // threshold label near the bottom, clear of the legend and the lasing line
        const tx = m.xToPx(d.thresholdPumpPower);
        if (tx >= m.plot.x && tx <= m.plot.x + m.plot.w) {
            setFont(ctx, 12);
            ctx.fillStyle = COLORS.loss;
            ctx.textAlign = tx > m.plot.x + m.plot.w - 90 ? "right" : "left";
            ctx.textBaseline = "bottom";
            ctx.fillText("P_th = " + fmt(d.thresholdPumpPower, "W"), tx + (ctx.textAlign === "left" ? 5 : -5), m.plot.y + m.plot.h * 0.55);
        }
    }

    function drawRelax(ctx, w, h) {
        ctx.fillStyle = PAL.background;
        ctx.fillRect(0, 0, w, h);
        const an = model.relaxationAnalytic(params);
        const rr = relax.result;
        if (!an || !rr) {
            ctx.fillStyle = PAL.textMuted;
            setFont(ctx, 13);
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            const msg = !an ? "Below threshold: q ≈ 0 in steady state, no relaxation oscillations." :
                an.overdamped ? "Overdamped: γ_R exceeds ω₀, no oscillation." : "Computing…";
            wrapText(ctx, msg, w / 2, h / 2, w - 40, 18);
            maps.relax = null;
            return;
        }
        const ts = rr.t.map((t) => t * 1e6);
        const sim = rr.dq.map((v) => v * 1e3);
        const ana = rr.t.map((t) => model.relaxationAnalyticCurve(an, rr.kick, t) * 1e3);
        const env = rr.t.map((t) => rr.kick * Math.exp(-an.gamma * t) * 1e3);
        maps.relax = UI.plot(ctx, {
            x: 0,
            y: 0,
            w,
            h
        }, {
            x: {
                min: 0,
                max: ts[ts.length - 1],
                label: "t after kick",
                unit: "µs"
            },
            y: {
                min: -1.1,
                max: 1.1,
                label: "Δq/q_ss",
                unit: "10⁻³"
            },
            series: [{
                    xs: ts,
                    ys: sim,
                    color: COLORS.q,
                    label: "simulated"
                },
                {
                    xs: ts,
                    ys: ana,
                    color: COLORS.analytic,
                    dash: [7, 4],
                    label: "analytic"
                },
                {
                    xs: ts,
                    ys: env,
                    color: PAL.textMuted,
                    dash: [2, 3],
                    width: 1.25
                },
                {
                    xs: ts,
                    ys: env.map((v) => -v),
                    color: PAL.textMuted,
                    dash: [2, 3],
                    width: 1.25
                }
            ],
            markers: rr.peaks.slice(0, 3).map((p, i) => ({
                x: p.t * 1e6,
                label: i === 0 ? "T_R = " + fmt(rr.period, "s") : "",
                color: "rgba(248, 212, 119, 0.6)"
            }))
        });
    }

    function wrapText(ctx, text, x, y, maxW, lh) {
        const words = text.split(" ");
        const lines = [];
        let line = "";
        words.forEach((wd) => {
            const t = line ? line + " " + wd : wd;
            if (ctx.measureText(t).width > maxW && line) {
                lines.push(line);
                line = wd;
            } else line = t;
        });
        lines.push(line);
        lines.forEach((l, i) => ctx.fillText(l, x, y + (i - (lines.length - 1) / 2) * lh));
    }

    // ------------------------------------------------------------------ canvases
    const cavityPlot = UI.setupCanvas($("cavityCanvas"), {
        aspect: 2.1,
        minHeight: 230,
        maxHeight: 300,
        draw: drawCavity
    });
    const levelsPlot = UI.setupCanvas($("levelsCanvas"), {
        aspect: 2.1,
        minHeight: 230,
        maxHeight: 300,
        draw: drawLevels
    });
    const invPlot = UI.setupCanvas($("invCanvas"), {
        aspect: 1.7,
        minHeight: 210,
        maxHeight: 300,
        draw: drawInversion
    });
    const photonPlot = UI.setupCanvas($("photonCanvas"), {
        aspect: 1.7,
        minHeight: 210,
        maxHeight: 300,
        draw: drawPhotons
    });
    const outPlot = UI.setupCanvas($("outCanvas"), {
        aspect: 1.7,
        minHeight: 210,
        maxHeight: 300,
        draw: drawOutput
    });
    const gainPlot = UI.setupCanvas($("gainCanvas"), {
        aspect: 1.7,
        minHeight: 210,
        maxHeight: 300,
        draw: drawGain
    });
    const liPlot = UI.setupCanvas($("liCanvas"), {
        aspect: 1.45,
        minHeight: 250,
        maxHeight: 380,
        draw: drawLI
    });
    const roPlot = UI.setupCanvas($("roCanvas"), {
        aspect: 1.45,
        minHeight: 250,
        maxHeight: 380,
        draw: drawRelax
    });
    const timePlots = [invPlot, photonPlot, outPlot, gainPlot];
    const timeKeys = ["inv", "q", "out", "gain"];

    timePlots.forEach((pl, i) => {
        const cv = pl.canvas;
        const move = (e) => {
            const m = maps[timeKeys[i]];
            if (!m) return;
            const r = cv.getBoundingClientRect();
            const px = e.clientX - r.left,
                py = e.clientY - r.top;
            if (m.contains(px, py)) {
                cursorT = m.pxToX(px) * 1e-6;
                if (!loop.isRunning()) drawTimePlots();
            }
        };
        cv.addEventListener("pointermove", move);
        cv.addEventListener("pointerdown", move);
        cv.addEventListener("pointerleave", () => {
            cursorT = null;
            if (!loop.isRunning()) drawTimePlots();
        });
    });

    // text equivalents
    const descCavity = UI.describeCanvas(cavityPlot.canvas, "Cavity schematic", {
        label: "Laser cavity schematic with mirrors, gain medium and output beam"
    });
    const descLevels = UI.describeCanvas(levelsPlot.canvas, "Four-level diagram", {
        label: "Four-level energy diagram with illustrative atoms"
    });
    const descTime = timePlots.map((pl, i) => UI.describeCanvas(pl.canvas, "Time trace", {
        label: ["Inversion N over N_th versus time", "Intracavity photon number versus time", "Output power versus time", "Gain versus threshold gain versus time"][i]
    }));
    const descLI = UI.describeCanvas(liPlot.canvas, "L–I curve", {
        label: "Output power versus absorbed pump power: sweep points, exact steady state and analytic line"
    });
    const descRelax = UI.describeCanvas(roPlot.canvas, "Relaxation oscillation", {
        label: "Small-signal relaxation oscillation: simulated and analytic response"
    });

    function describeTime() {
        const d = derivedParams;
        const last = history[history.length - 1] || {
            N: 0,
            q: 0,
            g: 0,
            pOut: 0
        };
        const t = fmt(simTime, "s");
        let qMax = 0,
            pMax = 0;
        history.forEach((s) => {
            qMax = Math.max(qMax, s.q);
            pMax = Math.max(pMax, s.pOut);
        });
        descTime[0].update("At t = " + t + ", N/N_th = " + (state[0] / d.thresholdInversion).toFixed(3) + ". The threshold line is at 1.");
        descTime[1].update("At t = " + t + ", q = " + formatCount(state[1]) + " photons; largest in window " + formatCount(qMax) + "; steady state " + formatCount(qSteady) + ".");
        descTime[2].update("At t = " + t + ", P_out = " + fmt(model.powers(params, state[1]).output, "W") + "; peak in window " + fmt(pMax, "W") + ".");
        descTime[3].update("At t = " + t + ", g = " + model.gainFromInversion(params, state[0]).toFixed(3) + " per metre versus threshold g_th = " + d.thresholdGain.toFixed(3) + " per metre.");
        descCavity.update("Cavity L = " + (params.L * 100).toFixed(1) + " cm, gain medium " + (params.gainLength * 100).toFixed(1) + " cm, R1 = " + (params.R1 * 100).toFixed(1) + " %, R2 = " + (params.R2 * 100).toFixed(1) + " %. Output " + fmt(model.powers(params, state[1]).output, "W") + ".");
        descLevels.update("Illustrative four-level diagram; N/N_th = " + (state[0] / d.thresholdInversion).toFixed(3) + ".");
        void last;
    }

    function describeLI() {
        const fit = sweep.fit;
        descLI.update("Pump sweep with " + sweep.points.length + " points from 0 to " + fmt(sweep.maxPower, "W") + ". Analytic threshold " +
            fmt(derivedParams.thresholdPumpPower, "W") + ", slope " + model.slopeEfficiency(params).toFixed(4) +
            (fit ? "; fitted threshold " + fmt(fit.threshold, "W") + ", fitted slope " + fit.slope.toFixed(4) : "") + ".");
    }

    function describeRelax() {
        const an = model.relaxationAnalytic(params);
        const rr = relax.result;
        descRelax.update(!an ? "Below threshold: no relaxation oscillations." : rr ?
            "Relaxation frequency analytic " + fmt(an.frequency, "Hz") + ", simulated " + fmt(rr.frequency, "Hz") + "; damping analytic " + fmt(an.gamma, "per second") + ", simulated " + fmt(rr.gamma, "per second") + "." :
            "Relaxation analysis pending.");
    }

    function drawTimePlots() {
        timePlots.forEach((p) => p.redraw());
    }

    function drawAll() {
        cavityPlot.redraw();
        if (!levelsPanel.hidden) levelsPlot.redraw();
        drawTimePlots();
        describeTime();
    }

    // ------------------------------------------------------------------ loop
    function setButton(running) {
        startStopBtn.innerHTML = running ? '<span aria-hidden="true">⏸</span> Pause' : '<span aria-hidden="true">▶</span> Start';
        startStopBtn.setAttribute("aria-pressed", running ? "true" : "false");
    }

    const loop = UI.createLoop((dt) => {
        advance(dt * speedFactor());
        updateIllustration(dt);
        updateLiveReadouts();
        drawAll();
    }, {
        maxDt: 0.05,
        onChange: setButton
    });

    startStopBtn.addEventListener("click", () => loop.toggle());
    stepBtn.addEventListener("click", () => {
        loop.stop();
        advance(plotWindow() / 20);
        updateIllustration(1 / 30);
        updateLiveReadouts();
        drawAll();
    });
    resetBtn.addEventListener("click", () => resetSimulation());

    function resetSimulation() {
        loop.stop();
        loop.reset();
        refreshModel();
        resetState();
        initAtoms();
        updateDisplays();
        drawAll();
    }

    UI.onThemeChange(() => drawAll());

    // ------------------------------------------------------------------ URL state + export
    const url = UI.urlState({
        get: () => ({
            P: cavity.pumpPower,
            R2: cavity.R2,
            L: cavity.L,
            lg: cavity.gainLength,
            a: cavity.alpha,
            oc: cavity.outputCoupling,
            sp: +speedSelect.value,
            lv: showEnergyLevels.checked,
            lq: logPhotons.checked,
            ll: logLI.checked,
            pre: activePreset || ""
        }),
        set: (s) => {
            if (s.pre && model.PRESETS[s.pre]) {
                applyPreset(s.pre, {
                    silentUrl: true
                });
            }
            if (s.P != null && s.P >= 0 && s.P <= 40) cavity.pumpPower = s.P;
            if (s.R2 != null && s.R2 >= 0.5 && s.R2 <= 1) cavity.R2 = s.R2;
            if (s.L != null && s.L >= 0.05 && s.L <= 0.3) cavity.L = s.L;
            if (s.lg != null && s.lg >= 0.01 && s.lg <= 0.05) cavity.gainLength = s.lg;
            if (s.a != null && s.a >= 0 && s.a <= 2) cavity.alpha = s.a;
            if (s.oc === "transmission" || s.oc === "budget") cavity.outputCoupling = s.oc;
            if (s.sp != null && Array.from(speedSelect.options).some((o) => +o.value === s.sp)) speedSelect.value = String(s.sp);
            if (s.lv != null) showEnergyLevels.checked = s.lv;
            if (s.lq != null) logPhotons.checked = s.lq;
            if (s.ll != null) logLI.checked = s.ll;
            // a preset stays "active" only if the restored values still match it
            if (activePreset) {
                const p = model.preset(activePreset);
                const same = Math.abs(p.pumpRate * PUMP_PHOTON_ENERGY - cavity.pumpPower) < 1e-9 * (1 + cavity.pumpPower) &&
                    p.R2 === cavity.R2 && p.L === cavity.L && p.gainLength === cavity.gainLength && p.alpha === cavity.alpha;
                if (!same) activePreset = null;
            }
            syncSlidersFromState();
            applyLevelsVisibility();
            updatePresetButtons();
            resetSimulation();
            onCavityChanged();
        }
    });

    UI.addExportBar($("exportHostTime"), {
        name: "laser-cavity",
        url,
        getState: () => Object.assign({}, url_get(), {
            derived: {
                roundTripTime_s: derivedParams.roundTripTime,
                photonLifetime_s: derivedParams.photonLifetime,
                thresholdGain_per_m: derivedParams.thresholdGain,
                thresholdPumpPower_W: derivedParams.thresholdPumpPower,
                slopeEfficiency: model.slopeEfficiency(params),
                relaxation: model.relaxationAnalytic(params)
            }
        }),
        getCSV: () => ({
            headers: ["t (s)", "N (atoms)", "N/N_th", "g (1/m)", "q peak in bin (photons)", "P_circ peak (W)", "P_out peak (W)"],
            rows: history.map((s) => [s.t, s.N, s.N / derivedParams.thresholdInversion, s.g, s.q, s.pCirc, s.pOut])
        }),
        canvases: [cavityPlot.canvas, invPlot.canvas, photonPlot.canvas, outPlot.canvas, gainPlot.canvas],
        caption: () => "Laser rate equations: R2 = " + (cavity.R2 * 100).toFixed(1) + " %, L = " + (cavity.L * 100).toFixed(1) + " cm, Pp = " + cavity.pumpPower.toFixed(3) + " W (" + derivedParams.pumpRatio.toFixed(2) + " × threshold)"
    });
    UI.addExportBar($("exportHostLI"), {
        name: "laser-LI-sweep",
        getCSV: () => ({
            headers: ["P_p (W)", "pump ratio", "N (atoms)", "q (photons)", "P_circ (W)", "P_out integrated (W)", "P_out exact steady state (W)", "P_out analytic (W)", "converged", "settle time (s)"],
            rows: sweep.points.map((p) => [p.pumpPower, p.pumpRatio, p.N, p.q, p.circulating, p.output, p.exactOutput, p.analyticOutput, p.converged ? 1 : 0, p.settleTime])
        }),
        canvases: [liPlot.canvas, roPlot.canvas],
        caption: () => "L–I sweep and relaxation: R2 = " + (cavity.R2 * 100).toFixed(1) + " %, L = " + (cavity.L * 100).toFixed(1) + " cm, α = " + cavity.alpha + " /m, η_s = " + model.slopeEfficiency(params).toFixed(4)
    });

    function url_get() {
        return {
            cavity: Object.assign({}, cavity),
            preset: activePreset,
            fixed: {
                R1: params.R1,
                sigma: params.sigma,
                tau: params.tau,
                area: params.area,
                beta: params.beta,
                wavelength: params.wavelength,
                pumpWavelength: params.pumpWavelength
            }
        };
    }

    // ------------------------------------------------------------------ init
    applyPreset("below", {
        silentUrl: true
    });
    applyLevelsVisibility();
    url.ready.then((restored) => {
        if (!restored) updatePresetButtons();
    });
})();