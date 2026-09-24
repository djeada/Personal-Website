(function() {
    "use strict";
    const UI = window.OpticsUI;
    const GO = window.OpticsModels.geometricOptics;
    const TH = UI.CANVAS_PALETTE;
    const MM = 1e-3,
        NM = 1e-9,
        DEG = Math.PI / 180;
    const $ = (id) => document.getElementById(id);


    const COL = {
        lens: "#8ab4ff",
        lensFill: "rgba(138, 180, 255, 0.16)",
        mirror: "#d6dbe4",
        stop: "#b8b2cf",
        detector: "#7ee787",
        object: "#7ee787",
        image: "#f187c8",
        paraxial: "rgba(255, 255, 255, 0.85)",
        construct: "#f8d477",
        cardinal: "#69f5e7",
        pupil: "#a78bfa",
        tir: "#ff9f6b",
        select: "#ffffff"
    };
    const TYPE_NAMES = {
        thin: "Thin lens",
        lens: "Thick lens",
        surface: "Surface",
        mirror: "Mirror",
        stop: "Aperture",
        detector: "Detector"
    };
    const MATERIALS = [
        ["BK7", "N-BK7 (Sellmeier)"],
        ["F2", "F2 (Sellmeier)"],
        ["BK7c", "BK7 (Cauchy fit)"],
        ["water", "Water (Cauchy)"],
        ["air", "Air (n = 1)"]
    ];
    const CHROM_PRESETS = {
        thick: true,
        achromat: true
    };


    let els = [];
    let nextId = 1;
    let selected = "obj";
    let presetKey = "single";
    let view = {
        zMin: -320,
        zMax: 200,
        yMax: 25
    };
    let result = null;
    let benchMap = null;
    let hitTargets = [];
    let drag = null;
    let rafPending = false;
    let labelBounds = null;


    const fmt = (v, d = 4) => {
        if (v === Infinity) return "∞";
        if (v === -Infinity) return "−∞";
        if (!Number.isFinite(v)) return "—";
        if (Math.abs(v) < 1e-12) return "0";
        const s = Number(v.toPrecision(d)).toString();
        return s.replace("-", "−");
    };
    const fsmall = (v, unitScale, unit) => (Number.isFinite(v) && v * unitScale < 1e-3 ? "< 0.001 " + unit : fmt(v * unitScale, 3) + " " + unit);
    const fmm = (m, d = 4) => (Number.isFinite(m) ? fmt(m / MM, d) + " mm" : fmt(m));
    const lenUI = (v) => (v === Infinity || v === -Infinity ? 0 : Math.round(v / MM * 1e6) / 1e6);
    const radModel = (v) => (!v || !Number.isFinite(v) ? Infinity : v * MM);
    const matModel = (m) => {
        if (m == null || m === "" || m === "ideal") return null;
        if (GO.MATERIALS[m]) return m;
        const n = Number(m);
        return Number.isFinite(n) && n >= 1 ? n : "BK7";
    };
    const nmColor = (lam, a = 1) => UI.wavelengthToCSS(lam / NM, a);
    const hasMirror = () => els.some((e) => e.type === "mirror");
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

    function ordered() {
        const mi = els.findIndex((e) => e.type === "mirror");
        if (mi < 0) return els.slice().sort((a, b) => a.z - b.z);
        const mirror = els[mi];
        const pre = els.filter((e) => e !== mirror && !e.after).sort((a, b) => a.z - b.z);
        const post = els.filter((e) => e !== mirror && e.after).sort((a, b) => b.z - a.z);
        return pre.concat([mirror], post);
    }

    function toModel(list) {
        return list.map((e) => {
            const b = {
                id: e.id,
                type: e.type,
                z: e.z * MM,
                semi: e.semi > 0 ? e.semi * MM : undefined
            };
            if (e.type === "thin") {
                b.f = radModel(e.f);
                b.material = matModel(e.material);
            }
            if (e.type === "lens") {
                b.R1 = radModel(e.R1);
                b.R2 = radModel(e.R2);
                b.t = Math.max(0.01, e.t) * MM;
                b.material = matModel(e.material) || "BK7";
            }
            if (e.type === "surface") {
                b.R = radModel(e.R);
                b.material = matModel(e.material) || "air";
            }
            if (e.type === "mirror") b.R = radModel(e.R);
            return b;
        });
    }

    function presetToUI(key) {
        const p = GO.PRESETS[key];
        let afterMirror = false;
        els = p.elements.map((e) => {
            const o = {
                id: nextId++,
                type: e.type,
                z: lenUI(e.z),
                semi: e.semi ? lenUI(e.semi) : 0,
                name: e.name || ""
            };
            if (e.type === "thin") {
                o.f = lenUI(e.f);
                o.material = e.material || "ideal";
            }
            if (e.type === "lens") {
                o.R1 = lenUI(e.R1);
                o.R2 = lenUI(e.R2);
                o.t = lenUI(e.t);
                o.material = e.material;
            }
            if (e.type === "surface") {
                o.R = lenUI(e.R);
                o.material = e.material;
            }
            if (e.type === "mirror") o.R = lenUI(e.R);
            o.after = afterMirror && e.type !== "mirror";
            if (e.type === "mirror") afterMirror = true;
            return o;
        });
        return p;
    }


    const ctlMap = {
        inf: "#objInf",
        so: "#objDist",
        h: "#objH",
        ang: "#objAng",
        lam: "#lam",
        chrom: "#chrom",
        ex: "#showExact",
        px: "#showParax",
        cs: "#showConstr",
        cd: "#showCard",
        pu: "#showPupils",
        nr: "#nRays",
        sf: "#spotField",
        sp: "#spotPlane"
    };
    UI.enhanceAllSliders(document.querySelector(".options-sidebar"), {
        objDist: {
            unit: "mm"
        },
        objH: {
            unit: "mm"
        },
        objAng: {
            unit: "°"
        },
        lam: {
            unit: "nm"
        }
    });
    const ctl = UI.bindControls(ctlMap, () => {
        url.update();
        schedule();
    });
    const url = UI.urlState({
        get: () => Object.assign(ctl.get(), {
            pre: presetKey,
            els: encodeEls()
        }),
        set: (o) => {
            if (o.pre && GO.PRESETS[o.pre]) presetKey = o.pre;
            if (o.els) decodeEls(o.els);
            else if (o.pre && GO.PRESETS[o.pre]) presetToUI(o.pre);
            const rest = Object.assign({}, o);
            delete rest.els;
            delete rest.pre;
            ctl.set(rest);
            buildPresetButtons();
            rebuildEditor();
            fitView();
            render();
        }
    });

    function encodeEls() {
        return JSON.stringify(els.map((e) => {
            const o = {
                t: e.type,
                z: e.z
            };
            ["f", "R1", "R2", "R", "semi", "material", "name"].forEach((k) => {
                if (e[k] != null && e[k] !== "") o[k] = e[k];
            });
            if (e.type === "lens") o.th = e.t;
            if (e.after) o.a = 1;
            return o;
        }));
    }

    function decodeEls(str) {
        try {
            const arr = JSON.parse(str);
            if (!Array.isArray(arr)) return;
            const out = arr.filter((o) => TYPE_NAMES[o.t] && Number.isFinite(Number(o.z))).map((o) => ({
                id: nextId++,
                type: o.t,
                z: Number(o.z),
                f: o.f != null ? Number(o.f) : undefined,
                R1: o.R1 != null ? Number(o.R1) : undefined,
                R2: o.R2 != null ? Number(o.R2) : undefined,
                R: o.R != null ? Number(o.R) : undefined,
                t: o.th != null ? Number(o.th) : undefined,
                semi: o.semi != null ? Number(o.semi) : 0,
                material: o.material,
                name: o.name || "",
                after: !!o.a
            }));
            if (out.length) {
                els = out;
                selected = "obj";
            }
        } catch (e) {

        }
    }

    function readState() {
        const s = ctl.get();
        return {
            inf: s.inf,
            so: s.so,
            h: s.h,
            ang: s.ang,
            lam: s.lam * NM,
            chrom: s.chrom,
            showExact: s.ex,
            showParax: s.px,
            showConstr: s.cs,
            showCard: s.cd,
            showPupils: s.pu,
            nRays: s.nr,
            spotField: s.sf,
            spotPlane: s.sp
        };
    }


    function firstZ(list) {
        return list.length ? list[0].z : 0;
    }

    function compute() {
        const st = readState();
        const list = ordered();
        const mEls = toModel(list);
        const optics = mEls.filter((e) => e.type !== "detector");
        const res = {
            st,
            list,
            empty: !optics.some((e) => e.type !== "stop")
        };
        const zFirst = firstZ(list) * MM;
        res.obj = st.inf ? {
            atInfinity: true,
            angle: st.ang * DEG
        } : {
            z: zFirst - st.so * MM,
            h: st.h * MM
        };
        if (res.empty) return res;
        const sys = GO.buildSystem(mEls);
        const sysOpt = GO.buildSystem(optics);
        res.sys = sys;
        res.sysOpt = sysOpt;
        const lam = st.lam;
        const lams = st.chrom ? [GO.LINES.F, GO.LINES.d, GO.LINES.C] : [lam];
        const lamRef = st.chrom ? GO.LINES.d : lam;
        res.lam = lam;
        res.lams = lams;
        res.lamRef = lamRef;
        const obj = res.obj;
        res.im = GO.imageOf(sysOpt, obj, lamRef);
        res.imAxial = GO.imageOf(sysOpt, obj.atInfinity ? {
            atInfinity: true,
            angle: 0
        } : {
            z: obj.z,
            h: 0
        }, lamRef);
        res.cp = GO.cardinalPoints(sysOpt, lamRef);
        res.sp = GO.stopsAndPupils(sys, obj, lamRef);
        res.fans = lams.map((l) => ({
            lambda: l,
            rays: GO.rayFan(sys, obj, st.nRays, l)
        }));

        if (res.sp.stop >= 0) {
            const mIn = res.sp.marginalIn;
            res.parMarg = {
                input: mIn,
                trace: GO.paraxialTrace(sys, mIn[0], mIn[1], lamRef)
            };
            if (res.sp.chiefIn) {
                const s = obj.atInfinity ? Math.tan(obj.angle) : obj.h;
                const cIn = [res.sp.chiefIn[0] * s, res.sp.chiefIn[1] * s];
                if (s !== 0) res.parChief = {
                    input: cIn,
                    trace: GO.paraxialTrace(sys, cIn[0], cIn[1], lamRef)
                };
            }
        }

        const fieldObj = obj.atInfinity ? {
            atInfinity: true,
            angle: obj.angle * st.spotField
        } : {
            z: obj.z,
            h: obj.h * st.spotField
        };
        res.fieldObj = fieldObj;
        const imField = GO.imageOf(sysOpt, fieldObj, lamRef);
        const angleMode = imField.atInfinity;
        let zPlane = imField.zImage,
            planeLabel = imField.virtual ? "virtual image plane" : "paraxial image plane";
        const det = list.find((e) => e.type === "detector");
        if (!angleMode && !imField.virtual) {
            if (st.spotPlane === "det" && det) {
                zPlane = det.z * MM;
                planeLabel = "detector";
            }
            if (st.spotPlane === "best") {
                const range = Math.max(0.5 * MM, Math.abs(imField.si) * 0.2);
                const bf = GO.bestFocus(sysOpt, fieldObj, imField.zImage, range, {
                    lambdas: lams,
                    lambdaRef: lamRef,
                    rings: 5
                });
                zPlane = bf.z;
                planeLabel = "best focus";
            }
        }
        res.spot = GO.spotDiagram(sysOpt, fieldObj, {
            lambdas: lams,
            lambdaRef: lamRef,
            zPlane,
            rings: 6,
            mode: angleMode ? "angle" : "plane"
        });
        res.spot.planeLabel = angleMode ? "output angles" : planeLabel;
        res.spot.zPlaneImage = imField.zImage;
        res.airy = GO.airy(lamRef, res.sp.naImage);

        res.airyAngle = Number.isFinite(res.sp.rXP) && res.sp.rXP > 0 ? 0.6098 * lamRef / res.sp.rXP : NaN;

        res.lsa = GO.longitudinalAberration(sysOpt, obj, lams, {
            n: 41,
            lambdaRef: lamRef
        });
        const fullField = obj.atInfinity ? obj.angle : obj.h;
        res.fieldZero = !fullField;
        const fr = Array.from({
            length: 11
        }, (_, i) => i / 10);
        res.fc = res.fieldZero ? null : GO.fieldCurves(sysOpt, obj, fr, lamRef);
        res.dist = res.fieldZero ? null : GO.distortion(sysOpt, obj, fr.slice(1), lamRef);
        res.conv = GO.exactVsParaxial(sysOpt, obj, [1, 0.5, 0.2, 0.1, 0.05, 0.01], lamRef);
        return res;
    }


    function fitView() {
        const list = ordered();
        const st = readState();
        const zs = [];
        let yMax = 5;
        list.forEach((e) => {
            zs.push(e.z);
            if (e.type === "lens") zs.push(e.z + (e.t || 0));
            if (e.semi > 0) yMax = Math.max(yMax, e.semi);
        });
        const span0 = zs.length ? Math.max(...zs) - Math.min(...zs) : 100;
        const zF = firstZ(list);
        if (!st.inf) {
            zs.push(zF - st.so);
            yMax = Math.max(yMax, Math.abs(st.h));
        } else zs.push(Math.min(...(zs.length ? zs : [0])) - Math.max(30, 0.35 * span0));
        try {
            const r = compute();
            if (!r.empty && r.im && !r.im.atInfinity && Number.isFinite(r.im.zImage)) {
                const zi = r.im.zImage / MM;
                const lim = 3 * Math.max(span0, st.inf ? 100 : st.so) + 200;
                if (Math.abs(zi - zF) < lim) {
                    zs.push(zi);
                    if (Number.isFinite(r.im.hImage) && Math.abs(r.im.hImage / MM) < 4 * yMax) yMax = Math.max(yMax, Math.abs(r.im.hImage / MM));
                }
            }
        } catch (e) {

        }
        let zMin = Math.min(...zs),
            zMax = Math.max(...zs);
        if (zMax - zMin < 20) {
            zMin -= 10;
            zMax += 10;
        }
        const pad = 0.08 * (zMax - zMin);
        view = {
            zMin: zMin - pad,
            zMax: zMax + pad * (hasDetectorAtEnd() ? 1 : 2.5),
            yMax: yMax * 1.3
        };
    }

    function hasDetectorAtEnd() {
        const l = ordered();
        return l.length && l[l.length - 1].type === "detector";
    }

    function ensureVisible(r) {
        if (drag) return;
        const st = r.st;
        const zF = firstZ(r.list);
        let changed = false;
        const grow = (z) => {
            if (!Number.isFinite(z)) return;
            const w = view.zMax - view.zMin;
            if (z < view.zMin) {
                view.zMin = z - 0.05 * w;
                changed = true;
            }
            if (z > view.zMax) {
                view.zMax = z + 0.05 * w;
                changed = true;
            }
        };
        if (!st.inf) grow(zF - st.so);
        r.list.forEach((e) => grow(e.z));
        if (!st.inf && Math.abs(st.h) > view.yMax * 0.95) {
            view.yMax = Math.abs(st.h) * 1.2;
            changed = true;
        }
        return changed;
    }


    function sag(y, R) {
        if (!R || !Number.isFinite(R)) return 0;
        const a = Math.abs(R);
        const yy = Math.min(Math.abs(y), a * 0.999);
        return R - Math.sign(R) * Math.sqrt(a * a - yy * yy);
    }

    function surfacePath(ctx, map, zv, R, semi) {
        const n = 40;
        for (let i = 0; i <= n; i++) {
            const y = -semi + 2 * semi * i / n;
            const p = map.toPx(zv + sag(y, R), y);
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
        }
    }

    function drawBench(ctx, w, h) {
        hitTargets = [];
        const r = result;
        if (!r) return;
        const map = UI.plot(ctx, {
            x: 0,
            y: 0,
            w,
            h
        }, {
            x: {
                min: view.zMin,
                max: view.zMax,
                label: "z",
                unit: "mm"
            },
            y: {
                min: -view.yMax,
                max: view.yMax,
                label: "y",
                unit: "mm"
            },
            series: [],
            legend: false
        });
        benchMap = map;
        const P = map.plot;
        labelBounds = P;
        const st = r.st;
        ctx.save();
        ctx.beginPath();
        ctx.rect(P.x, P.y, P.w, P.h);
        ctx.clip();
        ctx.font = "12px " + TH.font;

        ctx.strokeStyle = TH.gridStrong;
        ctx.lineWidth = 1;
        ctx.setLineDash([6, 4]);
        const a0 = map.toPx(view.zMin, 0),
            a1 = map.toPx(view.zMax, 0);
        ctx.beginPath();
        ctx.moveTo(a0.x, a0.y);
        ctx.lineTo(a1.x, a1.y);
        ctx.stroke();
        ctx.setLineDash([]);

        const semiOr = (e) => (e.semi > 0 ? e.semi : view.yMax * 0.85);
        const sp = r.sp || {};
        const stopEl = r.sys && sp.stop >= 0 ? r.sys.surfaces[sp.stop] : null;
        const fsEl = r.sys && sp.fieldStop >= 0 ? r.sys.surfaces[sp.fieldStop] : null;


        r.list.forEach((e) => {
            const sel = selected === e.id;
            const s = semiOr(e);
            ctx.lineWidth = sel ? 3 : 2;
            let x0 = map.xToPx(e.z);
            if (e.type === "thin") {
                const top = map.toPx(e.z, s),
                    bot = map.toPx(e.z, -s);
                ctx.strokeStyle = COL.lens;
                ctx.beginPath();
                ctx.moveTo(top.x, top.y);
                ctx.lineTo(bot.x, bot.y);
                ctx.stroke();
                const pos = !(e.f < 0);
                const ah = 7;
                ctx.beginPath();
                if (pos) {
                    ctx.moveTo(top.x - ah, top.y + ah);
                    ctx.lineTo(top.x, top.y);
                    ctx.lineTo(top.x + ah, top.y + ah);
                    ctx.moveTo(bot.x - ah, bot.y - ah);
                    ctx.lineTo(bot.x, bot.y);
                    ctx.lineTo(bot.x + ah, bot.y - ah);
                } else {
                    ctx.moveTo(top.x - ah, top.y - ah);
                    ctx.lineTo(top.x, top.y);
                    ctx.lineTo(top.x + ah, top.y - ah);
                    ctx.moveTo(bot.x - ah, bot.y + ah);
                    ctx.lineTo(bot.x, bot.y);
                    ctx.lineTo(bot.x + ah, bot.y + ah);
                }
                ctx.stroke();
                label(ctx, (e.name ? e.name + " " : "") + "f " + fmt(e.f, 3), top.x, top.y - 6, COL.lens);
                hitTargets.push({
                    id: e.id,
                    x: x0,
                    y0: top.y,
                    y1: bot.y
                });
            } else if (e.type === "lens") {
                const R1 = e.R1 || Infinity,
                    R2 = e.R2 || Infinity;
                const sM = Math.min(s, Number.isFinite(R1) ? Math.abs(R1) * 0.999 : Infinity, Number.isFinite(R2) ? Math.abs(R2) * 0.999 : Infinity);
                ctx.beginPath();
                surfacePath(ctx, map, e.z, R1, sM);
                const n = 40;
                for (let i = n; i >= 0; i--) {
                    const y = -sM + 2 * sM * i / n;
                    const p = map.toPx(e.z + e.t + sag(y, R2), y);
                    ctx.lineTo(p.x, p.y);
                }
                ctx.closePath();
                ctx.fillStyle = COL.lensFill;
                ctx.fill();
                ctx.strokeStyle = COL.lens;
                ctx.stroke();
                const top = map.toPx(e.z + e.t / 2, sM);
                label(ctx, (e.material || "") + " t " + fmt(e.t, 3), top.x, top.y - 6, COL.lens);
                hitTargets.push({
                    id: e.id,
                    x: x0,
                    x1: map.xToPx(e.z + e.t),
                    y0: map.yToPx(sM),
                    y1: map.yToPx(-sM)
                });
            } else if (e.type === "surface") {
                ctx.strokeStyle = COL.lens;
                ctx.beginPath();
                surfacePath(ctx, map, e.z, e.R || Infinity, Math.min(s, e.R ? Math.abs(e.R) * 0.999 : s));
                ctx.stroke();
                const top = map.toPx(e.z, s);
                label(ctx, "→ " + (GO.MATERIALS[e.material] ? e.material : "n " + e.material), top.x, top.y - 6, COL.lens);
                hitTargets.push({
                    id: e.id,
                    x: x0,
                    y0: top.y,
                    y1: map.yToPx(-s)
                });
            } else if (e.type === "mirror") {
                const R = e.R || Infinity;
                const sM = Math.min(s, Number.isFinite(R) ? Math.abs(R) * 0.999 : s);
                ctx.strokeStyle = COL.mirror;
                ctx.lineWidth = sel ? 4 : 3;
                ctx.beginPath();
                surfacePath(ctx, map, e.z, R, sM);
                ctx.stroke();
                ctx.lineWidth = 1;
                for (let i = 0; i <= 12; i++) {
                    const y = -sM + 2 * sM * i / 12;
                    const p = map.toPx(e.z + sag(y, R), y);
                    ctx.beginPath();
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(p.x + 7, p.y - 5);
                    ctx.stroke();
                }
                const top = map.toPx(e.z, sM);
                label(ctx, "mirror R " + fmt(e.R || Infinity, 3), top.x, top.y - 6, COL.mirror);
                hitTargets.push({
                    id: e.id,
                    x: x0,
                    y0: top.y,
                    y1: map.yToPx(-sM)
                });
            } else if (e.type === "stop") {
                const ext = Math.max(view.yMax * 0.14, 2);
                ctx.strokeStyle = COL.stop;
                ctx.lineWidth = sel ? 5 : 4;
                const semi = e.semi > 0 ? e.semi : view.yMax * 0.85;
                [
                    [semi, semi + ext],
                    [-semi, -semi - ext]
                ].forEach(([a, b]) => {
                    const p = map.toPx(e.z, a),
                        q = map.toPx(e.z, b);
                    ctx.beginPath();
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(q.x, q.y);
                    ctx.stroke();
                });
                const tag = e.name || "aperture";
                label(ctx, tag, x0, map.yToPx(semi + ext) - 6, COL.stop);
                hitTargets.push({
                    id: e.id,
                    x: x0,
                    y0: map.yToPx(semi + ext),
                    y1: map.yToPx(-semi - ext)
                });
            } else if (e.type === "detector") {
                const top = map.toPx(e.z, s),
                    bot = map.toPx(e.z, -s);
                ctx.strokeStyle = COL.detector;
                ctx.lineWidth = sel ? 6 : 4;
                ctx.globalAlpha = 0.8;
                ctx.beginPath();
                ctx.moveTo(top.x, top.y);
                ctx.lineTo(bot.x, bot.y);
                ctx.stroke();
                ctx.globalAlpha = 1;
                label(ctx, "detector", top.x, bot.y + 16, COL.detector);
                hitTargets.push({
                    id: e.id,
                    x: x0,
                    y0: top.y,
                    y1: bot.y
                });
            }
            if (sel) {
                ctx.strokeStyle = COL.select;
                ctx.setLineDash([3, 3]);
                ctx.lineWidth = 1;
                const t = hitTargets[hitTargets.length - 1];
                ctx.strokeRect(Math.min(t.x, t.x1 || t.x) - 8, t.y0 - 4, Math.abs((t.x1 || t.x) - t.x) + 16, t.y1 - t.y0 + 8);
                ctx.setLineDash([]);
            }
        });

        if (r.empty) {
            drawObject(ctx, map, r);
            ctx.restore();
            labelBounds = null;
            message(ctx, P, "Add a lens, surface or mirror to form an image.");
            return;
        }


        if (st.showPupils) {
            if (stopEl) markStop(ctx, map, stopEl, "AS");
            if (fsEl) markStop(ctx, map, fsEl, "FS");
            if (sp.stop >= 0 && !sp.epAtInfinity) pupilMark(ctx, map, sp.zEP / MM, sp.rEP / MM, "EP");
            if (sp.stop >= 0 && !sp.xpAtInfinity) pupilMark(ctx, map, sp.zXP / MM, sp.rXP / MM, "XP");
        }

        if (st.showCard && r.cp && !r.cp.afocal) {
            const cp = r.cp;
            const planeY = view.yMax * 0.78;
            [
                ["H", cp.zH],
                ["H′", cp.zHp]
            ].forEach(([n, z], i) => {
                const p = map.toPx(z / MM, planeY),
                    q = map.toPx(z / MM, -planeY);
                ctx.strokeStyle = COL.cardinal;
                ctx.globalAlpha = 0.6;
                ctx.setLineDash([4, 5]);
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(q.x, q.y);
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.globalAlpha = 1;
                label(ctx, n, p.x + (i ? 8 : -8), q.y + 14, COL.cardinal);
            });
            [
                ["F", cp.zF],
                ["F′", cp.zFp]
            ].forEach(([n, z]) => axisMark(ctx, map, z / MM, n, "tri"));
            if (Math.abs(cp.zN - cp.zH) > 1e-9)[["N", cp.zN], ["N′", cp.zNp]].forEach(([n, z]) => axisMark(ctx, map, z / MM, n, "dot"));
        }

        if (st.showConstr) drawConstruction(ctx, map, r);

        if (st.showParax) {
            if (r.parMarg) drawParaxial(ctx, map, r, r.parMarg, [1, -1]);
            if (r.parChief) drawParaxial(ctx, map, r, r.parChief, [1]);
        }

        if (st.showExact) drawFans(ctx, map, r);

        drawObject(ctx, map, r);
        drawImage(ctx, map, r);
        ctx.restore();

        const items = [];
        if (st.showExact) r.lams.forEach((l) => items.push([nmColor(l), "exact " + fmt(l / NM, 4) + " nm", []]));
        if (st.showParax) items.push([COL.paraxial, "paraxial", [6, 4]]);
        if (st.showConstr && !r.cp.afocal) items.push([COL.construct, "construction", [2, 3]]);
        labelBounds = null;
        if (w >= 520) legend(ctx, P, items);
    }

    function label(ctx, text, x, y, color, align = "center") {
        ctx.save();
        ctx.font = "12px " + TH.font;
        ctx.textAlign = align;
        ctx.textBaseline = "alphabetic";
        const w = ctx.measureText(text).width;
        let lx = align === "center" ? x - w / 2 : align === "right" ? x - w : x;
        const cssW = ctx.canvas.width / (ctx.getTransform().a || 1);
        const lo = labelBounds ? labelBounds.x + 2 : 4,
            hi = labelBounds ? labelBounds.x + labelBounds.w - 2 : cssW - 4;
        const shift = Math.min(0, hi - (lx + w)) + Math.max(0, lo - lx);
        lx += shift;
        x += shift;
        ctx.fillStyle = "rgba(7, 7, 13, 0.72)";
        ctx.fillRect(lx - 3, y - 12, w + 6, 16);
        ctx.fillStyle = color;
        ctx.fillText(text, x, y);
        ctx.restore();
    }

    function legend(ctx, P, items) {
        if (!items.length) return;
        ctx.save();
        ctx.font = "12px " + TH.font;
        const rowH = 17;
        const wMax = Math.max(...items.map((i) => ctx.measureText(i[1]).width)) + 36;
        const x = P.x + 6,
            y = P.y + 6;
        ctx.fillStyle = "rgba(7, 7, 13, 0.82)";
        ctx.fillRect(x, y, wMax, items.length * rowH + 6);
        items.forEach(([c, t, dash], i) => {
            const yy = y + 3 + rowH * i + rowH / 2;
            ctx.strokeStyle = c;
            ctx.lineWidth = 2;
            ctx.setLineDash(dash);
            ctx.beginPath();
            ctx.moveTo(x + 6, yy);
            ctx.lineTo(x + 26, yy);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = TH.text;
            ctx.textBaseline = "middle";
            ctx.textAlign = "left";
            ctx.fillText(t, x + 31, yy);
        });
        ctx.restore();
    }

    function message(ctx, P, text) {
        ctx.save();
        ctx.font = "13px " + TH.font;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const words = text.split(" ");
        const lines = [];
        let line = "";
        words.forEach((wd) => {
            const t = line ? line + " " + wd : wd;
            if (ctx.measureText(t).width > P.w - 30 && line) {
                lines.push(line);
                line = wd;
            } else line = t;
        });
        lines.push(line);
        const h = lines.length * 18 + 12;
        const wMax = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 20;
        ctx.fillStyle = "rgba(7, 7, 13, 0.85)";
        ctx.fillRect(P.x + P.w / 2 - wMax / 2, P.y + P.h / 2 - h / 2, wMax, h);
        ctx.fillStyle = TH.text;
        lines.forEach((l, i) => ctx.fillText(l, P.x + P.w / 2, P.y + P.h / 2 - h / 2 + 15 + i * 18));
        ctx.restore();
    }

    function markStop(ctx, map, s, tag) {
        const z = s.z / MM;
        const semi = Number.isFinite(s.semi) ? s.semi / MM : view.yMax * 0.85;
        const p = map.toPx(z, -semi);
        label(ctx, tag, p.x, p.y + 30, tag === "AS" ? COL.pupil : COL.stop);
    }

    function pupilMark(ctx, map, z, r, tag) {
        if (!Number.isFinite(z) || !Number.isFinite(r)) return;
        const top = map.toPx(z, r),
            bot = map.toPx(z, -r);
        ctx.save();
        ctx.strokeStyle = COL.pupil;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(top.x - 6, top.y);
        ctx.lineTo(top.x + 6, top.y);
        ctx.moveTo(bot.x - 6, bot.y);
        ctx.lineTo(bot.x + 6, bot.y);
        ctx.stroke();
        ctx.setLineDash([2, 4]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(top.x, top.y);
        ctx.lineTo(bot.x, bot.y);
        ctx.stroke();
        ctx.restore();
        label(ctx, tag, top.x + 10, top.y + 4, COL.pupil, "left");
    }

    function axisMark(ctx, map, z, text, kind) {
        const p = map.toPx(z, 0);
        ctx.save();
        ctx.fillStyle = COL.cardinal;
        ctx.beginPath();
        if (kind === "tri") {
            ctx.moveTo(p.x, p.y - 6);
            ctx.lineTo(p.x - 5, p.y + 4);
            ctx.lineTo(p.x + 5, p.y + 4);
            ctx.closePath();
        } else ctx.arc(p.x, p.y, 4, 0, 2 * Math.PI);
        ctx.fill();
        ctx.restore();
        label(ctx, text, p.x, p.y + (kind === "tri" ? 20 : -9), COL.cardinal);
    }


    function extendToEdge(z, y, dz, dy) {
        if (Math.abs(dz) < 1e-15) return [z, y + Math.sign(dy) * view.yMax * 3];
        const zEnd = dz > 0 ? view.zMax : view.zMin;
        const t = (zEnd - z) / dz;
        return [zEnd, y + t * dy];
    }

    function polyline(ctx, map, pts, color, width, dash, alpha = 1) {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.setLineDash(dash || []);
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        pts.forEach((q, i) => {
            const p = map.toPx(q[0], q[1]);
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();
        ctx.restore();
    }

    function drawFans(ctx, map, r) {
        const span = view.zMax - view.zMin;
        const lastIsDet = hasDetectorAtEnd();
        const kRef = r.sys.kRef;
        const virtualImg = r.im && !r.im.atInfinity && r.im.virtual;
        r.fans.forEach(({
            lambda,
            rays
        }) => {
            const c = nmColor(lambda);
            rays.forEach((tr) => {
                const pts = tr.points.map((p) => [p[2] / MM, p[1] / MM]);
                if (tr.status === "ok" && !lastIsDet) {
                    const e = pts[pts.length - 1];
                    pts.push(extendToEdge(e[0], e[1], tr.d[2], tr.d[1]));
                }
                polyline(ctx, map, pts, c, 1.4, [], 0.85);
                const endP = pts[pts.length - 1];
                if (tr.status === "tir") {
                    const L = 0.08 * span;
                    const q = [endP[0] + tr.d[2] * L, endP[1] + tr.d[1] * L * 1];
                    polyline(ctx, map, [endP, q], COL.tir, 1.6, [], 0.95);
                }
                if (tr.status === "vignetted" || tr.status === "missed") {
                    const p = map.toPx(endP[0], endP[1]);
                    ctx.save();
                    ctx.strokeStyle = TH.textMuted;
                    ctx.lineWidth = 1.2;
                    ctx.beginPath();
                    ctx.moveTo(p.x - 3, p.y - 3);
                    ctx.lineTo(p.x + 3, p.y + 3);
                    ctx.moveTo(p.x + 3, p.y - 3);
                    ctx.lineTo(p.x - 3, p.y + 3);
                    ctx.stroke();
                    ctx.restore();
                }
                if (virtualImg && tr.status === "ok" && tr.points.length > kRef + 1) {
                    const a = tr.points[kRef + 1];
                    const zi = r.im.zImage;
                    if (Math.abs(tr.d[2]) > 1e-12) {
                        const t = (zi - a[2]) / tr.d[2];
                        polyline(ctx, map, [
                            [a[2] / MM, a[1] / MM],
                            [(a[2] + t * tr.d[2]) / MM, (a[1] + t * tr.d[1]) / MM]
                        ], c, 1, [4, 4], 0.5);
                    }
                }
            });
        });
    }

    function drawParaxial(ctx, map, r, pr, signs) {
        const sys = r.sys,
            obj = r.obj;
        const zf = sys.surfaces[0].z;
        signs.forEach((sg) => {
            const y0 = pr.input[0] * sg,
                th0 = pr.input[1] * sg;
            const pts = [];
            if (obj.atInfinity) pts.push([view.zMin, (y0 - th0 * (zf - view.zMin * MM)) / MM]);
            else pts.push([obj.z / MM, (y0 - th0 * (zf - obj.z)) / MM]);
            pr.trace.forEach((t) => pts.push([t.z / MM, t.y * sg / MM]));
            const lastT = pr.trace[pr.trace.length - 1];
            if (!hasDetectorAtEnd()) {
                const e = pts[pts.length - 1];
                pts.push(extendToEdge(e[0], e[1], lastT.dirOut, lastT.thetaOut * sg * lastT.dirOut * lastT.dirOut));
            }
            polyline(ctx, map, pts, COL.paraxial, 1.2, [6, 4], 0.9);
        });
    }

    function drawConstruction(ctx, map, r) {
        const cp = r.cp,
            obj = r.obj,
            im = r.im;
        if (!cp || cp.afocal) return;
        const n1 = cp.nObj,
            n2 = cp.nImg,
            Pw = cp.power;
        const dirOut = r.sysOpt.dirOut;
        const rays = [];
        if (!obj.atInfinity) {
            if (!obj.h) return;
            const h = obj.h,
                zo = obj.z;
            rays.push({
                th: 0
            });
            if (Math.abs(cp.zF - zo) > 1e-9) rays.push({
                th: -h / (cp.zF - zo)
            });
            if (Math.abs(cp.zN - zo) > 1e-9) rays.push({
                th: -h / (cp.zN - zo)
            });
            rays.forEach((ry) => {
                ry.z0 = zo;
                ry.y0 = h;
                ry.yH = h + ry.th * (cp.zH - zo);
            });
        } else {
            const t = Math.tan(obj.angle);
            if (!t) return;
            [cp.zF, cp.zN].forEach((zc) => rays.push({
                th: t,
                yH: t * (cp.zH - zc)
            }));
            rays.forEach((ry) => {
                ry.z0 = view.zMin * MM;
                ry.y0 = ry.yH - t * (cp.zH - ry.z0);
            });
        }
        rays.forEach((ry) => {
            const thOut = (n1 * ry.th - Pw * ry.yH) / n2;
            polyline(ctx, map, [
                [ry.z0 / MM, ry.y0 / MM],
                [cp.zH / MM, ry.yH / MM]
            ], COL.construct, 1.3, [2, 3], 0.95);
            polyline(ctx, map, [
                [cp.zH / MM, ry.yH / MM],
                [cp.zHp / MM, ry.yH / MM]
            ], COL.construct, 1, [1, 4], 0.7);
            const e = extendToEdge(cp.zHp / MM, ry.yH / MM, dirOut, thOut);
            polyline(ctx, map, [
                [cp.zHp / MM, ry.yH / MM], e
            ], COL.construct, 1.3, [2, 3], 0.95);
            if (im && !im.atInfinity && im.virtual) {
                const zi = im.zImage / MM;
                const yi = ry.yH / MM + thOut * dirOut * (zi - cp.zHp / MM);
                polyline(ctx, map, [
                    [cp.zHp / MM, ry.yH / MM],
                    [zi, yi]
                ], COL.construct, 1, [1, 4], 0.6);
            }
        });
    }

    function arrow(ctx, map, z, y0, y1, color, dashed) {
        const a = map.toPx(z, y0),
            b = map.toPx(z, y1);
        ctx.save();
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 3;
        ctx.setLineDash(dashed ? [5, 4] : []);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.setLineDash([]);
        const dir = b.y < a.y ? 1 : -1;
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x - 6, b.y + 10 * dir);
        ctx.lineTo(b.x + 6, b.y + 10 * dir);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        return b;
    }

    function drawObject(ctx, map, r) {
        const obj = r.obj;
        if (obj.atInfinity) {
            const p = map.plot;
            label(ctx, "object at ∞, α = " + fmt(obj.angle / DEG, 3) + "°", p.x + 8, p.y + p.h - 10, COL.object, "left");
            return;
        }
        const z = obj.z / MM,
            h = obj.h / MM;
        const tip = arrow(ctx, map, z, 0, h || 0.0001, COL.object, false);
        label(ctx, "object", tip.x, h >= 0 ? tip.y - 8 : tip.y + 22, COL.object);
        hitTargets.push({
            id: "obj",
            x: tip.x,
            y0: Math.min(tip.y, map.yToPx(0)) - 6,
            y1: Math.max(tip.y, map.yToPx(0)) + 6,
            tip
        });
    }

    function drawImage(ctx, map, r) {
        const im = r.im;
        const P = map.plot;
        if (!im) return;
        if (im.atInfinity) {
            const t = r.obj.atInfinity ? "image at ∞ (afocal)" : "image at ∞";
            label(ctx, t, P.x + P.w - 8, P.y + P.h - 10, COL.image, "right");
            return;
        }
        const z = im.zImage / MM;
        const h = Number.isFinite(im.hImage) ? im.hImage / MM : 0;
        if (z < view.zMin || z > view.zMax) {
            label(ctx, (im.virtual ? "virtual image" : "image") + " at z = " + fmt(z, 4) + " mm (off view)", P.x + P.w - 8, P.y + P.h - 10, COL.image, "right");
            return;
        }
        if (!h) {
            axisMark(ctx, map, z, im.virtual ? "virtual image" : "image", "dot");
            return;
        }
        const tip = arrow(ctx, map, z, 0, h, COL.image, im.virtual);
        label(ctx, im.virtual ? "virtual image" : "image", tip.x, h >= 0 ? tip.y - 8 : tip.y + 22, COL.image);
    }


    function plotMessage(ctx, w, h, xAxis, yAxis, text) {
        const map = UI.plot(ctx, {
            x: 0,
            y: 0,
            w,
            h
        }, {
            x: xAxis,
            y: yAxis,
            series: [],
            legend: false
        });
        message(ctx, map.plot, text);
        return map;
    }

    const lamLabel = (l) => (Math.abs(l - GO.LINES.F) < 1e-12 ? "F 486 nm" : Math.abs(l - GO.LINES.d) < 1e-12 ? "d 588 nm" : Math.abs(l - GO.LINES.C) < 1e-12 ? "C 656 nm" : fmt(l / NM, 4) + " nm");

    function drawSpot(ctx, w, h) {
        const r = result;
        if (!r || r.empty || !r.spot) {
            plotMessage(ctx, w, h, {
                min: -1,
                max: 1,
                label: "x",
                unit: "µm"
            }, {
                min: -1,
                max: 1,
                label: "y",
                unit: "µm"
            }, "No spot: add optics.");
            return;
        }
        const s = r.spot;
        const angle = s.mode === "angle";
        let scale, unit;
        let extent = 0;
        s.points.forEach((p) => {
            extent = Math.max(extent, Math.abs(p.x), Math.abs(p.y));
        });
        const airyR = angle ? r.airyAngle : r.airy.radius;
        if (Number.isFinite(airyR)) extent = Math.max(extent, airyR);
        if (angle) {
            if (extent > 1e-3) {
                scale = 1e3;
                unit = "mrad";
            } else {
                scale = 1e6;
                unit = "µrad";
            }
        } else if (extent > 1e-3) {
            scale = 1e3;
            unit = "mm";
        } else {
            scale = 1e6;
            unit = "µm";
        }
        let ext = Math.max(extent * scale * 1.15, angle ? 1e-3 : 1e-3);
        if (!(ext > 0)) ext = 1;
        const fs = 12,
            ml = fs * 4.4,
            mr = fs * 1.1,
            mt = fs * 0.9,
            mb = fs * 3.4;
        const ratio = Math.max(0.3, (w - ml - mr) / Math.max(10, h - mt - mb));
        const series = r.lams.map((l, i) => ({
            xs: s.points.filter((p) => p.lambda === l).map((p) => p.x * scale),
            ys: s.points.filter((p) => p.lambda === l).map((p) => p.y * scale),
            color: nmColor(l),
            pointsOnly: true,
            pointRadius: 1.8,
            label: r.lams.length > 1 ? lamLabel(l) : undefined,
            dash: TH.dashes[i]
        }));
        const map = UI.plot(ctx, {
            x: 0,
            y: 0,
            w,
            h
        }, {
            x: {
                min: -ext * ratio,
                max: ext * ratio,
                label: angle ? "Δu′x" : "Δx",
                unit
            },
            y: {
                min: -ext,
                max: ext,
                label: angle ? "Δu′y" : "Δy",
                unit
            },
            series,
            legend: r.lams.length > 1
        });
        if (Number.isFinite(airyR)) {
            const c = map.toPx(0, 0);
            const rx = map.xToPx(airyR * scale) - c.x,
                ry = c.y - map.yToPx(airyR * scale);
            ctx.save();
            ctx.beginPath();
            ctx.rect(map.plot.x, map.plot.y, map.plot.w, map.plot.h);
            ctx.clip();
            ctx.strokeStyle = COL.cardinal;
            ctx.setLineDash([5, 4]);
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.ellipse(c.x, c.y, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, 2 * Math.PI);
            ctx.stroke();
            ctx.restore();
        }
        const P = map.plot;
        const rmsTxt = "RMS " + fsmall(s.rms, scale, unit) + " · " + s.planeLabel;
        label(ctx, rmsTxt, P.x + 8, P.y + P.h - 8, TH.text, "left");
        if (Number.isFinite(airyR)) label(ctx, "Airy r " + fmt(airyR * scale, 3) + " " + unit, P.x + 8, P.y + P.h - 28, COL.cardinal, "left");
    }

    function drawLsa(ctx, w, h) {
        const r = result;
        const xA = {
                label: "Δz from paraxial focus (" + (r && r.st.chrom ? "d" : r ? fmt(r.lamRef / NM, 4) + " nm" : "d") + ")",
                unit: "mm"
            },
            yA = {
                min: 0,
                max: 1.02,
                label: "pupil height ρ"
            };
        if (!r || r.empty) {
            plotMessage(ctx, w, h, Object.assign({
                min: -1,
                max: 1
            }, xA), yA, "No system.");
            return;
        }
        if (r.lsa.afocal) {
            plotMessage(ctx, w, h, Object.assign({
                min: -1,
                max: 1
            }, xA), yA, "Image at infinity: longitudinal aberration is undefined. Read the angular spot instead.");
            return;
        }
        let lo = 0,
            hi = 0;
        r.lsa.curves.forEach((c) => c.dz.forEach((v) => {
            if (Number.isFinite(v)) {
                lo = Math.min(lo, v / MM);
                hi = Math.max(hi, v / MM);
            }
        }));
        const span = Math.max(hi - lo, 0.02);
        const series = r.lsa.curves.map((c, i) => ({
            xs: c.dz.map((v) => v / MM),
            ys: c.rho,
            color: nmColor(c.lambda),
            dash: TH.dashes[i],
            label: lamLabel(c.lambda)
        }));
        UI.plot(ctx, {
            x: 0,
            y: 0,
            w,
            h
        }, {
            x: Object.assign({
                min: lo - 0.08 * span,
                max: hi + 0.08 * span
            }, xA),
            y: yA,
            series,
            markers: [{
                x: 0,
                label: "paraxial",
                color: TH.textMuted
            }],
            legend: true,
            legendPosition: lo < -hi ? "right" : "left"
        });
    }

    function drawField(ctx, w, h) {
        const r = result;
        const xA = {
                label: "Δz from paraxial image",
                unit: "mm"
            },
            yA = {
                min: 0,
                max: 1.02,
                label: "field fraction"
            };
        if (!r || r.empty) {
            plotMessage(ctx, w, h, Object.assign({
                min: -1,
                max: 1
            }, xA), yA, "No system.");
            return;
        }
        if (r.fieldZero) {
            plotMessage(ctx, w, h, Object.assign({
                min: -1,
                max: 1
            }, xA), yA, "Set a non-zero object height or field angle.");
            return;
        }
        if (r.fc.imageAtInfinity) {
            plotMessage(ctx, w, h, Object.assign({
                min: -1,
                max: 1
            }, xA), yA, "Image at infinity: focus shifts are measured in dioptres, not shown here.");
            return;
        }
        const pts = r.fc.points;
        const T = pts.map((p) => p.dzT / MM),
            S = pts.map((p) => p.dzS / MM),
            f = pts.map((p) => p.fraction);
        let lo = 0,
            hi = 0;
        T.concat(S).forEach((v) => {
            if (Number.isFinite(v)) {
                lo = Math.min(lo, v);
                hi = Math.max(hi, v);
            }
        });
        const span = Math.max(hi - lo, 0.02);
        UI.plot(ctx, {
            x: 0,
            y: 0,
            w,
            h
        }, {
            x: Object.assign({
                min: lo - 0.1 * span,
                max: hi + 0.1 * span
            }, xA),
            y: yA,
            series: [{
                xs: T,
                ys: f,
                color: TH.series[2],
                label: "T tangential"
            }, {
                xs: S,
                ys: f,
                color: TH.series[0],
                dash: [7, 4],
                label: "S sagittal"
            }],
            markers: [{
                x: 0,
                color: TH.textMuted
            }],
            legendPosition: lo < -hi ? "right" : "left"
        });
    }

    function drawDist(ctx, w, h) {
        const r = result;
        const xA = {
                label: "distortion",
                unit: "%"
            },
            yA = {
                min: 0,
                max: 1.02,
                label: "field fraction"
            };
        if (!r || r.empty) {
            plotMessage(ctx, w, h, Object.assign({
                min: -1,
                max: 1
            }, xA), yA, "No system.");
            return;
        }
        if (r.fieldZero) {
            plotMessage(ctx, w, h, Object.assign({
                min: -1,
                max: 1
            }, xA), yA, "Set a non-zero object height or field angle.");
            return;
        }
        const pts = [{
            fraction: 0,
            distortion: 0
        }].concat(r.dist.points);
        const xs = pts.map((p) => p.distortion * 100),
            ys = pts.map((p) => p.fraction);
        let m = 0;
        xs.forEach((v) => {
            if (Number.isFinite(v)) m = Math.max(m, Math.abs(v));
        });
        m = Math.max(m * 1.2, 0.1);
        UI.plot(ctx, {
            x: 0,
            y: 0,
            w,
            h
        }, {
            x: Object.assign({
                min: -m,
                max: m
            }, xA),
            y: yA,
            series: [{
                xs,
                ys,
                color: TH.series[3],
                label: r.dist.imageAtInfinity ? "tan u′ (image at ∞)" : "chief-ray height"
            }],
            markers: [{
                x: 0,
                color: TH.textMuted
            }],
            legendPosition: "left"
        });
    }


    function setText(id, t) {
        const el = $(id);
        if (el && el.textContent !== t) el.textContent = t;
    }

    function elementName(sys, k) {
        if (k < 0 || !sys) return "none";
        const s = sys.surfaces[k];
        const e = els.find((x) => x.id === s.id);
        const idx = ordered().indexOf(e) + 1;
        const base = e ? (e.name || TYPE_NAMES[e.type]) : s.kind;
        return "#" + idx + " " + base + (e && e.type === "lens" ? (s.part === 1 ? " (front)" : " (back)") : "");
    }

    function updateReadouts(r) {
        const st = r.st;
        setText("objDistVal", fmt(st.so, 5) + " mm");
        setText("objHVal", fmt(st.h, 4) + " mm");
        setText("objAngVal", fmt(st.ang, 3) + "°");
        setText("lamVal", fmt(st.lam / NM, 4) + " nm");
        setText("nRaysVal", String(st.nRays));
        setText("spotFieldVal", fmt(st.spotField, 3));
        $("grpDist").hidden = st.inf;
        $("grpH").hidden = st.inf;
        $("grpAng").hidden = !st.inf;
        const warn = [];
        if (r.empty) {
            ["statEfl", "statSi", "statM", "statNA", "statRms"].forEach((id) => setText(id, "—"));
            setText("warnBox", "The system has no lens, surface or mirror.");
            $("warnBox").hidden = false;
            return;
        }
        const im = r.im,
            cp = r.cp,
            sp = r.sp;

        let imgTxt, siTxt, mTxt, mLabel = "Magnification";
        if (im.atInfinity) {
            siTxt = "∞";
            if (r.obj.atInfinity) {
                imgTxt = "at ∞ (afocal system)";
                mTxt = fmt(im.angularMagnification, 4) + "×";
                mLabel = "Angular magnification";
            } else {
                const vis = r.obj.h ? im.angularOut / (-r.obj.h / (250 * MM)) : NaN;
                imgTxt = "at ∞: output slope " + fmt(im.angularOut * 1e3, 4) + " mrad for rays from the object top";
                mTxt = Number.isFinite(vis) ? fmt(vis, 4) + "× (vs 250 mm)" : "—";
                mLabel = "Visual magnification";
            }
        } else {
            siTxt = fmm(im.si, 5) + (im.virtual ? " (virtual)" : "");
            imgTxt = "s_i = " + fmm(im.si, 5) + " after " + elementName(r.sysOpt, r.sysOpt.kRef).replace(/^#\d+ /, "") + ", z = " + fmm(im.zImage, 5) + (im.virtual ? ", virtual" : ", real");
            if (r.obj.atInfinity) {
                mTxt = "h′ = " + fmm(im.hImage, 4);
                mLabel = "Image height";
            } else {
                mTxt = fmt(im.m, 4) + (im.m < 0 ? " (inverted)" : " (upright)");
            }
        }
        setText("rImage", imgTxt);
        setText("rMag", mLabel + ": " + mTxt);
        setText("statSi", siTxt);
        setText("statM", mTxt);
        setText("statMLabel", mLabel);
        if (cp.afocal) {
            setText("rEfl", "afocal (P = 0)");
            setText("rBfd", "—");
            setText("rF", "at ∞");
            setText("rH", "at ∞");
            setText("rN", "at ∞");
            setText("statEfl", "afocal");
        } else {
            setText("rEfl", fmm(cp.efl, 5) + " (f = " + fmm(cp.fFront, 4) + ", f′ = " + fmm(cp.fRear, 4) + ")");
            setText("rBfd", fmm(cp.bfd, 5) + " / " + fmm(cp.ffd, 5));
            setText("rF", fmm(cp.zF, 5) + ", " + fmm(cp.zFp, 5));
            setText("rH", fmm(cp.zH, 5) + ", " + fmm(cp.zHp, 5));
            setText("rN", fmm(cp.zN, 5) + ", " + fmm(cp.zNp, 5));
            setText("statEfl", fmm(cp.efl, 4));
        }
        setText("rStops", sp.stop < 0 ? "no finite aperture" : elementName(r.sys, sp.stop) + " / " + elementName(r.sys, sp.fieldStop));
        setText("rEP", sp.stop < 0 ? "—" : sp.epAtInfinity ? "at ∞ (object-space telecentric)" : "z = " + fmm(sp.zEP, 5) + ", radius " + fmm(sp.rEP, 4));
        setText("rXP", sp.stop < 0 ? "—" : sp.xpAtInfinity ? "at ∞ (image-space telecentric)" : "z = " + fmm(sp.zXP, 5) + ", radius " + fmm(sp.rXP, 4));
        setText("rNA", sp.stop < 0 ? "—" : fmt(sp.naObject, 4) + " / " + fmt(sp.naImage, 4));
        setText("rFno", sp.naImage > 1e-9 ? "f/" + fmt(sp.fNumberWorking, 3) : "∞ (image at ∞)");
        setText("statNA", sp.stop < 0 ? "—" : fmt(sp.naImage, 3));
        const lamRef = r.lamRef;
        const s = r.spot;
        let dl = false;
        if (s.mode === "angle") {
            setText("rAiry", Number.isFinite(r.airyAngle) ? "angular diameter " + fmt(2 * r.airyAngle * 1e6, 4) + " µrad (2.44 λ/D_XP)" : "—");
            setText("rSpot", fsmall(s.rms, 1e6, "µrad") + " vs " + fmt(r.airyAngle * 1e6, 3) + " µrad");
            dl = s.rms < r.airyAngle;
            setText("statRms", fsmall(s.rms, 1e6, "µrad"));
        } else {
            setText("rAiry", Number.isFinite(r.airy.diameter) ? fmt(r.airy.diameter / 1e-6, 4) + " µm at λ = " + fmt(lamRef / NM, 4) + " nm" : "—");
            setText("rSpot", fsmall(s.rms, 1e6, "µm") + " vs " + fmt(r.airy.radius / 1e-6, 3) + " µm (" + s.planeLabel + ")");
            dl = s.rms < r.airy.radius;
            setText("statRms", fsmall(s.rms, 1e6, "µm"));
        }
        const link = $("fourierLink");
        link.classList.toggle("is-diffraction-limited", dl);
        const M = cp.M;
        setText("rAbcd", "[[" + fmt(M[0][0], 4) + ", " + fmt(M[0][1] / MM, 4) + "], [" + fmt(M[1][0] * MM, 4) + ", " + fmt(M[1][1], 4) + "]]  det " + fmt(cp.det, 4));
        if (sp.fieldStop >= 0 && Number.isFinite(sp.fieldLimit)) {
            setText("rField", r.obj.atInfinity ? "α ≤ " + fmt(Math.atan(sp.fieldLimit) / DEG, 3) + "°" : "|h| ≤ " + fmm(sp.fieldLimit, 4));
        } else setText("rField", "—");

        let tir = 0,
            vig = 0,
            total = 0;
        r.fans.forEach((f) => f.rays.forEach((t) => {
            total++;
            if (t.status === "tir") tir++;
            else if (t.status !== "ok") vig++;
        }));
        if (tir) warn.push(tir + " of " + total + " fan rays are totally internally reflected (orange). The sequential trace stops them.");
        if (vig > total / 3) warn.push(vig + " of " + total + " fan rays are vignetted by an aperture or miss a surface.");
        if (s.vignetted > 0.3) warn.push(Math.round(s.vignetted * 100) + " % of the spot-diagram rays are lost (vignetted, missed or TIR).");
        if (sp.naImage > 0.5) warn.push("NA′ > 0.5: paraxial pupil quantities are only indicative at this aperture.");
        const wb = $("warnBox");
        wb.textContent = warn.join(" ");
        wb.hidden = !warn.length;

        const convRows = r.conv.rows;
        const slope = r.conv.imageAtInfinity;
        setText("convDeltaHead", slope ? "Exact − paraxial output slope" : "Exact − paraxial axial crossing");
        const tb = $("convTable").querySelector("tbody");
        tb.innerHTML = convRows.map((row) => {
            const d = row.delta;
            const dTxt = !Number.isFinite(d) ? row.status : slope ? fmt(d * 1e6, 4) + " µrad" : fmt(d / 1e-6, 4) + " µm";
            const kTxt = !Number.isFinite(d) ? "—" : slope ? fmt(d / row.rho ** 2 * 1e6, 4) + " µrad" : fmt(d / row.rho ** 2 / 1e-6, 4) + " µm";
            return "<tr><td>" + row.rho + "</td><td>" + fmm(row.height, 4) + "</td><td>" + dTxt + "</td><td>" + kTxt + "</td></tr>";
        }).join("");

        const ix = GO.indicesAt(r.sys, lamRef);
        const marg = r.parMarg ? r.parMarg.trace : null;
        $("surfTable").querySelector("tbody").innerHTML = r.sys.surfaces.map((s2, k) => {
            const R = s2.kind === "refract" || s2.kind === "mirror" ? (Number.isFinite(s2.R) ? fmt(s2.R / MM, 5) : "∞") : s2.kind === "thin" ? "f " + fmt(ix.list[k].f / MM, 5) : "—";
            return "<tr><td>" + (k + 1) + "</td><td>" + s2.kind + (k === sp.stop ? " (AS)" : k === sp.fieldStop ? " (FS)" : "") + "</td><td>" + fmt(s2.z / MM, 5) + "</td><td>" + R + "</td><td>" +
                ix.list[k].nBefore.toFixed(5) + " → " + ix.list[k].nAfter.toFixed(5) + "</td><td>" + (Number.isFinite(s2.semi) ? fmt(s2.semi / MM, 4) : "∞") + "</td><td>" + (marg ? fmt(marg[k].y / MM, 4) : "—") + "</td></tr>";
        }).join("");
    }

    function describe(r) {
        if (r.empty) {
            benchDesc.update("Optical bench with no powered elements.");
            return;
        }
        const im = r.im,
            cp = r.cp;
        const imTxt = im.atInfinity ? "image at infinity" : (im.virtual ? "virtual" : "real") + " image at z = " + fmt(im.zImage / MM, 4) + " mm" + (Number.isFinite(im.m) ? ", magnification " + fmt(im.m, 3) : "");
        benchDesc.update(r.list.length + " elements. " + (r.obj.atInfinity ? "Object at infinity, field angle " + fmt(r.obj.angle / DEG, 3) + " degrees. " : "Object " + fmt(r.st.so, 4) + " mm before the first element, height " + fmt(r.st.h, 3) + " mm. ") +
            imTxt + ". " + (cp.afocal ? "Afocal system." : "Effective focal length " + fmt(cp.efl / MM, 4) + " mm."));
        const s = r.spot;
        spotDesc.update("Spot diagram at " + s.planeLabel + ": " + s.points.length + " rays, RMS radius " + (s.mode === "angle" ? fmt(s.rms * 1e6, 3) + " microradians" : fmt(s.rms / 1e-6, 3) + " micrometres") + ".");
        if (!r.lsa.afocal) {
            const c = r.lsa.curves[Math.floor(r.lsa.curves.length / 2)];
            lsaDesc.update("Longitudinal aberration: marginal ray (rho = 1) crosses the axis " + fmt(c.dz[c.dz.length - 1] / MM, 3) + " mm from the paraxial focus at " + fmt(c.lambda / NM, 4) + " nm.");
        } else lsaDesc.update("Image at infinity; longitudinal aberration not defined.");
        if (r.fc && !r.fc.imageAtInfinity) {
            const p = r.fc.points[r.fc.points.length - 1];
            fieldDesc.update("At full field the tangential focus is " + fmt(p.dzT / MM, 3) + " mm and the sagittal focus " + fmt(p.dzS / MM, 3) + " mm from the paraxial image plane.");
        } else fieldDesc.update("Field curves unavailable for this configuration.");
        if (r.dist) {
            const p = r.dist.points[r.dist.points.length - 1];
            distDesc.update("Distortion at full field: " + fmt(p.distortion * 100, 3) + " percent.");
        } else distDesc.update("Distortion unavailable: zero field.");
    }


    function optionLabel(e, i) {
        const t = TYPE_NAMES[e.type];
        const extra = e.type === "thin" ? " f " + fmt(e.f, 4) : e.type === "mirror" ? " R " + fmt(e.R || Infinity, 4) : e.type === "lens" ? " " + (e.material || "") : "";
        return "#" + (i + 1) + " " + (e.name ? e.name + " (" + t.toLowerCase() + ")" : t) + extra + " at z " + fmt(e.z, 4) + " mm";
    }

    function rebuildSelect() {
        const sel = $("elSelect");
        const list = ordered();
        const html = ['<option value="obj">Object</option>'].concat(list.map((e, i) => '<option value="' + e.id + '">' + optionLabel(e, i) + "</option>")).join("");
        if (sel.innerHTML !== html) sel.innerHTML = html;
        sel.value = String(selected);
        if (sel.value !== String(selected)) {
            selected = "obj";
            sel.value = "obj";
        }
        document.querySelectorAll("[data-add]").forEach((b) => {
            const t = b.dataset.add;
            b.disabled = (t === "mirror" && hasMirror()) || (t === "detector" && els.some((e) => e.type === "detector"));
        });
        $("btnRemove").disabled = selected === "obj";
    }

    const FIELD_DEFS = {
        thin: [
            ["z", "Position z", "mm"],
            ["f", "Focal length f", "mm"],
            ["semi", "Semi-aperture (0 = open)", "mm"],
            ["material", "Dispersion", "matThin"]
        ],
        lens: [
            ["z", "Front vertex z", "mm"],
            ["t", "Centre thickness", "mm"],
            ["R1", "R₁ (0 = flat)", "mm"],
            ["R2", "R₂ (0 = flat)", "mm"],
            ["semi", "Semi-aperture", "mm"],
            ["material", "Glass", "mat"]
        ],
        surface: [
            ["z", "Vertex z", "mm"],
            ["R", "R (0 = flat)", "mm"],
            ["semi", "Semi-aperture", "mm"],
            ["material", "Medium after", "mat"]
        ],
        mirror: [
            ["z", "Vertex z", "mm"],
            ["R", "R (0 = plane; < 0 concave to incoming light)", "mm"],
            ["semi", "Semi-aperture", "mm"]
        ],
        stop: [
            ["z", "Position z", "mm"],
            ["semi", "Aperture radius", "mm"]
        ],
        detector: [
            ["z", "Position z", "mm"],
            ["semi", "Half-height (0 = unlimited)", "mm"]
        ]
    };

    function rebuildEditor() {
        rebuildSelect();
        const host = $("elEditor");
        host.innerHTML = "";
        if (selected === "obj") {
            const p = document.createElement("p");
            p.className = "go-editor-note";
            p.textContent = "Object: use the Object card, drag the green arrow, or focus the bench and use the arrow keys.";
            host.appendChild(p);
            return;
        }
        const e = els.find((x) => x.id === selected);
        if (!e) return;
        FIELD_DEFS[e.type].forEach(([key, text, kind]) => {
            const lab = document.createElement("label");
            lab.textContent = text + (kind === "mm" ? " (mm)" : "");
            let input;
            if (kind === "mm") {
                input = document.createElement("input");
                input.type = "number";
                input.step = "any";
                input.inputMode = "decimal";
                input.value = String(e[key] != null ? e[key] : 0);
            } else {
                input = document.createElement("select");
                const opts = (kind === "matThin" ? [
                    ["ideal", "None (ideal, achromatic)"]
                ] : []).concat(MATERIALS, [
                    ["custom", "Constant index…"]
                ]);
                input.innerHTML = opts.map(([v, t]) => '<option value="' + v + '">' + t + "</option>").join("");
                const cur = e.material == null ? (kind === "matThin" ? "ideal" : "BK7") : String(e.material);
                input.value = opts.some((o) => o[0] === cur) ? cur : "custom";
            }
            input.dataset.key = key;
            input.addEventListener("change", () => {
                if (kind === "mm") {
                    const v = Number(input.value);
                    if (!Number.isFinite(v)) {
                        input.setAttribute("aria-invalid", "true");
                        return;
                    }
                    input.removeAttribute("aria-invalid");
                    let val = v;
                    if (key === "t") val = Math.max(0.1, v);
                    if (key === "semi") val = Math.max(0, v);
                    if (key === "f" && v === 0) val = 1e9;
                    e[key] = val;
                } else if (input.value === "custom") {
                    const cur = Number(e.material);
                    e.material = String(Number.isFinite(cur) && cur >= 1 ? cur : 1.6);
                    rebuildEditor();
                } else e.material = input.value;
                commitChange(false);
            });
            lab.appendChild(input);
            host.appendChild(lab);
            if (kind !== "mm" && e.material != null && !GO.MATERIALS[e.material] && e.material !== "ideal") {
                const l2 = document.createElement("label");
                l2.textContent = "Index n (constant)";
                const n = document.createElement("input");
                n.type = "number";
                n.step = "0.001";
                n.min = "1";
                n.max = "4";
                n.value = String(e.material);
                n.addEventListener("change", () => {
                    const v = Number(n.value);
                    if (Number.isFinite(v) && v >= 1) {
                        e.material = String(v);
                        commitChange(false);
                    }
                });
                l2.appendChild(n);
                host.appendChild(l2);
            }
        });
        if (hasMirror() && e.type !== "mirror") {
            const lab = document.createElement("label");
            lab.textContent = "Path";
            const s = document.createElement("select");
            s.innerHTML = '<option value="0">Before the mirror (incoming)</option><option value="1">After the mirror (returning)</option>';
            s.value = e.after ? "1" : "0";
            s.addEventListener("change", () => {
                e.after = s.value === "1";
                commitChange(false);
            });
            lab.appendChild(s);
            host.appendChild(lab);
        }
    }

    function syncEditorValues() {
        if (selected === "obj") return;
        const e = els.find((x) => x.id === selected);
        if (!e) return;
        $("elEditor").querySelectorAll("input[data-key]").forEach((inp) => {
            if (document.activeElement === inp) return;
            const v = e[inp.dataset.key];
            if (v != null && Number(inp.value) !== v) inp.value = String(v);
        });
    }

    function commitChange(refit) {
        if (refit) fitView();
        rebuildSelect();
        url.update();
        schedule();
    }

    function addElement(type) {
        const list = ordered();
        const mirror = els.find((e) => e.type === "mirror");
        let z;
        if (mirror && type !== "mirror") z = mirror.z - 40;
        else if (type === "detector") {
            const r = result;
            z = r && r.im && !r.im.atInfinity && Number.isFinite(r.im.zImage) ? Math.round(r.im.zImage / MM * 10) / 10 : (list.length ? list[list.length - 1].z + 50 : 100);
        } else {
            const det = list.find((e) => e.type === "detector");
            const zs = list.filter((e) => e.type !== "detector").map((e) => e.z + (e.t || 0));
            z = zs.length ? Math.max(...zs) + 40 : 0;
            if (det && z >= det.z) z = (Math.max(...(zs.length ? zs : [det.z - 20])) + det.z) / 2;
        }
        const e = {
            id: nextId++,
            type,
            z: Math.round(z * 10) / 10,
            semi: 15,
            name: "",
            after: false
        };
        if (type === "thin") {
            e.f = 50;
            e.material = "ideal";
        }
        if (type === "lens") {
            e.R1 = 50;
            e.R2 = -50;
            e.t = 6;
            e.material = "BK7";
        }
        if (type === "surface") {
            e.R = 40;
            e.material = "BK7";
        }
        if (type === "mirror") {
            e.R = -100;
            e.semi = 20;
        }
        if (type === "stop") {
            e.semi = 5;
        }
        if (type === "detector") {
            e.semi = 15;
            e.after = hasMirror();
        }
        els.push(e);
        selected = e.id;
        rebuildEditor();
        commitChange(true);
    }


    function buildPresetButtons() {
        const host = $("presetButtons");
        if (!host.children.length) {
            Object.entries(GO.PRESETS).forEach(([k, p]) => {
                const b = document.createElement("button");
                b.type = "button";
                b.className = "preset-option";
                b.dataset.preset = k;
                b.textContent = p.label;
                b.title = p.expect;
                b.addEventListener("click", () => loadPreset(k));
                host.appendChild(b);
            });
        }
        host.querySelectorAll("button").forEach((b) => {
            const on = b.dataset.preset === presetKey;
            b.classList.toggle("active", on);
            b.setAttribute("aria-pressed", on ? "true" : "false");
        });
        setText("presetNote", "Expected: " + GO.PRESETS[presetKey].expect);
    }

    function setControl(id, v) {
        const el = $(id);
        if (el.type === "checkbox") el.checked = !!v;
        else el.value = String(v);
    }

    function loadPreset(k, resetDisplay) {
        presetKey = k;
        const p = presetToUI(k);
        selected = "obj";
        setControl("objInf", p.object.atInfinity);
        setControl("objDist", lenUI(p.object.dist));
        setControl("objH", lenUI(p.object.h));
        setControl("objAng", p.object.angle);
        setControl("chrom", !!CHROM_PRESETS[k]);
        setControl("spotPlane", "det");
        if (resetDisplay) {
            setControl("lam", 587.6);
            setControl("showExact", true);
            setControl("showParax", false);
            setControl("showConstr", true);
            setControl("showCard", true);
            setControl("showPupils", true);
            setControl("nRays", 9);
            setControl("spotField", 1);
        }
        buildPresetButtons();
        rebuildEditor();
        fitView();
        url.update();
        render();
    }


    const benchCanvas = $("benchCanvas");
    const benchDesc = UI.describeCanvas(benchCanvas, "Optical bench", {
        label: "Optical bench: elements, exact and paraxial rays, object and image"
    });
    const spotDesc = UI.describeCanvas($("spotCanvas"), "Spot diagram", {
        label: "Spot diagram at the image plane"
    });
    const lsaDesc = UI.describeCanvas($("lsaCanvas"), "Longitudinal aberration", {
        label: "Longitudinal aberration versus pupil height"
    });
    const fieldDesc = UI.describeCanvas($("fieldCanvas"), "Field curves", {
        label: "Tangential and sagittal field curves"
    });
    const distDesc = UI.describeCanvas($("distCanvas"), "Distortion", {
        label: "Distortion versus field"
    });

    const bench = UI.setupCanvas(benchCanvas, {
        aspect: 2.3,
        minHeight: 300,
        maxHeight: 560,
        draw: (ctx, w, h) => drawBench(ctx, w, h)
    });
    const spotC = UI.setupCanvas($("spotCanvas"), {
        aspect: 1.25,
        minHeight: 240,
        maxHeight: 420,
        draw: (ctx, w, h) => drawSpot(ctx, w, h)
    });
    const lsaC = UI.setupCanvas($("lsaCanvas"), {
        aspect: 1.25,
        minHeight: 240,
        maxHeight: 420,
        draw: (ctx, w, h) => drawLsa(ctx, w, h)
    });
    const fieldC = UI.setupCanvas($("fieldCanvas"), {
        aspect: 1.25,
        minHeight: 240,
        maxHeight: 420,
        draw: (ctx, w, h) => drawField(ctx, w, h)
    });
    const distC = UI.setupCanvas($("distCanvas"), {
        aspect: 1.25,
        minHeight: 240,
        maxHeight: 420,
        draw: (ctx, w, h) => drawDist(ctx, w, h)
    });

    function render() {
        rafPending = false;
        try {
            result = compute();
        } catch (err) {
            console.error(err);
            $("warnBox").textContent = "Could not trace this configuration: " + err.message;
            $("warnBox").hidden = false;
            return;
        }
        if (ensureVisible(result)) {

        }
        [bench, spotC, lsaC, fieldC, distC].forEach((c) => c.redraw());
        updateReadouts(result);
        describe(result);
        rebuildSelect();
        syncEditorValues();
    }

    function schedule() {
        if (rafPending) return;
        rafPending = true;
        requestAnimationFrame(render);
    }


    function hitTest(px, py) {
        let best = null,
            bestD = 14;
        hitTargets.forEach((t) => {
            if (t.id === "obj" && t.tip) {
                const d = Math.hypot(px - t.tip.x, py - t.tip.y);
                if (d < 16 && (!best || d < bestD + 4)) {
                    best = t;
                    bestD = d - 4;
                    return;
                }
            }
            const xa = Math.min(t.x, t.x1 || t.x),
                xb = Math.max(t.x, t.x1 || t.x);
            const dx = px < xa ? xa - px : px > xb ? px - xb : 0;
            if (py >= t.y0 - 6 && py <= t.y1 + 6 && dx < bestD) {
                best = t;
                bestD = dx;
            }
        });
        return best;
    }

    function pointerPos(e) {
        const r = benchCanvas.getBoundingClientRect();
        return [e.clientX - r.left, e.clientY - r.top];
    }

    benchCanvas.addEventListener("pointerdown", (e) => {
        if (!benchMap) return;
        const [px, py] = pointerPos(e);
        const t = hitTest(px, py);
        if (!t) return;
        e.preventDefault();
        selected = t.id;
        rebuildEditor();
        const w = benchMap.fromPx(px, py);
        const el = els.find((x) => x.id === t.id);
        drag = {
            id: t.id,
            z0: w.x,
            zStart: el ? el.z : null,
            soStart: Number($("objDist").value)
        };
        benchCanvas.classList.add("is-dragging");
        try {
            benchCanvas.setPointerCapture(e.pointerId);
        } catch (err) {

        }
        benchCanvas.focus({
            preventScroll: true
        });
        schedule();
    });

    benchCanvas.addEventListener("pointermove", (e) => {
        if (!benchMap) return;
        const [px, py] = pointerPos(e);
        if (!drag) {
            benchCanvas.style.cursor = hitTest(px, py) ? "grab" : "default";
            return;
        }
        const w = benchMap.fromPx(px, py);
        const dz = w.x - drag.z0;
        if (drag.id === "obj") {
            const soSl = $("objDist");
            soSl.value = String(clamp(Math.round((drag.soStart - dz) * 2) / 2, Number(soSl.min), Number(soSl.max)));
            if (!$("objInf").checked) {
                const hs = $("objH");
                hs.value = String(clamp(Math.round(w.y * 10) / 10, Number(hs.min), Number(hs.max)));
            }
        } else {
            const el = els.find((x) => x.id === drag.id);
            if (el) {
                let z = Math.round((drag.zStart + dz) * 2) / 2;
                const mirror = els.find((x) => x.type === "mirror");
                if (mirror && el !== mirror) z = Math.min(z, mirror.z - 0.5);
                if (mirror && el === mirror) {
                    const lim = Math.max(...els.filter((x) => x !== mirror).map((x) => x.z + (x.t || 0)), -Infinity);
                    if (Number.isFinite(lim)) z = Math.max(z, lim + 0.5);
                }
                el.z = z;
            }
        }
        schedule();
    });

    const endDrag = () => {
        if (!drag) return;
        drag = null;
        benchCanvas.classList.remove("is-dragging");
        url.update();
        schedule();
    };
    benchCanvas.addEventListener("pointerup", endDrag);
    benchCanvas.addEventListener("pointercancel", endDrag);

    benchCanvas.addEventListener("keydown", (e) => {
        const step = e.shiftKey ? 10 : 1;
        let handled = true;
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            const s = e.key === "ArrowRight" ? step : -step;
            if (selected === "obj") {
                const sl = $("objDist");
                sl.value = String(clamp(Number(sl.value) - s, Number(sl.min), Number(sl.max)));
            } else {
                const el = els.find((x) => x.id === selected);
                if (el) el.z = Math.round((el.z + s) * 10) / 10;
            }
        } else if ((e.key === "ArrowUp" || e.key === "ArrowDown") && selected === "obj" && !$("objInf").checked) {
            const sl = $("objH");
            sl.value = String(clamp(Number(sl.value) + (e.key === "ArrowUp" ? 1 : -1) * (e.shiftKey ? 5 : 0.5), Number(sl.min), Number(sl.max)));
        } else if ((e.key === "ArrowUp" || e.key === "ArrowDown") && selected === "obj") {
            const sl = $("objAng");
            sl.value = String(clamp(Number(sl.value) + (e.key === "ArrowUp" ? 0.5 : -0.5), Number(sl.min), Number(sl.max)));
        } else handled = false;
        if (handled) {
            e.preventDefault();
            url.update();
            schedule();
        }
    });


    $("elSelect").addEventListener("change", (e) => {
        const v = e.target.value;
        selected = v === "obj" ? "obj" : Number(v);
        rebuildEditor();
        schedule();
    });
    document.querySelectorAll("[data-add]").forEach((b) => b.addEventListener("click", () => addElement(b.dataset.add)));
    $("btnRemove").addEventListener("click", () => {
        if (selected === "obj") return;
        els = els.filter((e) => e.id !== selected);
        if (!hasMirror()) els.forEach((e) => {
            e.after = false;
        });
        selected = "obj";
        rebuildEditor();
        commitChange(true);
    });

    function detectorTo(z) {
        if (!Number.isFinite(z)) return;
        let det = els.find((e) => e.type === "detector");
        if (!det) {
            det = {
                id: nextId++,
                type: "detector",
                z: 0,
                semi: 15,
                after: hasMirror()
            };
            els.push(det);
        }
        det.z = Math.round(z / MM * 100) / 100;
        rebuildEditor();
        commitChange(false);
    }
    $("btnDetImage").addEventListener("click", () => {
        const r = result;
        if (r && r.im && !r.im.atInfinity) detectorTo(r.im.zImage);
        else {
            $("warnBox").textContent = "The image is at infinity, so there is no plane to move the detector to.";
            $("warnBox").hidden = false;
        }
    });
    $("btnDetBest").addEventListener("click", () => {
        const r = result;
        if (!r || !r.im || r.im.atInfinity || r.im.virtual) {
            $("warnBox").textContent = "Best focus needs a real image at a finite distance.";
            $("warnBox").hidden = false;
            return;
        }
        const range = Math.max(0.5 * MM, Math.abs(r.im.si) * 0.2);
        const bf = GO.bestFocus(r.sysOpt, r.fieldObj, r.spot.zPlaneImage, range, {
            lambdas: r.lams,
            lambdaRef: r.lamRef,
            rings: 5
        });
        detectorTo(bf.z);
    });
    $("btnFit").addEventListener("click", () => {
        fitView();
        schedule();
    });
    $("btnReset").addEventListener("click", () => {
        url.clear();
        loadPreset(presetKey, true);
    });
    $("objInf").addEventListener("change", () => {
        fitView();
        schedule();
    });

    UI.addExportBar($("exportHost"), {
        name: "geometric-optics",
        url,
        getState: () => ({
            preset: presetKey,
            controls: ctl.get(),
            elements_mm: ordered(),
            signConvention: "Cartesian: R > 0 centre to the right; s_i > 0 real image after the last powered surface; paraxial ray [y, dy/ds]"
        }),
        getCSV: () => {
            const r = result;
            const rows = [];
            if (r && !r.empty) {
                r.spot.points.forEach((p) => rows.push(["spot_" + r.spot.mode, p.lambda / NM, p.x, p.y]));
                if (!r.lsa.afocal) r.lsa.curves.forEach((c) => c.rho.forEach((rho, i) => rows.push(["lsa_rho_vs_dz_m", c.lambda / NM, rho, c.dz[i]])));
                if (r.fc && !r.fc.imageAtInfinity) r.fc.points.forEach((p) => {
                    rows.push(["field_T_dz_m", r.lamRef / NM, p.fraction, p.dzT]);
                    rows.push(["field_S_dz_m", r.lamRef / NM, p.fraction, p.dzS]);
                });
                if (r.dist) r.dist.points.forEach((p) => rows.push(["distortion_fraction", r.lamRef / NM, p.fraction, p.distortion]));
                r.conv.rows.forEach((row) => rows.push(["exact_minus_paraxial_" + (r.conv.imageAtInfinity ? "slope" : "dz_m"), r.lamRef / NM, row.rho, row.delta]));
            }
            return {
                headers: ["dataset", "lambda (nm)", "x (m, rad or fraction)", "y (m, rad or fraction)"],
                rows
            };
        },
        canvases: [benchCanvas, $("spotCanvas"), $("lsaCanvas"), $("fieldCanvas"), $("distCanvas")],
        caption: () => GO.PRESETS[presetKey].label + " · λ = " + fmt(readState().lam / NM, 4) + " nm · Cartesian sign convention"
    });


    loadPreset("single", false);
})();