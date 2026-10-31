"use strict";

/*
 * Wave plates: a thin quartz A-plate splits light between a fast and a slow axis,
 * and a quarter wave of lag turns linear light circular. The lag scales as 1/λ,
 * so the same plate is elliptical in blue. A half-wave plate mirrors linear light
 * about its axis: turn the plate by θ and the light turns by 2θ, with no loss.
 * Values come from polarization.js.
 */

const Pol = require("../../../../src/tools/shared/optics/polarization.js");
const { reel } = require("./common");

const deg = Math.PI / 180;
const D = 17.39e-6;

function build() {
    const plate = lam => Pol.plateGeometry("quartz", 45 * deg, D, lam * 1e-9);
    const red = plate(633), blue = plate(450);
    const blueOut = Pol.propagate({ psi: 0, delta: 0 }, [{ type: "plate", crystal: "quartz", angle: 45 * deg, thickness: D }], { wavelength: 450e-9 }).output.desc;
    const hwp = a => Pol.propagate({ psi: 10 * deg, delta: 0 }, [{ type: "hwp", angle: a * deg }]).output.desc;
    const before = hwp(30).orientation / deg, after = hwp(50).orientation / deg;
    const row = k => `#benchList li:nth-child(${k}) input[type="range"]`;
    const field = { target: "#fieldCanvas", fit: 12, y: 0.5 };
    return reel({
        id: "pol-waveplate",
        tool: "polarization",
        hook: "How a slice of crystal turns light circular.",
        DURATION: 52,
        cover: 19,
        music: { pattern: 1, seed: 43 },
        css: `.optics-panel:has(#sphereCanvas), .optics-panel:has(#benchCanvas), .optics-panel:has(#scanCanvas), .optics-caption, .action-bar { display: none !important; }`,
        setup: [
            { act: "click", target: '[data-preset="quartz"]' },
            { act: "click", target: "#startStopBtn" }
        ],
        captions: [
            { t: 0.4, end: 5.4, lines: ["A thin slice of", "<em>quartz</em> crystal…"], sub: `${(D * 1e6).toFixed(1)} µm thick, optic axis at 45°` },
            { t: 5.4, end: 10.6, lines: ["…has a <em>fast</em> and", "a <b>slow</b> direction."], sub: `n = ${red.nFast.toFixed(4)} and ${red.nSlow.toFixed(4)}` },
            { t: 10.6, end: 16.0, lines: ["Light split between them", "<b>drifts apart</b> inside."], sub: `lag Γ = 2π Δn d/λ = ${red.waves.toFixed(2)} wave` },
            { t: 16.4, end: 21.8, lines: ["Horizontal light in,", "<em>circular</em> light out."], sub: "a quarter-wave plate", chime: true },
            { t: 22.2, end: 27.6, lines: ["Now change", "the <em>colour</em>…"], sub: "633 nm red → 450 nm blue" },
            { t: 27.6, end: 33.0, lines: ["…the lag grows and", "the circle <b>squashes</b>."], sub: `${blue.waves.toFixed(2)} wave at 450 nm · ${blueOut.type}` },
            { t: 33.4, end: 38.8, lines: ["Twice the lag:", "a <em>half-wave plate</em>."], sub: `linear light at 10° leaves at ${before.toFixed(0)}°` },
            { t: 39.2, end: 46.0, lines: ["Turn it by θ and", "the light turns <b>2θ</b>."], sub: `plate +20° → light +${(after - before).toFixed(0)}° · I/I₀ stays 1`, bell: true }
        ],
        shots: [
            { t: 0, target: "#crystalCanvas", zoom: 1.15, y: 0.5, anchor: 0.36 },
            { t: 10.4, target: "#crystalCanvas", zoom: 1.15, y: 0.5, anchor: 0.62 },
            { t: 16.2, ...field },
            { t: 27.4, target: "#dispCanvas", fit: 12, y: 0.5 },
            { t: 33.2, ...field, dip: true }
        ],
        actions: [
            { t: 33.5, act: "click", target: '[data-preset="hwp"]', sound: "click" }
        ],
        sweeps: [
            { from: 22.6, to: 27.0, target: "#lambdaSlider", a: 633, b: 450 },
            { from: 39.8, to: 44.4, target: row(1), a: 30, b: 50 }
        ],
        huds: [
            { from: 22.2, to: 33.0, target: "#lambdaSlider", label: "Wavelength λ", unit: " nm", min: 400, max: 700 },
            { from: 39.2, to: 46.0, target: row(1), label: "Half-wave plate axis", unit: "°", min: -90, max: 90 }
        ],
        chips: [
            { from: 16.6, to: 33.0, items: [
                { label: "output", source: "#stat-type", accent: true },
                { label: "ellipticity χ", source: "#stat-chi" }
            ] },
            { from: 39.4, to: 46.0, items: [
                { label: "orientation", source: "#stat-orient", accent: true },
                { label: "transmitted I/I₀", source: "#stat-trans" }
            ] }
        ]
    });
}

module.exports = { build };
