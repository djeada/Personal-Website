"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const res = require("../../src/tools/shared/optics/resonator.js");
const core = require("../../src/tools/shared/optics/core.js");

const c = core.constants.c;
const C = core.complex;
const close = (a, b, rel, msg) => assert.ok(Math.abs(a - b) <= rel * Math.max(Math.abs(a), Math.abs(b), 1e-300), `${msg}: ${a} vs ${b}`);

/** Golden-section maximum of f on [a, b]. */
function argmax(f, a, b, it = 200) {
    const gr = (Math.sqrt(5) - 1) / 2;
    let x1 = b - gr * (b - a), x2 = a + gr * (b - a), f1 = f(x1), f2 = f(x2);
    for (let i = 0; i < it; i++) {
        if (f1 > f2) { b = x2; x2 = x1; f2 = f1; x1 = b - gr * (b - a); f1 = f(x1); }
        else { a = x1; x1 = x2; f1 = f2; x2 = a + gr * (b - a); f2 = f(x2); }
    }
    return (a + b) / 2;
}
/** Bisection root of f on [a, b] (sign change). */
function root(f, a, b) {
    let fa = f(a);
    for (let i = 0; i < 200; i++) {
        const m = (a + b) / 2, fm = f(m);
        if ((fm > 0) === (fa > 0)) { a = m; fa = fm; } else b = m;
    }
    return (a + b) / 2;
}
/** Locate two adjacent transmission peaks by scanning, return their spacing (Hz). */
function measuredFSR(cav, guessFSR) {
    const T = (nu) => res.response(cav, nu).T;
    const lo = cav.nu0, N = 4000, span = 2.2 * guessFSR;
    const peaks = [];
    let prev = T(lo - 1e-9 * span), cur = T(lo);
    for (let i = 1; i <= N && peaks.length < 2; i++) {
        const nu = lo + span * i / N, nx = T(nu);
        if (cur > prev && cur >= nx) peaks.push(argmax(T, lo + span * (i - 2) / N, nu));
        prev = cur; cur = nx;
    }
    assert.equal(peaks.length, 2, "found two peaks");
    return peaks[1] - peaks[0];
}

test("nondispersive FSR equals c/(2nL), measured from the Airy peaks", () => {
    for (const [L, n] of [[0.01, 1], [0.05, 1.5], [0.002, 3.2]]) {
        const cav = res.cavity({ R1: 0.8, R2: 0.8, L, n, lambda0: 1064e-9 });
        const fsr = measuredFSR(cav, c / (2 * n * L));
        close(fsr, c / (2 * n * L), 1e-6, `FSR L=${L} n=${n}`);
    }
});

test("dispersive filling: peak spacing uses the group index", () => {
    const L = 0.01, n = 1.45, ng = 1.47;
    const cav = res.cavity({ R1: 0.9, R2: 0.9, L, n, ng, lambda0: 800e-9 });
    const fsr = measuredFSR(cav, c / (2 * ng * L));
    close(fsr, c / (2 * ng * L), 1e-6, "FSR dispersive");
    assert.ok(Math.abs(fsr - c / (2 * n * L)) / fsr > 1e-2, "phase-index FSR would be wrong");
    // absolute resonance still satisfies the phase condition with the phase index at ν0:
    // 2L[nν0 + ng(ν−ν0)]/c = integer
    const qv = 2 * L * (n * cav.nu0 + ng * (cav.nuRes - cav.nu0)) / c;
    assert.ok(Math.abs(qv - Math.round(qv)) < 1e-6, "resonance order integer");
});

