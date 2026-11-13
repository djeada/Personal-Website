"use strict";

/*
 * Page-side helpers for the filmed tools. Each function is serialized and run
 * inside the page (actions with act: "run"), so it must be self-contained.
 *
 * The Data Structure Lab is a classic script: `state`, `render`, `setHighlight`
 * and `cancelAnimation` are its top-level bindings, reachable from here. If the
 * lab renames them, these helpers fail loudly and the README says where to look.
 */

// The maze every part films (seed, size, wall density), so parts 1 to 3 search the same grid.
const MAZE_PARAMS = "size=15&density=25&seed=7";
const TOAST_CSS = ".toast-container { display: none !important; }";
// The lab's "step 2 of 6" status and "Inspecting B" bubble sit above the graph, where every
// graph shot crops them in half; hidden without changing the layout.
const LAB_CSS = "#visual-stage .stage-status, #comparison-bubble { visibility: hidden !important; }";

// The lab's Graph structure as it loads: A–F and a tree of five edges.
const START = {
    nodes: ["A", "B", "C", "D", "E", "F"],
    edges: [["A", "B"], ["A", "C"], ["B", "D"], ["C", "E"], ["D", "F"]]
};

function labSelect(key) {
    const select = document.getElementById("structure-select");
    select.value = key;
    select.dispatchEvent(new Event("change", { bubbles: true }));
}

function labGraph(nodes, edges) {
    if (typeof state === "undefined" || typeof render !== "function") throw new Error("lab globals state/render not found (see graphs_course/pages.js)");
    if (typeof cancelAnimation === "function") cancelAnimation();
    state = { nodes: nodes.slice(), edges: edges.map(edge => edge.slice()) };
    if (typeof setHighlight === "function") setHighlight({});
    render();
}

// One lab operation through its own controls: add | search | remove | special (add edge).
function labOp(operation, primary, secondary) {
    const fire = (node, type) => node.dispatchEvent(new Event(type, { bubbles: true }));
    // A previous operation still animating keeps the Run button disabled; end it first.
    if (typeof cancelAnimation === "function") cancelAnimation();
    document.querySelector(`[data-operation="${operation}"]`).click();
    const value = document.getElementById("value-input");
    value.value = primary;
    fire(value, "input");
    if (secondary !== undefined) {
        const other = document.getElementById("secondary-input");
        other.value = secondary;
        fire(other, "input");
    }
    document.getElementById("execute-operation").click();
}

// The lab rings the last vertex a failed search inspected; clear that ring, keep the visit badges.
function labClearMiss() {
    document.querySelectorAll(".animation-miss").forEach(node => node.classList.remove("animation-miss"));
}

// The lab's traversal for graph search: "bfs" (queue) or "dfs" (stack).
function labTraversal(kind) {
    const select = document.getElementById("graph-traversal");
    select.value = kind;
    select.dispatchEvent(new Event("change", { bubbles: true }));
}

// Graphs tool, network mode: frames are precomputed, so step n is always the same picture.
function netStep(count = 1) {
    const net = window.GraphsDebug && window.GraphsDebug.network;
    if (!net) throw new Error("window.GraphsDebug.network not found (see graphs_course/pages.js)");
    net.step(count);
}

function netGoto(index) {
    const net = window.GraphsDebug && window.GraphsDebug.network;
    if (!net) throw new Error("window.GraphsDebug.network not found (see graphs_course/pages.js)");
    net.goto(index);
}

// Data Structure Lab, Disjoint Set: one animation frame, or whole queued items at once.
function dsuStep(count = 1) {
    if (!window.DisjointSetLab) throw new Error("window.DisjointSetLab not found (see graphs_course/pages.js)");
    for (let k = 0; k < count; k++) window.DisjointSetLab.step();
}

function dsuRun(items = 1) {
    if (!window.DisjointSetLab) throw new Error("window.DisjointSetLab not found (see graphs_course/pages.js)");
    window.DisjointSetLab.runItems(items);
}

// The Disjoint Set is driven through window.DisjointSetLab, so its preset and step buttons stay off camera.
// The lab caps its stage at 78vh and scrolls; in the recorder's 720 px viewport that hides the tall
// preset's deepest node (5), the one find starts from, so the stage is left at its full height.
const DSU_CSS = ".dsu-controls, .dsu-preset-field { display: none !important; } #visual-stage { max-height: none !important; overflow: visible !important; }";

const net = query => `/tools/graphs/?mode=network&${query}`;
const NET = "#network-container", NET_DONE = "document.querySelector('#network-canvas').dataset.state === 'done'";

module.exports = { START, MAZE_PARAMS, TOAST_CSS, LAB_CSS, netStep, netGoto, dsuStep, dsuRun, net, NET, NET_DONE, DSU_CSS, labSelect, labGraph, labOp, labClearMiss, labTraversal };
