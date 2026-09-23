/*
 * Diffraction grating and simple grating spectrometer (pure, DOM-free).
 *
 * Browser: <script src="../shared/optics/grating.js"></script> → window.OpticsModels.grating
 * Node:    const grating = require(".../shared/optics/grating.js")
 *
 * Geometry and sign convention
 * ----------------------------
 *  A plane transmission grating of N illuminated slits, pitch d and slit width a (a ≤ d), in air.
 *  All angles are measured from the grating normal, positive counter-clockwise, and describe the
 *  direction of travel of the incident beam (θi) and of the diffracted beam (θ) on the far side.
 *  The zero order is the undeviated beam θ0 = θi. With s = sin θ − sin θi the phase step between
 *  adjacent slits is 2π d s / λ, and the grating equation is
 *        d (sin θm − sin θi) = m λ .
 *  Orders with |sin θm| ≥ 1 do not propagate (evanescent or grazing) and are excluded.
 *
 * Fraunhofer (far-field) scalar model, no obliquity factor, no polarization, perfect coherence
 * across the illuminated width N d. Normalised intensity (1 at the zero order):
 *        I(s)/I0 = sinc²(α) · [sin(Nβ)/(N sin β)]²,   α = π a s/λ,   β = π d s/λ.
 *  The array factor is evaluated with the fractional order q = d s/λ reduced to ε = π(q − round q),
 *  which removes the 0/0 at every principal maximum: AF = (−1)^{m(N−1)} sin(Nε)/(N sin ε) with a
 *  Taylor series for |Nε| < 1e-4, so |AF| = 1 exactly at β = mπ.
 *
 * Spectra are incoherent sums over lines {lambda (m), weight}. A flat continuum between lo and hi
 * (unit integrated weight) uses the order-integrated result valid when the spectrum is smooth over
 * the grating bandwidth λ/(|m|N):  I_m(s) = S(λm) · sinc²(π m a/d) · λm/(|m| N),  λm = d s/m,
 * which follows from ∫AF² dε = π/N over one order (Fejér kernel). The zero order is integrated
 * over λ numerically.
 *
 * Spectrometer: entrance slit (width w) at the focus of a collimator (focal length fCol), grating,
 * camera lens fCam whose axis points at order m of the centre wavelength λc, and a linear detector
 * of nPix pixels of pitch p centred on that axis. Detector coordinate x = fCam tan(θ − θc).
 * Instrument line profile = (grating response in x) ⊗ rect(slit image w') ⊗ rect(pixel p), with
 * the anamorphic slit image width w' = w (fCam/fCol) cos θi / cos θc (linearised, incoherent slit).
 *
 * All quantities SI (m, rad).
 */
