"use strict";

/*
 * Reel 1: Four words that pick your algorithm. Directed, weighted, connected,
 * tree, each over the part 1 shot that shows it, with its consequence in the
 * sub line. Clips replay part 1's beats 3, 6, 8 and 7 (see reel.js); the
 * lab operations are re-timed to land on the captions.
 */

const { labGraph, labOp, labClearMiss, START } = require("../pages");

const node = v => `.graph-node[data-value="${v}"]`;
const MAZE = "#maze-canvas";
const CYCLE = ["A", "B", "D", "F", "E", "C"];
// The lab graph framed on its nodes, so it fills the reel's width instead of sitting in its padded canvas.
const NODES = { target: ".graph-node", union: true, margin: 34, spot: ".graph-canvas", pad: 12 };

module.exports = {
    title: "Four words that pick your algorithm",
    cover: 2.5,
    end: {
        kicker: "GRAPHS FOR LEETCODE · PART 1",
        title: "Reading a<br>graph problem",
        line: "directed · weighted · connected · tree",
        list: "Four questions before any code<br>then the constraints pick the speed",
        url: "adamdjellouli.com/tools/graphs",
        small: "FULL COURSE ON YOUTUBE · FREE TOOLS"
    },
    clips: [
        { // The lab graph builds: nodes, then edges.
            section: "01", beat: 3, length: 10.5, frame: NODES,
            captions: [
                { lines: ["Four words in a graph", "problem pick the <em>algorithm</em>."] },
                { lines: ["<em>Directed</em>: does an edge", "go both ways?"], sub: "one-way prerequisites → topological sort" }
            ]
        },
        { // BFS on the course maze: every step costs one.
            section: "01", beat: 6, length: 11,
            override: {
                actions: [{ at: { s: 1 }, act: "click", target: "#start" }],
                rates: [{ from: { s: 1 }, to: { s: 8 }, measure: "bfs" }],
                chips: [{ from: { s: .3 }, to: 1, items: [
                    { label: "cells visited", source: MAZE, attr: "data-visited" },
                    { label: "path length", source: MAZE, attr: "data-path-length", accent: true }
                ] }]
            },
            captions: [
                { lines: ["<em>Weighted</em>: does every", "step cost the same?"], sub: "prices or times → Dijkstra" },
                { lines: ["Here every step costs one,", "so <em>BFS</em> finds the shortest path."], sub: "same cost → breadth-first search" }
            ]
        },
        { // Remove D: F is cut off from A.
            section: "01", beat: 8, length: 11.5, frame: NODES,
            override: {
                actions: [
                    { at: { s: .45 }, act: "run", fn: labGraph, args: [START.nodes, START.edges] },
                    { at: { s: 5.9 }, act: "run", fn: labOp, args: ["remove", "D"] },
                    { at: { s: 7.4 }, act: "run", fn: labOp, args: ["search", "F"] },
                    { at: { s: 9.2 }, until: { s: -.2 }, count: 6, act: "run", fn: labClearMiss }
                ],
                marks: [{ selector: node("D"), from: { s: 4.6 }, to: { s: 6.6 } },
                    { selector: node("F"), tone: "warn", from: { s: 6.8 }, to: { s: -.3 } }]
            },
            captions: [
                { lines: ["<em>Connected</em>: can one start", "reach every node?"], sub: "not promised → loop over every start" },
                { lines: ["Remove D, and F", "is <b>cut off</b>."], sub: "a search from A never reaches F" }
            ]
        },
        { // Add the edge E–F: the tree gains a cycle.
            section: "01", beat: 7, length: 11.5, frame: NODES,
            override: {
                actions: [
                    { at: { s: .45 }, act: "run", fn: labGraph, args: [START.nodes, START.edges] },
                    { at: { s: 6 }, act: "run", fn: labOp, args: ["special", "E", "F"] }
                ],
                marks: CYCLE.map((v, i) => ({ selector: node(v), from: { s: 7 + .4 * i }, to: { s: -.2 } }))
            },
            captions: [
                { lines: ["<em>Tree</em>: exactly one path", "between any two nodes?"], sub: "n − 1 edges and no cycle" },
                { lines: ["One extra edge", "closes a <b>cycle</b>."], sub: "A → B → D → F → E → C → A" }
            ]
        }
    ]
};
