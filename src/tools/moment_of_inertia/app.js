(function() {
    "use strict";
    const M = window.InertiaModel;
    const $ = id => document.getElementById(id);
    const controls = ["shape", "mass", "radius", "length", "width", "height", "hollow", "tilt", "offset", "resolution"];
    let data = M.evaluate(M.DEFAULTS);
    let reference = M.evaluate({ ...M.DEFAULTS, shape: "hoop" });
    let selected = Math.floor(data.points.length * 0.75);
    let included = data.points.length;
    let hits = [];
    let time = 0, running = false, frame = 0, lastFrame = 0;
    let sumFrame = 0, sumRunning = false, sumStart = null;
    let activeExperiment = null;
    let specimenSize = { w: 760, h: 430 };
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

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
    const chartWidth = svg => Math.max(280, Math.round(svg.clientWidth || 560));

    const integralSigns = { 1: "∫ single", 2: "∫∫ double", 3: "∫∫∫ triple" };

    function renderCountTable(current) {
        $("count-table").innerHTML = Object.keys(lessons).map(key => {
            const l = lessons[key], here = key === current;
            return `<tr${here ? ' class="current-shape" aria-current="true"' : ""}><th scope="row"><button type="button" data-load-shape="${key}" aria-pressed="${here}">${M.SHAPES[key].name}</button></th><td>${l.coords}</td><td>${l.dmForm}</td><td class="sign-cell">${integralSigns[l.dims]}</td><td>${l.shortcutText}</td></tr>`;
        }).join("");
        document.querySelectorAll(".dimension-cards [data-dims]").forEach(card => card.classList.toggle("current-shape", Number(card.dataset.dims) === lessons[current].dims));
    }

    function renderPrimer() {
        const r = Number($("primer-r").value), m = Number($("primer-m").value), inertia = m * r * r;
        const k = r / 0.5;
        $("primer-r-value").textContent = `${num(r, 2)} m`;
        $("primer-m-value").textContent = `${num(m, 1)} kg`;
        $("primer-r").setAttribute("aria-valuetext", `${num(r, 2)} meters`);
        $("primer-m").setAttribute("aria-valuetext", `${num(m, 1)} kilograms`);
        $("primer-I").textContent = `${num(m, 1)} × ${num(r, 2)}² = ${num(inertia)} kg·m²`;
        $("primer-insight").textContent = Math.abs(inertia - 0.25) < 1e-9
            ? "This is the starting ball: 1 kg at 0.50 m. Drag r to 1.00 m and watch the square: twice the distance, four times the area, four times the inertia."
            : `Compared with the starting ball (1 kg at 0.50 m): distance ×${num(k, 2)} makes r² ×${num(k * k, 2)}${m !== 1 ? `, and mass ×${num(m, 1)} multiplies that again` : ""}. So I is ×${num(inertia / 0.25, 2)}, and the same twist would speed up its spin ${num(inertia / 0.25, 2)}× ${inertia > 0.25 ? "more slowly" : "faster"}.`;
        const colors = getComputedStyle(document.body);
        const muted = colors.getPropertyValue("--lab-muted").trim(), accent = colors.getPropertyValue("--lab-accent").trim();
        const gold = colors.getPropertyValue("--lab-gold").trim(), coral = colors.getPropertyValue("--lab-coral").trim(), text = colors.getPropertyValue("--lab-text").trim();
        const cx = 168, cy = 168, px = 112, R = r * px, ball = 6 + 5 * Math.sqrt(m);
        const meterTop = 40, meterHeight = 236, meter = meterHeight * inertia / (4 * 1.44);
        const arc = (deg, radius) => `${(cx + radius * Math.cos(deg * Math.PI / 180)).toFixed(1)} ${(cy + radius * Math.sin(deg * Math.PI / 180)).toFixed(1)}`;
        $("primer-svg").innerHTML = `
            <defs><marker id="primer-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L10 5 L0 10z" fill="${muted}"/></marker></defs>
            <circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${muted}" stroke-dasharray="4 6" opacity=".7"/>
            <path d="M ${arc(150, R + 12)} A ${R + 12} ${R + 12} 0 0 1 ${arc(215, R + 12)}" fill="none" stroke="${muted}" stroke-width="1.5" marker-end="url(#primer-arrow)"/>
            <rect x="${cx}" y="${cy - R}" width="${R}" height="${R}" fill="${gold}" fill-opacity=".18" stroke="${gold}"/>
            <text x="${cx + R / 2}" y="${R > 70 ? cy - R / 2 + 4 : cy - R - 7}" text-anchor="middle" fill="${gold}" font-size="15" font-weight="700">r² = ${num(r * r, 2)}</text>
            <line x1="${cx}" y1="${cy}" x2="${cx + R}" y2="${cy}" stroke="${text}" stroke-width="3"/>
            <text x="${cx + R / 2}" y="${cy + Math.max(19, ball + 16)}" text-anchor="${R > 70 ? "middle" : "start"}" fill="${text}" font-size="14">r = ${num(r, 2)} m</text>
            <circle cx="${cx + R}" cy="${cy}" r="${ball}" fill="${accent}"/>
            <text x="${R > 70 ? cx + R : cx + R + ball + 5}" y="${R > 70 ? cy - ball - 6 : cy + 5}" text-anchor="${R > 70 ? "middle" : "start"}" fill="${accent}" font-size="14" font-weight="700" paint-order="stroke" stroke="${colors.getPropertyValue("--lab-soft").trim()}" stroke-width="4">${num(m, 1)} kg</text>
            <circle cx="${cx}" cy="${cy}" r="8" fill="none" stroke="${coral}" stroke-width="2"/><circle cx="${cx}" cy="${cy}" r="2.5" fill="${coral}"/>
            <circle cx="22" cy="22" r="7" fill="none" stroke="${coral}" stroke-width="2"/><circle cx="22" cy="22" r="2" fill="${coral}"/>
            <text x="36" y="27" fill="${coral}" font-size="14">axis, seen end-on</text>
            <rect x="352" y="${meterTop}" width="24" height="${meterHeight}" rx="4" fill="${muted}" opacity=".12"/>
            <rect x="352" y="${meterTop + meterHeight - meter}" width="24" height="${meter}" rx="4" fill="${accent}"/>
            <line x1="346" x2="382" y1="${meterTop + meterHeight - meterHeight * 0.25 / 5.76}" y2="${meterTop + meterHeight - meterHeight * 0.25 / 5.76}" stroke="${muted}" stroke-dasharray="3 3"/>
            <text x="364" y="28" text-anchor="middle" fill="${text}" font-size="15" font-weight="700">I</text>
            <text x="364" y="${meterTop + meterHeight + 20}" text-anchor="middle" fill="${muted}" font-size="14">${num(inertia, 2)}</text>`;
        $("primer-svg").setAttribute("aria-label", `A ${num(m, 1)} kilogram ball ${num(r, 2)} meters from the axis. The square of side r has area ${num(r * r, 2)} square meters. Moment of inertia ${num(inertia)} kilogram meters squared.`);
    }

    function renderOffcenter() {
        const c = data.config, centered = data.exact.centered, shift = data.exact.shift, total = data.exact.total;
        $("offcenter-d").value = c.offset;
        $("offcenter-d-value").textContent = `${num(c.offset, 2)} m`;
        $("offcenter-d").setAttribute("aria-valuetext", `${num(c.offset, 2)} meters`);
        $("offcenter-cm").textContent = `${num(centered)} kg·m²`;
        $("offcenter-shift").textContent = `${num(c.mass, 2)} × ${num(Math.abs(c.offset), 2)}² = ${num(shift)} kg·m²`;
        $("offcenter-total").textContent = `${num(total)} kg·m²`;
        $("offcenter-bar-cm").style.width = `${total > 0 ? 100 * centered / total : 0}%`;
        $("offcenter-bar-shift").style.width = `${total > 0 ? 100 * shift / total : 0}%`;
        $("offcenter-insight").textContent = c.offset === 0
            ? `The axis goes through the center of mass, so the center does not travel at all: I = I_CM = ${num(total)} kg·m². Drag d to move the axis.`
            : `The ${M.SHAPES[c.shape].name.toLowerCase()} is unchanged; only the axis moved. Its center now circles the axis at ${num(Math.abs(c.offset), 2)} m, which adds ${num(shift)} kg·m²: ${num(total > 0 ? 100 * shift / total : 0, 0)}% of the total I.${centered > 0 ? ` Spinning it is now ${num(total / centered, 2)}× harder than about its center.` : ""}`;
        const colors = getComputedStyle(document.body);
        const muted = colors.getPropertyValue("--lab-muted").trim(), accent = colors.getPropertyValue("--lab-accent").trim();
        const gold = colors.getPropertyValue("--lab-gold").trim(), text = colors.getPropertyValue("--lab-text").trim();
        const W = chartWidth($("offcenter-chart")), H = 260, left = 52, right = W - 14, top = 30, bottom = 210;
        const maxI = centered + c.mass * 4;
        const x = d => left + (d + 2) / 4 * (right - left), y = v => bottom - v / maxI * (bottom - top);
        const curve = Array.from({ length: 81 }, (_, i) => { const d = -2 + i / 20; return `${i ? "L" : "M"}${x(d).toFixed(1)} ${y(centered + c.mass * d * d).toFixed(1)}`; }).join(" ");
        let svg = "";
        for (let i = 0; i <= 4; i++) svg += `<line x1="${left}" x2="${right}" y1="${y(maxI * i / 4)}" y2="${y(maxI * i / 4)}" stroke="${muted}" opacity=".15"/><text x="${left - 8}" y="${y(maxI * i / 4) + 4}" text-anchor="end" fill="${muted}" font-size="11">${num(maxI * i / 4, 1)}</text>`;
        for (const d of [-2, -1, 0, 1, 2]) svg += `<text x="${x(d)}" y="${bottom + 18}" text-anchor="middle" fill="${muted}" font-size="11">${d}</text>`;
        svg += `<line x1="${left}" x2="${right}" y1="${y(centered)}" y2="${y(centered)}" stroke="${accent}" stroke-dasharray="5 5"/><text x="${c.offset > -1 ? left + 6 : right - 6}" y="${y(centered) - 6}" text-anchor="${c.offset > -1 ? "start" : "end"}" fill="${accent}" font-size="11">I_CM = ${num(centered, 2)}</text>`;
        svg += `<path d="${curve}" fill="none" stroke="${text}" stroke-width="2.5"/>`;
        if (c.offset !== 0) svg += `<line x1="${x(c.offset)}" x2="${x(c.offset)}" y1="${y(centered)}" y2="${y(total)}" stroke="${gold}" stroke-width="4"/><text x="${x(c.offset) + (c.offset > 0 ? -8 : 8)}" y="${(y(centered) + y(total)) / 2 + 4}" text-anchor="${c.offset > 0 ? "end" : "start"}" fill="${gold}" font-size="12" font-weight="700">M d²</text>`;
        svg += `<circle cx="${x(c.offset)}" cy="${y(total)}" r="6" fill="${accent}"/>`;
        $("offcenter-chart").setAttribute("viewBox", `0 0 ${W} ${H}`);
        $("offcenter-chart").innerHTML = svg + `<text x="${left}" y="16" fill="${muted}" font-size="12">Moment of inertia I (kg·m²)</text><text x="${(left + right) / 2}" y="${H - 6}" text-anchor="middle" fill="${muted}" font-size="11">Axis distance from the center d (m)</text>`;
        $("offcenter-chart").setAttribute("aria-label", `Moment of inertia against axis distance. Lowest value ${num(centered)} at d = 0. Current d ${num(c.offset, 2)} meters gives ${num(total)}.`);
    }

    function renderDistribution() {
        const bins = data.bins;
        const totalInertia = bins.reduce((sum, b) => sum + b.inertia, 0);
        const shares = bins.map(b => ({ mass: b.mass / data.config.mass, inertia: totalInertia > 0 ? b.inertia / totalInertia : 0 }));
        const max = Math.max(0.1, ...shares.flatMap(b => [b.mass, b.inertia]));
        const colors = getComputedStyle(document.body);
        const muted = colors.getPropertyValue("--lab-muted").trim() || getComputedStyle($("main-content")).color;
        const gold = colors.getPropertyValue("--lab-gold").trim();
        const W = chartWidth($("distribution-chart")), H = 260, left = 42, right = W - 8, base = 210;
        const slot = (right - left) / bins.length, bar = Math.min(18, slot * 0.4);
        const every = slot < 34 ? 2 : 1;
        let svg = "";
        for (let i = 0; i <= 4; i++) {
            const y = base - i * 42.5;
            svg += `<line x1="${left}" x2="${right}" y1="${y}" y2="${y}" stroke="${muted}" opacity=".15"/><text x="${left - 7}" y="${y + 4}" text-anchor="end" fill="${muted}" font-size="11">${Math.round(100 * max * i / 4)}%</text>`;
        }
        shares.forEach((b, i) => {
            const center = left + slot * (i + 0.5);
            svg += `<rect x="${center - bar - 1}" y="${base - 170 * b.mass / max}" width="${bar}" height="${170 * b.mass / max}" rx="2" fill="#2ab6a1"/><rect x="${center + 1}" y="${base - 170 * b.inertia / max}" width="${bar}" height="${170 * b.inertia / max}" rx="2" fill="${gold}"/>`;
            if (i % every === 0) svg += `<text x="${center}" y="231" text-anchor="middle" fill="${muted}" font-size="11">${num((bins[i].from + bins[i].to) / 2, 2)}</text>`;
        });
        $("distribution-chart").setAttribute("viewBox", `0 0 ${W} ${H}`);
        $("distribution-chart").innerHTML = svg + `<text x="${left}" y="20" fill="${muted}" font-size="11">Share of total (%)</text><text x="${(left + right) / 2}" y="254" text-anchor="middle" fill="${muted}" font-size="11">Distance from the axis r⊥ (m), band midpoint</text>`;
        $("distribution-table").innerHTML = bins.map((b, i) => `<tr><th scope="row">${num(b.from, 2)}–${num(b.to, 2)}</th><td>${num(100 * shares[i].mass, 1)}%</td><td>${num(100 * shares[i].inertia, 1)}%</td></tr>`).join("");
        const outer = shares.slice(5).reduce((a, b) => ({ mass: a.mass + b.mass, inertia: a.inertia + b.inertia }), { mass: 0, inertia: 0 });
        $("distribution-description").textContent = totalInertia === 0 ? "All the mass lies on the axis. Its contribution to inertia is zero." : `The outer half of this distance range holds ${num(100 * outer.mass, 1)}% of the mass but ${num(100 * outer.inertia, 1)}% of the inertia.`;
    }

    function renderIntegral() {
        included = Math.round(data.points.length * Number($("accumulate").value) / 100);
        const count = data.points.length, p = data.points[selected];
        $("accumulate-value").textContent = `${$("accumulate").value}%`;
        $("piece-count").textContent = `${included} / ${count} pieces included`;
        equation("sum-equation", tag("msubsup", mo("∑") + row(mi("i") + eq + mn("1")) + mn(String(included))) + sq(sub("r", "i")) + mi("Δ") + sub("m", "i") + eq + mn(data.cumulative[included]) + unit("kg·m²"), `Sum of ${included} mass elements is ${num(data.cumulative[included])} kilogram meters squared`);
        const error = data.exact.total > 0 ? 100 * (data.numerical - data.exact.total) / data.exact.total : 0;
        $("integration-error").textContent = `Full midpoint sum: ${num(data.numerical)} kg·m². Difference from exact: ${num(Math.abs(error), 2)}%${Math.abs(error) > 0.00001 ? (error < 0 ? " below" : " above") : ""}. ${data.config.shape === "sphere" ? "Sphere slice volumes are approximated and normalized to the chosen mass." : "Finite elements use midpoint positions; circular rings carry area weights."}`;
        $("numerical-value").textContent = `${num(data.numerical)} kg·m²`;
        $("exact-integral-value").textContent = `${num(data.exact.total)} kg·m²`;
        $("piece").max = count;
        $("piece").value = selected + 1;
        $("piece-value").textContent = `${selected + 1} / ${count}`;
        $("piece-mass").textContent = `${num(p.dm, 4)} kg`;
        $("piece-distance").textContent = `${num(Math.sqrt(p.r2))} m`;
        $("piece-inertia").textContent = `${num(p.contribution, 4)} kg·m²`;
        $("piece-position").textContent = `Sample point (x, y, z) = (${num(p.x, 2)}, ${num(p.y, 2)}, ${num(p.z, 2)}) m. ${selected < included ? "This piece is included in the sum." : "This piece is not yet included in the sum."}`;
        $("piece-explanation").textContent = `${num(p.dm, 4)} kg × (${num(Math.sqrt(p.r2))} m)² ≈ ${num(p.contribution, 4)} kg·m². This piece holds ${num(100 * p.dm / data.config.mass, 2)}% of the mass and contributes ${num(data.numerical > 0 ? 100 * p.contribution / data.numerical : 0, 2)}% of the full numerical inertia.`;
        $("piece").setAttribute("aria-valuetext", `Piece ${selected + 1} of ${count}, mass ${num(p.dm, 4)} kilograms, distance ${num(Math.sqrt(p.r2))} meters`);
        $("accumulate").setAttribute("aria-valuetext", `${included} of ${count} pieces, sum ${num(data.cumulative[included])} kilogram meters squared`);
        drawSpecimen();
    }

    function renderBody() {
        const c = data.config;
        controls.forEach(id => {
            $(id).value = c[id];
            const output = $(id + "-value");
            if (output) {
                const value = id === "hollow" ? `${Math.round(c.hollow * 100)}% · a = ${num(c.hollow * c.radius, 2)} m` : id === "tilt" ? `${c[id]}°` : `${num(c[id], 2)} ${id === "mass" ? "kg" : "m"}`;
                output.textContent = value;
                $(id).setAttribute("aria-valuetext", value);
            }
        });
        document.querySelectorAll("[data-dimension]").forEach(e => { e.hidden = !M.SHAPES[c.shape].dimensions.includes(e.dataset.dimension); });
        document.querySelectorAll("[data-tilt]").forEach(e => e.setAttribute("aria-pressed", String(Number(e.dataset.tilt) === c.tilt)));
        $("specimen-title").textContent = M.SHAPES[c.shape].name;
        $("inertia-value").textContent = num(data.exact.total);
        $("centered-value").textContent = num(data.exact.centered);
        $("shift-value").textContent = num(data.exact.shift);
        renderExplanation();
        $("scene-description").textContent = `Coral: fixed axis, tilted ${c.tilt}° from z, shifted ${num(c.offset, 2)} m. Warmer dots contribute more r⊥²Δm. White segment: selected piece’s perpendicular distance. The outline marks the body’s boundary.`;
        renderDerivation();
        renderDistribution();
        renderOffcenter();
        renderIntegral();
        renderMotion();
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

    function canvasContext(canvas, w, h) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
            canvas.width = w * dpr;
            canvas.height = h * dpr;
        }
        const ctx = canvas.getContext("2d");
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
        return ctx;
    }

    function scene(canvas, c, w, h, axisView = false, motion = false) {
        const ctx = canvasContext(canvas, w, h);
        const { n, u, point: a } = M.axis(c);
        const az = -0.45, el = 0.72;
        const right = axisView ? u : [Math.cos(az), -Math.sin(az), 0];
        const up = axisView ? [0, 1, 0] : [-Math.sin(az) * Math.sin(el), -Math.cos(az) * Math.sin(el), Math.cos(el)];
        // A fixed physical scale makes size changes visible. Only zoom out when
        // needed to contain an off-center axis; comparisons always share a scale.
        const extent = motion ? Math.max(1.4, bound(data.config) + Math.abs(data.config.offset), bound(reference.config) + Math.abs(reference.config.offset)) : Math.max(1.4, bound(c) + Math.abs(c.offset) * 0.65);
        const scale = motion ? Math.min(w * 0.39, h * 0.34) / extent : Math.min(w * 0.20, h * 0.28) / Math.max(1, extent / 2.85);
        canvas.dataset.scale = String(scale);
        const project = p => ({
            x: w / 2 + scale * ((p.x - a[0] * (motion ? 1 : 0.4)) * right[0] + p.y * right[1] + (p.z - a[2] * (motion ? 1 : 0.4)) * right[2]),
            y: h / 2 - scale * ((p.x - a[0] * (motion ? 1 : 0.4)) * up[0] + p.y * up[1] + (p.z - a[2] * (motion ? 1 : 0.4)) * up[2]),
            depth: -p.x * Math.sin(az) * Math.cos(el) - p.y * Math.cos(az) * Math.cos(el) - p.z * Math.sin(el)
        });
        const line = (points, color, width = 1, fill = null) => {
            ctx.beginPath();
            points.forEach((p, i) => { const q = project(p); if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); });
            if (fill) { ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); }
            ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
        };
        ctx.fillStyle = "#304753";
        for (let x = 22; x < w; x += 32) for (let y = 22; y < h; y += 32) ctx.fillRect(x, y, 1, 1);
        return { ctx, project, line, scale, n, a, w, h, axisView };
    }

    function outline(s, c, angle = 0, ghost = false) {
        const color = ghost ? "#57728155" : "#8ab4c4";
        const fill = ghost ? null : "#35647b20";
        const p = (x, y, z = 0) => M.rotate({ x, y, z }, c, angle);
        const circle = (radius, z = 0, plane = "xy") => Array.from({ length: 65 }, (_, i) => {
            const a = i * 2 * Math.PI / 64;
            return plane === "xz" ? p(radius * Math.cos(a), 0, radius * Math.sin(a)) : plane === "yz" ? p(0, radius * Math.cos(a), radius * Math.sin(a)) : p(radius * Math.cos(a), radius * Math.sin(a), z);
        });
        if (c.shape === "rod") s.line([p(-c.length / 2, 0), p(c.length / 2, 0)], color, 5);
        else if (c.shape === "plate") s.line([p(-c.length / 2, -c.width / 2), p(c.length / 2, -c.width / 2), p(c.length / 2, c.width / 2), p(-c.length / 2, c.width / 2), p(-c.length / 2, -c.width / 2)], color, 1.5, fill);
        else if (c.shape === "sphere") {
            // An orthographic sphere always projects to a circle; the great circles show its turning.
            const center = s.project(p(0, 0, 0));
            s.ctx.beginPath(); s.ctx.arc(center.x, center.y, c.radius * s.scale, 0, 2 * Math.PI);
            if (fill) { s.ctx.fillStyle = fill; s.ctx.fill(); }
            s.ctx.strokeStyle = color; s.ctx.lineWidth = 1.5; s.ctx.stroke();
            const faint = ghost ? color : "#8ab4c470";
            s.line(circle(c.radius), faint, 1);
            s.line(circle(c.radius, 0, "xz"), faint, 1);
            s.line(circle(c.radius, 0, "yz"), faint, 1);
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

    function drawAxis(s, c) {
        const { ctx, project, line, a, n, w, h } = s;
        const axisPoint = project({ x: a[0], y: 0, z: a[2] });
        const b = Math.max(bound(c), 0.4) * 1.65;
        if (!s.axisView) line([{ x: a[0] - b * n[0], y: 0, z: a[2] - b * n[2] }, { x: a[0] + b * n[0], y: 0, z: a[2] + b * n[2] }], "#ff8d7c", 2);
        ctx.strokeStyle = "#ff8d7c"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(axisPoint.x, axisPoint.y, 7, 0, 2 * Math.PI); ctx.stroke();
        ctx.fillStyle = "#ff8d7c"; ctx.beginPath(); ctx.arc(axisPoint.x, axisPoint.y, 2, 0, 2 * Math.PI); ctx.fill();
        if (c.offset !== 0) {
            ctx.setLineDash([4, 5]);
            line([{ x: 0, y: 0, z: 0 }, { x: a[0], y: 0, z: a[2] }], "#ff8d7c88", 1);
            ctx.setLineDash([]);
            const mid = project({ x: a[0] / 2, y: 0, z: a[2] / 2 });
            ctx.font = "11px monospace"; ctx.fillStyle = "#ffb1a5"; ctx.fillText(`d = ${num(Math.abs(c.offset), 2)}`, mid.x + 6, mid.y + 16);
        }
        ctx.font = "12px monospace"; ctx.fillStyle = "#ffb1a5";
        ctx.fillText(`axis: β ${c.tilt}°, d ${num(c.offset, 2)} m`, 14, 22);
        ctx.strokeStyle = "#728f9e"; ctx.lineWidth = 1;
        const scaleSize = Math.min(1, bound(c));
        const len = scaleSize * s.scale;
        ctx.beginPath(); ctx.moveTo(w - 22 - len, h - 20); ctx.lineTo(w - 22, h - 20); ctx.stroke();
        ctx.font = "11px monospace"; ctx.fillStyle = "#9ab2bf"; ctx.textAlign = "right";
        ctx.fillText(`${num(scaleSize, 1)} m`, w - 22, h - 29); ctx.textAlign = "left";
        if (!s.axisView) {
            const origin = project({ x: 0, y: 0, z: 0 });
            const axes = [["x", { x: b * 0.23, y: 0, z: 0 }], ["y", { x: 0, y: b * 0.23, z: 0 }], ["z", { x: 0, y: 0, z: b * 0.23 }]];
            for (const [label, end] of axes) {
                const q = project(end);
                ctx.beginPath(); ctx.moveTo(25, h - 37); ctx.lineTo(25 + q.x - origin.x, h - 37 + q.y - origin.y); ctx.stroke();
                ctx.fillText(label, 27 + q.x - origin.x, h - 38 + q.y - origin.y);
            }
        }
    }

    function drawSpecimen() {
        const w = Math.max(240, $("specimen").clientWidth), h = w < 480 ? 300 : 390;
        specimenSize = { w, h };
        $("specimen").style.height = `${h}px`;
        const s = scene($("specimen"), data.config, w, h, $("camera").value === "axis");
        outline(s, data.config);
        const max = Math.max(...data.points.map(p => p.contribution));
        const projected = data.points.map((p, index) => ({ ...s.project(p), p, index })).sort((a, b) => a.depth - b.depth);
        hits = projected;
        for (const q of projected) {
            const v = max > 0 ? q.p.contribution / max : 0;
            const color = [Math.round(58 + 197 * v), Math.round(204 - 10 * v), Math.round(186 - 95 * v)];
            s.ctx.fillStyle = q.index < included ? `rgba(${color.join(",")},.8)` : "#48647355";
            const r = Math.max(1.1, Math.min(6, 34 / Math.sqrt(data.points.length) + 2) * Math.min(1, w / 620));
            s.ctx.beginPath(); s.ctx.arc(q.x, q.y, r, 0, Math.PI * 2); s.ctx.fill();
        }
        drawAxis(s, data.config);
        const center = s.project({ x: 0, y: 0, z: 0 });
        s.ctx.strokeStyle = "#eaf5f6"; s.ctx.lineWidth = 1;
        s.ctx.beginPath(); s.ctx.moveTo(center.x - 4, center.y); s.ctx.lineTo(center.x + 4, center.y);
        s.ctx.moveTo(center.x, center.y - 4); s.ctx.lineTo(center.x, center.y + 4); s.ctx.stroke();
        s.ctx.font = "11px monospace"; s.ctx.fillStyle = "#c0d6df";
        s.ctx.fillText("CM", center.x + 10, center.y + 17);
        const p = data.points[selected], q = s.project(p);
        const along = p.x * s.n[0] + p.z * s.n[2];
        const foot = { x: s.a[0] + along * s.n[0], y: 0, z: s.a[2] + along * s.n[2] };
        s.line([p, foot], "#ffffff", 2);
        s.ctx.strokeStyle = "#fff"; s.ctx.lineWidth = 2; s.ctx.beginPath(); s.ctx.arc(q.x, q.y, 9, 0, Math.PI * 2); s.ctx.stroke();
        const f = s.project(foot);
        s.ctx.font = "13px monospace"; s.ctx.fillStyle = "#fff";
        const label = `r⊥ = ${num(Math.sqrt(p.r2), 2)} m`;
        const labelWidth = s.ctx.measureText(label).width;
        const labelX = Math.max(15, Math.min(w - labelWidth - 12, (q.x + f.x) / 2 + 9));
        const labelY = Math.max(42, Math.min(h - 30, (q.y + f.y) / 2 - 13));
        s.ctx.fillStyle = "#101e2aee"; s.ctx.fillRect(labelX - 5, labelY - 15, labelWidth + 10, 22);
        s.ctx.fillStyle = "#fff"; s.ctx.fillText(label, labelX, labelY);
        $("specimen").setAttribute("aria-label", `${M.SHAPES[data.config.shape].name}, ${data.config.mass} kilograms. ${$("scene-description").textContent} Selected piece distance ${num(Math.sqrt(p.r2))} meters.`);
    }

    function bodyName(d) {
        const c = d.config;
        const dimensions = M.SHAPES[c.shape].dimensions.filter(k => k !== "hollow").map(k => `${({ radius: "R", length: "L", width: "W", height: "H" })[k]} ${num(c[k], 2)} m`).join(" · ");
        return `${M.SHAPES[c.shape].name} · ${num(c.mass, 1)} kg · ${dimensions}${c.shape === "annulus" ? ` · a ${num(c.hollow * c.radius, 2)} m` : ""} · β ${c.tilt}° · d ${num(c.offset, 2)} m`;
    }

    function drawMotion(canvas, d, angle) {
        // Draw at the displayed size so labels stay legible on phones. Both
        // canvases share a width, so they also share a physical scale.
        const w = Math.max(260, Math.round(canvas.clientWidth || 520));
        const h = Math.round(w * (w < 440 ? 0.7 : 280 / 520));
        canvas.style.aspectRatio = `${w} / ${h}`;
        const s = scene(canvas, d.config, w, h, false, true);
        outline(s, d.config, 0, true);
        outline(s, d.config, angle);
        drawAxis(s, d.config);
        const c = d.config;
        if (c.offset !== 0) {
            // Off-center: the center of mass itself travels around the axis.
            const origin = { x: 0, y: 0, z: 0 };
            s.ctx.setLineDash([3, 5]);
            s.line(Array.from({ length: 65 }, (_, i) => M.rotate(origin, c, i * Math.PI / 32)), "#c0d6df99", 1.5);
            s.ctx.setLineDash([]);
            const cm = s.project(M.rotate(origin, c, angle));
            s.ctx.strokeStyle = "#eaf5f6"; s.ctx.lineWidth = 1.5;
            s.ctx.beginPath(); s.ctx.moveTo(cm.x - 5, cm.y); s.ctx.lineTo(cm.x + 5, cm.y); s.ctx.moveTo(cm.x, cm.y - 5); s.ctx.lineTo(cm.x, cm.y + 5); s.ctx.stroke();
            s.ctx.font = "11px monospace"; s.ctx.fillStyle = "#c0d6df"; s.ctx.fillText("CM", cm.x + 7, cm.y - 7);
        }
        // Track the point farthest from the axis: it has the longest, most visible path.
        const { x, y, z } = M.farthestPoint(c), p = { x, y, z };
        const marker = M.rotate(p, c, angle), q = s.project(marker);
        if (angle > 0) {
            const trail = Array.from({ length: 50 }, (_, i) => M.rotate(p, c, angle * Math.max(0, 1 - 2 * Math.PI / angle) + Math.min(angle, 2 * Math.PI) * i / 49));
            s.line(trail, "#ffd38355", 2);
        }
        const along = p.x * s.n[0] + p.z * s.n[2];
        s.line([{ x: s.a[0] + along * s.n[0], y: 0, z: s.a[2] + along * s.n[2] }, marker], "#ffd383", 2);
        s.ctx.fillStyle = "#ffd383"; s.ctx.beginPath(); s.ctx.arc(q.x, q.y, 5, 0, 2 * Math.PI); s.ctx.fill();
        s.ctx.font = "12px monospace"; s.ctx.fillStyle = "#c1d5df"; s.ctx.fillText(`t = ${num(time, 2)} s`, 14, 44);
    }

    function renderMotion() {
        const torque = Number($("torque").value);
        $("torque-value").textContent = `${num(torque, 2)} N·m`;
        $("torque").setAttribute("aria-valuetext", `${num(torque, 2)} newton meters`);
        for (const [prefix, d] of [["current", data], ["reference", reference]]) {
            const motion = M.motion(d.exact.total, torque, time);
            $(prefix + "-name").textContent = bodyName(d);
            $(prefix + "-I").textContent = num(d.exact.total);
            for (const key of ["alpha", "omega", "angle"]) $(prefix + "-" + key).textContent = motion ? num(motion[key]) : "undefined";
            drawMotion($(prefix + "-motion"), d, motion ? motion.angle : 0);
        }
        $("run-motion").disabled = !M.motion(data.exact.total, torque, 0) || !M.motion(reference.exact.total, torque, 0);
        $("pause-motion").disabled = $("run-motion").disabled || time === 0 || time >= 2;
        $("pause-motion").textContent = running || time === 0 || time >= 2 ? "Pause" : "Resume";
        $("motion-time").value = time;
        $("motion-time-value").textContent = `${num(time, 2)} / 2.00 s`;
        $("motion-time").setAttribute("aria-valuetext", `${num(time, 2)} seconds of 2 seconds`);
        renderComparison(torque);
        drawMotionChart(torque);
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
        const current = M.motion(a, torque, time);
        $("motion-equation").textContent = current
            ? `At t = ${num(time, 2)} s, your body has ω = αt = ${num(current.alpha)} × ${num(time, 2)} = ${num(current.omega)} rad/s. Its angle is θ = ½αt² = ${num(current.angle)} rad (${num(current.angle / (2 * Math.PI), 2)} turns).`
            : "The speed graph is undefined for a zero-inertia body. Choose an axis with mass away from it.";
    }

    function drawMotionChart(torque) {
        const current = M.motion(data.exact.total, torque, 2), ref = M.motion(reference.exact.total, torque, 2);
        const colors = getComputedStyle(document.body), muted = colors.getPropertyValue("--lab-muted").trim();
        const ink = colors.getPropertyValue("--lab-accent").trim();
        const coral = colors.getPropertyValue("--lab-coral").trim();
        const W = chartWidth($("motion-chart")), left = 52, right = W - 18, perSecond = (right - left) / 2;
        const tx = t => left + t * perSecond;
        const max = Math.max(current ? current.omega : 0, ref ? ref.omega : 0, 0.1) * 1.15;
        const y = value => 184 - value / max * 145;
        let svg = "";
        for (let i = 0; i <= 4; i++) {
            const py = y(max * i / 4);
            svg += `<line x1="${left}" y1="${py}" x2="${right}" y2="${py}" stroke="${muted}" opacity=".16"/><text x="${left - 8}" y="${py + 4}" text-anchor="end" fill="${muted}" font-size="11">${num(max * i / 4, 1)}</text>`;
        }
        for (const [m, color, dash] of [[current, ink, ""], [ref, coral, "7 5"]]) {
            if (!m) continue;
            svg += `<path d="M${left} 184 L${right} ${y(m.omega)}" fill="none" stroke="${color}" stroke-width="3" stroke-dasharray="${dash}"/><circle cx="${tx(time)}" cy="${y(m.alpha * time)}" r="5" fill="${color}"/>`;
        }
        svg += `<line x1="${tx(time)}" x2="${tx(time)}" y1="30" y2="184" stroke="${muted}" stroke-dasharray="3 5"/>`;
        for (const t of [0, 0.5, 1, 1.5, 2]) svg += `<text x="${tx(t)}" y="204" text-anchor="middle" fill="${muted}" font-size="11">${t}</text>`;
        $("motion-chart").setAttribute("viewBox", `0 0 ${W} 230`);
        $("motion-chart").innerHTML = svg + `<text x="${left}" y="18" fill="${muted}" font-size="12">Angular speed ω (rad/s)</text><text x="${(left + right) / 2}" y="226" text-anchor="middle" fill="${muted}" font-size="11">Elapsed time (s)</text>`;
        $("motion-chart").setAttribute("aria-label", `Angular speed versus time. At ${num(time, 2)} seconds: your body ${current ? num(current.alpha * time) : "undefined"} rad/s, reference ${ref ? num(ref.alpha * time) : "undefined"} rad/s. Dashed line is the reference.`);
    }

    function resetMotion(message = "Ready. Both bodies start at rest.") {
        cancelAnimationFrame(frame); running = false; time = 0; lastFrame = 0;
        $("motion-status").textContent = message;
        renderMotion();
    }

    function finishMotion() {
        time = 2; running = false;
        renderMotion();
        const torque = Number($("torque").value);
        const current = M.motion(data.exact.total, torque, time), ref = M.motion(reference.exact.total, torque, time);
        $("motion-status").textContent = `After 2.00 s at ${num(torque, 2)} N·m: your body rotates ${num(current.angle)} rad at ${num(current.omega)} rad/s; the reference rotates ${num(ref.angle)} rad at ${num(ref.omega)} rad/s.${reducedMotion.matches ? " Reduced motion: showing the final state without animation." : ""}`;
    }

    function animate(timestamp) {
        if (!running) return;
        if (lastFrame) time = Math.min(2, time + Math.max(0, (timestamp - lastFrame) / 1000));
        lastFrame = timestamp;
        if (time >= 2) { finishMotion(); return; }
        renderMotion();
        frame = requestAnimationFrame(animate);
    }

    function startMotion() {
        if ($("run-motion").disabled) return;
        resetMotion("Equal torque applied. Both bodies accelerate from rest.");
        if (reducedMotion.matches) { finishMotion(); return; }
        running = true; renderMotion(); frame = requestAnimationFrame(animate);
    }

    function stopSum() {
        cancelAnimationFrame(sumFrame); sumRunning = false; sumStart = null;
        $("animate-sum").textContent = "▶ Build the sum";
        $("animate-sum").setAttribute("aria-pressed", "false");
    }

    function animateSum(timestamp) {
        if (!sumRunning) return;
        if (sumStart === null) sumStart = timestamp;
        const progress = Math.min(100, Math.round((timestamp - sumStart) / 35));
        $("accumulate").value = progress;
        selected = Math.max(0, Math.round(data.points.length * progress / 100) - 1);
        renderIntegral();
        if (progress >= 100) stopSum();
        else sumFrame = requestAnimationFrame(animateSum);
    }

    function changeBody(event) {
        stopSum();
        const c = Object.fromEntries(controls.map(id => [id, $(id).value]));
        const change = event && event.target.id;
        const before = data;
        data = M.evaluate(c);
        selected = Math.min(selected, data.points.length - 1);
        if (change !== "resolution") resetMotion();
        // Following an experiment's instructions keeps it active; switching shape leaves it.
        if (change === "shape") setExperiment(null);
        renderBody();
        renderExplanation(change, before);
        if ($("run-motion").disabled) $("motion-status").textContent = "This idealized axis has I = 0, so α = τ/I has no finite value. Change the axis or shape to run the comparison.";
    }

    const experiments = {
        outward: { current: { shape: "disk" }, reference: { shape: "hoop" }, note: "A disk and a hoop each have 2 kg of mass and a 1 m radius. Predict which gains spin faster, then apply equal torque. Look at where each body stores its mass." },
        redistribute: { current: { shape: "annulus", hollow: 0 }, reference: { shape: "disk" }, note: "Drag “Move mass toward the rim” from disk to hoop. Keep the same 2 kg and 1 m outer radius. Does shifting mass outward make the body easier or harder to accelerate?" },
        shift: { current: { shape: "rod", offset: 1 }, reference: { shape: "rod" }, note: "Same 2 m rod: move the axis from its center to its end. I becomes four times larger. The offset adds M(L/2)²; neither the body nor its mass changed." },
        tilt: { current: { shape: "disk", tilt: 90 }, reference: { shape: "disk" }, note: "Same disk, same center: turn the axis from the face normal (z) to a diameter (x). The moment halves because the perpendicular distances change." },
        sphere: { current: { shape: "sphere", tilt: 90 }, reference: { shape: "sphere" }, note: "A solid sphere has equal centered moments in every direction. Tilt the axis and the response stays the same. Shift it to break that equality." }
    };

    function setExperiment(key) {
        activeExperiment = key;
        $("experiment-note").textContent = key ? experiments[key].note : "Your own experiment. Change one variable at a time, and pin a reference to compare before and after.";
        document.querySelectorAll("[data-experiment]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.experiment === key)));
    }

    function experiment(key) {
        stopSum();
        const e = experiments[key];
        data = M.evaluate({ ...M.DEFAULTS, ...e.current });
        reference = M.evaluate({ ...M.DEFAULTS, ...e.reference });
        selected = Math.floor(data.points.length * 0.75);
        $("accumulate").value = 100;
        $("torque").value = 1;
        setExperiment(key);
        resetMotion(); renderBody();
    }

    function resetBody() {
        if (activeExperiment) { experiment(activeExperiment); return; }
        stopSum();
        data = M.evaluate({ ...M.DEFAULTS, resolution: data.config.resolution });
        selected = Math.floor(data.points.length * 0.75);
        resetMotion(); renderBody();
    }

    controls.forEach(id => $(id).addEventListener("input", changeBody));
    document.querySelectorAll("[data-tilt]").forEach(b => b.addEventListener("click", () => { $("tilt").value = b.dataset.tilt; changeBody({ target: $("tilt") }); }));
    document.querySelectorAll("[data-experiment]").forEach(b => b.addEventListener("click", () => experiment(b.dataset.experiment)));
    $("reset-body").addEventListener("click", resetBody);
    $("camera").addEventListener("change", drawSpecimen);
    ["primer-r", "primer-m"].forEach(id => $(id).addEventListener("input", renderPrimer));
    $("offcenter-d").addEventListener("input", () => { $("offset").value = $("offcenter-d").value; changeBody({ target: $("offset") }); });
    $("count-table").addEventListener("click", event => {
        const button = event.target.closest("[data-load-shape]");
        if (!button) return;
        $("shape").value = button.dataset.loadShape;
        changeBody({ target: $("shape") });
        $("specimen").scrollIntoView({ behavior: reducedMotion.matches ? "auto" : "smooth", block: "center" });
    });
    document.querySelectorAll("[data-experiment-link]").forEach(b => b.addEventListener("click", () => {
        experiment(b.dataset.experimentLink);
        $("explore").scrollIntoView({ behavior: reducedMotion.matches ? "auto" : "smooth" });
    }));
    $("accumulate").addEventListener("input", () => { stopSum(); renderIntegral(); });
    $("animate-sum").addEventListener("click", () => {
        if (sumRunning) { stopSum(); return; }
        if (reducedMotion.matches) {
            $("accumulate").value = 100; renderIntegral();
            $("animate-sum").textContent = "Sum complete · reduced motion";
            return;
        }
        $("accumulate").value = 0; renderIntegral();
        sumRunning = true; sumStart = null;
        $("animate-sum").textContent = "Pause sum";
        $("animate-sum").setAttribute("aria-pressed", "true");
        sumFrame = requestAnimationFrame(animateSum);
    });
    $("piece").addEventListener("input", () => { selected = Number($("piece").value) - 1; renderIntegral(); });
    $("specimen").addEventListener("click", event => {
        const rect = $("specimen").getBoundingClientRect();
        const x = (event.clientX - rect.left) * specimenSize.w / rect.width, y = (event.clientY - rect.top) * specimenSize.h / rect.height;
        let best = null, distance = 22;
        for (const p of hits) { const d = Math.hypot(x - p.x, y - p.y); if (d < distance) { best = p; distance = d; } }
        if (best) { selected = best.index; renderIntegral(); }
    });
    $("torque").addEventListener("input", () => resetMotion());
    $("motion-time").addEventListener("input", () => {
        cancelAnimationFrame(frame); running = false; lastFrame = 0;
        time = Number($("motion-time").value);
        renderMotion();
        $("motion-status").textContent = `Inspecting t = ${num(time, 2)} s. ${time > 0 && time < 2 ? "Resume to continue from here." : "Both bodies have the same elapsed time."}`;
    });
    $("run-motion").addEventListener("click", startMotion);
    $("reset-motion").addEventListener("click", () => resetMotion());
    $("pause-motion").addEventListener("click", () => {
        if (running) {
            cancelAnimationFrame(frame); running = false; lastFrame = 0;
            $("motion-status").textContent = `Paused at ${num(time, 2)} s.`;
        } else {
            if (reducedMotion.matches) { finishMotion(); return; }
            running = true; lastFrame = 0; frame = requestAnimationFrame(animate); $("motion-status").textContent = "Resumed equal-torque motion.";
        }
        renderMotion();
    });
    $("pin-reference").addEventListener("click", () => {
        reference = M.evaluate(data.config);
        resetMotion("Current body and axis pinned as the reference. Change your body to compare."); renderBody();
    });
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) stopSum();
        if (document.hidden && running) { cancelAnimationFrame(frame); running = false; lastFrame = 0; $("motion-status").textContent = `Paused at ${num(time, 2)} s while the page is hidden.`; renderMotion(); }
    });
    reducedMotion.addEventListener("change", () => {
        if (reducedMotion.matches) {
            stopSum();
            if (running) { cancelAnimationFrame(frame); finishMotion(); }
        }
    });
    new MutationObserver(() => { renderDistribution(); renderOffcenter(); renderPrimer(); drawMotionChart(Number($("torque").value)); }).observe(document.body, { attributes: true, attributeFilter: ["class"] });
    window.addEventListener("resize", () => { drawSpecimen(); renderMotion(); renderDistribution(); renderOffcenter(); });
    renderPrimer();
    experiment("outward");
})();
