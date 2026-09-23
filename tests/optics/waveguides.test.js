const test = require("node:test");
const assert = require("node:assert/strict");
const W = require("../../src/tools/shared/optics/waveguides.js");
const core = require("../../src/tools/shared/optics/core.js");

const close = (a, b, tol, msg) =>
    assert.ok(Math.abs(a - b) <= tol, `${msg || ""} expected ${b}, got ${a} (tol ${tol})`);

const SLAB = { n1: 1.5, n2: 1.48, d: 6e-6, lambda0: 1.55e-6 };
const SOI = { n1: 3.48, n2: 1.444, d: 0.22e-6, lambda0: 1.55e-6 };
const MULTI = { n1: 1.5, n2: 1.45, d: 12e-6, lambda0: 1.0e-6 };
const SMF = { n1: 1.4492, n2: 1.444, d: 8.2e-6, lambda0: 1.55e-6 };

// ------------------------------------------------------------------ slab
test("slab: every guided mode satisfies n2 k0 < β < n1 k0 (TE and TM, several guides)", () => {
    for (const g of [SLAB, SOI, MULTI, { ...SLAB, d: 0.1e-6 }]) {
        for (const pol of ["TE", "TM"]) {
            const s = W.solveSlab(g, pol);
            assert.ok(s.modes.length > 0);
            for (const m of s.modes) {
                assert.ok(m.beta > g.n2 * s.k0 && m.beta < g.n1 * s.k0, `${pol}${m.m} β out of range`);
                assert.ok(m.b > 0 && m.b < 1);
            }
            // neff strictly decreasing with mode order
            for (let i = 1; i < s.modes.length; i++) assert.ok(s.modes[i].neff < s.modes[i - 1].neff);
        }
    }
});

test("slab: mode count = floor(2V/π) + 1 per polarization (half-thickness V); 2.405 is NOT the slab limit", () => {
    for (let V = 0.05; V < 25; V += 0.37) {
        const d = 2 * V / ((2 * Math.PI / SLAB.lambda0) * W.numericalAperture(SLAB.n1, SLAB.n2));
        for (const pol of ["TE", "TM"]) {
            const s = W.solveSlab({ ...SLAB, d }, pol);
            close(s.V, V, 1e-9);
            assert.equal(s.modes.length, Math.floor(2 * V / Math.PI) + 1, `${pol} V=${V}`);
        }
    }
    // a slab with V = 2.2 (below the fibre's 2.405) already guides TE0 and TE1
    const d = 2 * 2.2 / ((2 * Math.PI / SLAB.lambda0) * W.numericalAperture(SLAB.n1, SLAB.n2));
    assert.equal(W.solveSlab({ ...SLAB, d }, "TE").modes.length, 2);
});

test("slab: fundamental TE0 has no cut-off, b → V² as V → 0", () => {
    for (const V of [1e-3, 1e-2, 0.05]) {
        const u = W.slabU(V, 0, 1);
        assert.ok(Number.isFinite(u) && u < V);
        const b = 1 - (u * u) / (V * V);
        close(b / (V * V), 1, 5 * V * V + 1e-6, `V=${V}`);
    }
    const thin = W.solveSlab({ ...SLAB, d: 5e-9 }, "TE");
    assert.equal(thin.modes.length, 1);
    assert.ok(thin.modes[0].confinement < 0.01, "almost all power in the cladding for a very thin slab");
});

test("slab TE universal b–V curve matches the closed form V = [mπ/2 + atan√(b/(1−b))]/√(1−b)", () => {
    for (const m of [0, 1, 2, 3]) {
        for (const b of [0.05, 0.2, 0.5, 0.8, 0.95]) {
            const V = (m * Math.PI / 2 + Math.atan(Math.sqrt(b / (1 - b)))) / Math.sqrt(1 - b);
            const u = W.slabU(V, m, 1);
            close(1 - (u * u) / (V * V), b, 1e-12, `m=${m}`);
        }
    }
});

