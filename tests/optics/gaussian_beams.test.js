"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../../src/tools/shared/optics/core.js");
const gb = require("../../src/tools/shared/optics/gaussianBeams.js");

const C = core.complex;
const close = (a, b, rel = 1e-12, msg) => assert.ok(Math.abs(a - b) <= rel * Math.max(Math.abs(a), Math.abs(b), 1e-300), msg || `${a} vs ${b}`);

const HeNe = { w0: 0.5e-3, z0: 0, lambda0: 632.8e-9, n: 1, M2: 1 };

test("Rayleigh range: zR = π n w0²/λ0 for a HeNe beam (≈ 1.241 m)", () => {
    const b = gb.makeBeam(HeNe);
    close(b.zR, Math.PI * 0.25e-6 / 632.8e-9, 1e-14);
    assert.ok(Math.abs(b.zR - 1.2411) < 1e-4);
    // doubling n doubles zR (same w0, shorter medium wavelength)
    close(gb.rayleighRange(1e-3, 1e-6, 2), 2 * gb.rayleighRange(1e-3, 1e-6, 1), 1e-15);
});

test("acceptance: w(zR) = √2 w0, R(zR) = 2 zR (minimum |R|), Gouy(zR) = π/4", () => {
    for (const n of [1, 1.5]) {
        const b = gb.makeBeam(Object.assign({}, HeNe, { n, z0: 0.3 }));
        close(gb.beamRadius(b.z0 + b.zR, b), Math.SQRT2 * b.w0, 1e-14);
        close(gb.beamRadius(b.z0 - b.zR, b), Math.SQRT2 * b.w0, 1e-14);
        close(gb.curvatureRadius(b.z0 + b.zR, b), 2 * b.zR, 1e-14);
        close(gb.gouyPhase(b.z0 + b.zR, b), Math.PI / 4, 1e-14);
        // R(z) has its minimum |R| at z = zR
        const Rs = [0.5, 0.9, 1, 1.1, 2].map((u) => gb.curvatureRadius(b.z0 + u * b.zR, b));
        assert.equal(Math.min(...Rs), Rs[2]);
    }
});

test("planar wavefront at the waist: curvature exactly 0, R = Infinity, formatted as planar (no finite value, no NaN)", () => {
    const b = gb.makeBeam(HeNe);
    assert.equal(gb.curvature(0, b), 0);
    assert.equal(gb.curvatureRadius(0, b), Infinity);
    const txt = gb.formatCurvatureRadius(gb.curvature(0, b), (v) => v.toFixed(3) + " m");
    assert.match(txt, /planar/);
    assert.doesNotMatch(txt, /NaN|Infinity/);
    // beamFromQ at the waist also reports planar
    const s = gb.beamFromQ(gb.qAt(0, b), b.lambda0);
    assert.equal(s.invR, 0);
    assert.equal(s.R, Infinity);
    close(s.w, b.w0, 1e-14);
    // qFromWR accepts R = Infinity
    const q = gb.qFromWR(b.w0, Infinity, b.lambda0);
    close(q.re + 1, 1, 1e-14); close(q.im, b.zR, 1e-14);
});

test("far field: w(z)/z → θ = λ/(π n w0) and R(z) → z", () => {
    const b = gb.makeBeam(HeNe);
    const z = 1e4 * b.zR;
    close(gb.beamRadius(z, b) / z, gb.divergence(b.w0, b.lambda0), 1e-7);
    close(gb.curvatureRadius(z, b) / z, 1, 1e-7);
    close(gb.gouyPhase(z, b), Math.PI / 2, 1e-4);
});

test("1/q = 1/R − iλ/(π n w²) decodes back to w(z), R(z) (convention round trip)", () => {
    const b = gb.makeBeam(Object.assign({}, HeNe, { n: 1.45, M2: 1.3 }));
    for (const z of [-3, -0.4, 0.01, 0.7, 5]) {
        const iq = C.inv(gb.qAt(z, b));
        const w = gb.beamRadius(z, b);
        close(iq.re, gb.curvature(z, b), 1e-12);
        close(iq.im, -b.M2 * b.lambda0 / (Math.PI * b.n * w * w), 1e-12);
        const s = gb.beamFromQ(gb.qAt(z, b), b.lambda0, b.n, b.M2);
        close(s.w, w, 1e-12); close(s.w0, b.w0, 1e-12); close(s.dzWaist, -z, 1e-12);
    }
});

