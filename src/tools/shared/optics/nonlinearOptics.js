/*
 * Nonlinear optics: second-harmonic generation (SHG) with phase matching, and Kerr self-phase
 * modulation / solitons with a symmetric split-step Fourier solver (pure, DOM-free).
 *
 * Browser: <script src="../shared/optics/nonlinearOptics.js"></script> → window.OpticsModels.nonlinearOptics
 * Node:    const nlo = require(".../shared/optics/nonlinearOptics.js")
 *
 * Conventions (TEMPLATE.md §5): SI internally, λ = vacuum wavelength, E = Re{A exp[i(kz − ωt)]}
 * with A the PEAK phasor amplitude, time-averaged intensity I = n ε0 c |A|²/2.
 *
 * --------------------------------------------------------------------------------------------
 * 1. SHG coupled-amplitude equations (plane wave, CW, lossless, slowly varying envelope,
 *    Kleinman symmetry, collinear, no walk-off). ω1 = ω, ω2 = 2ω, Δk = k2 − 2k1.
 *    Peak phasors obey
 *        dA1/dz = i (ω1 d_eff / (n1 c)) A2 A1* e^{+iΔk z}
 *        dA2/dz = i (ω1 d_eff / (n2 c)) A1²    e^{−iΔk z}
 *    We integrate the intensity-normalised amplitudes  a_j = sqrt(n_j ε0 c / 2) A_j,  so that
 *    |a_j|² = I_j (W/m²) exactly. In these variables the two equations share ONE coupling
 *        κ = ω1 d_eff sqrt(2 / (n1² n2 ε0 c³))         [units m⁻¹ (W/m²)^(−1/2)]
 *        da1/dz = i κ s(z) a2 a1* e^{+iΔk z},   da2/dz = i κ s(z) a1² e^{−iΔk z}
 *    where s(z) = ±1 is the sign of d(z) (s ≡ 1 for a homogeneous crystal, a square wave of
 *    period Λ for periodic poling). With the same κ in both equations d(|a1|² + |a2|²)/dz = 0
 *    identically (energy conservation with pump depletion), and the photon fluxes
 *    N_j = I_j/(ħ ω_j) obey the Manley–Rowe relation N1 + 2 N2 = const.
 *    Closed forms used only as benchmarks (tests), never inside the solver:
 *      undepleted  η = I2/I1(0) = (Γ L)² sinc²(ΔkL/2),  Γ = κ sqrt(I1(0))
 *      Δk = 0, depleted:  η = tanh²(Γ L)          (Armstrong et al. 1962)
 * 2. Birefringent phase matching, type I (o + o → e) in negative uniaxial crystals:
 *        1/n_e(θ)² = cos²θ/n_o² + sin²θ/n_e²,   n_e(2ω, θ_pm) = n_o(ω)
 *    Quasi-phase matching: first-order period Λ = 2π/Δk (d_eff → (2/π) d33 on average).
 * 3. NLSE for the pulse envelope A(z, T) (√W), retarded time T = t − β1 z (Agrawal convention):
 *        ∂A/∂z = −(i β2/2) ∂²A/∂T² + i γ |A|² A
 *    Symmetric split step: half linear step in the Fourier domain (exact, exp(i β2 Ω² h/4)),
 *    full nonlinear step (exact, exp(iγ|A|² h)), half linear step. Global error O(h²).
 *    Fundamental soliton (β2 < 0, N = 1): A = √P0 sech(T/T0) exp(i γ P0 z / 2), γ P0 T0² = |β2|.
 * --------------------------------------------------------------------------------------------
 */
