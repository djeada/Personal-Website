(function(root, factory) {
    const m = factory(root);
    if (typeof module === "object" && module.exports) module.exports = m;
    else {
        root.OpticsModels = root.OpticsModels || {};
        root.OpticsModels.quantumOptics = m;
    }
})(typeof self !== "undefined" ? self : this, function(root) {
    "use strict";

    const core = (typeof require === "function" && typeof module === "object") ? require("./core.js") : root.OpticsModels.core;
    const logGamma = core.logGamma;
    const lnFact = (n) => logGamma(n + 1);



    function cmat(n) {
        return {
            n,
            re: new Float64Array(n * n),
            im: new Float64Array(n * n)
        };
    }


    function densityFromKet(ket) {
        const n = ket.re.length,
            M = cmat(n);
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {

                M.re[i * n + j] = ket.re[i] * ket.re[j] + ket.im[i] * ket.im[j];
                M.im[i * n + j] = ket.im[i] * ket.re[j] - ket.re[i] * ket.im[j];
            }
        }
        return M;
    }

    function diagonalDensity(p) {
        const n = p.length,
            M = cmat(n);
        for (let i = 0; i < n; i++) M.re[i * n + i] = p[i];
        return M;
    }

    function trace(M) {
        let re = 0,
            im = 0;
        for (let i = 0; i < M.n; i++) {
            re += M.re[i * M.n + i];
            im += M.im[i * M.n + i];
        }
        return {
            re,
            im
        };
    }

    function matMul(A, B) {
        const n = A.n,
            C = cmat(n);
        for (let i = 0; i < n; i++) {
            for (let k = 0; k < n; k++) {
                const ar = A.re[i * n + k],
                    ai = A.im[i * n + k];
                if (ar === 0 && ai === 0) continue;
                for (let j = 0; j < n; j++) {
                    const br = B.re[k * n + j],
                        bi = B.im[k * n + j];
                    C.re[i * n + j] += ar * br - ai * bi;
                    C.im[i * n + j] += ar * bi + ai * br;
                }
            }
        }
        return C;
    }

    function adjoint(A) {
        const n = A.n,
            B = cmat(n);
        for (let i = 0; i < n; i++)
            for (let j = 0; j < n; j++) {
                B.re[j * n + i] = A.re[i * n + j];
                B.im[j * n + i] = -A.im[i * n + j];
            }
        return B;
    }


    function hermiticityError(A) {
        const n = A.n;
        let e = 0;
        for (let i = 0; i < n; i++)
            for (let j = i; j < n; j++) {
                const dr = A.re[i * n + j] - A.re[j * n + i],
                    di = A.im[i * n + j] + A.im[j * n + i];
                e = Math.max(e, Math.hypot(dr, di));
            }
        return e;
    }


    function purity(A) {
        let s = 0;
        for (let k = 0; k < A.n * A.n; k++) s += A.re[k] * A.re[k] + A.im[k] * A.im[k];
        return s;
    }


    function eigvalsHermitian(A, opts = {}) {
        const n = A.n,
            m = 2 * n;
        const a = new Float64Array(m * m);
        for (let i = 0; i < n; i++)
            for (let j = 0; j < n; j++) {
                const r = 0.5 * (A.re[i * n + j] + A.re[j * n + i]),
                    im = 0.5 * (A.im[i * n + j] - A.im[j * n + i]);
                a[i * m + j] = r;
                a[(i + n) * m + (j + n)] = r;
                a[i * m + (j + n)] = -im;
                a[(i + n) * m + j] = im;
            }
        const maxSweeps = opts.maxSweeps || 60;
        for (let sweep = 0; sweep < maxSweeps; sweep++) {
            let off = 0,
                diag = 0;
            for (let i = 0; i < m; i++) {
                diag += a[i * m + i] * a[i * m + i];
                for (let j = i + 1; j < m; j++) off += a[i * m + j] * a[i * m + j];
            }
            if (off <= 1e-30 * Math.max(diag, 1e-300)) break;
            for (let p = 0; p < m - 1; p++) {
                for (let q = p + 1; q < m; q++) {
                    const apq = a[p * m + q];
                    if (Math.abs(apq) < 1e-300) continue;
                    const app = a[p * m + p],
                        aqq = a[q * m + q];
                    const theta = (aqq - app) / (2 * apq);
                    const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
                    const c = 1 / Math.sqrt(t * t + 1),
                        s = t * c;
                    for (let k = 0; k < m; k++) {
                        const akp = a[k * m + p],
                            akq = a[k * m + q];
                        a[k * m + p] = c * akp - s * akq;
                        a[k * m + q] = s * akp + c * akq;
                    }
                    for (let k = 0; k < m; k++) {
                        const apk = a[p * m + k],
                            aqk = a[q * m + k];
                        a[p * m + k] = c * apk - s * aqk;
                        a[q * m + k] = s * apk + c * aqk;
                    }
                }
            }
        }
        const ev = [];
        for (let i = 0; i < m; i++) ev.push(a[i * m + i]);
        ev.sort((x, y) => x - y);
        const out = [];
        for (let i = 0; i < m; i += 2) out.push(0.5 * (ev[i] + ev[i + 1]));
        return out;
    }


    function checkDensity(rho, opts = {}) {
        const tr = trace(rho);
        const ev = opts.skipEigen ? null : eigvalsHermitian(rho);
        return {
            trace: tr.re,
            traceIm: tr.im,
            hermiticityError: hermiticityError(rho),
            minEigenvalue: ev ? ev[0] : NaN,
            purity: purity(rho)
        };
    }


    const STATE_KINDS = ["coherent", "thermal", "fock", "squeezed"];


    function analyticMoments(kind, par) {
        if (kind === "coherent") {
            const n = par.nbar;
            return {
                mean: n,
                variance: n,
                g2: 1,
                Q: 0
            };
        }
        if (kind === "thermal") {
            const n = par.nbar;
            return {
                mean: n,
                variance: n + n * n,
                g2: 2,
                Q: n
            };
        }
        if (kind === "fock") {
            const n = par.n;
            return {
                mean: n,
                variance: 0,
                g2: n > 0 ? 1 - 1 / n : NaN,
                Q: n > 0 ? -1 : NaN
            };
        }
        if (kind === "squeezed") {
            const n = par.nbar;
            return {
                mean: n,
                variance: 2 * n * (n + 1),
                g2: n > 0 ? 3 + 1 / n : NaN,
                Q: 2 * n + 1
            };
        }
        throw new Error("unknown state " + kind);
    }


    function logPn(kind, par, n) {
        if (kind === "coherent") {
            const m = par.nbar;
            if (m === 0) return n === 0 ? 0 : -Infinity;
            return -m + n * Math.log(m) - lnFact(n);
        }
        if (kind === "thermal") {
            const m = par.nbar;
            if (m === 0) return n === 0 ? 0 : -Infinity;
            return n * Math.log(m / (1 + m)) - Math.log(1 + m);
        }
        if (kind === "fock") return n === par.n ? 0 : -Infinity;
        if (kind === "squeezed") {
            if (n % 2) return -Infinity;
            const m = n / 2,
                nb = par.nbar;
            if (nb === 0) return n === 0 ? 0 : -Infinity;
            const r = Math.asinh(Math.sqrt(nb));
            const th = Math.tanh(r);
            return 2 * m * Math.log(th) + lnFact(2 * m) - 2 * m * Math.LN2 - 2 * lnFact(m) - Math.log(Math.cosh(r));
        }
        throw new Error("unknown state " + kind);
    }


    function tailProbability(kind, par, N) {
        if (kind === "thermal") return par.nbar === 0 ? 0 : Math.pow(par.nbar / (1 + par.nbar), N + 1);
        if (kind === "fock") return par.n > N ? 1 : 0;
        const mean = par.nbar;
        let s = 0;
        const nMax = Math.max(N + 50, Math.ceil(mean + 60 * Math.sqrt(mean + 1) + 40 * (kind === "squeezed" ? mean + 1 : 1)));
        for (let n = N + 1; n <= Math.min(nMax, 200000); n++) {
            const lp = logPn(kind, par, n);
            if (lp === -Infinity) continue;
            const p = Math.exp(lp);
            s += p;
            if (n > mean * 3 + 20 && p < 1e-20 * Math.max(s, 1e-300) && p < 1e-300) break;
        }
        return s;
    }


    function makeState(kind, par, N) {
        N = Math.max(0, Math.round(N));
        const dim = N + 1;
        let ket = null,
            p = new Float64Array(dim);
        if (kind === "coherent" || kind === "squeezed") {
            ket = {
                re: new Float64Array(dim),
                im: new Float64Array(dim)
            };
            const ph = par.phase || 0;
            for (let n = 0; n < dim; n++) {
                const lp = logPn(kind, par, n);
                if (lp === -Infinity) continue;
                const amp = Math.exp(0.5 * lp);

                const ang = kind === "coherent" ? n * ph : (n / 2) * (ph + Math.PI);
                ket.re[n] = amp * Math.cos(ang);
                ket.im[n] = amp * Math.sin(ang);
                p[n] = amp * amp;
            }
        } else if (kind === "thermal" || kind === "fock") {
            if (kind === "fock" && par.n > N) throw new Error("Fock state |" + par.n + "⟩ outside the truncated basis N = " + N);
            for (let n = 0; n < dim; n++) {
                const lp = logPn(kind, par, n);
                p[n] = lp === -Infinity ? 0 : Math.exp(lp);
            }
            if (kind === "fock") {
                ket = {
                    re: new Float64Array(dim),
                    im: new Float64Array(dim)
                };
                ket.re[par.n] = 1;
            }
        } else throw new Error("unknown state " + kind);
        let s = 0;
        for (let n = 0; n < dim; n++) s += p[n];
        if (ket) {
            const f = 1 / Math.sqrt(s);
            for (let n = 0; n < dim; n++) {
                ket.re[n] *= f;
                ket.im[n] *= f;
            }
        }
        for (let n = 0; n < dim; n++) p[n] /= s;
        const rho = ket ? densityFromKet(ket) : diagonalDensity(p);
        return {
            kind,
            par,
            N,
            dim,
            ket,
            rho,
            p,
            truncation: tailProbability(kind, par, N),
            normalisedFrom: s,
            exact: analyticMoments(kind, par)
        };
    }


    function numberDistribution(rho) {
        const p = new Float64Array(rho.n);
        for (let i = 0; i < rho.n; i++) p[i] = rho.re[i * rho.n + i];
        return p;
    }


    function momentsOf(p) {
        let s0 = 0,
            s1 = 0,
            s2 = 0;
        for (let n = 0; n < p.length; n++) {
            s0 += p[n];
            s1 += n * p[n];
            s2 += n * n * p[n];
        }
        const mean = s1 / s0,
            variance = s2 / s0 - mean * mean;
        return {
            total: s0,
            mean,
            variance,
            Q: mean > 0 ? variance / mean - 1 : NaN,
            g2: mean > 0 ? (s2 / s0 - mean) / (mean * mean) : NaN
        };
    }

    function logBinom(n, k) {
        return lnFact(n) - lnFact(k) - lnFact(n - k);
    }


    function lossChannel(rho, eta) {
        const n = rho.n,
            out = cmat(n);
        eta = Math.min(1, Math.max(0, eta));
        if (eta === 1) {
            out.re.set(rho.re);
            out.im.set(rho.im);
            return out;
        }
        const le = eta > 0 ? Math.log(eta) : -Infinity,
            l1 = Math.log(1 - eta);
        for (let m = 0; m < n; m++) {
            for (let mp = 0; mp < n; mp++) {
                let sr = 0,
                    si = 0;
                for (let k = 0; m + k < n && mp + k < n; k++) {
                    const a = m + k,
                        b = mp + k;
                    const lw = 0.5 * (logBinom(a, k) + logBinom(b, k)) + (eta > 0 ? 0.5 * (m + mp) * le : (m + mp === 0 ? 0 : -Infinity)) + k * l1;
                    if (lw === -Infinity) continue;
                    const w = Math.exp(lw);
                    sr += w * rho.re[a * n + b];
                    si += w * rho.im[a * n + b];
                }
                out.re[m * n + mp] = sr;
                out.im[m * n + mp] = si;
            }
        }
        return out;
    }


    function thinDistribution(p, eta) {
        const n = p.length,
            q = new Float64Array(n);
        for (let a = 0; a < n; a++) {
            if (!p[a]) continue;
            for (let k = 0; k <= a; k++) {
                const lw = logBinom(a, k) + (k ? k * Math.log(eta) : 0) + (a - k ? (a - k) * Math.log(1 - eta) : 0);
                q[k] += p[a] * Math.exp(lw);
            }
        }
        return q;
    }

    function poissonPmf(mean, kMax) {
        const out = new Float64Array(kMax + 1);
        for (let k = 0; k <= kMax; k++) out[k] = mean > 0 ? Math.exp(-mean + k * Math.log(mean) - lnFact(k)) : (k === 0 ? 1 : 0);
        return out;
    }


    function detectedDistribution(p, eta, dark = 0) {
        const q = eta >= 1 ? Float64Array.from(p) : thinDistribution(p, eta);
        if (!(dark > 0)) return q;
        let kMax = 0;
        let cdf = 0;
        const pd = [];
        for (let k = 0; k < 4000; k++) {
            const v = Math.exp(-dark + k * Math.log(dark) - lnFact(k));
            pd.push(v);
            cdf += v;
            if (k > dark && 1 - cdf < 1e-14) {
                kMax = k;
                break;
            }
            kMax = k;
        }
        const out = new Float64Array(q.length + kMax);
        for (let a = 0; a < q.length; a++) {
            if (!q[a]) continue;
            for (let k = 0; k <= kMax; k++) out[a + k] += q[a] * pd[k];
        }
        return out;
    }


    function detectedMomentsAnalytic(ex, eta, dark = 0) {
        const mean = eta * ex.mean + dark;

        const variance = eta * eta * ex.variance + eta * (1 - eta) * ex.mean + dark;
        return {
            mean,
            variance,
            Q: mean > 0 ? variance / mean - 1 : NaN,
            g2: mean > 0 ? (variance + mean * mean - mean) / (mean * mean) : NaN
        };
    }


    function cumulative(p) {
        const c = new Float64Array(p.length);
        let s = 0;
        for (let i = 0; i < p.length; i++) {
            s += p[i];
            c[i] = s;
        }
        return c;
    }

    function drawFromCdf(cdf, u) {
        u *= cdf[cdf.length - 1];
        let lo = 0,
            hi = cdf.length - 1;
        while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if (cdf[mid] > u) hi = mid;
            else lo = mid + 1;
        }
        return lo;
    }


    function sampleDetections(p, det, shots, rng, keep = 0) {
        const eta = det.eta == null ? 1 : det.eta,
            dark = det.dark || 0;
        const cdf = cumulative(p);
        const hist = [];
        const samples = [];
        let s1 = 0,
            s2 = 0;
        for (let i = 0; i < shots; i++) {
            const n = drawFromCdf(cdf, rng.next());
            let k = 0;
            if (eta >= 1) k = n;
            else
                for (let j = 0; j < n; j++)
                    if (rng.next() < eta) k++;
            if (dark > 0) k += rng.poisson(dark);
            while (hist.length <= k) hist.push(0);
            hist[k]++;
            s1 += k;
            s2 += k * k;
            if (samples.length < keep) samples.push({
                n,
                k
            });
        }
        const mean = s1 / shots,
            variance = shots > 1 ? (s2 - shots * mean * mean) / (shots - 1) : 0;
        return {
            hist: Float64Array.from(hist),
            shots,
            mean,
            variance,
            seMean: Math.sqrt(variance / shots),
            samples
        };
    }


    function chiSquare(counts, p, shots, minExpected = 5) {
        const L = Math.max(counts.length, p.length);
        let chi2 = 0,
            bins = 0,
            eAcc = 0,
            oAcc = 0;
        for (let i = 0; i < L; i++) {
            eAcc += (p[i] || 0) * shots;
            oAcc += counts[i] || 0;
            if (eAcc >= minExpected) {
                chi2 += (oAcc - eAcc) ** 2 / eAcc;
                bins++;
                eAcc = 0;
                oAcc = 0;
            }
        }
        if (eAcc > 0 || oAcc > 0) {
            if (bins > 0 && eAcc < minExpected) {

                chi2 += eAcc > 0 ? (oAcc - eAcc) ** 2 / Math.max(eAcc, minExpected) : oAcc;
            } else {
                chi2 += (oAcc - eAcc) ** 2 / Math.max(eAcc, 1e-300);
                bins++;
            }
        }
        return {
            chi2,
            dof: Math.max(1, bins - 1),
            bins
        };
    }



    function mzState(cfg = {}) {
        const R = cfg.R1 == null ? 0.5 : Math.min(1, Math.max(0, cfg.R1));
        const t = Math.sqrt(1 - R),
            r = Math.sqrt(R);
        const th = cfg.theta || 0,
            phi = cfg.phi || 0,
            gam = Math.min(1, Math.max(0, cfg.dephase || 0));

        const ket = {
            re: new Float64Array(4),
            im: new Float64Array(4)
        };
        ket.re[0] = t;
        const br = -r * Math.sin(phi),
            bi = r * Math.cos(phi);
        ket.re[2] = br * Math.cos(th);
        ket.im[2] = bi * Math.cos(th);
        ket.re[3] = br * Math.sin(th);
        ket.im[3] = bi * Math.sin(th);
        const rho = densityFromKet(ket);
        if (gam > 0) {
            for (let i = 0; i < 2; i++)
                for (let j = 2; j < 4; j++) {
                    rho.re[i * 4 + j] *= 1 - gam;
                    rho.im[i * 4 + j] *= 1 - gam;
                    rho.re[j * 4 + i] *= 1 - gam;
                    rho.im[j * 4 + i] *= 1 - gam;
                }
        }
        return {
            rho,
            wa: 1 - R,
            wb: R
        };
    }


    function bs2Unitary() {
        const U = cmat(4),
            s = Math.SQRT1_2;

        for (let pol = 0; pol < 2; pol++) {
            U.re[(0 + pol) * 4 + (0 + pol)] = s;
            U.im[(0 + pol) * 4 + (2 + pol)] = s;
            U.im[(2 + pol) * 4 + (0 + pol)] = s;
            U.re[(2 + pol) * 4 + (2 + pol)] = s;
        }
        return U;
    }
    const BS2 = bs2Unitary();


    function mzProbabilities(cfg = {}) {
        const {
            rho
        } = mzState(cfg);
        const out = matMul(matMul(BS2, rho), adjoint(BS2));
        let P1, P2;
        if (cfg.polarizer == null || !Number.isFinite(cfg.polarizer)) {
            P1 = out.re[0] + out.re[5];
            P2 = out.re[10] + out.re[15];
        } else {
            const c = Math.cos(cfg.polarizer),
                s = Math.sin(cfg.polarizer);

            const blk = (o) => c * c * out.re[(o) * 4 + o] + s * s * out.re[(o + 1) * 4 + (o + 1)] + 2 * c * s * out.re[o * 4 + (o + 1)];
            P1 = blk(0);
            P2 = blk(2);
        }
        return {
            P1,
            P2,
            Pblocked: Math.max(0, 1 - P1 - P2),
            rhoOut: out,
            rhoIn: rho
        };
    }


    function mzVisibility(cfg = {}, port = 1) {
        const ps = [0, 0.5, 1, 1.5].map((k) => {
            const r = mzProbabilities(Object.assign({}, cfg, {
                phi: k * Math.PI
            }));
            const tot = r.P1 + r.P2;
            return {
                P: port === 1 ? r.P1 : r.P2,
                cond: tot > 0 ? (port === 1 ? r.P1 : r.P2) / tot : 0
            };
        });
        const vis = (key) => {
            const A = (ps[0][key] + ps[1][key] + ps[2][key] + ps[3][key]) / 4;
            const B = 0.5 * Math.hypot(ps[0][key] - ps[2][key], ps[1][key] - ps[3][key]);
            return A > 0 ? B / A : 0;
        };
        return {
            V: vis("P"),
            Vcond: vis("cond"),
            phase: Math.atan2(ps[1].P - ps[3].P, ps[0].P - ps[2].P)
        };
    }


    function whichPath(cfg = {}) {
        const R = cfg.R1 == null ? 0.5 : cfg.R1;
        const wa = 1 - R,
            wb = R,
            th = cfg.theta || 0,
            gam = cfg.dephase || 0;

        const c = Math.cos(th),
            s = Math.sin(th);
        const a = wa - wb * c * c,
            d = -wb * s * s,
            b = -wb * c * s;
        const half = Math.sqrt(0.25 * (a - d) * (a - d) + b * b),
            mid = 0.5 * (a + d);
        const D = Math.abs(mid + half) + Math.abs(mid - half);
        const overlap = Math.abs(c);
        const Vth = 2 * Math.sqrt(wa * wb) * overlap * (1 - gam);
        return {
            P: Math.abs(wa - wb),
            D,
            overlap,
            V: Vth,
            guess: 0.5 * (1 + D),
            sum: Vth * Vth + D * D
        };
    }


    function mzClickProbabilities(probs, det = {}) {
        const eta = det.eta == null ? 1 : det.eta,
            pd = det.pDark || 0;
        return {
            c1: 1 - (1 - eta * probs.P1) * (1 - pd),
            c2: 1 - (1 - eta * probs.P2) * (1 - pd),
            both: (1 - (1 - eta * probs.P1) * (1 - pd)) + (1 - (1 - eta * probs.P2) * (1 - pd)) - 1 + (1 - eta * (probs.P1 + probs.P2)) * (1 - pd) * (1 - pd)
        };
    }


    function mzSampleEvent(probs, det, rng) {
        const eta = det.eta == null ? 1 : det.eta,
            pd = det.pDark || 0;
        const u = rng.next();
        const port = u < probs.P1 ? 1 : (u < probs.P1 + probs.P2 ? 2 : 0);
        const seen = port !== 0 && rng.next() < eta;
        const d1 = pd > 0 && rng.next() < pd,
            d2 = pd > 0 && rng.next() < pd;
        return {
            port,
            detected: seen,
            c1: (seen && port === 1) || d1,
            c2: (seen && port === 2) || d2
        };
    }


    const G2_KINDS = ["coherent", "thermal", "emitter"];


    function g2Ideal(kind, tau, par = {}) {
        const t0 = par.tau0;
        if (kind === "coherent") return 1;
        if (kind === "thermal") {
            const g1 = par.line === "gauss" ? Math.exp(-Math.PI * tau * tau / (2 * t0 * t0)) : Math.exp(-Math.abs(tau) / t0);
            return 1 + g1 * g1;
        }
        if (kind === "emitter") return 1 - Math.exp(-Math.abs(tau) / t0);
        throw new Error("unknown source " + kind);
    }


    function g2Measured(kind, tau, par = {}) {
        const sig = Math.SQRT2 * (par.jitter || 0);
        const bw = par.binWidth || 0;
        const rho = (par.rho1 == null ? 1 : par.rho1) * (par.rho2 == null ? 1 : par.rho2);
        if (kind === "coherent") return 1;
        const f = (t) => g2Ideal(kind, t, par) - 1;
        const nb = bw > 0 ? 9 : 1;
        let acc = 0;
        for (let b = 0; b < nb; b++) {
            const tb = nb === 1 ? tau : tau + bw * ((b + 0.5) / nb - 0.5);
            if (sig <= 0) {
                acc += f(tb);
                continue;
            }

            const n = 240,
                L = 6 * sig;
            let s = 0;
            for (let i = 0; i <= n; i++) {
                const u = -L + 2 * L * i / n;
                const w = (i === 0 || i === n) ? 1 : (i % 2 ? 4 : 2);
                s += w * f(tb - u) * Math.exp(-u * u / (2 * sig * sig));
            }
            acc += s * (2 * L / n) / 3 / (Math.sqrt(2 * Math.PI) * sig);
        }
        return 1 + rho * acc / nb;
    }


    function emitterRates(tau0, Remit) {
        const S = 1 / tau0;
        const disc = S * S - 4 * S * Remit;
        if (disc < 0) return {
            saturated: true,
            gammaR: S / 2,
            gammaP: S / 2,
            Rmax: S / 4,
            Remit: S / 4
        };
        const sq = Math.sqrt(disc);
        return {
            saturated: false,
            gammaR: 0.5 * (S + sq),
            gammaP: 0.5 * (S - sq),
            Rmax: S / 4,
            Remit
        };
    }

    function pushSorted(arr) {
        const a = Float64Array.from(arr);
        a.sort();
        return a;
    }


    function simulateHBT(cfg) {
        const rng = core.createRng(cfg.seed == null ? 1 : cfg.seed);
        const R = Math.max(0, cfg.rate),
            dark = Math.max(0, cfg.dark || 0),
            tau0 = cfg.tau0;
        const maxSteps = cfg.maxSteps || 3e6,
            maxEvents = cfg.maxEvents || 4e6;
        let T = cfg.T,
            truncated = false;
        const a1 = [],
            a2 = [];
        const info = {
            kind: cfg.kind
        };
        const perSecondEvents = 2 * (R + dark);
        if (perSecondEvents * T > maxEvents * 1.02) {
            T = maxEvents / perSecondEvents;
            truncated = true;
        }
        if (cfg.kind === "coherent") {
            for (const arr of [a1, a2]) {
                let t = 0;
                if (R > 0)
                    for (;;) {
                        t += -Math.log(1 - rng.next()) / R;
                        if (t >= T) break;
                        arr.push(t);
                    }
            }
        } else if (cfg.kind === "thermal") {
            const dt = tau0 / 10;
            if (T / dt > maxSteps * 1.02) {
                T = maxSteps * dt;
                truncated = true;
            }
            const steps = Math.floor(T / dt);
            info.dt = dt;
            const keepI = new Float64Array(Math.min(steps, 400));
            const lam = R * dt;
            const emit = (i, I) => {
                if (lam * I <= 0) return;
                const k1 = rng.poisson(lam * I),
                    k2 = rng.poisson(lam * I);
                for (let k = 0; k < k1; k++) a1.push((i + rng.next()) * dt);
                for (let k = 0; k < k2; k++) a2.push((i + rng.next()) * dt);
            };
            const cn = () => [rng.normal() * Math.SQRT1_2, rng.normal() * Math.SQRT1_2];
            if (cfg.line === "gauss") {
                const s = tau0 / Math.sqrt(2 * Math.PI),
                    half = Math.ceil(4.5 * s / dt);
                const K = 2 * half + 1,
                    h = new Float64Array(K);
                let norm = 0;
                for (let j = 0; j < K; j++) {
                    const x = (j - half) * dt;
                    h[j] = Math.exp(-x * x / (2 * s * s));
                    norm += h[j] * h[j];
                }
                for (let j = 0; j < K; j++) h[j] /= Math.sqrt(norm);
                const br = new Float64Array(K),
                    bi = new Float64Array(K);
                for (let j = 0; j < K; j++) {
                    const z = cn();
                    br[j] = z[0];
                    bi[j] = z[1];
                }
                let pos = 0;
                for (let i = 0; i < steps; i++) {
                    let er = 0,
                        ei = 0;
                    for (let j = 0; j < K; j++) {
                        const idx = (pos + j) % K;
                        er += h[j] * br[idx];
                        ei += h[j] * bi[idx];
                    }
                    const I = er * er + ei * ei;
                    if (i < keepI.length) keepI[i] = I;
                    emit(i, I);
                    const z = cn();
                    br[pos] = z[0];
                    bi[pos] = z[1];
                    pos = (pos + 1) % K;
                }
            } else {
                const a = Math.exp(-dt / tau0),
                    b = Math.sqrt(1 - a * a);
                let z = cn(),
                    er = z[0],
                    ei = z[1];
                for (let i = 0; i < steps; i++) {
                    const I = er * er + ei * ei;
                    if (i < keepI.length) keepI[i] = I;
                    emit(i, I);
                    z = cn();
                    er = a * er + b * z[0];
                    ei = a * ei + b * z[1];
                }
            }
            info.intensity = {
                dt,
                I: keepI
            };
        } else if (cfg.kind === "emitter") {
            const eta = Math.min(1, Math.max(1e-6, cfg.eta == null ? 0.1 : cfg.eta));
            const er = emitterRates(tau0, 2 * R / eta);
            Object.assign(info, er);

            const maxEmit = cfg.maxEmissions || 1.2e7;
            if (er.Remit * T > maxEmit * 1.02) {
                T = maxEmit / er.Remit;
                truncated = true;
            }
            let t = 0;
            const emitted = [];
            for (;;) {
                t += -Math.log(1 - rng.next()) / er.gammaP - Math.log(1 - rng.next()) / er.gammaR;
                if (t >= T) break;
                const u = rng.next();
                if (u < eta / 2) a1.push(t);
                else if (u < eta) a2.push(t);
                if (emitted.length < 400) emitted.push(t);
            }
            info.emitted = emitted;
        } else throw new Error("unknown source " + cfg.kind);

        if (dark > 0)
            for (const arr of [a1, a2]) {
                let t = 0;
                for (;;) {
                    t += -Math.log(1 - rng.next()) / dark;
                    if (t >= T) break;
                    arr.push(t);
                }
            }
        const sig = cfg.jitter || 0;
        if (sig > 0) {
            for (let i = 0; i < a1.length; i++) a1[i] += rng.normal(0, sig);
            for (let i = 0; i < a2.length; i++) a2[i] += rng.normal(0, sig);
        }
        return {
            t1: pushSorted(a1),
            t2: pushSorted(a2),
            T,
            truncated,
            info
        };
    }


    function coincidenceHistogram(t1, t2, opts) {
        const bw = opts.binWidth,
            W = opts.range,
            T = opts.T;
        const nb = Math.max(1, Math.round(2 * W / bw));
        const lo = -nb * bw / 2;
        const counts = new Float64Array(nb);
        let j0 = 0;
        for (let i = 0; i < t1.length; i++) {
            const a = t1[i];
            while (j0 < t2.length && t2[j0] < a + lo) j0++;
            for (let j = j0; j < t2.length; j++) {
                const d = t2[j] - a;
                if (d >= -lo) break;
                const k = Math.floor((d - lo) / bw);
                if (k >= 0 && k < nb) counts[k]++;
            }
        }
        const centers = new Float64Array(nb),
            g2 = new Float64Array(nb),
            err = new Float64Array(nb);
        const N1 = t1.length,
            N2 = t2.length;
        for (let k = 0; k < nb; k++) {
            const c = lo + (k + 0.5) * bw;
            centers[k] = c;
            const acc = N1 * N2 * bw * Math.max(T - Math.abs(c), 1e-300) / (T * T);
            g2[k] = acc > 0 ? counts[k] / acc : NaN;
            err[k] = acc > 0 ? Math.sqrt(Math.max(counts[k], 1)) / acc : NaN;
        }
        return {
            centers,
            counts,
            g2,
            err,
            binWidth: bw,
            expectedAccidental: N1 * N2 * bw / T
        };
    }

    return {

        cmat,
        densityFromKet,
        diagonalDensity,
        trace,
        matMul,
        adjoint,
        hermiticityError,
        purity,
        eigvalsHermitian,
        checkDensity,

        STATE_KINDS,
        analyticMoments,
        logPn,
        tailProbability,
        makeState,
        numberDistribution,
        momentsOf,
        lossChannel,
        thinDistribution,
        poissonPmf,
        detectedDistribution,
        detectedMomentsAnalytic,
        sampleDetections,
        chiSquare,

        mzState,
        mzProbabilities,
        mzVisibility,
        whichPath,
        mzClickProbabilities,
        mzSampleEvent,

        G2_KINDS,
        g2Ideal,
        g2Measured,
        emitterRates,
        simulateHBT,
        coincidenceHistogram
    };
});