test("acceptance: q through free-space ABCD reproduces analytic w(z), R(z)", () => {
    const b = gb.makeBeam(Object.assign({}, HeNe, { w0: 50e-6, lambda0: 1064e-9 }));
    let q = gb.qAt(-0.02, b); // start 2 cm before the waist
    const dz = 1e-3;
    for (let i = 1; i <= 60; i++) {
        q = gb.applyABCD(gb.abcd.propagate(dz), q); // 60 successive 1 mm steps
        const z = -0.02 + i * dz;
        const s = gb.beamFromQ(q, b.lambda0);
        close(s.w, gb.beamRadius(z, b), 1e-10);
        if (Math.abs(z) > 1e-9) close(1 / s.invR, gb.curvatureRadius(z, b), 1e-7);
        else assert.ok(Math.abs(s.invR) < 1e-6 * gb.curvature(b.zR, b));
    }
});

test("power normalisation: ∫ I 2πr dr = P at every z (power conserved by propagation and lenses)", () => {
    const P = 2.5e-3;
    const tr = gb.traceLenses(Object.assign({}, HeNe, { w0: 0.2e-3 }), [{ z: 0.3, f: 0.1 }, { z: 0.6, f: -0.05 }]);
    for (const z of [0, 0.2, 0.35, 0.4, 0.61, 1.2]) {
        const w = gb.stateAt(tr, z).w;
        const Pnum = core.integrateAdaptive((r) => 2 * Math.PI * r * gb.intensity(r, w, P), 0, 8 * w, 1e-16);
        close(Pnum, P, 1e-9, `power at z = ${z}`);
        close(gb.intensity(0, w, P) * Math.PI * w * w / 2, P, 1e-14);
    }
    // 1/e² definition: I(w)/I(0) = e⁻², power within w = 1 − e⁻²
    close(gb.intensity(1e-3, 1e-3) / gb.intensity(0, 1e-3), Math.exp(-2), 1e-14);
    close(gb.powerInRadius(1e-3, 1e-3), 1 - Math.exp(-2), 1e-14);
});

test("paraxial field solves the paraxial wave equation (finite differences, site convention)", () => {
    // u = (w0/w) exp(−r²/w²) exp(i(k r²/(2R) − ψ)); check 2ik ∂u/∂z + ∇⊥²u = 0 (for exp(+ikz) carrier)
    const b = gb.makeBeam({ w0: 20e-6, lambda0: 800e-9, n: 1 });
    const k = 2 * Math.PI / b.lambda0;
    const u = (r, z) => {
        const w = gb.beamRadius(z, b), ph = gb.transversePhase(r, gb.curvature(z, b), gb.gouyPhase(z, b), b.lambda0);
        return C.fromPolar(b.w0 / w * Math.exp(-r * r / (w * w)), ph);
    };
    const z = 0.7 * b.zR, r = 0.8 * gb.beamRadius(z, b), hz = b.zR * 1e-4, hr = b.w0 * 1e-3;
    const dudz = C.scale(C.sub(u(r, z + hz), u(r, z - hz)), 1 / (2 * hz));
    // radial Laplacian u'' + u'/r
    const d2 = C.scale(C.add(C.sub(u(r + hr, z), C.scale(u(r, z), 2)), u(r - hr, z)), 1 / (hr * hr));
    const d1 = C.scale(C.sub(u(r + hr, z), u(r - hr, z)), 1 / (2 * hr * r));
    const res = C.add(C.mul(C.cx(0, 2 * k), dudz), C.add(d2, d1));
    const scale = C.abs(C.mul(C.cx(0, 2 * k), dudz));
    assert.ok(C.abs(res) < 1e-5 * scale, `residual ${C.abs(res)} vs ${scale}`);
});

