"use strict";

/*
 * Card preview: renders stills of overlay cards at 1920×1080 without a section,
 * a script or a voice, so a card can be checked before its section exists.
 *
 *   node scripts/reels/graphs_course/preview.js              every card below
 *   node scripts/reels/graphs_course/preview.js words fix    the named ones
 *
 * Stills go to scripts/reels/frames/graphs-course/preview/<name>-<t>.png. The
 * cards are the ones the scripts for parts 4 to 8 ask for, with their text, so
 * this file is also a worked example of every card type's fields.
 */

const fs = require("fs");
const path = require("path");
const { placeBeat, resolver, finish, FPS } = require("./timeline");
const { record } = require("./record");
const { serve, WORK } = require("./build");

const s = x => ({ s: x });   // card times below are seconds from the card's start

const CARDS = {
    // Part 4, beat 8: Alien Dictionary.
    words: { stills: [4.2, 9.5], card: {
        type: "words", tag: "LEETCODE 269", title: "Alien Dictionary",
        text: "A list of words, sorted in an unknown alphabet. Find the order of the letters.",
        words: ["wrt", "wrf", "er", "ett", "rftt"],
        arrows: [2, 3.5, 5, 6.5].map(at => ({ at: s(at) })),
        footer: { text: "order: w → e → r → t → f", at: s(8) }
    } },
    // Part 7, beat 6: two input shapes side by side.
    shapes: { stills: [8], card: {
        type: "compare", columns: [
            { tag: "LEETCODE 785", title: "Is Graph Bipartite", sample: "graph = [[1,3],[0,2],[1,3],[0,2]]", items: ["graph[i] lists the neighbors of i", "color right away"], at: s(.5) },
            { tag: "LEETCODE 886", title: "Possible Bipartition", sample: ["n = 4", "dislikes = [[1,2],[1,3],[2,4]]"], items: ["dislikes as pairs, people labeled 1 to n"], at: s(1.5),
                notes: [{ text: "n + 1 slots", at: s(3) }, { text: "add both directions", at: s(4) }] }
        ]
    } },
    // Part 5, beat 9: when to use Union-Find, then the classic bug.
    bug: { stills: [7.5], cards: [
        { type: "compare", place: "high", columns: [
            { title: "Union-Find", items: ["Are they connected?", "How many groups?", "Edges only added"], at: s(.5) },
            { title: "BFS or DFS", items: ["The path itself", "Distances", "Edges removed"], at: s(1) }
        ] },
        { type: "fix", place: "low", title: "the classic bug", from: s(2),
            wrong: { text: "parent[a] == parent[b]", at: s(3) }, right: { text: "find(a) == find(b)", at: s(4) },
            note: { text: "Different parents can share a root: always compare roots.", at: s(5) } }
    ] },
    // Part 6, beat 5: 0-1 BFS.
    deque: { stills: [3.65, 8], card: {
        type: "deque", heading: "Every move costs 0 or 1", items: ["S"],
        ops: [
            { at: s(1.5), op: "pop" },
            { at: s(2.5), op: "back", value: "A", cost: 1 },
            { at: s(3.5), op: "front", value: "B", cost: 0 },
            { at: s(4.5), op: "back", value: "C", cost: 1 },
            { at: s(5.5), op: "front", value: "D", cost: 0 }
        ]
    } },
    // Part 8, beat 6: why the dense case needs the array Prim.
    dense: { stills: [2.2, 6], card: {
        type: "big", lines: [{ text: "1,000 points", at: s(.5) }, { text: "about {n} edges", count: 500000, at: s(1.5) }],
        note: { text: "every pair is an edge: n (n - 1) / 2 = 499,500", at: s(3.5) }
    } },
    // Part 8, beat 7: the cheat sheet building beside a clip (a tool shot on the left).
    sheetSide: { stills: [7], veil: 0, card: {
        type: "sheet", place: "side", title: "cheat sheet", limit: 5,
        rows: ["two-way, friends → add both directions", "fewest steps or minutes → BFS, all sources together",
            "count islands, groups → loop over starts", "prerequisites, order → Kahn, fewer than n means a cycle"]
            .map((text, i) => ({ text, at: s(.5 + 1.5 * i) }))
    } },
    // Part 8, beat 9: the full table with the four questions from part 1 above it.
    sheet: { stills: [5], card: {
        type: "sheet", title: "then read the statement for", focus: false,
        questions: { items: ["directed?", "weighted?", "connected?", "a tree?"], at: s(.5) },
        rows: ["two-way, friends → add both directions", "fewest steps or minutes → BFS, all sources together",
            "count islands, groups → loop over starts", "prerequisites, order → Kahn, fewer than n means a cycle",
            "group, merge, redundant edge → Union-Find", "cheapest, non-negative → Dijkstra",
            "at most k stops → Bellman–Ford with a copy", "all pairs, small n → Floyd–Warshall",
            "two groups → 2-coloring", "connect all cheaply → MST"].map(text => ({ text, at: s(1) }))
    } },
    // Part 7, beat 8: coloring is hard in general, so problems come with a shortcut.
    np: { stills: [5], card: {
        type: "sheet", kicker: "graph coloring", heading: "Is 3 colors enough? NP-complete.", title: "so the problem gives you a shortcut",
        rows: ["exactly two colors → BFS 2-coloring", "a degree limit → greedy, max degree + 1 colors", "small n → backtracking"]
            .map((text, i) => ({ text, at: s(1 + i) }))
    } },
    // Part 5, beat 8: Accounts Merge, an integer id for each email as it is first seen.
    ids: { stills: [6], cards: [
        { type: "problems", place: "high", items: [{ tag: "LEETCODE 721", title: "Accounts Merge", keys: ["share an email"],
            text: "Accounts with a name and emails. Two accounts belong to the same person if they share an email. Merge them." }],
            marks: [{ item: 0, key: 0, at: s(1) }] },
        { type: "sheet", place: "low", title: "email → id, the first time it is seen",
            rows: ["johnsmith@mail.com → 0", "john_newyork@mail.com → 1", "john00@mail.com → 2", "mary@mail.com → 3"].map((text, i) => ({ text, at: s(2 + .6 * i) })) }
    ] },
    // Part 5, beat 7: one problem card with two labels.
    cables: { stills: [5], card: {
        type: "problems", items: [{ tag: "LEETCODE 1319", title: "Number of Operations to Make Network Connected", keys: ["fewest number of moves"],
            text: "n computers and some cables. You may move cables. What is the fewest number of moves to connect every computer, or -1?" }],
        marks: [{ item: 0, key: 0, at: s(1) }],
        labels: [{ item: 0, text: "fewer than n - 1 cables → -1", at: s(2) }, { item: 0, text: "otherwise → components - 1", at: s(3) }]
    } },
    // Part 8: the closing card (a section's `closing`).
    closing: { stills: [3.5], card: { type: "next", kicker: "GRAPHS FOR LEETCODE", text: "The notes, with code for every algorithm", url: "adamdjellouli.com", small: "Notes and code linked below" } }
};

