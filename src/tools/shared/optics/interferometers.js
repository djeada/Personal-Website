(function(root, factory) {
    const m = factory();
    if (typeof module === "object" && module.exports) module.exports = m;
    else {
        root.OpticsModels = root.OpticsModels || {};
        root.OpticsModels.interferometers = m;
    }
})(typeof self !== "undefined" ? self : this, function() {
    "use strict";

    const core = (typeof require === "function" && typeof module === "object") ? require("./core.js") : self.OpticsModels.core;
    const C = core.complex;
    const cx = C.cx;
    const c0 = core.constants.c;
    const TWO_PI = 2 * Math.PI;
    const LN2 = Math.LN2;

    const SODIUM = Object.freeze({
        D2: 589.1583e-9,
        D1: 589.7558e-9
    });

    const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

    function sinc(u) {
        if (Math.abs(u) < 1e-6) return 1 - u * u / 6;
        return Math.sin(u) / u;
    }


    const jv = (x, y) => [x, y];
    const jscale = (v, z) => [C.mul(v[0], z), C.mul(v[1], z)];
    const jadd = (a, b) => [C.add(a[0], b[0]), C.add(a[1], b[1])];
    const jnorm2 = (v) => v[0].re * v[0].re + v[0].im * v[0].im + v[1].re * v[1].re + v[1].im * v[1].im;

    const jdot = (a, b) => C.add(C.mul(C.conj(a[0]), b[0]), C.mul(C.conj(a[1]), b[1]));



    function beamSplitter(R) {
        R = clamp(R, 0, 1);
        const r = Math.sqrt(R),
            t = Math.sqrt(1 - R);
        return {
            R,
            T: 1 - R,
            r,
            t,
            S: [
                [cx(t, 0), cx(0, r)],
                [cx(0, r), cx(t, 0)]
            ]
        };
    }

    const DEFAULT_CFG = Object.freeze({
        type: "michelson",
        L1: 0.1,
        L2: 0.1,
        d: 0,
        R1: 0.5,
        R2: 0.5,
        eta1: 1,
        eta2: 1,
        phi: 0,
        psi: 0,
        thetaS: 0
    });

    function normalizeConfig(cfg) {
        const c = Object.assign({}, DEFAULT_CFG, cfg || {});
        c.type = c.type === "mz" ? "mz" : "michelson";
        c.R1 = clamp(+c.R1, 0, 1);
        c.R2 = clamp(+c.R2, 0, 1);
        c.eta1 = clamp(+c.eta1, 0, 1);
        c.eta2 = clamp(+c.eta2, 0, 1);
        c.thetaS = clamp(+c.thetaS || 0, 0, Math.PI / 2);
        return c;
    }


    function opticalPaths(cfg) {
        const c = normalizeConfig(cfg);
        const opl1 = c.type === "mz" ? c.L1 : 2 * c.L1;
        const opl2 = c.type === "mz" ? c.L2 + 2 * c.d : 2 * (c.L2 + c.d);
        return {
            opl1,
            opl2,
            opd: opl2 - opl1
        };
    }


    function armCoefficients(cfg) {
        const c = normalizeConfig(cfg);
        const mirror = cx(-1, 0);
        const pol1 = jv(cx(1), cx(0));
        const pol2 = jv(cx(Math.cos(c.psi)), cx(Math.sin(c.psi)));
        const arm1 = C.scale(mirror, Math.sqrt(c.eta1));
        const arm2 = C.mul(C.scale(mirror, Math.sqrt(c.eta2)), C.expi(c.phi));
        const B1 = beamSplitter(c.R1).S;
        let k;
        if (c.type === "michelson") {



            const e1 = C.mul(B1[0][0], arm1),
                e2 = C.mul(B1[1][0], arm2);
            k = [
                [C.mul(B1[1][0], e1), C.mul(B1[1][1], e2)],
                [C.mul(B1[0][0], e1), C.mul(B1[0][1], e2)]
            ];
        } else {
            const B2 = beamSplitter(c.R2).S;
            const a1 = C.mul(B1[0][0], arm1),
                a2 = C.mul(B1[1][0], arm2);
            k = [
                [C.mul(B2[0][0], a1), C.mul(B2[0][1], a2)],
                [C.mul(B2[1][0], a1), C.mul(B2[1][1], a2)]
            ];
        }
        const coef = k.map((row) => [jscale(pol1, row[0]), jscale(pol2, row[1])]);
        return {
            cfg: c,
            coef,
            paths: opticalPaths(c)
        };
    }


    function monochromatic(cfg, lambda, opts = {}) {
        const A = opts.coefficients || armCoefficients(cfg);
        const nu = opts.nu || c0 / lambda;
        const k = TWO_PI * nu / c0;
        const opd = opts.opd != null ? opts.opd : A.paths.opd;
        const opl1 = A.paths.opl1;
        const ph1 = C.expi(k * opl1),
            ph2 = C.expi(k * (opl1 + opd));
        const contributions = A.coef.map((row) => [jscale(row[0], ph1), jscale(row[1], ph2)]);
        const fields = contributions.map((row) => jadd(row[0], row[1]));
        const P = fields.map(jnorm2);
        return {
            fields,
            contributions,
            P,
            total: P[0] + P[1],
            opd,
            k
        };
    }


    function portTerms(A) {
        return A.coef.map((row) => ({
            A: jnorm2(row[0]) + jnorm2(row[1]),
            X: jdot(row[0], row[1])
        }));
    }



    function spectrum(opts = {}) {
        const kind = ["mono", "gauss", "lorentz", "rect", "sodium"].includes(opts.kind) ? opts.kind : "gauss";
        const lambda0 = kind === "sodium" ? 2 / (1 / SODIUM.D2 + 1 / SODIUM.D1) * 1 : (opts.lambda0 || 632.8e-9);
        const nu0 = c0 / lambda0;
        const dLambda = Math.max(0, opts.dLambda || 0);
        const tauMax = Math.max(0, opts.tauMax || 0);
        const maxSamples = opts.maxSamples || 16384;
        const lines = [];
        if (kind === "mono" || dLambda === 0) {
            lines.push({
                nu0,
                weight: 1,
                dNu: 0,
                shape: "mono"
            });
        } else if (kind === "sodium") {
            const ratio = opts.ratio != null ? Math.max(0, opts.ratio) : 2;
            const w2 = ratio / (1 + ratio),
                w1 = 1 / (1 + ratio);
            const nuD2 = c0 / SODIUM.D2,
                nuD1 = c0 / SODIUM.D1;
            lines.push({
                nu0: nuD2,
                weight: w2,
                dNu: c0 * dLambda / (SODIUM.D2 * SODIUM.D2),
                shape: "gauss",
                name: "D2"
            });
            lines.push({
                nu0: nuD1,
                weight: w1,
                dNu: c0 * dLambda / (SODIUM.D1 * SODIUM.D1),
                shape: "gauss",
                name: "D1"
            });
        } else {
            lines.push({
                nu0,
                weight: 1,
                dNu: c0 * dLambda / (lambda0 * lambda0),
                shape: kind
            });
        }
        const nuArr = [],
            wArr = [],
            binArr = [];
        let truncated = 0,
            revivalOPD = Infinity,
            N = 0;
        for (const ln of lines) {
            if (ln.weight <= 0) continue;
            if (ln.shape === "mono") {
                nuArr.push(ln.nu0);
                wArr.push(ln.weight);
                binArr.push(0);
                N++;
                continue;
            }
            let half, nShape, dens;
            if (ln.shape === "gauss") {
                half = 3 * ln.dNu;
                nShape = 481;
                dens = (x) => Math.exp(-4 * LN2 * x * x / (ln.dNu * ln.dNu));
            } else if (ln.shape === "lorentz") {
                half = 100 * ln.dNu;
                nShape = 4001;
                dens = (x) => 1 / (1 + 4 * x * x / (ln.dNu * ln.dNu));
                truncated += ln.weight * (1 - 2 / Math.PI * Math.atan(2 * half / ln.dNu));
            } else {
                half = ln.dNu / 2;
                nShape = 256;
                dens = () => 1;
            }

            let n = Math.max(nShape, Math.ceil(1.5 * 2 * half * tauMax));
            n = Math.min(n, maxSamples);
            if (ln.shape !== "rect" && n % 2 === 0) n += 1;
            const delta = 2 * half / (ln.shape === "rect" ? n : n - 1);
            const start = ln.shape === "rect" ? ln.nu0 - half + delta / 2 : ln.nu0 - half;
            let s = 0;
            const ws = new Float64Array(n);
            for (let i = 0; i < n; i++) {
                ws[i] = dens(start + i * delta - ln.nu0);
                s += ws[i];
            }
            for (let i = 0; i < n; i++) {
                nuArr.push(start + i * delta);
                wArr.push(ln.weight * ws[i] / s);
                binArr.push(delta);
            }
            N += n;
            revivalOPD = Math.min(revivalOPD, c0 / delta);
        }
        const wsum = wArr.reduce((a, b) => a + b, 0) || 1;
        const w = Float64Array.from(wArr, (v) => v / wsum);
        const dNuTotal = lines[0].dNu;
        return {
            kind,
            lambda0,
            nu0,
            dLambda,
            dNu: dNuTotal,
            ratio: opts.ratio,
            lines,
            nu: Float64Array.from(nuArr),
            w,
            bin: Float64Array.from(binArr),
            N,
            truncated,
            revivalOPD
        };
    }


    function analyticDegree(spec, tau) {
        const g1 = (ln) => {
            if (ln.shape === "mono") return 1;
            if (ln.shape === "gauss") return Math.exp(-Math.pow(Math.PI * ln.dNu * tau, 2) / (4 * LN2));
            if (ln.shape === "lorentz") return Math.exp(-Math.PI * ln.dNu * Math.abs(tau));
            return Math.abs(sinc(Math.PI * ln.dNu * tau));
        };
        if (spec.lines.length === 1) return g1(spec.lines[0]);

        let re = 0,
            im = 0;
        for (const ln of spec.lines) {
            const a = ln.weight * g1(ln),
                ph = TWO_PI * (ln.nu0 - spec.lines[0].nu0) * tau;
            re += a * Math.cos(ph);
            im += a * Math.sin(ph);
        }
        return Math.hypot(re, im);
    }


    function coherence(spec, opd, opts = {}) {
        const ths = opts.thetaS || 0;
        const muS = Math.cos(ths);
        const nuRef = opts.carrier === false ? spec.nu0 : 0;
        let re = 0,
            im = 0;
        const nu = spec.nu,
            w = spec.w,
            bin = spec.bin;
        for (let i = 0; i < nu.length; i++) {
            const k = TWO_PI * nu[i] / c0;
            let amp = w[i];
            if (bin[i] > 0) amp *= sinc(Math.PI * bin[i] * opd / c0);
            let ph = TWO_PI * (nu[i] - nuRef) * opd / c0;
            if (ths > 0) {
                const u = k * opd * (1 - muS) / 2;
                amp *= sinc(u);
                ph -= u;
            }
            re += amp * Math.cos(ph);
            im += amp * Math.sin(ph);
        }
        return cx(re, im);
    }


    function spectrumFT(spec, taus) {
        return Float64Array.from(taus, (tau) => C.abs(coherence(spec, c0 * tau, {
            carrier: false
        })));
    }


    function detect(cfg, spec, opts = {}) {
        const A = opts.coefficients || armCoefficients(cfg);
        const terms = opts.terms || portTerms(A);
        const opd = opts.opd != null ? opts.opd : A.paths.opd;
        const ths = A.cfg.type === "michelson" ? (opts.thetaS != null ? opts.thetaS : A.cfg.thetaS) : 0;
        const muS = Math.cos(ths);
        const P = [0, 0];
        const nu = spec.nu,
            w = spec.w,
            bin = spec.bin;
        for (let i = 0; i < nu.length; i++) {
            const k = TWO_PI * nu[i] / c0;

            let f = 1,
                ph = k * opd;
            if (bin[i] > 0) f *= sinc(Math.PI * bin[i] * opd / c0);
            if (ths > 0) {
                const u = k * opd * (1 - muS) / 2;
                f *= sinc(u);
                ph -= u;
            }
            const cr = f * Math.cos(ph),
                ci = f * Math.sin(ph);
            for (let p = 0; p < 2; p++) {
                const X = terms[p].X;
                P[p] += w[i] * (terms[p].A + 2 * (X.re * cr - X.im * ci));
            }
        }
        return {
            P,
            total: P[0] + P[1],
            opd
        };
    }


    function measureVisibility(cfg, spec, port = 0, opts = {}) {
        const A = opts.coefficients || armCoefficients(cfg);
        const terms = portTerms(A);
        const M = opts.M || 16;
        const opd0 = opts.opd != null ? opts.opd : A.paths.opd;
        const step = spec.lambda0 / M;
        const I = new Float64Array(M);
        let mean = 0,
            fr = 0,
            fi = 0;
        for (let j = 0; j < M; j++) {
            I[j] = detect(null, spec, {
                coefficients: A,
                terms,
                opd: opd0 + (j - (M - 1) / 2) * step,
                thetaS: opts.thetaS
            }).P[port];
            mean += I[j] / M;
            fr += I[j] * Math.cos(TWO_PI * j / M) * 2 / M;
            fi += I[j] * Math.sin(TWO_PI * j / M) * 2 / M;
        }
        const amp = Math.hypot(fr, fi);
        mean = terms[port].A;
        const V = mean > 0 ? Math.min(1, amp / mean) : 0;
        return {
            V,
            Imax: mean + amp,
            Imin: Math.max(0, mean - amp),
            mean,
            samples: I
        };
    }


    function analyticContrast(cfg, port = 0) {
        const c = normalizeConfig(cfg);
        const pol = Math.abs(Math.cos(c.psi));
        const two = (a, b) => (a + b > 0 ? 2 * Math.sqrt(a * b) / (a + b) : 0);
        const R = c.R1,
            T = 1 - c.R1,
            R2 = c.R2,
            T2 = 1 - c.R2;
        let a, b;
        if (c.type === "michelson") {
            if (port === 0) {
                a = R * T * c.eta1;
                b = R * T * c.eta2;
            } else {
                a = T * T * c.eta1;
                b = R * R * c.eta2;
            }
        } else if (port === 0) {
            a = T * T2 * c.eta1;
            b = R * R2 * c.eta2;
        } else {
            a = T * R2 * c.eta1;
            b = R * T2 * c.eta2;
        }
        return two(a, b) * pol;
    }


    function sourceSizeFactor(lambda, opd, thetaS) {
        return Math.abs(sinc(TWO_PI / lambda * opd * (1 - Math.cos(thetaS)) / 2));
    }


    function coherenceLengths(spec) {
        const out = {
            halfVisibility: Infinity,
            mandel: Infinity,
            ruleOfThumb: Infinity,
            beatOPD: null
        };
        const ln = spec.lines[0];
        if (spec.kind === "sodium") out.beatOPD = c0 / Math.abs(spec.lines[0].nu0 - spec.lines[1].nu0);
        if (!ln || ln.shape === "mono" || !(ln.dNu > 0)) return out;
        out.ruleOfThumb = spec.lambda0 * spec.lambda0 / (spec.dLambda || (c0 * ln.dNu / (spec.nu0 * spec.nu0)));
        let s2 = 0;
        for (let i = 0; i < spec.w.length; i++)
            if (spec.bin[i] > 0) s2 += spec.w[i] * spec.w[i] / spec.bin[i];
        out.mandel = s2 > 0 ? c0 * s2 : Infinity;

        const single = spec.kind === "sodium" ? spectrum({
            kind: "gauss",
            lambda0: SODIUM.D2,
            dLambda: spec.dLambda,
            tauMax: 20 / ln.dNu
        }) : spec;
        const g = (x) => C.abs(coherence(single, x, {
            carrier: false
        })) - 0.5;
        const scale = c0 / ln.dNu;
        let a = 0,
            b = 0.02 * scale;
        while (g(b) > 0 && b < 50 * scale) {
            a = b;
            b *= 1.25;
        }
        if (g(b) <= 0) out.halfVisibility = core.brent(g, a, b, {
            tol: 1e-12 * scale
        });
        return out;
    }


    function detectorImage(cfg, spec, opts = {}) {
        const A = opts.coefficients || armCoefficients(cfg);
        const terms = portTerms(A);
        const port = opts.port || 0;
        const nx = opts.nx || 160,
            ny = opts.ny || nx;
        const mode = opts.mode === "tilted" ? "tilted" : "circular";
        const opd0 = opts.opd != null ? opts.opd : A.paths.opd;
        const data = new Float64Array(nx * ny);
        let x0, x1, y0, y1, unit;
        const opdAt = [];
        if (mode === "circular") {
            const fov = opts.fov || Math.max(A.cfg.thetaS, 1e-3);
            x0 = y0 = -fov;
            x1 = y1 = fov;
            unit = "rad";
        } else {
            const D = opts.beamDiameter || 10e-3;
            x0 = y0 = -D / 2;
            x1 = y1 = D / 2;
            unit = "m";
        }
        const tilt = opts.tilt || 0;
        const isMi = A.cfg.type === "michelson";
        let omin = Infinity,
            omax = -Infinity;
        for (let iy = 0; iy < ny; iy++) {
            const y = y0 + (iy + 0.5) / ny * (y1 - y0);
            for (let ix = 0; ix < nx; ix++) {
                const x = x0 + (ix + 0.5) / nx * (x1 - x0);
                let o;
                if (mode === "circular") {
                    const th = Math.hypot(x, y);
                    if (isMi && th > A.cfg.thetaS) {
                        o = NaN;
                    } else o = isMi ? opd0 * Math.cos(th) : opd0;
                } else o = opd0 + 2 * tilt * x;
                opdAt.push(o);
                if (Number.isFinite(o)) {
                    if (o < omin) omin = o;
                    if (o > omax) omax = o;
                }
            }
        }
        if (!Number.isFinite(omin)) {
            data.fill(NaN);
            return {
                data,
                nx,
                ny,
                extent: {
                    x0,
                    x1,
                    y0,
                    y1
                },
                unit,
                opdMin: NaN,
                opdMax: NaN,
                mode
            };
        }
        const NT = 512;
        const span = omax - omin;
        const env = [];
        for (let i = 0; i < NT; i++) env.push(coherence(spec, omin + (span > 0 ? i / (NT - 1) * span : 0), {
            carrier: false
        }));
        const k0 = TWO_PI * spec.nu0 / c0;
        const T = terms[port];
        for (let i = 0; i < opdAt.length; i++) {
            const o = opdAt[i];
            if (!Number.isFinite(o)) {
                data[i] = NaN;
                continue;
            }
            let g;
            if (span > 0) {
                const f = (o - omin) / span * (NT - 1),
                    j = Math.min(NT - 2, Math.floor(f)),
                    u = f - j;
                g = cx(env[j].re + u * (env[j + 1].re - env[j].re), env[j].im + u * (env[j + 1].im - env[j].im));
            } else g = env[0];
            const car = C.expi(k0 * o);
            const G = C.mul(g, car);
            data[i] = T.A + 2 * (T.X.re * G.re - T.X.im * G.im);
        }
        return {
            data,
            nx,
            ny,
            extent: {
                x0,
                x1,
                y0,
                y1
            },
            unit,
            opdMin: omin,
            opdMax: omax,
            mode
        };
    }


    function brightRingAngles(opd, lambda, count = 6) {
        const out = [];
        const D = Math.abs(opd);
        if (D === 0) return out;
        const mMax = Math.floor(D / lambda + 1e-12);
        for (let j = 0; j < count; j++) {
            const m = mMax - j;
            if (m <= 0) break;
            out.push(Math.acos(m * lambda / D));
        }
        return out;
    }

    return {
        SODIUM,
        DEFAULT_CFG,
        sinc,
        beamSplitter,
        normalizeConfig,
        opticalPaths,
        armCoefficients,
        portTerms,
        monochromatic,
        spectrum,
        analyticDegree,
        coherence,
        spectrumFT,
        detect,
        measureVisibility,
        analyticContrast,
        sourceSizeFactor,
        coherenceLengths,
        detectorImage,
        brightRingAngles,
        jones: {
            dot: jdot,
            norm2: jnorm2
        }
    };
});