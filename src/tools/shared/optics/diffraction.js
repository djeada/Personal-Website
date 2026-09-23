/*
 * Fraunhofer (far-field) diffraction model for a single slit and a circular
 * aperture. Pure, DOM-free, SI units throughout (metres, radians).
 *
 * Conventions
 *   a      slit width (full width)                          [m]
 *   D      circular aperture diameter                       [m]
 *   lambda wavelength                                       [m]
 *   L      aperture-to-detector distance                    [m]
 *   y      transverse detector coordinate (flat screen)     [m]
 *   theta  observation angle, y = L tan(theta)
 *
 *   Slit:     I/I0 = sinc^2(beta),        beta = pi a sin(theta) / lambda
 *   Circular: I/I0 = [2 J1(u) / u]^2,     u    = pi D sin(theta) / lambda
 *
 *   Fresnel number uses the aperture HALF-width b = a/2 (or radius D/2):
 *   N_F = b^2 / (lambda L). Fraunhofer theory requires N_F << 1.
 *
 *   Normalizations: "peak" I/I0; "power" I/P (circle, 1/m^2) or I/P' (slit, 1/m, P' = power
 *   per unit slit length); "absolute" W/m^2 for an incident plane wave of irradiance Iinc.
 *   Requires core.js (loaded first in the browser).
 */
