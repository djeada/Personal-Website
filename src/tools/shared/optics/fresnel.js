/*
 * Fresnel reflection and refraction at a planar interface between two
 * isotropic, nonmagnetic media. The incident medium is lossless (real n1);
 * the transmission medium may be lossless (real n2) or absorbing, with a
 * complex index ñ2 = n2 + iκ2 (κ2 ≥ 0, the extinction coefficient).
 *
 * Geometry and conventions
 * ------------------------
 *  - Interface is the plane z = 0. Medium 1 (index n1, incident side) fills
 *    z < 0; medium 2 (index n2) fills z > 0. The plane of incidence is x-z.
 *  - Time convention: every field is E(r, t) = Re{ E0 exp[i(k·r − ωt)] }.
 *    With this sign, a transmitted normal wavevector k_z2 = iκ (κ > 0)
 *    gives exp(−κz): a field that decays away from the interface.
 *  - Tangential wavevector is conserved: k_x = k0 n1 sin θ1 in all three waves
 *    (this is Snell's law). Frequency ω is the same in both media; only the
 *    wavelength changes, λ_medium = λ0 / n.
 *  - Normal wavevectors: k_zj = sqrt(n_j² k0² − k_x²), with the branch chosen
 *    so that Im(k_z) ≥ 0 (decay, never growth, into medium 2).
 *  - s (TE) basis: E is along ŷ for incident, reflected and transmitted waves.
 *  - p (TM) basis: H is along ŷ for all three waves, so the electric unit vector
 *    of a wave with wavevector k is ê_p = (ŷ × k)/(n k0) = (k_z, 0, −k_x)/(n k0).
 *    At normal incidence this makes ê_p(incident) = +x̂ but ê_p(reflected) = −x̂,
 *    which is why r_p = −r_s there. For an evanescent wave ê_p is complex
 *    (the transmitted E field is elliptically polarised in the x-z plane).
 *  - r and t are ratios of complex electric-field amplitudes in these bases.
 *  - Absorbing medium 2: with exp(−iωt), loss means Im ñ2 > 0 and the transmitted
 *    wave is inhomogeneous: planes of constant phase are normal to (k_x, Re k_z2)
 *    and planes of constant amplitude are parallel to the interface.
 *
 * Power coefficients
 * ------------------
 *  R = |r|², and T is the ratio of time-averaged normal (z) energy fluxes
 *  (Poynting vector ½Re(E × H*)·ẑ) just inside medium 2 and in the incident wave:
 *     T_s = [Re(k_z2) / k_z1] · |t_s|²
 *     T_p = [Re(k_z2 ñ2* / ñ2) / k_z1] · |t_p|²   (= Re(k_z2)/k_z1 · |t_p|² for real n2)
 *  Because medium 1 is lossless, R + T = 1 exactly, also for absorbing ñ2: T is the
 *  power that enters medium 2 at z = 0⁺. In a semi-infinite absorber all of it is
 *  eventually absorbed; the flux at depth z is T · exp(−2 Im(k_z2) z), so the power
 *  absorbed in a slab 0 < z < d (ignoring its back surface) is T · [1 − exp(−2 Im(k_z2) d)].
 *  This flux factor is essential: T ≠ |t|² in general. In total internal
 *  reflection k_z2 is purely imaginary, so T = 0 exactly, while |t| ≠ 0: the
 *  transmitted evanescent field exists but carries no net power across z = 0.
 *
 * All inputs are SI (metres, radians). The module is pure and DOM-free.
 */
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

    // --- minimal complex arithmetic ----------------------------------------
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
    /** Principal square root (Re ≥ 0; on the negative real axis returns +i√|a|, i.e. Im ≥ 0). */
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

    /** Accepts a real index or {re, im} with re > 0, im ≥ 0 (absorbing medium). */
    function assertComplexIndex(n, name) {
        if (typeof n === "number") return assertIndex(n, name);
        if (!(n && Number.isFinite(n.re) && n.re > 0 && Number.isFinite(n.im || 0) && (n.im || 0) >= 0)) {
            throw new RangeError(name + " must be n + iκ with n > 0 and κ ≥ 0");
        }
    }

    /**
     * Normal wavevector component per unit k0, k_z = sqrt(ñ² − k_x²) with Im ≥ 0.
     * n may be real or complex {re, im}. For an absorbing medium (Im ñ > 0) the
     * principal root already has Re ≥ 0 and Im > 0 (forward-propagating, decaying).
     */
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

    /** Critical angle (radians) or null when n1 ≤ n2 (no TIR possible). */
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

    /**
     * Full Fresnel solution.
     * @param {number} n1      incident-medium index (real, > 0)
     * @param {number|{re:number, im:number}} n2  transmission-medium index: real, or
     *                         complex ñ2 = n + iκ (n > 0, κ ≥ 0) for an absorbing medium
     * @param {number} theta1  angle of incidence in radians, 0 ≤ θ1 ≤ π/2
     * @param {number} [lambda0] vacuum wavelength in metres (for lengths)
     */
    function solve(n1, n2, theta1, lambda0) {
        assertIndex(n1, "n1");
        assertComplexIndex(n2, "n2");
        if (!(theta1 >= 0 && theta1 <= Math.PI / 2)) {
            throw new RangeError("theta1 must lie in [0, π/2]");
        }
        const n2c = toComplex(n2);
        const absorbing = n2c.im > 0;
        const k0 = Number.isFinite(lambda0) && lambda0 > 0 ? 2 * Math.PI / lambda0 : null;
        const kx = n1 * Math.sin(theta1); // per unit k0
        const kz1 = cx(n1 * Math.cos(theta1), 0);
        const kz2 = normalWavevector(absorbing ? n2c : n2c.re, kx);
        const tir = !absorbing && kz2.re === 0 && kz2.im > 0;
        const atCritical = !absorbing && kz2.re === 0 && kz2.im === 0;
        const n1sq = n1 * n1;
        const n2sq = mul(n2c, n2c);

        // s (TE), E along ŷ
        const sDen = add(kz1, kz2);
        const rs = div(sub(kz1, kz2), sDen);
        const ts = div(scale(kz1, 2), sDen);

        // p (TM), H along ŷ; E-field amplitude ratios in the ê_p = (ŷ×k)/(ñ k0) basis
        const pA = mul(kz1, n2sq);
        const pB = scale(kz2, n1sq);
        const pDen = add(pA, pB);
        const rp = div(sub(pA, pB), pDen);
        const tp = div(scale(mul(kz1, n2c), 2 * n1), pDen);

        const Rs = abs(rs) ** 2;
        const Rp = abs(rp) ** 2;
        // normal Poynting flux of the transmitted wave relative to the incident one
        const fluxS = kz1.re > 0 ? kz2.re / kz1.re : 0;
        const fluxP = kz1.re > 0 ? div(mul(kz2, conj(n2c)), n2c).re / kz1.re : 0;
        let Ts = fluxS * abs(ts) ** 2;
        let Tp = fluxP * abs(tp) ** 2;
        if (kz1.re === 0) { // exactly grazing: no incident normal flux
            Ts = 0;
            Tp = 0;
        }

        // θ2: refraction angle for a propagating wave; for an absorbing medium the
        // direction of the phase-front normal (k_x, Re k_z2), which obeys Snell's law
        // only with the real "effective" index sqrt(k_x² + Re(k_z2)²).
        let theta2 = null;
        if (!tir) theta2 = absorbing ? Math.atan2(kx, kz2.re) : Math.asin(Math.min(1, kx / n2c.re));
        const kappa = kz2.im; // per unit k0
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
            // for a semi-infinite medium 2 all transmitted power is eventually absorbed
            As: absorbing ? Ts : 0,
            Ap: absorbing ? Tp : 0,
            phaseRs: arg(rs),
            phaseRp: arg(rp),
            phaseTs: arg(ts),
            phaseTp: arg(tp),
            // 1/e length of |E| in medium 2 (TIR or absorption); intensity decays twice as fast
            fieldDecayLength,
            intensityDecayLength: fieldDecayLength && Number.isFinite(fieldDecayLength) ? fieldDecayLength / 2 : fieldDecayLength
        };
    }

    /**
     * Normal energy flux in medium 2 at depth z (metres) relative to the incident flux,
     * for pol "s" or "p". Equals T at z = 0 and T·exp(−2 Im(k_z2) k0 z) below.
     */
    function fluxAtDepth(sol, pol, z) {
        const T = pol === "s" ? sol.Ts : sol.Tp;
        if (!(z > 0)) return T;
        if (!sol.lambda0) throw new RangeError("fluxAtDepth needs lambda0 in solve()");
        return T * Math.exp(-2 * sol.kz2.im * (2 * Math.PI / sol.lambda0) * z);
    }

    /**
     * Time-averaged |E|² of the transmitted wave at depth z ≥ 0 (metres), relative to the
     * incident |E0|², for pol "s" or "p": |t|² |ê|² exp(−2 Im(k_z2) k0 z), where for p the
     * complex unit vector has |ê_p|² = (|k_z2|² + k_x²)/|ñ2|² (≠ 1 for an evanescent wave).
     */
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

    /**
     * Angle of minimum R_p (radians). Equals the Brewster angle atan(n2/n1) for real n2;
     * for an absorbing medium R_p has a nonzero minimum at the "pseudo-Brewster" angle.
     * Golden-section search on [0, π/2) to ~1e-10 rad.
     */
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

    /**
     * Power coefficients for a chosen incident polarisation.
     * mode: "s", "p", or "unpolarized" (equal incoherent mix of s and p).
     */
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

    /** Sample R, T and reflection phases across θ1 ∈ [0, maxAngle]. */
    function sweep(n1, n2, samples = 361, maxAngle = Math.PI / 2 * 0.9999) {
        // n2 may be real or complex {re, im}
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

    /**
     * Complex plane-wave descriptors (per unit k0) consistent with the boundary
     * solution, for polarisation "s" or "p". Each wave has a complex amplitude,
     * wavevector (kx, kz) and complex unit polarisation vector (ex, ey, ez).
     */
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

    /**
     * Real, instantaneous electric field of one plane wave at (x, z) in units of
     * vacuum wavelengths (x/λ0, z/λ0) and phase ωt (radians):
     *     E = Re{ amp · ê · exp[i(k·r − ωt)] }
     */
    function waveField(wave, xOverLambda, zOverLambda, omegaT) {
        const k0 = 2 * Math.PI;
        const kr = add(cx(wave.kx * xOverLambda * k0, 0), scale(wave.kz, zOverLambda * k0));
        // exp(i kr) with complex kr = a + ib  → e^{−b} e^{ia}
        const ph = scale(expi(kr.re - omegaT), Math.exp(-kr.im));
        const c = mul(wave.amp, ph);
        return {
            x: mul(c, wave.e.ex).re,
            y: mul(c, wave.e.ey).re,
            z: mul(c, wave.e.ez).re
        };
    }

    /** Total complex tangential fields just above/below z = 0 (for tests). */
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