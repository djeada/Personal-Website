(function(root, factory) {
    const m = factory();
    if (typeof module === "object" && module.exports) module.exports = m;
    else {
        root.OpticsModels = root.OpticsModels || {};
        root.OpticsModels.fresnel = m;
    }
})(typeof self !== "undefined" ? self : this, function() {
    "use strict";

    const C0 = 299792458;


    const cx = (re, im = 0) => ({
        re,
        im
    });
    const add = (a, b) => cx(a.re + b.re, a.im + b.im);
    const sub = (a, b) => cx(a.re - b.re, a.im - b.im);
    const mul = (a, b) => cx(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
    const scale = (a, s) => cx(a.re * s, a.im * s);
    const div = (a, b) => {
        const d = b.re * b.re + b.im * b.im;
        return cx((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d);
    };
    const abs = (a) => Math.hypot(a.re, a.im);
    const arg = (a) => Math.atan2(a.im, a.re);
    const expi = (phi) => cx(Math.cos(phi), Math.sin(phi));
    const conj = (a) => cx(a.re, -a.im);

    const csqrt = (a) => {
        if (a.im === 0) return a.re >= 0 ? cx(Math.sqrt(a.re), 0) : cx(0, Math.sqrt(-a.re));
        const m = abs(a);
        const re = Math.sqrt((m + a.re) / 2);
        const im = Math.sqrt(Math.max(0, (m - a.re) / 2));
        return cx(re, a.im < 0 ? -im : im);
    };
    const toComplex = (n) => (typeof n === "number" ? cx(n, 0) : cx(n.re, n.im || 0));

    function assertIndex(n, name) {
        if (!(Number.isFinite(n) && n > 0)) {
            throw new RangeError(name + " must be a positive real refractive index");
        }
    }


    function assertComplexIndex(n, name) {
        if (typeof n === "number") return assertIndex(n, name);
        if (!(n && Number.isFinite(n.re) && n.re > 0 && Number.isFinite(n.im || 0) && (n.im || 0) >= 0)) {
            throw new RangeError(name + " must be n + iκ with n > 0 and κ ≥ 0");
        }
    }


    function normalWavevector(n, kxOverK0) {
        if (typeof n === "number" || !n.im) {
            const nr = typeof n === "number" ? n : n.re;
            const q = nr * nr - kxOverK0 * kxOverK0;
            return q >= 0 ? cx(Math.sqrt(q), 0) : cx(0, Math.sqrt(-q));
        }
        const nc = toComplex(n);
        const q = sub(mul(nc, nc), cx(kxOverK0 * kxOverK0, 0));
        const r = csqrt(q);
        return r.im < 0 ? scale(r, -1) : r;
    }

    function brewsterAngle(n1, n2) {
        assertIndex(n1, "n1");
        assertIndex(n2, "n2");
        return Math.atan2(n2, n1);
    }


    function criticalAngle(n1, n2) {
        assertIndex(n1, "n1");
        assertIndex(n2, "n2");
        return n1 > n2 ? Math.asin(n2 / n1) : null;
    }

    function mediumWavelength(lambda0, n) {
        return lambda0 / n;
    }

    function frequency(lambda0) {
        return C0 / lambda0;
    }


    function solve(n1, n2, theta1, lambda0) {
        assertIndex(n1, "n1");
        assertComplexIndex(n2, "n2");
        if (!(theta1 >= 0 && theta1 <= Math.PI / 2)) {
            throw new RangeError("theta1 must lie in [0, π/2]");
        }
        const n2c = toComplex(n2);
        const absorbing = n2c.im > 0;
        const k0 = Number.isFinite(lambda0) && lambda0 > 0 ? 2 * Math.PI / lambda0 : null;
        const kx = n1 * Math.sin(theta1);
        const kz1 = cx(n1 * Math.cos(theta1), 0);
        const kz2 = normalWavevector(absorbing ? n2c : n2c.re, kx);
        const tir = !absorbing && kz2.re === 0 && kz2.im > 0;
        const atCritical = !absorbing && kz2.re === 0 && kz2.im === 0;
        const n1sq = n1 * n1;
        const n2sq = mul(n2c, n2c);


        const sDen = add(kz1, kz2);
        const rs = div(sub(kz1, kz2), sDen);
        const ts = div(scale(kz1, 2), sDen);


        const pA = mul(kz1, n2sq);
        const pB = scale(kz2, n1sq);
        const pDen = add(pA, pB);
        const rp = div(sub(pA, pB), pDen);
        const tp = div(scale(mul(kz1, n2c), 2 * n1), pDen);

        const Rs = abs(rs) ** 2;
        const Rp = abs(rp) ** 2;

        const fluxS = kz1.re > 0 ? kz2.re / kz1.re : 0;
        const fluxP = kz1.re > 0 ? div(mul(kz2, conj(n2c)), n2c).re / kz1.re : 0;
        let Ts = fluxS * abs(ts) ** 2;
        let Tp = fluxP * abs(tp) ** 2;
        if (kz1.re === 0) {
            Ts = 0;
            Tp = 0;
        }




        let theta2 = null;
        if (!tir) theta2 = absorbing ? Math.atan2(kx, kz2.re) : Math.asin(Math.min(1, kx / n2c.re));
        const kappa = kz2.im;
        const fieldDecayLength = k0 && kappa > 0 ? 1 / (kappa * k0) : (tir ? Infinity : null);

        return {
            n1,
            n2: absorbing ? n2c : n2c.re,
            n2c,
            absorbing,
            theta1,
            theta2,
            tir,
            atCritical,
            lambda0: k0 ? lambda0 : null,
            kx,
            kz1,
            kz2,
            rs,
            rp,
            ts,
            tp,
            Rs,
            Rp,
            Ts,
            Tp,

            As: absorbing ? Ts : 0,
            Ap: absorbing ? Tp : 0,
            phaseRs: arg(rs),
            phaseRp: arg(rp),
            phaseTs: arg(ts),
            phaseTp: arg(tp),

            fieldDecayLength,
            intensityDecayLength: fieldDecayLength && Number.isFinite(fieldDecayLength) ? fieldDecayLength / 2 : fieldDecayLength
        };
    }


    function fluxAtDepth(sol, pol, z) {
        const T = pol === "s" ? sol.Ts : sol.Tp;
        if (!(z > 0)) return T;
        if (!sol.lambda0) throw new RangeError("fluxAtDepth needs lambda0 in solve()");
        return T * Math.exp(-2 * sol.kz2.im * (2 * Math.PI / sol.lambda0) * z);
    }


    function transmittedIntensity(sol, pol, z) {
        let e2 = 1;
        let t2 = abs(sol.ts) ** 2;
        if (pol === "p") {
            t2 = abs(sol.tp) ** 2;
            e2 = (abs(sol.kz2) ** 2 + sol.kx * sol.kx) / (abs(sol.n2c) ** 2);
        }
        const decay = z > 0 && sol.kz2.im > 0 ? Math.exp(-2 * sol.kz2.im * (2 * Math.PI / sol.lambda0) * z) : 1;
        return t2 * e2 * decay;
    }


    function pseudoBrewster(n1, n2) {
        if (typeof n2 === "number" || !n2.im) return brewsterAngle(n1, typeof n2 === "number" ? n2 : n2.re);
        let a = 0,
            b = Math.PI / 2 * (1 - 1e-9);
        const f = (t) => solve(n1, n2, t).Rp;
        const g = (Math.sqrt(5) - 1) / 2;
        let c = b - g * (b - a),
            d = a + g * (b - a),
            fc = f(c),
            fd = f(d);
        while (b - a > 1e-10) {
            if (fc < fd) {
                b = d;
                d = c;
                fd = fc;
                c = b - g * (b - a);
                fc = f(c);
            } else {
                a = c;
                c = d;
                fc = fd;
                d = a + g * (b - a);
                fd = f(d);
            }
        }
        return (a + b) / 2;
    }


    function powerFor(sol, mode) {
        if (mode === "s") return {
            R: sol.Rs,
            T: sol.Ts
        };
        if (mode === "p") return {
            R: sol.Rp,
            T: sol.Tp
        };
        return {
            R: (sol.Rs + sol.Rp) / 2,
            T: (sol.Ts + sol.Tp) / 2
        };
    }


    function sweep(n1, n2, samples = 361, maxAngle = Math.PI / 2 * 0.9999) {

        const out = [];
        for (let i = 0; i < samples; i++) {
            const th = maxAngle * i / (samples - 1);
            const s = solve(n1, n2, th);
            out.push({
                theta: th,
                Rs: s.Rs,
                Rp: s.Rp,
                Ts: s.Ts,
                Tp: s.Tp,
                phaseRs: s.phaseRs,
                phaseRp: s.phaseRp
            });
        }
        return out;
    }


    function planeWaves(sol, pol) {
        const {
            n1,
            kx,
            kz1,
            kz2
        } = sol;
        const n2 = sol.n2c || toComplex(sol.n2);
        const one = cx(1, 0);
        const zero = cx(0, 0);
        const pVec = (kz, n) => {
            const nc = toComplex(n);
            return {
                ex: div(kz, nc),
                ey: zero,
                ez: div(cx(-kx, 0), nc)
            };
        };
        const sVec = {
            ex: zero,
            ey: one,
            ez: zero
        };
        const kzr = scale(kz1, -1);
        if (pol === "s") {
            return {
                incident: {
                    amp: one,
                    kx,
                    kz: kz1,
                    e: sVec
                },
                reflected: {
                    amp: sol.rs,
                    kx,
                    kz: kzr,
                    e: sVec
                },
                transmitted: {
                    amp: sol.ts,
                    kx,
                    kz: kz2,
                    e: sVec
                }
            };
        }
        return {
            incident: {
                amp: one,
                kx,
                kz: kz1,
                e: pVec(kz1, n1)
            },
            reflected: {
                amp: sol.rp,
                kx,
                kz: kzr,
                e: pVec(kzr, n1)
            },
            transmitted: {
                amp: sol.tp,
                kx,
                kz: kz2,
                e: pVec(kz2, n2)
            }
        };
    }


    function waveField(wave, xOverLambda, zOverLambda, omegaT) {
        const k0 = 2 * Math.PI;
        const kr = add(cx(wave.kx * xOverLambda * k0, 0), scale(wave.kz, zOverLambda * k0));

        const ph = scale(expi(kr.re - omegaT), Math.exp(-kr.im));
        const c = mul(wave.amp, ph);
        return {
            x: mul(c, wave.e.ex).re,
            y: mul(c, wave.e.ey).re,
            z: mul(c, wave.e.ez).re
        };
    }


    function boundaryTangential(sol, pol) {
        const w = planeWaves(sol, pol);
        const comp = pol === "s" ? "ey" : "ex";
        const side1 = add(mul(w.incident.amp, w.incident.e[comp]), mul(w.reflected.amp, w.reflected.e[comp]));
        const side2 = mul(w.transmitted.amp, w.transmitted.e[comp]);
        return {
            side1,
            side2
        };
    }

    return {
        C0,
        complex: {
            cx,
            add,
            sub,
            mul,
            div,
            scale,
            abs,
            arg,
            expi,
            conj,
            sqrt: csqrt
        },
        normalWavevector,
        brewsterAngle,
        criticalAngle,
        mediumWavelength,
        frequency,
        solve,
        powerFor,
        fluxAtDepth,
        transmittedIntensity,
        pseudoBrewster,
        sweep,
        planeWaves,
        waveField,
        boundaryTangential
    };
});