test("symmetric lossless Fabry–Pérot reaches T = 1 on resonance and R + T = 1 everywhere", () => {
    for (const R of [0.04, 0.5, 0.9, 0.999]) {
        const cav = res.cavity({ R1: R, R2: R, L: 0.02, lambda0: 633e-9 });
        const peak = argmax((nu) => res.response(cav, nu).T, cav.nuRes - 0.3 * cav.fsr, cav.nuRes + 0.3 * cav.fsr);
        close(res.response(cav, peak).T, 1, 1e-9, `T_max R=${R}`);
        for (let k = 0; k < 50; k++) {
            const o = res.response(cav, cav.nuRes + cav.fsr * k / 37);
            close(o.R + o.T, 1, 1e-12, "energy conservation");
        }
    }
    // asymmetric lossless: T_max = 4√(T1T2 R1R2)... standard (1−R1)(1−R2)/(1−√(R1R2))² < 1
    const cav = res.cavity({ R1: 0.99, R2: 0.9, L: 0.02 });
    close(res.response(cav, cav.nuRes).T, 0.01 * 0.1 / Math.pow(1 - Math.sqrt(0.891), 2), 1e-12, "impedance-mismatched T");
});

test("internal loss: R + T + absorbed = 1 with absorbed from the travelling-wave powers", () => {
    const cav = res.cavity({ R1: 0.95, R2: 0.9, loss: 0.02, L: 0.01, lambda0: 1550e-9 });
    for (const f of [0, 0.013, 0.25, 0.5]) {
        const nu = cav.nuRes + f * cav.fsr;
        const o = res.response(cav, nu);
        // independent bookkeeping: forward wave power at z=0+, loses (1−A) on each pass
        const Pf = o.circ, lost = Pf * (1 - cav.A) + Pf * cav.A * cav.R2 * (1 - cav.A);
        close(o.R + o.T + lost, 1, 1e-12, `balance f=${f}`);
        // and from the spatial field: ∫ α(|E+|² + |E−|²) dz
        const zs = core.linspace(0, cav.L, 2001);
        const fld = res.intracavityField(cav, nu, zs);
        const integrand = Array.from(zs, (_, i) => cav.alpha * (fld.fwd2[i] + fld.bwd2[i]));
        close(core.simpsonSamples ? core.simpsonSamples(integrand, zs[1] - zs[0]) : core.trapz(integrand, zs[1] - zs[0]), lost, 1e-6, "spatial absorption");
    }
});

test("finesse: exact from the measured FWHM, ≈ π√R/(1−R) for high R", () => {
    for (const R of [0.5, 0.9, 0.99, 0.999]) {
        const cav = res.cavity({ R1: R, R2: R, L: 0.03 });
        const T = (nu) => res.response(cav, nu).T;
        const half = cav.Tmax / 2;
        const hi = root((nu) => T(nu) - half, cav.nuRes, cav.nuRes + 0.5 * cav.fsr);
        const lo = root((nu) => T(nu) - half, cav.nuRes - 0.5 * cav.fsr, cav.nuRes);
        const Fmeas = cav.fsr / (hi - lo);
        close(cav.finesse, Fmeas, 1e-7, `exact finesse R=${R}`);
        const approx = Math.PI * Math.sqrt(R) / (1 - R);
        if (R >= 0.99) close(cav.finesse, approx, 1e-4, `high-R approximation R=${R}`);
    }
    // below ρ = 3 − 2√2 the Airy peaks never drop to half: finesse undefined
    const low = res.cavity({ R1: 0.1, R2: 0.1, L: 0.01 });
    assert.ok(Number.isNaN(low.finesse));
});

