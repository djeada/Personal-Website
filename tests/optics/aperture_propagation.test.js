"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../../src/tools/shared/optics/core.js");
const P = require("../../src/tools/shared/optics/propagation.js");

const LAM = 633e-9;
const centre = (res) => { const n = res.n, k = (n / 2) * n + n / 2; return res.re[k] ** 2 + res.im[k] ** 2; };
const at = (res, ix, iy) => { const k = iy * res.n + ix; return res.re[k] ** 2 + res.im[k] ** 2; };
const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (tol ${tol})`);

test("z = 0 reproduces the input exactly when every sampled frequency propagates (Δx ≥ λ/2)", () => {
    const g = P.createGrid(64, 1e-3);
    const f = P.buildAperture({ shape: "annulus", a: 0.6e-3, eps: 0.4, strokes: [{ x: 1e-4, y: -1e-4, r: 5e-5, mode: "paint", t: 0.5, p: 1.2 }] }, g);
    for (const method of ["asm", "tf", "ir"]) {
        const r = P.propagate(f, g, { lambda: LAM, z: 0, method, pad: 2 });
        let err = 0;
        for (let iy = 0; iy < 64; iy++) for (let ix = 0; ix < 64; ix++) {
            const k = (iy + r.crop.off) * r.n + ix + r.crop.off;
            err = Math.max(err, Math.hypot(r.re[k] - f.re[iy * 64 + ix], r.im[k] - f.im[iy * 64 + ix]));
        }
        assert.ok(err < 1e-12, method + " z=0 error " + err);
    }
});

test("z = 0 with Δx < λ/2 returns the input band-limited to |f| ≤ 1/λ (evanescent part dropped and reported)", () => {
    const N = 64, g = P.createGrid(N, 64 * 0.2e-6); // Δx = 0.2 µm < λ/2
    const f = P.buildAperture({ shape: "slit", a: 1e-6, b: 6e-6 }, g);
    const r = P.propagate(f, g, { lambda: LAM, z: 0, method: "asm", pad: 1, evanescent: "drop" });
    // independent reference: explicit low-pass of the input spectrum
    const re = Float64Array.from(f.re), im = Float64Array.from(f.im);
    core.fft2(re, im, N, N);
    const fr = core.fftFreq(N, g.dx);
    for (let iy = 0; iy < N; iy++) for (let ix = 0; ix < N; ix++) if (fr[ix] ** 2 + fr[iy] ** 2 > 1 / LAM ** 2) { re[iy * N + ix] = 0; im[iy * N + ix] = 0; }
    core.ifft2(re, im, N, N);
    let err = 0;
    for (let i = 0; i < N * N; i++) err = Math.max(err, Math.hypot(r.re[i] - re[i], r.im[i] - im[i]));
    assert.ok(err < 1e-12, "band-limited reproduction error " + err);
    assert.ok(r.power.evanescentFraction > 0.01, "a 1 µm slit carries evanescent content");
    close(r.power.output + r.power.removed, r.power.input, 1e-12 * r.power.input + 1e-30, "power bookkeeping");
});

test("Parseval: lossless ASM and Fresnel TF conserve power; band limiting and evanescent decay are booked, not renormalised", () => {
    const g = P.createGrid(128, 3e-3);
    const f = P.buildAperture({ shape: "rect", a: 0.4e-3, b: 0.8e-3 }, g);
    for (const method of ["asm", "tf"]) {
        const r = P.propagate(f, g, { lambda: LAM, z: 0.05, method, pad: 2, bandLimit: false });
        close(r.power.output / r.power.input, 1, 1e-12, method + " unitary");
        close(r.power.removed, 0, 1e-12 * r.power.input, method + " nothing removed");
        close(r.power.detector + r.power.outside, r.power.output, 1e-12 * r.power.input, "detector + outside = output");
    }
    // band limit at a long distance removes power, reported as 'removed'
    const r = P.propagate(f, g, { lambda: LAM, z: 20, method: "asm", pad: 2, bandLimit: true });
    assert.ok(r.power.removed > 0.01 * r.power.input);
    close(r.power.output + r.power.removed, r.power.input, 1e-10 * r.power.input, "band-limit bookkeeping");
    // evanescent decay on a sub-wavelength grid
    const gs = P.createGrid(64, 64 * 0.15e-6);
    const fs = P.buildAperture({ shape: "circle", a: 0.8e-6 }, gs);
    const rd = P.propagate(fs, gs, { lambda: LAM, z: 0.3e-6, method: "asm", pad: 2, evanescent: "decay", bandLimit: false });
    assert.ok(rd.power.output < rd.power.input * 0.999, "evanescent decay loses power");
    close(rd.power.output + rd.power.removed, rd.power.input, 1e-10 * rd.power.input, "decay bookkeeping");
    const rdrop = P.propagate(fs, gs, { lambda: LAM, z: 0.3e-6, method: "asm", pad: 2, evanescent: "drop", bandLimit: false });
    assert.ok(rdrop.power.output < rd.power.output, "dropping removes more than decaying over a short distance");
});

test("circular far field (single-FFT Fraunhofer) converges to the Airy pattern with grid refinement", () => {
    const spec = { shape: "circle", a: 0.2e-3 }, z = 2; // N_F = (0.1 mm)²/(λz) ≈ 0.008
    const A = P.fraunhoferAnalytic(spec, LAM, z), pk = A(0, 0);
    const errs = [];
    for (const N of [32, 64, 256]) {
        const g = P.createGrid(N, 1e-3);
        const r = P.propagate(P.buildAperture(spec, g), g, { lambda: LAM, z, method: "fraunhofer", pad: 4 });
        close(r.dx, LAM * z / (r.n * g.dx), 1e-18, "output pitch λz/(NΔx)");
        let e = 0;
        for (let ix = 0; ix < r.n; ix++) {
            const x = (ix - r.n / 2) * r.dx;
            if (Math.abs(x) < 25e-3) e = Math.max(e, Math.abs(at(r, ix, r.n / 2) - A(x, 0)) / pk);
        }
        errs.push(e);
        close(r.power.output / r.power.input, 1, 1e-10, "single-FFT Parseval");
    }
    assert.ok(errs[2] < errs[1] && errs[1] < errs[0], "monotone convergence " + errs);
    assert.ok(errs[2] < 2e-3, "N=256 peak-relative error " + errs[2]);
    // first dark ring at 1.22 λz/D
    const g = P.createGrid(256, 1e-3), r = P.propagate(P.buildAperture(spec, g), g, { lambda: LAM, z, method: "fraunhofer", pad: 4 });
    let imin = r.n / 2 + 1;
    while (at(r, imin + 1, r.n / 2) < at(r, imin, r.n / 2)) imin++;
    close((imin - r.n / 2) * r.dx, 1.2197 * LAM * z / 0.2e-3, r.dx, "Airy first zero");
    // circular symmetry
    for (let d = 1; d < 30; d++) close(at(r, r.n / 2 + d, r.n / 2), at(r, r.n / 2, r.n / 2 + d), 1e-9 * pk, "x/y symmetry");
});

test("slit far field matches sinc² including the first zero at λz/a", () => {
    const spec = { shape: "slit", a: 0.1e-3, b: 0.4e-3 }, z = 3;
    const g = P.createGrid(256, 1e-3);
    const r = P.propagate(P.buildAperture(spec, g), g, { lambda: LAM, z, method: "fraunhofer", pad: 4 });
    const A = P.fraunhoferAnalytic(spec, LAM, z), pk = A(0, 0);
    close(centre(r) / pk, 1, 1e-2, "central intensity (a b/(λz))² within the rasterised-area error");
    let e = 0;
    for (let ix = 0; ix < r.n; ix++) { const x = (ix - r.n / 2) * r.dx; if (Math.abs(x) < 60e-3) e = Math.max(e, Math.abs(at(r, ix, r.n / 2) - A(x, 0)) / pk); }
    assert.ok(e < 1e-2, "sinc² error " + e);
    close(Math.sqrt(A(LAM * z / spec.a, 0) / pk), 0, 1e-12, "analytic zero");
});

test("ASM matches the exact Rayleigh–Sommerfeld on-axis intensity of a circular aperture and converges with N", () => {
    const a = 0.5e-3, zs = [0.08, 0.1, 0.23]; // N_F ≈ 4.9, 3.9, 1.7
    const errs = [];
    for (const N of [128, 256, 512]) {
        const g = P.createGrid(N, 4e-3), f = P.buildAperture({ shape: "circle", a: 2 * a }, g);
        let e = 0;
        for (const z of zs) e = Math.max(e, Math.abs(centre(P.propagate(f, g, { lambda: LAM, z, method: "asm", pad: 2 })) - P.onAxisCircle(LAM, z, a).aperture));
        errs.push(e);
    }
    // roughly second-order convergence of the anti-aliased rim
    assert.ok(errs[0] / errs[1] > 2.5 && errs[1] / errs[2] > 2.5, "convergence " + errs);
    assert.ok(errs[2] < 0.05, "N=512 on-axis error (I0 units) " + errs[2]);
    // beyond zc the band-limited ASM is closer to the exact value than the aliased transfer function
    const g = P.createGrid(256, 4e-3), f = P.buildAperture({ shape: "circle", a: 2 * a }, g), z = 0.5, ex = P.onAxisCircle(LAM, z, a).aperture;
    const eBL = Math.abs(centre(P.propagate(f, g, { lambda: LAM, z, method: "asm", pad: 2, bandLimit: true })) - ex);
    const eNo = Math.abs(centre(P.propagate(f, g, { lambda: LAM, z, method: "asm", pad: 2, bandLimit: false })) - ex);
    assert.ok(eBL < eNo, "band limit helps: " + eBL + " vs " + eNo);
});

test("increasing the padded extent converges the long-distance result", () => {
    const g = P.createGrid(256, 4e-3), f = P.buildAperture({ shape: "circle", a: 1e-3 }, g);
    const exact = P.onAxisCircle(LAM, 1, 0.5e-3).aperture;
    const errs = [1, 2, 4].map((pad) => Math.abs(centre(P.propagate(f, g, { lambda: LAM, z: 1, method: "asm", pad })) - exact));
    assert.ok(errs[2] < errs[1] && errs[1] < errs[0], "pad convergence " + errs);
    assert.ok(errs[2] / exact < 3e-3);
});

test("Poisson–Arago spot: on-axis intensity behind an opaque disk ≈ incident intensity", () => {
    const a = 0.5e-3, w = 2.5e-3, z = 0.3; // N_F = a²/(λz) ≈ 1.3
    const g = P.createGrid(512, 12e-3);
    const rd = P.propagate(P.buildAperture({ shape: "disk", a: 2 * a, illum: "gauss", w }, g), g, { lambda: LAM, z, method: "asm", pad: 2 });
    const rf = P.propagate(P.buildAperture({ shape: "open", illum: "gauss", w }, g), g, { lambda: LAM, z, method: "asm", pad: 2 });
    // plane wave: I = z²/(z²+a²) ≈ 1; Gaussian illumination scales the edge amplitude by exp(−a²/w²)
    const expected = P.onAxisCircle(LAM, z, a).disk * Math.exp(-2 * a * a / (w * w));
    close(centre(rd) / centre(rf), expected, 0.02, "spot / unobstructed");
    // it is a bright spot: brighter than the geometric shadow half a radius off axis
    const off = Math.round(0.25e-3 / g.dx);
    assert.ok(centre(rd) > 5 * at(rd, rd.n / 2 + off, rd.n / 2));
});

test("Fresnel methods agree with ASM in their valid regimes (paraxial, adequately sampled)", () => {
    const spec = { shape: "rect", a: 0.6e-3, b: 0.3e-3 };
    const g = P.createGrid(256, 4e-3), f = P.buildAperture(spec, g);
    const pad = 2, zc = P.criticalDistance(pad * g.L, g.dx, LAM);
    const cmp = (a, b) => { let e = 0, m = 0; for (let iy = 0; iy < 256; iy++) for (let ix = 0; ix < 256; ix++) { const k = (iy + a.crop.off) * a.n + ix + a.crop.off; const va = a.re[k] ** 2 + a.im[k] ** 2, vb = b.re[k] ** 2 + b.im[k] ** 2; e = Math.max(e, Math.abs(va - vb)); m = Math.max(m, vb); } return e / m; };
    const zShort = 0.5 * zc, zLong = 1.5 * zc;
    const asmS = P.propagate(f, g, { lambda: LAM, z: zShort, method: "asm", pad });
    assert.ok(cmp(P.propagate(f, g, { lambda: LAM, z: zShort, method: "tf", pad }), asmS) < 5e-3, "TF ≈ ASM for z < zc");
    const asmL = P.propagate(f, g, { lambda: LAM, z: zLong, method: "asm", pad });
    assert.ok(cmp(P.propagate(f, g, { lambda: LAM, z: zLong, method: "ir", pad }), asmL) < 2e-2, "IR ≈ ASM for z > zc");
    // single-FFT Fresnel on its own output grid: compare its centre with ASM
    const fr = P.propagate(f, g, { lambda: LAM, z: zLong, method: "fresnel", pad });
    close(centre(fr), centre(asmL), 0.02 * centre(asmL), "single-FFT Fresnel on axis");
});

test("amplitude Fresnel zone plate focuses to ≈ N² I0 at z = f; a π-phase plate to ≈ 4× that", () => {
    const g = P.createGrid(256, 4e-3), zones = 8;
    const amp = centre(P.propagate(P.buildAperture({ shape: "zonePlate", f: 0.2, zones, lambda: LAM }, g), g, { lambda: LAM, z: 0.2, method: "asm", pad: 2 }));
    const ph = centre(P.propagate(P.buildAperture({ shape: "zonePlate", f: 0.2, zones, lambda: LAM, zpPhase: true }, g), g, { lambda: LAM, z: 0.2, method: "asm", pad: 2 }));
    close(amp / zones ** 2, 1, 0.08, "amplitude plate focus");
    close(ph / amp, 4, 0.2, "phase plate gain");
});

test("sampling diagnostics: critical distance, Fresnel number and regime warnings", () => {
    const g = P.createGrid(256, 4e-3);
    const spec = { shape: "circle", a: 1e-3 };
    const info = P.samplingInfo(spec, g, { lambda: LAM, z: 0.1, method: "asm", pad: 2 });
    close(info.zc, 2 * 4e-3 * (4e-3 / 256) / LAM, 1e-15, "zc = LpΔx/λ");
    close(info.NF, (0.5e-3) ** 2 / (LAM * 0.1), 1e-12, "N_F");
    assert.equal(info.warnings.filter((w) => w.level === "warn").length, 0);
    const tfFar = P.samplingInfo(spec, g, { lambda: LAM, z: 10 * info.zc, method: "tf", pad: 2, bandLimit: false });
    assert.ok(tfFar.warnings.some((w) => /TF undersamples/.test(w.text)));
    const irNear = P.samplingInfo(spec, g, { lambda: LAM, z: 0.1 * info.zc, method: "ir", pad: 2 });
    assert.ok(irNear.warnings.some((w) => /IR undersamples/.test(w.text)));
    const frNear = P.samplingInfo(spec, g, { lambda: LAM, z: 0.1, method: "fraunhofer", pad: 2 });
    assert.ok(frNear.warnings.some((w) => /Fresnel number/.test(w.text)));
    const coarse = P.samplingInfo({ shape: "slit", a: 30e-6, b: 1e-3 }, g, { lambda: LAM, z: 0.1, method: "asm", pad: 2 });
    assert.ok(coarse.warnings.some((w) => /samples/.test(w.text)));
    // Matsushima limit tends to 1/λ at z → 0 and to Lp/(2λz) far away
    close(P.asmBandLimit(LAM, 0, 1e-2) * LAM, 1, 1e-12, "ulim(0)");
    close(P.asmBandLimit(LAM, 1e3, 1e-2) / (1e-2 / (2 * LAM * 1e3)), 1, 1e-6, "ulim(∞)");
});

test("brush strokes paint and erase with sub-pixel coverage; phase paint sets arg t", () => {
    const g = P.createGrid(64, 1e-3);
    const f = P.buildAperture({ shape: "open", strokes: [{ x: 0, y: 0, r: 1e-4, mode: "erase" }, { x: 2e-4, y: 0, r: 5e-5, mode: "paint", t: 1, p: Math.PI / 2 }] }, g);
    const c = 32 * 64 + 32;
    close(Math.hypot(f.re[c], f.im[c]), 0, 1e-12, "erased centre");
    const k = 32 * 64 + 32 + Math.round(2e-4 / g.dx);
    close(Math.atan2(f.im[k], f.re[k]), Math.PI / 2, 1e-9, "painted phase");
    // erased area ≈ πr² (coverage-weighted)
    let dark = 0;
    for (let i = 0; i < 64 * 64; i++) dark += 1 - Math.hypot(f.re[i], f.im[i]);
    close(dark * g.dx * g.dx / (Math.PI * 1e-8), 1, 0.04, "erased area");
});