(function(root, factory) {
    const m = factory(root);
    if (typeof module === "object" && module.exports) module.exports = m;
    else {
        root.OpticsModels = root.OpticsModels || {};
        root.OpticsModels.nonlinearOptics = m;
    }
})(typeof self !== "undefined" ? self : this, function(root) {
    "use strict";
    const core = (typeof require === "function" && typeof module === "object") ?
        require("./core.js") : root.OpticsModels.core;
    const {
        c: C0,
        eps0: EPS0,
        hbar: HBAR
    } = core.constants;
    const TWO_PI = 2 * Math.PI;
    const PM = 1e-12; // pm/V → m/V

    // ================================================================ crystal data
    // Sellmeier forms with λ in µm. Each entry cites its source; d-coefficients are |values| at
    // 1064 nm from Nikogosyan, "Nonlinear Optical Crystals: A Complete Survey" (Springer 2005).
    const CRYSTALS = Object.freeze({
        bbo: Object.freeze({
            id: "bbo",
            name: "β-BaB₂O₄ (BBO)",
            type: "birefringent",
            sign: "negative",
            // D. Eimerl, L. Davis, S. Velsko, E. K. Graham, A. Zalkin, J. Appl. Phys. 62, 1968 (1987)
            no: (l) => Math.sqrt(2.7359 + 0.01878 / (l * l - 0.01822) - 0.01354 * l * l),
            ne: (l) => Math.sqrt(2.3753 + 0.01224 / (l * l - 0.01667) - 0.01516 * l * l),
            range: [0.22e-6, 1.06e-6 * 3],
            d: {
                d22: 2.2,
                d31: 0.04
            },
            // type I ooe: d_eff = d31 sinθ − d22 cosθ sin3φ, with φ = 90° chosen to maximise |d_eff|
            dEff: (th) => (0.04 * Math.sin(th) + 2.2 * Math.cos(th)) * PM,
            ref: "Sellmeier: Eimerl et al., J. Appl. Phys. 62, 1968 (1987); d22 = 2.2 pm/V, d31 = 0.04 pm/V (Nikogosyan 2005)"
        }),
        kdp: Object.freeze({
            id: "kdp",
            name: "KH₂PO₄ (KDP)",
            type: "birefringent",
            sign: "negative",
            // F. Zernike, J. Opt. Soc. Am. 54, 1215 (1964)
            no: (l) => Math.sqrt(2.259276 + 0.01008956 / (l * l - 0.012942625) + 13.00522 * l * l / (l * l - 400)),
            ne: (l) => Math.sqrt(2.132668 + 0.008637494 / (l * l - 0.012281043) + 3.2279924 * l * l / (l * l - 400)),
            range: [0.2e-6, 1.5e-6],
            d: {
                d36: 0.39
            },
            // type I ooe: d_eff = d36 sinθ sin2φ, φ = 45°
            dEff: (th) => 0.39 * Math.sin(th) * PM,
            ref: "Sellmeier: Zernike, J. Opt. Soc. Am. 54, 1215 (1964); d36 = 0.39 pm/V (Nikogosyan 2005)"
        }),
        ppln: Object.freeze({
            id: "ppln",
            name: "Periodically poled LiNbO₃ (congruent, e + e → e)",
            type: "qpm",
            // D. E. Zelmon, D. L. Small, D. Jundt, J. Opt. Soc. Am. B 14, 3319 (1997), extraordinary index
            ne: (l) => Math.sqrt(1 + 2.9804 * l * l / (l * l - 0.02047) + 0.5981 * l * l / (l * l - 0.0666) + 8.9543 * l * l / (l * l - 416.08)),
            no: (l) => Math.sqrt(1 + 2.6734 * l * l / (l * l - 0.01764) + 1.2290 * l * l / (l * l - 0.05914) + 12.614 * l * l / (l * l - 474.60)),
            range: [0.4e-6, 5.0e-6],
            d: {
                d33: 25
            },
            dEff: () => 25 * PM,
            ref: "Sellmeier: Zelmon, Small & Jundt, J. Opt. Soc. Am. B 14, 3319 (1997); d33 ≈ 25 pm/V (Shoji et al., JOSA B 14, 2268 (1997))"
        })
    });

    function crystal(id) {
        const c = CRYSTALS[id];
        if (!c) throw new RangeError("unknown crystal " + id);
        return c;
    }

    /** Principal indices at vacuum wavelength λ (m). */
    function indices(id, lambda) {
        const c = crystal(id),
            l = lambda * 1e6;
        return {
            no: c.no(l),
            ne: c.ne(l)
        };
    }

    /** Extraordinary index at polar angle θ (rad) from the optic axis. */
    function neTheta(no, ne, theta) {
        const c = Math.cos(theta),
            s = Math.sin(theta);
        return 1 / Math.sqrt(c * c / (no * no) + s * s / (ne * ne));
    }

    /**
     * Type I (o + o → e) collinear phase-matching angle for SHG of λ1 in a negative uniaxial crystal:
     * sin²θ = (no(ω)⁻² − no(2ω)⁻²)/(ne(2ω)⁻² − no(2ω)⁻²). Returns NaN when no angle exists.
     */
    function typeIAngle(id, lambda1) {
        const a = indices(id, lambda1),
            b = indices(id, lambda1 / 2);
        const s2 = (a.no ** -2 - b.no ** -2) / (b.ne ** -2 - b.no ** -2);
        return (s2 >= 0 && s2 <= 1) ? Math.asin(Math.sqrt(s2)) : NaN;
    }

    /**
     * Phase-mismatch and material parameters for SHG of λ1.
     * birefringent: type I, θ in rad (fundamental o, SH e(θ)); qpm: e + e → e (θ = 90°).
     * Returns { n1, n2, dk, dEff, theta, walkoff, lc (coherence length π/|Δk|), period (2π/|Δk|) }.
     */
    function shgParams(id, lambda1, theta) {
        const c = crystal(id);
        const a = indices(id, lambda1),
            b = indices(id, lambda1 / 2);
        let n1, n2, walkoff = 0,
            th = theta;
        if (c.type === "qpm") {
            n1 = a.ne;
            n2 = b.ne;
            th = Math.PI / 2;
        } else {
            n1 = a.no;
            n2 = neTheta(b.no, b.ne, theta);
            // Poynting-vector walk-off of the e-wave: tan ρ = (n_e(θ)²/2)(1/ne² − 1/no²) sin 2θ
            walkoff = Math.atan(n2 * n2 / 2 * (1 / (b.ne * b.ne) - 1 / (b.no * b.no)) * Math.sin(2 * theta));
        }
        const k0 = TWO_PI / lambda1;
        const dk = 2 * k0 * (n2 - n1); // k2 − 2k1 = (2ω/c)(n2 − n1)
        return {
            n1,
            n2,
            dk,
            dEff: c.dEff(th),
            theta: th,
            walkoff,
            lc: Math.PI / Math.abs(dk),
            period: TWO_PI / Math.abs(dk)
        };
    }

    /** Coupling κ (m⁻¹ (W/m²)^−1/2) of the intensity-normalised equations. */
    function kappa(dEff, lambda1, n1, n2) {
        const w1 = TWO_PI * C0 / lambda1;
        return w1 * dEff * Math.sqrt(2 / (n1 * n1 * n2 * EPS0 * C0 * C0 * C0));
    }

    /** dΔk/dθ by central difference (rad⁻¹ m⁻¹) — used for angular acceptance. */
    function dDkdTheta(id, lambda1, theta, h = 1e-6) {
        return (shgParams(id, lambda1, theta + h).dk - shgParams(id, lambda1, theta - h).dk) / (2 * h);
    }

    // ================================================================ SHG solver
    /**
     * Integrate the coupled SHG equations with core.rk4Step.
     * opts: { kappa, dk, L, I0 (W/m²), steps (total RK4 steps for a homogeneous crystal),
     *   qpm: { period, stepsPerDomain = 8 } | null,  a2in: [re, im] seed (default 0),
     *   record = 400 (max number of recorded z samples; 0 → end only) }
     * Returns { z, I1, I2, a1, a2 (end), eta, energyError (max |ΣI − I0|/I0), mrError (max
     *   |N1 + 2N2 − N1(0)|/N1(0)), steps }.
     */
    function solveSHG(opts) {
        const {
            kappa: K,
            dk,
            L,
            I0
        } = opts;
        const qpm = opts.qpm && opts.qpm.period > 0 ? opts.qpm : null;
        const rec = opts.record == null ? 400 : opts.record;
        // segments of constant sign
        let segs;
        if (qpm) {
            const half = qpm.period / 2;
            const nDom = Math.ceil(L / half - 1e-9);
            segs = [];
            for (let i = 0; i < nDom; i++) segs.push({
                z0: i * half,
                z1: Math.min(L, (i + 1) * half),
                s: i % 2 === 0 ? 1 : -1
            });
        } else segs = [{
            z0: 0,
            z1: L,
            s: 1
        }];
        const stepsFor = (seg) => qpm ?
            Math.max(1, Math.round((qpm.stepsPerDomain || 8) * (seg.z1 - seg.z0) / (qpm.period / 2))) :
            Math.max(1, Math.round(opts.steps || 200));
        let totalSteps = 0;
        for (const s of segs) totalSteps += stepsFor(s);
        const every = rec > 0 ? Math.max(1, Math.ceil(totalSteps / rec)) : Infinity;

        let y = Float64Array.of(Math.sqrt(I0), 0, opts.a2in ? opts.a2in[0] : 0, opts.a2in ? opts.a2in[1] : 0);
        const zs = [0],
            I1 = [y[0] * y[0] + y[1] * y[1]],
            I2 = [y[2] * y[2] + y[3] * y[3]];
        const Itot0 = I1[0] + I2[0];
        // photon fluxes in units of 1/(ħω1): N1 = I1, N2 = I2/2 (ω2 = 2ω1)
        const N0 = I1[0] + 2 * (I2[0] / 2);
        let eErr = 0,
            mrErr = 0,
            count = 0;
        for (const seg of segs) {
            const sK = seg.s * K;
            const f = (z, u) => {
                // e^{iΔk z}
                const cph = Math.cos(dk * z),
                    sph = Math.sin(dk * z);
                // a2 a1* e^{iΔkz}
                const pr = u[2] * u[0] + u[3] * u[1],
                    pi = u[3] * u[0] - u[2] * u[1];
                const qr = pr * cph - pi * sph,
                    qi = pr * sph + pi * cph;
                // a1² e^{−iΔkz}
                const sr = u[0] * u[0] - u[1] * u[1],
                    si = 2 * u[0] * u[1];
                const tr = sr * cph + si * sph,
                    ti = si * cph - sr * sph;
                // i κ (…)
                return [-sK * qi, sK * qr, -sK * ti, sK * tr];
            };
            const n = stepsFor(seg),
                h = (seg.z1 - seg.z0) / n;
            for (let i = 0; i < n; i++) {
                const z = seg.z0 + i * h;
                y = core.rk4Step(f, z, y, h);
                count++;
                const i1 = y[0] * y[0] + y[1] * y[1],
                    i2 = y[2] * y[2] + y[3] * y[3];
                eErr = Math.max(eErr, Math.abs(i1 + i2 - Itot0) / Itot0);
                // photon fluxes N_j = I_j/(ħω_j): N1 + 2N2 = (I1 + I2)/(ħω1) → compare in units of 1/(ħω1)
                const nPh1 = i1,
                    nPh2 = i2 / 2;
                mrErr = Math.max(mrErr, Math.abs(nPh1 + 2 * nPh2 - N0) / N0);
                if (count % every === 0 || (i === n - 1 && seg === segs[segs.length - 1])) {
                    if (zs[zs.length - 1] !== z + h) {
                        zs.push(z + h);
                        I1.push(i1);
                        I2.push(i2);
                    }
                }
            }
        }
        const i1 = y[0] * y[0] + y[1] * y[1],
            i2 = y[2] * y[2] + y[3] * y[3];
        return {
            z: Float64Array.from(zs),
            I1: Float64Array.from(I1),
            I2: Float64Array.from(I2),
            a1: [y[0], y[1]],
            a2: [y[2], y[3]],
            I1out: i1,
            I2out: i2,
            eta: i2 / I0,
            energyError: eErr,
            mrError: mrErr,
            steps: totalSteps,
            domains: qpm ? segs.length : 0
        };
    }

    /** Photon fluxes (photons s⁻¹ m⁻²) of pump and SH at vacuum pump wavelength λ1. */
    function photonFlux(I1, I2, lambda1) {
        const w1 = TWO_PI * C0 / lambda1;
        return {
            N1: I1 / (HBAR * w1),
            N2: I2 / (HBAR * 2 * w1)
        };
    }

    /** Undepleted analytic conversion efficiency (benchmark / overlay). */
    function etaUndepleted(K, I0, L, dk) {
        const x = dk * L / 2;
        const sinc = Math.abs(x) < 1e-12 ? 1 : Math.sin(x) / x;
        return K * K * I0 * L * L * sinc * sinc;
    }
    /** Δk = 0 depleted analytic efficiency tanh²(κ√I0 L). */
    function etaDepleted(K, I0, L) {
        const t = Math.tanh(K * Math.sqrt(I0) * L);
        return t * t;
    }

    /** Efficiency versus Δk·L from the numerical solver. dkL: array of Δk·L values. */
    function sweepDk(opts, dkL) {
        return dkL.map((x) => solveSHG(Object.assign({}, opts, {
            dk: x / opts.L,
            record: 0
        })).eta);
    }

    // ================================================================ NLSE split-step
    /**
     * Initial envelope on an N-point grid spanning [−W/2, W/2) (W = window, s).
     * shape: "sech" → √P0 sech(T/T0); "gauss" → √P0 exp(−T²/(2T0²)); chirp C multiplies exp(−iC T²/(2T0²)).
     */
    function makePulse({
        N = 1024,
        window,
        T0,
        P0,
        shape = "sech",
        chirp = 0
    }) {
        const dt = window / N;
        const t = new Float64Array(N),
            re = new Float64Array(N),
            im = new Float64Array(N);
        const a = Math.sqrt(P0);
        for (let i = 0; i < N; i++) {
            const T = (i - N / 2) * dt,
                x = T / T0;
            t[i] = T;
            const env = shape === "gauss" ? a * Math.exp(-x * x / 2) : a / Math.cosh(x);
            const ph = -chirp * x * x / 2;
            re[i] = env * Math.cos(ph);
            im[i] = env * Math.sin(ph);
        }
        return {
            t,
            re,
            im,
            dt,
            N
        };
    }

    /**
     * Symmetric split-step Fourier solution of ∂A/∂z = −(iβ2/2)A_TT + iγ|A|²A.
     * opts: { t, re, im (input, not modified), dt, beta2 (s²/m), gamma (1/(W m)), L (m), steps,
     *   record = 0 (number of z snapshots of |A|² to keep, evenly spaced) }
     * Returns { re, im, z, snaps: Float64Array[] (|A|², natural time order) , energyIn, energyOut }.
     */
    function splitStep(opts) {
        const {
            dt,
            beta2,
            gamma,
            L
        } = opts;
        const steps = Math.max(1, Math.round(opts.steps));
        const N = opts.re.length;
        const re = Float64Array.from(opts.re),
            im = Float64Array.from(opts.im);
        const h = L / steps;
        // Ω_k: sign irrelevant for the even operator β2 Ω²/2
        const f = core.fftFreq(N, dt);
        const hc = new Float64Array(N),
            hs = new Float64Array(N);
        for (let k = 0; k < N; k++) {
            const Om = TWO_PI * f[k];
            const ph = beta2 * Om * Om / 2 * (h / 2);
            hc[k] = Math.cos(ph);
            hs[k] = Math.sin(ph);
        }
        // grid index i ↔ T = (i − N/2) dt; FFT assumes periodic grid so a circular shift is only a
        // linear phase and the even dispersion operator is unaffected by the offset.
        const linearHalf = () => {
            core.fft(re, im);
            for (let k = 0; k < N; k++) {
                const r = re[k],
                    q = im[k];
                re[k] = r * hc[k] - q * hs[k];
                im[k] = r * hs[k] + q * hc[k];
            }
            core.ifft(re, im);
        };
        const nonlinear = () => {
            if (gamma === 0) return;
            for (let i = 0; i < N; i++) {
                const p = gamma * (re[i] * re[i] + im[i] * im[i]) * h;
                const c = Math.cos(p),
                    s = Math.sin(p),
                    r = re[i],
                    q = im[i];
                re[i] = r * c - q * s;
                im[i] = r * s + q * c;
            }
        };
        const energy = () => {
            let e = 0;
            for (let i = 0; i < N; i++) e += re[i] * re[i] + im[i] * im[i];
            return e * dt;
        };
        const nRec = opts.record || 0;
        const snaps = [],
            zs = [];
        const snap = (z) => {
            const a = new Float64Array(N);
            for (let i = 0; i < N; i++) a[i] = re[i] * re[i] + im[i] * im[i];
            snaps.push(a);
            zs.push(z);
        };
        const eIn = energy();
        if (nRec) snap(0);
        let nextRec = 1;
        const dispOnly = beta2 === 0;
        for (let s = 0; s < steps; s++) {
            if (!dispOnly) linearHalf();
            nonlinear();
            if (!dispOnly) linearHalf();
            if (nRec && (s + 1) * nRec >= nextRec * steps) {
                snap((s + 1) * h);
                nextRec++;
            }
        }
        return {
            re,
            im,
            z: Float64Array.from(zs),
            snaps,
            energyIn: eIn,
            energyOut: energy(),
            steps,
            h
        };
    }

    /** Power spectrum |Ã(Ω)|² in ascending ν = Ω/2π (Hz) order (Ω sign per dispersion.js: Ω_k = −2πf_k). */
    function spectrum(re, im, dt) {
        const N = re.length;
        const r = Float64Array.from(re),
            q = Float64Array.from(im);
        core.fft(r, q);
        const f = core.fftFreq(N, dt);
        const idx = Array.from({
            length: N
        }, (_, k) => k).sort((a, b) => f[b] - f[a]); // ascending −f
        const nu = new Float64Array(N),
            S = new Float64Array(N);
        for (let j = 0; j < N; j++) {
            const k = idx[j];
            nu[j] = -f[k];
            S[j] = (r[k] * r[k] + q[k] * q[k]) * dt * dt;
        }
        return {
            nu,
            S
        };
    }

    /** RMS width of a distribution y(x) (uniform grid). */
    function rmsWidth(x, y) {
        let s0 = 0,
            s1 = 0,
            s2 = 0;
        for (let i = 0; i < x.length; i++) {
            s0 += y[i];
            s1 += x[i] * y[i];
            s2 += x[i] * x[i] * y[i];
        }
        const m = s1 / s0;
        return Math.sqrt(Math.max(0, s2 / s0 - m * m));
    }

    /** Relative L2 distance ‖a − b‖/‖b‖ of two complex fields. */
    function relL2(aRe, aIm, bRe, bIm) {
        let num = 0,
            den = 0;
        for (let i = 0; i < aRe.length; i++) {
            const dr = aRe[i] - bRe[i],
                di = aIm[i] - bIm[i];
            num += dr * dr + di * di;
            den += bRe[i] * bRe[i] + bIm[i] * bIm[i];
        }
        return Math.sqrt(num / den);
    }

    /** Analytic fundamental soliton at distance z on the given grid (β2 < 0, γP0T0² = |β2|). */
    function solitonField(t, T0, P0, gamma, z) {
        const N = t.length,
            re = new Float64Array(N),
            im = new Float64Array(N);
        const ph = gamma * P0 * z / 2,
            a = Math.sqrt(P0);
        for (let i = 0; i < N; i++) {
            const e = a / Math.cosh(t[i] / T0);
            re[i] = e * Math.cos(ph);
            im[i] = e * Math.sin(ph);
        }
        return {
            re,
            im
        };
    }

    /**
     * Step-count convergence study: runs steps = base·2^j (j = 0..levels−1) and compares with
     * `reference` ({re, im}) or, if absent, with a run at 4× the finest step count.
     * Returns { steps: [], errors: [], order (least-squares slope of −log err vs log steps) }.
     */
    function convergence(opts, base = 8, levels = 6, reference = null) {
        const steps = [],
            errors = [];
        let ref = reference;
        if (!ref) ref = splitStep(Object.assign({}, opts, {
            steps: base * Math.pow(2, levels + 1),
            record: 0
        }));
        for (let j = 0; j < levels; j++) {
            const n = base * Math.pow(2, j);
            const r = splitStep(Object.assign({}, opts, {
                steps: n,
                record: 0
            }));
            steps.push(n);
            errors.push(relL2(r.re, r.im, ref.re, ref.im));
        }
        // fit over the asymptotic range: error below 5 % (pre-asymptotic points saturate) and above
        // the 1e-11 round-off floor
        const pts = steps.map((s, i) => [Math.log(s), Math.log(errors[i])]).filter((p, i) => errors[i] > 1e-11 && errors[i] < 0.05);
        let order = NaN;
        if (pts.length >= 2) {
            const mx = pts.reduce((a, p) => a + p[0], 0) / pts.length,
                my = pts.reduce((a, p) => a + p[1], 0) / pts.length;
            let sxy = 0,
                sxx = 0;
            for (const p of pts) {
                sxy += (p[0] - mx) * (p[1] - my);
                sxx += (p[0] - mx) ** 2;
            }
            order = -sxy / sxx;
        }
        return {
            steps,
            errors,
            order
        };
    }

    /** Agrawal eq. (4.1.13): rms spectral broadening of an unchirped Gaussian by SPM alone. */
    function spmGaussianBroadening(phiMax) {
        return Math.sqrt(1 + 4 / (3 * Math.sqrt(3)) * phiMax * phiMax);
    }

    return {
        CRYSTALS,
        indices,
        neTheta,
        typeIAngle,
        shgParams,
        kappa,
        dDkdTheta,
        solveSHG,
        photonFlux,
        etaUndepleted,
        etaDepleted,
        sweepDk,
        makePulse,
        splitStep,
        spectrum,
        rmsWidth,
        relL2,
        solitonField,
        convergence,
        spmGaussianBroadening
    };
});