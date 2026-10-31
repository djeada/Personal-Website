"use strict";

/*
 * The standing-wave ratio: a wave meeting a perfect absorber keeps a flat
 * envelope; as the wall reflects more, the envelope ripples until a perfect
 * mirror pins nodes at zero. The phase of r slides the pattern by λ/4, and the
 * ripple alone tells you how much came back, which is how antennas are tuned.
 * Values come from standingWaves.js.
 */

const SW = require("../../../../src/tools/shared/optics/standingWaves.js");
const { reel } = require("./common");

const swr = r => { const s = SW.standingWaveRatio(r); return Number.isFinite(s) ? s.toFixed(1).replace(/\.0$/, "") : "∞"; };

function build() {
    const lambda = SW.wavelengthInMedium(500e12, 1);
    const half = 0.5, match = 0.2;
    const FIELD = "#fieldCanvas";
    const field = { target: FIELD, fit: 12, y: 0.5 };
    return reel({
        id: "sw-swr",
        tool: "standing_waves",
        hook: "How much of a wave bounced back? Its ripple tells you.",
        DURATION: 52,
        cover: 19,
        music: { pattern: 0, seed: 67 },
        css: `.optics-caption, .action-bar, .sw-readouts, #presetExpect { display: none !important; }`,
        setup: [
            { act: "click", target: '[data-preset="pec"]' },
            { act: "select", target: "#boundaryType", value: "custom" },
            { act: "set", target: "#rPhaseSlider", value: 180 },
            { act: "set", target: "#rMagSlider", value: 0 }
        ],
        captions: [
            { t: 0.4, end: 5.4, lines: ["A wave runs into", "a perfect <em>absorber</em>."], sub: "r = 0: nothing comes back" },
            { t: 5.4, end: 10.6, lines: ["Its envelope stays <em>flat</em>:", "a pure travelling wave."], sub: `SWR = |E|max / |E|min = ${swr(0)}` },
            { t: 10.6, end: 16.0, lines: ["Now let the wall", "reflect <em>some</em>…"], sub: `reflection |r|: 0 → ${half}` },
            { t: 16.4, end: 21.8, lines: ["…and the envelope", "<b>ripples</b>."], sub: `|E| swings ${(1 + half).toFixed(1)} ↔ ${(1 - half).toFixed(1)} · SWR = ${swr(half)}` },
            { t: 22.2, end: 27.6, lines: ["A perfect mirror:", "the dips hit <b>zero</b>."], sub: `|r| = 1 · SWR = ${swr(1)} · no net energy flow` },
            { t: 28.0, end: 33.4, lines: ["The phase of r", "<em>slides</em> the pattern."], sub: `180° → 0°: nodes move λ/4 = ${(lambda / 4 * 1e9).toFixed(0)} nm` },
            { t: 33.8, end: 39.2, lines: ["Radio engineers tune", "antennas by this <em>ratio</em>."], sub: `SWR ${swr(match)} ↔ |r| = ${match} · ${(100 * match * match).toFixed(0)}% of the power back` },
            { t: 39.6, end: 46.0, lines: ["Read the ripple, and you", "know what <b>bounced back</b>."], sub: "|r| = (SWR − 1)/(SWR + 1)", bell: true }
        ],
        shots: [
            { t: 0, ...field }
        ],
        sweeps: [
            { from: 11.0, to: 15.4, target: "#rMagSlider", a: 0, b: half },
            { from: 22.6, to: 26.6, target: "#rMagSlider", a: half, b: 1 },
            { from: 28.4, to: 32.8, target: "#rPhaseSlider", a: 180, b: 0 },
            { from: 34.2, to: 38.0, target: "#rMagSlider", a: 1, b: match }
        ],
        huds: [
            { from: 10.6, to: 27.6, target: "#rMagSlider", label: "Reflection |r|", digits: 2, min: 0, max: 1 },
            { from: 28.0, to: 33.4, target: "#rPhaseSlider", label: "Phase of r", unit: "°", min: -180, max: 180 },
            { from: 33.8, to: 39.2, target: "#rMagSlider", label: "Reflection |r|", digits: 2, min: 0, max: 1 }
        ],
        chips: [
            { from: 5.8, to: 46.0, items: [
                { label: "SWR", source: "#stat-swr", accent: true },
                { label: "reflection r", source: "#stat-boundary" }
            ] }
        ]
    });
}

module.exports = { build };
