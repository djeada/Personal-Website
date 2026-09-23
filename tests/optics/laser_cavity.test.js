const test = require("node:test");
const assert = require("node:assert/strict");
const m = require("../../src/tools/shared/optics/laserCavity.js");

const C = 299792458;

function relErr(a, b) {
    return Math.abs(a - b) / Math.max(Math.abs(b), 1e-300);
}

test("threshold gain satisfies M = 1 (uniform gain, textbook form)", () => {
    const p = m.withDefaults({ R1: 0.99, R2: 0.9, L: 0.2, gainLength: 0.2, alpha: 0.5 });
    const gth = m.thresholdGain(p);
    // g_th = α + ln(1/(R1R2))/(2L)
    assert.ok(relErr(gth, 0.5 + Math.log(1 / (0.99 * 0.9)) / 0.4) < 1e-12);
    assert.ok(Math.abs(m.roundTripMultiplier(p, gth) - 1) < 1e-12);
    assert.ok(m.roundTripMultiplier(p, 0.9 * gth) < 1);
    assert.ok(m.roundTripMultiplier(p, 1.1 * gth) > 1);
});

test("partial gain medium: only l_g enters the gain exponent", () => {
    const p = m.withDefaults({ R1: 0.99, R2: 0.9, L: 0.2, gainLength: 0.05, alpha: 0.5 });
    const gth = m.thresholdGain(p);
    // R1 R2 exp(2 g l_g − 2 α L) = 1
    const expected = (2 * 0.5 * 0.2 + Math.log(1 / (0.99 * 0.9))) / (2 * 0.05);
    assert.ok(relErr(gth, expected) < 1e-12);
});

test("empty cavity: photon number falls by R1 R2 exp(-2αL) per round trip", () => {
    for (const L of [0.05, 0.1, 0.3]) {
        const p = { R1: 0.99, R2: 0.8, L, gainLength: 0.05, alpha: 0.3, beta: 0, pumpRate: 0 };
        const d = m.derived(p);
        assert.ok(relErr(d.roundTripTime, 2 * L / C) < 1e-12);
        const n = 5;
        const r = m.integrate(p, { tEnd: n * d.roundTripTime, state0: { N: 0, q: 1e6 }, dt: d.photonLifetime / 50 });
        const expected = 1e6 * Math.pow(0.99 * 0.8 * Math.exp(-2 * 0.3 * L), n);
        assert.ok(relErr(r.q, expected) < 1e-6, `L=${L}: ${r.q} vs ${expected}`);
    }
});

test("with a frozen inversion, the rate model reproduces the round-trip multiplier", () => {
    // Very long τ and no pump: N stays essentially constant over one round trip.
    const base = { R1: 0.99, R2: 0.9, L: 0.12, gainLength: 0.04, alpha: 0.2, beta: 0, tau: 1e6, pumpRate: 0 };
    for (const factor of [0.5, 1, 1.5]) {
        const d = m.derived(base);
        const N0 = factor * d.thresholdInversion;
        const g = m.gainFromInversion(base, N0);
        const M = m.roundTripMultiplier(base, g);
        const r = m.integrate(base, { tEnd: d.roundTripTime, state0: { N: N0, q: 10 }, dt: d.photonLifetime / 50 });
        assert.ok(relErr(r.q / 10, M) < 1e-6, `factor ${factor}: ${r.q / 10} vs ${M}`);
        if (factor === 1) assert.ok(Math.abs(M - 1) < 1e-12);
    }
});

test("presets are derived from the model: 'at' lies at threshold within tolerance", () => {
    const at = m.preset("at");
    assert.equal(m.classify(at), "at");
    assert.ok(Math.abs(m.derived(at).pumpRatio - 1) <= m.THRESHOLD_TOLERANCE);
    assert.equal(m.classify(m.preset("below")), "below");
    assert.equal(m.classify(m.preset("above")), "above");
    assert.equal(m.classify(m.preset("highPower")), "above");
    // derived for whatever cavity: changing base parameters moves the preset pump
    const lossy = m.preset("at", { R1: 0.97 });
    assert.equal(m.classify(lossy), "at");
    assert.ok(lossy.pumpRate > at.pumpRate);
});

