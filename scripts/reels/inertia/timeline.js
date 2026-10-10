"use strict";

/*
 * One timeline drives the picture and the soundtrack. The pacing is deliberately
 * calm: one idea per caption, every caption held for at least four seconds, eased
 * camera moves instead of cuts, and the physics slowed down where it matters.
 *
 * Numbers in the captions come from model.js, the same code the page runs.
 */

const M = require("../../../src/tools/moment_of_inertia/model.js");

const FPS = 30;
const BPM = 75;
const BEAT = 60 / BPM;
const DURATION = 62;

// The builder adds this many pieces per second; the page reads it from #build-speed.
const BUILD_SPEED = 3;
const BUILD_START = 31.5;
const RACE_START = 6;

function build() {
    const disk = M.evaluate({ ...M.DEFAULTS, shape: "disk" });
    const hoop = M.evaluate({ ...M.DEFAULTS, shape: "hoop" });
    const ratio = hoop.exact.total / disk.exact.total;
    const coarse = M.evaluate({ ...M.DEFAULTS, shape: "disk", resolution: 4 });
    const pieces = coarse.build.length;
    const ringSize = coarse.build.filter(p => p.idx[0] === 0).length;
    const shifted = M.evaluate({ ...M.DEFAULTS, shape: "disk", offset: 1 });

    // pos: vertical centre of the caption block as a fraction of the frame height.
    const captions = [
        { t: 0.4, end: 6.0, lines: ["A <em>solid disk</em> and a <b>thin hoop</b>."], sub: "Same mass · same size" },
        { t: 6.0, end: 10.2, lines: ["Give both the <em>same twist</em>."], sub: "Which one spins up faster?" },
        { t: 10.6, end: 14.6, lines: [`The <em>disk</em> wins:`, `it spins up <em>${ratio.toFixed(0)}× faster</em>.`], sub: "The hoop keeps all its mass far out." },
        { t: 15.0, end: 19.0, lines: ["Why? <em>Distance</em>", "from the axis."], sub: "One ball on a light arm" },
        { t: 19.0, end: 23.0, lines: ["Move it <em>twice as far</em>…"], sub: "r: 0.5 m → 1.0 m" },
        { t: 23.0, end: 27.6, lines: ["…and it is <em>4× harder</em>", "to spin."], sub: "I = m · r²   (0.25 → 1.00)" },
        { t: 28.0, end: 31.6, lines: ["A real body is", "<em>many small pieces</em>."], sub: "Each adds  mass × distance²" },
        { t: 31.6, end: 37.0, lines: ["First add the pieces", "<b>around one ring</b>."], sub: `${ringSize} pieces → one ring` },
        { t: 37.0, end: 42.8, lines: ["Then add up", "<v>all the rings</v>."], sub: `${pieces / ringSize} rings → the disk` },
        { t: 43.2, end: 48.0, lines: ["A sum inside a sum", "= a <em>double integral</em>."], sub: "Smaller pieces: Σ becomes ∫" },
        { t: 48.4, end: 52.0, lines: ["Spin it", "<em>off-center</em>?"], sub: "Move the axis 1 m away" },
        { t: 52.0, end: 56.0, lines: ["Harder again:", `add <em>M·d²</em>.`], sub: `I = ${disk.exact.total.toFixed(1)} + ${shifted.exact.shift.toFixed(1)} = ${shifted.exact.total.toFixed(1)} kg·m²` }
    ];

    // Camera shots ease from one to the next. zoom is the page scale; the target's
    // centre (or `anchor` fraction of its height) is placed at height fraction y.
    const shots = [
        { t: 0, target: "#race .optics-plot-grid", zoom: 0.95, y: 0.63 },
        { t: 14.6, target: "#primer-canvas", zoom: 1.0, y: 0.6 },
        { t: 27.6, target: "#builder", zoom: 1.5, y: 0.6 },
        { t: 36.6, target: "#build .build-grid", zoom: 0.98, y: 0.6 },
        { t: 42.8, target: "#nest-formula", zoom: 1.12, y: 0.6, spot: true },
        { t: 48.0, target: "#orbit-canvas", zoom: 1.08, y: 0.6 }
    ];

    // Page actions, in order. Each runs once when its time is reached.
    const actions = [
        { t: RACE_START, act: "click", target: "#run-motion" },
        { t: 0, act: "label", target: "#race .race-body:not(.reference) .optics-panel-title", text: "Solid disk" },
        { t: 0, act: "label", target: "#race .race-body.reference .optics-panel-title", text: "Thin hoop" },
        { t: 27.0, act: "builder", resolution: 4, speed: BUILD_SPEED },
        { t: BUILD_START, act: "click", target: "#build-play" }
    ];

    // Smooth parameter sweeps, eased, written into a slider every frame.
    const sweeps = [
        { from: 19.2, to: 22.4, target: "#primer-r", a: 0.5, b: 1.0, finger: "primer" },
        { from: 49.0, to: 51.6, target: "#offcenter-d", a: 0, b: 1.0 }
    ];

    // Game-time rate: the 2 s race plays at half speed so it is easy to follow.
    const slow = [[RACE_START, RACE_START + 4.2, 0.5]];

    // When each builder piece lands, for the soundtrack.
    const piecesAt = coarse.build.map((p, k) => ({ t: BUILD_START + (k + 1) / BUILD_SPEED, ring: p.idx[0], piece: p.idx[1], ringDone: p.idx[1] === ringSize - 1 }));

    const endCard = 56.0;
    actions.sort((a, b) => a.t - b.t);
    return { FPS, BPM, BEAT, DURATION, captions, shots, actions, sweeps, slow, piecesAt, endCard, RACE_START, BUILD_START, ratio, pieces };
}

module.exports = { build };

if (require.main === module) {
    const timeline = build();
    for (const c of timeline.captions) console.log(`${c.t.toFixed(1).padStart(5)}–${c.end.toFixed(1).padEnd(5)} ${(c.end - c.t).toFixed(1)}s  ${c.lines.join(" ").replace(/<[^>]+>/g, "")}  |  ${c.sub || ""}`);
    console.log(`builder: ${timeline.pieces} pieces, last lands at ${timeline.piecesAt.at(-1).t.toFixed(1)}s`);
}
