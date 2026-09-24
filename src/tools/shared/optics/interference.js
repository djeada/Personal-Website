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


    function sinc(u) {
        if (Math.abs(u) < 1e-8) return 1 - (u * u) / 6;
        return Math.sin(u) / u;
    }


    function omegaFromK(k, c) {
        return c * k;
    }


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


    function wavePhase(w, x, t) {
        return w.k * x - w.omega * t + w.phi;
    }


    function field(w, x, t) {
        return w.A * Math.cos(wavePhase(w, x, t));
    }


    function superpose(waves, x, t) {
        let s = 0;
        for (const w of waves) s += field(w, x, t);
        return s;
    }


    function phasor(w, x, t) {
        const th = wavePhase(w, x, t);
        return {
            re: w.A * Math.cos(th),
            im: w.A * Math.sin(th),
            angle: th,
            magnitude: Math.abs(w.A)
        };
    }


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


    function singleIntensity(A) {
        return 0.5 * A * A;
    }


    function phaseDifference(w1, w2, x, t) {
        return wavePhase(w2, x, t) - wavePhase(w1, x, t);
    }


    function wrapPhase(a) {
        const r = a % TWO_PI;
        return r < 0 ? r + TWO_PI : r;
    }


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


    function intensity(w1, w2, x, t, gamma) {
        return twoBeamIntensity(singleIntensity(w1.A), singleIntensity(w2.A), phaseDifference(w1, w2, x, t), gamma);
    }




    function complexGamma(mag, arg) {
        return normalizeGamma({
            mag,
            arg: arg || 0
        });
    }


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


    function linearJones(theta) {
        return [{
            re: Math.cos(theta),
            im: 0
        }, {
            re: Math.sin(theta),
            im: 0
        }];
    }


    function jonesOverlap(j1, j2) {
        const n1 = Math.hypot(j1[0].re, j1[0].im, j1[1].re, j1[1].im);
        const n2 = Math.hypot(j2[0].re, j2[0].im, j2[1].re, j2[1].im);
        if (!(n1 > 0) || !(n2 > 0)) throw new RangeError("Jones vectors must be nonzero");
        let re = 0,
            im = 0;
        for (let i = 0; i < 2; i++) {

            re += j1[i].re * j2[i].re + j1[i].im * j2[i].im;
            im += j1[i].re * j2[i].im - j1[i].im * j2[i].re;
        }
        return {
            re: re / (n1 * n2),
            im: im / (n1 * n2)
        };
    }


    function polarizationOverlap(theta) {
        return Math.cos(theta);
    }


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


    function fieldComponents(w1, w2, x, t, theta) {
        const e1 = field(w1, x, t),
            e2 = field(w2, x, t);
        return {
            par: e1 + e2 * Math.cos(theta || 0),
            perp: e2 * Math.sin(theta || 0)
        };
    }


    function detectedIntensity(w1, w2, x, t, T, gamma) {
        const g = normalizeGamma(gamma);
        const I1 = singleIntensity(w1.A),
            I2 = singleIntensity(w2.A);
        const Tint = Math.max(0, T || 0);
        const dOmega = w2.omega - w1.omega;
        const mid = phaseDifference(w1, w2, x, t - Tint / 2);
        return I1 + I2 + 2 * Math.sqrt(I1 * I2) * g.mag * sinc(dOmega * Tint / 2) * Math.cos(mid + g.arg);
    }


    function visibility(Imax, Imin) {
        const s = Imax + Imin;
        return s > 0 ? (Imax - Imin) / s : 0;
    }


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


    function predictedVisibility(A1, A2, gammaMag, dOmega, T) {
        const I1 = singleIntensity(A1),
            I2 = singleIntensity(A2);
        if (I1 + I2 === 0) return 0;
        const g = gammaMag === undefined ? 1 : gammaMag;
        return (2 * Math.sqrt(I1 * I2) * g / (I1 + I2)) * Math.abs(sinc(((dOmega || 0) * (T || 0)) / 2));
    }


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