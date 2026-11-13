"use strict";

/*
 * Reel 2: Why BFS finds the shortest path. The frontier grows in rings (part 2
 * beat 2, distances on), a queue keeps the rings in order (beat 4), so the first
 * time a cell is reached is the fewest steps (beat 1's full run to the path).
 */

const MAZE = "#maze-canvas";
const DONE = "document.querySelector('#maze-canvas').dataset.state === 'done'";
const stat = (label, attr, accent) => ({ label, source: MAZE, attr, accent });

module.exports = {
    title: "Why BFS finds the shortest path",
    cover: 9,
    end: {
        kicker: "GRAPHS FOR LEETCODE · PART 2",
        title: "Breadth-first<br>search",
        line: "queue · mark on push · levels are distances",
        list: "Fewest steps when every step costs the same<br>several starts go in together",
        url: "adamdjellouli.com/tools/graphs",
        small: "FULL COURSE ON YOUTUBE · FREE TOOLS"
    },
    clips: [
        { // The maze before the search.
            section: "02", beat: 1, length: 6, chips: false,
            override: { actions: [], rates: [] },
            captions: [{ lines: ["Why does BFS find", "the <em>shortest</em> path?"], sub: "same maze, start top left" }]
        },
        { // Distances on, one ring per step.
            section: "02", beat: 2, length: 13,
            override: {
                actions: [
                    ...[1, 2.2, 3.4, 4.6].map(s => ({ at: { s }, act: "click", target: "#step-level" })),
                    { at: { s: 5.8 }, until: { s: -1 }, count: 8, act: "click", target: "#step-level", unless: DONE }
                ]
            },
            captions: [
                { lines: ["It explores in <em>rings</em>:", "one step away, then two…"] },
                { lines: ["Each number is how far", "that cell is from the start."], sub: "the numbers never skip" }
            ]
        },
        { // Single dequeues: outlined cells are waiting in the queue.
            section: "02", beat: 4, length: 11,
            override: { actions: [{ at: { s: .8 }, until: { s: -1 }, count: 18, act: "click", target: "#step", unless: DONE }] },
            captions: [
                { lines: ["A <em>queue</em> keeps", "the rings in order."], sub: "first in, first out" },
                { lines: ["Nearer cells always", "come out first."], sub: "outlined cells are in the queue" }
            ]
        },
        { // The full run until the path appears.
            section: "02", beat: 1, length: 12,
            override: {
                actions: [{ at: { s: .8 }, act: "click", target: "#start" }],
                rates: [{ from: { s: .8 }, to: { s: 6.5 }, measure: "bfs" }],
                chips: [{ from: { s: .3 }, to: 1, items: [stat("cells visited", "data-visited"), stat("path length", "data-path-length", true)] }]
            },
            captions: [
                { lines: ["So the first time BFS", "reaches a cell…"] },
                { lines: ["…it got there in the", "<em>fewest steps</em>."], sub: "when every step costs the same" }
            ]
        }
    ]
};
