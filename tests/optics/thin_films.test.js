"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const tf = require("../../src/tools/shared/optics/thinFilms.js");
const fresnel = require("../../src/tools/shared/optics/fresnel.js");
const core = require("../../src/tools/shared/optics/core.js");

const DEG = Math.PI / 180;
const nm = 1e-9;
const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ""} expected ${b}, got ${a} (tol ${tol})`);
const cclose = (a, b, tol, msg) => assert.ok(Math.hypot(a.re - b.re, a.im - b.im) <= tol, `${msg || ""} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

test("no films reproduces single-interface fresnel.js (amplitudes, phases and powers) incl. TIR", () => {
    const cases = [[1, 1.5], [1.5, 1], [1.33, 2.4], [2.0, 1.2]];
    for (const [n1, n2] of cases) {
        for (let deg = 0; deg <= 89; deg += 1) {
            const th = deg * DEG;
            const ref = fresnel.solve(n1, n2, th);
            for (const method of ["abeles", "airy"]) {
                const s = tf.solve({ n0: n1, layers: [], ns: n2 }, 550 * nm, th, "s", { method });
                const p = tf.solve({ n0: n1, layers: [], ns: n2 }, 550 * nm, th, "p", { method });
                cclose(s.r, ref.rs, 1e-12, `rs ${n1}->${n2} ${deg}°`);
                cclose(p.r, ref.rp, 1e-12, `rp ${n1}->${n2} ${deg}°`);
                cclose(s.t, ref.ts, 1e-12, `ts ${n1}->${n2} ${deg}°`);
                cclose(p.t, ref.tp, 1e-11, `tp ${n1}->${n2} ${deg}°`);
                close(s.R, ref.Rs, 1e-12); close(p.R, ref.Rp, 1e-12);
                close(s.T, ref.Ts, 1e-12); close(p.T, ref.Tp, 1e-12);
            }
        }
    }
    // zero-thickness films are invisible
    const bare = tf.solve({ n0: 1, layers: [], ns: 1.5 }, 600 * nm, 30 * DEG, "p");
    const zero = tf.solve({ n0: 1, layers: [{ d: 0, n: 2.3 }, { d: 0, n: 1.38, k: 0.2 }], ns: 1.5 }, 600 * nm, 30 * DEG, "p");
    cclose(zero.r, bare.r, 1e-14); close(zero.T, bare.T, 1e-14);
});

test("lossless stacks conserve energy R + T = 1 for s and p at all angles, including TIR and frustrated TIR", () => {
    const rng = core.createRng(7);
    for (let trial = 0; trial < 40; trial++) {
        const L = 1 + Math.floor(rng.uniform() * 8);
        const layers = Array.from({ length: L }, () => ({ d: (5 + 400 * rng.uniform()) * nm, n: 1.2 + 1.3 * rng.uniform() }));
        const n0 = 1 + rng.uniform(), ns = 1 + rng.uniform();
        const st = { n0, layers, ns };
        for (let deg = 0; deg <= 89.5; deg += 2.5) {
            for (const pol of ["s", "p"]) {
                const r = tf.solve(st, (400 + 400 * rng.uniform()) * nm, deg * DEG, pol);
                close(r.R + r.T, 1, 1e-11, `trial ${trial} ${pol} ${deg}°`);
                assert.ok(r.R >= -1e-15 && r.T >= -1e-15);
            }
        }
    }
    // Frustrated TIR: glass | air gap | glass beyond the critical angle. T decays like exp(−2κd).
    const lam = 633 * nm, th = 50 * DEG, n = 1.5;
    const kappa = (2 * Math.PI / lam) * Math.sqrt(n * n * Math.sin(th) ** 2 - 1);
    let prev = Infinity;
    for (const gap of [50, 200, 400, 800, 1600]) {
        for (const pol of ["s", "p"]) {
            const r = tf.solve({ n0: n, layers: [{ d: gap * nm, n: 1 }], ns: n }, lam, th, pol);
            close(r.R + r.T, 1, 1e-12, "FTIR " + pol);
        }
        const T = tf.solve({ n0: n, layers: [{ d: gap * nm, n: 1 }], ns: n }, lam, th, "s").T;
        assert.ok(T < prev); prev = T;
        if (gap >= 800) { // asymptotic decay rate
            const T2 = tf.solve({ n0: n, layers: [{ d: (gap + 100) * nm, n: 1 }], ns: n }, lam, th, "s").T;
            close(Math.log(T / T2) / (100 * nm), 2 * kappa, 2 * kappa * 1e-3, "evanescent decay");
        }
    }
    // Pure TIR through a lossless stack into a low-index substrate: R = 1 exactly.
    const tir = tf.solve({ n0: 1.7, layers: [{ d: 100 * nm, n: 2.1 }, { d: 80 * nm, n: 1.4 }], ns: 1.0 }, 550 * nm, 70 * DEG, "p");
    close(tir.R, 1, 1e-12); close(tir.T, 0, 1e-15);
});

