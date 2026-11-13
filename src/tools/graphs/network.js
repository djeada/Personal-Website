/*
 * Graphs tool, Network mode: nodes and edges instead of the grid.
 *
 * This file is separate from app.js (the grid). It adds a Grid / Network switch,
 * its own canvas, a data panel under the graph and its own sidebar cards. The
 * page's Start / Pause / Step / Reset buttons drive whichever view is showing.
 *
 * Every algorithm is run once, up front, into a list of frames. Step, Back,
 * Play and Reset only move through that list, so any state is reproducible:
 * the same URL and the same number of steps always show the same picture.
 *
 * URL parameters (all optional):
 *   mode=network        open in Network mode (otherwise the grid opens)
 *   preset=NAME         course-schedule | course-schedule-cycle | diamond | diamond-cycle |
 *                       network-delay | cheapest-flights | floyd | square | triangle |
 *                       two-piece | flowers | mst | points
 *   algo=NAME           kahn | dfs3 | dijkstra | bellman-ford | floyd | bipartite | greedy |
 *                       kruskal | prim   (defaults to the preset's own algorithm)
 *   src=LABEL           start node (Dijkstra, Bellman-Ford, Prim, DFS)
 *   k=1                 Bellman-Ford stops (k + 1 passes)
 *   copy=0              Bellman-Ford without the copied row (shows the wrong answer)
 *   build=1             Kahn: start with no arrows and draw one per pair
 *   colors=2            DFS: plain visited / unvisited instead of white / gray / black
 *   edges=0>1:4,1-2     a custom graph ("a>b" directed, "a-b" undirected, ":w" weight)
 *   steps=N | end       jump N steps in (or to the end) as soon as the page loads
 *   speed=5             1..10, shared with the grid
 *
 * For recorders: #network-canvas carries data-state (idle | running | paused | done),
 * data-algorithm, data-preset, data-step, data-steps and data-result; #search-status
 * shows the step's one-line trace. window.GraphsDebug.network (also
 * window.GraphsNetwork) has step(n), back(n), goto(i), end(), reset(), play(),
 * pause(), load({...}) and state(), which returns the current frame as plain data.
 */
