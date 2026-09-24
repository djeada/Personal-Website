(function(root, factory) {
    const node = typeof require === "function" && typeof module === "object";
    const core = node ? require("./core.js") : root.OpticsModels.core;
    const prop = node ? require("./propagation.js") : root.OpticsModels.propagation;
    const fo = node ? require("./fourierOptics.js") : root.OpticsModels.fourierOptics;
    const m = factory(core, prop, fo);
    if (typeof module === "object" && module.exports) module.exports = m;
    else {
        root.OpticsModels = root.OpticsModels || {};
        root.OpticsModels.holography = m;
    }
})(typeof self !== "undefined" ? self : this, function(core, prop, fo) {
    "use strict";

    const TAU = 2 * Math.PI;
    const OBJECTS = ["letters", "points", "phase"];
    const METHODS = ["filter", "direct", "ps4", "intensity", "gs"];

    const DEFAULTS = Object.freeze({
        N: 256,
        dx: 5e-6,
        lambda: 633e-9,
        z: 12e-3,
        object: "letters",
        NAo: 0.012,
        phi: 1.5,
        text: "HOLO",
        geometry: "offaxis",
        theta: 2.6 * Math.PI / 180,
        azimuth: 0,
        beta: 4,
        psi: 0,
        fill: 1,
        bits: 0,
        method: "filter",
        rw: 1,
        zr: null,
        psError: 0,
        gsPlane: "fresnel",
        gsSeed: 7,
        gsStart: "flat"
    });


    function makeGrid(N, dx) {
        if (!core.isPow2(N) || N < 16) throw new RangeError("N must be a power of two ≥ 16");
        if (!(dx > 0)) throw new RangeError("pixel pitch must be > 0");
        const L = N * dx;
        const pg = prop.createGrid(N, L);
        return {
            N,
            dx,
            L,
            df: 1 / L,
            fN: 1 / (2 * dx),
            x: pg.x,
            f: core.fftFreq(N, dx),
            prop: pg
        };
    }
    const cplx = (n) => ({
        re: new Float64Array(n),
        im: new Float64Array(n)
    });
    const copy = (u) => ({
        re: Float64Array.from(u.re),
        im: Float64Array.from(u.im)
    });

    function fft2(u, N, inverse = false) {
        const v = copy(u);
        core.fft2(v.re, v.im, N, N, inverse);
        return v;
    }
    const wrap = (k, N) => ((k % N) + N) % N;

    const signedBin = (k, N) => {
        const w = wrap(k, N);
        return w >= N / 2 ? w - N : w;
    };
    const sinc = (u) => (Math.abs(u) < 1e-9 ? 1 : Math.sin(Math.PI * u) / (Math.PI * u));

    const pixelMTF = (fx, fy, a) => (a > 0 ? sinc(fx * a) * sinc(fy * a) : 1);


    function lowpass(u, grid, radius) {
        const {
            N,
            f
        } = grid, s = fft2(u, N), r2 = radius * radius;
        for (let iy = 0; iy < N; iy++)
            for (let ix = 0; ix < N; ix++) {
                if (f[ix] * f[ix] + f[iy] * f[iy] > r2) {
                    const k = iy * N + ix;
                    s.re[k] = 0;
                    s.im[k] = 0;
                }
            }
        core.fft2(s.re, s.im, N, N, true);
        return s;
    }


    function propagateField(u, grid, lambda, z) {
        if (z === 0) return copy(u);
        const back = z < 0;
        const src = back ? {
            re: u.re,
            im: u.im.map((v) => -v)
        } : u;
        const r = prop.propagate(src, grid.prop, {
            lambda,
            z: Math.abs(z),
            method: "asm",
            pad: 1,
            bandLimit: false,
            evanescent: "drop"
        });
        const out = {
            re: r.re,
            im: r.im
        };
        if (back)
            for (let i = 0; i < out.im.length; i++) out.im[i] = -out.im[i];
        return out;
    }



    function makeObject(grid, params) {
        const p = Object.assign({}, DEFAULTS, params);
        const {
            N,
            L
        } = grid;
        const B = p.NAo / p.lambda;
        const fg = fo.makeGrid(N, L);
        let raw, info, halfSize, support = null;
        if (p.object === "letters") {
            const text = String(p.text || "HOLO").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6) || "HOLO";

            const s = 0.6 * L / (6 * text.length - 1);
            const o = fo.makeObject(fg, {
                type: "letters",
                text,
                nu: 1 / (2 * s)
            });
            raw = {
                re: o.re,
                im: o.im
            };
            halfSize = 0.3 * L;
            info = "amplitude letters \"" + text + "\" (transmitting strokes on an opaque mask), stroke " + core.formatSI(s, "m");
        } else if (p.object === "points") {

            const pts = [{
                    x: -0.18,
                    y: 0.12,
                    a: 1,
                    ph: 0
                }, {
                    x: 0.15,
                    y: 0.2,
                    a: 0.8,
                    ph: 1.2
                },
                {
                    x: 0.05,
                    y: -0.16,
                    a: 0.9,
                    ph: -2.1
                }, {
                    x: -0.22,
                    y: -0.2,
                    a: 0.6,
                    ph: 2.6
                }, {
                    x: 0.24,
                    y: -0.04,
                    a: 0.7,
                    ph: 0.6
                }
            ].map((q) => ({
                x: q.x * L,
                y: q.y * L,
                a: q.a,
                ph: q.ph
            }));
            const s = cplx(N * N),
                f = grid.f;
            for (let iy = 0; iy < N; iy++)
                for (let ix = 0; ix < N; ix++) {
                    if (f[ix] * f[ix] + f[iy] * f[iy] > B * B) continue;
                    const k = iy * N + ix;
                    for (const q of pts) {

                        const ph = q.ph - TAU * (f[ix] * (q.x + L / 2) + f[iy] * (q.y + L / 2));
                        s.re[k] += q.a * Math.cos(ph);
                        s.im[k] += q.a * Math.sin(ph);
                    }
                }
            core.fft2(s.re, s.im, N, N, true);
            let mx = 0;
            for (let k = 0; k < N * N; k++) mx = Math.max(mx, Math.hypot(s.re[k], s.im[k]));
            for (let k = 0; k < N * N; k++) {
                s.re[k] /= mx;
                s.im[k] /= mx;
            }
            raw = s;
            halfSize = 0.25 * L;
            info = "5 point scatterers with different amplitudes and phases (band-limited to Airy-like spots)";
            return {
                re: s.re,
                im: s.im,
                raw: s,
                B,
                support,
                halfSize,
                info,
                points: pts
            };
        } else if (p.object === "phase") {
            const o = fo.makeObject(fg, {
                type: "phase",
                phi: p.phi
            });
            const R = 0.34 * L;
            support = new Float64Array(N * N);
            const S = 4,
                dx = grid.dx,
                x = grid.x;
            for (let iy = 0; iy < N; iy++)
                for (let ix = 0; ix < N; ix++) {
                    let acc = 0;
                    for (let sy = 0; sy < S; sy++)
                        for (let sx = 0; sx < S; sx++) {
                            const X = x[ix] + ((sx + 0.5) / S - 0.5) * dx,
                                Y = x[iy] + ((sy + 0.5) / S - 0.5) * dx;
                            if (X * X + Y * Y <= R * R) acc++;
                        }
                    support[iy * N + ix] = acc / (S * S);
                }
            raw = {
                re: o.re.map((v, k) => v * support[k]),
                im: o.im.map((v, k) => v * support[k])
            };
            halfSize = R;
            info = "pure phase object (|t| = 1, steps of φ = " + p.phi.toFixed(2) + " rad) inside a " + core.formatSI(2 * R, "m") + " illuminated disc";
        } else {
            throw new RangeError("unknown object " + p.object);
        }
        const bl = lowpass(raw, grid, B);
        return {
            re: bl.re,
            im: bl.im,
            raw,
            B,
            support,
            halfSize,
            info
        };
    }



    function carrier(grid, lambda, theta, azimuth = 0) {
        const s = Math.sin(Math.abs(theta));
        const fr = s / lambda;
        const cx = Math.round(fr * Math.cos(azimuth) / grid.df),
            cy = Math.round(fr * Math.sin(azimuth) / grid.df);
        const fx = cx * grid.df,
            fy = cy * grid.df,
            fcAbs = Math.hypot(fx, fy);
        const sinTheta = Math.min(1, lambda * fcAbs);
        return {
            c: [cx, cy],
            fc: [fx, fy],
            fcAbs,
            sinTheta,
            theta: Math.asin(sinTheta),
            requested: theta
        };
    }


    function orderLayout(grid, lambda, car, B) {
        const {
            N,
            df,
            dx,
            fN
        } = grid;
        const [cx, cy] = car.c;
        const ax = signedBin(cx, N),
            ay = signedBin(cy, N);
        const aliased = Math.abs(cx) >= N / 2 || Math.abs(cy) >= N / 2;
        const pdist = (bx, by) => {
            const wx = Math.abs(signedBin(bx, N)),
                wy = Math.abs(signedBin(by, N));
            return Math.hypot(wx, wy) * df;
        };
        const dDC = pdist(ax, ay),
            dTwin = pdist(2 * ax, 2 * ay);
        const inline = cx === 0 && cy === 0;
        const overlapDC = dDC < 3 * B - 1e-12 * B;
        const overlapTwin = dTwin < 2 * B - 1e-12 * B;

        const periodPx = car.fcAbs > 0 ? 1 / (car.fcAbs * dx) : Infinity;
        const periodPxAxis = Math.min(cx ? N / Math.abs(cx) : Infinity, cy ? N / Math.abs(cy) : Infinity);

        const ux = car.fcAbs > 0 ? Math.abs(car.fc[0]) / car.fcAbs : 1,
            uy = car.fcAbs > 0 ? Math.abs(car.fc[1]) / car.fcAbs : 0;
        const umax = Math.max(ux, uy, 1e-12);
        const fNyqDir = fN / umax;
        const fCleanDir = (fN - B) / umax;
        const asinL = (f) => (lambda * f <= 1 ? Math.asin(lambda * f) : NaN);
        return {
            inline,
            aliased,
            alias: [ax * df, ay * df],
            aliasBins: [ax, ay],
            plus: [ax * df, ay * df],
            minus: [-ax * df, -ay * df],
            dcRadius: 2 * B,
            orderRadius: B,
            dDC,
            dTwin,
            overlapDC: !inline && overlapDC,
            overlapTwin: !inline && overlapTwin,
            overlap: inline || overlapDC || overlapTwin,
            periodPx,
            periodPxAxis,
            fringePeriod: car.fcAbs > 0 ? 1 / car.fcAbs : Infinity,
            thetaSep: asinL(3 * B),
            thetaNyquist: asinL(fNyqDir),
            thetaClean: asinL(fCleanDir),
            thetaNyquistX: asinL(fN),
            fNyqDir,
            fCleanDir,
            separable: 3 * B <= fCleanDir
        };
    }


    function referenceField(grid, ref) {
        const {
            N
        } = grid, [cx, cy] = ref.c, R = cplx(N * N);
        for (let iy = 0; iy < N; iy++)
            for (let ix = 0; ix < N; ix++) {
                const ph = ref.psi - TAU * (cx * ix + cy * iy) / N,
                    k = iy * N + ix;
                R.re[k] = ref.A * Math.cos(ph);
                R.im[k] = ref.A * Math.sin(ph);
            }
        return R;
    }


    function quantize(H, bits, Hs) {
        if (!(bits > 0)) return Float64Array.from(H);
        const levels = Math.pow(2, bits) - 1,
            q = new Float64Array(H.length);
        for (let i = 0; i < H.length; i++) q[i] = Math.round(Math.min(Math.max(H[i] / Hs, 0), 1) * levels) * Hs / levels;
        return q;
    }


    function objectSpectra(O, grid) {
        const N = grid.N,
            n = N * N;
        const I = cplx(n);
        for (let k = 0; k < n; k++) I.re[k] = O.re[k] * O.re[k] + O.im[k] * O.im[k];
        const S2 = fft2(I, N),
            Oh = fft2(O, N);
        let mx = 0;
        for (let k = 0; k < n; k++) mx = Math.max(mx, Oh.re[k] * Oh.re[k] + Oh.im[k] * Oh.im[k]);
        const list = [];
        for (let k = 0; k < n; k++)
            if (Oh.re[k] * Oh.re[k] + Oh.im[k] * Oh.im[k] > 1e-26 * mx) list.push(k);
        return {
            Oh,
            S2,
            band: Int32Array.from(list),
            pixCache: new Map()
        };
    }


    function record(O, grid, ref, opts = {}) {
        const {
            N,
            f,
            df
        } = grid, n = N * N;
        const fill = opts.fill || 0,
            a = fill * grid.dx;
        const sp = opts.spectra || objectSpectra(O, grid);
        const [cx, cy] = ref.c, A = ref.A || 0;

        let S2p = sp.pixCache.get(fill);
        if (!S2p) {
            S2p = copy(sp.S2);
            if (a > 0)
                for (let iy = 0; iy < N; iy++)
                    for (let ix = 0; ix < N; ix++) {
                        const m = pixelMTF(f[ix], f[iy], a),
                            k = iy * N + ix;
                        S2p.re[k] *= m;
                        S2p.im[k] *= m;
                    }
            sp.pixCache.set(fill, S2p);
        }
        const S = copy(S2p);
        if (A > 0) {
            S.re[0] += A * A * n;
            const cr = A * Math.cos(-ref.psi),
                ci = A * Math.sin(-ref.psi),
                Oh = sp.Oh;

            for (let q = 0; q < sp.band.length; q++) {
                const k = sp.band[q],
                    kx = k % N,
                    ky = (k - kx) / N;
                const orr = Oh.re[k],
                    oii = Oh.im[k];
                const m = pixelMTF(f[kx] + cx * df, f[ky] + cy * df, a);
                const tr = m * (orr * cr - oii * ci),
                    ti = m * (orr * ci + oii * cr);
                const j = wrap(ky + cy, N) * N + wrap(kx + cx, N);
                S.re[j] += tr;
                S.im[j] += ti;

                const jm = wrap(-(ky + cy), N) * N + wrap(-(kx + cx), N);
                S.re[jm] += tr;
                S.im[jm] -= ti;
            }
        }
        core.fft2(S.re, S.im, N, N, true);
        return S.re;
    }



    function windowField(u, grid, r) {
        if (!Number.isFinite(r)) return copy(u);
        return lowpass(u, grid, r);
    }


    function illuminate(H, grid, ref) {
        const R = referenceField(grid, ref),
            A2 = ref.A * ref.A,
            n = H.length,
            U = cplx(n);
        for (let k = 0; k < n; k++) {
            const h = (H[k] - A2) / A2;
            U.re[k] = h * R.re[k];
            U.im[k] = h * R.im[k];
        }
        return U;
    }


    function phaseShift4(Hs, grid, ref) {
        const n = Hs[0].length,
            S = cplx(n);
        const w = [
            [1, 0],
            [0, 1],
            [-1, 0],
            [0, -1]
        ];
        for (let k = 0; k < 4; k++)
            for (let i = 0; i < n; i++) {
                S.re[i] += Hs[k][i] * w[k][0];
                S.im[i] += Hs[k][i] * w[k][1];
            }
        const R = referenceField(grid, ref),
            s = 1 / (4 * ref.A * ref.A),
            U = cplx(n);
        for (let i = 0; i < n; i++) {
            U.re[i] = s * (S.re[i] * R.re[i] - S.im[i] * R.im[i]);
            U.im[i] = s * (S.re[i] * R.im[i] + S.im[i] * R.re[i]);
        }
        return U;
    }


    function correlation(a, b) {
        let sr = 0,
            si = 0,
            na = 0,
            nb = 0;
        for (let i = 0; i < a.re.length; i++) {
            sr += a.re[i] * b.re[i] + a.im[i] * b.im[i];
            si += a.re[i] * b.im[i] - a.im[i] * b.re[i];
            na += a.re[i] * a.re[i] + a.im[i] * a.im[i];
            nb += b.re[i] * b.re[i] + b.im[i] * b.im[i];
        }
        const rho = na > 0 && nb > 0 ? Math.min(1, Math.hypot(sr, si) / Math.sqrt(na * nb)) : 0;
        return {
            rho,
            relErr: Math.sqrt(Math.max(0, 1 - rho * rho)),
            phase: Math.atan2(si, sr)
        };
    }

    function dephase(u, phi) {
        const c = Math.cos(phi),
            s = Math.sin(phi),
            out = cplx(u.re.length);
        for (let i = 0; i < u.re.length; i++) {
            out.re[i] = u.re[i] * c + u.im[i] * s;
            out.im[i] = u.im[i] * c - u.re[i] * s;
        }
        return out;
    }



    function angleSweep(O, grid, opts) {
        const {
            N,
            f,
            df
        } = grid;
        const {
            lambda,
            azimuth = 0,
            A,
            rw,
            fill = 0
        } = opts;
        const a = fill * grid.dx;
        const sp = opts.spectra || objectSpectra(O, grid);
        const S2 = sp.S2,
            Oh = sp.Oh;
        const win = [];
        for (let iy = 0; iy < N; iy++)
            for (let ix = 0; ix < N; ix++)
                if (f[ix] * f[ix] + f[iy] * f[iy] <= rw * rw) win.push([ix, iy]);
        let nt = 0;
        for (const [ix, iy] of win) {
            const k = iy * N + ix;
            nt += Oh.re[k] * Oh.re[k] + Oh.im[k] * Oh.im[k];
        }
        const thetas = opts.thetas,
            out = [];
        for (const th of thetas) {
            const car = carrier(grid, lambda, th, azimuth),
                [cx, cy] = car.c;
            let sr = 0,
                si = 0,
                nu = 0;
            for (const [ix, iy] of win) {
                const k = iy * N + ix;
                const j1 = wrap(iy + cy, N) * N + wrap(ix + cx, N);
                const m1 = pixelMTF(f[wrap(ix + cx, N)], f[wrap(iy + cy, N)], a);
                let ur = S2.re[j1] * m1 / A,
                    ui = S2.im[j1] * m1 / A;
                const m0 = pixelMTF(f[ix] + cx * df, f[iy] + cy * df, a);
                ur += Oh.re[k] * m0;
                ui += Oh.im[k] * m0;
                const kx2 = wrap(-ix - 2 * cx, N),
                    ky2 = wrap(-iy - 2 * cy, N),
                    j2 = ky2 * N + kx2;
                const m2 = pixelMTF(f[kx2] + cx * df, f[ky2] + cy * df, a);
                ur += Oh.re[j2] * m2;
                ui -= Oh.im[j2] * m2;
                sr += ur * Oh.re[k] + ui * Oh.im[k];
                si += ur * Oh.im[k] - ui * Oh.re[k];
                nu += ur * ur + ui * ui;
            }
            out.push(nu > 0 && nt > 0 ? Math.hypot(sr, si) / Math.sqrt(nu * nt) : 0);
        }
        return out;
    }



    function gsInit(opts) {
        const {
            grid,
            ampObj,
            ampMeas,
            plane = "fresnel",
            lambda,
            z,
            seed = 7,
            start = "random"
        } = opts;
        const N = grid.N,
            n = N * N,
            rng = core.createRng(seed),
            g = cplx(n);
        for (let i = 0; i < n; i++) {
            const ph = start === "flat" ? 0 : TAU * rng.uniform();
            g.re[i] = ampObj[i] * Math.cos(ph);
            g.im[i] = ampObj[i] * Math.sin(ph);
        }
        let nm = 0,
            no = 0;
        for (let i = 0; i < n; i++) {
            nm += ampMeas[i] * ampMeas[i];
            no += ampObj[i] * ampObj[i];
        }
        return {
            grid,
            ampObj,
            ampMeas,
            plane,
            lambda,
            z,
            g,
            iter: 0,
            errMeas: [],
            errObj: [],
            normMeas: Math.sqrt(nm),
            normObj: Math.sqrt(no),
            truthErr: []
        };
    }

    function gsForward(st, u) {
        const N = st.grid.N;
        if (st.plane === "fourier") {
            const v = fft2(u, N);
            for (let i = 0; i < v.re.length; i++) {
                v.re[i] /= N;
                v.im[i] /= N;
            }
            return v;
        }
        return propagateField(u, st.grid, st.lambda, st.z);
    }

    function gsBackward(st, u) {
        const N = st.grid.N;
        if (st.plane === "fourier") {
            const v = fft2(u, N, true);
            for (let i = 0; i < v.re.length; i++) {
                v.re[i] *= N;
                v.im[i] *= N;
            }
            return v;
        }
        return propagateField(u, st.grid, st.lambda, -st.z);
    }

    function gsStep(st, n = 1, truth = null) {
        const len = st.g.re.length;
        for (let it = 0; it < n; it++) {
            const G = gsForward(st, st.g);
            let e = 0;
            for (let i = 0; i < len; i++) {
                const mag = Math.hypot(G.re[i], G.im[i]),
                    d = mag - st.ampMeas[i];
                e += d * d;
                if (mag > 0) {
                    const s = st.ampMeas[i] / mag;
                    G.re[i] *= s;
                    G.im[i] *= s;
                } else {
                    G.re[i] = st.ampMeas[i];
                    G.im[i] = 0;
                }
            }
            st.errMeas.push(Math.sqrt(e) / st.normMeas);
            const g = gsBackward(st, G);
            let eo = 0;
            for (let i = 0; i < len; i++) {
                const mag = Math.hypot(g.re[i], g.im[i]),
                    d = mag - st.ampObj[i];
                eo += d * d;
                if (mag > 0) {
                    const s = st.ampObj[i] / mag;
                    g.re[i] *= s;
                    g.im[i] *= s;
                } else {
                    g.re[i] = st.ampObj[i];
                    g.im[i] = 0;
                }
            }
            st.errObj.push(Math.sqrt(eo) / st.normObj);
            st.g = g;
            st.iter++;
            if (truth) st.truthErr.push(correlation(g, truth).relErr);
        }
        return st;
    }


    function normalizeParams(params) {
        const p = Object.assign({}, DEFAULTS, params);
        if (!OBJECTS.includes(p.object)) throw new RangeError("unknown object " + p.object);
        if (!METHODS.includes(p.method)) throw new RangeError("unknown method " + p.method);
        if (p.zr == null || !Number.isFinite(p.zr)) p.zr = p.z;
        p.fill = Math.min(1, Math.max(0, p.fill));
        return p;
    }


    function prepare(params) {
        const p = normalizeParams(params);
        const grid = makeGrid(p.N, p.dx);
        const obj = makeObject(grid, p);
        const O = propagateField(obj, grid, p.lambda, p.z);
        let meanI = 0;
        for (let k = 0; k < O.re.length; k++) meanI += O.re[k] * O.re[k] + O.im[k] * O.im[k];
        meanI /= O.re.length;
        return {
            key: prepKey(p),
            grid,
            obj,
            O,
            meanI,
            spectra: objectSpectra(O, grid)
        };
    }
    const prepKey = (p) => [p.N, p.dx, p.lambda, p.z, p.object, p.NAo, p.phi, p.text].join("|");


    function fromSpectrumWindow(spec, grid, r) {
        const {
            N,
            f
        } = grid, s = copy(spec), r2 = r * r;
        if (Number.isFinite(r))
            for (let iy = 0; iy < N; iy++)
                for (let ix = 0; ix < N; ix++) {
                    if (f[ix] * f[ix] + f[iy] * f[iy] > r2) {
                        const k = iy * N + ix;
                        s.re[k] = 0;
                        s.im[k] = 0;
                    }
                }
        core.fft2(s.re, s.im, N, N, true);
        return s;
    }
    const maxOf = (H) => {
        let mx = 0;
        for (let i = 0; i < H.length; i++)
            if (H[i] > mx) mx = H[i];
        return mx;
    };


    function reconstructMethod(method, ctx) {
        const {
            p,
            grid,
            O,
            sp,
            ref,
            A,
            rw,
            recOpts,
            H
        } = ctx;
        if (method === "filter") return {
            sensor: windowField(illuminate(H, grid, ref), grid, rw),
            truth: fromSpectrumWindow(sp.Oh, grid, rw)
        };
        if (method === "direct") return {
            sensor: illuminate(H, grid, ref),
            truth: O
        };
        if (method === "ps4") {
            const raws = [];
            for (let k = 0; k < 4; k++) raws.push(record(O, grid, {
                A,
                psi: p.psi + k * Math.PI / 2 + k * p.psError,
                c: ref.c
            }, recOpts));
            const Hs = Math.max(...raws.map(maxOf));
            return {
                sensor: phaseShift4(raws.map((r) => quantize(r, p.bits, Hs)), grid, ref),
                truth: O
            };
        }
        if (method === "intensity") {
            const amp = cplx(O.re.length);
            for (let k = 0; k < amp.re.length; k++) amp.re[k] = Math.sqrt(Math.max(0, ctx.Iobj[k]));
            return {
                sensor: amp,
                truth: O
            };
        }
        if (method === "gabor") {
            const refIn = {
                A,
                psi: p.psi,
                c: [0, 0]
            };
            const Hin0 = record(O, grid, refIn, recOpts);
            return {
                sensor: illuminate(quantize(Hin0, p.bits, maxOf(Hin0)), grid, refIn),
                truth: O
            };
        }
        throw new RangeError("no direct reconstruction for method " + method);
    }


    function simulate(params, prep, opts = {}) {
        const o = Object.assign({
            table: true,
            sweep: true,
            objectPlane: true
        }, opts);
        const p = normalizeParams(params);
        if (!prep || prep.key !== prepKey(p)) prep = prepare(p);
        const {
            grid,
            obj,
            O,
            meanI
        } = prep, sp = prep.spectra;
        const N = grid.N,
            B = obj.B;
        const A = Math.sqrt(p.beta * meanI);
        const car = p.geometry === "inline" ? carrier(grid, p.lambda, 0, 0) : carrier(grid, p.lambda, p.theta, p.azimuth);
        const ref = {
            A,
            psi: p.psi,
            c: car.c
        };
        const layout = orderLayout(grid, p.lambda, car, B);
        const rw = p.rw * B;
        const recOpts = {
            fill: p.fill,
            spectra: sp
        };

        const H0 = record(O, grid, ref, recOpts);
        const Hs = maxOf(H0);
        const H = quantize(H0, p.bits, Hs);
        const I0 = record(O, grid, {
            A: 0,
            psi: 0,
            c: [0, 0]
        }, recOpts);
        const Iobj = quantize(I0, p.bits, maxOf(I0));

        const Hh = fft2({
            re: H,
            im: new Float64Array(N * N)
        }, N);
        const mag = new Float64Array(N * N);
        for (let k = 0; k < N * N; k++) mag[k] = Math.hypot(Hh.re[k], Hh.im[k]);
        const spectrum = core.fftshift2(mag, N, N);

        const ctx = {
            p,
            grid,
            O,
            sp,
            ref,
            A,
            rw,
            recOpts,
            H,
            Iobj
        };
        let recon = null;
        if (p.method !== "gs") {
            const m = reconstructMethod(p.method, ctx);
            const corr = correlation(m.sensor, m.truth);
            recon = {
                method: p.method,
                sensor: m.sensor,
                truth: m.truth,
                corr
            };
            if (o.objectPlane) {
                recon.object = dephase(propagateField(m.sensor, grid, p.lambda, -p.zr), corr.phase);
                recon.truthObject = propagateField(m.truth, grid, p.lambda, -p.zr);
            }
        }

        let table = null;
        if (o.table) {
            table = [];
            const ids = layout.inline ? ["filter", "direct", "ps4", "intensity"] : ["filter", "direct", "gabor", "ps4", "intensity"];
            const labels = {
                filter: layout.inline ? "In-line, low-pass |f| ≤ r_w (twin remains)" : "Off-axis, Fourier-filtered +1 order",
                direct: layout.inline ? "In-line (Gabor), single exposure" : "Off-axis, no filter (all orders)",
                gabor: "In-line (Gabor) single exposure, same object",
                ps4: "4-step phase shifting" + (layout.inline ? ", in-line" : ", off-axis"),
                intensity: "Intensity only, no reference (phase lost)"
            };
            for (const id of ids) {
                const m = recon && recon.method === id ? recon : reconstructMethod(id, ctx);
                const c = m.corr || correlation(m.sensor, m.truth);
                table.push({
                    id,
                    label: labels[id],
                    rho: c.rho,
                    relErr: c.relErr
                });
            }
        }

        let sweep = null;
        if (o.sweep) {
            const fMax = Math.max(2.2 * layout.fNyqDir, 4 * B);
            const tMax = Math.asin(Math.min(0.99, p.lambda * fMax));
            const thetas = Array.from({
                length: 161
            }, (_, i) => tMax * i / 160);
            sweep = {
                thetas,
                rho: angleSweep(O, grid, {
                    lambda: p.lambda,
                    azimuth: p.azimuth,
                    A,
                    rw,
                    fill: p.fill,
                    thetas,
                    spectra: sp
                })
            };
        }

        const warnings = [];
        const fmt = (v, u) => core.formatSI(v, u);
        const deg = (r) => (r * 180 / Math.PI).toFixed(2) + "°";
        if (layout.aliased) warnings.push("Reference fringe period " + layout.periodPx.toFixed(2) + " px is below the 2-pixel sampling limit (θ > θ_max = " + deg(layout.thetaNyquist) + "): the carrier aliases to f = (" + (layout.alias[0] * 1e-3).toFixed(1) + ", " + (layout.alias[1] * 1e-3).toFixed(1) + ") cycles/mm and pixel integration attenuates the fringes.");
        if (!layout.inline && layout.overlapDC) warnings.push("The +1 order overlaps the DC (|O|²) term: its distance from DC is " + (layout.dDC * 1e-3).toFixed(1) + " cycles/mm < 3B = " + (3 * B * 1e-3).toFixed(1) + " cycles/mm. The filtered reconstruction is contaminated.");
        if (!layout.inline && layout.overlapTwin) warnings.push("The +1 and −1 (twin) orders overlap: separation " + (layout.dTwin * 1e-3).toFixed(1) + " cycles/mm < 2B = " + (2 * B * 1e-3).toFixed(1) + " cycles/mm.");
        if (!layout.separable) warnings.push("No reference angle separates the orders on this sensor along this direction: 3B > f_N − B (B = " + (B * 1e-3).toFixed(1) + " cycles/mm, Nyquist " + (grid.fN * 1e-3).toFixed(1) + " cycles/mm). Reduce NA_o or the pixel pitch, or use the diagonal carrier.");
        if (2 * B > grid.fN) warnings.push("2B exceeds the Nyquist frequency: the |O|² term itself aliases.");
        const spread = obj.halfSize + p.z * Math.tan(Math.asin(Math.min(0.99, p.NAo)));
        if (spread > grid.L / 2) warnings.push("The object wave spreads to ±" + fmt(spread, "m") + " but the sensor is ±" + fmt(grid.L / 2, "m") + ": light leaving the sensor wraps around (periodic window).");
        const zMax = grid.L / (2 * p.lambda * B);
        if (p.z > zMax || Math.abs(p.zr) > zMax) warnings.push("|z| exceeds L/(2λB) = " + fmt(zMax, "m") + ": the angular-spectrum transfer function is undersampled for this object bandwidth.");

        return {
            params: p,
            prep,
            grid,
            obj,
            O,
            meanI,
            A,
            ref,
            car,
            layout,
            rw,
            H,
            Hs,
            Iobj,
            spectrum,
            recon,
            table,
            sweep,
            warnings,
            zMax,
            B
        };
    }


    function toObjectPlane(u, grid, lambda, zr) {
        return propagateField(u, grid, lambda, -zr);
    }


    function gsFromParams(params, prep) {
        const p = normalizeParams(params);
        if (!prep || prep.key !== prepKey(p)) prep = prepare(p);
        const {
            grid,
            obj,
            O
        } = prep, n = grid.N * grid.N;
        const ampObj = new Float64Array(n);
        for (let k = 0; k < n; k++) ampObj[k] = Math.hypot(obj.re[k], obj.im[k]);
        let ampMeas;
        if (p.gsPlane === "fourier") {
            const F = fft2(obj, grid.N);
            ampMeas = new Float64Array(n);
            for (let k = 0; k < n; k++) ampMeas[k] = Math.hypot(F.re[k], F.im[k]) / grid.N;
        } else {
            const I0 = record(O, grid, {
                A: 0,
                psi: 0,
                c: [0, 0]
            }, {
                fill: p.fill,
                spectra: prep.spectra
            });
            const I = quantize(I0, p.bits, maxOf(I0));
            ampMeas = I.map((v) => Math.sqrt(Math.max(0, v)));
        }
        return {
            prep,
            state: gsInit({
                grid,
                ampObj,
                ampMeas,
                plane: p.gsPlane,
                lambda: p.lambda,
                z: p.z,
                seed: p.gsSeed,
                start: p.gsStart
            })
        };
    }

    return {
        DEFAULTS,
        OBJECTS,
        METHODS,
        makeGrid,
        makeObject,
        lowpass,
        propagateField,
        carrier,
        orderLayout,
        referenceField,
        record,
        quantize,
        illuminate,
        windowField,
        phaseShift4,
        correlation,
        dephase,
        angleSweep,
        gsInit,
        gsStep,
        gsFromParams,
        prepare,
        simulate,
        toObjectPlane,
        objectSpectra,
        reconstructMethod,
        pixelMTF,
        sinc,
        signedBin
    };
});