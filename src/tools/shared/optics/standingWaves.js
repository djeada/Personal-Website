/*
 * Standing-wave model for a monochromatic plane wave at normal incidence.
 *
 * Pure, DOM-free. SI units: metres, seconds, radians, hertz.
 *
 * Conventions (shared with the page text):
 *   - Time dependence exp(-i omega t); physical field = Re[ E~(x) exp(-i(omega t - phi)) ].
 *   - k = 2 pi n nu / c is the wavenumber in the medium of index n.
 *   - Reflection coefficient r = E_reflected / E_incident, evaluated AT the boundary.
 *
 * Single-boundary mode: the medium fills 0 <= x <= L and the reflector sits at x = L.
 *   s = L - x is the distance in front of the boundary.
 *   E~(x)     = E0 [ exp(-i k s) + r exp(+i k s) ]      (incident travels +x, reflected travels -x)
 *   eta H~(x) = E0 [ exp(-i k s) - r exp(+i k s) ]      (eta = eta0 / n, H along +z for E along +y)
 *
 * Two-boundary resonator: mirrors r1 at x = 0 and r2 at x = L.
 *   E~(x) = E0 [ exp(-i k x) + r1 exp(+i k x) ], which is the same form with s = x.
 *   Self-consistency after one round trip: r1 r2 exp(2 i k L) = 1
 *   => nu_q = (q - (theta1 + theta2) / 2pi) c / (2 n L), q integer, nu_q > 0.
 *   For two perfect electric conductors (theta1 = theta2 = pi) this is nu_m = m c / (2 n L), m = 1, 2, ...
 *
 * Envelope |E~| = E0 sqrt(1 + |r|^2 + 2 |r| cos(2 k s + theta)), so
 *   maxima E0 (1 + |r|) at 2 k s + theta = 2 pi m,
 *   minima E0 (1 - |r|) at 2 k s + theta = (2 m + 1) pi,
 *   SWR = (1 + |r|) / (1 - |r|).
 *
 * Partial mirrors (finite finesse preview, the link to the passive-resonator tool):
 *   lossless mirrors with power reflectances R1, R2 and the same phases theta1, theta2.
 *   Round-trip field factor rho = r1 r2 exp(2 i k L), |rho| = sqrt(R1 R2).
 *   Transmission for a wave incident on mirror 1 (Airy function):
 *     T(nu) = (1 - R1)(1 - R2) / |1 - rho|^2
 *           = (1 - R1)(1 - R2) / [ (1 - sqrt(R1 R2))^2 + 4 sqrt(R1 R2) sin^2(delta / 2) ],
 *     delta = 2 k L + theta1 + theta2, so the peaks sit exactly at the ideal-mirror nu_q.
 *   Finesse F = pi (R1 R2)^(1/4) / (1 - sqrt(R1 R2)); FWHM linewidth = FSR / F (high-F limit;
 *   airyFWHM gives the exact value). Photon lifetime from the round-trip power survival
 *   factor R1 R2: tau = t_rt / (-ln(R1 R2)), t_rt = 2 n L / c; Q = 2 pi nu tau.
 */
