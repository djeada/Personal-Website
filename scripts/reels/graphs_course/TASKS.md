# Graphs for LeetCode: tasks

Everything on screen must come from a real tool page or from the video overlay (cards, code panels, captions). This file lists the work that makes every shot in the plan filmable. Phase A covers sections 1 to 3 and Phase B covers sections 4 to 8. Both are done: all eight sections are recorded and rendered, along with the eight reels and the joined full video.

A task is done when the feature works from the page's own controls, can be set up exactly from URL parameters (so a recording is repeatable), has a Playwright test, and looks right in both themes.

## Phase A: sections 1 to 3

### Graphs tool (src/tools/graphs)

- A1. Seeded mazes. A Seed input and a `seed` URL parameter. Switching the algorithm keeps the maze, so DFS and BFS can be compared on the same grid. Needed for part 2 beat 1 and part 3 beat 1.
- A2. URL setup for a recorder: algorithm, size, density, seed, start, end and sources.
- A3. Frontier drawing. Cells waiting in the BFS queue or DFS stack look different from visited cells. Part 2 beat 4.
- A4. A real DFS that backtracks, with the current path from the start highlighted, so viewers see it grow, hit a dead end and shrink. Part 3 beat 2.
- A5. A "Show distances" toggle that prints each visited cell's BFS level. Part 2 beat 2.
- A6. Multi-source BFS with sources placed by clicking, processed level by level, with a Level stat. Part 2 beat 8.
- A7. An islands mode: land and water, a visible row-by-row scan, each island flooded in its own color, and an Islands counter. Part 3 beats 5 and 6.
- A8. A finished state the recorder can detect, for example a `data-state="done"` attribute.

### Data Structure Lab (src/tools/data_structures)

- A9. The Graph model panel shows the adjacency list and updates after every operation. Part 1 beat 4.
- A10. Graph search can run BFS or DFS, and the trace prints the visiting order. Part 2 beat 5 and part 3 beat 4.
- A11. DFS reports the first edge that leads back to a visited node other than the parent, and highlights it. Part 3 beat 8.
- A12. Removing a vertex reports how many connected components are left. Part 1 beat 8.

### Visual polish (requested before any final render)

- A13. One or two polish passes on both tools, judged on 1920×1080 screenshots of the exact states the video films: distinct, readable colors for start, end, path, visited, frontier, current DFS path, water and islands; a legend for those colors; cleaner node and edge drawing in the lab graph; clearer stat readouts and panel spacing. Everything stays within docs/design-system.md.

### Renderer (scripts/reels/graphs_course)