test("ideal quarter-wave AR film n = √(n0 ns) gives R = 0 at the design wavelength only", () => {
    const n0 = 1, ns = 1.52, nf = Math.sqrt(n0 * ns), lam = 550 * nm;
    const st = { n0, layers: [{ d: tf.quarterWave(lam, nf), n: nf }], ns };
    for (const pol of ["s", "p"]) close(tf.solve(st, lam, 0, pol).R, 0, 1e-15);
    const bare = ((ns - 1) / (ns + 1)) ** 2;
    // at twice the design frequency (λ/2) the film is a half-wave (absentee) layer: bare reflectance
    close(tf.solve(st, lam / 2, 0, "s").R, bare, 1e-14);
    // real MgF2 (n = 1.38) on BK7: residual R = ((n0 ns − n²)/(n0 ns + n²))²
    const mg = { n0, layers: [{ d: tf.quarterWave(lam, 1.38), n: 1.38 }], ns };
    close(tf.solve(mg, lam, 0, "s").R, ((ns - 1.38 ** 2) / (ns + 1.38 ** 2)) ** 2, 1e-14);
    // V-coat: two quarter waves with n2/n1 = sqrt(ns/n0) (outer layer 1)
    const n1 = 1.38, n2 = n1 * Math.sqrt(ns / n0);
    const v = { n0, layers: [{ d: tf.quarterWave(lam, n1), n: n1 }, { d: tf.quarterWave(lam, n2), n: n2 }], ns };
    close(tf.solve(v, lam, 0, "p").R, 0, 1e-15);
});

test("Bragg mirror (HL)^N H: peak R matches the admittance formula; stop band matches (2/π) asin((nH−nL)/(nH+nL))", () => {
    const n0 = 1, ns = 1.52, nH = 2.35, nL = 1.38, lam = 600 * nm;
    for (const N of [1, 3, 6, 10]) {
        const layers = [];
        for (let i = 0; i < N; i++) layers.push({ d: tf.quarterWave(lam, nH), n: nH }, { d: tf.quarterWave(lam, nL), n: nL });
        layers.push({ d: tf.quarterWave(lam, nH), n: nH });
        const R = tf.solve({ n0, layers, ns }, lam, 0, "s").R;
        const Y = (nH / nL) ** (2 * N) * nH * nH / ns; // independent: Y of QW stack
        close(R, ((n0 - Y) / (n0 + Y)) ** 2, 1e-12, "peak R N=" + N);
        close(tf.braggPeakR(n0, nH, nL, ns, N), R, 1e-12);
        // R is a maximum at λ0 (flat top)
        assert.ok(tf.solve({ n0, layers, ns }, lam * 1.01, 0, "s").R < R);
    }
    // band edges from the Bloch condition |½ Tr M_period| = 1
    const period = [{ d: tf.quarterWave(lam, nH), n: nH }, { d: tf.quarterWave(lam, nL), n: nL }];
    const num = tf.numericStopband(period, lam);
    const ana = tf.braggStopband(lam, nH, nL);
    close(lam / num.lamShort - 1, ana.dg, 1e-9, "short edge in g");
    close(1 - lam / num.lamLong, ana.dg, 1e-9, "long edge in g");
    const dg = (2 / Math.PI) * Math.asin((nH - nL) / (nH + nL));
    close(ana.fracApprox, (4 / Math.PI) * Math.asin((nH - nL) / (nH + nL)), 1e-15);
    close(ana.dg, dg, 1e-15);
    // A long mirror (N = 30): measured R > 0.5 region matches the band edges within 1 %
    const layers = [];
    for (let i = 0; i < 30; i++) layers.push(...period);
    layers.push(period[0]);
    const lams = core.linspace(400 * nm, 900 * nm, 5001);
    const sp = tf.spectrum({ n0, layers, ns }, lams, 0);
    // contiguous R > 0.5 region containing λ0
    let i0 = 0; while (lams[i0] < lam) i0++;
    let a = i0, b = i0;
    while (a > 0 && sp.Rs[a - 1] > 0.5) a--;
    while (b < lams.length - 1 && sp.Rs[b + 1] > 0.5) b++;
    const lo = lams[a], hi = lams[b];
    close((hi - lo) / ana.width, 1, 0.02, "measured stop band width");
});

