/*
 * Dielectric waveguide model (pure, DOM-free): symmetric slab (exact TE/TM), weakly guiding
 * step-index fibre (scalar LP approximation), ray/TIR link, group index, modal dispersion and
 * evanescent coupling between two identical guides.
 *
 * Browser: <script src="../shared/optics/core.js"></script> then this file → window.OpticsModels.waveguides
 * Node:    const wg = require(".../shared/optics/waveguides.js")
 *
 * Conventions (SI internally; λ0 is the vacuum wavelength)
 * --------------------------------------------------------
 *  Fields ∝ ψ(x) exp[i(βz − ωt)], k0 = 2π/λ0, NA = √(n1² − n2²), n1 core, n2 cladding.
 *  Slab: core |x| < a, full thickness d = 2a, V = k0 a NA (HALF-thickness convention).
 *        u = a kx = a √(n1²k0² − β²), w = a γ = a √(β² − n2²k0²), u² + w² = V².
 *        TE (Ey): even  w = u tan u,         odd  w = −u cot u
 *        TM (Hy): even  w = (n2/n1)² u tan u, odd  w = −(n2/n1)² u cot u
 *        TE_m / TM_m cut off at V = mπ/2 → per polarization N = floor(2V/π) + 1 (TE0/TM0 never cut off).
 *        Roots are found with core.brent on the analytic brackets u ∈ [mπ/2, min((m+1)π/2, V)] using
 *        the pole-free forms  even: r u sin u − w cos u,  odd: r u cos u + w sin u  (r = 1 TE, (n2/n1)² TM).
 *  Fibre (weakly guiding, Δ ≪ 1): core radius a, V = k0 a NA. LP_lm scalar modes
 *        ψ = J_l(u r/a)/J_l(u) (r < a), K_l(w r/a)/K_l(w) (r > a), times cos(lφ);
 *        u J_{l−1}(u)/J_l(u) = −w K_{l−1}(w)/K_l(w). Solved in the pole-free form
 *        H(u) = u J_{l−1}(u) + [w K_{l−1}(w)/K_l(w)] J_l(u) on u ∈ (cutoff, j_{l,m}) with brent.
 *        LP_lm cut-off V = j_{l−1,m} (l ≥ 1) or j_{1,m−1} (l = 0, j_{1,0} ≡ 0): LP11 at 2.405 = j_{0,1}.
 *        THE 2.405 SINGLE-MODE LIMIT APPLIES ONLY TO THIS IDEAL STEP-INDEX FIBRE; the symmetric slab's
 *        second mode appears at V = π/2 (half-thickness V).
 *  b = (neff² − n2²)/(n1² − n2²) = w²/V² ∈ (0, 1). Ray picture: β = n1 k0 cos θ, θ measured from the axis.
 *  Group index ng = neff − λ0 dneff/dλ0 (numerical central difference; non-dispersive n1, n2, so this is
 *  pure waveguide dispersion). Dw = −(λ0/c) d²neff/dλ0².
 */
