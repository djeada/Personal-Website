"use strict";

/*
 * Why metals are shiny: adding absorption (κ) to glass raises the normal-incidence
 * reflectance, and a gold-like ñ = 0.20 + 3.09i reflects 93 % while the field
 * dies within ~33 nm. Tilted, p-light dips at the pseudo-Brewster angle but never
 * reaches zero. Values come from fresnel.js.
 */

const FR = require("../../../../src/tools/shared/optics/fresnel.js");
const { reel } = require("./common");

const deg = Math.PI / 180;
const pct = x => `${(100 * x).toFixed(0)}%`;

function build() {
    const glass = 1.5, gold = { re: 0.2, im: 3.09 };
    const lossy = FR.solve(1, { re: glass, im: gold.im }, 0, 633e-9);
    const metal = FR.solve(1, gold, 0, 633e-9);
    const pseudo = FR.pseudoBrewster(1, gold) / deg;
    const dip = FR.solve(1, gold, pseudo * deg);
    const GEO = "#canvas", PLOT = "#plotCanvas";
    const geo = { target: GEO, zoom: 1.12, y: 0.5 };
    return reel({
        id: "fresnel-metal",
        tool: "fresnel",
        hook: "Why are metals shiny?",
        DURATION: 50,
        cover: 18,
        music: { pattern: 2, seed: 41 },
        setup: [{ act: "click", target: '[data-preset="normal"]' }],
        captions: [
            { t: 0.4, end: 5.4, lines: ["Why are metals", "so <em>shiny</em>?"], sub: "glass straight on: 4% reflected" },
            { t: 5.4, end: 10.8, lines: ["Let the material", "<b>absorb</b> light…"], sub: `extinction κ: 0 → ${gold.im}` },
            { t: 10.8, end: 16.2, lines: ["…and reflection", "<em>jumps</em>."], sub: `${pct(lossy.Rs)} with n = ${glass}, κ = ${gold.im}` },
            { t: 16.6, end: 22.0, lines: ["Now make it", "<b>gold</b>-like."], sub: `ñ = ${gold.re} + ${gold.im}i at 633 nm` },
            { t: 22.0, end: 27.4, lines: ["Almost everything", "<em>bounces</em>."], sub: `R = ${pct(metal.Rs)}`, chime: true },
            { t: 27.8, end: 33.2, lines: ["Inside, the field dies", `within <em>${(metal.fieldDecayLength * 1e9).toFixed(0)} nm</em>.`], sub: "electrons cancel it and re-emit it" },
            { t: 33.6, end: 39.2, lines: ["Tilted, p-light dips", "but <b>never</b> hits zero."], sub: `min R_p = ${dip.Rp.toFixed(2)} at ${pseudo.toFixed(1)}°` },
            { t: 39.2, end: 44.0, lines: ["No angle switches", "a metal's <em>shine</em> off."], sub: "glass at Brewster: R_p = 0" }
        ],
        shots: [
            { t: 0, ...geo },
            { t: 27.6, target: "#depthCanvas", zoom: 1.12, y: 0.5 },
            { t: 33.4, target: PLOT, zoom: 1.12, y: 0.5 }
        ],
        actions: [
            { t: 33.8, act: "click", target: 'input[name="pol"][value="p"]', sound: "click" }
        ],
        sweeps: [
            { from: 5.8, to: 10.2, target: "#k2Slider", a: 0, b: gold.im },
            { from: 17.0, to: 21.4, target: "#n2Slider", a: glass, b: gold.re },
            { from: 34.2, to: 38.4, target: "#thetaSlider", a: 0, b: pseudo }
        ],
        huds: [
            { from: 5.4, to: 16.2, target: "#k2Slider", label: "Absorption κ", digits: 2, min: 0, max: 4 },
            { from: 16.6, to: 22.0, target: "#n2Slider", label: "Real index n", digits: 2, min: 0, max: 2 },
            { from: 33.6, to: 39.2, target: "#thetaSlider", label: "Angle of incidence θ₁", unit: "°", digits: 1, min: 0, max: 90 }
        ],
        chips: [
            { from: 0.8, to: 27.4, items: [
                { label: "reflected", source: "#stat-R", labelFrom: "#stat-R-label", accent: true },
                { label: "goes in", source: "#tsValue" }
            ] },
            { from: 33.8, to: 44.0, items: [
                { label: "p reflected", source: "#rpValue", accent: true },
                { label: "angle", source: "#stat-theta" }
            ] }
        ]
    });
}

module.exports = { build };
