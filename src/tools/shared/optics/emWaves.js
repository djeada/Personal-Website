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


    function intensity(n, E0) {
        return 0.5 * n * eps0 * c * E0 * E0;
    }



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


    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const norm = (a) => Math.hypot(a[0], a[1], a[2]);



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
            I0,
            u0: 0.5 * m1.eps * E0 * E0,
            swr: R < 1 ? (1 + Math.sqrt(R)) / (1 - Math.sqrt(R)) : Infinity
        };
    }


    function region(cfg, z) {
        if (cfg.boundary === "none" || z < 0) return 1;
        return cfg.boundary === "pec" ? 0 : 2;
    }


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


    function epsAt(cfg, z) {
        const reg = region(cfg, z);
        return reg === 1 ? cfg.m1.eps : reg === 2 ? cfg.m2.eps : 0;
    }


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


    function timeAverage(cfg, z) {
        const ph = phasors(cfg, z);
        const E2 = C.abs2(ph.E[0]) + C.abs2(ph.E[1]);
        const H2 = C.abs2(ph.H[0]) + C.abs2(ph.H[1]);
        const eps = epsAt(cfg, z);

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