(function(root, factory) {
    const m = factory();
    if (typeof module === "object" && module.exports) module.exports = m;
    else {
        root.OpticsModels = root.OpticsModels || {};
        root.OpticsModels.standingWaves = m;
    }
})(typeof self !== "undefined" ? self : this, function() {
    "use strict";

    const C = 299792458;
    const ETA0 = 376.730313668;
    const TWO_PI = 2 * Math.PI;

    function complexPolar(mag, phase) {
        return {
            re: mag * Math.cos(phase),
            im: mag * Math.sin(phase),
            mag: mag,
            phase: phase
        };
    }

    function wrapPhase(phase) {
        let p = ((phase + Math.PI) % TWO_PI + TWO_PI) % TWO_PI - Math.PI;
        if (p <= -Math.PI + 1e-12) p = Math.PI;
        return p;
    }

    /** Fresnel amplitude reflection at normal incidence, wave in n1 hitting n2 (lossless, real indices). */
    function reflectionFromIndices(n1, n2) {
        const r = (n1 - n2) / (n1 + n2);
        return complexPolar(Math.abs(r), r < 0 ? Math.PI : 0);
    }

    /** Fresnel amplitude transmission at normal incidence (E-field), n1 -> n2. */
    function transmissionFromIndices(n1, n2) {
        return 2 * n1 / (n1 + n2);
    }

    const REFLECTOR_PRESETS = {
        pec: {
            label: "Perfect electric conductor",
            r: complexPolar(1, Math.PI)
        },
        pmc: {
            label: "Perfect magnetic conductor (ideal)",
            r: complexPolar(1, 0)
        },
        absorber: {
            label: "Matched absorber",
            r: complexPolar(0, 0)
        },
    };

    function wavenumber(nu, n) {
        return TWO_PI * n * nu / C;
    }

    function wavelengthInMedium(nu, n) {
        return C / (n * nu);
    }

    function standingWaveRatio(rMag) {
        if (rMag >= 1) return Infinity;
        return (1 + rMag) / (1 - rMag);
    }

    /** Net time-averaged power flow toward the boundary, relative to the incident intensity. */
    function netPowerFraction(rMag) {
        return 1 - rMag * rMag;
    }

    /** Resonance frequencies of a two-mirror cavity: r1 r2 exp(2ikL) = 1. */
    function resonatorFrequency(q, n, L, theta1, theta2) {
        const offset = ((theta1 + theta2) / TWO_PI);
        return (q - offset) * C / (2 * n * L);
    }

    function freeSpectralRange(n, L) {
        return C / (2 * n * L);
    }

    /**
     * Allowed mode frequencies for the cavity, m = 1, 2, ... indexing the positive
     * solutions in increasing order.
     */
    function resonatorModes(n, L, theta1, theta2, count) {
        const offset = (theta1 + theta2) / TWO_PI;
        const qStart = Math.floor(offset) + 1;
        const modes = [];
        for (let i = 0; i < count; i++) {
            const q = qStart + i;
            let nu = (q - offset) * C / (2 * n * L);
            if (nu <= 0) continue;
            modes.push({
                m: modes.length + 1,
                q: q,
                nu: nu
            });
        }
        return modes;
    }

    function resonatorModeFrequency(m, n, L, theta1, theta2) {
        const modes = resonatorModes(n, L, theta1, theta2, m);
        return modes[m - 1].nu;
    }

    /**
     * Build a configuration describing the field in the plotted window 0 <= x <= L.
     * params: { mode: "single" | "resonator", n, L, nu, r: {mag, phase}, r1, r2 }
     * Returns the reference reflector r (at x = L for "single", r1 at x = 0 for
     * "resonator"), the map x -> s (distance from that reflector) and the H sign.
     */
    function describe(params) {
        const n = params.n;
        const L = params.L;
        const nu = params.nu;
        const k = wavenumber(nu, n);
        let r, sign, sAtX;
        if (params.mode === "resonator") {
            r = params.r1;
            sign = -1; // "incident" component (exp(-iks)) travels toward x = 0
            sAtX = function(x) {
                return x;
            };
        } else {
            r = params.r;
            sign = 1;
            sAtX = function(x) {
                return L - x;
            };
        }
        return {
            n: n,
            L: L,
            nu: nu,
            k: k,
            omega: TWO_PI * nu,
            r: r,
            sign: sign,
            sAtX: sAtX,
            mode: params.mode
        };
    }

    /** Complex phasors at position x (metres). E in units of E0, H multiplied by the medium impedance. */
    function phasors(cfg, x) {
        const s = cfg.sAtX(x);
        const ks = cfg.k * s;
        const incRe = Math.cos(ks),
            incIm = -Math.sin(ks); // exp(-iks)
        const a = ks + cfg.r.phase;
        const refRe = cfg.r.mag * Math.cos(a),
            refIm = cfg.r.mag * Math.sin(a); // r exp(iks)
        return {
            incRe: incRe,
            incIm: incIm,
            refRe: refRe,
            refIm: refIm,
            eRe: incRe + refRe,
            eIm: incIm + refIm,
            hRe: cfg.sign * (incRe - refRe),
            hIm: cfg.sign * (incIm - refIm),
        };
    }

    /** Analytic envelope of |E| (in units of E0). */
    function envelopeE(cfg, x) {
        const s = cfg.sAtX(x);
        const rho = cfg.r.mag;
        const v = 1 + rho * rho + 2 * rho * Math.cos(2 * cfg.k * s + cfg.r.phase);
        return Math.sqrt(Math.max(0, v));
    }

    /** Analytic envelope of eta |H| (in units of E0). Complementary to |E|. */
    function envelopeH(cfg, x) {
        const s = cfg.sAtX(x);
        const rho = cfg.r.mag;
        const v = 1 + rho * rho - 2 * rho * Math.cos(2 * cfg.k * s + cfg.r.phase);
        return Math.sqrt(Math.max(0, v));
    }

    /**
     * Transmitted field phasor a distance d beyond a dielectric interface at x = L:
     * E~ = t E0 exp(i k2 d), k2 = 2 pi n2 nu / c. Continuity of tangential E at d = 0 means t = 1 + r.
     */
    function transmittedPhasor(nu, n1, n2, d) {
        const t = transmissionFromIndices(n1, n2);
        const a = wavenumber(nu, n2) * d;
        return {
            re: t * Math.cos(a),
            im: t * Math.sin(a)
        };
    }

    /** Instantaneous physical field Re[(re + i im) exp(-i(omega t - phi))]. */
    function instantaneous(re, im, omegaT, phi) {
        const a = omegaT - phi;
        return re * Math.cos(a) + im * Math.sin(a);
    }

    /** Positions x in [0, L] where 2ks + theta = target + 2 pi m. */
    function solvePositions(cfg, target) {
        const out = [];
        if (cfg.r.mag <= 0) return out;
        const k = cfg.k;
        const theta = cfg.r.phase;
        const sMax = cfg.L;
        const tol = 1e-12 * Math.max(1, sMax);
        const mStart = Math.ceil((theta - target) / TWO_PI - 1e-9);
        for (let m = mStart;; m++) {
            const s = (target + TWO_PI * m - theta) / (2 * k);
            if (s > sMax + tol) break;
            if (s < -tol) continue;
            const sc = Math.min(Math.max(s, 0), sMax);
            out.push(cfg.mode === "resonator" ? sc : cfg.L - sc);
            if (out.length > 100000) break;
        }
        out.sort(function(a, b) {
            return a - b;
        });
        return out;
    }

    /** Minima of |E| (true nodes when |r| = 1). */
    function eMinima(cfg) {
        return solvePositions(cfg, Math.PI);
    }

    /** Maxima of |E| (antinodes). */
    function eMaxima(cfg) {
        return solvePositions(cfg, 0);
    }

    // ---------------------------------------------------------------- partial mirrors
    function checkR(R) {
        if (!(R >= 0 && R < 1)) throw new RangeError("power reflectance must satisfy 0 <= R < 1, got " + R);
    }

    /** Coefficient of finesse and finesse for lossless mirrors R1, R2 (0 <= R < 1). */
    function finesse(R1, R2) {
        checkR(R1);
        checkR(R2);
        const g = Math.sqrt(R1 * R2);
        if (g === 0) return 0;
        return Math.PI * Math.sqrt(g) / (1 - g);
    }

    /** Round-trip phase delta = 2kL + theta1 + theta2 (radians, unwrapped). */
    function roundTripPhase(nu, n, L, theta1, theta2) {
        return 2 * wavenumber(nu, n) * L + theta1 + theta2;
    }

    /**
     * Airy transmission of a lossless two-mirror cavity (plane wave, normal incidence),
     * computed from the geometric round-trip sum 1 / (1 - rho).
     * params: { n, L, R1, R2, theta1, theta2 }.
     */
    function airyTransmission(nu, params) {
        const R1 = params.R1,
            R2 = params.R2;
        checkR(R1);
        checkR(R2);
        const g = Math.sqrt(R1 * R2);
        const d = roundTripPhase(nu, params.n, params.L, params.theta1 || 0, params.theta2 || 0);
        const re = 1 - g * Math.cos(d),
            im = -g * Math.sin(d); // 1 - rho
        return (1 - R1) * (1 - R2) / (re * re + im * im);
    }

    /** Exact full width at half maximum of an Airy resonance, in hertz. */
    function airyFWHM(n, L, R1, R2) {
        checkR(R1);
        checkR(R2);
        const g = Math.sqrt(R1 * R2);
        if (g === 0) return Infinity;
        // half maximum where 4 g sin^2(delta/2) = (1 - g)^2
        const s = (1 - g) / (2 * Math.sqrt(g));
        if (s >= 1) return Infinity; // resonances too broad to have a half-maximum point
        const fullDelta = 4 * Math.asin(s); // delta_half = 2 asin(s) on either side of the peak
        return fullDelta / TWO_PI * freeSpectralRange(n, L);
    }

    /** Round-trip time, photon lifetime (from round-trip power survival R1 R2) and Q of mode frequency nu. */
    function cavityLifetime(nu, n, L, R1, R2) {
        const tRt = 2 * n * L / C;
        const survive = R1 * R2;
        const tau = survive > 0 ? tRt / -Math.log(survive) : 0;
        return {
            roundTripTime: tRt,
            tau: tau,
            Q: TWO_PI * nu * tau,
            linewidthFromTau: tau > 0 ? 1 / (TWO_PI * tau) : Infinity
        };
    }

    /**
     * Parameter-dependent profile sampled once and cached by the caller.
     * Returns typed arrays of phasors and envelopes, plus analytic extrema.
     */
    function profile(params, samples) {
        const cfg = describe(params);
        const N = Math.max(2, samples | 0);
        const x = new Float64Array(N);
        const incRe = new Float64Array(N),
            incIm = new Float64Array(N);
        const refRe = new Float64Array(N),
            refIm = new Float64Array(N);
        const eRe = new Float64Array(N),
            eIm = new Float64Array(N);
        const hRe = new Float64Array(N),
            hIm = new Float64Array(N);
        const envE = new Float64Array(N),
            envH = new Float64Array(N);
        for (let i = 0; i < N; i++) {
            const xi = cfg.L * i / (N - 1);
            const p = phasors(cfg, xi);
            x[i] = xi;
            incRe[i] = p.incRe;
            incIm[i] = p.incIm;
            refRe[i] = p.refRe;
            refIm[i] = p.refIm;
            eRe[i] = p.eRe;
            eIm[i] = p.eIm;
            hRe[i] = p.hRe;
            hIm[i] = p.hIm;
            envE[i] = envelopeE(cfg, xi);
            envH[i] = envelopeH(cfg, xi);
        }
        const rho = cfg.r.mag;
        return {
            cfg: cfg,
            x: x,
            incRe: incRe,
            incIm: incIm,
            refRe: refRe,
            refIm: refIm,
            eRe: eRe,
            eIm: eIm,
            hRe: hRe,
            hIm: hIm,
            envE: envE,
            envH: envH,
            minima: eMinima(cfg),
            maxima: eMaxima(cfg),
            eMin: 1 - rho,
            eMax: 1 + rho,
            swr: standingWaveRatio(rho),
            netPower: cfg.mode === "resonator" ? 0 : netPowerFraction(rho),
            wavelength: wavelengthInMedium(params.nu, params.n),
        };
    }

    return {
        C: C,
        ETA0: ETA0,
        complexPolar: complexPolar,
        wrapPhase: wrapPhase,
        reflectionFromIndices: reflectionFromIndices,
        transmissionFromIndices: transmissionFromIndices,
        REFLECTOR_PRESETS: REFLECTOR_PRESETS,
        wavenumber: wavenumber,
        wavelengthInMedium: wavelengthInMedium,
        standingWaveRatio: standingWaveRatio,
        netPowerFraction: netPowerFraction,
        resonatorFrequency: resonatorFrequency,
        resonatorModes: resonatorModes,
        resonatorModeFrequency: resonatorModeFrequency,
        freeSpectralRange: freeSpectralRange,
        describe: describe,
        phasors: phasors,
        envelopeE: envelopeE,
        envelopeH: envelopeH,
        instantaneous: instantaneous,
        transmittedPhasor: transmittedPhasor,
        eMinima: eMinima,
        eMaxima: eMaxima,
        profile: profile,
        finesse: finesse,
        roundTripPhase: roundTripPhase,
        airyTransmission: airyTransmission,
        airyFWHM: airyFWHM,
        cavityLifetime: cavityLifetime,
    };
});