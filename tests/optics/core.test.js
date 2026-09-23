const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../../src/tools/shared/optics/core.js");
const diffraction = require("../../src/tools/shared/optics/diffraction.js");

const close = (a, b, tol, msg = "") =>
    assert.ok(Math.abs(a - b) <= tol, `${msg} expected ${b}, got ${a} (tol ${tol})`);
const { complex: C } = core;

test("SI constants are consistent: c² μ0 ε0 = 1 and η0 = √(μ0/ε0)", () => {
    const k = core.constants;
    close(k.c * k.c * k.mu0 * k.eps0, 1, 1e-9);
    close(k.eta0, Math.sqrt(k.mu0 / k.eps0), 1e-6);
    close(k.eta0, 376.730313, 1e-5);
    close(core.units.photonEnergy(1239.84198e-9) / k.e, 1, 1e-8, "1 eV photon at 1239.84 nm");
    assert.equal(core.formatSI(6.33e-7, "m"), "633 nm");
    assert.equal(core.formatSI(0.0025, "m"), "2.5 mm");
    assert.equal(core.formatSI(4.74e14, "Hz"), "474 THz");
    assert.equal(core.formatSI(0, "W"), "0 W");
    close(core.units.toDeg(core.units.toRad(41.81)), 41.81, 1e-12);
});

test("complex arithmetic identities", () => {
    const a = C.cx(3, -4), b = C.cx(-1.5, 2.25);
    assert.ok(C.isClose(C.mul(C.div(a, b), b), a, 1e-14), "(a/b)·b = a");
    close(C.abs(a), 5, 1e-15);
    close(C.abs2(a), 25, 1e-15);
    assert.ok(C.isClose(C.mul(a, C.conj(a)), C.cx(25, 0), 1e-13), "a a* = |a|²");
    assert.ok(C.isClose(C.exp(C.cx(0, Math.PI)), C.cx(-1, 0), 1e-15), "Euler");
    assert.ok(C.isClose(C.fromPolar(2, 0.7), C.scale(C.expi(0.7), 2), 1e-15));
    close(C.arg(C.fromPolar(1, -2.5)), -2.5, 1e-15);
    for (const z of [a, b, C.cx(-4, 0), C.cx(-4, -1e-300), C.cx(0, 2), C.cx(1e-8, -3)]) {
        const s = C.sqrt(z);
        assert.ok(s.re >= 0, "principal root has Re ≥ 0");
        assert.ok(C.isClose(C.mul(s, s), z, 1e-12 * (1 + C.abs(z))), `sqrt² = z for ${JSON.stringify(z)}`);
    }
    assert.ok(C.isClose(C.sqrt(C.cx(-4, 0)), C.cx(0, 2), 1e-15), "√(−4) = 2i (Im ≥ 0 above the cut)");
    assert.ok(C.isClose(C.sqrt(C.cx(-4, -0)), C.cx(0, -2), 1e-15), "√(−4 − 0i) = −2i (below the cut)");
    assert.ok(C.isClose(C.exp(C.log(b)), b, 1e-14));
    // Smith division survives huge denominators
    assert.ok(C.isClose(C.div(C.cx(1e300, 1e300), C.cx(1e300, 1e300)), C.cx(1, 0), 1e-15));
});

test("linspace, Simpson, adaptive quadrature and trapezoid", () => {
    const x = core.linspace(0, 1, 11);
    assert.equal(x.length, 11);
    assert.equal(x[10], 1);
    close(x[3], 0.3, 1e-15);
    close(core.simpson(Math.sin, 0, Math.PI, 100), 2, 1e-7);
    close(core.simpson((t) => t ** 3, 0, 2, 2), 4, 1e-14, "Simpson is exact for cubics");
    // Simpson error ∝ h⁴
    const e1 = Math.abs(core.simpson(Math.exp, 0, 1, 8) - (Math.E - 1));
    const e2 = Math.abs(core.simpson(Math.exp, 0, 1, 16) - (Math.E - 1));
    close(e1 / e2, 16, 0.5, "Simpson convergence order 4");
    for (const n of [5, 6, 7, 10, 101]) {
        const xs = core.linspace(0, Math.PI, n);
        const ys = Array.from(xs, Math.sin);
        close(core.simpsonSamples(ys, xs[1] - xs[0]), 2, n > 50 ? 1e-7 : 2e-2, `samples n=${n}`);
        close(core.trapz(ys, xs), 2, 0.2);
    }
    close(core.integrateAdaptive((t) => Math.exp(-t * t), -8, 8, 1e-12), Math.sqrt(Math.PI), 1e-10);
});

