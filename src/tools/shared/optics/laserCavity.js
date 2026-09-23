/*
 * Effective four-level laser rate-equation model for a linear two-mirror cavity.
 *
 * Geometry and conventions (SI units throughout)
 * ----------------------------------------------
 *  - Linear (standing-wave) cavity of optical length L between a high reflector
 *    (power reflectivity R1) and an output coupler (R2). Group index is taken
 *    as 1, so the round-trip time is T_rt = 2L/c.
 *  - A gain medium of length l_g ≤ L sits inside the cavity. The laser mode has
 *    a uniform effective cross-section A along the whole cavity ("mean-field"
 *    or uniform-field approximation: the intracavity field is treated as
 *    uniform along the axis; exact in the limit of small loss per pass).
 *  - g   = single-pass small-signal intensity gain coefficient [1/m] in the gain
 *          medium, g = σ N / (A l_g), with N the number of inverted atoms.
 *  - α   = distributed internal (scattering/absorption) loss coefficient [1/m],
 *          acting over the whole cavity length L.
 *  - Round-trip intensity multiplier:  M = R1 R2 exp(2 g l_g − 2 α L).
 *    For l_g = L this is the textbook M = R1 R2 exp[2(g − α)L].
 *    Threshold M = 1  ⇒  g_th = [2 α L + ln(1/(R1 R2))] / (2 l_g)
 *    (for l_g = L:  g_th = α + ln(1/(R1 R2))/(2L)).
 *
 * Rate equations (ideal four-level system: the pump band and the lower laser
 * level empty instantly, so the inversion equals the upper-level population N)
 * -------------------------------------------------------------------------
 *    dN/dt = Rp − N/τ − G N q
 *    dq/dt = G N q − q/τ_p + β N/τ
 *  with
 *    q      number of photons in the lasing mode (both directions together),
 *    Rp     pump rate into the upper laser level [atoms/s],
 *    τ      upper-state lifetime (assumed radiative),
 *    β      fraction of spontaneous emission that goes into the lasing mode,
 *    G      = c σ / (A L)   stimulated-emission coupling per photon per atom,
 *    τ_p    = T_rt / [ln(1/(R1 R2)) + 2 α L]   photon lifetime.
 *  Consistency: for fixed N the net photon growth rate is
 *    G N − 1/τ_p = ln(M)/T_rt,
 *  i.e. the rate model reproduces the round-trip multiplier exactly, and its
 *  threshold (G N_th = 1/τ_p) is the same as M = 1.
 *  Threshold inversion N_th = 1/(G τ_p); threshold pump Rp_th = N_th/τ
 *  (defined with β → 0, as usual).
 *
 * Output
 * ------
 *  One-way circulating power at the output mirror: Pcirc = q hν / T_rt
 *  (each photon strikes the output coupler once per round trip).
 *  Transmitted output: Pout = T2 · Pcirc, T2 = 1 − R2 (lossless mirror), so a
 *  100 % output mirror gives exactly zero output.
 *  Option outputCoupling = "budget" (exact photon bookkeeping): the photon loss
 *  rate q/τ_p = q δ/T_rt (δ = ln(1/(R1R2)) + 2αL) is split into its channels,
 *  output ln(1/R2)/δ, back mirror ln(1/R1)/δ, internal 2αL/δ, so that
 *  Pout = ln(1/R2) q hν / T_rt and pump = spontaneous + all loss channels
 *  holds exactly in steady state. Both options agree to O(T2²).
 *
 * Above-threshold steady state (β → 0), pump power Pp = Rp hν_p:
 *    q = τ_p (Rp − Rp_th),  Pout = η_s (Pp − Pp_th),
 *    η_s = (λ_p/λ) · T2/δ   (or ln(1/R2)/δ with "budget" bookkeeping).
 *
 * Small-signal relaxation oscillations (linearise about N_th, q0, β → 0; r = Rp/Rp_th):
 *    s² + (r/τ) s + (r − 1)/(τ τ_p) = 0
 *    ⇒ ω_R² = (r − 1)/(τ τ_p) − γ_R²,  γ_R = r/(2τ)  (envelope ∝ e^{−γ_R t}).
 *
 * Passive cavity (link to the Fabry–Pérot tool): FSR = c/(2L) (group index 1),
 * cold-cavity linewidth Δν_c = 1/(2π τ_p), finesse F = FSR/Δν_c = 2π/δ
 * (→ π√ρ/(1−ρ) of the Airy function in the small-loss limit, ρ² = R1R2e^{−2αL}).
 *
 * Numerics
 * --------
 *  Classical fixed-step RK4 in physical time; the default step is a fixed
 *  fraction of the photon lifetime (the fastest time scale).
 */
