"use strict";
// Benchmarks for the nonlinear-optics model (SHG coupled-amplitude equations, phase matching,
// NLSE split-step). Analytic closed forms and literature values live here, not in the model.
const test = require("node:test");
const assert = require("node:assert/strict");
const nlo = require("../../src/tools/shared/optics/nonlinearOptics.js");
const core = require("../../src/tools/shared/optics/core.js");

const { c, eps0, hbar } = core.constants;
const DEG = Math.PI / 180;
const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (tol ${tol})`);
const rel = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol * Math.abs(b), `${msg}: ${a} vs ${b} (rel ${tol})`);
const sinc2 = (x) => (x === 0 ? 1 : (Math.sin(x) / x) ** 2);

// ------------------------------------------------------------------ crystals / phase matching
test("type I phase-matching angles and QPM period agree with handbook values", () => {
    // Nikogosyan (2005) / Dmitriev et al. Handbook: BBO ooe 1064 → 22.8°, 800 → 29.2°; KDP ooe 1064 → 41°
    close(nlo.typeIAngle("bbo", 1064e-9) / DEG, 22.8, 0.2, "BBO θpm 1064 nm");
    close(nlo.typeIAngle("bbo", 800e-9) / DEG, 29.2, 0.3, "BBO θpm 800 nm");
    close(nlo.typeIAngle("kdp", 1064e-9) / DEG, 41.2, 0.4, "KDP θpm 1064 nm");
    // BBO walk-off at 1064 → 532, type I: ρ ≈ 3.19° (Nikogosyan)
    const p = nlo.shgParams("bbo", 1064e-9, nlo.typeIAngle("bbo", 1064e-9));
    close(Math.abs(p.walkoff) / DEG, 3.19, 0.08, "BBO walk-off");
    close(p.dk, 0, 1e-6, "Δk = 0 at θpm");
    // congruent PPLN first-order period for 1064 → 532 nm at room temperature ≈ 6.8–6.9 µm
    const q = nlo.shgParams("ppln", 1064e-9);
    assert.ok(q.period > 6.6e-6 && q.period < 7.0e-6, "PPLN period " + q.period);
    // indices vs literature (Eimerl 1987 BBO; Zernike 1964 KDP) at 1064 nm
    close(nlo.indices("bbo", 1064e-9).no, 1.6545, 1e-3, "BBO no(1064)");
    close(nlo.indices("kdp", 1064e-9).no, 1.4938, 1e-3, "KDP no(1064)");
    close(nlo.indices("ppln", 1064e-9).ne, 2.156, 2e-3, "LN ne(1064)");
    // n_e(θ) limits: θ = 0 → no, θ = 90° → ne
    close(nlo.neTheta(1.6, 1.5, 0), 1.6, 1e-15, "ne(0)");
    close(nlo.neTheta(1.6, 1.5, Math.PI / 2), 1.5, 1e-15, "ne(90°)");
});

// ------------------------------------------------------------------ SHG coupled amplitudes
const K = 1e-4; // κ in m⁻¹ (W/m²)^−1/2 (BBO-like)

test("undepleted limit reproduces (ΓL)² sinc²(ΔkL/2) for a range of mismatches", () => {
    const L = 0.01, I0 = 1e8; // ΓL = K√I0 L = 1e-2 → η ≈ 1e-4
    const G = K * Math.sqrt(I0);
    for (const x of [0, 0.7, 2, Math.PI, 5, 2 * Math.PI + 0.3, -3]) {
        const r = nlo.solveSHG({ kappa: K, dk: x / L, L, I0, steps: 400, record: 0 });
        const ref = (G * L) ** 2 * sinc2(x / 2);
        const tol = x === 2 * Math.PI + 0.3 ? 2e-3 : 1e-3; // near a zero the relative error grows
        rel(r.eta, ref, tol, "η at ΔkL = " + x);
    }
    // first zero of the efficiency at ΔkL = 2π
    const z = nlo.solveSHG({ kappa: K, dk: 2 * Math.PI / L, L, I0, steps: 400, record: 0 });
    assert.ok(z.eta < 1e-6 * (G * L) ** 2, "zero at ΔkL = 2π");
    // symmetry η(Δk) = η(−Δk)
    const a = nlo.solveSHG({ kappa: K, dk: 150, L, I0: 1e12, steps: 400, record: 0 });
    const b = nlo.solveSHG({ kappa: K, dk: -150, L, I0: 1e12, steps: 400, record: 0 });
    rel(a.eta, b.eta, 1e-10, "η symmetric in Δk (depleted too)");
});

test("pump depletion with Δk = 0 follows tanh²(ΓL) and conserves power", () => {
    const L = 0.01;
    for (const GL of [0.3, 1, 2, 3]) {
        const I0 = (GL / (K * L)) ** 2;
        const r = nlo.solveSHG({ kappa: K, dk: 0, L, I0, steps: 400, record: 0 });
        close(r.eta, Math.tanh(GL) ** 2, 1e-8, "tanh² at ΓL = " + GL);
        close(r.I1out / I0, 1 / Math.cosh(GL) ** 2, 1e-8, "pump sech² at ΓL = " + GL);
        assert.ok(r.energyError < 1e-10, "energy " + r.energyError);
    }
});

test("total power is conserved with depletion and mismatch; efficiency never exceeds 1", () => {
    const L = 0.02, I0 = 4e12;
    for (const dk of [0, 80, 300, -500]) {
        const r = nlo.solveSHG({ kappa: K, dk, L, I0, steps: 800 });
        assert.ok(r.energyError < 1e-9, "energy error " + r.energyError + " at Δk " + dk);
        for (let i = 0; i < r.z.length; i++) close(r.I1[i] + r.I2[i], I0, 1e-9 * I0, "I1 + I2 at sample " + i);
        assert.ok(r.eta <= 1 + 1e-12);
    }
});

test("RK4 integration converges at fourth order to the tanh² solution", () => {
    const L = 0.01, I0 = (2 / (K * L)) ** 2, ex = Math.tanh(2) ** 2;
    const errs = [10, 20, 40].map((n) => Math.abs(nlo.solveSHG({ kappa: K, dk: 0, L, I0, steps: n, record: 0 }).eta - ex));
    const p1 = Math.log2(errs[0] / errs[1]), p2 = Math.log2(errs[1] / errs[2]);
    assert.ok(p1 > 3.5 && p2 > 3.5, `observed orders ${p1}, ${p2}`);
});

test("Manley–Rowe: an independent peak-phasor integration conserves N1 + 2N2 and matches the normalised solver", () => {
    // physical (Boyd-type) equations for peak phasors A_j with I_j = n_j ε0 c |A_j|²/2 — written here
    // independently of the model's normalisation
    const lam = 1064e-9, w1 = 2 * Math.PI * c / lam, d = 2e-12, n1 = 1.65, n2 = 1.70, dk = 120, L = 0.01;
    const I0 = 2e12;
    const A10 = Math.sqrt(2 * I0 / (n1 * eps0 * c));
    const g1 = w1 * d / (n1 * c), g2 = w1 * d / (n2 * c);
    const f = (z, y) => {
        const e = [Math.cos(dk * z), Math.sin(dk * z)];
        const A1 = [y[0], y[1]], A2 = [y[2], y[3]];
        const p = [A2[0] * A1[0] + A2[1] * A1[1], A2[1] * A1[0] - A2[0] * A1[1]]; // A2 A1*
        const pe = [p[0] * e[0] - p[1] * e[1], p[0] * e[1] + p[1] * e[0]];
        const s = [A1[0] * A1[0] - A1[1] * A1[1], 2 * A1[0] * A1[1]];
        const se = [s[0] * e[0] + s[1] * e[1], s[1] * e[0] - s[0] * e[1]];
        return [-g1 * pe[1], g1 * pe[0], -g2 * se[1], g2 * se[0]];
    };
    const sol = core.integrateRK4(f, 0, [A10, 0, 0, 0], L, 2000);
    const flux = (y) => {
        const I1 = n1 * eps0 * c * (y[0] ** 2 + y[1] ** 2) / 2, I2 = n2 * eps0 * c * (y[2] ** 2 + y[3] ** 2) / 2;
        return { N1: I1 / (hbar * w1), N2: I2 / (hbar * 2 * w1), I2 };
    };
    const F0 = flux(sol.y[0]);
    let prev = F0;
    for (let i = 1; i < sol.y.length; i += 50) {
        const F = flux(sol.y[i]);
        rel(F.N1 + 2 * F.N2, F0.N1, 1e-9, "N1 + 2N2 at step " + i);
        if (Math.abs(F.N2 - prev.N2) > 1e-6 * F0.N1) rel(F.N1 - prev.N1, -2 * (F.N2 - prev.N2), 1e-6, "ΔN1 = −2ΔN2");
        prev = F;
    }
    const kap = nlo.kappa(d, lam, n1, n2);
    const r = nlo.solveSHG({ kappa: kap, dk, L, I0, steps: 2000, record: 0 });
    rel(r.I2out, flux(sol.y[sol.y.length - 1]).I2, 1e-8, "normalised solver = physical equations");
    // model's own flux helper
    const ph = nlo.photonFlux(r.I1out, r.I2out, lam), ph0 = nlo.photonFlux(I0, 0, lam);
    rel(ph.N1 + 2 * ph.N2, ph0.N1, 1e-10, "photonFlux Manley–Rowe");
    assert.ok(r.mrError < 1e-10);
});

test("first-order QPM reaches (2/π)² of perfect phase matching and grows in steps", () => {
    const dk = 9.2e5, period = 2 * Math.PI / dk, L = 400 * period, I0 = 1e6;
    const qpm = nlo.solveSHG({ kappa: K, dk, L, I0, qpm: { period, stepsPerDomain: 16 }, record: 0 });
    const pm = nlo.solveSHG({ kappa: K, dk: 0, L, I0, steps: 400, record: 0 });
    rel(qpm.eta / pm.eta, (2 / Math.PI) ** 2, 5e-3, "QPM/PM efficiency ratio");
    // no poling: bounded oscillation at the coherence length, far below both
    const none = nlo.solveSHG({ kappa: K, dk, L, I0, steps: 4000, record: 0 });
    assert.ok(none.eta < 1e-4 * qpm.eta, "unpoled mismatched crystal");
    // mismatched period (Λ = 2π/Δk × 1.05) gives much less than the matched one
    const off = nlo.solveSHG({ kappa: K, dk, L, I0, qpm: { period: period * 1.05, stepsPerDomain: 16 }, record: 0 });
    assert.ok(off.eta < 0.2 * qpm.eta, "detuned period");
    // SH amplitude after each full period grows by 2·(2/π)·(Λ/2)Γ-ish steps: check monotone growth at domain boundaries
    const tr = nlo.solveSHG({ kappa: K, dk, L: 20 * period, I0, qpm: { period, stepsPerDomain: 16 }, record: 1e6 });
    let lastAtBoundary = -1;
    for (let i = 0; i < tr.z.length; i++) {
        const m = tr.z[i] / (period / 2);
        if (Math.abs(m - Math.round(m)) < 1e-6 && Math.round(m) > 0) {
            assert.ok(tr.I2[i] > lastAtBoundary, "SH grows at every domain wall");
            lastAtBoundary = tr.I2[i];
        }
    }
});

// ------------------------------------------------------------------ NLSE split step
const ps = 1e-12, km = 1e3;
const beta2 = -20 * ps * ps / km, gamma = 1.3 / km, T0 = 1 * ps;
const LD = T0 * T0 / Math.abs(beta2);

test("fundamental soliton keeps its sech shape over five dispersion lengths", () => {
    const P0 = Math.abs(beta2) / (gamma * T0 * T0); // N = 1
    const p = nlo.makePulse({ N: 1024, window: 40 * T0, T0, P0, shape: "sech" });
    const L = 5 * LD;
    const r = nlo.splitStep({ t: p.t, re: p.re, im: p.im, dt: p.dt, beta2, gamma, L, steps: 2000 });
    const ex = nlo.solitonField(p.t, T0, P0, gamma, L);
    assert.ok(nlo.relL2(r.re, r.im, ex.re, ex.im) < 1e-3, "complex field incl. soliton phase γP0z/2");
    let pk = 0;
    for (let i = 0; i < r.re.length; i++) pk = Math.max(pk, r.re[i] ** 2 + r.im[i] ** 2);
    rel(pk, P0, 1e-3, "peak power");
    rel(r.energyOut, r.energyIn, 1e-12, "energy (unitary steps)");
    // same pulse without nonlinearity broadens: sech with z = 5 L_D is several times wider
    const lin = nlo.splitStep({ t: p.t, re: p.re, im: p.im, dt: p.dt, beta2, gamma: 0, L, steps: 1 });
    const I = (q) => Array.from(q.re, (v, i) => v * v + q.im[i] ** 2);
    assert.ok(nlo.rmsWidth(p.t, I(lin)) > 3 * nlo.rmsWidth(p.t, I(r)), "dispersion alone broadens");
});

test("SPM alone: peak nonlinear phase = γP0L, intensity unchanged, Gaussian rms broadening (Agrawal 4.1.13)", () => {
    const P0 = 10, L = 1.5 * Math.PI / (gamma * P0); // φmax = 1.5π
    const p = nlo.makePulse({ N: 2048, window: 40 * T0, T0, P0, shape: "gauss" });
    for (const steps of [1, 7]) {
        const r = nlo.splitStep({ t: p.t, re: p.re, im: p.im, dt: p.dt, beta2: 0, gamma, L, steps });
        const i0 = p.re.length / 2; // T = 0
        close(Math.atan2(r.im[i0], r.re[i0]), gamma * P0 * L - 2 * Math.PI, 1e-12, "φ(0) = γP0L (mod 2π)");
        for (let i = 0; i < p.re.length; i += 97) close(r.re[i] ** 2 + r.im[i] ** 2, p.re[i] ** 2, 1e-12, "|A|² unchanged");
        const s0 = nlo.spectrum(p.re, p.im, p.dt), s1 = nlo.spectrum(r.re, r.im, p.dt);
        rel(nlo.rmsWidth(s1.nu, s1.S) / nlo.rmsWidth(s0.nu, s0.S), Math.sqrt(1 + 4 / (3 * Math.sqrt(3)) * (gamma * P0 * L) ** 2), 2e-3, "rms broadening");
    }
});

test("dispersion alone: Gaussian broadens as T0 √(1 + (z/L_D)²)", () => {
    const p = nlo.makePulse({ N: 2048, window: 80 * T0, T0, P0: 1, shape: "gauss" });
    const r = nlo.splitStep({ t: p.t, re: p.re, im: p.im, dt: p.dt, beta2, gamma: 0, L: 3 * LD, steps: 3 });
    const I = Array.from(r.re, (v, i) => v * v + r.im[i] ** 2), I0 = Array.from(p.re, (v) => v * v);
    rel(nlo.rmsWidth(p.t, I) / nlo.rmsWidth(p.t, I0), Math.sqrt(10), 1e-6, "rms width ratio at 3 L_D");
});

test("symmetric split step converges at second order with step count", () => {
    // N = 1.5 soliton-like pulse (not an eigenstate, so the splitting error is not trivially zero)
    const P0 = 2.25 * Math.abs(beta2) / (gamma * T0 * T0);
    const p = nlo.makePulse({ N: 1024, window: 40 * T0, T0, P0, shape: "sech" });
    const conv = nlo.convergence({ t: p.t, re: p.re, im: p.im, dt: p.dt, beta2, gamma, L: 2 * LD }, 16, 5);
    assert.ok(conv.order > 1.85 && conv.order < 2.2, "observed order " + conv.order);
    for (let i = 1; i < conv.errors.length; i++) {
        const ratio = conv.errors[i - 1] / conv.errors[i];
        assert.ok(ratio > 3.4 && ratio < 4.6, "error ratio on doubling steps " + ratio);
    }
    // against the analytic soliton (N = 1) the error also falls as h²
    const P1 = Math.abs(beta2) / (gamma * T0 * T0);
    const q = nlo.makePulse({ N: 1024, window: 40 * T0, T0, P0: P1, shape: "sech" });
    const ex = nlo.solitonField(q.t, T0, P1, gamma, 3 * LD);
    const c2 = nlo.convergence({ t: q.t, re: q.re, im: q.im, dt: q.dt, beta2, gamma, L: 3 * LD }, 8, 5, ex);
    assert.ok(c2.order > 1.8 && c2.order < 2.3, "order vs analytic soliton " + c2.order);
});
