"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const em = require("../../src/tools/shared/optics/emWaves.js");
const fresnel = require("../../src/tools/shared/optics/fresnel.js");

const { c, eps0, mu0 } = em.constants;
const close = (a, b, rel = 1e-12, abs = 0) =>
    assert.ok(Math.abs(a - b) <= Math.max(abs, rel * Math.max(Math.abs(a), Math.abs(b))), `${a} ≉ ${b}`);

const POLS = [
    { type: "linear", psi: 0 }, { type: "linear", psi: 0.7 }, { type: "rcp" }, { type: "lcp" },
    { type: "elliptical", psi: 0.4, delta: 1.1 }
];

test("free-space impedance and medium impedance η = η0/n", () => {
    close(em.constants.eta0, Math.sqrt(mu0 / eps0), 1e-9); // ≈ 376.73 Ω, independent route
    close(em.constants.eta0, 376.730313, 1e-7);
    const m = em.medium(1.5);
    close(m.eta, Math.sqrt(m.mu / m.eps), 1e-9);
    close(m.v, 1 / Math.sqrt(m.mu * m.eps), 1e-9);
    assert.throws(() => em.medium(0), RangeError);
});

test("travelling wave: E ⟂ H ⟂ k, S ∥ +k, |H| = |E|/η at all z, t, polarisations", () => {
    for (const pol of POLS) {
        const cfg = em.setup({ lambda0: 800e-9, n1: 1.7, E0: 250, pol, boundary: "none" });
        for (let i = 0; i < 40; i++) {
            const z = (i * 0.137 - 2) * cfg.lambda1, t = i * 0.071 * cfg.period;
            const f = em.fields(cfg, z, t);
            const k = [0, 0, 1];
            const eM = em.vec.norm(f.E), hM = em.vec.norm(f.H);
            assert.ok(Math.abs(em.vec.dot(f.E, k)) <= 1e-12 * cfg.E0);
            assert.ok(Math.abs(em.vec.dot(f.H, k)) <= 1e-12 * cfg.E0 / cfg.m1.eta);
            assert.ok(Math.abs(em.vec.dot(f.E, f.H)) <= 1e-12 * cfg.E0 * cfg.E0 / cfg.m1.eta);
            close(hM * cfg.m1.eta, eM, 1e-12, 1e-12 * cfg.E0);
            // S along +z, never backwards, transverse components zero
            assert.ok(Math.abs(f.S[0]) + Math.abs(f.S[1]) <= 1e-12 * cfg.I0);
            assert.ok(f.S[2] >= -1e-12 * cfg.I0);
            // instantaneous u_E = u_H for a single travelling wave, and S = (c/n) u
            close(f.uE, f.uH, 1e-10, 1e-14 * cfg.u0);
            close(f.S[2], cfg.m1.v * f.u, 1e-10, 1e-14 * cfg.I0);
        }
    }
});

test("acceptance: ⟨S⟩ = n ε0 c E0²/2 from a numerical period average (peak-amplitude convention)", () => {
    for (const n of [1, 1.33, 1.5, 3.5]) {
        for (const pol of POLS) {
            const E0 = 137;
            const cfg = em.setup({ lambda0: 1064e-9, n1: n, E0, pol });
            const num = em.timeAverageNumeric(cfg, 0.31 * cfg.lambda1, 64);
            const expected = n * eps0 * c * E0 * E0 / 2;
            close(num.Sz, expected, 1e-10);
            close(cfg.I0, expected, 1e-12);
            // E_rms = E0/√2 gives the same intensity via I = E_rms²/η
            close(num.Sz, (E0 / Math.SQRT2) ** 2 / cfg.m1.eta, 1e-9);
            // time-averaged energy equally split, and ⟨S⟩ = v ⟨u⟩
            close(num.uE, num.uH, 1e-10);
            close(num.Sz, cfg.m1.v * num.u, 1e-10);
        }
    }
});