test("Brent and bisection find known roots; bracket scan skips poles", () => {
    close(core.brent((x) => x * x - 2, 0, 2), Math.SQRT2, 1e-14);
    close(core.bisect((x) => x * x - 2, 0, 2), Math.SQRT2, 1e-11);
    close(core.brent(Math.cos, 0, 3), Math.PI / 2, 1e-14);
    close(core.brent((x) => Math.exp(x) - 10, -5, 5), Math.log(10), 1e-13);
    // counts function evaluations: Brent is far cheaper than bisection
    let nb = 0, nbis = 0;
    core.brent((x) => { nb++; return x ** 3 - 2 * x - 5; }, 2, 3);
    core.bisect((x) => { nbis++; return x ** 3 - 2 * x - 5; }, 2, 3);
    assert.ok(nb < nbis / 2, `brent ${nb} evaluations vs bisection ${nbis}`);
    assert.throws(() => core.brent((x) => x * x + 1, -1, 1), RangeError);
    // tan(x) − x has roots at 0, 4.4934, 7.7253 and poles at π/2, 3π/2, 5π/2
    const roots = core.findRoots((x) => Math.tan(x) - x, 0.1, 8, { n: 800 });
    assert.equal(roots.length, 2, `roots ${roots}`);
    close(roots[0], 4.493409457909064, 1e-12);
    close(roots[1], 7.725251836937707, 1e-12);
    // slab-waveguide style transcendental equation: u tan u = sqrt(V² − u²) for V = 5
    const V = 5;
    const te = core.findRoots((u) => u * Math.tan(u) - Math.sqrt(V * V - u * u), 1e-6, V - 1e-9);
    assert.equal(te.length, 2);
});

test("RK4 solves harmonic motion with fourth-order convergence", () => {
    const f = (t, y) => [y[1], -y[0]];
    const err = (n) => {
        const r = core.integrateRK4(f, 0, [1, 0], 2 * Math.PI, n, { record: false });
        return Math.hypot(r.y[0][0] - 1, r.y[0][1]);
    };
    const e1 = err(50), e2 = err(100), e3 = err(200);
    close(Math.log2(e1 / e2), 4, 0.15, "order from 50→100");
    close(Math.log2(e2 / e3), 4, 0.15, "order from 100→200");
    assert.ok(e3 < 1e-7);
    const rec = core.integrateRK4((t, y) => [-y[0]], 0, [1], 1, 100);
    assert.equal(rec.t.length, 101);
    close(rec.y[100][0], Math.exp(-1), 1e-10);
});

test("Bessel J0, J1, Jn reference values (Abramowitz & Stegun)", () => {
    close(core.besselJ0(0), 1, 0);
    close(core.besselJ0(1), 0.7651976865579666, 1e-13);
    close(core.besselJ1(1), 0.4400505857449335, 1e-13);
    close(core.besselJ(2, 1), 0.1149034849319005, 1e-13);
    close(core.besselJ0(10), -0.2459357644513483, 1e-12);
    close(core.besselJ1(10), 0.04347274616886144, 1e-12);
    close(core.besselJ(5, 10), -0.2340615281867936, 1e-12);
    close(core.besselJ1(-1), -0.4400505857449335, 1e-13, "J1 is odd");
    close(core.besselJ(-3, 2.5), -core.besselJ(3, 2.5), 1e-15, "J−n = (−1)^n Jn");
    // agreement with the existing, independently tested J1 in diffraction.js
    for (let x = -40; x <= 40; x += 0.37) close(core.besselJ1(x), diffraction.besselJ1(x), 1e-14, `x=${x}`);
});

