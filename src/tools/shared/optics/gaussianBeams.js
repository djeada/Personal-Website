/*
 * Paraxial Gaussian beams and ABCD beam transformation (pure, DOM-free).
 *
 * Browser: <script src="../shared/optics/gaussianBeams.js"></script> → window.OpticsModels.gaussianBeams
 * Node:    const gb = require(".../shared/optics/gaussianBeams.js")
 *
 * Conventions (declared; identical to TEMPLATE.md §5)
 * ----------------------------------------------------
 *  - SI units everywhere (m, rad, W). λ0 is the VACUUM wavelength; the beam travels in a
 *    homogeneous medium of index n, so the medium wavelength is λ0/n.
 *  - w is the 1/e² INTENSITY radius (1/e field radius). w0 is the waist radius.
 *  - zR = π n w0² / (M² λ0). For an ideal TEM00 beam M² = 1.
 *  - Complex beam parameter (Kogelnik–Li / Siegman bookkeeping form):
 *        q(z) = (z − z0) + i zR,        1/q = 1/R − i M² λ0 / (π n w²).
 *    R > 0 means a DIVERGING wavefront (centre of curvature behind the beam, i.e. at smaller z).
 *    Relation to the site time convention E = Re{u exp[i(kz − ωt)]}, k = 2πn/λ0: the TEM00 field is
 *        u(r, z) = (q(z0)/q(z))* · exp[+i k r² / (2 q*(z))]
 *               = (w0/w) exp(−r²/w²) exp[i(k r²/(2R) − ψ)],   ψ = atan((z − z0)/zR)  (Gouy phase).
 *    Because every ABCD matrix is real, q and q* obey the same law q' = (A q + B)/(C q + D).
 *  - Ray-transfer matrices act on [y, θ] with θ the GEOMETRIC ray angle (not the reduced angle nθ),
 *    matching core.mat2 and the N1 optical bench:  translation [[1, d], [0, 1]];
 *    thin lens [[1, 0], [−1/f, 1]]; flat interface n1→n2 [[1, 0], [0, n1/n2]];
 *    curved interface (radius Rs, positive when the centre is downstream) [[1, 0], [(n1−n2)/(n2 Rs), n1/n2]];
 *    concave mirror of radius Rm (unfolded) [[1, 0], [−2/Rm, 1]].  mat2.chain([Mlast, …, Mfirst]).
 *    With [y, θ] matrices, q must carry the local index: q = z + i π n w0²/(M² λ0) (zR in that medium).
 *  - M² (beam-quality factor) is handled with the EMBEDDED-GAUSSIAN approximation: the second-moment
 *    radius W of a real multimode beam follows a Gaussian law with λ0 replaced by M² λ0. This predicts
 *    the width only. It is not a coherent field solution (no well-defined phase front or Gouy phase).
 */
