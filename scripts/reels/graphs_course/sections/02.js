"use strict";

/*
 * Section 2: Breadth-first search. One entry per "## Beat N" in
 * scripts/02-breadth-first-search.md (times are relative to the beat; see
 * timeline.js). The maze is the course maze (pages.js MAZE_PARAMS), shared with
 * parts 1 and 3.
 */

const { labSelect, labGraph, labOp, START, MAZE_PARAMS, TOAST_CSS, LAB_CSS } = require("../pages");
const { quotes } = require("../script");

const MAZE = "#maze-canvas", GRAPH = ".graph-canvas";
const DONE = "document.querySelector('#maze-canvas').dataset.state === 'done'";
const MAZE_BOX = [.24, .03, .76, .82];     // maze left of centre, chips on the right
const MAZE_WIDE = [.2, .03, .8, .82];
const MAZE_LEFT = [.04, .07, .5, .82];     // maze beside a card on the right, clear of the watermark
const stat = (label, attr, accent) => ({ label, source: MAZE, attr, accent });
const graphs = params => `/tools/graphs/?${MAZE_PARAMS}&${params}`;

function build(beats) {
    const BFS_CODE = beats[2].code[0].lines, LEVEL_CODE = beats[8].code[0].lines;
    const [grid] = quotes(beats[0]), [oranges] = quotes(beats[6]);
    const same = (from, to) => ({ from, to });

    return {
        part: 2,
        title: "Breadth-first search",
        next: "Part 3 · Depth-first search, components and cycles",
        pages: {
            // A full run, paced by measure + rates in beat 1 and left finished for beat 6.
            bfs: { path: graphs("algo=bfs&speed=10"), css: TOAST_CSS,
                measure: [{ name: "bfs", start: "#start", reset: "#reset", until: DONE, check: "Number(document.querySelector('#maze-canvas').dataset.pathLength) > 0" }] },
            // Stepped by hand with distances on: rings in beat 2, single dequeues in beat 4.
            rings: { path: graphs("algo=bfs&distances=1&speed=10"), css: TOAST_CSS },
            lab: { path: "/tools/data_structures/", css: LAB_CSS, setup: [{ act: "run", fn: labSelect, args: ["graph"] }] },
            multi: { path: graphs("algo=multi&sources=0,0;7,7;14,3&speed=10"), css: TOAST_CSS }
        },
        beats: [
            { // 1. BFS on the maze until the path appears, then the shortest-path card beside the grid.
                page: "bfs",
                shots: [
                    { at: 0, target: MAZE, box: MAZE_BOX },
                    { at: { word: "fewest", offset: -.6 }, target: MAZE, box: MAZE_LEFT }
                ],
                actions: [{ at: { word: "Now we search", offset: -.2 }, act: "click", target: "#start" }],
                rates: [{ from: { word: "Now we search", offset: -.2 }, to: { word: "question", offset: .2 }, measure: "bfs" }],
                chips: [{ from: .02, to: { word: "fewest", offset: -.7 }, items: [stat("cells visited", "data-visited"), stat("path length", "data-path-length", true)] }],
                cards: [{ id: "grid", type: "problems", place: "beside", items: [{ tag: "LEETCODE 1091", title: "Shortest Path in Binary Matrix", text: grid, keys: ["fewest number of moves"] }],
                    from: { word: "fewest", offset: -.2 }, to: 1, marks: [{ item: 0, key: 0, at: { word: "Fewest moves", offset: -.1 } }] }]
            },
            { // 2. Distances on, one level per step: the numbers spread in rings.
                page: "rings",
                shots: [{ at: 0, target: MAZE, box: MAZE_WIDE }],
                actions: [
                    { at: { word: "one step", offset: -.3 }, act: "click", target: "#step-level" },
                    { at: { word: "two steps", offset: -.3 }, act: "click", target: "#step-level" },
                    { at: { word: "three,", offset: -.3 }, act: "click", target: "#step-level" },
                    { at: { word: "three,", offset: 1.1 }, until: { s: -1 }, count: 10, act: "click", target: "#step-level", unless: DONE }
                ]
            },
            { // 3. The BFS code types in, line by line with the narration.
                page: "rings", veil: .93,
                cards: [{
                    id: "bfs-code", type: "code", place: "center", title: "breadth-first search", lines: BFS_CODE, from: { s: .2 }, to: 1,
                    typing: [
                        same({ s: .4 }, "first in,"), same({ s: .4 }, "first in,"),
                        same("Put the start", { word: "Put the start", offset: .9 }), same({ word: "Put the start", offset: .9 }, "Then"),
                        same("Then", "repeatedly"), same("take the node", "front,"),
                        same("push each", "neighbor"), same("neighbor", "seen yet"), same("seen yet", "one step"), same("one step", "came from.")
                    ],
                    highlights: [
                        { line: 4, at: "Put the start", until: "Then" },
                        { line: 6, at: "take the node", until: "push each" },
                        ...[8, 9, 10].map(line => ({ line, at: "push each", until: "This dictionary" })),
                        ...[3, 9].map(line => ({ line, at: "This dictionary" }))
                    ]
                }]
            },
            { // 4. One dequeue at a time; outlined cells are in the queue.
                page: "rings",
                shots: [{ at: 0, target: MAZE, box: MAZE_BOX }],
                actions: [{ at: { s: 1 }, until: { s: -1.2 }, count: 22, act: "click", target: "#step", unless: DONE }],
                chips: [{ from: .02, to: 1, items: [
                    { label: "in the queue", source: "#search-status", pick: "Queue holds (\\d+)", accent: true },
                    stat("visited", "data-visited")
                ] }]
            },
            { // 5. The lab graph from part 1: BFS from A visits A, B, C, D, E, F.
                page: "lab",
                shots: [{ at: 0, target: GRAPH, spot: GRAPH, pad: 40, box: [.2, .03, .8, .7] }],
                actions: [
                    { at: { s: .45 }, act: "run", fn: labGraph, args: [START.nodes, START.edges] },
                    { at: { word: "A, then B", offset: -.5 }, act: "run", fn: labOp, args: ["search", "F"] }
                ],
                chips: [{ place: "bottom", from: { word: "A, then B", offset: 3.4 }, to: { s: -.3 }, items: [
                    { label: "BFS", source: "#trace-list li", match: "^BFS", pick: "dequeued (.*?)(?: and found.*)?$" }
                ] }]
            },
            { // 6. Back on the finished maze: the path and its length.
                page: "bfs",
                shots: [{ at: 0, target: MAZE, box: MAZE_BOX }],
                chips: [{ from: .02, to: 1, items: [stat("path length", "data-path-length", true), stat("cells visited", "data-visited")] }]
            },
            { // 7. Rotting Oranges.
                page: "bfs", veil: .93,
                cards: [{ id: "oranges", type: "problems", from: { s: .2 }, to: 1,
                    items: [{ tag: "LEETCODE 994", title: "Rotting Oranges", text: oranges, keys: ["rotten", "Every minute"] }],
                    marks: [{ item: 0, key: 0, at: "every rotten orange" }, { item: 0, key: 1, at: "same time." }],
                    labels: [{ item: 0, text: "same trick: 01 Matrix (542), distance to the nearest 0", at: "01 Matrix," }] }]
            },
            { // 8. Multi-source BFS with three sources, one level (minute) per step.
                page: "multi",
                shots: [{ at: 0, target: MAZE, box: MAZE_BOX }],
                actions: [{ at: { word: "Watch", offset: .4 }, until: { s: -2 }, count: 13, act: "click", target: "#step-level", unless: DONE }],
                chips: [{ from: .02, to: 1, items: [stat("level = minute", "data-level", true), stat("cells reached", "data-visited")] }]
            },
            { // 9. The level-by-level loop.
                page: "multi", veil: .93,
                cards: [{
                    id: "level-code", type: "code", place: "center", title: "one level per minute", lines: LEVEL_CODE, from: { s: .2 }, to: 1,
                    typing: { from: { s: .4 }, to: { word: "inner loop.", offset: -.3 } },
                    highlights: [
                        { line: 3, at: "inner loop.", until: "Everything" },
                        { line: 4, at: "process exactly", until: "Everything" },
                        { line: 6, at: "next minute." }
                    ]
                }]
            },
            { // 10. The checklist, in the order the narration gives it.
                page: "multi", veil: .93,
                cards: [{
                    id: "bfs-recap", type: "checklist", place: "center", title: "Breadth-first search",
                    items: ["O(V + E): every node and edge once", "Every step costs the same", "A queue, first in, first out", "Mark on push", "Levels are distances", "Several starts go in together"],
                    // Up as the beat starts: the first line is what its first sentence says.
                    show: [{ at: { s: .35 } }, ...["same.", "a queue,", "mark on push,", "levels are", "several starts"].map(word => ({ at: { word, offset: -.2 } }))],
                    from: { s: .1 }, to: { s: -.2 }
                }]
            }
        ]
    };
}

module.exports = { script: "02-breadth-first-search.md", build };
