# Section 1: Reading a graph problem

Target length 4:30, about 640 spoken words. Read each beat as one take and leave a second of silence before the next one.

The section is built around three problems that return at the end, and again later in the course: Course Schedule (part 4), Number of Islands (parts 2 and 3) and Cheapest Flights Within K Stops (part 6). The statements on screen are short paraphrases, not LeetCode's text.

"Tool" shots are filmed on the real pages. "Card" shots are drawn by the video overlay: a problem statement, a code panel or a checklist on top of the dimmed page.

## Beat 1

On screen (card): three problem cards appear one after another.
- "You have n courses. Some must be taken before others. Can you finish all of them?"
- "A map of land and water. How many islands are there?"
- "Cities, flights and ticket prices. What is the cheapest trip with at most k stops?"

Here are three LeetCode problems. In the first, some courses have to be taken before others, and you're asked whether you can finish them all. In the second, you get a map of land and water and you count the islands. In the third, you find the cheapest trip between two cities with at most k stops. None of them says the word graph. All three are graph problems, and each statement already tells you which algorithm it wants, if you know how to read it.

## Beat 2

On screen (card): the key words on each card light up: "before", "land", "prices", "at most k stops".

That's what this first part is about. Before any search algorithm, you'll learn to turn a story into a graph, build it in code, and ask four questions that narrow the choice down. At the end we'll read these three problems again.

## Beat 3

On screen (tool): Data Structure Lab, Graph. The six vertices appear, then the edges.

A graph is two things: nodes and edges. Nodes are the things in the story, edges are the relationships. In the course problem each course is a node and each prerequisite is an edge. On the map each land cell is a node, joined to the land beside it. With the flights, cities are nodes and flights are edges. Once you can name both, the story becomes a structure you know how to search.

## Beat 4

On screen (card + tool): the code panel types in line by line, while the lab adds the matching edge for each pair.

```python
graph = [[] for _ in range(n)]
for a, b in edges:
    graph[a].append(b)
    graph[b].append(a)   # only if undirected
```

LeetCode almost never hands you the graph ready to search. It hands you a list of pairs. So the first code you write is nearly always these four lines: an empty list for every node, and for each pair, one end appended to the other's list. That's an adjacency list, the shape every search in this course expects. It costs one pass over the edges, so it's never the slow part.

## Beat 5

On screen (card): the last line of the code is highlighted, then the course card with "before" marked.

Now the four questions. First: does an edge go both ways? Friendships, roads and cables usually do, so you add the edge twice. That's the last line, and forgetting it is the most common bug in graph code. Prerequisites and one-way streets have a direction, so you add the edge once, and you have to read which way it points. In Course Schedule, the pair a, b means take b first, so the edge goes from b to a.

## Beat 6

On screen (tool): graphs tool, BFS on the maze until the path appears. Then the flights card with "prices" marked.

Second: does every edge cost the same? On a grid, one step is one step, and breadth-first search finds the shortest path, like this. The moment edges carry prices or travel times, BFS starts giving wrong answers, and you need Dijkstra or one of its relatives. In the flight problem, the word prices is what rules plain BFS out.

## Beat 7

On screen (tool): the lab's starting graph, six nodes and five edges. Then add the edge E to F; the new edge is highlighted.

Third: is it a tree? This graph has six nodes, five edges and no cycles, so it's a tree. A tree is always connected and always has n minus one edges. Add one more edge, here from E to F, and you've made a cycle: A, B, D, F, E, C and back to A. Trees are the easy case: you can skip the visited set and just remember where you came from.

## Beat 8

On screen (tool): reset the lab to the starting graph, then remove vertex D. F is left on its own.

Fourth: is the graph promised to be connected? Watch what happens when I remove this node. F is cut off, and a search from A will never reach it. So unless the statement promises connectivity, don't search once from node zero and stop. Loop over every node and start a new search from each one you haven't visited. Counting those starts counts the pieces, and on the map, that count is the answer.

## Beat 9

On screen (card): two constraint lines, "1 ≤ n ≤ 10⁵" and "1 ≤ n ≤ 100".

One last habit: read the constraints, because they quietly tell you the intended speed. With n up to a hundred thousand, you need about one pass over the nodes and edges. With n at most a hundred, even a cubic algorithm is fine.

## Beat 10

On screen (card): the three problem cards return, and each one gains a label: "directed → topological sort, part 4", "grid, not connected → BFS or DFS, parts 2 and 3", "weighted, limited stops → Bellman–Ford, part 6".

So let's read our three problems again. Courses: directed edges, from the prerequisite to the course. That's topological sort, in part four. The map: a grid where land touches land, with no promise that it's connected. That's counting components, in parts two and three. Flights: directed, weighted, with a limit on stops. That's Bellman–Ford, in part six. Same four questions every time. Next, we take the adjacency list we just built and run the first real algorithm on it: breadth-first search.
