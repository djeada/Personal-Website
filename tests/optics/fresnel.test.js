const test = require("node:test");
const assert = require("node:assert/strict");
const m = require("../../src/tools/shared/optics/fresnel.js");

const deg = (d) => d * Math.PI / 180;
const close = (a, b, tol = 1e-9, msg) =>
    assert.ok(Math.abs(a - b) <= tol, `${msg || ""} expected ${b}, got ${a}`);

test("air to glass at normal incidence: R = 0.04, T = 0.96 for both polarisations", () => {
    const s = m.solve(1.0, 1.5, 0);
    close(s.Rs, 0.04, 1e-12, "Rs");
    close(s.Rp, 0.04, 1e-12, "Rp");
    close(s.Ts, 0.96, 1e-12, "Ts");
    close(s.Tp, 0.96, 1e-12, "Tp");
    // field transmission is 2/(1+n) = 0.8, so |t|² = 0.64 ≠ T: the flux factor matters
    close(m.complex.abs(s.ts), 0.8, 1e-12, "|ts|");
    assert.ok(Math.abs(m.complex.abs(s.ts) ** 2 - s.Ts) > 0.1);
    // with the p basis (H along ŷ) r_p = −r_s at normal incidence
    close(s.rs.re, -0.2, 1e-12);
    close(s.rp.re, 0.2, 1e-12);
});

test("energy conservation R + T = 1 for s and p across angles and index pairs", () => {
    for (const [n1, n2] of [[1, 1.5], [1.5, 1], [1.33, 2.4], [2.9, 1.0], [1.2, 1.2]]) {
        for (let d = 0; d < 90; d += 0.5) {
            const s = m.solve(n1, n2, deg(d));
            close(s.Rs + s.Ts, 1, 1e-12, `s n1=${n1} n2=${n2} θ=${d}`);
            close(s.Rp + s.Tp, 1, 1e-12, `p n1=${n1} n2=${n2} θ=${d}`);
        }
    }
});

test("p reflection vanishes at the Brewster angle atan(1.5) ≈ 56.31°", () => {
    const thB = m.brewsterAngle(1, 1.5);
    close(thB * 180 / Math.PI, 56.3099, 1e-4);
    const s = m.solve(1, 1.5, thB);
    close(s.Rp, 0, 1e-24);
    assert.ok(s.Rs > 0.1);
    // θ1 + θ2 = 90° at Brewster
    close(s.theta1 + s.theta2, Math.PI / 2, 1e-12);
});

test("glass to air critical angle ≈ 41.81°, none for air to glass", () => {
    close(m.criticalAngle(1.5, 1.0) * 180 / Math.PI, 41.8103, 1e-4);
    assert.equal(m.criticalAngle(1.0, 1.5), null);
    assert.equal(m.solve(1.5, 1.0, deg(41.7)).tir, false);
    assert.equal(m.solve(1.5, 1.0, deg(41.9)).tir, true);
});

