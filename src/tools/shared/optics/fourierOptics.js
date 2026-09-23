/*
 * Fourier optics, imaging and resolution (N6): pure scalar imaging model, DOM-free.
 *
 * Browser: <script src="../shared/optics/fourierOptics.js"></script> → window.OpticsModels.fourierOptics
 * Node:    const fo = require(".../shared/optics/fourierOptics.js")
 *
 * Model (scalar, paraxial-in-magnification, unit magnification, space-invariant)
 * ------------------------------------------------------------------------------
 *  - Object: complex amplitude transmittance t(x, y) illuminated by an on-axis unit plane wave.
 *    Object coordinates are referred to image space (magnification 1), so NA is the image-side
 *    numerical aperture in air and all lengths are metres.
 *  - Pupil (Fourier plane of a 4f system): P(f) = A(f) · F(f) · exp[i Φ(f)], with
 *        A = circ(|f| / fc),  fc = NA / λ0  (coherent amplitude cutoff),
 *        F = optional Fourier-plane filter (low/high/band-pass, knife edge, dark-field stop,
 *            π/2 phase dot for Zernike phase contrast),
 *        Φ = 2π Σ_j c_j Z_j(ρ, θ) + defocus phase,  ρ = |f|/fc, θ = atan2(fy, fx).
 *    Zernike polynomials use the NOLL index and normalisation: each Z_j has unit RMS over the unit
 *    disk, so c_j is directly the RMS wavefront error of that term in waves.
 *    Defocus Δz uses the exact scalar angular-spectrum phase 2πΔz(√(1/λ² − f²) − 1/λ).
 *    A Fourier-plane point at spatial frequency f sits at u = λ0 f_lens · f (lens focal length f_lens).
 *  - Coherent imaging (complex amplitude):   U_img = IFFT{ FFT(t) · P },  I = |U_img|².
 *  - Incoherent imaging (intensity):          I_img = I_obj ⊛ |h|²,  h = IFFT(P),
 *        i.e. Ĩ_img = Ĩ_obj · OTF, OTF = FT|h|² / ∫|h|² = normalised autocorrelation of P.
 *    The incoherent image is scaled by the collected fraction ∫|P|² / ∫|A|² so that a uniform
 *    object with an unfiltered pupil gives I = 1 in both modes (units: illumination intensity).
 *    The two operations are never mixed: `mode` selects one explicitly.
 *  - Grids: N × N (power of two), sample spacing dx = fov/N, frequency spacing df = 1/fov.
 *    Storage is CENTRED: index N/2 is x = 0 (or f = 0). Row-major a[iy*N + ix]. FFTs use core.fft2
 *    (numpy convention) with quadrant swaps around them. The field is periodic with period fov.
 *
 * Main entry: simulate(params) → { grid, object, pupil, psf, otf, image, cuts, readouts, warnings }.
 */