test("absorbing films: A from the field integral equals 1 − R − T; methods agree where both are stable", () => {
    const k0 = (lam) => 2 * Math.PI / lam;
    const cases = [
        { st: { n0: 1, layers: [{ d: 45 * nm, n: 0.055, k: 3.32 }], ns: 1.52 }, lam: 550 * nm },
        { st: { n0: 1, layers: [{ d: 80 * nm, n: 2.0, k: 0.3 }, { d: 20 * nm, n: 0.96, k: 6.69 }, { d: 100 * nm, n: 1.46 }], ns: { n: 1.52, k: 0.01 } }, lam: 500 * nm },
        { st: { n0: 1.33, layers: [{ d: 300 * nm, n: 1.7, k: 0.05 }], ns: 1.0 }, lam: 633 * nm }
    ];
    for (const { st, lam } of cases) {
        for (const deg of [0, 30, 60, 75]) {
            for (const pol of ["s", "p"]) {
                const a = tf.solve(st, lam, deg * DEG, pol, { method: "abeles" });
                const b = tf.solve(st, lam, deg * DEG, pol, { method: "airy" });
                close(a.R, b.R, 1e-12, "R methods"); close(a.T, b.T, 1e-12, "T methods");
                cclose(a.r, b.r, 1e-12); cclose(a.t, b.t, 1e-12);
                assert.ok(b.A > -1e-14 && b.A < 1);
                const fp = tf.fieldProfile(st, lam, deg * DEG, pol, { samples: 400 });
                close(fp.R, b.R, 1e-12); close(fp.T, b.T, 1e-12);
                // absorbed fraction from Poynting: A_j = k0 ∫ Im(ε) |E|² dz / (n0 cosθ0)  (|E_inc| = 1)
                let Aint = 0;
                st.layers.forEach((L, j) => {
                    const epsIm = 2 * L.n * (L.k || 0);
                    if (!epsIm) return;
                    const n = 2001, h = L.d / (n - 1), ys = [];
                    for (let i = 0; i < n; i++) ys.push(fp.E2of(j + 1, i * h).E2);
                    const Aj = k0(lam) * epsIm * core.simpsonSamples(ys, h) / (st.n0 * Math.cos(deg * DEG));
                    close(Aj, fp.absorbed[j], 1e-8 + 1e-6 * Aj, "layer absorption " + j);
                    Aint += Aj;
                });
                const Asub = (1 - fp.R - fp.T);
                close(Aint, Asub, 1e-6, "total absorption");
            }
        }
    }
});