test("TIR: unit reflectance, angle-dependent phase, zero T but nonzero decaying field", () => {
    const lambda0 = 633e-9;
    const angles = [45, 50, 60, 75, 85];
    const phases = [];
    for (const d of angles) {
        const s = m.solve(1.5, 1.0, deg(d), lambda0);
        assert.equal(s.tir, true);
        close(s.Rs, 1, 1e-12);
        close(s.Rp, 1, 1e-12);
        assert.equal(s.Ts, 0);
        assert.equal(s.Tp, 0);
        assert.ok(m.complex.abs(s.ts) > 0.1, "evanescent s field is nonzero");
        assert.ok(m.complex.abs(s.tp) > 0.1, "evanescent p field is nonzero");
        // normal wavevector purely imaginary with positive imaginary part → decay
        assert.equal(s.kz2.re, 0);
        assert.ok(s.kz2.im > 0);
        // analytic decay length 1/κ, κ = k0 sqrt(n1² sin²θ − n2²)
        const kappa = 2 * Math.PI / lambda0 * Math.sqrt((1.5 * Math.sin(deg(d))) ** 2 - 1);
        close(s.fieldDecayLength, 1 / kappa, 1e-18);
        // analytic TIR phase of r_s under exp(−iωt): −2 atan(sqrt(n²sin²θ − 1)/(n cosθ))
        const n = 1.5;
        const expected = -2 * Math.atan(Math.sqrt(n * n * Math.sin(deg(d)) ** 2 - 1) / (n * Math.cos(deg(d))));
        close(s.phaseRs, expected, 1e-12);
        phases.push([s.phaseRs, s.phaseRp]);

        // the transmitted field really decays: |E| at z = decay length is 1/e of the value at z = 0
        for (const pol of ["s", "p"]) {
            const w = m.planeWaves(s, pol).transmitted;
            const mag = (z) => {
                // peak over one temporal cycle of |E|² at depth z
                let best = 0;
                for (let k = 0; k < 64; k++) {
                    const f = m.waveField(w, 0, z / lambda0, 2 * Math.PI * k / 64);
                    best = Math.max(best, Math.hypot(f.x, f.y, f.z));
                }
                return best;
            };
            const ratio = mag(s.fieldDecayLength) / mag(0);
            close(ratio, Math.exp(-1), 2e-3, `decay ratio ${pol} at ${d}°`);
        }
    }
    // phase changes with angle (not a fixed −1/+1)
    for (let i = 1; i < phases.length; i++) {
        assert.ok(Math.abs(phases[i][0] - phases[i - 1][0]) > 0.05);
        assert.ok(Math.abs(phases[i][1] - phases[i - 1][1]) > 0.05);
    }
});

test("boundary conditions: tangential E and H are continuous at z = 0", () => {
    const C = m.complex;
    for (const [n1, n2, d] of [[1, 1.5, 30], [1.5, 1, 30], [1.5, 1, 60], [2.4, 1.33, 70]]) {
        const s = m.solve(n1, n2, deg(d));
        for (const pol of ["s", "p"]) {
            const b = m.boundaryTangential(s, pol);
            close(b.side1.re, b.side2.re, 1e-12);
            close(b.side1.im, b.side2.im, 1e-12);
        }
        // s: H_x ∝ −k_z E_y  → k_z1 (1 − r_s) = k_z2 t_s
        const lhsS = C.mul(s.kz1, C.sub(C.cx(1), s.rs));
        const rhsS = C.mul(s.kz2, s.ts);
        close(lhsS.re, rhsS.re, 1e-12);
        close(lhsS.im, rhsS.im, 1e-12);
        // p: H_y = n E / Z0  → n1 (1 + r_p) = n2 t_p
        const lhsP = C.scale(C.add(C.cx(1), s.rp), n1);
        const rhsP = C.scale(s.tp, n2);
        close(lhsP.re, rhsP.re, 1e-12);
        close(lhsP.im, rhsP.im, 1e-12);
    }
});

test("matched indices give no reflection; wavelength scales as λ0/n at fixed frequency", () => {
    const s = m.solve(1.4, 1.4, deg(37));
    close(s.Rs, 0, 1e-24);
    close(s.Rp, 0, 1e-24);
    close(m.mediumWavelength(600e-9, 1.5), 400e-9, 1e-20);
    close(m.frequency(600e-9), 299792458 / 600e-9, 1);
});

test("unpolarised power is the average; sweep reaches 1 beyond critical angle", () => {
    const s = m.solve(1, 1.5, deg(56.31));
    const u = m.powerFor(s, "unpolarized");
    close(u.R, (s.Rs + s.Rp) / 2, 1e-15);
    const sw = m.sweep(1.5, 1, 91);
    const last = sw[sw.length - 1];
    close(last.Rs, 1, 1e-12);
    close(last.Rp, 1, 1e-12);
    assert.throws(() => m.solve(-1, 1.5, 0), RangeError);
});

// ---------------------------------------------------------------------------
// Absorbing transmission medium, ñ2 = n + iκ (exp(−iωt) convention: κ > 0 is loss)
// ---------------------------------------------------------------------------

