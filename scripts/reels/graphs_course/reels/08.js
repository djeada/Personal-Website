"use strict";

/*
 * Reel 8: Six phrases, six algorithms. The cheat sheet, one row at a time, each
 * over the animation it names: BFS on the maze (part 2), islands (part 3), Kahn
 * (part 4), the redundant edge (part 5), Dijkstra in the mud (part 6) and the
 * 2-colored square (part 7).
 */

const { netStep, dsuStep, dsuRun, NET_DONE } = require("../pages");

const MAZE = "#maze-canvas";
const steps = (from, until, count) => ({ at: from, until, count, act: "run", fn: netStep, args: [1], unless: NET_DONE });
const none = { chips: [], marks: [], hides: [] };

// Network mode framed on its graph and data panel (on a phone layout the header and margins waste room).
const NETFRAME = { target: "#network-canvas, #network-panel", union: true, margin: 8, spot: "#network-stage", pad: 4 };

// The Disjoint Set view itself (reel.css hides its controls).
const DSUFRAME = { target: ".dsu-view", margin: 6, spot: false };

module.exports = {
    title: "Six phrases, six algorithms",
    cover: 12,
    end: {
        kicker: "GRAPHS FOR LEETCODE · PART 8",
        title: "The cheat<br>sheet",
        line: "read the phrase, pick the algorithm",
        list: "First ask: directed? weighted?<br>connected? a tree?",
        url: "adamdjellouli.com/tools/graphs",
        small: "FULL COURSE ON YOUTUBE · FREE TOOLS"
    },
    clips: [
        { // "Fewest steps": BFS on the course maze.
            section: "02", beat: 1, length: 11,
            override: { ...none, actions: [{ at: { s: 4.4 }, act: "click", target: "#start" }], rates: [{ from: { s: 4.4 }, to: { s: 9.8 }, measure: "bfs" }] },
            captions: [
                { lines: ["Six phrases that pick", "the graph algorithm."] },
                { lines: ["“Fewest steps”"], sub: "→ BFS, every source in the queue at once" }
            ]
        },
        { // "Count islands": loop over every start.
            section: "03", beat: 5, length: 7,
            override: { ...none, actions: [{ at: { s: .4 }, act: "click", target: "#start" }], rates: [{ from: { s: .4 }, to: { s: 6.4 }, measure: "islands" }] },
            captions: [{ lines: ["“Count islands”"], sub: "→ loop over every start, flood each piece" }]
        },
        { // "Prerequisites": Kahn.
            section: "04", beat: 3, length: 7, frame: NETFRAME,
            override: { ...none, actions: [steps({ s: .4 }, { s: -.8 }, 9)] },
            captions: [{ lines: ["“Prerequisites”"], sub: "→ Kahn: fewer than n out means a cycle" }]
        },
        { // "Redundant edge": Union-Find.
            section: "05", beat: 6, length: 7, frame: DSUFRAME,
            override: { ...none, actions: [{ at: { s: .3 }, act: "run", fn: dsuRun, args: [3] }, { at: { s: 1.6 }, until: { s: 4.6 }, count: 4, act: "run", fn: dsuStep, args: [1] }] },
            captions: [{ lines: ["“Redundant edge”"], sub: "→ Union-Find: the first failed union" }]
        },
        { // "Cheapest": Dijkstra around the mud.
            section: "06", beat: 1, length: 7,
            override: { ...none, page: "dijkstra", shots: [{ at: 0, target: MAZE }], actions: [{ at: { s: .4 }, act: "click", target: "#start" }], rates: [{ from: { s: .4 }, to: { s: 5.8 }, measure: "dijkstraMud" }] },
            captions: [{ lines: ["“Cheapest”"], sub: "→ Dijkstra, if no cost is negative" }]
        },
        { // "Two groups": 2-coloring.
            section: "07", beat: 2, length: 7, frame: NETFRAME,
            override: { ...none, actions: [steps({ s: .5 }, { s: 5 }, 6)] },
            captions: [{ lines: ["“Two groups”"], sub: "→ 2-coloring with BFS" }]
        }
    ]
};
