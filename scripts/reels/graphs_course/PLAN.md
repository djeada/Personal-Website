# Graphs for LeetCode: video plan

The first full-length video teaches the graph theory you actually need to solve LeetCode problems. It is built from eight sections of at most five minutes each. Every section is a standalone video, every section has its own vertical reel, and the eight sections joined together make the full video (about 36 minutes, with YouTube chapters at each section start).

All footage is filmed on the real tool pages, [graphs](../../../src/tools/graphs/) and [data_structures](../../../src/tools/data_structures/), the same way the optics reels are: Playwright with a paused clock, one frame per visual state, and the Technical Editorial overlay. The text follows the new notes in the Algorithms-And-Data-Structures repo (graphs.md and its "Reading the Problem Statement" table), so the video and the notes say the same thing.

## Sections

Each script is written for about 140 to 150 words per minute, so 600 to 680 words fill four and a half minutes. Each section ends with a one-line bridge to the next one, so the full video flows without extra recording.

| # | Section | Length | What the viewer must leave with | LeetCode problems named |
| --- | --- | --- | --- | --- |
| 1 | Reading a graph problem | 4:30 | Graphs hide in stories. Build the adjacency list first, then ask four questions: directed, weighted, connected, tree. Then check the constraints. | 207, 547, 261, 200 |
| 2 | Breadth-first search | 4:45 | Queue, mark when you push, levels are distances. Shortest path on unweighted graphs. Many sources go into the queue together, and counting levels gives "minutes". | 1091, 994, 542, 127 |
| 3 | Depth-first search, components and cycles | 4:45 | Go deep, then backtrack. DFS finds a path, not the shortest one. Loop over all starts to count components. The parent check finds cycles in undirected graphs. | 200, 695, 547 |
| 4 | Topological sort | 4:30 | Prerequisites mean a DAG. Edge direction from the wording, indegree array, Kahn's queue, and fewer than n outputs means a cycle. Three-color DFS for directed cycles. Building edges yourself in Alien Dictionary. | 207, 210, 802, 269 |
| 5 | Union-Find | 4:30 | Groups that only merge. find with path compression, union by size, a component counter, and the first union that fails is the redundant edge. Strings get integer ids. | 684, 323, 1319, 721 |
| 6 | Weighted shortest paths | 5:00 | Why BFS fails once edges cost different amounts. Dijkstra with a heap and stale entries, only for non-negative weights. 0-1 BFS. Bellman–Ford for "at most k stops" with a copied dist. Floyd–Warshall when n is small. | 743, 1631, 787, 1334 |
| 7 | Bipartite graphs and coloring | 4:00 | Two groups means 2-coloring with BFS. An odd cycle makes it impossible. Start from every uncolored node. Greedy coloring needs at most max degree + 1 colors, and general coloring is NP-hard, so problems always have special structure. | 785, 886, 1042 |
| 8 | Minimum spanning trees and the cheat sheet | 4:45 | "Minimum cost to connect all" means MST. Kruskal is sort plus Union-Find, Prim is a heap, and dense inputs use the O(V²) Prim. Then a recap: the phrase-to-algorithm table. | 1584, 1135 |

Left for a second video: bridges and articulation points (1192), Eulerian paths (332), BFS over states (847) and strongly connected components. These appear in the notes, but each needs its own visual, and the first video is already long enough.

## Script format

Each section script is a markdown file in [`scripts/`](./scripts/). It is split into numbered beats. Every beat has one line saying what is on screen, then the narration paragraph you read. Read each beat as one take and leave about a second of silence between beats. We cut the recording on those silences (ffmpeg `silencedetect`), so every beat's audio lines up with its shot without manual editing.

Record as WAV or high-bitrate MP3, one file per section, named like `01-reading-graph-problems.wav`.

## Reels

Every section gets one vertical reel of 35 to 55 seconds. A reel is not a cut-down of the section. It takes the single most surprising idea and shows it on the tool, in the calm captioned style of the optics reels (one short sentence at a time, no voice required, platform audio optional).