test("tangential E and H are continuous at every interface of the field profile", () => {
    const st = { n0: 1, layers: [{ d: 70 * nm, n: 2.3 }, { d: 30 * nm, n: 0.2, k: 3 }, { d: 120 * nm, n: 1.45 }], ns: 1.52 };
    for (const pol of ["s", "p"]) {
        const fp = tf.fieldProfile(st, 600 * nm, 40 * DEG, pol);
        for (let j = 0; j <= st.layers.length; j++) {
            const left = j === 0 ? fp.fields(0, 0) : fp.fields(j, st.layers[j - 1].d);
            const right = fp.fields(j + 1, 0);
            cclose(left.Et, right.Et, 1e-12); cclose(left.Ht, right.Ht, 1e-12);
        }
    }
});

test("thick absorbing layers stay finite: stable method is chosen automatically and tends to bulk metal", () => {
    const ag = { n: 0.055, k: 3.32 };
    const bulk = tf.solve({ n0: 1, layers: [], ns: ag }, 550 * nm, 0, "s");
    for (const d of [1e-6, 1e-4, 1e-2, 1]) { // 1 µm … 1 m of silver
        const st = { n0: 1, layers: [{ d, ...ag }, { d: 100 * nm, n: 1.46 }], ns: 1.52 };
        for (const pol of ["s", "p"]) {
            for (const deg of [0, 45, 85]) {
                const r = tf.solve(st, 550 * nm, deg * DEG, pol);
                assert.equal(r.method, "airy");
                assert.ok(Number.isFinite(r.R) && Number.isFinite(r.T) && Number.isFinite(r.A));
                close(r.T, 0, 1e-12);
                if (deg === 0) close(r.R, bulk.R, 1e-10, "thick Ag → bulk R");
            }
        }
        const fp = tf.fieldProfile(st, 550 * nm, 0, "p", { samples: 300 });
        assert.ok(fp.E2.every(Number.isFinite));
    }
    // the characteristic-matrix product itself overflows for a 1 m layer (why "auto" switches)
    const bad = tf.solve({ n0: 1, layers: [{ d: 1, ...ag }], ns: 1.52 }, 550 * nm, 0, "s", { method: "abeles" });
    assert.ok(!Number.isFinite(bad.R) || !Number.isFinite(bad.T));
    // … and the spectrum/comparison flags that disagreement instead of hiding it
    const cmp = tf.compareMethods({ n0: 1, layers: [{ d: 1, ...ag }], ns: 1.52 }, 550 * nm, 0);
    assert.equal(cmp.abelesStable, false);
    // thick lossless evanescent barrier (deep FTIR) also stays finite
    const ftir = tf.solve({ n0: 1.5, layers: [{ d: 50e-6, n: 1 }], ns: 1.5 }, 550 * nm, 60 * DEG, "p");
    assert.ok(Number.isFinite(ftir.R)); close(ftir.R, 1, 1e-12);
});

test("reciprocity: transmittance is the same in both directions, even with absorption", () => {
    const layers = [{ d: 60 * nm, n: 2.1, k: 0.1 }, { d: 25 * nm, n: 0.96, k: 6.69 }, { d: 90 * nm, n: 1.38 }];
    const n0 = 1.0, ns = 1.52, lam = 520 * nm;
    for (const deg of [0, 20, 40]) {
        const kx = n0 * Math.sin(deg * DEG);
        for (const pol of ["s", "p"]) {
            const fwd = tf.solve({ n0, layers, ns }, lam, deg * DEG, pol);
            const rev = tf.solve({ n0: ns, layers: layers.slice().reverse(), ns: n0 }, lam, 0, pol, { kx });
            close(fwd.T, rev.T, 1e-12, "T reciprocity " + pol);
        }
    }
});

