"use strict";

/*
 * Double-slit experiment UI.
 * Physics lives in ../shared/optics/doubleSlit.js (SI units). This file converts units at the
 * UI boundary, keeps one validated state object, and draws every view from one sampled array.
 */

(function() {
    const DS = window.OpticsModels.doubleSlit;
    const core = window.OpticsModels.core;
    const UI = window.OpticsUI;
    const PAL = UI.CANVAS_PALETTE;

    const el = (id) => document.getElementById(id);

    // -----------------------------------------------------------------------------------------
    // Logarithmic sliders (slider positions 0..1000 ↔ metres)
    // -----------------------------------------------------------------------------------------
    const LOG_RANGES = {
        slitSeparation: {
            min: 0.2e-6,
            max: 2e-3
        },
        slitWidth: {
            min: 0.1e-6,
            max: 1e-3
        },
        distance: {
            min: 10e-3,
            max: 5
        },
        halfWidth: {
            min: 0.2e-3,
            max: 2
        },
    };
    const sliderToValue = (r, pos) => r.min * Math.pow(r.max / r.min, pos / 1000);
    const valueToSlider = (r, v) => Math.min(1000, Math.max(0, (1000 * Math.log(v / r.min)) / Math.log(r.max / r.min)));

    function roundSig(x, sig) {
        if (!(x > 0)) return x;
        const p = Math.pow(10, Math.floor(Math.log10(x)) - sig + 1);
        return Number((Math.round(x / p) * p).toPrecision(sig));
    }

    // -----------------------------------------------------------------------------------------
    // State (SI units) and presets (reproducible experiments with an expected observation)
    // -----------------------------------------------------------------------------------------
    const SOURCE_DEFAULTS = {
        slitMode: "both",
        illum: 1,
        phaseDeg: 0,
        coherence: 1
    };
    const VIEW_DEFAULTS = {
        detMode: "intensity",
        photonsLog: 4,
        seed: 1,
        cmap: "inferno",
        scaleMode: "fixed",
        log: false,
        showField: true,
        showEnvelope: true,
        showOrders: true
    };
    const TEXTBOOK = {
        wavelength: 500e-9,
        slitSeparation: 0.25e-3,
        slitWidth: 0.05e-3,
        distance: 1,
        halfWidth: 15e-3
    };

    const PRESETS = {
        textbook: {
            set: TEXTBOOK,
            expect: "Fringes every λL/d = 2.00 mm; envelope zeros at ±10.0 mm; orders ±5 missing because d = 5a."
        },
        narrow: {
            set: {
                wavelength: 550e-9,
                slitSeparation: 0.1e-3,
                slitWidth: 0.02e-3,
                distance: 1,
                halfWidth: 40e-3
            },
            expect: "Envelope zero moves out to 27.5 mm; 9 bright fringes 5.5 mm apart fill the central lobe (d/a = 5)."
        },
        wide: {
            set: {
                wavelength: 632.8e-9,
                slitSeparation: 1e-3,
                slitWidth: 0.1e-3,
                distance: 1,
                halfWidth: 10e-3
            },
            expect: "Fine 0.633 mm fringes; 19 bright fringes inside the central lobe (d/a = 10)."
        },
        subwave: {
            set: {
                wavelength: 500e-9,
                slitSeparation: 0.4e-6,
                slitWidth: 0.1e-6,
                distance: 0.05,
                halfWidth: 0.25
            },
            expect: "d < λ: one broad maximum only. No off-axis order exists at any screen size (|m|λ/d < 1 fails for m = 1)."
        },
        blocked: {
            set: TEXTBOOK,
            source: {
                slitMode: "top"
            },
            expect: "Fringes vanish, leaving the single-slit sinc² envelope with peak 0.25 I₀ and zeros still at ±10 mm."
        },
        coherence: {
            set: Object.assign({}, TEXTBOOK, {
                halfWidth: 6e-3
            }),
            source: {
                coherence: 0.5
            },
            expect: "|γ| = 0.5: visibility falls to 0.50 while fringe positions and the envelope stay put."
        },
        phase: {
            set: Object.assign({}, TEXTBOOK, {
                halfWidth: 6e-3
            }),
            source: {
                phaseDeg: 180
            },
            expect: "φ = π: a dark fringe on axis; every order shifts by half a fringe (1.00 mm)."
        },
        photons: {
            set: TEXTBOOK,
            view: {
                detMode: "photons",
                photonsLog: 2.5
            },
            expect: "≈ 316 hits look random. Raise N towards 10⁵: fringes emerge with ±√n scatter per bin."
        },
        nearfield: {
            set: {
                wavelength: 500e-9,
                slitSeparation: 1e-3,
                slitWidth: 0.2e-3,
                distance: 0.2,
                halfWidth: 1e-3
            },
            expect: "N_F ≈ 3.6: the Fraunhofer pattern shown is NOT what a real screen at 20 cm records (warning below)."
        },
    };

    const state = Object.assign({}, TEXTBOOK, SOURCE_DEFAULTS, VIEW_DEFAULTS);
    let activePreset = "textbook";
    let cursorY = null; // metres on the screen, or null
    let current = null; // { params, sample, analysis, orders, validity, hist }
    let fieldPhase = 0; // schematic animation phase (rad)
    let speed = 1;

    // -----------------------------------------------------------------------------------------
    // Formatting
    // -----------------------------------------------------------------------------------------
    /** SI length with fixed significant figures (keeps trailing zeros: "2.000 mm"). */
    function fmtLen(m, sig) {
        if (!Number.isFinite(m)) return "∞";
        const d = sig || 3;
        const txt = core.formatSI(m, "m", d);
        const sp = txt.indexOf(" ");
        const num = Number(txt.slice(0, sp));
        if (sp < 0 || !Number.isFinite(num) || /e/i.test(txt.slice(0, sp))) return txt;
        return num.toPrecision(d) + txt.slice(sp);
    }
    const fmtNum = (x, d) => Number(x).toFixed(d === undefined ? 2 : d);
    const fmtDeg = (rad) => {
        const d = (rad * 180) / Math.PI;
        return (Math.abs(d) < 10 ? d.toFixed(2) : d.toFixed(1)) + "°";
    };
    const fmtVal = (x) => (x !== 0 && Math.abs(x) < 1e-3 ? x.toExponential(2) : x.toFixed(3));
    const fmtInt = (n) => Math.round(n).toLocaleString("en-US").replace(/,/g, " ");
    const photonsN = () => Math.round(Math.pow(10, state.photonsLog));

    /** Best display unit for a screen extent. */
    function screenUnit(hw) {
        if (hw < 2e-3) return {
            f: 1e6,
            s: "µm"
        };
        if (hw < 2) return {
            f: 1e3,
            s: "mm"
        };
        return {
            f: 1,
            s: "m"
        };
    }

    // -----------------------------------------------------------------------------------------
    // Model evaluation (single source of truth for every view)
    // -----------------------------------------------------------------------------------------
    function modelParams() {
        return {
            wavelength: state.wavelength,
            slitSeparation: state.slitSeparation,
            slitWidth: state.slitWidth,
            distance: state.distance,
            slit1: state.slitMode !== "bottom",
            slit2: state.slitMode !== "top",
            amplitudeRatio: Math.sqrt(state.illum),
            relativePhase: (state.phaseDeg * Math.PI) / 180,
            coherence: state.coherence,
        };
    }

    function enforceGeometry(changed) {
        if (state.slitWidth <= DS.maxSlitWidth(state.slitSeparation)) return false;
        if (changed === "slitWidth") {
            // widening a pushes the separation out so the slits never overlap
            const needD = roundSig(state.slitWidth / 0.98, 3) * 1.0001;
            if (needD <= LOG_RANGES.slitSeparation.max) state.slitSeparation = needD;
            else state.slitWidth = DS.maxSlitWidth(state.slitSeparation);
        } else {
            state.slitWidth = DS.maxSlitWidth(state.slitSeparation);
        }
        return true;
    }

    function compute() {
        const params = modelParams();
        const sample = DS.sampleScreen(params, state.halfWidth);
        const analysis = DS.analyzeSample(sample);
        const orders = DS.interferenceOrders(params, state.halfWidth);
        const validity = DS.validity(params, state.halfWidth);
        let hist = null;
        if (state.detMode === "photons") {
            hist = DS.detectionHistogram(sample, photonsN(), 60, core.createRng(state.seed >>> 0 || 1));
        }
        current = {
            params: sample.params,
            sample,
            analysis,
            orders,
            validity,
            hist
        };
    }

    /** Intensity → displayed value according to the fixed/auto scale. */
    function scaleRef() {
        const s = current.sample;
        return state.scaleMode === "auto" ? s.peak || 1 : s.reference;
    }
    const LOG_FLOOR = 1e-4;

    // -----------------------------------------------------------------------------------------
    // Controls
    // -----------------------------------------------------------------------------------------
    const sliders = {
        wavelength: el("wavelength"),
        slitSeparation: el("slitSeparation"),
        slitWidth: el("slitWidth"),
        distance: el("screenDistance"),
        halfWidth: el("screenHalf"),
        illum: el("illumRatio"),
        phase: el("relPhase"),
        coherence: el("coherence"),
        photons: el("photons"),
    };
    const selects = {
        slitMode: el("slitMode"),
        detMode: el("detMode"),
        cmap: el("cmap"),
        scaleMode: el("scaleMode"),
        speed: el("speed")
    };
    const checks = {
        log: el("logScale"),
        showField: el("showWavefronts"),
        showEnvelope: el("showEnvelope"),
        showOrders: el("showOrders")
    };

    const logOpts = (key, factor, unit) => ({
        unit,
        format: (pos) => Number((roundSig(sliderToValue(LOG_RANGES[key], pos), 3) * factor).toPrecision(3)),
        parse: (v) => valueToSlider(LOG_RANGES[key], v / factor),
    });
    UI.enhanceSlider(sliders.wavelength, {
        unit: "nm",
        label: "Wavelength"
    });
    UI.enhanceSlider(sliders.slitSeparation, Object.assign(logOpts("slitSeparation", 1e6, "µm"), {
        label: "Slit separation d"
    }));
    UI.enhanceSlider(sliders.slitWidth, Object.assign(logOpts("slitWidth", 1e6, "µm"), {
        label: "Slit width a"
    }));
    UI.enhanceSlider(sliders.distance, Object.assign(logOpts("distance", 1, "m"), {
        label: "Screen distance L"
    }));
    UI.enhanceSlider(sliders.halfWidth, Object.assign(logOpts("halfWidth", 1e3, "mm"), {
        label: "Screen half-width"
    }));
    UI.enhanceSlider(sliders.illum, {
        unit: "%",
        label: "Illumination ratio I2/I1"
    });
    UI.enhanceSlider(sliders.phase, {
        unit: "°",
        label: "Relative phase"
    });
    UI.enhanceSlider(sliders.coherence, {
        label: "Mutual coherence"
    });
    UI.enhanceSlider(sliders.photons, {
        label: "Detections N",
        format: (v) => Math.round(Math.pow(10, v)),
        parse: (n) => Math.log10(Math.max(1, n)),
    });

    let syncing = false;

    function syncControls() {
        syncing = true;
        sliders.wavelength.value = String(Number((state.wavelength * 1e9).toFixed(1)));
        sliders.slitSeparation.value = String(valueToSlider(LOG_RANGES.slitSeparation, state.slitSeparation));
        sliders.slitWidth.value = String(valueToSlider(LOG_RANGES.slitWidth, state.slitWidth));
        sliders.distance.value = String(valueToSlider(LOG_RANGES.distance, state.distance));
        sliders.halfWidth.value = String(valueToSlider(LOG_RANGES.halfWidth, state.halfWidth));
        sliders.illum.value = String(Math.round(state.illum * 100));
        sliders.phase.value = String(state.phaseDeg);
        sliders.coherence.value = String(state.coherence);
        sliders.photons.value = String(state.photonsLog);
        selects.slitMode.value = state.slitMode;
        selects.detMode.value = state.detMode;
        selects.cmap.value = state.cmap;
        selects.scaleMode.value = state.scaleMode;
        checks.log.checked = state.log;
        checks.showField.checked = state.showField;
        checks.showEnvelope.checked = state.showEnvelope;
        checks.showOrders.checked = state.showOrders;
        syncing = false;
        syncLabels();
    }

    function syncLabels() {
        el("wavelengthValue").textContent = fmtLen(state.wavelength, 4);
        el("slitSepValue").textContent = fmtLen(state.slitSeparation);
        el("slitWidthValue").textContent = fmtLen(state.slitWidth);
        el("screenDistValue").textContent = fmtLen(state.distance);
        el("screenHalfValue").textContent = "±" + fmtLen(state.halfWidth);
        el("illumValue").textContent = Math.round(state.illum * 100) + "%";
        el("phaseValue").textContent = state.phaseDeg + "°";
        el("coherenceValue").textContent = fmtNum(state.coherence);
        el("photonValue").textContent = fmtInt(photonsN());
        el("photonGroup").hidden = state.detMode !== "photons";
        // the log sliders' number boxes show rounded physical values; refresh them
        ["slitSeparation", "slitWidth", "distance", "halfWidth", "photons"].forEach((k) => sliders[k].__opticsNum && sliders[k].__opticsNum.sync());
    }

    function setNote(text, warning) {
        const n = el("geometryNote");
        n.textContent = text;
        n.classList.toggle("is-warning", !!warning);
    }

    function setPreset(key) {
        activePreset = key;
        document.querySelectorAll("#presetButtons .preset-option").forEach((b) => {
            const on = b.dataset.preset === key;
            b.classList.toggle("active", on);
            b.setAttribute("aria-pressed", on ? "true" : "false");
        });
        el("presetExpect").textContent = key ? "Expected: " + PRESETS[key].expect : "Custom settings. Pick an experiment to load a reproducible configuration.";
    }

    function onParamChange(changed) {
        if (syncing) return;
        const clamped = enforceGeometry(changed);
        if (clamped) {
            setNote(changed === "slitWidth" ? "a reached d: separation increased so the slits do not overlap." : "a was reduced so the slits do not overlap (a < d).", true);
            syncControls();
        } else {
            setNote("Slits cannot overlap: a is kept below d.", false);
            syncLabels();
        }
        setPreset(null);
        refresh();
    }

    const onInput = (elm, fn, changed) => elm.addEventListener("input", () => {
        if (syncing) return;
        fn();
        onParamChange(changed);
    });
    onInput(sliders.wavelength, () => {
        state.wavelength = +sliders.wavelength.value * 1e-9;
    }, "wavelength");
    onInput(sliders.slitSeparation, () => {
        state.slitSeparation = roundSig(sliderToValue(LOG_RANGES.slitSeparation, +sliders.slitSeparation.value), 3);
    }, "slitSeparation");
    onInput(sliders.slitWidth, () => {
        state.slitWidth = roundSig(sliderToValue(LOG_RANGES.slitWidth, +sliders.slitWidth.value), 3);
    }, "slitWidth");
    onInput(sliders.distance, () => {
        state.distance = roundSig(sliderToValue(LOG_RANGES.distance, +sliders.distance.value), 3);
    }, "distance");
    onInput(sliders.halfWidth, () => {
        state.halfWidth = roundSig(sliderToValue(LOG_RANGES.halfWidth, +sliders.halfWidth.value), 3);
        if (cursorY !== null && Math.abs(cursorY) > state.halfWidth) cursorY = null;
    }, "halfWidth");
    onInput(sliders.illum, () => {
        state.illum = +sliders.illum.value / 100;
    }, "illum");
    onInput(sliders.phase, () => {
        state.phaseDeg = +sliders.phase.value;
    }, "phase");
    onInput(sliders.coherence, () => {
        state.coherence = +sliders.coherence.value;
    }, "coherence");
    onInput(sliders.photons, () => {
        state.photonsLog = +sliders.photons.value;
    }, "photons");
    const onSelect = (elm, key) => elm.addEventListener("change", () => {
        if (syncing) return;
        state[key] = elm.value;
        onParamChange(key);
    });
    onSelect(selects.slitMode, "slitMode");
    onSelect(selects.detMode, "detMode");
    onSelect(selects.cmap, "cmap");
    onSelect(selects.scaleMode, "scaleMode");
    Object.entries(checks).forEach(([key, c]) => c.addEventListener("change", () => {
        if (syncing) return;
        state[key] = c.checked;
        if (key === "showField") {
            schem.redraw();
            url.update();
            return;
        }
        onParamChange(key);
    }));
    selects.speed.addEventListener("change", () => {
        speed = +selects.speed.value || 1;
    });

    el("resampleBtn").addEventListener("click", () => {
        state.seed = (state.seed % 99991) + 1;
        onParamChange("seed");
    });
    el("zoomIn").addEventListener("click", () => zoom(0.5));
    el("zoomOut").addEventListener("click", () => zoom(2));

    function zoom(f) {
        state.halfWidth = Math.min(LOG_RANGES.halfWidth.max, Math.max(LOG_RANGES.halfWidth.min, roundSig(state.halfWidth * f, 3)));
        if (cursorY !== null && Math.abs(cursorY) > state.halfWidth) cursorY = null;
        syncControls();
        onParamChange("halfWidth");
    }

    function applyPreset(key) {
        const p = PRESETS[key];
        Object.assign(state, p.set, SOURCE_DEFAULTS, p.source || {}, {
            detMode: "intensity"
        }, p.view || {});
        cursorY = null;
        setNote("Slits cannot overlap: a is kept below d.", false);
        syncControls();
        setPreset(key);
        refresh();
    }
    document.querySelectorAll("#presetButtons .preset-option").forEach((b) => b.addEventListener("click", () => applyPreset(b.dataset.preset)));

    // -----------------------------------------------------------------------------------------
    // Readouts, warnings, table
    // -----------------------------------------------------------------------------------------
    function updateStats() {
        const {
            params: q,
            sample,
            analysis,
            orders,
            validity: v
        } = current;
        const maxOrder = DS.maxPhysicalOrder(q);
        const bothOpen = q.slit1 && q.slit2 && q.amplitudeRatio > 0;
        const zero = DS.envelopeZero(q);

        el("stat-spacing").textContent = maxOrder === 0 ? "none (d < λ)" : fmtLen(DS.paraxialFringeSpacing(q));
        el("stat-envelope").textContent = Number.isFinite(zero) ? fmtLen(zero) : "none (a ≤ λ)";
        const ms = orders.map((o) => o.m);
        let orderText = "—";
        if (!bothOpen) orderText = "no fringes";
        else if (ms.length) {
            const lo = Math.min(...ms),
                hi = Math.max(...ms);
            orderText = lo === -hi ? (hi === 0 ? "0 only" : "±" + hi) : lo + " … " + hi;
        }
        el("stat-orders").textContent = orderText;
        el("stat-orders-label").textContent = `Orders on Screen (max ±${maxOrder})`;
        el("stat-visibility").textContent = analysis.measuredVisibility === null ? "unresolved" : fmtNum(analysis.measuredVisibility);

        const items = [];
        items.push(["Screen extent", `±${fmtLen(state.halfWidth)} (|θ| ≤ ${fmtDeg(v.maxAngle)})`]);
        items.push(["Sampling", `${sample.n} pts, Δy = ${fmtLen(sample.dy)} (${sample.samplesPerFringe >= 100 ? ">100" : fmtNum(sample.samplesPerFringe, 1)}/fringe)`, sample.resolved ? "" : "is-warning"]);
        if (bothOpen && maxOrder > 0) {
            const y1 = q.distance * Math.tan(Math.asin(q.wavelength / q.slitSeparation));
            items.push(["Fringe spacing λL/d", fmtLen(DS.paraxialFringeSpacing(q), 4)]);
            items.push(["Measured spacing (minima)", analysis.measuredSpacing ? fmtLen(analysis.measuredSpacing, 4) : "—"]);
            items.push(["1st maximum, exact (φ = 0)", fmtLen(y1, 4)]);
            if (q.relativePhase) items.push(["Fringe shift from φ", fmtLen((q.relativePhase / (2 * Math.PI)) * DS.paraxialFringeSpacing(q), 3) + " toward top slit"]);
        } else if (bothOpen) {
            items.push(["Fringe orders", "d < λ: only m = 0 propagates", "is-warning"]);
        }
        items.push(["Envelope zero λL/a", fmtLen(DS.paraxialEnvelopeZero(q), 4)]);
        items.push(["Envelope zero, exact", Number.isFinite(zero) ? fmtLen(zero, 4) : "none (a ≤ λ)"]);
        const missing = orders.filter((o) => o.missing && o.m > 0).map((o) => o.m);
        if (bothOpen && missing.length) items.push(["Missing orders", "±" + missing.slice(0, 5).join(", ±") + (missing.length > 5 ? ", …" : "")]);
        items.push(["Visibility, measured", analysis.measuredVisibility === null ? "unresolved" : fmtNum(analysis.measuredVisibility, 3)]);
        items.push(["Visibility, theory", fmtNum(DS.theoreticalVisibility(q), 3)]);
        items.push(["Peak intensity", sample.peak > 0 ? fmtNum(sample.peak / sample.reference, 3) + " I₀" : "0 (all slits blocked)"]);
        const nfText = v.fresnelNumber < 0.001 ? v.fresnelNumber.toExponential(1) : fmtNum(v.fresnelNumber, 3);
        items.push(["Fresnel number N_F", nfText + (v.regime === "far" ? " (far field)" : v.regime === "marginal" ? " (marginal)" : " (near field!)"), v.regime === "far" ? "" : v.regime === "marginal" ? "is-warning" : "is-bad"]);
        if (current.hist) {
            const h = current.hist;
            const maxC = h.counts.reduce((a, b) => Math.max(a, b), 0);
            items.push(["Detections N", fmtInt(h.total) + " in " + h.nBins + " bins (seed " + state.seed + ")"]);
            items.push(["Brightest bin", fmtInt(maxC) + " ± " + fmtNum(Math.sqrt(maxC), 1) + " counts"]);
        }
        if (cursorY !== null) {
            const th = Math.atan(cursorY / q.distance);
            const I = DS.intensityAtY(cursorY, q);
            items.push(["Cursor y", fmtLen(cursorY, 4) + ", θ = " + fmtDeg(th)]);
            items.push(["Cursor intensity", fmtNum(I / sample.reference, 4) + " I₀" + (sample.peak > 0 ? " = " + fmtNum(I / sample.peak, 3) + " I_peak" : "")]);
            if (current.hist) {
                const h = current.hist;
                const b = Math.min(h.nBins - 1, Math.max(0, Math.floor(((cursorY + state.halfWidth) / (2 * state.halfWidth)) * h.nBins)));
                items.push(["Cursor bin counts", fmtInt(h.counts[b]) + " (expected " + fmtNum(h.expected[b], 1) + ")"]);
            }
        }
        const dl = el("readouts");
        dl.innerHTML = "";
        items.forEach(([label, value, cls]) => {
            const div = document.createElement("div");
            if (cls) div.className = cls;
            const dt = document.createElement("dt");
            dt.textContent = label;
            const dd = document.createElement("dd");
            dd.textContent = value;
            div.append(dt, dd);
            dl.appendChild(div);
        });

        // regime / validity warnings ---------------------------------------------------------
        const rw = el("regimeWarn");
        if (v.regime !== "far") {
            rw.innerHTML = `Fresnel number N<sub>F</sub> = ${nfText}: ${v.regime === "near" ? "near field, the far-field (Fraunhofer) pattern shown here is <strong>not valid</strong>" : "marginal far field, expect visible deviations from this pattern"}. ` +
                `The Fraunhofer model needs L ≳ ${fmtLen(v.minFarFieldDistance)}. For the true near-field pattern use <a href="../aperture_propagation/">aperture propagation</a>.`;
            rw.hidden = false;
        } else rw.hidden = true;
        const aw = el("angleWarn");
        aw.hidden = v.paraxialOK;
        if (!v.paraxialOK) aw.textContent = `Screen reaches ${fmtDeg(v.maxAngle)}: beyond ~10° the paraxial λL/d and λL/a are inaccurate (see the table); orders are placed exactly at L·tan(asin(mλ/d)). Obliquity and 1/r² fall-off are neglected.`;
        const sw = el("scalarWarn");
        sw.hidden = !v.subwavelengthWidth;
        if (v.subwavelengthWidth) sw.textContent = "Slit width a ≤ λ: scalar diffraction is only qualitative here; real slit transmission depends on polarisation and the slit material.";

        updateTable();
    }

    function updateTable() {
        const {
            params: q,
            orders
        } = current;
        const tb = el("ordersTable").querySelector("tbody");
        tb.innerHTML = "";
        const bothOpen = q.slit1 && q.slit2 && q.amplitudeRatio > 0 && q.coherence > 0;
        const rows = bothOpen ? orders.filter((o) => Math.abs(o.m) <= 10) : [];
        if (!rows.length) {
            const tr = document.createElement("tr");
            const td = document.createElement("td");
            td.colSpan = 6;
            td.textContent = bothOpen ? "No maxima inside the field of view." : "No interference maxima (a slit is blocked or |γ| = 0).";
            tr.appendChild(td);
            tb.appendChild(tr);
            return;
        }
        const shift = q.relativePhase / (2 * Math.PI);
        rows.forEach((o) => {
            const yp = (o.m + shift) * q.wavelength * q.distance / q.slitSeparation;
            const err = o.y === 0 ? 0 : (yp - o.y) / o.y;
            const cells = [
                (o.m > 0 ? "+" : "") + o.m + (o.missing ? " (missing)" : ""),
                o.sinTheta.toFixed(5),
                (o.y * 1e3).toPrecision(5),
                (yp * 1e3).toPrecision(5),
                (err === 0 ? "0" : Math.abs(err) < 1e-4 ? (err * 100).toExponential(1) : (err * 100).toFixed(Math.abs(err) < 1e-3 ? 4 : 2)) + " %",
                o.envelope.toExponential(3),
            ];
            const tr = document.createElement("tr");
            if (o.missing) tr.className = "ds-missing";
            cells.forEach((c) => {
                const td = document.createElement("td");
                td.textContent = c;
                tr.appendChild(td);
            });
            tb.appendChild(tr);
        });
    }

    // -----------------------------------------------------------------------------------------
    // Colour helpers
    // -----------------------------------------------------------------------------------------
    const spectralCache = {};
    /** Black → monochromatic colour ramp, shaped like a UI.colormap object (display aid only). */
    function spectralMap(nm) {
        const key = Math.round(nm);
        if (spectralCache[key]) return spectralCache[key];
        const top = UI.wavelengthToRGB(key);
        const lut = new Uint8ClampedArray(256 * 3);
        for (let i = 0; i < 256; i++)
            for (let c = 0; c < 3; c++) lut[i * 3 + c] = Math.round((top[c] * i) / 255);
        const idx = (t) => (Number.isFinite(t) ? Math.max(0, Math.min(255, Math.round(t * 255))) : 0);
        const cm = {
            name: "spectral",
            kind: "sequential",
            lut,
            index: idx,
            rgb: (t) => {
                const i = idx(t) * 3;
                return [lut[i], lut[i + 1], lut[i + 2]];
            },
            css: (t) => {
                const i = idx(t) * 3;
                return "rgb(" + lut[i] + "," + lut[i + 1] + "," + lut[i + 2] + ")";
            },
        };
        spectralCache[key] = cm;
        return cm;
    }
    const currentCmap = () => (state.cmap === "spectral" ? spectralMap(state.wavelength * 1e9) : UI.colormap(state.cmap));

    function colourbarOpts() {
        const ref = scaleRef();
        const label = state.scaleMode === "auto" ? "I/I_peak" : "I/I₀";
        if (current.hist) return {
            min: 0,
            max: 1,
            label: "counts / max",
            log: false
        };
        if (state.log) return {
            min: LOG_FLOOR,
            max: 1,
            log: true,
            label: label + " (log)"
        };
        return {
            min: 0,
            max: Math.max(1, current.sample.peak / ref),
            label
        };
    }

    // -----------------------------------------------------------------------------------------
    // Schematic panel: instantaneous signed field (illustrative, not to scale)
    // -----------------------------------------------------------------------------------------
    const FIELD_NX = 150,
        FIELD_NY = 100;
    const fieldBuf = new Float64Array(FIELD_NX * FIELD_NY);

    const schemCanvas = el("schemCanvas");
    schemCanvas.dataset.exportName = "apparatus";
    const schemDesc = UI.describeCanvas(schemCanvas, "Schematic of the double-slit apparatus.", {
        label: "Schematic double-slit apparatus with instantaneous field, not to scale"
    });
    const schem = UI.setupCanvas(schemCanvas, {
        aspect: 1.45,
        minHeight: 230,
        maxHeight: 420,
        draw: drawSchematic
    });

    function drawSchematic(ctx, W, H) {
        if (!current) return;
        const q = current.params;
        ctx.fillStyle = PAL.background;
        ctx.fillRect(0, 0, W, H);
        const fs = 12;
        const pad = 10,
            top = 26,
            bottom = H - 30;
        const x0 = pad,
            x1 = W - 40; // leave room for a colour bar
        const barrierX = x0 + (x1 - x0) * 0.26;
        const screenX = x1 - 8;
        const cy = (top + bottom) / 2;
        ctx.font = "600 " + fs + "px " + PAL.font;
        ctx.fillStyle = PAL.textMuted;
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        ctx.fillText("Re ψ(x, y, t), illustrative λ", x0, 17);

        // aperture scale: d + a spans 44 % of the panel height; a : d is to scale
        const span = (bottom - top) * 0.44;
        const s = span / (q.slitSeparation + q.slitWidth);
        const halfA = Math.max(1, (q.slitWidth * s) / 2);
        const enlarged = (q.slitWidth * s) / 2 < 1;
        const c1 = cy - (q.slitSeparation * s) / 2; // top slit (y = +d/2)
        const c2 = cy + (q.slitSeparation * s) / 2; // bottom slit
        const A = [q.slit1 ? 1 : 0, q.slit2 ? q.amplitudeRatio : 0];
        const P = [0, q.relativePhase];
        const lamPx = Math.max(10, (x1 - x0) / 16); // display wavelength: NOT the physical λ
        const k = (2 * Math.PI) / lamPx;

        if (state.showField) {
            const cw = (x1 - x0) / FIELD_NX,
                ch = (bottom - top) / FIELD_NY;
            let maxAbs = 1e-9;
            for (let iy = 0; iy < FIELD_NY; iy++) {
                const py = bottom - (iy + 0.5) * ch; // iy = 0 at bottom
                for (let ix = 0; ix < FIELD_NX; ix++) {
                    const px = x0 + (ix + 0.5) * cw;
                    let v;
                    if (px < barrierX) v = Math.cos(k * (px - barrierX) - fieldPhase);
                    else {
                        v = 0;
                        for (let j = 0; j < 2; j++) {
                            if (!A[j]) continue;
                            const r = Math.hypot(px - barrierX, py - (j ? c2 : c1));
                            v += A[j] * Math.cos(k * r - fieldPhase + P[j]) / Math.sqrt(1 + k * r / 2);
                        }
                        v *= 1.6;
                    }
                    fieldBuf[iy * FIELD_NX + ix] = v;
                    if (Math.abs(v) > maxAbs) maxAbs = Math.abs(v);
                }
            }
            const m = 1.6;
            UI.imageFromArray(ctx, fieldBuf, FIELD_NX, FIELD_NY, {
                x: x0,
                y: top,
                w: x1 - x0,
                h: bottom - top
            }, "diverging", {
                min: -m,
                max: m,
                smooth: true
            });
            UI.drawColorbar(ctx, {
                x: x1 + 6,
                y: top,
                w: 9,
                h: bottom - top
            }, "diverging", {
                min: -1,
                max: 1,
                ticks: [-1, 0, 1],
                format: (t) => (t === 0 ? "0" : t > 0 ? "+" : "−"),
                theme: PAL
            });
        } else {
            ctx.fillStyle = PAL.panel;
            ctx.fillRect(x0, top, x1 - x0, bottom - top);
        }

        // rays to the cursor
        if (cursorY !== null) {
            const py = top + (1 - (cursorY + state.halfWidth) / (2 * state.halfWidth)) * (bottom - top);
            ctx.strokeStyle = PAL.cursor;
            ctx.setLineDash([4, 4]);
            ctx.lineWidth = 1;
            [
                [q.slit1, c1],
                [q.slit2, c2]
            ].forEach(([open, sy]) => {
                if (!open) return;
                ctx.beginPath();
                ctx.moveTo(barrierX, sy);
                ctx.lineTo(screenX, py);
                ctx.stroke();
            });
            ctx.setLineDash([]);
        }

        // barrier from the same aperture definition (edges at ±d/2 ± a/2)
        ctx.fillStyle = "#9aa3b5";
        const bw = 6;
        ctx.fillRect(barrierX - bw / 2, top, bw, c1 - halfA - top);
        ctx.fillRect(barrierX - bw / 2, c1 + halfA, bw, c2 - halfA - (c1 + halfA));
        ctx.fillRect(barrierX - bw / 2, c2 + halfA, bw, bottom - (c2 + halfA));
        ctx.font = "600 " + fs + "px " + PAL.font;
        [
            [q.slit1, c1],
            [q.slit2, c2]
        ].forEach(([open, sy]) => {
            if (open) return;
            ctx.fillStyle = PAL.warning;
            ctx.fillRect(barrierX - bw / 2 - 2, sy - halfA - 2, bw + 4, 2 * halfA + 4);
            ctx.textAlign = "right";
            ctx.fillText("blocked", barrierX - 8, sy + 4);
        });

        // dimension labels
        ctx.strokeStyle = PAL.text;
        ctx.fillStyle = PAL.text;
        ctx.lineWidth = 1;
        const dimX = barrierX - 12;
        ctx.beginPath();
        ctx.moveTo(dimX, c1);
        ctx.lineTo(dimX, c2);
        ctx.moveTo(dimX - 4, c1);
        ctx.lineTo(dimX + 4, c1);
        ctx.moveTo(dimX - 4, c2);
        ctx.lineTo(dimX + 4, c2);
        ctx.stroke();
        ctx.font = fs + "px " + PAL.font;
        const label = (txt, x, y, align) => {
            ctx.textAlign = align;
            const tw = ctx.measureText(txt).width;
            const bx = align === "right" ? x - tw : x;
            ctx.fillStyle = "rgba(7,7,13,0.78)";
            ctx.fillRect(bx - 3, y - fs, tw + 6, fs + 5);
            ctx.fillStyle = PAL.text;
            ctx.fillText(txt, x, y);
        };
        const dTxt = "d = " + fmtLen(q.slitSeparation);
        label(dTxt, Math.max(dimX - 6, x0 + 3 + ctx.measureText(dTxt).width), cy + 4, "right");
        label("a = " + fmtLen(q.slitWidth) + (enlarged ? " (drawn wider)" : ""), barrierX + 8, Math.min(bottom - 4, c2 + halfA + fs + 4), "left");

        // screen strip mirrors the detector (same sample array)
        const rows = Math.max(1, Math.round(bottom - top));
        const cm = currentCmap();
        const ref = current.sample.peak || 1;
        for (let r = 0; r < rows; r++) {
            const yv = state.halfWidth * (1 - (2 * (r + 0.5)) / rows);
            const i = Math.round((yv + state.halfWidth) / current.sample.dy);
            const v = current.sample.intensity[Math.max(0, Math.min(current.sample.n - 1, i))] / ref;
            ctx.fillStyle = cm.css(v);
            ctx.fillRect(screenX - 3, top + r, 7, 1.05);
        }
        ctx.fillStyle = PAL.textMuted;
        ctx.textAlign = "center";
        ctx.fillText("L = " + fmtLen(q.distance) + " (not to scale)", (barrierX + screenX) / 2, H - 10);
        ctx.textAlign = "left";
        ctx.fillText("a : d to scale", x0, H - 10);
    }

    // -----------------------------------------------------------------------------------------
    // Detector panel: face-on image of the screen (x = screen y)
    // -----------------------------------------------------------------------------------------
    const detCanvas = el("detCanvas");
    detCanvas.dataset.exportName = "detector";
    const detDesc = UI.describeCanvas(detCanvas, "Detector image.", {
        label: "Detector screen image"
    });
    let detMap = null;
    const det = UI.setupCanvas(detCanvas, {
        aspect: 1.45,
        minHeight: 230,
        maxHeight: 420,
        draw: drawDetector
    });

    function drawDetector(ctx, W, H) {
        if (!current) return;
        ctx.fillStyle = PAL.background;
        ctx.fillRect(0, 0, W, H);
        const u = screenUnit(state.halfWidth);
        const hw = state.halfWidth * u.f;
        const cbW = 12;
        detMap = UI.plot(ctx, {
            x: 0,
            y: 0,
            w: W - 70,
            h: H
        }, {
            x: {
                min: -hw,
                max: hw,
                label: "screen position y",
                unit: u.s
            },
            y: {
                min: 0,
                max: 1,
                label: "along slits",
                ticks: [],
                grid: false
            },
            series: [],
            legend: false,
            margin: {
                l: 34
            },
        });
        const P = detMap.plot;
        const cm = currentCmap();
        const {
            sample,
            hist
        } = current;
        if (hist) {
            ctx.fillStyle = "#000";
            ctx.fillRect(P.x, P.y, P.w, P.h);
            if (hist.positions) {
                // individual detections; the vertical coordinate is random (the pattern is uniform along the slits)
                const rng = core.createRng((state.seed * 7919) >>> 0 || 3);
                const r = hist.total > 3000 ? 0.8 : hist.total > 500 ? 1.2 : 1.8;
                ctx.fillStyle = cm.css(0.92);
                for (let i = 0; i < hist.positions.length; i++) {
                    const px = P.x + ((hist.positions[i] + state.halfWidth) / (2 * state.halfWidth)) * P.w;
                    const py = P.y + rng.next() * P.h;
                    ctx.fillRect(px - r / 2, py - r / 2, r, r);
                }
            } else {
                const maxC = hist.counts.reduce((a, b) => Math.max(a, b), 1);
                const data = Float64Array.from(hist.counts, (c) => c / maxC);
                UI.imageFromArray(ctx, data, hist.nBins, 1, P, cm, {
                    min: 0,
                    max: 1
                });
            }
        } else {
            // pixel-binned (averaged) sampled intensity: one image column per CSS pixel
            const nx = Math.max(2, Math.min(sample.n, Math.round(P.w)));
            const data = new Float64Array(nx);
            const ref = scaleRef();
            for (let c = 0; c < nx; c++) {
                const ylo = -state.halfWidth + (2 * state.halfWidth * c) / nx;
                const yhi = -state.halfWidth + (2 * state.halfWidth * (c + 1)) / nx;
                let i0 = Math.round((ylo + state.halfWidth) / sample.dy),
                    i1 = Math.round((yhi + state.halfWidth) / sample.dy);
                i0 = Math.max(0, Math.min(sample.n - 1, i0));
                i1 = Math.max(i0, Math.min(sample.n - 1, i1));
                let acc = 0;
                for (let i = i0; i <= i1; i++) acc += sample.intensity[i];
                data[c] = acc / (i1 - i0 + 1) / ref;
            }
            const cb = colourbarOpts();
            UI.imageFromArray(ctx, data, nx, 1, P, cm, {
                min: cb.min,
                max: cb.max,
                log: cb.log
            });
        }
        ctx.strokeStyle = PAL.axis;
        ctx.strokeRect(P.x + 0.5, P.y + 0.5, P.w - 1, P.h - 1);
        if (cursorY !== null) {
            const px = P.x + ((cursorY + state.halfWidth) / (2 * state.halfWidth)) * P.w;
            ctx.strokeStyle = PAL.cursor;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(px + 0.5, P.y);
            ctx.lineTo(px + 0.5, P.y + P.h);
            ctx.stroke();
        }
        const cb = colourbarOpts();
        UI.drawColorbar(ctx, {
            x: W - 64,
            y: P.y,
            w: cbW,
            h: P.h
        }, cm, Object.assign({
            theme: PAL
        }, cb, {
            label: undefined
        }));
        ctx.save();
        ctx.translate(W - 3, P.y + P.h / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = PAL.text;
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.font = "12px " + PAL.font;
        ctx.fillText(cb.label, 0, 0);
        ctx.restore();
    }

    // -----------------------------------------------------------------------------------------
    // Line plot: I(y) with envelopes, orders and cursor
    // -----------------------------------------------------------------------------------------
    const plotCanvas = el("plotCanvas");
    plotCanvas.dataset.exportName = "intensity";
    const plotDesc = UI.describeCanvas(plotCanvas, "Intensity versus screen position.", {
        label: "Plot of intensity versus screen position"
    });
    let plotMap = null;
    const plotH = UI.setupCanvas(plotCanvas, {
        aspect: 2.5,
        minHeight: 250,
        maxHeight: 440,
        draw: drawPlot
    });

    function decimate(xs, ys, maxPts) {
        // min/max per bucket keeps unresolved fringes visible as a filled band
        const n = xs.length;
        if (n <= maxPts) return {
            xs,
            ys
        };
        const buckets = Math.floor(maxPts / 2);
        const ox = [],
            oy = [];
        for (let b = 0; b < buckets; b++) {
            const i0 = Math.floor((b * n) / buckets),
                i1 = Math.floor(((b + 1) * n) / buckets);
            let lo = i0,
                hi = i0;
            for (let i = i0; i < i1; i++) {
                if (ys[i] < ys[lo]) lo = i;
                if (ys[i] > ys[hi]) hi = i;
            }
            const [a, c] = lo < hi ? [lo, hi] : [hi, lo];
            ox.push(xs[a], xs[c]);
            oy.push(ys[a], ys[c]);
        }
        return {
            xs: ox,
            ys: oy
        };
    }

    function drawPlot(ctx, W, H) {
        if (!current) return;
        ctx.fillStyle = PAL.background;
        ctx.fillRect(0, 0, W, H);
        const {
            sample,
            orders,
            params: q,
            hist
        } = current;
        const u = screenUnit(state.halfWidth);
        const hw = state.halfWidth * u.f;
        const ref = scaleRef();
        const yLabel = state.scaleMode === "auto" ? "I / I_peak" : "I / I₀";
        const xs = Array.from(sample.y, (v) => v * u.f);
        const tr = (v) => v / ref;
        const series = [];
        const pts = Math.max(400, Math.round(W * 2));
        const main = decimate(xs, Array.from(sample.intensity, tr), pts);
        const floorize = (arr) => (state.log ? arr.map((v) => (v > LOG_FLOOR ? v : LOG_FLOOR)) : arr);
        if (hist) {
            // expected curve dashed; histogram as points with ±√n bars (drawn below)
            series.push({
                xs: main.xs,
                ys: floorize(main.ys),
                label: "expected I(y)",
                color: PAL.series[0],
                dash: [6, 4],
                width: 1.5
            });
        } else {
            series.push({
                xs: main.xs,
                ys: floorize(main.ys),
                label: "I(y)",
                color: PAL.series[0],
                width: 1.8
            });
        }
        if (state.showEnvelope && sample.peak > 0) {
            const up = decimate(xs, Array.from(sample.envelope, tr), pts);
            series.push({
                xs: up.xs,
                ys: floorize(up.ys),
                label: "upper envelope",
                color: PAL.series[1],
                dash: [7, 4],
                width: 1.3
            });
            const lowArr = Array.from(sample.lowerEnvelope, tr);
            if (lowArr.some((v) => v > 1e-12)) {
                const lo = decimate(xs, lowArr, pts);
                series.push({
                    xs: lo.xs,
                    ys: floorize(lo.ys),
                    label: "lower envelope",
                    color: PAL.series[2],
                    dash: [2, 3],
                    width: 1.3
                });
            }
        }
        let histPts = null;
        if (hist) {
            // density estimate in intensity units: Î_b = counts_b / N · ∫I dy / Δy_bin
            const totalInt = DS.cumulativeIntensity(sample)[sample.n - 1];
            const bw = (2 * state.halfWidth) / hist.nBins;
            const k = hist.total > 0 ? totalInt / (hist.total * bw) / ref : 0;
            histPts = {
                xs: Array.from(hist.centers, (v) => v * u.f),
                ys: Array.from(hist.counts, (c) => c * k),
                err: Array.from(hist.counts, (c) => Math.sqrt(c) * k)
            };
            series.push({
                xs: histPts.xs,
                ys: floorize(histPts.ys),
                label: "counts (scaled) ±√n",
                color: PAL.series[3],
                pointsOnly: true,
                points: true,
                pointRadius: 2.6
            });
        }
        let yMax = 1.05;
        if (state.scaleMode === "fixed") yMax = Math.max(1.05, (sample.peak / ref) * 1.05);
        if (histPts) yMax = Math.max(yMax, ...histPts.ys.map((v, i) => v + histPts.err[i])) * 1.02;
        const cursorOpt = cursorY !== null ? {
            x: cursorY * u.f,
            label: "y = " + fmtLen(cursorY, 4) + "  " + yLabel + " = " + fmtVal(DS.intensityAtY(cursorY, q) / ref)
        } : null;
        const orderLabelH = state.showOrders ? 16 : 0;
        plotMap = UI.plot(ctx, {
            x: 0,
            y: orderLabelH,
            w: W,
            h: H - orderLabelH
        }, {
            x: {
                min: -hw,
                max: hw,
                label: "screen position y",
                unit: u.s
            },
            y: state.log ? {
                min: LOG_FLOOR,
                max: yMax,
                log: true,
                label: yLabel + " (log)"
            } : {
                min: 0,
                max: yMax,
                label: yLabel
            },
            series,
            cursor: cursorOpt,
        });
        const P = plotMap.plot;
        if (histPts) {
            ctx.save();
            ctx.strokeStyle = PAL.series[3];
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.rect(P.x, P.y, P.w, P.h);
            ctx.clip();
            ctx.beginPath();
            histPts.xs.forEach((x, i) => {
                const lo = Math.max(state.log ? LOG_FLOOR : 0, histPts.ys[i] - histPts.err[i]),
                    hi = histPts.ys[i] + histPts.err[i];
                const px = plotMap.xToPx(x);
                ctx.moveTo(px, plotMap.yToPx(lo));
                ctx.lineTo(px, plotMap.yToPx(hi));
            });
            ctx.stroke();
            ctx.restore();
        }
        if (!(sample.peak > 0)) {
            ctx.fillStyle = PAL.warning;
            ctx.font = "600 13px " + PAL.font;
            ctx.textAlign = "center";
            ctx.fillText("All slits blocked: no light reaches the screen", P.x + P.w / 2, P.y + P.h / 2);
        }
        // order ticks along the top edge (non-colour cue: missing orders are hollow)
        if (state.showOrders && q.slit1 && q.slit2 && q.amplitudeRatio > 0) {
            ctx.font = "11px " + PAL.mono;
            ctx.textAlign = "center";
            ctx.textBaseline = "bottom";
            let lastPx = -Infinity;
            const spacingPx = orders.length > 1 ? Math.abs(plotMap.xToPx(orders[1].y * u.f) - plotMap.xToPx(orders[0].y * u.f)) : Infinity;
            const every = Math.max(1, Math.ceil(26 / Math.max(1e-6, spacingPx)));
            orders.forEach((o) => {
                const px = plotMap.xToPx(o.y * u.f);
                if (px < P.x || px > P.x + P.w) return;
                ctx.strokeStyle = o.missing ? PAL.warning : PAL.text;
                ctx.lineWidth = 1.2;
                ctx.beginPath();
                ctx.moveTo(px, P.y);
                ctx.lineTo(px, P.y + 6);
                ctx.stroke();
                if (o.m % every === 0 && px - lastPx >= 22) {
                    ctx.fillStyle = o.missing ? PAL.warning : PAL.textMuted;
                    ctx.fillText((o.m > 0 ? "+" : "") + o.m + (o.missing ? "×" : ""), px, P.y - 2);
                    lastPx = px;
                }
            });
            ctx.textAlign = "left";
            ctx.fillStyle = PAL.textMuted;
            ctx.fillText("m", 4, P.y - 2);
        }
    }

    // -----------------------------------------------------------------------------------------
    // Cursor: pointer on detector / plot, keyboard on the plot
    // -----------------------------------------------------------------------------------------
    function setCursorFromPx(map, canvas, ev) {
        if (!map) return;
        const r = canvas.getBoundingClientRect();
        const px = ev.clientX - r.left;
        const P = map.plot;
        if (px >= P.x && px <= P.x + P.w && ev.clientY - r.top >= 0) {
            const u = screenUnit(state.halfWidth);
            cursorY = map.pxToX(px) / u.f;
        } else cursorY = null;
        onCursor();
    }

    function onCursor() {
        updateStats();
        redrawAll();
        describe();
    }
    plotCanvas.addEventListener("pointermove", (e) => setCursorFromPx(plotMap, plotCanvas, e));
    plotCanvas.addEventListener("pointerdown", (e) => setCursorFromPx(plotMap, plotCanvas, e));
    detCanvas.addEventListener("pointermove", (e) => setCursorFromPx(detMap, detCanvas, e));
    detCanvas.addEventListener("pointerdown", (e) => setCursorFromPx(detMap, detCanvas, e));
    [plotCanvas, detCanvas].forEach((c) => c.addEventListener("pointerleave", () => {
        if (cursorY !== null && document.activeElement !== plotCanvas) {
            cursorY = null;
            onCursor();
        }
    }));
    plotCanvas.addEventListener("keydown", (e) => {
        const step = (e.shiftKey ? 0.1 : 0.01) * state.halfWidth;
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
            e.preventDefault();
            const y0 = cursorY === null ? 0 : cursorY + (e.key === "ArrowRight" ? step : -step);
            cursorY = Math.max(-state.halfWidth, Math.min(state.halfWidth, y0));
            onCursor();
        } else if (e.key === "Home") {
            e.preventDefault();
            cursorY = 0;
            onCursor();
        } else if (e.key === "Escape") {
            cursorY = null;
            onCursor();
        }
    });

    // -----------------------------------------------------------------------------------------
    // Text equivalents
    // -----------------------------------------------------------------------------------------
    function describe() {
        const {
            params: q,
            sample,
            analysis,
            orders,
            validity: v,
            hist
        } = current;
        const bothOpen = q.slit1 && q.slit2 && q.amplitudeRatio > 0;
        const zero = DS.envelopeZero(q);
        const vis = analysis.measuredVisibility === null ? "unresolved" : fmtNum(analysis.measuredVisibility, 2);
        const base = `Screen ±${fmtLen(state.halfWidth)} at L = ${fmtLen(q.distance)}, λ = ${fmtLen(q.wavelength, 4)}, d = ${fmtLen(q.slitSeparation)}, a = ${fmtLen(q.slitWidth)}. `;
        const fr = bothOpen ? (DS.maxPhysicalOrder(q) > 0 ? `Fringes every ${fmtLen(DS.paraxialFringeSpacing(q))} (paraxial), ${orders.length} maxima on screen, visibility ${vis}. ` : "Only the central order exists (d < λ). ") :
            "One slit blocked: single-slit envelope only, no fringes. ";
        const env = `Envelope first zero ${Number.isFinite(zero) ? "at ±" + fmtLen(zero) : "absent (a ≤ λ)"}. Peak ${fmtNum(sample.peak / sample.reference, 2)} I₀. `;
        const reg = v.regime === "far" ? "" : `Warning: Fresnel number ${fmtNum(v.fresnelNumber, 2)}, far-field model not valid. `;
        const cur = cursorY !== null ? `Cursor at y = ${fmtLen(cursorY, 4)}, I = ${fmtNum(DS.intensityAtY(cursorY, q) / sample.reference, 3)} I₀.` : "";
        plotDesc.update(base + fr + env + reg + cur);
        detDesc.update(hist ? `Detector shows ${fmtInt(hist.total)} simulated photon detections (seed ${state.seed}) drawn from the intensity pattern. ` + fr : "Detector image of the time-averaged intensity. " + fr + env);
        schemDesc.update(`Schematic, not to scale: plane wave incident on two slits (${q.slit1 ? "top open" : "top blocked"}, ${q.slit2 ? "bottom open" : "bottom blocked"}), cylindrical wavelets beyond the barrier, relative phase ${state.phaseDeg}°.`);
    }

    // -----------------------------------------------------------------------------------------
    // Refresh cycle
    // -----------------------------------------------------------------------------------------
    function redrawAll() {
        schem.redraw();
        det.redraw();
        plotH.redraw();
    }

    function refresh() {
        compute();
        updateStats();
        redrawAll();
        describe();
        el("detBadge").textContent = current.hist ? "photon counts" : "time-averaged I";
        const c = plotCanvas;
        c.dataset.spacing = String(DS.paraxialFringeSpacing(current.params));
        c.dataset.envelopeZero = String(DS.envelopeZero(current.params));
        c.dataset.orders = JSON.stringify(current.orders.map((o) => o.m));
        c.dataset.visibility = String(current.analysis.measuredVisibility);
        c.dataset.measuredSpacing = String(current.analysis.measuredSpacing);
        if (url) url.update();
    }

    // -----------------------------------------------------------------------------------------
    // Animation (schematic only): elapsed-time loop, pause / step / speed / reset
    // -----------------------------------------------------------------------------------------
    const OMEGA = 2 * Math.PI * 0.6; // display rad/s at 1× (illustrative)
    const startStopBtn = el("startStopBtn");
    const loop = UI.createLoop((dt) => {
        fieldPhase = (fieldPhase + OMEGA * speed * dt) % (2 * Math.PI);
        schem.redraw();
    }, {
        onChange: (running) => {
            startStopBtn.innerHTML = running ? '<span aria-hidden="true">⏸️</span> Pause' : '<span aria-hidden="true">▶️</span> Start';
            startStopBtn.setAttribute("aria-pressed", running ? "true" : "false");
        },
    });
    startStopBtn.addEventListener("click", () => loop.toggle());
    el("stepBtn").addEventListener("click", () => {
        loop.stop();
        fieldPhase = (fieldPhase + (2 * Math.PI) / 20) % (2 * Math.PI);
        schem.redraw();
    });
    el("resetBtn").addEventListener("click", () => {
        loop.stop();
        loop.reset();
        fieldPhase = 0;
        speed = 1;
        selects.speed.value = "1";
        Object.assign(state, VIEW_DEFAULTS);
        applyPreset("textbook");
    });

    // -----------------------------------------------------------------------------------------
    // URL state + export
    // -----------------------------------------------------------------------------------------
    const MODES = {
        slits: ["both", "top", "bottom"],
        det: ["intensity", "photons"],
        cm: ["inferno", "viridis", "gray", "spectral"],
        sc: ["fixed", "auto"]
    };

    function getState() {
        return {
            lam: Number((state.wavelength * 1e9).toPrecision(6)),
            d: Number((state.slitSeparation * 1e6).toPrecision(6)),
            a: Number((state.slitWidth * 1e6).toPrecision(6)),
            L: Number(state.distance.toPrecision(6)),
            hw: Number((state.halfWidth * 1e3).toPrecision(6)),
            slits: state.slitMode,
            ill: Number(state.illum.toFixed(3)),
            ph: state.phaseDeg,
            coh: Number(state.coherence.toFixed(3)),
            det: state.detMode,
            n: Number(state.photonsLog.toFixed(3)),
            seed: state.seed,
            cm: state.cmap,
            sc: state.scaleMode,
            log: state.log,
            fld: state.showField,
            env: state.showEnvelope,
            ord: state.showOrders,
        };
    }
    const inRange = (v, lo, hi) => Number.isFinite(v) && v >= lo && v <= hi;

    function setState(o) {
        if (inRange(o.lam, 380, 700)) state.wavelength = o.lam * 1e-9;
        if (inRange(o.d * 1e-6, LOG_RANGES.slitSeparation.min, LOG_RANGES.slitSeparation.max)) state.slitSeparation = o.d * 1e-6;
        if (inRange(o.a * 1e-6, LOG_RANGES.slitWidth.min, LOG_RANGES.slitWidth.max)) state.slitWidth = o.a * 1e-6;
        if (inRange(o.L, LOG_RANGES.distance.min, LOG_RANGES.distance.max)) state.distance = o.L;
        if (inRange(o.hw * 1e-3, LOG_RANGES.halfWidth.min, LOG_RANGES.halfWidth.max)) state.halfWidth = o.hw * 1e-3;
        if (MODES.slits.includes(o.slits)) state.slitMode = o.slits;
        if (inRange(o.ill, 0, 1)) state.illum = o.ill;
        if (inRange(o.ph, 0, 360)) state.phaseDeg = o.ph;
        if (inRange(o.coh, 0, 1)) state.coherence = o.coh;
        if (MODES.det.includes(o.det)) state.detMode = o.det;
        if (inRange(o.n, 1, 6)) state.photonsLog = o.n;
        if (inRange(o.seed, 1, 1e9)) state.seed = Math.round(o.seed);
        if (MODES.cm.includes(o.cm)) state.cmap = o.cm;
        if (MODES.sc.includes(o.sc)) state.scaleMode = o.sc;
        ["log", "fld", "env", "ord"].forEach((k, i) => {
            if (typeof o[k] === "boolean") state[["log", "showField", "showEnvelope", "showOrders"][i]] = o[k];
        });
        const clamped = enforceGeometry("slitSeparation");
        setNote(clamped ? "a was reduced so the slits do not overlap (a < d)." : "Slits cannot overlap: a is kept below d.", clamped);
        syncControls();
        setPreset(null);
        refresh();
    }
    let url = null;

    // first render
    syncControls();
    setPreset("textbook");
    refresh();
    url = UI.urlState({
        get: getState,
        set: setState
    });

    UI.addExportBar(el("exportHost"), {
        name: "double-slit",
        url,
        getState: () => Object.assign({
            tool: "double_slit",
            units: {
                lam: "nm",
                d: "um",
                a: "um",
                L: "m",
                hw: "mm",
                ph: "deg"
            }
        }, getState()),
        getCSV: () => {
            const {
                sample,
                hist
            } = current;
            if (hist) {
                return {
                    headers: ["bin centre y (m)", "bin low (m)", "bin high (m)", "counts", "expected counts"],
                    rows: Array.from(hist.centers, (c, i) => [c, hist.edges[i], hist.edges[i + 1], hist.counts[i], hist.expected[i]]),
                };
            }
            return {
                headers: ["y (m)", "theta (rad)", "I/I0", "upper envelope I/I0", "lower envelope I/I0"],
                rows: Array.from(sample.y, (y, i) => [y, Math.atan(y / sample.params.distance), sample.intensity[i] / 4, sample.envelope[i] / 4, sample.lowerEnvelope[i] / 4]),
            };
        },
        canvases: [schemCanvas, detCanvas, plotCanvas],
        caption: () => `Double slit (Fraunhofer): λ = ${fmtLen(state.wavelength, 4)}, d = ${fmtLen(state.slitSeparation)}, a = ${fmtLen(state.slitWidth)}, L = ${fmtLen(state.distance)}, |γ| = ${fmtNum(state.coherence)}, φ = ${state.phaseDeg}°`,
    });

    // reduced motion: never autostart; the schematic stays static until Start or Step
    if (UI.prefersReducedMotion()) startStopBtn.title = "Reduced motion is on: animation starts only on request";
})();