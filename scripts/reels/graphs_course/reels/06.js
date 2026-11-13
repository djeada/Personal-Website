"use strict";

/*
 * Reel 6: BFS ignores the mud. The part 6 mud grid (seed 82): BFS walks through
 * the mud, Dijkstra goes around. Steps and costs are measured during setup.
 */

const MAZE = "#maze-canvas";
const stat = (label, attr, accent) => ({ label, source: MAZE, attr, accent });

module.exports = {
    title: "BFS ignores the mud",
    cover: 20,
    end: {
        kicker: "GRAPHS FOR LEETCODE · PART 6",
        title: "Weighted<br>shortest paths",
        line: "equal costs → BFS · non-negative → Dijkstra",
        list: "0 or 1 → a deque · at most k stops → Bellman–Ford<br>all pairs, small n → Floyd–Warshall",
        url: "adamdjellouli.com/tools/graphs",
        small: "FULL COURSE ON YOUTUBE · FREE TOOLS"
    },
    clips: [
        { // BFS through the mud.
            section: "06", beat: 1, length: 12,
            override: {
                shots: [{ at: 0, target: MAZE }],
                actions: [{ at: { s: 1 }, act: "click", target: "#start" }],
                rates: [{ from: { s: 1 }, to: { s: 8.5 }, measure: "bfsMud" }],
                chips: [{ from: { s: .3 }, to: 1, items: [stat("BFS steps", "data-path-length"), stat("BFS cost", "data-path-cost", true)] }]
            },
            captions: [
                { lines: ["Brown cells are <b>mud</b>:", "each step in costs 5."], sub: "same maze, same start and end" },
                { lines: ["BFS walks straight", "through it."], sub: "fewest steps, not lowest cost" }
            ]
        },
        { // Dijkstra goes around.
            section: "06", beat: 1, length: 12,
            override: {
                page: "dijkstra",
                shots: [{ at: 0, target: MAZE }],
                actions: [{ at: { s: 1 }, act: "click", target: "#start" }],
                rates: [{ from: { s: 1 }, to: { s: 8.5 }, measure: "dijkstraMud" }],
                chips: [{ from: { s: .3 }, to: 1, items: [{ label: "BFS cost", measured: "bfsMudCost" }, stat("Dijkstra cost", "data-path-cost", true)] }]
            },
            captions: [
                { lines: ["<em>Dijkstra</em> counts cost,", "so it goes around."] },
                { lines: ["Longer path, cheaper trip:", "cost {dijkstraMudCost}, not {bfsMudCost}."], sub: "{dijkstraMud} steps instead of {bfsMud}" }
            ]
        },
        { // The verdict, on the finished grid.
            section: "06", beat: 1, length: 7,
            override: {
                page: "dijkstra", shots: [{ at: 0, target: MAZE }], actions: [], rates: [],
                chips: [{ from: { s: .2 }, to: 1, items: [{ label: "BFS cost", measured: "bfsMudCost" }, stat("Dijkstra cost", "data-path-cost", true)] }]
            },
            captions: [{ lines: ["Costs differ? The first", "visit isn't the best one."], sub: "non-negative costs → Dijkstra" }]
        }
    ]
};
