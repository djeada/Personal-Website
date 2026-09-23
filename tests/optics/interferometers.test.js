const test = require("node:test");
const assert = require("node:assert/strict");
const M = require("../../src/tools/shared/optics/interferometers.js");
const core = require("../../src/tools/shared/optics/core.js");

const c0 = 299792458;
const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ""} expected ${b}, got ${a} (tol ${tol})`);
const rng = core.createRng(20260923);

// ---------------------------------------------------------------- beam splitter + conservation

test("beam splitter [[t, ir],[ir, t]] is unitary for every R", () => {
    for (const R of [0, 0.1, 0.25, 0.5, 0.9, 1]) {
        const { S } = M.beamSplitter(R);
        const SSd = core.cmat2.mul(S, core.cmat2.adjoint(S));
        close(SSd[0][0].re, 1, 1e-15); close(SSd[1][1].re, 1, 1e-15);
        close(core.complex.abs(SSd[0][1]), 0, 1e-15); close(core.complex.abs(SSd[1][0]), 0, 1e-15);
        close(core.complex.abs(core.cmat2.det(S)), 1, 1e-15, "|det S| = 1");
    }
});

test("lossless Michelson and Mach–Zehnder conserve P1 + P2 = 1 for all phases, ratios and polarizations", () => {
    for (let trial = 0; trial < 400; trial++) {
        const cfg = {
            type: trial % 2 ? "mz" : "michelson",
            L1: 0.05 + 0.1 * rng.uniform(), L2: 0.05 + 0.1 * rng.uniform(), d: 1e-6 * rng.uniform(-50, 50),
            R1: rng.uniform(), R2: rng.uniform(), phi: rng.uniform(-Math.PI, Math.PI), psi: rng.uniform(0, Math.PI)
        };
        const lam = rng.uniform(400e-9, 1600e-9);
        const r = M.monochromatic(cfg, lam);
        close(r.total, 1, 1e-12, "mono total");
        // partially coherent source: every spectral component conserves power, so the sum does too
        const sp = M.spectrum({ kind: ["gauss", "lorentz", "rect", "sodium"][trial % 4], lambda0: lam, dLambda: 5e-9 });
        close(M.detect(Object.assign({ thetaS: 0.02 }, cfg), sp).total, 1, 1e-12, "broadband total");
    }
});

test("with arm losses the missing power equals what the arms absorb", () => {
    const eta1 = 0.7, eta2 = 0.4, R = 0.3;
    for (const phi of [0, 1, 2, 3]) {
        const mi = M.monochromatic({ type: "michelson", R1: R, eta1, eta2, phi }, 633e-9);
        close(mi.total, (1 - R) * eta1 + R * eta2, 1e-14, "Michelson: T η1 + R η2");
        const mz = M.monochromatic({ type: "mz", R1: R, R2: 0.8, eta1, eta2, phi }, 633e-9);
        close(mz.total, (1 - R) * eta1 + R * eta2, 1e-14, "MZ: T1 η1 + R1 η2");
    }
});

// ---------------------------------------------------------------- fringes

test("moving the Michelson mirror by λ/2 cycles exactly one fringe", () => {
    const lam = 632.8e-9;
    const n = 4000;
    const I = [];
    for (let i = 0; i <= n; i++) I.push(M.monochromatic({ d: 0.123e-6 + i / n * lam / 2 }, lam).P[0]);
    close(I[n], I[0], 1e-9, "periodic in d with period λ/2 (float phase error of k·0.2 m)");
    // exactly one maximum and one minimum inside one period (count sign changes of the slope)
    let turns = 0;
    for (let i = 2; i <= n; i++) if (Math.sign(I[i] - I[i - 1]) !== Math.sign(I[i - 1] - I[i - 2])) turns++;
    assert.equal(turns, 2);
    // and λ/4 is half a fringe: bright ↔ dark
    close(M.monochromatic({ d: 0 }, lam).P[0], 1, 1e-12);
    close(M.monochromatic({ d: lam / 4 }, lam).P[0], 0, 1e-12);
    // the Mach–Zehnder delay stage has the same λ/2 period (OPD = 2d)
    close(M.monochromatic({ type: "mz", d: lam / 2 }, lam).P[0], M.monochromatic({ type: "mz", d: 0 }, lam).P[0], 1e-12);
});

test("balanced interferometers: Michelson detector bright and MZ port 1 dark at zero OPD; φ = π swaps ports", () => {
    const lam = 500e-9;
    close(M.monochromatic({ type: "michelson" }, lam).P[0], 1, 1e-14);
    close(M.monochromatic({ type: "michelson" }, lam).P[1], 0, 1e-14);
    close(M.monochromatic({ type: "mz" }, lam).P[0], 0, 1e-14);
    close(M.monochromatic({ type: "mz", phi: Math.PI }, lam).P[0], 1, 1e-14);
    close(M.monochromatic({ type: "michelson", phi: Math.PI }, lam).P[0], 0, 1e-14);
});

test("unequal splitters, losses and polarization reduce the contrast as the closed forms predict", () => {
    const sp = M.spectrum({ kind: "mono", lambda0: 633e-9 });
    const cases = [
        { type: "michelson", R1: 0.9 }, { type: "michelson", R1: 0.2, eta2: 0.3 }, { type: "michelson", psi: 1.1 },
        { type: "mz", R1: 0.9, R2: 0.5 }, { type: "mz", R1: 0.3, R2: 0.7, eta1: 0.5 }, { type: "mz", psi: Math.PI / 3 }
    ];
    for (const cfg of cases) for (const port of [0, 1]) {
        close(M.measureVisibility(cfg, sp, port).V, M.analyticContrast(cfg, port), 1e-9, JSON.stringify(cfg) + " port " + port);
    }
    // Michelson detector port: both arms carry r·t, so V = 1 for ANY lossless splitter
    close(M.measureVisibility({ R1: 0.95 }, sp, 0).V, 1, 1e-9);
    // crossed polarizations: no fringes, but power still conserved
    const crossed = { psi: Math.PI / 2 };
    close(M.measureVisibility(crossed, sp, 0).V, 0, 1e-12);
    close(M.monochromatic(crossed, 633e-9, { opd: 1e-7 }).total, 1, 1e-14);
});

// ---------------------------------------------------------------- temporal coherence

test("Gaussian spectrum: measured fringe visibility follows exp[−(πΔντ)²/(4 ln2)] (Δν = intensity FWHM)", () => {
    const lambda0 = 800e-9, dLambda = 4e-9;
    const dNu = c0 * dLambda / lambda0 ** 2;
    const sp = M.spectrum({ kind: "gauss", lambda0, dLambda, tauMax: 3 / dNu });
    for (const x of [0, 0.1, 0.25, 0.4, 0.6, 0.9, 1.2]) { // x = Δν τ
        const opd = x * c0 / dNu;
        const V = M.measureVisibility({}, sp, 0, { opd }).V;
        const ref = Math.exp(-Math.pow(Math.PI * x, 2) / (4 * Math.LN2));
        close(V, ref, 2e-4, "Δντ = " + x);
    }
    // half-visibility OPD = 2 ln2 c /(π Δν) and Mandel length c ∫|γ|² dτ = √(2 ln2/π) c/Δν (Parseval)
    const L = M.coherenceLengths(sp);
    // (tolerance: representing the spectrum by bins of width δν = Δν/80 broadens it by δν²/12)
    close(L.halfVisibility / (2 * Math.LN2 * c0 / (Math.PI * dNu)), 1, 1e-4);
    close(L.mandel / (Math.sqrt(2 * Math.LN2 / Math.PI) * c0 / dNu), 1, 1e-6);
});

test("visibility decreases monotonically with path mismatch for Gaussian and Lorentzian sources", () => {
    for (const kind of ["gauss", "lorentz"]) {
        const sp = M.spectrum({ kind, lambda0: 600e-9, dLambda: 10e-9, tauMax: 200e-6 / c0 });
        let prev = 1.01;
        for (let opd = 0; opd <= 150e-6; opd += 10e-6) {
            const V = M.measureVisibility({}, sp, 0, { opd }).V;
            if (prev < 1e-9) break; // numerically zero: the Gaussian envelope is below 1e-9
            assert.ok(V < prev, kind + " V not decreasing at " + opd);
            prev = V;
        }
    }
});

test("Lorentzian: |γ| = exp(−πΔν|τ|) within the declared ±100 Δν truncation (≈0.3 %)", () => {
    const lambda0 = 1550e-9, dLambda = 1e-9;
    const dNu = c0 * dLambda / lambda0 ** 2;
    const sp = M.spectrum({ kind: "lorentz", lambda0, dLambda, tauMax: 2 / dNu });
    assert.ok(sp.truncated > 0.002 && sp.truncated < 0.004);
    for (const x of [0.05, 0.2, 0.5, 1]) {
        const g = core.complex.abs(M.coherence(sp, x * c0 / dNu));
        close(g, Math.exp(-Math.PI * x), 0.004, "Δντ = " + x);
    }
});

test("rectangular spectrum: fringes vanish at OPD = c/Δν = λ²/Δλ (first zero of sinc)", () => {
    const lambda0 = 600e-9, dLambda = 10e-9;
    const dNu = c0 * dLambda / lambda0 ** 2;
    const sp = M.spectrum({ kind: "rect", lambda0, dLambda, tauMax: 3 / dNu });
    const zero = c0 / dNu;
    close(core.complex.abs(M.coherence(sp, zero)), 0, 2e-3);
    close(M.measureVisibility({}, sp, 0, { opd: 0.5 * zero }).V, 2 / Math.PI, 3e-3, "sinc(π/2)");
    // side lobe near 1.43 zero has |sinc| ≈ 0.217
    close(M.analyticDegree(sp, 1.4303 * zero / c0), 0.2172, 1e-3);
});

test("sodium doublet: visibility beats with OPD period λ1λ2/Δλ; minimum (r − 1)/(r + 1)", () => {
    const beat = M.SODIUM.D2 * M.SODIUM.D1 / (M.SODIUM.D1 - M.SODIUM.D2);
    close(beat, 581.5e-6, 0.5e-6, "≈ 0.58 mm");
    for (const ratio of [2, 1]) {
        const sp = M.spectrum({ kind: "sodium", dLambda: 0.0005e-9, ratio, tauMax: 2.2 * beat / c0 });
        close(M.coherenceLengths(sp).beatOPD, beat, 1e-12);
        // scan visibility, locate the minima
        const opds = [], V = [];
        for (let i = 0; i <= 440; i++) { const o = i / 200 * beat; opds.push(o); V.push(M.measureVisibility({}, sp, 0, { opd: o }).V); }
        const mins = [];
        for (let i = 1; i < V.length - 1; i++) if (V[i] < V[i - 1] && V[i] <= V[i + 1]) mins.push(i);
        assert.equal(mins.length, 2, "two beat minima in 2.2 periods");
        close(opds[mins[0]], 0.5 * beat, beat / 200, "first minimum at half a period");
        close(opds[mins[1]] - opds[mins[0]], beat, beat / 100, "beat period");
        close(V[mins[0]], (ratio - 1) / (ratio + 1), 5e-3, "minimum visibility for ratio " + ratio);
    }
    // Michelson mirror travel between successive disappearances = beat/2 ≈ 0.29 mm
    close(beat / 2, 0.29e-3, 0.002e-3);
});

test("Wiener–Khinchin: FFT of the sampled spectrum equals the coherence sum and the closed form", () => {
    const sp = M.spectrum({ kind: "gauss", lambda0: 700e-9, dLambda: 20e-9 });
    // place the samples on an FFT grid: γ(τ_m) = Σ w_k e^{i2πν_kτ_m}, τ_m = m/(N δν)
    const N = 4096, dnu = sp.bin[0];
    const re = new Float64Array(N), im = new Float64Array(N);
    for (let k = 0; k < sp.w.length; k++) re[k] = sp.w[k];
    core.fft(re, im, true); // inverse = +i sign; undo the 1/N
    for (const m of [0, 3, 10, 25]) {
        const tau = m / (N * dnu);
        const gFFT = Math.hypot(re[m], im[m]) * N;
        const gSum = core.complex.abs(M.coherence(sp, c0 * tau)) / M.sinc(Math.PI * dnu * tau); // strip bin factor
        close(gFFT, gSum, 1e-12, "FFT vs sum at m=" + m);
        close(gFFT, M.analyticDegree(sp, tau), 1e-9, "FFT vs analytic at m=" + m);
    }
});

test("spectral sampling converges and does not produce spurious revivals", () => {
    const lambda0 = 550e-9, dLambda = 100e-9; // white light
    const dNu = c0 * dLambda / lambda0 ** 2;
    const errs = [];
    for (const n of [61, 121, 241]) {
        const sp = M.spectrum({ kind: "gauss", lambda0, dLambda, maxSamples: n });
        const tau = 0.7 / dNu;
        errs.push(Math.abs(core.complex.abs(M.coherence(sp, c0 * tau)) - M.analyticDegree(sp, tau)));
    }
    assert.ok(errs[1] < errs[0] && errs[2] < errs[1], "error decreases with sample count: " + errs);
    // far outside the coherence length (and beyond c/δν of a coarse grid) the fringe stays washed out
    const coarse = M.spectrum({ kind: "gauss", lambda0, dLambda, maxSamples: 241 });
    const rev = coarse.revivalOPD;
    assert.ok(core.complex.abs(M.coherence(coarse, rev)) < 5e-3, "bin integration suppresses the comb revival");
});

// ---------------------------------------------------------------- spatial coherence and images

test("source size: exact cone average matches brute-force angular quadrature and vanishes at Δ(1 − cos θs) = λ", () => {
    const lam = 633e-9, opd = 0.5e-3;
    const k = 2 * Math.PI / lam;
    for (const ths of [0.01, 0.03, 0.05]) {
        // brute force: average cos(kΔcosθ) and sin over the solid angle of the cone
        let re = 0, im = 0, wsum = 0;
        const n = 20000;
        for (let i = 0; i < n; i++) {
            const th = (i + 0.5) / n * ths, w = Math.sin(th);
            re += w * Math.cos(k * opd * Math.cos(th)); im += w * Math.sin(k * opd * Math.cos(th)); wsum += w;
        }
        const brute = Math.hypot(re, im) / wsum;
        close(M.sourceSizeFactor(lam, opd, ths), brute, 1e-6, "θs = " + ths);
        const sp = M.spectrum({ kind: "mono", lambda0: lam });
        // measured by phase stepping over one fringe: the cone average also shifts the fringe period to
        // 2λ/(1 + cos θs) and varies across the window, so the lock-in estimate carries a small bias
        close(M.measureVisibility({ thetaS: ths }, sp, 0, { opd }).V, brute, 5e-4);
    }
    const thZero = Math.acos(1 - lam / opd);
    close(M.sourceSizeFactor(lam, opd, thZero), 0, 1e-12);
    close(thZero, Math.sqrt(2 * lam / opd), 1e-5, "paraxial Jacquinot: Δθs² = 2λ");
    // an aligned Mach–Zehnder is insensitive to source size
    const sp = M.spectrum({ kind: "mono", lambda0: lam });
    close(M.measureVisibility({ type: "mz", thetaS: 0.05 }, sp, 0, { opd }).V, 1, 1e-9);
});

test("circular fringes: bright rings where Δ cos θ = mλ; tilted fringes have period λ/(2α)", () => {
    const lam = 600e-9, sp = M.spectrum({ kind: "mono", lambda0: lam });
    const cfg = { d: 1e-3, thetaS: 0.04 }; // Δ = 2 mm
    const img = M.detectorImage(cfg, sp, { mode: "circular", nx: 401, fov: 0.04 });
    const rings = M.brightRingAngles(2e-3, lam, 3);
    assert.equal(rings.length, 3);
    close(rings[0], Math.acos(3333 * lam / 2e-3), 1e-12);
    const row = 200; // central row, y ≈ 0
    for (const th of rings) {
        const ix = Math.round((th + 0.04) / 0.08 * 401 - 0.5);
        const v = img.data[row * 401 + ix];
        assert.ok(v > 0.97, "ring at θ = " + th + " is bright: " + v);
    }
    assert.ok(Number.isNaN(img.data[0]), "corners outside the source cone receive no light");
    // tilted: collimated beam, α = 90 µrad → period λ/(2α) = 3.33 mm across a 10 mm beam
    const alpha = 90e-6, D = 10e-3, n = 1000;
    const tilt = M.detectorImage({}, sp, { mode: "tilted", tilt: alpha, beamDiameter: D, nx: n, ny: 3 });
    const line = Array.from(tilt.data.slice(n, 2 * n));
    const maxima = [];
    for (let i = 1; i < n - 1; i++) if (line[i] > line[i - 1] && line[i] >= line[i + 1]) maxima.push(i);
    assert.equal(maxima.length, 3);
    close((maxima[1] - maxima[0]) * D / n, lam / (2 * alpha), 2 * D / n);
});

test("detector image of a broadband source agrees with the direct spectral sum", () => {
    const sp = M.spectrum({ kind: "gauss", lambda0: 550e-9, dLambda: 60e-9 });
    const img = M.detectorImage({}, sp, { mode: "tilted", tilt: 300e-6, beamDiameter: 10e-3, nx: 64, ny: 1 });
    for (const ix of [0, 13, 31, 50, 63]) {
        const x = -5e-3 + (ix + 0.5) / 64 * 10e-3;
        const direct = M.detect({}, sp, { opd: 2 * 300e-6 * x }).P[0];
        close(img.data[ix], direct, 2e-4, "pixel " + ix);
    }
});
