"use strict";

/*
 * Light plus light can make darkness: two equal waves in step give four times the
 * intensity of one, half a cycle apart they cancel, and at a quarter cycle the
 * cross term vanishes. Unequal waves never fully cancel, which is why an
 * anti-reflection coating matches its two reflections. Values come from
 * interference.js.
 */

const IF = require("../../../../src/tools/shared/optics/interference.js");
const { reel } = require("./common");

const deg = Math.PI / 180;

function build() {
    const I1 = IF.singleIntensity(1);
    const at = (a2, phi) => IF.twoBeamIntensity(I1, IF.singleIntensity(a2), phi * deg, 1) / I1;
    const fmt = x => `${x.toFixed(2)} I₁`;
    const low = IF.intensityExtremes(1, 0.5, 1, 0, 0);
    const V = IF.visibility(low.Imax, low.Imin);
    const FIELD = "#canvas", PHASOR = "#phasorCanvas";
    const field = { target: FIELD, fit: 12, y: 0.5 };
    return reel({
        id: "int-cancel",
        tool: "interference",
        hook: "Can light plus light make darkness?",
        DURATION: 52,
        cover: 18,
        music: { pattern: 0, seed: 53 },
        css: `.optics-caption, .plot-legend, .action-bar, .optics-readouts { display: none !important; }`,
        setup: [
            { act: "click", target: '[data-preset="constructive"]' },
            { act: "click", target: "#startStopBtn" }
        ],
        captions: [
            { t: 0.4, end: 5.4, lines: ["Add two identical", "<em>light waves</em>…"], sub: "same colour, same strength, in step" },
            { t: 5.4, end: 10.6, lines: ["…and you get <b>four</b>", "times the intensity."], sub: `amplitudes add: (1 + 1)² → ${fmt(at(1, 0))}` },
            { t: 10.6, end: 16.0, lines: ["Now hold one wave", "<em>back</em>…"], sub: "phase of wave 2: 0° → 180°" },
            { t: 16.4, end: 21.8, lines: ["…by half a cycle:", "<b>darkness</b>."], sub: `crest meets trough · I = ${fmt(at(1, 180))}`, chime: true },
            { t: 22.2, end: 27.6, lines: ["Each wave is an", "<em>arrow</em> that spins."], sub: "length = amplitude, angle = phase" },
            { t: 27.6, end: 33.0, lines: ["At right angles, the", "extra term <b>vanishes</b>."], sub: `Δφ = 90°: I = I₁ + I₂ = ${fmt(at(1, 90))}` },
            { t: 33.4, end: 38.8, lines: ["Make one wave weaker", "and it <em>can't</em> cancel."], sub: `A₂ = ½ A₁ · minimum ${fmt(low.Imin / I1)} · V = ${V.toFixed(1)}` },
            { t: 39.2, end: 46.0, lines: ["Anti-reflection coatings", "<em>match</em> two reflections."], sub: "n_coating = √n_glass, so they cancel", bell: true }
        ],
        shots: [
            { t: 0, ...field },
            { t: 22.0, target: PHASOR, fit: 40, y: 0.5 },
            { t: 33.2, ...field, dip: true }
        ],
        actions: [
            { t: 33.5, act: "click", target: '[data-preset="unequal"]', sound: "click" }
        ],
        sweeps: [
            { from: 11.0, to: 15.6, target: "#idphase", a: 0, b: 180 },
            { from: 22.8, to: 27.0, target: "#idphase", a: 180, b: 90 }
        ],
        huds: [
            { from: 10.6, to: 21.8, target: "#idphase", label: "Phase of wave 2", unit: "°", min: 0, max: 360 },
            { from: 22.2, to: 33.0, target: "#idphase", label: "Phase of wave 2", unit: "°", min: 0, max: 360 }
        ],
        chips: [
            { from: 5.8, to: 21.8, items: [
                { label: "intensity", source: "#stat-intensity", accent: true },
                { label: "phase Δφ", source: "#stat-phase" }
            ] },
            { from: 28.0, to: 46.0, items: [
                { label: "intensity", source: "#stat-intensity", accent: true },
                { label: "visibility", source: "#stat-visibility" }
            ] }
        ]
    });
}

module.exports = { build };
