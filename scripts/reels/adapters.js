"use strict";

/*
 * Tool adapters.
 *
 * The site has four visualizers worth filming and they split into two drive models:
 *
 *   data_structures  a DOM visualization animated on its own timers. There is no way
 *                    to ask it for "one more step", so the recorder mocks the clock,
 *                    pauses it, and ticks forward until the rendered state changes.
 *
 *   sorting          canvas visualizations built on a credit-based step engine: the
 *   searching        algorithm blocks in a checkpoint until #step hands it a credit.
 *   graphs           The recorder drives that button directly and lets real time run,
 *                    which is simpler and more exact than simulating the timers.
 *
 * Everything below that runs inside the page is a plain function passed to
 * page.evaluate, so it must stay self-contained.
 */

// Canvas tools size their square canvas from the wrapper width and cap it at 760 CSS
// px. Widening the wrapper during capture buys the full 760 bitmap, which the fitter
// then scales down into the frame - downsampling, so the result stays crisp.
const CANVAS_WRAPPER_WIDTH = 812;

const STEPPED_CSS = `
.canvas-wrapper {
    width: ${CANVAS_WRAPPER_WIDTH}px !important;
    max-width: none !important;
    padding: 14px !important;
    border: 2px solid var(--ds-line, #344454) !important;
    border-radius: 24px !important;
    background: var(--ds-canvas, #0d1720) !important;
}
.canvas-wrapper canvas {
    display: block;
    margin: 0 auto;
}
`;

/* ---------------------------------------------------------------- page-side ---- */

function driveStructures(command) {
    const fire = (element, type) => element.dispatchEvent(new Event(type, { bubbles: true }));

    if (command.structure) {
        const select = document.getElementById("structure-select");
        select.value = command.structure;
        fire(select, "change");
    }
    if (command.dataset) {
        // The lab is a classic script, so its top-level bindings are reachable here.
        if (typeof state === "undefined" || typeof render !== "function") return "no-state";
        state = JSON.parse(JSON.stringify(command.dataset));
        if (typeof setHighlight === "function") setHighlight({});
        render();
    }
    if (command.speed) document.getElementById("animation-speed").value = command.speed;
    if (command.operation) document.querySelector(`[data-operation="${command.operation}"]`).click();
    if (command.primary !== undefined) {
        const input = document.getElementById("value-input");
        input.value = command.primary;
        fire(input, "input");
    }
    if (command.secondary !== undefined) {
        const input = document.getElementById("secondary-input");
        input.value = command.secondary;
        fire(input, "input");
    }
    if (command.execute) document.getElementById("execute-operation").click();
    return "ok";
}

function structuresSignature() {
    const status = document.getElementById("animation-status").textContent;
    const bubble = document.getElementById("comparison-bubble");
    const bubbleText = bubble.hidden ? "" : bubble.textContent;
    const nodes = Array.from(document.querySelectorAll("#structure-visual .selectable"))
        .map((node) => `${node.dataset.index}:${node.dataset.value}:${node.className}`)
        .join("|");
    return `${status}\u0000${bubbleText}\u0000${nodes}`;
}

function readStructures() {
    const bubble = document.getElementById("comparison-bubble");
    return {
        bubble: bubble.hidden ? "" : bubble.textContent.trim(),
        status: document.getElementById("animation-status").textContent.trim(),
        steps: document.getElementById("result-steps").textContent.trim(),
        growth: document.getElementById("last-growth").textContent.trim(),
        title: document.getElementById("result-title").textContent.trim(),
        failure: document.getElementById("result-banner").classList.contains("is-failure")
    };
}

// Shared setup for the three canvas tools: pick the algorithm, seed the dataset, and
// push the speed to maximum so each checkpoint settles almost immediately (the
// recorder controls pacing itself, via how long each captured frame is held).
function setupStepped(config) {
    const set = (id, value) => {
        const element = document.getElementById(id);
        if (!element || value === undefined || value === null) return;
        element.value = String(value);
        element.dispatchEvent(new Event("input", { bubbles: true }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
    };
    const click = (id) => {
        const element = document.getElementById(id);
        if (element) element.click();
    };

    set("algorithm", config.algorithm);
    set("speed", 10);
    if (config.size !== undefined) set(config.sizeField || "array-size", config.size);
    if (config.density !== undefined) set("wall-density", config.density);
    if (config.values) {
        set("array-values", config.values.join(", "));
        click("apply-values");
    }
    if (config.target !== undefined) set("search-target", config.target);
    click("reset");
    return "ok";
}

function readSorting() {
    return {
        caption: document.getElementById("operation-label").textContent.trim(),
        steps: document.getElementById("comparisons-count").textContent.trim(),
        extra: document.getElementById("swaps-count").textContent.trim(),
        done: /sorted/i.test(document.getElementById("operation-label").textContent)
    };
}

function readSearching() {
    const label = document.getElementById("operation-label").textContent.trim();
    return {
        caption: label,
        steps: document.getElementById("comparisons-count").textContent.trim(),
        extra: "",
        done: /at index|not found/i.test(label)
    };
}

function readGraphs() {
    const visited = document.getElementById("cells-visited").textContent.trim();
    const pathLength = document.getElementById("path-length").textContent.trim();
    return {
        caption: Number(pathLength) > 0
            ? `Shortest path: <b>${pathLength} cells</b>`
            : `Frontier reached <b>${visited}</b> cells`,
        steps: visited,
        extra: pathLength,
        done: Number(pathLength) > 0
    };
}

/* ------------------------------------------------------------------ adapters ---- */

const ADAPTERS = {
    data_structures: {
        path: "/tools/data_structures/",
        stage: "#visual-stage",
        drive: "clock",
        fit: "inner",
        innerSelector: "#structure-visual",
        maxUpscale: 1.75,
        pageFns: { drive: driveStructures, signature: structuresSignature, read: readStructures }
    },
    sorting: {
        path: "/tools/sorting/",
        stage: ".canvas-wrapper",
        drive: "step",
        fit: "element",
        maxUpscale: 1,
        css: STEPPED_CSS,
        chip: (live) => `<b>${live.steps}</b> compares`,
        secondChip: (live) => (live.extra ? `<b>${live.extra}</b> swaps` : ""),
        pageFns: { setup: setupStepped, read: readSorting }
    },
    searching: {
        path: "/tools/searching/",
        stage: ".canvas-wrapper",
        drive: "step",
        fit: "element",
        maxUpscale: 1,
        css: STEPPED_CSS,
        chip: (live) => `<b>${live.steps}</b> compares`,
        pageFns: { setup: setupStepped, read: readSearching }
    },
    graphs: {
        path: "/tools/graphs/",
        stage: ".canvas-wrapper",
        drive: "step",
        fit: "element",
        maxUpscale: 1,
        css: STEPPED_CSS,
        chip: (live) => `<b>${live.steps}</b> cells`,
        pageFns: { setup: setupStepped, read: readGraphs }
    }
};

function adapterFor(toolId) {
    const adapter = ADAPTERS[toolId];
    if (!adapter) {
        throw new Error(`Unknown tool "${toolId}". Known: ${Object.keys(ADAPTERS).join(", ")}`);
    }
    return adapter;
}

module.exports = { ADAPTERS, adapterFor, CANVAS_WRAPPER_WIDTH };
