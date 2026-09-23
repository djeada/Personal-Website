/*
 * Double-slit Fraunhofer model (classical scalar optics).
 *
 * All lengths are in metres, angles in radians, phases in radians.
 *
 * Geometry: two identical slits of width `a` whose centres are separated by `d`,
 * slit 1 centred at y = +d/2 ("top"), slit 2 at y = -d/2 ("bottom"). A screen at
 * distance `L` is sampled at position `y`; the observation angle is θ = atan(y/L).
 *
 * Far-field (Fraunhofer) field of the pair, for unit-amplitude equal slits:
 *   E(θ) ∝ sinc(β) [A1 e^{+iδ/2} + A2 e^{iφ} e^{-iδ/2}],
 *   β = π a sinθ / λ, δ = 2π d sinθ / λ, sinc(u) = sin(u)/u.
 * With partial mutual coherence |γ| between the two slit fields the intensity is
 *   I(θ) = sinc²(β) [A1² + A2² + 2 A1 A2 |γ| cos(δ − φ)].
 * For A1 = A2 = 1, γ = 1, φ = 0 this is 4 sinc²(β) cos²(δ/2), i.e.
 *   I/Imax = sinc²(π a sinθ/λ) cos²(π d sinθ/λ).
 *
 * Assumptions: scalar field, monochromatic illumination, normally incident plane
 * wave, uniform slit illumination, Fraunhofer propagation (valid when
 * L ≫ (d + a)² / λ). Using the exact screen angle does not make this a near-field
 * solver; obliquity and 1/r fall-off are neglected.
 */
