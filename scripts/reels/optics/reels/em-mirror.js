"use strict";

/*
 * Light meets a mirror: incident and reflected waves add into a standing wave
 * with fixed E nodes every λ/2, zero net energy flow, and energy sloshing between
 * E and H a quarter period apart. Then the 4 % reflection of glass, whose phase
 * flips or not depending on which side the light comes from.
 */

const { reel } = require("./common");

function build() {
    const lambda = 633, n = 1.5;
    const r = (1 - n) / (1 + n);
    const VIEW = "#viewCanvas", ZF = "#zFieldCanvas";
    const view = { target: VIEW, zoom: 1.15, y: 0.5 };
    return reel({
        id: "em-mirror",
        tool: "em_waves",
        hook: "What happens when light hits a mirror?",
        DURATION: 52,
        cover: 12,
        music: { pattern: 2, seed: 29 },
        setup: [{ act: "click", target: '[data-preset="mirror"]' }],
        captions: [
            { t: 0.4, end: 5.4, lines: ["Shine light", "at a <em>mirror</em>…"], sub: "a perfect conductor at z = 0" },
            { t: 5.4, end: 10.8, lines: ["…it bounces back", "and <b>overlaps</b> itself."], sub: "incident + reflected wave" },
            { t: 10.8, end: 16.2, lines: ["Some points", "<em>never move</em>."], sub: `E = 0 every λ/2 = ${(lambda / 2).toFixed(1)} nm`, bell: true },
            { t: 16.6, end: 22.0, lines: ["Nothing travels:", "a <em>standing wave</em>."], sub: "net energy flow ⟨S⟩ = 0" },
            { t: 22.4, end: 27.8, lines: ["Energy sloshes between", "<em>E</em> and <b>H</b>…"], sub: "they peak a quarter period apart" },
            { t: 27.8, end: 33.2, lines: ["…back and forth,", "going <em>nowhere</em>."], sub: "S swings ± and averages to zero" },
            { t: 33.6, end: 39.0, lines: ["Glass reflects", `only <em>${(100 * r * r).toFixed(0)}%</em>.`], sub: `r = ${r.toFixed(2).replace("-", "−")} · envelope dips at z = 0`, chime: true },
            { t: 39.4, end: 46.0, lines: ["From inside the glass:", "same 4%, <v>no flip</v>."], sub: `r = +${Math.abs(r).toFixed(2)} · now it peaks at z = 0` }
        ],
        shots: [
            { t: 0, ...view },
            { t: 22.2, target: "#tEnergyCanvas", zoom: 1.12, y: 0.5 },
            { t: 33.2, target: ZF, zoom: 1.3, y: 0.5, ax: 0.6, dip: true }
        ],
        actions: [
            { t: 33.7, act: "click", target: '[data-preset="airglass"]', sound: "click" },
            { t: 39.6, act: "click", target: '[data-preset="glassair"]', sound: "click" }
        ],
        chips: [
            { from: 16.8, to: 22.0, items: [
                { label: "net energy flow", source: "#statNet", accent: true },
                { label: "reflectance", source: "#statR" }
            ] },
            { from: 34.0, to: 46.0, items: [
                { label: "reflectance", source: "#statR", accent: true },
                { label: "net energy flow", source: "#statNet" }
            ] }
        ]
    });
}

module.exports = { build };
