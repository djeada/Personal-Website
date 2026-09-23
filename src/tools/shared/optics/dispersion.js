/*
 * Optical materials, dispersion and ultrashort-pulse propagation (pure, DOM-free).
 *
 * Browser: <script src="../shared/optics/dispersion.js"></script> → window.OpticsModels.dispersion
 * Node:    const disp = require(".../shared/optics/dispersion.js")
 *
 * Conventions (shared with the rest of the optics suite, see TEMPLATE.md §5)
 * -----------------------------------------------------------------------------
 *  - SI internally: λ in m, ω in rad/s, z in m, t in s. Sellmeier coefficients are tabulated in the
 *    source units (λ in µm, C in µm²) and converted inside sellmeierN.
 *  - λ is always the vacuum wavelength. Time convention E(z,t) = Re{Ẽ(ω) exp[i(k(ω) z − ω t)]}.
 *    Complex index ñ = n + iκ with κ ≥ 0 for a passive (absorbing) medium, k = ω ñ / c, and the
 *    intensity absorption coefficient is α = 2 Im k = 2 κ ω / c.
 *  - Taylor expansion about the carrier ω0 (Ω = ω − ω0):
 *        k(ω) ≈ β0 + β1 Ω + β2 Ω²/2 + β3 Ω³/6,   β1 = 1/v_g, β2 = GVD, β3 = TOD.
 *    A spectral phase φ(ω) multiplies exp(+iφ); group delay τ_g = +dφ/dω; GDD = d²φ/dω².
 *    Propagation through length z adds φ = k(ω) z, so GDD = β2 z and normal dispersion
 *    (β2 > 0) makes red components lead (up-chirp).
 *  - Pulse envelope: E(t) = Re{A(t) exp(−i ω0 t)}. The transform-limited input is
 *        A(t) = exp(−t² / (2 τ0²))   ⇒   |A|² = exp(−t²/τ0²),
 *    so τ0 is the 1/e half-width of the INTENSITY and FWHM = 2√(ln 2) τ0 ≈ 1.665 τ0.
 *    With pure GDD φ2 the intensity stays Gaussian with τ = τ0 √(1 + (φ2/τ0²)²);
 *    for a slab φ2 = β2 z, i.e. τ(z) = τ0 √(1 + (z/L_D)²) with L_D = τ0²/|β2|.
 *  - FFT (core.fft, numpy convention): A_n = (1/N) Σ X_k exp(+2πi k n/N). With t_n = n Δt the
 *    component exp(+2πi f_k t) = exp(−i Ω_k t), hence Ω_k = −2π f_k (f_k from core.fftFreq).
 */