test("ring-down from an explicit round-trip sum decays with τ_p = −T_rt/ln S", () => {
    const cav = res.cavity({ R1: 0.98, R2: 0.95, loss: 0.01, L: 0.3, lambda0: 1064e-9 });
    const S = 0.98 * 0.95 * 0.99 * 0.99;
    close(cav.S, S, 1e-14, "survival factor");
    // explicit loop: circulating field inside mirror 1, fed until steady, then input off
    const delta = res.roundTripPhase(cav, cav.nuRes);
    const g = C.fromPolar(Math.sqrt(0.98 * 0.95) * 0.99, delta);
    let E = C.ZERO;
    const t1 = C.cx(Math.sqrt(1 - 0.98));
    for (let i = 0; i < 3000; i++) E = C.add(t1, C.mul(g, E));
    const P = [];
    for (let i = 0; i < 400; i++) { E = C.mul(g, E); P.push(C.abs2(E)); }
    // least-squares slope of ln P vs t
    let sx = 0, sy = 0, sxx = 0, sxy = 0;
    P.forEach((p, i) => { const x = (i + 1) * cav.Trt, y = Math.log(p); sx += x; sy += y; sxx += x * x; sxy += x * y; });
    const k = P.length, slope = (k * sxy - sx * sy) / (k * sxx - sx * sx);
    close(-1 / slope, cav.tauP, 1e-9, "fitted lifetime");
    // model time response agrees with the loop at the samples
    const tr = res.timeResponse(cav, cav.nuRes, 3000, 50);
    close(tr.Pc[3000 + 9] / tr.Pc[2999], Math.pow(S, 10), 1e-9, "model ring-down ratio");
    // high-finesse limit: 2π τ_p Δν → 1
    const hf = res.cavity({ R1: 0.9999, R2: 0.9999, L: 0.1 });
    close(2 * Math.PI * hf.tauP * hf.fwhm, 1, 1e-4, "τ_p Δν");
});

test("buildup converges to the steady-state Airy value", () => {
    const cav = res.cavity({ R1: 0.9, R2: 0.9, L: 0.05 });
    for (const f of [0, 0.004, 0.1]) {
        const nu = cav.nuRes + f * cav.fsr;
        const tr = res.timeResponse(cav, nu, 800, 0);
        close(tr.Pt[799], res.response(cav, nu).T, 1e-12, "steady T");
        // first transmitted pulse is the single-pass value
        close(tr.Pt[0], 0.1 * 0.1, 1e-12, "first pass");
    }
});

test("stability: round-trip matrix criterion |(A+D)/2| ≤ 1 ⇔ 0 ≤ g1g2 ≤ 1", () => {
    const L = 0.1;
    for (let g1 = -2.05; g1 <= 2.05; g1 += 0.1) {
        for (let g2 = -2.05; g2 <= 2.05; g2 += 0.1) {
            const M = res.roundTripMatrix(L, res.radiusFromG(L, g1), res.radiusFromG(L, g2));
            close(core.mat2.det(M), 1, 1e-9, "unimodular");
            const st = res.stability(M);
            const p = g1 * g2;
            assert.equal(st.stable, p > 0 && p < 1, `g1=${g1} g2=${g2}`);
            close(st.m, 2 * p - 1, 1e-9, "m = 2g1g2 − 1");
        }
    }
    const b = (g1, g2) => res.stability(res.roundTripMatrix(L, res.radiusFromG(L, g1), res.radiusFromG(L, g2))).status;
    assert.equal(b(1, 1), "marginal"); // planar
    assert.equal(b(-1, -1), "marginal"); // concentric
    assert.equal(b(0, 0), "marginal"); // symmetric confocal: M = −I
    assert.equal(b(0, 0.6), "marginal"); // g1g2 = 0 edge
    assert.equal(res.classifyBoundary(0, 0).key, "confocal");
    assert.equal(res.classifyBoundary(1, 1).key, "planar");
    assert.equal(res.classifyBoundary(-1, -1).key, "concentric");
    const Mconf = res.roundTripMatrix(L, L, L);
    assert.ok(Math.abs(Mconf[0][0] + 1) < 1e-12 && Math.abs(Mconf[1][1] + 1) < 1e-12 && Math.abs(Mconf[0][1]) < 1e-12);
});

