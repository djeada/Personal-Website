"use strict";

/*
 * Two lenses, three instruments: the Keplerian telescope (inverted, 4×), the
 * Galilean telescope (upright, shorter) and the compound microscope (two stages
 * of magnification). Focal lengths come from the presets in geometricOptics.js.
 */

const GO = require("../../../../src/tools/shared/optics/geometricOptics.js");
const { reel } = require("./common");

const focal = key => GO.PRESETS[key].elements.filter(e => e.type === "thin").map(e => Math.round(e.f * 1000));

function build() {
    const [f1, f2] = focal("kepler"), [, g2] = focal("galilean"), [fo, fe] = focal("microscope");
    const mic = GO.PRESETS.microscope.object.dist * 1000;
    const inter = GO.thinLensImage(fo, mic);
    const total = Math.abs(inter.m) * 250 / fe;
    const BENCH = "#benchCanvas";
    const zoom = 1.15, y = 0.5;
    return reel({
        id: "go-telescope",
        tool: "geometric_optics",
        hook: "How do two lenses make a telescope?",
        DURATION: 56,
        cover: 12,
        music: { pattern: 1, seed: 11 },
        setup: [
            { act: "click", target: '[data-preset="kepler"]' },
            { act: "set", target: "#objAng", value: 0 }
        ],
        captions: [
            { t: 0.4, end: 5.2, lines: ["How do <em>two lenses</em>", "make a telescope?"], sub: `f₁ = ${f1} mm · f₂ = ${f2} mm` },
            { t: 5.2, end: 10.4, lines: ["Starlight arrives", "<em>parallel</em>."], sub: "a star is effectively at infinity" },
            { t: 10.4, end: 15.8, lines: ["Lens 1 focuses it.", "Lens 2 <em>straightens</em> it."], sub: "the two lenses share one focal point" },
            { t: 16.2, end: 20.6, lines: ["Tilt the star", "a little…"], sub: "field angle 0° → 2°" },
            { t: 20.6, end: 25.6, lines: ["…and the beam out", `tilts <b>${f1 / f2}× more</b>.`], sub: `−f₁/f₂ = −${f1 / f2}: the view is upside down`, chime: true },
            { t: 26.6, end: 31.8, lines: ["Swap in a", "<v>negative</v> eyepiece:"], sub: `Galilean telescope · f₂ = −${Math.abs(g2)} mm` },
            { t: 31.8, end: 37.2, lines: ["an <em>upright</em> view", "in a shorter tube."], sub: `+${f1 / Math.abs(g2)}× · tube ${f1 + g2} mm, not ${f1 + f2} mm`, bell: true },
            { t: 38.0, end: 43.6, lines: ["A microscope: lens 1", "makes a <em>big real image</em>…"], sub: `objective f = ${fo} mm · ${Math.abs(inter.m).toFixed(0)}× · upside down` },
            { t: 43.6, end: 49.4, lines: ["…and lens 2", "magnifies it <b>again</b>."], sub: `${Math.abs(inter.m).toFixed(0)}× · ${250 / fe}× = ${total.toFixed(0)}× overall`, chime: true }
        ],
        shots: [
            { t: 0, target: BENCH, zoom, y },
            { t: 26.2, target: BENCH, zoom, y, dip: true },
            { t: 37.6, target: BENCH, zoom, y, dip: true }
        ],
        actions: [
            { t: 26.7, act: "click", target: '[data-preset="galilean"]', sound: "click" },
            { t: 38.1, act: "click", target: '[data-preset="microscope"]', sound: "click" }
        ],
        sweeps: [
            { from: 16.6, to: 20.2, target: "#objAng", a: 0, b: 2 }
        ],
        huds: [
            { from: 15.8, to: 25.6, target: "#objAng", label: "Field angle of the star", unit: "°", digits: 1, min: 0, max: 3 }
        ],
        chips: [
            { from: 5.6, to: 25.6, items: [{ label: "magnification", source: "#statM", labelFrom: "#statMLabel", accent: true }, { label: "focal length", source: "#statEfl" }] },
            { from: 27.6, to: 37.2, items: [{ label: "magnification", source: "#statM", labelFrom: "#statMLabel", accent: true }, { label: "focal length", source: "#statEfl" }] }
        ]
    });
}

module.exports = { build };
