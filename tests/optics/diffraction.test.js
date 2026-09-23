"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const m = require("../../src/tools/shared/optics/diffraction.js");

const close = (actual, expected, tol, msg) =>
    assert.ok(Math.abs(actual - expected) <= tol, `${msg || ""} expected ${expected} ± ${tol}, got ${actual}`);

test("J1 matches tabulated values (series and asymptotic branches)", () => {
    // Abramowitz & Stegun Table 9.1 / standard references
    const table = [
        [0, 0],
        [0.5, 0.2422684577],
        [1, 0.4400505857],
        [2, 0.5767248078],
        [5, -0.3275791376],
        [10, 0.0434727462],
        [20, 0.0668331242],
        [50, -0.0975118281],
    ];
    for (const [x, v] of table) close(m.besselJ1(x), v, 1e-9, `J1(${x})`);
    close(m.besselJ1(-2), -0.5767248078, 1e-9, "J1 is odd");
});

test("J1 agrees with Bessel's integral J1(x) = (1/π)∫₀^π cos(τ − x sinτ) dτ", () => {
    const integral = (x) => {
        const N = 4000;
        let s = 0;
        for (let i = 0; i < N; i++) {
            const t = ((i + 0.5) * Math.PI) / N;
            s += Math.cos(t - x * Math.sin(t));
        }
        return s / N;
    };
    for (let x = 0; x <= 120; x += 0.37) close(m.besselJ1(x), integral(x), 1e-9, `J1(${x})`);
});

test("J1 is continuous across the series/asymptotic switch", () => {
    close(m.besselJ1(12 - 1e-9), m.besselJ1(12 + 1e-9), 1e-9);
});

test("J1 zeros match known values 3.8317, 7.0156, 10.1735, 13.3237", () => {
    const known = [3.831705970207512, 7.015586669815619, 10.17346813506272, 13.32369193631422, 16.47063005087763];
    known.forEach((z, i) => {
        close(m.besselJ1Zero(i + 1), z, 1e-9, `j1,${i + 1}`);
        close(m.besselJ1(z), 0, 1e-10, `J1 at zero ${i + 1}`);
    });
});

test("central values are finite and equal to 1 when peak-normalized", () => {
    assert.equal(m.slitIntensity(0, 100e-6, 550e-9), 1);
    assert.equal(m.circularIntensity(0, 100e-6, 550e-9), 1);
    close(m.sinc2(1e-12), 1, 1e-15);
    close(m.airy(1e-12), 1, 1e-15);
    // continuity near zero
    close(m.sinc2(1e-4), 1, 1e-8);
    close(m.airy(1e-4), 1, 1e-8);
    for (const v of [m.slitIntensity(0, 1e-5, 5e-7), m.circularIntensity(0, 1e-5, 5e-7)]) assert.ok(Number.isFinite(v));
});

test("acceptance: λ=550 nm, L=1 m, 100 µm → slit zero ≈ 5.50 mm, Airy ring ≈ 6.71 mm", () => {
    const base = { size: 100e-6, lambda: 550e-9, L: 1 };
    const ySlit = m.firstMinimum({ ...base, type: "slit" });
    const yCirc = m.firstMinimum({ ...base, type: "circular" });
    close(ySlit * 1e3, 5.50, 0.005, "slit first zero (mm)");
    close(yCirc * 1e3, 6.71, 0.005, "circular first dark ring (mm)");
    // The intensity is actually zero there, and the ratio is the 1.22 factor.
    close(m.intensityAt(ySlit, { ...base, type: "slit" }), 0, 1e-20);
    close(m.intensityAt(yCirc, { ...base, type: "circular" }), 0, 1e-18);
    // ≈ 1.22 (exactly j1,1/π in sinθ; tanθ projection adds ~1e-5 here)
    close(yCirc / ySlit, 3.8317059702 / Math.PI, 1e-4, "Airy / slit ratio");
});

