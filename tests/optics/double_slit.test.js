const test = require("node:test");
const assert = require("node:assert/strict");
const m = require("../../src/tools/shared/optics/doubleSlit.js");

const textbook = { wavelength: 500e-9, slitSeparation: 0.25e-3, slitWidth: 0.05e-3, distance: 1 };

function close(actual, expected, tol, msg) {
    assert.ok(Math.abs(actual - expected) <= tol, `${msg || ""} expected ${expected} ± ${tol}, got ${actual}`);
}

test("acceptance: paraxial fringe spacing 2 mm and envelope first zero 10 mm", () => {
    close(m.paraxialFringeSpacing(textbook), 2e-3, 1e-12);
    close(m.paraxialEnvelopeZero(textbook), 10e-3, 1e-12);
    // exact-angle envelope zero agrees with paraxial value at this small angle
    close(m.envelopeZero(textbook), 10e-3, 1e-6);
    // intensity actually vanishes there
    assert.ok(m.intensityAtY(m.envelopeZero(textbook), textbook) < 1e-20);
});

test("sampled array gives measured spacing ≈ 2 mm and unit visibility", () => {
    const s = m.sampleScreen(textbook, 15e-3);
    const r = m.analyzeSample(s);
    close(r.measuredSpacing, 2e-3, 2e-6, "measured spacing");
    close(r.measuredVisibility, 1, 1e-6, "visibility");
    // on axis equals reference 4 (two coherent equal slits)
    close(s.intensity[(s.n - 1) / 2], 4, 1e-12);
    close(s.peak, 4, 1e-12);
});

test("equal coherent baseline equals cos² of half the phase difference times sinc²", () => {
    // dark fringe at half-integer path difference: d sinθ = λ/2
    const sinT = textbook.wavelength / (2 * textbook.slitSeparation);
    const y = textbook.distance * Math.tan(Math.asin(sinT));
    assert.ok(m.normalizedBaselineAtY(y, textbook) < 1e-20);
    close(m.normalizedBaselineAtY(0, textbook), 1, 1e-15);
    // first order bright fringe sits at d sinθ = λ, reduced only by the envelope
    const s1 = textbook.wavelength / textbook.slitSeparation;
    const y1 = textbook.distance * Math.tan(Math.asin(s1));
    const beta = Math.PI * textbook.slitWidth * s1 / textbook.wavelength;
    close(m.normalizedBaselineAtY(y1, textbook), (Math.sin(beta) / beta) ** 2, 1e-12);
});

test("blocking either slit leaves exactly the single-slit envelope (no fringes)", () => {
    for (const blocked of [{ slit1: false }, { slit2: false }]) {
        const p = Object.assign({}, textbook, blocked);
        const s = m.sampleScreen(p, 15e-3);
        for (let i = 0; i < s.n; i += 37) {
            const sinT = Math.sin(Math.atan(s.y[i] / p.distance));
            const beta = Math.PI * p.slitWidth * sinT / p.wavelength;
            const env = beta === 0 ? 1 : (Math.sin(beta) / beta) ** 2;
            close(s.intensity[i] / s.peak, env, 1e-9);
        }
        // one slit carries a quarter of the two-slit on-axis intensity
        close(s.peak / s.reference, 0.25, 1e-12);
        assert.equal(m.analyzeSample(s).measuredVisibility, 0);
        assert.equal(m.theoreticalVisibility(p), 0);
    }
});

test("slits must not overlap", () => {
    assert.throws(() => m.intensityAtY(0, Object.assign({}, textbook, { slitWidth: 0.3e-3 })), RangeError);
    assert.throws(() => m.intensityAtY(0, Object.assign({}, textbook, { slitWidth: 0.25e-3 })), RangeError);
    assert.ok(m.maxSlitWidth(0.25e-3) < 0.25e-3);
});

test("subwavelength separation has no off-axis orders", () => {
    const p = { wavelength: 500e-9, slitSeparation: 400e-9, slitWidth: 100e-9, distance: 0.05 };
    assert.equal(m.maxPhysicalOrder(p), 0);
    const orders = m.interferenceOrders(p);
    assert.deepEqual(orders.map((o) => o.m), [0]);
    // the whole half-space is sampled with a very wide screen: only one maximum exists
    const s = m.sampleScreen(p, 50, { minSamples: 20001 });
    const maxima = m.localMaxima(s);
    assert.equal(maxima.length, 1);
    close(maxima[0].y, 0, s.dy);
});

