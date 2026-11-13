"use strict";

/*
 * Section 1: Reading a graph problem. One entry per "## Beat N" in
 * scripts/01-reading-graph-problems.md; times are relative to the beat (see
 * timeline.js). Card text is taken from the script's bullets and code fence, so
 * the video says what the script says.
 */

const { labSelect, labGraph, labOp, labClearMiss, START, MAZE_PARAMS, TOAST_CSS, LAB_CSS } = require("../pages");
const { quotes } = require("../script");

// Framing, by selector, so it survives small layout changes in the tools.
const GRAPH = ".graph-canvas", MAZE = "#maze-canvas", MODEL = ".control-card:has(#model-view)";
const LEFT_FREE = [.3, .03, .97, .82];     // graph on the right, left column free for the checklist
const RIGHT_HALF = [.53, .04, .98, .82];   // graph beside the code panel
const MAZE_BOX = [.28, .03, .75, .82];     // maze between the checklist and the chips
const MAZE_LEFT = [.04, .07, .5, .82];     // maze beside a card on the right, clear of the watermark
const node = v => `.graph-node[data-value="${v}"]`;
const edge = ([a, b]) => `.graph-edge[data-edge="${a}-${b}"]`;
const adjRow = v => `#model-view .adj-row:nth-child(${START.nodes.indexOf(v) + 2})`;   // after the heading

const QUESTIONS = ["Does an edge go both ways?", "Does every edge cost the same?", "Is it a tree?", "Is it promised to be connected?"];
// The checklist builds one line per question; `upto` is the question this beat asks.
const checklist = (upto, word, place = "side") => ({
    id: "questions", type: "checklist", place, title: "Four questions", items: QUESTIONS, cue: false,
    show: QUESTIONS.map((q, i) => (i < upto ? 0 : i === upto ? { at: { word, offset: -.2 } } : null)),
    active: [{ item: upto, at: { word, offset: -.2 } }]
});

// Beat 4: the code consumes one pair every STEP seconds, starting just after "one end".
const STEP = .95;
const pairAt = (i, extra = 0) => ({ word: "one end", offset: .5 + STEP * i + extra });

