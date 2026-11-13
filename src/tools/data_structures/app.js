"use strict";

/*
 * Data Structure Lab
 *
 * URL parameters (all optional):
 *   structure=graph       any structure key or name: array, linkedList, stack, queue, deque,
 *                         hashTable, set, map, bst, heap, graph, dsu (Disjoint Set), trie
 *   speed=normal          slow | normal | fast, or an interval in ms (one animation step)
 *   op=find               the selected operation tab; a=..., b=... fill its two inputs
 *                         (Disjoint Set: union | find | makeset | connected, or add | search | remove | special)
 * Disjoint Set only:
 *   preset=redundant      redundant (Redundant Connection: 1..5, edges 1-2, 2-3, 3-4, 1-4, 1-5)
 *                         tall (a chain 5 -> 4 -> 3 -> 2 -> 1 and 7 -> 6; find(5), then union(7, 5))
 *                         singletons (1..5, no queued operations)
 *   run=3                 apply the first 3 queued items at once (run=all applies every item)
 *   step=4                then show 4 more animation frames, one at a time, and stop there
 *   play=all              then play the rest of the queue; play=item plays only the next
 *                         item, play=3 the next three; Speed sets the time per frame
 *
 * For recorders (Disjoint Set): #structure-visual and .dsu-view carry data-state
 * (idle | running | paused | done), data-components, data-cursor (queued items finished),
 * data-total, data-answer (the redundant edge, e.g. "1-4") and data-frame (the kind of the
 * frame on screen: find-walk, find-root, compress, compressed, compare, link, redundant,
 * connected, make-set). window.DisjointSetLab has load(preset), step(), next(), play(),
 * pause(), runItems(n) and snapshot(); see the end of this file.
 */

const structureSelect = document.getElementById("structure-select");
const valueInput = document.getElementById("value-input");
const secondaryInput = document.getElementById("secondary-input");
const valueLabel = document.getElementById("value-label");
const secondaryLabel = document.getElementById("secondary-label");
const valueTypeSelect = document.getElementById("value-type");
const specialAction = document.getElementById("special-action");
const complexityList = document.getElementById("complexity-list");
const structureName = document.getElementById("structure-name");
const structureSummary = document.getElementById("structure-summary");
const sizePill = document.getElementById("size-pill");
const visual = document.getElementById("structure-visual");
const bestFor = document.getElementById("best-for");
const watchOut = document.getElementById("watch-out");
const memoryNote = document.getElementById("memory-note");
const traceList = document.getElementById("trace-list");
const modelView = document.getElementById("model-view");
const selectedCard = document.getElementById("selected-card");
const selectedType = document.getElementById("selected-type");
const selectedLabel = document.getElementById("selected-label");
const editValueInput = document.getElementById("edit-value-input");
const editSecondaryInput = document.getElementById("edit-secondary-input");
const updateSelectedButton = document.getElementById("update-selected");
const clearSelectedButton = document.getElementById("clear-selected");
const operationPlan = document.getElementById("operation-plan");
const comparisonList = document.getElementById("comparison-list");
const lastOperation = document.getElementById("last-operation");
const lastTouched = document.getElementById("last-touched");
const lastMeasured = document.getElementById("last-measured");
const lastGrowth = document.getElementById("last-growth");
const operationBar = document.getElementById("operation-bar");
const randomizeButton = document.getElementById("randomize");
const resetButton = document.getElementById("reset");
const operationButtons = Array.from(document.querySelectorAll("[data-operation]"));
const visualStage = document.getElementById("visual-stage");
const animationStatus = document.getElementById("animation-status");
const animationSpeed = document.getElementById("animation-speed");
const replayAnimationButton = document.getElementById("replay-animation");
const executeOperationButton = document.getElementById("execute-operation");
const commandPreview = document.getElementById("command-preview");
const primaryField = document.getElementById("primary-field");
const secondaryField = document.getElementById("secondary-field");
const resultBanner = document.getElementById("result-banner");
const resultIcon = document.getElementById("result-icon");
const resultState = document.getElementById("result-state");
const resultTitle = document.getElementById("result-title");
const resultDetail = document.getElementById("result-detail");
const resultSteps = document.getElementById("result-steps");
const resultValue = document.getElementById("result-value");
const comparisonBubble = document.getElementById("comparison-bubble");
const dockOperation = document.getElementById("dock-operation");
const dockSummary = document.getElementById("dock-summary");
const algorithmName = document.getElementById("algorithm-name");
const algorithmDetail = document.getElementById("algorithm-detail");
const traversalSelect = document.getElementById("graph-traversal");
const traversalField = document.getElementById("traversal-field");
const typeField = document.getElementById("type-field");

let animationRun = 0;
let lastAnimationTargets = [];
let lastOutcome = null;

// Disjoint Set presets. `parent` maps a label to its parent's label (missing: its own root);
// `items` are queued operations that Step, Next and Play work through in order.
const DSU_PRESETS = {
    redundant: {
        title: "Redundant Connection",
        listTitle: "Edges in order",
        noun: "edge",
        answerMode: true,
        elements: ["1", "2", "3", "4", "5"],
        parent: {},
        items: [["union", "1", "2"], ["union", "2", "3"], ["union", "3", "4"], ["union", "1", "4"], ["union", "1", "5"]]
    },
    tall: {
        title: "Tall tree",
        listTitle: "Operations",
        noun: "operation",
        answerMode: false,
        elements: ["1", "2", "3", "4", "5", "6", "7"],
        parent: { "2": "1", "3": "2", "4": "3", "5": "4", "7": "6" },
        items: [["find", "5"], ["union", "7", "5"]]
    },
    singletons: {
        title: "Five singletons",
        listTitle: "Operations",
        noun: "operation",
        answerMode: false,
        elements: ["1", "2", "3", "4", "5"],
        parent: {},
        items: []
    }
};

const STRUCTURES = {
    array: {
        name: "Array",
        kind: "array",
        summary: "Contiguous indexed storage with fast random access.",
        best: "Index-heavy reads, compact memory, cache-friendly scans.",
        caution: "Insertion or deletion near the front shifts many elements.",
        memory: "O(n) contiguous slots.",
        initial: ["12", "7", "19", "3", "15", "8"],
        sampleValues: ["4", "11", "20", "6", "17"],
        secondaryLabel: "Index",
        specialLabel: "Access",
        operations: {
            add: ["Append", "O(1)", "O(1)", "O(n)", "Dynamic arrays occasionally resize."],
            search: ["Search", "O(1)", "O(n)", "O(n)", "Best case finds the first element."],
            remove: ["Remove", "O(1)", "O(n)", "O(n)", "Deleting by value may scan, then shift."],
            special: ["Access", "O(1)", "O(1)", "O(1)", "Direct address calculation by index."]
        }
    },
    linkedList: {
        name: "Linked List",
        kind: "list",
        summary: "Nodes connected by pointers, optimized for local insertion.",
        best: "Frequent insertions when you already have the node reference.",
        caution: "Search and random access require pointer chasing.",
        memory: "O(n) nodes plus pointer overhead.",
        initial: ["8", "13", "21", "34", "55"],
        sampleValues: ["5", "89", "2", "144"],
        secondaryLabel: "After",
        specialLabel: "Head",
        operations: {
            add: ["Append", "O(1)", "O(1)", "O(1)", "With a tail pointer, append is constant."],
            search: ["Search", "O(1)", "O(n)", "O(n)", "Traversal starts at the head."],
            remove: ["Remove", "O(1)", "O(n)", "O(n)", "Removal is cheap after the previous node is known."],
            special: ["Read head", "O(1)", "O(1)", "O(1)", "The head pointer gives immediate access."]
        }
    },
    stack: {
        name: "Stack",
        kind: "stack",
        summary: "Last-in, first-out access for nested work.",
        best: "Undo history, recursion frames, parsing, backtracking.",
        caution: "Only the top item is meant to be accessed directly.",
        memory: "O(n) items.",
        initial: ["main", "parse", "eval", "return"],
        sampleValues: ["call", "save", "undo", "frame"],
        secondaryLabel: "Unused",
        specialLabel: "Peek",
        operations: {
            add: ["Push", "O(1)", "O(1)", "O(1)", "Add to the top."],
            search: ["Search", "O(1)", "O(n)", "O(n)", "Stacks are not built for lookup."],
            remove: ["Pop", "O(1)", "O(1)", "O(1)", "Remove from the top."],
            special: ["Peek", "O(1)", "O(1)", "O(1)", "Read the top without removing it."]
        }
    },
    queue: {
        name: "Queue",
        kind: "queue",
        summary: "First-in, first-out access for ordered work.",
        best: "Schedulers, buffers, breadth-first search frontiers.",
        caution: "Searching inside the queue defeats the main abstraction.",
        memory: "O(n) items.",
        initial: ["A", "B", "C", "D", "E"],
        sampleValues: ["F", "G", "H", "I"],
        secondaryLabel: "Unused",
        specialLabel: "Peek",
        operations: {
            add: ["Enqueue", "O(1)", "O(1)", "O(1)", "Add at the back."],
            search: ["Search", "O(1)", "O(n)", "O(n)", "Best case finds the front item."],
            remove: ["Dequeue", "O(1)", "O(1)", "O(1)", "Remove from the front."],
            special: ["Peek", "O(1)", "O(1)", "O(1)", "Read the front item."]
        }
    },
    deque: {
        name: "Deque",
        kind: "deque",
        summary: "Double-ended queue with fast operations at both ends.",
        best: "Sliding windows, work stealing, monotonic queues.",
        caution: "Middle lookup is still linear.",
        memory: "O(n) items.",
        initial: ["4", "9", "16", "25", "36"],
        sampleValues: ["49", "64", "81", "100"],
        secondaryLabel: "End (front / back)",
        specialLabel: "Pop front",
        operations: {
            add: ["Push", "O(1)", "O(1)", "O(1)", "Type front or back to pick the end; both are constant time."],
            search: ["Search", "O(1)", "O(n)", "O(n)", "Lookup is a scan unless indexed separately."],
            remove: ["Remove value", "O(1)", "O(n)", "O(n)", "Removing a middle value requires search."],
            special: ["Pop front", "O(1)", "O(1)", "O(1)", "Remove from the opposite end."]
        }
    },
    hashTable: {
        name: "Hash Table",
        kind: "buckets",
        summary: "Keys are hashed into buckets for fast lookup.",
        best: "Dictionaries, indexes, caches, membership tests.",
        caution: "Bad hashing or high load causes collisions.",
        memory: "O(n + m) for entries and buckets.",
        initial: ["red", "blue", "green", "gold", "cyan"],
        sampleValues: ["violet", "black", "white", "lime"],
        secondaryLabel: "Value",
        specialLabel: "Analyze load",
        operations: {
            add: ["Insert", "O(1)", "O(1)", "O(n)", "Worst case is many collisions."],
            search: ["Lookup", "O(1)", "O(1)", "O(n)", "Hash then scan one bucket."],
            remove: ["Delete", "O(1)", "O(1)", "O(n)", "Same path as lookup."],
            special: ["Analyze load", "O(n)", "O(n)", "O(n)", "Count entries and report the current load factor."]
        }
    },
    set: {
        name: "Set",
        kind: "buckets",
        summary: "Unique values with fast membership tests.",
        best: "Deduplication, visited flags, membership filters.",
        caution: "Order is not the main contract in hash-based sets.",
        memory: "O(n) values plus hash table overhead.",
        initial: ["dog", "cat", "owl", "fox", "bee"],
        sampleValues: ["ant", "eel", "yak", "cow"],
        secondaryLabel: "Unused",
        specialLabel: "Toggle",
        operations: {
            add: ["Add", "O(1)", "O(1)", "O(n)", "Insert only if absent."],
            search: ["Has", "O(1)", "O(1)", "O(n)", "Membership is the primary operation."],
            remove: ["Delete", "O(1)", "O(1)", "O(n)", "Remove if present."],
            special: ["Toggle", "O(1)", "O(1)", "O(n)", "Delete if present, otherwise add."]
        }
    },
    map: {
        name: "Map",
        kind: "buckets",
        summary: "Key-value lookup with fast updates by key.",
        best: "Associative arrays, memoization, object indexes.",
        caution: "Keys must be stable and hash/equality behavior matters.",
        memory: "O(n) key-value entries plus buckets.",
        initial: [{
            key: "id",
            value: "42"
        }, {
            key: "name",
            value: "Ada"
        }, {
            key: "role",
            value: "admin"
        }],
        sampleValues: ["team", "lang", "score", "city"],
        secondaryLabel: "Value",
        specialLabel: "Get",
        operations: {
            add: ["Set", "O(1)", "O(1)", "O(n)", "Add or update a key."],
            search: ["Has key", "O(1)", "O(1)", "O(n)", "Check key membership."],
            remove: ["Delete", "O(1)", "O(1)", "O(n)", "Delete by key."],
            special: ["Get", "O(1)", "O(1)", "O(n)", "Return the value for a key."]
        }
    },
    bst: {
        name: "Binary Search Tree",
        kind: "tree",
        summary: "Ordered binary tree with smaller values left and larger values right.",
        best: "Ordered data, range queries, sorted traversal.",
        caution: "Unbalanced trees degrade to linked-list behavior.",
        memory: "O(n) nodes plus child pointers.",
        initial: ["50", "30", "70", "20", "40", "60", "80"],
        sampleValues: ["10", "35", "65", "90"],
        secondaryLabel: "Unused",
        specialLabel: "In-order",
        operations: {
            add: ["Insert", "O(1)", "O(log n)", "O(n)", "Balanced shape keeps paths short."],
            search: ["Search", "O(1)", "O(log n)", "O(n)", "Compare and discard half the tree each level."],
            remove: ["Delete", "O(1)", "O(log n)", "O(n)", "Deletion may replace with successor."],
            special: ["Traverse", "O(n)", "O(n)", "O(n)", "In-order traversal emits sorted values."]
        }
    },
    heap: {
        name: "Heap",
        kind: "heap",
        summary: "Complete tree where the minimum stays at the root.",
        best: "Priority queues, scheduling, top-k problems.",
        caution: "Search for arbitrary values is linear.",
        memory: "O(n) array-backed tree.",
        initial: ["3", "7", "5", "12", "10", "18", "9", "20"],
        sampleValues: ["1", "6", "14", "2"],
        secondaryLabel: "Unused",
        specialLabel: "Extract min",
        operations: {
            add: ["Insert", "O(1)", "O(log n)", "O(log n)", "Bubble up to restore heap order."],
            search: ["Search", "O(1)", "O(n)", "O(n)", "Heap order does not support binary search."],
            remove: ["Remove value", "O(1)", "O(n)", "O(n)", "Find the value, swap, then heapify."],
            special: ["Extract min", "O(1)", "O(log n)", "O(log n)", "Remove root and sink replacement."]
        }
    },
    graph: {
        name: "Graph",
        kind: "graph",
        summary: "Vertices connected by edges for relationship-heavy data.",
        best: "Networks, dependencies, routes, recommendations.",
        caution: "Traversal cost depends on both vertices and edges.",
        memory: "O(V + E) with adjacency lists.",
        initial: {
            nodes: ["A", "B", "C", "D", "E", "F"],
            edges: [
                ["A", "B"],
                ["A", "C"],
                ["B", "D"],
                ["C", "E"],
                ["D", "F"]
            ]
        },
        sampleValues: ["G", "H", "I", "J"],
        secondaryLabel: "Connect to",
        specialLabel: "Add edge",
        operations: {
            add: ["Add vertex", "O(1)", "O(1)", "O(1)", "Create an adjacency-list entry."],
            search: ["BFS search", "O(1)", "O(V + E)", "O(V + E)", "Visit reachable vertices level by level."],
            remove: ["Remove vertex", "O(V)", "O(V + E)", "O(V + E)", "Delete incident edges too."],
            special: ["Add edge", "O(1)", "O(1)", "O(1)", "Append neighbor references."]
        }
    },
    disjointSet: {
        name: "Disjoint Set",
        kind: "dsu",
        summary: "Union-Find: each group is a tree of parent pointers, named by its root.",
        best: "Groups that only merge: connectivity, component counts, the edge that closes a cycle, Kruskal.",
        caution: "It cannot split a group or return the path between two elements; compare roots, never parents.",
        memory: "O(n): one parent array and one size array.",
        initial: dsuPresetState("redundant"),
        sampleValues: ["1", "2", "3", "4", "5"],
        secondaryLabel: "Second element",
        specialLabel: "Connected",
        tabLabels: {
            add: "Union",
            search: "Find",
            remove: "Make set"
        },
        operations: {
            add: ["Union", "O(1)", "~O(1)", "O(log n)", "Find both roots, hang the smaller tree under the larger."],
            search: ["Find", "O(1)", "~O(1)", "O(log n)", "Walk up to the root, then point the whole path at it."],
            remove: ["Make set", "O(1)", "O(1)", "O(1)", "A new element is its own parent: one more group."],
            special: ["Connected", "O(1)", "~O(1)", "O(log n)", "Connected exactly when both finds return the same root."]
        }
    },
    trie: {
        name: "Trie",
        kind: "trie",
        summary: "Prefix tree for strings, one character per edge.",
        best: "Autocomplete, dictionaries, prefix lookup.",
        caution: "Can use more memory than hash sets for sparse strings.",
        memory: "O(total characters).",
        initial: ["car", "cat", "cart", "dog", "dot"],
        sampleValues: ["care", "door", "can", "dove"],
        secondaryLabel: "Prefix",
        specialLabel: "Prefix",
        operations: {
            add: ["Insert word", "O(k)", "O(k)", "O(k)", "k is word length."],
            search: ["Search word", "O(k)", "O(k)", "O(k)", "Follow one edge per character."],
            remove: ["Delete word", "O(k)", "O(k)", "O(k)", "Unmark and prune unused suffix nodes."],
            special: ["Prefix search", "O(k)", "O(k + m)", "O(k + m)", "Find prefix then list m completions."]
        }
    }
};

let currentKey = "array";
let state = cloneInitial(STRUCTURES[currentKey].initial);
let activeOperation = null;
let highlight = {};
let trace = [];
let sampleCursor = 0;
let selectedRef = null;
let lastMetrics = {
    label: "Load",
    touched: 0,
    measured: 0,
    growth: "O(1)",
    plan: ["Choose a structure and run an operation."]
};

function cloneInitial(value) {
    return JSON.parse(JSON.stringify(value));
}

function normalizeValue(value) {
    return String(value || "").trim();
}

function inferType(value) {
    if (value === null) return "null";
    if (typeof value === "object") return "entry";
    const text = String(value).trim();
    if (!text) return "empty";
    if (text === "true" || text === "false") return "boolean";
    if (!Number.isNaN(Number(text)) && text !== "") return "number";
    if ((text.startsWith("{") && text.endsWith("}")) || (text.startsWith("[") && text.endsWith("]"))) {
        try {
            JSON.parse(text);
            return "json";
        } catch (error) {
            return "string";
        }
    }
    return "string";
}

function typedInputValue(rawValue) {
    const value = normalizeValue(rawValue);
    const type = valueTypeSelect.value;
    if (type === "number") {
        const number = Number(value);
        return Number.isFinite(number) ? String(number) : "0";
    }
    if (type === "boolean") {
        return /^(true|1|yes|y)$/i.test(value) ? "true" : "false";
    }
    if (type === "json") {
        try {
            return JSON.stringify(JSON.parse(value));
        } catch (error) {
            return "{}";
        }
    }
    return value;
}

function typedOptionalValue(rawValue) {
    if (!normalizeValue(rawValue)) return "";
    return typedInputValue(rawValue);
}

function getPrimaryValue() {
    const value = normalizeValue(valueInput.value) || nextSample();
    return typedInputValue(value);
}

function getSecondaryValue() {
    return normalizeValue(secondaryInput.value);
}

function nextSample() {
    const config = STRUCTURES[currentKey];
    const value = config.sampleValues[sampleCursor % config.sampleValues.length];
    sampleCursor += 1;
    valueInput.value = value;
    return value;
}

function rawHash(value) {
    const text = String(value);
    let hash = 0;
    for (let i = 0; i < text.length; i += 1) {
        hash = (hash * 31 + text.charCodeAt(i)) % 9973;
    }
    return hash;
}

function hashValue(value, bucketCount) {
    return rawHash(value) % bucketCount;
}

function bucketCountFor(key) {
    return key === "hashTable" ? 7 : 6;
}

function hashExplanation(value, bucketCount) {
    const hash = rawHash(value);
    return `h("${value}") = ${hash}, ${hash} mod ${bucketCount} = ${hash % bucketCount}`;
}

