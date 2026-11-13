# Section 6: Weighted shortest paths

Target length 5:00, about 700 spoken words. This is the longest section, so keep a steady pace. Read each beat as one take and leave a second of silence before the next one.

The running examples are a grid with mud cells (cost 5) in the graphs tool, Network Delay Time as a network-mode preset with the heap shown, Cheapest Flights Within K Stops as a preset where the copied dist row changes the answer, and a small Floyd–Warshall matrix. Problem statements on screen are short paraphrases, not LeetCode's text.

## Beat 1

On screen (tool): graphs tool, grid mode, a maze with brown mud cells that cost 5. BFS runs and its path goes straight through the mud. Then Dijkstra runs on the same grid and its path goes around. The path cost stats sit side by side.

Here's the same kind of maze, but the brown cells are mud. Stepping into mud costs five instead of one. BFS doesn't know that. It finds the path with the fewest steps, right through the mud. Dijkstra counts cost, not steps, so it goes around. Its path is longer, but cheaper. As soon as edges have different costs, the first visit is no longer the best one, and BFS gives wrong answers.

## Beat 2

On screen (tool): network mode, Network Delay Time preset: weighted directed edges, the dist row under the graph, and the heap shown as a sorted list next to it.

Dijkstra's idea: always finish the node that's cheapest to reach so far. Keep a min-heap of candidate distances, and pop the smallest. That distance is final, because any other route would have to pass through something at least as expensive. Then relax its edges: if going through this node makes a neighbor cheaper, update the neighbor and push its new distance. Network Delay Time is exactly this, and the answer is the largest final distance.

## Beat 3

On screen (tool): Dijkstra stepping. One node is pushed with cost 7, later again with cost 4. Both entries sit in the heap. The 4 is popped first; later the 7 is popped, marked "stale" and skipped.

Watch this node. It's pushed once with cost seven, and later again with cost four, when a cheaper route turns up. The heap now holds both. Python's heap can't update an entry in place, so we leave the old one there. When it's popped, we compare it with the best known distance and skip it. That one line, the stale check, is what keeps Dijkstra fast.

## Beat 4

On screen (card): the Dijkstra code panel types in. The stale check is highlighted.

```python
dist = [inf] * n
dist[src] = 0
heap = [(0, src)]
while heap:
    d, u = heappop(heap)
    if d > dist[u]:
        continue   # stale entry
    for v, w in graph[u]:
        if d + w < dist[v]:
            dist[v] = d + w
            heappush(heap, (dist[v], v))
```

Here's the full loop, in order E log V. There's one rule: weights must not be negative. A negative edge could make a finished node cheaper later, and Dijkstra never looks back. Within that rule, it bends. In Path With Minimum Effort, a path costs its single biggest step, so you combine with max instead of plus, and the same loop still works.

## Beat 5

On screen (card): "Every move costs 0 or 1" and a deque: a 0-cost move goes in at the front, a 1-cost move at the back.

One shortcut worth knowing. If every move costs either zero or one, you don't need a heap. Use a deque: push zero-cost moves to the front, and one-cost moves to the back. The deque stays sorted by distance on its own, and you're back to linear time. That's called 0-1 BFS.

## Beat 6

On screen (card, then tool): the flights card from part 1 with "at most k stops" highlighted. Then network mode, Cheapest Flights preset, with k = 1.

Now the third problem from part one: the cheapest flight with at most k stops. Plain Dijkstra fails here. It can lock in the cheapest price for a city using a route with too many stops, and then throw away a pricier route that still had stops to spare. We need an algorithm that counts edges, and that's Bellman–Ford.

## Beat 7

On screen (tool): Bellman–Ford, one pass at a time. A frozen copy of the dist row sits above the live row. Each edge reads from the copy and writes into the live row. The pass counter shows 1 of 2, then 2 of 2.

Bellman–Ford is simpler than Dijkstra. Go over every edge, and if it makes its endpoint cheaper, update it. That's one pass. After one pass, you know the best prices using at most one flight. After two passes, at most two flights. K stops means k plus one flights, so run exactly k plus one passes. The catch is the copy row on top. Each pass must read the prices from the previous pass, not the ones it wrote a moment ago.

## Beat 8

On screen (tool): the same flights with the copy switched off. Pass 1 matches; in pass 2 the middle city is updated, then the destination is updated from that brand new price in the same pass. The result is cheaper than the correct answer and is marked wrong.

Here's why. Without the copy, this pass updates the middle city, and then, in the same pass, it uses that brand new price to reach the destination. That's two flights in one pass, and the stop limit is silently broken. The answer comes out cheaper than it should be, and it's wrong. Copy the array at the start of each pass, and read only from the copy.

## Beat 9

On screen (card): the k-stops code panel types in. The copy line is highlighted.

```python
dist = [inf] * n
dist[src] = 0
for _ in range(k + 1):
    prev = dist[:]
    for u, v, w in flights:
        if prev[u] + w < dist[v]:
            dist[v] = prev[u] + w
return dist[dst] if dist[dst] < inf else -1
```

The code is short, and it runs in order k times E. Bellman–Ford also handles negative edges, which is its other job. Run n minus one passes, and if one more pass can still improve something, there's a negative cycle.

## Beat 10

On screen (tool): the Floyd–Warshall matrix view on a five-node graph. For each k in turn, the row and column of k light up and the cells that get shorter change color.

The last tool is for when you need the distance between every pair, and n is only a few hundred. That's Floyd–Warshall: a matrix and three loops. For each node k, check whether going through k shortens the path from i to j. The k loop has to be the outermost one. That's n cubed, which is fine for a hundred nodes, and it's the intended solution for Find the City With the Smallest Number of Neighbors.

## Beat 11

On screen (card): a checklist builds line by line: equal costs → BFS, 0 or 1 → deque, non-negative → Dijkstra with the stale check, at most k edges or negative → Bellman–Ford with a copy, all pairs and small n → Floyd–Warshall.

So, choose by the weights. Equal costs: BFS. Zero or one: a deque. Non-negative: Dijkstra with the stale check. A limit on edges, or negative weights: Bellman–Ford with a copy. All pairs and a small n: Floyd–Warshall. Next, a different kind of question: not how far apart two nodes are, but whether a graph can be split in two.