(function(root, factory) {
    const m = factory();
    if (typeof module === "object" && module.exports) module.exports = m;
    else {
        root.OpticsModels = root.OpticsModels || {};
        root.OpticsModels.doubleSlit = m;
    }
})(typeof self !== "undefined" ? self : this, function() {
    "use strict";

    const DEFAULTS = Object.freeze({
        wavelength: 500e-9,
        slitWidth: 0.05e-3,
        slitSeparation: 0.25e-3,
        distance: 1,
        slit1: true,
        slit2: true,
        amplitudeRatio: 1, // A2 / A1 (field amplitude), 0..1
        relativePhase: 0, // φ, phase of slit 2 relative to slit 1
        coherence: 1, // |γ12|, 0..1
    });

    function sinc(u) {
        if (Math.abs(u) < 1e-8) return 1 - (u * u) / 6;
        return Math.sin(u) / u;
    }

    /** Normalise and validate parameters. Throws on physically impossible input. */
    function normalizeParams(p) {
        const q = Object.assign({}, DEFAULTS, p || {});
        ["wavelength", "slitWidth", "slitSeparation", "distance"].forEach((k) => {
            if (!(Number.isFinite(q[k]) && q[k] > 0)) {
                throw new RangeError(k + " must be a positive finite length in metres");
            }
        });
        if (!(q.slitWidth < q.slitSeparation)) {
            throw new RangeError("slits overlap: slit width a must be smaller than centre separation d");
        }
        q.amplitudeRatio = Math.min(1, Math.max(0, +q.amplitudeRatio));
        q.coherence = Math.min(1, Math.max(0, +q.coherence));
        q.relativePhase = +q.relativePhase || 0;
        q.slit1 = !!q.slit1;
        q.slit2 = !!q.slit2;
        return q;
    }

    /**
     * Largest slit width allowed for a given separation (keeps an opaque bar
     * between the slits). `margin` is the minimum fraction of d left opaque.
     */
    function maxSlitWidth(slitSeparation, margin) {
        const f = margin === undefined ? 0.02 : margin;
        return slitSeparation * (1 - f);
    }

    function amplitudes(q) {
        return {
            a1: q.slit1 ? 1 : 0,
            a2: q.slit2 ? q.amplitudeRatio : 0,
        };
    }

    /** Single-slit envelope sinc²(π a sinθ / λ). */
    function envelopeAtSin(sinTheta, q) {
        const b = sinc((Math.PI * q.slitWidth * sinTheta) / q.wavelength);
        return b * b;
    }

    /**
     * Intensity at a given sinθ, in units of the on-axis intensity of ONE fully
     * open slit (so two equal, coherent, in-phase slits give 4 on axis).
     */
    function intensityAtSin(sinTheta, params) {
        const q = normalizeParams(params);
        return intensityAtSinQ(sinTheta, q);
    }

    function intensityAtSinQ(sinTheta, q) {
        const {
            a1,
            a2
        } = amplitudes(q);
        const delta = (2 * Math.PI * q.slitSeparation * sinTheta) / q.wavelength;
        const fringe = a1 * a1 + a2 * a2 + 2 * a1 * a2 * q.coherence * Math.cos(delta - q.relativePhase);
        return envelopeAtSin(sinTheta, q) * Math.max(0, fringe);
    }

    function sinThetaAtY(y, L) {
        const theta = Math.atan2(y, L);
        return Math.sin(theta);
    }

    /** Intensity at screen position y (metres), same units as intensityAtSin. */
    function intensityAtY(y, params) {
        const q = normalizeParams(params);
        return intensityAtSinQ(sinThetaAtY(y, q.distance), q);
    }

    /**
     * Peak-normalised textbook baseline for equal, coherent, in-phase slits:
     * I/Imax = sinc²(π a sinθ/λ) cos²(π d sinθ/λ).
     */
    function normalizedBaselineAtY(y, params) {
        const q = normalizeParams(Object.assign({}, params, {
            slit1: true,
            slit2: true,
            amplitudeRatio: 1,
            coherence: 1,
            relativePhase: 0,
        }));
        return intensityAtSinQ(sinThetaAtY(y, q.distance), q) / 4;
    }

    /** Paraxial fringe spacing λL/d. */
    function paraxialFringeSpacing(params) {
        const q = normalizeParams(params);
        return (q.wavelength * q.distance) / q.slitSeparation;
    }

    /** Paraxial position of the first envelope zero, λL/a. */
    function paraxialEnvelopeZero(params) {
        const q = normalizeParams(params);
        return (q.wavelength * q.distance) / q.slitWidth;
    }

    /** Exact screen position of the first envelope zero, or Infinity if λ ≥ a. */
    function envelopeZero(params) {
        const q = normalizeParams(params);
        const s = q.wavelength / q.slitWidth;
        if (s >= 1) return Infinity;
        return q.distance * Math.tan(Math.asin(s));
    }

    /**
     * Interference maxima orders m that correspond to real propagating directions:
     * |m| λ / d < 1 (|m|λ/d = 1 is grazing, never reaching a finite screen).
     * Returns each order with sinθ and exact screen position y = L tan(asin(sinθ)),
     * optionally limited to |y| ≤ halfWidth. Relative phase shifts every order by φ/(2π).
     */
    function interferenceOrders(params, halfWidth) {
        const q = normalizeParams(params);
        const shift = q.relativePhase / (2 * Math.PI);
        const out = [];
        const ratio = q.wavelength / q.slitSeparation;
        const mMax = Math.ceil(1 / ratio + Math.abs(shift)) + 1;
        for (let m = -mMax; m <= mMax; m++) {
            const s = (m + shift) * ratio;
            if (!(Math.abs(s) < 1 - 1e-12)) continue;
            const y = q.distance * Math.tan(Math.asin(s));
            if (halfWidth !== undefined && Math.abs(y) > halfWidth) continue;
            const env = envelopeAtSin(s, q);
            out.push({
                m,
                sinTheta: s,
                y,
                envelope: env,
                missing: env < 1e-6
            });
        }
        return out;
    }

    /** Highest real order magnitude for φ = 0: largest integer |m| with |m| λ/d < 1. */
    function maxPhysicalOrder(params) {
        const q = normalizeParams(params);
        const r = q.slitSeparation / q.wavelength;
        // tolerate round-off so that d = Nλ exactly (grazing order) is excluded
        return Math.max(0, Math.ceil(r * (1 - 1e-12)) - 1);
    }

    /** Fresnel number N_F = (D/2)² / (λL) with D = d + a the full aperture extent. */
    function fresnelNumber(params) {
        const q = normalizeParams(params);
        const half = (q.slitSeparation + q.slitWidth) / 2;
        return (half * half) / (q.wavelength * q.distance);
    }

    /** Theoretical fringe visibility 2 A1 A2 |γ| / (A1² + A2²). */
    function theoreticalVisibility(params) {
        const q = normalizeParams(params);
        const {
            a1,
            a2
        } = amplitudes(q);
        const den = a1 * a1 + a2 * a2;
        if (den === 0) return 0;
        return (2 * a1 * a2 * q.coherence) / den;
    }

    /**
     * Sample the screen from -halfWidth to +halfWidth (metres). Every readout,
     * detector pixel, and plot point is derived from this one array.
     */
    function sampleScreen(params, halfWidth, options) {
        const q = normalizeParams(params);
        if (!(halfWidth > 0)) throw new RangeError("halfWidth must be positive");
        const opts = options || {};
        const spacing = (q.wavelength * q.distance) / q.slitSeparation;
        const perFringe = opts.samplesPerFringe || 24;
        const minN = opts.minSamples || 1201;
        const maxN = opts.maxSamples || 40001;
        let n = Math.ceil(((2 * halfWidth) / spacing) * perFringe) + 1;
        n = Math.max(minN, Math.min(maxN, n));
        if (n % 2 === 0) n += 1; // keep y = 0 on a sample
        const y = new Float64Array(n);
        const intensity = new Float64Array(n);
        const envelope = new Float64Array(n);
        const {
            a1,
            a2
        } = amplitudes(q);
        const upperFactor = a1 * a1 + a2 * a2 + 2 * a1 * a2 * q.coherence;
        const lowerFactor = Math.max(0, a1 * a1 + a2 * a2 - 2 * a1 * a2 * q.coherence);
        const lower = new Float64Array(n);
        let peak = 0;
        for (let i = 0; i < n; i++) {
            const yi = -halfWidth + (2 * halfWidth * i) / (n - 1);
            const s = sinThetaAtY(yi, q.distance);
            y[i] = yi;
            intensity[i] = intensityAtSinQ(s, q);
            const e = envelopeAtSin(s, q);
            envelope[i] = e * upperFactor;
            lower[i] = e * lowerFactor;
            if (intensity[i] > peak) peak = intensity[i];
        }
        const dy = (2 * halfWidth) / (n - 1);
        return {
            params: q,
            halfWidth,
            n,
            dy,
            y,
            intensity, // units: single-slit on-axis intensity
            envelope, // upper fringe envelope, same units
            lowerEnvelope: lower,
            peak,
            reference: 4, // two equal coherent in-phase slits, on axis
            samplesPerFringe: spacing / dy,
            resolved: spacing / dy >= 4,
        };
    }

    function localExtrema(sample, wantMax) {
        const I = sample.intensity;
        const out = [];
        const floor = sample.peak * 1e-6;
        for (let i = 1; i < I.length - 1; i++) {
            const isExt = wantMax ?
                I[i] > I[i - 1] && I[i] >= I[i + 1] && I[i] > floor :
                I[i] < I[i - 1] && I[i] <= I[i + 1];
            if (isExt) {
                // parabolic refinement
                const den = I[i - 1] - 2 * I[i] + I[i + 1];
                const off = den !== 0 ? (0.5 * (I[i - 1] - I[i + 1])) / den : 0;
                out.push({
                    index: i,
                    y: sample.y[i] + off * sample.dy,
                    value: I[i]
                });
            }
        }
        return out;
    }

    function localMaxima(sample) {
        return localExtrema(sample, true);
    }

    function localMinima(sample) {
        return localExtrema(sample, false);
    }

    /**
     * Readouts measured from the sampled array: fringe spacing from adjacent
     * minima near the centre (minima are not pulled inward by the sloping
     * envelope the way maxima are), and visibility (Imax − Imin)/(Imax + Imin) over the
     * central fringe period.
     */
    function analyzeSample(sample) {
        const q = sample.params;
        const I = sample.intensity;
        const n = sample.n;
        const paraxial = (q.wavelength * q.distance) / q.slitSeparation;
        const bothOpen = q.slit1 && q.slit2 && q.amplitudeRatio > 0;
        const result = {
            measuredSpacing: null,
            measuredVisibility: null,
            maximaCount: 0,
            paraxialSpacing: paraxial,
        };
        const maxima = localMaxima(sample);
        result.maximaCount = maxima.length;
        if (!sample.resolved) return result;

        // central window: one paraxial fringe period on each side of y = 0,
        // limited to the central envelope lobe
        const env0 = Math.min(envelopeZero(q), sample.halfWidth);
        const win = Math.min(0.5 * paraxial, 0.5 * env0);
        const mid = (n - 1) / 2;
        const k = Math.max(1, Math.round(win / sample.dy));
        let hi = -Infinity;
        let lo = Infinity;
        for (let i = Math.max(0, mid - k); i <= Math.min(n - 1, mid + k); i++) {
            if (I[i] > hi) hi = I[i];
            if (I[i] < lo) lo = I[i];
        }
        result.measuredVisibility = bothOpen && hi + lo > 0 ? (hi - lo) / (hi + lo) : 0;

        if (bothOpen && q.coherence > 0) {
            const central = localMinima(sample).filter((mx) => Math.abs(mx.y) <= Math.max(env0 * 0.9, paraxial * 1.5));
            if (central.length >= 2) {
                central.sort((u, v) => Math.abs(u.y) - Math.abs(v.y));
                const pick = central.slice(0, Math.min(central.length, 5)).sort((u, v) => u.y - v.y);
                result.measuredSpacing = (pick[pick.length - 1].y - pick[0].y) / (pick.length - 1);
            }
        }
        return result;
    }

    /**
     * Far-field validity summary for a given screen half-width (metres).
     * regime: "far" (N_F < 0.1), "marginal" (0.1 ≤ N_F < 1) or "near" (N_F ≥ 1), where
     * N_F = (D/2)²/(λL), D = d + a. `minFarFieldDistance` is the L at which N_F = 0.1.
     * `maxAngle` is the largest observation angle on the screen; `paraxialOK` is false beyond 10°,
     * where sinθ ≈ tanθ ≈ y/L errs by more than ~1.5 %.
     */
    function validity(params, halfWidth) {
        const q = normalizeParams(params);
        const nf = fresnelNumber(q);
        const half = (q.slitSeparation + q.slitWidth) / 2;
        const maxAngle = halfWidth > 0 ? Math.atan(halfWidth / q.distance) : 0;
        return {
            fresnelNumber: nf,
            regime: nf >= 1 ? "near" : nf >= 0.1 ? "marginal" : "far",
            minFarFieldDistance: (half * half) / (0.1 * q.wavelength),
            maxAngle,
            paraxialOK: maxAngle <= (10 * Math.PI) / 180,
            subwavelengthSeparation: q.slitSeparation <= q.wavelength,
            subwavelengthWidth: q.slitWidth <= q.wavelength,
        };
    }

    /**
     * Cumulative trapezoidal integral of the sampled intensity (same length as sample.y),
     * units: intensity × metres. Used for expected detection counts.
     */
    function cumulativeIntensity(sample) {
        const I = sample.intensity;
        const C = new Float64Array(sample.n);
        for (let i = 1; i < sample.n; i++) C[i] = C[i - 1] + 0.5 * (I[i - 1] + I[i]) * sample.dy;
        return C;
    }

    function cumulativeAt(sample, C, y) {
        const t = (y + sample.halfWidth) / sample.dy;
        if (t <= 0) return 0;
        if (t >= sample.n - 1) return C[sample.n - 1];
        const i = Math.floor(t),
            f = t - i;
        // exact integral of the linear interpolant inside segment i
        const I0 = sample.intensity[i],
            I1 = sample.intensity[i + 1];
        return C[i] + sample.dy * (I0 * f + 0.5 * (I1 - I0) * f * f);
    }

    /**
     * Simulated single-quantum detections on the screen (photon-count view).
     * The normalised sampled intensity is used as the probability density for a detection
     * *conditioned on hitting the screen* (|y| ≤ halfWidth). `rng` is a seeded generator
     * ({next()} or a function returning [0, 1)); use core.createRng(seed) for reproducibility.
     * Returns { nBins, edges, centers, counts (Uint32Array), expected (Float64Array, mean counts),
     *           total, positions (Float64Array of y, only when N ≤ keepPositions, default 20000) }.
     * Detector physics (quantum efficiency, dark counts, pixel cross-talk) is not modelled.
     */
    function detectionHistogram(sample, N, nBins, rng, options) {
        const opts = options || {};
        const next = typeof rng === "function" ? rng : rng.next.bind(rng);
        N = Math.max(0, Math.floor(N));
        nBins = Math.max(1, Math.floor(nBins));
        const hw = sample.halfWidth;
        const C = cumulativeIntensity(sample);
        const total = C[sample.n - 1];
        const edges = new Float64Array(nBins + 1);
        const centers = new Float64Array(nBins);
        const counts = new Uint32Array(nBins);
        const expected = new Float64Array(nBins);
        for (let b = 0; b <= nBins; b++) edges[b] = -hw + (2 * hw * b) / nBins;
        for (let b = 0; b < nBins; b++) {
            centers[b] = 0.5 * (edges[b] + edges[b + 1]);
            expected[b] = total > 0 ? (N * (cumulativeAt(sample, C, edges[b + 1]) - cumulativeAt(sample, C, edges[b]))) / total : 0;
        }
        const keep = N <= (opts.keepPositions === undefined ? 20000 : opts.keepPositions);
        const positions = keep ? new Float64Array(N) : null;
        if (total > 0) {
            const I = sample.intensity,
                dy = sample.dy;
            for (let k = 0; k < N; k++) {
                const target = next() * total;
                // binary search for the segment containing target
                let lo = 0,
                    hi = sample.n - 1;
                while (hi - lo > 1) {
                    const mid = (lo + hi) >> 1;
                    if (C[mid] <= target) lo = mid;
                    else hi = mid;
                }
                // invert the linear-interpolant integral inside segment lo
                const I0 = I[lo],
                    I1 = I[lo + 1],
                    r = (target - C[lo]) / dy;
                const sl = I1 - I0;
                let f;
                if (Math.abs(sl) < 1e-14 * Math.max(I0, I1, 1e-300)) f = I0 > 0 ? r / I0 : 0.5;
                else f = (-I0 + Math.sqrt(Math.max(0, I0 * I0 + 2 * sl * r))) / sl;
                f = Math.min(1, Math.max(0, f));
                const y = sample.y[lo] + f * dy;
                if (positions) positions[k] = y;
                const b = Math.min(nBins - 1, Math.max(0, Math.floor(((y + hw) / (2 * hw)) * nBins)));
                counts[b]++;
            }
        }
        return {
            nBins,
            edges,
            centers,
            counts,
            expected,
            total: total > 0 ? N : 0,
            positions
        };
    }

    return {
        DEFAULTS,
        sinc,
        normalizeParams,
        maxSlitWidth,
        envelopeAtSin: (s, p) => envelopeAtSin(s, normalizeParams(p)),
        intensityAtSin,
        intensityAtY,
        normalizedBaselineAtY,
        paraxialFringeSpacing,
        paraxialEnvelopeZero,
        envelopeZero,
        interferenceOrders,
        maxPhysicalOrder,
        fresnelNumber,
        theoreticalVisibility,
        sampleScreen,
        localMaxima,
        localMinima,
        analyzeSample,
        validity,
        cumulativeIntensity,
        detectionHistogram,
    };
});