test("slab: exact solution obeys the ray transverse-resonance condition with Fresnel TIR phases", () => {
    // 2 kx d − 2·2 atan(γ / (r kx)) = 2π m, r = 1 (TE) or (n2/n1)² (TM): Fresnel phases of s and p TIR
    for (const pol of ["TE", "TM"]) {
        for (const m of W.solveSlab(MULTI, pol).modes) {
            const r = pol === "TM" ? (MULTI.n2 / MULTI.n1) ** 2 : 1;
            const phiR = -2 * Math.atan(m.gamma / (r * m.kx));
            close(2 * m.kx * MULTI.d + 2 * phiR, 2 * Math.PI * m.m, 1e-9, `${pol}${m.m}`);
            // β = n1 k0 cos θ and the ray exceeds the critical angle at the wall
            close(m.beta, MULTI.n1 * m.k0 * Math.cos(m.theta), 1e-6 * m.beta);
            assert.ok(Math.sin(m.incidence) > MULTI.n2 / MULTI.n1);
        }
    }
});

test("slab boundary conditions: field continuous; dE/dx (TE) and (1/n²) dH/dx (TM) continuous (numerical)", () => {
    for (const g of [SLAB, SOI, MULTI]) {
        for (const pol of ["TE", "TM"]) {
            for (const m of W.solveSlab(g, pol).modes) {
                const a = m.a, h = a * 1e-7, H = a * 1e-4;
                for (const xb of [a, -a]) {
                    const fin = W.slabField(m, xb - Math.sign(xb) * h), fout = W.slabField(m, xb + Math.sign(xb) * h);
                    const scale = m.norm;
                    close(fin, fout, 1e-5 * scale, `${pol}${m.m} field`);
                    // one-sided finite differences on each side of the interface (independent of the analytic derivative)
                    const s = Math.sign(xb);
                    const din = (W.slabField(m, xb - s * h) - W.slabField(m, xb - s * (h + H))) / H * s;
                    const dout = (W.slabField(m, xb + s * (h + H)) - W.slabField(m, xb + s * h)) / H * s;
                    const kin = pol === "TM" ? 1 / g.n1 ** 2 : 1, kout = pol === "TM" ? 1 / g.n2 ** 2 : 1;
                    const dscale = scale * (m.kx + m.gamma);
                    close(kin * din, kout * dout, 2e-3 * dscale * Math.max(kin, kout), `${pol}${m.m} derivative`);
                }
                if (pol === "TM" && g === SOI) {
                    // the unscaled derivative (∝ Ez) jumps by (n1/n2)² — TM is not TE
                    const din = W.slabFieldDerivative(m, a - h), dout = W.slabFieldDerivative(m, a + h);
                    close(din / dout, (g.n1 / g.n2) ** 2, 1e-3);
                }
            }
        }
    }
});

test("slab: power normalisation and confinement factor agree with Simpson integration of the field", () => {
    for (const pol of ["TE", "TM"]) {
        for (const m of W.solveSlab(MULTI, pol).modes) {
            const X = m.a + 40 / m.gamma, n = 20000;
            // integrate piecewise so the kink at |x| = a sits on a node; TM weight 1/n² per region
            const w1 = pol === "TM" ? 1 / MULTI.n1 ** 2 : 1, w2 = pol === "TM" ? 1 / MULTI.n2 ** 2 : 1;
            const f = (x) => W.slabField(m, x) ** 2;
            const inCore = w1 * core.simpson(f, -m.a, m.a, n);
            const total = inCore + w2 * (core.simpson(f, m.a, X, n) + core.simpson(f, -X, -m.a, n));
            close(total, 1, 1e-6, `${pol}${m.m} norm`);
            close(inCore / total, m.confinement, 1e-6, `${pol}${m.m} Γ`);
        }
    }
});

test("TE group index (numerical derivative) equals the energy-velocity identity ng·neff = n1²Γ + n2²(1−Γ)", () => {
    for (const g of [SLAB, MULTI, SOI]) {
        for (const m of W.solveSlab(g, "TE").modes) {
            const gi = W.groupIndex("slab", g, m.label);
            const rhs = (g.n1 ** 2 * m.confinement + g.n2 ** 2 * (1 - m.confinement)) / m.neff;
            close(gi.ng, rhs, 2e-6, `${m.label}`);
            assert.ok(gi.ng > m.neff, "normal waveguide dispersion: ng > neff for these modes");
        }
    }
});

