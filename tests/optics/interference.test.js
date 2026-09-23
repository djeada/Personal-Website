const test = require("node:test");
const assert = require("node:assert/strict");
const m = require("../../src/tools/shared/optics/interference.js");

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ""} expected ${b}, got ${a}`);

// Brute-force <E^2> at a fixed point, averaging the summed real fields over
// many optical cycles. Independent of the closed-form two-beam law.
function numericMeanSquare(waves, x, t0, span, n) {
    let s = 0;
    for (let i = 0; i < n; i++) {
        const e = m.superpose(waves, x, t0 + (span * (i + 0.5)) / n);
        s += e * e;
    }
    return s / n;
}

test("non-dispersive medium: w = c k and both waves travel at c", () => {
    const c = 2.25e8;
    const w = m.makeWave(1, 600e-9, 0, c);
    close(w.omega / w.k, c, 1e-3);
    close(w.f * w.lambda, c, 1e-3);
    // Field pattern translates rigidly: E(x + c dt, t + dt) = E(x, t)
    const dt = 3.7e-16;
    close(m.field(w, 1e-7 + c * dt, dt), m.field(w, 1e-7, 0), 1e-9);
});

test("equal coherent waves cancel at phase pi and give 4x single intensity at 0", () => {
    const w1 = m.makeWave(1, 1, 0, 1);
    const w2in = m.makeWave(1, 1, 0, 1);
    const w2out = m.makeWave(1, 1, Math.PI, 1);
    const I1 = numericMeanSquare([w1], 0.3, 0, 10, 4000);
    close(I1, m.singleIntensity(1), 1e-9, "single");
    close(numericMeanSquare([w1, w2in], 0.3, 0, 10, 4000), 4 * I1, 1e-9, "in phase");
    close(numericMeanSquare([w1, w2out], 0.3, 0, 10, 4000), 0, 1e-12, "anti-phase");
    close(m.intensity(w1, w2in, 0.3, 0, 1), 4 * I1, 1e-12);
    close(m.intensity(w1, w2out, 0.3, 0, 1), 0, 1e-12);
    // Instantaneous field also cancels everywhere
    for (const x of [0, 0.17, 0.5, 2.3]) close(m.superpose([w1, w2out], x, 0.41), 0, 1e-12);
});

test("closed-form law matches brute-force <E^2> for arbitrary phase and amplitudes", () => {
    for (const [A2, phi] of [[0.4, 0.7], [1.6, 2.2], [1, 4.0]]) {
        const w1 = m.makeWave(1, 1, 0, 1);
        const w2 = m.makeWave(A2, 1, phi, 1);
        close(m.intensity(w1, w2, 0.8, 0, 1), numericMeanSquare([w1, w2], 0.8, 0, 20, 8000), 1e-9);
    }
});

test("unequal amplitudes leave a nonzero minimum (A1 - A2)^2 / 2", () => {
    const w1 = m.makeWave(1, 1, 0, 1);
    const w2 = m.makeWave(0.5, 1, Math.PI, 1);
    const Imin = numericMeanSquare([w1, w2], 0, 0, 10, 4000);
    assert.ok(Imin > 0.1);
    close(Imin, 0.5 * 0.5 * 0.5, 1e-9);
    const ext = m.intensityExtremes(1, 0.5, 1, 0, 0);
    close(ext.Imin, Imin, 1e-9);
    close(m.predictedVisibility(1, 0.5, 1, 0, 0), m.visibility(ext.Imax, ext.Imin), 1e-12);
    close(m.predictedVisibility(1, 0.5, 1, 0, 0), 0.8, 1e-12); // 2*0.5/(1+0.25)
});

test("coherence |gamma| scales the cross term; incoherent beams add intensities", () => {
    close(m.twoBeamIntensity(1, 1, 0, 0), 2, 1e-12);
    close(m.twoBeamIntensity(1, 1, Math.PI, 0.5), 1, 1e-12);
    close(m.predictedVisibility(1, 1, 0.3, 0, 0), 0.3, 1e-12);
    assert.throws(() => m.twoBeamIntensity(1, 1, 0, 1.5), RangeError);
});

test("two frequencies produce an intensity beat at |df| at a fixed probe", () => {
    const w1 = m.makeWave(1, 1, 0, 1);
    const w2 = m.makeWave(1, 1.1, 0, 1); // f2 = 1/1.1
    const df = Math.abs(w2.f - w1.f);
    const b = m.beat(w1, w2);
    close(b.fBeat, df, 1e-12);
    close(b.groupVelocity, 1, 1e-12);
    // Brute force: short-window <E^2> at x = 0.37, sampled across several beats.
    const x = 0.37, win = 1, N = 400, span = 5 / df;
    const tr = [];
    for (let i = 0; i < N; i++) {
        const t = (span * i) / N;
        tr.push(numericMeanSquare([w1, w2], x, t, win, 200));
    }
    const mean = tr.reduce((a, v) => a + v, 0) / N;
    // DFT: strongest non-DC component
    let best = 0, bestF = 0;
    for (let j = 1; j < N / 4; j++) {
        const f = j / span;
        let re = 0, im = 0;
        for (let i = 0; i < N; i++) {
            const t = (span * i) / N;
            re += (tr[i] - mean) * Math.cos(2 * Math.PI * f * t);
            im += (tr[i] - mean) * Math.sin(2 * Math.PI * f * t);
        }
        const p = re * re + im * im;
        if (p > best) { best = p; bestF = f; }
    }
    close(bestF, df, 1e-9);
    // Model detector with small T also swings between ~0 and ~4 I1 once per 1/df.
    const Is = [];
    for (let i = 0; i < 1000; i++) Is.push(m.detectedIntensity(w1, w2, x, (i / 1000) / df, 0, 1));
    const v = m.visibilityFromSamples(Is);
    close(v.Imax, 4 * m.singleIntensity(1), 1e-4);
    close(v.Imin, 0, 1e-4);
    // Same intensity at t and t + 1/df
    close(m.detectedIntensity(w1, w2, x, 2.3, 0), m.detectedIntensity(w1, w2, x, 2.3 + 1 / df, 0), 1e-9);
});

test("equal frequencies give a steady intensity at a fixed probe (no temporal beat)", () => {
    const w1 = m.makeWave(1, 1, 0, 1);
    const w2 = m.makeWave(0.7, 1, 1.1, 1);
    const I0 = m.detectedIntensity(w1, w2, 0.2, 0, 0);
    for (const t of [0.3, 5, 17.2]) close(m.detectedIntensity(w1, w2, 0.2, t, 0), I0, 1e-12);
    assert.equal(m.beat(w1, w2).fBeat, 0);
});

test("long detector integration averages the beat cross term away", () => {
    const w1 = m.makeWave(1, 1, 0, 1);
    const w2 = m.makeWave(1, 1.1, 0, 1);
    const TB = m.beat(w1, w2).TBeat;
    const sum = m.singleIntensity(1) * 2;
    // Integer number of beat periods: exactly I1 + I2
    close(m.detectedIntensity(w1, w2, 0.37, 50, 3 * TB, 1), sum, 1e-9);
    close(m.predictedVisibility(1, 1, 1, w2.omega - w1.omega, 3 * TB), 0, 1e-9);
    // Brute-force boxcar of the cycle-averaged intensity agrees
    let acc = 0;
    const n = 20000, T = 3 * TB, t = 50;
    for (let i = 0; i < n; i++) acc += m.intensity(w1, w2, 0.37, t - T + (T * (i + 0.5)) / n, 1);
    close(acc / n, sum, 1e-6);
    // Arbitrary long window: residual fringe contrast decays like 1/T
    for (const T2 of [37.3 * TB, 211.7 * TB]) {
        const V = m.predictedVisibility(1, 1, 1, w2.omega - w1.omega, T2);
        assert.ok(V <= TB / (Math.PI * T2) + 1e-12, `V=${V}`);
    }
    // Brute force check of detected reading for a non-integer window
    const T3 = 2.4 * TB;
    acc = 0;
    for (let i = 0; i < n; i++) acc += m.intensity(w1, w2, 0.37, t - T3 + (T3 * (i + 0.5)) / n, 1);
    close(m.detectedIntensity(w1, w2, 0.37, t, T3, 1), acc / n, 1e-6);
});

test("phasor projection equals the field and the resultant is the vector sum", () => {
    const w1 = m.makeWave(1, 1, 0, 1);
    const w2 = m.makeWave(1.3, 0.8, 0.9, 1);
    const x = 0.61, t = 3.2;
    const r = m.resultantPhasor([w1, w2], x, t);
    close(r.re, m.superpose([w1, w2], x, t), 1e-12);
    // |resultant|^2 / 2 is the cycle-averaged (slow) intensity for coherent waves
    close(0.5 * r.magnitude * r.magnitude, m.intensity(w1, w2, x, t, 1), 1e-12);
});

// ---------- complex degree of coherence ----------

// Deterministic phase-jitter ensemble: delta uniformly spread over [a - w/2, a + w/2].
function jitterSamples(a, w, n) {
    const out = [];
    for (let i = 0; i < n; i++) out.push(a - w / 2 + (w * (i + 0.5)) / n);
    return out;
}

test("gamma = <exp(i delta)>: uniform phase jitter gives |gamma| = sinc(w/2), arg = mean phase", () => {
    for (const [a, w] of [[0, 0], [0.6, 1.2], [-2.0, 3.0], [1.1, 2 * Math.PI]]) {
        const g = m.gammaFromPhaseSamples(jitterSamples(a, w, 4000));
        close(g.mag, Math.abs(m.sinc(w / 2)), 1e-6, `|gamma| w=${w}`);
        if (g.mag > 1e-6) close(Math.cos(g.arg - a), 1, 1e-9, "arg gamma");
    }
    // Full 2 pi jitter: incoherent
    assert.ok(m.gammaFromPhaseSamples(jitterSamples(0.3, 2 * Math.PI, 1000)).mag < 1e-9);
});

test("ensemble-averaged brute-force intensity equals the complex-gamma two-beam law", () => {
    // Each realization is a coherent pair with extra relative phase delta; <E^2> is
    // computed by brute force for every realization and then averaged over the ensemble.
    const a = 0.9, w = 2.0;
    const deltas = jitterSamples(a, w, 64);
    const g = m.gammaFromPhaseSamples(deltas);
    for (const [A2, phi] of [[1, 0], [0.6, 1.3], [1.4, -2.2]]) {
        let acc = 0;
        for (const d of deltas) {
            const w1 = m.makeWave(1, 1, 0, 1), w2 = m.makeWave(A2, 1, phi + d, 1);
            acc += numericMeanSquare([w1, w2], 0.25, 0, 5, 1000);
        }
        const I = m.twoBeamIntensity(0.5, 0.5 * A2 * A2, phi, g);
        close(acc / deltas.length, I, 1e-9, `A2=${A2} phi=${phi}`);
    }
});

test("arg(gamma) shifts the fringes by -arg(gamma) without changing their visibility", () => {
    for (const arg of [0, 0.7, Math.PI / 2, -2.4]) {
        let best = -Infinity, bestPhi = 0;
        const Is = [];
        for (let i = 0; i < 3600; i++) {
            const dphi = (2 * Math.PI * i) / 3600;
            const I = m.twoBeamIntensity(1, 0.36, dphi, { mag: 0.8, arg });
            Is.push(I);
            if (I > best) { best = I; bestPhi = dphi; }
        }
        close(Math.cos(bestPhi + arg), 1, 1e-5, `peak shift arg=${arg}`);
        const v = m.visibilityFromSamples(Is);
        close(v.V, m.predictedVisibility(Math.sqrt(2), Math.sqrt(0.72), 0.8, 0, 0), 1e-6);
    }
});

test("hermitian symmetry: swapping beams conjugates gamma and leaves I unchanged", () => {
    const g = { mag: 0.55, arg: 1.2 };
    for (const d of [0, 0.4, 2.9, -1.7]) {
        close(m.twoBeamIntensity(0.3, 0.8, d, g), m.twoBeamIntensity(0.8, 0.3, -d, { mag: g.mag, arg: -g.arg }), 1e-12);
    }
});

test("energy conservation: averaging over all relative phases gives I1 + I2 for any gamma", () => {
    const n = 720;
    for (const g of [1, 0.3, { mag: 0.9, arg: 2.1 }]) {
        let acc = 0;
        for (let i = 0; i < n; i++) acc += m.twoBeamIntensity(0.7, 0.2, (2 * Math.PI * i) / n, g);
        close(acc / n, 0.9, 1e-12);
    }
});

// ---------- polarization overlap ----------

// Brute-force <|E|^2> for two transverse vector fields, beam 1 along x, beam 2 at angle theta.
function vectorMeanSquare(A1, A2, phi, theta, n) {
    let s = 0;
    for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n; // one period (T = 1)
        const e1 = A1 * Math.cos(-2 * Math.PI * t);
        const e2 = A2 * Math.cos(-2 * Math.PI * t + phi);
        const ex = e1 + e2 * Math.cos(theta), ey = e2 * Math.sin(theta);
        s += ex * ex + ey * ey;
    }
    return s / n;
}

test("vector fields: cross term scales with cos(theta) of the angle between linear polarizations", () => {
    for (const theta of [0, 0.4, Math.PI / 4, Math.PI / 2, 2.2, Math.PI]) {
        for (const [A2, phi] of [[1, 0], [0.7, 1.9], [1.3, Math.PI]]) {
            const brute = vectorMeanSquare(1, A2, phi, theta, 2000);
            const I = m.twoBeamIntensity(0.5, 0.5 * A2 * A2, phi, m.crossFactor(1, m.polarizationOverlap(theta)));
            close(I, brute, 1e-12, `theta=${theta} A2=${A2} phi=${phi}`);
            // Component decomposition: <par^2 + perp^2> is the same quantity
            const w1 = m.makeWave(1, 1, 0, 1), w2 = m.makeWave(A2, 1, phi, 1);
            let acc = 0;
            for (let i = 0; i < 2000; i++) {
                const c = m.fieldComponents(w1, w2, 0, (i + 0.5) / 2000, theta);
                acc += c.par * c.par + c.perp * c.perp;
            }
            close(acc / 2000, brute, 1e-12);
        }
    }
});

test("Fresnel-Arago: orthogonal polarizations never interfere; the sum is steady", () => {
    const mu = m.crossFactor(1, m.polarizationOverlap(Math.PI / 2));
    assert.ok(mu.mag < 1e-15);
    for (const d of [0, 1, Math.PI]) close(m.twoBeamIntensity(0.5, 0.5, d, mu), 1, 1e-12);
    close(m.predictedVisibility(1, 1, mu.mag, 0, 0), 0, 1e-15);
    // Antiparallel polarization (theta = pi) flips the fringes: max where co-polarized has a min
    const anti = m.crossFactor(1, m.polarizationOverlap(Math.PI));
    close(m.twoBeamIntensity(0.5, 0.5, Math.PI, anti), 2, 1e-12);
});

test("Jones overlap: linear states give cos(theta), circular states are orthogonal, |p| <= 1", () => {
    for (const th of [0, 0.3, 1.2, 2.5]) {
        const p = m.jonesOverlap(m.linearJones(0.4), m.linearJones(0.4 + th));
        close(p.re, Math.cos(th), 1e-12);
        close(p.im, 0, 1e-12);
    }
    const s = Math.SQRT1_2;
    const R = [{ re: s, im: 0 }, { re: 0, im: s }], L = [{ re: s, im: 0 }, { re: 0, im: -s }];
    const pRL = m.jonesOverlap(R, L);
    close(Math.hypot(pRL.re, pRL.im), 0, 1e-12);
    // linear x with circular: |p| = 1/sqrt(2), and it multiplies gamma as a complex number
    const pxR = m.jonesOverlap(m.linearJones(0), R);
    close(Math.hypot(pxR.re, pxR.im), s, 1e-12);
    const mu = m.crossFactor({ mag: 0.5, arg: 0.3 }, { re: 0, im: 1 });
    close(mu.mag, 0.5, 1e-12);
    close(mu.arg, 0.3 + Math.PI / 2, 1e-12);
    assert.throws(() => m.crossFactor(1, 1.2), RangeError);
});

test("analyser after orthogonal beams restores fringes (Malus projection) with full visibility at 45 deg", () => {
    const b = m.detectorBeams(1, 1, Math.PI / 2, Math.PI / 4);
    close(b.A1, Math.SQRT1_2, 1e-12);
    close(b.A2, Math.SQRT1_2, 1e-12);
    assert.equal(b.overlap, 1);
    close(m.predictedVisibility(b.A1, b.A2, m.crossFactor(1, b.overlap).mag, 0, 0), 1, 1e-12);
    // Brute force: project the vector field on the analyser axis and average
    const al = Math.PI / 4, n = 2000;
    for (const phi of [0, Math.PI, 1.1]) {
        let acc = 0;
        for (let i = 0; i < n; i++) {
            const t = (i + 0.5) / n;
            const e1 = Math.cos(-2 * Math.PI * t), e2 = Math.cos(-2 * Math.PI * t + phi);
            const proj = e1 * Math.cos(al) + e2 * Math.sin(al); // beam 2 along y
            acc += proj * proj;
        }
        const I = m.twoBeamIntensity(m.singleIntensity(b.A1), m.singleIntensity(b.A2), phi, m.crossFactor(1, b.overlap));
        close(I, acc / n, 1e-12, `phi=${phi}`);
    }
    // Analyser at -45 deg: overlap sign flips (fringes shifted by pi)
    const b2 = m.detectorBeams(1, 1, Math.PI / 2, -Math.PI / 4);
    assert.equal(b2.overlap, -1);
    // Analyser crossed with beam 2 transmits beam 1 only (Malus cos^2)
    const b3 = m.detectorBeams(1, 1, Math.PI / 2, 0.3);
    close(m.singleIntensity(b3.A1), 0.5 * Math.cos(0.3) ** 2, 1e-12);
    // No analyser: overlap is cos(theta), amplitudes untouched
    const b4 = m.detectorBeams(1, 0.5, 1.0, null);
    close(b4.overlap, Math.cos(1.0), 1e-15);
    assert.equal(b4.A2, 0.5);
});

test("visibility factorises: V = V_amplitude * |gamma| * |cos theta| * |sinc(dw T/2)|", () => {
    const w1 = m.makeWave(1, 1, 0, 1), w2 = m.makeWave(0.6, 1.1, 0, 1);
    const dOmega = w2.omega - w1.omega;
    const theta = 0.8, g = { mag: 0.7, arg: -1.0 }, T = 3.3;
    const mu = m.crossFactor(g, m.polarizationOverlap(theta));
    const Is = [];
    const TB = m.beat(w1, w2).TBeat;
    for (let i = 0; i < 4000; i++) Is.push(m.detectedIntensity(w1, w2, 0.2, 40 + (TB * i) / 4000, T, mu));
    const Vnum = m.visibilityFromSamples(Is).V;
    const Vamp = (2 * 0.6) / (1 + 0.36);
    close(Vnum, Vamp * 0.7 * Math.abs(Math.cos(theta)) * Math.abs(m.sinc((dOmega * T) / 2)), 1e-5);
});