test("orders are limited by |m| λ/d < 1 and missing orders coincide with envelope zeros", () => {
    const p = { wavelength: 500e-9, slitSeparation: 1.2e-6, slitWidth: 0.4e-6, distance: 0.1 };
    assert.equal(m.maxPhysicalOrder(p), 2);
    const orders = m.interferenceOrders(p).map((o) => o.m);
    assert.deepEqual(orders, [-2, -1, 0, 1, 2]);
    // d = λ exactly: first order would be grazing (θ = 90°) and never reaches a screen
    assert.equal(m.maxPhysicalOrder({ wavelength: 500e-9, slitSeparation: 500e-9, slitWidth: 100e-9, distance: 1 }), 0);
    // textbook d/λ = 500 exactly: m = ±500 would be grazing, so ±499 is the highest
    assert.equal(m.maxPhysicalOrder(textbook), 499);
    assert.equal(Math.max(...m.interferenceOrders(textbook).map((o) => o.m)), 499);
    // d/a = 5 → 5th order missing
    const missing = m.interferenceOrders(textbook).filter((o) => o.missing).map((o) => Math.abs(o.m));
    assert.ok(missing.includes(5) && missing.includes(10));
});

test("partial coherence and unequal illumination give the textbook visibility", () => {
    const p = Object.assign({}, textbook, { amplitudeRatio: 0.5, coherence: 0.6 });
    const V = (2 * 0.5 * 0.6) / (1 + 0.25);
    close(m.theoreticalVisibility(p), V, 1e-12);
    const s = m.sampleScreen(p, 3e-3);
    // envelope is ~flat in the central fringe, so measured visibility is close to theory
    close(m.analyzeSample(s).measuredVisibility, V, 0.02);
    // incoherent sum: no fringes, intensities add
    const inc = Object.assign({}, textbook, { coherence: 0 });
    close(m.intensityAtY(1e-3, inc), m.intensityAtY(1e-3, Object.assign({}, textbook, { slit2: false })) * 2, 1e-12);
});

test("relative phase π swaps bright and dark fringes and shifts orders", () => {
    const p = Object.assign({}, textbook, { relativePhase: Math.PI });
    assert.ok(m.intensityAtY(0, p) < 1e-20);
    const orders = m.interferenceOrders(p, 5e-3);
    close(Math.min(...orders.map((o) => Math.abs(o.y))), 1e-3, 1e-8);
});

test("energy: integrated two-slit incoherent-free pattern equals twice one slit (cross term averages out)", () => {
    // Over many fringes inside the envelope, the coherent pattern integrates to the incoherent sum.
    const both = m.sampleScreen(textbook, 0.2, { maxSamples: 400001, samplesPerFringe: 40 });
    const one = m.sampleScreen(Object.assign({}, textbook, { slit2: false }), 0.2, { maxSamples: 400001, samplesPerFringe: 40 });
    const sum = (a) => a.reduce((x, v) => x + v, 0);
    close(sum(both.intensity) / sum(one.intensity), 2, 0.01);
});

// ---------------------------------------------------------------- symmetry and limiting cases
const core = require("../../src/tools/shared/optics/core.js");

test("symmetry: I(y) = I(−y) for φ = 0 (any amplitudes/coherence); φ → −φ mirrors the pattern", () => {
    const p = Object.assign({}, textbook, { amplitudeRatio: 0.3, coherence: 0.7 });
    for (const y of [0.37e-3, 1.9e-3, 7.3e-3, 12e-3]) {
        close(m.intensityAtY(y, p), m.intensityAtY(-y, p), 1e-12);
        const a = Object.assign({}, p, { relativePhase: 1.1 });
        const b = Object.assign({}, p, { relativePhase: -1.1 });
        close(m.intensityAtY(y, a), m.intensityAtY(-y, b), 1e-12);
    }
});

test("limit a → 0: envelope becomes flat and the pattern tends to pure 4cos²(π d sinθ/λ)", () => {
    const p = { wavelength: 500e-9, slitSeparation: 0.25e-3, slitWidth: 1e-9, distance: 1 };
    for (const y of [0, 0.5e-3, 3.3e-3, 40e-3]) {
        const s = Math.sin(Math.atan(y / p.distance));
        const pure = 4 * Math.cos(Math.PI * p.slitSeparation * s / p.wavelength) ** 2;
        close(m.intensityAtY(y, p), pure, 1e-6);
    }
    assert.equal(m.envelopeZero(p), Infinity);
});

test("limit γ → 0 and A₂ → 0: visibility → 0 continuously; V is linear in |γ|", () => {
    const V = (g) => m.theoreticalVisibility(Object.assign({}, textbook, { coherence: g }));
    close(V(0), 0, 0);
    close(V(0.25) * 2, V(0.5), 1e-15);
    const Va = (r) => m.theoreticalVisibility(Object.assign({}, textbook, { amplitudeRatio: r }));
    assert.ok(Va(1e-3) < 3e-3);
    close(Va(1), 1, 1e-15);
});

