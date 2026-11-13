"use strict";

/*
 * Section 3: Depth-first search, components and cycles. One entry per
 * "## Beat N" in scripts/03-depth-first-search.md. Same maze as part 2
 * (pages.js MAZE_PARAMS); the BFS path length shown beside DFS's in beat 1 is
 * measured on that maze during setup, not typed in.
 */

const { labSelect, labGraph, labOp, labTraversal, START, MAZE_PARAMS, TOAST_CSS, LAB_CSS } = require("../pages");
const { quotes } = require("../script");

const MAZE = "#maze-canvas", GRAPH = ".graph-canvas";
const DONE = "document.querySelector('#maze-canvas').dataset.state === 'done'";
const PATH = "Number(document.querySelector('#maze-canvas').dataset.pathLength)";
const MAZE_BOX = [.24, .03, .76, .82], MAZE_WIDE = [.2, .03, .8, .82], LAB_BOX = [.2, .03, .8, .64];
const MAZE_LEFT = [.04, .07, .5, .82];     // grid beside a card on the right, clear of the watermark
const stat = (label, attr, accent) => ({ label, source: MAZE, attr, accent });
const graphs = params => `/tools/graphs/?${params}`;
const node = v => `.graph-node[data-value="${v}"]`;
const CHAIN = "((?:[A-Z] -> )+[A-Z])";       // "A -> B -> D ..." out of a lab trace line

