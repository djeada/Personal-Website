"use strict";
// Benchmarks for the diffraction grating / spectrometer model (src/tools/shared/optics/grating.js).
// Tolerances: analytic identities near machine precision (1e-12); quadrature / sampled-curve
// measurements within their stated sampling resolution.
const test = require("node:test");
const assert = require("node:assert/strict");
const G = require("../../src/tools/shared/optics/grating.js");

const NM = 1e-9, UM = 1e-6, MM = 1e-3, DEG = Math.PI / 180;
const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ""} expected ${b}, got ${a} (tol ${tol})`);
const rel = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol * Math.abs(b), `${msg || ""} expected ${b}, got ${a} (rel ${tol})`);

// brute-force N·M point-source sum with an explicit double loop (independent of the model)
function bruteSum(s, lam, N, d, a, M) {
    const k = 2 * Math.PI / lam;
    let re = 0, im = 0;
    for (let n = 0; n < N; n++) for (let j = 0; j < M; j++) {
        const x = n * d - a / 2 + (j + 0.5) * a / M;
        re += Math.cos(k * s * x); im += Math.sin(k * s * x);
    }
    return (re * re + im * im) / (N * N * M * M);
}

// locate the principal maximum near s0 by golden-section on the computed intensity
function peakNear(f, s0, halfWidth) {
    let a = s0 - halfWidth, b = s0 + halfWidth;
    const r = (Math.sqrt(5) - 1) / 2;
    for (let i = 0; i < 200; i++) {
        const c = b - r * (b - a), d = a + r * (b - a);
        if (f(c) > f(d)) b = d; else a = c;
    }
    return 0.5 * (a + b);
}

test("array factor is finite and exactly 1 in magnitude at every principal maximum", () => {
    for (const N of [1, 2, 3, 7, 100, 1001, 20000]) {
        for (const m of [-5, -1, 0, 1, 2, 17]) {
            for (const off of [0, 1e-15, -1e-13, 1e-10]) {
                const af = G.arrayFactorQ(m + off, N);
                assert.ok(Number.isFinite(af), `N=${N} m=${m}`);
                close(Math.abs(af), 1, 1e-6 * N * N * Math.abs(off) + 1e-12, `|AF| N=${N} m=${m} off=${off}`);
            }
            // sign (−1)^{m(N−1)} matches the explicit phasor sum Σ e^{2iβn}/N rotated to the centre
            const af = G.arrayFactorQ(m, N);
            assert.equal(Math.sign(af), (Math.abs(m) * (N - 1)) % 2 === 0 ? 1 : -1);
        }
    }
    // continuity through the Taylor switch-over
    for (const N of [5, 400]) {
        const e = 1e-4 / (N * Math.PI); // |Nε| = 1e-4 is where the series takes over
        const q1 = 3 + e * (1 - 1e-6), q2 = 3 + e * (1 + 1e-6);
        close(G.arrayFactorQ(q1, N), G.arrayFactorQ(q2, N), 1e-13);
    }
});

test("array factor equals the explicit phasor sum |Σ exp(2iβn)|/N for random β", () => {
    const rng = (() => { let s = 12345; return () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648); })();
    for (let t = 0; t < 200; t++) {
        const N = 1 + Math.floor(rng() * 60), beta = (rng() - 0.5) * 40;
        let re = 0, im = 0;
        for (let n = 0; n < N; n++) { re += Math.cos(2 * beta * n); im += Math.sin(2 * beta * n); }
        close(Math.abs(G.arrayFactor(beta, N)), Math.hypot(re, im) / N, 1e-12);
    }
});

test("analytic pattern agrees with a brute-force N×M point-source sum (converges with M)", () => {
    const g = { N: 6, d: 4 * UM, a: 1.3 * UM }, lam = 633 * NM;
    let worst16 = 0, worst128 = 0;
    for (let i = 0; i <= 400; i++) {
        const s = -0.9 + 1.8 * i / 400;
        const ref = G.intensityS(s, lam, g);
        worst16 = Math.max(worst16, Math.abs(bruteSum(s, lam, g.N, g.d, g.a, 16) - ref));
        worst128 = Math.max(worst128, Math.abs(bruteSum(s, lam, g.N, g.d, g.a, 128) - ref));
    }
    assert.ok(worst128 < 2e-5, "M = 128 deviation " + worst128);
    assert.ok(worst128 < worst16 / 30, "midpoint rule converges ~M⁻²");
    // model's factorised direct sum = brute force
    close(G.directSum(0.1234, lam, g, 40), bruteSum(0.1234, lam, g.N, g.d, g.a, 40), 1e-12);
    // crossCheck on a big grating stays tiny (UI readout)
    const big = { N: 3000, d: 1 / 600 * MM, a: 0.6 / 600 * MM };
    const ss = Array.from({ length: 50 }, (_, i) => 0.3 + i * 1e-5);
    assert.ok(G.crossCheck(ss, 589 * NM, big, 64) < 1e-4);
});

test("limiting cases: N = 1 is the single slit, N = 2 is Young's double slit", () => {
    const lam = 500 * NM, d = 5 * UM, a = 1 * UM;
    for (let i = 1; i < 200; i++) {
        const s = i / 200 * 0.8;
        const alpha = Math.PI * a * s / lam, beta = Math.PI * d * s / lam;
        const ss = (Math.sin(alpha) / alpha) ** 2;
        close(G.intensityS(s, lam, { N: 1, d, a }), ss, 1e-12);
        close(G.intensityS(s, lam, { N: 2, d, a }), ss * Math.cos(beta) ** 2, 1e-12);
    }
});

test("normal incidence: numerically located maxima obey d sin θm = mλ", () => {
    const d = 1 / 600 * MM, lam = 589 * NM;
    const orders = G.allowedOrders(lam, d, 0);
    assert.deepEqual(orders, [-2, -1, 0, 1, 2]); // sin θ3 = 1.06 is excluded
    // The sloping single-slit envelope pulls the maximum of the product off β = mπ by O(1/N²),
    // so the measured peak converges to the grating equation as N grows.
    const offset = (N, m) => {
        const g = { N, d, a: 0.4 * d }, w = lam / (N * d);
        const sPk = peakNear((s) => G.intensityS(s, lam, g), m * lam / d + 0.3 * w, 0.8 * w);
        return d * sPk - m * lam;
    };
    for (const m of orders) {
        assert.ok(Math.abs(offset(3000, m)) < 1e-7 * lam, `order ${m}: ${offset(3000, m)}`);
        const th = G.orderAngle(m, lam, d, 0);
        close(d * Math.sin(th), m * lam, 1e-20);
    }
    const r = offset(100, 2) / offset(1000, 2);
    assert.ok(r > 50 && r < 200, "envelope shift scales ~1/N²: ratio " + r);
    assert.ok(Number.isNaN(G.orderAngle(3, lam, d, 0)));
});

test("oblique incidence: maxima obey d(sin θm − sin θi) = mλ and zero order is undeviated", () => {
    const g = { N: 3000, d: 2.5 * UM, a: 0.8 * UM }, lam = 700 * NM, ti = 25 * DEG;
    const orders = G.allowedOrders(lam, g.d, ti);
    assert.deepEqual(orders, [-5, -4, -3, -2, -1, 0, 1, 2]);
    for (const m of orders) {
        const sn = Math.sin(ti) + m * lam / g.d;
        const thGuess = Math.asin(sn), w = lam / (g.N * g.d * Math.cos(thGuess));
        const th = peakNear((t) => G.intensity(t, lam, g, ti), thGuess + 0.3 * w, 0.8 * w);
        close(g.d * (Math.sin(th) - Math.sin(ti)), m * lam, 1e-6 * lam, `order ${m}`); // envelope-slope shift O(1/N²)
    }
    close(G.orderAngle(0, lam, g.d, ti), ti, 1e-15);
    // every excluded order would have |sin θ| ≥ 1
    for (let m = -10; m <= 10; m++) if (!orders.includes(m)) assert.ok(Math.abs(Math.sin(ti) + m * lam / g.d) >= 1);
});

test("single-slit envelope suppresses orders m = k·d/a", () => {
    const lam = 550 * NM;
    for (const [d, a, expected] of [[9 * UM, 3 * UM, [-15, -12, -9, -6, -3, 3, 6, 9, 12, 15]], [8 * UM, 4 * UM, [-14, -12, -10, -8, -6, -4, -2, 2, 4, 6, 8, 10, 12, 14]]]) {
        const g = { N: 12, d, a };
        const orders = G.allowedOrders(lam, d, 0);
        assert.deepEqual(G.missingOrders(orders, g), expected);
        for (const m of orders) {
            const Ipk = G.intensityS(m * lam / d, lam, g);
            // compare with the brute-force sum (independent), not only the envelope formula
            close(Ipk, bruteSum(m * lam / d, lam, g.N, d, a, 400), 2e-5);
            if (expected.includes(m)) assert.ok(Ipk < 1e-25, `m=${m} should be missing, I=${Ipk}`);
            else if (m !== 0) assert.ok(Ipk > 1e-3, `m=${m} present`);
        }
    }
    // a = d: every order except 0 missing (a uniformly open aperture)
    const g = { N: 10, d: 3 * UM, a: 3 * UM };
    for (const m of [1, 2, 3]) assert.ok(G.intensityS(m * lam / g.d, lam, g) < 1e-25);
});

test("Parseval: mean of AF² over one order period is 1/N; zero-order peak width shrinks as 1/N", () => {
    for (const N of [3, 10, 257]) {
        const K = 200 * N;
        let acc = 0;
        for (let i = 0; i < K; i++) { const af = G.arrayFactorQ((i + 0.5) / K, N); acc += af * af; }
        rel(acc / K, 1 / N, 1e-9, `N=${N}`);
    }
    const w100 = G.halfMaxEps(100), w1000 = G.halfMaxEps(1000);
    rel(w100 / w1000, 10, 1e-3);
    rel(2 * w1000 * 1000 / Math.PI, 0.8859, 1e-3, "FWHM ≈ 0.886/N in β/π units");
});

test("angular dispersion from the numerically located peaks equals m/(d cos θm)", () => {
    const g = { N: 400, d: 1 / 1200 * MM, a: 0.5 / 1200 * MM }, ti = 10 * DEG;
    for (const m of [1, -1]) {
        const lam = 500 * NM, dl = 0.05 * NM;
        const find = (L) => peakNear((th) => G.intensity(th, L, g, ti), G.orderAngle(m, L, g.d, ti) + 2e-5, 2e-4);
        const num = (find(lam + dl) - find(lam - dl)) / (2 * dl);
        rel(num, G.angularDispersion(m, lam, g.d, ti), 1e-4, `m=${m}`);
    }
});

test("Rayleigh dip test: separation for an 8/π² dip gives λ/Δλ → mN", () => {
    const lam = 550 * NM;
    for (const [N, m, tol] of [[50, 1, 0.03], [400, 1, 0.01], [2000, 2, 0.005]]) {
        const g = { N, d: 1 / 300 * MM, a: 0.2 / 300 * MM };
        const dip = (dl) => G.twoLineDip(lam - dl / 2, lam + dl / 2, [1, 1], g, m).ratio;
        let lo = 0.3 * lam / (m * N), hi = 3 * lam / (m * N);
        for (let i = 0; i < 60; i++) { const mid = 0.5 * (lo + hi); if (dip(mid) > G.RAYLEIGH_DIP) lo = mid; else hi = mid; }
        const R = lam / (0.5 * (lo + hi));
        rel(R, G.resolvingPower(m, N), tol, `N=${N} m=${m}`);
    }
});

test("two lines change from unresolved to resolved as N passes λ/(mΔλ)", () => {
    const lam1 = 588.995 * NM, lam2 = 589.592 * NM, g0 = { d: 1 / 600 * MM, a: 0.4 / 600 * MM };
    const Ncrit = 0.5 * (lam1 + lam2) / (lam2 - lam1); // m = 1 → ≈ 987
    const res = (N, m = 1) => G.twoLineDip(lam1, lam2, [1, 1], Object.assign({ N }, g0), m);
    assert.equal(res(Math.round(0.7 * Ncrit)).resolved, false);
    assert.equal(res(Math.round(0.7 * Ncrit)).ratio, 1, "no dip at all well below N_crit");
    assert.equal(res(Math.round(1.1 * Ncrit)).resolved, true);
    assert.ok(res(3 * Ncrit).ratio < 0.2);
    // second order halves the required N
    assert.equal(res(Math.round(0.6 * Ncrit), 2).resolved, true);
    // monotonic dip with N
    let prev = 1.01;
    for (const f of [0.9, 1.0, 1.2, 1.6, 2.5]) { const r = res(Math.round(f * Ncrit)).ratio; assert.ok(r <= prev + 1e-9); prev = r; }
});

test("free spectral range: order m at λ+λ/m lands on order m+1 of λ", () => {
    const d = 1 / 300 * MM, lam = 420 * NM;
    for (const m of [1, 2, 3]) {
        const fsr = G.freeSpectralRange(lam, m);
        close(G.orderSin(m, lam + fsr, d), G.orderSin(m + 1, lam, d), 1e-15);
    }
});

test("continuum: order-integrated model matches brute-force λ integration inside the band", () => {
    const g = { N: 40, d: 1 / 150 * MM, a: 0.3 / 150 * MM };
    const spec = G.makeSpectrum("white");
    const { lo, hi, S } = spec.continuum;
    const brute = (s) => { // dense midpoint quadrature over λ, all orders
        const K = 40000, dl = (hi - lo) / K;
        let acc = 0;
        for (let j = 0; j < K; j++) acc += G.intensityS(s, lo + (j + 0.5) * dl, g);
        return acc * dl * S;
    };
    for (const [m, lamMid] of [[1, 500 * NM], [1, 620 * NM], [2, 450 * NM], [2, 560 * NM]]) {
        const s = m * lamMid / g.d;
        rel(G.spectrumIntensityS(s, spec, g), brute(s), 0.03, `m=${m} λ=${lamMid}`);
    }
    // zero order carries the full (unit) integrated weight at s = 0
    rel(G.spectrumIntensityS(0, spec, g), 1, 1e-9);
});

test("detector: slit and pixel stages conserve power; a vanishing slit/pixel recovers the ideal line width", () => {
    const g = { N: 1500, d: 1 / 600 * MM, a: 0.4 / 600 * MM };
    const base = { spec: G.makeSpectrum("mono", { lambda0: 550 * NM }), g, thetaI: 0, m: 1, lamC: 550 * NM, fCol: 0.5, fCam: 0.5, nPix: 1024 };
    const sim = G.simulateDetector(Object.assign({ slitW: 40 * UM, pixel: 6 * UM }, base));
    assert.ok(sim.ok);
    const sumFine = (arr, h) => arr.reduce((s, v) => s + v, 0) * h;
    const P0 = sumFine(sim.ideal, sim.h), P1 = sumFine(sim.slit, sim.h), P2 = sumFine(sim.pixels, 6 * UM);
    rel(P1, P0, 1e-3, "slit convolution conserves power");
    rel(P2, P1, 1e-9, "pixel binning conserves power");
    // tiny slit and pixel → instrument FWHM → ideal grating FWHM ≈ 0.886 λ/(mN)
    const tiny = G.instrumentProfile(Object.assign({ slitW: 0.01 * UM, pixel: 0.01 * UM }, base));
    rel(tiny.fwhmLambda.inst, G.idealFWHM(550 * NM, 1, g.N), 0.01);
    rel(tiny.fwhmLambda.ideal * g.N / 550e-9, 0.886, 0.01);
    // wide slit → geometric limit: FWHM → slit image width / linear dispersion
    const wide = G.instrumentProfile(Object.assign({ slitW: 800 * UM, pixel: 1 * UM }, base));
    rel(wide.fwhmLambda.inst, wide.slitLambda, 0.03);
    assert.ok(wide.instR < wide.idealR / 5, "instrument R well below mN");
    // monotonic: widening the slit never improves the resolution
    let prev = 0;
    for (const w of [1, 20, 80, 300]) {
        const p = G.instrumentProfile(Object.assign({ slitW: w * UM, pixel: 2 * UM }, base));
        assert.ok(p.fwhmLambda.inst >= prev * (1 - 1e-6)); prev = p.fwhmLambda.inst;
    }
});

test("detector wavelength calibration inverts the grating equation; peaks land on their pixels", () => {
    const g = { N: 3000, d: 1 / 600 * MM, a: 0.4 / 600 * MM };
    const spec = G.makeSpectrum("hg");
    const cfg = { spec, g, thetaI: 5 * DEG, m: 1, lamC: 492 * NM, fCol: 0.15, fCam: 0.15, slitW: 10 * UM, pixel: 10 * UM, nPix: 2048 };
    const sim = G.simulateDetector(cfg);
    for (const l of spec.lines) {
        const x = sim.geo.xAtLambda(l.lambda);
        close(sim.geo.lambdaAt(x), l.lambda, 1e-18);
        if (Math.abs(x) > sim.geo.width / 2) continue;
        const p = Math.floor((x + sim.geo.width / 2) / cfg.pixel);
        let best = Math.max(0, p - 3);
        for (let i = Math.max(0, p - 3); i <= Math.min(2047, p + 3); i++) if (sim.pixels[i] > sim.pixels[best]) best = i;
        assert.ok(Math.abs(best - p) <= 1, `${l.label}: brightest pixel ${best} vs ${p}`);
    }
    // non-propagating centre order is reported, not computed
    assert.equal(G.simulateDetector(Object.assign({}, cfg, { m: 4 })).ok, false);
});

test("slit-limited spectrometer: ideal grating resolves the Na doublet, instrument does not", () => {
    const g = { N: 5000, d: 1 / 600 * MM, a: 0.4 / 600 * MM };
    const spec = G.makeSpectrum("na");
    const base = { spec, g, thetaI: 0, m: 1, lamC: 589.3 * NM, fCol: 0.5, fCam: 0.5, pixel: 5 * UM, nPix: 2048 };
    const [l1, l2] = spec.lines.map((l) => l.lambda);
    const dip = (slitW) => {
        const sim = G.simulateDetector(Object.assign({ slitW }, base));
        const x1 = sim.geo.xAtLambda(l1), x2 = sim.geo.xAtLambda(l2);
        return { ideal: G.dipRatio(sim.x, sim.ideal, x1, x2), inst: G.dipRatio(sim.pixX, sim.pixels, x1, x2) };
    };
    const narrow = dip(10 * UM), wide = dip(400 * UM);
    assert.ok(narrow.ideal.resolved && narrow.inst.resolved);
    assert.ok(wide.ideal.resolved && !wide.inst.resolved);
});
