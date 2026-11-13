"use strict";

/*
 * Reel 5: The edge that closes a cycle. Union-Find merges groups (part 5 beats
 * 2 and 3) until one union finds both ends already joined (beat 6: 1-4).
 */

const { dsuStep, dsuRun } = require("../pages");

const frames = (from, until, count) => ({ at: from, until, count, act: "run", fn: dsuStep, args: [1] });

// The Disjoint Set view itself (reel.css hides its controls).
const DSUFRAME = { target: ".dsu-view", margin: 6, spot: false };

module.exports = {
    title: "The edge that closes a cycle",
    cover: 30,
    end: {
        kicker: "GRAPHS FOR LEETCODE · PART 5",
        title: "Union-Find",
        line: "find · union · the first failed union",
        list: "Redundant Connection · Number of Provinces<br>Accounts Merge · Network Connected",
        url: "adamdjellouli.com/tools/data_structures",
        small: "FULL COURSE ON YOUTUBE · FREE TOOLS"
    },
    clips: [
        { // Five roots.
            section: "05", beat: 2, length: 8, frame: DSUFRAME,
            captions: [{ lines: ["Five nodes, each", "its own <em>root</em>."], sub: "parent[i] = i · 5 groups" }]
        },
        { // Three unions: 5, 4, 3, 2 groups.
            section: "05", beat: 3, length: 14, frame: DSUFRAME,
            override: { actions: [frames({ s: .8 }, { s: -1 }, 14)] },
            captions: [
                { lines: ["An edge joins two groups:", "one root goes under the other."], sub: "find walks up to the root" },
                { lines: ["Each merge leaves", "one group fewer."], sub: "groups: 5, 4, 3, 2" }
            ]
        },
        { // 1-4: both finds reach the same root.
            section: "05", beat: 6, length: 13, frame: DSUFRAME,
            override: { actions: [{ at: { s: .3 }, act: "run", fn: dsuRun, args: [3] }, frames({ s: 2.4 }, { s: 6.4 }, 4)] },
            captions: [
                { lines: ["Now the edge 1–4."], sub: "find(1) and find(4)" },
                { lines: ["Same root: already joined.", "This edge closes the <b>cycle</b>."], sub: "the first failed union is the answer" }
            ]
        }
    ]
};
