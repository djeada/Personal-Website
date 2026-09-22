"use strict";

/*
 * Reel scripts.
 *
 * A scene is a list of operations run against the Data Structure Lab. The recorder
 * turns every visual state the lab produces into one beat, so the script only has to
 * say what to run and what to say about it - not how many frames anything takes.
 *
 * Keep datasets small (5-8 items). Node size is derived from the stage width, so a
 * 7-item structure fills a phone screen and a 15-item one is unreadable at arm's
 * length.
 *
 * Fields
 *   id        output basename
 *   kicker    small caps label above the hook
 *   hook      1-3 lines; <em> marks the accent-coloured words
 *   structure lab structure key, and the default for every step
 *   dataset   optional explicit contents (array, or {nodes, edges} for a graph)
 *   steps[]   { title, op, primary, secondary, structure?, dataset?, caption? }
 *   outro     1-2 closing lines
 */

const SCENES = [
    {
        id: "bst-search",
        kicker: "Binary search tree",
        hook: ["Find one number", "in <em>3 looks</em>."],
        structure: "bst",
        dataset: ["50", "30", "70", "20", "40", "60", "80"],
        steps: [
            {
                title: "Looking for <b>60</b>",
                op: "search",
                primary: "60",
                caption: "Every comparison throws away half the tree."
            },
            {
                title: "Now <b>65</b> - which isn't there",
                op: "search",
                primary: "65",
                caption: "Still 3 looks to prove it's missing."
            }
        ],
        outro: ["7 values.", "<em>3 comparisons.</em>"]
    },
    {
        id: "hash-o1",
        kicker: "Hash table",
        hook: ["Why a hash table", "finds anything in <em>one step</em>."],
        structure: "hashTable",
        dataset: ["red", "blue", "green", "gold", "cyan"],
        steps: [
            {
                title: "Look up <b>gold</b>",
                op: "search",
                primary: "gold",
                caption: "The key computes its own address."
            },
            {
                title: "<b>cyan</b> lands in the same bucket",
                op: "search",
                primary: "cyan",
                caption: "A collision costs one extra hop - that's the worst case."
            }
        ],
        outro: ["No scanning.", "<em>Just arithmetic.</em>"]
    },
    {
        id: "linear-vs-hash",
        kicker: "Array vs hash table",
        hook: ["Same lookup.", "<em>6 steps vs 1.</em>"],
        structure: "array",
        dataset: ["12", "7", "19", "3", "15", "8"],
        steps: [
            {
                title: "An array checks <b>every</b> slot",
                op: "search",
                primary: "8",
                caption: "Last element = worst case. 6 comparisons."
            },
            {
                title: "A hash table jumps <b>straight there</b>",
                op: "search",
                primary: "gold",
                structure: "hashTable",
                dataset: ["red", "blue", "green", "gold", "cyan"],
                caption: "One hash. One probe. Done."
            }
        ],
        outro: ["This is what", "<em>O(n) vs O(1)</em> feels like."]
    },
    {
        id: "heap-priority",
        kicker: "Min heap",
        hook: ["How a priority queue", "always knows the <em>smallest</em>."],
        structure: "heap",
        dataset: ["3", "7", "5", "12", "10", "18", "9"],
        steps: [
            {
                title: "Insert <b>1</b>",
                op: "add",
                primary: "1",
                caption: "It bubbles up until its parent is smaller."
            },
            {
                title: "Take the minimum",
                op: "special",
                caption: "Root leaves, last item drops in and sinks."
            }
        ],
        outro: ["Never sorted.", "<em>Always ordered enough.</em>"]
    },
    {
        id: "bfs-frontier",
        kicker: "Breadth-first search",
        hook: ["How a route finder", "<em>spreads out</em>."],
        structure: "graph",
        dataset: {
            nodes: ["A", "B", "C", "D", "E", "F"],
            edges: [["A", "B"], ["A", "C"], ["B", "D"], ["C", "E"], ["D", "F"]]
        },
        steps: [
            {
                title: "Find <b>F</b> from <b>A</b>",
                op: "search",
                primary: "F",
                caption: "A FIFO queue visits every vertex one ring at a time."
            }
        ],
        outro: ["Closest first.", "<em>Always.</em>"]
    },
    {
        id: "trie-autocomplete",
        kicker: "Trie",
        hook: ["What your keyboard does", "<em>between keystrokes</em>."],
        structure: "trie",
        dataset: ["car", "cat", "cart", "dog", "dot"],
        steps: [
            {
                title: "Type <b>ca</b>",
                op: "special",
                secondary: "ca",
                caption: "Two edges walked - every completion hangs below."
            },
            {
                title: "Is <b>cart</b> a word?",
                op: "search",
                primary: "cart",
                caption: "One edge per character. The dictionary size never matters."
            }
        ],
        outro: ["Cost = word length.", "<em>Not vocabulary size.</em>"]
    },
    {
        id: "quicksort",
        tool: "sorting",
        kicker: "Quicksort",
        hook: ["Sorting 12 numbers", "with <em>one good question</em>."],
        title: "Bigger or smaller than the pivot?",
        requireDone: true,
        caption: "Every element is compared to one pivot, then the halves repeat it.",
        growth: "O(n log n)",
        config: { algorithm: "quick", values: [38, 7, 91, 24, 55, 3, 70, 16, 82, 41, 29, 63] },
        maxBeats: 44,
        outro: ["One question per element.", "<em>Repeated on halves.</em>"]
    },
    {
        id: "merge-sort",
        tool: "sorting",
        kicker: "Merge sort",
        hook: ["The sort that", "<em>never guesses wrong</em>."],
        title: "Split down, merge back in order",
        requireDone: true,
        caption: "Two sorted halves merge in one pass - no pivot to pick badly.",
        growth: "O(n log n)",
        config: { algorithm: "merge", values: [38, 7, 91, 24, 55, 3, 70, 16, 82, 41, 29, 63] },
        maxBeats: 44,
        outro: ["No worst case.", "<em>Always n log n.</em>"]
    },
    {
        id: "bubble-sort",
        tool: "sorting",
        kicker: "Bubble sort",
        hook: ["Watch why nobody", "<em>ships bubble sort</em>."],
        title: "Compare neighbours. Swap. Repeat.",
        caption: "Each pass walks the whole array to move one value into place.",
        growth: "O(n²)",
        config: { algorithm: "bubble", values: [38, 7, 91, 24, 55, 3, 70, 16, 82, 41] },
        maxBeats: 48,
        outro: ["10 items.", "<em>45 comparisons.</em>"]
    },
    {
        id: "binary-search",
        tool: "searching",
        kicker: "Binary search",
        hook: ["Find 1 number in 32", "in <em>5 looks</em>."],
        title: "Halve the range, every time",
        requireDone: true,
        caption: "Check the middle, throw away the half that cannot contain it.",
        growth: "O(log n)",
        config: { algorithm: "binary", size: 32, target: 57 },
        maxBeats: 20,
        outro: ["Double the data.", "<em>One extra look.</em>"]
    },
    {
        id: "bfs-maze",
        tool: "graphs",
        kicker: "Breadth-first search",
        hook: ["How a route finder", "<em>floods a map</em>."],
        title: "One ring at a time",
        caption: "BFS reaches every cell at distance k before any cell at k+1.",
        growth: "O(V + E)",
        config: { algorithm: "bfs", sizeField: "grid-size", size: 14, density: 20 },
        stride: 5,
        maxBeats: 38,
        maxSteps: 320,
        requireDone: true,
        outro: ["First to arrive", "is the <em>shortest path</em>."]
    },
    {
        id: "dfs-maze",
        tool: "graphs",
        kicker: "Depth-first search",
        hook: ["Same maze.", "<em>Completely different</em> search."],
        title: "Go deep until it dead-ends",
        caption: "DFS commits to one direction, so its path is rarely the shortest.",
        growth: "O(V + E)",
        config: { algorithm: "dfs", sizeField: "grid-size", size: 14, density: 20 },
        stride: 5,
        maxBeats: 38,
        maxSteps: 320,
        requireDone: true,
        outro: ["Finds <em>a</em> path.", "Not the <em>short</em> one."]
    },
    {
        id: "dijkstra-maze",
        tool: "graphs",
        kicker: "Dijkstra",
        hook: ["The algorithm", "inside <em>every GPS</em>."],
        title: "Cheapest frontier cell first",
        caption: "A priority queue keeps the nearest unvisited cell on top.",
        growth: "O(E log V)",
        config: { algorithm: "dijkstra", sizeField: "grid-size", size: 14, density: 20 },
        stride: 5,
        maxBeats: 38,
        maxSteps: 320,
        requireDone: true,
        outro: ["Cheapest first.", "<em>Provably optimal.</em>"]
    }
];

module.exports = { SCENES };