function asEntryLabel(entry) {
    if (typeof entry === "object") {
        return `${entry.key}:${entry.value}`;
    }
    return String(entry);
}

function entryKey(entry) {
    return typeof entry === "object" ? String(entry.key) : String(entry);
}

function numericValue(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : String(value).charCodeAt(0);
}

function isNumeric(value) {
    const text = String(value).trim();
    return text !== "" && Number.isFinite(Number(text));
}




function compareValues(a, b) {
    if (isNumeric(a) && isNumeric(b)) {
        const difference = Number(a) - Number(b);
        return difference < 0 ? -1 : difference > 0 ? 1 : 0;
    }
    if (isNumeric(a) !== isNumeric(b)) return isNumeric(a) ? -1 : 1;
    const left = String(a);
    const right = String(b);
    return left < right ? -1 : left > right ? 1 : 0;
}

function addTrace(message) {
    trace.unshift(message);
    trace = trace.slice(0, 8);
}

// Graph search can run as BFS (the default) or DFS; the DFS variant only changes
// the search operation's name and note, its cost is the same O(V + E).
const GRAPH_DFS_SEARCH = ["DFS search", "O(1)", "O(V + E)", "O(V + E)", "Go deep through unvisited neighbors, backtrack at dead ends."];

function graphTraversal() {
    return traversalSelect && traversalSelect.value === "dfs" ? "dfs" : "bfs";
}

function operationConfig(operation) {
    if (currentKey === "graph" && operation === "search" && graphTraversal() === "dfs") return GRAPH_DFS_SEARCH;
    return STRUCTURES[currentKey].operations[operation] || STRUCTURES[currentKey].operations.add;
}

function structureSize() {
    const config = STRUCTURES[currentKey];
    if (config.kind === "dsu") return state.elements.length;
    return config.kind === "graph" ? state.nodes.length : state.length;
}

function measuredTouched(detail) {
    return detail.touched !== undefined ? detail.touched : structureSize();
}

function planForOperation(operation, primary, secondary) {
    const config = STRUCTURES[currentKey];
    const opName = operationConfig(operation)[0];
    if (config.kind === "dsu") {
        if (operation === "add") return [`find(${primary}) and find(${secondary}) walk up to their roots.`, "Same root: union returns False, the edge closes a cycle.", "Otherwise hang the smaller root under the larger and add the sizes."];
        if (operation === "search") return [`Walk parent pointers from ${primary} up to the root.`, "On the way back, point every node on the path at the root.", "Return the root."];
        if (operation === "special") return [`find(${primary}) and find(${secondary}).`, "Compare the two roots.", "The same root means connected."];
        return ["Append the new element.", "parent[x] = x and size[x] = 1.", "One more component."];
    }
    if (config.kind === "graph") {
        if (operation === "search" && graphTraversal() === "dfs") return [`Push ${state.nodes[0] || "the first vertex"} on the stack and mark it visited.`, `Follow the first unvisited neighbor; backtrack at dead ends until ${primary} is reached.`, "A visited neighbor that is not the parent closes a cycle."];
        if (operation === "search") return [`Start BFS at ${state.nodes[0] || "the first vertex"}.`, `Expand the FIFO frontier until ${primary} is reached.`, "Stop immediately when the target is found."];
        if (operation === "special") return [`Ensure vertices ${primary} and ${secondary} exist.`, "Check whether the edge already exists.", "Store neighbor references."];
        if (operation === "remove") return [`Find vertex ${primary}.`, "Delete it from the vertex list.", "Remove all incident edges."];
    }
    if (config.kind === "trie") {
        return [`Read one character at a time from ${primary}.`, "Follow or create one edge per character.", operation === "remove" ? "Unmark terminal and prune unused nodes." : "Stop at the terminal or prefix node."];
    }
    if (config.kind === "buckets" || currentKey === "map") {
        return [`Hash ${primary} to choose a bucket.`, "Scan only the collision chain in that bucket.", `${opName} the matching entry if needed.`];
    }
    if (config.kind === "tree") {
        return [`Compare ${primary} with the current node.`, "Move left or right according to ordering.", `${opName} when the target position is reached.`];
    }
    if (config.kind === "heap") {
        return operation === "special" ? ["Remove the root.", "Move the last item to the root.", "Sink it until heap order is restored."] : [`Locate ${primary}.`, `${opName} the heap array.`, "Bubble or heapify to restore heap order."];
    }
    if (currentKey === "array" && operation === "special") return [`Compute address for index ${secondary || primary}.`, "Read the slot directly.", "No scan is needed."];
    if (currentKey === "deque" && operation === "add") return [`Read the requested end: ${dequeEnd(secondaryInput.value)}.`, `Move that end pointer one slot outward.`, `Write ${primary} into the freed slot.`];
    if (currentKey === "stack" && operation === "search") return ["Start at the top of the stack.", `Compare downward until ${primary} appears.`, "Report how far below the top it sat."];
    if (currentKey === "linkedList") return ["Start at head.", "Follow next pointers in order.", `${opName} when the target node is reached.`];
    return [`Use the ${config.name} access rule.`, `${opName} ${primary}.`, "Update the visible model and cost counters."];
}

function setMetrics(operation, detail = {}) {
    const op = operationConfig(operation);
    lastMetrics = {
        label: op[0],
        touched: measuredTouched(detail),
        measured: detail.measured || 0,
        growth: op[2],
        plan: detail.plan || planForOperation(operation, detail.primary || valueInput.value || "value", detail.secondary || secondaryInput.value || "secondary")
    };
}

function setHighlight(next) {
    highlight = next;
}

function setOperation(operation) {
    activeOperation = operation;
    operationButtons.forEach((button) => {
        button.classList.toggle("active", button.dataset.operation === operation);
        button.setAttribute("aria-selected", String(button.dataset.operation === operation));
    });
    if (operation) updateCommandUI();
}

function resetState() {
    cancelAnimation();
    const config = STRUCTURES[currentKey];
    state = config.kind === "dsu" ? dsuPresetState(dsuPresetKey) : cloneInitial(config.initial);
    if (config.kind === "dsu") dsuResetPlayer();
    trace = [`Loaded ${config.kind === "dsu" ? `${config.name}: ${state.title}` : config.name}.`];
    setHighlight({});
    selectedRef = null;
    setOperation("search");
    sampleCursor = 0;
    valueInput.value = config.sampleValues[0] || "";
    secondaryInput.value = "";
    lastMetrics = {
        label: "Load",
        touched: structureSize(),
        measured: 0,
        growth: "O(1)",
        plan: [`Loaded the default ${config.name} model.`]
    };
    showIdleResult();
    updateStructureUI();
    render();
}

const WORD_POOL = ["amber", "anchor", "bison", "brick", "cedar", "cider", "delta", "ember", "fable", "grove", "harbor", "indigo", "jasper", "kelp", "lumen", "maple", "nectar", "onyx", "pearl", "quartz", "river", "slate", "tulip", "umber", "violet", "willow"];
const TRIE_STEMS = ["ca", "co", "do", "ba", "st", "pl", "tr"];
const TRIE_TAILS = ["r", "t", "b", "p", "ne", "rt", "ll", "ck", "re", "ve", "sh"];

function randomInt(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
}

