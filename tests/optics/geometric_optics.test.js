const test = require("node:test");
const assert = require("node:assert/strict");
const go = require("../../src/tools/shared/optics/geometricOptics.js");

const mm = 1e-3;
const deg = (d) => d * Math.PI / 180;
const close = (a, b, tol = 1e-9, msg) =>
    assert.ok(Math.abs(a - b) <= tol, `${msg || ""} expected ${b}, got ${a}`);
const finiteOrFlag = (v) => assert.ok(Number.isFinite(v) || Number.isNaN(v) || v === Infinity, `bad value ${v}`);

const thin = (f, semi = 20 * mm, z = 0) => ({ type: "thin", z, f, semi });

// ---------------------------------------------------------------- acceptance
test("acceptance: f = 100 mm, object at 300 mm → image at +150 mm, m = −0.5", () => {
    const g = go.thinLensImage(100 * mm, 300 * mm);
    close(g.si, 150 * mm, 1e-15, "Gaussian si");
    close(g.m, -0.5, 1e-15, "Gaussian m");
    const sys = go.buildSystem([thin(100 * mm)]);
    const im = go.imageOf(sys, { z: -300 * mm, h: 10 * mm });
    close(im.si, 150 * mm, 1e-15, "ABCD si");
    close(im.zImage, 150 * mm, 1e-15, "ABCD z");
    close(im.m, -0.5, 1e-15, "ABCD m");
    assert.equal(im.virtual, false);
    // the exact trace of the ideal lens brings every ray of the fan to (150 mm, −5 mm)
    for (const tr of go.rayFan(sys, { z: -300 * mm, h: 10 * mm }, 11)) {
        const hit = go.atPlane(tr, 150 * mm);
        close(hit[1], -5 * mm, 1e-15, "exact ray height");
    }
});

test("virtual image (object inside f) and image at infinity (object at f) stay finite and flagged", () => {
    const sys = go.buildSystem([thin(100 * mm)]);
    const v = go.imageOf(sys, { z: -50 * mm, h: 1 * mm });
    close(v.si, -100 * mm, 1e-15, "virtual si");
    close(v.m, 2, 1e-12, "virtual m");
    assert.equal(v.virtual, true);
    const g = go.thinLensImage(100 * mm, 50 * mm);
    close(g.si, -100 * mm, 1e-15);
    assert.equal(g.virtual, true);

    const inf = go.imageOf(sys, { z: -100 * mm, h: 1 * mm });
    assert.equal(inf.atInfinity, true);
    assert.equal(inf.si, Infinity);
    // rays from the object top leave parallel with slope −h/f
    close(inf.angularOut, -0.01, 1e-15, "angular size");
    assert.equal(go.thinLensImage(100 * mm, 100 * mm).atInfinity, true);
    // just either side of f: huge but finite with opposite signs, never NaN
    const a = go.imageOf(sys, { z: -(100 * mm + 1e-9), h: 1 * mm });
    const b = go.imageOf(sys, { z: -(100 * mm - 1e-9), h: 1 * mm });
    for (const r of [a, b]) { finiteOrFlag(r.si); finiteOrFlag(r.m); }
    assert.ok(a.atInfinity || a.si > 1e3);
    assert.ok(b.atInfinity || b.si < -1e3);
    // spot, stops and cardinal points of this configuration evaluate without exceptions
    const sp = go.spotDiagram(sys, { z: -100 * mm, h: 1 * mm });
    assert.equal(sp.mode, "angle");
    assert.ok(sp.rms < 1e-12, "ideal lens: parallel output bundle");
});

test("object at infinity images at the rear focal plane with h' = f tan α", () => {
    const sys = go.buildSystem([thin(80 * mm)]);
    const im = go.imageOf(sys, { atInfinity: true, angle: deg(2) });
    close(im.si, 80 * mm, 1e-15);
    close(im.hImage, 80 * mm * Math.tan(deg(2)), 1e-15);
});

