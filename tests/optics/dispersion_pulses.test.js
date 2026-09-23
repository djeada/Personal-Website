"use strict";
// Benchmarks for the N10 dispersion / pulse model. Literature values are independent of the
// implementation (handbook/refractiveindex.info tables computed from the cited datasets).
const test = require("node:test");
const assert = require("node:assert/strict");
const d = require("../../src/tools/shared/optics/dispersion.js");
const core = require("../../src/tools/shared/optics/core.js");

const c = core.constants.c;
const fs = 1e-15, fs2mm = 1e-30 / 1e-3; // fs²/mm → s²/m
const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (tol ${tol})`);
const rel = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol * Math.abs(b), `${msg}: ${a} vs ${b} (rel ${tol})`);

test("Sellmeier data reproduce catalogue indices", () => {
    close(d.indexAt("fused_silica", 1.0e-6).n, 1.4504, 1e-4, "fused silica n(1.0 µm), Malitson");
    close(d.indexAt("fused_silica", 587.56e-9).n, 1.4585, 1e-4, "fused silica n_d");
    close(d.indexAt("bk7", 587.56e-9).n, 1.5168, 1e-4, "N-BK7 n_d (Schott 1.5168)");
    close(d.indexAt("bk7", 1064e-9).n, 1.5066, 2e-4, "N-BK7 n(1064 nm)");
    close(d.indexAt("sapphire_o", 587.56e-9).n, 1.7682, 2e-4, "sapphire n_o,d");
    close(d.indexAt("caf2", 587.56e-9).n, 1.4338, 1e-4, "CaF2 n_d");
    close(d.indexAt("water", 589.3e-9).n, 1.3330, 5e-4, "water n_D at 20 °C (fit vs handbook 1.3330)");
});

test("group index and GVD of fused silica and BK7 at 800 nm match tabulated values", () => {
    const f = d.dispersionAt("fused_silica", 800e-9);
    close(f.ng, 1.4671, 2e-4, "fused silica n_g(800)");
    close(f.beta2 / fs2mm, 36.16, 0.1, "fused silica β2(800) fs²/mm");
    close(f.beta3 / (1e-45 / 1e-3), 27.5, 0.5, "fused silica β3(800) fs³/mm");
    const b = d.dispersionAt("bk7", 800e-9);
    close(b.beta2 / fs2mm, 44.65, 0.15, "BK7 β2(800) fs²/mm");
    close(b.ng, 1.5267, 3e-4, "BK7 n_g(800)");
    // n_g = n − λ dn/dλ (independent route through the wavelength derivative)
    close(f.ng, f.n - 800e-9 * f.dndl, 1e-6, "n_g two routes");
    // β2 = λ³/(2πc²) d²n/dλ²
    rel(f.beta2, (800e-9) ** 3 / (2 * Math.PI * c * c) * f.d2ndl2, 1e-4, "β2 two routes");
});

test("fused silica zero-dispersion wavelength ≈ 1.27 µm", () => {
    const z = d.zeroGVD("fused_silica");
    assert.equal(z.length, 1);
    close(z[0] * 1e6, 1.2727, 0.003, "λ_ZD (µm)");
    assert.ok(d.dispersionAt("fused_silica", 1.0e-6).beta2 > 0, "normal below λ_ZD");
    assert.ok(d.dispersionAt("fused_silica", 1.55e-6).beta2 < 0, "anomalous above λ_ZD");
    close(d.dispersionAt("fused_silica", 1.55e-6).beta2 / fs2mm, -27.9, 0.5, "β2(1550) ≈ −28 fs²/mm");
});

test("finite-difference derivatives converge (halving the step changes β2 by < 1e-6 relative)", () => {
    const b = d.dispersionAt("bk7", 600e-9, { relStep: 2e-3 }).beta2;
    const e = d.dispersionAt("bk7", 600e-9, { relStep: 1e-3 }).beta2;
    rel(b, e, 1e-6, "β2 step convergence");
});

test("validity intervals: warn outside, refuse in strict mode", () => {
    const r = d.indexAt("bk7", 3.0e-6);
    assert.equal(r.valid, false);
    assert.match(r.message, /0\.300–2\.500 µm/);
    assert.ok(Number.isNaN(d.indexAt("bk7", 3.0e-6, { strict: true }).n));
    assert.equal(d.indexAt("fused_silica", 0.8e-6).valid, true);
    // a pulse centred near the edge reports spectral energy outside the fitted range
    const p = d.propagatePulse({ material: "water", lambda0: 1100e-9, fwhm: 8 * fs, z: 1e-4 });
    assert.ok(p.fractionOutside > 0.2, "water fit ends at 1.129 µm");
    const q = d.propagatePulse({ material: "fused_silica", lambda0: 800e-9, fwhm: 30 * fs, z: 1e-3 });
    assert.ok(q.fractionOutside < 1e-12);
});

test("Lorentz oscillator: passivity, limits and Kramers–Kronig consistency", () => {
    const m = d.resolveMaterial({ kind: "lorentz", lambdaR: 600e-9, gammaRel: 0.05, strength: 0.8, epsInf: 1 });
    const w0 = m.omegaR;
    // static and high-frequency limits
    close(d.complexIndex(m, 1e-6 * w0).re, Math.sqrt(1.8), 1e-6, "n(0) = √(ε∞ + S)");
    close(d.complexIndex(m, 1e4 * w0).re, 1, 1e-6, "n(∞) = √ε∞");
    // passivity: κ ≥ 0 everywhere, and absorption peaks near the resonance
    let kmax = 0, wmax = 0;
    for (let i = 1; i < 4000; i++) {
        const w = i * 3e-3 * w0, k = d.complexIndex(m, w).im;
        assert.ok(k >= 0, "κ ≥ 0");
        if (k > kmax) { kmax = k; wmax = w; }
    }
    assert.ok(Math.abs(wmax / w0 - 1) < 0.1, "absorption peak near ω_R");
    // KK: n rebuilt from κ alone agrees with the direct model
    const ws = [0.3, 0.8, 0.95, 1.0, 1.05, 1.3, 2.5].map((x) => x * w0);
    const kk = d.kramersKronigN((w) => d.complexIndex(m, w).im, ws, { omegaMax: 40 * w0, points: 20000 });
    ws.forEach((w, i) => close(kk[i], d.complexIndex(m, w).re, 2e-4, "KK n at ω/ω_R = " + (w / w0).toFixed(2)));
    // anomalous dispersion inside the line: dn/dω < 0 at ω_R
    const h = 1e-3 * w0;
    assert.ok(d.complexIndex(m, w0 + h).re < d.complexIndex(m, w0 - h).re);
    // γ → 0 far from resonance: essentially lossless
    const m2 = d.resolveMaterial({ kind: "lorentz", lambdaR: 600e-9, gammaRel: 1e-4, strength: 0.8, epsInf: 1 });
    assert.ok(d.complexIndex(m2, 0.5 * w0).im < 1e-4);
});

test("nondispersive medium: pure delay, no broadening, no loss", () => {
    const n = 1.5, z = 30e-6;
    const r = d.propagatePulse({ material: { kind: "constant", n }, lambda0: 800e-9, fwhm: 10 * fs, z, frame: "vacuum" });
    close(r.metricsOut.centroid, (n - 1) * z / c, 1e-20, "delay (n−1)z/c");
    rel(r.metricsOut.fwhm, r.metricsIn.fwhm, 1e-9, "FWHM unchanged");
    rel(r.metricsOut.rms, r.metricsIn.rms, 1e-9, "rms unchanged");
    rel(r.transmission, 1, 1e-12, "energy");
    // group and phase velocities are equal: no carrier-envelope slip in the group frame
    const g = d.propagatePulse({ material: { kind: "constant", n }, lambda0: 800e-9, fwhm: 10 * fs, z, frame: "group" });
    close(g.carrierPhase, 0, 1e-9, "CE phase slip");
});

test("quadratic spectral phase reproduces Gaussian broadening τ(z) = τ0√(1+(z/L_D)²)", () => {
    const disp = d.dispersionAt("bk7", 800e-9);
    const tau0 = d.tau0FromFwhm(10 * fs);
    const LD = d.dispersionLength(tau0, disp.beta2);
    close(LD * 1e3, 0.808, 0.003, "L_D(10 fs, BK7) mm");
    for (const zOverLD of [0, 0.5, 1, 3, 12.4]) {
        const z = zOverLD * LD;
        const r = d.propagatePulse({ material: "bk7", lambda0: 800e-9, fwhm: 10 * fs, z, mode: "taylor", terms: { b0: true, b1: true, b2: true, b3: false } });
        const expect = tau0 * Math.sqrt(1 + zOverLD * zOverLD);
        rel(r.metricsOut.tauRms, expect, 1e-6, "τ from rms at z/L_D = " + zOverLD);
        rel(r.metricsOut.fwhm, d.fwhmFromTau0(expect), 1e-6, "FWHM at z/L_D = " + zOverLD);
        rel(r.metricsOut.peak, r.metricsIn.peak * tau0 / expect, 1e-6, "peak ∝ 1/τ (energy conserved)");
    }
    // sign symmetry: ±β2 broaden identically
    const p = d.propagatePulse({ material: "fused_silica", lambda0: 800e-9, fwhm: 10 * fs, z: 2e-3, gdd0: 0, mode: "taylor", terms: { b3: false } });
    const q = d.propagatePulse({ material: "fused_silica", lambda0: 800e-9, fwhm: 10 * fs, z: 2e-3, gdd0: -2 * 2e-3 * p.disp.beta2, mode: "taylor", terms: { b3: false } });
    rel(q.metricsOut.fwhm, p.metricsOut.fwhm, 1e-6, "GDD +φ vs −φ");
});

test("pre-chirp −β2 z compensates the slab (compression back to the transform limit)", () => {
    const z = 0.01, disp = d.dispersionAt("bk7", 800e-9);
    const r = d.propagatePulse({ material: "bk7", lambda0: 800e-9, fwhm: 10 * fs, z, gdd0: -disp.beta2 * z, mode: "taylor", terms: { b3: false } });
    assert.ok(r.metricsIn.fwhm > 100 * fs, "input is stretched");
    rel(r.metricsOut.fwhm, 10 * fs, 1e-6, "output back to 10 fs");
});

test("10 fs pulse through 1 cm BK7 (exact k(ω)): GDD-dominated broadening plus a TOD tail", () => {
    const r = d.propagatePulse({ material: "bk7", lambda0: 800e-9, fwhm: 10 * fs, z: 0.01 });
    const expect = d.fwhmFromTau0(d.gaussianTau(r.tau0, r.disp.beta2 * 0.01));
    close(expect / fs, 124.2, 0.3, "Gaussian (β2 only) prediction");
    rel(r.metricsOut.fwhm, expect, 0.02, "exact result within 2 % of the β2-only prediction");
    rel(r.transmission, 1, 1e-12, "lossless");
    // TOD skews the pulse: skewness sign follows β3
    const skew = (res) => {
        const m = res.metricsOut; let s3 = 0, E = 0;
        for (let i = 0; i < res.N; i++) { const I = res.outRe[i] ** 2 + res.outIm[i] ** 2; E += I; s3 += I * (res.tOut[i] - m.centroid) ** 3; }
        return s3 / E / m.rms ** 3;
    };
    const tod = d.propagatePulse({ material: "fused_silica", lambda0: 1272.75e-9, fwhm: 10 * fs, z: 0.01 });
    assert.ok(Math.abs(skew(tod)) > 0.3, "pure-TOD pulse is asymmetric");
    const onlyB2 = d.propagatePulse({ material: "fused_silica", lambda0: 800e-9, fwhm: 10 * fs, z: 0.005, mode: "taylor", terms: { b3: false } });
    close(skew(onlyB2), 0, 1e-6, "pure GDD is symmetric");
});

test("inverse propagation restores the initial pulse (lossless, adequately sampled)", () => {
    for (const material of ["fused_silica", "bk7", "caf2"]) {
        const r = d.propagatePulse({ material, lambda0: 800e-9, fwhm: 12 * fs, z: 0.02, gdd0: 300e-30 });
        const b = d.backPropagate(r);
        assert.ok(b.relError < 1e-10, material + " back-propagation error " + b.relError);
    }
    // also a round trip through two propagatePulse calls: +z then −z gives zero net phase
    const fwd = d.propagatePulse({ material: "bk7", lambda0: 800e-9, fwhm: 12 * fs, z: 0.004, mode: "taylor" });
    const back = d.propagatePulse({ material: "bk7", lambda0: 800e-9, fwhm: 12 * fs, z: -0.004, mode: "taylor" });
    assert.ok(fwd.metricsOut.fwhm > 3 * back.metricsIn.fwhm);
    rel(back.metricsOut.fwhm, fwd.metricsOut.fwhm, 1e-9, "±z broaden equally (GDD sign)");
});

test("carrier-envelope phase slip equals ω0 z (n − n_g)/c in the group frame", () => {
    const z = 29e-6;
    const r = d.propagatePulse({ material: "fused_silica", lambda0: 800e-9, fwhm: 8 * fs, z, frame: "group" });
    close(r.carrierPhase, r.disp.omega0 * z * (r.disp.n - r.disp.ng) / c, 1e-9, "φ_CE");
    close(r.carrierPhase, -Math.PI, 0.05, "≈ −π for z = 29 µm at 800 nm");
    // in the phase-velocity frame the carrier is fixed and the envelope walks by (n_g − n) z / c
    const p = d.propagatePulse({ material: "fused_silica", lambda0: 800e-9, fwhm: 8 * fs, z, frame: "phase" });
    close(p.carrierPhase, 0, 1e-9, "no carrier phase in phase frame");
    close(p.metricsOut.centroid, (r.disp.ng - r.disp.n) * z / c, 0.02 * fs, "envelope walk-off");
});

test("absorbing Lorentz medium: narrowband transmission follows Beer–Lambert exp(−αz)", () => {
    const L = { kind: "lorentz", lambdaR: 600e-9, gammaRel: 0.05, strength: 0.02, epsInf: 1 };
    const lam = 700e-9, z = 20e-6;
    const alpha = d.indexAt(L, lam).alpha;
    const r = d.propagatePulse({ material: L, lambda0: lam, fwhm: 500 * fs, z });
    assert.ok(r.transmission < 1);
    rel(r.transmission, Math.exp(-alpha * z), 0.01, "T vs exp(−αz)");
});

test("prism: minimum deviation geometry and angular dispersion", () => {
    const A = 60 * Math.PI / 180, n = 1.5168;
    const g = d.prismMinDeviation(n, A);
    close(n, Math.sin((g.deltaMin + A) / 2) / Math.sin(A / 2), 1e-12, "n from δ_min (Fraunhofer method)");
    // δ(θ1) has its minimum at θ1 = g.theta1
    const dm = d.prismDeviation(n, A, g.theta1);
    close(dm, g.deltaMin, 1e-12, "δ at θ_min");
    assert.ok(d.prismDeviation(n, A, g.theta1 + 0.02) > dm && d.prismDeviation(n, A, g.theta1 - 0.02) > dm);
    // symmetric passage: ray inside is parallel to the base
    close(Math.asin(Math.sin(g.theta1) / n), A / 2, 1e-12, "internal angle A/2");
    // angular dispersion formula vs finite difference of δ at fixed incidence
    const lam = 600e-9, h = 0.5e-9;
    const nl = (l) => d.indexAt("bk7", l).n;
    const disp = d.dispersionAt("bk7", lam);
    const th = d.prismMinDeviation(nl(lam), A).theta1;
    const fd = (d.prismDeviation(nl(lam + h), A, th) - d.prismDeviation(nl(lam - h), A, th)) / (2 * h);
    rel(d.prismAngularDispersion(disp.n, disp.dndl, A), fd, 1e-4, "dδ/dλ");
    // prism pair gives negative angular GDD that grows linearly with separation
    const p1 = d.prismPairGDD("fused_silica", 800e-9, 0.5), p2 = d.prismPairGDD("fused_silica", 800e-9, 1.0);
    assert.ok(p1.angular < 0);
    rel(p2.angular, 2 * p1.angular, 1e-12, "∝ L");
});