function build(beats) {
    const [course, islands, flights] = beats[0].bullets;
    const PROBLEMS = [
        { tag: "LEETCODE 207", title: "Course Schedule", text: course, keys: ["before"] },
        { tag: "LEETCODE 200", title: "Number of Islands", text: islands, keys: ["land"] },
        { tag: "LEETCODE 787", title: "Cheapest Flights Within K Stops", text: flights, keys: ["prices", "at most k stops"] }
    ];
    const CODE = beats[3].code[0].lines;
    const labels = quotes(beats[9]);

    return {
        part: 1,
        title: "Reading a graph problem",
        next: "Part 2 · Breadth-first search",
        pages: {
            lab: { path: "/tools/data_structures/", css: LAB_CSS, setup: [{ act: "run", fn: labSelect, args: ["graph"] }] },
            maze: {
                path: `/tools/graphs/?${MAZE_PARAMS}&algo=bfs&speed=10`,
                css: TOAST_CSS,
                // How long the BFS takes in page time, so beat 6 can stretch it to its slot.
                measure: [{
                    name: "bfs", start: "#start", reset: "#reset",
                    until: "document.querySelector('#maze-canvas').dataset.state === 'done'",
                    check: "Number(document.querySelector('#maze-canvas').dataset.pathLength) > 0"
                }]
            }
        },
        beats: [
            { // 1. Three problem cards appear one after another.
                page: "lab", veil: .93,
                shots: [{ at: 0, target: GRAPH, spot: false }],
                cards: [{
                    id: "problems", type: "problems", items: PROBLEMS, from: 0, to: { beat: 2, at: 1 },
                    show: [{ at: { word: "three", offset: -.2 } }, { at: { word: "second", offset: -.3 } }, { at: { word: "third", offset: -.3 } }],
                    marks: [{ item: 0, key: 0, at: { beat: 2, at: .1 } }, { item: 1, key: 0, at: { beat: 2, at: .2 } },
                        { item: 2, key: 0, at: { beat: 2, at: .3 } }, { item: 2, key: 1, at: { beat: 2, at: .4 } }]
                }]
            },
            { // 2. The key words light up (marks on the beat 1 card).
                page: "lab", veil: .93
            },
            { // 3. The lab's graph: six vertices appear, then the edges.
                page: "lab",
                shots: [{ at: 0, target: GRAPH, spot: GRAPH, pad: 40, box: [.18, .03, .82, .82] }],
                hides: [
                    ...START.nodes.map((v, i) => ({ selector: node(v), until: { s: .7 + .15 * i } })),
                    ...START.edges.map((e, i) => ({ selector: edge(e), until: { word: "edges", offset: .2 + .18 * i } }))
                ]
            },
            { // 4. The code types in; each pair it consumes lights its edge, then the adjacency list, then the tree.
                page: "lab",
                shots: [
                    { at: 0, target: GRAPH, spot: GRAPH, pad: 30, box: RIGHT_HALF, dip: true },
                    { at: { word: "the shape", offset: .1 }, target: MODEL, box: RIGHT_HALF, maxZoom: 1.7, dim: 1 },
                    { at: { word: "costs", offset: -.3 }, target: GRAPH, spot: GRAPH, pad: 30, box: RIGHT_HALF }
                ],
                actions: [{ at: { s: .45 }, act: "run", fn: labGraph, args: [START.nodes, START.edges] }],
                marks: [
                    // Each consumed pair: its edge stays lit, its two ends light while it is the current pair.
                    ...START.edges.map((e, i) => ({ selector: edge(e), tone: "edge", from: pairAt(i), to: { beat: 5, at: 1 } })),
                    ...START.edges.flatMap((e, i) => e.map(v => ({ selector: node(v), from: pairAt(i), to: pairAt(i, STEP - .1) }))),
                    // On the adjacency list, the rows light top to bottom.
                    ...START.nodes.map((v, i) => ({ selector: adjRow(v), tone: "row", from: { word: "the shape", offset: .9 + .25 * i }, to: { word: "costs", offset: -.3 } }))
                ],
                cards: [{
                    id: "code", type: "code", place: "left", title: "build the graph", lines: CODE, from: { s: .3 }, to: { beat: 5, at: 1 },
                    pairs: { label: "edges", items: START.edges.map(e => `[${e[0]},${e[1]}]`) },
                    steps: START.edges.map((e, i) => ({ at: pairAt(i) })),
                    typing: [
                        { from: { word: "an empty", offset: -.2 }, to: "node," },
                        { from: { word: "for each", offset: -.1 }, to: "pair," },
                        { from: { word: "one end", offset: -.3 }, to: { word: "one end", offset: .1 } },
                        { from: { word: "one end", offset: .1 }, to: { word: "one end", offset: .45 } }
                    ],
                    highlights: [
                        ...[3, 4].map(line => ({ line, at: pairAt(0), until: pairAt(4, STEP) })),
                        { line: 4, at: { beat: 5, at: { word: "last line", offset: -.3 } } }
                    ]
                }]
            },
            { // 5. The last line is highlighted, then the course card with "before" marked.
                page: "lab", veil: .93,
                cards: [
                    checklist(0, "First:", "left-low"),
                    { id: "course", type: "problems", place: "right", items: [PROBLEMS[0]], from: { word: "Prerequisites", offset: -.3 }, to: 1,
                        marks: [{ item: 0, key: 0, at: { word: "Course Schedule", offset: .2 } }],
                        labels: [{ item: 0, text: "pair [a, b]: edge b → a", at: { word: "edge goes", offset: -.2 } }] }
                ]
            },
            { // 6. BFS on the maze until the path appears; then the flights card beside the grid.
                page: "maze",
                shots: [
                    { at: 0, target: MAZE, box: MAZE_BOX },
                    { at: { word: "In the flight", offset: -.5 }, target: MAZE, box: MAZE_LEFT }
                ],
                actions: [{ at: { word: "grid,", offset: -.2 }, act: "click", target: "#start" }],
                rates: [{ from: { word: "grid,", offset: -.2 }, to: { word: "this.", offset: .2 }, measure: "bfs" }],
                chips: [{ from: .02, to: { word: "In the flight", offset: -.6 }, items: [
                    { label: "cells visited", source: MAZE, attr: "data-visited" },
                    { label: "path length", source: MAZE, attr: "data-path-length", accent: true }
                ] }],
                cards: [
                    { ...checklist(1, "Second:"), to: { word: "In the flight", offset: -.6 } },
                    { id: "flights", type: "problems", place: "beside", items: [PROBLEMS[2]], from: { word: "In the flight", offset: -.1 }, to: 1,
                        marks: [{ item: 0, key: 0, at: { word: "prices", nth: 2, offset: -.1 } }] }
                ]
            },
            { // 7. The starting graph; add the edge E to F and it closes a cycle.
                page: "lab",
                shots: [{ at: 0, target: GRAPH, spot: GRAPH, pad: 40, box: LEFT_FREE }],
                actions: [
                    { at: { s: .45 }, act: "run", fn: labGraph, args: [START.nodes, START.edges] },
                    { at: { word: "Add one", offset: -.9 }, act: "run", fn: labOp, args: ["special", "E", "F"] }
                ],
                marks: ["A", "B", "D", "F", "E", "C"].map((v, i) => ({ selector: node(v), from: { word: "cycle: A, B, D, F, E, C", pick: i + 1 }, to: { word: "Trees", offset: -.2 } })),
                cards: [checklist(2, "Third:")]
            },
            { // 8. Back to the starting graph, remove D: F is cut off, and a search from A never reaches it.
                page: "lab",
                shots: [{ at: 0, target: GRAPH, spot: GRAPH, pad: 40, box: LEFT_FREE, dip: true }],
                actions: [
                    { at: { s: .45 }, act: "run", fn: labGraph, args: [START.nodes, START.edges] },
                    { at: { word: "remove", offset: -.2 }, act: "run", fn: labOp, args: ["remove", "D"] },
                    { at: { word: "search from A", offset: -.3 }, act: "run", fn: labOp, args: ["search", "F"] },
                    // The lab rings the last vertex it inspected as a miss; here that reads as an error, so clear it.
                    { at: { word: "search from A", offset: 1.8 }, until: { word: "search from A", offset: 4.5 }, count: 10, act: "run", fn: labClearMiss }
                ],
                marks: [{ selector: node("D"), from: "Watch", to: { word: "remove", offset: 1 } },
                    { selector: node("F"), from: { word: "cut off", offset: -.3 }, to: { s: -.4 } }],
                cards: [checklist(3, "Fourth:")]
            },
            { // 9. Two constraint lines.
                page: "lab", veil: .93,
                cards: [{
                    id: "constraints", type: "constraints", from: { word: "constraints,", offset: -.5 }, to: 1,
                    lines: [{ text: "1 ≤ n ≤ 10⁵", note: "→ one pass, O(V + E)" }, { text: "1 ≤ n ≤ 100", note: "→ even O(n³) is fine" }],
                    show: [{ at: { word: "constraints,", offset: -.3 } }, { at: { word: "With", nth: 2, offset: -.2 } }],
                    notes: [{ at: "pass" }, { at: "cubic" }]
                }]
            },
            { // 10. The three problem cards return, and each gains a label.
                page: "lab", veil: .93,
                cards: [{
                    id: "problems-again", type: "problems", items: PROBLEMS, from: { s: .1 }, to: { s: -.2 }, place: "high",
                    show: [{ at: { s: .2 } }, { at: { s: .35 } }, { at: { s: .5 } }],
                    marks: [{ item: 0, key: 0, at: "Courses:" }, { item: 1, key: 0, at: "map:" }, { item: 2, key: 0, at: "Flights:" }, { item: 2, key: 1, at: { word: "limit on stops" } }],
                    labels: [{ item: 0, text: labels[0], at: "topological" }, { item: 1, text: labels[1], at: { word: "counting" } }, { item: 2, text: labels[2], at: "Bellman–Ford," }]
                }]
            }
        ]
    };
}

module.exports = { script: "01-reading-graph-problems.md", build };
