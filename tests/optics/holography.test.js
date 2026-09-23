"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../../src/tools/shared/optics/core.js");
const Hg = require("../../src/tools/shared/optics/holography.js");

const LAM = 633e-9;
const DEG = Math.PI / 180;
const prepCache = new Map();
function prep(params) {
    const key = JSON.stringify(params);
    if (!prepCache.has(key)) prepCache.set(key, Hg.prepare(params));
    return prepCache.get(key);
}

test("off-axis Fourier-filtered reconstruction matches the (filtered) ground truth: ρ > 0.95 for every object", () => {
    for (const object of Hg.OBJECTS) {
        const p = { object, geometry: "offaxis", theta: 2.6 * DEG, method: "filter", fill: 1 };
        const r = Hg.simulate(p, prep({ object }), { table: false, sweep: false });
        assert.equal(r.layout.overlap, false, object + ": default geometry must separate the orders");
        assert.ok(r.recon.corr.rho > 0.95, object + " sensor-plane ρ = " + r.recon.corr.rho);
        // object plane: back-propagated reconstruction vs the band-limited object itself
        const c = Hg.correlation(r.recon.object, r.obj);
        assert.ok(c.rho > 0.95, object + " object-plane ρ = " + c.rho);
        // ideal point sampling removes the pixel-MTF weighting: agreement becomes much tighter
        const r0 = Hg.simulate(Object.assign({}, p, { fill: 0 }), prep({ object }), { table: false, sweep: false });
        assert.ok(r0.recon.corr.rho > 0.9999, object + " point-sampled ρ = " + r0.recon.corr.rho);
    }
});

test("4-step phase shifting recovers the complex sensor field to numerical precision (no quantisation, point sampling)", () => {
    for (const geometry of ["inline", "offaxis"]) {
        const r = Hg.simulate({ object: "phase", geometry, method: "ps4", fill: 0, bits: 0 }, prep({ object: "phase" }), { table: false, sweep: false });
        const u = r.recon.sensor, O = r.O;
        let err = 0, mx = 0;
        for (let i = 0; i < O.re.length; i++) {
            err = Math.max(err, Math.hypot(u.re[i] - O.re[i], u.im[i] - O.im[i]));
            mx = Math.max(mx, Math.hypot(O.re[i], O.im[i]));
        }
        assert.ok(err / mx < 1e-10, geometry + " max relative error " + err / mx);
        // back to the object plane: the band-limited phase object itself
        let e2 = 0;
        for (let i = 0; i < O.re.length; i++) e2 = Math.max(e2, Math.hypot(r.recon.object.re[i] - r.obj.re[i], r.recon.object.im[i] - r.obj.im[i]));
        assert.ok(e2 < 1e-9, geometry + " object-plane max error " + e2);
    }
});

test("phase shifting is exact only with correct steps and without quantisation; errors grow with ε and fewer bits", () => {
    const pr = prep({ object: "phase" });
    const rho = (extra) => Hg.simulate(Object.assign({ object: "phase", geometry: "inline", method: "ps4", fill: 0 }, extra), pr, { table: false, sweep: false }).recon.corr.relErr;
    const e0 = rho({}), eEps = rho({ psError: 10 * DEG }), e8 = rho({ bits: 8 }), e4 = rho({ bits: 4 });
    assert.ok(e0 < 1e-7, "exact " + e0);
    assert.ok(eEps > 1e-3, "10° step error leaves a residual twin: " + eEps);
    assert.ok(e8 > 1e-5 && e8 < e4, "8-bit " + e8 + " < 4-bit " + e4);
});