test("Bessel Jn agrees with the integral representation and the recurrence", () => {
    // Jn(x) = (1/2π) ∫₀^{2π} cos(nτ − x sin τ) dτ; periodic trapezoid is spectrally accurate
    const integral = (n, x) => {
        const N = 512;
        let s = 0;
        for (let k = 0; k < N; k++) {
            const t = 2 * Math.PI * k / N;
            s += Math.cos(n * t - x * Math.sin(t));
        }
        return s / N;
    };
    for (const n of [0, 1, 2, 3, 7, 15, 30]) {
        for (const x of [0.3, 2, 9.5, 12.5, 20, 33, 60]) {
            close(core.besselJ(n, x), integral(n, x), 1e-11, `J${n}(${x})`);
        }
    }
    // three-term recurrence J(n−1) + J(n+1) = (2n/x) Jn
    for (const x of [0.7, 5, 14, 45]) {
        for (let n = 1; n < 12; n++) {
            close(core.besselJ(n - 1, x) + core.besselJ(n + 1, x), 2 * n / x * core.besselJ(n, x), 1e-11);
        }
    }
    // tiny values in the n ≫ x regime keep relative accuracy
    const j = core.besselJ(10, 1);
    close(j / 2.630615123687453e-10, 1, 1e-10, "J10(1)");
});

test("Bessel zeros: 2.4048 (single-mode fibre cutoff), 3.8317 (Airy first dark ring)", () => {
    close(core.besselJZero(0, 1), 2.404825557695773, 1e-12);
    close(core.besselJZero(0, 2), 5.520078110286311, 1e-12);
    close(core.besselJZero(0, 3), 8.653727912911013, 1e-12);
    close(core.besselJZero(1, 1), 3.831705970207512, 1e-12);
    close(core.besselJZero(1, 2), 7.015586669815619, 1e-12);
    close(core.besselJZero(2, 1), 5.135622301840683, 1e-12);
    close(core.besselJZero(1, 1), diffraction.besselJ1Zero(1), 1e-10);
});

test("modified Bessel K0, K1: reference values and recurrences", () => {
    close(core.besselK0(1), 0.4210244382407083, 1e-14);
    close(core.besselK1(1), 0.6019072301972346, 1e-14);
    close(core.besselK0(2), 0.1138938727495334, 1e-14);
    close(core.besselK1(2), 0.1398658818165224, 1e-14);
    // small-x limit K0(x) ≈ −ln(x/2) − γ, K1(x) ≈ 1/x
    close(core.besselK0(1e-6), -Math.log(5e-7) - 0.5772156649015329, 1e-9);
    close(core.besselK1(1e-6) * 1e-6, 1, 1e-9);
    // large-x asymptote K_ν(x) ~ √(π/2x) e^{−x} (1 + (4ν²−1)/(8x))
    const x = 400;
    close(core.besselK(0, x, true) / (Math.sqrt(Math.PI / (2 * x)) * (1 - 1 / (8 * x) + 9 / (128 * x * x))), 1, 1e-8);
    // K_{ν+1} = K_{ν−1} + (2ν/x) K_ν and K0' = −K1
    for (const xx of [0.05, 0.8, 3, 17, 90]) {
        close(core.besselK(2, xx) / (core.besselK0(xx) + 2 / xx * core.besselK1(xx)), 1, 1e-12, `K2(${xx})`);
        const h = 1e-4 * Math.min(1, xx);
        const d = (core.besselK0(xx + h) - core.besselK0(xx - h)) / (2 * h);
        close(-d / core.besselK1(xx), 1, 1e-7, `K0'(${xx})`);
    }
});

test("2×2 real and complex matrices", () => {
    const M = core.mat2;
    const A = [[1, 2], [3, 4]], B = [[0, 1], [-1, 0.5]];
    assert.deepEqual(M.mul(A, M.identity()), A);
    close(M.det(M.mul(A, B)), M.det(A) * M.det(B), 1e-14);
    const Ai = M.inverse(A);
    const I = M.mul(A, Ai);
    close(I[0][0], 1, 1e-15); close(I[0][1], 0, 1e-15); close(I[1][0], 0, 1e-15); close(I[1][1], 1, 1e-15);
    assert.deepEqual(M.apply(A, [1, 1]), [3, 7]);
    // ABCD: free space d then thin lens f → chain([lens, space]) = lens·space
    const d = 0.3, f = 0.1;
    const sys = M.chain([[[1, 0], [-1 / f, 1]], [[1, d], [0, 1]]]);
    assert.deepEqual(sys, M.mul([[1, 0], [-1 / f, 1]], [[1, d], [0, 1]]));
    assert.throws(() => M.inverse([[1, 2], [2, 4]]), RangeError);

    const CM = core.cmat2;
    const U = [[C.cx(Math.SQRT1_2), C.cx(0, Math.SQRT1_2)], [C.cx(0, Math.SQRT1_2), C.cx(Math.SQRT1_2)]]; // 50:50 splitter
    const UU = CM.mul(CM.adjoint(U), U);
    assert.ok(C.isClose(UU[0][0], C.ONE, 1e-15) && C.isClose(UU[0][1], C.ZERO, 1e-15), "unitary");
    assert.ok(C.isClose(CM.det(U), C.ONE, 1e-15));
    const Ui = CM.inverse(U);
    assert.ok(C.isClose(CM.mul(U, Ui)[1][1], C.ONE, 1e-15));
    const out = CM.apply(U, [C.ONE, C.ZERO]);
    close(C.abs2(out[0]) + C.abs2(out[1]), 1, 1e-15, "power conserved");
});