test("steady state: ~no photons below threshold, τ_p(Rp − Rp_th) above", () => {
    const below = m.preset("below");
    const above = m.preset("above");
    const tEnd = 4e-3; // ≫ τ and the relaxation-oscillation damping time
    const rb = m.integrate(below, { tEnd });
    const ra = m.integrate(above, { tEnd });
    const db = m.derived(below);
    const da = m.derived(above);
    // below: only spontaneous emission into the mode, N → Rp τ < N_th
    assert.ok(rb.q < 1e3, `below q=${rb.q}`);
    assert.ok(relErr(rb.N, below.pumpRate * below.tau) < 1e-3);
    // above: inversion clamps at N_th and q → τ_p (Rp − Rp_th)
    const qTheory = da.photonLifetime * (above.pumpRate - da.thresholdPumpRate);
    assert.ok(relErr(ra.q, qTheory) < 1e-3, `above q=${ra.q} vs ${qTheory}`);
    assert.ok(relErr(ra.N, da.thresholdInversion) < 1e-3);
    assert.ok(rb.q / ra.q < 1e-6);
    // analytic steady state (with β) agrees with the integration
    assert.ok(relErr(ra.q, m.steadyState(above).q) < 1e-3);
    assert.ok(relErr(rb.q, m.steadyState(below).q) < 1e-3);
    assert.ok(db.thresholdPumpRate > below.pumpRate);
});

test("relaxation oscillations: first spike overshoots the steady state above threshold", () => {
    const above = m.preset("above");
    const r = m.integrate(above, { tEnd: 1e-3 });
    assert.ok(r.qMax > 3 * m.steadyState(above).q);
});

test("100 % output mirror gives zero transmitted output", () => {
    const p = m.preset("above", { R2: 1 });
    const pp = Object.assign({}, p, { R2: 1 });
    pp.pumpRate = m.pumpForRatio(pp, 2);
    const r = m.integrate(pp, { tEnd: 2e-3 });
    assert.ok(r.q > 1e6, "still lases internally");
    const pw = m.powers(pp, r.q);
    assert.equal(pw.output, 0);
    assert.ok(pw.circulating > 0);
});

test("output power Pout = T2 · q hν / T_rt", () => {
    const p = m.withDefaults({ R2: 0.9, L: 0.2 });
    const hv = 6.62607015e-34 * C / p.wavelength;
    const pw = m.powers(p, 1e10);
    assert.ok(relErr(pw.circulating, 1e10 * hv / (0.4 / C)) < 1e-12);
    assert.ok(relErr(pw.output, 0.1 * pw.circulating) < 1e-9);
});

test("fixed-step RK4 converges as dt decreases (through relaxation spikes)", () => {
    const p = m.preset("above");
    const tp = m.derived(p).photonLifetime;
    const tEnd = 300e-6; // covers pump build-up and the first spikes
    const runs = [0.4, 0.2, 0.1, 0.05].map((f) => m.integrate(p, { tEnd, dt: f * tp }));
    const ref = runs[3];
    const errs = runs.slice(0, 3).map((r) => relErr(r.N, ref.N) + relErr(r.q, ref.q));
    assert.ok(errs[1] < errs[0] && errs[2] < errs[1], `errors not decreasing: ${errs}`);
    assert.ok(errs[2] < 1e-4, `default-step error too large: ${errs[2]}`);
});

test("cavity length changes T_rt, τ_p and threshold consistently", () => {
    // α = 0: doubling L doubles T_rt and τ_p; threshold gain (fixed l_g) unchanged;
    // threshold inversion scales with 1/(G τ_p) = A L/(cστ_p) → unchanged.
    const a = m.derived({ L: 0.1, alpha: 0, gainLength: 0.05 });
    const b = m.derived({ L: 0.2, alpha: 0, gainLength: 0.05 });
    assert.ok(relErr(b.roundTripTime / a.roundTripTime, 2) < 1e-12);
    assert.ok(relErr(b.photonLifetime / a.photonLifetime, 2) < 1e-12);
    assert.ok(relErr(b.thresholdGain, a.thresholdGain) < 1e-12);
    // With internal loss, longer cavity → larger αL → higher threshold
    const c1 = m.derived({ L: 0.1, alpha: 1, gainLength: 0.05 });
    const c2 = m.derived({ L: 0.2, alpha: 1, gainLength: 0.05 });
    assert.ok(c2.thresholdGain > c1.thresholdGain);
    assert.ok(c2.thresholdPumpRate > c1.thresholdPumpRate);
    // Uniform gain (l_g = L): g_th = α + ln(1/(R1R2))/(2L) decreases with L
    const u1 = m.derived({ L: 0.1, gainLength: 0.1, alpha: 0.2 });
    const u2 = m.derived({ L: 0.3, gainLength: 0.3, alpha: 0.2 });
    assert.ok(u2.thresholdGain < u1.thresholdGain);
    // simulated empty-cavity 1/e decay time equals τ_p for each L
    for (const L of [0.1, 0.2]) {
        const p = { L, alpha: 0, gainLength: 0.05, beta: 0, pumpRate: 0 };
        const d = m.derived(p);
        const r = m.integrate(p, { tEnd: d.photonLifetime, state0: { N: 0, q: 1 } });
        assert.ok(relErr(r.q, Math.exp(-1)) < 1e-6);
    }
});