test("single-exposure in-line (Gabor) reconstruction is degraded by the twin image; phase shifting removes it", () => {
    for (const object of Hg.OBJECTS) {
        const r = Hg.simulate({ object, geometry: "inline" }, prep({ object }), { sweep: false });
        const byId = Object.fromEntries(r.table.map((t) => [t.id, t]));
        assert.ok(byId.direct.rho < 0.9, object + " Gabor ρ = " + byId.direct.rho);
        assert.ok(byId.ps4.rho > 0.999, object + " PS ρ = " + byId.ps4.rho);
        // twin image: for a strong reference (β → ∞, |O|²/A → 0) the residual (Gabor − truth) is the
        // conjugate wave O* (a real image focused at −z, i.e. defocused by 2z in the reconstruction)
        const rs = Hg.simulate({ object, geometry: "inline", method: "direct", beta: 1e6, fill: 0 }, prep({ object }), { table: false, sweep: false, objectPlane: false });
        const us = rs.recon.sensor;
        const resid = { re: us.re.map((v, i) => v - rs.O.re[i]), im: us.im.map((v, i) => v - rs.O.im[i]) };
        const conj = { re: rs.O.re, im: rs.O.im.map((v) => -v) };
        const c = Hg.correlation(resid, conj);
        assert.ok(c.rho > 0.999 && Math.abs(c.phase) < 0.05, object + " residual vs O*: " + c.rho + ", phase " + c.phase);
        // and its magnitude equals |O| (twin carries as much power as the image)
        let pr = 0, po = 0;
        for (let i = 0; i < us.re.length; i++) { pr += resid.re[i] ** 2 + resid.im[i] ** 2; po += rs.O.re[i] ** 2 + rs.O.im[i] ** 2; }
        assert.ok(Math.abs(pr / po - 1) < 0.01, object + " twin power ratio " + pr / po);
    }
});

test("recording measures intensity: without a reference the phase is lost (ρ well below the holographic result)", () => {
    const r = Hg.simulate({ object: "phase" }, prep({ object: "phase" }), { sweep: false });
    const byId = Object.fromEntries(r.table.map((t) => [t.id, t]));
    assert.ok(byId.intensity.rho < 0.8, "intensity-only ρ = " + byId.intensity.rho);
    assert.ok(byId.filter.rho - byId.intensity.rho > 0.2);
    // the hologram is a real, non-negative intensity whose mean is A² + ⟨|O|²⟩ (cross terms average out)
    let mean = 0, min = Infinity;
    for (const v of r.H) { mean += v; min = Math.min(min, v); }
    mean /= r.H.length;
    assert.ok(Math.abs(mean - (r.A * r.A + r.meanI)) < 1e-9 * mean, "mean " + mean);
    assert.ok(min > -1e-6 * mean, "min " + min);
});

test("spectral recording equals the direct |O + R|² for point sampling (independent computation path)", () => {
    const pr = prep({ object: "points" });
    const g = pr.grid;
    for (const theta of [0, 2 * DEG, 5.5 * DEG]) {
        const car = Hg.carrier(g, LAM, theta, 30 * DEG);
        const ref = { A: 1.7, psi: 0.4, c: car.c };
        const H = Hg.record(pr.O, g, ref, { fill: 0 });
        const R = Hg.referenceField(g, ref);
        let err = 0;
        for (let i = 0; i < H.length; i++) {
            const d = (pr.O.re[i] + R.re[i]) ** 2 + (pr.O.im[i] + R.im[i]) ** 2;
            err = Math.max(err, Math.abs(H[i] - d));
        }
        assert.ok(err < 1e-10, "θ = " + theta + " max diff " + err);
    }
});

test("plane-wave fringes: visibility 2aA/(a²+A²) times the pixel MTF sinc(f_c·a_px) at the physical (unaliased) frequency", () => {
    const g = Hg.makeGrid(64, 5e-6);
    const a = 0.6, A = 1.1, n = 64 * 64;
    const O = { re: new Float64Array(n).fill(a), im: new Float64Array(n) };
    for (const [cx, fill] of [[10, 0], [10, 1], [20, 0.5], [44, 1], [54, 1]]) {
        const H = Hg.record(O, g, { A, psi: 0, c: [cx, 0] }, { fill });
        const s = core.fft2(Float64Array.from(H), new Float64Array(n), 64, 64);
        const alias = Hg.signedBin(cx, 64);
        const k = (alias + 64) % 64;
        const amp = Math.hypot(s[0][k], s[1][k]) / n; // one sideband = aA·MTF
        const fc = cx * g.df;
        const expected = a * A * Math.abs(Hg.sinc(fc * fill * g.dx));
        assert.ok(Math.abs(amp - expected) < 1e-12, `cx=${cx} fill=${fill}: ${amp} vs ${expected}`);
        const dc = s[0][0] / n;
        assert.ok(Math.abs(dc - (a * a + A * A)) < 1e-12);
        // the fringe appears at the aliased bin when cx > N/2 (fringe period < 2 px)
        let best = 1, bestV = 0;
        for (let j = 1; j < 64; j++) { const v = Math.hypot(s[0][j], s[1][j]); if (v > bestV) { bestV = v; best = j; } }
        assert.ok(best === k || best === (64 - k) % 64, `cx=${cx}: strongest fringe bin ${best}, expected ±${k}`);
    }
});