// ---------------------------------------------------------------- exact vs paraxial
test("exact rays converge to the paraxial focus as ray height → 0 (thick BK7 lens), error ∝ h²", () => {
    const sys = go.buildSystem([{ type: "lens", z: 0, R1: 60 * mm, R2: -60 * mm, t: 12 * mm, material: "BK7", semi: 25 * mm }]);
    const cp = go.cardinalPoints(sys);
    const zParax = cp.zFp;
    const errs = [];
    for (const h of [8, 4, 2, 1, 0.5, 0.25, 0.1].map((v) => v * mm)) {
        const tr = go.traceExact(sys, { p: [0, h, -50 * mm], d: [0, 0, 1] });
        assert.equal(tr.status, "ok");
        errs.push({ h, e: go.axialCrossing(tr) - zParax });
    }
    // monotone convergence, and third-order behaviour: e/h² tends to a constant
    for (let i = 1; i < errs.length; i++) assert.ok(Math.abs(errs[i].e) < Math.abs(errs[i - 1].e));
    const k = errs.map((o) => o.e / (o.h * o.h));
    close(k[k.length - 1], k[k.length - 2], Math.abs(k[k.length - 1]) * 0.01, "e/h² constant");
    assert.ok(Math.abs(errs[errs.length - 1].e) < 1e-6, "0.1 mm ray within 1 µm of paraxial focus");
    // undercorrected: marginal rays focus short of the paraxial focus
    assert.ok(errs[0].e < 0);
});

test("exactVsParaxial: Δz/ρ² tends to a constant for a real lens; Δslope → 0 for an afocal pair", () => {
    const sys = go.buildSystem(go.PRESETS.thick.elements);
    const r = go.exactVsParaxial(sys, { atInfinity: true, angle: 0 }, [0.4, 0.1, 0.05, 0.01]);
    assert.equal(r.imageAtInfinity, false);
    const k = r.rows.map((row) => row.delta / row.rho ** 2);
    close(k[3], k[2], Math.abs(k[3]) * 0.01);
    assert.ok(Math.abs(r.rows[3].delta) < 2e-6);
    // Keplerian telescope with a real BK7 objective: afocal, so the comparison is in outgoing slope
    const objective = { type: "lens", z: 0, R1: 103.4 * mm, R2: -103.4 * mm, t: 6 * mm, material: "BK7", semi: 20 * mm };
    const zEye = go.cardinalPoints(go.buildSystem([objective])).zFp + 25 * mm;
    const tele = go.buildSystem([objective, { type: "thin", z: zEye, f: 25 * mm, semi: 10 * mm }]);
    assert.equal(go.cardinalPoints(tele).afocal, true);
    const cmp = go.exactVsParaxial(tele, { atInfinity: true, angle: 0 }, [1, 0.1, 0.01]);
    const rows = cmp.rows;
    assert.equal(cmp.imageAtInfinity, true);
    assert.ok(Math.abs(rows[2].delta) < Math.abs(rows[1].delta) && Math.abs(rows[1].delta) < Math.abs(rows[0].delta));
    assert.ok(rows.every((row) => Number.isFinite(row.delta)));
});

test("single spherical surface: exact axial crossing matches the sine-rule result", () => {
    const n = 1.5, R = 20 * mm;
    const sys = go.buildSystem([{ type: "surface", z: 0, R, material: n, semi: 30 * mm }]);
    for (const h of [0.1, 3, 8, 12].map((v) => v * mm)) {
        const tr = go.traceExact(sys, { p: [0, h, -10 * mm], d: [0, 0, 1] });
        const i = Math.asin(h / R), r = Math.asin(h / (n * R));
        const fromCentre = R * Math.sin(r) / Math.sin(i - r);
        close(go.axialCrossing(tr), R + fromCentre, 1e-12, `h=${h}`);
    }
    // paraxial limit: f' = n R/(n − 1)
    close(go.cardinalPoints(sys).zFp, n * R / (n - 1), 1e-15);
});

