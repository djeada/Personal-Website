"use strict";

/*
 * Section 8: Minimum spanning trees and the cheat sheet. One entry per
 * "## Beat N" in scripts/08-mst-and-cheat-sheet.md. The mst preset: Kruskal
 * frames 1-9 accept C-G, B-G, A-B, D-E, C-D, E-F and reject B-C, A-G, E-G
 * (6 edges, total 29 at frame 10); Prim from A, frames 1-10. Beats 7 and 8
 * build the cheat sheet in a side card, each row over a short clip of the
 * tool state from its section; beat 9 is the whole table and the closing card.
 */

const { labSelect, labGraph, START, MAZE_PARAMS, TOAST_CSS, LAB_CSS, DSU_CSS, netStep, dsuStep, net, NET, NET_DONE } = require("../pages");

const FULL = [.03, .02, .97, .85];
const CLIP_NET = [.02, .04, .6, .86], CLIP_GRID = [.06, .05, .56, .84], CLIP_LAB = [.06, .04, .58, .8];
const MAZE = "#maze-canvas", GRAPH = ".graph-canvas";
const page = query => ({ path: net(query), css: TOAST_CSS });
const grid = query => ({ path: `/tools/graphs/?${query}`, css: TOAST_CSS });
const steps = (from, until, count, on) => ({ ...(on ? { page: on } : {}), at: from, until, count, act: "run", fn: netStep, args: [1], unless: NET_DONE });

const ROWS = [
    ["two-way, friends → add both directions", "Two-way,"],
    ["fewest steps or minutes → BFS, all sources together", "Fewest steps"],
    ["count islands, groups → loop over starts", "Count islands,"],
    ["prerequisites, order → Kahn, fewer than n means a cycle", "Prerequisites or order:"],
    ["group, merge, redundant edge → Union-Find", "Group, merge"],
    ["cheapest, non-negative → Dijkstra", "Cheapest or fastest"],
    ["at most k stops → Bellman–Ford with a copy", "At most k stops:"],
    ["all pairs, small n → Floyd–Warshall", "All pairs"],
    ["two groups → 2-coloring", "Two groups,"],
    ["connect all cheaply → MST", "And the minimum cost"]
];
const rowAt = i => ({ beat: i < 4 ? 7 : 8, at: { word: ROWS[i][1], offset: -.2 } });
const clipAt = i => ({ word: ROWS[i][1], offset: -.6 });

