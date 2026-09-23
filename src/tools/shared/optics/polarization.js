/*
 * Polarization optics model (pure, DOM-free).
 *
 * Conventions
 * -----------
 * - Plane wave travelling along +z with complex field E(z, t) = Re{ J e^{i(kz - ωt)} }.
 * - Jones vector J = [Ex, Ey] (complex, each entry {re, im}). The input state used by the
 *   tool is J = [cos ψ, sin ψ e^{iδ}], so at z = 0:
 *       Ex(t) = cos ψ cos(ωt),   Ey(t) = sin ψ cos(ωt − δ).
 * - Stokes parameters (normalised to the input intensity where noted):
 *       S0 = |Ex|² + |Ey|²,  S1 = |Ex|² − |Ey|²,
 *       S2 = 2 Re(Ex* Ey),   S3 = 2 Im(Ex* Ey).
 * - Orientation θ = ½ atan2(S2, S1) ∈ (−90°, 90°], ellipticity χ = ½ asin(S3 / Sp) ∈ [−45°, 45°],
 *   with Sp = √(S1² + S2² + S3²) the polarized intensity.
 * - Handedness: S3 > 0 means the field vector rotates counter-clockwise for an observer looking
 *   toward the source (wave coming toward the viewer, x right, y up). This is positive helicity,
 *   called "right-handed" in the IEEE / helicity convention used by this tool. (Born & Wolf and
 *   Hecht call the same state "left-handed".)
 * - Retarders: phase e^{iΓ} is accumulated on the slow axis relative to the fast axis, fast axis at
 *   angle θ from +x. Global phase is dropped (it does not affect any observable here).
 * - Partial polarization: Stokes vectors + Mueller matrices (and coherency matrices C = <J J†>),
 *   S_i = tr(C σ_i). A Jones vector is only defined for fully polarized light.
 * - Rotator by ρ rotates every state by +ρ (x toward y); on the Poincaré sphere it is a rotation
 *   by 2ρ about S3. Retarders rotate the sphere by Γ about the fast-axis point (cos 2θ, sin 2θ, 0).
 */