function shuffled(list) {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = randomInt(0, i);
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

function distinctRandom(count, make) {
    const seen = new Set();
    let guard = 0;
    while (seen.size < count && guard < count * 40) {
        seen.add(make());
        guard += 1;
    }
    return Array.from(seen);
}



function randomDataset(key) {
    const config = STRUCTURES[key];
    const count = randomInt(5, 8);
    if (config.kind === "dsu") return dsuRandomState();
    if (config.kind === "graph") {
        const vertices = Array.from({
            length: randomInt(5, 7)
        }, (unused, index) => String.fromCharCode(65 + index));
        
        
        const edges = vertices.slice(1).map((vertex, index) => [vertices[randomInt(0, index)], vertex]);
        for (let extra = randomInt(1, 2); extra > 0; extra -= 1) {
            const a = vertices[randomInt(0, vertices.length - 1)];
            const b = vertices[randomInt(0, vertices.length - 1)];
            if (a !== b && !edges.some(([x, y]) => (x === a && y === b) || (x === b && y === a))) edges.push([a, b]);
        }
        return {
            nodes: vertices,
            edges
        };
    }
    if (key === "map") {
        return shuffled(WORD_POOL).slice(0, count).map((word) => ({
            key: word,
            value: String(randomInt(1, 99))
        }));
    }
    if (key === "trie") {
        
        const stems = shuffled(TRIE_STEMS).slice(0, randomInt(2, 3));
        return distinctRandom(count, () => stems[randomInt(0, stems.length - 1)] + TRIE_TAILS[randomInt(0, TRIE_TAILS.length - 1)]);
    }
    const numeric = cloneInitial(config.initial).every((value) => isNumeric(value));
    if (numeric) return distinctRandom(count, () => String(randomInt(1, 99)));
    return shuffled(WORD_POOL).slice(0, count);
}

function randomizeState() {
    cancelAnimation();
    const config = STRUCTURES[currentKey];
    state = randomDataset(currentKey);
    if (config.kind === "heap") heapifyState();
    if (config.kind === "dsu") dsuResetPlayer();
    addTrace(`Randomized ${config.name} with ${structureSize()} ${structureSize() === 1 ? "item" : "items"}.`);
    setHighlight({});
    selectedRef = null;
    sampleCursor = 0;
    lastMetrics = {
        label: "Randomize",
        touched: structureSize(),
        measured: 0,
        growth: "O(n)",
        plan: [`Generated a fresh ${config.name} dataset.`, "Rebuilt the visual model.", "Refreshed type metadata."]
    };
    showIdleResult();
    render();
}

function updateStructureUI() {
    const config = STRUCTURES[currentKey];
    structureName.textContent = config.name;
    structureSummary.textContent = config.summary;
    bestFor.textContent = config.best;
    watchOut.textContent = config.caution;
    memoryNote.textContent = config.memory;
    const specialLabel = specialAction.querySelector("span");
    if (specialLabel) specialLabel.textContent = config.specialLabel;
    else specialAction.textContent = config.specialLabel;
    const defaultTabs = {
        add: "Add",
        search: "Search",
        remove: "Remove"
    };
    operationButtons.forEach((button) => {
        const operation = button.dataset.operation;
        const label = button.querySelector("span");
        if (operation === "special" || !label) return;
        label.textContent = (config.tabLabels && config.tabLabels[operation]) || defaultTabs[operation];
    });
    editValueInput.disabled = config.kind === "dsu";
    updateSelectedButton.disabled = config.kind === "dsu";
    secondaryInput.placeholder = config.secondaryLabel;
    valueInput.placeholder = config.kind === "map" ? "key" : "value";
    editSecondaryInput.disabled = currentKey !== "map";
    editSecondaryInput.placeholder = currentKey === "map" ? "map value" : "only used by maps";
    updateCommandUI();
    renderComplexity();
}

function updateCommandUI() {
    const config = STRUCTURES[currentKey];
    const operation = activeOperation || "search";
    const op = operationConfig(operation);
    const subject = config.kind === "map" ? "key" : config.kind === "graph" ? "vertex" : config.kind === "trie" ? "word" : "value";
    const capitalized = subject[0].toUpperCase() + subject.slice(1);
    const labels = {
        add: `${capitalized} to add`,
        search: `${capitalized} to find`,
        remove: ["stack", "queue"].includes(currentKey) ? "Value (not required)" : `${capitalized} to remove`,
        special: currentKey === "array" ? "Not used by access" : capitalized
    };
    valueLabel.textContent = labels[operation];
    secondaryLabel.textContent = currentKey === "array" && operation === "special" ? "Index to access" : currentKey === "graph" && operation === "special" ? "Connect to vertex" : currentKey === "map" && operation === "add" ? "Value to store" : currentKey === "trie" && operation === "special" ? "Prefix to find" : config.secondaryLabel;
    const graphSearch = currentKey === "graph" && operation === "search";
    if (graphSearch) valueLabel.textContent = "Vertex to find (empty: visit all)";
    valueInput.placeholder = graphSearch ? "empty = full traversal" : config.kind === "map" ? "key" : "value";
    if (traversalField) traversalField.hidden = !graphSearch;
    if (typeField) typeField.hidden = graphSearch;
    const dsu = config.kind === "dsu";
    if (dsu) {
        valueLabel.textContent = {
            add: "First element (a)",
            search: "Element to find",
            remove: "New element (empty: next number)",
            special: "First element (a)"
        }[operation];
        secondaryLabel.textContent = ["add", "special"].includes(operation) ? "Second element (b)" : "Not used";
        valueInput.placeholder = operation === "remove" ? "next number" : "element";
        if (typeField) typeField.hidden = true;
    }
    const needsSecondary = (currentKey === "array" && operation === "special") || (currentKey === "graph" && operation === "special") || (currentKey === "map" && operation === "add") || (currentKey === "trie" && operation === "special") || (dsu && ["add", "special"].includes(operation));
    const optionalSecondary = currentKey === "deque" && operation === "add";
    secondaryField.classList.toggle("is-required", needsSecondary);
    secondaryField.classList.toggle("is-muted", !needsSecondary && !optionalSecondary);
    primaryField.classList.toggle("is-muted", (["stack", "queue"].includes(currentKey) && ["remove", "special"].includes(operation)) || (["array", "deque", "heap", "bst", "hashTable", "trie"].includes(currentKey) && operation === "special"));
    // Lower-case ordinary words but keep acronyms such as BFS and DFS.
    executeOperationButton.querySelector("span").textContent = `Run ${op[0].replace(/\b[A-Z][a-z]+/g, (word) => word.toLowerCase())}`;
    dockOperation.textContent = op[0];
    const primary = valueInput.value || (graphSearch || (dsu && operation === "remove") ? "" : dsu ? "a" : "value");
    const secondary = optionalSecondary ? dequeEnd(secondaryInput.value) : secondaryInput.value || (dsu ? "b" : config.secondaryLabel.toLowerCase());
    const args = needsSecondary || optionalSecondary ? `${primary}, ${secondary}` : primary;
    commandPreview.innerHTML = `<code>${escapeHTML(op[0].toLowerCase().replace(/\s+/g, "_"))}(${escapeHTML(args)})</code><span>${escapeHTML(op[4])}</span>`;
    const algorithm = algorithmFor(currentKey, operation);
    algorithmName.textContent = algorithm.name;
    algorithmDetail.textContent = algorithm.detail;
}

function algorithmFor(key, operation) {
    const config = STRUCTURES[key];
    if (key === "bst") {
        const algorithms = {
            add: ["Ordered leaf insertion", "Compare the key at each node, follow left for smaller or right for larger, then insert at the first empty child."],
            search: ["Iterative binary-search-tree lookup", "Start at the root and discard one subtree after every comparison: left when smaller, right when larger."],
            remove: ["Successor-based BST deletion", "Find the key by ordered lookup; for two children, replace it with the smallest key in the right subtree, then delete that successor."],
            special: ["Recursive in-order traversal", "Visit the left subtree, current node, then right subtree to produce values in sorted order."]
        };
        const [name, detail] = algorithms[operation];
        return {
            name,
            detail
        };
    }
    if (config.kind === "dsu") {
        const algorithms = {
            add: ["Union by size", "Find both roots. If they differ, hang the root of the smaller tree under the root of the larger one and add the sizes; the same root means the two were already connected, so union returns False."],
            search: ["Recursive find with path compression", "Follow parent pointers up to the root, then on the way back set every node on the path to point straight at the root."],
            remove: ["Make set", "Append a new element that is its own parent with size 1; the component count goes up by one."],
            special: ["Root comparison", "Two elements are in the same group exactly when find returns the same root for both."]
        };
        const [name, detail] = algorithms[operation];
        return {
            name,
            detail
        };
    }
    if (config.kind === "graph") {
        if (operation === "search" && graphTraversal() === "dfs") return {
            name: "Depth-first search (DFS)",
            detail: "Go as deep as possible through unvisited neighbors in insertion order, backtrack at dead ends, and report a visited neighbor that is not the parent as a cycle."
        };
        const algorithms = {
            add: ["Adjacency-list vertex insertion", "Create a vertex and an empty neighbor list in constant time."],
            search: ["Breadth-first search (BFS)", "Use a FIFO frontier and visit every reachable vertex level by level until the target is found."],
            remove: ["Adjacency-list vertex deletion", "Remove the vertex, then scan all adjacency lists to remove incident edges."],
            special: ["Undirected adjacency-list edge insertion", "Add each endpoint to the other endpoint's neighbor list after checking for a duplicate edge."]
        };
        const [name, detail] = algorithms[operation];
        return {
            name,
            detail
        };
    }
    if (config.kind === "heap") {
        const algorithms = {
            add: ["Min-heap bubble-up", "Append at the end, then swap with the parent while the new key is smaller."],
            search: ["Linear heap scan", "A heap only orders parents against children, so arbitrary-value search checks the backing array sequentially."],
            remove: ["Swap, then restore heap order", "Replace the removed slot with the last item, then bubble up or sink down as required."],
            special: ["Extract-min with sink-down", "Remove the root, move the final item to the root, then swap with the smaller child until ordered."]
        };
        const [name, detail] = algorithms[operation];
        return {
            name,
            detail
        };
    }
    if (config.kind === "trie") return {
        name: operation === "special" ? "Prefix walk with depth-first collection" : "Character-by-character trie walk",
        detail: "Follow one child edge per character; no unrelated branch is inspected."
    };
    if (config.kind === "buckets") return operation === "special" && key === "hashTable" ? {
        name: "Load-factor analysis",
        detail: "Count stored entries and divide by the seven allocated buckets; no keys are moved."
    } : {
        name: "Polynomial hash with separate chaining",
        detail: "Compute a bucket index with a base-31 string hash, then scan only that bucket's collision chain."
    };
    if (config.kind === "list") return {
        name: operation === "add" ? "Tail-pointer append" : "Forward pointer traversal",
        detail: operation === "add" ? "Link the current tail to a new node and move the tail pointer." : "Start at head and follow next pointers until the value is found or the list ends."
    };
    if (config.kind === "array") return {
        name: operation === "special" ? "Direct indexed access" : operation === "add" ? "Dynamic-array append" : "Linear scan",
        detail: operation === "special" ? "Calculate the slot address directly from its zero-based index." : operation === "add" ? "Write after the final element; resize and copy only when capacity is exhausted." : "Compare values from index 0 onward and stop at the first match."
    };
    if (config.kind === "stack") return {
        name: operation === "search" ? "Top-down stack scan" : "LIFO top operation",
        detail: operation === "search" ? "Inspect items from the top downward; stacks provide no fast arbitrary lookup." : "Read, add, or remove only at the top of the stack."
    };
    if (config.kind === "deque") return {
        name: operation === "search" ? "Linear deque scan" : operation === "add" ? "Double-ended push" : "Constant-time endpoint operation",
        detail: operation === "search" ? "Inspect items from front to back; only the two ends are cheap." : operation === "add" ? "Type front or back in the end field; either pointer moves outward in constant time." : "Use the front or back pointer without scanning middle items."
    };
    if (config.kind === "queue") return {
        name: operation === "search" ? "Linear queue scan" : "Constant-time endpoint operation",
        detail: operation === "search" ? "Inspect queued items from front to back." : "Use the front or back pointer without scanning middle items."
    };
    return {
        name: config.operations[operation][0],
        detail: config.operations[operation][4]
    };
}

function showIdleResult() {
    lastOutcome = null;
    resultBanner.className = "result-banner is-idle";
    resultIcon.innerHTML = '<span aria-hidden="true">&gt;_</span>';
    resultState.textContent = "No operation run yet";
    resultTitle.textContent = "Select an operation and provide its input.";
    resultDetail.textContent = "The output and cost will appear here.";
    resultSteps.textContent = "-";
    resultValue.textContent = "-";
    dockSummary.textContent = "No comparisons yet";
}

function renderComplexity() {
    const operations = STRUCTURES[currentKey].operations;
    complexityList.innerHTML = Object.keys(operations).map((key) => [key, operationConfig(key)]).map(([key, op]) => `
        <article class="complexity-card ${activeOperation === key ? "active" : ""}">
            <div class="complexity-top">
                <span>${op[0]}</span>
                <span>${op[2]}</span>
            </div>
            <div class="complexity-grid">
                <span>best ${op[1]}</span>
                <span>avg ${op[2]}</span>
                <span>worst ${op[3]}</span>
            </div>
            <p>${op[4]}</p>
        </article>
    `).join("");
}

function complexityWeight(bigO, n) {
    if (bigO.includes("V + E")) return n * 1.8;
    if (bigO.includes("k + m")) return Math.max(1, String(valueInput.value || "").length + 2);
    if (bigO.includes("log")) return Math.log2(n + 1);
    if (bigO.includes("n")) return n;
    if (bigO.includes("k")) return Math.max(1, String(valueInput.value || "").length);
    return 1;
}

function renderMetrics() {
    const n = Math.max(1, structureSize());
    const touched = Math.max(0, lastMetrics.touched);
    lastOperation.textContent = lastMetrics.label;
    lastTouched.textContent = `${touched} ${touched === 1 ? "node" : "nodes"}`;
    lastMeasured.textContent = `${lastMetrics.measured.toFixed(3)} ms`;
    lastGrowth.textContent = lastMetrics.growth;
    operationBar.style.width = `${Math.min(100, Math.max(5, (touched / n) * 100))}%`;
    operationPlan.innerHTML = lastMetrics.plan.map((item) => `<li>${escapeHTML(item)}</li>`).join("");
}

function renderComparison() {
    const operation = activeOperation || "search";
    const n = Math.max(1, structureSize());
    const rows = Object.entries(STRUCTURES)
        .filter(([key, config]) => config.operations[operation] && (config.kind !== "dsu" || key === currentKey))
        .map(([key, config]) => {
            const growth = config.operations[operation][2];
            return {
                key,
                name: config.name,
                growth,
                score: complexityWeight(growth, n)
            };
        })
        .sort((a, b) => a.score - b.score);
    const top = rows.slice(0, 6);
    if (!top.some((row) => row.key === currentKey)) {
        const current = rows.find((row) => row.key === currentKey);
        if (current) top.splice(5, 1, current);
    }
    const maxScore = Math.max(...top.map((row) => row.score), 1);
    comparisonList.innerHTML = top.map((row) => `
        <div class="comparison-row ${row.key === currentKey ? "active" : ""}">
            <div>
                <strong>${row.name}</strong>
                <span>${row.growth}</span>
            </div>
            <div class="comparison-track" aria-hidden="true">
                <span style="width:${Math.max(8, (row.score / maxScore) * 100)}%"></span>
            </div>
        </div>
    `).join("");
}

function typedModel() {
    const config = STRUCTURES[currentKey];
    if (config.kind === "graph") {
        return {
            nodes: state.nodes.map((node) => ({
                value: node,
                type: "vertex"
            })),
            edges: state.edges.map((edge) => ({
                from: edge[0],
                to: edge[1],
                type: "edge"
            }))
        };
    }
    if (currentKey === "map") {
        return state.map((entry) => ({
            key: entry.key,
            keyType: inferType(entry.key),
            value: entry.value,
            valueType: inferType(entry.value)
        }));
    }
    return state.map((value, index) => ({
        index,
        value,
        type: currentKey === "trie" ? "word" : inferType(value)
    }));
}

async function performOperation(operation) {
    cancelAnimation();
    const config = STRUCTURES[currentKey];
    if (!validateOperationInput(operation)) return;
    if (config.kind === "dsu") {
        dsuRunCommand(operation);
        return;
    }
    const originalState = cloneInitial(state);
    const beforeSize = structureSize();
    const requestedValue = normalizeValue(valueInput.value) || config.sampleValues[sampleCursor % config.sampleValues.length];
    const started = performance.now();
    setOperation(operation);

    if (config.kind === "graph") {
        performGraphOperation(operation);
    } else if (config.kind === "trie") {
        performTrieOperation(operation);
    } else if (config.kind === "heap") {
        performHeapOperation(operation);
    } else if (currentKey === "bst") {
        performBSTOperation(operation);
    } else if (currentKey === "map") {
        performMapOperation(operation);
    } else if (["hashTable", "set"].includes(currentKey)) {
        performHashSetOperation(operation);
    } else {
        performLinearOperation(operation);
    }

    lastMetrics.measured = performance.now() - started;
    lastOutcome = buildOutcome(operation, requestedValue, beforeSize);
    const committedState = cloneInitial(state);
    const stateChanged = JSON.stringify(originalState) !== JSON.stringify(committedState);
    if (stateChanged) state = originalState;
    showRunningResult(lastOutcome);
    render();
    const completed = await playOperationAnimation(operation);
    if (!completed) return;
    if (stateChanged) {
        state = committedState;
        render();
        if (operation === "add") {
            const added = Array.from(visual.querySelectorAll(".selectable")).find((node) =>
                String(node.dataset.value) === String(highlight.value) ||
                String(node.dataset.key) === String(highlight.value)
            );
            if (added) {
                added.classList.add("animation-result", "endpoint-result");
                added.scrollIntoView({
                    behavior: "smooth",
                    block: "nearest",
                    inline: "nearest"
                });
            }
        }
    }
    showCompletedResult(lastOutcome);
}

function validateOperationInput(operation) {
    primaryField.classList.remove("is-invalid");
    secondaryField.classList.remove("is-invalid");
    valueInput.removeAttribute("aria-invalid");
    secondaryInput.removeAttribute("aria-invalid");
    if (STRUCTURES[currentKey].kind === "dsu") return dsuValidate(operation);
    const primary = normalizeValue(valueInput.value);
    const primaryOptional = (operation === "remove" && ["stack", "queue"].includes(currentKey)) ||
        (operation === "search" && currentKey === "graph") ||
        (operation === "special" && ["array", "stack", "queue", "deque", "heap", "bst", "hashTable"].includes(currentKey));
    if (!primary && !primaryOptional && !(currentKey === "trie" && operation === "special")) {
        return showInputError(primaryField, valueInput, "Enter a value before running this operation.", "No sample or fallback value will be used.");
    }

    if (currentKey === "map" && operation === "add" && !normalizeValue(secondaryInput.value)) {
        return showInputError(secondaryField, secondaryInput, "Enter the map value to store.", "Both a key and value are required. No random value will be generated.");
    }
    if (currentKey === "graph" && operation === "special" && !normalizeValue(secondaryInput.value)) {
        return showInputError(secondaryField, secondaryInput, "Enter the second endpoint.", "An edge requires two explicit vertices.");
    }
    if (currentKey === "trie" && operation === "special" && !normalizeValue(secondaryInput.value)) {
        return showInputError(secondaryField, secondaryInput, "Enter a prefix to find.", "Prefix search requires an explicit prefix.");
    }
    if (currentKey !== "array" || operation !== "special") return true;

    const rawIndex = normalizeValue(secondaryInput.value);
    const index = Number(rawIndex);
    const valid = rawIndex !== "" && Number.isInteger(index) && index >= 0 && index < state.length;
    if (valid) return true;

    return showInputError(secondaryField, secondaryInput, rawIndex === "" ? "Enter an index before running access." : `Index ${rawIndex} is outside the array.`, state.length ? `Use a whole number from 0 to ${state.length - 1}. No fallback index was used.` : "The array is empty, so there is no valid index.");
}

function showInputError(field, input, title, detail) {
    field.classList.add("is-invalid");
    input.setAttribute("aria-invalid", "true");
    resultBanner.className = "result-banner is-failure";
    resultIcon.innerHTML = '<span aria-hidden="true">&times;</span>';
    resultState.textContent = "Input required";
    resultTitle.textContent = title;
    resultDetail.textContent = detail;
    resultSteps.textContent = "0";
    resultValue.textContent = "not run";
    animationStatus.textContent = "Waiting for valid input";
    input.focus();
    return false;
}

function buildOutcome(operation, requestedValue, beforeSize) {
    const afterSize = structureSize();
    const found = highlight.mode === "hit";
    let success = true;
    let title = trace[0] || `${operationConfig(operation)[0]} completed.`;
    let returned = "void";
    if (operation === "search" && highlight.traversal) {
        // A full traversal has no target, so it cannot "miss"; a cycle is its finding.
        const summary = highlight.traversal;
        return {
            success: true,
            traversal: true,
            tone: summary.cycle ? "is-info" : "is-success",
            status: summary.cycle ? "Cycle found" : "Traversal complete",
            title: summary.cycle || summary.coverage,
            returned: summary.cycle ? "cycle" : `${summary.count} visited`,
            detail: summary.cycle ? summary.coverage : operationConfig(operation)[4],
            steps: lastMetrics.touched
        };
    }
    if (operation === "search") {
        success = found;
        returned = found ? (highlight.value ?? requestedValue) : "not found";
        title = found ? `Found ${requestedValue}` : `${requestedValue} was not found`;
    } else if (operation === "add") {
        success = afterSize > beforeSize || currentKey === "map";
        returned = success ? (highlight.value ?? requestedValue) : "unchanged";
    } else if (operation === "remove") {
        success = afterSize < beforeSize;
        returned = success ? (highlight.value ?? "removed") : "not found";
    } else {
        returned = highlight.resultValue ?? highlight.value ?? (highlight.index !== undefined ? state[highlight.index] : "complete");
        const lookupSpecial = ["map", "trie"].includes(currentKey) || (currentKey === "array" && highlight.index === undefined);
        if (lookupSpecial && highlight.mode === "scan") {
            success = false;
            title = `${operationConfig(operation)[0]} found no match for ${requestedValue}`;
        }
    }
    const status = success ? "Operation succeeded" : operation === "add" ? "No change needed" : "Operation finished: no match";
    return {
        success,
        status,
        title,
        returned: String(returned ?? "null"),
        detail: highlight.note || operationConfig(operation)[4],
        steps: lastMetrics.touched
    };
}

function showRunningResult(outcome) {
    resultBanner.className = "result-banner is-running";
    resultIcon.innerHTML = '<span aria-hidden="true">&hellip;</span>';
    resultState.textContent = "Operation running";
    resultTitle.textContent = outcome.title;
    resultDetail.textContent = "Follow the highlighted path in the visualization.";
    resultSteps.textContent = `0 / ${outcome.steps}`;
    resultValue.textContent = "pending";
}

function showCompletedResult(outcome) {
    if (!outcome) return;
    resultBanner.className = `result-banner ${outcome.tone || (outcome.success ? "is-success" : "is-failure")}`;
    resultIcon.innerHTML = `<span aria-hidden="true">${outcome.tone === "is-info" ? "!" : outcome.success ? "&check;" : "&times;"}</span>`;
    resultState.textContent = outcome.status;
    resultTitle.textContent = outcome.title;
    resultDetail.textContent = outcome.detail;
    resultSteps.textContent = String(outcome.steps);
    resultValue.textContent = outcome.returned;
    dockSummary.textContent = `${outcome.steps} ${outcome.steps === 1 ? "step" : "steps"} performed`;
}

function cancelAnimation() {
    animationRun += 1;
    dsuStopTimer();
    visualStage.classList.remove("is-playing", "is-starting", "is-finishing");
    animationStatus.textContent = "Ready";
    comparisonBubble.hidden = true;
    operationButtons.forEach((button) => {
        button.disabled = false;
    });
    executeOperationButton.disabled = false;
}

function animationTargets() {
    const selectable = Array.from(visual.querySelectorAll(".selectable"));
    if (highlight.indices && highlight.indices.length) {
        return highlight.indices
            .map((index) => selectable.find((node) => node.dataset.kind === "linear" && Number(node.dataset.index) === index))
            .filter(Boolean);
    }
    if (highlight.prefix) {
        return selectable.filter((node) => {
            const value = node.dataset.value || "";
            return value && (highlight.prefix.startsWith(value) || value.startsWith(highlight.prefix));
        }).sort((a, b) => (a.dataset.value || "").length - (b.dataset.value || "").length);
    }
    if (highlight.scan && highlight.scan.length) {
        const remaining = selectable.slice();
        return highlight.scan.map(String).map((value) => {
            const index = remaining.findIndex((node) => String(node.dataset.value) === value);
            return index < 0 ? null : remaining.splice(index, 1)[0];
        }).filter(Boolean).slice(0, Math.max(1, lastMetrics.touched));
    }
    
    
    if (highlight.mode === "new") return [];
    return selectable.filter((node) => {
        if (highlight.index !== undefined && Number(node.dataset.index) === highlight.index) return true;
        return highlight.value !== undefined && String(node.dataset.value) === String(highlight.value);
    });
}

function delay(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function animateTargets(targets, label) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        targets.forEach((node) => node.classList.add("animation-result"));
        animationStatus.textContent = `${label} complete`;
        return true;
    }
    const run = ++animationRun;
    const interval = Number(animationSpeed.value) || 500;
    visualStage.classList.remove("is-finishing");
    visualStage.classList.add("is-playing", "is-starting");
    comparisonBubble.hidden = false;
    comparisonBubble.textContent = `${label} starting`;
    operationButtons.forEach((button) => {
        button.disabled = true;
    });
    executeOperationButton.disabled = true;
    targets.forEach((node) => node.classList.remove("animation-focus", "animation-done", "animation-result", "animation-miss"));
    await delay(Math.min(420, Math.max(220, interval * 0.55)));
    visualStage.classList.remove("is-starting");

    if (!targets.length) {
        comparisonBubble.textContent = "Direct operation - no existing node inspected";
        resultSteps.textContent = String(lastMetrics.touched);
        await delay(Math.min(650, interval));
        if (run !== animationRun) return false;
        visualStage.classList.remove("is-playing");
        visualStage.classList.add("is-finishing");
        comparisonBubble.textContent = "Write committed";
        await delay(420);
        comparisonBubble.hidden = true;
        visualStage.classList.remove("is-finishing");
        animationStatus.textContent = `${label} complete`;
        operationButtons.forEach((button) => {
            button.disabled = false;
        });
        executeOperationButton.disabled = false;
        return true;
    }

    for (let index = 0; index < targets.length; index += 1) {
        if (run !== animationRun) return false;
        if (index > 0) {
            targets[index - 1].classList.remove("animation-focus");
            targets[index - 1].classList.add("animation-done");
        }
        targets[index].classList.add("animation-focus");
        animationStatus.textContent = `${label} - step ${index + 1} of ${targets.length}`;
        comparisonBubble.textContent = `Inspecting ${targets[index].dataset.value || `node ${index + 1}`}`;
        resultSteps.textContent = `${index + 1} / ${targets.length}`;
        targets[index].scrollIntoView({
            behavior: "smooth",
            block: "nearest",
            inline: "nearest"
        });
        await delay(interval);
    }

    if (run !== animationRun) return false;
    const result = targets[targets.length - 1];
    const missed = Boolean(lastOutcome) && lastOutcome.success === false;
    result.classList.remove("animation-focus");
    result.classList.add(missed ? "animation-miss" : "animation-result");
    visualStage.classList.remove("is-playing");
    visualStage.classList.add("is-finishing");
    comparisonBubble.textContent = lastOutcome && lastOutcome.success && !lastOutcome.traversal ? "Match confirmed" : "Traversal complete";
    await delay(Math.min(300, interval));
    comparisonBubble.hidden = true;
    await delay(420);
    visualStage.classList.remove("is-finishing");
    animationStatus.textContent = `${label} complete`;
    operationButtons.forEach((button) => {
        button.disabled = false;
    });
    executeOperationButton.disabled = false;
    return true;
}

async function playOperationAnimation(operation) {
    lastAnimationTargets = animationTargets();
    if (["stack", "queue", "deque"].includes(currentKey) && operation !== "search") {
        const nodes = Array.from(visual.querySelectorAll(".selectable"));
        let endpoint = null;
        if (currentKey === "stack") endpoint = nodes[nodes.length - 1];
        else if (currentKey === "queue") endpoint = operation === "add" ? nodes[nodes.length - 1] : nodes[0];
        else if (currentKey === "deque" && operation === "add") endpoint = dequeEnd(secondaryInput.value) === "front" ? nodes[0] : nodes[nodes.length - 1];
        else if (currentKey === "deque" && operation === "special") endpoint = nodes[0];
        if (endpoint) lastAnimationTargets = [endpoint];
    }


    return animateTargets(lastAnimationTargets, operationConfig(operation)[0]);
}

function bstPath(value) {
    const path = [];
    let node = buildBST(state);
    let found = false;
    while (node) {
        path.push(String(node.value));
        const order = compareValues(value, node.value);
        if (order === 0) {
            found = true;
            break;
        }
        node = order < 0 ? node.left : node.right;
    }
    return {
        path,
        found
    };
}

function deleteBSTNode(node, target) {
    if (!node) return null;
    const order = compareValues(target, node.value);
    if (order < 0) node.left = deleteBSTNode(node.left, target);
    else if (order > 0) node.right = deleteBSTNode(node.right, target);
    else {
        if (!node.left) return node.right;
        if (!node.right) return node.left;
        let successor = node.right;
        while (successor.left) successor = successor.left;
        node.value = successor.value;
        node.right = deleteBSTNode(node.right, successor.value);
    }
    return node;
}

function bstPreorder(node, values = []) {
    if (!node) return values;
    values.push(node.value);
    bstPreorder(node.left, values);
    bstPreorder(node.right, values);
    return values;
}

function findBSTNode(node, value) {
    let current = node;
    while (current) {
        const order = compareValues(value, current.value);
        if (order === 0) return current;
        current = order < 0 ? current.left : current.right;
    }
    return null;
}

function bstInorder(node, values = []) {
    if (!node) return values;
    bstInorder(node.left, values);
    values.push(node.value);
    bstInorder(node.right, values);
    return values;
}

function performBSTOperation(operation) {
    const value = getPrimaryValue();
    const walk = bstPath(value);
    const path = walk.path;
    
    
    const exists = walk.found;

    if (operation === "add") {
        if (!exists) state.push(value);
        addTrace(exists ? `${value} already exists in the tree.` : `Inserted ${value} by following ${path.join(" -> ") || "root"}.`);
        setHighlight({
            value,
            mode: exists ? "hit" : "new",
            scan: path
        });
        setMetrics(operation, {
            primary: value,
            touched: Math.max(1, path.length + (exists ? 0 : 1))
        });
    } else if (operation === "search") {
        addTrace(exists ? `Found ${value} along ${path.join(" -> ")}.` : `${value} was not found; stopped after ${path.join(" -> ") || "root"}.`);
        setHighlight({
            value,
            mode: exists ? "hit" : "scan",
            scan: path
        });
        setMetrics(operation, {
            primary: value,
            touched: Math.max(1, path.length)
        });
    } else if (operation === "remove") {
        let successorSteps = 0;
        if (exists) {
            const tree = buildBST(state);
            const target = findBSTNode(tree, value);
            if (target && target.left && target.right) {
                let successor = target.right;
                successorSteps = 1;
                while (successor.left) {
                    successor = successor.left;
                    successorSteps += 1;
                }
            }
            state = bstPreorder(deleteBSTNode(tree, value));
        }
        addTrace(exists ?
            successorSteps ? `Deleted ${value}: walked ${path.join(" -> ")}, then ${successorSteps} more ${successorSteps === 1 ? "step" : "steps"} to its in-order successor.` : `Deleted ${value} after walking ${path.join(" -> ")}.` :
            `${value} was not present; stopped after ${path.join(" -> ") || "root"}.`);
        setHighlight({
            value,
            mode: "remove",
            scan: path
        });
        setMetrics(operation, {
            primary: value,
            touched: Math.max(1, path.length + successorSteps)
        });
    } else {
        const sorted = bstInorder(buildBST(state)).map(String);
        addTrace(`In-order traversal: ${sorted.join(", ") || "empty tree"}.`);
        setHighlight({
            mode: "scan",
            scan: sorted,
            resultValue: sorted.join(", ") || "empty"
        });
        setMetrics(operation, {
            primary: value,
            touched: state.length
        });
    }
}

function dequeEnd(rawValue) {
    return /^f(ront)?$/i.test(String(rawValue).trim()) ? "front" : "back";
}