test("TM modes are less confined than TE modes (neff_TM < neff_TE), strongly so at high contrast", () => {
    const te = W.solveSlab(SOI, "TE").modes[0], tm = W.solveSlab(SOI, "TM").modes[0];
    assert.ok(tm.neff < te.neff - 0.3, `SOI birefringence ${te.neff} vs ${tm.neff}`);
    const te2 = W.solveSlab(SLAB, "TE").modes[0], tm2 = W.solveSlab(SLAB, "TM").modes[0];
    assert.ok(tm2.neff < te2.neff && te2.neff - tm2.neff < 1e-4, "weak guidance: TE ≈ TM");
});

test("root finding cross-check: core.findRoots scan finds the same slab solutions", () => {
    const V = 11.3, r = (1.45 / 1.5) ** 2;
    for (const m of [0, 1, 2, 3, 4, 5, 6, 7]) {
        const f = W.slabChar(m, V, r);
        const roots = core.findRoots(f, m * Math.PI / 2, Math.min((m + 1) * Math.PI / 2, V), { n: 200, poleTol: 1 });
        assert.equal(roots.length, 1, `m=${m}`);
        close(roots[0], W.slabU(V, m, r), 1e-11);
    }
});

// ------------------------------------------------------------------ fibre (LP)
test("fibre LP: single-mode below V = 2.405; LP11 appears at the first zero of J0", () => {
    const j01 = core.besselJZero(0, 1);
    close(W.lpCutoff(1, 1), j01, 1e-12);
    close(W.SINGLE_MODE_FIBRE_V, j01, 1e-12);
    const k0 = 2 * Math.PI / SMF.lambda0, NA = W.numericalAperture(SMF.n1, SMF.n2);
    const dAt = (V) => 2 * V / (k0 * NA);
    const below = W.solveFibre({ ...SMF, d: dAt(j01 - 1e-6) });
    assert.deepEqual(below.modes.map((m) => m.label), ["LP01"]);
    assert.equal(below.totalModes, 2);
    const above = W.solveFibre({ ...SMF, d: dAt(j01 + 1e-3) });
    assert.deepEqual(above.modes.map((m) => m.label), ["LP01", "LP11"]);
    assert.ok(above.modes[1].b < 1e-3, "LP11 just above cut-off is barely guided");
    // LP21 and LP02 both appear at j11 = 3.8317
    const j11 = core.besselJZero(1, 1);
    assert.equal(W.solveFibre({ ...SMF, d: dAt(j11 - 1e-4) }).lpCount, 2);
    const four = W.solveFibre({ ...SMF, d: dAt(j11 + 1e-3) });
    assert.deepEqual(four.modes.map((m) => m.label).sort(), ["LP01", "LP02", "LP11", "LP21"]);
    // LP0m modes leave cut-off exponentially slowly: b is below double precision 0.001 above j11
    assert.ok(four.modes.find((m) => m.label === "LP02").nearCutoff);
    const lp02 = W.solveFibre({ ...SMF, d: dAt(j11 + 0.1) }).modes.find((m) => m.label === "LP02");
    assert.ok(lp02.b > 0 && lp02.b < 1e-3 && lp02.beta > SMF.n2 * lp02.k0);
});

test("fibre LP: guided modes satisfy n2 k0 < β < n1 k0 and the LP01 mode never cuts off", () => {
    const g = { n1: 1.48, n2: 1.46, d: 50e-6, lambda0: 850e-9 };
    const s = W.solveFibre(g);
    assert.equal(s.modes.length, s.lpCount);
    for (const m of s.modes) assert.ok(m.beta > g.n2 * s.k0 && m.beta < g.n1 * s.k0, m.label);
    // total mode count (with degeneracy) ≈ V²/2 for large V
    close(s.totalModes / (s.V ** 2 / 2), 1, 0.1, "V²/2 rule");
    for (const V of [0.3, 0.8, 1.2]) assert.ok(Number.isFinite(W.lpU(V, 0, 1)), `LP01 guided at V=${V}`);
});