test("circular polarisation: |E|, S and u are constant in time; handedness sign", () => {
    const cfg = em.setup({ lambda0: 500e-9, n1: 1, E0: 10, pol: { type: "rcp" } });
    const s = em.sampleT(cfg, 0, Array.from({ length: 50 }, (_, i) => i * cfg.period / 49));
    for (let i = 0; i < 50; i++) {
        close(Math.hypot(s.Ex[i], s.Ey[i]), 10 / Math.SQRT2, 1e-12); // |E(t)| = E0/√2 = E_rms
        close(s.Sz[i], cfg.I0, 1e-10);
    }
    assert.ok(em.stokes(em.jones({ type: "rcp" })).S3 > 0.999);
    assert.ok(em.stokes(em.jones({ type: "lcp" })).S3 < -0.999);
    // rcp at fixed z rotates x → y (counter-clockwise viewed from +z, looking back at the source)
    const a = em.fields(cfg, 0, 0), b = em.fields(cfg, 0, cfg.period / 4);
    assert.ok(a.E[0] > 7.07 && Math.abs(b.E[0]) < 1e-9 && b.E[1] > 7.07);
});

test("linear polarisation: instantaneous S oscillates between 0 and 2⟨S⟩ at 2ω", () => {
    const cfg = em.setup({ lambda0: 600e-9, n1: 1.2, E0: 3, pol: { type: "linear", psi: 0.3 } });
    const ts = Array.from({ length: 401 }, (_, i) => i * cfg.period / 400);
    const s = em.sampleT(cfg, 0.2e-6, ts);
    close(Math.max(...s.Sz), 2 * cfg.I0, 1e-4);
    assert.ok(Math.min(...s.Sz) < 1e-4 * cfg.I0);
});

test("reflection coefficients come from fresnel.js and conserve energy", () => {
    const cfg = em.setup({ n1: 1, n2: 1.5, boundary: "dielectric" });
    const sol = fresnel.solve(1, 1.5, 0, 633e-9);
    close(cfg.r.re, sol.rs.re, 1e-15);
    close(cfg.r.re, -0.2, 1e-12);
    close(cfg.R + cfg.T, 1, 1e-12);
    close(cfg.T, 0.96, 1e-12);
    const back = em.setup({ n1: 1.5, n2: 1, boundary: "dielectric" });
    close(back.r.re, 0.2, 1e-12);
    const pec = em.setup({ boundary: "pec" });
    assert.equal(pec.R, 1);
    assert.equal(pec.T, 0);
});

test("partial reflection: ⟨S_z⟩ = (1 − R) I0 at every z in medium 1 and equals T·I0 in medium 2", () => {
    for (const [n1, n2] of [[1, 1.5], [1.5, 1], [1, 4], [2.2, 1.3]]) {
        const cfg = em.setup({ lambda0: 700e-9, n1, n2, E0: 50, pol: { type: "elliptical", psi: 0.6, delta: 0.9 }, boundary: "dielectric" });
        for (const zf of [-2.3, -1.1, -0.37, -0.01]) {
            const z = zf * cfg.lambda1;
            const num = em.timeAverageNumeric(cfg, z, 48);
            close(num.Sz, (1 - cfg.R) * cfg.I0, 1e-10);
            close(em.timeAverage(cfg, z).Sz, num.Sz, 1e-10);
        }
        for (const zf of [0.05, 0.8]) {
            const num = em.timeAverageNumeric(cfg, zf * cfg.lambda2, 48);
            close(num.Sz, cfg.T * cfg.I0, 1e-10);
            close(num.Sz, em.intensity(n2, Math.sqrt(cfg.T * n1 / n2) * cfg.E0), 1e-10);
        }
    }
});