test("vector Snell at a plane interface and total internal reflection", () => {
    const glass = go.buildSystem([{ type: "surface", z: 0, R: Infinity, material: 1.5 }]);
    const a = deg(40);
    const tr = go.traceExact(glass, { p: [0, 0, -1], d: [0, Math.sin(a), Math.cos(a)] });
    close(Math.asin(tr.d[1]), Math.asin(Math.sin(a) / 1.5), 1e-14, "refraction angle");
    // glass → air beyond the critical angle asin(1/1.5) ≈ 41.8°
    const out = go.buildSystem([{ type: "surface", z: 0, R: Infinity, material: "air" }], { medium: 1.5 });
    const b = deg(45);
    const t2 = go.traceExact(out, { p: [0, 0, -1], d: [0, Math.sin(b), Math.cos(b)] });
    assert.equal(t2.status, "tir");
    close(t2.d[2], -Math.cos(b), 1e-14, "reflected z");
    close(t2.d[1], Math.sin(b), 1e-14, "reflected y");
    const t3 = go.traceExact(out, { p: [0, 0, -1], d: [0, Math.sin(deg(41)), Math.cos(deg(41))] });
    assert.equal(t3.status, "ok");
    // the TIR preset: edge rays TIR, central rays pass
    const p = go.PRESETS.tir;
    const fan = go.rayFan(go.buildSystem(p.elements), { atInfinity: true, angle: 0 }, 11);
    assert.equal(fan[0].status, "tir");
    assert.equal(fan[5].status, "ok");
});

// ---------------------------------------------------------------- mirrors and Fermat
test("spherical mirror: marginal focus at R − R/(2 cos θ), paraxial f = −R/2", () => {
    const R = -200 * mm;
    const sys = go.buildSystem([{ type: "mirror", z: 0, R, semi: 80 * mm }]);
    const cp = go.cardinalPoints(sys);
    close(cp.efl, 100 * mm, 1e-15);
    close(cp.zFp, -100 * mm, 1e-15);
    for (const h of [1, 20, 50, 70].map((v) => v * mm)) {
        const tr = go.traceExact(sys, { p: [0, h, -300 * mm], d: [0, 0, 1] });
        assert.equal(tr.status, "ok");
        assert.ok(tr.d[2] < 0, "travels back");
        const th = Math.asin(h / Math.abs(R));
        close(go.axialCrossing(tr), R - R / (2 * Math.cos(th)), 1e-12, `h=${h}`);
    }
});

test("concave mirror images an object at 300 mm to 150 mm in front with m = −0.5", () => {
    const sys = go.buildSystem([{ type: "mirror", z: 0, R: -200 * mm, semi: 30 * mm }]);
    const im = go.imageOf(sys, { z: -300 * mm, h: 10 * mm });
    close(im.si, 150 * mm, 1e-15);
    close(im.zImage, -150 * mm, 1e-15);
    close(im.m, -0.5, 1e-15);
});

test("Fermat: rays from the centre of curvature of a mirror return with equal optical path", () => {
    const R = -100 * mm;
    const sys = go.buildSystem([{ type: "mirror", z: 0, R, semi: 60 * mm }, { type: "detector", z: R }]);
    const opl = [];
    for (const a of [0, 5, 15, 25].map(deg)) {
        const tr = go.traceExact(sys, { p: [0, 0, R], d: [0, Math.sin(a), Math.cos(a)] });
        close(tr.p[1], 0, 1e-15, "returns to centre");
        opl.push(tr.opl);
    }
    opl.forEach((o) => close(o, 2 * Math.abs(R), 1e-15, "OPL"));
});

// ---------------------------------------------------------------- matrices and cardinal points
test("system matrix determinant equals n_object/n_image", () => {
    const sys = go.buildSystem([{ type: "surface", z: 0, R: 30 * mm, material: "BK7" }, { type: "surface", z: 5 * mm, R: -40 * mm, material: "water" }]);
    for (const lam of [go.LINES.F, go.LINES.d, go.LINES.C]) {
        const pm = go.paraxialMatrices(sys, lam);
        close(go.matrices.det(pm.M), 1 / go.refractiveIndex("water", lam), 1e-14);
    }
});

