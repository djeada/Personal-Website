"use strict";
// Quantum optics and detection statistics: validation against analytic quantum-optics results.
const test = require("node:test");
const assert = require("node:assert/strict");
const Q = require("../../src/tools/shared/optics/quantumOptics.js");
const core = require("../../src/tools/shared/optics/core.js");

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ""} expected ${b}, got ${a} (tol ${tol})`);

// ------------------------------------------------------------------ density matrices
test("every state family gives a valid density matrix (trace 1, Hermitian, positive)", () => {
    const cases = [
        ["coherent", { nbar: 4, phase: 0.7 }, 30],
        ["thermal", { nbar: 2.5 }, 40],
        ["fock", { n: 3 }, 10],
        ["squeezed", { nbar: 1, phase: 0.3 }, 40]
    ];
    for (const [k, par, N] of cases) {
        const s = Q.makeState(k, par, N);
        const c = Q.checkDensity(s.rho);
        close(c.trace, 1, 1e-12, k + " trace");
        close(c.traceIm, 0, 1e-14, k + " Im trace");
        assert.ok(c.hermiticityError < 1e-14, k + " Hermitian");
        assert.ok(c.minEigenvalue > -1e-10, k + " positive semidefinite, min eig " + c.minEigenvalue);
        // pure states have Tr ρ² = 1; thermal is mixed with Tr ρ² = 1/(2n̄+1) (untruncated)
        if (k === "thermal") close(c.purity, 1 / (2 * par.nbar + 1), 2e-3, "thermal purity");
        else close(c.purity, 1, 1e-12, k + " purity");
    }
});

test("Hermitian eigenvalue solver reproduces a known spectrum", () => {
    // ρ = diag(0.5, 0.3, 0.2) rotated by a complex unitary keeps its spectrum
    const U = Q.cmat(3);
    const c = Math.cos(0.4), s = Math.sin(0.4);
    // U = [[c, i s, 0], [i s, c, 0], [0, 0, e^{i0.3}]]
    U.re[0] = c; U.im[1] = s; U.im[3] = s; U.re[4] = c; U.re[8] = Math.cos(0.3); U.im[8] = Math.sin(0.3);
    const D = Q.diagonalDensity([0.5, 0.3, 0.2]);
    const rho = Q.matMul(Q.matMul(U, D), Q.adjoint(U));
    const ev = Q.eigvalsHermitian(rho);
    close(ev[0], 0.2, 1e-12); close(ev[1], 0.3, 1e-12); close(ev[2], 0.5, 1e-12);
});

// ------------------------------------------------------------------ photon-number statistics
test("coherent state: Poisson mean = variance, Q = 0, g²(0) = 1", () => {
    const s = Q.makeState("coherent", { nbar: 6.25 }, 60);
    const m = Q.momentsOf(s.p);
    close(m.mean, 6.25, 1e-9); close(m.variance, 6.25, 1e-8); close(m.Q, 0, 1e-9); close(m.g2, 1, 1e-9);
    assert.ok(s.truncation < 1e-15, "tail beyond N = 60 negligible");
});

test("thermal state: Bose–Einstein variance n̄ + n̄², g²(0) = 2 (up to the reported truncation)", () => {
    const nbar = 3;
    const s = Q.makeState("thermal", { nbar }, 150);
    const m = Q.momentsOf(s.p);
    // analytic tail r^{N+1}
    close(s.truncation, Math.pow(0.75, 151), 1e-30);
    close(m.mean, nbar, 1e-12); close(m.variance, nbar + nbar * nbar, 1e-10); close(m.g2, 2, 1e-12); close(m.Q, nbar, 1e-10);
});

test("truncation error is reported and shrinks with basis size", () => {
    const small = Q.makeState("coherent", { nbar: 20 }, 20), big = Q.makeState("coherent", { nbar: 20 }, 60);
    // P(n > 20) for Poisson(20) = 0.4409 (tabulated)
    close(small.truncation, 0.44091, 2e-4, "Poisson(20) upper tail");
    close(small.normalisedFrom + small.truncation, 1, 1e-12, "kept + discarded = 1");
    assert.ok(big.truncation < 1e-9);
    const mSmall = Q.momentsOf(small.p), mBig = Q.momentsOf(big.p);
    assert.ok(Math.abs(mSmall.mean - 20) > 1, "a too-small basis biases the mean");
    close(mBig.mean, 20, 1e-7);
});

test("Fock states: variance 0, Q = −1, g²(0) = 1 − 1/n", () => {
    for (const n of [1, 2, 3, 5, 10]) {
        const m = Q.momentsOf(Q.makeState("fock", { n }, n + 4).p);
        close(m.mean, n, 0); close(m.variance, 0, 1e-12); close(m.g2, 1 - 1 / n, 1e-12); close(m.Q, -1, 1e-12);
    }
    assert.throws(() => Q.makeState("fock", { n: 8 }, 5));
});

test("squeezed vacuum: only even n, ⟨n⟩ = sinh²r, Var = 2n̄(n̄+1), g²(0) = 3 + 1/n̄", () => {
    const nbar = 0.8;
    const s = Q.makeState("squeezed", { nbar }, 200);
    for (let n = 1; n < s.dim; n += 2) assert.equal(s.p[n], 0);
    const m = Q.momentsOf(s.p);
    close(m.mean, nbar, 1e-9); close(m.variance, 2 * nbar * (nbar + 1), 1e-8); close(m.g2, 3 + 1 / nbar, 1e-8);
});

// ------------------------------------------------------------------ loss channel and detectors
test("loss channel is trace preserving and keeps ρ positive and Hermitian", () => {
    const s = Q.makeState("coherent", { nbar: 3, phase: 1.1 }, 25);
    const out = Q.lossChannel(s.rho, 0.37);
    const c = Q.checkDensity(out);
    close(c.trace, 1, 1e-12); assert.ok(c.hermiticityError < 1e-14); assert.ok(c.minEigenvalue > -1e-10);
});

test("loss maps coherent |α⟩ → |√η α⟩ (still pure and Poisson)", () => {
    const eta = 0.4, alpha2 = 5;
    const s = Q.makeState("coherent", { nbar: alpha2, phase: 0.6 }, 45);
    const out = Q.lossChannel(s.rho, eta);
    const ref = Q.makeState("coherent", { nbar: eta * alpha2, phase: 0.6 }, 45);
    let err = 0;
    for (let k = 0; k < out.re.length; k++) err = Math.max(err, Math.abs(out.re[k] - ref.rho.re[k]), Math.abs(out.im[k] - ref.rho.im[k]));
    assert.ok(err < 1e-9, "matrix elements agree, max err " + err);
    close(Q.purity(out), 1, 1e-8, "coherent state stays pure");
    const m = Q.momentsOf(Q.numberDistribution(out));
    close(m.mean, 2, 1e-9); close(m.variance, 2, 1e-8);
});

test("loss maps thermal(n̄) → thermal(ηn̄)", () => {
    const eta = 0.3, nbar = 4;
    const s = Q.makeState("thermal", { nbar }, 200);
    const q = Q.numberDistribution(Q.lossChannel(Q.diagonalDensity(s.p.subarray(0, 120)), eta));
    const ref = Q.makeState("thermal", { nbar: eta * nbar }, 119).p;
    for (let n = 0; n < 30; n++) close(q[n], ref[n], 1e-12, "P(" + n + ")");
    const m = Q.momentsOf(q);
    close(m.g2, 2, 1e-8, "g² unchanged by loss (input truncated at n = 119, tail 0.8^120 ≈ 2e-12)");
});

test("loss preserves g²(0) but moves Fock states towards Poisson (Q → −η)", () => {
    const eta = 0.25;
    const q = Q.thinDistribution(Q.makeState("fock", { n: 4 }, 4).p, eta);
    const m = Q.momentsOf(q);
    close(m.mean, 1, 1e-12); close(m.variance, 4 * eta * (1 - eta), 1e-12); close(m.Q, -eta, 1e-12); close(m.g2, 0.75, 1e-12);
});

test("dark counts add a Poisson distribution; analytic detected moments match the numeric ones", () => {
    const s = Q.makeState("thermal", { nbar: 2 }, 120);
    const pm = Q.detectedDistribution(s.p, 0.6, 0.3);
    const m = Q.momentsOf(pm), a = Q.detectedMomentsAnalytic(s.exact, 0.6, 0.3);
    close(m.total, 1, 1e-10); close(m.mean, a.mean, 1e-9); close(m.variance, a.variance, 1e-8);
    // vacuum + dark counts is exactly Poisson(d)
    const pv = Q.detectedDistribution(Q.makeState("fock", { n: 0 }, 0).p, 0.9, 0.5);
    const pois = Q.poissonPmf(0.5, pv.length - 1);
    for (let k = 0; k < pv.length; k++) close(pv[k], pois[k], 1e-13);
});

// ------------------------------------------------------------------ sampling
test("shot-by-shot detector sampling agrees with the channel prediction within sampling error", () => {
    const rng = core.createRng(2024);
    const s = Q.makeState("thermal", { nbar: 3 }, 100);
    const det = { eta: 0.7, dark: 0.2 };
    const shots = 40000;
    const r = Q.sampleDetections(s.p, det, shots, rng);
    const theory = Q.detectedDistribution(s.p, det.eta, det.dark);
    const m = Q.momentsOf(theory);
    // mean within 4 standard errors
    assert.ok(Math.abs(r.mean - m.mean) < 4 * Math.sqrt(m.variance / shots), `mean ${r.mean} vs ${m.mean}`);
    const chi = Q.chiSquare(r.hist, theory, shots);
    assert.ok(chi.chi2 < chi.dof + 5 * Math.sqrt(2 * chi.dof), `χ² = ${chi.chi2} for ${chi.dof} dof`);
});

test("sampled Poisson counts have variance ≈ mean (Q ≈ 0 within its standard error)", () => {
    const rng = core.createRng(7);
    const s = Q.makeState("coherent", { nbar: 5 }, 40);
    const shots = 50000;
    const r = Q.sampleDetections(s.p, { eta: 0.5 }, shots, rng);
    const Qs = r.variance / r.mean - 1;
    // SE of the sample variance for Poisson μ: √((μ + 2μ²)/N) → SE(Q) ≈ √((1 + 2μ)/(μ N))
    const mu = 2.5, se = Math.sqrt((1 + 2 * mu) / (mu * shots));
    assert.ok(Math.abs(Qs) < 4 * se, `Q = ${Qs}, 4σ = ${4 * se}`);
});

// ------------------------------------------------------------------ Mach–Zehnder complementarity
test("MZ: probabilities are conserved and a balanced unmarked interferometer has V = 1", () => {
    for (const phi of [0, 0.3, 1, 2.2, Math.PI]) {
        const r = Q.mzProbabilities({ phi, theta: 0.5, R1: 0.3 });
        close(r.P1 + r.P2, 1, 1e-14);
        close(Q.checkDensity(r.rhoOut).trace, 1, 1e-14);
    }
    const r0 = Q.mzProbabilities({ phi: 0 });
    close(r0.P1, 0, 1e-15, "port 1 dark at φ = 0 (symmetric splitter convention)");
    close(Q.mzVisibility({}).V, 1, 1e-12);
});

test("MZ: V² + D² = 1 for pure marker states, V² + D² < 1 with dephasing", () => {
    for (const theta of [0, 0.2, Math.PI / 4, 1.1, Math.PI / 2]) {
        for (const R1 of [0.5, 0.2, 0.9]) {
            const cfg = { theta, R1 };
            const V = Q.mzVisibility(cfg).V, wp = Q.whichPath(cfg);
            close(V, wp.V, 1e-12, "scan visibility equals 2√(wa wb)|⟨ma|mb⟩|");
            close(V * V + wp.D * wp.D, 1, 1e-12, `θ=${theta} R=${R1}`);
            assert.ok(wp.D >= wp.P - 1e-12, "D ≥ predictability");
        }
    }
    const cfg = { theta: 0.6, dephase: 0.3 };
    const V = Q.mzVisibility(cfg).V, wp = Q.whichPath(cfg);
    assert.ok(V * V + wp.D * wp.D < 1 - 0.1);
    close(Q.checkDensity(Q.mzState(cfg).rho).minEigenvalue >= -1e-12 ? 1 : 0, 1, 0);
});

test("MZ quantum eraser: full marking kills fringes; a 45° polarizer restores V = 1 with complementary ±45° fringes", () => {
    const base = { theta: Math.PI / 2 };
    close(Q.mzVisibility(base).V, 0, 1e-12);
    close(Q.whichPath(base).D, 1, 1e-12);
    const plus = Object.assign({ polarizer: Math.PI / 4 }, base), minus = Object.assign({ polarizer: -Math.PI / 4 }, base);
    close(Q.mzVisibility(plus).Vcond, 1, 1e-12);
    close(Q.mzVisibility(minus).Vcond, 1, 1e-12);
    for (const phi of [0, 0.7, 2]) {
        const a = Q.mzProbabilities(Object.assign({ phi }, plus)), b = Q.mzProbabilities(Object.assign({ phi }, minus)), u = Q.mzProbabilities(Object.assign({ phi }, base));
        close(a.P1 + a.P2, 0.5, 1e-14, "polarizer passes half the photons");
        close(a.P1 + b.P1, u.P1, 1e-14, "fringe + anti-fringe = unmarked-by-eraser pattern");
    }
    // H polarizer selects arm a only: no fringes
    close(Q.mzVisibility(Object.assign({ polarizer: 0 }, base)).Vcond, 0, 1e-12);
});

test("MZ single-photon sampling reproduces Born probabilities within binomial error", () => {
    const rng = core.createRng(99);
    const probs = Q.mzProbabilities({ phi: 1.0, theta: 0.4 });
    const det = { eta: 0.8, pDark: 0.01 };
    const pc = Q.mzClickProbabilities(probs, det);
    const N = 30000;
    let c1 = 0, c2 = 0;
    for (let i = 0; i < N; i++) { const e = Q.mzSampleEvent(probs, det, rng); c1 += e.c1; c2 += e.c2; }
    for (const [obs, p] of [[c1, pc.c1], [c2, pc.c2]]) {
        const se = Math.sqrt(p * (1 - p) / N);
        assert.ok(Math.abs(obs / N - p) < 4 * se, `${obs / N} vs ${p} (4σ = ${4 * se})`);
    }
});

// ------------------------------------------------------------------ HBT
test("ideal g²(0): coherent 1, thermal 2, single emitter 0; thermal coherence time = ∫|g¹|²dτ", () => {
    close(Q.g2Ideal("coherent", 0), 1, 0);
    for (const line of ["lorentz", "gauss"]) {
        close(Q.g2Ideal("thermal", 0, { tau0: 3e-9, line }), 2, 1e-15);
        const I = core.integrateAdaptive((t) => Q.g2Ideal("thermal", t, { tau0: 3e-9, line }) - 1, -60e-9, 60e-9, 1e-14);
        close(I / 3e-9, 1, 1e-6, line + " ∫(g²−1)dτ = τc");
        close(Q.g2Ideal("thermal", 1, { tau0: 3e-9, line }), 1, 1e-12, "g² → 1 for τ ≫ τc");
    }
    close(Q.g2Ideal("emitter", 0, { tau0: 1e-9 }), 0, 0);
});

test("jitter and dark counts: measured g² formula limits", () => {
    const par = { tau0: 1e-9, line: "lorentz" };
    close(Q.g2Measured("thermal", 0, par), 2, 1e-12, "no jitter");
    // area of the bunching peak is conserved by jitter convolution
    const big = Object.assign({ jitter: 5e-9 }, par);
    assert.ok(Q.g2Measured("thermal", 0, big) < 1.2, "jitter ≫ τc washes out the peak");
    const area = core.simpson((t) => Q.g2Measured("thermal", t, big) - 1, -60e-9, 60e-9, 2000);
    close(area / 1e-9, 1, 2e-3, "∫(g²−1) conserved under jitter");
    // uncorrelated background: g²(0) = 1 − ρ² for a perfect emitter
    close(Q.g2Measured("emitter", 0, { tau0: 1e-9, rho1: 0.8, rho2: 0.8 }), 1 - 0.64, 1e-12);
});

test("simulated coincidence histograms: coherent flat, thermal bunched, emitter antibunched", () => {
    const common = { seed: 11, dark: 0, jitter: 0 };
    // coherent
    let sim = Q.simulateHBT(Object.assign({ kind: "coherent", tau0: 1e-6, rate: 2e5, T: 2 }, common));
    let h = Q.coincidenceHistogram(sim.t1, sim.t2, { binWidth: 1e-6, range: 20e-6, T: sim.T });
    let mean = 0; for (const v of h.g2) mean += v / h.g2.length;
    close(mean, 1, 0.02, "coherent mean g²");
    // thermal Lorentzian
    const tau0 = 1e-6;
    sim = Q.simulateHBT(Object.assign({ kind: "thermal", line: "lorentz", tau0, rate: 1.5e5, T: 0.3 }, common));
    h = Q.coincidenceHistogram(sim.t1, sim.t2, { binWidth: tau0 / 5, range: 8 * tau0, T: sim.T });
    const mid = Math.floor(h.g2.length / 2);
    const g0 = 0.5 * (h.g2[mid] + h.g2[mid - 1]);
    const expect0 = 0.5 * (Q.g2Measured("thermal", h.centers[mid], { tau0, binWidth: h.binWidth }) + Q.g2Measured("thermal", h.centers[mid - 1], { tau0, binWidth: h.binWidth }));
    // the field is a finite-length random process, so allow 6× the Poisson error plus 5 %
    assert.ok(Math.abs(g0 - expect0) < 0.05 * expect0 + 6 * h.err[mid], `thermal g²(0) ${g0} vs ${expect0}`);
    assert.ok(g0 > 1.6, "bunching visible");
    close(0.5 * (h.g2[0] + h.g2[h.g2.length - 1]), 1, 0.1, "g² → 1 at 8 τc");
    // single emitter
    sim = Q.simulateHBT(Object.assign({ kind: "emitter", tau0: 1e-9, rate: 2e6, eta: 0.5, T: 0.3 }, common));
    assert.ok(!sim.info.saturated);
    h = Q.coincidenceHistogram(sim.t1, sim.t2, { binWidth: 0.2e-9, range: 8e-9, T: sim.T });
    const em = Math.floor(h.g2.length / 2);
    const e0 = 0.5 * (h.g2[em] + h.g2[em - 1]);
    const eTh = Q.g2Measured("emitter", 0.1e-9, { tau0: 1e-9, binWidth: 0.2e-9 });
    assert.ok(Math.abs(e0 - eTh) < 5 * h.err[em] + 0.02, `emitter g²(0) ${e0} vs ${eTh}`);
    assert.ok(e0 < 0.25, "antibunching");
});

test("emitter rate solver: Γp + Γr = 1/τ₀ and 1/Γp + 1/Γr = 1/R, saturation flagged", () => {
    const r = Q.emitterRates(2e-9, 5e7);
    close((r.gammaP + r.gammaR) * 2e-9, 1, 1e-12);
    close((1 / r.gammaP + 1 / r.gammaR) * 5e7, 1, 1e-9);
    assert.ok(Q.emitterRates(2e-9, 2e8).saturated);
});

test("saturated emitter: detected rate per detector is Remit·η/2 = η/(8τ₀), not the requested rate", () => {
    // The page's signal fraction ρ = S/(S + dark) must use this delivered rate S when saturated.
    const tau0 = 1e-6,
        eta = 0.5;
    const sim = Q.simulateHBT({ kind: "emitter", tau0, rate: 1e6, eta, dark: 0, T: 0.4, seed: 5 });
    assert.ok(sim.info.saturated);
    close(sim.info.Remit, 1 / (4 * tau0), 1e-9);
    const S = sim.info.Remit * eta / 2;
    const measured = sim.t1.length / sim.T;
    close(measured / S, 1, 5 * Math.sqrt(1 / (S * sim.T)) + 0.02, "delivered rate");
});