test("boundary conditions: tangential E and H continuous at z = 0, so S_z is continuous instantaneously", () => {
    const cfg = em.setup({ lambda0: 500e-9, n1: 1.3, n2: 2.1, E0: 7, pol: { type: "rcp" }, boundary: "dielectric" });
    const eps = 1e-6 * cfg.lambda0;
    for (let i = 0; i < 12; i++) {
        const t = i * cfg.period / 12;
        const a = em.fields(cfg, -eps, t), b = em.fields(cfg, 0, t);
        for (let j = 0; j < 2; j++) {
            close(a.E[j], b.E[j], 0, 1e-4 * cfg.E0);
            close(a.H[j], b.H[j], 0, 1e-4 * cfg.E0 / cfg.m1.eta);
        }
        close(a.S[2], b.S[2], 0, 1e-4 * cfg.I0);
    }
    // PEC: tangential E vanishes at the wall at all times
    const pec = em.setup({ lambda0: 500e-9, n1: 1, E0: 7, boundary: "pec" });
    for (let i = 0; i < 12; i++) {
        const f = em.fields(pec, -1e-18, i * pec.period / 12);
        assert.ok(Math.hypot(f.E[0], f.E[1]) < 1e-9 * pec.E0);
        assert.ok(Math.abs(f.S[2]) < 1e-9 * pec.I0);
    }
});

test("standing wave (|r| = 1): zero net time-averaged flux, E nodes every λ1/2, u_E/u_H exchange", () => {
    for (const pol of POLS) {
        const cfg = em.setup({ lambda0: 600e-9, n1: 1.4, E0: 20, pol, boundary: "pec" });
        for (const zf of [-2.1, -1.25, -0.6, -0.25, -0.01]) {
            const z = zf * cfg.lambda1;
            const num = em.timeAverageNumeric(cfg, z, 64);
            assert.ok(Math.abs(num.Sz) < 1e-12 * cfg.I0, `net flux ${num.Sz}`);
            // total time-averaged energy uniform = 2 × incident ⟨u⟩ (two waves, no cross term in the sum)
            close(num.u, 2 * cfg.u0, 1e-10);
        }
        const nodes = em.eNodes(cfg, -2.01 * cfg.lambda1);
        assert.equal(nodes.length, 5);
        nodes.forEach((z, i) => close(z, -i * cfg.lambda1 / 2, 1e-9, 1e-12 * cfg.lambda1));
        for (const z of nodes) assert.ok(em.timeAverage(cfg, z).uE < 1e-20 * cfg.u0 + 1e-30);
    }
    // quarter wave from the mirror: u_E and u_H oscillate in antiphase; their sum is constant and
    // the energy sloshes: at t with max u_E, u_H = 0 there, and S_z oscillates with zero mean
    const cfg = em.setup({ lambda0: 600e-9, n1: 1, E0: 1, pol: { type: "linear", psi: 0 }, boundary: "pec" });
    const zq = -cfg.lambda1 / 8; // between node (0) and antinode (−λ/4): both energies present
    const ts = Array.from({ length: 200 }, (_, i) => i * cfg.period / 200);
    const s = em.sampleT(cfg, zq, ts);
    const tot = Array.from(s.uE, (v, i) => v + s.uH[i]);
    close(Math.max(...tot), Math.min(...tot), 1e-9); // uniform total at λ/8
    assert.ok(Math.max(...s.uE) > 0.9 * 2 * cfg.u0 && Math.min(...s.uE) < 1e-3 * cfg.u0);
    assert.ok(Math.max(...s.Sz) > 0.9 * cfg.I0 && Math.min(...s.Sz) < -0.9 * cfg.I0);
});

