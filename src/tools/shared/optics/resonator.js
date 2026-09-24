(function(root, factory) {
    const core = (typeof require === "function" && typeof module === "object") ? require("./core.js") : root.OpticsModels.core;
    const m = factory(core);
    if (typeof module === "object" && module.exports) module.exports = m;
    else {
        root.OpticsModels = root.OpticsModels || {};
        root.OpticsModels.resonator = m;
    }
})(typeof self !== "undefined" ? self : this, function(core) {
    "use strict";

    const c0 = core.constants.c;
    const C = core.complex;
    const mat2 = core.mat2;
    const TWO_PI = 2 * Math.PI;
    const MARGINAL_TOL = 1e-9;


    const propagation = (d) => [
        [1, d],
        [0, 1]
    ];

    const mirror = (Rc) => [
        [1, 0],
        [Number.isFinite(Rc) ? -2 / Rc : 0, 1]
    ];

    function gParam(L, Rc) {
        return Number.isFinite(Rc) ? 1 - L / Rc : 1;
    }

    function radiusFromG(L, g) {
        return Math.abs(1 - g) < 1e-12 ? Infinity : L / (1 - g);
    }


    function roundTripMatrix(L, Rc1, Rc2) {
        return mat2.chain([mirror(Rc1), propagation(L), mirror(Rc2), propagation(L)]);
    }


    function stability(M, tol = MARGINAL_TOL) {
        const m = (M[0][0] + M[1][1]) / 2;
        const status = Math.abs(Math.abs(m) - 1) <= tol ? "marginal" : Math.abs(m) < 1 ? "stable" : "unstable";
        return {
            m,
            status,
            stable: status === "stable"
        };
    }


    function classifyBoundary(g1, g2, tol = 1e-6) {
        const p = g1 * g2;
        const near = (a, b) => Math.abs(a - b) <= tol;
        if (near(g1, 1) && near(g2, 1)) return {
            key: "planar",
            label: "planar–planar (g1 = g2 = 1)",
            note: "ψ = 0: every TEMmn is degenerate with TEM00; no finite Gaussian mode (w → ∞)."
        };
        if (near(g1, -1) && near(g2, -1)) return {
            key: "concentric",
            label: "concentric (g1 = g2 = −1)",
            note: "ψ = π: transverse shift is a full FSR, so all modes are degenerate again; the waist shrinks to a point and w at the mirrors diverges."
        };
        if (near(g1, 0) && near(g2, 0)) return {
            key: "confocal",
            label: "symmetric confocal (g1 = g2 = 0)",
            note: "ψ = π/2: TEMmn with m+n even coincide with TEM00, odd ones sit half-way (FSR effectively halves). M = −I, so the ray matrix alone does not fix q; the mode matching the mirror curvature is w0² = λL/(2πn)."
        };
        if (near(p, 0)) return {
            key: "g1g2zero",
            label: "g1·g2 = 0 boundary",
            note: "One mirror's centre of curvature lies on the other mirror (ψ = π/2). The spot size on that other mirror goes to 0 and on the first diverges."
        };
        if (near(p, 1)) return {
            key: "g1g2one",
            label: "g1·g2 = 1 boundary",
            note: "Hyperbola through planar and concentric: ψ = 0 or π, transverse modes degenerate with longitudinal ones and the beam is unbounded."
        };
        return {
            key: null,
            label: "",
            note: ""
        };
    }


    function eigenQ(M) {
        const [
            [A, B],
            [Cc, D]
        ] = M;
        const m = (A + D) / 2;
        if (!(Math.abs(m) < 1) || B === 0) return null;
        const invq = C.cx((D - A) / (2 * B), -Math.sqrt(1 - m * m) / Math.abs(B));
        return {
            invq,
            q: C.inv(invq)
        };
    }


    function applyABCD(M, q) {
        return C.div(C.add(C.scale(q, M[0][0]), C.cx(M[0][1])), C.add(C.scale(q, M[1][0]), C.cx(M[1][1])));
    }


    function gouyFromG(g1, g2) {
        const p = g1 * g2;
        if (p < -1e-12 || p > 1 + 1e-12) return NaN;
        const s = g1 < 0 || (g1 === 0 && g2 < 0) ? -1 : 1;
        return Math.acos(Math.max(-1, Math.min(1, s * Math.sqrt(Math.max(0, p)))));
    }


    function gaussianMode(L, Rc1, Rc2, lambda0, n = 1) {
        const g1 = gParam(L, Rc1),
            g2 = gParam(L, Rc2);
        const M = roundTripMatrix(L, Rc1, Rc2);
        const st = stability(M);
        const boundary = classifyBoundary(g1, g2);
        const lam = lambda0 / n;
        const out = {
            status: st.status,
            m: st.m,
            g1,
            g2,
            M,
            gouy: gouyFromG(g1, g2),
            boundary,
            degenerate: false,
            w0: NaN,
            zWaist: NaN,
            zR: NaN,
            w1: NaN,
            w2: NaN,
            q1: null
        };
        let q = null;
        if (st.status === "stable") {
            q = eigenQ(M).q;
        } else if (boundary.key === "confocal") {

            q = C.cx(-L / 2, L / 2);
            out.degenerate = true;
        }
        if (!q) return out;
        out.q1 = q;
        out.zR = q.im;
        out.zWaist = -q.re;
        out.w0 = Math.sqrt(out.zR * lam / Math.PI);
        out.w1 = beamRadius(out, 0, lam);
        out.w2 = beamRadius(out, L, lam);

        out.gouyPropagated = Math.atan((L - out.zWaist) / out.zR) - Math.atan((0 - out.zWaist) / out.zR);
        out.lambdaMedium = lam;
        return out;
    }


    function beamRadius(mode, z, lamMedium) {
        const lam = lamMedium || mode.lambdaMedium;
        const w0 = Math.sqrt(mode.zR * lam / Math.PI);
        const u = (z - mode.zWaist) / mode.zR;
        return w0 * Math.sqrt(1 + u * u);
    }



    function cavity(params) {
        const p = Object.assign({
            R1: 0.9,
            R2: 0.9,
            loss: 0,
            L: 0.01,
            n: 1,
            ng: null,
            lambda0: 633e-9,
            Rc1: Infinity,
            Rc2: Infinity
        }, params || {});
        if (!(p.L > 0)) throw new RangeError("cavity: L must be > 0");
        if (!(p.n > 0)) throw new RangeError("cavity: n must be > 0");
        const ng = p.ng == null || !(p.ng > 0) ? p.n : p.ng;
        const R1 = Math.min(1, Math.max(0, p.R1)),
            R2 = Math.min(1, Math.max(0, p.R2));
        const A = Math.min(1, Math.max(0, 1 - p.loss));
        const rho = Math.sqrt(R1 * R2) * A;
        const S = rho * rho;
        const Trt = 2 * ng * p.L / c0;
        const fsr = c0 / (2 * ng * p.L);
        const nu0 = c0 / p.lambda0;
        const mode = gaussianMode(p.L, p.Rc1, p.Rc2, p.lambda0, p.n);

        const psi = (mode.status === "stable" || mode.degenerate) ? mode.gouy : 0;

        const qFloat = (2 * p.L * (p.n * nu0) / c0) - psi / Math.PI;
        const q0 = Math.round(qFloat);
        const cav = {
            params: p,
            L: p.L,
            n: p.n,
            ng,
            R1,
            R2,
            A,
            rho,
            S,
            Trt,
            fsr,
            nu0,
            lambda0: p.lambda0,
            mode,
            psi,
            q0,
            alpha: A > 0 ? -Math.log(A) / p.L : Infinity
        };
        cav.nuRes = resonanceFrequency(cav, q0, 0);

        cav.coefF = rho > 0 ? 4 * rho / ((1 - rho) * (1 - rho)) : 0;
        const s = (1 - rho) / (2 * Math.sqrt(rho));
        cav.fwhmPhase = rho > 0 && s <= 1 ? 4 * Math.asin(s) : NaN;
        cav.finesse = Number.isFinite(cav.fwhmPhase) ? TWO_PI / cav.fwhmPhase : NaN;
        cav.finesseApprox = rho > 0 && rho < 1 ? Math.PI * Math.sqrt(rho) / (1 - rho) : (rho >= 1 ? Infinity : NaN);
        cav.fwhm = cav.fsr / cav.finesse;
        cav.tauP = S > 0 && S < 1 ? -Trt / Math.log(S) : (S >= 1 ? Infinity : 0);
        cav.Q = cav.nuRes / cav.fwhm;
        const tt = (1 - R1) * (1 - R2) * A;
        cav.Tmax = tt / ((1 - rho) * (1 - rho));
        cav.Tmin = tt / ((1 + rho) * (1 + rho));
        cav.buildup = (1 - R1) / ((1 - rho) * (1 - rho));
        const onRes = response(cav, cav.nuRes);
        cav.Rmin = onRes.R;
        cav.lossOnRes = onRes.loss;
        return cav;
    }


    function resonanceFrequency(cav, q, N = 0) {
        const psi = cav.psi != null ? cav.psi : 0;
        return cav.nu0 + ((q + (N + 1) * psi / Math.PI) * c0 / (2 * cav.L) - cav.n * cav.nu0) / cav.ng;
    }


    function roundTripPhase(cav, nu, N = 0) {
        const d = TWO_PI * (nu - cav.nuRes) / cav.fsr - 2 * N * cav.psi;
        return d;
    }


    function response(cav, nu, N = 0) {
        const delta = roundTripPhase(cav, nu, N);
        const g = C.fromPolar(cav.rho, delta);
        const denom = C.sub(C.ONE, g);
        const t1 = Math.sqrt(1 - cav.R1),
            t2 = Math.sqrt(1 - cav.R2),
            a = Math.sqrt(cav.A);

        const t = C.div(C.fromPolar(t1 * t2 * a, delta / 2), denom);

        const fb = C.div(C.fromPolar(-(1 - cav.R1) * Math.sqrt(cav.R2) * cav.A, delta), denom);
        const r = C.add(C.cx(Math.sqrt(cav.R1)), fb);
        const T = C.abs2(t),
            R = C.abs2(r);
        const circ = (1 - cav.R1) / C.abs2(denom);
        return {
            t,
            r,
            T,
            R,
            loss: Math.max(0, 1 - R - T),
            g,
            delta,
            circ
        };
    }


    function spectrum(cav, nus, N = 0) {
        const n = nus.length;
        const T = new Float64Array(n),
            R = new Float64Array(n),
            Ls = new Float64Array(n);
        for (let i = 0; i < n; i++) {
            const o = response(cav, nus[i], N);
            T[i] = o.T;
            R[i] = o.R;
            Ls[i] = o.loss;
        }
        return {
            T,
            R,
            loss: Ls
        };
    }


    function adaptiveGrid(cav, lo, hi, nBase = 1200, nPeak = 240) {
        const pts = [];
        for (let i = 0; i < nBase; i++) pts.push(lo + (hi - lo) * i / (nBase - 1));
        const w = Number.isFinite(cav.fwhm) ? cav.fwhm : cav.fsr;
        const qa = Math.floor((lo - cav.nuRes) / cav.fsr) - 1,
            qb = Math.ceil((hi - cav.nuRes) / cav.fsr) + 1;
        for (let k = qa; k <= qb; k++) {
            const c = cav.nuRes + k * cav.fsr;
            for (let j = 0; j < nPeak; j++) {
                const x = c + 6 * w * (2 * j / (nPeak - 1) - 1);
                if (x >= lo && x <= hi) pts.push(x);
            }
            if (c >= lo && c <= hi) pts.push(c);
        }
        pts.sort((a, b) => a - b);
        const out = [];
        for (const x of pts)
            if (!out.length || x - out[out.length - 1] > (hi - lo) * 1e-12) out.push(x);
        return Float64Array.from(out);
    }


    function intracavityField(cav, nu, zs, N = 0) {
        const L = cav.L;
        const delta = roundTripPhase(cav, nu, N) + TWO_PI * cav.q0;
        const md = cav.mode;
        const useGouy = cav.psi !== 0 && Number.isFinite(md.zR);
        const gouyAt = (z) => useGouy ? (N + 1) * (Math.atan((z - md.zWaist) / md.zR) - Math.atan(-md.zWaist / md.zR)) : 0;

        const k = (delta + 2 * (N + 1) * cav.psi) / (2 * L);
        const g = C.fromPolar(cav.rho, delta);
        const aPlus = C.div(C.cx(Math.sqrt(1 - cav.R1)), C.sub(C.ONE, g));
        const alpha = cav.A > 0 ? -Math.log(cav.A) / L : 0;
        const phiL = k * L - gouyAt(L);
        const EL = C.mul(aPlus, C.fromPolar(Math.exp(-alpha * L / 2), phiL));
        const bAtL = C.scale(EL, -Math.sqrt(cav.R2));
        const n = zs.length;
        const re = new Float64Array(n),
            im = new Float64Array(n),
            abs2 = new Float64Array(n);
        const fwd2 = new Float64Array(n),
            bwd2 = new Float64Array(n),
            envMax = new Float64Array(n),
            envMin = new Float64Array(n);
        for (let i = 0; i < n; i++) {
            const z = zs[i];
            const ef = C.mul(aPlus, C.fromPolar(Math.exp(-alpha * z / 2), k * z - gouyAt(z)));
            const d = L - z;

            const eb = C.mul(bAtL, C.fromPolar(Math.exp(-alpha * d / 2), k * d - (gouyAt(L) - gouyAt(z))));
            const e = C.add(ef, eb);
            re[i] = e.re;
            im[i] = e.im;
            abs2[i] = C.abs2(e);
            const af = C.abs(ef),
                ab = C.abs(eb);
            fwd2[i] = af * af;
            bwd2[i] = ab * ab;
            envMax[i] = (af + ab) * (af + ab);
            envMin[i] = (af - ab) * (af - ab);
        }
        return {
            re,
            im,
            abs2,
            fwd2,
            bwd2,
            envMax,
            envMin,
            k,
            aPlus,
            bAtL
        };
    }


    function timeResponse(cav, nu, nOn, nOff, N = 0) {
        const delta = roundTripPhase(cav, nu, N);
        const g = C.fromPolar(cav.rho, delta);
        const ss = response(cav, nu, N);
        const total = nOn + nOff;
        const m = new Float64Array(total),
            t = new Float64Array(total),
            Pt = new Float64Array(total),
            Pc = new Float64Array(total);
        const gpow = (k) => C.fromPolar(Math.pow(cav.rho, k), delta * k);
        const a1 = C.div(C.cx(Math.sqrt(1 - cav.R1)), C.sub(C.ONE, g));
        let lastT = C.ZERO,
            lastC = C.ZERO;
        for (let i = 0; i < total; i++) {
            let Et, Ec;
            if (i < nOn) {
                const f = C.sub(C.ONE, gpow(i + 1));
                Et = C.mul(ss.t, f);
                Ec = C.mul(a1, f);
                lastT = Et;
                lastC = Ec;
            } else {
                const gj = gpow(i - nOn + 1);
                Et = C.mul(lastT, gj);
                Ec = C.mul(lastC, gj);
            }
            m[i] = i;
            t[i] = cav.Trt * (i + 0.5);
            Pt[i] = C.abs2(Et);
            Pc[i] = C.abs2(Ec);
        }
        return {
            m,
            t,
            Pt,
            Pc,
            steadyT: ss.T,
            steadyCirc: ss.circ
        };
    }


    function modeComb(cav, lo, hi, maxOrder) {
        const out = [];
        for (let N = 0; N <= maxOrder; N++) {
            const shift = resonanceFrequency(cav, cav.q0, N) - cav.nuRes;
            const qa = Math.floor((lo - cav.nuRes - shift) / cav.fsr) - 1;
            const qb = Math.ceil((hi - cav.nuRes - shift) / cav.fsr) + 1;
            for (let k = qa; k <= qb; k++) {
                const nu = cav.nuRes + shift + k * cav.fsr;
                if (nu >= lo && nu <= hi) out.push({
                    q: cav.q0 + k,
                    N,
                    nu,
                    degeneracy: N + 1
                });
            }
        }
        return out;
    }

    return {
        propagation,
        mirror,
        gParam,
        radiusFromG,
        roundTripMatrix,
        stability,
        classifyBoundary,
        eigenQ,
        applyABCD,
        gouyFromG,
        gaussianMode,
        beamRadius,
        cavity,
        resonanceFrequency,
        roundTripPhase,
        response,
        spectrum,
        adaptiveGrid,
        intracavityField,
        timeResponse,
        modeComb
    };
});