"use strict";

/*
 * Reel 4: Course Schedule in 40 seconds. Indegrees count down, zeros enter the
 * queue (part 4 beats 2 and 3), and a cycle leaves nodes behind (beat 5).
 */

const { netStep, NET_DONE } = require("../pages");

const steps = (from, until, count) => ({ at: from, until, count, act: "run", fn: netStep, args: [1], unless: NET_DONE });

// Network mode framed on its graph and data panel (on a phone layout the header and margins waste room).
const NETFRAME = { target: "#network-canvas, #network-panel", union: true, margin: 8, spot: "#network-stage", pad: 4 };

module.exports = {
    title: "Course Schedule in 40 seconds",
    cover: 14,
    end: {
        kicker: "GRAPHS FOR LEETCODE · PART 4",
        title: "Topological<br>sort",
        line: "indegrees · a queue of zeros · fewer than n means a cycle",
        list: "Course Schedule · Course Schedule II<br>Alien Dictionary · Eventual Safe States",
        url: "adamdjellouli.com/tools/graphs",
        small: "FULL COURSE ON YOUTUBE · FREE TOOLS"
    },
    clips: [
        { // Indegree badges, then course 0 joins the queue.
            section: "04", beat: 2, length: 10, frame: NETFRAME,
            override: { actions: [{ at: { s: 4.4 }, act: "run", fn: netStep, args: [1] }, { at: { s: 7.4 }, act: "run", fn: netStep, args: [1] }] },
            captions: [
                { lines: ["Can you finish every", "course in this list?"], sub: "arrow b → a: take b first" },
                { lines: ["Count the arrows", "<em>into</em> each course."], sub: "indegree 0 → ready now, into the queue" }
            ]
        },
        { // Kahn: 0, 1, 2, 3, 5, 4.
            section: "04", beat: 3, length: 13, frame: NETFRAME,
            override: { actions: [steps({ s: .8 }, { s: -1.6 }, 7)] },
            captions: [
                { lines: ["Take one, remove its arrows,", "and the counts <em>drop</em>."] },
                { lines: ["Every new zero", "joins the queue."], sub: "the order: 0, 1, 2, 3, 5, 4" }
            ]
        },
        { // The same courses plus 4 -> 1: three are left behind.
            section: "04", beat: 5, length: 12, frame: NETFRAME,
            override: { actions: [steps({ s: 1.2 }, { s: 6.6 }, 6)] },
            captions: [
                { lines: ["Add one arrow, 4 → 1,", "and run it again."], sub: "1 → 3 → 4 → 1 is a loop" },
                { lines: ["Only 3 of 6 come out.", "The rest wait <b>forever</b>."], sub: "fewer than n in the order → a cycle" }
            ]
        }
    ]
};
