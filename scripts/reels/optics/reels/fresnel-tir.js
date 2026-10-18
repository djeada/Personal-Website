"use strict";

/*
 * Total internal reflection: light leaving glass bends away from the normal, grazes
 * the surface at the critical angle, and beyond it reflects completely while an
 * evanescent field leaks ~100 nm into the air. An absorber within that reach
 * steals some light (attenuated TIR). Values come from fresnel.js.
 */

const FR = require("../../../../src/tools/shared/optics/fresnel.js");
const { reel } = require("./common");

const deg = Math.PI / 180;

function build() {
    const n = 1.5, start = 20, past = 60;
    const critical = FR.criticalAngle(n, 1) / deg;
    const bend = FR.solve(n, 1, start * deg).theta2 / deg;
    const tir = FR.solve(n, 1, past * deg, 633e-9);
    const atr = FR.solve(n, { re: 1, im: 0.02 }, past * deg, 633e-9);
    const GEO = "#canvas";
    const geo = { target: GEO, zoom: 1.12, y: 0.5 };
    return reel({
        id: "fresnel-tir",
        tool: "fresnel",
        hook: "Why can't light escape from a fibre?",
        DURATION: 52,
        cover: 24,
        music: { pattern: 1, seed: 37 },
        setup: [
            { act: "click", target: '[data-preset="critical"]' },
            { act: "set", target: "#thetaSlider", value: start }
        ],
        captions: [
            { t: 0.4, end: 5.4, lines: ["Light trying to", "<em>leave</em> glass…"], sub: `glass n = ${n} → air` },
            { t: 5.4, end: 10.6, lines: ["…bends <em>away</em>", "from the normal."], sub: `${start}° inside → ${bend.toFixed(1)}° outside` },
            { t: 10.6, end: 15.8, lines: ["Tilt it", "more…"], sub: "it leaves ever flatter" },
            { t: 16.2, end: 21.4, lines: [`At <em>${critical.toFixed(1)}°</em> it just`, "skims the surface."], sub: "critical angle · sin θc = 1/n", bell: true },
            { t: 21.8, end: 27.2, lines: ["Any steeper:", "<b>all</b> of it reflects."], sub: "total internal reflection · R = 1", chime: true },
            { t: 27.6, end: 33.0, lines: ["That's how optical fibres", "<em>trap</em> light."], sub: "bouncing along the core for kilometres" },
            { t: 33.4, end: 38.8, lines: ["Yet a field still", "<em>leaks</em> into the air."], sub: `evanescent wave · 1/e depth ${(tir.fieldDecayLength * 1e9).toFixed(0)} nm` },
            { t: 39.2, end: 46.0, lines: ["Put an absorber there:", "<b>reflection drops</b>."], sub: `R_s = ${tir.Rs.toFixed(2)} → ${atr.Rs.toFixed(3)} · ATR spectroscopy` }
        ],
        shots: [
            { t: 0, ...geo },
            { t: 33.2, target: GEO, zoom: 1.4, y: 0.5, ax: 0.56, anchor: 0.6 },
            { t: 38.8, ...geo }
        ],
        actions: [
            { t: 33.6, act: "click", target: "#startStopBtn" },
            { t: 39.4, act: "click", target: '[data-preset="atr"]', sound: "click" }
        ],
        sweeps: [
            { from: 11.0, to: 15.6, target: "#thetaSlider", a: start, b: critical - 0.01 },
            { from: 22.2, to: 25.6, target: "#thetaSlider", a: critical - 0.01, b: past }
        ],
        huds: [
            { from: 10.6, to: 27.2, target: "#thetaSlider", label: "Angle inside the glass θ₁", unit: "°", digits: 1, min: 0, max: 90 }
        ],
        chips: [
            { from: 5.8, to: 21.4, items: [
                { label: "inside", source: "#stat-theta" },
                { label: "outside", source: "#stat-theta2", accent: true }
            ] },
            { from: 21.8, to: 33.0, items: [
                { label: "reflected", source: "#stat-R", labelFrom: "#stat-R-label", accent: true },
                { label: "inside", source: "#stat-theta" }
            ] },
            { from: 39.6, to: 46.0, items: [
                { label: "s reflected", source: "#rsValue", accent: true },
                { label: "p reflected", source: "#rpValue" }
            ] }
        ]
    });
}

module.exports = { build };