test("absorbing medium at normal incidence: R = ((n−1)² + κ²)/((n+1)² + κ²) (metal benchmark)", () => {
    for (const [n, k] of [[0.2, 3.09], [1.5, 0.01], [2.0, 1.0], [0.05, 4.2]]) {
        const s = m.solve(1, { re: n, im: k }, 0, 633e-9);
        const R = ((n - 1) ** 2 + k * k) / ((n + 1) ** 2 + k * k);
        close(s.Rs, R, 1e-12, `Rs n=${n} κ=${k}`);
        close(s.Rp, R, 1e-12, `Rp n=${n} κ=${k}`);
        assert.equal(s.absorbing, true);
    }
    // gold-like metal at 633 nm reflects ≈ 93 %
    const au = m.solve(1, { re: 0.2, im: 3.09 }, 0);
    assert.ok(au.Rs > 0.92 && au.Rs < 0.94);
});

test("absorbing medium: energy balance R + T(0⁺) = 1 at the interface, flux then decays as exp(−2 Im k_z z)", () => {
    const lambda0 = 633e-9;
    for (const n2 of [{ re: 1.5, im: 0.05 }, { re: 0.2, im: 3.09 }, { re: 1.0, im: 0.3 }]) {
        for (const n1 of [1.0, 1.5]) {
            for (let d = 0; d < 90; d += 1.5) {
                const s = m.solve(n1, n2, deg(d), lambda0);
                close(s.Rs + s.Ts, 1, 1e-12, `s n1=${n1} ñ2=${n2.re}+${n2.im}i θ=${d}`);
                close(s.Rp + s.Tp, 1, 1e-12, `p n1=${n1} ñ2=${n2.re}+${n2.im}i θ=${d}`);
                assert.ok(s.Ts >= 0 && s.Tp >= 0);
                // every photon entering a semi-infinite absorber is absorbed
                close(s.As, s.Ts, 0);
                // flux falls by e at the intensity decay length (half the field decay length)
                for (const pol of ["s", "p"]) {
                    const T = pol === "s" ? s.Ts : s.Tp;
                    close(m.fluxAtDepth(s, pol, s.intensityDecayLength), T * Math.exp(-1), 1e-12);
                }
            }
        }
    }
});

test("absorbing medium: tangential E and H are continuous; wave decays into medium 2", () => {
    const C = m.complex;
    const lambda0 = 500e-9;
    for (const [n1, n2, d] of [[1, { re: 1.5, im: 0.2 }, 40], [1.5, { re: 0.2, im: 3.09 }, 70], [1.33, { re: 2, im: 1 }, 10]]) {
        const s = m.solve(n1, n2, deg(d), lambda0);
        for (const pol of ["s", "p"]) {
            const b = m.boundaryTangential(s, pol);
            close(b.side1.re, b.side2.re, 1e-12);
            close(b.side1.im, b.side2.im, 1e-12);
        }
        // s: H_x continuity  k_z1 (1 − r_s) = k_z2 t_s
        const lhsS = C.mul(s.kz1, C.sub(C.cx(1), s.rs));
        const rhsS = C.mul(s.kz2, s.ts);
        close(lhsS.re, rhsS.re, 1e-12);
        close(lhsS.im, rhsS.im, 1e-12);
        // p: H_y continuity  n1 (1 + r_p) = ñ2 t_p
        const lhsP = C.scale(C.add(C.cx(1), s.rp), n1);
        const rhsP = C.mul(C.cx(n2.re, n2.im), s.tp);
        close(lhsP.re, rhsP.re, 1e-12);
        close(lhsP.im, rhsP.im, 1e-12);
        // forward-propagating and decaying branch
        assert.ok(s.kz2.im > 0 && s.kz2.re > 0);
        // brute-force the field decay from the plane-wave field (not the formula)
        const w = m.planeWaves(s, "s").transmitted;
        const peak = (z) => {
            let best = 0;
            for (let k = 0; k < 128; k++) best = Math.max(best, Math.abs(m.waveField(w, 0, z / lambda0, 2 * Math.PI * k / 128).y));
            return best;
        };
        close(peak(s.fieldDecayLength) / peak(0), Math.exp(-1), 1e-3);
    }
});

