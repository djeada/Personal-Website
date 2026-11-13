"use strict";

/*
 * Section 6: Weighted shortest paths. One entry per "## Beat N" in
 * scripts/06-weighted-shortest-paths.md. Beat 1 is the grid with mud (seed 82:
 * BFS 28 steps at cost 56, Dijkstra 36 steps at cost 36, both measured during
 * setup); the rest is network mode. Network Delay frames: 2 pushes (7, 3),
 * 3 pushes (4, 3), 4 pops (4, 3), 7 pops (7, 3) as stale, answer 6. Cheapest
 * Flights (k = 1): pass 1 is frames 1-5, pass 2 frames 6-10, answer 400; with
 * copy=0, frame 7 updates city 2 and frame 8 reaches 3 from it in the same pass
 * (300, marked wrong at frame 11). Floyd–Warshall: k = 0..4 is frames 1-5.
 */

const { netStep, net, NET, NET_DONE, TOAST_CSS } = require("../pages");
const { quotes } = require("../script");

const FULL = [.03, .02, .97, .85];
const MAZE = "#maze-canvas", MAZE_BOX = [.24, .03, .76, .82];
const DONE = "document.querySelector('#maze-canvas').dataset.state === 'done'";
const MUD = "size=15&density=25&mud=20&seed=82&speed=10";
const page = query => ({ path: net(query), css: TOAST_CSS });
const steps = (from, until, count) => ({ at: from, until, count, act: "run", fn: netStep, args: [1], unless: NET_DONE });
const one = at => ({ at, act: "run", fn: netStep, args: [1] });
const runs = (name, algo) => ({
    path: `/tools/graphs/?algo=${algo}&${MUD}`, css: TOAST_CSS,
    // Run twice off the record: once to read the steps, once the cost (a measure keeps one value).
    measure: ["pathLength", "pathCost"].map((key, i) => ({ name: i ? `${name}Cost` : name, start: "#start", reset: "#reset", until: DONE,
        check: "Number(document.querySelector('#maze-canvas').dataset.pathLength) > 0", read: `document.querySelector('#maze-canvas').dataset.${key}` }))
});

