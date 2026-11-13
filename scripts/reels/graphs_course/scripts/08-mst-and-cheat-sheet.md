# Section 8: Minimum spanning trees and the cheat sheet

Target length 4:45, about 660 spoken words. Read each beat as one take and leave a second of silence before the next one.

The running examples are Min Cost to Connect All Points as a card, a weighted undirected network-mode preset for Kruskal and Prim, and Connecting Cities With Minimum Cost for the disconnected case. The second half is the cheat sheet, built row by row over short clips from earlier sections. Problem statements on screen are short paraphrases, not LeetCode's text.

## Beat 1

On screen (card): "Points on a plane. Joining two points costs the Manhattan distance between them. What is the minimum cost to connect all the points?" The words "minimum cost" and "connect all" are highlighted.

The last kind of problem. You have points, and connecting two of them costs the distance between them. Connect everything for the least total cost. This isn't a shortest path. Nobody cares how far one point is from another inside the network. You just want every point reachable, as cheaply as possible. That's a minimum spanning tree.

## Beat 2

On screen (tool): network mode, a weighted undirected preset with seven nodes. The minimum spanning tree's edges are highlighted, with "6 edges" and the total cost shown.

A spanning tree reaches every node and has no cycles, so it always has exactly n minus one edges. The minimum spanning tree is the one with the smallest total weight. Any extra edge would only add cost, and a cycle means one of its edges wasn't needed. There are two standard ways to build it.

## Beat 3

On screen (tool): Kruskal. The edge list sorted by weight sits beside the graph. Each edge is accepted when it joins two groups, or rejected and crossed out when both ends are already joined. The forest merges into one tree.

The first is Kruskal. Sort all the edges by cost. Go through them cheapest first, and take each edge unless its two ends are already connected. That check is exactly Union-Find from part five. A failed union means the edge would close a cycle, so you skip it. Stop as soon as you've accepted n minus one edges.

## Beat 4

On screen (card): the Kruskal code panel types in.

```python
edges.sort()
total = used = 0
for w, u, v in edges:
    if union(u, v):
        total += w
        used += 1
        if used == n - 1:
            break
return total if used == n - 1 else -1
```

In code, it's barely more than the sort, and sorting is most of the running time: order E log E. If you run out of edges before reaching n minus one, the graph isn't connected, and that's when Connecting Cities With Minimum Cost wants minus one.

## Beat 5

On screen (tool): Prim on the same preset, from one start node. The tree grows one edge at a time, always taking the cheapest edge that leaves it. The heap of candidate edges is shown under the graph.

The second is Prim, and it should look familiar. Start from any node and grow one tree. Keep a heap of edges leaving the tree, and always take the cheapest one that reaches a new node. It's almost Dijkstra. The only difference is the key. Dijkstra uses the total distance from the start, and Prim uses just the weight of that one edge.

## Beat 6

On screen (card): "1,000 points → about 500,000 edges", then the array version of Prim: one "cheapest link to the tree" value per point, the smallest picked each round.

Which one fits the points problem? Every pair of points is an edge, so a thousand points means about half a million edges. Sorting them all works, but there's a neater way: Prim with a plain array. For each point, keep its cheapest connection to the tree so far, pick the smallest one each round, and update the rest. That's n squared with no heap and no edge list, and it's the best fit when every pair is connected.

## Beat 7

On screen (card + clips): the cheat sheet starts building row by row, each row over a short clip from its section: "two-way, friends → add both directions", "fewest steps or minutes → BFS, all sources together", "count islands, groups → loop over starts", "prerequisites, order → Kahn, fewer than n means a cycle".

That's every algorithm in this course, so let's put it on one page, as phrases you'll actually read in problem statements. Two-way, or friends: add every edge in both directions. Fewest steps or minutes on an unweighted graph: BFS, with every source in the queue at once. Count islands, groups or provinces: loop over every start and flood each piece. Prerequisites or order: Kahn's algorithm, and fewer than n in the output means a cycle.

## Beat 8

On screen (card + clips): the next rows: "group, merge, redundant edge → Union-Find", "cheapest, non-negative → Dijkstra", "at most k stops → Bellman–Ford with a copy", "all pairs, small n → Floyd–Warshall", "two groups → 2-coloring", "connect all cheaply → MST".

Group, merge or redundant edge: Union-Find. Cheapest or fastest with non-negative costs: Dijkstra. At most k stops: Bellman–Ford with a copy. All pairs with a small n: Floyd–Warshall. Two groups, or no two neighbors alike: two-coloring. And the minimum cost to connect everything: a minimum spanning tree.

## Beat 9

On screen (card): the full table, with the four questions from part 1 above it: directed, weighted, connected, tree. Then a closing card with a link to the notes.

And before any of these, ask the four questions from part one: directed, weighted, connected, tree. Read the statement for those words, read the constraints for the speed you need, then pick from this table. That covers most graph problems you'll meet on LeetCode. A few topics, like bridges, Euler paths and searching over states, are left for another video. The full table, with code for everything in this course, is in the notes linked below. Thanks for watching.