function performLinearOperation(operation) {
    const value = getPrimaryValue();
    const config = STRUCTURES[currentKey];
    const secondary = getSecondaryValue();

    if (operation === "add") {
        const atFront = currentKey === "deque" && dequeEnd(secondary) === "front";
        const endpoint = atFront ? state[0] : state[state.length - 1];
        if (atFront) state.unshift(value);
        else state.push(value);
        addTrace(currentKey === "deque" ? `Pushed ${value} at the ${atFront ? "front" : "back"}.` : `${config.operations.add[0]} ${value}.`);
        setHighlight({
            value,
            mode: "new",
            scan: currentKey === "array" || endpoint === undefined ? [] : [String(endpoint)],
            action: "endpoint"
        });
        setMetrics(operation, {
            primary: value,
            secondary,
            touched: 1
        });
        return;
    }

    if (operation === "search") {
        
        
        const probeOrder = state.map((unused, index) => index);
        if (currentKey === "stack") probeOrder.reverse();
        const position = probeOrder.findIndex((index) => String(state[index]) === value);
        const foundIndex = position >= 0 ? probeOrder[position] : -1;
        const inspected = position >= 0 ? probeOrder.slice(0, position + 1) : probeOrder;
        addTrace(foundIndex >= 0 ?
            currentKey === "stack" ? `Found ${value} ${position} ${position === 1 ? "slot" : "slots"} below the top.` : `Found ${value} at position ${foundIndex}.` :
            `${value} was not found after ${state.length} ${state.length === 1 ? "comparison" : "comparisons"}.`);
        setHighlight({
            value,
            mode: foundIndex >= 0 ? "hit" : "scan",
            index: foundIndex >= 0 ? foundIndex : undefined,
            indices: inspected
        });
        setMetrics(operation, {
            primary: value,
            secondary,
            touched: inspected.length
        });
        return;
    }

    if (operation === "remove") {
        if (currentKey === "stack") {
            const removed = state.pop();
            addTrace(removed === undefined ? "Stack is empty." : `Popped ${removed}.`);
            setHighlight({
                value: removed,
                mode: "remove"
            });
            setMetrics(operation, {
                primary: removed,
                secondary,
                touched: removed === undefined ? 0 : 1
            });
            return;
        }
        if (currentKey === "queue") {
            const removed = state.shift();
            addTrace(removed === undefined ? "Queue is empty." : `Dequeued ${removed}.`);
            setHighlight({
                value: removed,
                mode: "remove"
            });
            setMetrics(operation, {
                primary: removed,
                secondary,
                touched: removed === undefined ? 0 : 1
            });
            return;
        }
        const index = state.findIndex((item) => String(item) === value);
        const inspected = state.map((unused, slot) => slot).slice(0, index >= 0 ? index + 1 : state.length);
        if (index >= 0) {
            const shifted = state.length - index - 1;
            state.splice(index, 1);
            addTrace(`Removed ${value} from index ${index}; ${shifted} ${shifted === 1 ? "element" : "elements"} shifted left.`);
        } else {
            addTrace(`${value} was not present.`);
        }
        setHighlight({
            value,
            mode: index >= 0 ? "remove" : "scan",
            index: index >= 0 ? index : undefined,
            indices: inspected
        });
        setMetrics(operation, {
            primary: value,
            secondary,
            touched: inspected.length
        });
        return;
    }

    if (currentKey === "array") {
        const index = Number.parseInt(secondary || value, 10);
        const safeIndex = Number.isInteger(index) ? Math.max(0, Math.min(index, state.length - 1)) : 0;
        addTrace(state.length ? `Accessed index ${safeIndex}: ${state[safeIndex]}.` : "Array is empty.");
        setHighlight({
            index: safeIndex,
            mode: "hit",
            resultValue: state.length ? String(state[safeIndex]) : "empty"
        });
        setMetrics(operation, {
            primary: value,
            secondary,
            touched: state.length ? 1 : 0
        });
    } else if (currentKey === "deque") {
        const removed = state.shift();
        addTrace(removed === undefined ? "Deque is empty." : `Popped front ${removed}.`);
        setHighlight({
            value: removed,
            mode: "remove",
            resultValue: removed === undefined ? "empty" : String(removed)
        });
        setMetrics(operation, {
            primary: removed,
            secondary,
            touched: removed === undefined ? 0 : 1
        });
    } else {
        const item = currentKey === "stack" ? state[state.length - 1] : state[0];
        addTrace(item === undefined ? `${config.name} is empty.` : `${config.specialLabel}: ${item}.`);
        setHighlight({
            index: currentKey === "stack" ? state.length - 1 : 0,
            mode: "hit",
            resultValue: item === undefined ? "empty" : String(item)
        });
        setMetrics(operation, {
            primary: item,
            secondary,
            touched: item === undefined ? 0 : 1
        });
    }
}

function performHashSetOperation(operation) {
    const value = getPrimaryValue();
    const exists = state.some((item) => String(item) === value);
    const bucketCount = bucketCountFor(currentKey);
    const bucket = hashValue(value, bucketCount);
    const bucketEntries = state.filter((item) => hashValue(entryKey(item), bucketCount) === bucket).map((item) => String(item));
    
    
    const probes = Math.max(1, exists ? bucketEntries.indexOf(value) + 1 : bucketEntries.length);
    const hashNote = hashExplanation(value, bucketCount);

    if (operation === "special" && currentKey === "hashTable") {
        const load = state.length / bucketCount;
        const longest = Math.max(0, ...Array.from({
            length: bucketCount
        }, (unused, index) => state.filter((item) => hashValue(entryKey(item), bucketCount) === index).length));
        addTrace(`Load factor ${state.length}/${bucketCount} = ${load.toFixed(2)}; longest chain ${longest}.`);
        setHighlight({
            mode: "scan",
            scan: state.map(String),
            resultValue: load.toFixed(2)
        });
        setMetrics(operation, {
            primary: value,
            touched: state.length,
            plan: [`Walk all ${bucketCount} buckets.`, `Count the ${state.length} stored entries.`, `Report entries / buckets = ${load.toFixed(2)}.`]
        });
        return;
    }

    let mode = "scan";
    if (operation === "add") {
        if (!exists) state.push(value);
        addTrace(`${hashNote}; ${exists ? `${value} already in bucket ${bucket}` : `stored ${value} in bucket ${bucket}`}.`);
        mode = exists ? "hit" : "new";
    } else if (operation === "search") {
        addTrace(`${hashNote}; ${exists ? `found ${value} after ${probes} ${probes === 1 ? "probe" : "probes"}` : `bucket ${bucket} has no ${value}`}.`);
        mode = exists ? "hit" : "scan";
    } else if (operation === "remove") {
        state = state.filter((item) => String(item) !== value);
        addTrace(`${hashNote}; ${exists ? `unlinked ${value} from bucket ${bucket}` : `${value} was not in bucket ${bucket}`}.`);
        mode = "remove";
    } else {
        if (exists) {
            state = state.filter((item) => String(item) !== value);
            addTrace(`${hashNote}; toggled ${value} off.`);
            mode = "remove";
        } else {
            state.push(value);
            addTrace(`${hashNote}; toggled ${value} on.`);
            mode = "new";
        }
    }

    setHighlight({
        value,
        mode,
        bucket,
        scan: bucketEntries
    });
    setMetrics(operation, {
        primary: value,
        touched: probes,
        plan: [hashNote, `Walk the ${bucketEntries.length}-entry chain in bucket ${bucket}.`, `${operationConfig(operation)[0]} the matching entry.`]
    });
}

function performMapOperation(operation) {
    const key = getPrimaryValue();
    const value = getSecondaryValue() || String(Math.floor(Math.random() * 90 + 10));
    const index = state.findIndex((entry) => entry.key === key);
    const bucketCount = bucketCountFor(currentKey);
    const bucket = hashValue(key, bucketCount);
    const bucketEntries = state.filter((entry) => hashValue(entry.key, bucketCount) === bucket).map((entry) => String(entry.key));
    const hashNote = hashExplanation(key, bucketCount);
    const bucketSize = Math.max(1, index >= 0 ? bucketEntries.indexOf(key) + 1 : bucketEntries.length);
    const mapPlan = [hashNote, `Walk the ${bucketEntries.length}-entry chain in bucket ${bucket}.`, `${operationConfig(operation)[0]} the entry for "${key}".`];

    if (operation === "add") {
        if (index >= 0) {
            state[index].value = value;
            addTrace(`${hashNote}; updated ${key} to ${value}.`);
        } else {
            state.push({
                key,
                value
            });
            addTrace(`${hashNote}; stored ${key} -> ${value} in bucket ${bucket}.`);
        }
        setHighlight({
            value: key,
            mode: index >= 0 ? "hit" : "new",
            bucket,
            scan: bucketEntries
        });
        setMetrics(operation, {
            primary: key,
            secondary: value,
            touched: bucketSize,
            plan: mapPlan
        });
    } else if (operation === "search") {
        addTrace(`${hashNote}; ${index >= 0 ? `key ${key} is in bucket ${bucket}` : `bucket ${bucket} has no key ${key}`}.`);
        setHighlight({
            value: key,
            mode: index >= 0 ? "hit" : "scan",
            bucket,
            scan: bucketEntries
        });
        setMetrics(operation, {
            primary: key,
            secondary: value,
            touched: bucketSize,
            plan: mapPlan
        });
    } else if (operation === "remove") {
        if (index >= 0) {
            state.splice(index, 1);
            addTrace(`${hashNote}; deleted key ${key} from bucket ${bucket}.`);
        } else {
            addTrace(`${key} was not present.`);
        }
        setHighlight({
            value: key,
            mode: "remove",
            bucket,
            scan: bucketEntries
        });
        setMetrics(operation, {
            primary: key,
            secondary: value,
            touched: bucketSize,
            plan: mapPlan
        });
    } else {
        addTrace(index >= 0 ? `${key} maps to ${state[index].value}.` : `${key} has no value.`);
        setHighlight({
            value: key,
            mode: index >= 0 ? "hit" : "scan",
            bucket,
            scan: bucketEntries,
            resultValue: index >= 0 ? state[index].value : "not found"
        });
        setMetrics(operation, {
            primary: key,
            secondary: value,
            touched: bucketSize,
            plan: mapPlan
        });
    }
}

function performHeapOperation(operation) {
    const value = getPrimaryValue();
    if (operation === "add") {
        const comparisonPath = [];
        let insertionIndex = state.length;
        while (insertionIndex > 0) {
            const parent = Math.floor((insertionIndex - 1) / 2);
            comparisonPath.push(String(state[parent]));
            if (compareValues(state[parent], value) <= 0) break;
            insertionIndex = parent;
        }
        state.push(value);
        const swaps = bubbleUp(state.length - 1);
        addTrace(`Inserted ${value} at index ${state.length - 1} and bubbled up ${swaps} ${swaps === 1 ? "level" : "levels"}.`);
        setHighlight({
            value,
            mode: "new",
            scan: comparisonPath
        });
        setMetrics(operation, {
            primary: value,
            touched: Math.max(1, comparisonPath.length)
        });
    } else if (operation === "search") {
        const index = state.findIndex((item) => String(item) === value);
        const found = index >= 0;
        addTrace(found ? `Found ${value} at index ${index}; arbitrary heap search is linear.` : `${value} was not found after ${state.length} comparisons.`);
        setHighlight({
            value,
            mode: found ? "hit" : "scan",
            index: found ? index : undefined,
            indices: state.map((unused, slot) => slot).slice(0, found ? index + 1 : state.length)
        });
        setMetrics(operation, {
            primary: value,
            touched: found ? index + 1 : state.length
        });
    } else if (operation === "remove") {
        const index = state.findIndex((item) => String(item) === value);
        const scanned = state.map((unused, slot) => slot).slice(0, index >= 0 ? index + 1 : state.length);
        let repairSwaps = 0;
        if (index >= 0) {
            const last = state.pop();
            if (index < state.length) {
                state[index] = last;
                repairSwaps = bubbleUp(index);
                if (!repairSwaps) repairSwaps = sinkDown(index);
            }
            addTrace(`Removed ${value} after ${index + 1} ${index === 0 ? "comparison" : "comparisons"}, then ${repairSwaps} repair ${repairSwaps === 1 ? "swap" : "swaps"}.`);
        } else {
            addTrace(`${value} was not present after scanning all ${state.length} slots.`);
        }
        setHighlight({
            value,
            mode: "remove",
            indices: scanned
        });
        setMetrics(operation, {
            primary: value,
            touched: index >= 0 ? index + 1 + repairSwaps : state.length
        });
    } else {
        const removed = state[0];
        const last = state.pop();
        let sinkSwaps = 0;
        if (state.length && last !== undefined) {
            state[0] = last;
            sinkSwaps = sinkDown(0);
        }
        addTrace(removed === undefined ? "Heap is empty." : `Extracted min ${removed}; the last item sank ${sinkSwaps} ${sinkSwaps === 1 ? "level" : "levels"}.`);
        setHighlight({
            value: removed,
            mode: "remove",
            resultValue: removed === undefined ? "empty" : String(removed)
        });
        setMetrics(operation, {
            primary: removed,
            touched: removed === undefined ? 0 : 1 + sinkSwaps
        });
    }
}

function heapifyState() {
    for (let index = Math.floor(state.length / 2) - 1; index >= 0; index -= 1) sinkDown(index);
}

function bubbleUp(startIndex) {
    let index = startIndex;
    let swaps = 0;
    while (index > 0) {
        const parent = Math.floor((index - 1) / 2);
        if (compareValues(state[parent], state[index]) <= 0) break;
        [state[parent], state[index]] = [state[index], state[parent]];
        index = parent;
        swaps += 1;
    }
    return swaps;
}

function sinkDown(startIndex) {
    let index = startIndex;
    let swaps = 0;
    while (true) {
        const left = index * 2 + 1;
        const right = left + 1;
        let smallest = index;
        if (left < state.length && compareValues(state[left], state[smallest]) < 0) smallest = left;
        if (right < state.length && compareValues(state[right], state[smallest]) < 0) smallest = right;
        if (smallest === index) break;
        [state[index], state[smallest]] = [state[smallest], state[index]];
        index = smallest;
        swaps += 1;
    }
    return swaps;
}

function performGraphOperation(operation) {
    // An empty "Vertex to find" turns graph search into a full traversal from the
    // first vertex: no target, every reachable vertex is visited.
    const fullTraversal = operation === "search" && !normalizeValue(valueInput.value);
    const value = fullTraversal ? "" : getPrimaryValue().toUpperCase();
    const secondary = (getSecondaryValue() || state.nodes[0] || "A").toUpperCase();
    const hasNode = state.nodes.includes(value);

    if (operation === "add") {
        if (!hasNode) {
            state.nodes.push(value);
            addTrace(`Added vertex ${value}.`);
        } else {
            addTrace(`${value} already exists.`);
        }
        setHighlight({
            value,
            mode: hasNode ? "hit" : "new"
        });
        setMetrics(operation, {
            primary: value,
            secondary,
            touched: 1
        });
    } else if (operation === "search" && graphTraversal() === "dfs") {
        const start = state.nodes[0];
        const {
            order,
            found,
            cycle
        } = dfsOrder(start, fullTraversal ? null : value);
        const visitedText = order.join(" -> ") || "no vertices";
        const line = fullTraversal ?
            `DFS from ${start} visited ${visitedText}.` :
            found ?
            `DFS from ${start} visited ${visitedText} and found ${value}.` :
            hasNode ?
            `DFS from ${start} visited ${visitedText}; ${value} exists but is not reachable from ${start}.` :
            `DFS from ${start} visited ${visitedText}; ${value} is not in the graph.`;
        let note = null;
        if (cycle) {
            note = `Edge ${cycle[0]} - ${cycle[1]} leads back to visited ${cycle[1]}: the graph has a cycle.`;
        } else if (!found && order.length) {
            note = `No edge led back to a visited vertex other than the parent: no cycle in ${start}'s component.`;
        }
        // Newest trace entries sit on top, so the note goes in first and reads below the order.
        if (note) addTrace(note);
        addTrace(line);
        setHighlight(fullTraversal ? {
            mode: "traversal",
            scan: order,
            cycleEdge: cycle,
            note,
            traversal: traversalSummary("DFS", start, order, cycle)
        } : {
            value,
            mode: found ? "hit" : "scan",
            scan: order,
            cycleEdge: cycle,
            note
        });
        setMetrics(operation, {
            primary: value,
            secondary,
            touched: Math.max(1, order.length),
            plan: fullTraversal ? [`Push ${start} on the stack and mark it visited.`, "Follow the first unvisited neighbor; backtrack at dead ends until the stack is empty.", "A visited neighbor that is not the parent closes a cycle."] : undefined
        });
    } else if (operation === "search") {
        const start = state.nodes[0];
        const {
            order,
            found
        } = bfsOrder(start, fullTraversal ? null : value);
        addTrace(fullTraversal ?
            `BFS from ${start} dequeued ${order.join(" -> ") || "no vertices"}.` :
            found ?
            `BFS from ${start} dequeued ${order.join(" -> ")} and found ${value}.` :
            hasNode ?
            `BFS from ${start} dequeued ${order.join(" -> ") || "no vertices"}; ${value} exists but is not reachable from ${start}.` :
            `BFS from ${start} dequeued ${order.join(" -> ") || "no vertices"}; ${value} is not in the graph.`);
        setHighlight(fullTraversal ? {
            mode: "traversal",
            scan: order,
            traversal: traversalSummary("BFS", start, order, null)
        } : {
            value,
            mode: found ? "hit" : "scan",
            scan: order
        });
        setMetrics(operation, {
            primary: value,
            secondary,
            touched: Math.max(1, order.length),
            plan: fullTraversal ? [`Start BFS at ${start}.`, "Dequeue the front vertex and enqueue its unvisited neighbors.", "Stop when the queue is empty: every reachable vertex was visited."] : undefined
        });
    } else if (operation === "remove") {
        
        
        const inspected = state.nodes.length + state.edges.length;
        const incident = state.edges.filter((edge) => edge[0] === value || edge[1] === value).length;
        state.nodes = state.nodes.filter((node) => node !== value);
        state.edges = state.edges.filter((edge) => edge[0] !== value && edge[1] !== value);
        const components = componentCount();
        const shape = !state.nodes.length ? "" : components === 1 ? " The graph is still connected." : ` The graph now has ${components} components.`;
        addTrace(hasNode ? `Removed vertex ${value} and ${incident} incident ${incident === 1 ? "edge" : "edges"}.${shape}` : `${value} was not present.`);
        setHighlight({
            value,
            mode: "remove"
        });
        setMetrics(operation, {
            primary: value,
            secondary,
            touched: inspected
        });
    } else {
        const duplicate = hasEdge(value, secondary);
        const selfLoop = value === secondary;
        if (!state.nodes.includes(value)) state.nodes.push(value);
        if (!state.nodes.includes(secondary)) state.nodes.push(secondary);
        if (!duplicate && !selfLoop) state.edges.push([value, secondary]);
        addTrace(selfLoop ? `Skipped self-loop on ${value}.` : duplicate ? `Edge ${value} - ${secondary} already exists.` : `Added edge ${value} - ${secondary}.`);
        setHighlight({
            value,
            secondary,
            mode: duplicate || selfLoop ? "hit" : "new",
            edge: selfLoop ? null : [value, secondary],
            resultValue: selfLoop ? "self-loop skipped" : `${value} - ${secondary}`
        });
        setMetrics(operation, {
            primary: value,
            secondary,
            touched: 2
        });
    }
}

function hasEdge(a, b) {
    return state.edges.some((edge) => (edge[0] === a && edge[1] === b) || (edge[0] === b && edge[1] === a));
}

function bfsOrder(start, target) {
    if (!state.nodes.includes(start)) return {
        order: [],
        found: false
    };
    const queue = [start];
    const discovered = new Set([start]);
    const order = [];
    while (queue.length) {
        const node = queue.shift();
        order.push(node);
        if (node === target) return {
            order,
            found: true
        };
        neighborsOf(node).forEach((next) => {
            if (!discovered.has(next)) {
                discovered.add(next);
                queue.push(next);
            }
        });
    }
    return {
        order,
        found: false
    };
}

// Iterative DFS with (vertex, parent, neighbor cursor) frames, neighbors in insertion
// order. A visited neighbor that is not the vertex's parent is an undirected cycle.
function dfsOrder(start, target) {
    if (!state.nodes.includes(start)) return {
        order: [],
        found: false,
        cycle: null
    };
    const order = [start];
    const visited = new Set([start]);
    let cycle = null;
    if (start === target) return {
        order,
        found: true,
        cycle
    };
    const stack = [{
        node: start,
        parent: null,
        neighbors: neighborsOf(start),
        next: 0
    }];
    while (stack.length) {
        const top = stack[stack.length - 1];
        if (top.next >= top.neighbors.length) {
            stack.pop();
            continue;
        }
        const next = top.neighbors[top.next++];
        if (visited.has(next)) {
            if (next !== top.parent && !cycle) cycle = [top.node, next];
            continue;
        }
        visited.add(next);
        order.push(next);
        if (next === target) return {
            order,
            found: true,
            cycle
        };
        stack.push({
            node: next,
            parent: top.node,
            neighbors: neighborsOf(next),
            next: 0
        });
    }
    return {
        order,
        found: false,
        cycle
    };
}

function traversalSummary(kind, start, order, cycle) {
    const total = state.nodes.length;
    const visited = order.join(" -> ") || "no vertices";
    const coverage = order.length === total ?
        `${kind} visited all ${total} vertices: ${visited}` :
        `${kind} from ${start} visited ${order.length} of ${total} vertices (the rest are not reachable): ${visited}`;
    return {
        coverage,
        count: order.length,
        cycle: cycle ? `Cycle found: edge ${cycle[0]} - ${cycle[1]} leads back to visited ${cycle[1]}` : null
    };
}