(function () {
    "use strict";

    const INF = Infinity;
    const TWEEN_MS = 240;

    // ------------------------------------------------------------------ presets

    const PRESETS = {
        "course-schedule": {
            title: "Course Schedule",
            algo: "kahn",
            directed: true,
            nodes: [["0", .05, .5], ["1", .33, .14], ["2", .33, .86], ["3", .6, .5], ["4", .93, .3], ["5", .66, .94]],
            // LeetCode pairs [a, b]: take b before a, so the arrow is b -> a.
            pairs: [[1, 0], [2, 0], [3, 1], [3, 2], [4, 3], [5, 2]]
        },
        "course-schedule-cycle": {
            title: "Course Schedule with a cycle",
            algo: "kahn",
            directed: true,
            nodes: [["0", .05, .5], ["1", .33, .14], ["2", .33, .86], ["3", .6, .5], ["4", .93, .3], ["5", .66, .94]],
            pairs: [[1, 0], [2, 0], [3, 1], [3, 2], [4, 3], [5, 2], [1, 4]],
            bends: { "4>1": .16 }
        },
        "diamond": {
            title: "Directed diamond",
            algo: "dfs3",
            directed: true,
            nodes: [["A", .5, .06], ["B", .26, .5], ["C", .74, .5], ["D", .5, .94]],
            edges: ["A>B", "A>C", "B>D", "C>D"]
        },
        "diamond-cycle": {
            title: "Diamond plus D to A",
            algo: "dfs3",
            directed: true,
            nodes: [["A", .5, .06], ["B", .26, .5], ["C", .74, .5], ["D", .5, .94]],
            edges: ["A>B", "A>C", "B>D", "C>D", "D>A"]
        },
        "network-delay": {
            title: "Network Delay Time",
            algo: "dijkstra",
            directed: true,
            weighted: true,
            src: "1",
            nodes: [["1", .05, .5], ["2", .45, .1], ["3", .45, .9], ["4", .93, .1], ["5", .93, .9]],
            edges: ["1>2:1", "1>3:7", "2>3:3", "2>4:4", "3>5:2", "4>5:3"]
        },
        "cheapest-flights": {
            title: "Cheapest Flights Within K Stops",
            algo: "bellman-ford",
            directed: true,
            weighted: true,
            src: "0",
            dst: "3",
            k: 1,
            nodes: [["0", .05, .55], ["1", .36, .1], ["2", .6, .82], ["3", .95, .4]],
            // Order matters: 1 -> 2 is read before 2 -> 3, so without the copy the
            // second pass chains both flights.
            edges: ["1>2:100", "2>3:100", "0>1:100", "0>2:300"]
        },
        "floyd": {
            title: "Five cities, all pairs",
            algo: "floyd",
            weighted: true,
            nodes: [["0", .07, .42], ["1", .5, .07], ["2", .5, .55], ["3", .93, .42], ["4", .5, .95]],
            edges: ["0-1:3", "1-2:1", "2-3:2", "3-4:1", "0-4:2", "1-3:5", "0-2:7"]
        },
        "square": {
            title: "Square",
            algo: "bipartite",
            nodes: [["0", .3, .1], ["1", .7, .1], ["2", .7, .9], ["3", .3, .9]],
            edges: ["0-1", "1-2", "2-3", "3-0"]
        },
        "triangle": {
            title: "Triangle",
            algo: "bipartite",
            nodes: [["0", .5, .08], ["1", .27, .9], ["2", .73, .9]],
            edges: ["0-1", "0-2", "1-2"]
        },
        "two-piece": {
            title: "Two pieces",
            algo: "bipartite",
            nodes: [["0", .06, .12], ["1", .36, .12], ["2", .36, .88], ["3", .06, .88], ["4", .78, .1], ["5", .6, .9], ["6", .96, .9]],
            edges: ["0-1", "1-2", "2-3", "3-0", "4-5", "4-6", "5-6"]
        },
        "flowers": {
            title: "Flower Planting",
            algo: "greedy",
            // A prism: every garden has exactly 3 neighbours, and greedy in label order needs the 4th type.
            nodes: [["1", .5, .04], ["2", .1, .95], ["3", .9, .95], ["4", .5, .38], ["5", .36, .72], ["6", .64, .72]],
            edges: ["1-2", "1-3", "2-3", "1-4", "2-5", "3-6", "4-5", "4-6", "5-6"]
        },
        "mst": {
            title: "Seven towns",
            algo: "kruskal",
            weighted: true,
            src: "A",
            nodes: [["A", .05, .5], ["B", .27, .07], ["C", .73, .07], ["D", .95, .5], ["E", .73, .93], ["F", .27, .93], ["G", .5, .5]],
            edges: ["A-B:4", "B-C:3", "C-D:7", "D-E:6", "E-F:9", "F-A:11", "C-G:1", "B-G:2", "A-G:5", "E-G:8", "F-G:10", "D-G:12"]
        },
        "points": {
            title: "Connect All Points",
            algo: "prim",
            weighted: true,
            // LeetCode 1584 example: Manhattan distance between every pair, answer 20.
            points: [[0, 0], [2, 2], [3, 10], [5, 2], [7, 0]]
        }
    };

    const ALGOS = {
        kahn: { name: "Kahn's algorithm (topological sort)", short: "Kahn", needs: "directed", preset: "course-schedule" },
        dfs3: { name: "DFS cycle check (three colors)", short: "DFS 3-color", needs: "directed", preset: "diamond" },
        dijkstra: { name: "Dijkstra (min-heap)", short: "Dijkstra", needs: "any", preset: "network-delay" },
        "bellman-ford": { name: "Bellman-Ford, at most k stops", short: "Bellman-Ford", needs: "directed", preset: "cheapest-flights" },
        floyd: { name: "Floyd-Warshall (all pairs)", short: "Floyd-Warshall", needs: "any", preset: "floyd" },
        bipartite: { name: "Bipartite check (BFS 2-coloring)", short: "Bipartite", needs: "undirected", preset: "square" },
        greedy: { name: "Greedy coloring", short: "Greedy color", needs: "undirected", preset: "flowers" },
        kruskal: { name: "Kruskal (MST, union-find)", short: "Kruskal", needs: "undirected", preset: "mst" },
        prim: { name: "Prim (MST, min-heap)", short: "Prim", needs: "undirected", preset: "mst" }
    };

    const ALGO_ALIASES = {
        topo: "kahn", topological: "kahn", "three-color": "dfs3", "dfs-cycle": "dfs3", cycle: "dfs3",
        bf: "bellman-ford", bellman: "bellman-ford", "bellman-ford-k": "bellman-ford",
        "floyd-warshall": "floyd", fw: "floyd", "2-color": "bipartite", coloring: "greedy", greedy_coloring: "greedy",
        mst: "kruskal"
    };

    function parseEdgeSpec(spec) {
        const match = /^\s*([\w()]+)\s*([>-])\s*([\w()]+)\s*(?::\s*(-?\d+))?\s*$/.exec(spec);
        if (!match) return null;
        return { a: match[1], b: match[3], directed: match[2] === ">", w: match[4] === undefined ? 1 : Number(match[4]) };
    }

    function circleLayout(labels) {
        const n = labels.length;
        return labels.map((label, i) => {
            const angle = -Math.PI / 2 + (2 * Math.PI * i) / Math.max(1, n);
            return [label, .5 + .45 * Math.cos(angle), .5 + .45 * Math.sin(angle)];
        });
    }

    function buildGraph(key, def) {
        let nodeDefs = def.nodes;
        let specs = def.edges;
        if (def.points) {
            const xs = def.points.map((p) => p[0]), ys = def.points.map((p) => p[1]);
            const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
            nodeDefs = def.points.map(([x, y], i) => [String(i), (x - x0) / Math.max(1, x1 - x0), 1 - (y - y0) / Math.max(1, y1 - y0)]);
            specs = [];
            for (let i = 0; i < def.points.length; i++) {
                for (let j = i + 1; j < def.points.length; j++) {
                    const [a, b] = [def.points[i], def.points[j]];
                    specs.push(`${i}-${j}:${Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1])}`);
                }
            }
        }
        if (!specs && def.pairs) specs = def.pairs.map(([a, b]) => `${b}>${a}`);
        const nodes = nodeDefs.map(([label, x, y], id) => ({ id, label: String(label), x, y }));
        const byLabel = new Map(nodes.map((node) => [node.label, node.id]));
        const edges = [];
        (specs || []).forEach((spec) => {
            const parsed = parseEdgeSpec(spec);
            if (!parsed || !byLabel.has(parsed.a) || !byLabel.has(parsed.b)) return;
            const from = byLabel.get(parsed.a), to = byLabel.get(parsed.b);
            const keyText = `${parsed.a}${parsed.directed ? ">" : "-"}${parsed.b}`;
            edges.push({ id: edges.length, from, to, w: parsed.w, bend: (def.bends && def.bends[keyText]) || 0 });
        });
        const find = (label, fallback) => (label !== undefined && byLabel.has(String(label)) ? byLabel.get(String(label)) : fallback);
        return {
            key,
            title: def.title || "Custom graph",
            directed: Boolean(def.directed),
            weighted: Boolean(def.weighted),
            nodes,
            edges,
            pairs: def.pairs || null,
            src: find(def.src, 0),
            dst: find(def.dst, nodes.length - 1),
            k: def.k === undefined ? 1 : def.k,
            byLabel
        };
    }

    function customGraphFromSpec(text) {
        const specs = text.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
        const parsed = specs.map(parseEdgeSpec).filter(Boolean);
        if (!parsed.length) return null;
        const labels = [];
        parsed.forEach((e) => [e.a, e.b].forEach((l) => { if (!labels.includes(l)) labels.push(l); }));
        const numeric = labels.every((l) => /^\d+$/.test(l));
        if (numeric) labels.sort((a, b) => Number(a) - Number(b));
        return buildGraph("custom", {
            title: "Custom graph",
            directed: parsed.some((e) => e.directed),
            weighted: parsed.some((e) => e.w !== 1),
            nodes: circleLayout(labels),
            edges: specs
        });
    }

    function graphToSpec(g) {
        return g.edges.map((e) => `${g.nodes[e.from].label}${g.directed ? ">" : "-"}${g.nodes[e.to].label}${g.weighted || e.w !== 1 ? ":" + e.w : ""}`).join(",");
    }

    // ------------------------------------------------------------------ helpers

    const fmt = (v) => (v === INF || v === null || v === undefined ? "inf" : String(v));
    const plain = (v) => (v === INF ? null : v);
    const plural = (n, word, many) => `${n} ${n === 1 ? word : (many || word + "s")}`;
    const listText = (items) => (items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`);

    function outEdges(g) {
        const out = g.nodes.map(() => []);
        g.edges.forEach((e) => {
            out[e.from].push({ e, to: e.to });
            if (!g.directed) out[e.to].push({ e, to: e.from });
        });
        return out;
    }

    function undirectedAdj(g) {
        const adj = g.nodes.map(() => []);
        g.edges.forEach((e) => {
            adj[e.from].push({ e, to: e.to });
            if (e.from !== e.to) adj[e.to].push({ e, to: e.from });
        });
        return adj;
    }

    // Records a run as a list of frames. Node and edge states persist from frame
    // to frame; "ring" (current node) and "hot" (edges touched this step) do not.
    class Trace {
        constructor(g) {
            this.g = g;
            this.frames = [];
            this.ns = {};
            this.es = {};
        }
        node(id, props) { this.ns[id] = Object.assign({}, this.ns[id], props); }
        edge(id, props) { this.es[id] = Object.assign({}, this.es[id], props); }
        push(status, opts = {}) {
            const clone = (map) => {
                const out = {};
                Object.keys(map).forEach((key) => { out[key] = Object.assign({}, map[key]); });
                return out;
            };
            this.frames.push({
                status,
                nodes: clone(this.ns),
                edges: clone(this.es),
                ring: opts.ring || [],
                hot: opts.hot || {},
                outline: opts.outline || null,
                panel: opts.panel || [],
                data: opts.data || {},
                result: opts.result || "",
                done: Boolean(opts.done)
            });
        }
    }

    const L = (g, id) => g.nodes[id].label;
    const edgeKey = (g, e, from = e.from, to = e.to) => `${L(g, from)}${g.directed ? ">" : "-"}${L(g, to)}`;

    // ------------------------------------------------------------------ Kahn

    function runKahn(g, opt) {
        const t = new Trace(g);
        const n = g.nodes.length;
        const out = outEdges(g);
        const pairs = g.pairs;
        const noun = pairs ? "course" : "node";
        const build = Boolean(opt.build && pairs);
        const indeg = Array(n).fill(0);
        let showIndeg = false;
        let queue = [];
        const order = [];
        let pairsRead = build ? 0 : (pairs ? pairs.length : 0);
        let pairCurrent = -1;

        const panel = (tones = {}) => {
            const rows = [];
            if (pairs) {
                rows.push({
                    label: "pairs [a, b]",
                    note: "b before a: arrow b to a",
                    cells: pairs.map(([a, b], i) => ({
                        v: `[${a}, ${b}]`,
                        tone: i === pairCurrent ? "current" : (i < pairsRead ? "" : "pending")
                    }))
                });
            }
            rows.push({
                label: "indegree",
                keyed: true,
                cells: g.nodes.map((node) => ({
                    k: node.label,
                    v: showIndeg ? String(indeg[node.id]) : "",
                    tone: tones[node.id] || (tones.left && !order.includes(node.id) ? "target" : "") || (showIndeg && indeg[node.id] === 0 && !order.includes(node.id) ? "zero" : (order.includes(node.id) ? "muted" : ""))
                }))
            });
            rows.push({ label: "queue", note: "front at the left", cells: queue.map((id) => ({ v: L(g, id), tone: "queued" })), empty: "empty" });
            rows.push({ label: "order", note: `${order.length} of ${n}`, cells: order.map((id, i) => ({ v: L(g, id), tone: i === order.length - 1 && tones.justOut ? "current" : "done" })), empty: "-" });
            return rows;
        };
        const data = (extra = {}) => Object.assign({
            order: order.map((id) => L(g, id)),
            queue: queue.map((id) => L(g, id)),
            indegree: showIndeg ? Object.fromEntries(g.nodes.map((node) => [node.label, indeg[node.id]])) : null
        }, extra);
        const tag = (id) => t.node(id, { tag: String(indeg[id]), tagTone: indeg[id] === 0 ? "zero" : "" });

        if (build) g.edges.forEach((e) => t.edge(e.id, { state: "hidden" }));
        t.push(build ?
            `${g.title}: ${plural(n, "course")}, ${plural(pairs.length, "pair")}. Each pair [a, b] means take b first, so the arrow goes b to a.` :
            `${g.title}: ${plural(n, noun)}, ${plural(g.edges.length, "arrow")}. Press Step to count indegrees.`, { panel: panel(), data: data() });

        if (build) {
            pairs.forEach(([a, b], i) => {
                pairCurrent = i;
                pairsRead = i + 1;
                const e = g.edges[i];
                if (i > 0) t.edge(g.edges[i - 1].id, { state: "" });
                t.edge(e.id, { state: "" });
                t.push(`Pair [${a}, ${b}]: take ${b} before ${a}, so the arrow goes from ${b} to ${a}.`, {
                    panel: panel(), data: data(), hot: { [e.id]: "new" }, ring: []
                });
            });
            pairCurrent = -1;
        }

        g.edges.forEach((e) => { indeg[e.to] += 1; });
        showIndeg = true;
        g.nodes.forEach((node) => tag(node.id));
        const zeros = g.nodes.filter((node) => indeg[node.id] === 0).map((node) => node.label);
        t.push(`Count the arrows coming into each node: that is its indegree. Indegree 0: ${zeros.length ? listText(zeros) : "none"}.`, { panel: panel(), data: data() });

        queue = g.nodes.filter((node) => indeg[node.id] === 0).map((node) => node.id);
        queue.forEach((id) => t.node(id, { state: "queued" }));
        t.push(queue.length ?
            `Queue every node with indegree 0: ${listText(queue.map((id) => L(g, id)))}. Everything else waits.` :
            "No node has indegree 0, so the queue starts empty.", { panel: panel(), data: data() });

        while (queue.length) {
            const u = queue.shift();
            order.push(u);
            t.node(u, { state: "done", tag: null });
            const hot = {};
            const tones = { justOut: true };
            const joined = [];
            const counted = [];
            out[u].forEach(({ e, to }) => {
                t.edge(e.id, { state: "used" });
                hot[e.id] = "used";
                indeg[to] -= 1;
                tag(to);
                tones[to] = "changed";
                counted.push(`${L(g, to)} drops to ${indeg[to]}`);
                if (indeg[to] === 0) {
                    queue.push(to);
                    joined.push(L(g, to));
                    t.node(to, { state: "queued" });
                }
            });
            let text = `Take ${L(g, u)} from the queue and add it to the order.`;
            if (out[u].length) text += ` Remove its arrows. Indegree of ${counted.join(", ")}.`;
            else text += " It has no outgoing arrows.";
            if (joined.length) text += ` ${listText(joined)} ${joined.length === 1 ? "reaches" : "reach"} 0 and ${joined.length === 1 ? "joins" : "join"} the queue.`;
            t.push(text, { panel: panel(tones), data: data(), ring: [u], hot });
        }

        const leftover = g.nodes.filter((node) => !order.includes(node.id)).map((node) => node.id);
        leftover.forEach((id) => t.node(id, { state: "rejected" }));
        g.edges.forEach((e) => {
            if (leftover.includes(e.from) && leftover.includes(e.to)) t.edge(e.id, { state: "cycle" });
        });
        const ok = leftover.length === 0;
        const status = ok ?
            `Queue empty. ${order.length} of ${n} ${noun}s in the order: a valid schedule.` :
            `Queue empty. ${order.length} of ${n} ${noun}s in the order: cycle. ${listText(leftover.map((id) => L(g, id)))} never reach indegree 0.`;
        t.push(status, {
            panel: panel({ left: !ok }),
            data: data({ leftover: leftover.map((id) => L(g, id)), cycle: !ok }),
            result: order.map((id) => L(g, id)).join(",") + (ok ? "" : " cycle"),
            done: true
        });
        return t.frames;
    }

    // ------------------------------------------------------------------ DFS, three colors

    function runDfs3(g, opt) {
        const t = new Trace(g);
        const three = opt.colors !== 2;
        const out = outEdges(g);
        const n = g.nodes.length;
        const color = Array(n).fill(0); // 0 white, 1 gray, 2 black
        const parent = Array(n).fill(-1);
        const finished = [];
        const path = [];
        const names = three ? ["white", "gray", "black"] : ["not visited", "visited", "visited"];
        const paint = (id) => t.node(id, { state: three ? ["", "gray", "black"][color[id]] : (color[id] ? "done" : "") });

        const panel = () => {
            const rows = [{
                label: three ? "color" : "visited",
                keyed: true,
                cells: g.nodes.map((node) => ({
                    k: node.label,
                    v: three ? ["W", "G", "B"][color[node.id]] : (color[node.id] ? "yes" : "no"),
                    tone: three ? ["white", "gray", "black"][color[node.id]] : (color[node.id] ? "done" : "")
                }))
            }, {
                label: three ? "on the path" : "call stack",
                note: three ? "gray nodes, open calls" : "",
                cells: path.map((id) => ({ v: L(g, id), tone: three ? "gray" : "queued" })),
                empty: "empty"
            }];
            if (three) rows.push({ label: "finished", note: "black, in order", cells: finished.map((id) => ({ v: L(g, id), tone: "black" })), empty: "-" });
            return rows;
        };
        const data = (extra = {}) => Object.assign({
            colors: Object.fromEntries(g.nodes.map((node) => [node.label, names[color[node.id]]])),
            path: path.map((id) => L(g, id)),
            finished: finished.map((id) => L(g, id)),
            cycleEdge: null
        }, extra);

        t.push(three ?
            `${g.title}. White: not visited. Gray: its call is open. Black: finished.` :
            `${g.title}. DFS marks each node visited, like the undirected cycle test.`, { panel: panel(), data: data() });

        const starts = [g.src].concat(g.nodes.map((node) => node.id).filter((id) => id !== g.src));
        for (const s of starts) {
            if (color[s] !== 0) continue;
            color[s] = 1;
            path.push(s);
            paint(s);
            t.push(three ? `Visit ${L(g, s)}: it turns gray, its call is open.` : `Visit ${L(g, s)} and mark it visited.`, { panel: panel(), data: data(), ring: [s] });
            const stack = [{ u: s, i: 0 }];
            while (stack.length) {
                const top = stack[stack.length - 1];
                const u = top.u;
                if (top.i < out[u].length) {
                    const { e, to: v } = out[u][top.i++];
                    if (color[v] === 0) {
                        color[v] = 1;
                        parent[v] = u;
                        path.push(v);
                        paint(v);
                        t.edge(e.id, { state: "tree" });
                        t.push(three ?
                            `${L(g, u)} to ${L(g, v)}: ${L(g, v)} is white. Go deeper, ${L(g, v)} turns gray.` :
                            `${L(g, u)} to ${L(g, v)}: not visited yet. Go deeper and mark it.`, { panel: panel(), data: data(), ring: [v], hot: { [e.id]: "active" } });
                        stack.push({ u: v, i: 0 });
                    } else if (color[v] === 1 && three) {
                        t.edge(e.id, { state: "conflict" });
                        const from = path.indexOf(v);
                        const loop = path.slice(from);
                        const outlineIds = loop.concat([v]);
                        t.push(`${L(g, u)} to ${L(g, v)}: ${L(g, v)} is gray, still on the path ${listText(path.map((id) => L(g, id)))}. That arrow closes a cycle.`, {
                            panel: panel(),
                            data: data({ cycleEdge: edgeKey(g, e), cycle: true, cycleNodes: loop.map((id) => L(g, id)) }),
                            ring: [v],
                            hot: { [e.id]: "conflict" },
                            outline: outlineIds,
                            result: `cycle ${edgeKey(g, e)}`,
                            done: true
                        });
                        return t.frames;
                    } else if (three) {
                        t.edge(e.id, { state: "checked" });
                        t.push(`${L(g, u)} to ${L(g, v)}: ${L(g, v)} is black, already finished. Reaching a black node is fine: no cycle.`, {
                            panel: panel(), data: data(), ring: [u], hot: { [e.id]: "checked" }
                        });
                    } else {
                        const isParent = parent[u] === v;
                        t.edge(e.id, { state: "seen" });
                        t.push(isParent ?
                            `${L(g, u)} to ${L(g, v)}: ${L(g, v)} is the parent. Skip.` :
                            `${L(g, u)} to ${L(g, v)}: ${L(g, v)} is visited and is not ${L(g, u)}'s parent. Yet both arrows point down: no cycle here.`, {
                            panel: panel(), data: data(), ring: [u], hot: { [e.id]: "seen" }
                        });
                    }
                } else {
                    stack.pop();
                    path.pop();
                    color[u] = 2;
                    finished.push(u);
                    paint(u);
                    t.push(three ?
                        `${L(g, u)} has no arrows left: finished, it turns black.` :
                        `${L(g, u)} has no arrows left: return.`, { panel: panel(), data: data(), ring: stack.length ? [stack[stack.length - 1].u] : [] });
                }
            }
        }
        t.push(three ?
            "Done. Every node is black and no arrow reached a gray node: no cycle." :
            "Done. Every node is visited. No cycle was reported.", {
            panel: panel(), data: data({ cycle: false }), result: "no cycle", done: true
        });
        return t.frames;
    }

    // ------------------------------------------------------------------ Dijkstra

    function runDijkstra(g) {
        const t = new Trace(g);
        const out = outEdges(g);
        const n = g.nodes.length;
        const dist = Array(n).fill(INF);
        const final = Array(n).fill(false);
        const via = Array(n).fill(null);
        let heap = [];
        let seq = 0;
        let popped = null;
        const negative = g.edges.some((e) => e.w < 0);

        const sortHeap = () => heap.sort((a, b) => a.d - b.d || a.v - b.v || a.seq - b.seq);
        const entry = (x) => `(${x.d}, ${L(g, x.v)})`;
        const panel = (changed = {}) => [{
            label: "dist",
            keyed: true,
            cells: g.nodes.map((node) => ({
                k: node.label,
                v: fmt(dist[node.id]),
                tone: changed[node.id] ? "changed" : (final[node.id] ? "done" : "")
            }))
        }, {
            label: "popped",
            cells: popped ? [{ v: entry(popped), tone: popped.stale ? "stale" : "current", sub: popped.stale ? "stale, skip" : "final" }] : [],
            empty: "-"
        }, {
            label: "min-heap",
            note: "sorted, smallest first",
            cells: heap.map((x) => ({ v: entry(x), tone: x.d > dist[x.v] ? "stale" : (changed[x.v] && x.d === dist[x.v] ? "new" : ""), sub: x.d > dist[x.v] ? "stale" : "" })),
            empty: "empty"
        }];
        const data = (extra = {}) => Object.assign({
            dist: Object.fromEntries(g.nodes.map((node) => [node.label, plain(dist[node.id])])),
            heap: heap.map((x) => [x.d, L(g, x.v), x.d > dist[x.v]]),
            popped: popped ? [popped.d, L(g, popped.v), popped.stale] : null
        }, extra);
        const tagAll = () => g.nodes.forEach((node) => {
            if (dist[node.id] !== INF) t.node(node.id, { tag: String(dist[node.id]), tagTone: final[node.id] ? "done" : "" });
        });

        t.push(`${g.title}: start at ${L(g, g.src)}. Every distance starts at inf.` + (negative ? " Warning: a negative weight breaks Dijkstra." : ""), { panel: panel(), data: data() });
        dist[g.src] = 0;
        heap.push({ d: 0, v: g.src, seq: seq++ });
        t.node(g.src, { state: "queued" });
        tagAll();
        t.push(`dist[${L(g, g.src)}] = 0. Push (0, ${L(g, g.src)}) onto the heap.`, { panel: panel({ [g.src]: true }), data: data(), ring: [g.src] });

        while (heap.length) {
            sortHeap();
            const top = heap.shift();
            if (top.d > dist[top.v]) {
                popped = { d: top.d, v: top.v, stale: true };
                t.push(`Pop (${top.d}, ${L(g, top.v)}): ${top.d} > dist[${L(g, top.v)}] = ${dist[top.v]}. Stale entry: skip it.`, {
                    panel: panel(), data: data({ stale: entry(top) }), ring: [top.v]
                });
                continue;
            }
            popped = { d: top.d, v: top.v, stale: false };
            const u = top.v;
            final[u] = true;
            t.node(u, { state: "done" });
            if (via[u] !== null) t.edge(via[u], { state: "tree" });
            const hot = {};
            const changed = {};
            const notes = [];
            out[u].forEach(({ e, to: v }) => {
                if (final[v]) return;
                const alt = dist[u] + e.w;
                if (alt < dist[v]) {
                    const before = dist[v];
                    dist[v] = alt;
                    via[v] = e.id;
                    heap.push({ d: alt, v, seq: seq++ });
                    t.node(v, { state: "queued" });
                    hot[e.id] = "active";
                    changed[v] = true;
                    notes.push(`${L(g, u)} to ${L(g, v)}: ${dist[u]} + ${e.w} = ${alt} < ${fmt(before)}, push (${alt}, ${L(g, v)})`);
                } else {
                    hot[e.id] = "seen";
                    notes.push(`${L(g, u)} to ${L(g, v)}: ${dist[u]} + ${e.w} = ${alt}, not better than ${dist[v]}`);
                }
            });
            sortHeap();
            tagAll();
            t.push(`Pop (${top.d}, ${L(g, u)}): dist[${L(g, u)}] = ${dist[u]} is final.` + (notes.length ? ` ${notes.join(". ")}.` : " No edges to relax."), {
                panel: panel(changed), data: data(), ring: [u], hot
            });
        }
        popped = null;
        const reachable = dist.filter((d) => d !== INF);
        const answer = reachable.length === n ? Math.max(...reachable) : -1;
        t.push(answer >= 0 ?
            `Heap empty. Every distance is final. The largest is ${answer}, so the signal reaches every node at time ${answer}.` :
            `Heap empty. Some node is unreachable, so Network Delay Time is -1.`, {
            panel: panel(), data: data({ answer }), result: String(answer), done: true
        });
        return t.frames;
    }

    // ------------------------------------------------------------------ Bellman-Ford, at most k stops

    function bellmanFordCore(g, k, copy) {
        const n = g.nodes.length;
        const dist = Array(n).fill(INF);
        const route = Array(n).fill(null);
        dist[g.src] = 0;
        route[g.src] = [g.src];
        for (let pass = 0; pass <= k; pass++) {
            const prev = dist.slice(), prevRoute = route.slice();
            g.edges.forEach((e) => {
                const from = copy ? prev[e.from] : dist[e.from];
                if (from !== INF && from + e.w < dist[e.to]) {
                    dist[e.to] = from + e.w;
                    route[e.to] = (copy ? prevRoute[e.from] : route[e.from]).concat([e.to]);
                }
            });
        }
        return { dist, route };
    }

    function runBellmanFord(g, opt) {
        const t = new Trace(g);
        const n = g.nodes.length;
        const k = Number.isFinite(opt.k) ? opt.k : g.k;
        const copy = opt.copy !== false;
        const passes = k + 1;
        const dst = g.dst;
        const dist = Array(n).fill(INF);
        const route = Array(n).fill(null);
        let prev = null, prevRoute = null;
        let pass = 0;
        let edgeIndex = -1;
        const truth = bellmanFordCore(g, k, true);

        const panel = (opts = {}) => {
            const rows = [{
                kind: "badges",
                items: [
                    { text: `k = ${k}: at most ${k + 1} flight${k + 1 === 1 ? "" : "s"}` },
                    { text: pass ? `pass ${pass} of ${passes}` : `${passes} pass${passes === 1 ? "" : "es"}`, tone: pass ? "accent" : "" },
                    { text: copy ? "reads the copy" : "no copy: reads the live row", tone: copy ? "" : "warn" }
                ]
            }];
            rows.push({
                label: copy ? "copy (prev)" : "copy",
                note: copy ? (pass ? `frozen at the start of pass ${pass}` : "") : "not made",
                keyed: true,
                muted: !copy,
                cells: g.nodes.map((node) => ({
                    k: node.label,
                    v: copy && prev ? fmt(prev[node.id]) : "-",
                    tone: copy && opts.read === node.id ? "read" : (copy ? "frozen" : "muted")
                }))
            });
            rows.push({
                label: "dist (live)",
                keyed: true,
                cells: g.nodes.map((node) => ({
                    k: node.label,
                    v: fmt(dist[node.id]),
                    tone: opts.wrong && node.id === dst ? "wrong" : (opts.wrote === node.id ? "changed" : (!copy && opts.read === node.id ? "read" : (node.id === dst ? "target" : "")))
                }))
            });
            rows.push({
                label: "flights",
                note: "every pass reads them in this order",
                cells: g.edges.map((e, i) => ({ v: `${L(g, e.from)}>${L(g, e.to)}`, sub: String(e.w), arrow: true, tone: i === edgeIndex ? "current" : (pass && i < edgeIndex ? "done" : "") }))
            });
            return rows;
        };
        const data = (extra = {}) => Object.assign({
            pass, passes, k, copy,
            dist: dist.map(plain),
            prev: prev ? prev.map(plain) : null
        }, extra);
        const tagAll = () => g.nodes.forEach((node) => {
            if (dist[node.id] !== INF) t.node(node.id, { tag: String(dist[node.id]) });
        });

        t.node(g.src, { state: "done" });
        t.node(dst, { state: "target" });
        dist[g.src] = 0;
        route[g.src] = [g.src];
        tagAll();
        t.push(`${g.title}: from ${L(g, g.src)} to ${L(g, dst)} with k = ${k}. ${k} stop${k === 1 ? "" : "s"} means ${k + 1} flights, so ${passes} passes.`, { panel: panel(), data: data() });

        for (pass = 1; pass <= passes; pass++) {
            edgeIndex = -1;
            prev = dist.slice();
            prevRoute = route.slice();
            t.push(copy ?
                `Pass ${pass} of ${passes}: copy dist into prev. Every flight reads prev and writes dist.` :
                `Pass ${pass} of ${passes}, no copy: every flight reads and writes the same row.`, { panel: panel(), data: data() });
            for (edgeIndex = 0; edgeIndex < g.edges.length; edgeIndex++) {
                const e = g.edges[edgeIndex];
                const source = copy ? prev : dist;
                const from = source[e.from];
                const rowName = copy ? "prev" : "dist";
                const name = `${L(g, e.from)} to ${L(g, e.to)} (${e.w})`;
                let text, wrote = null, hotTone = "seen";
                if (from === INF) {
                    text = `${name}: ${rowName}[${L(g, e.from)}] is inf, skip.`;
                } else if (from + e.w < dist[e.to]) {
                    const before = dist[e.to];
                    dist[e.to] = from + e.w;
                    route[e.to] = (copy ? prevRoute[e.from] : route[e.from]).concat([e.to]);
                    wrote = e.to;
                    hotTone = "active";
                    const fresh = !copy && prev[e.from] !== dist[e.from];
                    text = `${name}: ${rowName}[${L(g, e.from)}] + ${e.w} = ${dist[e.to]} < ${fmt(before)}. dist[${L(g, e.to)}] = ${dist[e.to]}.`;
                    if (fresh) text += ` ${L(g, e.from)} was updated earlier in this pass: two flights in one pass.`;
                } else {
                    text = `${name}: ${rowName}[${L(g, e.from)}] + ${e.w} = ${from + e.w}, not below ${dist[e.to]}. No change.`;
                }
                tagAll();
                t.push(text, { panel: panel({ read: e.from, wrote }), data: data(), hot: { [e.id]: hotTone }, ring: [e.to] });
            }
        }
        pass = passes;
        edgeIndex = -1;
        const answer = dist[dst] === INF ? -1 : dist[dst];
        const correct = truth.dist[dst] === INF ? -1 : truth.dist[dst];
        const path = route[dst] || [];
        const flights = Math.max(0, path.length - 1);
        const wrong = answer !== correct;
        for (let i = 1; i < path.length; i++) {
            const e = g.edges.find((x) => x.from === path[i - 1] && x.to === path[i]);
            if (e) t.edge(e.id, { state: wrong ? "conflict" : "tree" });
        }
        if (wrong) t.node(dst, { state: "rejected" });
        const routeText = path.map((id) => L(g, id)).join(", ");
        const status = answer < 0 ?
            `Done after ${passes} passes: ${L(g, dst)} is not reachable within ${k} stops. Answer -1.` :
            wrong ?
                `Done. dist[${L(g, dst)}] = ${answer}, but the route ${routeText} takes ${flights} flights and k = ${k} allows ${k + 1}. Wrong: the right price is ${correct}.` :
                `Done after ${passes} passes. dist[${L(g, dst)}] = ${answer}: route ${routeText}, ${plural(flights, "flight")}, ${plural(Math.max(0, flights - 1), "stop")}.`;
        t.push(status, {
            panel: panel({ wrong }),
            data: data({ answer, correct, wrong, route: path.map((id) => L(g, id)), flights }),
            result: wrong ? `${answer} wrong` : String(answer),
            done: true
        });
        return t.frames;
    }

    // ------------------------------------------------------------------ Floyd-Warshall

    function runFloyd(g) {
        const t = new Trace(g);
        const n = g.nodes.length;
        const d = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 0 : INF)));
        g.edges.forEach((e) => {
            d[e.from][e.to] = Math.min(d[e.from][e.to], e.w);
            if (!g.directed) d[e.to][e.from] = Math.min(d[e.to][e.from], e.w);
        });
        const labels = g.nodes.map((node) => node.label);
        const matrix = (k, changes) => ({
            kind: "matrix",
            label: "dist[i][j]",
            labels,
            k,
            rows: d.map((row, i) => row.map((v, j) => {
                const change = changes && changes.find((c) => c.i === i && c.j === j);
                return { v: fmt(v), old: change ? fmt(change.old) : null, tone: change ? "changed" : (i === j ? "diag" : "") };
            }))
        });
        const data = (k, changes) => ({
            k,
            matrix: d.map((row) => row.map(plain)),
            changed: (changes || []).map((c) => [labels[c.i], labels[c.j], plain(c.old), c.now])
        });

        t.push(`${g.title}: the matrix starts with the direct edges, 0 on the diagonal and inf elsewhere.`, {
            panel: [{ kind: "badges", items: [{ text: "for k: for i: for j:" }, { text: "k loop outermost", tone: "accent" }] }, matrix(-1)],
            data: data(-1)
        });
        for (let k = 0; k < n; k++) {
            const changes = [];
            for (let i = 0; i < n; i++) {
                for (let j = 0; j < n; j++) {
                    if (d[i][k] + d[k][j] < d[i][j]) {
                        changes.push({ i, j, old: d[i][j], now: d[i][k] + d[k][j] });
                        d[i][j] = d[i][k] + d[k][j];
                    }
                }
            }
            g.nodes.forEach((node) => t.node(node.id, { state: node.id < k ? "done" : (node.id === k ? "k" : "") }));
            const shown = changes.filter((c) => g.directed || c.i < c.j);
            const hot = {};
            g.edges.forEach((e) => { if (e.from === k || e.to === k) hot[e.id] = "active"; });
            const list = shown.map((c) => `${labels[c.i]}-${labels[c.j]} ${fmt(c.old)} to ${c.now}`);
            t.push(`k = ${labels[k]}: is going through ${labels[k]} shorter? ` + (shown.length ?
                `${plural(shown.length, "pair")} ${shown.length === 1 ? "gets" : "get"} shorter: ${list.join(", ")}.` :
                "No pair gets shorter."), {
                panel: [{ kind: "badges", items: [{ text: `k = ${labels[k]}`, tone: "accent" }, { text: `${k + 1} of ${n}` }, { text: `${plural(shown.length, "cell")} shorter` }] }, matrix(k, changes)],
                data: data(labels[k], changes),
                ring: [k],
                hot
            });
        }
        g.nodes.forEach((node) => t.node(node.id, { state: "done" }));
        t.push(`Done. After k = ${labels[n - 1]}, every cell is the shortest distance between its pair.`, {
            panel: [{ kind: "badges", items: [{ text: "done", tone: "accent" }, { text: `${n} x ${n} x ${n} = ${n * n * n} checks` }] }, matrix(-1)],
            data: data(null),
            result: d.map((row) => row.map(fmt).join(" ")).join("|"),
            done: true
        });
        return t.frames;
    }

    // ------------------------------------------------------------------ bipartite (BFS 2-coloring)

    function runBipartite(g) {
        const t = new Trace(g);
        const adj = undirectedAdj(g);
        const n = g.nodes.length;
        const color = Array(n).fill(-1);
        const parent = Array(n).fill(-1);
        const starts = [];
        let queue = [];
        let s = -1;
        const names = ["blue", "orange"];

        const panel = (changed = {}) => [{
            label: "color",
            keyed: true,
            note: "-1 uncolored, 0 blue, 1 orange",
            cells: g.nodes.map((node) => ({ k: node.label, v: String(color[node.id]), tone: changed[node.id] ? `c${color[node.id]} changed` : (color[node.id] < 0 ? "" : `c${color[node.id]}`) }))
        }, {
            label: "queue",
            cells: queue.map((id) => ({ v: L(g, id), tone: "queued" })),
            empty: "empty"
        }, {
            label: "outer loop",
            keyed: true,
            note: "for s in range(n)",
            cells: g.nodes.map((node) => ({ k: node.label, v: node.id === s ? "s" : (starts.includes(node.id) ? "BFS" : (node.id < s ? "skip" : "")), tone: node.id === s ? "current" : (starts.includes(node.id) ? "done" : (node.id < s ? "muted" : "")) }))
        }];
        const data = (extra = {}) => Object.assign({
            colors: Object.fromEntries(g.nodes.map((node) => [node.label, color[node.id]])),
            starts: starts.map((id) => L(g, id)),
            bipartite: null,
            conflict: null,
            oddCycle: null
        }, extra);
        const paint = (id) => t.node(id, { state: `c${color[id]}` });

        t.push(`${g.title}: ${plural(n, "node")}, ${plural(g.edges.length, "edge")}. Every color starts at -1.`, { panel: panel(), data: data() });

        let pieces = 0;
        let skipped = [];
        for (s = 0; s < n; s++) {
            if (color[s] !== -1) {
                skipped.push(L(g, s));
                continue;
            }
            pieces += 1;
            starts.push(s);
            color[s] = 0;
            queue = [s];
            paint(s);
            const lead = skipped.length ? `s = ${listText(skipped)}: already colored, skip. ` : "";
            skipped = [];
            t.push(`${lead}s = ${L(g, s)}: uncolored. Color it blue and start a BFS` + (pieces > 1 ? " in a new piece." : "."), { panel: panel({ [s]: true }), data: data(), ring: [s] });
            while (queue.length) {
                const u = queue.shift();
                const changed = {};
                const colored = [];
                const hot = {};
                for (const { e, to: v } of adj[u]) {
                    if (color[v] === -1) {
                        color[v] = 1 - color[u];
                        parent[v] = u;
                        queue.push(v);
                        paint(v);
                        changed[v] = true;
                        colored.push(L(g, v));
                        hot[e.id] = "active";
                    } else if (color[v] === color[u]) {
                        // Odd cycle: both BFS-tree paths up to the common ancestor, plus this edge.
                        const up = (x) => { const p = [x]; while (parent[p[p.length - 1]] !== -1) p.push(parent[p[p.length - 1]]); return p; };
                        const pu = up(u), pv = up(v);
                        const lca = pu.find((x) => pv.includes(x));
                        const cycle = pu.slice(0, pu.indexOf(lca) + 1).concat(pv.slice(0, pv.indexOf(lca)).reverse());
                        t.edge(e.id, { state: "conflict" });
                        cycle.forEach((id) => t.node(id, { conflict: true }));
                        const cycleLabels = cycle.map((id) => L(g, id));
                        t.push(`Edge ${L(g, u)}-${L(g, v)}: both ends are ${names[color[u]]}. ${cycle.length}-node odd cycle ${cycleLabels.join(", ")}: not bipartite.`, {
                            panel: panel(changed),
                            data: data({ bipartite: false, conflict: `${L(g, Math.min(u, v))}-${L(g, Math.max(u, v))}`, oddCycle: cycleLabels }),
                            ring: [u],
                            hot: Object.assign(hot, { [e.id]: "conflict" }),
                            outline: cycle.concat([cycle[0]]),
                            result: "not bipartite",
                            done: true
                        });
                        return t.frames;
                    }
                }
                const want = names[1 - color[u]];
                t.push(colored.length ?
                    `Pop ${L(g, u)} (${names[color[u]]}): color ${listText(colored)} ${want}.` :
                    `Pop ${L(g, u)} (${names[color[u]]}): every neighbor is already ${want}.`, { panel: panel(changed), data: data(), ring: [u], hot });
            }
            if (color.some((c) => c === -1)) {
                t.push("Queue empty: this piece is two-colored. Returning true now would be wrong: the outer loop goes on.", { panel: panel(), data: data() });
            }
        }
        s = n;
        t.push(`${skipped.length ? `s = ${listText(skipped)}: already colored, skip. ` : ""}Every edge joins blue to orange: bipartite.`, {
            panel: panel(), data: data({ bipartite: true }), result: "bipartite", done: true
        });
        return t.frames;
    }

    // ------------------------------------------------------------------ greedy coloring

    function runGreedy(g) {
        const t = new Trace(g);
        const adj = undirectedAdj(g);
        const n = g.nodes.length;
        const degree = adj.map((list) => new Set(list.map((x) => x.to)).size);
        const maxDegree = Math.max(0, ...degree);
        const k = maxDegree + 1;
        const type = Array(n).fill(0);
        let taken = null, chosen = 0;

        const panel = (current = -1) => [{
            kind: "badges",
            items: [{ text: `max degree ${maxDegree}, ${k} colors`, tone: "accent" }, { text: "smallest type no neighbor uses" }]
        }, {
            label: "type",
            keyed: true,
            cells: g.nodes.map((node) => ({ k: node.label, v: type[node.id] ? String(type[node.id]) : "-", tone: node.id === current ? `g${type[node.id] - 1} changed` : (type[node.id] ? `g${type[node.id] - 1}` : "") }))
        }, {
            label: "neighbors use",
            cells: Array.from({ length: k }, (_, i) => ({
                v: String(i + 1),
                tone: taken ? (taken.has(i + 1) ? "rejected" : (chosen === i + 1 ? `g${i}` : "")) : "pending"
            }))
        }];
        const data = (extra = {}) => Object.assign({
            types: Object.fromEntries(g.nodes.map((node) => [node.label, type[node.id] || null])),
            maxDegree,
            colors: k
        }, extra);

        t.push(`${g.title}: every garden touches at most ${maxDegree} others, so ${k} flower types always leave one free.`, { panel: panel(), data: data() });
        for (let u = 0; u < n; u++) {
            taken = new Set(adj[u].map((x) => type[x.to]).filter(Boolean));
            chosen = 1;
            while (taken.has(chosen)) chosen += 1;
            type[u] = chosen;
            t.node(u, { state: `g${chosen - 1}`, tag: null });
            const hot = {};
            adj[u].forEach(({ e }) => { hot[e.id] = "probe"; });
            const used = Array.from(taken).sort((a, b) => a - b);
            t.push(`Garden ${L(g, u)}: ` + (used.length ? `neighbors use type${used.length === 1 ? "" : "s"} ${listText(used.map(String))}.` : "no neighbor has a type yet.") + ` Take type ${chosen}.`, {
                panel: panel(u), data: data(), ring: [u], hot
            });
        }
        taken = null;
        const usedTypes = Math.max(...type);
        t.push(`Done. Every garden differs from its neighbors, using ${usedTypes} of ${k} types.`, {
            panel: panel(), data: data({ used: usedTypes }), result: type.join(","), done: true
        });
        return t.frames;
    }

    // ------------------------------------------------------------------ Kruskal

    function runKruskal(g) {
        const t = new Trace(g);
        const n = g.nodes.length;
        const sorted = g.edges.slice().sort((a, b) => a.w - b.w || a.id - b.id);
        const parent = g.nodes.map((node) => node.id);
        const size = Array(n).fill(1);
        const slot = Array(n).fill(-1); // a component colour per tree, kept by the surviving root
        let nextSlot = 0;
        const status = {};
        let current = -1;
        let accepted = [];
        let total = 0;
        const find = (x) => {
            while (parent[x] !== x) {
                parent[x] = parent[parent[x]];
                x = parent[x];
            }
            return x;
        };
        const paintTrees = () => g.nodes.forEach((node) => {
            const root = find(node.id);
            const s = slot[root];
            t.node(node.id, { state: s < 0 ? "" : `t${s % 4}` });
        });
        const panel = () => [{
            kind: "badges",
            items: [{ text: `${accepted.length} of ${n - 1} edges`, tone: accepted.length === n - 1 ? "accent" : "" }, { text: `total ${total}`, tone: "accent" }]
        }, {
            label: "edges, sorted",
            cells: sorted.map((e, i) => ({
                v: `${L(g, e.from)}-${L(g, e.to)}`,
                sub: String(e.w),
                tone: i === current ? (status[e.id] === "accepted" ? "accepted current" : "rejected current") : (status[e.id] || "pending")
            }))
        }, {
            label: "parent",
            keyed: true,
            note: "union-find",
            cells: g.nodes.map((node) => ({ k: node.label, v: L(g, parent[node.id]), tone: parent[node.id] === node.id ? "" : "done" }))
        }];
        const data = (extra = {}) => Object.assign({
            accepted: accepted.map((e) => `${L(g, e.from)}-${L(g, e.to)}`),
            rejected: sorted.filter((e) => status[e.id] === "rejected").map((e) => `${L(g, e.from)}-${L(g, e.to)}`),
            total,
            edgeCount: accepted.length
        }, extra);

        t.push(`${g.title}: sort the ${g.edges.length} edges by weight, then take them cheapest first.`, { panel: panel(), data: data() });
        for (current = 0; current < sorted.length; current++) {
            const e = sorted[current];
            const a = find(e.from), b = find(e.to);
            const name = `${L(g, e.from)}-${L(g, e.to)} (${e.w})`;
            let text;
            if (a === b) {
                status[e.id] = "rejected";
                t.edge(e.id, { state: "rejected" });
                text = `${name}: ${L(g, e.from)} and ${L(g, e.to)} are already in the same tree. Reject: it would close a cycle.`;
            } else {
                const [big, small] = size[a] >= size[b] ? [a, b] : [b, a];
                const keep = slot[big] >= 0 ? slot[big] : (slot[small] >= 0 ? slot[small] : nextSlot++);
                parent[small] = big;
                size[big] += size[small];
                slot[big] = keep;
                status[e.id] = "accepted";
                accepted.push(e);
                total += e.w;
                t.edge(e.id, { state: "tree" });
                text = `${name}: different trees, so union them and accept. ${accepted.length} of ${n - 1} edges, total ${total}.`;
            }
            paintTrees();
            t.push(text, { panel: panel(), data: data(), ring: [e.from, e.to], hot: { [e.id]: status[e.id] === "accepted" ? "tree" : "rejected" } });
            if (accepted.length === n - 1) break;
        }
        current = -1;
        const ok = accepted.length === n - 1;
        t.push(ok ?
            `Done: ${n - 1} edges, total ${total}. One tree reaches all ${n} nodes.` :
            `Edges ran out after ${accepted.length} of ${n - 1}: the graph is not connected, answer -1.`, {
            panel: panel(), data: data(), result: ok ? `${accepted.length} edges total ${total}` : "-1", done: true
        });
        return t.frames;
    }

    // ------------------------------------------------------------------ Prim

    function runPrim(g) {
        const t = new Trace(g);
        const adj = undirectedAdj(g);
        const n = g.nodes.length;
        const inTree = Array(n).fill(false);
        const tree = [];
        const taken = [], skipped = [];
        let heap = [];
        let seq = 0;
        let total = 0;
        let popped = null;
        const sortHeap = () => heap.sort((a, b) => a.w - b.w || a.seq - b.seq);
        const entry = (x) => `(${x.w}, ${L(g, x.u)}-${L(g, x.v)})`;
        const panel = () => [{
            kind: "badges",
            items: [{ text: `${taken.length} of ${n - 1} edges`, tone: taken.length === n - 1 ? "accent" : "" }, { text: `total ${total}`, tone: "accent" }]
        }, {
            label: "popped",
            cells: popped ? [{ v: entry(popped), tone: popped.skip ? "stale" : "accepted current", sub: popped.skip ? "both in tree" : "take" }] : [],
            empty: "-"
        }, {
            label: "min-heap",
            note: "edges leaving the tree",
            cells: heap.map((x) => ({ v: entry(x), tone: inTree[x.v] ? "stale" : "", sub: inTree[x.v] ? "stale" : "" })),
            empty: "empty"
        }, {
            label: "tree",
            cells: tree.map((id) => ({ v: L(g, id), tone: "done" })),
            empty: "-"
        }];
        const data = (extra = {}) => Object.assign({
            taken: taken.map((x) => `${L(g, x.u)}-${L(g, x.v)}`),
            skipped: skipped.map((x) => `${L(g, x.u)}-${L(g, x.v)}`),
            tree: tree.map((id) => L(g, id)),
            heap: heap.map((x) => [x.w, `${L(g, x.u)}-${L(g, x.v)}`, inTree[x.v]]),
            total,
            edgeCount: taken.length
        }, extra);
        const add = (u) => {
            inTree[u] = true;
            tree.push(u);
            t.node(u, { state: "t0" });
            const pushed = [];
            adj[u].forEach(({ e, to }) => {
                if (!inTree[to]) {
                    heap.push({ w: e.w, u, v: to, e, seq: seq++ });
                    pushed.push(`${L(g, u)}-${L(g, to)}`);
                    if (!t.es[e.id] || !t.es[e.id].state) t.edge(e.id, { state: "candidate" });
                }
            });
            sortHeap();
            return pushed;
        };

        t.push(`${g.title}: grow one tree from ${L(g, g.src)}, always taking the cheapest edge that leaves it.`, { panel: panel(), data: data() });
        const first = add(g.src);
        t.push(`Start the tree at ${L(g, g.src)}. Push its ${plural(first.length, "edge")}: ${listText(first)}.`, { panel: panel(), data: data(), ring: [g.src] });
        while (heap.length && tree.length < n) {
            const x = heap.shift();
            if (inTree[x.v]) {
                popped = Object.assign({ skip: true }, x);
                skipped.push(x);
                t.edge(x.e.id, { state: "rejected" });
                t.push(`Pop ${entry(x)}: ${L(g, x.v)} is already in the tree. Skip it.`, { panel: panel(), data: data(), ring: [x.v], hot: { [x.e.id]: "rejected" } });
                continue;
            }
            popped = Object.assign({ skip: false }, x);
            taken.push(x);
            total += x.w;
            t.edge(x.e.id, { state: "tree" });
            const pushed = add(x.v);
            t.push(`Pop ${entry(x)}: ${L(g, x.v)} is new. Take the edge, total ${total}.` + (pushed.length ? ` Push ${listText(pushed)}.` : ""), {
                panel: panel(), data: data(), ring: [x.v], hot: { [x.e.id]: "tree" }
            });
        }
        popped = null;
        g.edges.forEach((e) => { if (t.es[e.id] && t.es[e.id].state === "candidate") t.edge(e.id, { state: "" }); });
        const ok = tree.length === n;
        t.push(ok ?
            `Done: ${n - 1} edges, total ${total}. Every node is in the tree; the rest of the heap is never needed.` :
            `Heap empty with ${tree.length} of ${n} nodes: not connected, answer -1.`, {
            panel: panel(), data: data(), result: ok ? `${taken.length} edges total ${total}` : "-1", done: true
        });
        return t.frames;
    }

    const RUNNERS = {
        kahn: runKahn,
        dfs3: runDfs3,
        dijkstra: runDijkstra,
        "bellman-ford": runBellmanFord,
        floyd: runFloyd,
        bipartite: runBipartite,
        greedy: runGreedy,
        kruskal: runKruskal,
        prim: runPrim
    };

    function fits(algo, g) {
        const needs = ALGOS[algo].needs;
        if (needs === "directed") return g.directed;
        if (needs === "undirected") return !g.directed;
        return true;
    }

    // ------------------------------------------------------------------ legend per algorithm

    const LEGENDS = {
        kahn: [["node-queued", "In the queue (indegree 0)"], ["node-current", "Taken this step"], ["node-done", "In the order"], ["edge-used", "Arrow used up"], ["node-rejected", "Left over: on a cycle"], ["tag", "Indegree"]],
        dfs3: [["node-white", "White: not visited"], ["node-gray", "Gray: call open, on the path"], ["node-black", "Black: finished"], ["edge-tree", "Arrow followed"], ["edge-checked", "Reached a black node: fine"], ["edge-conflict", "Reached a gray node: cycle"]],
        dfs2: [["node-white", "Not visited"], ["node-done", "Visited"], ["edge-tree", "Arrow followed"], ["edge-seen", "Visited, not the parent"]],
        dijkstra: [["node-queued", "In the heap"], ["node-current", "Popped this step"], ["node-done", "Final distance"], ["edge-active", "Relaxed: cheaper"], ["edge-tree", "Shortest-path tree"], ["tag", "Distance so far"]],
        "bellman-ford": [["node-done", "Source"], ["node-target", "Destination"], ["edge-active", "Flight improves a price"], ["edge-seen", "Flight read, no change"], ["edge-tree", "Answer route"], ["edge-conflict", "Route breaks the stop limit"]],
        floyd: [["node-k", "k: the node being tried"], ["node-done", "Already tried as k"], ["edge-active", "Edges at k"], ["cell-changed", "Cell got shorter"]],
        bipartite: [["node-c0", "Color 0 (blue)"], ["node-c1", "Color 1 (orange)"], ["node-current", "Popped this step"], ["edge-conflict", "Same color on both ends"], ["outline", "Odd cycle"]],
        greedy: [["node-g0", "Type 1"], ["node-g1", "Type 2"], ["node-g2", "Type 3"], ["node-g3", "Type 4"], ["node-current", "Garden being planted"]],
        kruskal: [["edge-tree", "Accepted"], ["edge-rejected", "Rejected: same tree"], ["node-t0", "One tree"], ["node-t1", "Another tree"], ["node-current", "Ends of the edge"]],
        prim: [["node-t0", "In the tree"], ["edge-candidate", "Edge in the heap"], ["edge-tree", "Tree edge"], ["edge-rejected", "Popped, both ends in tree"], ["node-current", "Added this step"]]
    };

    // ------------------------------------------------------------------ setup from the URL

    function readSetup() {
        const params = new URLSearchParams(window.location.search);
        const bool = (name) => (params.has(name) ? !/^(0|false|off|no)$/i.test(params.get(name)) : null);
        const rawAlgo = (params.get("algo") || params.get("algorithm") || "").toLowerCase();
        const algo = ALGO_ALIASES[rawAlgo] || rawAlgo;
        const preset = (params.get("preset") || "").toLowerCase();
        const steps = params.get("steps");
        return {
            mode: (params.get("mode") || params.get("view") || "").toLowerCase() === "network" || (!params.get("mode") && Boolean(PRESETS[preset])) ? "network" : "grid",
            preset: PRESETS[preset] ? preset : null,
            algo: ALGOS[algo] ? algo : null,
            src: params.get("src"),
            k: params.has("k") ? parseInt(params.get("k"), 10) : null,
            copy: bool("copy"),
            build: bool("build"),
            colors: params.has("colors") ? (params.get("colors") === "2" ? 2 : 3) : null,
            edges: params.get("edges"),
            steps: steps === null ? null : (/^(end|done|last)$/i.test(steps) ? "end" : Math.max(0, parseInt(steps, 10) || 0)),
            speed: params.has("speed") ? Math.min(10, Math.max(1, parseInt(params.get("speed"), 10) || 5)) : null
        };
    }

    // ------------------------------------------------------------------ DOM

    function el(html) {
        const box = document.createElement("div");
        box.innerHTML = html.trim();
        return box.firstElementChild;
    }

    const esc = (text) => String(text).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

    function buildDom() {
        const sidebar = document.querySelector(".options-sidebar");
        const header = sidebar && sidebar.querySelector(".sidebar-header");
        const canvasArea = document.querySelector(".canvas-area");
        const actionBar = canvasArea && canvasArea.querySelector(".action-bar");
        const statsBar = document.querySelector(".stats-bar");
        if (!sidebar || !canvasArea || !actionBar) return null;

        const modeCard = el(`
            <div class="option-card mode-card">
                <h3>View</h3>
                <div class="segmented" role="radiogroup" aria-label="Grid or network view">
                    <label><input name="graph-view" type="radio" value="grid" checked /><span>Grid</span></label>
                    <label><input name="graph-view" type="radio" value="network" /><span>Network</span></label>
                </div>
            </div>`);
        header.insertAdjacentElement("afterend", modeCard);

        const presetOptions = Object.keys(PRESETS).map((key) => `<option value="${key}">${esc(PRESETS[key].title)}</option>`).join("");
        const algoOptions = Object.keys(ALGOS).map((key) => `<option value="${key}">${esc(ALGOS[key].name)}</option>`).join("");
        const netCard = el(`
            <div class="option-card net-card">
                <h3>Network</h3>
                <div class="card-content">
                    <div class="input-group">
                        <label for="net-preset">Preset</label>
                        <select id="net-preset">${presetOptions}<option value="custom" hidden>Custom graph</option></select>
                    </div>
                    <div class="input-group">
                        <label for="net-algo">Algorithm</label>
                        <select id="net-algo">${algoOptions}</select>
                    </div>
                    <div class="input-group" data-net-for="dijkstra bellman-ford prim dfs3">
                        <label for="net-src">Start node</label>
                        <select id="net-src"></select>
                    </div>
                    <div class="input-group" data-net-for="bellman-ford">
                        <label for="net-k">Stops k (k + 1 passes)</label>
                        <input id="net-k" max="9" min="0" step="1" type="number" value="1" />
                    </div>
                    <div class="option-item" data-net-for="bellman-ford" title="Read each pass from a copy of the previous pass">
                        <label class="toggle-switch"><input checked id="net-copy" type="checkbox" /><span class="toggle-slider"></span></label>
                        <span class="option-label">Copy dist each pass</span>
                    </div>
                    <div class="option-item" data-net-for="kahn" title="Start with no arrows and draw one per pair">
                        <label class="toggle-switch"><input id="net-build" type="checkbox" /><span class="toggle-slider"></span></label>
                        <span class="option-label">Draw arrows from the pairs</span>
                    </div>
                    <div class="option-item" data-net-for="dfs3" title="White, gray and black, or just visited">
                        <label class="toggle-switch"><input checked id="net-colors" type="checkbox" /><span class="toggle-slider"></span></label>
                        <span class="option-label">Three colors</span>
                    </div>
                    <div class="input-group">
                        <label class="range-label" for="net-speed"><span>Animation speed</span><output for="net-speed" id="net-speed-value">5</output></label>
                        <input id="net-speed" max="10" min="1" type="range" value="5" />
                    </div>
                </div>
            </div>`);
        const editCard = el(`
            <div class="option-card net-card">
                <h3>Edit graph</h3>
                <div class="card-content">
                    <div class="segmented segmented-4" role="radiogroup" aria-label="What a click on the graph does">
                        <label><input checked name="net-tool" type="radio" value="move" /><span>Move</span></label>
                        <label><input name="net-tool" type="radio" value="node" /><span>Node</span></label>
                        <label><input name="net-tool" type="radio" value="edge" /><span>Edge</span></label>
                        <label><input name="net-tool" type="radio" value="delete" /><span>Delete</span></label>
                    </div>
                    <div class="net-edit-row">
                        <div class="input-group">
                            <label for="net-weight">Edge weight</label>
                            <input id="net-weight" max="999" min="-99" step="1" type="number" value="1" />
                        </div>
                        <div class="option-item" title="New graphs use arrows">
                            <label class="toggle-switch"><input id="net-directed" type="checkbox" /><span class="toggle-slider"></span></label>
                            <span class="option-label">Directed</span>
                        </div>
                    </div>
                    <p class="input-note">Node: click empty space. Edge: click two nodes. Any edit turns the preset into a custom graph and resets the run.</p>
                    <button class="action-btn net-clear" id="net-clear" type="button">Clear graph</button>
                </div>
            </div>`);
        modeCard.insertAdjacentElement("afterend", netCard);
        netCard.insertAdjacentElement("afterend", editCard);

        const container = el(`
            <div class="canvas-container net-container" id="network-container">
                <div class="canvas-header">
                    <span class="canvas-title" id="net-title">Network</span>
                    <span class="net-status-slot"></span>
                </div>
                <div class="net-stage" id="network-stage">
                    <div class="net-canvas-wrap"><canvas data-state="idle" id="network-canvas" tabindex="0" aria-label="Graph drawing"></canvas></div>
                    <div class="net-panel" id="network-panel" aria-live="polite"></div>
                </div>
            </div>`);
        actionBar.insertAdjacentElement("beforebegin", container);

        const backButton = el(`<button class="action-btn net-only" id="net-back" title="Step back one step (Left arrow)" type="button">Back</button>`);
        const stepButton = document.getElementById("step");
        if (stepButton) stepButton.insertAdjacentElement("beforebegin", backButton);

        const legend = el(`
            <div class="legend-panel net-legend">
                <div class="legend-header"><h3>Legend</h3></div>
                <div class="legend-content" id="net-legend"></div>
            </div>`);
        actionBar.insertAdjacentElement("afterend", legend);

        if (statsBar) {
            const stat = (id, label) => el(`<div class="stat-item net-stat"><span class="stat-value" id="${id}">0</span><span class="stat-label">${label}</span></div>`);
            [stat("net-stat-step", "Step"), stat("net-stat-nodes", "Nodes"), stat("net-stat-edges", "Edges"), stat("net-stat-algo", "Algorithm")]
                .forEach((item) => statsBar.appendChild(item));
        }
        return { container, modeCard, netCard, editCard, legend };
    }

    // ------------------------------------------------------------------ the controller

    function init() {
        const dom = buildDom();
        if (!dom) return;
        const setup = readSetup();
        const body = document.body;
        const canvas = document.getElementById("network-canvas");
        const ctx = canvas.getContext("2d");
        const panelEl = document.getElementById("network-panel");
        const titleEl = document.getElementById("net-title");
        const legendEl = document.getElementById("net-legend");
        const statusSlot = dom.container.querySelector(".net-status-slot");
        const presetSelect = document.getElementById("net-preset");
        const algoSelect = document.getElementById("net-algo");
        const srcSelect = document.getElementById("net-src");
        const kInput = document.getElementById("net-k");
        const copyInput = document.getElementById("net-copy");
        const buildInput = document.getElementById("net-build");
        const colorsInput = document.getElementById("net-colors");
        const speedInput = document.getElementById("net-speed");
        const speedValue = document.getElementById("net-speed-value");
        const weightInput = document.getElementById("net-weight");
        const directedInput = document.getElementById("net-directed");
        const startBtn = document.getElementById("start");
        const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        const st = {
            mode: "grid",
            presetKey: setup.preset || (setup.algo ? ALGOS[setup.algo].preset : "course-schedule"),
            algo: null,
            g: null,
            frames: [],
            index: 0,
            playing: false,
            timer: null,
            opts: { k: null, copy: true, build: false, colors: 3, src: null },
            dragging: null,
            edgeFrom: null,
            gridStatus: null
        };

        if (setup.speed !== null) speedInput.value = setup.speed;
        speedValue.textContent = speedInput.value;
        if (setup.copy !== null) st.opts.copy = setup.copy;
        if (setup.build !== null) st.opts.build = setup.build;
        if (setup.colors !== null) st.opts.colors = setup.colors;
        if (setup.k !== null && Number.isFinite(setup.k)) st.opts.k = Math.max(0, Math.min(9, setup.k));
        copyInput.checked = st.opts.copy;
        buildInput.checked = st.opts.build;
        colorsInput.checked = st.opts.colors !== 2;

        // ---------------------------------------------------------- graph and run

        function loadGraph(key, customGraph) {
            if (customGraph) {
                st.g = customGraph;
                st.presetKey = "custom";
            } else {
                st.presetKey = PRESETS[key] ? key : "course-schedule";
                st.g = buildGraph(st.presetKey, PRESETS[st.presetKey]);
            }
            presetSelect.value = st.presetKey;
            presetSelect.querySelector('option[value="custom"]').hidden = st.presetKey !== "custom";
            directedInput.checked = st.g.directed;
            srcSelect.innerHTML = st.g.nodes.map((node) => `<option value="${esc(node.label)}">${esc(node.label)}</option>`).join("");
            srcSelect.value = L(st.g, st.g.src);
            kInput.value = st.opts.k === null ? st.g.k : st.opts.k;
        }

        function chooseAlgo(algo) {
            if (!ALGOS[algo]) algo = (PRESETS[st.presetKey] && PRESETS[st.presetKey].algo) || "kahn";
            if (!fits(algo, st.g)) loadGraph(ALGOS[algo].preset);
            st.algo = algo;
            algoSelect.value = algo;
        }

        function recompute(keepIndex) {
            stop();
            const g = st.g;
            if (st.opts.src !== null && g.byLabel && g.byLabel.has(st.opts.src)) g.src = g.byLabel.get(st.opts.src);
            else if (st.opts.src === null && PRESETS[st.presetKey]) g.src = buildGraph(st.presetKey, PRESETS[st.presetKey]).src;
            if (g.nodes.length) srcSelect.value = L(g, g.src);
            const opt = {
                k: parseInt(kInput.value, 10),
                copy: copyInput.checked,
                build: buildInput.checked,
                colors: colorsInput.checked ? 3 : 2
            };
            if (!Number.isFinite(opt.k)) opt.k = g.k;
            try {
                st.frames = g.nodes.length ? RUNNERS[st.algo](g, opt) : [];
            } catch (error) {
                console.error(error);
                st.frames = [];
            }
            if (!st.frames.length) {
                st.frames = [{ status: "Add some nodes and edges first.", nodes: {}, edges: {}, ring: [], hot: {}, panel: [], data: {}, result: "", done: false }];
            }
            st.index = keepIndex ? Math.min(st.index, st.frames.length - 1) : 0;
            updateOptionVisibility();
            renderAll(false);
            writeUrl();
        }

        function updateOptionVisibility() {
            dom.netCard.querySelectorAll("[data-net-for]").forEach((item) => {
                item.hidden = !item.dataset.netFor.split(/\s+/).includes(st.algo);
            });
            buildInput.disabled = !st.g.pairs;
            // Floyd-Warshall is about the matrix: graph and matrix sit side by side.
            document.getElementById("network-stage").classList.toggle("split", st.algo === "floyd");
            const legendKey = st.algo === "dfs3" && !colorsInput.checked ? "dfs2" : st.algo;
            legendEl.innerHTML = (LEGENDS[legendKey] || []).map(([kind, text]) =>
                `<div class="legend-item"><span class="net-swatch ${kind}"></span><span class="legend-label">${esc(text)}</span></div>`).join("");
        }

        // ---------------------------------------------------------- run state

        function runState() {
            const last = st.frames.length - 1;
            if (st.index >= last && st.frames[last] && st.frames[last].done) return "done";
            if (st.playing) return "running";
            return st.index === 0 ? "idle" : "paused";
        }

        function stop() {
            st.playing = false;
            if (st.timer) clearTimeout(st.timer);
            st.timer = null;
        }

        function delay() {
            const speed = parseInt(speedInput.value, 10) || 5;
            return Math.round(1800 - ((speed - 1) / 9) * (1800 - 220));
        }

        function tick() {
            st.timer = null;
            if (!st.playing) return;
            if (st.index < st.frames.length - 1) {
                go(st.index + 1, true);
            }
            if (st.index >= st.frames.length - 1) {
                st.playing = false;
                renderMeta();
                return;
            }
            st.timer = setTimeout(tick, delay());
        }

        function play() {
            if (st.index >= st.frames.length - 1) go(0, false);
            st.playing = true;
            renderMeta();
            if (st.timer) clearTimeout(st.timer);
            st.timer = setTimeout(tick, st.index === 0 ? 60 : delay());
        }

        function pause() {
            stop();
            renderMeta();
        }

        function go(index, animate) {
            const target = Math.max(0, Math.min(st.frames.length - 1, index));
            const changed = target !== st.index;
            st.index = target;
            renderAll(animate && changed);
        }

        // ---------------------------------------------------------- mode switch

        function setMode(mode, opts = {}) {
            mode = mode === "network" ? "network" : "grid";
            if (mode === st.mode && !opts.force) return;
            st.mode = mode;
            const network = mode === "network";
            body.classList.toggle("graphs-network", network);
            dom.modeCard.querySelectorAll('input[name="graph-view"]').forEach((input) => { input.checked = input.value === mode; });
            const status = document.getElementById("search-status");
            const subtitle = document.querySelector(".tool-header .subtitle");
            const hint = document.querySelector(".tool-header .keyboard-hint");
            const startText = startBtn && startBtn.querySelector(".btn-text");
            if (network) {
                stop();
                if (status && status.parentElement !== statusSlot) {
                    st.gridStatus = { text: status.textContent, state: status.dataset.state, home: status.parentElement, next: status.nextSibling };
                    statusSlot.replaceWith(status);
                }
                if (subtitle) { subtitle.dataset.gridText = subtitle.dataset.gridText || subtitle.textContent; subtitle.textContent = "Step through graph algorithms on nodes and edges"; }
                if (hint) { hint.dataset.gridHtml = hint.dataset.gridHtml || hint.innerHTML; hint.innerHTML = "Drag nodes to move them &bull; <kbd>Space</kbd> to play/pause &bull; arrow keys to step"; }
                if (startText) { startText.dataset.gridText = startText.dataset.gridText || startText.textContent; startText.textContent = "Play"; }
                resize();
                renderAll(false);
            } else {
                stop();
                if (status && st.gridStatus) {
                    status.replaceWith(statusSlot);
                    st.gridStatus.home.insertBefore(status, st.gridStatus.next && st.gridStatus.next.parentNode === st.gridStatus.home ? st.gridStatus.next : null);
                    status.textContent = st.gridStatus.text;
                    status.dataset.state = st.gridStatus.state || "idle";
                    st.gridStatus = null;
                }
                if (subtitle && subtitle.dataset.gridText) subtitle.textContent = subtitle.dataset.gridText;
                if (hint && hint.dataset.gridHtml) hint.innerHTML = hint.dataset.gridHtml;
                if (startText && startText.dataset.gridText) startText.textContent = startText.dataset.gridText;
                // The grid sized itself while hidden; let it measure again.
                window.dispatchEvent(new Event("resize"));
            }
            if (!opts.silent) writeUrl();
        }

        function writeUrl() {
            if (!window.history || !window.history.replaceState) return;
            const params = new URLSearchParams(window.location.search);
            ["mode", "preset", "algo", "k", "copy", "build", "colors", "src", "edges", "steps"].forEach((name) => {
                if (st.mode === "network" || name !== "algo") params.delete(name);
            });
            if (st.mode === "network") {
                params.delete("algo");
                params.set("mode", "network");
                if (st.presetKey === "custom") params.set("edges", graphToSpec(st.g));
                else params.set("preset", st.presetKey);
                params.set("algo", st.algo);
                if (st.algo === "bellman-ford") {
                    if (String(kInput.value) !== String(st.g.k)) params.set("k", kInput.value);
                    if (!copyInput.checked) params.set("copy", "0");
                }
                if (st.algo === "kahn" && buildInput.checked) params.set("build", "1");
                if (st.algo === "dfs3" && !colorsInput.checked) params.set("colors", "2");
                const presetSrc = PRESETS[st.presetKey] && PRESETS[st.presetKey].src;
                const srcLabel = L(st.g, st.g.src);
                if (["dijkstra", "bellman-ford", "prim", "dfs3"].includes(st.algo) && srcLabel !== (presetSrc || L(st.g, 0))) params.set("src", srcLabel);
            }
            const query = params.toString();
            window.history.replaceState(null, "", `${window.location.pathname}${query ? "?" + query : ""}${window.location.hash}`);
        }

        // ---------------------------------------------------------- canvas geometry

        const view = { w: 800, h: 420, dpr: 1, r: 24, pad: 46 };

        function resize() {
            const wrap = canvas.parentElement;
            const width = Math.max(280, Math.min(1240, (wrap.clientWidth || 800) - 2));
            const height = Math.round(st.algo === "floyd" ? Math.max(300, Math.min(520, width * 0.8)) : Math.max(260, Math.min(460, width * 0.5)));
            const dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
            view.w = width;
            view.h = height;
            view.dpr = dpr;
            view.r = Math.max(16, Math.min(26, width / 34));
            view.pad = view.r + 22;
            canvas.width = Math.round(width * dpr);
            canvas.height = Math.round(height * dpr);
            canvas.style.width = `${width}px`;
            canvas.style.height = `${height}px`;
            from.width = to.width = canvas.width;
            from.height = to.height = canvas.height;
            if (st.frames.length) draw();
        }

        const pos = (node) => ({
            x: view.pad + node.x * (view.w - 2 * view.pad),
            y: view.pad + node.y * (view.h - 2 * view.pad)
        });

        // ---------------------------------------------------------- colours

        function palette() {
            const live = (window.ToolShared && window.ToolShared.palette && window.ToolShared.palette()) || {};
            const p = {
                canvas: "#ffffff", panel: "#ffffff", panel2: "#eef1f5", rule: "#dce1e8", ruleStrong: "#9aa6b5",
                ink: "#0e1218", ink2: "#3a4452", ink3: "#5b6676", gold: "#1f4fd1", onGold: "#ffffff",
                verdigris: "#137a55", moon: "#6d4fd0", ember: "#b25a0c", rose: "#c23b3b", bg: "#f7f8fa", isDark: false
            };
            Object.keys(live).forEach((key) => { if (live[key] !== "" && live[key] !== undefined) p[key] = live[key]; });
            const dark = p.isDark;
            p.onSolid = dark ? p.bg : p.canvas;
            p.mono = getComputedStyle(document.body).getPropertyValue("--g-font-mono").trim() || "monospace";
            p.white = dark ? p.ink : p.canvas;
            p.gray = p.ruleStrong;
            p.black = dark ? p.bg : p.ink;
            p.types = [p.gold, p.verdigris, p.ember, p.moon];
            return p;
        }

        function nodeStyle(p, state) {
            const tint = (color, a) => ({ fill: color, fillAlpha: a });
            switch (state) {
                case "queued": return Object.assign(tint(p.gold, p.isDark ? .22 : .12), { stroke: p.gold, lw: 3, text: p.ink });
                case "done": return Object.assign(tint(p.moon, p.isDark ? .38 : .2), { stroke: p.moon, lw: 2, text: p.ink });
                case "rejected": return Object.assign(tint(p.rose, p.isDark ? .24 : .12), { stroke: p.rose, lw: 3, text: p.ink, dash: [] });
                case "target": return Object.assign(tint(p.rose, p.isDark ? .2 : .1), { stroke: p.rose, lw: 2.5, text: p.ink });
                case "k": return { fill: p.ember, fillAlpha: 1, stroke: p.ember, lw: 2, text: p.onSolid };
                case "white": return { fill: p.white, fillAlpha: 1, stroke: p.ink3, lw: 2, text: p.isDark ? p.bg : p.ink };
                case "": case undefined: return { fill: p.canvas, fillAlpha: 1, stroke: p.ink3, lw: 2, text: p.ink };
                case "gray": return { fill: p.gray, fillAlpha: 1, stroke: p.gray, lw: 2, text: p.ink };
                case "black": return { fill: p.black, fillAlpha: 1, stroke: p.isDark ? p.ink3 : p.black, lw: 2, text: p.isDark ? p.ink : p.canvas };
                case "c0": case "t0": return { fill: p.gold, fillAlpha: 1, stroke: p.gold, lw: 2, text: p.onSolid };
                case "c1": case "t1": return { fill: p.ember, fillAlpha: 1, stroke: p.ember, lw: 2, text: p.onSolid };
                case "c2": case "t2": return { fill: p.verdigris, fillAlpha: 1, stroke: p.verdigris, lw: 2, text: p.onSolid };
                case "c3": case "t3": return { fill: p.moon, fillAlpha: 1, stroke: p.moon, lw: 2, text: p.onSolid };
                case "g0": return { fill: p.types[0], fillAlpha: 1, stroke: p.types[0], lw: 2, text: p.onSolid };
                case "g1": return { fill: p.types[1], fillAlpha: 1, stroke: p.types[1], lw: 2, text: p.onSolid };
                case "g2": return { fill: p.types[2], fillAlpha: 1, stroke: p.types[2], lw: 2, text: p.onSolid };
                case "g3": return { fill: p.types[3], fillAlpha: 1, stroke: p.types[3], lw: 2, text: p.onSolid };
                default: return { fill: p.canvas, fillAlpha: 1, stroke: p.ink3, lw: 2, text: p.ink };
            }
        }

        function edgeStyle(p, state) {
            switch (state) {
                case "used": return { color: p.ruleStrong, lw: 1.5, alpha: p.isDark ? .5 : .55, dash: [5, 5] };
                case "tree": return { color: p.gold, lw: 4, alpha: 1 };
                case "active": return { color: p.gold, lw: 4, alpha: 1 };
                case "new": return { color: p.gold, lw: 4, alpha: 1 };
                case "rejected": return { color: p.rose, lw: 2, alpha: .8, dash: [7, 5], cross: true };
                case "conflict": return { color: p.rose, lw: 5, alpha: 1 };
                case "cycle": return { color: p.rose, lw: 2.5, alpha: .9 };
                case "checked": return { color: p.verdigris, lw: 3.5, alpha: 1 };
                case "seen": return { color: p.ember, lw: 3.5, alpha: 1 };
                case "probe": return { color: p.ink, lw: 3, alpha: 1 };
                case "candidate": return { color: p.ink2, lw: 2, alpha: .85, dash: [3, 4] };
                default: return { color: p.ink3, lw: 2, alpha: p.isDark ? .75 : .7 };
            }
        }

        // ---------------------------------------------------------- drawing

        const from = document.createElement("canvas");
        const to = document.createElement("canvas");
        let tween = null;

        function edgeGeometry(e) {
            const g = st.g;
            const a = pos(g.nodes[e.from]), b = pos(g.nodes[e.to]);
            let bend = e.bend || 0;
            if (g.directed && !bend && g.edges.some((x) => x.from === e.to && x.to === e.from)) bend = .12;
            const dx = b.x - a.x, dy = b.y - a.y;
            const len = Math.hypot(dx, dy) || 1;
            const nx = -dy / len, ny = dx / len;
            const c = { x: (a.x + b.x) / 2 + nx * bend * len, y: (a.y + b.y) / 2 + ny * bend * len };
            const r = view.r;
            // Trim both ends to the node circles along the curve's end tangents.
            const ta = { x: c.x - a.x, y: c.y - a.y }, tb = { x: c.x - b.x, y: c.y - b.y };
            const la = Math.hypot(ta.x, ta.y) || 1, lb = Math.hypot(tb.x, tb.y) || 1;
            const start = bend ? { x: a.x + ta.x / la * r, y: a.y + ta.y / la * r } : { x: a.x + dx / len * r, y: a.y + dy / len * r };
            const end = bend ? { x: b.x + tb.x / lb * (r + 2), y: b.y + tb.y / lb * (r + 2) } : { x: b.x - dx / len * (r + 2), y: b.y - dy / len * (r + 2) };
            const mid = bend ? { x: .25 * a.x + .5 * c.x + .25 * b.x, y: .25 * a.y + .5 * c.y + .25 * b.y } : { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
            const dir = bend ? { x: -tb.x / lb, y: -tb.y / lb } : { x: dx / len, y: dy / len };
            return { a, b, c, bend, start, end, mid, dir, len };
        }

        function drawScene(target, frame) {
            const p = palette();
            const c = target.getContext("2d");
            const g = st.g;
            c.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
            c.clearRect(0, 0, view.w, view.h);
            c.fillStyle = p.canvas;
            c.fillRect(0, 0, view.w, view.h);
            if (!g || !frame) return;
            const r = view.r;

            // Odd cycle / detected cycle: a soft band under the edges.
            if (frame.outline && frame.outline.length > 1) {
                c.save();
                c.strokeStyle = p.rose;
                c.globalAlpha = p.isDark ? .2 : .14;
                c.lineWidth = r * 2 + 16;
                c.lineJoin = "round";
                c.lineCap = "round";
                c.beginPath();
                frame.outline.forEach((id, i) => {
                    const q = pos(g.nodes[id]);
                    if (i === 0) c.moveTo(q.x, q.y); else c.lineTo(q.x, q.y);
                });
                c.stroke();
                c.restore();
            }

            // Edges
            const labels = [];
            g.edges.forEach((e) => {
                const es = frame.edges[e.id] || {};
                if (es.state === "hidden") return;
                const hotState = frame.hot[e.id];
                const style = edgeStyle(p, hotState || es.state);
                const geo = edgeGeometry(e);
                c.save();
                c.globalAlpha = style.alpha;
                c.strokeStyle = style.color;
                c.fillStyle = style.color;
                c.lineWidth = style.lw;
                c.setLineDash(style.dash || []);
                c.beginPath();
                c.moveTo(geo.start.x, geo.start.y);
                if (geo.bend) c.quadraticCurveTo(geo.c.x, geo.c.y, geo.end.x, geo.end.y);
                else c.lineTo(geo.end.x, geo.end.y);
                c.stroke();
                c.setLineDash([]);
                if (g.directed) {
                    const size = 9 + style.lw * 1.4;
                    const { x, y } = geo.end;
                    const ux = geo.dir.x, uy = geo.dir.y;
                    c.beginPath();
                    c.moveTo(x + ux * 2, y + uy * 2);
                    c.lineTo(x - ux * size - uy * size * .52, y - uy * size + ux * size * .52);
                    c.lineTo(x - ux * size + uy * size * .52, y - uy * size - ux * size * .52);
                    c.closePath();
                    c.fill();
                }
                if (style.cross && !g.weighted) {
                    const m = geo.mid, s = 7;
                    c.globalAlpha = 1;
                    c.lineWidth = 2.5;
                    c.beginPath();
                    c.moveTo(m.x - s, m.y - s); c.lineTo(m.x + s, m.y + s);
                    c.moveTo(m.x + s, m.y - s); c.lineTo(m.x - s, m.y + s);
                    c.stroke();
                }
                c.restore();
                if (g.weighted) labels.push({ e, geo, strong: Boolean(hotState) || ["tree", "conflict"].includes(es.state), faded: es.state === "used", struck: (hotState || es.state) === "rejected" });
            });

            // Weight labels sit on the edge, a little off the line for curves.
            c.save();
            c.font = `600 ${Math.round(r * .58)}px ${p.mono}`;
            c.textAlign = "center";
            c.textBaseline = "middle";
            labels.forEach(({ e, geo, strong, faded, struck }) => {
                const text = String(e.w);
                const w = c.measureText(text).width + 10;
                const h = Math.round(r * .58) + 8;
                const x = geo.mid.x, y = geo.mid.y, offset = 0;
                c.globalAlpha = faded ? .6 : 1;
                c.fillStyle = p.canvas;
                c.fillRect(x - w / 2, y - h / 2 + offset, w, h);
                c.strokeStyle = struck ? p.rose : (strong ? p.ink : p.ruleStrong);
                c.lineWidth = 1;
                c.strokeRect(x - w / 2 + .5, y - h / 2 + .5 + offset, w - 1, h - 1);
                c.fillStyle = struck ? p.rose : (strong ? p.ink : p.ink2);
                c.fillText(text, x, y + 1 + offset);
                if (struck) {
                    // A rejected edge: its weight is struck through, like the cell in the edge list.
                    c.strokeStyle = p.rose;
                    c.lineWidth = 2;
                    c.beginPath();
                    c.moveTo(x - w / 2 + 3, y + 1);
                    c.lineTo(x + w / 2 - 3, y + 1);
                    c.stroke();
                }
            });
            c.restore();

            // Nodes
            const ring = new Set(frame.ring);
            g.nodes.forEach((node) => {
                const ns = frame.nodes[node.id] || {};
                let state = ns.state;
                if (st.algo === "dfs3" && !state && colorsInput.checked) state = "white";
                const s = nodeStyle(p, state);
                const q = pos(node);
                c.save();
                if (ring.has(node.id)) {
                    c.strokeStyle = p.ink;
                    c.lineWidth = 3;
                    c.beginPath();
                    c.arc(q.x, q.y, r + 6, 0, Math.PI * 2);
                    c.stroke();
                }
                c.fillStyle = p.canvas;
                c.beginPath();
                c.arc(q.x, q.y, r, 0, Math.PI * 2);
                c.fill();
                c.globalAlpha = s.fillAlpha;
                c.fillStyle = s.fill;
                c.fill();
                c.globalAlpha = 1;
                c.strokeStyle = ns.conflict ? p.rose : s.stroke;
                c.lineWidth = ns.conflict ? 4 : s.lw;
                c.beginPath();
                c.arc(q.x, q.y, r - c.lineWidth / 2, 0, Math.PI * 2);
                c.stroke();
                if (st.edgeFrom === node.id) {
                    c.setLineDash([4, 4]);
                    c.strokeStyle = p.gold;
                    c.lineWidth = 2;
                    c.beginPath();
                    c.arc(q.x, q.y, r + 10, 0, Math.PI * 2);
                    c.stroke();
                    c.setLineDash([]);
                }
                c.fillStyle = s.text;
                const size = node.label.length > 2 ? r * .62 : r * .8;
                c.font = `600 ${Math.round(size)}px ${p.mono}`;
                c.textAlign = "center";
                c.textBaseline = "middle";
                c.fillText(node.label, q.x, q.y + 1);

                if (ns.tag !== undefined && ns.tag !== null && ns.tag !== "") {
                    const fs = Math.round(r * .56);
                    c.font = `600 ${fs}px ${p.mono}`;
                    const tw = Math.max(c.measureText(ns.tag).width + 10, fs + 8);
                    const th = fs + 8;
                    // Put the tag on the side of the node that is farthest from its edges.
                    const angles = [];
                    g.edges.forEach((e) => {
                        if ((frame.edges[e.id] || {}).state === "hidden") return;
                        if (e.from !== node.id && e.to !== node.id) return;
                        const geo = edgeGeometry(e);
                        const toward = geo.bend ? geo.c : (e.from === node.id ? geo.b : geo.a);
                        angles.push(Math.atan2(toward.y - q.y, toward.x - q.x));
                    });
                    const candidates = [-Math.PI / 4, -3 * Math.PI / 4, Math.PI / 4, 3 * Math.PI / 4, -Math.PI / 2, Math.PI / 2, 0, Math.PI];
                    const gap = (a, b) => { const d = Math.abs(a - b) % (2 * Math.PI); return d > Math.PI ? 2 * Math.PI - d : d; };
                    let best = candidates[0], bestScore = -1;
                    candidates.forEach((a, i) => {
                        const score = (angles.length ? Math.min(...angles.map((b) => gap(a, b))) : Math.PI) - i * 0.01;
                        const cx = q.x + Math.cos(a) * (r + 14), cy = q.y + Math.sin(a) * (r + 14);
                        const inside = cx > tw / 2 && cx < view.w - tw / 2 && cy > th / 2 && cy < view.h - th / 2;
                        if (inside && score > bestScore) { bestScore = score; best = a; }
                    });
                    const reach = r + 4 + Math.max(tw * Math.abs(Math.cos(best)), th * Math.abs(Math.sin(best))) / 2;
                    const tx = q.x + Math.cos(best) * reach - tw / 2, ty = q.y + Math.sin(best) * reach - th / 2;
                    const tone = ns.tagTone === "zero" ? p.verdigris : (ns.tagTone === "done" ? p.moon : p.ink2);
                    c.fillStyle = p.canvas;
                    c.fillRect(tx, ty, tw, th);
                    c.strokeStyle = tone;
                    c.lineWidth = 1.5;
                    c.strokeRect(tx + .75, ty + .75, tw - 1.5, th - 1.5);
                    c.fillStyle = ns.tagTone === "zero" ? p.verdigris : p.ink;
                    c.textAlign = "center";
                    c.fillText(ns.tag, tx + tw / 2, ty + th / 2 + 1);
                }
                c.restore();
            });
        }

        function draw() {
            const frame = st.frames[st.index];
            const show = () => {
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                if (tween) {
                    const t = Math.min(1, (performance.now() - tween.start) / TWEEN_MS);
                    ctx.globalAlpha = 1;
                    ctx.drawImage(from, 0, 0);
                    ctx.globalAlpha = t;
                    ctx.drawImage(to, 0, 0);
                    ctx.globalAlpha = 1;
                    if (t >= 1) tween = null;
                    else requestAnimationFrame(show);
                } else {
                    ctx.drawImage(to, 0, 0);
                }
            };
            drawScene(to, frame);
            show();
        }

        function drawAnimated(prevFrame) {
            if (reduceMotion || !prevFrame) { tween = null; draw(); return; }
            drawScene(from, prevFrame);
            tween = { start: performance.now() };
            draw();
        }

        // ---------------------------------------------------------- panel

        function renderPanel(frame) {
            const rows = frame.panel || [];
            panelEl.innerHTML = rows.map((row) => {
                if (row.kind === "badges") {
                    return `<div class="net-row net-badges">${row.items.map((item) => `<span class="net-badge ${item.tone || ""}">${esc(item.text)}</span>`).join("")}</div>`;
                }
                if (row.kind === "matrix") {
                    const head = `<tr><th class="net-corner">i \\ j</th>${row.labels.map((label, j) => `<th class="${j === row.k ? "k" : ""}">${esc(label)}</th>`).join("")}</tr>`;
                    const bodyRows = row.rows.map((cells, i) => `<tr><th class="${i === row.k ? "k" : ""}">${esc(row.labels[i])}</th>${cells.map((cell, j) => {
                        const cls = [cell.tone, i === row.k || j === row.k ? "k" : ""].filter(Boolean).join(" ");
                        return `<td class="${cls}">${cell.old !== null ? `<s>${esc(cell.old)}</s>` : ""}<b>${esc(cell.v)}</b></td>`;
                    }).join("")}</tr>`).join("");
                    return `<div class="net-row net-matrix-row"><span class="net-row-label">${esc(row.label)}</span><table class="net-matrix">${head}${bodyRows}</table></div>`;
                }
                const cells = row.cells.length ? row.cells.map((cell) => {
                    const value = cell.arrow ? cellArrow(cell.v) : esc(cell.v);
                    return `<span class="net-cell ${cell.tone || ""}${row.keyed ? " keyed" : ""}">${row.keyed ? `<i>${esc(cell.k)}</i>` : ""}<b>${value}</b>${cell.sub ? `<em>${esc(cell.sub)}</em>` : ""}</span>`;
                }).join("") : `<span class="net-empty">${esc(row.empty || "-")}</span>`;
                return `<div class="net-row${row.muted ? " muted" : ""}"><span class="net-row-label">${esc(row.label)}</span><div class="net-cells">${cells}</div>${row.note ? `<span class="net-row-note">${esc(row.note)}</span>` : ""}</div>`;
            }).join("");
        }

        function cellArrow(text) {
            const [a, b] = String(text).split(">");
            return `${esc(a)}<span class="net-arrow" aria-label="to"></span>${esc(b)}`;
        }

        // ---------------------------------------------------------- render everything

        let lastFrame = null;

        function renderMeta() {
            const frame = st.frames[st.index];
            const state = runState();
            canvas.dataset.state = state;
            canvas.dataset.algorithm = st.algo;
            canvas.dataset.preset = st.presetKey;
            canvas.dataset.step = String(st.index);
            canvas.dataset.steps = String(st.frames.length - 1);
            canvas.dataset.result = frame.done ? frame.result : "";
            if (st.mode === "network") {
                const status = document.getElementById("search-status");
                if (status) {
                    status.textContent = frame.status;
                    status.dataset.state = state;
                }
            }
            const stepEl = document.getElementById("net-stat-step");
            if (stepEl) stepEl.textContent = `${st.index} / ${st.frames.length - 1}`;
            const nodesEl = document.getElementById("net-stat-nodes");
            if (nodesEl) nodesEl.textContent = String(st.g.nodes.length);
            const edgesEl = document.getElementById("net-stat-edges");
            if (edgesEl) edgesEl.textContent = String(st.g.edges.length);
            const algoEl = document.getElementById("net-stat-algo");
            if (algoEl) algoEl.textContent = ALGOS[st.algo].short;
            titleEl.textContent = `${st.g.title} / ${ALGOS[st.algo].short}`;
            const pauseBtn = document.getElementById("pause");
            if (st.mode === "network" && pauseBtn) pauseBtn.textContent = st.playing ? "Pause" : (state === "paused" ? "Resume" : "Pause");
        }

        function renderAll(animate) {
            const frame = st.frames[st.index];
            if (!frame) return;
            renderMeta();
            renderPanel(frame);
            if (animate && lastFrame && lastFrame !== frame) drawAnimated(lastFrame);
            else { tween = null; draw(); }
            lastFrame = frame;
        }

        // ---------------------------------------------------------- editing

        function hitNode(x, y) {
            const g = st.g;
            for (let i = g.nodes.length - 1; i >= 0; i--) {
                const q = pos(g.nodes[i]);
                if (Math.hypot(q.x - x, q.y - y) <= view.r + 4) return g.nodes[i];
            }
            return null;
        }

        function hitEdge(x, y) {
            let best = null, bestD = 9;
            st.g.edges.forEach((e) => {
                const geo = edgeGeometry(e);
                for (let s = 0; s <= 20; s++) {
                    const t = s / 20;
                    const px = geo.bend ? (1 - t) * (1 - t) * geo.a.x + 2 * (1 - t) * t * geo.c.x + t * t * geo.b.x : geo.a.x + (geo.b.x - geo.a.x) * t;
                    const py = geo.bend ? (1 - t) * (1 - t) * geo.a.y + 2 * (1 - t) * t * geo.c.y + t * t * geo.b.y : geo.a.y + (geo.b.y - geo.a.y) * t;
                    const d = Math.hypot(px - x, py - y);
                    if (d < bestD) { bestD = d; best = e; }
                }
            });
            return best;
        }

        function point(event) {
            const rect = canvas.getBoundingClientRect();
            return { x: event.clientX - rect.left, y: event.clientY - rect.top };
        }

        const tool = () => (dom.editCard.querySelector('input[name="net-tool"]:checked') || {}).value || "move";

        function toCustom() {
            if (st.presetKey === "custom") return;
            const g = st.g;
            g.key = "custom";
            g.title = "Custom graph";
            g.pairs = null;
            st.presetKey = "custom";
            presetSelect.querySelector('option[value="custom"]').hidden = false;
            presetSelect.value = "custom";
        }

        function reindex(g) {
            g.nodes.forEach((node, i) => { node.id = i; });
            g.edges.forEach((e, i) => { e.id = i; });
            g.byLabel = new Map(g.nodes.map((node) => [node.label, node.id]));
            if (g.src >= g.nodes.length) g.src = 0;
            if (g.dst >= g.nodes.length) g.dst = Math.max(0, g.nodes.length - 1);
            srcSelect.innerHTML = g.nodes.map((node) => `<option value="${esc(node.label)}">${esc(node.label)}</option>`).join("");
            if (g.nodes.length) srcSelect.value = L(g, g.src);
        }

        function edited() {
            reindex(st.g);
            if (!fits(st.algo, st.g)) {
                const fallback = Object.keys(ALGOS).find((key) => fits(key, st.g));
                st.algo = fallback;
                algoSelect.value = fallback;
            }
            recompute(false);
        }

        canvas.addEventListener("pointerdown", (event) => {
            if (st.mode !== "network") return;
            const { x, y } = point(event);
            const node = hitNode(x, y);
            const mode = tool();
            if (mode === "move") {
                if (node) {
                    st.dragging = { node, moved: false };
                    canvas.setPointerCapture(event.pointerId);
                }
                return;
            }
            stop();
            const g = st.g;
            if (mode === "node" && !node) {
                toCustom();
                const used = new Set(g.nodes.map((n) => n.label));
                let label = 0;
                while (used.has(String(label))) label += 1;
                g.nodes.push({
                    id: g.nodes.length,
                    label: String(label),
                    x: Math.min(1, Math.max(0, (x - view.pad) / (view.w - 2 * view.pad))),
                    y: Math.min(1, Math.max(0, (y - view.pad) / (view.h - 2 * view.pad)))
                });
                edited();
            } else if (mode === "edge" && node) {
                if (st.edgeFrom === null) {
                    st.edgeFrom = node.id;
                    draw();
                } else if (st.edgeFrom !== node.id) {
                    toCustom();
                    const a = st.edgeFrom, b = node.id;
                    const exists = g.edges.some((e) => (e.from === a && e.to === b) || (!g.directed && e.from === b && e.to === a));
                    if (!exists) {
                        const w = parseInt(weightInput.value, 10);
                        g.edges.push({ id: g.edges.length, from: a, to: b, w: Number.isFinite(w) ? w : 1, bend: 0 });
                        if (Number.isFinite(w) && w !== 1) g.weighted = true;
                    }
                    st.edgeFrom = null;
                    edited();
                } else {
                    st.edgeFrom = null;
                    draw();
                }
            } else if (mode === "delete") {
                if (node) {
                    toCustom();
                    g.edges = g.edges.filter((e) => e.from !== node.id && e.to !== node.id);
                    g.nodes = g.nodes.filter((n) => n !== node);
                    const remap = new Map(g.nodes.map((n, i) => [n.id, i]));
                    g.edges.forEach((e) => { e.from = remap.get(e.from); e.to = remap.get(e.to); });
                    if (g.src === node.id || !remap.has(g.src)) g.src = 0; else g.src = remap.get(g.src);
                    g.dst = remap.has(g.dst) ? remap.get(g.dst) : Math.max(0, g.nodes.length - 2);
                    edited();
                } else {
                    const e = hitEdge(x, y);
                    if (e) {
                        toCustom();
                        g.edges = g.edges.filter((x2) => x2 !== e);
                        edited();
                    }
                }
            }
        });

        canvas.addEventListener("pointermove", (event) => {
            if (!st.dragging) return;
            const { x, y } = point(event);
            const node = st.dragging.node;
            node.x = Math.min(1.04, Math.max(-.04, (x - view.pad) / (view.w - 2 * view.pad)));
            node.y = Math.min(1.04, Math.max(-.04, (y - view.pad) / (view.h - 2 * view.pad)));
            st.dragging.moved = true;
            tween = null;
            draw();
        });

        const endDrag = () => { st.dragging = null; };
        canvas.addEventListener("pointerup", endDrag);
        canvas.addEventListener("pointercancel", endDrag);

        // ---------------------------------------------------------- controls

        dom.modeCard.addEventListener("change", (event) => {
            if (event.target.name === "graph-view") setMode(event.target.value);
        });

        presetSelect.addEventListener("change", () => {
            if (presetSelect.value === "custom") return;
            st.opts.src = null;
            st.opts.k = null;
            loadGraph(presetSelect.value);
            const own = PRESETS[presetSelect.value].algo;
            chooseAlgo(fits(st.algo, st.g) && sharesFamily(st.algo, own) ? st.algo : own);
            recompute(false);
            resize();
        });

        function sharesFamily(a, b) {
            const families = [["kruskal", "prim"], ["dijkstra", "floyd"], ["bipartite", "greedy"], ["kahn", "dfs3"]];
            return families.some((f) => f.includes(a) && f.includes(b));
        }

        algoSelect.addEventListener("change", () => {
            st.opts.src = null;
            chooseAlgo(algoSelect.value);
            recompute(false);
            resize();
        });

        srcSelect.addEventListener("change", () => {
            st.opts.src = srcSelect.value;
            recompute(false);
        });
        kInput.addEventListener("change", () => {
            st.opts.k = Math.max(0, Math.min(9, parseInt(kInput.value, 10) || 0));
            recompute(false);
        });
        copyInput.addEventListener("change", () => recompute(false));
        buildInput.addEventListener("change", () => recompute(false));
        colorsInput.addEventListener("change", () => recompute(false));
        speedInput.addEventListener("input", () => { speedValue.textContent = speedInput.value; });
        directedInput.addEventListener("change", () => {
            toCustom();
            st.g.directed = directedInput.checked;
            edited();
        });
        document.getElementById("net-clear").addEventListener("click", () => {
            toCustom();
            st.g.nodes = [];
            st.g.edges = [];
            st.g.directed = directedInput.checked;
            edited();
        });
        dom.editCard.addEventListener("change", (event) => {
            if (event.target.name === "net-tool") {
                st.edgeFrom = null;
                canvas.dataset.tool = event.target.value;
                draw();
            }
        });

        // The page's shared buttons: in Network mode, take the click before app.js sees it.
        document.addEventListener("click", (event) => {
            if (st.mode !== "network") return;
            const button = event.target.closest && event.target.closest("#start, #pause, #step, #step-level, #reset, #reset-defaults, #net-back");
            if (!button) return;
            event.stopPropagation();
            event.preventDefault();
            switch (button.id) {
                case "start": play(); break;
                case "pause": if (st.playing) pause(); else if (st.index > 0 && runState() !== "done") play(); break;
                case "step": stop(); go(st.index + 1, true); break;
                case "net-back": stop(); go(st.index - 1, false); break;
                case "reset": stop(); go(0, false); break;
                case "reset-defaults":
                    st.opts = { k: null, copy: true, build: false, colors: 3, src: null };
                    copyInput.checked = true; buildInput.checked = false; colorsInput.checked = true;
                    loadGraph(PRESETS[st.presetKey] ? st.presetKey : "course-schedule");
                    chooseAlgo(PRESETS[st.presetKey].algo);
                    recompute(false);
                    break;
                default: break;
            }
        }, true);

        window.addEventListener("keydown", (event) => {
            if (st.mode !== "network") return;
            const tag = (event.target && event.target.tagName) || "";
            if (/^(INPUT|SELECT|TEXTAREA)$/.test(tag)) return;
            if (tag === "BUTTON" && event.code === "Space") {
                // Let the button click itself, but keep app.js from starting the hidden grid.
                event.stopImmediatePropagation();
                return;
            }
            if (event.code === "Space") {
                event.preventDefault();
                event.stopImmediatePropagation();
                if (st.playing) pause(); else play();
            } else if (event.code === "ArrowRight") {
                event.preventDefault();
                stop();
                go(st.index + 1, true);
            } else if (event.code === "ArrowLeft") {
                event.preventDefault();
                stop();
                go(st.index - 1, false);
            }
        }, true);

        window.addEventListener("resize", () => { if (st.mode === "network") resize(); });
        if (window.ToolShared && window.ToolShared.onThemeChange) window.ToolShared.onThemeChange(() => { tween = null; draw(); });
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (st.frames.length) draw(); });

        // ---------------------------------------------------------- debug / recorder API

        function snapshotState() {
            const frame = st.frames[st.index];
            return Object.assign({
                mode: st.mode,
                preset: st.presetKey,
                algo: st.algo,
                step: st.index,
                steps: st.frames.length - 1,
                state: runState(),
                status: frame.status,
                result: frame.done ? frame.result : "",
                done: frame.done,
                nodes: st.g.nodes.map((node) => ({ label: node.label, state: (frame.nodes[node.id] || {}).state || "", tag: (frame.nodes[node.id] || {}).tag || null })),
                edges: st.g.edges.map((e) => ({ edge: edgeKey(st.g, e), w: e.w, state: frame.hot[e.id] || (frame.edges[e.id] || {}).state || "" })),
                ring: frame.ring.map((id) => L(st.g, id))
            }, JSON.parse(JSON.stringify(frame.data)));
        }

        const api = {
            state: snapshotState,
            step(n = 1) { stop(); go(st.index + n, false); return snapshotState(); },
            back(n = 1) { stop(); go(st.index - n, false); return snapshotState(); },
            goto(i) { stop(); go(i, false); return snapshotState(); },
            end() { stop(); go(st.frames.length - 1, false); return snapshotState(); },
            reset() { stop(); go(0, false); return snapshotState(); },
            play() { play(); return snapshotState(); },
            pause() { pause(); return snapshotState(); },
            statuses: () => st.frames.map((frame) => frame.status),
            load(options = {}) {
                setMode("network");
                if (options.copy !== undefined) copyInput.checked = Boolean(options.copy);
                if (options.build !== undefined) buildInput.checked = Boolean(options.build);
                if (options.colors !== undefined) colorsInput.checked = options.colors !== 2;
                st.opts.src = options.src !== undefined ? String(options.src) : null;
                if (options.edges) loadGraph(null, customGraphFromSpec(options.edges));
                else if (options.preset) loadGraph(options.preset);
                if (options.k !== undefined) kInput.value = options.k;
                chooseAlgo(options.algo || (PRESETS[st.presetKey] && PRESETS[st.presetKey].algo) || st.algo);
                recompute(false);
                resize();
                if (options.steps === "end") go(st.frames.length - 1, false);
                else if (options.steps) go(options.steps, false);
                return snapshotState();
            },
            setMode: (mode) => setMode(mode),
            // Where a node is drawn, in viewport pixels (for recorders and tests that click it).
            point(label) {
                const node = st.g.nodes.find((n) => n.label === String(label));
                if (!node) return null;
                const rect = canvas.getBoundingClientRect();
                const q = pos(node);
                return { x: rect.left + q.x * (rect.width / view.w), y: rect.top + q.y * (rect.height / view.h) };
            },
            presets: () => Object.keys(PRESETS),
            algorithms: () => Object.keys(ALGOS)
        };
        window.GraphsNetwork = api;
        const expose = () => { window.GraphsDebug = Object.assign(window.GraphsDebug || {}, { network: api }); };
        expose();
        // app.js replaces window.GraphsDebug on DOMContentLoaded; put the network API back after it.
        document.addEventListener("DOMContentLoaded", () => {
            expose();
            const status = document.getElementById("search-status");
            if (st.mode === "network" && status && st.gridStatus) {
                st.gridStatus.text = status.textContent;
                st.gridStatus.state = status.dataset.state;
                renderMeta();
            }
        });
        window.addEventListener("load", expose);

        // ---------------------------------------------------------- first load

        const custom = setup.edges ? customGraphFromSpec(setup.edges) : null;
        loadGraph(st.presetKey, custom);
        if (setup.k !== null && Number.isFinite(setup.k)) kInput.value = Math.max(0, Math.min(9, setup.k));
        if (setup.src !== null) st.opts.src = setup.src;
        chooseAlgo(setup.algo || (PRESETS[st.presetKey] && PRESETS[st.presetKey].algo));
        recompute(false);
        setMode(setup.mode, { force: true, silent: true });
        if (setup.steps === "end") go(st.frames.length - 1, false);
        else if (setup.steps) go(setup.steps, false);
        if (setup.mode === "network") writeUrl();
        // Fonts and the final layout settle after load; measure again then.
        window.addEventListener("load", () => { if (st.mode === "network") resize(); });
    }

    // The script sits at the end of <body>, so the DOM is there already. Running now,
    // before app.js's DOMContentLoaded handler, opens the page in the right mode
    // without a flash of the grid.
    init();
})();
