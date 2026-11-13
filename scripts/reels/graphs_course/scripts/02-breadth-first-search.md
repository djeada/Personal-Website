# Section 2: Breadth-first search

Target length 4:45, about 660 spoken words. Read each beat as one take and leave a second of silence before the next one.

The running examples are a maze on the graphs tool (one fixed seed, reused in part 3), the six-node graph from part 1 in the Data Structure Lab, and Rotting Oranges for the multi-source version. Problem statements on screen are short paraphrases, not LeetCode's text.

## Beat 1

On screen (tool): graphs tool, BFS on the seeded maze, running until the path appears. Then a card: "A grid of open cells and walls. What is the fewest number of moves from the top-left to the bottom-right?"

In part one, we learned to see the graph in a problem. Now we search it. Breadth-first search, or BFS, is the answer to one question that comes up constantly on LeetCode: what's the fewest number of steps? Fewest moves through a maze, fewest transformations from one word to another, fewest minutes for something to spread. Whenever every step costs the same, BFS is the tool.

## Beat 2

On screen (tool): the same maze with "Show distances" on, stepping slowly so the numbers spread out from the start in rings.

The idea is simple. Start at the source. First visit everything one step away, then everything two steps away, then three, and so on. The search spreads out in rings, like a ripple on water. Each number here is how many steps that cell is from the start, and notice that the numbers never skip. A ring is only explored after the whole ring before it is finished.

## Beat 3

On screen (card): the BFS code panel types in.

```python
from collections import deque

dist = {start: 0}
queue = deque([start])
while queue:
    u = queue.popleft()
    for v in graph[u]:
        if v not in dist:
            dist[v] = dist[u] + 1
            queue.append(v)
```

In code, the rings come from a queue: first in, first out. Put the start in the queue. Then repeatedly take the node at the front, and push each neighbor you haven't seen yet to the back, one step further than the node it came from. This dictionary does two jobs at once. It stores each distance, and it remembers which nodes you've already seen.

## Beat 4

On screen (tool): stepping BFS one dequeue at a time. Frontier cells (in the queue) are drawn differently from visited cells.

Here's the detail that separates working BFS from buggy BFS. Mark a node as seen when you push it, not when you pop it. These outlined cells are in the queue right now, already marked, waiting their turn. If you only marked nodes when you popped them, the same cell could be pushed again and again by each of its neighbors, and on a big grid your queue would explode.

## Beat 5

On screen (tool): Data Structure Lab, the graph from part 1, BFS search from A. The trace reads the order A, B, C, D, E, F.

Why is the first visit always the shortest? Because the queue hands out nodes in order of distance. Look at the order BFS takes on our graph from part one: A, then B and C, then D and E, then F. Distance zero, one, two, three. By the time a node is first reached, every closer node has already been processed, so no shorter route can still be on its way.

## Beat 6

On screen (tool): back on the maze, the finished search with the path drawn and the path length stat highlighted.

Usually you need the distance, and sometimes the actual path. For the path, store a parent for each node when you first push it. When you reach the target, walk the parents backwards to the start and reverse the list. On a grid, the neighbors are the four cells up, down, left and right that are inside the grid and not walls. And in Python, always use a deque. Popping from the front of a list is slow, and it quietly turns a linear algorithm into a quadratic one.

## Beat 7

On screen (card): "A grid of fresh and rotten oranges. Every minute, rot spreads to neighboring fresh oranges. How many minutes until none are fresh, or -1 if that never happens?"

Now a twist you'll meet often. In Rotting Oranges, the rot doesn't start in one place. It starts at every rotten orange at the same time. You don't run a search from each one. You put all of them in the queue before the loop starts, all at distance zero. That's called multi-source BFS, and it's also the trick behind 01 Matrix, where you need the distance from every cell to its nearest zero.

## Beat 8

On screen (tool): Multi-source BFS mode with three sources, stepping level by level. The Level stat counts up.

Watch three sources spreading at once. The question asks for minutes, so we process one level at a time, and each level is one minute. The Level counter here is exactly the answer. At the end, if any fresh orange was never reached, it's walled off, and the answer is minus one.

## Beat 9

On screen (card): the level-by-level loop.

```python
minutes = 0
while queue and fresh > 0:
    for _ in range(len(queue)):
        r, c = queue.popleft()
        # rot each fresh neighbor, fresh -= 1, push it
    minutes += 1
return minutes if fresh == 0 else -1
```

In code, the only change is this inner loop. Read the length of the queue at the start of each round, and process exactly that many nodes. Those are the whole current level. Everything they push belongs to the next level, the next minute.

## Beat 10

On screen (card): a checklist builds line by line: unweighted, queue, mark on push, levels are distances, several starts together, O(V + E).

BFS touches every node and every edge once, so it runs in order V plus E. Use it when every step costs the same. When steps have different costs, BFS gives wrong answers, and that's part six. So remember: a queue, mark on push, levels are distances, and several starts go in together. Next, the other way to walk a graph: depth-first search, on this very same maze.