function componentCount() {
    const seen = new Set();
    let count = 0;
    state.nodes.forEach((node) => {
        if (seen.has(node)) return;
        count += 1;
        const queue = [node];
        seen.add(node);
        while (queue.length) {
            neighborsOf(queue.shift()).forEach((next) => {
                if (!seen.has(next)) {
                    seen.add(next);
                    queue.push(next);
                }
            });
        }
    });
    return count;
}

function graphModelHTML() {
    const rows = state.nodes.map((node) => {
        const neighbors = neighborsOf(node);
        return `<span class="adj-row"><b>${escapeHTML(node)}:</b> <span>${neighbors.length ? neighbors.map(escapeHTML).join(", ") : '<i>none</i>'}</span></span>`;
    }).join("");
    const edges = state.edges.map((edge) => `${escapeHTML(edge[0])}-${escapeHTML(edge[1])}`).join("  ");
    return `<span class="model-heading">Adjacency list</span>${rows}` +
        `<span class="model-heading">Edges (${state.edges.length})</span><span class="adj-edges">${edges || "<i>none</i>"}</span>`;
}

function neighborsOf(node) {
    const neighbors = [];
    state.edges.forEach((edge) => {
        const next = edge[0] === node ? edge[1] : edge[1] === node ? edge[0] : null;
        if (next && !neighbors.includes(next)) neighbors.push(next);
    });
    return neighbors;
}

function performTrieOperation(operation) {
    const word = getPrimaryValue().toLowerCase();
    const exists = state.includes(word);
    const lengthCost = Math.max(1, word.length);

    if (operation === "add") {
        if (!exists) state.push(word);
        addTrace(exists ? `${word} already exists.` : `Inserted ${word}.`);
        setHighlight({
            value: word,
            mode: exists ? "hit" : "new",
            prefix: word
        });
        setMetrics(operation, {
            primary: word,
            touched: lengthCost
        });
    } else if (operation === "search") {
        addTrace(exists ? `Found word ${word}.` : `${word} is not a stored word.`);
        setHighlight({
            value: word,
            mode: exists ? "hit" : "scan",
            prefix: word
        });
        setMetrics(operation, {
            primary: word,
            touched: lengthCost
        });
    } else if (operation === "remove") {
        state = state.filter((item) => item !== word);
        addTrace(exists ? `Deleted ${word} and pruned any node left without a word below it.` : `${word} was not present.`);
        setHighlight({
            value: word,
            mode: "remove",
            prefix: word
        });
        setMetrics(operation, {
            primary: word,
            touched: lengthCost
        });
    } else {
        const prefix = getSecondaryValue().toLowerCase() || word.slice(0, 2);
        const matches = state.filter((item) => item.startsWith(prefix));
        addTrace(`Prefix ${prefix}: ${matches.join(", ") || "no matches"}.`);
        setHighlight({
            value: prefix,
            mode: matches.length ? "hit" : "scan",
            prefix,
            resultValue: matches.join(", ") || "no matches"
        });
        setMetrics(operation, {
            primary: word,
            secondary: prefix,
            touched: prefix.length + matches.length
        });
    }
}

function selectionLabel(ref) {
    if (!ref) return "Click a node, cell, bucket item, vertex, or trie node to inspect it.";
    if (ref.kind === "map") return `key "${ref.key}" maps to "${ref.value}"`;
    if (ref.kind === "graph-edge") return `edge ${ref.a} - ${ref.b}`;
    if (ref.kind === "dsu") return dsuSelectionLabel(ref.value);
    if (ref.kind === "trie") return ref.value ? `prefix "${ref.value}"` : "trie root";
    return `${STRUCTURES[currentKey].name} item ${ref.index}: "${ref.value}"`;
}

function renderSelection() {
    if (!selectedRef) {
        selectedCard.classList.remove("has-selection");
        selectedType.textContent = "none";
        selectedLabel.textContent = selectionLabel(null);
        editValueInput.value = "";
        editSecondaryInput.value = "";
        return;
    }
    selectedCard.classList.add("has-selection");
    selectedType.textContent = inferType(selectedRef.kind === "map" ? selectedRef.value : selectedRef.value);
    selectedLabel.textContent = selectionLabel(selectedRef);
    editValueInput.value = selectedRef.kind === "map" ? selectedRef.key : selectedRef.value;
    editSecondaryInput.value = selectedRef.kind === "map" ? selectedRef.value : "";
}

function refreshSelectedFromState() {
    if (!selectedRef) return;
    if (selectedRef.kind === "dsu") {
        if (!state.elements || !state.elements.includes(selectedRef.value)) selectedRef = null;
        return;
    }
    if (selectedRef.kind === "graph") {
        if (!state.nodes.includes(selectedRef.value)) selectedRef = null;
        return;
    }
    if (selectedRef.kind === "map") {
        const entry = state.find((item) => item.key === selectedRef.key);
        selectedRef = entry ? {
            kind: "map",
            key: entry.key,
            value: entry.value
        } : null;
        return;
    }
    if (Number.isInteger(selectedRef.index) && selectedRef.index < state.length) {
        selectedRef.value = typeof state[selectedRef.index] === "object" ? asEntryLabel(state[selectedRef.index]) : state[selectedRef.index];
    } else if (selectedRef.kind !== "trie") {
        selectedRef = null;
    }
}

function render() {
    renderComplexity();
    const config = STRUCTURES[currentKey];
    const size = structureSize();
    sizePill.textContent = `n = ${size}`;
    if (config.kind !== "dsu") dsuClearAttributes();
    if (config.kind === "dsu") {
        modelView.innerHTML = dsuModelHTML();
        modelView.classList.add("is-adjacency");
    } else if (config.kind === "graph") {
        modelView.innerHTML = graphModelHTML();
        modelView.classList.add("is-adjacency");
    } else {
        modelView.classList.remove("is-adjacency");
        modelView.textContent = JSON.stringify(typedModel(), null, 2);
    }
    // Keep each "->" together so a long traversal order never wraps inside an arrow.
    traceList.innerHTML = trace.map((item) => `<li>${escapeHTML(item).replace(/-&gt;/g, '<span class="trace-arrow">-&gt;</span>')}</li>`).join("");
    refreshSelectedFromState();
    renderSelection();
    renderMetrics();
    renderComparison();

    if (!size) {
        visual.innerHTML = `<div class="empty-state">Empty ${config.name}</div>`;
        return;
    }

    if (config.kind === "array") renderArray();
    if (config.kind === "list") renderList("list-row");
    if (config.kind === "stack") renderStack();
    if (config.kind === "queue") renderList("queue-row");
    if (config.kind === "deque") renderList("deque-row");
    if (config.kind === "buckets") renderBuckets();
    if (config.kind === "tree") renderTree(buildBST(state), false);
    if (config.kind === "heap") renderTree(buildHeapTree(state), true);
    if (config.kind === "graph") renderGraph();
    if (config.kind === "dsu") renderDisjointSet();
    if (config.kind === "trie") renderTrie();
    fitStageContent();
}



function fitStageContent() {
    const overflow = visual.scrollWidth - visualStage.clientWidth;
    visualStage.scrollLeft = overflow > 0 ? overflow / 2 : 0;
}

function classFor(value, index) {
    const text = String(value);
    if (selectedRef && selectedRef.kind === "map" && selectedRef.key === text) return "is-selected";
    if (selectedRef && selectedRef.index === index && selectedRef.kind !== "trie") return "is-selected";
    if (selectedRef && selectedRef.value !== undefined && String(selectedRef.value) === text) return "is-selected";
    if (highlight.index === index) return `is-${highlight.mode || "hit"}`;
    if (highlight.indices) {
        if (highlight.indices.includes(index)) {
            return highlight.value !== undefined && String(highlight.value) === text ? `is-${highlight.mode || "hit"}` : "is-scan";
        }
        return "";
    }
    if (highlight.value !== undefined && String(highlight.value) === text) return `is-${highlight.mode || "hit"}`;
    if (highlight.scan && highlight.scan.slice(0, Math.max(1, lastMetrics.touched)).map(String).includes(text)) return "is-scan";
    return "";
}

function typeBadge(value, forcedType) {
    return `<span class="type-badge">${escapeHTML(forcedType || inferType(value))}</span>`;
}

function renderArray() {
    visual.innerHTML = `<div class="array-row">
        ${state.map((item, index) => `
            <div class="array-item">
                <div class="index-label">[${index}]</div>
                <button class="ds-cell selectable ${classFor(item, index)}" data-kind="linear" data-index="${index}" data-value="${escapeHTML(item)}" type="button">
                    <span>${escapeHTML(item)}</span>${typeBadge(item)}
                </button>
            </div>
        `).join("")}
    </div>`;
}

function renderList(rowClass) {
    const labels = currentKey === "linkedList" ? ["head", "tail"] : ["front", "back"];
    const connector = currentKey === "linkedList" ? "&rarr;" : "&#9474;";
    visual.innerHTML = `<div class="${rowClass}">
        ${state.map((item, index) => `
            <div class="array-item">
                <div class="role-label">${index === 0 ? labels[0] : index === state.length - 1 ? labels[1] : "&nbsp;"}</div>
                <button class="ds-node selectable ${classFor(item, index)}" data-kind="linear" data-index="${index}" data-value="${escapeHTML(item)}" type="button">
                    <small class="slot-index">${index}</small>
                    <span>${escapeHTML(item)}</span>${typeBadge(item)}
                </button>
            </div>
            ${index < state.length - 1 ? `<span class="arrow">${connector}</span>` : ""}
        `).join("")}
        ${currentKey === "linkedList" ? `<span class="arrow">&rarr;</span><div class="array-item"><div class="role-label">&nbsp;</div><span class="null-terminator">null</span></div>` : ""}
    </div>`;
}

function renderStack() {
    visual.innerHTML = `<div class="stack-wrap">
        <div class="stack-column">
            ${state.map((item, index) => `
                <div class="array-item stack-item">
                    ${index === state.length - 1 ? `<div class="role-label stack-top-label">top &darr; push / pop</div>` : ""}
                    <button class="ds-cell stack-cell selectable ${classFor(item, index)}" data-kind="linear" data-index="${index}" data-value="${escapeHTML(item)}" type="button">
                        <small class="slot-index">[${index}]</small>
                        <span>${escapeHTML(item)}</span>${typeBadge(item)}
                    </button>
                    ${index === 0 ? `<div class="role-label stack-base-label">bottom</div>` : ""}
                </div>
            `).join("")}
        </div>
    </div>`;
}

function renderBuckets() {
    const bucketCount = currentKey === "hashTable" ? 7 : 6;
    const buckets = Array.from({
        length: bucketCount
    }, () => []);
    state.forEach((entry, stateIndex) => {
        buckets[hashValue(entryKey(entry), bucketCount)].push({
            entry,
            stateIndex
        });
    });
    const activeBucket = highlight.bucket;

    visual.innerHTML = `<div class="bucket-table">
        ${buckets.map((bucket, index) => `
            <div class="bucket-row ${activeBucket === index ? "is-active-bucket" : ""}">
                <div class="bucket-label">${index}</div>
                <div class="bucket-chain">
                    ${bucket.length ? bucket.map(({ entry, stateIndex }) => `
                        <button class="ds-node selectable ${classFor(entryKey(entry), stateIndex)}" data-kind="${currentKey === "map" ? "map" : "linear"}" data-index="${stateIndex}" data-key="${escapeHTML(entryKey(entry))}" data-value="${escapeHTML(typeof entry === "object" ? entry.value : entry)}" type="button">
                            ${typeof entry === "object" ?
                                `<span>${escapeHTML(entry.key)}</span><small class="entry-value">&rarr; ${escapeHTML(entry.value)}</small>` :
                                `<span>${escapeHTML(entry)}</span>`}
                            ${typeBadge(typeof entry === "object" ? entry.value : entry)}
                        </button>
                    `).join(`<span class="arrow">&rarr;</span>`) : `<span class="role-label">empty</span>`}
                    ${bucket.length > 1 ? `<span class="bucket-load">${bucket.length}-long chain</span>` : ""}
                </div>
            </div>
        `).join("")}
    </div>`;
}

function buildBST(values) {
    let root = null;
    values.forEach((value) => {
        root = insertBST(root, value);
    });
    return root;
}

function insertBST(node, value) {
    if (!node) {
        return {
            value,
            left: null,
            right: null
        };
    }
    if (compareValues(value, node.value) < 0) {
        node.left = insertBST(node.left, value);
    } else {
        node.right = insertBST(node.right, value);
    }
    return node;
}

function buildHeapTree(values) {
    const nodes = values.map((value) => ({
        value,
        left: null,
        right: null
    }));
    nodes.forEach((node, index) => {
        node.left = nodes[index * 2 + 1] || null;
        node.right = nodes[index * 2 + 2] || null;
    });
    return nodes[0] || null;
}

const TREE_NODE_WIDTH = 96;
const TREE_NODE_HEIGHT = 74;
const TREE_SLOT = 104;
const TREE_LEVEL = 116;


function availableStageWidth() {
    return Math.max(280, visualStage.clientWidth - 44);
}

const CANVAS_PAD = 14;




function columnMetrics(columns, naturalSlot, minSlot) {
    const usable = availableStageWidth() - CANVAS_PAD * 2;
    const slot = Math.max(minSlot, Math.min(naturalSlot, usable / Math.max(1, columns)));
    return {
        slot,
        ratio: slot / naturalSlot
    };
}






function levelHeight(levels, naturalLevel, minLevel, ratio, reserve = 0) {
    const maxStage = Math.min(window.innerHeight * 0.78, 860);
    const budget = Math.max(240, maxStage - 56 - reserve);
    return Math.round(Math.max(minLevel, Math.min(naturalLevel * Math.max(ratio, 0.72), (budget - 60) / Math.max(1, levels))));
}

function renderTree(root, includeArray) {
    const entries = [];
    let column = 0;
    let maxDepth = 0;

    if (includeArray) {
        
        
        
        (function collect(node, index) {
            if (!node) return;
            const depth = Math.floor(Math.log2(index + 1));
            maxDepth = Math.max(maxDepth, depth);
            entries.push({
                node,
                depth,
                index
            });
            collect(node.left, index * 2 + 1);
            collect(node.right, index * 2 + 2);
        })(root, 0);
        column = Math.pow(2, maxDepth);
        entries.forEach((entry) => {
            const slotsInLevel = Math.pow(2, entry.depth);
            entry.column = ((entry.index + 1 - slotsInLevel) + 0.5) * (column / slotsInLevel);
        });
    } else {
        
        
        
        (function place(node, depth, parent) {
            if (!node) return;
            maxDepth = Math.max(maxDepth, depth);
            place(node.left, depth + 1, node);
            entries.push({
                node,
                depth,
                column: column + 0.5,
                side: parent ? (parent.left === node ? "L" : "R") : ""
            });
            column += 1;
            place(node.right, depth + 1, node);
        })(root, 0, null);
    }

    const {
        slot,
        ratio
    } = columnMetrics(column, TREE_SLOT, 56);
    const level = levelHeight(maxDepth + 1, TREE_LEVEL, 78, ratio, includeArray ? 124 : 0);
    const nodeWidth = Math.round(TREE_NODE_WIDTH * ratio);
    const nodeHeight = Math.min(Math.round(TREE_NODE_HEIGHT * Math.max(ratio, 0.72)), level - 24);
    const width = Math.max(280, Math.round(column * slot) + CANVAS_PAD * 2);
    const height = Math.max(300, 60 + (maxDepth + 1) * level);
    entries.forEach((entry) => {
        entry.x = CANVAS_PAD + entry.column * slot;
        entry.y = 22 + entry.depth * level;
    });

    const byNode = new Map(entries.map((item) => [item.node, item]));
    const links = [];
    entries.forEach((item) => {
        [item.node.left, item.node.right].forEach((child) => {
            const target = byNode.get(child);
            if (target) links.push([item, target]);
        });
    });

    const indexOf = (value) => state.findIndex((item) => String(item) === String(value));

    visual.innerHTML = `<div class="tree-canvas" style="width:${width}px; height:${height}px; --node-w:${nodeWidth}px; --node-h:${nodeHeight}px">
        <svg class="link-layer" style="width:${width}px; height:${height}px" viewBox="0 0 ${width} ${height}">
            ${links.map(([from, to]) => `
                <line x1="${from.x.toFixed(1)}" y1="${from.y + nodeHeight}" x2="${to.x.toFixed(1)}" y2="${to.y}" stroke-width="2" />
                ${includeArray ? "" : `<circle class="edge-chip" cx="${((from.x + to.x) / 2).toFixed(1)}" cy="${(from.y + nodeHeight + to.y) / 2}" r="11" /><text class="edge-label" x="${((from.x + to.x) / 2).toFixed(1)}" y="${(from.y + nodeHeight + to.y) / 2}" text-anchor="middle" dominant-baseline="central">${to.side === "L" ? "&lt;" : "&#8805;"}</text>`}
            `).join("")}
        </svg>
        ${entries.map((item) => `
            <button class="tree-node selectable ${classFor(item.node.value, indexOf(item.node.value))}" data-kind="linear" data-index="${indexOf(item.node.value)}" data-value="${escapeHTML(item.node.value)}" style="left:${(item.x - nodeWidth / 2).toFixed(1)}px; top:${item.y}px" type="button">
                <span>${escapeHTML(item.node.value)}</span>
            </button>
        `).join("")}
    </div>
    ${includeArray ? `<div class="heap-array" aria-label="Backing array">${state.map((item, index) => `
        <div class="heap-slot">
            <small class="slot-index">${index}</small>
            <button class="ds-cell selectable ${classFor(item, index)}" data-kind="linear" data-index="${index}" data-value="${escapeHTML(item)}" type="button"><span>${escapeHTML(item)}</span></button>
            <small class="slot-index">${index === 0 ? "root" : `p=${Math.floor((index - 1) / 2)}`}</small>
        </div>`).join("")}</div>` : ""}`;
}

const GRAPH_NODE_RADIUS = 34;

// Each connected component is laid out in BFS layers from its first vertex, and the
// components sit side by side. A tree drawn this way has no crossing edges, its rows
// are the BFS levels, and a disconnected piece is visibly apart from the rest.
function graphComponents() {
    const components = [];
    const seen = new Set();
    state.nodes.forEach((root) => {
        if (seen.has(root)) return;
        seen.add(root);
        const layers = [];
        let frontier = [root];
        while (frontier.length) {
            layers.push(frontier);
            const next = [];
            frontier.forEach((node) => neighborsOf(node).forEach((neighbor) => {
                if (!seen.has(neighbor)) {
                    seen.add(neighbor);
                    next.push(neighbor);
                }
            }));
            frontier = next;
        }
        components.push(layers);
    });
    return components;
}

const GRAPH_SLOT = 150;
const GRAPH_LEVEL = 118;
const GRAPH_COMPONENT_GAP = 60;

function graphLayout() {
    const components = graphComponents();
    const columns = components.map((layers) => Math.max(...layers.map((layer) => layer.length)));
    const depth = Math.max(...components.map((layers) => layers.length));
    const naturalWidth = columns.reduce((sum, count) => sum + count * GRAPH_SLOT, 0) + (components.length - 1) * GRAPH_COMPONENT_GAP + 40;
    const ratio = Math.min(1, availableStageWidth() / naturalWidth);
    if (Math.max(...columns) > 5 || depth > 6 || ratio < 0.6) return null;
    const nodeRadius = Math.round(GRAPH_NODE_RADIUS * Math.max(0.75, ratio));
    const slot = GRAPH_SLOT * ratio;
    const width = Math.max(280, Math.round(naturalWidth * ratio));
    const level = Math.max(nodeRadius * 2 + 34, GRAPH_LEVEL * Math.max(0.8, ratio));
    const height = Math.max(300, Math.round(depth * level + 24));
    const top = (height - (depth - 1) * level) / 2;
    const positions = new Map();
    let left = (width - (naturalWidth - 40) * ratio) / 2;
    components.forEach((layers, index) => {
        const blockWidth = columns[index] * slot;
        layers.forEach((layer, row) => {
            const offset = left + blockWidth / 2 - ((layer.length - 1) * slot) / 2;
            layer.forEach((node, column) => positions.set(node, {
                x: offset + column * slot,
                y: top + row * level
            }));
        });
        left += blockWidth + GRAPH_COMPONENT_GAP * ratio;
    });
    return {
        positions,
        nodeRadius,
        width,
        height
    };
}