test("sampling limit: θ_max = asin(λ/2Δx); beyond it the carrier aliases and can land on the DC term (overlap detected)", () => {
    const pr = prep({ object: "letters" });
    const g = pr.grid, B = pr.obj.B;
    const good = Hg.orderLayout(g, LAM, Hg.carrier(g, LAM, 2.6 * DEG, 0), B);
    assert.ok(Math.abs(good.thetaNyquist - Math.asin(LAM / (2 * g.dx))) < 1e-15);
    assert.equal(good.aliased, false);
    assert.equal(good.overlap, false);
    assert.ok(good.periodPx >= 2);
    // f_c = 1.9 f_N: fringe period 1.05 px, alias at −0.1 f_N → overlaps DC
    const th = Math.asin(1.9 * g.fN * LAM);
    const car = Hg.carrier(g, LAM, th, 0);
    const bad = Hg.orderLayout(g, LAM, car, B);
    assert.equal(bad.aliased, true);
    assert.ok(bad.periodPx < 2);
    assert.ok(Math.abs(bad.alias[0] - (car.fc[0] - 2 * g.fN)) < 1e-9);
    assert.equal(bad.overlapDC, true);
    // the numerical reconstruction confirms the contamination
    const rGood = Hg.simulate({ object: "letters", theta: 2.6 * DEG, fill: 0 }, pr, { table: false, sweep: false });
    const rBad = Hg.simulate({ object: "letters", theta: th, fill: 0 }, pr, { table: false, sweep: false });
    assert.ok(rGood.recon.corr.rho > 0.999 && rBad.recon.corr.rho < 0.8, `good ${rGood.recon.corr.rho}, aliased ${rBad.recon.corr.rho}`);
    assert.ok(rBad.warnings.some((w) => /aliases/.test(w)) && rBad.warnings.some((w) => /overlaps the DC/.test(w)));
    // too small an angle: +1 order overlaps the autocorrelation (DC) term, |f_c| < 3B
    const small = Hg.orderLayout(g, LAM, Hg.carrier(g, LAM, Math.asin(2 * B * LAM), 0), B);
    assert.equal(small.overlapDC, true);
    // at exactly the Nyquist carrier the ±1 orders coincide (twin overlap)
    const nyq = Hg.orderLayout(g, LAM, { c: [g.N / 2, 0], fc: [g.fN, 0], fcAbs: g.fN }, B);
    assert.equal(nyq.overlapTwin, true);
});

test("fast spectral angle sweep equals the full record → illuminate → filter pipeline", () => {
    const pr = prep({ object: "points" });
    const thetas = [1.2, 2.6, 3.4, 4.5, 6.5].map((d) => d * DEG);
    for (const fill of [0, 1]) {
        const base = Hg.simulate({ object: "points", fill }, pr, { table: false, sweep: false });
        const sw = Hg.angleSweep(pr.O, pr.grid, { lambda: LAM, azimuth: 0, A: base.A, rw: base.rw, fill, thetas, spectra: pr.spectra });
        thetas.forEach((th, i) => {
            const r = Hg.simulate({ object: "points", fill, theta: th }, pr, { table: false, sweep: false, objectPlane: false });
            assert.ok(Math.abs(sw[i] - r.recon.corr.rho) < 1e-9, `fill ${fill} θ ${th}: ${sw[i]} vs ${r.recon.corr.rho}`);
        });
    }
});

test("back-propagation inverts forward propagation (unitary ASM, power conserved)", () => {
    const pr = prep({ object: "phase" });
    const back = Hg.propagateField(pr.O, pr.grid, LAM, -12e-3);
    let err = 0, p0 = 0, p1 = 0;
    for (let i = 0; i < back.re.length; i++) {
        err = Math.max(err, Math.hypot(back.re[i] - pr.obj.re[i], back.im[i] - pr.obj.im[i]));
        p0 += pr.obj.re[i] ** 2 + pr.obj.im[i] ** 2; p1 += pr.O.re[i] ** 2 + pr.O.im[i] ** 2;
    }
    assert.ok(err < 1e-10, "round trip " + err);
    assert.ok(Math.abs(p1 - p0) < 1e-10 * p0, "power " + p0 + " → " + p1);
});