(function(root, factory) {
    const m = factory(root);
    if (typeof module === "object" && module.exports) module.exports = m;
    else {
        root.OpticsModels = root.OpticsModels || {};
        root.OpticsModels.dispersion = m;
    }
})(typeof self !== "undefined" ? self : this, function(root) {
    "use strict";
    const core = (typeof require === "function" && typeof module === "object") ?
        require("./core.js") : root.OpticsModels.core;
    const C0 = core.constants.c;
    const TWO_PI = 2 * Math.PI;

    // ================================================================ material data
    /**
     * Sellmeier form n² − 1 = Σ B_i λ² / (λ² − C_i), λ in µm, C_i in µm² (B dimensionless).
     * range = [λmin, λmax] in metres: the interval over which the fit was made / is published.
     */
    const MATERIALS = Object.freeze({
        fused_silica: Object.freeze({
            id: "fused_silica",
            name: "Fused silica (SiO₂)",
            kind: "sellmeier",
            B: [0.6961663, 0.4079426, 0.8974794],
            C: [0.0684043 ** 2, 0.1162414 ** 2, 9.896161 ** 2],
            range: [0.21e-6, 3.71e-6],
            temperature: "20 °C",
            ref: "I. H. Malitson, J. Opt. Soc. Am. 55, 1205–1209 (1965)",
            note: "Coefficients as published: B_i dimensionless, C_i = (λ_i/µm)² with λ in µm."
        }),
        bk7: Object.freeze({
            id: "bk7",
            name: "Schott N-BK7",
            kind: "sellmeier",
            B: [1.03961212, 0.231792344, 1.01046945],
            C: [0.00600069867, 0.0200179144, 103.560653],
            range: [0.3e-6, 2.5e-6],
            temperature: "20 °C",
            ref: "SCHOTT optical glass data sheet N-BK7 (517642.251), Sellmeier coefficients",
            note: "Schott tabulates C_i in µm²."
        }),
        sapphire_o: Object.freeze({
            id: "sapphire_o",
            name: "Sapphire (Al₂O₃), ordinary ray",
            kind: "sellmeier",
            B: [1.4313493, 0.65054713, 5.3414021],
            C: [0.0726631 ** 2, 0.1193242 ** 2, 18.028251 ** 2],
            range: [0.2e-6, 5.0e-6],
            temperature: "20 °C",
            ref: "I. H. Malitson and M. J. Dodge, J. Opt. Soc. Am. 62, 1405 (1972)",
            note: "Ordinary ray only (uniaxial crystal; e-ray differs by ≈ 0.008)."
        }),
        caf2: Object.freeze({
            id: "caf2",
            name: "Calcium fluoride (CaF₂)",
            kind: "sellmeier",
            B: [0.5675888, 0.4710914, 3.8484723],
            C: [0.050263605 ** 2, 0.1003909 ** 2, 34.649040 ** 2],
            range: [0.23e-6, 9.7e-6],
            temperature: "24 °C",
            ref: "I. H. Malitson, Appl. Opt. 2, 1103–1107 (1963)",
            note: "C_i = (λ_i/µm)²."
        }),
        water: Object.freeze({
            id: "water",
            name: "Water (H₂O, liquid)",
            kind: "sellmeier",
            B: [5.684027565e-1, 1.726177391e-1, 2.086189578e-2, 1.130748688e-1],
            C: [5.101829712e-3, 1.821153936e-2, 2.620722293e-2, 1.069792721e1],
            range: [0.182e-6, 1.129e-6],
            temperature: "20 °C",
            ref: "M. Daimon and A. Masumura, Appl. Opt. 46, 3811–3820 (2007), 20 °C fit",
            note: "Four-term fit; water absorbs strongly beyond ≈ 1.1 µm (not modelled)."
        })
    });

    const DEFAULT_LORENTZ = Object.freeze({
        lambdaR: 600e-9,
        gammaRel: 0.05,
        strength: 0.8,
        epsInf: 1
    });

    /**
     * Resolve a material spec: a MATERIALS id, {kind: "constant", n}, or
     * {kind: "lorentz", lambdaR (m), gammaRel = γ/ω_R, strength S = ω_p²/ω_R², epsInf}.
     */
    function resolveMaterial(spec) {
        if (typeof spec === "string") {
            const m = MATERIALS[spec];
            if (!m) throw new RangeError("unknown material " + spec);
            return m;
        }
        if (spec && (spec.kind === "sellmeier" || spec._resolved)) return spec;
        if (spec && spec.kind === "constant") {
            const n = Number(spec.n);
            if (!(n > 0)) throw new RangeError("constant index must be > 0");
            return {
                id: "constant",
                kind: "constant",
                name: "Nondispersive, n = " + n,
                n,
                range: [0, Infinity],
                ref: "idealisation",
                _resolved: true
            };
        }
        if (spec && spec.kind === "lorentz") {
            const p = Object.assign({}, DEFAULT_LORENTZ, spec);
            if (!(p.lambdaR > 0) || !(p.gammaRel >= 0) || !(p.strength >= 0) || !(p.epsInf >= 1)) throw new RangeError("invalid Lorentz parameters");
            return Object.assign(p, {
                id: "lorentz",
                kind: "lorentz",
                name: "Lorentz oscillator",
                omegaR: TWO_PI * C0 / p.lambdaR,
                range: [0, Infinity],
                ref: "single-resonance Lorentz model",
                _resolved: true
            });
        }
        throw new RangeError("invalid material spec");
    }

    /** Sellmeier n at vacuum wavelength λ (m). Returns NaN where n² ≤ 0 (inside an absorption pole). */
    function sellmeierN(mat, lambda) {
        const l2 = (lambda * 1e6) ** 2;
        let s = 1;
        for (let i = 0; i < mat.B.length; i++) s += mat.B[i] * l2 / (l2 - mat.C[i]);
        return s > 0 ? Math.sqrt(s) : NaN;
    }

    /** Lorentz permittivity ε(ω) = ε∞ + S ω_R² / (ω_R² − ω² − iγω) (exp(−iωt): Im ε ≥ 0). */
    function lorentzEps(mat, omega) {
        const wr = mat.omegaR,
            g = mat.gammaRel * wr;
        const den = core.complex.cx(wr * wr - omega * omega, -g * omega);
        const term = core.complex.div(core.complex.cx(mat.strength * wr * wr, 0), den);
        return core.complex.cx(mat.epsInf + term.re, term.im);
    }

    /** Complex refractive index ñ = n + iκ at angular frequency ω (rad/s). Principal root (κ ≥ 0). */
    function complexIndex(spec, omega) {
        const mat = resolveMaterial(spec);
        if (mat.kind === "constant") return core.complex.cx(mat.n, 0);
        if (mat.kind === "lorentz") return core.complex.sqrt(lorentzEps(mat, omega));
        return core.complex.cx(sellmeierN(mat, TWO_PI * C0 / omega), 0);
    }

    /** Is λ inside the published validity interval of the material? */
    function inRange(spec, lambda) {
        const mat = resolveMaterial(spec);
        return lambda >= mat.range[0] && lambda <= mat.range[1];
    }

    /**
     * Index at vacuum wavelength λ (m): { n, kappa, alpha (1/m, intensity), valid, message }.
     * Outside the validity interval n is still evaluated (valid = false, with a warning message);
     * with {strict: true} it returns n = NaN instead (refuses to extrapolate).
     */
    function indexAt(spec, lambda, opts = {}) {
        const mat = resolveMaterial(spec);
        const omega = TWO_PI * C0 / lambda;
        const nt = complexIndex(mat, omega);
        const valid = inRange(mat, lambda) && Number.isFinite(nt.re);
        const message = valid ? "" : mat.name + " data are valid for " + (mat.range[0] * 1e6).toFixed(3) + "–" + (mat.range[1] * 1e6).toFixed(3) + " µm only";
        if (!valid && opts.strict) return {
            n: NaN,
            kappa: NaN,
            alpha: NaN,
            valid,
            message
        };
        return {
            n: nt.re,
            kappa: nt.im,
            alpha: 2 * nt.im * omega / C0,
            valid,
            message
        };
    }

    /** Complex propagation constant k(ω) = ω ñ(ω)/c (rad/m). */
    function kOmega(spec, omega) {
        const nt = complexIndex(spec, omega);
        return core.complex.cx(omega * nt.re / C0, omega * nt.im / C0);
    }

    /**
     * Dispersion parameters at vacuum wavelength λ0 from central differences of Re k(ω)
     * (step h = relStep·ω0, default 2e-3; error O(h²)).
     * Returns { lambda0, omega0, n, kappa, ng, vp, vg, beta0, beta1, beta2, beta3, alpha,
     *           dndl (1/m), d2ndl2 (1/m²), valid }. β in SI: s/m, s²/m, s³/m.
     */
    function dispersionAt(spec, lambda0, opts = {}) {
        const mat = resolveMaterial(spec);
        const w0 = TWO_PI * C0 / lambda0;
        const h = (opts.relStep || 2e-3) * w0;
        const K = (w) => kOmega(mat, w).re;
        const k0 = K(w0),
            kp1 = K(w0 + h),
            km1 = K(w0 - h),
            kp2 = K(w0 + 2 * h),
            km2 = K(w0 - 2 * h);
        // 4th-order accurate first and second derivatives, 2nd-order third derivative
        const beta1 = (-kp2 + 8 * kp1 - 8 * km1 + km2) / (12 * h);
        const beta2 = (-kp2 + 16 * kp1 - 30 * k0 + 16 * km1 - km2) / (12 * h * h);
        const beta3 = (kp2 - 2 * kp1 + 2 * km1 - km2) / (2 * h * h * h);
        const nt = complexIndex(mat, w0);
        const n = nt.re;
        const ng = beta1 * C0;
        // wavelength derivatives (for prisms): n(λ) by central differences
        const hl = (opts.relStep || 2e-3) * lambda0;
        const N = (l) => complexIndex(mat, TWO_PI * C0 / l).re;
        const np = N(lambda0 + hl),
            nm = N(lambda0 - hl);
        return {
            lambda0,
            omega0: w0,
            n,
            kappa: nt.im,
            ng,
            vp: C0 / n,
            vg: 1 / beta1,
            beta0: k0,
            beta1,
            beta2,
            beta3,
            alpha: 2 * nt.im * w0 / C0,
            dndl: (np - nm) / (2 * hl),
            d2ndl2: (np - 2 * n + nm) / (hl * hl),
            valid: inRange(mat, lambda0) && Number.isFinite(n)
        };
    }

    /** Wavelengths (m) inside [lo, hi] where β2 changes sign (zero-dispersion wavelengths). */
    function zeroGVD(spec, lo, hi) {
        const mat = resolveMaterial(spec);
        lo = lo || mat.range[0];
        hi = hi || mat.range[1];
        if (!Number.isFinite(hi)) return [];
        const f = (l) => dispersionAt(mat, l).beta2;
        return core.findRoots(f, lo, hi, 400, 1e-13);
    }

    // ================================================================ Kramers–Kronig
    /**
     * Rebuild n(ω) from κ(ω) with the Kramers–Kronig relation for ñ − n∞ (analytic in the upper half plane):
     *     n(ω) − n∞ = (2/π) P ∫₀^∞ ω' κ(ω') / (ω'² − ω²) dω'.
     * The principal value uses 1/(ω'²−ω²) = [1/(ω'−ω) − 1/(ω'+ω)]/(2ω) with singularity subtraction on a
     * uniform grid 0…omegaMax (M points). kappaFn(ω) → κ. Returns Float64Array of n at each ω in omegas.
     */
    function kramersKronigN(kappaFn, omegas, opts = {}) {
        const nInf = opts.nInf == null ? 1 : opts.nInf;
        const W = opts.omegaMax;
        const M = opts.points || 20000;
        const dw = W / (M - 1);
        const f = new Float64Array(M);
        for (let j = 0; j < M; j++) {
            const w = j * dw;
            f[j] = w * kappaFn(w);
        }
        const out = new Float64Array(omegas.length);
        for (let i = 0; i < omegas.length; i++) {
            const w = omegas[i];
            const fw = w * kappaFn(w);
            const d = 1e-4 * w;
            const fpw = ((w + d) * kappaFn(w + d) - (w - d) * kappaFn(w - d)) / (2 * d);
            let s1 = 0,
                s2 = 0; // s1: ∫ (f − f(ω))/(ω' − ω), s2: ∫ f/(ω' + ω)
            for (let j = 0; j < M; j++) {
                const wp = j * dw;
                const wt = (j === 0 || j === M - 1) ? 0.5 : 1;
                const diff = wp - w;
                s1 += wt * (Math.abs(diff) < 1e-9 * w ? fpw : (f[j] - fw) / diff);
                s2 += wt * f[j] / (wp + w);
            }
            s1 = s1 * dw + fw * Math.log((W - w) / w);
            s2 *= dw;
            out[i] = nInf + (2 / Math.PI) * (s1 - s2) / (2 * w);
        }
        return out;
    }

    // ================================================================ prism
    /**
     * Prism of apex angle A (rad), index n, in air. Returns the minimum-deviation geometry:
     * { deltaMin, theta1 (incidence at min deviation), inner (= A/2) }.
     */
    function prismMinDeviation(n, A) {
        const s = n * Math.sin(A / 2);
        if (s >= 1) return {
            deltaMin: NaN,
            theta1: NaN,
            inner: A / 2
        };
        const theta1 = Math.asin(s);
        return {
            deltaMin: 2 * theta1 - A,
            theta1,
            inner: A / 2
        };
    }

    /** Deviation δ(θ1) = θ1 + θ4 − A for index n and apex A (NaN on total internal reflection). */
    function prismDeviation(n, A, theta1) {
        const t2 = Math.asin(Math.sin(theta1) / n);
        const t3 = A - t2;
        const s4 = n * Math.sin(t3);
        if (Math.abs(s4) > 1) return NaN;
        return theta1 + Math.asin(s4) - A;
    }

    /** Angular dispersion at minimum deviation: dδ/dλ = 2 sin(A/2)/cos((δmin + A)/2) · dn/dλ (rad/m). */
    function prismAngularDispersion(n, dndl, A) {
        const g = prismMinDeviation(n, A);
        return 2 * Math.sin(A / 2) / Math.cos((g.deltaMin + A) / 2) * dndl;
    }

    /**
     * GDD of a Brewster/minimum-deviation prism pair (Fork, Martinez & Gordon 1984) in the limit where the beam
     * grazes the prism apexes: GDD ≈ (λ³/2πc²)·d²P/dλ² with d²P/dλ² ≈ −8 L (dn/dλ)², plus the material GDD of
     * a total glass path Lg: β2·Lg. L = apex-to-apex separation (m). Returns s².
     */
    function prismPairGDD(spec, lambda0, L, Lg = 0) {
        const d = dispersionAt(spec, lambda0);
        const angular = -(lambda0 ** 3) / (TWO_PI * C0 * C0) * 8 * L * d.dndl * d.dndl;
        return {
            angular,
            material: d.beta2 * Lg,
            total: angular + d.beta2 * Lg
        };
    }

    // ================================================================ pulses
    const FWHM_PER_TAU0 = 2 * Math.sqrt(Math.LN2);
    /** τ0 (1/e intensity half-width) ↔ intensity FWHM for a Gaussian. */
    const tau0FromFwhm = (fwhm) => fwhm / FWHM_PER_TAU0;
    const fwhmFromTau0 = (tau0) => tau0 * FWHM_PER_TAU0;
    /** Analytic Gaussian duration (1/e intensity half-width) after total GDD φ2 (s²). */
    const gaussianTau = (tau0, gdd) => tau0 * Math.sqrt(1 + (gdd / (tau0 * tau0)) ** 2);
    /** Dispersion length L_D = τ0²/|β2|. */
    const dispersionLength = (tau0, beta2) => tau0 * tau0 / Math.abs(beta2);

    /**
     * Spectral phase model φ(Ω) accumulated over z (without the frame term), complex:
     *   exact:  k(ω0+Ω)·z                      (complex; Im part = loss)
     *   taylor: [b0 β0 + b1 β1 Ω + b2 β2 Ω²/2 + b3 β3 Ω³/6]·z  (real; β at ω0 from the exact model)
     */
    function makePhaseFn(mat, lambda0, z, mode, terms, disp) {
        const w0 = TWO_PI * C0 / lambda0;
        if (mode === "taylor") {
            const t = Object.assign({
                b0: true,
                b1: true,
                b2: true,
                b3: true
            }, terms || {});
            return (Om) => ({
                re: z * ((t.b0 ? disp.beta0 : 0) + (t.b1 ? disp.beta1 * Om : 0) + (t.b2 ? disp.beta2 * Om * Om / 2 : 0) + (t.b3 ? disp.beta3 * Om * Om * Om / 6 : 0)),
                im: 0
            });
        }
        return (Om) => {
            const w = w0 + Om;
            if (!(w > 0)) return {
                re: NaN,
                im: NaN
            };
            const k = kOmega(mat, w);
            return {
                re: k.re * z,
                im: k.im * z
            };
        };
    }

    function frameInverseVelocity(frame, disp) {
        if (frame === "vacuum") return 1 / C0;
        if (frame === "phase") return disp.beta0 / disp.omega0;
        return disp.beta1; // co-moving with the group velocity at ω0
    }

    /** Pulse metrics of a sampled envelope on times t (s): energy, centroid, rms, FWHM, peak |A|². */
    function pulseMetrics(t, re, im) {
        const N = t.length;
        let E = 0,
            m1 = 0,
            pk = 0,
            ipk = 0;
        for (let i = 0; i < N; i++) {
            const I = re[i] * re[i] + im[i] * im[i];
            E += I;
            m1 += I * t[i];
            if (I > pk) {
                pk = I;
                ipk = i;
            }
        }
        const dt = N > 1 ? t[1] - t[0] : 1;
        const cen = E > 0 ? m1 / E : 0;
        let m2 = 0;
        for (let i = 0; i < N; i++) m2 += (re[i] * re[i] + im[i] * im[i]) * (t[i] - cen) ** 2;
        const rms = E > 0 ? Math.sqrt(m2 / E) : 0;
        // FWHM: outermost half-maximum crossings, linearly interpolated
        const half = pk / 2;
        const I = (i) => re[i] * re[i] + im[i] * im[i];
        let a = 0,
            b = N - 1;
        while (a < N - 1 && I(a) < half) a++;
        while (b > 0 && I(b) < half) b--;
        let fwhm = NaN;
        if (a > 0 && b < N - 1 && b >= a) {
            const ta = t[a - 1] + (half - I(a - 1)) / (I(a) - I(a - 1)) * dt;
            const tb = t[b] + (I(b) - half) / (I(b) - I(b + 1)) * dt;
            fwhm = tb - ta;
        }
        return {
            energy: E * dt,
            centroid: cen,
            rms,
            tauRms: Math.SQRT2 * rms,
            fwhm,
            peak: pk,
            tPeak: t[ipk]
        };
    }

    /**
     * Propagate a Gaussian pulse (optionally pre-chirped) through length z of a material by FFT.
     * opts: { material, lambda0 (m), fwhm (s, transform-limited intensity FWHM), gdd0 (s², input chirp),
     *         z (m, may be negative = inverse propagation), mode "exact" | "taylor",
     *         terms {b0, b1, b2, b3} (taylor), frame "group" | "vacuum" | "phase", maxN = 65536 }
     * Displayed time is the retarded time τ = t − z/v_frame. Returns
     * { N, dt, tIn, tOut (Float64Array, ascending), inRe, inIm, outRe, outIm, omega (ascending ω, rad/s),
     *   specIn, specOut (|Ã|², peak-normalised to the input), phaseOut (rad, applied spectral phase incl. chirp),
     *   metricsIn, metricsOut, disp, tau0, lossless, transmission, fractionOutside, dropped, undersampled,
     *   carrierPhase (rad, φ of the ω0 component of the output = CE phase slip), frameDelay, groupDelay, phaseDelay,
     *   evalEnvelope(which, taus) }
     */
    function propagatePulse(opts) {
        const mat = resolveMaterial(opts.material);
        const lambda0 = opts.lambda0;
        const w0 = TWO_PI * C0 / lambda0;
        const tau0 = tau0FromFwhm(opts.fwhm);
        const gdd0 = opts.gdd0 || 0;
        const z = opts.z || 0;
        const mode = opts.mode === "taylor" ? "taylor" : "exact";
        const disp = dispersionAt(mat, lambda0);
        const invVf = frameInverseVelocity(opts.frame || "group", disp);
        const phaseFn = makePhaseFn(mat, lambda0, z, mode, opts.terms, disp);
        const maxN = opts.maxN || 65536;

        // total spectral phase (real part) incl. chirp and frame term, and log-amplitude from Im k
        const totalPhase = (Om) => {
            const p = phaseFn(Om);
            return {
                re: p.re - (w0 + Om) * invVf * z + gdd0 * Om * Om / 2,
                im: p.im
            };
        };

        // window sizing from the group-delay spread over the significant band |Ω| ≤ 5/τ0 (|Ã| > e^-12.5)
        const band = 5 / tau0;
        let gdMin = Infinity,
            gdMax = -Infinity,
            gdInMin = Infinity,
            gdInMax = -Infinity;
        const nb = 121,
            hb = band / 2000;
        for (let i = 0; i < nb; i++) {
            const Om = -band + 2 * band * i / (nb - 1);
            if (!(w0 + Om - hb > 0)) continue;
            const g = (totalPhase(Om + hb).re - totalPhase(Om - hb).re) / (2 * hb);
            if (Number.isFinite(g)) {
                gdMin = Math.min(gdMin, g);
                gdMax = Math.max(gdMax, g);
            }
            const gi = gdd0 * Om;
            gdInMin = Math.min(gdInMin, gi);
            gdInMax = Math.max(gdInMax, gi);
        }
        if (!Number.isFinite(gdMin)) {
            gdMin = 0;
            gdMax = 0;
        }
        const spanOut = gdMax - gdMin,
            spanIn = gdInMax - gdInMin;
        const T = 1.25 * Math.max(spanOut, spanIn) + 20 * tau0;
        let dt = Math.PI * tau0 / 10; // Ω-grid covers ±10/τ0
        let N = core.nextPow2(Math.ceil(T / dt));
        N = Math.max(512, N);
        let undersampled = false;
        if (N > maxN) {
            N = maxN;
            dt = T / N;
            undersampled = Math.PI / dt < 6 / tau0;
        }
        const tCenterOut = (gdMin + gdMax) / 2;
        const tCenterIn = (gdInMin + gdInMax) / 2;

        // unshifted time grid s_n (n dt for n < N/2, (n − N) dt otherwise) and Ω_k = −2π f_k
        const f = core.fftFreq(N, dt);
        const Om = new Float64Array(N);
        for (let k = 0; k < N; k++) Om[k] = -TWO_PI * f[k];
        // transform-limited input spectrum: FFT of A(s) = exp(−s²/(2τ0²)) is real, positive and Gaussian
        const xr = new Float64Array(N),
            xi = new Float64Array(N);
        for (let n = 0; n < N; n++) {
            const s = (n < N / 2 ? n : n - N) * dt;
            xr[n] = Math.exp(-s * s / (2 * tau0 * tau0));
        }
        core.fft(xr, xi);

        const inR = new Float64Array(N),
            inI = new Float64Array(N);
        const outR = new Float64Array(N),
            outI = new Float64Array(N);
        const phase = new Float64Array(N),
            logAmp = new Float64Array(N);
        let eTot = 0,
            eOut = 0,
            eDropped = 0,
            eOutside = 0;
        for (let k = 0; k < N; k++) {
            const a = xr[k]; // imaginary part ≈ 0 by symmetry
            const w = w0 + Om[k];
            const e = a * a;
            eTot += e;
            const lam = TWO_PI * C0 / w;
            if (!(w > 0) || !inRange(mat, lam)) eOutside += e;
            // input at z = 0: chirp only. Sampling τ = t_c + s means X·exp(−iΩ t_c) (A(τ) = (1/N) Σ X e^{−iΩτ}).
            const pIn = gdd0 * Om[k] * Om[k] / 2 - Om[k] * tCenterIn;
            inR[k] = a * Math.cos(pIn);
            inI[k] = a * Math.sin(pIn);
            const tp = totalPhase(Om[k]);
            if (!Number.isFinite(tp.re) || !Number.isFinite(tp.im)) {
                eDropped += e;
                phase[k] = NaN;
                logAmp[k] = -Infinity;
                continue;
            }
            const amp = a * Math.exp(-tp.im);
            const ph = tp.re - Om[k] * tCenterOut;
            outR[k] = amp * Math.cos(ph);
            outI[k] = amp * Math.sin(ph);
            eOut += amp * amp;
            phase[k] = tp.re;
            logAmp[k] = -tp.im;
        }
        const specX = {
            re: Float64Array.from(outR),
            im: Float64Array.from(outI)
        };
        const specXin = {
            re: Float64Array.from(inR),
            im: Float64Array.from(inI)
        };
        core.ifft(inR, inI);
        core.ifft(outR, outI);

        // reorder to ascending time
        const half = N / 2;
        const tIn = new Float64Array(N),
            tOut = new Float64Array(N);
        const aInR = new Float64Array(N),
            aInI = new Float64Array(N),
            aOutR = new Float64Array(N),
            aOutI = new Float64Array(N);
        for (let i = 0; i < N; i++) {
            const n = (i + half) % N; // i = 0 ↔ s = −N/2·dt
            const s = (i - half) * dt;
            tIn[i] = s + tCenterIn;
            tOut[i] = s + tCenterOut;
            aInR[i] = inR[n];
            aInI[i] = inI[n];
            aOutR[i] = outR[n];
            aOutI[i] = outI[n];
        }
        // ascending ω arrays for the spectrum plots
        const order = Array.from({
            length: N
        }, (_, k) => k).sort((p, q) => Om[p] - Om[q]);
        const omega = new Float64Array(N),
            specIn = new Float64Array(N),
            specOut = new Float64Array(N),
            phaseOut = new Float64Array(N);
        let a0 = 0;
        for (let k = 0; k < N; k++) a0 = Math.max(a0, xr[k] * xr[k]);
        for (let j = 0; j < N; j++) {
            const k = order[j];
            omega[j] = w0 + Om[k];
            specIn[j] = xr[k] * xr[k] / a0;
            specOut[j] = Number.isFinite(logAmp[k]) ? specIn[j] * Math.exp(2 * logAmp[k]) : 0;
            phaseOut[j] = phase[k];
        }
        // carrier phase at ω0 (Ω = 0 sample): what the carrier under the envelope has accumulated in this frame
        const p0 = totalPhase(0);
        const metricsIn = pulseMetrics(tIn, aInR, aInI);
        const metricsOut = pulseMetrics(tOut, aOutR, aOutI);

        function evalEnvelope(which, taus) {
            const X = which === "in" ? specXin : specX;
            const tc = which === "in" ? tCenterIn : tCenterOut;
            let amax = 0;
            for (let k = 0; k < N; k++) amax = Math.max(amax, X.re[k] * X.re[k] + X.im[k] * X.im[k]);
            const idx = [];
            for (let k = 0; k < N; k++)
                if (X.re[k] * X.re[k] + X.im[k] * X.im[k] > amax * 1e-14) idx.push(k);
            const re = new Float64Array(taus.length),
                im = new Float64Array(taus.length);
            for (let i = 0; i < taus.length; i++) {
                const s = taus[i] - tc;
                let sr = 0,
                    si = 0;
                for (const k of idx) {
                    const c = Math.cos(Om[k] * s),
                        sn = -Math.sin(Om[k] * s);
                    sr += X.re[k] * c - X.im[k] * sn;
                    si += X.re[k] * sn + X.im[k] * c;
                }
                re[i] = sr / N;
                im[i] = si / N;
            }
            return {
                re,
                im
            };
        }

        // refine the FWHM crossings with the band-limited (exact-interpolation) envelope
        function refineFwhm(which, m, t) {
            if (!Number.isFinite(m.fwhm)) return;
            const half = m.peak / 2;
            const I = (tau) => {
                const v = evalEnvelope(which, [tau]);
                return v.re[0] * v.re[0] + v.im[0] * v.im[0];
            };
            const cross = (tA, tB) => { // I(tA) < half ≤ I(tB) or reverse
                let fa = I(tA) - half;
                for (let it = 0; it < 48; it++) {
                    const tm = 0.5 * (tA + tB),
                        fm = I(tm) - half;
                    if ((fm < 0) === (fa < 0)) {
                        tA = tm;
                        fa = fm;
                    } else tB = tm;
                }
                return 0.5 * (tA + tB);
            };
            const N2 = t.length;
            const Is = (i) => {
                const r = which === "in" ? [aInR, aInI] : [aOutR, aOutI];
                return r[0][i] * r[0][i] + r[1][i] * r[1][i];
            };
            let a = 0,
                b = N2 - 1;
            while (a < N2 - 1 && Is(a) < half) a++;
            while (b > 0 && Is(b) < half) b--;
            if (a < 1 || b > N2 - 2) return;
            m.fwhm = cross(t[b + 1], t[b]) - cross(t[a - 1], t[a]);
        }
        refineFwhm("in", metricsIn, tIn);
        refineFwhm("out", metricsOut, tOut);

        const lossless = mode === "taylor" || mat.kind !== "lorentz";
        return {
            N,
            dt,
            tIn,
            tOut,
            inRe: aInR,
            inIm: aInI,
            outRe: aOutR,
            outIm: aOutI,
            omega,
            specIn,
            specOut,
            phaseOut,
            metricsIn,
            metricsOut,
            disp,
            tau0,
            mode,
            lossless,
            transmission: eTot > 0 ? eOut / eTot : 0,
            fractionOutside: eTot > 0 ? eOutside / eTot : 0,
            dropped: eTot > 0 ? eDropped / eTot : 0,
            undersampled,
            frameInvV: invVf,
            carrierPhase: p0.re,
            frameDelay: z * invVf,
            groupDelay: z * disp.beta1,
            phaseDelay: z * disp.n / C0,
            evalEnvelope,
            _spec: {
                Om,
                X: specX,
                tCenterOut,
                totalPhase
            }
        };
    }

    /**
     * Inverse propagation check: take the output spectrum of a propagatePulse result and remove the same phase
     * (and restore the loss), sampling on the input grid. Returns { re, im, maxError, relError } versus the input.
     */
    function backPropagate(res) {
        const {
            Om,
            X,
            tCenterOut,
            totalPhase
        } = res._spec;
        const N = res.N;
        const tCenterIn = res.tIn[N / 2];
        const r = new Float64Array(N),
            im = new Float64Array(N);
        for (let k = 0; k < N; k++) {
            const tp = totalPhase(Om[k]);
            if (!Number.isFinite(tp.re)) continue;
            // undo exp(iφ_total − iΩ t_out) (φ_total includes the input chirp), undo the loss, re-centre on the input grid
            const ph = -(tp.re - Om[k] * tCenterOut) - Om[k] * tCenterIn;
            const g = Math.exp(tp.im);
            const c = Math.cos(ph),
                s = Math.sin(ph);
            r[k] = g * (X.re[k] * c - X.im[k] * s);
            im[k] = g * (X.re[k] * s + X.im[k] * c);
        }
        core.ifft(r, im);
        const half = N / 2;
        const oR = new Float64Array(N),
            oI = new Float64Array(N);
        for (let i = 0; i < N; i++) {
            const n = (i + half) % N;
            oR[i] = r[n];
            oI[i] = im[n];
        }
        // compare with the transform-limited input (chirp was part of totalPhase, so back-propagation removes it too)
        let maxErr = 0,
            pk = 0;
        for (let i = 0; i < N; i++) {
            const s = res.tIn[i] - tCenterIn;
            const ref = Math.exp(-s * s / (2 * res.tau0 * res.tau0));
            pk = Math.max(pk, ref);
            maxErr = Math.max(maxErr, Math.hypot(oR[i] - ref, oI[i]));
        }
        return {
            re: oR,
            im: oI,
            maxError: maxErr,
            relError: maxErr / pk
        };
    }

    /**
     * Largest deviation (rad) between the exact spectral phase k(ω)z and its Taylor series through β3 over the
     * band where the input spectral intensity exceeds `floor` (default 1e-3). A measure of Taylor validity.
     */
    function taylorResidual(spec, lambda0, fwhm, z, floor = 1e-3) {
        const mat = resolveMaterial(spec);
        const disp = dispersionAt(mat, lambda0);
        const tau0 = tau0FromFwhm(fwhm);
        const band = Math.sqrt(-Math.log(floor)) / tau0; // |Ã|² = exp(−Ω²τ0²) = floor
        const ex = makePhaseFn(mat, lambda0, z, "exact", null, disp);
        const ty = makePhaseFn(mat, lambda0, z, "taylor", null, disp);
        let worst = 0;
        for (let i = 0; i <= 200; i++) {
            const Om = -band + 2 * band * i / 200;
            const d = Math.abs(ex(Om).re - ty(Om).re);
            if (Number.isFinite(d)) worst = Math.max(worst, d);
        }
        return worst;
    }

    return {
        MATERIALS,
        DEFAULT_LORENTZ,
        resolveMaterial,
        sellmeierN,
        lorentzEps,
        complexIndex,
        indexAt,
        inRange,
        kOmega,
        dispersionAt,
        zeroGVD,
        kramersKronigN,
        prismMinDeviation,
        prismDeviation,
        prismAngularDispersion,
        prismPairGDD,
        FWHM_PER_TAU0,
        tau0FromFwhm,
        fwhmFromTau0,
        gaussianTau,
        dispersionLength,
        pulseMetrics,
        propagatePulse,
        backPropagate,
        taylorResidual
    };
});