test("Poynting theorem ∂u/∂t + ∂S_z/∂z = 0 holds numerically, with second-order convergence", () => {
    const cases = [
        { boundary: "none", n1: 1.5, pol: { type: "linear", psi: 0.5 } },
        { boundary: "dielectric", n1: 1, n2: 2.5, pol: { type: "elliptical", psi: 0.3, delta: 0.5 } },
        { boundary: "pec", n1: 1.2, pol: { type: "rcp" } }
    ];
    for (const cs of cases) {
        const cfg = em.setup(Object.assign({ lambda0: 633e-9, E0: 100 }, cs));
        let worst1 = 0, worst2 = 0;
        for (let i = 0; i < 25; i++) {
            const z = -(0.07 + 0.09 * i) * cfg.lambda1, t = i * 0.113 * cfg.period;
            const h1 = 1e-2, h2 = 5e-3;
            const r1 = em.poyntingResidual(cfg, z, t, h1 * cfg.lambda1, h1 * cfg.period);
            const r2 = em.poyntingResidual(cfg, z, t, h2 * cfg.lambda1, h2 * cfg.period);
            worst1 = Math.max(worst1, Math.abs(r1.residual));
            worst2 = Math.max(worst2, Math.abs(r2.residual));
            assert.ok(Math.abs(r1.dudt) / r1.scale < 5, "terms are O(1) in the normalisation");
        }
        assert.ok(worst1 < 5e-3, `residual ${worst1}`);
        if (worst1 > 1e-9) assert.ok(worst1 / worst2 > 3.5, `order ratio ${worst1 / worst2}`);
        // tiny steps: limited by round-off only
        let fine = 0;
        for (let i = 0; i < 10; i++) {
            const z = -(0.11 + 0.2 * i) * cfg.lambda1;
            fine = Math.max(fine, Math.abs(em.poyntingResidual(cfg, z, i * 0.1 * cfg.period).residual));
        }
        assert.ok(fine < 1e-6, `fine residual ${fine}`);
    }
    // in medium 2 as well
    const cfg = em.setup({ lambda0: 633e-9, E0: 1, n1: 1, n2: 1.7, boundary: "dielectric" });
    assert.ok(Math.abs(em.poyntingResidual(cfg, 0.37 * cfg.lambda2, 0.2 * cfg.period).residual) < 1e-6);
});

test("limiting cases: n2 → n1 gives no reflection; n2 → ∞ approaches the PEC standing wave", () => {
    const same = em.setup({ n1: 1.5, n2: 1.5, boundary: "dielectric", E0: 5 });
    assert.equal(same.R, 0);
    const trav = em.setup({ n1: 1.5, E0: 5 });
    for (const zf of [-1.3, -0.2, 0.4]) {
        const a = em.fields(same, zf * same.lambda1, 0.3e-15), b = em.fields(trav, zf * trav.lambda1, 0.3e-15);
        close(a.E[0], b.E[0], 1e-9, 1e-12);
        close(a.S[2], b.S[2], 1e-9, 1e-12);
    }
    const hi = em.setup({ n1: 1, n2: 1e6, boundary: "dielectric", E0: 1 });
    const pec = em.setup({ n1: 1, boundary: "pec", E0: 1 });
    close(hi.r.re, pec.r.re, 1e-5);
    const z = -0.3 * pec.lambda1;
    close(em.timeAverage(hi, z).uE, em.timeAverage(pec, z).uE, 1e-5);
    // SWR = (1 + |r|)/(1 − |r|) equals max/min of the E envelope
    const d = em.setup({ lambda0: 500e-9, n1: 1, n2: 1.5, boundary: "dielectric" });
    const zs = Array.from({ length: 2001 }, (_, i) => -i * d.lambda1 / 1000);
    const env = em.sampleZ(d, zs, 0).envE;
    close(Math.max(...env) / Math.min(...env), d.swr, 1e-5);
    close(d.swr, 1.5, 1e-12);
});

test("circular standing wave: total E ∥ H (not ⟂) although the forward wave alone has E ⟂ H", () => {
    // Why the page's transversality readout uses the forward wave: for RCP in front of a PEC,
    // Ẽ ∝ sin k1z J and H̃ ∝ cos k1z ẑ×J; real fields are parallel or antiparallel at every z, t.
    const cfg = em.setup({ lambda0: 633e-9, n1: 1, E0: 1, pol: { type: "rcp" }, boundary: "pec" });
    for (const zf of [-0.125, -0.3, -0.62]) {
        for (const tf of [0.05, 0.3, 0.71]) {
            const f = em.fields(cfg, zf * cfg.lambda1, tf * cfg.period);
            const cosang = em.vec.dot(f.E, f.H) / (em.vec.norm(f.E) * em.vec.norm(f.H));
            close(Math.abs(cosang), 1, 1e-9);
            const Hf = [-f.Ef[1] / cfg.m1.eta, f.Ef[0] / cfg.m1.eta, 0];
            close(em.vec.dot(f.Ef, Hf), 0, 0, 1e-15);
        }
    }
});