test("rejects unphysical geometry", () => {
    assert.throws(() => m.derived({ L: 0.05, gainLength: 0.06 }), RangeError);
    assert.throws(() => m.derived({ R1: 1, R2: 1, alpha: 0 }), RangeError);
});

// ---------------------------------------------------------------- L–I curve (pump sweep)

test("pump sweep: integrated L–I slope and threshold match the analytic above-threshold solution", () => {
    for (const mode of ["transmission", "budget"]) {
        const base = m.withDefaults({ outputCoupling: mode });
        const d = m.derived(base);
        const pts = m.pumpSweep(base, m.sweepPowers(3 * d.thresholdPumpPower, 13));
        assert.ok(pts.every((p) => p.converged), "every sweep point settled");
        const fit = m.fitLI(pts, 1.2);
        const eta = m.slopeEfficiency(base);
        assert.ok(fit.n >= 6);
        assert.ok(relErr(fit.slope, eta) < 1e-5, `${mode}: slope ${fit.slope} vs ${eta}`);
        assert.ok(relErr(fit.threshold, d.thresholdPumpPower) < 1e-5, `${mode}: threshold ${fit.threshold}`);
        // integrated fixed points equal the exact algebraic steady state (β included);
        // exactly at threshold the approach is critically slow, so it is checked more loosely
        for (const p of pts) {
            if (!(p.output > 0)) continue;
            const tol = Math.abs(p.pumpRatio - 1) < 0.05 ? 1e-3 : 1e-5;
            assert.ok(relErr(p.output, p.exactOutput) < tol, `r=${p.pumpRatio}: ${p.output} vs ${p.exactOutput}`);
        }
        // below threshold: only spontaneous emission, many orders below the lasing output
        const below = pts.filter((p) => p.pumpRatio < 0.8 && p.pumpRatio > 0);
        const above = pts.find((p) => p.pumpRatio > 1.2);
        assert.ok(below.length >= 2);
        below.forEach((p) => assert.ok(p.output < 1e-6 * above.output));
    }
});

test("slope efficiency limits: quantum defect, zero coupling, and bookkeeping agreement", () => {
    // Loss-free except the output coupler, exact bookkeeping: every extra pump photon
    // leaves as a laser photon → η = hν/hν_p = λp/λ (quantum-defect limit).
    const ideal = m.withDefaults({ R1: 1, R2: 0.9, alpha: 0, outputCoupling: "budget" });
    assert.ok(relErr(m.slopeEfficiency(ideal), ideal.pumpWavelength / ideal.wavelength) < 1e-12);
    // check by a finite difference of integrated steady states (not the formula)
    const d = m.derived(ideal);
    const [a, b] = m.pumpSweep(ideal, [2 * d.thresholdPumpPower, 3 * d.thresholdPumpPower]);
    const fd = (b.output - a.output) / (b.pumpPower - a.pumpPower);
    assert.ok(relErr(fd, ideal.pumpWavelength / ideal.wavelength) < 1e-5, `fd slope ${fd}`);
    // R2 → 1: no output coupling → η → 0
    assert.equal(m.slopeEfficiency({ R2: 1 }), 0);
    // T2 → 0: the two bookkeeping options agree to O(T2): η_T/η_budget = T2/ln(1/R2) ≈ 1 − T2/2
    for (const R2 of [0.99, 0.999]) {
        const r = m.slopeEfficiency({ R2 }) / m.slopeEfficiency({ R2, outputCoupling: "budget" });
        assert.ok(Math.abs(r - (1 - (1 - R2) / 2)) < 2 * (1 - R2) ** 2, `R2=${R2}: ${r}`);
    }
});