- A14. A section renderer at 1920×1080: it parses the beat scripts, makes a temporary Kokoro voice per beat (or splits the owner's recording on silences), films the real pages with the paused-clock recorder, and adds a music bed ducked under the voice at -16 LUFS. Output is an MP4, an SRT and a cover image.
- A15. Overlay cards: problem statements with highlighted key words, a code panel that types itself in with line highlights, a constraints card, a checklist that builds line by line, label tags, a two-column comparison card, a section title card and lower-third captions.
- A16. Shot lists for sections 1, 2 and 3, followed by draft renders for the owner to watch.

## Phase B: sections 4 to 8

These all need a node-and-edge view, which the graphs tool does not have yet. The plan is to add a Network mode to the graphs tool next to the grid. It would support directed or undirected edges, optional weights and step-by-step animation, and come with presets that match the LeetCode examples used in the scripts.

### Network mode foundation

- B1. The canvas: nodes, straight or curved edges, arrowheads for directed edges, weight labels, and highlight states (current, queued, done, rejected, path). Editing by clicking, plus presets and URL setup.
- B2. A data panel under the graph that each algorithm can fill: a queue, a heap, an indegree row, a dist row, a parent array or a sorted edge list.
- B3. Step, play, pause and reset, shared with the grid mode, plus the same finished-state attribute.

### Section 4: topological sort

- B4. Kahn's algorithm: an indegree badge on every node, nodes with indegree zero entering the queue, edges fading as they are used, the output order growing below.
- B5. A cycle preset where Kahn's algorithm stops early and the leftover nodes are highlighted, with "fewer than n in the output" stated in the trace.
- B6. DFS three-color cycle detection: white, gray and black nodes, and a gray-to-gray edge flagged as a cycle. This is the directed-graph follow-up promised at the end of part 3.
- B7. A Course Schedule preset whose edge direction matches the pairs as LeetCode gives them (pair a, b becomes the edge b → a).

### Section 5: Union-Find

- B8. A Disjoint Set structure in the Data Structure Lab: a forest view plus the parent array, with operations find, union and connected.
- B9. find shows path compression: the path is walked, then the nodes are re-pointed at the root.
- B10. union links the smaller tree under the larger one, shows sizes, and a component counter goes down.
- B11. A Redundant Connection preset: edges are added in order, and the first union that finds both ends already joined is highlighted as the answer.

### Section 6: weighted shortest paths

- B12. Weighted cells in the grid mode ("mud" that costs more), so Dijkstra visibly goes around expensive cells while BFS walks straight through them.
- B13. Dijkstra in Network mode with the heap shown, including stale entries being skipped.
- B14. Bellman–Ford for "at most k stops": passes shown one at a time with the copied dist row next to the live one, on a Cheapest Flights preset where copying changes the answer.
- B15. A Floyd–Warshall matrix view for a small graph, k loop outermost, with cells changing as each intermediate node is added.
- B16. 0-1 BFS with a deque in the grid mode, if time allows; otherwise this is a code card only.

### Section 7: bipartite graphs and coloring

- B17. Bipartite 2-coloring with BFS, started from every uncolored node, with a disconnected preset where the odd cycle sits in the second component.
- B18. The failing edge is highlighted along with the odd cycle it closes.
- B19. Greedy coloring with up to max degree + 1 colors, with a Flower Planting preset (degree at most 3, four colors).

### Section 8: minimum spanning trees

- B20. Kruskal: the edge list sorted on the side, each edge accepted or rejected through Union-Find, with the forest merging on screen.
- B21. Prim with a heap from one start node, plus a points preset for Min Cost to Connect All Points.
- B22. The closing cheat sheet: a card that builds the phrase-to-algorithm table row by row over short clips from earlier sections.

### Presets and views the scripts for sections 4 to 8 assume

The scripts for sections 4 to 8 were written before the visuals, so these are the exact states they describe. Build them like this, or change the script line before the voice for that beat is recorded.

- Section 4: Course Schedule with six courses and edges 0→1, 0→2, 1→3, 2→3, 3→4, 2→5 (Kahn order 0, 1, 2, 3, 5, 4); the same plus 4→1 (output stops at 0, 2, 5); a directed diamond A→B, A→C, B→D, C→D, then D→A added. Alien Dictionary (wrt, wrf, er, ett, rftt) is an overlay card.
- Section 5: Disjoint Set with elements 1 to 5 and edges 1-2, 2-3, 3-4, 1-4, 1-5 (answer 1-4); a tall-tree preset for path compression. Network Connected and Accounts Merge are cards.
- Section 6: a mud grid where BFS and Dijkstra paths visibly differ; Network Delay Time with one node pushed at 7 and then at 4 (stale entry); Cheapest Flights with k = 1 where reading without the copy gives a cheaper, wrong price; a five-node Floyd–Warshall matrix.
- Section 7: square, triangle, and a two-piece graph whose second piece is a triangle; Flower Planting with max degree 3 and four colors.
- Section 8: a seven-node weighted undirected graph for both Kruskal and Prim; the cheat-sheet rows reuse clips from sections 2 to 7.

### Reels (after the sections)

- B23. The renderer's vertical 1080×1920 mode, reusing each section's shot definitions with a shorter caption timeline.
- B24. Eight reels as listed in PLAN.md.

## Order

Phase A runs now. Once the owner approves the drafts of sections 1 to 3, Phase B goes section by section in the order above. Each section is built, its script is written against the real visuals, and then a draft is rendered for review before the voice is recorded.
