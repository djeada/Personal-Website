"use strict";

/*
 * Section 5: Union-Find. One entry per "## Beat N" in scripts/05-union-find.md.
 * The Data Structure Lab's Disjoint Set: dsuStep() shows one animation frame,
 * dsuRun(n) applies n queued items at once. Redundant Connection frames: union
 * 1-2 is frames 1-4, 2-3 5-9, 3-4 10-14, 1-4 15-18 (flagged "answer"), 1-5 19-22.
 * Tall tree: find(5) is frames 1-9 (compression 6-9), union(7, 5) 10-15.
 */

const { dsuStep, dsuRun, DSU_CSS } = require("../pages");

const STAGE = ".dsu-view", BOX = [.12, .02, .88, .85];
const lab = preset => ({ path: `/tools/data_structures/?structure=dsu&preset=${preset}`, css: DSU_CSS });
const frames = (from, until, count) => ({ at: from, until, count, act: "run", fn: dsuStep, args: [1] });

function build(beats) {
    const CODE = beats[4].code[0].lines;
    const ITEMS = ["Groups that only merge", "find with path compression", "union by size", "A counter that starts at n", "A failed union closes a cycle", "Strings become ids"];
    return {
        part: 5,
        title: "Union-Find",
        next: "Part 6 · Weighted shortest paths",
        pages: {
            dsu: lab("redundant"),
            tall: lab("tall"),
            again: lab("redundant")
        },
        beats: [
            { // 1. Redundant Connection, then the lab: five separate nodes, the edges on the side.
                page: "dsu", veil: .93,
                veils: [{ at: { word: "The edges arrive", offset: -.4 }, level: 0 }],
                shots: [{ at: 0, target: STAGE, box: BOX }],
                cards: [{ id: "redundant", type: "problems", from: { s: .2 }, to: { word: "The edges arrive", offset: -.4 },
                    items: [{ tag: "LEETCODE 684", title: "Redundant Connection", text: "A tree with n nodes, plus one extra edge. Return the edge you can remove so it's a tree again.", keys: ["one extra edge"] }],
                    marks: [{ item: 0, key: 0, at: "one extra edge," }] }]
            },
            { // 2. Everyone is their own root: parent array 1..5, five components.
                page: "dsu"
            },
            { // 3. union(1, 2), union(2, 3), union(3, 4): the counter goes 5, 4, 3, 2.
                page: "dsu",
                actions: [frames({ word: "Find walks up", offset: 0 }, { word: "goes down by one", offset: .4 }, 14)]
            },
            { // 4. The tall tree: find(5) compresses the path, then union(7, 5) by size.
                page: "tall",
                shots: [{ at: 0, target: STAGE, box: BOX, hold: true }],
                actions: [
                    frames({ word: "when find walks up,", offset: 0 }, { word: "straight at the root,", offset: .6 }, 9),
                    frames({ word: "union by size:", offset: 0 }, { word: "stay shallow.", offset: 0 }, 6)
                ]
            },
            { // 5. The code; union returning False is the line that matters.
                page: "tall", veil: .93,
                cards: [{
                    id: "uf-code", type: "code", place: "center", title: "union-find", lines: CODE, from: { s: .2 }, to: 1,
                    typing: { from: { s: .4 }, to: { word: "Treat it as constant.", offset: 0 } },
                    highlights: [{ line: 11, at: "returns False" }, { line: 12, at: "returns False" }]
                }]
            },
            { // 6. The edges in order: three merges, then 1-4 finds one root and is the answer.
                page: "again",
                shots: [{ at: 0, target: STAGE, box: BOX }],
                actions: [
                    { at: { word: "One-two,", offset: 0 }, act: "run", fn: dsuRun, args: [1] },
                    { at: { word: "two-three,", offset: 0 }, act: "run", fn: dsuRun, args: [1] },
                    { at: { word: "three-four:", offset: 0 }, act: "run", fn: dsuRun, args: [1] },
                    frames({ word: "Then one-four.", offset: .2 }, { word: "same root.", offset: .2 }, 4)
                ]
            },
            { // 7. Network Connected: the counter answers it.
                page: "again", veil: .93,
                cards: [{ id: "cables", type: "problems", from: { s: .2 }, to: 1,
                    items: [{ tag: "LEETCODE 1319", title: "Number of Operations to Make Network Connected", keys: ["fewest number of moves"],
                        text: "n computers and some cables. You may move cables. What is the fewest number of moves to connect every computer, or -1?" }],
                    marks: [{ item: 0, key: 0, at: "move cables." }],
                    labels: [{ item: 0, text: "fewer than n - 1 cables → -1", at: "it's impossible." }, { item: 0, text: "otherwise → components - 1", at: "components minus one." }] }]
            },
            { // 8. Accounts Merge: strings become integer ids.
                page: "again", veil: .93,
                cards: [
                    { id: "accounts", type: "problems", place: "high", from: { s: .2 }, to: 1,
                        items: [{ tag: "LEETCODE 721", title: "Accounts Merge", keys: ["share an email"],
                            text: "Accounts with a name and emails. Two accounts belong to the same person if they share an email. Merge them." }],
                        marks: [{ item: 0, key: 0, at: "share an email." }] },
                    { id: "ids", type: "sheet", place: "low", title: "email → id, the first time it is seen", from: { word: "Give every email", offset: -.4 }, to: 1,
                        rows: ["johnsmith@mail.com → 0", "john_newyork@mail.com → 1", "john00@mail.com → 2", "mary@mail.com → 3"]
                            .map((text, i) => ({ text, at: { word: "Give every email", offset: .2 + .55 * i } })) }
                ]
            },
            { // 9. When not to use it, then the classic bug.
                page: "again", veil: .93,
                cards: [
                    { id: "when", type: "compare", place: "high", from: { s: .2 }, to: 1, columns: [
                        { title: "Union-Find", items: ["Are they connected?", "How many groups?", "Edges only added"], at: { s: .4 } },
                        { title: "BFS or DFS", items: ["The path itself", "Distances", "Edges removed"], at: "go back to BFS" }
                    ] },
                    { id: "bug", type: "fix", place: "low", title: "the classic bug", from: { word: "the classic bug:", offset: -.3 }, to: 1,
                        wrong: { text: "parent[a] == parent[b]", at: "Two nodes can have" }, right: { text: "find(a) == find(b)", at: "always compare find" } }
                ]
            },
            { // 10. The checklist.
                page: "again", veil: .93,
                cards: [{
                    id: "uf-recap", type: "checklist", place: "center", title: "Union-Find", items: ITEMS,
                    show: [{ at: { s: .3 } }, { at: "Compress paths," }, { at: "union by size," }, { at: "keep a counter," }, { at: "a failed union" }, { at: { word: "a failed union", offset: 1.4 } }],
                    from: { s: .1 }, to: { s: -.2 }
                }]
            }
        ]
    };
}

module.exports = { script: "05-union-find.md", build };
