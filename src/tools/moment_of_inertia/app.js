(function() {
    "use strict";
    const M = window.InertiaModel, UI = window.OpticsUI;
    const $ = id => document.getElementById(id);
    const controls = ["shape", "mass", "radius", "length", "width", "height", "hollow", "tilt", "offset", "resolution"];
    // Canvases are always dark, like the site's other physics labs.
    const C = {
        panel: "#07070d", grid: "rgba(184, 178, 207, .09)", text: "#ece9f8", muted: "#b8b2cf", faint: "rgba(184, 178, 207, .2)",
        outline: "#c9c3e6", axis: "#ff8d7c", violet: "#a78bfa", cyan: "#69f5e7", gold: "#f8d477", rose: "#f187c8", white: "#ffffff"
    };
    const COOL = [105, 245, 231], WARM = [248, 212, 119];
    let data = M.evaluate(M.DEFAULTS);
    let reference = M.evaluate({ ...M.DEFAULTS, shape: "hoop" });
    let referenceMode = "experiment";
    let experimentReference = reference;
    let pinnedReference = null;
    let selected = Math.floor(data.points.length * 0.75);
    let activeExperiment = null;
    let hits = [];
    const camera = { az: -0.45, el: 0.72 };
    const motionState = { time: 0, running: false };
    const build = { step: 0, carry: 0 };
    const primer = { angle: -0.4, t: 0, twisting: false };
    let orbitAngle = 0.6;
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    // Sums shown to beginners stay in plain decimals instead of 2.57e-4.
    const plain = v => Math.abs(v) < 0.01 ? v.toFixed(5) : v.toFixed(4);

    const num = (n, digits = 3) => {
        if (!Number.isFinite(n)) return "—";
        if (n !== 0 && Math.abs(n) < 0.001) return n.toExponential(2);
        return n.toFixed(digits).replace(/^-0\.0+$/, (0).toFixed(digits));
    };
    const tag = (name, text) => `<${name}>${text}</${name}>`;
    const mi = s => tag("mi", s), mn = n => tag("mn", typeof n === "number" ? num(n) : n), mo = s => tag("mo", s);
    const row = s => tag("mrow", s), text = s => tag("mtext", s);
    const frac = (a, b) => tag("mfrac", row(a) + row(b));
    const sq = s => tag("msup", row(s) + mn("2"));
    const sub = (a, b) => tag("msub", mi(a) + text(b));
    const times = mo("·"), eq = mo("="), plus = mo("+");
    const unit = u => `<mspace width="0.3em"></mspace>` + text(u);
    const integral = (lo, hi) => tag("msubsup", mo("∫") + row(lo) + row(hi));
    const I = sub("I", "CM"), Iz = sub("I", "z"), Ix = sub("I", "x");
    const R2 = sq(mi("R")), L2 = sq(mi("L")), W2 = sq(mi("W")), H2 = sq(mi("H"));

    function equation(id, markup, label) {
        const lines = [].concat(markup);
        $(id).innerHTML = `<math display="block" aria-label="${label}">${lines.length === 1 ? lines[0] : tag("mtable", lines.map(line => `<mtr><mtd columnalign="left">${row(line)}</mtd></mtr>`).join(""))}</math>`;
    }

    const lessons = {
        rod: {
            coordinate: "The ideal thin rod lies along x. The z axis crosses its midpoint; the x axis lies along its length.",
            body: "Uniform linear density. Rod thickness is neglected.",
            density: frac(mi("M"), mi("L")), symbol: "λ", title: "Linear density",
            dm: "A short segment dx has mass dm = λ dx. Equal-length segments have equal mass.",
            dims: 1, coords: "1 number: position x along the rod", dmForm: "λ dx",
            shortcutText: "Already a single integral",
            integral: integral(mo("−") + frac(mi("L"), mn("2")), frac(mi("L"), mn("2"))) + sq(mi("x")) + frac(mi("M"), mi("L")) + mi("d") + mi("x") + eq + frac(mi("M") + L2, mn("12")),
            label: "Integral from minus L over 2 to L over 2 of x squared M over L dx equals M L squared over 12",
            note: "Each segment is weighted by x². About its own line an ideal zero-thickness rod has Ix = 0."
        },
        disk: {
            coordinate: "The thin disk lies in the xy plane. The z axis is normal to its face; the x axis runs along a diameter.",
            body: "Uniform surface density. Disk thickness is neglected.",
            density: frac(mi("M"), mi("π") + R2), symbol: "σ", title: "Surface density",
            dm: "A ring of radius r and width dr has area 2πr dr, so dm = σ 2πr dr.",
            dims: 2, coords: "2 numbers: radius r and angle φ", dmForm: "σ r dr dφ",
            shortcutText: "Add whole rings: the φ sum gives 2π, leaving one ∫ over r",
            integral: integral(mn("0"), mn("2") + mi("π")) + integral(mn("0"), mi("R")) + sq(mi("r")) + mi("σ") + mi("r") + mi("d") + mi("r") + mi("d") + mi("φ"),
            label: "Double integral over phi from zero to 2 pi and r from zero to R of r squared sigma r dr d phi",
            shortcut: integral(mn("0"), mi("R")) + sq(mi("r")) + mi("σ") + mn("2") + mi("π") + mi("r") + mi("d") + mi("r") + eq + frac(mi("M") + R2, mn("2")),
            shortcutLabel: "Integral from zero to R of r squared sigma 2 pi r dr equals M R squared over 2",
            note: "Outer rings contain more mass and sit farther from the axis. About a diameter, Ix = MR²/4."
        },
        annulus: {
            coordinate: "The adjustable ring lies in xy. Its inner radius is a and its outer radius is R. Mass stays fixed as the hole grows.",
            body: "Uniform surface density in the remaining ring. Mass is redistributed, not removed.",
            density: frac(mi("M"), mi("π") + row(mo("(") + R2 + mo("−") + sq(mi("a")) + mo(")"))), symbol: "σ", title: "Surface density",
            dm: "Between a and R, a thin circular strip carries dm = σ 2πr dr. Growing the hole increases the remaining material’s density.",
            dims: 2, coords: "2 numbers: radius r and angle φ", dmForm: "σ r dr dφ",
            shortcutText: "Add whole rings from a to R: one ∫ over r",
            integral: integral(mn("0"), mn("2") + mi("π")) + integral(mi("a"), mi("R")) + sq(mi("r")) + mi("σ") + mi("r") + mi("d") + mi("r") + mi("d") + mi("φ"),
            label: "Double integral over phi from zero to 2 pi and r from a to R of r squared sigma r dr d phi",
            shortcut: integral(mi("a"), mi("R")) + sq(mi("r")) + mi("σ") + mn("2") + mi("π") + mi("r") + mi("d") + mi("r") + eq + frac(mi("M") + row(mo("(") + R2 + plus + sq(mi("a")) + mo(")")), mn("2")),
            shortcutLabel: "Integral from a to R of r squared sigma 2 pi r dr equals M times R squared plus a squared over 2",
            note: "At a = 0 this is a disk. As a approaches R, the mass moves to the rim and I approaches MR², the thin-hoop limit."
        },
        hoop: {
            coordinate: "The thin hoop lies in the xy plane. The z axis is normal to its plane; the x axis runs along a diameter.",
            body: "Uniform linear density. Hoop thickness is neglected.",
            density: frac(mi("M"), mn("2") + mi("π") + mi("R")), symbol: "λ", title: "Linear density",
            dm: "An arc R dφ has mass dm = λ R dφ = M dφ/(2π). All mass lies at radius R.",
            dims: 1, coords: "1 number: angle φ around the hoop", dmForm: "λ R dφ",
            shortcutText: "Already a single integral; every piece is at distance R",
            integral: integral(mn("0"), mn("2") + mi("π")) + R2 + frac(mi("M"), mn("2") + mi("π")) + mi("d") + mi("φ") + eq + mi("M") + R2,
            label: "Integral from zero to 2 pi of R squared M over 2 pi d phi equals M R squared",
            note: "Every piece has the same distance R from z. About a diameter, Ix = MR²/2."
        },
        plate: {
            coordinate: "The plate lies in the xy plane, with length L along x and width W along y. The z axis is normal to its face.",
            body: "Uniform surface density. Plate thickness is neglected.",
            density: frac(mi("M"), mi("L") + mi("W")), symbol: "σ", title: "Surface density",
            dm: "A small rectangle dx dy has mass dm = σ dx dy. Squared distance to z is x² + y².",
            dims: 2, coords: "2 numbers: x and y", dmForm: "σ dx dy",
            shortcutText: "No round symmetry, but it splits into an x² part and a y² part",
            integral: integral(mo("−") + frac(mi("L"), mn("2")), frac(mi("L"), mn("2"))) + integral(mo("−") + frac(mi("W"), mn("2")), frac(mi("W"), mn("2"))) + row(mo("(") + sq(mi("x")) + plus + sq(mi("y")) + mo(")")) + mi("σ") + mi("d") + mi("y") + mi("d") + mi("x"),
            label: "Double integral of x squared plus y squared sigma dy dx over the plate",
            shortcut: mi("σ") + mi("W") + integral(mo("−") + frac(mi("L"), mn("2")), frac(mi("L"), mn("2"))) + sq(mi("x")) + mi("d") + mi("x") + plus + mi("σ") + mi("L") + integral(mo("−") + frac(mi("W"), mn("2")), frac(mi("W"), mn("2"))) + sq(mi("y")) + mi("d") + mi("y") + eq + frac(mi("M") + row(mo("(") + L2 + plus + W2 + mo(")")), mn("12")),
            shortcutLabel: "sigma W times integral of x squared dx plus sigma L times integral of y squared dy equals M times L squared plus W squared over 12",
            note: "Both dimensions matter about z. About x, only width matters: Ix = MW²/12."
        },
        cylinder: {
            coordinate: "The solid cylinder’s length H runs along z. The x axis is a transverse axis through the center.",
            body: "Uniform volume density. This is a solid cylinder, not a hollow shell.",
            density: frac(mi("M"), mi("π") + R2 + mi("H")), symbol: "ρ", title: "Volume density",
            dm: "In cylindrical coordinates, a small volume has mass dm = ρ r dr dφ dz.",
            dims: 3, coords: "3 numbers: radius r, angle φ, height z", dmForm: "ρ r dr dφ dz",
            shortcutText: "The φ sum gives 2π and the z sum gives H, leaving one ∫ over r",
            integral: integral(mo("−") + frac(mi("H"), mn("2")), frac(mi("H"), mn("2"))) + integral(mn("0"), mn("2") + mi("π")) + integral(mn("0"), mi("R")) + sq(mi("r")) + mi("ρ") + mi("r") + mi("d") + mi("r") + mi("d") + mi("φ") + mi("d") + mi("z"),
            label: "Triple integral of r squared rho r dr d phi dz over the cylinder",
            shortcut: mi("ρ") + times + mn("2") + mi("π") + times + mi("H") + integral(mn("0"), mi("R")) + tag("msup", mi("r") + mn("3")) + mi("d") + mi("r") + eq + frac(mi("M") + R2, mn("2")),
            shortcutLabel: "rho times 2 pi times H times the integral from zero to R of r cubed dr equals M R squared over 2",
            note: "Height does not affect Iz at fixed mass. It does affect the transverse moment: Ix = M(3R² + H²)/12."
        },
        sphere: {
            coordinate: "This is a solid sphere centered at the origin. Every axis through its center has the same moment of inertia.",
            body: "Uniform volume density. Dots fill the interior; this is not a spherical shell.",
            density: frac(mn("3") + mi("M"), mn("4") + mi("π") + tag("msup", mi("R") + mn("3"))), symbol: "ρ", title: "Volume density",
            dm: "In spherical coordinates, dm = ρ r² sin ϑ dr dϑ dφ. Distance to z is r sin ϑ.",
            dims: 3, coords: "3 numbers: distance r from the center, angles ϑ and φ", dmForm: "ρ r² sin ϑ dr dϑ dφ",
            shortcutText: "The φ sum gives 2π; the r and ϑ sums separate",
            integral: integral(mn("0"), mi("R")) + integral(mn("0"), mi("π")) + integral(mn("0"), mn("2") + mi("π")) + sq(mo("(") + mi("r") + mi("sin") + mi("ϑ") + mo(")")) + mi("ρ") + sq(mi("r")) + mi("sin") + mi("ϑ") + mi("d") + mi("φ") + mi("d") + mi("ϑ") + mi("d") + mi("r"),
            label: "Triple integral of r sin theta squared rho r squared sin theta d phi d theta dr over the sphere",
            shortcut: mn("2") + mi("π") + mi("ρ") + integral(mn("0"), mi("R")) + tag("msup", mi("r") + mn("4")) + mi("d") + mi("r") + integral(mn("0"), mi("π")) + tag("msup", mi("sin") + mn("3")) + mi("ϑ") + mi("d") + mi("ϑ") + eq + frac(mn("2") + mi("M") + R2, mn("5")),
            shortcutLabel: "2 pi rho times integral of r to the fourth dr times integral of sine cubed theta d theta equals 2 M R squared over 5",
            note: "Spherical symmetry gives Ix = Iy = Iz = 2MR²/5. Tilting a centered axis changes nothing."
        }
    };

    function renderDerivation() {
        const c = data.config, lesson = lessons[c.shape === "annulus" && c.hollow === 1 ? "hoop" : c.shape];
        $("body-note").textContent = lesson.body;
        $("coordinate-note").textContent = lesson.coordinate;
        $("density-title").textContent = lesson.title;
        $("density-note").textContent = lesson.dm;
        equation("density-equation", mi(lesson.symbol) + eq + lesson.density + eq + mn(data.density.value) + unit(data.density.unit), `${lesson.title} ${num(data.density.value)} ${data.density.unit}`);
        const dimensionWords = { 1: "1D line · single ∫", 2: "2D surface · double ∫∫", 3: "3D solid · triple ∫∫∫" };
        $("integral-badge").textContent = dimensionWords[lesson.dims];
        $("integral-kind").textContent = integralSigns[lesson.dims];
        equation("integral-equation", Iz + eq + lesson.integral, lesson.label);
        $("shortcut-caption").hidden = $("integral-shortcut").hidden = !lesson.shortcut;
        if (lesson.shortcut) {
            $("shortcut-caption").textContent = `Using symmetry (${lesson.shortcutText.charAt(0).toLowerCase() + lesson.shortcutText.slice(1)}):`;
            equation("integral-shortcut", Iz + eq + lesson.shortcut, lesson.shortcutLabel);
        }
        renderCountTable(c.shape === "annulus" && c.hollow === 1 ? "hoop" : c.shape);
        $("integral-note").textContent = lesson.note;
        equation("tilt-equation", I + eq + Ix + sq(mi("sin")) + mi("β") + plus + Iz + sq(mi("cos")) + mi("β") + eq + mn(data.exact.centered), `Centered moment equals Ix sin squared beta plus Iz cos squared beta, ${num(data.exact.centered)} kilogram meters squared`);
        $("tilt-note").textContent = `β = ${c.tilt}°. Ix = ${num(data.exact.principal.x)} and Iz = ${num(data.exact.principal.z)} kg·m². These are axes through the same center of mass.`;
        equation("shift-equation", [mi("I") + eq + I + plus + mi("M") + sq(mi("d")), eq + mn(data.exact.centered) + plus + mn(c.mass) + times + sq(mo("(") + mn(c.offset) + mo(")")) + eq + mn(data.exact.total)], `I equals centered moment plus M d squared, ${num(data.exact.total)} kilogram meters squared`);
        $("shift-note").textContent = `The axis moves ${num(Math.abs(c.offset), 2)} m perpendicular to itself. The added ${num(data.exact.shift)} kg·m² is the same for +d and −d.`;
        equation("distance-equation", sq(sub("r", "⊥")) + eq + sq(row(mo("(") + mi("x") + mi("cos") + mi("β") + mo("−") + mi("z") + mi("sin") + mi("β") + mo("−") + mi("d") + mo(")"))) + plus + sq(mi("y")), "Perpendicular distance squared equals x cos beta minus z sin beta minus d, squared, plus y squared");
    }

    // Charts are laid out in real pixels, so their labels stay legible at any width.

    const integralSigns = { 1: "∫ single", 2: "∫∫ double", 3: "∫∫∫ triple" };

    function renderCountTable(current) {
        $("count-table").innerHTML = Object.keys(lessons).map(key => {
            const l = lessons[key], here = key === current;
            return `<tr${here ? ' class="current-shape" aria-current="true"' : ""}><th scope="row"><button type="button" data-load-shape="${key}" aria-pressed="${here}">${M.SHAPES[key].name}</button></th><td>${l.coords}</td><td>${l.dmForm}</td><td class="sign-cell">${integralSigns[l.dims]}</td><td>${l.shortcutText}</td></tr>`;
        }).join("");
        document.querySelectorAll(".dimension-cards [data-dims]").forEach(card => card.classList.toggle("current-shape", Number(card.dataset.dims) === lessons[current].dims));
    }

    const dimensionNames = { radius: "radius", length: "length", width: "width", height: "height" };

    function changeStory(change, before) {
        const c = data.config, b = before.config;
        const I0 = before.exact.total, I1 = data.exact.total;
        const ratio = I1 / I0;
        const moved = Math.abs(ratio - 1) > 1e-9;
        const delta = `I: ${num(I0)} → ${num(I1)} kg·m²${moved ? ` (×${num(ratio, 2)})` : ", unchanged"}. `;
        if (change === "mass") {
            return delta + `Every piece became ${num(c.mass / b.mass, 2)}× heavier at the same distance, so I changed by the same factor. With the shape and axis fixed, doubling mass doubles I and halves the acceleration under the same torque.`;
        }
        if (dimensionNames[change]) {
            const name = dimensionNames[change], k = c[change] / b[change], k2 = k * k;
            if (!moved) return delta + `Changing the ${name} moved material only along the axis, so no perpendicular distance changed. Only distance perpendicular to the axis counts.`;
            if (Math.abs(ratio - k2) < 1e-9 * k2) return delta + `Every perpendicular distance scaled by ${num(k, 2)}, so every r⊥² and therefore I scaled by ${num(k, 2)}² = ${num(k2, 2)}. That is the r² rule: at fixed mass, doubling ${name} makes I four times larger.`;
            return delta + `The ${name} scaled by ${num(k, 2)}, but only part of I depends on it${c.offset !== 0 ? "; the axis-shift term Md² does not" : ""}. So I changed by less than the full ${num(k, 2)}² = ${num(k2, 2)} factor.`;
        }
        if (change === "hollow") {
            return delta + `The inner radius is now ${num(c.hollow * c.radius, 2)} m. The same ${num(c.mass, 2)} kg occupies a narrower ring, farther out on average. About any axis through the center, I is ${num(1 + c.hollow ** 2, 2)} times the solid disk’s value with the same mass and outer radius.`;
        }
        if (change === "tilt") {
            const p = data.exact.principal;
            if (Math.abs(p.x - p.z) < 1e-12) return delta + "Nothing changed! This body has the same centered moment about every direction, so tilting the axis keeps I the same. Only shifting it away from the center changes I.";
            return delta + `The body did not change; the axis did. Tilting changes which distances count as perpendicular. At β = ${c.tilt}° the centered value blends the two principal moments: Iₓ sin²β + I_z cos²β = ${num(p.x)} × ${num(Math.sin(c.tilt * Math.PI / 180) ** 2, 2)} + ${num(p.z)} × ${num(Math.cos(c.tilt * Math.PI / 180) ** 2, 2)}.`;
        }
        if (change === "offset") {
            return delta + `Moving the axis ${num(Math.abs(c.offset), 2)} m from the center adds M d² = ${num(c.mass, 2)} × ${num(Math.abs(c.offset), 2)}² = ${num(data.exact.shift)} kg·m² to the centered value. +d and −d give the same I, and doubling the shift quadruples this added part.`;
        }
        if (change === "resolution") return "More dots improve the numerical approximation. They do not change the physical body or its exact moment of inertia.";
        return null;
    }

    function renderExplanation(change, before) {
        const c = data.config;
        const k = Math.sqrt(data.exact.total / c.mass);
        const story = change && before && before.exact.total > 1e-12 ? changeStory(change, before) : null;
        $("insight-title").textContent = story ? "WHY IT CHANGED" : "WHAT THIS BODY TELLS YOU";
        $("live-insight").textContent = data.exact.total === 0
            ? "An ideal thin rod has zero inertia about its own length. A real rod’s finite thickness gives a nonzero value; choose another axis to run this idealized model."
            : story || `I depends on both mass and where it sits relative to the axis. This body behaves as if all ${num(c.mass, 2)} kg sat ${num(k, 3)} m from the axis (its radius of gyration, k = √(I/M)).${c.offset !== 0 ? ` Of its I, ${num(data.exact.shift)} kg·m² comes from shifting the axis away from the center.` : ""}`;
        const formulas = { rod: "ML²/12", disk: "MR²/2", annulus: "M(R² + a²)/2", hoop: "MR²", plate: "M(L² + W²)/12", cylinder: "MR²/2", sphere: "2MR²/5" };
        $("worked-equation").textContent = c.tilt === 0 && c.offset === 0
            ? `I = ${formulas[c.shape]} = ${num(data.exact.total)} kg·m²`
            : `I = Iₓ sin²β + I_z cos²β + Md² = ${num(data.exact.centered)} + ${num(data.exact.shift)} = ${num(data.exact.total)} kg·m²`;
    }

    function bound(c) {
        if (c.shape === "rod") return c.length / 2;
        if (c.shape === "plate") return Math.hypot(c.length / 2, c.width / 2);
        if (c.shape === "cylinder") return Math.hypot(c.radius, c.height / 2);
        return c.radius;
    }

    // ---------- 3D scenes ----------

    function makeScene(ctx, w, h, c, opts = {}) {
        const { n, u, point: a } = M.axis(c);
        const axisView = !!opts.axisView;
        const right = axisView ? u : [Math.cos(camera.az), -Math.sin(camera.az), 0];
        const up = axisView ? [0, 1, 0] : [-Math.sin(camera.az) * Math.sin(camera.el), -Math.cos(camera.az) * Math.sin(camera.el), Math.cos(camera.el)];
        const toward = [right[1] * up[2] - right[2] * up[1], right[2] * up[0] - right[0] * up[2], right[0] * up[1] - right[1] * up[0]];
        const center = opts.center || [0, 0, 0], scale = opts.scale;
        const dot3 = (q, v) => q[0] * v[0] + q[1] * v[1] + q[2] * v[2];
        const project = p => {
            const q = [p.x - center[0], p.y - center[1], p.z - center[2]];
            return { x: w / 2 + scale * dot3(q, right), y: h / 2 - scale * dot3(q, up), depth: dot3(q, toward) };
        };
        const line = (points, color, width = 1, fill = null, dash = null) => {
            ctx.beginPath();
            points.forEach((p, i) => { const q = project(p); if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); });
            if (fill) { ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); }
            ctx.setLineDash(dash || []);
            ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
            ctx.setLineDash([]);
        };
        ctx.fillStyle = C.panel; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = C.grid;
        for (let x = 16; x < w; x += 28) for (let y = 16; y < h; y += 28) ctx.fillRect(x, y, 1.2, 1.2);
        return { ctx, project, line, scale, n, a, w, h, axisView };
    }

    const exploreScale = (w, h, c) => {
        const extent = Math.max(1.4, bound(c) + Math.abs(c.offset) * 0.65);
        return Math.min(w * 0.2, h * 0.28) / Math.max(1, extent / 2.85);
    };

    function exploreScene(ctx, w, h, c) {
        const { point: a } = M.axis(c);
        const s = makeScene(ctx, w, h, c, { axisView: $("camera").value === "axis", center: [a[0] * 0.4, 0, a[2] * 0.4], scale: exploreScale(w, h, c) });
        s.ctx.canvas.dataset.scale = String(s.scale);
        return s;
    }

    function outline(s, c, angle = 0, ghost = false) {
        const color = ghost ? "rgba(143, 137, 168, .35)" : C.outline;
        const fill = ghost ? null : "rgba(167, 139, 250, .07)";
        const p = (x, y, z = 0) => M.rotate({ x, y, z }, c, angle);
        const circle = (radius, z = 0, plane = "xy") => Array.from({ length: 65 }, (_, i) => {
            const t = i * 2 * Math.PI / 64;
            return plane === "xz" ? p(radius * Math.cos(t), 0, radius * Math.sin(t)) : plane === "yz" ? p(0, radius * Math.cos(t), radius * Math.sin(t)) : p(radius * Math.cos(t), radius * Math.sin(t), z);
        });
        if (c.shape === "rod") s.line([p(-c.length / 2, 0), p(c.length / 2, 0)], color, 5);
        else if (c.shape === "plate") s.line([p(-c.length / 2, -c.width / 2), p(c.length / 2, -c.width / 2), p(c.length / 2, c.width / 2), p(-c.length / 2, c.width / 2), p(-c.length / 2, -c.width / 2)], color, 1.5, fill);
        else if (c.shape === "sphere") {
            const center = s.project(p(0, 0, 0));
            s.ctx.beginPath(); s.ctx.arc(center.x, center.y, c.radius * s.scale, 0, 2 * Math.PI);
            if (fill) { s.ctx.fillStyle = fill; s.ctx.fill(); }
            s.ctx.strokeStyle = color; s.ctx.lineWidth = 1.5; s.ctx.stroke();
            const faint = ghost ? color : "rgba(201, 195, 230, .35)";
            s.line(circle(c.radius), faint, 1); s.line(circle(c.radius, 0, "xz"), faint, 1); s.line(circle(c.radius, 0, "yz"), faint, 1);
        } else if (c.shape === "cylinder") {
            s.line(circle(c.radius, -c.height / 2), color, 1, fill);
            s.line(circle(c.radius, c.height / 2), color, 1.5, fill);
            for (const phi of [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2]) s.line([p(c.radius * Math.cos(phi), c.radius * Math.sin(phi), -c.height / 2), p(c.radius * Math.cos(phi), c.radius * Math.sin(phi), c.height / 2)], color, 1);
        } else if (c.shape === "annulus") {
            const outer = circle(c.radius), inner = circle(c.radius * c.hollow);
            if (!ghost && c.hollow < 1) {
                s.ctx.beginPath();
                for (const ring of [outer, inner]) ring.forEach((v, i) => { const q = s.project(v); if (i) s.ctx.lineTo(q.x, q.y); else s.ctx.moveTo(q.x, q.y); });
                s.ctx.fillStyle = fill; s.ctx.fill("evenodd");
            }
            s.line(outer, color, c.hollow === 1 ? 4 : 1.5);
            if (c.hollow > 0 && c.hollow < 1) s.line(inner, color, 1.5);
        } else s.line(circle(c.radius), color, c.shape === "hoop" ? 4 : 1.5, c.shape === "disk" ? fill : null);
    }

    function drawAxis(s, c, labels = true, cm = { x: 0, y: 0, z: 0 }) {
        const { ctx, project, line, a, n, w, h } = s;
        const axisPoint = project({ x: a[0], y: 0, z: a[2] });
        const b = Math.max(bound(c) + Math.abs(c.offset), 0.6) * 1.5;
        if (!s.axisView) line([{ x: a[0] - b * n[0], y: 0, z: a[2] - b * n[2] }, { x: a[0] + b * n[0], y: 0, z: a[2] + b * n[2] }], C.axis, 2);
        ctx.strokeStyle = C.axis; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(axisPoint.x, axisPoint.y, 7, 0, 2 * Math.PI); ctx.stroke();
        ctx.fillStyle = C.axis; ctx.beginPath(); ctx.arc(axisPoint.x, axisPoint.y, 2, 0, 2 * Math.PI); ctx.fill();
        if (c.offset !== 0) {
            line([cm, { x: a[0], y: 0, z: a[2] }], "rgba(255, 141, 124, .6)", 1, null, [4, 5]);
            const mid = project({ x: (cm.x + a[0]) / 2, y: cm.y / 2, z: (cm.z + a[2]) / 2 });
            ctx.font = "12px ui-monospace, monospace"; ctx.fillStyle = "#ffb1a5"; ctx.fillText(`d = ${num(Math.abs(c.offset), 2)} m`, mid.x + 6, mid.y + 16);
        }
        if (!labels) return;
        ctx.font = "12px ui-monospace, monospace"; ctx.fillStyle = "#ffb1a5";
        ctx.fillText(`axis: tilt ${c.tilt}°, d ${num(c.offset, 2)} m`, 12, 20);
        const scaleSize = Math.min(1, bound(c)), len = scaleSize * s.scale;
        ctx.strokeStyle = C.muted; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(w - 16 - len, h - 16); ctx.lineTo(w - 16, h - 16); ctx.stroke();
        ctx.font = "11px ui-monospace, monospace"; ctx.fillStyle = C.muted; ctx.textAlign = "right";
        ctx.fillText(`${num(scaleSize, 1)} m`, w - 16, h - 24); ctx.textAlign = "left";
        if (!s.axisView) {
            const origin = project({ x: 0, y: 0, z: 0 });
            for (const [label, end] of [["x", { x: 0.35, y: 0, z: 0 }], ["y", { x: 0, y: 0.35, z: 0 }], ["z", { x: 0, y: 0, z: 0.35 }]]) {
                const q = project(end), dx = (q.x - origin.x) * 0.55, dy = (q.y - origin.y) * 0.55;
                ctx.beginPath(); ctx.moveTo(26, h - 30); ctx.lineTo(26 + dx, h - 30 + dy); ctx.stroke();
                ctx.fillText(label, 28 + dx, h - 31 + dy);
            }
        }
    }

    function drawCM(s, position = { x: 0, y: 0, z: 0 }) {
        const center = s.project(position), ctx = s.ctx;
        // A screen-aligned target marks one point, regardless of the axis tilt.
        ctx.fillStyle = C.panel; ctx.strokeStyle = C.white; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(center.x, center.y, 8, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(center.x - 5, center.y); ctx.lineTo(center.x + 5, center.y); ctx.moveTo(center.x, center.y - 5); ctx.lineTo(center.x, center.y + 5); ctx.stroke();
        ctx.font = "700 12px ui-monospace, monospace";
        ctx.fillStyle = C.panel; ctx.fillRect(center.x + 12, center.y + 4, 25, 18);
        ctx.fillStyle = C.white; ctx.fillText("CM", center.x + 16, center.y + 17);
    }

    // Dot area is proportional to the piece's mass, so heavier pieces look heavier.
    const dotRadius = (p, w) => clamp(3.3 * Math.sqrt(p.dm / (2 / 128)) * Math.sqrt(Math.min(1, w / 700)), 1.3, 11);
    const mix = (t, alpha) => `rgba(${COOL.map((v, i) => Math.round(v + (WARM[i] - v) * t)).join(",")},${alpha})`;

    function drawDistance(s, p, label = true) {
        const along = p.x * s.n[0] + p.z * s.n[2];
        const foot = { x: s.a[0] + along * s.n[0], y: 0, z: s.a[2] + along * s.n[2] };
        s.line([p, foot], C.white, 2);
        const q = s.project(p), f = s.project(foot);
        s.ctx.strokeStyle = C.white; s.ctx.lineWidth = 2; s.ctx.beginPath(); s.ctx.arc(q.x, q.y, 9, 0, Math.PI * 2); s.ctx.stroke();
        if (!label) return;
        s.ctx.font = "13px ui-monospace, monospace";
        const text = `r⊥ = ${num(Math.sqrt(p.r2), 2)} m`, tw = s.ctx.measureText(text).width;
        const lx = clamp((q.x + f.x) / 2 + 10, 12, s.w - tw - 12), ly = clamp((q.y + f.y) / 2 - 12, 40, s.h - 30);
        s.ctx.fillStyle = "rgba(7, 7, 13, .85)"; s.ctx.fillRect(lx - 5, ly - 15, tw + 10, 22);
        s.ctx.fillStyle = C.white; s.ctx.fillText(text, lx, ly);
    }

    function drawSpecimen(ctx, w, h) {
        const c = data.config, s = exploreScene(ctx, w, h, c);
        outline(s, c);
        const max = Math.max(...data.points.map(p => p.contribution));
        hits = data.points.map((p, index) => ({ ...s.project(p), p, index })).sort((a, b) => a.depth - b.depth);
        for (const q of hits) {
            ctx.fillStyle = mix(max > 0 ? q.p.contribution / max : 0, 0.85);
            ctx.beginPath(); ctx.arc(q.x, q.y, dotRadius(q.p, w), 0, Math.PI * 2); ctx.fill();
        }
        drawAxis(s, c);
        drawDistance(s, data.points[selected]);
        drawCM(s);
    }

    // ---------- canvases ----------

    const views = {};
    let viewFrame = 0;
    const redrawViews = () => {
        if (viewFrame) return;
        viewFrame = requestAnimationFrame(() => {
            viewFrame = 0;
            for (const key of ["specimen", "builder", "current", "reference"]) if (views[key]) views[key].redraw();
        });
    };

    function pickPiece(canvas, event, list) {
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left, y = event.clientY - rect.top;
        let best = null, distance = 22;
        for (const p of list) { const d = Math.hypot(x - p.x, y - p.y); if (d < distance) { best = p; distance = d; } }
        return best;
    }

    // Drag any 3D view to turn the camera for all of them; a click without a drag picks a piece.
    function orbitable(canvas, onClick) {
        let start = null, moved = false;
        canvas.addEventListener("pointerdown", e => {
            start = { x: e.clientX, y: e.clientY, az: camera.az, el: camera.el }; moved = false;
            if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
        });
        canvas.addEventListener("pointermove", e => {
            if (!start) return;
            const dx = e.clientX - start.x, dy = e.clientY - start.y;
            if (!moved && Math.hypot(dx, dy) < 5) return;
            moved = true;
            canvas.classList.add("dragging");
            if ($("camera").value !== "perspective") $("camera").value = "perspective";
            camera.az = start.az + dx * 0.01;
            camera.el = clamp(start.el + dy * 0.01, -1.45, 1.45);
            redrawViews();
        });
        const end = e => {
            if (start && !moved && onClick && e.type === "pointerup") onClick(e);
            start = null; canvas.classList.remove("dragging");
        };
        canvas.addEventListener("pointerup", end);
        canvas.addEventListener("pointercancel", end);
        canvas.addEventListener("keydown", e => {
            const turn = { ArrowLeft: [-0.12, 0], ArrowRight: [0.12, 0], ArrowUp: [0, -0.12], ArrowDown: [0, 0.12] }[e.key];
            if (!turn) return;
            e.preventDefault();
            $("camera").value = "perspective";
            camera.az += turn[0]; camera.el = clamp(camera.el + turn[1], -1.45, 1.45);
            redrawViews();
        });
    }

    // ---------- step 1: one ball on an arm ----------

    const primerValues = () => ({ r: Number($("primer-r").value), m: Number($("primer-m").value) });

    function primerGeometry(w, h) {
        const ax = w * 0.42, ay = h * 0.5, px = Math.min(w * 0.4, h * 0.46) / (1.2 * Math.SQRT2);
        return { ax, ay, px };
    }

    function drawPrimer(ctx, w, h) {
        const { r, m } = primerValues(), { ax, ay, px } = primerGeometry(w, h);
        ctx.fillStyle = C.panel; ctx.fillRect(0, 0, w, h);
        const I = m * r * r, Iref = 0.25;
        const angle = primer.angle - (primer.twisting || primer.t > 0 ? 0.5 * (1 / I) * primer.t ** 2 : 0);
        const refAngle = primer.angle - (primer.twisting || primer.t > 0 ? 0.5 * (1 / Iref) * primer.t ** 2 : 0);
        const R = r * px, ball = 9 * Math.sqrt(m);
        // Reference ball: 1 kg at 0.5 m, drawn faintly.
        const rr = 0.5 * px, rx = ax + rr * Math.cos(refAngle), ry = ay + rr * Math.sin(refAngle);
        ctx.setLineDash([3, 5]); ctx.strokeStyle = "rgba(184, 178, 207, .35)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(ax, ay, rr, 0, 2 * Math.PI); ctx.stroke(); ctx.setLineDash([]);
        ctx.strokeStyle = "rgba(184, 178, 207, .45)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(rx, ry); ctx.stroke();
        ctx.fillStyle = "rgba(184, 178, 207, .45)"; ctx.beginPath(); ctx.arc(rx, ry, 9, 0, 2 * Math.PI); ctx.fill();
        // The ball's circle and the r² square, rotated with the arm.
        ctx.setLineDash([4, 6]); ctx.strokeStyle = "rgba(105, 245, 231, .35)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(ax, ay, R, 0, 2 * Math.PI); ctx.stroke(); ctx.setLineDash([]);
        ctx.save(); ctx.translate(ax, ay); ctx.rotate(angle);
        ctx.fillStyle = "rgba(248, 212, 119, .14)"; ctx.strokeStyle = C.gold; ctx.lineWidth = 1.5;
        ctx.fillRect(0, -R, R, R); ctx.strokeRect(0, -R, R, R);
        ctx.restore();
        const bx = ax + R * Math.cos(angle), by = ay + R * Math.sin(angle);
        ctx.strokeStyle = C.text; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
        const sq = { x: ax + (R / 2) * Math.cos(angle) + (R / 2) * Math.sin(angle), y: ay + (R / 2) * Math.sin(angle) - (R / 2) * Math.cos(angle) };
        ctx.font = `700 ${R > 60 ? 15 : 12}px ui-sans-serif, system-ui, sans-serif`; ctx.textAlign = "center"; ctx.fillStyle = C.gold;
        ctx.fillText(`r² = ${num(r * r, 2)} m²`, sq.x, sq.y + 5);
        const glow = ctx.createRadialGradient(bx - ball / 3, by - ball / 3, 1, bx, by, ball);
        glow.addColorStop(0, "#c9fff9"); glow.addColorStop(1, C.cyan);
        ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(bx, by, ball, 0, 2 * Math.PI); ctx.fill();
        ctx.font = "700 13px ui-sans-serif, system-ui, sans-serif"; ctx.fillStyle = C.text;
        ctx.fillText(`${num(m, 1)} kg`, bx, by + ball + 17);
        ctx.font = "13px ui-sans-serif, system-ui, sans-serif"; ctx.fillStyle = C.muted;
        const mid = { x: ax + (R / 2) * Math.cos(angle) - 14 * Math.sin(angle), y: ay + (R / 2) * Math.sin(angle) + 14 * Math.cos(angle) };
        ctx.fillText(`r = ${num(r, 2)} m`, mid.x, mid.y + 4);
        ctx.textAlign = "left";
        ctx.strokeStyle = C.axis; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(ax, ay, 7, 0, 2 * Math.PI); ctx.stroke();
        ctx.fillStyle = C.axis; ctx.beginPath(); ctx.arc(ax, ay, 2.2, 0, 2 * Math.PI); ctx.fill();
        ctx.font = "12px ui-sans-serif, system-ui, sans-serif"; ctx.fillText("axis (seen end-on)", 12, 20);
        ctx.fillStyle = "rgba(184, 178, 207, .8)"; ctx.fillText("faint: starting ball, 1 kg at 0.50 m", 12, h - 14);
        // I meter on the right.
        const top = 34, height = h - 76, x = w - 40, fillH = height * Math.min(1, I / 5.76);
        ctx.fillStyle = "rgba(184, 178, 207, .12)"; ctx.fillRect(x, top, 18, height);
        ctx.fillStyle = C.cyan; ctx.fillRect(x, top + height - fillH, 18, fillH);
        const refY = top + height - height * Iref / 5.76;
        ctx.strokeStyle = C.muted; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(x - 6, refY); ctx.lineTo(x + 24, refY); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = C.text; ctx.textAlign = "center"; ctx.font = "700 13px ui-sans-serif, system-ui, sans-serif";
        ctx.fillText("I", x + 9, top - 10); ctx.font = "12px ui-monospace, monospace"; ctx.fillText(num(I, 2), x + 9, top + height + 16);
        ctx.textAlign = "left";
        views.primerHit = { bx, by, ax, ay, px, ball };
    }

    function renderPrimer() {
        const { r, m } = primerValues(), I = m * r * r, k = r / 0.5;
        $("primer-I").textContent = `${num(m, 1)} × ${num(r, 2)}² = ${num(I)} kg·m²`;
        $("primer-insight").textContent = Math.abs(I - 0.25) < 1e-9
            ? "This is the starting ball: 1 kg at 0.50 m. Drag it out to 1.00 m and watch the square: twice the distance, four times the area, four times the inertia."
            : `Compared with the starting ball (1 kg at 0.50 m): distance ×${num(k, 2)} makes r² ×${num(k * k, 2)}${m !== 1 ? `, and mass ×${num(m, 1)} multiplies that again` : ""}. So I is ×${num(I / 0.25, 2)}: the same twist speeds its spin up ${num(I / 0.25, 2)}× ${I > 0.25 ? "more slowly" : "faster"}.`;
        if (!primer.twisting && primer.t === 0) $("primer-race").textContent = "Twisting applies the same 1 N·m torque to your ball and to the faint starting ball (1 kg at 0.50 m).";
        if (views.primer) views.primer.redraw();
        $("primer-canvas").setAttribute("aria-label", `A ${num(m, 1)} kilogram ball ${num(r, 2)} meters from the axis. The square of side r has area ${num(r * r, 2)} square meters. Moment of inertia ${num(I)} kilogram meters squared. Drag the ball or use the arrow keys.`);
    }

    function setPrimer(r, m) {
        if (r != null) $("primer-r").value = clamp(Math.round(r / 0.05) * 0.05, 0.25, 1.2);
        if (m != null) $("primer-m").value = clamp(Math.round(m / 0.5) * 0.5, 0.5, 4);
        stopPrimer(false);
        renderPrimer();
    }

    const primerLoop = UI.createLoop(dt => {
        primer.t = Math.min(2, primer.t + dt);
        if (primer.t >= 2) { stopPrimer(true); return; }
        views.primer.redraw();
    });

    function stopPrimer(finished) {
        primerLoop.stop();
        primer.twisting = false;
        if (finished) {
            const { r, m } = primerValues(), I = m * r * r;
            const turns = 0.5 * (1 / I) * 4 / (2 * Math.PI), refTurns = 0.5 * 4 * 4 / (2 * Math.PI);
            $("primer-race").textContent = `After 2 s at 1 N·m: your ball turned ${num(turns, 2)} turns (α = τ/I = ${num(1 / I, 2)} rad/s²). The starting ball turned ${num(refTurns, 2)} turns (α = 4.00 rad/s²).`;
        } else primer.t = 0;
        if (views.primer) views.primer.redraw();
    }

    function bindPrimer() {
        const canvas = $("primer-canvas");
        let dragging = false;
        const fromPointer = e => {
            const rect = canvas.getBoundingClientRect(), g = views.primerHit;
            const x = e.clientX - rect.left - g.ax, y = e.clientY - rect.top - g.ay;
            primer.angle = Math.atan2(y, x);
            setPrimer(Math.hypot(x, y) / g.px, null);
        };
        canvas.addEventListener("pointerdown", e => {
            const rect = canvas.getBoundingClientRect(), g = views.primerHit;
            const x = e.clientX - rect.left, y = e.clientY - rect.top;
            if (Math.hypot(x - g.bx, y - g.by) > g.ball + 26 && Math.hypot(x - g.ax, y - g.ay) > 1.25 * g.px) return;
            dragging = true; canvas.classList.add("dragging");
            if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
            fromPointer(e);
        });
        canvas.addEventListener("pointermove", e => { if (dragging) fromPointer(e); });
        const end = () => { dragging = false; canvas.classList.remove("dragging"); };
        canvas.addEventListener("pointerup", end); canvas.addEventListener("pointercancel", end);
        canvas.addEventListener("keydown", e => {
            const { r, m } = primerValues();
            const change = { ArrowRight: [0.05, 0], ArrowUp: [0.05, 0], ArrowLeft: [-0.05, 0], ArrowDown: [-0.05, 0], "+": [0, 0.5], "=": [0, 0.5], "-": [0, -0.5] }[e.key];
            if (!change) return;
            e.preventDefault();
            setPrimer(r + change[0], m + change[1]);
        });
        ["primer-r", "primer-m"].forEach(id => $(id).addEventListener("input", () => { stopPrimer(false); renderPrimer(); }));
        $("primer-twist").addEventListener("click", () => {
            primer.t = 0;
            if (UI.prefersReducedMotion()) { primer.t = 2; stopPrimer(true); return; }
            primer.twisting = true;
            $("primer-race").textContent = "Twisting both with 1 N·m…";
            primerLoop.start();
        });
        $("primer-reset").addEventListener("click", () => { primer.angle = -0.4; setPrimer(0.5, 1); });
    }

    // ---------- step 3: nested sums ----------

    const NESTS = {
        rod: [{ sym: "x", child: "piece", children: "pieces along the rod", result: "the rod" }],
        hoop: [{ sym: "φ", child: "piece", children: "pieces around the hoop", result: "the hoop" }],
        disk: [{ sym: "r", child: "ring", children: "rings", result: "the disk" }, { sym: "φ", child: "piece", children: "pieces around one ring", result: "one ring" }],
        annulus: [{ sym: "r", child: "ring", children: "rings from a to R", result: "the ring" }, { sym: "φ", child: "piece", children: "pieces around one ring", result: "one ring" }],
        plate: [{ sym: "x", child: "strip", children: "strips", result: "the plate" }, { sym: "y", child: "piece", children: "pieces along one strip", result: "one strip" }],
        cylinder: [{ sym: "z", child: "slice", children: "slices", result: "the cylinder" }, { sym: "r", child: "ring", children: "rings in one slice", result: "one slice" }, { sym: "φ", child: "piece", children: "pieces around one ring", result: "one ring" }],
        sphere: [{ sym: "z", child: "slice", children: "slices", result: "the sphere" }, { sym: "r", child: "ring", children: "rings in one slice", result: "one slice" }, { sym: "φ", child: "piece", children: "pieces around one ring", result: "one ring" }]
    };
    const LEVEL_COLORS = { 1: [C.gold], 2: [C.violet, C.gold], 3: [C.violet, C.cyan, C.gold] };
    const LEVEL_CLASSES = { 1: ["lv-inner"], 2: ["lv-outer", "lv-inner"], 3: ["lv-outer", "lv-middle", "lv-inner"] };
    const effectiveShape = c => c.shape === "annulus" && c.hollow === 1 ? "hoop" : c.shape;
    let buildCache = null;

    function buildInfo() {
        if (buildCache && buildCache.data === data) return buildCache;
        const B = data.build, L = B[0].idx.length, N = B.length;
        const cum = [0];
        for (const p of B) cum.push(cum[cum.length - 1] + p.contribution);
        const same = (i, j, len) => { for (let q = 0; q < len; q++) if (B[i].idx[q] !== B[j].idx[q]) return false; return true; };
        const starts = [], ends = [];
        for (let len = 0; len < L; len++) {
            const st = new Array(N), en = new Array(N);
            for (let k = 0; k < N; k++) st[k] = k > 0 && same(k, k - 1, len) ? st[k - 1] : k;
            for (let k = N - 1; k >= 0; k--) en[k] = k < N - 1 && same(k, k + 1, len) ? en[k + 1] : k;
            starts.push(st); ends.push(en);
        }
        buildCache = { data, B, L, N, cum, starts, ends, nest: NESTS[effectiveShape(data.config)] };
        return buildCache;
    }

    function drawBuilder(ctx, w, h) {
        const c = data.config, s = exploreScene(ctx, w, h, c), info = buildInfo();
        const { B, L, N, starts } = info, k = Math.min(N - 1, Math.max(0, build.step - 1)), colors = LEVEL_COLORS[L];
        outline(s, c);
        // The current innermost group (a ring or a strip), drawn as a path through its pieces.
        if (L > 1) {
            const g0 = starts[L - 1][build.step < N ? (build.step > 0 && build.step === info.ends[L - 1][k] + 1 ? build.step : k) : k];
            const group = [];
            for (let i = g0; i < N && starts[L - 1][i] === g0; i++) group.push(B[i]);
            if (group.length > 2 && effectiveShape(c) !== "plate") group.push(group[0]);
            s.line(group, "rgba(248, 212, 119, .55)", 1.5, null, [4, 4]);
        }
        const projected = B.map((p, i) => ({ ...s.project(p), p, i })).sort((a, b) => a.depth - b.depth);
        for (const q of projected) {
            const i = q.i;
            let fill = C.faint;
            if (i < build.step) {
                let len = 0;
                for (let l = L - 1; l >= 0; l--) if (starts[l][i] === starts[l][k]) { len = l; break; }
                fill = colors[len];
            }
            ctx.fillStyle = fill;
            ctx.beginPath(); ctx.arc(q.x, q.y, dotRadius(q.p, w), 0, Math.PI * 2); ctx.fill();
        }
        drawAxis(s, c);
        if (build.step > 0) drawDistance(s, B[k], build.step < N);
        views.builderHits = projected;
    }

    function renderNest() {
        const info = buildInfo(), { B, L, N, cum, starts, ends, nest } = info;
        const step = build.step, k = Math.max(0, step - 1), p = B[k], classes = LEVEL_CLASSES[L];
        let html = "";
        for (let level = 0; level < L; level++) {
            const spec = nest[level];
            const count = B[ends[level][k]].idx[level] + 1;
            const child = step === 0 ? 0 : p.idx[level] + 1;
            const partial = step === 0 ? 0 : cum[step] - cum[starts[level][k]];
            let done = "";
            if (level < L - 1 && step > 0) {
                // Totals of the children this sum has already finished.
                const finished = [];
                let i = starts[level][k];
                while (i < step) {
                    const e = ends[level + 1][i];
                    if (e < step) finished.push(cum[e + 1] - cum[i]);
                    i = e + 1;
                }
                if (finished.length) done = `<div class="nest-parts">finished ${spec.child}s: ${finished.slice(-6).map(plain).join(" + ")}${finished.length > 6 ? " + …" : ""}</div>`;
            }
            const whole = level === 0;
            html += `<div class="nest-level ${classes[level]}"><div class="nest-head"><span class="nest-sigma">Σ<sub>${spec.sym}</sub></span><span>add ${spec.children} → <b>${spec.result}</b></span><span class="nest-count">${spec.child} ${child} of ${count}</span></div><div class="nest-value">${whole ? "running total" : `${spec.result} so far`} <strong>${plain(partial)}</strong> kg·m²</div>${done}`;
        }
        html += step === 0
            ? `<div class="nest-piece">Press Play or “+1 piece”. Each piece adds its own r⊥² Δm.</div>`
            : `<div class="nest-piece">${step >= N ? "Last piece" : "Newest piece"}: Δm = ${plain(p.dm)} kg at r⊥ = ${Math.sqrt(p.r2).toFixed(3)} m, so r⊥² Δm = ${Math.sqrt(p.r2).toFixed(3)}² × ${plain(p.dm)} = ${plain(p.contribution)} kg·m²</div>`;
        html += "</div>".repeat(L);
        if (step >= N) html += `<p class="nest-done">All ${N} pieces added: Σ = ${num(cum[N], 4)} kg·m². The exact integral is ${num(data.exact.total, 4)} kg·m² (${num(Math.abs(100 * (cum[N] - data.exact.total) / (data.exact.total || 1)), 2)}% off). Smaller pieces get closer.</p>`;
        $("nest").innerHTML = html;
        $("build-step").disabled = $("build-end").disabled = step >= N;
        $("build-inner").hidden = L < 2;
        $("build-middle").hidden = L < 3;
        if (L >= 2) $("build-inner").textContent = `Finish ${nest[L - 2].child}`;
        if (L >= 3) $("build-middle").textContent = `Finish ${nest[0].child}`;
        $("build-inner").disabled = $("build-middle").disabled = step >= N;
        if (views.builder) views.builder.redraw();
    }

    function renderBuildStatic() {
        const info = buildInfo(), { L, nest } = info, classes = LEVEL_CLASSES[L];
        const sigma = (level, inner) => `<mrow class="${classes[level]}"><munder><mo>∑</mo><mi>${nest[level].sym}</mi></munder>${level < L - 1 ? `<mo>(</mo>${inner}<mo>)</mo>` : inner}</mrow>`;
        let body = `<msup><msub><mi>r</mi><mo>⊥</mo></msub><mn>2</mn></msup><mi mathvariant="normal">Δ</mi><mi>m</mi>`;
        for (let level = L - 1; level >= 0; level--) body = sigma(level, body);
        const ints = "∫".repeat(L);
        $("nest-formula").innerHTML = `<math display="block" aria-label="I is approximately ${L} nested sums of r perpendicular squared delta m, which become ${L} integrals"><mi>I</mi><mo>≈</mo>${body}<mspace width="1em"></mspace><mover><mo>⟶</mo><mtext>pieces shrink</mtext></mover><mspace width="1em"></mspace><mo>${ints}</mo><msup><msub><mi>r</mi><mo>⊥</mo></msub><mn>2</mn></msup><mi>d</mi><mi>m</mi></math><p class="optics-caption">Read it from the inside out: ${nest.slice().reverse().map((n, i) => `${i === 0 ? "first" : "then"} add ${n.children} to get ${n.result}`).join(", ")}. ${L === 1 ? "A line needs only one sum." : `Each Σ becomes one ∫: ${L === 2 ? "a double" : "a triple"} integral.`}</p>`;
        const names = L === 1 ? ["added pieces"] : L === 2 ? [`finished ${nest[0].child}s`, `this ${nest[0].child}`] : [`finished ${nest[0].child}s`, `this ${nest[0].child}`, `this ${nest[1].child}`];
        $("build-legend").innerHTML = names.map((name, i) => `<span><i class="lab-dot" style="background:${LEVEL_COLORS[L][i]}"></i>${name}</span>`).join("") + `<span><i class="lab-dot" style="background:${C.faint}"></i>not added yet</span><span><i class="lab-dot ring"></i>newest piece</span>`;
        const rows = [4, 8, 16].map(n => {
            const d = n === data.config.resolution ? data : M.evaluate({ ...data.config, resolution: n });
            const err = data.exact.total > 0 ? 100 * Math.abs(d.numerical - data.exact.total) / data.exact.total : 0;
            return `<tr${n === data.config.resolution ? ' class="current-row"' : ""}><td>${{ 4: "big", 8: "medium", 16: "small" }[n]}</td><td>${d.points.length}</td><td>${num(d.numerical, 4)}</td><td>${num(err, 2)}%</td></tr>`;
        });
        $("convergence").querySelector("tbody").innerHTML = rows.join("") + `<tr class="exact-row"><td>infinitely small</td><td>∞</td><td>${num(data.exact.total, 4)} (∫)</td><td>0%</td></tr>`;
    }

    function setBuildStep(step) {
        build.step = clamp(step, 0, buildInfo().N);
        if (build.step >= buildInfo().N) buildLoop.stop();
        renderNest();
    }

    const buildLoop = UI.createLoop(dt => {
        build.carry += dt * Number($("build-speed").value);
        const add = Math.floor(build.carry);
        if (!add) return;
        build.carry -= add;
        setBuildStep(build.step + add);
    }, { onChange: running => { $("build-play").textContent = running ? "❚❚ Pause" : build.step >= buildInfo().N ? "▶ Play again" : "▶ Play"; } });

    function finishGroup(len) {
        const info = buildInfo();
        if (build.step >= info.N) return;
        buildLoop.stop();
        setBuildStep(info.ends[len][build.step] + 1);
    }

    function bindBuilder() {
        $("build-play").addEventListener("click", () => {
            if (buildLoop.isRunning()) { buildLoop.stop(); return; }
            if (build.step >= buildInfo().N) setBuildStep(0);
            if (UI.prefersReducedMotion()) { setBuildStep(buildInfo().N); return; }
            build.carry = 0;
            buildLoop.start();
        });
        $("build-step").addEventListener("click", () => { buildLoop.stop(); setBuildStep(build.step + 1); });
        $("build-inner").addEventListener("click", () => finishGroup(buildInfo().L - 1));
        $("build-middle").addEventListener("click", () => finishGroup(1));
        $("build-end").addEventListener("click", () => { buildLoop.stop(); setBuildStep(buildInfo().N); });
        $("build-reset").addEventListener("click", () => { buildLoop.stop(); setBuildStep(0); });
        // Start the builder once, the first time it scrolls into view.
        if ("IntersectionObserver" in window) {
            const io = new IntersectionObserver(entries => {
                if (!entries.some(e => e.isIntersecting)) return;
                io.disconnect();
                if (!UI.prefersReducedMotion() && build.step === 0) buildLoop.start();
            }, { threshold: 0.45 });
            io.observe($("builder"));
        }
    }

    // ---------- step 4: equal twist race ----------

    function bodyName(d) {
        const c = d.config;
        const dimensions = M.SHAPES[c.shape].dimensions.filter(k => k !== "hollow").map(k => `${({ radius: "R", length: "L", width: "W", height: "H" })[k]} ${num(c[k], 2)} m`).join(" · ");
        return `${M.SHAPES[c.shape].name} · ${num(c.mass, 1)} kg · ${dimensions}${c.shape === "annulus" ? ` · a ${num(c.hollow * c.radius, 2)} m` : ""} · β ${c.tilt}° · d ${num(c.offset, 2)} m`;
    }

    function motionScale(w, h) {
        const extent = Math.max(1.4, bound(data.config) + Math.abs(data.config.offset), bound(reference.config) + Math.abs(reference.config.offset));
        return Math.min(w * 0.39, h * 0.36) / extent;
    }

    function drawMotion(ctx, w, h, d) {
        const c = d.config, { point: a } = M.axis(c);
        const motion = M.motion(d.exact.total, Number($("torque").value), motionState.time), angle = motion ? motion.angle : 0;
        const s = makeScene(ctx, w, h, c, { center: a, scale: motionScale(w, h) });
        ctx.canvas.dataset.scale = String(s.scale);
        outline(s, c, 0, true);
        outline(s, c, angle);
        const origin = { x: 0, y: 0, z: 0 }, cm = M.rotate(origin, c, angle);
        drawAxis(s, c, true, cm);
        if (c.offset !== 0) {
            s.line(Array.from({ length: 65 }, (_, i) => M.rotate(origin, c, i * Math.PI / 32)), "rgba(201, 195, 230, .6)", 1.5, null, [3, 5]);
        }
        const { x, y, z } = M.farthestPoint(c), p = { x, y, z };
        const marker = M.rotate(p, c, angle), q = s.project(marker);
        if (angle > 0) s.line(Array.from({ length: 50 }, (_, i) => M.rotate(p, c, angle * Math.max(0, 1 - 2 * Math.PI / angle) + Math.min(angle, 2 * Math.PI) * i / 49)), "rgba(248, 212, 119, .4)", 2);
        const along = p.x * s.n[0] + p.z * s.n[2];
        s.line([{ x: s.a[0] + along * s.n[0], y: 0, z: s.a[2] + along * s.n[2] }, marker], C.gold, 2);
        ctx.fillStyle = C.gold; ctx.beginPath(); ctx.arc(q.x, q.y, 5, 0, 2 * Math.PI); ctx.fill();
        drawCM(s, cm);
        ctx.font = "12px ui-monospace, monospace"; ctx.fillStyle = C.muted; ctx.fillText(`t = ${num(motionState.time, 2)} s`, 12, 38);
    }

    function drawMotionChart(ctx, w, h) {
        const torque = Number($("torque").value), t = motionState.time;
        const current = M.motion(data.exact.total, torque, 2), ref = M.motion(reference.exact.total, torque, 2);
        ctx.fillStyle = C.panel; ctx.fillRect(0, 0, w, h);
        const ymax = Math.max(current ? current.omega : 0, ref ? ref.omega : 0, 0.1) * 1.15;
        const series = [];
        if (current) series.push({ xs: [0, 2], ys: [0, current.omega], label: "your body", color: C.cyan, width: 2.5 });
        if (ref) series.push({ xs: [0, 2], ys: [0, ref.omega], label: "reference", color: C.rose, width: 2.5, dash: [7, 5] });
        const map = UI.plot(ctx, { x: 0, y: 0, w, h }, { x: { min: 0, max: 2, label: "time t", unit: "s" }, y: { min: 0, max: ymax, label: "spin speed ω", unit: "rad/s" }, series, cursor: { x: t, label: `t = ${num(t, 2)} s` }, legendPosition: "left" });
        for (const [m, color] of [[current, C.cyan], [ref, C.rose]]) {
            if (!m) continue;
            const pt = map.toPx(t, m.alpha * t);
            ctx.fillStyle = color; ctx.beginPath(); ctx.arc(pt.x, pt.y, 5, 0, 2 * Math.PI); ctx.fill();
        }
    }

    function syncReference() {
        if (referenceMode === "auto") {
            const c = { ...data.config, tilt: 0, offset: 0 };
            if (controls.some(key => c[key] !== reference.config[key])) reference = M.evaluate(c);
        } else reference = referenceMode === "pinned" ? pinnedReference : experimentReference;
        $("reference-mode").value = referenceMode;
        $("reference-experiment").disabled = !activeExperiment;
        $("reference-pinned").disabled = !pinnedReference;
        $("reference-note").textContent = referenceMode === "auto"
            ? "Reference follows your shape, mass and dimensions, with β = 0° and d = 0."
            : referenceMode === "pinned" ? "Reference is your pinned snapshot. Body controls change your body only."
            : "Reference is the guided experiment’s comparison body. Choose “Same body” to follow your changes.";
    }

    function renderMotion() {
        syncReference();
        const torque = Number($("torque").value), t = motionState.time;
        for (const [prefix, d] of [["current", data], ["reference", reference]]) {
            const motion = M.motion(d.exact.total, torque, t);
            $(prefix + "-name").textContent = bodyName(d);
            $(prefix + "-I").textContent = num(d.exact.total);
            for (const key of ["alpha", "omega", "angle"]) $(prefix + "-" + key).textContent = motion ? num(motion[key]) : "undefined";
            if (views[prefix]) views[prefix].redraw();
        }
        $("run-motion").disabled = !M.motion(data.exact.total, torque, 0) || !M.motion(reference.exact.total, torque, 0);
        $("pause-motion").disabled = $("run-motion").disabled || t === 0 || t >= 2;
        $("pause-motion").textContent = motionState.running || t === 0 || t >= 2 ? "Pause" : "Resume";
        $("motion-time").value = t;
        $("motion-time-value").textContent = `${num(t, 2)} / 2.00 s`;
        renderComparison(torque);
        if (views.chart) views.chart.redraw();
        const current = M.motion(data.exact.total, torque, 2), ref = M.motion(reference.exact.total, torque, 2);
        $("motion-chart").setAttribute("aria-label", `Angular speed versus time. At ${num(t, 2)} seconds: your body ${current ? num(current.alpha * t) : "undefined"} rad/s, reference ${ref ? num(ref.alpha * t) : "undefined"} rad/s. Dashed line is the reference.`);
    }

    function renderComparison(torque) {
        const a = data.exact.total, b = reference.exact.total;
        for (const [prefix, value] of [["current", a], ["reference", b]]) {
            $(prefix + "-bar").max = Math.max(a, b, 0.001);
            $(prefix + "-bar").value = value;
            $(prefix + "-bar-value").textContent = `${num(value)} kg·m²`;
        }
        let headline, explanation;
        if (a <= 1e-12 || b <= 1e-12) {
            headline = "This ideal axis needs a different model.";
            explanation = "A zero-thickness rod has no mass away from its own axis. I = 0 makes τ/I undefined. Choose a different axis; if the reference has zero inertia, pin a valid body as the new reference.";
        } else if (torque === 0) {
            headline = "No torque. No change in spin.";
            explanation = "Both bodies start at rest, so both stay at rest. Increase the torque to compare how their inertia affects acceleration.";
        } else if (Math.abs(a - b) < 1e-9) {
            headline = "Equal inertia. Equal acceleration.";
            explanation = "Under the same torque these bodies gain angular speed at the same rate, even if their shapes or axes look different.";
        } else {
            const faster = a < b;
            headline = `${faster ? "Your body" : "The reference"} accelerates ${num(Math.max(a, b) / Math.min(a, b), 2)}× as fast.`;
            explanation = `Your body: α = ${num(torque, 2)} / ${num(a)} = ${num(torque / a)} rad/s². Reference: α = ${num(torque, 2)} / ${num(b)} = ${num(torque / b)} rad/s². A smaller I means a larger change in spin for the same torque.`;
        }
        $("comparison-headline").textContent = headline;
        $("comparison-explanation").textContent = explanation;
        const current = M.motion(a, torque, motionState.time);
        $("motion-equation").textContent = current
            ? `At t = ${num(motionState.time, 2)} s, your body has ω = αt = ${num(current.alpha)} × ${num(motionState.time, 2)} = ${num(current.omega)} rad/s. Its angle is θ = ½αt² = ${num(current.angle)} rad (${num(current.angle / (2 * Math.PI), 2)} turns).`
            : "The speed graph is undefined for a zero-inertia body. Choose an axis with mass away from it.";
    }

    const motionLoop = UI.createLoop(dt => {
        motionState.time = Math.min(2, motionState.time + dt);
        if (motionState.time >= 2) { finishMotion(); return; }
        renderMotion();
    });

    function resetMotion(message = "Ready. Both bodies start at rest.") {
        motionLoop.stop(); motionState.running = false; motionState.time = 0;
        $("motion-status").textContent = message;
        renderMotion();
    }

    function finishMotion() {
        motionLoop.stop(); motionState.running = false; motionState.time = 2;
        renderMotion();
        const torque = Number($("torque").value);
        const current = M.motion(data.exact.total, torque, 2), ref = M.motion(reference.exact.total, torque, 2);
        $("motion-status").textContent = `After 2.00 s at ${num(torque, 2)} N·m: your body turned ${num(current.angle)} rad and spins at ${num(current.omega)} rad/s; the reference turned ${num(ref.angle)} rad at ${num(ref.omega)} rad/s.${UI.prefersReducedMotion() ? " Reduced motion: showing the final state without animation." : ""}`;
    }

    function startMotion() {
        if ($("run-motion").disabled) return;
        resetMotion("The same torque is applied to both. They speed up from rest.");
        if (UI.prefersReducedMotion()) { finishMotion(); return; }
        motionState.running = true; renderMotion(); motionLoop.start();
    }

    // ---------- step 5: off-center axis ----------

    function drawOrbit(ctx, w, h) {
        const c = data.config, { point: a } = M.axis(c);
        const extent = bound(c) + Math.abs(c.offset);
        const s = makeScene(ctx, w, h, c, { axisView: true, center: a, scale: Math.min(w, h) * 0.42 / Math.max(0.8, extent) });
        const angle = orbitAngle;
        outline(s, c, 0, true);
        outline(s, c, angle);
        const origin = { x: 0, y: 0, z: 0 }, cmNow = M.rotate(origin, c, angle);
        if (c.offset !== 0) {
            s.line(Array.from({ length: 65 }, (_, i) => M.rotate(origin, c, i * Math.PI / 32)), "rgba(201, 195, 230, .6)", 1.5, null, [3, 5]);
            s.line([{ x: a[0], y: 0, z: a[2] }, cmNow], C.gold, 2.5);
            const mid = s.project({ x: (a[0] + cmNow.x) / 2, y: cmNow.y / 2, z: (a[2] + cmNow.z) / 2 });
            ctx.font = "700 12px ui-sans-serif, system-ui, sans-serif"; ctx.fillStyle = C.gold; ctx.fillText(`d = ${num(Math.abs(c.offset), 2)} m`, mid.x + 8, mid.y - 6);
        }
        // An arrow fixed to the body shows its own rotation about the center.
        const tipLocal = M.farthestPoint({ ...c, offset: 0 }), tip = M.rotate({ x: tipLocal.x * 0.75, y: tipLocal.y * 0.75, z: tipLocal.z * 0.75 }, c, angle);
        const cm = s.project(cmNow), tp = s.project(tip);
        ctx.strokeStyle = C.cyan; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(cm.x, cm.y); ctx.lineTo(tp.x, tp.y); ctx.stroke();
        const head = Math.atan2(tp.y - cm.y, tp.x - cm.x);
        ctx.fillStyle = C.cyan; ctx.beginPath(); ctx.moveTo(tp.x, tp.y); ctx.lineTo(tp.x - 10 * Math.cos(head - 0.4), tp.y - 10 * Math.sin(head - 0.4)); ctx.lineTo(tp.x - 10 * Math.cos(head + 0.4), tp.y - 10 * Math.sin(head + 0.4)); ctx.fill();
        drawAxis(s, c, false, cmNow);
        drawCM(s, cmNow);
        ctx.font = "12px ui-sans-serif, system-ui, sans-serif"; ctx.fillStyle = C.gold;
        ctx.fillText(c.offset !== 0 ? "① center goes around the axis (M d²)" : "d = 0: the center stays on the axis", 12, 20);
        ctx.fillStyle = C.cyan; ctx.fillText("② body turns about its own center (I_CM)", 12, 38);
    }

    const orbitLoop = UI.createLoop(dt => { orbitAngle += dt * 0.7; views.orbit.redraw(); });

    function drawShiftChart(ctx, w, h) {
        const c = data.config, centered = data.exact.centered, total = data.exact.total;
        ctx.fillStyle = C.panel; ctx.fillRect(0, 0, w, h);
        const xs = Array.from({ length: 81 }, (_, i) => -2 + i / 20), ys = xs.map(d => centered + c.mass * d * d);
        const map = UI.plot(ctx, { x: 0, y: 0, w, h }, {
            x: { min: -2, max: 2, label: "axis distance from the center d", unit: "m" }, y: { min: 0, max: centered + c.mass * 4.2, label: "I", unit: "kg·m²" },
            series: [{ xs, ys, label: "I = I_CM + M d²", color: C.text, width: 2.5 }, { xs: [-2, 2], ys: [centered, centered], label: "I_CM", color: C.cyan, dash: [5, 5] }], legendPosition: "left"
        });
        const base = map.toPx(c.offset, centered), top = map.toPx(c.offset, total);
        if (c.offset !== 0) { ctx.strokeStyle = C.gold; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(top.x, top.y); ctx.stroke(); ctx.font = "700 12px ui-sans-serif, system-ui, sans-serif"; ctx.fillStyle = C.gold; ctx.textAlign = c.offset > 0 ? "right" : "left"; ctx.fillText("M d²", base.x + (c.offset > 0 ? -9 : 9), (base.y + top.y) / 2 + 4); ctx.textAlign = "left"; }
        ctx.fillStyle = C.white; ctx.beginPath(); ctx.arc(top.x, top.y, 7, 0, 2 * Math.PI); ctx.fill();
        ctx.strokeStyle = C.cyan; ctx.lineWidth = 2; ctx.stroke();
        views.shiftMap = map;
    }

    function renderOffcenter() {
        const c = data.config, centered = data.exact.centered, shift = data.exact.shift, total = data.exact.total;
        $("offcenter-d").value = c.offset;
        $("offcenter-cm").textContent = `${num(centered)} kg·m²`;
        $("offcenter-shift").textContent = `${num(c.mass, 2)} × ${num(Math.abs(c.offset), 2)}² = ${num(shift)} kg·m²`;
        $("offcenter-total").textContent = `${num(total)} kg·m²`;
        $("offcenter-bar-cm").style.width = `${total > 0 ? 100 * centered / total : 0}%`;
        $("offcenter-bar-shift").style.width = `${total > 0 ? 100 * shift / total : 0}%`;
        $("offcenter-insight").textContent = c.offset === 0
            ? `The axis goes through the center of mass, so the center does not travel at all: I = I_CM = ${num(total)} kg·m². Drag d, or the dot on the curve, to move the axis.`
            : `The ${M.SHAPES[c.shape].name.toLowerCase()} is unchanged; only the axis moved. Its center now circles the axis at ${num(Math.abs(c.offset), 2)} m, which adds ${num(shift)} kg·m²: ${num(total > 0 ? 100 * shift / total : 0, 0)}% of the total I.${centered > 0 ? ` Spinning it is now ${num(total / centered, 2)}× harder than about its center.` : ""}`;
        if (views.shift) views.shift.redraw();
        if (views.orbit) views.orbit.redraw();
        $("shift-chart").setAttribute("aria-label", `Moment of inertia against axis distance. Lowest value ${num(centered)} at d = 0. Current d ${num(c.offset, 2)} meters gives ${num(total)}. Drag or use arrow keys to move the axis.`);
    }

    function bindShiftChart() {
        const canvas = $("shift-chart");
        let dragging = false;
        const setFrom = e => {
            const map = views.shiftMap, rect = canvas.getBoundingClientRect();
            if (!map) return;
            const d = clamp(Math.round(map.pxToX(e.clientX - rect.left) / 0.05) * 0.05, -2, 2);
            setOffset(d);
        };
        canvas.addEventListener("pointerdown", e => { dragging = true; canvas.classList.add("dragging"); if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId); setFrom(e); });
        canvas.addEventListener("pointermove", e => { if (dragging) setFrom(e); });
        const end = () => { dragging = false; canvas.classList.remove("dragging"); };
        canvas.addEventListener("pointerup", end); canvas.addEventListener("pointercancel", end);
        canvas.addEventListener("keydown", e => {
            const step = { ArrowLeft: -0.05, ArrowDown: -0.05, ArrowRight: 0.05, ArrowUp: 0.05 }[e.key];
            if (step == null) return;
            e.preventDefault();
            setOffset(clamp(data.config.offset + step, -2, 2));
        });
    }

    function setOffset(d) {
        if (Math.abs(Number($("offset").value) - d) < 1e-9) return;
        $("offset").value = d;
        changeBody({ target: $("offset") });
    }

    // ---------- explorer panels ----------

    function drawDistribution(ctx, w, h) {
        const bins = data.bins, total = bins.reduce((sum, b) => sum + b.inertia, 0);
        const shares = bins.map(b => ({ mass: 100 * b.mass / data.config.mass, inertia: total > 0 ? 100 * b.inertia / total : 0 }));
        const top = Math.max(10, ...shares.flatMap(b => [b.mass, b.inertia])) * 1.12, maxR = bins[bins.length - 1].to || 1;
        ctx.fillStyle = C.panel; ctx.fillRect(0, 0, w, h);
        const map = UI.plot(ctx, { x: 0, y: 0, w, h }, { x: { min: 0, max: maxR, label: "distance from the axis r⊥", unit: "m" }, y: { min: 0, max: top, label: "share", unit: "%" }, series: [{ xs: [0], ys: [0], label: "mass", color: C.cyan, pointsOnly: true }, { xs: [0], ys: [0], label: "inertia", color: C.gold, pointsOnly: true }], legendPosition: "left" });
        bins.forEach((b, i) => {
            const x0 = map.xToPx(b.from), x1 = map.xToPx(b.to), gap = (x1 - x0) * 0.12, bw = (x1 - x0 - 3 * gap) / 2, base = map.yToPx(0);
            ctx.fillStyle = C.cyan; ctx.fillRect(x0 + gap, map.yToPx(shares[i].mass), bw, base - map.yToPx(shares[i].mass));
            ctx.fillStyle = C.gold; ctx.fillRect(x0 + 2 * gap + bw, map.yToPx(shares[i].inertia), bw, base - map.yToPx(shares[i].inertia));
        });
    }

    function renderDistributionText() {
        const bins = data.bins, total = bins.reduce((sum, b) => sum + b.inertia, 0);
        const shares = bins.map(b => ({ mass: b.mass / data.config.mass, inertia: total > 0 ? b.inertia / total : 0 }));
        $("distribution-table").innerHTML = bins.map((b, i) => `<tr><th scope="row">${num(b.from, 2)}–${num(b.to, 2)}</th><td>${num(100 * shares[i].mass, 1)}%</td><td>${num(100 * shares[i].inertia, 1)}%</td></tr>`).join("");
        const outer = shares.slice(5).reduce((a, b) => ({ mass: a.mass + b.mass, inertia: a.inertia + b.inertia }), { mass: 0, inertia: 0 });
        $("distribution-description").textContent = total === 0 ? "All the mass lies on the axis, so it adds no inertia." : `Cyan: share of the mass. Gold: share of the inertia. The outer half of the distances holds ${num(100 * outer.mass, 1)}% of the mass but ${num(100 * outer.inertia, 1)}% of the inertia, because each piece counts with r⊥².`;
        if (views.distribution) views.distribution.redraw();
    }

    function renderPiece() {
        const count = data.points.length, p = data.points[selected];
        $("piece").max = count;
        $("piece").value = selected + 1;
        $("piece-value").textContent = `${selected + 1} / ${count}`;
        $("piece-mass").textContent = `${plain(p.dm)} kg`;
        $("piece-distance").textContent = `${num(Math.sqrt(p.r2))} m`;
        $("piece-inertia").textContent = `${plain(p.contribution)} kg·m²`;
        $("piece-explanation").textContent = `${plain(p.dm)} kg × (${num(Math.sqrt(p.r2))} m)² = ${plain(p.contribution)} kg·m². This piece holds ${num(100 * p.dm / data.config.mass, 2)}% of the mass and gives ${num(data.numerical > 0 ? 100 * p.contribution / data.numerical : 0, 2)}% of the inertia. Pieces are numbered from the axis outwards.`;
        $("piece-position").textContent = `Position (x, y, z) = (${num(p.x, 2)}, ${num(p.y, 2)}, ${num(p.z, 2)}) m.`;
        $("piece").setAttribute("aria-valuetext", `Piece ${selected + 1} of ${count}, mass ${num(p.dm, 4)} kilograms, distance ${num(Math.sqrt(p.r2))} meters`);
        if (views.specimen) views.specimen.redraw();
    }

    // ---------- body changes ----------

    function renderBody() {
        const c = data.config;
        controls.forEach(id => { if (String($(id).value) !== String(c[id])) $(id).value = c[id]; });
        document.querySelectorAll("[data-dimension]").forEach(e => { e.hidden = !M.SHAPES[c.shape].dimensions.includes(e.dataset.dimension); });
        document.querySelectorAll("[data-tilt]").forEach(e => e.setAttribute("aria-pressed", String(Number(e.dataset.tilt) === c.tilt)));
        $("specimen-title").textContent = M.SHAPES[c.shape].name;
        $("inertia-value").textContent = num(data.exact.total);
        $("centered-value").textContent = num(data.exact.centered);
        $("shift-value").textContent = num(data.exact.shift);
        $("scene-description").textContent = `${M.SHAPES[c.shape].name}, ${num(c.mass, 2)} kg, split into ${data.points.length} pieces. The white CM target marks the body’s center of mass; changing the axis does not move it. Coral: the axis, tilted ${c.tilt}° from z and moved ${num(c.offset, 2)} m off-center. Warmer dots add more r⊥²Δm. The white line is the selected piece’s distance r⊥.`;
        renderExplanation();
        renderDerivation();
        renderDistributionText();
        renderPiece();
        buildLoop.stop();
        build.step = 0;
        renderBuildStatic();
        renderNest();
        renderOffcenter();
        renderMotion();
    }

    function changeBody(event) {
        const c = Object.fromEntries(controls.map(id => [id, $(id).value]));
        const change = event && event.target.id;
        const before = data;
        data = M.evaluate(c);
        selected = Math.min(selected, data.points.length - 1);
        // Following an experiment's instructions keeps it active; switching shape leaves it.
        if (change === "shape") setExperiment(null);
        if (change !== "resolution") resetMotion();
        renderBody();
        renderExplanation(change, before);
        if ($("run-motion").disabled) $("motion-status").textContent = "This idealized axis has I = 0, so α = τ/I has no finite value. Change the axis or shape to run the race.";
    }

    const experiments = {
        outward: { current: { shape: "disk" }, reference: { shape: "hoop" }, note: "A disk and a hoop each have 2 kg of mass and a 1 m radius. Predict which gains spin faster, then apply equal torque. Look at where each body stores its mass." },
        redistribute: { current: { shape: "annulus", hollow: 0 }, reference: { shape: "disk" }, note: "Drag “Move mass toward the rim” from disk to hoop. Keep the same 2 kg and 1 m outer radius. Does shifting mass outward make the body easier or harder to accelerate?" },
        shift: { current: { shape: "rod", offset: 1 }, reference: { shape: "rod" }, note: "Same 2 m rod: move the axis from its center to its end. I becomes four times larger. The offset adds M(L/2)²; neither the body nor its mass changed." },
        tilt: { current: { shape: "disk", tilt: 90 }, reference: { shape: "disk" }, note: "Same disk, same center: turn the axis from the face normal (z) to a diameter (x). The moment halves because the perpendicular distances change." },
        sphere: { current: { shape: "sphere", tilt: 90 }, reference: { shape: "sphere" }, note: "A solid sphere has equal centered moments in every direction. Tilt the axis and the response stays the same. Shift it to break that equality." },
        plate: { current: { shape: "plate", resolution: 4 }, reference: { shape: "disk" }, note: "A 2 m × 1 m plate about z, cut into 4 × 4 big pieces. In step 3 the inner sum adds the 4 pieces of one strip; the outer sum adds the 4 strips. Press “Finish strip” and watch each strip total appear." }
    };

    function setExperiment(key) {
        activeExperiment = key;
        if (!key && referenceMode === "experiment") referenceMode = "auto";
        $("experiment-note").textContent = key ? experiments[key].note : "Your own experiment. Change one variable at a time, and pin a reference to compare before and after.";
        document.querySelectorAll("[data-experiment]").forEach(b => { b.setAttribute("aria-pressed", String(b.dataset.experiment === key)); b.classList.toggle("active", b.dataset.experiment === key); });
    }

    function experiment(key) {
        const e = experiments[key];
        data = M.evaluate({ ...M.DEFAULTS, ...e.current });
        reference = M.evaluate({ ...M.DEFAULTS, ...e.reference });
        experimentReference = reference;
        referenceMode = "experiment";
        selected = Math.floor(data.points.length * 0.75);
        $("torque").value = 1;
        setExperiment(key);
        resetMotion(); renderBody();
    }

    function resetBody() {
        if (activeExperiment) { experiment(activeExperiment); return; }
        data = M.evaluate({ ...M.DEFAULTS, resolution: data.config.resolution });
        selected = Math.floor(data.points.length * 0.75);
        resetMotion(); renderBody();
    }

    // ---------- wiring ----------

    function init() {
        UI.enhanceAllSliders(document.querySelector(".inertia-lab"), {
            mass: { unit: "kg" }, radius: { unit: "m" }, length: { unit: "m" }, width: { unit: "m" }, height: { unit: "m" },
            hollow: { unit: "× R" }, tilt: { unit: "°" }, offset: { unit: "m" }, "offcenter-d": { unit: "m" }, torque: { unit: "N·m" },
            "motion-time": { unit: "s" }, "primer-r": { unit: "m" }, "primer-m": { unit: "kg" }
        });
        views.primer = UI.setupCanvas($("primer-canvas"), { aspect: 1.3, minHeight: 280, maxHeight: 440, draw: drawPrimer });
        views.specimen = UI.setupCanvas($("specimen"), { aspect: 1.65, minHeight: 300, maxHeight: 470, draw: drawSpecimen });
        views.distribution = UI.setupCanvas($("distribution-chart"), { aspect: 1.45, minHeight: 230, maxHeight: 320, draw: drawDistribution });
        views.builder = UI.setupCanvas($("builder"), { aspect: 1.25, minHeight: 300, maxHeight: 480, draw: drawBuilder });
        views.current = UI.setupCanvas($("current-motion"), { aspect: 1.55, minHeight: 210, maxHeight: 340, draw: (ctx, w, h) => drawMotion(ctx, w, h, data) });
        views.reference = UI.setupCanvas($("reference-motion"), { aspect: 1.55, minHeight: 210, maxHeight: 340, draw: (ctx, w, h) => drawMotion(ctx, w, h, reference) });
        views.chart = UI.setupCanvas($("motion-chart"), { aspect: 2.6, minHeight: 220, maxHeight: 300, draw: drawMotionChart });
        views.orbit = UI.setupCanvas($("orbit-canvas"), { aspect: 1.3, minHeight: 260, maxHeight: 380, draw: drawOrbit });
        views.shift = UI.setupCanvas($("shift-chart"), { aspect: 1.3, minHeight: 260, maxHeight: 380, draw: drawShiftChart });

        bindPrimer();
        bindBuilder();
        bindShiftChart();
        orbitable($("specimen"), e => { const best = pickPiece($("specimen"), e, hits); if (best) { selected = best.index; renderPiece(); } });
        orbitable($("builder"), e => {
            const best = pickPiece($("builder"), e, views.builderHits || []);
            if (best) { buildLoop.stop(); setBuildStep(best.i + 1); }
        });
        orbitable($("current-motion"));
        orbitable($("reference-motion"));

        controls.forEach(id => $(id).addEventListener("input", changeBody));
        $("shape").addEventListener("change", changeBody);
        $("resolution").addEventListener("change", changeBody);
        document.querySelectorAll("[data-tilt]").forEach(b => b.addEventListener("click", () => { $("tilt").value = b.dataset.tilt; changeBody({ target: $("tilt") }); }));
        document.querySelectorAll("[data-experiment]").forEach(b => b.addEventListener("click", () => experiment(b.dataset.experiment)));
        document.querySelectorAll("[data-experiment-link]").forEach(b => b.addEventListener("click", () => { experiment(b.dataset.experimentLink); $("explore").scrollIntoView({ behavior: UI.prefersReducedMotion() ? "auto" : "smooth" }); }));
        $("reset-body").addEventListener("click", resetBody);
        $("camera").addEventListener("change", redrawViews);
        $("reset-view").addEventListener("click", () => { camera.az = -0.45; camera.el = 0.72; $("camera").value = "perspective"; redrawViews(); });
        $("piece").addEventListener("input", () => { selected = Number($("piece").value) - 1; renderPiece(); });
        $("offcenter-d").addEventListener("input", () => setOffset(Number($("offcenter-d").value)));
        // Formula sheet: load that body and axis with the default sizes the formulas are checked against.
        document.querySelectorAll(".formula-load").forEach(button => button.addEventListener("click", () => {
            const { formulaShape, formulaTilt, formulaOffset, formulaHollow } = button.dataset;
            setExperiment(null);
            data = M.evaluate({ ...M.DEFAULTS, resolution: data.config.resolution, shape: formulaShape, tilt: formulaTilt ?? 0, offset: formulaOffset ?? 0, hollow: formulaHollow ?? M.DEFAULTS.hollow });
            selected = Math.floor(data.points.length * 0.75);
            resetMotion();
            renderBody();
            $("explore").scrollIntoView({ behavior: UI.prefersReducedMotion() ? "auto" : "smooth" });
        }));
        $("count-table").addEventListener("click", event => {
            const button = event.target.closest("[data-load-shape]");
            if (!button) return;
            $("shape").value = button.dataset.loadShape;
            changeBody({ target: $("shape") });
        });
        $("torque").addEventListener("input", () => resetMotion());
        $("motion-time").addEventListener("input", () => {
            motionLoop.stop(); motionState.running = false;
            motionState.time = Number($("motion-time").value);
            renderMotion();
            $("motion-status").textContent = `Looking at t = ${num(motionState.time, 2)} s. ${motionState.time > 0 && motionState.time < 2 ? "Resume to continue from here." : "Both bodies have had the same time."}`;
        });
        $("run-motion").addEventListener("click", startMotion);
        $("reset-motion").addEventListener("click", () => resetMotion());
        $("pause-motion").addEventListener("click", () => {
            if (motionState.running) {
                motionLoop.stop(); motionState.running = false;
                $("motion-status").textContent = `Paused at ${num(motionState.time, 2)} s.`;
            } else {
                if (UI.prefersReducedMotion()) { finishMotion(); return; }
                motionState.running = true; motionLoop.start(); $("motion-status").textContent = "Resumed.";
            }
            renderMotion();
        });
        $("pin-reference").addEventListener("click", () => {
            pinnedReference = M.evaluate(data.config);
            referenceMode = "pinned";
            resetMotion("Your body is now the reference. Change your body and race again.");
        });
        $("reference-mode").addEventListener("change", () => {
            referenceMode = $("reference-mode").value;
            resetMotion();
        });
        // The orbit view animates only while it is on screen.
        if ("IntersectionObserver" in window) {
            new IntersectionObserver(entries => {
                const visible = entries.some(e => e.isIntersecting);
                if (visible && !UI.prefersReducedMotion()) orbitLoop.start(); else orbitLoop.stop();
            }).observe($("orbit-canvas"));
        }
        UI.onThemeChange(() => { for (const view of Object.values(views)) if (view && view.redraw) view.redraw(); });
        renderPrimer();
        experiment("outward");
    }

    init();
})();