test("FFT matches the naive DFT and inverse round-trips", () => {
    const rng = core.createRng(7);
    for (const n of [1, 2, 4, 8, 64, 256]) {
        const re = Float64Array.from({ length: n }, () => rng.normal());
        const im = Float64Array.from({ length: n }, () => rng.normal());
        const [dr, di] = core.dft(re, im);
        const fr = re.slice(), fi = im.slice();
        core.fft(fr, fi);
        for (let k = 0; k < n; k++) {
            close(fr[k], dr[k], 1e-10, `re n=${n} k=${k}`);
            close(fi[k], di[k], 1e-10, `im n=${n} k=${k}`);
        }
        core.ifft(fr, fi);
        for (let k = 0; k < n; k++) { close(fr[k], re[k], 1e-12); close(fi[k], im[k], 1e-12); }
    }
    assert.throws(() => core.fft(new Float64Array(6), new Float64Array(6)), RangeError);
});

test("FFT sign convention and known transforms", () => {
    const n = 32, m = 5;
    // x[j] = exp(+2πi m j/N) → forward FFT is N δ[k − m] (forward kernel exp(−2πikn/N))
    const re = new Float64Array(n), im = new Float64Array(n);
    for (let j = 0; j < n; j++) { re[j] = Math.cos(2 * Math.PI * m * j / n); im[j] = Math.sin(2 * Math.PI * m * j / n); }
    core.fft(re, im);
    for (let k = 0; k < n; k++) {
        close(re[k], k === m ? n : 0, 1e-11);
        close(im[k], 0, 1e-11);
    }
    // impulse → flat; constant → N at DC
    const a = new Float64Array(n), b = new Float64Array(n);
    a[0] = 1;
    core.fft(a, b);
    for (let k = 0; k < n; k++) close(a[k], 1, 1e-15);
    // Gaussian → Gaussian: continuous FT ∫ e^{−πx²} e^{−2πifx} dx = e^{−πf²}
    const N = 256, dx = 0.05;
    const gr = new Float64Array(N), gi = new Float64Array(N);
    const xs = core.fftFreq(N, 1 / (N * dx)); // positions in FFT order (0, dx, …, −dx)
    for (let j = 0; j < N; j++) gr[j] = Math.exp(-Math.PI * xs[j] * xs[j]);
    core.fft(gr, gi);
    const f = core.fftFreq(N, dx);
    for (let k = 0; k < N; k += 7) {
        close(gr[k] * dx, Math.exp(-Math.PI * f[k] * f[k]), 1e-12, `f=${f[k]}`);
        close(gi[k], 0, 1e-12);
    }
});

test("Parseval: Σ|x|² = (1/N) Σ|X|², in 1D and 2D", () => {
    const rng = core.createRng(11);
    const n = 128;
    const re = Float64Array.from({ length: n }, () => rng.normal());
    const im = Float64Array.from({ length: n }, () => rng.normal());
    const e0 = re.reduce((s, v, i) => s + v * v + im[i] * im[i], 0);
    core.fft(re, im);
    const e1 = re.reduce((s, v, i) => s + v * v + im[i] * im[i], 0) / n;
    close(e1 / e0, 1, 1e-13);

    const nx = 16, ny = 8;
    const r2 = Float64Array.from({ length: nx * ny }, () => rng.uniform(-1, 1));
    const i2 = new Float64Array(nx * ny);
    const orig = r2.slice();
    const p0 = r2.reduce((s, v) => s + v * v, 0);
    core.fft2(r2, i2, nx, ny);
    const p1 = r2.reduce((s, v, i) => s + v * v + i2[i] * i2[i], 0) / (nx * ny);
    close(p1 / p0, 1, 1e-13);
    // 2D separable plane wave lands in one bin: exp(+2πi(3x/nx + 2y/ny)) → bin (3, 2)
    const pr = new Float64Array(nx * ny), pi = new Float64Array(nx * ny);
    for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
        const ph = 2 * Math.PI * (3 * x / nx + 2 * y / ny);
        pr[y * nx + x] = Math.cos(ph); pi[y * nx + x] = Math.sin(ph);
    }
    core.fft2(pr, pi, nx, ny);
    close(pr[2 * nx + 3], nx * ny, 1e-10);
    close(Math.hypot(pr[0], pi[0]), 0, 1e-10);
    core.ifft2(r2, i2, nx, ny);
    for (let k = 0; k < nx * ny; k++) close(r2[k], orig[k], 1e-13);
});

