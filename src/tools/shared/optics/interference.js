/*
 * Two-wave interference and beating model. Pure, DOM-free.
 *
 * Fields (travelling in +x, linearly polarized along transverse unit vectors e_j):
 *   E_j(x, t) = A_j e_j cos(k_j x - w_j t + phi_j),   e_j = cos(b_j) y + sin(b_j) z
 * The scalar functions below (field, superpose, phasor, ...) describe the
 * co-polarized case e_1 = e_2. Polarization enters only through the overlap
 * e_1* . e_2 (cos theta for two linear states at relative angle theta = b_2 - b_1).
 *
 * Medium: linear, lossless, NON-dispersive, phase speed c:
 *   w_j = c k_j   (so f_j = c / lambda_j, and both waves travel at c)
 *
 * Units: every function is unit-agnostic as long as the inputs are
 * consistent (SI: metres, seconds, radians, m/s). The interactive page uses
 * normalized units lambda_1 = 1, c = 1, so T_1 = 1 and f_1 = 1, because a
 * real optical beat between visible lines would be far too fast to animate.
 *
 * Intensity: I_j = <E_j^2> averaged over an optical cycle = A_j^2 / 2.
 * Cycle-averaged two-beam intensity with complex degree of coherence gamma12
 * and polarization overlap p = e_1* . e_2 (|p| <= 1):
 *   I = I1 + I2 + 2 sqrt(I1 I2) Re( gamma12 p exp(i dPhi) )
 *     = I1 + I2 + 2 sqrt(I1 I2) |mu| cos(dPhi + arg mu),   mu = gamma12 p
 *   dPhi(x, t) = theta_2 - theta_1 = (k2 - k1) x - (w2 - w1) t + (phi2 - phi1)
 * gamma12 = < exp(i delta) > is the ensemble average of the random extra
 * relative phase delta(t) between the beams (stationary, ergodic). Its
 * magnitude sets the fringe contrast, its argument shifts the fringes.
 * Only the component of E_2 parallel to e_1 interferes (Fresnel-Arago laws);
 * the orthogonal part adds I2 sin^2(theta) as a steady background.
 *
 * Detector: already averages over many optical cycles (T >> optical period);
 * it additionally integrates the cycle-averaged intensity over a causal
 * boxcar window [t - T, t]. Its reading is exact for the cosine cross term:
 *   I_det = I1 + I2 + 2 sqrt(I1 I2) |mu| sinc(dw T / 2) cos(dPhi(t - T/2) + arg mu)
 */
