"use strict";

/*
 * Reel 3: DFS found a path. Not the shortest one. Same maze, DFS (part 3 beat
 * 1), DFS backtracking (beat 2), then BFS (part 2 beat 1), with both path
 * lengths side by side. The lengths come from the runs themselves: part 3
 * measures both during setup ({dfs} and {bfsPath} in the captions).
 */

const MAZE = "#maze-canvas";
const PATH = { source: MAZE, attr: "data-path-length" };

module.exports = {
    title: "DFS found a path. Not the shortest one.",
    cover: 9,
    pages: [["03", "bfsRef"]],   // never filmed: reads the BFS path length for the captions
    end: {
        kicker: "GRAPHS FOR LEETCODE · PART 3",
        title: "Depth-first<br>search",
        line: "go deep, then backtrack",
        list: "Any path, not the shortest<br>components · cycles · visiting everything",
        url: "adamdjellouli.com/tools/graphs",
        small: "FULL COURSE ON YOUTUBE · FREE TOOLS"
    },
    clips: [
        { // DFS runs to the exit.
            section: "03", beat: 1, length: 12.5,
            override: {
                actions: [{ at: { s: .8 }, act: "click", target: "#start" }],
                rates: [{ from: { s: .8 }, to: { s: 6 }, measure: "dfs" }],
                chips: [{ from: { s: .3 }, to: 1, items: [
                    { label: "DFS path", ...PATH, accent: true },
                    { label: "BFS path", measured: "bfsPath", from: { s: 6.8 } }
                ] }]
            },
            captions: [
                { lines: ["Depth-first search", "found a path."] },
                { lines: ["But it isn't the", "<b>shortest</b> one."], sub: "{dfs} steps, where BFS needs {bfsPath}" }
            ]
        },
        { // DFS stepped: deep, a dead end, back up, branch.
            section: "03", beat: 2, length: 12,
            override: { actions: [{ at: { s: .6 }, until: { s: -.6 }, count: 48, act: "click", target: "#step", unless: "document.querySelector('#maze-canvas').dataset.state === 'done'" }] },
            captions: [
                { lines: ["DFS picks a direction", "and keeps going."], sub: "the highlighted line is its current path" },
                { lines: ["It only turns back", "at a <b>dead end</b>."], sub: "backtracking" }
            ]
        },
        { // BFS on the same maze.
            section: "02", beat: 1, length: 12,
            override: {
                actions: [{ at: { s: .8 }, act: "click", target: "#start" }],
                rates: [{ from: { s: .8 }, to: { s: 6.5 }, measure: "bfs" }],
                chips: [{ from: { s: .3 }, to: 1, items: [
                    { label: "BFS path", ...PATH, accent: true },
                    { label: "DFS path", measured: "dfs" }
                ] }]
            },
            captions: [
                { lines: ["Same maze, now", "with <em>BFS</em>."], sub: "it spreads in rings, nearest first" },
                { lines: ["Need the <em>fewest steps</em>?", "Use BFS."], sub: "DFS: visit everything, count pieces" }
            ]
        }
    ]
};