function build(beats) {
    const DIJKSTRA = beats[3].code[0].lines, KSTOPS = beats[8].code[0].lines;
    return {
        part: 6,
        title: "Weighted shortest paths",
        next: "Part 7 · Bipartite graphs and coloring",
        pages: {
            bfs: runs("bfsMud", "bfs"),
            dijkstra: runs("dijkstraMud", "dijkstra"),
            delay: page("preset=network-delay"),
            flights: page("preset=cheapest-flights"),
            nocopy: page("preset=cheapest-flights&copy=0&steps=6"),   // opens at the start of pass 2
            floyd: page("preset=floyd")
        },
        beats: [
            { // 1. Mud costs 5: BFS walks through it, Dijkstra goes around. Costs side by side.
                page: "bfs",
                shots: [
                    { at: 0, target: MAZE, box: MAZE_BOX },
                    { at: { word: "Dijkstra counts", offset: -.5 }, page: "dijkstra", target: MAZE, box: MAZE_BOX }
                ],
                actions: [
                    { at: { word: "BFS doesn't know", offset: -.2 }, act: "click", target: "#start" },
                    { at: { word: "Dijkstra counts", offset: .3 }, page: "dijkstra", act: "click", target: "#start" }
                ],
                rates: [
                    { from: { word: "BFS doesn't know", offset: -.2 }, to: { word: "through the mud.", offset: .2 }, measure: "bfsMud" },
                    { from: { word: "Dijkstra counts", offset: .3 }, to: { word: "but cheaper.", offset: 0 }, measure: "dijkstraMud", page: "dijkstra" }
                ],
                chips: [
                    { from: .02, to: { word: "Dijkstra counts", offset: -.6 }, items: [
                        { label: "BFS steps", source: MAZE, attr: "data-path-length" },
                        { label: "BFS path cost", source: MAZE, attr: "data-path-cost", accent: true }
                    ] },
                    { from: { word: "Dijkstra counts", offset: -.1 }, to: 1, items: [
                        { label: "BFS steps", measured: "bfsMud" },
                        { label: "BFS cost", measured: "bfsMudCost" },
                        { label: "Dijkstra steps", source: MAZE, attr: "data-path-length" },
                        { label: "Dijkstra cost", source: MAZE, attr: "data-path-cost", accent: true }
                    ] }
                ]
            },
            { // 2. Network Delay Time: weighted arrows, the dist row and the heap.
                page: "delay",
                shots: [{ at: 0, target: NET, box: FULL }],
                actions: [one({ word: "Keep a min-heap", offset: 0 })]
            },
            { // 3. Node 3 pushed at 7, then at 4; 4 pops first, 7 later as a stale entry.
                page: "delay",
                actions: [
                    one({ word: "It's pushed once", offset: .3 }),
                    one({ word: "again with cost four,", offset: 0 }),
                    one({ word: "Python's heap", offset: 0 }),
                    one({ word: "leave the old one", offset: .3 }),
                    one({ word: "leave the old one", offset: 1.3 }),
                    one({ word: "When it's popped,", offset: 0 })
                ]
            },
            { // 4. The Dijkstra code; the stale check is highlighted.
                page: "delay", veil: .93,
                cards: [{
                    id: "dijkstra-code", type: "code", place: "center", title: "dijkstra", lines: DIJKSTRA, from: { s: .2 }, to: 1,
                    typing: { from: { s: .4 }, to: { word: "There's one rule:", offset: 0 } },
                    highlights: [{ line: 6, at: "There's one rule:" }, { line: 7, at: "There's one rule:" }]
                }]
            },
            { // 5. 0-1 BFS: a deque instead of a heap.
                page: "delay", veil: .93,
                cards: [{
                    id: "deque", type: "deque", heading: "Every move costs 0 or 1", items: ["S"], from: { s: .2 }, to: 1,
                    ops: [
                        { at: { word: "Use a deque:", offset: 0 }, op: "pop" },
                        { at: { word: "zero-cost moves", offset: 0 }, op: "front", value: "A", cost: 0 },
                        { at: { word: "one-cost moves", offset: 0 }, op: "back", value: "B", cost: 1 },
                        { at: { word: "sorted by distance", offset: -.4 }, op: "front", value: "C", cost: 0 },
                        { at: { word: "linear time.", offset: -.3 }, op: "back", value: "D", cost: 1 }
                    ]
                }]
            },
            { // 6. The flights card with "at most k stops", then the Cheapest Flights preset.
                page: "flights", veil: .93,
                veils: [{ at: { word: "We need an algorithm", offset: -.4 }, level: 0 }],
                shots: [{ at: 0, target: NET, box: FULL }],
                cards: [{ id: "flights", type: "problems", from: { s: .2 }, to: { word: "We need an algorithm", offset: -.4 },
                    items: [{ tag: "LEETCODE 787", title: "Cheapest Flights Within K Stops", text: "Cities, flights and ticket prices. What is the cheapest trip with at most k stops?", keys: ["at most k stops"] }],
                    marks: [{ item: 0, key: 0, at: "at most k stops." }] }]
            },
            { // 7. Bellman–Ford with the copied row: pass 1 of 2, pass 2 of 2, 400.
                page: "flights",
                actions: [
                    steps({ word: "Go over every edge,", offset: 0 }, { word: "That's one pass.", offset: .2 }, 5),
                    steps({ word: "After two passes,", offset: -.2 }, { word: "run exactly", offset: .4 }, 5),
                    one({ word: "The catch", offset: 0 })
                ]
            },
            { // 8. No copy, pass 2: city 2 is updated, then 3 is reached from it in the same pass. 300, wrong.
                page: "nocopy",
                shots: [{ at: 0, target: NET, box: FULL }],
                actions: [
                    one({ word: "updates the middle city,", offset: 0 }),
                    one({ word: "brand new price", offset: 0 }),
                    steps({ word: "stop limit", offset: 0 }, { word: "and it's wrong.", offset: -.3 }, 3)
                ]
            },
            { // 9. The k-stops code; the copy line is highlighted.
                page: "nocopy", veil: .93,
                cards: [{
                    id: "kstops-code", type: "code", place: "center", title: "bellman–ford, at most k stops", lines: KSTOPS, from: { s: .2 }, to: 1,
                    typing: { from: { s: .4 }, to: { word: "k times E.", offset: 0 } },
                    highlights: [{ line: 4, at: { s: .4 } }]
                }]
            },
            { // 10. Floyd–Warshall: one k at a time.
                page: "floyd",
                shots: [{ at: 0, target: NET, box: FULL }],
                actions: [steps({ word: "For each node k,", offset: 0 }, { word: "outermost one.", offset: .3 }, 6)]
            },
            { // 11. The checklist.
                page: "floyd", veil: .93,
                cards: [{
                    id: "weights-recap", type: "checklist", place: "center", title: "Choose by the weights",
                    items: ["Equal costs → BFS", "0 or 1 → a deque", "Non-negative → Dijkstra, with the stale check", "At most k edges, or negative → Bellman–Ford with a copy", "All pairs, small n → Floyd–Warshall"],
                    show: ["Equal costs:", "Zero or one:", "Non-negative:", "A limit on edges,", "All pairs"].map(word => ({ at: { word, offset: -.2 } })),
                    from: { s: .1 }, to: { s: -.2 }
                }]
            }
        ]
    };
}

module.exports = { script: "06-weighted-shortest-paths.md", build };