function renderGraph() {
    const count = state.nodes.length;
    let layout = graphLayout();
    if (!layout) {
        // Too wide for layers (a star, or a big random graph): fall back to a ring.
        const naturalRing = Math.max(150, (GRAPH_NODE_RADIUS + 26) / Math.sin(Math.PI / Math.max(3, count)));
        const naturalSize = (naturalRing + GRAPH_NODE_RADIUS + 20) * 2;
        const ratio = Math.max(0.6, Math.min(1, availableStageWidth() / naturalSize));
        const nodeRadius = Math.round(GRAPH_NODE_RADIUS * ratio);
        const ringRadius = naturalRing * ratio;
        const size = Math.round((ringRadius + nodeRadius + 20) * 2);
        const width = Math.max(280, size);
        const height = Math.max(300, size);
        const positions = new Map();
        state.nodes.forEach((node, index) => {
            const angle = -Math.PI / 2 + (index / count) * Math.PI * 2;
            positions.set(node, {
                x: width / 2 + Math.cos(angle) * ringRadius,
                y: height / 2 + Math.sin(angle) * ringRadius
            });
        });
        layout = {
            positions,
            nodeRadius,
            width,
            height
        };
    }
    const {
        positions,
        nodeRadius,
        width,
        height
    } = layout;

    const highlightedEdges = new Set();
    if (highlight.edge) highlightedEdges.add([highlight.edge[0], highlight.edge[1]].sort().join("\u0000"));
    // Traversal order (BFS or DFS) as small numbers; CSS reveals each one as the
    // animation reaches that vertex.
    const visitOrder = new Map((highlight.scan || []).map((node, index) => [String(node), index + 1]));
    const cycleKey = highlight.cycleEdge ? [highlight.cycleEdge[0], highlight.cycleEdge[1]].sort().join("\u0000") : null;

    visual.innerHTML = `<div class="graph-canvas" style="width:${width}px; height:${height}px; --node-w:${nodeRadius * 2}px">
        <svg class="link-layer" style="width:${width}px; height:${height}px" viewBox="0 0 ${width} ${height}">
            ${state.edges.map((edge) => {
                const a = positions.get(edge[0]);
                const b = positions.get(edge[1]);
                if (!a || !b) return "";
                // Clip each end at the vertex border so the line reads as a connector
                // between two circles instead of disappearing under them.
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const length = Math.hypot(dx, dy) || 1;
                const ux = dx / length;
                const uy = dy / length;
                const key = [edge[0], edge[1]].sort().join("\u0000");
                const active = highlightedEdges.has(key);
                const cycleClass = key === cycleKey ? " is-cycle-edge" : "";
                return `<line class="graph-edge ${active ? "is-active-edge" : ""}${cycleClass}" data-edge="${escapeHTML(edge[0])}-${escapeHTML(edge[1])}" x1="${(a.x + ux * nodeRadius).toFixed(1)}" y1="${(a.y + uy * nodeRadius).toFixed(1)}" x2="${(b.x - ux * nodeRadius).toFixed(1)}" y2="${(b.y - uy * nodeRadius).toFixed(1)}" stroke-width="2" />`;
            }).join("")}
        </svg>
        ${state.nodes.map((node, index) => {
            const point = positions.get(node);
            const degree = neighborsOf(node).length;
            const visit = visitOrder.get(node);
            const visitBadge = visit ? `<small class="visit-badge" title="Visited ${visit}${visit === 1 ? "st" : visit === 2 ? "nd" : visit === 3 ? "rd" : "th"}">${visit}</small>` : "";
            return `<button class="graph-node selectable ${classFor(node, index)}" data-kind="graph" data-index="${index}" data-value="${escapeHTML(node)}" style="left:${(point.x - nodeRadius).toFixed(1)}px; top:${(point.y - nodeRadius).toFixed(1)}px" title="${escapeHTML(node)} - degree ${degree}" type="button"><span>${escapeHTML(node)}</span>${visitBadge}<small class="degree-badge">${degree}</small></button>`;
        }).join("")}
    </div>`;
}

const TRIE_NODE_SIZE = 62;
const TRIE_SLOT = 92;
const TRIE_LEVEL = 104;

function renderTrie() {
    const trie = buildTrie(state);
    const positions = [];
    const links = [];
    let cursor = 0;
    let maxDepth = 0;

    function place(node, depth, parent) {
        maxDepth = Math.max(maxDepth, depth);
        const children = Object.values(node.children);
        if (!children.length) {
            node.column = cursor + 0.5;
            cursor += 1;
        } else {
            children.forEach((child) => place(child, depth + 1, node));
            node.column = (children[0].column + children[children.length - 1].column) / 2;
        }
        node.depth = depth;
        positions.push(node);
        if (parent) links.push([parent, node]);
    }

    place(trie, 0, null);
    const {
        slot,
        ratio
    } = columnMetrics(cursor, TRIE_SLOT, 46);
    const level = levelHeight(maxDepth + 1, TRIE_LEVEL, 70, ratio);
    const nodeSize = Math.min(Math.round(TRIE_NODE_SIZE * ratio), level - 22);
    positions.forEach((node) => {
        node.x = CANVAS_PAD + node.column * slot;
        node.y = 22 + node.depth * level;
    });
    const canvasWidth = Math.max(280, Math.round(cursor * slot) + CANVAS_PAD * 2);
    const height = Math.max(300, 60 + (maxDepth + 1) * level);
    visual.innerHTML = `<div class="trie-canvas" style="width:${canvasWidth}px; height:${height}px; --node-w:${nodeSize}px">
        <svg class="link-layer" style="width:${canvasWidth}px; height:${height}px" viewBox="0 0 ${canvasWidth} ${height}">
            ${links.map(([from, to]) => {
                // Anchor the character on the visible part of the edge, not at the
                // midpoint of the two node tops, which used to hide it behind the parent.
                const y1 = from.y + nodeSize;
                const midX = (from.x + to.x) / 2;
                const midY = (y1 + to.y) / 2;
                return `
                <line x1="${from.x.toFixed(1)}" y1="${y1}" x2="${to.x.toFixed(1)}" y2="${to.y}" stroke-width="2" />
                <circle class="edge-chip" cx="${midX.toFixed(1)}" cy="${midY.toFixed(1)}" r="${Math.max(8, Math.round(11 * ratio))}" />
                <text class="edge-label" x="${midX.toFixed(1)}" y="${midY.toFixed(1)}" text-anchor="middle" dominant-baseline="central">${escapeHTML(to.char)}</text>`;
            }).join("")}
        </svg>
        ${positions.map((node, index) => {
            const label = node.root ? "\u25cf" : node.char;
            const active = highlight.prefix ? node.wordPrefix.startsWith(highlight.prefix) || highlight.prefix.startsWith(node.wordPrefix) : false;
            const selected = selectedRef && selectedRef.kind === "trie" && selectedRef.value === node.wordPrefix;
            const title = node.root ? "root" : `${node.wordPrefix}${node.terminal ? " (complete word)" : ""}`;
            return `<button class="trie-node selectable ${node.terminal ? "is-terminal" : ""} ${node.root ? "is-root" : ""} ${selected ? "is-selected" : active ? "is-hit" : classFor(node.wordPrefix, index)}" data-kind="trie" data-index="${index}" data-value="${escapeHTML(node.wordPrefix)}" style="left:${(node.x - nodeSize / 2).toFixed(1)}px; top:${node.y}px" title="${escapeHTML(title)}" type="button"><span>${escapeHTML(label)}</span></button>`;
        }).join("")}
    </div>`;
}

function buildTrie(words) {
    const root = {
        root: true,
        char: "",
        wordPrefix: "",
        terminal: false,
        children: {}
    };
    words.forEach((word) => {
        let node = root;
        let prefix = "";
        String(word).split("").forEach((char) => {
            prefix += char;
            if (!node.children[char]) {
                node.children[char] = {
                    char,
                    wordPrefix: prefix,
                    terminal: false,
                    children: {}
                };
            }
            node = node.children[char];
        });
        node.terminal = true;
    });
    return root;
}

/* ---------------------------------------------------------------------------
 * Disjoint Set (Union-Find)
 *
 * The model is one parent array and one size array over the elements' positions,
 * exactly like the course code:
 *
 *     def find(x):
 *         if parent[x] != x:
 *             parent[x] = find(parent[x])
 *         return parent[x]
 *
 *     def union(a, b):
 *         ra, rb = find(a), find(b)
 *         if ra == rb: return False
 *         if size[ra] < size[rb]: ra, rb = rb, ra
 *         parent[rb] = ra
 *         size[ra] += size[rb]
 *         return True
 *
 * Every operation is turned into a list of frames up front. A frame is a full copy
 * of the state after that step plus what to highlight, so Step, Play, Replay and the
 * URL setup all show exactly the same pictures.
 * ------------------------------------------------------------------------- */

const DSU_RADIUS = 27;
const DSU_SLOT = 96;
const DSU_LEVEL = 90;
const DSU_QUEUE_WIDTH = 188;
const DSU_OPERATION_FOR = {
    union: "add",
    find: "search",
    connected: "special",
    makeset: "remove"
};

let dsuPresetKey = "redundant";
let dsuPending = [];
let dsuFrame = null;
let dsuTimer = 0;
let dsuPlaying = false;
let dsuStopAtItemEnd = false;
let dsuItemsLeft = Infinity;
let dsuLastWasCommand = false;
let dsuLastRun = null;
let dsuReplaying = false;
let dsuDepthLevels = 0;

function dsuItemLabel(preset, op, a, b) {
    if (op === "union" && preset.noun === "edge") return `${a}-${b}`;
    if (op === "union" || op === "connected") return `${op}(${a}, ${b})`;
    return `${op}(${a})`;
}

function dsuBuildState(key, preset) {
    const elements = preset.elements.slice();
    const parent = elements.map((label, index) => {
        const target = preset.parent[label];
        return target !== undefined && elements.includes(target) ? elements.indexOf(target) : index;
    });
    // A preset's sizes are its subtree sizes: every element adds one to each ancestor.
    const size = elements.map(() => 1);
    elements.forEach((unused, index) => {
        let node = index;
        let guard = 0;
        while (parent[node] !== node && guard < elements.length) {
            node = parent[node];
            size[node] += 1;
            guard += 1;
        }
    });
    return {
        preset: key,
        title: preset.title,
        listTitle: preset.listTitle,
        noun: preset.noun,
        answerMode: Boolean(preset.answerMode),
        elements,
        parent,
        size,
        components: parent.filter((p, index) => p === index).length,
        queue: preset.items.map(([op, a, b]) => ({
            op,
            a,
            b,
            label: dsuItemLabel(preset, op, a, b),
            status: "pending"
        })),
        cursor: 0,
        answer: null,
        answerPair: null
    };
}

function dsuPresetState(key) {
    const name = DSU_PRESETS[key] ? key : "redundant";
    return dsuBuildState(name, DSU_PRESETS[name]);
}

// A random tree over 6 to 8 elements plus one extra edge, shuffled: a fresh Redundant Connection.
function dsuRandomState() {
    const n = randomInt(6, 8);
    const elements = Array.from({
        length: n
    }, (unused, index) => String(index + 1));
    const edges = elements.slice(1).map((label, index) => [elements[randomInt(0, index)], label]);
    for (let guard = 0; guard < 20; guard += 1) {
        const a = randomInt(1, n);
        const b = randomInt(1, n);
        if (a !== b && !edges.some(([x, y]) => (x === String(a) && y === String(b)) || (x === String(b) && y === String(a)))) {
            edges.push([String(Math.min(a, b)), String(Math.max(a, b))]);
            break;
        }
    }
    return dsuBuildState("random", {
        title: "Random edges",
        listTitle: "Edges in order",
        noun: "edge",
        answerMode: true,
        elements,
        parent: {},
        items: shuffled(edges).map(([a, b]) => ["union", a, b])
    });
}

function dsuRootOf(work, index) {
    let node = index;
    let guard = 0;
    while (work.parent[node] !== node && guard <= work.parent.length) {
        node = work.parent[node];
        guard += 1;
    }
    return node;
}

function dsuListText(labels) {
    if (labels.length <= 1) return labels.join("");
    return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

function dsuRecorder(work) {
    const frames = [];
    return {
        frames,
        push(focus, caption) {
            frames.push({
                state: cloneInitial(work),
                focus,
                caption
            });
        }
    };
}

// Recursive find, shown as the walk up (one frame per parent read) and then the unwind:
// parent[x] = find(parent[x]) re-points the nodes from the one nearest the root down to x.
function dsuFindFrames(work, rec, x, opText, extra = {}) {
    const L = (index) => work.elements[index];
    const layout = work.parent.slice();
    const path = [x];
    let node = x;
    for (let guard = 0; guard <= work.parent.length; guard += 1) {
        const parent = work.parent[node];
        if (parent === node) {
            rec.push({
                ...extra,
                type: "find-root",
                op: opText,
                path: path.slice(),
                current: node,
                root: node,
                layout,
                read: [node]
            }, path.length === 1 ? `find(${L(x)}): parent[${L(node)}] = ${L(node)}, so ${L(node)} is its own root` : `find(${L(x)}): parent[${L(node)}] = ${L(node)}, so ${L(node)} is the root`);
            break;
        }
        rec.push({
            ...extra,
            type: "find-walk",
            op: opText,
            path: path.slice(),
            current: node,
            layout,
            read: [node]
        }, `find(${L(x)}): parent[${L(node)}] = ${L(parent)}, walk up to ${L(parent)}`);
        node = parent;
        path.push(node);
    }
    const root = node;
    const repointed = [];
    for (let k = path.length - 3; k >= 0; k -= 1) {
        const target = path[k];
        const old = work.parent[target];
        work.parent[target] = root;
        repointed.push(target);
        rec.push({
            ...extra,
            type: "compress",
            op: opText,
            path: path.slice(),
            root,
            layout,
            repointed: repointed.slice(),
            newRepoint: target,
            ghost: [target, old],
            written: [target]
        }, `parent[${L(target)}] = find(${L(old)}) = ${L(root)}, it was ${L(old)}`);
    }
    if (repointed.length) {
        rec.push({
            ...extra,
            type: "compressed",
            op: opText,
            root,
            repointed: repointed.slice(),
            settled: true
        }, `Path compressed: ${dsuListText(repointed.map(L))} now point${repointed.length === 1 ? "s" : ""} straight at ${L(root)}`);
    }
    return {
        root,
        reads: path.length,
        repointed
    };
}

function dsuUnionFrames(work, rec, a, b, opText) {
    const L = (index) => work.elements[index];
    const first = dsuFindFrames(work, rec, a, opText);
    const second = dsuFindFrames(work, rec, b, opText, {
        found: [first.root],
        tags: {
            [first.root]: "ra"
        }
    });
    const reads = first.reads + second.reads;
    if (first.root === second.root) {
        rec.push({
            type: "redundant",
            op: opText,
            root: first.root,
            found: [first.root],
            redundant: [a, b],
            tags: {
                [first.root]: "ra = rb"
            }
        }, `find(${L(a)}) = find(${L(b)}) = ${L(first.root)}: already connected, union returns False`);
        return {
            merged: false,
            root: first.root,
            reads,
            repointed: first.repointed.concat(second.repointed)
        };
    }
    let ra = first.root;
    let rb = second.root;
    const sizeA = work.size[ra];
    const sizeB = work.size[rb];
    const swap = sizeA < sizeB;
    if (swap) [ra, rb] = [rb, ra];
    const compare = swap ?
        `size[${L(first.root)}] = ${sizeA} < size[${L(second.root)}] = ${sizeB}: swap, so the smaller root ${L(rb)} goes under ${L(ra)}` :
        sizeA === sizeB ?
        `size[${L(ra)}] = ${sizeA}, size[${L(rb)}] = ${sizeB}: equal, so ${L(rb)} goes under ${L(ra)}` :
        `size[${L(ra)}] = ${sizeA} > size[${L(rb)}] = ${sizeB}: the smaller root ${L(rb)} goes under ${L(ra)}`;
    rec.push({
        type: "compare",
        op: opText,
        compare: [ra, rb],
        found: [ra, rb],
        tags: {
            [ra]: "ra",
            [rb]: "rb"
        },
        readSize: [ra, rb]
    }, compare);
    const moved = work.parent.map((unused, index) => index).filter((index) => dsuRootOf(work, index) === rb);
    work.parent[rb] = ra;
    work.size[ra] += work.size[rb];
    work.components -= 1;
    rec.push({
        type: "link",
        op: opText,
        link: [rb, ra],
        moved,
        root: ra,
        found: [ra],
        tags: {
            [ra]: "ra",
            [rb]: "rb"
        },
        written: [rb],
        writtenSize: [ra],
        counter: true
    }, `parent[${L(rb)}] = ${L(ra)}, size[${L(ra)}] = ${work.size[ra]}. Components ${work.components + 1} to ${work.components}`);
    return {
        merged: true,
        ra,
        rb,
        swap,
        reads,
        repointed: first.repointed.concat(second.repointed)
    };
}

// Frames for one operation on a copy of `source`. `index` is the queue position for a
// queued item, or null for a command typed into the controls.
function dsuOperationFrames(source, op, aLabel, bLabel, index) {
    const work = cloneInitial(source);
    const rec = dsuRecorder(work);
    const L = (i) => work.elements[i];
    const item = index === null ? null : work.queue[index];
    if (item) item.status = "current";
    const opText = item && op === "union" && work.noun === "edge" ? `union(${aLabel}, ${bLabel})` : op === "makeset" ? `make_set(${aLabel})` : op === "union" || op === "connected" ? `${op}(${aLabel}, ${bLabel})` : `find(${aLabel})`;
    const a = work.elements.indexOf(aLabel);
    const b = work.elements.indexOf(bLabel);
    let outcome;
    let status = "done";

    if (op === "makeset") {
        work.elements.push(aLabel);
        work.parent.push(work.elements.length - 1);
        work.size.push(1);
        work.components += 1;
        const added = work.elements.length - 1;
        rec.push({
            type: "make-set",
            op: opText,
            current: added,
            written: [added],
            writtenSize: [added],
            counter: true
        }, `parent[${aLabel}] = ${aLabel}, size[${aLabel}] = 1: a new group of one. Components ${work.components - 1} to ${work.components}`);
        outcome = {
            tone: "is-success",
            status: "Element added",
            title: `make_set(${aLabel}): ${aLabel} is its own root`,
            detail: `Components ${work.components - 1} to ${work.components}.`,
            returned: aLabel,
            steps: 1,
            trace: `make_set(${aLabel}): new group {${aLabel}}. Components ${work.components}.`
        };
    } else if (op === "find") {
        const result = dsuFindFrames(work, rec, a, opText);
        const compressed = result.repointed.map(L);
        outcome = {
            tone: "is-success",
            status: "Root found",
            title: `find(${aLabel}) = ${L(result.root)}`,
            detail: compressed.length ? `Path compression re-pointed ${dsuListText(compressed)} straight at ${L(result.root)}.` : `${aLabel} was ${result.reads === 1 ? "a root already" : "one step from its root"}: nothing to compress.`,
            returned: L(result.root),
            steps: result.reads,
            trace: compressed.length ? `find(${aLabel}) walked ${result.reads - 1} steps to ${L(result.root)} and re-pointed ${dsuListText(compressed)}.` : `find(${aLabel}) = ${L(result.root)} after ${result.reads} ${result.reads === 1 ? "read" : "reads"}.`
        };
        status = `root ${L(result.root)}`;
    } else if (op === "connected") {
        const first = dsuFindFrames(work, rec, a, opText);
        const second = dsuFindFrames(work, rec, b, opText, {
            found: [first.root],
            tags: {
                [first.root]: "ra"
            }
        });
        const same = first.root === second.root;
        rec.push({
            type: "connected",
            op: opText,
            found: same ? [first.root] : [first.root, second.root],
            tags: same ? {
                [first.root]: "ra = rb"
            } : {
                [first.root]: "ra",
                [second.root]: "rb"
            },
            pair: [a, b],
            connected: same
        }, same ? `find(${aLabel}) = find(${bLabel}) = ${L(first.root)}: connected, True` : `find(${aLabel}) = ${L(first.root)}, find(${bLabel}) = ${L(second.root)}: different roots, False`);
        outcome = {
            tone: same ? "is-success" : "is-info",
            status: same ? "Same group" : "Different groups",
            title: `connected(${aLabel}, ${bLabel}) = ${same ? "True" : "False"}`,
            detail: same ? `Both finds return ${L(first.root)}.` : `find(${aLabel}) = ${L(first.root)} but find(${bLabel}) = ${L(second.root)}.`,
            returned: same ? "True" : "False",
            steps: first.reads + second.reads,
            trace: `connected(${aLabel}, ${bLabel}): roots ${L(first.root)} and ${L(second.root)}, ${same ? "True" : "False"}.`
        };
        status = same ? "True" : "False";
    } else {
        const result = dsuUnionFrames(work, rec, a, b, opText);
        if (result.merged) {
            outcome = {
                tone: "is-success",
                status: "union returned True",
                title: `${opText}: ${L(result.rb)} now hangs under ${L(result.ra)}`,
                detail: `size[${L(result.ra)}] = ${work.size[result.ra]}. Components ${work.components + 1} to ${work.components}.`,
                returned: "True",
                steps: result.reads,
                trace: `${opText}: ${L(result.rb)} hangs under ${L(result.ra)} (size ${work.size[result.ra]}). Components ${work.components}.`
            };
            status = "merged";
        } else {
            const isAnswer = Boolean(item) && work.answerMode && !work.answer;
            const edge = `${aLabel}-${bLabel}`;
            if (isAnswer) {
                work.answer = edge;
                work.answerPair = [a, b];
            }
            outcome = {
                tone: "is-info",
                status: isAnswer ? "Redundant edge found" : "union returned False",
                title: `${opText} returned False: ${aLabel} and ${bLabel} already share root ${L(result.root)}`,
                detail: isAnswer ? `Edge ${edge} closes a cycle, so it is the answer: [${aLabel}, ${bLabel}].` : "Both ends were already in one group, so nothing was merged.",
                returned: "False",
                steps: result.reads,
                trace: isAnswer ? `${opText} returned False: same root ${L(result.root)}. Redundant edge ${edge}.` : `${opText} returned False: same root ${L(result.root)}.`
            };
            status = isAnswer ? "answer" : item && work.answerMode ? "cycle" : "same root";
        }
    }

    const frames = rec.frames;
    const last = frames[frames.length - 1];
    if (item) {
        last.state.queue[index].status = status;
        last.state.cursor = index + 1;
        last.state.answer = work.answer;
        last.state.answerPair = work.answerPair;
        if (last.state.cursor === last.state.queue.length && last.state.answer) {
            outcome.detail += ` All ${last.state.queue.length} ${last.state.noun}s processed; the answer is [${last.state.answer.replace("-", ", ")}].`;
        }
    }
    frames.forEach((frame, position) => {
        frame.index = position + 1;
        frame.total = frames.length;
        frame.operation = DSU_OPERATION_FOR[op];
        frame.opText = opText;
    });
    last.outcome = outcome;
    return frames;
}

function dsuItemFrames(index) {
    const item = state.queue[index];
    return dsuOperationFrames(state, item.op, item.a, item.b, index);
}

/* ---- player ---- */

function dsuInterval() {
    return Math.max(60, Number(animationSpeed.value) || 500);
}

function dsuStopTimer() {
    window.clearTimeout(dsuTimer);
    dsuTimer = 0;
    if (dsuPlaying) {
        dsuPlaying = false;
        dsuSync();
    }
}

function dsuResetPlayer() {
    window.clearTimeout(dsuTimer);
    dsuTimer = 0;
    dsuPlaying = false;
    dsuPending = [];
    dsuFrame = null;
    dsuLastWasCommand = false;
    dsuLastRun = null;
    dsuDepthLevels = 0;
}

function dsuMore() {
    return dsuPending.length > 0 || state.cursor < state.queue.length;
}

function dsuMode() {
    if (dsuPlaying) return "running";
    if (dsuPending.length) return "paused";
    if (!dsuFrame) return "idle";
    if (!dsuLastWasCommand && state.cursor < state.queue.length) return "paused";
    return "done";
}

function dsuBeginNextItem() {
    if (state.cursor >= state.queue.length) return false;
    const frames = dsuItemFrames(state.cursor);
    dsuLastRun = {
        before: cloneInitial(state),
        frames: frames.slice(),
        command: false
    };
    dsuLastWasCommand = false;
    dsuPending = frames;
    return true;
}

function dsuApply(frame) {
    state = cloneInitial(frame.state);
    dsuFrame = frame;
    const opName = STRUCTURES.disjointSet.operations[frame.operation][0];
    if (activeOperation !== frame.operation) setOperation(frame.operation);
    if (frame.index === 1) {
        resultBanner.className = "result-banner is-running";
        resultIcon.innerHTML = '<span aria-hidden="true">&hellip;</span>';
        resultState.textContent = "Operation running";
        resultTitle.textContent = frame.opText;
        resultDetail.textContent = "Follow the highlighted path in the visualization.";
        resultValue.textContent = "pending";
    }
    resultSteps.textContent = `${frame.index} / ${frame.total}`;
    animationStatus.textContent = frame.outcome ? `${opName} complete` : `${opName} - step ${frame.index} of ${frame.total}`;
    if (frame.outcome) dsuShowOutcome(frame);
    render();
}

function dsuShowOutcome(frame) {
    const outcome = frame.outcome;
    resultBanner.className = `result-banner ${outcome.tone}`;
    resultIcon.innerHTML = `<span aria-hidden="true">${outcome.tone === "is-info" ? "!" : "&check;"}</span>`;
    resultState.textContent = outcome.status;
    resultTitle.textContent = outcome.title;
    resultDetail.textContent = outcome.detail;
    resultSteps.textContent = String(outcome.steps);
    resultValue.textContent = outcome.returned;
    dockSummary.textContent = `${outcome.steps} parent ${outcome.steps === 1 ? "read" : "reads"}`;
    if (!dsuReplaying) addTrace(outcome.trace);
    const args = ((frame.opText.match(/\(([^)]*)\)/) || [])[1] || "").split(", ");
    setMetrics(frame.operation, {
        touched: outcome.steps,
        plan: planForOperation(frame.operation, args[0] || "a", args[1] || "b")
    });
}

