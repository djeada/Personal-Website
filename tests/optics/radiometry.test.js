const test = require("node:test");
const assert = require("node:assert/strict");
const R = require("../../src/tools/shared/optics/radiometry.js");

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ""} expected ${b}, got ${a} (tol ${tol})`);
const rel = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol * Math.abs(b), `${msg || ""} expected ${b}, got ${a} (rel ${tol})`);

const BASE = {
    source: "lambert", L: 1e-3, a: 2e-3, I: 1e-9, P0: 1e-3, w0: 0.5e-3, lambda0: 550e-9,
    so: 0.2, f: 0.05, D: 0.025, no: 1, ni: 1, ng: 1.5, coated: false, Tf: 0.9, rd: 1e-3,
    eta: 0.7, t: 1e-3, idark: 100, readNoise: 5, fullWell: 1e6
};

// ------------------------------------------------------------------ photon counting
test("photon counts: 1 nW at 500 nm for 1 s is 2.517e9 photons (via the 2.4797 eV photon energy)", () => {
    const Ephot = 1239.841984 / 500 * 1.602176634e-19; // hc = 1239.84 eV nm, independent route
    const N = R.expectedCounts({ power: 1e-9, eta: 1, time: 1, lambda0: 500e-9 });
    rel(N, 1e-9 / Ephot, 1e-9, "N");
    rel(R.photonEnergy(500e-9), Ephot, 1e-9, "E_photon");
});

test("N_det = η P t λ0/(hc) is dimensionless and responsivity has units A/W", () => {
    assert.deepEqual(R.countDimensions(), [0, 0, 0, 0]);
    assert.deepEqual(R.responsivityDimensions(), R.DIM.A_per_W);
});

test("ideal detector responsivity is 1 A/W at 1239.84 nm and scales linearly with λ and η", () => {
    rel(R.responsivity(1, 1239.841984e-9), 1, 1e-8);
    rel(R.responsivity(0.5, 620e-9), 0.5 * 620 / 1239.841984, 1e-8);
});

test("doubling power (or exposure) doubles the expected counts; the budget is linear in source strength", () => {
    const n1 = R.expectedCounts({ power: 3e-12, eta: 0.6, time: 0.01, lambda0: 800e-9 });
    rel(R.expectedCounts({ power: 6e-12, eta: 0.6, time: 0.01, lambda0: 800e-9 }), 2 * n1, 1e-14);
    rel(R.expectedCounts({ power: 3e-12, eta: 0.6, time: 0.02, lambda0: 800e-9 }), 2 * n1, 1e-14);
    for (const [src, key] of [["lambert", "L"], ["point", "I"], ["laser", "P0"]]) {
        const e1 = R.experiment({ ...BASE, source: src });
        const e2 = R.experiment({ ...BASE, source: src, [key]: 2 * BASE[key] });
        rel(e2.S, 2 * e1.S, 1e-12, src + " counts");
        rel(e2.Pdet, 2 * e1.Pdet, 1e-12, src + " power");
    }
});

// ------------------------------------------------------------------ geometry
test("solid angles: hemisphere 2π, sphere 4π, small cone πθ²; projected solid angle of hemisphere is π", () => {
    close(R.solidAngleCone(Math.PI / 2), 2 * Math.PI, 1e-14);
    close(R.solidAngleCone(Math.PI), 4 * Math.PI, 1e-14);
    rel(R.solidAngleCone(1e-3), Math.PI * 1e-6, 1e-6);
    close(R.projectedSolidAngleCone(Math.PI / 2), Math.PI, 1e-14);
});

test("Lambertian disk on-axis irradiance E = πL sin²θ matches numerical angular integration", () => {
    for (const [a, d] of [[0.01, 0.05], [0.002, 0.2], [0.05, 0.01], [1, 1]]) {
        const E = R.lambertOnAxisIrradiance(2.5, a, d);
        const th = Math.atan2(a, d);
        rel(E, Math.PI * 2.5 * Math.sin(th) ** 2, 1e-13, "closed form");
        rel(R.lambertOnAxisIrradianceNumeric(2.5, a, d), E, 1e-11, "1D adaptive");
        rel(R.lambertIrradianceAt(2.5, a, d, 0), E, 1e-9, "azimuthal integration at ρ = 0");
    }
    // infinite Lambertian plane: E → πL
    rel(R.lambertOnAxisIrradiance(1, 1e6, 1), Math.PI, 1e-10);
});

test("off-axis irradiance is continuous at the disk edge, decreases with ρ and tends to an inverse-square law", () => {
    const L = 1, a = 0.01, d = 0.05;
    let prev = Infinity;
    for (let rho = 0; rho <= 0.1; rho += 0.005) {
        const E = R.lambertIrradianceAt(L, a, d, rho);
        assert.ok(E < prev + 1e-15, "monotone at ρ = " + rho);
        prev = E;
    }
    rel(R.lambertIrradianceAt(L, a, d, a * (1 - 1e-7)), R.lambertIrradianceAt(L, a, d, a * (1 + 1e-7)), 1e-5, "edge continuity");
    // far away: small source of intensity I = L πa² seen at angle θ gives E = I cos⁴θ/d² ... (cos³θ/r² · cosθ)
    const small = 1e-4, dd = 1, rho = 0.7;
    const cos = dd / Math.hypot(dd, rho);
    rel(R.lambertIrradianceAt(L, small, dd, rho), L * Math.PI * small * small * cos ** 4 / dd ** 2, 1e-6, "far-field cos⁴");
});

test("disk-to-disk: analytic view factor agrees with the numerical angular + radial integration", () => {
    for (const [a, b, d] of [[0.01, 0.005, 0.05], [0.01, 0.03, 0.05], [0.02, 0.02, 0.01], [0.002, 0.0125, 0.2]]) {
        rel(R.diskToDiskPowerNumeric(1, a, b, d), R.lambertDiskToDiskPower(1, a, b, d), 1e-6, `a=${a} b=${b} d=${d}`);
    }
});

test("view factor: reciprocity A1F12 = A2F21, bounds, and limits", () => {
    const a = 0.01, b = 0.03, d = 0.04;
    rel(a * a * R.diskViewFactor(a, b, d), b * b * R.diskViewFactor(b, a, d), 1e-12, "reciprocity");
    const F = R.diskViewFactor(a, b, d);
    assert.ok(F > 0 && F < 1);
    close(R.diskViewFactor(a, 1e4, d), 1, 1e-6, "infinite receiver collects everything");
    // small source: F → sin²θ of the receiver seen from the source centre
    const th = Math.atan2(b, d);
    rel(R.diskViewFactor(1e-6, b, d), Math.sin(th) ** 2, 1e-8, "small-source limit");
    // both small: F → b²/d²
    rel(R.diskViewFactor(1e-6, 1e-4, 1), 1e-8, 1e-6, "small-angle limit");
});

test("point source and Gaussian beam: aperture integrals of the irradiance equal the analytic collected power", () => {
    const I = 3, d = 0.1, Rap = 0.04;
    const simpson = (f, a, b, n = 400) => { const h = (b - a) / n; let s = f(a) + f(b); for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * f(a + i * h); return s * h / 3; };
    rel(simpson((r) => R.pointIrradianceAt(I, d, r) * 2 * Math.PI * r, 0, Rap), I * R.solidAngleCone(Math.atan2(Rap, d)), 1e-9, "point");
    rel(simpson((r) => R.gaussianIrradianceAt(2, 1e-3, r) * 2 * Math.PI * r, 0, 0.8e-3), 2 * R.gaussianApertureFraction(0.8e-3, 1e-3), 1e-9, "gaussian");
    close(R.gaussianApertureFraction(1, 1), 1 - Math.exp(-2), 1e-15, "R = w passes 86.5 %");
});

// ------------------------------------------------------------------ imaging, étendue and radiance
test("reduced radiance L/n² is conserved along a lossless ray; losses enter only through explicit T", () => {
    const chain = R.radianceAlongRay(5, [{ n: 1 }, { n: 1.5 }, { n: 1.33 }, { n: 2.4 }, { n: 1 }]);
    for (const s of chain) rel(s.reduced, 5, 1e-14);
    rel(chain[1].L, 5 * 2.25, 1e-14, "L in glass = n² L_air");
    const lossy = R.radianceAlongRay(5, [{ n: 1 }, { n: 1.5, T: 0.96 }, { n: 1, T: 0.9 }]);
    rel(lossy[2].reduced, 5 * 0.96 * 0.9, 1e-14);
    const e = R.experiment({ ...BASE, no: 1.515, ni: 1, coated: true, Tf: 1 });
    rel(e.ray[2].reduced, e.ray[0].reduced * e.Tlens, 1e-12, "experiment radiance chain");
});

test("étendue n²AΩ is conserved paraxially (object ↔ image), and the thin lens obeys the Lagrange invariant", () => {
    const e = R.experiment({ ...BASE, D: 1e-4 });
    rel(e.Gimg, e.Gobj, 1e-6, "paraxial étendue");
    // at larger apertures a thin (non-aplanatic) lens differs by (cos θi / cos θo)²
    const w = R.experiment({ ...BASE, D: 0.04 });
    rel(w.Gimg / w.Gobj, (Math.cos(w.thI) / Math.cos(w.thO)) ** 2, 1e-10);
    // immersion: no·y·u = ni·y'·u'
    const im = R.thinLensImaging({ so: 0.1, f: 0.03, no: 1.33, ni: 1 });
    rel(1.33 * 1 * (1 / 0.1), 1 * Math.abs(im.m) * (1 / im.si), 1e-12);
    assert.equal(R.thinLensImaging({ so: 0.02, f: 0.05 }).real, false);
});

test("resolution: 0.61λ/NA with the exact Airy factor, image-side spot = |m| × object-side spot (paraxial)", () => {
    close(R.RAYLEIGH_FACTOR, 0.6098, 1e-4);
    const e = R.experiment({ ...BASE, D: 2e-4 });
    rel(e.resImg, Math.abs(e.img.m) * e.resObj, 1e-6);
    // Airy encircled energy: 83.8 % inside the first dark ring, → 1 far out
    close(R.airyEncircledEnergy(R.rayleighResolution(500e-9, 0.1), 500e-9, 0.1), 0.8378, 2e-4);
    close(R.airyEncircledEnergy(1e-3, 500e-9, 0.1), 1, 2e-3);
});

test("collected power: Lambertian ∝ sin²θ ≈ NA² for small NA; point source ∝ Ω; budget product is explicit", () => {
    const e1 = R.experiment({ ...BASE, D: 0.002 }), e2 = R.experiment({ ...BASE, D: 0.004 });
    rel(e2.Pcoll / e1.Pcoll, (e2.NAo / e1.NAo) ** 2, 2e-3, "Lambertian NA²");
    const e = R.experiment({ ...BASE });
    const prod = e.rows.slice(1, 6).reduce((p, r) => p * r.factor, e.Pemit);
    rel(prod, e.Pdet, 1e-12, "power budget product");
    rel(e.rows[6].photonRate, BASE.eta * R.photonRate(e.Pdet, BASE.lambda0), 1e-12, "QE row");
    rel(e.T1, 0.96, 1e-12, "uncoated crown glass surface");
    // no losses → 100 % through the train
    const ideal = R.experiment({ ...BASE, ng: 1, Tf: 1, rd: 1 });
    rel(ideal.Pdet, ideal.Pcoll, 1e-12);
});

// ------------------------------------------------------------------ noise
test("SNR limits: shot-noise limited √N, read-noise limited S/σr", () => {
    rel(R.snr({ signal: 1e6 }).snr, 1e3, 1e-12);
    rel(R.snr({ signal: 1e8, readNoise: 5 }).snr, 1e4, 1e-6);
    rel(R.snr({ signal: 0.01, readNoise: 10 }).snr, 0.01 / 10, 1e-4);
    // SNR ∝ t for read-limited, ∝ √t for shot-limited
    const r = (s) => R.snr({ signal: s, readNoise: 20 }).snr;
    rel(r(0.2) / r(0.1), 2, 1e-3);
    rel(r(4e6) / r(1e6), 2, 1e-3);
});

test("seeded Poisson counts: variance = mean within Monte Carlo standard error; reproducible with the seed", () => {
    for (const mean of [3.7, 25, 400, 5e4]) {
        const xs = R.simulateCounts({ mean, trials: 20000, seed: 11 });
        const s = R.sampleStats(xs);
        assert.ok(Math.abs(s.mean - mean) < 4 * s.sem, `mean ${s.mean} vs ${mean} ± ${s.sem}`);
        assert.ok(Math.abs(s.variance - mean) < 4 * s.seVar, `var ${s.variance} vs ${mean} ± ${s.seVar}`);
        rel(s.sem, Math.sqrt(mean / 20000), 0.05, "SE of mean ≈ σ/√N");
    }
    assert.deepEqual(Array.from(R.simulateCounts({ mean: 9, trials: 50, seed: 3 })), Array.from(R.simulateCounts({ mean: 9, trials: 50, seed: 3 })));
    assert.notDeepEqual(Array.from(R.simulateCounts({ mean: 9, trials: 50, seed: 3 })), Array.from(R.simulateCounts({ mean: 9, trials: 50, seed: 4 })));
});

test("read noise adds σr² to the variance; sampling error shrinks as 1/√N while physical noise does not", () => {
    const xs = R.simulateCounts({ mean: 50, readNoise: 8, trials: 40000, seed: 5 });
    const s = R.sampleStats(xs);
    assert.ok(Math.abs(s.variance - (50 + 64)) < 4 * s.seVar);
    const small = R.sampleStats(R.simulateCounts({ mean: 50, readNoise: 8, trials: 400, seed: 5 }));
    rel(small.sem / s.sem, 10, 0.1, "SE ratio for 100× trials");
    rel(small.sd, s.sd, 0.1, "σ independent of N");
});

test("theoretical count distribution sums to 1 and matches the seeded histogram (χ² test)", () => {
    for (const cfg of [{ mean: 6, readNoise: 0 }, { mean: 30, readNoise: 3 }, { mean: 3e5, readNoise: 10 }]) {
        const sigma = Math.sqrt(cfg.mean + cfg.readNoise ** 2);
        const edges = R.histogramEdges(cfg.mean, sigma, { integer: cfg.readNoise === 0 });
        const { probs } = R.countDistribution(cfg, edges);
        close(probs.reduce((a, b) => a + b, 0), 1, 1e-6, "normalisation");
        const N = 20000;
        const h = R.histogram(R.simulateCounts({ ...cfg, trials: N, seed: 21 }), edges);
        let chi2 = 0, dof = 0;
        for (let i = 0; i < probs.length; i++) {
            const e = probs[i] * N;
            if (e < 5) continue;
            chi2 += (h[i] - e) ** 2 / e;
            dof++;
        }
        assert.ok(chi2 < dof + 5 * Math.sqrt(2 * dof), `χ² = ${chi2} for ${dof} bins`);
    }
    // exact Poisson pmf for integer bins
    const edges = R.histogramEdges(4, 2, { integer: true });
    const { probs } = R.countDistribution({ mean: 4 }, edges);
    const i4 = Math.round(4 - edges[0] - 0.5);
    close(probs[i4], Math.exp(-4) * 4 ** 4 / 24, 1e-12);
});

test("full well: readouts never exceed the well without read noise; clipped mass is piled at FW", () => {
    const xs = R.simulateCounts({ mean: 1000, fullWell: 990, trials: 5000, seed: 2 });
    assert.ok(Math.max(...xs) <= 990);
    const frac = xs.filter((x) => x === 990).length / xs.length;
    const edges = R.histogramEdges(1000, Math.sqrt(1000), { integer: true, fullWell: 990 });
    const { probs } = R.countDistribution({ mean: 1000, fullWell: 990 }, edges);
    close(probs.reduce((a, b) => a + b, 0), 1, 1e-9);
    assert.ok(Math.abs(frac - probs[probs.length - 1]) < 0.03, `clipped fraction ${frac} vs ${probs[probs.length - 1]}`);
    assert.equal(R.experiment({ ...BASE, t: 10 }).saturated, true);
});

test("clipped readout moments: exact model agrees with the seeded Monte Carlo; unclipped gives (S + D, S + D + σr²)", () => {
    const free = R.readoutMoments({ mean: 120, readNoise: 4, fullWell: 1e6 });
    close(free.mean, 120, 1e-12); close(free.variance, 136, 1e-12);
    for (const cfg of [{ mean: 1000, fullWell: 1010, readNoise: 3 }, { mean: 1e5, fullWell: 99900, readNoise: 5 }, { mean: 50, fullWell: 20, readNoise: 0 }]) {
        const m = R.readoutMoments(cfg);
        const s = R.sampleStats(R.simulateCounts({ ...cfg, trials: 40000, seed: 8 }));
        assert.ok(Math.abs(s.mean - m.mean) < 4 * s.sem + 1e-6 * m.mean, `mean ${s.mean} vs ${m.mean}`);
        assert.ok(Math.abs(s.variance - m.variance) < 4 * s.seVar + 1e-4, `var ${s.variance} vs ${m.variance}`);
    }
});

// ------------------------------------------------------------------ photometry
test("photometry: V(555 nm) = 1 → 683 lm/W; V is small at the ends of the visible band", () => {
    close(R.luminousEfficiency(555e-9), 1, 1e-12);
    rel(R.luminousFlux(1, 555e-9), 683, 1e-12);
    close(R.luminousEfficiency(510e-9), 0.503, 1e-12);
    assert.equal(R.luminousEfficiency(1064e-9), 0);
    assert.ok(R.luminousEfficiency(700e-9) < 0.005 && R.luminousEfficiency(400e-9) < 0.001);
    // symmetric-ish tabulated half-maximum points near 510 nm and 610 nm
    assert.ok(Math.abs(R.luminousEfficiency(510e-9) - R.luminousEfficiency(610e-9)) < 1e-12);
});