async function main() {
    const names = process.argv.slice(2).filter(a => !a.startsWith("--"));
    const chosen = names.length ? names : Object.keys(CARDS);
    for (const name of chosen) if (!CARDS[name]) throw new Error(`no preview card "${name}"; try ${Object.keys(CARDS).join(", ")}`);
    const SLOT = 12;
    const DURATION = chosen.length * SLOT + 1;
    const timeline = {
        id: "preview", FPS, W: 1280, H: 720, SCALE: 1.5, DURATION, INTRO: 0, OUTRO: 0, mark: "GRAPHS FOR LEETCODE · CARD PREVIEW",
        pages: { bg: { path: "/tools/searching/" } }, captionsOn: false, captions: [], beats: [],
        shots: [], actions: [], cards: [], veils: [], marks: [], hides: [], chips: [], rates: [], cues: []
    };
    const stills = [];
    chosen.forEach((name, i) => {
        const demo = CARDS[name], start = i * SLOT;
        const span = { n: i + 1, start, end: start + SLOT - .5, words: [] };
        const at = ref => resolver([span])(ref, 0);
        const cards = (demo.cards || [demo.card]).map((c, k) => ({ id: `${name}-${k}`, from: s(.2), to: s(SLOT - .8), ...c }));
        placeBeat(timeline, { page: "bg", veil: demo.veil ?? .93, shots: [{ at: 0, target: "main", spot: false }], cards }, at, { first: i === 0, veilAt: start });
        demo.stills.forEach(t => stills.push({ t: Math.round((start + t) * FPS) / FPS, name }));
    });
    finish(timeline);
    const dir = path.join(WORK, "preview");
    fs.rmSync(dir, { recursive: true, force: true });
    const { server, origin } = await serve(8150);
    try {
        await record(timeline, dir, { origin, only: stills.map(x => x.t), log: m => console.log(`[preview] ${m}`) });
    } finally {
        server.close();
    }
    for (const x of stills) {
        const file = path.join(dir, `still-${x.t.toFixed(2)}.png`);
        if (fs.existsSync(file)) fs.renameSync(file, path.join(dir, `${x.name}-${(x.t % SLOT).toFixed(1)}.png`));
    }
    console.log(`[preview] stills in ${dir}`);
}

main().catch(error => { console.error(error.message || error); process.exit(1); });