(function(root, factory) {
    const m = factory();
    if (typeof module === "object" && module.exports) module.exports = m;
    else {
        root.OpticsModels = root.OpticsModels || {};
        root.OpticsModels.gaussianBeams = m;
    }
})(typeof self !== "undefined" ? self : this, function() {
    "use strict";

    const core = (typeof require === "function" && typeof module === "object") ? require("./core.js") : self.OpticsModels.core;
    const C = core.complex;
    const mat2 = core.mat2;

    // ---------------------------------------------------------------- single-beam formulas
    /** Rayleigh range zR = π n w0² / (M² λ0). */
    function rayleighRange(w0, lambda0, n = 1, M2 = 1) {
        return Math.PI * n * w0 * w0 / (M2 * lambda0);
    }
    /** Waist radius that gives a Rayleigh range zR. */
    function waistFromRayleigh(zR, lambda0, n = 1, M2 = 1) {
        return Math.sqrt(zR * M2 * lambda0 / (Math.PI * n));
    }
    /** Far-field half-angle divergence θ = M² λ0 / (π n w0) (rad, in the medium). */
    function divergence(w0, lambda0, n = 1, M2 = 1) {
        return M2 * lambda0 / (Math.PI * n * w0);
    }

    /**
     * Normalise a beam description. beam = { w0, z0 = 0, lambda0, n = 1, M2 = 1 } → adds zR.
     */
    function makeBeam(b) {
        const beam = {
            w0: b.w0,
            z0: b.z0 || 0,
            lambda0: b.lambda0,
            n: b.n || 1,
            M2: b.M2 || 1
        };
        if (!(beam.w0 > 0) || !(beam.lambda0 > 0) || !(beam.n > 0) || !(beam.M2 >= 1)) throw new RangeError("gaussianBeams.makeBeam: need w0 > 0, λ0 > 0, n > 0, M² ≥ 1");
        beam.zR = rayleighRange(beam.w0, beam.lambda0, beam.n, beam.M2);
        return beam;
    }

    /** Beam radius w(z) = w0 √(1 + ((z − z0)/zR)²). */
    function beamRadius(z, beam) {
        const u = (z - beam.z0) / beam.zR;
        return beam.w0 * Math.sqrt(1 + u * u);
    }

    /** Wavefront curvature 1/R(z) = (z − z0)/((z − z0)² + zR²) in 1/m. Exactly 0 at the waist (planar). */
    function curvature(z, beam) {
        const dz = z - beam.z0;
        return dz / (dz * dz + beam.zR * beam.zR);
    }

    /** Radius of curvature R(z) = (z − z0) + zR²/(z − z0). Returns Infinity at the waist (planar); use curvature() for plots. */
    function curvatureRadius(z, beam) {
        const k = curvature(z, beam);
        return k === 0 ? Infinity : 1 / k;
    }

    /** Gouy phase ψ(z) = atan((z − z0)/zR) (rad). */
    function gouyPhase(z, beam) {
        return Math.atan((z - beam.z0) / beam.zR);
    }

    /** Complex beam parameter q(z) = (z − z0) + i zR as {re, im}. */
    function qAt(z, beam) {
        return C.cx(z - beam.z0, beam.zR);
    }

    /** q from the local radius w and curvature radius R (R = Infinity or 0-curvature → planar). */
    function qFromWR(w, R, lambda0, n = 1, M2 = 1) {
        const invR = Number.isFinite(R) ? 1 / R : 0;
        return C.inv(C.cx(invR, -M2 * lambda0 / (Math.PI * n * w * w)));
    }

    /**
     * Beam quantities encoded in q (at the plane where q is evaluated):
     * { w, invR, R (Infinity when planar), zR, w0, dzWaist: position of the waist relative to this
     *   plane (positive = waist is downstream), gouy }.
     */
    function beamFromQ(q, lambda0, n = 1, M2 = 1) {
        const iq = C.inv(q);
        const zR = q.im;
        if (!(zR > 0)) throw new RangeError("gaussianBeams.beamFromQ: Im q must be > 0 (physical beam)");
        const w = Math.sqrt(-M2 * lambda0 / (Math.PI * n * iq.im));
        // treat |Re(1/q)| below round-off of |1/q| as exactly planar
        const invR = Math.abs(iq.re) <= 1e-14 * Math.hypot(iq.re, iq.im) ? 0 : iq.re;
        return {
            w,
            invR,
            R: invR === 0 ? Infinity : 1 / invR,
            zR,
            w0: waistFromRayleigh(zR, lambda0, n, M2),
            dzWaist: -q.re,
            gouy: Math.atan(q.re / zR)
        };
    }

    // ---------------------------------------------------------------- ABCD
    const abcd = Object.freeze({
        propagate: (d) => [
            [1, d],
            [0, 1]
        ],
        thinLens: (f) => [
            [1, 0],
            [-1 / f, 1]
        ],
        flatInterface: (n1, n2) => [
            [1, 0],
            [0, n1 / n2]
        ],
        curvedInterface: (Rs, n1, n2) => [
            [1, 0],
            [(n1 - n2) / (n2 * Rs), n1 / n2]
        ],
        mirror: (Rm) => [
            [1, 0],
            [-2 / Rm, 1]
        ]
    });

    /** q_out = (A q + B)/(C q + D). */
    function applyABCD(M, q) {
        const num = C.add(C.scale(q, M[0][0]), C.cx(M[0][1], 0));
        const den = C.add(C.scale(q, M[1][0]), C.cx(M[1][1], 0));
        return C.div(num, den);
    }

    // ---------------------------------------------------------------- transverse profile
    /** Power-normalised intensity I(r) = 2P/(π w²) exp(−2r²/w²) in W/m²; ∫ I dA = P. */
    function intensity(r, w, P = 1) {
        return 2 * P / (Math.PI * w * w) * Math.exp(-2 * r * r / (w * w));
    }
    /** Power inside radius a: P(1 − exp(−2a²/w²)). */
    function powerInRadius(a, w, P = 1) {
        return P * (1 - Math.exp(-2 * a * a / (w * w)));
    }
    /**
     * Field phase (rad) relative to the plane-wave carrier exp(ikz), at radius r:
     * φ(r) = k r² invR / 2 − ψ with k = 2π n / λ0. Planar (invR = 0) gives a flat phase −ψ.
     */
    function transversePhase(r, invR, gouy, lambda0, n = 1) {
        const k = 2 * Math.PI * n / lambda0;
        return 0.5 * k * r * r * invR - gouy;
    }

    // ---------------------------------------------------------------- lens systems
    /**
     * Propagate a beam through thin lenses in one homogeneous medium.
     * beam: {w0, z0, lambda0, n, M2}; lenses: [{z, f}] (any order; sorted by z).
     * Returns { segments: [{zStart, zEnd, z0, zR, w0, gouyOffset}], lenses (sorted) }.
     * Segment k covers [zStart, zEnd) and has its own waist (z0, w0, zR) found from
     * q_after = q_before / (1 − q_before/f). gouyOffset keeps the accumulated Gouy phase continuous
     * across a thin lens (the lens phase −k r²/(2f) vanishes on axis).
     */
    function traceLenses(beamIn, lenses) {
        const b = makeBeam(beamIn);
        const sorted = (lenses || []).filter((L) => Number.isFinite(L.z) && Number.isFinite(L.f) && L.f !== 0).slice().sort((a, c) => a.z - c.z);
        const segs = [];
        let z0 = b.z0,
            zR = b.zR,
            zStart = -Infinity,
            offset = 0;
        for (const L of sorted) {
            segs.push({
                zStart,
                zEnd: L.z,
                z0,
                zR,
                w0: waistFromRayleigh(zR, b.lambda0, b.n, b.M2),
                gouyOffset: offset
            });
            const qBefore = C.cx(L.z - z0, zR);
            const psiBefore = offset + Math.atan((L.z - z0) / zR);
            const qAfter = applyABCD(abcd.thinLens(L.f), qBefore);
            z0 = L.z - qAfter.re;
            zR = qAfter.im;
            offset = psiBefore - Math.atan((L.z - z0) / zR);
            zStart = L.z;
        }
        segs.push({
            zStart,
            zEnd: Infinity,
            z0,
            zR,
            w0: waistFromRayleigh(zR, b.lambda0, b.n, b.M2),
            gouyOffset: offset
        });
        return {
            beam: b,
            segments: segs,
            lenses: sorted
        };
    }

    function segmentAt(trace, z) {
        const s = trace.segments;
        for (let i = 0; i < s.length; i++)
            if (z < s[i].zEnd) return s[i];
        return s[s.length - 1];
    }

    /** All beam quantities at z for a traced system: { w, invR, R, gouy (accumulated), q, segment }. */
    function stateAt(trace, z) {
        const seg = segmentAt(trace, z);
        const dz = z - seg.z0;
        const w = seg.w0 * Math.sqrt(1 + (dz / seg.zR) * (dz / seg.zR));
        const invR = dz / (dz * dz + seg.zR * seg.zR);
        return {
            w,
            invR,
            R: invR === 0 ? Infinity : 1 / invR,
            gouy: seg.gouyOffset + Math.atan(dz / seg.zR),
            gouyLocal: Math.atan(dz / seg.zR),
            q: C.cx(dz, seg.zR),
            segment: seg
        };
    }

    /** System matrix from zA to zB (zB ≥ zA) including the thin lenses in between (as mat2.chain). */
    function systemMatrix(lenses, zA, zB) {
        const inside = (lenses || []).filter((L) => L.z >= zA && L.z < zB).slice().sort((a, c) => a.z - c.z);
        const list = [];
        let z = zA;
        for (const L of inside) {
            list.unshift(abcd.propagate(L.z - z));
            list.unshift(abcd.thinLens(L.f));
            z = L.z;
        }
        list.unshift(abcd.propagate(zB - z));
        return mat2.chain(list);
    }

    // ---------------------------------------------------------------- imaging / design formulas
    /**
     * Self's thin-lens formula for Gaussian beams (S. A. Self, Appl. Opt. 22, 658 (1983)).
     * s: distance from the input waist to the lens (positive: waist before the lens), zR: input
     * Rayleigh range, f: focal length. Returns { sOut: lens → output waist distance (positive:
     * after the lens), m: waist magnification w0'/w0 }.
     *     1/(s + zR²/(s − f)) + 1/s'' = 1/f,   m = 1/√((1 − s/f)² + (zR/f)²)
     */
    function selfImaging(s, zR, f) {
        const a = s / f - 1;
        const m = 1 / Math.sqrt(a * a + (zR / f) * (zR / f));
        // closed form of Self's equation: s'' = f + m² (s − f)
        const sOut = f + m * m * (s - f);
        return {
            sOut,
            m
        };
    }

    /**
     * Single-lens mode matching (Kogelnik): waist w1 → waist w2 with a lens of focal length f.
     * Requires f ≥ f0 = π n w1 w2 /(M² λ0). Returns [] if impossible, else up to two solutions
     * { d1: waist1 → lens, d2: lens → waist2 }.
     */
    function modeMatchSingle(w1, w2, f, lambda0, n = 1, M2 = 1) {
        const f0 = Math.PI * n * w1 * w2 / (M2 * lambda0);
        if (!(f > 0) || f < f0) return [];
        const r = Math.sqrt(f * f - f0 * f0);
        const sols = [{
                d1: f + (w1 / w2) * r,
                d2: f + (w2 / w1) * r
            },
            {
                d1: f - (w1 / w2) * r,
                d2: f - (w2 / w1) * r
            }
        ];
        return r === 0 ? [sols[0]] : sols;
    }

    function minFocalForMatch(w1, w2, lambda0, n = 1, M2 = 1) {
        return Math.PI * n * w1 * w2 / (M2 * lambda0);
    }

    /**
     * Two-lens mode matching: place lenses f1 (at x1) and f2 (at x2) so that the input beam
     * (waist w1 at z1) produces a waist w2 exactly at zT. Scans x1 over [zMin, zMax], solves the
     * lens-2 placement with modeMatchSingle, and root-finds the waist-position residual.
     * Returns solutions [{x1, x2, w2, zWaist}] with zMin ≤ x1 < x2 ≤ zT (sorted by x1).
     */
    function modeMatchTwo({
        w1,
        z1,
        w2,
        zT,
        f1,
        f2,
        lambda0,
        n = 1,
        M2 = 1,
        zMin,
        zMax,
        samples = 1200
    }) {
        const zR1 = rayleighRange(w1, lambda0, n, M2);
        const out = [];
        const lo = zMin != null ? zMin : z1,
            hi = zMax != null ? zMax : zT;
        for (const branch of [0, 1]) {
            const resid = (x1) => {
                const q = applyABCD(abcd.thinLens(f1), C.cx(x1 - z1, zR1));
                const zMid = x1 - q.re,
                    wMid = waistFromRayleigh(q.im, lambda0, n, M2);
                const sols = modeMatchSingle(wMid, w2, f2, lambda0, n, M2);
                if (!sols.length) return NaN;
                const s = sols[Math.min(branch, sols.length - 1)];
                const x2 = zMid + s.d1;
                if (!(x2 > x1)) return NaN;
                return {
                    r: x2 + s.d2 - zT,
                    x2
                };
            };
            const g = (x) => {
                const v = resid(x);
                return v && Number.isFinite(v.r) ? v.r : NaN;
            };
            const h = (hi - lo) / samples;
            let xp = lo,
                gp = g(lo);
            for (let i = 1; i <= samples; i++) {
                const x = lo + i * h,
                    gx = g(x);
                if (Number.isFinite(gp) && Number.isFinite(gx) && gp * gx <= 0 && Math.abs(gp - gx) < 0.5 * Math.abs(zT - z1) + 1e-9) {
                    const root = gp === 0 ? xp : gx === 0 ? x : core.brent(g, xp, x, {
                        tol: 1e-13
                    });
                    const v = resid(root);
                    if (v && Number.isFinite(v.r) && v.x2 <= zT + 1e-9 && Math.abs(v.r) < 1e-7 * Math.max(1, Math.abs(zT - z1))) {
                        if (!out.some((o) => Math.abs(o.x1 - root) < 1e-9 && Math.abs(o.x2 - v.x2) < 1e-9)) out.push({
                            x1: root,
                            x2: v.x2,
                            w2,
                            zWaist: zT
                        });
                    }
                }
                xp = x;
                gp = gx;
            }
        }
        return out.sort((a, b) => a.x1 - b.x1);
    }

    /**
     * Focus a beam that has radius wL and curvature invR at a lens of focal length f.
     * Returns { exact: {w0, dz} (waist radius and lens → waist distance from the q law),
     *           approx: w ≈ M² λ0 f/(π n wL) (far-field / geometric-focus estimate) }.
     */
    function focusSpot(wL, invR, f, lambda0, n = 1, M2 = 1) {
        const q = applyABCD(abcd.thinLens(f), qFromWR(wL, invR === 0 ? Infinity : 1 / invR, lambda0, n, M2));
        const b = beamFromQ(q, lambda0, n, M2);
        return {
            exact: {
                w0: b.w0,
                dz: b.dzWaist
            },
            approx: M2 * lambda0 * Math.abs(f) / (Math.PI * n * wL)
        };
    }
    /** Input radius at the lens needed to reach spot radius ws with focal length f (far-field estimate). */
    function inputRadiusForSpot(ws, f, lambda0, n = 1, M2 = 1) {
        return M2 * lambda0 * Math.abs(f) / (Math.PI * n * ws);
    }

    /** Paraxial validity from the half-angle divergence θ (rad): ok < 0.1, marginal ≤ 0.3, invalid above. */
    function paraxialStatus(theta) {
        if (!(theta >= 0)) return "invalid";
        return theta < 0.1 ? "ok" : theta <= 0.3 ? "marginal" : "invalid";
    }

    /** Display helper: R without a bogus finite value at the waist. unitScale converts m → display unit. */
    function formatCurvatureRadius(invR, fmt) {
        if (invR === 0 || !Number.isFinite(1 / invR)) return "∞ (planar wavefront)";
        return fmt ? fmt(1 / invR) : String(1 / invR);
    }

    return {
        rayleighRange,
        waistFromRayleigh,
        divergence,
        makeBeam,
        beamRadius,
        curvature,
        curvatureRadius,
        gouyPhase,
        qAt,
        qFromWR,
        beamFromQ,
        abcd,
        applyABCD,
        intensity,
        powerInRadius,
        transversePhase,
        traceLenses,
        stateAt,
        segmentAt,
        systemMatrix,
        selfImaging,
        modeMatchSingle,
        minFocalForMatch,
        modeMatchTwo,
        focusSpot,
        inputRadiusForSpot,
        paraxialStatus,
        formatCurvatureRadius
    };
});