test("b-bit quantisation error is bounded by half a level", () => {
    const H = Float64Array.from({ length: 1000 }, (_, i) => 3 * Math.abs(Math.sin(i * 0.37)));
    for (const b of [4, 8, 12]) {
        const q = Hg.quantize(H, b, 3);
        const half = 3 / (2 * (2 ** b - 1));
        let mx = 0;
        for (let i = 0; i < H.length; i++) mx = Math.max(mx, Math.abs(q[i] - H[i]));
        assert.ok(mx <= half * (1 + 1e-12), b + " bits: " + mx + " > " + half);
    }
});

test("Gerchberg–Saxton (error reduction): measurement-plane error is non-increasing, bracketed by the object-plane error", () => {
    for (const [object, gsPlane, gsStart] of [["phase", "fresnel", "flat"], ["phase", "fresnel", "random"], ["points", "fourier", "random"], ["letters", "fourier", "random"]]) {
        const { state } = Hg.gsFromParams({ object, gsPlane, gsStart, fill: 1, bits: 10 }, prep({ object }));
        Hg.gsStep(state, 40);
        const eF = state.errMeas, eO = state.errObj;
        for (let k = 1; k < eF.length; k++) {
            assert.ok(eF[k] <= eF[k - 1] * (1 + 1e-10) + 1e-15, `${object}/${gsPlane}/${gsStart}: E_F rose at ${k}: ${eF[k - 1]} → ${eF[k]}`);
            // Fienup: E_F(k+1) ≤ E_O(k) ≤ E_F(k)
            assert.ok(eF[k] <= eO[k - 1] * (1 + 1e-10) + 1e-15 && eO[k - 1] <= eF[k - 1] * (1 + 1e-10) + 1e-15);
        }
        assert.ok(eF[eF.length - 1] < 0.5 * eF[0], `${object}/${gsPlane}: ${eF[0]} → ${eF[eF.length - 1]}`);
    }
});

test("GS retrieves the phase of the phase object from one defocused intensity (flat start, z = 30 mm)", () => {
    const params = { object: "phase", gsPlane: "fresnel", gsStart: "flat", z: 30e-3, fill: 0 };
    const pr = Hg.prepare(params);
    const { state } = Hg.gsFromParams(params, pr);
    Hg.gsStep(state, 100, pr.obj);
    assert.ok(state.truthErr[99] < 0.25 && state.truthErr[99] < 0.5 * state.truthErr[0], `truth error ${state.truthErr[0]} → ${state.truthErr[99]}`);
});

test("carrier snapping and order layout geometry", () => {
    const g = Hg.makeGrid(256, 5e-6);
    const car = Hg.carrier(g, LAM, 2.6 * DEG, 45 * DEG);
    assert.ok(Number.isInteger(car.c[0]) && car.c[0] === car.c[1]);
    assert.ok(Math.abs(car.theta - 2.6 * DEG) < Math.asin(LAM * g.df));
    const lay = Hg.orderLayout(g, LAM, car, 1e4);
    assert.ok(Math.abs(lay.fNyqDir - g.fN * Math.SQRT2) < 1e-6, "diagonal carrier reaches Nyquist at √2 f_N");
    assert.deepEqual(lay.minus, [-lay.plus[0], -lay.plus[1]]);
    const inl = Hg.orderLayout(g, LAM, Hg.carrier(g, LAM, 0, 0), 1e4);
    assert.equal(inl.inline, true);
    assert.equal(inl.overlap, true);
});

test("worked example check: Δx = 3.5 µm, λ = 532 nm, NA_o = 0.019 puts |f_c| = 3B exactly at θ ≈ 3.27° with no overlap", () => {
    const base = { object: "letters", N: 256, dx: 3.5e-6, lambda: 532e-9, NAo: 0.019, z: 9e-3, fill: 1, beta: Math.pow(10, 0.6), method: "filter" };
    const opts = { table: false, sweep: false, objectPlane: false };
    const r = Hg.simulate({ ...base, theta: 3.27 * DEG }, null, opts);
    assert.equal(r.layout.overlap, false);
    assert.equal(r.warnings.length, 0, r.warnings.join(" / "));
    assert.ok(r.recon.corr.rho > 0.99, "ρ = " + r.recon.corr.rho);
    // one DFT bin either side: the +1 disc touches the twin across Nyquist (3.30°) or the DC halo (3.25°)
    assert.equal(Hg.simulate({ ...base, theta: 3.30 * DEG }, null, opts).layout.overlapTwin, true);
    assert.equal(Hg.simulate({ ...base, theta: 3.25 * DEG }, null, opts).layout.overlapDC, true);
});