test("thick lens: EFL and principal planes follow the thick-lens formulas", () => {
    const R1 = 50 * mm, R2 = -80 * mm, t = 10 * mm, n = go.refractiveIndex("BK7");
    const sys = go.buildSystem([{ type: "lens", z: 0, R1, R2, t, material: "BK7", semi: 20 * mm }]);
    const cp = go.cardinalPoints(sys);
    const P = (n - 1) * (1 / R1 - 1 / R2 + (n - 1) * t / (n * R1 * R2));
    close(cp.efl, 1 / P, 1e-12);
    close(cp.zH, -(1 / P) * (n - 1) * t / (n * R2), 1e-12, "H from front vertex");
    close(cp.zHp, t - (1 / P) * (n - 1) * t / (n * R1), 1e-12, "H' from front vertex");
    // same medium on both sides: nodal points coincide with principal points, f = f'
    close(cp.zN, cp.zH, 1e-15);
    close(cp.zNp, cp.zHp, 1e-15);
    close(cp.fFront, cp.fRear, 1e-15);
});

test("single refracting surface: H at the vertex, nodal point at the centre of curvature", () => {
    const R = 50 * mm;
    const sys = go.buildSystem([{ type: "surface", z: 0, R, material: 1.5 }]);
    const cp = go.cardinalPoints(sys);
    close(cp.zH, 0, 1e-15);
    close(cp.zHp, 0, 1e-15);
    close(cp.zN, R, 1e-15);
    close(cp.zNp, R, 1e-15);
    close(cp.fRear / cp.fFront, 1.5, 1e-12, "f'/f = n'/n");
});

// ---------------------------------------------------------------- materials and chromatic aberration
test("glass data: N-BK7 and F2 at the d line and Abbe numbers", () => {
    close(go.refractiveIndex("BK7", go.LINES.d), 1.5168, 1e-4);
    close(go.refractiveIndex("F2", go.LINES.d), 1.6200, 1e-4);
    close(go.abbeNumber("BK7"), 64.17, 0.1);
    close(go.abbeNumber("F2"), 36.37, 0.1);
    assert.equal(go.abbeNumber("air"), Infinity);
    // normal dispersion: n decreases with λ; the Cauchy fit tracks Sellmeier to < 1e-3 in the visible
    for (let l = 420e-9; l <= 700e-9; l += 20e-9) {
        assert.ok(go.refractiveIndex("BK7", l) > go.refractiveIndex("BK7", l + 10e-9));
        close(go.refractiveIndex("BK7c", l), go.refractiveIndex("BK7", l), 1e-3);
    }
});

test("achromatic doublet: F–C focal shift far smaller than a BK7 singlet of similar power", () => {
    const shift = (els) => {
        const sys = go.buildSystem(els);
        const zF = go.cardinalPoints(sys, go.LINES.F).zFp, zC = go.cardinalPoints(sys, go.LINES.C).zFp;
        return Math.abs(zF - zC) / go.cardinalPoints(sys, go.LINES.d).efl;
    };
    const singlet = shift([{ type: "lens", z: 0, R1: 103.4 * mm, R2: -103.4 * mm, t: 6 * mm, material: "BK7" }]);
    const doublet = shift(go.PRESETS.achromat.elements.filter((e) => e.type !== "detector"));
    close(singlet, 1 / go.abbeNumber("BK7"), 0.002, "thin-lens δf/f = 1/V");
    assert.ok(doublet < singlet / 8, `doublet ${doublet} vs singlet ${singlet}`);
    // thin lens with glass: f(λ) scales with 1/(n−1)
    const tl = go.buildSystem([{ type: "thin", z: 0, f: 100 * mm, material: "BK7" }]);
    close(go.cardinalPoints(tl, go.LINES.d).efl, 100 * mm, 1e-15);
    assert.ok(go.cardinalPoints(tl, go.LINES.F).efl < go.cardinalPoints(tl, go.LINES.C).efl);
});