(function(root, factory) {
    const core = (typeof require === "function" && typeof module === "object") ? require("./core.js") : root.OpticsModels.core;
    const m = factory(core);
    if (typeof module === "object" && module.exports) module.exports = m;
    else {
        root.OpticsModels = root.OpticsModels || {};
        root.OpticsModels.fourierOptics = m;
    }
})(typeof self !== "undefined" ? self : this, function(core) {
    "use strict";

    const TAU = 2 * Math.PI;
    /** First zero of J1 divided by π: Airy first dark ring at RAYLEIGH_K · λ/NA. */
    const RAYLEIGH_K = core.besselJZero(1, 1) / (2 * Math.PI); // 0.6098…

    // ------------------------------------------------------------------ analytic references
    /** Airy intensity [2 J1(v)/v]², v = 2π NA r / λ. Peak-normalised. */
    function airy(r, lambda, NA) {
        const v = TAU * NA * r / lambda;
        if (Math.abs(v) < 1e-9) return 1;
        const a = 2 * core.besselJ1(v) / v;
        return a * a;
    }
    /** Diffraction-limited incoherent MTF of a circular pupil; f in cycles/m, cutoff 2NA/λ. */
    function mtfCircular(f, lambda, NA) {
        const v = Math.abs(f) / (2 * NA / lambda);
        if (v >= 1) return 0;
        return (2 / Math.PI) * (Math.acos(v) - v * Math.sqrt(1 - v * v));
    }
    /** Coherent transfer function of an unaberrated circular pupil (amplitude): 1 inside NA/λ. */
    const ctfCircular = (f, lambda, NA) => (Math.abs(f) <= NA / lambda ? 1 : 0);
    const rayleigh = (lambda, NA) => RAYLEIGH_K * lambda / NA;
    /** Abbe coherent period limit λ/NA (on-axis illumination). */
    const abbeCoherent = (lambda, NA) => lambda / NA;
    /** Conventional depth of focus ±λ/(2NA²), i.e. full width λ/NA² (quarter-wave defocus criterion). */
    const depthOfFocus = (lambda, NA) => lambda / (NA * NA);
    /** Fraction of power from an isotropic point emitter collected by a cone of half-angle asin(NA) in air. */
    const collectedFraction = (NA) => (1 - Math.sqrt(Math.max(0, 1 - NA * NA))) / 2;
    /** Maréchal approximation of the Strehl ratio for RMS wavefront error ω (waves). */
    const marechal = (rmsWaves) => Math.exp(-Math.pow(TAU * rmsWaves, 2));
    /** Paraxial on-axis intensity versus defocus for a uniform circular pupil: sinc²(πΔz NA²/(2λ)). */
    function axialIntensityParaxial(dz, lambda, NA) {
        const x = Math.PI * dz * NA * NA / (2 * lambda);
        if (Math.abs(x) < 1e-12) return 1;
        const s = Math.sin(x) / x;
        return s * s;
    }

    // ------------------------------------------------------------------ Zernike (Noll)
    /** Noll index j (≥1) → radial order n and signed azimuthal order m (m > 0 cos, m < 0 sin). */
    function nollToNM(j) {
        if (!(j >= 1) || j !== Math.floor(j)) throw new RangeError("Noll index must be a positive integer");
        let n = 0;
        while ((n + 1) * (n + 2) / 2 < j) n++;
        const k = j - n * (n + 1) / 2 - 1; // 0..n position in the row
        // |m| values in row n in Noll order: (n%2 ? 1,1,3,3,… : 0,2,2,4,4,…)
        let am;
        if (n % 2 === 0) am = 2 * Math.floor((k + 1) / 2);
        else am = 2 * Math.floor(k / 2) + 1;
        const m = am === 0 ? 0 : (j % 2 === 0 ? am : -am);
        return {
            n,
            m
        };
    }

    function factorial(k) {
        let r = 1;
        for (let i = 2; i <= k; i++) r *= i;
        return r;
    }

    function zernikeRadial(n, am, rho) {
        let s = 0;
        for (let k = 0; k <= (n - am) / 2; k++) {
            s += ((k % 2 ? -1 : 1) * factorial(n - k)) /
                (factorial(k) * factorial((n + am) / 2 - k) * factorial((n - am) / 2 - k)) * Math.pow(rho, n - 2 * k);
        }
        return s;
    }
    /** Noll-normalised Zernike Z_j(ρ, θ) (unit RMS over the unit disk). */
    function zernike(j, rho, theta) {
        const {
            n,
            m
        } = nollToNM(j);
        const am = Math.abs(m);
        const R = zernikeRadial(n, am, rho);
        if (m === 0) return Math.sqrt(n + 1) * R;
        return Math.sqrt(2 * (n + 1)) * R * (m > 0 ? Math.cos(am * theta) : Math.sin(am * theta));
    }
    const ZERNIKE_NAMES = {
        1: "piston",
        2: "tilt x",
        3: "tilt y",
        4: "defocus",
        5: "astigmatism 45°",
        6: "astigmatism 0°",
        7: "coma y",
        8: "coma x",
        11: "primary spherical"
    };

    // ------------------------------------------------------------------ grids and FFT helpers
    function makeGrid(N, fov) {
        if (!core.isPow2(N) || N < 16) throw new RangeError("grid size must be a power of two ≥ 16");
        const dx = fov / N,
            df = 1 / fov;
        const x = new Float64Array(N),
            f = new Float64Array(N);
        for (let i = 0; i < N; i++) {
            x[i] = (i - N / 2) * dx;
            f[i] = (i - N / 2) * df;
        }
        return {
            N,
            fov,
            dx,
            df,
            x,
            f,
            fNyquist: 1 / (2 * dx)
        };
    }
    /** In-place quadrant swap (fftshift2 = ifftshift2 for even N). */
    function swapQuadrants(a, N) {
        const h = N / 2;
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < N; x++) {
                const i = y * N + x,
                    j = (y + h) * N + ((x + h) % N);
                const t = a[i];
                a[i] = a[j];
                a[j] = t;
            }
        }
        return a;
    }
    /** Centred 2D FFT (forward: X = Σ x e^{−2πi(fx x + fy y)}). Returns new arrays. */
    function fftCentered(re, im, N, inverse = false) {
        const r = Float64Array.from(re),
            i = Float64Array.from(im);
        swapQuadrants(r, N);
        swapQuadrants(i, N);
        core.fft2(r, i, N, N, inverse);
        swapQuadrants(r, N);
        swapQuadrants(i, N);
        return {
            re: r,
            im: i
        };
    }

    // ------------------------------------------------------------------ objects
    // 5 × 7 bitmap font (rows top→bottom, '#' = opaque stroke cell).
    const FONT = {
        A: [" ### ", "#   #", "#   #", "#####", "#   #", "#   #", "#   #"],
        B: ["#### ", "#   #", "#   #", "#### ", "#   #", "#   #", "#### "],
        C: [" ### ", "#   #", "#    ", "#    ", "#    ", "#   #", " ### "],
        D: ["#### ", "#   #", "#   #", "#   #", "#   #", "#   #", "#### "],
        E: ["#####", "#    ", "#    ", "#### ", "#    ", "#    ", "#####"],
        F: ["#####", "#    ", "#    ", "#### ", "#    ", "#    ", "#    "],
        G: [" ### ", "#   #", "#    ", "# ###", "#   #", "#   #", " ####"],
        H: ["#   #", "#   #", "#   #", "#####", "#   #", "#   #", "#   #"],
        I: ["#####", "  #  ", "  #  ", "  #  ", "  #  ", "  #  ", "#####"],
        J: ["  ###", "   # ", "   # ", "   # ", "   # ", "#  # ", " ##  "],
        K: ["#   #", "#  # ", "# #  ", "##   ", "# #  ", "#  # ", "#   #"],
        L: ["#    ", "#    ", "#    ", "#    ", "#    ", "#    ", "#####"],
        M: ["#   #", "## ##", "# # #", "# # #", "#   #", "#   #", "#   #"],
        N: ["#   #", "##  #", "# # #", "#  ##", "#   #", "#   #", "#   #"],
        O: [" ### ", "#   #", "#   #", "#   #", "#   #", "#   #", " ### "],
        P: ["#### ", "#   #", "#   #", "#### ", "#    ", "#    ", "#    "],
        Q: [" ### ", "#   #", "#   #", "#   #", "# # #", "#  # ", " ## #"],
        R: ["#### ", "#   #", "#   #", "#### ", "# #  ", "#  # ", "#   #"],
        S: [" ####", "#    ", "#    ", " ### ", "    #", "    #", "#### "],
        T: ["#####", "  #  ", "  #  ", "  #  ", "  #  ", "  #  ", "  #  "],
        U: ["#   #", "#   #", "#   #", "#   #", "#   #", "#   #", " ### "],
        V: ["#   #", "#   #", "#   #", "#   #", "#   #", " # # ", "  #  "],
        W: ["#   #", "#   #", "#   #", "# # #", "# # #", "## ##", "#   #"],
        X: ["#   #", "#   #", " # # ", "  #  ", " # # ", "#   #", "#   #"],
        Y: ["#   #", "#   #", " # # ", "  #  ", "  #  ", "  #  ", "  #  "],
        Z: ["#####", "    #", "   # ", "  #  ", " #   ", "#    ", "#####"]
    };
    const OBJECT_TYPES = ["point", "twoPoints", "sinusoid", "bars", "edge", "phase", "letters"];

    /**
     * Build the object. params: { type, sep (m), nu (cycles/m), phi (rad), pointPhase (rad), text }.
     * Returns { re, im, intensity, points?, ampSpec?, intSpec?, nuEff?, stroke?, info }.
     * Point objects carry analytic (band-limited, sub-pixel exact) spectra; their spatial arrays
     * are nearest-pixel deltas for display only.
     */
    function makeObject(grid, params = {}) {
        const {
            N,
            dx,
            x,
            f
        } = grid;
        const type = params.type || "twoPoints";
        const re = new Float64Array(N * N),
            im = new Float64Array(N * N);
        const out = {
            type,
            re,
            im
        };
        const nu = Math.max(1e-9, params.nu || 1e6);
        if (type === "point" || type === "twoPoints") {
            const sep = type === "point" ? 0 : Math.max(0, params.sep || 0);
            const psi = type === "point" ? 0 : (params.pointPhase || 0);
            const pts = type === "point" ? [{
                    x: 0,
                    y: 0,
                    a: {
                        re: 1,
                        im: 0
                    }
                }] :
                [{
                    x: -sep / 2,
                    y: 0,
                    a: {
                        re: 1,
                        im: 0
                    }
                }, {
                    x: sep / 2,
                    y: 0,
                    a: {
                        re: Math.cos(psi),
                        im: Math.sin(psi)
                    }
                }];
            out.points = pts;
            const aR = new Float64Array(N * N),
                aI = new Float64Array(N * N);
            const iR = new Float64Array(N * N),
                iI = new Float64Array(N * N);
            for (let iy = 0; iy < N; iy++) {
                for (let ix = 0; ix < N; ix++) {
                    const k = iy * N + ix;
                    for (const p of pts) {
                        const ph = -TAU * (f[ix] * p.x + f[iy] * p.y);
                        const c = Math.cos(ph),
                            s = Math.sin(ph);
                        aR[k] += p.a.re * c - p.a.im * s;
                        aI[k] += p.a.re * s + p.a.im * c;
                        iR[k] += c;
                        iI[k] += s; // |a|² = 1 for every point
                    }
                }
            }
            out.ampSpec = {
                re: aR,
                im: aI
            };
            out.intSpec = {
                re: iR,
                im: iI
            };
            for (const p of pts) {
                const ix = Math.round(p.x / dx) + N / 2,
                    iy = Math.round(p.y / dx) + N / 2;
                if (ix >= 0 && ix < N && iy >= 0 && iy < N) {
                    re[iy * N + ix] += p.a.re;
                    im[iy * N + ix] += p.a.im;
                }
            }
            out.info = type === "point" ? "single point (band-limited delta)" : "two points, separation " + core.formatSI(sep, "m");
        } else if (type === "sinusoid") {
            // intensity transmittance I = ½[1 + cos(2πνx)], amplitude t = √I (non-negative)
            const cycles = Math.max(1, Math.round(nu * grid.fov));
            const nuEff = cycles / grid.fov;
            out.nuEff = nuEff;
            for (let iy = 0; iy < N; iy++)
                for (let ix = 0; ix < N; ix++) {
                    re[iy * N + ix] = Math.sqrt(Math.max(0, 0.5 * (1 + Math.cos(TAU * nuEff * x[ix]))));
                }
            out.info = "sinusoidal intensity target, ν = " + core.formatSI(nuEff * 1e-6, "") + " cycles/µm (snapped to a whole number of periods per field)";
        } else if (type === "bars") {
            const p = 1 / nu,
                w = p / 2;
            out.period = p;
            // group V: vertical bars (vary along x), group H: horizontal bars (vary along y)
            const inV = (X, Y) => {
                if (Y < -1.25 * p || Y >= 1.25 * p) return false;
                for (let k = 0; k < 3; k++) {
                    const x0 = -2.75 * p + k * p;
                    if (X >= x0 && X < x0 + w) return true;
                }
                return false;
            };
            const inH = (X, Y) => {
                if (X < 0.25 * p || X >= 2.75 * p) return false;
                for (let k = 0; k < 3; k++) {
                    const y0 = -1.25 * p + k * p;
                    if (Y >= y0 && Y < y0 + w) return true;
                }
                return false;
            };
            fillSupersampled(grid, re, (X, Y) => inV(X, Y) || inH(X, Y));
            out.info = "3-bar target, period " + core.formatSI(p, "m");
        } else if (type === "edge") {
            for (let iy = 0; iy < N; iy++)
                for (let ix = 0; ix < N; ix++) re[iy * N + ix] = ix > N / 2 ? 1 : ix === N / 2 ? 0.5 : 0;
            out.info = "knife edge at x = 0 (periodic field: a second edge sits at x = ±fov/2)";
        } else if (type === "phase") {
            // transparent "cell": disk radius 0.28·fov with phase φ, nucleus radius 0.09·fov with extra φ, small granule
            const L = grid.fov,
                phi = params.phi == null ? 0.3 : params.phi;
            const phase = new Float64Array(N * N);
            fillSupersampled(grid, phase, (X, Y) => {
                let v = 0;
                if (X * X + Y * Y < (0.28 * L) ** 2) v += 1;
                if ((X - 0.07 * L) ** 2 + (Y - 0.04 * L) ** 2 < (0.09 * L) ** 2) v += 1;
                if ((X + 0.14 * L) ** 2 + (Y + 0.12 * L) ** 2 < (0.035 * L) ** 2) v += 1;
                return v;
            });
            for (let k = 0; k < N * N; k++) {
                re[k] = Math.cos(phi * phase[k]);
                im[k] = Math.sin(phi * phase[k]);
            }
            out.phaseMap = phase.map((v) => v * phi);
            out.phi = phi;
            out.info = "pure phase object (|t| = 1), steps of φ = " + phi.toFixed(3) + " rad";
        } else if (type === "letters") {
            const text = String(params.text || "OPTICS").toUpperCase().slice(0, 8);
            const s = 1 / (2 * nu); // stroke = half-period
            const n = text.length,
                width = (6 * n - 1) * s,
                height = 7 * s;
            const x0 = -width / 2,
                y0 = height / 2;
            fillSupersampled(grid, re, (X, Y) => {
                const col = Math.floor((X - x0) / s),
                    row = Math.floor((y0 - Y) / s);
                if (row < 0 || row > 6 || col < 0) return false;
                const ci = Math.floor(col / 6),
                    cc = col % 6;
                if (ci >= n || cc > 4) return false;
                const g = FONT[text[ci]];
                return !!g && g[row][cc] === "#";
            });
            out.stroke = s;
            out.info = "letters \"" + text + "\", stroke " + core.formatSI(s, "m");
        } else {
            throw new RangeError("unknown object type " + type);
        }
        const intensity = new Float64Array(N * N);
        for (let k = 0; k < N * N; k++) intensity[k] = re[k] * re[k] + im[k] * im[k];
        out.intensity = intensity;
        return out;
    }
    /** Area-average an indicator/scalar function over each pixel (4 × 4 sub-samples). y increases with iy. */
    function fillSupersampled(grid, arr, fn) {
        const {
            N,
            dx,
            x
        } = grid, S = 4;
        for (let iy = 0; iy < N; iy++) {
            for (let ix = 0; ix < N; ix++) {
                let acc = 0;
                for (let sy = 0; sy < S; sy++)
                    for (let sx = 0; sx < S; sx++) {
                        acc += Number(fn(x[ix] + ((sx + 0.5) / S - 0.5) * dx, x[iy] + ((sy + 0.5) / S - 0.5) * dx));
                    }
                arr[iy * N + ix] = acc / (S * S);
            }
        }
    }

    // ------------------------------------------------------------------ pupil and filters
    const FILTER_TYPES = ["none", "lowpass", "highpass", "bandpass", "knife", "darkfield", "phasecontrast"];

    /** Complex Fourier-plane filter value at (fx, fy); r1, r2 are radii as fractions of fc. */
    function filterValue(type, fx, fy, fc, r1, r2, df) {
        const r = Math.hypot(fx, fy);
        const stopR = Math.max(0.51 * df, r1 * fc); // central stops cover at least the DC sample
        switch (type) {
            case "lowpass":
                return {
                    re: r <= r1 * fc ? 1 : 0, im: 0
                };
            case "highpass":
                return {
                    re: r > r1 * fc ? 1 : 0, im: 0
                };
            case "bandpass":
                return {
                    re: r >= Math.min(r1, r2) * fc && r <= Math.max(r1, r2) * fc ? 1 : 0, im: 0
                };
            case "knife":
                return {
                    re: fx > 1e-12 * fc ? 1 : Math.abs(fx) <= 1e-12 * fc ? 0.5 : 0, im: 0
                };
            case "darkfield":
                return {
                    re: r <= stopR ? 0 : 1, im: 0
                };
            case "phasecontrast":
                return r <= stopR ? {
                    re: 0,
                    im: 1
                } : {
                    re: 1,
                    im: 0
                }; // +π/2 on the undiffracted light
            default:
                return {
                    re: 1, im: 0
                };
        }
    }

    /**
     * Build pupil arrays (centred). params: { lambda, NA, zernike: {j: c_waves}, dz (m),
     * filter: {type, r1, r2} }. Aperture edge pixels are area-weighted (4 × 4 sub-samples).
     * Returns { aperture (A), phase Φ (rad, 0 outside), W (waves, NaN outside), filterRe/Im,
     *   ab: {re, im} = A e^{iΦ}, sys: {re, im} = A F e^{iΦ}, fc, rmsWaves, pvWaves, radiusPx, maxPhaseStep }.
     */
    function makePupil(grid, params) {
        const {
            N,
            f,
            df
        } = grid;
        const lambda = params.lambda,
            NA = params.NA;
        const fc = NA / lambda;
        const zer = params.zernike || {};
        const terms = Object.keys(zer).map(Number).filter((j) => zer[j]);
        const dz = params.dz || 0;
        const filt = params.filter || {
            type: "none"
        };
        const r1 = filt.r1 == null ? 0.5 : filt.r1,
            r2 = filt.r2 == null ? 1 : filt.r2;
        const A = new Float64Array(N * N),
            phase = new Float64Array(N * N),
            W = new Float64Array(N * N).fill(NaN);
        const fR = new Float64Array(N * N),
            fI = new Float64Array(N * N);
        const abR = new Float64Array(N * N),
            abI = new Float64Array(N * N);
        const sR = new Float64Array(N * N),
            sI = new Float64Array(N * N);
        const S = 4,
            k0 = 1 / lambda;
        let sw = 0,
            sw1 = 0,
            sw2 = 0;
        for (let iy = 0; iy < N; iy++) {
            const fy = f[iy];
            for (let ix = 0; ix < N; ix++) {
                const fx = f[ix],
                    k = iy * N + ix;
                const r = Math.hypot(fx, fy);
                let a;
                if (r <= fc - 0.75 * df) a = 1;
                else if (r >= fc + 0.75 * df) a = 0;
                else {
                    let c = 0;
                    for (let sy = 0; sy < S; sy++)
                        for (let sx = 0; sx < S; sx++) {
                            const ux = fx + ((sx + 0.5) / S - 0.5) * df,
                                uy = fy + ((sy + 0.5) / S - 0.5) * df;
                            if (ux * ux + uy * uy <= fc * fc) c++;
                        }
                    a = c / (S * S);
                }
                const fv = filterValue(filt.type, fx, fy, fc, r1, r2, df);
                fR[k] = fv.re;
                fI[k] = fv.im;
                if (a <= 0) continue;
                A[k] = a;
                const rho = Math.min(1, r / fc),
                    th = Math.atan2(fy, fx);
                let w = 0;
                for (const j of terms) w += zer[j] * zernike(j, rho, th);
                let ph = TAU * w;
                if (dz) ph += TAU * dz * (Math.sqrt(Math.max(0, k0 * k0 - r * r)) - k0);
                phase[k] = ph;
                const wv = ph / TAU;
                W[k] = wv;
                sw += a;
                sw1 += a * wv;
                sw2 += a * wv * wv;
                const c = Math.cos(ph),
                    s = Math.sin(ph);
                abR[k] = a * c;
                abI[k] = a * s;
                sR[k] = abR[k] * fv.re - abI[k] * fv.im;
                sI[k] = abR[k] * fv.im + abI[k] * fv.re;
            }
        }
        const mean = sw ? sw1 / sw : 0;
        const rms = sw ? Math.sqrt(Math.max(0, sw2 / sw - mean * mean)) : 0;
        let wmin = Infinity,
            wmax = -Infinity,
            maxStep = 0;
        for (let iy = 0; iy < N; iy++)
            for (let ix = 0; ix < N; ix++) {
                const k = iy * N + ix;
                if (!(A[k] > 0)) continue;
                if (W[k] < wmin) wmin = W[k];
                if (W[k] > wmax) wmax = W[k];
                if (ix + 1 < N && A[k + 1] > 0) maxStep = Math.max(maxStep, Math.abs(phase[k + 1] - phase[k]));
                if (iy + 1 < N && A[k + N] > 0) maxStep = Math.max(maxStep, Math.abs(phase[k + N] - phase[k]));
            }
        return {
            aperture: A,
            phase,
            W,
            filterRe: fR,
            filterIm: fI,
            ab: {
                re: abR,
                im: abI
            },
            sys: {
                re: sR,
                im: sI
            },
            fc,
            rmsWaves: rms,
            pvWaves: Number.isFinite(wmax) ? wmax - wmin : 0,
            radiusPx: fc / df,
            maxPhaseStep: maxStep
        };
    }

    // ------------------------------------------------------------------ PSF / OTF / images
    /** Amplitude PSF h = IFFT(P) (centred) and intensity PSF |h|². */
    function psfFromPupil(grid, P) {
        const h = fftCentered(P.re, P.im, grid.N, true);
        const I = new Float64Array(grid.N * grid.N);
        for (let k = 0; k < I.length; k++) I[k] = h.re[k] * h.re[k] + h.im[k] * h.im[k];
        return {
            h,
            I
        };
    }
    /** Normalised OTF = FT{|h|²}/∫|h|² (centred, OTF(0) = 1). */
    function otfFromPsf(grid, psfI) {
        let sum = 0;
        for (let k = 0; k < psfI.length; k++) sum += psfI[k];
        const o = fftCentered(psfI, new Float64Array(psfI.length), grid.N, false);
        for (let k = 0; k < psfI.length; k++) {
            o.re[k] /= sum;
            o.im[k] /= sum;
        }
        return o;
    }

    function spectrum(grid, re, im) {
        return fftCentered(re, im, grid.N, false);
    }

    /** Coherent image: U = IFFT(Õ · P), I = |U|². */
    function imageCoherent(grid, ampSpec, P) {
        const n = grid.N * grid.N,
            r = new Float64Array(n),
            i = new Float64Array(n);
        for (let k = 0; k < n; k++) {
            r[k] = ampSpec.re[k] * P.re[k] - ampSpec.im[k] * P.im[k];
            i[k] = ampSpec.re[k] * P.im[k] + ampSpec.im[k] * P.re[k];
        }
        const U = fftCentered(r, i, grid.N, true);
        const I = new Float64Array(n);
        for (let k = 0; k < n; k++) I[k] = U.re[k] * U.re[k] + U.im[k] * U.im[k];
        return {
            field: U,
            I,
            filteredSpec: {
                re: r,
                im: i
            }
        };
    }
    /** Incoherent image: Ĩ_img = Ĩ_obj · OTF, scaled by `gain` (collected fraction). */
    function imageIncoherent(grid, intSpec, otf, gain = 1) {
        const n = grid.N * grid.N,
            r = new Float64Array(n),
            i = new Float64Array(n);
        for (let k = 0; k < n; k++) {
            r[k] = intSpec.re[k] * otf.re[k] - intSpec.im[k] * otf.im[k];
            i[k] = intSpec.re[k] * otf.im[k] + intSpec.im[k] * otf.re[k];
        }
        const U = fftCentered(r, i, grid.N, true);
        const I = new Float64Array(n);
        for (let k = 0; k < n; k++) I[k] = Math.max(0, U.re[k]) * gain; // imaginary part is round-off
        return {
            I,
            filteredSpec: {
                re: r,
                im: i
            }
        };
    }

    // ------------------------------------------------------------------ measurements
    /** First local minimum of ys (after index start) refined by a parabola; returns fractional index or NaN. */
    function firstMinimumIndex(ys, start = 1) {
        for (let i = Math.max(1, start); i < ys.length - 1; i++) {
            if (ys[i] <= ys[i - 1] && ys[i] < ys[i + 1]) {
                const a = ys[i - 1],
                    b = ys[i],
                    c = ys[i + 1];
                const d = a - 2 * b + c;
                return i + (d > 0 ? 0.5 * (a - c) / d : 0);
            }
        }
        return NaN;
    }
    /** Index where ys first falls to ≤ level (linear interpolation), scanning from start. */
    function firstCrossingBelow(ys, level, start = 0) {
        for (let i = Math.max(1, start); i < ys.length; i++) {
            if (ys[i] <= level && ys[i - 1] > level) return i - 1 + (ys[i - 1] - level) / (ys[i - 1] - ys[i]);
        }
        return NaN;
    }
    /** Michelson modulation (max − min)/(max + min) of values in [i0, i1). */
    function modulation(ys, i0 = 0, i1 = ys.length) {
        let lo = Infinity,
            hi = -Infinity;
        for (let i = i0; i < i1; i++) {
            if (ys[i] < lo) lo = ys[i];
            if (ys[i] > hi) hi = ys[i];
        }
        return hi + lo > 0 ? (hi - lo) / (hi + lo) : 0;
    }
    /** Row iy of a centred array. */
    function row(a, N, iy = N / 2) {
        return a.slice(iy * N, iy * N + N);
    }

    function column(a, N, ix = N / 2) {
        const c = new Float64Array(N);
        for (let i = 0; i < N; i++) c[i] = a[i * N + ix];
        return c;
    }

    /** Linear interpolation in a centred row sampled at xs. */
    function sampleAt(xs, ys, x) {
        const dx = xs[1] - xs[0];
        const t = (x - xs[0]) / dx,
            i = Math.floor(t);
        if (i < 0 || i >= xs.length - 1) return NaN;
        return ys[i] + (t - i) * (ys[i + 1] - ys[i]);
    }

    /**
     * On-axis (x = 0) intensity versus extra defocus, from the pupil directly (no FFT):
     * I(z)/I₀ = |Σ A e^{iΦ} e^{iφ_z}|² / (Σ A)². Uses the exact angular-spectrum defocus phase.
     */
    function throughFocus(grid, pupil, lambda, dzs) {
        const {
            N,
            f
        } = grid, A = pupil.aperture, k0 = 1 / lambda;
        const idx = [],
            kz = [];
        let sA = 0;
        for (let iy = 0; iy < N; iy++)
            for (let ix = 0; ix < N; ix++) {
                const k = iy * N + ix;
                if (A[k] > 0) {
                    idx.push(k);
                    const r2 = f[ix] * f[ix] + f[iy] * f[iy];
                    kz.push(Math.sqrt(Math.max(0, k0 * k0 - r2)) - k0);
                    sA += A[k];
                }
            }
        const out = new Float64Array(dzs.length);
        dzs.forEach((z, n) => {
            let re = 0,
                im = 0;
            for (let q = 0; q < idx.length; q++) {
                const k = idx[q];
                const ph = TAU * z * kz[q];
                const c = Math.cos(ph),
                    s = Math.sin(ph);
                re += pupil.ab.re[k] * c - pupil.ab.im[k] * s;
                im += pupil.ab.re[k] * s + pupil.ab.im[k] * c;
            }
            out[n] = (re * re + im * im) / (sA * sA);
        });
        return out;
    }

    // ------------------------------------------------------------------ full simulation
    const DEFAULTS = Object.freeze({
        N: 256,
        fov: 16e-6,
        lambda: 550e-9,
        NA: 0.5,
        fLens: 0.1,
        mode: "incoherent",
        object: "twoPoints",
        sep: 1.0e-6,
        nu: 1.0e6,
        phi: 0.3,
        pointPhase: 0,
        text: "OPTICS",
        filter: "none",
        r1: 0.5,
        r2: 1.0,
        dz: 0,
        zernike: {}
    });

    function simulate(input = {}) {
        const p = Object.assign({}, DEFAULTS, input);
        if (!(p.mode === "coherent" || p.mode === "incoherent")) throw new RangeError("mode must be 'coherent' or 'incoherent'");
        const grid = makeGrid(p.N, p.fov);
        const N = grid.N,
            n = N * N;
        const obj = makeObject(grid, {
            type: p.object,
            sep: p.sep,
            nu: p.nu,
            phi: p.phi,
            pointPhase: p.pointPhase,
            text: p.text
        });
        const pupil = makePupil(grid, {
            lambda: p.lambda,
            NA: p.NA,
            zernike: p.zernike,
            dz: p.dz,
            filter: {
                type: p.filter,
                r1: p.r1,
                r2: p.r2
            }
        });
        const filtered = p.filter !== "none";

        // reference: unaberrated, unfiltered aperture → peak |h0|² = (ΣA/N²)² at x = 0
        let sumA = 0,
            sumA2 = 0,
            sumSys2 = 0;
        for (let k = 0; k < n; k++) {
            sumA += pupil.aperture[k];
            sumA2 += pupil.aperture[k] * pupil.aperture[k];
            sumSys2 += pupil.sys.re[k] * pupil.sys.re[k] + pupil.sys.im[k] * pupil.sys.im[k];
        }
        const refPeak = (sumA / n) * (sumA / n);

        const psfAb = psfFromPupil(grid, pupil.ab);
        const psfSys = filtered ? psfFromPupil(grid, pupil.sys) : psfAb;
        let peakAb = 0,
            peakIdx = 0;
        for (let k = 0; k < n; k++)
            if (psfAb.I[k] > peakAb) {
                peakAb = psfAb.I[k];
                peakIdx = k;
            }
        const strehl = peakAb / refPeak;
        const strehlOnAxis = psfAb.I[(N / 2) * N + N / 2] / refPeak;
        const psfNorm = new Float64Array(n); // system intensity PSF relative to the unaberrated peak
        for (let k = 0; k < n; k++) psfNorm[k] = psfSys.I[k] / refPeak;

        const otf = otfFromPsf(grid, psfSys.I);
        const mtf = new Float64Array(n);
        for (let k = 0; k < n; k++) mtf[k] = Math.hypot(otf.re[k], otf.im[k]);
        const collected = sumSys2 / sumA2;

        const objSpec = spectrum(grid, obj.re, obj.im);
        let image, fourierSpec;
        if (p.mode === "coherent") {
            const amp = obj.ampSpec || objSpec;
            image = imageCoherent(grid, amp, pupil.sys);
            fourierSpec = amp;
        } else {
            const ints = obj.intSpec || spectrum(grid, obj.intensity, new Float64Array(n));
            image = imageIncoherent(grid, ints, otf, collected);
            fourierSpec = ints; // incoherent: what the OTF filters is the intensity spectrum
        }

        // ---------- cuts
        const c = N / 2;
        const xs = grid.x,
            fs = grid.f;
        const psfRow = row(psfNorm, N, c),
            imgRow = row(image.I, N, c),
            objRow = row(obj.intensity, N, c);
        const mtfRow = row(mtf, N, c),
            otfReRow = row(otf.re, N, c);
        const ctfRow = new Float64Array(N);
        for (let i = 0; i < N; i++) ctfRow[i] = Math.hypot(pupil.sys.re[c * N + i], pupil.sys.im[c * N + i]);
        const apRow = row(pupil.aperture, N, c);

        // ---------- measurements
        const half = psfRow.slice(c); // r ≥ 0 along +x
        const iMin = firstMinimumIndex(half, 1);
        const psfFirstZero = Number.isFinite(iMin) ? iMin * grid.dx : NaN;
        const mtfHalf = mtfRow.slice(c);
        const mtfCut = firstCrossingBelow(mtfHalf, 1e-3, 1);
        const incoherentCutoff = Number.isFinite(mtfCut) ? mtfCut * grid.df : NaN;
        const ctfHalf = apRow.slice(c);
        const ctfCut = firstCrossingBelow(ctfHalf, 0.5, 1);
        const coherentCutoff = Number.isFinite(ctfCut) ? ctfCut * grid.df : NaN;

        const readouts = {
            mode: p.mode,
            fc: pupil.fc,
            incoherentCutoffTheory: 2 * pupil.fc,
            coherentCutoffTheory: pupil.fc,
            incoherentCutoffMeasured: incoherentCutoff,
            coherentCutoffMeasured: coherentCutoff,
            rayleigh: rayleigh(p.lambda, p.NA),
            abbe: abbeCoherent(p.lambda, p.NA),
            dof: depthOfFocus(p.lambda, p.NA),
            collectedFraction: collectedFraction(p.NA),
            psfFirstZero,
            strehl,
            strehlOnAxis,
            psfPeakOffset: {
                x: (peakIdx % N - c) * grid.dx,
                y: (Math.floor(peakIdx / N) - c) * grid.dx
            },
            rmsWaves: pupil.rmsWaves,
            pvWaves: pupil.pvWaves,
            marechal: marechal(pupil.rmsWaves),
            pupilThroughput: collected,
            pupilRadiusPx: pupil.radiusPx,
            fourierPlaneRadius: p.lambda * p.fLens * pupil.fc, // = NA · f_lens (paraxial)
            dx: grid.dx,
            df: grid.df,
            // peak image intensity of ONE ideal on-axis point in this mode (normalises point images)
            pointNorm: p.mode === "coherent" ? refPeak : refPeak * n / sumA2
        };
        // object-specific
        if (p.object === "twoPoints" || p.object === "point") {
            const sep = p.object === "point" ? 0 : p.sep;
            const a = sampleAt(xs, imgRow, -sep / 2),
                b = sampleAt(xs, imgRow, sep / 2),
                mid = sampleAt(xs, imgRow, 0);
            let peak = 0;
            for (let i = 0; i < N; i++) peak = Math.max(peak, imgRow[i]);
            readouts.twoPoint = {
                atPoints: (a + b) / 2,
                mid,
                peak,
                dipRatio: mid / Math.max(a, b, 1e-300),
                sepOverRayleigh: sep / readouts.rayleigh
            };
        }
        if (p.object === "sinusoid" || p.object === "bars") {
            const nuEff = obj.nuEff || p.nu;
            // central window: for the sinusoid the whole row; for bars the vertical group
            let i0 = 0,
                i1 = N;
            if (p.object === "bars") {
                const per = 1 / p.nu;
                i0 = Math.max(0, Math.round(-2.75 * per / grid.dx) + c);
                i1 = Math.min(N, Math.round(-0.25 * per / grid.dx) + c);
            }
            readouts.target = {
                nu: nuEff,
                objectModulation: modulation(objRow, i0, i1),
                imageModulation: modulation(imgRow, i0, i1),
                mtfAtNu: sampleAt(fs, mtfRow, nuEff),
                mtfTheory: mtfCircular(nuEff, p.lambda, p.NA),
                nuOverFc: nuEff / pupil.fc
            };
        }
        let imgMin = Infinity,
            imgMax = -Infinity,
            imgMean = 0;
        for (let k = 0; k < n; k++) {
            const v = image.I[k];
            if (v < imgMin) imgMin = v;
            if (v > imgMax) imgMax = v;
            imgMean += v;
        }
        imgMean /= n;
        readouts.image = {
            min: imgMin,
            max: imgMax,
            mean: imgMean,
            contrast: imgMax + imgMin > 0 ? (imgMax - imgMin) / (imgMax + imgMin) : 0
        };

        // ---------- warnings (sampling / validity)
        const warnings = [];
        if (pupil.radiusPx < 4) warnings.push("Pupil spans only " + pupil.radiusPx.toFixed(1) + " frequency samples (NA·fov/λ < 4): the PSF is wider than the field; increase the field of view or NA.");
        if (p.mode === "incoherent" && 2 * pupil.fc > grid.fNyquist) warnings.push("Incoherent cutoff 2NA/λ exceeds the sampling Nyquist frequency 1/(2dx): the OTF is aliased. Reduce the field of view or increase N.");
        if (p.mode === "coherent" && pupil.fc > grid.fNyquist) warnings.push("Coherent cutoff NA/λ exceeds the Nyquist frequency 1/(2dx): the pupil is clipped by the grid and passes every sampled frequency (image = object at this sampling).");
        if (pupil.maxPhaseStep > Math.PI / 2) warnings.push("Pupil phase changes by " + (pupil.maxPhaseStep / Math.PI).toFixed(2) + "π between neighbouring samples: the aberrated PSF wraps around the periodic field. Reduce the aberration or the field of view.");
        if (p.NA > 0.6) warnings.push("NA > 0.6: scalar, unit-magnification model; vector (polarisation) effects at high NA are not included.");

        return {
            params: p,
            grid,
            object: obj,
            pupil,
            filtered,
            psf: {
                I: psfNorm,
                h: psfSys.h,
                refPeak
            },
            otf: {
                re: otf.re,
                im: otf.im,
                mtf
            },
            image: {
                I: image.I,
                field: image.field || null
            },
            fourier: fourierSpec,
            cuts: {
                x: xs,
                f: fs,
                psf: psfRow,
                image: imgRow,
                object: objRow,
                mtf: mtfRow,
                otfRe: otfReRow,
                ctf: ctfRow,
                aperture: apRow
            },
            readouts,
            warnings
        };
    }

    return {
        RAYLEIGH_K,
        DEFAULTS,
        OBJECT_TYPES,
        FILTER_TYPES,
        ZERNIKE_NAMES,
        FONT,
        airy,
        mtfCircular,
        ctfCircular,
        rayleigh,
        abbeCoherent,
        depthOfFocus,
        collectedFraction,
        marechal,
        axialIntensityParaxial,
        nollToNM,
        zernike,
        zernikeRadial,
        makeGrid,
        swapQuadrants,
        fftCentered,
        makeObject,
        filterValue,
        makePupil,
        psfFromPupil,
        otfFromPsf,
        imageCoherent,
        imageIncoherent,
        throughFocus,
        firstMinimumIndex,
        firstCrossingBelow,
        modulation,
        sampleAt,
        row,
        column,
        simulate
    };
});