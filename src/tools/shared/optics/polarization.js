(function(root, factory) {
    const m = factory();
    if (typeof module === "object" && module.exports) module.exports = m;
    else {
        root.OpticsModels = root.OpticsModels || {};
        root.OpticsModels.polarization = m;
    }
})(typeof self !== "undefined" ? self : this, function() {
    "use strict";


    const c = (re, im = 0) => ({
        re,
        im
    });
    const cadd = (a, b) => c(a.re + b.re, a.im + b.im);
    const cmul = (a, b) => c(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
    const cconj = (a) => c(a.re, -a.im);
    const cabs2 = (a) => a.re * a.re + a.im * a.im;
    const cexp = (phi) => c(Math.cos(phi), Math.sin(phi));


    const EXACT_TOL = 1e-9;
    const DEFAULT_APPROX_TOL_DEG = 2;



    function jonesFromPsiDelta(psi, delta) {
        return [c(Math.cos(psi)), cmul(c(Math.sin(psi)), cexp(delta))];
    }

    function intensity(J) {
        return cabs2(J[0]) + cabs2(J[1]);
    }

    function stokesFromJones(J) {
        const [ex, ey] = J;
        const cross = cmul(cconj(ex), ey);
        return {
            S0: cabs2(ex) + cabs2(ey),
            S1: cabs2(ex) - cabs2(ey),
            S2: 2 * cross.re,
            S3: 2 * cross.im,
        };
    }



    function coherencyFromJones(J) {
        return [
            [cmul(J[0], cconj(J[0])), cmul(J[0], cconj(J[1]))],
            [cmul(J[1], cconj(J[0])), cmul(J[1], cconj(J[1]))],
        ];
    }


    function partiallyPolarized(J, p, I = 1) {
        const n = intensity(J) || 1;
        const Cp = coherencyFromJones(J);
        const out = [
            [c(0), c(0)],
            [c(0), c(0)]
        ];
        for (let i = 0; i < 2; i++) {
            for (let j = 0; j < 2; j++) {
                const pol = Cp[i][j];
                const unpol = i === j ? (1 - p) / 2 : 0;
                out[i][j] = c(I * (p * pol.re / n + unpol), I * p * pol.im / n);
            }
        }
        return out;
    }

    function stokesFromCoherency(C) {
        return {
            S0: C[0][0].re + C[1][1].re,
            S1: C[0][0].re - C[1][1].re,
            S2: 2 * C[1][0].re,
            S3: 2 * C[1][0].im,
        };
    }

    function applyToCoherency(M, C) {

        return matMul(matMul(M, C), dagger(M));
    }


    function matMul(A, B) {
        return [
            [cadd(cmul(A[0][0], B[0][0]), cmul(A[0][1], B[1][0])), cadd(cmul(A[0][0], B[0][1]), cmul(A[0][1], B[1][1]))],
            [cadd(cmul(A[1][0], B[0][0]), cmul(A[1][1], B[1][0])), cadd(cmul(A[1][0], B[0][1]), cmul(A[1][1], B[1][1]))],
        ];
    }

    function dagger(A) {
        return [
            [cconj(A[0][0]), cconj(A[1][0])],
            [cconj(A[0][1]), cconj(A[1][1])]
        ];
    }

    function applyJones(M, J) {
        return [
            cadd(cmul(M[0][0], J[0]), cmul(M[0][1], J[1])),
            cadd(cmul(M[1][0], J[0]), cmul(M[1][1], J[1])),
        ];
    }

    function rotation(theta) {
        const co = Math.cos(theta),
            s = Math.sin(theta);
        return [
            [c(co), c(s)],
            [c(-s), c(co)]
        ];
    }


    function rotatedDiagonal(a, b, theta) {
        return matMul(matMul(rotation(-theta), [
            [a, c(0)],
            [c(0), b]
        ]), rotation(theta));
    }

    function identity() {
        return [
            [c(1), c(0)],
            [c(0), c(1)]
        ];
    }


    function polarizer(theta) {
        return rotatedDiagonal(c(1), c(0), theta);
    }


    function retarder(retardance, theta) {
        return rotatedDiagonal(c(1), cexp(retardance), theta);
    }

    const halfWavePlate = (theta) => retarder(Math.PI, theta);
    const quarterWavePlate = (theta) => retarder(Math.PI / 2, theta);


    function birefringentRetardance(deltaN, thickness, wavelength) {
        return 2 * Math.PI * deltaN * thickness / wavelength;
    }


    function elementMatrix(type, theta, retardance) {
        switch (type) {
            case "polarizer":
                return polarizer(theta);
            case "hwp":
                return halfWavePlate(theta);
            case "qwp":
                return quarterWavePlate(theta);
            case "retarder":
                return retarder(retardance, theta);
            default:
                return identity();
        }
    }


    function rotator(rho) {
        const co = Math.cos(rho),
            s = Math.sin(rho);
        return [
            [c(co), c(-s)],
            [c(s), c(co)]
        ];
    }



    const S_KEYS = ["S0", "S1", "S2", "S3"];
    const toArr = (S) => [S.S0, S.S1, S.S2, S.S3];
    const toObj = (a) => ({
        S0: a[0],
        S1: a[1],
        S2: a[2],
        S3: a[3]
    });


    function stokesFromPsiDelta(psi, delta, p = 1, I = 1) {
        return {
            S0: I,
            S1: I * p * Math.cos(2 * psi),
            S2: I * p * Math.sin(2 * psi) * Math.cos(delta),
            S3: I * p * Math.sin(2 * psi) * Math.sin(delta),
        };
    }

    function mat4Mul(A, B) {
        const out = [];
        for (let i = 0; i < 4; i++) {
            out.push([0, 0, 0, 0]);
            for (let j = 0; j < 4; j++) {
                let s = 0;
                for (let k = 0; k < 4; k++) s += A[i][k] * B[k][j];
                out[i][j] = s;
            }
        }
        return out;
    }

    function applyMueller(M, S) {
        const a = toArr(S);
        return toObj(M.map((row) => row[0] * a[0] + row[1] * a[1] + row[2] * a[2] + row[3] * a[3]));
    }

    const mIdentity = () => [
        [1, 0, 0, 0],
        [0, 1, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1]
    ];


    function muellerFrame(theta) {
        const c2 = Math.cos(2 * theta),
            s2 = Math.sin(2 * theta);
        return [
            [1, 0, 0, 0],
            [0, c2, s2, 0],
            [0, -s2, c2, 0],
            [0, 0, 0, 1]
        ];
    }


    function muellerRotated(M0, theta) {
        return mat4Mul(mat4Mul(muellerFrame(-theta), M0), muellerFrame(theta));
    }


    function muellerPolarizer(theta) {
        return muellerRotated([
            [0.5, 0.5, 0, 0],
            [0.5, 0.5, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0]
        ], theta);
    }


    function muellerRetarder(retardance, theta) {
        const cg = Math.cos(retardance),
            sg = Math.sin(retardance);
        return muellerRotated([
            [1, 0, 0, 0],
            [0, 1, 0, 0],
            [0, 0, cg, -sg],
            [0, 0, sg, cg]
        ], theta);
    }


    function muellerRotator(rho) {
        const c2 = Math.cos(2 * rho),
            s2 = Math.sin(2 * rho);
        return [
            [1, 0, 0, 0],
            [0, c2, -s2, 0],
            [0, s2, c2, 0],
            [0, 0, 0, 1]
        ];
    }


    function muellerDepolarizer(D) {
        const a = 1 - D;
        return [
            [1, 0, 0, 0],
            [0, a, 0, 0],
            [0, 0, a, 0],
            [0, 0, 0, a]
        ];
    }


    const SIGMA = [
        [
            [c(1), c(0)],
            [c(0), c(1)]
        ],
        [
            [c(1), c(0)],
            [c(0), c(-1)]
        ],
        [
            [c(0), c(1)],
            [c(1), c(0)]
        ],
        [
            [c(0), c(0, -1)],
            [c(0, 1), c(0)]
        ],
    ];


    function muellerFromJones(J) {
        const Jd = dagger(J);
        const M = [];
        for (let i = 0; i < 4; i++) {
            M.push([0, 0, 0, 0]);
            for (let j = 0; j < 4; j++) {
                const P = matMul(matMul(matMul(SIGMA[i], J), SIGMA[j]), Jd);
                M[i][j] = 0.5 * (P[0][0].re + P[1][1].re);
            }
        }
        return M;
    }


    function jonesFromStokes(S) {
        const Sp = Math.hypot(S.S1, S.S2, S.S3);
        if (Sp <= EXACT_TOL) return [c(0), c(0)];
        const ax = Math.sqrt(Math.max(0, (Sp + S.S1) / 2));
        const ay = Math.sqrt(Math.max(0, (Sp - S.S1) / 2));
        const phi = Math.atan2(S.S3, S.S2);
        return [c(ax), cmul(c(ay), cexp(phi))];
    }



    const CRYSTALS = Object.freeze({
        quartz: Object.freeze({
            name: "Crystalline quartz",
            no: 1.5443,
            ne: 1.5534
        }),
        mgf2: Object.freeze({
            name: "Magnesium fluoride",
            no: 1.3777,
            ne: 1.3895
        }),
        sapphire: Object.freeze({
            name: "Sapphire",
            no: 1.7681,
            ne: 1.7599
        }),
        calcite: Object.freeze({
            name: "Calcite",
            no: 1.6584,
            ne: 1.4864
        }),
    });


    function plateGeometry(crystalKey, axisAngle, thickness, wavelength) {
        const cr = CRYSTALS[crystalKey] || CRYSTALS.quartz;
        const dn = cr.ne - cr.no;
        const positive = dn > 0;
        const fastAxis = positive ? axisAngle + Math.PI / 2 : axisAngle;
        const retardance = birefringentRetardance(Math.abs(dn), thickness, wavelength);
        const TWO_PI = 2 * Math.PI;
        return {
            crystal: crystalKey,
            name: cr.name,
            no: cr.no,
            ne: cr.ne,
            dn,
            positive,
            opticAxis: axisAngle,
            fastAxis,
            slowAxis: fastAxis + Math.PI / 2,
            fastRay: positive ? "o" : "e",
            slowRay: positive ? "e" : "o",
            nFast: Math.min(cr.no, cr.ne),
            nSlow: Math.max(cr.no, cr.ne),
            retardance,
            waves: retardance / TWO_PI,
            effectiveRetardance: ((retardance % TWO_PI) + TWO_PI) % TWO_PI,
            thickness,
            wavelength,
        };
    }


    function plateThicknessFor(crystalKey, retardance, wavelength, order = 0) {
        const cr = CRYSTALS[crystalKey] || CRYSTALS.quartz;
        return (retardance / (2 * Math.PI) + order) * wavelength / Math.abs(cr.ne - cr.no);
    }



    const ELEMENT_TYPES = ["polarizer", "hwp", "qwp", "retarder", "plate", "rotator", "depolarizer"];

    function elementRetarderParams(el, ctx = {}) {
        switch (el.type) {
            case "hwp":
                return {
                    retardance: Math.PI, fast: el.angle
                };
            case "qwp":
                return {
                    retardance: Math.PI / 2, fast: el.angle
                };
            case "retarder":
                return {
                    retardance: el.retardance, fast: el.angle
                };
            case "plate": {
                const g = plateGeometry(el.crystal, el.angle, el.thickness, ctx.wavelength || 589e-9);
                return {
                    retardance: g.retardance,
                    fast: g.fastAxis,
                    plate: g
                };
            }
            default:
                return null;
        }
    }


    function elementJones(el, ctx) {
        switch (el.type) {
            case "polarizer":
                return polarizer(el.angle);
            case "rotator":
                return rotator(el.rotation);
            case "depolarizer":
                return el.depolarization > 0 ? null : identity();
            case "none":
                return identity();
            default: {
                const r = elementRetarderParams(el, ctx);
                return r ? retarder(r.retardance, r.fast) : identity();
            }
        }
    }


    function elementMueller(el, ctx) {
        switch (el.type) {
            case "polarizer":
                return muellerPolarizer(el.angle);
            case "rotator":
                return muellerRotator(el.rotation);
            case "depolarizer":
                return muellerDepolarizer(el.depolarization);
            case "none":
                return mIdentity();
            default: {
                const r = elementRetarderParams(el, ctx);
                return r ? muellerRetarder(r.retardance, r.fast) : mIdentity();
            }
        }
    }


    function propagate(input, elements, ctx = {}, options = {}) {
        const p = input.dop == null ? 1 : input.dop;
        const I = input.I == null ? 1 : input.I;
        let S = stokesFromPsiDelta(input.psi, input.delta, p, I);
        let J = p >= 1 - EXACT_TOL ? jonesFromPsiDelta(input.psi, input.delta).map((z) => cmul(z, c(Math.sqrt(I)))) : null;
        const step0 = {
            S,
            J,
            desc: describeStokes(S, options),
            element: null,
            jones: null,
            mueller: null
        };
        const steps = [];
        for (const el of elements) {
            const mueller = elementMueller(el, ctx);
            const jones = elementJones(el, ctx);
            S = applyMueller(mueller, S);
            J = J && jones ? applyJones(jones, J) : null;
            steps.push({
                S,
                J,
                desc: describeStokes(S, options),
                element: el,
                jones,
                mueller
            });
        }
        return {
            input: step0,
            steps,
            output: steps.length ? steps[steps.length - 1] : step0
        };
    }


    function elementPath(el, S, ctx = {}, n = 48) {
        const pts = [];
        const r = elementRetarderParams(el, ctx);
        for (let i = 0; i <= n; i++) {
            const t = i / n;
            let M;
            if (r) {
                const g = ((r.retardance % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
                const gShort = g > Math.PI ? g - 2 * Math.PI : g;
                M = muellerRetarder(t * gShort, r.fast);
                pts.push(applyMueller(M, S));
            } else if (el.type === "rotator") {
                pts.push(applyMueller(muellerRotator(t * el.rotation), S));
            } else {
                const out = applyMueller(elementMueller(el, ctx), S);
                pts.push(toObj(toArr(S).map((v, k) => (1 - t) * v + t * toArr(out)[k])));
            }
        }
        return pts;
    }


    function describeStokes(S, options = {}) {
        const approxTolDeg = options.approxTolDeg ?? DEFAULT_APPROX_TOL_DEG;
        const exactTol = options.exactTol ?? EXACT_TOL;
        const Sp = Math.hypot(S.S1, S.S2, S.S3);
        const dop = S.S0 > exactTol ? Sp / S.S0 : 0;
        if (S.S0 <= exactTol) {
            return {
                S0: S.S0,
                S1: S.S1,
                S2: S.S2,
                S3: S.S3,
                dop: 0,
                orientation: NaN,
                ellipticity: NaN,
                handedness: "none",
                type: "none",
                exact: true
            };
        }
        if (Sp <= exactTol * S.S0) {
            return {
                S0: S.S0,
                S1: S.S1,
                S2: S.S2,
                S3: S.S3,
                dop: 0,
                orientation: NaN,
                ellipticity: NaN,
                handedness: "none",
                type: "unpolarized",
                exact: true
            };
        }
        const s1 = S.S1 / Sp,
            s2 = S.S2 / Sp,
            s3 = Math.max(-1, Math.min(1, S.S3 / Sp));
        const linearPart = Math.hypot(s1, s2);
        const orientation = linearPart > exactTol ? 0.5 * Math.atan2(s2, s1) : NaN;
        const ellipticity = 0.5 * Math.asin(s3);
        const chiDeg = Math.abs(ellipticity) * 180 / Math.PI;

        let type, exact;
        if (Math.abs(s3) <= exactTol) {
            type = "linear";
            exact = true;
        } else if (linearPart <= exactTol) {
            type = "circular";
            exact = true;
        } else if (chiDeg <= approxTolDeg) {
            type = "linear";
            exact = false;
        } else if (chiDeg >= 45 - approxTolDeg) {
            type = "circular";
            exact = false;
        } else {
            type = "elliptical";
            exact = true;
        }

        let handedness = "none";
        if (Math.abs(s3) > exactTol) handedness = s3 > 0 ? "right" : "left";

        return {
            S0: S.S0,
            S1: S.S1,
            S2: S.S2,
            S3: S.S3,
            dop,
            orientation,
            ellipticity,
            handedness,
            type,
            exact
        };
    }

    function describeJones(J, options) {
        return describeStokes(stokesFromJones(J), options);
    }


    function fieldAt(J, phase) {
        const e = cexp(phase);
        return {
            x: cmul(J[0], e).re,
            y: cmul(J[1], e).re
        };
    }

    return {
        EXACT_TOL,
        DEFAULT_APPROX_TOL_DEG,
        complex: {
            c,
            cadd,
            cmul,
            cconj,
            cabs2,
            cexp
        },
        jonesFromPsiDelta,
        intensity,
        stokesFromJones,
        coherencyFromJones,
        partiallyPolarized,
        stokesFromCoherency,
        applyToCoherency,
        matMul,
        dagger,
        applyJones,
        rotation,
        identity,
        polarizer,
        retarder,
        halfWavePlate,
        quarterWavePlate,
        birefringentRetardance,
        elementMatrix,
        describeStokes,
        describeJones,
        fieldAt,
        rotator,
        stokesFromPsiDelta,
        applyMueller,
        mat4Mul,
        muellerFrame,
        muellerPolarizer,
        muellerRetarder,
        muellerRotator,
        muellerDepolarizer,
        muellerFromJones,
        jonesFromStokes,
        CRYSTALS,
        plateGeometry,
        plateThicknessFor,
        ELEMENT_TYPES,
        elementRetarderParams,
        elementJones,
        elementMueller,
        propagate,
        elementPath,
    };
});