test("fibre LP01: agrees with the Rudolph–Neumann b(V) fit and the large-V limit u → 2.405 V/(V+1)", () => {
    for (const V of [1.5, 1.8, 2.0, 2.2, 2.4]) {
        const u = W.lpU(V, 0, 1), b = 1 - (u * u) / (V * V);
        close(b, (1.1428 - 0.996 / V) ** 2, 0.004, `V=${V}`);
    }
    for (const V of [60, 120]) close(W.lpU(V, 0, 1), 2.404825557695773 * V / (V + 1), 0.002 * 2.4, `V=${V}`);
    // LP11 at large V approaches the first zero of J1
    close(W.lpU(200, 1, 1), 3.8317 * 200 / 201, 0.01);
});

test("fibre LP fields: ψ and dψ/dr continuous at r = a (numerical one-sided differences)", () => {
    const g = { n1: 1.47, n2: 1.45, d: 20e-6, lambda0: 1.0e-6 };
    const s = W.solveFibre(g);
    assert.ok(s.modes.length > 8);
    for (const m of s.modes) {
        const a = m.a, h = a * 1e-8, H = a * 1e-5;
        close(W.lpField(m, a - h), W.lpField(m, a + h), 1e-5, `${m.label} ψ`);
        const din = (W.lpField(m, a - h) - W.lpField(m, a - h - H)) / H;
        const dout = (W.lpField(m, a + h + H) - W.lpField(m, a + h)) / H;
        close(din * a, dout * a, 2e-3 * (m.u + m.w), `${m.label} dψ/dr`);
        close(W.lpFieldDerivative(m, a - h) * a, W.lpFieldDerivative(m, a + h) * a, 1e-5 * (m.u + m.w));
    }
});

test("fibre: confinement factor matches radial integration; scalar group index obeys ng·neff = n1²Γ + n2²(1−Γ)", () => {
    const s = W.solveFibre(SMF);
    const m = s.modes[0];
    const R = m.a * (1 + 40 / m.w);
    const f = (r) => r * W.lpField(m, r) ** 2;
    const inCore = core.simpson(f, 0, m.a, 20000), outside = core.simpson(f, m.a, R, 60000);
    close(inCore / (inCore + outside), m.confinement, 1e-6);
    const gi = W.groupIndex("fibre", SMF, "LP01");
    close(gi.ng, (SMF.n1 ** 2 * m.confinement + SMF.n2 ** 2 * (1 - m.confinement)) / m.neff, 2e-6);
    // standard single-mode fibre: waveguide dispersion is negative, a few ps/(nm·km) at 1550 nm
    const Dw = gi.Dw * 1e6;
    assert.ok(Dw < -2 && Dw < 0 && Dw > -10, `Dw = ${Dw}`);
});

test("group-index derivative converges as the finite-difference step shrinks", () => {
    const ref = W.groupIndex("slab", MULTI, "TE2", { rel: 1e-5 }).ng;
    const e1 = Math.abs(W.groupIndex("slab", MULTI, "TE2", { rel: 4e-3 }).ng - ref);
    const e2 = Math.abs(W.groupIndex("slab", MULTI, "TE2", { rel: 2e-3 }).ng - ref);
    assert.ok(e2 < e1 / 3, `second-order convergence: ${e1} → ${e2}`);
});

test("modal dispersion: single mode has zero intermodal delay; multimode spread is close to the ray estimate", () => {
    const one = W.solveFibre(SMF);
    assert.equal(W.modalDispersion("fibre", SMF, one.modes).modeDelayPerLength, 0);
    const g = { n1: 1.48, n2: 1.46, d: 50e-6, lambda0: 850e-9 };
    const md = W.modalDispersion("fibre", g, W.solveFibre(g).modes);
    const ray = (g.n1 / core.constants.c) * (g.n1 / g.n2 - 1);
    close(md.rayDelayPerLength, ray, 1e-20);
    assert.ok(md.modeDelayPerLength < ray && md.modeDelayPerLength > 0.7 * ray, `${md.modeDelayPerLength} vs ${ray}`);
});