test("fftshift / ifftshift / fftFreq conventions (numpy-compatible)", () => {
    assert.deepEqual(Array.from(core.fftshift(Float64Array.of(0, 1, 2, 3, 4))), [3, 4, 0, 1, 2]);
    assert.deepEqual(Array.from(core.ifftshift(Float64Array.of(3, 4, 0, 1, 2))), [0, 1, 2, 3, 4]);
    assert.deepEqual(Array.from(core.fftshift([0, 1, 2, 3])), [2, 3, 0, 1]);
    assert.deepEqual(Array.from(core.fftFreq(4, 0.5)), [0, 0.5, -1, -0.5]);
    assert.deepEqual(Array.from(core.fftFreq(5, 1)), [0, 0.2, 0.4, -0.4, -0.2]);
    assert.deepEqual(Array.from(core.fftFreq(4, 0.5, true)), [-1, -0.5, 0, 0.5]);
    const a = Float64Array.from({ length: 12 }, (_, i) => i); // nx = 4, ny = 3
    const s = core.fftshift2(a, 4, 3);
    assert.equal(s[1 * 4 + 2], 0, "DC moves to (nx/2, floor(ny/2))");
    assert.deepEqual(Array.from(core.ifftshift2(s, 4, 3)), Array.from(a));
    assert.equal(core.nextPow2(300), 512);
});

test("seeded RNG is reproducible; normal and Poisson moments", () => {
    const a = core.createRng(42), b = core.createRng(42), c = core.createRng(43);
    const sa = Array.from({ length: 5 }, a.next), sb = Array.from({ length: 5 }, b.next);
    assert.deepEqual(sa, sb);
    assert.notDeepEqual(sa, Array.from({ length: 5 }, c.next));
    for (const v of sa) assert.ok(v >= 0 && v < 1);

    const rng = core.createRng(2024);
    const N = 40000;
    let s = 0, s2 = 0;
    for (let i = 0; i < N; i++) { const x = rng.normal(3, 2); s += x; s2 += x * x; }
    const mean = s / N, varr = s2 / N - mean * mean;
    close(mean, 3, 5 * 2 / Math.sqrt(N));
    close(varr, 4, 0.12);

    for (const lam of [0.5, 4, 25, 30, 120, 5000]) {
        const r = core.createRng(99);
        let m1 = 0, m2 = 0;
        for (let i = 0; i < N; i++) {
            const k = r.poisson(lam);
            assert.ok(Number.isInteger(k) && k >= 0);
            m1 += k; m2 += k * k;
        }
        const mu = m1 / N, v = m2 / N - mu * mu;
        // 5σ bounds on the sample mean and a generous bound on the sample variance
        close(mu, lam, 5 * Math.sqrt(lam / N), `Poisson mean λ=${lam}`);
        close(v / lam, 1, 0.05, `Poisson variance/mean λ=${lam}`);
    }
    // P(0) for λ = 0.5 is e^{-0.5}
    const r = core.createRng(5);
    let zeros = 0;
    for (let i = 0; i < N; i++) if (r.poisson(0.5) === 0) zeros++;
    close(zeros / N, Math.exp(-0.5), 0.01);
    close(core.logGamma(10), Math.log(362880), 1e-12);
    close(core.logGamma(0.5), Math.log(Math.sqrt(Math.PI)), 1e-13);
    close(core.logGamma(171), 706.5730622457874, 1e-10); // ln(170!)
    close(core.logGamma(1), 0, 1e-13);
});
