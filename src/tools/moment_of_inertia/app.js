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
    const integral = (lo, hi) => tag("msubsup", mo("∫") + row(lo) + row(hi));
    const I = sub("I", "CM"), Iz = sub("I", "z"), Ix = sub("I", "x");
    const R2 = sq(mi("R")), L2 = sq(mi("L")), W2 = sq(mi("W")), H2 = sq(mi("H"));

    function equation(id, markup, label) {
        $(id).innerHTML = `<math display="block" aria-label="${label}">${markup}</math>`;
    }

    const lessons = {
        rod: {
            coordinate: "The ideal thin rod lies along x. The z axis crosses its midpoint; the x axis lies along its length.",
            body: "Uniform linear density. Rod thickness is neglected.",
            density: frac(mi("M"), mi("L")), symbol: "λ", title: "Linear density",
            dm: "A short segment dx has mass dm = λ dx. Equal-length segments have equal mass.",
            integral: integral(mo("−") + frac(mi("L"), mn("2")), frac(mi("L"), mn("2"))) + sq(mi("x")) + frac(mi("M"), mi("L")) + mi("d") + mi("x") + eq + frac(mi("M") + L2, mn("12")),
            label: "Integral from minus L over 2 to L over 2 of x squared M over L dx equals M L squared over 12",
            note: "Each segment is weighted by x². About its own line an ideal zero-thickness rod has Ix = 0."
        },
        disk: {
            coordinate: "The thin disk lies in the xy plane. The z axis is normal to its face; the x axis runs along a diameter.",
            body: "Uniform surface density. Disk thickness is neglected.",
            density: frac(mi("M"), mi("π") + R2), symbol: "σ", title: "Surface density",
            dm: "A ring of radius r and width dr has area 2πr dr, so dm = σ 2πr dr.",
            integral: integral(mn("0"), mi("R")) + sq(mi("r")) + mi("σ") + mn("2") + mi("π") + mi("r") + mi("d") + mi("r") + eq + frac(mi("M") + R2, mn("2")),
            label: "Integral from zero to R of r squared sigma 2 pi r dr equals M R squared over 2",
            note: "Outer rings contain more mass and sit farther from the axis. About a diameter, Ix = MR²/4."
        },
        annulus: {
            coordinate: "The adjustable ring lies in xy. Its inner radius is a and its outer radius is R. Mass stays fixed as the hole grows.",
            body: "Uniform surface density in the remaining ring. Mass is redistributed, not removed.",
            density: frac(mi("M"), mi("π") + row(mo("(") + R2 + mo("−") + sq(mi("a")) + mo(")"))), symbol: "σ", title: "Surface density",
            dm: "Between a and R, a thin circular strip carries dm = σ 2πr dr. Growing the hole increases the remaining material’s density.",
            integral: integral(mi("a"), mi("R")) + sq(mi("r")) + mi("σ") + mn("2") + mi("π") + mi("r") + mi("d") + mi("r") + eq + frac(mi("M") + row(mo("(") + R2 + plus + sq(mi("a")) + mo(")")), mn("2")),
            label: "Integral from a to R of r squared sigma 2 pi r dr equals M times R squared plus a squared over 2",
            note: "At a = 0 this is a disk. As a approaches R, the mass moves to the rim and I approaches MR², the thin-hoop limit."
        },
        hoop: {
            coordinate: "The thin hoop lies in the xy plane. The z axis is normal to its plane; the x axis runs along a diameter.",
            body: "Uniform linear density. Hoop thickness is neglected.",
            density: frac(mi("M"), mn("2") + mi("π") + mi("R")), symbol: "λ", title: "Linear density",
            dm: "An arc R dφ has mass dm = λ R dφ = M dφ/(2π). All mass lies at radius R.",
            integral: integral(mn("0"), mn("2") + mi("π")) + R2 + frac(mi("M"), mn("2") + mi("π")) + mi("d") + mi("φ") + eq + mi("M") + R2,
            label: "Integral from zero to 2 pi of R squared M over 2 pi d phi equals M R squared",
            note: "Every piece has the same distance R from z. About a diameter, Ix = MR²/2."
        },
        plate: {
            coordinate: "The plate lies in the xy plane, with length L along x and width W along y. The z axis is normal to its face.",
            body: "Uniform surface density. Plate thickness is neglected.",
            density: frac(mi("M"), mi("L") + mi("W")), symbol: "σ", title: "Surface density",
            dm: "A small rectangle dx dy has mass dm = σ dx dy. Squared distance to z is x² + y².",
            integral: integral(mo("−") + frac(mi("L"), mn("2")), frac(mi("L"), mn("2"))) + integral(mo("−") + frac(mi("W"), mn("2")), frac(mi("W"), mn("2"))) + row(mo("(") + sq(mi("x")) + plus + sq(mi("y")) + mo(")")) + mi("σ") + mi("d") + mi("y") + mi("d") + mi("x") + eq + frac(mi("M") + row(mo("(") + L2 + plus + W2 + mo(")")), mn("12")),
            label: "Double integral of x squared plus y squared sigma dy dx over the plate equals M times L squared plus W squared over 12",
            note: "Both dimensions matter about z. About x, only width matters: Ix = MW²/12."
        },
        cylinder: {
            coordinate: "The solid cylinder’s length H runs along z. The x axis is a transverse axis through the center.",
            body: "Uniform volume density. This is a solid cylinder, not a hollow shell.",
            density: frac(mi("M"), mi("π") + R2 + mi("H")), symbol: "ρ", title: "Volume density",
            dm: "In cylindrical coordinates, a small volume has mass dm = ρ r dr dφ dz.",
            integral: integral(mo("−") + frac(mi("H"), mn("2")), frac(mi("H"), mn("2"))) + integral(mn("0"), mn("2") + mi("π")) + integral(mn("0"), mi("R")) + sq(mi("r")) + mi("ρ") + mi("r") + mi("d") + mi("r") + mi("d") + mi("φ") + mi("d") + mi("z") + eq + frac(mi("M") + R2, mn("2")),
            label: "Volume integral of r squared rho r dr d phi dz equals M R squared over 2",
            note: "Height does not affect Iz at fixed mass. It does affect the transverse moment: Ix = M(3R² + H²)/12."
        },
        sphere: {
            coordinate: "This is a solid sphere centered at the origin. Every axis through its center has the same moment of inertia.",
            body: "Uniform volume density. Dots fill the interior; this is not a spherical shell.",
            density: frac(mn("3") + mi("M"), mn("4") + mi("π") + tag("msup", mi("R") + mn("3"))), symbol: "ρ", title: "Volume density",
            dm: "In spherical coordinates, dm = ρ r² sin ϑ dr dϑ dφ. Distance to z is r sin ϑ.",
            integral: integral(mn("0"), mi("R")) + integral(mn("0"), mi("π")) + integral(mn("0"), mn("2") + mi("π")) + sq(mo("(") + mi("r") + mi("sin") + mi("ϑ") + mo(")")) + mi("ρ") + sq(mi("r")) + mi("sin") + mi("ϑ") + mi("d") + mi("φ") + mi("d") + mi("ϑ") + mi("d") + mi("r") + eq + frac(mn("2") + mi("M") + R2, mn("5")),
            label: "Volume integral of r sin theta squared rho r squared sin theta d phi d theta dr equals 2 M R squared over 5",
            note: "Spherical symmetry gives Ix = Iy = Iz = 2MR²/5. Tilting a centered axis changes nothing."
        }
    };

    function renderDerivation() {
        const c = data.config, lesson = lessons[c.shape === "annulus" && c.hollow === 1 ? "hoop" : c.shape];
        $("body-note").textContent = lesson.body;
        $("coordinate-note").textContent = lesson.coordinate;
        $("density-title").textContent = lesson.title;
        $("density-note").textContent = lesson.dm;
        equation("density-equation", mi(lesson.symbol) + eq + lesson.density + eq + mn(data.density.value) + text(" " + data.density.unit), `${lesson.title} ${num(data.density.value)} ${data.density.unit}`);
        equation("integral-equation", Iz + eq + lesson.integral, lesson.label);
        $("integral-note").textContent = lesson.note;
        equation("tilt-equation", I + eq + Ix + sq(mi("sin")) + mi("β") + plus + Iz + sq(mi("cos")) + mi("β") + eq + mn(data.exact.centered), `Centered moment equals Ix sin squared beta plus Iz cos squared beta, ${num(data.exact.centered)} kilogram meters squared`);
        $("tilt-note").textContent = `β = ${c.tilt}°. Ix = ${num(data.exact.principal.x)} and Iz = ${num(data.exact.principal.z)} kg·m². These are axes through the same center of mass.`;
        equation("shift-equation", mi("I") + eq + I + plus + mi("M") + sq(mi("d")) + eq + mn(data.exact.centered) + plus + mn(c.mass) + times + sq(mo("(") + mn(c.offset) + mo(")")) + eq + mn(data.exact.total), `I equals centered moment plus M d squared, ${num(data.exact.total)} kilogram meters squared`);
        $("shift-note").textContent = `The axis moves ${num(Math.abs(c.offset), 2)} m perpendicular to itself. The added ${num(data.exact.shift)} kg·m² is the same for +d and −d.`;
        equation("distance-equation", sq(sub("r", "⊥")) + eq + sq(row(mo("(") + mi("x") + mi("cos") + mi("β") + mo("−") + mi("z") + mi("sin") + mi("β") + mo("−") + mi("d") + mo(")"))) + plus + sq(mi("y")), "Perpendicular distance squared equals x cos beta minus z sin beta minus d, squared, plus y squared");
    }

    function renderDistribution() {
        const bins = data.bins;
        const shares = bins.map(b => ({ mass: b.mass / data.config.mass, inertia: data.numerical > 0 ? b.inertia / data.numerical : 0 }));
        const max = Math.max(0.1, ...shares.flatMap(b => [b.mass, b.inertia]));
        const style = getComputedStyle($("main-content"));
        const color = getComputedStyle(document.body);
        const muted = color.getPropertyValue("--lab-muted").trim() || style.color;
        const gold = color.getPropertyValue("--lab-gold").trim();
        let svg = "";
        for (let i = 0; i <= 4; i++) {
            const y = 210 - i * 42.5;
            svg += `<line x1="42" x2="548" y1="${y}" y2="${y}" stroke="${muted}" opacity=".15"/><text x="35" y="${y + 4}" text-anchor="end" fill="${muted}" font-size="11">${Math.round(100 * max * i / 4)}%</text>`;
        }
        shares.forEach((b, i) => {
            const x = 50 + i * 49.4;
            svg += `<rect x="${x}" y="${210 - 170 * b.mass / max}" width="18" height="${170 * b.mass / max}" rx="2" fill="#2ab6a1"/><rect x="${x + 20}" y="${210 - 170 * b.inertia / max}" width="18" height="${170 * b.inertia / max}" rx="2" fill="${gold}"/><text x="${x + 19}" y="231" text-anchor="middle" fill="${muted}" font-size="10">${num((bins[i].from + bins[i].to) / 2, 2)}</text>`;
        });
        $("distribution-chart").innerHTML = svg + `<text x="42" y="20" fill="${muted}" font-size="11">Share of total (%)</text><text x="295" y="254" text-anchor="middle" fill="${muted}" font-size="11">Perpendicular distance r⊥ (m), band midpoint</text>`;
        $("distribution-table").innerHTML = bins.map((b, i) => `<tr><th scope="row">${num(b.from, 2)}–${num(b.to, 2)}</th><td>${num(100 * shares[i].mass, 1)}%</td><td>${num(100 * shares[i].inertia, 1)}%</td></tr>`).join("");
        const outer = shares.slice(5).reduce((a, b) => ({ mass: a.mass + b.mass, inertia: a.inertia + b.inertia }), { mass: 0, inertia: 0 });
        $("distribution-description").textContent = data.numerical === 0 ? "All pieces lie on the axis. Their contribution to inertia is zero." : `The farther half of this distance range holds ${num(100 * outer.mass, 1)}% of the mass but ${num(100 * outer.inertia, 1)}% of the sampled inertia.`;
    }

    function renderIntegral() {
        included = Math.round(data.points.length * Number($("accumulate").value) / 100);
        const count = data.points.length, p = data.points[selected];
        $("accumulate-value").textContent = `${$("accumulate").value}%`;
        $("piece-count").textContent = `${included} / ${count} pieces included`;
        equation("sum-equation", tag("msubsup", mo("∑") + row(mi("i") + eq + mn("1")) + mn(String(included))) + sq(sub("r", "i")) + mi("Δ") + sub("m", "i") + eq + mn(data.cumulative[included]) + text(" kg·m²"), `Sum of ${included} mass elements is ${num(data.cumulative[included])} kilogram meters squared`);
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
        renderIntegral();
        renderMotion();
    }

    function renderExplanation(change) {
        const c = data.config;
        const k = Math.sqrt(data.exact.total / c.mass);
        const explanations = {
            mass: "More mass, more resistance to changing spin. With the shape and axis fixed, doubling mass doubles I and halves acceleration under the same torque.",
            radius: "Moving material farther from the axis increases its contribution through distance squared. For a centered disk, hoop or sphere, doubling radius at fixed mass makes I four times larger.",
            length: "Length changes where the material sits. Only distance perpendicular to the rotation axis counts; stretching material along the axis does not increase I.",
            width: "A wider plate spreads mass farther from the x and z axes. Total mass is held fixed while its distribution changes.",
            height: "Height matters for a tilted cylinder, but not for its own central z axis: along that axis, making it taller does not change any perpendicular distance.",
            hollow: `The inner radius is ${num(c.hollow * c.radius, 2)} m. The same ${num(c.mass, 2)} kg occupies a narrower ring. About z, I is ${num(1 + c.hollow ** 2, 2)} times the solid disk’s value with the same mass and outer radius.`,
            tilt: "Tilting the axis changes the perpendicular distances, even though the body itself is unchanged. For a disk, a diameter gives half the inertia of the face-normal axis.",
            offset: `This shift adds M d² = ${num(data.exact.shift)} kg·m² to the centered value. The +d and −d positions give the same I. Doubling the shift quadruples this added part.`,
            resolution: "More dots improve the numerical approximation. They do not change the physical body or its exact moment of inertia."
        };
        $("insight-title").textContent = change ? "WHY IT CHANGED" : "WHAT THIS BODY TELLS YOU";
        $("live-insight").textContent = data.exact.total === 0
            ? "An ideal thin rod has zero inertia about its own length. A real rod’s finite thickness gives a nonzero value; choose another axis to run this idealized model."
            : c.shape === "sphere" && change === "tilt"
                ? "Nothing changed! A uniform sphere looks the same from every direction. Every centered axis has I = 2MR²/5; keeping the same perpendicular shift also keeps I unchanged."
                : explanations[change] || (c.shape === "annulus" ? explanations.hollow : c.offset !== 0 ? explanations.offset : `This body resists changes in spin according to both its mass and its distance from the axis. Its I is equivalent to placing all ${num(c.mass, 2)} kg at a distance of ${num(k, 3)} m from the axis.`);
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
            s.line(circle(c.radius), color, 1, fill);
            s.line(circle(c.radius, 0, "xz"), color, 1);
            s.line(circle(c.radius, 0, "yz"), color, 1);
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
        const s = scene(canvas, d.config, 520, 280, false, true);
        outline(s, d.config, 0, true);
        outline(s, d.config, angle);
        drawAxis(s, d.config);
        const c = d.config;
        const p = c.shape === "rod" ? { x: c.length / 2, y: 0, z: 0 } : c.shape === "plate" ? { x: c.length / 2, y: c.width / 2, z: 0 } : { x: 0, y: c.radius, z: c.shape === "cylinder" ? c.height / 2 : 0 };
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
        $("pause-motion").textContent = running ? "Pause" : "Resume";
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
        const max = Math.max(current ? current.omega : 0, ref ? ref.omega : 0, 0.1) * 1.15;
        const y = value => 184 - value / max * 145;
        let svg = "";
        for (let i = 0; i <= 4; i++) {
            const py = y(max * i / 4);
            svg += `<line x1="64" y1="${py}" x2="534" y2="${py}" stroke="${muted}" opacity=".16"/><text x="56" y="${py + 4}" text-anchor="end" fill="${muted}" font-size="11">${num(max * i / 4, 1)}</text>`;
        }
        for (const [m, color, dash] of [[current, ink, ""], [ref, coral, "7 5"]]) {
            if (!m) continue;
            svg += `<path d="M64 184 L534 ${y(m.omega)}" fill="none" stroke="${color}" stroke-width="3" stroke-dasharray="${dash}"/><circle cx="${64 + time * 235}" cy="${y(m.alpha * time)}" r="5" fill="${color}"/>`;
        }
        svg += `<line x1="${64 + time * 235}" x2="${64 + time * 235}" y1="30" y2="184" stroke="${muted}" stroke-dasharray="3 5"/>`;
        for (const t of [0, 0.5, 1, 1.5, 2]) svg += `<text x="${64 + t * 235}" y="204" text-anchor="middle" fill="${muted}" font-size="11">${t}</text>`;
        $("motion-chart").innerHTML = svg + `<text x="64" y="18" fill="${muted}" font-size="12">Angular speed ω (rad/s)</text><text x="300" y="226" text-anchor="middle" fill="${muted}" font-size="11">Elapsed time (s)</text>`;
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
        const refinementOnly = event && event.target.id === "resolution";
        data = M.evaluate(c);
        selected = Math.min(selected, data.points.length - 1);
        if (!refinementOnly) resetMotion();
        document.querySelectorAll("[data-experiment]").forEach(b => b.setAttribute("aria-pressed", "false"));
        $("experiment-note").textContent = "Custom experiment. Change one variable at a time and pin a reference to compare the effect.";
        renderBody();
        renderExplanation(event && event.target.id);
        if ($("run-motion").disabled) $("motion-status").textContent = "This idealized axis has I = 0, so α = τ/I has no finite value. Change the axis or shape to run the comparison.";
    }

    const experiments = {
        outward: { current: { shape: "disk" }, reference: { shape: "hoop" }, note: "A disk and a hoop each have 2 kg of mass and a 1 m radius. Predict which gains spin faster, then apply equal torque. Look at where each body stores its mass." },
        redistribute: { current: { shape: "annulus", hollow: 0 }, reference: { shape: "disk" }, note: "Drag “Move mass toward the rim” from disk to hoop. Keep the same 2 kg and 1 m outer radius. Does shifting mass outward make the body easier or harder to accelerate?" },
        shift: { current: { shape: "rod", offset: 1 }, reference: { shape: "rod" }, note: "Same 2 m rod: move the axis from its center to its end. I becomes four times larger. The offset adds M(L/2)²; neither the body nor its mass changed." },
        tilt: { current: { shape: "disk", tilt: 90 }, reference: { shape: "disk" }, note: "Same disk, same center: turn the axis from the face normal (z) to a diameter (x). The moment halves because the perpendicular distances change." },
        sphere: { current: { shape: "sphere", tilt: 90 }, reference: { shape: "sphere" }, note: "A solid sphere has equal centered moments in every direction. Tilt the axis and the response stays the same. Shift it to break that equality." }
    };

    function experiment(key) {
        stopSum();
        const e = experiments[key];
        data = M.evaluate({ ...M.DEFAULTS, ...e.current });
        reference = M.evaluate({ ...M.DEFAULTS, ...e.reference });
        selected = Math.floor(data.points.length * 0.75);
        $("accumulate").value = 100;
        $("torque").value = 1;
        $("experiment-note").textContent = e.note;
        document.querySelectorAll("[data-experiment]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.experiment === key)));
        resetMotion(); renderBody();
    }

    controls.forEach(id => $(id).addEventListener("input", changeBody));
    document.querySelectorAll("[data-tilt]").forEach(b => b.addEventListener("click", () => { $("tilt").value = b.dataset.tilt; changeBody({ target: $("tilt") }); }));
    document.querySelectorAll("[data-experiment]").forEach(b => b.addEventListener("click", () => experiment(b.dataset.experiment)));
    $("reset-body").addEventListener("click", () => experiment("outward"));
    $("camera").addEventListener("change", drawSpecimen);
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
    new MutationObserver(() => { renderDistribution(); drawMotionChart(Number($("torque").value)); }).observe(document.body, { attributes: true, attributeFilter: ["class"] });
    window.addEventListener("resize", () => { drawSpecimen(); renderMotion(); });
    experiment("outward");
})();