(function(root, factory) {
    const m = factory();
    if (typeof module === "object" && module.exports) module.exports = m;
    else {
        root.OpticsModels = root.OpticsModels || {};
        root.OpticsModels.polarization = m;
    }
})(typeof self !== "undefined" ? self : this, function() {
    "use strict";

    // ---------- complex helpers ----------
    const c = (re, im = 0) => ({
        re,
        im
    });
    const cadd = (a, b) => c(a.re + b.re, a.im + b.im);
    const cmul = (a, b) => c(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
    const cconj = (a) => c(a.re, -a.im);
    const cabs2 = (a) => a.re * a.re + a.im * a.im;
    const cexp = (phi) => c(Math.cos(phi), Math.sin(phi));

    /** Default tolerances. EXACT_TOL is for floating-point round-off only. */
    const EXACT_TOL = 1e-9;
    const DEFAULT_APPROX_TOL_DEG = 2; // |χ| within 2° of 0 or of 45° is "approximately" linear/circular

    // ---------- states ----------
    /** Jones vector from auxiliary angle ψ (tan ψ = |Ey|/|Ex|) and phase δ = φy − φx (radians). */
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

    // ---------- coherency matrices (partial polarization) ----------
    /** Coherency matrix C = <J J†> for a pure Jones state. */
    function coherencyFromJones(J) {
        return [
            [cmul(J[0], cconj(J[0])), cmul(J[0], cconj(J[1]))],
            [cmul(J[1], cconj(J[0])), cmul(J[1], cconj(J[1]))],
        ];
    }

    /** Coherency matrix of intensity I with degree of polarization p, polarized part J (normalised). */
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
            S2: 2 * C[1][0].re, // Cyx = <Ey Ex*>, Re(Ex* Ey) = Re(Cyx)
            S3: 2 * C[1][0].im,
        };
    }

    function applyToCoherency(M, C) {
        // M C M†
        return matMul(matMul(M, C), dagger(M));
    }

    // ---------- Jones matrices ----------
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

    /** Element with eigen-axis at angle θ: R(−θ) · diag(a, b) · R(θ). */
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

    /** Ideal linear polarizer (or analyzer) with transmission axis at θ from +x. */
    function polarizer(theta) {
        return rotatedDiagonal(c(1), c(0), theta);
    }

    /** Ideal linear retarder, retardance Γ, fast axis at θ. */
    function retarder(retardance, theta) {
        return rotatedDiagonal(c(1), cexp(retardance), theta);
    }

    const halfWavePlate = (theta) => retarder(Math.PI, theta);
    const quarterWavePlate = (theta) => retarder(Math.PI / 2, theta);

    /** Retardance of a birefringent plate: Γ = 2π Δn d / λ (SI units). */
    function birefringentRetardance(deltaN, thickness, wavelength) {
        return 2 * Math.PI * deltaN * thickness / wavelength;
    }

    /** Build an element by type: "none" | "polarizer" | "hwp" | "qwp" | "retarder". */
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

    /** Optical rotator (optical activity / Faraday rotation): rotates every state by +ρ (x toward y). */
    function rotator(rho) {
        const co = Math.cos(rho),
            s = Math.sin(rho);
        return [
            [c(co), c(-s)],
            [c(s), c(co)]
        ];
    }

    // ---------- Stokes vectors and Mueller calculus ----------
    // Stokes vectors are objects {S0, S1, S2, S3}; Mueller matrices are real 4×4 arrays of rows.
    const S_KEYS = ["S0", "S1", "S2", "S3"];
    const toArr = (S) => [S.S0, S.S1, S.S2, S.S3];
    const toObj = (a) => ({
        S0: a[0],
        S1: a[1],
        S2: a[2],
        S3: a[3]
    });

    /** Stokes vector of intensity I, degree of polarization p, polarized part (cos ψ, sin ψ e^{iδ}). */
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

    /** Frame rotation for Stokes vectors (element axis at θ → x): (S1, S2) rotated by −2θ. */
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

    /** Rotated element: F(−θ) · M0 · F(θ). */
    function muellerRotated(M0, theta) {
        return mat4Mul(mat4Mul(muellerFrame(-theta), M0), muellerFrame(theta));
    }

    /** Ideal linear polarizer, transmission axis θ (closed form built in the element frame). */
    function muellerPolarizer(theta) {
        return muellerRotated([
            [0.5, 0.5, 0, 0],
            [0.5, 0.5, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0]
        ], theta);
    }

    /** Linear retarder, retardance Γ on the slow axis, fast axis θ: S2 + iS3 → e^{iΓ}(S2 + iS3) in its frame. */
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

    /** Rotator by ρ: rotation of (S1, S2) by 2ρ about the S3 axis. */
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

    /**
     * Ideal isotropic (partial) depolarizer: keeps S0, scales the polarized part by (1 − D).
     * D = 0 does nothing, D = 1 gives unpolarized light. Has no Jones matrix for D > 0.
     */
    function muellerDepolarizer(D) {
        const a = 1 - D;
        return [
            [1, 0, 0, 0],
            [0, a, 0, 0],
            [0, 0, a, 0],
            [0, 0, 0, a]
        ];
    }

    // Pauli-type basis matching this file's Stokes convention: S_i = tr(C σ_i), C = <J J†>.
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

    /** Mueller matrix of a (deterministic) Jones matrix: M_ij = ½ tr(σ_i J σ_j J†). */
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

    /** Polarized part of a Stokes vector as a Jones vector (global phase chosen so Ex is real ≥ 0). */
    function jonesFromStokes(S) {
        const Sp = Math.hypot(S.S1, S.S2, S.S3);
        if (Sp <= EXACT_TOL) return [c(0), c(0)];
        const ax = Math.sqrt(Math.max(0, (Sp + S.S1) / 2));
        const ay = Math.sqrt(Math.max(0, (Sp - S.S1) / 2));
        const phi = Math.atan2(S.S3, S.S2);
        return [c(ax), cmul(c(ay), cexp(phi))];
    }

    // ---------- birefringent crystals (uniaxial A-plates) ----------
    /**
     * Principal indices near 589 nm (Na D line), treated as wavelength-independent (dispersion
     * ignored). Δn = ne − no; positive uniaxial crystals have ne > no.
     */
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

    /**
     * Uniaxial A-plate at normal incidence: plate normal ∥ z (the propagation direction), optic
     * (c-)axis in the plate plane at angle α from +x. Light travels perpendicular to the optic axis,
     * so there is no walk-off. The e-wave has E ∥ c (index ne), the o-wave E ⊥ c (index no).
     * The fast axis is the lower-index one: ⊥ c for positive crystals, ∥ c for negative ones.
     * Returns SI/radian quantities; `retardance` is the full Γ = 2π|Δn|d/λ (not reduced mod 2π).
     */
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

    /** Thickness of the zero-order plate (order m adds m full waves) with retardance Γ. */
    function plateThicknessFor(crystalKey, retardance, wavelength, order = 0) {
        const cr = CRYSTALS[crystalKey] || CRYSTALS.quartz;
        return (retardance / (2 * Math.PI) + order) * wavelength / Math.abs(cr.ne - cr.no);
    }

    // ---------- ordered element bench ----------
    /**
     * Element descriptors (angles in radians, lengths in metres):
     *   { type: "polarizer", angle }            transmission axis
     *   { type: "hwp" | "qwp", angle }          fast axis
     *   { type: "retarder", angle, retardance } fast axis, Γ
     *   { type: "plate", angle, crystal, thickness }  angle = optic-axis direction α; uses ctx.wavelength
     *   { type: "rotator", rotation }           ρ
     *   { type: "depolarizer", depolarization } D ∈ [0, 1]
     * ctx = { wavelength } (m), needed only by "plate".
     */
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

    /** Jones matrix of an element, or null if it has none (depolarizer with D > 0). */
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

    /** Mueller matrix of an element (closed forms, independent of the Jones route). */
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

    /**
     * Propagate an input through an ordered list of elements (first element met first).
     * input = { psi, delta, dop = 1, I = 1 }. Stokes/Mueller carries every step; a Jones vector is
     * also propagated while the light is fully polarized and every element so far has a Jones matrix.
     * Returns { input: step0, steps: [...] }, each step { S, desc, J (or null), jones (or null), mueller, element }.
     */
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

    /**
     * Stokes vectors along the action of one element on S, for drawing its path on the Poincaré
     * sphere: retarders and rotators rotate the sphere (Γ taken mod 2π), a polarizer or depolarizer
     * is drawn as the straight Mueller interpolation (1 − t) S + t M S.
     */
    function elementPath(el, S, ctx = {}, n = 48) {
        const pts = [];
        const r = elementRetarderParams(el, ctx);
        for (let i = 0; i <= n; i++) {
            const t = i / n;
            let M;
            if (r) {
                const g = ((r.retardance % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
                const gShort = g > Math.PI ? g - 2 * Math.PI : g; // shorter way round
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

    // ---------- ellipse description and classification ----------
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

    /** Instantaneous real field at phase φ = kz − ωt: E = Re{J e^{iφ}}. */
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