/*
 * Electro-optic and acousto-optic modulators and coupled-waveguide devices (pure, DOM-free).
 *
 * Browser: <script src="../shared/optics/electroOptics.js"></script> → window.OpticsModels.electroOptics
 * Node:    require(".../shared/optics/electroOptics.js")   (needs core.js next to it)
 *
 * Conventions (same as the rest of the optics suite)
 * --------------------------------------------------
 *  - SI units internally (m, s, V, W, rad).
 *  - Optical field E(t) = Re{ a(t) e^{-i ω0 t} } with a slowly varying complex envelope a(t).
 *    An envelope component e^{-i n Ω t} therefore sits at the optical frequency ω0 + nΩ, and a
 *    positive index change adds a positive phase +k0 Δn L to a(t).
 *  - Phase modulation a(t) = e^{i β sin Ωt} = Σ_k J_k(β) e^{i k Ω t}, so the amplitude at ω0 + nΩ is
 *    J_{-n}(β) = (−1)^n J_n(β). Sideband powers J_n²(β) do not depend on the sign convention.
 *  - Jones vectors [Ex, Ey]; a retarder adds e^{iΓ} on its slow axis (as polarization.js).
 *  - Powers are normalised to the input power unless a unit is given.
 *
 * Contents
 * --------
 *  MATERIALS, lnbIndex(λ0)                      cited material constants (LiNbO3 Sellmeier, r33, r13, KDP r63; AO media)
 *  vPiPhase, vPiTransverseAmplitude, vPiKDP     half-wave voltages for declared geometries
 *  pmSidebands, spectrumFromEnvelope             Bessel sidebands of a sinusoidally driven phase modulator; FFT check
 *  mzmFields, mzmTransfer, mzmChirp,             Mach–Zehnder modulator with complex fields, push-pull / single-arm,
 *  mzmSidebands, mzmHarmonics                    bias, finite extinction ratio, chirp, sine-drive spectra and distortion
 *  prbs7, nrzDrive, mzmEye                       digital NRZ drive through a single-pole electrical low-pass, eye metrics
 *  pockelsCell                                   Jones-calculus amplitude modulator between polarizers
 *  aom, aomOrders, expm                          acousto-optic Bragg / Raman–Nath diffraction (multi-order coupled waves)
 *  coupler, couplerSection, couplerPropagate     coupled-mode directional coupler, Δβ mismatch, Δβ-reversal switching
 */
