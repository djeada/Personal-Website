/*
 * Radiometry, throughput and detection model (pure, DOM-free).
 *
 * Browser: <script src="../shared/optics/radiometry.js"></script> → window.OpticsModels.radiometry
 * Node:    const R = require(".../shared/optics/radiometry.js")
 *
 * All quantities are SI: W, m, s, sr, rad. Radiance L in W m⁻² sr⁻¹ is the radiance in the medium
 * where it is quoted (index n); the basic (reduced) radiance is L/n².
 *
 * Contents
 * --------
 *  photonEnergy, photonRate, responsivity, expectedCounts, countDimensions (dimensional check)
 *  solidAngleCone, projectedSolidAngleCone
 *  Lambertian disk: lambertOnAxisIrradiance (analytic πL sin²θ), lambertOnAxisIrradianceNumeric
 *      (adaptive angular integral), lambertIrradianceAt (numerical angular integration for any
 *      receiver point), diskViewFactor (analytic coaxial disk → disk), diskToDiskPowerNumeric
 *  pointIrradianceAt, gaussianIrradianceAt, gaussianApertureFraction, gaussianBeamRadius
 *  airyEncircledEnergy, rayleighResolution, fresnelNormalReflectance, thinLensImaging
 *  radianceAlongRay (n² law with explicit transmissions)
 *  experiment(params): the source → aperture → lens → filter → detector power budget
 *  snr, simulateCounts (seeded), sampleStats, histogramEdges, histogram, countDistribution
 *  V1924 table (CIE 1924 photopic luminous efficiency), luminousEfficiency, luminousFlux
 */