test("exact bookkeeping: pump = spontaneous + output + back mirror + internal in steady state", () => {
    const p = m.preset("above", { outputCoupling: "budget" });
    const s = m.settle(p);
    const b = m.photonBudget(p, s);
    const sum = b.spontaneous + b.output + b.backMirror + b.internal;
    assert.ok(relErr(sum, b.pump) < 1e-6, `budget ${sum} vs pump ${b.pump}`);
    // output photon rate × hν is exactly the reported output power in this mode
    const hv = m.derived(p).photonEnergy;
    assert.ok(relErr(b.output * hv, m.powers(p, s.q).output) < 1e-12);
    // and the transmission option under-reports it by T2/ln(1/R2)
    const pt = Object.assign({}, p, { outputCoupling: "transmission" });
    assert.ok(relErr(m.powers(pt, s.q).output / m.powers(p, s.q).output, 0.05 / Math.log(1 / 0.95)) < 1e-12);
});

// ---------------------------------------------------------------- relaxation oscillations

test("relaxation oscillation: simulated small-signal frequency and damping match the analytic estimate", () => {
    for (const r of [1.2, 2, 5]) {
        const p = m.withDefaults({});
        p.pumpRate = m.pumpForRatio(p, r);
        const an = m.relaxationAnalytic(p);
        const meas = m.relaxationResponse(p, { kick: 1e-3, periods: 6 });
        assert.ok(meas.peaks.length >= 4);
        assert.ok(relErr(meas.frequency, an.frequency) < 1e-3, `r=${r}: f ${meas.frequency} vs ${an.frequency}`);
        assert.ok(relErr(meas.gamma, an.gamma) < 0.01, `r=${r}: γ ${meas.gamma} vs ${an.gamma}`);
        // order of magnitude sanity for Nd:YAG-like values: tens to hundreds of kHz
        assert.ok(an.frequency > 1e4 && an.frequency < 1e6);
    }
    // below threshold there is no oscillation
    assert.equal(m.relaxationAnalytic(m.preset("below")), null);
});

test("relaxation oscillation: late peaks of the full turn-on transient approach the small-signal period", () => {
    const p = m.preset("above");
    const an = m.relaxationAnalytic(p);
    const qss = m.steadyState(p).q;
    const peaks = [];
    let a = NaN, b = NaN;
    m.integrate(p, { tEnd: 2.5e-3, onStep: (t, s) => { if (b > a && b >= s[1]) peaks.push({ t, q: b }); a = b; b = s[1]; } });
    const first = peaks[1].t - peaks[0].t;
    const lateSet = peaks.slice(-10);
    const late = (lateSet[9].t - lateSet[0].t) / 9;
    assert.ok(relErr(late, an.period) < 5e-3, `late spacing ${late} vs ${an.period}`);
    // large-signal spikes are slower than the linear estimate (nonlinear regime)
    assert.ok(first > 1.5 * an.period, `first spacing ${first}`);
    assert.ok(peaks[0].q > 10 * qss);
});

// ---------------------------------------------------------------- passive cavity link

test("passive cavity: FSR = c/2L and finesse 2π/δ → Airy finesse in the low-loss limit", () => {
    for (const L of [0.05, 0.3]) {
        const cm = m.cavityModes({ L, gainLength: 0.05 });
        assert.ok(relErr(cm.fsr, C / (2 * L)) < 1e-12);
        // linewidth × photon lifetime = 1/2π (Lorentzian of an exponentially decaying field energy)
        assert.ok(relErr(cm.linewidth * 2 * Math.PI * m.derived({ L, gainLength: 0.05 }).photonLifetime, 1) < 1e-12);
    }
    const lowLoss = m.cavityModes({ R1: 0.999, R2: 0.998, alpha: 0 });
    assert.ok(relErr(lowLoss.finesse, lowLoss.airyFinesse) < 1e-3);
    const lossy = m.cavityModes({ R1: 0.9, R2: 0.3, alpha: 0 });
    assert.ok(relErr(lossy.finesse, lossy.airyFinesse) > 10 * relErr(lowLoss.finesse, lowLoss.airyFinesse),
        "mean-field finesse deviates more at high loss");
});

test("new presets: closed cavity lases with zero output; near-threshold preset oscillates slowly", () => {
    const closed = m.preset("closed");
    assert.equal(closed.R2, 1);
    assert.equal(m.classify(closed), "above");
    assert.equal(m.analyticOutput(closed), 0);
    const near = m.preset("nearThreshold");
    const fast = m.preset("highPower");
    assert.ok(m.relaxationAnalytic(near).frequency < m.relaxationAnalytic(m.preset("above")).frequency);
    assert.ok(m.relaxationAnalytic(fast).frequency > m.relaxationAnalytic(m.preset("above")).frequency);
    assert.throws(() => m.derived({ outputCoupling: "magic" }), RangeError);
});
