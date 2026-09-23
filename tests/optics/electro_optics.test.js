"use strict";
// Electro-/acousto-optic modulators and directional coupler: analytic benchmarks, conservation,
// limiting cases and independent cross-checks (FFT vs Bessel, RK4 vs matrix exponential,
// Jones products from polarization.js).
const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("../../src/tools/shared/optics/electroOptics.js");
const core = require("../../src/tools/shared/optics/core.js");
const Pol = require("../../src/tools/shared/optics/polarization.js");

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ""} expected ${b}, got ${a} (tol ${tol})`);
const LN = { lambda0: 1.55e-6, n: E.lnbIndex(1.55e-6).ne, r: E.MATERIALS.LiNbO3.r33, d: 10e-6, L: 20e-3, overlap: 0.5 };

test("LiNbO3 Sellmeier reproduces tabulated indices (Zelmon 1997) and V_π scales as λd/(n³rLΓ)", () => {
    const { ne, no } = E.lnbIndex(1.55e-6);
    close(ne, 2.1376, 5e-4, "n_e(1550)");
    close(no, 2.2111, 5e-4, "n_o(1550)");
    const n633 = E.lnbIndex(632.8e-9);
    close(n633.ne, 2.2028, 2e-3, "n_e(633)");
    // physical scaling of V_π: ∝ d, ∝ 1/L, ∝ 1/Γ
    const v0 = E.vPiPhase(LN);
    close(E.vPiPhase({ ...LN, d: 2 * LN.d }) / v0, 2, 1e-12);
    close(E.vPiPhase({ ...LN, L: 2 * LN.L }) / v0, 0.5, 1e-12);
    close(E.vPiPhase({ ...LN, overlap: 1 }) / v0, 0.5, 1e-12);
    // phase shift at V_π is π by definition, and linear in V
    close(E.phaseShift(LN, v0), Math.PI, 1e-12);
    close(E.phaseShift(LN, -0.5 * v0), -Math.PI / 2, 1e-12);
    // declared default geometry lands in the few-volt range of commercial LiNbO3 phase modulators
    assert.ok(v0 > 3 && v0 < 8, "V_π = " + v0);
    // KDP longitudinal V_π is independent of dimensions: ≈ 7.5 kV at 546 nm (Yariv & Yeh Table 9.2 lists 7.6 kV)
    close(E.vPiKDP(546e-9) / 1e3, 7.5, 0.3, "KDP V_π at 546 nm (kV)");
});

test("phase-modulation sidebands: Σ J_n² = 1, spacing = f_m, carrier null at β = j0,1, FFT agrees with Bessel", () => {
    const fm = 10e9;
    for (const beta of [0, 0.2, 1, 2.404825557695773, 5, 12]) {
        const sb = E.pmSidebands(beta, fm);
        const sum = sb.reduce((s, x) => s + x.power, 0);
        close(sum, 1, 1e-12, "Σ J_n² at β = " + beta);
        for (let i = 1; i < sb.length; i++) close(sb[i].offset - sb[i - 1].offset, fm, 1e-3, "spacing");
        // independent: FFT of the sampled envelope exp(iβ sin Ωt)
        const num = E.spectrumFromEnvelope((t) => core.complex.expi(beta * Math.sin(2 * Math.PI * fm * t)), fm, 256);
        for (const s of sb) {
            const k = num.find((x) => x.n === s.n);
            close(k.amp.re, s.amp.re, 1e-12, "Re c_" + s.n);
            close(k.amp.im, s.amp.im, 1e-12, "Im c_" + s.n);
        }
        // symmetric power spectrum
        for (const s of sb) close(s.power, sb.find((x) => x.n === -s.n).power, 1e-15);
    }
    const nul = E.pmSidebands(core.besselJZero(0, 1), fm);
    close(nul.find((x) => x.n === 0).power, 0, 1e-24, "carrier suppressed at β = 2.405");
    // small-index limit: J1² ≈ β²/4
    const small = E.pmSidebands(0.02, fm);
    close(small.find((x) => x.n === 1).power / (0.02 * 0.02 / 4), 1, 1e-3);
    // Carson bandwidth contains ≥ 98 % of the power
    for (const beta of [0.5, 2, 5, 10]) {
        const bw = E.pmBandwidth(beta, fm).carson / 2;
        const inside = E.pmSidebands(beta, fm).filter((x) => Math.abs(x.offset) <= bw + 1).reduce((s, x) => s + x.power, 0);
        assert.ok(inside >= 0.98, "Carson power fraction " + inside + " at β = " + beta);
    }
});

test("MZM: ideal endpoints 1/0 at V = 0/V_π, both ports conserve power, cos² law, finite extinction", () => {
    const VpiPM = E.vPiPhase(LN);
    for (const cfg of [{ s1: 1, s2: 1 }, { s1: 1, s2: 0 }, { s1: 1, s2: 0.4 }]) {
        const p = { VpiPM, ...cfg };
        const Vpi = E.mzmParams(p).Vpi;
        close(Vpi, VpiPM / (cfg.s1 + cfg.s2), 1e-12, "V_π of MZM");
        close(E.mzmTransfer(p, 0), 1, 1e-14, "P(0)");
        close(E.mzmTransfer(p, Vpi), 0, 1e-14, "P(V_π)");
        close(E.mzmTransfer(p, 2 * Vpi), 1, 1e-13, "P(2V_π)");
        for (const bias of [0, 0.7, Math.PI / 2, Math.PI]) {
            for (const V of [-3, -1.1, 0, 0.4, 2.2, 7]) {
                const f = E.mzmFields({ ...p, bias }, V);
                close(f.P1 + f.P2, 1, 1e-14, "port sum");
                close(f.P2, Math.pow(Math.cos(Math.PI * V / (2 * Vpi) + bias / 2), 2), 1e-13, "cos² law");
            }
        }
    }
    // finite extinction ratio: P_max/P_min equals the requested ER, both ports still sum to 1
    for (const erDb of [10, 20, 30]) {
        const p = { VpiPM, erDb };
        const Vpi = E.mzmParams(p).Vpi;
        const pmax = E.mzmTransfer(p, 0), pmin = E.mzmTransfer(p, Vpi);
        close(10 * Math.log10(pmax / pmin), erDb, 1e-9, "ER");
        for (const V of [0, 0.3, 1.7]) { const f = E.mzmFields(p, V); close(f.P1 + f.P2, 1, 1e-14); }
    }
});

test("MZM small-signal slope at quadrature = π/(2V_π) (numerical derivative), even harmonics vanish there", () => {
    const p = { VpiPM: 6, bias: Math.PI / 2 };
    const Vpi = E.mzmParams(p).Vpi;
    const h = 1e-6;
    const slope = (E.mzmTransfer(p, h) - E.mzmTransfer(p, -h)) / (2 * h);
    close(Math.abs(slope), Math.PI / (2 * Vpi), 1e-8, "|dP/dV| at quadrature");
    close(E.mzmSlope(p, 0), slope, 1e-8, "analytic slope");
    // quadrature is the steepest point of the transfer curve
    for (const b of [0.2, 1, 2.5]) assert.ok(Math.abs(E.mzmSlope({ ...p, bias: b }, 0)) <= Math.abs(slope) + 1e-12);
    // detected power under sine drive: P = ½ − ½ sin(β sin Ωt) at quadrature → H_n = J_n(β), odd only
    for (const frac of [0.05, 0.2, 0.5]) {
        const beta = Math.PI * frac; // Vm = frac·V_π
        const hm = E.mzmHarmonics(p, frac * Vpi);
        close(hm.dc, 0.5, 1e-12);
        close(hm.h[0], core.besselJ(1, beta), 1e-12, "fundamental");
        close(hm.h[1], 0, 1e-12, "2nd harmonic at quadrature");
        close(hm.h[2], Math.abs(core.besselJ(3, beta)), 1e-12, "3rd harmonic");
    }
    // small-signal HD3 → β²/24 (series of J3/J1)
    const b = Math.PI * 0.02;
    const hm = E.mzmHarmonics(p, 0.02 * Vpi);
    close(Math.pow(10, hm.hd3 / 20) / (b * b / 24), 1, 2e-3);
    // off quadrature a second harmonic appears
    assert.ok(E.mzmHarmonics({ ...p, bias: 1.0 }, 0.2 * Vpi).h[1] > 1e-3);
});

test("MZM chirp: push-pull α = 0, single-arm |α| = 1 at quadrature; closed form matches field derivative", () => {
    const base = { VpiPM: 5 };
    for (const bias of [Math.PI / 2, 1.1, 2.3]) {
        close(E.mzmChirp({ ...base, bias }), 0, 1e-15, "push-pull");
        close(E.mzmChirpNumeric({ ...base, bias }), 0, 1e-8, "push-pull numeric");
        for (const s2 of [0, 0.3, 0.8]) {
            const p = { ...base, bias, s2 };
            close(E.mzmChirpNumeric(p), E.mzmChirp(p), 1e-6, `α s2=${s2} bias=${bias}`);
        }
    }
    close(Math.abs(E.mzmChirp({ ...base, bias: Math.PI / 2, s2: 0 })), 1, 1e-12);
    // sign of α flips between the two quadrature points (opposite slopes)
    const a1 = E.mzmChirp({ ...base, bias: Math.PI / 2, s2: 0 }), a2 = E.mzmChirp({ ...base, bias: 3 * Math.PI / 2, s2: 0 });
    close(a1, -a2, 1e-12);
});

test("MZM sine-drive optical spectrum: Bessel sidebands match FFT of the field, power conserved, null bias suppresses even orders", () => {
    const fm = 5e9;
    for (const cfg of [{ bias: Math.PI / 2 }, { bias: Math.PI }, { bias: 0.4, s2: 0.3, erDb: 20 }]) {
        const p = { VpiPM: 5, ...cfg };
        const Vm = 1.3;
        const sb = E.mzmSidebands(p, Vm, fm);
        const tot = sb.reduce((s, x) => s + x.power1 + x.power2, 0);
        close(tot, 1, 1e-12, "Σ both ports");
        const num = E.spectrumFromEnvelope((t) => E.mzmFields(p, Vm * Math.sin(2 * Math.PI * fm * t)).out2, fm, 256);
        for (const s of sb) {
            const k = num.find((x) => x.n === s.n);
            close(k.amp.re, s.amp2.re, 1e-12); close(k.amp.im, s.amp2.im, 1e-12);
        }
    }
    const nullBias = E.mzmSidebands({ VpiPM: 5, bias: Math.PI }, 1.3, fm);
    for (const s of nullBias) if (s.n % 2 === 0) close(s.power2, 0, 1e-28, "even order at null, n = " + s.n);
    // push-pull at quadrature (chirp-free): the field is real up to a constant phase → symmetric sidebands
    const q = E.mzmSidebands({ VpiPM: 5, bias: Math.PI / 2 }, 1.3, fm);
    for (const s of q) close(s.power2, q.find((x) => x.n === -s.n).power2, 1e-15);
});

test("NRZ eye: ideal full-swing drive reproduces the static extinction; bandwidth limits close the eye", () => {
    const bits = E.prbs7(254);
    // PRBS7 is periodic with period 127 and contains 64 ones per period
    for (let i = 0; i < 127; i++) assert.equal(bits[i], bits[i + 127]);
    assert.equal(bits.slice(0, 127).reduce((s, b) => s + b, 0), 64);
    const p = { VpiPM: 5, bias: -Math.PI / 2 };
    const Vpi = E.mzmParams(p).Vpi;
    const ideal = E.mzmEye(p, { swing: Vpi, riseFrac: 0 });
    close(ideal.levels.mean1, 1, 1e-12); close(ideal.levels.mean0, 0, 1e-12);
    close(ideal.opening, 1, 1e-12);
    const finite = E.mzmEye({ ...p, erDb: 25 }, { swing: Vpi, riseFrac: 0 });
    close(finite.erDb, 25, 1e-9, "dynamic ER = static ER for full swing");
    const slow = E.mzmEye(p, { swing: Vpi, riseFrac: 1.2 });
    assert.ok(slow.opening < 0.9 * ideal.opening, "ISI closes the eye: " + slow.opening);
    const half = E.mzmEye(p, { swing: Vpi / 2, riseFrac: 0 });
    // half swing about quadrature: levels ½(1 ± sin(π/4))
    close(half.P1, 0.5 * (1 + Math.SQRT1_2), 1e-12); close(half.P0, 0.5 * (1 - Math.SQRT1_2), 1e-12);
});

test("Pockels cell between polarizers: Jones result equals polarization.js product, T⊥ + T∥ = 1, half-wave at V_π", () => {
    const Vpi = E.vPiKDP(1.064e-6);
    for (const [V, g0] of [[0, 0], [0.3 * Vpi, 0], [Vpi, 0], [0.5 * Vpi, Math.PI / 2], [-0.8 * Vpi, 1.1]]) {
        const r = E.pockelsCell({ V, Vpi, gamma0: g0 });
        close(r.Tcrossed + r.Tparallel, 1, 1e-14, "power");
        close(r.Tcrossed, Math.pow(Math.sin(r.gamma / 2), 2), 1e-14);
        // independent: polarizer(0) → retarder(Γ, 45°) → analyzer(90°) with polarization.js
        const Jin = [core.cx(1), core.cx(0)];
        const Jr = Pol.applyJones(Pol.retarder(r.gamma, Math.PI / 4), Jin);
        const Jc = Pol.applyJones(Pol.polarizer(Math.PI / 2), Jr);
        close(Pol.intensity(Jc), r.Tcrossed, 1e-12, "cross-check with polarization.js");
        close(r.stokes.S0, 1, 1e-14);
        close(r.stokes.S1 ** 2 + r.stokes.S2 ** 2 + r.stokes.S3 ** 2, 1, 1e-12, "fully polarized");
    }
    close(E.pockelsCell({ V: Vpi, Vpi }).Tcrossed, 1, 1e-14, "half-wave voltage");
    close(E.pockelsCell({ V: 0, Vpi }).Tcrossed, 0, 1e-14, "no field: dark between crossed polarizers");
    // λ/4 bias: quadrature, linear small-signal slope π/(2V_π)
    const h = 1e-5 * Vpi;
    const sl = (E.pockelsCell({ V: h, Vpi, gamma0: Math.PI / 2 }).Tcrossed - E.pockelsCell({ V: -h, Vpi, gamma0: Math.PI / 2 }).Tcrossed) / (2 * h);
    close(sl * Vpi, Math.PI / 2, 1e-6);
    // at quarter-wave retardation the output is circular: |S3| = 1
    close(Math.abs(E.pockelsCell({ V: Vpi / 2, Vpi }).stokes.S3), 1, 1e-12);
    // transverse LiNbO3 cell: V_π ∝ d/L
    const a = E.vPiTransverseAmplitude({ lambda0: 1.064e-6, d: 2e-3, L: 20e-3 });
    close(E.vPiTransverseAmplitude({ lambda0: 1.064e-6, d: 1e-3, L: 20e-3 }) / a, 0.5, 1e-12);
});

test("AOM geometry: Bragg angle λ/(2Λ), deflection 2θ_B, frequency shift ±f per order, Klein–Cook Q", () => {
    const m = E.MATERIALS.ao.TeO2;
    const p = { lambda0: 633e-9, fa: 80e6, v: m.v, n: m.n, M2: m.M2, L: 3e-3, H: 1e-3, Pa: 0.5 };
    const a = E.aom(p);
    close(a.Lambda, m.v / p.fa, 1e-15, "Λ = v/f");
    close(a.thetaBOut, Math.asin(p.lambda0 / (2 * a.Lambda)), 1e-15);
    close(a.thetaBOut / (p.lambda0 / (2 * a.Lambda)), 1, 1e-4, "small-angle θ_B");
    close(Math.sin(a.thetaBOut), p.n * Math.sin(a.thetaBIn), 1e-15, "Snell between inside and outside Bragg angle");
    close(a.deflection, 2 * a.thetaBOut, 1e-15);
    // θ_B ∝ f: doubling the acoustic frequency doubles the (small) Bragg angle
    close(E.aom({ ...p, fa: 160e6 }).thetaBOut / a.thetaBOut, 2, 1e-4);
    // Q = K² L / k (k = 2πn/λ0)
    close(a.Q, a.K * a.K * p.L / (2 * Math.PI * p.n / p.lambda0), 1e-12);
    // frequency shift: order m is at f0 + m·fa → per-order spacing = fa, independent of λ
    const f0 = core.constants.c / p.lambda0;
    for (const order of [-2, -1, 1, 2]) close((f0 + order * p.fa - f0) / order, p.fa, 1e-3);
    // efficiency: sin²(ν/2) reaches 1 at P = P100; ν ∝ √P
    close(E.aom({ ...p, Pa: a.P100 }).etaBragg, 1, 1e-12, "100 % at P100");
    close(E.aom({ ...p, Pa: 4 * p.Pa }).nu / a.nu, 2, 1e-12, "ν ∝ √P");
});

test("AOM coupled-wave solver: Raman–Nath limit J_m²(ν), Bragg limit sin²(ν/2), power conserved, RK4 agrees", () => {
    for (const nu of [0.5, 2, 4.5]) {
        const rn = E.aomOrders(nu, 0, 0);
        let s = 0;
        rn.orders.forEach((m, i) => { if (Math.abs(m) <= Math.ceil(nu) + 5) close(rn.power[i], core.besselJ(m, nu) ** 2, 1e-12, "J_m² m=" + m); s += rn.power[i]; });
        close(s, 1, 1e-10, "Σ orders");
    }
    // Bragg limit: large Q, Bragg incidence; the error of the two-wave model shrinks as 1/Q
    const nu = 2.1;
    let prevErr = Infinity;
    for (const Q of [20, 80, 320]) {
        const b = E.aomOrders(nu, Q, 1);
        const i1 = b.orders.indexOf(1);
        const err = Math.abs(b.power[i1] - Math.sin(nu / 2) ** 2);
        assert.ok(err < prevErr, "error decreases with Q");
        prevErr = err;
        close(b.power.reduce((x, y) => x + y, 0), 1, 1e-10);
    }
    assert.ok(prevErr < 5e-3, "two-wave Bragg limit at Q = 320: " + prevErr);
    // full transfer at ν = π in the Bragg regime
    const full = E.aomOrders(Math.PI, 1000, 1);
    assert.ok(full.power[full.orders.indexOf(1)] > 0.995);
    // off-Bragg incidence (a = 0) with large Q: almost no diffraction
    const off = E.aomOrders(2, 200, 0);
    assert.ok(off.power[off.orders.indexOf(0)] > 0.98);
    // independent RK4 integration converges to the matrix exponential (4th order)
    const ref = E.aomOrders(2.5, 8, 1, { M: 7 }).power;
    const e1 = Math.max(...E.aomOrdersRK4(2.5, 8, 1, 400, 7).power.map((v, i) => Math.abs(v - ref[i])));
    const e2 = Math.max(...E.aomOrdersRK4(2.5, 8, 1, 800, 7).power.map((v, i) => Math.abs(v - ref[i])));
    assert.ok(e2 < 1e-7 && e1 / e2 > 10, `RK4 convergence ${e1} → ${e2}`);
});

test("directional coupler: full transfer at L_c, max transfer 1/(1+(Δβ/2κ)²), unitary, Δβ-reversal", () => {
    const Lc = 2e-3, kappa = Math.PI / (2 * Lc);
    const c0 = E.coupler({ kappa, L: Lc });
    close(c0.Lc, Lc, 1e-15);
    close(c0.P2, 1, 1e-14, "full transfer at L_c"); close(c0.P1, 0, 1e-14);
    close(E.coupler({ kappa, L: 2 * Lc }).P1, 1, 1e-14, "back in guide 1 at 2L_c");
    for (const x of [0.3, 1, 2.5]) {
        const dbeta = 2 * kappa * x;
        const prop = E.couplerPropagate({ kappa, dbeta, L: 4 * Lc }, 4001);
        const mx = Math.max(...prop.P2);
        close(mx, 1 / (1 + x * x), 1e-5, "max transfer with mismatch");
        close(E.coupler({ kappa, dbeta, L: Lc }).maxTransfer, 1 / (1 + x * x), 1e-15);
        for (let i = 0; i < prop.z.length; i += 97) close(prop.P1[i] + prop.P2[i], 1, 1e-13, "power conserved");
        // numerical ODE integration (RK4) of the coupled-mode equations agrees with the transfer matrix
        const f = (z, y) => { // y = [Re A1, Im A1, Re A2, Im A2]; dA1 = −iκ A2 e^{iΔβz}, dA2 = −iκ A1 e^{−iΔβz}
            const e = core.complex.expi(dbeta * z), em = core.complex.conj(e);
            const A1 = core.cx(y[0], y[1]), A2 = core.cx(y[2], y[3]);
            const d1 = core.complex.mul(core.cx(0, -kappa), core.complex.mul(A2, e));
            const d2 = core.complex.mul(core.cx(0, -kappa), core.complex.mul(A1, em));
            return Float64Array.of(d1.re, d1.im, d2.re, d2.im);
        };
        const sol = core.integrateRK4(f, 0, [1, 0, 0, 0], 1.3 * Lc, 4000, { record: false }).y[0];
        close(sol[2] ** 2 + sol[3] ** 2, E.coupler({ kappa, dbeta, L: 1.3 * Lc }).P2, 1e-9, "RK4 vs matrix");
    }
    // bar state of a uniform L_c coupler is reached at Δβ = √3·2κ... i.e. Δβ L_c = √3 π
    close(E.coupler({ kappa, dbeta: Math.sqrt(3) * Math.PI / Lc, L: Lc }).P2, 0, 1e-14, "switched to bar");
    // Δβ-reversal: with Δβ = 0 identical to uniform; always unitary; a cross state can be tuned
    // electrically for L = 2 L_c where the uniform coupler can never reach it
    close(E.coupler({ kappa, L: 1.7 * Lc, reversal: true }).P2, E.coupler({ kappa, L: 1.7 * Lc }).P2, 1e-14);
    const L2 = 2 * Lc;
    const uniformMax = Math.max(...Array.from({ length: 400 }, (_, i) => E.coupler({ kappa, dbeta: i * 0.02 * kappa, L: L2 }).P2));
    const revMax = Math.max(...Array.from({ length: 400 }, (_, i) => E.coupler({ kappa, dbeta: i * 0.02 * kappa, L: L2, reversal: true }).P2));
    assert.ok(uniformMax < 0.8, "uniform 2L_c coupler cannot reach full cross: " + uniformMax);
    assert.ok(revMax > 0.999, "Δβ-reversal reaches the cross state: " + revMax);
    const r = E.coupler({ kappa, dbeta: 3 * kappa, L: L2, reversal: true });
    close(r.P1 + r.P2, 1, 1e-14);
    // electro-optic Δβ is linear in V
    const g = { lambda0: 1.55e-6, n: 2.14, r: 30.8e-12, d: 8e-6, overlap: 0.5 };
    close(E.dbetaFromVoltage(g, 6) / E.dbetaFromVoltage(g, 2), 3, 1e-12);
});
