"use strict";

/*
 * Reel 7: Why a triangle can't be two-colored. The square succeeds (part 7
 * beat 2), the triangle fails (beat 3), and a triangle anywhere fails the whole
 * graph (beat 5, two pieces).
 */

const { netStep, NET_DONE } = require("../pages");

const steps = (from, until, count) => ({ at: from, until, count, act: "run", fn: netStep, args: [1], unless: NET_DONE });
const one = at => ({ at, act: "run", fn: netStep, args: [1] });

// Network mode framed on its graph and data panel (on a phone layout the header and margins waste room).
const NETFRAME = { target: "#network-canvas, #network-panel", union: true, margin: 8, spot: "#network-stage", pad: 4 };

module.exports = {
    title: "Why a triangle can't be two-colored",
    cover: 20,
    end: {
        kicker: "GRAPHS FOR LEETCODE · PART 7",
        title: "Bipartite<br>graphs",
        line: "two groups → two colors → no odd cycle",
        list: "Is Graph Bipartite · Possible Bipartition<br>Flower Planting With No Adjacent",
        url: "adamdjellouli.com/tools/graphs",
        small: "FULL COURSE ON YOUTUBE · FREE TOOLS"
    },
    clips: [
        { // The square: blue, orange, blue, orange.
            section: "07", beat: 2, length: 12, frame: NETFRAME,
            override: { actions: [steps({ s: 1.2 }, { s: 7.5 }, 6)] },
            captions: [
                { lines: ["Two colors: every edge", "joins blue to orange."], sub: "BFS colors ring by ring" },
                { lines: ["A square works."], sub: "blue, orange, blue, orange" }
            ]
        },
        { // The triangle: the two orange neighbors touch.
            section: "07", beat: 3, length: 12, frame: NETFRAME,
            override: { actions: [one({ s: 1.2 }), one({ s: 3.2 }), one({ s: 6.2 })] },
            captions: [
                { lines: ["Now a <em>triangle</em>."], sub: "blue first, both neighbors orange" },
                { lines: ["Those two touch: same", "color, <b>impossible</b>."], sub: "an odd cycle can't alternate" }
            ]
        },
        { // Two pieces: the triangle is in the second one.
            section: "07", beat: 5, length: 12, frame: NETFRAME,
            override: { actions: [steps({ s: .8 }, { s: 4.8 }, 6), steps({ s: 6.4 }, { s: 9.2 }, 3)] },
            captions: [
                { lines: ["The first piece", "colors cleanly…"] },
                { lines: ["…but a triangle anywhere", "breaks the whole graph."], sub: "start from every uncolored node" }
            ]
        }
    ]
};