test("vanishing absorption: κ → 0 converges to the lossless solution; pseudo-Brewster → Brewster", () => {
    const ref = m.solve(1, 1.5, deg(35));
    let prev = Infinity;
    for (const k of [1e-1, 1e-2, 1e-3, 1e-4, 1e-6]) {
        const s = m.solve(1, { re: 1.5, im: k }, deg(35));
        const err = Math.abs(s.Rs - ref.Rs) + Math.abs(s.Rp - ref.Rp) + Math.abs(s.Ts - ref.Ts);
        assert.ok(err < prev, "error decreases monotonically as κ → 0");
        prev = err;
    }
    assert.ok(prev < 1e-6);
    // pseudo-Brewster: R_p has a nonzero minimum that tends to 0 at atan(n) as κ → 0
    const thB = m.brewsterAngle(1, 1.5);
    let lastMin = Infinity;
    for (const k of [0.5, 0.1, 0.01, 0.001]) {
        const th = m.pseudoBrewster(1, { re: 1.5, im: k });
        const Rmin = m.solve(1, { re: 1.5, im: k }, th).Rp;
        assert.ok(Rmin > 0 && Rmin < lastMin);
        lastMin = Rmin;
        // it really is a minimum: neighbours are higher
        assert.ok(m.solve(1, { re: 1.5, im: k }, th + 1e-3).Rp > Rmin);
        assert.ok(m.solve(1, { re: 1.5, im: k }, th - 1e-3).Rp > Rmin);
    }
    close(m.pseudoBrewster(1, { re: 1.5, im: 0.001 }), thB, 1e-5);
    close(m.pseudoBrewster(1, 1.5), thB, 0);
});

test("attenuated total reflection: a weak absorber beyond θc makes R < 1 but R + T = 1", () => {
    const lossless = m.solve(1.5, 1.0, deg(60));
    close(lossless.Rs, 1, 1e-12);
    const atr = m.solve(1.5, { re: 1.0, im: 0.02 }, deg(60));
    assert.ok(atr.Rs < 1 && atr.Rs > 0.9, "frustrated by absorption");
    assert.ok(atr.Rp < atr.Rs, "p is attenuated more strongly than s in ATR");
    close(atr.Rs + atr.Ts, 1, 1e-12);
});

test("transmitted intensity profile: |t|² in a lossless propagating medium, e⁻² at the field decay length", () => {
    const s = m.solve(1, 1.5, deg(30), 600e-9);
    close(m.transmittedIntensity(s, "s", 0), m.complex.abs(s.ts) ** 2, 1e-15);
    close(m.transmittedIntensity(s, "p", 1e-6), m.complex.abs(s.tp) ** 2, 1e-12); // |ê_p| = 1 for a real wave
    const tir = m.solve(1.5, 1.0, deg(60), 600e-9);
    for (const pol of ["s", "p"]) {
        close(m.transmittedIntensity(tir, pol, tir.fieldDecayLength) / m.transmittedIntensity(tir, pol, 0), Math.exp(-2), 1e-12);
    }
    // at z = 0 the p evanescent intensity agrees with a direct field evaluation (time average of |E|²)
    const w = m.planeWaves(tir, "p").transmitted;
    let acc = 0;
    const N = 256;
    for (let k = 0; k < N; k++) {
        const f = m.waveField(w, 0, 0, 2 * Math.PI * k / N);
        acc += f.x * f.x + f.y * f.y + f.z * f.z;
    }
    close(2 * acc / N, m.transmittedIntensity(tir, "p", 0), 1e-9); // ⟨|Re E|²⟩ = |E|²/2
    assert.throws(() => m.solve(1, { re: 1.5, im: -0.1 }, 0), RangeError);
});
