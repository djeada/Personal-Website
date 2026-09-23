/*
 * Thin films and multilayer coatings: planar stacks of isotropic, nonmagnetic, homogeneous
 * layers between a lossless incident medium and a (possibly absorbing) substrate.
 *
 * Geometry and conventions (identical to fresnel.js)
 * ---------------------------------------------------
 *  - Layers are parallel to the x-y plane; light arrives from the incident medium (index n0,
 *    real, z < 0), crosses layers 1..L in order, and enters the substrate (index Ns).
 *    The plane of incidence is x-z.
 *  - Time convention E(r, t) = Re{E0 exp[i(k·r − ωt)]}. A complex refractive index is
 *    N = n + iκ with κ ≥ 0 for an absorbing medium, so exp(i k0 N z) decays for +z.
 *  - kx = k0 n0 sin θ0 is shared by every layer (Snell). Normal wavenumbers per unit k0:
 *        q_j = sqrt(N_j² − (n0 sin θ0)²),   branch chosen with Im q ≥ 0 (and Re q ≥ 0 if real).
 *  - Tilted optical admittances (in units of the vacuum admittance Y0 = 1/η0):
 *        s (TE):  η_j = q_j              p (TM):  η_j = N_j² / q_j
 *    With E_t the tangential electric field and H_t the tangential magnetic field (scaled so a
 *    forward wave has H_t = η E_t), the normal power flux is S_z = ½ Y0 Re(E_t H_t*).
 *  - Reflection/transmission amplitudes are returned in the fresnel.js bases:
 *        s: ratios of E_y.   p: ratios of the complex amplitude along ê_p = ŷ × k̂,
 *        so r_p = −r_s at normal incidence and r_p = −r_tan (ratio of tangential E).
 *    R = |r|², T = Re(η_s)|t_tan|² / Re(η_0), A = 1 − R − T (power absorbed in the films).
 *
 * Methods
 * -------
 *  1. Characteristic (Abelès) matrices. For layer j with phase thickness δ_j = k0 q_j d_j,
 *        [E_t; H_t]_front = M_j [E_t; H_t]_back,   M_j = [[cos δ, −i sin δ / η], [−i η sin δ, cos δ]]
 *     (derived for exp(−iωt); Macleod writes +i sin δ because he uses exp(+iωt)).
 *     [B; C] = M_1 M_2 … M_L [1; η_s],  Y = C / B,  r_tan = (η0 − Y)/(η0 + Y),
 *     t_tan = 2 η0 / (η0 B + C). For absorbing or evanescent layers |cos δ|, |sin δ| grow like
 *     exp(Im δ): the product overflows (NaN) once Σ Im δ ≳ 700 and loses precision earlier.
 *  2. Recursive Airy/Rouard (a scattering formulation). Starting at the substrate,
 *        ρ_j = (r_{j,j+1} + ρ_{j+1} e^{2iδ_{j+1}}) / (1 + r_{j,j+1} ρ_{j+1} e^{2iδ_{j+1}}),
 *     with interface coefficients r_ab = (η_a − η_b)/(η_a + η_b), t_ab = 1 + r_ab. Only the
 *     decaying factors e^{iδ}, |e^{iδ}| ≤ 1, ever appear, so the result is finite for any
 *     thickness. Forward amplitudes a_{j+1} = a_j e^{iδ_j} t_{j,j+1} / (1 + r_{j,j+1} ρ'_{j+1}) give
 *     the internal field profile.
 *  "auto" uses Abelès when Σ|Im δ| < ABELES_LIMIT and the stable recursion otherwise.
 *
 * All lengths are SI metres, angles radians. Pure and DOM-free.
 */