test("acceptance: lens transformation agrees with direct ABCD propagation of q", () => {
    const beam = { w0: 0.3e-3, z0: -0.05, lambda0: 532e-9, n: 1 };
    const lenses = [{ z: 0.2, f: 0.075 }, { z: 0.45, f: 0.15 }, { z: 0.8, f: -0.1 }];
    const tr = gb.traceLenses(beam, lenses);
    const zA = 0;
    const qA = gb.qAt(zA, gb.makeBeam(beam));
    for (let z = 0.01; z < 1.2; z += 0.037) {
        const M = gb.systemMatrix(lenses, zA, z);
        close(core.mat2.det(M), 1, 1e-12); // same medium in and out → det = 1
        const s = gb.beamFromQ(gb.applyABCD(M, qA), beam.lambda0);
        const st = gb.stateAt(tr, z);
        close(s.w, st.w, 1e-9, `w at z=${z}`);
        close(s.invR, st.invR, 1e-8, `1/R at z=${z}`);
    }
});

test("acceptance: thin-lens imaging of a waist matches Self's formula (s ≠ f, s = f, virtual image)", () => {
    const lambda0 = 1064e-9;
    const f = 0.1;
    for (const [w0, s] of [[1e-3, 0.3], [1e-3, 0], [0.1e-3, f], [0.05e-3, 0.04], [0.5e-3, 1.5]]) {
        const zR = gb.rayleighRange(w0, lambda0);
        const tr = gb.traceLenses({ w0, z0: -s, lambda0 }, [{ z: 0, f }]);
        const out = tr.segments[1];
        const self = gb.selfImaging(s, zR, f);
        // Self's implicit equation 1/(s + zR²/(s − f)) + 1/s'' = 1/f
        const lhs = (s === f ? 0 : 1 / (s + zR * zR / (s - f))) + 1 / self.sOut;
        close(lhs, 1 / f, 1e-10);
        close(out.z0, self.sOut, 1e-9, `waist position s=${s}`);
        close(out.w0 / w0, self.m, 1e-9, `magnification s=${s}`);
    }
    // geometric limit zR → 0: Self's formula reduces to the thin-lens equation
    const g = gb.selfImaging(0.3, 1e-9, 0.1);
    close(g.sOut, 1 / (1 / 0.1 - 1 / 0.3), 1e-9);
    close(g.m, 0.5, 1e-6); // geometric magnification s''/s = 0.15/0.3
});

test("Gouy phase accumulates π through a focus and is continuous across a thin lens", () => {
    const tr = gb.traceLenses({ w0: 1e-3, z0: 0, lambda0: 633e-9 }, [{ z: 0.1, f: 0.05 }]);
    const a = gb.stateAt(tr, 0.1 - 1e-12).gouy, b = gb.stateAt(tr, 0.1).gouy;
    assert.ok(Math.abs(a - b) < 1e-9);
    const far = gb.stateAt(tr, 1e4).gouy - gb.stateAt(tr, 0.1).gouy; // focus at ≈ 0.15, far past it
    assert.ok(Math.abs(far - (Math.PI / 2 - Math.atan((0.1 - tr.segments[1].z0) / tr.segments[1].zR))) < 1e-3);
    assert.ok(far > 0.95 * Math.PI && far < Math.PI);
});

test("single-lens mode matching reaches the target waist; impossible below f0", () => {
    const lambda0 = 1064e-9, w1 = 0.4e-3, w2 = 60e-6, f = 0.2;
    const f0 = gb.minFocalForMatch(w1, w2, lambda0);
    assert.deepEqual(gb.modeMatchSingle(w1, w2, 0.9 * f0, lambda0), []);
    const sols = gb.modeMatchSingle(w1, w2, f, lambda0);
    assert.equal(sols.length, 2);
    for (const s of sols) {
        const tr = gb.traceLenses({ w0: w1, z0: 0, lambda0 }, [{ z: s.d1, f }]);
        close(tr.segments[1].w0, w2, 1e-9);
        close(tr.segments[1].z0, s.d1 + s.d2, 1e-9);
    }
});