test("large angles: exact maxima follow d sinθ = mλ, not the paraxial λL/d", () => {
    // d = 2λ → first order at 30°, paraxial estimate is wrong by ~15 %
    const p = { wavelength: 500e-9, slitSeparation: 1e-6, slitWidth: 0.2e-6, distance: 0.01 };
    const orders = m.interferenceOrders(p);
    const o1 = orders.find((o) => o.m === 1);
    close(o1.y, 0.01 * Math.tan(Math.PI / 6), 1e-12);
    const s = m.sampleScreen(p, 0.02, { minSamples: 40001 });
    // zeros of the cos² factor are exact (the sloping envelope pulls maxima inward, not zeros):
    // d sinθ = (m + ½)λ → sinθ = 0.25, 0.75
    const minima = m.localMinima(s).filter((x) => x.y > 1e-4).map((x) => x.y);
    close(minima[0], 0.01 * Math.tan(Math.asin(0.25)), 2 * s.dy, "rendered 1st dark fringe at exact angle");
    close(minima[1], 0.01 * Math.tan(Math.asin(0.75)), 2 * s.dy, "rendered 2nd dark fringe at exact angle");
    assert.ok(Math.abs(m.paraxialFringeSpacing(p) - o1.y) / o1.y > 0.1);
});

test("convergence: measured fringe spacing converges as sampling is refined", () => {
    const errs = [6, 12, 48].map((spf) => {
        const s = m.sampleScreen(textbook, 6e-3, { samplesPerFringe: spf, minSamples: 3 });
        return Math.abs(m.analyzeSample(s).measuredSpacing - 2e-3);
    });
    assert.ok(errs[2] <= errs[0] + 1e-12);
    assert.ok(errs[2] < 1e-6);
});

test("validity: Fresnel-number regimes and far-field distance", () => {
    assert.equal(m.validity(textbook, 15e-3).regime, "far"); // N_F = 0.045
    close(m.validity(textbook, 15e-3).fresnelNumber, 0.045, 1e-12);
    assert.equal(m.validity(Object.assign({}, textbook, { distance: 0.1 }), 1e-3).regime, "marginal");
    assert.equal(m.validity(Object.assign({}, textbook, { distance: 0.01 }), 1e-3).regime, "near");
    const Lf = m.validity(textbook, 1e-3).minFarFieldDistance;
    close(m.fresnelNumber(Object.assign({}, textbook, { distance: Lf })), 0.1, 1e-12);
    assert.equal(m.validity(textbook, 15e-3).paraxialOK, true);
    assert.equal(m.validity(textbook, 0.5).paraxialOK, false);
    assert.equal(m.validity({ wavelength: 500e-9, slitSeparation: 0.4e-6, slitWidth: 0.1e-6, distance: 1 }, 1).subwavelengthSeparation, true);
});

// ---------------------------------------------------------------- photon-count view
test("detections: reproducible with a seed, conserve N, and expected counts match an independent integral", () => {
    const s = m.sampleScreen(textbook, 6e-3);
    const h1 = m.detectionHistogram(s, 5000, 60, core.createRng(7));
    const h2 = m.detectionHistogram(s, 5000, 60, core.createRng(7));
    assert.deepEqual(Array.from(h1.counts), Array.from(h2.counts));
    assert.equal(h1.counts.reduce((a, b) => a + b, 0), 5000);
    close(h1.expected.reduce((a, b) => a + b, 0), 5000, 1e-6);
    assert.equal(h1.positions.length, 5000);
    // independent Simpson integral of the model over one bin vs. the whole screen
    const simpson = (a, b, n) => {
        const h = (b - a) / n; let acc = m.intensityAtY(a, textbook) + m.intensityAtY(b, textbook);
        for (let i = 1; i < n; i++) acc += (i % 2 ? 4 : 2) * m.intensityAtY(a + i * h, textbook);
        return acc * h / 3;
    };
    const tot = simpson(-6e-3, 6e-3, 20000);
    for (const b of [0, 17, 30, 44]) {
        const exp = 5000 * simpson(h1.edges[b], h1.edges[b + 1], 400) / tot;
        close(h1.expected[b], exp, 5000 * 2e-4, "bin " + b);
    }
});

test("detections: histogram converges to the intensity (χ²/dof ≈ 1) and loses fringes when |γ| = 0", () => {
    const s = m.sampleScreen(textbook, 6e-3);
    const h = m.detectionHistogram(s, 200000, 48, core.createRng(3), { keepPositions: 0 });
    assert.equal(h.positions, null);
    let chi2 = 0, dof = 0;
    for (let b = 0; b < h.nBins; b++) if (h.expected[b] > 20) { chi2 += (h.counts[b] - h.expected[b]) ** 2 / h.expected[b]; dof++; }
    assert.ok(chi2 / dof < 2 && chi2 / dof > 0.3, "chi2/dof = " + chi2 / dof);
    // incoherent slits: every bin within the central lobe is near the (flat-ish) envelope
    const inc = m.sampleScreen(Object.assign({}, textbook, { coherence: 0 }), 2e-3);
    const hi = m.detectionHistogram(inc, 100000, 20, core.createRng(5));
    const mean = 100000 / 20;
    for (const c of hi.counts) assert.ok(Math.abs(c - mean) / mean < 0.1);
});
