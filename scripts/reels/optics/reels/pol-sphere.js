"use strict";

/*
 * The Poincaré sphere as a map of every polarization: linear light on the
 * equator, circular at the poles, ellipses in between, wave plates as rotations
 * of the sphere, and partly polarized light inside it, down to unpolarized light
 * at the centre. The field ellipse and the sphere are filmed side by side.
 * Values come from polarization.js.
 */

const Pol = require("../../../../src/tools/shared/optics/polarization.js");
const { reel } = require("./common");

const deg = Math.PI / 180;

function build() {
    const qwp = Pol.propagate({ psi: 0, delta: 0 }, [{ type: "qwp", angle: 45 * deg }]).output.desc;
    const pole = qwp.S3 > 0 ? "north" : "south";
    const pair = { target: ".optics-plot-grid", fit: 6, y: 0.5 };
    return reel({
        id: "pol-sphere",
        tool: "polarization",
        hook: "Every polarization of light fits on one sphere.",
        DURATION: 52,
        cover: 20,
        music: { pattern: 2, seed: 47 },
        css: `.optics-plot-grid { grid-template-columns: 1fr 1fr !important; gap: 8px !important; }
            .optics-plot-grid > .optics-panel:not(:has(#fieldCanvas)):not(:has(#sphereCanvas)), .optics-caption, .action-bar { display: none !important; }
            .optics-panel-title .optics-badge { display: none !important; }`,
        setup: [
            { act: "click", target: '[data-preset="linear"]' },
            { act: "set", target: "#psiSlider", value: 0 },
            { act: "click", target: "#startStopBtn" }
        ],
        captions: [
            { t: 0.4, end: 5.4, lines: ["Every polarization", "of light…"], sub: "a line, a circle or an ellipse" },
            { t: 5.4, end: 10.6, lines: ["…is one point", "on a <em>sphere</em>."], sub: "the Poincaré sphere · (S₁, S₂, S₃)/S₀" },
            { t: 10.6, end: 16.0, lines: ["Linear light lives", "on the <em>equator</em>."], sub: "0° → 90°: halfway round" },
            { t: 16.4, end: 21.8, lines: ["Circular light sits", "at the <b>poles</b>."], sub: "E<sub>x</sub> and E<sub>y</sub> a quarter cycle apart", chime: true },
            { t: 22.2, end: 27.6, lines: ["Everything between", "is an <v>ellipse</v>."], sub: "latitude 2χ = shape · longitude 2θ = tilt" },
            { t: 28.0, end: 33.4, lines: ["A wave plate just", "<em>rotates</em> the sphere."], sub: `quarter-wave plate at 45°: 0° → ${pole} pole` },
            { t: 33.8, end: 39.2, lines: ["Partly polarized light", "sits <em>inside</em> it."], sub: "radius = degree of polarization" },
            { t: 39.6, end: 46.0, lines: ["Sunlight sits at", "the very <b>centre</b>."], sub: "unpolarized: no ellipse at all", bell: true }
        ],
        shots: [
            { t: 0, ...pair }
        ],
        actions: [
            { t: 16.5, act: "set", target: "#psiSlider", value: 45 },
            { t: 28.2, act: "click", target: '[data-preset="qwp"]', sound: "click" }
        ],
        sweeps: [
            { from: 11.0, to: 15.4, target: "#psiSlider", a: 0, b: 90 },
            { from: 16.9, to: 21.0, target: "#deltaSlider", a: 0, b: 90 },
            { from: 22.6, to: 26.8, target: "#deltaSlider", a: 90, b: 25 },
            { from: 34.2, to: 38.4, target: "#dopSlider", a: 1, b: 0.4 },
            { from: 40.0, to: 43.6, target: "#dopSlider", a: 0.4, b: 0 }
        ],
        huds: [
            { from: 10.6, to: 16.2, target: "#psiSlider", label: "Linear angle ψ", unit: "°", min: 0, max: 90 },
            { from: 16.4, to: 27.6, target: "#deltaSlider", label: "Phase difference δ", unit: "°", min: -180, max: 180 },
            { from: 33.8, to: 46.0, target: "#dopSlider", label: "Degree of polarization", digits: 2, min: 0, max: 1 }
        ],
        chips: [
            { from: 5.8, to: 27.6, items: [
                { label: "state", source: "#stat-type", accent: true },
                { label: "orientation θ", source: "#stat-orient" },
                { label: "ellipticity χ", source: "#stat-chi" }
            ] },
            { from: 28.4, to: 33.4, items: [
                { label: "state", source: "#stat-type", accent: true },
                { label: "handedness", source: "#stat-hand" }
            ] },
            { from: 34.0, to: 46.0, items: [
                { label: "state", source: "#stat-type", accent: true, pick: "^([^(]+?)\\s*(?:\\(|$)" },
                { label: "degree of pol.", source: "#stat-dop" }
            ] }
        ]
    });
}

module.exports = { build };
