"use strict";

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

let animationRun = 0;
let lastAnimationTargets = [];
let lastOutcome = null;

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
        secondaryLabel: "End",
        specialLabel: "Pop front",
        operations: {
            add: ["Push back", "O(1)", "O(1)", "O(1)", "Add on either end in a proper deque."],
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
        specialLabel: "Rehash",
        operations: {
            add: ["Insert", "O(1)", "O(1)", "O(n)", "Worst case is many collisions."],
            search: ["Lookup", "O(1)", "O(1)", "O(n)", "Hash then scan one bucket."],
            remove: ["Delete", "O(1)", "O(1)", "O(n)", "Same path as lookup."],
            special: ["Rehash", "O(n)", "O(n)", "O(n)", "Move entries into a new bucket array."]
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
            edges: [["A", "B"], ["A", "C"], ["B", "D"], ["C", "E"], ["D", "F"]]
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

function hashValue(value, bucketCount) {
    const text = String(value);
    let hash = 0;
    for (let i = 0; i < text.length; i += 1) {
        hash = (hash * 31 + text.charCodeAt(i)) % 9973;
    }
    return hash % bucketCount;
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

function addTrace(message) {
    trace.unshift(message);
    trace = trace.slice(0, 8);
}

function operationConfig(operation) {
    return STRUCTURES[currentKey].operations[operation] || STRUCTURES[currentKey].operations.add;
}

function structureSize() {
    const config = STRUCTURES[currentKey];
    return config.kind === "graph" ? state.nodes.length : state.length;
}

function estimatedTouched(operation, detail = {}) {
    const n = Math.max(1, structureSize());
    if (detail.touched !== undefined) return detail.touched;
    if (["stack", "queue"].includes(currentKey) && operation !== "search") return Math.min(1, n);
    if (currentKey === "array" && ["add", "special"].includes(operation)) return Math.min(1, n);
    if (currentKey === "deque" && ["add", "special"].includes(operation)) return Math.min(1, n);
    if (["hashTable", "set", "map"].includes(currentKey)) return Math.max(1, Math.ceil(n / 4));
    if (["bst", "heap"].includes(currentKey) && operation !== "search") return Math.max(1, Math.ceil(Math.log2(n + 1)));
    if (currentKey === "trie") return Math.max(1, String(valueInput.value || "").length || 1);
    if (currentKey === "graph") return operation === "search" || operation === "remove" ? n : 1;
    return operation === "add" ? 1 : n;
}

function planForOperation(operation, primary, secondary) {
    const config = STRUCTURES[currentKey];
    const opName = operationConfig(operation)[0];
    if (config.kind === "graph") {
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
    if (currentKey === "linkedList") return ["Start at head.", "Follow next pointers in order.", `${opName} when the target node is reached.`];
    return [`Use the ${config.name} access rule.`, `${opName} ${primary}.`, "Update the visible model and cost counters."];
}

function setMetrics(operation, detail = {}) {
    const op = operationConfig(operation);
    lastMetrics = {
        label: op[0],
        touched: estimatedTouched(operation, detail),
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
    state = cloneInitial(config.initial);
    trace = [`Loaded ${config.name}.`];
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

function randomizeState() {
    cancelAnimation();
    const config = STRUCTURES[currentKey];
    const pool = config.sampleValues.concat(["11", "22", "33", "44", "55", "K", "M", "P"]);
    if (config.kind === "graph") {
        const nodes = pool.slice(0, 6).map((value, index) => String.fromCharCode(65 + index));
        state = {
            nodes,
            edges: nodes.slice(1).map((node, index) => [nodes[Math.max(0, index - 1)], node])
        };
    } else if (currentKey === "map") {
        state = pool.slice(0, 5).map((key, index) => ({
            key,
            value: String((index + 1) * 10)
        }));
    } else {
        state = pool.slice(0, 6);
        if (config.kind === "heap") {
            heapifyState();
        }
    }
    addTrace(`Randomized ${config.name}.`);
    setHighlight({});
    selectedRef = null;
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
        special: currentKey === "array" ? "Fallback value" : capitalized
    };
    valueLabel.textContent = labels[operation];
    secondaryLabel.textContent = currentKey === "array" && operation === "special" ? "Index to access" : currentKey === "graph" && operation === "special" ? "Connect to vertex" : currentKey === "map" && operation === "add" ? "Value to store" : config.secondaryLabel;
    const needsSecondary = (currentKey === "array" && operation === "special") || (currentKey === "graph" && operation === "special") || (currentKey === "map" && operation === "add");
    secondaryField.classList.toggle("is-required", needsSecondary);
    secondaryField.classList.toggle("is-muted", !needsSecondary);
    primaryField.classList.toggle("is-muted", ["stack", "queue"].includes(currentKey) && ["remove", "special"].includes(operation));
    executeOperationButton.querySelector("span").textContent = `Run ${op[0].toLowerCase()}`;
    dockOperation.textContent = op[0];
    const primary = valueInput.value || "value";
    const secondary = secondaryInput.value || config.secondaryLabel.toLowerCase();
    const args = needsSecondary ? `${primary}, ${secondary}` : primary;
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
        return { name, detail };
    }
    if (config.kind === "graph") {
        const algorithms = {
            add: ["Adjacency-list vertex insertion", "Create a vertex and an empty neighbor list in constant time."],
            search: ["Breadth-first search (BFS)", "Use a FIFO frontier and visit every reachable vertex level by level until the target is found."],
            remove: ["Adjacency-list vertex deletion", "Remove the vertex, then scan all adjacency lists to remove incident edges."],
            special: ["Undirected adjacency-list edge insertion", "Add each endpoint to the other endpoint's neighbor list after checking for a duplicate edge."]
        };
        const [name, detail] = algorithms[operation];
        return { name, detail };
    }
    if (config.kind === "heap") {
        const algorithms = {
            add: ["Min-heap bubble-up", "Append at the end, then swap with the parent while the new key is smaller."],
            search: ["Linear heap scan", "A heap only orders parents against children, so arbitrary-value search checks the backing array sequentially."],
            remove: ["Swap, then restore heap order", "Replace the removed slot with the last item, then bubble up or sink down as required."],
            special: ["Extract-min with sink-down", "Remove the root, move the final item to the root, then swap with the smaller child until ordered."]
        };
        const [name, detail] = algorithms[operation];
        return { name, detail };
    }
    if (config.kind === "trie") return { name: operation === "special" ? "Prefix walk with depth-first collection" : "Character-by-character trie walk", detail: "Follow one child edge per character; no unrelated branch is inspected." };
    if (config.kind === "buckets") return { name: "Polynomial hash with separate chaining", detail: "Compute a bucket index with a base-31 string hash, then scan only that bucket's collision chain." };
    if (config.kind === "list") return { name: operation === "add" ? "Tail-pointer append" : "Forward pointer traversal", detail: operation === "add" ? "Link the current tail to a new node and move the tail pointer." : "Start at head and follow next pointers until the value is found or the list ends." };
    if (config.kind === "array") return { name: operation === "special" ? "Direct indexed access" : operation === "add" ? "Dynamic-array append" : "Linear scan", detail: operation === "special" ? "Calculate the slot address directly from its zero-based index." : operation === "add" ? "Write after the final element; resize and copy only when capacity is exhausted." : "Compare values from index 0 onward and stop at the first match." };
    if (config.kind === "stack") return { name: operation === "search" ? "Linear stack scan" : "LIFO top operation", detail: operation === "search" ? "Inspect items sequentially; stacks provide no fast arbitrary lookup." : "Read, add, or remove only at the top of the stack." };
    if (["queue", "deque"].includes(config.kind)) return { name: operation === "search" ? "Linear queue scan" : "Constant-time endpoint operation", detail: operation === "search" ? "Inspect queued items from front to back." : "Use the front or back pointer without scanning middle items." };
    return { name: config.operations[operation][0], detail: config.operations[operation][4] };
}

function showIdleResult() {
    lastOutcome = null;
    resultBanner.className = "result-banner is-idle";
    resultState.textContent = "No operation run yet";
    resultTitle.textContent = "Select an operation and provide its input.";
    resultDetail.textContent = "The output and cost will appear here.";
    resultSteps.textContent = "-";
    resultValue.textContent = "-";
    dockSummary.textContent = "No comparisons yet";
}

function renderComplexity() {
    const operations = STRUCTURES[currentKey].operations;
    complexityList.innerHTML = Object.entries(operations).map(([key, op]) => `
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
        .filter(([, config]) => config.operations[operation])
        .map(([key, config]) => {
            const growth = config.operations[operation][2];
            return {
                key,
                name: config.name,
                growth,
                score: complexityWeight(growth, n)
            };
        })
        .sort((a, b) => a.score - b.score)
        .slice(0, 6);
    const maxScore = Math.max(...rows.map((row) => row.score), 1);
    comparisonList.innerHTML = rows.map((row) => `
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
    showRunningResult(lastOutcome);
    render();
    await playOperationAnimation(operation);
    showCompletedResult(lastOutcome);
}

function buildOutcome(operation, requestedValue, beforeSize) {
    const afterSize = structureSize();
    const found = highlight.mode === "hit";
    let success = true;
    let title = trace[0] || `${operationConfig(operation)[0]} completed.`;
    let returned = "void";
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
        returned = highlight.value ?? (highlight.index !== undefined ? state[highlight.index] : "complete");
    }
    const status = success ? "Operation succeeded" : operation === "add" ? "No change needed" : "Operation finished: no match";
    return { success, status, title, returned: String(returned ?? "null"), detail: operationConfig(operation)[4], steps: lastMetrics.touched };
}

function showRunningResult(outcome) {
    resultBanner.className = "result-banner is-running";
    resultState.textContent = "Operation running";
    resultTitle.textContent = outcome.title;
    resultDetail.textContent = "Follow the highlighted path in the visualization.";
    resultSteps.textContent = `0 / ${outcome.steps}`;
    resultValue.textContent = "pending";
}

function showCompletedResult(outcome) {
    if (!outcome) return;
    resultBanner.className = `result-banner ${outcome.success ? "is-success" : "is-failure"}`;
    resultState.textContent = outcome.status;
    resultTitle.textContent = outcome.title;
    resultDetail.textContent = outcome.detail;
    resultSteps.textContent = String(outcome.steps);
    resultValue.textContent = outcome.returned;
    dockSummary.textContent = `${outcome.steps} ${outcome.steps === 1 ? "step" : "steps"} performed`;
}

function cancelAnimation() {
    animationRun += 1;
    visualStage.classList.remove("is-playing", "is-starting", "is-finishing");
    animationStatus.textContent = "Ready";
    comparisonBubble.hidden = true;
    operationButtons.forEach((button) => { button.disabled = false; });
}

function animationTargets() {
    const selectable = Array.from(visual.querySelectorAll(".selectable"));
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
    const exact = selectable.filter((node) => {
        if (highlight.index !== undefined && Number(node.dataset.index) === highlight.index) return true;
        return highlight.value !== undefined && String(node.dataset.value) === String(highlight.value);
    });
    return exact.length ? exact : selectable.slice(0, Math.min(lastMetrics.touched, selectable.length));
}

function delay(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function animateTargets(targets, label) {
    if (!targets.length || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const run = ++animationRun;
    const interval = Number(animationSpeed.value) || 500;
    visualStage.classList.remove("is-finishing");
    visualStage.classList.add("is-playing", "is-starting");
    comparisonBubble.hidden = false;
    comparisonBubble.textContent = `${label} starting`;
    operationButtons.forEach((button) => { button.disabled = true; });
    targets.forEach((node) => node.classList.remove("animation-focus", "animation-done", "animation-result"));
    await delay(Math.min(420, Math.max(220, interval * 0.55)));
    visualStage.classList.remove("is-starting");

    for (let index = 0; index < targets.length; index += 1) {
        if (run !== animationRun) return;
        if (index > 0) {
            targets[index - 1].classList.remove("animation-focus");
            targets[index - 1].classList.add("animation-done");
        }
        targets[index].classList.add("animation-focus");
        animationStatus.textContent = `${label} - step ${index + 1} of ${targets.length}`;
        comparisonBubble.textContent = `Inspecting ${targets[index].dataset.value || `node ${index + 1}`}`;
        resultSteps.textContent = `${index + 1} / ${targets.length}`;
        targets[index].scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
        await delay(interval);
    }

    if (run !== animationRun) return;
    const result = targets[targets.length - 1];
    result.classList.remove("animation-focus");
    result.classList.add("animation-result");
    visualStage.classList.remove("is-playing");
    visualStage.classList.add("is-finishing");
    comparisonBubble.textContent = lastOutcome && lastOutcome.success ? "Match confirmed" : "Traversal complete";
    await delay(Math.min(300, interval));
    comparisonBubble.hidden = true;
    await delay(420);
    visualStage.classList.remove("is-finishing");
    animationStatus.textContent = `${label} complete`;
    operationButtons.forEach((button) => { button.disabled = false; });
}

async function playOperationAnimation(operation) {
    lastAnimationTargets = animationTargets();
    await animateTargets(lastAnimationTargets, operationConfig(operation)[0]);
}

function bstPath(value) {
    const target = numericValue(value);
    const path = [];
    let node = buildBST(state);
    while (node) {
        path.push(String(node.value));
        if (numericValue(node.value) === target) break;
        node = target < numericValue(node.value) ? node.left : node.right;
    }
    return path;
}

function deleteBSTNode(node, target) {
    if (!node) return null;
    const nodeValue = numericValue(node.value);
    if (target < nodeValue) node.left = deleteBSTNode(node.left, target);
    else if (target > nodeValue) node.right = deleteBSTNode(node.right, target);
    else {
        if (!node.left) return node.right;
        if (!node.right) return node.left;
        let successor = node.right;
        while (successor.left) successor = successor.left;
        node.value = successor.value;
        node.right = deleteBSTNode(node.right, numericValue(successor.value));
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

function performBSTOperation(operation) {
    const value = getPrimaryValue();
    const path = bstPath(value);
    const exists = state.some((item) => String(item) === value);

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
        if (exists) state = bstPreorder(deleteBSTNode(buildBST(state), numericValue(value)));
        addTrace(exists ? `Deleted ${value} using the in-order successor rule.` : `${value} was not present.`);
        setHighlight({
            value,
            mode: "remove",
            scan: path
        });
        setMetrics(operation, {
            primary: value,
            touched: Math.max(1, path.length)
        });
    } else {
        const sorted = state.slice().sort((a, b) => numericValue(a) - numericValue(b));
        addTrace(`In-order traversal: ${sorted.join(", ")}.`);
        setHighlight({
            mode: "scan",
            scan: sorted
        });
        setMetrics(operation, {
            primary: value,
            touched: state.length
        });
    }
}

function performLinearOperation(operation) {
    const value = getPrimaryValue();
    const config = STRUCTURES[currentKey];
    const secondary = getSecondaryValue();

    if (operation === "add") {
        state.push(value);
        addTrace(`${config.operations.add[0]} ${value}.`);
        setHighlight({
            value,
            mode: "new"
        });
        setMetrics(operation, {
            primary: value,
            secondary,
            touched: currentKey === "linkedList" ? Math.max(1, state.length) : 1
        });
        return;
    }

    if (operation === "search") {
        const index = state.findIndex((item) => String(item) === value);
        addTrace(index >= 0 ? `Found ${value} at position ${index}.` : `${value} was not found.`);
        setHighlight({
            value,
            mode: index >= 0 ? "hit" : "scan",
            scan: state.map(String)
        });
        setMetrics(operation, {
            primary: value,
            secondary,
            touched: index >= 0 ? index + 1 : state.length
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
        if (index >= 0) {
            state.splice(index, 1);
            addTrace(`Removed ${value}.`);
            setHighlight({
                value,
                mode: "remove"
            });
        } else {
            addTrace(`${value} was not present.`);
            setHighlight({
                value,
                mode: "scan",
                scan: state.map(String)
            });
        }
        setMetrics(operation, {
            primary: value,
            secondary,
            touched: index >= 0 ? index + 1 : state.length
        });
        return;
    }

    if (currentKey === "array") {
        const index = Number.parseInt(secondary || value, 10);
        const safeIndex = Number.isInteger(index) ? Math.max(0, Math.min(index, state.length - 1)) : 0;
        addTrace(state.length ? `Accessed index ${safeIndex}: ${state[safeIndex]}.` : "Array is empty.");
        setHighlight({
            index: safeIndex,
            mode: "hit"
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
            mode: "remove"
        });
        setMetrics(operation, {
            primary: removed,
            secondary,
            touched: removed === undefined ? 0 : 1
        });
    } else {
        const item = state[0];
        addTrace(item === undefined ? `${config.name} is empty.` : `${config.specialLabel}: ${item}.`);
        setHighlight({
            index: 0,
            mode: "hit"
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
    const bucketCount = currentKey === "hashTable" ? 7 : 6;
    const bucketSize = state.filter((item) => hashValue(entryKey(item), bucketCount) === hashValue(value, bucketCount)).length;

    if (operation === "add") {
        if (!exists) {
            state.push(value);
            addTrace(`Added ${value}.`);
        } else {
            addTrace(`${value} already exists.`);
        }
        setHighlight({
            value,
            mode: exists ? "hit" : "new"
        });
        setMetrics(operation, {
            primary: value,
            touched: Math.max(1, bucketSize)
        });
    } else if (operation === "search") {
        addTrace(exists ? `${value} is present.` : `${value} is absent.`);
        setHighlight({
            value,
            mode: exists ? "hit" : "scan"
        });
        setMetrics(operation, {
            primary: value,
            touched: Math.max(1, bucketSize)
        });
    } else if (operation === "remove") {
        state = state.filter((item) => String(item) !== value);
        addTrace(exists ? `Deleted ${value}.` : `${value} was not present.`);
        setHighlight({
            value,
            mode: "remove"
        });
        setMetrics(operation, {
            primary: value,
            touched: Math.max(1, bucketSize)
        });
    } else if (currentKey === "set") {
        if (exists) {
            state = state.filter((item) => String(item) !== value);
            addTrace(`Toggled ${value} off.`);
            setHighlight({
                value,
                mode: "remove"
            });
        } else {
            state.push(value);
            addTrace(`Toggled ${value} on.`);
            setHighlight({
                value,
                mode: "new"
            });
        }
        setMetrics(operation, {
            primary: value,
            touched: Math.max(1, bucketSize)
        });
    } else {
        addTrace(`Rehashed ${state.length} keys into buckets.`);
        setHighlight({
            value,
            mode: "scan"
        });
        setMetrics(operation, {
            primary: value,
            touched: state.length
        });
    }
}

function performMapOperation(operation) {
    const key = getPrimaryValue();
    const value = getSecondaryValue() || String(Math.floor(Math.random() * 90 + 10));
    const index = state.findIndex((entry) => entry.key === key);
    const bucketCount = 6;
    const bucketSize = state.filter((entry) => hashValue(entry.key, bucketCount) === hashValue(key, bucketCount)).length;

    if (operation === "add") {
        if (index >= 0) {
            state[index].value = value;
            addTrace(`Updated ${key} to ${value}.`);
        } else {
            state.push({
                key,
                value
            });
            addTrace(`Set ${key} to ${value}.`);
        }
        setHighlight({
            value: key,
            mode: index >= 0 ? "hit" : "new"
        });
        setMetrics(operation, {
            primary: key,
            secondary: value,
            touched: Math.max(1, bucketSize)
        });
    } else if (operation === "search") {
        addTrace(index >= 0 ? `${key} exists.` : `${key} is absent.`);
        setHighlight({
            value: key,
            mode: index >= 0 ? "hit" : "scan"
        });
        setMetrics(operation, {
            primary: key,
            secondary: value,
            touched: Math.max(1, bucketSize)
        });
    } else if (operation === "remove") {
        if (index >= 0) {
            state.splice(index, 1);
            addTrace(`Deleted key ${key}.`);
        } else {
            addTrace(`${key} was not present.`);
        }
        setHighlight({
            value: key,
            mode: "remove"
        });
        setMetrics(operation, {
            primary: key,
            secondary: value,
            touched: Math.max(1, bucketSize)
        });
    } else {
        addTrace(index >= 0 ? `${key} maps to ${state[index].value}.` : `${key} has no value.`);
        setHighlight({
            value: key,
            mode: index >= 0 ? "hit" : "scan"
        });
        setMetrics(operation, {
            primary: key,
            secondary: value,
            touched: Math.max(1, bucketSize)
        });
    }
}

function performHeapOperation(operation) {
    const value = getPrimaryValue();
    if (operation === "add") {
        state.push(value);
        bubbleUp(state.length - 1);
        addTrace(`Inserted ${value} and restored heap order.`);
        setHighlight({
            value,
            mode: "new"
        });
        setMetrics(operation, {
            primary: value,
            touched: Math.max(1, Math.ceil(Math.log2(state.length + 1)))
        });
    } else if (operation === "search") {
        const index = state.findIndex((item) => String(item) === value);
        const found = index >= 0;
        addTrace(found ? `Found ${value}; arbitrary heap search is linear.` : `${value} was not found.`);
        setHighlight({
            value,
            mode: found ? "hit" : "scan"
        });
        setMetrics(operation, {
            primary: value,
            touched: found ? index + 1 : state.length
        });
    } else if (operation === "remove") {
        const index = state.findIndex((item) => String(item) === value);
        if (index >= 0) {
            const last = state.pop();
            if (index < state.length) {
                state[index] = last;
                if (!bubbleUp(index)) sinkDown(index);
            }
            addTrace(`Removed ${value} and restored heap order.`);
        } else {
            addTrace(`${value} was not present.`);
        }
        setHighlight({
            value,
            mode: "remove"
        });
        setMetrics(operation, {
            primary: value,
            touched: index >= 0 ? index + Math.max(1, Math.ceil(Math.log2(state.length + 2))) : state.length
        });
    } else {
        const removed = state[0];
        const last = state.pop();
        if (state.length && last !== undefined) {
            state[0] = last;
            sinkDown(0);
        }
        addTrace(removed === undefined ? "Heap is empty." : `Extracted min ${removed}.`);
        setHighlight({
            value: removed,
            mode: "remove"
        });
        setMetrics(operation, {
            primary: removed,
            touched: removed === undefined ? 0 : Math.max(1, Math.ceil(Math.log2(state.length + 2)))
        });
    }
}

function heapifyState() {
    for (let index = Math.floor(state.length / 2) - 1; index >= 0; index -= 1) sinkDown(index);
}

function bubbleUp(startIndex) {
    let index = startIndex;
    let moved = false;
    while (index > 0) {
        const parent = Math.floor((index - 1) / 2);
        if (numericValue(state[parent]) <= numericValue(state[index])) break;
        [state[parent], state[index]] = [state[index], state[parent]];
        index = parent;
        moved = true;
    }
    return moved;
}

function sinkDown(startIndex) {
    let index = startIndex;
    while (true) {
        const left = index * 2 + 1;
        const right = left + 1;
        let smallest = index;
        if (left < state.length && numericValue(state[left]) < numericValue(state[smallest])) smallest = left;
        if (right < state.length && numericValue(state[right]) < numericValue(state[smallest])) smallest = right;
        if (smallest === index) break;
        [state[index], state[smallest]] = [state[smallest], state[index]];
        index = smallest;
    }
}

function performGraphOperation(operation) {
    const value = getPrimaryValue().toUpperCase();
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
    } else if (operation === "search") {
        const visited = bfsOrder(state.nodes[0], value);
        const reached = visited.includes(value);
        addTrace(reached ? `BFS visited ${visited.join(", ")} and found ${value}.` : `BFS visited ${visited.join(", ") || "no vertices"}; ${value} was not reached.`);
        setHighlight({
            value,
            mode: reached ? "hit" : "scan",
            scan: visited
        });
        setMetrics(operation, {
            primary: value,
            secondary,
            touched: visited.length
        });
    } else if (operation === "remove") {
        state.nodes = state.nodes.filter((node) => node !== value);
        state.edges = state.edges.filter((edge) => edge[0] !== value && edge[1] !== value);
        addTrace(hasNode ? `Removed vertex ${value} and incident edges.` : `${value} was not present.`);
        setHighlight({
            value,
            mode: "remove"
        });
        setMetrics(operation, {
            primary: value,
            secondary,
            touched: state.nodes.length + state.edges.length
        });
    } else {
        if (!state.nodes.includes(value)) state.nodes.push(value);
        if (!state.nodes.includes(secondary)) state.nodes.push(secondary);
        if (!hasEdge(value, secondary)) {
            state.edges.push([value, secondary]);
        }
        addTrace(`Added edge ${value} - ${secondary}.`);
        setHighlight({
            value,
            secondary,
            mode: "new"
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
    if (!state.nodes.includes(start)) return [];
    const queue = [start];
    const visited = new Set([start]);
    while (queue.length) {
        const node = queue.shift();
        if (node === target) break;
        state.edges.forEach((edge) => {
            const next = edge[0] === node ? edge[1] : edge[1] === node ? edge[0] : null;
            if (next && !visited.has(next)) {
                visited.add(next);
                queue.push(next);
            }
        });
    }
    return Array.from(visited);
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
        addTrace(exists ? `Deleted ${word}.` : `${word} was not present.`);
        setHighlight({
            value: word,
            mode: "remove"
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
            prefix
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
    const size = config.kind === "graph" ? state.nodes.length : state.length;
    sizePill.textContent = `n = ${size}`;
    modelView.textContent = JSON.stringify(typedModel(), null, 2);
    traceList.innerHTML = trace.map((item) => `<li>${escapeHTML(item)}</li>`).join("");
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
    if (config.kind === "trie") renderTrie();
}

function classFor(value, index) {
    const text = String(value);
    if (selectedRef && selectedRef.kind === "map" && selectedRef.key === text) return "is-selected";
    if (selectedRef && selectedRef.index === index && selectedRef.kind !== "trie") return "is-selected";
    if (selectedRef && selectedRef.value !== undefined && String(selectedRef.value) === text) return "is-selected";
    if (highlight.index === index) return `is-${highlight.mode || "hit"}`;
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
    const labels = currentKey === "queue" ? ["front", "back"] : currentKey === "deque" ? ["front", "back"] : ["head", "tail"];
    visual.innerHTML = `<div class="${rowClass}">
        ${state.map((item, index) => `
            <div class="array-item">
                <div class="role-label">${index === 0 ? labels[0] : index === state.length - 1 ? labels[1] : "&nbsp;"}</div>
                <button class="ds-node selectable ${classFor(item, index)}" data-kind="linear" data-index="${index}" data-value="${escapeHTML(item)}" type="button">
                    <span>${escapeHTML(item)}</span>${typeBadge(item)}
                </button>
            </div>
            ${index < state.length - 1 ? `<span class="arrow">${rowClass === "list-row" ? "->" : "|"}</span>` : ""}
        `).join("")}
    </div>`;
}

function renderStack() {
    visual.innerHTML = `<div class="stack-wrap">
        <div class="stack-column">
            ${state.map((item, index) => `
                <div class="array-item">
                    <button class="ds-cell stack-cell selectable ${classFor(item, index)}" data-kind="linear" data-index="${index}" data-value="${escapeHTML(item)}" type="button">
                        <span>${escapeHTML(item)}</span>${typeBadge(item)}
                    </button>
                    ${index === state.length - 1 ? `<div class="role-label">top</div>` : ""}
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
    state.forEach((entry) => {
        buckets[hashValue(entryKey(entry), bucketCount)].push(entry);
    });

    visual.innerHTML = `<div class="bucket-table">
        ${buckets.map((bucket, index) => `
            <div class="bucket-row">
                <div class="bucket-label">${index}</div>
                <div class="bucket-chain">
                    ${bucket.length ? bucket.map((entry) => `
                        <button class="ds-node selectable ${classFor(entryKey(entry), index)}" data-kind="${currentKey === "map" ? "map" : "linear"}" data-index="${state.findIndex((item) => entryKey(item) === entryKey(entry))}" data-key="${escapeHTML(entryKey(entry))}" data-value="${escapeHTML(typeof entry === "object" ? entry.value : entry)}" type="button">
                            <span>${escapeHTML(asEntryLabel(entry))}</span>${typeBadge(typeof entry === "object" ? entry.value : entry)}
                        </button>
                    `).join(`<span class="arrow">-></span>`) : `<span class="role-label">empty</span>`}
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
    if (numericValue(value) < numericValue(node.value)) {
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

function renderTree(root, includeArray) {
    const positions = [];
    const links = [];
    const width = 760;
    const levelHeight = 132;

    function place(node, depth, left, right, parent) {
        if (!node) return;
        const x = (left + right) / 2;
        const y = 34 + depth * levelHeight;
        positions.push({
            node,
            x,
            y
        });
        if (parent) links.push([parent.x, parent.y, x, y]);
        place(node.left, depth + 1, left, x, {
            x,
            y
        });
        place(node.right, depth + 1, x, right, {
            x,
            y
        });
    }

    place(root, 0, 36, width - 36, null);
    const height = Math.max(470, 110 + Math.max(0, ...positions.map((item) => item.y)) + (includeArray ? 130 : 0));

    visual.innerHTML = `<div class="tree-canvas" style="height:${height}px">
        <svg class="link-layer" style="width:${width}px; height:${height}px" viewBox="0 0 ${width} ${height}">
            ${links.map((line) => `<line x1="${line[0]}" y1="${line[1] + 50}" x2="${line[2]}" y2="${line[3]}" stroke="var(--primary-color)" stroke-width="2" opacity="0.55" />`).join("")}
        </svg>
        ${positions.map((item, index) => `
            <button class="tree-node selectable ${classFor(item.node.value, state.findIndex((value) => String(value) === String(item.node.value)))}" data-kind="linear" data-index="${state.findIndex((value) => String(value) === String(item.node.value))}" data-value="${escapeHTML(item.node.value)}" style="left:${item.x - 62}px; top:${item.y}px" type="button">
                <span>${escapeHTML(item.node.value)}</span>${typeBadge(item.node.value)}
            </button>
        `).join("")}
        ${includeArray ? `<div class="heap-array">${state.map((item, index) => `<button class="ds-cell selectable ${classFor(item, index)}" data-kind="linear" data-index="${index}" data-value="${escapeHTML(item)}" type="button"><span>${escapeHTML(item)}</span>${typeBadge(item)}</button>`).join("")}</div>` : ""}
    </div>`;
}

function renderGraph() {
    const width = 760;
    const height = 470;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = 168;
    const positions = new Map();
    state.nodes.forEach((node, index) => {
        const angle = -Math.PI / 2 + (index / state.nodes.length) * Math.PI * 2;
        positions.set(node, {
            x: centerX + Math.cos(angle) * radius,
            y: centerY + Math.sin(angle) * radius
        });
    });

    visual.innerHTML = `<div class="graph-canvas" style="height:${height}px">
        <svg class="link-layer" style="width:${width}px; height:${height}px" viewBox="0 0 ${width} ${height}">
            ${state.edges.map((edge) => {
                const a = positions.get(edge[0]);
                const b = positions.get(edge[1]);
                if (!a || !b) return "";
                return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="var(--primary-color)" stroke-width="2" opacity="0.55" />`;
            }).join("")}
        </svg>
        ${state.nodes.map((node, index) => {
            const point = positions.get(node);
            return `<button class="graph-node selectable ${classFor(node, index)}" data-kind="graph" data-index="${index}" data-value="${escapeHTML(node)}" style="left:${point.x - 60}px; top:${point.y - 54}px" type="button"><span>${escapeHTML(node)}</span>${typeBadge(node, "vertex")}</button>`;
        }).join("")}
    </div>`;
}

function renderTrie() {
    const trie = buildTrie(state);
    const positions = [];
    const links = [];
    let cursor = 0;
    const width = 900;
    const levelHeight = 118;

    function place(node, depth, parent) {
        const children = Object.values(node.children);
        if (!children.length) {
            cursor += 1;
            node.x = cursor * 118;
        } else {
            children.forEach((child) => place(child, depth + 1, node));
            node.x = children.reduce((sum, child) => sum + child.x, 0) / children.length;
        }
        node.y = 28 + depth * levelHeight;
        positions.push(node);
        if (parent) links.push([parent, node, node.char]);
    }

    place(trie, 0, null);
    const height = Math.max(390, 100 + Math.max(...positions.map((node) => node.y)));
    const canvasWidth = Math.max(width, cursor * 132);
    visual.innerHTML = `<div class="trie-canvas" style="min-width:${canvasWidth}px; height:${height}px">
        <svg class="link-layer" style="width:${canvasWidth}px; height:${height}px" viewBox="0 0 ${canvasWidth} ${height}">
            ${links.map((line) => `
                <line x1="${line[0].x}" y1="${line[0].y + 46}" x2="${line[1].x}" y2="${line[1].y}" stroke="var(--primary-color)" stroke-width="2" opacity="0.55" />
                <text x="${(line[0].x + line[1].x) / 2}" y="${(line[0].y + line[1].y) / 2}" fill="var(--text-secondary)" font-size="11">${escapeHTML(line[2])}</text>
            `).join("")}
        </svg>
        ${positions.map((node, index) => {
            const label = node.root ? "root" : node.terminal ? `${node.char}*` : node.char;
            const active = highlight.prefix ? node.wordPrefix.startsWith(highlight.prefix) || highlight.prefix.startsWith(node.wordPrefix) : false;
            const selected = selectedRef && selectedRef.kind === "trie" && selectedRef.value === node.wordPrefix;
            return `<button class="trie-node selectable ${selected ? "is-selected" : active ? "is-hit" : classFor(node.wordPrefix, index)}" data-kind="trie" data-index="${index}" data-value="${escapeHTML(node.wordPrefix)}" style="left:${node.x - 54}px; top:${node.y}px" type="button"><span>${escapeHTML(label)}</span>${typeBadge(node.wordPrefix, node.root ? "root" : node.terminal ? "word" : "prefix")}</button>`;
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
    if (!selectedRef) return;
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
[valueInput, secondaryInput].forEach((input) => {
    input.addEventListener("input", updateCommandUI);
    input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") performOperation(activeOperation || "search");
    });
});

replayAnimationButton.addEventListener("click", () => {
    const targets = animationTargets();
    lastAnimationTargets = targets;
    animateTargets(targets, lastMetrics.label);
});

randomizeButton.addEventListener("click", randomizeState);
resetButton.addEventListener("click", resetState);
visual.addEventListener("click", (event) => selectRenderedItem(event.target));
updateSelectedButton.addEventListener("click", updateSelected);
clearSelectedButton.addEventListener("click", () => {
    selectedRef = null;
    render();
});

resetState();