(function(root, factory) {
    const m = factory();
    if (typeof module === "object" && module.exports) module.exports = m;
    else {
        root.OpticsModels = root.OpticsModels || {};
        root.OpticsModels.interference = m;
    }
})(typeof self !== "undefined" ? self : this, function() {
    "use strict";

    const TWO_PI = 2 * Math.PI;

    /** sin(u)/u with the removable singularity handled. */
    function sinc(u) {
        if (Math.abs(u) < 1e-8) return 1 - (u * u) / 6;
        return Math.sin(u) / u;
    }

    /** Non-dispersive dispersion relation w = c k. */
    function omegaFromK(k, c) {
        return c * k;
    }

    /**
     * Build a wave description from amplitude, wavelength, phase and medium speed.
     * Returns { A, k, omega, phi, lambda, f, T }.
     */
    function makeWave(A, lambda, phi, c) {
        if (!(lambda > 0)) throw new RangeError("wavelength must be positive");
        if (!(c > 0)) throw new RangeError("phase speed must be positive");
        const k = TWO_PI / lambda;
        const omega = omegaFromK(k, c);
        return {
            A,
            k,
            omega,
            phi: phi || 0,
            lambda,
            f: omega / TWO_PI,
            T: TWO_PI / omega
        };
    }

    /** Total phase theta_j(x, t) = k x - w t + phi. */
    function wavePhase(w, x, t) {
        return w.k * x - w.omega * t + w.phi;
    }

    /** Instantaneous real field A cos(theta). */
    function field(w, x, t) {
        return w.A * Math.cos(wavePhase(w, x, t));
    }

    /** Sum of instantaneous fields of a list of waves (superposition). */
    function superpose(waves, x, t) {
        let s = 0;
        for (const w of waves) s += field(w, x, t);
        return s;
    }

    /** Rotating phasor A exp(i theta) at (x, t); Re(phasor) equals the field. */
    function phasor(w, x, t) {
        const th = wavePhase(w, x, t);
        return {
            re: w.A * Math.cos(th),
            im: w.A * Math.sin(th),
            angle: th,
            magnitude: Math.abs(w.A)
        };
    }

    /** Vector sum of the instantaneous phasors of several waves at (x, t). */
    function resultantPhasor(waves, x, t) {
        let re = 0,
            im = 0;
        for (const w of waves) {
            const p = phasor(w, x, t);
            re += p.re;
            im += p.im;
        }
        return {
            re,
            im,
            magnitude: Math.hypot(re, im),
            angle: Math.atan2(im, re)
        };
    }

    /** Cycle-averaged single-wave intensity <E^2> = A^2 / 2. */
    function singleIntensity(A) {
        return 0.5 * A * A;
    }

    /** Relative phase theta_2 - theta_1 at (x, t). */
    function phaseDifference(w1, w2, x, t) {
        return wavePhase(w2, x, t) - wavePhase(w1, x, t);
    }

    /** Wrap an angle to [0, 2 pi). */
    function wrapPhase(a) {
        const r = a % TWO_PI;
        return r < 0 ? r + TWO_PI : r;
    }

    /**
     * Two-beam law I = I1 + I2 + 2 sqrt(I1 I2) Re(gamma exp(i dPhi))
     *               = I1 + I2 + 2 sqrt(I1 I2) |gamma| cos(dPhi + arg gamma).
     * gamma may be a number (|gamma|, real positive) or { mag, arg }; pass
     * crossFactor(gamma12, overlap) to include the polarization overlap.
     */
    function twoBeamIntensity(I1, I2, dPhi, gamma) {
        const g = normalizeGamma(gamma);
        return I1 + I2 + 2 * Math.sqrt(I1 * I2) * g.mag * Math.cos(dPhi + g.arg);
    }

    function normalizeGamma(gamma) {
        if (gamma === undefined || gamma === null) return {
            mag: 1,
            arg: 0
        };
        if (typeof gamma === "number") {
            if (gamma < 0 || gamma > 1) throw new RangeError("|gamma| must lie in [0, 1]");
            return {
                mag: gamma,
                arg: 0
            };
        }
        const mag = gamma.mag === undefined ? 1 : gamma.mag;
        if (mag < 0 || mag > 1) throw new RangeError("|gamma| must lie in [0, 1]");
        return {
            mag,
            arg: gamma.arg || 0
        };
    }

    /** Cycle-averaged intensity of two waves at (x, t); gamma may include the polarization overlap (see crossFactor). */
    function intensity(w1, w2, x, t, gamma) {
        return twoBeamIntensity(singleIntensity(w1.A), singleIntensity(w2.A), phaseDifference(w1, w2, x, t), gamma);
    }

    // ---------- complex coherence and polarization overlap ----------

    /** gamma12 from magnitude and argument (radians). */
    function complexGamma(mag, arg) {
        return normalizeGamma({
            mag,
            arg: arg || 0
        });
    }

    /**
     * Complex degree of coherence estimated from samples of the random extra
     * relative phase delta: gamma = < exp(i delta) >. Returns { mag, arg, re, im }.
     */
    function gammaFromPhaseSamples(deltas) {
        let re = 0,
            im = 0;
        const n = deltas.length;
        if (!n) throw new RangeError("need at least one phase sample");
        for (const d of deltas) {
            re += Math.cos(d);
            im += Math.sin(d);
        }
        re /= n;
        im /= n;
        return {
            mag: Math.min(1, Math.hypot(re, im)),
            arg: Math.atan2(im, re),
            re,
            im
        };
    }

    /** Jones vector of a linear polarization at angle theta (radians) from the first transverse axis. */
    function linearJones(theta) {
        return [{
            re: Math.cos(theta),
            im: 0
        }, {
            re: Math.sin(theta),
            im: 0
        }];
    }

    /**
     * Normalized Jones overlap p = (J1^H J2) / (|J1| |J2|), a complex number
     * with |p| <= 1 (Cauchy-Schwarz). This is the factor that multiplies the
     * interference term; orthogonal states give p = 0.
     */
    function jonesOverlap(j1, j2) {
        const n1 = Math.hypot(j1[0].re, j1[0].im, j1[1].re, j1[1].im);
        const n2 = Math.hypot(j2[0].re, j2[0].im, j2[1].re, j2[1].im);
        if (!(n1 > 0) || !(n2 > 0)) throw new RangeError("Jones vectors must be nonzero");
        let re = 0,
            im = 0;
        for (let i = 0; i < 2; i++) {
            // conj(a) * b
            re += j1[i].re * j2[i].re + j1[i].im * j2[i].im;
            im += j1[i].re * j2[i].im - j1[i].im * j2[i].re;
        }
        return {
            re: re / (n1 * n2),
            im: im / (n1 * n2)
        };
    }

    /** Overlap of two linear polarizations at relative angle theta: cos(theta). */
    function polarizationOverlap(theta) {
        return Math.cos(theta);
    }

    /**
     * Combined cross-term factor mu = gamma12 * p (p = polarization overlap,
     * real number or {re, im}). Returns { mag, arg } with arg in (-pi, pi].
     */
    function crossFactor(gamma, overlap) {
        const g = normalizeGamma(gamma);
        const p = overlap === undefined || overlap === null ? {
                re: 1,
                im: 0
            } :
            typeof overlap === "number" ? {
                re: overlap,
                im: 0
            } : overlap;
        const gr = g.mag * Math.cos(g.arg),
            gi = g.mag * Math.sin(g.arg);
        const re = gr * p.re - gi * p.im;
        const im = gr * p.im + gi * p.re;
        const mag = Math.hypot(re, im);
        if (mag > 1 + 1e-12) throw new RangeError("|polarization overlap| must be <= 1");
        return {
            mag: Math.min(1, mag),
            arg: mag > 0 ? Math.atan2(im, re) : 0
        };
    }

    /**
     * Beams as seen by the detector. Beam 1 is polarized along e_1 = y (theta_1 = 0),
     * beam 2 at angle theta from it in the transverse (y, z) plane. alpha is
     * measured from e_1 in the same plane. Without an analyser the overlap is cos(theta).
     * With an ideal linear analyser at angle alpha, each beam is projected
     * (Malus: amplitude factor cos of the angle to the analyser) and both leave
     * along the same axis, so the overlap magnitude becomes 1 (sign kept).
     * Returns { A1, A2, overlap } with A1, A2 >= 0 and overlap in [-1, 1].
     */
    function detectorBeams(A1, A2, theta, analyser) {
        if (analyser === undefined || analyser === null || analyser === false) {
            return {
                A1,
                A2,
                overlap: polarizationOverlap(theta)
            };
        }
        const c1 = Math.cos(analyser),
            c2 = Math.cos(analyser - theta);
        return {
            A1: Math.abs(A1 * c1),
            A2: Math.abs(A2 * c2),
            overlap: c1 * c2 >= 0 ? 1 : -1
        };
    }

    /**
     * Field components at (x, t) for beam 1 along e_1 and beam 2 at angle theta:
     * par = E1 + E2 cos(theta) (along e_1), perp = E2 sin(theta).
     */
    function fieldComponents(w1, w2, x, t, theta) {
        const e1 = field(w1, x, t),
            e2 = field(w2, x, t);
        return {
            par: e1 + e2 * Math.cos(theta || 0),
            perp: e2 * Math.sin(theta || 0)
        };
    }

    /**
     * Detector reading: boxcar average of the cycle-averaged intensity over
     * [t - T, t]. T = 0 means an ideal envelope-resolving detector.
     */
    function detectedIntensity(w1, w2, x, t, T, gamma) {
        const g = normalizeGamma(gamma);
        const I1 = singleIntensity(w1.A),
            I2 = singleIntensity(w2.A);
        const Tint = Math.max(0, T || 0);
        const dOmega = w2.omega - w1.omega;
        const mid = phaseDifference(w1, w2, x, t - Tint / 2);
        return I1 + I2 + 2 * Math.sqrt(I1 * I2) * g.mag * sinc(dOmega * Tint / 2) * Math.cos(mid + g.arg);
    }

    /** Visibility from a max and min: V = (Imax - Imin) / (Imax + Imin). */
    function visibility(Imax, Imin) {
        const s = Imax + Imin;
        return s > 0 ? (Imax - Imin) / s : 0;
    }

    /** Visibility of an array of intensity samples. */
    function visibilityFromSamples(samples) {
        let mx = -Infinity,
            mn = Infinity;
        for (const v of samples) {
            if (v > mx) mx = v;
            if (v < mn) mn = v;
        }
        return {
            Imax: mx,
            Imin: mn,
            V: visibility(mx, mn)
        };
    }

    /**
     * Predicted visibility of the detected interference term as the relative
     * phase is scanned (through phi, position, or time for a beat):
     *   V = 2 sqrt(I1 I2) |gamma| / (I1 + I2) * |sinc(dw T / 2)|
     */
    function predictedVisibility(A1, A2, gammaMag, dOmega, T) {
        const I1 = singleIntensity(A1),
            I2 = singleIntensity(A2);
        if (I1 + I2 === 0) return 0;
        const g = gammaMag === undefined ? 1 : gammaMag;
        return (2 * Math.sqrt(I1 * I2) * g / (I1 + I2)) * Math.abs(sinc(((dOmega || 0) * (T || 0)) / 2));
    }

    /** Extreme detected intensities (scan over all relative phases). */
    function intensityExtremes(A1, A2, gammaMag, dOmega, T) {
        const I1 = singleIntensity(A1),
            I2 = singleIntensity(A2);
        const g = gammaMag === undefined ? 1 : gammaMag;
        const cross = 2 * Math.sqrt(I1 * I2) * g * Math.abs(sinc(((dOmega || 0) * (T || 0)) / 2));
        return {
            Imax: I1 + I2 + cross,
            Imin: I1 + I2 - cross
        };
    }

    /**
     * Beat quantities for two waves. Temporal beat (fixed probe) of the
     * intensity: f_beat = |f2 - f1|. Spatial beat (frozen time): 1/|1/l2 - 1/l1|.
     * In a non-dispersive medium the envelope moves at the group velocity c.
     */
    function beat(w1, w2) {
        const df = Math.abs(w2.f - w1.f);
        const dk = Math.abs(w2.k - w1.k);
        const dOmega = w2.omega - w1.omega;
        return {
            fBeat: df,
            TBeat: df > 0 ? 1 / df : Infinity,
            spatialPeriod: dk > 0 ? TWO_PI / dk : Infinity,
            groupVelocity: dk > 0 ? dOmega / (w2.k - w1.k) : NaN,
        };
    }

    return {
        TWO_PI,
        sinc,
        omegaFromK,
        makeWave,
        wavePhase,
        field,
        superpose,
        phasor,
        resultantPhasor,
        singleIntensity,
        phaseDifference,
        wrapPhase,
        twoBeamIntensity,
        intensity,
        complexGamma,
        gammaFromPhaseSamples,
        linearJones,
        jonesOverlap,
        polarizationOverlap,
        crossFactor,
        detectorBeams,
        fieldComponents,
        detectedIntensity,
        visibility,
        visibilityFromSamples,
        predictedVisibility,
        intensityExtremes,
        beat,
    };
});