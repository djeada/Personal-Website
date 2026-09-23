/*
 * Analytic electromagnetic plane waves and energy flow (pure, DOM-free).
 *
 * Browser: load core.js and fresnel.js first, then this file → window.OpticsModels.emWaves
 * Node:    const em = require(".../shared/optics/emWaves.js")
 *
 * Model
 * -----
 *  - Homogeneous, isotropic, lossless, NONMAGNETIC media (μ = μ0, ε = n² ε0, real n ≥ 1 is not
 *    required but n > 0 is). Wave impedance η = μ0 c / n = η0 / n, phase velocity c / n,
 *    medium wavelength λ0 / n.
 *  - Time convention (shared by all optics tools): E(r, t) = Re{ Ẽ exp[i(k·r − ωt)] }.
 *  - Propagation along ±z; fields are transverse (x, y components only).
 *  - Polarisation is a unit Jones vector J = [Jx, Jy] (complex). The complex amplitude of the
 *    incident wave is E0 · J, where E0 = |Ẽ| is the PEAK phasor amplitude in V/m (the shared
 *    optics convention). For linear polarisation E0 is the maximum of |E(t)|; for circular
 *    polarisation |E(t)| = E0/√2 at every instant. The RMS field magnitude is E0/√2 for every
 *    polarisation, so I = E_rms²/η = E0²/(2η).
 *  - Handedness follows polarization.js: S3 = 2 Im(Jx* Jy) > 0 is called right-handed
 *    (IEEE / positive helicity: the field rotates counter-clockwise when viewed facing the source).
 *  - For a wave travelling along direction k̂: H = (1/η) k̂ × E.  Poynting vector S = E × H.
 *    Energy densities u_E = ½ ε |E|², u_H = ½ μ0 |H|² (instantaneous, real fields).
 *    Time averages from phasors: ⟨u_E⟩ = ¼ ε |Ẽ|², ⟨u_H⟩ = ¼ μ0 |H̃|², ⟨S⟩ = ½ Re(Ẽ × H̃*).
 *    Travelling-wave intensity I = ⟨S_z⟩ = n ε0 c E0² / 2 = E0² / (2η).
 *
 * Boundary (optional), normal incidence at the plane z = 0
 * --------------------------------------------------------
 *  - "none":        one travelling wave in medium 1 everywhere.
 *  - "dielectric":  medium 1 for z < 0, medium 2 (index n2) for z ≥ 0. The electric reflection and
 *                   transmission coefficients come from fresnel.js (solve(n1, n2, 0).rs / .ts). At
 *                   normal incidence the s coefficient applies to BOTH lab components Ex and Ey
 *                   (fresnel.js's p basis flips ê_p for the reflected wave, so r_p = −r_s there
 *                   describes the same lab-frame field). r = (n1 − n2)/(n1 + n2), t = 1 + r.
 *  - "pec":         perfect electric conductor filling z ≥ 0: r = −1, t = 0, no fields in z ≥ 0.
 *  Medium 1 fields: Ẽ = E0 J (e^{ik1 z} + r e^{−ik1 z}),  H̃ = (E0/η1) ẑ×J (e^{ik1 z} − r e^{−ik1 z}).
 *  Medium 2 fields: Ẽ = E0 J t e^{ik2 z},                  H̃ = (E0/η2) ẑ×J t e^{ik2 z}.
 *
 * All inputs and outputs are SI (m, s, rad, V/m, A/m, W/m², J/m³).
 */