function build(beats) {
    const DFS_CODE = beats[2].code[0].lines, ISLAND_CODE = beats[6].code[0].lines;
    const [islands] = quotes(beats[4]);
    const run = (label, at) => ({ label, source: "#trace-list li", match: `^${label}`, pick: CHAIN, from: at });

    return {
        part: 3,
        title: "Depth-first search, components and cycles",
        next: "Part 4 · Topological sort",
        pages: {
            dfs: { path: graphs(`${MAZE_PARAMS}&algo=dfs&speed=10`), css: TOAST_CSS,
                measure: [{ name: "dfs", start: "#start", reset: "#reset", until: DONE, check: `${PATH} > 0`, read: `String(${PATH})` }] },
            // Never on camera: BFS on the same maze, for the length shown beside DFS's.
            bfsRef: { path: graphs(`${MAZE_PARAMS}&algo=bfs&speed=10`), css: TOAST_CSS,
                measure: [{ name: "bfsPath", start: "#start", reset: "#reset", until: DONE, check: `${PATH} > 0`, read: `String(${PATH})` }] },
            steps: { path: graphs(`${MAZE_PARAMS}&algo=dfs&speed=10`), css: TOAST_CSS },
            lab: { path: "/tools/data_structures/", css: LAB_CSS, setup: [{ act: "run", fn: labSelect, args: ["graph"] }] },
            islands: { path: graphs("algo=islands&seed=4192&speed=10"), css: TOAST_CSS,
                measure: [{ name: "islands", start: "#start", reset: "#reset", until: DONE }] }
        },
        beats: [
            { // 1. DFS on the part 2 maze finds a path, much longer than BFS's.
                page: "dfs",
                shots: [{ at: 0, target: MAZE, box: MAZE_BOX }],
                actions: [{ at: { s: .8 }, act: "click", target: "#start" }],
                rates: [{ from: { s: .8 }, to: { word: "found a path.", offset: .2 }, measure: "dfs" }],
                chips: [{ from: .02, to: 1, items: [
                    stat("DFS path", "data-path-length", true),
                    { label: "BFS path, part 2", measured: "bfsPath", from: { word: "look at the length.", offset: -.2 } }
                ] }]
            },
            { // 2. DFS stepped: the current path grows, hits a dead end, shrinks back, branches.
                page: "steps",
                shots: [{ at: 0, target: MAZE, box: MAZE_WIDE }],
                actions: [
                    { at: { s: .6 }, until: { word: "highlighted line", offset: -.6 }, count: 30, act: "click", target: "#step", unless: DONE },
                    { at: { word: "Watch it", offset: -.2 }, until: { s: -.8 }, count: 30, act: "click", target: "#step", unless: DONE }
                ]
            },
            { // 3. The recursive DFS.
                page: "steps", veil: .93,
                cards: [{
                    id: "dfs-code", type: "code", place: "center", title: "depth-first search", lines: DFS_CODE, from: { s: .2 }, to: 1,
                    typing: { from: { s: .4 }, to: { word: "Mark the node,", offset: -.2 } },
                    highlights: [
                        { line: 2, at: "Mark the node,", until: "call DFS" },
                        ...[3, 4, 5].map(line => ({ line, at: "call DFS", until: "The call stack" })),
                        { line: 5, at: "The call stack", until: "One warning" }
                    ],
                    labels: [{ text: "deep inputs: sys.setrecursionlimit(10**6), or an explicit stack", at: "raise the limit" }]
                }]
            },
            { // 4. The lab graph: BFS from A, then DFS from A, the two orders one above the other.
                page: "lab",
                shots: [{ at: 0, target: GRAPH, spot: GRAPH, pad: 40, box: LAB_BOX }],
                actions: [
                    { at: { s: .45 }, act: "run", fn: labGraph, args: [START.nodes, START.edges] },
                    { at: { s: .5 }, act: "run", fn: labTraversal, args: ["bfs"] },
                    // Fast, so the BFS animation is over before the DFS run starts.
                    { at: { s: .5 }, act: "set", target: "#animation-speed", value: 260 },
                    { at: { word: "BFS goes", offset: -.6 }, act: "run", fn: labOp, args: ["search", ""] },
                    { at: { word: "DFS goes", offset: -1.1 }, act: "run", fn: labTraversal, args: ["dfs"] },
                    { at: { word: "DFS goes", offset: -.8 }, act: "run", fn: labOp, args: ["search", ""] }
                ],
                // Each order row is up just before the narration reads it (the lab writes its trace line at once).
                chips: [{ place: "bottom", from: { word: "BFS goes", offset: -.5 }, to: { s: -.3 }, items: [
                    run("BFS", { word: "BFS goes", offset: -.5 }), run("DFS", { word: "DFS goes", offset: -.6 })
                ] }]
            },
            { // 5. Number of Islands beside the (still unscanned) map, then the scan moves row by row.
                page: "islands",
                shots: [
                    { at: 0, target: MAZE, box: MAZE_LEFT },
                    { at: { word: "So we scan", offset: -.6 }, target: MAZE, box: MAZE_BOX }
                ],
                actions: [{ at: { word: "So we scan", offset: -.2 }, act: "click", target: "#start" }],
                rates: [{ from: { word: "So we scan", offset: -.2 }, to: { beat: 6, at: { s: -2.5 } }, measure: "islands" }],
                chips: [{ from: { word: "So we scan", offset: -.2 }, to: { beat: 6, at: 1 }, items: [stat("islands", "data-islands", true), stat("cells scanned", "data-visited")] }],
                cards: [{ id: "islands", type: "problems", place: "beside", from: { s: .2 }, to: { word: "So we scan", offset: -.6 },
                    items: [{ tag: "LEETCODE 200", title: "Number of Islands", text: islands, keys: ["How many islands"] }],
                    marks: [{ item: 0, key: 0, at: "Number of Islands." }],
                    labels: [{ item: 0, text: "not connected → loop over every cell", at: "isn't." }] }]
            },
            { // 6. The run continues: each island floods in its own colour, the count goes up.
                page: "islands"
            },
            { // 7. The island counting code.
                page: "islands", veil: .93,
                cards: [{
                    id: "island-code", type: "code", place: "center", title: "number of islands", lines: ISLAND_CODE, from: { s: .2 }, to: 1,
                    typing: { from: { s: .4 }, to: { word: "visited set,", offset: .2 } },
                    highlights: [{ line: 6, at: "overwriting", until: "And if" }, { line: 5, at: "And if" }],
                    labels: [{ text: "Max Area of Island (695): sink returns its cell count; keep the max", at: "Max Area" }]
                }]
            },
            { // 8. Add E-F in the lab, run DFS: the edge back to A closes a cycle.
                page: "lab",
                shots: [{ at: 0, target: GRAPH, spot: GRAPH, pad: 40, box: LAB_BOX, dip: true }],
                actions: [
                    { at: { s: .45 }, act: "run", fn: labGraph, args: [START.nodes, START.edges] },
                    { at: { s: .5 }, act: "run", fn: labTraversal, args: ["dfs"] },
                    { at: { s: .5 }, act: "set", target: "#animation-speed", value: 500 },
                    { at: { word: "add the edge", offset: -.4 }, act: "run", fn: labOp, args: ["special", "E", "F"] },
                    { at: { word: "DFS walks", offset: -.4 }, act: "run", fn: labOp, args: ["search", ""] }
                ],
                marks: [
                    ...["A", "B", "D", "F", "E", "C"].map((v, i) => ({ selector: node(v), from: { word: "walks A, B, D, F, E, C", pick: i + 1 }, to: { s: -.4 } })),
                    // The lab colours the cycle edge as soon as DFS starts; keep it plain until "from C it sees A".
                    { selector: ".graph-edge.is-cycle-edge", tone: "plain", from: 0, to: { word: "sees A,", offset: -.1 } }
                ],
                chips: [{ place: "bottom", from: { word: "sees A,", offset: -.1 }, to: { s: -.3 }, items: [
                    { label: "DFS", source: "#trace-list li", match: "cycle", accent: true }
                ] }]
            },
            { // 9. BFS or DFS: two columns. The cycle stays in view until "For now".
                page: "lab",
                veils: [{ at: { word: "For now,", offset: -.3 }, level: .93 }],
                cards: [{ id: "choose", type: "compare", from: { word: "For now,", offset: -.2 }, to: 1, columns: [
                    // Up with the card, so the dimmed frame is never empty while "choosing is simple" is said.
                    { title: "BFS", items: ["Fewest steps", "Levels and minutes"], at: { word: "For now,", offset: .1 } },
                    { title: "DFS", items: ["Visit everything", "Components", "Cycles", "All paths"], at: { word: "count,", offset: -.2 } }
                ] }]
            },
            { // 10. The checklist.
                page: "lab", veil: .93,
                cards: [{
                    id: "dfs-recap", type: "checklist", place: "center", title: "Depth-first search",
                    items: ["Go deep, then backtrack", "Not the shortest path", "Loop over every start", "Mark by overwriting", "Parent check for cycles", "Iterative for deep inputs"],
                    show: [{ at: "go deep," }, { at: "shortest" }, { at: "Loop over" }, { at: { word: "Loop over", offset: 1.4 } }, { at: "parent check" }, { at: { word: "parent check", offset: 1.6 } }],
                    from: { s: .2 }, to: { s: -.2 }
                }]
            }
        ]
    };
}

module.exports = { script: "03-depth-first-search.md", build };