// One frame forward; a new queued item starts when the previous one has been shown in full.
function dsuStep() {
    if (!dsuPending.length && !dsuBeginNextItem()) {
        dsuSync();
        return false;
    }
    dsuApply(dsuPending.shift());
    if (!dsuPending.length) dsuReplaying = false;
    return true;
}

// Play to the end of the queue, or with `untilItemEnd` to the end of the item on screen
// (or the next one); `items` caps how many queued items are played.
function dsuPlay(untilItemEnd = false, items = Infinity) {
    window.clearTimeout(dsuTimer);
    if (!dsuMore()) {
        dsuSync();
        return false;
    }
    dsuPlaying = true;
    dsuStopAtItemEnd = untilItemEnd;
    dsuItemsLeft = items;
    visualStage.classList.add("is-playing");
    dsuTick();
    return true;
}

function dsuTick() {
    dsuTimer = 0;
    const moved = dsuStep();
    const itemEnded = !dsuPending.length;
    if (moved && itemEnded) dsuItemsLeft -= 1;
    if (!moved || (itemEnded && (dsuStopAtItemEnd || dsuItemsLeft <= 0 || dsuLastWasCommand || state.cursor >= state.queue.length))) {
        dsuPlaying = false;
        dsuSync();
        return;
    }
    dsuSync();
    dsuTimer = window.setTimeout(dsuTick, dsuInterval());
}

// Apply every remaining frame of the item on screen at once (before a typed command).
function dsuFinishPending() {
    if (!dsuPending.length) return;
    const last = dsuPending[dsuPending.length - 1];
    dsuPending = [];
    dsuApply(last);
}

// Apply `count` queued items at once, without animation (URL run=, runItems()).
function dsuRunInstant(count) {
    dsuStopTimer();
    dsuFinishPending();
    let done = 0;
    let last = null;
    while (done < count && state.cursor < state.queue.length) {
        if (last) addTrace(last.outcome.trace);
        const frames = dsuItemFrames(state.cursor);
        last = frames[frames.length - 1];
        state = cloneInitial(last.state);
        done += 1;
    }
    if (last) {
        dsuLastWasCommand = false;
        dsuApply(last);
    }
    return done;
}

function dsuRunCommand(operation) {
    dsuStopTimer();
    dsuFinishPending();
    const op = Object.keys(DSU_OPERATION_FOR).find((key) => DSU_OPERATION_FOR[key] === operation);
    const a = normalizeValue(valueInput.value) || (op === "makeset" ? dsuNextLabel() : "");
    const b = normalizeValue(secondaryInput.value);
    const frames = dsuOperationFrames(state, op, a, b, null);
    dsuLastRun = {
        before: cloneInitial(state),
        frames: frames.slice(),
        command: true
    };
    dsuLastWasCommand = true;
    dsuPending = frames;
    dsuPlay(true);
}

function dsuReplay() {
    if (!dsuLastRun) return;
    dsuStopTimer();
    state = cloneInitial(dsuLastRun.before);
    dsuPending = dsuLastRun.frames.slice();
    dsuLastWasCommand = dsuLastRun.command;
    dsuReplaying = true;
    dsuPlay(true);
}

function dsuNextLabel() {
    const numbers = state.elements.map(Number).filter(Number.isFinite);
    return String((numbers.length ? Math.max(...numbers) : 0) + 1);
}

function dsuLoadPreset(key) {
    if (!DSU_PRESETS[key] && key !== "random") return false;
    if (currentKey !== "disjointSet") {
        currentKey = "disjointSet";
        structureSelect.value = currentKey;
        activeOperation = null;
    }
    if (key === "random") {
        resetState();
        randomizeState();
        return true;
    }
    dsuPresetKey = key;
    resetState();
    return true;
}

function dsuValidate(operation) {
    const a = normalizeValue(valueInput.value);
    const b = normalizeValue(secondaryInput.value);
    const has = (label) => state.elements.includes(label);
    const list = `Elements: ${state.elements.join(", ")}.`;
    if (operation === "remove") {
        if (a && has(a)) return showInputError(primaryField, valueInput, `${a} is already an element.`, "Make set adds a new group of one; leave the field empty for the next number.");
        return true;
    }
    if (!a) return showInputError(primaryField, valueInput, "Enter an element first.", list);
    if (!has(a)) return showInputError(primaryField, valueInput, `${a} is not an element.`, `${list} Use Make set to add a new one.`);
    if (operation === "add" || operation === "special") {
        if (!b) return showInputError(secondaryField, secondaryInput, "Enter the second element.", `${operation === "add" ? "Union" : "Connected"} takes two elements. ${list}`);
        if (!has(b)) return showInputError(secondaryField, secondaryInput, `${b} is not an element.`, `${list} Use Make set to add a new one.`);
    }
    return true;
}

function dsuHandleClick(event) {
    const action = event.target.closest("[data-dsu]");
    if (action) {
        const kind = action.dataset.dsu;
        if (kind === "step") {
            dsuStopTimer();
            dsuStep();
            dsuSync();
        } else if (kind === "next") {
            dsuPlay(true);
        } else if (kind === "play") {
            if (dsuPlaying) dsuStopTimer();
            else dsuPlay(false);
        }
        return true;
    }
    const node = event.target.closest(".dsu-node");
    if (!node) return Boolean(event.target.closest(".dsu-view"));
    selectedRef = {
        kind: "dsu",
        index: Number(node.dataset.index),
        value: node.dataset.value
    };
    valueInput.value = node.dataset.value;
    updateCommandUI();
    render();
    return true;
}

function dsuSelectionLabel(label) {
    const index = state.elements ? state.elements.indexOf(label) : -1;
    if (index < 0) return `element ${label}`;
    const parent = state.parent[index];
    const root = dsuRootOf(state, index);
    const members = state.elements.filter((unused, i) => dsuRootOf(state, i) === root).length;
    return parent === index ?
        `element ${label}: a root, its group has ${members} ${members === 1 ? "element" : "elements"}` :
        `element ${label}: parent ${state.elements[parent]}, root ${state.elements[root]}`;
}

function dsuGroups() {
    const groups = new Map();
    state.elements.forEach((label, index) => {
        const root = dsuRootOf(state, index);
        if (!groups.has(root)) groups.set(root, []);
        groups.get(root).push(label);
    });
    return Array.from(groups.values());
}

function dsuModelHTML() {
    const rows = state.elements.map((label, index) => {
        const root = state.parent[index] === index;
        return `<span class="adj-row"><b>${escapeHTML(label)}:</b> <span>${root ? "root" : `parent ${escapeHTML(state.elements[state.parent[index]])}`}, size ${state.size[index]}</span></span>`;
    }).join("");
    const groups = dsuGroups().map((group) => `{${group.map(escapeHTML).join(", ")}}`).join("  ");
    return `<span class="model-heading">parent and size</span>${rows}` +
        `<span class="model-heading">Groups (${state.components})</span><span class="adj-edges">${groups}</span>`;
}

/* ---- drawing ---- */

// Each group is drawn as a tree, root on top; groups sit side by side, ordered by
// their smallest element so a group keeps its place as it grows.
function dsuForestLayout(parent) {
    const n = parent.length;
    const children = parent.map(() => []);
    const roots = [];
    parent.forEach((p, index) => {
        if (p === index) roots.push(index);
        else if (p >= 0 && p < n) children[p].push(index);
    });
    const smallest = (root) => {
        let min = root;
        const stack = [root];
        while (stack.length) {
            const node = stack.pop();
            min = Math.min(min, node);
            stack.push(...children[node]);
        }
        return min;
    };
    roots.sort((x, y) => smallest(x) - smallest(y));
    const col = new Array(n);
    const depth = new Array(n);
    let cursor = 0;
    let maxDepth = 0;
    const place = (node, d) => {
        depth[node] = d;
        maxDepth = Math.max(maxDepth, d);
        const kids = children[node];
        if (!kids.length || d > n) {
            col[node] = cursor;
            cursor += 1;
            return;
        }
        kids.forEach((kid) => place(kid, d + 1));
        col[node] = (col[kids[0]] + col[kids[kids.length - 1]]) / 2;
    };
    roots.forEach((root, k) => {
        if (k) cursor += 0.5;
        place(root, 0);
    });
    return {
        col,
        depth,
        columns: Math.max(1, cursor),
        maxDepth
    };
}

function dsuArrowHead(tip, ux, uy, size = 9) {
    const bx = tip.x - ux * size;
    const by = tip.y - uy * size;
    const px = -uy * size * 0.5;
    const py = ux * size * 0.5;
    return `<path class="dsu-arrow" d="M${tip.x.toFixed(1)} ${tip.y.toFixed(1)}L${(bx + px).toFixed(1)} ${(by + py).toFixed(1)}L${(bx - px).toFixed(1)} ${(by - py).toFixed(1)}Z" />`;
}

// A parent pointer: from the child's rim to the parent's rim, arrowhead at the parent.
function dsuStraight(from, to, radius, className, data) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy) || 1;
    const ux = dx / length;
    const uy = dy / length;
    const tip = {
        x: to.x - ux * (radius + 2),
        y: to.y - uy * (radius + 2)
    };
    return `<g class="dsu-wire ${className}" ${data}><line x1="${(from.x + ux * radius).toFixed(1)}" y1="${(from.y + uy * radius).toFixed(1)}" x2="${(tip.x - ux * 7).toFixed(1)}" y2="${(tip.y - uy * 7).toFixed(1)}" />${dsuArrowHead(tip, ux, uy)}</g>`;
}

// A bent line, so it never lies on top of a straight parent pointer. Re-pointed
// pointers bow to the left of the chain (or upward for a nearly horizontal pair);
// the redundant edge and a connected() query bow outward: up, or right when vertical.
function dsuCurveGeometry(from, to, bowScale = 1, outer = false) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy) || 1;
    let nx = -dy / length;
    let ny = dx / length;
    const flip = outer ?
        (Math.abs(ny) > 0.2 ? ny > 0 : nx < 0) :
        (Math.abs(nx) > 0.2 ? nx > 0 : ny > 0);
    if (flip) {
        nx = -nx;
        ny = -ny;
    }
    const bow = (24 + length * 0.3) * bowScale;
    return {
        control: {
            x: (from.x + to.x) / 2 + nx * bow,
            y: (from.y + to.y) / 2 + ny * bow
        },
        length
    };
}

function dsuCurve(from, to, radius, className, data, arrow = true, bowScale = 1) {
    const { control } = dsuCurveGeometry(from, to, bowScale, !arrow);
    const sx = control.x - from.x;
    const sy = control.y - from.y;
    const sLength = Math.hypot(sx, sy) || 1;
    const start = {
        x: from.x + (sx / sLength) * radius,
        y: from.y + (sy / sLength) * radius
    };
    const ex = to.x - control.x;
    const ey = to.y - control.y;
    const eLength = Math.hypot(ex, ey) || 1;
    const ux = ex / eLength;
    const uy = ey / eLength;
    const tip = {
        x: to.x - ux * (radius + 2),
        y: to.y - uy * (radius + 2)
    };
    const end = arrow ? {
        x: tip.x - ux * 7,
        y: tip.y - uy * 7
    } : tip;
    return `<g class="dsu-wire ${className}" ${data}><path class="dsu-line" d="M${start.x.toFixed(1)} ${start.y.toFixed(1)}Q${control.x.toFixed(1)} ${control.y.toFixed(1)} ${end.x.toFixed(1)} ${end.y.toFixed(1)}" />${arrow ? dsuArrowHead(tip, ux, uy) : ""}</g>`;
}

function dsuCurveMidpoint(from, to, bowScale = 1) {
    const { control } = dsuCurveGeometry(from, to, bowScale, true);
    return {
        x: 0.25 * from.x + 0.5 * control.x + 0.25 * to.x,
        y: 0.25 * from.y + 0.5 * control.y + 0.25 * to.y
    };
}

function dsuIdleCaption() {
    if (state.queue.length && state.cursor === 0) {
        if (state.noun === "edge") return `${state.elements.length} elements, each its own root. Add the ${state.queue.length} edges in order with Step, Next edge or Play.`;
        return `Queued: ${state.queue.map((item) => item.label).join(", ")}. Press Step, Next operation or Play.`;
    }
    return `${state.elements.length} elements in ${state.components} ${state.components === 1 ? "group" : "groups"}. Run union, find or connected from the controls above.`;
}