(function(root, factory) {
    const core = (typeof require === "function" && typeof module === "object") ? require("./core.js") : root.OpticsModels.core;
    const m = factory(core);
    if (typeof module === "object" && module.exports) module.exports = m;
    else {
        root.OpticsModels = root.OpticsModels || {};
        root.OpticsModels.radiometry = m;
    }
})(typeof self !== "undefined" ? self : this, function(core) {
    "use strict";

    const {
        h,
        c,
        e: qe
    } = core.constants;

    // ------------------------------------------------------------------ photons and detectors
    /** Photon energy hc/λ0 (J) for vacuum wavelength λ0 (m). */
    const photonEnergy = (lambda0) => h * c / lambda0;
    /** Photon arrival rate (photons/s) carried by monochromatic power P (W). */
    const photonRate = (P, lambda0) => P * lambda0 / (h * c);
    /** Current responsivity R = η q λ0/(hc) in A/W. */
    const responsivity = (eta, lambda0) => eta * qe * lambda0 / (h * c);
    /** Mean detected photoelectrons N = η P t λ0/(hc). */
    function expectedCounts({
        power,
        eta = 1,
        time,
        lambda0
    }) {
        return eta * power * time * lambda0 / (h * c);
    }

    // Dimensional analysis in base SI exponents [kg, m, s, A].
    const DIM = Object.freeze({
        W: [1, 2, -3, 0],
        s: [0, 0, 1, 0],
        m: [0, 1, 0, 0],
        J_s: [1, 2, -1, 0],
        m_per_s: [0, 1, -1, 0],
        C: [0, 0, 1, 1],
        one: [0, 0, 0, 0],
        A_per_W: [-1, -2, 3, 1]
    });
    const dimMul = (...ds) => ds.reduce((acc, d) => acc.map((v, i) => v + d[i]), [0, 0, 0, 0]);
    const dimInv = (d) => d.map((v) => -v);
    /** Exponents of N = η P t λ0/(hc): must be all zero (a pure number). */
    function countDimensions() {
        return dimMul(DIM.one, DIM.W, DIM.s, DIM.m, dimInv(DIM.J_s), dimInv(DIM.m_per_s));
    }
    /** Exponents of η q λ0/(hc): must equal A/W. */
    function responsivityDimensions() {
        return dimMul(DIM.C, DIM.m, dimInv(DIM.J_s), dimInv(DIM.m_per_s));
    }

    // ------------------------------------------------------------------ solid angles
    /** Solid angle of a cone of half-angle θ: Ω = 2π(1 − cos θ) sr. */
    const solidAngleCone = (theta) => 2 * Math.PI * (1 - Math.cos(theta));
    /** Projected solid angle ∫cosθ dΩ of a cone: π sin²θ sr. */
    const projectedSolidAngleCone = (theta) => Math.PI * Math.sin(theta) ** 2;

    // ------------------------------------------------------------------ Lambertian disk source
    /** On-axis irradiance at distance d from a Lambertian disk (radius a, radiance L): E = πL sin²θ. */
    function lambertOnAxisIrradiance(L, a, d) {
        return Math.PI * L * a * a / (a * a + d * d);
    }
    /** Same quantity by adaptive quadrature of E = ∫ L cosθ dΩ = 2πL ∫₀^θmax cosθ sinθ dθ. */
    function lambertOnAxisIrradianceNumeric(L, a, d, tol = 1e-13) {
        const thMax = Math.atan2(a, d);
        return 2 * Math.PI * L * core.integrateAdaptive((t) => Math.cos(t) * Math.sin(t), 0, thMax, tol);
    }

    /**
     * Irradiance at a receiver point a radial distance rho off-axis, on a plane parallel to a
     * Lambertian disk (radius a, radiance L) at separation d, by numerical angular integration:
     * E = ∫∫ L cosθ sinθ dθ dφ over the directions that hit the disk. For each azimuth φ the ray
     * footprint t = d tanθ on the source plane lies in [t1, t2] (a chord of the disk), so the θ
     * integral is done in closed form (½[sin²θ]) and the φ integral numerically (adaptive Simpson).
     */
    function lambertIrradianceAt(L, a, d, rho, relTol = 1e-10) {
        rho = Math.abs(rho);
        const s2 = (t) => (t * t) / (t * t + d * d);
        const f = (phi) => {
            const cp = Math.cos(phi),
                sp = Math.sin(phi);
            const disc = a * a - rho * rho * sp * sp;
            if (disc <= 0) return 0;
            const r = Math.sqrt(disc);
            const t2 = -rho * cp + r,
                t1 = Math.max(0, -rho * cp - r);
            if (t2 <= 0) return 0;
            return s2(t2) - s2(t1);
        };
        // only azimuths within asin(a/ρ) of φ = π hit the disk when ρ ≥ a; integrate that wedge only
        const lo = rho < a ? 0 : Math.PI - Math.asin(Math.min(1, a / rho));
        // integrateAdaptive takes an absolute tolerance: scale it by a coarse Simpson estimate
        const coarse = Math.abs(core.simpson(f, lo, Math.PI, 64)) || 1e-300;
        const integral = core.integrateAdaptive(f, lo, Math.PI, relTol * coarse);
        return L * integral; // (L/2) × 2 (φ ∈ [0, π] doubled by symmetry)
    }

    /**
     * Configuration (view) factor from a disk of radius a to a coaxial parallel disk of radius b at
     * separation d (analytic; Howell's catalogue of configuration factors, disk to parallel coaxial disk). Fraction of the Lambertian source's
     * hemispherical flux πLA₁ that lands on the receiver.
     */
    function diskViewFactor(a, b, d) {
        const R1 = a / d,
            R2 = b / d;
        const X = 1 + (1 + R2 * R2) / (R1 * R1);
        const q2 = (R2 / R1) ** 2;
        // ½[X − √(X² − 4q²)] written without the catastrophic cancellation for small sources
        return 2 * q2 / (X + Math.sqrt(Math.max(0, X * X - 4 * q2)));
    }
    /** Analytic power from a Lambertian disk (radius a, radiance L) onto a coaxial disk (radius b, distance d). */
    function lambertDiskToDiskPower(L, a, b, d) {
        return Math.PI * L * Math.PI * a * a * diskViewFactor(a, b, d);
    }
    /**
     * Numerical cross-check: P = ∫₀ᵇ E(ρ) 2πρ dρ with E(ρ) from lambertIrradianceAt (Simpson, the
     * range split at ρ = a where E has a kink).
     */
    function diskToDiskPowerNumeric(L, a, b, d, n = 200) {
        const g = (rho) => lambertIrradianceAt(L, a, d, rho, 1e-11) * 2 * Math.PI * rho;
        if (b <= a) return core.simpson(g, 0, b, n);
        return core.simpson(g, 0, a, n) + core.simpson(g, a, b, n);
    }

    // ------------------------------------------------------------------ point source and laser
    /** Irradiance on a plane at distance d from an isotropic point source of intensity I: I cos³θ/d². */
    function pointIrradianceAt(I, d, rho) {
        return I * d / Math.pow(d * d + rho * rho, 1.5);
    }
    /** Gaussian beam (power P, 1/e² radius w) irradiance at radius rho. */
    function gaussianIrradianceAt(P, w, rho) {
        return 2 * P / (Math.PI * w * w) * Math.exp(-2 * rho * rho / (w * w));
    }
    /** Fraction of a centred Gaussian beam (1/e² radius w) passing a circular aperture of radius R. */
    const gaussianApertureFraction = (R, w) => 1 - Math.exp(-2 * R * R / (w * w));
    /** 1/e² radius at distance z from the waist w0 in index n. */
    function gaussianBeamRadius(w0, z, lambda0, n = 1) {
        const zR = Math.PI * n * w0 * w0 / lambda0;
        return w0 * Math.sqrt(1 + (z / zR) ** 2);
    }

    // ------------------------------------------------------------------ imaging
    /** Fraction of an aberration-free Airy pattern inside radius r: 1 − J0²(v) − J1²(v), v = 2π NA r/λ0. */
    function airyEncircledEnergy(r, lambda0, NA) {
        const v = 2 * Math.PI * NA * r / lambda0;
        if (v <= 0) return 0;
        const j0 = core.besselJ0(v),
            j1 = core.besselJ1(v);
        return Math.min(1, Math.max(0, 1 - j0 * j0 - j1 * j1));
    }
    /** Rayleigh two-point resolution 0.61 λ0/NA (first Airy zero 3.8317/(2π) = 0.6098). */
    const RAYLEIGH_FACTOR = core.besselJZero ? core.besselJZero(1, 1) / (2 * Math.PI) : 0.6098;
    const rayleighResolution = (lambda0, NA) => RAYLEIGH_FACTOR * lambda0 / NA;
    /** Normal-incidence Fresnel power reflectance between real indices. */
    const fresnelNormalReflectance = (n1, n2) => ((n1 - n2) / (n1 + n2)) ** 2;

    /**
     * Thin lens with object-space index no and image-space index ni and power Φ = 1/f (f is the
     * focal length the lens would have in air): no/so + ni/si = Φ. Distances positive for a real
     * object on the left and a real image on the right. Lateral magnification m = −(no si)/(ni so).
     */
    function thinLensImaging({
        so,
        f,
        no = 1,
        ni = 1
    }) {
        const denom = 1 / f - no / so;
        if (!(denom > 0)) return {
            real: false,
            si: Infinity,
            m: -Infinity
        };
        const si = ni / denom;
        return {
            real: true,
            si,
            m: -(no * si) / (ni * so)
        };
    }

    /**
     * Radiance along a ray through a sequence of media: segments = [{n, T}] where T is the power
     * transmission of the interface/element entered at the start of that segment (first T is
     * ignored). Returns per segment {n, L, reduced: L/n²}. Lossless → reduced radiance constant.
     */
    function radianceAlongRay(L0, segments) {
        const out = [];
        let L = L0;
        segments.forEach((s, i) => {
            if (i > 0) L = L * (s.T == null ? 1 : s.T) * (s.n / segments[i - 1].n) ** 2;
            out.push({
                n: s.n,
                L,
                reduced: L / (s.n * s.n)
            });
        });
        return out;
    }

    // ------------------------------------------------------------------ the experiment
    const COATED_R = 0.0025; // single-layer broadband AR coating, per surface (assumed)

    /**
     * Full source → aperture/lens → filter → detector budget. Parameters (SI):
     * { source: "lambert" | "point" | "laser", L, a, I, P0, w0, lambda0, so, f, D, no, ni, ng,
     *   coated, Tf, rd, eta, t, idark (e⁻/s), readNoise (e⁻ rms), fullWell (e⁻) }
     */
    function experiment(p) {
        const R = p.D / 2;
        const no = p.no || 1,
            ni = p.ni || 1;
        const thO = Math.atan2(R, p.so);
        const NAo = no * Math.sin(thO);
        const img = thinLensImaging({
            so: p.so,
            f: p.f,
            no,
            ni
        });
        const thI = img.real ? Math.atan2(R, img.si) : NaN;
        const NAi = img.real ? ni * Math.sin(thI) : NaN;
        const lambda0 = p.lambda0;
        const out = {
            R,
            thO,
            NAo,
            img,
            thI,
            NAi,
            lambda0
        };

        // source emission and geometric collection
        let Pemit, Pcoll, PcollApprox, imgRadius, fill, Ecenter, intensity, radiance, emitNote;
        if (p.source === "point") {
            Pemit = 4 * Math.PI * p.I;
            Pcoll = p.I * solidAngleCone(thO);
            PcollApprox = p.I * Math.PI * (R / p.so) ** 2;
            imgRadius = img.real ? rayleighResolution(lambda0, NAi) : NaN;
            fill = img.real ? airyEncircledEnergy(p.rd, lambda0, NAi) : 0;
            Ecenter = p.I / (p.so * p.so);
            intensity = p.I;
            radiance = Infinity;
            emitNote = "isotropic into 4π sr";
        } else if (p.source === "laser") {
            const w = gaussianBeamRadius(p.w0, p.so, lambda0, no);
            out.wLens = w;
            out.divergence = lambda0 / (Math.PI * no * p.w0);
            Pemit = p.P0;
            Pcoll = p.P0 * gaussianApertureFraction(R, w);
            PcollApprox = Pcoll;
            imgRadius = img.real ? Math.abs(img.m) * p.w0 : NaN; // ABCD with B = 0: waist imaged ×|m|
            fill = img.real ? gaussianApertureFraction(p.rd, imgRadius) : 0;
            Ecenter = gaussianIrradianceAt(p.P0, w, 0);
            intensity = 2 * p.P0 / (Math.PI * out.divergence ** 2); // on-axis far-field W/sr
            radiance = 4 * p.P0 * no * no / (lambda0 * lambda0); // peak radiance of a TEM00 beam
            emitNote = "beam power";
        } else {
            const As = Math.PI * p.a * p.a;
            Pemit = Math.PI * p.L * As;
            Pcoll = lambertDiskToDiskPower(p.L, p.a, R, p.so);
            PcollApprox = p.L * As * projectedSolidAngleCone(thO);
            imgRadius = img.real ? Math.abs(img.m) * p.a : NaN;
            fill = img.real ? Math.min(1, (p.rd / imgRadius) ** 2) : 0;
            Ecenter = lambertOnAxisIrradiance(p.L, p.a, p.so);
            intensity = p.L * As; // on-axis radiant intensity of a Lambertian disk
            radiance = p.L;
            emitNote = "Lambertian, into 2π sr (πLA)";
        }

        // explicit transmission losses
        const R1 = p.coated ? COATED_R : fresnelNormalReflectance(no, p.ng);
        const R2 = p.coated ? COATED_R : fresnelNormalReflectance(p.ng, ni);
        const T1 = 1 - R1,
            T2 = 1 - R2,
            Tf = p.Tf;
        const Tlens = T1 * T2;
        const Pdet = Pcoll * T1 * T2 * Tf * fill;
        const photonsPerJ = lambda0 / (h * c);
        const eRate = p.eta * Pdet * photonsPerJ;
        const S = eRate * p.t;
        const Dk = p.idark * p.t;
        const noise = snr({
            signal: S,
            dark: Dk,
            readNoise: p.readNoise
        });

        const rows = [];
        const add = (stage, factor, power, note) => rows.push({
            stage,
            factor,
            power,
            photonRate: power * photonsPerJ,
            note
        });
        add("Emitted by source", NaN, Pemit, emitNote);
        add("Collected by the aperture (geometry)", Pcoll / Pemit, Pcoll, p.source === "lambert" ? "disk-to-disk view factor" : p.source === "point" ? "Ω/4π, Ω = 2π(1 − cos θ)" : "1 − exp(−2R²/w²)");
        add("Lens surface 1 (n₀ → n_glass)", T1, Pcoll * T1, p.coated ? "AR coated, R = 0.25 %" : "Fresnel, normal incidence");
        add("Lens surface 2 (n_glass → nᵢ)", T2, Pcoll * T1 * T2, p.coated ? "AR coated, R = 0.25 %" : "Fresnel, normal incidence");
        add("Filter", Tf, Pcoll * Tlens * Tf, "user transmission");
        add("Falls on the detector area", fill, Pdet, p.source === "lambert" ? "(r_d / image radius)², uniform image" : p.source === "point" ? "Airy encircled energy" : "Gaussian spot inside r_d");
        rows.push({
            stage: "Detected photoelectrons (QE η)",
            factor: p.eta,
            power: NaN,
            photonRate: eRate,
            note: "e⁻/s = η P λ₀/(hc)"
        });

        // étendue and radiance bookkeeping
        let Gobj = NaN,
            Gimg = NaN;
        if (p.source === "lambert" && img.real) {
            Gobj = no * no * Math.PI * p.a * p.a * projectedSolidAngleCone(thO);
            Gimg = ni * ni * Math.PI * imgRadius * imgRadius * projectedSolidAngleCone(thI);
        } else if (p.source === "laser") {
            Gobj = lambda0 * lambda0 / 4; // TEM00 étendue (π w0²/2)(π θ²/2)n² = λ0²/4 — the diffraction limit
        }
        const Ttot = Tlens * Tf;
        const ray = p.source === "point" ? null : radianceAlongRay(radiance, [{
            n: no
        }, {
            n: p.ng,
            T: T1
        }, {
            n: ni,
            T: T2 * Tf
        }]);
        const Eimage = p.source === "lambert" && img.real ? Ttot * Math.PI * p.L * NAi * NAi / (no * no) : NaN;

        Object.assign(out, {
            Pemit,
            Pcoll,
            PcollApprox,
            collectedFraction: Pcoll / Pemit,
            imgRadius,
            fill,
            R1,
            R2,
            T1,
            T2,
            Tf,
            Tlens,
            Ttot,
            Pdet,
            photonRateDet: Pdet * photonsPerJ,
            eRate,
            S,
            dark: Dk,
            readNoise: p.readNoise,
            snr: noise.snr,
            sigma: noise.sigma,
            shotLimitedSNR: Math.sqrt(S),
            saturated: S + Dk > p.fullWell,
            responsivity: responsivity(p.eta, lambda0),
            photocurrent: responsivity(p.eta, lambda0) * Pdet,
            rows,
            Gobj,
            Gimg,
            ray,
            Eimage,
            Ecenter,
            intensity,
            radiance,
            resObj: rayleighResolution(lambda0, NAo),
            resImg: img.real ? rayleighResolution(lambda0, NAi) : NaN,
            luminousDet: luminousFlux(Pdet, lambda0),
            V: luminousEfficiency(lambda0)
        });
        return out;
    }

    // ------------------------------------------------------------------ noise and statistics
    /** SNR = S / √(S + D + σr²) for shot noise on signal and dark counts plus Gaussian read noise. */
    function snr({
        signal,
        dark = 0,
        readNoise = 0
    }) {
        const sigma = Math.sqrt(signal + dark + readNoise * readNoise);
        return {
            snr: sigma > 0 ? signal / sigma : 0,
            sigma
        };
    }

    /**
     * Seeded Monte Carlo of one integrating detector: electrons = min(Poisson(S + D), FW), then
     * Gaussian read noise σr (e⁻ rms) is added. Returns Float64Array of N readouts (e⁻).
     */
    function simulateCounts({
        mean,
        readNoise = 0,
        fullWell = Infinity,
        trials = 1000,
        seed = 1
    }) {
        const rng = core.createRng(seed);
        const out = new Float64Array(trials);
        for (let i = 0; i < trials; i++) {
            let k = Math.min(rng.poisson(mean), fullWell);
            if (readNoise > 0) k += rng.normal(0, readNoise);
            out[i] = k;
        }
        return out;
    }

    /**
     * Sample statistics with their Monte Carlo standard errors: sem = s/√N and the standard error
     * of the sample variance √[(m4 − s⁴ (N−3)/(N−1))/N]. These shrink as 1/√N; the physical noise
     * σ does not.
     */
    function sampleStats(xs) {
        const N = xs.length;
        let mean = 0;
        for (let i = 0; i < N; i++) mean += xs[i];
        mean /= N;
        let m2 = 0,
            m4 = 0,
            lo = Infinity,
            hi = -Infinity;
        for (let i = 0; i < N; i++) {
            const d = xs[i] - mean;
            m2 += d * d;
            m4 += d * d * d * d;
            if (xs[i] < lo) lo = xs[i];
            if (xs[i] > hi) hi = xs[i];
        }
        const variance = N > 1 ? m2 / (N - 1) : 0;
        m4 /= N;
        const seVar = N > 3 ? Math.sqrt(Math.max(0, (m4 - variance * variance * (N - 3) / (N - 1)) / N)) : NaN;
        return {
            N,
            mean,
            variance,
            sd: Math.sqrt(variance),
            sem: Math.sqrt(variance / N),
            seVar,
            min: lo,
            max: hi
        };
    }

    /**
     * Bin edges covering mean ± 5σ. Integer counts with small σ get unit-width bins centred on
     * integers (so the Poisson pmf can be compared directly).
     */
    function histogramEdges(mean, sigma, {
        integer = false,
        maxBins = 60,
        fullWell = Infinity
    } = {}) {
        let lo = mean - 5 * sigma,
            hi = mean + 5 * sigma;
        if (integer) lo = Math.max(-0.5, Math.floor(lo) - 0.5);
        hi = Math.min(hi, fullWell + (integer ? 0.5 : sigma * 0.5 + 1e-9));
        if (hi <= lo) hi = lo + 1;
        let w = (hi - lo) / maxBins;
        if (integer) {
            w = Math.max(1, Math.ceil(w));
            hi = lo + Math.ceil((hi - lo) / w) * w;
        }
        const n = Math.max(1, Math.round((hi - lo) / w));
        const edges = new Float64Array(n + 1);
        for (let i = 0; i <= n; i++) edges[i] = lo + i * w;
        return edges;
    }

    /** Counts per bin [edges[i], edges[i+1]); values outside go into the first/last bin. */
    function histogram(xs, edges) {
        const n = edges.length - 1,
            counts = new Float64Array(n);
        const lo = edges[0],
            w = (edges[n] - lo) / n;
        for (let i = 0; i < xs.length; i++) {
            let b = Math.floor((xs[i] - lo) / w);
            if (b < 0) b = 0;
            else if (b >= n) b = n - 1;
            counts[b]++;
        }
        return counts;
    }

    // error function (W. J. Cody-style rational fit via erfc continued fraction is overkill here:
    // Abramowitz–Stegun 7.1.26 has |error| < 1.5e-7, adequate for bin probabilities).
    function erf(x) {
        const s = x < 0 ? -1 : 1;
        x = Math.abs(x);
        const t = 1 / (1 + 0.3275911 * x);
        const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
        return s * y;
    }
    const normalCdf = (z) => 0.5 * (1 + erf(z / Math.SQRT2));
    const poissonPmf = (k, mu) => (mu <= 0 ? (k === 0 ? 1 : 0) : Math.exp(k * Math.log(mu) - mu - core.logGamma(k + 1)));

    /**
     * Theoretical probability of each bin for readout = min(Poisson(mean), FW) + N(0, σr²).
     * Exact Poisson sums for mean ≤ 2×10⁴; above that the Poisson part is replaced by a normal
     * (skewness 1/√mean < 0.7 %). Returns { probs: Float64Array, approx: boolean }.
     */
    function countDistribution({
        mean,
        readNoise = 0,
        fullWell = Infinity
    }, edges) {
        const n = edges.length - 1,
            probs = new Float64Array(n);
        const binOf = (x) => {
            const w = (edges[n] - edges[0]) / n;
            let b = Math.floor((x - edges[0]) / w);
            return b < 0 ? 0 : b >= n ? n - 1 : b;
        };
        const addMass = (k, p) => {
            if (!(p > 0)) return;
            if (readNoise > 0) {
                for (let i = 0; i < n; i++) {
                    const lo = i === 0 ? -Infinity : edges[i],
                        hi = i === n - 1 ? Infinity : edges[i + 1];
                    probs[i] += p * (normalCdf((hi - k) / readNoise) - normalCdf((lo - k) / readNoise));
                }
            } else probs[binOf(k)] += p;
        };
        if (mean <= 2e4) {
            const sd = Math.sqrt(Math.max(mean, 1));
            const kmin = Math.max(0, Math.floor(mean - 10 * sd - 5));
            const kmax = Math.ceil(mean + 10 * sd + 5);
            let tail = 0;
            for (let k = kmin; k <= kmax; k++) {
                const p = poissonPmf(k, mean);
                if (k >= fullWell) tail += p;
                else addMass(k, p);
            }
            if (tail > 0) addMass(fullWell, tail);
            return {
                probs,
                approx: false
            };
        }
        // normal approximation of the Poisson part, convolved with read noise
        const s = Math.sqrt(mean + readNoise * readNoise);
        let clipped = 0;
        if (Number.isFinite(fullWell)) clipped = 1 - normalCdf((fullWell - mean) / Math.sqrt(mean));
        for (let i = 0; i < n; i++) {
            const lo = i === 0 ? -Infinity : edges[i],
                hi = i === n - 1 ? Infinity : edges[i + 1];
            let pr = normalCdf((hi - mean) / s) - normalCdf((lo - mean) / s);
            if (clipped > 1e-12) {
                // remove the part beyond the well from the smooth distribution and pile it up at FW
                const loC = Math.max(lo, fullWell);
                const cut = loC < hi ? normalCdf((hi - mean) / s) - normalCdf((loC - mean) / s) : 0;
                pr -= cut;
            }
            probs[i] += Math.max(0, pr);
        }
        if (clipped > 1e-12) {
            if (readNoise > 0) {
                for (let i = 0; i < n; i++) {
                    const lo = i === 0 ? -Infinity : edges[i],
                        hi = i === n - 1 ? Infinity : edges[i + 1];
                    probs[i] += clipped * (normalCdf((hi - fullWell) / readNoise) - normalCdf((lo - fullWell) / readNoise));
                }
            } else probs[binOf(fullWell)] += clipped;
        }
        return {
            probs,
            approx: true
        };
    }

    /**
     * Exact mean and variance of the readout min(Poisson(mean), FW) + N(0, σr²). Exact Poisson sums
     * for mean ≤ 2×10⁴, a clipped normal (closed form) above.
     */
    function readoutMoments({
        mean,
        readNoise = 0,
        fullWell = Infinity
    }) {
        const r2 = readNoise * readNoise;
        if (!Number.isFinite(fullWell) || fullWell > mean + 40 * Math.sqrt(mean + 1) + 50) return {
            mean,
            variance: mean + r2
        };
        let m1 = 0,
            m2 = 0;
        if (mean <= 2e4) {
            const sd = Math.sqrt(Math.max(mean, 1));
            const kmax = Math.min(fullWell - 1, Math.ceil(mean + 12 * sd + 10));
            let below = 0;
            for (let k = Math.max(0, Math.floor(mean - 12 * sd - 10)); k <= kmax; k++) {
                const p = poissonPmf(k, mean);
                below += p;
                m1 += p * k;
                m2 += p * k * k;
            }
            const tail = Math.max(0, 1 - below);
            m1 += tail * fullWell;
            m2 += tail * fullWell * fullWell;
        } else {
            const sg = Math.sqrt(mean),
                a = (fullWell - mean) / sg;
            const Phi = normalCdf(a),
                phi = Math.exp(-0.5 * a * a) / Math.sqrt(2 * Math.PI);
            m1 = mean * Phi - sg * phi + fullWell * (1 - Phi);
            m2 = (mean * mean + mean) * Phi - sg * (mean + fullWell) * phi + fullWell * fullWell * (1 - Phi);
        }
        return {
            mean: m1,
            variance: Math.max(0, m2 - m1 * m1) + r2
        };
    }

    // ------------------------------------------------------------------ photometry
    /**
     * CIE 1924 photopic luminous efficiency V(λ), 10 nm steps 380–780 nm plus the 555 nm peak
     * (CIE 018:2019 / Wyszecki & Stiles, Color Science, 2nd ed., Table I(4.3.2)). Linear
     * interpolation between nodes; 0 outside 380–780 nm.
     */
    const V1924 = Object.freeze([
        [380, 0.00004],
        [390, 0.00012],
        [400, 0.0004],
        [410, 0.0012],
        [420, 0.004],
        [430, 0.0116],
        [440, 0.023],
        [450, 0.038],
        [460, 0.06],
        [470, 0.09098],
        [480, 0.13902],
        [490, 0.20802],
        [500, 0.323],
        [510, 0.503],
        [520, 0.71],
        [530, 0.862],
        [540, 0.954],
        [550, 0.99495],
        [555, 1.0],
        [560, 0.995],
        [570, 0.952],
        [580, 0.87],
        [590, 0.757],
        [600, 0.631],
        [610, 0.503],
        [620, 0.381],
        [630, 0.265],
        [640, 0.175],
        [650, 0.107],
        [660, 0.061],
        [670, 0.032],
        [680, 0.017],
        [690, 0.00821],
        [700, 0.004102],
        [710, 0.002091],
        [720, 0.001047],
        [730, 0.00052],
        [740, 0.000249],
        [750, 0.00012],
        [760, 0.00006],
        [770, 0.00003],
        [780, 0.000015]
    ]);
    const KM = 683; // lm/W, maximum luminous efficacy (SI candela definition at 540 THz)
    function luminousEfficiency(lambda0) {
        const nm = lambda0 * 1e9;
        if (!(nm >= 380 && nm <= 780)) return 0;
        for (let i = 1; i < V1924.length; i++) {
            if (nm <= V1924[i][0]) {
                const [x0, y0] = V1924[i - 1], [x1, y1] = V1924[i];
                return y0 + (y1 - y0) * (nm - x0) / (x1 - x0);
            }
        }
        return 0;
    }
    /** Luminous flux (lm) of monochromatic radiant power P (W): Φv = 683 V(λ) P. */
    const luminousFlux = (P, lambda0) => KM * luminousEfficiency(lambda0) * P;

    return {
        photonEnergy,
        photonRate,
        responsivity,
        expectedCounts,
        countDimensions,
        responsivityDimensions,
        DIM,
        solidAngleCone,
        projectedSolidAngleCone,
        lambertOnAxisIrradiance,
        lambertOnAxisIrradianceNumeric,
        lambertIrradianceAt,
        diskViewFactor,
        lambertDiskToDiskPower,
        diskToDiskPowerNumeric,
        pointIrradianceAt,
        gaussianIrradianceAt,
        gaussianApertureFraction,
        gaussianBeamRadius,
        airyEncircledEnergy,
        RAYLEIGH_FACTOR,
        rayleighResolution,
        fresnelNormalReflectance,
        thinLensImaging,
        radianceAlongRay,
        experiment,
        COATED_R,
        snr,
        simulateCounts,
        sampleStats,
        readoutMoments,
        histogramEdges,
        histogram,
        countDistribution,
        erf,
        normalCdf,
        poissonPmf,
        V1924,
        KM,
        luminousEfficiency,
        luminousFlux
    };
});