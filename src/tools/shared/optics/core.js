(function(root, factory) {
    const m = factory();
    if (typeof module === "object" && module.exports) module.exports = m;
    else {
        root.OpticsModels = root.OpticsModels || {};
        root.OpticsModels.core = m;
    }
})(typeof self !== "undefined" ? self : this, function() {
    "use strict";


    const constants = Object.freeze({
        c: 299792458,
        h: 6.62607015e-34,
        hbar: 6.62607015e-34 / (2 * Math.PI),
        e: 1.602176634e-19,
        kB: 1.380649e-23,
        NA: 6.02214076e23,
        eps0: 8.8541878188e-12,
        mu0: 1.25663706127e-6,
        eta0: 1.25663706127e-6 * 299792458,
        sigmaSB: 5.670374419e-8
    });

    const CONST = Object.assign({
        "ε0": constants.eps0,
        "μ0": constants.mu0,
        "η0": constants.eta0
    }, constants);


    const DEG = Math.PI / 180;
    const units = Object.freeze({
        pm: 1e-12,
        nm: 1e-9,
        um: 1e-6,
        mm: 1e-3,
        cm: 1e-2,
        m: 1,
        km: 1e3,
        fs: 1e-15,
        ps: 1e-12,
        ns: 1e-9,
        us: 1e-6,
        ms: 1e-3,
        mW: 1e-3,
        uW: 1e-6,
        nW: 1e-9,
        THz: 1e12,
        GHz: 1e9,
        MHz: 1e6,
        eV: 1.602176634e-19,
        deg: DEG,
        toRad: (deg) => deg * DEG,
        toDeg: (rad) => rad / DEG,

        freqFromWavelength: (lambda0) => constants.c / lambda0,
        wavelengthFromFreq: (f) => constants.c / f,

        photonEnergy: (lambda0) => constants.h * constants.c / lambda0,

        k0: (lambda0) => 2 * Math.PI / lambda0,
        toDb: (ratio) => 10 * Math.log10(ratio),
        fromDb: (db) => Math.pow(10, db / 10)
    });

    const SI_PREFIXES = [
        [1e12, "T"],
        [1e9, "G"],
        [1e6, "M"],
        [1e3, "k"],
        [1, ""],
        [1e-3, "m"],
        [1e-6, "µ"],
        [1e-9, "n"],
        [1e-12, "p"],
        [1e-15, "f"],
        [1e-18, "a"]
    ];


    function formatSI(value, unit = "", digits = 3) {
        if (!Number.isFinite(value)) return "—";
        if (value === 0) return "0" + (unit ? " " + unit : "");
        const av = Math.abs(value);
        let pref = SI_PREFIXES[SI_PREFIXES.length - 1];
        for (const p of SI_PREFIXES) {
            if (av >= p[0] * 0.9995) {
                pref = p;
                break;
            }
        }
        const scaled = value / pref[0];
        let s = Number(scaled.toPrecision(digits)).toString();
        if (Math.abs(scaled) >= 1e4 || Math.abs(scaled) < 1e-3) s = scaled.toExponential(digits - 1);
        return s + (unit || pref[1] ? " " + pref[1] + unit : "");
    }

    const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
    const lerp = (a, b, t) => a + (b - a) * t;


    const cx = (re, im = 0) => ({
        re,
        im
    });
    const complex = Object.freeze({
        cx,
        ZERO: Object.freeze(cx(0, 0)),
        ONE: Object.freeze(cx(1, 0)),
        I: Object.freeze(cx(0, 1)),
        add: (a, b) => cx(a.re + b.re, a.im + b.im),
        sub: (a, b) => cx(a.re - b.re, a.im - b.im),
        mul: (a, b) => cx(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re),

        div: (a, b) => {
            if (Math.abs(b.re) >= Math.abs(b.im)) {
                const r = b.im / b.re,
                    d = b.re + b.im * r;
                return cx((a.re + a.im * r) / d, (a.im - a.re * r) / d);
            }
            const r = b.re / b.im,
                d = b.re * r + b.im;
            return cx((a.re * r + a.im) / d, (a.im * r - a.re) / d);
        },
        scale: (a, s) => cx(a.re * s, a.im * s),
        neg: (a) => cx(-a.re, -a.im),
        conj: (a) => cx(a.re, -a.im),
        abs: (a) => Math.hypot(a.re, a.im),
        abs2: (a) => a.re * a.re + a.im * a.im,
        arg: (a) => Math.atan2(a.im, a.re),

        exp: (a) => {
            const r = Math.exp(a.re);
            return cx(r * Math.cos(a.im), r * Math.sin(a.im));
        },

        expi: (phi) => cx(Math.cos(phi), Math.sin(phi)),

        log: (a) => cx(Math.log(Math.hypot(a.re, a.im)), Math.atan2(a.im, a.re)),

        sqrt: (a) => {
            if (a.re === 0 && a.im === 0) return cx(0, 0);
            const t = Math.sqrt((Math.abs(a.re) + Math.hypot(a.re, a.im)) / 2);
            if (a.re >= 0) return cx(t, a.im / (2 * t));
            return cx(Math.abs(a.im) / (2 * t), a.im < 0 || Object.is(a.im, -0) ? -t : t);
        },
        fromPolar: (r, phi) => cx(r * Math.cos(phi), r * Math.sin(phi)),
        inv: (a) => {
            const d = a.re * a.re + a.im * a.im;
            return cx(a.re / d, -a.im / d);
        },
        isClose: (a, b, tol = 1e-12) => Math.hypot(a.re - b.re, a.im - b.im) <= tol
    });



    function linspace(a, b, n) {
        if (!(n >= 1)) throw new RangeError("linspace needs n ≥ 1");
        const out = new Float64Array(n);
        if (n === 1) {
            out[0] = a;
            return out;
        }
        const h = (b - a) / (n - 1);
        for (let i = 0; i < n; i++) out[i] = a + i * h;
        out[n - 1] = b;
        return out;
    }


    function simpson(f, a, b, n = 200) {
        n = Math.max(2, Math.ceil(n / 2) * 2);
        const h = (b - a) / n;
        let s = f(a) + f(b);
        for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * f(a + i * h);
        return s * h / 3;
    }


    function simpsonSamples(ys, dx) {
        const n = ys.length;
        if (n < 2) return 0;
        if (n === 2) return 0.5 * dx * (ys[0] + ys[1]);
        const simpsonOdd = (end) => {
            let s = ys[0] + ys[end];
            for (let i = 1; i < end; i++) s += (i % 2 ? 4 : 2) * ys[i];
            return s * dx / 3;
        };
        if (n % 2 === 1) return simpsonOdd(n - 1);

        const k = n - 4;
        const head = k >= 2 ? simpsonOdd(k) : 0;
        const tail = 3 * dx / 8 * (ys[k] + 3 * ys[k + 1] + 3 * ys[k + 2] + ys[k + 3]);
        return head + tail;
    }


    function trapz(ys, xs) {
        let s = 0;
        for (let i = 1; i < ys.length; i++) s += 0.5 * (ys[i] + ys[i - 1]) * (xs[i] - xs[i - 1]);
        return s;
    }


    function integrateAdaptive(f, a, b, tol = 1e-10, maxDepth = 50) {
        const fa = f(a),
            fb = f(b),
            m = (a + b) / 2,
            fm = f(m);
        const whole = (b - a) / 6 * (fa + 4 * fm + fb);

        function rec(a, b, fa, fb, fm, whole, tol, depth) {
            const m = (a + b) / 2,
                lm = (a + m) / 2,
                rm = (m + b) / 2;
            const flm = f(lm),
                frm = f(rm);
            const left = (m - a) / 6 * (fa + 4 * flm + fm);
            const right = (b - m) / 6 * (fm + 4 * frm + fb);
            const diff = left + right - whole;
            if (depth <= 0 || Math.abs(diff) <= 15 * tol) return left + right + diff / 15;
            return rec(a, m, fa, fm, flm, left, tol / 2, depth - 1) + rec(m, b, fm, fb, frm, right, tol / 2, depth - 1);
        }
        return rec(a, b, fa, fb, fm, whole, tol, maxDepth);
    }



    function bisect(f, a, b, {
        tol = 1e-12,
        maxIter = 200
    } = {}) {
        let fa = f(a),
            fb = f(b);
        if (fa === 0) return a;
        if (fb === 0) return b;
        if (fa * fb > 0) throw new RangeError("bisect: root not bracketed");
        for (let i = 0; i < maxIter; i++) {
            const m = 0.5 * (a + b),
                fm = f(m);
            if (fm === 0 || Math.abs(b - a) < tol * (1 + Math.abs(m))) return m;
            if (fa * fm < 0) {
                b = m;
                fb = fm;
            } else {
                a = m;
                fa = fm;
            }
        }
        return 0.5 * (a + b);
    }


    function brent(f, a, b, {
        tol = 1e-14,
        maxIter = 200
    } = {}) {
        let fa = f(a),
            fb = f(b);
        if (fa === 0) return a;
        if (fb === 0) return b;
        if (fa * fb > 0) throw new RangeError("brent: root not bracketed");
        let c = a,
            fc = fa,
            d = b - a,
            e = d;
        for (let iter = 0; iter < maxIter; iter++) {
            if (fb * fc > 0) {
                c = a;
                fc = fa;
                d = b - a;
                e = d;
            }
            if (Math.abs(fc) < Math.abs(fb)) {
                a = b;
                b = c;
                c = a;
                fa = fb;
                fb = fc;
                fc = fa;
            }
            const tol1 = 2 * Number.EPSILON * Math.abs(b) + 0.5 * tol;
            const xm = 0.5 * (c - b);
            if (Math.abs(xm) <= tol1 || fb === 0) return b;
            if (Math.abs(e) >= tol1 && Math.abs(fa) > Math.abs(fb)) {
                const s = fb / fa;
                let p, q;
                if (a === c) {
                    p = 2 * xm * s;
                    q = 1 - s;
                } else {
                    const qq = fa / fc,
                        r = fb / fc;
                    p = s * (2 * xm * qq * (qq - r) - (b - a) * (r - 1));
                    q = (qq - 1) * (r - 1) * (s - 1);
                }
                if (p > 0) q = -q;
                p = Math.abs(p);
                const min1 = 3 * xm * q - Math.abs(tol1 * q),
                    min2 = Math.abs(e * q);
                if (2 * p < Math.min(min1, min2)) {
                    e = d;
                    d = p / q;
                } else {
                    d = xm;
                    e = d;
                }
            } else {
                d = xm;
                e = d;
            }
            a = b;
            fa = fb;
            b += Math.abs(d) > tol1 ? d : (xm > 0 ? tol1 : -tol1);
            fb = f(b);
        }
        return b;
    }


    function bracketRoots(f, a, b, n = 200) {
        const out = [];
        const h = (b - a) / n;
        let x0 = a,
            f0 = f(a);
        for (let i = 1; i <= n; i++) {
            const x1 = i === n ? b : a + i * h,
                f1 = f(x1);
            if (f0 === 0) out.push([x0, x0]);
            else if (Number.isFinite(f0) && Number.isFinite(f1) && f0 * f1 < 0) out.push([x0, x1]);
            x0 = x1;
            f0 = f1;
        }
        if (f0 === 0) out.push([x0, x0]);
        return out;
    }


    function findRoots(f, a, b, {
        n = 400,
        tol = 1e-14,
        poleTol = 1e-3
    } = {}) {
        const roots = [];
        for (const [lo, hi] of bracketRoots(f, a, b, n)) {
            const r = lo === hi ? lo : brent(f, lo, hi, {
                tol
            });
            const fr = Math.abs(f(r));
            const scale = Math.max(Math.abs(f(lo)), Math.abs(f(hi)));
            if (fr <= poleTol * scale || fr === 0) {
                if (!roots.length || Math.abs(r - roots[roots.length - 1]) > 4 * tol * (1 + Math.abs(r))) roots.push(r);
            }
        }
        return roots;
    }



    function rk4Step(f, t, y, h) {
        const n = y.length;
        const tmp = new Float64Array(n);
        const k1 = f(t, y);
        for (let i = 0; i < n; i++) tmp[i] = y[i] + 0.5 * h * k1[i];
        const k2 = f(t + 0.5 * h, tmp);
        for (let i = 0; i < n; i++) tmp[i] = y[i] + 0.5 * h * k2[i];
        const k3 = f(t + 0.5 * h, tmp);
        for (let i = 0; i < n; i++) tmp[i] = y[i] + h * k3[i];
        const k4 = f(t + h, tmp);
        const out = new Float64Array(n);
        for (let i = 0; i < n; i++) out[i] = y[i] + h / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
        return out;
    }


    function integrateRK4(f, t0, y0, t1, nSteps, {
        record = true
    } = {}) {
        const h = (t1 - t0) / nSteps;
        let y = Float64Array.from(y0);
        const ts = record ? new Float64Array(nSteps + 1) : null;
        const ys = record ? [y] : null;
        if (record) ts[0] = t0;
        for (let i = 0; i < nSteps; i++) {
            y = rk4Step(f, t0 + i * h, y, h);
            if (record) {
                ts[i + 1] = t0 + (i + 1) * h;
                ys.push(y);
            }
        }
        return record ? {
            t: ts,
            y: ys
        } : {
            t: Float64Array.of(t1),
            y: [y]
        };
    }


    const SERIES_LIMIT = 12;


    function besselSeries(n, x) {
        const h = x / 2,
            h2 = h * h;
        let term = 1;
        for (let j = 1; j <= n; j++) term *= h / j;
        let sum = term;
        for (let k = 1; k < 300; k++) {
            term *= -h2 / (k * (k + n));
            sum += term;
            if (Math.abs(term) < 1e-17 * Math.abs(sum)) break;
        }
        return sum;
    }


    function besselAsymptotic(n, x) {
        const mu = 4 * n * n,
            z8 = 8 * x;
        let P = 1,
            Q = 0,
            term = 1,
            prevAbs = Infinity;
        for (let k = 1; k < 80; k++) {
            const odd = 2 * k - 1;
            term *= (mu - odd * odd) / (k * z8);
            const a = Math.abs(term);
            if (a > prevAbs || a < 1e-17) break;
            prevAbs = a;
            if (k % 2 === 1) Q += (((k - 1) / 2) % 2 === 0 ? 1 : -1) * term;
            else P += ((k / 2) % 2 === 0 ? 1 : -1) * term;
        }
        const chi = x - (n / 2 + 0.25) * Math.PI;
        return Math.sqrt(2 / (Math.PI * x)) * (P * Math.cos(chi) - Q * Math.sin(chi));
    }

    function besselJ01(n, x) {
        if (!Number.isFinite(x)) return 0;
        const ax = Math.abs(x);
        const r = ax <= SERIES_LIMIT ? besselSeries(n, ax) : besselAsymptotic(n, ax);
        return n === 1 && x < 0 ? -r : r;
    }


    const besselJ0 = (x) => besselJ01(0, x);

    const besselJ1 = (x) => besselJ01(1, x);


    function besselJ(n, x) {
        if (!Number.isInteger(n)) throw new RangeError("besselJ: integer order required");
        if (n < 0) return (n % 2 ? -1 : 1) * besselJ(-n, x);
        if (x < 0) return (n % 2 ? -1 : 1) * besselJ(n, -x);
        if (n === 0 || n === 1) return besselJ01(n, x);
        if (x === 0) return 0;
        if (x <= SERIES_LIMIT || x * x < 4 * (n + 1)) return besselSeries(n, x);
        if (n < x) {
            let jm = besselJ0(x),
                j = besselJ1(x);
            for (let k = 1; k < n; k++) {
                const jp = (2 * k / x) * j - jm;
                jm = j;
                j = jp;
            }
            return j;
        }

        const start = 2 * Math.floor((Math.max(n, x) + 15 + Math.sqrt(40 * Math.max(n, x))) / 2);
        let jp = 0,
            j = 1e-300,
            result = 0,
            sum = 0;
        for (let k = start; k > 0; k--) {
            const jm = (2 * k / x) * j - jp;
            jp = j;
            j = jm;
            if (Math.abs(j) > 1e250) {
                j *= 1e-250;
                jp *= 1e-250;
                result *= 1e-250;
                sum *= 1e-250;
            }
            if (k - 1 === n) result = j;
            if ((k - 1) % 2 === 0 && k - 1 > 0) sum += j;
        }
        sum = 2 * sum + j;
        return result / sum;
    }


    function besselJZero(n, k) {
        let count = 0;
        let lo = n === 0 ? 1e-9 : n;
        let flo = besselJ(n, lo);
        const step = 0.25;
        for (let i = 0; i < 100000; i++) {
            const hi = lo + step,
                fhi = besselJ(n, hi);
            if (flo * fhi <= 0 && flo !== 0) {
                count++;
                if (count === k) return brent((x) => besselJ(n, x), lo, hi);
            }
            lo = hi;
            flo = fhi;
        }
        return NaN;
    }


    function besselK(nu, x, scaled = false) {
        if (!(x > 0)) return x === 0 ? Infinity : NaN;
        nu = Math.abs(nu);
        const h = Math.min(0.05, 0.25 / Math.sqrt(x));
        let sum = 0.5;
        for (let i = 1; i < 1e6; i++) {
            const t = i * h;
            const term = Math.exp(-x * (Math.cosh(t) - 1) + nu * t) * 0.5 * (1 + Math.exp(-2 * nu * t));
            sum += term;
            if (term < 1e-18 * sum && x * (Math.cosh(t) - 1) > nu * t + 40) break;
        }
        const v = sum * h;
        return scaled ? v : v * Math.exp(-x);
    }
    const besselK0 = (x) => besselK(0, x);
    const besselK1 = (x) => besselK(1, x);



    const mat2 = Object.freeze({
        identity: () => [
            [1, 0],
            [0, 1]
        ],
        mul: (A, B) => [
            [A[0][0] * B[0][0] + A[0][1] * B[1][0], A[0][0] * B[0][1] + A[0][1] * B[1][1]],
            [A[1][0] * B[0][0] + A[1][1] * B[1][0], A[1][0] * B[0][1] + A[1][1] * B[1][1]]
        ],

        chain: (list) => list.reduce((acc, M) => mat2.mul(acc, M), [
            [1, 0],
            [0, 1]
        ]),
        det: (A) => A[0][0] * A[1][1] - A[0][1] * A[1][0],
        inverse: (A) => {
            const d = A[0][0] * A[1][1] - A[0][1] * A[1][0];
            if (d === 0) throw new RangeError("mat2.inverse: singular matrix");
            return [
                [A[1][1] / d, -A[0][1] / d],
                [-A[1][0] / d, A[0][0] / d]
            ];
        },
        apply: (A, v) => [A[0][0] * v[0] + A[0][1] * v[1], A[1][0] * v[0] + A[1][1] * v[1]],
        trace: (A) => A[0][0] + A[1][1]
    });

    const C = complex;
    const cmat2 = Object.freeze({
        identity: () => [
            [cx(1), cx(0)],
            [cx(0), cx(1)]
        ],
        fromReal: (A) => [
            [cx(A[0][0]), cx(A[0][1])],
            [cx(A[1][0]), cx(A[1][1])]
        ],
        mul: (A, B) => [
            [C.add(C.mul(A[0][0], B[0][0]), C.mul(A[0][1], B[1][0])), C.add(C.mul(A[0][0], B[0][1]), C.mul(A[0][1], B[1][1]))],
            [C.add(C.mul(A[1][0], B[0][0]), C.mul(A[1][1], B[1][0])), C.add(C.mul(A[1][0], B[0][1]), C.mul(A[1][1], B[1][1]))]
        ],
        chain: (list) => list.reduce((acc, M) => cmat2.mul(acc, M), cmat2.identity()),
        det: (A) => C.sub(C.mul(A[0][0], A[1][1]), C.mul(A[0][1], A[1][0])),
        inverse: (A) => {
            const d = cmat2.det(A);
            if (d.re === 0 && d.im === 0) throw new RangeError("cmat2.inverse: singular matrix");
            return [
                [C.div(A[1][1], d), C.neg(C.div(A[0][1], d))],
                [C.neg(C.div(A[1][0], d)), C.div(A[0][0], d)]
            ];
        },
        apply: (A, v) => [C.add(C.mul(A[0][0], v[0]), C.mul(A[0][1], v[1])), C.add(C.mul(A[1][0], v[0]), C.mul(A[1][1], v[1]))],

        adjoint: (A) => [
            [C.conj(A[0][0]), C.conj(A[1][0])],
            [C.conj(A[0][1]), C.conj(A[1][1])]
        ],
        trace: (A) => C.add(A[0][0], A[1][1])
    });


    const isPow2 = (n) => n > 0 && (n & (n - 1)) === 0;
    const nextPow2 = (n) => {
        let p = 1;
        while (p < n) p *= 2;
        return p;
    };


    function fft(re, im, inverse = false) {
        const n = re.length;
        if (im.length !== n) throw new RangeError("fft: re and im lengths differ");
        if (!isPow2(n)) throw new RangeError("fft: length must be a power of two (got " + n + ")");
        for (let i = 1, j = 0; i < n; i++) {
            let bit = n >> 1;
            for (; j & bit; bit >>= 1) j ^= bit;
            j ^= bit;
            if (i < j) {
                let t = re[i];
                re[i] = re[j];
                re[j] = t;
                t = im[i];
                im[i] = im[j];
                im[j] = t;
            }
        }
        const sign = inverse ? 1 : -1;
        for (let len = 2; len <= n; len <<= 1) {
            const half = len >> 1;
            const ang = sign * 2 * Math.PI / len;

            for (let k = 0; k < half; k++) {
                const wr = Math.cos(ang * k),
                    wi = Math.sin(ang * k);
                for (let i = k; i < n; i += len) {
                    const j = i + half;
                    const xr = re[j] * wr - im[j] * wi;
                    const xi = re[j] * wi + im[j] * wr;
                    re[j] = re[i] - xr;
                    im[j] = im[i] - xi;
                    re[i] += xr;
                    im[i] += xi;
                }
            }
        }
        if (inverse) {
            for (let i = 0; i < n; i++) {
                re[i] /= n;
                im[i] /= n;
            }
        }
        return [re, im];
    }
    const ifft = (re, im) => fft(re, im, true);


    function dft(re, im, inverse = false) {
        const n = re.length,
            oR = new Float64Array(n),
            oI = new Float64Array(n);
        const sign = inverse ? 1 : -1;
        for (let k = 0; k < n; k++) {
            let sr = 0,
                si = 0;
            for (let j = 0; j < n; j++) {
                const a = sign * 2 * Math.PI * ((k * j) % n) / n;
                const c = Math.cos(a),
                    s = Math.sin(a);
                sr += re[j] * c - im[j] * s;
                si += re[j] * s + im[j] * c;
            }
            oR[k] = inverse ? sr / n : sr;
            oI[k] = inverse ? si / n : si;
        }
        return [oR, oI];
    }


    function fft2(re, im, nx, ny, inverse = false) {
        if (re.length !== nx * ny || im.length !== nx * ny) throw new RangeError("fft2: size mismatch");
        const rr = new Float64Array(nx),
            ri = new Float64Array(nx);
        for (let y = 0; y < ny; y++) {
            const o = y * nx;
            for (let x = 0; x < nx; x++) {
                rr[x] = re[o + x];
                ri[x] = im[o + x];
            }
            fft(rr, ri, inverse);
            for (let x = 0; x < nx; x++) {
                re[o + x] = rr[x];
                im[o + x] = ri[x];
            }
        }
        const cr = new Float64Array(ny),
            ci = new Float64Array(ny);
        for (let x = 0; x < nx; x++) {
            for (let y = 0; y < ny; y++) {
                cr[y] = re[y * nx + x];
                ci[y] = im[y * nx + x];
            }
            fft(cr, ci, inverse);
            for (let y = 0; y < ny; y++) {
                re[y * nx + x] = cr[y];
                im[y * nx + x] = ci[y];
            }
        }
        return [re, im];
    }
    const ifft2 = (re, im, nx, ny) => fft2(re, im, nx, ny, true);

    function shiftBy(a, s) {
        const n = a.length,
            out = new a.constructor(n);
        for (let i = 0; i < n; i++) out[(i + s) % n] = a[i];
        return out;
    }

    const fftshift = (a) => shiftBy(a, Math.floor(a.length / 2));

    const ifftshift = (a) => shiftBy(a, Math.ceil(a.length / 2));

    function shift2(a, nx, ny, sx, sy) {
        const out = new a.constructor(nx * ny);
        for (let y = 0; y < ny; y++) {
            const yy = (y + sy) % ny;
            for (let x = 0; x < nx; x++) out[yy * nx + (x + sx) % nx] = a[y * nx + x];
        }
        return out;
    }
    const fftshift2 = (a, nx, ny) => shift2(a, nx, ny, Math.floor(nx / 2), Math.floor(ny / 2));
    const ifftshift2 = (a, nx, ny) => shift2(a, nx, ny, Math.ceil(nx / 2), Math.ceil(ny / 2));


    function fftFreq(n, d = 1, shifted = false) {
        const f = new Float64Array(n);
        for (let i = 0; i < n; i++) f[i] = (i < Math.ceil(n / 2) ? i : i - n) / (n * d);
        return shifted ? fftshift(f) : f;
    }



    function mulberry32(seed) {
        let a = seed >>> 0;
        return function() {
            a = (a + 0x6D2B79F5) >>> 0;
            let t = a;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }


    function logGamma(x) {
        if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - logGamma(1 - x);
        let shift = 0;
        while (x < 10) {
            shift += Math.log(x);
            x += 1;
        }
        const z2 = 1 / (x * x);
        const series = (1 / x) * (1 / 12 - z2 * (1 / 360 - z2 * (1 / 1260 - z2 * (1 / 1680 - z2 / 1188))));
        return (x - 0.5) * Math.log(x) - x + 0.5 * Math.log(2 * Math.PI) + series - shift;
    }


    function createRng(seed = 1) {
        const next = mulberry32(seed);
        let spare = null;

        function normal(mean = 0, sd = 1) {
            if (spare !== null) {
                const s = spare;
                spare = null;
                return mean + sd * s;
            }
            let u = 0;
            while (u === 0) u = next();
            const v = next();
            const r = Math.sqrt(-2 * Math.log(u));
            spare = r * Math.sin(2 * Math.PI * v);
            return mean + sd * r * Math.cos(2 * Math.PI * v);
        }

        function poisson(lam) {
            if (!(lam > 0)) return 0;
            if (lam < 30) {
                const L = Math.exp(-lam);
                let k = 0,
                    p = 1;
                do {
                    k++;
                    p *= next();
                } while (p > L);
                return k - 1;
            }

            const slam = Math.sqrt(lam),
                loglam = Math.log(lam);
            const b = 0.931 + 2.53 * slam,
                a = -0.059 + 0.02483 * b;
            const invalpha = 1.1239 + 1.1328 / (b - 3.4),
                vr = 0.9277 - 3.6224 / (b - 2);
            for (;;) {
                const U = next() - 0.5,
                    V = next();
                const us = 0.5 - Math.abs(U);
                const k = Math.floor((2 * a / us + b) * U + lam + 0.43);
                if (us >= 0.07 && V <= vr) return k;
                if (k < 0 || (us < 0.013 && V > us)) continue;
                if (Math.log(V) + Math.log(invalpha) - Math.log(a / (us * us) + b) <=
                    -lam + k * loglam - logGamma(k + 1)) return k;
            }
        }
        return {
            seed,
            next,
            uniform: (a = 0, b = 1) => a + (b - a) * next(),
            int: (n) => Math.floor(next() * n),
            normal,
            gaussian: normal,
            poisson
        };
    }

    return {
        constants,
        CONST,
        units,
        formatSI,
        clamp,
        lerp,
        complex,
        cx,
        linspace,
        simpson,
        simpsonSamples,
        trapz,
        integrateAdaptive,
        bisect,
        brent,
        bracketRoots,
        findRoots,
        rk4Step,
        integrateRK4,
        besselJ0,
        besselJ1,
        besselJ,
        besselJZero,
        besselK,
        besselK0,
        besselK1,
        mat2,
        cmat2,
        isPow2,
        nextPow2,
        fft,
        ifft,
        dft,
        fft2,
        ifft2,
        fftshift,
        ifftshift,
        fftshift2,
        ifftshift2,
        fftFreq,
        mulberry32,
        createRng,
        logGamma
    };
});