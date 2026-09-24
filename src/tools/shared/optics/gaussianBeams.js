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



    function rayleighRange(w0, lambda0, n = 1, M2 = 1) {
        return Math.PI * n * w0 * w0 / (M2 * lambda0);
    }

    function waistFromRayleigh(zR, lambda0, n = 1, M2 = 1) {
        return Math.sqrt(zR * M2 * lambda0 / (Math.PI * n));
    }

    function divergence(w0, lambda0, n = 1, M2 = 1) {
        return M2 * lambda0 / (Math.PI * n * w0);
    }


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


    function beamRadius(z, beam) {
        const u = (z - beam.z0) / beam.zR;
        return beam.w0 * Math.sqrt(1 + u * u);
    }


    function curvature(z, beam) {
        const dz = z - beam.z0;
        return dz / (dz * dz + beam.zR * beam.zR);
    }


    function curvatureRadius(z, beam) {
        const k = curvature(z, beam);
        return k === 0 ? Infinity : 1 / k;
    }


    function gouyPhase(z, beam) {
        return Math.atan((z - beam.z0) / beam.zR);
    }


    function qAt(z, beam) {
        return C.cx(z - beam.z0, beam.zR);
    }


    function qFromWR(w, R, lambda0, n = 1, M2 = 1) {
        const invR = Number.isFinite(R) ? 1 / R : 0;
        return C.inv(C.cx(invR, -M2 * lambda0 / (Math.PI * n * w * w)));
    }


    function beamFromQ(q, lambda0, n = 1, M2 = 1) {
        const iq = C.inv(q);
        const zR = q.im;
        if (!(zR > 0)) throw new RangeError("gaussianBeams.beamFromQ: Im q must be > 0 (physical beam)");
        const w = Math.sqrt(-M2 * lambda0 / (Math.PI * n * iq.im));

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


    function applyABCD(M, q) {
        const num = C.add(C.scale(q, M[0][0]), C.cx(M[0][1], 0));
        const den = C.add(C.scale(q, M[1][0]), C.cx(M[1][1], 0));
        return C.div(num, den);
    }



    function intensity(r, w, P = 1) {
        return 2 * P / (Math.PI * w * w) * Math.exp(-2 * r * r / (w * w));
    }

    function powerInRadius(a, w, P = 1) {
        return P * (1 - Math.exp(-2 * a * a / (w * w)));
    }

    function transversePhase(r, invR, gouy, lambda0, n = 1) {
        const k = 2 * Math.PI * n / lambda0;
        return 0.5 * k * r * r * invR - gouy;
    }



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



    function selfImaging(s, zR, f) {
        const a = s / f - 1;
        const m = 1 / Math.sqrt(a * a + (zR / f) * (zR / f));

        const sOut = f + m * m * (s - f);
        return {
            sOut,
            m
        };
    }


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

    function inputRadiusForSpot(ws, f, lambda0, n = 1, M2 = 1) {
        return M2 * lambda0 * Math.abs(f) / (Math.PI * n * ws);
    }


    function paraxialStatus(theta) {
        if (!(theta >= 0)) return "invalid";
        return theta < 0.1 ? "ok" : theta <= 0.3 ? "marginal" : "invalid";
    }


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