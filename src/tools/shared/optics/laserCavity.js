(function(root, factory) {
    const m = factory();
    if (typeof module === "object" && module.exports) module.exports = m;
    else {
        root.OpticsModels = root.OpticsModels || {};
        root.OpticsModels.laserCavity = m;
    }
})(typeof self !== "undefined" ? self : this, function() {
    "use strict";

    const C = 299792458;
    const H = 6.62607015e-34;


    const DEFAULTS = Object.freeze({
        R1: 0.998,
        R2: 0.95,
        L: 0.10,
        gainLength: 0.05,
        alpha: 0.2,
        sigma: 2.8e-23,
        tau: 230e-6,
        area: Math.PI * 0.5e-3 * 0.5e-3,
        beta: 1e-9,
        wavelength: 1064e-9,
        pumpWavelength: 808e-9,
        pumpRate: 0,
        gainBandwidth: 120e9,
        outputCoupling: "transmission"
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
        const coupling = C * p.sigma / (p.area * p.L);
        const thresholdInversion = 1 / (coupling * photonLifetime);
        const thresholdPumpRate = thresholdInversion / p.tau;
        const thresholdGain = logLossPerRoundTrip / (2 * p.gainLength);
        const photonEnergy = H * C / p.wavelength;
        const pumpPhotonEnergy = H * C / p.pumpWavelength;
        const outputTransmission = 1 - p.R2;

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


    function suggestedTimeStep(params, fraction) {
        const d = derived(params);
        return Math.min(d.photonLifetime * (fraction || 0.1), d.params.tau / 1000);
    }


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


    function steadyState(params) {
        const d = derived(params);
        const p = d.params;
        const G = d.coupling;
        const tp = d.photonLifetime;

        const a = G;
        const b = 1 / p.tau - p.pumpRate * tp * G;
        const c = -p.pumpRate * tp * p.beta / p.tau;
        let q;
        if (c === 0) q = Math.max(0, -b / a);
        else {
            const disc = Math.sqrt(b * b - 4 * a * c);

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
        out.storedRate = out.pump - spontaneous - loss;
        return out;
    }



    function pumpRateFromPower(params, pumpPower) {
        return pumpPower / derived(params).pumpPhotonEnergy;
    }


    function slopeEfficiency(params) {
        const d = derived(params);
        return d.photonEnergy / d.pumpPhotonEnergy * d.outputFraction;
    }


    function analyticOutput(params, pumpPower) {
        const d = derived(params);
        const P = pumpPower == null ? d.pumpPower : pumpPower;
        return Math.max(0, slopeEfficiency(params) * (P - d.thresholdPumpPower));
    }


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


    function sweepPowers(maxPower, n) {
        const k = n || 16;
        return Array.from({
            length: k
        }, (_, i) => maxPower * i / (k - 1));
    }


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


    function relaxationAnalyticCurve(an, kick, t) {
        return kick * Math.exp(-an.gamma * t) * (Math.cos(an.omega * t) + an.gamma / an.omega * Math.sin(an.omega * t));
    }



    function cavityModes(params) {
        const d = derived(params);
        const p = d.params;
        const fsr = C / (2 * p.L);
        const linewidth = 1 / (2 * Math.PI * d.photonLifetime);
        const rho = Math.sqrt(p.R1 * p.R2 * Math.exp(-2 * p.alpha * p.L));
        return {
            fsr,
            linewidth,
            finesse: fsr / linewidth,
            airyFinesse: Math.PI * Math.sqrt(rho) / (1 - rho),
            modeNumber: Math.round(2 * p.L / p.wavelength),
            modesInGainBandwidth: Math.max(1, Math.floor(p.gainBandwidth / fsr))
        };
    }

    const THRESHOLD_TOLERANCE = 0.01;

    function classify(params, tolerance) {
        const tol = tolerance == null ? THRESHOLD_TOLERANCE : tolerance;
        const r = derived(params).pumpRatio;
        if (r < 1 - tol) return "below";
        if (r <= 1 + tol) return "at";
        return "above";
    }


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