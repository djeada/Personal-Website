"use strict";

/*
 * How much light glass reflects: 4 % straight on, climbing toward 100 % at
 * grazing incidence, and for p-polarized light exactly zero at the Brewster
 * angle, which is why glare is s-polarized. Values come from fresnel.js.
 */

const FR = require("../../../../src/tools/shared/optics/fresnel.js");
const { reel } = require("./common");

const deg = Math.PI / 180;
const unpolarized = (n, theta) => { const r = FR.solve(1, n, theta * deg); return (r.Rs + r.Rp) / 2; };
const pct = x => `${(100 * x).toFixed(0)}%`;

function build() {
    const n = 1.5, steep = 80;
    const brewster = FR.brewsterAngle(1, n) / deg;
    const atBrewster = FR.solve(1, n, brewster * deg);
    const GEO = "#canvas", PLOT = "#plotCanvas";
    const geo = { target: GEO, zoom: 1.12, y: 0.5 };
    const plot = { target: PLOT, zoom: 1.12, y: 0.5 };
    return reel({
        id: "fresnel-angle",
        tool: "fresnel",
        hook: "How much light does glass reflect?",
        DURATION: 52,
        cover: 15,
        music: { pattern: 0, seed: 31 },
        setup: [{ act: "click", target: '[data-preset="normal"]' }],
        captions: [
            { t: 0.4, end: 5.4, lines: ["How much light", "does glass <em>reflect</em>?"], sub: `air → glass, n = ${n}` },
            { t: 5.4, end: 10.6, lines: ["Straight on:", `just <em>${pct(unpolarized(n, 0))}</em>.`], sub: "R = ((n − 1)/(n + 1))²", bell: true },
            { t: 10.6, end: 15.8, lines: ["Now tilt", "the light…"], sub: `angle of incidence 0° → ${steep}°` },
            { t: 16.2, end: 21.6, lines: ["…and reflection", "<b>climbs</b>."], sub: `${pct(unpolarized(n, steep))} at ${steep}° · 100% at grazing` },
            { t: 21.6, end: 27.0, lines: ["That's why a lake", "turns into a <em>mirror</em>."], sub: "low sun, grazing light" },
            { t: 27.4, end: 32.8, lines: ["But for <v>p</v>-polarized", "light…"], sub: "E in the plane of incidence" },
            { t: 32.8, end: 38.6, lines: [`…at <em>${brewster.toFixed(1)}°</em> reflection`, "<b>vanishes</b>."], sub: "the Brewster angle · tan θ_B = n₂/n₁", chime: true },
            { t: 39.0, end: 46.0, lines: ["Glare is mostly <em>s</em>:", "polarized shades block it."], sub: `R_s = ${pct(atBrewster.Rs)}, R_p = 0 at θ_B` }
        ],
        shots: [
            { t: 0, ...geo },
            { t: 16.0, ...plot },
            { t: 32.6, ...geo }
        ],
        actions: [
            { t: 27.8, act: "click", target: 'input[name="pol"][value="p"]', sound: "click" }
        ],
        sweeps: [
            { from: 11.0, to: 15.4, target: "#thetaSlider", a: 0, b: steep },
            { from: 28.4, to: 32.4, target: "#thetaSlider", a: steep, b: brewster }
        ],
        huds: [
            { from: 10.6, to: 21.6, target: "#thetaSlider", label: "Angle of incidence θ₁", unit: "°", digits: 1, min: 0, max: 90 },
            { from: 27.4, to: 38.6, target: "#thetaSlider", label: "Angle of incidence θ₁", unit: "°", digits: 1, min: 0, max: 90 }
        ],
        chips: [
            { from: 5.8, to: 27.0, items: [
                { label: "reflected", source: "#stat-R", labelFrom: "#stat-R-label", accent: true },
                { label: "angle", source: "#stat-theta" }
            ] },
            { from: 27.8, to: 46.0, items: [
                { label: "reflected", source: "#stat-R", labelFrom: "#stat-R-label", accent: true },
                { label: "angle", source: "#stat-theta" }
            ] }
        ]
    });
}

module.exports = { build };