(function(root, factory) {
    const m = factory(root);
    if (typeof module === "object" && module.exports) module.exports = m;
    else {
        root.OpticsModels = root.OpticsModels || {};
        root.OpticsModels.emWaves = m;
    }
})(typeof self !== "undefined" ? self : this, function(root) {
    "use strict";

    const isNode = typeof require === "function" && typeof module === "object";
    const core = isNode ? require("./core.js") : root.OpticsModels.core;
    const fresnel = isNode ? require("./fresnel.js") : (root.OpticsModels && root.OpticsModels.fresnel) || null;

    const {
        c,
        eps0,
        mu0
    } = core.constants;
    const eta0 = mu0 * c;
    const C = core.complex;

    // ------------------------------------------------------------------ media
    /** Properties of a lossless nonmagnetic medium of index n. */
    function medium(n) {
        if (!(Number.isFinite(n) && n > 0)) throw new RangeError("refractive index must be a positive number");
        return {
            n,
            eps: n * n * eps0,
            mu: mu0,
            eta: eta0 / n,
            v: c / n
        };
    }

    /** Time-averaged intensity (W/m²) of a travelling plane wave with PEAK field E0 in index n. */
    function intensity(n, E0) {
        return 0.5 * n * eps0 * c * E0 * E0;
    }

    // ------------------------------------------------------------------ polarisation
    /**
     * Unit Jones vector. spec: { type: "linear", psi } | { type: "rcp" } | { type: "lcp" } |
     * { type: "elliptical", psi, delta } where psi is the amplitude angle (tan psi = |Jy|/|Jx|)
     * and delta the phase of Jy relative to Jx (rad). "rcp" has S3 > 0 (right-handed, IEEE).
     */
    function jones(spec = {}) {
        const s2 = Math.SQRT1_2;
        switch (spec.type) {
            case "rcp":
                return {
                    x: C.cx(s2, 0), y: C.cx(0, s2)
                };
            case "lcp":
                return {
                    x: C.cx(s2, 0), y: C.cx(0, -s2)
                };
            case "elliptical": {
                const psi = spec.psi || 0,
                    d = spec.delta || 0;
                return {
                    x: C.cx(Math.cos(psi), 0),
                    y: C.scale(C.expi(d), Math.sin(psi))
                };
            }
            default: {
                const psi = spec.psi || 0;
                return {
                    x: C.cx(Math.cos(psi), 0),
                    y: C.cx(Math.sin(psi), 0)
                };
            }
        }
    }

    /** Normalised Stokes parameters of a Jones vector: {S0, S1, S2, S3}. */
    function stokes(J) {
        const S0 = C.abs2(J.x) + C.abs2(J.y);
        const S1 = C.abs2(J.x) - C.abs2(J.y);
        const xy = C.mul(C.conj(J.x), J.y);
        return {
            S0,
            S1,
            S2: 2 * xy.re,
            S3: 2 * xy.im
        };
    }

    // ------------------------------------------------------------------ vector helpers
    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const norm = (a) => Math.hypot(a[0], a[1], a[2]);

    // ------------------------------------------------------------------ configuration
    /**
     * Build a wave configuration.
     * p: { lambda0 (m), n1, n2, E0 (peak V/m), pol: jones spec or {x,y} Jones vector,
     *      boundary: "none" | "dielectric" | "pec" }
     */
    function setup(p = {}) {
        const lambda0 = p.lambda0 ?? 633e-9;
        if (!(lambda0 > 0)) throw new RangeError("lambda0 must be positive");
        const m1 = medium(p.n1 ?? 1);
        const boundary = p.boundary || "none";
        const m2 = boundary === "dielectric" ? medium(p.n2 ?? 1.5) : null;
        const E0 = p.E0 ?? 1;
        let J = p.pol && p.pol.x && typeof p.pol.x === "object" ? p.pol : jones(p.pol || {});
        const nJ = Math.sqrt(C.abs2(J.x) + C.abs2(J.y)) || 1;
        J = {
            x: C.scale(J.x, 1 / nJ),
            y: C.scale(J.y, 1 / nJ)
        };

        const omega = 2 * Math.PI * c / lambda0;
        const k0 = 2 * Math.PI / lambda0;
        let r = C.cx(0, 0),
            t = C.cx(1, 0),
            source = "none";
        if (boundary === "pec") {
            r = C.cx(-1, 0);
            t = C.cx(0, 0);
            source = "PEC (r = −1)";
        } else if (boundary === "dielectric") {
            if (fresnel && typeof fresnel.solve === "function") {
                const sol = fresnel.solve(m1.n, m2.n, 0, lambda0);
                r = sol.rs;
                t = sol.ts;
                source = "fresnel.solve(n1, n2, 0).rs";
            } else {
                r = C.cx((m1.n - m2.n) / (m1.n + m2.n), 0);
                t = C.cx(2 * m1.n / (m1.n + m2.n), 0);
                source = "normal-incidence formula";
            }
        }
        const R = C.abs2(r);
        const T = m2 ? (m2.n / m1.n) * C.abs2(t) : 0;
        const I0 = intensity(m1.n, E0);
        return {
            lambda0,
            E0,
            J,
            boundary,
            m1,
            m2,
            omega,
            k0,
            period: lambda0 / c,
            k1: k0 * m1.n,
            k2: m2 ? k0 * m2.n : null,
            lambda1: lambda0 / m1.n,
            lambda2: m2 ? lambda0 / m2.n : null,
            r,
            t,
            R,
            T,
            coeffSource: source,
            I0, // incident time-averaged intensity (W/m²)
            u0: 0.5 * m1.eps * E0 * E0, // incident time-averaged total energy density ⟨u_E + u_H⟩ (J/m³)
            swr: R < 1 ? (1 + Math.sqrt(R)) / (1 - Math.sqrt(R)) : Infinity
        };
    }

    /** Which region a point is in: 1 (incident medium), 2 (second medium) or 0 (inside the PEC). */
    function region(cfg, z) {
        if (cfg.boundary === "none" || z < 0) return 1;
        return cfg.boundary === "pec" ? 0 : 2;
    }

    /**
     * Complex phasors at z (time dependence e^{−iωt} removed).
     * Returns { E: [Ex, Ey] complex, H: [Hx, Hy] complex, Ef, Eb (forward / backward E parts), region }.
     */
    function phasors(cfg, z) {
        const reg = region(cfg, z);
        const Z = C.cx(0, 0);
        if (reg === 0) return {
            E: [Z, Z],
            H: [Z, Z],
            Ef: [Z, Z],
            Eb: [Z, Z],
            region: 0
        };
        const {
            J,
            E0
        } = cfg;
        let f, b, eta;
        if (reg === 1) {
            f = C.scale(C.expi(cfg.k1 * z), E0);
            b = C.scale(C.mul(cfg.r, C.expi(-cfg.k1 * z)), E0);
            eta = cfg.m1.eta;
        } else {
            f = C.scale(C.mul(cfg.t, C.expi(cfg.k2 * z)), E0);
            b = C.cx(0, 0);
            eta = cfg.m2.eta;
        }
        const Ef = [C.mul(J.x, f), C.mul(J.y, f)];
        const Eb = [C.mul(J.x, b), C.mul(J.y, b)];
        const E = [C.add(Ef[0], Eb[0]), C.add(Ef[1], Eb[1])];
        // ẑ × (ax, ay) = (−ay, ax); forward H = ẑ×Ef/η, backward H = −ẑ×Eb/η
        const dx = C.sub(Ef[1], Eb[1]),
            dy = C.sub(Ef[0], Eb[0]);
        const H = [C.scale(dx, -1 / eta), C.scale(dy, 1 / eta)];
        return {
            E,
            H,
            Ef,
            Eb,
            region: reg
        };
    }

    /** Local permittivity at z (ε of the region; 0 inside the PEC). */
    function epsAt(cfg, z) {
        const reg = region(cfg, z);
        return reg === 1 ? cfg.m1.eps : reg === 2 ? cfg.m2.eps : 0;
    }

    /**
     * Instantaneous real fields at (z, t).
     * Returns { E: [x,y,z], H: [x,y,z], S: [x,y,z], Ef, Eb (real forward/backward E), uE, uH, u, region }.
     */
    function fields(cfg, z, t) {
        const ph = phasors(cfg, z);
        const e = C.expi(-cfg.omega * t);
        const re = (a) => C.mul(a, e).re;
        const E = [re(ph.E[0]), re(ph.E[1]), 0];
        const H = [re(ph.H[0]), re(ph.H[1]), 0];
        const S = cross(E, H);
        const eps = epsAt(cfg, z);
        const uE = 0.5 * eps * dot(E, E);
        const uH = ph.region === 0 ? 0 : 0.5 * mu0 * dot(H, H);
        return {
            E,
            H,
            S,
            uE,
            uH,
            u: uE + uH,
            region: ph.region,
            Ef: [re(ph.Ef[0]), re(ph.Ef[1]), 0],
            Eb: [re(ph.Eb[0]), re(ph.Eb[1]), 0]
        };
    }

    /** Time averages at z from phasors: { uE, uH, u, Sz, Eamp (|Ẽ| peak envelope), Hamp }. */
    function timeAverage(cfg, z) {
        const ph = phasors(cfg, z);
        const E2 = C.abs2(ph.E[0]) + C.abs2(ph.E[1]);
        const H2 = C.abs2(ph.H[0]) + C.abs2(ph.H[1]);
        const eps = epsAt(cfg, z);
        // ½ Re(Ẽ × H̃*)_z = ½ Re(Ex Hy* − Ey Hx*)
        const Sz = 0.5 * (C.mul(ph.E[0], C.conj(ph.H[1])).re - C.mul(ph.E[1], C.conj(ph.H[0])).re);
        const uE = 0.25 * eps * E2,
            uH = ph.region === 0 ? 0 : 0.25 * mu0 * H2;
        return {
            uE,
            uH,
            u: uE + uH,
            Sz,
            Eamp: Math.sqrt(E2),
            Hamp: Math.sqrt(H2)
        };
    }

    /**
     * Numerical time average of the instantaneous quantities over one period (midpoint rule with
     * N samples; exact for trigonometric polynomials of degree < N). Independent check on timeAverage.
     */
    function timeAverageNumeric(cfg, z, N = 64) {
        let uE = 0,
            uH = 0,
            Sz = 0;
        for (let i = 0; i < N; i++) {
            const f = fields(cfg, z, (i + 0.5) / N * cfg.period);
            uE += f.uE;
            uH += f.uH;
            Sz += f.S[2];
        }
        return {
            uE: uE / N,
            uH: uH / N,
            u: (uE + uH) / N,
            Sz: Sz / N
        };
    }

    /**
     * Poynting's theorem residual ∂u/∂t + ∂S_z/∂z at (z, t) by central differences with steps
     * dz (m) and dt (s). Returned normalised by ω·u0 (so O(1) terms of the balance are ≈ 1).
     * Points closer than dz to the interface are skipped by the caller (fields are only piecewise smooth).
     */
    function poyntingResidual(cfg, z, t, dz, dt) {
        dz = dz || cfg.lambda0 * 1e-5;
        dt = dt || cfg.period * 1e-5;
        const dudt = (fields(cfg, z, t + dt).u - fields(cfg, z, t - dt).u) / (2 * dt);
        const dSdz = (fields(cfg, z + dz, t).S[2] - fields(cfg, z - dz, t).S[2]) / (2 * dz);
        const scale = cfg.omega * cfg.u0 || 1;
        return {
            dudt,
            dSdz,
            residual: (dudt + dSdz) / scale,
            scale
        };
    }

    /**
     * Sample instantaneous and time-averaged quantities on a z grid at time t.
     * Returns arrays keyed by name (all SI).
     */
    function sampleZ(cfg, zs, t) {
        const n = zs.length;
        const out = {
            z: zs,
            Ex: new Float64Array(n),
            Ey: new Float64Array(n),
            Hx: new Float64Array(n),
            Hy: new Float64Array(n),
            Sz: new Float64Array(n),
            uE: new Float64Array(n),
            uH: new Float64Array(n),
            avgUE: new Float64Array(n),
            avgUH: new Float64Array(n),
            avgSz: new Float64Array(n),
            envE: new Float64Array(n),
            envH: new Float64Array(n)
        };
        for (let i = 0; i < n; i++) {
            const f = fields(cfg, zs[i], t),
                a = timeAverage(cfg, zs[i]);
            out.Ex[i] = f.E[0];
            out.Ey[i] = f.E[1];
            out.Hx[i] = f.H[0];
            out.Hy[i] = f.H[1];
            out.Sz[i] = f.S[2];
            out.uE[i] = f.uE;
            out.uH[i] = f.uH;
            out.avgUE[i] = a.uE;
            out.avgUH[i] = a.uH;
            out.avgSz[i] = a.Sz;
            out.envE[i] = a.Eamp;
            out.envH[i] = a.Hamp;
        }
        return out;
    }

    /** Sample the instantaneous fields at fixed z on a time grid. */
    function sampleT(cfg, z, ts) {
        const n = ts.length;
        const out = {
            t: ts,
            Ex: new Float64Array(n),
            Ey: new Float64Array(n),
            Hx: new Float64Array(n),
            Hy: new Float64Array(n),
            Sz: new Float64Array(n),
            uE: new Float64Array(n),
            uH: new Float64Array(n)
        };
        for (let i = 0; i < n; i++) {
            const f = fields(cfg, z, ts[i]);
            out.Ex[i] = f.E[0];
            out.Ey[i] = f.E[1];
            out.Hx[i] = f.H[0];
            out.Hy[i] = f.H[1];
            out.Sz[i] = f.S[2];
            out.uE[i] = f.uE;
            out.uH[i] = f.uH;
        }
        return out;
    }

    /**
     * Positions (z ≤ 0, in medium 1) of the time-averaged electric-energy minima (nodes of the E
     * envelope when |r| = 1) within [zmin, 0]. Envelope |e^{ikz} + r e^{−ikz}| is smallest where
     * 2k1 z − arg r = π (mod 2π).
     */
    function eNodes(cfg, zmin) {
        if (cfg.boundary === "none" || cfg.R === 0) return [];
        const phi = C.arg(cfg.r),
            out = [];
        for (let m = 0; m < 1000; m++) {
            const z = (phi + Math.PI - 2 * Math.PI * m) / (2 * cfg.k1);
            if (z > 1e-15 * cfg.lambda0) continue;
            if (z < zmin) break;
            out.push(z);
        }
        return out;
    }

    return {
        constants: {
            c,
            eps0,
            mu0,
            eta0
        },
        medium,
        intensity,
        jones,
        stokes,
        vec: {
            cross,
            dot,
            norm
        },
        setup,
        region,
        phasors,
        fields,
        timeAverage,
        timeAverageNumeric,
        poyntingResidual,
        sampleZ,
        sampleT,
        eNodes
    };
});