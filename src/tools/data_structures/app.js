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

// Ordering used by the BST and the heap. Two numbers compare numerically, anything
// else compares as text, so mixed data still gets a total, stable order instead of
// being reduced to its first character code.
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

function operationConfig(operation) {
    return STRUCTURES[currentKey].operations[operation] || STRUCTURES[currentKey].operations.add;
}

function structureSize() {
    const config = STRUCTURES[currentKey];
    return config.kind === "graph" ? state.nodes.length : state.length;
}

function measuredTouched(detail) {
    return detail.touched !== undefined ? detail.touched : structureSize();
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

// Randomize should give a genuinely different dataset each click, and one that suits
// the structure: numbers where ordering is the point, words where prefixes are.
function randomDataset(key) {
    const config = STRUCTURES[key];
    const count = randomInt(5, 8);
    if (config.kind === "graph") {
        const vertices = Array.from({
            length: randomInt(5, 7)
        }, (unused, index) => String.fromCharCode(65 + index));
        // Start from a random spanning tree so the graph is always connected, then add
        // a couple of extra edges for cycles.
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
        // Share stems so the tree actually branches instead of becoming a row of chains.
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
    const needsSecondary = (currentKey === "array" && operation === "special") || (currentKey === "graph" && operation === "special") || (currentKey === "map" && operation === "add") || (currentKey === "trie" && operation === "special");
    const optionalSecondary = currentKey === "deque" && operation === "add";
    secondaryField.classList.toggle("is-required", needsSecondary);
    secondaryField.classList.toggle("is-muted", !needsSecondary && !optionalSecondary);
    primaryField.classList.toggle("is-muted", (["stack", "queue"].includes(currentKey) && ["remove", "special"].includes(operation)) || (["array", "deque", "heap", "bst", "hashTable", "trie"].includes(currentKey) && operation === "special"));
    executeOperationButton.querySelector("span").textContent = `Run ${op[0].toLowerCase()}`;
    dockOperation.textContent = op[0];
    const primary = valueInput.value || "value";
    const secondary = optionalSecondary ? dequeEnd(secondaryInput.value) : secondaryInput.value || config.secondaryLabel.toLowerCase();
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
    if (config.kind === "graph") {
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
    resultIcon.innerHTML = '<i class="fa fa-terminal" aria-hidden="true"></i>';
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
    const primary = normalizeValue(valueInput.value);
    const primaryOptional = (operation === "remove" && ["stack", "queue"].includes(currentKey)) ||
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
    resultIcon.innerHTML = '<i class="fa fa-times" aria-hidden="true"></i>';
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
        detail: operationConfig(operation)[4],
        steps: lastMetrics.touched
    };
}

function showRunningResult(outcome) {
    resultBanner.className = "result-banner is-running";
    resultIcon.innerHTML = '<i class="fa fa-play" aria-hidden="true"></i>';
    resultState.textContent = "Operation running";
    resultTitle.textContent = outcome.title;
    resultDetail.textContent = "Follow the highlighted path in the visualization.";
    resultSteps.textContent = `0 / ${outcome.steps}`;
    resultValue.textContent = "pending";
}

function showCompletedResult(outcome) {
    if (!outcome) return;
    resultBanner.className = `result-banner ${outcome.success ? "is-success" : "is-failure"}`;
    resultIcon.innerHTML = `<i class="fa ${outcome.success ? "fa-check" : "fa-times"}" aria-hidden="true"></i>`;
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
    // A freshly inserted value is not on screen yet, so matching it against the
    // pre-insert render would light up an unrelated duplicate.
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
    comparisonBubble.textContent = lastOutcome && lastOutcome.success ? "Match confirmed" : "Traversal complete";
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
    // Membership is decided by the search walk itself, so the reported result always
    // agrees with the highlighted path instead of with a separate array lookup.
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
        // A stack can only be examined from the top, so its scan runs in reverse to
        // match both the rendered column and the real access pattern.
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
    // Only the chain in the target bucket is inspected; an empty bucket still costs the
    // one hash computation, hence the floor of 1.
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
        const start = state.nodes[0];
        const {
            order,
            found
        } = bfsOrder(start, value);
        addTrace(found ?
            `BFS from ${start} dequeued ${order.join(" -> ")} and found ${value}.` :
            hasNode ?
            `BFS from ${start} dequeued ${order.join(" -> ") || "no vertices"}; ${value} exists but is not reachable from ${start}.` :
            `BFS from ${start} dequeued ${order.join(" -> ") || "no vertices"}; ${value} is not in the graph.`);
        setHighlight({
            value,
            mode: found ? "hit" : "scan",
            scan: order
        });
        setMetrics(operation, {
            primary: value,
            secondary,
            touched: Math.max(1, order.length)
        });
    } else if (operation === "remove") {
        // Counted before the mutation: deletion inspects every vertex and every edge
        // that existed when the operation started.
        const inspected = state.nodes.length + state.edges.length;
        const incident = state.edges.filter((edge) => edge[0] === value || edge[1] === value).length;
        state.nodes = state.nodes.filter((node) => node !== value);
        state.edges = state.edges.filter((edge) => edge[0] !== value && edge[1] !== value);
        addTrace(hasNode ? `Removed vertex ${value} and ${incident} incident ${incident === 1 ? "edge" : "edges"}.` : `${value} was not present.`);
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
    fitStageContent();
}

// Renderers size themselves to the stage, so anything still wider than it is genuinely
// too dense to shrink further; centre the scroll on it rather than starting at its edge.
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

// Horizontal room the stage can give a drawing before it has to scroll.
function availableStageWidth() {
    return Math.max(280, visualStage.clientWidth - 44);
}

const CANVAS_PAD = 14;

// Shrink the per-column pitch (and with it the node box) until the drawing fits the
// stage, but never past the point where the labels stop being readable; anything
// still wider than that scrolls.
function columnMetrics(columns, naturalSlot, minSlot) {
    const usable = availableStageWidth() - CANVAS_PAD * 2;
    const slot = Math.max(minSlot, Math.min(naturalSlot, usable / Math.max(1, columns)));
    return {
        slot,
        ratio: slot / naturalSlot
    };
}

// The same idea vertically: a degenerate tree is one node per level, so tighten the
// level spacing before letting it grow into a very tall scroll. The budget follows the
// stage's own max-height rule rather than its measured height, which would otherwise
// shrink on every re-render. `reserve` is room kept for anything drawn below the
// canvas, such as a heap's backing array.
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
        // A heap is always a complete tree, so its nodes can be laid out straight from
        // their array indices; that keeps the picture symmetric and lined up with the
        // backing array underneath it.
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
        // In-order column assignment: every node gets its own vertical lane, so a deep
        // or lopsided tree can never stack two nodes on the same pixel the way the old
        // "split the canvas in half per level" layout did.
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

function renderGraph() {
    const count = state.nodes.length;
    // The ring has to grow with the vertex count, otherwise vertices overlap as soon
    // as a few are added; if that no longer fits the stage, shrink ring and vertices
    // together instead of letting the drawing run off the edge.
    const naturalRing = Math.max(150, (GRAPH_NODE_RADIUS + 26) / Math.sin(Math.PI / Math.max(3, count)));
    const naturalSize = (naturalRing + GRAPH_NODE_RADIUS + 20) * 2;
    const ratio = Math.max(0.6, Math.min(1, availableStageWidth() / naturalSize));
    const nodeRadius = Math.round(GRAPH_NODE_RADIUS * ratio);
    const ringRadius = naturalRing * ratio;
    const size = Math.round((ringRadius + nodeRadius + 20) * 2);
    const width = Math.max(280, size);
    const height = Math.max(300, size);
    const centerX = width / 2;
    const centerY = height / 2;
    const positions = new Map();
    state.nodes.forEach((node, index) => {
        const angle = -Math.PI / 2 + (index / count) * Math.PI * 2;
        positions.set(node, {
            x: centerX + Math.cos(angle) * ringRadius,
            y: centerY + Math.sin(angle) * ringRadius
        });
    });

    const highlightedEdges = new Set();
    if (highlight.edge) highlightedEdges.add([highlight.edge[0], highlight.edge[1]].sort().join("\u0000"));

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
                const active = highlightedEdges.has([edge[0], edge[1]].sort().join("\u0000"));
                return `<line class="graph-edge ${active ? "is-active-edge" : ""}" x1="${(a.x + ux * nodeRadius).toFixed(1)}" y1="${(a.y + uy * nodeRadius).toFixed(1)}" x2="${(b.x - ux * nodeRadius).toFixed(1)}" y2="${(b.y - uy * nodeRadius).toFixed(1)}" stroke-width="2" />`;
            }).join("")}
        </svg>
        ${state.nodes.map((node, index) => {
            const point = positions.get(node);
            const degree = neighborsOf(node).length;
            return `<button class="graph-node selectable ${classFor(node, index)}" data-kind="graph" data-index="${index}" data-value="${escapeHTML(node)}" style="left:${(point.x - nodeRadius).toFixed(1)}px; top:${(point.y - nodeRadius).toFixed(1)}px" title="${escapeHTML(node)} - degree ${degree}" type="button"><span>${escapeHTML(node)}</span><small class="degree-badge">${degree}</small></button>`;
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
visual.addEventListener("click", (event) => selectRenderedItem(event.target));
updateSelectedButton.addEventListener("click", updateSelected);
clearSelectedButton.addEventListener("click", () => {
    selectedRef = null;
    render();
});

resetState();