test("slit minima follow a sinθ = mλ and all are true zeros", () => {
    const p = { type: "slit", size: 20e-6, lambda: 600e-9, L: 0.5 };
    const list = m.minima(p, 5);
    assert.equal(list.length, 5);
    list.forEach((mn, i) => {
        close(p.size * Math.sin(mn.theta), (i + 1) * p.lambda, 1e-18);
        close(m.intensityAt(mn.y, p), 0, 1e-20);
    });
});

test("secondary maxima heights: slit ≈ 0.0472, Airy ≈ 0.0175", () => {
    // Slit first side lobe at beta ≈ 1.4303π; Airy first ring at u ≈ 5.1356.
    close(m.sinc2(4.493409457909064), 0.04719045, 1e-7);
    close(m.airy(5.135622301840683), 0.01749786, 1e-7);
});

test("circular pattern is radially symmetric (depends only on r)", () => {
    const p = { type: "circular", size: 80e-6, lambda: 500e-9, L: 0.8 };
    for (const r of [0.5e-3, 3e-3, 7.3e-3]) {
        const ref = m.intensityAt(r, p);
        for (let k = 0; k < 12; k++) {
            const phi = (k / 12) * 2 * Math.PI;
            const x = r * Math.cos(phi), y = r * Math.sin(phi);
            close(m.intensityAt(Math.hypot(x, y), p), ref, 1e-14);
        }
    }
    close(m.intensityAt(-2e-3, p), m.intensityAt(2e-3, p), 1e-15);
});

test("pattern scales as λL/size (small-angle limit)", () => {
    const a = m.firstMinimum({ type: "slit", size: 50e-6, lambda: 500e-9, L: 0.2 });
    const b = m.firstMinimum({ type: "slit", size: 25e-6, lambda: 500e-9, L: 0.2 });
    const c = m.firstMinimum({ type: "slit", size: 50e-6, lambda: 500e-9, L: 0.4 });
    close(b / a, 2, 1e-3);
    close(c / a, 2, 1e-12);
});

test("Fresnel number uses half-width b = a/2 and flags the audit case", () => {
    close(m.fresnelNumber(100e-6, 550e-9, 1), (50e-6) ** 2 / (550e-9), 1e-15);
    const nf = m.fresnelNumber(200e-6, 380e-9, 0.05);
    close(nf, 0.526, 0.001);
    assert.equal(m.regime(nf), "marginal");
    assert.equal(m.regime(m.fresnelNumber(100e-6, 550e-9, 1)), "fraunhofer");
    assert.equal(m.regime(m.fresnelNumber(2e-3, 500e-9, 0.1)), "fresnel");
});

test("log display maps peak to 1 and the floor to 0", () => {
    assert.equal(m.displayValue(1, "log", 4), 1);
    assert.equal(m.displayValue(1e-4, "log", 4), 0);
    close(m.displayValue(1e-2, "log", 4), 0.5, 1e-12);
    assert.equal(m.displayValue(0, "log", 4), 0);
    assert.equal(m.displayValue(0.3, "linear"), 0.3);
});

// ---------------------------------------------------------------- wave-2 additions
const core = require("../../src/tools/shared/optics/core.js");

test("J1 delegates to core and J1 zeros agree with core.besselJZero", () => {
    for (let x = -30; x <= 30; x += 0.7) assert.equal(m.besselJ1(x), core.besselJ1(x));
    for (let k = 1; k <= 6; k++) close(m.besselJ1Zero(k), core.besselJZero(1, k), 1e-12);
});

test("sine integral: known values, oddness, π/2 limit and agreement with quadrature", () => {
    close(m.sineIntegral(1), 0.946083070367183, 1e-12, "Si(1)");
    close(m.sineIntegral(Math.PI), 1.851937051982466, 1e-12, "Si(π) (Wilbraham–Gibbs)");
    close(m.sineIntegral(-2), -m.sineIntegral(2), 0);
    close(m.sineIntegral(1e6), Math.PI / 2, 2e-6, "Si(∞) = π/2");
    for (const x of [5, 12.5, 19.9, 20.1, 35, 80]) {
        const q = core.integrateAdaptive((t) => (t === 0 ? 1 : Math.sin(t) / t), 0, x, 1e-12);
        close(m.sineIntegral(x), q, 1e-8, `Si(${x})`);
    }
});

