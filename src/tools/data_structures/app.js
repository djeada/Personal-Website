"use strict";

const structureSelect = document.getElementById("structure-select");
const valueInput = document.getElementById("value-input");
const secondaryInput = document.getElementById("secondary-input");
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
const randomizeButton = document.getElementById("randomize");
const resetButton = document.getElementById("reset");
const operationButtons = Array.from(document.querySelectorAll("[data-operation]"));

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

function cloneInitial(value) {
    return JSON.parse(JSON.stringify(value));
}

function normalizeValue(value) {
    return String(value || "").trim();
}

function getPrimaryValue() {
    return normalizeValue(valueInput.value) || nextSample();
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

function setHighlight(next) {
    highlight = next;
}

function setOperation(operation) {
    activeOperation = operation;
    operationButtons.forEach((button) => {
        button.classList.toggle("active", button.dataset.operation === operation);
    });
}

function resetState() {
    const config = STRUCTURES[currentKey];
    state = cloneInitial(config.initial);
    trace = [`Loaded ${config.name}.`];
    setHighlight({});
    sampleCursor = 0;
    valueInput.value = config.sampleValues[0] || "";
    secondaryInput.value = "";
    updateStructureUI();
    render();
}

function randomizeState() {
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
    render();
}

function updateStructureUI() {
    const config = STRUCTURES[currentKey];
    structureName.textContent = config.name;
    structureSummary.textContent = config.summary;
    bestFor.textContent = config.best;
    watchOut.textContent = config.caution;
    memoryNote.textContent = config.memory;
    specialAction.textContent = config.specialLabel;
    secondaryInput.placeholder = config.secondaryLabel;
    valueInput.placeholder = config.kind === "map" ? "key" : "value";
    renderComplexity();
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

function performOperation(operation) {
    const config = STRUCTURES[currentKey];
    setOperation(operation);

    if (config.kind === "graph") {
        performGraphOperation(operation);
    } else if (config.kind === "trie") {
        performTrieOperation(operation);
    } else if (config.kind === "heap") {
        performHeapOperation(operation);
    } else if (currentKey === "map") {
        performMapOperation(operation);
    } else if (["hashTable", "set"].includes(currentKey)) {
        performHashSetOperation(operation);
    } else {
        performLinearOperation(operation);
    }

    render();
}

function performLinearOperation(operation) {
    const value = getPrimaryValue();
    const config = STRUCTURES[currentKey];

    if (operation === "add") {
        state.push(value);
        addTrace(`${config.operations.add[0]} ${value}.`);
        setHighlight({
            value,
            mode: "new"
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
            return;
        }
        if (currentKey === "queue") {
            const removed = state.shift();
            addTrace(removed === undefined ? "Queue is empty." : `Dequeued ${removed}.`);
            setHighlight({
                value: removed,
                mode: "remove"
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
        return;
    }

    if (currentKey === "array") {
        const index = Number.parseInt(getSecondaryValue() || value, 10);
        const safeIndex = Number.isInteger(index) ? Math.max(0, Math.min(index, state.length - 1)) : 0;
        addTrace(state.length ? `Accessed index ${safeIndex}: ${state[safeIndex]}.` : "Array is empty.");
        setHighlight({
            index: safeIndex,
            mode: "hit"
        });
    } else if (currentKey === "deque") {
        const removed = state.shift();
        addTrace(removed === undefined ? "Deque is empty." : `Popped front ${removed}.`);
        setHighlight({
            value: removed,
            mode: "remove"
        });
    } else {
        const item = state[0];
        addTrace(item === undefined ? `${config.name} is empty.` : `${config.specialLabel}: ${item}.`);
        setHighlight({
            index: 0,
            mode: "hit"
        });
    }
}

function performHashSetOperation(operation) {
    const value = getPrimaryValue();
    const exists = state.some((item) => String(item) === value);

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
    } else if (operation === "search") {
        addTrace(exists ? `${value} is present.` : `${value} is absent.`);
        setHighlight({
            value,
            mode: exists ? "hit" : "scan"
        });
    } else if (operation === "remove") {
        state = state.filter((item) => String(item) !== value);
        addTrace(exists ? `Deleted ${value}.` : `${value} was not present.`);
        setHighlight({
            value,
            mode: "remove"
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
    } else {
        addTrace(`Rehashed ${state.length} keys into buckets.`);
        setHighlight({
            value,
            mode: "scan"
        });
    }
}

function performMapOperation(operation) {
    const key = getPrimaryValue();
    const value = getSecondaryValue() || String(Math.floor(Math.random() * 90 + 10));
    const index = state.findIndex((entry) => entry.key === key);

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
    } else if (operation === "search") {
        addTrace(index >= 0 ? `${key} exists.` : `${key} is absent.`);
        setHighlight({
            value: key,
            mode: index >= 0 ? "hit" : "scan"
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
    } else {
        addTrace(index >= 0 ? `${key} maps to ${state[index].value}.` : `${key} has no value.`);
        setHighlight({
            value: key,
            mode: index >= 0 ? "hit" : "scan"
        });
    }
}

function performHeapOperation(operation) {
    const value = getPrimaryValue();
    if (operation === "add") {
        state.push(value);
        heapifyState();
        addTrace(`Inserted ${value} and restored heap order.`);
        setHighlight({
            value,
            mode: "new"
        });
    } else if (operation === "search") {
        const found = state.some((item) => String(item) === value);
        addTrace(found ? `Found ${value}; arbitrary heap search is linear.` : `${value} was not found.`);
        setHighlight({
            value,
            mode: found ? "hit" : "scan"
        });
    } else if (operation === "remove") {
        const index = state.findIndex((item) => String(item) === value);
        if (index >= 0) {
            state.splice(index, 1);
            heapifyState();
            addTrace(`Removed ${value} and heapified.`);
        } else {
            addTrace(`${value} was not present.`);
        }
        setHighlight({
            value,
            mode: "remove"
        });
    } else {
        const removed = state.shift();
        heapifyState();
        addTrace(removed === undefined ? "Heap is empty." : `Extracted min ${removed}.`);
        setHighlight({
            value: removed,
            mode: "remove"
        });
    }
}

function heapifyState() {
    state.sort((a, b) => numericValue(a) - numericValue(b));
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
    } else if (operation === "search") {
        const visited = bfsOrder(value);
        addTrace(hasNode ? `BFS reached ${visited.join(", ")}.` : `${value} is not in the graph.`);
        setHighlight({
            value,
            mode: hasNode ? "hit" : "scan",
            scan: visited
        });
    } else if (operation === "remove") {
        state.nodes = state.nodes.filter((node) => node !== value);
        state.edges = state.edges.filter((edge) => edge[0] !== value && edge[1] !== value);
        addTrace(hasNode ? `Removed vertex ${value} and incident edges.` : `${value} was not present.`);
        setHighlight({
            value,
            mode: "remove"
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
    }
}

function hasEdge(a, b) {
    return state.edges.some((edge) => (edge[0] === a && edge[1] === b) || (edge[0] === b && edge[1] === a));
}

function bfsOrder(start) {
    if (!state.nodes.includes(start)) return [];
    const queue = [start];
    const visited = new Set([start]);
    while (queue.length) {
        const node = queue.shift();
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

    if (operation === "add") {
        if (!exists) state.push(word);
        addTrace(exists ? `${word} already exists.` : `Inserted ${word}.`);
        setHighlight({
            value: word,
            mode: exists ? "hit" : "new"
        });
    } else if (operation === "search") {
        addTrace(exists ? `Found word ${word}.` : `${word} is not a stored word.`);
        setHighlight({
            value: word,
            mode: exists ? "hit" : "scan"
        });
    } else if (operation === "remove") {
        state = state.filter((item) => item !== word);
        addTrace(exists ? `Deleted ${word}.` : `${word} was not present.`);
        setHighlight({
            value: word,
            mode: "remove"
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
    }
}

function render() {
    renderComplexity();
    const config = STRUCTURES[currentKey];
    const size = config.kind === "graph" ? state.nodes.length : state.length;
    sizePill.textContent = `n = ${size}`;
    modelView.textContent = JSON.stringify(state, null, 2);
    traceList.innerHTML = trace.map((item) => `<li>${escapeHTML(item)}</li>`).join("");

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
    if (highlight.index === index) return `is-${highlight.mode || "hit"}`;
    if (highlight.value !== undefined && String(highlight.value) === text) return `is-${highlight.mode || "hit"}`;
    if (highlight.scan && highlight.scan.map(String).includes(text)) return "is-scan";
    return "";
}

function renderArray() {
    visual.innerHTML = `<div class="array-row">
        ${state.map((item, index) => `
            <div class="array-item">
                <div class="index-label">[${index}]</div>
                <div class="ds-cell ${classFor(item, index)}">${escapeHTML(item)}</div>
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
                <div class="ds-node ${classFor(item, index)}">${escapeHTML(item)}</div>
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
                    <div class="ds-cell stack-cell ${classFor(item, index)}">${escapeHTML(item)}</div>
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
                        <div class="ds-node ${classFor(entryKey(entry), index)}">${escapeHTML(asEntryLabel(entry))}</div>
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
    const levelHeight = 78;

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
    const height = Math.max(390, 110 + Math.max(0, ...positions.map((item) => item.y)));

    visual.innerHTML = `<div class="tree-canvas" style="height:${height}px">
        <svg class="link-layer" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
            ${links.map((line) => `<line x1="${line[0]}" y1="${line[1] + 21}" x2="${line[2]}" y2="${line[3]}" stroke="var(--primary-color)" stroke-width="2" opacity="0.55" />`).join("")}
        </svg>
        ${positions.map((item, index) => `
            <div class="tree-node ${classFor(item.node.value, index)}" style="left:${item.x - 26}px; top:${item.y}px">${escapeHTML(item.node.value)}</div>
        `).join("")}
        ${includeArray ? `<div class="heap-array">${state.map((item, index) => `<div class="ds-cell ${classFor(item, index)}">${escapeHTML(item)}</div>`).join("")}</div>` : ""}
    </div>`;
}

function renderGraph() {
    const width = 760;
    const height = 390;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = 130;
    const positions = new Map();
    state.nodes.forEach((node, index) => {
        const angle = -Math.PI / 2 + (index / state.nodes.length) * Math.PI * 2;
        positions.set(node, {
            x: centerX + Math.cos(angle) * radius,
            y: centerY + Math.sin(angle) * radius
        });
    });

    visual.innerHTML = `<div class="graph-canvas">
        <svg class="link-layer" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
            ${state.edges.map((edge) => {
                const a = positions.get(edge[0]);
                const b = positions.get(edge[1]);
                if (!a || !b) return "";
                return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="var(--primary-color)" stroke-width="2" opacity="0.55" />`;
            }).join("")}
        </svg>
        ${state.nodes.map((node, index) => {
            const point = positions.get(node);
            return `<div class="graph-node ${classFor(node, index)}" style="left:${point.x - 26}px; top:${point.y - 26}px">${escapeHTML(node)}</div>`;
        }).join("")}
    </div>`;
}

function renderTrie() {
    const trie = buildTrie(state);
    const positions = [];
    const links = [];
    let cursor = 0;
    const width = 900;
    const levelHeight = 72;

    function place(node, depth, parent) {
        const children = Object.values(node.children);
        if (!children.length) {
            cursor += 1;
            node.x = cursor * 72;
        } else {
            children.forEach((child) => place(child, depth + 1, node));
            node.x = children.reduce((sum, child) => sum + child.x, 0) / children.length;
        }
        node.y = 28 + depth * levelHeight;
        positions.push(node);
        if (parent) links.push([parent.x, parent.y, node.x, node.y, node.char]);
    }

    place(trie, 0, null);
    const height = Math.max(390, 100 + Math.max(...positions.map((node) => node.y)));
    const canvasWidth = Math.max(width, cursor * 86);
    visual.innerHTML = `<div class="trie-canvas" style="min-width:${canvasWidth}px; height:${height}px">
        <svg class="link-layer" viewBox="0 0 ${canvasWidth} ${height}" preserveAspectRatio="none">
            ${links.map((line) => `
                <line x1="${line[0]}" y1="${line[1] + 19}" x2="${line[2]}" y2="${line[3]}" stroke="var(--primary-color)" stroke-width="2" opacity="0.55" />
                <text x="${(line[0] + line[2]) / 2}" y="${(line[1] + line[3]) / 2}" fill="var(--text-secondary)" font-size="11">${escapeHTML(line[4])}</text>
            `).join("")}
        </svg>
        ${positions.map((node, index) => {
            const label = node.root ? "root" : node.terminal ? `${node.char}*` : node.char;
            const active = highlight.prefix ? node.wordPrefix.startsWith(highlight.prefix) || highlight.prefix.startsWith(node.wordPrefix) : false;
            return `<div class="trie-node ${active ? "is-hit" : classFor(node.wordPrefix, index)}" style="left:${node.x - 23}px; top:${node.y}px">${escapeHTML(label)}</div>`;
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

structureSelect.innerHTML = Object.entries(STRUCTURES).map(([key, config]) => `<option value="${key}">${config.name}</option>`).join("");

structureSelect.addEventListener("change", () => {
    currentKey = structureSelect.value;
    activeOperation = null;
    resetState();
});

operationButtons.forEach((button) => {
    button.addEventListener("click", () => performOperation(button.dataset.operation));
});

randomizeButton.addEventListener("click", randomizeState);
resetButton.addEventListener("click", resetState);

resetState();