(function(root, factory) {
    const m = factory();
    if (typeof module === "object" && module.exports) module.exports = m;
    else {
        root.OpticsModels = root.OpticsModels || {};
        root.OpticsModels.thinFilms = m;
    }
})(typeof self !== "undefined" ? self : this, function() {
    "use strict";

    // ---------------------------------------------------------------- complex helpers
    const cx = (re, im = 0) => ({
        re,
        im
    });
    const add = (a, b) => cx(a.re + b.re, a.im + b.im);
    const sub = (a, b) => cx(a.re - b.re, a.im - b.im);
    const mul = (a, b) => cx(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
    const scale = (a, s) => cx(a.re * s, a.im * s);
    const conj = (a) => cx(a.re, -a.im);
    const abs2 = (a) => a.re * a.re + a.im * a.im;
    const abs = (a) => Math.hypot(a.re, a.im);
    const div = (a, b) => { // Smith's algorithm
        if (Math.abs(b.re) >= Math.abs(b.im)) {
            const r = b.im / b.re,
                d = b.re + b.im * r;
            return cx((a.re + a.im * r) / d, (a.im - a.re * r) / d);
        }
        const r = b.re / b.im,
            d = b.re * r + b.im;
        return cx((a.re * r + a.im) / d, (a.im * r - a.re) / d);
    };
    /** exp(i z) for complex z. */
    const expi = (z) => {
        const m = Math.exp(-z.im);
        return cx(m * Math.cos(z.re), m * Math.sin(z.re));
    };
    const ccos = (z) => cx(Math.cos(z.re) * Math.cosh(z.im), -Math.sin(z.re) * Math.sinh(z.im));
    const csin = (z) => cx(Math.sin(z.re) * Math.cosh(z.im), Math.cos(z.re) * Math.sinh(z.im));

    function csqrt(a) {
        if (a.re === 0 && a.im === 0) return cx(0, 0);
        // cancellation-free principal root (weak absorption k ≪ n keeps full relative accuracy)
        const m = Math.hypot(a.re, a.im);
        if (a.re >= 0) {
            const t = Math.sqrt((m + a.re) / 2);
            return cx(t, a.im / (2 * t));
        }
        const t = Math.sqrt((m - a.re) / 2);
        return cx(Math.abs(a.im) / (2 * t), a.im < 0 ? -t : t);
    }
    /** Normal wavenumber branch: Im q ≥ 0 (decay/absorption along +z), Re q ≥ 0 if Im q = 0. */
    function kzBranch(N2, kx) {
        let q = csqrt(cx(N2.re - kx * kx, N2.im));
        if (q.im < 0 || (q.im === 0 && q.re < 0)) q = scale(q, -1);
        if (abs(q) < 1e-12) q = cx(0, 1e-12); // exactly grazing inside a layer: keep η_p finite
        return q;
    }

    const I_ = cx(0, 1);
    const ABELES_LIMIT = 20; // Σ|Im δ| above which "auto" switches to the stable recursion

    // ---------------------------------------------------------------- media
    /** Normalise an index: number → n + 0i; {n, k} → n + ik; {re, im} unchanged. */
    function toIndex(v) {
        if (typeof v === "number") return cx(v, 0);
        if (v && typeof v.n === "number") return cx(v.n, v.k || 0);
        if (v && typeof v.re === "number") return cx(v.re, v.im || 0);
        throw new TypeError("refractive index must be a number or {n, k}");
    }

    /**
     * Normalise a stack description.
     * stack = { n0: number (real, > 0), layers: [{ d (m), n, k = 0, name }], ns: number | {n, k} }
     */
    function normalizeStack(stack) {
        const n0 = Number(stack.n0);
        if (!(n0 > 0)) throw new RangeError("incident index n0 must be real and positive");
        const layers = (stack.layers || []).map((L, i) => {
            const d = Number(L.d);
            if (!(d >= 0) || !Number.isFinite(d)) throw new RangeError("layer " + (i + 1) + ": thickness must be ≥ 0");
            const N = toIndex(L.N || {
                n: Number(L.n),
                k: Number(L.k || 0)
            });
            if (!(N.re > 0) || N.im < 0) throw new RangeError("layer " + (i + 1) + ": need n > 0 and k ≥ 0");
            return {
                d,
                N,
                name: L.name || "L" + (i + 1)
            };
        });
        const Ns = toIndex(stack.ns == null ? 1.52 : stack.ns);
        if (!(Ns.re > 0) || Ns.im < 0) throw new RangeError("substrate: need n > 0 and k ≥ 0");
        return {
            n0,
            layers,
            Ns
        };
    }

    function admittance(N, q, pol) {
        return pol === "s" ? q : div(mul(N, N), q);
    }

    /** Per-medium quantities for one (λ0, kx, polarisation). Index 0 = incident, L+1 = substrate. */
    function mediaFor(st, lambda0, kx, pol) {
        const k0 = 2 * Math.PI / lambda0;
        const Ns = [cx(st.n0, 0), ...st.layers.map((l) => l.N), st.Ns];
        const ds = [0, ...st.layers.map((l) => l.d), 0];
        const q = Ns.map((N) => kzBranch(mul(N, N), kx));
        const eta = Ns.map((N, i) => admittance(N, q[i], pol));
        const delta = q.map((qi, i) => scale(qi, k0 * ds[i]));
        let sumIm = 0;
        for (let i = 1; i < delta.length - 1; i++) sumIm += Math.abs(delta[i].im);
        return {
            k0,
            kx,
            N: Ns,
            d: ds,
            q,
            eta,
            delta,
            sumIm,
            L: st.layers.length
        };
    }

    // ---------------------------------------------------------------- solvers (tangential basis)
    function abelesTan(M) {
        const L = M.L;
        let B = cx(1, 0),
            C = M.eta[L + 1];
        for (let j = L; j >= 1; j--) { // [B; C] ← M_j [B; C]
            const c = ccos(M.delta[j]),
                s = csin(M.delta[j]);
            const is = mul(I_, s);
            const nB = sub(mul(c, B), div(mul(is, C), M.eta[j]));
            const nC = sub(mul(c, C), mul(mul(is, M.eta[j]), B));
            B = nB;
            C = nC;
        }
        const e0 = M.eta[0];
        const den = add(mul(e0, B), C);
        return {
            rTan: div(sub(mul(e0, B), C), den),
            tTan: div(scale(e0, 2), den),
            B,
            C
        };
    }

    function airyTan(M, keepFields) {
        const L = M.L,
            eta = M.eta;
        const rI = [],
            tI = [],
            rhoR = new Array(L + 2),
            rhoL = new Array(L + 2);
        for (let j = 0; j <= L; j++) {
            const den = add(eta[j], eta[j + 1]);
            rI[j] = div(sub(eta[j], eta[j + 1]), den);
            tI[j] = div(scale(eta[j], 2), den);
        }
        rhoL[L + 1] = cx(0, 0);
        for (let j = L; j >= 0; j--) {
            const rp = rhoL[j + 1];
            rhoR[j] = div(add(rI[j], rp), add(cx(1, 0), mul(rI[j], rp)));
            if (j >= 1) rhoL[j] = mul(rhoR[j], expi(scale(M.delta[j], 2)));
        }
        // forward amplitudes (tangential E of the forward wave) at the left of each medium
        const aL = new Array(L + 2),
            aR = new Array(L + 2);
        aR[0] = cx(1, 0);
        for (let j = 0; j <= L; j++) {
            aL[j + 1] = div(mul(aR[j], tI[j]), add(cx(1, 0), mul(rI[j], rhoL[j + 1])));
            if (j + 1 <= L) aR[j + 1] = mul(aL[j + 1], expi(M.delta[j + 1]));
        }
        const out = {
            rTan: rhoR[0],
            tTan: aL[L + 1]
        };
        if (keepFields) Object.assign(out, {
            aL,
            aR,
            rhoR
        });
        return out;
    }

    /** Convert tangential-basis amplitudes to fresnel.js bases and power coefficients. */
    function finish(M, tan, pol, method) {
        const L = M.L;
        const e0 = M.eta[0],
            es = M.eta[L + 1];
        let r, t;
        if (pol === "s") {
            r = tan.rTan;
            t = tan.tTan;
        } else {
            r = scale(tan.rTan, -1);
            // E_x = (q/N)·A for the ê_p basis: t_p = t_tan (q0/N0)(Ns/qs)
            t = mul(tan.tTan, div(mul(M.q[0], M.N[L + 1]), mul(M.N[0], M.q[L + 1])));
        }
        const R = abs2(tan.rTan);
        const T = e0.re > 0 ? es.re * abs2(tan.tTan) / e0.re : 0;
        return {
            r,
            t,
            rTan: tan.rTan,
            tTan: tan.tTan,
            R,
            T,
            A: 1 - R - T,
            method,
            sumImDelta: M.sumIm
        };
    }

    /**
     * Solve a stack for one wavelength, angle and polarisation.
     * opts.method: "auto" (default) | "abeles" | "airy". opts.kx overrides n0 sin θ0 (per k0).
     * Returns { r, t, rTan, tTan, R, T, A, method, sumImDelta }.
     */
    function solve(stack, lambda0, theta0, pol = "s", opts = {}) {
        const st = stack.__norm ? stack : normalizeStack(stack);
        if (!(lambda0 > 0)) throw new RangeError("lambda0 must be positive (m)");
        if (pol !== "s" && pol !== "p") throw new RangeError('pol must be "s" or "p"');
        const kx = opts.kx != null ? opts.kx : st.n0 * Math.sin(Math.min(theta0, Math.PI / 2 * 0.99999));
        const M = mediaFor(st, lambda0, kx, pol);
        let method = opts.method || "auto";
        if (method === "auto") method = M.sumIm < ABELES_LIMIT ? "abeles" : "airy";
        const tan = method === "abeles" ? abelesTan(M) : airyTan(M, false);
        return finish(M, tan, pol, method);
    }

    /** Unpolarised (incoherent 50/50 s+p) power coefficients. */
    function solveUnpolarized(stack, lambda0, theta0, opts = {}) {
        const s = solve(stack, lambda0, theta0, "s", opts),
            p = solve(stack, lambda0, theta0, "p", opts);
        return {
            R: (s.R + p.R) / 2,
            T: (s.T + p.T) / 2,
            A: (s.A + p.A) / 2,
            s,
            p
        };
    }

    function prepared(stack) {
        const st = normalizeStack(stack);
        st.__norm = true;
        return st;
    }

    /** Power coefficients for pol ∈ {"s", "p", "u"} (u = unpolarised). */
    function power(stack, lambda0, theta0, pol, opts) {
        if (pol === "u") return solveUnpolarized(stack, lambda0, theta0, opts);
        return solve(stack, lambda0, theta0, pol, opts);
    }

    // ---------------------------------------------------------------- incoherent / coherent backside
    /**
     * Stack on a substrate of finite thickness D with an exit medium ne behind it.
     * mode "incoherent": intensities of the multiply reflected substrate passes add (phase averaged):
     *    R = R_f + T_f² τ² R_b / (1 − R_f' R_b τ²),  T = T_f τ T_b / (1 − R_f' R_b τ²)
     *   where τ = exp(−2 k0 Im(q_s) D) is the single-pass power transmission of the substrate,
     *   R_f' is the stack reflectance seen from the substrate and R_b, T_b the bare back interface.
     *   T_f from both sides is equal (reciprocity). R_f' uses Re(N_s) (weak-absorption approximation).
     * mode "coherent": the substrate is one more coherent layer (fringes of period ≈ λ²/(2 n D cos θ)).
     */
    function withBackside(stack, lambda0, theta0, pol, back) {
        const st = prepared(stack);
        const D = back.thickness,
            ne = back.ne == null ? 1 : back.ne;
        const opts = {
            method: back.method || "auto"
        };
        if (pol === "u") {
            const s = withBackside(stack, lambda0, theta0, "s", back),
                p = withBackside(stack, lambda0, theta0, "p", back);
            return {
                R: (s.R + p.R) / 2,
                T: (s.T + p.T) / 2,
                A: (s.A + p.A) / 2,
                s,
                p
            };
        }
        if (back.mode === "coherent") {
            const full = {
                n0: st.n0,
                layers: [...stack.layers, {
                    d: D,
                    N: st.Ns,
                    name: "substrate"
                }],
                ns: ne
            };
            return solve(full, lambda0, theta0, pol, opts);
        }
        const kx = st.n0 * Math.sin(Math.min(theta0, Math.PI / 2 * 0.99999));
        const front = solve(st, lambda0, theta0, pol, opts);
        const nsr = st.Ns.re;
        const k0 = 2 * Math.PI / lambda0;
        const qs = kzBranch(mul(st.Ns, st.Ns), kx);
        if (kx >= nsr) return {
            R: front.R,
            T: 0,
            A: front.A,
            front,
            tau: 0
        }; // evanescent in substrate
        const tau = Math.exp(-2 * k0 * qs.im * D);
        const rev = {
            n0: nsr,
            layers: stack.layers.slice().reverse(),
            ns: st.n0
        };
        const Rfp = solve(rev, lambda0, 0, pol, {
            kx,
            method: opts.method
        }).R;
        const bare = solve({
            n0: nsr,
            layers: [],
            ns: ne
        }, lambda0, 0, pol, {
            kx
        });
        const Rb = bare.R,
            Tb = bare.T;
        const den = 1 - Rfp * Rb * tau * tau;
        const R = front.R + front.T * front.T * tau * tau * Rb / den;
        const T = front.T * tau * Tb / den;
        return {
            R,
            T,
            A: 1 - R - T,
            front,
            tau,
            Rb,
            Rfp
        };
    }

    // ---------------------------------------------------------------- spectra and scans
    function spectrum(stack, lambdas, theta0, opts = {}) {
        const st = prepared(stack);
        const n = lambdas.length;
        const out = {
            lambda: Array.from(lambdas),
            Rs: new Float64Array(n),
            Ts: new Float64Array(n),
            Rp: new Float64Array(n),
            Tp: new Float64Array(n),
            As: new Float64Array(n),
            Ap: new Float64Array(n)
        };
        let maxDiff = 0,
            abelesUsed = 0,
            maxSumIm = 0;
        for (let i = 0; i < n; i++) {
            for (const pol of ["s", "p"]) {
                const r = opts.back && opts.back.mode !== "none" ? withBackside(stack, lambdas[i], theta0, pol, opts.back) : solve(st, lambdas[i], theta0, pol, opts);
                out["R" + pol][i] = r.R;
                out["T" + pol][i] = r.T;
                out["A" + pol][i] = r.A;
                if (r.method === "abeles") abelesUsed++;
                if (r.sumImDelta > maxSumIm) maxSumIm = r.sumImDelta;
            }
            if (opts.compare) {
                const d = compareMethods(st, lambdas[i], theta0);
                if (Number.isFinite(d.maxDiff) && d.maxDiff > maxDiff) maxDiff = d.maxDiff;
                else if (!Number.isFinite(d.maxDiff)) maxDiff = Infinity;
            }
        }
        out.maxMethodDiff = maxDiff;
        out.abelesFraction = abelesUsed / (2 * n);
        out.maxSumImDelta = maxSumIm;
        return out;
    }

    /** |ΔR|, |ΔT| between Abelès and the stable recursion (s and p). NaN in Abelès → Infinity. */
    function compareMethods(stack, lambda0, theta0) {
        let maxDiff = 0,
            sumIm = 0;
        for (const pol of ["s", "p"]) {
            const a = solve(stack, lambda0, theta0, pol, {
                method: "abeles"
            });
            const b = solve(stack, lambda0, theta0, pol, {
                method: "airy"
            });
            sumIm = b.sumImDelta;
            const d = Math.max(Math.abs(a.R - b.R), Math.abs(a.T - b.T));
            maxDiff = Number.isFinite(d) ? Math.max(maxDiff, d) : Infinity;
        }
        return {
            maxDiff,
            sumImDelta: sumIm,
            abelesStable: sumIm < ABELES_LIMIT
        };
    }

    function angleScan(stack, lambda0, thetas, opts = {}) {
        const st = prepared(stack);
        const n = thetas.length;
        const out = {
            theta: Array.from(thetas),
            Rs: new Float64Array(n),
            Ts: new Float64Array(n),
            Rp: new Float64Array(n),
            Tp: new Float64Array(n),
            As: new Float64Array(n),
            Ap: new Float64Array(n)
        };
        for (let i = 0; i < n; i++) {
            for (const pol of ["s", "p"]) {
                const r = opts.back && opts.back.mode !== "none" ? withBackside(stack, lambda0, thetas[i], pol, opts.back) : solve(st, lambda0, thetas[i], pol, opts);
                out["R" + pol][i] = r.R;
                out["T" + pol][i] = r.T;
                out["A" + pol][i] = r.A;
            }
        }
        return out;
    }

    // ---------------------------------------------------------------- internal field
    /**
     * Field profile through the stack (stable recursion) for incident |E| = 1.
     * Returns { z (m, 0 = first interface), E2 (|E|²/|E_inc|²), Et2 (tangential only),
     * interfaces (m), layerOf[i] (0 = incident, L+1 = substrate), absorbed[j] (fraction of incident
     * power absorbed in layer j, from the flux difference), flux[j] (normalised S_z at interface j),
     * R, T }. pad: length of incident medium and substrate shown (m).
     */
    function fieldProfile(stack, lambda0, theta0, pol = "s", opts = {}) {
        const st = normalizeStack(stack);
        const kx = st.n0 * Math.sin(Math.min(theta0, Math.PI / 2 * 0.99999));
        const M = mediaFor(st, lambda0, kx, pol);
        const f = airyTan(M, true);
        const L = M.L,
            k0 = M.k0;
        const total = st.layers.reduce((s, l) => s + l.d, 0);
        const pad = opts.pad != null ? opts.pad : Math.max(lambda0 * 0.75, total * 0.15);
        const nSamp = opts.samples || 800;
        // incident tangential amplitude: s → 1; p → q0/n0 so that |E_inc| = 1
        const a0 = pol === "s" ? cx(1, 0) : cx(M.q[0].re / st.n0, 0);
        const inc2 = abs2(a0);
        const interfaces = [0];
        for (let j = 1; j <= L; j++) interfaces.push(interfaces[j - 1] + st.layers[j - 1].d);
        // tangential E and H̃ at a point in medium j with local coordinate u (from its left boundary)
        function fields(j, u) {
            let fwd, bwd;
            if (j === 0) { // u ≤ 0 measured from the first interface
                fwd = expi(scale(M.q[0], k0 * u));
                bwd = mul(f.rhoR[0], expi(scale(M.q[0], -k0 * u)));
            } else if (j === L + 1) {
                fwd = mul(f.aL[L + 1], expi(scale(M.q[L + 1], k0 * u)));
                bwd = cx(0, 0);
            } else {
                const d = M.d[j];
                fwd = mul(f.aL[j], expi(scale(M.q[j], k0 * u)));
                bwd = mul(mul(f.rhoR[j], f.aR[j]), expi(scale(M.q[j], k0 * (d - u))));
            }
            fwd = mul(fwd, a0);
            bwd = mul(bwd, a0);
            const Et = add(fwd, bwd);
            const Ht = mul(M.eta[j], sub(fwd, bwd));
            return {
                Et,
                Ht
            };
        }

        function E2of(j, u) {
            const {
                Et,
                Ht
            } = fields(j, u);
            if (pol === "s") return {
                E2: abs2(Et),
                Et2: abs2(Et)
            };
            const N2 = mul(M.N[j], M.N[j]);
            const Ez = scale(div(Ht, N2), -kx); // E_z = −kx H̃ / N²
            return {
                E2: abs2(Et) + abs2(Ez),
                Et2: abs2(Et)
            };
        }
        const zMin = -pad,
            zMax = total + pad;
        const z = [],
            E2 = [],
            Et2 = [],
            layerOf = [];
        const pushPoint = (zz, j, u) => {
            const e = E2of(j, u);
            z.push(zz);
            E2.push(e.E2 / inc2);
            Et2.push(e.Et2 / inc2);
            layerOf.push(j);
        };
        // sample each region, including both ends of every region (discontinuous |E|² for p)
        const regions = [{
            j: 0,
            z0: zMin,
            z1: 0
        }];
        for (let j = 1; j <= L; j++) regions.push({
            j,
            z0: interfaces[j - 1],
            z1: interfaces[j]
        });
        regions.push({
            j: L + 1,
            z0: total,
            z1: zMax
        });
        const span = zMax - zMin;
        for (const R of regions) {
            if (R.z1 <= R.z0 && R.j !== 0 && R.j !== L + 1) continue;
            const n = Math.max(2, Math.round(nSamp * (R.z1 - R.z0) / span) + 1);
            for (let i = 0; i < n; i++) {
                const zz = R.z0 + (R.z1 - R.z0) * i / (n - 1);
                const u = R.j === 0 ? zz : R.j === L + 1 ? zz - total : zz - R.z0;
                pushPoint(zz, R.j, u);
            }
        }
        // normalised flux at each interface (just inside medium j+1 at its left boundary)
        const incFlux = M.eta[0].re * inc2;
        const flux = [];
        for (let j = 0; j <= L; j++) {
            const {
                Et,
                Ht
            } = fields(j + 1, 0);
            flux.push(mul(Et, conj(Ht)).re / incFlux);
        }
        const absorbed = [];
        for (let j = 1; j <= L; j++) absorbed.push(flux[j - 1] - flux[j]);
        const R = abs2(f.rhoR[0]);
        const T = M.eta[0].re > 0 ? M.eta[L + 1].re * abs2(f.aL[L + 1]) / M.eta[0].re : 0;
        return {
            z,
            E2,
            Et2,
            layerOf,
            interfaces,
            absorbed,
            flux,
            R,
            T,
            pad,
            total,
            kx,
            fields,
            E2of,
            eta: M.eta,
            N: M.N,
            q: M.q,
            k0
        };
    }

    // ---------------------------------------------------------------- design helpers
    /** Physical thickness of a quarter-wave optical thickness layer at normal incidence. */
    const quarterWave = (lambda0, n) => lambda0 / (4 * n);

    /** Normal-incidence peak reflectance of (HL)^N H on a substrate (all quarter-wave). */
    function braggPeakR(n0, nH, nL, ns, N) {
        const Y = Math.pow(nH / nL, 2 * N) * nH * nH / ns;
        return ((n0 - Y) / (n0 + Y)) ** 2;
    }

    /**
     * Stop-band of a quarter-wave stack at normal incidence. In g = λ0/λ the band is centred on
     * g = 1 with half-width Δg = (2/π) asin((nH − nL)/(nH + nL)) (exact for an infinite stack).
     * Returns edges in wavelength and the common approximation Δλ/λ0 ≈ 4/π asin(…).
     */
    function braggStopband(lambda0, nH, nL) {
        const dg = (2 / Math.PI) * Math.asin(Math.abs(nH - nL) / (nH + nL));
        const lamShort = lambda0 / (1 + dg),
            lamLong = lambda0 / (1 - dg);
        return {
            dg,
            lamShort,
            lamLong,
            width: lamLong - lamShort,
            fracApprox: 2 * dg,
            fracExact: (lamLong - lamShort) / lambda0
        };
    }

    /**
     * Half-trace of the characteristic matrix of one period (layers given), at normal incidence.
     * |½ Tr M| > 1 means an evanescent Bloch wave, i.e. a photonic stop band.
     */
    function periodHalfTrace(periodLayers, lambda0, kx = 0, pol = "s") {
        const st = normalizeStack({
            n0: 1,
            layers: periodLayers,
            ns: 1
        });
        const M = mediaFor(st, lambda0, kx, pol);
        let A = [
            [cx(1), cx(0)],
            [cx(0), cx(1)]
        ];
        for (let j = 1; j <= M.L; j++) {
            const c = ccos(M.delta[j]),
                s = csin(M.delta[j]);
            const is = mul(I_, s);
            const Mj = [
                [c, scale(div(is, M.eta[j]), -1)],
                [scale(mul(is, M.eta[j]), -1), c]
            ];
            A = [
                [add(mul(A[0][0], Mj[0][0]), mul(A[0][1], Mj[1][0])), add(mul(A[0][0], Mj[0][1]), mul(A[0][1], Mj[1][1]))],
                [add(mul(A[1][0], Mj[0][0]), mul(A[1][1], Mj[1][0])), add(mul(A[1][0], Mj[0][1]), mul(A[1][1], Mj[1][1]))]
            ];
        }
        return scale(add(A[0][0], A[1][1]), 0.5);
    }

    /** Locate the edges of the stop band around λ0 numerically from |½ Tr M_period| = 1 (bisection). */
    function numericStopband(periodLayers, lambda0) {
        const f = (lam) => Math.abs(periodHalfTrace(periodLayers, lam).re) - 1;
        if (!(f(lambda0) > 0)) return null;
        const edge = (lo, hi) => { // f(lo) > 0 side = lo
            for (let i = 0; i < 200; i++) {
                const m = 0.5 * (lo + hi);
                if (f(m) > 0) lo = m;
                else hi = m;
            }
            return 0.5 * (lo + hi);
        };
        const lamShort = edge(lambda0, lambda0 * 0.5);
        const lamLong = edge(lambda0, lambda0 * 2);
        return {
            lamShort,
            lamLong,
            width: lamLong - lamShort
        };
    }

    // ---------------------------------------------------------------- colour (display aid)
    // CIE 1931 2° colour-matching functions: multi-lobe Gaussian fit of Wyman, Sloan & Shirley,
    // JCGT 2(2), 2013 (≈1 % of peak accuracy). Wavelength in nm.
    const g = (x, mu, s1, s2) => {
        const t = (x - mu) / (x < mu ? s1 : s2);
        return Math.exp(-0.5 * t * t);
    };

    function cmf(nm) {
        return [
            1.056 * g(nm, 599.8, 37.9, 31.0) + 0.362 * g(nm, 442.0, 16.0, 26.7) - 0.065 * g(nm, 501.1, 20.4, 26.2),
            0.821 * g(nm, 568.8, 46.9, 40.5) + 0.286 * g(nm, 530.9, 16.3, 31.1),
            1.217 * g(nm, 437.0, 11.8, 36.0) + 0.681 * g(nm, 459.0, 26.0, 13.8)
        ];
    }
    /** Relative spectral power of a 6504 K blackbody (stand-in for daylight D65). */
    function illuminant(nm) {
        const l = nm * 1e-9,
            c2 = 1.438776877e-2;
        return 1 / (Math.pow(l / 560e-9, 5) * (Math.exp(c2 / (l * 6504)) - 1)) * (Math.exp(c2 / (560e-9 * 6504)) - 1);
    }
    const COLOR_NM = Array.from({
        length: 81
    }, (_, i) => 380 + 5 * i);
    const WHITE = (() => {
        let X = 0,
            Y = 0,
            Z = 0;
        for (const nm of COLOR_NM) {
            const [x, y, z] = cmf(nm), S = illuminant(nm);
            X += S * x;
            Y += S * y;
            Z += S * z;
        }
        return {
            X,
            Y,
            Z
        };
    })();
    const xyzToLin = (X, Y, Z) => [
        3.2406 * X - 1.5372 * Y - 0.4986 * Z,
        -0.9689 * X + 1.8758 * Y + 0.0415 * Z,
        0.0557 * X - 0.2040 * Y + 1.0570 * Z
    ];
    const WHITE_LIN = xyzToLin(WHITE.X / WHITE.Y, 1, WHITE.Z / WHITE.Y);
    const gammaEnc = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

    /**
     * Colour of light with spectral factor f(λ) (e.g. R(λ)) under the illuminant.
     * Returns { X, Y, Z (Y = 1 for f ≡ 1), x, y, rgb: [0..255] }. `exposure` multiplies the linear
     * values before encoding (to brighten dim reflections). RGB is white-balanced so f ≡ 1 is
     * neutral white; out-of-gamut values are clipped. A display aid, not colorimetry.
     */
    function colourOf(fOfNm, exposure = 1) {
        let X = 0,
            Y = 0,
            Z = 0;
        for (const nm of COLOR_NM) {
            const v = fOfNm(nm),
                S = illuminant(nm),
                [x, y, z] = cmf(nm);
            X += S * v * x;
            Y += S * v * y;
            Z += S * v * z;
        }
        X /= WHITE.Y;
        Y /= WHITE.Y;
        Z /= WHITE.Y;
        const s = X + Y + Z;
        return {
            X,
            Y,
            Z,
            x: s > 0 ? X / s : NaN,
            y: s > 0 ? Y / s : NaN,
            rgb: xyzToRGB(X, Y, Z, exposure)
        };
    }
    /** White-balanced, clipped sRGB (0..255) of tristimulus values (Y = 1 ↔ the illuminant). */
    function xyzToRGB(X, Y, Z, exposure = 1) {
        const lin = xyzToLin(X, Y, Z).map((c, i) => c / WHITE_LIN[i] * exposure);
        return lin.map((c) => Math.round(255 * gammaEnc(Math.min(1, Math.max(0, c)))));
    }

    /**
     * Thickness scan of one layer (index `layer`, 0-based): R at probe λ and reflected colour.
     * Returns { d (m), R, Rcol: [[r,g,b]], Y } with pol ∈ {"s","p","u"}.
     */
    function thicknessScan(stack, layer, dMax, samples, lambda0, theta0, pol = "u", withColour = true) {
        const d = [],
            R = [],
            cols = [],
            Y = [];
        for (let i = 0; i < samples; i++) {
            const di = dMax * i / (samples - 1);
            const layers = stack.layers.map((l, j) => (j === layer ? Object.assign({}, l, {
                d: di
            }) : l));
            const st = prepared({
                n0: stack.n0,
                layers,
                ns: stack.ns
            });
            d.push(di);
            R.push(power(st, lambda0, theta0, pol).R);
            if (withColour) {
                const c = colourOf((nm) => power(st, nm * 1e-9, theta0, pol).R);
                cols.push(c);
                Y.push(c.Y);
            }
        }
        return {
            d,
            R,
            colours: cols,
            Y
        };
    }

    return {
        ABELES_LIMIT,
        complex: {
            cx,
            add,
            sub,
            mul,
            div,
            scale,
            abs,
            abs2,
            conj,
            expi,
            csqrt
        },
        toIndex,
        normalizeStack,
        kzBranch,
        solve,
        solveUnpolarized,
        power,
        withBackside,
        compareMethods,
        spectrum,
        angleScan,
        fieldProfile,
        thicknessScan,
        quarterWave,
        braggPeakR,
        braggStopband,
        periodHalfTrace,
        numericStopband,
        cmf,
        illuminant,
        colourOf,
        xyzToRGB
    };
});