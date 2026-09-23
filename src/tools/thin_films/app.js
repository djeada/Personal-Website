/*
 * Thin films and multilayer coatings: page glue. Physics lives in ../shared/optics/thinFilms.js.
 * Units: the UI shows nm and degrees; everything passed to the model is SI (m, rad).
 */
(function() {
    "use strict";
    const UI = window.OpticsUI;
    const core = window.OpticsModels.core;
    const tf = window.OpticsModels.thinFilms;
    const PAL = UI.CANVAS_PALETTE;
    const NM = 1e-9,
        DEG = Math.PI / 180;
    const $ = (id) => document.getElementById(id);
    const COL = {
        R: PAL.series[0],
        T: PAL.series[1],
        A: PAL.series[2],
        s: PAL.series[0],
        p: PAL.series[2]
    };

    // ------------------------------------------------------------------ presets
    const QW = (lam, n) => +(lam / (4 * n)).toFixed(3);
    const nV = +(1.38 * Math.sqrt(1.52)).toFixed(4);
    const nIdeal = +Math.sqrt(1.52).toFixed(5);

    function braggLayers(lam, nH, nL, N) {
        const out = [];
        for (let i = 0; i < N; i++) out.push({
            name: "H TiO₂",
            d: QW(lam, nH),
            n: nH,
            k: 0
        }, {
            name: "L MgF₂",
            d: QW(lam, nL),
            n: nL,
            k: 0
        });
        out.push({
            name: "H TiO₂",
            d: QW(lam, nH),
            n: nH,
            k: 0
        });
        return out;
    }
    const BASE = {
        th: 0,
        lam: 550,
        pol: "u",
        lmin: 380,
        lmax: 900,
        ld: 550,
        back: "none",
        subD: 1,
        ne: 1,
        method: "auto",
        scanL: "0",
        scanMax: 600
    };
    const PRESETS = {
        bare: {
            stack: {
                n0: 1,
                ns: 1.52,
                ks: 0,
                layers: []
            },
            ctl: {},
            note: "Uncoated glass (n = 1.52): R = [(1.52 − 1)/(1.52 + 1)]² = 4.26 % at normal incidence, at every λ. The angle plot is the Fresnel result, with the p zero at Brewster's 56.7°."
        },
        idealAR: {
            stack: {
                n0: 1,
                ns: 1.52,
                ks: 0,
                layers: [{
                    name: "ideal n = √nₛ",
                    d: QW(550, nIdeal),
                    n: nIdeal,
                    k: 0
                }]
            },
            ctl: {},
            note: "Expected: R = 0 exactly at 550 nm (n = √(n₀nₛ) = 1.233, d = λ/4n = 111.5 nm). At 275 nm the film is a half-wave absentee layer and R returns to 4.26 %."
        },
        mgf2: {
            stack: {
                n0: 1,
                ns: 1.52,
                ks: 0,
                layers: [{
                    name: "MgF₂",
                    d: QW(550, 1.38),
                    n: 1.38,
                    k: 0
                }]
            },
            ctl: {},
            note: "Expected: a broad minimum R = 1.26 % at 550 nm (bare glass 4.26 %). The minimum shifts to shorter λ as θ₀ grows (phase thickness ∝ cos θ in the film)."
        },
        vcoat: {
            stack: {
                n0: 1,
                ns: 1.52,
                ks: 0,
                layers: [{
                    name: "MgF₂",
                    d: QW(550, 1.38),
                    n: 1.38,
                    k: 0
                }, {
                    name: "n = 1.70 (Al₂O₃-like)",
                    d: QW(550, nV),
                    n: nV,
                    k: 0
                }]
            },
            ctl: {},
            note: "Two quarter waves with n₂/n₁ = √(nₛ/n₀) give R = 0 at 550 nm, with a narrow V-shaped minimum that rises faster off design than the single MgF₂ layer."
        },
        bragg: {
            stack: {
                n0: 1,
                ns: 1.52,
                ks: 0,
                layers: braggLayers(600, 2.35, 1.38, 6)
            },
            ctl: {
                lam: 600,
                ld: 600,
                lmin: 380,
                lmax: 1100,
                scanMax: 400,
                pol: "s"
            },
            note: "(HL)⁶H with n_H = 2.35, n_L = 1.38 at λ_d = 600 nm. Expected: peak R = 99.82 %, stop band 514–721 nm, with (4/π)asin((n_H−n_L)/(n_H+n_L)) ≈ 0.335. See the readouts."
        },
        soap: {
            stack: {
                n0: 1,
                ns: 1,
                ks: 0,
                layers: [{
                    name: "soap water",
                    d: 400,
                    n: 1.33,
                    k: 0
                }]
            },
            ctl: {
                scanMax: 1500
            },
            note: "Air | water film | air. Expected: black at d → 0 (the two reflections have opposite signs), first bright order at d = λ/4n ≈ 103 nm, and vivid colours only below ≈ 1 µm."
        },
        oil: {
            stack: {
                n0: 1,
                ns: 1.33,
                ks: 0,
                layers: [{
                    name: "oil",
                    d: 300,
                    n: 1.47,
                    k: 0
                }]
            },
            ctl: {
                scanMax: 1500
            },
            note: "Oil (n = 1.47) on water (1.33). Both reflections are from a low-to-high then high-to-low step, so the ordering matches the soap film. The contrast is weaker because the lower face reflects little."
        },
        silver: {
            stack: {
                n0: 1,
                ns: 1.52,
                ks: 0,
                layers: [{
                    name: "Ag (N = 0.055 + 3.32i)",
                    d: 45,
                    n: 0.055,
                    k: 3.32
                }]
            },
            ctl: {
                scanMax: 150
            },
            note: "Silver with a constant index N = 0.055 + 3.32i (Johnson & Christy, 550 nm; dispersion ignored). Expected at 550 nm: R = 92.5 %, T = 5.4 %, A = 2.1 % for 45 nm. The field amplitude falls by 1/e in λ/(2πκ) ≈ 26 nm."
        },
        aluminium: {
            stack: {
                n0: 1,
                ns: 1.52,
                ks: 0,
                layers: [{
                    name: "Al (N = 0.96 + 6.69i)",
                    d: 20,
                    n: 0.96,
                    k: 6.69
                }]
            },
            ctl: {
                scanMax: 100
            },
            note: "Aluminium with a constant N = 0.96 + 6.69i (≈ 550 nm; dispersion ignored). Expected: R = 88.0 %, T = 2.2 %, A = 9.8 % for 20 nm, and bulk R = 92.1 % for thick films."
        },
        thickAg: {
            stack: {
                n0: 1,
                ns: 1.52,
                ks: 0,
                layers: [{
                    name: "Ag 1 mm",
                    d: 1e6,
                    n: 0.055,
                    k: 3.32
                }, {
                    name: "SiO₂",
                    d: 100,
                    n: 1.46,
                    k: 0
                }]
            },
            ctl: {
                scanL: "0",
                scanMax: 200
            },
            note: "A 1 mm silver layer: Im δ ≈ 3.8×10⁴. Auto switches to the stable recursion (R → bulk 98.2 %, T = 0). Choose “Abelès only” in Solver to watch the matrix product overflow to NaN."
        },
        ftir: {
            stack: {
                n0: 1.5,
                ns: 1.5,
                ks: 0,
                layers: [{
                    name: "air gap",
                    d: 300,
                    n: 1,
                    k: 0
                }]
            },
            ctl: {
                th: 50,
                lam: 633,
                pol: "s",
                scanMax: 1500
            },
            note: "Frustrated TIR: glass | air gap | glass at 50° (> 41.8° critical). T decays like exp(−2κd) with κ = k₀√(n₀²sin²θ − 1). Scan the gap to see it. R + T = 1 because nothing absorbs."
        },
        slab: {
            stack: {
                n0: 1,
                ns: 1.52,
                ks: 0,
                layers: []
            },
            ctl: {
                back: "incoherent",
                subD: 1
            },
            note: "A 1 mm glass plate with both faces, treated incoherently: R = 2R₁/(1 + R₁) = 8.17 %. Switch the back side to “Coherent” to see fringes of period ≈ 0.1 nm that the plot cannot resolve (aliasing)."
        }
    };

    let url = null;
    // ------------------------------------------------------------------ stack state
    let stack = JSON.parse(JSON.stringify(PRESETS.mgf2.stack));

    const body = $("layerBody");

    function numInput(val, opts) {
        const i = document.createElement("input");
        i.type = "number";
        i.className = "optics-num-input tf-num";
        i.step = opts.step || "any";
        if (opts.min != null) i.min = String(opts.min);
        i.value = String(val);
        i.setAttribute("aria-label", opts.label);
        i.dataset.field = opts.field;
        if (opts.idx != null) i.dataset.idx = String(opts.idx);
        return i;
    }

    function btn(txt, label, action, idx, disabled) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "tf-row-btn";
        b.textContent = txt;
        b.title = label;
        b.setAttribute("aria-label", label);
        b.dataset.action = action;
        b.dataset.idx = String(idx);
        if (disabled) b.disabled = true;
        return b;
    }
    const cell = (tr, child, cls) => {
        const td = document.createElement("td");
        if (cls) td.className = cls;
        if (child instanceof Node) td.appendChild(child);
        else td.textContent = child;
        tr.appendChild(td);
        return td;
    };

    function renderTable() {
        body.textContent = "";
        const ld = ctl ? ctl.get().ld : 550;
        // incident medium
        let tr = document.createElement("tr");
        tr.className = "tf-medium";
        cell(tr, "0");
        cell(tr, "Incident medium");
        cell(tr, "∞");
        cell(tr, numInput(stack.n0, {
            label: "Incident medium index n0",
            field: "n0",
            step: "0.01",
            min: 1
        }));
        cell(tr, "0 (lossless)");
        cell(tr, "—");
        cell(tr, "");
        body.appendChild(tr);
        stack.layers.forEach((L, i) => {
            tr = document.createElement("tr");
            cell(tr, String(i + 1));
            const name = document.createElement("input");
            name.type = "text";
            name.className = "tf-name";
            name.value = L.name || "";
            name.dataset.field = "name";
            name.dataset.idx = String(i);
            name.setAttribute("aria-label", "Layer " + (i + 1) + " name");
            cell(tr, name);
            cell(tr, numInput(L.d, {
                label: "Layer " + (i + 1) + " thickness (nm)",
                field: "d",
                idx: i,
                min: 0,
                step: "0.1"
            }));
            cell(tr, numInput(L.n, {
                label: "Layer " + (i + 1) + " refractive index n",
                field: "n",
                idx: i,
                min: 0.01,
                step: "0.01"
            }));
            cell(tr, numInput(L.k, {
                label: "Layer " + (i + 1) + " extinction coefficient kappa",
                field: "k",
                idx: i,
                min: 0,
                step: "0.01"
            }));
            const q = cell(tr, fmtQ(L, ld));
            q.dataset.qwot = String(i);
            const acts = document.createElement("div");
            acts.className = "tf-actions";
            acts.append(btn("λ/4", "Set layer " + (i + 1) + " to a quarter wave at the design wavelength", "qw", i),
                btn("↑", "Move layer " + (i + 1) + " up", "up", i, i === 0),
                btn("↓", "Move layer " + (i + 1) + " down", "down", i, i === stack.layers.length - 1),
                btn("⧉", "Duplicate layer " + (i + 1), "dup", i),
                btn("✕", "Remove layer " + (i + 1), "del", i));
            cell(tr, acts);
            body.appendChild(tr);
        });
        tr = document.createElement("tr");
        tr.className = "tf-medium";
        cell(tr, String(stack.layers.length + 1));
        cell(tr, "Substrate");
        cell(tr, "∞");
        cell(tr, numInput(stack.ns, {
            label: "Substrate index n",
            field: "ns",
            step: "0.01",
            min: 0.01
        }));
        cell(tr, numInput(stack.ks, {
            label: "Substrate extinction coefficient kappa",
            field: "ks",
            step: "0.001",
            min: 0
        }));
        cell(tr, "—");
        cell(tr, "");
        body.appendChild(tr);
        renderScanOptions();
    }

    function fmtQ(L, ld) {
        return (4 * L.n * L.d / ld).toFixed(3);
    }

    function renderScanOptions() {
        const sel = $("scanLayer");
        const prev = sel.value;
        sel.textContent = "";
        stack.layers.forEach((L, i) => {
            const o = document.createElement("option");
            o.value = String(i);
            o.textContent = (i + 1) + ": " + (L.name || "layer");
            sel.appendChild(o);
        });
        if (!stack.layers.length) {
            const o = document.createElement("option");
            o.value = "0";
            o.textContent = "(no films)";
            sel.appendChild(o);
        }
        sel.value = Number(prev) < stack.layers.length ? prev : "0";
    }
    body.addEventListener("input", (e) => {
        const t = e.target;
        if (!t.dataset.field) return;
        const f = t.dataset.field;
        if (f === "name") {
            stack.layers[+t.dataset.idx].name = t.value.slice(0, 40);
            renderScanOptions();
            changed();
            return;
        }
        const v = Number(t.value);
        const ok = t.value.trim() !== "" && Number.isFinite(v) && (f === "k" || f === "ks" || f === "d" ? v >= 0 : v > 0) && (f !== "n0" || v >= 1) && !(f === "d" && v > 1e7);
        if (!ok) {
            t.setAttribute("aria-invalid", "true");
            return;
        }
        t.removeAttribute("aria-invalid");
        if (f === "n0" || f === "ns" || f === "ks") stack[f] = v;
        else stack.layers[+t.dataset.idx][f] = v;
        if (f === "d" || f === "n") updateQwot();
        changed();
    });
    body.addEventListener("change", (e) => {
        if (e.target.getAttribute("aria-invalid")) {
            e.target.removeAttribute("aria-invalid");
            renderTable();
        }
    });
    body.addEventListener("click", (e) => {
        const b = e.target.closest("button[data-action]");
        if (!b) return;
        const i = +b.dataset.idx,
            L = stack.layers;
        const act = b.dataset.action;
        if (act === "qw") L[i].d = QW(ctl.get().ld, L[i].n);
        else if (act === "up" && i > 0)[L[i - 1], L[i]] = [L[i], L[i - 1]];
        else if (act === "down" && i < L.length - 1)[L[i + 1], L[i]] = [L[i], L[i + 1]];
        else if (act === "dup") L.splice(i + 1, 0, Object.assign({}, L[i]));
        else if (act === "del") L.splice(i, 1);
        renderTable();
        // keep keyboard focus on the equivalent control after re-render
        const sel = body.querySelector('button[data-action="' + act + '"][data-idx="' + Math.min(act === "up" ? i - 1 : act === "down" ? i + 1 : i, L.length - 1) + '"]');
        if (sel && !sel.disabled) sel.focus();
        else $("addLayerBtn").focus();
        changed();
    });

    function updateQwot() {
        const ld = ctl.get().ld;
        body.querySelectorAll("td[data-qwot]").forEach((td) => {
            const L = stack.layers[+td.dataset.qwot];
            if (L) td.textContent = fmtQ(L, ld);
        });
    }
    $("addLayerBtn").addEventListener("click", () => {
        const ld = ctl.get().ld;
        stack.layers.push({
            name: "L" + (stack.layers.length + 1),
            d: QW(ld, 1.46),
            n: 1.46,
            k: 0
        });
        renderTable();
        changed();
    });
    $("clearLayersBtn").addEventListener("click", () => {
        stack.layers = [];
        renderTable();
        changed();
    });

    // ------------------------------------------------------------------ controls
    UI.enhanceAllSliders(document.querySelector(".options-sidebar"), {
        thetaSlider: {
            unit: "°"
        },
        lamSlider: {
            unit: "nm"
        },
        lminSlider: {
            unit: "nm"
        },
        lmaxSlider: {
            unit: "nm"
        },
        ldSlider: {
            unit: "nm"
        },
        subDSlider: {
            unit: "mm"
        },
        scanMaxSlider: {
            unit: "nm"
        }
    });
    let ctl = null,
        lastLd = 550;
    ctl = UI.bindControls({
        th: "#thetaSlider",
        lam: "#lamSlider",
        pol: "radio:pol",
        lmin: "#lminSlider",
        lmax: "#lmaxSlider",
        ld: "#ldSlider",
        back: "#backSelect",
        subD: "#subDSlider",
        ne: "#neSlider",
        method: "#methodSelect",
        scanL: "#scanLayer",
        scanMax: "#scanMaxSlider"
    }, (s) => {
        if (s && lastLd !== s.ld) {
            lastLd = s.ld;
            updateQwot();
        }
        changed();
    });
    renderTable();

    const packStack = () => ({
        n0: stack.n0,
        ns: stack.ns,
        ks: stack.ks,
        L: stack.layers.map((l) => [l.d, l.n, l.k, l.name])
    });

    function unpackStack(o) {
        if (!o || typeof o !== "object" || !Array.isArray(o.L)) return false;
        const layers = [];
        for (const r of o.L.slice(0, 200)) {
            const [d, n, k, name] = r;
            if (!(Number(d) >= 0 && Number(n) > 0 && Number(k || 0) >= 0)) return false;
            layers.push({
                d: Number(d),
                n: Number(n),
                k: Number(k || 0),
                name: String(name || "").slice(0, 40)
            });
        }
        const n0 = Number(o.n0),
            ns = Number(o.ns),
            ks = Number(o.ks || 0);
        if (!(n0 >= 1 && ns > 0 && ks >= 0)) return false;
        stack = {
            n0,
            ns,
            ks,
            layers
        };
        return true;
    }
    url = UI.urlState({
        get: () => Object.assign(ctl.get(), {
            st: packStack()
        }),
        set: (o) => {
            if (o.st && unpackStack(o.st)) renderTable();
            const rest = Object.assign({}, o);
            delete rest.st;
            ctl.set(rest);
            changed();
        }
    });

    function applyPreset(name) {
        const P = PRESETS[name];
        if (!P) return;
        stack = JSON.parse(JSON.stringify(P.stack));
        renderTable();
        ctl.set(Object.assign({}, BASE, P.ctl));
        document.querySelectorAll("#presetButtons .preset-option").forEach((b) => b.classList.toggle("active", b.dataset.preset === name));
        $("presetNote").textContent = P.note;
        changed();
    }
    $("presetButtons").addEventListener("click", (e) => {
        const b = e.target.closest("[data-preset]");
        if (b) applyPreset(b.dataset.preset);
    });
    $("resetBtn").addEventListener("click", () => applyPreset("mgf2"));
    $("presetNote").textContent = PRESETS.mgf2.note;

    // ------------------------------------------------------------------ computation
    let res = null;

    function modelStack() {
        return {
            n0: stack.n0,
            ns: {
                n: stack.ns,
                k: stack.ks
            },
            layers: stack.layers.map((l) => ({
                d: l.d * NM,
                n: l.n,
                k: l.k,
                name: l.name
            }))
        };
    }
    const polMix = (s, p, pol) => (pol === "s" ? s : pol === "p" ? p : 0.5 * (s + p));

    function compute() {
        const c = ctl.get();
        let lmin = Math.min(c.lmin, c.lmax),
            lmax = Math.max(c.lmin, c.lmax);
        if (lmax - lmin < 10) lmax = lmin + 10;
        const th = c.th * DEG,
            lam = c.lam * NM,
            pol = c.pol || "u";
        const ms = modelStack();
        const back = c.back === "none" ? null : {
            mode: c.back,
            thickness: c.subD * 1e-3,
            ne: c.ne,
            method: c.method
        };
        const NS = 601;
        const lams = core.linspace(lmin * NM, lmax * NM, NS);
        const sp = tf.spectrum(ms, lams, th, {
            method: c.method,
            back,
            compare: true
        });
        const lamNm = Array.from(lams, (l) => l / NM);
        const R = [],
            T = [],
            A = [];
        for (let i = 0; i < NS; i++) {
            R.push(polMix(sp.Rs[i], sp.Rp[i], pol));
            T.push(polMix(sp.Ts[i], sp.Tp[i], pol));
            A.push(polMix(sp.As[i], sp.Ap[i], pol));
        }
        const thetas = core.linspace(0, 89.9 * DEG, 360);
        const an = tf.angleScan(ms, lam, thetas, {
            method: c.method,
            back
        });
        const probe = {};
        for (const p of ["s", "p"]) probe[p] = back ? tf.withBackside(ms, lam, th, p, back) : tf.solve(ms, lam, th, p, {
            method: c.method
        });
        const films = {
            s: tf.solve(ms, lam, th, "s", {
                method: c.method
            }),
            p: tf.solve(ms, lam, th, "p", {
                method: c.method
            })
        };
        const fields = {};
        for (const p of pol === "u" ? ["s", "p"] : [pol]) fields[p] = tf.fieldProfile(ms, lam, th, p, {
            samples: 900
        });
        // thickness scan
        let scan = null;
        const li = Number(c.scanL) || 0;
        if (stack.layers.length) {
            const Nd = 161,
                dMax = c.scanMax * NM;
            const d = [],
                Rsc = [],
                XYZ = [];
            const COLNM = [];
            for (let l = 380; l <= 780; l += 10) COLNM.push(l);
            for (let i = 0; i < Nd; i++) {
                const di = dMax * i / (Nd - 1);
                const st = {
                    n0: ms.n0,
                    ns: ms.ns,
                    layers: ms.layers.map((L, j) => (j === li ? Object.assign({}, L, {
                        d: di
                    }) : L))
                };
                d.push(di / NM);
                Rsc.push(tf.power(st, lam, th, pol, {
                    method: c.method
                }).R);
                const cache = new Map();
                for (const l of COLNM) cache.set(l, tf.power(st, l * NM, th, "u", {
                    method: c.method
                }).R);
                const interp = (nmv) => {
                    const lo = Math.max(380, Math.min(770, Math.floor(nmv / 10) * 10));
                    const t = (nmv - lo) / 10;
                    return cache.get(lo) * (1 - t) + cache.get(lo + 10) * t;
                };
                XYZ.push(tf.colourOf(interp));
            }
            const maxY = Math.max(1e-6, ...XYZ.map((x) => x.Y));
            const exposure = Math.min(50, 1 / maxY);
            scan = {
                d,
                R: Rsc,
                rgb: XYZ.map((x) => tf.xyzToRGB(x.X, x.Y, x.Z, exposure)),
                exposure,
                layer: li,
                cur: stack.layers[li] ? stack.layers[li].d : 0
            };
        }
        // colour of the current stack (unpolarised, at θ0), including the back side when modelled
        const colPower = (nmv) => (back ? tf.withBackside(ms, nmv * NM, th, "u", back) : tf.power(ms, nmv * NM, th, "u", {
            method: c.method
        }));
        const cR = tf.colourOf((nmv) => colPower(nmv).R);
        const cT = tf.colourOf((nmv) => colPower(nmv).T);
        res = {
            c,
            pol,
            lamNm,
            R,
            T,
            A,
            sp,
            an,
            thetaDeg: Array.from(thetas, (t) => t / DEG),
            probe,
            films,
            fields,
            scan,
            cR,
            cT,
            lmin,
            lmax,
            back,
            ms
        };
    }

    // Bragg / quarter-wave stack detection for the stop-band readouts
    function detectBragg() {
        const L = stack.layers;
        if (L.length < 3 || L.length % 2 === 0 || L.some((l) => l.k > 0)) return null;
        const nA = L[0].n,
            nB = L[1].n;
        if (Math.abs(nA - nB) < 1e-6) return null;
        const opt = L[0].n * L[0].d;
        for (let i = 0; i < L.length; i++) {
            if (Math.abs(L[i].n - (i % 2 ? nB : nA)) > 1e-9) return null;
            if (Math.abs(L[i].n * L[i].d - opt) > 1e-3 * opt) return null;
        }
        const lq = 4 * opt; // nm
        let Y = stack.ns;
        for (let i = L.length - 1; i >= 0; i--) Y = L[i].n * L[i].n / Y;
        const Rpk = ((stack.n0 - Y) / (stack.n0 + Y)) ** 2;
        return {
            lq,
            nA,
            nB,
            Rpk,
            sb: tf.braggStopband(lq, Math.max(nA, nB), Math.min(nA, nB)),
            N: (L.length - 1) / 2
        };
    }

    // ------------------------------------------------------------------ drawing
    let specMap = null,
        angMap = null,
        fieldMap = null,
        scanMap = null;
    const pct = (v) => (Math.abs(v) < 5e-12 ? (v = 0, "0.000 %") : Number.isFinite(v) ? (100 * v).toFixed(v > 0.9995 || v < 0.0005 ? 3 : 2) + " %" : "NaN");
    const polLabel = (p) => (p === "u" ? "unpolarised" : p + "-pol");

    const spec = UI.setupCanvas($("specCanvas"), {
        aspect: 2.5,
        minHeight: 240,
        maxHeight: 380,
        draw(ctx, w, h) {
            if (!res) return;
            const {
                lamNm,
                R,
                T,
                A,
                c
            } = res;
            specMap = UI.plot(ctx, {
                x: 0,
                y: 0,
                w,
                h
            }, {
                x: {
                    min: res.lmin,
                    max: res.lmax,
                    label: "vacuum wavelength λ₀",
                    unit: "nm"
                },
                y: {
                    min: 0,
                    max: 1.02,
                    label: "fraction of incident power"
                },
                series: [{
                        xs: lamNm,
                        ys: R,
                        label: "R",
                        color: COL.R
                    },
                    {
                        xs: lamNm,
                        ys: T,
                        label: "T",
                        color: COL.T,
                        dash: [7, 4]
                    },
                    {
                        xs: lamNm,
                        ys: A,
                        label: "A",
                        color: COL.A,
                        dash: [2, 3]
                    }
                ],
                markers: [{
                    x: c.ld,
                    label: "λ_d",
                    dash: [5, 4]
                }],
                cursor: {
                    x: c.lam,
                    label: "λ₀ " + c.lam + " nm  R " + pct(UI.interpAt(lamNm, R, c.lam))
                }
            });
            // visible band strip along the bottom edge of the plot
            const P = specMap.plot;
            for (let x = Math.max(P.x, specMap.xToPx(380)); x < Math.min(P.x + P.w, specMap.xToPx(780)); x++) {
                ctx.fillStyle = UI.wavelengthToCSS(specMap.pxToX(x + 0.5), 0.9);
                ctx.fillRect(x, P.y + P.h - 5, 1, 4);
            }
        }
    });
    const ang = UI.setupCanvas($("angCanvas"), {
        aspect: 1.45,
        minHeight: 240,
        maxHeight: 400,
        draw(ctx, w, h) {
            if (!res) return;
            const {
                an,
                thetaDeg,
                c
            } = res;
            const mk = [];
            const nsr = stack.ns;
            mk.push({
                x: Math.atan2(nsr, stack.n0) / DEG,
                label: "θ_B bare"
            });
            if (stack.n0 > nsr) mk.push({
                x: Math.asin(nsr / stack.n0) / DEG,
                label: "θ_c",
                color: PAL.warning
            });
            angMap = UI.plot(ctx, {
                x: 0,
                y: 0,
                w,
                h
            }, {
                x: {
                    min: 0,
                    max: 90,
                    label: "angle of incidence θ₀",
                    unit: "°"
                },
                y: {
                    min: 0,
                    max: 1.02,
                    label: "fraction of incident power"
                },
                series: [{
                        xs: thetaDeg,
                        ys: an.Rs,
                        label: "R_s",
                        color: COL.s
                    },
                    {
                        xs: thetaDeg,
                        ys: an.Rp,
                        label: "R_p",
                        color: COL.p
                    },
                    {
                        xs: thetaDeg,
                        ys: an.Ts,
                        label: "T_s",
                        color: COL.s,
                        dash: [7, 4]
                    },
                    {
                        xs: thetaDeg,
                        ys: an.Tp,
                        label: "T_p",
                        color: COL.p,
                        dash: [7, 4]
                    }
                ],
                markers: mk,
                cursor: {
                    x: c.th,
                    label: "θ₀ " + c.th + "°"
                },
                legendPosition: "left"
            });
        }
    });
    const field = UI.setupCanvas($("fieldCanvas"), {
        aspect: 1.45,
        minHeight: 240,
        maxHeight: 400,
        draw(ctx, w, h) {
            if (!res) return;
            const fs = res.fields;
            const any = fs.s || fs.p;
            const zs = any.z.map((z) => z / NM);
            let ymax = 0;
            for (const k in fs)
                for (const v of fs[k].E2)
                    if (Number.isFinite(v) && v > ymax) ymax = v;
            ymax = Math.max(1e-3, ymax * 1.08);
            const axes = {
                x: {
                    min: zs[0],
                    max: zs[zs.length - 1],
                    label: "depth z from first interface",
                    unit: "nm"
                },
                y: {
                    min: 0,
                    max: ymax,
                    label: "|E|² / |E_inc|²"
                }
            };
            fieldMap = UI.plot(ctx, {
                x: 0,
                y: 0,
                w,
                h
            }, Object.assign({
                series: [],
                legend: false
            }, axes));
            // layer bands
            const P = fieldMap.plot;
            const maxN = Math.max(stack.n0, stack.ns, ...stack.layers.map((l) => l.n));
            ctx.save();
            ctx.beginPath();
            ctx.rect(P.x, P.y, P.w, P.h);
            ctx.clip();
            const band = (z0, z1, n, k, label) => {
                const x0 = fieldMap.xToPx(z0),
                    x1 = fieldMap.xToPx(z1);
                const frac = Math.min(1, Math.max(0.12, (n - 0.9) / Math.max(0.2, maxN - 0.9)));
                const top = P.y + P.h * (1 - 0.9 * frac);
                ctx.fillStyle = "rgba(167, 139, 250, " + (0.1 + 0.18 * frac) + ")";
                ctx.fillRect(x0, top, x1 - x0, P.y + P.h - top);
                if (k > 0) {
                    ctx.strokeStyle = "rgba(255, 159, 107, 0.45)";
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    for (let x = x0 - P.h; x < x1; x += 7) {
                        ctx.moveTo(Math.max(x, x0), P.y + P.h - Math.max(0, x0 - x));
                        ctx.lineTo(Math.min(x + P.h, x1), P.y + P.h - Math.min(P.h, x1 - x));
                    }
                    ctx.stroke();
                }
                if (label && x1 - x0 > 26) {
                    ctx.fillStyle = PAL.textMuted;
                    ctx.font = "11px " + PAL.font;
                    ctx.textAlign = "center";
                    ctx.textBaseline = "top";
                    const t = label.length * 6.5 > x1 - x0 ? label.slice(0, Math.max(1, Math.floor((x1 - x0) / 6.5))) : label;
                    ctx.fillText(t, (x0 + x1) / 2, P.y + 4);
                }
            };
            band(zs[0], 0, stack.n0, 0, "n₀ " + stack.n0);
            let z = 0;
            stack.layers.forEach((L) => {
                band(z, z + L.d, L.n, L.k, L.name || "");
                z += L.d;
            });
            band(z, zs[zs.length - 1], stack.ns, stack.ks, "substrate");
            ctx.restore();
            const series = [];
            if (fs.s) series.push({
                xs: zs.length === fs.s.z.length ? zs : fs.s.z.map((v) => v / NM),
                ys: fs.s.E2,
                label: "s",
                color: COL.s
            });
            if (fs.p) series.push({
                xs: fs.p.z.map((v) => v / NM),
                ys: fs.p.E2,
                label: "p",
                color: COL.p,
                dash: fs.s ? [7, 4] : []
            });
            fieldMap = UI.plot(ctx, {
                x: 0,
                y: 0,
                w,
                h
            }, Object.assign({
                series,
                background: false,
                hlines: [{
                    y: 1,
                    label: "incident"
                }]
            }, axes));
        }
    });
    const SCAN_STRIP = 26;
    const scanCv = UI.setupCanvas($("scanCanvas"), {
        aspect: 2.6,
        minHeight: 250,
        maxHeight: 360,
        draw(ctx, w, h) {
            if (!res) return;
            const sc = res.scan;
            if (!sc) {
                ctx.fillStyle = PAL.panel;
                ctx.fillRect(0, 0, w, h);
                ctx.fillStyle = PAL.text;
                ctx.font = "13px " + PAL.font;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText("No films: add a layer to scan its thickness", w / 2, h / 2);
                scanMap = null;
                return;
            }
            scanMap = UI.plot(ctx, {
                x: 0,
                y: 0,
                w,
                h: h - SCAN_STRIP - 6
            }, {
                x: {
                    min: 0,
                    max: sc.d[sc.d.length - 1],
                    label: "thickness of layer " + (sc.layer + 1),
                    unit: "nm"
                },
                y: {
                    min: 0,
                    max: Math.min(1.02, Math.max(0.05, Math.max(...sc.R) * 1.1)),
                    label: "R at λ₀"
                },
                series: [{
                    xs: sc.d,
                    ys: sc.R,
                    label: "R (" + polLabel(res.pol) + ")",
                    color: COL.R
                }],
                cursor: {
                    x: sc.cur,
                    label: "d " + (+sc.cur.toFixed(1)) + " nm"
                }
            });
            const P = scanMap.plot,
                y0 = h - SCAN_STRIP;
            const n = sc.rgb.length;
            for (let i = 0; i < n; i++) {
                const x0 = scanMap.xToPx(sc.d[i] - (i ? (sc.d[i] - sc.d[i - 1]) / 2 : 0));
                const x1 = scanMap.xToPx(i < n - 1 ? (sc.d[i] + sc.d[i + 1]) / 2 : sc.d[i]);
                ctx.fillStyle = "rgb(" + sc.rgb[i].join(",") + ")";
                ctx.fillRect(Math.floor(x0), y0, Math.ceil(x1 - x0) + 1, SCAN_STRIP - 4);
            }
            ctx.strokeStyle = PAL.axis;
            ctx.strokeRect(P.x + 0.5, y0 + 0.5, P.w - 1, SCAN_STRIP - 5);
            const cx = scanMap.xToPx(sc.cur);
            if (cx >= P.x && cx <= P.x + P.w) {
                ctx.strokeStyle = PAL.cursor;
                ctx.lineWidth = 2;
                ctx.strokeRect(cx - 2, y0 - 1, 4, SCAN_STRIP - 2);
            }
            ctx.fillStyle = PAL.textMuted;
            ctx.font = "11px " + PAL.font;
            ctx.textAlign = "right";
            ctx.textBaseline = "middle";
            ctx.fillText("colour", P.x - 4, y0 + (SCAN_STRIP - 4) / 2);
        }
    });

    const dSpec = UI.describeCanvas(spec.canvas, "Spectrum", {
        label: "Reflectance, transmittance and absorptance against wavelength"
    });
    const dAng = UI.describeCanvas(ang.canvas, "Angle", {
        label: "Reflectance and transmittance against angle for s and p polarisation"
    });
    const dField = UI.describeCanvas(field.canvas, "Field", {
        label: "Electric-field intensity profile through the layer stack"
    });
    const dScan = UI.describeCanvas(scanCv.canvas, "Scan", {
        label: "Reflectance and interference colour against layer thickness"
    });

    // ------------------------------------------------------------------ readouts
    const fmtC = (z) => (Number.isFinite(z.re) ? Math.hypot(z.re, z.im).toFixed(4) + " ∠ " + (Math.atan2(z.im, z.re) / DEG).toFixed(1) + "°" : "NaN");

    function updateReadouts() {
        const {
            c,
            probe,
            films,
            pol,
            sp
        } = res;
        const mix = (k) => polMix(probe.s[k], probe.p[k], pol);
        $("statR").textContent = pct(mix("R"));
        $("statT").textContent = pct(mix("T"));
        $("statA").textContent = pct(mix("A"));
        $("statLambda").textContent = c.lam + " nm";
        const m = films.s.method;
        $("statMethod").textContent = m === "abeles" ? "Abelès" : "Stable";
        $("thetaVal").textContent = c.th + "°";
        $("lamVal").textContent = c.lam + " nm";
        $("lminVal").textContent = c.lmin + " nm";
        $("lmaxVal").textContent = c.lmax + " nm";
        $("ldVal").textContent = c.ld + " nm";
        $("subDVal").textContent = c.subD + " mm";
        $("neVal").textContent = Number(c.ne).toFixed(2);
        $("scanMaxVal").textContent = c.scanMax + " nm";
        $("specBadge").textContent = "θ₀ = " + c.th + "°, " + polLabel(pol) + (res.back ? ", back side " + c.back : "");
        $("angBadge").textContent = "λ₀ = " + c.lam + " nm";
        $("rdRsp").textContent = pct(probe.s.R) + " / " + pct(probe.p.R);
        $("rdTsp").textContent = pct(probe.s.T) + " / " + pct(probe.p.T);
        $("rdAsp").textContent = pct(probe.s.A) + " / " + pct(probe.p.A);
        $("rdrs").textContent = fmtC(films.s.r);
        $("rdrp").textContent = fmtC(films.p.r);
        $("rdSumIm").textContent = films.s.sumImDelta.toPrecision(3) + (films.s.sumImDelta >= tf.ABELES_LIMIT ? " (≥ 20: ill-conditioned)" : "");
        const md = sp.maxMethodDiff;
        $("rdAgree").textContent = Number.isFinite(md) ? md.toExponential(1) + (sp.maxSumImDelta >= tf.ABELES_LIMIT ? " (Abelès past limit)" : "") : "Abelès gives NaN/∞ (overflow)";
        const bg = detectBragg();
        if (bg) {
            $("rdStop").textContent = bg.sb.lamShort.toFixed(1) + "–" + bg.sb.lamLong.toFixed(1) + " nm; Δλ/λ = " + bg.sb.fracExact.toFixed(3) + " (≈ 4/π asin: " + bg.sb.fracApprox.toFixed(3) + ")";
            $("rdPeak").textContent = pct(bg.Rpk) + " / " + pct(polMix(tf.solve(res.ms, bg.lq * NM, 0, "s").R, tf.solve(res.ms, bg.lq * NM, 0, "p").R, "u"));
            const period = stack.layers.slice(0, 2).map((l) => ({
                d: l.d * NM,
                n: l.n
            }));
            const bl = tf.numericStopband(period, bg.lq * NM);
            $("rdStopBloch").textContent = bl ? (bl.lamShort / NM).toFixed(1) + "–" + (bl.lamLong / NM).toFixed(1) + " nm (Δλ = " + (bl.width / NM).toFixed(1) + " nm)" : "—";
            // measured: contiguous region around λq where R ≥ ½ R(λq) at θ0 = 0
            if (c.th !== 0) $("rdStopMeas").textContent = "set θ₀ = 0° (formula is for normal incidence)";
            else if (bg.lq < res.lmin || bg.lq > res.lmax) $("rdStopMeas").textContent = "λ_q = " + bg.lq.toFixed(0) + " nm outside the plotted range";
            else {
                const {
                    lamNm,
                    R
                } = res;
                let i0 = 0;
                while (lamNm[i0] < bg.lq) i0++;
                const half = 0.5 * R[i0];
                let a = i0,
                    b = i0;
                while (a > 0 && R[a - 1] >= half) a--;
                while (b < R.length - 1 && R[b + 1] >= half) b++;
                const edgeOk = a > 0 && b < R.length - 1;
                $("rdStopMeas").textContent = edgeOk ? lamNm[a].toFixed(1) + "–" + lamNm[b].toFixed(1) + " nm (Δλ = " + (lamNm[b] - lamNm[a]).toFixed(1) + " nm, ±" + (lamNm[1] - lamNm[0]).toFixed(1) + ")" : "band runs past the plotted range";
            }
        } else {
            $("rdStop").textContent = "— (not a quarter-wave HL stack)";
            $("rdStopMeas").textContent = "—";
            $("rdPeak").textContent = "—";
            $("rdStopBloch").textContent = "—";
        }
        const sw = (el, col, lbl) => {
            el.style.background = "rgb(" + col.rgb.join(",") + ")";
            lbl.textContent = "Y = " + (100 * col.Y).toFixed(1) + " %, x,y = " + (Number.isFinite(col.x) ? col.x.toFixed(3) + ", " + col.y.toFixed(3) : "—");
        };
        sw($("swR"), res.cR, $("rdColR"));
        sw($("swT"), res.cT, $("rdColT"));
        // absorption table
        const absBody = $("absBody");
        absBody.textContent = "";
        const fs = res.fields,
            keys = Object.keys(fs);
        const row = (name, a, peak) => {
            const tr = document.createElement("tr");
            [name, a, peak].forEach((t) => {
                const td = document.createElement("td");
                td.textContent = t;
                tr.appendChild(td);
            });
            absBody.appendChild(tr);
        };
        const peakIn = (f, j) => {
            let m = 0;
            f.layerOf.forEach((lj, i) => {
                if (lj === j && f.E2[i] > m) m = f.E2[i];
            });
            return m;
        };
        const fr = (fn) => keys.map((k) => fn(fs[k], k)).reduce((s, v) => s + v, 0) / keys.length;
        row("Reflected (R)", pct(fr((f) => f.R)), "—");
        stack.layers.forEach((L, j) => row((j + 1) + ": " + (L.name || "layer"), pct(fr((f) => f.absorbed[j])), keys.map((k) => peakIn(fs[k], j + 1).toFixed(3)).join(" / ")));
        row("Transmitted into substrate (T)", pct(fr((f) => f.T)), keys.map((k) => peakIn(fs[k], stack.layers.length + 1).toFixed(3)).join(" / "));
        // warnings
        const warns = [];
        if (res.back && res.back.mode === "coherent") {
            const nsr = stack.ns,
                lam = c.lam * NM,
                cosT = Math.sqrt(Math.max(1e-6, 1 - (stack.n0 * Math.sin(c.th * DEG) / nsr) ** 2));
            const period = lam * lam / (2 * nsr * c.subD * 1e-3 * cosT) / NM;
            const dl = (res.lmax - res.lmin) / 600;
            if (period < 4 * dl) warns.push("Coherent substrate: the fringe period near λ₀ is " + period.toPrecision(2) + " nm but the spectrum is sampled every " + dl.toPrecision(2) + " nm, so the curve is aliased. Real instruments average these fringes, which is the incoherent model.");
        }
        if (!Number.isFinite(films.s.R) || !Number.isFinite(films.p.R)) warns.push("The characteristic-matrix product overflowed (Σ Im δ = " + films.s.sumImDelta.toPrecision(3) + " ≫ 700). Choose Auto or the stable recursion.");
        const thick = stack.layers.find((l) => l.d > 20000 && 4 * Math.PI * l.k * l.d / c.lam < 20); // opaque layers: back face irrelevant
        if (thick) warns.push("“" + (thick.name || "layer") + "” is " + (thick.d / 1000).toPrecision(3) + " µm thick but is treated coherently. That is only valid for a highly coherent source and a perfectly uniform layer. Otherwise model it as an incoherent substrate.");
        if (stack.n0 * Math.sin(c.th * DEG) > stack.ns) warns.push("n₀ sin θ₀ > nₛ: total internal reflection at the substrate. T = 0 and the field is evanescent in the substrate. Any R < 1 is absorption in the films.");
        $("warnBox").hidden = !warns.length;
        $("warnBox").textContent = warns.join(" ");

        // text equivalents for canvases
        const {
            lamNm,
            R
        } = res;
        let iMin = 0,
            iMax = 0;
        R.forEach((v, i) => {
            if (v < R[iMin]) iMin = i;
            if (v > R[iMax]) iMax = i;
        });
        dSpec.update("Spectrum " + res.lmin + "–" + res.lmax + " nm at θ₀ = " + c.th + "°, " + polLabel(pol) + ". Minimum R " + pct(R[iMin]) + " at " + lamNm[iMin].toFixed(0) + " nm; maximum R " + pct(R[iMax]) + " at " + lamNm[iMax].toFixed(0) + " nm. At the probe " + c.lam + " nm: R " + pct(mix("R")) + ", T " + pct(mix("T")) + ", A " + pct(mix("A")) + ".");
        const an = res.an;
        let iRp = 0;
        an.Rp.forEach((v, i) => {
            if (v < an.Rp[iRp]) iRp = i;
        });
        dAng.update("At λ₀ = " + c.lam + " nm, normal incidence R_s = R_p = " + pct(an.Rs[0]) + ". R_p is smallest (" + pct(an.Rp[iRp]) + ") at " + res.thetaDeg[iRp].toFixed(1) + "°. At 60°: R_s " + pct(UI.interpAt(res.thetaDeg, an.Rs, 60)) + ", R_p " + pct(UI.interpAt(res.thetaDeg, an.Rp, 60)) + ".");
        dField.update("Field intensity at λ₀ = " + c.lam + " nm, θ₀ = " + c.th + "°: " + keys.map((k) => k + "-pol peak |E|² " + Math.max(...fs[k].E2.filter(Number.isFinite)).toFixed(3) + ", value in substrate " + fs[k].E2[fs[k].E2.length - 1].toFixed(3)).join("; ") + ".");
        if (res.scan) {
            const sc = res.scan;
            let im = 0;
            sc.R.forEach((v, i) => {
                if (v > sc.R[im]) im = i;
            });
            dScan.update("Thickness scan of layer " + (sc.layer + 1) + " from 0 to " + sc.d[sc.d.length - 1] + " nm at λ₀ = " + c.lam + " nm: R starts at " + pct(sc.R[0]) + ", largest " + pct(sc.R[im]) + " at " + sc.d[im].toFixed(0) + " nm; current thickness " + sc.cur.toFixed(1) + " nm.");
        } else dScan.update("No films to scan.");
    }

    // ------------------------------------------------------------------ interaction
    let pending = false;

    function changed() {
        if (url) url.update();
        if (pending) return;
        pending = true;
        requestAnimationFrame(() => {
            pending = false;
            compute();
            spec.redraw();
            ang.redraw();
            field.redraw();
            scanCv.redraw();
            updateReadouts();
        });
    }

    function drag(canvas, getMap, onX) {
        let down = false;
        const at = (e) => {
            const m = getMap();
            if (!m) return;
            const r = canvas.getBoundingClientRect();
            const px = e.clientX - r.left,
                py = e.clientY - r.top;
            if (m.contains(px, py) || down) onX(m.pxToX(Math.min(m.plot.x + m.plot.w, Math.max(m.plot.x, px))));
        };
        canvas.addEventListener("pointerdown", (e) => {
            const m = getMap();
            if (!m) return;
            const r = canvas.getBoundingClientRect();
            if (!m.contains(e.clientX - r.left, e.clientY - r.top)) return;
            down = true;
            at(e);
        });
        canvas.addEventListener("pointermove", (e) => {
            if (down) at(e);
        });
        window.addEventListener("pointerup", () => {
            down = false;
        });
    }
    const setSlider = (id, v) => {
        const el = $(id);
        el.value = String(v);
        el.dispatchEvent(new Event("input", {
            bubbles: true
        }));
    };
    drag(spec.canvas, () => specMap, (x) => setSlider("lamSlider", Math.round(x)));
    drag(ang.canvas, () => angMap, (x) => setSlider("thetaSlider", Math.min(89.5, Math.max(0, Math.round(x * 10) / 10))));
    drag(scanCv.canvas, () => scanMap, (x) => {
        const li = Number(ctl.get().scanL) || 0;
        if (!stack.layers[li]) return;
        stack.layers[li].d = Math.max(0, Math.round(x * 10) / 10);
        const inp = body.querySelector('input[data-field="d"][data-idx="' + li + '"]');
        if (inp) inp.value = String(stack.layers[li].d);
        updateQwot();
        changed();
    });

    UI.addExportBar($("exportHost"), {
        name: "thin-films",
        url,
        getState: () => ({
            controls: ctl.get(),
            stack: JSON.parse(JSON.stringify(stack)),
            units: {
                d: "nm",
                lambda: "nm",
                theta: "deg",
                subD: "mm"
            }
        }),
        getCSV: () => ({
            headers: ["lambda (nm)", "Rs", "Ts", "As", "Rp", "Tp", "Ap"],
            rows: res.lamNm.map((l, i) => [l, res.sp.Rs[i], res.sp.Ts[i], res.sp.As[i], res.sp.Rp[i], res.sp.Tp[i], res.sp.Ap[i]])
        }),
        canvases: [spec.canvas, ang.canvas, field.canvas, scanCv.canvas],
        caption: () => "n0 = " + stack.n0 + " | " + stack.layers.map((l) => (l.name || "L") + " " + l.d + " nm (" + l.n + (l.k ? "+" + l.k + "i" : "") + ")").join(" | ") + " | ns = " + stack.ns + (stack.ks ? "+" + stack.ks + "i" : "") + "; θ0 = " + ctl.get().th + "°"
    });

    url.ready.then((restored) => {
        if (!restored) ctl.set(Object.assign({}, BASE));
        changed();
    });
})();