test("two-lens mode matching places the target waist and size at zT", () => {
    const lambda0 = 1064e-9;
    const cfg = { w1: 0.5e-3, z1: 0, w2: 0.15e-3, zT: 1.5, f1: 0.1, f2: 0.2, lambda0, zMin: 0.001, zMax: 1.5 };
    const sols = gb.modeMatchTwo(cfg);
    assert.ok(sols.length >= 1, "at least one solution");
    for (const s of sols) {
        const tr = gb.traceLenses({ w0: cfg.w1, z0: 0, lambda0 }, [{ z: s.x1, f: cfg.f1 }, { z: s.x2, f: cfg.f2 }]);
        const last = tr.segments[2];
        close(last.w0, cfg.w2, 1e-6);
        assert.ok(Math.abs(last.z0 - cfg.zT) < 1e-8);
        assert.ok(s.x1 < s.x2 && s.x2 <= cfg.zT);
    }
});

test("focusing a collimated beam: exact spot → λf/(πw) when zR ≫ f; exact waist lies before f", () => {
    const lambda0 = 1064e-9, wL = 2e-3, f = 0.1;
    const r = gb.focusSpot(wL, 0, f, lambda0);
    close(r.approx, lambda0 * f / (Math.PI * wL), 1e-14);
    close(r.exact.w0, r.approx, 1e-4);
    assert.ok(r.exact.dz < f && r.exact.dz > 0.999 * f);
    // inverse design: input radius needed for a spot
    close(gb.inputRadiusForSpot(r.approx, f, lambda0), wL, 1e-12);
    // weak focusing (zR comparable to f): the waist moves well before the focal plane
    const weak = gb.focusSpot(0.1e-3, 0, 1, 633e-9);
    assert.ok(weak.exact.dz < 0.5);
});

test("ABCD interfaces: flat n1→n2 scales q by n2/n1 (waist size unchanged); mirror equals lens f = R/2", () => {
    const lambda0 = 1e-6, w0 = 30e-6;
    const q1 = C.cx(0.01, gb.rayleighRange(w0, lambda0, 1));
    const q2 = gb.applyABCD(gb.abcd.flatInterface(1, 1.5), q1);
    close(q2.re, 1.5 * q1.re, 1e-14); close(q2.im, 1.5 * q1.im, 1e-14);
    close(gb.beamFromQ(q2, lambda0, 1.5).w, gb.beamFromQ(q1, lambda0, 1).w, 1e-12);
    assert.deepEqual(gb.abcd.mirror(0.4), gb.abcd.thinLens(0.2));
    // curved interface into the same index is identity
    assert.deepEqual(gb.abcd.curvedInterface(0.1, 1.3, 1.3), [[1, 0], [0, 1]]);
});

test("M² embedded Gaussian: width equals a TEM00 beam at wavelength M²λ0; divergence × M²", () => {
    const b1 = gb.makeBeam({ w0: 0.5e-3, lambda0: 1.5 * 800e-9 });
    const bM = gb.makeBeam({ w0: 0.5e-3, lambda0: 800e-9, M2: 1.5 });
    for (const z of [0.1, 1, 3]) close(gb.beamRadius(z, bM), gb.beamRadius(z, b1), 1e-14);
    close(gb.divergence(0.5e-3, 800e-9, 1, 1.5), 1.5 * gb.divergence(0.5e-3, 800e-9), 1e-14);
    assert.throws(() => gb.makeBeam({ w0: 1e-3, lambda0: 1e-6, M2: 0.8 }));
});

test("paraxial validity classification", () => {
    assert.equal(gb.paraxialStatus(gb.divergence(0.5e-3, 633e-9)), "ok");
    assert.equal(gb.paraxialStatus(0.2), "marginal");
    assert.equal(gb.paraxialStatus(gb.divergence(0.5e-6, 633e-9)), "invalid");
});
