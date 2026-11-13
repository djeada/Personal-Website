# Section 3: Depth-first search, components and cycles

Target length 4:45, about 660 spoken words. Read each beat as one take and leave a second of silence before the next one.

The running examples are the same seeded maze as part 2, Number of Islands on the graphs tool's islands mode, and the six-node graph from part 1 in the Data Structure Lab. Problem statements on screen are short paraphrases, not LeetCode's text.

## Beat 1

On screen (tool): graphs tool, the same seed as part 2, DFS running until it finds the target. Then the path length stat next to the BFS path length from part 2.

Same maze as last time, but now with depth-first search. It found a path. But look at the length. It's much longer than the one BFS found. DFS doesn't care about distance at all. So why do we need it? Because a huge number of LeetCode problems never ask for the shortest anything. They ask you to visit everything, count pieces, or find a loop. That's DFS territory.

## Beat 2

On screen (tool): DFS stepping slowly. The current path from the start is highlighted. It grows into a dead end, shrinks back, then grows in a new direction.

The idea: pick a direction and keep going until you can't. Then back up to the last place where you had another option, and try that. The highlighted line is the path DFS is currently on. Watch it run into a dead end, shrink back, and branch off somewhere new. That backing up is called backtracking, and it's the heart of DFS.

## Beat 3

On screen (card): the recursive DFS code panel.

```python
def dfs(u):
    seen.add(u)
    for v in graph[u]:
        if v not in seen:
            dfs(v)
```

The recursive version is about the shortest useful code in this whole course. Mark the node, then call DFS on each neighbor you haven't seen. The call stack does the backtracking for you. One warning for Python: the default recursion limit is about a thousand calls. On a big grid, a single long path can blow through that, so either raise the limit or use an explicit stack, which does the same thing without recursion.

## Beat 4

On screen (tool): Data Structure Lab, the graph from part 1. BFS search from A, then DFS search from A. The two traces sit one above the other.

Compare the two orders on our small graph. BFS goes A, B, C, D, E, F, ring by ring. DFS goes A, B, D, F, then backs all the way up and finishes with C and E. Both visit every node reachable from A, and both take order V plus E time. They just visit them in a different order, and that order is what decides which one fits the problem.

## Beat 5

On screen (card): "A map of land and water. How many islands are there?" Then the graphs tool in islands mode, the scan pointer moving row by row.

Now the most famous graph problem on LeetCode: Number of Islands. Remember the third question from part one: is the graph connected? Here it definitely isn't. So we scan every cell, row by row. Whenever we find land that we haven't visited, that's a new island. We add one to the count and flood the whole island with DFS, so we never count it twice.

## Beat 6

On screen (tool): islands mode running. Each island fills with its own color while the Islands stat counts up.

Watch it work. The scan finds land, the flood colors the whole island, the count goes up, and the scan moves on, skipping everything already colored. Every cell is looked at by the scan once, and flooded at most once, so the whole thing is linear in the size of the grid. The same pattern counts components in any graph: Number of Provinces just loops over people instead of cells.

## Beat 7

On screen (card): the island counting code.

```python
count = 0
for r in range(rows):
    for c in range(cols):
        if grid[r][c] == "1":
            count += 1
            sink(r, c)   # DFS that turns "1" into "0"
return count
```

A handy trick for grids: instead of a separate visited set, mark land as visited by overwriting it, turning each one into a zero as you flood. And if the problem asks for the biggest island instead, like Max Area of Island, have the flood return how many cells it covered, and keep the maximum.

## Beat 8

On screen (tool): back in the lab. Add the edge E to F, then run the DFS search. The trace reports that the edge from C leads back to A, which is already visited, and the edge is highlighted.

DFS also finds cycles. Let's add the edge from E to F, which we saw in part one creates a loop. DFS walks A, B, D, F, E, C, and from C it sees A, which is already visited and isn't the node it just came from. In an undirected graph, that's the whole test. Reaching a visited node other than your parent means a cycle.

## Beat 9

On screen (card): a two-column card. Left "BFS": fewest steps, levels and minutes. Right "DFS": visit everything, components, cycles, all paths.

In a directed graph that test isn't enough, and we'll fix it in part four with three colors. For now, choosing is simple. If the question says fewest steps, levels or minutes, use BFS. If it says count, connected, any path, or explore everything, either works, and DFS is usually less code.

## Beat 10

On screen (card): a checklist builds line by line: go deep and backtrack, not the shortest path, loop over every start, mark by overwriting, parent check for cycles, iterative for deep inputs.

So, DFS: go deep, backtrack, and don't expect shortest paths. Loop over every start to count components, and use the parent check for cycles in undirected graphs. Next up are graphs with a direction, and the problem that comes up in almost every interview list: course prerequisites, and topological sort.
