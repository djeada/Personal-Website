const test = require("node:test");
const assert = require("node:assert/strict");
const m = require("../../src/tools/shared/optics/standingWaves.js");

const C = 299792458;
const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ""} expected ${b}, got ${a}`);

// Brute-force time maximum of the physical field, independent of the analytic envelope.
function timeMax(cfg, x, phi) {
    const p = m.phasors(cfg, x);
    let best = 0;
    for (let i = 0; i < 2000; i++) {
        const wt = (2 * Math.PI * i) / 2000;
        best = Math.max(best, Math.abs(m.instantaneous(p.eRe, p.eIm, wt, phi)));
    }
    return best;
}

const single = (r, extra) => Object.assign({ mode: "single", n: 1.5, L: 2e-6, nu: 500e12, r }, extra);

test("PEC gives zero electric field at its surface at all times", () => {
    const cfg = m.describe(single(m.REFLECTOR_PRESETS.pec.r));
    const p = m.phasors(cfg, cfg.L);
    close(Math.hypot(p.eRe, p.eIm), 0, 1e-12, "|E(L)|");
    for (const wt of [0, 0.3, 1.7, 4]) close(m.instantaneous(p.eRe, p.eIm, wt, 0.4), 0, 1e-12);
    // magnetic field is maximal (2 E0 / eta) at a perfect electric conductor
    close(Math.hypot(p.hRe, p.hIm), 2, 1e-12, "eta|H(L)|");
    // a node is reported exactly at the surface
    const minima = m.eMinima(cfg);
    close(minima[minima.length - 1], cfg.L, 1e-18, "node at the boundary");
});

test("PEC nodes are spaced by half the wavelength in the medium", () => {
    const params = single(m.REFLECTOR_PRESETS.pec.r);
    const cfg = m.describe(params);
    const lambda = C / (params.n * params.nu);
    const minima = m.eMinima(cfg);
    for (let i = 1; i < minima.length; i++) close(minima[i] - minima[i - 1], lambda / 2, 1e-15);
    const maxima = m.eMaxima(cfg);
    // antinodes a quarter wave in front of the conductor
    close(cfg.L - maxima[maxima.length - 1], lambda / 4, 1e-15);
});

test("two-perfect-mirror cavity gives nu_m = m c / (2 n L) and satisfies both boundaries", () => {
    const n = 1.45, L = 3.2e-6;
    const modes = m.resonatorModes(n, L, Math.PI, Math.PI, 6);
    modes.forEach((mode, i) => close(mode.nu / (((i + 1) * C) / (2 * n * L)), 1, 1e-12, `mode ${i + 1}`));
    close(m.freeSpectralRange(n, L), C / (2 * n * L), 1e-3);
    for (const mode of modes) {
        const cfg = m.describe({ mode: "resonator", n, L, nu: mode.nu, r1: m.REFLECTOR_PRESETS.pec.r, r2: m.REFLECTOR_PRESETS.pec.r });
        for (const x of [0, L]) {
            const p = m.phasors(cfg, x);
            close(Math.hypot(p.eRe, p.eIm), 0, 1e-9, `E at x=${x}`);
        }
        // m antinodes and m + 1 nodes including both mirrors
        assert.equal(m.eMaxima(cfg).length, mode.m);
        assert.equal(m.eMinima(cfg).length, mode.m + 1);
    }
});

test("one PEC and one ideal magnetic mirror gives quarter-wave resonances", () => {
    const n = 1, L = 1e-6;
    const modes = m.resonatorModes(n, L, Math.PI, 0, 3);
    modes.forEach((mode, i) => close(mode.nu, ((2 * i + 1) * C) / (4 * n * L), 1));
});

test("changing only the global temporal phase does not move nodes or the envelope", () => {
    const params = single(m.complexPolar(0.6, 1.1));
    const a = m.profile(params, 257);
    const cfg = m.describe(params);
    for (const phi of [0, 1, 2.5, -3]) {
        const b = m.profile(params, 257); // profile has no time/phase input at all
        assert.deepEqual(Array.from(b.minima), Array.from(a.minima));
        for (const i of [0, 40, 128, 256]) close(timeMax(cfg, a.x[i], phi), a.envE[i], 1e-5, `envelope at phi=${phi}`);
    }
});

test("partial reflection: minima 1-|r|, maxima 1+|r|, SWR (1+|r|)/(1-|r|)", () => {
    for (const [rho, theta] of [[0.2, 0], [0.5, Math.PI], [0.75, 2.0]]) {
        const params = single(m.complexPolar(rho, theta));
        const cfg = m.describe(params);
        const minima = m.eMinima(cfg), maxima = m.eMaxima(cfg);
        assert.ok(minima.length > 0 && maxima.length > 0);
        for (const x of minima) close(timeMax(cfg, x, 0), 1 - rho, 1e-5, "minimum");
        for (const x of maxima) close(timeMax(cfg, x, 0), 1 + rho, 1e-5, "maximum");
        const pr = m.profile(params, 5001);
        const envMin = Math.min(...pr.envE), envMax = Math.max(...pr.envE);
        close(envMin, 1 - rho, 1e-4);
        close(envMax, 1 + rho, 1e-4);
        close(pr.swr, (1 + rho) / (1 - rho), 1e-12);
        close(envMax / envMin, pr.swr, 1e-2);
        close(pr.netPower, 1 - rho * rho, 1e-12);
    }
});

test("dielectric interface uses the Fresnel normal-incidence coefficient", () => {
    const up = m.reflectionFromIndices(1, 1.5);
    close(up.mag, 0.2, 1e-12);
    close(up.phase, Math.PI, 1e-12); // low -> high index: pi phase shift, field minimum at interface
    const down = m.reflectionFromIndices(1.5, 1);
    close(down.mag, 0.2, 1e-12);
    close(down.phase, 0, 1e-12); // high -> low index: field maximum at interface (not a "free end": |r| < 1)
    // energy conservation R + (n2/n1) T^2 = 1
    const t = m.transmissionFromIndices(1, 1.5);
    close(up.mag ** 2 + 1.5 * t * t, 1, 1e-12);
    const cfg = m.describe(single(up, { n: 1 }));
    const p = m.phasors(cfg, cfg.L);
    close(Math.hypot(p.eRe, p.eIm), 1 - 0.2, 1e-12);
    close(Math.hypot(p.eRe, p.eIm), t, 1e-12); // tangential E continuous across the interface
});

test("matched absorber gives a travelling wave with SWR 1 and no extrema", () => {
    const pr = m.profile(single(m.REFLECTOR_PRESETS.absorber.r), 101);
    assert.equal(pr.minima.length, 0);
    assert.equal(pr.swr, 1);
    for (const v of pr.envE) close(v, 1, 1e-12);
});

test("E and H envelopes are complementary: |E|^2 + eta^2|H|^2 is constant", () => {
    const pr = m.profile(single(m.complexPolar(0.7, 0.4)), 301);
    const sum = 2 * (1 + 0.49);
    for (let i = 0; i < pr.x.length; i++) close(pr.envE[i] ** 2 + pr.envH[i] ** 2, sum, 1e-12);
});

// ---------------------------------------------------------------- partial mirrors / finite finesse

// Independent reference: sum the multiple-beam series E_t ∝ t1 t2 Σ ρ^j directly (no closed form).
function seriesTransmission(nu, p, terms) {
    const k = (2 * Math.PI * p.n * nu) / C;
    const g = Math.sqrt(p.R1 * p.R2);
    const d = 2 * k * p.L + p.theta1 + p.theta2;
    let re = 0, im = 0;
    for (let j = 0; j < terms; j++) {
        re += g ** j * Math.cos(j * d);
        im += g ** j * Math.sin(j * d);
    }
    return (1 - p.R1) * (1 - p.R2) * (re * re + im * im);
}

test("Airy transmission equals the summed multiple-beam series", () => {
    const p = { n: 1.2, L: 2.5e-6, R1: 0.8, R2: 0.6, theta1: Math.PI, theta2: Math.PI };
    for (const nu of [100e12, 237e12, 400.5e12, 555e12]) {
        close(m.airyTransmission(nu, p), seriesTransmission(nu, p, 400), 1e-10, `nu=${nu}`);
    }
});

test("Airy peaks sit at the ideal-mirror mode frequencies for every mirror phase pair", () => {
    const n = 1.5, L = 2e-6;
    for (const [t1, t2] of [[Math.PI, Math.PI], [Math.PI, 0], [0.7, -1.9]]) {
        const p = { n, L, R1: 0.9, R2: 0.9, theta1: t1, theta2: t2 };
        const modes = m.resonatorModes(n, L, t1, t2, 4);
        for (const mode of modes) {
            close(m.airyTransmission(mode.nu, p), 1, 1e-12, "symmetric lossless cavity transmits fully on resonance");
            // locally maximal: brute-force neighbourhood scan
            const w = m.freeSpectralRange(n, L) * 0.01;
            let best = -1, bestNu = 0;
            for (let i = -500; i <= 500; i++) {
                const nu = mode.nu + (i / 500) * w;
                const T = m.airyTransmission(nu, p);
                if (T > best) { best = T; bestNu = nu; }
            }
            assert.ok(Math.abs(bestNu - mode.nu) <= w / 500 + 1, `peak at ${bestNu}, mode at ${mode.nu}`);
        }
    }
});

test("asymmetric mirrors: peak transmission (1-R1)(1-R2)/(1-sqrt(R1R2))^2 < 1, minimum between modes", () => {
    const p = { n: 1, L: 1e-6, R1: 0.95, R2: 0.7, theta1: Math.PI, theta2: Math.PI };
    const g = Math.sqrt(p.R1 * p.R2);
    const nu1 = m.resonatorModes(1, 1e-6, Math.PI, Math.PI, 1)[0].nu;
    close(m.airyTransmission(nu1, p), (0.05 * 0.3) / (1 - g) ** 2, 1e-12);
    const mid = nu1 + m.freeSpectralRange(1, 1e-6) / 2;
    close(m.airyTransmission(mid, p), (0.05 * 0.3) / (1 + g) ** 2, 1e-12);
});

test("numerically measured FWHM agrees with airyFWHM, and approaches FSR/F at high finesse", () => {
    const n = 1, L = 1.5e-6;
    const fsr = m.freeSpectralRange(n, L);
    for (const R of [0.5, 0.9, 0.99]) {
        const p = { n, L, R1: R, R2: R, theta1: Math.PI, theta2: Math.PI };
        const nu0 = m.resonatorModes(n, L, Math.PI, Math.PI, 3)[2].nu;
        // bisection on the upper half-maximum crossing (independent of the closed form)
        let lo = nu0, hi = nu0 + fsr / 2;
        for (let i = 0; i < 200; i++) {
            const mid = (lo + hi) / 2;
            if (m.airyTransmission(mid, p) > 0.5) lo = mid; else hi = mid;
        }
        const measured = 2 * (lo - nu0);
        close(m.airyFWHM(n, L, R, R) / measured, 1, 1e-9, `R=${R}`);
        const F = m.finesse(R, R);
        const rel = Math.abs(measured - fsr / F) / measured;
        if (R >= 0.99) assert.ok(rel < 1e-4, `high-F limit, rel err ${rel}`);
        if (R === 0.5) assert.ok(rel > 1e-3, "low finesse deviates from FSR/F");
    }
});

test("finesse limits: R -> 1 diverges, R = 0 has no resonance, finesse is symmetric in R1, R2", () => {
    assert.ok(m.finesse(0.999, 0.999) > 3000);
    assert.equal(m.finesse(0, 0.9), 0);
    close(m.finesse(0.9, 0.6), m.finesse(0.6, 0.9), 1e-12);
    assert.throws(() => m.finesse(1, 0.9), RangeError);
    // no half-maximum when the resonances overlap completely
    assert.equal(m.airyFWHM(1, 1e-6, 0.05, 0.05), Infinity);
});

test("photon lifetime from round-trip survival: linewidth 1/(2 pi tau) -> FSR/F at high finesse", () => {
    const n = 1.3, L = 3e-6, R = 0.995;
    const nu = m.resonatorModeFrequency(5, n, L, Math.PI, Math.PI);
    const life = m.cavityLifetime(nu, n, L, R, R);
    close(life.roundTripTime, (2 * n * L) / C, 1e-24);
    // energy after N round trips decays as (R1 R2)^N = exp(-N t_rt / tau)
    for (const N of [1, 10, 100]) close((R * R) ** N, Math.exp((-N * life.roundTripTime) / life.tau), 1e-12);
    const F = m.finesse(R, R);
    const rel = Math.abs(life.linewidthFromTau - m.freeSpectralRange(n, L) / F) / life.linewidthFromTau;
    assert.ok(rel < 1e-3, `rel ${rel}`);
    close(life.Q, nu / life.linewidthFromTau, 1e-6 * life.Q);
});

test("PEC | PMC cavity: E = 0 at the conductor, tangential H = 0 at the magnetic wall", () => {
    const n = 1, L = 1.5e-6;
    for (const mode of m.resonatorModes(n, L, Math.PI, 0, 4)) {
        const cfg = m.describe({ mode: "resonator", n, L, nu: mode.nu, r1: m.REFLECTOR_PRESETS.pec.r, r2: m.REFLECTOR_PRESETS.pmc.r });
        const a = m.phasors(cfg, 0), b = m.phasors(cfg, L);
        close(Math.hypot(a.eRe, a.eIm), 0, 1e-12, "E at PEC");
        close(Math.hypot(b.hRe, b.hIm), 0, 1e-9, "H at PMC");
        close(Math.hypot(b.eRe, b.eIm), 2, 1e-9, "E antinode at PMC");
    }
});

test("sampled envelope extremum converges to the analytic node position as sampling is refined", () => {
    const params = single(m.complexPolar(0.6, 0.9));
    const exact = m.eMinima(m.describe(params))[0];
    let prev = Infinity;
    for (const N of [65, 257, 1025, 4097]) {
        const pr = m.profile(params, N);
        // location of the smallest sampled |E| in the neighbourhood of the first analytic minimum
        let best = -1;
        for (let i = 0; i < N; i++) if (Math.abs(pr.x[i] - exact) < 1.5e-7 && (best < 0 || pr.envE[i] < pr.envE[best])) best = i;
        const err = Math.abs(pr.x[best] - exact);
        assert.ok(err <= params.L / (N - 1), `N=${N} err=${err}`);
        assert.ok(err <= prev + 1e-18);
        prev = err;
    }
});
