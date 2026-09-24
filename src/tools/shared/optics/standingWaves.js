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


    function reflectionFromIndices(n1, n2) {
        const r = (n1 - n2) / (n1 + n2);
        return complexPolar(Math.abs(r), r < 0 ? Math.PI : 0);
    }


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


    function netPowerFraction(rMag) {
        return 1 - rMag * rMag;
    }


    function resonatorFrequency(q, n, L, theta1, theta2) {
        const offset = ((theta1 + theta2) / TWO_PI);
        return (q - offset) * C / (2 * n * L);
    }

    function freeSpectralRange(n, L) {
        return C / (2 * n * L);
    }


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


    function describe(params) {
        const n = params.n;
        const L = params.L;
        const nu = params.nu;
        const k = wavenumber(nu, n);
        let r, sign, sAtX;
        if (params.mode === "resonator") {
            r = params.r1;
            sign = -1;
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


    function phasors(cfg, x) {
        const s = cfg.sAtX(x);
        const ks = cfg.k * s;
        const incRe = Math.cos(ks),
            incIm = -Math.sin(ks);
        const a = ks + cfg.r.phase;
        const refRe = cfg.r.mag * Math.cos(a),
            refIm = cfg.r.mag * Math.sin(a);
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


    function envelopeE(cfg, x) {
        const s = cfg.sAtX(x);
        const rho = cfg.r.mag;
        const v = 1 + rho * rho + 2 * rho * Math.cos(2 * cfg.k * s + cfg.r.phase);
        return Math.sqrt(Math.max(0, v));
    }


    function envelopeH(cfg, x) {
        const s = cfg.sAtX(x);
        const rho = cfg.r.mag;
        const v = 1 + rho * rho - 2 * rho * Math.cos(2 * cfg.k * s + cfg.r.phase);
        return Math.sqrt(Math.max(0, v));
    }


    function transmittedPhasor(nu, n1, n2, d) {
        const t = transmissionFromIndices(n1, n2);
        const a = wavenumber(nu, n2) * d;
        return {
            re: t * Math.cos(a),
            im: t * Math.sin(a)
        };
    }


    function instantaneous(re, im, omegaT, phi) {
        const a = omegaT - phi;
        return re * Math.cos(a) + im * Math.sin(a);
    }


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


    function eMinima(cfg) {
        return solvePositions(cfg, Math.PI);
    }


    function eMaxima(cfg) {
        return solvePositions(cfg, 0);
    }


    function checkR(R) {
        if (!(R >= 0 && R < 1)) throw new RangeError("power reflectance must satisfy 0 <= R < 1, got " + R);
    }


    function finesse(R1, R2) {
        checkR(R1);
        checkR(R2);
        const g = Math.sqrt(R1 * R2);
        if (g === 0) return 0;
        return Math.PI * Math.sqrt(g) / (1 - g);
    }


    function roundTripPhase(nu, n, L, theta1, theta2) {
        return 2 * wavenumber(nu, n) * L + theta1 + theta2;
    }


    function airyTransmission(nu, params) {
        const R1 = params.R1,
            R2 = params.R2;
        checkR(R1);
        checkR(R2);
        const g = Math.sqrt(R1 * R2);
        const d = roundTripPhase(nu, params.n, params.L, params.theta1 || 0, params.theta2 || 0);
        const re = 1 - g * Math.cos(d),
            im = -g * Math.sin(d);
        return (1 - R1) * (1 - R2) / (re * re + im * im);
    }


    function airyFWHM(n, L, R1, R2) {
        checkR(R1);
        checkR(R2);
        const g = Math.sqrt(R1 * R2);
        if (g === 0) return Infinity;

        const s = (1 - g) / (2 * Math.sqrt(g));
        if (s >= 1) return Infinity;
        const fullDelta = 4 * Math.asin(s);
        return fullDelta / TWO_PI * freeSpectralRange(n, L);
    }


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