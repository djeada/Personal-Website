"use strict";

/*
 * Section 4: Topological sort. One entry per "## Beat N" in
 * scripts/04-topological-sort.md. Network mode of the graphs tool: every
 * algorithm is precomputed into frames, so a step number is always the same
 * picture (see the step lists in README.md, "Sections 4 to 8").
 */

const { netStep, net, NET, NET_DONE, TOAST_CSS } = require("../pages");

const FULL = [.03, .02, .97, .85];   // the network container (graph, data panel, trace line) is height-limited
const page = query => ({ path: net(query), css: TOAST_CSS });
const steps = (from, until, count) => ({ at: from, until, count, act: "run", fn: netStep, args: [1], unless: NET_DONE });

function build(beats) {
    const KAHN = beats[3].code[0].lines;
    return {
        part: 4,
        title: "Topological sort",
        next: "Part 5 · Union-Find",
        pages: {
            build: page("preset=course-schedule&build=1"),    // steps 1-6: one arrow per pair
            kahn: page("preset=course-schedule"),             // 1 indegrees, 2 queue [0], 3-9 order 0 1 2 3 5 4
            cycle: page("preset=course-schedule-cycle"),      // 1-6: order 0 2 5, then "3 of 6 courses: cycle"
            visited: page("preset=diamond&colors=2"),         // 7: C to D, D visited, no cycle
            colors: page("preset=diamond"),                   // 7: D is black, fine
            loop: page("preset=diamond-cycle")                // 4: D to A, A is gray: cycle
        },
        beats: [
            { // 1. The course card returns, then each pair draws its arrow.
                page: "build", veil: .93,
                veils: [{ at: { word: "Every pair", offset: -.4 }, level: 0 }],
                shots: [{ at: 0, target: NET, box: FULL }],
                actions: [steps({ word: "becomes an arrow,", offset: .2 }, { word: "Flip it,", offset: -.2 }, 6)],
                cards: [{ id: "course", type: "problems", from: { s: .2 }, to: { word: "Every pair", offset: -.4 },
                    items: [{ tag: "LEETCODE 207", title: "Course Schedule", text: "You have n courses. Some must be taken before others. Can you finish all of them?", keys: ["before"] }],
                    marks: [{ item: 0, key: 0, at: "must be taken before" }] }]
            },
            { // 2. Indegree badges, then course 0 joins the queue.
                page: "kahn",
                shots: [{ at: 0, target: NET, box: FULL }],
                actions: [
                    { at: { word: "Count the arrows", offset: .3 }, act: "run", fn: netStep, args: [1] },
                    { at: { word: "goes into a queue.", offset: -.4 }, act: "run", fn: netStep, args: [1] }
                ]
            },
            { // 3. Kahn's algorithm: 0, 1, 2, 3, 5, 4.
                page: "kahn",
                actions: [steps({ word: "Take a course", offset: -.2 }, { word: "runs dry,", offset: .2 }, 7)]
            },
            { // 4. The Kahn code.
                page: "kahn", veil: .93,
                cards: [{
                    id: "kahn-code", type: "code", place: "center", title: "kahn's algorithm", lines: KAHN, from: { s: .2 }, to: 1,
                    typing: { from: { s: .4 }, to: { word: "Start the queue", offset: -.3 } },
                    highlights: [
                        ...[3, 4, 5].map(line => ({ line, at: "build the adjacency", until: "Start the queue" })),
                        { line: 7, at: "Start the queue", until: "After that," },
                        ...[13, 14, 15].map(line => ({ line, at: "joins the queue" }))
                    ]
                }]
            },
            { // 5. The same graph plus 4 -> 1: the order stops at 0, 2, 5.
                page: "cycle",
                shots: [{ at: 0, target: NET, box: FULL }],
                actions: [steps({ word: "run it again.", offset: -.2 }, { word: "queue is empty.", offset: .3 }, 6)]
            },
            { // 6. The directed diamond with plain visited marks: D seen again from C, no cycle.
                page: "visited",
                shots: [{ at: 0, target: NET, box: FULL }],
                actions: [
                    steps({ word: "In this diamond,", offset: .2 }, { word: "again from C.", offset: -.1 }, 7),
                    steps({ word: "both arrows point down.", offset: .3 }, { word: "isn't enough.", offset: 0 }, 3)
                ]
            },
            { // 7. Three colors, then D -> A closes a cycle.
                page: "colors",
                shots: [
                    { at: 0, target: NET, box: FULL },
                    { at: { word: "Add an arrow", offset: -.5 }, page: "loop", target: NET, box: FULL }
                ],
                actions: [
                    steps({ word: "White means", offset: 0 }, { word: "Reaching a black node", offset: .2 }, 7),
                    { page: "loop", ...steps({ word: "Add an arrow", offset: .3 }, { word: "what happens.", offset: .1 }, 4) }
                ]
            },
            { // 8. Alien Dictionary: the arrows come from neighboring words.
                page: "loop", veil: .93,
                cards: [{
                    id: "alien", type: "words", tag: "LEETCODE 269", title: "Alien Dictionary",
                    text: "A list of words, sorted in an unknown alphabet. Find the order of the letters.",
                    words: ["wrt", "wrf", "er", "ett", "rftt"], from: { s: .2 }, to: 1,
                    arrows: [{ at: { word: "gives you one arrow:", offset: -.4 } }, { at: { word: "that letter comes first.", offset: .2 } },
                        { at: { word: "Nothing after it", offset: .3 } }, { at: { word: "tells you anything.", offset: .3 } }],
                    footer: { text: "order: w → e → r → t → f · then topological sort", at: { word: "on letters.", offset: -.3 } }
                }]
            },
            { // 9. The checklist.
                page: "loop", veil: .93,
                cards: [{
                    id: "topo-recap", type: "checklist", place: "center", title: "Topological sort",
                    items: ["Direction from the wording", "An indegree array", "Start with every zero", "Fewer than n out means a cycle", "Gray means on the path", "Build edges from comparisons"],
                    show: [{ at: { s: .3 } }, { at: "count the indegrees," }, { at: "start with every zero," }, { at: "fewer than n" }, { at: "gray means" }, { at: { word: "gray means", offset: 1.6 } }],
                    from: { s: .1 }, to: { s: -.2 }
                }]
            }
        ]
    };
}

module.exports = { script: "04-topological-sort.md", build };
