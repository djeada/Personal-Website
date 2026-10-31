"use strict";

/*
 * Cavity modes: between two mirrors only waves with a node on each mirror
 * survive, L = mλ/2, so the allowed frequencies form a comb spaced c/2nL, and
 * better mirrors sharpen its teeth. Swap one mirror for a magnetic one and an
 * antinode sits there instead: only odd quarter-waves fit, like the odd
 * harmonics of a clarinet. Values come from standingWaves.js.
 */

const SW = require("../../../../src/tools/shared/optics/standingWaves.js");
const { reel } = require("./common");

const THz = nu => `${(nu / 1e12).toFixed(nu < 1e14 ? 2 : 1)} THz`;

function build() {
    const L = 1.5e-6, m = 4;
    const fsr = SW.freeSpectralRange(1, L);
    const pec = SW.REFLECTOR_PRESETS.pec.r, pmc = SW.REFLECTOR_PRESETS.pmc.r;
    const quarter = SW.resonatorModes(1, L, pec.phase, pmc.phase, m).map(md => md.nu);
    const laser = SW.freeSpectralRange(1, 0.3);
    const field = { target: "#fieldCanvas", fit: 12, y: 0.5 };
    const spec = { target: "#spectrumCanvas", fit: 12, y: 0.5 };
    return reel({
        id: "sw-cavity",
        tool: "standing_waves",
        hook: "Why does a laser only make certain colours?",
        DURATION: 52,
        cover: 20,
        music: { pattern: 1, seed: 71 },
        css: `.optics-caption, .action-bar, .sw-readouts, #presetExpect, .optics-warning, #swWarn, .optics-panel:has(#energyCanvas), .optics-panel:has(#traceCanvas) { display: none !important; }`,
        setup: [
            { act: "click", target: '[data-preset="cavity1"]' }
        ],
        captions: [
            { t: 0.4, end: 5.4, lines: ["Trap light between", "<em>two mirrors</em>…"], sub: `${(L * 1e6).toFixed(1)} µm apart` },
            { t: 5.4, end: 10.6, lines: ["…and only waves that", "<em>fit</em> survive."], sub: "a node on each mirror: L = m λ/2" },
            { t: 10.6, end: 16.0, lines: ["One half-wave, two,", "three, four…"], sub: `ν = m · c/2L = m × ${THz(fsr)}` },
            { t: 16.4, end: 21.8, lines: ["The allowed colours", "form a <em>comb</em>."], sub: `teeth every c/2L = ${THz(fsr)}`, chime: true },
            { t: 22.2, end: 27.6, lines: ["Better mirrors make", "<b>sharper</b> teeth."], sub: "mirror reflectance R: 0.5 → 0.99" },
            { t: 28.0, end: 33.4, lines: ["Make one mirror", "<em>magnetic</em>…"], sub: "now E peaks on it instead of vanishing" },
            { t: 33.4, end: 38.8, lines: ["…and only <b>odd</b>", "quarter-waves fit."], sub: `ν = (2m − 1) c/4L: ${quarter.map(nu => (nu / 1e12).toFixed(0)).join(", ")} THz`, bell: true },
            { t: 39.2, end: 46.0, lines: ["Every laser picks its", "colours from a <em>comb</em>."], sub: `a 30 cm laser: teeth ${(laser / 1e6).toFixed(0)} MHz apart` }
        ],
        shots: [
            { t: 0, ...field },
            { t: 16.2, ...spec },
            { t: 27.8, ...field },
            { t: 39.0, ...spec }
        ],
        actions: [
            { t: 22.3, act: "set", target: "#mirrorRSlider", value: 0.5, sound: "click" },
            { t: 29.2, act: "select", target: "#mirrorConfig", value: "pec-pmc", sound: "click" }
        ],
        sweeps: [
            { from: 11.0, to: 15.6, target: "#modeSlider", a: 1, b: m, linear: true },
            { from: 22.8, to: 27.0, target: "#mirrorRSlider", a: 0.5, b: 0.99 }
        ],
        huds: [
            { from: 10.6, to: 16.0, target: "#modeSlider", label: "Half-waves in the cavity m", min: 1, max: 20 },
            { from: 22.2, to: 27.6, target: "#mirrorRSlider", label: "Mirror reflectance R", digits: 3, min: 0.3, max: 1 }
        ],
        chips: [
            { from: 5.8, to: 16.0, items: [
                { label: "mode frequency", source: "#stat-freq", accent: true },
                { label: "E nodes", source: "#stat-nodes" }
            ] },
            { from: 22.6, to: 27.6, items: [
                { label: "finesse", source: "#modelReadout", row: "Finesse", accent: true },
                { label: "tooth width", source: "#modelReadout", row: "Exact Airy FWHM" }
            ] },
            { from: 29.4, to: 38.8, items: [
                { label: "mirrors", source: "#stat-boundary" },
                { label: "mode frequency", source: "#stat-freq", accent: true }
            ] }
        ]
    });
}

module.exports = { build };
