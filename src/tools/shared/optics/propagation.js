(function(root, factory) {
    const core = (typeof require === "function" && typeof module === "object") ? require("./core.js") : root.OpticsModels.core;
    const m = factory(core);
    if (typeof module === "object" && module.exports) module.exports = m;
    else {
        root.OpticsModels = root.OpticsModels || {};
        root.OpticsModels.propagation = m;
    }
})(typeof self !== "undefined" ? self : this, function(core) {
    "use strict";

    const TWO_PI = 2 * Math.PI;
    const METHODS = ["asm", "tf", "ir", "fresnel", "fraunhofer"];
    const SHAPES = ["slit", "rect", "circle", "annulus", "edge", "doubleSlit", "zonePlate", "disk", "open"];

    const isPow2 = (n) => n > 0 && (n & (n - 1)) === 0;

    function createGrid(N, L) {
        if (!isPow2(N)) throw new RangeError("grid N must be a power of two");
        const dx = L / N;
        const x = new Float64Array(N);
        for (let i = 0; i < N; i++) x[i] = (i - N / 2) * dx;
        return {
            N,
            L,
            dx,
            x
        };
    }


    const DEFAULT_SPEC = Object.freeze({
        shape: "circle",
        a: 1e-3,
        b: 3e-3,
        d: 0.5e-3,
        eps: 0.5,
        f: 0.2,
        zones: 8,
        zpPhase: false,
        illum: "plane",
        w: 2e-3,
        lambda: 633e-9,
        strokes: []
    });


    function shapeFn(spec) {
        const s = Object.assign({}, DEFAULT_SPEC, spec);
        const ha = s.a / 2,
            hb = s.b / 2;
        switch (s.shape) {
            case "slit":
            case "rect":
                return (x, y) => (Math.abs(x) <= ha && Math.abs(y) <= hb ? 1 : 0);
            case "circle":
                return (x, y) => (x * x + y * y <= ha * ha ? 1 : 0);
            case "annulus": {
                const hi = ha * s.eps;
                return (x, y) => {
                    const r2 = x * x + y * y;
                    return r2 <= ha * ha && r2 >= hi * hi ? 1 : 0;
                };
            }
            case "disk":
                return (x, y) => (x * x + y * y <= ha * ha ? 0 : 1);
            case "edge":
                return (x) => (x >= 0 ? 1 : 0);
            case "doubleSlit":
                return (x, y) => (Math.abs(y) <= hb && (Math.abs(x - s.d / 2) <= ha || Math.abs(x + s.d / 2) <= ha) ? 1 : 0);
            case "zonePlate": {
                const lf = s.lambda * s.f,
                    rMax2 = s.zones * lf;

                return (x, y) => {
                    const r2 = x * x + y * y;
                    if (r2 >= rMax2) return 0;
                    const odd = Math.floor(r2 / lf) % 2 === 1;
                    if (s.zpPhase) return odd ? -1 : 1;
                    return odd ? 0 : 1;
                };
            }
            case "open":
                return () => 1;
            default:
                throw new RangeError("unknown aperture shape " + s.shape);
        }
    }


    function apertureHalfWidth(spec) {
        const s = Object.assign({}, DEFAULT_SPEC, spec);
        switch (s.shape) {
            case "slit":
                return s.a / 2;
            case "rect":
                return Math.max(s.a, s.b) / 2;
            case "circle":
            case "annulus":
            case "disk":
                return s.a / 2;
            case "doubleSlit":
                return (s.d + s.a) / 2;
            case "zonePlate":
                return Math.sqrt(s.zones * s.lambda * s.f);
            default:
                return s.illum === "gauss" ? s.w : NaN;
        }
    }


    function smallestFeature(spec) {
        const s = Object.assign({}, DEFAULT_SPEC, spec);
        switch (s.shape) {
            case "slit":
            case "doubleSlit":
                return s.a;
            case "rect":
                return Math.min(s.a, s.b);
            case "circle":
            case "disk":
                return s.a;
            case "annulus":
                return s.a * (1 - s.eps) / 2;
            case "zonePlate": {
                const r = Math.sqrt(s.zones * s.lambda * s.f);
                return r - Math.sqrt((s.zones - 1) * s.lambda * s.f);
            }
            default:
                return NaN;
        }
    }


    function buildAperture(spec, grid, opts = {}) {
        const s = Object.assign({}, DEFAULT_SPEC, spec);
        const {
            N,
            dx,
            x
        } = grid;
        const ss = opts.supersample || 4;
        const fn = shapeFn(s);
        const re = new Float64Array(N * N),
            im = new Float64Array(N * N);
        const inv = 1 / (ss * ss);
        for (let iy = 0; iy < N; iy++) {
            const y0 = x[iy];
            for (let ix = 0; ix < N; ix++) {
                const x0 = x[ix];
                let acc = 0;
                for (let sy = 0; sy < ss; sy++) {
                    const yy = y0 + ((sy + 0.5) / ss - 0.5) * dx;
                    for (let sx = 0; sx < ss; sx++) acc += fn(x0 + ((sx + 0.5) / ss - 0.5) * dx, yy);
                }
                re[iy * N + ix] = acc * inv;
            }
        }
        const strokes = Array.isArray(s.strokes) ? s.strokes : [];
        for (const st of strokes) applyStroke(re, im, grid, st, ss);
        if (s.illum === "gauss") {
            const w2 = s.w * s.w;
            for (let iy = 0; iy < N; iy++)
                for (let ix = 0; ix < N; ix++) {
                    const g = Math.exp(-(x[ix] * x[ix] + x[iy] * x[iy]) / w2);
                    re[iy * N + ix] *= g;
                    im[iy * N + ix] *= g;
                }
        }
        return {
            re,
            im
        };
    }

    function applyStroke(re, im, grid, st, ss = 4) {
        const {
            N,
            dx,
            x
        } = grid;
        const r = Math.max(st.r || 0, 0),
            r2 = r * r;
        const erase = st.mode === "erase";
        const tr = erase ? 0 : (st.t == null ? 1 : st.t) * Math.cos(st.p || 0);
        const ti = erase ? 0 : (st.t == null ? 1 : st.t) * Math.sin(st.p || 0);
        const i0 = Math.max(0, Math.floor((st.x - r) / dx + N / 2) - 1),
            i1 = Math.min(N - 1, Math.ceil((st.x + r) / dx + N / 2) + 1);
        const j0 = Math.max(0, Math.floor((st.y - r) / dx + N / 2) - 1),
            j1 = Math.min(N - 1, Math.ceil((st.y + r) / dx + N / 2) + 1);
        for (let iy = j0; iy <= j1; iy++)
            for (let ix = i0; ix <= i1; ix++) {
                let c = 0;
                for (let sy = 0; sy < ss; sy++) {
                    const yy = x[iy] + ((sy + 0.5) / ss - 0.5) * dx - st.y;
                    for (let sx = 0; sx < ss; sx++) {
                        const xx = x[ix] + ((sx + 0.5) / ss - 0.5) * dx - st.x;
                        if (xx * xx + yy * yy <= r2) c++;
                    }
                }
                if (!c) continue;
                c /= ss * ss;
                const k = iy * N + ix;
                re[k] = re[k] * (1 - c) + c * tr;
                im[k] = im[k] * (1 - c) + c * ti;
            }
    }


    function power(re, im, dx) {
        let s = 0;
        for (let i = 0; i < re.length; i++) s += re[i] * re[i] + im[i] * im[i];
        return s * dx * dx;
    }

    function embed(re, im, N, Np) {
        const oR = new Float64Array(Np * Np),
            oI = new Float64Array(Np * Np);
        const off = (Np - N) / 2;
        for (let iy = 0; iy < N; iy++) {
            const src = iy * N,
                dst = (iy + off) * Np + off;
            oR.set(re.subarray(src, src + N), dst);
            oI.set(im.subarray(src, src + N), dst);
        }
        return {
            re: oR,
            im: oI
        };
    }


    function asmPhase(z, invL, f2) {
        const s = invL * invL - f2;
        const root = Math.sqrt(s);
        return TWO_PI * z * (-f2 / (root + invL));
    }


    const criticalDistance = (Lp, dx, lambda) => Lp * dx / lambda;


    const asmBandLimit = (lambda, z, Lp) => 1 / (lambda * Math.sqrt(Math.pow(2 * z / Lp, 2) + 1));


    function propagate(field, grid, params) {
        const p = Object.assign({
            method: "asm",
            pad: 2,
            evanescent: "drop",
            bandLimit: true
        }, params);
        const {
            lambda,
            z
        } = p;
        if (!(lambda > 0)) throw new RangeError("lambda must be > 0");
        if (!(z >= 0)) throw new RangeError("z must be ≥ 0");
        if (!METHODS.includes(p.method)) throw new RangeError("unknown method " + p.method);
        const N = grid.N,
            dx = grid.dx;
        const pad = Math.max(1, Math.round(p.pad));
        if (!isPow2(pad)) throw new RangeError("pad must be a power of two");
        const Np = N * pad,
            Lp = Np * dx;
        const pin = power(field.re, field.im, dx);
        const shouldCancel = p.shouldCancel || (() => false);
        const e = embed(field.re, field.im, N, Np);
        let outDx = dx,
            removed = 0,
            evanescentFraction = 0,
            bl = Infinity;

        if (p.method === "asm" || p.method === "tf" || p.method === "ir") {
            core.fft2(e.re, e.im, Np, Np);
            if (shouldCancel()) return null;
            const f = core.fftFreq(Np, dx);
            const invL = 1 / lambda;
            let Hre, Him;
            if (p.method === "ir" && z > 0) {

                Hre = new Float64Array(Np * Np);
                Him = new Float64Array(Np * Np);
                const scale = dx * dx / (lambda * z);
                for (let iy = 0; iy < Np; iy++) {
                    const yy = (iy < Np / 2 ? iy : iy - Np) * dx;
                    for (let ix = 0; ix < Np; ix++) {
                        const xx = (ix < Np / 2 ? ix : ix - Np) * dx;
                        const ph = Math.PI * (xx * xx + yy * yy) / (lambda * z);

                        Hre[iy * Np + ix] = scale * Math.sin(ph);
                        Him[iy * Np + ix] = -scale * Math.cos(ph);
                    }
                }
                core.fft2(Hre, Him, Np, Np);
            }
            if (p.bandLimit && z > 0) {
                if (p.method === "asm") bl = asmBandLimit(lambda, z, Lp);
                else if (p.method === "tf") bl = Lp / (2 * lambda * z);
            }
            let specTotal = 0,
                specRemoved = 0,
                specEvan = 0;
            for (let iy = 0; iy < Np; iy++) {
                const fy = f[iy];
                for (let ix = 0; ix < Np; ix++) {
                    const fx = f[ix],
                        k = iy * Np + ix;
                    const f2 = fx * fx + fy * fy;
                    const a2 = e.re[k] * e.re[k] + e.im[k] * e.im[k];
                    specTotal += a2;
                    let hr, hi;
                    if (p.method === "asm") {
                        if (f2 <= invL * invL) {
                            const ph = asmPhase(z, invL, f2);
                            hr = Math.cos(ph);
                            hi = Math.sin(ph);
                        } else {
                            specEvan += a2;
                            if (p.evanescent === "decay") {
                                hr = Math.exp(-TWO_PI * z * Math.sqrt(f2 - invL * invL));
                                hi = 0;
                            } else {
                                hr = 0;
                                hi = 0;
                            }
                        }
                    } else if (p.method === "tf") {
                        const ph = -Math.PI * lambda * z * f2;
                        hr = Math.cos(ph);
                        hi = Math.sin(ph);
                    } else if (z > 0) {
                        hr = Hre[k];
                        hi = Him[k];
                    } else {
                        hr = 1;
                        hi = 0;
                    }
                    if (Math.abs(fx) > bl || Math.abs(fy) > bl) {
                        hr = 0;
                        hi = 0;
                    }
                    const m2 = hr * hr + hi * hi;
                    specRemoved += a2 * (1 - Math.min(1, m2));
                    const r = e.re[k] * hr - e.im[k] * hi;
                    e.im[k] = e.re[k] * hi + e.im[k] * hr;
                    e.re[k] = r;
                }
            }
            if (shouldCancel()) return null;
            core.ifft2(e.re, e.im, Np, Np);
            removed = specTotal > 0 ? pin * specRemoved / specTotal : 0;
            evanescentFraction = specTotal > 0 ? specEvan / specTotal : 0;
        } else {

            if (!(z > 0)) throw new RangeError("single-FFT transforms need z > 0");
            const chirp = p.method === "fresnel";
            const c1 = Math.PI / (lambda * z);
            if (chirp) {
                for (let iy = 0; iy < Np; iy++) {
                    const yy = (iy - Np / 2) * dx;
                    for (let ix = 0; ix < Np; ix++) {
                        const xx = (ix - Np / 2) * dx,
                            k = iy * Np + ix;
                        const ph = c1 * (xx * xx + yy * yy),
                            c = Math.cos(ph),
                            s = Math.sin(ph);
                        const r = e.re[k] * c - e.im[k] * s;
                        e.im[k] = e.re[k] * s + e.im[k] * c;
                        e.re[k] = r;
                    }
                }
            }
            let sr = core.ifftshift2(e.re, Np, Np),
                si = core.ifftshift2(e.im, Np, Np);
            core.fft2(sr, si, Np, Np);
            if (shouldCancel()) return null;
            e.re = core.fftshift2(sr, Np, Np);
            e.im = core.fftshift2(si, Np, Np);
            outDx = lambda * z / (Np * dx);
            const scale = dx * dx / (lambda * z);
            for (let iy = 0; iy < Np; iy++) {
                const yy = (iy - Np / 2) * outDx;
                for (let ix = 0; ix < Np; ix++) {
                    const xx = (ix - Np / 2) * outDx,
                        k = iy * Np + ix;

                    const ph = c1 * (xx * xx + yy * yy) - Math.PI / 2;
                    const c = scale * Math.cos(ph),
                        s = scale * Math.sin(ph);
                    const r = e.re[k] * c - e.im[k] * s;
                    e.im[k] = e.re[k] * s + e.im[k] * c;
                    e.re[k] = r;
                }
            }
        }

        const pout = power(e.re, e.im, outDx);
        const direct = p.method === "fresnel" || p.method === "fraunhofer";
        const crop = direct ? {
            off: 0,
            size: Np
        } : {
            off: (Np - N) / 2,
            size: N
        };
        let pdet = 0;
        for (let iy = crop.off; iy < crop.off + crop.size; iy++)
            for (let ix = crop.off; ix < crop.off + crop.size; ix++) {
                const k = iy * Np + ix;
                pdet += e.re[k] * e.re[k] + e.im[k] * e.im[k];
            }
        pdet *= outDx * outDx;

        const band = Math.max(2, Math.round(Np / 32));
        let pedge = 0;
        for (let iy = 0; iy < Np; iy++)
            for (let ix = 0; ix < Np; ix++) {
                if (ix >= band && ix < Np - band && iy >= band && iy < Np - band) continue;
                const k = iy * Np + ix;
                pedge += e.re[k] * e.re[k] + e.im[k] * e.im[k];
            }
        pedge *= outDx * outDx;
        return {
            re: e.re,
            im: e.im,
            n: Np,
            dx: outDx,
            crop,
            method: p.method,
            pad,
            bandLimit: bl,
            power: {
                input: pin,
                output: pout,
                removed,
                detector: pdet,
                outside: pout - pdet,
                edge: pedge,
                evanescentFraction
            }
        };
    }


    const sinc = (u) => (Math.abs(u) < 1e-8 ? 1 - u * u * Math.PI * Math.PI / 6 : Math.sin(Math.PI * u) / (Math.PI * u));
    const jinc = (v) => (Math.abs(v) < 1e-8 ? 1 - v * v / 8 : 2 * core.besselJ1(v) / v);


    function fraunhoferAnalytic(spec, lambda, z) {
        const s = Object.assign({}, DEFAULT_SPEC, spec);
        if ((s.strokes && s.strokes.length) || s.illum !== "plane") return null;
        const lz = lambda * z,
            k2 = 1 / (lz * lz);
        switch (s.shape) {
            case "slit":
            case "rect": {
                const A = s.a * s.b;
                return (x, y) => k2 * Math.pow(A * sinc(s.a * x / lz) * sinc(s.b * y / lz), 2);
            }
            case "circle":
            case "annulus": {
                const R = s.a / 2,
                    eps = s.shape === "annulus" ? s.eps : 0;
                const A = Math.PI * R * R;
                return (x, y) => {
                    const v = TWO_PI * R * Math.hypot(x, y) / lz;
                    const u = A * (jinc(v) - eps * eps * jinc(eps * v));
                    return k2 * u * u;
                };
            }
            case "doubleSlit": {
                const A = s.a * s.b;
                return (x, y) => k2 * Math.pow(2 * A * sinc(s.a * x / lz) * sinc(s.b * y / lz) * Math.cos(Math.PI * s.d * x / lz), 2);
            }
            default:
                return null;
        }
    }


    function onAxisCircle(lambda, z, a) {
        const R = Math.hypot(z, a),
            q = z / R;

        const dphi = TWO_PI / lambda * (a * a / (R + z));
        const re = 1 - q * Math.cos(dphi),
            im = -q * Math.sin(dphi);
        return {
            aperture: re * re + im * im,
            disk: q * q
        };
    }



    function samplingInfo(spec, grid, params) {
        const p = Object.assign({
            method: "asm",
            pad: 2,
            bandLimit: true
        }, params);
        const {
            lambda,
            z
        } = p;
        const N = grid.N,
            dx = grid.dx,
            L = grid.L;
        const Np = N * p.pad,
            Lp = Np * dx;
        const a = apertureHalfWidth(spec);
        const NF = Number.isFinite(a) && z > 0 ? a * a / (lambda * z) : NaN;
        const zc = criticalDistance(Lp, dx, lambda);
        const direct = p.method === "fresnel" || p.method === "fraunhofer";
        const outDx = direct && z > 0 ? lambda * z / (Np * dx) : dx;
        const outL = direct ? outDx * Np : L;
        const fMax = 1 / (2 * dx);
        let bandLimit = Infinity;
        if (p.bandLimit && z > 0) {
            if (p.method === "asm") bandLimit = asmBandLimit(lambda, z, Lp);
            if (p.method === "tf") bandLimit = Lp / (2 * lambda * z);
        }
        const bandFraction = Math.min(1, bandLimit / Math.min(fMax, p.method === "asm" ? 1 / lambda : Infinity));
        const feat = smallestFeature(spec);
        const pxPerFeature = feat / dx;



        const featR = Number.isFinite(feat) ? feat : (Number.isFinite(a) ? a : L);
        const rho = (Number.isFinite(a) ? a : L / 2) + Math.min(outL / 2, Math.max(L / 2, 5 * lambda * z / featR));
        const paraxialAngle = z > 0 ? Math.atan(rho / z) : Math.PI / 2;
        const warnings = [];
        const fmt = (v, u) => core.formatSI(v, u);
        if (Number.isFinite(pxPerFeature) && pxPerFeature < 4) warnings.push({
            level: "warn",
            text: "Smallest aperture feature spans only " + pxPerFeature.toFixed(1) + " samples (want ≥ 4): refine the grid (larger N or smaller extent)."
        });
        if (!(a < L / 2) && Number.isFinite(a) && spec.shape !== "disk" && spec.shape !== "edge") warnings.push({
            level: "warn",
            text: "The aperture does not fit inside the window (half-width " + fmt(a, "m") + " vs " + fmt(L / 2, "m") + ")."
        });
        if (p.method === "tf" && z > zc) warnings.push({
            level: "warn",
            text: "Fresnel TF undersamples its chirp: z = " + fmt(z, "m") + " > zc = LpΔx/λ = " + fmt(zc, "m") + (p.bandLimit ? ". The band limit suppresses aliasing but discards high angles." : ". Use IR, single-FFT Fresnel or enable the band limit.")
        });
        if ((p.method === "ir" || p.method === "fresnel") && z > 0 && z < zc) warnings.push({
            level: "warn",
            text: (p.method === "ir" ? "Fresnel IR" : "Single-FFT Fresnel") + " undersamples its chirp: z = " + fmt(z, "m") + " < zc = LpΔx/λ = " + fmt(zc, "m") + ". Use ASM or TF at this distance."
        });
        if (p.method === "asm" && z > zc && !p.bandLimit) warnings.push({
            level: "warn",
            text: "ASM transfer function is aliased for z > zc = " + fmt(zc, "m") + " without a band limit: enable band limiting or add padding."
        });
        if (p.method === "fraunhofer" && NF > 0.1) warnings.push({
            level: "warn",
            text: "Fresnel number N_F = a²/(λz) = " + NF.toFixed(2) + " is not ≪ 1: the Fraunhofer result is not the physical pattern at this distance."
        });
        if (p.method !== "asm" && paraxialAngle > 0.14) warnings.push({
            level: "warn",
            text: "Rays reach θ ≈ " + (paraxialAngle * 180 / Math.PI).toFixed(1) + "° from the axis: the paraxial (Fresnel/Fraunhofer) approximation sinθ ≈ tanθ = ρ/z (spatial frequency ≈ x/(λz)) is off by about 1 % or more. Use the angular-spectrum method."
        });
        if (!direct && z > 0 && Number.isFinite(a)) {

            const spread = a + z * Math.tan(Math.asin(Math.min(0.99, lambda / Math.max(feat || a, lambda))));
            if (spread > Lp / 2) warnings.push({
                level: "info",
                text: "Diffracted light spreads to ≈ ±" + fmt(spread, "m") + " but the padded window is ±" + fmt(Lp / 2, "m") + ": periodic copies overlap (watch the edge-power readout)."
            });
        }
        if (dx < lambda / 2) warnings.push({
            level: "info",
            text: "Δx < λ/2: the grid resolves evanescent spatial frequencies (f > 1/λ)."
        });
        return {
            dx,
            L,
            N,
            Np,
            Lp,
            NF,
            a,
            zc,
            outDx,
            outL,
            fMax,
            bandLimit,
            bandFraction,
            pxPerFeature,
            resolvesEvanescent: dx < lambda / 2,
            paraxialAngle,
            warnings
        };
    }


    function extractView(res, opts = {}) {
        const {
            off,
            size
        } = opts.full ? {
            off: 0,
            size: res.n
        } : res.crop;
        const n = res.n,
            I = new Float64Array(size * size),
            P = new Float64Array(size * size);
        let max = 0;
        for (let iy = 0; iy < size; iy++)
            for (let ix = 0; ix < size; ix++) {
                const k = (iy + off) * n + ix + off;
                const v = res.re[k] * res.re[k] + res.im[k] * res.im[k];
                I[iy * size + ix] = v;
                if (v > max) max = v;
            }
        const thr = (opts.maskRel == null ? 1e-3 : opts.maskRel) * max;
        for (let iy = 0; iy < size; iy++)
            for (let ix = 0; ix < size; ix++) {
                const k = (iy + off) * n + ix + off;
                P[iy * size + ix] = I[iy * size + ix] > thr ? Math.atan2(res.im[k], res.re[k]) : NaN;
            }
        return {
            I,
            P,
            size,
            dx: res.dx,
            max
        };
    }

    return {
        METHODS,
        SHAPES,
        DEFAULT_SPEC,
        createGrid,
        shapeFn,
        buildAperture,
        applyStroke,
        apertureHalfWidth,
        smallestFeature,
        power,
        propagate,
        criticalDistance,
        asmBandLimit,
        fraunhoferAnalytic,
        onAxisCircle,
        samplingInfo,
        extractView,
        sinc,
        jinc
    };
});