test("self-consistent q reproduces itself and matches the analytic two-mirror waist", () => {
    const L = 0.25, lam = 1064e-9, n = 1;
    for (const [Rc1, Rc2] of [[0.5, 0.5], [1.0, Infinity], [0.3, 0.8], [-1.5, 0.2], [0.15, 0.15]]) {
        const md = res.gaussianMode(L, Rc1, Rc2, lam, n);
        if (md.status !== "stable") continue;
        const back = res.applyABCD(md.M, md.q1);
        assert.ok(C.isClose(back, md.q1, 1e-12 * L), "q is an eigenmode");
        const { g1, g2 } = md;
        const den = g1 + g2 - 2 * g1 * g2;
        const w0sq = (L * lam / Math.PI) * Math.sqrt(g1 * g2 * (1 - g1 * g2) / (den * den));
        const z1 = g2 * (1 - g1) * L / den; // waist distance from mirror 1
        close(md.w0 * md.w0, w0sq, 1e-9, `w0 ${Rc1},${Rc2}`);
        close(md.zWaist, z1, 1e-9, `waist ${Rc1},${Rc2}`);
        const w1sq = (L * lam / Math.PI) * Math.sqrt(g2 / (g1 * (1 - g1 * g2)));
        close(md.w1 * md.w1, w1sq, 1e-9, "spot on mirror 1");
        // wavefront radius at each mirror equals the mirror radius (field matches the surfaces)
        const R_at = (z) => { const u = z - md.zWaist; return u + md.zR * md.zR / u; };
        if (Number.isFinite(Rc2)) close(R_at(L), Rc2, 1e-9, "wavefront at mirror 2");
        if (Number.isFinite(Rc1)) close(-R_at(0), Rc1, 1e-9, "wavefront at mirror 1");
    }
    // half-symmetric: waist on the flat mirror 2
    const hs = res.gaussianMode(L, 1.0, Infinity, lam, n);
    close(hs.zWaist, L, 1e-12, "flat-mirror waist");
    // symmetric confocal: curvature-matched w0² = λL/(2πn)
    const cf = res.gaussianMode(L, L, L, lam, 1.5);
    assert.ok(cf.degenerate);
    close(cf.w0 * cf.w0, lam * L / (2 * Math.PI * 1.5), 1e-12, "confocal waist in medium");
});

test("Gouy phase: acos(±√g1g2) agrees with the propagated beam and sets the transverse comb", () => {
    const L = 0.2, lam = 633e-9;
    for (const [Rc1, Rc2] of [[0.5, 0.5], [0.12, 0.12], [0.3, Infinity], [0.11, 0.15], [1, 3]]) {
        const md = res.gaussianMode(L, Rc1, Rc2, lam, 1);
        assert.equal(md.status, "stable");
        close(md.gouy, md.gouyPropagated, 1e-9, `ψ ${Rc1},${Rc2}`);
        if (md.g1 < 0) assert.ok(md.gouy > Math.PI / 2, "negative branch above π/2");
        // cos(2ψ) = (A + D)/2
        close(Math.cos(2 * md.gouy), md.m, 1e-9, "round-trip Gouy");
    }
    // near-confocal symmetric: TEM01 half an FSR from TEM00; TEM02 degenerate modulo FSR
    const cf = res.cavity({ R1: 0.99, R2: 0.99, L, Rc1: L * (1 + 1e-9), Rc2: L * (1 + 1e-9) });
    const d1 = (res.resonanceFrequency(cf, cf.q0, 1) - cf.nuRes) / cf.fsr;
    const d2 = (res.resonanceFrequency(cf, cf.q0, 2) - cf.nuRes) / cf.fsr;
    close(d1, 0.5, 1e-6, "confocal TEM01 shift");
    close(d2, 1.0, 1e-6, "confocal TEM02 shift");
    // near-planar: transverse spacing → 0; near-concentric: → FSR
    const pl = res.cavity({ L, Rc1: 1e5, Rc2: 1e5 });
    assert.ok((res.resonanceFrequency(pl, pl.q0, 1) - pl.nuRes) / pl.fsr < 2e-3);
    const cc = res.cavity({ L, Rc1: L / 2 * 1.0001, Rc2: L / 2 * 1.0001 });
    assert.ok(1 - (res.resonanceFrequency(cc, cc.q0, 1) - cc.nuRes) / cc.fsr < 1e-2);
    // TEM00 itself is Gouy-shifted from the plane-wave comb by ψ/π FSR, and remains a transmission peak
    const sym = res.cavity({ R1: 0.95, R2: 0.95, L, Rc1: 0.5, Rc2: 0.5, lambda0: lam });
    const qv = 2 * L * sym.nuRes / c - sym.psi / Math.PI;
    assert.ok(Math.abs(qv - Math.round(qv)) < 1e-6, "ν00 = (c/2L)(q + ψ/π)");
    close(res.response(sym, sym.nuRes).T, 1, 1e-12, "TEM00 peak");
});

