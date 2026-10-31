"use strict";

/*
 * What it takes for two beams to interfere. With their phase drifting, the
 * detector swings from 4 I₁ to 0. Lower the coherence |γ₁₂| and the swing fades to
 * a flat I₁ + I₂; cross the polarizations and it fades too (Fresnel–Arago); an
 * analyser at 45° projects both beams onto one axis and the fringes return.
 * Values come from interference.js.
 */

const IF = require("../../../../src/tools/shared/optics/interference.js");
const { reel } = require("./common");

const deg = Math.PI / 180;

function build() {
    const I1 = IF.singleIntensity(1);
    const swing = g => IF.intensityExtremes(1, 1, g, 0, 0);
    const full = swing(1);
    const crossed = IF.detectorBeams(1, 1, 90 * deg, null), analysed = IF.detectorBeams(1, 1, 90 * deg, 45 * deg);
    const back = IF.intensityExtremes(analysed.A1, analysed.A2, Math.abs(analysed.overlap), 0, 0);
    const DET = "#intensityCanvas";
    const det = { target: DET, fit: 12, y: 0.5 };
    return reel({
        id: "int-coherence",
        tool: "interference",
        hook: "Why don't two lamps make interference fringes?",
        DURATION: 52,
        cover: 8,
        music: { pattern: 1, seed: 59 },
        css: `.optics-caption, .plot-legend, .action-bar, .optics-readouts, .optics-warning { display: none !important; }`,
        setup: [
            { act: "click", target: '[data-preset="beating"]' },
            { act: "set", target: "#idspeed", value: 3 },
            { act: "click", target: "#startStopBtn" }
        ],
        captions: [
            { t: 0.4, end: 5.4, lines: ["Two beams whose", "phase <em>drifts</em>…"], sub: "λ₂ = 1.1 λ₁, so Δφ keeps turning" },
            { t: 5.4, end: 10.6, lines: ["…swing from <b>4×</b>", "to <b>nothing</b>."], sub: `I = ${(full.Imax / I1).toFixed(0)} I₁ ↔ ${(full.Imin / I1).toFixed(0)} · visibility V = 1` },
            { t: 10.6, end: 16.0, lines: ["Now make them less", "<em>coherent</em>…"], sub: "|γ₁₂|: how well their phases stay in step" },
            { t: 16.4, end: 21.8, lines: ["…and the swing", "<b>fades out</b>."], sub: `|γ₁₂| = 0: a flat I₁ + I₂ = ${(swing(0).Imax / I1).toFixed(0)} I₁ · V = 0` },
            { t: 22.2, end: 27.6, lines: ["Two lamps are like this:", "their phases are <em>random</em>."], sub: "so their light just adds", bell: true },
            { t: 28.0, end: 33.4, lines: ["Coherent again, but", "<em>turn</em> one polarization…"], sub: "angle between them: 0° → 90°" },
            { t: 33.4, end: 38.8, lines: ["At 90° they", "<b>can't</b> interfere."], sub: `overlap cos 90° = ${Math.abs(crossed.overlap).toFixed(0)} · Fresnel–Arago` },
            { t: 39.2, end: 46.0, lines: ["A polarizer at 45°", "brings it <em>back</em>."], sub: `both beams on one axis: ${(back.Imax / I1).toFixed(0)} I₁ ↔ ${(back.Imin / I1).toFixed(0)} · V = 1`, chime: true }
        ],
        shots: [
            { t: 0, ...det },
            { t: 27.8, target: "#polCanvas", fit: 40, y: 0.5, dip: true },
            { t: 33.2, ...det, dip: true }
        ],
        actions: [
            { t: 28.1, act: "set", target: "#idgamma", value: 1, sound: "click" },
            { t: 39.4, act: "check", target: "#idan", value: true, sound: "click" }
        ],
        sweeps: [
            { from: 11.0, to: 20.4, target: "#idgamma", a: 1, b: 0 },
            { from: 28.6, to: 32.8, target: "#idpol", a: 0, b: 90 }
        ],
        huds: [
            { from: 10.6, to: 21.8, target: "#idgamma", label: "Coherence |γ₁₂|", digits: 2, min: 0, max: 1 },
            { from: 28.0, to: 38.8, target: "#idpol", label: "Angle between polarizations", unit: "°", min: 0, max: 180 }
        ],
        chips: [
            { from: 5.8, to: 21.8, items: [
                { label: "visibility", source: "#stat-visibility", accent: true },
                { label: "coherence |μ|", source: "#stat-mu" }
            ] },
            { from: 28.4, to: 46.0, items: [
                { label: "visibility", source: "#stat-visibility", accent: true },
                { label: "overlap |μ|", source: "#stat-mu" }
            ] }
        ]
    });
}

module.exports = { build };
