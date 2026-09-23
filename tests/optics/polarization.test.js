const test = require("node:test");
const assert = require("node:assert/strict");
const m = require("../../src/tools/shared/optics/polarization.js");

const deg = Math.PI / 180;
const close = (a, b, tol = 1e-9, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ""} expected ${b}, got ${a}`);

test("single-component states are linear for every relative phase", () => {
    for (const psiDeg of [0, 90]) {
        for (let dDeg = -180; dDeg <= 180; dDeg += 15) {
            const d = m.describeJones(m.jonesFromPsiDelta(psiDeg * deg, dDeg * deg));
            assert.equal(d.type, "linear", `ψ=${psiDeg} δ=${dDeg}`);
            assert.equal(d.exact, true);
            close(d.ellipticity, 0, 1e-9);
            close(Math.abs(d.orientation), psiDeg * deg, 1e-9, "orientation");
            assert.equal(d.handedness, "none");
        }
    }
});

test("δ = 0 or ±180° is linear for any amplitude ratio", () => {
    for (const psiDeg of [10, 30, 45, 70]) {
        for (const dDeg of [0, 180, -180]) {
            const d = m.describeJones(m.jonesFromPsiDelta(psiDeg * deg, dDeg * deg));
            assert.equal(d.type, "linear");
            assert.equal(d.exact, true);
        }
    }
});

test("equal amplitudes with δ = ±π/2 are circular with opposite handedness", () => {
    const r = m.describeJones(m.jonesFromPsiDelta(45 * deg, 90 * deg));
    const l = m.describeJones(m.jonesFromPsiDelta(45 * deg, -90 * deg));
    assert.equal(r.type, "circular");
    assert.equal(r.exact, true);
    assert.equal(l.type, "circular");
    close(r.ellipticity, 45 * deg);
    close(l.ellipticity, -45 * deg);
    assert.equal(r.handedness, "right");
    assert.equal(l.handedness, "left");
});

test("handedness convention: S3 > 0 rotates counter-clockwise seen facing the source", () => {
    const J = m.jonesFromPsiDelta(45 * deg, 90 * deg);
    // at z = 0 the phase is −ωt; a small positive time step
    const a = m.fieldAt(J, 0), b = m.fieldAt(J, -0.1);
    const cross = a.x * b.y - a.y * b.x; // z-component of a×b, +z points toward the viewer
    assert.ok(cross > 0);
    assert.ok(m.stokesFromJones(J).S3 > 0);
});

test("near-linear and near-circular states are flagged approximate, not exact", () => {
    const nearLin = m.describeJones(m.jonesFromPsiDelta(45 * deg, 2 * deg));
    assert.equal(nearLin.type, "linear");
    assert.equal(nearLin.exact, false);
    const nearCirc = m.describeJones(m.jonesFromPsiDelta(44 * deg, 90 * deg));
    assert.equal(nearCirc.type, "circular");
    assert.equal(nearCirc.exact, false);
    const ell = m.describeJones(m.jonesFromPsiDelta(30 * deg, 60 * deg));
    assert.equal(ell.type, "elliptical");
});

test("ellipse parameters satisfy tan 2θ = tan 2ψ cos δ and sin 2χ = sin 2ψ sin δ", () => {
    const psi = 30 * deg, delta = 60 * deg;
    const d = m.describeJones(m.jonesFromPsiDelta(psi, delta));
    close(Math.tan(2 * d.orientation), Math.tan(2 * psi) * Math.cos(delta), 1e-9);
    close(Math.sin(2 * d.ellipticity), Math.sin(2 * psi) * Math.sin(delta), 1e-9);
    close(d.dop, 1, 1e-12);
});

test("ideal analyzer obeys Malus's law", () => {
    for (const inDeg of [0, 20, 45, 77]) {
        const J = m.jonesFromPsiDelta(inDeg * deg, 0); // linear at inDeg
        for (let aDeg = -90; aDeg <= 90; aDeg += 10) {
            const out = m.applyJones(m.polarizer(aDeg * deg), J);
            close(m.intensity(out), Math.cos((aDeg - inDeg) * deg) ** 2, 1e-12, `in ${inDeg} analyzer ${aDeg}`);
            const d = m.describeJones(out);
            if (m.intensity(out) > 1e-9) {
                assert.equal(d.type, "linear");
                close(Math.cos(2 * (d.orientation - aDeg * deg)), 1, 1e-9);
            }
        }
    }
    // circular light through any polarizer transmits half
    const circ = m.jonesFromPsiDelta(45 * deg, 90 * deg);
    close(m.intensity(m.applyJones(m.polarizer(33 * deg), circ)), 0.5, 1e-12);
});

test("quarter-wave plate at 45° to linear input produces circular light", () => {
    for (const inDeg of [0, 30, 90]) {
        const J = m.jonesFromPsiDelta(inDeg * deg, 0);
        const plus = m.describeJones(m.applyJones(m.quarterWavePlate((inDeg + 45) * deg), J));
        const minus = m.describeJones(m.applyJones(m.quarterWavePlate((inDeg - 45) * deg), J));
        assert.equal(plus.type, "circular");
        assert.equal(minus.type, "circular");
        close(Math.abs(plus.ellipticity), 45 * deg, 1e-9);
        assert.notEqual(plus.handedness, minus.handedness);
    }
});

test("half-wave plate at θ mirrors a linear state about the fast axis", () => {
    const J = m.jonesFromPsiDelta(10 * deg, 0);
    const d = m.describeJones(m.applyJones(m.halfWavePlate(30 * deg), J));
    assert.equal(d.type, "linear");
    close(d.orientation, 50 * deg, 1e-9);
});

test("ideal retarders preserve intensity and degree of polarization", () => {
    const states = [[0, 0], [45, 90], [30, 60], [80, -130]];
    const plates = [m.halfWavePlate(17 * deg), m.quarterWavePlate(-40 * deg), m.retarder(1.234, 63 * deg)];
    for (const [p, d] of states) {
        const J = m.jonesFromPsiDelta(p * deg, d * deg);
        for (const M of plates) {
            const out = m.applyJones(M, J);
            close(m.intensity(out), 1, 1e-12);
            close(m.describeJones(out).dop, 1, 1e-12);
        }
        // partially polarized input via coherency matrix
        const C = m.partiallyPolarized(J, 0.4, 2);
        for (const M of plates) {
            const S = m.describeStokes(m.stokesFromCoherency(m.applyToCoherency(M, C)));
            close(S.S0, 2, 1e-12);
            close(S.dop, 0.4, 1e-12);
        }
    }
});

test("coherency Stokes match Jones Stokes; unpolarized light through a polarizer gives I/2", () => {
    const J = m.jonesFromPsiDelta(30 * deg, 60 * deg);
    const a = m.stokesFromJones(J), b = m.stokesFromCoherency(m.coherencyFromJones(J));
    for (const k of ["S0", "S1", "S2", "S3"]) close(a[k], b[k], 1e-12);
    const un = m.partiallyPolarized(J, 0, 1);
    assert.equal(m.describeStokes(m.stokesFromCoherency(un)).type, "unpolarized");
    const S = m.describeStokes(m.stokesFromCoherency(m.applyToCoherency(m.polarizer(1), un)));
    close(S.S0, 0.5, 1e-12);
    close(S.dop, 1, 1e-12);
});

test("birefringent retardance Γ = 2π Δn d / λ", () => {
    // quartz Δn ≈ 0.0092 at 550 nm: quarter-wave thickness λ/(4Δn)
    const lambda = 550e-9, dn = 0.0092;
    close(m.birefringentRetardance(dn, lambda / (4 * dn), lambda), Math.PI / 2, 1e-12);
});

// ---------------------------------------------------------------- Mueller calculus and the bench
const stokesClose = (a, b, tol, msg) => {
    for (const k of ["S0", "S1", "S2", "S3"]) close(a[k], b[k], tol, `${msg || ""} ${k}`);
};
const rng = (() => { let s = 12345; return () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648); })();
const ctx = { wavelength: 633e-9 };
const randomElement = () => {
    const t = m.ELEMENT_TYPES[Math.floor(rng() * 6)]; // excludes the depolarizer (no Jones matrix)
    return { type: t, angle: (rng() - 0.5) * Math.PI, retardance: rng() * 2 * Math.PI, rotation: (rng() - 0.5) * Math.PI,
        crystal: ["quartz", "calcite", "mgf2", "sapphire"][Math.floor(rng() * 4)], thickness: rng() * 40e-6, depolarization: 0 };
};

test("Mueller and Jones calculus agree for fully polarized light through every element", () => {
    for (let trial = 0; trial < 200; trial++) {
        const J = m.jonesFromPsiDelta(rng() * Math.PI / 2, (rng() - 0.5) * 2 * Math.PI);
        const el = randomElement();
        const viaJones = m.stokesFromJones(m.applyJones(m.elementJones(el, ctx), J));
        const viaMueller = m.applyMueller(m.elementMueller(el, ctx), m.stokesFromJones(J));
        stokesClose(viaMueller, viaJones, 1e-12, el.type);
        // the closed-form Mueller matrix equals ½ tr(σi J σj J†)
        const MJ = m.muellerFromJones(m.elementJones(el, ctx)), M = m.elementMueller(el, ctx);
        for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) close(MJ[i][j], M[i][j], 1e-12, `${el.type} M${i}${j}`);
    }
});

test("an ordered 5-element chain gives the same output by Jones and by Mueller", () => {
    for (let trial = 0; trial < 50; trial++) {
        const els = Array.from({ length: 5 }, randomElement);
        const r = m.propagate({ psi: rng() * Math.PI / 2, delta: rng() * 6 - 3 }, els, ctx);
        assert.ok(r.output.J, "Jones path defined for fully polarized light");
        for (const s of r.steps) stokesClose(s.S, m.stokesFromJones(s.J), 1e-12);
        // passive elements never add power
        let prev = r.input.S.S0;
        for (const s of r.steps) { assert.ok(s.S.S0 <= prev + 1e-12); prev = s.S.S0; }
    }
    // order matters: polarizer then QWP differs from QWP then polarizer
    const a = m.propagate({ psi: 0, delta: 0 }, [{ type: "polarizer", angle: Math.PI / 4 }, { type: "qwp", angle: 0 }]).output.desc;
    const b = m.propagate({ psi: 0, delta: 0 }, [{ type: "qwp", angle: 0 }, { type: "polarizer", angle: Math.PI / 4 }]).output.desc;
    assert.equal(a.type, "circular");
    assert.equal(b.type, "linear");
});

test("ideal retarders and rotators preserve S0 and the degree of polarization (Mueller, partial light)", () => {
    for (const p of [0, 0.25, 0.7, 1]) {
        const S = m.stokesFromPsiDelta(0.4, 1.1, p, 3);
        for (const el of [{ type: "hwp", angle: 0.3 }, { type: "qwp", angle: -1 }, { type: "retarder", angle: 0.2, retardance: 2.2 },
            { type: "plate", angle: 0.5, crystal: "calcite", thickness: 7.3e-6 }, { type: "rotator", rotation: 0.9 }]) {
            const d = m.describeStokes(m.applyMueller(m.elementMueller(el, ctx), S));
            close(d.S0, 3, 1e-12, el.type);
            close(d.dop, p, 1e-12, el.type);
        }
    }
});

test("a depolarizer reduces DoP by (1 − D), keeps intensity, and ends the Jones description", () => {
    for (const D of [0.1, 0.5, 1]) {
        const r = m.propagate({ psi: 0.3, delta: 0.8, dop: 0.9 }, [{ type: "depolarizer", depolarization: D }]);
        close(r.output.S.S0, 1, 1e-12);
        close(r.output.desc.dop, 0.9 * (1 - D), 1e-12);
        assert.equal(r.output.J, null);
    }
    const full = m.propagate({ psi: 0.3, delta: 0.8 }, [{ type: "depolarizer", depolarization: 1 }]).output.desc;
    assert.equal(full.type, "unpolarized");
});

test("Malus with unpolarized input: any single polarizer transmits exactly 1/2", () => {
    for (let a = -90; a <= 90; a += 7.5) {
        const r = m.propagate({ psi: 0.7, delta: 1.3, dop: 0 }, [{ type: "polarizer", angle: a * deg }]);
        close(r.output.S.S0, 0.5, 1e-12, `angle ${a}`);
        close(r.output.desc.dop, 1, 1e-12);
        assert.equal(r.output.desc.type, "linear");
    }
    // partially polarized linear light at 0°: I = ½[1 + p cos 2θ]
    const p = 0.6;
    for (let a = 0; a <= 90; a += 15) {
        const I = m.propagate({ psi: 0, delta: 0, dop: p }, [{ type: "polarizer", angle: a * deg }]).output.S.S0;
        close(I, 0.5 * (1 + p * Math.cos(2 * a * deg)), 1e-12);
    }
});

test("three polarizers 0°, 45°, 90° pass 1/8 of unpolarized light; crossed pair passes 0", () => {
    const P = (d) => ({ type: "polarizer", angle: d * deg });
    const three = m.propagate({ psi: 0, delta: 0, dop: 0 }, [P(0), P(45), P(90)]);
    close(three.output.S.S0, 1 / 8, 1e-12);
    close(three.steps[0].S.S0, 1 / 2, 1e-12);
    close(three.steps[1].S.S0, 1 / 4, 1e-12);
    close(m.propagate({ psi: 0, delta: 0, dop: 0 }, [P(0), P(90)]).output.S.S0, 0, 1e-12);
    // general middle angle: I = (1/8) sin² 2θ
    for (let t = 0; t <= 90; t += 5) {
        close(m.propagate({ psi: 0, delta: 0, dop: 0 }, [P(0), P(t), P(90)]).output.S.S0, Math.sin(2 * t * deg) ** 2 / 8, 1e-12);
    }
});

test("rotator equals two half-wave plates (HWP at 0 then at ρ/2) and rotates linear states by ρ", () => {
    const rho = 37 * deg;
    const M1 = m.matMul(m.halfWavePlate(rho / 2), m.halfWavePlate(0));
    const M2 = m.muellerFromJones(M1), R = m.muellerRotator(rho);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) close(M2[i][j], R[i][j], 1e-12);
    const d = m.describeJones(m.applyJones(m.rotator(rho), m.jonesFromPsiDelta(10 * deg, 0)));
    close(d.orientation, 47 * deg, 1e-12);
});

test("crystal A-plates: fast axis ⊥ c for positive, ∥ c for negative crystals; quartz QWP makes circular light", () => {
    const q = m.plateGeometry("quartz", 0, 10e-6, 633e-9);
    assert.equal(q.positive, true);
    assert.equal(q.fastRay, "o");
    close(q.fastAxis, Math.PI / 2, 1e-15);
    const cal = m.plateGeometry("calcite", 0.3, 1e-6, 633e-9);
    assert.equal(cal.fastRay, "e");
    close(cal.fastAxis, 0.3, 1e-15);
    // zero- and third-order quarter-wave plates give the same (circular) state at the design wavelength
    for (const order of [0, 3]) {
        const d = m.plateThicknessFor("quartz", Math.PI / 2, 633e-9, order);
        close(m.plateGeometry("quartz", 0, d, 633e-9).effectiveRetardance, Math.PI / 2, 1e-9);
        const out = m.propagate({ psi: 0, delta: 0 }, [{ type: "plate", angle: 45 * deg, crystal: "quartz", thickness: d }], ctx).output.desc;
        assert.equal(out.type, "circular");
        close(Math.abs(out.ellipticity), 45 * deg, 1e-9);
    }
    // a full-wave plate is the identity for every input
    const d = m.plateThicknessFor("mgf2", 2 * Math.PI, 633e-9);
    const Mw = m.elementMueller({ type: "plate", angle: 0.4, crystal: "mgf2", thickness: d }, ctx);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) close(Mw[i][j], i === j ? 1 : 0, 1e-9);
    // retardance scales linearly with thickness and inversely with wavelength
    const g1 = m.plateGeometry("quartz", 0, 20e-6, 500e-9).retardance, g2 = m.plateGeometry("quartz", 0, 40e-6, 1000e-9).retardance;
    close(g1, g2, 1e-12);
});

test("jonesFromStokes round-trips the polarized part; Poincaré paths start at S and end at M·S", () => {
    for (let t = 0; t < 30; t++) {
        const S = m.stokesFromPsiDelta(rng() * Math.PI / 2, rng() * 6 - 3, 1, 2);
        stokesClose(m.stokesFromJones(m.jonesFromStokes(S)), S, 1e-12);
    }
    const S = m.stokesFromPsiDelta(0, 0, 0.8);
    for (const el of [{ type: "qwp", angle: 45 * deg }, { type: "rotator", rotation: 0.4 }, { type: "polarizer", angle: 1 }, { type: "depolarizer", depolarization: 0.5 }]) {
        const path = m.elementPath(el, S, ctx, 20);
        stokesClose(path[0], S, 1e-12);
        stokesClose(path[path.length - 1], m.applyMueller(m.elementMueller(el, ctx), S), 1e-12, el.type);
    }
    // retarder paths stay on a sphere of constant polarized intensity
    for (const q of m.elementPath({ type: "retarder", angle: 0.3, retardance: 2.5 }, S, ctx, 30)) close(Math.hypot(q.S1, q.S2, q.S3), 0.8, 1e-12);
});

test("every Mueller output is physically realisable: S0 ≥ |S_pol| for random partial inputs and chains", () => {
    for (let trial = 0; trial < 100; trial++) {
        const els = Array.from({ length: 5 }, () => (rng() < 0.2 ? { type: "depolarizer", depolarization: rng() } : randomElement()));
        const r = m.propagate({ psi: rng() * 1.5, delta: rng() * 6 - 3, dop: rng() }, els, ctx);
        for (const s of r.steps) assert.ok(s.S.S0 + 1e-12 >= Math.hypot(s.S.S1, s.S.S2, s.S.S3));
    }
});