// ------------------------------------------------------------------ coupling
test("coupled slabs: gap → 0 supermodes equal TE0/TE1 of a single slab of twice the thickness", () => {
    const c = W.coupledSlabs(SLAB, "TE", 0);
    const dbl = W.solveSlab({ ...SLAB, d: 2 * SLAB.d }, "TE").modes;
    close(c.betaEven, dbl[0].beta, 1e-9 * c.betaEven);
    close(c.betaOdd, dbl[1].beta, 1e-9 * c.betaEven);
    const ctm = W.coupledSlabs(SLAB, "TM", 0), dtm = W.solveSlab({ ...SLAB, d: 2 * SLAB.d }, "TM").modes;
    close(ctm.betaEven, dtm[0].beta, 1e-9 * ctm.betaEven);
});

test("coupled slabs: supermodes bracket the isolated β and CMT coupling length agrees for weak coupling", () => {
    const g = { n1: 1.5, n2: 1.48, d: 3e-6, lambda0: 1.55e-6 };
    let prev = Infinity;
    for (const gap of [1e-6, 2e-6, 3e-6, 4e-6]) {
        const c = W.coupledSlabs(g, "TE", gap);
        assert.ok(c.betaEven > c.single.beta && c.betaOdd < c.single.beta);
        close(c.LcCMT / c.Lc, 1, gap >= 2e-6 ? 0.01 : 0.05, `gap ${gap}`);
        assert.ok(c.Lc > 0 && (prev === Infinity || c.Lc > prev));
        prev = c.Lc;
    }
    // exponential growth: ln Lc slope ≈ γ
    const c1 = W.coupledSlabs(g, "TE", 3e-6), c2 = W.coupledSlabs(g, "TE", 4e-6);
    close(Math.log(c2.Lc / c1.Lc) / 1e-6, c1.single.gamma, 0.02 * c1.single.gamma);
    // power conservation / full transfer at Lc for identical guides
    close(W.couplerPower(c1.Lc, c1.Lc), 1, 1e-12);
    close(W.couplerPower(0, c1.Lc), 0, 1e-12);
});

test("coupled fibres (CMT): coupling decays with separation at the rate w/a", () => {
    const c1 = W.coupledFibres(SMF, 4e-6), c2 = W.coupledFibres(SMF, 6e-6);
    assert.ok(c2.LcCMT > c1.LcCMT);
    const rate = Math.log(c1.kappaCMT / c2.kappaCMT) / 2e-6;
    const w = c1.mode.w, a = SMF.d / 2;
    // K0(x) ~ √(π/2x) e^{−x}: slope w/a plus the 1/(2D) prefactor correction
    const Dmean = 2 * a + 5e-6;
    close(rate, w / a + 1 / (2 * Dmean), 0.02 * w / a);
});

test("fibre: confinement at cut-off → 0 for LP0m/LP1m but → (l − 1)/l for l ≥ 2 (Γ caption)", () => {
    const n2 = 1.45, NA = 0.1, a = 1e-6, n1 = Math.sqrt(n2 * n2 + NA * NA);
    const gammaNearCutoff = (l, m, dv) => {
        const V = W.lpCutoff(l, m) + dv;
        const s = W.solveFibre({ n1, n2, d: 2 * a, lambda0: 2 * Math.PI * a * NA / V });
        return s.modes.find((q) => q.l === l && q.m === m).confinement;
    };
    assert.ok(gammaNearCutoff(1, 1, 1e-3) < 0.15, "LP11 Γ should fall towards 0 at cut-off");
    assert.ok(gammaNearCutoff(0, 2, 1e-3) < 1e-3, "LP02 Γ → 0 at cut-off");
    for (const l of [2, 3, 4]) close(gammaNearCutoff(l, 1, 1e-4), (l - 1) / l, 0.01, `LP${l}1 Γ at cut-off`);
});
