"use strict";

/*
 * Why real lenses blur: a thick N-BK7 singlet shows spherical aberration (edge
 * rays focus short) and chromatic aberration (blue focuses closer than red); the
 * BK7/F2 achromat brings red and blue back together. Glass data and the
 * longitudinal aberration plot come from geometricOptics.js, as on the page.
 */

const GO = require("../../../../src/tools/shared/optics/geometricOptics.js");
const { reel } = require("./common");

const nm = key => Math.round(GO.LINES[key] * 1e9);

// Blue (F) to red (C) paraxial focus gap as a fraction of the focal length.
function colourGap(key) {
    const sys = GO.buildSystem(GO.PRESETS[key].elements.filter(e => e.type !== "detector"));
    const [blue, mid, red] = ["F", "d", "C"].map(line => GO.cardinalPoints(sys, GO.LINES[line]));
    return (red.zFp - blue.zFp) / mid.efl;
}
const pct = x => `${(100 * x).toFixed(1)}%`;

function build() {
    const n = key => GO.refractiveIndex("BK7", GO.LINES[key]).toFixed(3);
    const BENCH = "#benchCanvas", LSA = "#lsaCanvas";
    const bench = { target: BENCH, zoom: 1.15, y: 0.5 };
    const focus = { target: BENCH, zoom: 1.7, y: 0.5, ax: 0.72 };
    const lsa = { target: LSA, zoom: 1.1, y: 0.5 };
    return reel({
        id: "go-aberrations",
        tool: "geometric_optics",
        hook: "Why can't one lens focus perfectly?",
        DURATION: 52,
        cover: 8,
        music: { pattern: 2, seed: 13 },
        setup: [
            { act: "click", target: '[data-preset="thick"]' },
            { act: "check", target: "#chrom", value: false },
            { act: "set", target: "#objAng", value: 0 },
            { act: "set", target: "#nRays", value: 15 },
            { act: "option", target: "#elSelect", match: "Detector" },
            { act: "click", target: "#btnRemove" }
        ],
        captions: [
            { t: 0.4, end: 5.4, lines: ["Why can't one lens", "focus <em>perfectly</em>?"], sub: "a thick lens of N-BK7 glass" },
            { t: 5.4, end: 10.6, lines: ["Rays near the edge", "bend <em>too much</em>…"], sub: "they cross the axis early" },
            { t: 10.6, end: 15.8, lines: ["…so the focus", "<b>smears</b> along the axis."], sub: "spherical aberration", bell: true },
            { t: 16.2, end: 21.6, lines: ["This curve", "<em>measures</em> it."], sub: "focus shift vs. height in the lens" },
            { t: 22.0, end: 27.2, lines: ["Colours split", "<em>too</em>."], sub: `blue ${nm("F")} · yellow ${nm("d")} · red ${nm("C")} nm` },
            { t: 27.2, end: 32.6, lines: ["Glass bends blue", "<em>more</em> than red."], sub: `n = ${n("F")} for blue, ${n("C")} for red`, bell: true },
            { t: 33.2, end: 38.6, lines: ["The fix: glue on", "a <v>second glass</v>."], sub: "crown (BK7) + flint (F2)" },
            { t: 38.6, end: 45.0, lines: ["Now red and blue", "<em>meet again</em>."], sub: `colour focus gap: ${pct(colourGap("thick"))} of f → ${pct(colourGap("achromat"))}`, chime: true }
        ],
        shots: [
            { t: 0, ...bench },
            { t: 5.8, ...focus },
            { t: 15.8, ...lsa },
            { t: 21.8, ...bench },
            { t: 26.8, ...focus },
            { t: 32.8, ...bench, dip: true },
            { t: 38.4, ...lsa }
        ],
        actions: [
            { t: 22.6, act: "check", target: "#chrom", value: true, sound: "click" },
            { t: 33.3, act: "click", target: '[data-preset="achromat"]', sound: "click" },
            { t: 33.35, act: "set", target: "#objAng", value: 0 },
            { t: 33.4, act: "set", target: "#nRays", value: 15 },
            { t: 33.45, act: "option", target: "#elSelect", match: "Detector" },
            { t: 33.5, act: "click", target: "#btnRemove" }
        ]
    });
}

module.exports = { build };