(function(root, factory) {
    const m = factory();
    if (typeof module === "object" && module.exports) module.exports = m;
    else {
        root.OpticsModels = root.OpticsModels || {};
        root.OpticsModels.diffraction = m;
    }
})(typeof self !== "undefined" ? self : this, function() {
    "use strict";

    const core = (typeof require === "function" && typeof module === "object") ?
        require("./core.js") :
        self.OpticsModels.core;

    /**
     * Bessel function of the first kind, order 1 (delegates to core.besselJ1: power series for
     * |x| <= 12, Hankel asymptotic expansion beyond; absolute error ~1e-12).
     */
    const besselJ1 = (x) => (Number.isFinite(x) ? core.besselJ1(x) : 0);

    /** k-th positive zero of J1 (k = 1, 2, ...). */
    const zeroCache = [];

    function besselJ1Zero(k) {
        if (!(k >= 1) || Math.floor(k) !== k) throw new RangeError("k must be a positive integer");
        if (!zeroCache[k]) zeroCache[k] = core.besselJZero(1, k);
        return zeroCache[k];
    }

    /** sinc^2(beta) = (sin beta / beta)^2, with the finite limit 1 at beta = 0. */
    function sinc2(beta) {
        if (Math.abs(beta) < 1e-8) return 1 - beta * beta / 3;
        const s = Math.sin(beta) / beta;
        return s * s;
    }

    /** Airy function [2 J1(u)/u]^2, with the finite limit 1 at u = 0. */
    function airy(u) {
        if (Math.abs(u) < 1e-8) return 1 - u * u / 4;
        const v = 2 * besselJ1(u) / u;
        return v * v;
    }

    /** sin(theta) for a flat detector at distance L and transverse offset y. */
    function sinThetaFromY(y, L) {
        return y / Math.hypot(y, L);
    }

    /** Transverse detector position y for a given sin(theta) (|sin| < 1). */
    function yFromSinTheta(s, L) {
        if (Math.abs(s) >= 1) return Math.sign(s) * Infinity;
        return L * s / Math.sqrt(1 - s * s);
    }

    /** Peak-normalized slit intensity at angle given by sinTheta. */
    function slitIntensity(sinTheta, a, lambda) {
        return sinc2(Math.PI * a * sinTheta / lambda);
    }

    /** Peak-normalized circular-aperture (Airy) intensity at angle sinTheta. */
    function circularIntensity(sinTheta, D, lambda) {
        return airy(Math.PI * D * sinTheta / lambda);
    }

    /**
     * Peak-normalized intensity on a flat detector.
     * params: { type: "slit"|"circular", size (a or D) [m], lambda [m], L [m] }
     * r: transverse distance from axis on the detector [m] (y for a slit,
     *    radial distance for a circular aperture).
     */
    function intensityAt(r, params) {
        const s = sinThetaFromY(r, params.L);
        return params.type === "circular" ?
            circularIntensity(s, params.size, params.lambda) :
            slitIntensity(s, params.size, params.lambda);
    }

    /**
     * Positions of the dark fringes/rings on the detector (positive side), m = 1..count.
     * Slit:     a sin(theta_m) = m lambda
     * Circular: pi D sin(theta_m) / lambda = j_{1,m}
     * Minima beyond grazing incidence (sin >= 1) are omitted.
     */
    function minima(params, count) {
        const out = [];
        for (let m = 1; m <= count; m++) {
            const s = params.type === "circular" ?
                besselJ1Zero(m) * params.lambda / (Math.PI * params.size) :
                m * params.lambda / params.size;
            if (s >= 1) break;
            out.push({
                order: m,
                sinTheta: s,
                theta: Math.asin(s),
                y: yFromSinTheta(s, params.L)
            });
        }
        return out;
    }

    /** First minimum position on the detector (m). */
    function firstMinimum(params) {
        const list = minima(params, 1);
        return list.length ? list[0].y : Infinity;
    }

    /**
     * Fresnel number with the half-width convention: b = size/2, N_F = b^2 / (lambda L).
     * Returns the number and a regime classification.
     *   N_F < 0.1        -> "fraunhofer"  (far-field approximation good)
     *   0.1 <= N_F < 1   -> "marginal"    (far-field shape only approximate)
     *   N_F >= 1         -> "fresnel"     (far-field formula not valid)
     */
    function fresnelNumber(size, lambda, L) {
        const b = size / 2;
        return (b * b) / (lambda * L);
    }

    function regime(nf) {
        if (nf < 0.1) return "fraunhofer";
        if (nf < 1) return "marginal";
        return "fresnel";
    }

    /**
     * Map a peak-normalized intensity (0..1) to a display value 0..1.
     * scale "linear": identity. scale "log": log10 with a floor of 10^-decades,
     * so values <= floor map to 0 and 1 maps to 1.
     */
    function displayValue(I, scale, decades) {
        const v = Math.max(0, Math.min(1, I));
        if (scale !== "log") return v;
        const d = decades > 0 ? decades : 4;
        const floor = Math.pow(10, -d);
        if (v <= floor) return 0;
        return 1 + Math.log10(v) / d;
    }

    /** Small-angle (paraxial) position of the m-th minimum: slit mλL/a, circle j_{1,m} λL/(πD). */
    function smallAngleMinimum(params, m) {
        const k = params.type === "circular" ? besselJ1Zero(m) / Math.PI : m;
        return k * params.lambda * params.L / params.size;
    }

    /**
     * Sine integral Si(x) = ∫0^x sin(t)/t dt (odd). Power series for |x| <= 20 (cancellation
     * error ~1e-9), asymptotic auxiliary-function series beyond (truncated at the smallest term,
     * error < 1e-9).
     */
    function sineIntegral(x) {
        if (!Number.isFinite(x)) return Math.sign(x) * Math.PI / 2;
        const ax = Math.abs(x);
        let r;
        if (ax <= 20) {
            // Si(x) = Σ (-1)^k x^(2k+1) / ((2k+1) (2k+1)!)
            let term = ax,
                sum = ax;
            for (let k = 1; k < 200; k++) {
                term *= -ax * ax / ((2 * k) * (2 * k + 1));
                const add = term / (2 * k + 1);
                sum += add;
                if (Math.abs(add) < 1e-18 * Math.abs(sum)) break;
            }
            r = sum;
        } else {
            // Si(x) = π/2 − f(x) cos x − g(x) sin x, f ~ (1/x) Σ (-1)^k (2k)!/x^(2k), g ~ (1/x²) Σ (-1)^k (2k+1)!/x^(2k)
            let f = 0,
                g = 0,
                tf = 1,
                tg = 1,
                prev = Infinity;
            for (let k = 0; k < 40; k++) {
                if (k > 0) {
                    tf *= -(2 * k - 1) * (2 * k) / (ax * ax);
                    tg *= -(2 * k) * (2 * k + 1) / (ax * ax);
                }
                const mag = Math.abs(tf);
                if (mag > prev) break;
                prev = mag;
                f += tf;
                g += tg;
                if (mag < 1e-17) break;
            }
            f /= ax;
            g /= ax * ax;
            r = Math.PI / 2 - f * Math.cos(ax) - g * Math.sin(ax);
        }
        return x < 0 ? -r : r;
    }

    /**
     * Fraction of the transmitted (Fraunhofer) power that falls inside |y| < Y (slit) or r < Y
     * (circle) on a flat detector at distance L. Power is counted in the angular variable
     * (sin θ), which is exact for the Fraunhofer angular spectrum and ignores obliquity.
     *   Slit:   F(β) = (2/π) [Si(2β) − sin²β / β],   β = π a sinθ/λ   (F(∞) = 1)
     *   Circle: F(u) = 1 − J0(u)² − J1(u)²,          u = π D sinθ/λ   (Rayleigh)
     */
    function enclosedPower(params, Y) {
        if (!(Y > 0)) return 0;
        if (!Number.isFinite(Y)) return 1;
        const s = sinThetaFromY(Y, params.L);
        const x = Math.PI * params.size * s / params.lambda;
        if (params.type === "circular") {
            const j0 = core.besselJ0(x),
                j1 = core.besselJ1(x);
            return Math.min(1, Math.max(0, 1 - j0 * j0 - j1 * j1));
        }
        const sb = Math.sin(x);
        const tail = x < 1e-8 ? x : sb * sb / x;
        return Math.min(1, Math.max(0, (2 / Math.PI) * (sineIntegral(2 * x) - tail)));
    }

    /** Fraction of the power inside the central maximum (to the first zero): 0.9028 slit, 0.8378 circle. */
    function centralLobeFraction(type) {
        if (type === "circular") {
            const j0 = core.besselJ0(besselJ1Zero(1));
            return 1 - j0 * j0;
        }
        return (2 / Math.PI) * sineIntegral(2 * Math.PI);
    }

    /**
     * Peak value of the pattern in the requested normalization (paraxial Fraunhofer scaling;
     * obliquity factor neglected). Incident plane wave of irradiance Iinc [W/m²].
     *   "peak":     1 (I/I₀).
     *   "power":    slit I₀/P′ = a/(λL) [1/m], P′ = Iinc·a is the power per unit slit length;
     *               circle I₀/P = A/(λ²L²) [1/m²], A = πD²/4 and P = Iinc·A.
     *   "absolute": slit I₀ = Iinc a²/(λL); circle I₀ = Iinc A²/(λ²L²) [W/m²].
     * With these peaks ∫ I dy = P′ (slit) and ∬ I dA = P (circle) in the small-angle limit.
     */
    function peakValue(params, norm, Iinc) {
        const {
            size,
            lambda,
            L
        } = params;
        const circ = params.type === "circular";
        const A = circ ? Math.PI * size * size / 4 : size;
        const perPower = circ ? A / (lambda * lambda * L * L) : A / (lambda * L);
        if (norm === "power") return perPower;
        if (norm === "absolute") return (Iinc > 0 ? Iinc : 0) * A * perPower;
        return 1;
    }

    /** Transmitted power: circle Iinc·πD²/4 [W]; slit Iinc·a [W per metre of slit length]. */
    function transmittedPower(params, Iinc) {
        const A = params.type === "circular" ? Math.PI * params.size * params.size / 4 : params.size;
        return Iinc * A;
    }

    /** Sample the peak-normalized line cut at n points on [-R, R] (m). Returns {ys, I} Float64Arrays. */
    function lineCut(params, R, n) {
        const ys = new Float64Array(n),
            I = new Float64Array(n);
        for (let i = 0; i < n; i++) {
            const y = -R + (2 * R * i) / (n - 1);
            ys[i] = y;
            I[i] = intensityAt(Math.abs(y), params);
        }
        return {
            ys,
            I
        };
    }

    /**
     * Peak-normalized 2D detector image over the square [-R, R]² sampled at pixel centres,
     * row-major a[iy*n + ix], x horizontal. Long slit (along y): I depends on x only.
     * Circle: I depends on r = hypot(x, y) only.
     */
    function detectorImage(params, R, n) {
        const out = new Float64Array(n * n);
        const d = (2 * R) / n;
        const circ = params.type === "circular";
        const cache = new Float64Array(n);
        for (let ix = 0; ix < n; ix++) cache[ix] = intensityAt(Math.abs(-R + (ix + 0.5) * d), params);
        for (let iy = 0; iy < n; iy++) {
            const y = -R + (iy + 0.5) * d;
            for (let ix = 0; ix < n; ix++) {
                out[iy * n + ix] = circ ? intensityAt(Math.hypot(-R + (ix + 0.5) * d, y), params) : cache[ix];
            }
        }
        return out;
    }

    return {
        besselJ1,
        besselJ1Zero,
        sinc2,
        airy,
        sinThetaFromY,
        yFromSinTheta,
        slitIntensity,
        circularIntensity,
        intensityAt,
        minima,
        firstMinimum,
        fresnelNumber,
        regime,
        displayValue,
        smallAngleMinimum,
        sineIntegral,
        enclosedPower,
        centralLobeFraction,
        peakValue,
        transmittedPower,
        lineCut,
        detectorImage,
    };
});