// ---------------------------------------------------------------- stops, pupils, NA
test("stop at a thin lens: EP = XP = lens; stop in front of a lens: XP is the lens image of the stop", () => {
    const a = go.stopsAndPupils(go.buildSystem([thin(100 * mm, 10 * mm)]), { z: -300 * mm, h: 5 * mm });
    close(a.zEP, 0, 1e-15);
    close(a.rEP, 10 * mm, 1e-15);
    close(a.zXP, 0, 1e-15);
    const sys = go.buildSystem([{ type: "stop", z: -40 * mm, semi: 4 * mm }, thin(100 * mm, 30 * mm, 0)]);
    const b = go.stopsAndPupils(sys, { z: -300 * mm, h: 5 * mm });
    assert.equal(b.stop, 0);
    close(b.zEP, -40 * mm, 1e-15);
    const g = go.thinLensImage(100 * mm, 40 * mm); // stop 40 mm before lens → virtual image
    close(b.zXP, g.si, 1e-12, "XP position");
    close(b.rXP, 4 * mm * Math.abs(g.m), 1e-12, "XP radius");
});

test("Keplerian telescope: afocal, angular magnification −f1/f2, exit pupil at the objective's image", () => {
    const sys = go.buildSystem([thin(200 * mm, 25 * mm), thin(50 * mm, 12 * mm, 250 * mm)]);
    const cp = go.cardinalPoints(sys);
    assert.equal(cp.afocal, true);
    close(cp.angularMagnification, -4, 1e-12);
    const im = go.imageOf(sys, { atInfinity: true, angle: deg(1) });
    assert.equal(im.atInfinity, true);
    close(im.angularOut, -4 * Math.tan(deg(1)), 1e-12);
    const sp = go.stopsAndPupils(sys, { atInfinity: true, angle: deg(1) });
    assert.equal(sp.stop, 0);
    close(sp.zXP, 312.5 * mm, 1e-12);
    close(sp.rXP, 25 * mm / 4, 1e-12);
    assert.equal(sp.naImage < 1e-12, true, "afocal: no image-space convergence");
});

test("compound microscope: intermediate m = −8, final image at infinity, visual magnification −80", () => {
    const p = go.PRESETS.microscope;
    const sys = go.buildSystem(p.elements);
    const obj = { z: -p.object.dist, h: p.object.h };
    const objOnly = go.imageOf(go.buildSystem([p.elements[0]]), obj);
    close(objOnly.si, 144 * mm, 1e-12);
    close(objOnly.m, -8, 1e-12);
    const im = go.imageOf(sys, obj);
    assert.equal(im.atInfinity, true);
    const visual = im.angularOut / (-obj.h / (250 * mm));
    close(visual, -80, 1e-9);
});

test("NA and Airy spot: diameter 1.22 λ/NA (first dark ring)", () => {
    const sys = go.buildSystem([thin(100 * mm, 10 * mm)]);
    const sp = go.stopsAndPupils(sys, { atInfinity: true, angle: 0 });
    close(sp.naImage, Math.sin(Math.atan(0.1)), 1e-12);
    const a = go.airy(550e-9, 0.1);
    close(a.diameter, 1.21967 * 550e-9 / 0.1, 1e-11);
    close(a.radius * 2, a.diameter, 1e-18);
    assert.equal(go.airy(550e-9, 0).radius, Infinity);
});