function renderDisjointSet() {
    const frame = dsuFrame || {
        focus: {},
        caption: ""
    };
    const focus = frame.focus || {};
    const n = state.elements.length;
    const L = (index) => state.elements[index];
    const layoutParent = focus.layout && focus.layout.length === n ? focus.layout : state.parent;
    const layout = dsuForestLayout(layoutParent);
    dsuDepthLevels = Math.max(dsuDepthLevels, layout.maxDepth);
    const hasQueue = state.queue.length > 0;
    const forestWidth = Math.max(260, Math.round(availableStageWidth() - (hasQueue ? DSU_QUEUE_WIDTH + 20 : 0)));
    const slot = Math.max(46, Math.min(DSU_SLOT, (forestWidth - 36) / layout.columns));
    const radius = Math.round(Math.max(17, Math.min(DSU_RADIUS, slot * 0.3)));
    const top = radius + 36;
    const height = Math.round(top + Math.max(1, dsuDepthLevels) * DSU_LEVEL + radius + 26);
    const offset = (forestWidth - layout.columns * slot) / 2;
    const pos = state.elements.map((unused, index) => ({
        x: offset + ((layout.col[index] ?? layout.columns) + 0.5) * slot,
        y: top + (layout.depth[index] ?? 0) * DSU_LEVEL
    }));

    const path = focus.path || [];
    const walked = new Set();
    const lastOnPath = focus.current !== undefined ? path.indexOf(focus.current) : path.length - 1;
    for (let k = 0; k < Math.max(0, lastOnPath); k += 1) walked.add(`${path[k]}>${path[k + 1]}`);
    const repointed = new Set(focus.repointed || []);
    const moved = new Set(focus.moved || []);
    const found = new Set(focus.found || []);
    if (focus.root !== undefined) found.add(focus.root);
    // The red answer curve belongs to the frame where union returns False; afterwards the
    // answer stays in the Redundant edge stat and the queue, out of the way of new links.
    const redundant = focus.redundant || null;
    const answerPair = redundant ? state.answerPair || null : null;

    const wires = [];
    if (focus.ghost) {
        const [child, old] = focus.ghost;
        wires.push(dsuStraight(pos[child], pos[old], radius, "is-ghost", ""));
    }
    state.parent.forEach((parent, index) => {
        if (parent === index) return;
        const data = `data-edge="${escapeHTML(L(index))}-${escapeHTML(L(parent))}"`;
        if (parent === layoutParent[index]) {
            let className = "";
            if (walked.has(`${index}>${parent}`)) className = "is-walk";
            else if (focus.link && focus.link[0] === index) className = "is-link";
            else if (focus.settled && repointed.has(index)) className = "is-repointed";
            wires.push(dsuStraight(pos[index], pos[parent], radius, className, data));
        } else {
            wires.push(dsuCurve(pos[index], pos[parent], radius, `is-repointed${focus.newRepoint === index ? " is-fresh" : ""}`, data));
        }
    });
    const labels = [];
    const pair = redundant || answerPair;
    if (pair && pair[0] !== pair[1]) {
        const [a, b] = pair;
        const tone = redundant && !(answerPair && answerPair[0] === a && answerPair[1] === b) ? "is-cycle" : "is-answer";
        wires.push(dsuCurve(pos[a], pos[b], radius, `is-redundant ${tone}${redundant ? " is-fresh" : ""}`, `data-edge="${escapeHTML(L(a))}-${escapeHTML(L(b))}"`, false, 1.9));
        const mid = dsuCurveMidpoint(pos[a], pos[b], 1.9);
        labels.push(`<span class="dsu-edge-label ${tone}" style="left:${mid.x.toFixed(1)}px; top:${mid.y.toFixed(1)}px">${tone === "is-answer" ? "answer" : "same root"}</span>`);
    }
    if (focus.pair && focus.type === "connected") {
        const [a, b] = focus.pair;
        if (a !== b) {
            wires.push(dsuCurve(pos[a], pos[b], radius, `is-query ${focus.connected ? "is-yes" : "is-no"}`, "", false, 1.9));
            const mid = dsuCurveMidpoint(pos[a], pos[b], 1.9);
            labels.push(`<span class="dsu-edge-label ${focus.connected ? "is-yes" : "is-no"}" style="left:${mid.x.toFixed(1)}px; top:${mid.y.toFixed(1)}px">${focus.connected ? "connected" : "not connected"}</span>`);
        }
    }

    const nodes = state.elements.map((label, index) => {
        const classes = ["dsu-node"];
        if (state.parent[index] === index) classes.push("is-root");
        if (focus.current === index) classes.push("is-current");
        else if (found.has(index)) classes.push("is-found");
        else if (path.includes(index) && (lastOnPath < 0 || path.indexOf(index) <= lastOnPath)) classes.push("is-path");
        if (focus.newRepoint === index) classes.push("is-repointing");
        if (moved.has(index) && focus.type === "link") classes.push("is-moved");
        if ((redundant && redundant.includes(index)) || (focus.pair && focus.pair.includes(index))) classes.push("is-endpoint");
        if (selectedRef && selectedRef.kind === "dsu" && selectedRef.value === label) classes.push("is-selected");
        const point = pos[index];
        return `<button class="${classes.join(" ")}" data-kind="dsu" data-index="${index}" data-value="${escapeHTML(label)}" style="left:${(point.x - radius).toFixed(1)}px; top:${(point.y - radius).toFixed(1)}px" title="${escapeHTML(dsuSelectionLabel(label))}" type="button"><span>${escapeHTML(label)}</span></button>`;
    }).join("");
    // Above every root: its size, and during union the code's name for it (ra, rb).
    const tags = state.elements.map((label, index) => {
        const point = pos[index];
        const tag = focus.tags && focus.tags[index] ? `<b class="dsu-tag">${escapeHTML(focus.tags[index])}</b>` : "";
        if (state.parent[index] !== index) return tag ? `<span class="dsu-size" style="left:${(point.x + radius + 6).toFixed(1)}px; top:${point.y.toFixed(1)}px; transform:translateY(-50%)">${tag}</span>` : "";
        const compare = focus.compare && focus.compare.includes(index);
        const grown = focus.writtenSize && focus.writtenSize.includes(index) && focus.type === "link";
        return `<span class="dsu-size${compare || grown ? " is-hot" : ""}" style="left:${point.x.toFixed(1)}px; top:${(point.y - radius - 9).toFixed(1)}px">size ${state.size[index]}${tag}</span>`;
    }).join("");

    const cell = (row, classes, text, title = "") => `<span class="dsu-cell ${classes}" data-row="${row}"${title ? ` title="${escapeHTML(title)}"` : ""}>${escapeHTML(text)}</span>`;
    const read = new Set(focus.read || []);
    const written = new Set(focus.written || []);
    const readSize = new Set(focus.readSize || []);
    const writtenSize = new Set(focus.writtenSize || []);
    const arrayRows = [
        `<span class="dsu-row-head">i</span>${state.elements.map((label, index) => cell("i", `is-index${focus.current === index ? " is-current" : ""}`, label)).join("")}`,
        `<span class="dsu-row-head">parent[i]</span>${state.parent.map((parent, index) => cell("parent", [
            parent === index ? "is-self" : "",
            written.has(index) ? "is-written" : read.has(index) ? "is-read" : ""
        ].join(" "), L(parent))).join("")}`,
        `<span class="dsu-row-head">size[i]</span>${state.size.map((size, index) => cell("size", [
            state.parent[index] === index ? "" : "is-stale",
            writtenSize.has(index) ? "is-written" : readSize.has(index) ? "is-read" : ""
        ].join(" "), String(size), state.parent[index] === index ? "" : "Only read at a root")).join("")}`
    ].join("");

    const queue = hasQueue ? `<aside class="dsu-queue" aria-label="${escapeHTML(state.listTitle)}">
            <h4>${escapeHTML(state.listTitle)}</h4>
            <ol>${state.queue.map((item, index) => {
                const status = item.status === "pending" ? "" : item.status === "current" ? "now" : item.status;
                const tone = item.status === "pending" ? "is-pending" : item.status === "current" ? "is-current" : item.status === "merged" ? "is-merged" : item.status === "answer" ? "is-answer" : item.status === "cycle" ? "is-cycle" : "is-done";
                return `<li class="${tone}" data-item="${index}"><code>${escapeHTML(item.label)}</code><em>${escapeHTML(status)}</em></li>`;
            }).join("")}</ol>
        </aside>` : "";

    const counterHot = focus.counter ? " is-hot" : "";
    const caption = dsuFrame ? `<code>${escapeHTML(dsuFrame.opText || "")}</code><span>${escapeHTML(dsuFrame.caption)}</span>` : `<code>${escapeHTML(state.title)}</code><span>${escapeHTML(dsuIdleCaption())}</span>`;
    const stats = `<div class="dsu-stat${counterHot}"><span>Components</span><strong id="dsu-components">${state.components}</strong></div>` +
        (state.answer ? `<div class="dsu-stat is-answer"><span>Redundant edge</span><strong>${escapeHTML(state.answer)}</strong></div>` : "");
    const body = `<div class="dsu-forest" style="width:${forestWidth}px; height:${height}px; --dsu-node:${radius * 2}px">
                <svg class="dsu-wires" width="${forestWidth}" height="${height}" viewBox="0 0 ${forestWidth} ${height}" aria-hidden="true">${wires.join("")}</svg>
                ${nodes}${tags}${labels.join("")}
            </div>${queue}`;

    // The controls are built once and kept across frames, so a click on Pause or Step
    // never lands on a button that the next frame has just replaced.
    let view = visual.querySelector(".dsu-view");
    if (!view) {
        visual.innerHTML = `<div class="dsu-view">
        <div class="dsu-head">
            <div class="dsu-stats"></div>
            <div class="dsu-controls">
                <label class="dsu-preset-field"><span>Preset</span><select class="dsu-preset" aria-label="Disjoint Set preset"></select></label>
                <button class="dsu-button" data-dsu="step" type="button">Step</button>
                <button class="dsu-button" data-dsu="next" type="button">Next</button>
                <button class="dsu-button is-primary" data-dsu="play" type="button">Play</button>
            </div>
        </div>
        <p class="dsu-caption"></p>
        <div class="dsu-body"></div>
        <div class="dsu-array" aria-label="Parent and size arrays"></div>
        <div class="dsu-legend" aria-hidden="true">
            <span><i class="sw-root"></i>root</span>
            <span><i class="sw-current"></i>find is here</span>
            <span><i class="sw-path"></i>path walked</span>
            <span><i class="sw-found"></i>root found</span>
            <span><i class="sw-repointed"></i>re-pointed at the root</span>
            <span><i class="sw-link"></i>new link</span>
            <span><i class="sw-answer"></i>redundant edge</span>
        </div>
    </div>`;
        view = visual.querySelector(".dsu-view");
    }
    const select = view.querySelector(".dsu-preset");
    const presetKeys = Object.keys(DSU_PRESETS).concat(["random"]);
    if (select.options.length !== presetKeys.length) {
        select.innerHTML = presetKeys.map((key) => `<option value="${key}">${escapeHTML(DSU_PRESETS[key] ? DSU_PRESETS[key].title : "Random edges")}</option>`).join("");
    }
    if (select.value !== state.preset) select.value = state.preset;
    view.querySelector(".dsu-stats").innerHTML = stats;
    const captionNode = view.querySelector(".dsu-caption");
    captionNode.className = `dsu-caption${focus.type === "redundant" ? " is-answer" : ""}`;
    captionNode.innerHTML = caption;
    view.querySelector(".dsu-body").innerHTML = body;
    const array = view.querySelector(".dsu-array");
    array.style.setProperty("--dsu-cols", String(n));
    array.innerHTML = arrayRows;
    view.querySelector('[data-dsu="next"]').textContent = `Next ${state.noun || "operation"}`;
    dsuSync();
}

function dsuAttributes() {
    const focus = dsuFrame ? dsuFrame.focus : {};
    return {
        state: dsuMode(),
        components: String(state.components),
        cursor: String(state.cursor),
        total: String(state.queue.length),
        answer: state.answer || "",
        frame: focus.type || "",
        preset: state.preset || ""
    };
}

function dsuSync() {
    if (STRUCTURES[currentKey].kind !== "dsu" || !state || !state.elements) return;
    const attributes = dsuAttributes();
    const view = visual.querySelector(".dsu-view");
    Object.entries(attributes).forEach(([key, value]) => {
        visual.dataset[key] = value;
        if (view) view.dataset[key] = value;
    });
    visualStage.classList.toggle("is-playing", dsuPlaying);
    if (!view) return;
    const more = dsuMore();
    const play = view.querySelector('[data-dsu="play"]');
    if (play) {
        play.textContent = dsuPlaying ? "Pause" : "Play";
        play.disabled = !(more || dsuPlaying);
    }
    view.querySelectorAll('[data-dsu="step"], [data-dsu="next"]').forEach((button) => {
        button.disabled = !more;
    });
}

function dsuClearAttributes() {
    ["state", "components", "cursor", "total", "answer", "frame", "preset"].forEach((key) => {
        delete visual.dataset[key];
    });
}

function dsuSnapshot() {
    if (STRUCTURES[currentKey].kind !== "dsu") return null;
    const L = (index) => state.elements[index];
    const focus = dsuFrame ? dsuFrame.focus : null;
    const list = (value) => (value || []).map(L);
    return {
        state: dsuMode(),
        preset: state.preset,
        elements: state.elements.slice(),
        parent: state.parent.map(L),
        size: state.size.slice(),
        roots: state.elements.filter((unused, index) => state.parent[index] === index),
        components: state.components,
        queue: state.queue.map((item) => ({
            label: item.label,
            op: item.op,
            status: item.status
        })),
        cursor: state.cursor,
        answer: state.answer,
        pendingFrames: dsuPending.length,
        frame: focus ? {
            type: focus.type,
            op: dsuFrame.opText,
            caption: dsuFrame.caption,
            index: dsuFrame.index,
            total: dsuFrame.total,
            path: list(focus.path),
            current: focus.current !== undefined ? L(focus.current) : null,
            root: focus.root !== undefined ? L(focus.root) : null,
            repointed: list(focus.repointed),
            link: focus.link ? list(focus.link) : null,
            compare: focus.compare ? list(focus.compare) : null,
            redundant: focus.redundant ? list(focus.redundant) : null
        } : null
    };
}

function escapeHTML(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function selectRenderedItem(target) {
    const item = target.closest(".selectable");
    if (!item) return;
    const kind = item.dataset.kind;
    if (kind === "trie") {
        selectedRef = {
            kind: "trie",
            index: Number(item.dataset.index),
            value: item.dataset.value
        };
    } else if (kind === "graph") {
        selectedRef = {
            kind: "graph",
            index: Number(item.dataset.index),
            value: item.dataset.value
        };
    } else if (kind === "map") {
        selectedRef = {
            kind: "map",
            index: Number(item.dataset.index),
            key: item.dataset.key,
            value: item.dataset.value
        };
    } else {
        selectedRef = {
            kind: "linear",
            index: Number(item.dataset.index),
            value: item.dataset.value
        };
    }
    addTrace(`Selected ${selectionLabel(selectedRef)}.`);
    render();
}

function updateSelected() {
    if (!selectedRef || selectedRef.kind === "dsu") return;
    const nextValue = typedInputValue(editValueInput.value);
    const nextSecondary = typedOptionalValue(editSecondaryInput.value);

    if (selectedRef.kind === "graph") {
        const oldValue = selectedRef.value;
        const newValue = nextValue.toUpperCase();
        if (!newValue) return;
        state.nodes = state.nodes.map((node) => node === oldValue ? newValue : node);
        state.edges = state.edges.map((edge) => edge.map((node) => node === oldValue ? newValue : node));
        selectedRef = {
            kind: "graph",
            index: state.nodes.indexOf(newValue),
            value: newValue
        };
        addTrace(`Renamed vertex ${oldValue} to ${newValue}.`);
    } else if (selectedRef.kind === "map") {
        const entry = state.find((item) => item.key === selectedRef.key);
        if (!entry) return;
        entry.key = nextValue;
        entry.value = nextSecondary || entry.value;
        selectedRef = {
            kind: "map",
            key: entry.key,
            value: entry.value
        };
        addTrace(`Updated map entry ${entry.key}.`);
    } else if (selectedRef.kind === "trie") {
        const oldWord = state.find((word) => String(word).startsWith(selectedRef.value));
        if (!oldWord || !nextValue) return;
        state = state.map((word) => word === oldWord ? nextValue.toLowerCase() : word);
        selectedRef = {
            kind: "trie",
            value: nextValue.toLowerCase()
        };
        addTrace(`Changed trie word ${oldWord} to ${nextValue.toLowerCase()}.`);
    } else if (Number.isInteger(selectedRef.index) && selectedRef.index >= 0 && selectedRef.index < state.length) {
        state[selectedRef.index] = nextValue;
        if (currentKey === "heap") heapifyState();
        selectedRef.value = nextValue;
        addTrace(`Changed item ${selectedRef.index} to ${nextValue}.`);
    }

    setHighlight({
        value: nextValue,
        index: selectedRef.index,
        mode: "hit"
    });
    setMetrics("special", {
        primary: nextValue,
        secondary: nextSecondary,
        touched: 1,
        plan: ["Locate the selected visual element.", "Replace the stored value.", "Re-render the structure and type metadata."]
    });
    render();
}

structureSelect.innerHTML = Object.entries(STRUCTURES).map(([key, config]) => `<option value="${key}">${config.name}</option>`).join("");

structureSelect.addEventListener("change", () => {
    currentKey = structureSelect.value;
    activeOperation = null;
    resetState();
});

operationButtons.forEach((button) => {
    button.addEventListener("click", () => setOperation(button.dataset.operation));
});

executeOperationButton.addEventListener("click", () => performOperation(activeOperation || "search"));
if (traversalSelect) traversalSelect.addEventListener("change", () => {
    updateCommandUI();
    renderComplexity();
});
[valueInput, secondaryInput].forEach((input) => {
    input.addEventListener("input", () => {
        input.closest("label")?.classList.remove("is-invalid");
        input.removeAttribute("aria-invalid");
        updateCommandUI();
    });
    input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") performOperation(activeOperation || "search");
    });
});

replayAnimationButton.addEventListener("click", () => {
    if (STRUCTURES[currentKey].kind === "dsu") {
        dsuReplay();
        return;
    }
    const targets = animationTargets();
    lastAnimationTargets = targets;
    animateTargets(targets, lastMetrics.label);
});

let resizeTimer = 0;
window.addEventListener("resize", () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(render, 150);
});
randomizeButton.addEventListener("click", randomizeState);
resetButton.addEventListener("click", resetState);
visual.addEventListener("click", (event) => {
    if (STRUCTURES[currentKey].kind === "dsu" && dsuHandleClick(event)) return;
    selectRenderedItem(event.target);
});
visual.addEventListener("change", (event) => {
    if (event.target.matches(".dsu-preset")) dsuLoadPreset(event.target.value);
});
updateSelectedButton.addEventListener("click", updateSelected);
clearSelectedButton.addEventListener("click", () => {
    selectedRef = null;
    render();
});

/* ---- URL setup and the recorder API (see the comment at the top of this file) ---- */

const STRUCTURE_ALIASES = {
    dsu: "disjointSet",
    unionfind: "disjointSet",
    disjointset: "disjointSet",
    disjointsetunion: "disjointSet",
    linkedlist: "linkedList",
    list: "linkedList",
    hashtable: "hashTable",
    hash: "hashTable",
    binarysearchtree: "bst"
};

function resolveStructureKey(raw) {
    const wanted = String(raw || "").toLowerCase().replace(/[^a-z]/g, "");
    if (!wanted) return null;
    if (STRUCTURE_ALIASES[wanted]) return STRUCTURE_ALIASES[wanted];
    return Object.keys(STRUCTURES).find((key) => key.toLowerCase() === wanted || STRUCTURES[key].name.toLowerCase().replace(/[^a-z]/g, "") === wanted) || null;
}

function setAnimationSpeed(raw) {
    const named = {
        slow: "850",
        normal: "500",
        fast: "260"
    };
    const value = named[String(raw).toLowerCase()] || (Number(raw) > 0 ? String(Math.round(Number(raw))) : null);
    if (!value) return;
    if (!Array.from(animationSpeed.options).some((option) => option.value === value)) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = `${value} ms`;
        animationSpeed.appendChild(option);
    }
    animationSpeed.value = value;
}

const OPERATION_ALIASES = {
    union: "add",
    find: "search",
    makeset: "remove",
    connected: "special",
    add: "add",
    search: "search",
    remove: "remove",
    special: "special"
};

function applyUrlSetup() {
    const params = new URLSearchParams(window.location.search);
    const key = resolveStructureKey(params.get("structure") || params.get("ds"));
    if (key) {
        currentKey = key;
        structureSelect.value = key;
    }
    if (params.has("speed")) setAnimationSpeed(params.get("speed"));
    const presetName = (params.get("preset") || "").toLowerCase();
    if (STRUCTURES[currentKey].kind === "dsu" && DSU_PRESETS[presetName]) dsuPresetKey = presetName;
    resetState();
    if (STRUCTURES[currentKey].kind === "dsu" && presetName === "random") randomizeState();
    const operation = OPERATION_ALIASES[(params.get("op") || "").toLowerCase().replace(/[^a-z]/g, "")];
    if (operation) setOperation(operation);
    if (params.has("a")) valueInput.value = params.get("a");
    if (params.has("b")) secondaryInput.value = params.get("b");
    if (operation || params.has("a") || params.has("b")) updateCommandUI();
    if (STRUCTURES[currentKey].kind !== "dsu") return;
    const run = params.get("run");
    if (run) dsuRunInstant(run === "all" ? Infinity : Math.max(0, Number(run) || 0));
    const steps = Math.max(0, Number(params.get("step")) || 0);
    for (let k = 0; k < steps; k += 1) {
        if (!dsuStep()) break;
    }
    const play = (params.get("play") || "").toLowerCase();
    if (play === "item" || play === "next") dsuPlay(true);
    else if (play === "all") dsuPlay(false);
    else if (Number(play) > 0) dsuPlay(false, Number(play));
}

// For recorders and tests. Every call returns the snapshot afterwards.
window.DisjointSetLab = {
    load(preset = "redundant") {
        dsuLoadPreset(preset);
        return dsuSnapshot();
    },
    step() {
        if (STRUCTURES[currentKey].kind !== "dsu") return null;
        dsuStopTimer();
        dsuStep();
        dsuSync();
        return dsuSnapshot();
    },
    next() {
        if (STRUCTURES[currentKey].kind === "dsu") dsuPlay(true);
        return dsuSnapshot();
    },
    play(items = Infinity) {
        if (STRUCTURES[currentKey].kind === "dsu") dsuPlay(false, items);
        return dsuSnapshot();
    },
    pause() {
        dsuStopTimer();
        return dsuSnapshot();
    },
    runItems(count = Infinity) {
        if (STRUCTURES[currentKey].kind === "dsu") dsuRunInstant(count);
        return dsuSnapshot();
    },
    snapshot: () => dsuSnapshot()
};

applyUrlSetup();
