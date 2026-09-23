/*
 * Passive two-mirror optical resonator (Fabry–Pérot) model. Pure, DOM-free.
 *
 * Browser: <script src="../shared/optics/resonator.js"></script> → window.OpticsModels.resonator
 * Node:    const res = require(".../shared/optics/resonator.js")
 *
 * Geometry and conventions (SI throughout)
 * ----------------------------------------
 *  - Linear cavity: mirror 1 at z = 0 (input), mirror 2 at z = L (output). The gap is filled
 *    with a medium of phase index n; an optional group index ng describes a dispersive filling
 *    through a linearised phase: n(ν)·ν = n·ν0 + ng·(ν − ν0), ν0 = c/λ0 (so ng = n is
 *    nondispersive). Time convention E = Re{E exp[i(kz − ωt)]}.
 *  - Mirrors are lossless: power reflectance R_i, transmittance 1 − R_i. Amplitudes are
 *    power-normalised: t_i = √(1 − R_i); reflection seen from outside +√R_i, from inside −√R_i
 *    (Stokes relation r' = −r). The inside sign −√R gives a field node at a perfect mirror,
 *    matching the standing-wave tool (PEC wall).
 *  - Internal loss: single-pass power survival A = 1 − ℓ (ℓ = loss per pass, e.g. absorption
 *    or scattering), i.e. distributed power loss coefficient α = −ln(A)/L.
 *  - ONE round-trip factor drives everything:
 *        g(ν) = r1' r2' A e^{iδ(ν)} = ρ e^{iδ},   ρ = √(R1 R2)·A,   S = ρ² = R1 R2 A²
 *    S is the round-trip POWER survival factor. Spectra (Airy function), finesse, photon
 *    lifetime τ_p = −T_rt/ln S, ring-down and buildup all use it.
 *  - Round-trip phase δ(ν) = (4πL/c)[nν0 + ng(ν − ν0)] − 2(m+n+1)ψ for a TEMmn mode, with
 *    ψ the one-way Gouy phase. Resonance δ = 2πq gives
 *        ν_{q,mn} = ν0 + { [q + (m+n+1)ψ/π]·c/(2L) − n ν0 } / ng
 *    which reduces to ν = (c/2nL)[q + (m+n+1)ψ/π] when ng = n, and FSR = c/(2 ng L).
 *    One-way Gouy phase ψ = acos(s·√(g1 g2)), s = sign(g1) (= sign(g2) inside the stable
 *    region; s = +1 for g1 g2 = 0). ψ ∈ [0, π].
 *  - Paraxial ABCD on ray vectors [y, θ] inside the medium (core.mat2). Mirror of radius Rc
 *    (Rc > 0 concave toward the cavity, Infinity = planar): [[1,0],[−2/Rc,1]]. Propagation over
 *    the geometric length: [[1,L],[0,1]]. With the ray angle measured inside the medium the
 *    g parameters g_i = 1 − L/Rc_i do not depend on n; the Gaussian beam uses the medium
 *    wavelength λ0/n, so zR = π n w0²/λ0 and q = z + i zR.
 *    Round-trip matrix referenced just after mirror 1 heading toward mirror 2:
 *        M = chain([M1, P, M2, P]) = M1·P·M2·P,   m = (A + D)/2 = 2 g1 g2 − 1.
 *    Stable ⇔ |m| < 1 ⇔ 0 < g1 g2 < 1. |m| = 1 is marginal (planar, concentric, confocal-type
 *    boundaries); |m| > 1 unstable.
 *  - The plane-wave Airy response is exact for the idealised plane-wave cavity (ψ = 0) and for
 *    a mode-matched TEM00 input when ψ ≠ 0 (the Gouy phase only shifts the comb).
 */
