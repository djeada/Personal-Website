/*
 * Geometrical optics / optical-system bench model (pure, DOM-free).
 *
 * Browser: <script src="../shared/optics/geometricOptics.js"></script> → window.OpticsModels.geometricOptics
 * Node:    const go = require(".../shared/optics/geometricOptics.js")
 *
 * Coordinates and sign convention (Cartesian, used everywhere in this file)
 * ------------------------------------------------------------------------
 *  - Optical axis z (metres), light enters travelling towards +z; meridional height y (metres),
 *    sagittal coordinate x (only used by skew rays for the spot diagram).
 *  - A surface radius R is positive when its centre of curvature lies to the RIGHT (+z) of its
 *    vertex; R = Infinity is a plane. This is the same for refracting surfaces and mirrors.
 *  - Paraxial rays are [y, θ] with θ = dy/ds the slope along the *unfolded* direction of travel
 *    (s increases along the ray; after a mirror s runs towards −z). Matrices act on column
 *    vectors and chain right-to-left (core.mat2.chain([M_last, …, M_first])).
 *      translate(t)          [[1, t], [0, 1]]
 *      refraction n1→n2, R   [[1, 0], [(n1 − n2)/(n2 R_u), n1/n2]]      det = n1/n2
 *      mirror, R             [[1, 0], [2/R_u, 1]]                      (concave: R_u < 0 → converging)
 *      ideal thin lens f     [[1, 0], [−1/f, 1]]
 *    R_u = R · dir where dir = ±1 is the travel direction along z at that surface.
 *  - Distances reported for imaging: object distance s_o = z_first − z_object (> 0 for a real
 *    object to the left), image distance s_i measured from the LAST surface along the outgoing
 *    direction (> 0 real image, < 0 virtual image), transverse magnification m = h'/h.
 *    Thin lens f = 100 mm, s_o = 300 mm → s_i = +150 mm, m = −0.5 (Gaussian 1/s_o + 1/s_i = 1/f).
 *  - Exact rays are traced sequentially (surface order = element order) with vector Snell's law,
 *    vector reflection and total-internal-reflection detection. The ideal thin lens is modelled
 *    as a perfect "paraxial lens": (dx/ds, dy/ds) → (dx/ds − x/f, dy/ds − y/f), which images every
 *    ray of every conjugate perfectly and therefore has no aberrations.
 *  - Wavelengths are vacuum wavelengths in metres. Materials: constant index, Cauchy
 *    n = A + B/λ² + C/λ⁴ (λ in µm) or Sellmeier n² = 1 + Σ Bᵢλ²/(λ² − Cᵢ) (λ in µm, Cᵢ in µm²).
 */
