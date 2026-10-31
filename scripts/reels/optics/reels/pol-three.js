"use strict";

/*
 * The three-polarizer paradox: a polarizer halves unpolarized light, a second one
 * dims it as cos²θ until crossed polarizers pass nothing, and a third one slipped
 * between them lets light through again. Five in 22.5° steps pass even more.
 * Values come from polarization.js.
 */

const Pol = require("../../../../src/tools/shared/optics/polarization.js");
const { reel } = require("./common");

const deg = Math.PI / 180;
const through = (angles, p = 0) => Pol.propagate({ psi: 0, delta: 0, dop: p }, angles.map(a => ({ type: "polarizer", angle: a * deg }))).output.S.S0;
const pct = x => `${(100 * x).toFixed(x < 0.2 ? 1 : 0)}%`;

function build() {
    const one = through([0]), crossed = through([0, 90]), three = through([0, 45, 90]), five = through([0, 22.5, 45, 67.5, 90]);
    const row = k => `#benchList li:nth-child(${k}) input[type="range"]`;
    const bench = { target: "#benchCanvas", fit: 12, y: 0.5 };
    const scan = { target: "#scanCanvas", fit: 12, y: 0.5 };
    const field = { target: "#fieldCanvas", fit: 12, y: 0.5 };
    return reel({
        id: "pol-three",
        tool: "polarization",
        hook: "Two polarizers block everything. A third lets light back.",
        DURATION: 52,
        cover: 30,
        music: { pattern: 0, seed: 41 },
        css: `.optics-panel:has(#sphereCanvas), .optics-panel:has(#crystalCanvas), .optics-panel:has(#dispCanvas), .optics-caption, .action-bar { display: none !important; }`,
        setup: [
            { act: "click", target: '[data-preset="unpol"]' },
            { act: "set", target: row(1), value: 0 },
            { act: "click", target: "#startStopBtn" }
        ],
        captions: [
            { t: 0.4, end: 5.4, lines: ["Ordinary light through", "a <em>polarizer</em>…"], sub: "unpolarized light, axis at 0°" },
            { t: 5.4, end: 10.6, lines: ["…loses <b>half</b>, and the rest", "points <em>one way</em>."], sub: `I/I₀ = ${one.toFixed(2)} · now fully polarized` },
            { t: 11.0, end: 16.4, lines: ["Add a second one", "and <em>turn</em> it…"], sub: "Malus's law: I = I₁ cos²θ" },
            { t: 16.8, end: 22.2, lines: ["At 90° the pair is", "<b>pitch black</b>."], sub: `crossed polarizers · I/I₀ = ${crossed.toFixed(2)}`, bell: true },
            { t: 22.6, end: 28.0, lines: ["Now slip a <em>third</em>", "one between them…"], sub: "axes at 0°, 45°, 90°" },
            { t: 28.0, end: 33.4, lines: ["…and light", "<b>comes back</b>."], sub: `½ · cos²45° · cos²45° = ${pct(three)}`, chime: true },
            { t: 33.8, end: 39.2, lines: ["Each polarizer <em>re-aims</em>", "the light it passes."], sub: "the middle one works best at 45°" },
            { t: 39.6, end: 46.0, lines: ["Five, in 22.5° steps,", `pass <em>${pct(five)}</em>.`], sub: "smaller steps lose less light" }
        ],
        shots: [
            { t: 0, ...bench },
            { t: 10.8, ...scan },
            { t: 22.4, ...bench },
            { t: 33.6, ...field },
            { t: 39.4, ...bench }
        ],
        actions: [
            { t: 10.9, act: "select", target: "#addType", value: "polarizer" },
            { t: 10.9, act: "click", target: "#addBtn", sound: "click" },
            { t: 22.8, act: "click", target: '[data-preset="three"]', sound: "click" },
            { t: 39.7, act: "click", target: "#addBtn", sound: "click" },
            { t: 39.7, act: "click", target: '#benchList [data-role="up"][data-i="3"]' },
            { t: 39.7, act: "set", target: row(3), value: 67.5 },
            { t: 39.7, act: "click", target: "#addBtn" },
            { t: 39.7, act: "click", target: '#benchList [data-role="up"][data-i="4"]' },
            { t: 39.7, act: "click", target: '#benchList [data-role="up"][data-i="3"]' },
            { t: 39.7, act: "click", target: '#benchList [data-role="up"][data-i="2"]' },
            { t: 39.7, act: "set", target: row(2), value: 22.5 }
        ],
        sweeps: [
            { from: 11.6, to: 16.0, target: row(2), a: 0, b: 90 },
            { from: 34.2, to: 36.2, target: row(2), a: 45, b: 12 },
            { from: 36.6, to: 38.6, target: row(2), a: 12, b: 45 }
        ],
        huds: [
            { from: 11.0, to: 22.2, target: row(2), label: "Second polarizer θ", unit: "°", min: 0, max: 90 },
            { from: 33.8, to: 39.2, target: row(2), label: "Middle polarizer θ", unit: "°", min: 0, max: 90 }
        ],
        chips: [
            { from: 5.8, to: 22.2, items: [
                { label: "transmitted I/I₀", source: "#stat-trans", accent: true },
                { label: "degree of pol.", source: "#stat-dop" }
            ] },
            { from: 28.2, to: 46.0, items: [
                { label: "transmitted I/I₀", source: "#stat-trans", accent: true },
                { label: "polarizers", source: "#stat-count" }
            ] }
        ]
    });
}

module.exports = { build };