(function(root, factory) {
    const core = (typeof require === "function" && typeof module === "object") ? require("./core.js") : root.OpticsModels.core;
    const m = factory(core);
    if (typeof module === "object" && module.exports) module.exports = m;
    else {
        root.OpticsModels = root.OpticsModels || {};
        root.OpticsModels.resonator = m;
    }
})(typeof self !== "undefined" ? self : this, function(core) {
    "use strict";

    const c0 = core.constants.c;
    const C = core.complex;
    const mat2 = core.mat2;
    const TWO_PI = 2 * Math.PI;
    const MARGINAL_TOL = 1e-9;

    // ------------------------------------------------------------------ ABCD / stability
    const propagation = (d) => [
        [1, d],
        [0, 1]
    ];
    /** Reflection from a mirror of radius Rc (Rc > 0 concave toward the beam; ±Infinity planar). */
    const mirror = (Rc) => [
        [1, 0],
        [Number.isFinite(Rc) ? -2 / Rc : 0, 1]
    ];

    function gParam(L, Rc) {
        return Number.isFinite(Rc) ? 1 - L / Rc : 1;
    }
    /** Radius that gives parameter g for length L (Infinity for g = 1). */
    function radiusFromG(L, g) {
        return Math.abs(1 - g) < 1e-12 ? Infinity : L / (1 - g);
    }

    /** Round-trip ray matrix starting just after mirror 1, heading toward mirror 2. */
    function roundTripMatrix(L, Rc1, Rc2) {
        return mat2.chain([mirror(Rc1), propagation(L), mirror(Rc2), propagation(L)]);
    }

    /**
     * Stability from a round-trip matrix: m = (A + D)/2. status "stable" (|m| < 1),
     * "marginal" (| |m| − 1 | ≤ tol) or "unstable".
     */
    function stability(M, tol = MARGINAL_TOL) {
        const m = (M[0][0] + M[1][1]) / 2;
        const status = Math.abs(Math.abs(m) - 1) <= tol ? "marginal" : Math.abs(m) < 1 ? "stable" : "unstable";
        return {
            m,
            status,
            stable: status === "stable"
        };
    }

    /**
     * Name the marginal boundary (or special stable point) for g1, g2.
     * Returns { key, label, note } — key ∈ planar | concentric | confocal | g1g2zero | g1g2one | null.
     */
    function classifyBoundary(g1, g2, tol = 1e-6) {
        const p = g1 * g2;
        const near = (a, b) => Math.abs(a - b) <= tol;
        if (near(g1, 1) && near(g2, 1)) return {
            key: "planar",
            label: "planar–planar (g1 = g2 = 1)",
            note: "ψ = 0: every TEMmn is degenerate with TEM00; no finite Gaussian mode (w → ∞)."
        };
        if (near(g1, -1) && near(g2, -1)) return {
            key: "concentric",
            label: "concentric (g1 = g2 = −1)",
            note: "ψ = π: transverse shift is a full FSR, so all modes are degenerate again; the waist shrinks to a point and w at the mirrors diverges."
        };
        if (near(g1, 0) && near(g2, 0)) return {
            key: "confocal",
            label: "symmetric confocal (g1 = g2 = 0)",
            note: "ψ = π/2: TEMmn with m+n even coincide with TEM00, odd ones sit half-way (FSR effectively halves). M = −I, so the ray matrix alone does not fix q; the mode matching the mirror curvature is w0² = λL/(2πn)."
        };
        if (near(p, 0)) return {
            key: "g1g2zero",
            label: "g1·g2 = 0 boundary",
            note: "One mirror's centre of curvature lies on the other mirror (ψ = π/2). The spot size on that other mirror goes to 0 and on the first diverges."
        };
        if (near(p, 1)) return {
            key: "g1g2one",
            label: "g1·g2 = 1 boundary",
            note: "Hyperbola through planar and concentric: ψ = 0 or π, transverse modes degenerate with longitudinal ones and the beam is unbounded."
        };
        return {
            key: null,
            label: "",
            note: ""
        };
    }

    /**
     * Self-consistent Gaussian eigenmode of a round-trip matrix (q reproduces itself).
     * Cq² + (D − A)q − B = 0 → 1/q = (D − A)/(2B) − i·√(1 − m²)/|B|  (Im(1/q) < 0 for a
     * confined beam: 1/q = 1/Rw − i λ0/(π n w²)). Returns { q: {re, im}, invq } or null.
     */
    function eigenQ(M) {
        const [
            [A, B],
            [Cc, D]
        ] = M;
        const m = (A + D) / 2;
        if (!(Math.abs(m) < 1) || B === 0) return null;
        const invq = C.cx((D - A) / (2 * B), -Math.sqrt(1 - m * m) / Math.abs(B));
        return {
            invq,
            q: C.inv(invq)
        };
    }

    /** Apply ABCD to a complex beam parameter q. */
    function applyABCD(M, q) {
        return C.div(C.add(C.scale(q, M[0][0]), C.cx(M[0][1])), C.add(C.scale(q, M[1][0]), C.cx(M[1][1])));
    }

    /** One-way Gouy phase from the g parameters, ψ = acos(s√(g1g2)), s = sign(g1). NaN if unstable. */
    function gouyFromG(g1, g2) {
        const p = g1 * g2;
        if (p < -1e-12 || p > 1 + 1e-12) return NaN;
        const s = g1 < 0 || (g1 === 0 && g2 < 0) ? -1 : 1;
        return Math.acos(Math.max(-1, Math.min(1, s * Math.sqrt(Math.max(0, p)))));
    }

    /**
     * Gaussian TEM00 mode of the cavity. Positions are measured from mirror 1 (z = 0) toward
     * mirror 2 (z = L). Returns { status, m, g1, g2, gouy, w0, zWaist, zR, w1, w2, q1, boundary }.
     * For a marginal or unstable resonator w-values are NaN except the symmetric confocal case,
     * where the curvature-matched solution is returned (flagged `degenerate: true`).
     */
    function gaussianMode(L, Rc1, Rc2, lambda0, n = 1) {
        const g1 = gParam(L, Rc1),
            g2 = gParam(L, Rc2);
        const M = roundTripMatrix(L, Rc1, Rc2);
        const st = stability(M);
        const boundary = classifyBoundary(g1, g2);
        const lam = lambda0 / n; // medium wavelength
        const out = {
            status: st.status,
            m: st.m,
            g1,
            g2,
            M,
            gouy: gouyFromG(g1, g2),
            boundary,
            degenerate: false,
            w0: NaN,
            zWaist: NaN,
            zR: NaN,
            w1: NaN,
            w2: NaN,
            q1: null
        };
        let q = null;
        if (st.status === "stable") {
            q = eigenQ(M).q;
        } else if (boundary.key === "confocal") {
            // curvature-matched: waist at the centre, zR = L/2
            q = C.cx(-L / 2, L / 2);
            out.degenerate = true;
        }
        if (!q) return out;
        out.q1 = q;
        out.zR = q.im;
        out.zWaist = -q.re; // q = z − z_w + i zR at z = 0
        out.w0 = Math.sqrt(out.zR * lam / Math.PI);
        out.w1 = beamRadius(out, 0, lam);
        out.w2 = beamRadius(out, L, lam);
        // independent Gouy phase from the propagating beam (sign follows the geometry)
        out.gouyPropagated = Math.atan((L - out.zWaist) / out.zR) - Math.atan((0 - out.zWaist) / out.zR);
        out.lambdaMedium = lam;
        return out;
    }

    /** 1/e² intensity radius at axial position z (from mirror 1) for a mode from gaussianMode. */
    function beamRadius(mode, z, lamMedium) {
        const lam = lamMedium || mode.lambdaMedium;
        const w0 = Math.sqrt(mode.zR * lam / Math.PI);
        const u = (z - mode.zWaist) / mode.zR;
        return w0 * Math.sqrt(1 + u * u);
    }

    // ------------------------------------------------------------------ cavity (longitudinal)
    /**
     * Build a derived cavity object.
     * params: { R1, R2 (power reflectances 0..1), loss (single-pass power loss 0..1), L (m),
     *           n (phase index), ng (group index; default n), lambda0 (m), Rc1, Rc2 (m, Infinity
     *           = planar) }
     */
    function cavity(params) {
        const p = Object.assign({
            R1: 0.9,
            R2: 0.9,
            loss: 0,
            L: 0.01,
            n: 1,
            ng: null,
            lambda0: 633e-9,
            Rc1: Infinity,
            Rc2: Infinity
        }, params || {});
        if (!(p.L > 0)) throw new RangeError("cavity: L must be > 0");
        if (!(p.n > 0)) throw new RangeError("cavity: n must be > 0");
        const ng = p.ng == null || !(p.ng > 0) ? p.n : p.ng;
        const R1 = Math.min(1, Math.max(0, p.R1)),
            R2 = Math.min(1, Math.max(0, p.R2));
        const A = Math.min(1, Math.max(0, 1 - p.loss));
        const rho = Math.sqrt(R1 * R2) * A; // round-trip amplitude factor
        const S = rho * rho; // round-trip power survival
        const Trt = 2 * ng * p.L / c0;
        const fsr = c0 / (2 * ng * p.L);
        const nu0 = c0 / p.lambda0;
        const mode = gaussianMode(p.L, p.Rc1, p.Rc2, p.lambda0, p.n);
        // Gouy phase used for the TEM00 comb: only when a bound mode exists; plane-wave otherwise
        const psi = (mode.status === "stable" || mode.degenerate) ? mode.gouy : 0;
        // choose q0 so that TEM00 of order q0 is nearest ν0
        const qFloat = (2 * p.L * (p.n * nu0) / c0) - psi / Math.PI;
        const q0 = Math.round(qFloat);
        const cav = {
            params: p,
            L: p.L,
            n: p.n,
            ng,
            R1,
            R2,
            A,
            rho,
            S,
            Trt,
            fsr,
            nu0,
            lambda0: p.lambda0,
            mode,
            psi,
            q0,
            alpha: A > 0 ? -Math.log(A) / p.L : Infinity
        };
        cav.nuRes = resonanceFrequency(cav, q0, 0);
        // Airy parameters
        cav.coefF = rho > 0 ? 4 * rho / ((1 - rho) * (1 - rho)) : 0;
        const s = (1 - rho) / (2 * Math.sqrt(rho));
        cav.fwhmPhase = rho > 0 && s <= 1 ? 4 * Math.asin(s) : NaN; // FWHM in round-trip phase (HWHM = 2 asin s)
        cav.finesse = Number.isFinite(cav.fwhmPhase) ? TWO_PI / cav.fwhmPhase : NaN;
        cav.finesseApprox = rho > 0 && rho < 1 ? Math.PI * Math.sqrt(rho) / (1 - rho) : (rho >= 1 ? Infinity : NaN);
        cav.fwhm = cav.fsr / cav.finesse;
        cav.tauP = S > 0 && S < 1 ? -Trt / Math.log(S) : (S >= 1 ? Infinity : 0);
        cav.Q = cav.nuRes / cav.fwhm;
        const tt = (1 - R1) * (1 - R2) * A;
        cav.Tmax = tt / ((1 - rho) * (1 - rho));
        cav.Tmin = tt / ((1 + rho) * (1 + rho));
        cav.buildup = (1 - R1) / ((1 - rho) * (1 - rho)); // circulating/incident power on resonance
        const onRes = response(cav, cav.nuRes);
        cav.Rmin = onRes.R;
        cav.lossOnRes = onRes.loss;
        return cav;
    }

    /** Resonance frequency of longitudinal order q, transverse order N = m + n. */
    function resonanceFrequency(cav, q, N = 0) {
        const psi = cav.psi != null ? cav.psi : 0;
        return cav.nu0 + ((q + (N + 1) * psi / Math.PI) * c0 / (2 * cav.L) - cav.n * cav.nu0) / cav.ng;
    }

    /**
     * Round-trip phase modulo 2π relative to the TEM00 comb, δ − 2πq0 (computed from the detuning
     * so large absolute phases do not lose precision). N = transverse order.
     */
    function roundTripPhase(cav, nu, N = 0) {
        const d = TWO_PI * (nu - cav.nuRes) / cav.fsr - 2 * N * cav.psi;
        return d;
    }

    /**
     * Steady-state response to a unit-power monochromatic input on mirror 1 (TEM00 / plane wave).
     * Returns complex amplitudes t, r (power-normalised), T, R, loss = 1 − R − T (internal loss),
     * g (round-trip factor), circ = forward circulating power just inside mirror 1.
     */
    function response(cav, nu, N = 0) {
        const delta = roundTripPhase(cav, nu, N);
        const g = C.fromPolar(cav.rho, delta);
        const denom = C.sub(C.ONE, g);
        const t1 = Math.sqrt(1 - cav.R1),
            t2 = Math.sqrt(1 - cav.R2),
            a = Math.sqrt(cav.A);
        // single-pass phase (mod 2π irrelevant for powers): δ/2
        const t = C.div(C.fromPolar(t1 * t2 * a, delta / 2), denom);
        // r = √R1 + t1² (−√R2) A e^{iδ} / (1 − g)
        const fb = C.div(C.fromPolar(-(1 - cav.R1) * Math.sqrt(cav.R2) * cav.A, delta), denom);
        const r = C.add(C.cx(Math.sqrt(cav.R1)), fb);
        const T = C.abs2(t),
            R = C.abs2(r);
        const circ = (1 - cav.R1) / C.abs2(denom);
        return {
            t,
            r,
            T,
            R,
            loss: Math.max(0, 1 - R - T),
            g,
            delta,
            circ
        };
    }

    /** Arrays of T, R, loss for an array of absolute frequencies (Hz). */
    function spectrum(cav, nus, N = 0) {
        const n = nus.length;
        const T = new Float64Array(n),
            R = new Float64Array(n),
            Ls = new Float64Array(n);
        for (let i = 0; i < n; i++) {
            const o = response(cav, nus[i], N);
            T[i] = o.T;
            R[i] = o.R;
            Ls[i] = o.loss;
        }
        return {
            T,
            R,
            loss: Ls
        };
    }

    /**
     * Frequency samples for plotting [lo, hi] (Hz) that resolve every TEM00 Airy peak: a uniform
     * grid plus dense samples ±6 FWHM around each resonance. Sorted Float64Array.
     */
    function adaptiveGrid(cav, lo, hi, nBase = 1200, nPeak = 240) {
        const pts = [];
        for (let i = 0; i < nBase; i++) pts.push(lo + (hi - lo) * i / (nBase - 1));
        const w = Number.isFinite(cav.fwhm) ? cav.fwhm : cav.fsr;
        const qa = Math.floor((lo - cav.nuRes) / cav.fsr) - 1,
            qb = Math.ceil((hi - cav.nuRes) / cav.fsr) + 1;
        for (let k = qa; k <= qb; k++) {
            const c = cav.nuRes + k * cav.fsr;
            for (let j = 0; j < nPeak; j++) {
                const x = c + 6 * w * (2 * j / (nPeak - 1) - 1);
                if (x >= lo && x <= hi) pts.push(x);
            }
            if (c >= lo && c <= hi) pts.push(c);
        }
        pts.sort((a, b) => a - b);
        const out = [];
        for (const x of pts)
            if (!out.length || x - out[out.length - 1] > (hi - lo) * 1e-12) out.push(x);
        return Float64Array.from(out);
    }

    /**
     * Intracavity field for unit input amplitude at frequency ν, at positions zs (m from mirror 1).
     * Forward E+(z) = a+ e^{i φ(z)} e^{−αz/2}, a+ = t1/(1 − g); backward from reflection at mirror 2
     * (inside coefficient −√R2). φ(z) = kz − [ψ(z) − ψ(0)] includes the TEM00 on-axis Gouy phase
     * (transverse 1/w(z) amplitude variation is not included). Amplitudes are power-normalised,
     * so |E±|² is the power of each travelling wave relative to the input power.
     * Returns { re, im, abs2, fwd2, bwd2, envMax, envMin } (Float64Arrays).
     */
    function intracavityField(cav, nu, zs, N = 0) {
        const L = cav.L;
        const delta = roundTripPhase(cav, nu, N) + TWO_PI * cav.q0; // full round-trip phase
        const md = cav.mode;
        const useGouy = cav.psi !== 0 && Number.isFinite(md.zR);
        const gouyAt = (z) => useGouy ? (N + 1) * (Math.atan((z - md.zWaist) / md.zR) - Math.atan(-md.zWaist / md.zR)) : 0;
        // δ = 2kL − 2(N+1)ψ  → k = (δ + 2(N+1)ψ)/(2L)
        const k = (delta + 2 * (N + 1) * cav.psi) / (2 * L);
        const g = C.fromPolar(cav.rho, delta);
        const aPlus = C.div(C.cx(Math.sqrt(1 - cav.R1)), C.sub(C.ONE, g));
        const alpha = cav.A > 0 ? -Math.log(cav.A) / L : 0;
        const phiL = k * L - gouyAt(L);
        const EL = C.mul(aPlus, C.fromPolar(Math.exp(-alpha * L / 2), phiL));
        const bAtL = C.scale(EL, -Math.sqrt(cav.R2)); // backward wave just after mirror 2
        const n = zs.length;
        const re = new Float64Array(n),
            im = new Float64Array(n),
            abs2 = new Float64Array(n);
        const fwd2 = new Float64Array(n),
            bwd2 = new Float64Array(n),
            envMax = new Float64Array(n),
            envMin = new Float64Array(n);
        for (let i = 0; i < n; i++) {
            const z = zs[i];
            const ef = C.mul(aPlus, C.fromPolar(Math.exp(-alpha * z / 2), k * z - gouyAt(z)));
            const d = L - z;
            // backward travels −z: phase accumulates k(L − z) − [ψ(L) − ψ(z)]
            const eb = C.mul(bAtL, C.fromPolar(Math.exp(-alpha * d / 2), k * d - (gouyAt(L) - gouyAt(z))));
            const e = C.add(ef, eb);
            re[i] = e.re;
            im[i] = e.im;
            abs2[i] = C.abs2(e);
            const af = C.abs(ef),
                ab = C.abs(eb);
            fwd2[i] = af * af;
            bwd2[i] = ab * ab;
            envMax[i] = (af + ab) * (af + ab);
            envMin[i] = (af - ab) * (af - ab);
        }
        return {
            re,
            im,
            abs2,
            fwd2,
            bwd2,
            envMax,
            envMin,
            k,
            aPlus,
            bAtL
        };
    }

    /**
     * Transmitted and circulating power versus time for an input switched ON at t = 0 at frequency
     * ν and OFF after nOn round trips (unit input power). Closed-form geometric round-trip sums:
     *   on:  E_t(m) = t_ss (1 − g^{m+1})           (m = 0 … nOn − 1: m+1 passes summed)
     *   off: E_t(nOn + j) = E_t(nOn − 1) g^{j+1}    (the stored field decays by g per round trip)
     * The transmitted wave leaves mirror 2 once per round trip; sample m is at
     * t = T_rt/2 + m T_rt. Returns { m, t, Pt, Pc } with Pc the circulating power just inside
     * mirror 1 at the same round trip.
     */
    function timeResponse(cav, nu, nOn, nOff, N = 0) {
        const delta = roundTripPhase(cav, nu, N);
        const g = C.fromPolar(cav.rho, delta);
        const ss = response(cav, nu, N);
        const total = nOn + nOff;
        const m = new Float64Array(total),
            t = new Float64Array(total),
            Pt = new Float64Array(total),
            Pc = new Float64Array(total);
        const gpow = (k) => C.fromPolar(Math.pow(cav.rho, k), delta * k);
        const a1 = C.div(C.cx(Math.sqrt(1 - cav.R1)), C.sub(C.ONE, g));
        let lastT = C.ZERO,
            lastC = C.ZERO;
        for (let i = 0; i < total; i++) {
            let Et, Ec;
            if (i < nOn) {
                const f = C.sub(C.ONE, gpow(i + 1));
                Et = C.mul(ss.t, f);
                Ec = C.mul(a1, f);
                lastT = Et;
                lastC = Ec;
            } else {
                const gj = gpow(i - nOn + 1);
                Et = C.mul(lastT, gj);
                Ec = C.mul(lastC, gj);
            }
            m[i] = i;
            t[i] = cav.Trt * (i + 0.5);
            Pt[i] = C.abs2(Et);
            Pc[i] = C.abs2(Ec);
        }
        return {
            m,
            t,
            Pt,
            Pc,
            steadyT: ss.T,
            steadyCirc: ss.circ
        };
    }

    /** Transverse-mode comb: list of {q, N, nu} with lo ≤ ν ≤ hi and N = m + n ≤ maxOrder. */
    function modeComb(cav, lo, hi, maxOrder) {
        const out = [];
        for (let N = 0; N <= maxOrder; N++) {
            const shift = resonanceFrequency(cav, cav.q0, N) - cav.nuRes;
            const qa = Math.floor((lo - cav.nuRes - shift) / cav.fsr) - 1;
            const qb = Math.ceil((hi - cav.nuRes - shift) / cav.fsr) + 1;
            for (let k = qa; k <= qb; k++) {
                const nu = cav.nuRes + shift + k * cav.fsr;
                if (nu >= lo && nu <= hi) out.push({
                    q: cav.q0 + k,
                    N,
                    nu,
                    degeneracy: N + 1
                });
            }
        }
        return out;
    }

    return {
        propagation,
        mirror,
        gParam,
        radiusFromG,
        roundTripMatrix,
        stability,
        classifyBoundary,
        eigenQ,
        applyABCD,
        gouyFromG,
        gaussianMode,
        beamRadius,
        cavity,
        resonanceFrequency,
        roundTripPhase,
        response,
        spectrum,
        adaptiveGrid,
        intracavityField,
        timeResponse,
        modeComb
    };
});