test("incoherent thick substrate: equals the phase average of the coherent result; bare slab gives 2R/(1+R)", () => {
    const ns = 1.52, R1 = ((ns - 1) / (ns + 1)) ** 2;
    const slab = tf.withBackside({ n0: 1, layers: [], ns }, 550 * nm, 0, "s", { mode: "incoherent", thickness: 1e-3, ne: 1 });
    close(slab.R, 2 * R1 / (1 + R1), 1e-14);
    close(slab.R + slab.T, 1, 1e-14);
    // coherent substrate averaged over many fringes → incoherent result
    const st = { n0: 1, layers: [{ d: tf.quarterWave(550 * nm, 1.38), n: 1.38 }], ns };
    const inc = tf.withBackside(st, 550 * nm, 20 * DEG, "p", { mode: "incoherent", thickness: 1e-3, ne: 1 });
    const lams = core.linspace(540 * nm, 560 * nm, 40001);
    let Rsum = 0;
    for (const l of lams) Rsum += tf.withBackside(st, l, 20 * DEG, "p", { mode: "coherent", thickness: 1e-3, ne: 1 }).R;
    close(Rsum / lams.length, inc.R, 1e-4, "phase average");
    // absorbing substrate: single-pass attenuation τ = exp(−4π κ D cosθ'/λ) at normal incidence
    const absb = tf.withBackside({ n0: 1, layers: [], ns: { n: 1.5, k: 1e-5 } }, 500 * nm, 0, "s", { mode: "incoherent", thickness: 1e-3, ne: 1 });
    close(absb.tau, Math.exp(-4 * Math.PI * 1e-5 * 1e-3 / 500e-9), 1e-12);
    assert.ok(absb.A > 0.2);
});

test("symmetry and limits: s and p coincide at normal incidence; half-wave layer is absentee", () => {
    const st = { n0: 1, layers: [{ d: 83 * nm, n: 2.2, k: 0.02 }, { d: 140 * nm, n: 1.45 }], ns: 1.6 };
    const s = tf.solve(st, 700 * nm, 0, "s"), p = tf.solve(st, 700 * nm, 0, "p");
    close(s.R, p.R, 1e-14); close(s.T, p.T, 1e-14);
    cclose(p.r, { re: -s.r.re, im: -s.r.im }, 1e-14);
    const lam = 600 * nm;
    const hw = tf.solve({ n0: 1, layers: [{ d: lam / (2 * 1.9), n: 1.9 }], ns: 1.5 }, lam, 0, "s");
    close(hw.R, 0.04, 1e-14);
});

test("interference colour: zero-thickness soap film is black, a perfect mirror is neutral white", () => {
    const white = tf.colourOf(() => 1);
    close(white.Y, 1, 1e-12);
    assert.deepEqual(white.rgb, [255, 255, 255]);
    // chromaticity of the ~6500 K illuminant lies near D65 (0.3127, 0.3290)
    close(white.x, 0.3127, 0.01); close(white.y, 0.329, 0.01);
    const soap = tf.thicknessScan({ n0: 1, layers: [{ d: 0, n: 1.33 }], ns: 1 }, 0, 1200 * nm, 25, 550 * nm, 0, "u");
    close(soap.R[0], 0, 1e-15);
    close(soap.colours[0].Y, 0, 1e-15);
    // thin-film maxima: R at 550 nm peaks where 2 n d = (m + ½) λ  → d = 103 nm for m = 0
    const fine = tf.thicknessScan({ n0: 1, layers: [{ d: 0, n: 1.33 }], ns: 1 }, 0, 206.8 * nm, 2001, 550 * nm, 0, "s", false);
    let im = 0; fine.R.forEach((r, i) => { if (r > fine.R[im]) im = i; });
    close(fine.d[im], 550 * nm / (4 * 1.33), 0.2 * nm);
    // CIE fit sanity: ȳ peaks near 555 nm
    let best = 0, bestNm = 0;
    for (let l = 500; l <= 600; l++) { const y = tf.cmf(l)[1]; if (y > best) { best = y; bestNm = l; } }
    close(bestNm, 557, 4);
});

test("input validation", () => {
    assert.throws(() => tf.solve({ n0: 0, layers: [], ns: 1.5 }, 500 * nm, 0));
    assert.throws(() => tf.solve({ n0: 1, layers: [{ d: -1, n: 1.5 }], ns: 1.5 }, 500 * nm, 0));
    assert.throws(() => tf.solve({ n0: 1, layers: [{ d: 1e-7, n: 1.5, k: -0.1 }], ns: 1.5 }, 500 * nm, 0));
    assert.throws(() => tf.solve({ n0: 1, layers: [], ns: 1.5 }, 500 * nm, 0, "x"));
});
