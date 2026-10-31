"use strict";

/*
 * Two colours of light beat like two detuned strings. Bring them closer and the
 * beat slows; for real visible light it runs at tens of THz, far beyond any
 * detector, which averages it away to a steady I₁ + I₂. Lasers tuned MHz apart
 * beat slowly enough to count: heterodyne detection. Values come from
 * interference.js.
 */

const IF = require("../../../../src/tools/shared/optics/interference.js");
const { reel } = require("./common");

const C = 299792458;

function build() {
    const unit = lr => IF.beat(IF.makeWave(1, 1, 0, 1), IF.makeWave(1, lr, 0, 1));
    const wide = unit(1.1), near = unit(1.05);
    const real = IF.beat(IF.makeWave(1, 600e-9, 0, C), IF.makeWave(1, 660e-9, 0, C));
    const I1 = IF.singleIntensity(1);
    const dOmega = lr => IF.makeWave(1, lr, 0, 1).omega - IF.makeWave(1, 1, 0, 1).omega;
    const averaged = IF.intensityExtremes(1, 1, 1, dOmega(1.1), 2 * wide.TBeat);
    const TIME = "#timeCanvas", DET = "#intensityCanvas";
    return reel({
        id: "int-beats",
        tool: "interference",
        hook: "Why don't two colours of light flicker?",
        DURATION: 52,
        cover: 9,
        music: { pattern: 2, seed: 61 },
        css: `.optics-caption, .plot-legend, .action-bar, .optics-readouts, .optics-warning { display: none !important; }`,
        setup: [
            { act: "click", target: '[data-preset="beating"]' },
            { act: "set", target: "#idspeed", value: 2 },
            { act: "click", target: "#startStopBtn" }
        ],
        captions: [
            { t: 0.4, end: 5.4, lines: ["Two colours of light,", "<em>slightly</em> different…"], sub: "λ₂ = 1.1 λ₁" },
            { t: 5.4, end: 10.6, lines: ["…<b>beat</b>: loud, quiet,", "loud again."], sub: "like two guitar strings out of tune" },
            { t: 10.6, end: 16.0, lines: ["Bring the colours", "<em>closer</em>…"], sub: "beat frequency = |f₁ − f₂|" },
            { t: 16.4, end: 21.8, lines: ["…and the beat", "<em>slows down</em>."], sub: `one beat every ${wide.TBeat.toFixed(0)} → ${near.TBeat.toFixed(0)} periods` },
            { t: 22.2, end: 27.6, lines: ["Visible light beats", "<b>trillions</b> of times a second."], sub: `600 nm + 660 nm: |Δf| = ${(real.fBeat / 1e12).toFixed(0)} THz`, bell: true },
            { t: 28.0, end: 33.4, lines: ["No detector is that fast:", "it <em>averages</em>…"], sub: "integration time 0 → two beat periods" },
            { t: 33.4, end: 38.8, lines: ["…and sees a steady", "<b>I₁ + I₂</b>."], sub: `the cross term averages out: ${(averaged.Imax / I1).toFixed(0)} I₁`, chime: true },
            { t: 39.2, end: 46.0, lines: ["Lasers MHz apart beat", "<em>slowly enough</em> to count."], sub: "heterodyne beat notes · optical clocks" }
        ],
        shots: [
            { t: 0, target: TIME, fit: 12, y: 0.5 },
            { t: 27.8, target: DET, fit: 12, y: 0.5 }
        ],
        actions: [
            { t: 22.4, act: "set", target: "#idwave", value: 1.1, sound: "click" }
        ],
        sweeps: [
            { from: 11.0, to: 15.6, target: "#idwave", a: 1.1, b: 1.05 },
            { from: 28.4, to: 33.0, target: "#idint", a: 0, b: 2 * wide.TBeat }
        ],
        huds: [
            { from: 10.6, to: 21.8, target: "#idwave", label: "Wavelength ratio λ₂/λ₁", digits: 3, min: 0.5, max: 2 },
            { from: 28.0, to: 38.8, target: "#idint", label: "Detector integration time", unit: " T₁", digits: 1, min: 0, max: 40 }
        ],
        chips: [
            { from: 5.8, to: 27.6, items: [
                { label: "beat frequency", source: "#stat-beat", accent: true },
                { label: "intensity now", source: "#stat-intensity" }
            ] },
            { from: 28.4, to: 46.0, items: [
                { label: "detector reads", source: "#stat-intensity", accent: true },
                { label: "visibility", source: "#stat-visibility" }
            ] }
        ]
    });
}

module.exports = { build };