(function(root, factory) {
    const m = factory();
    if (typeof module === "object" && module.exports) module.exports = m;
    else {
        root.OpticsModels = root.OpticsModels || {};
        root.OpticsModels.geometricOptics = m;
    }
})(typeof self !== "undefined" ? self : this, function() {
    "use strict";

    // ------------------------------------------------------------------ materials
    /** Fraunhofer lines (vacuum wavelengths, m). */
    const LINES = Object.freeze({
        F: 486.1327e-9,
        d: 587.5618e-9,
        C: 656.2725e-9,
        e: 546.074e-9
    });

    const MATERIALS = {
        air: {
            name: "Air (n = 1)",
            type: "constant",
            n: 1
        },
        water: {
            name: "Water (Cauchy fit)",
            type: "cauchy",
            A: 1.3242,
            B: 0.00306,
            C: 0
        },
        // Schott N-BK7 and F2 Sellmeier coefficients (Schott optical glass data sheets)
        BK7: {
            name: "N-BK7 crown (Sellmeier)",
            type: "sellmeier",
            B: [1.03961212, 0.231792344, 1.01046945],
            C: [0.00600069867, 0.0200179144, 103.560653]
        },
        F2: {
            name: "F2 flint (Sellmeier)",
            type: "sellmeier",
            B: [1.34533359, 0.209073176, 0.937357162],
            C: [0.00997743871, 0.0470450767, 111.886764]
        },
        BK7c: {
            name: "BK7, 2-term Cauchy fit",
            type: "cauchy",
            A: 1.5046,
            B: 0.00420,
            C: 0
        }
    };

    function resolveMaterial(mat) {
        if (mat == null) return MATERIALS.air;
        if (typeof mat === "number") return {
            type: "constant",
            n: mat
        };
        if (typeof mat === "string") {
            if (MATERIALS[mat]) return MATERIALS[mat];
            const n = Number(mat);
            if (Number.isFinite(n) && n >= 1) return {
                type: "constant",
                n
            };
            throw new RangeError("unknown material " + mat);
        }
        return mat;
    }

    /** Refractive index of a material (name, number or descriptor) at vacuum wavelength λ (m). */
    function refractiveIndex(mat, lambda = LINES.d) {
        const m = resolveMaterial(mat);
        const um = lambda * 1e6,
            l2 = um * um;
        if (m.type === "constant") return m.n;
        if (m.type === "cauchy") return m.A + m.B / l2 + (m.C || 0) / (l2 * l2);
        if (m.type === "sellmeier") {
            let s = 1;
            for (let i = 0; i < m.B.length; i++) s += m.B[i] * l2 / (l2 - m.C[i]);
            return Math.sqrt(s);
        }
        throw new RangeError("bad material type");
    }

    /** Abbe number V_d = (n_d − 1)/(n_F − n_C); Infinity for a non-dispersive material. */
    function abbeNumber(mat) {
        const nd = refractiveIndex(mat, LINES.d),
            nF = refractiveIndex(mat, LINES.F),
            nC = refractiveIndex(mat, LINES.C);
        return nF === nC ? Infinity : (nd - 1) / (nF - nC);
    }

    // ------------------------------------------------------------------ 2×2 matrices [y, θ]
    const mul = (A, B) => [
        [A[0][0] * B[0][0] + A[0][1] * B[1][0], A[0][0] * B[0][1] + A[0][1] * B[1][1]],
        [A[1][0] * B[0][0] + A[1][1] * B[1][0], A[1][0] * B[0][1] + A[1][1] * B[1][1]]
    ];
    const det = (M) => M[0][0] * M[1][1] - M[0][1] * M[1][0];
    const apply = (M, v) => [M[0][0] * v[0] + M[0][1] * v[1], M[1][0] * v[0] + M[1][1] * v[1]];
    const I2 = () => [
        [1, 0],
        [0, 1]
    ];
    const inv = (x) => (Number.isFinite(x) && x !== 0 ? 1 / x : 0); // 1/∞ = 0 (plane / no power)

    const translate = (t) => [
        [1, t],
        [0, 1]
    ];
    const refractMatrix = (n1, n2, Ru) => [
        [1, 0],
        [(n1 - n2) * inv(Ru) / n2, n1 / n2]
    ];
    const mirrorMatrix = (Ru) => [
        [1, 0],
        [2 * inv(Ru), 1]
    ];
    const thinLensMatrix = (f) => [
        [1, 0],
        [-inv(f), 1]
    ];

    /** Gaussian thin-lens imaging (real object distance so > 0 on the left). Robust at so = f. */
    function thinLensImage(f, so) {
        // 1/so + 1/si = 1/f  →  si = so f / (so − f); written to avoid division blow-up
        const den = so - f;
        if (Math.abs(den) <= 1e-12 * Math.max(Math.abs(so), Math.abs(f))) {
            return {
                si: Infinity,
                m: NaN,
                atInfinity: true,
                virtual: false,
                angularSizePerHeight: -1 / f
            };
        }
        const si = so * f / den;
        return {
            si,
            m: -si / so,
            atInfinity: false,
            virtual: si < 0,
            vergenceOut: 1 / si
        };
    }

    // ------------------------------------------------------------------ system construction
    /**
     * Build a sequential system from bench elements (all lengths in metres):
     *   {type:"thin", z, f, semi, material?}   ideal thin lens; with a glass material its focal
     *                                            length scales as f(λ) = f·(n_d − 1)/(n(λ) − 1)
     *   {type:"lens", z, R1, R2, t, material, semi}   thick lens: two spherical/planar surfaces
     *   {type:"surface", z, R, material, semi}  single refracting surface into `material`
     *   {type:"mirror", z, R, semi}              spherical (or plane) mirror
     *   {type:"stop", z, semi}                   aperture (iris)
     *   {type:"detector", z, semi}               detector / screen (transparent in sequential mode)
     * opts.medium: object-space medium (default air). Elements are used in the given order.
     */
    function buildSystem(elements, opts = {}) {
        let medium = opts.medium || "air";
        const surfaces = [];
        const objectMedium = medium;
        const semiOf = (el) => (el.semi == null || !(el.semi > 0) ? Infinity : el.semi);
        (elements || []).forEach((el, idx) => {
            const base = {
                element: idx,
                id: el.id != null ? el.id : idx,
                semi: semiOf(el),
                z: el.z
            };
            switch (el.type) {
                case "thin":
                    surfaces.push(Object.assign(base, {
                        kind: "thin",
                        f: el.f,
                        material: el.material || null,
                        mediumAfter: medium
                    }));
                    break;
                case "lens":
                    surfaces.push(Object.assign({}, base, {
                        kind: "refract",
                        R: el.R1,
                        mediumAfter: el.material || "BK7",
                        part: 1
                    }));
                    surfaces.push(Object.assign({}, base, {
                        kind: "refract",
                        z: el.z + el.t,
                        R: el.R2,
                        mediumAfter: medium,
                        part: 2
                    }));
                    break;
                case "surface":
                    medium = el.material || "air";
                    surfaces.push(Object.assign(base, {
                        kind: "refract",
                        R: el.R,
                        mediumAfter: medium
                    }));
                    break;
                case "mirror":
                    surfaces.push(Object.assign(base, {
                        kind: "mirror",
                        R: el.R,
                        mediumAfter: medium
                    }));
                    break;
                case "stop":
                    surfaces.push(Object.assign(base, {
                        kind: "stop",
                        mediumAfter: medium
                    }));
                    break;
                case "detector":
                    surfaces.push(Object.assign(base, {
                        kind: "detector",
                        mediumAfter: medium
                    }));
                    break;
                default:
                    throw new RangeError("unknown element type " + el.type);
            }
        });
        // travel direction after each surface (+1 → +z)
        let dir = 1;
        for (const s of surfaces) {
            s.dirIn = dir;
            if (s.kind === "mirror") dir = -dir;
            s.dirOut = dir;
        }
        // reference (image-space) surface: the last surface with optical power or reflection
        let kRef = surfaces.length - 1;
        for (let k = surfaces.length - 1; k >= 0; k--) {
            if (surfaces[k].kind === "refract" || surfaces[k].kind === "mirror" || surfaces[k].kind === "thin") {
                kRef = k;
                break;
            }
        }
        return {
            surfaces,
            objectMedium,
            elements: elements || [],
            dirOut: dir,
            kRef
        };
    }

    /** Per-wavelength indices and the thin-lens focal length at λ. */
    function indicesAt(sys, lambda) {
        let n = refractiveIndex(sys.objectMedium, lambda);
        const nObj = n;
        const out = sys.surfaces.map((s) => {
            const nBefore = n;
            const nAfter = s.kind === "refract" ? refractiveIndex(s.mediumAfter, lambda) : nBefore;
            n = nAfter;
            let f = s.f;
            if (s.kind === "thin" && s.material && Number.isFinite(f)) {
                const nd = refractiveIndex(s.material, LINES.d),
                    nl = refractiveIndex(s.material, lambda);
                f = f * (nd - 1) / (nl - 1);
            }
            return {
                nBefore,
                nAfter,
                f
            };
        });
        return {
            nObj,
            nImg: n,
            list: out
        };
    }

    /** Paraxial matrix of surface k alone (acting at its vertex plane). */
    function surfaceMatrix(s, ix) {
        switch (s.kind) {
            case "refract":
                return refractMatrix(ix.nBefore, ix.nAfter, s.R * s.dirIn);
            case "mirror":
                return mirrorMatrix(s.R * s.dirIn);
            case "thin":
                return thinLensMatrix(ix.f);
            default:
                return I2();
        }
    }

    /** Unfolded gap from surface k−1 to surface k (k ≥ 1). */
    const gapBefore = (sys, k) => (sys.surfaces[k].z - sys.surfaces[k - 1].z) * sys.surfaces[k - 1].dirOut;

    /**
     * Paraxial matrices at λ: `pre[k]` maps [y, θ] at the first vertex plane (just before the
     * first surface) to just BEFORE surface k; `post[k]` to just AFTER it; `M` = post[last].
     */
    function paraxialMatrices(sys, lambda = LINES.d) {
        const ix = indicesAt(sys, lambda);
        const pre = [],
            post = [];
        let M = I2();
        sys.surfaces.forEach((s, k) => {
            if (k > 0) M = mul(translate(gapBefore(sys, k)), M);
            pre.push(M);
            M = mul(surfaceMatrix(s, ix.list[k]), M);
            post.push(M);
        });
        const kRef = sys.kRef != null ? sys.kRef : sys.surfaces.length - 1;
        return {
            pre,
            post,
            M: post[kRef],
            nObj: ix.nObj,
            nImg: ix.list[kRef].nAfter,
            ix,
            kRef
        };
    }

    /** Matrix mapping just after surface a to just after surface b (a < b); a = −1 → from first vertex plane. */
    function matrixBetween(sys, pm, a, b) {
        let M = I2();
        for (let k = a + 1; k <= b; k++) {
            if (k > 0) M = mul(translate(gapBefore(sys, k)), M);
            M = mul(surfaceMatrix(sys.surfaces[k], pm.ix.list[k]), M);
        }
        return M;
    }

    /** Paraxial trace of [y, θ] given just before the first surface. Returns per-surface heights. */
    function paraxialTrace(sys, y0, th0, lambda = LINES.d) {
        const pm = paraxialMatrices(sys, lambda);
        return sys.surfaces.map((s, k) => {
            const before = apply(pm.pre[k], [y0, th0]);
            const after = apply(pm.post[k], [y0, th0]);
            return {
                z: s.z,
                y: before[0],
                thetaIn: before[1],
                thetaOut: after[1],
                dirIn: s.dirIn,
                dirOut: s.dirOut
            };
        });
    }

    const first = (sys) => sys.surfaces[0];
    const last = (sys) => sys.surfaces[sys.kRef != null ? sys.kRef : sys.surfaces.length - 1];
    /** Physical z of a point at unfolded distance d after the last surface. */
    const zAfterLast = (sys, d) => last(sys).z + sys.dirOut * d;

    // ------------------------------------------------------------------ cardinal points
    /**
     * Cardinal points at λ. Uses the reduced matrix [y, nθ]; power P = −C_r. Positions are physical
     * z (m). Returns { afocal, power, efl (1/P), fFront (n/P), fRear (n'/P), zF, zFp, zH, zHp, zN,
     * zNp, bfd, ffd, M, Mr, nObj, nImg, angularMagnification (afocal only) }.
     */
    function cardinalPoints(sys, lambda = LINES.d) {
        const pm = paraxialMatrices(sys, lambda);
        const [
            [A, B],
            [C, D]
        ] = pm.M;
        const n1 = pm.nObj,
            n2 = pm.nImg;
        const Mr = [
            [A, B / n1],
            [n2 * C, n2 * D / n1]
        ];
        const P = -Mr[1][0];
        const zf = first(sys).z;
        const scale = Math.max(1e-3, Math.abs(last(sys).z - zf) + Math.abs(B));
        const out = {
            M: pm.M,
            Mr,
            nObj: n1,
            nImg: n2,
            power: P,
            det: det(pm.M)
        };
        if (Math.abs(P) * scale < 1e-9) {
            // afocal (telescopic): no finite focal points; angular magnification D (for n1 = n2 in θ units)
            return Object.assign(out, {
                afocal: true,
                efl: Infinity,
                angularMagnification: D
            });
        }
        const Ar = Mr[0][0],
            Dr = Mr[1][1];
        const dFp = n2 * Ar / P,
            dHp = n2 * (Ar - 1) / P;
        const xF = -n1 * Dr / P,
            xH = n1 * (1 - Dr) / P;
        const shiftN = (n2 - n1) / P;
        return Object.assign(out, {
            afocal: false,
            efl: 1 / P,
            fFront: n1 / P,
            fRear: n2 / P,
            zF: zf + xF,
            zH: zf + xH,
            zN: zf + xH + shiftN,
            zFp: zAfterLast(sys, dFp),
            zHp: zAfterLast(sys, dHp),
            zNp: zAfterLast(sys, dHp + shiftN),
            bfd: dFp,
            ffd: -xF
        });
    }

    // ------------------------------------------------------------------ imaging
    const INF_LIMIT = 1e4; // |s_i| beyond 10 km is reported as "at infinity"

    /**
     * Paraxial image of an object. obj = { z, h } (finite, object space) or { atInfinity: true,
     * angle } (field angle in rad). Returns { atInfinity, virtual, si (unfolded from the last
     * surface), zImage, m, hImage, angularOut (rad per object, for images at infinity),
     * so (object distance), afocal }.
     */
    function imageOf(sys, obj, lambda = LINES.d) {
        const pm = paraxialMatrices(sys, lambda);
        const M = pm.M;
        const dt = det(M);
        if (obj.atInfinity) {
            const [
                [A],
                [C, D]
            ] = [M[0], M[1]];
            const alpha = Math.tan(obj.angle || 0);
            if (Math.abs(C) < 1e-12 || Math.abs(A / C) > INF_LIMIT) {
                return {
                    atInfinity: true,
                    afocal: true,
                    virtual: false,
                    si: Infinity,
                    zImage: NaN,
                    m: NaN,
                    hImage: NaN,
                    angularOut: D * alpha,
                    angularMagnification: D
                };
            }
            const si = -A / C;
            const hImage = -dt / C * alpha;
            return {
                atInfinity: false,
                afocal: false,
                virtual: si < 0,
                si,
                zImage: zAfterLast(sys, si),
                m: NaN,
                hImage,
                so: Infinity
            };
        }
        const so = first(sys).z - obj.z;
        const Mo = mul(M, translate(so));
        const b = Mo[0][1],
            d = Mo[1][1],
            c = Mo[1][0];
        // image where T(si)·Mo has B = 0 → si = −b/d; m = det/d
        if (d === 0 || Math.abs(b) > INF_LIMIT * Math.abs(d)) {
            return {
                atInfinity: true,
                afocal: false,
                virtual: false,
                si: Infinity,
                zImage: NaN,
                m: NaN,
                hImage: NaN,
                so,
                angularOut: c * obj.h // every ray from the object top leaves with this slope
            };
        }
        const si = -b / d;
        const m = det(Mo) / d;
        return {
            atInfinity: false,
            virtual: si < 0,
            si,
            zImage: zAfterLast(sys, si),
            m,
            hImage: m * obj.h,
            so
        };
    }

    // ------------------------------------------------------------------ stops, pupils, NA
    /**
     * Aperture stop, field stop, entrance/exit pupils and numerical apertures (paraxial).
     * The aperture stop is the surface that limits the axial marginal ray first; the field stop
     * limits the chief ray (through the stop centre) first. The detector counts only as a field
     * stop candidate.
     */
    function stopsAndPupils(sys, obj, lambda = LINES.d) {
        const pm = paraxialMatrices(sys, lambda);
        const S = sys.surfaces;
        const so = obj.atInfinity ? Infinity : first(sys).z - obj.z;
        const zf = first(sys).z;
        // unit marginal ray from the axial object point: finite [so, 1]; infinity [1, 0]
        const mIn = obj.atInfinity ? [1, 0] : [so, 1];
        let stop = -1,
            best = Infinity;
        S.forEach((s, k) => {
            if (s.kind === "detector" || !Number.isFinite(s.semi)) return;
            const y = Math.abs(apply(pm.pre[k], mIn)[0]);
            const r = y > 0 ? s.semi / y : Infinity;
            if (r < best) {
                best = r;
                stop = k;
            }
        });
        const res = {
            stop,
            stopId: stop >= 0 ? S[stop].id : null,
            nObj: pm.nObj,
            nImg: pm.nImg
        };
        if (stop < 0) return Object.assign(res, {
            unlimited: true,
            fieldStop: -1
        });
        const Ms = pm.pre[stop];
        const semi = S[stop].semi;
        // entrance pupil: image of the stop in object space
        if (Math.abs(Ms[0][0]) < 1e-12) Object.assign(res, {
            epAtInfinity: true,
            zEP: Infinity,
            rEP: Infinity
        });
        else Object.assign(res, {
            epAtInfinity: false,
            zEP: zf + Ms[0][1] / Ms[0][0],
            rEP: semi / Math.abs(Ms[0][0])
        });
        // exit pupil: image of the stop in image space (matrix from just before the stop to after the last surface)
        const Ma = mul(pm.M, inverse2(Ms));
        const b = Ma[0][1],
            d = Ma[1][1];
        if (Math.abs(d) < 1e-12 || Math.abs(b / d) > INF_LIMIT) Object.assign(res, {
            xpAtInfinity: true,
            zXP: NaN,
            rXP: Infinity,
            dXP: Infinity
        });
        else {
            const dXP = -b / d;
            Object.assign(res, {
                xpAtInfinity: false,
                dXP,
                zXP: zAfterLast(sys, dXP),
                rXP: semi * Math.abs(det(Ma) / d)
            });
        }
        // marginal ray scaled to fill the stop
        const marginIn = [mIn[0] * best, mIn[1] * best];
        const marginOut = apply(pm.M, marginIn);
        res.marginalIn = marginIn;
        res.naObject = obj.atInfinity ? 0 : pm.nObj * Math.sin(Math.atan(Math.abs(marginIn[1])));
        res.naImage = pm.nImg * Math.sin(Math.atan(Math.abs(marginOut[1])));
        res.fNumberWorking = res.naImage > 0 ? 1 / (2 * res.naImage) : Infinity;
        res.beamRadiusIn = obj.atInfinity ? marginIn[0] : NaN;
        // chief ray (through stop centre), unit field: finite → per unit object height; infinity → per unit slope
        let chiefIn;
        if (res.epAtInfinity) chiefIn = obj.atInfinity ? null : [1, 0];
        else if (obj.atInfinity) chiefIn = [(zf - res.zEP) * 1, 1]; // slope 1 through the EP centre
        else {
            const th = -1 / (res.zEP - obj.z); // from (z_o, 1) towards (z_EP, 0)
            chiefIn = [1 + th * so, th];
        }
        res.chiefIn = chiefIn;
        let fs = -1,
            bestF = Infinity;
        if (chiefIn) {
            S.forEach((s, k) => {
                if (k === stop || !Number.isFinite(s.semi)) return;
                const y = Math.abs(apply(pm.pre[k], chiefIn)[0]);
                const r = y > 1e-15 ? s.semi / y : Infinity;
                if (r < bestF) {
                    bestF = r;
                    fs = k;
                }
            });
        }
        res.fieldStop = fs;
        res.fieldStopId = fs >= 0 ? S[fs].id : null;
        // field limit (chief ray at the field-stop edge ⇒ 50 % vignetting): object height (m) or tan(angle)
        res.fieldLimit = bestF;
        return res;
    }

    function inverse2(M) {
        const d = det(M);
        return [
            [M[1][1] / d, -M[0][1] / d],
            [-M[1][0] / d, M[0][0] / d]
        ];
    }

    // ------------------------------------------------------------------ exact ray tracing (3D)
    const norm3 = (v) => {
        const l = Math.hypot(v[0], v[1], v[2]);
        return [v[0] / l, v[1] / l, v[2] / l];
    };
    const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

    /**
     * Intersection parameter of ray p + t d with the surface through vertex z (curvature cv = 1/R).
     * Uses the numerically stable vertex-side root (reduces smoothly to the plane when cv → 0).
     * Returns NaN when the ray misses the sphere.
     */
    function intersect(p, d, zv, cv) {
        const q = [p[0], p[1], p[2] - zv];
        const B = cv * dot3(q, d) - d[2];
        const Cq = cv * dot3(q, q) - 2 * q[2];
        if (cv === 0) return B === 0 ? NaN : -Cq / (2 * B);
        const disc = B * B - cv * Cq;
        if (disc < 0) return NaN;
        const qq = -(B + (B >= 0 ? 1 : -1) * Math.sqrt(disc));
        const roots = [qq / cv];
        if (qq !== 0) roots.push(Cq / qq);
        // keep the root(s) on the hemisphere that contains the vertex (cv·z_local < 1)
        const ok = roots.filter((t) => Number.isFinite(t) && cv * (q[2] + t * d[2]) < 1);
        if (!ok.length) return NaN;
        if (ok.length === 1) return ok[0];
        // both on the vertex cap (grazing chord): the first one reached, preferring forward travel
        const fwd = ok.filter((t) => t >= 0);
        return fwd.length ? Math.min(...fwd) : Math.max(...ok);
    }

    /**
     * Trace one exact ray. ray = { p: [x, y, z], d: [dx, dy, dz] } in object space.
     * Returns { points: [[x,y,z], …] (start + every surface hit), status: "ok" | "vignetted" |
     * "missed" | "tir", at: surface index where it stopped (or −1), p, d (final, after the last
     * surface), n (final index), opl (Σ n·t, m), virtualSegments: indices of segments with t < 0 }.
     */
    function traceExact(sys, ray, lambda = LINES.d, opts = {}) {
        const ix = opts.ix || indicesAt(sys, lambda);
        let p = ray.p.slice(),
            d = norm3(ray.d);
        const points = [p.slice()];
        const virtualSegments = [];
        let opl = 0,
            n = ix.nObj;
        const S = sys.surfaces;
        const clip = opts.clip !== false;
        for (let k = 0; k < S.length; k++) {
            const s = S[k],
                sx = ix.list[k];
            const cv = s.kind === "refract" || s.kind === "mirror" ? inv(s.R) : 0;
            const t = intersect(p, d, s.z, cv);
            if (!Number.isFinite(t)) return {
                points,
                status: "missed",
                at: k,
                p,
                d,
                n,
                opl,
                virtualSegments
            };
            p = [p[0] + t * d[0], p[1] + t * d[1], p[2] + t * d[2]];
            if (t < 0) virtualSegments.push(points.length - 1);
            points.push(p.slice());
            opl += n * t;
            const r = Math.hypot(p[0], p[1]);
            if (clip && r > s.semi * (1 + 1e-12)) return {
                points,
                status: "vignetted",
                at: k,
                p,
                d,
                n,
                opl,
                virtualSegments
            };
            if (s.kind === "stop" || s.kind === "detector") continue;
            if (s.kind === "thin") {
                const dz = d[2],
                    sg = dz >= 0 ? 1 : -1;
                const f = sx.f;
                const sxp = d[0] / Math.abs(dz) - p[0] * inv(f),
                    syp = d[1] / Math.abs(dz) - p[1] * inv(f);
                d = norm3([sxp, syp, sg]);
                continue;
            }
            // surface normal ∝ (cv x, cv y, cv z_local − 1), oriented against the incoming ray
            let N = norm3([cv * p[0], cv * p[1], cv * (p[2] - s.z) - 1]);
            if (dot3(N, d) > 0) N = [-N[0], -N[1], -N[2]];
            const cosi = -dot3(N, d);
            if (s.kind === "mirror") {
                d = norm3([d[0] + 2 * cosi * N[0], d[1] + 2 * cosi * N[1], d[2] + 2 * cosi * N[2]]);
                continue;
            }
            const eta = sx.nBefore / sx.nAfter;
            const kk = 1 - eta * eta * (1 - cosi * cosi);
            if (kk < 0) {
                const dr = norm3([d[0] + 2 * cosi * N[0], d[1] + 2 * cosi * N[1], d[2] + 2 * cosi * N[2]]);
                return {
                    points,
                    status: "tir",
                    at: k,
                    p,
                    d: dr,
                    n,
                    opl,
                    virtualSegments
                };
            }
            const c2 = eta * cosi - Math.sqrt(kk);
            d = norm3([eta * d[0] + c2 * N[0], eta * d[1] + c2 * N[1], eta * d[2] + c2 * N[2]]);
            n = sx.nAfter;
        }
        return {
            points,
            status: "ok",
            at: -1,
            p,
            d,
            n,
            opl,
            virtualSegments
        };
    }

    /** Point where a traced ray (final p, d) crosses the plane z = zPlane; null if parallel. */
    function atPlane(tr, zPlane) {
        if (Math.abs(tr.d[2]) < 1e-15) return null;
        const t = (zPlane - tr.p[2]) / tr.d[2];
        return [tr.p[0] + t * tr.d[0], tr.p[1] + t * tr.d[1], zPlane, t];
    }

    /** Axial crossing z of a meridional ray (y = 0) after the last surface; NaN if parallel to the axis. */
    function axialCrossing(tr) {
        if (Math.abs(tr.d[1]) < 1e-15) return NaN;
        return tr.p[2] - tr.p[1] / tr.d[1] * tr.d[2];
    }

    /** Object-space ray from a field point through an object-space point on plane zAim at (xa, ya). */
    function objectRay(sys, obj, xa, ya, zAim, zStart) {
        if (obj.atInfinity) {
            const a = obj.angle || 0;
            const dirv = [0, Math.sin(a), Math.cos(a)];
            const dz = zStart - zAim; // negative
            return {
                p: [xa, ya + Math.tan(a) * dz, zStart],
                d: dirv
            };
        }
        return {
            p: [0, obj.h, obj.z],
            d: norm3([xa, ya - obj.h, zAim - obj.z])
        };
    }

    /** Where to aim rays in object space: the paraxial entrance pupil, or the first surface. */
    function aimPlane(sys, obj, lambda) {
        const sp = stopsAndPupils(sys, obj, lambda);
        const f0 = first(sys);
        const firstSemi = Number.isFinite(f0.semi) ? f0.semi : 0.0125;
        if (sp.stop < 0 || sp.epAtInfinity || !Number.isFinite(sp.zEP) || (!obj.atInfinity && Math.abs(sp.zEP - obj.z) < 1e-9)) {
            return {
                z: f0.z,
                r: firstSemi,
                sp
            };
        }
        return {
            z: sp.zEP,
            r: sp.rEP,
            sp
        };
    }

    function startZ(sys, obj) {
        if (!obj.atInfinity) return obj.z;
        const zs = sys.surfaces.map((s) => s.z);
        const span = Math.max(0.02, Math.max(...zs) - Math.min(...zs));
        return Math.min(...zs) - 0.35 * span - 0.02;
    }

    /**
     * Aim an exact meridional ray so it crosses surface `k` at height yTarget (secant iteration on
     * the object-space aim height). Returns { ray, trace, ya, converged }.
     */
    function aimRay(sys, obj, k, yTarget, lambda = LINES.d, guess) {
        const ix = indicesAt(sys, lambda);
        const ap = aimPlane(sys, obj, lambda);
        const z0 = startZ(sys, obj);
        const heightAt = (ya) => {
            const tr = traceExact({
                surfaces: sys.surfaces.slice(0, k + 1),
                objectMedium: sys.objectMedium
            }, objectRay(sys, obj, 0, ya, ap.z, z0), lambda, {
                ix: {
                    nObj: ix.nObj,
                    list: ix.list.slice(0, k + 1)
                }
            });
            return tr.status === "ok" ? tr.p[1] - yTarget : NaN;
        };
        const secant = (xa, xb) => {
            let x0 = xa,
                f0 = heightAt(x0),
                x1 = xb,
                f1 = heightAt(x1);
            for (let i = 0; i < 40 && Number.isFinite(f0) && Number.isFinite(f1); i++) {
                if (Math.abs(f1) < 1e-13 || f1 === f0) break;
                const x2 = x1 - f1 * (x1 - x0) / (f1 - f0);
                x0 = x1;
                f0 = f1;
                x1 = x2;
                f1 = heightAt(x1);
            }
            return {
                x: x1,
                ok: Number.isFinite(f1) && Math.abs(f1) < 1e-10
            };
        };
        let sol = secant(guess != null ? guess : 0, (guess || 0) + Math.max(1e-6, ap.r * 0.05));
        if (!sol.ok) {
            // robust fallback: scan outward from the paraxial aim for the nearest sign change, then Illinois regula falsi
            const semis = sys.surfaces.slice(0, k + 1).map((s) => s.semi).filter(Number.isFinite);
            const slope = obj.atInfinity ? Math.abs(Math.tan(obj.angle || 0)) : Math.abs(obj.h) / Math.max(1e-6, Math.abs(first(sys).z - obj.z));
            const W = 2 * (semis.length ? Math.max(...semis) : 0.05) + ap.r + Math.abs(ap.z - first(sys).z) * slope;
            const N = 60,
                xs = [],
                fs = [];
            for (let i = -N; i <= N; i++) {
                xs.push(W * i / N);
                fs.push(heightAt(W * i / N));
            }
            let bestPair = null;
            for (let i = 0; i < xs.length - 1; i++) {
                if (Number.isFinite(fs[i]) && Number.isFinite(fs[i + 1]) && fs[i] * fs[i + 1] <= 0) {
                    const dist = Math.min(Math.abs(xs[i]), Math.abs(xs[i + 1]));
                    if (!bestPair || dist < bestPair.dist) bestPair = {
                        a: xs[i],
                        b: xs[i + 1],
                        fa: fs[i],
                        fb: fs[i + 1],
                        dist
                    };
                }
            }
            if (bestPair) {
                let {
                    a,
                    b,
                    fa,
                    fb
                } = bestPair, side = 0, x = a;
                for (let i = 0; i < 100; i++) {
                    x = fb === fa ? (a + b) / 2 : (a * fb - b * fa) / (fb - fa);
                    const fx = heightAt(x);
                    if (!Number.isFinite(fx)) {
                        x = (a + b) / 2;
                        break;
                    }
                    if (Math.abs(fx) < 1e-13) break;
                    if (fx * fb > 0) {
                        b = x;
                        fb = fx;
                        if (side === -1) fa /= 2;
                        side = -1;
                    } else {
                        a = x;
                        fa = fx;
                        if (side === 1) fb /= 2;
                        side = 1;
                    }
                }
                const fx = heightAt(x);
                sol = {
                    x,
                    ok: Number.isFinite(fx) && Math.abs(fx) < 1e-10
                };
            }
        }
        const x1 = sol.x,
            converged = sol.ok;
        const ray = objectRay(sys, obj, 0, x1, ap.z, z0);
        return {
            ray,
            trace: traceExact(sys, ray, lambda, {
                ix
            }),
            ya: x1,
            converged,
            aimZ: ap.z
        };
    }

    /** Meridional fan: n rays filling the (paraxial) entrance pupil. Returns traces. */
    function rayFan(sys, obj, n = 9, lambda = LINES.d, opts = {}) {
        const ix = indicesAt(sys, lambda);
        const ap = aimPlane(sys, obj, lambda);
        const z0 = startZ(sys, obj);
        const fill = opts.fill || 1;
        const out = [];
        for (let i = 0; i < n; i++) {
            const rho = n === 1 ? 0 : -1 + 2 * i / (n - 1);
            const ray = objectRay(sys, obj, 0, rho * ap.r * fill, ap.z, z0);
            const tr = traceExact(sys, ray, lambda, {
                ix
            });
            tr.rho = rho;
            out.push(tr);
        }
        return out;
    }

    // ------------------------------------------------------------------ aberration analysis
    /** Reference image plane (physical z) at λ for the object, or null when the image is at infinity. */
    function referencePlane(sys, obj, lambda) {
        const im = imageOf(sys, obj, lambda);
        return im.atInfinity ? null : im.zImage;
    }

    /**
     * Longitudinal aberration of meridional rays from the axial object point.
     * Returns for each λ: { lambda, rho: [...], dz: [...] (m, along the outgoing direction,
     * relative to the paraxial image at lambdaRef), paraxial: Δz of the paraxial image at λ }.
     */
    function longitudinalAberration(sys, obj, lambdas = [LINES.d], opts = {}) {
        const n = opts.n || 41;
        const lambdaRef = opts.lambdaRef || LINES.d;
        const axial = obj.atInfinity ? {
            atInfinity: true,
            angle: 0
        } : {
            z: obj.z,
            h: 0
        };
        const zRef = referencePlane(sys, axial, lambdaRef);
        if (zRef == null) return {
            afocal: true,
            curves: []
        };
        const ap = aimPlane(sys, axial, lambdaRef);
        const z0 = startZ(sys, axial);
        const curves = lambdas.map((lambda) => {
            const ix = indicesAt(sys, lambda);
            const rho = [],
                dz = [];
            for (let i = 0; i < n; i++) {
                const r = (opts.rhoMin || 0.02) + (1 - (opts.rhoMin || 0.02)) * i / (n - 1);
                const tr = traceExact(sys, objectRay(sys, axial, 0, r * ap.r, ap.z, z0), lambda, {
                    ix
                });
                rho.push(r);
                dz.push(tr.status === "ok" ? (axialCrossing(tr) - zRef) * sys.dirOut : NaN);
            }
            const zp = referencePlane(sys, axial, lambda);
            return {
                lambda,
                rho,
                dz,
                paraxial: zp == null ? NaN : (zp - zRef) * sys.dirOut
            };
        });
        return {
            afocal: false,
            zRef,
            curves,
            pupilRadius: ap.r
        };
    }

    /**
     * Exact vs paraxial comparison for meridional rays from the axial object point at pupil
     * fractions ρ. Finite image: Δz = exact axial crossing − paraxial image (along the outgoing
     * direction). Image at infinity (afocal or object at the front focus): Δslope = exact
     * outgoing tan(u′) − paraxial outgoing slope. Both → 0 as ρ → 0.
     */
    function exactVsParaxial(sys, obj, rhos, lambda = LINES.d) {
        const axial = obj.atInfinity ? {
            atInfinity: true,
            angle: 0
        } : {
            z: obj.z,
            h: 0
        };
        const im = imageOf(sys, axial, lambda);
        const ap = aimPlane(sys, axial, lambda);
        const z0 = startZ(sys, axial);
        const pm = paraxialMatrices(sys, lambda);
        const ix = indicesAt(sys, lambda);
        const zf = first(sys).z;
        return {
            imageAtInfinity: im.atInfinity,
            pupilRadius: ap.r,
            rows: rhos.map((rho) => {
                const ya = rho * ap.r;
                const ray = objectRay(sys, axial, 0, ya, ap.z, z0);
                const tr = traceExact(sys, ray, lambda, {
                    ix
                });
                const th0 = ray.d[1] / ray.d[2];
                const yin = obj.atInfinity ? ya : th0 * (zf - axial.z);
                const out = apply(pm.M, [yin, th0]);
                if (tr.status !== "ok") return {
                    rho,
                    height: yin,
                    status: tr.status,
                    delta: NaN
                };
                if (im.atInfinity) {
                    return {
                        rho,
                        height: yin,
                        status: "ok",
                        delta: tr.d[1] / Math.abs(tr.d[2]) - out[1],
                        kind: "slope"
                    };
                }
                return {
                    rho,
                    height: yin,
                    status: "ok",
                    delta: (axialCrossing(tr) - im.zImage) * sys.dirOut,
                    kind: "dz"
                };
            })
        };
    }

    /**
     * Chief-ray distortion vs field. obj gives the full field (h or angle); fields are fractions.
     * Distortion = (y_real − y_paraxial)/y_paraxial on the paraxial image plane; for an image at
     * infinity it compares tangents of the outgoing chief-ray angle instead.
     */
    function distortion(sys, obj, fractions, lambda = LINES.d) {
        const sp = stopsAndPupils(sys, obj, lambda);
        const im = imageOf(sys, obj.atInfinity ? {
            atInfinity: true,
            angle: 0
        } : {
            z: obj.z,
            h: 0
        }, lambda);
        const pm = paraxialMatrices(sys, lambda);
        const res = [];
        for (const fr of fractions) {
            const o = obj.atInfinity ? {
                atInfinity: true,
                angle: (obj.angle || 0) * fr
            } : {
                z: obj.z,
                h: obj.h * fr
            };
            if (sp.stop < 0 || fr === 0) {
                res.push({
                    fraction: fr,
                    distortion: NaN
                });
                continue;
            }
            const aim = aimRay(sys, o, sp.stop, 0, lambda);
            if (aim.trace.status !== "ok" || !aim.converged) {
                res.push({
                    fraction: fr,
                    distortion: NaN
                });
                continue;
            }
            // paraxial chief ray at the same field (linear in h or tan α)
            let parIn;
            if (sp.chiefIn) parIn = obj.atInfinity ? [sp.chiefIn[0] * Math.tan(o.angle), sp.chiefIn[1] * Math.tan(o.angle)] : [sp.chiefIn[0] * o.h, sp.chiefIn[1] * o.h];
            else {
                res.push({
                    fraction: fr,
                    distortion: NaN
                });
                continue;
            }
            const parOut = apply(pm.M, parIn);
            let real, par;
            if (!im.atInfinity) {
                const hit = atPlane(aim.trace, im.zImage);
                real = hit ? hit[1] : NaN;
                par = parOut[0] + parOut[1] * im.si;
            } else {
                real = aim.trace.d[1] / Math.abs(aim.trace.d[2]);
                par = parOut[1];
            }
            res.push({
                fraction: fr,
                distortion: (real - par) / par,
                yReal: real,
                yParaxial: par
            });
        }
        return {
            points: res,
            imageAtInfinity: im.atInfinity
        };
    }

    /** Intersection of two 2D lines (z, y) given point+direction. Returns z or NaN. */
    function crossZ(p1, d1, p2, d2) {
        const den = d1[2] * d2[1] - d1[1] * d2[2];
        if (Math.abs(den) < 1e-18) return NaN;
        const t = ((p2[2] - p1[2]) * d2[1] - (p2[1] - p1[1]) * d2[2]) / den;
        return p1[2] + t * d1[2];
    }

    /**
     * Tangential and sagittal focus (field curvature and astigmatism) from pairs of rays
     * infinitesimally displaced from the exact chief ray. Δz relative to the paraxial image plane,
     * measured along the outgoing direction. NaN when the image is at infinity.
     */
    function fieldCurves(sys, obj, fractions, lambda = LINES.d) {
        const sp = stopsAndPupils(sys, obj, lambda);
        const im = imageOf(sys, obj.atInfinity ? {
            atInfinity: true,
            angle: 0
        } : {
            z: obj.z,
            h: 0
        }, lambda);
        const ix = indicesAt(sys, lambda);
        const out = [];
        if (im.atInfinity || sp.stop < 0) return {
            imageAtInfinity: im.atInfinity,
            points: fractions.map((f) => ({
                fraction: f,
                dzT: NaN,
                dzS: NaN
            }))
        };
        const ap = aimPlane(sys, obj, lambda);
        const eps = Math.max(1e-7, 1e-4 * ap.r);
        for (const fr of fractions) {
            const o = obj.atInfinity ? {
                atInfinity: true,
                angle: (obj.angle || 0) * fr
            } : {
                z: obj.z,
                h: obj.h * fr
            };
            const aim = fr === 0 ? null : aimRay(sys, o, sp.stop, 0, lambda);
            const ya = aim ? aim.ya : 0;
            const z0 = startZ(sys, o);
            const tr = (xa, yv) => traceExact(sys, objectRay(sys, o, xa, yv, ap.z, z0), lambda, {
                ix,
                clip: false
            });
            const tu = tr(0, ya + eps),
                td = tr(0, ya - eps),
                ts = tr(eps, ya),
                tsm = tr(-eps, ya);
            if ([tu, td, ts, tsm].some((t) => t.status !== "ok")) {
                out.push({
                    fraction: fr,
                    dzT: NaN,
                    dzS: NaN
                });
                continue;
            }
            const zT = crossZ(tu.p, tu.d, td.p, td.d);
            // sagittal pair crosses the meridional plane x = 0 symmetrically
            const zS1 = Math.abs(ts.d[0]) > 1e-18 ? ts.p[2] - ts.p[0] / ts.d[0] * ts.d[2] : NaN;
            const zS2 = Math.abs(tsm.d[0]) > 1e-18 ? tsm.p[2] - tsm.p[0] / tsm.d[0] * tsm.d[2] : NaN;
            const zS = (zS1 + zS2) / 2;
            out.push({
                fraction: fr,
                dzT: (zT - im.zImage) * sys.dirOut,
                dzS: (zS - im.zImage) * sys.dirOut
            });
        }
        return {
            imageAtInfinity: false,
            points: out,
            zImage: im.zImage
        };
    }

    /**
     * Spot diagram with skew rays over a hexapolar pupil grid (3D exact trace of the rotationally
     * symmetric system). Returns positions relative to the reference-λ chief ray on plane zPlane
     * (metres) or, in "angle" mode (image at infinity), outgoing slopes relative to the chief ray.
     */
    function spotDiagram(sys, obj, opts = {}) {
        const lambdas = opts.lambdas || [LINES.d];
        const lambdaRef = opts.lambdaRef || lambdas[0];
        const rings = opts.rings || 6;
        const sp = stopsAndPupils(sys, obj, lambdaRef);
        const ap = aimPlane(sys, obj, lambdaRef);
        const im = imageOf(sys, obj, lambdaRef);
        const mode = opts.mode || (im.atInfinity ? "angle" : "plane"); // virtual images: plane behind the system (rays extended backwards)
        const zPlane = opts.zPlane != null ? opts.zPlane : im.zImage;
        const z0 = startZ(sys, obj);
        // centre the pupil grid on the exact chief ray's crossing of the aim plane
        let yc = 0;
        if (sp.stop >= 0 && ((obj.atInfinity && obj.angle) || (!obj.atInfinity && obj.h))) {
            const aim = aimRay(sys, obj, sp.stop, 0, lambdaRef);
            if (aim.converged) yc = aim.ya;
        }
        const pupil = [
            [0, 0]
        ];
        for (let r = 1; r <= rings; r++) {
            const nr = 6 * r;
            for (let j = 0; j < nr; j++) {
                const a = 2 * Math.PI * j / nr;
                pupil.push([(r / rings) * Math.sin(a), (r / rings) * Math.cos(a)]);
            }
        }
        const measure = (tr) => {
            if (tr.status !== "ok") return null;
            if (mode === "angle") return [tr.d[0] / Math.abs(tr.d[2]), tr.d[1] / Math.abs(tr.d[2])];
            const h = atPlane(tr, zPlane);
            return h ? [h[0], h[1]] : null;
        };
        const chief = measure(traceExact(sys, objectRay(sys, obj, 0, yc, ap.z, z0), lambdaRef, {
            clip: false
        }));
        const ref = chief || [0, 0];
        const points = [];
        let total = 0,
            lost = 0;
        for (const lambda of lambdas) {
            const ix = indicesAt(sys, lambda);
            for (const [px, py] of pupil) {
                total++;
                const m = measure(traceExact(sys, objectRay(sys, obj, px * ap.r, yc + py * ap.r, ap.z, z0), lambda, {
                    ix
                }));
                if (!m) {
                    lost++;
                    continue;
                }
                points.push({
                    x: m[0] - ref[0],
                    y: m[1] - ref[1],
                    lambda
                });
            }
        }
        let cx = 0,
            cy = 0;
        points.forEach((p) => {
            cx += p.x;
            cy += p.y;
        });
        cx /= points.length || 1;
        cy /= points.length || 1;
        let s2 = 0;
        points.forEach((p) => {
            s2 += (p.x - cx) ** 2 + (p.y - cy) ** 2;
        });
        const rms = points.length ? Math.sqrt(s2 / points.length) : NaN;
        return {
            mode,
            zPlane,
            points,
            rms,
            centroid: [cx, cy],
            vignetted: total ? lost / total : 0,
            chief: ref,
            rays: total
        };
    }

    /** Best-focus plane (minimum RMS spot for the reference λ) found by golden-section search around zGuess. */
    function bestFocus(sys, obj, zGuess, range, opts = {}) {
        const f = (z) => spotDiagram(sys, obj, Object.assign({}, opts, {
            zPlane: z,
            mode: "plane"
        })).rms;
        let a = zGuess - range,
            b = zGuess + range;
        const g = (Math.sqrt(5) - 1) / 2;
        let c = b - g * (b - a),
            d = a + g * (b - a),
            fc = f(c),
            fd = f(d);
        for (let i = 0; i < 50; i++) {
            if (fc < fd) {
                b = d;
                d = c;
                fd = fc;
                c = b - g * (b - a);
                fc = f(c);
            } else {
                a = c;
                c = d;
                fc = fd;
                d = a + g * (b - a);
                fd = f(d);
            }
        }
        const z = (a + b) / 2;
        return {
            z,
            rms: f(z)
        };
    }

    /** Airy (diffraction-limited) spot: first dark ring radius 0.61 λ/NA, diameter 1.22 λ/NA. */
    const J1_ZERO = 3.8317059702075125; // first zero of J1: Airy radius = j11/(2π) · λ/NA ≈ 0.610 λ/NA
    function airy(lambda, na) {
        if (!(na > 0)) return {
            radius: Infinity,
            diameter: Infinity
        };
        const r = J1_ZERO / (2 * Math.PI) * lambda / na;
        return {
            radius: r,
            diameter: 2 * r
        };
    }

    // ------------------------------------------------------------------ presets (lengths in metres)
    const mm = 1e-3;
    const PRESETS = {
        single: {
            label: "Single lens (f = 100 mm)",
            expect: "Object 300 mm in front of an ideal f = 100 mm lens: real, inverted image 150 mm behind it, m = −0.5.",
            object: {
                dist: 300 * mm,
                h: 10 * mm,
                atInfinity: false,
                angle: 0
            },
            elements: [{
                    type: "thin",
                    z: 0,
                    f: 100 * mm,
                    semi: 20 * mm
                },
                {
                    type: "detector",
                    z: 150 * mm,
                    semi: 15 * mm
                }
            ]
        },
        magnifier: {
            label: "Magnifier",
            expect: "Object inside the focal length (35 mm, f = 50 mm): virtual, upright image 116.7 mm in front of the lens, m = +3.33.",
            object: {
                dist: 35 * mm,
                h: 4 * mm,
                atInfinity: false,
                angle: 0
            },
            elements: [{
                    type: "thin",
                    z: 0,
                    f: 50 * mm,
                    semi: 15 * mm
                },
                {
                    type: "stop",
                    z: 15 * mm,
                    semi: 3 * mm,
                    name: "eye pupil"
                },
                {
                    type: "detector",
                    z: 40 * mm,
                    semi: 12 * mm
                }
            ]
        },
        kepler: {
            label: "Keplerian telescope",
            expect: "Afocal: parallel light in, parallel light out. Angular magnification −f₁/f₂ = −4; exit pupil 62.5 mm behind the eyepiece with radius 25/4 mm.",
            object: {
                dist: 1000 * mm,
                h: 0,
                atInfinity: true,
                angle: 1
            },
            elements: [{
                    type: "thin",
                    z: 0,
                    f: 200 * mm,
                    semi: 25 * mm
                },
                {
                    type: "thin",
                    z: 250 * mm,
                    f: 50 * mm,
                    semi: 12 * mm
                },
                {
                    type: "detector",
                    z: 312.5 * mm,
                    semi: 10 * mm
                }
            ]
        },
        galilean: {
            label: "Galilean telescope",
            expect: "Afocal with a negative eyepiece: angular magnification +f₁/|f₂| = +4 (upright image); the tube is f₁ − |f₂| = 150 mm long.",
            object: {
                dist: 1000 * mm,
                h: 0,
                atInfinity: true,
                angle: 1
            },
            elements: [{
                    type: "thin",
                    z: 0,
                    f: 200 * mm,
                    semi: 25 * mm
                },
                {
                    type: "thin",
                    z: 150 * mm,
                    f: -50 * mm,
                    semi: 10 * mm
                },
                {
                    type: "stop",
                    z: 165 * mm,
                    semi: 3 * mm,
                    name: "eye pupil"
                },
                {
                    type: "detector",
                    z: 185 * mm,
                    semi: 10 * mm
                }
            ]
        },
        microscope: {
            label: "Compound microscope",
            expect: "Objective f = 16 mm with the object at 18 mm forms an intermediate image at 144 mm (m = −8); the eyepiece (f = 25 mm) puts the final image at infinity: overall magnification ≈ −8 × 250/25 = −80.",
            object: {
                dist: 18 * mm,
                h: 0.5 * mm,
                atInfinity: false,
                angle: 0
            },
            elements: [{
                    type: "thin",
                    z: 0,
                    f: 16 * mm,
                    semi: 5 * mm
                },
                {
                    type: "stop",
                    z: 144 * mm,
                    semi: 6 * mm,
                    name: "field stop"
                },
                {
                    type: "thin",
                    z: 169 * mm,
                    f: 25 * mm,
                    semi: 12 * mm
                },
                {
                    type: "detector",
                    z: 200 * mm,
                    semi: 10 * mm
                }
            ]
        },
        thick: {
            label: "Thick BK7 lens",
            expect: "Equiconvex N-BK7 lens (R = ±60 mm, t = 12 mm): EFL ≈ 60.1 mm, principal planes inside the glass ≈ 4.1 mm from each vertex; marginal rays focus short of the paraxial focus (undercorrected spherical aberration).",
            object: {
                dist: 1000 * mm,
                h: 0,
                atInfinity: true,
                angle: 2
            },
            elements: [{
                    type: "lens",
                    z: 0,
                    R1: 60 * mm,
                    R2: -60 * mm,
                    t: 12 * mm,
                    material: "BK7",
                    semi: 20 * mm
                },
                {
                    type: "detector",
                    z: 63 * mm,
                    semi: 10 * mm
                }
            ]
        },
        achromat: {
            label: "BK7/F2 achromat",
            expect: "Cemented crown–flint doublet (f ≈ 100 mm): the F and C foci almost coincide — compare its chromatic focal shift with the thick BK7 singlet.",
            object: {
                dist: 1000 * mm,
                h: 0,
                atInfinity: true,
                angle: 2
            },
            elements: [{
                    type: "surface",
                    z: 0,
                    R: 44.77 * mm,
                    material: "BK7",
                    semi: 15 * mm
                },
                {
                    type: "surface",
                    z: 8 * mm,
                    R: -44.77 * mm,
                    material: "F2",
                    semi: 15 * mm
                },
                {
                    type: "surface",
                    z: 11 * mm,
                    R: -809 * mm,
                    material: "air",
                    semi: 15 * mm
                },
                {
                    type: "detector",
                    z: 102.1 * mm,
                    semi: 10 * mm
                }
            ]
        },
        mirror: {
            label: "Concave mirror",
            expect: "Concave mirror R = −200 mm (f = 100 mm) with the object at 300 mm: real inverted image 150 mm in front of the mirror, m = −0.5.",
            object: {
                dist: 300 * mm,
                h: 10 * mm,
                atInfinity: false,
                angle: 0
            },
            elements: [{
                    type: "mirror",
                    z: 0,
                    R: -200 * mm,
                    semi: 30 * mm
                },
                {
                    type: "detector",
                    z: -150 * mm,
                    semi: 15 * mm
                }
            ]
        },
        surface: {
            label: "Refracting surface",
            expect: "Air → water surface (R = +50 mm): a distant object is imaged inside the water at n′R/(n′ − 1) ≈ 200 mm; f = R/(n′ − 1) ≈ 150 mm and f′ = n′f differ because the media differ, and the nodal point sits at the centre of curvature.",
            object: {
                dist: 1000 * mm,
                h: 0,
                atInfinity: true,
                angle: 3
            },
            elements: [{
                    type: "surface",
                    z: 0,
                    R: 50 * mm,
                    material: "water",
                    semi: 20 * mm
                },
                {
                    type: "detector",
                    z: 200 * mm,
                    semi: 15 * mm
                }
            ]
        },
        tir: {
            label: "Strong lens: TIR at the edge",
            expect: "Plano-convex N-BK7 lens used flat side first (R₂ = −12 mm): rays higher than R₂·n_air/n ≈ 7.9 mm meet the back surface beyond the critical angle (≈ 41°) and are totally internally reflected.",
            object: {
                dist: 1000 * mm,
                h: 0,
                atInfinity: true,
                angle: 0
            },
            elements: [{
                    type: "lens",
                    z: 0,
                    R1: Infinity,
                    R2: -12 * mm,
                    t: 10 * mm,
                    material: "BK7",
                    semi: 11.5 * mm
                },
                {
                    type: "detector",
                    z: 33 * mm,
                    semi: 8 * mm
                }
            ]
        }
    };

    return {
        LINES,
        MATERIALS,
        refractiveIndex,
        abbeNumber,
        matrices: {
            translate,
            refract: refractMatrix,
            mirror: mirrorMatrix,
            thinLens: thinLensMatrix,
            mul,
            det,
            apply
        },
        thinLensImage,
        buildSystem,
        indicesAt,
        paraxialMatrices,
        paraxialTrace,
        matrixBetween,
        cardinalPoints,
        imageOf,
        stopsAndPupils,
        intersect,
        traceExact,
        atPlane,
        axialCrossing,
        objectRay,
        aimRay,
        rayFan,
        aimPlane,
        startZ,
        longitudinalAberration,
        exactVsParaxial,
        distortion,
        fieldCurves,
        spotDiagram,
        bestFocus,
        airy,
        PRESETS
    };
});