(function(root, factory) {
    const m = factory(root);
    if (typeof module === "object" && module.exports) module.exports = m;
    else {
        root.OpticsModels = root.OpticsModels || {};
        root.OpticsModels.electroOptics = m;
    }
})(typeof self !== "undefined" ? self : this, function(root) {
    "use strict";
    const core = (typeof require === "function" && typeof module === "object") ? require("./core.js") : root.OpticsModels.core;
    const C = core.complex,
        cx = core.cx;
    const TWO_PI = 2 * Math.PI;

    // ================================================================== materials
    /**
     * Material constants used by the tool. Electro-optic coefficients are the unclamped
     * (low-frequency) values; their weak wavelength dependence is neglected.
     *  - LiNbO3 (congruent): extraordinary/ordinary Sellmeier of Zelmon, Small & Jundt,
     *    JOSA B 14, 3319 (1997) (λ in µm, 20 °C); r33 = 30.8 pm/V, r13 = 8.6 pm/V
     *    (Weis & Gaylord, Appl. Phys. A 37, 191 (1985)).
     *  - KDP: n_o = 1.51, r63 = 10.5 pm/V (Yariv & Yeh, Photonics, Table 9.2, 633 nm).
     *  - AO media (longitudinal waves): v, n, M2 from Yariv & Yeh Table 12.1 / Saleh & Teich Table 20.1-1.
     */
    const MATERIALS = Object.freeze({
        LiNbO3: Object.freeze({
            name: "LiNbO₃ (congruent)",
            r33: 30.8e-12,
            r13: 8.6e-12
        }),
        KDP: Object.freeze({
            name: "KDP",
            no: 1.51,
            r63: 10.5e-12
        }),
        ao: Object.freeze({
            TeO2: Object.freeze({
                name: "TeO₂ (longitudinal)",
                v: 4200,
                n: 2.26,
                M2: 34.5e-15
            }),
            silica: Object.freeze({
                name: "Fused silica",
                v: 5960,
                n: 1.46,
                M2: 1.51e-15
            }),
            PbMoO4: Object.freeze({
                name: "PbMoO₄",
                v: 3630,
                n: 2.39,
                M2: 36.3e-15
            })
        })
    });

    /** Congruent LiNbO3 ordinary/extraordinary index at vacuum wavelength λ0 (m); valid 0.4–5 µm. */
    function lnbIndex(lambda0) {
        const l2 = Math.pow(lambda0 * 1e6, 2);
        const sell = (A, B, Cc, D, E, F) => Math.sqrt(1 + A * l2 / (l2 - B) + Cc * l2 / (l2 - D) + E * l2 / (l2 - F));
        return {
            ne: sell(2.9804, 0.02047, 0.5981, 0.0666, 8.9543, 416.08),
            no: sell(2.6734, 0.01764, 1.2290, 0.05914, 12.614, 474.6)
        };
    }

    // ================================================================== half-wave voltages
    /**
     * Phase-modulator half-wave voltage (voltage giving a π phase shift) for a transverse electrode
     * geometry: Δφ = π n³ r Γ L V / (λ0 d)  ⇒  V_π = λ0 d / (n³ r L Γ).
     * p = { lambda0, n, r, d (electrode gap), L (electrode length), overlap Γ ∈ (0, 1] }.
     */
    function vPiPhase(p) {
        return p.lambda0 * p.d / (Math.pow(p.n, 3) * p.r * p.L * (p.overlap == null ? 1 : p.overlap));
    }

    /** Phase shift (rad) of a transverse phase modulator at voltage V: π V / V_π. */
    function phaseShift(p, V) {
        return Math.PI * V / vPiPhase(p);
    }

    /**
     * Transverse LiNbO3 Pockels cell (light along x, field along z, input polarization at 45° to z).
     * Field-induced retardation Γ_E = (π/λ0)(n_e³ r33 − n_o³ r13)(V/d) L ⇒ V_π = λ0 d / [L(n_e³ r33 − n_o³ r13)].
     */
    function vPiTransverseAmplitude({
        lambda0,
        d,
        L
    }) {
        const {
            ne,
            no
        } = lnbIndex(lambda0);
        const M = MATERIALS.LiNbO3;
        return lambda0 * d / (L * (Math.pow(ne, 3) * M.r33 - Math.pow(no, 3) * M.r13));
    }

    /** Longitudinal KDP cell (z-cut, field ∥ light ∥ z): Γ = 2π n_o³ r63 V / λ0 ⇒ V_π = λ0 / (2 n_o³ r63). */
    function vPiKDP(lambda0) {
        const M = MATERIALS.KDP;
        return lambda0 / (2 * Math.pow(M.no, 3) * M.r63);
    }

    // ================================================================== phase modulation
    /**
     * Sidebands of a(t) = exp(i β sin Ωt). Returns [{ n, offset (Hz, = n·fm), amp {re, im}, power }]
     * for n = −N…N with amp = J_{−n}(β) (see header). N defaults to ceil(|β|) + 12 (truncation < 1e-15).
     */
    function pmSidebands(beta, fm, N) {
        const M = N == null ? Math.ceil(Math.abs(beta)) + 12 : N;
        const out = [];
        for (let n = -M; n <= M; n++) {
            const a = core.besselJ(-n, beta);
            out.push({
                n,
                offset: n * fm,
                amp: cx(a, 0),
                power: a * a
            });
        }
        return out;
    }

    /** Carson-rule bandwidth 2(β + 1) f_m (≈ 98 % of the power) and peak frequency deviation β f_m. */
    function pmBandwidth(beta, fm) {
        return {
            carson: 2 * (Math.abs(beta) + 1) * fm,
            peakDeviation: Math.abs(beta) * fm
        };
    }

    /**
     * Numerical line spectrum of a periodic envelope a(t) (period T = 1/fm) from N samples of one
     * period (N a power of two): c_n = (1/N) Σ_j a(t_j) e^{+i n Ω t_j} (amplitude at ω0 + nΩ).
     * envelope(t) → {re, im}. Returns [{ n, offset, amp, power }] for |n| < N/2.
     */
    function spectrumFromEnvelope(envelope, fm, N = 256) {
        const re = new Float64Array(N),
            im = new Float64Array(N);
        for (let j = 0; j < N; j++) {
            const a = envelope(j / (N * fm));
            re[j] = a.re;
            im[j] = a.im;
        }
        core.ifft(re, im); // (1/N) Σ x_j e^{+2πi k j / N}
        const out = [];
        for (let n = -N / 2 + 1; n < N / 2; n++) {
            const k = (n + N) % N;
            out.push({
                n,
                offset: n * fm,
                amp: cx(re[k], im[k]),
                power: re[k] * re[k] + im[k] * im[k]
            });
        }
        return out;
    }

    // ================================================================== Mach–Zehnder modulator
    /** Splitter power ratio r that gives a static extinction ratio ER (linear, > 1): s = 2√(r(1−r)) = (ER−1)/(ER+1). */
    function splitRatioFromER(erLinear) {
        if (!Number.isFinite(erLinear) || erLinear <= 1) return erLinear <= 1 ? 1 : 0.5;
        const s = (erLinear - 1) / (erLinear + 1);
        return 0.5 * (1 + Math.sqrt(Math.max(0, 1 - s * s)));
    }

    /**
     * Normalise MZM parameters.
     * p = { VpiPM (phase-modulator V_π of ONE full arm electrode), s1, s2 (arm drive weights: arm 1
     *       gets +s1·V, arm 2 gets −s2·V; push-pull s1 = s2 = 1, single-arm s2 = 0),
     *       bias (static phase difference φ_bias, rad), erDb (static extinction ratio, dB; Infinity = ideal) }
     * V_π of the MZM (Δφ = π) is VpiPM / (s1 + s2).
     */
    function mzmParams(p) {
        const s1 = p.s1 == null ? 1 : p.s1,
            s2 = p.s2 == null ? 1 : p.s2;
        const er = p.erDb == null || !Number.isFinite(p.erDb) ? Infinity : Math.pow(10, p.erDb / 10);
        const r = Number.isFinite(er) ? splitRatioFromER(er) : 0.5;
        return {
            VpiPM: p.VpiPM,
            s1,
            s2,
            bias: p.bias || 0,
            r,
            Vpi: p.VpiPM / (s1 + s2),
            er
        };
    }

    /**
     * Complex output fields of the MZM for drive voltage V (input field amplitude 1).
     * Input splitter: arms (√r, i√(1−r)); arm phases φ1 = +s1 πV/V_πPM + φ_b/2, φ2 = −s2 πV/V_πPM − φ_b/2;
     * output 50/50 coupler (1/√2)[[1, i], [i, 1]].
     *   out2 ("through", main port) = i(√r e^{iφ1} + √(1−r) e^{iφ2})/√2,  P2 = ½[1 + 2√(r(1−r)) cos Δφ]
     *   out1 (complementary port)   =  (√r e^{iφ1} − √(1−r) e^{iφ2})/√2,  P1 = 1 − P2.
     */
    function mzmFields(p, V) {
        const q = p.Vpi != null && p.r != null ? p : mzmParams(p);
        const k = Math.PI * V / q.VpiPM;
        const phi1 = q.s1 * k + q.bias / 2,
            phi2 = -q.s2 * k - q.bias / 2;
        const a1 = C.scale(C.expi(phi1), Math.sqrt(q.r));
        const a2 = C.scale(C.expi(phi2), Math.sqrt(1 - q.r));
        const out2 = C.scale(C.mul(C.I, C.add(a1, a2)), Math.SQRT1_2);
        const out1 = C.scale(C.sub(a1, a2), Math.SQRT1_2);
        return {
            out1,
            out2,
            P1: C.abs2(out1),
            P2: C.abs2(out2),
            phi1,
            phi2,
            dphi: phi1 - phi2
        };
    }

    /** Main-port transfer P_out/P_in at voltage V (ideal: cos²(πV/(2V_π) + φ_bias/2)). */
    function mzmTransfer(p, V) {
        return mzmFields(p, V).P2;
    }

    /** Analytic small-signal slope dP2/dV at bias voltage V0: −(s π / (2V_π)) sin(πV0/V_π + φ_bias), s = 2√(r(1−r)). */
    function mzmSlope(p, V0 = 0) {
        const q = mzmParams(p);
        const s = 2 * Math.sqrt(q.r * (1 - q.r));
        return -(s * Math.PI / (2 * q.Vpi)) * Math.sin(Math.PI * V0 / q.Vpi + q.bias);
    }

    /**
     * Small-signal chirp parameter at operating voltage V0 for the balanced (r = ½) MZM:
     * α = (dΦ/dt) / (d ln|a|/dt) with Φ the optical phase in the engineering e^{+iωt} convention
     * (Φ = −arg a here). Closed form: α = [(s1 − s2)/(s1 + s2)] · cot(Δφ/2). Push-pull (s1 = s2) → 0;
     * single-arm at quadrature → ±1. Returns NaN at the null (|a| = 0).
     */
    function mzmChirp(p, V0 = 0) {
        const q = mzmParams(p);
        const d = Math.PI * V0 / q.Vpi + q.bias;
        const t = Math.tan(d / 2);
        if (Math.abs(Math.cos(d / 2)) < 1e-12) return NaN;
        return ((q.s1 - q.s2) / (q.s1 + q.s2)) / t;
    }

    /** Numerical chirp from the complex field (central difference), for verification. */
    function mzmChirpNumeric(p, V0 = 0, dV) {
        const q = mzmParams(p);
        const h = dV || q.Vpi * 1e-5;
        const f = (V) => mzmFields(q, V).out2;
        const ap = f(V0 + h),
            am = f(V0 - h);
        let dArg = C.arg(ap) - C.arg(am);
        dArg = Math.atan2(Math.sin(dArg), Math.cos(dArg));
        const dLnA = Math.log(C.abs(ap)) - Math.log(C.abs(am));
        return -dArg / dLnA;
    }

    /**
     * Optical line spectrum of both MZM ports for a sinusoidal drive V(t) = Vdc + Vm sin Ωt.
     * Each arm is a phase modulator: arm k contributes e^{iφ_k0} J_{−n}(β_k) at ω0 + nΩ.
     */
    function mzmSidebands(p, Vm, fm, Vdc = 0, N) {
        const q = mzmParams(p);
        const k = Math.PI / q.VpiPM;
        const b1 = q.s1 * k * Vm,
            b2 = -q.s2 * k * Vm;
        const p1 = q.s1 * k * Vdc + q.bias / 2,
            p2 = -q.s2 * k * Vdc - q.bias / 2;
        const M = N == null ? Math.ceil(Math.max(Math.abs(b1), Math.abs(b2))) + 6 : N;
        const out = [];
        for (let n = -M; n <= M; n++) {
            const a1 = C.scale(C.expi(p1), Math.sqrt(q.r) * core.besselJ(-n, b1));
            const a2 = C.scale(C.expi(p2), Math.sqrt(1 - q.r) * core.besselJ(-n, b2));
            const o2 = C.scale(C.mul(C.I, C.add(a1, a2)), Math.SQRT1_2);
            const o1 = C.scale(C.sub(a1, a2), Math.SQRT1_2);
            out.push({
                n,
                offset: n * fm,
                amp2: o2,
                amp1: o1,
                power2: C.abs2(o2),
                power1: C.abs2(o1)
            });
        }
        return out;
    }

    /**
     * Harmonic content of the detected main-port power for V(t) = Vdc + Vm sin Ωt, from an FFT of
     * N samples of one period. Returns { dc, h: [|H1|, |H2|, …] (one-sided amplitudes), hd2, hd3 (dBc) }.
     */
    function mzmHarmonics(p, Vm, Vdc = 0, N = 256) {
        const q = mzmParams(p);
        const re = new Float64Array(N),
            im = new Float64Array(N);
        for (let j = 0; j < N; j++) re[j] = mzmFields(q, Vdc + Vm * Math.sin(TWO_PI * j / N)).P2;
        core.fft(re, im);
        const h = [];
        for (let k = 1; k <= 5; k++) h.push(2 * Math.hypot(re[k], im[k]) / N);
        const db = (a, b) => (a > 0 && b > 0 ? 20 * Math.log10(a / b) : -Infinity);
        return {
            dc: re[0] / N,
            h,
            hd2: db(h[1], h[0]),
            hd3: db(h[2], h[0])
        };
    }

    // ------------------------------------------------------------------ digital drive
    /** PRBS7 (x⁷ + x⁶ + 1) bit sequence of length n, from a non-zero 7-bit seed. Period 127. */
    function prbs7(n, seed = 0x7f) {
        let s = seed & 0x7f || 1;
        const out = new Uint8Array(n);
        for (let i = 0; i < n; i++) {
            const b = ((s >> 6) ^ (s >> 5)) & 1;
            s = ((s << 1) | b) & 0x7f;
            out[i] = b;
        }
        return out;
    }

    /**
     * NRZ drive through a single-pole low-pass (time constant τ = rise10-90 / ln 9 ≈ t_r/2.197).
     * bits: 0/1 array; spb samples per bit; riseFrac = 10–90 % rise time as a fraction of the bit
     * period (0 = ideal). Levels: bit 1 → vHigh, bit 0 → vLow. The filter is started in the steady
     * state of the periodic sequence (two passes) so the first bits are not transient.
     * Returns Float64Array of length bits.length·spb (drive voltage).
     */
    function nrzDrive(bits, spb, riseFrac, vLow, vHigh) {
        const n = bits.length * spb;
        const ideal = new Float64Array(n);
        for (let i = 0; i < n; i++) ideal[i] = bits[Math.floor(i / spb)] ? vHigh : vLow;
        if (!(riseFrac > 0)) return ideal;
        const tau = riseFrac * spb / Math.log(9); // in samples
        const a = 1 - Math.exp(-1 / tau);
        let y = ideal[n - 1];
        for (let pass = 0; pass < 2; pass++) {
            for (let i = 0; i < n; i++) y += a * (ideal[i] - y);
        }
        // second pass of the loop above left y at the end of the sequence (steady state); now record
        const out = new Float64Array(n);
        for (let i = 0; i < n; i++) {
            y += a * (ideal[i] - y);
            out[i] = y;
        }
        return out;
    }

    /**
     * Eye metrics of the MZM main-port power for a PRBS7 NRZ drive centred on the bias.
     * d = { swing (V peak-to-peak), riseFrac, spb = 32, nBits = 127 }. The drive is V = ±swing/2.
     * Returns { bits, drive, power, spb, levels: {mean1, mean0, minHigh, maxLow}, opening (minHigh − maxLow), inverted,
     *           erDb (mean1/mean0 in dB), P1, P0 } — powers normalised to the input power.
     */
    function mzmEye(p, d) {
        const q = mzmParams(p);
        const spb = d.spb || 32,
            nBits = d.nBits || 127;
        const bits = prbs7(nBits);
        const drive = nrzDrive(bits, spb, d.riseFrac || 0, -d.swing / 2, d.swing / 2);
        const power = new Float64Array(drive.length);
        for (let i = 0; i < drive.length; i++) power[i] = mzmFields(q, drive[i]).P2;
        const mid = Math.floor(spb / 2);
        let s1 = 0,
            s0 = 0,
            n1 = 0,
            n0 = 0;
        for (let b = 0; b < nBits; b++) {
            const v = power[b * spb + mid];
            if (bits[b]) {
                s1 += v;
                n1++;
            } else {
                s0 += v;
                n0++;
            }
        }
        const mean1 = s1 / n1,
            mean0 = s0 / n0;
        // "high" rail = the bit value with the larger mean optical power (inverting bias possible)
        const highBit = mean1 >= mean0 ? 1 : 0;
        let minHigh = Infinity,
            maxLow = -Infinity;
        for (let b = 0; b < nBits; b++) {
            const v = power[b * spb + mid];
            if (bits[b] === highBit) minHigh = Math.min(minHigh, v);
            else maxLow = Math.max(maxLow, v);
        }
        const hi = Math.max(mean1, mean0),
            lo = Math.min(mean1, mean0);
        const opening = minHigh - maxLow;
        return {
            bits,
            drive,
            power,
            spb,
            levels: {
                mean1,
                mean0,
                minHigh,
                maxLow
            },
            inverted: highBit === 0,
            opening,
            erDb: lo > 0 ? 10 * Math.log10(hi / lo) : Infinity,
            P1: hi,
            P0: lo
        };
    }

    // ================================================================== Pockels cell (Jones)
    /**
     * Amplitude modulator: polarizer along x → electro-optic cell with induced axes at ±45° →
     * analyzer along y (crossed) or x (parallel). Retardation Γ = Γ0 + π V / V_π (Γ0 = residual
     * static retardation after compensation, or a λ/4 bias plate).
     * Returns { gamma, jones: [Ex, Ey] after the cell, Tcrossed = sin²(Γ/2), Tparallel = cos²(Γ/2), stokes }.
     */
    function pockelsCell({
        V,
        Vpi,
        gamma0 = 0,
        axis = Math.PI / 4
    }) {
        const G = gamma0 + Math.PI * V / Vpi;
        // retarder: R(−θ) diag(1, e^{iΓ}) R(θ) acting on [1, 0]
        const c = Math.cos(axis),
            s = Math.sin(axis),
            e = C.expi(G);
        // R(θ)[1,0] = [c, −s]; diag → [c, −s e]; R(−θ)[u, v] = [c u + s v... ] with R(θ) = [[c, s], [−s, c]]
        const u = cx(c, 0),
            v = C.scale(e, -s);
        const Ex = C.add(C.scale(u, c), C.scale(v, -s));
        const Ey = C.add(C.scale(u, s), C.scale(v, c));
        const Ix = C.abs2(Ex),
            Iy = C.abs2(Ey);
        const cross = C.mul(C.conj(Ex), Ey);
        return {
            gamma: G,
            jones: [Ex, Ey],
            Tcrossed: Iy,
            Tparallel: Ix,
            stokes: {
                S0: Ix + Iy,
                S1: Ix - Iy,
                S2: 2 * cross.re,
                S3: 2 * cross.im
            }
        };
    }

    // ================================================================== acousto-optics
    /**
     * Acousto-optic cell. p = { lambda0, fa (acoustic frequency, Hz), v (sound speed), n, M2
     * (figure of merit, s³/kg), L (interaction length along the light), H (transducer height),
     * Pa (acoustic power, W) }.
     * Returns Λ, K, θ_B inside (λ0/(2nΛ)) and outside (≈ λ0/(2Λ), small-angle Snell), deflection 2θ_B,
     * Klein–Cook Q = 2π λ0 L / (n Λ²), Raman–Nath parameter ν = (√2 π/λ0) √(M2 Pa L / H)
     * (peak phase modulation), Bragg efficiency sin²(ν/2), power for 100 %: P100 = λ0² H / (2 M2 L),
     * and the regime label.
     */
    function aom(p) {
        const Lam = p.v / p.fa;
        const thetaIn = Math.asin(Math.min(1, p.lambda0 / (2 * p.n * Lam)));
        const thetaOut = Math.asin(Math.min(1, p.lambda0 / (2 * Lam)));
        const Q = TWO_PI * p.lambda0 * p.L / (p.n * Lam * Lam);
        const nu = Math.SQRT2 * Math.PI / p.lambda0 * Math.sqrt(Math.max(0, p.M2 * p.Pa * p.L / p.H));
        const P100 = p.lambda0 * p.lambda0 * p.H / (2 * p.M2 * p.L);
        const regime = Q < 1 ? "Raman–Nath" : Q > 10 ? "Bragg" : "intermediate";
        return {
            Lambda: Lam,
            K: TWO_PI / Lam,
            thetaBIn: thetaIn,
            thetaBOut: thetaOut,
            deflection: 2 * thetaOut,
            Q,
            nu,
            etaBragg: Math.pow(Math.sin(nu / 2), 2),
            P100,
            regime,
            rho: p.lambda0 * p.lambda0 / (p.n * p.n * Lam * Lam) // Moharam–Young ρ = λ0²/(n²Λ²) (alternative criterion)
        };
    }

    /**
     * exp(A) for a complex square matrix A = (re, im) (row-major Float64Arrays, size m×m) by scaling
     * and squaring with a Taylor series. Used for the constant-coefficient coupled-wave system.
     */
    function expm(Are, Aim, m) {
        let norm = 0;
        for (let i = 0; i < m; i++) {
            let row = 0;
            for (let j = 0; j < m; j++) row += Math.hypot(Are[i * m + j], Aim[i * m + j]);
            norm = Math.max(norm, row);
        }
        const sq = Math.max(0, Math.ceil(Math.log2(norm / 0.25 + 1e-300)));
        const sc = Math.pow(2, -sq);
        const Br = Float64Array.from(Are, (x) => x * sc),
            Bi = Float64Array.from(Aim, (x) => x * sc);
        const mul = (Xr, Xi, Yr, Yi) => {
            const Zr = new Float64Array(m * m),
                Zi = new Float64Array(m * m);
            for (let i = 0; i < m; i++)
                for (let k = 0; k < m; k++) {
                    const ar = Xr[i * m + k],
                        ai = Xi[i * m + k];
                    if (ar === 0 && ai === 0) continue;
                    for (let j = 0; j < m; j++) {
                        const br = Yr[k * m + j],
                            bi = Yi[k * m + j];
                        Zr[i * m + j] += ar * br - ai * bi;
                        Zi[i * m + j] += ar * bi + ai * br;
                    }
                }
            return [Zr, Zi];
        };
        let Er = new Float64Array(m * m),
            Ei = new Float64Array(m * m);
        let Tr = new Float64Array(m * m),
            Ti = new Float64Array(m * m);
        for (let i = 0; i < m; i++) {
            Er[i * m + i] = 1;
            Tr[i * m + i] = 1;
        }
        for (let k = 1; k <= 18; k++) {
            [Tr, Ti] = mul(Tr, Ti, Br, Bi);
            for (let i = 0; i < m * m; i++) {
                Tr[i] /= k;
                Ti[i] /= k;
                Er[i] += Tr[i];
                Ei[i] += Ti[i];
            }
        }
        for (let s = 0; s < sq; s++)[Er, Ei] = mul(Er, Ei, Er, Ei);
        return [Er, Ei];
    }

    /**
     * Multi-order coupled-wave (Raman–Nath) equations for a thick sinusoidal phase grating, in the
     * normalised depth ζ = z/L ∈ [0, 1] (Klein & Cook 1967):
     *     dB_m/dζ = (ν/2)(B_{m−1} − B_{m+1}) − i (Q/2) m (m − a) B_m,     B_m(0) = δ_m0,
     * where a = incidence parameter (a = 1: Bragg incidence for order +1, a = 0: normal incidence).
     * The coupling matrix is anti-Hermitian, so Σ|B_m|² = 1 exactly. Q → 0 gives |B_m|² = J_m²(ν);
     * Q → ∞ with a = 1 gives the two-wave Bragg result |B_1|² = sin²(ν/2).
     * opts: { M (orders −M…M; default ceil(ν) + 10), zeta = [1] depths at which to return powers }.
     * Returns { orders: [−M…M], power: Float64Array(2M+1) at ζ = 1, profile: [{zeta, power}] }.
     */
    function aomOrders(nu, Q, a = 1, opts = {}) {
        const M = opts.M || Math.ceil(Math.abs(nu)) + 10;
        const m = 2 * M + 1;
        const Ar = new Float64Array(m * m),
            Ai = new Float64Array(m * m);
        for (let i = 0; i < m; i++) {
            const ord = i - M;
            Ai[i * m + i] = -(Q / 2) * ord * (ord - a);
            if (i > 0) Ar[i * m + i - 1] = nu / 2; // + (ν/2) B_{m−1}
            if (i < m - 1) Ar[i * m + i + 1] = -nu / 2; // − (ν/2) B_{m+1}
        }
        const zetas = opts.zeta || [1];
        const profile = [];
        let last = null;
        for (const z of zetas) {
            const [Er, Ei] = expm(Float64Array.from(Ar, (x) => x * z), Float64Array.from(Ai, (x) => x * z), m);
            const pw = new Float64Array(m);
            for (let i = 0; i < m; i++) pw[i] = Er[i * m + M] * Er[i * m + M] + Ei[i * m + M] * Ei[i * m + M];
            profile.push({
                zeta: z,
                power: pw
            });
            last = pw;
        }
        const orders = [];
        for (let i = 0; i < m; i++) orders.push(i - M);
        if (zetas[zetas.length - 1] !== 1) {
            const [Er, Ei] = expm(Ar, Ai, m);
            last = new Float64Array(m);
            for (let i = 0; i < m; i++) last[i] = Er[i * m + M] * Er[i * m + M] + Ei[i * m + M] * Ei[i * m + M];
        }
        return {
            orders,
            power: last,
            profile,
            M
        };
    }

    /**
     * Same system integrated with fixed-step RK4 (core.rk4Step) on the real 2(2M+1) vector: an
     * independent check of aomOrders (used by the tests for convergence).
     */
    function aomOrdersRK4(nu, Q, a = 1, nSteps = 2000, M) {
        const MM = M || Math.ceil(Math.abs(nu)) + 6,
            m = 2 * MM + 1;
        const f = (t, y) => {
            const d = new Float64Array(2 * m);
            for (let i = 0; i < m; i++) {
                const ord = i - MM,
                    ph = -(Q / 2) * ord * (ord - a);
                const re = y[2 * i],
                    im = y[2 * i + 1];
                let dr = ph * im,
                    di = -ph * re; // −i·ph·(re + i·im) = ph·im − i·ph·re
                if (i > 0) {
                    dr += nu / 2 * y[2 * (i - 1)];
                    di += nu / 2 * y[2 * (i - 1) + 1];
                }
                if (i < m - 1) {
                    dr -= nu / 2 * y[2 * (i + 1)];
                    di -= nu / 2 * y[2 * (i + 1) + 1];
                }
                d[2 * i] = dr;
                d[2 * i + 1] = di;
            }
            return d;
        };
        let y = new Float64Array(2 * m);
        y[2 * MM] = 1;
        const h = 1 / nSteps;
        for (let s = 0; s < nSteps; s++) y = core.rk4Step(f, s * h, y, h);
        const power = new Float64Array(m);
        for (let i = 0; i < m; i++) power[i] = y[2 * i] * y[2 * i] + y[2 * i + 1] * y[2 * i + 1];
        return {
            power,
            M: MM
        };
    }

    // ================================================================== directional coupler
    /**
     * Coupled-mode theory for two lossless single-mode guides (Yariv & Yeh §13):
     *     dA1/dz = −iκ A2 e^{iΔβ z},  dA2/dz = −iκ A1 e^{−iΔβ z},   Δβ = β1 − β2.
     * Transfer matrix of a uniform section of length l (in the frame that removes the fast phase):
     *     [[cos gl + i(Δβ/2g) sin gl, −i(κ/g) sin gl], [−i(κ/g) sin gl, cos gl − i(Δβ/2g) sin gl]],
     *     g = √(κ² + (Δβ/2)²).  It is unitary with determinant 1.
     */
    function couplerSection(kappa, dbeta, l) {
        const g = Math.sqrt(kappa * kappa + dbeta * dbeta / 4);
        const c = Math.cos(g * l),
            s = g > 0 ? Math.sin(g * l) / g : l;
        return [
            [cx(c, dbeta / 2 * s), cx(0, -kappa * s)],
            [cx(0, -kappa * s), cx(c, -dbeta / 2 * s)]
        ];
    }

    /**
     * Coupler with total length L and mismatch Δβ; optionally Δβ-reversal (two equal sections with
     * +Δβ then −Δβ, Kogelnik & Schmidt 1976). Input all in guide 1.
     * Returns { kappa, g, Lc = π/(2κ), maxTransfer = 1/(1 + (Δβ/2κ)²), P1, P2 (at z = L), M (2×2) }.
     */
    function coupler({
        kappa,
        dbeta = 0,
        L,
        reversal = false
    }) {
        const M = reversal ?
            core.cmat2.mul(couplerSection(kappa, -dbeta, L / 2), couplerSection(kappa, dbeta, L / 2)) :
            couplerSection(kappa, dbeta, L);
        const A1 = M[0][0],
            A2 = M[1][0];
        const g = Math.sqrt(kappa * kappa + dbeta * dbeta / 4);
        return {
            kappa,
            g,
            Lc: Math.PI / (2 * kappa),
            maxTransfer: 1 / (1 + Math.pow(dbeta / (2 * kappa), 2)),
            P1: C.abs2(A1),
            P2: C.abs2(A2),
            M
        };
    }

    /** P1(z), P2(z) along the coupler (n points), with optional Δβ reversal at L/2. */
    function couplerPropagate({
        kappa,
        dbeta = 0,
        L,
        reversal = false
    }, n = 301) {
        const z = new Float64Array(n),
            P1 = new Float64Array(n),
            P2 = new Float64Array(n);
        for (let i = 0; i < n; i++) {
            const zi = L * i / (n - 1);
            let M;
            if (!reversal || zi <= L / 2) M = couplerSection(kappa, dbeta, zi);
            else M = core.cmat2.mul(couplerSection(kappa, -dbeta, zi - L / 2), couplerSection(kappa, dbeta, L / 2));
            z[i] = zi;
            P1[i] = C.abs2(M[0][0]);
            P2[i] = C.abs2(M[1][0]);
        }
        return {
            z,
            P1,
            P2
        };
    }

    /**
     * Push-pull electro-optic mismatch: each guide sees ±½ n³ r Γ V/d, so Δβ = k0 n³ r Γ V / d.
     * p = { lambda0, n, r, d, overlap }.
     */
    function dbetaFromVoltage(p, V) {
        return TWO_PI / p.lambda0 * Math.pow(p.n, 3) * p.r * (p.overlap == null ? 1 : p.overlap) * V / p.d;
    }

    return {
        MATERIALS,
        lnbIndex,
        vPiPhase,
        phaseShift,
        vPiTransverseAmplitude,
        vPiKDP,
        pmSidebands,
        pmBandwidth,
        spectrumFromEnvelope,
        splitRatioFromER,
        mzmParams,
        mzmFields,
        mzmTransfer,
        mzmSlope,
        mzmChirp,
        mzmChirpNumeric,
        mzmSidebands,
        mzmHarmonics,
        prbs7,
        nrzDrive,
        mzmEye,
        pockelsCell,
        aom,
        aomOrders,
        aomOrdersRK4,
        expm,
        couplerSection,
        coupler,
        couplerPropagate,
        dbetaFromVoltage
    };
});