| # | Reel | The idea it shows |
| --- | --- | --- |
| 1 | Four words that pick your algorithm | directed, weighted, connected, tree, each with a one-line consequence on screen |
| 2 | Why BFS finds the shortest path | the frontier grows in rings; the first time a cell is reached is the fewest steps |
| 3 | DFS found a path. Not the shortest one. | same maze, DFS then BFS, path lengths side by side |
| 4 | Course Schedule in 40 seconds | indegrees count down, zeros enter the queue, a cycle leaves nodes behind |
| 5 | The edge that closes a cycle | Union-Find merges groups until one union finds both ends already joined |
| 6 | BFS ignores the mud | BFS walks straight through expensive cells and Dijkstra goes around them |
| 7 | Why a triangle can't be two-colored | 2-coloring succeeds on a square and fails on a triangle |
| 8 | Six phrases, six algorithms | the cheat-sheet table, one row at a time on top of the matching animation |

## Tool work needed first

The detailed, numbered task list is in [TASKS.md](./TASKS.md). The current tools can film section 1 and parts of 2 and 3. Sections 4 to 8 need visuals that do not exist yet. As with the optics series, the tools are audited and extended before anything is filmed.

Graphs tool, grid mode (sections 2, 3 and 6):
- A seed for the maze, so DFS, BFS and Dijkstra can run on the exact same grid for side-by-side shots.
- Multi-source BFS: several start cells, plus a level counter shown as "minute 3" (Rotting Oranges).
- An islands mode that colors each connected component and counts them (Number of Islands).
- Weighted cells (for example, mud that costs 5), so Dijkstra visibly differs from BFS. Today every cell costs 1, which makes Dijkstra behave exactly like BFS.

Graphs tool, a new network mode (sections 4, 6, 7 and 8). This is a node-and-edge canvas next to the grid, with directed or undirected and weighted or unweighted edges, presets that match the LeetCode examples, and step-by-step animation for:
- Kahn's topological sort with indegree badges and the queue drawn under the graph.
- Bipartite 2-coloring that highlights the odd cycle when it fails, and greedy coloring.
- Dijkstra with the heap shown, and Bellman–Ford passes with the copied dist row for "k stops".
- Kruskal (edges sorted, each accepted or rejected through Union-Find) and Prim.

Data Structure Lab (sections 1 and 5):
- A Disjoint Set structure: a forest view plus the parent array, with find showing path compression and union linking the smaller tree under the larger.
- A small check of the existing Graph structure: its model panel should show the adjacency list, and removing a vertex should visibly split the graph into components (used in section 1).

## Build

The pipeline reuses the optics recorder rather than starting a new one: deterministic Playwright capture of the real pages, an injected overlay for camera moves, captions and a spotlight, and the shared synth for a quiet music bed under the voice.

1. Tool work above, with tests, merged and deployed.
2. Scripts for all eight sections, reviewed by you.
3. You record the eight voice files.
4. For each section, a shot list keyed to beats. Silence detection gives the beat timings, and each shot is stretched to its beat. Output is 1920×1080 at 30 fps, with the voice normalized to -16 LUFS and music ducked underneath.
5. The same shot definitions rendered at 1080×1920 for the reels, with their own shorter caption timeline.
6. The full video: the eight sections joined with a short title card at each boundary, plus a chapters list for the YouTube description generated from the section start times.

Output layout: `scripts/reels/out/graphs-course/section-0N.mp4`, `reel-0N.mp4`, `graphs-for-leetcode.mp4`, and `chapters.txt`.

## Order of work

Section 1 is fully scriptable and filmable today, so it goes first as the pilot. It settles the voice, pacing, overlay and audio mix before the larger tool work starts. After that, the tool work is done in section order (seeded grid and multi-source BFS, islands, network mode with Kahn, Disjoint Set, weights and Dijkstra, coloring, Kruskal and Prim), and each section is scripted, recorded and built as soon as its visuals exist.