test("enclosed power: equals direct integral of the pattern and tends to 1 (energy conservation)", () => {
    const L = 1, lambda = 550e-9;
    for (const type of ["slit", "circular"]) {
        const p = { type, size: 100e-6, lambda, L };
        for (const Y of [2e-3, 5.5e-3, 12e-3]) {
            // independent: integrate I over sinθ (1D for slit; 2π s ds for circle)
            const sMax = m.sinThetaFromY(Y, L);
            const f = type === "circular"
                ? (s) => m.circularIntensity(s, p.size, lambda) * 2 * Math.PI * s
                : (s) => 2 * m.slitIntensity(s, p.size, lambda);
            const total = type === "circular"
                ? 4 * lambda * lambda / (Math.PI * p.size * p.size) // ∬ Airy dΩ = 4λ²/(πD²)
                : lambda / p.size; // ∫ sinc² ds = λ/a
            const direct = core.simpson(f, 0, sMax, 4000) / total;
            close(m.enclosedPower(p, Y), direct, 1e-6, `${type} Y=${Y}`);
        }
        assert.equal(m.enclosedPower(p, 0), 0);
        // power outside a huge detector decays only as 1/β (slit) or 2/(πu) (Airy): ~1e-3 here
        close(m.enclosedPower(p, 5), 1, 2e-3, `${type} large detector`);
        if (type === "circular") {
            const u = Math.PI * p.size * m.sinThetaFromY(5, L) / lambda;
            close((1 - m.enclosedPower(p, 5)) / (2 / (Math.PI * u)), 1, 0.05, "Airy tail 2/(πu)");
        }
        // monotone non-decreasing
        let prev = 0;
        for (let Y = 1e-4; Y < 0.05; Y *= 1.3) {
            const v = m.enclosedPower(p, Y);
            assert.ok(v >= prev - 1e-12, `${type} monotone at ${Y}`);
            prev = v;
        }
    }
});

test("central-lobe power fractions: slit ≈ 0.9028, Airy disk ≈ 0.8378 (Rayleigh)", () => {
    close(m.centralLobeFraction("slit"), 0.9028233, 1e-6);
    close(m.centralLobeFraction("circular"), 0.8377849, 1e-6);
    const p = { type: "circular", size: 100e-6, lambda: 550e-9, L: 1 };
    close(m.enclosedPower(p, m.firstMinimum(p)), m.centralLobeFraction("circular"), 1e-12);
    const q = { ...p, type: "slit" };
    close(m.enclosedPower(q, m.firstMinimum(q)), m.centralLobeFraction("slit"), 1e-12);
});

test("absolute/power normalization conserves transmitted power in the paraxial limit", () => {
    const Iinc = 1000; // W/m²
    for (const type of ["slit", "circular"]) {
        const p = { type, size: 50e-6, lambda: 633e-9, L: 2 }; // N_F ≈ 5e-4, angles ≪ 1
        const I0 = m.peakValue(p, "absolute", Iinc);
        const R = 0.5; // m, ≈ 40 first-zero radii
        const n = 400001;
        const dy = R / (n - 1);
        const ys = Float64Array.from({ length: n }, (_, i) => i * dy);
        const vals = ys.map((y) => I0 * m.intensityAt(y, p) * (type === "circular" ? 2 * Math.PI * y : 2));
        const onScreen = core.simpsonSamples(vals, dy);
        const P = m.transmittedPower(p, Iinc);
        // the pattern tail beyond R carries 1 − enclosedPower(R); the flat-screen Jacobian is ~1e-2 at R
        close(onScreen / P, m.enclosedPower(p, R), 0.03, `${type} ∫I dA / P`);
        close(onScreen / P, 1, 0.03, `${type} total power`);
        // power-normalized peak × P = absolute peak
        close(m.peakValue(p, "power", Iinc) * P, I0, 1e-12 * I0);
        assert.equal(m.peakValue(p, "peak", Iinc), 1);
    }
});