// ---------------------------------------------------------------- aberrations
test("ideal thin lens: zero spot size, distortion and field curvature; spot is symmetric on axis", () => {
    const sys = go.buildSystem([thin(100 * mm, 20 * mm)]);
    const obj = { z: -300 * mm, h: 10 * mm };
    const s = go.spotDiagram(sys, obj);
    assert.ok(s.rms < 1e-15);
    const d = go.distortion(sys, obj, [0.5, 1]);
    d.points.forEach((p) => close(p.distortion, 0, 1e-12));
    const f = go.fieldCurves(sys, obj, [0.5, 1]);
    f.points.forEach((p) => { close(p.dzT, 0, 1e-8); close(p.dzS, 0, 1e-8); });
    const real = go.buildSystem([{ type: "lens", z: 0, R1: 60 * mm, R2: -60 * mm, t: 12 * mm, material: "BK7", semi: 20 * mm }]);
    const onAxis = go.spotDiagram(real, { atInfinity: true, angle: 0 });
    close(onAxis.centroid[0], 0, 1e-12);
    close(onAxis.centroid[1], 0, 1e-12);
    assert.ok(onAxis.rms > 1e-5, "spherical aberration blurs the paraxial-plane spot");
});

test("stop in front of a positive lens gives barrel (negative) distortion; stop behind gives pincushion", () => {
    const lens = { type: "lens", z: 0, R1: 60 * mm, R2: -60 * mm, t: 8 * mm, material: "BK7", semi: 25 * mm };
    const obj = { atInfinity: true, angle: deg(10) };
    const front = go.distortion(go.buildSystem([{ type: "stop", z: -20 * mm, semi: 3 * mm }, lens]), obj, [1]);
    const back = go.distortion(go.buildSystem([lens, { type: "stop", z: 28 * mm, semi: 3 * mm }]), obj, [1]);
    assert.ok(front.points[0].distortion < -1e-3, `front ${front.points[0].distortion}`);
    assert.ok(back.points[0].distortion > 1e-3, `back ${back.points[0].distortion}`);
});

test("field curves: spherical mirror with stop at the mirror has a flat sagittal field (Coddington)", () => {
    const sys = go.buildSystem([{ type: "mirror", z: 0, R: -200 * mm, semi: 30 * mm }]);
    const obj = { z: -300 * mm, h: 30 * mm };
    const f = go.fieldCurves(sys, obj, [0.5, 1]);
    f.points.forEach((p) => close(p.dzS, 0, 1e-7, "sagittal"));
    // tangential Coddington: 1/s't = 2/(R cos I) − 1/s along the chief ray
    const I = Math.atan(30 / 300);
    const st = 1 / (2 / (200 * mm * Math.cos(I)) - Math.cos(I) / (300 * mm));
    close(f.points[1].dzT, st * Math.cos(I) - 150 * mm, 1e-7, "tangential");
    assert.ok(f.points[1].dzT < 0);
});

test("longitudinal aberration → paraxial chromatic focus as pupil height → 0", () => {
    const p = go.PRESETS.thick;
    const sys = go.buildSystem(p.elements);
    const la = go.longitudinalAberration(sys, { atInfinity: true, angle: 0 }, [go.LINES.F, go.LINES.d, go.LINES.C], { n: 30, rhoMin: 0.005 });
    for (const c of la.curves) {
        close(c.dz[0], c.paraxial, 5e-6, "small-ρ limit");
        assert.ok(c.dz[c.dz.length - 1] < c.dz[0], "undercorrected");
    }
    assert.ok(la.curves[0].paraxial < 0 && la.curves[2].paraxial > 0, "blue focuses closer than red");
});

test("presets evaluate without exceptions or non-finite surprises", () => {
    for (const [name, p] of Object.entries(go.PRESETS)) {
        const sys = go.buildSystem(p.elements);
        const obj = p.object.atInfinity ? { atInfinity: true, angle: deg(p.object.angle) } : { z: sys.surfaces[0].z - p.object.dist, h: p.object.h };
        const im = go.imageOf(sys, obj);
        assert.ok(im.atInfinity || Number.isFinite(im.zImage), name);
        const s = go.spotDiagram(sys, obj, { lambdas: [go.LINES.F, go.LINES.d, go.LINES.C] });
        assert.ok(s.points.length > 0, name + " spot");
        go.stopsAndPupils(sys, obj);
        go.cardinalPoints(sys);
    }
});
