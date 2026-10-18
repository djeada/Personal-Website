"use strict";

/*
 * What a light wave is: E and H perpendicular and in step, energy flowing along
 * S = E × H in pulses at twice the optical frequency, E/H fixed at 377 Ω, and the
 * wave squeezing to λ₀/n where it enters glass. Numbers come from emWaves.js.
 */

const EM = require("../../../../src/tools/shared/optics/emWaves.js");
const { reel } = require("./common");

function build() {
    const { eta0 } = EM.constants;
    const E0 = 100, lambda0 = 633, glass = 1.5;
    const I0 = EM.intensity(1, E0);
    const VIEW = "#viewCanvas";
    const view = { target: VIEW, zoom: 1.15, y: 0.5 };
    return reel({
        id: "em-light",
        tool: "em_waves",
        hook: "What is a light wave, really?",
        DURATION: 52,
        cover: 8,
        music: { pattern: 0, seed: 21 },
        setup: [{ act: "click", target: '[data-preset="vacuum"]' }],
        captions: [
            { t: 0.4, end: 5.4, lines: ["What <em>is</em>", "a light wave?"], sub: `red laser light · λ = ${lambda0} nm · vacuum` },
            { t: 5.4, end: 10.8, lines: ["An <em>electric field</em>", "swinging up and down…"], sub: "E: the cyan arrows" },
            { t: 10.8, end: 16.2, lines: ["…and a <b>magnetic field</b>", "swinging sideways."], sub: "always at 90°, always in step", bell: true },
            { t: 16.6, end: 22.0, lines: ["Together they push", "<r>energy</r> forward."], sub: "Poynting vector S = E × H" },
            { t: 22.4, end: 27.8, lines: ["The flow <em>pulses</em>", "twice per cycle…"], sub: `between 0 and ${(2 * I0).toFixed(1)} W/m²` },
            { t: 27.8, end: 33.0, lines: ["…and averages to", "a steady <b>intensity</b>."], sub: `I = ½ε₀cE₀² = ${I0.toFixed(1)} W/m²` },
            { t: 33.4, end: 38.6, lines: ["E/H is fixed:", `<em>${eta0.toFixed(0)} Ω</em>.`], sub: "the impedance of empty space", chime: true },
            { t: 39.0, end: 46.0, lines: ["Entering glass, the wave", "<em>squeezes</em> and slows."], sub: `λ ${lambda0} → ${(lambda0 / glass).toFixed(0)} nm · speed c/${glass}` }
        ],
        shots: [
            { t: 0, ...view },
            { t: 22.2, target: "#tEnergyCanvas", zoom: 1.12, y: 0.5 },
            { t: 33.2, ...view, dip: true },
            { t: 38.6, target: VIEW, zoom: 1.45, y: 0.5, ax: 0.7, anchor: 0.33, dip: true }
        ],
        actions: [
            { t: 39.1, act: "click", target: '[data-preset="airglass"]', sound: "click" }
        ],
        chips: [
            { from: 22.8, to: 33.0, items: [
                { label: "average intensity", source: "#statI0", accent: true },
                { label: "peak field E₀", source: "#e0Val" }
            ] },
            { from: 33.8, to: 38.6, items: [
                { label: "E / H", source: "#statEta", accent: true },
                { label: "wavelength", source: "#statLambda1" }
            ] }
        ]
    });
}

module.exports = { build };