(function(root, factory) {
    const core = (typeof require === "function" && typeof module === "object") ? require("./core.js") : root.OpticsModels.core;
    const m = factory(core);
    if (typeof module === "object" && module.exports) module.exports = m;
    else {
        root.OpticsModels = root.OpticsModels || {};
        root.OpticsModels.waveguides = m;
    }
})(typeof self !== "undefined" ? self : this, function(core) {
    "use strict";

    const PI = Math.PI;
    const C0 = core.constants.c;
    const TOL = 1e-14;

    const numericalAperture = (n1, n2) => (n1 > n2 ? Math.sqrt(n1 * n1 - n2 * n2) : 0);

    /** Common parameters. d = slab thickness or fibre core DIAMETER (m); V uses the half-width / radius a = d/2. */
    function params({
        n1,
        n2,
        d,
        lambda0
    }) {
        const k0 = 2 * PI / lambda0,
            a = d / 2,
            NA = numericalAperture(n1, n2);
        return {
            n1,
            n2,
            d,
            a,
            lambda0,
            k0,
            NA,
            V: k0 * a * NA,
            delta: (n1 * n1 - n2 * n2) / (2 * n1 * n1)
        };
    }

    // ================================================================ symmetric slab (exact)
    /** Pole-free slab characteristic function for mode order m (parity m % 2) and ratio r (1 TE, (n2/n1)² TM). */
    function slabChar(m, V, r) {
        return m % 2 === 0 ?
            (u) => r * u * Math.sin(u) - Math.sqrt(Math.max(0, V * V - u * u)) * Math.cos(u) :
            (u) => r * u * Math.cos(u) + Math.sqrt(Math.max(0, V * V - u * u)) * Math.sin(u);
    }

    /** Universal slab solution u(V) for order m; NaN when the mode is cut off (V ≤ mπ/2). */
    function slabU(V, m, r = 1) {
        const lo = m * PI / 2;
        if (!(V > lo)) return NaN;
        const hi = Math.min((m + 1) * PI / 2, V);
        const f = slabChar(m, V, r);
        const flo = f(lo),
            fhi = f(hi);
        if (flo * fhi > 0) return NaN;
        const u = core.brent(f, lo, hi, {
            tol: TOL
        });
        return u < V ? u : NaN;
    }

    const slabModeCountEstimate = (V) => Math.floor(2 * V / PI) + 1;

    function makeSlabMode(p, pol, m, u) {
        const {
            n1,
            n2,
            a,
            k0,
            V
        } = p;
        const w = Math.sqrt(Math.max(0, V * V - u * u));
        const kx = u / a,
            gamma = w / a;
        const b = (w * w) / (V * V);
        const neff = Math.sqrt(n2 * n2 + b * (n1 * n1 - n2 * n2));
        const even = m % 2 === 0;
        // |ψ|² integrals with ψ(core) = cos/sin(kx x), ψ(clad) = cos u · e^{−γ(|x|−a)} (even) / ±sin u · … (odd)
        const s2u = Math.sin(2 * u) / (2 * u);
        const Icore = a * (even ? 1 + s2u : 1 - s2u);
        const edge = even ? Math.cos(u) : Math.sin(u);
        const Iclad = a * edge * edge / w; // both sides together
        const tm = pol === "TM";
        const wc = tm ? 1 / (n1 * n1) : 1,
            wl = tm ? 1 / (n2 * n2) : 1; // Sz ∝ |Hy|²/n² for TM
        const confinement = (wc * Icore) / (wc * Icore + wl * Iclad);
        const norm = 1 / Math.sqrt(wc * Icore + wl * Iclad); // ∫|Ey|² dx = 1 (TE) or ∫|Hy|²/n² dx = 1 (TM)
        const cosT = neff / n1,
            theta = Math.acos(Math.min(1, cosT));
        const r = tm ? (n2 * n2) / (n1 * n1) : 1;
        const phiR = -2 * Math.atan2(w, r * u); // TIR reflection phase of the plane-wave component
        return {
            kind: "slab",
            pol,
            m,
            label: pol + m,
            parity: even ? "even" : "odd",
            u,
            w,
            V,
            b,
            neff,
            beta: neff * k0,
            kx,
            gamma,
            n1,
            n2,
            a,
            d: 2 * a,
            k0,
            lambda0: p.lambda0,
            confinement,
            norm,
            edge,
            theta, // ray angle to the axis
            incidence: PI / 2 - theta, // angle of incidence on the core/cladding wall
            decayLength: 1 / gamma, // 1/e field depth into cladding
            reflectionPhase: phiR,
            // transverse resonance: 2 kx d + 2 φr = 2π m  →  residual (should be ≈ 0)
            resonanceResidual: 2 * kx * 2 * a + 2 * phiR - 2 * PI * m,
            cutoffV: m * PI / 2,
            degeneracy: 1
        };
    }

    /** All guided slab modes of one polarization ("TE" | "TM"), ordered by m (decreasing neff). */
    function solveSlab(input, pol = "TE") {
        const p = params(input);
        if (!(p.n1 > p.n2) || !(p.d > 0) || !(p.lambda0 > 0)) return {
            ...p,
            pol,
            modes: []
        };
        const r = pol === "TM" ? (p.n2 * p.n2) / (p.n1 * p.n1) : 1;
        const modes = [];
        for (let m = 0; m * PI / 2 < p.V; m++) {
            const u = slabU(p.V, m, r);
            if (Number.isFinite(u)) modes.push(makeSlabMode(p, pol, m, u));
        }
        return {
            ...p,
            pol,
            modes
        };
    }

    /**
     * Slab transverse field at x (m): TE → Ey, TM → Hy, scaled by mode.norm (power-normalised) unless
     * opts.peak (then max |ψ| on the core-side profile is cos/sin normalised so ψ(0)=1 for even modes).
     */
    function slabField(mode, x, peak = false) {
        const {
            kx,
            gamma,
            a,
            u
        } = mode;
        const even = mode.parity === "even";
        const ax = Math.abs(x);
        let v;
        if (ax <= a) v = even ? Math.cos(kx * x) : Math.sin(kx * x);
        else v = (even ? Math.cos(u) : Math.sign(x) * Math.sin(u)) * Math.exp(-gamma * (ax - a));
        return peak ? v : v * mode.norm;
    }

    /** Analytic transverse derivative dψ/dx (for boundary checks and TM Ez). */
    function slabFieldDerivative(mode, x) {
        const {
            kx,
            gamma,
            a,
            u
        } = mode;
        const even = mode.parity === "even";
        const ax = Math.abs(x);
        let v;
        if (ax <= a) v = even ? -kx * Math.sin(kx * x) : kx * Math.cos(kx * x);
        else v = -gamma * Math.sign(x) * (even ? Math.cos(u) : Math.sign(x) * Math.sin(u)) * Math.exp(-gamma * (ax - a));
        return v * mode.norm;
    }

    /** Index profile n(x) of the slab. */
    const slabIndex = (mode, x) => (Math.abs(x) <= mode.a ? mode.n1 : mode.n2);

    // ================================================================ weakly guiding fibre (LP)
    const zeroCache = new Map();
    /** Positive zeros of J_n up to xmax (cached, extended on demand). */
    function besselZeros(n, xmax) {
        let entry = zeroCache.get(n);
        if (!entry) {
            entry = {
                upTo: n === 0 ? 1e-9 : Math.max(1e-9, n * 0.999),
                zeros: []
            };
            zeroCache.set(n, entry);
        }
        if (entry.upTo < xmax) {
            const step = 0.2;
            let lo = entry.upTo,
                flo = core.besselJ(n, lo);
            const end = xmax + 1;
            while (lo < end) {
                const hi = lo + step,
                    fhi = core.besselJ(n, hi);
                if (flo !== 0 && flo * fhi <= 0) entry.zeros.push(fhi === 0 ? hi : core.brent((x) => core.besselJ(n, x), lo, hi, {
                    tol: 1e-15
                }));
                lo = hi;
                flo = fhi;
            }
            entry.upTo = lo;
        }
        return entry.zeros.filter((z) => z <= xmax);
    }

    /** k-th zero (1-based) of J_n; j_{n,0} ≡ 0. */
    function besselZero(n, k) {
        if (k === 0) return 0;
        let xmax = Math.max(10, n + 4 * k + 10);
        let zs = besselZeros(n, xmax);
        while (zs.length < k) {
            xmax *= 1.6;
            zs = besselZeros(n, xmax);
        }
        return zs[k - 1];
    }

    /** LP_lm cut-off V: j_{l−1,m} for l ≥ 1, j_{1,m−1} for l = 0 (LP01 has none). */
    function lpCutoff(l, m) {
        return l === 0 ? besselZero(1, m - 1) : besselZero(l - 1, m);
    }

    const Jm = (l, x) => (l === -1 ? -core.besselJ(1, x) : core.besselJ(l, x));

    /** R_l(w) = w K_{l−1}(w) / K_l(w) with K_{−1} = K_1; R_l(0) = 0 (all l). */
    function kRatio(l, w) {
        if (!(w > 0)) return 0;
        const lm1 = Math.abs(l - 1);
        const num = core.besselK(lm1, w, true),
            den = core.besselK(l, w, true);
        const r = w * num / den;
        if (Number.isFinite(r)) return r;
        return l >= 2 ? w * w / (2 * (l - 1)) : 0; // small-w limit when K_l overflows
    }

    /** Pole-free LP characteristic function H(u) at fixed V. */
    function lpChar(l, V) {
        return (u) => {
            const w = Math.sqrt(Math.max(0, V * V - u * u));
            return u * Jm(l - 1, u) + kRatio(l, w) * core.besselJ(l, u);
        };
    }

    /** Universal LP solution u(V) for LP_lm; NaN below cutoff. */
    function lpU(V, l, m, tol = TOL) {
        const vc = lpCutoff(l, m);
        if (!(V > vc)) return NaN;
        const lo = vc,
            hi = Math.min(besselZero(l, m), V);
        const f = lpChar(l, V);
        const flo = f(lo),
            fhi = f(hi);
        if (flo === 0) return NaN;
        if (flo * fhi > 0) return NaN;
        const u = core.brent(f, lo, hi, {
            tol
        });
        // For l = 0 the cladding decay w vanishes like exp[−c/(V − Vc)] near cut-off, so u = V to machine
        // precision although the mode is (weakly) guided: return V and let makeLPMode flag it.
        return Math.min(u, V);
    }

    /** Guided (l, m) pairs with cut-off below V, sorted by cut-off. Pure Bessel-zero bookkeeping. */
    function lpModeList(V) {
        const list = [];
        for (let l = 0;; l++) {
            let any = false;
            for (let m = 1;; m++) {
                const vc = lpCutoff(l, m);
                if (!(vc < V)) break;
                any = true;
                list.push({
                    l,
                    m,
                    cutoffV: vc
                });
            }
            if (!any) break;
        }
        list.sort((p, q) => p.cutoffV - q.cutoffV || p.l - q.l);
        return list;
    }

    const lpLabel = (l, m) => (l < 10 && m < 10 ? `LP${l}${m}` : `LP${l},${m}`);

    function parseLP(label) {
        const s = label.slice(2);
        if (s.includes(",")) return s.split(",").map(Number);
        return [+s[0], +s.slice(1)];
    }

    function lpVectorModes(l, m) {
        if (l === 0) return `HE1${m}`;
        if (l === 1) return `TE0${m}, TM0${m}, HE2${m}`;
        return `EH${l - 1}${m}, HE${l + 1}${m}`;
    }

    function makeLPMode(p, l, m, u) {
        const {
            n1,
            n2,
            a,
            k0,
            V
        } = p;
        const w = Math.sqrt(Math.max(0, V * V - u * u));
        const b = w * w / (V * V);
        const neff = Math.sqrt(n2 * n2 + b * (n1 * n1 - n2 * n2));
        const theta = Math.acos(Math.min(1, neff / n1));
        const base = {
            kind: "fibre",
            l,
            m,
            label: lpLabel(l, m),
            u,
            w,
            V,
            b,
            neff,
            beta: neff * k0,
            n1,
            n2,
            a,
            d: 2 * a,
            k0,
            lambda0: p.lambda0,
            theta,
            incidence: PI / 2 - theta,
            decayLength: a / w,
            cutoffV: lpCutoff(l, m),
            degeneracy: l === 0 ? 2 : 4,
            vectorModes: lpVectorModes(l, m),
            nearCutoff: false
        };
        const Jl = core.besselJ(l, u);
        if (!(w > 1e-150)) {
            // numerically at cut-off: field spreads over the whole cladding, Γ → 0
            return Object.assign(base, {
                nearCutoff: true,
                confinement: 0,
                decayLength: Infinity,
                Jl,
                KlScaled: NaN
            });
        }
        // ∫0^a J_l(ur/a)² r dr = a²/2 [J_l² − J_{l−1} J_{l+1}], ∫a^∞ K_l(wr/a)² r dr = a²/2 [K_{l−1}K_{l+1} − K_l²]
        const Icore = 0.5 * a * a * (Jl * Jl - Jm(l - 1, u) * core.besselJ(l + 1, u)) / (Jl * Jl);
        const Kl = core.besselK(l, w, true),
            Klm = core.besselK(Math.abs(l - 1), w, true),
            Klp = core.besselK(l + 1, w, true);
        const Iclad = 0.5 * a * a * (Klm * Klp - Kl * Kl) / (Kl * Kl);
        const confinement = Icore / (Icore + Iclad);
        return Object.assign(base, {
            confinement,
            Jl,
            KlScaled: Kl,
            nearCutoff: b < 1e-10
        });
    }

    /**
     * All guided LP modes (sorted by decreasing neff). opts.maxModes limits how many are SOLVED
     * (lowest cut-offs first); counts always include every guided mode.
     */
    function solveFibre(input, {
        maxModes = Infinity,
        tol = TOL
    } = {}) {
        const p = params(input);
        if (!(p.n1 > p.n2) || !(p.d > 0) || !(p.lambda0 > 0)) return {
            ...p,
            modes: [],
            lpCount: 0,
            totalModes: 0
        };
        const list = lpModeList(p.V);
        const modes = [];
        for (const {
                l,
                m
            }
            of list.slice(0, maxModes)) {
            const u = lpU(p.V, l, m, tol);
            if (Number.isFinite(u)) modes.push(makeLPMode(p, l, m, u));
        }
        modes.sort((x, y) => y.neff - x.neff);
        const totalModes = list.reduce((s, q) => s + (q.l === 0 ? 2 : 4), 0);
        return {
            ...p,
            modes,
            lpCount: list.length,
            totalModes,
            truncated: list.length > modes.length
        };
    }

    /** LP field ψ(r, φ) (1 at r = a on the φ = 0 line, i.e. unnormalised), even orientation cos(lφ). */
    function lpField(mode, r, phi = 0) {
        const {
            l,
            u,
            w,
            a
        } = mode;
        const ang = l === 0 ? 1 : Math.cos(l * phi);
        if (r <= a) return core.besselJ(l, u * r / a) / mode.Jl * ang;
        if (!Number.isFinite(mode.KlScaled)) return ang; // at cut-off the tail no longer decays (l = 0)
        const x = w * r / a;
        return core.besselK(l, x, true) * Math.exp(w - x) / mode.KlScaled * ang;
    }

    /** Radial derivative dψ/dr at φ = 0 (analytic, for boundary checks). */
    function lpFieldDerivative(mode, r) {
        const {
            l,
            u,
            w,
            a
        } = mode;
        if (r <= a) {
            const x = u * r / a; // J_l' = (J_{l−1} − J_{l+1})/2
            return (u / a) * 0.5 * (Jm(l - 1, x) - core.besselJ(l + 1, x)) / mode.Jl;
        }
        const x = w * r / a; // K_l' = −(K_{l−1} + K_{l+1})/2
        const s = Math.exp(w - x) / mode.KlScaled;
        return -(w / a) * 0.5 * (core.besselK(Math.abs(l - 1), x, true) + core.besselK(l + 1, x, true)) * s;
    }

    // ================================================================ dispersion (numerical derivatives)
    function findMode(sol, label) {
        return sol.modes.find((q) => q.label === label) || null;
    }

    /** neff(λ0) of the mode with this label ("TE0", "TM1", "LP11"); NaN when not guided. */
    function neffOf(geometry, input, label, lambda0) {
        const inp = {
            ...input,
            lambda0
        };
        let mode;
        if (geometry === "slab") mode = findMode(solveSlab(inp, label.slice(0, 2)), label);
        else {
            const [l, m] = parseLP(label);
            const p = params(inp);
            const u = lpU(p.V, l, m);
            mode = Number.isFinite(u) ? makeLPMode(p, l, m, u) : null;
        }
        return mode ? mode.neff : NaN;
    }

    /**
     * Group index and waveguide dispersion of one mode by central differences in λ0.
     * ng = neff − λ dneff/dλ, Dw = −(λ/c) d²neff/dλ² (s/m², multiply by 1e6 for ps/(nm·km)).
     */
    function groupIndex(geometry, input, label, {
        rel = 1e-4,
        relD = 2e-3
    } = {}) {
        const L = input.lambda0;
        const n0 = neffOf(geometry, input, label, L);
        const h = L * rel;
        const np = neffOf(geometry, input, label, L + h),
            nm = neffOf(geometry, input, label, L - h);
        const d1 = (np - nm) / (2 * h);
        const H = L * relD;
        const Np = neffOf(geometry, input, label, L + H),
            Nm = neffOf(geometry, input, label, L - H);
        const d2 = (Np - 2 * n0 + Nm) / (H * H);
        const ng = n0 - L * d1;
        return {
            neff: n0,
            ng,
            dneff: d1,
            d2neff: d2,
            Dw: -(L / C0) * d2,
            groupDelayPerLength: ng / C0
        };
    }

    /**
     * Modal (intermodal) dispersion.
     *  ray: meridional-ray estimate Δτ/L = (n1/c)(n1/n2 − 1) (axial ray vs ray at the critical angle).
     *  modes: spread of computed group indices, Δτ/L = (max ng − min ng)/c (0 for a single mode).
     */
    function modalDispersion(geometry, input, modes) {
        const {
            n1,
            n2
        } = input;
        const ray = (n1 / C0) * (n1 / n2 - 1);
        const ngs = modes.map((q) => groupIndex(geometry, input, q.label).ng); // one per mode (NaN if undefined)
        const ok = ngs.filter(Number.isFinite);
        const spread = ok.length > 1 ? (Math.max(...ok) - Math.min(...ok)) / C0 : 0;
        return {
            rayDelayPerLength: ray,
            modeDelayPerLength: spread,
            ngs
        };
    }

    // ================================================================ b–V curves
    /** Slab b(V) for order m on the V grid (r = 1 TE, (n2/n1)² TM). */
    function slabBV(Vs, m, r = 1) {
        return Vs.map((V) => {
            const u = slabU(V, m, r);
            return Number.isFinite(u) ? 1 - (u * u) / (V * V) : NaN;
        });
    }
    /** Fibre LP_lm b(V) on the V grid (universal in the weakly guiding approximation). */
    function lpBV(Vs, l, m) {
        return Vs.map((V) => {
            const u = lpU(V, l, m, 1e-11);
            return Number.isFinite(u) ? 1 - (u * u) / (V * V) : NaN;
        });
    }

    // ================================================================ evanescent coupling
    /**
     * Two identical symmetric slabs (thickness d) separated by an edge-to-edge gap s, exact five-layer
     * supermodes (TE or TM) for the fundamental pair, plus the TE coupled-mode estimate
     * κ = 2 kx² γ e^{−γ s} / [β (d + 2/γ)(kx² + γ²)] (Yariv & Yeh). Lc = π/(βe − βo) = π/(2κ).
     */
    function coupledSlabs(input, pol = "TE", gap = 1e-6) {
        const p = params(input);
        const {
            n1,
            n2,
            k0,
            d
        } = p;
        const rho = pol === "TM" ? (n1 * n1) / (n2 * n2) : 1;
        const single = solveSlab(input, pol).modes[0];
        const out = {
            pol,
            gap,
            single,
            betaEven: NaN,
            betaOdd: NaN,
            Lc: NaN,
            kappaExact: NaN,
            kappaCMT: NaN,
            LcCMT: NaN,
            reliable: false
        };
        if (!single) return out;
        const charFn = (parity) => (nu) => {
            const kx = k0 * Math.sqrt(n1 * n1 - nu * nu),
                g = k0 * Math.sqrt(nu * nu - n2 * n2);
            const th = Math.tanh(g * gap / 2);
            const G = parity === "even" ? 1 : th,
                Gp = parity === "even" ? g * th : g; // gap field / cosh(γ s/2)
            const c = Math.cos(kx * d),
                s = Math.sin(kx * d);
            const H = G * c + (rho * Gp / kx) * s;
            const Hp = -G * kx * s + rho * Gp * c;
            return (Hp + rho * g * H) / k0;
        };
        const eps = 1e-12;
        const top = (parity) => {
            const roots = core.findRoots(charFn(parity), n2 + eps, n1 - eps, {
                n: 3000,
                tol: 1e-15,
                poleTol: 1
            });
            return roots.length ? roots[roots.length - 1] * k0 : NaN;
        };
        out.betaEven = top("even");
        out.betaOdd = top("odd");
        const dB = out.betaEven - out.betaOdd;
        out.Lc = PI / dB;
        out.kappaExact = dB / 2;
        out.reliable = Number.isFinite(dB) && dB / out.betaEven > 5e-12;
        if (pol === "TE") {
            const {
                kx,
                gamma,
                beta
            } = single;
            out.kappaCMT = 2 * kx * kx * gamma * Math.exp(-gamma * gap) / (beta * (d + 2 / gamma) * (kx * kx + gamma * gamma));
            out.LcCMT = PI / (2 * out.kappaCMT);
        }
        return out;
    }

    /**
     * Two identical weakly guiding fibres (LP01), centre separation D = 2a + gap. Coupled-mode estimate
     * (Snyder & Love): κ = (√(2Δ)/a)(u²/V³) K0(w D/a)/K1(w)².
     */
    function coupledFibres(input, gap = 1e-6) {
        const p = params(input);
        const sol = solveFibre(input, {
            maxModes: 1
        });
        const f = sol.modes[0];
        if (!f) return {
            kappaCMT: NaN,
            LcCMT: NaN
        };
        const D = p.d + gap;
        const k0s = core.besselK(0, f.w * D / p.a, true),
            k1s = core.besselK(1, f.w, true);
        const kappa = (Math.sqrt(2 * p.delta) / p.a) * (f.u * f.u / (p.V ** 3)) * k0s * Math.exp(-f.w * D / p.a) / (k1s * k1s * Math.exp(-2 * f.w));
        return {
            kappaCMT: kappa,
            LcCMT: PI / (2 * kappa),
            separation: D,
            mode: f
        };
    }

    /** Power in guide 2 after length z for phase-matched identical guides launched in guide 1. */
    const couplerPower = (z, Lc) => Math.sin(PI * z / (2 * Lc)) ** 2;

    return {
        numericalAperture,
        params,
        slabChar,
        slabU,
        slabModeCountEstimate,
        solveSlab,
        slabField,
        slabFieldDerivative,
        slabIndex,
        besselZeros,
        besselZero,
        lpCutoff,
        lpChar,
        lpU,
        lpModeList,
        lpVectorModes,
        lpLabel,
        parseLP,
        solveFibre,
        lpField,
        lpFieldDerivative,
        neffOf,
        groupIndex,
        modalDispersion,
        slabBV,
        lpBV,
        coupledSlabs,
        coupledFibres,
        couplerPower,
        SINGLE_MODE_FIBRE_V: 2.404825557695773
    };
});