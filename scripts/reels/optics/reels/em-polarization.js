"use strict";

/*
 * Polarization is the direction E points: linear (one plane, rotated by ψ),
 * circular (E_y a quarter cycle behind, |E| constant and S steady) and elliptical
 * (any other delay δ). Filmed on the vacuum preset with the polarization controls.
 */

const EM = require("../../../../src/tools/shared/optics/emWaves.js");
const { reel } = require("./common");

function build() {
    const I0 = EM.intensity(1, 100);
    const VIEW = "#viewCanvas";
    const view = { target: VIEW, zoom: 1.15, y: 0.5 };
    return reel({
        id: "em-polarization",
        tool: "em_waves",
        hook: "Polarization: which way does E point?",
        DURATION: 52,
        cover: 24,
        music: { pattern: 1, seed: 23 },
        setup: [{ act: "click", target: '[data-preset="vacuum"]' }],
        captions: [
            { t: 0.4, end: 5.4, lines: ["Which way does", "<em>E</em> point?"], sub: "that direction is the polarization" },
            { t: 5.4, end: 10.6, lines: ["Here it stays", "in <em>one plane</em>."], sub: "linear polarization" },
            { t: 10.6, end: 16.0, lines: ["Turn that plane", "any way you like."], sub: "azimuth ψ: 0° → 45°" },
            { t: 16.4, end: 21.8, lines: ["Now delay E<sub>y</sub> by", "a <b>quarter cycle</b>…"], sub: "phase δ = 90°" },
            { t: 21.8, end: 27.4, lines: ["…and E <em>spirals</em>", "around the axis."], sub: "circular: |E| never changes", chime: true },
            { t: 27.8, end: 33.2, lines: ["The energy flow", "stops <em>flickering</em>."], sub: `S = ${I0.toFixed(1)} W/m² at every instant` },
            { t: 33.6, end: 39.2, lines: ["Any other delay", "gives an <v>ellipse</v>."], sub: "δ: 90° → 30° · elliptical" },
            { t: 39.6, end: 46.0, lines: ["Cinema 3D glasses", "sort light by <em>this</em>."], sub: "circular polarizers, one per eye", bell: true }
        ],
        shots: [
            { t: 0, ...view },
            { t: 27.4, target: "#tEnergyCanvas", zoom: 1.12, y: 0.5 },
            { t: 33.2, ...view, dip: true }
        ],
        actions: [
            { t: 16.8, act: "select", target: "#polSelect", value: "rcp", sound: "click" },
            { t: 33.9, act: "select", target: "#polSelect", value: "elliptical", sound: "click" },
            { t: 33.95, act: "set", target: "#psiSlider", value: 45 },
            { t: 33.95, act: "set", target: "#deltaSlider", value: 90 },
            { t: 39.8, act: "select", target: "#polSelect", value: "rcp", sound: "click" }
        ],
        sweeps: [
            { from: 11.0, to: 14.6, target: "#psiSlider", a: 0, b: 45 },
            { from: 34.6, to: 38.0, target: "#deltaSlider", a: 90, b: 30 }
        ],
        huds: [
            { from: 10.6, to: 16.0, target: "#psiSlider", label: "Azimuth ψ", unit: "°", min: -90, max: 90 },
            { from: 33.6, to: 39.2, target: "#deltaSlider", label: "Delay δ of E<sub>y</sub>", unit: "°", min: -180, max: 180 }
        ],
        chips: [
            { from: 28.2, to: 33.2, items: [
                { label: "average intensity", source: "#statI0", accent: true },
                { label: "net flux", source: "#statNet" }
            ] }
        ]
    });
}

module.exports = { build };