(function(root, factory) {
    const m = factory();
    if (typeof module === "object" && module.exports) module.exports = m;
    else {
        root.OpticsModels = root.OpticsModels || {};
        root.OpticsModels.grating = m;
    }
})(typeof self !== "undefined" ? self : this, function() {
    "use strict";

    const PI = Math.PI;
    /** Midpoint/peak intensity ratio of two equal sinc²-like lines at the Rayleigh separation. */
    const RAYLEIGH_DIP = 8 / (PI * PI);

    // ------------------------------------------------------------------ basic functions
    /** sin(x)/x with the removable singularity at 0 handled. */
    function sinc(x) {
        const ax = Math.abs(x);
        if (ax < 1e-4) {
            const x2 = x * x;
            return 1 - x2 / 6 + x2 * x2 / 120;
        }
        return Math.sin(x) / x;
    }

    /**
     * Normalised array factor sin(Nβ)/(N sin β) as a function of the fractional order q = β/π.
     * Stable at every principal maximum (q integer), where it equals (−1)^{m(N−1)}.
     */
    function arrayFactorQ(q, N) {
        const m = Math.round(q);
        const eps = PI * (q - m);
        let v;
        if (Math.abs(N * eps) < 1e-4) {
            const e2 = eps * eps,
                n2 = N * N;
            v = 1 - (n2 - 1) * e2 / 6 + (n2 - 1) * (3 * n2 - 7) * e2 * e2 / 360;
        } else {
            v = Math.sin(N * eps) / (N * Math.sin(eps));
        }
        return (Math.abs(m) * (N - 1)) % 2 === 0 ? v : -v;
    }

    /** Array factor as a function of β (rad). */
    function arrayFactor(beta, N) {
        return arrayFactorQ(beta / PI, N);
    }

    /** Normalised intensity at s = sin θ − sin θi for one wavelength. g = {N, d, a}. */
    function intensityS(s, lam, g) {
        const env = sinc(PI * g.a * s / lam);
        const af = arrayFactorQ(g.d * s / lam, g.N);
        return env * env * af * af;
    }

    /** Normalised intensity at diffraction angle theta for incidence thetaI. */
    function intensity(theta, lam, g, thetaI = 0) {
        return intensityS(Math.sin(theta) - Math.sin(thetaI), lam, g);
    }

    /**
     * Independent check: coherent sum of N·M equal point sources (M per slit, midpoint rule across
     * each slit), |Σ exp(i k s x)|² / (NM)². Converges to the analytic pattern as M grows. The
     * sum over the lattice factorises exactly (positions n d + x_j), so both factors are summed
     * explicitly as phasors instead of using any closed form.
     */
    function directSum(s, lam, g, M = 32) {
        const k = 2 * PI / lam;
        let ar = 0,
            ai = 0;
        for (let n = 0; n < g.N; n++) {
            const ph = k * s * n * g.d;
            ar += Math.cos(ph);
            ai += Math.sin(ph);
        }
        let br = 0,
            bi = 0;
        for (let j = 0; j < M; j++) {
            const x = -g.a / 2 + (j + 0.5) * g.a / M;
            const ph = k * s * x;
            br += Math.cos(ph);
            bi += Math.sin(ph);
        }
        return (ar * ar + ai * ai) * (br * br + bi * bi) / (g.N * g.N * M * M);
    }

    // ------------------------------------------------------------------ orders
    /** sin θm for order m (may exceed 1 in magnitude = non-propagating). */
    function orderSin(m, lam, d, thetaI = 0) {
        return Math.sin(thetaI) + m * lam / d;
    }

    /** θm (rad) from d(sin θm − sin θi) = mλ, or NaN when |sin θm| ≥ 1. */
    function orderAngle(m, lam, d, thetaI = 0) {
        const s = orderSin(m, lam, d, thetaI);
        return Math.abs(s) < 1 ? Math.asin(s) : NaN;
    }

    /** All propagating orders (|sin θm| < 1), ascending. */
    function allowedOrders(lam, d, thetaI = 0) {
        const si = Math.sin(thetaI);
        const lo = Math.ceil((-1 - si) * d / lam - 1e-12),
            hi = Math.floor((1 - si) * d / lam + 1e-12);
        const out = [];
        for (let m = lo; m <= hi; m++)
            if (Math.abs(si + m * lam / d) < 1) out.push(m);
        return out;
    }

    /** Relative height of principal maximum m: single-slit envelope sinc²(π m a/d). */
    function orderEnvelope(m, g) {
        const v = sinc(PI * m * g.a / g.d);
        return v * v;
    }

    /**
     * Missing orders among the given list: m ≠ 0 with m·a/d within tol of a nonzero integer k,
     * i.e. m = k d/a lands on a zero of the single-slit envelope.
     */
    function missingOrders(orders, g, tol = 0.01) {
        return orders.filter((m) => {
            if (m === 0) return false;
            const r = m * g.a / g.d,
                k = Math.round(r);
            return k !== 0 && Math.abs(r - k) < tol;
        });
    }

    /** Angular dispersion dθm/dλ = m/(d cos θm) (rad per metre); NaN if not propagating. */
    function angularDispersion(m, lam, d, thetaI = 0) {
        const th = orderAngle(m, lam, d, thetaI);
        return m / (d * Math.cos(th));
    }

    /** Ideal (Rayleigh) resolving power λ/Δλ = |m| N. */
    function resolvingPower(m, N) {
        return Math.abs(m) * N;
    }

    /** Free spectral range of order m: λ + Δλ in order m meets λ in order m+1 → Δλ = λ/|m|. */
    function freeSpectralRange(lam, m) {
        return lam / Math.abs(m);
    }

    /** Half-width ε_h of AF² at half maximum: [sin(Nε)/(N sin ε)]² = 1/2 (Infinity for N = 1). */
    function halfMaxEps(N) {
        if (N <= 1) return Infinity;
        let lo = 0,
            hi = PI / N;
        for (let i = 0; i < 80; i++) {
            const mid = 0.5 * (lo + hi);
            const v = arrayFactorQ(mid / PI, N);
            if (v * v > 0.5) lo = mid;
            else hi = mid;
        }
        return 0.5 * (lo + hi);
    }

    /** FWHM (in wavelength) of the ideal grating response to one line in order m (≈ 0.886 λ/(mN)). */
    function idealFWHM(lam, m, N) {
        return lam * 2 * halfMaxEps(N) / (Math.abs(m) * PI);
    }

    // ------------------------------------------------------------------ spectra
    const NM = 1e-9;
    const line = (nm, weight, label) => ({
        lambda: nm * NM,
        weight,
        label
    });
    /** Relative line weights are illustrative (lamp- and detector-dependent). Air wavelengths. */
    const PRESET_LINES = {
        hg: [line(404.656, 0.45, "Hg 404.7"), line(435.833, 1, "Hg 435.8"), line(546.074, 1, "Hg 546.1"),
            line(576.960, 0.35, "Hg 577.0"), line(579.066, 0.35, "Hg 579.1")
        ],
        na: [line(588.995, 1, "Na D2 589.0"), line(589.592, 0.5, "Na D1 589.6")],
        balmer: [line(656.279, 1, "Hα 656.3"), line(486.135, 0.45, "Hβ 486.1"), line(434.047, 0.25, "Hγ 434.0"),
            line(410.174, 0.15, "Hδ 410.2")
        ]
    };

    /**
     * Build a spectrum. kind: "hg" | "na" | "balmer" | "two" | "mono" | "white".
     * opts: {lambda0, dLambda} (m) for "two"/"mono"; {lo, hi} for "white" (default 400–700 nm).
     * Returns {lines: [...], continuum: null | {lo, hi, S}} with the weights of lines normalised to
     * sum 1 and the continuum to unit integral (S = 1/(hi − lo) per metre).
     */
    function makeSpectrum(kind, opts = {}) {
        let lines = [],
            continuum = null;
        if (kind === "white") {
            const lo = opts.lo || 400 * NM,
                hi = opts.hi || 700 * NM;
            continuum = {
                lo,
                hi,
                S: 1 / (hi - lo)
            };
        } else if (kind === "two") {
            const l0 = opts.lambda0 || 500 * NM,
                dl = opts.dLambda || 0.5 * NM;
            lines = [{
                lambda: l0 - dl / 2,
                weight: 1,
                label: "line 1"
            }, {
                lambda: l0 + dl / 2,
                weight: 1,
                label: "line 2"
            }];
        } else if (kind === "mono") {
            lines = [{
                lambda: opts.lambda0 || 550 * NM,
                weight: 1,
                label: "λ0"
            }];
        } else {
            lines = (PRESET_LINES[kind] || PRESET_LINES.hg).map((l) => Object.assign({}, l));
        }
        const tot = lines.reduce((a, l) => a + l.weight, 0);
        lines.forEach((l) => {
            l.weight /= tot || 1;
        });
        return {
            kind,
            lines,
            continuum
        };
    }

    /** Wavelength band [lo, hi] of a spectrum. */
    function spectrumBand(spec) {
        if (spec.continuum) return [spec.continuum.lo, spec.continuum.hi];
        const ls = spec.lines.map((l) => l.lambda);
        return [Math.min(...ls), Math.max(...ls)];
    }

    /**
     * Continuum contribution of one order at s. m ≠ 0: order-integrated (smooth-spectrum) result.
     * m = 0: numerical λ integration of the zero-order lobe (|q| < 1/2).
     */
    function continuumOrderTerm(s, m, cont, g) {
        if (m === 0) {
            if (Math.abs(g.d * s / cont.lo) >= 0.5) return 0;
            const K = 48,
                dl = (cont.hi - cont.lo) / K;
            let acc = 0;
            for (let j = 0; j < K; j++) {
                const lam = cont.lo + (j + 0.5) * dl;
                const q = g.d * s / lam;
                if (Math.abs(q) >= 0.5) continue;
                const env = sinc(PI * g.a * s / lam),
                    af = arrayFactorQ(q, g.N);
                acc += env * env * af * af;
            }
            return acc * dl * cont.S;
        }
        const lam = g.d * s / m;
        if (!(lam >= cont.lo && lam <= cont.hi)) return 0;
        return cont.S * orderEnvelope(m, g) * lam / (Math.abs(m) * g.N);
    }

    /** Orders m (including 0) whose continuum band reaches the s-interval [s0, s1]. */
    function continuumOrdersIn(s0, s1, cont, g) {
        const out = [];
        if (s0 <= cont.lo / (2 * g.d) && s1 >= -cont.lo / (2 * g.d)) out.push(0);
        const mMax = Math.ceil(2 * g.d / cont.lo) + 1;
        for (let m = -mMax; m <= mMax; m++) {
            if (m === 0) continue;
            const a = m * cont.lo / g.d,
                b = m * cont.hi / g.d;
            const lo = Math.min(a, b),
                hi = Math.max(a, b);
            if (hi >= s0 && lo <= s1) out.push(m);
        }
        return out;
    }

    /** Total spectral intensity at s (sum of lines + continuum orders). */
    function spectrumIntensityS(s, spec, g) {
        let v = 0;
        for (const l of spec.lines) v += l.weight * intensityS(s, l.lambda, g);
        if (spec.continuum)
            for (const m of continuumOrdersIn(s, s, spec.continuum, g)) v += continuumOrderTerm(s, m, spec.continuum, g);
        return v;
    }

    /**
     * Peak-preserving per-column maxima for plotting a pattern whose peaks may be narrower than a
     * pixel. sEdges: ascending column edges (length ncol + 1). Each component's maximum over a column
     * is taken from 5 samples plus every principal maximum inside it. Returns
     * {total, comps: [{kind: "line", lambda, values} | {kind: "cont", order, values}]} (total = sum of
     * component column maxima, an upper envelope used only for display).
     */
    function columnMax(sEdges, spec, g) {
        const ncol = sEdges.length - 1;
        const comps = [];
        const total = new Float64Array(ncol);
        for (const l of spec.lines) {
            const vals = new Float64Array(ncol);
            for (let c = 0; c < ncol; c++) {
                const s0 = sEdges[c],
                    s1 = sEdges[c + 1];
                let mx = 0;
                for (let j = 0; j <= 4; j++) mx = Math.max(mx, intensityS(s0 + (s1 - s0) * j / 4, l.lambda, g));
                const q0 = Math.ceil(g.d * s0 / l.lambda),
                    q1 = Math.floor(g.d * s1 / l.lambda);
                for (let q = q0; q <= q1 && q - q0 < 64; q++) mx = Math.max(mx, intensityS(q * l.lambda / g.d, l.lambda, g));
                vals[c] = l.weight * mx;
                total[c] += vals[c];
            }
            comps.push({
                kind: "line",
                lambda: l.lambda,
                values: vals
            });
        }
        if (spec.continuum) {
            const orders = continuumOrdersIn(sEdges[0], sEdges[ncol], spec.continuum, g);
            for (const m of orders) {
                const vals = new Float64Array(ncol);
                for (let c = 0; c < ncol; c++) {
                    const s0 = sEdges[c],
                        s1 = sEdges[c + 1];
                    let mx = 0;
                    const K = m === 0 ? 6 : 2;
                    for (let j = 0; j <= K; j++) mx = Math.max(mx, continuumOrderTerm(s0 + (s1 - s0) * j / K, m, spec.continuum, g));
                    if (m === 0 && s0 <= 0 && s1 >= 0) mx = Math.max(mx, continuumOrderTerm(0, 0, spec.continuum, g));
                    vals[c] = mx;
                    total[c] += mx;
                }
                comps.push({
                    kind: "cont",
                    order: m,
                    values: vals
                });
            }
        }
        return {
            total,
            comps
        };
    }

    // ------------------------------------------------------------------ helpers on sampled curves
    /** Cumulative integral at cell edges of cell-centred samples f with spacing h. */
    function cumulative(f, h) {
        const C = new Float64Array(f.length + 1);
        for (let i = 0; i < f.length; i++) C[i + 1] = C[i] + f[i] * h;
        return C;
    }
    /** Box-average of cell-centred samples f (spacing h) over width w: (1/w)∫_{x−w/2}^{x+w/2} f. */
    function boxFilter(f, h, w) {
        if (!(w > h * 1e-3)) return Float64Array.from(f);
        const n = f.length,
            C = cumulative(f, h),
            out = new Float64Array(n);
        const Cat = (u) => { // u in cell-edge units (0..n), linear interpolation, clamped
            if (u <= 0) return 0;
            if (u >= n) return C[n];
            const i = Math.floor(u),
                t = u - i;
            return C[i] + t * (C[i + 1] - C[i]);
        };
        const half = w / (2 * h);
        for (let i = 0; i < n; i++) {
            const c = i + 0.5;
            out[i] = (Cat(c + half) - Cat(c - half)) / w;
        }
        return out;
    }

    /** FWHM of a single-peaked sampled curve (linear interpolation of the half-maximum crossings). */
    function fwhm(xs, ys) {
        let im = 0;
        for (let i = 1; i < ys.length; i++)
            if (ys[i] > ys[im]) im = i;
        const half = ys[im] / 2;
        let l = im;
        while (l > 0 && ys[l] > half) l--;
        let r = im;
        while (r < ys.length - 1 && ys[r] > half) r++;
        if (ys[l] > half || ys[r] > half) return NaN;
        const xl = xs[l] + (half - ys[l]) * (xs[l + 1] - xs[l]) / (ys[l + 1] - ys[l]);
        const xr = xs[r - 1] + (half - ys[r - 1]) * (xs[r] - xs[r - 1]) / (ys[r] - ys[r - 1]);
        return Math.abs(xr - xl);
    }

    /**
     * Dip test for two features expected near x1 and x2 on a sampled curve (xs monotonic). Finds the
     * maxima within ±|x2 − x1|/2 of each position and the minimum between them.
     * Returns {ratio = min / smaller peak (1 = no dip), resolved (ratio ≤ 8/π²), iPeak1, iPeak2, iMin}.
     */
    function dipRatio(xs, ys, x1, x2) {
        const n = xs.length;
        const asc = xs[n - 1] >= xs[0];
        const idx = (x) => { // nearest index
            let lo = 0,
                hi = n - 1;
            while (hi - lo > 1) {
                const mid = (lo + hi) >> 1;
                if ((xs[mid] <= x) === asc) lo = mid;
                else hi = mid;
            }
            return Math.abs(xs[lo] - x) <= Math.abs(xs[hi] - x) ? lo : hi;
        };
        const half = Math.abs(x2 - x1) / 2;
        const mid = 0.5 * (x1 + x2);
        const w = (x, towardMid) => {
            const a = idx(x - half),
                b = idx(x + half);
            let i0 = Math.min(a, b),
                i1 = Math.max(a, b);
            let best = i0;
            for (let i = i0; i <= i1; i++)
                if (ys[i] > ys[best]) best = i;
            return best;
        };
        const p1 = w(x1),
            p2 = w(x2);
        const iMid = idx(mid);
        const none = {
            ratio: 1,
            resolved: false,
            iPeak1: p1,
            iPeak2: p2,
            iMin: iMid
        };
        if (p1 === p2) return none;
        const a = Math.min(p1, p2),
            b = Math.max(p1, p2);
        let im = a;
        for (let i = a; i <= b; i++)
            if (ys[i] < ys[im]) im = i;
        if (im === a || im === b) return none;
        const ratio = ys[im] / Math.min(ys[p1], ys[p2]);
        return {
            ratio,
            resolved: ratio <= RAYLEIGH_DIP + 1e-9,
            iPeak1: p1,
            iPeak2: p2,
            iMin: im
        };
    }

    /**
     * Ideal grating (point entrance slit) dip test for two lines in order m, sampled in s.
     * Returns dipRatio(...) plus {s, I}.
     */
    function twoLineDip(lam1, lam2, weights, g, m, samples = 4001) {
        const s1 = m * lam1 / g.d,
            s2 = m * lam2 / g.d;
        const span = Math.abs(s2 - s1),
            c = 0.5 * (s1 + s2);
        const pad = Math.max(span, 2 * Math.max(lam1, lam2) / (g.N * g.d));
        const s = new Float64Array(samples),
            I = new Float64Array(samples);
        for (let i = 0; i < samples; i++) {
            s[i] = c - pad + 2 * pad * i / (samples - 1);
            I[i] = weights[0] * intensityS(s[i], lam1, g) + weights[1] * intensityS(s[i], lam2, g);
        }
        return Object.assign(dipRatio(s, I, s1, s2), {
            s,
            I
        });
    }

    // ------------------------------------------------------------------ spectrometer
    /**
     * Geometry of the spectrometer. cfg: {g, thetaI, m, lamC, fCol, fCam, slitW, pixel, nPix}.
     * Returns null when order m of lamC does not propagate.
     */
    function spectrometerGeometry(cfg) {
        const {
            g,
            thetaI,
            m,
            lamC,
            fCol,
            fCam,
            slitW,
            pixel
        } = cfg;
        const nPix = cfg.nPix || 2048;
        const sinC = orderSin(m, lamC, g.d, thetaI);
        if (!(Math.abs(sinC) < 1)) return null;
        const thetaC = Math.asin(sinC),
            cosC = Math.cos(thetaC);
        const sinI = Math.sin(thetaI);
        const geo = {
            thetaC,
            cosC,
            nPix,
            width: nPix * pixel,
            dispersion: fCam * m / (g.d * cosC), // dx/dλ at the detector centre (m/m)
            slitImage: slitW * (fCam / fCol) * Math.cos(thetaI) / cosC,
            slitAngle: slitW / fCol, // angular width of the entrance slit seen from the collimator
            diffX: fCam * lamC / (g.N * g.d * cosC), // centre-to-first-zero of the grating response in x
            xToTheta: (x) => thetaC + Math.atan(x / fCam),
            thetaToX: (th) => fCam * Math.tan(th - thetaC),
            xToS: (x) => Math.sin(thetaC + Math.atan(x / fCam)) - sinI,
            lambdaAt: (x, order = m) => g.d * (Math.sin(thetaC + Math.atan(x / fCam)) - sinI) / order,
            xAtLambda: (lam, order = m) => {
                const sn = sinI + order * lam / g.d;
                return Math.abs(sn) < 1 ? fCam * Math.tan(Math.asin(sn) - thetaC) : NaN;
            }
        };
        return geo;
    }

    /**
     * Simulate the detector. cfg: {spec, g, thetaI, m, lamC, fCol, fCam, slitW, pixel, nPix,
     * maxFine = 250000}. Fine grid step h = pixel/k resolves the diffraction-limited response
     * (h ≤ diffX/6 when possible). Every stage is in the same units (I/I0 of the zero order for a
     * point slit, fixed total power), so the slit and pixel stages lower peaks but conserve area.
     * Returns {ok, geo, x, ideal, slit, pixX, pixels, comps, h, k, underResolved} with x/ideal/slit
     * trimmed to the detector.
     */
    function simulateDetector(cfg) {
        const geo = spectrometerGeometry(cfg);
        if (!geo) return {
            ok: false,
            reason: "order " + cfg.m + " of the centre wavelength does not propagate"
        };
        const {
            spec,
            g,
            pixel
        } = cfg;
        const nPix = geo.nPix,
            W = geo.width;
        const maxFine = cfg.maxFine || 250000;
        const wImg = geo.slitImage;
        let k = Math.max(4, Math.ceil(6 * pixel / geo.diffX));
        const padGuess = wImg / 2 + 2 * pixel;
        let underResolved = false;
        const fineCount = (kk) => Math.ceil(nPix * kk + 2 * padGuess / (pixel / kk));
        while (fineCount(k) > maxFine && k > 1) {
            k = Math.max(1, Math.floor(k / 1.25));
            underResolved = true;
        }
        const h = pixel / k;
        const padCells = Math.ceil(padGuess / h);
        const nf = nPix * k + 2 * padCells;
        const x0 = -W / 2 - padCells * h;
        const xs = new Float64Array(nf),
            ss = new Float64Array(nf);
        for (let i = 0; i < nf; i++) {
            xs[i] = x0 + (i + 0.5) * h;
            ss[i] = geo.xToS(xs[i]);
        }

        const idealAll = new Float64Array(nf),
            slitAll = new Float64Array(nf);
        const pixels = new Float64Array(nPix);
        const comps = [];
        const toPixels = (f) => {
            const out = new Float64Array(nPix);
            for (let p = 0; p < nPix; p++) {
                let acc = 0;
                const base = padCells + p * k;
                for (let j = 0; j < k; j++) acc += f[base + j];
                out[p] = acc / k;
            }
            return out;
        };
        const addComp = (f, info) => {
            const sl = boxFilter(f, h, wImg);
            for (let i = 0; i < nf; i++) {
                idealAll[i] += f[i];
                slitAll[i] += sl[i];
            }
            const px = toPixels(sl);
            for (let p = 0; p < nPix; p++) pixels[p] += px[p];
            comps.push(Object.assign({
                pixels: px
            }, info));
        };
        for (const l of spec.lines) {
            const f = new Float64Array(nf);
            for (let i = 0; i < nf; i++) f[i] = l.weight * intensityS(ss[i], l.lambda, g);
            addComp(f, {
                kind: "line",
                lambda: l.lambda
            });
        }
        if (spec.continuum) {
            const sLo = Math.min(ss[0], ss[nf - 1]),
                sHi = Math.max(ss[0], ss[nf - 1]);
            for (const m of continuumOrdersIn(sLo, sHi, spec.continuum, g)) {
                const f = new Float64Array(nf);
                for (let i = 0; i < nf; i++) f[i] = continuumOrderTerm(ss[i], m, spec.continuum, g);
                addComp(f, {
                    kind: "cont",
                    order: m
                });
            }
        }
        const pixX = new Float64Array(nPix),
            lamPix = new Float64Array(nPix);
        for (let p = 0; p < nPix; p++) {
            pixX[p] = -W / 2 + (p + 0.5) * pixel;
            lamPix[p] = geo.lambdaAt(pixX[p]);
        }
        const a = padCells,
            b = padCells + nPix * k;
        return {
            ok: true,
            geo,
            h,
            k,
            underResolved,
            x: xs.slice(a, b),
            ideal: idealAll.slice(a, b),
            slit: slitAll.slice(a, b),
            pixX,
            lamPix,
            pixels,
            comps
        };
    }

    /**
     * Instrument line profile for a single line at lamC (continuous, not pixel-phase dependent):
     * grating response ⊗ slit image ⊗ pixel aperture, in detector x. Returns FWHMs in x and in λ,
     * the ideal and instrument resolving powers and the stage curves.
     */
    function instrumentProfile(cfg) {
        const geo = spectrometerGeometry(cfg);
        if (!geo) return null;
        const {
            g,
            lamC,
            pixel,
            m
        } = cfg;
        const wImg = geo.slitImage;
        const span = 3 * (wImg + pixel) + 8 * geo.diffX;
        const h = Math.max(span / 150000, Math.min(geo.diffX / 12, (wImg + pixel) / 60));
        const n = 2 * Math.ceil(span / h) + 1;
        const xs = new Float64Array(n),
            f = new Float64Array(n);
        for (let i = 0; i < n; i++) {
            xs[i] = -span + i * (2 * span / (n - 1));
            f[i] = intensityS(geo.xToS(xs[i]), lamC, g);
        }
        const hh = 2 * span / (n - 1);
        const sl = boxFilter(f, hh, wImg);
        const inst = boxFilter(sl, hh, pixel);
        const D = Math.abs(geo.dispersion);
        const fw = {
            ideal: fwhm(xs, f),
            slit: fwhm(xs, sl),
            inst: fwhm(xs, inst)
        };
        const fwL = {
            ideal: fw.ideal / D,
            slit: fw.slit / D,
            inst: fw.inst / D
        };
        return {
            geo,
            x: xs,
            ideal: f,
            slit: sl,
            inst,
            fwhmX: fw,
            fwhmLambda: fwL,
            slitLambda: wImg / D,
            pixelLambda: pixel / D,
            idealR: resolvingPower(m, g.N),
            instR: lamC / fwL.inst,
            rayleighLambda: lamC / resolvingPower(m, g.N)
        };
    }

    /** Max |analytic − direct sum| over the given s values. */
    function crossCheck(sArr, lam, g, M = 32) {
        let worst = 0;
        for (const s of sArr) worst = Math.max(worst, Math.abs(intensityS(s, lam, g) - directSum(s, lam, g, M)));
        return worst;
    }

    return {
        RAYLEIGH_DIP,
        sinc,
        arrayFactor,
        arrayFactorQ,
        intensityS,
        intensity,
        directSum,
        crossCheck,
        orderSin,
        orderAngle,
        allowedOrders,
        orderEnvelope,
        missingOrders,
        angularDispersion,
        resolvingPower,
        freeSpectralRange,
        halfMaxEps,
        idealFWHM,
        PRESET_LINES,
        makeSpectrum,
        spectrumBand,
        continuumOrderTerm,
        continuumOrdersIn,
        spectrumIntensityS,
        columnMax,
        boxFilter,
        fwhm,
        dipRatio,
        twoLineDip,
        spectrometerGeometry,
        simulateDetector,
        instrumentProfile
    };
});