function build(beats) {
    const KRUSKAL = beats[3].code[0].lines;
    return {
        part: 8,
        title: "Minimum spanning trees and the cheat sheet",
        closing: { kicker: "GRAPHS FOR LEETCODE", title: "The notes, with code for everything in this course", url: "adamdjellouli.com/articles/algorithms_and_data_structures/graphs.html", small: "Thanks for watching", hold: 6 },
        pages: {
            tree: page("preset=mst&steps=end"),
            kruskal: page("preset=mst"),
            prim: page("preset=mst&algo=prim"),
            // Clips for the cheat sheet, one per row.
            lab: { path: "/tools/data_structures/", css: LAB_CSS, setup: [{ act: "run", fn: labSelect, args: ["graph"] }] },
            multi: grid(`${MAZE_PARAMS}&algo=multi&sources=0,0;7,7;14,3&speed=10`),
            islands: grid("algo=islands&seed=4192&speed=10"),
            kahn: page("preset=course-schedule&steps=2"),
            dsu: { path: "/tools/data_structures/?structure=dsu&preset=redundant&run=3", css: DSU_CSS },
            mud: grid("algo=dijkstra&size=15&density=25&mud=20&seed=82&speed=10"),
            flights: page("preset=cheapest-flights&steps=6"),
            floyd: page("preset=floyd&steps=end"),
            square: page("preset=square&steps=1"),
            mst: page("preset=mst&steps=4")
        },
        beats: [
            { // 1. Min Cost to Connect All Points.
                page: "tree", veil: .93,
                shots: [{ at: 0, target: NET, box: FULL }],
                cards: [{ id: "points", type: "problems", from: { s: .2 }, to: 1,
                    items: [{ tag: "LEETCODE 1584", title: "Min Cost to Connect All Points", keys: ["minimum cost", "connect all"],
                        text: "Points on a plane. Joining two points costs the Manhattan distance between them. What is the minimum cost to connect all the points?" }],
                    marks: [{ item: 0, key: 0, at: "for the least total cost." }, { item: 0, key: 1, at: "Connect everything" }] }]
            },
            { // 2. The finished tree: 6 edges, total 29.
                page: "tree"
            },
            { // 3. Kruskal: cheapest first, rejecting B-C, A-G and E-G.
                page: "kruskal",
                shots: [{ at: 0, target: NET, box: FULL }],
                actions: [steps({ word: "Sort all the edges", offset: 0 }, { word: "n minus one edges.", offset: 0 }, 10)]
            },
            { // 4. The Kruskal code.
                page: "kruskal", veil: .93,
                cards: [{
                    id: "kruskal-code", type: "code", place: "center", title: "kruskal", lines: KRUSKAL, from: { s: .2 }, to: 1,
                    typing: { from: { s: .4 }, to: { word: "order E log E.", offset: 0 } },
                    highlights: [{ line: 8, at: "isn't connected," }]
                }]
            },
            { // 5. Prim from A, with the heap of candidate edges.
                page: "prim",
                shots: [{ at: 0, target: NET, box: FULL }],
                actions: [steps({ word: "Start from any node", offset: 0 }, { word: "that one edge.", offset: 0 }, 11)]
            },
            { // 6. Dense input: the array version of Prim.
                page: "prim", veil: .93,
                cards: [{
                    id: "dense", type: "big", from: { s: .2 }, to: 1,
                    lines: [{ text: "1,000 points", at: { s: .4 } }, { text: "about {n} edges", count: 500000, at: "half a million edges." }],
                    note: { text: "Prim with an array: each point keeps its cheapest link to the tree; take the smallest each round, O(n²)", at: "Prim with a plain array." }
                }]
            },
            { // 7. The cheat sheet, rows 1 to 4, each over a clip from its section.
                page: "lab",
                shots: [
                    { at: 0, target: GRAPH, spot: GRAPH, pad: 30, box: CLIP_LAB },
                    { at: clipAt(1), page: "multi", target: MAZE, box: CLIP_GRID },
                    { at: clipAt(2), page: "islands", target: MAZE, box: CLIP_GRID },
                    { at: clipAt(3), page: "kahn", target: NET, box: CLIP_NET }
                ],
                actions: [
                    { at: { s: .3 }, act: "run", fn: labGraph, args: [START.nodes, START.edges] },
                    { at: clipAt(1), page: "multi", act: "click", target: "#start" },
                    { at: clipAt(2), page: "islands", act: "click", target: "#start" },
                    steps({ word: "Prerequisites or order:", offset: .4 }, { s: -.4 }, 7, "kahn")
                ],
                // Slowed so each run fills its 4-5 s clip. A measured rate (measure + rates) finishes these short
                // runs in about half the window here (the done state lags the last visible change), so the rates are set.
                rates: [
                    { page: "multi", from: clipAt(1), to: clipAt(2), rate: .09 },
                    { page: "islands", from: clipAt(2), to: clipAt(3), rate: .12 }
                ],
                cards: [{
                    id: "sheet-side", type: "sheet", place: "side", title: "cheat sheet", limit: 5, cue: false,
                    from: { s: .2 }, to: { beat: 8, at: { s: -.3 } },
                    rows: ROWS.map(([text], i) => ({ text, at: rowAt(i) }))
                }]
            },
            { // 8. Rows 5 to 10.
                page: "dsu",
                shots: [
                    { at: 0, target: ".dsu-view", box: CLIP_NET },
                    { at: clipAt(5), page: "mud", target: MAZE, box: CLIP_GRID },
                    { at: clipAt(6), page: "flights", target: NET, box: CLIP_NET },
                    { at: clipAt(7), page: "floyd", target: NET, box: CLIP_NET },
                    { at: clipAt(8), page: "square", target: NET, box: CLIP_NET },
                    { at: clipAt(9), page: "mst", target: NET, box: CLIP_NET }
                ],
                actions: [
                    { at: { word: "Group, merge", offset: .4 }, until: { word: "Union-Find.", offset: .6 }, count: 4, act: "run", fn: dsuStep, args: [1] },
                    { at: clipAt(5), page: "mud", act: "click", target: "#start" },
                    steps({ word: "At most k stops:", offset: .3 }, { word: "with a copy.", offset: .4 }, 5, "flights"),
                    steps({ word: "Two groups,", offset: .2 }, { word: "two-coloring.", offset: 0 }, 5, "square"),
                    steps({ word: "And the minimum cost", offset: .3 }, { s: -.5 }, 6, "mst")
                ],
                rates: [{ page: "mud", from: clipAt(5), to: clipAt(6), rate: .12 }]
            },
            { // 9. The whole table under the four questions, then the closing card.
                page: "mst", veil: .93,
                cards: [{
                    id: "sheet", type: "sheet", title: "then read the statement for", kicker: "first, the four questions", focus: false, from: { s: .2 }, to: 1,
                    questions: { items: ["directed?", "weighted?", "connected?", "a tree?"], at: "directed, weighted," },
                    rows: ROWS.map(([text]) => ({ text, at: { s: .3 } }))
                }]
            }
        ]
    };
}

module.exports = { script: "08-mst-and-cheat-sheet.md", build };