test("absolute peak scaling: slit ∝ a²/(λL), circle ∝ D⁴/(λ²L²)", () => {
    const base = { size: 40e-6, lambda: 500e-9, L: 1 };
    const pk = (type, k) => m.peakValue({ ...base, type, size: base.size * k }, "absolute", 1);
    close(pk("slit", 2) / pk("slit", 1), 4, 1e-12);
    close(pk("circular", 2) / pk("circular", 1), 16, 1e-12);
    const far = m.peakValue({ ...base, type: "circular", L: 2 }, "absolute", 1);
    close(pk("circular", 1) / far, 4, 1e-12, "inverse-square with distance");
});

test("small-angle minima agree with exact flat-screen minima when θ ≪ 1 and diverge at large angle", () => {
    const p = { type: "circular", size: 100e-6, lambda: 550e-9, L: 1 };
    close(m.smallAngleMinimum(p, 1) / m.firstMinimum(p), 1, 1e-4); // tanθ − sinθ ≈ θ³/2
    const wide = { type: "slit", size: 2e-6, lambda: 700e-9, L: 0.1 }; // sinθ1 = 0.35
    const exact = m.firstMinimum(wide), paraxial = m.smallAngleMinimum(wide, 1);
    assert.ok(exact > paraxial * 1.05, "tan θ > sin θ correction is visible at 0.35 rad");
    // a slit narrower than λ has no minima at all (sinθ = λ/a > 1)
    assert.equal(m.minima({ type: "slit", size: 0.5e-6, lambda: 600e-9, L: 1 }, 3).length, 0);
    assert.equal(m.firstMinimum({ type: "slit", size: 0.5e-6, lambda: 600e-9, L: 1 }), Infinity);
});

test("2D detector image: circle is radially symmetric (8-fold grid symmetry), slit is invariant along y", () => {
    const n = 64, R = 12e-3;
    const c = m.detectorImage({ type: "circular", size: 100e-6, lambda: 550e-9, L: 1 }, R, n);
    for (let iy = 0; iy < n; iy++) {
        for (let ix = 0; ix < n; ix++) {
            const v = c[iy * n + ix];
            close(c[ix * n + iy], v, 1e-13, "transpose");
            close(c[iy * n + (n - 1 - ix)], v, 1e-13, "mirror x");
            close(c[(n - 1 - iy) * n + ix], v, 1e-13, "mirror y");
        }
    }
    const s = m.detectorImage({ type: "slit", size: 100e-6, lambda: 550e-9, L: 1 }, R, n);
    for (let iy = 1; iy < n; iy++) for (let ix = 0; ix < n; ix++) assert.equal(s[iy * n + ix], s[ix]);
    // pixel values are bounded by the peak and the line cut is even
    const cut = m.lineCut({ type: "slit", size: 100e-6, lambda: 550e-9, L: 1 }, R, 201);
    assert.equal(cut.I[100], 1);
    for (let i = 0; i < 201; i++) {
        close(cut.I[i], cut.I[200 - i], 1e-15);
        assert.ok(cut.I[i] >= 0 && cut.I[i] <= 1);
    }
});

test("line-cut minima: sampled pattern has local minima where the model says (rendered-data check)", () => {
    const p = { type: "slit", size: 100e-6, lambda: 550e-9, L: 1 };
    const R = 20e-3, n = 4001;
    const { ys, I } = m.lineCut(p, R, n);
    const found = [];
    for (let i = (n - 1) / 2 + 1; i < n - 1; i++) if (I[i] < I[i - 1] && I[i] <= I[i + 1] && I[i] < 1e-3) found.push(ys[i]);
    const expected = m.minima(p, 10).filter((mn) => mn.y < R).map((mn) => mn.y);
    assert.equal(found.length, expected.length);
    found.forEach((y, k) => close(y, expected[k], (2 * R) / (n - 1), `min ${k + 1}`));
});
