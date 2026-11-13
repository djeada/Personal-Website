"use strict";

/*
 * Section 7: Bipartite graphs and coloring. One entry per "## Beat N" in
 * scripts/07-bipartite-and-coloring.md. Network mode presets: square (6 frames,
 * bipartite), triangle (3, edge 1-2 conflicts), two-piece (first piece done at
 * frame 6, the triangle fails at 9) and flowers (greedy, frames 1-6 plant the
 * gardens, 7 is done with types 1 2 3 2 1 4).
 */

const { netStep, net, NET, NET_DONE, TOAST_CSS } = require("../pages");

const FULL = [.03, .02, .97, .85];
const page = query => ({ path: net(query), css: TOAST_CSS });
const steps = (from, until, count) => ({ at: from, until, count, act: "run", fn: netStep, args: [1], unless: NET_DONE });
const one = at => ({ at, act: "run", fn: netStep, args: [1] });

function build(beats) {
    const CODE = beats[3].code[0].lines;
    return {
        part: 7,
        title: "Bipartite graphs and coloring",
        next: "Part 8 · Minimum spanning trees and the cheat sheet",
        pages: {
            square: page("preset=square"),
            triangle: page("preset=triangle"),
            pieces: page("preset=two-piece"),
            flowers: page("preset=flowers")
        },
        beats: [
            { // 1. Possible Bipartition.
                page: "square", veil: .93,
                shots: [{ at: 0, target: NET, box: FULL }],
                cards: [{ id: "dislike", type: "problems", from: { s: .2 }, to: 1,
                    items: [{ tag: "LEETCODE 886", title: "Possible Bipartition", keys: ["dislike", "two groups"],
                        text: "n people and a list of pairs who dislike each other. Can you split everyone into two groups so that no such pair ends up together?" }],
                    marks: [{ item: 0, key: 0, at: "Some people dislike" }, { item: 0, key: 1, at: "into two groups," }],
                    labels: [{ item: 0, text: "two groups → two colors, ends of every edge differ", at: "Two groups means two colors," }] }]
            },
            { // 2. The square: blue, orange, orange, blue. Bipartite.
                page: "square",
                actions: [steps({ word: "Color the first node blue.", offset: 0 }, { word: "On this square,", offset: .2 }, 6)]
            },
            { // 3. The triangle: the two orange neighbors are joined. Odd cycle.
                page: "triangle",
                shots: [{ at: 0, target: NET, box: FULL }],
                actions: [one({ word: "The first node is blue,", offset: 0 }), one({ word: "both its neighbors", offset: 0 }), one({ word: "Same color on both ends:", offset: -.2 })]
            },
            { // 4. The code; the outer loop is highlighted at the end.
                page: "triangle", veil: .93,
                cards: [{
                    id: "bipartite-code", type: "code", place: "center", title: "is it bipartite?", lines: CODE, from: { s: .2 }, to: 1,
                    typing: { from: { s: .4 }, to: { word: "return false.", offset: 0 } },
                    highlights: [...[2, 3, 4].map(line => ({ line, at: "the outer loop" }))]
                }]
            },
            { // 5. Two pieces: the first colors cleanly, the outer loop finds the triangle in the second.
                page: "pieces",
                shots: [{ at: 0, target: NET, box: FULL }],
                actions: [
                    steps({ word: "A search from node zero", offset: 0 }, { word: "and stops.", offset: 0 }, 6),
                    steps({ word: "the second piece contains", offset: -.2 }, { word: "a triangle.", offset: .4 }, 3)
                ]
            },
            { // 6. Two input shapes.
                page: "pieces", veil: .93,
                cards: [{ id: "shapes", type: "compare", from: { s: .2 }, to: 1, columns: [
                    { tag: "LEETCODE 785", title: "Is Graph Bipartite", sample: "graph = [[1,3],[0,2],[1,3],[0,2]]", items: ["graph[i] lists the neighbors of i"], at: { word: "Is Graph Bipartite", offset: -.2 } },
                    { tag: "LEETCODE 886", title: "Possible Bipartition", sample: ["n = 4", "dislikes = [[1,2],[1,3],[2,4]]"], items: ["dislikes as pairs, people labeled 1 to n"], at: { word: "Possible Bipartition", offset: -.2 },
                        notes: [{ text: "add both directions", at: "in both directions," }, { text: "n + 1 slots", at: "n plus one" }] }
                ] }]
            },
            { // 7. Flower Planting: greedy, smallest free type.
                page: "flowers",
                shots: [{ at: 0, target: NET, box: FULL }],
                actions: [steps({ word: "Go through the gardens", offset: 0 }, { word: "never gets stuck.", offset: 0 }, 7)]
            },
            { // 8. Coloring is hard in general.
                page: "flowers", veil: .93,
                cards: [{ id: "np", type: "sheet", kicker: "graph coloring", heading: "Is 3 colors enough? NP-complete.", title: "so the problem gives you a shortcut", from: { s: .2 }, to: 1,
                    rows: [
                        { text: "exactly two colors → BFS 2-coloring", at: "exactly two colors," },
                        { text: "a degree limit → greedy, max degree + 1 colors", at: "a degree limit" },
                        { text: "small n → backtracking", at: "small enough" }
                    ] }]
            },
            { // 9. The checklist.
                page: "flowers", veil: .93,
                cards: [{
                    id: "color-recap", type: "checklist", place: "center", title: "Bipartite and coloring",
                    items: ["Two groups means 2-coloring", "An odd cycle means impossible", "A color array with -1", "Start from every uncolored node", "Max degree + 1 colors for greedy"],
                    show: [{ at: { s: .3 } }, { at: "an odd cycle" }, { at: { word: "an odd cycle", offset: 1.2 } }, { at: "always start" }, { at: { word: "always start", offset: 1.6 } }],
                    from: { s: .1 }, to: { s: -.2 }
                }]
            }
        ]
    };
}

module.exports = { script: "07-bipartite-and-coloring.md", build };
