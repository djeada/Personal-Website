"use strict";

/*
 * Where does a lens put the image? One f = 100 mm lens; the object walks in from
 * 3f to inside f. Real and shrinking, real and growing, at infinity, then virtual
 * and upright: the magnifying glass. Numbers come from geometricOptics.js.
 */

const GO = require("../../../../src/tools/shared/optics/geometricOptics.js");
const { reel } = require("./common");

const F = 100;
const image = so => GO.thinLensImage(F, so);
const mm = v => `${Math.round(v)} mm`;

function build() {
    const near = image(150), virtual = image(60);
    const BENCH = "#benchCanvas";
    return reel({
        id: "go-image",
        tool: "geometric_optics",
        hook: "Where does a lens put the image?",
        DURATION: 52,
        cover: 6,
        setup: [
            { act: "click", target: '[data-preset="single"]' },
            { act: "option", target: "#elSelect", match: "Detector" },
            { act: "click", target: "#btnRemove" },
            { act: "set", target: "#objH", value: 8 },
            { act: "set", target: "#objDist", value: 150 },
            { act: "click", target: "#btnFit" },
            { act: "set", target: "#objDist", value: 300 }
        ],
        captions: [
            { t: 0.4, end: 5.0, lines: ["One lens.", "One <b>arrow</b> to image."], sub: `f = ${F} mm · object ${300} mm away` },
            { t: 5.0, end: 10.2, lines: ["Rays from the tip", "<em>meet again</em> behind it."], sub: `a real image, upside down`, bell: true },
            { t: 10.6, end: 14.4, lines: ["Bring the object", "<em>closer</em>…"], sub: "300 mm → 150 mm" },
            { t: 14.4, end: 18.6, lines: ["…the image slides away", "and <b>grows</b>."], sub: `image at ${mm(near.si)} · ${Math.abs(near.m).toFixed(0)}× bigger` },
            { t: 19.0, end: 23.0, lines: ["Now slide it to", "the <em>focal point</em>…"], sub: `sₒ = f = ${F} mm` },
            { t: 23.0, end: 27.6, lines: ["…and the rays", "leave <em>parallel</em>."], sub: "they never meet: image at ∞", bell: true },
            { t: 28.0, end: 32.4, lines: ["Closer still,", "they <em>spread apart</em>."], sub: "no real image any more" },
            { t: 32.4, end: 38.6, lines: ["Trace them back:", "a <b>virtual</b>, upright image."], sub: `${mm(-virtual.si)} in front · ${virtual.m.toFixed(1)}× · a magnifier`, chime: true },
            { t: 39.0, end: 44.6, lines: ["One rule covers", "<em>all of it</em>."], sub: "1/sₒ + 1/sᵢ = 1/f" }
        ],
        shots: [
            { t: 0, target: BENCH, zoom: 1.15, y: 0.5 }
        ],
        sweeps: [
            { from: 11.0, to: 16.0, target: "#objDist", a: 300, b: 150 },
            { from: 19.4, to: 22.4, target: "#objDist", a: 150, b: F },
            { from: 28.4, to: 31.6, target: "#objDist", a: F, b: 60 }
        ],
        huds: [
            { from: 10.2, to: 32.4, target: "#objDist", label: "Object distance sₒ", unit: " mm", min: 0, max: 320 }
        ],
        chips: [
            { from: 5.4, to: 44.6, items: [
                { label: "image distance", source: "#statSi", accent: true },
                { label: "magnification", source: "#statM", labelFrom: "#statMLabel" }
            ] }
        ]
    });
}

module.exports = { build };