(function(root, factory) {
    const m = factory();
    if (typeof module === "object" && module.exports) module.exports = m;
    else {
        root.OpticsModels = root.OpticsModels || {};
        root.OpticsModels.laserCavity = m;
    }
})(typeof self !== "undefined" ? self : this, function() {
    "use strict";

    const C = 299792458; // m/s
    const H = 6.62607015e-34; // J s

    // Order-of-magnitude values for a diode-pumped Nd:YAG rod (1064 nm).
    const DEFAULTS = Object.freeze({
        R1: 0.998, // high reflector
        R2: 0.95, // output coupler
        L: 0.10, // cavity length [m]
        gainLength: 0.05, // gain-medium length [m]
        alpha: 0.2, // internal loss coefficient [1/m]
        sigma: 2.8e-23, // stimulated-emission cross-section [m^2]
        tau: 230e-6, // upper-state lifetime [s]
        area: Math.PI * 0.5e-3 * 0.5e-3, // mode area, w = 0.5 mm [m^2]
        beta: 1e-9, // spontaneous-emission coupling into the mode
        wavelength: 1064e-9, // laser wavelength [m]
        pumpWavelength: 808e-9, // pump wavelength [m] (for pump-power readout)
        pumpRate: 0, // Rp [atoms/s]
        gainBandwidth: 120e9, // gain FWHM [Hz] (Nd:YAG ≈ 0.45 nm), for the mode count only
        outputCoupling: "transmission" // "transmission": Pout = T2·Pcirc; "budget": exact loss-channel share
    });

    function withDefaults(p) {
        const out = Object.assign({}, DEFAULTS, p || {});
        if (!(out.L > 0)) throw new RangeError("Cavity length L must be > 0");
        if (!(out.gainLength > 0) || out.gainLength > out.L + 1e-15) {
            throw new RangeError("Gain length must satisfy 0 < l_g ≤ L");
        }
        if (!(out.R1 > 0 && out.R1 <= 1 && out.R2 > 0 && out.R2 <= 1)) {
            throw new RangeError("Mirror reflectivities must lie in (0, 1]");
        }
        if (out.outputCoupling !== "transmission" && out.outputCoupling !== "budget") {
            throw new RangeError("outputCoupling must be 'transmission' or 'budget'");
        }
        if (out.R1 * out.R2 === 1 && out.alpha === 0) {
            throw new RangeError("Lossless cavity has infinite photon lifetime");
        }
        return out;
    }

    function derived(params) {
        const p = withDefaults(params);
        const roundTripTime = 2 * p.L / C;
        const mirrorLogLoss = Math.log(1 / (p.R1 * p.R2));
        const logLossPerRoundTrip = mirrorLogLoss + 2 * p.alpha * p.L;
        const photonLifetime = roundTripTime / logLossPerRoundTrip;
        const coupling = C * p.sigma / (p.area * p.L); // G
        const thresholdInversion = 1 / (coupling * photonLifetime);
        const thresholdPumpRate = thresholdInversion / p.tau;
        const thresholdGain = logLossPerRoundTrip / (2 * p.gainLength);
        const photonEnergy = H * C / p.wavelength;
        const pumpPhotonEnergy = H * C / p.pumpWavelength;
        const outputTransmission = 1 - p.R2;
        // fraction of the photon loss rate q/τ_p that leaves through the output coupler
        const outputFraction = p.outputCoupling === "budget" ?
            Math.log(1 / p.R2) / logLossPerRoundTrip :
            outputTransmission / logLossPerRoundTrip;
        return {
            params: p,
            roundTripTime,
            mirrorLogLoss,
            logLossPerRoundTrip,
            photonLifetime,
            coupling,
            thresholdInversion,
            thresholdPumpRate,
            thresholdGain,
            photonEnergy,
            pumpPhotonEnergy,
            outputTransmission,
            outputFraction,
            thresholdPumpPower: thresholdPumpRate * pumpPhotonEnergy,
            pumpPower: p.pumpRate * pumpPhotonEnergy,
            pumpRatio: p.pumpRate / thresholdPumpRate
        };
    }

    function gainFromInversion(params, N) {
        const p = withDefaults(params);
        return p.sigma * N / (p.area * p.gainLength);
    }

    function roundTripMultiplier(params, g) {
        const p = withDefaults(params);
        return p.R1 * p.R2 * Math.exp(2 * g * p.gainLength - 2 * p.alpha * p.L);
    }

    function thresholdGain(params) {
        return derived(params).thresholdGain;
    }

    function derivative(state, d) {
        const p = d.params;
        const N = state[0];
        const q = state[1];
        const stim = d.coupling * N * q;
        return [
            p.pumpRate - N / p.tau - stim,
            stim - q / d.photonLifetime + p.beta * N / p.tau
        ];
    }

    function rk4Step(state, dt, d) {
        const k1 = derivative(state, d);
        const s2 = [state[0] + 0.5 * dt * k1[0], state[1] + 0.5 * dt * k1[1]];
        const k2 = derivative(s2, d);
        const s3 = [state[0] + 0.5 * dt * k2[0], state[1] + 0.5 * dt * k2[1]];
        const k3 = derivative(s3, d);
        const s4 = [state[0] + dt * k3[0], state[1] + dt * k3[1]];
        const k4 = derivative(s4, d);
        return [
            Math.max(0, state[0] + dt / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0])),
            Math.max(0, state[1] + dt / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]))
        ];
    }

    /** Default fixed step: 1/10 of the photon lifetime (and ≤ τ/1000). */
    function suggestedTimeStep(params, fraction) {
        const d = derived(params);
        return Math.min(d.photonLifetime * (fraction || 0.1), d.params.tau / 1000);
    }

    /**
     * Integrate from state0 = {N, q} (default: empty, pump switched on at t=0)
     * over duration tEnd with fixed step dt. onStep(t, state) is optional.
     */
    function integrate(params, options) {
        const opts = options || {};
        const d = derived(params);
        const dt = opts.dt || suggestedTimeStep(params);
        const tEnd = opts.tEnd;
        const s0 = opts.state0 || {
            N: 0,
            q: 0
        };
        let state = [s0.N, s0.q];
        const steps = Math.max(1, Math.round(tEnd / dt));
        const h = tEnd / steps;
        let t = 0;
        let qMax = state[1];
        for (let i = 0; i < steps; i++) {
            state = rk4Step(state, h, d);
            t += h;
            if (state[1] > qMax) qMax = state[1];
            if (opts.onStep) opts.onStep(t, state);
        }
        return {
            t,
            N: state[0],
            q: state[1],
            qMax,
            dt: h,
            steps
        };
    }

    /** Exact steady state of the rate equations (including β). */
    function steadyState(params) {
        const d = derived(params);
        const p = d.params;
        const G = d.coupling;
        const tp = d.photonLifetime;
        // G q² + q (1/τ − Rp τ_p G) − Rp τ_p β/τ = 0, positive root
        const a = G;
        const b = 1 / p.tau - p.pumpRate * tp * G;
        const c = -p.pumpRate * tp * p.beta / p.tau;
        let q;
        if (c === 0) q = Math.max(0, -b / a);
        else {
            const disc = Math.sqrt(b * b - 4 * a * c);
            // numerically stable positive root
            q = b >= 0 ? (-2 * c) / (b + disc) : (-b + disc) / (2 * a);
        }
        const N = p.pumpRate / (1 / p.tau + G * q);
        return {
            N,
            q
        };
    }

    function powers(params, q) {
        const d = derived(params);
        const circulating = q * d.photonEnergy / d.roundTripTime;
        const output = d.params.outputCoupling === "budget" ?
            Math.log(1 / d.params.R2) * circulating :
            d.outputTransmission * circulating;
        return {
            circulating,
            output
        };
    }

    /**
     * Exact photon/excitation bookkeeping for state {N, q} [all rates in 1/s].
     * dE/dt = pump − spontaneous − (output + backMirror + internal) with E = N + q,
     * where the three loss channels split q/τ_p by ln(1/R2) : ln(1/R1) : 2αL.
     */
    function photonBudget(params, state) {
        const d = derived(params);
        const p = d.params;
        const loss = state.q / d.photonLifetime;
        const spontaneous = (1 - p.beta) * state.N / p.tau;
        const out = {
            pump: p.pumpRate,
            spontaneous,
            output: loss * Math.log(1 / p.R2) / d.logLossPerRoundTrip,
            backMirror: loss * Math.log(1 / p.R1) / d.logLossPerRoundTrip,
            internal: loss * 2 * p.alpha * p.L / d.logLossPerRoundTrip,
            totalLoss: loss
        };
        out.storedRate = out.pump - spontaneous - loss; // d(N + q)/dt
        return out;
    }

    // ------------------------------------------------------------ L–I (pump sweep)
    /** Pump rate [1/s] for an absorbed pump power [W] (unit quantum efficiency). */
    function pumpRateFromPower(params, pumpPower) {
        return pumpPower / derived(params).pumpPhotonEnergy;
    }

    /** Analytic slope efficiency dPout/dPp above threshold (β → 0). */
    function slopeEfficiency(params) {
        const d = derived(params);
        return d.photonEnergy / d.pumpPhotonEnergy * d.outputFraction;
    }

    /** Analytic above-threshold output (β → 0): max(0, η_s (Pp − Pp_th)). */
    function analyticOutput(params, pumpPower) {
        const d = derived(params);
        const P = pumpPower == null ? d.pumpPower : pumpPower;
        return Math.max(0, slopeEfficiency(params) * (P - d.thresholdPumpPower));
    }

    /**
     * Integrate to steady state. Returns {N, q, t, steps, converged}.
     * opts: { state0 = {N:0,q:0}, dt (default τ_p/2: RK4 fixed points are the exact
     * equilibria, so a coarse stable step converges to the exact steady state),
     * tol = 1e-7 (relative rates × τ), maxTime = 40 τ }.
     */
    function settle(params, opts) {
        const o = opts || {};
        const sweep = createSettler(params, o);
        while (!sweep.done) sweep.advance(1e6);
        return sweep.result();
    }

    function createSettler(params, opts) {
        const o = opts || {};
        const d = derived(params);
        const p = d.params;
        const dt = o.dt || d.photonLifetime / 2;
        const tol = o.tol || 1e-7;
        const maxTime = o.maxTime || 40 * p.tau;
        const s0 = o.state0 || {
            N: 0,
            q: 0
        };
        let state = [s0.N, s0.q];
        let t = 0,
            steps = 0,
            calm = 0,
            converged = false;
        const checkEvery = 64;
        const api = {
            done: false,
            advance(maxSteps) {
                let n = 0;
                while (!api.done && n < maxSteps) {
                    state = rk4Step(state, dt, d);
                    t += dt;
                    steps++;
                    n++;
                    if (steps % checkEvery === 0) {
                        const k = derivative(state, d);
                        const rN = Math.abs(k[0]) * p.tau / Math.max(state[0], 1e-30);
                        const rq = Math.abs(k[1]) * p.tau / Math.max(state[1], 1e-30);
                        calm = (rN < tol && rq < tol) ? calm + 1 : 0;
                        if (calm >= 3) {
                            converged = true;
                            api.done = true;
                        }
                    }
                    if (t >= maxTime) api.done = true;
                }
                return api.done;
            },
            result: () => ({
                N: state[0],
                q: state[1],
                t,
                steps,
                converged
            })
        };
        return api;
    }

    /** Default sweep powers: n points from 0 to maxPower [W]. */
    function sweepPowers(maxPower, n) {
        const k = n || 16;
        return Array.from({
            length: k
        }, (_, i) => maxPower * i / (k - 1));
    }

    /**
     * Automated pump sweep (L–I curve). Each pump step starts from the settled state of the
     * previous one (a slow staircase ramp), integrates the rate equations to steady state and
     * records the output. Incremental: advance(maxSteps) → done; points holds the finished rows.
     */
    function createPumpSweep(params, pumpPowers, opts) {
        const base = withDefaults(params);
        const points = [];
        let i = 0,
            settler = null,
            state = {
                N: 0,
                q: 0
            };
        const api = {
            points,
            done: pumpPowers.length === 0,
            total: pumpPowers.length,
            advance(maxSteps) {
                let budget = maxSteps;
                while (!api.done && budget > 0) {
                    const Pp = pumpPowers[i];
                    const p = Object.assign({}, base, {
                        pumpRate: pumpRateFromPower(base, Pp)
                    });
                    if (!settler) settler = createSettler(p, Object.assign({}, opts, {
                        state0: state
                    }));
                    const before = settler.result().steps;
                    settler.advance(budget);
                    budget -= settler.result().steps - before;
                    if (settler.done) {
                        const r = settler.result();
                        const pw = powers(p, r.q);
                        const ss = steadyState(p);
                        points.push({
                            pumpPower: Pp,
                            pumpRatio: derived(p).pumpRatio,
                            N: r.N,
                            q: r.q,
                            output: pw.output,
                            circulating: pw.circulating,
                            exactOutput: powers(p, ss.q).output,
                            analyticOutput: analyticOutput(p, Pp),
                            converged: r.converged,
                            settleTime: r.t
                        });
                        state = {
                            N: r.N,
                            q: Math.max(r.q, 1)
                        };
                        settler = null;
                        i++;
                        if (i >= pumpPowers.length) api.done = true;
                    }
                }
                return api.done;
            }
        };
        return api;
    }

    function pumpSweep(params, pumpPowers, opts) {
        const s = createPumpSweep(params, pumpPowers, opts);
        while (!s.done) s.advance(1e6);
        return s.points;
    }

    /**
     * Least-squares line Pout = slope (Pp − threshold) through sweep points with
     * pumpRatio ≥ minRatio (default 1.2). Returns {slope, threshold, n, rms} or null.
     */
    function fitLI(points, minRatio) {
        const rmin = minRatio == null ? 1.2 : minRatio;
        const use = points.filter((pt) => pt.pumpRatio >= rmin);
        const n = use.length;
        if (n < 2) return null;
        let sx = 0,
            sy = 0,
            sxx = 0,
            sxy = 0;
        for (const pt of use) {
            sx += pt.pumpPower;
            sy += pt.output;
            sxx += pt.pumpPower * pt.pumpPower;
            sxy += pt.pumpPower * pt.output;
        }
        const den = n * sxx - sx * sx;
        if (!(den > 0)) return null;
        const slope = (n * sxy - sx * sy) / den;
        const icpt = (sy - slope * sx) / n;
        let ss = 0;
        for (const pt of use) {
            const e = pt.output - (slope * pt.pumpPower + icpt);
            ss += e * e;
        }
        return {
            slope,
            threshold: slope !== 0 ? -icpt / slope : NaN,
            n,
            rms: Math.sqrt(ss / n)
        };
    }

    // ------------------------------------------------------------ relaxation oscillations
    /** Analytic small-signal relaxation oscillation (β → 0). null below threshold. */
    function relaxationAnalytic(params) {
        const d = derived(params);
        const p = d.params;
        const r = d.pumpRatio;
        if (!(r > 1)) return null;
        const w0sq = (r - 1) / (p.tau * d.photonLifetime);
        const gamma = r / (2 * p.tau);
        const wd2 = w0sq - gamma * gamma;
        const overdamped = wd2 <= 0;
        const omega = overdamped ? 0 : Math.sqrt(wd2);
        return {
            pumpRatio: r,
            omega0: Math.sqrt(w0sq),
            omega,
            frequency: omega / (2 * Math.PI),
            period: overdamped ? Infinity : 2 * Math.PI / omega,
            gamma,
            dampingTime: 1 / gamma,
            overdamped
        };
    }

    /**
     * Simulated small-signal response: start at the exact steady state with q kicked by
     * (1 + kick) and integrate the full nonlinear rate equations. Successive maxima of
     * q − q_ss give the measured period and the damping rate γ = ln(m_k/m_{k+1})/T.
     * opts: { kick = 1e-3, periods = 6, dt, samples = 600 }.
     * Returns { frequency, omega, gamma, period, peaks: [{t, dq}], t: [], dq: [] (relative) } or null.
     */
    function relaxationResponse(params, opts) {
        const o = opts || {};
        const an = relaxationAnalytic(params);
        if (!an || an.overdamped) return null;
        const d = derived(params);
        const ss = steadyState(params);
        const kick = o.kick || 1e-3;
        const periods = o.periods || 6;
        const dt0 = o.dt || suggestedTimeStep(params);
        const tEnd = periods * an.period;
        const steps = Math.min(Math.max(1, Math.round(tEnd / dt0)), o.maxSteps || 4e6);
        const h = tEnd / steps;
        const nSamp = o.samples || 600;
        const every = Math.max(1, Math.floor(steps / nSamp));
        let state = [ss.N, ss.q * (1 + kick)];
        const ts = [0],
            dq = [kick];
        const peaks = [];
        let prev2 = NaN,
            prev1 = state[1] - ss.q;
        for (let i = 1; i <= steps; i++) {
            state = rk4Step(state, h, d);
            const cur = state[1] - ss.q;
            if (i >= 2 && prev1 > prev2 && prev1 >= cur && prev1 > 0) {
                // parabolic refinement through the three samples around the maximum
                const den = prev2 - 2 * prev1 + cur;
                const off = den !== 0 ? 0.5 * (prev2 - cur) / den : 0;
                peaks.push({
                    t: (i - 1 + off) * h,
                    dq: (prev1 - 0.25 * (prev2 - cur) * off) / ss.q
                });
            }
            prev2 = prev1;
            prev1 = cur;
            if (i % every === 0) {
                ts.push(i * h);
                dq.push(cur / ss.q);
            }
        }
        if (peaks.length < 2) return null;
        const k = peaks.length - 1;
        const period = (peaks[k].t - peaks[0].t) / k;
        const gamma = Math.log(peaks[0].dq / peaks[k].dq) / (peaks[k].t - peaks[0].t);
        return {
            period,
            omega: 2 * Math.PI / period,
            frequency: 1 / period,
            gamma,
            peaks,
            t: ts,
            dq,
            kick,
            analytic: an
        };
    }

    /** Analytic small-signal response (q − q_ss)/q_ss for a kick at t = 0 with zero N deviation. */
    function relaxationAnalyticCurve(an, kick, t) {
        return kick * Math.exp(-an.gamma * t) * (Math.cos(an.omega * t) + an.gamma / an.omega * Math.sin(an.omega * t));
    }

    // ------------------------------------------------------------ passive cavity (Fabry–Pérot link)
    /** Longitudinal-mode bookkeeping of the passive (cold) cavity. */
    function cavityModes(params) {
        const d = derived(params);
        const p = d.params;
        const fsr = C / (2 * p.L);
        const linewidth = 1 / (2 * Math.PI * d.photonLifetime);
        const rho = Math.sqrt(p.R1 * p.R2 * Math.exp(-2 * p.alpha * p.L)); // round-trip amplitude factor
        return {
            fsr,
            linewidth,
            finesse: fsr / linewidth, // = 2π/δ
            airyFinesse: Math.PI * Math.sqrt(rho) / (1 - rho),
            modeNumber: Math.round(2 * p.L / p.wavelength),
            modesInGainBandwidth: Math.max(1, Math.floor(p.gainBandwidth / fsr))
        };
    }

    const THRESHOLD_TOLERANCE = 0.01; // |Rp/Rp_th − 1| ≤ 1 % counts as "at threshold"

    function classify(params, tolerance) {
        const tol = tolerance == null ? THRESHOLD_TOLERANCE : tolerance;
        const r = derived(params).pumpRatio;
        if (r < 1 - tol) return "below";
        if (r <= 1 + tol) return "at";
        return "above";
    }

    /** Pump rate for a requested multiple of the model's threshold pump rate. */
    function pumpForRatio(params, ratio) {
        return ratio * derived(params).thresholdPumpRate;
    }

    const PRESETS = Object.freeze({
        below: {
            cavity: {
                R2: 0.95,
                L: 0.10,
                gainLength: 0.05,
                alpha: 0.2
            },
            ratio: 0.6
        },
        at: {
            cavity: {
                R2: 0.95,
                L: 0.10,
                gainLength: 0.05,
                alpha: 0.2
            },
            ratio: 1.0
        },
        above: {
            cavity: {
                R2: 0.95,
                L: 0.10,
                gainLength: 0.05,
                alpha: 0.2
            },
            ratio: 2.0
        },
        highPower: {
            cavity: {
                R2: 0.90,
                L: 0.15,
                gainLength: 0.05,
                alpha: 0.1
            },
            ratio: 5.0
        },
        closed: {
            cavity: {
                R2: 1,
                L: 0.10,
                gainLength: 0.05,
                alpha: 0.2
            },
            ratio: 2.0
        },
        nearThreshold: {
            cavity: {
                R2: 0.95,
                L: 0.10,
                gainLength: 0.05,
                alpha: 0.2
            },
            ratio: 1.2
        }
    });

    /** Build preset parameters; the pump is derived from the model's threshold. */
    function preset(name, base) {
        const def = PRESETS[name];
        if (!def) throw new RangeError("Unknown preset " + name);
        const p = withDefaults(Object.assign({}, base || {}, def.cavity));
        p.pumpRate = pumpForRatio(p, def.ratio);
        return p;
    }

    return {
        C,
        H,
        DEFAULTS,
        THRESHOLD_TOLERANCE,
        PRESETS,
        withDefaults,
        derived,
        gainFromInversion,
        roundTripMultiplier,
        thresholdGain,
        derivative,
        rk4Step,
        suggestedTimeStep,
        integrate,
        steadyState,
        powers,
        photonBudget,
        pumpRateFromPower,
        slopeEfficiency,
        analyticOutput,
        settle,
        createSettler,
        sweepPowers,
        createPumpSweep,
        pumpSweep,
        fitLI,
        relaxationAnalytic,
        relaxationResponse,
        relaxationAnalyticCurve,
        cavityModes,
        classify,
        pumpForRatio,
        preset
    };
});