test("independent benchmark: uncoated glass etalon equals the characteristic-matrix (thin-film) result", () => {
    // slab of index n in air at normal incidence; interfaces give R = ((n−1)/(n+1))²
    const n = 1.5, d = 1e-3, lam0 = 1000e-9;
    const Rf = Math.pow((n - 1) / (n + 1), 2);
    const cav = res.cavity({ R1: Rf, R2: Rf, L: d, n, lambda0: lam0 });
    for (let k = 0; k < 40; k++) {
        const nu = cav.nuRes + cav.fsr * k / 23;
        const k0 = 2 * Math.PI * nu / c, ph = k0 * n * d;
        // characteristic matrix [[cos, −i sin/n], [−i n sin, cos]] (Born & Wolf), Y0 = Ys = 1
        const m11 = C.cx(Math.cos(ph)), m12 = C.cx(0, -Math.sin(ph) / n), m21 = C.cx(0, -n * Math.sin(ph)), m22 = C.cx(Math.cos(ph));
        const B = C.add(m11, m12), Cc = C.add(m21, m22);
        const den = C.add(B, Cc);
        const Ttm = 4 / C.abs2(den);
        const Rtm = C.abs2(C.div(C.sub(B, Cc), den));
        const o = res.response(cav, nu);
        assert.ok(Math.abs(o.T - Ttm) < 1e-9, `T etalon k=${k}`);
        assert.ok(Math.abs(o.R - Rtm) < 1e-9, `R etalon k=${k}`);
    }
});

test("limits: bare gap transmits everything; loss only gives T = A", () => {
    const cav = res.cavity({ R1: 0, R2: 0, L: 0.01 });
    close(res.response(cav, cav.nu0 * 1.0001).T, 1, 1e-15, "no mirrors");
    const lossy = res.cavity({ R1: 0, R2: 0, loss: 0.3, L: 0.01 });
    close(res.response(lossy, lossy.nu0).T, 0.7, 1e-15, "single-pass loss");
});

test("intracavity standing wave: node at a perfect mirror, antinode spacing λ0/(2n), q half-waves", () => {
    const L = 1e-3, n = 1.2, lam = 1000e-9;
    const cav = res.cavity({ R1: 0.999, R2: 1, L, n, lambda0: lam });
    const zs = core.linspace(0, L, 200001);
    const f = res.intracavityField(cav, cav.nuRes, zs);
        // count nodes (local minima near zero) along the cavity
    let nodes = 0;
    let peak = 0;
    for (const v of f.abs2) peak = Math.max(peak, v);
    for (let i = 1; i < zs.length - 1; i++) if (f.abs2[i] < f.abs2[i - 1] && f.abs2[i] <= f.abs2[i + 1] && f.abs2[i] < 1e-3 * peak) nodes++;
    assert.ok(f.abs2[zs.length - 1] < 1e-20 * peak, "node at the R = 1 mirror");
    // interior nodes = q − 1 (plus the two near-nodes at the mirrors)
    assert.equal(nodes + 2, cav.q0 + 1, "q half wavelengths");
    close(cav.q0 * lam / (2 * n), L, 1e-3, "q λ/2n ≈ L");
    // on-resonance circulating power = buildup factor
    close(res.response(cav, cav.nuRes).circ, cav.buildup, 1e-12, "buildup");
});
