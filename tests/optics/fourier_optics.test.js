"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fo = require("../../src/tools/shared/optics/fourierOptics.js");
const core = require("../../src/tools/shared/optics/core.js");

const LAMBDA = 550e-9;
const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ""} got ${a}, expected ${b} ± ${tol}`);

test("Zernike: Noll indices map to the standard (n, m) table", () => {
    const expected = [[0, 0], [1, 1], [1, -1], [2, 0], [2, -2], [2, 2], [3, -1], [3, 1], [3, -3], [3, 3], [4, 0]];
    expected.forEach(([n, m], i) => assert.deepEqual(fo.nollToNM(i + 1), { n, m }, "j = " + (i + 1)));
});

test("Zernike: Noll normalisation gives an orthonormal set over the unit disk", () => {
    // midpoint quadrature in polar coordinates (independent of the pupil grid)
    const js = [2, 3, 4, 5, 6, 7, 8, 11];
    const nr = 200, nt = 256;
    const inner = (a, b) => {
        let s = 0;
        for (let i = 0; i < nr; i++) {
            const r = (i + 0.5) / nr;
            for (let k = 0; k < nt; k++) {
                const t = (k + 0.5) / nt * 2 * Math.PI;
                s += fo.zernike(a, r, t) * fo.zernike(b, r, t) * r;
            }
        }
        return s * (1 / nr) * (2 * Math.PI / nt) / Math.PI;
    };
    for (const a of js) for (const b of js) close(inner(a, b), a === b ? 1 : 0, 2e-3, `<Z${a},Z${b}>`);
    // explicit forms
    close(fo.zernike(4, 1, 0), Math.sqrt(3), 1e-12, "Z4(1)");
    close(fo.zernike(11, 0, 0), Math.sqrt(5), 1e-12, "Z11(0)");
    close(fo.zernike(8, 1, 0), Math.sqrt(8), 1e-12, "Z8(1, 0)");
});

test("circular pupil → Airy PSF; first zero at 0.61 λ/NA within the grid resolution", () => {
    for (const NA of [0.3, 0.5, 0.8]) {
        const r = fo.simulate({ object: "point", NA, N: 256, fov: 16e-6, lambda: LAMBDA });
        const zero = r.readouts.psfFirstZero;
        close(zero, 0.6098 * LAMBDA / NA, r.grid.dx / 2, "NA " + NA + " first zero");
        // profile against [2J1(v)/v]² near the core
        const c = r.grid.N / 2;
        for (let i = c; i < c + Math.round(1.5 * zero / r.grid.dx); i++) {
            close(r.cuts.psf[i], fo.airy(r.grid.x[i], LAMBDA, NA), 5e-3, "Airy profile at x = " + r.grid.x[i]);
        }
    }
    assert.ok(Math.abs(fo.RAYLEIGH_K - 0.6098) < 1e-4);
});

test("changing NA scales the PSF and the resolution as 1/NA", () => {
    const a = fo.simulate({ object: "point", NA: 0.4, N: 256, fov: 20e-6 });
    const b = fo.simulate({ object: "point", NA: 0.8, N: 256, fov: 20e-6 });
    close(a.readouts.psfFirstZero / b.readouts.psfFirstZero, 2, 0.06, "zero ratio");
    close(b.readouts.incoherentCutoffMeasured / a.readouts.incoherentCutoffMeasured, 2, 0.06, "cutoff ratio");
    // two points at a fixed separation: resolved at high NA, not at low NA
    const sep = 0.61 * LAMBDA / 0.4 * 0.7;
    const lo = fo.simulate({ object: "twoPoints", sep, NA: 0.4 });
    const hi = fo.simulate({ object: "twoPoints", sep, NA: 0.8 });
    assert.ok(lo.readouts.twoPoint.dipRatio > 0.95, "unresolved at NA 0.4");
    assert.ok(hi.readouts.twoPoint.dipRatio < 0.5, "resolved at NA 0.8");
});

test("incoherent cutoff 2NA/λ (MTF zero) and coherent cutoff NA/λ (CTF edge)", () => {
    for (const NA of [0.25, 0.5, 0.9]) {
        const r = fo.simulate({ object: "point", NA, N: 256, fov: 16e-6 });
        const df = r.grid.df;
        close(r.readouts.incoherentCutoffMeasured, 2 * NA / LAMBDA, 1.5 * df, "MTF zero NA " + NA);
        close(r.readouts.coherentCutoffMeasured, NA / LAMBDA, df, "CTF edge NA " + NA);
        // MTF is exactly zero well beyond 2fc (compact autocorrelation support)
        const c = r.grid.N / 2, iBeyond = c + Math.ceil((2 * NA / LAMBDA) / df) + 3;
        if (iBeyond < r.grid.N) assert.ok(r.cuts.mtf[iBeyond] < 1e-9, "MTF beyond cutoff");
    }
});

test("diffraction-limited MTF matches the analytic circular-pupil formula (convergence with pupil sampling)", () => {
    const err = (fov) => {
        const r = fo.simulate({ object: "point", NA: 0.5, N: 256, fov });
        let e = 0;
        for (let i = r.grid.N / 2; i < r.grid.N; i++) e = Math.max(e, Math.abs(r.cuts.mtf[i] - fo.mtfCircular(r.grid.f[i], LAMBDA, 0.5)));
        return e;
    };
    // pupil radius ≈ 7 vs ≈ 22 samples: the edge-sampling error falls ≈ 1/radius (first order)
    const coarse = err(8e-6), fine = err(24e-6);
    assert.ok(fine < 0.015, "fine error " + fine);
    close(coarse / fine, 3, 0.6, "first-order convergence ratio");
});

test("flat pupil phase reproduces the unaberrated reference (Strehl = 1)", () => {
    const ref = fo.simulate({ object: "point" });
    const zero = fo.simulate({ object: "point", zernike: { 4: 0, 6: 0, 8: 0, 11: 0 }, dz: 0 });
    close(zero.readouts.strehl, 1, 1e-12, "Strehl");
    close(ref.readouts.rmsWaves, 0, 1e-15, "RMS");
    for (let k = 0; k < ref.psf.I.length; k += 97) close(zero.psf.I[k], ref.psf.I[k], 1e-12);
    // piston alone changes nothing measurable
    const piston = fo.simulate({ object: "point", zernike: { 1: 0.3 } });
    close(piston.readouts.strehl, 1, 1e-9, "piston Strehl");
});

test("Maréchal: small Zernike RMS ω gives Strehl ≈ exp[−(2πω)²]", () => {
    for (const j of [4, 6, 8, 11]) {
        for (const w of [0.02, 0.05]) {
            const r = fo.simulate({ object: "point", NA: 0.5, zernike: { [j]: w } });
            close(r.readouts.rmsWaves, w, 0.004, "numerical RMS of Z" + j);
            close(r.readouts.strehl, fo.marechal(w), 0.006, "Z" + j + " ω = " + w);
        }
    }
    // defocus has an exact on-axis result: S = sinc²(π W20), W20 = 2√3 c4 (P-V waves)
    const c4 = 0.08;
    const r = fo.simulate({ object: "point", zernike: { 4: c4 } });
    const x = Math.PI * 2 * Math.sqrt(3) * c4;
    close(r.readouts.strehlOnAxis, (Math.sin(x) / x) ** 2, 0.004, "defocus sinc²");
});

test("tilt shifts the PSF without changing its peak (Strehl stays 1)", () => {
    // Z2 = 2ρ cosθ, c waves RMS → W = 2c (fx/fc) waves → h(x) centred at x = −2c/fc
    const c = 0.5, NA = 0.5, r = fo.simulate({ object: "point", NA, zernike: { 2: c } });
    close(r.readouts.psfPeakOffset.x, -2 * c * LAMBDA / NA, r.grid.dx, "tilt shift");
    close(r.readouts.strehl, 1, 0.02, "tilt Strehl (peak, pixel-sampled)");
});

test("defocus: exact angular-spectrum phase and depth of focus λ/NA²", () => {
    const NA = 0.3, grid = fo.makeGrid(256, 30e-6);
    const pupil = fo.makePupil(grid, { lambda: LAMBDA, NA });
    const dofHalf = fo.depthOfFocus(LAMBDA, NA) / 2;
    const [i0, iHalf, iZero] = fo.throughFocus(grid, pupil, LAMBDA, [0, dofHalf, 4 * dofHalf]);
    close(i0, 1, 1e-12, "in focus");
    // quarter-wave paraxial defocus → sinc²(π/4) = 0.811; exact phase deviates slightly at NA 0.3
    close(iHalf, fo.axialIntensityParaxial(dofHalf, LAMBDA, NA), 0.02, "edge of DOF");
    assert.ok(iZero < 0.03, "first axial zero near 2λ/NA²: " + iZero);
    // symmetry of the axial response for the unaberrated pupil (paraxial limit)
    const [a, b] = fo.throughFocus(grid, fo.makePupil(grid, { lambda: LAMBDA, NA: 0.1 }), LAMBDA, [2e-6, -2e-6]);
    close(a, b, 1e-3, "±Δz symmetry at low NA");
});

test("energy: coherent imaging conserves power when the pupil passes the whole spectrum; OTF(0) = 1", () => {
    const r = fo.simulate({ object: "letters", mode: "coherent", NA: 0.95, fov: 64e-6, N: 128, nu: 0.5e6, lambda: 400e-9 });
    // fc = 2.375/µm is beyond Nyquist (1/µm): the aperture passes every sample
    let po = 0, pi = 0;
    for (let k = 0; k < r.image.I.length; k++) { po += r.object.intensity[k]; pi += r.image.I[k]; }
    close(pi / po, 1, 1e-9, "Parseval");
    const inc = fo.simulate({ object: "bars", mode: "incoherent", NA: 0.4, nu: 1e6 });
    const c = inc.grid.N / 2;
    close(inc.otf.re[c * inc.grid.N + c], 1, 1e-12, "OTF(0)");
    let so = 0, si = 0;
    for (let k = 0; k < inc.image.I.length; k++) { so += inc.object.intensity[k]; si += inc.image.I[k]; }
    close(si / so, 1, 1e-6, "incoherent image conserves integrated intensity (unfiltered pupil)");
});

test("incoherent sinusoid: image modulation = MTF(ν); coherent image of ν > NA/λ is uniform", () => {
    const NA = 0.5, fc = NA / LAMBDA;
    for (const ratio of [0.4, 0.9, 1.4]) {
        const r = fo.simulate({ object: "sinusoid", nu: ratio * fc, NA, mode: "incoherent" });
        const t = r.readouts.target;
        close(t.imageModulation / t.objectModulation, fo.mtfCircular(t.nu, LAMBDA, NA), 0.02, "ν/fc = " + ratio);
    }
    const coh = fo.simulate({ object: "sinusoid", nu: 1.4 * fc, NA, mode: "coherent" });
    assert.ok(coh.readouts.target.imageModulation < 0.03, "coherent beyond NA/λ: " + coh.readouts.target.imageModulation);
    const cohIn = fo.simulate({ object: "sinusoid", nu: 0.5 * fc, NA, mode: "coherent" });
    assert.ok(cohIn.readouts.target.imageModulation > 0.9, "coherent inside NA/λ passes the fundamental");
    // beyond 2NA/λ nothing is imaged in either mode
    const dead = fo.simulate({ object: "sinusoid", nu: 2.3 * fc, NA, mode: "incoherent" });
    assert.ok(dead.readouts.target.imageModulation < 1e-3);
});

test("two points: Rayleigh separation gives the 73.5 % incoherent dip; coherent in-phase points are unresolved", () => {
    const NA = 0.5, sep = fo.rayleigh(LAMBDA, NA);
    const inc = fo.simulate({ object: "twoPoints", sep, NA, mode: "incoherent", fov: 20e-6 });
    close(inc.readouts.twoPoint.dipRatio, 0.735, 0.01, "incoherent dip");
    const coh = fo.simulate({ object: "twoPoints", sep, NA, mode: "coherent", fov: 20e-6 });
    assert.ok(coh.readouts.twoPoint.dipRatio > 1, "in-phase coherent points merge");
    const anti = fo.simulate({ object: "twoPoints", sep, NA, mode: "coherent", pointPhase: Math.PI, fov: 20e-6 });
    assert.ok(anti.readouts.twoPoint.mid < 1e-6 * anti.readouts.twoPoint.peak, "antiphase points: dark midpoint");
    // mirror symmetry of a symmetric object and pupil
    const row = inc.cuts.image, N = inc.grid.N;
    for (let i = 1; i < N / 2; i += 7) close(row[N / 2 + i], row[N / 2 - i], 1e-9 * inc.readouts.twoPoint.peak);
});

test("coma breaks the mirror symmetry of the PSF; spherical keeps it", () => {
    const asym = (r) => { const p = r.cuts.psf, N = r.grid.N; let s = 0; for (let i = 1; i < 20; i++) s += Math.abs(p[N / 2 + i] - p[N / 2 - i]); return s; };
    assert.ok(asym(fo.simulate({ object: "point", zernike: { 8: 0.15 } })) > 1e-2);
    assert.ok(asym(fo.simulate({ object: "point", zernike: { 11: 0.15 } })) < 1e-9);
});

test("phase object: invisible in bright field, visible with Zernike phase contrast and dark field", () => {
    const base = { object: "phase", mode: "coherent", NA: 0.9, phi: 0.1, fov: 16e-6 };
    const bf = fo.simulate(base);
    assert.ok(bf.readouts.image.contrast < 0.01, "bright field contrast " + bf.readouts.image.contrast);
    const pc = fo.simulate(Object.assign({}, base, { filter: "phasecontrast", r1: 0.02 }));
    // weak phase: I ≈ (1 + φ)² → intensity step ≈ 2φ per phase step
    const c = pc.grid.N / 2, N = pc.grid.N;
    const inside = pc.image.I[c * N + c - Math.round(0.12 * N)], outside = pc.image.I[c * N + 4];
    close(inside - outside, 2 * 0.1, 0.06, "phase-contrast step");
    const dfm = fo.simulate(Object.assign({}, base, { filter: "darkfield", r1: 0.02 }));
    assert.ok(dfm.image.I[c * N + 4] < 1e-3, "dark background");
    assert.ok(dfm.readouts.image.max > 0.01, "edges scatter into the dark field");
    // incoherent imaging of a pure phase object shows nothing whatever the filter
    const inc = fo.simulate(Object.assign({}, base, { mode: "incoherent", filter: "phasecontrast", r1: 0.02 }));
    assert.ok(inc.readouts.image.contrast < 1e-9);
});

test("filters: low-pass narrows the MTF support, high-pass removes the mean, knife edge is one-sided", () => {
    const lp = fo.simulate({ object: "point", filter: "lowpass", r1: 0.5 });
    close(lp.readouts.incoherentCutoffMeasured, lp.readouts.fc, 1.5 * lp.grid.df, "low-pass halves the incoherent cutoff");
    const hp = fo.simulate({ object: "letters", mode: "coherent", filter: "highpass", r1: 0.2, nu: 1e6 });
    const kc = (hp.grid.N / 2) * hp.grid.N + hp.grid.N / 2;
    assert.equal(hp.pupil.sys.re[kc], 0);
    const kn = fo.makePupil(fo.makeGrid(64, 16e-6), { lambda: LAMBDA, NA: 0.5, filter: { type: "knife" } });
    const g = fo.makeGrid(64, 16e-6), row = 32 * 64;
    assert.equal(kn.sys.re[row + 30], 0);
    assert.equal(kn.sys.re[row + 34], 1);
    close(fo.filterValue("phasecontrast", 0, 0, 1e6, 0.1, 1, g.df).im, 1, 0, "π/2 dot");
});

test("centred FFT helpers: forward/inverse round trip and delta ↔ constant", () => {
    const N = 32, rng = core.createRng(7);
    const re = new Float64Array(N * N).map(() => rng.normal()), im = new Float64Array(N * N).map(() => rng.normal());
    const F = fo.fftCentered(re, im, N), B = fo.fftCentered(F.re, F.im, N, true);
    for (let k = 0; k < N * N; k++) { close(B.re[k], re[k], 1e-12); close(B.im[k], im[k], 1e-12); }
    const d = new Float64Array(N * N); d[(N / 2) * N + N / 2] = 1;
    const D = fo.fftCentered(d, new Float64Array(N * N), N);
    for (let k = 0; k < N * N; k += 13) { close(D.re[k], 1, 1e-12); close(D.im[k], 0, 1e-12); }
});

test("sampling warnings flag aliasing and under-sampled pupils", () => {
    assert.ok(fo.simulate({ object: "point", fov: 80e-6, N: 128, NA: 0.9, lambda: 400e-9 }).warnings.some((w) => /Nyquist/.test(w)));
    assert.ok(fo.simulate({ object: "point", fov: 4e-6, NA: 0.1 }).warnings.some((w) => /Pupil spans/.test(w)));
    assert.equal(fo.simulate({ object: "point" }).warnings.length, 0);
    assert.throws(() => fo.simulate({ mode: "partial" }), RangeError);
});
