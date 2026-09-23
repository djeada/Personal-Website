"use strict";

/*
 * Polarization lab: ordered element bench, Jones + Mueller calculus, Poincaré sphere,
 * birefringent A-plates. Physics lives in ../shared/optics/polarization.js (pure, tested);
 * this file is page glue (state, DOM, canvases).
 */
(function() {
    const Pol = window.OpticsModels.polarization;
    const UI = window.OpticsUI;
    const DEG = Math.PI / 180;
    const MAX_ELEMENTS = 5;
    const APPROX_TOL_DEG = Pol.DEFAULT_APPROX_TOL_DEG;
    const OMEGA_DISPLAY = Math.PI; // rad/s on screen: one optical period is shown as 2 s

    const $ = (id) => document.getElementById(id);

    // ------------------------------------------------------------------ element catalogue
    const TYPES = {
        polarizer: {
            code: "P",
            short: "Pol",
            name: "Linear polarizer / analyzer",
            angleLabel: "Transmission axis θ"
        },
        hwp: {
            code: "H",
            short: "HWP",
            name: "Half-wave plate (Γ = 180°)",
            angleLabel: "Fast axis θ"
        },
        qwp: {
            code: "Q",
            short: "QWP",
            name: "Quarter-wave plate (Γ = 90°)",
            angleLabel: "Fast axis θ"
        },
        retarder: {
            code: "R",
            short: "Ret",
            name: "General linear retarder",
            angleLabel: "Fast axis θ"
        },
        plate: {
            code: "W",
            short: "Xtal",
            name: "Birefringent crystal A-plate",
            angleLabel: "Optic axis c at α"
        },
        rotator: {
            code: "O",
            short: "Rot",
            name: "Rotator (optical activity)",
            angleLabel: null
        },
        depolarizer: {
            code: "D",
            short: "Depol",
            name: "Depolarizer",
            angleLabel: null
        },
    };
    const CODE_TO_TYPE = Object.fromEntries(Object.entries(TYPES).map(([k, v]) => [v.code, k]));
    const CRYSTAL_KEYS = Object.keys(Pol.CRYSTALS);

    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    const round = (v, d) => Number(Number(v).toFixed(d));

    function quarterWaveThicknessUm(crystal, lamNm) {
        return round(Pol.plateThicknessFor(crystal, Math.PI / 2, lamNm * 1e-9) * 1e6, 2);
    }

    function defaultElement(type, angle) {
        const el = {
            type,
            a: 0,
            g: 60,
            rho: 45,
            D: 0.5,
            cr: "quartz",
            d: 17.39
        };
        if (type === "qwp" || type === "plate") el.a = 45;
        if (angle != null && TYPES[type].angleLabel) el.a = angle;
        if (type === "plate") el.d = quarterWaveThicknessUm("quartz", state.lam);
        return el;
    }

    /** UI element (degrees, µm) → model element (radians, metres). */
    function toModel(el) {
        return {
            type: el.type,
            angle: el.a * DEG,
            retardance: el.g * DEG,
            rotation: el.rho * DEG,
            depolarization: el.D,
            crystal: el.cr,
            thickness: el.d * 1e-6,
        };
    }

    // ------------------------------------------------------------------ state + URL encoding
    const DEFAULTS = {
        psi: 45,
        delta: 0,
        p: 1,
        lam: 633
    };
    const state = {
        psi: 45,
        delta: 0,
        p: 1,
        lam: 633,
        bench: [],
        sel: -1
    };

    function encodeBench(bench) {
        return bench.map((e) => {
            const c = TYPES[e.type].code;
            switch (e.type) {
                case "retarder":
                    return [c, e.a, e.g].join("~");
                case "plate":
                    return [c, e.a, e.cr, e.d].join("~");
                case "rotator":
                    return [c, e.rho].join("~");
                case "depolarizer":
                    return [c, e.D].join("~");
                default:
                    return [c, e.a].join("~");
            }
        }).join("_");
    }

    function decodeBench(str) {
        const out = [];
        for (const tok of String(str || "").split("_")) {
            if (!tok || out.length >= MAX_ELEMENTS) continue;
            const parts = tok.split("~");
            const type = CODE_TO_TYPE[parts[0]];
            if (!type) continue;
            const num = (i, lo, hi, def) => {
                const v = Number(parts[i]);
                return Number.isFinite(v) ? clamp(v, lo, hi) : def;
            };
            const el = defaultElement(type);
            if (TYPES[type].angleLabel) el.a = num(1, -90, 90, el.a);
            if (type === "retarder") el.g = num(2, 0, 360, el.g);
            if (type === "plate") {
                el.cr = CRYSTAL_KEYS.includes(parts[2]) ? parts[2] : "quartz";
                el.d = num(3, 0.1, 300, el.d);
            }
            if (type === "rotator") el.rho = num(1, -180, 180, el.rho);
            if (type === "depolarizer") el.D = num(1, 0, 1, el.D);
            out.push(el);
        }
        return out;
    }

    // ------------------------------------------------------------------ static controls
    const psiSlider = $("psiSlider"),
        deltaSlider = $("deltaSlider"),
        dopSlider = $("dopSlider"),
        lambdaSlider = $("lambdaSlider");
    UI.enhanceSlider(psiSlider, {
        unit: "°"
    });
    UI.enhanceSlider(deltaSlider, {
        unit: "°"
    });
    UI.enhanceSlider(dopSlider, {
        unit: ""
    });
    UI.enhanceSlider(lambdaSlider, {
        unit: "nm"
    });

    function readInputs() {
        state.psi = Number(psiSlider.value);
        state.delta = Number(deltaSlider.value);
        state.p = Number(dopSlider.value);
        state.lam = Number(lambdaSlider.value);
    }

    function writeInputs() {
        psiSlider.value = String(state.psi);
        deltaSlider.value = String(state.delta);
        dopSlider.value = String(state.p);
        lambdaSlider.value = String(state.lam);
    }

    [psiSlider, deltaSlider, dopSlider, lambdaSlider].forEach((s) => s.addEventListener("input", () => {
        readInputs();
        clearPreset();
        render();
    }));

    // ------------------------------------------------------------------ bench DOM
    const benchList = $("benchList"),
        benchEmpty = $("benchEmpty"),
        addType = $("addType"),
        addBtn = $("addBtn"),
        clearBtn = $("clearBtn");
    let rowRefs = [];

    function makeSlider(labelText, min, max, step, value, unit, onValue, ariaLabel) {
        const group = document.createElement("div");
        group.className = "control-group";
        const lab = document.createElement("div");
        lab.className = "control-label";
        const span = document.createElement("span");
        span.textContent = labelText;
        lab.appendChild(span);
        const input = document.createElement("input");
        input.type = "range";
        input.min = String(min);
        input.max = String(max);
        input.step = String(step);
        input.value = String(value);
        input.setAttribute("aria-label", ariaLabel);
        group.append(lab, input);
        input.addEventListener("input", () => {
            onValue(Number(input.value));
            clearPreset();
            render();
        });
        return {
            group,
            input,
            finish: () => UI.enhanceSlider(input, {
                unit,
                label: ariaLabel
            })
        };
    }

    function buildBench(focusSel) {
        benchList.textContent = "";
        rowRefs = [];
        const n = state.bench.length;
        state.bench.forEach((el, i) => {
            const li = document.createElement("li");
            li.className = "bench-row" + (i === state.sel ? " selected" : "");
            const head = document.createElement("div");
            head.className = "bench-row-head";
            const idx = document.createElement("span");
            idx.className = "bench-idx";
            idx.textContent = String(i + 1);
            idx.setAttribute("aria-hidden", "true");
            const sel = document.createElement("select");
            sel.setAttribute("aria-label", `Element ${i + 1} type`);
            for (const [k, v] of Object.entries(TYPES)) {
                const o = document.createElement("option");
                o.value = k;
                o.textContent = v.name;
                if (k === el.type) o.selected = true;
                sel.appendChild(o);
            }
            sel.addEventListener("change", () => {
                state.bench[i] = defaultElement(sel.value, el.a);
                clearPreset();
                buildBench(`[data-role="type"][data-i="${i}"]`);
                render();
            });
            sel.dataset.role = "type";
            sel.dataset.i = String(i);
            const inspect = document.createElement("label");
            inspect.className = "bench-inspect";
            const radio = document.createElement("input");
            radio.type = "radio";
            radio.name = "inspect";
            radio.checked = i === state.sel;
            radio.setAttribute("aria-label", `Inspect element ${i + 1}`);
            radio.addEventListener("change", () => {
                if (radio.checked) {
                    state.sel = i;
                    markSelected();
                    render();
                }
            });
            inspect.append(radio, document.createTextNode(" Inspect"));
            const btns = document.createElement("span");
            btns.className = "bench-btns";
            const mk = (txt, label, role, disabled, fn) => {
                const b = document.createElement("button");
                b.type = "button";
                b.className = "bench-btn";
                b.textContent = txt;
                b.setAttribute("aria-label", label);
                b.title = label;
                b.disabled = disabled;
                b.dataset.role = role;
                b.dataset.i = String(i);
                b.addEventListener("click", fn);
                btns.appendChild(b);
            };
            mk("↑", `Move element ${i + 1} earlier`, "up", i === 0, () => moveElement(i, -1));
            mk("↓", `Move element ${i + 1} later`, "down", i === n - 1, () => moveElement(i, 1));
            mk("✕", `Remove element ${i + 1}`, "remove", false, () => removeElement(i));
            head.append(idx, sel, inspect, btns);
            li.appendChild(head);

            const finishers = [];
            const add = (s) => {
                li.appendChild(s.group);
                finishers.push(s.finish);
            };
            const T = TYPES[el.type];
            if (T.angleLabel) add(makeSlider(T.angleLabel, -90, 90, 1, el.a, "°", (v) => {
                el.a = v;
            }, `Element ${i + 1} ${T.angleLabel} (degrees)`));
            if (el.type === "retarder") add(makeSlider("Retardance Γ", 0, 360, 1, el.g, "°", (v) => {
                el.g = v;
            }, `Element ${i + 1} retardance (degrees)`));
            if (el.type === "rotator") add(makeSlider("Rotation ρ", -180, 180, 1, el.rho, "°", (v) => {
                el.rho = v;
            }, `Element ${i + 1} rotation (degrees)`));
            if (el.type === "depolarizer") add(makeSlider("Depolarization D", 0, 1, 0.01, el.D, "", (v) => {
                el.D = v;
            }, `Element ${i + 1} depolarization`));
            let derived = null;
            if (el.type === "plate") {
                const g = document.createElement("div");
                g.className = "control-group";
                const l = document.createElement("label");
                l.className = "control-label";
                l.textContent = "Crystal";
                const cs = document.createElement("select");
                cs.setAttribute("aria-label", `Element ${i + 1} crystal`);
                for (const k of CRYSTAL_KEYS) {
                    const c = Pol.CRYSTALS[k];
                    const o = document.createElement("option");
                    o.value = k;
                    o.textContent = `${c.name} (Δn = ${(c.ne - c.no >= 0 ? "+" : "−") + Math.abs(c.ne - c.no).toFixed(4)})`;
                    if (k === el.cr) o.selected = true;
                    cs.appendChild(o);
                }
                const id = `crystal-${i}`;
                cs.id = id;
                l.htmlFor = id;
                cs.addEventListener("change", () => {
                    el.cr = cs.value;
                    clearPreset();
                    render();
                });
                g.append(l, cs);
                li.appendChild(g);
                add(makeSlider("Thickness d", 0.1, 300, 0.01, el.d, "µm", (v) => {
                    el.d = v;
                }, `Element ${i + 1} thickness (micrometres)`));
                const qbtn = document.createElement("button");
                qbtn.type = "button";
                qbtn.className = "bench-btn bench-wide-btn";
                qbtn.textContent = "Set zero-order λ/4 at current λ";
                qbtn.addEventListener("click", () => {
                    el.d = quarterWaveThicknessUm(el.cr, state.lam);
                    clearPreset();
                    buildBench();
                    render();
                });
                li.appendChild(qbtn);
            }
            derived = document.createElement("p");
            derived.className = "control-note bench-derived";
            li.appendChild(derived);
            benchList.appendChild(li);
            finishers.forEach((f) => f());
            rowRefs.push({
                li,
                derived,
                radio
            });
        });
        benchEmpty.hidden = n > 0;
        addBtn.disabled = n >= MAX_ELEMENTS;
        addBtn.textContent = n >= MAX_ELEMENTS ? "Bench full (5)" : "+ Add";
        clearBtn.disabled = n === 0;
        if (focusSel) {
            const f = benchList.querySelector(focusSel);
            if (f && !f.disabled) f.focus();
            else if (benchList.querySelector("select")) benchList.querySelector("select").focus();
            else addBtn.focus();
        }
    }

    function markSelected() {
        rowRefs.forEach((r, i) => {
            r.li.classList.toggle("selected", i === state.sel);
            r.radio.checked = i === state.sel;
        });
    }

    function moveElement(i, dir) {
        const j = i + dir;
        if (j < 0 || j >= state.bench.length) return;
        [state.bench[i], state.bench[j]] = [state.bench[j], state.bench[i]];
        if (state.sel === i) state.sel = j;
        else if (state.sel === j) state.sel = i;
        clearPreset();
        buildBench(`[data-role="${dir < 0 ? "up" : "down"}"][data-i="${j}"]`);
        render();
    }

    function removeElement(i) {
        state.bench.splice(i, 1);
        if (state.sel === i) state.sel = Math.min(i, state.bench.length - 1);
        else if (state.sel > i) state.sel--;
        clearPreset();
        buildBench(`[data-role="remove"][data-i="${Math.min(i, state.bench.length - 1)}"]`);
        render();
    }

    addBtn.addEventListener("click", () => {
        if (state.bench.length >= MAX_ELEMENTS) return;
        state.bench.push(defaultElement(addType.value));
        state.sel = state.bench.length - 1;
        clearPreset();
        buildBench(`[data-role="type"][data-i="${state.sel}"]`);
        render();
    });

    clearBtn.addEventListener("click", () => {
        state.bench = [];
        state.sel = -1;
        clearPreset();
        buildBench();
        addBtn.focus();
        render();
    });

    // ------------------------------------------------------------------ presets
    const P = (a) => ({
        type: "polarizer",
        a
    });
    const PRESETS = {
        linear: {
            psi: 45,
            delta: 0,
            p: 1,
            bench: [],
            note: "Linear at 45°: a straight line in the ellipse plot, the +S₂ point (+45°) on the sphere's equator."
        },
        rcp: {
            psi: 45,
            delta: 90,
            p: 1,
            bench: [],
            note: "Right-handed circular (δ = +90°): counter-clockwise facing the source, S₃ = +1 at the north pole (R)."
        },
        elliptical: {
            psi: 30,
            delta: 60,
            p: 1,
            bench: [],
            note: "ψ = 30°, δ = 60°: tan 2θ = tan 60° cos 60° gives θ ≈ 40.9°, sin 2χ = sin 60° sin 60° gives χ ≈ 24.3°."
        },
        malus: {
            psi: 0,
            delta: 0,
            p: 1,
            bench: [P(30)],
            note: "Horizontal light through an analyzer at 30°: I/I₀ = cos²30° = 0.750. The scan plot is Malus's cos² law."
        },
        unpol: {
            psi: 0,
            delta: 0,
            p: 0,
            bench: [P(20)],
            note: "Unpolarized light (p = 0) through a polarizer: I/I₀ = 0.500 at every angle (flat scan), and the output is fully polarized (DoP = 1)."
        },
        three: {
            psi: 0,
            delta: 0,
            p: 0,
            bench: [P(0), P(45), P(90)],
            sel: 1,
            note: "Unpolarized → 0°, 45°, 90°: I/I₀ = ½·½·½ = 0.125. Remove the middle polarizer and the output drops to 0; the scan is ⅛ sin² 2θ."
        },
        qwp: {
            psi: 0,
            delta: 0,
            p: 1,
            bench: [{
                type: "qwp",
                a: 45
            }],
            note: "H light, QWP fast axis +45°: circular with S₃ = −1 (left-handed in the IEEE convention). Set −45° to get right-handed."
        },
        hwp: {
            psi: 10,
            delta: 0,
            p: 1,
            bench: [{
                type: "hwp",
                a: 30
            }],
            note: "Linear at 10° through a HWP with fast axis 30°: mirrored about the axis to 50°; I/I₀ stays 1.000."
        },
        twohwp: {
            psi: 0,
            delta: 0,
            p: 1,
            bench: [{
                type: "hwp",
                a: 0
            }, {
                type: "hwp",
                a: 22.5
            }],
            sel: 1,
            note: "HWPs at 0° then 22.5° act as a 45° rotator: H becomes linear at 45° (compare a single rotator with ρ = 45°)."
        },
        quartz: {
            psi: 0,
            delta: 0,
            p: 1,
            lam: 633,
            bench: [{
                type: "plate",
                a: 45,
                cr: "quartz",
                d: 17.39
            }],
            note: "Quartz A-plate, c at 45°, d = 17.39 µm at 633 nm: Γ = 0.250 waves, fast axis (o) at 135°, right-handed circular. Move λ to 532 nm: Γ ≈ 0.297 waves, elliptical."
        },
        depol: {
            psi: 0,
            delta: 0,
            p: 0.8,
            bench: [{
                type: "qwp",
                a: 45
            }, {
                type: "depolarizer",
                D: 0.5
            }],
            sel: 1,
            note: "p = 0.8 input: the QWP keeps DoP = 0.80 (rotation of the sphere); the depolarizer (D = 0.5) halves it to 0.40 and moves the point toward the centre."
        },
    };
    const presetButtons = Array.from(document.querySelectorAll("[data-preset]"));
    const presetNote = $("presetNote");
    let activePreset = null;

    function clearPreset() {
        if (!activePreset) return;
        activePreset = null;
        presetButtons.forEach((b) => {
            b.classList.remove("active");
            b.setAttribute("aria-pressed", "false");
        });
    }

    function applyPreset(key) {
        const pr = PRESETS[key];
        if (!pr) return;
        state.psi = pr.psi;
        state.delta = pr.delta;
        state.p = pr.p;
        if (pr.lam) state.lam = pr.lam;
        state.bench = pr.bench.map((e) => Object.assign(defaultElement(e.type), e));
        state.sel = pr.sel != null ? pr.sel : state.bench.length - 1;
        writeInputs();
        buildBench();
        activePreset = key;
        presetButtons.forEach((b) => {
            const on = b.dataset.preset === key;
            b.classList.toggle("active", on);
            b.setAttribute("aria-pressed", String(on));
        });
        presetNote.textContent = "Expected: " + pr.note;
        render();
    }
    presetButtons.forEach((b) => {
        b.setAttribute("aria-pressed", "false");
        b.addEventListener("click", () => applyPreset(b.dataset.preset));
    });

    // ------------------------------------------------------------------ physics
    let result = null;
    const ctxModel = () => ({
        wavelength: state.lam * 1e-9
    });

    function compute() {
        const els = state.bench.map(toModel);
        result = Pol.propagate({
            psi: state.psi * DEG,
            delta: state.delta * DEG,
            dop: state.p,
            I: 1
        }, els, ctxModel(), {
            approxTolDeg: APPROX_TOL_DEG
        });
        result.stages = [result.input, ...result.steps];
        result.models = els;
    }

    /** Jones vector to draw for a stage: exact when available, else the polarized part from Stokes. */
    function stageJones(st) {
        return st.J || Pol.jonesFromStokes(st.S);
    }

    // ------------------------------------------------------------------ formatting
    function fmtNum(x, digits = 3) {
        if (!Number.isFinite(x)) return "—";
        const v = Math.abs(x) < 5 * Math.pow(10, -digits - 1) ? 0 : x;
        return v.toFixed(digits).replace("-", "−");
    }

    function fmtDeg(rad, digits = 1) {
        if (!Number.isFinite(rad)) return "undefined";
        const d = rad / DEG;
        return (Math.abs(d) < 0.05 ? 0 : d).toFixed(digits).replace("-", "−") + "°";
    }

    function fmtComplex(z, digits = 3) {
        const eps = 5 * Math.pow(10, -digits - 1);
        const re = Math.abs(z.re) < eps ? 0 : z.re;
        const im = Math.abs(z.im) < eps ? 0 : z.im;
        const f = (v) => Math.abs(v).toFixed(digits);
        if (im === 0) return (re < 0 ? "−" : "") + f(re);
        if (re === 0) return (im < 0 ? "−" : "") + f(im) + "i";
        return (re < 0 ? "−" : "") + f(re) + (im < 0 ? " − " : " + ") + f(im) + "i";
    }

    function typeLabel(d) {
        if (d.type === "none") return "No light";
        if (d.type === "unpolarized") return "Unpolarized";
        const name = d.type.charAt(0).toUpperCase() + d.type.slice(1);
        const base = d.exact ? name : "≈ " + name;
        return d.dop < 1 - 1e-9 ? "Partially pol. (" + base.toLowerCase() + ")" : base;
    }

    function handLabel(d) {
        if (d.handedness === "right") return "Right (CCW)";
        if (d.handedness === "left") return "Left (CW)";
        return d.type === "none" || d.type === "unpolarized" ? "—" : "None (linear)";
    }
    const orientLabel = (d) => (d.type === "circular" && d.exact) || d.type === "unpolarized" || d.type === "none" ? "undefined" : fmtDeg(d.orientation);

    function elementSummary(el) {
        const T = TYPES[el.type];
        switch (el.type) {
            case "retarder":
                return `${T.short} θ=${el.a}° Γ=${el.g}°`;
            case "plate":
                return `${Pol.CRYSTALS[el.cr].name.split(" ").pop()} c=${el.a}° d=${el.d} µm`;
            case "rotator":
                return `${T.short} ρ=${el.rho}°`;
            case "depolarizer":
                return `${T.short} D=${el.D}`;
            default:
                return `${T.short} ${el.a}°`;
        }
    }

    function matrixHTML(M, fmt, cols) {
        return `<span class="jm-bracket">[</span><span class="jm-grid" style="grid-template-columns: repeat(${cols}, auto)">` +
            M.map((row) => row.map((v) => `<span>${fmt(v)}</span>`).join("")).join("") +
            `</span><span class="jm-bracket">]</span>`;
    }

    // ------------------------------------------------------------------ readouts
    const el$ = {
        trans: $("stat-trans"),
        dop: $("stat-dop"),
        type: $("stat-type"),
        orient: $("stat-orient"),
        chi: $("stat-chi"),
        hand: $("stat-hand"),
        count: $("stat-count"),
        rI: $("rI"),
        rDop: $("rDop"),
        rType: $("rType"),
        rTheta: $("rTheta"),
        rChi: $("rChi"),
        rSel: $("rSel"),
        elementName: $("elementName"),
        jones: $("jonesMatrix"),
        mueller: $("muellerMatrix"),
        stepBody: $("stepBody"),
        fieldBadge: $("fieldBadge"),
    };

    function updateReadouts() {
        const out = result.output.desc;
        el$.trans.textContent = fmtNum(out.S0);
        el$.dop.textContent = out.type === "none" ? "—" : fmtNum(out.dop);
        el$.type.textContent = typeLabel(out);
        el$.orient.textContent = orientLabel(out);
        el$.chi.textContent = fmtDeg(out.ellipticity);
        el$.hand.textContent = handLabel(out);
        el$.count.textContent = `${state.bench.length} / ${MAX_ELEMENTS}`;
        el$.rI.textContent = fmtNum(out.S0, 4);
        el$.rDop.textContent = out.type === "none" ? "—" : fmtNum(out.dop, 4);
        el$.rType.textContent = typeLabel(out) + (out.handedness !== "none" ? ", " + handLabel(out).toLowerCase() : "");
        el$.rTheta.textContent = orientLabel(out);
        el$.rChi.textContent = fmtDeg(out.ellipticity, 2);

        const sel = state.sel;
        if (sel >= 0 && sel < state.bench.length) {
            const st = result.steps[sel],
                el = state.bench[sel];
            el$.rSel.textContent = `${sel + 1}: ${elementSummary(el)}`;
            el$.elementName.textContent = `Element ${sel + 1}: ${TYPES[el.type].name}`;
            el$.jones.innerHTML = st.jones ? matrixHTML(st.jones, (z) => fmtComplex(z), 2) : `<span class="jm-none">none: a depolarizer is not a deterministic (Jones) element</span>`;
            el$.mueller.innerHTML = matrixHTML(st.mueller, (v) => fmtNum(v), 4);
            el$.fieldBadge.textContent = `before → after element ${sel + 1}`;
        } else {
            el$.rSel.textContent = "none";
            el$.elementName.textContent = "No element inspected (add one to the bench)";
            el$.jones.innerHTML = matrixHTML(Pol.identity(), (z) => fmtComplex(z), 2);
            el$.mueller.innerHTML = matrixHTML([
                [1, 0, 0, 0],
                [0, 1, 0, 0],
                [0, 0, 1, 0],
                [0, 0, 0, 1]
            ], (v) => fmtNum(v), 4);
            el$.fieldBadge.textContent = "input";
        }

        // per-stage table
        el$.stepBody.innerHTML = result.stages.map((st, k) => {
            const d = st.desc;
            const name = k === 0 ? "Input" : `${k}. ${elementSummary(state.bench[k - 1])}`;
            const jv = st.J ? `(${fmtComplex(st.J[0])}, ${fmtComplex(st.J[1])})` : `<span class="muted">— (p &lt; 1: Stokes only)</span>`;
            const cls = k - 1 === state.sel ? ' class="is-selected"' : "";
            return `<tr${cls}><th scope="row">${name}</th><td>${jv}</td><td>${fmtNum(d.S0)}</td><td>${fmtNum(d.S1)}</td><td>${fmtNum(d.S2)}</td><td>${fmtNum(d.S3)}</td>` +
                `<td>${d.type === "none" ? "—" : fmtNum(d.dop)}</td><td>${typeLabel(d)}${d.handedness !== "none" ? " " + (d.handedness === "right" ? "R" : "L") : ""}</td>` +
                `<td>${orientLabel(d)}</td><td>${fmtDeg(d.ellipticity)}</td></tr>`;
        }).join("");

        // derived notes in bench rows
        state.bench.forEach((el, i) => {
            const r = rowRefs[i];
            if (!r) return;
            const st = result.steps[i];
            let txt = `After: I/I₀ = ${fmtNum(st.desc.S0)}, DoP = ${st.desc.type === "none" ? "—" : fmtNum(st.desc.dop)}, ${typeLabel(st.desc).toLowerCase()}.`;
            if (el.type === "plate") {
                const g = Pol.plateGeometry(el.cr, el.a * DEG, el.d * 1e-6, state.lam * 1e-9);
                txt = `Δn = ${(g.dn >= 0 ? "+" : "−") + Math.abs(g.dn).toFixed(4)} (${g.positive ? "positive" : "negative"}), fast axis (${g.fastRay}-wave) at ${fmtAngle180(g.fastAxis)}, Γ = ${g.waves.toFixed(3)} waves (${(g.effectiveRetardance / DEG).toFixed(1)}° mod 360°). ` + txt;
            }
            r.derived.textContent = txt;
        });
    }

    /** Axis angle reduced to (−90°, 90°]. */
    function fmtAngle180(rad) {
        let d = rad / DEG;
        d = ((d + 90) % 180 + 180) % 180 - 90;
        if (d <= -89.95) d += 180;
        return d.toFixed(1).replace("-", "−") + "°";
    }

    // ------------------------------------------------------------------ drawing helpers
    const PAL = UI.CANVAS_PALETTE;
    const stageColor = (k) => (k === 0 ? "#ffffff" : PAL.series[(k - 1) % PAL.series.length]);
    const font = (px, weight = "") => `${weight ? weight + " " : ""}${px}px ${PAL.font}`;
    let tNow = 0; // display time (s)
    const phaseNow = () => -OMEGA_DISPLAY * tNow; // kz − ωt at z = 0

    function fillBg(ctx, w, h) {
        ctx.fillStyle = PAL.background;
        ctx.fillRect(0, 0, w, h);
    }

    function arrow(ctx, ax, ay, bx, by, color, width = 2.5, head = 10) {
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();
        if (Math.hypot(bx - ax, by - ay) < 3) return;
        const A = Math.atan2(by - ay, bx - ax);
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx - head * Math.cos(A - Math.PI / 7), by - head * Math.sin(A - Math.PI / 7));
        ctx.lineTo(bx - head * Math.cos(A + Math.PI / 7), by - head * Math.sin(A + Math.PI / 7));
        ctx.closePath();
        ctx.fill();
    }

    function textBox(ctx, lines, x, y, size, align = "left") {
        ctx.font = font(size);
        ctx.textAlign = align;
        ctx.textBaseline = "alphabetic";
        lines.forEach(([txt, color], i) => {
            ctx.fillStyle = color || PAL.textMuted;
            ctx.fillText(txt, x, y + i * (size + 4));
        });
    }

    // ------------------------------------------------------------------ field ellipse canvas
    function drawField(ctx, w, h) {
        fillBg(ctx, w, h);
        const fs = w < 420 ? 11 : 12;
        const cx = w / 2,
            cy = h / 2 + 4;
        const R = Math.min(w * 0.36, (h - 56) / 2.3);
        // axes
        ctx.strokeStyle = PAL.axis;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(cx - 1.25 * R, cy);
        ctx.lineTo(cx + 1.25 * R, cy);
        ctx.moveTo(cx, cy - 1.2 * R);
        ctx.lineTo(cx, cy + 1.2 * R);
        ctx.stroke();
        ctx.strokeStyle = PAL.grid;
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.arc(cx, cy, R, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.strokeStyle = PAL.axis;
        ctx.beginPath();
        for (const s of [-1, -0.5, 0.5, 1]) {
            ctx.moveTo(cx + s * R, cy - 4);
            ctx.lineTo(cx + s * R, cy + 4);
            ctx.moveTo(cx - 4, cy - s * R);
            ctx.lineTo(cx + 4, cy - s * R);
        }
        ctx.stroke();
        ctx.fillStyle = PAL.textMuted;
        ctx.font = font(fs);
        ctx.textAlign = "center";
        ctx.fillText("1", cx + R, cy + fs + 5);
        ctx.fillText("−1", cx - R, cy + fs + 5);
        ctx.textAlign = "left";
        ctx.fillText("1", cx + 7, cy - R + 4);
        ctx.fillStyle = PAL.text;
        ctx.textAlign = "right";
        ctx.fillText("Ex/E₀", cx + 1.25 * R, cy - 7);
        ctx.textAlign = "left";
        ctx.fillText("Ey/E₀", cx + 7, cy - 1.2 * R + fs);
        // +z out of screen
        const zx = cx - 18,
            zy = cy + 18;
        ctx.strokeStyle = PAL.textMuted;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.arc(zx, zy, 6, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.fillStyle = PAL.textMuted;
        ctx.beginPath();
        ctx.arc(zx, zy, 1.8, 0, 2 * Math.PI);
        ctx.fill();
        ctx.font = font(fs);
        ctx.textAlign = "right";
        ctx.fillText("+z", zx - 9, zy + 4);

        const sel = state.sel;
        const hasSel = sel >= 0 && sel < state.bench.length;
        const before = hasSel ? result.stages[sel] : null;
        const after = hasSel ? result.stages[sel + 1] : result.stages[0];
        const afterColor = hasSel ? stageColor(sel + 1) : stageColor(0);

        // element axes
        if (hasSel) {
            const el = state.bench[sel];
            const par = Pol.elementRetarderParams(toModel(el), ctxModel());
            const axisLine = (ang, color, dash, label) => {
                const c = Math.cos(ang),
                    s = Math.sin(ang),
                    L = 1.18 * R;
                ctx.strokeStyle = color;
                ctx.lineWidth = 1.6;
                ctx.setLineDash(dash);
                ctx.beginPath();
                ctx.moveTo(cx - c * L, cy + s * L);
                ctx.lineTo(cx + c * L, cy - s * L);
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.fillStyle = color;
                ctx.font = font(fs);
                ctx.textAlign = c >= 0 ? "left" : "right";
                ctx.fillText(label, cx + c * L + (c >= 0 ? 3 : -3), cy - s * L - 3);
            };
            if (el.type === "polarizer") axisLine(el.a * DEG, "#7ee787", [9, 5], "transmission");
            else if (par) {
                axisLine(par.fast, "#7ee787", [9, 5], "fast");
                if (el.type === "plate") axisLine(el.a * DEG, PAL.marker, [2, 4], "c");
            }
        }

        const drawStage = (st, color, dashed, width) => {
            const d = st.desc;
            const Sp = Math.hypot(st.S.S1, st.S.S2, st.S.S3);
            const Iu = Math.max(0, st.S.S0 - Sp);
            if (!dashed && Iu > 1e-6) {
                ctx.fillStyle = "rgba(184, 178, 207, 0.12)";
                ctx.strokeStyle = "rgba(184, 178, 207, 0.35)";
                ctx.lineWidth = 1;
                ctx.setLineDash([2, 3]);
                ctx.beginPath();
                ctx.arc(cx, cy, R * Math.sqrt(Iu), 0, 2 * Math.PI);
                ctx.fill();
                ctx.stroke();
                ctx.setLineDash([]);
            }
            if (Sp < 1e-9) return;
            const J = stageJones(st);
            ctx.beginPath();
            for (let i = 0; i <= 180; i++) {
                const e = Pol.fieldAt(J, 2 * Math.PI * i / 180);
                const px = cx + e.x * R,
                    py = cy - e.y * R;
                i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
            }
            ctx.strokeStyle = color;
            ctx.lineWidth = width;
            ctx.setLineDash(dashed ? [6, 5] : []);
            ctx.stroke();
            ctx.setLineDash([]);
            if (!dashed && d.handedness !== "none" && d.type !== "linear") {
                // time-sense arrowhead: phase −ωt decreases with time
                const a = Pol.fieldAt(J, 1.0),
                    b = Pol.fieldAt(J, 0.88);
                const ax = cx + a.x * R,
                    ay = cy - a.y * R,
                    bx = cx + b.x * R,
                    by = cy - b.y * R;
                const A = Math.atan2(by - ay, bx - ax),
                    hd = 11;
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.moveTo(bx, by);
                ctx.lineTo(bx - hd * Math.cos(A - Math.PI / 6), by - hd * Math.sin(A - Math.PI / 6));
                ctx.lineTo(bx - hd * Math.cos(A + Math.PI / 6), by - hd * Math.sin(A + Math.PI / 6));
                ctx.closePath();
                ctx.fill();
            }
        };
        if (before) drawStage(before, "rgba(236, 233, 248, 0.6)", true, 1.8);
        drawStage(after, afterColor, false, 2.8);
        // instantaneous vectors
        const ph = phaseNow();
        if (before && Math.hypot(before.S.S1, before.S.S2, before.S.S3) > 1e-9) {
            const e = Pol.fieldAt(stageJones(before), ph);
            arrow(ctx, cx, cy, cx + e.x * R, cy - e.y * R, "rgba(236, 233, 248, 0.55)", 1.6, 8);
        }
        if (Math.hypot(after.S.S1, after.S.S2, after.S.S3) > 1e-9) {
            const e = Pol.fieldAt(stageJones(after), ph);
            arrow(ctx, cx, cy, cx + e.x * R, cy - e.y * R, "#ff6b6b", 2.6, 10);
        }
        // legend
        const lines = [];
        if (before) lines.push([sel === 0 ? "- - input (before element 1)" : `- - after element ${sel}`, PAL.textMuted]);
        lines.push([hasSel ? `— after element ${sel + 1}` : "— input (no element inspected)", afterColor]);
        lines.push(["→ instantaneous E (polarized part)", "#ff8f8f"]);
        if (after.S.S0 - Math.hypot(after.S.S1, after.S.S2, after.S.S3) > 1e-6) lines.push(["◯ unpolarized part, radius √I_u", PAL.textMuted]);
        textBox(ctx, lines, 10, fs + 6, fs);
        ctx.font = font(fs);
        ctx.textAlign = "left";
        ctx.fillStyle = PAL.textMuted;
        ctx.fillText("Facing the source: CCW = right-handed (S₃ > 0)", 10, h - 8);
    }

    // ------------------------------------------------------------------ Poincaré sphere
    const VIEW0 = {
        yaw: -120 * DEG,
        pitch: 22 * DEG
    };
    const view = {
        yaw: VIEW0.yaw,
        pitch: VIEW0.pitch
    };

    function sphereProject(s, cx, cy, R) {
        const cyw = Math.cos(view.yaw),
            syw = Math.sin(view.yaw);
        const xp = s[0] * cyw - s[1] * syw,
            yp = s[0] * syw + s[1] * cyw,
            zp = s[2];
        const u = xp,
            v0 = zp,
            w0 = -yp;
        const cp = Math.cos(view.pitch),
            sp = Math.sin(view.pitch);
        const v = v0 * cp - w0 * sp,
            w = v0 * sp + w0 * cp;
        return {
            x: cx + R * u,
            y: cy - R * v,
            depth: w
        };
    }

    const normS = (S) => (S.S0 > 1e-9 ? [S.S1 / S.S0, S.S2 / S.S0, S.S3 / S.S0] : null);

    function drawSphere(ctx, w, h) {
        fillBg(ctx, w, h);
        const fs = w < 420 ? 11 : 12;
        const cx = w / 2,
            cy = h / 2 + 6;
        const R = Math.min(w, h) * 0.36;
        // body
        const grad = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.35, R * 0.1, cx, cy, R);
        grad.addColorStop(0, "rgba(167, 139, 250, 0.16)");
        grad.addColorStop(1, "rgba(167, 139, 250, 0.03)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, R, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = PAL.gridStrong;
        ctx.lineWidth = 1.2;
        ctx.stroke();
        // great circles: equator (S3 = 0), S2 = 0 and S1 = 0 meridians
        const circle = (fn, color) => {
            const n = 120;
            for (let i = 0; i < n; i++) {
                const a = sphereProject(fn(2 * Math.PI * i / n), cx, cy, R),
                    b = sphereProject(fn(2 * Math.PI * (i + 1) / n), cx, cy, R);
                const front = a.depth + b.depth >= 0;
                ctx.strokeStyle = front ? color : "rgba(184, 178, 207, 0.12)";
                ctx.lineWidth = front ? 1.1 : 1;
                ctx.setLineDash(front ? [] : [2, 3]);
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.stroke();
            }
            ctx.setLineDash([]);
        };
        circle((t) => [Math.cos(t), Math.sin(t), 0], "rgba(184, 178, 207, 0.45)");
        circle((t) => [Math.cos(t), 0, Math.sin(t)], PAL.grid);
        circle((t) => [0, Math.cos(t), Math.sin(t)], PAL.grid);
        // axes + pole labels
        const axes = [
            [
                [1, 0, 0], "H", "S₁"
            ],
            [
                [-1, 0, 0], "V", ""
            ],
            [
                [0, 1, 0], "+45°", "S₂"
            ],
            [
                [0, -1, 0], "−45°", ""
            ],
            [
                [0, 0, 1], "R", "S₃"
            ],
            [
                [0, 0, -1], "L", ""
            ],
        ];
        const o = sphereProject([0, 0, 0], cx, cy, R);
        ctx.font = font(fs);
        for (const [v, lab, axisName] of axes) {
            const p = sphereProject(v, cx, cy, R),
                q = sphereProject(v.map((x) => x * 1.2), cx, cy, R);
            ctx.strokeStyle = p.depth >= 0 ? PAL.axis : "rgba(143, 137, 168, 0.35)";
            ctx.lineWidth = 1;
            ctx.setLineDash(p.depth >= 0 ? [] : [3, 3]);
            ctx.beginPath();
            ctx.moveTo(o.x, o.y);
            ctx.lineTo(q.x, q.y);
            ctx.stroke();
            ctx.setLineDash([]);
            const lx = sphereProject(v.map((x) => x * 1.33), cx, cy, R);
            ctx.fillStyle = p.depth >= -0.05 ? PAL.text : PAL.textMuted;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(axisName ? `${lab} (+${axisName})` : lab, lx.x, lx.y);
        }
        ctx.textBaseline = "alphabetic";
        // element paths and points
        const stages = result.stages;
        for (let k = 1; k < stages.length; k++) {
            const path = Pol.elementPath(result.models[k - 1], stages[k - 1].S, ctxModel(), 48).map(normS).filter(Boolean);
            ctx.strokeStyle = stageColor(k);
            ctx.lineWidth = 2;
            ctx.setLineDash(PAL.dashes[(k - 1) % PAL.dashes.length]);
            for (let i = 0; i + 1 < path.length; i++) {
                const a = sphereProject(path[i], cx, cy, R),
                    b = sphereProject(path[i + 1], cx, cy, R);
                ctx.globalAlpha = a.depth + b.depth >= 0 ? 1 : 0.4;
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
            ctx.setLineDash([]);
        }
        stages.forEach((st, k) => {
            const s = normS(st.S);
            if (!s) return;
            const p = sphereProject(s, cx, cy, R);
            ctx.globalAlpha = p.depth >= 0 ? 1 : 0.55;
            ctx.beginPath();
            ctx.arc(p.x, p.y, k === 0 ? 6 : 5, 0, 2 * Math.PI);
            if (k === 0) {
                ctx.strokeStyle = "#ffffff";
                ctx.lineWidth = 2;
                ctx.stroke();
            } else {
                ctx.fillStyle = stageColor(k);
                ctx.fill();
                ctx.strokeStyle = PAL.background;
                ctx.lineWidth = 1;
                ctx.stroke();
            }
            ctx.fillStyle = k === 0 ? "#ffffff" : stageColor(k);
            ctx.font = font(fs, "600");
            ctx.textAlign = "left";
            ctx.fillText(k === 0 ? "in" : String(k), p.x + 8, p.y - 6);
            ctx.globalAlpha = 1;
        });
        const lines = [
            ["○ input, ● after element k", PAL.textMuted]
        ];
        const ext = stages.findIndex((st) => st.S.S0 <= 1e-9);
        if (ext > 0) lines.push([`extinction after element ${ext}: no point`, PAL.warning]);
        textBox(ctx, lines, 10, fs + 6, fs);
        ctx.font = font(fs);
        ctx.fillStyle = PAL.textMuted;
        ctx.textAlign = "left";
        ctx.fillText("radius = DoP; drag to rotate", 10, h - 8);
    }

    // ------------------------------------------------------------------ bench (field along z)
    function drawBench(ctx, w, h) {
        fillBg(ctx, w, h);
        const fs = w < 520 ? 11 : 12;
        const n = state.bench.length;
        const left = 34,
            right = w - 22;
        const cy = h * 0.58;
        const A = Math.min(h * 0.26, 70);
        const ox = A * 0.42 * Math.cos(35 * DEG),
            oy = A * 0.42 * Math.sin(35 * DEG); // +x recedes up-right
        const proj = (x, y, zpx) => ({
            x: zpx + ox * x,
            y: cy - A * y - oy * x
        });
        const segs = n + 1,
            segW = (right - left) / segs;
        const cyclesPerSeg = segW > 120 ? 1.5 : 1;
        // z axis
        arrow(ctx, left - 10, cy, right + 12, cy, PAL.axis, 1.2, 8);
        ctx.fillStyle = PAL.textMuted;
        ctx.font = font(fs);
        ctx.textAlign = "right";
        ctx.fillText("+z", right + 12, cy + fs + 6);
        // triad
        ctx.textAlign = "left";
        const tri = {
            x: left - 4,
            y: 34
        };
        arrow(ctx, tri.x, tri.y, tri.x, tri.y - 22, PAL.textMuted, 1.2, 6);
        arrow(ctx, tri.x, tri.y, tri.x + 18 * Math.cos(35 * DEG), tri.y - 18 * Math.sin(35 * DEG), PAL.textMuted, 1.2, 6);
        ctx.fillStyle = PAL.textMuted;
        ctx.fillText("Ey", tri.x + 4, tri.y - 22);
        ctx.fillText("Ex (into page)", tri.x + 20, tri.y - 8);
        const ph = phaseNow();
        for (let k = 0; k < segs; k++) {
            const st = result.stages[k];
            const z0 = left + k * segW,
                z1 = z0 + segW;
            const color = stageColor(k);
            const Sp = Math.hypot(st.S.S1, st.S.S2, st.S.S3);
            if (Sp > 1e-9) {
                const J = stageJones(st);
                const m = Math.max(40, Math.round(segW));
                // stems
                ctx.strokeStyle = color;
                ctx.globalAlpha = 0.28;
                ctx.lineWidth = 1;
                ctx.beginPath();
                for (let i = 0; i <= m; i += 4) {
                    const zpx = z0 + (z1 - z0) * i / m;
                    const e = Pol.fieldAt(J, 2 * Math.PI * cyclesPerSeg * (zpx - left) / segW + ph);
                    const p = proj(e.x, e.y, zpx);
                    ctx.moveTo(zpx, cy);
                    ctx.lineTo(p.x, p.y);
                }
                ctx.stroke();
                ctx.globalAlpha = 1;
                ctx.beginPath();
                for (let i = 0; i <= m; i++) {
                    const zpx = z0 + (z1 - z0) * i / m;
                    const e = Pol.fieldAt(J, 2 * Math.PI * cyclesPerSeg * (zpx - left) / segW + ph);
                    const p = proj(e.x, e.y, zpx);
                    i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y);
                }
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;
                ctx.stroke();
            } else {
                ctx.fillStyle = PAL.textMuted;
                ctx.font = font(fs);
                ctx.textAlign = "center";
                ctx.fillText(st.S.S0 > 1e-9 ? "unpolarized" : "no light", (z0 + z1) / 2, cy - 8);
            }
            // segment label
            const d = st.desc;
            ctx.fillStyle = color;
            ctx.font = font(fs);
            ctx.textAlign = "center";
            const lab = `I=${fmtNum(d.S0, 2)}${segW > 95 ? `  p=${d.type === "none" ? "—" : fmtNum(d.dop, 2)}` : ""}`;
            ctx.fillText(lab, (z0 + z1) / 2 + (k === segs - 1 ? -4 : 0), h - 8);
            // element plane at z1
            if (k < n) {
                const el = state.bench[k];
                const S = 1.25;
                const corners = [
                    [-S, -S],
                    [S, -S],
                    [S, S],
                    [-S, S]
                ].map(([x, y]) => proj(x, y, z1));
                const selected = k === state.sel;
                ctx.fillStyle = selected ? "rgba(248, 212, 119, 0.12)" : "rgba(126, 231, 135, 0.07)";
                ctx.strokeStyle = selected ? PAL.marker : "rgba(126, 231, 135, 0.55)";
                ctx.lineWidth = selected ? 1.8 : 1.2;
                ctx.beginPath();
                corners.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                const par = Pol.elementRetarderParams(toModel(el), ctxModel());
                const ang = el.type === "polarizer" ? el.a * DEG : par ? par.fast : null;
                if (ang != null) {
                    const a = proj(-Math.cos(ang) * S, -Math.sin(ang) * S, z1),
                        b = proj(Math.cos(ang) * S, Math.sin(ang) * S, z1);
                    ctx.strokeStyle = "#7ee787";
                    ctx.setLineDash([6, 4]);
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.moveTo(a.x, a.y);
                    ctx.lineTo(b.x, b.y);
                    ctx.stroke();
                    ctx.setLineDash([]);
                } else if (el.type === "rotator") {
                    const c = proj(0, 0, z1);
                    ctx.strokeStyle = "#7ee787";
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.ellipse(c.x, c.y, A * 0.35, A * 0.5, 0, -0.5, Math.PI * 1.3);
                    ctx.stroke();
                }
                const top = proj(-S, S, z1);
                ctx.fillStyle = selected ? PAL.marker : PAL.text;
                ctx.font = font(fs, selected ? "600" : "");
                ctx.textAlign = "center";
                const topY = Math.min(...corners.map((q) => q.y));
                ctx.fillText(`${k + 1} ${TYPES[el.type].short}`, top.x + ox * 1.25, Math.max(fs + 2, topY - 5));
            }
        }
        if (n === 0) {
            ctx.fillStyle = PAL.textMuted;
            ctx.font = font(fs);
            ctx.textAlign = "center";
            ctx.fillText("Add elements in the Optical bench card; each appears here as a plane.", w / 2, fs + 6);
        }
    }

    // ------------------------------------------------------------------ crystal (o/e) canvas
    const QUARTZ_DN = Pol.CRYSTALS.quartz.ne - Pol.CRYSTALS.quartz.no;

    function crystalInfo() {
        const sel = state.sel;
        if (sel < 0 || sel >= state.bench.length) return null;
        const el = state.bench[sel];
        const lam = state.lam * 1e-9;
        if (el.type === "plate") return {
            el,
            g: Pol.plateGeometry(el.cr, el.a * DEG, el.d * 1e-6, lam),
            equivalent: false
        };
        const par = Pol.elementRetarderParams(toModel(el), ctxModel());
        if (!par) return {
            el,
            g: null
        };
        // ideal retarder drawn as the equivalent zero-order quartz A-plate (positive: c ⊥ fast axis)
        const gam = ((par.retardance % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
        const d = gam / (2 * Math.PI) * lam / QUARTZ_DN;
        return {
            el,
            g: Pol.plateGeometry("quartz", par.fast - Math.PI / 2, d, lam),
            equivalent: true
        };
    }

    function drawCrystal(ctx, w, h) {
        fillBg(ctx, w, h);
        const fs = w < 520 ? 11 : 12;
        const info = crystalInfo();
        crystalBadge.textContent = info && info.g ? (info.equivalent ? "equivalent quartz A-plate" : `${info.g.name} A-plate`) : "A-plate";
        if (!info || !info.g) {
            ctx.fillStyle = PAL.textMuted;
            ctx.font = font(fs + 1);
            ctx.textAlign = "center";
            const msg = state.bench.length ? "Inspect a wave plate, retarder or crystal plate to see its o/e decomposition." : "Add a crystal plate or wave plate to the bench.";
            wrapText(ctx, msg, w / 2, h / 2, w - 40, fs + 5);
            return;
        }
        const {
            g
        } = info;
        const stIn = result.stages[state.sel];
        const Jin = stageJones(stIn);
        const f = [Math.cos(g.fastAxis), Math.sin(g.fastAxis)],
            s = [Math.cos(g.slowAxis), Math.sin(g.slowAxis)];
        const proj = (u) => ({
            re: u[0] * Jin[0].re + u[1] * Jin[1].re,
            im: u[0] * Jin[0].im + u[1] * Jin[1].im
        });
        const cf = proj(f),
            cs = proj(s);
        const af = Math.hypot(cf.re, cf.im),
            as = Math.hypot(cs.re, cs.im);
        const phi0 = Math.atan2(cs.im, cs.re) - Math.atan2(cf.im, cf.re);
        const FAST = PAL.series[0],
            SLOW = PAL.series[2];

        // --- front view (left)
        const stacked = w < 560;
        const sq = stacked ? Math.min(h * 0.42, w * 0.6) : Math.min(h - 16, w * 0.3);
        const fcx = stacked ? w / 2 : sq / 2 + 10,
            fcy = stacked ? sq / 2 + 8 : h / 2;
        const R = sq * 0.36;
        ctx.fillStyle = "rgba(105, 245, 231, 0.05)";
        ctx.strokeStyle = PAL.gridStrong;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(fcx, fcy, R * 1.15, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
        const line = (u, color, dash, width, label, L = 1.28) => {
            ctx.strokeStyle = color;
            ctx.lineWidth = width;
            ctx.setLineDash(dash);
            ctx.beginPath();
            ctx.moveTo(fcx - u[0] * R * L, fcy + u[1] * R * L);
            ctx.lineTo(fcx + u[0] * R * L, fcy - u[1] * R * L);
            ctx.stroke();
            ctx.setLineDash([]);
            if (label) {
                ctx.fillStyle = color;
                ctx.font = font(fs);
                ctx.textAlign = u[0] >= 0 ? "left" : "right";
                ctx.fillText(label, fcx + u[0] * R * L + (u[0] >= 0 ? 2 : -2), fcy - u[1] * R * L - 2);
            }
        };
        const c = [Math.cos(g.opticAxis), Math.sin(g.opticAxis)];
        line(c, PAL.marker, [2, 4], 1.4, "c");
        line(f, FAST, [], 1.2, `fast (${g.fastRay})`, 1.05);
        line(s, SLOW, [], 1.2, `slow (${g.slowRay})`, 1.05);
        // input ellipse (polarized part) and its projections
        if (Math.hypot(stIn.S.S1, stIn.S.S2, stIn.S.S3) > 1e-9) {
            ctx.beginPath();
            for (let i = 0; i <= 120; i++) {
                const e = Pol.fieldAt(Jin, 2 * Math.PI * i / 120);
                i ? ctx.lineTo(fcx + e.x * R, fcy - e.y * R) : ctx.moveTo(fcx + e.x * R, fcy - e.y * R);
            }
            ctx.strokeStyle = "rgba(236, 233, 248, 0.6)";
            ctx.lineWidth = 1.5;
            ctx.setLineDash([5, 4]);
            ctx.stroke();
            ctx.setLineDash([]);
        }
        ctx.lineWidth = 5;
        ctx.lineCap = "round";
        ctx.strokeStyle = FAST;
        ctx.beginPath();
        ctx.moveTo(fcx - f[0] * af * R, fcy + f[1] * af * R);
        ctx.lineTo(fcx + f[0] * af * R, fcy - f[1] * af * R);
        ctx.stroke();
        ctx.strokeStyle = SLOW;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.moveTo(fcx - s[0] * as * R, fcy + s[1] * as * R);
        ctx.lineTo(fcx + s[0] * as * R, fcy - s[1] * as * R);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.lineCap = "butt";
        ctx.fillStyle = PAL.textMuted;
        ctx.font = font(fs);
        ctx.textAlign = "center";
        ctx.fillText("front view (x right, y up)", fcx, stacked ? sq + 14 : Math.min(h - 6, fcy + R * 1.15 + fs + 6));

        // --- side view (right): lanes for fast and slow components + δ(z) plot
        const x0 = stacked ? 8 : sq + 26;
        const top = stacked ? sq + 24 : 8;
        const rw = w - x0 - 6,
            rh = h - top - 4;
        const plotH = Math.max(96, rh * 0.42);
        const d = g.thickness,
            dUm = d * 1e6;
        const zMin = -0.2 * dUm,
            zMax = 1.2 * dUm;
        const zs = [],
            ds = [];
        for (let i = 0; i <= 200; i++) {
            const z = zMin + (zMax - zMin) * i / 200;
            zs.push(z);
            ds.push(clamp(z, 0, dUm) * 1e-6 * Math.abs(g.dn) / g.wavelength);
        }
        const map = UI.plot(ctx, {
            x: x0,
            y: top + rh - plotH,
            w: rw,
            h: plotH
        }, {
            x: {
                min: zMin,
                max: zMax,
                label: "z in plate",
                unit: "µm"
            },
            y: {
                min: 0,
                max: Math.max(0.3, g.waves * 1.1),
                label: "δ/2π"
            },
            series: [{
                xs: zs,
                ys: ds,
                color: PAL.marker,
                label: "δ(z) = Δn z/λ"
            }],
            hlines: [0.25, 0.5, 1].filter((v) => v < Math.max(0.3, g.waves * 1.1)).map((v) => ({
                y: v,
                label: v === 0.25 ? "λ/4" : v === 0.5 ? "λ/2" : "λ"
            })),
            legend: false,
            fontSize: fs,
        });
        const px0 = map.xToPx(0),
            px1 = map.xToPx(dUm);
        const laneTop = top + 2,
            laneH = (rh - plotH - 8) / 2;
        // slab
        ctx.fillStyle = "rgba(167, 139, 250, 0.10)";
        ctx.fillRect(px0, laneTop, px1 - px0, laneH * 2);
        ctx.strokeStyle = "rgba(167, 139, 250, 0.5)";
        ctx.lineWidth = 1;
        ctx.strokeRect(px0, laneTop, px1 - px0, laneH * 2);
        const M = 5; // schematic carrier cycles across the plate
        const ph = phaseNow();
        const lane = (k, amp, color, lag, label) => {
            const mid = laneTop + laneH * (k + 0.5),
                A = laneH * 0.4;
            ctx.strokeStyle = PAL.grid;
            ctx.beginPath();
            ctx.moveTo(map.plot.x, mid);
            ctx.lineTo(map.plot.x + map.plot.w, mid);
            ctx.stroke();
            ctx.beginPath();
            for (let i = 0; i <= 300; i++) {
                const z = zMin + (zMax - zMin) * i / 300;
                const carrier = 2 * Math.PI * M * z / dUm;
                const val = amp * Math.cos(carrier + ph - (lag ? 2 * Math.PI * clamp(z, 0, dUm) * 1e-6 * Math.abs(g.dn) / g.wavelength - phi0 : 0));
                const px = map.xToPx(z),
                    py = mid - A * val;
                i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
            }
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.8;
            ctx.stroke();
            labelBox(ctx, label, map.plot.x + 2, laneTop + laneH * k + fs + 1, color, fs, "left");
        };
        lane(0, af, FAST, false, `fast ${g.fastRay}-wave, n = ${g.nFast.toFixed(4)}, |E| = ${af.toFixed(2)}`);
        lane(1, as, SLOW, true, `slow ${g.slowRay}-wave, n = ${g.nSlow.toFixed(4)}, |E| = ${as.toFixed(2)}`);
        labelBox(ctx, `d = ${dUm.toFixed(2)} µm, Γ = ${g.waves.toFixed(3)} waves`, map.plot.x + map.plot.w - 2, laneTop + laneH * 2 - 4, PAL.text, fs, "right");
    }

    function labelBox(ctx, text, x, y, color, fs, align) {
        ctx.font = font(fs);
        const tw = ctx.measureText(text).width;
        const x0 = align === "right" ? x - tw : x;
        ctx.fillStyle = "rgba(7, 7, 13, 0.78)";
        ctx.fillRect(x0 - 3, y - fs, tw + 6, fs + 5);
        ctx.fillStyle = color;
        ctx.textAlign = align;
        ctx.fillText(text, x, y);
    }

    function wrapText(ctx, text, x, y, maxW, lh) {
        const words = text.split(" "),
            lines = [];
        let cur = "";
        for (const wd of words) {
            const t = cur ? cur + " " + wd : wd;
            if (ctx.measureText(t).width > maxW && cur) {
                lines.push(cur);
                cur = wd;
            } else cur = t;
        }
        lines.push(cur);
        lines.forEach((l, i) => ctx.fillText(l, x, y + (i - (lines.length - 1) / 2) * lh));
    }

    // ------------------------------------------------------------------ scan plot
    let scanHover = null;
    let scanMap = null;

    function scanSpec() {
        const sel = state.sel;
        if (sel < 0 || sel >= state.bench.length) return null;
        const el = state.bench[sel];
        if (el.type === "depolarizer") return {
            key: "D",
            min: 0,
            max: 1,
            label: "Depolarization D",
            unit: "",
            cur: el.D,
            step: 0.01
        };
        if (el.type === "rotator") return {
            key: "rho",
            min: -180,
            max: 180,
            label: "Rotation ρ",
            unit: "°",
            cur: el.rho,
            step: 1
        };
        return {
            key: "a",
            min: -90,
            max: 90,
            label: el.type === "polarizer" ? "Transmission axis θ" : el.type === "plate" ? "Optic axis α" : "Fast axis θ",
            unit: "°",
            cur: el.a,
            step: 1
        };
    }

    function scanData() {
        const spec = scanSpec();
        if (!spec) return null;
        const xs = [],
            I = [],
            P = [];
        const input = {
            psi: state.psi * DEG,
            delta: state.delta * DEG,
            dop: state.p
        };
        for (let i = 0; i <= 360; i++) {
            const v = spec.min + (spec.max - spec.min) * i / 360;
            const bench = state.bench.map((e, k) => (k === state.sel ? Object.assign({}, e, {
                [spec.key]: v
            }) : e)).map(toModel);
            const out = Pol.propagate(input, bench, ctxModel()).output.desc;
            xs.push(v);
            I.push(out.S0);
            P.push(out.type === "none" ? NaN : out.dop);
        }
        return {
            spec,
            xs,
            I,
            P
        };
    }

    function drawScan(ctx, w, h) {
        fillBg(ctx, w, h);
        const fs = w < 420 ? 11 : 12;
        const data = scanData();
        scanMap = null;
        if (!data) {
            ctx.fillStyle = PAL.textMuted;
            ctx.font = font(fs + 1);
            ctx.textAlign = "center";
            wrapText(ctx, "Inspect a bench element to sweep its angle and measure I/I₀.", w / 2, h / 2, w - 40, fs + 5);
            return;
        }
        const {
            spec
        } = data;
        const cursorX = scanHover != null ? scanHover : spec.cur;
        const hovI = UI.interpAt(data.xs, data.I, cursorX);
        scanMap = UI.plot(ctx, {
            x: 0,
            y: 0,
            w,
            h
        }, {
            x: {
                min: spec.min,
                max: spec.max,
                label: spec.label,
                unit: spec.unit
            },
            y: {
                min: 0,
                max: 1.3,
                label: "I/I₀, DoP"
            },
            series: [{
                    xs: data.xs,
                    ys: data.I,
                    color: PAL.series[0],
                    label: "I/I₀ (output)"
                },
                {
                    xs: data.xs,
                    ys: data.P,
                    color: PAL.series[2],
                    dash: [6, 4],
                    label: "DoP (output)"
                },
            ],
            markers: [{
                x: spec.cur,
                label: "",
                color: PAL.marker
            }],
            cursor: scanHover != null ? {
                x: cursorX,
                label: `${fmtNum(cursorX, spec.step < 1 ? 2 : 1)}${spec.unit}: I=${fmtNum(hovI)}`
            } : undefined,
            fontSize: fs,
        });
    }

    // ------------------------------------------------------------------ dispersion plot
    function drawDisp(ctx, w, h) {
        fillBg(ctx, w, h);
        const fs = w < 420 ? 11 : 12;
        const info = crystalInfo();
        if (!info || !info.g || info.equivalent) {
            ctx.fillStyle = PAL.textMuted;
            ctx.font = font(fs + 1);
            ctx.textAlign = "center";
            wrapText(ctx, "Inspect a birefringent crystal plate to plot its retardance against wavelength (ideal wave plates are defined by Γ alone).", w / 2, h / 2, w - 40, fs + 5);
            return;
        }
        const g = info.g;
        const xs = [],
            tot = [],
            eff = [];
        for (let lam = 400; lam <= 1600; lam += 2) {
            const wv = Math.abs(g.dn) * g.thickness / (lam * 1e-9);
            xs.push(lam);
            tot.push(wv);
            eff.push(wv - Math.floor(wv));
        }
        const yMax = Math.max(1.05, Math.min(Math.max(...tot) * 1.05, 40));
        UI.plot(ctx, {
            x: 0,
            y: 0,
            w,
            h
        }, {
            x: {
                min: 400,
                max: 1600,
                label: "λ",
                unit: "nm"
            },
            y: {
                min: 0,
                max: yMax,
                label: "Γ/2π (waves)"
            },
            series: [{
                    xs,
                    ys: tot,
                    color: PAL.series[3],
                    label: "total Γ/2π"
                },
                {
                    xs,
                    ys: eff,
                    color: PAL.series[1],
                    dash: [6, 4],
                    label: "mod 1 wave"
                },
            ],
            hlines: [{
                y: 0.25,
                label: "λ/4"
            }, {
                y: 0.5,
                label: "λ/2"
            }],
            markers: [{
                x: state.lam,
                label: `${state.lam} nm: ${g.waves.toFixed(3)}`,
                color: PAL.marker
            }],
            fontSize: fs,
        });
    }

    // ------------------------------------------------------------------ canvases + a11y
    const crystalBadge = $("crystalBadge");
    const fieldCv = $("fieldCanvas"),
        sphereCv = $("sphereCanvas"),
        benchCv = $("benchCanvas"),
        crystalCv = $("crystalCanvas"),
        scanCv = $("scanCanvas"),
        dispCv = $("dispCanvas");
    const descs = {
        field: UI.describeCanvas(fieldCv, "Polarization ellipse", {
            label: "Field ellipse before and after the inspected element"
        }),
        sphere: UI.describeCanvas(sphereCv, "Poincaré sphere", {
            label: "Poincaré sphere with the state after each element; drag or use arrow keys to rotate"
        }),
        bench: UI.describeCanvas(benchCv, "Bench", {
            label: "Field along z through the ordered optical elements"
        }),
        crystal: UI.describeCanvas(crystalCv, "Crystal", {
            label: "Birefringent plate: ordinary and extraordinary components"
        }),
        scan: UI.describeCanvas(scanCv, "Scan", {
            label: "Output intensity versus the inspected element's angle"
        }),
        disp: UI.describeCanvas(dispCv, "Retardance", {
            label: "Plate retardance versus wavelength"
        }),
    };
    let ready = false;
    const guard = (fn) => (ctx, w, h) => {
        if (ready && result) fn(ctx, w, h);
        else fillBg(ctx, w, h);
    };
    const cvField = UI.setupCanvas(fieldCv, {
        aspect: 1.15,
        minHeight: 280,
        maxHeight: 440,
        draw: guard(drawField)
    });
    const cvSphere = UI.setupCanvas(sphereCv, {
        aspect: 1.15,
        minHeight: 280,
        maxHeight: 440,
        draw: guard(drawSphere)
    });
    const cvBench = UI.setupCanvas(benchCv, {
        aspect: 3.2,
        minHeight: 200,
        maxHeight: 300,
        draw: guard(drawBench)
    });
    // Narrow screens stack the front view above the side view, so the canvas needs a taller shape.
    // setupCanvas has no responsive-aspect option; its opts.height is read on every resize, so a getter works.
    const crystalOpts = {
        aspect: 2.7,
        minHeight: 250,
        maxHeight: 340,
        draw: guard(drawCrystal)
    };
    Object.defineProperty(crystalOpts, "height", {
        get: () => {
            const cw = crystalCv.clientWidth || 600;
            return cw < 560 ? Math.round(Math.min(560, Math.max(380, cw * 1.3))) : null;
        }
    });
    const cvCrystal = UI.setupCanvas(crystalCv, crystalOpts);
    const cvScan = UI.setupCanvas(scanCv, {
        aspect: 1.45,
        minHeight: 230,
        maxHeight: 360,
        draw: guard(drawScan)
    });
    const cvDisp = UI.setupCanvas(dispCv, {
        aspect: 1.45,
        minHeight: 230,
        maxHeight: 360,
        draw: guard(drawDisp)
    });
    const allCanvases = [cvField, cvSphere, cvBench, cvCrystal, cvScan, cvDisp];

    function updateDescriptions() {
        const out = result.output.desc;
        const stageTxt = (st, k) => `${k === 0 ? "input" : "after " + k}: S=(${[st.S.S0, st.S.S1, st.S.S2, st.S.S3].map((v) => fmtNum(v, 2)).join(", ")}), DoP ${st.desc.type === "none" ? "—" : fmtNum(st.desc.dop, 2)}, ${typeLabel(st.desc)}`;
        const sel = state.sel;
        const hasSel = sel >= 0 && sel < state.bench.length;
        const after = hasSel ? result.stages[sel + 1] : result.stages[0];
        descs.field.update(`Ellipse ${hasSel ? "after element " + (sel + 1) : "of the input"}: ${typeLabel(after.desc)}, orientation ${orientLabel(after.desc)}, ellipticity ${fmtDeg(after.desc.ellipticity)}, handedness ${handLabel(after.desc)}, intensity ${fmtNum(after.desc.S0)}.`);
        descs.sphere.update("Poincaré sphere points. " + result.stages.map(stageTxt).join("; ") + ".");
        descs.bench.update(`${state.bench.length} elements: ${state.bench.map((e, i) => `${i + 1} ${elementSummary(e)}`).join(", ") || "none"}. Output intensity ${fmtNum(out.S0)}, DoP ${fmtNum(out.dop)}.`);
        const info = crystalInfo();
        descs.crystal.update(info && info.g ? `${info.equivalent ? "Equivalent quartz" : info.g.name} A-plate, optic axis ${fmtAngle180(info.g.opticAxis)}, fast axis (${info.g.fastRay}-wave) ${fmtAngle180(info.g.fastAxis)}, thickness ${(info.g.thickness * 1e6).toFixed(2)} µm, Δn ${info.g.dn.toFixed(4)}, retardance ${info.g.waves.toFixed(3)} waves at ${state.lam} nm.` : "No retarder inspected.");
        const sd = scanSpec();
        descs.scan.update(sd ? `Output intensity as ${sd.label} of element ${sel + 1} sweeps ${sd.min} to ${sd.max}${sd.unit}; current value ${sd.cur}${sd.unit} gives ${fmtNum(out.S0)}.` : "No element inspected.");
        descs.disp.update(info && info.g && !info.equivalent ? `Retardance ${info.g.waves.toFixed(3)} waves at ${state.lam} nm; varies as 1/λ.` : "No crystal plate inspected.");
    }

    // sphere interaction
    let drag = null;
    sphereCv.addEventListener("pointerdown", (e) => {
        drag = {
            x: e.clientX,
            y: e.clientY,
            yaw: view.yaw,
            pitch: view.pitch
        };
        sphereCv.setPointerCapture(e.pointerId);
    });
    sphereCv.addEventListener("pointermove", (e) => {
        if (!drag) return;
        view.yaw = drag.yaw - (e.clientX - drag.x) * 0.01;
        view.pitch = clamp(drag.pitch + (e.clientY - drag.y) * 0.01, -85 * DEG, 85 * DEG);
        cvSphere.redraw();
    });
    const endDrag = () => {
        drag = null;
    };
    sphereCv.addEventListener("pointerup", endDrag);
    sphereCv.addEventListener("pointercancel", endDrag);
    sphereCv.addEventListener("dblclick", () => {
        view.yaw = VIEW0.yaw;
        view.pitch = VIEW0.pitch;
        cvSphere.redraw();
    });
    sphereCv.addEventListener("keydown", (e) => {
        const step = 8 * DEG;
        if (e.key === "ArrowLeft") view.yaw += step;
        else if (e.key === "ArrowRight") view.yaw -= step;
        else if (e.key === "ArrowUp") view.pitch = clamp(view.pitch - step, -85 * DEG, 85 * DEG);
        else if (e.key === "ArrowDown") view.pitch = clamp(view.pitch + step, -85 * DEG, 85 * DEG);
        else if (e.key === "Home" || e.key === "0") {
            view.yaw = VIEW0.yaw;
            view.pitch = VIEW0.pitch;
        } else return;
        e.preventDefault();
        cvSphere.redraw();
    });

    // scan interaction: hover shows a cursor, click sets the element parameter
    scanCv.addEventListener("pointermove", (e) => {
        if (!scanMap) return;
        const r = scanCv.getBoundingClientRect();
        const px = e.clientX - r.left,
            py = e.clientY - r.top;
        scanHover = scanMap.contains(px, py) ? scanMap.pxToX(px) : null;
        cvScan.redraw();
    });
    scanCv.addEventListener("pointerleave", () => {
        scanHover = null;
        cvScan.redraw();
    });
    scanCv.addEventListener("click", (e) => {
        const spec = scanSpec();
        if (!scanMap || !spec) return;
        const r = scanCv.getBoundingClientRect();
        const px = e.clientX - r.left;
        if (!scanMap.contains(px, e.clientY - r.top)) return;
        const v = clamp(Math.round(scanMap.pxToX(px) / spec.step) * spec.step, spec.min, spec.max);
        state.bench[state.sel][spec.key] = round(v, 2);
        clearPreset();
        buildBench();
        render();
    });

    // ------------------------------------------------------------------ animation
    const startBtn = $("startStopBtn"),
        stepBtn = $("stepBtn"),
        resetBtn = $("resetBtn");
    const redrawAnimated = () => {
        cvField.redraw();
        cvBench.redraw();
        cvCrystal.redraw();
    };
    const loop = UI.createLoop((dt) => {
        tNow += dt;
        redrawAnimated();
    }, {
        onChange: (running) => {
            startBtn.textContent = running ? "⏸ Pause animation" : "▶ Start animation";
            startBtn.setAttribute("aria-pressed", String(running));
        },
    });
    startBtn.addEventListener("click", () => loop.toggle());
    stepBtn.addEventListener("click", () => {
        loop.stop();
        loop.stepOnce(2 * Math.PI / OMEGA_DISPLAY / 8);
    });
    resetBtn.addEventListener("click", () => {
        loop.stop();
        loop.reset();
        tNow = 0;
        Object.assign(state, DEFAULTS, {
            bench: [],
            sel: -1
        });
        writeInputs();
        buildBench();
        clearPreset();
        presetNote.textContent = "Reset: linear light at 45°, p = 1, λ = 633 nm, empty bench.";
        view.yaw = VIEW0.yaw;
        view.pitch = VIEW0.pitch;
        render();
    });

    // ------------------------------------------------------------------ URL state + export
    const getState = () => ({
        psi: state.psi,
        dl: state.delta,
        p: state.p,
        lam: state.lam,
        b: encodeBench(state.bench),
        s: state.sel
    });
    const url = UI.urlState({
        get: getState,
        set: (o) => {
            if (o.psi != null) state.psi = clamp(o.psi, 0, 90);
            if (o.dl != null) state.delta = clamp(o.dl, -180, 180);
            if (o.p != null) state.p = clamp(o.p, 0, 1);
            if (o.lam != null) state.lam = clamp(Math.round(o.lam), 400, 1600);
            if (o.b != null) state.bench = decodeBench(o.b);
            state.sel = o.s != null ? clamp(Math.round(o.s), -1, state.bench.length - 1) : state.bench.length - 1;
            writeInputs();
            buildBench();
            render();
        },
    });
    UI.addExportBar($("exportHost"), {
        name: "polarization-bench",
        url,
        getState: () => ({
            conventions: "J=[Ex,Ey]; S3=2Im(Ex*Ey)>0 is right-handed (IEEE, CCW facing the source); retarder phase e^{iΓ} on slow axis; angles from +x toward +y",
            input: {
                psi_deg: state.psi,
                delta_deg: state.delta,
                dop: state.p,
                wavelength_nm: state.lam
            },
            bench: state.bench.map((e) => Object.assign({}, e)),
            stages: result.stages.map((st, k) => ({
                stage: k === 0 ? "input" : `after ${k}`,
                S: [st.S.S0, st.S.S1, st.S.S2, st.S.S3],
                dop: st.desc.dop,
                type: st.desc.type
            })),
            url: url.url(),
        }),
        getCSV: () => ({
            headers: ["stage", "element", "S0", "S1", "S2", "S3", "DoP", "state", "handedness", "orientation_deg", "ellipticity_deg", "Ex_re", "Ex_im", "Ey_re", "Ey_im"],
            rows: result.stages.map((st, k) => {
                const d = st.desc;
                return [k === 0 ? "input" : k, k === 0 ? "" : elementSummary(state.bench[k - 1]), st.S.S0, st.S.S1, st.S.S2, st.S.S3, d.dop, d.type, d.handedness,
                    Number.isFinite(d.orientation) ? d.orientation / DEG : "", Number.isFinite(d.ellipticity) ? d.ellipticity / DEG : "",
                    st.J ? st.J[0].re : "", st.J ? st.J[0].im : "", st.J ? st.J[1].re : "", st.J ? st.J[1].im : ""
                ];
            }),
        }),
        canvases: allCanvases.map((c) => c.canvas),
        caption: () => `Polarization bench: input ψ=${state.psi}°, δ=${state.delta}°, p=${state.p}, λ=${state.lam} nm; ${state.bench.map((e, i) => `${i + 1} ${elementSummary(e)}`).join(", ") || "no elements"}`,
    });

    // ------------------------------------------------------------------ render
    function render() {
        compute();
        updateReadouts();
        ready = true;
        allCanvases.forEach((c) => c.redraw());
        updateDescriptions();
        url.update();
    }

    $("toleranceNote").textContent =
        `Classification uses the ellipticity angle χ of the polarized part. Exactly linear: S₃ = 0; exactly circular: S₁ = S₂ = 0 ` +
        `(to round-off, 1e-9). Labelled "≈ linear" when |χ| ≤ ${APPROX_TOL_DEG}° and "≈ circular" when |χ| ≥ ${45 - APPROX_TOL_DEG}°; otherwise elliptical. ` +
        `"Partially pol." marks DoP < 1.`;

    UI.onThemeChange(() => allCanvases.forEach((c) => c.redraw()));
    buildBench();
    render();
})();